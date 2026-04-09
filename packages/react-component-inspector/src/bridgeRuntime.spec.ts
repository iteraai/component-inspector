import {
  buildMessage,
  type HelloAuthPayload,
} from '@iteraai/inspector-protocol';
import { given } from '#test/givenWhenThen';
import {
  destroyInspectorBridge,
  initInspectorBridge,
  type InitInspectorBridgeOptions,
} from './bridgeRuntime';
import { inspectorHighlightOverlaySelector } from './highlighter';
import {
  MAX_TREE_SNAPSHOT_NODE_COUNT,
  type ReactTreeSnapshot,
} from './reactTreeAdapter';
import type {
  EmbeddedBridgeLifecycleTelemetryMetric,
  EmbeddedBridgeRejectionTelemetryMetric,
} from './security/bridgeTelemetry';
import { EMBEDDED_MAX_INBOUND_INSPECTOR_MESSAGE_BYTES } from './security/messageSizePolicy';

type SourceDouble = {
  postMessage: ReturnType<typeof vi.fn>;
};

type MockFiber = {
  tag: number;
  type?: unknown;
  memoizedProps?: unknown;
  child?: MockFiber;
  sibling?: MockFiber;
  return?: MockFiber;
};

type BridgeContext = {
  hostOrigin: string;
  source: SourceDouble;
  alternateSource: SourceDouble;
  options?: InitInspectorBridgeOptions;
  helloAuthPayload?: HelloAuthPayload;
  treeSnapshot: ReactTreeSnapshot;
  nodePropsByNodeId: Record<string, unknown>;
  domElementByNodeId: Record<string, Element>;
  getTreeSnapshot?: ReturnType<typeof vi.fn>;
  getNodeProps?: ReturnType<typeof vi.fn>;
  getDomElement?: ReturnType<typeof vi.fn>;
  getReactComponentPathForElement?: ReturnType<typeof vi.fn>;
  factoryGetTreeSnapshot?: ReturnType<typeof vi.fn>;
  factoryGetNodeProps?: ReturnType<typeof vi.fn>;
  factoryGetDomElement?: ReturnType<typeof vi.fn>;
  adapterFactory?: ReturnType<typeof vi.fn>;
  factoryRuntimeAdapter?: 'vite' | 'next' | 'cra' | 'fiber';
  consoleWarnSpy?: ReturnType<typeof vi.spyOn>;
  onLifecycleMetric?: ReturnType<
    typeof vi.fn<(metric: EmbeddedBridgeLifecycleTelemetryMetric) => void>
  >;
  onRejectionMetric?: ReturnType<
    typeof vi.fn<(metric: EmbeddedBridgeRejectionTelemetryMetric) => void>
  >;
  resolvedFiberNodeId?: string;
  resolvedFailingFiberNodeId?: string;
  resolvedFallbackNodeId?: string;
  resolvedSelectionPath?: ReadonlyArray<string>;
  resolvedLegacySelectionPath?: ReadonlyArray<string>;
};

const windowRefWithDevtoolsHook = window as Window & {
  __REACT_DEVTOOLS_GLOBAL_HOOK__?: unknown;
};

const createSourceDouble = (): SourceDouble => {
  return {
    postMessage: vi.fn(),
  };
};

const contextCreated = (): BridgeContext => {
  return {
    hostOrigin: 'https://app.iteradev.ai',
    source: createSourceDouble(),
    alternateSource: createSourceDouble(),
    treeSnapshot: {
      nodes: [
        {
          id: 'root-node',
          displayName: 'App',
          parentId: null,
          childrenIds: [],
        },
      ],
      rootIds: ['root-node'],
    },
    nodePropsByNodeId: {
      'root-node': {
        title: 'App',
        version: 1,
      },
    },
    domElementByNodeId: {
      'root-node': document.createElement('div'),
    },
  };
};

const createMockFiber = (tag: number, type?: unknown): MockFiber => {
  return {
    tag,
    type,
  };
};

const connectFiberChildren = (parent: MockFiber, children: MockFiber[]) => {
  if (children.length === 0) {
    return;
  }

  parent.child = children[0];

  children.forEach((child, index) => {
    child.return = parent;
    child.sibling = children[index + 1];
  });
};

const domPreparedWithViteRootElement = (
  context: BridgeContext,
): BridgeContext => {
  document.body.innerHTML = `
    <div id="root">
      <main>root</main>
    </div>
  `;

  return context;
};

const bodyPreparedWithVoidHtmlElements = (
  context: BridgeContext,
): BridgeContext => {
  document.body.innerHTML = `
    <main>
      <img src="/sample.png" alt="Sample" />
      <input type="text" value="Snapshot" />
      <br />
    </main>
  `;

  return context;
};

const bodyPreparedWithLongHtmlMarkup = (
  context: BridgeContext,
): BridgeContext => {
  const repeatedSectionMarkup =
    '<section data-snapshot-chunk="x">snapshot chunk payload</section>'.repeat(
      500,
    );

  document.body.innerHTML = `<main>${repeatedSectionMarkup}</main>`;

  return context;
};

const fiberHookConfiguredWithComponentTree = (
  context: BridgeContext,
): BridgeContext => {
  const hostRootFiber = createMockFiber(3);
  const appShellFiber = createMockFiber(0, function AppShell() {});
  const forwardRefFiber = createMockFiber(11, {
    $$typeof: Symbol.for('react.forward_ref'),
    render: function ToolbarButton() {},
  });
  const memoFiber = createMockFiber(14, {
    $$typeof: Symbol.for('react.memo'),
    type: function MemoPanel() {},
  });

  connectFiberChildren(hostRootFiber, [appShellFiber]);
  connectFiberChildren(appShellFiber, [forwardRefFiber, memoFiber]);

  windowRefWithDevtoolsHook.__REACT_DEVTOOLS_GLOBAL_HOOK__ = {
    renderers: new Map([[1, { rendererName: 'mock-renderer' }]]),
    getFiberRoots: (rendererId: number) => {
      if (rendererId !== 1) {
        return new Set();
      }

      return new Set([
        {
          current: hostRootFiber,
        },
      ]);
    },
  };

  return context;
};

const fiberHookConfiguredWithSensitiveMemoizedProps = (
  context: BridgeContext,
): BridgeContext => {
  const hostRootFiber = createMockFiber(3);
  const appShellFiber = createMockFiber(0, function AppShell() {});
  const forwardRefFiber = createMockFiber(11, {
    $$typeof: Symbol.for('react.forward_ref'),
    render: function ToolbarButton() {},
  });

  appShellFiber.memoizedProps = {
    publicLabel: 'Inspector',
    sessionToken: 'token-value',
    nested: {
      password: 'password-value',
    },
  };
  forwardRefFiber.memoizedProps = {
    action: 'publish',
  };

  connectFiberChildren(hostRootFiber, [appShellFiber]);
  connectFiberChildren(appShellFiber, [forwardRefFiber]);

  windowRefWithDevtoolsHook.__REACT_DEVTOOLS_GLOBAL_HOOK__ = {
    renderers: new Map([[1, { rendererName: 'mock-renderer' }]]),
    getFiberRoots: (rendererId: number) => {
      if (rendererId !== 1) {
        return new Set();
      }

      return new Set([
        {
          current: hostRootFiber,
        },
      ]);
    },
  };

  return context;
};

const fiberHookConfiguredWithMixedOperationOutcomes = (
  context: BridgeContext,
): BridgeContext => {
  const hostRootFiber = createMockFiber(3);
  const appShellFiber = createMockFiber(0, function AppShell() {});
  const forwardRefFiber = createMockFiber(11, {
    $$typeof: Symbol.for('react.forward_ref'),
    render: function ToolbarButton() {},
  });
  const memoFiber = createMockFiber(14, {
    $$typeof: Symbol.for('react.memo'),
    type: function MemoPanel() {},
  });

  Object.defineProperty(appShellFiber, 'memoizedProps', {
    get: () => {
      throw new Error('memoizedProps unavailable');
    },
  });
  forwardRefFiber.memoizedProps = {
    action: 'publish',
  };

  connectFiberChildren(hostRootFiber, [appShellFiber]);
  connectFiberChildren(appShellFiber, [forwardRefFiber, memoFiber]);

  windowRefWithDevtoolsHook.__REACT_DEVTOOLS_GLOBAL_HOOK__ = {
    renderers: new Map([[1, { rendererName: 'mock-renderer' }]]),
    getFiberRoots: (rendererId: number) => {
      if (rendererId !== 1) {
        return new Set();
      }

      return new Set([
        {
          current: hostRootFiber,
        },
      ]);
    },
  };

  return context;
};

const createLinearTreeSnapshot = (nodeCount: number): ReactTreeSnapshot => {
  const nodes = Array.from({ length: nodeCount }, (_, index) => {
    const nodeId = `node-${index}`;
    const childNodeId = index + 1 < nodeCount ? `node-${index + 1}` : undefined;

    return {
      id: nodeId,
      displayName: `Node${index}`,
      parentId: index === 0 ? null : `node-${index - 1}`,
      childrenIds: childNodeId === undefined ? [] : [childNodeId],
    };
  });

  return {
    nodes,
    rootIds: ['node-0'],
  };
};

const createSnapshotWithExcludedParentForIncludedChild =
  (): ReactTreeSnapshot => {
    const rootNodeId = 'root-0';
    const promotedRootNodeId = 'promoted-node';
    const excludedParentNodeId = 'excluded-parent';
    const fillerNodes = Array.from(
      { length: MAX_TREE_SNAPSHOT_NODE_COUNT - 2 },
      (_, index) => {
        const nodeId = `filler-${index}`;

        return {
          id: nodeId,
          displayName: `Filler${index}`,
          parentId: rootNodeId,
          childrenIds: [],
        };
      },
    );

    return {
      nodes: [
        {
          id: rootNodeId,
          displayName: 'Root0',
          parentId: null,
          childrenIds: [
            promotedRootNodeId,
            ...fillerNodes.map((node) => node.id),
            excludedParentNodeId,
          ],
        },
        {
          id: promotedRootNodeId,
          displayName: 'PromotedNode',
          parentId: excludedParentNodeId,
          childrenIds: [],
        },
        ...fillerNodes,
        {
          id: excludedParentNodeId,
          displayName: 'ExcludedParent',
          parentId: rootNodeId,
          childrenIds: [promotedRootNodeId],
        },
      ],
      rootIds: [rootNodeId],
    };
  };

const bridgeInitialized = (context: BridgeContext): BridgeContext => {
  context.getTreeSnapshot = vi.fn(() => context.treeSnapshot);
  context.getNodeProps = vi.fn(
    (nodeId: string) => context.nodePropsByNodeId[nodeId],
  );
  context.getDomElement = vi.fn(
    (nodeId: string) => context.domElementByNodeId[nodeId] ?? null,
  );
  context.getReactComponentPathForElement ??= vi.fn(() => undefined);
  context.options = {
    hostOrigins: [context.hostOrigin],
    enabled: true,
    capabilities: ['tree', 'props'],
    ...((context.onLifecycleMetric !== undefined ||
      context.onRejectionMetric !== undefined) && {
      telemetry: {
        onLifecycleMetric: context.onLifecycleMetric,
        onRejectionMetric: context.onRejectionMetric,
      },
    }),
    treeAdapter: {
      getTreeSnapshot: context.getTreeSnapshot,
      getNodeProps: context.getNodeProps,
      getDomElement: context.getDomElement,
      getReactComponentPathForElement: context.getReactComponentPathForElement,
    },
  };

  initInspectorBridge(context.options);

  return context;
};

const selectionApiConfigured = (context: BridgeContext): BridgeContext => {
  context.getReactComponentPathForElement = vi.fn(() => [
    'AppShell',
    'ForwardRef(ToolbarButton)',
  ]);

  return context;
};

const consoleWarnMocked = (context: BridgeContext): BridgeContext => {
  context.consoleWarnSpy = vi
    .spyOn(console, 'warn')
    .mockImplementation(() => {});

  return context;
};

const bridgeTelemetryConfigured = (context: BridgeContext): BridgeContext => {
  context.onLifecycleMetric =
    vi.fn<(metric: EmbeddedBridgeLifecycleTelemetryMetric) => void>();
  context.onRejectionMetric =
    vi.fn<(metric: EmbeddedBridgeRejectionTelemetryMetric) => void>();

  return context;
};

const bridgeInitializedWithKillSwitchActive = (
  context: BridgeContext,
): BridgeContext => {
  context.options = {
    hostOrigins: [context.hostOrigin],
    enabled: true,
    killSwitchActive: true,
    capabilities: ['tree', 'props'],
    ...((context.onLifecycleMetric !== undefined ||
      context.onRejectionMetric !== undefined) && {
      telemetry: {
        onLifecycleMetric: context.onLifecycleMetric,
        onRejectionMetric: context.onRejectionMetric,
      },
    }),
  };

  initInspectorBridge(context.options);

  return context;
};

const bridgeInitializedWithKillSwitchAndThrowingAdapterFactory = (
  context: BridgeContext,
): BridgeContext => {
  context.adapterFactory = vi.fn(() => {
    throw new Error(
      'adapterFactory should not be called when bridge is disabled',
    );
  });
  context.options = {
    hostOrigins: [context.hostOrigin],
    enabled: true,
    killSwitchActive: true,
    runtimeConfig: {
      adapter: 'vite',
    },
    adapterFactory: context.adapterFactory,
  };

  initInspectorBridge(context.options);

  return context;
};

const bridgeReinitializedWithKillSwitchActive = (
  context: BridgeContext,
): BridgeContext => {
  initInspectorBridge({
    hostOrigins: [context.hostOrigin],
    enabled: true,
    killSwitchActive: true,
    capabilities: ['tree', 'props'],
  });

  return context;
};

