import { given } from '#test/givenWhenThen';
import {
  FIBER_FALLBACK_ACTION,
  decideFiberFallback,
  type FiberFallbackDecision,
  type FiberFallbackInput,
} from './fallbackDecision';

type FallbackDecisionContext = {
  input: FiberFallbackInput;
  traversalError: Error;
  decision?: FiberFallbackDecision;
  repeatedDecision?: FiberFallbackDecision;
};

const contextCreated = (): FallbackDecisionContext => {
  return {
    input: {},
    traversalError: new Error('fiber traversal failed'),
  };
};

const inputConfiguredWithMissingHook = (
  context: FallbackDecisionContext,
): FallbackDecisionContext => {
  context.input = {
    probeResult: {
      status: 'unsupported',
      reason: 'hook-missing',
    },
  };

  return context;
};

const inputConfiguredWithMalformedHook = (
  context: FallbackDecisionContext,
): FallbackDecisionContext => {
  context.input = {
    probeResult: {
      status: 'unsupported',
      reason: 'hook-malformed',
    },
  };

  return context;
};

const inputConfiguredWithMalformedRenderers = (
  context: FallbackDecisionContext,
): FallbackDecisionContext => {
  context.input = {
    probeResult: {
      status: 'unsupported',
      reason: 'renderers-malformed',
    },
  };

  return context;
};

const inputConfiguredWithUnsupportedReasonUnavailable = (
  context: FallbackDecisionContext,
): FallbackDecisionContext => {
  context.input = {
    probeResult: {
      status: 'unsupported',
    },
  };

  return context;
};

const inputConfiguredWithMalformedFiberRoots = (
  context: FallbackDecisionContext,
): FallbackDecisionContext => {
  context.input = {
    probeResult: {
      status: 'unsupported',
      reason: 'fiber-roots-malformed',
    },
  };

  return context;
};

const inputConfiguredWithEmptyRendererMap = (
  context: FallbackDecisionContext,
): FallbackDecisionContext => {
  context.input = {
    probeResult: {
      status: 'empty',
      reason: 'renderer-empty',
      renderers: [],
    },
  };

  return context;
};

const inputConfiguredWithEmptyReasonUnavailable = (
  context: FallbackDecisionContext,
): FallbackDecisionContext => {
  context.input = {
    probeResult: {
      status: 'empty',
    },
  };

  return context;
};

const inputConfiguredWithMissingRoots = (
  context: FallbackDecisionContext,
): FallbackDecisionContext => {
  context.input = {
    probeResult: {
      status: 'empty',
      reason: 'root-empty',
      renderers: [],
    },
  };

  return context;
};

const inputConfiguredWithTraversalFailure = (
  context: FallbackDecisionContext,
): FallbackDecisionContext => {
  context.input = {
    probeResult: {
      status: 'ok',
      renderers: [
        {
          rendererId: 1,
          renderer: {},
        },
      ],
      roots: [
        {
          rendererId: 1,
          root: {},
        },
      ],
    },
    traversalError: context.traversalError,
  };

  return context;
};

const inputConfiguredWithUndefinedTraversalFailure = (
  context: FallbackDecisionContext,
): FallbackDecisionContext => {
  context.input = {
    probeResult: {
      status: 'ok',
      renderers: [
        {
          rendererId: 1,
          renderer: {},
        },
      ],
      roots: [
        {
          rendererId: 1,
          root: {},
        },
      ],
    },
    traversalError: undefined,
  };

  return context;
};

const inputConfiguredWithMalformedProbe = (
  context: FallbackDecisionContext,
): FallbackDecisionContext => {
  context.input = {
    probeResult: 'malformed',
  };

  return context;
};

const inputConfiguredWithNullTopLevel = (
  context: FallbackDecisionContext,
): FallbackDecisionContext => {
  context.input = null as unknown as FiberFallbackInput;

  return context;
};

const inputConfiguredWithThrowingProbeResultGetter = (
  context: FallbackDecisionContext,
): FallbackDecisionContext => {
  const getterError = new Error('probe getter failed');

  context.input = Object.defineProperty({}, 'probeResult', {
    configurable: true,
    get() {
      throw getterError;
    },
  }) as FiberFallbackInput;

  return context;
};

const inputConfiguredWithSuccessfulProbe = (
  context: FallbackDecisionContext,
): FallbackDecisionContext => {
  context.input = {
    probeResult: {
      status: 'ok',
      renderers: [
        {
          rendererId: 2,
          renderer: {},
        },
      ],
      roots: [
        {
          rendererId: 2,
          root: {},
        },
      ],
    },
  };

  return context;
};

