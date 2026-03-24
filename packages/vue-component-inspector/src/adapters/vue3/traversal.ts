import type { TreeNodeSource } from '@iteraai/inspector-protocol';
import type { App } from 'vue';
import type { VueMountedAppRecord } from '../base/types';
import { readVueNodeSource } from './source';

type VueComponentInstanceLike = object;
type VueVNodeLike = object;

type MutableVueTraversalRecord = {
  key: string;
  appRecord: VueMountedAppRecord;
  rootIndex: number;
  instance: VueComponentInstanceLike;
  parentKey: string | null;
  childKeys: string[];
  displayName: string;
  nodeKey?: string;
  source?: TreeNodeSource;
  tags: string[];
};

export type VueTraversalRecord = Readonly<MutableVueTraversalRecord>;

export type VueTraversalResult = Readonly<{
  records: VueTraversalRecord[];
  rootRecordKeys: string[];
}>;

type VueTraversalState = {
  fallbackKeyByInstanceRef: WeakMap<object, string>;
  nextFallbackKeyIndex: number;
  visitedInstances: WeakSet<object>;
  visitedVNodes: WeakSet<object>;
  records: MutableVueTraversalRecord[];
  recordByKey: Map<string, MutableVueTraversalRecord>;
  rootRecordKeys: string[];
  rootRecordKeySet: Set<string>;
};

const VUE_NODE_TAG = 'vue';

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
  return typeof value === 'number' && Number.isInteger(value) && value >= 0
    ? value
    : undefined;
};

const toNormalizedNodeKey = (value: unknown) => {
  if (
    typeof value === 'string' ||
    typeof value === 'number' ||
    typeof value === 'boolean' ||
    typeof value === 'bigint'
  ) {
    return String(value);
  }

  return undefined;
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

  if (typeof typeValue === 'function') {
    return (
      toNonEmptyString(readObjectValue(typeValue, 'displayName')) ??
      toNonEmptyString(readObjectValue(typeValue, 'name'))
    );
  }

  if (!isInspectableObject(typeValue) || seenTypeValues.has(typeValue)) {
    return undefined;
  }

  seenTypeValues.add(typeValue);

  return (
    toNonEmptyString(readObjectValue(typeValue, 'displayName')) ??
    toNonEmptyString(readObjectValue(typeValue, 'name')) ??
    toNonEmptyString(readObjectValue(typeValue, '__name')) ??
    resolveDisplayNameFromType(
      readObjectValue(typeValue, '__asyncResolved'),
      seenTypeValues,
    ) ??
    resolveDisplayNameFromType(readObjectValue(typeValue, 'type'), seenTypeValues)
  );
};

const resolveVueDisplayName = (instance: VueComponentInstanceLike) => {
  const typeValue = readObjectValue(instance, 'type');
  const vnodeTypeValue = isInspectableObject(readObjectValue(instance, 'vnode'))
    ? readObjectValue(readObjectValue(instance, 'vnode') as object, 'type')
    : undefined;

  return (
    resolveDisplayNameFromType(typeValue, new Set()) ??
    resolveDisplayNameFromType(vnodeTypeValue, new Set()) ??
    'Anonymous'
  );
};

const isKeepAliveType = (typeValue: unknown) => {
  if (!isInspectableObject(typeValue)) {
    return false;
  }

  return (
    readObjectValue(typeValue, '__isKeepAlive') === true ||
    toNonEmptyString(readObjectValue(typeValue, 'name')) === 'KeepAlive'
  );
};

const toVueTags = (instance: VueComponentInstanceLike) => {
  const typeValue = readObjectValue(instance, 'type');

  return isKeepAliveType(typeValue)
    ? [VUE_NODE_TAG, 'vue-kind:keep-alive']
    : [VUE_NODE_TAG, 'vue-kind:component'];
};

const resolveComponentNodeKey = (instance: VueComponentInstanceLike) => {
  const vnodeValue = readObjectValue(instance, 'vnode');

  if (!isInspectableObject(vnodeValue)) {
    return undefined;
  }

  return toNormalizedNodeKey(readObjectValue(vnodeValue, 'key'));
};

