import type {
  HelloAuthPayload,
  HostToEmbeddedMessage,
  InspectorErrorCode,
} from '@iteraai/inspector-protocol';
import {
  destroyInspectorBridge as destroySharedInspectorBridge,
  initInspectorBridge as initSharedInspectorBridge,
} from '../../inspector-runtime-core/src/bridgeRuntime';
import {
  createAngularInspectorAdapter,
  type AngularInspectorAdapterContract,
  type AngularInspectorRuntimeConfig,
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

const _EMBEDDED_BRIDGE_TELEMETRY_SCHEMA_VERSION = 1 as const;

const _embeddedBridgeLifecycleStages = ['connect', 'ready', 'error'] as const;

type EmbeddedBridgeLifecycleStage =
  (typeof _embeddedBridgeLifecycleStages)[number];

const _embeddedBridgeRejectionReasonCodes = [
  'origin-reject',
  'token-reject',
  'oversize-reject',
  'invalid-payload-reject',
] as const;

type EmbeddedBridgeRejectionReasonCode =
  (typeof _embeddedBridgeRejectionReasonCodes)[number];

export type EmbeddedBridgeLifecycleTelemetryMetric = {
  schemaVersion: typeof _EMBEDDED_BRIDGE_TELEMETRY_SCHEMA_VERSION;
  metricName: 'itera.inspector.embedded.lifecycle_event_total';
  stage: EmbeddedBridgeLifecycleStage;
  count: 1;
  messageType?: string;
  requestId?: string;
  sessionId?: string;
  errorCode?: InspectorErrorCode;
};

export type EmbeddedBridgeRejectionTelemetryMetric = {
  schemaVersion: typeof _EMBEDDED_BRIDGE_TELEMETRY_SCHEMA_VERSION;
  metricName: 'itera.inspector.embedded.rejection_total';
  reasonCode: EmbeddedBridgeRejectionReasonCode;
  count: 1;
  messageType?: string;
  requestId?: string;
  sessionId?: string;
  errorCode?: InspectorErrorCode;
};

export type EmbeddedBridgeTelemetryHooks = {
  onLifecycleMetric?: (metric: EmbeddedBridgeLifecycleTelemetryMetric) => void;
  onRejectionMetric?: (metric: EmbeddedBridgeRejectionTelemetryMetric) => void;
};

export type InitInspectorBridgeOptions = {
  hostOrigins: readonly string[];
  enabled: boolean;
  killSwitchActive?: boolean;
  mode?: InspectorBridgeMode;
  runtimeConfig?: AngularInspectorRuntimeConfig;
  capabilities?: string[];
  treeAdapter?: AngularInspectorAdapterContract;
  adapterFactory?: (
    runtimeConfig?: AngularInspectorRuntimeConfig,
  ) => AngularInspectorAdapterContract | undefined;
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
            createAngularInspectorAdapter(options.runtimeConfig)
          );
        }
      : undefined;

  return {
    hostOrigins: options.hostOrigins,
    enabled: options.enabled,
    killSwitchActive: options.killSwitchActive,
    killSwitchWarningMessage:
      '[component-inspector] Embedded inspector bridge disabled by kill switch.',
    mode: options.mode,
    runtimeConfig: options.runtimeConfig,
    capabilities: options.capabilities,
    treeAdapter: options.treeAdapter,
    adapterFactory:
      resolvedAdapterFactory as SharedInitInspectorBridgeOptions['adapterFactory'],
    handlers: options.handlers,
    security: options.security,
    telemetry: options.telemetry,
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
