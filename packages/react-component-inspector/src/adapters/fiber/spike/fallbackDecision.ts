import type { DevtoolsProbeResult } from './types';

export const FIBER_FALLBACK_ACTION = 'fallback-to-tag-adapter';

export type FiberUnsupportedState =
  | 'hook-missing'
  | 'renderer-empty'
  | 'root-missing'
  | 'traversal-failed';

export type FiberFallbackAction = typeof FIBER_FALLBACK_ACTION;

export type FiberDecisionDiagnostics = Readonly<{
  source: 'fiber-spike';
  probeStatus: DevtoolsProbeResult['status'] | 'unavailable';
  probeReason: string;
  rendererId?: number;
  details?: unknown;
  unsupportedState?: FiberUnsupportedState;
}>;

export type FiberFallbackDecision = Readonly<
  | {
      outcome: 'continue-fiber';
      diagnostics: FiberDecisionDiagnostics;
    }
  | {
      outcome: 'fallback';
      unsupportedState: FiberUnsupportedState;
      action: FiberFallbackAction;
      diagnostics: FiberDecisionDiagnostics;
    }
>;

export type FiberFallbackInput = Readonly<{
  probeResult?: unknown;
  traversalError?: unknown;
}>;

type ProbeSummary = Readonly<{
  status: DevtoolsProbeResult['status'] | 'unavailable';
  reason: string;
  rendererId?: number;
  details?: unknown;
}>;

const isRecord = (value: unknown): value is Record<string, unknown> => {
  return typeof value === 'object' && value !== null;
};

const hasOwn = (value: Record<string, unknown>, key: string) => {
  return Object.prototype.hasOwnProperty.call(value, key);
};

const toRendererId = (value: unknown): number | undefined => {
  if (typeof value !== 'number' || !Number.isInteger(value)) {
    return undefined;
  }

  return value;
};

const isRendererRefShape = (value: unknown): value is Record<string, unknown> => {
  if (!isRecord(value)) {
    return false;
  }

  return toRendererId(value.rendererId) !== undefined && hasOwn(value, 'renderer');
};

const isFiberRootRefShape = (value: unknown): value is Record<string, unknown> => {
  if (!isRecord(value)) {
    return false;
  }

  return (
    toRendererId(value.rendererId) !== undefined &&
    hasOwn(value, 'root') &&
    value.root !== undefined
  );
};

const hasConsistentRootRendererIds = (
  renderers: Record<string, unknown>[],
  roots: Record<string, unknown>[],
) => {
  const rendererIds = new Set<number>();

  renderers.forEach((rendererRef) => {
    const rendererId = toRendererId(rendererRef.rendererId);

    if (rendererId !== undefined) {
      rendererIds.add(rendererId);
    }
  });

  return roots.every((rootRef) => {
    const rendererId = toRendererId(rootRef.rendererId);

    return rendererId !== undefined && rendererIds.has(rendererId);
  });
};

const hasOkProbeShape = (probeResult: Record<string, unknown>) => {
  if (!Array.isArray(probeResult.renderers) || !Array.isArray(probeResult.roots)) {
    return false;
  }

  if (probeResult.renderers.length === 0 || probeResult.roots.length === 0) {
    return false;
  }

  if (!probeResult.renderers.every(isRendererRefShape)) {
    return false;
  }

  if (!probeResult.roots.every(isFiberRootRefShape)) {
    return false;
  }

  return hasConsistentRootRendererIds(
    probeResult.renderers,
    probeResult.roots,
  );
};

const toProbeStatus = (
  value: unknown,
): DevtoolsProbeResult['status'] | undefined => {
  if (
    value === 'ok' ||
    value === 'unsupported' ||
    value === 'empty' ||
    value === 'error'
  ) {
    return value;
  }

  return undefined;
};

