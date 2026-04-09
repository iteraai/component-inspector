import path from 'node:path';
import ts from 'typescript';
import { defineConfig } from 'vitest/config';
import {
  isSupportedAngularSourceMetadataFile,
  transformAngularComponentSourceMetadata,
} from '../../packages/angular-component-inspector/src/builders/sourceMetadataTransform';

const workspaceRoot = __dirname;
type SourceMetadataTransformArgs = Parameters<
  typeof transformAngularComponentSourceMetadata
>[0];

const angularTestSourceMetadataPlugin = () => {
  return {
    name: 'itera-angular-test-source-metadata',
    enforce: 'pre' as const,
    transform(code: string, id: string) {
      const sourceFilePath = id.split('?')[0];

      if (
        sourceFilePath === undefined ||
        !sourceFilePath.startsWith(path.join(workspaceRoot, 'src')) ||
        !isSupportedAngularSourceMetadataFile(sourceFilePath)
      ) {
        return null;
      }

      const transformResult = transformAngularComponentSourceMetadata({
        code,
        sourceFilePath,
        workspaceRoot,
        typeScript:
          ts as unknown as SourceMetadataTransformArgs['typeScript'],
      });

      return transformResult.changed
        ? {
            code: transformResult.code,
            map: null,
          }
        : null;
    },
  };
};

export default defineConfig({
  plugins: [angularTestSourceMetadataPlugin()],
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: ['./src/testSetup.ts'],
    watch: false,
  },
});
