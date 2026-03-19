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

const packageDefinitions = [
  {
    directory: path.join(repoRoot, 'packages/inspector-protocol'),
    name: '@iteraai/inspector-protocol',
  },
  {
    directory: path.join(repoRoot, 'packages/react-component-inspector'),
    name: '@iteraai/react-component-inspector',
  },
];

const docsFixtureDirectory = path.join(
  repoRoot,
  'packages/react-component-inspector/docs-fixtures',
);

const repoPackageJson = JSON.parse(
  fs.readFileSync(path.join(repoRoot, 'package.json'), 'utf8'),
);
const bridgePackageJson = JSON.parse(
  fs.readFileSync(
    path.join(repoRoot, 'packages/react-component-inspector/package.json'),
    'utf8',
  ),
);

const run = (command, args, cwd) => {
  const result = spawnSync(command, args, {
    cwd,
    encoding: 'utf8',
    stdio: 'pipe',
  });

  if (result.status === 0) {
    return result.stdout.trim();
  }

  throw new Error(
    `${command} ${args.join(' ')} failed in ${cwd}\n${result.stdout}\n${result.stderr}`,
  );
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

  return path.join(packDestination, packResult.filename);
};

const fixturePackageJson = (protocolTarball, bridgeTarball) => ({
  name: 'react-component-inspector-docs-drift',
  private: true,
  type: 'module',
  dependencies: {
    '@iteraai/inspector-protocol': `file:${protocolTarball}`,
    '@iteraai/react-component-inspector': `file:${bridgeTarball}`,
    react: repoPackageJson.devDependencies.react,
    'react-dom': repoPackageJson.devDependencies['react-dom'],
  },
  devDependencies: {
    '@types/node': bridgePackageJson.devDependencies['@types/node'],
    '@types/react': repoPackageJson.devDependencies['@types/react'],
    '@types/react-dom': repoPackageJson.devDependencies['@types/react-dom'],
    typescript: bridgePackageJson.devDependencies.typescript,
  },
});

const fixtureTsConfig = {
  compilerOptions: {
    lib: ['DOM', 'ES2020'],
    module: 'ESNext',
    moduleResolution: 'Bundler',
    noEmit: true,
    skipLibCheck: true,
    strict: true,
    target: 'ES2020',
    types: ['node'],
  },
  include: ['*.ts'],
};

const copyDocsFixtures = (destinationDirectory) => {
  const fixturePaths = fs
    .readdirSync(docsFixtureDirectory)
    .filter((fileName) => fileName.endsWith('.ts'))
    .sort();

  for (const fixturePath of fixturePaths) {
    fs.copyFileSync(
      path.join(docsFixtureDirectory, fixturePath),
      path.join(destinationDirectory, fixturePath),
    );
  }
};

const main = () => {
  const tempRoot = fs.mkdtempSync(
    path.join(os.tmpdir(), 'react-component-inspector-docs-drift-'),
  );
  const packDestination = path.join(tempRoot, 'packed');
  const fixtureDirectory = path.join(tempRoot, 'fixture');

  fs.mkdirSync(packDestination, { recursive: true });
  fs.mkdirSync(fixtureDirectory, { recursive: true });

  try {
    const protocolTarball = packPackage(packageDefinitions[0], packDestination);
    const bridgeTarball = packPackage(packageDefinitions[1], packDestination);

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
    copyDocsFixtures(fixtureDirectory);

    run('npm', ['install'], fixtureDirectory);
    run('npx', ['tsc', '--project', 'tsconfig.json', '--noEmit'], fixtureDirectory);
  } catch (error) {
    console.error(
      `React component inspector docs drift validation failed. Temporary files kept at ${tempRoot}`,
    );
    throw error;
  }

  fs.rmSync(tempRoot, { recursive: true, force: true });
};

main();
