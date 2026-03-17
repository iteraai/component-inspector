import type { TreeNodeSource } from '@iteraai/inspector-protocol';

const INSPECTOR_SOURCE_ATTRIBUTE = 'data-inspector-source';
const INSPECTOR_SOURCE_FILE_ATTRIBUTE = 'data-inspector-source-file';
const INSPECTOR_SOURCE_LINE_ATTRIBUTE = 'data-inspector-source-line';
const INSPECTOR_SOURCE_COLUMN_ATTRIBUTE = 'data-inspector-source-column';
const SOURCE_LOCATION_PATTERN = /^(.*?):(\d+)(?::(\d+))?$/;

type RawSourceMetadata = {
  file?: unknown;
  line?: unknown;
  column?: unknown;
};

const isRecord = (value: unknown): value is Record<string, unknown> => {
  return typeof value === 'object' && value !== null;
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

const toSourceFromLocationString = (value: string) => {
  const locationMatch = value.trim().match(SOURCE_LOCATION_PATTERN);

  if (locationMatch === null) {
    return undefined;
  }

  const [, file, line, column] = locationMatch;

  return normalizeTreeNodeSource({
    file,
    line,
    ...(column !== undefined && {
      column,
    }),
  });
};

const toSourceFromSourceAttribute = (sourceValue: string) => {
  const trimmedValue = sourceValue.trim();

  if (trimmedValue.length === 0) {
    return undefined;
  }

  if (trimmedValue.startsWith('{')) {
    try {
      const parsedValue = JSON.parse(trimmedValue) as unknown;

      return normalizeTreeNodeSource(parsedValue);
    } catch {
      return undefined;
    }
  }

  return toSourceFromLocationString(trimmedValue);
};

export const normalizeTreeNodeSource = (
  value: unknown,
): TreeNodeSource | undefined => {
  if (!isRecord(value)) {
    return undefined;
  }

  const source = value as RawSourceMetadata;
  const file = toNormalizedFile(source.file);
  const line = toNormalizedPositiveInteger(source.line);

  if (file === undefined || line === undefined) {
    return undefined;
  }

  const normalizedColumn = toNormalizedPositiveInteger(source.column);

  return normalizedColumn === undefined
    ? {
        file,
        line,
      }
    : {
        file,
        line,
        column: normalizedColumn,
      };
};

export const getNormalizedTreeNodeSourceFromElement = (
  element: Element,
): TreeNodeSource | undefined => {
  const sourceAttribute = element.getAttribute(INSPECTOR_SOURCE_ATTRIBUTE);

  if (sourceAttribute !== null) {
    const sourceFromAttribute = toSourceFromSourceAttribute(sourceAttribute);

    if (sourceFromAttribute !== undefined) {
      return sourceFromAttribute;
    }
  }

  const sourceFile = element.getAttribute(INSPECTOR_SOURCE_FILE_ATTRIBUTE);
  const sourceLine = element.getAttribute(INSPECTOR_SOURCE_LINE_ATTRIBUTE);
  const sourceColumn = element.getAttribute(INSPECTOR_SOURCE_COLUMN_ATTRIBUTE);

  if (sourceFile === null && sourceLine === null && sourceColumn === null) {
    return undefined;
  }

  return normalizeTreeNodeSource({
    ...(sourceFile !== null && {
      file: sourceFile,
    }),
    ...(sourceLine !== null && {
      line: sourceLine,
    }),
    ...(sourceColumn !== null && {
      column: sourceColumn,
    }),
  });
};
