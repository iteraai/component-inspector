import path from 'node:path';
import { createRequire } from 'node:module';
import { pathToFileURL } from 'node:url';
import type { BuilderContext, BuilderOutput } from '@angular-devkit/architect';
import type { AngularInspectorBuilderOptions } from './delegateBuilder';
import {
  defaultDelegateBuilderCandidates,
  resolveDefaultDelegateBuilder,
  runDelegatedAngularBuilder,
  stripInspectorBuilderOptions,
} from './delegateBuilder';
import { createAngularInspectorSourceMetadataPlugin } from './sourceMetadataPlugin';

type EsbuildPlugin = ReturnType<
  typeof createAngularInspectorSourceMetadataPlugin
>;

type AngularBuildModule = {
  buildApplication?: (
    options: Record<string, unknown>,
    context: BuilderContext,
    extensions?: {
      codePlugins?: EsbuildPlugin[];
    },
  ) => AsyncIterable<BuilderOutput>;
  executeDevServerBuilder?: (
    options: Record<string, unknown>,
    context: BuilderContext,
    extensions?: {
      buildPlugins?: EsbuildPlugin[];
    },
  ) => AsyncIterable<BuilderOutput>;
};

type LoadAngularBuildModule = (options: {
  workspaceRoot: string;
  preferredBuilderName?: string;
  requiredExport: keyof AngularBuildModule;
}) => Promise<AngularBuildModule | undefined>;

type ResolveDelegateBuilder = typeof resolveDefaultDelegateBuilder;

const angularInspectorApplicationBuilderName =
  '@iteraai/angular-component-inspector:application';

const toBuilderPackageName = (builderName: string) => {
  const [packageName] = builderName.split(':');

  return packageName;
};

const loadWorkspaceAngularBuildModule = async (
  packageName: string,
  workspaceRoot: string,
): Promise<AngularBuildModule | undefined> => {
  const workspaceRequire = createRequire(path.join(workspaceRoot, 'package.json'));

  try {
    const resolvedModulePath = workspaceRequire.resolve(packageName);

    return (await import(
      pathToFileURL(resolvedModulePath).href
    )) as AngularBuildModule;
  } catch {
    return undefined;
  }
};

const loadAngularBuildModule: LoadAngularBuildModule = async (options) => {
  const packageNames = [
    ...(options.preferredBuilderName === undefined
      ? []
      : [toBuilderPackageName(options.preferredBuilderName)]),
    ...defaultDelegateBuilderCandidates.application.map(toBuilderPackageName),
    ...defaultDelegateBuilderCandidates['dev-server'].map(toBuilderPackageName),
  ];

  for (const packageName of [...new Set(packageNames)]) {
    const module = await loadWorkspaceAngularBuildModule(
      packageName,
      options.workspaceRoot,
    );

    if (module?.[options.requiredExport] !== undefined) {
      return module;
    }
  }

  return undefined;
};

const isProgrammaticBuilderCandidate = (
  builderKind: 'application' | 'dev-server',
  builderName: string | undefined,
) => {
  return (
    builderName !== undefined &&
    defaultDelegateBuilderCandidates[builderKind].includes(builderName)
  );
};

const isRecord = (value: unknown): value is Record<string, unknown> => {
  return typeof value === 'object' && value !== null;
};

const isProductionLikeAngularBuild = (options: Record<string, unknown>) => {
  if (options.watch === true) {
    return false;
  }

  const optimization = options.optimization;

  if (typeof optimization === 'boolean') {
    return optimization;
  }

  if (!isRecord(optimization)) {
    return false;
  }

  return Object.values(optimization).some((value) => value === true);
};

const shouldEnableSourceMetadata = (
  options: AngularInspectorBuilderOptions,
  delegateOptions: Record<string, unknown>,
  context: BuilderContext,
) => {
  if (options.inspectorSourceMetadata?.enabled === false) {
    return false;
  }

  const configurationName = context.target?.configuration?.toLowerCase();

  if (configurationName?.includes('production') === true) {
    return false;
  }

  if (configurationName?.includes('development') === true) {
    return true;
  }

  return !isProductionLikeAngularBuild(delegateOptions);
};

const toSourceMetadataCodePlugins = (context: BuilderContext) => {
  return [
    createAngularInspectorSourceMetadataPlugin({
      workspaceRoot: context.workspaceRoot,
      logger: context.logger,
    }),
  ];
};

