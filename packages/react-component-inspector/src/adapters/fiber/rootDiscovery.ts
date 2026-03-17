import type {
  FiberRootRef,
  RendererRef,
  RootDiscoveryResult,
  RootDiscoveryWindow,
} from './types';

type DevtoolsHookRecord = Record<string, unknown> & {
  renderers?: unknown;
  getFiberRoots?: unknown;
};

const isRecord = (value: unknown): value is Record<string, unknown> => {
  return typeof value === 'object' && value !== null;
};

const hasObjectTag = (value: unknown, tagName: string) => {
  return Object.prototype.toString.call(value) === `[object ${tagName}]`;
};

const isReadonlyMap = (value: unknown): value is ReadonlyMap<unknown, unknown> => {
  if (!hasObjectTag(value, 'Map')) {
    return false;
  }

  if (!isRecord(value)) {
    return false;
  }

  return typeof value.forEach === 'function' && typeof value.entries === 'function';
};

const isReadonlyArray = (value: unknown): value is ReadonlyArray<unknown> => {
  return Array.isArray(value);
};

const isReadonlySet = (value: unknown): value is ReadonlySet<unknown> => {
  if (!hasObjectTag(value, 'Set')) {
    return false;
  }

  if (!isRecord(value)) {
    return false;
  }

  return typeof value.forEach === 'function' && typeof value.values === 'function';
};

const isPlainObject = (value: unknown): value is Record<string, unknown> => {
  return (
    value !== null &&
    typeof value === 'object' &&
    Object.getPrototypeOf(value) === Object.prototype
  );
};

const readRecordValue = (record: Record<string, unknown>, key: string) => {
  try {
    return record[key];
  } catch {
    return undefined;
  }
};

const readPlainObjectValues = (record: Record<string, unknown>) => {
  try {
    return Object.keys(record).flatMap((key) => {
      const value = readRecordValue(record, key);

      return value === undefined ? [] : [value];
    });
  } catch {
    return [];
  }
};

const readPlainObjectEntries = (record: Record<string, unknown>) => {
  try {
    return Object.keys(record).flatMap((key) => {
      const value = readRecordValue(record, key);

      return value === undefined ? [] : [[key, value] as const];
    });
  } catch {
    return [];
  }
};

const resolveWindowRef = (windowRef?: RootDiscoveryWindow) => {
  if (windowRef !== undefined) {
    return windowRef;
  }

  if (typeof window === 'undefined') {
    return undefined;
  }

  return window as unknown as RootDiscoveryWindow;
};

const readDevtoolsHook = (windowRef?: RootDiscoveryWindow) => {
  return resolveWindowRef(windowRef)?.__REACT_DEVTOOLS_GLOBAL_HOOK__;
};

const toRendererId = (value: unknown) => {
  if (typeof value === 'number') {
    return Number.isInteger(value) ? value : undefined;
  }

  if (typeof value !== 'string' || value.trim().length === 0) {
    return undefined;
  }

  const parsedRendererId = Number(value);

  if (!Number.isInteger(parsedRendererId)) {
    return undefined;
  }

  return parsedRendererId;
};

const toRendererEntries = (
  value: unknown,
): ReadonlyArray<readonly [number, unknown]> => {
  if (isReadonlyMap(value)) {
    return Array.from(value.entries()).flatMap(
      ([rendererIdCandidate, renderer]) => {
        const rendererId = toRendererId(rendererIdCandidate);

        if (rendererId === undefined) {
          return [];
        }

        return [[rendererId, renderer]];
      },
    );
  }

  if (!isRecord(value)) {
    return [];
  }

  return readPlainObjectEntries(value).flatMap(([rendererIdCandidate, renderer]) => {
    const rendererId = toRendererId(rendererIdCandidate);

    if (rendererId === undefined) {
      return [];
    }

    return [[rendererId, renderer]];
  });
};

const toRendererRefs = (renderers: unknown) => {
  const rendererRefs: RendererRef[] = [];

  toRendererEntries(renderers).forEach(([rendererId, renderer]) => {
    rendererRefs.push({
      rendererId,
      renderer,
    });
  });

  return rendererRefs.sort((leftRenderer, rightRenderer) => {
    return leftRenderer.rendererId - rightRenderer.rendererId;
  });
};

const isRootSet = (value: unknown): value is ReadonlySet<unknown> => {
  return isReadonlySet(value);
};

const toRoots = (value: unknown): ReadonlyArray<unknown> | undefined => {
  if (isRootSet(value)) {
    return Array.from(value);
  }

  if (isReadonlyArray(value)) {
    return value;
  }

  if (isPlainObject(value)) {
    return readPlainObjectValues(value);
  }

  return undefined;
};

export const discoverFiberRoots = (
  windowRef?: RootDiscoveryWindow,
): RootDiscoveryResult => {
  try {
    const hookValue = readDevtoolsHook(windowRef);

    if (hookValue === undefined) {
      return {
        status: 'unsupported',
        reason: 'hook-missing',
      };
    }

    if (!isRecord(hookValue)) {
      return {
        status: 'unsupported',
        reason: 'hook-malformed',
      };
    }

    const hookRecord = hookValue as DevtoolsHookRecord;

    if (hookRecord.renderers === undefined) {
      return {
        status: 'unsupported',
        reason: 'renderers-malformed',
      };
    }

    const rendererRefs = toRendererRefs(hookRecord.renderers);

    if (rendererRefs.length === 0) {
      return {
        status: 'empty',
        reason: 'renderer-empty',
        renderers: [],
      };
    }

    if (typeof hookRecord.getFiberRoots !== 'function') {
      return {
        status: 'unsupported',
        reason: 'fiber-roots-reader-missing',
      };
    }

    const fiberRootsReader = hookRecord.getFiberRoots as (
      rendererId: number,
    ) => unknown;
    const roots: FiberRootRef[] = [];

    for (const rendererRef of rendererRefs) {
      try {
        const rootsValue = fiberRootsReader.call(
          hookRecord,
          rendererRef.rendererId,
        );

        const rootsFromRenderer = toRoots(rootsValue);

        if (rootsFromRenderer === undefined) {
          return {
            status: 'unsupported',
            reason: 'fiber-roots-malformed',
          };
        }

        rootsFromRenderer.forEach((root) => {
          roots.push({
            rendererId: rendererRef.rendererId,
            root,
          });
        });
      } catch (error: unknown) {
        return {
          status: 'error',
          reason: 'fiber-roots-read-failed',
          rendererId: rendererRef.rendererId,
          details: error,
        };
      }
    }

    if (roots.length === 0) {
      return {
        status: 'empty',
        reason: 'root-empty',
        renderers: rendererRefs,
      };
    }

    return {
      status: 'ok',
      renderers: rendererRefs,
      roots,
    };
  } catch (error: unknown) {
    return {
      status: 'error',
      reason: 'probe-failed',
      details: error,
    };
  }
};
