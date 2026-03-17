import type {
  DevtoolsProbeResult,
  DevtoolsProbeWindow,
  FiberRootRef,
  RendererRef,
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

const isReadonlySet = (value: unknown): value is ReadonlySet<unknown> => {
  if (!hasObjectTag(value, 'Set')) {
    return false;
  }

  if (!isRecord(value)) {
    return false;
  }

  return typeof value.forEach === 'function' && typeof value.values === 'function';
};

const resolveWindowRef = (windowRef?: DevtoolsProbeWindow) => {
  if (windowRef !== undefined) {
    return windowRef;
  }

  if (typeof window === 'undefined') {
    return undefined;
  }

  return window as unknown as DevtoolsProbeWindow;
};

const readDevtoolsHook = (windowRef?: DevtoolsProbeWindow) => {
  return resolveWindowRef(windowRef)?.__REACT_DEVTOOLS_GLOBAL_HOOK__;
};

const toRendererMap = (
  value: unknown,
): ReadonlyMap<unknown, unknown> | undefined => {
  if (!isReadonlyMap(value)) {
    return undefined;
  }

  return value;
};

const toRendererId = (value: unknown) => {
  if (typeof value !== 'number') {
    return undefined;
  }

  if (!Number.isInteger(value)) {
    return undefined;
  }

  return value;
};

const toRendererRefs = (rendererMap: ReadonlyMap<unknown, unknown>) => {
  const rendererRefs: RendererRef[] = [];

  rendererMap.forEach((renderer, rendererIdCandidate) => {
    const rendererId = toRendererId(rendererIdCandidate);

    if (rendererId === undefined) {
      return;
    }

    rendererRefs.push({
      rendererId,
      renderer,
    });
  });

  return rendererRefs;
};

const isRootSet = (value: unknown): value is ReadonlySet<unknown> => {
  return isReadonlySet(value);
};

export const probeDevtoolsFiberRoots = (
  windowRef?: DevtoolsProbeWindow,
): DevtoolsProbeResult => {
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
    const rendererMap = toRendererMap(hookRecord.renderers);

    if (rendererMap === undefined) {
      return {
        status: 'unsupported',
        reason: 'renderers-malformed',
      };
    }

    const rendererRefs = toRendererRefs(rendererMap);

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

        if (!isRootSet(rootsValue)) {
          return {
            status: 'unsupported',
            reason: 'fiber-roots-malformed',
          };
        }

        rootsValue.forEach((root) => {
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
