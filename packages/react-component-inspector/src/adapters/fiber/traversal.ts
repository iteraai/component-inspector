import type { FiberRootRef, RootDiscoveryResult } from './types';

const componentFiberTagSet = new Set<number>([0, 1, 2, 11, 14, 15]);

type FiberLike = Record<string, unknown>;

const MAX_ROOT_DISCOVERY_DEPTH = 8;

const ROOT_WRAPPER_KEYS = [
  '_internalRoot',
  'childRoot',
  'containerInfo',
  'current',
  'root',
  'rootNode',
  'stateNode',
];

type TraversalStackEntry = Readonly<{
  fiber: FiberLike;
  rendererId: number;
  rendererRootIndex: number;
  path: string;
  parentRecordKey: string | null;
}>;

export type FiberTraversalBudget = Readonly<{
  maxRecords: number;
  maxTraversalSteps: number;
}>;

export type FiberTraversalExhaustedBy = 'record-limit' | 'step-limit';

export type FiberTraversalMeta = Readonly<{
  truncated: boolean;
  exhaustedBy: FiberTraversalExhaustedBy | null;
  includedRecordCount: number;
  traversalStepCount: number;
  budget: FiberTraversalBudget;
}>;

export type FiberTraversalRecord = Readonly<{
  key: string;
  rendererId: number;
  rendererRootIndex: number;
  path: string;
  tag: number;
  fiber: unknown;
  parentKey: string | null;
  childKeys: string[];
}>;

export type FiberTraversalResult = Readonly<{
  records: FiberTraversalRecord[];
  rootRecordKeys: string[];
  meta?: FiberTraversalMeta;
}>;

export const DEFAULT_FIBER_TRAVERSAL_BUDGET: FiberTraversalBudget = {
  maxRecords: 2_000,
  maxTraversalSteps: 20_000,
};

const toNonNegativeInteger = (value: number, fallback: number) => {
  if (!Number.isFinite(value) || !Number.isInteger(value) || value < 0) {
    return fallback;
  }

  return value;
};

const resolveTraversalBudget = (
  budget: Partial<FiberTraversalBudget> | undefined,
): FiberTraversalBudget => {
  return {
    maxRecords: toNonNegativeInteger(
      budget?.maxRecords ?? DEFAULT_FIBER_TRAVERSAL_BUDGET.maxRecords,
      DEFAULT_FIBER_TRAVERSAL_BUDGET.maxRecords,
    ),
    maxTraversalSteps: toNonNegativeInteger(
      budget?.maxTraversalSteps ?? DEFAULT_FIBER_TRAVERSAL_BUDGET.maxTraversalSteps,
      DEFAULT_FIBER_TRAVERSAL_BUDGET.maxTraversalSteps,
    ),
  };
};

const toTraversalMeta = (
  records: FiberTraversalRecord[],
  traversalStepCount: number,
  budget: FiberTraversalBudget,
  exhaustedBy: FiberTraversalExhaustedBy | null,
): FiberTraversalMeta => {
  return {
    truncated: exhaustedBy !== null,
    exhaustedBy,
    includedRecordCount: records.length,
    traversalStepCount,
    budget,
  };
};

const createEmptyTraversalResult = (
  budget: FiberTraversalBudget = DEFAULT_FIBER_TRAVERSAL_BUDGET,
): FiberTraversalResult => {
  return {
    records: [],
    rootRecordKeys: [],
    meta: toTraversalMeta([], 0, budget, null),
  };
};

const isRecord = (value: unknown): value is Record<string, unknown> => {
  return typeof value === 'object' && value !== null;
};

const toFiber = (value: unknown): FiberLike | undefined => {
  if (!isRecord(value)) {
    return undefined;
  }

  return value;
};

const readRecordValue = (record: Record<string, unknown>, key: string) => {
  try {
    return record[key];
  } catch {
    return undefined;
  }
};