const bridgeInitializedWithSecureTokenValidation = (
  context: BridgeContext,
): BridgeContext => {
  context.getTreeSnapshot = vi.fn(() => context.treeSnapshot);
  context.getNodeProps = vi.fn(
    (nodeId: string) => context.nodePropsByNodeId[nodeId],
  );
  context.getDomElement = vi.fn(
    (nodeId: string) => context.domElementByNodeId[nodeId] ?? null,
  );
  context.options = {
    hostOrigins: [context.hostOrigin],
    enabled: true,
    capabilities: ['tree', 'props'],
    security: {
      enabled: true,
    },
    ...((context.onLifecycleMetric !== undefined ||
      context.onRejectionMetric !== undefined) && {
      telemetry: {
        onLifecycleMetric: context.onLifecycleMetric,
        onRejectionMetric: context.onRejectionMetric,
      },
    }),
    treeAdapter: {
      getTreeSnapshot: context.getTreeSnapshot,
      getNodeProps: context.getNodeProps,
      getDomElement: context.getDomElement,
    },
  };

  initInspectorBridge(context.options);

  return context;
};

const bridgeInitializedWithoutTreeAdapter = (
  context: BridgeContext,
): BridgeContext => {
  context.options = {
    hostOrigins: [context.hostOrigin],
    enabled: true,
  };

  initInspectorBridge(context.options);

  return context;
};

const bridgeInitializedWithFactoryAdapterOnly = (
  context: BridgeContext,
): BridgeContext => {
  const runtimeAdapter = context.factoryRuntimeAdapter ?? 'next';

  context.factoryGetTreeSnapshot = vi.fn(() => context.treeSnapshot);
  context.factoryGetNodeProps = vi.fn(
    (nodeId: string) => context.nodePropsByNodeId[nodeId],
  );
  context.factoryGetDomElement = vi.fn(
    (nodeId: string) => context.domElementByNodeId[nodeId] ?? null,
  );
  context.adapterFactory = vi.fn(() => ({
    getTreeSnapshot: context.factoryGetTreeSnapshot as NonNullable<
      BridgeContext['factoryGetTreeSnapshot']
    >,
    getNodeProps: context.factoryGetNodeProps as NonNullable<
      BridgeContext['factoryGetNodeProps']
    >,
    getDomElement: context.factoryGetDomElement as NonNullable<
      BridgeContext['factoryGetDomElement']
    >,
  }));
  context.options = {
    hostOrigins: [context.hostOrigin],
    enabled: true,
    runtimeConfig: {
      adapter: runtimeAdapter,
    },
    adapterFactory: context.adapterFactory,
  };

  initInspectorBridge(context.options);

  return context;
};

const bridgeInitializedWithBuiltInFiberRuntime = (
  context: BridgeContext,
): BridgeContext => {
  context.options = {
    hostOrigins: [context.hostOrigin],
    enabled: true,
    ...((context.onLifecycleMetric !== undefined ||
      context.onRejectionMetric !== undefined) && {
      telemetry: {
        onLifecycleMetric: context.onLifecycleMetric,
        onRejectionMetric: context.onRejectionMetric,
      },
    }),
    runtimeConfig: {
      adapter: 'fiber',
    },
  };

  initInspectorBridge(context.options);

  return context;
};

const factoryRuntimeAdapterConfiguredAsVite = (
  context: BridgeContext,
): BridgeContext => {
  context.factoryRuntimeAdapter = 'vite';

  return context;
};

const factoryRuntimeAdapterConfiguredAsCra = (
  context: BridgeContext,
): BridgeContext => {
  context.factoryRuntimeAdapter = 'cra';

  return context;
};

const bridgeInitializedWithTreeAdapterAndFactory = (
  context: BridgeContext,
): BridgeContext => {
  context.getTreeSnapshot = vi.fn(() => context.treeSnapshot);
  context.getNodeProps = vi.fn(
    (nodeId: string) => context.nodePropsByNodeId[nodeId],
  );
  context.getDomElement = vi.fn(
    (nodeId: string) => context.domElementByNodeId[nodeId] ?? null,
  );
  context.adapterFactory = vi.fn(() => ({
    getTreeSnapshot: vi.fn(() => ({
      nodes: [
        {
          id: 'factory-root-node',
          displayName: 'FactoryApp',
          parentId: null,
          childrenIds: [],
        },
      ],
      rootIds: ['factory-root-node'],
    })),
    getNodeProps: vi.fn(() => ({
      source: 'factory',
    })),
    getDomElement: vi.fn(() => document.createElement('div')),
  }));
  context.options = {
    hostOrigins: [context.hostOrigin],
    enabled: true,
    runtimeConfig: {
      adapter: 'vite',
    },
    treeAdapter: {
      getTreeSnapshot: context.getTreeSnapshot,
      getNodeProps: context.getNodeProps,
      getDomElement: context.getDomElement,
    },
    adapterFactory: context.adapterFactory,
  };

  initInspectorBridge(context.options);

  return context;
};

const helloAuthTokenSetAsValid = (context: BridgeContext): BridgeContext => {
  context.helloAuthPayload = {
    sessionToken: 'signed-session-token',
    metadata: {
      tokenType: 'bearer',
      issuer: 'itera-api',
      expiresAt: Date.now() + 300_000,
    },
  };

  return context;
};

const helloAuthTokenSetAsInvalid = (context: BridgeContext): BridgeContext => {
  context.helloAuthPayload = {
    sessionToken: '   ',
  };

  return context;
};

const helloAuthTokenSetAsExpired = (context: BridgeContext): BridgeContext => {
  context.helloAuthPayload = {
    sessionToken: 'signed-session-token',
    metadata: {
      expiresAt: Date.now() - 300_000,
    },
  };

  return context;
};

const hostSendsHello = (context: BridgeContext): BridgeContext => {
  window.dispatchEvent(
    new MessageEvent('message', {
      origin: context.hostOrigin,
      source: context.source as unknown as MessageEventSource,
      data: buildMessage('HELLO', {
        capabilities: ['host-tree'],
      }),
    }),
  );

  return context;
};

const clockConfigured = (context: BridgeContext): BridgeContext => {
  vi.useFakeTimers();

  return context;
};

const hostSendsHelloWithNavigationSession = (
  context: BridgeContext,
): BridgeContext => {
  window.dispatchEvent(
    new MessageEvent('message', {
      origin: context.hostOrigin,
      source: context.source as unknown as MessageEventSource,
      data: buildMessage(
        'HELLO',
        {
          capabilities: ['host-tree'],
        },
        {
          requestId: 'request-navigation-hello',
          sessionId: 'session-navigation-hello',
        },
      ),
    }),
  );

  return context;
};

const treeSnapshotUpdatedForNavigationRefresh = (
  context: BridgeContext,
): BridgeContext => {
  context.treeSnapshot = {
    nodes: [
      {
        id: 'root-node',
        displayName: 'App',
        parentId: null,
        childrenIds: ['route-node'],
      },
      {
        id: 'route-node',
        displayName: 'RouteView',
        parentId: 'root-node',
        childrenIds: [],
      },
    ],
    rootIds: ['root-node'],
  };

  return context;
};

const historyPushStateTriggered = (context: BridgeContext): BridgeContext => {
  window.history.pushState(
    {
      route: '/next',
    },
    '',
  );

  return context;
};

const pendingNavigationRefreshElapsed = (
  context: BridgeContext,
): BridgeContext => {
  vi.advanceTimersByTime(150);

  return context;
};

const treeSnapshotUpdatedForAsyncNavigationCompletion = (
  context: BridgeContext,
): BridgeContext => {
  context.treeSnapshot = {
    nodes: [
      {
        id: 'root-node',
        displayName: 'App',
        parentId: null,
        childrenIds: ['lazy-route-node'],
      },
      {
        id: 'lazy-route-node',
        displayName: 'LazyRoute',
        parentId: 'root-node',
        childrenIds: [],
      },
    ],
    rootIds: ['root-node'],
  };

  return context;
};

const followUpNavigationRefreshElapsed = (
  context: BridgeContext,
): BridgeContext => {
  vi.advanceTimersByTime(1200);

  return context;
};

const hostSendsLargeUnderLimitHello = (
  context: BridgeContext,
): BridgeContext => {
  const underLimitCapability = 'c'.repeat(
    Math.floor(EMBEDDED_MAX_INBOUND_INSPECTOR_MESSAGE_BYTES / 8),
  );

  window.dispatchEvent(
    new MessageEvent('message', {
      origin: context.hostOrigin,
      source: context.source as unknown as MessageEventSource,
      data: buildMessage(
        'HELLO',
        {
          capabilities: ['host-tree', underLimitCapability],
        },
        {
          requestId: 'request-under-limit-hello',
          sessionId: 'session-under-limit-hello',
        },
      ),
    }),
  );

  return context;
};

const hostSendsOversizeHello = (context: BridgeContext): BridgeContext => {
  const oversizedCapability = 'x'.repeat(
    EMBEDDED_MAX_INBOUND_INSPECTOR_MESSAGE_BYTES * 2,
  );

  window.dispatchEvent(
    new MessageEvent('message', {
      origin: context.hostOrigin,
      source: context.source as unknown as MessageEventSource,
      data: buildMessage(
        'HELLO',
        {
          capabilities: ['host-tree', oversizedCapability],
        },
        {
          requestId: 'request-oversize-hello',
          sessionId: 'session-oversize-hello',
        },
      ),
    }),
  );

  return context;
};

const hostSendsOversizeHelloAsJsonString = (
  context: BridgeContext,
): BridgeContext => {
  const oversizedCapability = 'x'.repeat(
    EMBEDDED_MAX_INBOUND_INSPECTOR_MESSAGE_BYTES * 2,
  );

  window.dispatchEvent(
    new MessageEvent('message', {
      origin: context.hostOrigin,
      source: context.source as unknown as MessageEventSource,
      data: JSON.stringify(
        buildMessage(
          'HELLO',
          {
            capabilities: ['host-tree', oversizedCapability],
          },
          {
            requestId: 'request-oversize-hello-json',
            sessionId: 'session-oversize-hello-json',
          },
        ),
      ),
    }),
  );

  return context;
};

const hostSendsOversizeHelloWithBinaryPadding = (
  context: BridgeContext,
): BridgeContext => {
  const messageWithBinaryPadding = buildMessage(
    'HELLO',
    {
      capabilities: ['host-tree'],
    },
    {
      requestId: 'request-oversize-hello-binary',
      sessionId: 'session-oversize-hello-binary',
    },
  ) as Record<string, unknown>;

  messageWithBinaryPadding.binaryPadding = new ArrayBuffer(
    EMBEDDED_MAX_INBOUND_INSPECTOR_MESSAGE_BYTES * 2,
  );

  window.dispatchEvent(
    new MessageEvent('message', {
      origin: context.hostOrigin,
      source: context.source as unknown as MessageEventSource,
      data: messageWithBinaryPadding,
    }),
  );

  return context;
};

const hostSendsOversizeFiberRequestTree = (
  context: BridgeContext,
): BridgeContext => {
  const oversizedSideField = 'x'.repeat(
    EMBEDDED_MAX_INBOUND_INSPECTOR_MESSAGE_BYTES * 2,
  );

  window.dispatchEvent(
    new MessageEvent('message', {
      origin: context.hostOrigin,
      source: context.source as unknown as MessageEventSource,
      data: {
        ...buildMessage(
          'REQUEST_TREE',
          {
            includeSource: true,
          },
          {
            requestId: 'request-fiber-oversize-tree',
            sessionId: 'session-fiber-oversize-tree',
          },
        ),
        oversizedSideField,
      },
    }),
  );

  return context;
};

const hostSendsOversizeNonInspectorMessage = (
  context: BridgeContext,
): BridgeContext => {
  window.dispatchEvent(
    new MessageEvent('message', {
      origin: context.hostOrigin,
      source: context.source as unknown as MessageEventSource,
      data: {
        channel: 'non-inspector-channel',
        payload: {
          oversized: 'x'.repeat(
            EMBEDDED_MAX_INBOUND_INSPECTOR_MESSAGE_BYTES * 2,
          ),
        },
      },
    }),
  );

  return context;
};

const hostSendsOversizeStringContainingInspectorChannelSnippet = (
  context: BridgeContext,
): BridgeContext => {
  window.dispatchEvent(
    new MessageEvent('message', {
      origin: context.hostOrigin,
      source: context.source as unknown as MessageEventSource,
      data: `non-json message "channel":"itera-component-inspector" ${'x'.repeat(
        EMBEDDED_MAX_INBOUND_INSPECTOR_MESSAGE_BYTES * 2,
      )}`,
    }),
  );

  return context;
};

const hostSendsHelloWithLateChannelJsonString = (
  context: BridgeContext,
): BridgeContext => {
  const helloWithPrefixedPadding = {
    padding: 'x'.repeat(2_048),
    ...buildMessage(
      'HELLO',
      {
        capabilities: ['host-tree'],
      },
      {
        requestId: 'request-late-channel-json',
        sessionId: 'session-late-channel-json',
      },
    ),
  };

  window.dispatchEvent(
    new MessageEvent('message', {
      origin: context.hostOrigin,
      source: context.source as unknown as MessageEventSource,
      data: JSON.stringify(helloWithPrefixedPadding),
    }),
  );

  return context;
};

const hostSendsHelloWithConfiguredAuth = (
  context: BridgeContext,
): BridgeContext => {
  window.dispatchEvent(
    new MessageEvent('message', {
      origin: context.hostOrigin,
      source: context.source as unknown as MessageEventSource,
      data: buildMessage(
        'HELLO',
        {
          capabilities: ['host-tree'],
          ...(context.helloAuthPayload !== undefined && {
            auth: context.helloAuthPayload,
          }),
        },
        {
          requestId: 'request-secure-hello',
          sessionId: 'session-secure-hello',
        },
      ),
    }),
  );

  return context;
};

