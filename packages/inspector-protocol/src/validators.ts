import {
  createInspectorProtocolError,
  type InspectorProtocolError,
  inspectorErrorCodes,
} from './errors';
import { isOriginTrusted, normalizeOrigin } from './origins';
import {
  embeddedToHostMessageTypes,
  hostToEmbeddedMessageTypes,
  INSPECTOR_CHANNEL,
  INSPECTOR_PROTOCOL_VERSION,
  serializablePlaceholderTypes,
  type AnyInspectorMessage,
  type InspectorMessage,
  type InspectorMessageType,
  type InspectorPayloadByType,
  type HelloAuthPayload,
  type NodeProps,
  type SerializablePlaceholder,
  type SerializableValue,
  type TreeNode,
} from './types';

type RawMessage = Record<string, unknown>;

export type BuildMessageOptions = {
  requestId?: string;
  sessionId?: string;
};

export type ParseMessageOptions = {
  sourceOrigin?: string;
  trustedOrigins?: readonly string[];
  expectedOrigin?: string;
  supportedVersion?: number;
};

export type ParseMessageResult =
  | {
      ok: true;
      message: AnyInspectorMessage;
    }
  | {
      ok: false;
      error: InspectorProtocolError;
    };

const validMessageTypes = new Set<string>([
  ...hostToEmbeddedMessageTypes,
  ...embeddedToHostMessageTypes,
]);

const isRecord = (value: unknown): value is Record<string, unknown> => {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
};

const isStringArray = (value: unknown): value is string[] => {
  return Array.isArray(value) && value.every((item) => typeof item === 'string');
};

const isStringOrStringArray = (
  value: unknown,
): value is string | string[] => {
  return typeof value === 'string' || isStringArray(value);
};

const isNonNegativeInteger = (value: unknown): value is number => {
  return typeof value === 'number' && Number.isInteger(value) && value >= 0;
};

const isPositiveInteger = (value: unknown): value is number => {
  return typeof value === 'number' && Number.isInteger(value) && value > 0;
};

const isFiniteNumber = (value: unknown): value is number => {
  return typeof value === 'number' && Number.isFinite(value);
};

const isHelloAuthMetadata = (value: unknown): boolean => {
  if (!isRecord(value)) {
    return false;
  }

  if (
    value.tokenType !== undefined &&
    typeof value.tokenType !== 'string'
  ) {
    return false;
  }

  if (
    value.issuer !== undefined &&
    typeof value.issuer !== 'string'
  ) {
    return false;
  }

  if (
    value.audience !== undefined &&
    !isStringOrStringArray(value.audience)
  ) {
    return false;
  }

  if (
    value.issuedAt !== undefined &&
    typeof value.issuedAt !== 'number'
  ) {
    return false;
  }

  if (
    value.expiresAt !== undefined &&
    typeof value.expiresAt !== 'number'
  ) {
    return false;
  }

  if (
    value.nonce !== undefined &&
    typeof value.nonce !== 'string'
  ) {
    return false;
  }

  return true;
};

const isHelloAuthPayload = (value: unknown): value is HelloAuthPayload => {
  if (!isRecord(value)) {
    return false;
  }

  if (typeof value.sessionToken !== 'string') {
    return false;
  }

  if (
    value.metadata !== undefined &&
    !isHelloAuthMetadata(value.metadata)
  ) {
    return false;
  }

  return true;
};

const isSerializablePlaceholder = (
  value: Record<string, unknown>,
): value is SerializablePlaceholder => {
  if (typeof value.__iteraType !== 'string') {
    return false;
  }

  if (
    !(serializablePlaceholderTypes as readonly string[]).includes(
      value.__iteraType,
    )
  ) {
    return false;
  }

  if (
    value.preview !== undefined &&
    typeof value.preview !== 'string'
  ) {
    return false;
  }

  return true;
};

const isSerializableValue = (
  value: unknown,
  depth = 0,
): value is SerializableValue => {
  if (depth > 12) {
    return false;
  }

  if (value === null) {
    return true;
  }

  if (['string', 'number', 'boolean'].includes(typeof value)) {
    return true;
  }

  if (Array.isArray(value)) {
    return value.every((entry) => isSerializableValue(entry, depth + 1));
  }

  if (!isRecord(value)) {
    return false;
  }

  if (isSerializablePlaceholder(value)) {
    return true;
  }

  return Object.values(value).every((entry) =>
    isSerializableValue(entry, depth + 1),
  );
};

