import {
  INSPECTOR_CHANNEL,
  buildMessage,
  createInspectorProtocolError,
  isOriginTrusted,
  parseMessage,
  type AnyInspectorMessage,
  type HostToEmbeddedMessage,
  type HostToEmbeddedMessageType,
  type InspectorErrorCode,
  type SnapshotPayload,
} from '@iteraai/inspector-protocol';
import { createReactInspectorAdapter } from './adapters/base/createReactInspectorAdapter';
import type { ReactInspectorRuntimeConfig } from './adapters/base/types';
import { createInspectorHighlighter } from './highlighter';
import { capTreeSnapshot, type ReactTreeAdapter } from './reactTreeAdapter';
import {
  emitEmbeddedBridgeLifecycleMetric,
  emitEmbeddedBridgeRejectionMetric,
  type EmbeddedBridgeRejectionReasonCode,
  type EmbeddedBridgeTelemetryHooks,
} from './security/bridgeTelemetry';
import {
  emitEmbeddedInspectorSecurityRejectionEvent,
  mapOversizeRejectionReasonToSecurityReasonCode,
  mapTokenValidationRejectionToSecurityReasonCode,
} from './security/inspectorSecurityEvents';
import {
  evaluateEmbeddedInboundMessageSize,
  measureInspectorMessageSizeInBytes,
} from './security/messageSizePolicy';
import {
  validateHelloSessionToken,
  type InspectorBridgeSecurityOptions,
  type InspectorSessionTokenValidationResult,
} from './security/tokenValidation';
import { serializeNodeProps } from './serializer';

type InspectorBridgeMode = 'development' | 'iteration' | 'production';

export type InspectorBridgeRequestHandlers = {
  onHighlightNode?: (message: HostToEmbeddedMessage) => void;
  onClearHighlight?: (message: HostToEmbeddedMessage) => void;
};

export type InitInspectorBridgeOptions = {
  hostOrigins: readonly string[];
  enabled: boolean;
  killSwitchActive?: boolean;
  mode?: InspectorBridgeMode;
  runtimeConfig?: ReactInspectorRuntimeConfig;
  capabilities?: string[];
  treeAdapter?: ReactTreeAdapter;
  adapterFactory?: (
    runtimeConfig?: ReactInspectorRuntimeConfig,
  ) => ReactTreeAdapter | undefined;
  handlers?: InspectorBridgeRequestHandlers;
  security?: InspectorBridgeSecurityOptions;
  telemetry?: EmbeddedBridgeTelemetryHooks;
};

type ResolvedInitInspectorBridgeOptions = Omit<
  InitInspectorBridgeOptions,
  'treeAdapter'
> & {
  treeAdapter?: ReactTreeAdapter;
};

type InspectorBridge = {
  destroy: () => void;
};

type EmbeddedReactInspectorSelectionApi = {
  getReactComponentPathForElement: (
    element: Element,
  ) => ReadonlyArray<string> | undefined;
};

type MessageTarget = {
  postMessage: (message: unknown, targetOrigin: string) => void;
};

declare global {
  interface Window {
    __ARA_EMBEDDED_REACT_INSPECTOR_SELECTION__?:
      | EmbeddedReactInspectorSelectionApi
      | undefined;
  }
}

type HostReadyConnection = {
  target: MessageEventSource | null;
  origin: string;
  sessionId?: string;
};

type HandleHostMessageCallbacks = {
  onReady?: (connection: HostReadyConnection) => void;
};

const PREVIEW_PATH_CHANNEL = 'itera-preview-path';
const PREVIEW_PATH_UPDATED_TYPE = 'PATH_UPDATED';

const TREE_NAVIGATION_REFRESH_DEBOUNCE_MS = 120;
const TREE_NAVIGATION_FOLLOW_UP_REFRESH_DELAY_MS = 1200;

const hostMessageTypeSet = new Set<HostToEmbeddedMessageType>([
  'HELLO',
  'REQUEST_TREE',
  'REQUEST_NODE_PROPS',
  'REQUEST_SNAPSHOT',
  'HIGHLIGHT_NODE',
  'CLEAR_HIGHLIGHT',
  'PING',
]);

