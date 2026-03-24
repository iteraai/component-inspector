import type { InspectorTreeSnapshot, ReactTreeSnapshot } from './baseAdapter';

export const reactInspectorRuntimeAdapterTargets = [
  'auto',
  'vite',
  'next',
  'cra',
  'fiber',
] as const;

export type ReactInspectorRuntimeAdapterTarget =
  (typeof reactInspectorRuntimeAdapterTargets)[number];

export type InspectorAdapterCapabilities = Readonly<{
  tree: boolean;
  props: boolean;
  highlight: boolean;
}>;

export type ReactInspectorAdapterCapabilities = InspectorAdapterCapabilities;

export type InspectorComponentPath = ReadonlyArray<string>;

export type ReactInspectorComponentPath = InspectorComponentPath;

export type InspectorAdapterContract = {
  getTreeSnapshot: () => InspectorTreeSnapshot;
  getNodeProps: (nodeId: string) => unknown | undefined;
  getDomElement: (nodeId: string) => Element | null;
  getComponentPathForElement?: (
    element: Element,
  ) => InspectorComponentPath | undefined;
};

export type ReactInspectorAdapterContract = {
  getTreeSnapshot: () => ReactTreeSnapshot;
  getNodeProps: (nodeId: string) => unknown | undefined;
  getDomElement: (nodeId: string) => Element | null;
  getReactComponentPathForElement?: (
    element: Element,
  ) => ReactInspectorComponentPath | undefined;
};

export type ReactInspectorRuntimeConfig = {
  adapter?: ReactInspectorRuntimeAdapterTarget;
  capabilities?: Partial<InspectorAdapterCapabilities>;
};

export type ResolvedReactInspectorRuntimeConfig = {
  adapter: ReactInspectorRuntimeAdapterTarget;
  capabilities: InspectorAdapterCapabilities;
};
