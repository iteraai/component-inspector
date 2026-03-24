import type { InspectorTreeSnapshot, VueMountedAppRecord } from '../base/types';
import type { VueTraversalRecord, VueTraversalResult } from './traversal';

export type VueNodeLookupPayload = Readonly<{
  nodeId: string;
  recordKey: string;
  appRecord: VueMountedAppRecord;
  rootIndex: number;
  instance: unknown;
  displayName: string;
  parentNodeId: string | null;
  childNodeIds: string[];
}>;

export type VueNodeLookup = Readonly<{
  refreshFromSnapshot: (options: {
    traversalResult: VueTraversalResult;
    nodeIdByRecordKey: ReadonlyMap<string, string>;
    snapshot: InspectorTreeSnapshot;
  }) => void;
  resolveByNodeId: (nodeId: string) => VueNodeLookupPayload | undefined;
}>;

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
  record: VueTraversalRecord,
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

export const createVueNodeLookup = (): VueNodeLookup => {
  let payloadByNodeId = new Map<string, VueNodeLookupPayload>();

  return {
    refreshFromSnapshot: (options) => {
      const nextPayloadByNodeId = new Map<string, VueNodeLookupPayload>();
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
          appRecord: record.appRecord,
          rootIndex: record.rootIndex,
          instance: record.instance,
          displayName: record.displayName,
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
      });

      payloadByNodeId = nextPayloadByNodeId;
    },
    resolveByNodeId: (nodeId: string) => {
      return payloadByNodeId.get(nodeId);
    },
  };
};
