import { given } from '#test/givenWhenThen';
import {
  ITERATION_INSPECTOR_CHANNEL,
  IterationInspectorRuntimeMessage,
} from './types';
import {
  buildIterationElementSelection,
  createIterationInspectorRuntime,
} from './runtime';

const getPostedMessages = (spy: ReturnType<typeof vi.spyOn>) =>
  spy.mock.calls
    .map(([message]) => message)
    .filter(
      (
        message,
      ): message is IterationInspectorRuntimeMessage & {
        channel: typeof ITERATION_INSPECTOR_CHANNEL;
      } =>
        typeof message === 'object' &&
        message !== null &&
        'channel' in message &&
        message.channel === ITERATION_INSPECTOR_CHANNEL,
    );

const getPostedDebugLogMessages = (spy: ReturnType<typeof vi.spyOn>) =>
  getPostedMessages(spy).filter(
    (
      message,
    ): message is Extract<
      IterationInspectorRuntimeMessage,
      {
        kind: 'debug_log';
      }
    > => message.kind === 'debug_log',
  );

const dispatchPointerEvent = (
  target: EventTarget,
  type: string,
  options: MouseEventInit & { pointerId?: number } = {},
) => {
  const event = new MouseEvent(type, {
    bubbles: true,
    cancelable: true,
    ...options,
  });

  Object.defineProperty(event, 'pointerId', {
    value: options.pointerId ?? 1,
    configurable: true,
  });

  target.dispatchEvent(event);
  return event;
};

const enterSelectMode = () => {
  window.dispatchEvent(
    new MessageEvent('message', {
      data: {
        channel: ITERATION_INSPECTOR_CHANNEL,
        kind: 'enter_select_mode',
      },
      origin: 'https://itera.example',
      source: window,
    }),
  );
};

const enterPersistentSelectMode = () => {
  window.dispatchEvent(
    new MessageEvent('message', {
      data: {
        channel: ITERATION_INSPECTOR_CHANNEL,
        kind: 'enter_select_mode',
        selectionMode: 'persistent',
      },
      origin: 'https://itera.example',
      source: window,
    }),
  );
};

const enterSelectModeWithDebugLogging = () => {
  window.dispatchEvent(
    new MessageEvent('message', {
      data: {
        channel: ITERATION_INSPECTOR_CHANNEL,
        kind: 'enter_select_mode',
        debugEnabled: true,
        debugSessionId: 'selection-debug-session',
      },
      origin: 'https://itera.example',
      source: window,
    }),
  );
};

type MockRect = {
  top: number;
  left: number;
  width: number;
  height: number;
  right: number;
  bottom: number;
  x: number;
  y: number;
};

type RuntimeContext = {
  runtime: ReturnType<typeof createIterationInspectorRuntime>;
};

type HoverAlignmentContext = RuntimeContext & {
  primaryButton: HTMLElement;
  secondaryButton: HTMLElement;
  setHoveredElement: (element: Element) => void;
};

type ContainerHoverContext = RuntimeContext & {
  container: HTMLDivElement;
  postMessageSpy: ReturnType<typeof vi.spyOn>;
};

type OverlayMutationContext = RuntimeContext & {
  button: HTMLElement;
  sibling: HTMLDivElement;
  getBoundingClientRectSpy: ReturnType<typeof vi.spyOn>;
  postMessageSpy: ReturnType<typeof vi.spyOn>;
};

type OverlayOnlyMutationContext = RuntimeContext & {
  button: HTMLElement;
  getBoundingClientRectSpy: ReturnType<typeof vi.spyOn>;
  postMessageSpy: ReturnType<typeof vi.spyOn>;
  deliverMutation: (records: MutationRecord[]) => void;
  cleanup: () => void;
};

type SelectionContext = RuntimeContext & {
  button: HTMLElement;
  postMessageSpy: ReturnType<typeof vi.spyOn>;
};

type DebugSelectionContext = SelectionContext & {
  consoleDebugSpy: ReturnType<typeof vi.spyOn>;
};

type PointerSelectionContext = SelectionContext & {
  pointerDownEvent: MouseEvent;
  pointerUpEvent: MouseEvent;
};

type ClickSelectionContext = SelectionContext & {
  selectionClickEvent: MouseEvent;
  selectionClickResult: boolean;
  followUpClickEvent?: MouseEvent;
  followUpClickResult?: boolean;
};

type TextSelectionContext = RuntimeContext & {
  container: HTMLDivElement;
  label: HTMLSpanElement;
  postMessageSpy: ReturnType<typeof vi.spyOn>;
  cleanup: () => void;
  setPointElement: (element: Element) => void;
};

type TextHitTargetOptions = {
  api?: 'caretPositionFromPoint' | 'caretRangeFromPoint';
  assertDocumentContext?: boolean;
};

const mockElementRect = (element: Element, rect: MockRect) => {
  vi.spyOn(element, 'getBoundingClientRect').mockReturnValue({
    ...rect,
    toJSON: () => ({}),
  });
};

const mockTextHitTarget = (
  textNode: Text,
  rect: MockRect,
  options: TextHitTargetOptions = {},
) => {
  const { api = 'caretRangeFromPoint', assertDocumentContext = false } =
    options;

  if (api === 'caretPositionFromPoint') {
    Object.defineProperty(document, 'caretPositionFromPoint', {
      configurable: true,
      value: vi.fn(function (this: Document) {
        if (assertDocumentContext) {
          expect(this).toBe(document);
        }

        return {
          offsetNode: textNode,
        };
      }),
    });
  } else {
    Object.defineProperty(document, 'caretRangeFromPoint', {
      configurable: true,
      value: vi.fn(function (this: Document) {
        if (assertDocumentContext) {
          expect(this).toBe(document);
        }

        return {
          startContainer: textNode,
        };
      }),
    });
  }

  const range = document.createRange();
  Object.defineProperty(range, 'getBoundingClientRect', {
    configurable: true,
    value: vi.fn(() => ({
      ...rect,
      toJSON: () => ({}),
    })),
  });
  Object.defineProperty(range, 'getClientRects', {
    configurable: true,
    value: vi.fn(() => [range.getBoundingClientRect()]),
  });
  vi.spyOn(document, 'createRange').mockReturnValue(range);
};

const getOverlayElements = () => {
  const overlayElements = document.querySelectorAll<HTMLDivElement>(
    '#itera-iteration-inspector-overlay-root > div',
  );

  return {
    selectedOverlayBox: overlayElements[0],
    hoverOverlayBox: overlayElements[1],
    selectedOverlayLabel: overlayElements[2],
    hoverOverlayLabel: overlayElements[3],
    overlayBox: overlayElements[1],
    overlayLabel: overlayElements[3],
  };
};

const whenSelectModeIsEntered = <T>(context: T): T => {
  enterSelectMode();
  return context;
};

const whenSelectModeIsEnteredWithDebugLogging = <T>(context: T): T => {
  enterSelectModeWithDebugLogging();
  return context;
};

const thenStopsRuntime = <T extends RuntimeContext>(context: T): T => {
  context.runtime.stop();
  if ('cleanup' in context && typeof context.cleanup === 'function') {
    context.cleanup();
  }
  return context;
};

const thenSelectionMessagesInclude =
  (displayText: string) =>
  <T extends SelectionContext>(context: T): T => {
    expect(getPostedMessages(context.postMessageSpy)).toEqual(
      expect.arrayContaining([
        {
          channel: ITERATION_INSPECTOR_CHANNEL,
          kind: 'mode_changed',
          active: true,
        },
        expect.objectContaining({
          channel: ITERATION_INSPECTOR_CHANNEL,
          kind: 'element_selected',
          selection: expect.objectContaining({
            displayText,
          }),
        }),
        {
          channel: ITERATION_INSPECTOR_CHANNEL,
          kind: 'mode_changed',
          active: false,
        },
      ]),
    );

    return context;
  };

