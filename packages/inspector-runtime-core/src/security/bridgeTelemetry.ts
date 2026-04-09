import type { InspectorErrorCode } from '@iteraai/inspector-protocol';

export const EMBEDDED_BRIDGE_TELEMETRY_SCHEMA_VERSION = 1 as const;

export const EMBEDDED_BRIDGE_TELEMETRY_METRIC_NAME_LIFECYCLE =
  'itera.inspector.embedded.lifecycle_event_total';
export const EMBEDDED_BRIDGE_TELEMETRY_METRIC_NAME_REJECTION =
  'itera.inspector.embedded.rejection_total';
export const EMBEDDED_BRIDGE_TELEMETRY_METRIC_NAME_FIBER_FALLBACK =
  'itera.inspector.embedded.fiber_fallback_total';

export const embeddedBridgeTelemetryMetricNames = [
  EMBEDDED_BRIDGE_TELEMETRY_METRIC_NAME_LIFECYCLE,
  EMBEDDED_BRIDGE_TELEMETRY_METRIC_NAME_REJECTION,
  EMBEDDED_BRIDGE_TELEMETRY_METRIC_NAME_FIBER_FALLBACK,
] as const;

export type EmbeddedBridgeTelemetryMetricName =
  (typeof embeddedBridgeTelemetryMetricNames)[number];

export const embeddedBridgeLifecycleStages = [
  'connect',
  'ready',
  'error',
] as const;

export type EmbeddedBridgeLifecycleStage =
  (typeof embeddedBridgeLifecycleStages)[number];

export const embeddedBridgeRejectionReasonCodes = [
  'origin-reject',
  'token-reject',
  'oversize-reject',
  'invalid-payload-reject',
] as const;

export type EmbeddedBridgeRejectionReasonCode =
  (typeof embeddedBridgeRejectionReasonCodes)[number];

export const embeddedBridgeFiberFallbackReasonCodes = [
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
] as const;

export type EmbeddedBridgeFiberFallbackReasonCode =
  (typeof embeddedBridgeFiberFallbackReasonCodes)[number];

export const embeddedBridgeFiberFallbackAdapterTargets = [
  'vite',
  'next',
  'cra',
  'noop',
] as const;

export type EmbeddedBridgeFiberFallbackAdapterTarget =
  (typeof embeddedBridgeFiberFallbackAdapterTargets)[number];

export type EmbeddedBridgeLifecycleTelemetryMetric = {
  schemaVersion: typeof EMBEDDED_BRIDGE_TELEMETRY_SCHEMA_VERSION;
  metricName: typeof EMBEDDED_BRIDGE_TELEMETRY_METRIC_NAME_LIFECYCLE;
  stage: EmbeddedBridgeLifecycleStage;
  count: 1;
  messageType?: string;
  requestId?: string;
  sessionId?: string;
  errorCode?: InspectorErrorCode;
};

export type EmbeddedBridgeRejectionTelemetryMetric = {
  schemaVersion: typeof EMBEDDED_BRIDGE_TELEMETRY_SCHEMA_VERSION;
  metricName: typeof EMBEDDED_BRIDGE_TELEMETRY_METRIC_NAME_REJECTION;
  reasonCode: EmbeddedBridgeRejectionReasonCode;
  count: 1;
  messageType?: string;
  requestId?: string;
  sessionId?: string;
  errorCode?: InspectorErrorCode;
};

export type EmbeddedBridgeFiberFallbackTelemetryMetric = {
  schemaVersion: typeof EMBEDDED_BRIDGE_TELEMETRY_SCHEMA_VERSION;
  metricName: typeof EMBEDDED_BRIDGE_TELEMETRY_METRIC_NAME_FIBER_FALLBACK;
  reasonCode: EmbeddedBridgeFiberFallbackReasonCode;
  fallbackAdapterTarget: EmbeddedBridgeFiberFallbackAdapterTarget;
  count: 1;
};

export type EmbeddedBridgeTelemetryHooks = {
  onLifecycleMetric?: (metric: EmbeddedBridgeLifecycleTelemetryMetric) => void;
  onRejectionMetric?: (metric: EmbeddedBridgeRejectionTelemetryMetric) => void;
  onFiberFallbackMetric?: (
    metric: EmbeddedBridgeFiberFallbackTelemetryMetric,
  ) => void;
};

const safeEmit = <Metric>(
  metric: Metric,
  emit: ((resolvedMetric: Metric) => void) | undefined,
) => {
  if (emit === undefined) {
    return;
  }

  try {
    emit(metric);
  } catch {
    // Telemetry failures must not affect bridge behavior.
  }
};

export const emitEmbeddedBridgeLifecycleMetric = (
  metric: Omit<
    EmbeddedBridgeLifecycleTelemetryMetric,
    'schemaVersion' | 'metricName' | 'count'
  >,
  hooks: EmbeddedBridgeTelemetryHooks | undefined,
): EmbeddedBridgeLifecycleTelemetryMetric => {
  const structuredMetric: EmbeddedBridgeLifecycleTelemetryMetric = {
    schemaVersion: EMBEDDED_BRIDGE_TELEMETRY_SCHEMA_VERSION,
    metricName: EMBEDDED_BRIDGE_TELEMETRY_METRIC_NAME_LIFECYCLE,
    count: 1,
    ...metric,
  };

  safeEmit(structuredMetric, hooks?.onLifecycleMetric);

  return structuredMetric;
};

export const emitEmbeddedBridgeRejectionMetric = (
  metric: Omit<
    EmbeddedBridgeRejectionTelemetryMetric,
    'schemaVersion' | 'metricName' | 'count'
  >,
  hooks: EmbeddedBridgeTelemetryHooks | undefined,
): EmbeddedBridgeRejectionTelemetryMetric => {
  const structuredMetric: EmbeddedBridgeRejectionTelemetryMetric = {
    schemaVersion: EMBEDDED_BRIDGE_TELEMETRY_SCHEMA_VERSION,
    metricName: EMBEDDED_BRIDGE_TELEMETRY_METRIC_NAME_REJECTION,
    count: 1,
    ...metric,
  };

  safeEmit(structuredMetric, hooks?.onRejectionMetric);

  return structuredMetric;
};

export const emitEmbeddedBridgeFiberFallbackMetric = (
  metric: Omit<
    EmbeddedBridgeFiberFallbackTelemetryMetric,
    'schemaVersion' | 'metricName' | 'count'
  >,
  hooks: EmbeddedBridgeTelemetryHooks | undefined,
): EmbeddedBridgeFiberFallbackTelemetryMetric => {
  const structuredMetric: EmbeddedBridgeFiberFallbackTelemetryMetric = {
    schemaVersion: EMBEDDED_BRIDGE_TELEMETRY_SCHEMA_VERSION,
    metricName: EMBEDDED_BRIDGE_TELEMETRY_METRIC_NAME_FIBER_FALLBACK,
    count: 1,
    ...metric,
  };

  safeEmit(structuredMetric, hooks?.onFiberFallbackMetric);

  return structuredMetric;
};
