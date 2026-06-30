import { normalizeOrigin } from '@iteraai/inspector-protocol';
import type { HtmlTagDescriptor, Plugin, ResolvedConfig } from 'vite';

export type IteraReactInspectorVitePluginOptions = {
  enabled?: boolean;
  hostOrigins?: readonly string[] | string;
  includeInBuild?: boolean;
};

type RuntimeOptions = {
  enabled: boolean;
  hostOrigins: readonly string[];
};

type HostOriginResolution = {
  hostOrigins: string[];
  invalidHostOrigins: string[];
};

export const ITERA_REACT_INSPECTOR_VIRTUAL_MODULE_ID =
  'virtual:itera-react-inspector-runtime';
export const ITERA_REACT_INSPECTOR_RESOLVED_VIRTUAL_MODULE_ID = `\0${ITERA_REACT_INSPECTOR_VIRTUAL_MODULE_ID}`;

const ENABLED_ENV_KEY = 'VITE_ITERA_COMPONENT_INSPECTOR_ENABLED';
const HOST_ORIGINS_ENV_KEY = 'VITE_ITERA_COMPONENT_INSPECTOR_HOST_ORIGINS';
const BOOTSTRAP_STATE_KEY = '__ITERA_REACT_INSPECTOR_VITE_BOOTSTRAP__';
const WARNING_PREFIX = '[itera-vite-plugin-react-inspector]';
const VITE_BROWSER_RESOLVED_ID_PATH = `/@id/__x00__${ITERA_REACT_INSPECTOR_VIRTUAL_MODULE_ID}`;

const disabledRuntimeOptions: RuntimeOptions = {
  enabled: false,
  hostOrigins: [],
};

const toHostOriginItems = (
  hostOrigins: IteraReactInspectorVitePluginOptions['hostOrigins'],
) => {
  if (Array.isArray(hostOrigins)) {
    return [...hostOrigins];
  }

  if (typeof hostOrigins === 'string') {
    return hostOrigins.split(',');
  }

  return [];
};

export const resolveInspectorEnabled = (
  optionEnabled: boolean | undefined,
  envEnabled: string | undefined,
) => {
  return optionEnabled ?? envEnabled === 'true';
};

export const resolveInspectorHostOrigins = (
  optionHostOrigins: IteraReactInspectorVitePluginOptions['hostOrigins'],
  envHostOrigins: string | undefined,
): HostOriginResolution => {
  const hostOrigins: string[] = [];
  const invalidHostOrigins: string[] = [];
  const configuredHostOrigins = [
    ...toHostOriginItems(optionHostOrigins),
    ...toHostOriginItems(envHostOrigins),
  ];

  configuredHostOrigins.forEach((hostOrigin) => {
    const trimmedHostOrigin = hostOrigin.trim();

    if (trimmedHostOrigin.length === 0) {
      return;
    }

    const normalizedHostOrigin = normalizeOrigin(trimmedHostOrigin);

    if (normalizedHostOrigin === undefined) {
      invalidHostOrigins.push(trimmedHostOrigin);
      return;
    }

    if (!hostOrigins.includes(normalizedHostOrigin)) {
      hostOrigins.push(normalizedHostOrigin);
    }
  });

  return {
    hostOrigins,
    invalidHostOrigins,
  };
};

const getEnvString = (config: ResolvedConfig, key: string) => {
  const value = config.env[key];

  return typeof value === 'string' ? value : undefined;
};

const allowsHtmlInjection = (
  options: IteraReactInspectorVitePluginOptions,
  config: ResolvedConfig,
) => {
  return config.command !== 'build' || options.includeInBuild === true;
};

export const resolveRuntimeOptions = (
  options: IteraReactInspectorVitePluginOptions,
  config: ResolvedConfig,
): RuntimeOptions => {
  const enabled = resolveInspectorEnabled(
    options.enabled,
    getEnvString(config, ENABLED_ENV_KEY),
  );
  const hostOriginResolution = resolveInspectorHostOrigins(
    options.hostOrigins,
    getEnvString(config, HOST_ORIGINS_ENV_KEY),
  );

  if (!enabled) {
    return {
      enabled: false,
      hostOrigins: hostOriginResolution.hostOrigins,
    };
  }

  if (!allowsHtmlInjection(options, config)) {
    return {
      enabled,
      hostOrigins: hostOriginResolution.hostOrigins,
    };
  }

  if (hostOriginResolution.invalidHostOrigins.length > 0) {
    config.logger.warn(
      `${WARNING_PREFIX} Ignoring invalid host origin values: ${hostOriginResolution.invalidHostOrigins.join(', ')}`,
    );
  }

  if (hostOriginResolution.hostOrigins.length === 0) {
    config.logger.warn(
      `${WARNING_PREFIX} Inspector is enabled but no trusted host origins are configured. Set hostOrigins in createIteraReactInspectorVitePlugin(...) or ${HOST_ORIGINS_ENV_KEY}.`,
    );
  }

  return {
    enabled,
    hostOrigins: hostOriginResolution.hostOrigins,
  };
};