const resolveInstanceRecordKey = (
  state: VueTraversalState,
  instance: VueComponentInstanceLike,
  rootIndex: number,
) => {
  const uid = toPositiveInteger(readObjectValue(instance, 'uid'));

  if (uid !== undefined) {
    return `root:${rootIndex}:uid:${uid}`;
  }

  const existingFallbackKey = state.fallbackKeyByInstanceRef.get(instance);

  if (existingFallbackKey !== undefined) {
    return existingFallbackKey;
  }

  const fallbackKey = `root:${rootIndex}:fallback:${state.nextFallbackKeyIndex}`;

  state.nextFallbackKeyIndex += 1;
  state.fallbackKeyByInstanceRef.set(instance, fallbackKey);

  return fallbackKey;
};

const appendRootRecordKey = (state: VueTraversalState, rootRecordKey: string) => {
  if (state.rootRecordKeySet.has(rootRecordKey)) {
    return;
  }

  state.rootRecordKeySet.add(rootRecordKey);
  state.rootRecordKeys.push(rootRecordKey);
};

const appendChildKey = (
  record: MutableVueTraversalRecord,
  childKey: string | undefined,
) => {
  if (childKey === undefined || record.childKeys.includes(childKey)) {
    return;
  }

  record.childKeys.push(childKey);
};

const resolveRecordSource = (instance: VueComponentInstanceLike) => {
  const typeValue = readObjectValue(instance, 'type');

  return readVueNodeSource(typeValue);
};

const upsertRecord = (
  state: VueTraversalState,
  instance: VueComponentInstanceLike,
  appRecord: VueMountedAppRecord,
  rootIndex: number,
  parentKey: string | null,
) => {
  const recordKey = resolveInstanceRecordKey(state, instance, rootIndex);
  const existingRecord = state.recordByKey.get(recordKey);

  if (existingRecord !== undefined) {
    if (existingRecord.parentKey === null && parentKey !== null) {
      existingRecord.parentKey = parentKey;
    }

    if (existingRecord.nodeKey === undefined) {
      existingRecord.nodeKey = resolveComponentNodeKey(instance);
    }

    if (existingRecord.source === undefined) {
      existingRecord.source = resolveRecordSource(instance);
    }

    toVueTags(instance).forEach((tag) => {
      if (!existingRecord.tags.includes(tag)) {
        existingRecord.tags.push(tag);
      }
    });

    return existingRecord;
  }

  const record: MutableVueTraversalRecord = {
    key: recordKey,
    appRecord,
    rootIndex,
    instance,
    parentKey,
    childKeys: [],
    displayName: resolveVueDisplayName(instance),
    nodeKey: resolveComponentNodeKey(instance),
    source: resolveRecordSource(instance),
    tags: toVueTags(instance),
  };

  state.records.push(record);
  state.recordByKey.set(recordKey, record);

  return record;
};

const resolveRootInstance = (app: App) => {
  const rootInstance = readObjectValue(app as object, '_instance');

  return isInspectableObject(rootInstance) ? rootInstance : undefined;
};

const toVNode = (value: unknown) => {
  return isInspectableObject(value) ? value : undefined;
};

const toVNodeChildren = (vnode: VueVNodeLike) => {
  const childrenValue = readObjectValue(vnode, 'children');

  return Array.isArray(childrenValue)
    ? childrenValue.flatMap((child) => (toVNode(child) === undefined ? [] : [child]))
    : [];
};

const toKeepAliveCachedVNodes = (instance: VueComponentInstanceLike) => {
  const directCache = readObjectValue(instance, '__v_cache');

  if (directCache instanceof Map) {
    return [...directCache.values()].flatMap((value) =>
      toVNode(value) === undefined ? [] : [value],
    );
  }

  const contextValue = readObjectValue(instance, 'ctx');

  if (!isInspectableObject(contextValue)) {
    return [];
  }

  const contextCache = readObjectValue(contextValue, '__v_cache');

  if (!(contextCache instanceof Map)) {
    return [];
  }

  return [...contextCache.values()].flatMap((value) =>
    toVNode(value) === undefined ? [] : [value],
  );
};

