import path from 'node:path';
import { createRequire } from 'node:module';

type BuilderOutput = {
  success: boolean;
  error?: string;
};

type BuilderRun = {
  result: Promise<BuilderOutput>;
  stop?: () => Promise<void> | void;
};

type BuilderLogger = {
  info?: (message: string) => void;
  warn?: (message: string) => void;
};

type BuilderContext = {
  workspaceRoot: string;
  logger?: BuilderLogger;
  scheduleBuilder: (
    builderName: string,
    options: Record<string, unknown>,
  ) => Promise<BuilderRun>;
};

type InspectorSourceMetadataOptions = {
  enabled?: boolean;
};

export type AngularInspectorBuilderKind = 'application' | 'dev-server';

export type AngularInspectorBuilderOptions = Record<string, unknown> & {
  delegateBuilder?: string;
  inspectorSourceMetadata?: InspectorSourceMetadataOptions;
};

export const defaultDelegateBuilderCandidates: Record<
  AngularInspectorBuilderKind,
  readonly string[]
> = Object.freeze({
  application: [
    '@angular/build:application',
    '@angular-devkit/build-angular:application',
  ],
  'dev-server': [
    '@angular/build:dev-server',
    '@angular-devkit/build-angular:dev-server',
  ],
});

type ResolvePackageFromWorkspace = (
  packageJsonSpecifier: string,
  workspaceRoot: string,
) => boolean;

const defaultResolvePackageFromWorkspace: ResolvePackageFromWorkspace = (
  packageJsonSpecifier,
  workspaceRoot,
) => {
  const workspaceRequire = createRequire(path.join(workspaceRoot, 'package.json'));

  try {
    workspaceRequire.resolve(packageJsonSpecifier);
    return true;
  } catch {
    return false;
  }
};

const toCandidatePackageJsonSpecifier = (builderName: string) => {
  const [packageName] = builderName.split(':');

  return `${packageName}/package.json`;
};

const stripInspectorBuilderOptions = (
  options: AngularInspectorBuilderOptions,
) => {
  const {
    delegateBuilder,
    inspectorSourceMetadata,
    ...delegateOptions
  } = options;

  return {
    delegateBuilder,
    inspectorSourceMetadata,
    delegateOptions,
  };
};

export const resolveDefaultDelegateBuilder = (
  builderKind: AngularInspectorBuilderKind,
  workspaceRoot: string,
  resolvePackageFromWorkspace: ResolvePackageFromWorkspace =
    defaultResolvePackageFromWorkspace,
) => {
  return defaultDelegateBuilderCandidates[builderKind].find((builderName) => {
    return resolvePackageFromWorkspace(
      toCandidatePackageJsonSpecifier(builderName),
      workspaceRoot,
    );
  });
};

const buildMissingDelegateBuilderMessage = (
  builderKind: AngularInspectorBuilderKind,
) => {
  return `[component-inspector/angular] Could not resolve a supported Angular ${builderKind} delegate builder from the current workspace.`;
};

const maybeLogSourceMetadataScaffoldMessage = (
  builderKind: AngularInspectorBuilderKind,
  context: BuilderContext,
  sourceMetadataOptions: InspectorSourceMetadataOptions | undefined,
) => {
  if (sourceMetadataOptions?.enabled === false) {
    return;
  }

  context.logger?.info?.(
    `[component-inspector/angular] ${builderKind} builder is running in scaffold pass-through mode; source metadata instrumentation is not active yet.`,
  );
};

export const runDelegatedAngularBuilder = async (
  builderKind: AngularInspectorBuilderKind,
  options: AngularInspectorBuilderOptions,
  context: BuilderContext,
  resolvePackageFromWorkspace: ResolvePackageFromWorkspace =
    defaultResolvePackageFromWorkspace,
): Promise<BuilderOutput> => {
  const {
    delegateBuilder,
    inspectorSourceMetadata,
    delegateOptions,
  } = stripInspectorBuilderOptions(options);
  const resolvedDelegateBuilder =
    delegateBuilder ??
    resolveDefaultDelegateBuilder(
      builderKind,
      context.workspaceRoot,
      resolvePackageFromWorkspace,
    );

  if (resolvedDelegateBuilder === undefined) {
    context.logger?.warn?.(buildMissingDelegateBuilderMessage(builderKind));

    return {
      success: false,
      error: buildMissingDelegateBuilderMessage(builderKind),
    };
  }

  maybeLogSourceMetadataScaffoldMessage(
    builderKind,
    context,
    inspectorSourceMetadata,
  );

  const builderRun = await context.scheduleBuilder(
    resolvedDelegateBuilder,
    delegateOptions,
  );

  try {
    return await builderRun.result;
  } finally {
    await builderRun.stop?.();
  }
};

export const createPassThroughAngularBuilderHandler =
  (builderKind: AngularInspectorBuilderKind) =>
  async (
    options: AngularInspectorBuilderOptions,
    context: BuilderContext,
  ): Promise<BuilderOutput> => {
    return runDelegatedAngularBuilder(builderKind, options, context);
  };