const hostSendsHelloWithUndefinedPayloadInSecureMode = (
  context: BridgeContext,
): BridgeContext => {
  window.dispatchEvent(
    new MessageEvent('message', {
      origin: context.hostOrigin,
      source: context.source as unknown as MessageEventSource,
      data: {
        channel: 'itera-component-inspector',
        version: 1,
        type: 'HELLO',
        requestId: 'request-secure-hello-missing-payload',
        sessionId: 'session-secure-hello-missing-payload',
      },
    }),
  );

  return context;
};

const hostSendsPing = (context: BridgeContext): BridgeContext => {
  window.dispatchEvent(
    new MessageEvent('message', {
      origin: context.hostOrigin,
      source: context.source as unknown as MessageEventSource,
      data: buildMessage('PING', {
        sentAt: 101,
      }),
    }),
  );

  return context;
};

const hostSendsRequestTreeWithSecureHelloSession = (
  context: BridgeContext,
): BridgeContext => {
  window.dispatchEvent(
    new MessageEvent('message', {
      origin: context.hostOrigin,
      source: context.source as unknown as MessageEventSource,
      data: buildMessage(
        'REQUEST_TREE',
        {
          includeSource: true,
        },
        {
          requestId: 'request-secure-tree',
          sessionId: 'session-secure-hello',
        },
      ),
    }),
  );

  return context;
};

const alternateHostSendsRequestTreeWithSecureHelloSession = (
  context: BridgeContext,
): BridgeContext => {
  window.dispatchEvent(
    new MessageEvent('message', {
      origin: context.hostOrigin,
      source: context.alternateSource as unknown as MessageEventSource,
      data: buildMessage(
        'REQUEST_TREE',
        {
          includeSource: true,
        },
        {
          requestId: 'request-secure-tree-alt-source',
          sessionId: 'session-secure-hello',
        },
      ),
    }),
  );

  return context;
};

const hostSendsRequestNodePropsWithInvalidPayload = (
  context: BridgeContext,
): BridgeContext => {
  window.dispatchEvent(
    new MessageEvent('message', {
      origin: context.hostOrigin,
      source: context.source as unknown as MessageEventSource,
      data: {
        ...buildMessage('REQUEST_NODE_PROPS', {
          nodeId: 'root-node',
        }),
        requestId: 'request-invalid-payload',
        sessionId: 'session-invalid-payload',
        payload: {
          nodeId: 123,
        },
      },
    }),
  );

  return context;
};

const hostSendsRequestTree = (context: BridgeContext): BridgeContext => {
  window.dispatchEvent(
    new MessageEvent('message', {
      origin: context.hostOrigin,
      source: context.source as unknown as MessageEventSource,
      data: buildMessage(
        'REQUEST_TREE',
        {
          includeSource: true,
        },
        {
          requestId: 'request-42',
          sessionId: 'session-42',
        },
      ),
    }),
  );

  return context;
};

const hostSendsRequestSnapshot = (context: BridgeContext): BridgeContext => {
  window.dispatchEvent(
    new MessageEvent('message', {
      origin: context.hostOrigin,
      source: context.source as unknown as MessageEventSource,
      data: buildMessage(
        'REQUEST_SNAPSHOT',
        {
          includeTree: true,
          includeHtml: true,
        },
        {
          requestId: 'request-snapshot-45',
          sessionId: 'session-snapshot-45',
        },
      ),
    }),
  );

  return context;
};

const hostSendsRequestNodePropsForRootNode = (
  context: BridgeContext,
): BridgeContext => {
  window.dispatchEvent(
    new MessageEvent('message', {
      origin: context.hostOrigin,
      source: context.source as unknown as MessageEventSource,
      data: buildMessage(
        'REQUEST_NODE_PROPS',
        {
          nodeId: 'root-node',
        },
        {
          requestId: 'request-43',
          sessionId: 'session-43',
        },
      ),
    }),
  );

  return context;
};

const hostSendsRequestNodePropsForUnknownNode = (
  context: BridgeContext,
): BridgeContext => {
  window.dispatchEvent(
    new MessageEvent('message', {
      origin: context.hostOrigin,
      source: context.source as unknown as MessageEventSource,
      data: buildMessage(
        'REQUEST_NODE_PROPS',
        {
          nodeId: 'missing-node',
        },
        {
          requestId: 'request-44',
          sessionId: 'session-44',
        },
      ),
    }),
  );

  return context;
};

const hostSendsRequestTreeThenRequestNodePropsForFiberAppShell = (
  context: BridgeContext,
): BridgeContext => {
  window.dispatchEvent(
    new MessageEvent('message', {
      origin: context.hostOrigin,
      source: context.source as unknown as MessageEventSource,
      data: buildMessage(
        'REQUEST_TREE',
        {
          includeSource: true,
        },
        {
          requestId: 'request-fiber-tree',
          sessionId: 'session-fiber-tree',
        },
      ),
    }),
  );

  const firstMessageCall = context.source.postMessage.mock.calls[0];
  const treeSnapshotResponse = firstMessageCall?.[0] as
    | {
        payload?: {
          nodes?: Array<{
            id: string;
            displayName: string;
          }>;
        };
      }
    | undefined;
  const appShellNodeId = treeSnapshotResponse?.payload?.nodes?.find(
    (node) => node.displayName === 'AppShell',
  )?.id;

  context.resolvedFiberNodeId = appShellNodeId;

  if (appShellNodeId === undefined) {
    return context;
  }

  window.dispatchEvent(
    new MessageEvent('message', {
      origin: context.hostOrigin,
      source: context.source as unknown as MessageEventSource,
      data: buildMessage(
        'REQUEST_NODE_PROPS',
        {
          nodeId: appShellNodeId,
        },
        {
          requestId: 'request-fiber-props',
          sessionId: 'session-fiber-props',
        },
      ),
    }),
  );

  return context;
};

const hostSendsHelloThenRequestFiberTreeThenRequestFiberNodeProps = (
  context: BridgeContext,
): BridgeContext => {
  window.dispatchEvent(
    new MessageEvent('message', {
      origin: context.hostOrigin,
      source: context.source as unknown as MessageEventSource,
      data: buildMessage(
        'HELLO',
        {
          capabilities: ['tree', 'props'],
        },
        {
          requestId: 'request-fiber-hello',
          sessionId: 'session-fiber-hello',
        },
      ),
    }),
  );

  window.dispatchEvent(
    new MessageEvent('message', {
      origin: context.hostOrigin,
      source: context.source as unknown as MessageEventSource,
      data: buildMessage(
        'REQUEST_TREE',
        {
          includeSource: true,
        },
        {
          requestId: 'request-fiber-tree-correlation',
          sessionId: 'session-fiber-tree-correlation',
        },
      ),
    }),
  );

  const treeSnapshotResponse = readInspectorPostMessageCalls(context)
    .map((call) => call[0] as { type?: string; payload?: unknown })
    .find((message) => message.type === 'TREE_SNAPSHOT') as
    | {
        payload?: {
          nodes?: Array<{
            id: string;
            displayName: string;
          }>;
        };
      }
    | undefined;
  const appShellNodeId = treeSnapshotResponse?.payload?.nodes?.find(
    (node) => node.displayName === 'AppShell',
  )?.id;

  context.resolvedFiberNodeId = appShellNodeId;

  if (appShellNodeId === undefined) {
    return context;
  }

  window.dispatchEvent(
    new MessageEvent('message', {
      origin: context.hostOrigin,
      source: context.source as unknown as MessageEventSource,
      data: buildMessage(
        'REQUEST_NODE_PROPS',
        {
          nodeId: appShellNodeId,
        },
        {
          requestId: 'request-fiber-props-correlation',
          sessionId: 'session-fiber-props-correlation',
        },
      ),
    }),
  );

  return context;
};

const hostSendsRequestTreeThenMixedFiberNodeOperations = (
  context: BridgeContext,
): BridgeContext => {
  window.dispatchEvent(
    new MessageEvent('message', {
      origin: context.hostOrigin,
      source: context.source as unknown as MessageEventSource,
      data: buildMessage(
        'REQUEST_TREE',
        {
          includeSource: true,
        },
        {
          requestId: 'request-fiber-mixed-tree',
          sessionId: 'session-fiber-mixed-tree',
        },
      ),
    }),
  );

  const firstMessageCall = context.source.postMessage.mock.calls[0];
  const treeSnapshotResponse = firstMessageCall?.[0] as
    | {
        payload?: {
          nodes?: Array<{
            id: string;
            displayName: string;
          }>;
        };
      }
    | undefined;
  const appShellNodeId = treeSnapshotResponse?.payload?.nodes?.find(
    (node) => node.displayName === 'AppShell',
  )?.id;
  const toolbarNodeId = treeSnapshotResponse?.payload?.nodes?.find(
    (node) => node.displayName === 'ForwardRef(ToolbarButton)',
  )?.id;

  context.resolvedFailingFiberNodeId = appShellNodeId;
  context.resolvedFiberNodeId = toolbarNodeId;

  if (appShellNodeId === undefined || toolbarNodeId === undefined) {
    return context;
  }

  window.dispatchEvent(
    new MessageEvent('message', {
      origin: context.hostOrigin,
      source: context.source as unknown as MessageEventSource,
      data: buildMessage(
        'REQUEST_NODE_PROPS',
        {
          nodeId: appShellNodeId,
        },
        {
          requestId: 'request-fiber-mixed-props-fail',
          sessionId: 'session-fiber-mixed-props-fail',
        },
      ),
    }),
  );

  window.dispatchEvent(
    new MessageEvent('message', {
      origin: context.hostOrigin,
      source: context.source as unknown as MessageEventSource,
      data: buildMessage(
        'REQUEST_NODE_PROPS',
        {
          nodeId: toolbarNodeId,
        },
        {
          requestId: 'request-fiber-mixed-props-success',
          sessionId: 'session-fiber-mixed-props-success',
        },
      ),
    }),
  );

  window.dispatchEvent(
    new MessageEvent('message', {
      origin: context.hostOrigin,
      source: context.source as unknown as MessageEventSource,
      data: buildMessage(
        'HIGHLIGHT_NODE',
        {
          nodeId: appShellNodeId,
        },
        {
          requestId: 'request-fiber-mixed-highlight-fail',
          sessionId: 'session-fiber-mixed-highlight-fail',
        },
      ),
    }),
  );

  return context;
};

const hostSendsRequestTreeThenFallbackNodeOperations = (
  context: BridgeContext,
): BridgeContext => {
  window.dispatchEvent(
    new MessageEvent('message', {
      origin: context.hostOrigin,
      source: context.source as unknown as MessageEventSource,
      data: buildMessage(
        'REQUEST_TREE',
        {
          includeSource: true,
        },
        {
          requestId: 'request-fiber-fallback-tree',
          sessionId: 'session-fiber-fallback-tree',
        },
      ),
    }),
  );

  const firstMessageCall = context.source.postMessage.mock.calls[0];
  const treeSnapshotResponse = firstMessageCall?.[0] as
    | {
        payload?: {
          rootIds?: string[];
        };
      }
    | undefined;
  const fallbackRootNodeId = treeSnapshotResponse?.payload?.rootIds?.[0];

  context.resolvedFallbackNodeId = fallbackRootNodeId;

  if (fallbackRootNodeId === undefined) {
    return context;
  }

  window.dispatchEvent(
    new MessageEvent('message', {
      origin: context.hostOrigin,
      source: context.source as unknown as MessageEventSource,
      data: buildMessage(
        'REQUEST_NODE_PROPS',
        {
          nodeId: fallbackRootNodeId,
        },
        {
          requestId: 'request-fiber-fallback-props',
          sessionId: 'session-fiber-fallback-props',
        },
      ),
    }),
  );

  window.dispatchEvent(
    new MessageEvent('message', {
      origin: context.hostOrigin,
      source: context.source as unknown as MessageEventSource,
      data: buildMessage(
        'HIGHLIGHT_NODE',
        {
          nodeId: fallbackRootNodeId,
        },
        {
          requestId: 'request-fiber-fallback-highlight',
          sessionId: 'session-fiber-fallback-highlight',
        },
      ),
    }),
  );

  return context;
};

const hostSendsHighlightNodeForRootNode = (
  context: BridgeContext,
): BridgeContext => {
  window.dispatchEvent(
    new MessageEvent('message', {
      origin: context.hostOrigin,
      source: context.source as unknown as MessageEventSource,
      data: buildMessage(
        'HIGHLIGHT_NODE',
        {
          nodeId: 'root-node',
        },
        {
          requestId: 'request-45',
          sessionId: 'session-45',
        },
      ),
    }),
  );

  return context;
};

const hostSendsHighlightNodeForUnknownNode = (
  context: BridgeContext,
): BridgeContext => {
  window.dispatchEvent(
    new MessageEvent('message', {
      origin: context.hostOrigin,
      source: context.source as unknown as MessageEventSource,
      data: buildMessage(
        'HIGHLIGHT_NODE',
        {
          nodeId: 'missing-node',
        },
        {
          requestId: 'request-46',
          sessionId: 'session-46',
        },
      ),
    }),
  );

  return context;
};

const hostSendsClearHighlight = (context: BridgeContext): BridgeContext => {
  window.dispatchEvent(
    new MessageEvent('message', {
      origin: context.hostOrigin,
      source: context.source as unknown as MessageEventSource,
      data: buildMessage('CLEAR_HIGHLIGHT', undefined),
    }),
  );

  return context;
};

const untrustedHostSendsHello = (context: BridgeContext): BridgeContext => {
  window.dispatchEvent(
    new MessageEvent('message', {
      origin: 'https://evil.example.com',
      source: context.source as unknown as MessageEventSource,
      data: buildMessage('HELLO', {
        capabilities: ['host-tree'],
      }),
    }),
  );

  return context;
};

const bridgeDestroyed = (context: BridgeContext): BridgeContext => {
  destroyInspectorBridge();

  return context;
};

