import { given } from '#test/givenWhenThen';
import {
  DEFAULT_FIBER_TRAVERSAL_BUDGET,
  traverseDiscoveredFiberRoots,
  traverseFiberRoots,
  type FiberTraversalResult,
} from './traversal';
import type { FiberRootRef, RootDiscoveryResult } from './types';

const FUNCTION_COMPONENT_TAG = 0;
const CLASS_COMPONENT_TAG = 1;
const INDETERMINATE_COMPONENT_TAG = 2;
const HOST_ROOT_TAG = 3;
const HOST_COMPONENT_TAG = 5;
const FORWARD_REF_COMPONENT_TAG = 11;
const MEMO_COMPONENT_TAG = 14;

type MockFiber = {
  tag?: unknown;
  debugName?: string;
  child?: unknown;
  sibling?: unknown;
  return?: unknown;
};

type TraversalContext = {
  roots: FiberRootRef[];
  discoveryResult: RootDiscoveryResult;
  traversalBudget?: {
    maxRecords: number;
    maxTraversalSteps: number;
  };
  firstTraversal?: FiberTraversalResult;
  secondTraversal?: FiberTraversalResult;
};

const createMockFiber = (tag: number, debugName: string): MockFiber => {
  return {
    tag,
    debugName,
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

const createRootRef = (rendererId: number, current: unknown): FiberRootRef => {
  return {
    rendererId,
    root: {
      current,
    },
  };
};

const createWrappedRootRef = (
  rendererId: number,
  root: unknown,
): FiberRootRef => {
  return {
    rendererId,
    root,
  };
};

const contextCreated = (): TraversalContext => {
  return {
    roots: [],
    discoveryResult: {
      status: 'unsupported',
      reason: 'hook-missing',
    },
  };
};

const nestedRootsConfigured = (context: TraversalContext): TraversalContext => {
  const hostRootOne = createMockFiber(HOST_ROOT_TAG, 'HostRootOne');
  const hostWrapper = createMockFiber(HOST_COMPONENT_TAG, 'HostWrapper');
  const appShell = createMockFiber(FUNCTION_COMPONENT_TAG, 'AppShell');
  const hostContainer = createMockFiber(HOST_COMPONENT_TAG, 'HostContainer');
  const toolbarButton = createMockFiber(
    FORWARD_REF_COMPONENT_TAG,
    'ToolbarButton',
  );
  const memoPanel = createMockFiber(MEMO_COMPONENT_TAG, 'MemoPanel');
  const domCarrier = createMockFiber(HOST_COMPONENT_TAG, 'DomCarrier');
  const inlineBoundary = createMockFiber(
    INDETERMINATE_COMPONENT_TAG,
    'InlineBoundary',
  );
  const settingsPanel = createMockFiber(CLASS_COMPONENT_TAG, 'SettingsPanel');
  const hostRootTwo = createMockFiber(HOST_ROOT_TAG, 'HostRootTwo');
  const lateRendererNode = createMockFiber(
    FUNCTION_COMPONENT_TAG,
    'LateRendererNode',
  );

  connectFiberChildren(hostRootOne, [hostWrapper]);
  connectFiberChildren(hostWrapper, [appShell, domCarrier, settingsPanel]);
  connectFiberChildren(appShell, [hostContainer]);
  connectFiberChildren(hostContainer, [toolbarButton, memoPanel]);
  connectFiberChildren(domCarrier, [inlineBoundary]);
  connectFiberChildren(hostRootTwo, [lateRendererNode]);

  context.roots = [
    createRootRef(2, hostRootTwo),
    createRootRef(1, hostRootOne),
  ];
  context.discoveryResult = {
    status: 'ok',
    renderers: [
      {
        rendererId: 1,
        renderer: {
          name: 'renderer-one',
        },
      },
      {
        rendererId: 2,
        renderer: {
          name: 'renderer-two',
        },
      },
    ],
    roots: context.roots,
  };

  return context;
};

const malformedAndCyclicRootsConfigured = (
  context: TraversalContext,
): TraversalContext => {
  const hostRoot = createMockFiber(HOST_ROOT_TAG, 'HostRoot');
  const primaryNode = createMockFiber(FUNCTION_COMPONENT_TAG, 'PrimaryNode');
  const secondaryNode = createMockFiber(
    FUNCTION_COMPONENT_TAG,
    'SecondaryNode',
  );

  connectFiberChildren(hostRoot, [primaryNode]);
  connectFiberChildren(primaryNode, [secondaryNode]);
  secondaryNode.sibling = primaryNode;
  secondaryNode.child = 'broken-child-link';

  const throwingRoot = {} as Record<string, unknown>;
  Object.defineProperty(throwingRoot, 'current', {
    configurable: true,
    get() {
      throw new Error('current getter failed');
    },
  });

  context.roots = [
    {
      rendererId: 1,
      root: null,
    },
    {
      rendererId: 1,
      root: {},
    },
    {
      rendererId: 1,
      root: {
        current: 'invalid-current',
      },
    },
    {
      rendererId: 1,
      root: throwingRoot,
    },
    createRootRef(1, hostRoot),
  ];

  return context;
};

const unsupportedDiscoveryConfigured = (
  context: TraversalContext,
): TraversalContext => {
  context.discoveryResult = {
    status: 'unsupported',
    reason: 'fiber-roots-reader-missing',
  };

  return context;
};

const largeLinearComponentTreeConfigured = (
  context: TraversalContext,
): TraversalContext => {
  const hostRoot = createMockFiber(HOST_ROOT_TAG, 'HostRoot');
  const hostContainer = createMockFiber(HOST_COMPONENT_TAG, 'HostContainer');
  const componentNodes = Array.from({ length: 40 }, (_, index) => {
    return createMockFiber(FUNCTION_COMPONENT_TAG, `LinearNode${index}`);
  });

  connectFiberChildren(hostRoot, [hostContainer]);
  connectFiberChildren(hostContainer, componentNodes);

  context.roots = [createRootRef(1, hostRoot)];
  context.traversalBudget = {
    maxRecords: 10,
    maxTraversalSteps: 1_000,
  };

  return context;
};

const wrappedRootContainerConfigured = (
  context: TraversalContext,
): TraversalContext => {
  const hostRoot = createMockFiber(HOST_ROOT_TAG, 'HostRoot');
  const hostContainer = createMockFiber(HOST_COMPONENT_TAG, 'HostContainer');
  const appShell = createMockFiber(FUNCTION_COMPONENT_TAG, 'AppShell');

  connectFiberChildren(hostRoot, [hostContainer]);
  connectFiberChildren(hostContainer, [appShell]);

  const deeplyWrappedRootContainer = {
    stageOne: {
      stageTwo: {
        stageThree: {
          _internalRoot: {
            current: {
              stateNode: hostRoot,
            },
          },
        },
      },
    },
  } as Record<string, unknown>;

  Object.defineProperty(deeplyWrappedRootContainer, 'unstableGetter', {
    configurable: true,
    enumerable: true,
    get() {
      throw new Error('unstable root getter');
    },
  });

  context.roots = [createWrappedRootRef(1, deeplyWrappedRootContainer)];
  context.traversalBudget = {
    maxRecords: 10,
    maxTraversalSteps: 1_000,
  };

  return context;
};

const taggedFiberRootContainerConfigured = (
  context: TraversalContext,
): TraversalContext => {
  const hostRoot = createMockFiber(HOST_ROOT_TAG, 'HostRoot');
  const hostContainer = createMockFiber(HOST_COMPONENT_TAG, 'HostContainer');
  const appShell = createMockFiber(FUNCTION_COMPONENT_TAG, 'AppShell');

  connectFiberChildren(hostRoot, [hostContainer]);
  connectFiberChildren(hostContainer, [appShell]);

  context.roots = [
    createWrappedRootRef(1, {
      tag: 1,
      current: hostRoot,
      containerInfo: {
        nodeType: 1,
      },
    }),
  ];
  context.traversalBudget = {
    maxRecords: 10,
    maxTraversalSteps: 1_000,
  };

  return context;
};

const deepHostOnlyTreeConfigured = (
  context: TraversalContext,
): TraversalContext => {
  const hostRoot = createMockFiber(HOST_ROOT_TAG, 'HostRoot');
  const lateComponentNode = createMockFiber(
    FUNCTION_COMPONENT_TAG,
    'LateComponent',
  );
  let previousHostNode = hostRoot;

  for (let index = 0; index < 12; index += 1) {
    const nextHostNode = createMockFiber(
      HOST_COMPONENT_TAG,
      `HostNode${index}`,
    );
    connectFiberChildren(previousHostNode, [nextHostNode]);
    previousHostNode = nextHostNode;
  }

  connectFiberChildren(previousHostNode, [lateComponentNode]);

  context.roots = [createRootRef(1, hostRoot)];
  context.traversalBudget = {
    maxRecords: 50,
    maxTraversalSteps: 5,
  };

  return context;
};

const traversalExecuted = (context: TraversalContext): TraversalContext => {
  context.firstTraversal = traverseFiberRoots(context.roots);

  return context;
};

const traversalExecutedAgain = (
  context: TraversalContext,
): TraversalContext => {
  context.secondTraversal = traverseFiberRoots(context.roots);

  return context;
};

const traversalExecutedFromDiscovery = (
  context: TraversalContext,
): TraversalContext => {
  context.firstTraversal = traverseDiscoveredFiberRoots(
    context.discoveryResult,
  );

  return context;
};

const traversalExecutedWithBudget = (
  context: TraversalContext,
): TraversalContext => {
  context.firstTraversal = traverseFiberRoots(
    context.roots,
    context.traversalBudget,
  );

  return context;
};

const traversalExecutedAgainWithBudget = (
  context: TraversalContext,
): TraversalContext => {
  context.secondTraversal = traverseFiberRoots(
    context.roots,
    context.traversalBudget,
  );

  return context;
};

const toFiberDebugName = (fiber: unknown) => {
  if (typeof fiber !== 'object' || fiber === null) {
    return 'unknown';
  }

  const debugName = (fiber as Record<string, unknown>).debugName;

  return typeof debugName === 'string' ? debugName : 'unknown';
};

const expectNestedTraversalToBeDeterministicAndOrdered = (
  context: TraversalContext,
) => {
  expect(context.firstTraversal).toEqual(context.secondTraversal);

  const records = context.firstTraversal?.records ?? [];
  const recordByKey = new Map(records.map((record) => [record.key, record]));
  const recordNames = records.map((record) => toFiberDebugName(record.fiber));

  expect(recordNames).toEqual([
    'AppShell',
    'ToolbarButton',
    'MemoPanel',
    'InlineBoundary',
    'SettingsPanel',
    'LateRendererNode',
  ]);
  expect(records.map((record) => record.rendererId)).toEqual([
    1, 1, 1, 1, 1, 2,
  ]);
  expect(records.map((record) => record.rendererRootIndex)).toEqual([
    0, 0, 0, 0, 0, 0,
  ]);
  expect(records.map((record) => record.path)).toEqual([
    '0.0.0',
    '0.0.0.0.0',
    '0.0.0.0.1',
    '0.0.1.0',
    '0.0.2',
    '0.0',
  ]);

  const parentNames = records.map((record) => {
    if (record.parentKey === null) {
      return null;
    }

    return toFiberDebugName(recordByKey.get(record.parentKey)?.fiber);
  });

  expect(parentNames).toEqual([null, 'AppShell', 'AppShell', null, null, null]);

  const appShellRecord = records[0];

  expect(
    appShellRecord.childKeys.map((key) => {
      return toFiberDebugName(recordByKey.get(key)?.fiber);
    }),
  ).toEqual(['ToolbarButton', 'MemoPanel']);

  expect(
    (context.firstTraversal?.rootRecordKeys ?? []).map((key) => {
      return toFiberDebugName(recordByKey.get(key)?.fiber);
    }),
  ).toEqual([
    'AppShell',
    'InlineBoundary',
    'SettingsPanel',
    'LateRendererNode',
  ]);
  expect(context.firstTraversal?.meta).toEqual({
    truncated: false,
    exhaustedBy: null,
    includedRecordCount: 6,
    traversalStepCount: expect.any(Number),
    budget: DEFAULT_FIBER_TRAVERSAL_BUDGET,
  });
};

const expectMalformedAndCyclicTraversalToRemainBounded = (
  context: TraversalContext,
) => {
  const records = context.firstTraversal?.records ?? [];
  const recordByKey = new Map(records.map((record) => [record.key, record]));

  expect(records.map((record) => toFiberDebugName(record.fiber))).toEqual([
    'PrimaryNode',
    'SecondaryNode',
  ]);
  expect(records).toHaveLength(2);
  expect(
    (context.firstTraversal?.rootRecordKeys ?? []).map((key) => {
      return toFiberDebugName(recordByKey.get(key)?.fiber);
    }),
  ).toEqual(['PrimaryNode']);

  const primaryRecord = records[0];
  const secondaryRecord = records[1];

  expect(primaryRecord.childKeys).toEqual([secondaryRecord.key]);
  expect(secondaryRecord.childKeys).toEqual([]);
  expect(context.firstTraversal?.meta).toEqual({
    truncated: false,
    exhaustedBy: null,
    includedRecordCount: 2,
    traversalStepCount: expect.any(Number),
    budget: DEFAULT_FIBER_TRAVERSAL_BUDGET,
  });
};

const expectUnsupportedDiscoveryToReturnEmptyTraversal = (
  context: TraversalContext,
) => {
  expect(context.firstTraversal).toEqual({
    records: [],
    rootRecordKeys: [],
    meta: {
      truncated: false,
      exhaustedBy: null,
      includedRecordCount: 0,
      traversalStepCount: 0,
      budget: DEFAULT_FIBER_TRAVERSAL_BUDGET,
    },
  });
};

const expectRecordBudgetTruncationToBeDeterministic = (
  context: TraversalContext,
) => {
  expect(context.firstTraversal).toEqual(context.secondTraversal);

  const records = context.firstTraversal?.records ?? [];
  const recordNames = records.map((record) => toFiberDebugName(record.fiber));

  expect(recordNames).toEqual([
    'LinearNode0',
    'LinearNode1',
    'LinearNode2',
    'LinearNode3',
    'LinearNode4',
    'LinearNode5',
    'LinearNode6',
    'LinearNode7',
    'LinearNode8',
    'LinearNode9',
  ]);
  expect(context.firstTraversal?.meta).toEqual({
    truncated: true,
    exhaustedBy: 'record-limit',
    includedRecordCount: 10,
    traversalStepCount: expect.any(Number),
    budget: {
      maxRecords: 10,
      maxTraversalSteps: 1_000,
    },
  });
};

const expectStepBudgetTruncationToBeDeterministic = (
  context: TraversalContext,
) => {
  expect(context.firstTraversal).toEqual(context.secondTraversal);
  expect(context.firstTraversal?.records).toEqual([]);
  expect(context.firstTraversal?.meta).toEqual({
    truncated: true,
    exhaustedBy: 'step-limit',
    includedRecordCount: 0,
    traversalStepCount: 5,
    budget: {
      maxRecords: 50,
      maxTraversalSteps: 5,
    },
  });
};

const expectWrappedRootTraversalToReachComponents = (
  context: TraversalContext,
) => {
  const records = context.firstTraversal?.records ?? [];

  expect(records.map((record) => toFiberDebugName(record.fiber))).toEqual([
    'AppShell',
  ]);
};

describe('traversal', () => {
  test('should traverse component fibers deterministically with stable sibling ordering and parent links', () => {
    return given(contextCreated)
      .when(nestedRootsConfigured)
      .when(traversalExecuted)
      .when(traversalExecutedAgain)
      .then(expectNestedTraversalToBeDeterministicAndOrdered);
  });

  test('should fail soft when roots or links are malformed and keep cycle traversal bounded', () => {
    return given(contextCreated)
      .when(malformedAndCyclicRootsConfigured)
      .when(traversalExecuted)
      .then(expectMalformedAndCyclicTraversalToRemainBounded);
  });

  test('should return an empty traversal when discovery result is not ok', () => {
    return given(contextCreated)
      .when(unsupportedDiscoveryConfigured)
      .when(traversalExecutedFromDiscovery)
      .then(expectUnsupportedDiscoveryToReturnEmptyTraversal);
  });

  test('should deterministically truncate traversal when record budget is exhausted on large trees', () => {
    return given(contextCreated)
      .when(largeLinearComponentTreeConfigured)
      .when(traversalExecutedWithBudget)
      .when(traversalExecutedAgainWithBudget)
      .then(expectRecordBudgetTruncationToBeDeterministic);
  });

  test('should deterministically truncate traversal when traversal-step budget is exhausted', () => {
    return given(contextCreated)
      .when(deepHostOnlyTreeConfigured)
      .when(traversalExecutedWithBudget)
      .when(traversalExecutedAgainWithBudget)
      .then(expectStepBudgetTruncationToBeDeterministic);
  });

  test('should traverse wrapped root containers with deep wrapper levels and throwing getters', () => {
    return given(contextCreated)
      .when(wrappedRootContainerConfigured)
      .when(traversalExecutedWithBudget)
      .then(expectWrappedRootTraversalToReachComponents);
  });

  test('should resolve tagged FiberRoot containers via current before traversal', () => {
    return given(contextCreated)
      .when(taggedFiberRootContainerConfigured)
      .when(traversalExecutedWithBudget)
      .then(expectWrappedRootTraversalToReachComponents);
  });
});
