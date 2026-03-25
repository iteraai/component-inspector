import type { BootstrapEmbeddedInspectorBridgeOptions } from '../embeddedBootstrap';
import { bootstrapEmbeddedInspectorBridge } from '../embeddedBootstrap';
import {
  appendUniqueOrigin,
  resolveConcreteOrigin,
  resolveConfiguredHostOrigins,
  type ConfiguredHostOrigins,
} from '../hostOrigins';

type StorybookPreviewHostOriginOptions = {
  hostOrigins?: ConfiguredHostOrigins;
  defaultHostOrigins?: readonly string[];
  managerOrigin?: string;
  referrer?: string;
};

export type ResolveStorybookPreviewHostOriginsOptions =
  StorybookPreviewHostOriginOptions;

export type BootstrapStorybookPreviewInspectorBridgeOptions = Omit<
  BootstrapEmbeddedInspectorBridgeOptions,
  'hostOrigins'
> &
  StorybookPreviewHostOriginOptions;

const readDocumentReferrer = () => {
  if (typeof document === 'undefined') {
    return undefined;
  }

  return document.referrer;
};

const resolveStorybookManagerOrigin = (
  options: ResolveStorybookPreviewHostOriginsOptions,
) => {
  const explicitManagerOrigin = resolveConcreteOrigin(options.managerOrigin);

  if (explicitManagerOrigin !== undefined) {
    return explicitManagerOrigin;
  }

  return resolveConcreteOrigin(options.referrer ?? readDocumentReferrer());
};

export const resolveStorybookPreviewHostOrigins = (
  options: ResolveStorybookPreviewHostOriginsOptions = {},
) => {
  const resolvedHostOrigins = resolveConfiguredHostOrigins(
    options.hostOrigins,
    options.defaultHostOrigins ?? [],
  );

  return appendUniqueOrigin(
    resolvedHostOrigins,
    resolveStorybookManagerOrigin(options),
  );
};

export const bootstrapStorybookPreviewInspectorBridge = (
  options: BootstrapStorybookPreviewInspectorBridgeOptions,
) => {
  return bootstrapEmbeddedInspectorBridge({
    ...options,
    hostOrigins: resolveStorybookPreviewHostOrigins(options),
  });
};
