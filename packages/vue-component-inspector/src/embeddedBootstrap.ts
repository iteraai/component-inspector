import type { App } from 'vue';
import {
  defaultVueMountedAppRegistry,
  registerMountedVueApp,
  resolveMountedVueAppContainer,
  resolveVueMountContainer,
} from './adapters/base';
import type {
  RegisterMountedVueAppOptions,
  VueMountedAppContainer,
  VueMountedAppRegistration,
  VueMountedAppRegistry,
} from './adapters/base';

type VueAppWithMount = App & {
  mount: (containerOrSelector: string | VueMountedAppContainer) => unknown;
};

export type RegisterVueAppOnMountOptions = RegisterMountedVueAppOptions & {
  registry?: VueMountedAppRegistry;
  root?: ParentNode;
};

const registerCurrentMount = (
  app: App,
  registry: VueMountedAppRegistry,
  options: RegisterVueAppOnMountOptions,
) => {
  const mountedContainer =
    resolveMountedVueAppContainer(app) ?? options.container ?? null;

  if (mountedContainer === null) {
    return undefined;
  }

  return registry.registerApp(app, {
    container: mountedContainer,
  });
};

export const registerVueAppOnMount = (
  app: App,
  options: RegisterVueAppOnMountOptions = {},
): VueMountedAppRegistration => {
  const registry = options.registry ?? defaultVueMountedAppRegistry;
  const internalApp = app as VueAppWithMount;
  const originalMount = internalApp.mount;
  let registration = registerCurrentMount(app, registry, options);

  const mountWrapper = ((...args: unknown[]) => {
    const mountResult = (
      originalMount as (...mountArgs: unknown[]) => unknown
    ).apply(internalApp, args);
    const [containerOrSelector] = args as [string | VueMountedAppContainer];
    const resolvedContainer =
      resolveVueMountContainer(containerOrSelector, options.root) ??
      resolveMountedVueAppContainer(app) ??
      options.container ??
      null;

    registration?.destroy();
    registration = registry.registerApp(app, {
      container: resolvedContainer,
    });

    return mountResult;
  }) as typeof internalApp.mount;

  internalApp.mount = mountWrapper;

  return {
    destroy: () => {
      registration?.destroy();
      registration = undefined;

      if (internalApp.mount === mountWrapper) {
        internalApp.mount = originalMount;
      }
    },
  };
};

export { defaultVueMountedAppRegistry, registerMountedVueApp };
