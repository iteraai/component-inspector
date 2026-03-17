import { given } from '#test/givenWhenThen';
import { discoverFiberRoots } from './rootDiscovery';
import type {
  RendererRef,
  RootDiscoveryResult,
  RootDiscoveryWindow,
} from './types';

type MockRendererInput = Readonly<{
  rendererId: number;
  renderer: unknown;
}>;

type MockRendererMapObject = Readonly<Record<string, unknown>>;

type MockDevtoolsHookOptions = Readonly<{
  renderers?: MockRendererInput[];
  renderersObject?: MockRendererMapObject;
  getFiberRoots?: (rendererId: number) => unknown;
}>;

type RootDiscoveryContext = {
  windowRef: RootDiscoveryWindow;
  rendererRef: RendererRef;
  rootRef: unknown;
  readFailureError: Error;
  hookReadFailureError: Error;
  result?: RootDiscoveryResult;
};

const createMockRenderers = (renderers: MockRendererInput[] = []) => {
  return new Map<unknown, unknown>(
    renderers.map((rendererInput) => {
      return [rendererInput.rendererId, rendererInput.renderer];
    }),
  );
};

const createMockRenderersObject = (renderers: MockRendererInput[] = []) => {
  const entries = renderers.map((rendererInput) => {
    return [`${rendererInput.rendererId}`, rendererInput.renderer];
  });

  return Object.fromEntries(entries);
};

const createMockDevtoolsHook = (
  options: MockDevtoolsHookOptions = {},
): Record<string, unknown> => {
  return {
    ...((options.renderers !== undefined ||
      options.renderersObject !== undefined) && {
      renderers:
        options.renderersObject ?? createMockRenderers(options.renderers ?? []),
    }),
    ...(options.getFiberRoots !== undefined && {
      getFiberRoots: options.getFiberRoots,
    }),
  };
};

const contextCreated = (): RootDiscoveryContext => {
  return {
    windowRef: {},
    rendererRef: {
      rendererId: 1,
      renderer: {
        rendererName: 'mock-renderer',
      },
    },
    rootRef: {
      current: {
        debugLabel: 'mock-root',
      },
    },
    readFailureError: new Error('fiber root read failed'),
    hookReadFailureError: new Error('hook getter failed'),
  };
};

const hookRemoved = (context: RootDiscoveryContext): RootDiscoveryContext => {
  delete context.windowRef.__REACT_DEVTOOLS_GLOBAL_HOOK__;

  return context;
};

const hookSetToMalformedValue = (
  context: RootDiscoveryContext,
): RootDiscoveryContext => {
  context.windowRef.__REACT_DEVTOOLS_GLOBAL_HOOK__ = 'malformed-hook';

  return context;
};

const hookConfiguredWithoutRenderers = (
  context: RootDiscoveryContext,
): RootDiscoveryContext => {
  context.windowRef.__REACT_DEVTOOLS_GLOBAL_HOOK__ = createMockDevtoolsHook({
    getFiberRoots: () => {
      return new Set();
    },
  });

  return context;
};

const hookConfiguredWithEmptyRenderers = (
  context: RootDiscoveryContext,
): RootDiscoveryContext => {
  context.windowRef.__REACT_DEVTOOLS_GLOBAL_HOOK__ = createMockDevtoolsHook({
    renderers: [],
  });

  return context;
};

const hookConfiguredWithoutFiberRootsReader = (
  context: RootDiscoveryContext,
): RootDiscoveryContext => {
  context.windowRef.__REACT_DEVTOOLS_GLOBAL_HOOK__ = createMockDevtoolsHook({
    renderers: [context.rendererRef],
  });

  return context;
};

const hookConfiguredWithMalformedFiberRoots = (
  context: RootDiscoveryContext,
): RootDiscoveryContext => {
  context.windowRef.__REACT_DEVTOOLS_GLOBAL_HOOK__ = createMockDevtoolsHook({
    renderers: [context.rendererRef],
    getFiberRoots: () => {
      return 123;
    },
  });

  return context;
};

const hookConfiguredWithObjectRendererAndRoot = (
  context: RootDiscoveryContext,
): RootDiscoveryContext => {
  context.windowRef.__REACT_DEVTOOLS_GLOBAL_HOOK__ = createMockDevtoolsHook({
    renderersObject: createMockRenderersObject([context.rendererRef]),
    getFiberRoots: (rendererId: number) => {
      if (rendererId !== context.rendererRef.rendererId) {
        return {};
      }

      return {
        primary: context.rootRef,
      };
    },
  });

  return context;
};

