import { buildMessage } from '@iteraai/inspector-protocol';
import { inspectorHighlightOverlaySelector } from '../../inspector-runtime-core/src/highlighter';
import { MAX_TREE_SNAPSHOT_NODE_COUNT } from '../../inspector-runtime-core/src/treeAdapter';
import { destroyInspectorBridge, initInspectorBridge } from './bridgeRuntime';
import type { AngularDevModeGlobalsApi } from './adapters/angular';

type SourceDouble = {
  postMessage: ReturnType<typeof vi.fn>;
};

type AngularComponentRegistration = {
  component: object;
  hostElement: Element;
  owner?: object | null;
  componentElements?: readonly Element[];
  directiveMetadata?: Record<string, unknown> | null;
};

type WindowWithAngularGlobals = Window & {
  ng?: AngularDevModeGlobalsApi;
};

const createSourceDouble = (): SourceDouble => {
  return {
    postMessage: vi.fn(),
  };
};

const createAngularComponentDouble = (displayName: string) => {
  return Object.defineProperty({}, 'constructor', {
    configurable: true,
    value: {
      name: displayName,
    },
  });
};

const createAngularGlobalsDouble = (
  registrations: readonly AngularComponentRegistration[],
): AngularDevModeGlobalsApi => {
  const componentByElement = new Map<Element, object>();
  const hostElementByComponent = new Map<object, Element>();
  const ownerByTarget = new Map<Element | object, object | null>();
  const directiveMetadataByComponent = new Map<
    object,
    Record<string, unknown> | null
  >();

  registrations.forEach((registration) => {
    componentByElement.set(registration.hostElement, registration.component);
    registration.componentElements?.forEach((element) => {
      componentByElement.set(element, registration.component);
    });
    hostElementByComponent.set(registration.component, registration.hostElement);
    ownerByTarget.set(registration.component, registration.owner ?? null);
    ownerByTarget.set(registration.hostElement, registration.owner ?? null);
    directiveMetadataByComponent.set(
      registration.component,
      registration.directiveMetadata ?? null,
    );
  });

  return {
    getComponent: vi.fn((target: Element) => {
      return componentByElement.get(target) ?? null;
    }),
    getOwningComponent: vi.fn((target: Element | object) => {
      return ownerByTarget.get(target) ?? null;
    }),
    getHostElement: vi.fn((target: object) => {
      return hostElementByComponent.get(target) ?? null;
    }),
    getDirectiveMetadata: vi.fn((target: object) => {
      return directiveMetadataByComponent.get(target) ?? null;
    }),
  };
};

const postHostMessage = (options: {
  hostOrigin: string;
  source: SourceDouble;
  type: 'HELLO' | 'REQUEST_TREE' | 'REQUEST_NODE_PROPS' | 'HIGHLIGHT_NODE';
  nodeId?: string;
}) => {
  window.dispatchEvent(
    new MessageEvent('message', {
      origin: options.hostOrigin,
      source: options.source as unknown as MessageEventSource,
      data: buildMessage(
        options.type,
        options.type === 'HELLO'
          ? {
              capabilities: ['host-tree'],
            }
          : options.type === 'REQUEST_NODE_PROPS' ||
              options.type === 'HIGHLIGHT_NODE'
            ? {
                nodeId: options.nodeId as string,
              }
            : {},
      ),
    }),
  );
};

const getPostedMessagesByType = <TPayload>(
  source: SourceDouble,
  type: string,
) => {
  return source.postMessage.mock.calls.flatMap(([message]) => {
    if (
      typeof message !== 'object' ||
      message === null ||
      (message as { type?: string }).type !== type
    ) {
      return [];
    }

    return [message as { type: string; payload: TPayload }];
  });
};

const toNodeByDisplayName = (
  payload: {
    nodes: Array<{
      id: string;
      displayName: string;
      parentId: string | null;
      childrenIds: string[];
      tags?: string[];
    }>;
  },
) => {
  return new Map(payload.nodes.map((node) => [node.displayName, node]));
};

const toRootDisplayNames = (payload: {
  nodes: Array<{
    id: string;
    displayName: string;
    parentId: string | null;
    childrenIds: string[];
  }>;
  rootIds: string[];
}) => {
  const nodeById = new Map(payload.nodes.map((node) => [node.id, node]));

  return payload.rootIds.flatMap((rootId) => {
    const node = nodeById.get(rootId);

    return node === undefined ? [] : [node.displayName];
  });
};

