import type { VueNodeLookupPayload } from './nodeLookup';

type VueComponentInstanceLike = Record<string, unknown>;

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

const toComponentInstance = (
  value: unknown,
): VueComponentInstanceLike | undefined => {
  if (!isRecord(value)) {
    return undefined;
  }

  return value;
};

const toStablePlainObject = (value: unknown) => {
  if (!isRecord(value)) {
    return {};
  }

  const plainObject: Record<string, unknown> = {};

  Object.keys(value).forEach((key) => {
    try {
      plainObject[key] = value[key];
    } catch {
      plainObject[key] = undefined;
    }
  });

  return plainObject;
};

export const readVueNodeProps = (
  lookupPayload: VueNodeLookupPayload,
): Record<string, unknown> => {
  const instance = toComponentInstance(lookupPayload.instance);

  if (instance === undefined) {
    return {};
  }

  return toStablePlainObject(readRecordValue(instance, 'props'));
};