const embeddedSelectionApiResolved = (
  context: BridgeContext,
): BridgeContext => {
  const buttonElement = document.createElement('button');
  const selectionApi = window.__ITERA_EMBEDDED_INSPECTOR_SELECTION__;
  const legacySelectionApi =
    window.__ITERA_EMBEDDED_REACT_INSPECTOR_SELECTION__;

  context.resolvedSelectionPath =
    selectionApi?.getComponentPathForElement?.(buttonElement);
  context.resolvedLegacySelectionPath =
    legacySelectionApi?.getReactComponentPathForElement?.(buttonElement);

  return context;
};

const expectEmbeddedSelectionApiToDelegateToTreeAdapter = (
  context: BridgeContext,
) => {
  expect(window.__ITERA_EMBEDDED_INSPECTOR_SELECTION__).toBe(
    window.__ITERA_EMBEDDED_REACT_INSPECTOR_SELECTION__,
  );
  expect(window.__ITERA_EMBEDDED_INSPECTOR_SELECTION__).toBe(
    window.__ARA_EMBEDDED_INSPECTOR_SELECTION__,
  );
  expect(context.resolvedSelectionPath).toEqual([
    'AppShell',
    'ForwardRef(ToolbarButton)',
  ]);
  expect(context.resolvedLegacySelectionPath).toEqual([
    'AppShell',
    'ForwardRef(ToolbarButton)',
  ]);
  expect(context.getReactComponentPathForElement).toHaveBeenCalledWith(
    expect.any(HTMLButtonElement),
  );
  expect(context.getReactComponentPathForElement).toHaveBeenCalledTimes(2);

  return context;
};

const expectEmbeddedSelectionApiToBeCleared = (context: BridgeContext) => {
  expect(context).toBeDefined();
  expect(window.__ITERA_EMBEDDED_INSPECTOR_SELECTION__).toBeUndefined();
  expect(window.__ITERA_EMBEDDED_REACT_INSPECTOR_SELECTION__).toBeUndefined();
  expect(window.__ARA_EMBEDDED_INSPECTOR_SELECTION__).toBeUndefined();
  expect(window.__ARA_EMBEDDED_REACT_INSPECTOR_SELECTION__).toBeUndefined();

  return context;
};

const treeSnapshotExceedsNodeCap = (context: BridgeContext): BridgeContext => {
  context.treeSnapshot = createLinearTreeSnapshot(
    MAX_TREE_SNAPSHOT_NODE_COUNT + 3,
  );

  return context;
};

const treeSnapshotConfiguredWithTraversalTruncationMeta = (
  context: BridgeContext,
): BridgeContext => {
  context.treeSnapshot = {
    ...context.treeSnapshot,
    meta: {
      truncated: true,
      includedNodeCount: context.treeSnapshot.nodes.length,
    },
  };

  return context;
};

const treeSnapshotIncludesChildWithExcludedParent = (
  context: BridgeContext,
): BridgeContext => {
  context.treeSnapshot = createSnapshotWithExcludedParentForIncludedChild();

  return context;
};

const readInspectorPostMessageCalls = (context: BridgeContext) => {
  return context.source.postMessage.mock.calls.filter(
    ([message]) =>
      (message as { channel?: string }).channel === 'itera-component-inspector',
  );
};

const readPreviewPathPostMessageCalls = (context: BridgeContext) => {
  return context.source.postMessage.mock.calls.filter(
    ([message]) =>
      (message as { channel?: string }).channel === 'itera-preview-path',
  );
};

const expectReadyResponse = (context: BridgeContext) => {
  const readyCall = readInspectorPostMessageCalls(context).find(
    ([message]) => (message as { type?: string }).type === 'READY',
  );

  expect(readyCall).toBeDefined();

  const [message, origin] = readyCall as [unknown, string];

  expect(origin).toBe(context.hostOrigin);
  expect(message).toMatchObject({
    type: 'READY',
    payload: {
      capabilities: ['tree', 'props'],
    },
  });
};

const expectReadyResponseForUnderLimitHello = (context: BridgeContext) => {
  const readyCall = readInspectorPostMessageCalls(context).find(
    ([message]) => (message as { type?: string }).type === 'READY',
  );

  expect(readyCall).toBeDefined();

  const [message, origin] = readyCall as [unknown, string];

  expect(origin).toBe(context.hostOrigin);
  expect(message).toMatchObject({
    type: 'READY',
    requestId: 'request-under-limit-hello',
    sessionId: 'session-under-limit-hello',
    payload: {
      capabilities: ['tree', 'props'],
    },
  });
};

const expectReadyResponseForLateChannelJsonHello = (context: BridgeContext) => {
  const readyCall = readInspectorPostMessageCalls(context).find(
    ([message]) => (message as { type?: string }).type === 'READY',
  );

  expect(readyCall).toBeDefined();

  const [message, origin] = readyCall as [unknown, string];

  expect(origin).toBe(context.hostOrigin);
  expect(message).toMatchObject({
    type: 'READY',
    requestId: 'request-late-channel-json',
    sessionId: 'session-late-channel-json',
    payload: {
      capabilities: ['tree', 'props'],
    },
  });
};

const expectSecureReadyResponse = (context: BridgeContext) => {
  const readyCall = readInspectorPostMessageCalls(context).find(
    ([message]) => (message as { type?: string }).type === 'READY',
  );

  expect(readyCall).toBeDefined();

  const [message, origin] = readyCall as [unknown, string];

  expect(origin).toBe(context.hostOrigin);
  expect(message).toMatchObject({
    type: 'READY',
    requestId: 'request-secure-hello',
    sessionId: 'session-secure-hello',
    payload: {
      capabilities: ['tree', 'props'],
    },
  });
};

const expectUnauthorizedSessionErrorResponse = (
  context: BridgeContext,
  reason: 'missing-auth' | 'invalid-token' | 'expired-token',
) => {
  expect(context.source.postMessage).toHaveBeenCalledTimes(1);

  const [message, origin] = context.source.postMessage.mock.calls[0];

  expect(origin).toBe(context.hostOrigin);
  expect(message).toMatchObject({
    type: 'ERROR',
    requestId: 'request-secure-hello',
    sessionId: 'session-secure-hello',
    payload: {
      code: 'ERR_UNAUTHORIZED_SESSION',
      details: {
        reason,
      },
    },
  });

  return context;
};

const expectUnauthorizedSessionErrorForMissingAuth = (
  context: BridgeContext,
) => {
  return expectUnauthorizedSessionErrorResponse(context, 'missing-auth');
};

const expectUnauthorizedSessionErrorForInvalidAuth = (
  context: BridgeContext,
) => {
  return expectUnauthorizedSessionErrorResponse(context, 'invalid-token');
};

const expectUnauthorizedSessionErrorForExpiredAuth = (
  context: BridgeContext,
) => {
  return expectUnauthorizedSessionErrorResponse(context, 'expired-token');
};

const expectUnauthorizedSessionErrorWithDetails = (
  source: SourceDouble,
  hostOrigin: string,
  options: {
    requestId?: string;
    sessionId?: string;
    reason: 'handshake-required' | 'source-mismatch' | 'missing-auth';
  },
) => {
  expect(source.postMessage.mock.calls.length).toBeGreaterThan(0);

  const [message, origin] =
    source.postMessage.mock.calls[source.postMessage.mock.calls.length - 1];

  expect(origin).toBe(hostOrigin);
  expect(message).toMatchObject({
    type: 'ERROR',
    ...(options.requestId !== undefined && {
      requestId: options.requestId,
    }),
    ...(options.sessionId !== undefined && {
      sessionId: options.sessionId,
    }),
    payload: {
      code: 'ERR_UNAUTHORIZED_SESSION',
      details: {
        reason: options.reason,
      },
    },
  });
};

const expectUnauthorizedRequestTreeBeforeSecureHello = (
  context: BridgeContext,
) => {
  expectUnauthorizedSessionErrorWithDetails(context.source, context.hostOrigin, {
    requestId: 'request-42',
    sessionId: 'session-42',
    reason: 'handshake-required',
  });

  return context;
};

const expectUnauthorizedPingBeforeSecureHello = (context: BridgeContext) => {
  expectUnauthorizedSessionErrorWithDetails(context.source, context.hostOrigin, {
    reason: 'handshake-required',
  });

  return context;
};

const expectUnauthorizedRequestTreeFromAlternateSource = (
  context: BridgeContext,
) => {
  expect(context.source.postMessage).toHaveBeenCalledTimes(2);
  expect(context.alternateSource.postMessage).toHaveBeenCalledTimes(1);

  expectUnauthorizedSessionErrorWithDetails(
    context.alternateSource,
    context.hostOrigin,
    {
      requestId: 'request-secure-tree-alt-source',
      sessionId: 'session-secure-hello',
      reason: 'source-mismatch',
    },
  );

  return context;
};

const expectSecureTreeSnapshotResponseAfterAuthorizedHello = (
  context: BridgeContext,
) => {
  const inspectorCalls = readInspectorPostMessageCalls(context);

  expect(inspectorCalls).toHaveLength(2);
  expect(inspectorCalls[0]?.[0]).toMatchObject({
    type: 'READY',
    requestId: 'request-secure-hello',
    sessionId: 'session-secure-hello',
  });
  expect(inspectorCalls[1]?.[0]).toMatchObject({
    type: 'TREE_SNAPSHOT',
    requestId: 'request-secure-tree',
    sessionId: 'session-secure-hello',
    payload: {
      nodes: context.treeSnapshot.nodes,
      rootIds: context.treeSnapshot.rootIds,
    },
  });

  return context;
};

const expectSecureTreeSnapshotResponseAfterAuthorizedHelloWithRotatedSessionId = (
  context: BridgeContext,
) => {
  const inspectorCalls = readInspectorPostMessageCalls(context);

  expect(inspectorCalls).toHaveLength(2);
  expect(inspectorCalls[0]?.[0]).toMatchObject({
    type: 'READY',
    requestId: 'request-secure-hello',
    sessionId: 'session-secure-hello',
  });
  expect(inspectorCalls[1]?.[0]).toMatchObject({
    type: 'TREE_SNAPSHOT',
    requestId: 'request-42',
    sessionId: 'session-42',
    payload: {
      nodes: context.treeSnapshot.nodes,
      rootIds: context.treeSnapshot.rootIds,
    },
  });

  return context;
};

const expectUnauthorizedSessionErrorForMissingHelloPayload = (
  context: BridgeContext,
) => {
  expectUnauthorizedSessionErrorWithDetails(context.source, context.hostOrigin, {
    requestId: 'request-secure-hello-missing-payload',
    sessionId: 'session-secure-hello-missing-payload',
    reason: 'missing-auth',
  });

  return context;
};

const expectOversizeMessageErrorResponse = (context: BridgeContext) => {
  expect(context.source.postMessage).toHaveBeenCalledTimes(1);

  const [message, origin] = context.source.postMessage.mock.calls[0];

  expect(origin).toBe(context.hostOrigin);
  expect(message).toMatchObject({
    type: 'ERROR',
    requestId: 'request-oversize-hello',
    sessionId: 'session-oversize-hello',
    payload: {
      code: 'ERR_OVERSIZE_MESSAGE',
      details: {
        reason: 'embedded-inbound-message-too-large',
        maxBytes: EMBEDDED_MAX_INBOUND_INSPECTOR_MESSAGE_BYTES,
        actualBytes: expect.any(Number),
      },
    },
  });
  expect(
    (message as { payload?: { details?: { actualBytes?: number } } }).payload
      ?.details?.actualBytes,
  ).toBeGreaterThan(EMBEDDED_MAX_INBOUND_INSPECTOR_MESSAGE_BYTES);

  return context;
};

const expectOversizeMessageErrorResponseForJsonEnvelope = (
  context: BridgeContext,
) => {
  expect(context.source.postMessage).toHaveBeenCalledTimes(1);

  const [message, origin] = context.source.postMessage.mock.calls[0];

  expect(origin).toBe(context.hostOrigin);
  expect(message).toMatchObject({
    type: 'ERROR',
    requestId: 'request-oversize-hello-json',
    sessionId: 'session-oversize-hello-json',
    payload: {
      code: 'ERR_OVERSIZE_MESSAGE',
      details: {
        reason: 'embedded-inbound-message-too-large',
        maxBytes: EMBEDDED_MAX_INBOUND_INSPECTOR_MESSAGE_BYTES,
        actualBytes: expect.any(Number),
      },
    },
  });
};

const expectOversizeMessageErrorResponseForBinaryPadding = (
  context: BridgeContext,
) => {
  expect(context.source.postMessage).toHaveBeenCalledTimes(1);

  const [message, origin] = context.source.postMessage.mock.calls[0];

  expect(origin).toBe(context.hostOrigin);
  expect(message).toMatchObject({
    type: 'ERROR',
    requestId: 'request-oversize-hello-binary',
    sessionId: 'session-oversize-hello-binary',
    payload: {
      code: 'ERR_OVERSIZE_MESSAGE',
      details: {
        reason: 'embedded-inbound-message-too-large',
        maxBytes: EMBEDDED_MAX_INBOUND_INSPECTOR_MESSAGE_BYTES,
        actualBytes: expect.any(Number),
      },
    },
  });
  expect(
    (message as { payload?: { details?: { actualBytes?: number } } }).payload
      ?.details?.actualBytes,
  ).toBeGreaterThan(EMBEDDED_MAX_INBOUND_INSPECTOR_MESSAGE_BYTES);
};

const expectOversizeMessageErrorResponseForFiberRequestTree = (
  context: BridgeContext,
) => {
  expect(context.source.postMessage).toHaveBeenCalledTimes(1);

  const [message, origin] = context.source.postMessage.mock.calls[0];

  expect(origin).toBe(context.hostOrigin);
  expect(message).toMatchObject({
    type: 'ERROR',
    requestId: 'request-fiber-oversize-tree',
    sessionId: 'session-fiber-oversize-tree',
    payload: {
      code: 'ERR_OVERSIZE_MESSAGE',
      details: {
        reason: 'embedded-inbound-message-too-large',
        maxBytes: EMBEDDED_MAX_INBOUND_INSPECTOR_MESSAGE_BYTES,
        actualBytes: expect.any(Number),
      },
    },
  });

  return context;
};

