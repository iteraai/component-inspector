import type { InspectorTreeSnapshot } from '../base/types';
import type {
  AngularDiscoveryRecord,
  AngularDiscoveryResult,
} from './discovery';

export type AngularNodeLookupPayload = Readonly<{
  nodeId: string;
  recordKey: string;
  rootIndex: number;
  component: object;
  hostElement: Element;
  displayName: string;
  parentNodeId: string | null;
  childNodeIds: string[];
}>;

export type AngularNodeLookup = Readonly<{
  refreshFromSnapshot: (options: {
    discoveryResult: AngularDiscoveryResult;
    nodeIdByRecordKey: ReadonlyMap<string, string>;
    snapshot: InspectorTreeSnapshot;
  }) => void;
  resolveByNodeId: (nodeId: string) => AngularNodeLookupPayload | undefined;
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
  record: AngularDiscoveryRecord,
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

export const createAngularNodeLookup = (): AngularNodeLookup => {
  let payloadByNodeId = new Map<string, AngularNodeLookupPayload>();

  return {
    refreshFromSnapshot: (options) => {
      const nextPayloadByNodeId = new Map<string, AngularNodeLookupPayload>();
      const includedNodeIdSet = new Set(
        options.snapshot.nodes.map((node) => node.id),
      );

      options.discoveryResult.records.forEach((record) => {
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
          rootIndex: record.rootIndex,
          component: record.component,
          hostElement: record.hostElement,
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
