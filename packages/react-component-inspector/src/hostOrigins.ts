import { normalizeOrigin } from '@iteraai/inspector-protocol';

export type ConfiguredHostOrigins = readonly string[] | string | undefined;

const toTrimmedOrigins = (origins: readonly string[]) => {
  return origins.map((origin) => origin.trim()).filter((origin) => origin.length > 0);
};

export const resolveConfiguredHostOrigins = (
  hostOrigins: ConfiguredHostOrigins,
  defaultHostOrigins: readonly string[],
) => {
  if (Array.isArray(hostOrigins)) {
    const resolvedHostOrigins = toTrimmedOrigins(hostOrigins);

    return resolvedHostOrigins.length > 0
      ? resolvedHostOrigins
      : [...defaultHostOrigins];
  }

  if (typeof hostOrigins === 'string' && hostOrigins.length > 0) {
    const resolvedHostOrigins = toTrimmedOrigins(hostOrigins.split(','));

    return resolvedHostOrigins.length > 0
      ? resolvedHostOrigins
      : [...defaultHostOrigins];
  }

  return [...defaultHostOrigins];
};

export const resolveConcreteOrigin = (originOrUrl: string | undefined) => {
  const normalizedValue = originOrUrl?.trim();

  if (normalizedValue === undefined || normalizedValue.length === 0) {
    return undefined;
  }

  return normalizeOrigin(normalizedValue);
};

export const appendUniqueOrigin = (
  origins: readonly string[],
  origin: string | undefined,
) => {
  if (origin === undefined) {
    return [...origins];
  }

  const normalizedOrigin = resolveConcreteOrigin(origin);

  if (
    normalizedOrigin !== undefined &&
    origins.some((candidate) => resolveConcreteOrigin(candidate) === normalizedOrigin)
  ) {
    return [...origins];
  }

  return [...origins, origin];
};
