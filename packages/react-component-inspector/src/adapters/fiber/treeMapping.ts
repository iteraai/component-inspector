import type { TreeNode } from '@iteraai/inspector-protocol';
import type { ReactTreeSnapshot } from '../base/baseAdapter';
import { readFiberNodeSource } from './source';
import type { FiberTraversalRecord, FiberTraversalResult } from './traversal';

const REACT_FORWARD_REF_TYPE = Symbol.for('react.forward_ref');
const REACT_MEMO_TYPE = Symbol.for('react.memo');

const FIBER_NODE_TAG = 'fiber';

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

type FiberTreeMappingOptions = Readonly<{
  traversalResult: FiberTraversalResult;
  nodeIdByRecordKey: ReadonlyMap<string, string>;
}>;

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

  const functionRecord = value as unknown as Record<string, unknown>;

  return (
    toNonEmptyString(readRecordValue(functionRecord, 'displayName')) ??
    toNonEmptyString(readRecordValue(functionRecord, 'name'))
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
  const explicitDisplayName = toNonEmptyString(
    readRecordValue(fiberType, 'displayName'),
  );
  const fiberTypeKind = readRecordValue(fiberType, '$$typeof');

  if (explicitDisplayName !== undefined) {
    return explicitDisplayName;
  }

  if (fiberTypeKind === REACT_FORWARD_REF_TYPE) {
    const renderDisplayName = toFunctionDisplayName(
      readRecordValue(fiberType, 'render'),
    );

    if (renderDisplayName !== undefined) {
      return `ForwardRef(${renderDisplayName})`;
    }

    return 'ForwardRef';
  }

  if (fiberTypeKind === REACT_MEMO_TYPE) {
    const wrappedDisplayName = resolveDisplayNameFromType(
      readRecordValue(fiberType, 'type'),
      seenTypeValues,
    );

    if (wrappedDisplayName !== undefined) {
      return `Memo(${wrappedDisplayName})`;
    }

    return 'Memo';
  }

  return toNonEmptyString(readRecordValue(fiberType, 'name'));
};

const resolveFiberDisplayName = (fiber: unknown) => {
  if (!isRecord(fiber)) {
    return 'Anonymous';
  }

  const fiberLike = fiber as FiberLike;
  const displayName = resolveDisplayNameFromType(
    readRecordValue(fiberLike, 'type'),
    new Set(),
  );

  if (displayName !== undefined) {
    return displayName;
  }

  return 'Anonymous';
};

const toFiberKindTag = (fiberTag: number) => {
  switch (fiberTag) {
    case 0:
      return 'fiber-kind:function';
    case 1:
      return 'fiber-kind:class';
    case 2:
      return 'fiber-kind:indeterminate';
    case 11:
      return 'fiber-kind:forward-ref';
    case 14:
      return 'fiber-kind:memo';
    case 15:
      return 'fiber-kind:simple-memo';
    default:
      return 'fiber-kind:unknown';
  }
};

const toFiberTags = (record: FiberTraversalRecord) => {
  return [
    FIBER_NODE_TAG,
    toFiberKindTag(record.tag),
    `fiber-tag:${record.tag}`,
  ];
};

const toIncludedRecords = (options: FiberTreeMappingOptions) => {
  const includedRecords: FiberTraversalRecord[] = [];
  const includedRecordByKey = new Map<string, FiberTraversalRecord>();
  const includedNodeIdByRecordKey = new Map<string, string>();
  const seenNodeIds = new Set<string>();

  options.traversalResult.records.forEach((record) => {
    const nodeId = options.nodeIdByRecordKey.get(record.key);

    if (
      nodeId === undefined ||
      includedRecordByKey.has(record.key) ||
      seenNodeIds.has(nodeId)
    ) {
      return;
    }

    includedRecords.push(record);
    includedRecordByKey.set(record.key, record);
    includedNodeIdByRecordKey.set(record.key, nodeId);
    seenNodeIds.add(nodeId);
  });

  return {
    includedRecords,
    includedRecordByKey,
    includedNodeIdByRecordKey,
  };
};

const toParentRecordKeyByRecordKey = (
  includedRecords: FiberTraversalRecord[],
  includedRecordByKey: ReadonlyMap<string, FiberTraversalRecord>,
) => {
  const parentRecordKeyByRecordKey = new Map<string, string | null>();

  includedRecords.forEach((record) => {
    const parentKey = record.parentKey;

    if (parentKey === null || !includedRecordByKey.has(parentKey)) {
      parentRecordKeyByRecordKey.set(record.key, null);
      return;
    }

    parentRecordKeyByRecordKey.set(record.key, parentKey);
  });

  return parentRecordKeyByRecordKey;
};

