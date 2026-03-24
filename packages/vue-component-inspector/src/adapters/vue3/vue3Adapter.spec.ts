import {
  KeepAlive,
  Suspense,
  type App,
  createApp,
  defineComponent,
  h,
  nextTick,
  ref,
} from 'vue';
import { createVueInspectorAdapter } from '../base/createVueInspectorAdapter';
import type { VueMountedAppRecord } from '../base/types';
import { createVue3InspectorAdapter } from './vue3Adapter';

const createMountedAdapter = (appDefinition: Parameters<typeof createApp>[0]) => {
  const container = document.createElement('div');

  document.body.append(container);

  const app = createApp(appDefinition);

  app.mount(container);

  return {
    app,
    adapter: createVueInspectorAdapter(),
  };
};

const stripVueDomMarkers = (root: ParentNode) => {
  root.querySelectorAll('*').forEach((element) => {
    Reflect.deleteProperty(
      element as Element & Record<string, unknown>,
      '__vueParentComponent',
    );
    Reflect.deleteProperty(
      element as Element & Record<string, unknown>,
      '__vnode',
    );
  });
};

const toNodeByDisplayName = (
  snapshot: ReturnType<ReturnType<typeof createVueInspectorAdapter>['getTreeSnapshot']>,
) => {
  return new Map(snapshot.nodes.map((node) => [node.displayName, node]));
};

const createMockMountedAppRecord = (
  options: {
    rootDisplayName: string;
    childDisplayName: string;
    rootUid?: number;
    childUid?: number;
  },
  container: Element,
): VueMountedAppRecord => {
  const childInstance = {
    uid: options.childUid ?? 1,
    type: {
      name: options.childDisplayName,
    },
    vnode: {
      key: null,
    },
    subTree: {
      type: 'div',
    },
  };
  const rootInstance = {
    uid: options.rootUid ?? 0,
    type: {
      name: options.rootDisplayName,
    },
    vnode: {
      key: null,
    },
    subTree: {
      component: childInstance,
    },
  };

  return {
    app: {
      _instance: rootInstance,
    } as App,
    container,
    source: 'explicit',
  };
};

afterEach(() => {
  document.body.innerHTML = '';
  vi.restoreAllMocks();
});