const toChildDisplayNames = (
  payload: {
    nodes: Array<{
      id: string;
      displayName: string;
      parentId: string | null;
      childrenIds: string[];
    }>;
  },
  displayName: string,
) => {
  const nodeById = new Map(payload.nodes.map((node) => [node.id, node]));
  const parentNode = payload.nodes.find((node) => node.displayName === displayName);

  return (
    parentNode?.childrenIds.flatMap((childId) => {
      const childNode = nodeById.get(childId);

      return childNode === undefined ? [] : [childNode.displayName];
    }) ?? []
  );
};

const windowWithAngularGlobals = window as WindowWithAngularGlobals;

afterEach(() => {
  destroyInspectorBridge();
  delete windowWithAngularGlobals.ng;
  document.body.innerHTML = '';
  vi.restoreAllMocks();
});

test('bridge initialization stays safe and returns an empty snapshot when window.ng is unavailable', () => {
  const hostOrigin = 'https://app.iteradev.ai';
  const source = createSourceDouble();

  initInspectorBridge({
    hostOrigins: [hostOrigin],
    enabled: true,
    capabilities: ['tree', 'props', 'highlight'],
  });

  window.dispatchEvent(
    new MessageEvent('message', {
      origin: hostOrigin,
      source: source as unknown as MessageEventSource,
      data: buildMessage('HELLO', {
        capabilities: ['host-tree'],
      }),
    }),
  );
  window.dispatchEvent(
    new MessageEvent('message', {
      origin: hostOrigin,
      source: source as unknown as MessageEventSource,
      data: buildMessage('REQUEST_TREE', {}),
    }),
  );

  const readyCall = source.postMessage.mock.calls.find(
    ([message]) => (message as { type?: string }).type === 'READY',
  );
  const treeSnapshotCall = source.postMessage.mock.calls.find(
    ([message]) => (message as { type?: string }).type === 'TREE_SNAPSHOT',
  );

  expect(readyCall?.[0]).toMatchObject({
    type: 'READY',
    payload: {
      capabilities: ['tree', 'props', 'highlight'],
    },
  });
  expect(treeSnapshotCall?.[0]).toMatchObject({
    type: 'TREE_SNAPSHOT',
    payload: {
      nodes: [],
      rootIds: [],
    },
  });
});

