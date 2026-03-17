import { createRequire } from 'node:module';
import { given } from '#test/givenWhenThen';
import {
  INSPECTOR_CHANNEL,
  INSPECTOR_PROTOCOL_VERSION,
  INSPECTOR_SECURITY_EVENT_NAME_MESSAGE_REJECTED,
  INSPECTOR_SECURITY_EVENT_SCHEMA_VERSION,
  buildMessage,
  embeddedToHostMessageTypes,
  hostToEmbeddedMessageTypes,
  inspectorErrorCodes,
  inspectorOversizeRejectionReasons,
  inspectorSecurityEventNames,
  inspectorSecurityReasonCodes,
  isInspectorMessage,
  serializablePlaceholderTypes,
} from './index';
import * as errorsModule from './errors';
import * as indexModule from './index';
import * as originsModule from './origins';
import * as typesModule from './types';
import * as validatorsModule from './validators';

type PackageExportTarget = {
  types: string;
  import: string;
};

type ProtocolContractContext = {
  packageExports?: Record<string, PackageExportTarget>;
  rootExportKeys?: string[];
  errorsExportKeys?: string[];
  originsExportKeys?: string[];
  typesExportKeys?: string[];
  validatorsExportKeys?: string[];
};

type ProtocolGuardContext = {
  raw: unknown;
  result?: boolean;
};

const require = createRequire(import.meta.url);

const getRuntimeExportKeys = (module: object) => Object.keys(module).sort();

const readPackageExports = (): Record<string, PackageExportTarget> => {
  const packageJson = require('../package.json') as {
    exports: Record<string, PackageExportTarget>;
  };

  return packageJson.exports;
};

const contextCreated = (): ProtocolContractContext => {
  return {};
};

const contractInventoryCollected = (
  context: ProtocolContractContext,
): ProtocolContractContext => {
  return {
    ...context,
    packageExports: readPackageExports(),
    rootExportKeys: getRuntimeExportKeys(indexModule),
    errorsExportKeys: getRuntimeExportKeys(errorsModule),
    originsExportKeys: getRuntimeExportKeys(originsModule),
    typesExportKeys: getRuntimeExportKeys(typesModule),
    validatorsExportKeys: getRuntimeExportKeys(validatorsModule),
  };
};

const expectCurrentPublicEntryPoints = (context: ProtocolContractContext) => {
  expect(context.packageExports).toStrictEqual({
    '.': {
      types: './dist/index.d.ts',
      import: './dist/index.js',
    },
    './types': {
      types: './dist/types.d.ts',
      import: './dist/types.js',
    },
    './errors': {
      types: './dist/errors.d.ts',
      import: './dist/errors.js',
    },
    './validators': {
      types: './dist/validators.d.ts',
      import: './dist/validators.js',
    },
    './origins': {
      types: './dist/origins.d.ts',
      import: './dist/origins.js',
    },
  });
  expect(context.rootExportKeys).toStrictEqual([
    'INSPECTOR_CHANNEL',
    'INSPECTOR_PROTOCOL_VERSION',
    'INSPECTOR_SECURITY_EVENT_NAME_MESSAGE_REJECTED',
    'INSPECTOR_SECURITY_EVENT_SCHEMA_VERSION',
    'buildMessage',
    'canHostSendToTargetOrigin',
    'createInspectorProtocolError',
    'deriveTargetOriginFromIframeSrc',
    'embeddedToHostMessageTypes',
    'hostToEmbeddedMessageTypes',
    'inspectorErrorCodes',
    'inspectorOversizeRejectionReasons',
    'inspectorSecurityEventNames',
    'inspectorSecurityReasonCodes',
    'isInspectorMessage',
    'isOriginTrusted',
    'mapOversizeRejectionReasonToSecurityReasonCode',
    'normalizeOrigin',
    'parseMessage',
    'serializablePlaceholderTypes',
  ]);
  expect(context.errorsExportKeys).toStrictEqual([
    'createInspectorProtocolError',
    'inspectorErrorCodes',
    'inspectorOversizeRejectionReasons',
  ]);
  expect(context.originsExportKeys).toStrictEqual([
    'canHostSendToTargetOrigin',
    'deriveTargetOriginFromIframeSrc',
    'isOriginTrusted',
    'normalizeOrigin',
  ]);
  expect(context.typesExportKeys).toStrictEqual([
    'INSPECTOR_CHANNEL',
    'INSPECTOR_PROTOCOL_VERSION',
    'embeddedToHostMessageTypes',
    'hostToEmbeddedMessageTypes',
    'serializablePlaceholderTypes',
  ]);
  expect(context.validatorsExportKeys).toStrictEqual([
    'buildMessage',
    'isInspectorMessage',
    'parseMessage',
  ]);
};

