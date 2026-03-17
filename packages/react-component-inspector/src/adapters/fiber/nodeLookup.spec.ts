import { given } from '#test/givenWhenThen';
import type { ReactTreeSnapshot } from '../base/baseAdapter';
import { createFiberNodeLookup, type FiberNodeLookup } from './nodeLookup';
import type { FiberTraversalResult } from './traversal';

type NodeLookupContext = {
  lookup: FiberNodeLookup;
  traversalResult: FiberTraversalResult;
  nodeIdByRecordKey: Map<string, string>;
  snapshot: ReactTreeSnapshot;
  firstResolvedPayload?: ReturnType<FiberNodeLookup['resolveByNodeId']>;
  secondResolvedPayload?: ReturnType<FiberNodeLookup['resolveByNodeId']>;
  selectionElement?: Element;
  unmatchedElement?: Element;
  componentPath?: ReadonlyArray<string>;
  unmatchedComponentPath?: ReadonlyArray<string>;
};

const createTraversalRecord = (
  key: string,
  options: {
    tag: number;
    fiber: unknown;
    rendererId?: number;
    rendererRootIndex?: number;
    path: string;
    parentKey?: string | null;
    childKeys?: string[];
  },
): FiberTraversalResult['records'][number] => {
  return {
    key,
    rendererId: options.rendererId ?? 1,
    rendererRootIndex: options.rendererRootIndex ?? 0,
    path: options.path,
    tag: options.tag,
    fiber: options.fiber,
    parentKey: options.parentKey ?? null,
    childKeys: options.childKeys ?? [],
  };
};

const contextCreated = (): NodeLookupContext => {
  return {
    lookup: createFiberNodeLookup(),
    traversalResult: {
      records: [],
      rootRecordKeys: [],
    },
    nodeIdByRecordKey: new Map(),
    snapshot: {
      nodes: [],
      rootIds: [],
    },
  };
};

const lookupRefreshedWithConnectedTree = (
  context: NodeLookupContext,
): NodeLookupContext => {
  const appFiber = { type: { displayName: 'App' } };
  const buttonFiber = { type: { displayName: 'Button' } };

  context.traversalResult = {
    records: [
      createTraversalRecord('app', {
        tag: 0,
        fiber: appFiber,
        path: '0.0',
        childKeys: ['button', 'missing'],
      }),
      createTraversalRecord('button', {
        tag: 5,
        fiber: buttonFiber,
        path: '0.0.0',
        parentKey: 'app',
      }),
    ],
    rootRecordKeys: ['app'],
  };
  context.nodeIdByRecordKey = new Map([
    ['app', 'node-app'],
    ['button', 'node-button'],
  ]);
  context.snapshot = {
    nodes: [
      {
        id: 'node-app',
        displayName: 'App',
        parentId: null,
        childrenIds: ['node-button'],
      },
      {
        id: 'node-button',
        displayName: 'Button',
        parentId: 'node-app',
        childrenIds: [],
      },
    ],
    rootIds: ['node-app'],
  };

  context.lookup.refreshFromSnapshot({
    traversalResult: context.traversalResult,
    nodeIdByRecordKey: context.nodeIdByRecordKey,
    snapshot: context.snapshot,
  });

  return context;
};

const currentSnapshotNodesResolved = (
  context: NodeLookupContext,
): NodeLookupContext => {
  context.firstResolvedPayload = context.lookup.resolveByNodeId('node-app');
  context.secondResolvedPayload =
    context.lookup.resolveByNodeId('node-missing');

  return context;
};

const expectConnectedTreeNodeLookupToResolveCurrentIds = (
  context: NodeLookupContext,
) => {
  expect(context.firstResolvedPayload).toMatchObject({
    nodeId: 'node-app',
    recordKey: 'app',
    tag: 0,
    parentNodeId: null,
    childNodeIds: ['node-button'],
    rendererId: 1,
    rendererRootIndex: 0,
    path: '0.0',
  });
  expect(context.secondResolvedPayload).toBeUndefined();
};

const lookupRefreshedWithSecondSnapshotThatDropsNode = (
  context: NodeLookupContext,
): NodeLookupContext => {
  const appFiber = { type: { displayName: 'App' } };

  context.traversalResult = {
    records: [
      createTraversalRecord('app', {
        tag: 0,
        fiber: appFiber,
        path: '0.0',
      }),
    ],
    rootRecordKeys: ['app'],
  };
  context.nodeIdByRecordKey = new Map([['app', 'node-app-v2']]);
  context.snapshot = {
    nodes: [
      {
        id: 'node-app-v2',
        displayName: 'App',
        parentId: null,
        childrenIds: [],
      },
    ],
    rootIds: ['node-app-v2'],
  };

  context.lookup.refreshFromSnapshot({
    traversalResult: context.traversalResult,
    nodeIdByRecordKey: context.nodeIdByRecordKey,
    snapshot: context.snapshot,
  });
  context.firstResolvedPayload = context.lookup.resolveByNodeId('node-app');
  context.secondResolvedPayload = context.lookup.resolveByNodeId('node-app-v2');

  return context;
};

const expectDroppedNodeIdsToFailSoftAfterRefresh = (
  context: NodeLookupContext,
) => {
  expect(context.firstResolvedPayload).toBeUndefined();
  expect(context.secondResolvedPayload).toMatchObject({
    nodeId: 'node-app-v2',
    recordKey: 'app',
  });
};

