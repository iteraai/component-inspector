const sensitiveKeyMatchers = [
  'token',
  'password',
  'secret',
  'authorization',
] as const;

const sensitiveKeyPattern = new RegExp(sensitiveKeyMatchers.join('|'), 'i');

export const redactedValuePreview = 'Sensitive value redacted';

export const isSensitivePropKey = (key: string): boolean => {
  return sensitiveKeyPattern.test(key);
};
