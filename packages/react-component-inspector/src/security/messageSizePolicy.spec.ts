import { given } from '#test/givenWhenThen';
import {
  EMBEDDED_MAX_INBOUND_INSPECTOR_MESSAGE_BYTES,
  evaluateEmbeddedInboundMessageSize,
  type EmbeddedInboundMessageSizeResult,
} from './messageSizePolicy';

type EmbeddedMessageSizePolicyContext = {
  message: unknown;
  result?: EmbeddedInboundMessageSizeResult;
};

const contextCreated = (): EmbeddedMessageSizePolicyContext => {
  return {
    message: 'hello',
  };
};

const contextWithCyclicMessage = (
  context: EmbeddedMessageSizePolicyContext,
): EmbeddedMessageSizePolicyContext => {
  const cyclicMessage: Record<string, unknown> = {
    channel: 'itera-component-inspector',
  };

  cyclicMessage.self = cyclicMessage;
  context.message = cyclicMessage;

  return context;
};

const contextWithBigIntMessage = (
  context: EmbeddedMessageSizePolicyContext,
): EmbeddedMessageSizePolicyContext => {
  context.message = {
    channel: 'itera-component-inspector',
    payload: {
      value: 12n,
    },
  };

  return context;
};

const contextWithOversizedArrayBufferMessage = (
  context: EmbeddedMessageSizePolicyContext,
): EmbeddedMessageSizePolicyContext => {
  context.message = {
    channel: 'itera-component-inspector',
    payload: {
      capabilities: ['tree'],
    },
    binaryPadding: new ArrayBuffer(
      EMBEDDED_MAX_INBOUND_INSPECTOR_MESSAGE_BYTES * 2,
    ),
  };

  return context;
};

const contextWithDeeplyNestedMessage = (
  context: EmbeddedMessageSizePolicyContext,
): EmbeddedMessageSizePolicyContext => {
  let nested: Record<string, unknown> = {
    leaf: 'value',
  };

  for (let depth = 0; depth < 200; depth += 1) {
    nested = {
      payload: nested,
    };
  }

  context.message = {
    channel: 'itera-component-inspector',
    payload: nested,
  };

  return context;
};

const contextWithFiberTreeSnapshotMessage = (
  context: EmbeddedMessageSizePolicyContext,
): EmbeddedMessageSizePolicyContext => {
  context.message = {
    channel: 'itera-component-inspector',
    type: 'TREE_SNAPSHOT',
    requestId: 'request-fiber-tree-small',
    sessionId: 'session-fiber-tree-small',
    payload: {
      rootIds: ['fiber-node-0'],
      nodes: Array.from({ length: 32 }, (_, index) => ({
        id: `fiber-node-${index}`,
        displayName: `FiberNode${index}`,
        parentId: index === 0 ? null : `fiber-node-${index - 1}`,
        childrenIds: index === 31 ? [] : [`fiber-node-${index + 1}`],
        tags: ['fiber'],
      })),
    },
  };

  return context;
};

const contextWithOversizedFiberTreeSnapshotMessage = (
  context: EmbeddedMessageSizePolicyContext,
): EmbeddedMessageSizePolicyContext => {
  const oversizedDisplayName = 'FiberNode'.repeat(
    EMBEDDED_MAX_INBOUND_INSPECTOR_MESSAGE_BYTES,
  );

  context.message = {
    channel: 'itera-component-inspector',
    type: 'TREE_SNAPSHOT',
    requestId: 'request-fiber-tree-oversize',
    sessionId: 'session-fiber-tree-oversize',
    payload: {
      rootIds: ['fiber-node-0'],
      nodes: [
        {
          id: 'fiber-node-0',
          displayName: oversizedDisplayName,
          parentId: null,
          childrenIds: [],
          tags: ['fiber'],
        },
      ],
    },
  };

  return context;
};

