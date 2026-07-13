import { describe, expect, it } from 'vitest';
import {
  ITERATION_INSPECTOR_CHANNEL,
  isIterationInspectorParentMessage,
  isIterationInspectorRuntimeMessage,
} from './iterationInspector';

const locator = {
  urlPath: '/projects/1', cssSelector: '#save', domPath: '/html[1]/body[1]/button[1]', tagName: 'button', role: 'button', accessibleName: 'Save', textPreview: 'Save', id: 'save', dataTestId: 'save',
  bounds: { top: 1, left: 2, width: 3, height: 4 }, scrollOffset: { x: 0, y: 0 }, capturedAt: '2026-07-13T00:00:00.000Z',
};

const parentMessages = [
  { channel: ITERATION_INSPECTOR_CHANNEL, kind: 'enter_select_mode', selectionMode: 'persistent' },
  { channel: ITERATION_INSPECTOR_CHANNEL, kind: 'exit_select_mode' },
  { channel: ITERATION_INSPECTOR_CHANNEL, kind: 'clear_hover' },
  { channel: ITERATION_INSPECTOR_CHANNEL, kind: 'sync_preview_edits', revision: 1, targets: [{ locator, operations: [{ fieldId: 'textContent', value: 'Updated', valueType: 'string' }] }] },
  { channel: ITERATION_INSPECTOR_CHANNEL, kind: 'clear_preview_edits', revision: 1 },
  { channel: ITERATION_INSPECTOR_CHANNEL, kind: 'capture_element_crop', requestId: 'capture-1', locator },
];

const runtimeMessages = [
  { channel: ITERATION_INSPECTOR_CHANNEL, kind: 'runtime_ready', urlPath: '/', capabilities: ['preview_edits_v1'] },
  { channel: ITERATION_INSPECTOR_CHANNEL, kind: 'mode_changed', active: true },
  { channel: ITERATION_INSPECTOR_CHANNEL, kind: 'element_selected', selection: { displayText: 'Save', element: locator, editableValues: { textContent: 'Save' } } },
  { channel: ITERATION_INSPECTOR_CHANNEL, kind: 'selection_invalidated', reason: 'reload' },
  { channel: ITERATION_INSPECTOR_CHANNEL, kind: 'preview_edits_status', revision: 1, appliedTargetCount: 1, errors: [{ code: 'invalid_value', message: 'Invalid', targetIndex: 0 }] },
  { channel: ITERATION_INSPECTOR_CHANNEL, kind: 'element_crop_captured', requestId: 'capture-1', result: { status: 'failed', reason: 'locator_not_found' } },
  { channel: ITERATION_INSPECTOR_CHANNEL, kind: 'debug_log', event: 'ready', details: {} },
];

describe('iteration inspector protocol', () => {
  it('accepts every parent and runtime message variant', () => {
    expect(parentMessages.every(isIterationInspectorParentMessage)).toBe(true);
    expect(runtimeMessages.every(isIterationInspectorRuntimeMessage)).toBe(true);
  });

  it('rejects malformed parent nested values and revisions', () => {
    expect(isIterationInspectorParentMessage({ ...parentMessages[3], revision: -1 })).toBe(false);
    expect(isIterationInspectorParentMessage({ ...parentMessages[3], targets: [{ locator, operations: [{ fieldId: 'textContent', value: 1 }] }] })).toBe(false);
    expect(isIterationInspectorParentMessage({ ...parentMessages[5], locator: { ...locator, bounds: { top: 1 } } })).toBe(false);
    expect(isIterationInspectorParentMessage({ ...parentMessages[5], locator: { ...locator, cssSelector: 1 } })).toBe(false);
    expect(isIterationInspectorParentMessage({ ...parentMessages[5], channel: 'wrong-channel' })).toBe(false);
  });

  it('rejects malformed runtime nested values, capabilities, and channels', () => {
    expect(isIterationInspectorRuntimeMessage({ ...runtimeMessages[0], capabilities: [1] })).toBe(false);
    expect(isIterationInspectorRuntimeMessage({ ...runtimeMessages[2], selection: { displayText: 'Save', element: locator, editableValues: { unknown: 'Save' } } })).toBe(false);
    expect(isIterationInspectorRuntimeMessage({ ...runtimeMessages[2], selection: { displayText: 'Save', element: { ...locator, bounds: { top: 1 } } } })).toBe(false);
    expect(isIterationInspectorRuntimeMessage({ ...runtimeMessages[4], revision: -1 })).toBe(false);
    expect(isIterationInspectorRuntimeMessage({ ...runtimeMessages[5], result: { status: 'captured', blob: {}, mimeType: 'image/png', width: 1, height: 1, capturedAt: '', method: 'canvas', rect: locator.bounds, scrollOffset: locator.scrollOffset, devicePixelRatio: 1, urlPath: '/' } })).toBe(false);
    expect(isIterationInspectorRuntimeMessage({ ...runtimeMessages[0], channel: 'wrong-channel' })).toBe(false);
  });
});
