import type { TreeNode } from '@iteraai/inspector-protocol';
import { createBaseReactInspectorAdapter } from '../base/baseAdapter';
import { getNormalizedTreeNodeSourceFromElement } from '../base/sourceMetadata';
import type { ReactInspectorAdapterContract } from '../base/types';

const INSPECTOR_NODE_ID_ATTRIBUTE = 'data-inspector-node-id';
const INSPECTOR_DISPLAY_NAME_ATTRIBUTE = 'data-inspector-display-name';
const NEXT_APP_ROUTER_BOUNDARY_ATTRIBUTE = 'data-nextjs-scroll-focus-boundary';
const NEXT_PAGES_ROOT_ID = '__next';
const NEXT_PAGES_ROOT_NODE_ID = 'next-pages-root';
const NEXT_APP_ROUTER_ROOT_NODE_ID = 'next-app-router-root';
const MAX_TEXT_PREVIEW_LENGTH = 120;
const GENERATED_NODE_ID_PREFIX = 'next-node';

type NextTreeModel = {
  snapshot: {
    nodes: TreeNode[];
    rootIds: string[];
  };
  nodeElementById: Map<string, Element>;
};

type NextAdapterSessionState = {
  generatedNodeIdByPath: Map<string, string>;
  nextGeneratedNodeId: number;
};

type CreateNextReactInspectorAdapterOptions = {
  doc?: Document;
};

const createSessionState = (): NextAdapterSessionState => {
  return {
    generatedNodeIdByPath: new Map<string, string>(),
    nextGeneratedNodeId: 1,
  };
};

const toDisplayName = (element: Element, nodeId: string) => {
  const explicitDisplayName = element
    .getAttribute(INSPECTOR_DISPLAY_NAME_ATTRIBUTE)
    ?.trim();

  if (explicitDisplayName !== undefined && explicitDisplayName.length > 0) {
    return explicitDisplayName;
  }

  const displayNameFromNodeId = nodeId
    .split(/[\s_-]+/)
    .filter((segment) => segment.length > 0)
    .map((segment) => segment[0].toUpperCase() + segment.slice(1))
    .join('');

  if (displayNameFromNodeId.length > 0) {
    return displayNameFromNodeId;
  }

  return element.tagName.toLowerCase();
};

const getExplicitNodeIdFromElement = (element: Element) => {
  const nodeId = element.getAttribute(INSPECTOR_NODE_ID_ATTRIBUTE)?.trim();

  if (nodeId === undefined || nodeId.length === 0) {
    return undefined;
  }

  return nodeId;
};

const isNextAppRouterBoundary = (element: Element) => {
  return element.hasAttribute(NEXT_APP_ROUTER_BOUNDARY_ATTRIBUTE);
};

const toElementPath = (element: Element) => {
  const segments: string[] = [];
  let cursor: Element | null = element;

  while (cursor !== null) {
    const parentElement: Element | null = cursor.parentElement;
    const siblingIndex =
      parentElement === null
        ? 0
        : Array.from(parentElement.children).findIndex(
            (child) => child === cursor,
          );

    segments.push(`${cursor.tagName.toLowerCase()}:${siblingIndex}`);
    cursor = parentElement;
  }

  return segments.reverse().join('/');
};

const toGeneratedNodeId = (
  state: NextAdapterSessionState,
  element: Element,
  reservedNodeIds: ReadonlySet<string>,
) => {
  const path = toElementPath(element);
  const existingNodeId = state.generatedNodeIdByPath.get(path);

  if (existingNodeId !== undefined && !reservedNodeIds.has(existingNodeId)) {
    return existingNodeId;
  }

  let generatedNodeId = `${GENERATED_NODE_ID_PREFIX}-${state.nextGeneratedNodeId}`;

  while (reservedNodeIds.has(generatedNodeId)) {
    state.nextGeneratedNodeId += 1;
    generatedNodeId = `${GENERATED_NODE_ID_PREFIX}-${state.nextGeneratedNodeId}`;
  }

  state.generatedNodeIdByPath.set(path, generatedNodeId);
  state.nextGeneratedNodeId += 1;

  return generatedNodeId;
};

const toTreeCandidates = (doc: Document) => {
  const explicitInspectorNodes = Array.from(
    doc.querySelectorAll(`[${INSPECTOR_NODE_ID_ATTRIBUTE}]`),
  ).filter((element) => getExplicitNodeIdFromElement(element) !== undefined);

  if (explicitInspectorNodes.length > 0) {
    return explicitInspectorNodes;
  }

  const nextPagesRoot = doc.getElementById(NEXT_PAGES_ROOT_ID);

  if (nextPagesRoot !== null) {
    return [nextPagesRoot];
  }

  const nextAppRouterBoundary = doc.querySelector(
    `[${NEXT_APP_ROUTER_BOUNDARY_ATTRIBUTE}]`,
  );

  if (nextAppRouterBoundary !== null) {
    return [nextAppRouterBoundary];
  }

  return [];
};