const toProbeSummary = (probeResult: unknown): ProbeSummary => {
  if (!isRecord(probeResult)) {
    return {
      status: 'unavailable',
      reason: 'probe-result-unavailable',
    };
  }

  const probeStatus = toProbeStatus(probeResult.status);

  if (probeStatus === undefined) {
    return {
      status: 'unavailable',
      reason: 'probe-status-unavailable',
    };
  }

  if (probeStatus === 'ok' && !hasOkProbeShape(probeResult)) {
    return {
      status: 'unavailable',
      reason: 'ok-shape-unavailable',
    };
  }

  const probeReason =
    typeof probeResult.reason === 'string'
      ? probeResult.reason
      : `${probeStatus}-reason-unavailable`;
  const rendererId =
    typeof probeResult.rendererId === 'number' ? probeResult.rendererId : undefined;

  return {
    status: probeStatus,
    reason: probeReason,
    rendererId,
    details: probeResult.details,
  };
};

const HOOK_LEVEL_UNSUPPORTED_REASONS = new Set([
  'hook-missing',
  'hook-malformed',
  'renderers-malformed',
]);

const ROOT_LEVEL_UNSUPPORTED_REASONS = new Set([
  'fiber-roots-reader-missing',
  'fiber-roots-malformed',
]);

const classifyUnsupportedState = (
  probeSummary: ProbeSummary,
  traversalFailed: boolean,
): FiberUnsupportedState | undefined => {
  if (traversalFailed) {
    return 'traversal-failed';
  }

  if (probeSummary.status === 'ok') {
    return undefined;
  }

  if (
    probeSummary.status === 'unsupported' &&
    HOOK_LEVEL_UNSUPPORTED_REASONS.has(probeSummary.reason)
  ) {
    return 'hook-missing';
  }

  if (
    probeSummary.status === 'unsupported' &&
    ROOT_LEVEL_UNSUPPORTED_REASONS.has(probeSummary.reason)
  ) {
    return 'root-missing';
  }

  if (probeSummary.status === 'unsupported') {
    return 'hook-missing';
  }

  if (
    probeSummary.status === 'empty' &&
    probeSummary.reason === 'renderer-empty'
  ) {
    return 'renderer-empty';
  }

  if (probeSummary.status === 'empty' && probeSummary.reason === 'root-empty') {
    return 'root-missing';
  }

  if (probeSummary.status === 'empty') {
    return 'hook-missing';
  }

  if (probeSummary.status === 'unavailable') {
    return 'hook-missing';
  }

  return 'traversal-failed';
};

const toDiagnostics = (
  probeSummary: ProbeSummary,
  unsupportedState: FiberUnsupportedState | undefined,
  traversalError: unknown,
): FiberDecisionDiagnostics => {
  return {
    source: 'fiber-spike',
    probeStatus: probeSummary.status,
    probeReason: probeSummary.reason,
    rendererId: probeSummary.rendererId,
    details: traversalError ?? probeSummary.details,
    unsupportedState,
  };
};

const hasTraversalErrorField = (
  input: unknown,
): input is FiberFallbackInput & Required<Pick<FiberFallbackInput, 'traversalError'>> => {
  if (!isRecord(input)) {
    return false;
  }

  return Object.prototype.hasOwnProperty.call(input, 'traversalError');
};

const toSafeInput = (input: unknown): FiberFallbackInput => {
  if (!isRecord(input)) {
    return {};
  }

  return input as FiberFallbackInput;
};

export const decideFiberFallback = (
  input: FiberFallbackInput = {},
): FiberFallbackDecision => {
  try {
    const safeInput = toSafeInput(input);
    const probeSummary = toProbeSummary(safeInput.probeResult);
    const traversalFailed = hasTraversalErrorField(safeInput);
    const traversalError = traversalFailed ? safeInput.traversalError : undefined;
    const unsupportedState = classifyUnsupportedState(
      probeSummary,
      traversalFailed,
    );
    const diagnostics = toDiagnostics(probeSummary, unsupportedState, traversalError);

    if (unsupportedState === undefined) {
      return {
        outcome: 'continue-fiber',
        diagnostics,
      };
    }

    return {
      outcome: 'fallback',
      unsupportedState,
      action: FIBER_FALLBACK_ACTION,
      diagnostics,
    };
  } catch (error: unknown) {
    return {
      outcome: 'fallback',
      unsupportedState: 'hook-missing',
      action: FIBER_FALLBACK_ACTION,
      diagnostics: {
        source: 'fiber-spike',
        probeStatus: 'unavailable',
        probeReason: 'decision-failed',
        details: error,
        unsupportedState: 'hook-missing',
      },
    };
  }
};
