export const defaultExampleHostOrigins = [
  'http://127.0.0.1:4173',
  'http://localhost:4173',
] as const;

export const resolveExampleHostOrigins = (
  hostOrigins?: readonly string[],
) => {
  if (hostOrigins === undefined) {
    return [...defaultExampleHostOrigins];
  }

  const resolvedHostOrigins = hostOrigins
    .map((origin) => origin.trim())
    .filter((origin) => origin.length > 0);

  return resolvedHostOrigins.length > 0
    ? resolvedHostOrigins
    : [...defaultExampleHostOrigins];
};
