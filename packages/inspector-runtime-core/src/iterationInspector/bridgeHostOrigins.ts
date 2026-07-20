import { normalizeOrigin } from '@iteraai/inspector-protocol';

type BridgeHostOriginRegistration = {
  hostOrigins: readonly string[];
  trustedHostOrigins: readonly string[];
};

type BridgeHostOriginConfiguration = {
  ownerConfigurations: Map<symbol, BridgeHostOriginRegistration>;
};

declare global {
  interface Window {
    __ITERA_ITERATION_INSPECTOR_BRIDGE_HOST_ORIGINS__?: BridgeHostOriginConfiguration;
  }
}

const normalizeTrustedHostOrigins = (origins: readonly string[]) => {
  const normalizedOrigins = new Set<string>();

  for (const origin of origins) {
    if (typeof origin !== 'string') {
      continue;
    }

    const normalizedOrigin = normalizeOrigin(origin.trim());

    if (
      normalizedOrigin !== undefined &&
      normalizedOrigin !== 'null' &&
      normalizedOrigin.length > 0
    ) {
      normalizedOrigins.add(normalizedOrigin);
    }
  }

  return [...normalizedOrigins];
};

const areSameTrustedHostOrigins = (
  firstOrigins: readonly string[],
  secondOrigins: readonly string[],
) => {
  return (
    firstOrigins.length === secondOrigins.length &&
    firstOrigins.every((origin) => secondOrigins.includes(origin))
  );
};

const invalidHostOriginConfiguration = Object.freeze(['']);

const toRuntimeHostOrigins = (trustedHostOrigins: readonly string[]) => {
  return trustedHostOrigins.length > 0
    ? Object.freeze([...trustedHostOrigins])
    : invalidHostOriginConfiguration;
};

export const registerIterationInspectorBridgeHostOrigins = (
  hostOrigins: readonly string[],
) => {
  if (typeof window === 'undefined') {
    return () => undefined;
  }

  const trustedHostOrigins = normalizeTrustedHostOrigins(hostOrigins);

  const existingConfiguration =
    window.__ITERA_ITERATION_INSPECTOR_BRIDGE_HOST_ORIGINS__;

  const configuration =
    existingConfiguration ??
    ({
      ownerConfigurations: new Map<symbol, BridgeHostOriginRegistration>(),
    } satisfies BridgeHostOriginConfiguration);
  const ownerToken = Symbol('iteraIterationInspectorBridgeHostOrigins');

  configuration.ownerConfigurations.set(
    ownerToken,
    {
      hostOrigins: toRuntimeHostOrigins(trustedHostOrigins),
      trustedHostOrigins: Object.freeze([...trustedHostOrigins]),
    },
  );
  window.__ITERA_ITERATION_INSPECTOR_BRIDGE_HOST_ORIGINS__ = configuration;

  return () => {
    if (!configuration.ownerConfigurations.delete(ownerToken)) {
      return;
    }

    if (
      configuration.ownerConfigurations.size === 0 &&
      window.__ITERA_ITERATION_INSPECTOR_BRIDGE_HOST_ORIGINS__ === configuration
    ) {
      delete window.__ITERA_ITERATION_INSPECTOR_BRIDGE_HOST_ORIGINS__;
    }
  };
};

const resolveBridgeHostOrigins = (
  configuration: BridgeHostOriginConfiguration | undefined,
) => {
  const registrations = [
    ...(configuration?.ownerConfigurations.values() ?? []),
  ];
  const [firstRegistration] = registrations;

  if (firstRegistration === undefined) {
    return undefined;
  }

  return registrations.every((registration) =>
    areSameTrustedHostOrigins(
      firstRegistration.trustedHostOrigins,
      registration.trustedHostOrigins,
    ),
  )
    ? firstRegistration.hostOrigins
    : null;
};

export const resolveIterationInspectorRuntimeHostOrigins = (
  explicitHostOrigins: readonly string[] | undefined,
) => {
  const bridgeHostOrigins = resolveBridgeHostOrigins(
    typeof window === 'undefined'
      ? undefined
      : window.__ITERA_ITERATION_INSPECTOR_BRIDGE_HOST_ORIGINS__,
  );

  if (bridgeHostOrigins === null) {
    return null;
  }

  if (explicitHostOrigins === undefined) {
    return bridgeHostOrigins ?? [];
  }

  const trustedHostOrigins = normalizeTrustedHostOrigins(explicitHostOrigins);

  if (
    bridgeHostOrigins !== undefined &&
    bridgeHostOrigins.length > 0 &&
    trustedHostOrigins.length > 0 &&
    !areSameTrustedHostOrigins(bridgeHostOrigins, trustedHostOrigins)
  ) {
    return null;
  }

  return toRuntimeHostOrigins(trustedHostOrigins);
};
