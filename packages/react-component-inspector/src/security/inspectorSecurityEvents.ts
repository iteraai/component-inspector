import {
  INSPECTOR_SECURITY_EVENT_NAME_MESSAGE_REJECTED,
  INSPECTOR_SECURITY_EVENT_SCHEMA_VERSION,
  type InspectorErrorCode,
  type InspectorSecurityEventName,
  type InspectorSecurityReasonCode,
} from '@iteraai/inspector-protocol';
import type { InspectorSessionTokenRejectionReason } from './tokenValidation';

export {
  INSPECTOR_SECURITY_EVENT_NAME_MESSAGE_REJECTED,
  INSPECTOR_SECURITY_EVENT_SCHEMA_VERSION,
  mapOversizeRejectionReasonToSecurityReasonCode,
} from '@iteraai/inspector-protocol';
export type { InspectorSecurityEventName, InspectorSecurityReasonCode };
export {
  inspectorSecurityEventNames,
  inspectorSecurityReasonCodes,
} from '@iteraai/inspector-protocol';

export type EmbeddedInspectorSecurityRejectionEvent = {
  schemaVersion: typeof INSPECTOR_SECURITY_EVENT_SCHEMA_VERSION;
  eventName: typeof INSPECTOR_SECURITY_EVENT_NAME_MESSAGE_REJECTED;
  reasonCode: InspectorSecurityReasonCode;
  rejectedBy: 'embedded';
  messageType?: string;
  requestId?: string;
  sessionId?: string;
  errorCode: InspectorErrorCode;
};

export type EmbeddedInspectorSecurityEventLogger = (
  event: EmbeddedInspectorSecurityRejectionEvent,
) => void;

const defaultEmbeddedInspectorSecurityEventLogger: EmbeddedInspectorSecurityEventLogger =
  (event) => {
    console.warn('[react-inspector-bridge/security]', event);
  };

const unauthorizedReasonCodeByReason: Record<
  InspectorSessionTokenRejectionReason,
  InspectorSecurityReasonCode
> = {
  'missing-auth': 'unauthorized-missing-auth',
  'invalid-token': 'unauthorized-invalid-token',
  'expired-token': 'unauthorized-expired-token',
};

export const mapTokenValidationRejectionToSecurityReasonCode = (
  reason: InspectorSessionTokenRejectionReason,
): InspectorSecurityReasonCode => {
  return unauthorizedReasonCodeByReason[reason];
};

export const emitEmbeddedInspectorSecurityRejectionEvent = (
  event: Omit<
    EmbeddedInspectorSecurityRejectionEvent,
    'schemaVersion' | 'eventName' | 'rejectedBy'
  >,
  logger: EmbeddedInspectorSecurityEventLogger = defaultEmbeddedInspectorSecurityEventLogger,
): EmbeddedInspectorSecurityRejectionEvent => {
  const structuredEvent: EmbeddedInspectorSecurityRejectionEvent = {
    ...event,
    schemaVersion: INSPECTOR_SECURITY_EVENT_SCHEMA_VERSION,
    eventName: INSPECTOR_SECURITY_EVENT_NAME_MESSAGE_REJECTED,
    rejectedBy: 'embedded',
  };

  logger(structuredEvent);

  return structuredEvent;
};
