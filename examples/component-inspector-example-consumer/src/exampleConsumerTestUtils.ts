import { spawnSync } from 'node:child_process';
export const trustedHostOrigin = 'http://127.0.0.1:4173';

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
) => {
  const matchingCall = spy.mock.calls.find(([message]) => {
    return isRecord(message) && message.type === type;
  });

  return matchingCall?.[0];
};

export const getPostedRuntimeMessages = <TRuntimeMessage>(
  spy: ReturnType<typeof vi.spyOn>,
  isRuntimeMessage: (value: unknown) => value is TRuntimeMessage,
) => {
  return spy.mock.calls
    .map(([message]) => message)
    .filter(isRuntimeMessage);
};

export const dispatchHostMessage = (
  message: unknown,
  source: MessageEventSource | null,
) => {
  window.dispatchEvent(
    new MessageEvent('message', {
      data: message,
      origin: trustedHostOrigin,
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
