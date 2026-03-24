import {
  defaultVueInspectorRuntimeConfig,
  resolveVueInspectorRuntimeConfig,
} from './runtimeConfig';
import type {
  ResolvedVueInspectorRuntimeConfig,
  VueInspectorRuntimeConfig,
} from './types';

type RuntimeConfigContext = {
  runtimeConfig?: VueInspectorRuntimeConfig;
  resolvedRuntimeConfig?: ResolvedVueInspectorRuntimeConfig;
};

const resolvedRuntimeConfigMutated = (context: RuntimeConfigContext) => {
  if (context.resolvedRuntimeConfig === undefined) {
    return context;
  }

  (
    context.resolvedRuntimeConfig.capabilities as {
      tree: boolean;
    }
  ).tree = true;

  return context;
};

describe('resolveVueInspectorRuntimeConfig', () => {
  test('returns deterministic defaults when runtime config is undefined', () => {
    expect(resolveVueInspectorRuntimeConfig()).toEqual(
      defaultVueInspectorRuntimeConfig,
    );
  });

  test('defaults missing runtime config fields while preserving explicit values', () => {
    expect(
      resolveVueInspectorRuntimeConfig({
        capabilities: {
          highlight: true,
        },
        mountedAppDiscovery: {
          strategy: 'explicit-only',
        },
      }),
    ).toEqual({
      adapter: 'auto',
      capabilities: {
        tree: true,
        props: true,
        highlight: true,
      },
      appRegistry: defaultVueInspectorRuntimeConfig.appRegistry,
      mountedAppDiscovery: {
        strategy: 'explicit-only',
        containerSelector: '[data-v-app]',
      },
    });
  });

  test('uses explicit adapter and custom discovery config without rewriting values', () => {
    expect(
      resolveVueInspectorRuntimeConfig({
        adapter: 'vue3',
        mountedAppDiscovery: {
          strategy: 'dom-only',
          containerSelector: '[data-test-v-app]',
        },
      }),
    ).toEqual({
      adapter: 'vue3',
      capabilities: {
        tree: true,
        props: true,
        highlight: true,
      },
      appRegistry: defaultVueInspectorRuntimeConfig.appRegistry,
      mountedAppDiscovery: {
        strategy: 'dom-only',
        containerSelector: '[data-test-v-app]',
      },
    });
  });

  test('keeps deterministic defaults even when resolved results are mutated', () => {
    const context = resolvedRuntimeConfigMutated({
      resolvedRuntimeConfig: resolveVueInspectorRuntimeConfig(),
    });

    expect(context.resolvedRuntimeConfig).toEqual({
      adapter: 'auto',
      capabilities: {
        tree: true,
        props: true,
        highlight: true,
      },
      appRegistry: defaultVueInspectorRuntimeConfig.appRegistry,
      mountedAppDiscovery: {
        strategy: 'auto',
        containerSelector: '[data-v-app]',
      },
    });
    expect(resolveVueInspectorRuntimeConfig()).toEqual(
      defaultVueInspectorRuntimeConfig,
    );
  });
});
