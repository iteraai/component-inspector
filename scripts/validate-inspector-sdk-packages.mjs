import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const repoRoot = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  '..',
);

const sdkPackages = [
  {
    directory: path.join(repoRoot, 'packages/inspector-protocol'),
    name: '@iteraai/inspector-protocol',
    requiredFiles: [
      'README.md',
      'dist/index.js',
      'dist/index.d.ts',
      'dist/errors.js',
      'dist/errors.d.ts',
      'dist/origins.js',
      'dist/origins.d.ts',
      'dist/types.js',
      'dist/types.d.ts',
      'dist/validators.js',
      'dist/validators.d.ts',
      'package.json'
    ]
  },
  {
    directory: path.join(repoRoot, 'packages/react-component-inspector'),
    name: '@iteraai/react-component-inspector',
    requiredFiles: [
      'README.md',
      'dist/index.js',
      'dist/index.d.ts',
      'dist/embeddedBootstrap.js',
      'dist/embeddedBootstrap.d.ts',
      'dist/bridgeRuntime.js',
      'dist/bridgeRuntime.d.ts',
      'dist/iterationInspector.js',
      'dist/iterationInspector/index.d.ts',
      'dist/storybook.js',
      'dist/storybook/index.d.ts',
      'package.json'
    ]
  },
  {
    directory: path.join(repoRoot, 'packages/vue-component-inspector'),
    name: '@iteraai/vue-component-inspector',
    requiredFiles: [
      'README.md',
      'dist/index.js',
      'dist/index.d.ts',
      'dist/embeddedBootstrap.js',
      'dist/embeddedBootstrap.d.ts',
      'dist/bridgeRuntime.js',
      'dist/bridgeRuntime.d.ts',
      'dist/iterationInspector.js',
      'dist/iterationInspector/index.d.ts',
      'package.json'
    ]
  },
  {
    directory: path.join(repoRoot, 'packages/angular-component-inspector'),
    name: '@iteraai/angular-component-inspector',
    requiredFiles: [
      'README.md',
      'builders.json',
      'schemas/application.schema.json',
      'schemas/dev-server.schema.json',
      'dist/index.js',
      'dist/index.d.ts',
      'dist/embeddedBootstrap.js',
      'dist/embeddedBootstrap.d.ts',
      'dist/bridgeRuntime.js',
      'dist/bridgeRuntime.d.ts',
      'dist/iterationInspector.js',
      'dist/iterationInspector/index.d.ts',
      'dist/builders/application.js',
      'dist/builders/application.d.ts',
      'dist/builders/devServer.js',
      'dist/builders/devServer.d.ts',
      'package.json'
    ]
  }
];

const run = (command, args, cwd, envOverrides = {}) => {
  const result = spawnSync(command, args, {
    cwd,
    encoding: 'utf8',
    env: {
      ...process.env,
      ...envOverrides,
    },
    stdio: 'pipe'
  });

  if (result.status === 0) {
    return result.stdout.trim();
  }

  throw new Error(
    `${command} ${args.join(' ')} failed in ${cwd}\n${result.stdout}\n${result.stderr}`,
  );
};

const validatePackContents = (packageDefinition, packedFiles) => {
  const packedFilePaths = packedFiles.map((file) => file.path).sort();

  for (const requiredFile of packageDefinition.requiredFiles) {
    assert(
      packedFilePaths.includes(requiredFile),
      `${packageDefinition.name} tarball is missing ${requiredFile}`,
    );
  }

  for (const packedFilePath of packedFilePaths) {
    assert(
      !packedFilePath.startsWith('src/'),
      `${packageDefinition.name} tarball unexpectedly includes source file ${packedFilePath}`,
    );
    assert(
      !packedFilePath.startsWith('testing/'),
      `${packageDefinition.name} tarball unexpectedly includes test helper ${packedFilePath}`,
    );
    assert(
      !packedFilePath.startsWith('eslint/'),
      `${packageDefinition.name} tarball unexpectedly includes eslint helper ${packedFilePath}`,
    );
  }
};