const hookConfiguredWithObjectRendererMapContainingThrowingGetter = (
  context: RootDiscoveryContext,
): RootDiscoveryContext => {
  const objectRendererMap = {
    [`${context.rendererRef.rendererId}`]: context.rendererRef.renderer,
  } as Record<string, unknown>;

  Object.defineProperty(objectRendererMap, 'unstableGetter', {
    configurable: true,
    enumerable: true,
    get() {
      throw new Error('unstable renderer getter');
    },
  });

  context.windowRef.__REACT_DEVTOOLS_GLOBAL_HOOK__ = createMockDevtoolsHook({
    renderersObject: objectRendererMap,
    getFiberRoots: (rendererId: number) => {
      if (rendererId !== context.rendererRef.rendererId) {
        return {};
      }

      return {
        primary: context.rootRef,
      };
    },
  });

  return context;
};

const hookConfiguredWithObjectRootMapContainingThrowingGetter = (
  context: RootDiscoveryContext,
): RootDiscoveryContext => {
  const objectRootMap = {
    primary: context.rootRef,
  } as Record<string, unknown>;

  Object.defineProperty(objectRootMap, 'unstableGetter', {
    configurable: true,
    enumerable: true,
    get() {
      throw new Error('unstable root getter');
    },
  });

  context.windowRef.__REACT_DEVTOOLS_GLOBAL_HOOK__ = createMockDevtoolsHook({
    renderersObject: createMockRenderersObject([context.rendererRef]),
    getFiberRoots: (rendererId: number) => {
      if (rendererId !== context.rendererRef.rendererId) {
        return {};
      }

      return objectRootMap;
    },
  });

  return context;
};

const hookConfiguredWithRendererAndRoot = (
  context: RootDiscoveryContext,
): RootDiscoveryContext => {
  context.windowRef.__REACT_DEVTOOLS_GLOBAL_HOOK__ = createMockDevtoolsHook({
    renderers: [context.rendererRef],
    getFiberRoots: (rendererId: number) => {
      if (rendererId !== context.rendererRef.rendererId) {
        return new Set();
      }

      return new Set([context.rootRef]);
    },
  });

  return context;
};

const hookConfiguredWithEmptyRoots = (
  context: RootDiscoveryContext,
): RootDiscoveryContext => {
  context.windowRef.__REACT_DEVTOOLS_GLOBAL_HOOK__ = createMockDevtoolsHook({
    renderers: [context.rendererRef],
    getFiberRoots: () => {
      return new Set();
    },
  });

  return context;
};

const hookConfiguredWithThrowingReader = (
  context: RootDiscoveryContext,
): RootDiscoveryContext => {
  context.windowRef.__REACT_DEVTOOLS_GLOBAL_HOOK__ = createMockDevtoolsHook({
    renderers: [context.rendererRef],
    getFiberRoots: () => {
      throw context.readFailureError;
    },
  });

  return context;
};

const hookConfiguredWithThrowingGetter = (
  context: RootDiscoveryContext,
): RootDiscoveryContext => {
  const windowRefWithThrowingGetter = {} as RootDiscoveryWindow;

  Object.defineProperty(
    windowRefWithThrowingGetter,
    '__REACT_DEVTOOLS_GLOBAL_HOOK__',
    {
      configurable: true,
      get() {
        throw context.hookReadFailureError;
      },
    },
  );

  context.windowRef = windowRefWithThrowingGetter;

  return context;
};

const hookConfiguredWithCrossRealmCollections = (
  context: RootDiscoveryContext,
): RootDiscoveryContext => {
  const iframe = document.createElement('iframe');
  document.body.append(iframe);

  const iframeWindow = iframe.contentWindow;

  if (iframeWindow === null) {
    throw new Error('iframe contentWindow unavailable');
  }

  const iframeGlobalThis = iframeWindow as unknown as typeof globalThis;
  const crossRealmRenderers = new iframeGlobalThis.Map<unknown, unknown>();
  crossRealmRenderers.set(
    context.rendererRef.rendererId,
    context.rendererRef.renderer,
  );

  const crossRealmRoots = new iframeGlobalThis.Set<unknown>();
  crossRealmRoots.add(context.rootRef);

  context.windowRef.__REACT_DEVTOOLS_GLOBAL_HOOK__ = {
    renderers: crossRealmRenderers,
    getFiberRoots: () => crossRealmRoots,
  };

  return context;
};

const discoveryExecuted = (
  context: RootDiscoveryContext,
): RootDiscoveryContext => {
  context.result = discoverFiberRoots(context.windowRef);

  return context;
};

const expectUnsupportedHookMissing = (context: RootDiscoveryContext) => {
  expect(context.result).toEqual({
    status: 'unsupported',
    reason: 'hook-missing',
  });
};

const expectUnsupportedHookMalformed = (context: RootDiscoveryContext) => {
  expect(context.result).toEqual({
    status: 'unsupported',
    reason: 'hook-malformed',
  });
};

const expectUnsupportedRenderersMalformed = (context: RootDiscoveryContext) => {
  expect(context.result).toEqual({
    status: 'unsupported',
    reason: 'renderers-malformed',
  });
};

const expectEmptyRenderers = (context: RootDiscoveryContext) => {
  expect(context.result).toEqual({
    status: 'empty',
    reason: 'renderer-empty',
    renderers: [],
  });
};

