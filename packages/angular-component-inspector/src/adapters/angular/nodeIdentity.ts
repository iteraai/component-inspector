import type { AngularDiscoveryRecord } from './discovery';

const FNV_32_OFFSET_BASIS = 2166136261;
const FNV_32_PRIME = 16777619;
const NODE_ID_PREFIX = 'angular-node';
const COLLISION_SUFFIX_SEPARATOR = '~';

type AngularNodeIdentitySessionState = {
  nodeIdByComponentRef: WeakMap<object, string>;
  nodeIdByRecordKey: Map<string, string>;
  allocatedNodeIds: Set<string>;
  nextCollisionIndexByBaseId: Map<string, number>;
};

export type AngularNodeIdentityResult = Readonly<{
  nodeIdByRecordKey: ReadonlyMap<string, string>;
}>;

export type AngularNodeIdentityAllocator = Readonly<{
  allocateNodeIds: (
    records: AngularDiscoveryRecord[],
  ) => AngularNodeIdentityResult;
}>;

const createSessionState = (): AngularNodeIdentitySessionState => {
  return {
    nodeIdByComponentRef: new WeakMap<object, string>(),
    nodeIdByRecordKey: new Map<string, string>(),
    allocatedNodeIds: new Set<string>(),
    nextCollisionIndexByBaseId: new Map<string, number>(),
  };
};

const toStableHash = (value: string) => {
  let hash = FNV_32_OFFSET_BASIS;

  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, FNV_32_PRIME);
  }

  return (hash >>> 0).toString(36);
};

const toBaseNodeId = (record: AngularDiscoveryRecord) => {
  const parentHash = toStableHash(record.parentKey ?? 'root');
  const displayNameHash = toStableHash(record.displayName);
  const hostTagHash = toStableHash(record.hostTag);

  return `${NODE_ID_PREFIX}-r${record.rootIndex}-p${parentHash}-d${displayNameHash}-h${hostTagHash}`;
};

const toUniqueNodeId = (
  state: AngularNodeIdentitySessionState,
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
  state: AngularNodeIdentitySessionState,
  record: AngularDiscoveryRecord,
  nodeId: string,
) => {
  state.nodeIdByComponentRef.set(record.component, nodeId);
  state.nodeIdByRecordKey.set(record.key, nodeId);
};

export const createAngularNodeIdentityAllocator =
  (): AngularNodeIdentityAllocator => {
    const state = createSessionState();

    return {
      allocateNodeIds: (records) => {
        const nodeIdByRecordKey = new Map<string, string>();
        const allocatedNodeIdsInSnapshot = new Set<string>();
        const nodeIdsReservedForExistingComponents = new Set<string>();

        records.forEach((record) => {
          const nodeIdFromComponent = state.nodeIdByComponentRef.get(
            record.component,
          );

          if (nodeIdFromComponent !== undefined) {
            nodeIdsReservedForExistingComponents.add(nodeIdFromComponent);
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
          const nodeIdFromComponent = state.nodeIdByComponentRef.get(
            record.component,
          );
          const assignedNodeIdFromComponent = tryAssignNodeId(nodeIdFromComponent);

          if (assignedNodeIdFromComponent !== undefined) {
            nodeIdByRecordKey.set(record.key, assignedNodeIdFromComponent);
            storeNodeIdMapping(state, record, assignedNodeIdFromComponent);
            return;
          }

          const nodeIdFromRecordKey = state.nodeIdByRecordKey.get(record.key);
          const shouldSkipRecordKeyNodeId =
            nodeIdFromRecordKey !== undefined &&
            nodeIdsReservedForExistingComponents.has(nodeIdFromRecordKey);
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
