import { given } from '#test/givenWhenThen';
import {
  createFiberNodeIdentityAllocator,
  type FiberNodeIdentityAllocator,
} from './nodeIdentity';
import type { FiberTraversalRecord } from './traversal';

const FUNCTION_COMPONENT_TAG = 0;
const FORWARD_REF_COMPONENT_TAG = 11;

type MockFiber = {
  debugName: string;
  alternate?: unknown;
};

type NodeIdentityContext = {
  allocator: FiberNodeIdentityAllocator;
  firstRecords: FiberTraversalRecord[];
  secondRecords: FiberTraversalRecord[];
  thirdRecords: FiberTraversalRecord[];
  firstNodeIdsByRecordKey?: ReadonlyMap<string, string>;
  secondNodeIdsByRecordKey?: ReadonlyMap<string, string>;
  thirdNodeIdsByRecordKey?: ReadonlyMap<string, string>;
};

const createMockFiber = (debugName: string): MockFiber => {
  return {
    debugName,
  };
};

const createAlternateFiberPair = (debugName: string) => {
  const previousFiber = createMockFiber(`${debugName}-previous`);
  const currentFiber = createMockFiber(`${debugName}-current`);

  previousFiber.alternate = currentFiber;
  currentFiber.alternate = previousFiber;

  return {
    previousFiber,
    currentFiber,
  };
};

const createTraversalRecord = (
  key: string,
  fiber: MockFiber,
  options: {
    tag: number;
    parentKey?: string | null;
    childKeys?: string[];
    path: string;
  },
): FiberTraversalRecord => {
  return {
    key,
    rendererId: 1,
    rendererRootIndex: 0,
    path: options.path,
    tag: options.tag,
    fiber,
    parentKey: options.parentKey ?? null,
    childKeys: options.childKeys ?? [],
  };
};

const contextCreated = (): NodeIdentityContext => {
  return {
    allocator: createFiberNodeIdentityAllocator(),
    firstRecords: [],
    secondRecords: [],
    thirdRecords: [],
  };
};

const stableRecordsConfigured = (
  context: NodeIdentityContext,
): NodeIdentityContext => {
  const appShellFiber = createMockFiber('AppShell');
  const toolbarFiber = createMockFiber('ToolbarButton');

  context.firstRecords = [
    createTraversalRecord('first-app-shell', appShellFiber, {
      tag: FUNCTION_COMPONENT_TAG,
      path: '0.0.0',
      childKeys: ['first-toolbar-button'],
    }),
    createTraversalRecord('first-toolbar-button', toolbarFiber, {
      tag: FORWARD_REF_COMPONENT_TAG,
      parentKey: 'first-app-shell',
      path: '0.0.0.0',
    }),
  ];
  context.secondRecords = [
    createTraversalRecord('second-app-shell', appShellFiber, {
      tag: FUNCTION_COMPONENT_TAG,
      path: '0.0.0',
      childKeys: ['second-toolbar-button'],
    }),
    createTraversalRecord('second-toolbar-button', toolbarFiber, {
      tag: FORWARD_REF_COMPONENT_TAG,
      parentKey: 'second-app-shell',
      path: '0.0.0.0',
    }),
  ];

  return context;
};

const alternateFiberRecordsConfigured = (
  context: NodeIdentityContext,
): NodeIdentityContext => {
  const appShellFiber = createMockFiber('AppShell-v1');
  const appShellAlternateFiber = createMockFiber('AppShell-v2');

  context.firstRecords = [
    createTraversalRecord('stable-app-shell-record', appShellFiber, {
      tag: FUNCTION_COMPONENT_TAG,
      path: '0.0.0',
    }),
  ];
  context.secondRecords = [
    createTraversalRecord('stable-app-shell-record', appShellAlternateFiber, {
      tag: FUNCTION_COMPONENT_TAG,
      path: '0.0.0',
    }),
  ];

  return context;
};