const packPackage = (packageDefinition, packDestination, npmEnvironment) => {
  const rawPackResult = run(
    'npm',
    ['pack', '--json', '--pack-destination', packDestination, '--silent'],
    packageDefinition.directory,
    npmEnvironment,
  );
  const jsonPayload = rawPackResult.match(/(\[\s*\{[\s\S]*\])\s*$/)?.[1];

  assert(
    jsonPayload !== undefined,
    `Could not find npm pack JSON payload for ${packageDefinition.name}`,
  );

  const [packResult] = JSON.parse(jsonPayload);

  validatePackContents(packageDefinition, packResult.files);

  return path.join(packDestination, packResult.filename);
};

const fixturePackageJson = (
  protocolTarball,
  reactBridgeTarball,
  vueBridgeTarball,
  angularBridgeTarball,
) => ({
  name: 'inspector-sdk-pack-smoke',
  version: '0.0.0',
  private: true,
  type: 'module',
  dependencies: {
    '@iteraai/inspector-protocol': `file:${protocolTarball}`,
    '@iteraai/react-component-inspector': `file:${reactBridgeTarball}`,
    '@iteraai/vue-component-inspector': `file:${vueBridgeTarball}`,
    '@iteraai/angular-component-inspector': `file:${angularBridgeTarball}`,
    '@angular/core': '^21.0.0',
    react: '19.2.4',
    'react-dom': '19.2.4',
    vue: '^3.5.0'
  },
  devDependencies: {
    typescript: '~5.6.2'
  }
});

const fixtureTsConfig = {
  compilerOptions: {
    lib: ['DOM', 'ES2020'],
    module: 'ESNext',
    moduleResolution: 'Bundler',
    noEmit: true,
    skipLibCheck: true,
    strict: true,
    target: 'ES2020'
  },
  include: ['smoke-types.ts']
};

const fixtureTypeSmoke = `import {
  buildMessage,
  type InspectorMessage,
} from '@iteraai/inspector-protocol';
import { createInspectorProtocolError } from '@iteraai/inspector-protocol/errors';
import { normalizeOrigin } from '@iteraai/inspector-protocol/origins';
import type { TreeNode } from '@iteraai/inspector-protocol/types';
import { isInspectorMessage } from '@iteraai/inspector-protocol/validators';
import {
  angularInspectorRequiredDevModeGlobalNames,
  resolveAngularInspectorRuntimeConfig,
  type AngularInspectorRuntimeConfig,
} from '@iteraai/angular-component-inspector';
import { bootstrapEmbeddedInspectorBridge as bootstrapAngularEmbeddedInspectorBridge } from '@iteraai/angular-component-inspector/embeddedBootstrap';
import { initInspectorBridge as initAngularInspectorBridge } from '@iteraai/angular-component-inspector/bridgeRuntime';
import {
  ITERATION_INSPECTOR_CHANNEL as ANGULAR_ITERATION_INSPECTOR_CHANNEL,
  type IterationInspectorRuntimeMessage as AngularIterationInspectorRuntimeMessage,
} from '@iteraai/angular-component-inspector/iterationInspector';
import {
  resolveReactInspectorRuntimeConfig,
  type ReactInspectorRuntimeConfig,
} from '@iteraai/react-component-inspector';
import { bootstrapEmbeddedInspectorBridge } from '@iteraai/react-component-inspector/embeddedBootstrap';
import { initInspectorBridge as initReactInspectorBridge } from '@iteraai/react-component-inspector/bridgeRuntime';
import {
  ITERATION_INSPECTOR_CHANNEL as REACT_ITERATION_INSPECTOR_CHANNEL,
  type IterationInspectorRuntimeMessage as ReactIterationInspectorRuntimeMessage,
} from '@iteraai/react-component-inspector/iterationInspector';
import {
  initStorybookManagerRelay,
  resolveStorybookPreviewHostOrigins,
} from '@iteraai/react-component-inspector/storybook';
import {
  resolveVueInspectorRuntimeConfig,
} from '@iteraai/vue-component-inspector';
import { bootstrapEmbeddedInspectorBridgeOnMount } from '@iteraai/vue-component-inspector/embeddedBootstrap';
import { initInspectorBridge as initVueInspectorBridge } from '@iteraai/vue-component-inspector/bridgeRuntime';
import {
  ITERATION_INSPECTOR_CHANNEL as VUE_ITERATION_INSPECTOR_CHANNEL,
  type IterationInspectorRuntimeMessage as VueIterationInspectorRuntimeMessage,
} from '@iteraai/vue-component-inspector/iterationInspector';

const ping: InspectorMessage<'PING'> = buildMessage('PING', { sentAt: 1 });
const treeNode: TreeNode = {
  id: 'node-1',
  displayName: 'Button',
  parentId: null,
  childrenIds: [],
};
const runtimeConfig: ReactInspectorRuntimeConfig = {
  capabilities: {
    tree: false,
  },
};
const angularRuntimeConfig: AngularInspectorRuntimeConfig = {
  adapter: 'angular-dev-mode-globals',
  capabilities: {
    props: false,
  },
  angularGlobals: null,
};
const angularRuntimeMessage: AngularIterationInspectorRuntimeMessage = {
  channel: ANGULAR_ITERATION_INSPECTOR_CHANNEL,
  kind: 'runtime_ready',
  urlPath: '/',
};
const angularBootstrapFn: typeof bootstrapAngularEmbeddedInspectorBridge =
  bootstrapAngularEmbeddedInspectorBridge;
const initAngularBridgeFn: typeof initAngularInspectorBridge =
  initAngularInspectorBridge;
const runtimeMessage: ReactIterationInspectorRuntimeMessage = {
  channel: REACT_ITERATION_INSPECTOR_CHANNEL,
  kind: 'runtime_ready',
  urlPath: '/',
};
const bootstrapFn: typeof bootstrapEmbeddedInspectorBridge =
  bootstrapEmbeddedInspectorBridge;
const initBridgeFn: typeof initReactInspectorBridge = initReactInspectorBridge;
const initStorybookRelayFn: typeof initStorybookManagerRelay =
  initStorybookManagerRelay;
const storybookPreviewOrigins = resolveStorybookPreviewHostOrigins({
  hostOrigins: ['https://app.iteradev.ai'],
  referrer: 'https://storybook.iteradev.ai/?path=/story/button--primary',
});
const vueRuntimeConfig: Parameters<typeof resolveVueInspectorRuntimeConfig>[0] = {
  adapter: 'vue3',
  mountedAppDiscovery: {
    strategy: 'explicit-only',
  },
};
const vueRuntimeMessage: VueIterationInspectorRuntimeMessage = {
  channel: VUE_ITERATION_INSPECTOR_CHANNEL,
  kind: 'runtime_ready',
  urlPath: '/',
};
const vueBootstrapFn: typeof bootstrapEmbeddedInspectorBridgeOnMount =
  bootstrapEmbeddedInspectorBridgeOnMount;
const initVueBridgeFn: typeof initVueInspectorBridge = initVueInspectorBridge;
const protocolError = createInspectorProtocolError('ERR_NODE_NOT_FOUND');
const resolvedOrigin = normalizeOrigin('https://itera.ai/path');
const isPingMessage = isInspectorMessage(ping);
const requiredAngularGlobals = angularInspectorRequiredDevModeGlobalNames;
const resolvedAngularRuntimeConfig = resolveAngularInspectorRuntimeConfig(
  angularRuntimeConfig,
);
const resolvedRuntimeConfig = resolveReactInspectorRuntimeConfig(runtimeConfig);
const resolvedVueRuntimeConfig = resolveVueInspectorRuntimeConfig(
  vueRuntimeConfig,
);

void treeNode;
void angularRuntimeMessage;
void angularBootstrapFn;
void initAngularBridgeFn;
void runtimeMessage;
void bootstrapFn;
void initBridgeFn;
void initStorybookRelayFn;
void storybookPreviewOrigins;
void vueRuntimeMessage;
void vueBootstrapFn;
void initVueBridgeFn;
void requiredAngularGlobals;
void resolvedAngularRuntimeConfig;
void resolvedRuntimeConfig;
void resolvedVueRuntimeConfig;

if (!isPingMessage || protocolError.code !== 'ERR_NODE_NOT_FOUND') {
  throw new Error('Protocol smoke typing failed.');
}

if (resolvedOrigin !== 'https://itera.ai') {
  throw new Error('Origin helper smoke typing failed.');
}
`;

const fixtureRuntimeSmoke = `import assert from 'node:assert/strict';
import {
  INSPECTOR_CHANNEL,
  buildMessage,
  parseMessage,
} from '@iteraai/inspector-protocol';
import { createInspectorProtocolError } from '@iteraai/inspector-protocol/errors';
import { normalizeOrigin } from '@iteraai/inspector-protocol/origins';
import { isInspectorMessage } from '@iteraai/inspector-protocol/validators';
import {
  angularInspectorRequiredDevModeGlobalNames,
  angularInspectorRuntimeAdapterTargets,
  defaultAngularInspectorRuntimeConfig,
  hasRequiredAngularDevModeGlobals,
  resolveAngularInspectorRuntimeConfig,
} from '@iteraai/angular-component-inspector';
import { bootstrapEmbeddedInspectorBridge as bootstrapAngularEmbeddedInspectorBridge } from '@iteraai/angular-component-inspector/embeddedBootstrap';
import { initInspectorBridge as initAngularInspectorBridge } from '@iteraai/angular-component-inspector/bridgeRuntime';
import {
  ITERATION_INSPECTOR_CHANNEL as ANGULAR_ITERATION_INSPECTOR_CHANNEL,
  isIterationInspectorRuntimeMessage as isAngularIterationInspectorRuntimeMessage,
} from '@iteraai/angular-component-inspector/iterationInspector';
import {
  defaultReactInspectorRuntimeConfig,
  resolveReactInspectorRuntimeConfig,
} from '@iteraai/react-component-inspector';
import { bootstrapEmbeddedInspectorBridge } from '@iteraai/react-component-inspector/embeddedBootstrap';
import { initInspectorBridge as initReactInspectorBridge } from '@iteraai/react-component-inspector/bridgeRuntime';
import {
  ITERATION_INSPECTOR_CHANNEL,
  isIterationInspectorRuntimeMessage,
} from '@iteraai/react-component-inspector/iterationInspector';
import {
  initStorybookManagerRelay,
  resolveStorybookPreviewHostOrigins,
} from '@iteraai/react-component-inspector/storybook';
import {
  defaultVueInspectorRuntimeConfig,
  defaultVueMountedAppDiscovery,
  resolveVueInspectorRuntimeConfig,
  vueInspectorMountedAppDiscoveryStrategies,
  vueInspectorRuntimeAdapterTargets,
} from '@iteraai/vue-component-inspector';
import { bootstrapEmbeddedInspectorBridgeOnMount } from '@iteraai/vue-component-inspector/embeddedBootstrap';
import { initInspectorBridge as initVueInspectorBridge } from '@iteraai/vue-component-inspector/bridgeRuntime';
import {
  ITERATION_INSPECTOR_CHANNEL as VUE_ITERATION_INSPECTOR_CHANNEL,
  isIterationInspectorParentMessage as isVueIterationInspectorParentMessage,
  isIterationInspectorRuntimeMessage as isVueIterationInspectorRuntimeMessage,
} from '@iteraai/vue-component-inspector/iterationInspector';

const pingMessage = buildMessage(
  'PING',
  {
    sentAt: 1_700_000_200,
  },
  {
    requestId: 'request-1',
  },
);

assert.equal(isInspectorMessage(pingMessage), true);

const parsedMessage = parseMessage(pingMessage);

assert.equal(parsedMessage.ok, true);

if (parsedMessage.ok) {
  assert.equal(parsedMessage.message.channel, INSPECTOR_CHANNEL);
}

assert.deepEqual(createInspectorProtocolError('ERR_NODE_NOT_FOUND'), {
  code: 'ERR_NODE_NOT_FOUND',
  message: 'Requested node was not found.',
});
assert.equal(normalizeOrigin('https://itera.ai/path?q=1'), 'https://itera.ai');
assert.deepEqual(angularInspectorRuntimeAdapterTargets, [
  'auto',
  'angular-dev-mode-globals',
  'noop',
]);
assert.deepEqual(angularInspectorRequiredDevModeGlobalNames, [
  'getComponent',
  'getOwningComponent',
  'getHostElement',
  'getDirectiveMetadata',
]);
assert.equal(defaultAngularInspectorRuntimeConfig.adapter, 'auto');
assert.deepEqual(defaultAngularInspectorRuntimeConfig.capabilities, {
  tree: true,
  props: true,
  highlight: true,
});
assert.equal(
  hasRequiredAngularDevModeGlobals({
    getComponent() {
      return null;
    },
    getOwningComponent() {
      return null;
    },
    getHostElement() {
      return null;
    },
    getDirectiveMetadata() {
      return null;
    },
  }),
  true,
);
assert.deepEqual(
  resolveAngularInspectorRuntimeConfig({
    adapter: 'angular-dev-mode-globals',
    capabilities: {
      props: false,
    },
    angularGlobals: null,
  }),
  {
    adapter: 'angular-dev-mode-globals',
    capabilities: {
      tree: true,
      props: false,
      highlight: true,
    },
    angularGlobals: null,
  },
);
assert.equal(typeof bootstrapAngularEmbeddedInspectorBridge, 'function');
assert.equal(typeof initAngularInspectorBridge, 'function');
assert.equal(
  isAngularIterationInspectorRuntimeMessage({
    channel: ANGULAR_ITERATION_INSPECTOR_CHANNEL,
    kind: 'runtime_ready',
    urlPath: '/preview',
  }),
  true,
);
assert.deepEqual(defaultReactInspectorRuntimeConfig, {
  adapter: 'auto',
  capabilities: {
    tree: true,
    props: true,
    highlight: true,
  },
});
assert.deepEqual(
  resolveReactInspectorRuntimeConfig({
    capabilities: {
      tree: false,
    },
  }),
  {
    adapter: 'auto',
    capabilities: {
      tree: false,
      props: true,
      highlight: true,
    },
  },
);
assert.equal(typeof bootstrapEmbeddedInspectorBridge, 'function');
assert.equal(typeof initReactInspectorBridge, 'function');
assert.equal(typeof initStorybookManagerRelay, 'function');
assert.deepEqual(
  resolveStorybookPreviewHostOrigins({
    hostOrigins: ['https://app.iteradev.ai'],
    referrer: 'https://storybook.iteradev.ai/?path=/story/button--primary',
  }),
  ['https://app.iteradev.ai', 'https://storybook.iteradev.ai'],
);
assert.equal(
  isIterationInspectorRuntimeMessage({
    channel: ITERATION_INSPECTOR_CHANNEL,
    kind: 'runtime_ready',
    urlPath: '/preview',
  }),
  true,
);
assert.deepEqual(vueInspectorRuntimeAdapterTargets, ['auto', 'vue3']);
assert.deepEqual(vueInspectorMountedAppDiscoveryStrategies, [
  'auto',
  'explicit-only',
  'dom-only',
]);
assert.deepEqual(defaultVueMountedAppDiscovery, {
  strategy: 'auto',
  containerSelector: '[data-v-app]',
});
assert.equal(defaultVueInspectorRuntimeConfig.adapter, 'auto');
assert.deepEqual(defaultVueInspectorRuntimeConfig.capabilities, {
  tree: true,
  props: true,
  highlight: true,
});
assert.equal(
  typeof defaultVueInspectorRuntimeConfig.appRegistry.getMountedApps,
  'function',
);
assert.deepEqual(
  resolveVueInspectorRuntimeConfig({
    adapter: 'vue3',
    capabilities: {
      props: false,
    },
    mountedAppDiscovery: {
      strategy: 'explicit-only',
    },
  }),
  {
    adapter: 'vue3',
    capabilities: {
      tree: true,
      props: false,
      highlight: true,
    },
    appRegistry: defaultVueInspectorRuntimeConfig.appRegistry,
    mountedAppDiscovery: {
      strategy: 'explicit-only',
      containerSelector: '[data-v-app]',
    },
  },
);
assert.equal(typeof bootstrapEmbeddedInspectorBridgeOnMount, 'function');
assert.equal(typeof initVueInspectorBridge, 'function');
assert.equal(
  isVueIterationInspectorParentMessage({
    channel: VUE_ITERATION_INSPECTOR_CHANNEL,
    kind: 'enter_select_mode',
  }),
  true,
);
assert.equal(
  isVueIterationInspectorRuntimeMessage({
    channel: VUE_ITERATION_INSPECTOR_CHANNEL,
    kind: 'runtime_ready',
    urlPath: '/preview',
  }),
  true,
);
`;

const main = () => {
  const tempRoot = fs.mkdtempSync(
    path.join(os.tmpdir(), 'inspector-sdk-pack-smoke-'),
  );
  const packDestination = path.join(tempRoot, 'packed');
  const fixtureDirectory = path.join(tempRoot, 'fixture');
  const npmCacheDirectory = path.join(tempRoot, 'npm-cache');
  const npmEnvironment = {
    npm_config_cache: npmCacheDirectory,
  };

  fs.mkdirSync(packDestination, { recursive: true });
  fs.mkdirSync(fixtureDirectory, { recursive: true });
  fs.mkdirSync(npmCacheDirectory, { recursive: true });

  try {
    const protocolTarball = packPackage(
      sdkPackages[0],
      packDestination,
      npmEnvironment,
    );
    const reactBridgeTarball = packPackage(
      sdkPackages[1],
      packDestination,
      npmEnvironment,
    );
    const vueBridgeTarball = packPackage(
      sdkPackages[2],
      packDestination,
      npmEnvironment,
    );
    const angularBridgeTarball = packPackage(
      sdkPackages[3],
      packDestination,
      npmEnvironment,
    );

    fs.writeFileSync(
      path.join(fixtureDirectory, 'package.json'),
      `${JSON.stringify(
        fixturePackageJson(
          protocolTarball,
          reactBridgeTarball,
          vueBridgeTarball,
          angularBridgeTarball,
        ),
        null,
        2,
      )}\n`,
    );
    fs.writeFileSync(
      path.join(fixtureDirectory, 'tsconfig.json'),
      `${JSON.stringify(fixtureTsConfig, null, 2)}\n`,
    );
    fs.writeFileSync(
      path.join(fixtureDirectory, 'smoke-types.ts'),
      fixtureTypeSmoke,
    );
    fs.writeFileSync(
      path.join(fixtureDirectory, 'smoke-runtime.mjs'),
      fixtureRuntimeSmoke,
    );

    run(
      'npm',
      ['install', '--legacy-peer-deps'],
      fixtureDirectory,
      npmEnvironment,
    );
    run('npx', ['tsc', '--noEmit'], fixtureDirectory, npmEnvironment);
    run('node', ['smoke-runtime.mjs'], fixtureDirectory);
  } catch (error) {
    console.error(
      `Inspector SDK pack validation failed. Temporary files kept at ${tempRoot}`,
    );
    throw error;
  }

  fs.rmSync(tempRoot, { recursive: true, force: true });
};

main();