const givenHoverAlignmentContext = (): HoverAlignmentContext => {
  document.body.innerHTML = `
    <main>
      <div id="primary-button"><span>Primary</span></div>
      <div id="secondary-button"><span>Secondary</span></div>
    </main>
  `;
  const primaryButton = document.getElementById('primary-button');
  const secondaryButton = document.getElementById('secondary-button');
  expect(primaryButton).not.toBeNull();
  expect(secondaryButton).not.toBeNull();
  assert(primaryButton instanceof HTMLDivElement);
  assert(secondaryButton instanceof HTMLDivElement);

  mockElementRect(primaryButton, {
    top: 24,
    left: 32,
    width: 120,
    height: 40,
    right: 152,
    bottom: 64,
    x: 32,
    y: 24,
  });
  mockElementRect(secondaryButton, {
    top: 140,
    left: 48,
    width: 160,
    height: 44,
    right: 208,
    bottom: 184,
    x: 48,
    y: 140,
  });

  let hoveredElement: Element = primaryButton;
  Object.defineProperty(document, 'elementFromPoint', {
    configurable: true,
    value: vi.fn(() => hoveredElement),
  });

  const runtime = createIterationInspectorRuntime({
    allowSelfMessaging: true,
  });
  runtime.start();

  return {
    runtime,
    primaryButton,
    secondaryButton,
    setHoveredElement: (element: Element) => {
      hoveredElement = element;
    },
  };
};

const whenPrimaryButtonIsHovered = (
  context: HoverAlignmentContext,
): HoverAlignmentContext => {
  dispatchPointerEvent(context.primaryButton, 'pointermove', {
    clientX: 40,
    clientY: 40,
  });

  return context;
};

const thenShowsPrimaryButtonHover = (
  context: HoverAlignmentContext,
): HoverAlignmentContext => {
  const { overlayBox, overlayLabel } = getOverlayElements();

  expect(overlayBox?.style.display).toBe('block');
  expect(overlayBox?.style.left).toBe('32px');
  expect(overlayLabel?.textContent).toBe('@div');

  return context;
};

const whenWindowScrollsToSecondaryButton = (
  context: HoverAlignmentContext,
): HoverAlignmentContext => {
  context.setHoveredElement(context.secondaryButton);
  dispatchPointerEvent(context.secondaryButton, 'pointermove', {
    clientX: 56,
    clientY: 156,
  });

  return context;
};

const thenShowsSecondaryButtonHover = (
  context: HoverAlignmentContext,
): HoverAlignmentContext => {
  const { overlayBox, overlayLabel } = getOverlayElements();

  expect(overlayBox?.style.left).toBe('48px');
  expect(overlayBox?.style.top).toBe('140px');
  expect(overlayLabel?.textContent).toBe('@div');

  return context;
};

const givenDisabledSelectionContext = (): SelectionContext => {
  document.body.innerHTML =
    '<main><div id="disabled-button"><span>Continue</span></div></main>';
  const button = document.getElementById('disabled-button');
  expect(button).not.toBeNull();
  assert(button instanceof HTMLDivElement);

  mockElementRect(button, {
    top: 16,
    left: 20,
    width: 140,
    height: 36,
    right: 160,
    bottom: 52,
    x: 20,
    y: 16,
  });

  const postMessageSpy = vi
    .spyOn(window, 'postMessage')
    .mockImplementation(() => undefined);

  const runtime = createIterationInspectorRuntime({
    allowSelfMessaging: true,
  });
  runtime.start();

  return {
    runtime,
    button,
    postMessageSpy,
  };
};

const givenContainerHoverContext = (): ContainerHoverContext => {
  document.body.innerHTML =
    '<main><div id="container"><span>Nested content</span></div></main>';
  const container = document.getElementById('container');
  expect(container).not.toBeNull();
  assert(container instanceof HTMLDivElement);

  mockElementRect(container, {
    top: 18,
    left: 24,
    width: 180,
    height: 64,
    right: 204,
    bottom: 82,
    x: 24,
    y: 18,
  });

  Object.defineProperty(container, 'innerText', {
    configurable: true,
    get: () => {
      throw new Error('container innerText should not be read on hover');
    },
  });

  Object.defineProperty(document, 'elementFromPoint', {
    configurable: true,
    value: vi.fn(() => container),
  });

  const postMessageSpy = vi
    .spyOn(window, 'postMessage')
    .mockImplementation(() => undefined);

  const runtime = createIterationInspectorRuntime({
    allowSelfMessaging: true,
  });
  runtime.start();

  return {
    runtime,
    container,
    postMessageSpy,
  };
};

const givenTextSelectionContext = (
  options: TextHitTargetOptions = {},
): TextSelectionContext => {
  document.body.innerHTML =
    '<main><div id="container"><span id="label">Nested content</span></div></main>';
  const container = document.getElementById('container');
  const label = document.getElementById('label');
  expect(container).not.toBeNull();
  expect(label).not.toBeNull();
  assert(container instanceof HTMLDivElement);
  assert(label instanceof HTMLSpanElement);
  const textNode = label.firstChild;
  expect(textNode).not.toBeNull();
  assert(textNode instanceof Text);

  mockElementRect(container, {
    top: 24,
    left: 18,
    width: 180,
    height: 64,
    right: 198,
    bottom: 88,
    x: 18,
    y: 24,
  });
  mockElementRect(label, {
    top: 40,
    left: 36,
    width: 96,
    height: 20,
    right: 132,
    bottom: 60,
    x: 36,
    y: 40,
  });
  mockTextHitTarget(
    textNode,
    {
      top: 40,
      left: 36,
      width: 96,
      height: 20,
      right: 132,
      bottom: 60,
      x: 36,
      y: 40,
    },
    options,
  );

  let pointElement: Element = label;
  Object.defineProperty(document, 'elementFromPoint', {
    configurable: true,
    value: vi.fn(() => pointElement),
  });

  const postMessageSpy = vi
    .spyOn(window, 'postMessage')
    .mockImplementation(() => undefined);

  const runtime = createIterationInspectorRuntime({
    allowSelfMessaging: true,
  });
  runtime.start();

  return {
    runtime,
    container,
    label,
    postMessageSpy,
    setPointElement: (element: Element) => {
      pointElement = element;
    },
    cleanup: () => {
      Reflect.deleteProperty(
        document as Document & {
          caretRangeFromPoint?: unknown;
        },
        'caretRangeFromPoint',
      );
      Reflect.deleteProperty(
        document as Document & {
          caretPositionFromPoint?: unknown;
        },
        'caretPositionFromPoint',
      );
    },
  };
};

const givenOverlayMutationContext = (): OverlayMutationContext => {
  document.body.innerHTML = `
    <main>
      <div id="layout-sibling">Sibling</div>
      <div id="overlay-button"><span>Overlay target</span></div>
    </main>
  `;
  const button = document.getElementById('overlay-button');
  const sibling = document.getElementById('layout-sibling');
  expect(button).not.toBeNull();
  expect(sibling).not.toBeNull();
  assert(button instanceof HTMLDivElement);
  assert(sibling instanceof HTMLDivElement);

  const getBoundingClientRectSpy = vi
    .spyOn(button, 'getBoundingClientRect')
    .mockReturnValue({
      top: 30,
      left: 28,
      width: 160,
      height: 44,
      right: 188,
      bottom: 74,
      x: 28,
      y: 30,
      toJSON: () => ({}),
    });

  const postMessageSpy = vi
    .spyOn(window, 'postMessage')
    .mockImplementation(() => undefined);

  const runtime = createIterationInspectorRuntime({
    allowSelfMessaging: true,
  });
  runtime.start();

  return {
    runtime,
    button,
    sibling,
    getBoundingClientRectSpy,
    postMessageSpy,
  };
};

