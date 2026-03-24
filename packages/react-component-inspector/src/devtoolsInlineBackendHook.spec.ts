const removeDevtoolsHookState = () => {
  const windowWithState = window as unknown as Window & {
    __REACT_DEVTOOLS_GLOBAL_HOOK__?: unknown;
    __araDevtoolsInlineBackendHookInitialized?: boolean;
  };

  delete windowWithState.__REACT_DEVTOOLS_GLOBAL_HOOK__;
  delete windowWithState.__araDevtoolsInlineBackendHookInitialized;
};

const loadDevtoolsInlineBackendHookModule = async (
  backendModule: Record<string, unknown>,
) => {
  vi.resetModules();
  vi.doMock('react-devtools-inline/backend.js', () => backendModule);

  return import('./devtoolsInlineBackendHook');
};

describe('devtoolsInlineBackendHook', () => {
  afterEach(() => {
    vi.resetModules();
    vi.doUnmock('react-devtools-inline/backend.js');
    removeDevtoolsHookState();
  });

  test('returns false instead of crashing when the backend module exposes no initializer', async () => {
    const { installDevtoolsInlineBackendHook } =
      await loadDevtoolsInlineBackendHookModule({});

    expect(installDevtoolsInlineBackendHook()).toBe(false);
  });

  test('supports backend modules that expose initialize as a named export', async () => {
    const initializeSpy = vi.fn((windowOrGlobal: Window) => {
      (
        windowOrGlobal as Window & {
          __REACT_DEVTOOLS_GLOBAL_HOOK__?: {
            onCommitFiberRoot: ReturnType<typeof vi.fn>;
          };
        }
      ).__REACT_DEVTOOLS_GLOBAL_HOOK__ = {
        onCommitFiberRoot: vi.fn(),
      };
    });

    const { installDevtoolsInlineBackendHook } =
      await loadDevtoolsInlineBackendHookModule({
        initialize: initializeSpy,
      });

    expect(installDevtoolsInlineBackendHook()).toBe(true);
    expect(initializeSpy).toHaveBeenCalledWith(window);
  });
});
