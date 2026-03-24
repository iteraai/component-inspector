import type { App } from 'vue';
import {
  DEFAULT_VUE_MOUNTED_APP_CONTAINER_SELECTOR,
  type RegisterMountedVueAppOptions,
  type VueMountedAppContainer,
  type VueMountedAppDiscoveryOptions,
  type VueMountedAppRecord,
  type VueMountedAppRegistry,
  type VueMountedAppRegistration,
  type VueMountedAppSource,
} from './types';

type VueAppWithInternals = App & {
  _container?: VueMountedAppContainer | null;
  _instance?: object | null;
  mount: (containerOrSelector: string | VueMountedAppContainer) => unknown;
  unmount: () => void;
};

type VueContainerWithInternals = VueMountedAppContainer & {
  __vue_app__?: App;
  _vnode?: {
    component?: {
      appContext?: {
        app?: App;
      };
    };
  };
};

type RegistryEntry = {
  app: VueAppWithInternals;
  container: VueMountedAppContainer | null;
  cleanupTokens: Set<symbol>;
  unmountCleanupToken?: symbol;
};

type SharedUnmountHookState = {
  cleanupCallbacks: Map<symbol, () => void>;
  originalUnmount: VueAppWithInternals['unmount'];
  unmountWrapper: VueAppWithInternals['unmount'];
};

const sharedUnmountHookStateByApp = new WeakMap<App, SharedUnmountHookState>();

const isElementContainer = (value: unknown): value is Element => {
  return typeof Element === 'function' && value instanceof Element;
};

const isShadowRootContainer = (value: unknown): value is ShadowRoot => {
  return typeof ShadowRoot === 'function' && value instanceof ShadowRoot;
};

const isVueMountedAppContainer = (
  value: unknown,
): value is VueMountedAppContainer => {
  return isElementContainer(value) || isShadowRootContainer(value);
};

const isConnectedContainer = (container: VueMountedAppContainer) => {
  if (isElementContainer(container)) {
    return container.isConnected;
  }

  return container.host.isConnected;
};

const isVueAppWithInternals = (value: unknown): value is VueAppWithInternals => {
  if (typeof value !== 'object' || value === null) {
    return false;
  }

  return 'mount' in value && 'unmount' in value;
};

const isMountedVueApp = (
  app: unknown,
  containerHint?: VueMountedAppContainer | null,
): app is VueAppWithInternals => {
  if (!isVueAppWithInternals(app) || app._instance == null) {
    return false;
  }

  const container = containerHint ?? app._container;

  return (
    isVueMountedAppContainer(container) && isConnectedContainer(container)
  );
};

export const resolveMountedVueAppContainer = (
  app: App,
  containerHint?: VueMountedAppContainer | null,
): VueMountedAppContainer | null => {
  const internalApp = app as VueAppWithInternals;

  if (!isMountedVueApp(internalApp, containerHint)) {
    return null;
  }

  return (containerHint ?? internalApp._container) ?? null;
};

export const resolveVueMountContainer = (
  containerOrSelector: string | VueMountedAppContainer,
  root?: ParentNode,
): VueMountedAppContainer | null => {
  if (typeof containerOrSelector !== 'string') {
    return isVueMountedAppContainer(containerOrSelector)
      ? containerOrSelector
      : null;
  }

  const queryRoot = root ?? (typeof document === 'undefined' ? undefined : document);

  if (queryRoot === undefined || typeof queryRoot.querySelector !== 'function') {
    return null;
  }

  const element = queryRoot.querySelector(containerOrSelector);

  return isElementContainer(element) ? element : null;
};

const resolveVueAppFromContainer = (
  container: VueMountedAppContainer,
): VueAppWithInternals | undefined => {
  const containerWithInternals = container as VueContainerWithInternals;
  const directApp = containerWithInternals.__vue_app__;

  if (isMountedVueApp(directApp, container)) {
    return directApp;
  }

  const vnodeApp = containerWithInternals._vnode?.component?.appContext?.app;

  if (isMountedVueApp(vnodeApp, container)) {
    return vnodeApp;
  }

  return undefined;
};

const toMountedAppRecord = (
  app: App,
  source: VueMountedAppSource,
  containerHint?: VueMountedAppContainer | null,
): VueMountedAppRecord | undefined => {
  const container = resolveMountedVueAppContainer(app, containerHint);

  if (container === null) {
    return undefined;
  }

  return {
    app,
    container,
    source,
  };
};

const collectDiscoveryContainers = (
  root: ParentNode,
  containerSelector: string,
): Element[] => {
  const discoveryContainers = Array.from(root.querySelectorAll(containerSelector));

  if (isElementContainer(root) && root.matches(containerSelector)) {
    discoveryContainers.unshift(root);
  }

  return discoveryContainers;
};

export const discoverMountedVueApps = (
  options: VueMountedAppDiscoveryOptions = {},
): readonly VueMountedAppRecord[] => {
  const root = options.root ?? (typeof document === 'undefined' ? undefined : document);

  if (root === undefined || typeof root.querySelectorAll !== 'function') {
    return [];
  }

  const containerSelector =
    options.containerSelector ?? DEFAULT_VUE_MOUNTED_APP_CONTAINER_SELECTOR;
  const recordsByApp = new Map<App, VueMountedAppRecord>();

  collectDiscoveryContainers(root, containerSelector).forEach((container) => {
    const app = resolveVueAppFromContainer(container);

    if (app === undefined || recordsByApp.has(app)) {
      return;
    }

    const record = toMountedAppRecord(app, 'dom', container);

    if (record !== undefined) {
      recordsByApp.set(app, record);
    }
  });

  return [...recordsByApp.values()];
};

