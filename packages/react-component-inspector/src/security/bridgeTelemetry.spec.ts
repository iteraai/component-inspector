import { given } from '#test/givenWhenThen';
import {
  EMBEDDED_BRIDGE_TELEMETRY_METRIC_NAME_FIBER_FALLBACK,
  EMBEDDED_BRIDGE_TELEMETRY_METRIC_NAME_LIFECYCLE,
  EMBEDDED_BRIDGE_TELEMETRY_METRIC_NAME_REJECTION,
  EMBEDDED_BRIDGE_TELEMETRY_SCHEMA_VERSION,
  embeddedBridgeFiberFallbackAdapterTargets,
  embeddedBridgeFiberFallbackReasonCodes,
  embeddedBridgeLifecycleStages,
  embeddedBridgeRejectionReasonCodes,
  embeddedBridgeTelemetryMetricNames,
  emitEmbeddedBridgeFiberFallbackMetric,
  emitEmbeddedBridgeLifecycleMetric,
  emitEmbeddedBridgeRejectionMetric,
  type EmbeddedBridgeFiberFallbackTelemetryMetric,
  type EmbeddedBridgeLifecycleTelemetryMetric,
  type EmbeddedBridgeRejectionTelemetryMetric,
} from './bridgeTelemetry';

type BridgeTelemetryContext = {
  onFiberFallbackMetric: ReturnType<
    typeof vi.fn<(metric: EmbeddedBridgeFiberFallbackTelemetryMetric) => void>
  >;
  onLifecycleMetric: ReturnType<
    typeof vi.fn<(metric: EmbeddedBridgeLifecycleTelemetryMetric) => void>
  >;
  onRejectionMetric: ReturnType<
    typeof vi.fn<(metric: EmbeddedBridgeRejectionTelemetryMetric) => void>
  >;
  fiberFallbackMetric?: EmbeddedBridgeFiberFallbackTelemetryMetric;
  lifecycleMetric?: EmbeddedBridgeLifecycleTelemetryMetric;
  rejectionMetric?: EmbeddedBridgeRejectionTelemetryMetric;
};

const contextCreated = (): BridgeTelemetryContext => {
  return {
    onFiberFallbackMetric:
      vi.fn<(metric: EmbeddedBridgeFiberFallbackTelemetryMetric) => void>(),
    onLifecycleMetric:
      vi.fn<(metric: EmbeddedBridgeLifecycleTelemetryMetric) => void>(),
    onRejectionMetric:
      vi.fn<(metric: EmbeddedBridgeRejectionTelemetryMetric) => void>(),
  };
};

const fiberFallbackMetricEmitted = (
  context: BridgeTelemetryContext,
): BridgeTelemetryContext => {
  context.fiberFallbackMetric = emitEmbeddedBridgeFiberFallbackMetric(
    {
      reasonCode: 'hook-missing',
      fallbackAdapterTarget: 'vite',
    },
    {
      onFiberFallbackMetric: context.onFiberFallbackMetric,
    },
  );

  return context;
};

const lifecycleMetricEmitted = (
  context: BridgeTelemetryContext,
): BridgeTelemetryContext => {
  context.lifecycleMetric = emitEmbeddedBridgeLifecycleMetric(
    {
      stage: 'ready',
      messageType: 'HELLO',
      requestId: 'request-1',
      sessionId: 'session-1',
    },
    {
      onLifecycleMetric: context.onLifecycleMetric,
    },
  );

  return context;
};

const rejectionMetricEmitted = (
  context: BridgeTelemetryContext,
): BridgeTelemetryContext => {
  context.rejectionMetric = emitEmbeddedBridgeRejectionMetric(
    {
      reasonCode: 'token-reject',
      messageType: 'HELLO',
      requestId: 'request-2',
      sessionId: 'session-2',
      errorCode: 'ERR_UNAUTHORIZED_SESSION',
    },
    {
      onRejectionMetric: context.onRejectionMetric,
    },
  );

  return context;
};

const throwingLifecycleMetricSinkConfigured = (
  context: BridgeTelemetryContext,
): BridgeTelemetryContext => {
  context.onLifecycleMetric.mockImplementation(() => {
    throw new Error('sink unavailable');
  });

  return context;
};

const rejectionMetricEmittedWithoutHooks = (
  context: BridgeTelemetryContext,
): BridgeTelemetryContext => {
  context.rejectionMetric = emitEmbeddedBridgeRejectionMetric(
    {
      reasonCode: 'oversize-reject',
      messageType: 'HELLO',
      requestId: 'request-3',
      sessionId: 'session-3',
      errorCode: 'ERR_OVERSIZE_MESSAGE',
    },
    undefined,
  );

  return context;
};

