import type { ReactInspectorAdapterContract } from './adapters/base/types';

export type ReactTreeAdapter = ReactInspectorAdapterContract;
export {
  MAX_TREE_SNAPSHOT_NODE_COUNT,
  capTreeSnapshot,
  createBaseReactInspectorAdapter,
  type BaseAdapterNodeLookup,
  type CappedReactTreeSnapshot,
  type CreateBaseReactInspectorAdapterOptions,
  type ReactTreeSnapshot,
} from './adapters/base/baseAdapter';
