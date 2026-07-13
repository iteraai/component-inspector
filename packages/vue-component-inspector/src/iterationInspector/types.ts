export {
  ITERATION_INSPECTOR_CHANNEL,
  iterationInspectorRuntimeCapabilities,
  isIterationInspectorParentMessage,
  isIterationInspectorRuntimeMessage,
  type IterationElementBounds,
  type IterationElementCaptureFailure,
  type IterationElementCaptureFailureReason,
  type IterationElementCaptureFormat,
  type IterationElementCaptureMethod,
  type IterationElementCaptureResult,
  type IterationElementCaptureSuccess,
  type IterationEditableValueFieldId,
  type IterationEditableValues,
  type IterationElementLocator,
  type IterationElementSelection,
  type IterationInspectorDebugDetails,
  type IterationInspectorInvalidationReason,
  type IterationInspectorParentMessage,
  type IterationInspectorRuntimeCapability,
  type IterationInspectorRuntimeMessage,
  type IterationInspectorSelectionMode,
  type IterationPreviewEditError,
  type IterationPreviewEditErrorCode,
  type IterationPreviewEditOperation,
  type IterationPreviewEditValueType,
  type IterationPreviewTargetEdit,
  type IterationScrollOffset,
} from '@iteraai/inspector-protocol';

export type IterationInspectorRuntime = {
  start: () => void;
  stop: () => void;
  isActive: () => boolean;
};
