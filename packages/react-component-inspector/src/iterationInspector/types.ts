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
  componentPath?: ReadonlyArray<string>;
  // Legacy compatibility alias for existing React consumers.
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
  typeof value === 'object' && value !== null && !Array.isArray(value);

const isFiniteNumber = (value: unknown): value is number =>
  typeof value === 'number' && Number.isFinite(value);

const isStringOrNull = (value: unknown): value is string | null =>
  typeof value === 'string' || value === null;

const isComponentPath = (value: unknown): value is ReadonlyArray<string> =>
  Array.isArray(value) &&
  value.length > 0 &&
  value.every(
    (segment) => typeof segment === 'string' && segment.trim().length > 0,
  );

const isIterationElementBounds = (
  value: unknown,
): value is IterationElementBounds => {
  if (!isRecord(value)) {
    return false;
  }

  return (
    isFiniteNumber(value.top) &&
    isFiniteNumber(value.left) &&
    isFiniteNumber(value.width) &&
    isFiniteNumber(value.height)
  );
};

const isIterationScrollOffset = (
  value: unknown,
): value is IterationScrollOffset => {
  if (!isRecord(value)) {
    return false;
  }

  return isFiniteNumber(value.x) && isFiniteNumber(value.y);
};

const isIterationElementLocator = (
  value: unknown,
): value is IterationElementLocator => {
  if (!isRecord(value)) {
    return false;
  }

  if (
    typeof value.urlPath !== 'string' ||
    typeof value.cssSelector !== 'string' ||
    typeof value.domPath !== 'string' ||
    typeof value.tagName !== 'string' ||
    !isStringOrNull(value.role) ||
    !isStringOrNull(value.accessibleName) ||
    !isStringOrNull(value.textPreview) ||
    !isStringOrNull(value.id) ||
    !isStringOrNull(value.dataTestId) ||
    !isIterationElementBounds(value.bounds) ||
    !isIterationScrollOffset(value.scrollOffset) ||
    typeof value.capturedAt !== 'string'
  ) {
    return false;
  }

  if (
    value.componentPath !== undefined &&
    !isComponentPath(value.componentPath)
  ) {
    return false;
  }

  if (
    value.reactComponentPath !== undefined &&
    !isComponentPath(value.reactComponentPath)
  ) {
    return false;
  }

  return true;
};

const isIterationElementSelection = (
  value: unknown,
): value is IterationElementSelection => {
  if (!isRecord(value)) {
    return false;
  }

  return (
    typeof value.displayText === 'string' &&
    isIterationElementLocator(value.element)
  );
};

const isParentMessageDebugConfig = (value: Record<string, unknown>) => {
  return (
    (value.debugEnabled === undefined ||
      typeof value.debugEnabled === 'boolean') &&
    (value.debugSessionId === undefined ||
      typeof value.debugSessionId === 'string')
  );
};

export const isIterationInspectorParentMessage = (
  value: unknown,
): value is IterationInspectorParentMessage => {
  if (!isRecord(value)) {
    return false;
  }

  if (value.channel !== ITERATION_INSPECTOR_CHANNEL) {
    return false;
  }

  if (!isParentMessageDebugConfig(value)) {
    return false;
  }

  switch (value.kind) {
    case 'enter_select_mode':
      return (
        value.selectionMode === undefined ||
        value.selectionMode === 'single' ||
        value.selectionMode === 'persistent'
      );
    case 'exit_select_mode':
    case 'clear_hover':
      return true;
    default:
      return false;
  }
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

  switch (value.kind) {
    case 'runtime_ready':
      return typeof value.urlPath === 'string';
    case 'mode_changed':
      return typeof value.active === 'boolean';
    case 'element_selected':
      return isIterationElementSelection(value.selection);
    case 'selection_invalidated':
      return (
        value.reason === 'reload' ||
        value.reason === 'route_change' ||
        value.reason === 'node_detached'
      );
    case 'debug_log':
      return (
        typeof value.event === 'string' &&
        (value.sessionId === undefined ||
          typeof value.sessionId === 'string') &&
        (value.details === undefined || isRecord(value.details))
      );
    default:
      return false;
  }
};
