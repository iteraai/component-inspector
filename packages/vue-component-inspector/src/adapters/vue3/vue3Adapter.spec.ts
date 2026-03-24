import {
  KeepAlive,
  Suspense,
  createApp,
  defineComponent,
  h,
  nextTick,
  ref,
} from 'vue';
import { createVueInspectorAdapter } from '../base/createVueInspectorAdapter';

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

const toNodeByDisplayName = (
  snapshot: ReturnType<ReturnType<typeof createVueInspectorAdapter>['getTreeSnapshot']>,
) => {
  return new Map(snapshot.nodes.map((node) => [node.displayName, node]));
};

afterEach(() => {
  document.body.innerHTML = '';
  vi.restoreAllMocks();
});

describe('vue3Adapter', () => {
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
});
