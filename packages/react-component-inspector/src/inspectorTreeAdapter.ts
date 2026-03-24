import type {
  InspectorAdapterContract,
  ReactInspectorAdapterContract,
} from './adapters/base/types';

export type InspectorTreeAdapter = InspectorAdapterContract;

export {
  MAX_TREE_SNAPSHOT_NODE_COUNT,
  capTreeSnapshot,
  createBaseInspectorAdapter,
  type CappedInspectorTreeSnapshot,
  type CreateBaseInspectorAdapterOptions,
  type InspectorAdapterNodeLookup,
  type InspectorTreeSnapshot,
} from './adapters/base/baseAdapter';

export const toInspectorTreeAdapter = (
  adapter: ReactInspectorAdapterContract | InspectorTreeAdapter,
): InspectorTreeAdapter => {
  if ('getComponentPathForElement' in adapter) {
    return adapter;
  }

  const legacyComponentPathResolver =
    'getReactComponentPathForElement' in adapter
      ? adapter.getReactComponentPathForElement
      : undefined;

  return {
    getTreeSnapshot: adapter.getTreeSnapshot,
    getNodeProps: adapter.getNodeProps,
    getDomElement: adapter.getDomElement,
    ...(legacyComponentPathResolver !== undefined && {
      getComponentPathForElement: legacyComponentPathResolver,
    }),
  };
};

export const toReactTreeAdapter = (
  adapter: InspectorTreeAdapter,
): ReactInspectorAdapterContract => {
  return {
    getTreeSnapshot: adapter.getTreeSnapshot,
    getNodeProps: adapter.getNodeProps,
    getDomElement: adapter.getDomElement,
    ...(adapter.getComponentPathForElement !== undefined && {
      getReactComponentPathForElement: adapter.getComponentPathForElement,
    }),
  };
};
