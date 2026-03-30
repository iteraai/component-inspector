import { given } from '#test/givenWhenThen';
import {
  ITERATION_INSPECTOR_CHANNEL,
  type IterationElementLocator,
  type IterationEditableValues,
  type IterationInspectorRuntimeMessage,
} from './types';
import {
  bootIterationInspectorRuntime,
  buildIterationElementSelection,
  createIterationInspectorRuntime,
} from './runtime';

type RuntimeEditModeContext = {
  firstTarget: HTMLDivElement;
  secondTarget: HTMLDivElement;
  postMessageSpy: ReturnType<typeof vi.spyOn>;
  runtime: ReturnType<typeof createIterationInspectorRuntime>;
};

type PreviewEditsContext = {
  imageTarget: HTMLImageElement;
  postMessageSpy: ReturnType<typeof vi.spyOn>;
  richTarget: HTMLDivElement;
  richTargetLocator: IterationElementLocator;
  runtime: ReturnType<typeof createIterationInspectorRuntime>;
  target: HTMLDivElement;
  targetTextNode: Text;
  targetLocator: IterationElementLocator;
  imageLocator: IterationElementLocator;
};

type EditableValuesContext = {
  postMessageSpy: ReturnType<typeof vi.spyOn>;
  runtime: ReturnType<typeof createIterationInspectorRuntime>;
  target: HTMLDivElement;
};

const getPostedMessages = (
  postMessageSpy: ReturnType<typeof vi.spyOn>,
): IterationInspectorRuntimeMessage[] => {
  return postMessageSpy.mock.calls.flatMap(([message]) => {
    return typeof message === 'object' && message !== null
      ? [message as IterationInspectorRuntimeMessage]
      : [];
  });
};

const givenPersistentRuntime = (): RuntimeEditModeContext => {
  document.body.innerHTML = `
    <main>
      <div id="first-target"><span>First</span></div>
      <div id="second-target"><span>Second</span></div>
    </main>
  `;

  const firstTarget = document.getElementById('first-target');
  const secondTarget = document.getElementById('second-target');

  expect(firstTarget).not.toBeNull();
  expect(secondTarget).not.toBeNull();
  assert(firstTarget instanceof HTMLDivElement);
  assert(secondTarget instanceof HTMLDivElement);

  vi.spyOn(firstTarget, 'getBoundingClientRect').mockReturnValue({
    top: 16,
    left: 16,
    width: 80,
    height: 32,
    right: 96,
    bottom: 48,
    x: 16,
    y: 16,
    toJSON: () => ({}),
  });
  vi.spyOn(secondTarget, 'getBoundingClientRect').mockReturnValue({
    top: 64,
    left: 16,
    width: 96,
    height: 32,
    right: 112,
    bottom: 96,
    x: 16,
    y: 64,
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
        selectionMode: 'persistent',
      },
      origin: 'https://itera.example',
      source: window,
    }),
  );

  return {
    firstTarget,
    secondTarget,
    postMessageSpy,
    runtime,
  };
};

