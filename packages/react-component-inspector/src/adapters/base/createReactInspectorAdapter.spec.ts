import { given } from '#test/givenWhenThen';
import type { ReactTreeSnapshot } from './baseAdapter';
import { createReactInspectorAdapter } from './createReactInspectorAdapter';
import type { ReactInspectorRuntimeConfig } from './types';
import {
  EMBEDDED_BRIDGE_TELEMETRY_METRIC_NAME_FIBER_FALLBACK,
  EMBEDDED_BRIDGE_TELEMETRY_SCHEMA_VERSION,
  type EmbeddedBridgeFiberFallbackTelemetryMetric,
} from '../../security/bridgeTelemetry';

type AdapterFactoryContext = {
  onFiberFallbackMetric: ReturnType<
    typeof vi.fn<(metric: EmbeddedBridgeFiberFallbackTelemetryMetric) => void>
  >;
  runtimeConfig?: ReactInspectorRuntimeConfig;
  adapter?: ReturnType<typeof createReactInspectorAdapter>;
  snapshot?: ReactTreeSnapshot;
  firstSnapshot?: ReactTreeSnapshot;
  secondSnapshot?: ReactTreeSnapshot;
  resolvedComponentPath?: ReadonlyArray<string>;
  firstSnapshotRootDomElement?: Element | null;
};

type MockFiber = {
  tag: number;
  type?: unknown;
  stateNode?: unknown;
  child?: MockFiber;
  sibling?: MockFiber;
  return?: MockFiber;
};

const windowRefWithDevtoolsHook = window as Window & {
  __REACT_DEVTOOLS_GLOBAL_HOOK__?: unknown;
};

const contextCreated = (): AdapterFactoryContext => {
  document.body.innerHTML = '';
  delete windowRefWithDevtoolsHook.__REACT_DEVTOOLS_GLOBAL_HOOK__;

  return {
    onFiberFallbackMetric:
      vi.fn<(metric: EmbeddedBridgeFiberFallbackTelemetryMetric) => void>(),
  };
};

const runtimeConfigSetToAuto = (
  context: AdapterFactoryContext,
): AdapterFactoryContext => {
  context.runtimeConfig = {
    adapter: 'auto',
  };

  return context;
};

const runtimeConfigSetToVite = (
  context: AdapterFactoryContext,
): AdapterFactoryContext => {
  context.runtimeConfig = {
    adapter: 'vite',
  };

  return context;
};

const runtimeConfigSetToNext = (
  context: AdapterFactoryContext,
): AdapterFactoryContext => {
  context.runtimeConfig = {
    adapter: 'next',
  };

  return context;
};

const runtimeConfigSetToCra = (
  context: AdapterFactoryContext,
): AdapterFactoryContext => {
  context.runtimeConfig = {
    adapter: 'cra',
  };

  return context;
};

const runtimeConfigSetToFiber = (
  context: AdapterFactoryContext,
): AdapterFactoryContext => {
  context.runtimeConfig = {
    adapter: 'fiber',
  };

  return context;
};

const domPreparedWithRootElement = (
  context: AdapterFactoryContext,
): AdapterFactoryContext => {
  document.body.innerHTML = `
    <div id="root">
      <main>
        <button><span id="publish-label">Publish iteration</span></button>
      </main>
    </div>
  `;

  return context;
};

const domPreparedWithNextPagesRootElement = (
  context: AdapterFactoryContext,
): AdapterFactoryContext => {
  document.body.innerHTML = `
    <div id="__next">
      <main>next-pages-root</main>
    </div>
  `;

  return context;
};

const createMockFiber = (tag: number, type?: unknown): MockFiber => {
  return {
    tag,
    type,
  };
};

const connectFiberChildren = (parent: MockFiber, children: MockFiber[]) => {
  if (children.length === 0) {
    return;
  }

  parent.child = children[0];

  children.forEach((child, index) => {
    child.return = parent;
    child.sibling = children[index + 1];
  });
};