const expectPongResponse = (context: BridgeContext) => {
  expect(context.source.postMessage).toHaveBeenCalledTimes(1);

  const [message, origin] = context.source.postMessage.mock.calls[0];

  expect(origin).toBe(context.hostOrigin);
  expect(message).toMatchObject({
    type: 'PONG',
    payload: {
      sentAt: 101,
    },
  });
};

const expectTreeSnapshotResponse = (context: BridgeContext) => {
  expect(context.getTreeSnapshot).toHaveBeenCalledTimes(1);
  expect(context.source.postMessage).toHaveBeenCalledTimes(1);

  const [message, origin] = context.source.postMessage.mock.calls[0];

  expect(origin).toBe(context.hostOrigin);
  expect(message).toMatchObject({
    type: 'TREE_SNAPSHOT',
    requestId: 'request-42',
    sessionId: 'session-42',
    payload: {
      nodes: context.treeSnapshot.nodes,
      rootIds: context.treeSnapshot.rootIds,
    },
  });
  expect(message).not.toHaveProperty('payload.meta');
};

const expectUnsolicitedTreeSnapshotAfterNavigation = (
  context: BridgeContext,
) => {
  const inspectorCalls = readInspectorPostMessageCalls(context);

  expect(context.getTreeSnapshot).toHaveBeenCalledTimes(1);
  expect(inspectorCalls).toHaveLength(2);

  const [readyCall, treeSnapshotCall] = inspectorCalls;
  const [readyMessage, readyOrigin] = readyCall as [unknown, string];
  const [treeSnapshotMessage, treeSnapshotOrigin] = treeSnapshotCall as [
    unknown,
    string,
  ];
  const treeSnapshotResponse = treeSnapshotMessage as {
    requestId?: string;
  };

  expect(readyOrigin).toBe(context.hostOrigin);
  expect(readyMessage).toMatchObject({
    type: 'READY',
    requestId: 'request-navigation-hello',
    sessionId: 'session-navigation-hello',
  });

  expect(treeSnapshotOrigin).toBe(context.hostOrigin);
  expect(treeSnapshotMessage).toMatchObject({
    type: 'TREE_SNAPSHOT',
    sessionId: 'session-navigation-hello',
    payload: {
      nodes: context.treeSnapshot.nodes,
      rootIds: context.treeSnapshot.rootIds,
    },
  });
  expect(treeSnapshotResponse.requestId).toBeUndefined();
};

const expectFollowUpUnsolicitedTreeSnapshotAfterAsyncNavigationCompletion = (
  context: BridgeContext,
) => {
  const inspectorCalls = readInspectorPostMessageCalls(context);

  expect(context.getTreeSnapshot).toHaveBeenCalledTimes(2);
  expect(inspectorCalls).toHaveLength(3);

  const [readyCall, initialTreeSnapshotCall, followUpTreeSnapshotCall] =
    inspectorCalls;
  const [readyMessage, readyOrigin] = readyCall as [unknown, string];
  const [initialTreeSnapshotMessage, initialTreeSnapshotOrigin] =
    initialTreeSnapshotCall as [unknown, string];
  const [followUpTreeSnapshotMessage, followUpTreeSnapshotOrigin] =
    followUpTreeSnapshotCall as [unknown, string];
  const initialTreeSnapshotResponse = initialTreeSnapshotMessage as {
    requestId?: string;
  };
  const followUpTreeSnapshotResponse = followUpTreeSnapshotMessage as {
    requestId?: string;
  };

  expect(readyOrigin).toBe(context.hostOrigin);
  expect(readyMessage).toMatchObject({
    type: 'READY',
    requestId: 'request-navigation-hello',
    sessionId: 'session-navigation-hello',
  });

  expect(initialTreeSnapshotOrigin).toBe(context.hostOrigin);
  expect(initialTreeSnapshotMessage).toMatchObject({
    type: 'TREE_SNAPSHOT',
    sessionId: 'session-navigation-hello',
    payload: {
      nodes: [
        {
          id: 'root-node',
          displayName: 'App',
          parentId: null,
          childrenIds: [],
        },
      ],
      rootIds: ['root-node'],
    },
  });
  expect(initialTreeSnapshotResponse.requestId).toBeUndefined();

  expect(followUpTreeSnapshotOrigin).toBe(context.hostOrigin);
  expect(followUpTreeSnapshotMessage).toMatchObject({
    type: 'TREE_SNAPSHOT',
    sessionId: 'session-navigation-hello',
    payload: {
      nodes: context.treeSnapshot.nodes,
      rootIds: context.treeSnapshot.rootIds,
    },
  });
  expect(followUpTreeSnapshotResponse.requestId).toBeUndefined();
};

const expectSnapshotResponse = (context: BridgeContext) => {
  expect(context.getTreeSnapshot).toHaveBeenCalledTimes(1);
  expect(context.source.postMessage).toHaveBeenCalledTimes(1);

  const [message, origin] = context.source.postMessage.mock.calls[0];

  expect(origin).toBe(context.hostOrigin);
  expect(message).toMatchObject({
    type: 'SNAPSHOT',
    requestId: 'request-snapshot-45',
    sessionId: 'session-snapshot-45',
    payload: {
      captureMimeType: 'image/svg+xml',
      width: expect.any(Number),
      height: expect.any(Number),
      capturedAt: expect.any(Number),
      treeSnapshot: {
        nodes: context.treeSnapshot.nodes,
        rootIds: context.treeSnapshot.rootIds,
      },
    },
  });
  expect(message.payload.capture).toBeInstanceOf(Blob);
  expect(message.payload.html).toEqual(expect.any(String));

  return context;
};

const expectSnapshotResponseHtmlIncludesFullDocumentMarkup = (
  context: BridgeContext,
) => {
  const [snapshotMessage] = context.source.postMessage.mock.calls[0];
  const expectedHtmlMarkup = document.documentElement.outerHTML;

  expect(expectedHtmlMarkup.length).toBeGreaterThan(12_000);
  expect(snapshotMessage.payload.html).toBe(expectedHtmlMarkup);
  expect(snapshotMessage.payload.htmlTruncated).toBe(false);

  return context;
};

const readBlobAsText = (blob: Blob): Promise<string> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();

    reader.onload = () => {
      if (typeof reader.result === 'string') {
        resolve(reader.result);
        return;
      }

      reject(new Error('Expected blob text result to be a string.'));
    };

    reader.onerror = () => {
      reject(reader.error ?? new Error('Failed to read blob as text.'));
    };

    reader.readAsText(blob);
  });
};

const expectSnapshotCaptureSvgIsXmlDecodable = async (
  context: BridgeContext,
) => {
  const [snapshotMessage] = context.source.postMessage.mock.calls[0];
  const snapshotPayload = snapshotMessage.payload as {
    capture: Blob;
  };
  const captureSvgMarkup = await readBlobAsText(snapshotPayload.capture);
  const parsedSvgDocument = new DOMParser().parseFromString(
    captureSvgMarkup,
    'image/svg+xml',
  );
  const parserErrorElements =
    parsedSvgDocument.getElementsByTagName('parsererror');

  expect(parserErrorElements).toHaveLength(0);

  return context;
};

const expectTreeSnapshotResponseFromFactoryAdapter = (
  context: BridgeContext,
) => {
  const runtimeAdapter = context.factoryRuntimeAdapter ?? 'next';

  expect(context.adapterFactory).toHaveBeenCalledTimes(1);
  expect(context.adapterFactory).toHaveBeenCalledWith({
    adapter: runtimeAdapter,
  });
  expect(context.factoryGetTreeSnapshot).toHaveBeenCalledTimes(1);
  expect(context.source.postMessage).toHaveBeenCalledTimes(1);

  const [message, origin] = context.source.postMessage.mock.calls[0];

  expect(origin).toBe(context.hostOrigin);
  expect(message).toMatchObject({
    type: 'TREE_SNAPSHOT',
    requestId: 'request-42',
    sessionId: 'session-42',
    payload: {
      nodes: context.treeSnapshot.nodes,
      rootIds: context.treeSnapshot.rootIds,
    },
  });
};

const expectTreeSnapshotResponseFromBuiltInFiberRuntime = (
  context: BridgeContext,
) => {
  expect(context.source.postMessage).toHaveBeenCalledTimes(1);

  const [message, origin] = context.source.postMessage.mock.calls[0];

  expect(origin).toBe(context.hostOrigin);
  expect(message).toMatchObject({
    type: 'TREE_SNAPSHOT',
    requestId: 'request-42',
    sessionId: 'session-42',
  });
  expect(message.payload.nodes.length).toBeGreaterThan(1);
  expect(message.payload.rootIds).toHaveLength(1);
  expect(
    message.payload.nodes.map(
      (node: { displayName: string }) => node.displayName,
    ),
  ).toEqual(['AppShell', 'ForwardRef(ToolbarButton)', 'Memo(MemoPanel)']);
  expect(
    message.payload.nodes.every((node: { tags?: string[] }) =>
      node.tags?.includes('fiber'),
    ),
  ).toBe(true);
};

const expectTreeSnapshotResponseFromBuiltInFiberFallback = (
  context: BridgeContext,
) => {
  expect(context.source.postMessage).toHaveBeenCalledTimes(1);

  const [message, origin] = context.source.postMessage.mock.calls[0];

  expect(origin).toBe(context.hostOrigin);
  expect(message).toMatchObject({
    type: 'TREE_SNAPSHOT',
    requestId: 'request-42',
    sessionId: 'session-42',
    payload: {
      rootIds: ['itera-app-root'],
    },
  });
  expect(message.payload.nodes.map((node: { id: string }) => node.id)).toEqual([
    'itera-app-root',
  ]);
};

const expectTreeAdapterOverridesFactoryAdapter = (context: BridgeContext) => {
  expect(context.adapterFactory).not.toHaveBeenCalled();
  expect(context.getTreeSnapshot).toHaveBeenCalledTimes(1);
  expect(context.source.postMessage).toHaveBeenCalledTimes(1);

  const [message, origin] = context.source.postMessage.mock.calls[0];

  expect(origin).toBe(context.hostOrigin);
  expect(message).toMatchObject({
    type: 'TREE_SNAPSHOT',
    requestId: 'request-42',
    sessionId: 'session-42',
    payload: {
      nodes: context.treeSnapshot.nodes,
      rootIds: context.treeSnapshot.rootIds,
    },
  });
};

const expectTruncatedTreeSnapshotResponse = (context: BridgeContext) => {
  expect(context.getTreeSnapshot).toHaveBeenCalledTimes(1);
  expect(context.source.postMessage).toHaveBeenCalledTimes(1);

  const [message, origin] = context.source.postMessage.mock.calls[0];
  const expectedNodeIds = Array.from(
    { length: MAX_TREE_SNAPSHOT_NODE_COUNT },
    (_, index) => `node-${index}`,
  );

  expect(origin).toBe(context.hostOrigin);
  expect(message).toMatchObject({
    type: 'TREE_SNAPSHOT',
    requestId: 'request-42',
    sessionId: 'session-42',
    payload: {
      rootIds: ['node-0'],
      meta: {
        truncated: true,
        totalNodeCount: MAX_TREE_SNAPSHOT_NODE_COUNT + 3,
        includedNodeCount: MAX_TREE_SNAPSHOT_NODE_COUNT,
        truncatedNodeCount: 3,
      },
    },
  });
  expect(message.payload.nodes).toHaveLength(MAX_TREE_SNAPSHOT_NODE_COUNT);
  expect(
    message.payload.nodes.map((node: { id: string }) => node.id),
  ).toStrictEqual(expectedNodeIds);
  expect(
    message.payload.nodes[MAX_TREE_SNAPSHOT_NODE_COUNT - 1].childrenIds,
  ).toStrictEqual([]);
};

const expectTruncatedTreeSnapshotRootsContainPromotedNodes = (
  context: BridgeContext,
) => {
  expect(context.getTreeSnapshot).toHaveBeenCalledTimes(1);
  expect(context.source.postMessage).toHaveBeenCalledTimes(1);

  const [message, origin] = context.source.postMessage.mock.calls[0];
  const promotedNode = message.payload.nodes.find(
    (node: { id: string }) => node.id === 'promoted-node',
  );

  expect(origin).toBe(context.hostOrigin);
  expect(message.payload.meta).toMatchObject({
    truncated: true,
    totalNodeCount: MAX_TREE_SNAPSHOT_NODE_COUNT + 1,
    includedNodeCount: MAX_TREE_SNAPSHOT_NODE_COUNT,
    truncatedNodeCount: 1,
  });
  expect(promotedNode).toMatchObject({
    id: 'promoted-node',
    parentId: null,
  });
  expect(message.payload.rootIds).toStrictEqual(['root-0', 'promoted-node']);
};

const expectTreeSnapshotResponseWithTraversalTruncationMeta = (
  context: BridgeContext,
) => {
  expect(context.getTreeSnapshot).toHaveBeenCalledTimes(1);
  expect(context.source.postMessage).toHaveBeenCalledTimes(1);

  const [message, origin] = context.source.postMessage.mock.calls[0];

  expect(origin).toBe(context.hostOrigin);
  expect(message).toMatchObject({
    type: 'TREE_SNAPSHOT',
    requestId: 'request-42',
    sessionId: 'session-42',
    payload: {
      nodes: context.treeSnapshot.nodes,
      rootIds: context.treeSnapshot.rootIds,
      meta: {
        truncated: true,
        includedNodeCount: 1,
      },
    },
  });
};

const expectNodePropsResponse = (context: BridgeContext) => {
  expect(context.getNodeProps).toHaveBeenCalledTimes(1);
  expect(context.getNodeProps).toHaveBeenCalledWith('root-node');
  expect(context.source.postMessage).toHaveBeenCalledTimes(1);

  const [message, origin] = context.source.postMessage.mock.calls[0];

  expect(origin).toBe(context.hostOrigin);
  expect(message).toMatchObject({
    type: 'NODE_PROPS',
    requestId: 'request-43',
    sessionId: 'session-43',
    payload: {
      nodeId: 'root-node',
      props: {
        title: 'App',
        version: 1,
      },
      meta: {},
    },
  });
};