const givenPreviewEditsRuntime = (): PreviewEditsContext => {
  document.body.innerHTML = `
    <main>
      <div id="preview-target" data-testid="preview-card">Original copy</div>
      <div id="preview-rich-target" data-testid="preview-rich-card">
        <strong id="preview-rich-strong">Original</strong>
        <span> nested copy</span>
      </div>
      <img
        id="preview-image"
        alt="Preview"
        src="/initial.png"
        srcset="/initial-small.png 1x, /initial-large.png 2x"
      />
    </main>
  `;

  const target = document.getElementById('preview-target');
  const richTarget = document.getElementById('preview-rich-target');
  const imageTarget = document.getElementById('preview-image');
  const targetTextNode = target?.firstChild;

  expect(target).not.toBeNull();
  expect(richTarget).not.toBeNull();
  expect(imageTarget).not.toBeNull();
  expect(targetTextNode).not.toBeNull();
  assert(target instanceof HTMLDivElement);
  assert(richTarget instanceof HTMLDivElement);
  assert(imageTarget instanceof HTMLImageElement);
  assert(targetTextNode instanceof Text);

  vi.spyOn(target, 'getBoundingClientRect').mockReturnValue({
    top: 12,
    left: 24,
    width: 120,
    height: 40,
    right: 144,
    bottom: 52,
    x: 24,
    y: 12,
    toJSON: () => ({}),
  });
  vi.spyOn(imageTarget, 'getBoundingClientRect').mockReturnValue({
    top: 72,
    left: 24,
    width: 96,
    height: 96,
    right: 120,
    bottom: 168,
    x: 24,
    y: 72,
    toJSON: () => ({}),
  });
  vi.spyOn(richTarget, 'getBoundingClientRect').mockReturnValue({
    top: 132,
    left: 24,
    width: 180,
    height: 44,
    right: 204,
    bottom: 176,
    x: 24,
    y: 132,
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
    imageLocator: buildIterationElementSelection(imageTarget).element,
    imageTarget,
    postMessageSpy,
    richTarget,
    richTargetLocator: buildIterationElementSelection(richTarget).element,
    runtime,
    target,
    targetTextNode,
    targetLocator: buildIterationElementSelection(target).element,
  };
};

const givenEditableValuesRuntime = (
  options: {
    allowSelfMessaging?: boolean;
    urlPath?: string;
  } = {},
): EditableValuesContext => {
  const { allowSelfMessaging = true, urlPath = '/editor' } = options;

  window.history.replaceState({}, '', urlPath);
  document.body.innerHTML = `
    <main>
      <div
        id="editable-target"
        data-testid="editable-card"
        style="
          display: flex;
          flex-direction: row;
          justify-content: center;
          align-items: stretch;
          align-self: flex-end;
          background-color: rgb(18, 52, 86);
          color: rgb(101, 102, 103);
          font-size: 18px;
          font-weight: 700;
          padding: 8px 12px;
          margin: 4px 8px;
          border-radius: 10px;
          background-image: url('https://cdn.example.com/card.png');
        "
      >
        Editable card
      </div>
    </main>
  `;

  const target = document.getElementById('editable-target');

  expect(target).not.toBeNull();
  assert(target instanceof HTMLDivElement);
  vi.spyOn(target, 'getBoundingClientRect').mockReturnValue({
    top: 24,
    left: 16,
    width: 120,
    height: 44,
    right: 136,
    bottom: 68,
    x: 16,
    y: 24,
    toJSON: () => ({}),
  });

  const postMessageSpy = vi
    .spyOn(window, 'postMessage')
    .mockImplementation(() => undefined);
  const runtime = createIterationInspectorRuntime({
    allowSelfMessaging,
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

  return {
    postMessageSpy,
    runtime,
    target,
  };
};

const whenPreviewEditsAreSynced = (
  context: PreviewEditsContext,
): PreviewEditsContext => {
  window.dispatchEvent(
    new MessageEvent('message', {
      data: {
        channel: ITERATION_INSPECTOR_CHANNEL,
        kind: 'sync_preview_edits',
        revision: 1,
        targets: [
          {
            locator: context.targetLocator,
            operations: [
              {
                fieldId: 'textContent',
                value: 'Updated copy',
                valueType: 'string',
              },
              {
                fieldId: 'backgroundColor',
                value: '#ff0000',
                valueType: 'string',
              },
              {
                fieldId: 'width',
                value: '240',
                valueType: 'number',
              },
            ],
          },
          {
            locator: context.imageLocator,
            operations: [
              {
                fieldId: 'assetReference',
                value: 'https://example.com/preview.png',
                valueType: 'asset_reference',
              },
            ],
          },
        ],
      },
      origin: 'https://itera.example',
      source: window,
    }),
  );

  return context;
};

const thenPreviewEditsAreApplied = (
  context: PreviewEditsContext,
): PreviewEditsContext => {
  expect(context.target.textContent).toBe('Updated copy');
  expect(context.targetTextNode.isConnected).toBe(true);
  expect(context.targetTextNode.textContent).toBe('Updated copy');
  expect(context.target.style.width).toBe('240px');
  expect(context.target.style.backgroundColor).toBe('rgb(255, 0, 0)');
  expect(context.imageTarget.getAttribute('src')).toBe(
    'https://example.com/preview.png',
  );
  expect(context.imageTarget.getAttribute('srcset')).toBe(
    'https://example.com/preview.png',
  );
  expect(getPostedMessages(context.postMessageSpy)).toEqual(
    expect.arrayContaining([
      expect.objectContaining({
        channel: ITERATION_INSPECTOR_CHANNEL,
        kind: 'preview_edits_status',
        revision: 1,
        appliedTargetCount: 2,
      }),
    ]),
  );

  return context;
};

const whenPreviewEditsAreCleared = (
  context: PreviewEditsContext,
): PreviewEditsContext => {
  window.dispatchEvent(
    new MessageEvent('message', {
      data: {
        channel: ITERATION_INSPECTOR_CHANNEL,
        kind: 'clear_preview_edits',
        revision: 2,
      },
      origin: 'https://itera.example',
      source: window,
    }),
  );

  return context;
};

const thenPreviewEditsAreRestored = (
  context: PreviewEditsContext,
): PreviewEditsContext => {
  expect(context.target.textContent).toBe('Original copy');
  expect(context.targetTextNode.isConnected).toBe(true);
  expect(context.targetTextNode.textContent).toBe('Original copy');
  expect(context.target.style.width).toBe('');
  expect(context.target.style.backgroundColor).toBe('');
  expect(context.imageTarget.getAttribute('src')).toBe('/initial.png');
  expect(context.imageTarget.getAttribute('srcset')).toBe(
    '/initial-small.png 1x, /initial-large.png 2x',
  );
  expect(getPostedMessages(context.postMessageSpy)).toEqual(
    expect.arrayContaining([
      expect.objectContaining({
        channel: ITERATION_INSPECTOR_CHANNEL,
        kind: 'preview_edits_status',
        revision: 2,
        appliedTargetCount: 0,
      }),
    ]),
  );

  return context;
};

const whenInvalidPreviewEditsAreSynced = (
  context: PreviewEditsContext,
): PreviewEditsContext => {
  window.dispatchEvent(
    new MessageEvent('message', {
      data: {
        channel: ITERATION_INSPECTOR_CHANNEL,
        kind: 'sync_preview_edits',
        revision: 3,
        targets: [
          {
            locator: {
              ...context.targetLocator,
              urlPath: '/other-route',
            },
            operations: [
              {
                fieldId: 'textContent',
                value: 'Ignored copy',
                valueType: 'string',
              },
            ],
          },
          {
            locator: context.targetLocator,
            operations: [
              {
                fieldId: 'unsupportedField',
                value: '123',
                valueType: 'string',
              },
            ],
          },
        ],
      },
      origin: 'https://itera.example',
      source: window,
    }),
  );

  return context;
};

const whenNestedTextPreviewEditIsSynced = (
  context: PreviewEditsContext,
): PreviewEditsContext => {
  window.dispatchEvent(
    new MessageEvent('message', {
      data: {
        channel: ITERATION_INSPECTOR_CHANNEL,
        kind: 'sync_preview_edits',
        revision: 4,
        targets: [
          {
            locator: context.richTargetLocator,
            operations: [
              {
                fieldId: 'textContent',
                value: 'Flattened copy',
                valueType: 'string',
              },
            ],
          },
        ],
      },
      origin: 'https://itera.example',
      source: window,
    }),
  );

  return context;
};

const thenNestedTextPreviewEditIsApplied = (
  context: PreviewEditsContext,
): PreviewEditsContext => {
  expect(context.richTarget.textContent).toBe('Flattened copy');
  expect(context.richTarget.querySelector('#preview-rich-strong')).toBeNull();

  return context;
};

const thenNestedTextPreviewEditsRestoreOriginalChildren = (
  context: PreviewEditsContext,
): PreviewEditsContext => {
  const strong = context.richTarget.querySelector('#preview-rich-strong');
  expect(strong).not.toBeNull();
  expect(context.richTarget.innerHTML).toContain('<strong id="preview-rich-strong">Original</strong>');
  expect(context.richTarget.textContent?.replaceAll(/\s+/g, ' ').trim()).toBe(
    'Original nested copy',
  );

  const clickSpy = vi.fn();
  strong!.addEventListener('click', clickSpy);
  strong!.dispatchEvent(new MouseEvent('click', { bubbles: true }));

  expect(clickSpy).toHaveBeenCalledTimes(1);

  return context;
};

const thenPreviewEditFailuresAreReported = (
  context: PreviewEditsContext,
): PreviewEditsContext => {
  expect(context.target.textContent).toBe('Original copy');

  expect(getPostedMessages(context.postMessageSpy)).toEqual(
    expect.arrayContaining([
      expect.objectContaining({
        channel: ITERATION_INSPECTOR_CHANNEL,
        kind: 'preview_edits_status',
        revision: 3,
        appliedTargetCount: 0,
        errors: expect.arrayContaining([
          expect.objectContaining({
            code: 'url_mismatch',
            targetIndex: 0,
          }),
          expect.objectContaining({
            code: 'unsupported_field',
            fieldId: 'unsupportedField',
            targetIndex: 1,
          }),
        ]),
      }),
    ]),
  );

  return context;
};

const thenRuntimeAdvertisesPreviewEditCapability = (
  context: PreviewEditsContext,
): PreviewEditsContext => {
  expect(getPostedMessages(context.postMessageSpy)).toEqual(
    expect.arrayContaining([
      expect.objectContaining({
        channel: ITERATION_INSPECTOR_CHANNEL,
        kind: 'runtime_ready',
        capabilities: ['preview_edits_v1'],
      }),
    ]),
  );

  return context;
};

const getSelectionMessages = (
  postMessageSpy: ReturnType<typeof vi.spyOn>,
) => {
  return getPostedMessages(postMessageSpy).filter(
    (
      message,
    ): message is Extract<
      IterationInspectorRuntimeMessage,
      {
        kind: 'element_selected';
      }
    > => message.kind === 'element_selected',
  );
};

const whenEditableTargetIsSelected = (
  context: EditableValuesContext,
): EditableValuesContext => {
  context.target.dispatchEvent(
    new MouseEvent('click', {
      bubbles: true,
      cancelable: true,
      clientX: 24,
      clientY: 32,
    }),
  );

  return context;
};

const thenSelectionCarriesEditableValues = (
  context: EditableValuesContext,
): EditableValuesContext => {
  const expectedEditableValues = {
    display: 'flex',
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'stretch',
    alignSelf: 'flex-end',
    backgroundColor: 'rgb(18, 52, 86)',
    textColor: 'rgb(101, 102, 103)',
    fontSize: '18px',
    fontWeight: '700',
    textContent: 'Editable card',
    assetReference: 'https://cdn.example.com/card.png',
    padding: '8px 12px',
    margin: '4px 8px',
    borderRadius: '',
  } satisfies IterationEditableValues;

  expect(getSelectionMessages(context.postMessageSpy).at(-1)).toEqual(
    expect.objectContaining({
      channel: ITERATION_INSPECTOR_CHANNEL,
      kind: 'element_selected',
      selection: expect.objectContaining({
        displayText: '@div "Editable card"',
        editableValues: expectedEditableValues,
      }),
    }),
  );

  return context;
};

const thenSelectionIncludesResolvedLocator = (
  context: EditableValuesContext,
): EditableValuesContext => {
  expect(getSelectionMessages(context.postMessageSpy).at(-1)).toEqual(
    expect.objectContaining({
      selection: expect.objectContaining({
        element: expect.objectContaining({
          urlPath: '/editor',
          cssSelector: 'div#editable-target',
        }),
      }),
    }),
  );

  return context;
};

const thenTopLevelBootSkipsRuntimeStartup = () => {
  expect(bootIterationInspectorRuntime()).toBeNull();
};

const whenFirstTargetIsSelected = (
  context: RuntimeEditModeContext,
): RuntimeEditModeContext => {
  const clickEvent = new MouseEvent('click', {
    bubbles: true,
    cancelable: true,
    clientX: 20,
    clientY: 20,
  });

  context.firstTarget.dispatchEvent(clickEvent);

  return context;
};

const thenPersistentRuntimeRemainsActive = (
  context: RuntimeEditModeContext,
): RuntimeEditModeContext => {
  const messages = getPostedMessages(context.postMessageSpy);

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
          displayText: '@div "First"',
        }),
      }),
    ]),
  );
  expect(messages).not.toEqual(
    expect.arrayContaining([
      {
        channel: ITERATION_INSPECTOR_CHANNEL,
        kind: 'mode_changed',
        active: false,
      },
    ]),
  );
  expect(context.runtime.isActive()).toBe(true);

  return context;
};

