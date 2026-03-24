import { createApp, h } from 'vue';
import { createVueInspectorAdapter } from './createVueInspectorAdapter';
import { createVueMountedAppRegistry } from './mountedAppRegistry';

const createMountedVueApp = () => {
  const container = document.createElement('div');

  document.body.append(container);

  const app = createApp({
    name: 'MountedVueApp',
    render: () => h('section', { id: 'adapter-mounted-vue-app' }, 'hello'),
  });

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
    expect(adapter.getTreeSnapshot()).toEqual({
      nodes: [],
      rootIds: [],
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
