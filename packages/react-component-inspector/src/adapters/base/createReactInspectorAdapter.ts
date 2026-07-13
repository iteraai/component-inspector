import {
  createBaseInspectorAdapter,
  type InspectorTreeSnapshot,
} from './baseAdapter';
import {
  toInspectorTreeAdapter,
  toReactTreeAdapter,
} from '../../inspectorTreeAdapter';
import { resolveReactInspectorRuntimeConfig } from './runtimeConfig';
import type {
  InspectorAdapterContract,
  ReactInspectorAdapterContract,
  ReactInspectorRuntimeConfig,
  ReactInspectorRuntimeAdapterTarget,
} from './types';
import { createCraReactInspectorAdapter } from '../cra/craAdapter';
import {
  createFiberReactInspectorAdapter,
  type FiberAdapterSnapshotDiagnostics,
} from '../fiber/fiberAdapter';
import { createNextReactInspectorAdapter } from '../next/nextAdapter';
import { createViteReactInspectorAdapter } from '../vite/viteAdapter';
import {
  emitEmbeddedBridgeFiberFallbackMetric,
  type EmbeddedBridgeFiberFallbackReasonCode,
  type EmbeddedBridgeTelemetryHooks,
} from '../../security/bridgeTelemetry';

const emptyTreeSnapshot: InspectorTreeSnapshot = {
  nodes: [],
  rootIds: [],
};

const createNoopAdapter = (): InspectorAdapterContract => {
  return createBaseInspectorAdapter({
    getTreeSnapshot: () => emptyTreeSnapshot,
  });
};

type TagAdapterTarget = Exclude<
  ReactInspectorRuntimeAdapterTarget,
  'auto' | 'fiber'
>;

type FiberFallbackAdapterTarget = TagAdapterTarget | 'noop';

export type CreateReactInspectorAdapterOptions = Readonly<{
  telemetry?: EmbeddedBridgeTelemetryHooks;
}>;

const hasNonEmptyTreeSnapshot = (snapshot: InspectorTreeSnapshot) => {
  return snapshot.nodes.length > 0;
};

const resolveLikelyTagAdapterTarget = (): TagAdapterTarget => {
  if (typeof document === 'undefined') {
    return 'vite';
  }

  if (
    document.getElementById('__next') !== null ||
    document.querySelector('[data-nextjs-scroll-focus-boundary]') !== null
  ) {
    return 'next';
  }

  if (document.querySelector('[data-reactroot]') !== null) {
    return 'cra';
  }

  return 'vite';
};

const createTagAdapter = (target: TagAdapterTarget) => {
  if (target === 'vite') {
    return createViteReactInspectorAdapter();
  }

  if (target === 'next') {
    return createNextReactInspectorAdapter();
  }

  return createCraReactInspectorAdapter();
};

const toTagFallbackTargets = (preferredTarget: TagAdapterTarget) => {
  const fallbackTargets: TagAdapterTarget[] = [];
  const orderedTargets: TagAdapterTarget[] = ['vite', 'next', 'cra'];

  fallbackTargets.push(preferredTarget);

  orderedTargets.forEach((candidateTarget) => {
    if (candidateTarget !== preferredTarget) {
      fallbackTargets.push(candidateTarget);
    }
  });

  return fallbackTargets;
};

const toSafeTreeSnapshot = (adapter: InspectorAdapterContract) => {
  try {
    return adapter.getTreeSnapshot();
  } catch {
    return undefined;
  }
};

const resolveFiberFallbackAdapter = () => {
  const preferredTarget = resolveLikelyTagAdapterTarget();

  for (const fallbackTarget of toTagFallbackTargets(preferredTarget)) {
    let fallbackAdapter: InspectorAdapterContract;

    try {
      fallbackAdapter = toInspectorTreeAdapter(
        createTagAdapter(fallbackTarget),
      );
    } catch {
      continue;
    }

    const fallbackSnapshot = toSafeTreeSnapshot(fallbackAdapter);

    if (
      fallbackSnapshot !== undefined &&
      hasNonEmptyTreeSnapshot(fallbackSnapshot)
    ) {
      return {
        adapter: fallbackAdapter,
        snapshot: fallbackSnapshot,
        target: fallbackTarget,
      };
    }
  }

  return {
    adapter: createNoopAdapter(),
    snapshot: emptyTreeSnapshot,
    target: 'noop' as const,
  };
};