let activeBridge: InspectorBridge | undefined;

const isHostToEmbeddedMessage = (
  message: AnyInspectorMessage,
): message is HostToEmbeddedMessage => {
  return hostMessageTypeSet.has(message.type as HostToEmbeddedMessageType);
};

const toMessageTarget = (
  source: MessageEventSource | null,
): MessageTarget | undefined => {
  if (source === null) {
    return undefined;
  }

  if (typeof (source as MessageTarget).postMessage !== 'function') {
    return undefined;
  }

  return source as MessageTarget;
};

const postRawToTarget = (
  target: MessageEventSource | null,
  targetOrigin: string,
  message: unknown,
) => {
  const eventTarget = toMessageTarget(target);

  if (eventTarget !== undefined) {
    eventTarget.postMessage(message, targetOrigin);
    return;
  }

  window.parent.postMessage(message, targetOrigin);
};

const postToTarget = (
  target: MessageEventSource | null,
  targetOrigin: string,
  message: AnyInspectorMessage,
) => {
  postRawToTarget(target, targetOrigin, message);
};

const postNodeNotFoundError = (
  event: MessageEvent,
  nodeId: string,
  requestId?: string,
  sessionId?: string,
) => {
  const nodeNotFoundError = createInspectorProtocolError('ERR_NODE_NOT_FOUND');

  postToTarget(
    event.source,
    event.origin,
    buildMessage(
      'ERROR',
      {
        code: nodeNotFoundError.code,
        message: nodeNotFoundError.message,
        details: {
          nodeId,
        },
      },
      {
        requestId,
        sessionId,
      },
    ),
  );
};

const SNAPSHOT_RESPONSE_SOFT_MAX_BYTES = 112 * 1024;
const SNAPSHOT_CAPTURE_BLOB_MIME_TYPE = 'image/svg+xml';

const toSnapshotCaptureBlob = (): {
  blob: Blob;
  width: number;
  height: number;
} => {
  const placeholderMarkup =
    '<svg xmlns="http://www.w3.org/2000/svg" width="1" height="1" viewBox="0 0 1 1"></svg>';

  return {
    blob: new Blob([placeholderMarkup], {
      type: SNAPSHOT_CAPTURE_BLOB_MIME_TYPE,
    }),
    width: 1,
    height: 1,
  };
};

const toSnapshotHtmlPayload = (): {
  html: string;
  htmlTruncated: boolean;
} => {
  return {
    html: document.documentElement.outerHTML,
    htmlTruncated: false,
  };
};

type SessionTokenValidationFailure = Exclude<
  InspectorSessionTokenValidationResult,
  { ok: true }
>;

const postUnauthorizedSessionError = (
  event: MessageEvent,
  options: InitInspectorBridgeOptions,
  validationError: SessionTokenValidationFailure,
  requestId?: string,
  sessionId?: string,
) => {
  const unauthorizedSessionError = createInspectorProtocolError(
    'ERR_UNAUTHORIZED_SESSION',
    validationError.message,
  );

  emitEmbeddedInspectorSecurityRejectionEvent({
    reasonCode: mapTokenValidationRejectionToSecurityReasonCode(
      validationError.reason,
    ),
    messageType: 'HELLO',
    requestId,
    sessionId,
    errorCode: unauthorizedSessionError.code,
  });
  emitRejectionLifecycleTelemetry(
    options,
    'token-reject',
    {
      type: 'HELLO',
      requestId,
      sessionId,
    },
    unauthorizedSessionError.code,
  );

  postToTarget(
    event.source,
    event.origin,
    buildMessage(
      'ERROR',
      {
        code: unauthorizedSessionError.code,
        message: unauthorizedSessionError.message,
        details: {
          reason: validationError.reason,
        },
      },
      {
        requestId,
        sessionId,
      },
    ),
  );
};

