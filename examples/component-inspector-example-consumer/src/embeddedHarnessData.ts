import type { TreeNode } from '@iteraai/inspector-protocol';
import type {
  ReactTreeAdapter,
  ReactTreeSnapshot,
} from '@iteraai/react-component-inspector';

type ExampleNodePropsById = Record<string, Record<string, unknown>>;

const exampleNodes: TreeNode[] = [
  {
    id: 'root-app',
    displayName: 'ExampleEmbeddedHarness',
    parentId: null,
    childrenIds: ['hero-card', 'checklist-panel', 'media-panel'],
  },
  {
    id: 'hero-card',
    displayName: 'HeroCard',
    parentId: 'root-app',
    childrenIds: [],
  },
  {
    id: 'checklist-panel',
    displayName: 'ChecklistPanel',
    parentId: 'root-app',
    childrenIds: ['publish-button'],
  },
  {
    id: 'publish-button',
    displayName: 'PublishButton',
    parentId: 'checklist-panel',
    childrenIds: [],
  },
  {
    id: 'media-panel',
    displayName: 'MediaPanel',
    parentId: 'root-app',
    childrenIds: ['preview-image'],
  },
  {
    id: 'preview-image',
    displayName: 'PreviewImage',
    parentId: 'media-panel',
    childrenIds: [],
  },
];

export const exampleTreeSnapshot: ReactTreeSnapshot = {
  nodes: exampleNodes,
  rootIds: ['root-app'],
};

export const exampleNodePropsById: ExampleNodePropsById = {
  'root-app': {
    title: 'Customer fixture',
    mode: 'embedded',
  },
  'hero-card': {
    eyebrow: 'Public SDK consumer',
    tone: 'warm',
  },
  'checklist-panel': {
    checks: ['handshake', 'tree', 'props', 'selection'],
  },
  'publish-button': {
    label: 'Publish iteration',
    variant: 'primary',
    analyticsEvent: 'example_publish_iteration',
  },
  'media-panel': {
    title: 'Preview-ready media',
    layout: 'card',
  },
  'preview-image': {
    alt: 'Modern workspace with a bright monitor and sketchbook',
    aspectRatio: '16 / 10',
    assetReference: '/fixture-workspace.png',
  },
};

export const createExampleHarnessAdapter = (
  doc: Document = document,
): ReactTreeAdapter => {
  return {
    getTreeSnapshot: () => exampleTreeSnapshot,
    getNodeProps: (nodeId: string) => exampleNodePropsById[nodeId],
    getDomElement: (nodeId: string) =>
      doc.querySelector(`[data-inspector-node-id="${nodeId}"]`),
  };
};
