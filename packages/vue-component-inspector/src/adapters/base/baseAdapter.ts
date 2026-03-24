import type { TreeNode, TreeSnapshotMeta } from '@iteraai/inspector-protocol';
import type {
  InspectorAdapterContract,
  InspectorComponentPath,
  InspectorTreeSnapshot,
} from './types';

export type CappedInspectorTreeSnapshot = InspectorTreeSnapshot & {
  meta?: TreeSnapshotMeta;
};

export const MAX_TREE_SNAPSHOT_NODE_COUNT = 200;

const toUniqueNodeById = (nodes: TreeNode[]) => {
  const nodeById = new Map<string, TreeNode>();

  nodes.forEach((node) => {
    if (nodeById.has(node.id)) {
      return;
    }

    nodeById.set(node.id, node);
  });

  return nodeById;
};

const toTraversalSeedNodeIds = (
  snapshot: InspectorTreeSnapshot,
  nodeById: Map<string, TreeNode>,
) => {
  const seedNodeIds: string[] = [];
  const seenSeedNodeIds = new Set<string>();

  const appendSeedNodeId = (nodeId: string | null | undefined) => {
    if (
      nodeId === undefined ||
      nodeId === null ||
      seenSeedNodeIds.has(nodeId) ||
      !nodeById.has(nodeId)
    ) {
      return;
    }

    seenSeedNodeIds.add(nodeId);
    seedNodeIds.push(nodeId);
  };

  snapshot.rootIds.forEach((rootId) => {
    appendSeedNodeId(rootId);
  });

  snapshot.nodes.forEach((node) => {
    if (node.parentId === null) {
      appendSeedNodeId(node.id);
    }
  });

  snapshot.nodes.forEach((node) => {
    appendSeedNodeId(node.id);
  });

  return seedNodeIds;
};

const toTruncatedNodes = (
  snapshot: InspectorTreeSnapshot,
  includedNodeIdSet: Set<string>,
) => {
  const emittedNodeIds = new Set<string>();

  return snapshot.nodes.flatMap((node) => {
    if (!includedNodeIdSet.has(node.id) || emittedNodeIds.has(node.id)) {
      return [];
    }

    emittedNodeIds.add(node.id);

    return [
      {
        ...node,
        parentId:
          node.parentId !== null && includedNodeIdSet.has(node.parentId)
            ? node.parentId
            : null,
        childrenIds: node.childrenIds.filter((childId) =>
          includedNodeIdSet.has(childId),
        ),
      },
    ];
  });
};

const toTruncatedRootIds = (
  snapshot: InspectorTreeSnapshot,
  truncatedNodes: TreeNode[],
) => {
  const includedNodeById = new Map(
    truncatedNodes.map((node) => [node.id, node]),
  );
  const includedRootIds: string[] = [];
  const seenRootIds = new Set<string>();

  snapshot.rootIds.forEach((rootId) => {
    if (seenRootIds.has(rootId)) {
      return;
    }

    const includedNode = includedNodeById.get(rootId);

    if (includedNode === undefined || includedNode.parentId !== null) {
      return;
    }

    seenRootIds.add(rootId);
    includedRootIds.push(rootId);
  });

  truncatedNodes.forEach((node) => {
    if (node.parentId !== null || seenRootIds.has(node.id)) {
      return;
    }

    seenRootIds.add(node.id);
    includedRootIds.push(node.id);
  });

  return includedRootIds;
};

