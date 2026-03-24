import {
  ITERATION_INSPECTOR_CHANNEL,
  IterationElementBounds,
  IterationElementSelection,
  type IterationElementLocator,
  type IterationInspectorDebugDetails,
  iterationInspectorRuntimeCapabilities,
  IterationInspectorInvalidationReason,
  type IterationPreviewEditError,
  type IterationPreviewTargetEdit,
  type IterationInspectorSelectionMode,
  IterationInspectorRuntimeMessage,
  isIterationInspectorParentMessage,
} from './types';

type CreateIterationInspectorRuntimeArgs = {
  allowSelfMessaging?: boolean;
  win?: Window;
  doc?: Document;
};

type OverlayElements = {
  root: HTMLDivElement;
  selectedBox: HTMLDivElement;
  selectedLabel: HTMLDivElement;
  hoverBox: HTMLDivElement;
  hoverLabel: HTMLDivElement;
};

type PointerCoordinates = {
  clientX: number;
  clientY: number;
};

type PendingPointerSelection = {
  pointerId: number;
  origin: PointerCoordinates;
};

type InspectableTarget =
  | {
      kind: 'element';
      element: Element;
    }
  | {
      kind: 'text';
      element: Element;
      textNode: Text;
    };

type AccessibleNameOptions = {
  includeTextFallback?: boolean;
};

type RuntimeLifecycleReason =
  | 'command'
  | 'preview_edits'
  | 'selection'
  | 'route_change'
  | 'reload';

type SelectionSource = 'click' | 'pointerup';

type IterationElementComponentPathFields = Pick<
  IterationElementLocator,
  'componentPath' | 'reactComponentPath'
>;

type PreviewPatchRegistrar = {
  recordAttribute: (
    element: Element,
    attributeName: string,
    value: string | null,
  ) => void;
  recordStyle: (
    element: HTMLElement,
    propertyName: string,
    value: string | null,
  ) => void;
  recordTextContent: (element: Element, value: string) => void;
};

type PreviewPatchSession = PreviewPatchRegistrar & {
  clear: () => void;
};

type PreviewPatchResult = {
  appliedTargetCount: number;
  errors: IterationPreviewEditError[];
};

type PreviewTargetResolution =
  | {
      element: Element;
    }
  | {
      code: 'locator_not_found' | 'url_mismatch';
      message: string;
    };

export type IterationInspectorRuntime = {
  start: () => void;
  stop: () => void;
  isActive: () => boolean;
};

declare global {
  interface Window {
    __ITERA_ITERATION_INSPECTOR_RUNTIME__?: IterationInspectorRuntime;
    __ARA_EMBEDDED_REACT_INSPECTOR_SELECTION__?: {
      getComponentPathForElement?: (
        element: Element,
      ) => ReadonlyArray<string> | undefined;
      getReactComponentPathForElement?: (
        element: Element,
      ) => ReadonlyArray<string> | undefined;
    };
  }
}

const OVERLAY_ROOT_ID = 'itera-iteration-inspector-overlay-root';
const OVERLAY_Z_INDEX = '2147483647';
const DEFAULT_LABEL = 'Select an element';
const SELECTED_OVERLAY_BORDER_COLOR = '#14b8a6';
const SELECTED_OVERLAY_BACKGROUND_COLOR = 'rgba(20, 184, 166, 0.08)';
const SELECTED_LABEL_BACKGROUND_COLOR = '#115e59';
const HOVER_OVERLAY_BORDER_COLOR = '#2563eb';
const HOVER_OVERLAY_BACKGROUND_COLOR = 'rgba(37, 99, 235, 0.08)';
const HOVER_LABEL_BACKGROUND_COLOR = '#1d4ed8';
const POINTER_TAP_MAX_DISTANCE_PX = 8;
const TEXT_MAX_LENGTH = 120;
const SEMANTIC_INSPECTABLE_ELEMENT_TAG_NAMES = new Set([
  'button',
  'input',
  'textarea',
  'select',
]);
const INSPECTABLE_ELEMENT_TAG_NAMES = new Set([
  ...SEMANTIC_INSPECTABLE_ELEMENT_TAG_NAMES,
  'div',
  'img',
]);

const normalizeWhitespace = (value: string | null | undefined) => {
  if (value === null || value === undefined) {
    return null;
  }

  const normalized = value.replaceAll(/\s+/g, ' ').trim();

  if (normalized.length === 0) {
    return null;
  }

  if (normalized.length <= TEXT_MAX_LENGTH) {
    return normalized;
  }

  return `${normalized.slice(0, TEXT_MAX_LENGTH - 3)}...`;
};

