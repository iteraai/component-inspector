import { given } from '#test/givenWhenThen';
import type { ReactTreeSnapshot } from '../base/baseAdapter';
import { mapFiberTraversalToTreeSnapshot } from './treeMapping';
import type { FiberTraversalResult } from './traversal';

type MockFiber = {
  type?: unknown;
  _debugSource?: unknown;
};

type TreeMappingContext = {
  traversalResult: FiberTraversalResult;
  nodeIdByRecordKey: Map<string, string>;
  snapshot?: ReactTreeSnapshot;
};

const createMockFiber = (type: unknown): MockFiber => {
  return {
    type,
  };
};

const createTraversalRecord = (
  key: string,
  options: {
    tag: number;
    fiber: unknown;
    parentKey?: string | null;
    childKeys?: string[];
    path: string;
  },
): FiberTraversalResult['records'][number] => {
  return {
    key,
    rendererId: 1,
    rendererRootIndex: 0,
    path: options.path,
    tag: options.tag,
    fiber: options.fiber,
    parentKey: options.parentKey ?? null,
    childKeys: options.childKeys ?? [],
  };
};

const contextCreated = (): TreeMappingContext => {
  return {
    traversalResult: {
      records: [],
      rootRecordKeys: [],
    },
    nodeIdByRecordKey: new Map(),
  };
};

const validTraversalConfigured = (
  context: TreeMappingContext,
): TreeMappingContext => {
  const toolbarRender = function ToolbarButton() {};

  context.traversalResult = {
    records: [
      createTraversalRecord('app-shell', {
        tag: 0,
        fiber: {
          ...createMockFiber({
            displayName: 'AppShell',
          }),
          _debugSource: {
            fileName: 'src/AppShell.tsx',
            lineNumber: 18,
            columnNumber: 3,
          },
        },
        childKeys: ['toolbar-button', 'memo-panel', 'missing-record'],
        path: '0.0.0',
      }),
      createTraversalRecord('toolbar-button', {
        tag: 11,
        fiber: createMockFiber({
          $$typeof: Symbol.for('react.forward_ref'),
          render: toolbarRender,
        }),
        parentKey: 'app-shell',
        path: '0.0.0.0',
      }),
      createTraversalRecord('memo-panel', {
        tag: 14,
        fiber: createMockFiber({
          $$typeof: Symbol.for('react.memo'),
          type: function MemoPanel() {},
        }),
        parentKey: 'app-shell',
        childKeys: ['settings-panel'],
        path: '0.0.0.1',
      }),
      createTraversalRecord('settings-panel', {
        tag: 1,
        fiber: createMockFiber({
          name: 'SettingsPanel',
        }),
        parentKey: 'memo-panel',
        path: '0.0.0.1.0',
      }),
      createTraversalRecord('anonymous', {
        tag: 15,
        fiber: createMockFiber({}),
        path: '0.1',
      }),
      createTraversalRecord('other-function', {
        tag: 0,
        fiber: createMockFiber({
          displayName: 'OtherFunction',
        }),
        path: '0.2',
      }),
    ],
    rootRecordKeys: [
      'app-shell',
      'anonymous',
      'other-function',
      'missing-root',
    ],
  };
  context.nodeIdByRecordKey = new Map([
    ['app-shell', 'node-app-shell'],
    ['toolbar-button', 'node-toolbar-button'],
    ['memo-panel', 'node-memo-panel'],
    ['settings-panel', 'node-settings-panel'],
    ['anonymous', 'node-anonymous'],
    ['other-function', 'node-other-function'],
  ]);

  return context;
};

