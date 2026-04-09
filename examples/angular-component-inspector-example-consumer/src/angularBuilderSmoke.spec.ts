import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { readBuiltAngularBundleSources } from './angularExampleConsumerTestUtils';

const workspaceRoot = path.resolve(import.meta.dirname, '..');

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

const angularBuildSmoke =
  process.platform === 'darwin' ? test.skip : test;

angularBuildSmoke(
  'builds through the public Angular builders and emits source metadata markers',
  () => {
    run('npm', ['run', 'build:smoke']);

    const bundleSources = readBuiltAngularBundleSources(workspaceRoot);
    const emittedBundle = bundleSources.join('\n');

    expect(emittedBundle).toContain('__iteraSource');
    expect(emittedBundle).toContain('src/app/publishButton.component.ts');
    expect(emittedBundle).toContain('src/app/app.component.ts');
    expect(emittedBundle).toMatch(
      /__iteraSource".*?line:\s*\d+.*?column:\s*\d+/s,
    );
  },
  120_000,
);
