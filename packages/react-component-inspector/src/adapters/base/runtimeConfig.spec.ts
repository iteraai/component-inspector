import { given } from '#test/givenWhenThen';
import {
  defaultReactInspectorRuntimeConfig,
  resolveReactInspectorRuntimeConfig,
} from './runtimeConfig';
import type {
  ReactInspectorRuntimeConfig,
  ResolvedReactInspectorRuntimeConfig,
} from './types';

type RuntimeConfigContext = {
  runtimeConfig?: ReactInspectorRuntimeConfig;
  resolvedRuntimeConfig?: ResolvedReactInspectorRuntimeConfig;
};

const contextCreated = (): RuntimeConfigContext => {
  return {};
};

const runtimeConfigSetToUndefined = (
  context: RuntimeConfigContext,
): RuntimeConfigContext => {
  context.runtimeConfig = undefined;

  return context;
};

const runtimeConfigSetToPartialCapabilities = (
  context: RuntimeConfigContext,
): RuntimeConfigContext => {
  context.runtimeConfig = {
    capabilities: {
      highlight: false,
    },
  };

  return context;
};

const runtimeConfigSetToExplicitAdapterAndCapabilities = (
  context: RuntimeConfigContext,
): RuntimeConfigContext => {
  context.runtimeConfig = {
    adapter: 'next',
    capabilities: {
      tree: false,
      props: true,
      highlight: false,
    },
  };

  return context;
};

const runtimeConfigSetToFiberAdapterOnly = (
  context: RuntimeConfigContext,
): RuntimeConfigContext => {
  context.runtimeConfig = {
    adapter: 'fiber',
  };

  return context;
};

const runtimeConfigResolved = (
  context: RuntimeConfigContext,
): RuntimeConfigContext => {
  context.resolvedRuntimeConfig = resolveReactInspectorRuntimeConfig(
    context.runtimeConfig,
  );

  return context;
};

const resolvedRuntimeConfigMutated = (
  context: RuntimeConfigContext,
): RuntimeConfigContext => {
  if (context.resolvedRuntimeConfig === undefined) {
    return context;
  }

  (
    context.resolvedRuntimeConfig.capabilities as {
      tree: boolean;
    }
  ).tree = false;

  return context;
};

const expectDefaultRuntimeConfig = (context: RuntimeConfigContext) => {
  expect(context.resolvedRuntimeConfig).toEqual(
    defaultReactInspectorRuntimeConfig,
  );
};

const expectCapabilitiesDefaultedWithExplicitFalsePreserved = (
  context: RuntimeConfigContext,
) => {
  expect(context.resolvedRuntimeConfig).toEqual({
    adapter: 'auto',
    capabilities: {
      tree: true,
      props: true,
      highlight: false,
    },
  });
};

const expectExplicitAdapterAndCapabilities = (
  context: RuntimeConfigContext,
) => {
  expect(context.resolvedRuntimeConfig).toEqual({
    adapter: 'next',
    capabilities: {
      tree: false,
      props: true,
      highlight: false,
    },
  });
};

const expectDefaultRuntimeConfigUnaffectedAfterMutation = (
  _context: RuntimeConfigContext,
) => {
  expect(resolveReactInspectorRuntimeConfig()).toEqual(
    defaultReactInspectorRuntimeConfig,
  );
};

const expectFiberAdapterResolvedWithDefaultCapabilities = (
  context: RuntimeConfigContext,
) => {
  expect(context.resolvedRuntimeConfig).toEqual({
    adapter: 'fiber',
    capabilities: {
      tree: true,
      props: true,
      highlight: true,
    },
  });
};

describe('runtimeConfig', () => {
  test('returns deterministic defaults when runtime config is undefined', () => {
    return given(contextCreated)
      .when(runtimeConfigSetToUndefined)
      .when(runtimeConfigResolved)
      .then(expectDefaultRuntimeConfig);
  });

  test('defaults missing capabilities and preserves explicit false values', () => {
    return given(contextCreated)
      .when(runtimeConfigSetToPartialCapabilities)
      .when(runtimeConfigResolved)
      .then(expectCapabilitiesDefaultedWithExplicitFalsePreserved);
  });

  test('uses explicit adapter and capabilities without rewriting values', () => {
    return given(contextCreated)
      .when(runtimeConfigSetToExplicitAdapterAndCapabilities)
      .when(runtimeConfigResolved)
      .then(expectExplicitAdapterAndCapabilities);
  });

  test('keeps deterministic defaults even when resolved result is mutated', () => {
    return given(contextCreated)
      .when(runtimeConfigResolved)
      .when(resolvedRuntimeConfigMutated)
      .then(expectDefaultRuntimeConfigUnaffectedAfterMutation);
  });

  test('supports explicit fiber adapter target while preserving default capabilities', () => {
    return given(contextCreated)
      .when(runtimeConfigSetToFiberAdapterOnly)
      .when(runtimeConfigResolved)
      .then(expectFiberAdapterResolvedWithDefaultCapabilities);
  });
});
