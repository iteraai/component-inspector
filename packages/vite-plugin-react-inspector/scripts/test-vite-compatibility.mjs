import { execFileSync } from 'node:child_process';
import {
  mkdtempSync,
  mkdirSync,
  readFileSync,
  readdirSync,
  rmSync,
  writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const packageDirectory = resolve(
  fileURLToPath(new URL('..', import.meta.url)),
);
const npmCliPath = process.env.npm_execpath;
const viteMajors = [5, 6, 7, 8];

if (npmCliPath === undefined) {
  throw new Error('Expected npm to provide npm_execpath.');
}

const runNpm = (arguments_, options = {}) => {
  return execFileSync(process.execPath, [npmCliPath, ...arguments_], {
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'pipe'],
    ...options,
  });
};

const createFixture = (fixtureDirectory, viteMajor, packageTarballPath) => {
  writeFileSync(
    join(fixtureDirectory, 'package.json'),
    `${JSON.stringify(
      {
        private: true,
        type: 'module',
        scripts: {
          build: 'vite build',
        },
        devDependencies: {
          '@iteraai/vite-plugin-react-inspector': `file:${packageTarballPath}`,
          'react': '^19.0.0',
          'react-dom': '^19.0.0',
          'vite': `^${viteMajor}.0.0`,
        },
      },
      null,
      2,
    )}\n`,
  );
  writeFileSync(join(fixtureDirectory, 'index.html'), '<div id="app"></div>\n');
  mkdirSync(join(fixtureDirectory, 'src'));
  writeFileSync(
    join(fixtureDirectory, 'src', 'main.js'),
    "document.querySelector('#app').textContent = 'fixture';\n",
  );
  writeFileSync(
    join(fixtureDirectory, 'vite.config.js'),
    `import { defineConfig } from 'vite';
import { createIteraReactInspectorVitePlugin } from '@iteraai/vite-plugin-react-inspector';

export default defineConfig({
  plugins: [createIteraReactInspectorVitePlugin({ enabled: false })],
});
`,
  );
};

const readInstalledViteMajor = (fixtureDirectory) => {
  const packageJson = JSON.parse(
    readFileSync(
      join(fixtureDirectory, 'node_modules', 'vite', 'package.json'),
      'utf8',
    ),
  );

  return Number.parseInt(packageJson.version, 10);
};

const temporaryDirectory = mkdtempSync(
  join(tmpdir(), 'itera-vite-plugin-compatibility-'),
);

try {
  const packageDirectoryForPack = join(temporaryDirectory, 'package');
  mkdirSync(packageDirectoryForPack);
  runNpm(['pack', '--json', '--pack-destination', packageDirectoryForPack], {
    cwd: packageDirectory,
  });

  const packageTarball = readdirSync(packageDirectoryForPack).find((fileName) =>
    fileName.endsWith('.tgz'),
  );

  if (packageTarball === undefined) {
    throw new Error('Expected npm pack to create the plugin tarball.');
  }

  const packageTarballPath = join(packageDirectoryForPack, packageTarball);

  for (const viteMajor of viteMajors) {
    const fixtureDirectory = join(temporaryDirectory, `vite-${viteMajor}`);
    mkdirSync(fixtureDirectory);
    createFixture(fixtureDirectory, viteMajor, packageTarballPath);
    runNpm(['install', '--ignore-scripts', '--no-audit', '--no-fund'], {
      cwd: fixtureDirectory,
    });

    if (readInstalledViteMajor(fixtureDirectory) !== viteMajor) {
      throw new Error(`Expected Vite ${viteMajor} in its compatibility fixture.`);
    }

    runNpm(['run', 'build'], { cwd: fixtureDirectory });
    console.log(`Vite ${viteMajor} compatibility fixture passed.`);
  }
} finally {
  rmSync(temporaryDirectory, { force: true, recursive: true });
}