const isTreeNode = (value: unknown): value is TreeNode => {
  if (!isRecord(value)) {
    return false;
  }

  if (
    typeof value.id !== 'string' ||
    typeof value.displayName !== 'string' ||
    !Array.isArray(value.childrenIds) ||
    !value.childrenIds.every((item) => typeof item === 'string')
  ) {
    return false;
  }

  if (value.parentId !== null && typeof value.parentId !== 'string') {
    return false;
  }

  if (value.source !== undefined) {
    if (!isRecord(value.source)) {
      return false;
    }

    if (
      typeof value.source.file !== 'string' ||
      typeof value.source.line !== 'number'
    ) {
      return false;
    }

    if (
      value.source.column !== undefined &&
      typeof value.source.column !== 'number'
    ) {
      return false;
    }
  }

  if (value.key !== undefined && typeof value.key !== 'string') {
    return false;
  }

  if (value.tags !== undefined && !isStringArray(value.tags)) {
    return false;
  }

  return true;
};

const isNodeProps = (value: unknown): value is NodeProps => {
  if (!isRecord(value)) {
    return false;
  }

  if (typeof value.nodeId !== 'string') {
    return false;
  }

  if (!isRecord(value.props)) {
    return false;
  }

  if (!Object.values(value.props).every((entry) => isSerializableValue(entry))) {
    return false;
  }

  if (!isRecord(value.meta)) {
    return false;
  }

  if (
    value.meta.truncated !== undefined &&
    typeof value.meta.truncated !== 'boolean'
  ) {
    return false;
  }

  if (value.meta.droppedKeys !== undefined && !isStringArray(value.meta.droppedKeys)) {
    return false;
  }

  if (
    value.meta.redactedCount !== undefined &&
    !isNonNegativeInteger(value.meta.redactedCount)
  ) {
    return false;
  }

  if (
    value.meta.redactedPaths !== undefined &&
    !isStringArray(value.meta.redactedPaths)
  ) {
    return false;
  }

  return true;
};

const isTreeSnapshotMeta = (value: unknown): boolean => {
  if (!isRecord(value)) {
    return false;
  }

  if (
    value.truncated !== undefined &&
    typeof value.truncated !== 'boolean'
  ) {
    return false;
  }

  if (
    value.totalNodeCount !== undefined &&
    !isNonNegativeInteger(value.totalNodeCount)
  ) {
    return false;
  }

  if (
    value.includedNodeCount !== undefined &&
    !isNonNegativeInteger(value.includedNodeCount)
  ) {
    return false;
  }

  if (
    value.truncatedNodeCount !== undefined &&
    !isNonNegativeInteger(value.truncatedNodeCount)
  ) {
    return false;
  }

  return true;
};

const isTreeSnapshotPayload = (value: unknown): boolean => {
  return (
    isRecord(value) &&
    Array.isArray(value.nodes) &&
    value.nodes.every((node) => isTreeNode(node)) &&
    isStringArray(value.rootIds) &&
    (value.meta === undefined || isTreeSnapshotMeta(value.meta))
  );
};

const isBlobValue = (value: unknown): value is Blob => {
  return typeof Blob !== 'undefined' && value instanceof Blob;
};

const expectsNoPayload = (type: InspectorMessageType): boolean => {
  return type === 'CLEAR_HIGHLIGHT';
};

