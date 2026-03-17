import type { ReactTreeSnapshot } from './baseAdapter';

export const reactInspectorRuntimeAdapterTargets = [
  'auto',
  'vite',
  'next',
  'cra',
  'fiber',
] as const;

export type ReactInspectorRuntimeAdapterTarget =
  (typeof reactInspectorRuntimeAdapterTargets)[number];

export type ReactInspectorAdapterCapabilities = Readonly<{
  tree: boolean;
  props: boolean;
  highlight: boolean;
}>;

export type ReactInspectorComponentPath = ReadonlyArray<string>;

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
  capabilities?: Partial<ReactInspectorAdapterCapabilities>;
};

export type ResolvedReactInspectorRuntimeConfig = {
  adapter: ReactInspectorRuntimeAdapterTarget;
  capabilities: ReactInspectorAdapterCapabilities;
};
