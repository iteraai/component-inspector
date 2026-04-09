import type { TreeNodeSource } from '@iteraai/inspector-protocol';
import { ANGULAR_COMPONENT_SOURCE_METADATA_PROPERTY } from '../../sourceMetadataContract';

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

const normalizeAngularTreeNodeSource = (
  value: unknown,
): TreeNodeSource | undefined => {
  if (!isInspectableObject(value)) {
    return undefined;
  }

  const file = toNonEmptyString(
    readObjectValue(value, 'file') ?? readObjectValue(value, 'filePath'),
  );
  const line = toPositiveInteger(
    readObjectValue(value, 'line') ?? readObjectValue(value, 'lineNumber'),
  );

  if (file === undefined || line === undefined) {
    return undefined;
  }

  const column = toPositiveInteger(
    readObjectValue(value, 'column') ??
      readObjectValue(value, 'columnNumber'),
  );

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

const toSourceMetadataTargets = (value: unknown) => {
  const metadataTargets: object[] = [];
  const componentInstance = isInspectableObject(value) ? value : undefined;
  const componentType =
    componentInstance === undefined
      ? undefined
      : (() => {
          const constructorValue = readObjectValue(componentInstance, 'constructor');

          return isInspectableObject(constructorValue)
            ? constructorValue
            : undefined;
        })();

  [componentInstance, componentType].forEach((target) => {
    if (target === undefined || metadataTargets.includes(target)) {
      return;
    }

    metadataTargets.push(target);
  });

  return metadataTargets;
};

const getAngularDebugInfoMetadata = (value: object) => {
  const componentDefinition = readObjectValue(value, 'ɵcmp');

  if (!isInspectableObject(componentDefinition)) {
    return undefined;
  }

  return readObjectValue(componentDefinition, 'debugInfo');
};

export const readAngularNodeSource = (
  componentValue: unknown,
): TreeNodeSource | undefined => {
  for (const metadataTarget of toSourceMetadataTargets(componentValue)) {
    const normalizedSource = [
      readObjectValue(
        metadataTarget,
        ANGULAR_COMPONENT_SOURCE_METADATA_PROPERTY,
      ),
      getAngularDebugInfoMetadata(metadataTarget),
    ]
      .map((candidate) => normalizeAngularTreeNodeSource(candidate))
      .find((candidate) => candidate !== undefined);

    if (normalizedSource !== undefined) {
      return normalizedSource;
    }
  }

  return undefined;
};
