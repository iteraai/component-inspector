const REACT_FORWARD_REF_TYPE = Symbol.for('react.forward_ref');
const REACT_MEMO_TYPE = Symbol.for('react.memo');

type FiberLike = Record<string, unknown> & {
  type?: unknown;
};

type FiberTypeLike = Record<string, unknown> & {
  $$typeof?: unknown;
  displayName?: unknown;
  name?: unknown;
  render?: unknown;
  type?: unknown;
};

const isRecord = (value: unknown): value is Record<string, unknown> => {
  return typeof value === 'object' && value !== null;
};

const toNonEmptyString = (value: unknown) => {
  if (typeof value !== 'string') {
    return undefined;
  }

  const normalized = value.trim();

  if (normalized.length === 0) {
    return undefined;
  }

  return normalized;
};

const toFunctionDisplayName = (value: unknown) => {
  if (typeof value !== 'function') {
    return undefined;
  }

  return (
    toNonEmptyString((value as { displayName?: unknown }).displayName) ??
    toNonEmptyString((value as { name?: unknown }).name)
  );
};

const resolveDisplayNameFromType = (
  typeValue: unknown,
  seenTypeValues: Set<unknown>,
): string | undefined => {
  if (typeValue === undefined || typeValue === null) {
    return undefined;
  }

  if (typeof typeValue === 'string') {
    return toNonEmptyString(typeValue);
  }

  const functionDisplayName = toFunctionDisplayName(typeValue);

  if (functionDisplayName !== undefined) {
    return functionDisplayName;
  }

  if (!isRecord(typeValue)) {
    return undefined;
  }

  if (seenTypeValues.has(typeValue)) {
    return undefined;
  }

  seenTypeValues.add(typeValue);

  const fiberType = typeValue as FiberTypeLike;
  const explicitDisplayName = toNonEmptyString(fiberType.displayName);

  if (explicitDisplayName !== undefined) {
    return explicitDisplayName;
  }

  if (fiberType.$$typeof === REACT_FORWARD_REF_TYPE) {
    const renderDisplayName = toFunctionDisplayName(fiberType.render);

    if (renderDisplayName !== undefined) {
      return `ForwardRef(${renderDisplayName})`;
    }

    return 'ForwardRef';
  }

  if (fiberType.$$typeof === REACT_MEMO_TYPE) {
    const wrappedDisplayName = resolveDisplayNameFromType(
      fiberType.type,
      seenTypeValues,
    );

    if (wrappedDisplayName !== undefined) {
      return `Memo(${wrappedDisplayName})`;
    }

    return 'Memo';
  }

  return toNonEmptyString(fiberType.name);
};

export const resolveFiberDisplayName = (fiber: unknown) => {
  if (!isRecord(fiber)) {
    return 'Anonymous';
  }

  const fiberLike = fiber as FiberLike;
  const displayName = resolveDisplayNameFromType(fiberLike.type, new Set());

  if (displayName !== undefined) {
    return displayName;
  }

  return 'Anonymous';
};
