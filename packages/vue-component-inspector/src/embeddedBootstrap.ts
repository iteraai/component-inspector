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

type VueMountedAppHookRegistration = {
  options: RegisterVueAppOnMountOptions;
  registration?: VueMountedAppRegistration;
  registry: VueMountedAppRegistry;
};

type VueMountedAppMountHookState = {
  mountWrapper: VueAppWithMount['mount'];
  originalMount: VueAppWithMount['mount'];
  registrations: Map<symbol, VueMountedAppHookRegistration>;
};

const mountHookStateByApp = new WeakMap<App, VueMountedAppMountHookState>();

const isElementContainer = (value: unknown): value is Element => {
  return typeof Element === 'function' && value instanceof Element;
};

const isShadowRootContainer = (value: unknown): value is ShadowRoot => {
  return typeof ShadowRoot === 'function' && value instanceof ShadowRoot;
};

const resolveRegistrationContainer = (
  app: App,
  options: RegisterVueAppOnMountOptions,
  mountTarget?: unknown,
) => {
  const resolvedMountTarget =
    typeof mountTarget === 'string' ||
    isElementContainer(mountTarget) ||
    isShadowRootContainer(mountTarget)
      ? resolveVueMountContainer(mountTarget, options.root)
      : null;

  return (
    resolvedMountTarget ??
    resolveMountedVueAppContainer(app) ??
    options.container ??
    null
  );
};

const registerCurrentMount = (
  app: App,
  registry: VueMountedAppRegistry,
  options: RegisterVueAppOnMountOptions,
) => {
  const mountedContainer = resolveRegistrationContainer(app, options);

  if (mountedContainer === null) {
    return undefined;
  }

  return registry.registerApp(app, {
    container: mountedContainer,
  });
};

const createMountHookState = (
  app: App,
  internalApp: VueAppWithMount,
): VueMountedAppMountHookState => {
  const state = {
    mountWrapper: (() => undefined) as unknown as VueAppWithMount['mount'],
    originalMount: internalApp.mount,
    registrations: new Map<symbol, VueMountedAppHookRegistration>(),
  } satisfies VueMountedAppMountHookState;

  const mountWrapper = ((...args: unknown[]) => {
    const mountResult = (
      state.originalMount as (...mountArgs: unknown[]) => unknown
    ).apply(internalApp, args);
    const mountTarget = args[0];

    state.registrations.forEach((registration) => {
      const resolvedContainer = resolveRegistrationContainer(
        app,
        registration.options,
        mountTarget,
      );

      registration.registration?.destroy();
      registration.registration =
        resolvedContainer === null
          ? undefined
          : registration.registry.registerApp(app, {
              container: resolvedContainer,
            });
    });

    return mountResult;
  }) as VueAppWithMount['mount'];

  state.mountWrapper = mountWrapper;
  internalApp.mount = state.mountWrapper;
  mountHookStateByApp.set(app, state);

  return state;
};

export const registerVueAppOnMount = (
  app: App,
  options: RegisterVueAppOnMountOptions = {},
): VueMountedAppRegistration => {
  const registry = options.registry ?? defaultVueMountedAppRegistry;
  const internalApp = app as VueAppWithMount;
  const state =
    mountHookStateByApp.get(app) ?? createMountHookState(app, internalApp);
  const registrationToken = Symbol('vue-mounted-app-hook-registration');

  state.registrations.set(registrationToken, {
    options,
    registration: registerCurrentMount(app, registry, options),
    registry,
  });

  return {
    destroy: () => {
      const activeState = mountHookStateByApp.get(app);

      if (activeState === undefined) {
        return;
      }

      const activeRegistration = activeState.registrations.get(registrationToken);

      if (activeRegistration === undefined) {
        return;
      }

      activeRegistration.registration?.destroy();
      activeState.registrations.delete(registrationToken);

      if (activeState.registrations.size === 0) {
        if (internalApp.mount === activeState.mountWrapper) {
          internalApp.mount = activeState.originalMount;
        }

        mountHookStateByApp.delete(app);
      }
    },
  };
};

export { defaultVueMountedAppRegistry, registerMountedVueApp };