const fiberHookConfiguredWithComponentTree = (
  context: AdapterFactoryContext,
): AdapterFactoryContext => {
  const hostRootFiber = createMockFiber(3);
  const appShellFiber = createMockFiber(0, function AppShell() {});
  const forwardRefFiber = createMockFiber(11, {
    $$typeof: Symbol.for('react.forward_ref'),
    render: function ToolbarButton() {},
  });
  const memoFiber = createMockFiber(14, {
    $$typeof: Symbol.for('react.memo'),
    type: function MemoPanel() {},
  });
  const publishButtonElement = document.querySelector('button');

  expect(publishButtonElement).not.toBeNull();
  assert(publishButtonElement instanceof HTMLButtonElement);

  const hostButtonFiber = createMockFiber(5, 'button');
  hostButtonFiber.stateNode = publishButtonElement;

  connectFiberChildren(hostRootFiber, [appShellFiber]);
  connectFiberChildren(appShellFiber, [forwardRefFiber, memoFiber]);
  connectFiberChildren(forwardRefFiber, [hostButtonFiber]);
  Object.defineProperty(publishButtonElement, '__reactFiber$test', {
    configurable: true,
    value: hostButtonFiber,
  });

  windowRefWithDevtoolsHook.__REACT_DEVTOOLS_GLOBAL_HOOK__ = {
    renderers: new Map([[1, { rendererName: 'mock-renderer' }]]),
    getFiberRoots: (rendererId: number) => {
      if (rendererId !== 1) {
        return new Set();
      }

      return new Set([
        {
          current: hostRootFiber,
        },
      ]);
    },
  };

  return context;
};

const fiberHookConfiguredWithEmptyRenderers = (
  context: AdapterFactoryContext,
): AdapterFactoryContext => {
  windowRefWithDevtoolsHook.__REACT_DEVTOOLS_GLOBAL_HOOK__ = {
    renderers: new Map(),
    getFiberRoots: () => {
      return new Set();
    },
  };

  return context;
};

const snapshotLoadedFromFactoryAdapter = (
  context: AdapterFactoryContext,
): AdapterFactoryContext => {
  context.snapshot = createReactInspectorAdapter(context.runtimeConfig, {
    telemetry: {
      onFiberFallbackMetric: context.onFiberFallbackMetric,
    },
  }).getTreeSnapshot();

  return context;
};

const adapterLoadedFromFactory = (
  context: AdapterFactoryContext,
): AdapterFactoryContext => {
  context.adapter = createReactInspectorAdapter(context.runtimeConfig, {
    telemetry: {
      onFiberFallbackMetric: context.onFiberFallbackMetric,
    },
  });

  return context;
};

const firstSnapshotLoadedFromAdapter = (
  context: AdapterFactoryContext,
): AdapterFactoryContext => {
  context.firstSnapshot = context.adapter?.getTreeSnapshot();

  return context;
};

const secondSnapshotLoadedFromAdapter = (
  context: AdapterFactoryContext,
): AdapterFactoryContext => {
  context.secondSnapshot = context.adapter?.getTreeSnapshot();

  return context;
};

const reactComponentPathResolvedFromNestedDomElement = (
  context: AdapterFactoryContext,
): AdapterFactoryContext => {
  const nestedLabelElement = document.getElementById('publish-label');

  expect(nestedLabelElement).not.toBeNull();
  assert(nestedLabelElement instanceof HTMLElement);

  context.resolvedComponentPath =
    context.adapter?.getReactComponentPathForElement?.(nestedLabelElement);

  return context;
};

const firstSnapshotRootDomElementLoadedFromAdapter = (
  context: AdapterFactoryContext,
): AdapterFactoryContext => {
  const firstRootNodeId = context.firstSnapshot?.rootIds[0];

  context.firstSnapshotRootDomElement =
    firstRootNodeId === undefined
      ? undefined
      : context.adapter?.getDomElement(firstRootNodeId);

  return context;
};

const noDomEnvironmentConfigured = (
  context: AdapterFactoryContext,
): AdapterFactoryContext => {
  vi.stubGlobal('document', undefined);

  return context;
};

const expectSnapshotToBeEmpty = (context: AdapterFactoryContext) => {
  expect(context.snapshot).toEqual({
    nodes: [],
    rootIds: [],
  });
};

const expectSnapshotToUseViteFallbackRoot = (
  context: AdapterFactoryContext,
) => {
  expect(context.snapshot?.rootIds).toEqual(['itera-app-root']);
  expect(context.snapshot?.nodes.map((node) => node.id)).toEqual([
    'itera-app-root',
  ]);

  return context;
};

const expectSnapshotToUseNextPagesFallbackRoot = (
  context: AdapterFactoryContext,
) => {
  expect(context.snapshot?.rootIds).toEqual(['next-pages-root']);
  expect(context.snapshot?.nodes.map((node) => node.id)).toEqual([
    'next-pages-root',
  ]);
};

