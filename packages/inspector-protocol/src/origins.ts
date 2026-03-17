const toOrigin = (rawOrigin: string): string | undefined => {
  try {
    return new URL(rawOrigin).origin;
  } catch {
    return undefined;
  }
};

export const normalizeOrigin = (originOrUrl: string): string | undefined => {
  return toOrigin(originOrUrl);
};

export const deriveTargetOriginFromIframeSrc = (
  iframeSrc: string,
): string | undefined => {
  return toOrigin(iframeSrc);
};

export const isOriginTrusted = (
  origin: string,
  allowlist: readonly string[],
): boolean => {
  const normalizedOrigin = toOrigin(origin);

  if (normalizedOrigin === undefined) {
    return false;
  }

  return allowlist
    .map((item) => toOrigin(item))
    .filter((item): item is string => item !== undefined)
    .includes(normalizedOrigin);
};

export const canHostSendToTargetOrigin = (
  iframeSrc: string,
  targetOrigin: string,
): boolean => {
  const expectedTargetOrigin = deriveTargetOriginFromIframeSrc(iframeSrc);

  if (expectedTargetOrigin === undefined) {
    return false;
  }

  return expectedTargetOrigin === toOrigin(targetOrigin);
};
