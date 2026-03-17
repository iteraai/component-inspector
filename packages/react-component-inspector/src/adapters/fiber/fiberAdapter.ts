import { createBaseReactInspectorAdapter } from '../base/baseAdapter';
import type { ReactInspectorAdapterContract } from '../base/types';
import { resolveFiberHighlightTarget } from './highlightTarget';
import { createFiberNodeIdentityAllocator } from './nodeIdentity';
import { createFiberNodeLookup } from './nodeLookup';
import { readFiberNodeProps } from './props';
import { discoverFiberRoots } from './rootDiscovery';
import { mapFiberTraversalToTreeSnapshot } from './treeMapping';
import { traverseDiscoveredFiberRoots } from './traversal';
import type { RootDiscoveryResult } from './types';

export type FiberAdapterSnapshotDiagnostics = Readonly<{
  discoveryResult: RootDiscoveryResult;
}>;

export type CreateFiberReactInspectorAdapterOptions = Readonly<{
  onSnapshotDiagnostics?: (
    diagnostics: FiberAdapterSnapshotDiagnostics,
  ) => void;
}>;

const emitSnapshotDiagnostics = (
  diagnostics: FiberAdapterSnapshotDiagnostics,
  emit: ((payload: FiberAdapterSnapshotDiagnostics) => void) | undefined,
) => {
  if (emit === undefined) {
    return;
  }

  try {
    emit(diagnostics);
  } catch {
    // Diagnostics sinks must not affect adapter behavior.
  }
};

export const createFiberReactInspectorAdapter = (
  options?: CreateFiberReactInspectorAdapterOptions,
): ReactInspectorAdapterContract => {
  const nodeIdentityAllocator = createFiberNodeIdentityAllocator();
  const nodeLookup = createFiberNodeLookup();

  const refreshSnapshotState = () => {
    const discoveryResult = discoverFiberRoots();
    const traversalResult = traverseDiscoveredFiberRoots(discoveryResult);
    const nodeIdentityResult = nodeIdentityAllocator.allocateNodeIds(
      traversalResult.records,
    );

    const snapshot = mapFiberTraversalToTreeSnapshot({
      traversalResult,
      nodeIdByRecordKey: nodeIdentityResult.nodeIdByRecordKey,
    });

    nodeLookup.refreshFromSnapshot({
      traversalResult,
      nodeIdByRecordKey: nodeIdentityResult.nodeIdByRecordKey,
      snapshot,
    });

    emitSnapshotDiagnostics(
      {
        discoveryResult,
      },
      options?.onSnapshotDiagnostics,
    );

    return snapshot;
  };

  const resolveLookupPayload = (nodeId: string) => {
    try {
      return nodeLookup.resolveByNodeId(nodeId);
    } catch {
      return undefined;
    }
  };

  return createBaseReactInspectorAdapter({
    getTreeSnapshot: () => {
      return refreshSnapshotState();
    },
    getNodeProps: ({ node }) => {
      const lookupPayload = resolveLookupPayload(node.id);

      if (lookupPayload === undefined) {
        return undefined;
      }

      try {
        return readFiberNodeProps(lookupPayload);
      } catch {
        return undefined;
      }
    },
    getDomElement: ({ node }) => {
      const lookupPayload = resolveLookupPayload(node.id);

      if (lookupPayload === undefined) {
        return null;
      }

      try {
        return resolveFiberHighlightTarget(lookupPayload);
      } catch {
        return null;
      }
    },
    getReactComponentPathForElement: (element) => {
      try {
        refreshSnapshotState();
        return nodeLookup.resolveClosestComponentPathForElement(element);
      } catch {
        return undefined;
      }
    },
  });
};
