import { given } from '#test/givenWhenThen';
import {
  ITERATION_INSPECTOR_CHANNEL,
  type IterationInspectorRuntimeMessage,
} from './types';
import { createIterationInspectorRuntime } from './runtime';

type RuntimeEditModeContext = {
  firstTarget: HTMLDivElement;
  secondTarget: HTMLDivElement;
  postMessageSpy: ReturnType<typeof vi.spyOn>;
  runtime: ReturnType<typeof createIterationInspectorRuntime>;
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

describe('iteration inspector runtime edit mode', () => {
  test('should keep select mode active across repeated selections in persistent mode', async () => {
    return given(givenPersistentRuntime)
      .when(whenFirstTargetIsSelected)
      .then(thenPersistentRuntimeRemainsActive)
      .when(whenSecondTargetIsSelected)
      .then(thenSecondSelectionIsAlsoEmitted)
      .then(thenRuntimeIsStopped);
  });
});
