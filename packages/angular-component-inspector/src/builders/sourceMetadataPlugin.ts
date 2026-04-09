import fs from 'node:fs/promises';
import path from 'node:path';
import { createRequire } from 'node:module';
import type * as TypeScriptCompiler from 'typescript';
import {
  isSupportedAngularSourceMetadataFile,
  transformAngularComponentSourceMetadata,
} from './sourceMetadataTransform';

type TypeScriptModule = typeof TypeScriptCompiler;

type EsbuildLoader = 'ts' | 'tsx';

type EsbuildLoadArgs = Readonly<{
  path: string;
}>;

type EsbuildLoadResult = Readonly<{
  contents: string;
  loader: EsbuildLoader;
  resolveDir: string;
  watchFiles: string[];
}>;

type EsbuildPluginBuild = Readonly<{
  onLoad: (
    options: {
      filter: RegExp;
    },
    callback: (args: EsbuildLoadArgs) => Promise<EsbuildLoadResult | null>,
  ) => void;
}>;

type EsbuildPlugin = Readonly<{
  name: string;
  setup: (build: EsbuildPluginBuild) => void;
}>;

type BuilderLogger = Readonly<{
  warn?: (message: string) => void;
}>;

const ANGULAR_SOURCE_FILE_FILTER = /\.[cm]?tsx?$/;

const loadWorkspaceTypeScript = async (workspaceRoot: string) => {
  const workspaceRequire = createRequire(path.join(workspaceRoot, 'package.json'));
  const resolvedModulePath = workspaceRequire.resolve('typescript');

  return workspaceRequire(resolvedModulePath) as TypeScriptModule;
};

const toLoader = (filePath: string): EsbuildLoader => {
  return path.extname(filePath) === '.tsx' ? 'tsx' : 'ts';
};

export const createAngularInspectorSourceMetadataPlugin = (options: {
  workspaceRoot: string;
  logger?: BuilderLogger;
}): EsbuildPlugin => {
  let workspaceTypeScriptPromise: Promise<TypeScriptModule> | undefined;
  let hasLoggedTypeScriptWarning = false;

  return {
    name: 'itera-angular-source-metadata',
    setup: (build) => {
      build.onLoad({ filter: ANGULAR_SOURCE_FILE_FILTER }, async (args) => {
        if (!isSupportedAngularSourceMetadataFile(args.path)) {
          return null;
        }

        try {
          const [typeScript, contents] = await Promise.all([
            (workspaceTypeScriptPromise ??= loadWorkspaceTypeScript(
              options.workspaceRoot,
            )),
            fs.readFile(args.path, 'utf8'),
          ]);
          const transformResult = transformAngularComponentSourceMetadata({
            code: contents,
            sourceFilePath: args.path,
            workspaceRoot: options.workspaceRoot,
            typeScript,
          });

          if (!transformResult.changed) {
            return null;
          }

          return {
            contents: transformResult.code,
            loader: toLoader(args.path),
            resolveDir: path.dirname(args.path),
            watchFiles: [args.path],
          };
        } catch {
          if (!hasLoggedTypeScriptWarning) {
            hasLoggedTypeScriptWarning = true;
            options.logger?.warn?.(
              '[component-inspector/angular] Source metadata instrumentation is unavailable because TypeScript could not be loaded from the current workspace.',
            );
          }

          return null;
        }
      });
    },
  };
};
