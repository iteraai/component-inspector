import type { TreeNodeSource } from '@iteraai/inspector-protocol';

type FiberLike = Record<string, unknown>;

const isRecord = (value: unknown): value is Record<string, unknown> => {
  return typeof value === 'object' && value !== null;
};

const readRecordValue = (record: Record<string, unknown>, key: string) => {
  try {
    return record[key];
  } catch {
    return undefined;
  }
};

const toFiber = (value: unknown): FiberLike | undefined => {
  if (!isRecord(value)) {
    return undefined;
  }

  return value;
};

const toDebugSource = (fiber: FiberLike) => {
  const debugSource = readRecordValue(fiber, '_debugSource');

  if (!isRecord(debugSource)) {
    return undefined;
  }

  return debugSource;
};

const toNormalizedFile = (value: unknown) => {
  if (typeof value !== 'string') {
    return undefined;
  }

  const trimmedValue = value.trim();

  if (trimmedValue.length === 0) {
    return undefined;
  }

  return trimmedValue;
};

const toNormalizedPositiveInteger = (value: unknown) => {
  if (typeof value === 'number') {
    return Number.isInteger(value) && value >= 1 ? value : undefined;
  }

  if (typeof value !== 'string') {
    return undefined;
  }

  const trimmedValue = value.trim();

  if (!/^\d+$/.test(trimmedValue)) {
    return undefined;
  }

  const parsedValue = Number(trimmedValue);

  return Number.isInteger(parsedValue) && parsedValue >= 1
    ? parsedValue
    : undefined;
};

const toBestEffortFile = (debugSource: Record<string, unknown>) => {
  return (
    toNormalizedFile(readRecordValue(debugSource, 'fileName')) ??
    toNormalizedFile(readRecordValue(debugSource, 'file'))
  );
};

const toBestEffortLine = (debugSource: Record<string, unknown>) => {
  return (
    toNormalizedPositiveInteger(readRecordValue(debugSource, 'lineNumber')) ??
    toNormalizedPositiveInteger(readRecordValue(debugSource, 'line'))
  );
};

const toBestEffortColumn = (debugSource: Record<string, unknown>) => {
  return (
    toNormalizedPositiveInteger(readRecordValue(debugSource, 'columnNumber')) ??
    toNormalizedPositiveInteger(readRecordValue(debugSource, 'column'))
  );
};

export const readFiberNodeSource = (
  fiberValue: unknown,
): TreeNodeSource | undefined => {
  const fiber = toFiber(fiberValue);

  if (fiber === undefined) {
    return undefined;
  }

  const debugSource = toDebugSource(fiber);

  if (debugSource === undefined) {
    return undefined;
  }

  const file = toBestEffortFile(debugSource);
  const line = toBestEffortLine(debugSource);

  if (file === undefined || line === undefined) {
    return undefined;
  }

  const column = toBestEffortColumn(debugSource);

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