const readRecordValues = (record: Record<string, unknown>) => {
  try {
    return Object.keys(record).flatMap((key) => {
      const value = readRecordValue(record, key);

      return value === undefined ? [] : [value];
    });
  } catch {
    return [];
  }
};

const toFiberTag = (fiber: FiberLike): number | undefined => {
  const tagValue = readRecordValue(fiber, 'tag');

  if (typeof tagValue !== 'number') {
    return undefined;
  }

  if (!Number.isInteger(tagValue)) {
    return undefined;
  }

  return tagValue;
};

const hasTraversableFiberLinks = (fiber: FiberLike) => {
  return (
    readRecordValue(fiber, 'child') !== undefined ||
    readRecordValue(fiber, 'sibling') !== undefined ||
    readRecordValue(fiber, 'return') !== undefined ||
    readRecordValue(fiber, 'alternate') !== undefined
  );
};

const isFiberLike = (value: unknown): value is FiberLike => {
  if (!isRecord(value)) {
    return false;
  }

  return toFiberTag(value) !== undefined && hasTraversableFiberLinks(value);
};

const toRootFiberFromRecord = (
  value: Record<string, unknown>,
  seen: Set<unknown>,
  depth: number,
): FiberLike | undefined => {
  if (depth >= MAX_ROOT_DISCOVERY_DEPTH) {
    return undefined;
  }

  if (isFiberLike(value)) {
    return value;
  }

  if (seen.has(value)) {
    return undefined;
  }

  seen.add(value);

  for (const wrapperKey of ROOT_WRAPPER_KEYS) {
    const candidate = readRecordValue(value, wrapperKey);
    const childFiber = toRootFiberFromValue(candidate, seen, depth + 1);

    if (childFiber !== undefined) {
      return childFiber;
    }
  }

  for (const childValue of readRecordValues(value)) {
    const childFiber = toRootFiberFromValue(childValue, seen, depth + 1);

    if (childFiber !== undefined) {
      return childFiber;
    }
  }

  return undefined;
};

const isComponentFiber = (fiber: FiberLike) => {
  const tag = toFiberTag(fiber);

  return tag !== undefined && componentFiberTagSet.has(tag);
};

const toRootFiberFromValue = (
  value: unknown,
  seen: Set<unknown>,
  depth: number,
): FiberLike | undefined => {
  if (isFiberLike(value)) {
    return value;
  }

  if (!isRecord(value)) {
    return undefined;
  }

  return toRootFiberFromRecord(value, seen, depth);
};

const toRootFiber = (rootRef: FiberRootRef): FiberLike | undefined => {
  const root = toFiber(rootRef.root);

  if (root === undefined) {
    return undefined;
  }

  return toRootFiberFromValue(root, new Set(), 0);
};

const toSortedRoots = (roots: FiberRootRef[]) => {
  return roots
    .map((rootRef, sourceIndex) => {
      return {
        rootRef,
        sourceIndex,
      };
    })
    .sort((leftRoot, rightRoot) => {
      if (leftRoot.rootRef.rendererId !== rightRoot.rootRef.rendererId) {
        return leftRoot.rootRef.rendererId - rightRoot.rootRef.rendererId;
      }

      return leftRoot.sourceIndex - rightRoot.sourceIndex;
    })
    .map((entry) => entry.rootRef);
};

const toTraversalRecordKey = (entry: TraversalStackEntry) => {
  return `fiber:${entry.rendererId}:${entry.rendererRootIndex}:${entry.path}`;
};

const toChildFibers = (fiber: FiberLike) => {
  const children: FiberLike[] = [];
  const seenSiblingFibers = new Set<unknown>();
  let siblingCursor = toFiber(readRecordValue(fiber, 'child'));

  while (
    siblingCursor !== undefined &&
    !seenSiblingFibers.has(siblingCursor)
  ) {
    seenSiblingFibers.add(siblingCursor);
    children.push(siblingCursor);
    siblingCursor = toFiber(readRecordValue(siblingCursor, 'sibling'));
  }

  return children;
};

