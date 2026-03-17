import type { TreeNode } from '@iteraai/inspector-protocol';
import { given } from '#test/givenWhenThen';
import {
  MAX_TREE_SNAPSHOT_NODE_COUNT,
  capTreeSnapshot,
  createBaseReactInspectorAdapter,
  type CappedReactTreeSnapshot,
  type ReactTreeSnapshot,
} from './baseAdapter';

type BaseAdapterContext = {
  snapshot: ReactTreeSnapshot;
  cappedSnapshot?: CappedReactTreeSnapshot;
  nodeProps?: unknown;
  domElement?: Element | null;
  resolveNodeProps: ReturnType<typeof vi.fn>;
  resolveDomElement: ReturnType<typeof vi.fn>;
};

const contextCreated = (): BaseAdapterContext => {
  return {
    snapshot: {
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
    resolveNodeProps: vi.fn(({ node }: { node: TreeNode }) => ({
      nodeId: node.id,
      displayName: node.displayName,
    })),
    resolveDomElement: vi.fn(() => document.createElement('div')),
  };
};

const snapshotSetToLinearTreeExceedingCap = (
  context: BaseAdapterContext,
): BaseAdapterContext => {
  const nodeCount = MAX_TREE_SNAPSHOT_NODE_COUNT + 3;
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

  context.snapshot = {
    nodes,
    rootIds: ['node-0'],
  };

  return context;
};

const snapshotSetToExcludedParentTopology = (
  context: BaseAdapterContext,
): BaseAdapterContext => {
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

  context.snapshot = {
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

  return context;
};

const snapshotCappedAtDefault = (
  context: BaseAdapterContext,
): BaseAdapterContext => {
  context.cappedSnapshot = capTreeSnapshot(context.snapshot);

  return context;
};

const snapshotCappedAtZero = (
  context: BaseAdapterContext,
): BaseAdapterContext => {
  context.cappedSnapshot = capTreeSnapshot(context.snapshot, 0);

  return context;
};

const nodePropsRequestedForRootNode = (
  context: BaseAdapterContext,
): BaseAdapterContext => {
  const adapter = createBaseReactInspectorAdapter({
    getTreeSnapshot: () => context.snapshot,
    getNodeProps: context.resolveNodeProps,
    getDomElement: context.resolveDomElement,
  });

  context.nodeProps = adapter.getNodeProps('root-node');

  return context;
};

const nodePropsAndDomRequestedForUnknownNode = (
  context: BaseAdapterContext,
): BaseAdapterContext => {
  const adapter = createBaseReactInspectorAdapter({
    getTreeSnapshot: () => context.snapshot,
    getNodeProps: context.resolveNodeProps,
    getDomElement: context.resolveDomElement,
  });

  context.nodeProps = adapter.getNodeProps('unknown-node');
  context.domElement = adapter.getDomElement('unknown-node');

  return context;
};

const expectSnapshotReturnedWithoutTruncation = (
  context: BaseAdapterContext,
) => {
  expect(context.cappedSnapshot).toBe(context.snapshot);
  expect(context.cappedSnapshot?.meta).toBeUndefined();
};

const expectSnapshotTruncatedMetadata = (context: BaseAdapterContext) => {
  expect(context.cappedSnapshot?.meta).toEqual({
    truncated: true,
    totalNodeCount: MAX_TREE_SNAPSHOT_NODE_COUNT + 3,
    includedNodeCount: MAX_TREE_SNAPSHOT_NODE_COUNT,
    truncatedNodeCount: 3,
  });
  expect(context.cappedSnapshot?.nodes).toHaveLength(
    MAX_TREE_SNAPSHOT_NODE_COUNT,
  );
  expect(context.cappedSnapshot?.rootIds).toEqual(['node-0']);
};

const expectPromotedRootNodePresentAfterTruncation = (
  context: BaseAdapterContext,
) => {
  expect(context.cappedSnapshot?.rootIds).toContain('promoted-node');
};

const expectZeroCapTruncationMetadata = (context: BaseAdapterContext) => {
  expect(context.cappedSnapshot).toEqual({
    nodes: [],
    rootIds: [],
    meta: {
      truncated: true,
      totalNodeCount: 1,
      includedNodeCount: 0,
      truncatedNodeCount: 1,
    },
  });
};

const expectNodeLookupResolversUsedForKnownNode = (
  context: BaseAdapterContext,
) => {
  expect(context.nodeProps).toEqual({
    nodeId: 'root-node',
    displayName: 'App',
  });
  expect(context.resolveNodeProps).toHaveBeenCalledTimes(1);
  expect(context.resolveNodeProps).toHaveBeenCalledWith(
    expect.objectContaining({
      node: expect.objectContaining({
        id: 'root-node',
      }),
    }),
  );
};

const expectNodeLookupResolversSkippedForUnknownNode = (
  context: BaseAdapterContext,
) => {
  expect(context.nodeProps).toBeUndefined();
  expect(context.domElement).toBeNull();
  expect(context.resolveNodeProps).not.toHaveBeenCalled();
  expect(context.resolveDomElement).not.toHaveBeenCalled();
};

describe('baseAdapter', () => {
  test('should keep tree snapshot unchanged when node count is under cap', () => {
    return given(contextCreated)
      .when(snapshotCappedAtDefault)
      .then(expectSnapshotReturnedWithoutTruncation);
  });

  test('should return truncation metadata when snapshot exceeds cap', () => {
    return given(contextCreated)
      .when(snapshotSetToLinearTreeExceedingCap)
      .when(snapshotCappedAtDefault)
      .then(expectSnapshotTruncatedMetadata);
  });

  test('should promote included nodes to roots when truncation excludes parent', () => {
    return given(contextCreated)
      .when(snapshotSetToExcludedParentTopology)
      .when(snapshotCappedAtDefault)
      .then(expectPromotedRootNodePresentAfterTruncation);
  });

  test('should return empty snapshot metadata when cap is zero', () => {
    return given(contextCreated)
      .when(snapshotCappedAtZero)
      .then(expectZeroCapTruncationMetadata);
  });

  test('should resolve node props using base lookup for known node id', () => {
    return given(contextCreated)
      .when(nodePropsRequestedForRootNode)
      .then(expectNodeLookupResolversUsedForKnownNode);
  });

  test('should skip node prop and dom resolvers for unknown node id', () => {
    return given(contextCreated)
      .when(nodePropsAndDomRequestedForUnknownNode)
      .then(expectNodeLookupResolversSkippedForUnknownNode);
  });
});