const inputConfiguredWithMalformedOkProbe = (
  context: FallbackDecisionContext,
): FallbackDecisionContext => {
  context.input = {
    probeResult: {
      status: 'ok',
    },
  };

  return context;
};

const inputConfiguredWithMalformedOkProbeRootShape = (
  context: FallbackDecisionContext,
): FallbackDecisionContext => {
  context.input = {
    probeResult: {
      status: 'ok',
      renderers: [
        {
          rendererId: 1,
          renderer: {},
        },
      ],
      roots: [{}],
    },
  };

  return context;
};

const inputConfiguredWithMalformedOkProbeEmptyRoots = (
  context: FallbackDecisionContext,
): FallbackDecisionContext => {
  context.input = {
    probeResult: {
      status: 'ok',
      renderers: [
        {
          rendererId: 1,
          renderer: {},
        },
      ],
      roots: [],
    },
  };

  return context;
};

const inputConfiguredWithMalformedOkProbeMismatchedRendererId = (
  context: FallbackDecisionContext,
): FallbackDecisionContext => {
  context.input = {
    probeResult: {
      status: 'ok',
      renderers: [
        {
          rendererId: 1,
          renderer: {},
        },
      ],
      roots: [
        {
          rendererId: 2,
          root: {},
        },
      ],
    },
  };

  return context;
};

const decisionResolved = (
  context: FallbackDecisionContext,
): FallbackDecisionContext => {
  context.decision = decideFiberFallback(context.input);

  return context;
};

const decisionResolvedAgain = (
  context: FallbackDecisionContext,
): FallbackDecisionContext => {
  context.repeatedDecision = decideFiberFallback(context.input);

  return context;
};

const expectHookMissingFallback = (context: FallbackDecisionContext) => {
  expect(context.decision).toEqual({
    outcome: 'fallback',
    unsupportedState: 'hook-missing',
    action: FIBER_FALLBACK_ACTION,
    diagnostics: {
      source: 'fiber-spike',
      probeStatus: 'unsupported',
      probeReason: 'hook-missing',
      rendererId: undefined,
      details: undefined,
      unsupportedState: 'hook-missing',
    },
  });
};

const expectHookLevelUnsupportedFallback = (
  probeReason: 'hook-malformed' | 'renderers-malformed',
) => {
  return (context: FallbackDecisionContext) => {
    expect(context.decision).toEqual({
      outcome: 'fallback',
      unsupportedState: 'hook-missing',
      action: FIBER_FALLBACK_ACTION,
      diagnostics: {
        source: 'fiber-spike',
        probeStatus: 'unsupported',
        probeReason,
        rendererId: undefined,
        details: undefined,
        unsupportedState: 'hook-missing',
      },
    });
  };
};

const expectUnsupportedReasonUnavailableFallback = (
  context: FallbackDecisionContext,
) => {
  expect(context.decision).toEqual({
    outcome: 'fallback',
    unsupportedState: 'hook-missing',
    action: FIBER_FALLBACK_ACTION,
    diagnostics: {
      source: 'fiber-spike',
      probeStatus: 'unsupported',
      probeReason: 'unsupported-reason-unavailable',
      rendererId: undefined,
      details: undefined,
      unsupportedState: 'hook-missing',
    },
  });
};

const expectMalformedFiberRootsFallback = (
  context: FallbackDecisionContext,
) => {
  expect(context.decision).toEqual({
    outcome: 'fallback',
    unsupportedState: 'root-missing',
    action: FIBER_FALLBACK_ACTION,
    diagnostics: {
      source: 'fiber-spike',
      probeStatus: 'unsupported',
      probeReason: 'fiber-roots-malformed',
      rendererId: undefined,
      details: undefined,
      unsupportedState: 'root-missing',
    },
  });
};

const expectRendererEmptyFallback = (context: FallbackDecisionContext) => {
  expect(context.decision).toEqual({
    outcome: 'fallback',
    unsupportedState: 'renderer-empty',
    action: FIBER_FALLBACK_ACTION,
    diagnostics: {
      source: 'fiber-spike',
      probeStatus: 'empty',
      probeReason: 'renderer-empty',
      rendererId: undefined,
      details: undefined,
      unsupportedState: 'renderer-empty',
    },
  });
};

