import {
  resolveDefaultDelegateBuilder,
  runDelegatedAngularBuilder,
} from './delegateBuilder';

test('default delegate builder resolution prefers the installed Angular builder package for the workspace', () => {
  expect(
    resolveDefaultDelegateBuilder(
      'application',
      '/workspace',
      (packageJsonSpecifier) => packageJsonSpecifier === '@angular/build/package.json',
    ),
  ).toBe('@angular/build:application');
  expect(
    resolveDefaultDelegateBuilder(
      'dev-server',
      '/workspace',
      (packageJsonSpecifier) =>
        packageJsonSpecifier === '@angular-devkit/build-angular/package.json',
    ),
  ).toBe('@angular-devkit/build-angular:dev-server');
});

test('delegated builder strips inspector-only scaffold options before forwarding', async () => {
  const stop = vi.fn();
  const scheduleBuilder = vi.fn(async () => {
    return {
      result: Promise.resolve({
        success: true,
      }),
      stop,
    };
  });
  const info = vi.fn();

  const result = await runDelegatedAngularBuilder(
    'application',
    {
      delegateBuilder: '@angular/build:application',
      outputPath: 'dist/app',
      inspectorSourceMetadata: {
        enabled: true,
      },
    },
    {
      workspaceRoot: '/workspace',
      logger: {
        info,
      },
      scheduleBuilder,
    },
  );

  expect(scheduleBuilder).toHaveBeenCalledWith('@angular/build:application', {
    outputPath: 'dist/app',
  });
  expect(info).toHaveBeenCalledWith(
    expect.stringContaining('scaffold pass-through mode'),
  );
  expect(stop).toHaveBeenCalledTimes(1);
  expect(result).toEqual({
    success: true,
  });
});

test('delegated builder fails softly when no supported Angular builder can be resolved', async () => {
  const warn = vi.fn();
  const scheduleBuilder = vi.fn();

  const result = await runDelegatedAngularBuilder(
    'dev-server',
    {},
    {
      workspaceRoot: '/workspace',
      logger: {
        warn,
      },
      scheduleBuilder,
    },
    () => false,
  );

  expect(scheduleBuilder).not.toHaveBeenCalled();
  expect(warn).toHaveBeenCalledWith(
    expect.stringContaining('Could not resolve a supported Angular dev-server delegate builder'),
  );
  expect(result).toEqual({
    success: false,
    error:
      '[component-inspector/angular] Could not resolve a supported Angular dev-server delegate builder from the current workspace.',
  });
});