const expectSnapshotToUseCraFallbackRoot = (context: AdapterFactoryContext) => {
  expect(context.snapshot?.rootIds).toEqual(['cra-root']);
  expect(context.snapshot?.nodes.map((node) => node.id)).toEqual(['cra-root']);
};

const expectSnapshotToUseFiberTree = (context: AdapterFactoryContext) => {
  expect(context.snapshot?.nodes.length).toBeGreaterThan(1);
  expect(context.snapshot?.rootIds).toHaveLength(1);
  expect(context.snapshot?.rootIds[0]).toMatch(/^fiber-node-/);
  expect(context.snapshot?.nodes.map((node) => node.displayName)).toEqual([
    'AppShell',
    'ForwardRef(ToolbarButton)',
    'Memo(MemoPanel)',
  ]);
  expect(
    context.snapshot?.nodes.every((node) => node.tags?.includes('fiber')),
  ).toBe(true);
};

const expectFirstSnapshotToFallbackAndSecondSnapshotToUseFiberTree = (
  context: AdapterFactoryContext,
) => {
  expect(context.firstSnapshot?.rootIds).toEqual(['itera-app-root']);
  expect(context.firstSnapshot?.nodes.map((node) => node.id)).toEqual([
    'itera-app-root',
  ]);
  expect(context.secondSnapshot?.nodes.length).toBeGreaterThan(1);
  expect(context.secondSnapshot?.rootIds).toHaveLength(1);
  expect(context.secondSnapshot?.rootIds[0]).toMatch(/^fiber-node-/);
  expect(context.secondSnapshot?.nodes.map((node) => node.displayName)).toEqual(
    ['AppShell', 'ForwardRef(ToolbarButton)', 'Memo(MemoPanel)'],
  );
};

const expectReactComponentPathLookupToPreserveFallbackAdapterState = (
  context: AdapterFactoryContext,
) => {
  expect(context.resolvedComponentPath).toEqual([
    'AppShell',
    'ForwardRef(ToolbarButton)',
  ]);
  expect(context.firstSnapshotRootDomElement).toBe(
    document.getElementById('root'),
  );

  return context;
};

const expectFiberFallbackTelemetryToReportHookMissing = (
  context: AdapterFactoryContext,
) => {
  expect(context.onFiberFallbackMetric).toHaveBeenCalledTimes(1);
  expect(context.onFiberFallbackMetric).toHaveBeenCalledWith({
    schemaVersion: EMBEDDED_BRIDGE_TELEMETRY_SCHEMA_VERSION,
    metricName: EMBEDDED_BRIDGE_TELEMETRY_METRIC_NAME_FIBER_FALLBACK,
    reasonCode: 'hook-missing',
    fallbackAdapterTarget: 'vite',
    count: 1,
  });

  return context;
};

const expectFiberFallbackTelemetryToReportRendererEmpty = (
  context: AdapterFactoryContext,
) => {
  expect(context.onFiberFallbackMetric).toHaveBeenCalledTimes(1);
  expect(context.onFiberFallbackMetric).toHaveBeenCalledWith({
    schemaVersion: EMBEDDED_BRIDGE_TELEMETRY_SCHEMA_VERSION,
    metricName: EMBEDDED_BRIDGE_TELEMETRY_METRIC_NAME_FIBER_FALLBACK,
    reasonCode: 'renderer-empty',
    fallbackAdapterTarget: 'vite',
    count: 1,
  });

  return context;
};

const expectFiberFallbackTelemetryToBeDeduped = (
  context: AdapterFactoryContext,
) => {
  expect(context.firstSnapshot?.rootIds).toEqual(['itera-app-root']);
  expect(context.secondSnapshot?.rootIds).toEqual(['itera-app-root']);
  expect(context.onFiberFallbackMetric).toHaveBeenCalledTimes(1);
};

