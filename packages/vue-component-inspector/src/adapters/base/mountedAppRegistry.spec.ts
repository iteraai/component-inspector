import { createApp, h, type App } from 'vue';
import {
  createVueMountedAppRegistry,
  discoverMountedVueApps,
  getMountedVueApps,
  registerMountedVueApp,
} from './mountedAppRegistry';

const createMountedVueApp = () => {
  const container = document.createElement('div');

  document.body.append(container);

  const app = createApp({
    name: 'MountedVueApp',
    render: () => h('div', { id: 'mounted-vue-app' }, 'hello'),
  });

  app.mount(container);

  return {
    app,
    container,
  };
};

const createMockMountedVueApp = () => {
  const container = document.createElement('div');

  document.body.append(container);

  type MockMountedVueApp = {
    _container: Element | null;
    _instance: object | null;
    mount: (nextContainer: Element) => object;
    unmount: () => void;
  };

  const app: MockMountedVueApp = {
    _container: container,
    _instance: {},
    mount(nextContainer: Element) {
      app._container = nextContainer;
      app._instance = {};

      return {};
    },
    unmount() {
      app._container = null;
      app._instance = null;
    },
  };

  return {
    app: app as unknown as App,
    container,
  };
};

afterEach(() => {
  document.body.innerHTML = '';
});

describe('mountedAppRegistry', () => {
  test('discovers mounted Vue apps from DOM containers', () => {
    const { app, container } = createMountedVueApp();

    expect(discoverMountedVueApps()).toEqual([
      {
        app,
        container,
        source: 'dom',
      },
    ]);

    app.unmount();
  });

  test('removes explicit registrations after the app unmounts', () => {
    const registry = createVueMountedAppRegistry();
    const { app, container } = createMountedVueApp();

    registry.registerApp(app, {
      container,
    });

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

    app.unmount();

    expect(
      registry.getMountedApps({
        strategy: 'explicit-only',
      }),
    ).toEqual([]);
  });

  test('destroy clears registry state and leaves app unmount callable', () => {
    const registry = createVueMountedAppRegistry();
    const { app, container } = createMountedVueApp();

    registry.registerApp(app, {
      container,
    });
    registry.destroy();

    expect(
      registry.getMountedApps({
        strategy: 'explicit-only',
      }),
    ).toEqual([]);
    expect(() => app.unmount()).not.toThrow();
  });

  test('default registry exposes the same explicit registration helpers', () => {
    const { app, container } = createMountedVueApp();
    const registration = registerMountedVueApp(app, {
      container,
    });

    expect(
      getMountedVueApps({
        strategy: 'explicit-only',
      }),
    ).toEqual([
      {
        app,
        container,
        source: 'explicit',
      },
    ]);

    registration.destroy();

    expect(
      getMountedVueApps({
        strategy: 'explicit-only',
      }),
    ).toEqual([]);
    expect(() => app.unmount()).not.toThrow();
  });

  test('restores the original unmount when registrations across registries are destroyed out of order', () => {
    const firstRegistry = createVueMountedAppRegistry();
    const secondRegistry = createVueMountedAppRegistry();
    const { app, container } = createMockMountedVueApp();
    const originalUnmount = app.unmount;
    const firstRegistration = firstRegistry.registerApp(app, {
      container,
    });
    const secondRegistration = secondRegistry.registerApp(app, {
      container,
    });

    firstRegistration.destroy();

    expect(app.unmount).not.toBe(originalUnmount);

    secondRegistration.destroy();

    expect(app.unmount).toBe(originalUnmount);
  });
});