const validatePayloadByType = (
  type: InspectorMessageType,
  payload: unknown,
): boolean => {
  switch (type) {
    case 'HELLO': {
      if (payload === undefined) {
        return true;
      }

      return (
        isRecord(payload) &&
        (payload.capabilities === undefined ||
          isStringArray(payload.capabilities)) &&
        (payload.auth === undefined || isHelloAuthPayload(payload.auth))
      );
    }

    case 'READY': {
      if (payload === undefined) {
        return true;
      }

      return isRecord(payload) &&
        (payload.capabilities === undefined || isStringArray(payload.capabilities));
    }

    case 'REQUEST_TREE': {
      if (payload === undefined) {
        return true;
      }

      return (
        isRecord(payload) &&
        (payload.includeSource === undefined ||
          typeof payload.includeSource === 'boolean')
      );
    }

    case 'REQUEST_SNAPSHOT': {
      if (payload === undefined) {
        return true;
      }

      return (
        isRecord(payload) &&
        (payload.includeTree === undefined ||
          typeof payload.includeTree === 'boolean') &&
        (payload.includeHtml === undefined ||
          typeof payload.includeHtml === 'boolean')
      );
    }

    case 'REQUEST_NODE_PROPS':
    case 'HIGHLIGHT_NODE':
    case 'NODE_SELECTED': {
      return isRecord(payload) && typeof payload.nodeId === 'string';
    }

    case 'CLEAR_HIGHLIGHT': {
      return payload === undefined;
    }

    case 'PING':
    case 'PONG': {
      if (payload === undefined) {
        return true;
      }

      return isRecord(payload) &&
        (payload.sentAt === undefined || typeof payload.sentAt === 'number');
    }

    case 'TREE_SNAPSHOT': {
      return isTreeSnapshotPayload(payload);
    }

    case 'TREE_DELTA': {
      return (
        isRecord(payload) &&
        Array.isArray(payload.addedNodes) &&
        payload.addedNodes.every((node) => isTreeNode(node)) &&
        Array.isArray(payload.updatedNodes) &&
        payload.updatedNodes.every((node) => isTreeNode(node)) &&
        isStringArray(payload.removedNodeIds)
      );
    }

    case 'NODE_PROPS': {
      return isNodeProps(payload);
    }

    case 'SNAPSHOT': {
      return (
        isRecord(payload) &&
        isBlobValue(payload.capture) &&
        typeof payload.captureMimeType === 'string' &&
        isPositiveInteger(payload.width) &&
        isPositiveInteger(payload.height) &&
        isFiniteNumber(payload.capturedAt) &&
        payload.capturedAt >= 0 &&
        isTreeSnapshotPayload(payload.treeSnapshot) &&
        (payload.html === undefined || typeof payload.html === 'string') &&
        (payload.htmlTruncated === undefined ||
          typeof payload.htmlTruncated === 'boolean')
      );
    }

    case 'ERROR': {
      return (
        isRecord(payload) &&
        typeof payload.code === 'string' &&
        (inspectorErrorCodes as readonly string[]).includes(payload.code) &&
        typeof payload.message === 'string' &&
        (payload.details === undefined ||
          (isRecord(payload.details) &&
            Object.values(payload.details).every((value) =>
              isSerializableValue(value),
            )))
      );
    }
  }
};

const toRawMessage = (raw: unknown): RawMessage | undefined => {
  if (typeof raw === 'string') {
    try {
      const parsed = JSON.parse(raw) as unknown;

      if (!isRecord(parsed)) {
        return undefined;
      }

      return parsed;
    } catch {
      return undefined;
    }
  }

  if (!isRecord(raw)) {
    return undefined;
  }

  return raw;
};

const validateOrigin = (
  options: ParseMessageOptions,
): InspectorProtocolError | undefined => {
  if (options.sourceOrigin === undefined) {
    return undefined;
  }

  const normalizedSourceOrigin = normalizeOrigin(options.sourceOrigin);

  if (normalizedSourceOrigin === undefined) {
    return createInspectorProtocolError(
      'ERR_INVALID_ORIGIN',
      `Source origin ${options.sourceOrigin} is not a valid URL origin.`,
    );
  }

  if (
    options.expectedOrigin !== undefined
  ) {
    const normalizedExpectedOrigin = normalizeOrigin(options.expectedOrigin);

    if (normalizedExpectedOrigin === undefined) {
      return createInspectorProtocolError(
        'ERR_INVALID_ORIGIN',
        `Expected origin ${options.expectedOrigin} is not a valid URL origin.`,
      );
    }

    if (normalizedSourceOrigin !== normalizedExpectedOrigin) {
      return createInspectorProtocolError(
        'ERR_INVALID_ORIGIN',
        `Expected ${normalizedExpectedOrigin} but received ${normalizedSourceOrigin}.`,
      );
    }
  }

  if (
    options.trustedOrigins !== undefined &&
    !isOriginTrusted(normalizedSourceOrigin, options.trustedOrigins)
  ) {
    return createInspectorProtocolError(
      'ERR_INVALID_ORIGIN',
      `Origin ${normalizedSourceOrigin} is not in host allowlist.`,
    );
  }

  return undefined;
};