const expectNodeNotFoundErrorResponse = (context: BridgeContext) => {
  expect(context.getNodeProps).toHaveBeenCalledTimes(1);
  expect(context.getNodeProps).toHaveBeenCalledWith('missing-node');
  expect(context.source.postMessage).toHaveBeenCalledTimes(1);

  const [message, origin] = context.source.postMessage.mock.calls[0];

  expect(origin).toBe(context.hostOrigin);
  expect(message).toMatchObject({
    type: 'ERROR',
    requestId: 'request-44',
    sessionId: 'session-44',
    payload: {
      code: 'ERR_NODE_NOT_FOUND',
      details: {
        nodeId: 'missing-node',
      },
    },
  });
};

const expectFiberNodePropsResponseToBeSerializedAndRedacted = (
  context: BridgeContext,
) => {
  expect(context.resolvedFiberNodeId).toBeDefined();
  expect(context.source.postMessage).toHaveBeenCalledTimes(2);

  const [nodePropsMessage, origin] = context.source.postMessage.mock.calls[1];

  expect(origin).toBe(context.hostOrigin);
  expect(nodePropsMessage).toMatchObject({
    type: 'NODE_PROPS',
    requestId: 'request-fiber-props',
    sessionId: 'session-fiber-props',
    payload: {
      nodeId: context.resolvedFiberNodeId,
      props: {
        publicLabel: 'Inspector',
        sessionToken: {
          __iteraType: 'redacted',
          preview: 'Sensitive value redacted',
        },
        nested: {
          password: {
            __iteraType: 'redacted',
            preview: 'Sensitive value redacted',
          },
        },
      },
      meta: {
        redactedCount: 2,
        redactedPaths: ['sessionToken', 'nested.password'],
      },
    },
  });
};

const expectFiberCorrelationAcrossHelloTreeAndPropsRequests = (
  context: BridgeContext,
) => {
  const inspectorCalls = readInspectorPostMessageCalls(context);

  expect(context.resolvedFiberNodeId).toBeDefined();
  expect(inspectorCalls).toHaveLength(3);

  const [readyCall, treeSnapshotCall, nodePropsCall] = inspectorCalls;
  const [readyMessage, readyOrigin] = readyCall as [unknown, string];
  const [treeSnapshotMessage, treeOrigin] = treeSnapshotCall as [
    unknown,
    string,
  ];
  const [nodePropsMessage, propsOrigin] = nodePropsCall as [unknown, string];
  const treeSnapshotResponse = treeSnapshotMessage as {
    payload?: {
      nodes?: unknown[];
    };
  };

  expect(readyOrigin).toBe(context.hostOrigin);
  expect(readyMessage).toMatchObject({
    type: 'READY',
    requestId: 'request-fiber-hello',
    sessionId: 'session-fiber-hello',
  });

  expect(treeOrigin).toBe(context.hostOrigin);
  expect(treeSnapshotMessage).toMatchObject({
    type: 'TREE_SNAPSHOT',
    requestId: 'request-fiber-tree-correlation',
    sessionId: 'session-fiber-tree-correlation',
  });
  expect(treeSnapshotResponse.payload?.nodes?.length).toBeGreaterThan(1);

  expect(propsOrigin).toBe(context.hostOrigin);
  expect(nodePropsMessage).toMatchObject({
    type: 'NODE_PROPS',
    requestId: 'request-fiber-props-correlation',
    sessionId: 'session-fiber-props-correlation',
    payload: {
      nodeId: context.resolvedFiberNodeId,
    },
  });
};

const expectMixedFiberNodeOperationsToRemainFailSoftPerNode = (
  context: BridgeContext,
) => {
  expect(context.resolvedFailingFiberNodeId).toBeDefined();
  expect(context.resolvedFiberNodeId).toBeDefined();
  expect(context.source.postMessage).toHaveBeenCalledTimes(4);

  const [treeSnapshotMessage, treeSnapshotOrigin] =
    context.source.postMessage.mock.calls[0];
  const [propsFailureMessage, propsFailureOrigin] =
    context.source.postMessage.mock.calls[1];
  const [propsSuccessMessage, propsSuccessOrigin] =
    context.source.postMessage.mock.calls[2];
  const [highlightFailureMessage, highlightFailureOrigin] =
    context.source.postMessage.mock.calls[3];

  expect(treeSnapshotOrigin).toBe(context.hostOrigin);
  expect(treeSnapshotMessage).toMatchObject({
    type: 'TREE_SNAPSHOT',
    requestId: 'request-fiber-mixed-tree',
    sessionId: 'session-fiber-mixed-tree',
  });
  expect(propsFailureOrigin).toBe(context.hostOrigin);
  expect(propsFailureMessage).toMatchObject({
    type: 'ERROR',
    requestId: 'request-fiber-mixed-props-fail',
    sessionId: 'session-fiber-mixed-props-fail',
    payload: {
      code: 'ERR_NODE_NOT_FOUND',
      details: {
        nodeId: context.resolvedFailingFiberNodeId,
      },
    },
  });
  expect(propsSuccessOrigin).toBe(context.hostOrigin);
  expect(propsSuccessMessage).toMatchObject({
    type: 'NODE_PROPS',
    requestId: 'request-fiber-mixed-props-success',
    sessionId: 'session-fiber-mixed-props-success',
    payload: {
      nodeId: context.resolvedFiberNodeId,
      props: {
        action: 'publish',
      },
      meta: {},
    },
  });
  expect(highlightFailureOrigin).toBe(context.hostOrigin);
  expect(highlightFailureMessage).toMatchObject({
    type: 'ERROR',
    requestId: 'request-fiber-mixed-highlight-fail',
    sessionId: 'session-fiber-mixed-highlight-fail',
    payload: {
      code: 'ERR_NODE_NOT_FOUND',
      details: {
        nodeId: context.resolvedFailingFiberNodeId,
      },
    },
  });
};

const expectFiberFallbackNodeOperationsToRemainFunctional = (
  context: BridgeContext,
) => {
  expect(context.resolvedFallbackNodeId).toBe('itera-app-root');
  expect(context.source.postMessage).toHaveBeenCalledTimes(2);

  const [treeSnapshotMessage, treeSnapshotOrigin] =
    context.source.postMessage.mock.calls[0];
  const [propsMessage, propsOrigin] = context.source.postMessage.mock.calls[1];

  expect(treeSnapshotOrigin).toBe(context.hostOrigin);
  expect(treeSnapshotMessage).toMatchObject({
    type: 'TREE_SNAPSHOT',
    requestId: 'request-fiber-fallback-tree',
    sessionId: 'session-fiber-fallback-tree',
    payload: {
      rootIds: ['itera-app-root'],
    },
  });
  expect(propsOrigin).toBe(context.hostOrigin);
  expect(propsMessage).toMatchObject({
    type: 'NODE_PROPS',
    requestId: 'request-fiber-fallback-props',
    sessionId: 'session-fiber-fallback-props',
    payload: {
      nodeId: 'itera-app-root',
      props: {
        nodeId: 'itera-app-root',
        tagName: 'div',
        elementId: 'root',
      },
    },
  });

  const overlay = document.querySelector(inspectorHighlightOverlaySelector);

  expect(overlay).not.toBeNull();
  expect((overlay as HTMLElement).style.display).toBe('block');
};

const expectHighlightOverlayVisibleForRootNode = (context: BridgeContext) => {
  expect(context.getDomElement).toHaveBeenCalledTimes(1);
  expect(context.getDomElement).toHaveBeenCalledWith('root-node');
  expect(context.source.postMessage).not.toHaveBeenCalled();

  const overlay = document.querySelector(inspectorHighlightOverlaySelector);

  expect(overlay).not.toBeNull();
  expect((overlay as HTMLElement).style.display).toBe('block');
};

const expectHighlightNodeNotFoundErrorResponse = (context: BridgeContext) => {
  expect(context.getDomElement).toHaveBeenCalledTimes(1);
  expect(context.getDomElement).toHaveBeenCalledWith('missing-node');
  expect(context.source.postMessage).toHaveBeenCalledTimes(1);

  const [message, origin] = context.source.postMessage.mock.calls[0];

  expect(origin).toBe(context.hostOrigin);
  expect(message).toMatchObject({
    type: 'ERROR',
    requestId: 'request-46',
    sessionId: 'session-46',
    payload: {
      code: 'ERR_NODE_NOT_FOUND',
      details: {
        nodeId: 'missing-node',
      },
    },
  });
};

const expectStaleHighlightToBeClearedWhenUnknownNodeRequested = (
  context: BridgeContext,
) => {
  expect(context.getDomElement).toHaveBeenCalledTimes(2);
  expect(context.getDomElement).toHaveBeenNthCalledWith(1, 'root-node');
  expect(context.getDomElement).toHaveBeenNthCalledWith(2, 'missing-node');
  expect(context.source.postMessage).toHaveBeenCalledTimes(1);

  const [message, origin] = context.source.postMessage.mock.calls[0];

  expect(origin).toBe(context.hostOrigin);
  expect(message).toMatchObject({
    type: 'ERROR',
    requestId: 'request-46',
    sessionId: 'session-46',
    payload: {
      code: 'ERR_NODE_NOT_FOUND',
      details: {
        nodeId: 'missing-node',
      },
    },
  });

  const overlay = document.querySelector(inspectorHighlightOverlaySelector);

  expect(overlay).not.toBeNull();
  expect((overlay as HTMLElement).style.display).toBe('none');
};

const expectHighlightOverlayHidden = (context: BridgeContext) => {
  expect(context.source.postMessage).not.toHaveBeenCalled();

  const overlay = document.querySelector(inspectorHighlightOverlaySelector);

  expect(overlay).not.toBeNull();
  expect((overlay as HTMLElement).style.display).toBe('none');
};

const expectNoMessagesPosted = (context: BridgeContext) => {
  expect(context.source.postMessage).not.toHaveBeenCalled();

  return context;
};

const expectConnectLifecycleTelemetry = (context: BridgeContext) => {
  expect(context.onLifecycleMetric).toHaveBeenCalledWith({
    schemaVersion: 1,
    metricName: 'itera.inspector.embedded.lifecycle_event_total',
    stage: 'connect',
    count: 1,
  });

  return context;
};

const expectReadyLifecycleTelemetry = (context: BridgeContext) => {
  expect(context.onLifecycleMetric).toHaveBeenCalledWith({
    schemaVersion: 1,
    metricName: 'itera.inspector.embedded.lifecycle_event_total',
    stage: 'ready',
    count: 1,
    messageType: 'HELLO',
    requestId: 'request-secure-hello',
    sessionId: 'session-secure-hello',
  });

  return context;
};

const expectOriginRejectTelemetry = (context: BridgeContext) => {
  expect(context.onRejectionMetric).toHaveBeenCalledWith({
    schemaVersion: 1,
    metricName: 'itera.inspector.embedded.rejection_total',
    reasonCode: 'origin-reject',
    count: 1,
    messageType: 'HELLO',
    errorCode: 'ERR_INVALID_ORIGIN',
  });
  expect(context.onLifecycleMetric).toHaveBeenCalledWith({
    schemaVersion: 1,
    metricName: 'itera.inspector.embedded.lifecycle_event_total',
    stage: 'error',
    count: 1,
    messageType: 'HELLO',
    errorCode: 'ERR_INVALID_ORIGIN',
  });

  return context;
};

const expectTokenRejectTelemetry = (context: BridgeContext) => {
  expect(context.onRejectionMetric).toHaveBeenCalledWith({
    schemaVersion: 1,
    metricName: 'itera.inspector.embedded.rejection_total',
    reasonCode: 'token-reject',
    count: 1,
    messageType: 'HELLO',
    requestId: 'request-secure-hello',
    sessionId: 'session-secure-hello',
    errorCode: 'ERR_UNAUTHORIZED_SESSION',
  });
  expect(context.onLifecycleMetric).toHaveBeenCalledWith({
    schemaVersion: 1,
    metricName: 'itera.inspector.embedded.lifecycle_event_total',
    stage: 'error',
    count: 1,
    messageType: 'HELLO',
    requestId: 'request-secure-hello',
    sessionId: 'session-secure-hello',
    errorCode: 'ERR_UNAUTHORIZED_SESSION',
  });

  return context;
};

const expectTokenRejectSecurityEventLog = (context: BridgeContext) => {
  expect(context.consoleWarnSpy).toHaveBeenCalledWith(
    '[react-inspector-bridge/security]',
    expect.objectContaining({
      eventName: 'itera.inspector.security.message_rejected',
      reasonCode: 'unauthorized-missing-auth',
      rejectedBy: 'embedded',
      messageType: 'HELLO',
      requestId: 'request-secure-hello',
      sessionId: 'session-secure-hello',
      errorCode: 'ERR_UNAUTHORIZED_SESSION',
    }),
  );

  return context;
};

const expectOversizeRejectTelemetry = (context: BridgeContext) => {
  expect(context.onRejectionMetric).toHaveBeenCalledWith({
    schemaVersion: 1,
    metricName: 'itera.inspector.embedded.rejection_total',
    reasonCode: 'oversize-reject',
    count: 1,
    messageType: 'HELLO',
    requestId: 'request-oversize-hello',
    sessionId: 'session-oversize-hello',
    errorCode: 'ERR_OVERSIZE_MESSAGE',
  });
  expect(context.onLifecycleMetric).toHaveBeenCalledWith({
    schemaVersion: 1,
    metricName: 'itera.inspector.embedded.lifecycle_event_total',
    stage: 'error',
    count: 1,
    messageType: 'HELLO',
    requestId: 'request-oversize-hello',
    sessionId: 'session-oversize-hello',
    errorCode: 'ERR_OVERSIZE_MESSAGE',
  });

  return context;
};

