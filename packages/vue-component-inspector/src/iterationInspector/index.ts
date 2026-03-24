import {
  bootIterationInspectorRuntime as bootSharedIterationInspectorRuntime,
  buildIterationElementSelection as buildSharedIterationElementSelection,
  createIterationInspectorRuntime as createSharedIterationInspectorRuntime,
} from '../../../react-component-inspector/src/iterationInspector/runtime';
import {
  ITERATION_INSPECTOR_CHANNEL as SHARED_ITERATION_INSPECTOR_CHANNEL,
  isIterationInspectorParentMessage as isSharedIterationInspectorParentMessage,
  isIterationInspectorRuntimeMessage as isSharedIterationInspectorRuntimeMessage,
} from '../../../react-component-inspector/src/iterationInspector/types';
import type {
  IterationElementSelection,
  IterationInspectorParentMessage,
  IterationInspectorRuntime,
  IterationInspectorRuntimeMessage,
} from './types';

export {
  type IterationElementBounds,
  type IterationElementLocator,
  type IterationElementSelection,
  type IterationInspectorDebugDetails,
  type IterationInspectorInvalidationReason,
  type IterationInspectorParentMessage,
  type IterationInspectorRuntime,
  type IterationInspectorRuntimeMessage,
  type IterationInspectorSelectionMode,
  type IterationScrollOffset,
} from './types';

type CreateIterationInspectorRuntimeArgs = {
  allowSelfMessaging?: boolean;
  win?: Window;
  doc?: Document;
};

type BootIterationInspectorRuntimeArgs = Omit<
  CreateIterationInspectorRuntimeArgs,
  'win' | 'doc'
>;

export const ITERATION_INSPECTOR_CHANNEL: typeof SHARED_ITERATION_INSPECTOR_CHANNEL =
  SHARED_ITERATION_INSPECTOR_CHANNEL;

export const buildIterationElementSelection = (
  element: Element,
  win: Window = window,
  doc: Document = document,
): IterationElementSelection => {
  return buildSharedIterationElementSelection(element, win, doc);
};

export const createIterationInspectorRuntime = (
  args: CreateIterationInspectorRuntimeArgs = {},
): IterationInspectorRuntime => {
  return createSharedIterationInspectorRuntime(args);
};

export const bootIterationInspectorRuntime = (
  args: BootIterationInspectorRuntimeArgs = {},
): IterationInspectorRuntime | null => {
  return bootSharedIterationInspectorRuntime(args);
};

export const isIterationInspectorParentMessage = (
  value: unknown,
): value is IterationInspectorParentMessage => {
  return isSharedIterationInspectorParentMessage(value);
};

export const isIterationInspectorRuntimeMessage = (
  value: unknown,
): value is IterationInspectorRuntimeMessage => {
  return isSharedIterationInspectorRuntimeMessage(value);
};
