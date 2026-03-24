import type { InspectorTreeSnapshot, VueMountedAppRecord } from '../base/types';
import { resolveVueHighlightTarget } from './highlightTarget';
import type { VueTraversalRecord, VueTraversalResult } from './traversal';

export type VueNodeLookupPayload = Readonly<{
  nodeId: string;
  recordKey: string;
  appRecord: VueMountedAppRecord;
  rootIndex: number;
  instance: unknown;
  displayName: string;
  parentNodeId: string | null;
  childNodeIds: string[];
}>;

export type VueNodeLookup = Readonly<{
  refreshFromSnapshot: (options: {
    traversalResult: VueTraversalResult;
    nodeIdByRecordKey: ReadonlyMap<string, string>;
    snapshot: InspectorTreeSnapshot;
  }) => void;
  resolveByNodeId: (nodeId: string) => VueNodeLookupPayload | undefined;
  resolveClosestComponentPathForElement: (
    element: Element,
  ) => ReadonlyArray<string> | undefined;
}>;

type VueComponentInstanceLike = Record<string, unknown>;
type VueVNodeLike = Record<string, unknown>;
type VueManagedElement = Element & Record<string, unknown>;

const VUE_PARENT_COMPONENT_DOM_MARKER = '__vueParentComponent';
const VUE_VNODE_DOM_MARKER = '__vnode';

const toChildNodeIds = (
  childKeys: string[],
  nodeIdByRecordKey: ReadonlyMap<string, string>,
  includedNodeIdSet: ReadonlySet<string>,
) => {
  const childNodeIds: string[] = [];
  const seenChildNodeIds = new Set<string>();

  childKeys.forEach((childKey) => {
    const childNodeId = nodeIdByRecordKey.get(childKey);

    if (
      childNodeId === undefined ||
      !includedNodeIdSet.has(childNodeId) ||
      seenChildNodeIds.has(childNodeId)
    ) {
      return;
    }

    seenChildNodeIds.add(childNodeId);
    childNodeIds.push(childNodeId);
  });

  return childNodeIds;
};

const toParentNodeId = (
  record: VueTraversalRecord,
  nodeIdByRecordKey: ReadonlyMap<string, string>,
  includedNodeIdSet: ReadonlySet<string>,
) => {
  if (record.parentKey === null) {
    return null;
  }

  const parentNodeId = nodeIdByRecordKey.get(record.parentKey);

  if (parentNodeId === undefined || !includedNodeIdSet.has(parentNodeId)) {
    return null;
  }

  return parentNodeId;
};

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

const toVNode = (value: unknown): VueVNodeLike | undefined => {
  if (!isRecord(value)) {
    return undefined;
  }

  return value;
};

const readParentInstance = (instance: VueComponentInstanceLike) => {
  return toComponentInstance(readRecordValue(instance, 'parent'));
};

const readElementParentComponentMarker = (element: Element) => {
  return toComponentInstance(
    (element as VueManagedElement)[VUE_PARENT_COMPONENT_DOM_MARKER],
  );
};

const readElementVNodeMarker = (element: Element) => {
  return toVNode((element as VueManagedElement)[VUE_VNODE_DOM_MARKER]);
};

const readVNodeComponent = (vnode: VueVNodeLike) => {
  return toComponentInstance(readRecordValue(vnode, 'component'));
};

const toMarkerInstances = (element: Element) => {
  const instances: VueComponentInstanceLike[] = [];
  const seenInstanceRefs = new Set<unknown>();

  const appendInstance = (instance: VueComponentInstanceLike | undefined) => {
    if (instance === undefined || seenInstanceRefs.has(instance)) {
      return;
    }

    seenInstanceRefs.add(instance);
    instances.push(instance);
  };

  appendInstance(readElementParentComponentMarker(element));

  const elementVNode = readElementVNodeMarker(element);

  if (elementVNode !== undefined) {
    appendInstance(readVNodeComponent(elementVNode));
  }

  return instances;
};

const getParentElement = (element: Element): Element | null => {
  if (element.parentElement !== null) {
    return element.parentElement;
  }

  const parentNode = element.parentNode;

  if (typeof ShadowRoot !== 'undefined' && parentNode instanceof ShadowRoot) {
    return parentNode.host instanceof Element ? parentNode.host : null;
  }

  return parentNode instanceof Element ? parentNode : null;
};