type OversizeInboundMessageFailure = Exclude<
  ReturnType<typeof evaluateEmbeddedInboundMessageSize>,
  { ok: true }
>;

const isRecord = (value: unknown): value is Record<string, unknown> => {
  return typeof value === 'object' && value !== null;
};

const toRawMessageObject = (
  rawMessage: unknown,
): Record<string, unknown> | undefined => {
  if (typeof rawMessage === 'string') {
    try {
      const parsedMessage = JSON.parse(rawMessage) as unknown;

      return isRecord(parsedMessage) ? parsedMessage : undefined;
    } catch {
      return undefined;
    }
  }

  return isRecord(rawMessage) ? rawMessage : undefined;
};

const readMessageContext = (
  rawMessage: unknown,
): {
  type?: string;
  requestId?: string;
  sessionId?: string;
} => {
  const messageObject = toRawMessageObject(rawMessage);

  if (messageObject === undefined) {
    return {};
  }

  return {
    type:
      typeof messageObject.type === 'string' ? messageObject.type : undefined,
    requestId:
      typeof messageObject.requestId === 'string'
        ? messageObject.requestId
        : undefined,
    sessionId:
      typeof messageObject.sessionId === 'string'
        ? messageObject.sessionId
        : undefined,
  };
};

const postOversizeMessageError = (
  event: MessageEvent,
  options: InitInspectorBridgeOptions,
  failure: OversizeInboundMessageFailure,
) => {
  const messageContext = readMessageContext(event.data);
  const responseContext = {
    requestId: messageContext.requestId,
    sessionId: messageContext.sessionId,
  };
  const actualBytes =
    failure.sizeInBytes === undefined ? 'unavailable' : failure.sizeInBytes;
  const oversizeError = createInspectorProtocolError(
    'ERR_OVERSIZE_MESSAGE',
    `Rejected inbound host message: reason=${failure.reason}, maxBytes=${failure.maxInboundMessageBytes}, actualBytes=${actualBytes}.`,
  );

  emitEmbeddedInspectorSecurityRejectionEvent({
    reasonCode: mapOversizeRejectionReasonToSecurityReasonCode(failure.reason),
    messageType: messageContext.type,
    requestId: messageContext.requestId,
    sessionId: messageContext.sessionId,
    errorCode: oversizeError.code,
  });
  emitRejectionLifecycleTelemetry(
    options,
    'oversize-reject',
    messageContext,
    oversizeError.code,
  );

  postToTarget(
    event.source,
    event.origin,
    buildMessage(
      'ERROR',
      {
        code: oversizeError.code,
        message: oversizeError.message,
        details: {
          reason: failure.reason,
          maxBytes: failure.maxInboundMessageBytes,
          actualBytes,
        },
      },
      responseContext,
    ),
  );
};

const isInspectorChannelCandidate = (rawMessage: unknown): boolean => {
  const messageObject = toRawMessageObject(rawMessage);

  return messageObject?.channel === INSPECTOR_CHANNEL;
};

const emitRejectionLifecycleTelemetry = (
  options: InitInspectorBridgeOptions,
  reasonCode: EmbeddedBridgeRejectionReasonCode,
  messageContext: ReturnType<typeof readMessageContext>,
  errorCode: InspectorErrorCode,
) => {
  emitEmbeddedBridgeRejectionMetric(
    {
      reasonCode,
      messageType: messageContext.type,
      requestId: messageContext.requestId,
      sessionId: messageContext.sessionId,
      errorCode,
    },
    options.telemetry,
  );
  emitEmbeddedBridgeLifecycleMetric(
    {
      stage: 'error',
      messageType: messageContext.type,
      requestId: messageContext.requestId,
      sessionId: messageContext.sessionId,
      errorCode,
    },
    options.telemetry,
  );
};

const resolveTreeAdapter = (
  options: InitInspectorBridgeOptions,
): ReactTreeAdapter | undefined => {
  if (options.treeAdapter !== undefined) {
    return options.treeAdapter;
  }

  if (options.adapterFactory !== undefined) {
    return options.adapterFactory(options.runtimeConfig);
  }

  if (options.runtimeConfig === undefined) {
    return undefined;
  }

  return createReactInspectorAdapter(options.runtimeConfig, {
    telemetry: options.telemetry,
  });
};

