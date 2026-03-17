import { given } from '#test/givenWhenThen';
import {
  serializeNodeProps,
  type SerializeNodePropsOptions,
  type SerializeNodePropsResult,
} from './serializer';

type SerializerContext = {
  input: unknown;
  options?: SerializeNodePropsOptions;
  result?: SerializeNodePropsResult;
};

const contextCreated = (): SerializerContext => {
  return {
    input: {},
  };
};

const contextWithSerializableInput = (
  context: SerializerContext,
): SerializerContext => {
  context.input = {
    title: 'Card',
    count: 2,
    nested: {
      enabled: true,
    },
    flags: [true, null, 'x'],
  };

  return context;
};

const contextWithUnsupportedInput = (
  context: SerializerContext,
): SerializerContext => {
  context.input = {
    undefinedValue: undefined,
    functionValue: function sampleFunction() {
      return 'value';
    },
    symbolValue: Symbol('label'),
    bigintValue: 12n,
    dateValue: new Date('2024-01-01T00:00:00.000Z'),
    regexpValue: /abc/gi,
    mapValue: new Map([[1, 'one']]),
    setValue: new Set(['one']),
    errorValue: new Error('boom'),
    domValue: document.createElement('section'),
    weakMapValue: new WeakMap<object, unknown>(),
  };

  return context;
};

const contextWithCyclicInput = (
  context: SerializerContext,
): SerializerContext => {
  const cyclicValue: Record<string, unknown> = {
    label: 'root',
  };

  cyclicValue.self = cyclicValue;
  context.input = cyclicValue;

  return context;
};

const contextWithLimitedKeys = (
  context: SerializerContext,
): SerializerContext => {
  context.input = {
    first: 1,
    second: 2,
    third: 3,
    fourth: 4,
  };
  context.options = {
    maxKeys: 2,
  };

  return context;
};

const contextWithLimitedDepth = (
  context: SerializerContext,
): SerializerContext => {
  context.input = {
    levelOne: {
      levelTwo: {
        levelThree: {
          value: 'deep',
        },
      },
    },
  };
  context.options = {
    maxDepth: 2,
  };

  return context;
};

const contextWithNestedSensitiveInput = (
  context: SerializerContext,
): SerializerContext => {
  context.input = {
    publicLabel: 'widget',
    credentials: {
      sessionToken: 'token-value',
      nested: {
        password: 'password-value',
      },
    },
    requestLog: [
      {
        authorization: 'Bearer abc',
      },
      {
        meta: {
          apiSecret: 'secret-value',
          keep: 'visible',
        },
      },
    ],
  };

  return context;
};

const contextWithBoundedRedactionDiagnostics = (
  context: SerializerContext,
): SerializerContext => {
  context.input = {
    branchOne: {
      tokenOne: 'one',
      passwordOne: 'two',
    },
    branchTwo: {
      secretTwo: 'three',
      authorizationTwo: 'four',
    },
  };
  context.options = {
    maxKeys: 2,
  };

  return context;
};

const contextWithFiberSensitiveInput = (
  context: SerializerContext,
): SerializerContext => {
  context.input = {
    fiberNode: {
      tag: 0,
      key: null,
      memoizedProps: {
        title: 'ProfileCard',
        requestHeaders: [
          {
            authorization: 'Bearer abc',
          },
        ],
        credentials: {
          accessToken: 'token-value',
          nested: {
            password: 'password-value',
          },
        },
        child: {
          pendingProps: {
            apiSecret: 'secret-value',
            count: 2,
          },
        },
      },
      memoizedState: {
        cache: {
          secretValue: 'hidden',
          keep: 'visible',
        },
      },
    },
  };

  return context;
};

const contextWithFiberTruncationInput = (
  context: SerializerContext,
): SerializerContext => {
  context.input = {
    fiberNode: {
      memoizedProps: {
        first: 'one',
        second: 'two',
        third: 'three',
      },
      sibling: {
        id: 'sibling-node',
        memoizedProps: {
          nested: {
            label: 'too-deep',
          },
        },
      },
    },
  };
  context.options = {
    maxKeys: 2,
    maxDepth: 3,
  };

  return context;
};