const toFiberFallbackReasonCode = (
  fiberSnapshot: InspectorTreeSnapshot | undefined,
  diagnostics: FiberAdapterSnapshotDiagnostics | undefined,
): EmbeddedBridgeFiberFallbackReasonCode => {
  if (fiberSnapshot === undefined) {
    return 'snapshot-read-failed';
  }

  if (
    diagnostics === undefined ||
    diagnostics.discoveryResult.status === 'ok'
  ) {
    return 'snapshot-empty';
  }

  return diagnostics.discoveryResult.reason;
};

const createFiberAdapterWithFallback = (
  options?: CreateReactInspectorAdapterOptions,
): ReactInspectorAdapterContract => {
  let latestFiberSnapshotDiagnostics:
    | FiberAdapterSnapshotDiagnostics
    | undefined;
  let lastFallbackMetricSignature: string | undefined;
  const fiberAdapter = toInspectorTreeAdapter(
    createFiberReactInspectorAdapter({
      onSnapshotDiagnostics: (diagnostics) => {
        latestFiberSnapshotDiagnostics = diagnostics;
      },
    }),
  );
  let activeAdapter: InspectorAdapterContract = fiberAdapter;
  let pendingSnapshot: InspectorTreeSnapshot | undefined;

  const emitFiberFallbackMetric = (
    reasonCode: EmbeddedBridgeFiberFallbackReasonCode,
    fallbackAdapterTarget: FiberFallbackAdapterTarget,
  ) => {
    const metricSignature = `${reasonCode}:${fallbackAdapterTarget}`;

    if (metricSignature === lastFallbackMetricSignature) {
      return;
    }

    lastFallbackMetricSignature = metricSignature;

    emitEmbeddedBridgeFiberFallbackMetric(
      {
        reasonCode,
        fallbackAdapterTarget,
      },
      options?.telemetry,
    );
  };

  const resolveAdapter = () => {
    const fiberSnapshot = toSafeTreeSnapshot(fiberAdapter);

    if (fiberSnapshot !== undefined && hasNonEmptyTreeSnapshot(fiberSnapshot)) {
      lastFallbackMetricSignature = undefined;
      activeAdapter = fiberAdapter;
      pendingSnapshot = fiberSnapshot;
      return activeAdapter;
    }

    const fallbackResolution = resolveFiberFallbackAdapter();
    const fallbackReasonCode = toFiberFallbackReasonCode(
      fiberSnapshot,
      latestFiberSnapshotDiagnostics,
    );

    emitFiberFallbackMetric(fallbackReasonCode, fallbackResolution.target);

    activeAdapter = fallbackResolution.adapter;
    pendingSnapshot = fallbackResolution.snapshot;

    return activeAdapter;
  };

  return toReactTreeAdapter({
    getTreeSnapshot: () => {
      const resolvedAdapter = resolveAdapter();

      if (pendingSnapshot !== undefined) {
        const nextSnapshot = pendingSnapshot;

        pendingSnapshot = undefined;
        return nextSnapshot;
      }

      return resolvedAdapter.getTreeSnapshot();
    },
    getNodeProps: (nodeId: string) => {
      return activeAdapter.getNodeProps(nodeId);
    },
    getDomElement: (nodeId: string) => {
      return activeAdapter.getDomElement(nodeId);
    },
    getComponentPathForElement: (element: Element) => {
      return fiberAdapter.getComponentPathForElement?.(element);
    },
  });
};

export const createReactInspectorAdapter = (
  runtimeConfig?: ReactInspectorRuntimeConfig,
  options?: CreateReactInspectorAdapterOptions,
): ReactInspectorAdapterContract => {
  const resolvedRuntimeConfig =
    resolveReactInspectorRuntimeConfig(runtimeConfig);

  if (resolvedRuntimeConfig.adapter === 'auto') {
    return toReactTreeAdapter(createNoopAdapter());
  }

  if (resolvedRuntimeConfig.adapter === 'vite') {
    return createViteReactInspectorAdapter();
  }

  if (resolvedRuntimeConfig.adapter === 'next') {
    return createNextReactInspectorAdapter();
  }

  if (resolvedRuntimeConfig.adapter === 'cra') {
    return createCraReactInspectorAdapter();
  }

  if (resolvedRuntimeConfig.adapter === 'fiber') {
    return createFiberAdapterWithFallback(options);
  }

  return toReactTreeAdapter(createNoopAdapter());
};
