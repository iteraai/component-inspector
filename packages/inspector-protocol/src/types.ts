import type { InspectorErrorCode } from './errors';

export const INSPECTOR_CHANNEL = 'itera-component-inspector';
export const INSPECTOR_PROTOCOL_VERSION = 1;

export type InspectorChannel = typeof INSPECTOR_CHANNEL;
export type InspectorProtocolVersion = typeof INSPECTOR_PROTOCOL_VERSION;

export const hostToEmbeddedMessageTypes = [
  'HELLO',
  'REQUEST_TREE',
  'REQUEST_NODE_PROPS',
  'REQUEST_SNAPSHOT',
  'HIGHLIGHT_NODE',
  'CLEAR_HIGHLIGHT',
  'PING',
] as const;

export type HostToEmbeddedMessageType =
  (typeof hostToEmbeddedMessageTypes)[number];

export const embeddedToHostMessageTypes = [
  'READY',
  'TREE_SNAPSHOT',
  'TREE_DELTA',
  'NODE_PROPS',
  'SNAPSHOT',
  'NODE_SELECTED',
  'PONG',
  'ERROR',
] as const;

export type EmbeddedToHostMessageType =
  (typeof embeddedToHostMessageTypes)[number];

export type InspectorMessageType =
  | HostToEmbeddedMessageType
  | EmbeddedToHostMessageType;

export type TreeNodeSource = {
  file: string;
  line: number;
  column?: number;
};

export type TreeNode = {
  id: string;
  displayName: string;
  parentId: string | null;
  childrenIds: string[];
  source?: TreeNodeSource;
  key?: string;
  tags?: string[];
};

export const serializablePlaceholderTypes = [
  'undefined',
  'function',
  'symbol',
  'bigint',
  'date',
  'regexp',
  'map',
  'set',
  'error',
  'dom-node',
  'redacted',
  'unserializable',
] as const;

export type SerializablePlaceholderType =
  (typeof serializablePlaceholderTypes)[number];

export type SerializablePlaceholder = {
  __iteraType: SerializablePlaceholderType;
  preview?: string;
};

export type SerializableScalar = string | number | boolean | null;

export type SerializableObject = {
  [key: string]: SerializableValue;
};

export type SerializableValue =
  | SerializableScalar
  | SerializableValue[]
  | SerializableObject
  | SerializablePlaceholder;

export type NodePropsMeta = {
  truncated?: boolean;
  droppedKeys?: string[];
  redactedCount?: number;
  redactedPaths?: string[];
};

export type NodeProps = {
  nodeId: string;
  props: Record<string, SerializableValue>;
  meta: NodePropsMeta;
};

export type HelloPayload = {
  capabilities?: string[];
  auth?: HelloAuthPayload;
};

export type HelloAuthPayload = {
  sessionToken: string;
  metadata?: HelloAuthMetadata;
};

export type HelloAuthMetadata = {
  tokenType?: string;
  issuer?: string;
  audience?: string | string[];
  issuedAt?: number;
  expiresAt?: number;
  nonce?: string;
};

export type RequestTreePayload = {
  includeSource?: boolean;
};

export type RequestNodePropsPayload = {
  nodeId: string;
};

export type RequestSnapshotPayload = {
  includeTree?: boolean;
  includeHtml?: boolean;
};

export type HighlightNodePayload = {
  nodeId: string;
};

export type PingPayload = {
  sentAt?: number;
};

export type ReadyPayload = {
  capabilities?: string[];
};

export type TreeSnapshotPayload = {
  nodes: TreeNode[];
  rootIds: string[];
  meta?: TreeSnapshotMeta;
};

export type TreeSnapshotMeta = {
  truncated?: boolean;
  totalNodeCount?: number;
  includedNodeCount?: number;
  truncatedNodeCount?: number;
};

export type TreeDeltaPayload = {
  addedNodes: TreeNode[];
  updatedNodes: TreeNode[];
  removedNodeIds: string[];
};

export type NodeSelectedPayload = {
  nodeId: string;
};

export type SnapshotPayload = {
  capture: Blob;
  captureMimeType: string;
  width: number;
  height: number;
  capturedAt: number;
  treeSnapshot: TreeSnapshotPayload;
  html?: string;
  htmlTruncated?: boolean;
};

export type PongPayload = {
  sentAt?: number;
};

export type ErrorPayload = {
  code: InspectorErrorCode;
  message: string;
  details?: Record<string, SerializableValue>;
};

export type HostToEmbeddedPayloadByType = {
  HELLO: HelloPayload;
  REQUEST_TREE: RequestTreePayload;
  REQUEST_NODE_PROPS: RequestNodePropsPayload;
  REQUEST_SNAPSHOT: RequestSnapshotPayload;
  HIGHLIGHT_NODE: HighlightNodePayload;
  CLEAR_HIGHLIGHT: undefined;
  PING: PingPayload;
};

export type EmbeddedToHostPayloadByType = {
  READY: ReadyPayload;
  TREE_SNAPSHOT: TreeSnapshotPayload;
  TREE_DELTA: TreeDeltaPayload;
  NODE_PROPS: NodeProps;
  SNAPSHOT: SnapshotPayload;
  NODE_SELECTED: NodeSelectedPayload;
  PONG: PongPayload;
  ERROR: ErrorPayload;
};

export type InspectorPayloadByType =
  HostToEmbeddedPayloadByType & EmbeddedToHostPayloadByType;

export type InspectorMessageEnvelope<
  TType extends InspectorMessageType,
  TPayload,
> = {
  channel: InspectorChannel;
  version: InspectorProtocolVersion;
  type: TType;
  requestId?: string;
  sessionId?: string;
} & (TPayload extends undefined ? { payload?: undefined } : { payload: TPayload });

export type InspectorMessage<TType extends InspectorMessageType> =
  InspectorMessageEnvelope<TType, InspectorPayloadByType[TType]>;

export type AnyInspectorMessage = {
  [Type in InspectorMessageType]: InspectorMessage<Type>;
}[InspectorMessageType];

export type HostToEmbeddedMessage = {
  [Type in HostToEmbeddedMessageType]: InspectorMessage<Type>;
}[HostToEmbeddedMessageType];

export type EmbeddedToHostMessage = {
  [Type in EmbeddedToHostMessageType]: InspectorMessage<Type>;
}[EmbeddedToHostMessageType];