const propsSerialized = (context: SerializerContext): SerializerContext => {
  context.result = serializeNodeProps(context.input, context.options);

  return context;
};

const expectSerializableValues = (context: SerializerContext) => {
  expect(context.result).toEqual({
    props: {
      title: 'Card',
      count: 2,
      nested: {
        enabled: true,
      },
      flags: [true, null, 'x'],
    },
    meta: {},
  });
};

const expectUnsupportedValuePlaceholders = (context: SerializerContext) => {
  expect(context.result).toBeDefined();
  expect(context.result?.props.undefinedValue).toEqual({
    __iteraType: 'undefined',
  });
  expect(context.result?.props.functionValue).toMatchObject({
    __iteraType: 'function',
  });
  expect(context.result?.props.symbolValue).toMatchObject({
    __iteraType: 'symbol',
  });
  expect(context.result?.props.bigintValue).toMatchObject({
    __iteraType: 'bigint',
  });
  expect(context.result?.props.dateValue).toMatchObject({
    __iteraType: 'date',
  });
  expect(context.result?.props.regexpValue).toMatchObject({
    __iteraType: 'regexp',
  });
  expect(context.result?.props.mapValue).toMatchObject({
    __iteraType: 'map',
  });
  expect(context.result?.props.setValue).toMatchObject({
    __iteraType: 'set',
  });
  expect(context.result?.props.errorValue).toMatchObject({
    __iteraType: 'error',
  });
  expect(context.result?.props.domValue).toMatchObject({
    __iteraType: 'dom-node',
  });
  expect(context.result?.props.weakMapValue).toMatchObject({
    __iteraType: 'unserializable',
    preview: 'WeakMap',
  });
};

const expectKeyTruncationMeta = (context: SerializerContext) => {
  expect(context.result).toEqual({
    props: {
      first: 1,
      second: 2,
    },
    meta: {
      truncated: true,
      droppedKeys: ['third', 'fourth'],
    },
  });
};

const expectDepthTruncationMeta = (context: SerializerContext) => {
  expect(context.result).toMatchObject({
    props: {
      levelOne: {
        levelTwo: {
          __iteraType: 'unserializable',
          preview: 'Depth limit reached',
        },
      },
    },
    meta: {
      truncated: true,
    },
  });
};

const expectCyclicStructureSafety = (context: SerializerContext) => {
  expect(context.result).toMatchObject({
    props: {
      label: 'root',
      self: {
        __iteraType: 'unserializable',
        preview: 'Circular reference',
      },
    },
    meta: {
      truncated: true,
    },
  });
};

const expectNestedSensitiveValuesToBeRedacted = (
  context: SerializerContext,
) => {
  expect(context.result).toEqual({
    props: {
      publicLabel: 'widget',
      credentials: {
        sessionToken: {
          __iteraType: 'redacted',
          preview: 'Sensitive value redacted',
        },
        nested: {
          password: {
            __iteraType: 'redacted',
            preview: 'Sensitive value redacted',
          },
        },
      },
      requestLog: [
        {
          authorization: {
            __iteraType: 'redacted',
            preview: 'Sensitive value redacted',
          },
        },
        {
          meta: {
            apiSecret: {
              __iteraType: 'redacted',
              preview: 'Sensitive value redacted',
            },
            keep: 'visible',
          },
        },
      ],
    },
    meta: {
      redactedCount: 4,
      redactedPaths: [
        'credentials.sessionToken',
        'credentials.nested.password',
        'requestLog[0].authorization',
        'requestLog[1].meta.apiSecret',
      ],
    },
  });
};

const expectBoundedRedactionDiagnostics = (context: SerializerContext) => {
  expect(context.result).toEqual({
    props: {
      branchOne: {
        tokenOne: {
          __iteraType: 'redacted',
          preview: 'Sensitive value redacted',
        },
        passwordOne: {
          __iteraType: 'redacted',
          preview: 'Sensitive value redacted',
        },
      },
      branchTwo: {
        secretTwo: {
          __iteraType: 'redacted',
          preview: 'Sensitive value redacted',
        },
        authorizationTwo: {
          __iteraType: 'redacted',
          preview: 'Sensitive value redacted',
        },
      },
    },
    meta: {
      redactedCount: 4,
      redactedPaths: ['branchOne.tokenOne', 'branchOne.passwordOne'],
    },
  });
};

