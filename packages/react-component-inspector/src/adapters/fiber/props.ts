import type { FiberNodeLookupPayload } from './nodeLookup';

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

export const readFiberNodeProps = (
  lookupPayload: FiberNodeLookupPayload,
): unknown | undefined => {
  const fiber = toFiber(lookupPayload.fiber);

  if (fiber === undefined) {
    return undefined;
  }

  const memoizedProps = readRecordValue(fiber, 'memoizedProps');

  if (memoizedProps === undefined) {
    return undefined;
  }

  return memoizedProps;
};
