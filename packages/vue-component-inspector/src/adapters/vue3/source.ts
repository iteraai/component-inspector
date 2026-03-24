import type { TreeNodeSource } from '@iteraai/inspector-protocol';

const DEFAULT_BEST_EFFORT_SOURCE_LINE = 1;

const isInspectableObject = (value: unknown): value is object => {
  return (
    (typeof value === 'object' && value !== null) || typeof value === 'function'
  );
};

const readObjectValue = (value: object, key: string) => {
  try {
    return (value as Record<string, unknown>)[key];
  } catch {
    return undefined;
  }
};

const toNonEmptyString = (value: unknown) => {
  if (typeof value !== 'string') {
    return undefined;
  }

  const normalized = value.trim();

  return normalized.length > 0 ? normalized : undefined;
};

const toPositiveInteger = (value: unknown) => {
  if (typeof value === 'number') {
    return Number.isInteger(value) && value >= 1 ? value : undefined;
  }

  if (typeof value !== 'string') {
    return undefined;
  }

  const normalized = value.trim();

  if (!/^\d+$/.test(normalized)) {
    return undefined;
  }

  const parsedValue = Number(normalized);

  return Number.isInteger(parsedValue) && parsedValue >= 1
    ? parsedValue
    : undefined;
};

const toComponentType = (value: unknown) => {
  return isInspectableObject(value) ? value : undefined;
};

const toBestEffortFile = (componentType: object) => {
  const sourceRecord = toComponentType(readObjectValue(componentType, '__source'));

  return (
    toNonEmptyString(readObjectValue(componentType, '__file')) ??
    toNonEmptyString(readObjectValue(componentType, 'file')) ??
    toNonEmptyString(readObjectValue(componentType, 'fileName')) ??
    (sourceRecord === undefined
      ? undefined
      : toNonEmptyString(readObjectValue(sourceRecord, 'file')) ??
        toNonEmptyString(readObjectValue(sourceRecord, 'fileName')))
  );
};

const toBestEffortLine = (componentType: object) => {
  const sourceRecord = toComponentType(readObjectValue(componentType, '__source'));

  return (
    toPositiveInteger(readObjectValue(componentType, '__line')) ??
    toPositiveInteger(readObjectValue(componentType, 'line')) ??
    toPositiveInteger(readObjectValue(componentType, 'lineNumber')) ??
    (sourceRecord === undefined
      ? undefined
      : toPositiveInteger(readObjectValue(sourceRecord, 'line')) ??
        toPositiveInteger(readObjectValue(sourceRecord, 'lineNumber')))
  );
};

const toBestEffortColumn = (componentType: object) => {
  const sourceRecord = toComponentType(readObjectValue(componentType, '__source'));

  return (
    toPositiveInteger(readObjectValue(componentType, '__column')) ??
    toPositiveInteger(readObjectValue(componentType, 'column')) ??
    toPositiveInteger(readObjectValue(componentType, 'columnNumber')) ??
    (sourceRecord === undefined
      ? undefined
      : toPositiveInteger(readObjectValue(sourceRecord, 'column')) ??
        toPositiveInteger(readObjectValue(sourceRecord, 'columnNumber')))
  );
};

export const readVueNodeSource = (
  componentTypeValue: unknown,
): TreeNodeSource | undefined => {
  const componentType = toComponentType(componentTypeValue);

  if (componentType === undefined) {
    return undefined;
  }

  const file = toBestEffortFile(componentType);

  if (file === undefined) {
    return undefined;
  }

  const line = toBestEffortLine(componentType) ?? DEFAULT_BEST_EFFORT_SOURCE_LINE;
  const column = toBestEffortColumn(componentType);

  return column === undefined
    ? {
        file,
        line,
      }
    : {
        file,
        line,
        column,
      };
};
