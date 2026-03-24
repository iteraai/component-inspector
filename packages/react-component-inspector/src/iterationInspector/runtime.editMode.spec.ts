import { given } from '#test/givenWhenThen';
import {
  ITERATION_INSPECTOR_CHANNEL,
  type IterationElementLocator,
  type IterationInspectorRuntimeMessage,
} from './types';
import {
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
  targetLocator: IterationElementLocator;
  imageLocator: IterationElementLocator;
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
      <img id="preview-image" alt="Preview" src="/initial.png" />
    </main>
  `;

  const target = document.getElementById('preview-target');
  const richTarget = document.getElementById('preview-rich-target');
  const imageTarget = document.getElementById('preview-image');

  expect(target).not.toBeNull();
  expect(richTarget).not.toBeNull();
  expect(imageTarget).not.toBeNull();
  assert(target instanceof HTMLDivElement);
  assert(richTarget instanceof HTMLDivElement);
  assert(imageTarget instanceof HTMLImageElement);

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
    targetLocator: buildIterationElementSelection(target).element,
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
  expect(context.target.style.width).toBe('240px');
  expect(context.target.style.backgroundColor).toBe('rgb(255, 0, 0)');
  expect(context.imageTarget.getAttribute('src')).toBe(
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
  expect(context.target.style.width).toBe('');
  expect(context.target.style.backgroundColor).toBe('');
  expect(context.imageTarget.getAttribute('src')).toBe('/initial.png');
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
});