const expectUnsupportedFiberRootsReaderMissing = (
  context: RootDiscoveryContext,
) => {
  expect(context.result).toEqual({
    status: 'unsupported',
    reason: 'fiber-roots-reader-missing',
  });
};

const expectUnsupportedFiberRootsMalformed = (
  context: RootDiscoveryContext,
) => {
  expect(context.result).toEqual({
    status: 'unsupported',
    reason: 'fiber-roots-malformed',
  });
};

const expectEmptyRoots = (context: RootDiscoveryContext) => {
  expect(context.result).toEqual({
    status: 'empty',
    reason: 'root-empty',
    renderers: [context.rendererRef],
  });
};

const expectDiscoverySuccess = (context: RootDiscoveryContext) => {
  expect(context.result).toEqual({
    status: 'ok',
    renderers: [context.rendererRef],
    roots: [
      {
        rendererId: context.rendererRef.rendererId,
        root: context.rootRef,
      },
    ],
  });
};

const expectFiberRootsReadError = (context: RootDiscoveryContext) => {
  expect(context.result).toEqual({
    status: 'error',
    reason: 'fiber-roots-read-failed',
    rendererId: context.rendererRef.rendererId,
    details: context.readFailureError,
  });
};

const expectProbeFailedError = (context: RootDiscoveryContext) => {
  expect(context.result).toEqual({
    status: 'error',
    reason: 'probe-failed',
    details: context.hookReadFailureError,
  });
};

describe('rootDiscovery', () => {
  afterEach(() => {
    document.body.innerHTML = '';
  });

  test('should return unsupported when devtools hook is missing', () => {
    return given(contextCreated)
      .when(hookRemoved)
      .when(discoveryExecuted)
      .then(expectUnsupportedHookMissing);
  });

  test('should return unsupported when devtools hook is malformed', () => {
    return given(contextCreated)
      .when(hookSetToMalformedValue)
      .when(discoveryExecuted)
      .then(expectUnsupportedHookMalformed);
  });

  test('should return unsupported when renderer collection is missing', () => {
    return given(contextCreated)
      .when(hookConfiguredWithoutRenderers)
      .when(discoveryExecuted)
      .then(expectUnsupportedRenderersMalformed);
  });

  test('should return empty renderer result when renderer map has no entries', () => {
    return given(contextCreated)
      .when(hookConfiguredWithEmptyRenderers)
      .when(discoveryExecuted)
      .then(expectEmptyRenderers);
  });

  test('should return unsupported when getFiberRoots reader is missing', () => {
    return given(contextCreated)
      .when(hookConfiguredWithoutFiberRootsReader)
      .when(discoveryExecuted)
      .then(expectUnsupportedFiberRootsReaderMissing);
  });

  test('should return unsupported when getFiberRoots returns a malformed value', () => {
    return given(contextCreated)
      .when(hookConfiguredWithMalformedFiberRoots)
      .when(discoveryExecuted)
      .then(expectUnsupportedFiberRootsMalformed);
  });

  test('should return empty root result when renderers exist but roots are empty', () => {
    return given(contextCreated)
      .when(hookConfiguredWithEmptyRoots)
      .when(discoveryExecuted)
      .then(expectEmptyRoots);
  });

  test('should return discovered renderer roots when discovery succeeds', () => {
    return given(contextCreated)
      .when(hookConfiguredWithRendererAndRoot)
      .when(discoveryExecuted)
      .then(expectDiscoverySuccess);
  });

  test('should accept plain-object renderer map and plain-object root map shapes', () => {
    return given(contextCreated)
      .when(hookConfiguredWithObjectRendererAndRoot)
      .when(discoveryExecuted)
      .then(expectDiscoverySuccess);
  });

  test('should tolerate throwing getters when reading plain-object renderer maps', () => {
    return given(contextCreated)
      .when(hookConfiguredWithObjectRendererMapContainingThrowingGetter)
      .when(discoveryExecuted)
      .then(expectDiscoverySuccess);
  });

  test('should tolerate throwing getters when reading plain-object root maps', () => {
    return given(contextCreated)
      .when(hookConfiguredWithObjectRootMapContainingThrowingGetter)
      .when(discoveryExecuted)
      .then(expectDiscoverySuccess);
  });

  test('should return error when getFiberRoots throws', () => {
    return given(contextCreated)
      .when(hookConfiguredWithThrowingReader)
      .when(discoveryExecuted)
      .then(expectFiberRootsReadError);
  });

  test('should return probe-failed when reading the hook throws unexpectedly', () => {
    return given(contextCreated)
      .when(hookConfiguredWithThrowingGetter)
      .when(discoveryExecuted)
      .then(expectProbeFailedError);
  });

  test('should accept cross-realm renderer and root collections', () => {
    return given(contextCreated)
      .when(hookConfiguredWithCrossRealmCollections)
      .when(discoveryExecuted)
      .then(expectDiscoverySuccess);
  });
});