const malformedTraversalConfigured = (
  context: TreeMappingContext,
): TreeMappingContext => {
  context.traversalResult = {
    records: [
      createTraversalRecord('root', {
        tag: 0,
        fiber: createMockFiber({
          displayName: 'RootNode',
        }),
        childKeys: ['child-without-node-id', 'missing-node'],
        path: '0.0',
      }),
      createTraversalRecord('child-without-node-id', {
        tag: 0,
        fiber: createMockFiber({
          displayName: 'DroppedChild',
        }),
        parentKey: 'root',
        path: '0.0.0',
      }),
      createTraversalRecord('implicit-child', {
        tag: 1,
        fiber: createMockFiber({
          displayName: 'ImplicitChild',
        }),
        parentKey: 'root',
        path: '0.0.1',
      }),
      createTraversalRecord('orphan-node', {
        tag: 2,
        fiber: createMockFiber({
          displayName: 'OrphanNode',
        }),
        parentKey: 'missing-parent',
        path: '0.1',
      }),
    ],
    rootRecordKeys: ['root'],
  };
  context.nodeIdByRecordKey = new Map([
    ['root', 'node-root'],
    ['implicit-child', 'node-implicit-child'],
    ['orphan-node', 'node-orphan-node'],
  ]);

  return context;
};

const traversalConfiguredWithThrowingDisplayNameGetter = (
  context: TreeMappingContext,
): TreeMappingContext => {
  const componentWithThrowingGetters = new Proxy(function SafeFallback() {}, {
    get(target, property, receiver) {
      if (property === 'displayName' || property === 'name') {
        throw new Error('display name getter failed');
      }

      return Reflect.get(target, property, receiver);
    },
  });

  context.traversalResult = {
    records: [
      createTraversalRecord('throwing-node', {
        tag: 0,
        fiber: createMockFiber(componentWithThrowingGetters),
        path: '0.0',
      }),
    ],
    rootRecordKeys: ['throwing-node'],
  };
  context.nodeIdByRecordKey = new Map([['throwing-node', 'node-throwing']]);

  return context;
};

const traversalConfiguredAsBudgetTruncated = (
  context: TreeMappingContext,
): TreeMappingContext => {
  validTraversalConfigured(context);
  context.traversalResult = {
    ...context.traversalResult,
    meta: {
      truncated: true,
      exhaustedBy: 'record-limit',
      includedRecordCount: context.traversalResult.records.length,
      traversalStepCount: 42,
      budget: {
        maxRecords: 100,
        maxTraversalSteps: 1_000,
      },
    },
  };

  return context;
};

const mappingExecuted = (context: TreeMappingContext): TreeMappingContext => {
  context.snapshot = mapFiberTraversalToTreeSnapshot({
    traversalResult: context.traversalResult,
    nodeIdByRecordKey: context.nodeIdByRecordKey,
  });

  return context;
};

const expectValidTraversalToMapToProtocolTreeShape = (
  context: TreeMappingContext,
) => {
  const snapshot = context.snapshot as ReactTreeSnapshot;
  const nodeById = new Map(snapshot.nodes.map((node) => [node.id, node]));
  const appNode = nodeById.get('node-app-shell');
  const toolbarNode = nodeById.get('node-toolbar-button');
  const memoNode = nodeById.get('node-memo-panel');
  const settingsNode = nodeById.get('node-settings-panel');
  const anonymousNode = nodeById.get('node-anonymous');
  const otherFunctionNode = nodeById.get('node-other-function');

  expect(snapshot.rootIds).toEqual([
    'node-app-shell',
    'node-anonymous',
    'node-other-function',
  ]);
  expect(snapshot.nodes).toHaveLength(6);
  expect(appNode).toMatchObject({
    displayName: 'AppShell',
    parentId: null,
    childrenIds: ['node-toolbar-button', 'node-memo-panel'],
    source: {
      file: 'src/AppShell.tsx',
      line: 18,
      column: 3,
    },
    tags: ['fiber', 'fiber-kind:function', 'fiber-tag:0'],
  });
  expect(toolbarNode).toMatchObject({
    displayName: 'ForwardRef(ToolbarButton)',
    parentId: 'node-app-shell',
    childrenIds: [],
    tags: ['fiber', 'fiber-kind:forward-ref', 'fiber-tag:11'],
  });
  expect(toolbarNode?.source).toBeUndefined();
  expect(memoNode).toMatchObject({
    displayName: 'Memo(MemoPanel)',
    parentId: 'node-app-shell',
    childrenIds: ['node-settings-panel'],
    tags: ['fiber', 'fiber-kind:memo', 'fiber-tag:14'],
  });
  expect(settingsNode).toMatchObject({
    displayName: 'SettingsPanel',
    parentId: 'node-memo-panel',
    childrenIds: [],
    tags: ['fiber', 'fiber-kind:class', 'fiber-tag:1'],
  });
  expect(anonymousNode).toMatchObject({
    displayName: 'Anonymous',
    parentId: null,
    childrenIds: [],
    tags: ['fiber', 'fiber-kind:simple-memo', 'fiber-tag:15'],
  });
  expect(otherFunctionNode).toMatchObject({
    displayName: 'OtherFunction',
    parentId: null,
    childrenIds: [],
    tags: ['fiber', 'fiber-kind:function', 'fiber-tag:0'],
  });
  expect(otherFunctionNode?.tags).toEqual(appNode?.tags);
};

