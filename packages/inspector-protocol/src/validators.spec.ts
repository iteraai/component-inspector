import { given } from '#test/givenWhenThen';
import type { InspectorProtocolError } from './errors';
import {
  INSPECTOR_CHANNEL,
  INSPECTOR_PROTOCOL_VERSION,
  type AnyInspectorMessage,
} from './types';
import {
  buildMessage,
  parseMessage,
  type ParseMessageOptions,
  type ParseMessageResult,
} from './validators';

type MessageContext = {
  message?: AnyInspectorMessage;
};

type ParseContext = {
  raw: unknown;
  options?: ParseMessageOptions;
  result?: ParseMessageResult;
};

const buildHelloMessage = (_context: MessageContext): MessageContext => {
  return {
    message: buildMessage(
      'HELLO',
      {
        capabilities: ['tree', 'props'],
      },
      {
        requestId: 'request-1',
        sessionId: 'session-1',
      },
    ),
  };
};

const helloMessageMatchesEnvelope = (context: MessageContext) => {
  expect(context.message).toStrictEqual({
    channel: INSPECTOR_CHANNEL,
    version: INSPECTOR_PROTOCOL_VERSION,
    type: 'HELLO',
    requestId: 'request-1',
    sessionId: 'session-1',
    payload: {
      capabilities: ['tree', 'props'],
    },
  });
};

const buildHelloWithAuthMessage = (
  _context: MessageContext,
): MessageContext => {
  return {
    message: buildMessage(
      'HELLO',
      {
        capabilities: ['tree', 'props'],
        auth: {
          sessionToken: 'session-token-1',
          metadata: {
            tokenType: 'Bearer',
            issuer: 'itera-api',
            audience: ['itera-embedded-inspector'],
            issuedAt: 1_700_000_000,
            expiresAt: 1_700_003_600,
            nonce: 'nonce-1',
          },
        },
      },
      {
        requestId: 'request-auth-1',
      },
    ),
  };
};

const helloWithAuthMessageMatchesEnvelope = (context: MessageContext) => {
  expect(context.message).toStrictEqual({
    channel: INSPECTOR_CHANNEL,
    version: INSPECTOR_PROTOCOL_VERSION,
    type: 'HELLO',
    requestId: 'request-auth-1',
    sessionId: undefined,
    payload: {
      capabilities: ['tree', 'props'],
      auth: {
        sessionToken: 'session-token-1',
        metadata: {
          tokenType: 'Bearer',
          issuer: 'itera-api',
          audience: ['itera-embedded-inspector'],
          issuedAt: 1_700_000_000,
          expiresAt: 1_700_003_600,
          nonce: 'nonce-1',
        },
      },
    },
  });
};

const buildTreeSnapshotWithMetadataMessage = (
  _context: MessageContext,
): MessageContext => {
  return {
    message: buildMessage(
      'TREE_SNAPSHOT',
      {
        nodes: [],
        rootIds: [],
        meta: {
          truncated: true,
          totalNodeCount: 500,
          includedNodeCount: 200,
          truncatedNodeCount: 300,
        },
      },
      {
        requestId: 'tree-request-1',
      },
    ),
  };
};

const treeSnapshotMessageWithMetadataMatchesEnvelope = (
  context: MessageContext,
) => {
  expect(context.message).toStrictEqual({
    channel: INSPECTOR_CHANNEL,
    version: INSPECTOR_PROTOCOL_VERSION,
    type: 'TREE_SNAPSHOT',
    requestId: 'tree-request-1',
    sessionId: undefined,
    payload: {
      nodes: [],
      rootIds: [],
      meta: {
        truncated: true,
        totalNodeCount: 500,
        includedNodeCount: 200,
        truncatedNodeCount: 300,
      },
    },
  });
};

const buildSnapshotMessage = (_context: MessageContext): MessageContext => {
  const capture = new Blob(['snapshot'], {
    type: 'image/svg+xml',
  });

  return {
    message: buildMessage(
      'SNAPSHOT',
      {
        capture,
        captureMimeType: 'image/svg+xml',
        width: 320,
        height: 200,
        capturedAt: 1_700_000_100,
        treeSnapshot: {
          nodes: [],
          rootIds: [],
        },
        html: '<div>snapshot</div>',
        htmlTruncated: false,
      },
      {
        requestId: 'snapshot-request-1',
      },
    ),
  };
};

