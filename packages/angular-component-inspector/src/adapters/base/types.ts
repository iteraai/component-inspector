import type { TreeNode, TreeSnapshotMeta } from '@iteraai/inspector-protocol';
import type { AngularDevModeGlobalsApi } from '../angular';

export const angularInspectorRuntimeAdapterTargets = [
  'auto',
  'angular-dev-mode-globals',
  'noop',
] as const;

export type AngularInspectorRuntimeAdapterTarget =
  (typeof angularInspectorRuntimeAdapterTargets)[number];

export type InspectorTreeSnapshot = {
  nodes: TreeNode[];
  rootIds: string[];
  meta?: TreeSnapshotMeta;
};

export type InspectorComponentPath = ReadonlyArray<string>;

export type InspectorAdapterCapabilities = Readonly<{
  tree: boolean;
  props: boolean;
  highlight: boolean;
}>;

export type AngularInspectorAdapterCapabilities = InspectorAdapterCapabilities;

export type InspectorAdapterContract = {
  getTreeSnapshot: () => InspectorTreeSnapshot;
  getNodeProps: (nodeId: string) => unknown | undefined;
  getDomElement: (nodeId: string) => Element | null;
  getComponentPathForElement?: (
    element: Element,
  ) => InspectorComponentPath | undefined;
};

export type AngularInspectorAdapterContract = InspectorAdapterContract & {
  adapterTarget: Exclude<AngularInspectorRuntimeAdapterTarget, 'auto'>;
  isAngularDevModeGlobalsAvailable: boolean;
};

export type AngularInspectorRuntimeConfig = {
  adapter?: AngularInspectorRuntimeAdapterTarget;
  capabilities?: Partial<InspectorAdapterCapabilities>;
  angularGlobals?: AngularDevModeGlobalsApi | null;
};

export type ResolvedAngularInspectorRuntimeConfig = {
  adapter: AngularInspectorRuntimeAdapterTarget;
  capabilities: InspectorAdapterCapabilities;
  angularGlobals: AngularDevModeGlobalsApi | null;
};