describe('vue3Adapter', () => {
  test('returns stable component props payloads and resolves highlight targets for DOM and fragment roots', () => {
    const PropsLeaf = defineComponent({
      name: 'PropsLeaf',
      props: {
        title: {
          type: String,
          required: true,
        },
        count: {
          type: Number,
          required: true,
        },
      },
      setup: (props) => () =>
        h('button', { id: 'props-leaf-button' }, `${props.title}:${props.count}`),
    });
    const FragmentLeaf = defineComponent({
      name: 'FragmentLeaf',
      props: {
        marker: {
          type: String,
          required: true,
        },
      },
      setup: (props) => () => [
        h('span', { id: `${props.marker}-first` }, 'first'),
        h('span', { id: `${props.marker}-second` }, 'second'),
      ],
    });
    const TreeRoot = defineComponent({
      name: 'HighlightAndPropsTreeRoot',
      setup: () =>
        () =>
          h('main', [
            h(PropsLeaf, {
              title: 'Toolbar',
              count: 2,
            }),
            h(FragmentLeaf, {
              marker: 'fragment-leaf',
            }),
          ]),
    });
    const { app, adapter } = createMountedAdapter(TreeRoot);
    const firstSnapshot = adapter.getTreeSnapshot();
    const secondSnapshot = adapter.getTreeSnapshot();
    const firstNodeByName = toNodeByDisplayName(firstSnapshot);
    const propsLeafNodeId = firstNodeByName.get('PropsLeaf')?.id as string;
    const fragmentLeafNodeId = firstNodeByName.get('FragmentLeaf')?.id as string;

    expect(firstSnapshot).toEqual(secondSnapshot);
    expect(adapter.getNodeProps(propsLeafNodeId)).toEqual({
      title: 'Toolbar',
      count: 2,
    });
    expect(adapter.getNodeProps(fragmentLeafNodeId)).toEqual({
      marker: 'fragment-leaf',
    });
    expect(adapter.getDomElement(propsLeafNodeId)?.id).toBe('props-leaf-button');
    expect(adapter.getDomElement(fragmentLeafNodeId)?.id).toBe(
      'fragment-leaf-first',
    );

    app.unmount();
  });

  test('walks fragment children and keeps node ids deterministic across repeated reads', () => {
    const FragmentLeaf = Object.assign(
      defineComponent({
        name: 'FragmentLeaf',
        setup: () => () => h('div', 'leaf'),
      }),
      {
        __file: 'src/FragmentLeaf.vue',
      },
    );
    const FragmentBranch = defineComponent({
      name: 'FragmentBranch',
      setup: () =>
        () => [h(FragmentLeaf, { key: 'left' }), h(FragmentLeaf, { key: 'right' })],
    });
    const TreeRoot = defineComponent({
      name: 'TreeRoot',
      setup: () => () => h('main', [h(FragmentBranch)]),
    });
    const { app, adapter } = createMountedAdapter(TreeRoot);

    const firstSnapshot = adapter.getTreeSnapshot();
    const secondSnapshot = adapter.getTreeSnapshot();
    const firstNodeByName = toNodeByDisplayName(firstSnapshot);
    const fragmentBranchNode = firstNodeByName.get('FragmentBranch');
    const fragmentLeafNodes = firstSnapshot.nodes.filter(
      (node) => node.displayName === 'FragmentLeaf',
    );

    expect(firstSnapshot).toEqual(secondSnapshot);
    expect(firstSnapshot.rootIds).toEqual([firstNodeByName.get('TreeRoot')?.id]);
    expect(fragmentBranchNode?.childrenIds).toEqual(
      fragmentLeafNodes.map((node) => node.id),
    );
    expect(fragmentLeafNodes).toHaveLength(2);
    expect(fragmentLeafNodes.map((node) => node.key)).toEqual(['left', 'right']);
    expect(fragmentLeafNodes.every((node) => node.parentId === fragmentBranchNode?.id)).toBe(
      true,
    );
    expect(fragmentLeafNodes.every((node) => node.source?.file === 'src/FragmentLeaf.vue')).toBe(
      true,
    );

    app.unmount();
  });

  test('resolves stable component paths for DOM selections with and without Vue DOM markers', () => {
    const ToolbarButton = defineComponent({
      name: 'ToolbarButton',
      setup: () =>
        () =>
          h('button', { id: 'toolbar-button' }, [
            h('span', { id: 'toolbar-label' }, 'save'),
          ]),
    });
    const TreeRoot = defineComponent({
      name: 'SelectionTreeRoot',
      setup: () => () => h('main', [h(ToolbarButton)]),
    });
    const { app, adapter } = createMountedAdapter(TreeRoot);
    const toolbarLabel = document.getElementById('toolbar-label') as HTMLElement;
    const mountedRoot = document.querySelector('main') as HTMLElement;

    expect(adapter.getComponentPathForElement?.(toolbarLabel)).toEqual([
      'SelectionTreeRoot',
      'ToolbarButton',
    ]);

    stripVueDomMarkers(mountedRoot.parentElement as ParentNode);

    expect(adapter.getComponentPathForElement?.(toolbarLabel)).toEqual([
      'SelectionTreeRoot',
      'ToolbarButton',
    ]);

    app.unmount();
  });

  test('walks KeepAlive caches so inactive component instances remain in the snapshot', async () => {
    const activeView = ref<'one' | 'two'>('one');
    const OneView = defineComponent({
      name: 'OneView',
      setup: () => () => h('div', 'one'),
    });
    const TwoView = defineComponent({
      name: 'TwoView',
      setup: () => () => h('div', 'two'),
    });
    const TreeRoot = defineComponent({
      name: 'KeepAliveTreeRoot',
      setup: () =>
        () =>
          h(KeepAlive, null, [
            activeView.value === 'one'
              ? h(OneView, { key: 'one' })
              : h(TwoView, { key: 'two' }),
          ]),
    });
    const { app, adapter } = createMountedAdapter(TreeRoot);

    activeView.value = 'two';
    await nextTick();

    const snapshot = adapter.getTreeSnapshot();
    const nodeByName = toNodeByDisplayName(snapshot);
    const keepAliveNode = nodeByName.get('KeepAlive');

    expect(nodeByName.has('KeepAliveTreeRoot')).toBe(true);
    expect(keepAliveNode?.tags).toEqual(['vue', 'vue-kind:keep-alive']);
    expect(nodeByName.get('OneView')?.parentId).toBe(keepAliveNode?.id);
    expect(nodeByName.get('TwoView')?.parentId).toBe(keepAliveNode?.id);
    expect(keepAliveNode?.childrenIds).toEqual([
      nodeByName.get('TwoView')?.id,
      nodeByName.get('OneView')?.id,
    ]);

    app.unmount();
  });

  test('walks Suspense active and pending branches and preserves the pending child node id after resolution', async () => {
    vi.spyOn(console, 'warn').mockImplementation(() => undefined);

    let resolveAsyncComponent: (() => void) | undefined;
    const gate = new Promise<void>((resolve) => {
      resolveAsyncComponent = resolve;
    });
    const AsyncChild = defineComponent({
      name: 'AsyncChild',
      async setup() {
        await gate;

        return () => h('div', 'async');
      },
    });
    const FallbackChild = defineComponent({
      name: 'FallbackChild',
      setup: () => () => h('div', 'fallback'),
    });
    const TreeRoot = defineComponent({
      name: 'SuspenseTreeRoot',
      setup: () =>
        () =>
          h(Suspense, null, {
            default: h(AsyncChild),
            fallback: h(FallbackChild),
          }),
    });
    const { app, adapter } = createMountedAdapter(TreeRoot);

    const pendingSnapshot = adapter.getTreeSnapshot();
    const pendingNodeByName = toNodeByDisplayName(pendingSnapshot);
    const asyncChildNodeId = pendingNodeByName.get('AsyncChild')?.id;

    expect(pendingNodeByName.has('SuspenseTreeRoot')).toBe(true);
    expect(pendingNodeByName.get('FallbackChild')?.parentId).toBe(
      pendingNodeByName.get('SuspenseTreeRoot')?.id,
    );
    expect(pendingNodeByName.get('AsyncChild')?.parentId).toBe(
      pendingNodeByName.get('SuspenseTreeRoot')?.id,
    );

    resolveAsyncComponent?.();
    await gate;
    await nextTick();
    await nextTick();

    const resolvedSnapshot = adapter.getTreeSnapshot();
    const resolvedNodeByName = toNodeByDisplayName(resolvedSnapshot);

    expect(resolvedNodeByName.has('FallbackChild')).toBe(false);
    expect(resolvedNodeByName.get('AsyncChild')?.id).toBe(asyncChildNodeId);

    app.unmount();
  });

  test('keeps separate roots distinct when different apps reuse the same component uids', () => {
    const firstContainer = document.createElement('div');
    const secondContainer = document.createElement('div');

    document.body.append(firstContainer, secondContainer);

    const adapter = createVue3InspectorAdapter({
      getMountedApps: () => {
        return [
          createMockMountedAppRecord(
            {
              rootDisplayName: 'FirstRoot',
              childDisplayName: 'FirstChild',
            },
            firstContainer,
          ),
          createMockMountedAppRecord(
            {
              rootDisplayName: 'SecondRoot',
              childDisplayName: 'SecondChild',
            },
            secondContainer,
          ),
        ];
      },
    });
    const snapshot = adapter.getTreeSnapshot();
    const nodeByName = new Map(snapshot.nodes.map((node) => [node.displayName, node]));

    expect(snapshot.rootIds).toEqual([
      nodeByName.get('FirstRoot')?.id,
      nodeByName.get('SecondRoot')?.id,
    ]);
    expect(snapshot.nodes).toHaveLength(4);
    expect(nodeByName.get('FirstChild')?.parentId).toBe(
      nodeByName.get('FirstRoot')?.id,
    );
    expect(nodeByName.get('SecondChild')?.parentId).toBe(
      nodeByName.get('SecondRoot')?.id,
    );
    expect(nodeByName.get('FirstRoot')?.id).not.toBe(
      nodeByName.get('SecondRoot')?.id,
    );
    expect(nodeByName.get('FirstChild')?.id).not.toBe(
      nodeByName.get('SecondChild')?.id,
    );
  });

  test('fails soft for missing and stale node ids after the component tree changes', async () => {
    const showLeaf = ref(true);
    const ConditionalLeaf = defineComponent({
      name: 'ConditionalLeaf',
      setup: () => () => h('div', { id: 'conditional-leaf' }, 'leaf'),
    });
    const TreeRoot = defineComponent({
      name: 'ConditionalTreeRoot',
      setup: () => () => h('main', [showLeaf.value ? h(ConditionalLeaf) : null]),
    });
    const { app, adapter } = createMountedAdapter(TreeRoot);
    const firstSnapshot = adapter.getTreeSnapshot();
    const conditionalLeafNodeId = firstSnapshot.nodes.find(
      (node) => node.displayName === 'ConditionalLeaf',
    )?.id;

    showLeaf.value = false;
    await nextTick();

    const secondSnapshot = adapter.getTreeSnapshot();

    expect(secondSnapshot.nodes.some((node) => node.id === conditionalLeafNodeId)).toBe(
      false,
    );
    expect(adapter.getNodeProps(conditionalLeafNodeId as string)).toBeUndefined();
    expect(adapter.getDomElement(conditionalLeafNodeId as string)).toBeNull();
    expect(adapter.getNodeProps('missing-node-id')).toBeUndefined();
    expect(adapter.getDomElement('missing-node-id')).toBeNull();

    app.unmount();
  });
});
