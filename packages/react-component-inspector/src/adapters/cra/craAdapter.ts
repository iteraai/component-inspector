import type { TreeNode } from '@iteraai/inspector-protocol';
import { createBaseReactInspectorAdapter } from '../base/baseAdapter';
import { getNormalizedTreeNodeSourceFromElement } from '../base/sourceMetadata';
import type { ReactInspectorAdapterContract } from '../base/types';

const INSPECTOR_NODE_ID_ATTRIBUTE = 'data-inspector-node-id';
const INSPECTOR_DISPLAY_NAME_ATTRIBUTE = 'data-inspector-display-name';
const CRA_ROOT_ID = 'root';
const LEGACY_REACT_ROOT_ATTRIBUTE = 'data-reactroot';
const CRA_ROOT_NODE_ID = 'cra-root';
const CRA_LEGACY_ROOT_NODE_ID = 'cra-legacy-root';
const MAX_TEXT_PREVIEW_LENGTH = 120;

type CraTreeModel = {
  snapshot: {
    nodes: TreeNode[];
    rootIds: string[];
  };
  nodeElementById: Map<string, Element>;
};

type CreateCraReactInspectorAdapterOptions = {
  doc?: Document;
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

const toTreeCandidates = (doc: Document) => {
  const explicitInspectorNodes = Array.from(
    doc.querySelectorAll(`[${INSPECTOR_NODE_ID_ATTRIBUTE}]`),
  ).filter((element) => getExplicitNodeIdFromElement(element) !== undefined);

  if (explicitInspectorNodes.length > 0) {
    return explicitInspectorNodes;
  }

  const craRoot = doc.getElementById(CRA_ROOT_ID);

  if (craRoot !== null) {
    return [craRoot];
  }

  const legacyReactRoot = doc.querySelector(`[${LEGACY_REACT_ROOT_ATTRIBUTE}]`);

  if (legacyReactRoot !== null) {
    return [legacyReactRoot];
  }

  return [];
};

const resolveNodeIdForCandidate = (element: Element) => {
  const explicitNodeId = getExplicitNodeIdFromElement(element);

  if (explicitNodeId !== undefined) {
    return explicitNodeId;
  }

  if ((element.getAttribute('id') ?? '').trim() === CRA_ROOT_ID) {
    return CRA_ROOT_NODE_ID;
  }

  if (element.hasAttribute(LEGACY_REACT_ROOT_ATTRIBUTE)) {
    return CRA_LEGACY_ROOT_NODE_ID;
  }

  return CRA_ROOT_NODE_ID;
};

const buildTreeModel = (doc: Document): CraTreeModel => {
  const nodeElementById = new Map<string, Element>();

  toTreeCandidates(doc).forEach((element) => {
    const nodeId = resolveNodeIdForCandidate(element);

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
  const hasExplicitNodeId = getExplicitNodeIdFromElement(element) !== undefined;

  if (element.id.length > 0) {
    props.elementId = element.id;
  }

  if (classList.length > 0) {
    props.classList = classList;
  }

  if (!hasExplicitNodeId) {
    props.runtimeMode = 'cra-like';
    props.introspection = 'fallback-root';

    if ((element.getAttribute('id') ?? '').trim() === CRA_ROOT_ID) {
      props.fallbackReason = 'root-container';
    } else if (element.hasAttribute(LEGACY_REACT_ROOT_ATTRIBUTE)) {
      props.fallbackReason = 'legacy-reactroot';
    }
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

export const createCraReactInspectorAdapter = (
  options: CreateCraReactInspectorAdapterOptions = {},
): ReactInspectorAdapterContract => {
  const doc = options.doc ?? document;
  let latestTreeModel: CraTreeModel | undefined;

  const captureTreeModel = () => {
    latestTreeModel = buildTreeModel(doc);

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