const snapshotMessageMatchesEnvelope = (context: MessageContext) => {
  expect(context.message).toMatchObject({
    channel: INSPECTOR_CHANNEL,
    version: INSPECTOR_PROTOCOL_VERSION,
    type: 'SNAPSHOT',
    requestId: 'snapshot-request-1',
    sessionId: undefined,
    payload: {
      captureMimeType: 'image/svg+xml',
      width: 320,
      height: 200,
      capturedAt: 1_700_000_100,
      treeSnapshot: {
        nodes: [],
        rootIds: [],
      },
      html: '<div>snapshot</div>',
      htmlTruncated: false,
    },
  });
  expect(context.message?.payload).toMatchObject({
    capture: expect.any(Blob),
  });
};

const parseRawMessage = (context: ParseContext): ParseContext => {
  return {
    ...context,
    result: parseMessage(context.raw, context.options),
  };
};

const expectSuccessfulParse = (context: ParseContext) => {
  expect(context.result?.ok).toBe(true);

  if (context.result?.ok !== true) {
    return;
  }

  expect(context.result.message.type).toBe('REQUEST_NODE_PROPS');
  expect(context.result.message.payload).toStrictEqual({
    nodeId: 'node-42',
  });
};

const expectSuccessfulPingParse = (context: ParseContext) => {
  expect(context.result?.ok).toBe(true);

  if (context.result?.ok !== true) {
    return;
  }

  expect(context.result.message.type).toBe('PING');
};

const expectSuccessfulNodePropsParse = (expectedPayload: {
  nodeId: string;
  props: Record<string, unknown>;
  meta: Record<string, unknown>;
}) => {
  return (context: ParseContext) => {
    expect(context.result?.ok).toBe(true);

    if (context.result?.ok !== true) {
      return;
    }

    expect(context.result.message.type).toBe('NODE_PROPS');
    expect(context.result.message.payload).toStrictEqual(expectedPayload);
  };
};

const expectSuccessfulHelloWithAuthParse = (context: ParseContext) => {
  expect(context.result?.ok).toBe(true);

  if (context.result?.ok !== true) {
    return;
  }

  expect(context.result.message.type).toBe('HELLO');
  expect(context.result.message.payload).toStrictEqual({
    capabilities: ['tree'],
    auth: {
      sessionToken: 'session-token-parse',
      metadata: {
        tokenType: 'Bearer',
        issuer: 'itera-api',
        audience: 'itera-embedded-inspector',
        issuedAt: 1_700_000_001,
        expiresAt: 1_700_003_601,
      },
    },
  });
};

const expectSuccessfulErrorPayloadParse =
  (code: InspectorProtocolError['code']) => (context: ParseContext) => {
    expect(context.result?.ok).toBe(true);

    if (context.result?.ok !== true) {
      return;
    }

    expect(context.result.message.type).toBe('ERROR');

    if (context.result.message.type !== 'ERROR') {
      return;
    }

    expect(context.result.message.payload.code).toBe(code);
  };

const expectTreeSnapshotParseSuccess = (
  expectedMeta:
    | {
        truncated: boolean;
        totalNodeCount: number;
        includedNodeCount: number;
        truncatedNodeCount: number;
      }
    | undefined,
) => {
  return (context: ParseContext) => {
    expect(context.result?.ok).toBe(true);

    if (context.result?.ok !== true) {
      return;
    }

    expect(context.result.message.type).toBe('TREE_SNAPSHOT');
    expect(context.result.message.payload).toStrictEqual({
      nodes: [
        {
          id: 'root-node',
          displayName: 'App',
          parentId: null,
          childrenIds: [],
        },
      ],
      rootIds: ['root-node'],
      ...(expectedMeta !== undefined && {
        meta: expectedMeta,
      }),
    });
  };
};