const expectMalformedTraversalToKeepParentChildAndRootIntegrity = (
  context: TreeMappingContext,
) => {
  const snapshot = context.snapshot as ReactTreeSnapshot;
  const nodeById = new Map(snapshot.nodes.map((node) => [node.id, node]));
  const nodeIdSet = new Set(snapshot.nodes.map((node) => node.id));
  const rootNode = nodeById.get('node-root');
  const implicitChildNode = nodeById.get('node-implicit-child');
  const orphanNode = nodeById.get('node-orphan-node');

  expect(snapshot.nodes).toHaveLength(3);
  expect(snapshot.rootIds).toEqual(['node-root', 'node-orphan-node']);
  expect(rootNode?.childrenIds).toEqual(['node-implicit-child']);
  expect(implicitChildNode?.parentId).toEqual('node-root');
  expect(orphanNode?.parentId).toBeNull();

  snapshot.nodes.forEach((node) => {
    node.childrenIds.forEach((childId) => {
      expect(nodeIdSet.has(childId)).toBe(true);
    });
  });
};

const expectThrowingDisplayNameGetterToFailSoft = (
  context: TreeMappingContext,
) => {
  const snapshot = context.snapshot as ReactTreeSnapshot;

  expect(snapshot.rootIds).toEqual(['node-throwing']);
  expect(snapshot.nodes).toHaveLength(1);
  expect(snapshot.nodes[0]).toMatchObject({
    id: 'node-throwing',
    displayName: 'Anonymous',
    parentId: null,
    childrenIds: [],
    tags: ['fiber', 'fiber-kind:function', 'fiber-tag:0'],
  });
};

const expectTraversalTruncationMetadataToBeMapped = (
  context: TreeMappingContext,
) => {
  const snapshot = context.snapshot as ReactTreeSnapshot;

  expect(snapshot.meta).toEqual({
    truncated: true,
    includedNodeCount: 6,
  });
};

describe('treeMapping', () => {
  test('should map traversal records into protocol tree nodes with deterministic display names, tags, and links', () => {
    return given(contextCreated)
      .when(validTraversalConfigured)
      .when(mappingExecuted)
      .then(expectValidTraversalToMapToProtocolTreeShape);
  });

  test('should keep link integrity by dropping unresolved references and promoting orphaned nodes to roots', () => {
    return given(contextCreated)
      .when(malformedTraversalConfigured)
      .when(mappingExecuted)
      .then(expectMalformedTraversalToKeepParentChildAndRootIntegrity);
  });

  test('should fail soft to Anonymous when component name getters throw during display-name resolution', () => {
    return given(contextCreated)
      .when(traversalConfiguredWithThrowingDisplayNameGetter)
      .when(mappingExecuted)
      .then(expectThrowingDisplayNameGetterToFailSoft);
  });

  test('should map traversal truncation metadata into tree snapshot meta', () => {
    return given(contextCreated)
      .when(traversalConfiguredAsBudgetTruncated)
      .when(mappingExecuted)
      .then(expectTraversalTruncationMetadataToBeMapped);
  });
});
