import type { AngularInspectorAdapterContract } from '../base/types';
import type { AngularDevModeGlobalsApi } from './angularGlobals';
import { discoverAngularComponentTree } from './discovery';
import { createAngularNodeIdentityAllocator } from './nodeIdentity';
import { mapAngularDiscoveryToTreeSnapshot } from './treeMapping';

type AngularDevModeGlobalsAdapter = Pick<
  AngularInspectorAdapterContract,
  'getTreeSnapshot' | 'getNodeProps' | 'getDomElement'
>;

export const createAngularDevModeGlobalsAdapter = (options: {
  angularGlobals: AngularDevModeGlobalsApi;
}): AngularDevModeGlobalsAdapter => {
  const nodeIdentityAllocator = createAngularNodeIdentityAllocator();

  return {
    getTreeSnapshot: () => {
      const discoveryResult = discoverAngularComponentTree({
        angularGlobals: options.angularGlobals,
      });
      const nodeIdentityResult = nodeIdentityAllocator.allocateNodeIds(
        discoveryResult.records,
      );

      return mapAngularDiscoveryToTreeSnapshot({
        discoveryResult,
        nodeIdByRecordKey: nodeIdentityResult.nodeIdByRecordKey,
      });
    },
    getNodeProps: () => undefined,
    getDomElement: () => null,
  };
};