const buildComponentPath = (
  nodeId: string,
  nodeById: ReadonlyMap<string, InspectorTreeSnapshot['nodes'][number]>,
) => {
  const componentPath: string[] = [];
  const visitedNodeIds = new Set<string>();
  let currentNodeId: string | null = nodeId;

  while (currentNodeId !== null && !visitedNodeIds.has(currentNodeId)) {
    visitedNodeIds.add(currentNodeId);

    const currentNode = nodeById.get(currentNodeId);

    if (currentNode === undefined) {
      break;
    }

    componentPath.unshift(currentNode.displayName);
    currentNodeId = currentNode.parentId;
  }

  return componentPath.length > 0 ? componentPath : undefined;
};

const resolveClosestNodeIdForInstance = (
  instance: VueComponentInstanceLike,
  nodeIdByInstanceRef: WeakMap<object, string>,
) => {
  const visitedInstances = new Set<unknown>();
  let currentInstance: VueComponentInstanceLike | undefined = instance;

  while (
    currentInstance !== undefined &&
    !visitedInstances.has(currentInstance)
  ) {
    visitedInstances.add(currentInstance);

    const nodeId = nodeIdByInstanceRef.get(currentInstance);

    if (nodeId !== undefined) {
      return nodeId;
    }

    currentInstance = readParentInstance(currentInstance);
  }

  return undefined;
};

export const createVueNodeLookup = (): VueNodeLookup => {
  let payloadByNodeId = new Map<string, VueNodeLookupPayload>();
  let nodeIdByInstanceRef = new WeakMap<object, string>();
  let nodeIdByRootElementRef = new WeakMap<object, string>();
  let nodeById = new Map<string, InspectorTreeSnapshot['nodes'][number]>();

  return {
    refreshFromSnapshot: (options) => {
      const nextPayloadByNodeId = new Map<string, VueNodeLookupPayload>();
      const nextNodeIdByInstanceRef = new WeakMap<object, string>();
      const nextNodeIdByRootElementRef = new WeakMap<object, string>();
      const nextNodeById = new Map(
        options.snapshot.nodes.map((node) => [node.id, node]),
      );
      const includedNodeIdSet = new Set(
        options.snapshot.nodes.map((node) => node.id),
      );

      options.traversalResult.records.forEach((record) => {
        const nodeId = options.nodeIdByRecordKey.get(record.key);

        if (
          nodeId === undefined ||
          !includedNodeIdSet.has(nodeId) ||
          nextPayloadByNodeId.has(nodeId)
        ) {
          return;
        }

        const payload = {
          nodeId,
          recordKey: record.key,
          appRecord: record.appRecord,
          rootIndex: record.rootIndex,
          instance: record.instance,
          displayName: record.displayName,
          parentNodeId: toParentNodeId(
            record,
            options.nodeIdByRecordKey,
            includedNodeIdSet,
          ),
          childNodeIds: toChildNodeIds(
            record.childKeys,
            options.nodeIdByRecordKey,
            includedNodeIdSet,
          ),
        } satisfies VueNodeLookupPayload;

        nextPayloadByNodeId.set(nodeId, payload);

        const instance = toComponentInstance(record.instance);

        if (instance !== undefined) {
          nextNodeIdByInstanceRef.set(instance, nodeId);
        }

        const rootElement = resolveVueHighlightTarget(payload);

        if (rootElement !== null) {
          nextNodeIdByRootElementRef.set(rootElement, nodeId);
        }
      });

      payloadByNodeId = nextPayloadByNodeId;
      nodeIdByInstanceRef = nextNodeIdByInstanceRef;
      nodeIdByRootElementRef = nextNodeIdByRootElementRef;
      nodeById = nextNodeById;
    },
    resolveByNodeId: (nodeId: string) => {
      return payloadByNodeId.get(nodeId);
    },
    resolveClosestComponentPathForElement: (element: Element) => {
      let currentElement: Element | null = element;

      while (currentElement !== null) {
        const markerInstances = toMarkerInstances(currentElement);

        for (const markerInstance of markerInstances) {
          const nodeId = resolveClosestNodeIdForInstance(
            markerInstance,
            nodeIdByInstanceRef,
          );

          if (nodeId !== undefined) {
            return buildComponentPath(nodeId, nodeById);
          }
        }

        currentElement = getParentElement(currentElement);
      }

      currentElement = element;

      while (currentElement !== null) {
        const nodeId = nodeIdByRootElementRef.get(currentElement);

        if (nodeId !== undefined) {
          return buildComponentPath(nodeId, nodeById);
        }

        currentElement = getParentElement(currentElement);
      }

      return undefined;
    },
  };
};
