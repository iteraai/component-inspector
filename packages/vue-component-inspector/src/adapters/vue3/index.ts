export {
  createVue3InspectorAdapter,
  type CreateVue3InspectorAdapterOptions,
} from './vue3Adapter';
export { resolveVueHighlightTarget } from './highlightTarget';
export { createVueNodeIdentityAllocator } from './nodeIdentity';
export {
  createVueNodeLookup,
  type VueNodeLookup,
  type VueNodeLookupPayload,
} from './nodeLookup';
export { readVueNodeProps } from './props';
export { readVueNodeSource } from './source';
export { mapVueTraversalToTreeSnapshot } from './treeMapping';
export {
  traverseVueMountedApps,
  type VueTraversalRecord,
  type VueTraversalResult,
} from './traversal';