const lookupRefreshedTwiceWithEquivalentSnapshots = (
  context: NodeLookupContext,
): NodeLookupContext => {
  const appFiber = { type: { displayName: 'App' } };
  const traversalResult: FiberTraversalResult = {
    records: [
      createTraversalRecord('app', {
        tag: 0,
        fiber: appFiber,
        path: '0.0',
      }),
    ],
    rootRecordKeys: ['app'],
  };
  const nodeIdByRecordKey = new Map([['app', 'node-app']]);
  const snapshot: ReactTreeSnapshot = {
    nodes: [
      {
        id: 'node-app',
        displayName: 'App',
        parentId: null,
        childrenIds: [],
      },
    ],
    rootIds: ['node-app'],
  };

  context.lookup.refreshFromSnapshot({
    traversalResult,
    nodeIdByRecordKey,
    snapshot,
  });
  context.firstResolvedPayload = context.lookup.resolveByNodeId('node-app');
  context.lookup.refreshFromSnapshot({
    traversalResult,
    nodeIdByRecordKey,
    snapshot,
  });
  context.secondResolvedPayload = context.lookup.resolveByNodeId('node-app');

  return context;
};

const expectEquivalentRefreshesToStayDeterministic = (
  context: NodeLookupContext,
) => {
  expect(context.firstResolvedPayload).toMatchObject({
    nodeId: 'node-app',
    recordKey: 'app',
    path: '0.0',
  });
  expect(context.secondResolvedPayload).toEqual(context.firstResolvedPayload);
};

const lookupRefreshedWithSelectionElementTree = (
  context: NodeLookupContext,
): NodeLookupContext => {
  const appFiber = { type: { displayName: 'App' } };
  const buttonFiber = {
    type: { displayName: 'ToolbarButton' },
    return: appFiber,
  };
  const hostButtonFiber = { tag: 5, return: buttonFiber };
  const buttonElement = document.createElement('button');
  const nestedLabelElement = document.createElement('span');

  buttonElement.append(nestedLabelElement);
  Object.defineProperty(buttonElement, '__reactFiber$lookup', {
    configurable: true,
    value: hostButtonFiber,
  });

  context.selectionElement = nestedLabelElement;
  context.unmatchedElement = document.createElement('div');
  context.traversalResult = {
    records: [
      createTraversalRecord('app', {
        tag: 0,
        fiber: appFiber,
        path: '0.0',
        childKeys: ['button'],
      }),
      createTraversalRecord('button', {
        tag: 0,
        fiber: buttonFiber,
        path: '0.0.0',
        parentKey: 'app',
      }),
    ],
    rootRecordKeys: ['app'],
  };
  context.nodeIdByRecordKey = new Map([
    ['app', 'node-app'],
    ['button', 'node-button'],
  ]);
  context.snapshot = {
    nodes: [
      {
        id: 'node-app',
        displayName: 'App',
        parentId: null,
        childrenIds: ['node-button'],
      },
      {
        id: 'node-button',
        displayName: 'ToolbarButton',
        parentId: 'node-app',
        childrenIds: [],
      },
    ],
    rootIds: ['node-app'],
  };

  context.lookup.refreshFromSnapshot({
    traversalResult: context.traversalResult,
    nodeIdByRecordKey: context.nodeIdByRecordKey,
    snapshot: context.snapshot,
  });

  return context;
};

const componentPathsResolvedFromDomElements = (
  context: NodeLookupContext,
): NodeLookupContext => {
  context.componentPath = context.lookup.resolveClosestComponentPathForElement(
    context.selectionElement as Element,
  );
  context.unmatchedComponentPath =
    context.lookup.resolveClosestComponentPathForElement(
      context.unmatchedElement as Element,
    );

  return context;
};

const expectDomElementComponentPathResolutionToFailSoft = (
  context: NodeLookupContext,
) => {
  expect(context.componentPath).toEqual(['App', 'ToolbarButton']);
  expect(context.unmatchedComponentPath).toBeUndefined();
};

describe('nodeLookup', () => {
  test('should resolve lookup payloads for node ids from the current snapshot and return undefined for missing ids', () => {
    return given(contextCreated)
      .when(lookupRefreshedWithConnectedTree)
      .when(currentSnapshotNodesResolved)
      .then(expectConnectedTreeNodeLookupToResolveCurrentIds);
  });

  test('should invalidate stale node ids when the lookup is refreshed with a new snapshot', () => {
    return given(contextCreated)
      .when(lookupRefreshedWithConnectedTree)
      .when(lookupRefreshedWithSecondSnapshotThatDropsNode)
      .then(expectDroppedNodeIdsToFailSoftAfterRefresh);
  });

  test('should keep lookup resolution deterministic across equivalent snapshot refreshes', () => {
    return given(contextCreated)
      .when(lookupRefreshedTwiceWithEquivalentSnapshots)
      .then(expectEquivalentRefreshesToStayDeterministic);
  });

  test('should resolve component ancestry from nested DOM elements and fail soft for unmatched elements', () => {
    return given(contextCreated)
      .when(lookupRefreshedWithSelectionElementTree)
      .when(componentPathsResolvedFromDomElements)
      .then(expectDomElementComponentPathResolutionToFailSoft);
  });
});
