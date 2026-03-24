import { createVue3InspectorAdapter } from '../vue3';
import { resolveVueInspectorRuntimeConfig } from './runtimeConfig';
import type {
  VueInspectorAdapterContract,
  VueInspectorRuntimeConfig,
} from './types';

export const createVueInspectorAdapter = (
  runtimeConfig?: VueInspectorRuntimeConfig,
): VueInspectorAdapterContract => {
  const resolvedRuntimeConfig =
    resolveVueInspectorRuntimeConfig(runtimeConfig);

  const getMountedApps = () => {
    return resolvedRuntimeConfig.appRegistry.getMountedApps(
      resolvedRuntimeConfig.mountedAppDiscovery,
    );
  };

  const adapter = createVue3InspectorAdapter({
    getMountedApps,
  });

  return {
    getMountedApps,
    getTreeSnapshot: () => adapter.getTreeSnapshot(),
    getNodeProps: (nodeId: string) => adapter.getNodeProps(nodeId),
    getDomElement: (nodeId: string) => adapter.getDomElement(nodeId),
  };
};