const expectEmptyReasonUnavailableFallback = (
  context: FallbackDecisionContext,
) => {
  expect(context.decision).toEqual({
    outcome: 'fallback',
    unsupportedState: 'hook-missing',
    action: FIBER_FALLBACK_ACTION,
    diagnostics: {
      source: 'fiber-spike',
      probeStatus: 'empty',
      probeReason: 'empty-reason-unavailable',
      rendererId: undefined,
      details: undefined,
      unsupportedState: 'hook-missing',
    },
  });
};

const expectRootMissingFallback = (context: FallbackDecisionContext) => {
  expect(context.decision).toEqual({
    outcome: 'fallback',
    unsupportedState: 'root-missing',
    action: FIBER_FALLBACK_ACTION,
    diagnostics: {
      source: 'fiber-spike',
      probeStatus: 'empty',
      probeReason: 'root-empty',
      rendererId: undefined,
      details: undefined,
      unsupportedState: 'root-missing',
    },
  });
};

const expectTraversalFailedFallback = (context: FallbackDecisionContext) => {
  expect(context.decision).toEqual({
    outcome: 'fallback',
    unsupportedState: 'traversal-failed',
    action: FIBER_FALLBACK_ACTION,
    diagnostics: {
      source: 'fiber-spike',
      probeStatus: 'ok',
      probeReason: 'ok-reason-unavailable',
      rendererId: undefined,
      details: context.traversalError,
      unsupportedState: 'traversal-failed',
    },
  });
};

const expectUndefinedTraversalValueFallback = (
  context: FallbackDecisionContext,
) => {
  expect(context.decision).toEqual({
    outcome: 'fallback',
    unsupportedState: 'traversal-failed',
    action: FIBER_FALLBACK_ACTION,
    diagnostics: {
      source: 'fiber-spike',
      probeStatus: 'ok',
      probeReason: 'ok-reason-unavailable',
      rendererId: undefined,
      details: undefined,
      unsupportedState: 'traversal-failed',
    },
  });
};

const expectMalformedProbeToFailSoft = (context: FallbackDecisionContext) => {
  expect(context.decision).toEqual({
    outcome: 'fallback',
    unsupportedState: 'hook-missing',
    action: FIBER_FALLBACK_ACTION,
    diagnostics: {
      source: 'fiber-spike',
      probeStatus: 'unavailable',
      probeReason: 'probe-result-unavailable',
      rendererId: undefined,
      details: undefined,
      unsupportedState: 'hook-missing',
    },
  });
};

const expectDecisionFailedFallback = (context: FallbackDecisionContext) => {
  expect(context.decision).toEqual({
    outcome: 'fallback',
    unsupportedState: 'hook-missing',
    action: FIBER_FALLBACK_ACTION,
    diagnostics: {
      source: 'fiber-spike',
      probeStatus: 'unavailable',
      probeReason: 'decision-failed',
      details: expect.any(Error),
      unsupportedState: 'hook-missing',
    },
  });
};

const expectSuccessfulProbeToContinueFiber = (
  context: FallbackDecisionContext,
) => {
  expect(context.decision).toEqual({
    outcome: 'continue-fiber',
    diagnostics: {
      source: 'fiber-spike',
      probeStatus: 'ok',
      probeReason: 'ok-reason-unavailable',
      rendererId: undefined,
      details: undefined,
      unsupportedState: undefined,
    },
  });
};

const expectMalformedOkProbeToFailSoft = (context: FallbackDecisionContext) => {
  expect(context.decision).toEqual({
    outcome: 'fallback',
    unsupportedState: 'hook-missing',
    action: FIBER_FALLBACK_ACTION,
    diagnostics: {
      source: 'fiber-spike',
      probeStatus: 'unavailable',
      probeReason: 'ok-shape-unavailable',
      rendererId: undefined,
      details: undefined,
      unsupportedState: 'hook-missing',
    },
  });
};

const expectDecisionToRemainDeterministic = (
  context: FallbackDecisionContext,
) => {
  expect(context.decision).toEqual(context.repeatedDecision);
};