const expectTaxonomyStable = (context: BridgeTelemetryContext) => {
  expect(embeddedBridgeTelemetryMetricNames).toEqual([
    'itera.inspector.embedded.lifecycle_event_total',
    'itera.inspector.embedded.rejection_total',
    'itera.inspector.embedded.fiber_fallback_total',
  ]);
  expect(embeddedBridgeFiberFallbackReasonCodes).toEqual([
    'hook-missing',
    'hook-malformed',
    'renderers-malformed',
    'fiber-roots-reader-missing',
    'fiber-roots-malformed',
    'renderer-empty',
    'root-empty',
    'fiber-roots-read-failed',
    'probe-failed',
    'snapshot-empty',
    'snapshot-read-failed',
  ]);
  expect(embeddedBridgeFiberFallbackAdapterTargets).toEqual([
    'vite',
    'next',
    'cra',
    'noop',
  ]);
  expect(embeddedBridgeLifecycleStages).toEqual(['connect', 'ready', 'error']);
  expect(embeddedBridgeRejectionReasonCodes).toEqual([
    'origin-reject',
    'token-reject',
    'oversize-reject',
    'invalid-payload-reject',
  ]);
  expect(context.onFiberFallbackMetric).not.toHaveBeenCalled();
  expect(context.onLifecycleMetric).not.toHaveBeenCalled();
};

const expectFiberFallbackMetricShape = (context: BridgeTelemetryContext) => {
  expect(context.fiberFallbackMetric).toEqual({
    schemaVersion: EMBEDDED_BRIDGE_TELEMETRY_SCHEMA_VERSION,
    metricName: EMBEDDED_BRIDGE_TELEMETRY_METRIC_NAME_FIBER_FALLBACK,
    reasonCode: 'hook-missing',
    fallbackAdapterTarget: 'vite',
    count: 1,
  });
  expect(context.onFiberFallbackMetric).toHaveBeenCalledTimes(1);
  expect(context.onFiberFallbackMetric).toHaveBeenCalledWith(
    context.fiberFallbackMetric,
  );
};

const expectLifecycleMetricShape = (context: BridgeTelemetryContext) => {
  expect(context.lifecycleMetric).toEqual({
    schemaVersion: EMBEDDED_BRIDGE_TELEMETRY_SCHEMA_VERSION,
    metricName: EMBEDDED_BRIDGE_TELEMETRY_METRIC_NAME_LIFECYCLE,
    stage: 'ready',
    count: 1,
    messageType: 'HELLO',
    requestId: 'request-1',
    sessionId: 'session-1',
  });
  expect(context.onLifecycleMetric).toHaveBeenCalledTimes(1);
  expect(context.onLifecycleMetric).toHaveBeenCalledWith(
    context.lifecycleMetric,
  );
};

const expectRejectionMetricShape = (context: BridgeTelemetryContext) => {
  expect(context.rejectionMetric).toEqual({
    schemaVersion: EMBEDDED_BRIDGE_TELEMETRY_SCHEMA_VERSION,
    metricName: EMBEDDED_BRIDGE_TELEMETRY_METRIC_NAME_REJECTION,
    reasonCode: 'token-reject',
    count: 1,
    messageType: 'HELLO',
    requestId: 'request-2',
    sessionId: 'session-2',
    errorCode: 'ERR_UNAUTHORIZED_SESSION',
  });
  expect(context.onRejectionMetric).toHaveBeenCalledTimes(1);
  expect(context.onRejectionMetric).toHaveBeenCalledWith(
    context.rejectionMetric,
  );
};

const expectNoThrowWhenLifecycleSinkUnavailable = (
  context: BridgeTelemetryContext,
) => {
  expect(context.lifecycleMetric).toMatchObject({
    schemaVersion: EMBEDDED_BRIDGE_TELEMETRY_SCHEMA_VERSION,
    metricName: EMBEDDED_BRIDGE_TELEMETRY_METRIC_NAME_LIFECYCLE,
  });
  expect(context.onLifecycleMetric).toHaveBeenCalledTimes(1);
};

const expectNoOpWhenHooksNotConfigured = (context: BridgeTelemetryContext) => {
  expect(context.rejectionMetric).toEqual({
    schemaVersion: EMBEDDED_BRIDGE_TELEMETRY_SCHEMA_VERSION,
    metricName: EMBEDDED_BRIDGE_TELEMETRY_METRIC_NAME_REJECTION,
    reasonCode: 'oversize-reject',
    count: 1,
    messageType: 'HELLO',
    requestId: 'request-3',
    sessionId: 'session-3',
    errorCode: 'ERR_OVERSIZE_MESSAGE',
  });
  expect(context.onRejectionMetric).not.toHaveBeenCalled();
};

describe('bridgeTelemetry', () => {
  test('should keep embedded telemetry taxonomy stable', () => {
    return given(contextCreated).then(expectTaxonomyStable);
  });

  test('should emit embedded lifecycle telemetry metrics', () => {
    return given(contextCreated)
      .when(lifecycleMetricEmitted)
      .then(expectLifecycleMetricShape);
  });

  test('should emit embedded fiber fallback telemetry metrics', () => {
    return given(contextCreated)
      .when(fiberFallbackMetricEmitted)
      .then(expectFiberFallbackMetricShape);
  });

  test('should emit embedded rejection telemetry metrics', () => {
    return given(contextCreated)
      .when(rejectionMetricEmitted)
      .then(expectRejectionMetricShape);
  });

  test('should not throw when lifecycle telemetry sink fails', () => {
    return given(contextCreated)
      .when(throwingLifecycleMetricSinkConfigured)
      .when(lifecycleMetricEmitted)
      .then(expectNoThrowWhenLifecycleSinkUnavailable);
  });

  test('should keep telemetry a no-op when callbacks are not configured', () => {
    return given(contextCreated)
      .when(rejectionMetricEmittedWithoutHooks)
      .then(expectNoOpWhenHooksNotConfigured);
  });
});