const toSuspenseBranchVNodes = (vnode: VueVNodeLike) => {
  const suspenseValue = readObjectValue(vnode, 'suspense');
  const candidateBranches = isInspectableObject(suspenseValue)
    ? [
        readObjectValue(suspenseValue, 'activeBranch'),
        readObjectValue(suspenseValue, 'pendingBranch'),
      ]
    : [
        readObjectValue(vnode, 'ssContent'),
        readObjectValue(vnode, 'ssFallback'),
      ];
  const seenBranchRefs = new WeakSet<object>();
  const branchVNodes: VueVNodeLike[] = [];

  candidateBranches.forEach((branchValue) => {
    const branchVNode = toVNode(branchValue);

    if (branchVNode === undefined || seenBranchRefs.has(branchVNode)) {
      return;
    }

    seenBranchRefs.add(branchVNode);
    branchVNodes.push(branchVNode);
  });

  return branchVNodes;
};

const createTraversalState = (): VueTraversalState => {
  return {
    fallbackKeyByInstanceRef: new WeakMap<object, string>(),
    nextFallbackKeyIndex: 1,
    visitedInstances: new WeakSet<object>(),
    visitedVNodes: new WeakSet<object>(),
    records: [],
    recordByKey: new Map<string, MutableVueTraversalRecord>(),
    rootRecordKeys: [],
    rootRecordKeySet: new Set<string>(),
  };
};

const traverseVueMountedAppsInternal = (
  mountedApps: readonly VueMountedAppRecord[],
): VueTraversalResult => {
  const state = createTraversalState();

  const traverseVNode = (
    vnode: VueVNodeLike,
    parentRecord: MutableVueTraversalRecord,
    appRecord: VueMountedAppRecord,
    rootIndex: number,
  ) => {
    if (state.visitedVNodes.has(vnode)) {
      return;
    }

    state.visitedVNodes.add(vnode);

    const componentValue = readObjectValue(vnode, 'component');

    if (isInspectableObject(componentValue)) {
      const childRecord = traverseInstance(
        componentValue,
        appRecord,
        rootIndex,
        parentRecord,
      );

      appendChildKey(parentRecord, childRecord?.key);
      return;
    }

    const suspenseBranches = toSuspenseBranchVNodes(vnode);

    if (suspenseBranches.length > 0) {
      suspenseBranches.forEach((branchVNode) => {
        traverseVNode(branchVNode, parentRecord, appRecord, rootIndex);
      });
      return;
    }

    toVNodeChildren(vnode).forEach((childVNode) => {
      traverseVNode(childVNode, parentRecord, appRecord, rootIndex);
    });
  };

  const traverseInstance = (
    instance: VueComponentInstanceLike,
    appRecord: VueMountedAppRecord,
    rootIndex: number,
    parentRecord?: MutableVueTraversalRecord,
  ) => {
    const parentKey = parentRecord?.key ?? null;
    const record = upsertRecord(state, instance, appRecord, rootIndex, parentKey);

    if (parentRecord !== undefined) {
      appendChildKey(parentRecord, record.key);
    }

    if (state.visitedInstances.has(instance)) {
      return record;
    }

    state.visitedInstances.add(instance);

    const subTreeValue = readObjectValue(instance, 'subTree');
    const subTree = toVNode(subTreeValue);

    if (subTree !== undefined) {
      traverseVNode(subTree, record, appRecord, rootIndex);
    }

    toKeepAliveCachedVNodes(instance).forEach((cachedVNode) => {
      traverseVNode(cachedVNode, record, appRecord, rootIndex);
    });

    return record;
  };

  mountedApps.forEach((appRecord, rootIndex) => {
    const rootInstance = resolveRootInstance(appRecord.app);

    if (rootInstance === undefined) {
      return;
    }

    const rootRecord = traverseInstance(rootInstance, appRecord, rootIndex);

    if (rootRecord !== undefined) {
      appendRootRecordKey(state, rootRecord.key);
    }
  });

  return {
    records: state.records.map((record) => {
      return {
        ...record,
        childKeys: [...record.childKeys],
        tags: [...record.tags],
      };
    }),
    rootRecordKeys: [...state.rootRecordKeys],
  };
};

export const traverseVueMountedApps = (
  mountedApps: readonly VueMountedAppRecord[],
) => {
  return traverseVueMountedAppsInternal(mountedApps);
};
