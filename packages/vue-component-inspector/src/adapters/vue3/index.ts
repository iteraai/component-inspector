export {
  createVue3InspectorAdapter,
  type CreateVue3InspectorAdapterOptions,
} from './vue3Adapter';
export { createVueNodeIdentityAllocator } from './nodeIdentity';
export { readVueNodeSource } from './source';
export { mapVueTraversalToTreeSnapshot } from './treeMapping';
export {
  traverseVueMountedApps,
  type VueTraversalRecord,
  type VueTraversalResult,
} from './traversal';
