import type { Plugin, ResolvedConfig } from 'vite';
import {
  ITERA_REACT_INSPECTOR_RESOLVED_VIRTUAL_MODULE_ID,
  ITERA_REACT_INSPECTOR_VIRTUAL_MODULE_ID,
  createIteraReactInspectorVitePlugin,
  createRuntimeModuleCode,
  resolveInspectorEnabled,
  resolveInspectorHostOrigins,
} from './plugin';

type PluginContext = {
  plugin: Plugin;
  loggerWarnSpy: ReturnType<typeof vi.fn>;
  config: ResolvedConfig;
};

const createResolvedConfig = (
  overrides: {
    base?: string;
    command?: ResolvedConfig['command'];
    env?: Record<string, string>;
    serverOrigin?: string;
  } = {},
): ResolvedConfig => {
  return {
    base: overrides.base ?? '/',
    command: overrides.command ?? 'serve',
    env: overrides.env ?? {},
    logger: {
      warn: vi.fn(),
    },
    server: {
      origin: overrides.serverOrigin,
    },
  } as unknown as ResolvedConfig;
};

const createPluginContext = (
  options: Parameters<typeof createIteraReactInspectorVitePlugin>[0] = {},
  configOverrides: Parameters<typeof createResolvedConfig>[0] = {},
): PluginContext => {
  const plugin = createIteraReactInspectorVitePlugin(options);
  const config = createResolvedConfig(configOverrides);
  const configResolvedHook = plugin.configResolved;

  if (typeof configResolvedHook === 'function') {
    configResolvedHook(config);
  } else {
    configResolvedHook?.handler(config);
  }

  return {
    plugin,
    config,
    loggerWarnSpy: config.logger.warn as ReturnType<typeof vi.fn>,
  };
};

const callResolveId = async (plugin: Plugin, id: string) => {
  const hook = plugin.resolveId;

  if (typeof hook !== 'function') {
    throw new Error('Expected resolveId hook to be a function.');
  }

  return hook.call({} as never, id, undefined, {
    attributes: {},
    isEntry: false,
  });
};

const callLoad = async (plugin: Plugin, id: string) => {
  const hook = plugin.load;

  if (typeof hook !== 'function') {
    throw new Error('Expected load hook to be a function.');
  }

  return hook.call({} as never, id);
};

const callTransformIndexHtml = (plugin: Plugin, html = '<html></html>') => {
  const hook = plugin.transformIndexHtml;

  if (typeof hook !== 'function') {
    throw new Error('Expected transformIndexHtml hook to be a function.');
  }

  return hook.call({} as never, html, {
    path: '/',
    filename: '/workspace/index.html',
  });
};

