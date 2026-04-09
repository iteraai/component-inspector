import type {
  NodePropsMeta,
  SerializableObject,
  SerializablePlaceholder,
  SerializablePlaceholderType,
  SerializableValue,
} from '@iteraai/inspector-protocol';
import {
  isSensitivePropKey,
  redactedValuePreview,
} from './security/redactionPolicy';

const defaultMaxDepth = 5;
const defaultMaxKeys = 50;

export type SerializeNodePropsOptions = {
  maxDepth?: number;
  maxKeys?: number;
};

export type SerializeNodePropsResult = {
  props: Record<string, SerializableValue>;
  meta: NodePropsMeta;
};

type SerializeContext = {
  maxDepth: number;
  maxKeys: number;
  objectStack: WeakSet<object>;
  droppedKeys: string[];
  redactedCount: number;
  redactedPaths: string[];
  truncated: boolean;
};

const isRecord = (value: unknown): value is Record<string, unknown> => {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
};

const isPlainObject = (value: unknown): value is Record<string, unknown> => {
  if (!isRecord(value)) {
    return false;
  }

  const prototype = Object.getPrototypeOf(value);

  return prototype === Object.prototype || prototype === null;
};

const isDomNode = (value: unknown): value is Node => {
  return typeof Node !== 'undefined' && value instanceof Node;
};

const createPlaceholder = (
  type: SerializablePlaceholderType,
  preview?: string,
): SerializablePlaceholder => {
  if (preview === undefined) {
    return {
      __iteraType: type,
    };
  }

  return {
    __iteraType: type,
    preview,
  };
};

const appendObjectPath = (path: string, key: string): string => {
  if (path === '') {
    return key;
  }

  return `${path}.${key}`;
};

const appendArrayPath = (path: string, index: number): string => {
  if (path === '') {
    return `[${index}]`;
  }

  return `${path}[${index}]`;
};

const pushDroppedKey = (context: SerializeContext, path: string) => {
  context.truncated = true;

  if (context.droppedKeys.length >= context.maxKeys) {
    return;
  }

  context.droppedKeys.push(path);
};

const pushRedactedPath = (context: SerializeContext, path: string) => {
  context.redactedCount += 1;

  if (context.redactedPaths.length >= context.maxKeys) {
    return;
  }

  context.redactedPaths.push(path);
};

const serializeDatePreview = (value: Date): string => {
  if (Number.isNaN(value.getTime())) {
    return 'Invalid Date';
  }

  return value.toISOString();
};

const serializeErrorPreview = (value: Error): string => {
  if (value.message === '') {
    return value.name;
  }

  return `${value.name}: ${value.message}`;
};

const serializeDomPreview = (value: Node): string => {
  if (value instanceof Element) {
    return `<${value.tagName.toLowerCase()}>`;
  }

  return value.nodeName;
};

const toUnserializableObjectPreview = (value: object): string | undefined => {
  const constructorName = value.constructor?.name;

  if (
    typeof constructorName === 'string' &&
    constructorName !== '' &&
    constructorName !== 'Object'
  ) {
    return constructorName;
  }

  return undefined;
};

const isSpecialObject = (value: unknown): boolean => {
  return (
    value instanceof Date ||
    value instanceof RegExp ||
    value instanceof Map ||
    value instanceof Set ||
    value instanceof Error ||
    isDomNode(value)
  );
};

const captureDroppedPaths = (
  context: SerializeContext,
  droppedPaths: string[],
  fallbackPath: string,
) => {
  const boundedDroppedPaths = droppedPaths.slice(0, context.maxKeys);

  for (const droppedPath of boundedDroppedPaths) {
    pushDroppedKey(context, droppedPath);
  }

  if (droppedPaths.length > boundedDroppedPaths.length) {
    pushDroppedKey(context, `${fallbackPath}.__remaining`);
  }
};

const serializeObject = (
  value: Record<string, unknown>,
  depth: number,
  path: string,
  context: SerializeContext,
): SerializableObject => {
  context.objectStack.add(value);

  try {
    const result: SerializableObject = {};
    const keys = Object.keys(value);
    const keysToSerialize = keys.slice(0, context.maxKeys);
    const droppedPaths = keys
      .slice(context.maxKeys)
      .map((key) => appendObjectPath(path, key));

    captureDroppedPaths(context, droppedPaths, path === '' ? 'root' : path);

    for (const key of keysToSerialize) {
      const childPath = appendObjectPath(path, key);

      if (isSensitivePropKey(key)) {
        pushRedactedPath(context, childPath);
        result[key] = createPlaceholder('redacted', redactedValuePreview);
        continue;
      }

      try {
        result[key] = serializeValue(value[key], depth + 1, childPath, context);
      } catch {
        context.truncated = true;
        result[key] = createPlaceholder(
          'unserializable',
          'Property access threw',
        );
      }
    }

    return result;
  } finally {
    context.objectStack.delete(value);
  }
};