const expectOversizeRejectSecurityEventLog = (context: BridgeContext) => {
  expect(context.consoleWarnSpy).toHaveBeenCalledWith(
    '[react-inspector-bridge/security]',
    expect.objectContaining({
      eventName: 'itera.inspector.security.message_rejected',
      reasonCode: 'inbound-message-oversize',
      rejectedBy: 'embedded',
      messageType: 'HELLO',
      requestId: 'request-oversize-hello',
      sessionId: 'session-oversize-hello',
      errorCode: 'ERR_OVERSIZE_MESSAGE',
    }),
  );

  return context;
};

const expectOversizeRejectTelemetryForFiberRequestTree = (
  context: BridgeContext,
) => {
  expect(context.onRejectionMetric).toHaveBeenCalledWith({
    schemaVersion: 1,
    metricName: 'itera.inspector.embedded.rejection_total',
    reasonCode: 'oversize-reject',
    count: 1,
    messageType: 'REQUEST_TREE',
    requestId: 'request-fiber-oversize-tree',
    sessionId: 'session-fiber-oversize-tree',
    errorCode: 'ERR_OVERSIZE_MESSAGE',
  });
  expect(context.onLifecycleMetric).toHaveBeenCalledWith({
    schemaVersion: 1,
    metricName: 'itera.inspector.embedded.lifecycle_event_total',
    stage: 'error',
    count: 1,
    messageType: 'REQUEST_TREE',
    requestId: 'request-fiber-oversize-tree',
    sessionId: 'session-fiber-oversize-tree',
    errorCode: 'ERR_OVERSIZE_MESSAGE',
  });

  return context;
};

const expectOversizeRejectSecurityEventLogForFiberRequestTree = (
  context: BridgeContext,
) => {
  expect(context.consoleWarnSpy).toHaveBeenCalledWith(
    '[react-inspector-bridge/security]',
    expect.objectContaining({
      eventName: 'itera.inspector.security.message_rejected',
      reasonCode: 'inbound-message-oversize',
      rejectedBy: 'embedded',
      messageType: 'REQUEST_TREE',
      requestId: 'request-fiber-oversize-tree',
      sessionId: 'session-fiber-oversize-tree',
      errorCode: 'ERR_OVERSIZE_MESSAGE',
    }),
  );

  return context;
};

const expectInvalidPayloadRejectTelemetry = (context: BridgeContext) => {
  expect(context.onRejectionMetric).toHaveBeenCalledWith({
    schemaVersion: 1,
    metricName: 'itera.inspector.embedded.rejection_total',
    reasonCode: 'invalid-payload-reject',
    count: 1,
    messageType: 'REQUEST_NODE_PROPS',
    requestId: 'request-invalid-payload',
    sessionId: 'session-invalid-payload',
    errorCode: 'ERR_INVALID_PAYLOAD',
  });
  expect(context.onLifecycleMetric).toHaveBeenCalledWith({
    schemaVersion: 1,
    metricName: 'itera.inspector.embedded.lifecycle_event_total',
    stage: 'error',
    count: 1,
    messageType: 'REQUEST_NODE_PROPS',
    requestId: 'request-invalid-payload',
    sessionId: 'session-invalid-payload',
    errorCode: 'ERR_INVALID_PAYLOAD',
  });

  return context;
};

const expectKillSwitchDisableLog = (context: BridgeContext) => {
  expect(context.consoleWarnSpy).toHaveBeenCalledWith(
    '[react-inspector-bridge] Embedded inspector bridge disabled by kill switch.',
  );

  return context;
};

const expectAdapterFactoryNotCalled = (context: BridgeContext) => {
  expect(context.adapterFactory).not.toHaveBeenCalled();

  return context;
};

const locationSetToAuthLoginPath = (context: BridgeContext): BridgeContext => {
  window.history.replaceState(
    {
      route: '/auth/login-with-email',
    },
    '',
    '/auth/login-with-email?email=thor%40asgard.io',
  );

  return context;
};

const historyPushStateTriggeredWithPathChange = (
  context: BridgeContext,
): BridgeContext => {
  window.history.pushState(
    {
      route: '/next',
    },
    '',
    '/next',
  );

  return context;
};

const previewPathUpdatePostedForCurrentLocation = (context: BridgeContext) => {
  const previewPathCalls = readPreviewPathPostMessageCalls(context);

  expect(previewPathCalls).toHaveLength(1);

  const [message, origin] = previewPathCalls[0] as [unknown, string];

  expect(origin).toBe(context.hostOrigin);
  expect(message).toMatchObject({
    channel: 'itera-preview-path',
    type: 'PATH_UPDATED',
    path: '/auth/login-with-email?email=thor%40asgard.io',
  });

  return context;
};

const previewPathUpdatePostedAfterNavigation = (context: BridgeContext) => {
  const previewPathCalls = readPreviewPathPostMessageCalls(context);

  expect(previewPathCalls).toHaveLength(2);

  const [initialMessage, initialOrigin] = previewPathCalls[0] as [
    unknown,
    string,
  ];
  const [navigationMessage, navigationOrigin] = previewPathCalls[1] as [
    unknown,
    string,
  ];

  expect(initialOrigin).toBe(context.hostOrigin);
  expect(initialMessage).toMatchObject({
    channel: 'itera-preview-path',
    type: 'PATH_UPDATED',
    path: '/auth/login-with-email?email=thor%40asgard.io',
  });

  expect(navigationOrigin).toBe(context.hostOrigin);
  expect(navigationMessage).toMatchObject({
    channel: 'itera-preview-path',
    type: 'PATH_UPDATED',
    path: '/next',
  });

  return context;
};

