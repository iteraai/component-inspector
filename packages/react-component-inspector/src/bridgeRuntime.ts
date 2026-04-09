import type { HostToEmbeddedMessage } from '@iteraai/inspector-protocol';
import {
  destroyInspectorBridge as destroySharedInspectorBridge,
  initInspectorBridge as initSharedInspectorBridge,
} from '../../inspector-runtime-core/src/bridgeRuntime';
import { createReactInspectorAdapter } from './adapters/base/createReactInspectorAdapter';
import type { ReactInspectorRuntimeConfig } from './adapters/base/types';
import { toInspectorTreeAdapter } from './inspectorTreeAdapter';
import type { ReactTreeAdapter } from './reactTreeAdapter';
import type { EmbeddedBridgeTelemetryHooks } from './security/bridgeTelemetry';
import type { InspectorBridgeSecurityOptions } from './security/tokenValidation';

export type InspectorBridgeMode = 'development' | 'iteration' | 'production';

export type InspectorBridgeRequestHandlers = {
  onHighlightNode?: (message: HostToEmbeddedMessage) => void;
  onClearHighlight?: (message: HostToEmbeddedMessage) => void;
};

export type InitInspectorBridgeOptions = {
  hostOrigins: readonly string[];
  enabled: boolean;
  killSwitchActive?: boolean;
  mode?: InspectorBridgeMode;
  runtimeConfig?: ReactInspectorRuntimeConfig;
  capabilities?: string[];
  treeAdapter?: ReactTreeAdapter;
  adapterFactory?: (
    runtimeConfig?: ReactInspectorRuntimeConfig,
  ) => ReactTreeAdapter | undefined;
  handlers?: InspectorBridgeRequestHandlers;
  security?: InspectorBridgeSecurityOptions;
  telemetry?: EmbeddedBridgeTelemetryHooks;
};

type InspectorBridge = {
  destroy: () => void;
};

type EmbeddedInspectorSelectionApi = {
  getComponentPathForElement?: (
    element: Element,
  ) => ReadonlyArray<string> | undefined;
  getReactComponentPathForElement?: (
    element: Element,
  ) => ReadonlyArray<string> | undefined;
};

type SharedInitInspectorBridgeOptions = Parameters<
  typeof initSharedInspectorBridge
>[0];

declare global {
  interface Window {
    __ITERA_EMBEDDED_INSPECTOR_SELECTION__?:
      | EmbeddedInspectorSelectionApi
      | undefined;
    __ITERA_EMBEDDED_REACT_INSPECTOR_SELECTION__?:
      | EmbeddedInspectorSelectionApi
      | undefined;
    __ARA_EMBEDDED_INSPECTOR_SELECTION__?:
      | EmbeddedInspectorSelectionApi
      | undefined;
    __ARA_EMBEDDED_REACT_INSPECTOR_SELECTION__?:
      | EmbeddedInspectorSelectionApi
      | undefined;
  }
}

const toSharedInitOptions = (
  options: InitInspectorBridgeOptions,
): SharedInitInspectorBridgeOptions => {
  const resolvedAdapterFactory =
    options.treeAdapter === undefined &&
    (options.adapterFactory !== undefined || options.runtimeConfig !== undefined)
      ? (runtimeConfig?: unknown) => {
          const resolvedRuntimeConfig =
            runtimeConfig as ReactInspectorRuntimeConfig | undefined;

          return (
            options.adapterFactory?.(resolvedRuntimeConfig) ??
            createReactInspectorAdapter(resolvedRuntimeConfig, {
              telemetry: options.telemetry,
            })
          );
        }
      : undefined;

  return {
    hostOrigins: options.hostOrigins,
    enabled: options.enabled,
    killSwitchActive: options.killSwitchActive,
    killSwitchWarningMessage:
      '[react-inspector-bridge] Embedded inspector bridge disabled by kill switch.',
    mode: options.mode,
    runtimeConfig: options.runtimeConfig,
    capabilities: options.capabilities,
    treeAdapter:
      options.treeAdapter === undefined
        ? undefined
        : toInspectorTreeAdapter(options.treeAdapter),
    adapterFactory:
      resolvedAdapterFactory === undefined
        ? undefined
        : (runtimeConfig?: unknown) => {
            const adapter = resolvedAdapterFactory(runtimeConfig);

            return adapter === undefined
              ? undefined
              : toInspectorTreeAdapter(adapter);
          },
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
