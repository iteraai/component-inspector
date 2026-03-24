import type { TreeNode, TreeSnapshotMeta } from '@iteraai/inspector-protocol';
import type { App } from 'vue';

export const DEFAULT_VUE_MOUNTED_APP_CONTAINER_SELECTOR = '[data-v-app]';

export const vueInspectorRuntimeAdapterTargets = ['auto', 'vue3'] as const;

export type VueInspectorRuntimeAdapterTarget =
  (typeof vueInspectorRuntimeAdapterTargets)[number];

export const vueInspectorMountedAppDiscoveryStrategies = [
  'auto',
  'explicit-only',
  'dom-only',
] as const;

export type VueInspectorMountedAppDiscoveryStrategy =
  (typeof vueInspectorMountedAppDiscoveryStrategies)[number];

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

export type VueInspectorAdapterCapabilities = InspectorAdapterCapabilities;

export type VueMountedAppContainer = Element | ShadowRoot;

export type VueMountedAppSource = 'explicit' | 'dom';

export type VueMountedAppRecord = Readonly<{
  app: App;
  container: VueMountedAppContainer;
  source: VueMountedAppSource;
}>;

export type VueMountedAppDiscoveryOptions = {
  strategy?: VueInspectorMountedAppDiscoveryStrategy;
  containerSelector?: string;
  root?: ParentNode;
};

export type ResolvedVueMountedAppDiscoveryOptions = {
  strategy: VueInspectorMountedAppDiscoveryStrategy;
  containerSelector: string;
  root?: ParentNode;
};

export type RegisterMountedVueAppOptions = {
  container?: VueMountedAppContainer | null;
};

export type VueMountedAppRegistration = {
  destroy: () => void;
};

export type VueMountedAppRegistry = {
  registerApp: (
    app: App,
    options?: RegisterMountedVueAppOptions,
  ) => VueMountedAppRegistration;
  getMountedApps: (
    options?: VueMountedAppDiscoveryOptions,
  ) => readonly VueMountedAppRecord[];
  destroy: () => void;
};

export type InspectorAdapterContract = {
  getTreeSnapshot: () => InspectorTreeSnapshot;
  getNodeProps: (nodeId: string) => unknown | undefined;
  getDomElement: (nodeId: string) => Element | null;
  getComponentPathForElement?: (
    element: Element,
  ) => InspectorComponentPath | undefined;
};

export type VueInspectorAdapterContract = InspectorAdapterContract & {
  getMountedApps: () => readonly VueMountedAppRecord[];
};

export type VueInspectorRuntimeConfig = {
  adapter?: VueInspectorRuntimeAdapterTarget;
  capabilities?: Partial<InspectorAdapterCapabilities>;
  appRegistry?: VueMountedAppRegistry;
  mountedAppDiscovery?: VueMountedAppDiscoveryOptions;
};

export type ResolvedVueInspectorRuntimeConfig = {
  adapter: VueInspectorRuntimeAdapterTarget;
  capabilities: InspectorAdapterCapabilities;
  appRegistry: VueMountedAppRegistry;
  mountedAppDiscovery: ResolvedVueMountedAppDiscoveryOptions;
};