const contextWithOversizedFiberNodePropsMessage = (
  context: EmbeddedMessageSizePolicyContext,
): EmbeddedMessageSizePolicyContext => {
  const oversizedPropValue = 'value'.repeat(
    EMBEDDED_MAX_INBOUND_INSPECTOR_MESSAGE_BYTES,
  );

  context.message = {
    channel: 'itera-component-inspector',
    type: 'NODE_PROPS',
    requestId: 'request-fiber-props-oversize',
    sessionId: 'session-fiber-props-oversize',
    payload: {
      nodeId: 'fiber-node-0',
      props: {
        componentLabel: 'AppShell',
        metadata: {
          description: oversizedPropValue,
        },
      },
      meta: {},
    },
  };

  return context;
};

const messageSizeEvaluated = (
  context: EmbeddedMessageSizePolicyContext,
): EmbeddedMessageSizePolicyContext => {
  context.result = evaluateEmbeddedInboundMessageSize(context.message);

  return context;
};

const expectMessageAccepted = (context: EmbeddedMessageSizePolicyContext) => {
  expect(context.result).toMatchObject({
    ok: true,
    sizeInBytes: expect.any(Number),
  });
};

const expectMessageRejectedAsUnmeasurable = (
  context: EmbeddedMessageSizePolicyContext,
) => {
  expect(context.result).toEqual({
    ok: false,
    maxInboundMessageBytes: EMBEDDED_MAX_INBOUND_INSPECTOR_MESSAGE_BYTES,
    reason: 'embedded-inbound-message-too-large',
  });
};

const expectMessageRejectedAsOversized = (
  context: EmbeddedMessageSizePolicyContext,
) => {
  expect(context.result).toMatchObject({
    ok: false,
    maxInboundMessageBytes: EMBEDDED_MAX_INBOUND_INSPECTOR_MESSAGE_BYTES,
    reason: 'embedded-inbound-message-too-large',
    sizeInBytes: expect.any(Number),
  });
  expect(
    (context.result as { sizeInBytes?: number }).sizeInBytes,
  ).toBeGreaterThan(EMBEDDED_MAX_INBOUND_INSPECTOR_MESSAGE_BYTES);
};

describe('messageSizePolicy', () => {
  test('accepts measurable under-limit message payloads', () => {
    return given(contextCreated)
      .when(messageSizeEvaluated)
      .then(expectMessageAccepted);
  });

  test('rejects cyclic messages that cannot be measured', () => {
    return given(contextCreated)
      .when(contextWithCyclicMessage)
      .when(messageSizeEvaluated)
      .then(expectMessageRejectedAsUnmeasurable);
  });

  test('rejects BigInt messages that cannot be measured', () => {
    return given(contextCreated)
      .when(contextWithBigIntMessage)
      .when(messageSizeEvaluated)
      .then(expectMessageRejectedAsUnmeasurable);
  });

  test('rejects oversized ArrayBuffer side fields in otherwise valid messages', () => {
    return given(contextCreated)
      .when(contextWithOversizedArrayBufferMessage)
      .when(messageSizeEvaluated)
      .then(expectMessageRejectedAsOversized);
  });

  test('rejects deeply nested messages that exceed traversal depth', () => {
    return given(contextCreated)
      .when(contextWithDeeplyNestedMessage)
      .when(messageSizeEvaluated)
      .then(expectMessageRejectedAsUnmeasurable);
  });

  test('accepts measurable fiber tree snapshot payloads under the hard limit', () => {
    return given(contextCreated)
      .when(contextWithFiberTreeSnapshotMessage)
      .when(messageSizeEvaluated)
      .then(expectMessageAccepted);
  });

  test('rejects oversized fiber tree snapshot payloads', () => {
    return given(contextCreated)
      .when(contextWithOversizedFiberTreeSnapshotMessage)
      .when(messageSizeEvaluated)
      .then(expectMessageRejectedAsOversized);
  });

  test('rejects oversized fiber node props payloads', () => {
    return given(contextCreated)
      .when(contextWithOversizedFiberNodePropsMessage)
      .when(messageSizeEvaluated)
      .then(expectMessageRejectedAsOversized);
  });
});
