import type {
  HelloAuthPayload,
  HostToEmbeddedMessage,
  InspectorErrorCode,
} from '@iteraai/inspector-protocol';
import {
  destroyInspectorBridge as destroySharedInspectorBridge,
  initInspectorBridge as initSharedInspectorBridge,
} from '../../react-component-inspector/src/bridgeRuntime';
import {
  createVueInspectorAdapter,
  type VueInspectorAdapterContract,
  type VueInspectorRuntimeConfig,
} from './adapters/base';

export type InspectorBridgeMode = 'development' | 'iteration' | 'production';

export type InspectorBridgeRequestHandlers = {
  onHighlightNode?: (message: HostToEmbeddedMessage) => void;
  onClearHighlight?: (message: HostToEmbeddedMessage) => void;
};

export type InspectorSessionTokenRejectionReason =
  | 'missing-auth'
  | 'invalid-token'
  | 'expired-token';

export type InspectorSessionTokenValidationResult =
  | {
      ok: true;
    }
  | {
      ok: false;
      reason: InspectorSessionTokenRejectionReason;
      message: string;
    };

export type InspectorSessionTokenValidator = (
  auth: HelloAuthPayload | undefined,
) => InspectorSessionTokenValidationResult;

export type InspectorBridgeSecurityOptions = {
  enabled: boolean;
  tokenValidator?: InspectorSessionTokenValidator;
};

export const EMBEDDED_BRIDGE_TELEMETRY_SCHEMA_VERSION = 1 as const;

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
  metricName: 'itera.inspector.embedded.lifecycle_event_total';
  stage: EmbeddedBridgeLifecycleStage;
  count: 1;
  messageType?: string;
  requestId?: string;
  sessionId?: string;
  errorCode?: InspectorErrorCode;
};

export type EmbeddedBridgeRejectionTelemetryMetric = {
  schemaVersion: typeof EMBEDDED_BRIDGE_TELEMETRY_SCHEMA_VERSION;
  metricName: 'itera.inspector.embedded.rejection_total';
  reasonCode: EmbeddedBridgeRejectionReasonCode;
  count: 1;
  messageType?: string;
  requestId?: string;
  sessionId?: string;
  errorCode?: InspectorErrorCode;
};

export type EmbeddedBridgeFiberFallbackTelemetryMetric = {
  schemaVersion: typeof EMBEDDED_BRIDGE_TELEMETRY_SCHEMA_VERSION;
  metricName: 'itera.inspector.embedded.fiber_fallback_total';
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

export type InitInspectorBridgeOptions = {
  hostOrigins: readonly string[];
  enabled: boolean;
  killSwitchActive?: boolean;
  mode?: InspectorBridgeMode;
  runtimeConfig?: VueInspectorRuntimeConfig;
  capabilities?: string[];
  treeAdapter?: VueInspectorAdapterContract;
  adapterFactory?: (
    runtimeConfig?: VueInspectorRuntimeConfig,
  ) => VueInspectorAdapterContract | undefined;
  handlers?: InspectorBridgeRequestHandlers;
  security?: InspectorBridgeSecurityOptions;
  telemetry?: EmbeddedBridgeTelemetryHooks;
};

type InspectorBridge = {
  destroy: () => void;
};

type SharedInitInspectorBridgeOptions = Parameters<
  typeof initSharedInspectorBridge
>[0];

const toSharedInitOptions = (
  options: InitInspectorBridgeOptions,
): SharedInitInspectorBridgeOptions => {
  const resolvedAdapterFactory =
    options.treeAdapter === undefined
      ? () => {
          return (
            options.adapterFactory?.(options.runtimeConfig) ??
            createVueInspectorAdapter(options.runtimeConfig)
          );
        }
      : undefined;

  return {
    hostOrigins: options.hostOrigins,
    enabled: options.enabled,
    killSwitchActive: options.killSwitchActive,
    mode: options.mode,
    runtimeConfig: undefined,
    capabilities: options.capabilities,
    treeAdapter:
      options.treeAdapter as SharedInitInspectorBridgeOptions['treeAdapter'],
    adapterFactory:
      resolvedAdapterFactory as SharedInitInspectorBridgeOptions['adapterFactory'],
    handlers:
      options.handlers as SharedInitInspectorBridgeOptions['handlers'],
    security:
      options.security as SharedInitInspectorBridgeOptions['security'],
    telemetry:
      options.telemetry as SharedInitInspectorBridgeOptions['telemetry'],
  };
};

export const initInspectorBridge = (
  options: InitInspectorBridgeOptions,
): InspectorBridge => {
  return initSharedInspectorBridge(toSharedInitOptions(options));
};

export const destroyInspectorBridge = (): void => {
  destroySharedInspectorBridge();
};