export const capTreeSnapshot = (
  snapshot: InspectorTreeSnapshot,
  maxNodeCount = MAX_TREE_SNAPSHOT_NODE_COUNT,
): CappedInspectorTreeSnapshot => {
  const totalNodeCount = snapshot.nodes.length;

  if (maxNodeCount <= 0) {
    return {
      nodes: [],
      rootIds: [],
      meta: {
        truncated: true,
        totalNodeCount,
        includedNodeCount: 0,
        truncatedNodeCount: totalNodeCount,
      },
    };
  }

  if (totalNodeCount <= maxNodeCount) {
    return snapshot;
  }

  const nodeById = toUniqueNodeById(snapshot.nodes);
  const traversalQueue = toTraversalSeedNodeIds(snapshot, nodeById);
  const visitedNodeIds = new Set<string>();
  const includedNodeIds: string[] = [];
  let queueIndex = 0;

  while (
    queueIndex < traversalQueue.length &&
    includedNodeIds.length < maxNodeCount
  ) {
    const nodeId = traversalQueue[queueIndex];
    queueIndex += 1;

    if (visitedNodeIds.has(nodeId)) {
      continue;
    }

    const node = nodeById.get(nodeId);

    if (node === undefined) {
      continue;
    }

    visitedNodeIds.add(nodeId);
    includedNodeIds.push(nodeId);

    node.childrenIds.forEach((childId) => {
      if (!visitedNodeIds.has(childId) && nodeById.has(childId)) {
        traversalQueue.push(childId);
      }
    });
  }

  if (includedNodeIds.length < maxNodeCount) {
    snapshot.nodes.forEach((node) => {
      if (
        includedNodeIds.length >= maxNodeCount ||
        visitedNodeIds.has(node.id)
      ) {
        return;
      }

      if (!nodeById.has(node.id)) {
        return;
      }

      visitedNodeIds.add(node.id);
      includedNodeIds.push(node.id);
    });
  }

  const includedNodeIdSet = new Set(includedNodeIds);
  const truncatedNodes = toTruncatedNodes(snapshot, includedNodeIdSet);
  const truncatedRootIds = toTruncatedRootIds(snapshot, truncatedNodes);
  const includedNodeCount = truncatedNodes.length;

  return {
    nodes: truncatedNodes,
    rootIds: truncatedRootIds,
    meta: {
      truncated: true,
      totalNodeCount,
      includedNodeCount,
      truncatedNodeCount: totalNodeCount - includedNodeCount,
    },
  };
};

export type InspectorAdapterNodeLookup = {
  node: TreeNode;
  nodeById: ReadonlyMap<string, TreeNode>;
  snapshot: InspectorTreeSnapshot;
};

const resolveNodeLookup = (
  snapshot: InspectorTreeSnapshot,
  nodeId: string,
): InspectorAdapterNodeLookup | undefined => {
  const nodeById = toUniqueNodeById(snapshot.nodes);
  const node = nodeById.get(nodeId);

  if (node === undefined) {
    return undefined;
  }

  return {
    node,
    nodeById,
    snapshot,
  };
};

type CreateBaseAdapterNodeLookupOptions = {
  getTreeSnapshot: () => InspectorTreeSnapshot;
  getNodeProps?: (lookup: InspectorAdapterNodeLookup) => unknown | undefined;
  getDomElement?: (lookup: InspectorAdapterNodeLookup) => Element | null;
};

export type CreateBaseInspectorAdapterOptions =
  CreateBaseAdapterNodeLookupOptions & {
    getComponentPathForElement?: (
      element: Element,
    ) => InspectorComponentPath | undefined;
  };

const createLookupResolvers = (options: CreateBaseAdapterNodeLookupOptions) => {
  return {
    getTreeSnapshot: () => options.getTreeSnapshot(),
    getNodeProps: (nodeId: string) => {
      if (options.getNodeProps === undefined) {
        return undefined;
      }

      const snapshot = options.getTreeSnapshot();
      const lookup = resolveNodeLookup(snapshot, nodeId);

      if (lookup === undefined) {
        return undefined;
      }

      return options.getNodeProps(lookup);
    },
    getDomElement: (nodeId: string) => {
      if (options.getDomElement === undefined) {
        return null;
      }

      const snapshot = options.getTreeSnapshot();
      const lookup = resolveNodeLookup(snapshot, nodeId);

      if (lookup === undefined) {
        return null;
      }

      return options.getDomElement(lookup);
    },
  };
};

export const createBaseInspectorAdapter = (
  options: CreateBaseInspectorAdapterOptions,
): InspectorAdapterContract => {
  return {
    ...createLookupResolvers(options),
    ...(options.getComponentPathForElement !== undefined && {
      getComponentPathForElement: options.getComponentPathForElement,
    }),
  };
};
