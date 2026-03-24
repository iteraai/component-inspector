export {
  createVueInspectorAdapter,
  createVueMountedAppRegistry,
  defaultVueInspectorAdapterCapabilities,
  defaultVueInspectorRuntimeConfig,
  defaultVueMountedAppDiscovery,
  defaultVueMountedAppRegistry,
  discoverMountedVueApps,
  getMountedVueApps,
  registerMountedVueApp,
  resolveMountedVueAppContainer,
  resolveVueInspectorRuntimeConfig,
  resolveVueMountContainer,
  vueInspectorMountedAppDiscoveryStrategies,
  vueInspectorRuntimeAdapterTargets,
} from './adapters/base';
export {
  registerVueAppOnMount,
  type RegisterVueAppOnMountOptions,
} from './embeddedBootstrap';
