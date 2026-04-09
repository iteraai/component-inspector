export { createAngularInspectorAdapter } from './createAngularInspectorAdapter';
export {
  defaultAngularInspectorAdapterCapabilities,
  defaultAngularInspectorRuntimeConfig,
  resolveAngularInspectorRuntimeConfig,
} from './runtimeConfig';
export {
  angularInspectorRequiredDevModeGlobalNames,
  createAngularDevModeGlobalsInspectorAdapter,
  hasRequiredAngularDevModeGlobals,
  resolveAngularDevModeGlobals,
  type AngularDevModeGlobalsApi,
} from '../angular';
export {
  angularInspectorRuntimeAdapterTargets,
  type AngularInspectorAdapterCapabilities,
  type AngularInspectorAdapterContract,
  type AngularInspectorRuntimeAdapterTarget,
  type AngularInspectorRuntimeConfig,
  type ResolvedAngularInspectorRuntimeConfig,
} from './types';