const resolveInitOptions = (
  options: InitInspectorBridgeOptions,
): ResolvedInitInspectorBridgeOptions => {
  return {
    ...options,
    treeAdapter: resolveTreeAdapter(options),
  };
};

const postSnapshotResponse = (
  event: MessageEvent,
  options: InitInspectorBridgeOptions,
  responseOptions: {
    requestId?: string;
    sessionId?: string;
  },
  requestPayload: {
    includeTree?: boolean;
    includeHtml?: boolean;
  },
) => {
  const includeTree = requestPayload.includeTree !== false;
  const includeHtml = requestPayload.includeHtml !== false;
  const snapshotCapture = toSnapshotCaptureBlob();
  const treeSnapshot = includeTree
    ? options.treeAdapter === undefined
      ? {
          nodes: [],
          rootIds: [],
        }
      : capTreeSnapshot(options.treeAdapter.getTreeSnapshot())
    : {
        nodes: [],
        rootIds: [],
      };
  const htmlSnapshotPayload = includeHtml ? toSnapshotHtmlPayload() : undefined;

  let snapshotPayload: SnapshotPayload = {
    capture: snapshotCapture.blob,
    captureMimeType: SNAPSHOT_CAPTURE_BLOB_MIME_TYPE,
    width: snapshotCapture.width,
    height: snapshotCapture.height,
    capturedAt: Date.now(),
    treeSnapshot: {
      nodes: treeSnapshot.nodes,
      rootIds: treeSnapshot.rootIds,
      ...(treeSnapshot.meta !== undefined && {
        meta: treeSnapshot.meta,
      }),
    },
    ...(htmlSnapshotPayload !== undefined && {
      html: htmlSnapshotPayload.html,
      htmlTruncated: htmlSnapshotPayload.htmlTruncated,
    }),
  };

  let snapshotMessage = buildMessage(
    'SNAPSHOT',
    snapshotPayload,
    responseOptions,
  );
  const initialMessageSizeInBytes =
    measureInspectorMessageSizeInBytes(snapshotMessage);

  if (
    snapshotPayload.html !== undefined &&
    (initialMessageSizeInBytes === undefined ||
      initialMessageSizeInBytes > SNAPSHOT_RESPONSE_SOFT_MAX_BYTES)
  ) {
    snapshotPayload = {
      ...snapshotPayload,
      html: undefined,
      htmlTruncated: true,
    };
    snapshotMessage = buildMessage(
      'SNAPSHOT',
      snapshotPayload,
      responseOptions,
    );
  }

  const finalMessageSizeInBytes =
    measureInspectorMessageSizeInBytes(snapshotMessage);

  if (
    finalMessageSizeInBytes === undefined ||
    finalMessageSizeInBytes > SNAPSHOT_RESPONSE_SOFT_MAX_BYTES
  ) {
    const oversizeError = createInspectorProtocolError(
      'ERR_OVERSIZE_MESSAGE',
      `Snapshot response exceeded size budget: maxBytes=${SNAPSHOT_RESPONSE_SOFT_MAX_BYTES}, actualBytes=${finalMessageSizeInBytes ?? 'unavailable'}.`,
    );

    postToTarget(
      event.source,
      event.origin,
      buildMessage(
        'ERROR',
        {
          code: oversizeError.code,
          message: oversizeError.message,
          details: {
            reason: 'snapshot-response-too-large',
            maxBytes: SNAPSHOT_RESPONSE_SOFT_MAX_BYTES,
            actualBytes:
              finalMessageSizeInBytes === undefined
                ? 'unavailable'
                : finalMessageSizeInBytes,
          },
        },
        responseOptions,
      ),
    );
    return;
  }

  postToTarget(event.source, event.origin, snapshotMessage);
};

