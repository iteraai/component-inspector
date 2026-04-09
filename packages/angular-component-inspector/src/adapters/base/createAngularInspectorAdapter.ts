import {
  createAngularDevModeGlobalsInspectorAdapter,
  hasRequiredAngularDevModeGlobals,
} from '../angular';
import { resolveAngularInspectorRuntimeConfig } from './runtimeConfig';
import type {
  AngularInspectorAdapterContract,
  AngularInspectorRuntimeConfig,
} from './types';

const createNoopAngularInspectorAdapter = (): AngularInspectorAdapterContract => {
  return {
    adapterTarget: 'noop',
    isAngularDevModeGlobalsAvailable: false,
    getTreeSnapshot: () => ({
      nodes: [],
      rootIds: [],
    }),
    getNodeProps: () => undefined,
    getDomElement: () => null,
  };
};

export const createAngularInspectorAdapter = (
  runtimeConfig?: AngularInspectorRuntimeConfig,
): AngularInspectorAdapterContract => {
  const resolvedRuntimeConfig =
    resolveAngularInspectorRuntimeConfig(runtimeConfig);

  switch (resolvedRuntimeConfig.adapter) {
    case 'angular-dev-mode-globals': {
      return createAngularDevModeGlobalsInspectorAdapter({
        angularGlobals: resolvedRuntimeConfig.angularGlobals,
      });
    }

    case 'noop': {
      return createNoopAngularInspectorAdapter();
    }

    case 'auto': {
      return hasRequiredAngularDevModeGlobals(
        resolvedRuntimeConfig.angularGlobals,
      )
        ? createAngularDevModeGlobalsInspectorAdapter({
            angularGlobals: resolvedRuntimeConfig.angularGlobals,
          })
        : createNoopAngularInspectorAdapter();
    }
  }
};