const expectSnapshotParseSuccess = (context: ParseContext) => {
  expect(context.result?.ok).toBe(true);

  if (context.result?.ok !== true) {
    return;
  }

  expect(context.result.message.type).toBe('SNAPSHOT');
  if (context.result.message.type !== 'SNAPSHOT') {
    return;
  }
  expect(context.result.message.payload).toMatchObject({
    captureMimeType: 'image/svg+xml',
    width: 320,
    height: 200,
    capturedAt: 1_700_000_200,
    treeSnapshot: {
      nodes: [],
      rootIds: [],
    },
    html: '<div>embedded</div>',
    htmlTruncated: false,
  });
  expect(context.result.message.payload.capture).toBeInstanceOf(Blob);
};

const expectErrorCode =
  (code: InspectorProtocolError['code']) => (context: ParseContext) => {
    expect(context.result?.ok).toBe(false);

    if (context.result?.ok !== false) {
      return;
    }

    expect(context.result.error.code).toBe(code);
  };

const validRequestNodePropsContext = (): ParseContext => {
  return {
    raw: buildMessage('REQUEST_NODE_PROPS', {
      nodeId: 'node-42',
    }),
    options: {
      sourceOrigin: 'https://app.iteraapp.com',
      trustedOrigins: ['https://app.iteraapp.com'],
    },
  };
};

const unsupportedVersionContext = (): ParseContext => {
  return {
    raw: {
      channel: INSPECTOR_CHANNEL,
      version: INSPECTOR_PROTOCOL_VERSION + 1,
      type: 'PING',
      payload: {
        sentAt: 100,
      },
    },
  };
};

const clearHighlightWithPayloadContext = (): ParseContext => {
  return {
    raw: {
      channel: INSPECTOR_CHANNEL,
      version: INSPECTOR_PROTOCOL_VERSION,
      type: 'CLEAR_HIGHLIGHT',
      payload: {
        nodeId: 'node-1',
      },
    },
  };
};

const helloWithAuthContext = (): ParseContext => {
  return {
    raw: buildMessage('HELLO', {
      capabilities: ['tree'],
      auth: {
        sessionToken: 'session-token-parse',
        metadata: {
          tokenType: 'Bearer',
          issuer: 'itera-api',
          audience: 'itera-embedded-inspector',
          issuedAt: 1_700_000_001,
          expiresAt: 1_700_003_601,
        },
      },
    }),
  };
};

const helloWithInvalidAuthContext = (): ParseContext => {
  return {
    raw: {
      channel: INSPECTOR_CHANNEL,
      version: INSPECTOR_PROTOCOL_VERSION,
      type: 'HELLO',
      payload: {
        auth: {
          sessionToken: 42,
        },
      },
    },
  };
};

const originMismatchContext = (): ParseContext => {
  return {
    raw: buildMessage('PING', {
      sentAt: 10,
    }),
    options: {
      sourceOrigin: 'https://iteration-1.dev.iteraapp.com',
      expectedOrigin: 'https://iteration-2.dev.iteraapp.com',
    },
  };
};

const expectedOriginTrailingSlashContext = (): ParseContext => {
  return {
    raw: buildMessage('PING', {
      sentAt: 20,
    }),
    options: {
      sourceOrigin: 'https://iteration-1.dev.iteraapp.com',
      expectedOrigin: 'https://iteration-1.dev.iteraapp.com/',
    },
  };
};

const invalidMessageTypeContext = (): ParseContext => {
  return {
    raw: {
      channel: INSPECTOR_CHANNEL,
      version: INSPECTOR_PROTOCOL_VERSION,
      type: 'UNKNOWN_EVENT',
      payload: {},
    },
  };
};

const arrayMessageContext = (): ParseContext => {
  return {
    raw: [1, 2, 3],
  };
};

const treeSnapshotContext = (): ParseContext => {
  return {
    raw: buildMessage('TREE_SNAPSHOT', {
      nodes: [
        {
          id: 'root-node',
          displayName: 'App',
          parentId: null,
          childrenIds: [],
        },
      ],
      rootIds: ['root-node'],
    }),
  };
};