export const createVueMountedAppRegistry = (): VueMountedAppRegistry => {
  const entries = new Map<App, RegistryEntry>();

  const restoreSharedUnmountHook = (
    app: VueAppWithInternals,
    state: SharedUnmountHookState,
  ) => {
    if (app.unmount === state.unmountWrapper) {
      app.unmount = state.originalUnmount;
    }

    sharedUnmountHookStateByApp.delete(app);
  };

  const unregisterSharedUnmountCleanup = (entry: RegistryEntry) => {
    if (entry.unmountCleanupToken === undefined) {
      return;
    }

    const state = sharedUnmountHookStateByApp.get(entry.app);

    if (state === undefined) {
      entry.unmountCleanupToken = undefined;
      return;
    }

    state.cleanupCallbacks.delete(entry.unmountCleanupToken);
    entry.unmountCleanupToken = undefined;

    if (state.cleanupCallbacks.size === 0) {
      restoreSharedUnmountHook(entry.app, state);
    }
  };

  const cleanupEntry = (
    entry: RegistryEntry,
    options: {
      unregisterSharedUnmountCleanup?: boolean;
    } = {},
  ) => {
    if (options.unregisterSharedUnmountCleanup !== false) {
      unregisterSharedUnmountCleanup(entry);
    } else {
      entry.unmountCleanupToken = undefined;
    }

    entries.delete(entry.app);
  };

  const createSharedUnmountHookState = (app: VueAppWithInternals) => {
    const state = {
      cleanupCallbacks: new Map<symbol, () => void>(),
      originalUnmount: app.unmount,
      unmountWrapper: (() => undefined) as unknown as VueAppWithInternals['unmount'],
    } satisfies SharedUnmountHookState;

    const unmountWrapper = () => {
      try {
        state.originalUnmount.call(app);
      } finally {
        [...state.cleanupCallbacks.values()].forEach((cleanupCallback) => {
          cleanupCallback();
        });

        restoreSharedUnmountHook(app, state);
      }
    };

    state.unmountWrapper = unmountWrapper;
    app.unmount = state.unmountWrapper;
    sharedUnmountHookStateByApp.set(app, state);

    return state;
  };

  const ensureUnmountCleanup = (entry: RegistryEntry) => {
    if (entry.unmountCleanupToken !== undefined) {
      return;
    }

    const state =
      sharedUnmountHookStateByApp.get(entry.app) ??
      createSharedUnmountHookState(entry.app);
    const cleanupToken = Symbol('shared-vue-app-unmount-cleanup');

    state.cleanupCallbacks.set(cleanupToken, () => {
      if (entries.get(entry.app) === entry) {
        cleanupEntry(entry, {
          unregisterSharedUnmountCleanup: false,
        });
      }
    });
    entry.unmountCleanupToken = cleanupToken;
  };

  return {
    registerApp: (
      app: App,
      options: RegisterMountedVueAppOptions = {},
    ): VueMountedAppRegistration => {
      const internalApp = app as VueAppWithInternals;
      const existingEntry = entries.get(app);
      const entry =
        existingEntry ??
        ({
          app: internalApp,
          container: null,
          cleanupTokens: new Set<symbol>(),
        } satisfies RegistryEntry);

      if (existingEntry === undefined) {
        entries.set(app, entry);
      }

      const resolvedContainer =
        resolveMountedVueAppContainer(app, options.container) ??
        resolveMountedVueAppContainer(app, entry.container);

      if (resolvedContainer !== null) {
        entry.container = resolvedContainer;
      } else if (options.container !== undefined) {
        entry.container = options.container;
      }

      ensureUnmountCleanup(entry);

      const cleanupToken = Symbol('mounted-vue-app-registration');
      let destroyed = false;

      entry.cleanupTokens.add(cleanupToken);

      return {
        destroy: () => {
          if (destroyed) {
            return;
          }

          destroyed = true;

          const activeEntry = entries.get(app);

          if (activeEntry === undefined) {
            return;
          }

          activeEntry.cleanupTokens.delete(cleanupToken);

          if (activeEntry.cleanupTokens.size === 0) {
            cleanupEntry(activeEntry);
          }
        },
      };
    },
    getMountedApps: (
      options: VueMountedAppDiscoveryOptions = {},
    ): readonly VueMountedAppRecord[] => {
      const strategy = options.strategy ?? 'auto';
      const recordsByApp = new Map<App, VueMountedAppRecord>();

      if (strategy !== 'dom-only') {
        entries.forEach((entry) => {
          const record = toMountedAppRecord(entry.app, 'explicit', entry.container);

          if (record !== undefined) {
            recordsByApp.set(entry.app, record);
          }
        });
      }

      if (strategy === 'explicit-only') {
        return [...recordsByApp.values()];
      }

      discoverMountedVueApps(options).forEach((record) => {
        if (!recordsByApp.has(record.app)) {
          recordsByApp.set(record.app, record);
        }
      });

      return [...recordsByApp.values()];
    },
    destroy: () => {
      entries.forEach((entry) => {
        cleanupEntry(entry);
      });

      entries.clear();
    },
  };
};

export const defaultVueMountedAppRegistry = createVueMountedAppRegistry();

export const registerMountedVueApp = (
  app: App,
  options?: RegisterMountedVueAppOptions,
) => {
  return defaultVueMountedAppRegistry.registerApp(app, options);
};

export const getMountedVueApps = (options?: VueMountedAppDiscoveryOptions) => {
  return defaultVueMountedAppRegistry.getMountedApps(options);
};
