import {
  MAX_TREE_SNAPSHOT_NODE_COUNT,
  capTreeSnapshot,
} from './baseAdapter';
import type { InspectorTreeSnapshot } from './types';

describe('baseAdapter', () => {
  test('returns the original snapshot when the node count is within the cap', () => {
    const snapshot: InspectorTreeSnapshot = {
      nodes: [
        {
          id: 'root-node',
          displayName: 'App',
          parentId: null,
          childrenIds: [],
        },
      ],
      rootIds: ['root-node'],
    };

    expect(capTreeSnapshot(snapshot)).toBe(snapshot);
    expect(capTreeSnapshot(snapshot).meta).toBeUndefined();
  });

  test('truncates oversized snapshots with the same metadata shape as the React bridge', () => {
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
    const snapshot: InspectorTreeSnapshot = {
      nodes,
      rootIds: ['node-0'],
    };

    const cappedSnapshot = capTreeSnapshot(snapshot);

    expect(cappedSnapshot.meta).toEqual({
      truncated: true,
      totalNodeCount: MAX_TREE_SNAPSHOT_NODE_COUNT + 3,
      includedNodeCount: MAX_TREE_SNAPSHOT_NODE_COUNT,
      truncatedNodeCount: 3,
    });
    expect(cappedSnapshot.rootIds).toEqual(['node-0']);
    expect(cappedSnapshot.nodes).toHaveLength(MAX_TREE_SNAPSHOT_NODE_COUNT);
    expect(cappedSnapshot.nodes[0]).toEqual(nodes[0]);
    expect(cappedSnapshot.nodes[MAX_TREE_SNAPSHOT_NODE_COUNT - 1]).toEqual({
      ...nodes[MAX_TREE_SNAPSHOT_NODE_COUNT - 1],
      childrenIds: [],
    });
  });

  test('promotes included children to roots when their truncated parent is excluded', () => {
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
    const snapshot: InspectorTreeSnapshot = {
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

    expect(capTreeSnapshot(snapshot).rootIds).toEqual([
      rootNodeId,
      promotedRootNodeId,
    ]);
  });

  test('returns an empty truncated snapshot when capped at zero', () => {
    const snapshot: InspectorTreeSnapshot = {
      nodes: [
        {
          id: 'root-node',
          displayName: 'App',
          parentId: null,
          childrenIds: [],
        },
      ],
      rootIds: ['root-node'],
    };

    expect(capTreeSnapshot(snapshot, 0)).toEqual({
      nodes: [],
      rootIds: [],
      meta: {
        truncated: true,
        totalNodeCount: 1,
        includedNodeCount: 0,
        truncatedNodeCount: 1,
      },
    });
  });
});
