import { createBaseInspectorAdapter } from '../base/baseAdapter';
import type { InspectorAdapterContract, VueMountedAppRecord } from '../base/types';
import { createVueNodeIdentityAllocator } from './nodeIdentity';
import { mapVueTraversalToTreeSnapshot } from './treeMapping';
import { traverseVueMountedApps } from './traversal';

export type CreateVue3InspectorAdapterOptions = Readonly<{
  getMountedApps: () => readonly VueMountedAppRecord[];
}>;

export const createVue3InspectorAdapter = (
  options: CreateVue3InspectorAdapterOptions,
): InspectorAdapterContract => {
  const nodeIdentityAllocator = createVueNodeIdentityAllocator();

  const readSnapshot = () => {
    const traversalResult = traverseVueMountedApps(options.getMountedApps());
    const { nodeIdByRecordKey } = nodeIdentityAllocator.allocateNodeIds(
      traversalResult.records,
    );

    return mapVueTraversalToTreeSnapshot({
      traversalResult,
      nodeIdByRecordKey,
    });
  };

  return createBaseInspectorAdapter({
    getTreeSnapshot: () => readSnapshot(),
  });
};