test('bridge returns deterministic Angular tree snapshots with projected ownership, nested app roots, and open shadow-root discovery', () => {
  const hostOrigin = 'https://app.iteradev.ai';
  const source = createSourceDouble();
  const outerShellElement = document.createElement('outer-shell');
  const toolbarPanelElement = document.createElement('toolbar-panel');
  const toolbarLabelElement = document.createElement('span');
  const projectedCardElement = document.createElement('projected-card');
  const nestedAppRootElement = document.createElement('nested-app-root');
  const nestedLeafElement = document.createElement('nested-leaf');
  const shadowAppElement = document.createElement('shadow-app');
  const shadowRoot = shadowAppElement.attachShadow({ mode: 'open' });
  const shadowPanelElement = document.createElement('shadow-panel');
  const outerShellComponent = createAngularComponentDouble('OuterShell');
  const toolbarPanelComponent = createAngularComponentDouble('ToolbarPanel');
  const projectedCardComponent = createAngularComponentDouble('ProjectedCard');
  const nestedAppRootComponent = createAngularComponentDouble('NestedAppRoot');
  const nestedLeafComponent = createAngularComponentDouble('NestedLeaf');
  const shadowAppComponent = createAngularComponentDouble('ShadowApp');
  const shadowPanelComponent = createAngularComponentDouble('ShadowPanel');
  const angularGlobals = createAngularGlobalsDouble([
    {
      component: outerShellComponent,
      hostElement: outerShellElement,
      owner: null,
    },
    {
      component: toolbarPanelComponent,
      hostElement: toolbarPanelElement,
      owner: outerShellComponent,
      componentElements: [toolbarLabelElement],
    },
    {
      component: projectedCardComponent,
      hostElement: projectedCardElement,
      owner: toolbarPanelComponent,
    },
    {
      component: nestedAppRootComponent,
      hostElement: nestedAppRootElement,
      owner: null,
    },
    {
      component: nestedLeafComponent,
      hostElement: nestedLeafElement,
      owner: nestedAppRootComponent,
    },
    {
      component: shadowAppComponent,
      hostElement: shadowAppElement,
      owner: null,
    },
    {
      component: shadowPanelComponent,
      hostElement: shadowPanelElement,
      owner: shadowAppComponent,
    },
  ]);

  toolbarPanelElement.append(toolbarLabelElement);
  nestedAppRootElement.append(nestedLeafElement);
  outerShellElement.append(
    toolbarPanelElement,
    projectedCardElement,
    nestedAppRootElement,
  );
  shadowRoot.append(shadowPanelElement);
  document.body.append(outerShellElement, shadowAppElement);

  initInspectorBridge({
    hostOrigins: [hostOrigin],
    enabled: true,
    capabilities: ['tree', 'props', 'highlight'],
    runtimeConfig: {
      adapter: 'angular-dev-mode-globals',
      angularGlobals,
    },
  });

  postHostMessage({
    hostOrigin,
    source,
    type: 'HELLO',
  });
  postHostMessage({
    hostOrigin,
    source,
    type: 'REQUEST_TREE',
  });
  postHostMessage({
    hostOrigin,
    source,
    type: 'REQUEST_TREE',
  });

  const treeSnapshotMessages = getPostedMessagesByType<{
    nodes: Array<{
      id: string;
      displayName: string;
      parentId: string | null;
      childrenIds: string[];
      tags?: string[];
    }>;
    rootIds: string[];
  }>(source, 'TREE_SNAPSHOT');
  const firstSnapshot = treeSnapshotMessages[0]?.payload;
  const secondSnapshot = treeSnapshotMessages[1]?.payload;
  const nodeByDisplayName = toNodeByDisplayName(firstSnapshot as NonNullable<
    typeof firstSnapshot
  >);

  expect(treeSnapshotMessages).toHaveLength(2);
  expect(firstSnapshot).toEqual(secondSnapshot);
  expect(firstSnapshot?.nodes).toHaveLength(7);
  expect(toRootDisplayNames(firstSnapshot as NonNullable<typeof firstSnapshot>)).toEqual([
    'OuterShell',
    'NestedAppRoot',
    'ShadowApp',
  ]);
  expect(toChildDisplayNames(firstSnapshot as NonNullable<typeof firstSnapshot>, 'OuterShell')).toEqual([
    'ToolbarPanel',
  ]);
  expect(toChildDisplayNames(firstSnapshot as NonNullable<typeof firstSnapshot>, 'ToolbarPanel')).toEqual([
    'ProjectedCard',
  ]);
  expect(toChildDisplayNames(firstSnapshot as NonNullable<typeof firstSnapshot>, 'NestedAppRoot')).toEqual([
    'NestedLeaf',
  ]);
  expect(toChildDisplayNames(firstSnapshot as NonNullable<typeof firstSnapshot>, 'ShadowApp')).toEqual([
    'ShadowPanel',
  ]);
  expect(nodeByDisplayName.get('ShadowPanel')?.tags).toEqual([
    'angular',
    'angular-kind:component',
    'angular-host:shadow-panel',
  ]);
});

