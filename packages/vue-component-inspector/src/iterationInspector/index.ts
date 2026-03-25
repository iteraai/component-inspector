import {
  bootIterationInspectorRuntime as bootSharedIterationInspectorRuntime,
  buildIterationElementSelection as buildSharedIterationElementSelection,
  createIterationInspectorRuntime as createSharedIterationInspectorRuntime,
} from '../../../react-component-inspector/src/iterationInspector/runtime';
import type {
  IterationElementSelection,
  IterationInspectorRuntime,
} from './types';

export {
  ITERATION_INSPECTOR_CHANNEL,
  isIterationInspectorParentMessage,
  isIterationInspectorRuntimeMessage,
  type IterationElementBounds,
  type IterationElementLocator,
  type IterationElementSelection,
  type IterationInspectorDebugDetails,
  type IterationInspectorInvalidationReason,
  type IterationInspectorParentMessage,
  type IterationInspectorRuntimeCapability,
  type IterationInspectorRuntime,
  type IterationInspectorRuntimeMessage,
  type IterationInspectorSelectionMode,
  type IterationPreviewEditError,
  type IterationPreviewEditErrorCode,
  type IterationPreviewEditOperation,
  type IterationPreviewEditValueType,
  type IterationPreviewTargetEdit,
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
