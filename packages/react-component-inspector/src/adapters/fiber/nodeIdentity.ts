import type { FiberTraversalRecord } from './traversal';

const FNV_32_OFFSET_BASIS = 2166136261;
const FNV_32_PRIME = 16777619;
const NODE_ID_PREFIX = 'fiber-node';
const COLLISION_SUFFIX_SEPARATOR = '~';

type FiberNodeIdentitySessionState = {
  nodeIdByFiberRef: WeakMap<object, string>;
  nodeIdByRecordKey: Map<string, string>;
  allocatedNodeIds: Set<string>;
  nextCollisionIndexByBaseId: Map<string, number>;
};

export type FiberNodeIdentityResult = Readonly<{
  nodeIdByRecordKey: ReadonlyMap<string, string>;
}>;

export type FiberNodeIdentityAllocator = Readonly<{
  allocateNodeIds: (
    records: FiberTraversalRecord[],
  ) => FiberNodeIdentityResult;
}>;

const createSessionState = (): FiberNodeIdentitySessionState => {
  return {
    nodeIdByFiberRef: new WeakMap<object, string>(),
    nodeIdByRecordKey: new Map<string, string>(),
    allocatedNodeIds: new Set<string>(),
    nextCollisionIndexByBaseId: new Map<string, number>(),
  };
};

const toFiberRef = (fiber: unknown): object | undefined => {
  if (typeof fiber !== 'object' || fiber === null) {
    return undefined;
  }

  return fiber;
};

const readFiberRefValue = (fiberRef: object, key: string) => {
  try {
    return (fiberRef as Record<string, unknown>)[key];
  } catch {
    return undefined;
  }
};

const toAlternateFiberRef = (fiberRef: object): object | undefined => {
  return toFiberRef(readFiberRefValue(fiberRef, 'alternate'));
};

const toStableHash = (value: string) => {
  let hash = FNV_32_OFFSET_BASIS;

  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, FNV_32_PRIME);
  }

  return (hash >>> 0).toString(36);
};

export const toFiberNodeIdentitySignature = (
  record: FiberTraversalRecord,
) => {
  // The signature uses deterministic traversal context only.
  return {
    rendererId: record.rendererId,
    rendererRootIndex: record.rendererRootIndex,
    parentKey: record.parentKey ?? 'root',
    tag: record.tag,
  } as const;
};

const toBaseNodeId = (record: FiberTraversalRecord) => {
  const signature = toFiberNodeIdentitySignature(record);
  const parentHash = toStableHash(signature.parentKey);

  return `${NODE_ID_PREFIX}-r${signature.rendererId}-root${signature.rendererRootIndex}-p${parentHash}-t${signature.tag}`;
};

const toUniqueNodeId = (
  state: FiberNodeIdentitySessionState,
  baseNodeId: string,
) => {
  const nextCollisionIndex =
    state.nextCollisionIndexByBaseId.get(baseNodeId) ?? 1;
  let collisionIndex = nextCollisionIndex;
  let candidateNodeId =
    collisionIndex === 1
      ? baseNodeId
      : `${baseNodeId}${COLLISION_SUFFIX_SEPARATOR}${collisionIndex}`;

  while (state.allocatedNodeIds.has(candidateNodeId)) {
    collisionIndex += 1;
    candidateNodeId =
      collisionIndex === 1
        ? baseNodeId
        : `${baseNodeId}${COLLISION_SUFFIX_SEPARATOR}${collisionIndex}`;
  }

  state.nextCollisionIndexByBaseId.set(baseNodeId, collisionIndex + 1);
  state.allocatedNodeIds.add(candidateNodeId);

  return candidateNodeId;
};

const storeNodeIdMapping = (
  state: FiberNodeIdentitySessionState,
  record: FiberTraversalRecord,
  nodeId: string,
) => {
  const fiberRef = toFiberRef(record.fiber);

  if (fiberRef !== undefined) {
    state.nodeIdByFiberRef.set(fiberRef, nodeId);
    const alternateFiberRef = toAlternateFiberRef(fiberRef);

    if (alternateFiberRef !== undefined) {
      state.nodeIdByFiberRef.set(alternateFiberRef, nodeId);
    }
  }

  state.nodeIdByRecordKey.set(record.key, nodeId);
};

const resolveNodeIdByFiberFamily = (
  state: FiberNodeIdentitySessionState,
  fiber: unknown,
) => {
  const fiberRef = toFiberRef(fiber);

  if (fiberRef === undefined) {
    return undefined;
  }

  const nodeIdFromFiberRef = state.nodeIdByFiberRef.get(fiberRef);

  if (nodeIdFromFiberRef !== undefined) {
    return nodeIdFromFiberRef;
  }

  const alternateFiberRef = toAlternateFiberRef(fiberRef);

  if (alternateFiberRef === undefined) {
    return undefined;
  }

  return state.nodeIdByFiberRef.get(alternateFiberRef);
};

export const createFiberNodeIdentityAllocator = (): FiberNodeIdentityAllocator => {
  const state = createSessionState();

  return {
    allocateNodeIds: (records: FiberTraversalRecord[]) => {
      const nodeIdByRecordKey = new Map<string, string>();
      const allocatedNodeIdsInSnapshot = new Set<string>();
      const nodeIdsReservedForExistingFiberRefs = new Set<string>();

      records.forEach((record) => {
        const nodeIdFromFiberFamily = resolveNodeIdByFiberFamily(
          state,
          record.fiber,
        );

        if (nodeIdFromFiberFamily === undefined) {
          return;
        }

        nodeIdsReservedForExistingFiberRefs.add(nodeIdFromFiberFamily);
      });

      const tryAssignNodeId = (nodeId: string | undefined) => {
        if (nodeId === undefined || allocatedNodeIdsInSnapshot.has(nodeId)) {
          return undefined;
        }

        allocatedNodeIdsInSnapshot.add(nodeId);
        state.allocatedNodeIds.add(nodeId);

        return nodeId;
      };

      records.forEach((record) => {
        const nodeIdFromFiberFamily = resolveNodeIdByFiberFamily(
          state,
          record.fiber,
        );
        const assignedNodeIdFromFiberFamily = tryAssignNodeId(
          nodeIdFromFiberFamily,
        );

        if (assignedNodeIdFromFiberFamily !== undefined) {
          nodeIdByRecordKey.set(record.key, assignedNodeIdFromFiberFamily);
          storeNodeIdMapping(state, record, assignedNodeIdFromFiberFamily);
          return;
        }

        const nodeIdFromRecordKey = state.nodeIdByRecordKey.get(record.key);
        const shouldSkipRecordKeyNodeId =
          nodeIdFromRecordKey !== undefined &&
          nodeIdsReservedForExistingFiberRefs.has(nodeIdFromRecordKey);
        const assignedNodeIdFromRecordKey = shouldSkipRecordKeyNodeId
          ? undefined
          : tryAssignNodeId(nodeIdFromRecordKey);

        if (assignedNodeIdFromRecordKey !== undefined) {
          nodeIdByRecordKey.set(record.key, assignedNodeIdFromRecordKey);
          storeNodeIdMapping(state, record, assignedNodeIdFromRecordKey);
          return;
        }

        const baseNodeId = toBaseNodeId(record);
        const nodeId = toUniqueNodeId(state, baseNodeId);

        allocatedNodeIdsInSnapshot.add(nodeId);
        nodeIdByRecordKey.set(record.key, nodeId);
        storeNodeIdMapping(state, record, nodeId);
      });

      return {
        nodeIdByRecordKey,
      };
    },
  };
};