const serializeArray = (
  value: unknown[],
  depth: number,
  path: string,
  context: SerializeContext,
): SerializableValue[] => {
  context.objectStack.add(value);

  try {
    const itemsToSerialize = value.slice(0, context.maxKeys);
    const droppedPaths = value
      .slice(context.maxKeys)
      .map((_, index) => appendArrayPath(path, context.maxKeys + index));

    captureDroppedPaths(context, droppedPaths, path === '' ? 'root' : path);

    return itemsToSerialize.map((entry, index) =>
      serializeValue(entry, depth + 1, appendArrayPath(path, index), context),
    );
  } finally {
    context.objectStack.delete(value);
  }
};

const serializeValue = (
  value: unknown,
  depth: number,
  path: string,
  context: SerializeContext,
): SerializableValue => {
  if (value === null) {
    return null;
  }

  if (
    typeof value === 'string' ||
    typeof value === 'number' ||
    typeof value === 'boolean'
  ) {
    return value;
  }

  if (typeof value === 'undefined') {
    return createPlaceholder('undefined');
  }

  if (typeof value === 'function') {
    const preview = value.name === '' ? 'anonymous' : value.name;

    return createPlaceholder('function', preview);
  }

  if (typeof value === 'symbol') {
    return createPlaceholder('symbol', String(value));
  }

  if (typeof value === 'bigint') {
    return createPlaceholder('bigint', `${value.toString()}n`);
  }

  if (value instanceof Date) {
    return createPlaceholder('date', serializeDatePreview(value));
  }

  if (value instanceof RegExp) {
    return createPlaceholder('regexp', value.toString());
  }

  if (value instanceof Map) {
    return createPlaceholder('map', `Map(${value.size})`);
  }

  if (value instanceof Set) {
    return createPlaceholder('set', `Set(${value.size})`);
  }

  if (value instanceof Error) {
    return createPlaceholder('error', serializeErrorPreview(value));
  }

  if (isDomNode(value)) {
    return createPlaceholder('dom-node', serializeDomPreview(value));
  }

  if (Array.isArray(value)) {
    if (depth >= context.maxDepth) {
      context.truncated = true;

      return createPlaceholder('unserializable', 'Depth limit reached');
    }

    if (context.objectStack.has(value)) {
      context.truncated = true;

      return createPlaceholder('unserializable', 'Circular reference');
    }

    return serializeArray(value, depth, path, context);
  }

  if (isRecord(value)) {
    if (!isPlainObject(value)) {
      return createPlaceholder(
        'unserializable',
        toUnserializableObjectPreview(value),
      );
    }

    if (depth >= context.maxDepth) {
      context.truncated = true;

      return createPlaceholder('unserializable', 'Depth limit reached');
    }

    if (context.objectStack.has(value)) {
      context.truncated = true;

      return createPlaceholder('unserializable', 'Circular reference');
    }

    return serializeObject(value, depth, path, context);
  }

  return createPlaceholder('unserializable');
};

const toNodePropsMeta = (context: SerializeContext): NodePropsMeta => {
  const meta: NodePropsMeta = {};

  if (context.truncated) {
    meta.truncated = true;
  }

  if (context.droppedKeys.length > 0) {
    meta.droppedKeys = context.droppedKeys;
  }

  if (context.redactedCount > 0) {
    meta.redactedCount = context.redactedCount;
  }

  if (context.redactedPaths.length > 0) {
    meta.redactedPaths = context.redactedPaths;
  }

  return meta;
};

const createSerializeContext = (
  options: SerializeNodePropsOptions,
): SerializeContext => {
  const maxDepth = options.maxDepth ?? defaultMaxDepth;
  const maxKeys = options.maxKeys ?? defaultMaxKeys;

  return {
    maxDepth: Math.max(1, maxDepth),
    maxKeys: Math.max(1, maxKeys),
    objectStack: new WeakSet<object>(),
    droppedKeys: [],
    redactedCount: 0,
    redactedPaths: [],
    truncated: false,
  };
};

export const serializeNodeProps = (
  input: unknown,
  options: SerializeNodePropsOptions = {},
): SerializeNodePropsResult => {
  const context = createSerializeContext(options);

  try {
    if (isPlainObject(input) && !isSpecialObject(input)) {
      const props = serializeObject(input, 0, '', context);

      return {
        props,
        meta: toNodePropsMeta(context),
      };
    }

    return {
      props: {
        value: serializeValue(input, 0, 'value', context),
      },
      meta: toNodePropsMeta(context),
    };
  } catch {
    context.truncated = true;

    return {
      props: {
        value: createPlaceholder('unserializable', 'Unable to serialize props'),
      },
      meta: toNodePropsMeta(context),
    };
  }
};
