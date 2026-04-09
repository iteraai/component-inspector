import type {
  InspectorComponentPath,
  InspectorTreeSnapshot,
} from '../base/types';
import type {
  AngularDiscoveryRecord,
  AngularDiscoveryResult,
} from './discovery';
import type { AngularDevModeGlobalsApi } from './angularGlobals';

export type AngularNodeLookupPayload = Readonly<{
  nodeId: string;
  recordKey: string;
  rootIndex: number;
  component: object;
  hostElement: Element;
  displayName: string;
  parentNodeId: string | null;
  childNodeIds: string[];
}>;

export type AngularNodeLookup = Readonly<{
  refreshFromSnapshot: (options: {
    discoveryResult: AngularDiscoveryResult;
    nodeIdByRecordKey: ReadonlyMap<string, string>;
    snapshot: InspectorTreeSnapshot;
  }) => void;
  resolveByNodeId: (nodeId: string) => AngularNodeLookupPayload | undefined;
  resolveClosestComponentPathForElement: (
    element: Element,
    angularGlobals: AngularDevModeGlobalsApi,
  ) => InspectorComponentPath | undefined;
}>;

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
  record: AngularDiscoveryRecord,
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

const isInspectableObject = (value: unknown): value is object => {
  return (
    (typeof value === 'object' && value !== null) || typeof value === 'function'
  );
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

const readAngularComponent = (
  element: Element,
  angularGlobals: AngularDevModeGlobalsApi,
) => {
  let component: object | null | undefined;

  try {
    component = angularGlobals.getComponent?.(element);
  } catch {
    component = undefined;
  }

  return isInspectableObject(component) ? component : undefined;
};

const readOwningAngularComponent = (
  target: Element | object,
  angularGlobals: AngularDevModeGlobalsApi,
) => {
  let component: object | null | undefined;

  try {
    component = angularGlobals.getOwningComponent?.(target);
  } catch {
    component = undefined;
  }

  return isInspectableObject(component) ? component : undefined;
};

const resolveClosestNodeIdForComponent = (
  component: object | undefined,
  angularGlobals: AngularDevModeGlobalsApi,
  nodeIdByComponentRef: WeakMap<object, string>,
) => {
  const visitedComponents = new Set<unknown>();
  let currentComponent = component;

  while (
    currentComponent !== undefined &&
    !visitedComponents.has(currentComponent)
  ) {
    visitedComponents.add(currentComponent);

    const nodeId = nodeIdByComponentRef.get(currentComponent);

    if (nodeId !== undefined) {
      return nodeId;
    }

    currentComponent = readOwningAngularComponent(currentComponent, angularGlobals);
  }

  return undefined;
};

export const createAngularNodeLookup = (): AngularNodeLookup => {
  let payloadByNodeId = new Map<string, AngularNodeLookupPayload>();
  let nodeIdByComponentRef = new WeakMap<object, string>();
  let nodeIdByHostElementRef = new WeakMap<object, string>();
  let nodeById = new Map<string, InspectorTreeSnapshot['nodes'][number]>();

  return {
    refreshFromSnapshot: (options) => {
      const nextPayloadByNodeId = new Map<string, AngularNodeLookupPayload>();
      const nextNodeIdByComponentRef = new WeakMap<object, string>();
      const nextNodeIdByHostElementRef = new WeakMap<object, string>();
      const nextNodeById = new Map(
        options.snapshot.nodes.map((node) => [node.id, node]),
      );
      const includedNodeIdSet = new Set(
        options.snapshot.nodes.map((node) => node.id),
      );

      options.discoveryResult.records.forEach((record) => {
        const nodeId = options.nodeIdByRecordKey.get(record.key);

        if (
          nodeId === undefined ||
          !includedNodeIdSet.has(nodeId) ||
          nextPayloadByNodeId.has(nodeId)
        ) {
          return;
        }

        nextPayloadByNodeId.set(nodeId, {
          nodeId,
          recordKey: record.key,
          rootIndex: record.rootIndex,
          component: record.component,
          hostElement: record.hostElement,
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
        });

        nextNodeIdByComponentRef.set(record.component, nodeId);
        nextNodeIdByHostElementRef.set(record.hostElement, nodeId);
      });

      payloadByNodeId = nextPayloadByNodeId;
      nodeIdByComponentRef = nextNodeIdByComponentRef;
      nodeIdByHostElementRef = nextNodeIdByHostElementRef;
      nodeById = nextNodeById;
    },
    resolveByNodeId: (nodeId: string) => {
      return payloadByNodeId.get(nodeId);
    },
    resolveClosestComponentPathForElement: (
      element: Element,
      angularGlobals: AngularDevModeGlobalsApi,
    ) => {
      if (!element.isConnected) {
        return undefined;
      }

      let currentElement: Element | null = element;

      while (currentElement !== null) {
        const directNodeId = resolveClosestNodeIdForComponent(
          readAngularComponent(currentElement, angularGlobals),
          angularGlobals,
          nodeIdByComponentRef,
        );

        if (directNodeId !== undefined) {
          return buildComponentPath(directNodeId, nodeById);
        }

        const hostNodeId = nodeIdByHostElementRef.get(currentElement);

        if (hostNodeId !== undefined) {
          return buildComponentPath(hostNodeId, nodeById);
        }

        const owningNodeId = resolveClosestNodeIdForComponent(
          readOwningAngularComponent(currentElement, angularGlobals),
          angularGlobals,
          nodeIdByComponentRef,
        );

        if (owningNodeId !== undefined) {
          return buildComponentPath(owningNodeId, nodeById);
        }

        currentElement = getParentElement(currentElement);
      }

      return undefined;
    },
  };
};
