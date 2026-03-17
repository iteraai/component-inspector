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
      'package.json'
    ]
  }
];

const run = (command, args, cwd) => {
  const result = spawnSync(command, args, {
    cwd,
    encoding: 'utf8',
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

const packPackage = (packageDefinition, packDestination) => {
  const rawPackResult = run(
    'npm',
    ['pack', '--json', '--pack-destination', packDestination, '--silent'],
    packageDefinition.directory,
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

const fixturePackageJson = (protocolTarball, bridgeTarball) => ({
  name: 'inspector-sdk-pack-smoke',
  private: true,
  type: 'module',
  dependencies: {
    '@iteraai/inspector-protocol': `file:${protocolTarball}`,
    '@iteraai/react-component-inspector': `file:${bridgeTarball}`,
    react: '19.2.3',
    'react-dom': '19.2.3'
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
  resolveReactInspectorRuntimeConfig,
  type ReactInspectorRuntimeConfig,
} from '@iteraai/react-component-inspector';
import { bootstrapEmbeddedInspectorBridge } from '@iteraai/react-component-inspector/embeddedBootstrap';
import { initInspectorBridge } from '@iteraai/react-component-inspector/bridgeRuntime';
import {
  ITERATION_INSPECTOR_CHANNEL,
  type IterationInspectorRuntimeMessage,
} from '@iteraai/react-component-inspector/iterationInspector';

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
const runtimeMessage: IterationInspectorRuntimeMessage = {
  channel: ITERATION_INSPECTOR_CHANNEL,
  kind: 'runtime_ready',
  urlPath: '/',
};
const bootstrapFn: typeof bootstrapEmbeddedInspectorBridge =
  bootstrapEmbeddedInspectorBridge;
const initBridgeFn: typeof initInspectorBridge = initInspectorBridge;
const protocolError = createInspectorProtocolError('ERR_NODE_NOT_FOUND');
const resolvedOrigin = normalizeOrigin('https://itera.ai/path');
const isPingMessage = isInspectorMessage(ping);
const resolvedRuntimeConfig = resolveReactInspectorRuntimeConfig(runtimeConfig);

void treeNode;
void runtimeMessage;
void bootstrapFn;
void initBridgeFn;
void resolvedRuntimeConfig;

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
  defaultReactInspectorRuntimeConfig,
  resolveReactInspectorRuntimeConfig,
} from '@iteraai/react-component-inspector';
import { bootstrapEmbeddedInspectorBridge } from '@iteraai/react-component-inspector/embeddedBootstrap';
import { initInspectorBridge } from '@iteraai/react-component-inspector/bridgeRuntime';
import {
  ITERATION_INSPECTOR_CHANNEL,
  isIterationInspectorRuntimeMessage,
} from '@iteraai/react-component-inspector/iterationInspector';

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
assert.equal(typeof initInspectorBridge, 'function');
assert.equal(
  isIterationInspectorRuntimeMessage({
    channel: ITERATION_INSPECTOR_CHANNEL,
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

  fs.mkdirSync(packDestination, { recursive: true });
  fs.mkdirSync(fixtureDirectory, { recursive: true });

  try {
    const protocolTarball = packPackage(sdkPackages[0], packDestination);
    const bridgeTarball = packPackage(sdkPackages[1], packDestination);

    fs.writeFileSync(
      path.join(fixtureDirectory, 'package.json'),
      `${JSON.stringify(
        fixturePackageJson(protocolTarball, bridgeTarball),
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

    run('npm', ['install'], fixtureDirectory);
    run('npx', ['tsc', '--noEmit'], fixtureDirectory);
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