const treeSnapshotWithMetadataContext = (): ParseContext => {
  return {
    raw: buildMessage('TREE_SNAPSHOT', {
      nodes: [
        {
          id: 'root-node',
          displayName: 'App',
          parentId: null,
          childrenIds: [],
        },
      ],
      rootIds: ['root-node'],
      meta: {
        truncated: true,
        totalNodeCount: 25,
        includedNodeCount: 20,
        truncatedNodeCount: 5,
      },
    }),
  };
};

const snapshotContext = (): ParseContext => {
  return {
    raw: buildMessage('SNAPSHOT', {
      capture: new Blob(['embedded-snapshot'], {
        type: 'image/svg+xml',
      }),
      captureMimeType: 'image/svg+xml',
      width: 320,
      height: 200,
      capturedAt: 1_700_000_200,
      treeSnapshot: {
        nodes: [],
        rootIds: [],
      },
      html: '<div>embedded</div>',
      htmlTruncated: false,
    }),
  };
};

const snapshotWithInvalidCaptureContext = (): ParseContext => {
  return {
    raw: {
      channel: INSPECTOR_CHANNEL,
      version: INSPECTOR_PROTOCOL_VERSION,
      type: 'SNAPSHOT',
      payload: {
        capture: 'invalid-capture',
        captureMimeType: 'image/svg+xml',
        width: 320,
        height: 200,
        capturedAt: 1_700_000_200,
        treeSnapshot: {
          nodes: [],
          rootIds: [],
        },
      },
    },
  };
};

const treeSnapshotWithInvalidMetadataContext = (): ParseContext => {
  return {
    raw: {
      channel: INSPECTOR_CHANNEL,
      version: INSPECTOR_PROTOCOL_VERSION,
      type: 'TREE_SNAPSHOT',
      payload: {
        nodes: [
          {
            id: 'root-node',
            displayName: 'App',
            parentId: null,
            childrenIds: [],
          },
        ],
        rootIds: ['root-node'],
        meta: {
          truncated: true,
          totalNodeCount: '25',
        },
      },
    },
  };
};

const treeSnapshotWithNegativeMetadataCountContext = (): ParseContext => {
  return {
    raw: {
      channel: INSPECTOR_CHANNEL,
      version: INSPECTOR_PROTOCOL_VERSION,
      type: 'TREE_SNAPSHOT',
      payload: {
        nodes: [
          {
            id: 'root-node',
            displayName: 'App',
            parentId: null,
            childrenIds: [],
          },
        ],
        rootIds: ['root-node'],
        meta: {
          truncated: true,
          totalNodeCount: 25,
          includedNodeCount: 20,
          truncatedNodeCount: -1,
        },
      },
    },
  };
};

const treeSnapshotWithInvalidMetadataFlagContext = (): ParseContext => {
  return {
    raw: {
      channel: INSPECTOR_CHANNEL,
      version: INSPECTOR_PROTOCOL_VERSION,
      type: 'TREE_SNAPSHOT',
      payload: {
        nodes: [
          {
            id: 'root-node',
            displayName: 'App',
            parentId: null,
            childrenIds: [],
          },
        ],
        rootIds: ['root-node'],
        meta: {
          truncated: 'true',
          totalNodeCount: 25,
          includedNodeCount: 20,
          truncatedNodeCount: 5,
        },
      },
    },
  };
};

const nodePropsWithRedactionMetadataContext = (): ParseContext => {
  return {
    raw: buildMessage('NODE_PROPS', {
      nodeId: 'node-42',
      props: {
        title: 'App',
        auth: {
          sessionToken: {
            __iteraType: 'redacted',
            preview: 'Sensitive value redacted',
          },
        },
      },
      meta: {
        redactedCount: 1,
        redactedPaths: ['auth.sessionToken'],
      },
    }),
  };
};

const nodePropsWithInvalidRedactedCountContext = (): ParseContext => {
  return {
    raw: {
      channel: INSPECTOR_CHANNEL,
      version: INSPECTOR_PROTOCOL_VERSION,
      type: 'NODE_PROPS',
      payload: {
        nodeId: 'node-42',
        props: {},
        meta: {
          redactedCount: '1',
        },
      },
    },
  };
};

