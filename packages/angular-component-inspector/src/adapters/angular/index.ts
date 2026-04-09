export {
  angularInspectorRequiredDevModeGlobalNames,
  createAngularDevModeGlobalsInspectorAdapter,
  hasRequiredAngularDevModeGlobals,
  resolveAngularDevModeGlobals,
  type AngularDevModeGlobalsApi,
} from './angularGlobals';
export {
  createAngularDevModeGlobalsAdapter,
} from './angularAdapter';
export {
  createAngularNodeIdentityAllocator,
  type AngularNodeIdentityAllocator,
  type AngularNodeIdentityResult,
} from './nodeIdentity';
export {
  discoverAngularComponentTree,
  type AngularDiscoveryRecord,
  type AngularDiscoveryResult,
} from './discovery';
export { mapAngularDiscoveryToTreeSnapshot } from './treeMapping';