const escapeCssIdentifier = (value: string) =>
  value.replaceAll(/([ !"#$%&'()*+,./:;<=>?@[\\\]^`{|}~])/g, '\\$1');

const roundMeasurement = (value: number) => Math.round(value * 100) / 100;

const buildBoundsFromRect = (
  rect: Pick<DOMRectReadOnly, 'top' | 'left' | 'width' | 'height'>,
): IterationElementBounds => ({
  top: roundMeasurement(rect.top),
  left: roundMeasurement(rect.left),
  width: roundMeasurement(rect.width),
  height: roundMeasurement(rect.height),
});

const isPointWithinRect = (
  rect: Pick<DOMRectReadOnly, 'top' | 'left' | 'width' | 'height'>,
  coordinates: PointerCoordinates,
) =>
  coordinates.clientX >= rect.left &&
  coordinates.clientX <= rect.left + rect.width &&
  coordinates.clientY >= rect.top &&
  coordinates.clientY <= rect.top + rect.height;

const getUrlPath = (locationLike: Location) =>
  `${locationLike.pathname}${locationLike.search}${locationLike.hash}`;

const getNodeText = (element: Element) => {
  if (
    element instanceof HTMLTextAreaElement ||
    (element instanceof HTMLInputElement &&
      !['button', 'submit', 'reset'].includes(
        element.type.toLowerCase() || 'text',
      ))
  ) {
    return null;
  }

  const text =
    element instanceof HTMLElement && typeof element.innerText === 'string'
      ? element.innerText
      : element.textContent;

  return normalizeWhitespace(text);
};

const getDataTestId = (element: Element) =>
  normalizeWhitespace(
    element.getAttribute('data-testid') ??
      element.getAttribute('data-test-id') ??
      element.getAttribute('data-cy'),
  );

const inferRole = (element: Element): string | null => {
  const explicitRole = normalizeWhitespace(element.getAttribute('role'));

  if (explicitRole !== null) {
    return explicitRole;
  }

  const tagName = element.tagName.toLowerCase();

  if (tagName === 'button') {
    return 'button';
  }

  if (tagName === 'a' && element.hasAttribute('href')) {
    return 'link';
  }

  if (tagName === 'textarea') {
    return 'textbox';
  }

  if (tagName === 'select') {
    return 'combobox';
  }

  if (tagName === 'img') {
    return 'img';
  }

  if (tagName === 'input') {
    const inputType = element.getAttribute('type')?.toLowerCase() ?? 'text';

    if (
      inputType === 'button' ||
      inputType === 'submit' ||
      inputType === 'reset'
    ) {
      return 'button';
    }

    if (
      inputType === 'checkbox' ||
      inputType === 'radio' ||
      inputType === 'range'
    ) {
      return inputType;
    }

    return 'textbox';
  }

  return null;
};

const getAssociatedLabelText = (element: Element, doc: Document) => {
  if (
    !(element instanceof HTMLInputElement) &&
    !(element instanceof HTMLTextAreaElement) &&
    !(element instanceof HTMLSelectElement) &&
    !(element instanceof HTMLMeterElement) &&
    !(element instanceof HTMLProgressElement)
  ) {
    return null;
  }

  if (element.labels !== null && element.labels.length > 0) {
    return normalizeWhitespace(
      Array.from(element.labels)
        .map((label) => label.textContent ?? '')
        .join(' '),
    );
  }

  if (element.id.length === 0) {
    return null;
  }

  return normalizeWhitespace(
    doc.querySelector(`label[for="${escapeCssIdentifier(element.id)}"]`)
      ?.textContent ?? null,
  );
};

const getAccessibleName = (
  element: Element,
  doc: Document,
  options: AccessibleNameOptions = {},
) => {
  const { includeTextFallback = true } = options;
  const ariaLabel = normalizeWhitespace(element.getAttribute('aria-label'));

  if (ariaLabel !== null) {
    return ariaLabel;
  }

  const labelledBy = element.getAttribute('aria-labelledby');

  if (labelledBy !== null) {
    const ids = labelledBy
      .split(/\s+/)
      .map((value) => value.trim())
      .filter(Boolean);

    const labelText = normalizeWhitespace(
      ids.map((id) => doc.getElementById(id)?.textContent ?? '').join(' '),
    );

    if (labelText !== null) {
      return labelText;
    }
  }

  const altText = normalizeWhitespace(element.getAttribute('alt'));

  if (altText !== null) {
    return altText;
  }

  const titleText = normalizeWhitespace(element.getAttribute('title'));

  if (titleText !== null) {
    return titleText;
  }

  const placeholderText = normalizeWhitespace(
    element.getAttribute('placeholder'),
  );

  if (placeholderText !== null) {
    return placeholderText;
  }

  const associatedLabelText = getAssociatedLabelText(element, doc);

  if (associatedLabelText !== null) {
    return associatedLabelText;
  }

  if (
    element instanceof HTMLInputElement ||
    element instanceof HTMLTextAreaElement
  ) {
    const valueText =
      element instanceof HTMLInputElement &&
      ['button', 'submit', 'reset'].includes(
        element.type.toLowerCase() || 'text',
      )
        ? normalizeWhitespace(element.value)
        : null;

    if (valueText !== null) {
      return valueText;
    }
  }

  if (!includeTextFallback) {
    return null;
  }

  return getNodeText(element);
};

const shouldUseTextFallbackForHoverLabel = (element: Element) => {
  if (
    element instanceof HTMLButtonElement ||
    element instanceof HTMLAnchorElement ||
    element instanceof HTMLLabelElement ||
    element instanceof HTMLOptionElement
  ) {
    return true;
  }

  if (
    element instanceof HTMLInputElement &&
    ['button', 'submit', 'reset'].includes(element.type.toLowerCase() || 'text')
  ) {
    return true;
  }

  return element.children.length === 0;
};

const getDisplayLabel = (
  element: Element,
  doc: Document,
  options: AccessibleNameOptions = {},
) => getAccessibleName(element, doc, options);

const buildIterationElementDisplayText = (
  element: Element,
  doc: Document,
  options: AccessibleNameOptions = {},
) => {
  const tagName = element.tagName.toLowerCase();
  const roleOrTag = inferRole(element) ?? tagName;
  const sanitizedLabel = getDisplayLabel(element, doc, options)?.replaceAll(
    '"',
    "'",
  );

  if (sanitizedLabel === null || sanitizedLabel === undefined) {
    return `@${roleOrTag}`;
  }

  return `@${roleOrTag} "${sanitizedLabel}"`;
};

const buildTextDisplayText = (textContent: string | null) => {
  const sanitizedLabel = textContent?.replaceAll('"', "'");

  if (sanitizedLabel === null || sanitizedLabel === undefined) {
    return '@text';
  }

  return `@text "${sanitizedLabel}"`;
};

const getPathSegment = (element: Element) => {
  const tagName = element.tagName.toLowerCase();
  const siblings = Array.from(element.parentElement?.children ?? []).filter(
    (sibling) => sibling.tagName === element.tagName,
  );
  const index = siblings.indexOf(element) + 1;

  return `${tagName}:nth-of-type(${Math.max(index, 1)})`;
};

const buildCssSelector = (element: Element) => {
  if (element.id.length > 0) {
    return `${element.tagName.toLowerCase()}#${escapeCssIdentifier(element.id)}`;
  }

  const dataTestId = getDataTestId(element);

  if (dataTestId !== null) {
    return `${element.tagName.toLowerCase()}[data-testid="${dataTestId.replaceAll('"', '\\"')}"]`;
  }

  const segments: string[] = [];
  let current: Element | null = element;

  while (current !== null && current.tagName.toLowerCase() !== 'html') {
    segments.unshift(getPathSegment(current));
    current = current.parentElement;
  }

  return ['html', ...segments].join(' > ');
};

const buildDomPath = (element: Element) => {
  const segments: string[] = [];
  let current: Element | null = element;

  while (current !== null) {
    const currentElement: Element = current;
    const siblings =
      currentElement.parentElement === null
        ? [currentElement]
        : Array.from(currentElement.parentElement.children).filter(
            (sibling) => sibling.tagName === currentElement.tagName,
          );
    const index = siblings.indexOf(currentElement) + 1;
    segments.unshift(
      `${currentElement.tagName.toLowerCase()}[${Math.max(index, 1)}]`,
    );
    current = currentElement.parentElement;
  }

  return `/${segments.join('/')}`;
};

const getBounds = (element: Element): IterationElementBounds =>
  buildBoundsFromRect(element.getBoundingClientRect());

const isNodeWithinOverlayRoot = (node: Node | null) => {
  const element =
    node instanceof Element ? node : (node?.parentElement ?? null);

  if (element === null) {
    return false;
  }

  return element.closest(`#${OVERLAY_ROOT_ID}`) !== null;
};

const getTextNodeText = (textNode: Text) =>
  normalizeWhitespace(textNode.textContent);

const shouldPreferElementTargetOverText = (element: Element) => {
  const tagName = element.tagName.toLowerCase();

  if (SEMANTIC_INSPECTABLE_ELEMENT_TAG_NAMES.has(tagName)) {
    return true;
  }

  const role = inferRole(element);

  return (
    role === 'button' ||
    role === 'textbox' ||
    role === 'combobox' ||
    role === 'checkbox' ||
    role === 'radio' ||
    role === 'range'
  );
};

const getTextTargetFromNode = (node: Node | null): InspectableTarget | null => {
  if (!(node instanceof Text)) {
    return null;
  }

  if (isNodeWithinOverlayRoot(node)) {
    return null;
  }

  const element = node.parentElement;
  const textContent = getTextNodeText(node);

  if (element === null || textContent === null) {
    return null;
  }

  return {
    kind: 'text',
    element,
    textNode: node,
  };
};

const getNearestInspectableElement = (node: Node | null): Element | null => {
  let current = node instanceof Element ? node : (node?.parentElement ?? null);
  let fallbackElement: Element | null = null;

  while (current !== null) {
    if (isNodeWithinOverlayRoot(current)) {
      return null;
    }

    const tagName = current.tagName.toLowerCase();

    if (shouldPreferElementTargetOverText(current)) {
      return current;
    }

    if (
      fallbackElement === null &&
      INSPECTABLE_ELEMENT_TAG_NAMES.has(tagName)
    ) {
      fallbackElement = current;
    }

    current = current.parentElement;
  }

  return fallbackElement;
};

const getCaretNodeFromPoint = (
  doc: Document,
  coordinates: PointerCoordinates,
): Node | null => {
  const caretPositionFromPoint = (
    doc as Document & {
      caretPositionFromPoint?: (
        x: number,
        y: number,
      ) => {
        offsetNode: Node | null;
      } | null;
    }
  ).caretPositionFromPoint;

  if (typeof caretPositionFromPoint === 'function') {
    return (
      caretPositionFromPoint.call(doc, coordinates.clientX, coordinates.clientY)
        ?.offsetNode ?? null
    );
  }

  const caretRangeFromPoint = (
    doc as Document & {
      caretRangeFromPoint?: (
        x: number,
        y: number,
      ) => {
        startContainer: Node | null;
      } | null;
    }
  ).caretRangeFromPoint;

  if (typeof caretRangeFromPoint === 'function') {
    return (
      caretRangeFromPoint.call(doc, coordinates.clientX, coordinates.clientY)
        ?.startContainer ?? null
    );
  }

  return null;
};

const getElementAtPoint = (doc: Document, coordinates: PointerCoordinates) => {
  if (typeof doc.elementFromPoint !== 'function') {
    return null;
  }

  return doc.elementFromPoint(coordinates.clientX, coordinates.clientY);
};

const isTextTargetHit = (
  target: InspectableTarget,
  doc: Document,
  coordinates: PointerCoordinates,
  pointElement: Element | null,
) => {
  if (target.kind !== 'text') {
    return false;
  }

  try {
    const range = doc.createRange();
    range.selectNodeContents(target.textNode);

    if (typeof range.getClientRects === 'function') {
      const clientRects = Array.from(range.getClientRects()).filter(
        (rect) => rect.width > 0 || rect.height > 0,
      );

      if (clientRects.length > 0) {
        return clientRects.some((rect) => isPointWithinRect(rect, coordinates));
      }
    }

    if (typeof range.getBoundingClientRect === 'function') {
      const rect = range.getBoundingClientRect();

      if (rect.width > 0 || rect.height > 0) {
        return isPointWithinRect(rect, coordinates);
      }
    }
  } catch {
    // Range measurement is best-effort. Fall back to DOM hit-testing below.
  }

  return (
    pointElement !== null &&
    (pointElement === target.element || target.element.contains(pointElement))
  );
};

const getTextTargetAtPoint = (
  doc: Document,
  coordinates: PointerCoordinates,
  pointElement: Element | null = getElementAtPoint(doc, coordinates),
): InspectableTarget | null => {
  const textTarget = getTextTargetFromNode(
    getCaretNodeFromPoint(doc, coordinates),
  );

  if (textTarget === null) {
    return null;
  }

  if (!isTextTargetHit(textTarget, doc, coordinates, pointElement)) {
    return null;
  }

  return textTarget;
};

const getInspectableTargetFromNode = (
  node: Node | null,
): InspectableTarget | null => {
  const textTarget = getTextTargetFromNode(node);
  const element = getNearestInspectableElement(node);

  if (
    textTarget !== null &&
    (element === null || !shouldPreferElementTargetOverText(element))
  ) {
    return textTarget;
  }

  if (element === null) {
    return null;
  }

  return {
    kind: 'element',
    element,
  };
};

const getInspectableTargetRect = (
  target: InspectableTarget,
  doc: Document,
): Pick<DOMRectReadOnly, 'top' | 'left' | 'width' | 'height'> => {
  if (target.kind !== 'text') {
    return target.element.getBoundingClientRect();
  }

  try {
    const range = doc.createRange();
    range.selectNodeContents(target.textNode);

    if (typeof range.getBoundingClientRect === 'function') {
      const rect = range.getBoundingClientRect();

      if (rect.width > 0 || rect.height > 0) {
        return rect;
      }
    }
  } catch {
    // Range measurement is best-effort. Fall back to the containing element.
  }

  return target.element.getBoundingClientRect();
};

const getInspectableTargetBounds = (
  target: InspectableTarget,
  doc: Document,
): IterationElementBounds =>
  buildBoundsFromRect(getInspectableTargetRect(target, doc));

const getInspectableTargetDisplayText = (
  target: InspectableTarget,
  doc: Document,
  options: AccessibleNameOptions = {},
) => {
  if (target.kind === 'text') {
    return buildTextDisplayText(getTextNodeText(target.textNode));
  }

  return buildIterationElementDisplayText(target.element, doc, options);
};

const getInspectableTargetRole = (target: InspectableTarget) => {
  if (target.kind === 'text') {
    return 'text';
  }

  return inferRole(target.element);
};

const getInspectableTargetAccessibleName = (
  target: InspectableTarget,
  doc: Document,
) => {
  if (target.kind === 'text') {
    return getTextNodeText(target.textNode);
  }

  return getAccessibleName(target.element, doc);
};

const getInspectableTargetTextPreview = (target: InspectableTarget) => {
  if (target.kind === 'text') {
    return getTextNodeText(target.textNode);
  }

  return getNodeText(target.element);
};

const buildInspectableTargetSelection = (
  target: InspectableTarget,
  win: Window = window,
  doc: Document = document,
): IterationElementSelection => {
  const locator = buildIterationElementLocator(target.element, win, doc);

  return {
    displayText: getInspectableTargetDisplayText(target, doc, {
      includeTextFallback: true,
    }),
    element: {
      ...locator,
      role: getInspectableTargetRole(target),
      accessibleName: getInspectableTargetAccessibleName(target, doc),
      textPreview: getInspectableTargetTextPreview(target),
      bounds: getInspectableTargetBounds(target, doc),
    },
  };
};

const resolveComponentPath = (element: Element, win: Window) => {
  try {
    const selectionApi = win.__ARA_EMBEDDED_REACT_INSPECTOR_SELECTION__;
    const reactComponentPath =
      selectionApi?.getComponentPathForElement?.(element) ??
      selectionApi?.getReactComponentPathForElement?.(element);

    if (reactComponentPath === undefined) {
      return undefined;
    }

    const normalizedPath = reactComponentPath
      .map((segment) => segment.trim())
      .filter((segment) => segment.length > 0);

    return normalizedPath.length > 0 ? normalizedPath : undefined;
  } catch {
    return undefined;
  }
};

const buildSelectionComponentPathFields = (
  element: Element,
  win: Window,
): IterationElementComponentPathFields => {
  const componentPath = resolveComponentPath(element, win);

  if (componentPath === undefined) {
    return {};
  }

  return {
    componentPath,
    reactComponentPath: componentPath,
  };
};

const buildIterationElementLocator = (
  element: Element,
  win: Window = window,
  doc: Document = document,
): IterationElementLocator => ({
  urlPath: getUrlPath(win.location),
  cssSelector: buildCssSelector(element),
  domPath: buildDomPath(element),
  tagName: element.tagName.toLowerCase(),
  role: inferRole(element),
  accessibleName: getAccessibleName(element, doc),
  textPreview: getNodeText(element),
  id: normalizeWhitespace(element.id),
  dataTestId: getDataTestId(element),
  bounds: getBounds(element),
  scrollOffset: {
    x: roundMeasurement(win.scrollX),
    y: roundMeasurement(win.scrollY),
  },
  capturedAt: new Date().toISOString(),
  ...buildSelectionComponentPathFields(element, win),
});

export const buildIterationElementSelection = (
  element: Element,
  win: Window = window,
  doc: Document = document,
): IterationElementSelection => {
  const locator = buildIterationElementLocator(element, win, doc);

  return {
    displayText: buildIterationElementDisplayText(element, doc, {
      includeTextFallback: true,
    }),
    element: locator,
  };
};

const createOverlay = (doc: Document): OverlayElements => {
  const root = doc.createElement('div');
  root.id = OVERLAY_ROOT_ID;
  root.setAttribute('aria-hidden', 'true');
  root.style.position = 'fixed';
  root.style.inset = '0';
  root.style.pointerEvents = 'none';
  root.style.zIndex = OVERLAY_Z_INDEX;

  const createOverlayBox = (borderColor: string, backgroundColor: string) => {
    const box = doc.createElement('div');
    box.style.position = 'fixed';
    box.style.border = `2px solid ${borderColor}`;
    box.style.borderRadius = '8px';
    box.style.background = backgroundColor;
    box.style.display = 'none';
    return box;
  };

  const createOverlayLabel = (backgroundColor: string) => {
    const label = doc.createElement('div');
    label.style.position = 'fixed';
    label.style.maxWidth = '320px';
    label.style.padding = '6px 10px';
    label.style.borderRadius = '999px';
    label.style.background = backgroundColor;
    label.style.color = '#f8fafc';
    label.style.fontFamily =
      'ui-monospace, SFMono-Regular, SF Mono, Consolas, monospace';
    label.style.fontSize = '12px';
    label.style.lineHeight = '1';
    label.style.display = 'none';
    label.style.whiteSpace = 'nowrap';
    label.style.overflow = 'hidden';
    label.style.textOverflow = 'ellipsis';
    label.textContent = DEFAULT_LABEL;
    return label;
  };

  const selectedBox = createOverlayBox(
    SELECTED_OVERLAY_BORDER_COLOR,
    SELECTED_OVERLAY_BACKGROUND_COLOR,
  );
  const hoverBox = createOverlayBox(
    HOVER_OVERLAY_BORDER_COLOR,
    HOVER_OVERLAY_BACKGROUND_COLOR,
  );
  hoverBox.style.boxShadow = '0 0 0 9999px rgba(15, 23, 42, 0.12)';

  const selectedLabel = createOverlayLabel(SELECTED_LABEL_BACKGROUND_COLOR);
  const hoverLabel = createOverlayLabel(HOVER_LABEL_BACKGROUND_COLOR);

  root.append(selectedBox, hoverBox, selectedLabel, hoverLabel);
  doc.body.append(root);

  return { root, selectedBox, selectedLabel, hoverBox, hoverLabel };
};

const getOverlayKindElements = (
  overlay: OverlayElements,
  kind: 'selected' | 'hover',
) =>
  kind === 'selected'
    ? {
        box: overlay.selectedBox,
        label: overlay.selectedLabel,
      }
    : {
        box: overlay.hoverBox,
        label: overlay.hoverLabel,
      };

const updateOverlay = (
  overlay: OverlayElements,
  target: InspectableTarget,
  doc: Document,
  kind: 'selected' | 'hover',
) => {
  const rect = getInspectableTargetRect(target, doc);
  const displayText = getInspectableTargetDisplayText(target, doc, {
    includeTextFallback:
      target.kind === 'text'
        ? true
        : shouldUseTextFallbackForHoverLabel(target.element),
  });
  const overlayElements = getOverlayKindElements(overlay, kind);

  overlayElements.box.style.display = 'block';
  overlayElements.box.style.left = `${roundMeasurement(rect.left)}px`;
  overlayElements.box.style.top = `${roundMeasurement(rect.top)}px`;
  overlayElements.box.style.width = `${roundMeasurement(rect.width)}px`;
  overlayElements.box.style.height = `${roundMeasurement(rect.height)}px`;

  overlayElements.label.style.display = 'block';
  overlayElements.label.style.left = `${Math.max(roundMeasurement(rect.left), 8)}px`;
  overlayElements.label.style.top = `${Math.max(roundMeasurement(rect.top) - 36, 8)}px`;
  overlayElements.label.textContent = displayText;
};

const hideOverlay = (overlay: OverlayElements, kind: 'selected' | 'hover') => {
  const overlayElements = getOverlayKindElements(overlay, kind);

  overlayElements.box.style.display = 'none';
  overlayElements.label.style.display = 'none';
  overlayElements.label.textContent = DEFAULT_LABEL;
};

const isNodeWithinOverlay = (
  node: Node | null,
  overlay: OverlayElements | null,
) => {
  if (node === null || overlay === null) {
    return false;
  }

  return overlay.root.contains(node);
};

const isOverlayOnlyMutationRecord = (
  record: MutationRecord,
  overlay: OverlayElements | null,
) => {
  if (isNodeWithinOverlay(record.target, overlay)) {
    return true;
  }

  if (record.type !== 'childList') {
    return false;
  }

  const isRelevantNode = (node: Node | null) =>
    node !== null && !isNodeWithinOverlay(node, overlay);

  return !(
    Array.from(record.addedNodes).some(isRelevantNode) ||
    Array.from(record.removedNodes).some(isRelevantNode)
  );
};

const getInspectableTarget = (
  doc: Document,
  eventTarget: EventTarget | null,
  coordinates?: PointerCoordinates,
): InspectableTarget | null => {
  const pointElement =
    coordinates === undefined ? null : getElementAtPoint(doc, coordinates);
  const eventNode = eventTarget instanceof Node ? eventTarget : null;
  const shouldPreferEventNode =
    eventNode !== null &&
    pointElement !== null &&
    !pointElement.contains(eventNode) &&
    !eventNode.contains(pointElement);
  const preferredElement = getNearestInspectableElement(
    shouldPreferEventNode ? eventNode : pointElement ?? eventNode,
  );

  if (coordinates !== undefined) {
    const textTarget = shouldPreferEventNode
      ? null
      : getTextTargetAtPoint(doc, coordinates, pointElement);

    if (
      textTarget !== null &&
      (preferredElement === null ||
        !shouldPreferElementTargetOverText(preferredElement))
    ) {
      return textTarget;
    }
  }

  if (preferredElement !== null) {
    return {
      kind: 'element',
      element: preferredElement,
    } satisfies InspectableTarget;
  }

  return getInspectableTargetFromNode(eventNode ?? pointElement);
};

const getInspectableElementAtPoint = (
  doc: Document,
  coordinates: PointerCoordinates,
) => {
  const pointElement = getElementAtPoint(doc, coordinates);
  const preferredElement = getNearestInspectableElement(pointElement);
  const textTarget = getTextTargetAtPoint(doc, coordinates, pointElement);

  if (
    textTarget !== null &&
    (preferredElement === null ||
      !shouldPreferElementTargetOverText(preferredElement))
  ) {
    return textTarget;
  }

  if (preferredElement !== null) {
    return {
      kind: 'element',
      element: preferredElement,
    } satisfies InspectableTarget;
  }

  return getInspectableTargetFromNode(pointElement);
};

const didPointerMovePastTapThreshold = (
  origin: PointerCoordinates,
  next: PointerCoordinates,
) =>
  Math.hypot(next.clientX - origin.clientX, next.clientY - origin.clientY) >
  POINTER_TAP_MAX_DISTANCE_PX;

const targetMatchesSuppressedClick = (
  target: EventTarget | null,
  suppressedClickTarget: Element,
) => target instanceof Node && suppressedClickTarget.contains(target);

const getDebugElementSummary = (target: InspectableTarget) => ({
  tagName: target.element.tagName.toLowerCase(),
  id: normalizeWhitespace(target.element.getAttribute('id')),
  role: getInspectableTargetRole(target),
  displayText: getInspectableTargetDisplayText(
    target,
    target.element.ownerDocument ?? document,
    {
      includeTextFallback:
        target.kind === 'text'
          ? true
          : shouldUseTextFallbackForHoverLabel(target.element),
    },
  ),
  dataTestId: getDataTestId(target.element),
  disabled:
    target.element instanceof HTMLButtonElement ||
    target.element instanceof HTMLInputElement ||
    target.element instanceof HTMLSelectElement ||
    target.element instanceof HTMLTextAreaElement
      ? target.element.disabled
      : undefined,
});

const getDebugTargetSummary = (
  doc: Document,
  target: EventTarget | null,
  coordinates?: PointerCoordinates,
) => {
  const inspectableTarget = getInspectableTarget(doc, target, coordinates);

  if (inspectableTarget === null) {
    return null;
  }

  return getDebugElementSummary(inspectableTarget);
};

const preventInteraction = (event: Event) => {
  event.preventDefault();
  event.stopPropagation();
};

const inspectableTargetsAreEqual = (
  left: InspectableTarget | null,
  right: InspectableTarget | null,
) => {
  if (left === null || right === null) {
    return false;
  }

  if (left.kind !== right.kind || left.element !== right.element) {
    return false;
  }

  if (left.kind === 'text' && right.kind === 'text') {
    return left.textNode === right.textNode;
  }

  return true;
};

const PREVIEW_DIMENSION_FIELD_IDS = new Set([
  'width',
  'height',
  'minWidth',
  'minHeight',
  'maxWidth',
  'maxHeight',
  'flexBasis',
  'gap',
  'padding',
  'margin',
  'borderRadius',
  'fontSize',
  'borderWidth',
]);

const PREVIEW_STYLE_PROPERTY_BY_FIELD_ID = {
  alignItems: 'align-items',
  alignSelf: 'align-self',
  backgroundColor: 'background-color',
  borderColor: 'border-color',
  borderRadius: 'border-radius',
  borderStyle: 'border-style',
  borderWidth: 'border-width',
  boxShadow: 'box-shadow',
  display: 'display',
  flexBasis: 'flex-basis',
  flexDirection: 'flex-direction',
  flexGrow: 'flex-grow',
  flexShrink: 'flex-shrink',
  fontSize: 'font-size',
  fontWeight: 'font-weight',
  gap: 'gap',
  height: 'height',
  justifyContent: 'justify-content',
  margin: 'margin',
  maxHeight: 'max-height',
  maxWidth: 'max-width',
  minHeight: 'min-height',
  minWidth: 'min-width',
  opacity: 'opacity',
  padding: 'padding',
  textColor: 'color',
  width: 'width',
} as const satisfies Record<string, string>;

const escapeAttributeValue = (value: string) =>
  value.replaceAll(/\\/g, '\\\\').replaceAll(/"/g, '\\"');

const getComponentPathForComparison = (element: Element, win: Window) =>
  resolveComponentPath(element, win)?.join('>');

const getExpectedComponentPath = (locator: IterationElementLocator) =>
  locator.componentPath?.join('>') ?? locator.reactComponentPath?.join('>');

const buildElementIdentityKey = (element: Element) => {
  return [
    element.tagName.toLowerCase(),
    normalizeWhitespace(element.id) ?? '',
    getDataTestId(element) ?? '',
    buildDomPath(element),
  ].join('|');
};

const resolveElementByDomPath = (doc: Document, domPath: string) => {
  const segments = domPath
    .split('/')
    .map((segment) => segment.trim())
    .filter(Boolean);

  if (segments.length === 0) {
    return null;
  }

  const domPathPattern = /^([a-z0-9:-]+)\[(\d+)\]$/i;
  let current: Element | null = doc.documentElement;

  for (const [index, rawSegment] of segments.entries()) {
    const match = domPathPattern.exec(rawSegment);

    if (match === null) {
      return null;
    }

    const [, tagName, positionText] = match;
    const position = Number(positionText);

    if (!Number.isInteger(position) || position <= 0) {
      return null;
    }

    if (index === 0) {
      if (
        current === null ||
        current.tagName.toLowerCase() !== tagName.toLowerCase() ||
        position !== 1
      ) {
        return null;
      }

      continue;
    }

    if (current === null) {
      return null;
    }

    const matches: Element[] = Array.from(current.children).filter(
      (child) => child.tagName.toLowerCase() === tagName.toLowerCase(),
    );
    current = matches[position - 1] ?? null;
  }

  return current;
};

const elementMatchesPreviewLocator = (
  element: Element,
  locator: IterationElementLocator,
  win: Window,
) => {
  if (element.tagName.toLowerCase() !== locator.tagName.toLowerCase()) {
    return false;
  }

  if (
    locator.id !== null &&
    normalizeWhitespace(element.getAttribute('id')) !== locator.id
  ) {
    return false;
  }

  if (
    locator.dataTestId !== null &&
    getDataTestId(element) !== locator.dataTestId
  ) {
    return false;
  }

  if (buildDomPath(element) !== locator.domPath) {
    return false;
  }

  const expectedComponentPath = getExpectedComponentPath(locator);

  if (
    expectedComponentPath !== undefined &&
    getComponentPathForComparison(element, win) !== expectedComponentPath
  ) {
    return false;
  }

  try {
    return (
      locator.cssSelector.length === 0 || element.matches(locator.cssSelector)
    );
  } catch {
    return false;
  }
};

const resolvePreviewTargetElement = (
  locator: IterationElementLocator,
  doc: Document,
  win: Window,
): PreviewTargetResolution => {
  if (locator.urlPath !== getUrlPath(win.location)) {
    return {
      code: 'url_mismatch',
      message: 'Preview target belongs to a different page.',
    } as const;
  }

  const candidates: Element[] = [];
  const seenCandidates = new Set<string>();

  const addCandidate = (element: Element | null | undefined) => {
    if (element === null || element === undefined) {
      return;
    }

    const identityKey = buildElementIdentityKey(element);

    if (seenCandidates.has(identityKey)) {
      return;
    }

    seenCandidates.add(identityKey);
    candidates.push(element);
  };

  if (locator.id !== null) {
    addCandidate(doc.getElementById(locator.id));
  }

  if (locator.dataTestId !== null) {
    const selector = [
      `[data-testid="${escapeAttributeValue(locator.dataTestId)}"]`,
      `[data-test-id="${escapeAttributeValue(locator.dataTestId)}"]`,
      `[data-cy="${escapeAttributeValue(locator.dataTestId)}"]`,
    ].join(',');

    try {
      for (const match of Array.from(doc.querySelectorAll(selector))) {
        addCandidate(match);
      }
    } catch {
      // Ignore malformed selector fallback paths.
    }
  }

  addCandidate(resolveElementByDomPath(doc, locator.domPath));

  try {
    for (const match of Array.from(doc.querySelectorAll(locator.cssSelector))) {
      addCandidate(match);
    }
  } catch {
    // Ignore malformed selector fallback paths.
  }

  const expectedComponentPath = getExpectedComponentPath(locator);

  if (expectedComponentPath !== undefined) {
    for (const candidate of Array.from(doc.querySelectorAll(locator.tagName))) {
      if (
        getComponentPathForComparison(candidate, win) === expectedComponentPath
      ) {
        addCandidate(candidate);
      }
    }
  }

  for (const candidate of candidates) {
    if (elementMatchesPreviewLocator(candidate, locator, win)) {
      return {
        element: candidate,
      } as const;
    }
  }

  return {
    code: 'locator_not_found',
    message: 'Preview target could not be resolved in the current DOM.',
  } as const;
};

const normalizePreviewStyleValue = (fieldId: string, value: string) => {
  const trimmedValue = value.trim();

  if (trimmedValue.length === 0) {
    return null;
  }

  if (
    PREVIEW_DIMENSION_FIELD_IDS.has(fieldId) &&
    /^-?\d+(\.\d+)?$/.test(trimmedValue)
  ) {
    return `${trimmedValue}px`;
  }

  return trimmedValue;
};

const createPreviewPatchSession = (): PreviewPatchSession => {
  const restorers = new Map<string, () => void>();
  let nextElementId = 0;
  const elementIds = new WeakMap<Element, number>();

  const getElementId = (element: Element) => {
    const currentId = elementIds.get(element);

    if (currentId !== undefined) {
      return currentId;
    }

    const nextId = nextElementId;
    nextElementId += 1;
    elementIds.set(element, nextId);
    return nextId;
  };

  const recordRestore = (element: Element, key: string, restore: () => void) => {
    const restoreKey = `${getElementId(element)}:${key}`;

    if (!restorers.has(restoreKey)) {
      restorers.set(restoreKey, restore);
    }
  };

  return {
    recordAttribute: (element, attributeName, value) => {
      const previousValue = element.getAttribute(attributeName);
      recordRestore(element, `attr:${attributeName}`, () => {
        if (previousValue === null) {
          element.removeAttribute(attributeName);
          return;
        }

        element.setAttribute(attributeName, previousValue);
      });

      if (value === null) {
        element.removeAttribute(attributeName);
        return;
      }

      element.setAttribute(attributeName, value);
    },
    recordStyle: (element, propertyName, value) => {
      const previousValue = element.style.getPropertyValue(propertyName);
      const previousPriority = element.style.getPropertyPriority(propertyName);
      recordRestore(element, `style:${propertyName}`, () => {
        if (previousValue.length === 0 && previousPriority.length === 0) {
          element.style.removeProperty(propertyName);
          return;
        }

        element.style.setProperty(propertyName, previousValue, previousPriority);
      });

      if (value === null) {
        element.style.removeProperty(propertyName);
        return;
      }

      element.style.setProperty(propertyName, value);
    },
    recordTextContent: (element, value) => {
      const previousValue = element.textContent;
      recordRestore(element, 'textContent', () => {
        element.textContent = previousValue;
      });
      element.textContent = value;
    },
    clear: () => {
      for (const restore of Array.from(restorers.values()).reverse()) {
        restore();
      }

      restorers.clear();
    },
  };
};

const applyPreviewOperation = (
  element: Element,
  operation: IterationPreviewTargetEdit['operations'][number],
  previewSession: PreviewPatchRegistrar,
) => {
  const trimmedValue = operation.value.trim();

  if (trimmedValue.length === 0) {
    return {
      code: 'invalid_value',
      message: 'Preview edit value must be non-empty.',
    } as const;
  }

  if (operation.fieldId === 'textContent') {
    previewSession.recordTextContent(element, operation.value);
    return null;
  }

  if (operation.fieldId === 'assetReference') {
    if (
      element instanceof HTMLImageElement ||
      element instanceof HTMLSourceElement ||
      element instanceof HTMLIFrameElement ||
      element instanceof HTMLVideoElement ||
      element instanceof HTMLAudioElement
    ) {
      previewSession.recordAttribute(element, 'src', operation.value);
      return null;
    }

    if (element instanceof HTMLElement) {
      previewSession.recordStyle(
        element,
        'background-image',
        `url("${operation.value.replaceAll('"', '\\"')}")`,
      );
      return null;
    }

    return {
      code: 'unsupported_target',
      message: 'Preview asset swaps are not supported for this target.',
    } as const;
  }

  const stylePropertyName =
    PREVIEW_STYLE_PROPERTY_BY_FIELD_ID[
      operation.fieldId as keyof typeof PREVIEW_STYLE_PROPERTY_BY_FIELD_ID
    ];

  if (stylePropertyName === undefined) {
    return {
      code: 'unsupported_field',
      message: `Preview edits do not support field "${operation.fieldId}" yet.`,
    } as const;
  }

  if (!(element instanceof HTMLElement)) {
    return {
      code: 'unsupported_target',
      message: 'Preview style edits require an HTMLElement target.',
    } as const;
  }

  const normalizedStyleValue = normalizePreviewStyleValue(
    operation.fieldId,
    operation.value,
  );

  if (normalizedStyleValue === null) {
    return {
      code: 'invalid_value',
      message: `Preview edits require a non-empty value for "${operation.fieldId}".`,
    } as const;
  }

  previewSession.recordStyle(element, stylePropertyName, normalizedStyleValue);
  return null;
};

export const createIterationInspectorRuntime = ({
  allowSelfMessaging = false,
  win = window,
  doc = document,
}: CreateIterationInspectorRuntimeArgs = {}): IterationInspectorRuntime => {
  let active = false;
  let started = false;
  let currentHover: InspectableTarget | null = null;
  let currentSelected: InspectableTarget | null = null;
  let overlay: OverlayElements | null = null;
  let hasParentOrigin = false;
  let parentOrigin: string | null = null;
  let lastPointerPosition: PointerCoordinates | null = null;
  let pendingPointerSelection: PendingPointerSelection | null = null;
  let suppressedClickTarget: Element | null = null;
  let debugEnabled = false;
  let debugSessionId: string | null = null;
  let detachObserver: MutationObserver | null = null;
  let removePatchedHistoryListeners: (() => void) | null = null;
  let hasLoggedIgnoredOverlayMutation = false;
  let selectionMode: IterationInspectorSelectionMode = 'single';
  let previewPatchSession: PreviewPatchSession | null = null;
  const canPostToParent = allowSelfMessaging || win.parent !== win;

  type IterationInspectorDebugLogInput =
    | IterationInspectorDebugDetails
    | (() => IterationInspectorDebugDetails);

  const emit = (message: IterationInspectorRuntimeMessage) => {
    if (!canPostToParent) {
      return;
    }

    win.parent.postMessage(message, parentOrigin ?? '*');
  };

  const emitDebugLog = (
    event: string,
    details: IterationInspectorDebugLogInput = {},
  ) => {
    if (!debugEnabled) {
      return;
    }

    const resolvedDetails = typeof details === 'function' ? details() : details;

    try {
      console.debug('[itera/iteration-inspector/runtime]', {
        sessionId: debugSessionId ?? undefined,
        event,
        ...resolvedDetails,
      });
    } catch {
      // Debug logging failures must not affect runtime behavior.
    }

    emit({
      channel: ITERATION_INSPECTOR_CHANNEL,
      kind: 'debug_log',
      event,
      sessionId: debugSessionId ?? undefined,
      details: resolvedDetails,
    });
  };

  const updateDebugConfig = (message: {
    debugEnabled?: boolean;
    debugSessionId?: string;
  }) => {
    if (!message.debugEnabled) {
      return;
    }

    const wasDebugEnabled = debugEnabled;

    debugEnabled = true;
    debugSessionId =
      typeof message.debugSessionId === 'string' &&
      message.debugSessionId.length > 0
        ? message.debugSessionId
        : debugSessionId;

    if (!wasDebugEnabled) {
      emitDebugLog('debug_enabled', {
        urlPath: getUrlPath(win.location),
      });
    }
  };

  const ensureOverlay = () => {
    if (overlay !== null) {
      return overlay;
    }

    overlay = createOverlay(doc);
    return overlay;
  };

  const clearHover = () => {
    const previousHover = currentHover;
    currentHover = null;

    if (overlay !== null) {
      hideOverlay(overlay, 'hover');
    }

    if (previousHover !== null) {
      emitDebugLog('hover_cleared', () => ({
        target: getDebugElementSummary(previousHover),
      }));
    }
  };

  const updateHover = (target: InspectableTarget) => {
    const hoverChanged =
      currentHover?.kind !== target.kind ||
      currentHover.element !== target.element ||
      (currentHover.kind === 'text' &&
        target.kind === 'text' &&
        currentHover.textNode !== target.textNode);
    currentHover = target;

    const nextOverlay = ensureOverlay();

    if (inspectableTargetsAreEqual(currentSelected, target)) {
      hideOverlay(nextOverlay, 'hover');
    } else {
      updateOverlay(nextOverlay, target, doc, 'hover');
    }

    if (hoverChanged) {
      emitDebugLog('hover_target_changed', () => ({
        target: getDebugElementSummary(target),
      }));
    }
  };

  const updateHoverFromLastPointerPosition = () => {
    if (!active || lastPointerPosition === null) {
      return;
    }

    const nextHover = getInspectableElementAtPoint(doc, lastPointerPosition);

    if (nextHover === null) {
      clearHover();
      return;
    }

    updateHover(nextHover);
  };

  const clearSelected = () => {
    currentSelected = null;

    if (overlay !== null) {
      hideOverlay(overlay, 'selected');
    }
  };

  const updateSelected = (target: InspectableTarget) => {
    currentSelected = target;
    const nextOverlay = ensureOverlay();

    updateOverlay(nextOverlay, target, doc, 'selected');

    if (inspectableTargetsAreEqual(currentHover, target)) {
      hideOverlay(nextOverlay, 'hover');
    }
  };

  const clearPendingSelectionState = (
    reason: RuntimeLifecycleReason = 'command',
  ) => {
    pendingPointerSelection = null;

    if (reason !== 'selection') {
      suppressedClickTarget = null;
    }
  };

  const clearPreviewEdits = () => {
    previewPatchSession?.clear();
    previewPatchSession = null;
    handleScrollOrResize();
  };

  const emitPreviewEditsStatus = (
    revision: number,
    result: PreviewPatchResult,
  ) => {
    emit({
      channel: ITERATION_INSPECTOR_CHANNEL,
      kind: 'preview_edits_status',
      revision,
      appliedTargetCount: result.appliedTargetCount,
      ...(result.errors.length > 0 ? { errors: result.errors } : {}),
    });
  };

  const syncPreviewEdits = (
    revision: number,
    targets: ReadonlyArray<IterationPreviewTargetEdit>,
  ) => {
    clearPreviewEdits();
    const nextPreviewPatchSession = createPreviewPatchSession();
    const result: PreviewPatchResult = {
      appliedTargetCount: 0,
      errors: [],
    };

    for (const [targetIndex, targetEdit] of targets.entries()) {
      const resolution = resolvePreviewTargetElement(targetEdit.locator, doc, win);

      if ('code' in resolution) {
        result.errors.push({
          code: resolution.code,
          message: resolution.message,
          targetIndex,
        });
        continue;
      }

      let targetApplied = false;

      for (const operation of targetEdit.operations) {
        const operationError = applyPreviewOperation(
          resolution.element,
          operation,
          nextPreviewPatchSession,
        );

        if (operationError !== null) {
          result.errors.push({
            code: operationError.code,
            message: operationError.message,
            targetIndex,
            fieldId: operation.fieldId,
          });
          continue;
        }

        targetApplied = true;
      }

      if (targetApplied) {
        result.appliedTargetCount += 1;
      }
    }

    previewPatchSession = nextPreviewPatchSession;
    handleScrollOrResize();
    emitPreviewEditsStatus(revision, result);
  };

  const emitSelection = (
    target: InspectableTarget,
    event: Event,
    options: {
      suppressFollowUpClick?: boolean;
      source: SelectionSource;
    },
  ) => {
    preventInteraction(event);
    currentHover = target;
    updateSelected(target);
    const selection = buildInspectableTargetSelection(target, win, doc);

    emit({
      channel: ITERATION_INSPECTOR_CHANNEL,
      kind: 'element_selected',
      selection,
    });

    suppressedClickTarget = options.suppressFollowUpClick
      ? target.element
      : null;
    emitDebugLog('selection_emitted', () => ({
      source: options.source,
      suppressFollowUpClick: options.suppressFollowUpClick === true,
      selectionMode,
      selectionDisplayText: selection.displayText,
      target: getDebugElementSummary(target),
    }));

    if (selectionMode === 'single') {
      setActive(false, 'selection');
    }
  };

  const clearHoverWithInvalidation = (
    reason: IterationInspectorInvalidationReason,
  ) => {
    clearHover();
    clearSelected();
    emit({
      channel: ITERATION_INSPECTOR_CHANNEL,
      kind: 'selection_invalidated',
      reason,
    });
  };

  const setActive = (
    nextActive: boolean,
    reason: RuntimeLifecycleReason = 'command',
  ) => {
    if (active === nextActive) {
      if (!active) {
        clearHover();
      }
      return;
    }

    active = nextActive;
    clearPendingSelectionState(reason);
    hasLoggedIgnoredOverlayMutation = false;

    if (!active) {
      selectionMode = 'single';
    }

    if (active) {
      ensureOverlay();
      if (currentSelected !== null) {
        updateSelected(currentSelected);
      }
      updateHoverFromLastPointerPosition();
      emitDebugLog('mode_changed', {
        active: true,
        reason,
      });
      emit({
        channel: ITERATION_INSPECTOR_CHANNEL,
        kind: 'mode_changed',
        active: true,
      });
      return;
    }

    clearHover();
    if (overlay !== null) {
      hideOverlay(overlay, 'selected');
    }
    emitDebugLog('mode_changed', {
      active: false,
      reason,
    });

    if (reason !== 'reload') {
      emit({
        channel: ITERATION_INSPECTOR_CHANNEL,
        kind: 'mode_changed',
        active: false,
      });
    }
  };

  const handleNodeDetached = () => {
    if (!active) {
      return;
    }

    if (currentSelected !== null) {
      const selectedIsConnected =
        currentSelected.element.isConnected &&
        (currentSelected.kind !== 'text' || currentSelected.textNode.isConnected);

      if (!selectedIsConnected) {
        clearHoverWithInvalidation('node_detached');
        return;
      }

      if (overlay !== null) {
        updateOverlay(overlay, currentSelected, doc, 'selected');
      }
    }

    if (currentHover === null) {
      return;
    }

    const hoverIsConnected =
      currentHover.element.isConnected &&
      (currentHover.kind !== 'text' || currentHover.textNode.isConnected);

    if (hoverIsConnected) {
      if (overlay !== null) {
        if (!inspectableTargetsAreEqual(currentSelected, currentHover)) {
          updateOverlay(overlay, currentHover, doc, 'hover');
        }
      }
      return;
    }

    clearHover();
  };

  const handleRouteChange = () => {
    clearPreviewEdits();

    if (!active) {
      return;
    }

    clearHoverWithInvalidation('route_change');
    setActive(false, 'route_change');
  };

  const patchHistory = () => {
    const originalPushState = win.history.pushState.bind(win.history);
    const originalReplaceState = win.history.replaceState.bind(win.history);

    const wrapHistoryMethod =
      (
        originalMethod: History['pushState'] | History['replaceState'],
      ): History['pushState'] =>
      (...args) => {
        const previousPath = getUrlPath(win.location);
        const result = originalMethod(...args);

        if (getUrlPath(win.location) !== previousPath) {
          handleRouteChange();
        }

        return result;
      };

    win.history.pushState = wrapHistoryMethod(originalPushState);
    win.history.replaceState = wrapHistoryMethod(originalReplaceState);

    const handlePopState = () => {
      handleRouteChange();
    };

    const handleHashChange = () => {
      handleRouteChange();
    };

    win.addEventListener('popstate', handlePopState);
    win.addEventListener('hashchange', handleHashChange);

    return () => {
      win.history.pushState = originalPushState;
      win.history.replaceState = originalReplaceState;
      win.removeEventListener('popstate', handlePopState);
      win.removeEventListener('hashchange', handleHashChange);
    };
  };

  const handleMessage = (event: MessageEvent) => {
    if (!isIterationInspectorParentMessage(event.data)) {
      return;
    }

    if (
      event.source !== win.parent &&
      (!allowSelfMessaging || event.source !== win)
    ) {
      return;
    }

    const nextParentOrigin = event.origin === 'null' ? null : event.origin;

    if (hasParentOrigin && nextParentOrigin !== parentOrigin) {
      return;
    }

    parentOrigin = nextParentOrigin;
    hasParentOrigin = true;
    updateDebugConfig(event.data);
    emitDebugLog('command_received', {
      kind: event.data.kind,
      origin: event.origin,
      urlPath: getUrlPath(win.location),
    });

    if (event.data.kind === 'enter_select_mode') {
      selectionMode = event.data.selectionMode ?? 'single';
      setActive(true);
      return;
    }

    if (event.data.kind === 'exit_select_mode') {
      setActive(false);
      return;
    }

    if (event.data.kind === 'sync_preview_edits') {
      syncPreviewEdits(event.data.revision, event.data.targets);
      return;
    }

    if (event.data.kind === 'clear_preview_edits') {
      clearPreviewEdits();
      emitPreviewEditsStatus(event.data.revision, {
        appliedTargetCount: 0,
        errors: [],
      });
      return;
    }

    clearSelected();
    clearHover();
  };

  const handlePointerMove = (event: PointerEvent) => {
    lastPointerPosition = {
      clientX: event.clientX,
      clientY: event.clientY,
    };

    if (
      pendingPointerSelection !== null &&
      pendingPointerSelection.pointerId === event.pointerId &&
      didPointerMovePastTapThreshold(
        pendingPointerSelection.origin,
        lastPointerPosition,
      )
    ) {
      pendingPointerSelection = null;
    }

    if (!active) {
      return;
    }

    const nextHover = getInspectableTarget(
      doc,
      event.target,
      lastPointerPosition,
    );

    if (nextHover === null) {
      clearHover();
      return;
    }

    updateHover(nextHover);
  };

  const handlePointerDown = (event: PointerEvent) => {
    lastPointerPosition = {
      clientX: event.clientX,
      clientY: event.clientY,
    };
    suppressedClickTarget = null;

    if (!active) {
      return;
    }

    emitDebugLog('pointer_down_received', () => ({
      button: event.button,
      pointerId: event.pointerId,
      target: getDebugTargetSummary(doc, event.target, {
        clientX: event.clientX,
        clientY: event.clientY,
      }),
    }));

    if (event.button !== 0) {
      pendingPointerSelection = null;
      emitDebugLog('pointer_down_ignored', () => ({
        reason: 'non_primary_button',
        button: event.button,
        target: getDebugTargetSummary(doc, event.target, {
          clientX: event.clientX,
          clientY: event.clientY,
        }),
      }));
      return;
    }

    pendingPointerSelection = {
      pointerId: event.pointerId,
      origin: lastPointerPosition,
    };
  };

  const handlePointerUp = (event: PointerEvent) => {
    lastPointerPosition = {
      clientX: event.clientX,
      clientY: event.clientY,
    };

    if (!active) {
      pendingPointerSelection = null;
      emitDebugLog('pointer_up_ignored', {
        reason: 'inactive',
        button: event.button,
        pointerId: event.pointerId,
      });
      return;
    }

    emitDebugLog('pointer_up_received', () => ({
      button: event.button,
      pointerId: event.pointerId,
      target: getDebugTargetSummary(doc, event.target, {
        clientX: event.clientX,
        clientY: event.clientY,
      }),
    }));

    const currentPendingPointerSelection = pendingPointerSelection;
    const matchesPendingPointer =
      currentPendingPointerSelection !== null &&
      currentPendingPointerSelection.pointerId === event.pointerId;
    const pointerMoved =
      matchesPendingPointer &&
      didPointerMovePastTapThreshold(
        currentPendingPointerSelection.origin,
        lastPointerPosition,
      );

    pendingPointerSelection = null;

    if (!matchesPendingPointer || pointerMoved) {
      emitDebugLog('pointer_up_ignored', {
        reason: !matchesPendingPointer
          ? 'missing_pending_selection'
          : 'pointer_moved',
        button: event.button,
        pointerId: event.pointerId,
      });
      return;
    }

    if (event.button !== 0) {
      emitDebugLog('pointer_up_ignored', {
        reason: 'non_primary_button',
        button: event.button,
        pointerId: event.pointerId,
      });
      return;
    }

    const target =
      getInspectableTarget(doc, event.target, lastPointerPosition) ??
      getInspectableElementAtPoint(doc, lastPointerPosition) ??
      currentHover;

    if (target === null) {
      emitDebugLog('pointer_up_ignored', {
        reason: 'no_target',
        button: event.button,
        pointerId: event.pointerId,
      });
      clearHover();
      return;
    }

    emitSelection(target, event, {
      suppressFollowUpClick: true,
      source: 'pointerup',
    });
  };

  const handlePointerCancel = () => {
    pendingPointerSelection = null;
  };

  const handleScrollOrResize = () => {
    if (!active) {
      return;
    }

    if (
      currentSelected !== null &&
      (!currentSelected.element.isConnected ||
        (currentSelected.kind === 'text' && !currentSelected.textNode.isConnected))
    ) {
      clearHoverWithInvalidation('node_detached');
      return;
    }

    if (
      currentHover !== null &&
      (!currentHover.element.isConnected ||
        (currentHover.kind === 'text' && !currentHover.textNode.isConnected))
    ) {
      clearHover();
    }

    if (lastPointerPosition !== null) {
      if (overlay !== null && currentSelected !== null) {
        updateOverlay(overlay, currentSelected, doc, 'selected');
      }

      updateHoverFromLastPointerPosition();
      return;
    }

    if (overlay === null) {
      return;
    }

    if (currentSelected !== null) {
      updateOverlay(overlay, currentSelected, doc, 'selected');
    }

    if (
      currentHover !== null &&
      !inspectableTargetsAreEqual(currentSelected, currentHover)
    ) {
      updateOverlay(overlay, currentHover, doc, 'hover');
      return;
    }

    hideOverlay(overlay, 'hover');
  };

  const handleClick = (event: MouseEvent) => {
    if (
      suppressedClickTarget !== null &&
      targetMatchesSuppressedClick(event.target, suppressedClickTarget)
    ) {
      const targetToSuppress = suppressedClickTarget;

      emitDebugLog('follow_up_click_suppressed', () => ({
        target: getDebugElementSummary({
          kind: 'element',
          element: targetToSuppress,
        }),
      }));
      preventInteraction(event);
      suppressedClickTarget = null;
      return;
    }

    suppressedClickTarget = null;

    if (!active) {
      return;
    }

    const target =
      getInspectableTarget(doc, event.target, {
        clientX: event.clientX,
        clientY: event.clientY,
      }) ?? currentHover;

    if (target === null) {
      emitDebugLog('click_selection_ignored', {
        reason: 'no_target',
      });
      clearHover();
      return;
    }

    emitSelection(target, event, {
      source: 'click',
    });
  };

  const handleBeforeUnload = () => {
    clearPreviewEdits();

    if (!active) {
      return;
    }

    clearHoverWithInvalidation('reload');
    setActive(false, 'reload');
  };

  return {
    start: () => {
      if (started) {
        return;
      }

      started = true;
      removePatchedHistoryListeners = patchHistory();
      doc.addEventListener('pointermove', handlePointerMove, true);
      doc.addEventListener('pointerdown', handlePointerDown, true);
      doc.addEventListener('pointerup', handlePointerUp, true);
      doc.addEventListener('pointercancel', handlePointerCancel, true);
      doc.addEventListener('click', handleClick, true);
      win.addEventListener('message', handleMessage);
      win.addEventListener('scroll', handleScrollOrResize, true);
      win.addEventListener('resize', handleScrollOrResize);
      win.addEventListener('pagehide', handleBeforeUnload);
      win.addEventListener('beforeunload', handleBeforeUnload);

      detachObserver = new MutationObserver((records) => {
        if (currentHover === null && currentSelected === null) {
          return;
        }

        if (
          records.every((record) =>
            isOverlayOnlyMutationRecord(record, overlay),
          )
        ) {
          if (!hasLoggedIgnoredOverlayMutation) {
            emitDebugLog('mutation_ignored', {
              reason: 'overlay_only',
            });
            hasLoggedIgnoredOverlayMutation = true;
          }

          return;
        }

        handleNodeDetached();
      });
      detachObserver.observe(doc.body, {
        childList: true,
        subtree: true,
        attributes: true,
      });

      emit({
        channel: ITERATION_INSPECTOR_CHANNEL,
        kind: 'runtime_ready',
        urlPath: getUrlPath(win.location),
        capabilities: [...iterationInspectorRuntimeCapabilities],
      });
    },
    stop: () => {
      if (!started) {
        return;
      }

      started = false;
      active = false;
      hasParentOrigin = false;
      parentOrigin = null;
      debugEnabled = false;
      debugSessionId = null;
      clearPreviewEdits();
      clearPendingSelectionState();
      clearHover();
      removePatchedHistoryListeners?.();
      removePatchedHistoryListeners = null;
      detachObserver?.disconnect();
      detachObserver = null;
      doc.removeEventListener('pointermove', handlePointerMove, true);
      doc.removeEventListener('pointerdown', handlePointerDown, true);
      doc.removeEventListener('pointerup', handlePointerUp, true);
      doc.removeEventListener('pointercancel', handlePointerCancel, true);
      doc.removeEventListener('click', handleClick, true);
      win.removeEventListener('message', handleMessage);
      win.removeEventListener('scroll', handleScrollOrResize, true);
      win.removeEventListener('resize', handleScrollOrResize);
      win.removeEventListener('pagehide', handleBeforeUnload);
      win.removeEventListener('beforeunload', handleBeforeUnload);

      if (overlay !== null) {
        overlay.root.remove();
        overlay = null;
      }
    },
    isActive: () => active,
  };
};

export const bootIterationInspectorRuntime = (
  args: Omit<CreateIterationInspectorRuntimeArgs, 'win' | 'doc'> = {},
) => {
  if (!args.allowSelfMessaging && window.parent === window) {
    return null;
  }

  if (window.__ITERA_ITERATION_INSPECTOR_RUNTIME__ !== undefined) {
    return window.__ITERA_ITERATION_INSPECTOR_RUNTIME__;
  }

  const runtime = createIterationInspectorRuntime(args);
  runtime.start();
  window.__ITERA_ITERATION_INSPECTOR_RUNTIME__ = runtime;

  return runtime;
};
