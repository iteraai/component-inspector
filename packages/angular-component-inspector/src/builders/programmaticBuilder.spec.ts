import type { BuilderContext } from '@angular-devkit/architect';
import {
  executeAngularApplicationBuilder,
  executeAngularDevServerBuilder,
} from './programmaticBuilder';

const collectBuilderOutputs = async (
  outputs: AsyncIterable<{
    success: boolean;
  }>,
) => {
  const collectedOutputs: {
    success: boolean;
  }[] = [];

  for await (const output of outputs) {
    collectedOutputs.push(output);
  }

  return collectedOutputs;
};

const createBuilderContext = (
  overrides: Partial<BuilderContext> = {},
): BuilderContext => {
  return {
    workspaceRoot: '/workspace',
    logger: {
      info: vi.fn(),
      warn: vi.fn(),
      error: vi.fn(),
    },
    scheduleBuilder: vi.fn(),
    getBuilderNameForTarget: vi.fn(async () => '@angular/build:application'),
    getTargetOptions: vi.fn(async () => ({})),
    validateOptions: vi.fn(async (options) => options),
    addTeardown: vi.fn(),
    ...overrides,
  } as BuilderContext;
};

test('application builder uses the Angular build application API with source metadata plugins for development builds', async () => {
  const buildApplication = vi.fn(async function* () {
    yield {
      success: true,
    };
  });
  const context = createBuilderContext({
    target: {
      configuration: 'development',
    },
  });

  const outputs = await collectBuilderOutputs(
    executeAngularApplicationBuilder(
      {
        delegateBuilder: '@angular/build:application',
        outputPath: 'dist/app',
      },
      context,
      async () => ({
        buildApplication,
      }),
    ),
  );

  expect(outputs).toEqual([
    {
      success: true,
    },
  ]);
  expect(buildApplication).toHaveBeenCalledWith(
    {
      outputPath: 'dist/app',
    },
    context,
    {
      codePlugins: [expect.objectContaining({ name: 'itera-angular-source-metadata' })],
    },
  );
});

test('application builder disables source metadata plugins for production-like builds', async () => {
  const buildApplication = vi.fn(async function* () {
    yield {
      success: true,
    };
  });
  const context = createBuilderContext({
    target: {
      configuration: 'production',
    },
  });

  await collectBuilderOutputs(
    executeAngularApplicationBuilder(
      {
        delegateBuilder: '@angular/build:application',
        outputPath: 'dist/app',
        optimization: true,
      },
      context,
      async () => ({
        buildApplication,
      }),
    ),
  );

  expect(buildApplication).toHaveBeenCalledWith(
    {
      outputPath: 'dist/app',
      optimization: true,
    },
    context,
    {},
  );
});

test('dev-server builder validates Angular application targets against the delegated Angular application schema', async () => {
  const executeDevServerBuilder = vi.fn(async function* (options, context) {
    expect(
      await context.getBuilderNameForTarget({
        project: 'app',
        target: 'build',
      }),
    ).toBe('@angular/build:application');
    await context.validateOptions(
      {
        outputPath: 'dist/app',
        inspectorSourceMetadata: {
          enabled: true,
        },
      },
      '@angular/build:application',
    );

    yield {
      success: options.buildTarget === 'app:build',
    };
  });
  const validateOptions = vi.fn(async (options) => options);
  const context = createBuilderContext({
    target: {
      configuration: 'development',
    },
    getBuilderNameForTarget: vi.fn(async () => {
      return '@iteraai/angular-component-inspector:application';
    }),
    validateOptions,
  });

  const outputs = await collectBuilderOutputs(
    executeAngularDevServerBuilder(
      {
        delegateBuilder: '@angular/build:dev-server',
        buildTarget: 'app:build',
      },
      context,
      async () => ({
        executeDevServerBuilder,
      }),
      ((builderKind: 'application' | 'dev-server') => {
        return builderKind === 'application'
          ? '@angular/build:application'
          : '@angular/build:dev-server';
      }) as never,
    ),
  );

  expect(outputs).toEqual([
    {
      success: true,
    },
  ]);
  expect(validateOptions).toHaveBeenCalledWith(
    {
      outputPath: 'dist/app',
    },
    '@angular/build:application',
  );
  expect(executeDevServerBuilder).toHaveBeenCalledWith(
    {
      buildTarget: 'app:build',
    },
    expect.objectContaining({
      workspaceRoot: '/workspace',
    }),
    {
      buildPlugins: [expect.objectContaining({ name: 'itera-angular-source-metadata' })],
    },
  );
});