const expectCurrentProtocolConstants = () => {
  expect(INSPECTOR_CHANNEL).toBe('itera-component-inspector');
  expect(INSPECTOR_PROTOCOL_VERSION).toBe(1);
  expect(hostToEmbeddedMessageTypes).toStrictEqual([
    'HELLO',
    'REQUEST_TREE',
    'REQUEST_NODE_PROPS',
    'REQUEST_SNAPSHOT',
    'HIGHLIGHT_NODE',
    'CLEAR_HIGHLIGHT',
    'PING',
  ]);
  expect(embeddedToHostMessageTypes).toStrictEqual([
    'READY',
    'TREE_SNAPSHOT',
    'TREE_DELTA',
    'NODE_PROPS',
    'SNAPSHOT',
    'NODE_SELECTED',
    'PONG',
    'ERROR',
  ]);
  expect(serializablePlaceholderTypes).toStrictEqual([
    'undefined',
    'function',
    'symbol',
    'bigint',
    'date',
    'regexp',
    'map',
    'set',
    'error',
    'dom-node',
    'redacted',
    'unserializable',
  ]);
  expect(inspectorErrorCodes).toStrictEqual([
    'ERR_INVALID_ORIGIN',
    'ERR_UNSUPPORTED_VERSION',
    'ERR_UNAUTHORIZED_SESSION',
    'ERR_SECURITY_POLICY_REJECTED',
    'ERR_OVERSIZE_MESSAGE',
    'ERR_NODE_NOT_FOUND',
    'ERR_INVALID_MESSAGE',
    'ERR_INVALID_PAYLOAD',
    'ERR_UNKNOWN_MESSAGE_TYPE',
  ]);
  expect(inspectorOversizeRejectionReasons).toStrictEqual([
    'host-inbound-message-too-large',
    'embedded-inbound-message-too-large',
  ]);
  expect(INSPECTOR_SECURITY_EVENT_SCHEMA_VERSION).toBe(1);
  expect(INSPECTOR_SECURITY_EVENT_NAME_MESSAGE_REJECTED).toBe(
    'itera.inspector.security.message_rejected',
  );
  expect(inspectorSecurityEventNames).toStrictEqual([
    'itera.inspector.security.message_rejected',
  ]);
  expect(inspectorSecurityReasonCodes).toStrictEqual([
    'inbound-message-oversize',
    'unauthorized-missing-auth',
    'unauthorized-invalid-token',
    'unauthorized-expired-token',
    'security-policy-rejected',
    'unknown-rejection-reason',
  ]);
};

const validInspectorMessageCreated = (): ProtocolGuardContext => {
  return {
    raw: buildMessage('PING', {
      sentAt: 1_700_000_200,
    }),
  };
};

const invalidInspectorMessageCreated = (): ProtocolGuardContext => {
  return {
    raw: {
      channel: INSPECTOR_CHANNEL,
      version: INSPECTOR_PROTOCOL_VERSION,
      type: 'REQUEST_NODE_PROPS',
      payload: {
        nodeId: 42,
      },
    },
  };
};

const inspectorMessageGuardEvaluated = (
  context: ProtocolGuardContext,
): ProtocolGuardContext => {
  return {
    ...context,
    result: isInspectorMessage(context.raw),
  };
};

const expectGuardAcceptsCurrentEnvelope = (context: ProtocolGuardContext) => {
  expect(context.result).toBe(true);
};

const expectGuardRejectsInvalidPayloads = (context: ProtocolGuardContext) => {
  expect(context.result).toBe(false);
};

describe('publicContract', () => {
  test('should preserve the current inspector protocol entrypoints', () => {
    return given(contextCreated)
      .when(contractInventoryCollected)
      .then(expectCurrentPublicEntryPoints);
  });

  test('should preserve the current inspector protocol constants', () => {
    return given(contextCreated)
      .when(contractInventoryCollected)
      .then(expectCurrentProtocolConstants);
  });

  test('should recognize the current protocol envelope with isInspectorMessage', () => {
    return given(validInspectorMessageCreated)
      .when(inspectorMessageGuardEvaluated)
      .then(expectGuardAcceptsCurrentEnvelope);
  });

  test('should reject protocol messages that fail the current payload contract', () => {
    return given(invalidInspectorMessageCreated)
      .when(inspectorMessageGuardEvaluated)
      .then(expectGuardRejectsInvalidPayloads);
  });
});
