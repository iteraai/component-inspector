import {
  deriveTargetOriginFromIframeSrc,
  embeddedToHostMessageTypes,
  hostToEmbeddedMessageTypes,
  isOriginTrusted,
  parseMessage,
} from '@iteraai/inspector-protocol';
import {
  isIterationInspectorParentMessage,
  isIterationInspectorRuntimeMessage,
} from '../iterationInspector';
import {
  resolveConcreteOrigin,
  resolveConfiguredHostOrigins,
  type ConfiguredHostOrigins,
} from '../hostOrigins';

type MessageTarget = {
  postMessage: (message: unknown, targetOrigin: string) => void;
};

type StorybookRelayConnection = {
  origin: string;
  target: MessageEventSource | Window | null;
};

export type StorybookPreviewIframeResolver = (
  doc: Document,
) => HTMLIFrameElement | null;

export type InitStorybookManagerRelayOptions = {
  hostOrigins?: ConfiguredHostOrigins;
  defaultHostOrigins?: readonly string[];
  previewIframeSelector?: string;
  resolvePreviewIframe?: StorybookPreviewIframeResolver;
  referrer?: string;
  win?: Window;
  doc?: Document;
  parentWindow?: MessageEventSource | Window | null;
};

export type StorybookManagerRelay = {
  destroy: () => void;
};

export const DEFAULT_STORYBOOK_PREVIEW_IFRAME_SELECTOR =
  'iframe#storybook-preview-iframe';

const hostInspectorMessageTypes = new Set(hostToEmbeddedMessageTypes);
const previewInspectorMessageTypes = new Set(embeddedToHostMessageTypes);

let activeStorybookManagerRelay: StorybookManagerRelay | undefined;

const toMessageTarget = (
  target: MessageEventSource | Window | null,
): MessageTarget | undefined => {
  if (target === null || typeof (target as MessageTarget).postMessage !== 'function') {
    return undefined;
  }

  return target as MessageTarget;
};

const postToTarget = (
  target: MessageEventSource | Window | null,
  targetOrigin: string,
  message: unknown,
) => {
  toMessageTarget(target)?.postMessage(message, targetOrigin);
};

const isHostInspectorMessage = (message: unknown) => {
  const parsedMessage = parseMessage(message);

  return (
    parsedMessage.ok &&
    hostInspectorMessageTypes.has(
      parsedMessage.message.type as (typeof hostToEmbeddedMessageTypes)[number],
    )
  );
};

const isPreviewInspectorMessage = (message: unknown) => {
  const parsedMessage = parseMessage(message);

  return (
    parsedMessage.ok &&
    previewInspectorMessageTypes.has(
      parsedMessage.message.type as (typeof embeddedToHostMessageTypes)[number],
    )
  );
};

const createPreviewIframeResolver = (selector: string): StorybookPreviewIframeResolver => {
  return (doc) => {
    const matchedElement = doc.querySelector(selector);

    if (matchedElement === null || matchedElement.tagName !== 'IFRAME') {
      return null;
    }

    return matchedElement as HTMLIFrameElement;
  };
};

const resolvePreviewFrame = (
  doc: Document,
  options: InitStorybookManagerRelayOptions,
) => {
  return (
    options.resolvePreviewIframe?.(doc) ??
    createPreviewIframeResolver(
      options.previewIframeSelector ?? DEFAULT_STORYBOOK_PREVIEW_IFRAME_SELECTOR,
    )(doc)
  );
};

const resolvePreviewTargetOrigin = (iframe: HTMLIFrameElement | null) => {
  if (iframe === null || typeof iframe.src !== 'string' || iframe.src.length === 0) {
    return undefined;
  }

  return deriveTargetOriginFromIframeSrc(iframe.src);
};

const createInitialHostConnection = (
  parentWindow: MessageEventSource | Window | null,
  referrer: string | undefined,
  hostOrigins: readonly string[],
) => {
  const resolvedOrigin = resolveConcreteOrigin(referrer);

  if (
    parentWindow === null ||
    resolvedOrigin === undefined ||
    !isOriginTrusted(resolvedOrigin, hostOrigins)
  ) {
    return undefined;
  }

  return {
    origin: resolvedOrigin,
    target: parentWindow,
  } satisfies StorybookRelayConnection;
};

export const initStorybookManagerRelay = (
  options: InitStorybookManagerRelayOptions,
): StorybookManagerRelay => {
  if (activeStorybookManagerRelay !== undefined) {
    activeStorybookManagerRelay.destroy();
  }

  if (typeof window === 'undefined' || typeof document === 'undefined') {
    activeStorybookManagerRelay = {
      destroy: () => {
        activeStorybookManagerRelay = undefined;
      },
    };

    return activeStorybookManagerRelay;
  }

  const win = options.win ?? window;
  const doc = options.doc ?? document;
  const parentWindow = options.parentWindow ?? win.parent;
  const resolvedHostOrigins = resolveConfiguredHostOrigins(
    options.hostOrigins,
    options.defaultHostOrigins ?? [],
  );
  let hostConnection = createInitialHostConnection(
    parentWindow,
    options.referrer ?? doc.referrer,
    resolvedHostOrigins,
  );

  const handleMessage = (event: MessageEvent) => {
    const previewFrame = resolvePreviewFrame(doc, options);
    const previewWindow = previewFrame?.contentWindow ?? null;

    if (
      parentWindow !== null &&
      parentWindow !== win &&
      event.source === parentWindow &&
      isOriginTrusted(event.origin, resolvedHostOrigins)
    ) {
      if (
        !isHostInspectorMessage(event.data) &&
        !isIterationInspectorParentMessage(event.data)
      ) {
        return;
      }

      hostConnection = {
        origin: event.origin,
        target: event.source,
      };

      const previewOrigin = resolvePreviewTargetOrigin(previewFrame);

      if (previewOrigin === undefined) {
        return;
      }

      postToTarget(previewWindow, previewOrigin, event.data);
      return;
    }

    if (event.source !== previewWindow || hostConnection === undefined) {
      return;
    }

    if (
      !isPreviewInspectorMessage(event.data) &&
      !isIterationInspectorRuntimeMessage(event.data)
    ) {
      return;
    }

    postToTarget(hostConnection.target, hostConnection.origin, event.data);
  };

  win.addEventListener('message', handleMessage);

  activeStorybookManagerRelay = {
    destroy: () => {
      win.removeEventListener('message', handleMessage);
      hostConnection = undefined;
      activeStorybookManagerRelay = undefined;
    },
  };

  return activeStorybookManagerRelay;
};