test('bridge responds with truncated TREE_SNAPSHOT metadata for oversized Angular snapshots', () => {
  const hostOrigin = 'https://app.iteradev.ai';
  const source = createSourceDouble();
  const totalNodeCount = MAX_TREE_SNAPSHOT_NODE_COUNT + 3;
  const angularGlobals = createAngularGlobalsDouble(
    Array.from({ length: totalNodeCount }, (_unused, index) => {
      const hostElement = document.createElement(`oversized-root-${index}`);

      document.body.append(hostElement);

      return {
        component: createAngularComponentDouble(`OversizedRoot${index}`),
        hostElement,
        owner: null,
      };
    }),
  );

  initInspectorBridge({
    hostOrigins: [hostOrigin],
    enabled: true,
    capabilities: ['tree', 'props', 'highlight'],
    runtimeConfig: {
      adapter: 'angular-dev-mode-globals',
      angularGlobals,
    },
  });

  postHostMessage({
    hostOrigin,
    source,
    type: 'HELLO',
  });
  postHostMessage({
    hostOrigin,
    source,
    type: 'REQUEST_TREE',
  });

  const treeSnapshotMessage = getPostedMessagesByType<{
    nodes: Array<{
      id: string;
      displayName: string;
      parentId: string | null;
      childrenIds: string[];
    }>;
    rootIds: string[];
    meta?: {
      truncated?: boolean;
      totalNodeCount?: number;
      includedNodeCount?: number;
      truncatedNodeCount?: number;
    };
  }>(source, 'TREE_SNAPSHOT')[0];

  expect(treeSnapshotMessage?.payload.nodes).toHaveLength(
    MAX_TREE_SNAPSHOT_NODE_COUNT,
  );
  expect(treeSnapshotMessage?.payload.rootIds).toHaveLength(
    MAX_TREE_SNAPSHOT_NODE_COUNT,
  );
  expect(treeSnapshotMessage?.payload.meta).toEqual({
    truncated: true,
    totalNodeCount,
    includedNodeCount: MAX_TREE_SNAPSHOT_NODE_COUNT,
    truncatedNodeCount: totalNodeCount - MAX_TREE_SNAPSHOT_NODE_COUNT,
  });
});

test('bridge serializes Angular node props from public input metadata and highlights projected components via host elements', () => {
  const hostOrigin = 'https://app.iteradev.ai';
  const source = createSourceDouble();
  const outerShellElement = document.createElement('outer-shell');
  const toolbarPanelElement = document.createElement('toolbar-panel');
  const projectedCardElement = document.createElement('projected-card');
  const projectedCardLabelElement = document.createElement('span');
  const outerShellComponent = createAngularComponentDouble('OuterShell');
  const toolbarPanelComponent = Object.assign(
    createAngularComponentDouble('ToolbarPanel'),
    {
      panelTitle: 'Toolbar',
      panelConfig: {
        sections: ['actions', 'activity'],
        collapsed: false,
      },
      actionHandler: function publish() {
        return undefined;
      },
      hostRef: projectedCardElement,
    },
  );
  const projectedCardComponent = createAngularComponentDouble('ProjectedCard');
  const angularGlobals = createAngularGlobalsDouble([
    {
      component: outerShellComponent,
      hostElement: outerShellElement,
      owner: null,
    },
    {
      component: toolbarPanelComponent,
      hostElement: toolbarPanelElement,
      owner: outerShellComponent,
      directiveMetadata: {
        inputs: {
          action: 'actionHandler',
          config: 'panelConfig',
          host: 'hostRef',
          title: 'panelTitle',
        },
      },
    },
    {
      component: projectedCardComponent,
      hostElement: projectedCardElement,
      owner: toolbarPanelComponent,
      componentElements: [projectedCardLabelElement],
    },
  ]);

  projectedCardElement.append(projectedCardLabelElement);
  outerShellElement.append(toolbarPanelElement, projectedCardElement);
  document.body.append(outerShellElement);
  vi.spyOn(projectedCardElement, 'getBoundingClientRect').mockReturnValue({
    bottom: 112,
    height: 78,
    left: 12,
    right: 68,
    top: 34,
    width: 56,
    x: 12,
    y: 34,
    toJSON: () => {
      return {};
    },
  } as DOMRect);

  initInspectorBridge({
    hostOrigins: [hostOrigin],
    enabled: true,
    capabilities: ['tree', 'props', 'highlight'],
    runtimeConfig: {
      adapter: 'angular-dev-mode-globals',
      angularGlobals,
    },
  });

  postHostMessage({
    hostOrigin,
    source,
    type: 'HELLO',
  });
  postHostMessage({
    hostOrigin,
    source,
    type: 'REQUEST_TREE',
  });

  const treeSnapshotMessage = getPostedMessagesByType<{
    nodes: Array<{
      id: string;
      displayName: string;
    }>;
  }>(source, 'TREE_SNAPSHOT')[0];
  const toolbarPanelNodeId = treeSnapshotMessage?.payload.nodes.find(
    (node) => node.displayName === 'ToolbarPanel',
  )?.id;
  const projectedCardNodeId = treeSnapshotMessage?.payload.nodes.find(
    (node) => node.displayName === 'ProjectedCard',
  )?.id;

  postHostMessage({
    hostOrigin,
    source,
    type: 'REQUEST_NODE_PROPS',
    nodeId: toolbarPanelNodeId,
  });

  const nodePropsMessage = getPostedMessagesByType<{
    nodeId: string;
    props: Record<string, unknown>;
    meta: Record<string, unknown>;
  }>(source, 'NODE_PROPS')[0];

  expect(nodePropsMessage?.payload).toEqual({
    nodeId: toolbarPanelNodeId,
    props: {
      action: {
        __iteraType: 'function',
        preview: 'publish',
      },
      config: {
        collapsed: false,
        sections: ['actions', 'activity'],
      },
      host: {
        __iteraType: 'dom-node',
        preview: '<projected-card>',
      },
      title: 'Toolbar',
    },
    meta: {},
  });

  postHostMessage({
    hostOrigin,
    source,
    type: 'HIGHLIGHT_NODE',
    nodeId: projectedCardNodeId,
  });

  expect(angularGlobals.getHostElement).toHaveBeenCalledWith(projectedCardComponent);

  const overlay = document.querySelector(
    inspectorHighlightOverlaySelector,
  ) as HTMLDivElement | null;

  expect(overlay?.style.display).toBe('block');
  expect(overlay?.style.left).toBe('12px');
  expect(overlay?.style.top).toBe('34px');
  expect(overlay?.style.width).toBe('56px');
  expect(overlay?.style.height).toBe('78px');
});

