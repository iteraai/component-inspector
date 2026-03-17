import { given } from '#test/givenWhenThen';
import { probeDevtoolsFiberRoots } from './devtoolsProbe';
import type {
  DevtoolsProbeResult,
  DevtoolsProbeWindow,
  RendererRef,
} from './types';

type MockRendererInput = Readonly<{
  rendererId: number;
  renderer: unknown;
}>;

type MockDevtoolsHookOptions = Readonly<{
  renderers?: MockRendererInput[];
  getFiberRoots?: (rendererId: number) => unknown;
}>;

const createMockRenderers = (renderers: MockRendererInput[] = []) => {
  return new Map<unknown, unknown>(
    renderers.map((rendererInput) => {
      return [rendererInput.rendererId, rendererInput.renderer];
    }),
  );
};

const createMockDevtoolsHook = (
  options: MockDevtoolsHookOptions = {},
): Record<string, unknown> => {
  return {
    ...(options.renderers !== undefined && {
      renderers: createMockRenderers(options.renderers),
    }),
    ...(options.getFiberRoots !== undefined && {
      getFiberRoots: options.getFiberRoots,
    }),
  };
};

type DevtoolsProbeContext = {
  windowRef: DevtoolsProbeWindow;
  rendererRef: RendererRef;
  rootRef: unknown;
  readFailureError: Error;
  result?: DevtoolsProbeResult;
};

const contextCreated = (): DevtoolsProbeContext => {
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
  };
};

const hookRemoved = (context: DevtoolsProbeContext): DevtoolsProbeContext => {
  delete context.windowRef.__REACT_DEVTOOLS_GLOBAL_HOOK__;

  return context;
};

const hookSetToMalformedValue = (
  context: DevtoolsProbeContext,
): DevtoolsProbeContext => {
  context.windowRef.__REACT_DEVTOOLS_GLOBAL_HOOK__ = 'malformed-hook';

  return context;
};

const hookConfiguredWithoutRenderers = (
  context: DevtoolsProbeContext,
): DevtoolsProbeContext => {
  context.windowRef.__REACT_DEVTOOLS_GLOBAL_HOOK__ = createMockDevtoolsHook({
    getFiberRoots: () => {
      return new Set();
    },
  });

  return context;
};

const hookConfiguredWithoutFiberRootsReader = (
  context: DevtoolsProbeContext,
): DevtoolsProbeContext => {
  context.windowRef.__REACT_DEVTOOLS_GLOBAL_HOOK__ = createMockDevtoolsHook({
    renderers: [context.rendererRef],
  });

  return context;
};

const hookConfiguredWithMalformedFiberRoots = (
  context: DevtoolsProbeContext,
): DevtoolsProbeContext => {
  context.windowRef.__REACT_DEVTOOLS_GLOBAL_HOOK__ = createMockDevtoolsHook({
    renderers: [context.rendererRef],
    getFiberRoots: () => {
      return [];
    },
  });

  return context;
};

const hookConfiguredWithRendererAndRoot = (
  context: DevtoolsProbeContext,
): DevtoolsProbeContext => {
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

const hookConfiguredWithThrowingReader = (
  context: DevtoolsProbeContext,
): DevtoolsProbeContext => {
  context.windowRef.__REACT_DEVTOOLS_GLOBAL_HOOK__ = createMockDevtoolsHook({
    renderers: [context.rendererRef],
    getFiberRoots: () => {
      throw context.readFailureError;
    },
  });

  return context;
};

const hookConfiguredWithCrossRealmCollections = (
  context: DevtoolsProbeContext,
): DevtoolsProbeContext => {
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

const probeExecuted = (context: DevtoolsProbeContext): DevtoolsProbeContext => {
  context.result = probeDevtoolsFiberRoots(context.windowRef);

  return context;
};

const expectUnsupportedHookMissing = (context: DevtoolsProbeContext) => {
  expect(context.result).toEqual({
    status: 'unsupported',
    reason: 'hook-missing',
  });
};

const expectUnsupportedHookMalformed = (context: DevtoolsProbeContext) => {
  expect(context.result).toEqual({
    status: 'unsupported',
    reason: 'hook-malformed',
  });
};

const expectUnsupportedRenderersMalformed = (context: DevtoolsProbeContext) => {
  expect(context.result).toEqual({
    status: 'unsupported',
    reason: 'renderers-malformed',
  });
};

const expectUnsupportedFiberRootsReaderMissing = (
  context: DevtoolsProbeContext,
) => {
  expect(context.result).toEqual({
    status: 'unsupported',
    reason: 'fiber-roots-reader-missing',
  });
};

const expectUnsupportedFiberRootsMalformed = (
  context: DevtoolsProbeContext,
) => {
  expect(context.result).toEqual({
    status: 'unsupported',
    reason: 'fiber-roots-malformed',
  });
};

const expectProbeSuccess = (context: DevtoolsProbeContext) => {
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

const expectFiberRootReadError = (context: DevtoolsProbeContext) => {
  expect(context.result).toEqual({
    status: 'error',
    reason: 'fiber-roots-read-failed',
    rendererId: context.rendererRef.rendererId,
    details: context.readFailureError,
  });
};

describe('devtoolsProbe', () => {
  afterEach(() => {
    document.body.innerHTML = '';
  });

  test('should return unsupported when devtools hook is missing', () => {
    return given(contextCreated)
      .when(hookRemoved)
      .when(probeExecuted)
      .then(expectUnsupportedHookMissing);
  });

  test('should return unsupported when devtools hook is malformed', () => {
    return given(contextCreated)
      .when(hookSetToMalformedValue)
      .when(probeExecuted)
      .then(expectUnsupportedHookMalformed);
  });

  test('should return unsupported when renderer collection is missing', () => {
    return given(contextCreated)
      .when(hookConfiguredWithoutRenderers)
      .when(probeExecuted)
      .then(expectUnsupportedRenderersMalformed);
  });

  test('should return unsupported when getFiberRoots reader is missing', () => {
    return given(contextCreated)
      .when(hookConfiguredWithoutFiberRootsReader)
      .when(probeExecuted)
      .then(expectUnsupportedFiberRootsReaderMissing);
  });

  test('should return unsupported when getFiberRoots returns a malformed value', () => {
    return given(contextCreated)
      .when(hookConfiguredWithMalformedFiberRoots)
      .when(probeExecuted)
      .then(expectUnsupportedFiberRootsMalformed);
  });

  test('should return discovered renderer roots when probe succeeds', () => {
    return given(contextCreated)
      .when(hookConfiguredWithRendererAndRoot)
      .when(probeExecuted)
      .then(expectProbeSuccess);
  });

  test('should return error when getFiberRoots throws', () => {
    return given(contextCreated)
      .when(hookConfiguredWithThrowingReader)
      .when(probeExecuted)
      .then(expectFiberRootReadError);
  });

  test('should accept cross-realm renderer and root collections', () => {
    return given(contextCreated)
      .when(hookConfiguredWithCrossRealmCollections)
      .when(probeExecuted)
      .then(expectProbeSuccess);
  });
});