const whenSecondTargetIsSelected = (
  context: RuntimeEditModeContext,
): RuntimeEditModeContext => {
  const clickEvent = new MouseEvent('click', {
    bubbles: true,
    cancelable: true,
    clientX: 24,
    clientY: 72,
  });

  context.secondTarget.dispatchEvent(clickEvent);

  return context;
};

const thenSecondSelectionIsAlsoEmitted = (
  context: RuntimeEditModeContext,
): RuntimeEditModeContext => {
  const selectionMessages = getPostedMessages(context.postMessageSpy).filter(
    (message) => message.kind === 'element_selected',
  );

  expect(selectionMessages).toHaveLength(2);
  expect(selectionMessages[1]).toEqual(
    expect.objectContaining({
      selection: expect.objectContaining({
        displayText: '@div "Second"',
      }),
    }),
  );
  expect(context.runtime.isActive()).toBe(true);

  return context;
};

const thenRuntimeIsStopped = (
  context: RuntimeEditModeContext,
): RuntimeEditModeContext => {
  context.runtime.stop();
  context.postMessageSpy.mockRestore();
  return context;
};

const thenPreviewRuntimeIsStopped = (
  context: PreviewEditsContext,
): PreviewEditsContext => {
  context.runtime.stop();
  context.postMessageSpy.mockRestore();
  return context;
};