const handleHostMessage = (
  event: MessageEvent,
  options: InitInspectorBridgeOptions,
  highlightElement: (element: Element) => void,
  clearHighlight: () => void,
  callbacks?: HandleHostMessageCallbacks,
) => {
  const parsed = parseMessage(event.data, {
    sourceOrigin: event.origin,
    trustedOrigins: options.hostOrigins,
  });

  if (!parsed.ok) {
    if (parsed.error.code === 'ERR_INVALID_PAYLOAD') {
      const messageContext = readMessageContext(event.data);

      emitRejectionLifecycleTelemetry(
        options,
        'invalid-payload-reject',
        messageContext,
        parsed.error.code,
      );
    }

    return;
  }

  if (!isHostToEmbeddedMessage(parsed.message)) {
    return;
  }

  const responseOptions = {
    requestId: parsed.message.requestId,
    sessionId: parsed.message.sessionId,
  };

  if (parsed.message.type === 'HELLO') {
    if (options.security?.enabled === true) {
      const tokenValidationResult = (
        options.security.tokenValidator ?? validateHelloSessionToken
      )(parsed.message.payload.auth);

      if (!tokenValidationResult.ok) {
        postUnauthorizedSessionError(
          event,
          options,
          tokenValidationResult,
          responseOptions.requestId,
          responseOptions.sessionId,
        );
        return;
      }
    }

    postToTarget(
      event.source,
      event.origin,
      buildMessage(
        'READY',
        {
          capabilities: options.capabilities,
        },
        responseOptions,
      ),
    );
    emitEmbeddedBridgeLifecycleMetric(
      {
        stage: 'ready',
        messageType: 'HELLO',
        requestId: responseOptions.requestId,
        sessionId: responseOptions.sessionId,
      },
      options.telemetry,
    );
    callbacks?.onReady?.({
      target: event.source,
      origin: event.origin,
      sessionId: responseOptions.sessionId,
    });
    return;
  }

  if (parsed.message.type === 'PING') {
    postToTarget(
      event.source,
      event.origin,
      buildMessage(
        'PONG',
        {
          sentAt: parsed.message.payload?.sentAt,
        },
        responseOptions,
      ),
    );
    return;
  }

  if (parsed.message.type === 'REQUEST_TREE') {
    if (options.treeAdapter === undefined) {
      return;
    }

    const treeSnapshot = capTreeSnapshot(options.treeAdapter.getTreeSnapshot());

    postToTarget(
      event.source,
      event.origin,
      buildMessage(
        'TREE_SNAPSHOT',
        {
          nodes: treeSnapshot.nodes,
          rootIds: treeSnapshot.rootIds,
          ...(treeSnapshot.meta !== undefined && {
            meta: treeSnapshot.meta,
          }),
        },
        responseOptions,
      ),
    );
    return;
  }

  if (parsed.message.type === 'REQUEST_NODE_PROPS') {
    const nodeId = parsed.message.payload.nodeId;

    if (options.treeAdapter === undefined) {
      postNodeNotFoundError(
        event,
        nodeId,
        responseOptions.requestId,
        responseOptions.sessionId,
      );
      return;
    }

    const rawNodeProps = options.treeAdapter.getNodeProps(nodeId);

    if (rawNodeProps === undefined) {
      postNodeNotFoundError(
        event,
        nodeId,
        responseOptions.requestId,
        responseOptions.sessionId,
      );
      return;
    }

    const serializedNodeProps = serializeNodeProps(rawNodeProps);

    postToTarget(
      event.source,
      event.origin,
      buildMessage(
        'NODE_PROPS',
        {
          nodeId,
          props: serializedNodeProps.props,
          meta: serializedNodeProps.meta,
        },
        responseOptions,
      ),
    );

    return;
  }

  if (parsed.message.type === 'REQUEST_SNAPSHOT') {
    postSnapshotResponse(
      event,
      options,
      responseOptions,
      parsed.message.payload ?? {},
    );
    return;
  }

  if (parsed.message.type === 'HIGHLIGHT_NODE') {
    const nodeId = parsed.message.payload.nodeId;

    if (options.treeAdapter === undefined) {
      clearHighlight();
      postNodeNotFoundError(
        event,
        nodeId,
        responseOptions.requestId,
        responseOptions.sessionId,
      );
      return;
    }

    const domElement = options.treeAdapter.getDomElement(nodeId);

    if (domElement === null) {
      clearHighlight();
      postNodeNotFoundError(
        event,
        nodeId,
        responseOptions.requestId,
        responseOptions.sessionId,
      );
      return;
    }

    highlightElement(domElement);
    options.handlers?.onHighlightNode?.(parsed.message);
    return;
  }

  if (parsed.message.type === 'CLEAR_HIGHLIGHT') {
    clearHighlight();
    options.handlers?.onClearHighlight?.(parsed.message);
  }
};

