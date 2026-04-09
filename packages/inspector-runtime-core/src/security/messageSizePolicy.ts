import type { InspectorOversizeRejectionReason } from '@iteraai/inspector-protocol';

export const EMBEDDED_MAX_INBOUND_INSPECTOR_MESSAGE_BYTES = 128 * 1024;
export const EMBEDDED_OVERSIZE_MESSAGE_REASON: InspectorOversizeRejectionReason =
  'embedded-inbound-message-too-large';

export type EmbeddedInboundMessageSizePolicy = {
  maxInboundMessageBytes: number;
  reason: InspectorOversizeRejectionReason;
};

export type EmbeddedInboundMessageSizeResult =
  | {
      ok: true;
      sizeInBytes: number;
    }
  | {
      ok: false;
      sizeInBytes?: number;
      maxInboundMessageBytes: number;
      reason: InspectorOversizeRejectionReason;
    };

export const embeddedInboundMessageSizePolicy: EmbeddedInboundMessageSizePolicy =
  {
    maxInboundMessageBytes: EMBEDDED_MAX_INBOUND_INSPECTOR_MESSAGE_BYTES,
    reason: EMBEDDED_OVERSIZE_MESSAGE_REASON,
  };

const textEncoder = new TextEncoder();
const MAX_INSPECTOR_MESSAGE_SIZE_TRAVERSAL_DEPTH = 64;

const isPlainObject = (value: unknown): value is Record<string, unknown> => {
  if (typeof value !== 'object' || value === null) {
    return false;
  }

  const prototype = Object.getPrototypeOf(value);

  return prototype === Object.prototype || prototype === null;
};

const measureValueSizeInBytes = (
  value: unknown,
  branchObjects: WeakSet<object>,
  depth: number,
): number | undefined => {
  if (depth > MAX_INSPECTOR_MESSAGE_SIZE_TRAVERSAL_DEPTH) {
    return undefined;
  }

  if (value === null) {
    return 1;
  }

  if (typeof value === 'string') {
    return textEncoder.encode(value).byteLength;
  }

  if (typeof value === 'number') {
    return 8;
  }

  if (typeof value === 'boolean') {
    return 1;
  }

  if (value === undefined) {
    return 1;
  }

  if (
    typeof value === 'bigint' ||
    typeof value === 'symbol' ||
    typeof value === 'function'
  ) {
    return undefined;
  }

  if (typeof value !== 'object') {
    return undefined;
  }

  if (branchObjects.has(value)) {
    return undefined;
  }

  if (value instanceof ArrayBuffer) {
    return value.byteLength;
  }

  if (
    typeof SharedArrayBuffer !== 'undefined' &&
    value instanceof SharedArrayBuffer
  ) {
    return value.byteLength;
  }

  if (ArrayBuffer.isView(value)) {
    return value.byteLength;
  }

  if (typeof Blob !== 'undefined' && value instanceof Blob) {
    return value.size;
  }

  branchObjects.add(value);

  if (Array.isArray(value)) {
    let totalSizeInBytes = 0;

    for (const entry of value) {
      const entrySizeInBytes = measureValueSizeInBytes(
        entry,
        branchObjects,
        depth + 1,
      );

      if (entrySizeInBytes === undefined) {
        branchObjects.delete(value);
        return undefined;
      }

      totalSizeInBytes += entrySizeInBytes;
    }

    branchObjects.delete(value);
    return totalSizeInBytes;
  }

  if (!isPlainObject(value)) {
    branchObjects.delete(value);
    return undefined;
  }

  let totalSizeInBytes = 0;

  for (const [key, entry] of Object.entries(value)) {
    const entrySizeInBytes = measureValueSizeInBytes(
      entry,
      branchObjects,
      depth + 1,
    );

    if (entrySizeInBytes === undefined) {
      branchObjects.delete(value);
      return undefined;
    }

    totalSizeInBytes += textEncoder.encode(key).byteLength + entrySizeInBytes;
  }

  branchObjects.delete(value);
  return totalSizeInBytes;
};

export const measureInspectorMessageSizeInBytes = (
  message: unknown,
): number | undefined => {
  return measureValueSizeInBytes(message, new WeakSet(), 0);
};

export const evaluateEmbeddedInboundMessageSize = (
  message: unknown,
  policy: EmbeddedInboundMessageSizePolicy = embeddedInboundMessageSizePolicy,
): EmbeddedInboundMessageSizeResult => {
  const sizeInBytes = measureInspectorMessageSizeInBytes(message);

  if (sizeInBytes === undefined) {
    return {
      ok: false,
      maxInboundMessageBytes: policy.maxInboundMessageBytes,
      reason: policy.reason,
    };
  }

  if (sizeInBytes <= policy.maxInboundMessageBytes) {
    return {
      ok: true,
      sizeInBytes,
    };
  }

  return {
    ok: false,
    sizeInBytes,
    maxInboundMessageBytes: policy.maxInboundMessageBytes,
    reason: policy.reason,
  };
};