const thenEditableValuesRuntimeIsStopped = (
  context: EditableValuesContext,
): EditableValuesContext => {
  context.runtime.stop();
  context.postMessageSpy.mockRestore();
  return context;
};

describe('iteration inspector runtime edit mode', () => {
  test('should keep select mode active across repeated selections in persistent mode', async () => {
    return given(givenPersistentRuntime)
      .when(whenFirstTargetIsSelected)
      .then(thenPersistentRuntimeRemainsActive)
      .when(whenSecondTargetIsSelected)
      .then(thenSecondSelectionIsAlsoEmitted)
      .then(thenRuntimeIsStopped);
  });

  test('should advertise preview patch capability when the runtime starts', async () => {
    return given(givenPreviewEditsRuntime)
      .then(thenRuntimeAdvertisesPreviewEditCapability)
      .then(thenPreviewRuntimeIsStopped);
  });

  test('should apply preview edits and restore original DOM state when cleared', async () => {
    return given(givenPreviewEditsRuntime)
      .when(whenPreviewEditsAreSynced)
      .then(thenPreviewEditsAreApplied)
      .when(whenPreviewEditsAreCleared)
      .then(thenPreviewEditsAreRestored)
      .then(thenPreviewRuntimeIsStopped);
  });

  test('should fail soft when preview targets cannot be resolved or a field is unsupported', async () => {
    return given(givenPreviewEditsRuntime)
      .when(whenInvalidPreviewEditsAreSynced)
      .then(thenPreviewEditFailuresAreReported)
      .then(thenPreviewRuntimeIsStopped);
  });

  test('should restore nested child content after text preview edits are cleared', async () => {
    return given(givenPreviewEditsRuntime)
      .when(whenNestedTextPreviewEditIsSynced)
      .then(thenNestedTextPreviewEditIsApplied)
      .when(whenPreviewEditsAreCleared)
      .then(thenNestedTextPreviewEditsRestoreOriginalChildren)
      .then(thenPreviewRuntimeIsStopped);
  });

  test('should include editable values when an element is selected', async () => {
    return given(givenEditableValuesRuntime)
      .when(whenEditableTargetIsSelected)
      .then(thenSelectionCarriesEditableValues)
      .then(thenSelectionIncludesResolvedLocator)
      .then(thenEditableValuesRuntimeIsStopped);
  });

  test('should skip runtime startup outside embedded runtime contexts', async () => {
    return given(() => undefined).then(thenTopLevelBootSkipsRuntimeStartup);
  });
});