export const traverseFiberRoots = (
  roots: FiberRootRef[],
  budget?: Partial<FiberTraversalBudget>,
): FiberTraversalResult => {
  const records: FiberTraversalRecord[] = [];
  const recordsByKey = new Map<string, FiberTraversalRecord>();
  const rootRecordKeys: string[] = [];
  const seenRootRecordKeys = new Set<string>();
  const resolvedBudget = resolveTraversalBudget(budget);
  const orderedRoots = toSortedRoots(roots);
  const nextRootIndexByRenderer = new Map<number, number>();
  const visitedFibers = new Set<unknown>();
  let traversalStepCount = 0;
  let exhaustedBy: FiberTraversalExhaustedBy | null = null;

  for (const rootRef of orderedRoots) {
    if (exhaustedBy !== null) {
      break;
    }

    const rootFiber = toRootFiber(rootRef);

    if (rootFiber === undefined) {
      continue;
    }

    const rendererRootIndex =
      nextRootIndexByRenderer.get(rootRef.rendererId) ?? 0;

    nextRootIndexByRenderer.set(rootRef.rendererId, rendererRootIndex + 1);

    const stack: TraversalStackEntry[] = [
      {
        fiber: rootFiber,
        rendererId: rootRef.rendererId,
        rendererRootIndex,
        path: '0',
        parentRecordKey: null,
      },
    ];

    while (stack.length > 0) {
      if (traversalStepCount >= resolvedBudget.maxTraversalSteps) {
        exhaustedBy = 'step-limit';
        break;
      }

      if (records.length >= resolvedBudget.maxRecords) {
        exhaustedBy = 'record-limit';
        break;
      }

      const entry = stack.pop();

      traversalStepCount += 1;

      if (entry === undefined || visitedFibers.has(entry.fiber)) {
        continue;
      }

      visitedFibers.add(entry.fiber);

      let nextParentRecordKey = entry.parentRecordKey;

      if (isComponentFiber(entry.fiber)) {
        const entryTag = toFiberTag(entry.fiber);

        if (entryTag !== undefined) {
          const recordKey = toTraversalRecordKey(entry);
          const record: FiberTraversalRecord = {
            key: recordKey,
            rendererId: entry.rendererId,
            rendererRootIndex: entry.rendererRootIndex,
            path: entry.path,
            tag: entryTag,
            fiber: entry.fiber,
            parentKey: entry.parentRecordKey,
            childKeys: [],
          };

          recordsByKey.set(recordKey, record);
          records.push(record);
          nextParentRecordKey = recordKey;

          if (entry.parentRecordKey === null) {
            if (!seenRootRecordKeys.has(recordKey)) {
              seenRootRecordKeys.add(recordKey);
              rootRecordKeys.push(recordKey);
            }
          } else {
            const parentRecord = recordsByKey.get(entry.parentRecordKey);

            if (parentRecord !== undefined) {
              parentRecord.childKeys.push(recordKey);
            }
          }
        }
      }

      const childFibers = toChildFibers(entry.fiber);

      for (
        let childIndex = childFibers.length - 1;
        childIndex >= 0;
        childIndex -= 1
      ) {
        const childFiber = childFibers[childIndex];

        stack.push({
          fiber: childFiber,
          rendererId: entry.rendererId,
          rendererRootIndex: entry.rendererRootIndex,
          path: `${entry.path}.${childIndex}`,
          parentRecordKey: nextParentRecordKey,
        });
      }
    }
  }

  return {
    records,
    rootRecordKeys,
    meta: toTraversalMeta(records, traversalStepCount, resolvedBudget, exhaustedBy),
  };
};

export const traverseDiscoveredFiberRoots = (
  discoveryResult: RootDiscoveryResult,
  budget?: Partial<FiberTraversalBudget>,
): FiberTraversalResult => {
  const resolvedBudget = resolveTraversalBudget(budget);

  if (discoveryResult.status !== 'ok') {
    return createEmptyTraversalResult(resolvedBudget);
  }

  return traverseFiberRoots(discoveryResult.roots, resolvedBudget);
};
