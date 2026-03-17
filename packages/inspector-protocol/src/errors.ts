export const inspectorErrorCodes = [
  'ERR_INVALID_ORIGIN',
  'ERR_UNSUPPORTED_VERSION',
  'ERR_UNAUTHORIZED_SESSION',
  'ERR_SECURITY_POLICY_REJECTED',
  'ERR_OVERSIZE_MESSAGE',
  'ERR_NODE_NOT_FOUND',
  'ERR_INVALID_MESSAGE',
  'ERR_INVALID_PAYLOAD',
  'ERR_UNKNOWN_MESSAGE_TYPE',
] as const;

export type InspectorErrorCode = (typeof inspectorErrorCodes)[number];

export const inspectorOversizeRejectionReasons = [
  'host-inbound-message-too-large',
  'embedded-inbound-message-too-large',
] as const;

export type InspectorOversizeRejectionReason =
  (typeof inspectorOversizeRejectionReasons)[number];

export type InspectorProtocolError = {
  code: InspectorErrorCode;
  message: string;
  details?: string;
};

const inspectorErrorMessages: Record<InspectorErrorCode, string> = {
  ERR_INVALID_ORIGIN: 'Message origin is not trusted.',
  ERR_UNSUPPORTED_VERSION: 'Protocol version is not supported.',
  ERR_UNAUTHORIZED_SESSION: 'Inspector session is not authorized.',
  ERR_SECURITY_POLICY_REJECTED:
    'Message was rejected by inspector security policy.',
  ERR_OVERSIZE_MESSAGE: 'Message exceeds the allowed inspector size limit.',
  ERR_NODE_NOT_FOUND: 'Requested node was not found.',
  ERR_INVALID_MESSAGE: 'Message does not match protocol envelope.',
  ERR_INVALID_PAYLOAD: 'Message payload does not match type contract.',
  ERR_UNKNOWN_MESSAGE_TYPE: 'Message type is not recognized by protocol v1.',
};

export const createInspectorProtocolError = (
  code: InspectorErrorCode,
  details?: string,
): InspectorProtocolError => {
  const baseMessage = inspectorErrorMessages[code];

  if (details === undefined) {
    return {
      code,
      message: baseMessage,
    };
  }

  return {
    code,
    message: `${baseMessage} ${details}`,
    details,
  };
};