const collisionRecordsConfigured = (
  context: NodeIdentityContext,
): NodeIdentityContext => {
  const alphaFiber = createMockFiber('Alpha');
  const betaFiber = createMockFiber('Beta');
  const gammaFiber = createMockFiber('Gamma');

  context.firstRecords = [
    createTraversalRecord('first-alpha', alphaFiber, {
      tag: FUNCTION_COMPONENT_TAG,
      path: '0.0',
    }),
    createTraversalRecord('first-beta', betaFiber, {
      tag: FUNCTION_COMPONENT_TAG,
      path: '0.1',
    }),
  ];
  context.secondRecords = [
    createTraversalRecord('second-beta', betaFiber, {
      tag: FUNCTION_COMPONENT_TAG,
      path: '0.0',
    }),
    createTraversalRecord('second-alpha', alphaFiber, {
      tag: FUNCTION_COMPONENT_TAG,
      path: '0.1',
    }),
  ];
  context.thirdRecords = [
    createTraversalRecord('third-gamma', gammaFiber, {
      tag: FUNCTION_COMPONENT_TAG,
      path: '0.0',
    }),
    createTraversalRecord('third-alpha', alphaFiber, {
      tag: FUNCTION_COMPONENT_TAG,
      path: '0.1',
    }),
    createTraversalRecord('third-beta', betaFiber, {
      tag: FUNCTION_COMPONENT_TAG,
      path: '0.2',
    }),
  ];

  return context;
};

const siblingInsertionRecordsConfigured = (
  context: NodeIdentityContext,
): NodeIdentityContext => {
  const alphaFiberPair = createAlternateFiberPair('Alpha');
  const betaFiberPair = createAlternateFiberPair('Beta');
  const insertedFiber = createMockFiber('Inserted');

  context.firstRecords = [
    createTraversalRecord('renderer:0:0.0', alphaFiberPair.previousFiber, {
      tag: FUNCTION_COMPONENT_TAG,
      path: '0.0',
    }),
    createTraversalRecord('renderer:0:0.1', betaFiberPair.previousFiber, {
      tag: FUNCTION_COMPONENT_TAG,
      path: '0.1',
    }),
  ];
  context.secondRecords = [
    createTraversalRecord('renderer:0:0.0', insertedFiber, {
      tag: FUNCTION_COMPONENT_TAG,
      path: '0.0',
    }),
    createTraversalRecord('renderer:0:0.1', alphaFiberPair.currentFiber, {
      tag: FUNCTION_COMPONENT_TAG,
      path: '0.1',
    }),
    createTraversalRecord('renderer:0:0.2', betaFiberPair.currentFiber, {
      tag: FUNCTION_COMPONENT_TAG,
      path: '0.2',
    }),
  ];

  return context;
};

const firstAllocationExecuted = (
  context: NodeIdentityContext,
): NodeIdentityContext => {
  context.firstNodeIdsByRecordKey = context.allocator.allocateNodeIds(
    context.firstRecords,
  ).nodeIdByRecordKey;

  return context;
};

const secondAllocationExecuted = (
  context: NodeIdentityContext,
): NodeIdentityContext => {
  context.secondNodeIdsByRecordKey = context.allocator.allocateNodeIds(
    context.secondRecords,
  ).nodeIdByRecordKey;

  return context;
};

const thirdAllocationExecuted = (
  context: NodeIdentityContext,
): NodeIdentityContext => {
  context.thirdNodeIdsByRecordKey = context.allocator.allocateNodeIds(
    context.thirdRecords,
  ).nodeIdByRecordKey;

  return context;
};

const expectStableTreeToKeepNodeIds = (context: NodeIdentityContext) => {
  const firstAppId = context.firstNodeIdsByRecordKey?.get('first-app-shell');
  const firstToolbarId = context.firstNodeIdsByRecordKey?.get(
    'first-toolbar-button',
  );
  const secondAppId = context.secondNodeIdsByRecordKey?.get('second-app-shell');
  const secondToolbarId = context.secondNodeIdsByRecordKey?.get(
    'second-toolbar-button',
  );

  expect(firstAppId).toBeDefined();
  expect(firstToolbarId).toBeDefined();
  expect(secondAppId).toBe(firstAppId);
  expect(secondToolbarId).toBe(firstToolbarId);
};