const givenOverlayOnlyMutationContext = (): OverlayOnlyMutationContext => {
  document.body.innerHTML =
    '<main><div id="overlay-button"><span>Overlay target</span></div></main>';
  const button = document.getElementById('overlay-button');
  expect(button).not.toBeNull();
  assert(button instanceof HTMLDivElement);

  const getBoundingClientRectSpy = vi
    .spyOn(button, 'getBoundingClientRect')
    .mockReturnValue({
      top: 30,
      left: 28,
      width: 160,
      height: 44,
      right: 188,
      bottom: 74,
      x: 28,
      y: 30,
      toJSON: () => ({}),
    });

  const postMessageSpy = vi
    .spyOn(window, 'postMessage')
    .mockImplementation(() => undefined);

  let observerCallback:
    | ((records: MutationRecord[], observer: MutationObserver) => void)
    | null = null;

  class FakeMutationObserver {
    constructor(
      callback: (records: MutationRecord[], observer: MutationObserver) => void,
    ) {
      observerCallback = callback;
    }

    observe() {}

    disconnect() {}

    takeRecords() {
      return [];
    }
  }

  vi.stubGlobal(
    'MutationObserver',
    FakeMutationObserver as unknown as typeof MutationObserver,
  );

  const runtime = createIterationInspectorRuntime({
    allowSelfMessaging: true,
  });
  runtime.start();

  return {
    runtime,
    button,
    getBoundingClientRectSpy,
    postMessageSpy,
    deliverMutation: (records) => {
      observerCallback?.(records, {} as MutationObserver);
    },
    cleanup: () => {
      vi.unstubAllGlobals();
    },
  };
};

const whenDisabledButtonIsSelected = (
  context: SelectionContext,
): PointerSelectionContext => ({
  ...context,
  pointerDownEvent: dispatchPointerEvent(context.button, 'pointerdown', {
    clientX: 28,
    clientY: 24,
    pointerId: 7,
  }),
  pointerUpEvent: dispatchPointerEvent(context.button, 'pointerup', {
    clientX: 28,
    clientY: 24,
    pointerId: 7,
  }),
});

const thenDisabledSelectionSuppressesFollowUpClick = (
  context: PointerSelectionContext,
): PointerSelectionContext => {
  expect(context.pointerDownEvent.defaultPrevented).toBe(false);
  expect(context.pointerUpEvent.defaultPrevented).toBe(true);

  const clickEvent = new MouseEvent('click', {
    bubbles: true,
    cancelable: true,
  });
  const clickDispatchResult = context.button.dispatchEvent(clickEvent);

  expect(clickDispatchResult).toBe(false);
  expect(clickEvent.defaultPrevented).toBe(true);

  return context;
};

const givenSecondaryPointerSelectionContext = (): SelectionContext => {
  document.body.innerHTML =
    '<main><div id="secondary-button"><span>Secondary</span></div></main>';
  const button = document.getElementById('secondary-button');
  expect(button).not.toBeNull();
  assert(button instanceof HTMLDivElement);

  mockElementRect(button, {
    top: 12,
    left: 20,
    width: 140,
    height: 36,
    right: 160,
    bottom: 48,
    x: 20,
    y: 12,
  });

  const postMessageSpy = vi
    .spyOn(window, 'postMessage')
    .mockImplementation(() => undefined);

  const runtime = createIterationInspectorRuntime({
    allowSelfMessaging: true,
  });
  runtime.start();

  return {
    runtime,
    button,
    postMessageSpy,
  };
};

const whenPointerPositionIsPrimedOverContainer = (
  context: ContainerHoverContext,
): ContainerHoverContext => {
  dispatchPointerEvent(context.container, 'pointermove', {
    clientX: 36,
    clientY: 42,
  });

  return context;
};

const whenTextLabelIsHovered = (
  context: TextSelectionContext,
): TextSelectionContext => {
  context.setPointElement(context.label);
  dispatchPointerEvent(context.label, 'pointermove', {
    clientX: 44,
    clientY: 48,
  });

  return context;
};

const whenTextLabelIsClicked = (
  context: TextSelectionContext,
): TextSelectionContext => {
  context.setPointElement(context.label);
  context.label.dispatchEvent(
    new MouseEvent('click', {
      bubbles: true,
      cancelable: true,
      clientX: 44,
      clientY: 48,
    }),
  );

  return context;
};

const whenTextContainerPaddingIsHovered = (
  context: TextSelectionContext,
): TextSelectionContext => {
  context.setPointElement(context.container);
  dispatchPointerEvent(context.container, 'pointermove', {
    clientX: 24,
    clientY: 48,
  });

  return context;
};

const whenTextContainerPaddingIsClicked = (
  context: TextSelectionContext,
): TextSelectionContext => {
  context.setPointElement(context.container);
  context.container.dispatchEvent(
    new MouseEvent('click', {
      bubbles: true,
      cancelable: true,
      clientX: 24,
      clientY: 48,
    }),
  );

  return context;
};

const whenSelectModeIsEnteredOverContainer = (
  context: ContainerHoverContext,
): ContainerHoverContext => {
  expect(() => {
    enterSelectMode();
  }).not.toThrow();

  return context;
};

const whenSelectModeIsEnteredOverContainerWithDebugLogging = (
  context: ContainerHoverContext,
): ContainerHoverContext => {
  expect(() => {
    enterSelectModeWithDebugLogging();
  }).not.toThrow();

  return context;
};

const whenSelectModeIsEnteredAndButtonHoveredWithDebugLogging = <
  T extends {
    button: HTMLElement;
  },
>(
  context: T,
): T => {
  enterSelectModeWithDebugLogging();
  dispatchPointerEvent(context.button, 'pointermove', {
    clientX: 44,
    clientY: 48,
  });

  return context;
};

const whenOverlayBoxMutationIsObserved = async (
  context: OverlayOnlyMutationContext,
): Promise<OverlayOnlyMutationContext> => {
  const { overlayLabel } = getOverlayElements();
  expect(overlayLabel).toBeDefined();
  const removedTextNode = overlayLabel.firstChild;
  expect(removedTextNode).not.toBeNull();

  overlayLabel.textContent = '@div';
  const addedTextNode = overlayLabel.firstChild;
  expect(addedTextNode).not.toBeNull();

  context.getBoundingClientRectSpy.mockClear();
  context.deliverMutation([
    {
      type: 'childList',
      target: overlayLabel,
      addedNodes: [addedTextNode] as unknown as NodeList,
      removedNodes: [removedTextNode] as unknown as NodeList,
    } as unknown as MutationRecord,
  ]);
  await Promise.resolve();

  return context;
};

const whenSiblingMutationMayAffectHoveredLayout = async (
  context: OverlayMutationContext,
): Promise<OverlayMutationContext> => {
  await Promise.resolve();
  context.getBoundingClientRectSpy.mockClear();
  context.getBoundingClientRectSpy.mockReturnValue({
    top: 72,
    left: 64,
    width: 160,
    height: 44,
    right: 224,
    bottom: 116,
    x: 64,
    y: 72,
    toJSON: () => ({}),
  });
  context.sibling.setAttribute('data-layout-state', 'expanded');
  await Promise.resolve();

  return context;
};

const thenContainerHoverUsesCheapDisplayText = (
  context: ContainerHoverContext,
): ContainerHoverContext => {
  const { overlayBox, overlayLabel } = getOverlayElements();

  expect(overlayBox?.style.display).toBe('block');
  expect(overlayLabel?.textContent).toBe('@div');
  expect(context.runtime.isActive()).toBe(true);

  return context;
};

const thenTextHoverUsesInnermostTextTarget = (
  context: TextSelectionContext,
): TextSelectionContext => {
  const { overlayBox, overlayLabel } = getOverlayElements();

  expect(overlayBox?.style.display).toBe('block');
  expect(overlayBox?.style.left).toBe('36px');
  expect(overlayBox?.style.top).toBe('40px');
  expect(overlayBox?.style.width).toBe('96px');
  expect(overlayBox?.style.height).toBe('20px');
  expect(overlayLabel?.textContent).toBe('@text "Nested content"');

  return context;
};

const thenContainerHoverWinsWhenPointerIsOutsideText = (
  context: TextSelectionContext,
): TextSelectionContext => {
  const { overlayBox, overlayLabel } = getOverlayElements();

  expect(overlayBox?.style.display).toBe('block');
  expect(overlayBox?.style.left).toBe('18px');
  expect(overlayBox?.style.top).toBe('24px');
  expect(overlayBox?.style.width).toBe('180px');
  expect(overlayBox?.style.height).toBe('64px');
  expect(overlayLabel?.textContent).toBe('@div');

  return context;
};

