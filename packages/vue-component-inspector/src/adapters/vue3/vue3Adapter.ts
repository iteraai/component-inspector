import { createBaseInspectorAdapter } from '../base/baseAdapter';
import type { InspectorAdapterContract, VueMountedAppRecord } from '../base/types';
import { resolveVueHighlightTarget } from './highlightTarget';
import { createVueNodeIdentityAllocator } from './nodeIdentity';
import { createVueNodeLookup } from './nodeLookup';
import { readVueNodeProps } from './props';
import { mapVueTraversalToTreeSnapshot } from './treeMapping';
import { traverseVueMountedApps } from './traversal';

export type CreateVue3InspectorAdapterOptions = Readonly<{
  getMountedApps: () => readonly VueMountedAppRecord[];
}>;

export const createVue3InspectorAdapter = (
  options: CreateVue3InspectorAdapterOptions,
): InspectorAdapterContract => {
  const nodeIdentityAllocator = createVueNodeIdentityAllocator();
  const nodeLookup = createVueNodeLookup();

  const refreshSnapshotState = () => {
    const traversalResult = traverseVueMountedApps(options.getMountedApps());
    const nodeIdentityResult = nodeIdentityAllocator.allocateNodeIds(
      traversalResult.records,
    );
    const snapshot = mapVueTraversalToTreeSnapshot({
      traversalResult,
      nodeIdByRecordKey: nodeIdentityResult.nodeIdByRecordKey,
    });

    nodeLookup.refreshFromSnapshot({
      traversalResult,
      nodeIdByRecordKey: nodeIdentityResult.nodeIdByRecordKey,
      snapshot,
    });

    return snapshot;
  };

  const resolveLookupPayload = (nodeId: string) => {
    try {
      return nodeLookup.resolveByNodeId(nodeId);
    } catch {
      return undefined;
    }
  };

  return createBaseInspectorAdapter({
    getTreeSnapshot: () => refreshSnapshotState(),
    getNodeProps: ({ node }) => {
      const lookupPayload = resolveLookupPayload(node.id);

      if (lookupPayload === undefined) {
        return undefined;
      }

      try {
        return readVueNodeProps(lookupPayload);
      } catch {
        return {};
      }
    },
    getDomElement: ({ node }) => {
      const lookupPayload = resolveLookupPayload(node.id);

      if (lookupPayload === undefined) {
        return null;
      }

      try {
        return resolveVueHighlightTarget(lookupPayload);
      } catch {
        return null;
      }
    },
    getComponentPathForElement: (element) => {
      try {
        refreshSnapshotState();
        return nodeLookup.resolveClosestComponentPathForElement(element);
      } catch {
        return undefined;
      }
    },
  });
};
