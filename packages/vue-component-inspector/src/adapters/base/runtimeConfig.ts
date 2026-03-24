import { defaultVueMountedAppRegistry } from './mountedAppRegistry';
import {
  DEFAULT_VUE_MOUNTED_APP_CONTAINER_SELECTOR,
  type InspectorAdapterCapabilities,
  type ResolvedVueInspectorRuntimeConfig,
  type ResolvedVueMountedAppDiscoveryOptions,
  type VueInspectorRuntimeConfig,
  type VueMountedAppDiscoveryOptions,
} from './types';

export const defaultVueInspectorAdapterCapabilities: InspectorAdapterCapabilities =
  Object.freeze({
    tree: false,
    props: false,
    highlight: false,
  });

export const defaultVueMountedAppDiscovery: ResolvedVueMountedAppDiscoveryOptions =
  Object.freeze({
    strategy: 'auto',
    containerSelector: DEFAULT_VUE_MOUNTED_APP_CONTAINER_SELECTOR,
  });

export const defaultVueInspectorRuntimeConfig: ResolvedVueInspectorRuntimeConfig =
  Object.freeze({
    adapter: 'auto',
    capabilities: defaultVueInspectorAdapterCapabilities,
    appRegistry: defaultVueMountedAppRegistry,
    mountedAppDiscovery: defaultVueMountedAppDiscovery,
  });

const resolveCapabilities = (
  capabilities: VueInspectorRuntimeConfig['capabilities'],
): InspectorAdapterCapabilities => {
  return {
    tree: capabilities?.tree ?? defaultVueInspectorAdapterCapabilities.tree,
    props: capabilities?.props ?? defaultVueInspectorAdapterCapabilities.props,
    highlight:
      capabilities?.highlight ??
      defaultVueInspectorAdapterCapabilities.highlight,
  };
};

const resolveMountedAppDiscovery = (
  mountedAppDiscovery: VueMountedAppDiscoveryOptions | undefined,
): ResolvedVueMountedAppDiscoveryOptions => {
  return {
    strategy:
      mountedAppDiscovery?.strategy ?? defaultVueMountedAppDiscovery.strategy,
    containerSelector:
      mountedAppDiscovery?.containerSelector ??
      defaultVueMountedAppDiscovery.containerSelector,
    ...(mountedAppDiscovery?.root !== undefined && {
      root: mountedAppDiscovery.root,
    }),
  };
};

export const resolveVueInspectorRuntimeConfig = (
  runtimeConfig?: VueInspectorRuntimeConfig,
): ResolvedVueInspectorRuntimeConfig => {
  return {
    adapter: runtimeConfig?.adapter ?? defaultVueInspectorRuntimeConfig.adapter,
    capabilities: resolveCapabilities(runtimeConfig?.capabilities),
    appRegistry:
      runtimeConfig?.appRegistry ?? defaultVueInspectorRuntimeConfig.appRegistry,
    mountedAppDiscovery: resolveMountedAppDiscovery(
      runtimeConfig?.mountedAppDiscovery,
    ),
  };
};