test('bridge preserves missing-node error semantics for Angular props and highlight requests', () => {
  const hostOrigin = 'https://app.iteradev.ai';
  const source = createSourceDouble();
  const toolbarPanelElement = document.createElement('toolbar-panel');
  const toolbarPanelComponent = createAngularComponentDouble('ToolbarPanel');
  const angularGlobals = createAngularGlobalsDouble([
    {
      component: toolbarPanelComponent,
      hostElement: toolbarPanelElement,
      owner: null,
    },
  ]);

  document.body.append(toolbarPanelElement);
  vi.spyOn(toolbarPanelElement, 'getBoundingClientRect').mockReturnValue({
    bottom: 40,
    height: 20,
    left: 10,
    right: 30,
    top: 20,
    width: 20,
    x: 10,
    y: 20,
    toJSON: () => {
      return {};
    },
  } as DOMRect);

  initInspectorBridge({
    hostOrigins: [hostOrigin],
    enabled: true,
    capabilities: ['tree', 'props', 'highlight'],
    runtimeConfig: {
      adapter: 'angular-dev-mode-globals',
      angularGlobals,
    },
  });

  postHostMessage({
    hostOrigin,
    source,
    type: 'HELLO',
  });
  postHostMessage({
    hostOrigin,
    source,
    type: 'REQUEST_TREE',
  });

  const treeSnapshotMessage = getPostedMessagesByType<{
    nodes: Array<{
      id: string;
      displayName: string;
    }>;
  }>(source, 'TREE_SNAPSHOT')[0];
  const toolbarPanelNodeId = treeSnapshotMessage?.payload.nodes.find(
    (node) => node.displayName === 'ToolbarPanel',
  )?.id as string;

  postHostMessage({
    hostOrigin,
    source,
    type: 'HIGHLIGHT_NODE',
    nodeId: toolbarPanelNodeId,
  });

  const overlay = document.querySelector(
    inspectorHighlightOverlaySelector,
  ) as HTMLDivElement | null;

  expect(overlay?.style.display).toBe('block');

  postHostMessage({
    hostOrigin,
    source,
    type: 'REQUEST_NODE_PROPS',
    nodeId: 'missing-node-id',
  });
  postHostMessage({
    hostOrigin,
    source,
    type: 'HIGHLIGHT_NODE',
    nodeId: 'missing-node-id',
  });

  const errorMessages = getPostedMessagesByType<{
    code: string;
    details?: {
      nodeId?: string;
    };
  }>(source, 'ERROR');

  expect(errorMessages.map((message) => message.payload)).toEqual([
    {
      code: 'ERR_NODE_NOT_FOUND',
      message: 'Requested node was not found.',
      details: {
        nodeId: 'missing-node-id',
      },
    },
    {
      code: 'ERR_NODE_NOT_FOUND',
      message: 'Requested node was not found.',
      details: {
        nodeId: 'missing-node-id',
      },
    },
  ]);
  expect(overlay?.style.display).toBe('none');
});
