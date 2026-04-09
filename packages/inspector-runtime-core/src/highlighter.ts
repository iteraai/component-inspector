const HIGHLIGHT_OVERLAY_ATTRIBUTE = 'data-itera-inspector-highlight';

const toPx = (value: number) => `${Math.max(0, value)}px`;

const createOverlay = (): HTMLDivElement => {
  const overlay = document.createElement('div');
  overlay.setAttribute(HIGHLIGHT_OVERLAY_ATTRIBUTE, 'true');
  overlay.style.position = 'fixed';
  overlay.style.pointerEvents = 'none';
  overlay.style.boxSizing = 'border-box';
  overlay.style.border = '2px solid #2563eb';
  overlay.style.background = 'rgba(37, 99, 235, 0.1)';
  overlay.style.borderRadius = '4px';
  overlay.style.zIndex = '2147483647';
  overlay.style.display = 'none';

  return overlay;
};

export const createInspectorHighlighter = () => {
  let overlay: HTMLDivElement | undefined;

  const ensureOverlay = () => {
    if (overlay !== undefined) {
      return overlay;
    }

    overlay = createOverlay();
    document.body.append(overlay);

    return overlay;
  };

  const clearHighlight = () => {
    if (overlay === undefined) {
      return;
    }

    overlay.style.display = 'none';
  };

  const highlightElement = (element: Element) => {
    const targetRect = element.getBoundingClientRect();
    const activeOverlay = ensureOverlay();
    activeOverlay.style.left = toPx(targetRect.left);
    activeOverlay.style.top = toPx(targetRect.top);
    activeOverlay.style.width = toPx(targetRect.width);
    activeOverlay.style.height = toPx(targetRect.height);
    activeOverlay.style.display = 'block';
  };

  const destroy = () => {
    if (overlay === undefined) {
      return;
    }

    overlay.remove();
    overlay = undefined;
  };

  return {
    clearHighlight,
    highlightElement,
    destroy,
  };
};

export const inspectorHighlightOverlaySelector =
  '[data-itera-inspector-highlight="true"]';
