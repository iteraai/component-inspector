import type { VueTraversalRecord } from './traversal';

const FNV_32_OFFSET_BASIS = 2166136261;
const FNV_32_PRIME = 16777619;
const NODE_ID_PREFIX = 'vue-node';
const COLLISION_SUFFIX_SEPARATOR = '~';

type VueNodeIdentitySessionState = {
  nodeIdByInstanceRef: WeakMap<object, string>;
  nodeIdByRecordKey: Map<string, string>;
  allocatedNodeIds: Set<string>;
  nextCollisionIndexByBaseId: Map<string, number>;
};

export type VueNodeIdentityResult = Readonly<{
  nodeIdByRecordKey: ReadonlyMap<string, string>;
}>;

export type VueNodeIdentityAllocator = Readonly<{
  allocateNodeIds: (records: VueTraversalRecord[]) => VueNodeIdentityResult;
}>;

const createSessionState = (): VueNodeIdentitySessionState => {
  return {
    nodeIdByInstanceRef: new WeakMap<object, string>(),
    nodeIdByRecordKey: new Map<string, string>(),
    allocatedNodeIds: new Set<string>(),
    nextCollisionIndexByBaseId: new Map<string, number>(),
  };
};

const readObjectValue = (value: object, key: string) => {
  try {
    return (value as Record<string, unknown>)[key];
  } catch {
    return undefined;
  }
};

const toStableHash = (value: string) => {
  let hash = FNV_32_OFFSET_BASIS;

  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, FNV_32_PRIME);
  }

  return (hash >>> 0).toString(36);
};

const toBaseNodeId = (record: VueTraversalRecord) => {
  const uidValue = readObjectValue(record.instance, 'uid');

  if (
    typeof uidValue === 'number' &&
    Number.isInteger(uidValue) &&
    uidValue >= 0
  ) {
    return `${NODE_ID_PREFIX}-r${record.rootIndex}-u${uidValue}`;
  }

  const parentHash = toStableHash(record.parentKey ?? 'root');
  const displayNameHash = toStableHash(record.displayName);
  const nodeKeyHash =
    record.nodeKey === undefined ? 'nokey' : toStableHash(record.nodeKey);

  return `${NODE_ID_PREFIX}-r${record.rootIndex}-p${parentHash}-d${displayNameHash}-k${nodeKeyHash}`;
};

const toUniqueNodeId = (
  state: VueNodeIdentitySessionState,
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

const resolveNodeIdByInstanceRef = (
  state: VueNodeIdentitySessionState,
  record: VueTraversalRecord,
) => {
  return state.nodeIdByInstanceRef.get(record.instance);
};

const storeNodeIdMapping = (
  state: VueNodeIdentitySessionState,
  record: VueTraversalRecord,
  nodeId: string,
) => {
  state.nodeIdByInstanceRef.set(record.instance, nodeId);
  state.nodeIdByRecordKey.set(record.key, nodeId);
};

export const createVueNodeIdentityAllocator = (): VueNodeIdentityAllocator => {
  const state = createSessionState();

  return {
    allocateNodeIds: (records) => {
      const nodeIdByRecordKey = new Map<string, string>();
      const allocatedNodeIdsInSnapshot = new Set<string>();
      const nodeIdsReservedForExistingInstances = new Set<string>();

      records.forEach((record) => {
        const nodeIdFromInstance = resolveNodeIdByInstanceRef(state, record);

        if (nodeIdFromInstance !== undefined) {
          nodeIdsReservedForExistingInstances.add(nodeIdFromInstance);
        }
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
        const nodeIdFromInstance = resolveNodeIdByInstanceRef(state, record);
        const assignedNodeIdFromInstance = tryAssignNodeId(nodeIdFromInstance);

        if (assignedNodeIdFromInstance !== undefined) {
          nodeIdByRecordKey.set(record.key, assignedNodeIdFromInstance);
          storeNodeIdMapping(state, record, assignedNodeIdFromInstance);
          return;
        }

        const nodeIdFromRecordKey = state.nodeIdByRecordKey.get(record.key);
        const shouldSkipRecordKeyNodeId =
          nodeIdFromRecordKey !== undefined &&
          nodeIdsReservedForExistingInstances.has(nodeIdFromRecordKey);
        const assignedNodeIdFromRecordKey = shouldSkipRecordKeyNodeId
          ? undefined
          : tryAssignNodeId(nodeIdFromRecordKey);

        if (assignedNodeIdFromRecordKey !== undefined) {
          nodeIdByRecordKey.set(record.key, assignedNodeIdFromRecordKey);
          storeNodeIdMapping(state, record, assignedNodeIdFromRecordKey);
          return;
        }

        const nodeId = toUniqueNodeId(state, toBaseNodeId(record));

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