const nodePropsWithNegativeRedactedCountContext = (): ParseContext => {
  return {
    raw: {
      channel: INSPECTOR_CHANNEL,
      version: INSPECTOR_PROTOCOL_VERSION,
      type: 'NODE_PROPS',
      payload: {
        nodeId: 'node-42',
        props: {},
        meta: {
          redactedCount: -1,
        },
      },
    },
  };
};

const nodePropsWithInvalidRedactedPathsContext = (): ParseContext => {
  return {
    raw: {
      channel: INSPECTOR_CHANNEL,
      version: INSPECTOR_PROTOCOL_VERSION,
      type: 'NODE_PROPS',
      payload: {
        nodeId: 'node-42',
        props: {},
        meta: {
          redactedPaths: [42],
        },
      },
    },
  };
};

const errorMessageContextWithCode = (
  code: InspectorProtocolError['code'],
): ParseContext => {
  return {
    raw: buildMessage('ERROR', {
      code,
      message: 'Security policy rejected message.',
    }),
  };
};

describe('validators', () => {
  test('buildMessage should create the protocol envelope', () => {
    return given({} as MessageContext)
      .when(buildHelloMessage)
      .then(helloMessageMatchesEnvelope);
  });

  test('buildMessage should create TREE_SNAPSHOT envelope with optional metadata', () => {
    return given({} as MessageContext)
      .when(buildTreeSnapshotWithMetadataMessage)
      .then(treeSnapshotMessageWithMetadataMatchesEnvelope);
  });

  test('buildMessage should create HELLO envelope with optional auth payload', () => {
    return given({} as MessageContext)
      .when(buildHelloWithAuthMessage)
      .then(helloWithAuthMessageMatchesEnvelope);
  });

  test('buildMessage should create SNAPSHOT envelope with blob capture payload', () => {
    return given({} as MessageContext)
      .when(buildSnapshotMessage)
      .then(snapshotMessageMatchesEnvelope);
  });

  test('parseMessage should parse valid REQUEST_NODE_PROPS', () => {
    return given(validRequestNodePropsContext)
      .when(parseRawMessage)
      .then(expectSuccessfulParse);
  });

  test('parseMessage should parse HELLO with auth payload', () => {
    return given(helloWithAuthContext)
      .when(parseRawMessage)
      .then(expectSuccessfulHelloWithAuthParse);
  });

  test('parseMessage should parse TREE_SNAPSHOT without metadata', () => {
    return given(treeSnapshotContext)
      .when(parseRawMessage)
      .then(expectTreeSnapshotParseSuccess(undefined));
  });

  test('parseMessage should parse TREE_SNAPSHOT with metadata', () => {
    return given(treeSnapshotWithMetadataContext)
      .when(parseRawMessage)
      .then(
        expectTreeSnapshotParseSuccess({
          truncated: true,
          totalNodeCount: 25,
          includedNodeCount: 20,
          truncatedNodeCount: 5,
        }),
      );
  });

  test('parseMessage should parse SNAPSHOT payload with blob capture', () => {
    return given(snapshotContext)
      .when(parseRawMessage)
      .then(expectSnapshotParseSuccess);
  });

  test('parseMessage should parse NODE_PROPS with redaction metadata', () => {
    return given(nodePropsWithRedactionMetadataContext)
      .when(parseRawMessage)
      .then(
        expectSuccessfulNodePropsParse({
          nodeId: 'node-42',
          props: {
            title: 'App',
            auth: {
              sessionToken: {
                __iteraType: 'redacted',
                preview: 'Sensitive value redacted',
              },
            },
          },
          meta: {
            redactedCount: 1,
            redactedPaths: ['auth.sessionToken'],
          },
        }),
      );
  });

  test('parseMessage should reject unsupported version', () => {
    return given(unsupportedVersionContext)
      .when(parseRawMessage)
      .then(expectErrorCode('ERR_UNSUPPORTED_VERSION'));
  });

  test('parseMessage should reject payload for CLEAR_HIGHLIGHT', () => {
    return given(clearHighlightWithPayloadContext)
      .when(parseRawMessage)
      .then(expectErrorCode('ERR_INVALID_PAYLOAD'));
  });

  test('parseMessage should reject HELLO with invalid auth payload', () => {
    return given(helloWithInvalidAuthContext)
      .when(parseRawMessage)
      .then(expectErrorCode('ERR_INVALID_PAYLOAD'));
  });

  test('parseMessage should reject untrusted origin', () => {
    return given(originMismatchContext)
      .when(parseRawMessage)
      .then(expectErrorCode('ERR_INVALID_ORIGIN'));
  });

  test('parseMessage should accept expectedOrigin when semantically equivalent', () => {
    return given(expectedOriginTrailingSlashContext)
      .when(parseRawMessage)
      .then(expectSuccessfulPingParse);
  });

  test('parseMessage should reject unknown message type', () => {
    return given(invalidMessageTypeContext)
      .when(parseRawMessage)
      .then(expectErrorCode('ERR_UNKNOWN_MESSAGE_TYPE'));
  });

  test('parseMessage should reject TREE_SNAPSHOT with invalid metadata', () => {
    return given(treeSnapshotWithInvalidMetadataContext)
      .when(parseRawMessage)
      .then(expectErrorCode('ERR_INVALID_PAYLOAD'));
  });

  test('parseMessage should reject TREE_SNAPSHOT with negative metadata counts', () => {
    return given(treeSnapshotWithNegativeMetadataCountContext)
      .when(parseRawMessage)
      .then(expectErrorCode('ERR_INVALID_PAYLOAD'));
  });

  test('parseMessage should reject TREE_SNAPSHOT with invalid metadata flag type', () => {
    return given(treeSnapshotWithInvalidMetadataFlagContext)
      .when(parseRawMessage)
      .then(expectErrorCode('ERR_INVALID_PAYLOAD'));
  });

  test('parseMessage should reject SNAPSHOT with non-blob capture payload', () => {
    return given(snapshotWithInvalidCaptureContext)
      .when(parseRawMessage)
      .then(expectErrorCode('ERR_INVALID_PAYLOAD'));
  });

  test('parseMessage should reject NODE_PROPS with invalid redactedCount type', () => {
    return given(nodePropsWithInvalidRedactedCountContext)
      .when(parseRawMessage)
      .then(expectErrorCode('ERR_INVALID_PAYLOAD'));
  });

  test('parseMessage should reject NODE_PROPS with negative redactedCount', () => {
    return given(nodePropsWithNegativeRedactedCountContext)
      .when(parseRawMessage)
      .then(expectErrorCode('ERR_INVALID_PAYLOAD'));
  });

  test('parseMessage should reject NODE_PROPS with invalid redactedPaths', () => {
    return given(nodePropsWithInvalidRedactedPathsContext)
      .when(parseRawMessage)
      .then(expectErrorCode('ERR_INVALID_PAYLOAD'));
  });

  test('parseMessage should reject array as message', () => {
    return given(arrayMessageContext)
      .when(parseRawMessage)
      .then(expectErrorCode('ERR_INVALID_MESSAGE'));
  });

  test('parseMessage should accept ERR_UNAUTHORIZED_SESSION in ERROR payload', () => {
    return given(() => errorMessageContextWithCode('ERR_UNAUTHORIZED_SESSION'))
      .when(parseRawMessage)
      .then(expectSuccessfulErrorPayloadParse('ERR_UNAUTHORIZED_SESSION'));
  });

  test('parseMessage should accept ERR_SECURITY_POLICY_REJECTED in ERROR payload', () => {
    return given(() =>
      errorMessageContextWithCode('ERR_SECURITY_POLICY_REJECTED'),
    )
      .when(parseRawMessage)
      .then(expectSuccessfulErrorPayloadParse('ERR_SECURITY_POLICY_REJECTED'));
  });

  test('parseMessage should accept ERR_OVERSIZE_MESSAGE in ERROR payload', () => {
    return given(() => errorMessageContextWithCode('ERR_OVERSIZE_MESSAGE'))
      .when(parseRawMessage)
      .then(expectSuccessfulErrorPayloadParse('ERR_OVERSIZE_MESSAGE'));
  });
});