const shouldInjectRuntime = (
  runtimeOptions: RuntimeOptions,
  pluginOptions: IteraReactInspectorVitePluginOptions,
  config: ResolvedConfig | undefined,
) => {
  return (
    config !== undefined &&
    allowsHtmlInjection(pluginOptions, config) &&
    runtimeOptions.enabled &&
    runtimeOptions.hostOrigins.length > 0
  );
};

const prefixViteBase = (base: string, path: string) => {
  if (base.length === 0 || base === '/') {
    return path;
  }

  const normalizedBase = base.endsWith('/') ? base.slice(0, -1) : base;

  return `${normalizedBase}${path}`;
};

const isAbsoluteUrl = (value: string) => {
  try {
    new URL(value);

    return true;
  } catch {
    return false;
  }
};

const prefixViteServerOrigin = (
  serverOrigin: string | undefined,
  path: string,
) => {
  if (
    serverOrigin === undefined ||
    serverOrigin.length === 0 ||
    isAbsoluteUrl(path)
  ) {
    return path;
  }

  return new URL(path, `${serverOrigin.replace(/\/$/, '')}/`).toString();
};

const resolveDevRuntimeModuleSrc = (config: ResolvedConfig) => {
  return prefixViteServerOrigin(
    config.server.origin,
    prefixViteBase(config.base, VITE_BROWSER_RESOLVED_ID_PATH),
  );
};

const createRuntimeHtmlTag = (config: ResolvedConfig): HtmlTagDescriptor => {
  if (config.command === 'serve') {
    return {
      tag: 'script',
      attrs: {
        type: 'module',
        src: resolveDevRuntimeModuleSrc(config),
      },
      injectTo: 'head-prepend',
    };
  }

  return {
    tag: 'script',
    attrs: {
      type: 'module',
    },
    children: `import ${JSON.stringify(ITERA_REACT_INSPECTOR_VIRTUAL_MODULE_ID)};`,
    injectTo: 'head-prepend',
  };
};

export const createRuntimeModuleCode = (runtimeOptions: RuntimeOptions) => {
  const serializedOptions = JSON.stringify({
    enabled: runtimeOptions.enabled,
    hostOrigins: runtimeOptions.hostOrigins,
    stateKey: BOOTSTRAP_STATE_KEY,
    warningPrefix: WARNING_PREFIX,
  });

  return `
import { bootIteraReactInspectorViteRuntime } from '@iteraai/vite-plugin-react-inspector/client';

const stop = bootIteraReactInspectorViteRuntime(${serializedOptions});

if (import.meta.hot) {
  import.meta.hot.dispose(stop);
}

export {};
`;
};

export const createIteraReactInspectorVitePlugin = (
  options: IteraReactInspectorVitePluginOptions = {},
): Plugin => {
  let resolvedConfig: ResolvedConfig | undefined;
  let runtimeOptions = disabledRuntimeOptions;

  return {
    name: 'itera-react-inspector-vite-plugin',
    enforce: 'pre',
    configResolved(config) {
      resolvedConfig = config;
      runtimeOptions = resolveRuntimeOptions(options, config);
    },
    resolveId(id) {
      if (id === ITERA_REACT_INSPECTOR_VIRTUAL_MODULE_ID) {
        return ITERA_REACT_INSPECTOR_RESOLVED_VIRTUAL_MODULE_ID;
      }

      return null;
    },
    load(id) {
      if (id !== ITERA_REACT_INSPECTOR_RESOLVED_VIRTUAL_MODULE_ID) {
        return null;
      }

      return createRuntimeModuleCode(runtimeOptions);
    },
    transformIndexHtml(html) {
      const config = resolvedConfig;

      if (config === undefined) {
        return;
      }

      if (
        html.includes(ITERA_REACT_INSPECTOR_VIRTUAL_MODULE_ID) ||
        !shouldInjectRuntime(runtimeOptions, options, config)
      ) {
        return;
      }

      return [createRuntimeHtmlTag(config)];
    },
  };
};

export const iteraReactInspector = createIteraReactInspectorVitePlugin;