const shouldEnableBridge = (options: InitInspectorBridgeOptions): boolean => {
  if (options.killSwitchActive === true) {
    return false;
  }

  if (!options.enabled) {
    return false;
  }

  if (options.mode === 'production') {
    return false;
  }

  return options.hostOrigins.length > 0;
};

export const initInspectorBridge = (
  options: InitInspectorBridgeOptions,
): InspectorBridge => {
  if (activeBridge !== undefined) {
    activeBridge.destroy();
  }

  if (!shouldEnableBridge(options)) {
    if (options.killSwitchActive === true) {
      console.warn(
        '[react-inspector-bridge] Embedded inspector bridge disabled by kill switch.',
      );
    }

    activeBridge = {
      destroy: () => {
        activeBridge = undefined;
      },
    };
    return activeBridge;
  }

  const resolvedOptions = resolveInitOptions(options);
  const highlighter = createInspectorHighlighter();
  const selectionApi: EmbeddedReactInspectorSelectionApi = {
    getReactComponentPathForElement: (element: Element) => {
      return resolvedOptions.treeAdapter?.getReactComponentPathForElement?.(
        element,
      );
    },
  };
  let hostReadyConnection: HostReadyConnection | undefined = undefined;
  let pendingTreeRefreshTimeout:
    | number
    | ReturnType<typeof setTimeout>
    | undefined = undefined;
  let pendingTreeFollowUpRefreshTimeout:
    | number
    | ReturnType<typeof setTimeout>
    | undefined = undefined;

  const postPreviewPathUpdate = () => {
    if (hostReadyConnection === undefined) {
      return;
    }

    const pathname =
      window.location.pathname.length > 0 ? window.location.pathname : '/';
    const nextPath = `${pathname}${window.location.search}${window.location.hash}`;

    postRawToTarget(hostReadyConnection.target, hostReadyConnection.origin, {
      channel: PREVIEW_PATH_CHANNEL,
      type: PREVIEW_PATH_UPDATED_TYPE,
      path: nextPath,
    });
  };

  const clearPendingTreeRefreshTimeout = () => {
    if (pendingTreeRefreshTimeout === undefined) {
      return;
    }

    clearTimeout(pendingTreeRefreshTimeout);
    pendingTreeRefreshTimeout = undefined;
  };

  const clearPendingTreeFollowUpRefreshTimeout = () => {
    if (pendingTreeFollowUpRefreshTimeout === undefined) {
      return;
    }

    clearTimeout(pendingTreeFollowUpRefreshTimeout);
    pendingTreeFollowUpRefreshTimeout = undefined;
  };

  const postRefreshedTreeSnapshot = () => {
    if (
      resolvedOptions.treeAdapter === undefined ||
      hostReadyConnection === undefined
    ) {
      return;
    }

    const treeSnapshot = capTreeSnapshot(
      resolvedOptions.treeAdapter.getTreeSnapshot(),
    );

    postToTarget(
      hostReadyConnection.target,
      hostReadyConnection.origin,
      buildMessage(
        'TREE_SNAPSHOT',
        {
          nodes: treeSnapshot.nodes,
          rootIds: treeSnapshot.rootIds,
          ...(treeSnapshot.meta !== undefined && {
            meta: treeSnapshot.meta,
          }),
        },
        {
          sessionId: hostReadyConnection.sessionId,
        },
      ),
    );
  };

  const scheduleTreeRefreshAfterNavigation = () => {
    if (
      resolvedOptions.treeAdapter === undefined ||
      hostReadyConnection === undefined
    ) {
      return;
    }

    clearPendingTreeRefreshTimeout();
    clearPendingTreeFollowUpRefreshTimeout();
    pendingTreeRefreshTimeout = setTimeout(() => {
      pendingTreeRefreshTimeout = undefined;
      postRefreshedTreeSnapshot();
    }, TREE_NAVIGATION_REFRESH_DEBOUNCE_MS);
    pendingTreeFollowUpRefreshTimeout = setTimeout(() => {
      pendingTreeFollowUpRefreshTimeout = undefined;
      postRefreshedTreeSnapshot();
    }, TREE_NAVIGATION_FOLLOW_UP_REFRESH_DELAY_MS);
  };

  const handleNavigation = () => {
    postPreviewPathUpdate();
    scheduleTreeRefreshAfterNavigation();
  };

  const originalPushState = window.history.pushState.bind(window.history);
  const originalReplaceState = window.history.replaceState.bind(window.history);

  const patchedPushState: History['pushState'] = (...args) => {
    originalPushState(...args);
    handleNavigation();
  };

  const patchedReplaceState: History['replaceState'] = (...args) => {
    originalReplaceState(...args);
    handleNavigation();
  };

  window.history.pushState = patchedPushState;
  window.history.replaceState = patchedReplaceState;
  window.addEventListener('popstate', handleNavigation);
  window.addEventListener('hashchange', handleNavigation);
  window.__ARA_EMBEDDED_REACT_INSPECTOR_SELECTION__ = selectionApi;

  const onMessage = (event: MessageEvent) => {
    if (!isOriginTrusted(event.origin, resolvedOptions.hostOrigins)) {
      if (isInspectorChannelCandidate(event.data)) {
        const messageContext = readMessageContext(event.data);

        emitRejectionLifecycleTelemetry(
          resolvedOptions,
          'origin-reject',
          messageContext,
          'ERR_INVALID_ORIGIN',
        );
      }

      return;
    }

    if (!isInspectorChannelCandidate(event.data)) {
      return;
    }

    const inboundMessageSizeResult = evaluateEmbeddedInboundMessageSize(
      event.data,
    );

    if (!inboundMessageSizeResult.ok) {
      postOversizeMessageError(
        event,
        resolvedOptions,
        inboundMessageSizeResult,
      );
      return;
    }

    handleHostMessage(
      event,
      resolvedOptions,
      highlighter.highlightElement,
      highlighter.clearHighlight,
      {
        onReady: (connection) => {
          hostReadyConnection = connection;
          postPreviewPathUpdate();
        },
      },
    );
  };

  window.addEventListener('message', onMessage);
  emitEmbeddedBridgeLifecycleMetric(
    {
      stage: 'connect',
    },
    resolvedOptions.telemetry,
  );

  activeBridge = {
    destroy: () => {
      window.removeEventListener('message', onMessage);
      window.removeEventListener('popstate', handleNavigation);
      window.removeEventListener('hashchange', handleNavigation);
      window.history.pushState = originalPushState;
      window.history.replaceState = originalReplaceState;
      clearPendingTreeRefreshTimeout();
      clearPendingTreeFollowUpRefreshTimeout();
      hostReadyConnection = undefined;
      highlighter.destroy();

      if (window.__ARA_EMBEDDED_REACT_INSPECTOR_SELECTION__ === selectionApi) {
        delete window.__ARA_EMBEDDED_REACT_INSPECTOR_SELECTION__;
      }

      if (activeBridge !== undefined) {
        activeBridge = undefined;
      }
    },
  };

  return activeBridge;
};

export const destroyInspectorBridge = () => {
  if (activeBridge === undefined) {
    return;
  }

  activeBridge.destroy();
};
