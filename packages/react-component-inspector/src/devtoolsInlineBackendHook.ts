// eslint-disable-next-line @typescript-eslint/triple-slash-reference
/// <reference path="./reactDevtoolsInlineBackend.d.ts" />

import * as reactDevtoolsInlineBackend from 'react-devtools-inline/backend.js';

type WindowWithDevtoolsInlineBackendHook = Window & {
  __REACT_DEVTOOLS_GLOBAL_HOOK__?: unknown;
};

type DevtoolsHookLike = {
  getFiberRoots?: ((rendererId: number) => Set<unknown>) | undefined;
  onCommitFiberRoot?:
    | ((rendererId: number, root: unknown, priorityLevel?: unknown) => void)
    | undefined;
};

type FiberRootLike = {
  current?: {
    memoizedState?: {
      element?: unknown;
    } | null;
  } | null;
};

export type InstallDevtoolsInlineBackendHookOptions = {
  enabled?: boolean;
  initializedFlagKey?: string;
};

const DEFAULT_INITIALIZED_FLAG_KEY =
  '__araDevtoolsInlineBackendHookInitialized';

const isRecord = (value: unknown): value is Record<string, unknown> => {
  return typeof value === 'object' && value !== null;
};

const isDevtoolsHookLike = (value: unknown): value is DevtoolsHookLike => {
  return isRecord(value);
};

const toInitializeDevtoolsInlineBackend = () => {
  const backendModule = reactDevtoolsInlineBackend as {
    initialize?: ((windowOrGlobal: Window) => void) | undefined;
    default?:
      | {
          initialize?: ((windowOrGlobal: Window) => void) | undefined;
        }
      | undefined;
  };

  const initializeCandidate =
    backendModule.initialize ?? backendModule.default?.initialize;

  return typeof initializeCandidate === 'function'
    ? initializeCandidate
    : undefined;
};

const tryResetPreexistingDevtoolsHook = (
  windowWithHook: WindowWithDevtoolsInlineBackendHook,
) => {
  const hookDescriptor = Object.getOwnPropertyDescriptor(
    windowWithHook,
    '__REACT_DEVTOOLS_GLOBAL_HOOK__',
  );

  if (hookDescriptor === undefined || hookDescriptor.configurable !== true) {
    return;
  }

  if (typeof hookDescriptor.get === 'function') {
    return;
  }

  try {
    delete windowWithHook.__REACT_DEVTOOLS_GLOBAL_HOOK__;
  } catch {
    // Keep hook install resilient when deletion is blocked.
  }
};

const toFiberRootLike = (value: unknown): FiberRootLike | undefined => {
  if (!isRecord(value)) {
    return undefined;
  }

  return value as FiberRootLike;
};

const ensureFiberRootReaderOnHook = (hook: DevtoolsHookLike) => {
  if (typeof hook.getFiberRoots === 'function') {
    return true;
  }

  if (typeof hook.onCommitFiberRoot !== 'function') {
    return false;
  }

  const fiberRootsByRendererId = new Map<number, Set<unknown>>();
  const originalOnCommitFiberRoot = hook.onCommitFiberRoot.bind(hook);

  const getFiberRoots = (rendererId: number) => {
    const existingRoots = fiberRootsByRendererId.get(rendererId);

    if (existingRoots !== undefined) {
      return existingRoots;
    }

    const nextRoots = new Set<unknown>();
    fiberRootsByRendererId.set(rendererId, nextRoots);
    return nextRoots;
  };

  hook.getFiberRoots = getFiberRoots;
  hook.onCommitFiberRoot = (rendererId, root, priorityLevel) => {
    const roots = getFiberRoots(rendererId);
    const rootLike = toFiberRootLike(root);
    const current = rootLike?.current;
    const memoizedState = current?.memoizedState;
    const isUnmounting =
      memoizedState === null ||
      memoizedState?.element === undefined ||
      memoizedState?.element === null;
    const isKnownRoot = roots.has(root);

    if (!isKnownRoot && !isUnmounting) {
      roots.add(root);
    } else if (isKnownRoot && isUnmounting) {
      roots.delete(root);
    }

    originalOnCommitFiberRoot(rendererId, root, priorityLevel);
  };

  return true;
};

export const installDevtoolsInlineBackendHook = (
  options: InstallDevtoolsInlineBackendHookOptions = {},
) => {
  if (typeof window === 'undefined') {
    return false;
  }

  if (options.enabled === false) {
    return false;
  }

  const initializedFlagKey =
    options.initializedFlagKey ?? DEFAULT_INITIALIZED_FLAG_KEY;
  const windowWithHook =
    window as unknown as WindowWithDevtoolsInlineBackendHook &
      Record<string, unknown>;

  if (windowWithHook[initializedFlagKey] === true) {
    return true;
  }

  try {
    const initializeDevtoolsInlineBackend = toInitializeDevtoolsInlineBackend();

    if (initializeDevtoolsInlineBackend === undefined) {
      return false;
    }

    tryResetPreexistingDevtoolsHook(windowWithHook);
    initializeDevtoolsInlineBackend(window);

    const devtoolsHookCandidate = windowWithHook.__REACT_DEVTOOLS_GLOBAL_HOOK__;

    if (!isDevtoolsHookLike(devtoolsHookCandidate)) {
      return false;
    }

    const hasFiberRootReader = ensureFiberRootReaderOnHook(
      devtoolsHookCandidate,
    );

    if (!hasFiberRootReader) {
      return false;
    }

    windowWithHook[initializedFlagKey] = true;
    return true;
  } catch {
    return false;
  }
};
