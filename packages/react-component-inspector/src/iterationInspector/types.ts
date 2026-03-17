export const ITERATION_INSPECTOR_CHANNEL = 'itera:iteration-inspector';

export type IterationElementBounds = {
  top: number;
  left: number;
  width: number;
  height: number;
};

export type IterationScrollOffset = {
  x: number;
  y: number;
};

export type IterationElementLocator = {
  urlPath: string;
  cssSelector: string;
  domPath: string;
  tagName: string;
  role: string | null;
  accessibleName: string | null;
  textPreview: string | null;
  id: string | null;
  dataTestId: string | null;
  bounds: IterationElementBounds;
  scrollOffset: IterationScrollOffset;
  capturedAt: string;
  reactComponentPath?: ReadonlyArray<string>;
};

export type IterationElementSelection = {
  displayText: string;
  element: IterationElementLocator;
};

export type IterationInspectorInvalidationReason =
  | 'reload'
  | 'route_change'
  | 'node_detached';

export type IterationInspectorSelectionMode = 'single' | 'persistent';

export type IterationInspectorDebugDetails = Record<string, unknown>;

type IterationInspectorParentMessageDebugConfig = {
  debugEnabled?: boolean;
  debugSessionId?: string;
};

export type IterationInspectorParentMessage =
  | ({
      channel: typeof ITERATION_INSPECTOR_CHANNEL;
      kind: 'enter_select_mode';
      selectionMode?: IterationInspectorSelectionMode;
    } & IterationInspectorParentMessageDebugConfig)
  | ({
      channel: typeof ITERATION_INSPECTOR_CHANNEL;
      kind: 'exit_select_mode';
    } & IterationInspectorParentMessageDebugConfig)
  | ({
      channel: typeof ITERATION_INSPECTOR_CHANNEL;
      kind: 'clear_hover';
    } & IterationInspectorParentMessageDebugConfig);

export type IterationInspectorRuntimeMessage =
  | {
      channel: typeof ITERATION_INSPECTOR_CHANNEL;
      kind: 'runtime_ready';
      urlPath: string;
    }
  | {
      channel: typeof ITERATION_INSPECTOR_CHANNEL;
      kind: 'mode_changed';
      active: boolean;
    }
  | {
      channel: typeof ITERATION_INSPECTOR_CHANNEL;
      kind: 'element_selected';
      selection: IterationElementSelection;
    }
  | {
      channel: typeof ITERATION_INSPECTOR_CHANNEL;
      kind: 'selection_invalidated';
      reason: IterationInspectorInvalidationReason;
    }
  | {
      channel: typeof ITERATION_INSPECTOR_CHANNEL;
      kind: 'debug_log';
      event: string;
      sessionId?: string;
      details?: IterationInspectorDebugDetails;
    };

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null;

export const isIterationInspectorParentMessage = (
  value: unknown,
): value is IterationInspectorParentMessage => {
  if (!isRecord(value)) {
    return false;
  }

  if (value.channel !== ITERATION_INSPECTOR_CHANNEL) {
    return false;
  }

  return (
    value.kind === 'enter_select_mode' ||
    value.kind === 'exit_select_mode' ||
    value.kind === 'clear_hover'
  );
};

export const isIterationInspectorRuntimeMessage = (
  value: unknown,
): value is IterationInspectorRuntimeMessage => {
  if (!isRecord(value)) {
    return false;
  }

  if (value.channel !== ITERATION_INSPECTOR_CHANNEL) {
    return false;
  }

  return (
    value.kind === 'runtime_ready' ||
    value.kind === 'mode_changed' ||
    value.kind === 'element_selected' ||
    value.kind === 'selection_invalidated' ||
    value.kind === 'debug_log'
  );
};
