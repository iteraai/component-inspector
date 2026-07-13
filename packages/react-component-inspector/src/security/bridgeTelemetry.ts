import type { InspectorErrorCode } from '@iteraai/inspector-protocol';
import * as shared from '../../../inspector-runtime-core/src/security/bridgeTelemetry';

export const EMBEDDED_BRIDGE_TELEMETRY_SCHEMA_VERSION: 1 =
  shared.EMBEDDED_BRIDGE_TELEMETRY_SCHEMA_VERSION;
export const EMBEDDED_BRIDGE_TELEMETRY_METRIC_NAME_LIFECYCLE =
  shared.EMBEDDED_BRIDGE_TELEMETRY_METRIC_NAME_LIFECYCLE;
export const EMBEDDED_BRIDGE_TELEMETRY_METRIC_NAME_REJECTION =
  shared.EMBEDDED_BRIDGE_TELEMETRY_METRIC_NAME_REJECTION;
export const EMBEDDED_BRIDGE_TELEMETRY_METRIC_NAME_FIBER_FALLBACK =
  shared.EMBEDDED_BRIDGE_TELEMETRY_METRIC_NAME_FIBER_FALLBACK;

export const embeddedBridgeTelemetryMetricNames: readonly [
  typeof EMBEDDED_BRIDGE_TELEMETRY_METRIC_NAME_LIFECYCLE,
  typeof EMBEDDED_BRIDGE_TELEMETRY_METRIC_NAME_REJECTION,
  typeof EMBEDDED_BRIDGE_TELEMETRY_METRIC_NAME_FIBER_FALLBACK,
] = shared.embeddedBridgeTelemetryMetricNames;
export type EmbeddedBridgeTelemetryMetricName =
  (typeof embeddedBridgeTelemetryMetricNames)[number];

export const embeddedBridgeLifecycleStages: readonly ['connect', 'ready', 'error'] =
  shared.embeddedBridgeLifecycleStages;
export type EmbeddedBridgeLifecycleStage =
  (typeof embeddedBridgeLifecycleStages)[number];

export const embeddedBridgeRejectionReasonCodes: readonly [
  'origin-reject', 'token-reject', 'oversize-reject', 'invalid-payload-reject',
] = shared.embeddedBridgeRejectionReasonCodes;
export type EmbeddedBridgeRejectionReasonCode =
  (typeof embeddedBridgeRejectionReasonCodes)[number];

export const embeddedBridgeFiberFallbackReasonCodes: readonly [
  'hook-missing', 'hook-malformed', 'renderers-malformed',
  'fiber-roots-reader-missing', 'fiber-roots-malformed', 'renderer-empty',
  'root-empty', 'fiber-roots-read-failed', 'probe-failed', 'snapshot-empty',
  'snapshot-read-failed',
] = shared.embeddedBridgeFiberFallbackReasonCodes;
export type EmbeddedBridgeFiberFallbackReasonCode =
  (typeof embeddedBridgeFiberFallbackReasonCodes)[number];

export const embeddedBridgeFiberFallbackAdapterTargets: readonly [
  'vite', 'next', 'cra', 'noop',
] = shared.embeddedBridgeFiberFallbackAdapterTargets;
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
  onFiberFallbackMetric?: (metric: EmbeddedBridgeFiberFallbackTelemetryMetric) => void;
};

export const emitEmbeddedBridgeLifecycleMetric = (
  metric: Omit<EmbeddedBridgeLifecycleTelemetryMetric, 'schemaVersion' | 'metricName' | 'count'>,
  hooks: EmbeddedBridgeTelemetryHooks | undefined,
): EmbeddedBridgeLifecycleTelemetryMetric =>
  shared.emitEmbeddedBridgeLifecycleMetric(metric, hooks);
export const emitEmbeddedBridgeRejectionMetric = (
  metric: Omit<EmbeddedBridgeRejectionTelemetryMetric, 'schemaVersion' | 'metricName' | 'count'>,
  hooks: EmbeddedBridgeTelemetryHooks | undefined,
): EmbeddedBridgeRejectionTelemetryMetric =>
  shared.emitEmbeddedBridgeRejectionMetric(metric, hooks);
export const emitEmbeddedBridgeFiberFallbackMetric = (
  metric: Omit<EmbeddedBridgeFiberFallbackTelemetryMetric, 'schemaVersion' | 'metricName' | 'count'>,
  hooks: EmbeddedBridgeTelemetryHooks | undefined,
): EmbeddedBridgeFiberFallbackTelemetryMetric =>
  shared.emitEmbeddedBridgeFiberFallbackMetric(metric, hooks);