const expectCollisionSuffixingAndReorderInsertionStability = (
  context: NodeIdentityContext,
) => {
  const alphaFirstId = context.firstNodeIdsByRecordKey?.get('first-alpha');
  const betaFirstId = context.firstNodeIdsByRecordKey?.get('first-beta');
  const alphaSecondId = context.secondNodeIdsByRecordKey?.get('second-alpha');
  const betaSecondId = context.secondNodeIdsByRecordKey?.get('second-beta');
  const alphaThirdId = context.thirdNodeIdsByRecordKey?.get('third-alpha');
  const betaThirdId = context.thirdNodeIdsByRecordKey?.get('third-beta');
  const gammaThirdId = context.thirdNodeIdsByRecordKey?.get('third-gamma');

  expect(alphaFirstId).toBeDefined();
  expect(betaFirstId).toBeDefined();
  expect(gammaThirdId).toBeDefined();

  expect(alphaSecondId).toBe(alphaFirstId);
  expect(betaSecondId).toBe(betaFirstId);
  expect(alphaThirdId).toBe(alphaFirstId);
  expect(betaThirdId).toBe(betaFirstId);
  expect(gammaThirdId).not.toBe(alphaFirstId);
  expect(gammaThirdId).not.toBe(betaFirstId);

  const alphaCollisionBaseId = alphaFirstId?.split('~')[0] ?? '';

  expect(betaFirstId).toBe(`${alphaCollisionBaseId}~2`);
  expect(gammaThirdId).toBe(`${alphaCollisionBaseId}~3`);
};

const expectAlternateFiberToReuseRecordKeyNodeId = (
  context: NodeIdentityContext,
) => {
  const firstNodeId = context.firstNodeIdsByRecordKey?.get(
    'stable-app-shell-record',
  );
  const secondNodeId = context.secondNodeIdsByRecordKey?.get(
    'stable-app-shell-record',
  );

  expect(firstNodeId).toBeDefined();
  expect(secondNodeId).toBe(firstNodeId);
  expect(secondNodeId?.includes('~2')).toBe(false);
};

const expectFrontSiblingInsertionToKeepUniqueAndStableNodeIds = (
  context: NodeIdentityContext,
) => {
  const firstAlphaId = context.firstNodeIdsByRecordKey?.get('renderer:0:0.0');
  const firstBetaId = context.firstNodeIdsByRecordKey?.get('renderer:0:0.1');
  const secondInsertedId =
    context.secondNodeIdsByRecordKey?.get('renderer:0:0.0');
  const secondAlphaId = context.secondNodeIdsByRecordKey?.get('renderer:0:0.1');
  const secondBetaId = context.secondNodeIdsByRecordKey?.get('renderer:0:0.2');
  const secondNodeIds = [secondInsertedId, secondAlphaId, secondBetaId].filter(
    (nodeId): nodeId is string => nodeId !== undefined,
  );

  expect(firstAlphaId).toBeDefined();
  expect(firstBetaId).toBeDefined();
  expect(secondAlphaId).toBe(firstAlphaId);
  expect(secondBetaId).toBe(firstBetaId);
  expect(secondInsertedId).toBeDefined();
  expect(secondInsertedId).not.toBe(firstAlphaId);
  expect(secondInsertedId).not.toBe(firstBetaId);
  expect(new Set(secondNodeIds).size).toBe(secondNodeIds.length);
};

describe('nodeIdentity', () => {
  test('should keep node ids stable across repeated snapshots when tree shape and fibers are unchanged', () => {
    return given(contextCreated)
      .when(stableRecordsConfigured)
      .when(firstAllocationExecuted)
      .when(secondAllocationExecuted)
      .then(expectStableTreeToKeepNodeIds);
  });

  test('should allocate deterministic collision suffixes and preserve existing ids across reorder and insertion updates', () => {
    return given(contextCreated)
      .when(collisionRecordsConfigured)
      .when(firstAllocationExecuted)
      .when(secondAllocationExecuted)
      .when(thirdAllocationExecuted)
      .then(expectCollisionSuffixingAndReorderInsertionStability);
  });

  test('should reuse record-key node identity when a re-render swaps to an alternate fiber object', () => {
    return given(contextCreated)
      .when(alternateFiberRecordsConfigured)
      .when(firstAllocationExecuted)
      .when(secondAllocationExecuted)
      .then(expectAlternateFiberToReuseRecordKeyNodeId);
  });

  test('should keep moved node ids stable via alternate fibers and prevent duplicates on front sibling insertion', () => {
    return given(contextCreated)
      .when(siblingInsertionRecordsConfigured)
      .when(firstAllocationExecuted)
      .when(secondAllocationExecuted)
      .then(expectFrontSiblingInsertionToKeepUniqueAndStableNodeIds);
  });
});