describe('createIteraReactInspectorVitePlugin', () => {
  test('resolves and loads a small runtime virtual module wrapper', async () => {
    const context = createPluginContext({
      enabled: true,
      hostOrigins: [' https://app.iteradev.ai/editor ', 'https://app.iteradev.ai'],
    });

    await expect(
      callResolveId(context.plugin, ITERA_REACT_INSPECTOR_VIRTUAL_MODULE_ID),
    ).resolves.toBe(ITERA_REACT_INSPECTOR_RESOLVED_VIRTUAL_MODULE_ID);

    const moduleCode = await callLoad(
      context.plugin,
      ITERA_REACT_INSPECTOR_RESOLVED_VIRTUAL_MODULE_ID,
    );

    expect(moduleCode).toContain(
      "import { bootIteraReactInspectorViteRuntime } from '@iteraai/vite-plugin-react-inspector/client';",
    );
    expect(moduleCode).toContain('"hostOrigins":["https://app.iteradev.ai"]');
    expect(moduleCode).toContain(
      'const stop = bootIteraReactInspectorViteRuntime(',
    );
    expect(moduleCode).toContain('import.meta.hot.dispose(stop)');
    expect(moduleCode).not.toContain('@iteraai/react-component-inspector');
  });

  test('injects the runtime module into dev HTML when explicitly enabled', () => {
    const context = createPluginContext({
      enabled: true,
      hostOrigins: ['https://app.iteradev.ai'],
    });

    expect(callTransformIndexHtml(context.plugin)).toStrictEqual([
      {
        tag: 'script',
        attrs: {
          type: 'module',
          src: `/@id/__x00__${ITERA_REACT_INSPECTOR_VIRTUAL_MODULE_ID}`,
        },
        injectTo: 'head-prepend',
      },
    ]);
  });

  test('supports env-driven enabled and host origin configuration', () => {
    const context = createPluginContext(
      {},
      {
        env: {
          VITE_ITERA_COMPONENT_INSPECTOR_ENABLED: 'true',
          VITE_ITERA_COMPONENT_INSPECTOR_HOST_ORIGINS:
            'https://preview.iteradev.ai, https://app.iteradev.ai/editor',
        },
      },
    );

    expect(callTransformIndexHtml(context.plugin)).toStrictEqual([
      expect.objectContaining({
        attrs: expect.objectContaining({
          src: `/@id/__x00__${ITERA_REACT_INSPECTOR_VIRTUAL_MODULE_ID}`,
        }),
      }),
    ]);
    expect(context.loggerWarnSpy).not.toHaveBeenCalled();
  });

  test('prefixes the dev runtime module src with the configured Vite base', () => {
    const context = createPluginContext(
      {
        enabled: true,
        hostOrigins: ['https://app.iteradev.ai'],
      },
      {
        base: '/preview/',
      },
    );

    expect(callTransformIndexHtml(context.plugin)).toStrictEqual([
      expect.objectContaining({
        attrs: expect.objectContaining({
          src: `/preview/@id/__x00__${ITERA_REACT_INSPECTOR_VIRTUAL_MODULE_ID}`,
        }),
      }),
    ]);
  });

  test('prefixes the dev runtime module src with server origin when configured', () => {
    const context = createPluginContext(
      {
        enabled: true,
        hostOrigins: ['https://app.iteradev.ai'],
      },
      {
        base: '/preview/',
        serverOrigin: 'http://127.0.0.1:5173/',
      },
    );

    expect(callTransformIndexHtml(context.plugin)).toStrictEqual([
      expect.objectContaining({
        attrs: expect.objectContaining({
          src: `http://127.0.0.1:5173/preview/@id/__x00__${ITERA_REACT_INSPECTOR_VIRTUAL_MODULE_ID}`,
        }),
      }),
    ]);
  });

  test('does not inject when disabled even if host origins are configured', () => {
    const context = createPluginContext(
      {
        enabled: false,
        hostOrigins: ['https://app.iteradev.ai'],
      },
      {
        env: {
          VITE_ITERA_COMPONENT_INSPECTOR_ENABLED: 'true',
        },
      },
    );

    expect(callTransformIndexHtml(context.plugin)).toBeUndefined();
  });

  test('warns and skips injection when enabled without trusted host origins', () => {
    const context = createPluginContext({
      enabled: true,
    });

    expect(callTransformIndexHtml(context.plugin)).toBeUndefined();
    expect(context.loggerWarnSpy).toHaveBeenCalledWith(
      expect.stringContaining('no trusted host origins are configured'),
    );
  });

  test('skips normal production build injection unless explicitly included', () => {
    const defaultBuildContext = createPluginContext(
      {
        enabled: true,
        hostOrigins: ['https://app.iteradev.ai'],
      },
      {
        command: 'build',
      },
    );
    const includedBuildContext = createPluginContext(
      {
        enabled: true,
        hostOrigins: ['https://app.iteradev.ai'],
        includeInBuild: true,
      },
      {
        command: 'build',
      },
    );

    expect(callTransformIndexHtml(defaultBuildContext.plugin)).toBeUndefined();
    expect(callTransformIndexHtml(includedBuildContext.plugin)).toStrictEqual([
      expect.objectContaining({
        children: `import "${ITERA_REACT_INSPECTOR_VIRTUAL_MODULE_ID}";`,
        attrs: {
          type: 'module',
        },
      }),
    ]);
  });

  test('leaves already instrumented HTML unchanged', () => {
    const context = createPluginContext({
      enabled: true,
      hostOrigins: ['https://app.iteradev.ai'],
    });

    expect(
      callTransformIndexHtml(
        context.plugin,
        `<script type="module">import "${ITERA_REACT_INSPECTOR_VIRTUAL_MODULE_ID}";</script>`,
      ),
    ).toBeUndefined();
  });
});

describe('runtime option helpers', () => {
  test('requires an exact true env flag when no enabled option is provided', () => {
    expect(resolveInspectorEnabled(undefined, undefined)).toBe(false);
    expect(resolveInspectorEnabled(undefined, 'false')).toBe(false);
    expect(resolveInspectorEnabled(undefined, 'true')).toBe(true);
    expect(resolveInspectorEnabled(false, 'true')).toBe(false);
  });

  test('normalizes, deduplicates, and reports invalid host origins', () => {
    expect(
      resolveInspectorHostOrigins(
        ['https://app.iteradev.ai/path', 'not-an-origin'],
        ' https://preview.iteradev.ai , https://app.iteradev.ai ',
      ),
    ).toStrictEqual({
      hostOrigins: ['https://app.iteradev.ai', 'https://preview.iteradev.ai'],
      invalidHostOrigins: ['not-an-origin'],
    });
  });

  test('emits virtual module code without embedding runtime implementation', () => {
    const moduleCode = createRuntimeModuleCode({
      enabled: false,
      hostOrigins: [],
    });

    expect(moduleCode).toContain('"enabled":false');
    expect(moduleCode).toContain(
      '@iteraai/vite-plugin-react-inspector/client',
    );
    expect(moduleCode).not.toContain('@iteraai/react-component-inspector');
    expect(moduleCode).not.toContain('window.addEventListener');
  });
});