const createAngularDevServerValidationContext = (
  context: BuilderContext,
  delegatedApplicationBuilder: string,
): BuilderContext => {
  return {
    ...context,
    getBuilderNameForTarget: async (target) => {
      const resolvedBuilderName = await context.getBuilderNameForTarget(target);

      return resolvedBuilderName === angularInspectorApplicationBuilderName
        ? delegatedApplicationBuilder
        : resolvedBuilderName;
    },
    validateOptions: async (options, builderName) => {
      if (builderName !== delegatedApplicationBuilder) {
        return context.validateOptions(options, builderName);
      }

      const strippedOptions = stripInspectorBuilderOptions(
        options as AngularInspectorBuilderOptions,
      );

      return context.validateOptions(strippedOptions.delegateOptions, builderName);
    },
  };
};

const logSourceMetadataMode = (
  builderKind: 'application' | 'dev-server',
  context: BuilderContext,
  sourceMetadataEnabled: boolean,
) => {
  context.logger.info(
    sourceMetadataEnabled
      ? `[component-inspector/angular] ${builderKind} builder is injecting Angular component source metadata for this development build.`
      : `[component-inspector/angular] ${builderKind} builder is delegating without source metadata injection for this production-like build.`,
  );
};

const logProgrammaticBuilderFallback = (
  builderKind: 'application' | 'dev-server',
  context: BuilderContext,
) => {
  context.logger.warn(
    `[component-inspector/angular] Falling back to delegated Angular ${builderKind} builder execution without source metadata injection because the workspace build package does not expose the required programmatic builder API.`,
  );
};

export const executeAngularApplicationBuilder = async function* (
  options: AngularInspectorBuilderOptions,
  context: BuilderContext,
  angularBuildModuleLoader: LoadAngularBuildModule = loadAngularBuildModule,
  resolveDelegateBuilder: ResolveDelegateBuilder = resolveDefaultDelegateBuilder,
): AsyncIterable<BuilderOutput> {
  const { delegateBuilder, delegateOptions } = stripInspectorBuilderOptions(options);
  const resolvedDelegateBuilder =
    delegateBuilder ?? resolveDelegateBuilder('application', context.workspaceRoot);

  if (!isProgrammaticBuilderCandidate('application', resolvedDelegateBuilder)) {
    yield await runDelegatedAngularBuilder('application', options, context);
    return;
  }

  const angularBuildModule = await angularBuildModuleLoader({
    workspaceRoot: context.workspaceRoot,
    preferredBuilderName: resolvedDelegateBuilder,
    requiredExport: 'buildApplication',
  });

  if (angularBuildModule?.buildApplication === undefined) {
    logProgrammaticBuilderFallback('application', context);
    yield await runDelegatedAngularBuilder('application', options, context);
    return;
  }

  const sourceMetadataEnabled = shouldEnableSourceMetadata(
    options,
    delegateOptions,
    context,
  );

  logSourceMetadataMode('application', context, sourceMetadataEnabled);

  yield* angularBuildModule.buildApplication(delegateOptions, context, {
    ...(sourceMetadataEnabled && {
      codePlugins: toSourceMetadataCodePlugins(context),
    }),
  });
};

export const executeAngularDevServerBuilder = async function* (
  options: AngularInspectorBuilderOptions,
  context: BuilderContext,
  angularBuildModuleLoader: LoadAngularBuildModule = loadAngularBuildModule,
  resolveDelegateBuilder: ResolveDelegateBuilder = resolveDefaultDelegateBuilder,
): AsyncIterable<BuilderOutput> {
  const { delegateBuilder, delegateOptions } = stripInspectorBuilderOptions(options);
  const resolvedDelegateBuilder =
    delegateBuilder ?? resolveDelegateBuilder('dev-server', context.workspaceRoot);
  const delegatedApplicationBuilder = resolveDelegateBuilder(
    'application',
    context.workspaceRoot,
  );

  if (
    !isProgrammaticBuilderCandidate('dev-server', resolvedDelegateBuilder) ||
    delegatedApplicationBuilder === undefined
  ) {
    yield await runDelegatedAngularBuilder('dev-server', options, context);
    return;
  }

  const angularBuildModule = await angularBuildModuleLoader({
    workspaceRoot: context.workspaceRoot,
    preferredBuilderName: resolvedDelegateBuilder,
    requiredExport: 'executeDevServerBuilder',
  });

  if (angularBuildModule?.executeDevServerBuilder === undefined) {
    logProgrammaticBuilderFallback('dev-server', context);
    yield await runDelegatedAngularBuilder('dev-server', options, context);
    return;
  }

  const sourceMetadataEnabled = shouldEnableSourceMetadata(
    options,
    delegateOptions,
    context,
  );

  logSourceMetadataMode('dev-server', context, sourceMetadataEnabled);

  yield* angularBuildModule.executeDevServerBuilder(
    delegateOptions,
    createAngularDevServerValidationContext(
      context,
      delegatedApplicationBuilder,
    ),
    {
      ...(sourceMetadataEnabled && {
        buildPlugins: toSourceMetadataCodePlugins(context),
      }),
    },
  );
};