const resolveNodeIdForCandidate = (
  state: NextAdapterSessionState,
  element: Element,
  reservedNodeIds: ReadonlySet<string>,
) => {
  const explicitNodeId = getExplicitNodeIdFromElement(element);

  if (explicitNodeId !== undefined) {
    return explicitNodeId;
  }

  if ((element.getAttribute('id') ?? '').trim() === NEXT_PAGES_ROOT_ID) {
    return NEXT_PAGES_ROOT_NODE_ID;
  }

  if (isNextAppRouterBoundary(element)) {
    return NEXT_APP_ROUTER_ROOT_NODE_ID;
  }

  return toGeneratedNodeId(state, element, reservedNodeIds);
};

const buildTreeModel = (
  doc: Document,
  state: NextAdapterSessionState,
): NextTreeModel => {
  const nodeElementById = new Map<string, Element>();

  toTreeCandidates(doc).forEach((element) => {
    const reservedNodeIds = new Set(nodeElementById.keys());
    const nodeId = resolveNodeIdForCandidate(state, element, reservedNodeIds);

    if (nodeElementById.has(nodeId)) {
      return;
    }

    nodeElementById.set(nodeId, element);
  });

  const nodesById = new Map<string, TreeNode>();

  nodeElementById.forEach((element, nodeId) => {
    const source = getNormalizedTreeNodeSourceFromElement(element);

    nodesById.set(nodeId, {
      id: nodeId,
      displayName: toDisplayName(element, nodeId),
      parentId: null,
      childrenIds: [],
      tags: [element.tagName.toLowerCase()],
      ...(source && { source }),
    });
  });

  nodeElementById.forEach((element, nodeId) => {
    const node = nodesById.get(nodeId);

    if (node === undefined) {
      return;
    }

    const parentInspectorElement = element.parentElement?.closest(
      `[${INSPECTOR_NODE_ID_ATTRIBUTE}]`,
    );
    const parentNodeId =
      parentInspectorElement == null
        ? undefined
        : getExplicitNodeIdFromElement(parentInspectorElement);

    if (
      parentNodeId === undefined ||
      parentNodeId === nodeId ||
      !nodesById.has(parentNodeId)
    ) {
      return;
    }

    node.parentId = parentNodeId;
    const parentNode = nodesById.get(parentNodeId);

    if (parentNode === undefined) {
      return;
    }

    parentNode.childrenIds.push(nodeId);
  });

  const nodes = Array.from(nodesById.values());
  const rootIds = nodes
    .filter((node) => node.parentId === null)
    .map((node) => node.id);

  return {
    snapshot: {
      nodes,
      rootIds,
    },
    nodeElementById,
  };
};

const toTextPreview = (element: Element) => {
  const rawText = element.textContent?.replace(/\s+/g, ' ').trim();

  if (rawText === undefined || rawText.length === 0) {
    return undefined;
  }

  if (rawText.length <= MAX_TEXT_PREVIEW_LENGTH) {
    return rawText;
  }

  return `${rawText.slice(0, MAX_TEXT_PREVIEW_LENGTH - 3)}...`;
};

const toNodeProps = (nodeId: string, element: Element) => {
  const props: Record<string, unknown> = {
    nodeId,
    tagName: element.tagName.toLowerCase(),
  };
  const classList = Array.from(element.classList);
  const textPreview = toTextPreview(element);
  const role = element.getAttribute('role');
  const ariaLabel = element.getAttribute('aria-label');

  if (element.id.length > 0) {
    props.elementId = element.id;
  }

  if (classList.length > 0) {
    props.classList = classList;
  }

  if ((element.getAttribute('id') ?? '').trim() === NEXT_PAGES_ROOT_ID) {
    props.routerMode = 'pages';
  } else if (isNextAppRouterBoundary(element)) {
    props.routerMode = 'app';
  }

  if (role !== null && role.length > 0) {
    props.role = role;
  }

  if (ariaLabel !== null && ariaLabel.length > 0) {
    props.ariaLabel = ariaLabel;
  }

  if (textPreview !== undefined) {
    props.textPreview = textPreview;
  }

  if (element instanceof HTMLIFrameElement && element.src.length > 0) {
    props.src = element.src;
  }

  return props;
};

export const createNextReactInspectorAdapter = (
  options: CreateNextReactInspectorAdapterOptions = {},
): ReactInspectorAdapterContract => {
  const doc = options.doc ?? document;
  const state = createSessionState();
  let latestTreeModel: NextTreeModel | undefined;

  const captureTreeModel = () => {
    latestTreeModel = buildTreeModel(doc, state);

    return latestTreeModel.snapshot;
  };

  const getLatestElementByNodeId = (nodeId: string) => {
    return latestTreeModel?.nodeElementById.get(nodeId);
  };

  return createBaseReactInspectorAdapter({
    getTreeSnapshot: captureTreeModel,
    getNodeProps: ({ node }) => {
      const element = getLatestElementByNodeId(node.id);

      if (element === undefined) {
        return undefined;
      }

      return toNodeProps(node.id, element);
    },
    getDomElement: ({ node }) => {
      return getLatestElementByNodeId(node.id) ?? null;
    },
  });
};
