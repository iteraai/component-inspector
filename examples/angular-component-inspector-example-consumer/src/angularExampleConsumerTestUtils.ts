import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';

export type MessageTargetDouble = {
  postMessage: ReturnType<typeof vi.fn>;
};

export const isRecord = (value: unknown): value is Record<string, unknown> => {
  return typeof value === 'object' && value !== null;
};

export const isPreviewPathUpdatedMessage = (
  value: unknown,
): value is {
  channel: 'itera-preview-path';
  type: 'PATH_UPDATED';
  path: string;
} => {
  return (
    isRecord(value) &&
    value.channel === 'itera-preview-path' &&
    value.type === 'PATH_UPDATED' &&
    typeof value.path === 'string'
  );
};

export const getPostedProtocolMessage = (
  spy: ReturnType<typeof vi.fn>,
  type: string,
  requestId?: string,
) => {
  const matchingCall = [...spy.mock.calls]
    .reverse()
    .find(([message]) => {
      return (
        isRecord(message) &&
        message.type === type &&
        (requestId === undefined || message.requestId === requestId)
      );
    });

  return matchingCall?.[0];
};

export const getPostedRuntimeMessages = <TRuntimeMessage>(
  spy: ReturnType<typeof vi.spyOn>,
  isRuntimeMessage: (value: unknown) => value is TRuntimeMessage,
) => {
  return spy.mock.calls
    .map(([message]: [unknown]) => message)
    .filter(isRuntimeMessage);
};

export const dispatchHostMessage = (
  message: unknown,
  source: MessageEventSource | null,
  origin = 'http://127.0.0.1:4173',
) => {
  window.dispatchEvent(
    new MessageEvent('message', {
      data: message,
      origin,
      source,
    }),
  );
};

export const resolveInspectorImportPath = (specifier: string) => {
  const resolution = spawnSync(
    process.execPath,
    [
      '--input-type=module',
      '-e',
      `console.log(import.meta.resolve(${JSON.stringify(specifier)}))`,
    ],
    {
      cwd: process.cwd(),
      encoding: 'utf8',
    },
  );

  if (resolution.status !== 0) {
    throw new Error(resolution.stderr || resolution.stdout);
  }

  const resolvedSpecifier = resolution.stdout.trim();

  return resolvedSpecifier.startsWith('file://')
    ? new URL(resolvedSpecifier).pathname
    : resolvedSpecifier;
};

export const findNodeIdByDisplayName = (
  snapshot:
    | {
        nodes: Array<{
          id: string;
          displayName: string;
        }>;
      }
    | undefined,
  displayName: string,
) => {
  return snapshot?.nodes.find(
    (node) => node.displayName === displayName,
  )?.id;
};

export const readBuiltAngularBundleSources = (workspaceRoot: string) => {
  const browserDistRoot = path.join(
    workspaceRoot,
    'dist',
    'angular-component-inspector-example-consumer',
    'browser',
  );
  const bundleFilePaths = fs
    .readdirSync(browserDistRoot)
    .filter((fileName) => fileName.endsWith('.js'))
    .map((fileName) => path.join(browserDistRoot, fileName));

  return bundleFilePaths.map((filePath) => fs.readFileSync(filePath, 'utf8'));
};
