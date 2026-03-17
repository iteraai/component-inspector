import { given } from '#test/givenWhenThen';
import {
  canHostSendToTargetOrigin,
  deriveTargetOriginFromIframeSrc,
  isOriginTrusted,
  normalizeOrigin,
} from './origins';

type OriginContext = {
  value?: string;
  verdict?: boolean;
};

const deriveOrigin = (_context: OriginContext): OriginContext => {
  return {
    value: deriveTargetOriginFromIframeSrc(
      'https://iteration-123.dev.iteraapp.com/preview?session=1',
    ),
  };
};

const expectDerivedOrigin = (context: OriginContext) => {
  expect(context.value).toBe('https://iteration-123.dev.iteraapp.com');
};

const verifyTrustedOrigin = (_context: OriginContext): OriginContext => {
  return {
    verdict: isOriginTrusted('https://app.iteraapp.com', [
      'https://app.iteraapp.com',
      'https://staging.iteraapp.com',
    ]),
  };
};

const expectTrustedOrigin = (context: OriginContext) => {
  expect(context.verdict).toBe(true);
};

const verifyHostTargetMatch = (_context: OriginContext): OriginContext => {
  return {
    verdict: canHostSendToTargetOrigin(
      'https://iteration-123.dev.iteraapp.com/editor',
      'https://iteration-123.dev.iteraapp.com',
    ),
  };
};

const expectHostTargetMatch = (context: OriginContext) => {
  expect(context.verdict).toBe(true);
};

const normalizeInvalidOrigin = (_context: OriginContext): OriginContext => {
  return {
    value: normalizeOrigin('not-a-valid-origin'),
  };
};

const expectUndefinedOrigin = (context: OriginContext) => {
  expect(context.value).toBeUndefined();
};

describe('origins', () => {
  test('deriveTargetOriginFromIframeSrc should return iframe origin', () => {
    return given({} as OriginContext)
      .when(deriveOrigin)
      .then(expectDerivedOrigin);
  });

  test('isOriginTrusted should return true for allowed host origin', () => {
    return given({} as OriginContext)
      .when(verifyTrustedOrigin)
      .then(expectTrustedOrigin);
  });

  test('canHostSendToTargetOrigin should enforce derived target origin', () => {
    return given({} as OriginContext)
      .when(verifyHostTargetMatch)
      .then(expectHostTargetMatch);
  });

  test('normalizeOrigin should return undefined for invalid input', () => {
    return given({} as OriginContext)
      .when(normalizeInvalidOrigin)
      .then(expectUndefinedOrigin);
  });
});
