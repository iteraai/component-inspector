import type { VueNodeLookupPayload } from './nodeLookup';

type VueComponentInstanceLike = Record<string, unknown>;
type VueVNodeLike = Record<string, unknown>;

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

const toElement = (value: unknown): Element | undefined => {
  if (typeof Element === 'undefined' || !(value instanceof Element)) {
    return undefined;
  }

  return value;
};

const readInstanceSubTree = (instance: VueComponentInstanceLike) => {
  return toVNode(readRecordValue(instance, 'subTree'));
};

const readInstanceVNode = (instance: VueComponentInstanceLike) => {
  return toVNode(readRecordValue(instance, 'vnode'));
};

const readVNodeElement = (vnode: VueVNodeLike) => {
  return toElement(readRecordValue(vnode, 'el'));
};

const readVNodeComponent = (vnode: VueVNodeLike) => {
  return toComponentInstance(readRecordValue(vnode, 'component'));
};

const toVNodeChildren = (vnode: VueVNodeLike) => {
  const childrenValue = readRecordValue(vnode, 'children');

  return Array.isArray(childrenValue)
    ? childrenValue.flatMap((child) => {
        const childVNode = toVNode(child);

        return childVNode === undefined ? [] : [childVNode];
      })
    : [];
};

const toSuspenseBranchVNodes = (vnode: VueVNodeLike) => {
  const suspenseValue = readRecordValue(vnode, 'suspense');
  const candidateBranches = isRecord(suspenseValue)
    ? [
        readRecordValue(suspenseValue, 'activeBranch'),
        readRecordValue(suspenseValue, 'pendingBranch'),
      ]
    : [readRecordValue(vnode, 'ssContent'), readRecordValue(vnode, 'ssFallback')];
  const branchVNodes: VueVNodeLike[] = [];
  const seenBranchRefs = new WeakSet<object>();

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

const appendVNodesInOrder = (
  stack: VueVNodeLike[],
  childVNodes: readonly VueVNodeLike[],
) => {
  for (let index = childVNodes.length - 1; index >= 0; index -= 1) {
    const childVNode = childVNodes[index];

    if (childVNode !== undefined) {
      stack.push(childVNode);
    }
  }
};

const findFirstElementFromVNode = (entryVNode: VueVNodeLike) => {
  const stack: VueVNodeLike[] = [entryVNode];
  const visitedVNodes = new Set<unknown>();

  while (stack.length > 0) {
    const currentVNode = stack.pop();

    if (currentVNode === undefined || visitedVNodes.has(currentVNode)) {
      continue;
    }

    visitedVNodes.add(currentVNode);

    const directElement = readVNodeElement(currentVNode);

    if (directElement !== undefined) {
      return directElement;
    }

    const component = readVNodeComponent(currentVNode);
    const componentSubTree =
      component === undefined ? undefined : readInstanceSubTree(component);

    if (componentSubTree !== undefined) {
      stack.push(componentSubTree);
      continue;
    }

    const suspenseBranchVNodes = toSuspenseBranchVNodes(currentVNode);

    if (suspenseBranchVNodes.length > 0) {
      appendVNodesInOrder(stack, suspenseBranchVNodes);
      continue;
    }

    appendVNodesInOrder(stack, toVNodeChildren(currentVNode));
  }

  return undefined;
};

export const resolveVueHighlightTarget = (
  lookupPayload: VueNodeLookupPayload,
): Element | null => {
  const instance = toComponentInstance(lookupPayload.instance);

  if (instance === undefined) {
    return null;
  }

  const entryVNode = readInstanceSubTree(instance) ?? readInstanceVNode(instance);

  if (entryVNode === undefined) {
    return null;
  }

  return findFirstElementFromVNode(entryVNode) ?? null;
};
