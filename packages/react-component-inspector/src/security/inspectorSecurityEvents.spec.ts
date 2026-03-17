import { given } from '#test/givenWhenThen';
import {
  emitEmbeddedInspectorSecurityRejectionEvent,
  INSPECTOR_SECURITY_EVENT_NAME_MESSAGE_REJECTED,
  INSPECTOR_SECURITY_EVENT_SCHEMA_VERSION,
  inspectorSecurityReasonCodes,
  mapOversizeRejectionReasonToSecurityReasonCode,
  mapTokenValidationRejectionToSecurityReasonCode,
  type EmbeddedInspectorSecurityRejectionEvent,
  type InspectorSecurityReasonCode,
} from './inspectorSecurityEvents';

type SecurityEventsContext = {
  logger: ReturnType<
    typeof vi.fn<(event: EmbeddedInspectorSecurityRejectionEvent) => void>
  >;
  mappedReasonCodes?: InspectorSecurityReasonCode[];
  emittedEvent?: EmbeddedInspectorSecurityRejectionEvent;
};

const contextCreated = (): SecurityEventsContext => {
  return {
    logger: vi.fn<(event: EmbeddedInspectorSecurityRejectionEvent) => void>(),
  };
};

const reasonTaxonomyRead = (
  context: SecurityEventsContext,
): SecurityEventsContext => {
  context.mappedReasonCodes = [...inspectorSecurityReasonCodes];

  return context;
};

const tokenValidationReasonsMapped = (
  context: SecurityEventsContext,
): SecurityEventsContext => {
  context.mappedReasonCodes = [
    mapTokenValidationRejectionToSecurityReasonCode('missing-auth'),
    mapTokenValidationRejectionToSecurityReasonCode('invalid-token'),
    mapTokenValidationRejectionToSecurityReasonCode('expired-token'),
  ];

  return context;
};

const oversizeReasonsMapped = (
  context: SecurityEventsContext,
): SecurityEventsContext => {
  context.mappedReasonCodes = [
    mapOversizeRejectionReasonToSecurityReasonCode(
      'host-inbound-message-too-large',
    ),
    mapOversizeRejectionReasonToSecurityReasonCode(
      'embedded-inbound-message-too-large',
    ),
  ];

  return context;
};

const rejectionEventEmitted = (
  context: SecurityEventsContext,
): SecurityEventsContext => {
  context.emittedEvent = emitEmbeddedInspectorSecurityRejectionEvent(
    {
      reasonCode: 'unauthorized-expired-token',
      messageType: 'HELLO',
      requestId: 'request-2',
      sessionId: 'session-2',
      errorCode: 'ERR_UNAUTHORIZED_SESSION',
    },
    context.logger,
  );

  return context;
};

const unsafeRejectionEventEmitted = (
  context: SecurityEventsContext,
): SecurityEventsContext => {
  const unsafeEvent = {
    reasonCode: 'unauthorized-invalid-token',
    messageType: 'HELLO',
    requestId: 'request-unsafe',
    sessionId: 'session-unsafe',
    errorCode: 'ERR_UNAUTHORIZED_SESSION',
    schemaVersion: 999,
    eventName: 'tampered.inspector.event',
    rejectedBy: 'host',
  } as unknown as Omit<
    EmbeddedInspectorSecurityRejectionEvent,
    'schemaVersion' | 'eventName' | 'rejectedBy'
  >;

  context.emittedEvent = emitEmbeddedInspectorSecurityRejectionEvent(
    unsafeEvent,
    context.logger,
  );

  return context;
};

const oversizeFiberRequestRejectionEventEmitted = (
  context: SecurityEventsContext,
): SecurityEventsContext => {
  context.emittedEvent = emitEmbeddedInspectorSecurityRejectionEvent(
    {
      reasonCode: mapOversizeRejectionReasonToSecurityReasonCode(
        'embedded-inbound-message-too-large',
      ),
      messageType: 'REQUEST_TREE',
      requestId: 'request-fiber-oversize',
      sessionId: 'session-fiber-oversize',
      errorCode: 'ERR_OVERSIZE_MESSAGE',
    },
    context.logger,
  );

  return context;
};