describe('createReactInspectorAdapter', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    document.body.innerHTML = '';
    delete windowRefWithDevtoolsHook.__REACT_DEVTOOLS_GLOBAL_HOOK__;
  });

  test('should keep auto adapter on noop snapshot path', () => {
    return given(contextCreated)
      .when(runtimeConfigSetToAuto)
      .when(domPreparedWithRootElement)
      .when(snapshotLoadedFromFactoryAdapter)
      .then(expectSnapshotToBeEmpty);
  });

  test('should route to vite adapter when vite runtime target is selected', () => {
    return given(contextCreated)
      .when(runtimeConfigSetToVite)
      .when(domPreparedWithRootElement)
      .when(snapshotLoadedFromFactoryAdapter)
      .then(expectSnapshotToUseViteFallbackRoot);
  });

  test('should route to next adapter when next runtime target is selected', () => {
    return given(contextCreated)
      .when(runtimeConfigSetToNext)
      .when(domPreparedWithNextPagesRootElement)
      .when(snapshotLoadedFromFactoryAdapter)
      .then(expectSnapshotToUseNextPagesFallbackRoot);
  });

  test('should route to cra adapter when cra runtime target is selected', () => {
    return given(contextCreated)
      .when(runtimeConfigSetToCra)
      .when(domPreparedWithRootElement)
      .when(snapshotLoadedFromFactoryAdapter)
      .then(expectSnapshotToUseCraFallbackRoot);
  });

  test('should route to fiber adapter when fiber runtime target is selected and fiber runtime is supported', () => {
    return given(contextCreated)
      .when(runtimeConfigSetToFiber)
      .when(domPreparedWithRootElement)
      .when(fiberHookConfiguredWithComponentTree)
      .when(snapshotLoadedFromFactoryAdapter)
      .then(expectSnapshotToUseFiberTree);
  });

  test('should fallback to existing tag adapter path when fiber runtime target is selected but fiber runtime is unavailable', () => {
    return given(contextCreated)
      .when(runtimeConfigSetToFiber)
      .when(domPreparedWithRootElement)
      .when(snapshotLoadedFromFactoryAdapter)
      .then(expectSnapshotToUseViteFallbackRoot)
      .then(expectFiberFallbackTelemetryToReportHookMissing);
  });

  test('should fallback to next tag adapter path when fiber runtime target is selected in next-like document shape', () => {
    return given(contextCreated)
      .when(runtimeConfigSetToFiber)
      .when(domPreparedWithNextPagesRootElement)
      .when(snapshotLoadedFromFactoryAdapter)
      .then(expectSnapshotToUseNextPagesFallbackRoot);
  });

  test('should keep root discovery fallback reason when renderer registry is empty', () => {
    return given(contextCreated)
      .when(runtimeConfigSetToFiber)
      .when(domPreparedWithRootElement)
      .when(fiberHookConfiguredWithEmptyRenderers)
      .when(snapshotLoadedFromFactoryAdapter)
      .then(expectSnapshotToUseViteFallbackRoot)
      .then(expectFiberFallbackTelemetryToReportRendererEmpty);
  });

  test('should emit fiber fallback telemetry once for repeated fallback snapshots with unchanged diagnostics', () => {
    return given(contextCreated)
      .when(runtimeConfigSetToFiber)
      .when(domPreparedWithRootElement)
      .when(adapterLoadedFromFactory)
      .when(firstSnapshotLoadedFromAdapter)
      .when(secondSnapshotLoadedFromAdapter)
      .then(expectFiberFallbackTelemetryToBeDeduped);
  });

  test('should re-check fiber readiness and switch from fallback snapshot to fiber snapshot when runtime becomes available later in-session', () => {
    return given(contextCreated)
      .when(runtimeConfigSetToFiber)
      .when(domPreparedWithRootElement)
      .when(adapterLoadedFromFactory)
      .when(firstSnapshotLoadedFromAdapter)
      .when(fiberHookConfiguredWithComponentTree)
      .when(secondSnapshotLoadedFromAdapter)
      .then(expectFirstSnapshotToFallbackAndSecondSnapshotToUseFiberTree);
  });

  test('should keep fallback node ids addressable until the next snapshot refresh when component path lookup succeeds later in-session', () => {
    return given(contextCreated)
      .when(runtimeConfigSetToFiber)
      .when(domPreparedWithRootElement)
      .when(adapterLoadedFromFactory)
      .when(firstSnapshotLoadedFromAdapter)
      .when(fiberHookConfiguredWithComponentTree)
      .when(reactComponentPathResolvedFromNestedDomElement)
      .when(firstSnapshotRootDomElementLoadedFromAdapter)
      .when(secondSnapshotLoadedFromAdapter)
      .then(expectReactComponentPathLookupToPreserveFallbackAdapterState)
      .then(expectFirstSnapshotToFallbackAndSecondSnapshotToUseFiberTree);
  });

  test('should fail soft to an empty snapshot when fallback adapter construction throws in non-dom environments', () => {
    return given(contextCreated)
      .when(runtimeConfigSetToFiber)
      .when(noDomEnvironmentConfigured)
      .when(snapshotLoadedFromFactoryAdapter)
      .then(expectSnapshotToBeEmpty);
  });
});
