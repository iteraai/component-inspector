import { createApp, h, type App } from 'vue';
import { createVueMountedAppRegistry } from './adapters/base';
import { registerVueAppOnMount } from './embeddedBootstrap';

const createVueApp = () => {
  return createApp({
    name: 'BootstrappedVueApp',
    render: () => h('main', { id: 'bootstrapped-vue-app' }, 'hello'),
  });
};

const createMockVueApp = () => {
  const app = {
    _container: null as Element | null,
    _instance: null as object | null,
    mount(container: Element) {
      app._container = container;
      app._instance = {};

      return {};
    },
    unmount() {
      app._container = null;
      app._instance = null;
    },
  };

  return app as unknown as App;
};

afterEach(() => {
  document.body.innerHTML = '';
});

describe('registerVueAppOnMount', () => {
  test('registers the app after mount and cleans up on destroy', () => {
    const registry = createVueMountedAppRegistry();
    const app = createVueApp();
    const container = document.createElement('div');

    document.body.append(container);

    const bootstrap = registerVueAppOnMount(app, {
      registry,
    });

    expect(
      registry.getMountedApps({
        strategy: 'explicit-only',
      }),
    ).toEqual([]);

    app.mount(container);

    expect(
      registry.getMountedApps({
        strategy: 'explicit-only',
      }),
    ).toEqual([
      {
        app,
        container,
        source: 'explicit',
      },
    ]);

    bootstrap.destroy();

    expect(
      registry.getMountedApps({
        strategy: 'explicit-only',
      }),
    ).toEqual([]);
    expect(() => app.unmount()).not.toThrow();
  });

  test('restores the original mount when duplicate bootstraps are destroyed out of order', () => {
    const firstRegistry = createVueMountedAppRegistry();
    const secondRegistry = createVueMountedAppRegistry();
    const app = createMockVueApp();
    const originalMount = app.mount;
    const firstBootstrap = registerVueAppOnMount(app, {
      registry: firstRegistry,
    });
    const secondBootstrap = registerVueAppOnMount(app, {
      registry: secondRegistry,
    });
    const firstContainer = document.createElement('div');

    document.body.append(firstContainer);

    firstBootstrap.destroy();
    app.mount(firstContainer);

    expect(
      firstRegistry.getMountedApps({
        strategy: 'explicit-only',
      }),
    ).toEqual([]);
    expect(
      secondRegistry.getMountedApps({
        strategy: 'explicit-only',
      }),
    ).toEqual([
      {
        app,
        container: firstContainer,
        source: 'explicit',
      },
    ]);

    app.unmount();
    secondBootstrap.destroy();

    expect(app.mount).toBe(originalMount);

    const secondContainer = document.createElement('div');

    document.body.append(secondContainer);
    app.mount(secondContainer);

    expect(
      firstRegistry.getMountedApps({
        strategy: 'explicit-only',
      }),
    ).toEqual([]);
    expect(
      secondRegistry.getMountedApps({
        strategy: 'explicit-only',
      }),
    ).toEqual([]);
  });
});
