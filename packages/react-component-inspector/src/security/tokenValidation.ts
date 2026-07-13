import type { HelloAuthPayload } from '@iteraai/inspector-protocol';
import { validateHelloSessionToken as validateSharedHelloSessionToken } from '../../../inspector-runtime-core/src/security/tokenValidation';

export type InspectorSessionTokenRejectionReason =
  | 'missing-auth'
  | 'invalid-token'
  | 'expired-token';
export type InspectorSessionTokenValidationResult =
  | { ok: true }
  | { ok: false; reason: InspectorSessionTokenRejectionReason; message: string };
export type InspectorSessionTokenValidator = (
  auth: HelloAuthPayload | undefined,
) => InspectorSessionTokenValidationResult;
export type InspectorBridgeSecurityOptions = {
  enabled: boolean;
  tokenValidator?: InspectorSessionTokenValidator;
};
export const validateHelloSessionToken: InspectorSessionTokenValidator =
  validateSharedHelloSessionToken;
