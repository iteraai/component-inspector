import { resolveAngularDevModeGlobals } from '../angular';
import type {
  AngularInspectorAdapterCapabilities,
  AngularInspectorRuntimeConfig,
  ResolvedAngularInspectorRuntimeConfig,
} from './types';

export const defaultAngularInspectorAdapterCapabilities: AngularInspectorAdapterCapabilities =
  Object.freeze({
    tree: true,
    props: true,
    highlight: true,
  });

export const defaultAngularInspectorRuntimeConfig: ResolvedAngularInspectorRuntimeConfig =
  Object.freeze({
    adapter: 'auto',
    capabilities: defaultAngularInspectorAdapterCapabilities,
    angularGlobals: null,
  });

const resolveCapabilities = (
  capabilities: AngularInspectorRuntimeConfig['capabilities'],
): AngularInspectorAdapterCapabilities => {
  return {
    tree: capabilities?.tree ?? defaultAngularInspectorAdapterCapabilities.tree,
    props:
      capabilities?.props ?? defaultAngularInspectorAdapterCapabilities.props,
    highlight:
      capabilities?.highlight ??
      defaultAngularInspectorAdapterCapabilities.highlight,
  };
};

export const resolveAngularInspectorRuntimeConfig = (
  runtimeConfig?: AngularInspectorRuntimeConfig,
): ResolvedAngularInspectorRuntimeConfig => {
  return {
    adapter:
      runtimeConfig?.adapter ?? defaultAngularInspectorRuntimeConfig.adapter,
    capabilities: resolveCapabilities(runtimeConfig?.capabilities),
    angularGlobals:
      runtimeConfig?.angularGlobals === undefined
        ? resolveAngularDevModeGlobals()
        : runtimeConfig.angularGlobals,
  };
};
