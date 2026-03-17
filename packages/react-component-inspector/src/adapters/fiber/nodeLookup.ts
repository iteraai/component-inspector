import type { ReactTreeSnapshot } from '../base/baseAdapter';
import type { FiberTraversalRecord, FiberTraversalResult } from './traversal';

export type FiberNodeLookupPayload = Readonly<{
  nodeId: string;
  recordKey: string;
  fiber: unknown;
  tag: number;
  rendererId: number;
  rendererRootIndex: number;
  path: string;
  parentNodeId: string | null;
  childNodeIds: string[];
}>;

export type FiberNodeLookup = Readonly<{
  refreshFromSnapshot: (options: {
    traversalResult: FiberTraversalResult;
    nodeIdByRecordKey: ReadonlyMap<string, string>;
    snapshot: ReactTreeSnapshot;
  }) => void;
  resolveByNodeId: (nodeId: string) => FiberNodeLookupPayload | undefined;
  resolveClosestComponentPathForElement: (
    element: Element,
  ) => ReadonlyArray<string> | undefined;
}>;

type FiberLike = Record<string, unknown>;
type ReactManagedElement = Element & Record<string, unknown>;

const REACT_FIBER_POINTER_PREFIXES = [
  '__reactFiber$',
  '__reactInternalInstance$',
] as const;

const toChildNodeIds = (
  childKeys: string[],
  nodeIdByRecordKey: ReadonlyMap<string, string>,
  includedNodeIdSet: ReadonlySet<string>,
) => {
  const childNodeIds: string[] = [];
  const seenChildNodeIds = new Set<string>();

  childKeys.forEach((childKey) => {
    const childNodeId = nodeIdByRecordKey.get(childKey);

    if (
      childNodeId === undefined ||
      !includedNodeIdSet.has(childNodeId) ||
      seenChildNodeIds.has(childNodeId)
    ) {
      return;
    }

    seenChildNodeIds.add(childNodeId);
    childNodeIds.push(childNodeId);
  });

  return childNodeIds;
};

const toParentNodeId = (
  record: FiberTraversalRecord,
  nodeIdByRecordKey: ReadonlyMap<string, string>,
  includedNodeIdSet: ReadonlySet<string>,
) => {
  if (record.parentKey === null) {
    return null;
  }

  const parentNodeId = nodeIdByRecordKey.get(record.parentKey);

  if (parentNodeId === undefined || !includedNodeIdSet.has(parentNodeId)) {
    return null;
  }

  return parentNodeId;
};

const isRecord = (value: unknown): value is Record<string, unknown> => {
  return typeof value === 'object' && value !== null;
};

const readRecordValue = (record: Record<string, unknown>, key: string) => {
  try {
    return record[key];
  } catch {
    return undefined;
  }
};

const toFiber = (value: unknown): FiberLike | undefined => {
  if (!isRecord(value)) {
    return undefined;
  }

  return value;
};

const readAlternateFiber = (fiber: FiberLike): FiberLike | undefined => {
  return toFiber(readRecordValue(fiber, 'alternate'));
};

const readReturnFiber = (fiber: FiberLike): FiberLike | undefined => {
  return toFiber(readRecordValue(fiber, 'return'));
};

const readFiberFromManagedElement = (
  element: ReactManagedElement,
): FiberLike | undefined => {
  for (const key of Reflect.ownKeys(element)) {
    if (
      typeof key !== 'string' ||
      !REACT_FIBER_POINTER_PREFIXES.some((prefix) => key.startsWith(prefix))
    ) {
      continue;
    }

    const fiber = toFiber(element[key]);

    if (fiber !== undefined) {
      return fiber;
    }
  }

  return undefined;
};

const resolveFiberFromElement = (element: Element) => {
  let current: Element | null = element;

  while (current !== null) {
    const fiber = readFiberFromManagedElement(current as ReactManagedElement);

    if (fiber !== undefined) {
      return fiber;
    }

    current = current.parentElement;
  }

  return undefined;
};

const buildComponentPath = (
  nodeId: string,
  nodeById: ReadonlyMap<string, ReactTreeSnapshot['nodes'][number]>,
) => {
  const componentPath: string[] = [];
  const visitedNodeIds = new Set<string>();
  let currentNodeId: string | null = nodeId;

  while (currentNodeId !== null && !visitedNodeIds.has(currentNodeId)) {
    visitedNodeIds.add(currentNodeId);

    const currentNode = nodeById.get(currentNodeId);

    if (currentNode === undefined) {
      break;
    }

    componentPath.unshift(currentNode.displayName);
    currentNodeId = currentNode.parentId;
  }

  return componentPath.length > 0 ? componentPath : undefined;
};

export const createFiberNodeLookup = (): FiberNodeLookup => {
  let payloadByNodeId = new Map<string, FiberNodeLookupPayload>();
  let nodeIdByFiberRef = new WeakMap<object, string>();
  let nodeById = new Map<string, ReactTreeSnapshot['nodes'][number]>();

  return {
    refreshFromSnapshot: (options) => {
      const nextPayloadByNodeId = new Map<string, FiberNodeLookupPayload>();
      const nextNodeIdByFiberRef = new WeakMap<object, string>();
      const nextNodeById = new Map(
        options.snapshot.nodes.map((node) => [node.id, node]),
      );
      const includedNodeIdSet = new Set(
        options.snapshot.nodes.map((node) => node.id),
      );

      options.traversalResult.records.forEach((record) => {
        const nodeId = options.nodeIdByRecordKey.get(record.key);

        if (
          nodeId === undefined ||
          !includedNodeIdSet.has(nodeId) ||
          nextPayloadByNodeId.has(nodeId)
        ) {
          return;
        }

        nextPayloadByNodeId.set(nodeId, {
          nodeId,
          recordKey: record.key,
          fiber: record.fiber,
          tag: record.tag,
          rendererId: record.rendererId,
          rendererRootIndex: record.rendererRootIndex,
          path: record.path,
          parentNodeId: toParentNodeId(
            record,
            options.nodeIdByRecordKey,
            includedNodeIdSet,
          ),
          childNodeIds: toChildNodeIds(
            record.childKeys,
            options.nodeIdByRecordKey,
            includedNodeIdSet,
          ),
        });

        const fiber = toFiber(record.fiber);

        if (fiber !== undefined) {
          nextNodeIdByFiberRef.set(fiber, nodeId);

          const alternateFiber = readAlternateFiber(fiber);

          if (alternateFiber !== undefined) {
            nextNodeIdByFiberRef.set(alternateFiber, nodeId);
          }
        }
      });

      payloadByNodeId = nextPayloadByNodeId;
      nodeIdByFiberRef = nextNodeIdByFiberRef;
      nodeById = nextNodeById;
    },
    resolveByNodeId: (nodeId: string) => {
      return payloadByNodeId.get(nodeId);
    },
    resolveClosestComponentPathForElement: (element: Element) => {
      const entryFiber = resolveFiberFromElement(element);

      if (entryFiber === undefined) {
        return undefined;
      }

      const visitedFibers = new Set<unknown>();
      let currentFiber: FiberLike | undefined = entryFiber;

      while (currentFiber !== undefined && !visitedFibers.has(currentFiber)) {
        visitedFibers.add(currentFiber);

        const nodeId = nodeIdByFiberRef.get(currentFiber);

        if (nodeId !== undefined) {
          return buildComponentPath(nodeId, nodeById);
        }

        currentFiber = readReturnFiber(currentFiber);
      }

      return undefined;
    },
  };
};
