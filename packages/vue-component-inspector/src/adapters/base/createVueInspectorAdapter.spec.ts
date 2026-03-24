import { createApp, defineComponent, h } from 'vue';
import { createVueInspectorAdapter } from './createVueInspectorAdapter';
import { createVueMountedAppRegistry } from './mountedAppRegistry';

const createMountedVueApp = () => {
  const Leaf = Object.assign(
    defineComponent({
      name: 'MountedLeaf',
      setup: () => () => h('article', 'hello'),
    }),
    {
      __file: 'src/MountedLeaf.vue',
    },
  );

  const container = document.createElement('div');

  document.body.append(container);

  const app = createApp(
    defineComponent({
      name: 'MountedVueApp',
      setup: () =>
        () => h('section', { id: 'adapter-mounted-vue-app' }, [h(Leaf)]),
    }),
  );

  app.mount(container);

  return {
    app,
    container,
  };
};

afterEach(() => {
  document.body.innerHTML = '';
});

describe('createVueInspectorAdapter', () => {
  test('returns explicitly registered mounted apps predictably', () => {
    const registry = createVueMountedAppRegistry();
    const { app, container } = createMountedVueApp();

    registry.registerApp(app, {
      container,
    });

    const adapter = createVueInspectorAdapter({
      appRegistry: registry,
      mountedAppDiscovery: {
        strategy: 'explicit-only',
      },
    });

    expect(adapter.getMountedApps()).toEqual([
      {
        app,
        container,
        source: 'explicit',
      },
    ]);

    const firstSnapshot = adapter.getTreeSnapshot();
    const secondSnapshot = adapter.getTreeSnapshot();

    expect(firstSnapshot).toEqual(secondSnapshot);
    expect(firstSnapshot.rootIds).toHaveLength(1);
    expect(firstSnapshot.nodes.map((node) => node.displayName)).toEqual([
      'MountedVueApp',
      'MountedLeaf',
    ]);
    expect(firstSnapshot.nodes[0]).toMatchObject({
      parentId: null,
      childrenIds: [firstSnapshot.nodes[1].id],
      tags: ['vue', 'vue-kind:component'],
    });
    expect(firstSnapshot.nodes[1]).toMatchObject({
      parentId: firstSnapshot.nodes[0].id,
      childrenIds: [],
      source: {
        file: 'src/MountedLeaf.vue',
        line: 1,
      },
      tags: ['vue', 'vue-kind:component'],
    });

    app.unmount();
  });

  test('uses DOM discovery fallback without duplicating explicit registrations', () => {
    const registry = createVueMountedAppRegistry();
    const { app, container } = createMountedVueApp();
    const adapter = createVueInspectorAdapter({
      appRegistry: registry,
    });

    expect(adapter.getMountedApps()).toEqual([
      {
        app,
        container,
        source: 'dom',
      },
    ]);

    registry.registerApp(app, {
      container,
    });

    expect(adapter.getMountedApps()).toEqual([
      {
        app,
        container,
        source: 'explicit',
      },
    ]);

    app.unmount();
  });
});
