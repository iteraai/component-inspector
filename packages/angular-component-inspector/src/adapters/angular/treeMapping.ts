import type { TreeNode } from '@iteraai/inspector-protocol';
import type { InspectorTreeSnapshot } from '../base/types';
import type {
  AngularDiscoveryRecord,
  AngularDiscoveryResult,
} from './discovery';
import { readAngularNodeSource } from './source';

type AngularTreeMappingOptions = Readonly<{
  discoveryResult: AngularDiscoveryResult;
  nodeIdByRecordKey: ReadonlyMap<string, string>;
}>;

const toIncludedRecords = (options: AngularTreeMappingOptions) => {
  const includedRecords: AngularDiscoveryRecord[] = [];
  const includedRecordByKey = new Map<string, AngularDiscoveryRecord>();
  const includedNodeIdByRecordKey = new Map<string, string>();
  const seenNodeIds = new Set<string>();

  options.discoveryResult.records.forEach((record) => {
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
  includedRecords: AngularDiscoveryRecord[],
  includedRecordByKey: ReadonlyMap<string, AngularDiscoveryRecord>,
) => {
  const parentRecordKeyByRecordKey = new Map<string, string | null>();

  includedRecords.forEach((record) => {
    if (
      record.parentKey === null ||
      !includedRecordByKey.has(record.parentKey)
    ) {
      parentRecordKeyByRecordKey.set(record.key, null);
      return;
    }

    parentRecordKeyByRecordKey.set(record.key, record.parentKey);
  });

  return parentRecordKeyByRecordKey;
};

const toChildRecordKeysByParentKey = (
  includedRecords: AngularDiscoveryRecord[],
  includedRecordByKey: ReadonlyMap<string, AngularDiscoveryRecord>,
  parentRecordKeyByRecordKey: ReadonlyMap<string, string | null>,
) => {
  const childRecordKeysByParentKey = new Map<string, string[]>();

  const appendChildRecordKey = (parentKey: string, childKey: string) => {
    const existingChildKeys = childRecordKeysByParentKey.get(parentKey);

    if (existingChildKeys === undefined) {
      childRecordKeysByParentKey.set(parentKey, [childKey]);
      return;
    }

    if (!existingChildKeys.includes(childKey)) {
      existingChildKeys.push(childKey);
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
  includedRecords: AngularDiscoveryRecord[],
  includedNodeIdByRecordKey: ReadonlyMap<string, string>,
  parentRecordKeyByRecordKey: ReadonlyMap<string, string | null>,
  childRecordKeysByParentKey: ReadonlyMap<string, string[]>,
) => {
  return includedRecords.map((record): TreeNode => {
    const source = readAngularNodeSource(record.component);
    const nodeId = includedNodeIdByRecordKey.get(record.key) as string;
    const parentRecordKey = parentRecordKeyByRecordKey.get(record.key);
    const parentId =
      parentRecordKey === undefined || parentRecordKey === null
        ? null
        : (includedNodeIdByRecordKey.get(parentRecordKey) ?? null);
    const childrenIds =
      childRecordKeysByParentKey.get(record.key)?.flatMap((childKey) => {
        const childNodeId = includedNodeIdByRecordKey.get(childKey);

        return childNodeId === undefined ? [] : [childNodeId];
      }) ?? [];

    return {
      id: nodeId,
      displayName: record.displayName,
      parentId,
      childrenIds,
      ...(source !== undefined && {
        source,
      }),
      ...(record.tags.length > 0 && {
        tags: [...record.tags],
      }),
    };
  });
};

const toRootIds = (
  discoveryResult: AngularDiscoveryResult,
  includedRecords: AngularDiscoveryRecord[],
  includedNodeIdByRecordKey: ReadonlyMap<string, string>,
  parentRecordKeyByRecordKey: ReadonlyMap<string, string | null>,
) => {
  const rootIds: string[] = [];
  const seenRootIds = new Set<string>();

  const appendRootId = (recordKey: string) => {
    const rootId = includedNodeIdByRecordKey.get(recordKey);

    if (
      rootId === undefined ||
      seenRootIds.has(rootId) ||
      parentRecordKeyByRecordKey.get(recordKey) !== null
    ) {
      return;
    }

    seenRootIds.add(rootId);
    rootIds.push(rootId);
  };

  discoveryResult.rootRecordKeys.forEach((rootRecordKey) => {
    appendRootId(rootRecordKey);
  });

  includedRecords.forEach((record) => {
    appendRootId(record.key);
  });

  return rootIds;
};

export const mapAngularDiscoveryToTreeSnapshot = (
  options: AngularTreeMappingOptions,
): InspectorTreeSnapshot => {
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

  return {
    nodes: toNodes(
      includedRecords,
      includedNodeIdByRecordKey,
      parentRecordKeyByRecordKey,
      childRecordKeysByParentKey,
    ),
    rootIds: toRootIds(
      options.discoveryResult,
      includedRecords,
      includedNodeIdByRecordKey,
      parentRecordKeyByRecordKey,
    ),
  };
};
