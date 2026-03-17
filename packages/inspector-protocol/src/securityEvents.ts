import type { InspectorOversizeRejectionReason } from './errors';

export const INSPECTOR_SECURITY_EVENT_SCHEMA_VERSION = 1 as const;

export const INSPECTOR_SECURITY_EVENT_NAME_MESSAGE_REJECTED =
  'itera.inspector.security.message_rejected';

export const inspectorSecurityEventNames = [
  INSPECTOR_SECURITY_EVENT_NAME_MESSAGE_REJECTED,
] as const;

export type InspectorSecurityEventName =
  (typeof inspectorSecurityEventNames)[number];

export const inspectorSecurityReasonCodes = [
  'inbound-message-oversize',
  'unauthorized-missing-auth',
  'unauthorized-invalid-token',
  'unauthorized-expired-token',
  'security-policy-rejected',
  'unknown-rejection-reason',
] as const;

export type InspectorSecurityReasonCode =
  (typeof inspectorSecurityReasonCodes)[number];

export const mapOversizeRejectionReasonToSecurityReasonCode = (
  _reason: InspectorOversizeRejectionReason,
): InspectorSecurityReasonCode => {
  return 'inbound-message-oversize';
};