describe('fallbackDecision', () => {
  test('should classify hook-missing as fallback state hook-missing', () => {
    return given(contextCreated)
      .when(inputConfiguredWithMissingHook)
      .when(decisionResolved)
      .then(expectHookMissingFallback);
  });

  test('should classify hook-malformed as fallback state hook-missing', () => {
    return given(contextCreated)
      .when(inputConfiguredWithMalformedHook)
      .when(decisionResolved)
      .then(expectHookLevelUnsupportedFallback('hook-malformed'));
  });

  test('should classify renderers-malformed as fallback state hook-missing', () => {
    return given(contextCreated)
      .when(inputConfiguredWithMalformedRenderers)
      .when(decisionResolved)
      .then(expectHookLevelUnsupportedFallback('renderers-malformed'));
  });

  test('should classify unsupported probes with missing reason as fallback state hook-missing', () => {
    return given(contextCreated)
      .when(inputConfiguredWithUnsupportedReasonUnavailable)
      .when(decisionResolved)
      .then(expectUnsupportedReasonUnavailableFallback);
  });

  test('should classify fiber-roots-malformed as fallback state root-missing', () => {
    return given(contextCreated)
      .when(inputConfiguredWithMalformedFiberRoots)
      .when(decisionResolved)
      .then(expectMalformedFiberRootsFallback);
  });

  test('should classify renderer-empty as fallback state renderer-empty', () => {
    return given(contextCreated)
      .when(inputConfiguredWithEmptyRendererMap)
      .when(decisionResolved)
      .then(expectRendererEmptyFallback);
  });

  test('should classify empty probes with missing reason as fallback state hook-missing', () => {
    return given(contextCreated)
      .when(inputConfiguredWithEmptyReasonUnavailable)
      .when(decisionResolved)
      .then(expectEmptyReasonUnavailableFallback);
  });

  test('should classify root-empty as fallback state root-missing', () => {
    return given(contextCreated)
      .when(inputConfiguredWithMissingRoots)
      .when(decisionResolved)
      .then(expectRootMissingFallback);
  });

  test('should classify traversal failure as fallback state traversal-failed', () => {
    return given(contextCreated)
      .when(inputConfiguredWithTraversalFailure)
      .when(decisionResolved)
      .then(expectTraversalFailedFallback);
  });

  test('should classify traversal as failed when traversalError field is present with undefined value', () => {
    return given(contextCreated)
      .when(inputConfiguredWithUndefinedTraversalFailure)
      .when(decisionResolved)
      .then(expectUndefinedTraversalValueFallback);
  });

  test('should fail soft without throwing for malformed probe input', () => {
    return given(contextCreated)
      .when(inputConfiguredWithMalformedProbe)
      .when(decisionResolved)
      .then(expectMalformedProbeToFailSoft);
  });

  test('should fail soft without throwing when top-level input is null', () => {
    return given(contextCreated)
      .when(inputConfiguredWithNullTopLevel)
      .when(decisionResolved)
      .then(expectMalformedProbeToFailSoft);
  });

  test('should fail soft without throwing when reading probeResult throws', () => {
    return given(contextCreated)
      .when(inputConfiguredWithThrowingProbeResultGetter)
      .when(decisionResolved)
      .then(expectDecisionFailedFallback);
  });

  test('should continue fiber path when probe status is ok and traversal has no error', () => {
    return given(contextCreated)
      .when(inputConfiguredWithSuccessfulProbe)
      .when(decisionResolved)
      .then(expectSuccessfulProbeToContinueFiber);
  });

  test('should fail soft for malformed ok probe payloads without valid roots and renderers', () => {
    return given(contextCreated)
      .when(inputConfiguredWithMalformedOkProbe)
      .when(decisionResolved)
      .then(expectMalformedOkProbeToFailSoft);
  });

  test('should fail soft for malformed ok probe payloads with invalid root entries', () => {
    return given(contextCreated)
      .when(inputConfiguredWithMalformedOkProbeRootShape)
      .when(decisionResolved)
      .then(expectMalformedOkProbeToFailSoft);
  });

  test('should fail soft for malformed ok probe payloads with empty roots', () => {
    return given(contextCreated)
      .when(inputConfiguredWithMalformedOkProbeEmptyRoots)
      .when(decisionResolved)
      .then(expectMalformedOkProbeToFailSoft);
  });

  test('should fail soft for malformed ok probe payloads with renderer id mismatches', () => {
    return given(contextCreated)
      .when(inputConfiguredWithMalformedOkProbeMismatchedRendererId)
      .when(decisionResolved)
      .then(expectMalformedOkProbeToFailSoft);
  });

  test('should return deterministic outcomes for repeated identical input', () => {
    return given(contextCreated)
      .when(inputConfiguredWithMissingRoots)
      .when(decisionResolved)
      .when(decisionResolvedAgain)
      .then(expectDecisionToRemainDeterministic);
  });
});
