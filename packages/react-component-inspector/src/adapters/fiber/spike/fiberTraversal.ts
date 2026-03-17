import type { TreeNode } from '@iteraai/inspector-protocol';
import { resolveFiberDisplayName } from './displayName';
import type { DevtoolsProbeResult, FiberRootRef } from './types';

const COMPONENT_FIBER_TAGS = new Set([0, 1, 2, 11, 14, 15]);
const SPIKE_NODE_TAG = 'fiber-spike';

type FiberLike = Record<string, unknown> & {
  tag?: unknown;
  child?: unknown;
  sibling?: unknown;
};

type FiberRootLike = Record<string, unknown> & {
  current?: unknown;
};

type TraversalStackEntry = {
  fiber: FiberLike;
  rendererId: number;
  rootIndex: number;
  path: string;
  parentComponentId: string | null;
};

export type FiberSpikeTreeNode = TreeNode &
  Readonly<{
    rendererId: number;
    fiber: unknown;
  }>;

export type FiberTraversalSnapshot = Readonly<{
  nodes: FiberSpikeTreeNode[];
  rootIds: string[];
}>;

const isRecord = (value: unknown): value is Record<string, unknown> => {
  return typeof value === 'object' && value !== null;
};

const toFiber = (value: unknown): FiberLike | undefined => {
  if (!isRecord(value)) {
    return undefined;
  }

  return value as FiberLike;
};

const toRootFiber = (rootRef: FiberRootRef): FiberLike | undefined => {
  const rootLike = toFiber(rootRef.root) as FiberRootLike | undefined;

  if (rootLike === undefined) {
    return undefined;
  }

  return toFiber(rootLike.current);
};

const toFiberTag = (value: unknown) => {
  if (typeof value !== 'number' || !Number.isInteger(value)) {
    return undefined;
  }

  return value;
};

const isComponentFiber = (fiber: FiberLike) => {
  const tag = toFiberTag(fiber.tag);

  return tag !== undefined && COMPONENT_FIBER_TAGS.has(tag);
};

const toSortedRoots = (roots: FiberRootRef[]) => {
  return roots
    .map((rootRef, sourceIndex) => {
      return {
        rootRef,
        sourceIndex,
      };
    })
    .sort((leftRoot, rightRoot) => {
      if (leftRoot.rootRef.rendererId !== rightRoot.rootRef.rendererId) {
        return leftRoot.rootRef.rendererId - rightRoot.rootRef.rendererId;
      }

      return leftRoot.sourceIndex - rightRoot.sourceIndex;
    })
    .map((entry) => entry.rootRef);
};

const toTraversalNodeId = (entry: TraversalStackEntry) => {
  return `fiber:${entry.rendererId}:${entry.rootIndex}:${entry.path}`;
};

const toChildFibers = (fiber: FiberLike) => {
  const children: FiberLike[] = [];
  const seenSiblingFibers = new Set<unknown>();
  let siblingCursor = toFiber(fiber.child);

  while (siblingCursor !== undefined && !seenSiblingFibers.has(siblingCursor)) {
    seenSiblingFibers.add(siblingCursor);
    children.push(siblingCursor);
    siblingCursor = toFiber(siblingCursor.sibling);
  }

  return children;
};

export const traverseFiberRoots = (
  roots: FiberRootRef[],
): FiberTraversalSnapshot => {
  const orderedRoots = toSortedRoots(roots);
  const nextRootIndexByRenderer = new Map<number, number>();
  const visitedFibers = new Set<unknown>();
  const nodesById = new Map<string, FiberSpikeTreeNode>();
  const nodes: FiberSpikeTreeNode[] = [];
  const rootIds: string[] = [];
  const seenRootIds = new Set<string>();

  for (const rootRef of orderedRoots) {
    const rootFiber = toRootFiber(rootRef);

    if (rootFiber === undefined) {
      continue;
    }

    const rendererRootIndex =
      nextRootIndexByRenderer.get(rootRef.rendererId) ?? 0;

    nextRootIndexByRenderer.set(rootRef.rendererId, rendererRootIndex + 1);

    const stack: TraversalStackEntry[] = [
      {
        fiber: rootFiber,
        rendererId: rootRef.rendererId,
        rootIndex: rendererRootIndex,
        path: '0',
        parentComponentId: null,
      },
    ];

    while (stack.length > 0) {
      const entry = stack.pop();

      if (entry === undefined) {
        continue;
      }

      if (visitedFibers.has(entry.fiber)) {
        continue;
      }

      visitedFibers.add(entry.fiber);

      let nextParentComponentId = entry.parentComponentId;

      if (isComponentFiber(entry.fiber)) {
        const nodeId = toTraversalNodeId(entry);
        const node: FiberSpikeTreeNode = {
          id: nodeId,
          displayName: resolveFiberDisplayName(entry.fiber),
          parentId: entry.parentComponentId,
          childrenIds: [],
          tags: [SPIKE_NODE_TAG, `renderer-${entry.rendererId}`],
          rendererId: entry.rendererId,
          fiber: entry.fiber,
        };

        nodesById.set(nodeId, node);
        nodes.push(node);
        nextParentComponentId = nodeId;

        if (entry.parentComponentId === null) {
          if (!seenRootIds.has(nodeId)) {
            seenRootIds.add(nodeId);
            rootIds.push(nodeId);
          }
        } else {
          const parentNode = nodesById.get(entry.parentComponentId);

          if (parentNode !== undefined) {
            parentNode.childrenIds.push(nodeId);
          }
        }
      }

      const childFibers = toChildFibers(entry.fiber);

      for (
        let childIndex = childFibers.length - 1;
        childIndex >= 0;
        childIndex -= 1
      ) {
        const childFiber = childFibers[childIndex];

        stack.push({
          fiber: childFiber,
          rendererId: entry.rendererId,
          rootIndex: entry.rootIndex,
          path: `${entry.path}.${childIndex}`,
          parentComponentId: nextParentComponentId,
        });
      }
    }
  }

  return {
    nodes,
    rootIds,
  };
};

export const traverseFiberRootsFromProbe = (
  probeResult: DevtoolsProbeResult,
): FiberTraversalSnapshot => {
  if (probeResult.status !== 'ok') {
    return {
      nodes: [],
      rootIds: [],
    };
  }

  return traverseFiberRoots(probeResult.roots);
};