describe('bridgeRuntime', () => {
  afterEach(() => {
    destroyInspectorBridge();
    vi.useRealTimers();
    vi.restoreAllMocks();
    document.body.innerHTML = '';
    delete windowRefWithDevtoolsHook.__REACT_DEVTOOLS_GLOBAL_HOOK__;
  });

  test('responds with READY when receiving HELLO from trusted host', () => {
    return given(contextCreated())
      .when(bridgeInitialized)
      .when(hostSendsHello)
      .then(expectReadyResponse);
  });

  test('exposes and clears the embedded selection API around bridge lifecycle', () => {
    return given(contextCreated())
      .when(selectionApiConfigured)
      .when(bridgeInitialized)
      .when(embeddedSelectionApiResolved)
      .then(expectEmbeddedSelectionApiToDelegateToTreeAdapter)
      .when(bridgeDestroyed)
      .then(expectEmbeddedSelectionApiToBeCleared);
  });

  test('posts preview path update when HELLO establishes host connection', () => {
    return given(contextCreated())
      .when(bridgeInitialized)
      .when(locationSetToAuthLoginPath)
      .when(hostSendsHello)
      .then(previewPathUpdatePostedForCurrentLocation);
  });

  test('emits connect lifecycle telemetry when bridge starts', () => {
    return given(contextCreated())
      .when(bridgeTelemetryConfigured)
      .when(bridgeInitialized)
      .then(expectConnectLifecycleTelemetry);
  });

  test('responds with READY when receiving large HELLO payload under hard size limit', () => {
    return given(contextCreated())
      .when(bridgeInitialized)
      .when(hostSendsLargeUnderLimitHello)
      .then(expectReadyResponseForUnderLimitHello);
  });

  test('responds with READY when channel appears late in JSON-string HELLO envelope', () => {
    return given(contextCreated())
      .when(bridgeInitialized)
      .when(hostSendsHelloWithLateChannelJsonString)
      .then(expectReadyResponseForLateChannelJsonHello);
  });

  test('responds with ERR_OVERSIZE_MESSAGE when receiving oversize HELLO payload', () => {
    return given(contextCreated())
      .when(bridgeInitialized)
      .when(hostSendsOversizeHello)
      .then(expectOversizeMessageErrorResponse);
  });

  test('emits oversize rejection telemetry when receiving oversize HELLO payload', () => {
    return given(contextCreated())
      .when(bridgeTelemetryConfigured)
      .when(bridgeInitialized)
      .when(hostSendsOversizeHello)
      .then(expectOversizeRejectTelemetry);
  });

  test('emits structured security rejection logs when receiving oversize HELLO payload', () => {
    return given(contextCreated())
      .when(consoleWarnMocked)
      .when(bridgeInitialized)
      .when(hostSendsOversizeHello)
      .then(expectOversizeMessageErrorResponse)
      .then(expectOversizeRejectSecurityEventLog);
  });

  test('preserves request and session correlation when oversize HELLO arrives as JSON string envelope', () => {
    return given(contextCreated())
      .when(bridgeInitialized)
      .when(hostSendsOversizeHelloAsJsonString)
      .then(expectOversizeMessageErrorResponseForJsonEnvelope);
  });

  test('rejects otherwise valid HELLO envelope when oversized binary padding is present', () => {
    return given(contextCreated())
      .when(bridgeInitialized)
      .when(hostSendsOversizeHelloWithBinaryPadding)
      .then(expectOversizeMessageErrorResponseForBinaryPadding);
  });

  test('rejects oversize REQUEST_TREE while fiber runtime adapter is active', () => {
    return given(contextCreated())
      .when(domPreparedWithViteRootElement)
      .when(fiberHookConfiguredWithComponentTree)
      .when(bridgeInitializedWithBuiltInFiberRuntime)
      .when(hostSendsOversizeFiberRequestTree)
      .then(expectOversizeMessageErrorResponseForFiberRequestTree);
  });

  test('emits oversize rejection telemetry for oversize REQUEST_TREE while fiber runtime adapter is active', () => {
    return given(contextCreated())
      .when(bridgeTelemetryConfigured)
      .when(domPreparedWithViteRootElement)
      .when(fiberHookConfiguredWithComponentTree)
      .when(bridgeInitializedWithBuiltInFiberRuntime)
      .when(hostSendsOversizeFiberRequestTree)
      .then(expectOversizeRejectTelemetryForFiberRequestTree);
  });

  test('emits structured security rejection logs for oversize REQUEST_TREE while fiber runtime adapter is active', () => {
    return given(contextCreated())
      .when(consoleWarnMocked)
      .when(domPreparedWithViteRootElement)
      .when(fiberHookConfiguredWithComponentTree)
      .when(bridgeInitializedWithBuiltInFiberRuntime)
      .when(hostSendsOversizeFiberRequestTree)
      .then(expectOversizeMessageErrorResponseForFiberRequestTree)
      .then(expectOversizeRejectSecurityEventLogForFiberRequestTree);
  });

  test('ignores oversize trusted-origin messages outside inspector channel', () => {
    return given(contextCreated())
      .when(bridgeInitialized)
      .when(hostSendsOversizeNonInspectorMessage)
      .then(expectNoMessagesPosted);
  });

  test('ignores oversize trusted-origin strings that only contain inspector channel snippets', () => {
    return given(contextCreated())
      .when(bridgeInitialized)
      .when(hostSendsOversizeStringContainingInspectorChannelSnippet)
      .then(expectNoMessagesPosted);
  });

  test('responds with READY in secure mode when HELLO auth token is valid', () => {
    return given(contextCreated())
      .when(helloAuthTokenSetAsValid)
      .when(bridgeInitializedWithSecureTokenValidation)
      .when(hostSendsHelloWithConfiguredAuth)
      .then(expectSecureReadyResponse);
  });

  test('emits ready lifecycle telemetry when secure HELLO auth token is valid', () => {
    return given(contextCreated())
      .when(bridgeTelemetryConfigured)
      .when(helloAuthTokenSetAsValid)
      .when(bridgeInitializedWithSecureTokenValidation)
      .when(hostSendsHelloWithConfiguredAuth)
      .then(expectReadyLifecycleTelemetry);
  });

  test('responds with ERR_UNAUTHORIZED_SESSION in secure mode when HELLO auth is missing', () => {
    return given(contextCreated())
      .when(bridgeInitializedWithSecureTokenValidation)
      .when(hostSendsHelloWithConfiguredAuth)
      .then(expectUnauthorizedSessionErrorForMissingAuth);
  });

  test('responds with ERR_UNAUTHORIZED_SESSION in secure mode when HELLO payload is omitted', () => {
    return given(contextCreated())
      .when(bridgeInitializedWithSecureTokenValidation)
      .when(hostSendsHelloWithUndefinedPayloadInSecureMode)
      .then(expectUnauthorizedSessionErrorForMissingHelloPayload);
  });

  test('emits token rejection telemetry when secure HELLO auth is missing', () => {
    return given(contextCreated())
      .when(bridgeTelemetryConfigured)
      .when(bridgeInitializedWithSecureTokenValidation)
      .when(hostSendsHelloWithConfiguredAuth)
      .then(expectTokenRejectTelemetry);
  });

  test('emits structured security rejection logs when secure HELLO auth is missing', () => {
    return given(contextCreated())
      .when(consoleWarnMocked)
      .when(bridgeInitializedWithSecureTokenValidation)
      .when(hostSendsHelloWithConfiguredAuth)
      .then(expectUnauthorizedSessionErrorForMissingAuth)
      .then(expectTokenRejectSecurityEventLog);
  });

  test('responds with ERR_UNAUTHORIZED_SESSION in secure mode when HELLO auth token is invalid', () => {
    return given(contextCreated())
      .when(helloAuthTokenSetAsInvalid)
      .when(bridgeInitializedWithSecureTokenValidation)
      .when(hostSendsHelloWithConfiguredAuth)
      .then(expectUnauthorizedSessionErrorForInvalidAuth);
  });

  test('responds with ERR_UNAUTHORIZED_SESSION in secure mode when HELLO auth token is expired', () => {
    return given(contextCreated())
      .when(helloAuthTokenSetAsExpired)
      .when(bridgeInitializedWithSecureTokenValidation)
      .when(hostSendsHelloWithConfiguredAuth)
      .then(expectUnauthorizedSessionErrorForExpiredAuth);
  });

  test('rejects REQUEST_TREE in secure mode before HELLO is authorized', () => {
    return given(contextCreated())
      .when(bridgeInitializedWithSecureTokenValidation)
      .when(hostSendsRequestTree)
      .then(expectUnauthorizedRequestTreeBeforeSecureHello);
  });

  test('rejects PING in secure mode before HELLO is authorized', () => {
    return given(contextCreated())
      .when(bridgeInitializedWithSecureTokenValidation)
      .when(hostSendsPing)
      .then(expectUnauthorizedPingBeforeSecureHello);
  });

  test('responds with TREE_SNAPSHOT in secure mode after HELLO from the authorized sender and session', () => {
    return given(contextCreated())
      .when(helloAuthTokenSetAsValid)
      .when(bridgeInitializedWithSecureTokenValidation)
      .when(hostSendsHelloWithConfiguredAuth)
      .when(hostSendsRequestTreeWithSecureHelloSession)
      .then(expectSecureTreeSnapshotResponseAfterAuthorizedHello);
  });

  test('allows REQUEST_TREE in secure mode when sessionId differs from the authorized HELLO but sender and origin stay valid', () => {
    return given(contextCreated())
      .when(helloAuthTokenSetAsValid)
      .when(bridgeInitializedWithSecureTokenValidation)
      .when(hostSendsHelloWithConfiguredAuth)
      .when(hostSendsRequestTree)
      .then(expectSecureTreeSnapshotResponseAfterAuthorizedHelloWithRotatedSessionId);
  });

  test('rejects REQUEST_TREE in secure mode when a different same-origin sender tries to reuse the authorized session', () => {
    return given(contextCreated())
      .when(helloAuthTokenSetAsValid)
      .when(bridgeInitializedWithSecureTokenValidation)
      .when(hostSendsHelloWithConfiguredAuth)
      .when(alternateHostSendsRequestTreeWithSecureHelloSession)
      .then(expectUnauthorizedRequestTreeFromAlternateSource);
  });

  test('responds with PONG when receiving PING', () => {
    return given(contextCreated())
      .when(bridgeInitialized)
      .when(hostSendsPing)
      .then(expectPongResponse);
  });

  test('emits invalid payload rejection telemetry when payload contract check fails', () => {
    return given(contextCreated())
      .when(bridgeTelemetryConfigured)
      .when(bridgeInitialized)
      .when(hostSendsRequestNodePropsWithInvalidPayload)
      .then(expectNoMessagesPosted)
      .then(expectInvalidPayloadRejectTelemetry);
  });

  test('responds with TREE_SNAPSHOT when receiving REQUEST_TREE', () => {
    return given(contextCreated())
      .when(bridgeInitialized)
      .when(hostSendsRequestTree)
      .then(expectTreeSnapshotResponse);
  });

  test('posts unsolicited TREE_SNAPSHOT updates after client-side navigation once HELLO is established', () => {
    return given(contextCreated())
      .when(clockConfigured)
      .when(bridgeInitialized)
      .when(hostSendsHelloWithNavigationSession)
      .when(treeSnapshotUpdatedForNavigationRefresh)
      .when(historyPushStateTriggered)
      .when(pendingNavigationRefreshElapsed)
      .then(expectUnsolicitedTreeSnapshotAfterNavigation);
  });

  test('posts preview path update after client-side navigation once HELLO is established', () => {
    return given(contextCreated())
      .when(bridgeInitialized)
      .when(locationSetToAuthLoginPath)
      .when(hostSendsHello)
      .when(historyPushStateTriggeredWithPathChange)
      .then(previewPathUpdatePostedAfterNavigation);
  });

  test('posts a follow-up unsolicited TREE_SNAPSHOT to capture async tree updates after navigation', () => {
    return given(contextCreated())
      .when(clockConfigured)
      .when(bridgeInitialized)
      .when(hostSendsHelloWithNavigationSession)
      .when(historyPushStateTriggered)
      .when(pendingNavigationRefreshElapsed)
      .when(treeSnapshotUpdatedForAsyncNavigationCompletion)
      .when(followUpNavigationRefreshElapsed)
      .then(
        expectFollowUpUnsolicitedTreeSnapshotAfterAsyncNavigationCompletion,
      );
  });

  test('responds with SNAPSHOT when receiving REQUEST_SNAPSHOT', () => {
    return given(contextCreated())
      .when(bridgeInitialized)
      .when(hostSendsRequestSnapshot)
      .then(expectSnapshotResponse);
  });

  test('responds with XML-decodable SNAPSHOT capture when body includes void HTML elements', () => {
    return given(contextCreated())
      .when(bodyPreparedWithVoidHtmlElements)
      .when(bridgeInitialized)
      .when(hostSendsRequestSnapshot)
      .then(expectSnapshotResponse)
      .then(expectSnapshotCaptureSvgIsXmlDecodable);
  });

  test('responds with full SNAPSHOT html payload without character truncation', () => {
    return given(contextCreated())
      .when(bodyPreparedWithLongHtmlMarkup)
      .when(bridgeInitialized)
      .when(hostSendsRequestSnapshot)
      .then(expectSnapshotResponse)
      .then(expectSnapshotResponseHtmlIncludesFullDocumentMarkup);
  });

  test('responds with TREE_SNAPSHOT when tree adapter is resolved from adapter factory', () => {
    return given(contextCreated())
      .when(bridgeInitializedWithFactoryAdapterOnly)
      .when(hostSendsRequestTree)
      .then(expectTreeSnapshotResponseFromFactoryAdapter);
  });

  test('responds with TREE_SNAPSHOT when factory adapter runtime target is vite', () => {
    return given(contextCreated())
      .when(factoryRuntimeAdapterConfiguredAsVite)
      .when(bridgeInitializedWithFactoryAdapterOnly)
      .when(hostSendsRequestTree)
      .then(expectTreeSnapshotResponseFromFactoryAdapter);
  });

  test('responds with TREE_SNAPSHOT when factory adapter runtime target is cra', () => {
    return given(contextCreated())
      .when(factoryRuntimeAdapterConfiguredAsCra)
      .when(bridgeInitializedWithFactoryAdapterOnly)
      .when(hostSendsRequestTree)
      .then(expectTreeSnapshotResponseFromFactoryAdapter);
  });

  test('responds with fiber TREE_SNAPSHOT when runtime target is fiber and devtools roots are available', () => {
    return given(contextCreated())
      .when(domPreparedWithViteRootElement)
      .when(fiberHookConfiguredWithComponentTree)
      .when(bridgeInitializedWithBuiltInFiberRuntime)
      .when(hostSendsRequestTree)
      .then(expectTreeSnapshotResponseFromBuiltInFiberRuntime);
  });

  test('preserves request and session correlation across HELLO, fiber REQUEST_TREE, and fiber REQUEST_NODE_PROPS', () => {
    return given(contextCreated())
      .when(domPreparedWithViteRootElement)
      .when(fiberHookConfiguredWithSensitiveMemoizedProps)
      .when(bridgeInitializedWithBuiltInFiberRuntime)
      .when(hostSendsHelloThenRequestFiberTreeThenRequestFiberNodeProps)
      .then(expectFiberCorrelationAcrossHelloTreeAndPropsRequests);
  });

  test('falls back to deterministic tag adapter TREE_SNAPSHOT when runtime target is fiber and devtools roots are unavailable', () => {
    return given(contextCreated())
      .when(domPreparedWithViteRootElement)
      .when(bridgeInitializedWithBuiltInFiberRuntime)
      .when(hostSendsRequestTree)
      .then(expectTreeSnapshotResponseFromBuiltInFiberFallback);
  });

  test('responds with serialized and redacted NODE_PROPS when runtime target is fiber and node props come from memoizedProps', () => {
    return given(contextCreated())
      .when(domPreparedWithViteRootElement)
      .when(fiberHookConfiguredWithSensitiveMemoizedProps)
      .when(bridgeInitializedWithBuiltInFiberRuntime)
      .when(hostSendsRequestTreeThenRequestNodePropsForFiberAppShell)
      .then(expectFiberNodePropsResponseToBeSerializedAndRedacted);
  });

  test('handles mixed per-node props and highlight outcomes without interrupting the fiber session', () => {
    return given(contextCreated())
      .when(domPreparedWithViteRootElement)
      .when(fiberHookConfiguredWithMixedOperationOutcomes)
      .when(bridgeInitializedWithBuiltInFiberRuntime)
      .when(hostSendsRequestTreeThenMixedFiberNodeOperations)
      .then(expectMixedFiberNodeOperationsToRemainFailSoftPerNode);
  });

  test('keeps fallback adapter node operations functional when fiber runtime node operations are unavailable', () => {
    return given(contextCreated())
      .when(domPreparedWithViteRootElement)
      .when(bridgeInitializedWithBuiltInFiberRuntime)
      .when(hostSendsRequestTreeThenFallbackNodeOperations)
      .then(expectFiberFallbackNodeOperationsToRemainFunctional);
  });

  test('prefers explicit tree adapter over adapter factory result', () => {
    return given(contextCreated())
      .when(bridgeInitializedWithTreeAdapterAndFactory)
      .when(hostSendsRequestTree)
      .then(expectTreeAdapterOverridesFactoryAdapter);
  });

  test('responds with truncated TREE_SNAPSHOT metadata when receiving oversized REQUEST_TREE snapshot', () => {
    return given(contextCreated())
      .when(treeSnapshotExceedsNodeCap)
      .when(bridgeInitialized)
      .when(hostSendsRequestTree)
      .then(expectTruncatedTreeSnapshotResponse);
  });

  test('responds with rootIds that include promoted null-parent nodes when truncation excludes an original parent', () => {
    return given(contextCreated())
      .when(treeSnapshotIncludesChildWithExcludedParent)
      .when(bridgeInitialized)
      .when(hostSendsRequestTree)
      .then(expectTruncatedTreeSnapshotRootsContainPromotedNodes);
  });

  test('responds with TREE_SNAPSHOT metadata when truncation metadata is already present on adapter snapshot', () => {
    return given(contextCreated())
      .when(treeSnapshotConfiguredWithTraversalTruncationMeta)
      .when(bridgeInitialized)
      .when(hostSendsRequestTree)
      .then(expectTreeSnapshotResponseWithTraversalTruncationMeta);
  });

  test('responds with NODE_PROPS when receiving REQUEST_NODE_PROPS for known node', () => {
    return given(contextCreated())
      .when(bridgeInitialized)
      .when(hostSendsRequestNodePropsForRootNode)
      .then(expectNodePropsResponse);
  });

  test('responds with ERR_NODE_NOT_FOUND when receiving REQUEST_NODE_PROPS for unknown node', () => {
    return given(contextCreated())
      .when(bridgeInitialized)
      .when(hostSendsRequestNodePropsForUnknownNode)
      .then(expectNodeNotFoundErrorResponse);
  });

  test('highlights node when receiving HIGHLIGHT_NODE for known node', () => {
    return given(contextCreated())
      .when(bridgeInitialized)
      .when(hostSendsHighlightNodeForRootNode)
      .then(expectHighlightOverlayVisibleForRootNode);
  });

  test('responds with ERR_NODE_NOT_FOUND when receiving HIGHLIGHT_NODE for unknown node', () => {
    return given(contextCreated())
      .when(bridgeInitialized)
      .when(hostSendsHighlightNodeForUnknownNode)
      .then(expectHighlightNodeNotFoundErrorResponse);
  });

  test('clears stale overlay when receiving HIGHLIGHT_NODE for unknown node', () => {
    return given(contextCreated())
      .when(bridgeInitialized)
      .when(hostSendsHighlightNodeForRootNode)
      .when(hostSendsHighlightNodeForUnknownNode)
      .then(expectStaleHighlightToBeClearedWhenUnknownNodeRequested);
  });

  test('clears highlighted node overlay when receiving CLEAR_HIGHLIGHT', () => {
    return given(contextCreated())
      .when(bridgeInitialized)
      .when(hostSendsHighlightNodeForRootNode)
      .when(hostSendsClearHighlight)
      .then(expectHighlightOverlayHidden);
  });

  test('does not process HELLO when kill switch is active', () => {
    return given(contextCreated())
      .when(consoleWarnMocked)
      .when(bridgeInitializedWithKillSwitchActive)
      .when(hostSendsHello)
      .then(expectNoMessagesPosted)
      .then(expectKillSwitchDisableLog);
  });

  test('stops processing HELLO after kill switch is activated at runtime', () => {
    return given(contextCreated())
      .when(bridgeInitialized)
      .when(bridgeReinitializedWithKillSwitchActive)
      .when(hostSendsHello)
      .then(expectNoMessagesPosted);
  });

  test('does not invoke adapter factory when bridge is disabled by kill switch', () => {
    return given(contextCreated())
      .when(bridgeInitializedWithKillSwitchAndThrowingAdapterFactory)
      .when(hostSendsHello)
      .then(expectNoMessagesPosted)
      .then(expectAdapterFactoryNotCalled);
  });

  test('does not respond to REQUEST_TREE when tree adapter is missing', () => {
    return given(contextCreated())
      .when(bridgeInitializedWithoutTreeAdapter)
      .when(hostSendsRequestTree)
      .then(expectNoMessagesPosted);
  });

  test('ignores untrusted host origin', () => {
    return given(contextCreated())
      .when(bridgeInitialized)
      .when(untrustedHostSendsHello)
      .then(expectNoMessagesPosted);
  });

  test('emits origin rejection telemetry for inspector messages from untrusted host origin', () => {
    return given(contextCreated())
      .when(bridgeTelemetryConfigured)
      .when(bridgeInitialized)
      .when(untrustedHostSendsHello)
      .then(expectNoMessagesPosted)
      .then(expectOriginRejectTelemetry);
  });

  test('stops handling messages after destroy', () => {
    return given(contextCreated())
      .when(bridgeInitialized)
      .when(bridgeDestroyed)
      .when(hostSendsHello)
      .then(expectNoMessagesPosted);
  });
});
