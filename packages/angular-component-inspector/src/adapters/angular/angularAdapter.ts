import type { AngularInspectorAdapterContract } from '../base/types';
import type { AngularDevModeGlobalsApi } from './angularGlobals';
import { discoverAngularComponentTree } from './discovery';
import { resolveAngularHighlightTarget } from './highlightTarget';
import { createAngularNodeIdentityAllocator } from './nodeIdentity';
import { createAngularNodeLookup } from './nodeLookup';
import { readAngularNodeProps } from './props';
import { mapAngularDiscoveryToTreeSnapshot } from './treeMapping';

type AngularDevModeGlobalsAdapter = Pick<
  AngularInspectorAdapterContract,
  'getTreeSnapshot' | 'getNodeProps' | 'getDomElement'
>;

export const createAngularDevModeGlobalsAdapter = (options: {
  angularGlobals: AngularDevModeGlobalsApi;
}): AngularDevModeGlobalsAdapter => {
  const nodeIdentityAllocator = createAngularNodeIdentityAllocator();
  const nodeLookup = createAngularNodeLookup();

  const refreshSnapshotState = () => {
    const discoveryResult = discoverAngularComponentTree({
      angularGlobals: options.angularGlobals,
    });
    const nodeIdentityResult = nodeIdentityAllocator.allocateNodeIds(
      discoveryResult.records,
    );
    const snapshot = mapAngularDiscoveryToTreeSnapshot({
      discoveryResult,
      nodeIdByRecordKey: nodeIdentityResult.nodeIdByRecordKey,
    });

    nodeLookup.refreshFromSnapshot({
      discoveryResult,
      nodeIdByRecordKey: nodeIdentityResult.nodeIdByRecordKey,
      snapshot,
    });

    return snapshot;
  };

  const resolveLookupPayload = (nodeId: string) => {
    try {
      refreshSnapshotState();
      return nodeLookup.resolveByNodeId(nodeId);
    } catch {
      return undefined;
    }
  };

  return {
    getTreeSnapshot: () => refreshSnapshotState(),
    getNodeProps: (nodeId: string) => {
      const lookupPayload = resolveLookupPayload(nodeId);

      if (lookupPayload === undefined) {
        return undefined;
      }

      try {
        return readAngularNodeProps({
          lookupPayload,
          angularGlobals: options.angularGlobals,
        });
      } catch {
        return {};
      }
    },
    getDomElement: (nodeId: string) => {
      const lookupPayload = resolveLookupPayload(nodeId);

      if (lookupPayload === undefined) {
        return null;
      }

      try {
        return resolveAngularHighlightTarget({
          lookupPayload,
          angularGlobals: options.angularGlobals,
        });
      } catch {
        return null;
      }
    },
  };
};