const thenOverlayMutationIsIgnored = (
  context: OverlayOnlyMutationContext,
): OverlayOnlyMutationContext => {
  expect(context.getBoundingClientRectSpy).not.toHaveBeenCalled();
  expect(context.runtime.isActive()).toBe(true);
  expect(getPostedDebugLogMessages(context.postMessageSpy)).toEqual(
    expect.arrayContaining([
      expect.objectContaining({
        channel: ITERATION_INSPECTOR_CHANNEL,
        kind: 'debug_log',
        event: 'mutation_ignored',
        details: expect.objectContaining({
          reason: 'overlay_only',
        }),
      }),
    ]),
  );

  return context;
};

const thenSiblingMutationRefreshesHoverAlignment = (
  context: OverlayMutationContext,
): OverlayMutationContext => {
  const { overlayBox } = getOverlayElements();

  expect(context.getBoundingClientRectSpy).toHaveBeenCalled();
  expect(overlayBox?.style.left).toBe('64px');
  expect(overlayBox?.style.top).toBe('72px');
  expect(context.runtime.isActive()).toBe(true);

  return context;
};

const thenContainerHoverDebugLogsUseCheapDisplayText = (
  context: ContainerHoverContext,
): ContainerHoverContext => {
  expect(getPostedDebugLogMessages(context.postMessageSpy)).toEqual(
    expect.arrayContaining([
      expect.objectContaining({
        channel: ITERATION_INSPECTOR_CHANNEL,
        kind: 'debug_log',
        event: 'hover_target_changed',
        details: expect.objectContaining({
          target: expect.objectContaining({
            tagName: 'div',
            displayText: '@div',
          }),
        }),
      }),
    ]),
  );

  return context;
};

const thenTextSelectionIsEmitted = (
  context: TextSelectionContext,
): TextSelectionContext => {
  expect(getPostedMessages(context.postMessageSpy)).toEqual(
    expect.arrayContaining([
      {
        channel: ITERATION_INSPECTOR_CHANNEL,
        kind: 'mode_changed',
        active: true,
      },
      expect.objectContaining({
        channel: ITERATION_INSPECTOR_CHANNEL,
        kind: 'element_selected',
        selection: expect.objectContaining({
          displayText: '@text "Nested content"',
          element: expect.objectContaining({
            tagName: 'span',
            role: 'text',
            accessibleName: 'Nested content',
            textPreview: 'Nested content',
            bounds: {
              top: 40,
              left: 36,
              width: 96,
              height: 20,
            },
          }),
        }),
      }),
      {
        channel: ITERATION_INSPECTOR_CHANNEL,
        kind: 'mode_changed',
        active: false,
      },
    ]),
  );

  return context;
};

const thenContainerSelectionIsEmittedFromPadding = (
  context: TextSelectionContext,
): TextSelectionContext => {
  expect(getPostedMessages(context.postMessageSpy)).toEqual(
    expect.arrayContaining([
      {
        channel: ITERATION_INSPECTOR_CHANNEL,
        kind: 'mode_changed',
        active: true,
      },
      expect.objectContaining({
        channel: ITERATION_INSPECTOR_CHANNEL,
        kind: 'element_selected',
        selection: expect.objectContaining({
          displayText: '@div "Nested content"',
          element: expect.objectContaining({
            tagName: 'div',
            role: null,
            textPreview: 'Nested content',
            bounds: {
              top: 24,
              left: 18,
              width: 180,
              height: 64,
            },
          }),
        }),
      }),
      {
        channel: ITERATION_INSPECTOR_CHANNEL,
        kind: 'mode_changed',
        active: false,
      },
    ]),
  );

  return context;
};

const whenSecondaryButtonGetsNonPrimaryPointerUp = (
  context: SelectionContext,
): PointerSelectionContext => {
  const pointerDownEvent = dispatchPointerEvent(context.button, 'pointerdown', {
    button: 2,
    clientX: 28,
    clientY: 24,
    pointerId: 3,
  });

  return {
    ...context,
    pointerDownEvent,
    pointerUpEvent: dispatchPointerEvent(context.button, 'pointerup', {
      button: 2,
      clientX: 28,
      clientY: 24,
      pointerId: 3,
    }),
  };
};

const thenNonPrimaryPointerUpIsIgnored = (
  context: PointerSelectionContext,
): PointerSelectionContext => {
  expect(context.pointerUpEvent.defaultPrevented).toBe(false);
  expect(getPostedMessages(context.postMessageSpy)).toEqual(
    expect.arrayContaining([
      {
        channel: ITERATION_INSPECTOR_CHANNEL,
        kind: 'mode_changed',
        active: true,
      },
    ]),
  );
  expect(getPostedMessages(context.postMessageSpy)).not.toEqual(
    expect.arrayContaining([
      expect.objectContaining({
        channel: ITERATION_INSPECTOR_CHANNEL,
        kind: 'element_selected',
      }),
      {
        channel: ITERATION_INSPECTOR_CHANNEL,
        kind: 'mode_changed',
        active: false,
      },
    ]),
  );

  return context;
};

const givenClickSelectionContext = (): SelectionContext => {
  document.body.innerHTML =
    '<main><div id="save-button"><span>Save</span></div></main>';
  const button = document.getElementById('save-button');
  expect(button).not.toBeNull();
  assert(button instanceof HTMLDivElement);

  mockElementRect(button, {
    top: 12,
    left: 16,
    width: 96,
    height: 32,
    right: 112,
    bottom: 44,
    x: 16,
    y: 12,
  });

  const postMessageSpy = vi
    .spyOn(window, 'postMessage')
    .mockImplementation(() => undefined);

  const runtime = createIterationInspectorRuntime({
    allowSelfMessaging: true,
  });
  runtime.start();

  return {
    runtime,
    button,
    postMessageSpy,
  };
};

const givenDebugClickSelectionContext = (): DebugSelectionContext => ({
  ...givenClickSelectionContext(),
  consoleDebugSpy: vi
    .spyOn(console, 'debug')
    .mockImplementation(() => undefined),
});

const whenButtonIsSelectedViaClick = <T extends SelectionContext>(
  context: T,
): T & ClickSelectionContext => {
  const selectionClickEvent = new MouseEvent('click', {
    bubbles: true,
    cancelable: true,
  });

  return {
    ...context,
    selectionClickEvent,
    selectionClickResult: context.button.dispatchEvent(selectionClickEvent),
  };
};

const thenInitialClickIsPrevented = <T extends ClickSelectionContext>(
  context: T,
): T => {
  expect(context.selectionClickResult).toBe(false);
  expect(context.selectionClickEvent.defaultPrevented).toBe(true);

  return context;
};

const whenSameButtonIsClickedAgain = <T extends ClickSelectionContext>(
  context: T,
): T => {
  const followUpClickEvent = new MouseEvent('click', {
    bubbles: true,
    cancelable: true,
  });

  return {
    ...context,
    followUpClickEvent,
    followUpClickResult: context.button.dispatchEvent(followUpClickEvent),
  };
};

const thenLaterClicksAreNotSuppressed = <T extends ClickSelectionContext>(
  context: T,
): T => {
  expect(context.followUpClickResult).toBe(true);
  expect(context.followUpClickEvent?.defaultPrevented).toBe(false);

  return context;
};

const thenDebugMessagesIncludeLifecycleEvents = (
  context: DebugSelectionContext,
): DebugSelectionContext => {
  expect(getPostedDebugLogMessages(context.postMessageSpy)).toEqual(
    expect.arrayContaining([
      {
        channel: ITERATION_INSPECTOR_CHANNEL,
        kind: 'debug_log',
        event: 'debug_enabled',
        sessionId: 'selection-debug-session',
        details: {
          urlPath: '/',
        },
      },
      {
        channel: ITERATION_INSPECTOR_CHANNEL,
        kind: 'debug_log',
        event: 'command_received',
        sessionId: 'selection-debug-session',
        details: {
          kind: 'enter_select_mode',
          origin: 'https://itera.example',
          urlPath: '/',
        },
      },
      {
        channel: ITERATION_INSPECTOR_CHANNEL,
        kind: 'debug_log',
        event: 'mode_changed',
        sessionId: 'selection-debug-session',
        details: {
          active: true,
          reason: 'command',
        },
      },
      expect.objectContaining({
        channel: ITERATION_INSPECTOR_CHANNEL,
        kind: 'debug_log',
        event: 'selection_emitted',
        sessionId: 'selection-debug-session',
        details: expect.objectContaining({
          source: 'click',
          suppressFollowUpClick: false,
          selectionDisplayText: '@div "Save"',
          target: expect.objectContaining({
            tagName: 'div',
            displayText: '@div',
          }),
        }),
      }),
      {
        channel: ITERATION_INSPECTOR_CHANNEL,
        kind: 'debug_log',
        event: 'mode_changed',
        sessionId: 'selection-debug-session',
        details: {
          active: false,
          reason: 'selection',
        },
      },
    ]),
  );

  return context;
};

