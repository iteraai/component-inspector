import type { FiberNodeLookupPayload } from './nodeLookup';

type FiberLike = Record<string, unknown>;

const hostComponentTag = 5;

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

const toFiberTag = (fiber: FiberLike): number | undefined => {
  const tag = readRecordValue(fiber, 'tag');

  if (typeof tag !== 'number' || !Number.isInteger(tag)) {
    return undefined;
  }

  return tag;
};

const toElement = (value: unknown): Element | undefined => {
  if (typeof Element === 'undefined') {
    return undefined;
  }

  if (!(value instanceof Element)) {
    return undefined;
  }

  return value;
};

const readHostFiberElement = (fiber: FiberLike): Element | undefined => {
  if (toFiberTag(fiber) !== hostComponentTag) {
    return undefined;
  }

  return toElement(readRecordValue(fiber, 'stateNode'));
};

const readChildFiber = (fiber: FiberLike): FiberLike | undefined => {
  return toFiber(readRecordValue(fiber, 'child'));
};

const readSiblingFiber = (fiber: FiberLike): FiberLike | undefined => {
  return toFiber(readRecordValue(fiber, 'sibling'));
};

const findFirstHostDescendantElement = (
  entryFiber: FiberLike,
): Element | undefined => {
  const firstChildFiber = readChildFiber(entryFiber);

  if (firstChildFiber === undefined) {
    return undefined;
  }

  const stack: FiberLike[] = [firstChildFiber];
  const visitedFibers = new Set<unknown>();

  while (stack.length > 0) {
    const currentFiber = stack.pop();

    if (currentFiber === undefined || visitedFibers.has(currentFiber)) {
      continue;
    }

    visitedFibers.add(currentFiber);

    const currentElement = readHostFiberElement(currentFiber);

    if (currentElement !== undefined) {
      return currentElement;
    }

    const siblingFiber = readSiblingFiber(currentFiber);

    if (siblingFiber !== undefined) {
      stack.push(siblingFiber);
    }

    const childFiber = readChildFiber(currentFiber);

    if (childFiber !== undefined) {
      stack.push(childFiber);
    }
  }

  return undefined;
};

export const resolveFiberHighlightTarget = (
  lookupPayload: FiberNodeLookupPayload,
): Element | null => {
  const fiber = toFiber(lookupPayload.fiber);

  if (fiber === undefined) {
    return null;
  }

  const directHostElement = readHostFiberElement(fiber);

  if (directHostElement !== undefined) {
    return directHostElement;
  }

  return findFirstHostDescendantElement(fiber) ?? null;
};