const toChildRecordKeysByParentKey = (
  includedRecords: FiberTraversalRecord[],
  includedRecordByKey: ReadonlyMap<string, FiberTraversalRecord>,
  parentRecordKeyByRecordKey: ReadonlyMap<string, string | null>,
) => {
  const childRecordKeysByParentKey = new Map<string, string[]>();

  const appendChildRecordKey = (parentKey: string, childKey: string) => {
    const existingChildren = childRecordKeysByParentKey.get(parentKey);

    if (existingChildren === undefined) {
      childRecordKeysByParentKey.set(parentKey, [childKey]);
      return;
    }

    if (!existingChildren.includes(childKey)) {
      existingChildren.push(childKey);
    }
  };

  includedRecords.forEach((record) => {
    record.childKeys.forEach((childKey) => {
      if (
        !includedRecordByKey.has(childKey) ||
        parentRecordKeyByRecordKey.get(childKey) !== record.key
      ) {
        return;
      }

      appendChildRecordKey(record.key, childKey);
    });
  });

  includedRecords.forEach((record) => {
    const parentKey = parentRecordKeyByRecordKey.get(record.key);

    if (parentKey === undefined || parentKey === null) {
      return;
    }

    appendChildRecordKey(parentKey, record.key);
  });

  return childRecordKeysByParentKey;
};

const toNodes = (
  includedRecords: FiberTraversalRecord[],
  includedNodeIdByRecordKey: ReadonlyMap<string, string>,
  parentRecordKeyByRecordKey: ReadonlyMap<string, string | null>,
  childRecordKeysByParentKey: ReadonlyMap<string, string[]>,
) => {
  return includedRecords.map((record): TreeNode => {
    const nodeId = includedNodeIdByRecordKey.get(record.key) as string;
    const parentKey = parentRecordKeyByRecordKey.get(record.key);
    const parentId =
      parentKey === undefined || parentKey === null
        ? null
        : (includedNodeIdByRecordKey.get(parentKey) ?? null);
    const childrenIds =
      childRecordKeysByParentKey.get(record.key)?.flatMap((childKey) => {
        const childId = includedNodeIdByRecordKey.get(childKey);

        return childId === undefined ? [] : [childId];
      }) ?? [];
    const source = readFiberNodeSource(record.fiber);

    return {
      id: nodeId,
      displayName: resolveFiberDisplayName(record.fiber),
      parentId,
      childrenIds,
      ...(source !== undefined && {
        source,
      }),
      tags: toFiberTags(record),
    };
  });
};

const toRootIds = (
  traversalResult: FiberTraversalResult,
  includedRecords: FiberTraversalRecord[],
  includedNodeIdByRecordKey: ReadonlyMap<string, string>,
  parentRecordKeyByRecordKey: ReadonlyMap<string, string | null>,
) => {
  const rootIds: string[] = [];
  const seenRootIds = new Set<string>();

  const appendRootId = (recordKey: string) => {
    const nodeId = includedNodeIdByRecordKey.get(recordKey);

    if (
      nodeId === undefined ||
      seenRootIds.has(nodeId) ||
      parentRecordKeyByRecordKey.get(recordKey) !== null
    ) {
      return;
    }

    seenRootIds.add(nodeId);
    rootIds.push(nodeId);
  };

  traversalResult.rootRecordKeys.forEach((rootRecordKey) => {
    appendRootId(rootRecordKey);
  });

  includedRecords.forEach((record) => {
    appendRootId(record.key);
  });

  return rootIds;
};

const toTraversalMeta = (
  traversalResult: FiberTraversalResult,
  includedNodeCount: number,
) => {
  if (traversalResult.meta?.truncated !== true) {
    return undefined;
  }

  return {
    truncated: true,
    includedNodeCount,
  };
};

export const mapFiberTraversalToTreeSnapshot = (
  options: FiberTreeMappingOptions,
): ReactTreeSnapshot => {
  const { includedRecords, includedRecordByKey, includedNodeIdByRecordKey } =
    toIncludedRecords(options);
  const parentRecordKeyByRecordKey = toParentRecordKeyByRecordKey(
    includedRecords,
    includedRecordByKey,
  );
  const childRecordKeysByParentKey = toChildRecordKeysByParentKey(
    includedRecords,
    includedRecordByKey,
    parentRecordKeyByRecordKey,
  );

  const nodes = toNodes(
    includedRecords,
    includedNodeIdByRecordKey,
    parentRecordKeyByRecordKey,
    childRecordKeysByParentKey,
  );
  const rootIds = toRootIds(
    options.traversalResult,
    includedRecords,
    includedNodeIdByRecordKey,
    parentRecordKeyByRecordKey,
  );
  const meta = toTraversalMeta(options.traversalResult, nodes.length);

  return {
    nodes,
    rootIds,
    ...(meta !== undefined && {
      meta,
    }),
  };
};