export const buildMessage = <Type extends InspectorMessageType>(
  type: Type,
  payload: InspectorPayloadByType[Type],
  options: BuildMessageOptions = {},
): InspectorMessage<Type> => {
  const baseEnvelope = {
    channel: INSPECTOR_CHANNEL,
    version: INSPECTOR_PROTOCOL_VERSION,
    type,
    requestId: options.requestId,
    sessionId: options.sessionId,
  };

  if (payload === undefined) {
    return baseEnvelope as unknown as InspectorMessage<Type>;
  }

  return {
    ...baseEnvelope,
    payload,
  } as unknown as InspectorMessage<Type>;
};

export const parseMessage = (
  raw: unknown,
  options: ParseMessageOptions = {},
): ParseMessageResult => {
  const parsedMessage = toRawMessage(raw);

  if (parsedMessage === undefined) {
    return {
      ok: false,
      error: createInspectorProtocolError(
        'ERR_INVALID_MESSAGE',
        'Incoming message must be an object or JSON string object.',
      ),
    };
  }

  const originError = validateOrigin(options);

  if (originError !== undefined) {
    return {
      ok: false,
      error: originError,
    };
  }

  if (parsedMessage.channel !== INSPECTOR_CHANNEL) {
    return {
      ok: false,
      error: createInspectorProtocolError(
        'ERR_INVALID_MESSAGE',
        `Invalid channel ${String(parsedMessage.channel)}.`,
      ),
    };
  }

  if (typeof parsedMessage.version !== 'number') {
    return {
      ok: false,
      error: createInspectorProtocolError(
        'ERR_INVALID_MESSAGE',
        'Message version must be a number.',
      ),
    };
  }

  const supportedVersion =
    options.supportedVersion ?? INSPECTOR_PROTOCOL_VERSION;

  if (parsedMessage.version !== supportedVersion) {
    return {
      ok: false,
      error: createInspectorProtocolError(
        'ERR_UNSUPPORTED_VERSION',
        `Expected version ${supportedVersion} but received ${parsedMessage.version}.`,
      ),
    };
  }

  if (typeof parsedMessage.type !== 'string') {
    return {
      ok: false,
      error: createInspectorProtocolError(
        'ERR_INVALID_MESSAGE',
        'Message type must be a string.',
      ),
    };
  }

  if (!validMessageTypes.has(parsedMessage.type)) {
    return {
      ok: false,
      error: createInspectorProtocolError(
        'ERR_UNKNOWN_MESSAGE_TYPE',
        `Message type ${parsedMessage.type} is not part of protocol v1.`,
      ),
    };
  }

  if (
    parsedMessage.requestId !== undefined &&
    typeof parsedMessage.requestId !== 'string'
  ) {
    return {
      ok: false,
      error: createInspectorProtocolError(
        'ERR_INVALID_MESSAGE',
        'requestId must be a string when provided.',
      ),
    };
  }

  if (
    parsedMessage.sessionId !== undefined &&
    typeof parsedMessage.sessionId !== 'string'
  ) {
    return {
      ok: false,
      error: createInspectorProtocolError(
        'ERR_INVALID_MESSAGE',
        'sessionId must be a string when provided.',
      ),
    };
  }

  const messageType = parsedMessage.type as InspectorMessageType;
  const payload = parsedMessage.payload;

  if (expectsNoPayload(messageType) && payload !== undefined) {
    return {
      ok: false,
      error: createInspectorProtocolError(
        'ERR_INVALID_PAYLOAD',
        `${messageType} does not accept a payload.`,
      ),
    };
  }

  if (!validatePayloadByType(messageType, payload)) {
    return {
      ok: false,
      error: createInspectorProtocolError(
        'ERR_INVALID_PAYLOAD',
        `Payload does not satisfy ${messageType} contract.`,
      ),
    };
  }

  return {
    ok: true,
    message: parsedMessage as AnyInspectorMessage,
  };
};

export const isInspectorMessage = (raw: unknown): raw is AnyInspectorMessage => {
  return parseMessage(raw).ok;
};