const expectFiberSensitiveValuesToBeRedacted = (context: SerializerContext) => {
  expect(context.result).toEqual({
    props: {
      fiberNode: {
        tag: 0,
        key: null,
        memoizedProps: {
          title: 'ProfileCard',
          requestHeaders: [
            {
              authorization: {
                __iteraType: 'redacted',
                preview: 'Sensitive value redacted',
              },
            },
          ],
          credentials: {
            accessToken: {
              __iteraType: 'redacted',
              preview: 'Sensitive value redacted',
            },
            nested: {
              password: {
                __iteraType: 'redacted',
                preview: 'Sensitive value redacted',
              },
            },
          },
          child: {
            pendingProps: {
              apiSecret: {
                __iteraType: 'redacted',
                preview: 'Sensitive value redacted',
              },
              count: 2,
            },
          },
        },
        memoizedState: {
          cache: {
            secretValue: {
              __iteraType: 'redacted',
              preview: 'Sensitive value redacted',
            },
            keep: 'visible',
          },
        },
      },
    },
    meta: {
      redactedCount: 5,
      redactedPaths: [
        'fiberNode.memoizedProps.requestHeaders[0].authorization',
        'fiberNode.memoizedProps.credentials.accessToken',
        'fiberNode.memoizedProps.credentials.nested.password',
        'fiberNode.memoizedProps.child.pendingProps.apiSecret',
        'fiberNode.memoizedState.cache.secretValue',
      ],
    },
  });
};

const expectFiberTruncationDiagnostics = (context: SerializerContext) => {
  expect(context.result).toEqual({
    props: {
      fiberNode: {
        memoizedProps: {
          first: 'one',
          second: 'two',
        },
        sibling: {
          id: 'sibling-node',
          memoizedProps: {
            __iteraType: 'unserializable',
            preview: 'Depth limit reached',
          },
        },
      },
    },
    meta: {
      truncated: true,
      droppedKeys: ['fiberNode.memoizedProps.third'],
    },
  });
};

describe('serializer', () => {
  test('serializes scalar, array, and nested object values', () => {
    return given(contextCreated())
      .when(contextWithSerializableInput)
      .when(propsSerialized)
      .then(expectSerializableValues);
  });

  test('returns placeholders for unsupported value types', () => {
    return given(contextCreated())
      .when(contextWithUnsupportedInput)
      .when(propsSerialized)
      .then(expectUnsupportedValuePlaceholders);
  });

  test('caps object keys and reports truncation metadata', () => {
    return given(contextCreated())
      .when(contextWithLimitedKeys)
      .when(propsSerialized)
      .then(expectKeyTruncationMeta);
  });

  test('caps nested depth and reports truncation metadata', () => {
    return given(contextCreated())
      .when(contextWithLimitedDepth)
      .when(propsSerialized)
      .then(expectDepthTruncationMeta);
  });

  test('never throws when serializing cyclic structures', () => {
    return given(contextCreated())
      .when(contextWithCyclicInput)
      .when(propsSerialized)
      .then(expectCyclicStructureSafety);
  });

  test('redacts sensitive keys across nested objects and arrays', () => {
    return given(contextCreated())
      .when(contextWithNestedSensitiveInput)
      .when(propsSerialized)
      .then(expectNestedSensitiveValuesToBeRedacted);
  });

  test('bounds redacted paths diagnostics while preserving redacted count', () => {
    return given(contextCreated())
      .when(contextWithBoundedRedactionDiagnostics)
      .when(propsSerialized)
      .then(expectBoundedRedactionDiagnostics);
  });

  test('redacts sensitive keys for fiber-shaped props payloads', () => {
    return given(contextCreated())
      .when(contextWithFiberSensitiveInput)
      .when(propsSerialized)
      .then(expectFiberSensitiveValuesToBeRedacted);
  });

  test('keeps truncation metadata stable for fiber-shaped payload boundaries', () => {
    return given(contextCreated())
      .when(contextWithFiberTruncationInput)
      .when(propsSerialized)
      .then(expectFiberTruncationDiagnostics);
  });
});
