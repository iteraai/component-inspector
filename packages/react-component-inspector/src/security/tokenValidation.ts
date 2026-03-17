import type { HelloAuthPayload } from '@iteraai/inspector-protocol';

const EPOCH_MILLISECONDS_THRESHOLD = 1_000_000_000_000;

export type InspectorSessionTokenRejectionReason =
  | 'missing-auth'
  | 'invalid-token'
  | 'expired-token';

export type InspectorSessionTokenValidationResult =
  | {
      ok: true;
    }
  | {
      ok: false;
      reason: InspectorSessionTokenRejectionReason;
      message: string;
    };

export type InspectorSessionTokenValidator = (
  auth: HelloAuthPayload | undefined,
) => InspectorSessionTokenValidationResult;

export type InspectorBridgeSecurityOptions = {
  enabled: boolean;
  tokenValidator?: InspectorSessionTokenValidator;
};

const toEpochMilliseconds = (timestamp: number) => {
  if (!Number.isFinite(timestamp)) {
    return Number.NaN;
  }

  if (timestamp >= EPOCH_MILLISECONDS_THRESHOLD) {
    return timestamp;
  }

  return timestamp * 1000;
};

export const validateHelloSessionToken: InspectorSessionTokenValidator = (
  auth,
) => {
  if (auth === undefined) {
    return {
      ok: false,
      reason: 'missing-auth',
      message: 'HELLO auth payload is required in secure mode.',
    };
  }

  if (auth.sessionToken.trim().length === 0) {
    return {
      ok: false,
      reason: 'invalid-token',
      message: 'HELLO auth session token must be a non-empty string.',
    };
  }

  const expiresAt = auth.metadata?.expiresAt;

  if (expiresAt !== undefined && toEpochMilliseconds(expiresAt) <= Date.now()) {
    return {
      ok: false,
      reason: 'expired-token',
      message: 'HELLO auth session token is expired.',
    };
  }

  return {
    ok: true,
  };
};
