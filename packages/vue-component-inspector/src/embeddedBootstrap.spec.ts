import { createApp, h } from 'vue';
import { createVueMountedAppRegistry } from './adapters/base';
import { registerVueAppOnMount } from './embeddedBootstrap';

const createVueApp = () => {
  return createApp({
    name: 'BootstrappedVueApp',
    render: () => h('main', { id: 'bootstrapped-vue-app' }, 'hello'),
  });
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
});