const expectReasonTaxonomyStable = () => {
  expect(inspectorSecurityReasonCodes).toEqual([
    'inbound-message-oversize',
    'unauthorized-missing-auth',
    'unauthorized-invalid-token',
    'unauthorized-expired-token',
    'security-policy-rejected',
    'unknown-rejection-reason',
  ]);
};

const expectTokenValidationReasonMappingStable = (
  context: SecurityEventsContext,
) => {
  expect(context.mappedReasonCodes).toEqual([
    'unauthorized-missing-auth',
    'unauthorized-invalid-token',
    'unauthorized-expired-token',
  ]);

  return context;
};

const expectOversizeMappedToSingleReasonCode = (
  context: SecurityEventsContext,
) => {
  expect(context.mappedReasonCodes).toEqual([
    'inbound-message-oversize',
    'inbound-message-oversize',
  ]);

  return context;
};

const expectStructuredEventEmitted = (context: SecurityEventsContext) => {
  expect(context.emittedEvent).toEqual({
    schemaVersion: INSPECTOR_SECURITY_EVENT_SCHEMA_VERSION,
    eventName: INSPECTOR_SECURITY_EVENT_NAME_MESSAGE_REJECTED,
    rejectedBy: 'embedded',
    reasonCode: 'unauthorized-expired-token',
    messageType: 'HELLO',
    requestId: 'request-2',
    sessionId: 'session-2',
    errorCode: 'ERR_UNAUTHORIZED_SESSION',
  });

  expect(context.logger).toHaveBeenCalledTimes(1);
  expect(context.logger).toHaveBeenCalledWith(context.emittedEvent);

  return context;
};

const expectCanonicalMetadataNotOverridable = (
  context: SecurityEventsContext,
) => {
  expect(context.emittedEvent).toMatchObject({
    schemaVersion: INSPECTOR_SECURITY_EVENT_SCHEMA_VERSION,
    eventName: INSPECTOR_SECURITY_EVENT_NAME_MESSAGE_REJECTED,
    rejectedBy: 'embedded',
  });

  return context;
};

const expectOversizeFiberRequestEventEmitted = (
  context: SecurityEventsContext,
) => {
  expect(context.emittedEvent).toEqual({
    schemaVersion: INSPECTOR_SECURITY_EVENT_SCHEMA_VERSION,
    eventName: INSPECTOR_SECURITY_EVENT_NAME_MESSAGE_REJECTED,
    rejectedBy: 'embedded',
    reasonCode: 'inbound-message-oversize',
    messageType: 'REQUEST_TREE',
    requestId: 'request-fiber-oversize',
    sessionId: 'session-fiber-oversize',
    errorCode: 'ERR_OVERSIZE_MESSAGE',
  });

  expect(context.logger).toHaveBeenCalledTimes(1);
  expect(context.logger).toHaveBeenCalledWith(context.emittedEvent);

  return context;
};

describe('inspectorSecurityEvents', () => {
  test('should keep rejection reason taxonomy stable', () => {
    return given(contextCreated)
      .when(reasonTaxonomyRead)
      .then(expectReasonTaxonomyStable);
  });

  test('should map token validation rejections to stable reason codes', () => {
    return given(contextCreated)
      .when(tokenValidationReasonsMapped)
      .then(expectTokenValidationReasonMappingStable);
  });

  test('should map oversize rejection reasons to a stable code', () => {
    return given(contextCreated)
      .when(oversizeReasonsMapped)
      .then(expectOversizeMappedToSingleReasonCode);
  });

  test('should emit versioned structured security rejection events', () => {
    return given(contextCreated)
      .when(rejectionEventEmitted)
      .then(expectStructuredEventEmitted);
  });

  test('should keep canonical metadata when a widened event object includes tampered values', () => {
    return given(contextCreated)
      .when(unsafeRejectionEventEmitted)
      .then(expectCanonicalMetadataNotOverridable);
  });

  test('should emit oversize taxonomy reason code for fiber request rejections', () => {
    return given(contextCreated)
      .when(oversizeFiberRequestRejectionEventEmitted)
      .then(expectOversizeFiberRequestEventEmitted);
  });
});
