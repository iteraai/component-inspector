import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { readBuiltAngularBundleSources } from './angularExampleConsumerTestUtils';

const workspaceRoot = path.resolve(import.meta.dirname, '..');
const SOURCE_METADATA_CONTEXT_RADIUS = 400;

const run = (command: string, args: string[]) => {
  const result = spawnSync(command, args, {
    cwd: workspaceRoot,
    encoding: 'utf8',
    env: {
      ...process.env,
      NG_CLI_ANALYTICS: 'false',
    },
  });

  if (result.status !== 0) {
    throw new Error(`${result.stdout}\n${result.stderr}`.trim());
  }
};

const escapeRegExp = (value: string) => {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
};

const getBundleSourceContaining = (
  bundleSources: readonly string[],
  filePath: string,
) => {
  const matchingBundleSource = bundleSources.find((source) => {
    return source.includes(filePath);
  });

  expect(matchingBundleSource).toBeDefined();

  return matchingBundleSource as string;
};

const expectSourceMetadataMarker = (
  bundleSource: string,
  filePath: string,
) => {
  const metadataContextMatch = bundleSource.match(
    new RegExp(
      `.{0,${SOURCE_METADATA_CONTEXT_RADIUS}}${escapeRegExp(filePath)}.{0,${SOURCE_METADATA_CONTEXT_RADIUS}}`,
      's',
    ),
  );

  expect(metadataContextMatch?.[0]).toBeDefined();
  expect(metadataContextMatch?.[0]).toContain('__iteraSource');
  expect(metadataContextMatch?.[0]).toMatch(/["']?line["']?\s*:\s*\d+/);
  expect(metadataContextMatch?.[0]).toMatch(/["']?column["']?\s*:\s*\d+/);
};

const angularBuildSmoke =
  process.platform === 'darwin' ? test.skip : test;

angularBuildSmoke(
  'builds through the public Angular builders and emits source metadata markers',
  () => {
    run('npm', ['run', 'build:smoke']);

    const bundleSources = readBuiltAngularBundleSources(workspaceRoot);
    const emittedBundle = bundleSources.join('\n');
    const appComponentBundleSource = getBundleSourceContaining(
      bundleSources,
      'src/app/app.component.ts',
    );
    const publishButtonBundleSource = getBundleSourceContaining(
      bundleSources,
      'src/app/publishButton.component.ts',
    );

    expect(emittedBundle).toContain('__iteraSource');
    expect(emittedBundle).toContain('src/app/publishButton.component.ts');
    expect(emittedBundle).toContain('src/app/app.component.ts');
    expectSourceMetadataMarker(
      appComponentBundleSource,
      'src/app/app.component.ts',
    );
    expectSourceMetadataMarker(
      publishButtonBundleSource,
      'src/app/publishButton.component.ts',
    );
  },
  120_000,
);