describe('iterationInspector runtime', () => {
  beforeEach(() => {
    document.body.innerHTML = '';
    window.history.replaceState({}, '', '/');
  });

  afterEach(() => {
    vi.restoreAllMocks();
    document.body.innerHTML = '';
    Reflect.deleteProperty(
      document as Document & {
        caretRangeFromPoint?: unknown;
      },
      'caretRangeFromPoint',
    );
    Reflect.deleteProperty(
      document as Document & {
        caretPositionFromPoint?: unknown;
      },
      'caretPositionFromPoint',
    );
    Reflect.deleteProperty(
      document as Document & {
        elementFromPoint?: unknown;
      },
      'elementFromPoint',
    );
    delete window.__ITERA_ITERATION_INSPECTOR_RUNTIME__;
    delete window.__ARA_EMBEDDED_REACT_INSPECTOR_SELECTION__;
  });

  test('builds deterministic element snapshots and display text', () => {
    window.history.replaceState({}, '', '/projects/1?tab=details#save');
    document.body.innerHTML =
      '<main><button id="save-button" aria-label="Save changes" data-testid="save">Save</button></main>';
    const button = document.getElementById('save-button');
    expect(button).not.toBeNull();
    assert(button instanceof HTMLButtonElement);
    vi.spyOn(button, 'getBoundingClientRect').mockReturnValue({
      top: 24,
      left: 48,
      width: 120,
      height: 40,
      right: 168,
      bottom: 64,
      x: 48,
      y: 24,
      toJSON: () => ({}),
    });

    const selection = buildIterationElementSelection(button, window, document);

    expect(selection.displayText).toBe('@button "Save changes"');
    expect(selection.element).toMatchObject({
      urlPath: '/projects/1?tab=details#save',
      cssSelector: 'button#save-button',
      domPath: '/html[1]/body[1]/main[1]/button[1]',
      tagName: 'button',
      role: 'button',
      accessibleName: 'Save changes',
      textPreview: 'Save',
      id: 'save-button',
      dataTestId: 'save',
      bounds: {
        top: 24,
        left: 48,
        width: 120,
        height: 40,
      },
      scrollOffset: {
        x: 0,
        y: 0,
      },
    });
    expect(Date.parse(selection.element.capturedAt)).not.toBeNaN();
  });

  test('redacts live values for text-entry controls while preserving safe labels', () => {
    document.body.innerHTML = `
      <form>
        <label for="email">Email address</label>
        <input id="email" type="email" value="alice@example.com" />
        <textarea aria-label="Notes">private note</textarea>
        <input id="submit" type="submit" value="Save form" />
      </form>
    `;
    const emailInput = document.getElementById('email');
    const textarea = document.querySelector('textarea');
    const submitInput = document.getElementById('submit');

    expect(emailInput).not.toBeNull();
    expect(textarea).not.toBeNull();
    expect(submitInput).not.toBeNull();
    assert(emailInput instanceof HTMLInputElement);
    assert(textarea instanceof HTMLTextAreaElement);
    assert(submitInput instanceof HTMLInputElement);

    vi.spyOn(emailInput, 'getBoundingClientRect').mockReturnValue({
      top: 10,
      left: 10,
      width: 120,
      height: 32,
      right: 130,
      bottom: 42,
      x: 10,
      y: 10,
      toJSON: () => ({}),
    });
    vi.spyOn(textarea, 'getBoundingClientRect').mockReturnValue({
      top: 50,
      left: 10,
      width: 160,
      height: 80,
      right: 170,
      bottom: 130,
      x: 10,
      y: 50,
      toJSON: () => ({}),
    });
    vi.spyOn(submitInput, 'getBoundingClientRect').mockReturnValue({
      top: 140,
      left: 10,
      width: 120,
      height: 32,
      right: 130,
      bottom: 172,
      x: 10,
      y: 140,
      toJSON: () => ({}),
    });

    const emailSelection = buildIterationElementSelection(
      emailInput,
      window,
      document,
    );
    const textareaSelection = buildIterationElementSelection(
      textarea,
      window,
      document,
    );
    const submitSelection = buildIterationElementSelection(
      submitInput,
      window,
      document,
    );

    expect(emailSelection).toMatchObject({
      displayText: '@textbox "Email address"',
      element: {
        accessibleName: 'Email address',
        textPreview: null,
      },
    });
    expect(JSON.stringify(emailSelection)).not.toContain('alice@example.com');

    expect(textareaSelection).toMatchObject({
      displayText: '@textbox "Notes"',
      element: {
        accessibleName: 'Notes',
        textPreview: null,
      },
    });
    expect(JSON.stringify(textareaSelection)).not.toContain('private note');

    expect(submitSelection).toMatchObject({
      displayText: '@button "Save form"',
      element: {
        accessibleName: 'Save form',
      },
    });
  });

  test('attaches React component ancestry when the embedded inspector bridge can resolve it', () => {
    document.body.innerHTML = `
      <main>
        <button id="save-button">Save</button>
      </main>
    `;
    const button = document.getElementById('save-button');

    expect(button).not.toBeNull();
    assert(button instanceof HTMLButtonElement);

    vi.spyOn(button, 'getBoundingClientRect').mockReturnValue({
      top: 24,
      left: 48,
      width: 120,
      height: 40,
      right: 168,
      bottom: 64,
      x: 48,
      y: 24,
      toJSON: () => ({}),
    });

    const getReactComponentPathForElement = vi.fn(() => [
      'AppShell',
      'ForwardRef(ToolbarButton)',
    ]);
    window.__ARA_EMBEDDED_REACT_INSPECTOR_SELECTION__ = {
      getReactComponentPathForElement,
    };

    const selection = buildIterationElementSelection(button, window, document);

    expect(getReactComponentPathForElement).toHaveBeenCalledWith(button);
    expect(selection.element.reactComponentPath).toEqual([
      'AppShell',
      'ForwardRef(ToolbarButton)',
    ]);
  });

  test('tracks hovered elements, emits selections, and blocks page clicks', () => {
    document.body.innerHTML =
      '<main><div id="save-button"><span>Save</span></div></main>';
    const button = document.getElementById('save-button');
    expect(button).not.toBeNull();
    assert(button instanceof HTMLDivElement);

    vi.spyOn(button, 'getBoundingClientRect').mockReturnValue({
      top: 12,
      left: 16,
      width: 96,
      height: 32,
      right: 112,
      bottom: 44,
      x: 16,
      y: 12,
      toJSON: () => ({}),
    });

    const postMessageSpy = vi
      .spyOn(window, 'postMessage')
      .mockImplementation(() => undefined);

    const runtime = createIterationInspectorRuntime({
      allowSelfMessaging: true,
    });
    runtime.start();

    window.dispatchEvent(
      new MessageEvent('message', {
        data: {
          channel: ITERATION_INSPECTOR_CHANNEL,
          kind: 'enter_select_mode',
        },
        origin: 'https://itera.example',
        source: window,
      }),
    );

    button.dispatchEvent(
      new MouseEvent('pointermove', {
        bubbles: true,
        cancelable: true,
        clientX: 20,
        clientY: 20,
      }),
    );

    const { hoverOverlayBox } = getOverlayElements();
    expect(hoverOverlayBox).not.toBeNull();
    expect(hoverOverlayBox?.style.display).toBe('block');
    expect(hoverOverlayBox?.style.left).toBe('16px');
    expect(hoverOverlayBox?.style.top).toBe('12px');

    const clickEvent = new MouseEvent('click', {
      bubbles: true,
      cancelable: true,
    });
    const dispatchResult = button.dispatchEvent(clickEvent);

    expect(dispatchResult).toBe(false);
    expect(clickEvent.defaultPrevented).toBe(true);

    const messages = getPostedMessages(postMessageSpy);
    expect(messages).toEqual(
      expect.arrayContaining([
        {
          channel: ITERATION_INSPECTOR_CHANNEL,
          kind: 'mode_changed',
          active: true,
        },
        expect.objectContaining({
          channel: ITERATION_INSPECTOR_CHANNEL,
          kind: 'element_selected',
          selection: expect.objectContaining({
            displayText: '@div "Save"',
          }),
        }),
        {
          channel: ITERATION_INSPECTOR_CHANNEL,
          kind: 'mode_changed',
          active: false,
        },
      ]),
    );

    expect(runtime.isActive()).toBe(false);
    runtime.stop();
  });

  test('keeps a persistent selected highlight while showing a different hover target color', () => {
    document.body.innerHTML =
      '<main><div id="save-button"><span>Save</span></div><div id="cancel-button"><span>Cancel</span></div></main>';
    const saveButton = document.getElementById('save-button');
    const cancelButton = document.getElementById('cancel-button');
    expect(saveButton).not.toBeNull();
    expect(cancelButton).not.toBeNull();
    assert(saveButton instanceof HTMLDivElement);
    assert(cancelButton instanceof HTMLDivElement);

    vi.spyOn(saveButton, 'getBoundingClientRect').mockReturnValue({
      top: 12,
      left: 16,
      width: 96,
      height: 32,
      right: 112,
      bottom: 44,
      x: 16,
      y: 12,
      toJSON: () => ({}),
    });
    vi.spyOn(cancelButton, 'getBoundingClientRect').mockReturnValue({
      top: 84,
      left: 24,
      width: 104,
      height: 32,
      right: 128,
      bottom: 116,
      x: 24,
      y: 84,
      toJSON: () => ({}),
    });

    const runtime = createIterationInspectorRuntime({
      allowSelfMessaging: true,
    });
    runtime.start();

    enterSelectMode();
    saveButton.dispatchEvent(
      new MouseEvent('click', {
        bubbles: true,
        cancelable: true,
        clientX: 20,
        clientY: 20,
      }),
    );
    enterSelectMode();
    cancelButton.dispatchEvent(
      new MouseEvent('pointermove', {
        bubbles: true,
        cancelable: true,
        clientX: 30,
        clientY: 90,
      }),
    );

    const {
      selectedOverlayBox,
      hoverOverlayBox,
      selectedOverlayLabel,
      hoverOverlayLabel,
    } = getOverlayElements();

    expect(selectedOverlayBox?.style.display).toBe('block');
    expect(selectedOverlayBox?.style.left).toBe('16px');
    expect(selectedOverlayBox?.style.top).toBe('12px');
    expect(selectedOverlayBox?.style.border).toContain('20, 184, 166');
    expect(selectedOverlayLabel?.textContent).toBe('@div');

    expect(hoverOverlayBox?.style.display).toBe('block');
    expect(hoverOverlayBox?.style.left).toBe('24px');
    expect(hoverOverlayBox?.style.top).toBe('84px');
    expect(hoverOverlayBox?.style.border).toContain('37, 99, 235');
    expect(hoverOverlayLabel?.textContent).toBe('@div');

    runtime.stop();
  });

  test('repositions the persistent selected highlight on scroll while hover tracking is active', () => {
    document.body.innerHTML =
      '<main><div id="save-button"><span>Save</span></div><div id="cancel-button"><span>Cancel</span></div></main>';
    const saveButton = document.getElementById('save-button');
    const cancelButton = document.getElementById('cancel-button');
    expect(saveButton).not.toBeNull();
    expect(cancelButton).not.toBeNull();
    assert(saveButton instanceof HTMLDivElement);
    assert(cancelButton instanceof HTMLDivElement);

    let saveRect = {
      top: 12,
      left: 16,
      width: 96,
      height: 32,
      right: 112,
      bottom: 44,
      x: 16,
      y: 12,
    };
    let cancelRect = {
      top: 84,
      left: 24,
      width: 104,
      height: 32,
      right: 128,
      bottom: 116,
      x: 24,
      y: 84,
    };

    vi.spyOn(saveButton, 'getBoundingClientRect').mockImplementation(() => ({
      ...saveRect,
      toJSON: () => ({}),
    }));
    vi.spyOn(cancelButton, 'getBoundingClientRect').mockImplementation(() => ({
      ...cancelRect,
      toJSON: () => ({}),
    }));

    const runtime = createIterationInspectorRuntime({
      allowSelfMessaging: true,
    });
    runtime.start();

    enterSelectMode();
    saveButton.dispatchEvent(
      new MouseEvent('click', {
        bubbles: true,
        cancelable: true,
        clientX: 20,
        clientY: 20,
      }),
    );
    enterSelectMode();
    cancelButton.dispatchEvent(
      new MouseEvent('pointermove', {
        bubbles: true,
        cancelable: true,
        clientX: 30,
        clientY: 90,
      }),
    );

    const { selectedOverlayBox, hoverOverlayBox } = getOverlayElements();
    expect(selectedOverlayBox?.style.top).toBe('12px');
    expect(hoverOverlayBox?.style.top).toBe('84px');

    saveRect = {
      ...saveRect,
      top: 48,
      bottom: 80,
      y: 48,
    };
    cancelRect = {
      ...cancelRect,
      top: 120,
      bottom: 152,
      y: 120,
    };

    window.dispatchEvent(new Event('scroll'));

    expect(selectedOverlayBox?.style.top).toBe('48px');
    expect(hoverOverlayBox?.style.top).toBe('84px');

    runtime.stop();
  });

  test('shows hover immediately on enter and updates when the hovered allowed target changes', async () => {
    await given(givenHoverAlignmentContext)
      .when(whenPrimaryButtonIsHovered)
      .when(whenSelectModeIsEntered)
      .then(thenShowsPrimaryButtonHover)
      .when(whenWindowScrollsToSecondaryButton)
      .then(thenShowsSecondaryButtonHover)
      .then(thenStopsRuntime);
  });

  test('selects allowed container targets on pointerup and suppresses the follow-up click', async () => {
    await given(givenDisabledSelectionContext)
      .when(whenSelectModeIsEntered)
      .when(whenDisabledButtonIsSelected)
      .then(thenDisabledSelectionSuppressesFollowUpClick)
      .then(thenSelectionMessagesInclude('@div "Continue"'))
      .then(thenStopsRuntime);
  });

  test('should avoid expensive container text reads when select mode starts', async () => {
    await given(givenContainerHoverContext)
      .when(whenPointerPositionIsPrimedOverContainer)
      .when(whenSelectModeIsEnteredOverContainer)
      .then(thenContainerHoverUsesCheapDisplayText)
      .then(thenStopsRuntime);
  });

  test('should keep hover debug logs cheap for large container targets', async () => {
    await given(givenContainerHoverContext)
      .when(whenPointerPositionIsPrimedOverContainer)
      .when(whenSelectModeIsEnteredOverContainerWithDebugLogging)
      .then(thenContainerHoverUsesCheapDisplayText)
      .then(thenContainerHoverDebugLogsUseCheapDisplayText)
      .then(thenStopsRuntime);
  });

  test('should prefer text targets over ancestor divs when the pointer is over text', async () => {
    await given(givenTextSelectionContext)
      .when(whenSelectModeIsEntered)
      .when(whenTextLabelIsHovered)
      .then(thenTextHoverUsesInnermostTextTarget)
      .when(whenTextLabelIsClicked)
      .then(thenTextSelectionIsEmitted)
      .then(thenStopsRuntime);
  });

  test('should call caretPositionFromPoint with the document context', async () => {
    await given(() =>
      givenTextSelectionContext({
        api: 'caretPositionFromPoint',
        assertDocumentContext: true,
      }),
    )
      .when(whenSelectModeIsEntered)
      .when(whenTextLabelIsHovered)
      .then(thenTextHoverUsesInnermostTextTarget)
      .when(whenTextLabelIsClicked)
      .then(thenTextSelectionIsEmitted)
      .then(thenStopsRuntime);
  });

  test('should fall back to the container when the pointer is outside the text bounds', async () => {
    await given(givenTextSelectionContext)
      .when(whenSelectModeIsEntered)
      .when(whenTextContainerPaddingIsHovered)
      .then(thenContainerHoverWinsWhenPointerIsOutsideText)
      .when(whenTextContainerPaddingIsClicked)
      .then(thenContainerSelectionIsEmittedFromPadding)
      .then(thenStopsRuntime);
  });

  test('should prefer button-like div targets over nested text selections', () => {
    document.body.innerHTML =
      '<main><div id="cta" role="button"><span id="label">Continue</span></div></main>';
    const buttonLikeDiv = document.getElementById('cta');
    const label = document.getElementById('label');
    expect(buttonLikeDiv).not.toBeNull();
    expect(label).not.toBeNull();
    assert(buttonLikeDiv instanceof HTMLDivElement);
    assert(label instanceof HTMLSpanElement);
    const textNode = label.firstChild;
    expect(textNode).not.toBeNull();
    assert(textNode instanceof Text);

    mockElementRect(buttonLikeDiv, {
      top: 20,
      left: 24,
      width: 120,
      height: 40,
      right: 144,
      bottom: 60,
      x: 24,
      y: 20,
    });
    mockElementRect(label, {
      top: 30,
      left: 40,
      width: 68,
      height: 18,
      right: 108,
      bottom: 48,
      x: 40,
      y: 30,
    });
    mockTextHitTarget(textNode, {
      top: 30,
      left: 40,
      width: 68,
      height: 18,
      right: 108,
      bottom: 48,
      x: 40,
      y: 30,
    });

    Object.defineProperty(document, 'elementFromPoint', {
      configurable: true,
      value: vi.fn(() => label),
    });

    const postMessageSpy = vi
      .spyOn(window, 'postMessage')
      .mockImplementation(() => undefined);
    const runtime = createIterationInspectorRuntime({
      allowSelfMessaging: true,
    });

    runtime.start();
    window.dispatchEvent(
      new MessageEvent('message', {
        data: {
          channel: ITERATION_INSPECTOR_CHANNEL,
          kind: 'enter_select_mode',
        },
        origin: 'https://itera.example',
        source: window,
      }),
    );

    dispatchPointerEvent(label, 'pointermove', {
      clientX: 48,
      clientY: 36,
    });
    label.dispatchEvent(
      new MouseEvent('click', {
        bubbles: true,
        cancelable: true,
        clientX: 48,
        clientY: 36,
      }),
    );

    expect(getPostedMessages(postMessageSpy)).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          kind: 'element_selected',
          selection: expect.objectContaining({
            displayText: '@button "Continue"',
            element: expect.objectContaining({
              tagName: 'div',
              role: 'button',
            }),
          }),
        }),
      ]),
    );

    runtime.stop();
    postMessageSpy.mockRestore();
    Reflect.deleteProperty(
      document as Document & {
        elementFromPoint?: unknown;
      },
      'elementFromPoint',
    );
    Reflect.deleteProperty(
      document as Document & {
        caretRangeFromPoint?: unknown;
      },
      'caretRangeFromPoint',
    );
  });

  test('should select text inputs as textbox element targets', () => {
    document.body.innerHTML =
      '<main><input id="email" type="text" placeholder="Email address" /></main>';
    const input = document.getElementById('email');
    expect(input).not.toBeNull();
    assert(input instanceof HTMLInputElement);

    mockElementRect(input, {
      top: 18,
      left: 24,
      width: 180,
      height: 36,
      right: 204,
      bottom: 54,
      x: 24,
      y: 18,
    });

    Object.defineProperty(document, 'elementFromPoint', {
      configurable: true,
      value: vi.fn(() => input),
    });

    const postMessageSpy = vi
      .spyOn(window, 'postMessage')
      .mockImplementation(() => undefined);
    const runtime = createIterationInspectorRuntime({
      allowSelfMessaging: true,
    });

    runtime.start();
    window.dispatchEvent(
      new MessageEvent('message', {
        data: {
          channel: ITERATION_INSPECTOR_CHANNEL,
          kind: 'enter_select_mode',
        },
        origin: 'https://itera.example',
        source: window,
      }),
    );

    dispatchPointerEvent(input, 'pointermove', {
      clientX: 32,
      clientY: 28,
    });
    input.dispatchEvent(
      new MouseEvent('click', {
        bubbles: true,
        cancelable: true,
        clientX: 32,
        clientY: 28,
      }),
    );

    expect(getPostedMessages(postMessageSpy)).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          kind: 'element_selected',
          selection: expect.objectContaining({
            displayText: '@textbox "Email address"',
            element: expect.objectContaining({
              tagName: 'input',
              role: 'textbox',
            }),
          }),
        }),
      ]),
    );

    runtime.stop();
    postMessageSpy.mockRestore();
    Reflect.deleteProperty(
      document as Document & {
        elementFromPoint?: unknown;
      },
      'elementFromPoint',
    );
  });

  test('should fall back to the event target when point hit is unrelated', () => {
    document.body.innerHTML = `
      <main>
        <div id="unrelated">Unrelated</div>
        <button id="save-button" type="button">Save</button>
      </main>
    `;
    const unrelated = document.getElementById('unrelated');
    const button = document.getElementById('save-button');

    expect(unrelated).not.toBeNull();
    expect(button).not.toBeNull();
    assert(unrelated instanceof HTMLDivElement);
    assert(button instanceof HTMLButtonElement);

    mockElementRect(unrelated, {
      top: 0,
      left: 0,
      width: 80,
      height: 24,
      right: 80,
      bottom: 24,
      x: 0,
      y: 0,
    });
    mockElementRect(button, {
      top: 120,
      left: 24,
      width: 96,
      height: 36,
      right: 120,
      bottom: 156,
      x: 24,
      y: 120,
    });

    Object.defineProperty(document, 'elementFromPoint', {
      configurable: true,
      value: vi.fn(() => unrelated),
    });

    const postMessageSpy = vi
      .spyOn(window, 'postMessage')
      .mockImplementation(() => undefined);
    const runtime = createIterationInspectorRuntime({
      allowSelfMessaging: true,
    });

    runtime.start();
    enterSelectMode();

    button.dispatchEvent(
      new MouseEvent('click', {
        bubbles: true,
        cancelable: true,
        clientX: 0,
        clientY: 0,
      }),
    );

    expect(getPostedMessages(postMessageSpy)).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          kind: 'element_selected',
          selection: expect.objectContaining({
            displayText: '@button "Save"',
            element: expect.objectContaining({
              tagName: 'button',
              role: 'button',
            }),
          }),
        }),
      ]),
    );

    runtime.stop();
    postMessageSpy.mockRestore();
    Reflect.deleteProperty(
      document as Document & {
        elementFromPoint?: unknown;
      },
      'elementFromPoint',
    );
  });

  test('ignores overlay-only mutations while select mode is active', async () => {
    await given(givenOverlayOnlyMutationContext)
      .when(whenSelectModeIsEnteredAndButtonHoveredWithDebugLogging)
      .when(whenOverlayBoxMutationIsObserved)
      .then(thenOverlayMutationIsIgnored)
      .then(thenStopsRuntime);
  });

  test('refreshes hovered overlay alignment for sibling layout mutations', async () => {
    await given(givenOverlayMutationContext)
      .when(whenSelectModeIsEnteredAndButtonHoveredWithDebugLogging)
      .when(whenSiblingMutationMayAffectHoveredLayout)
      .then(thenSiblingMutationRefreshesHoverAlignment)
      .then(thenStopsRuntime);
  });

  test('ignores non-primary pointerups so right-click inspection stays active', async () => {
    await given(givenSecondaryPointerSelectionContext)
      .when(whenSelectModeIsEntered)
      .when(whenSecondaryButtonGetsNonPrimaryPointerUp)
      .then(thenNonPrimaryPointerUpIsIgnored)
      .then(thenStopsRuntime);
  });

  test('does not suppress later clicks after click-based selection', async () => {
    await given(givenClickSelectionContext)
      .when(whenSelectModeIsEntered)
      .when(whenButtonIsSelectedViaClick)
      .then(thenInitialClickIsPrevented)
      .when(whenSameButtonIsClickedAgain)
      .then(thenLaterClicksAreNotSuppressed)
      .then(thenSelectionMessagesInclude('@div "Save"'))
      .then(thenStopsRuntime);
  });

  test('emits debug lifecycle breadcrumbs when debug logging is enabled', async () => {
    await given(givenDebugClickSelectionContext)
      .when(whenSelectModeIsEnteredWithDebugLogging)
      .when(whenButtonIsSelectedViaClick)
      .then(thenDebugMessagesIncludeLifecycleEvents)
      .then(thenStopsRuntime);
  });

  test('invalidates temporary state on route changes', () => {
    document.body.innerHTML =
      '<main><div id="route-button"><span>Navigate</span></div></main>';
    const button = document.getElementById('route-button');
    expect(button).not.toBeNull();
    assert(button instanceof HTMLDivElement);

    vi.spyOn(button, 'getBoundingClientRect').mockReturnValue({
      top: 8,
      left: 12,
      width: 80,
      height: 28,
      right: 92,
      bottom: 36,
      x: 12,
      y: 8,
      toJSON: () => ({}),
    });

    const postMessageSpy = vi
      .spyOn(window, 'postMessage')
      .mockImplementation(() => undefined);

    const runtime = createIterationInspectorRuntime({
      allowSelfMessaging: true,
    });
    runtime.start();

    window.dispatchEvent(
      new MessageEvent('message', {
        data: {
          channel: ITERATION_INSPECTOR_CHANNEL,
          kind: 'enter_select_mode',
        },
        origin: 'https://itera.example',
        source: window,
      }),
    );

    button.dispatchEvent(
      new MouseEvent('pointermove', {
        bubbles: true,
        cancelable: true,
      }),
    );

    window.history.pushState({}, '', '/next-route');

    const messages = getPostedMessages(postMessageSpy);
    expect(messages).toEqual(
      expect.arrayContaining([
        {
          channel: ITERATION_INSPECTOR_CHANNEL,
          kind: 'selection_invalidated',
          reason: 'route_change',
        },
        {
          channel: ITERATION_INSPECTOR_CHANNEL,
          kind: 'mode_changed',
          active: false,
        },
      ]),
    );

    const { hoverOverlayBox, selectedOverlayBox } = getOverlayElements();
    expect(hoverOverlayBox?.style.display).toBe('none');
    expect(selectedOverlayBox?.style.display).toBe('none');

    runtime.stop();
  });

  test('clears stale hover targets when the node detaches', async () => {
    document.body.innerHTML =
      '<main><div id="detached-button"><span>Detach me</span></div></main>';
    const button = document.getElementById('detached-button');
    expect(button).not.toBeNull();
    assert(button instanceof HTMLDivElement);

    vi.spyOn(button, 'getBoundingClientRect').mockReturnValue({
      top: 4,
      left: 4,
      width: 80,
      height: 28,
      right: 84,
      bottom: 32,
      x: 4,
      y: 4,
      toJSON: () => ({}),
    });

    const postMessageSpy = vi
      .spyOn(window, 'postMessage')
      .mockImplementation(() => undefined);

    const runtime = createIterationInspectorRuntime({
      allowSelfMessaging: true,
    });
    runtime.start();

    window.dispatchEvent(
      new MessageEvent('message', {
        data: {
          channel: ITERATION_INSPECTOR_CHANNEL,
          kind: 'enter_select_mode',
        },
        origin: 'https://itera.example',
        source: window,
      }),
    );

    button.dispatchEvent(
      new MouseEvent('pointermove', {
        bubbles: true,
        cancelable: true,
      }),
    );

    button.remove();
    await Promise.resolve();

    const messages = getPostedMessages(postMessageSpy);
    expect(messages).not.toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          channel: ITERATION_INSPECTOR_CHANNEL,
          kind: 'selection_invalidated',
          reason: 'node_detached',
        }),
      ]),
    );

    const { hoverOverlayBox, selectedOverlayBox } = getOverlayElements();
    expect(hoverOverlayBox?.style.display).toBe('none');
    expect(selectedOverlayBox?.style.display).toBe('none');
    expect(runtime.isActive()).toBe(true);

    runtime.stop();
  });

  test('invalidates a detached selected target even when hover has already cleared', async () => {
    document.body.innerHTML =
      '<main><div id="detached-button"><span>Detach me</span></div></main>';
    const button = document.getElementById('detached-button');
    expect(button).not.toBeNull();
    assert(button instanceof HTMLDivElement);

    vi.spyOn(button, 'getBoundingClientRect').mockReturnValue({
      top: 4,
      left: 4,
      width: 80,
      height: 28,
      right: 84,
      bottom: 32,
      x: 4,
      y: 4,
      toJSON: () => ({}),
    });

    const postMessageSpy = vi
      .spyOn(window, 'postMessage')
      .mockImplementation(() => undefined);

    const runtime = createIterationInspectorRuntime({
      allowSelfMessaging: true,
    });
    runtime.start();

    enterPersistentSelectMode();
    button.dispatchEvent(
      new MouseEvent('click', {
        bubbles: true,
        cancelable: true,
        clientX: 20,
        clientY: 20,
      }),
    );

    document.dispatchEvent(
      new MouseEvent('pointermove', {
        bubbles: true,
        cancelable: true,
        clientX: 400,
        clientY: 400,
      }),
    );

    button.remove();
    await Promise.resolve();

    const messages = getPostedMessages(postMessageSpy);
    expect(messages).toEqual(
      expect.arrayContaining([
        {
          channel: ITERATION_INSPECTOR_CHANNEL,
          kind: 'selection_invalidated',
          reason: 'node_detached',
        },
      ]),
    );

    const { hoverOverlayBox, selectedOverlayBox } = getOverlayElements();
    expect(hoverOverlayBox?.style.display).toBe('none');
    expect(selectedOverlayBox?.style.display).toBe('none');
    expect(runtime.isActive()).toBe(true);

    runtime.stop();
  });

  test('ignores inspector commands from untrusted senders or changed origins', () => {
    document.body.innerHTML =
      '<main><div id="secure-button"><span>Secure</span></div></main>';
    const button = document.getElementById('secure-button');
    expect(button).not.toBeNull();
    assert(button instanceof HTMLDivElement);

    vi.spyOn(button, 'getBoundingClientRect').mockReturnValue({
      top: 10,
      left: 14,
      width: 88,
      height: 30,
      right: 102,
      bottom: 40,
      x: 14,
      y: 10,
      toJSON: () => ({}),
    });

    const postMessageSpy = vi
      .spyOn(window, 'postMessage')
      .mockImplementation(() => undefined);

    const runtime = createIterationInspectorRuntime({
      allowSelfMessaging: true,
    });
    runtime.start();

    window.dispatchEvent(
      new MessageEvent('message', {
        data: {
          channel: ITERATION_INSPECTOR_CHANNEL,
          kind: 'enter_select_mode',
        },
        origin: 'https://rogue.example',
        source: {} as Window,
      }),
    );

    expect(runtime.isActive()).toBe(false);

    window.dispatchEvent(
      new MessageEvent('message', {
        data: {
          channel: ITERATION_INSPECTOR_CHANNEL,
          kind: 'enter_select_mode',
        },
        origin: 'https://itera.example',
        source: window,
      }),
    );

    expect(runtime.isActive()).toBe(true);

    window.dispatchEvent(
      new MessageEvent('message', {
        data: {
          channel: ITERATION_INSPECTOR_CHANNEL,
          kind: 'exit_select_mode',
        },
        origin: 'https://nested-frame.example',
        source: window,
      }),
    );

    expect(runtime.isActive()).toBe(true);

    button.dispatchEvent(
      new MouseEvent('pointermove', {
        bubbles: true,
        cancelable: true,
      }),
    );
    button.dispatchEvent(
      new MouseEvent('click', {
        bubbles: true,
        cancelable: true,
      }),
    );

    expect(postMessageSpy).toHaveBeenCalledWith(
      expect.objectContaining({
        channel: ITERATION_INSPECTOR_CHANNEL,
        kind: 'element_selected',
      }),
      'https://itera.example',
    );

    runtime.stop();
  });
});
