import { resolveVueInspectorRuntimeConfig } from './runtimeConfig';
import type {
  InspectorTreeSnapshot,
  VueInspectorAdapterContract,
  VueInspectorRuntimeConfig,
} from './types';

const createEmptyTreeSnapshot = (): InspectorTreeSnapshot => {
  return {
    nodes: [],
    rootIds: [],
  };
};

export const createVueInspectorAdapter = (
  runtimeConfig?: VueInspectorRuntimeConfig,
): VueInspectorAdapterContract => {
  const resolvedRuntimeConfig =
    resolveVueInspectorRuntimeConfig(runtimeConfig);

  return {
    getMountedApps: () => {
      return resolvedRuntimeConfig.appRegistry.getMountedApps(
        resolvedRuntimeConfig.mountedAppDiscovery,
      );
    },
    getTreeSnapshot: () => createEmptyTreeSnapshot(),
    getNodeProps: () => undefined,
    getDomElement: () => null,
  };
};
