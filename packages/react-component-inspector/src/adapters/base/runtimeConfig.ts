import type {
  ReactInspectorAdapterCapabilities,
  ReactInspectorRuntimeConfig,
  ResolvedReactInspectorRuntimeConfig,
} from './types';

export const defaultReactInspectorAdapterCapabilities: ReactInspectorAdapterCapabilities =
  Object.freeze({
    tree: true,
    props: true,
    highlight: true,
  });

export const defaultReactInspectorRuntimeConfig: ResolvedReactInspectorRuntimeConfig =
  Object.freeze({
    adapter: 'auto',
    capabilities: defaultReactInspectorAdapterCapabilities,
  });

const resolveCapabilities = (
  capabilities: ReactInspectorRuntimeConfig['capabilities'],
): ReactInspectorAdapterCapabilities => {
  return {
    tree: capabilities?.tree ?? defaultReactInspectorAdapterCapabilities.tree,
    props:
      capabilities?.props ?? defaultReactInspectorAdapterCapabilities.props,
    highlight:
      capabilities?.highlight ??
      defaultReactInspectorAdapterCapabilities.highlight,
  };
};

export const resolveReactInspectorRuntimeConfig = (
  runtimeConfig?: ReactInspectorRuntimeConfig,
): ResolvedReactInspectorRuntimeConfig => {
  return {
    adapter: runtimeConfig?.adapter ?? defaultReactInspectorRuntimeConfig.adapter,
    capabilities: resolveCapabilities(runtimeConfig?.capabilities),
  };
};
