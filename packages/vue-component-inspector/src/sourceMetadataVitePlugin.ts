import path from 'node:path';
import type { Plugin } from 'vite';

const SUPPORTED_SOURCE_FILE_EXTENSIONS = new Set([
  '.js',
  '.jsx',
  '.mjs',
  '.cjs',
  '.ts',
  '.tsx',
  '.vue',
]);

const DEFINE_COMPONENT_IMPORT_PATTERN =
  /import\s+(?:[A-Za-z_$][\w$]*\s*,\s*)?\{([^}]*)\}\s*from\s*['"]vue['"]/g;
const DEFINE_COMPONENT_SPECIFIER_PATTERN =
  /(?:^|,)\s*defineComponent(?:\s+as\s+([A-Za-z_$][\w$]*))?\s*(?=,|$)/g;
const IDENTIFIER_CHARACTER_PATTERN = /[A-Za-z0-9_$]/;

const stripQueryAndHash = (id: string) => {
  const queryIndex = id.indexOf('?');
  const hashIndex = id.indexOf('#');
  const truncatedIndex =
    queryIndex === -1
      ? hashIndex
      : hashIndex === -1
        ? queryIndex
        : Math.min(queryIndex, hashIndex);

  return truncatedIndex === -1 ? id : id.slice(0, truncatedIndex);
};

const isSupportedSourceFile = (id: string) => {
  const sourceId = stripQueryAndHash(id);

  if (
    sourceId.length === 0 ||
    sourceId.startsWith('\0') ||
    sourceId.endsWith('.d.ts') ||
    sourceId.includes('/node_modules/') ||
    sourceId.includes('\\node_modules\\')
  ) {
    return false;
  }

  return SUPPORTED_SOURCE_FILE_EXTENSIONS.has(path.extname(sourceId));
};

const toPosixPath = (value: string) => {
  return value.replaceAll(path.sep, '/');
};

const toSerializableSourceFile = (id: string, root: string) => {
  const sourceId = stripQueryAndHash(id);
  const relativePath = path.relative(root, sourceId);

  if (
    relativePath.length > 0 &&
    !relativePath.startsWith('..') &&
    !path.isAbsolute(relativePath)
  ) {
    return toPosixPath(relativePath);
  }

  return toPosixPath(sourceId);
};

const collectDefineComponentLocalNames = (code: string) => {
  const localNames = new Set<string>();

  for (const importMatch of code.matchAll(DEFINE_COMPONENT_IMPORT_PATTERN)) {
    const namedImports = importMatch[1];

    for (const specifierMatch of namedImports.matchAll(
      DEFINE_COMPONENT_SPECIFIER_PATTERN,
    )) {
      localNames.add(specifierMatch[1] ?? 'defineComponent');
    }
  }

  return [...localNames];
};

const skipLineComment = (code: string, index: number) => {
  let currentIndex = index + 2;

  while (currentIndex < code.length && code[currentIndex] !== '\n') {
    currentIndex += 1;
  }

  return currentIndex;
};

const skipBlockComment = (code: string, index: number) => {
  const closingIndex = code.indexOf('*/', index + 2);

  return closingIndex === -1 ? code.length : closingIndex + 2;
};

const skipQuotedString = (code: string, index: number, quote: '"' | "'") => {
  let currentIndex = index + 1;

  while (currentIndex < code.length) {
    const character = code[currentIndex];

    if (character === '\\') {
      currentIndex += 2;
      continue;
    }

    if (character === quote) {
      return currentIndex + 1;
    }

    currentIndex += 1;
  }

  return code.length;
};

const findMatchingBracketEnd = (
  code: string,
  startIndex: number,
  openCharacter: string,
  closeCharacter: string,
): number => {
  let depth = 1;
  let currentIndex = startIndex + 1;

  while (currentIndex < code.length) {
    const character = code[currentIndex];
    const nextCharacter = code[currentIndex + 1];

    if (character === "'" || character === '"') {
      currentIndex = skipQuotedString(code, currentIndex, character);
      continue;
    }

    if (character === '`') {
      currentIndex = skipTemplateLiteral(code, currentIndex);
      continue;
    }

    if (character === '/' && nextCharacter === '/') {
      currentIndex = skipLineComment(code, currentIndex);
      continue;
    }

    if (character === '/' && nextCharacter === '*') {
      currentIndex = skipBlockComment(code, currentIndex);
      continue;
    }

    if (character === openCharacter) {
      depth += 1;
      currentIndex += 1;
      continue;
    }

    if (character === closeCharacter) {
      depth -= 1;

      if (depth === 0) {
        return currentIndex;
      }

      currentIndex += 1;
      continue;
    }

    currentIndex += 1;
  }

  return -1;
};

const skipTemplateLiteral = (code: string, index: number) => {
  let currentIndex = index + 1;

  while (currentIndex < code.length) {
    const character = code[currentIndex];
    const nextCharacter = code[currentIndex + 1];

    if (character === '\\') {
      currentIndex += 2;
      continue;
    }

    if (character === '`') {
      return currentIndex + 1;
    }

    if (character === '$' && nextCharacter === '{') {
      const expressionEnd = findMatchingBracketEnd(
        code,
        currentIndex + 1,
        '{',
        '}',
      );

      if (expressionEnd === -1) {
        return code.length;
      }

      currentIndex = expressionEnd + 1;
      continue;
    }

    currentIndex += 1;
  }

  return code.length;
};

const skipWhitespaceAndComments = (code: string, index: number) => {
  let currentIndex = index;

  while (currentIndex < code.length) {
    const character = code[currentIndex];
    const nextCharacter = code[currentIndex + 1];

    if (/\s/.test(character)) {
      currentIndex += 1;
      continue;
    }

    if (character === '/' && nextCharacter === '/') {
      currentIndex = skipLineComment(code, currentIndex);
      continue;
    }

    if (character === '/' && nextCharacter === '*') {
      currentIndex = skipBlockComment(code, currentIndex);
      continue;
    }

    break;
  }

  return currentIndex;
};

const hasIdentifierBoundary = (code: string, index: number, length: number) => {
  const previousCharacter = code[index - 1];
  const nextCharacter = code[index + length];

  return (
    (previousCharacter === undefined ||
      (!IDENTIFIER_CHARACTER_PATTERN.test(previousCharacter) &&
        previousCharacter !== '.')) &&
    (nextCharacter === undefined || !IDENTIFIER_CHARACTER_PATTERN.test(nextCharacter))
  );
};

const findDefineComponentObjectStart = (
  code: string,
  identifierIndex: number,
  identifierLength: number,
) => {
  let currentIndex = skipWhitespaceAndComments(
    code,
    identifierIndex + identifierLength,
  );

  if (code[currentIndex] === '<') {
    return -1;
  }

  if (code[currentIndex] !== '(') {
    return -1;
  }

  currentIndex = skipWhitespaceAndComments(code, currentIndex + 1);

  return code[currentIndex] === '{' ? currentIndex : -1;
};

const collectInsertionIndexes = (code: string, localNames: readonly string[]) => {
  const insertionIndexes = new Set<number>();

  localNames.forEach((localName) => {
    let searchIndex = 0;

    while (searchIndex < code.length) {
      const matchIndex = code.indexOf(localName, searchIndex);

      if (matchIndex === -1) {
        break;
      }

      searchIndex = matchIndex + localName.length;

      if (!hasIdentifierBoundary(code, matchIndex, localName.length)) {
        continue;
      }

      const objectStart = findDefineComponentObjectStart(
        code,
        matchIndex,
        localName.length,
      );

      if (objectStart !== -1) {
        insertionIndexes.add(objectStart);
      }
    }
  });

  return [...insertionIndexes].sort((left, right) => left - right);
};

const toLineAndColumn = (code: string, index: number) => {
  let line = 1;
  let column = 1;

  for (let currentIndex = 0; currentIndex < index; currentIndex += 1) {
    if (code[currentIndex] === '\n') {
      line += 1;
      column = 1;
      continue;
    }

    column += 1;
  }

  return {
    line,
    column,
  };
};

export const transformVueInspectorSourceMetadataModule = (
  code: string,
  id: string,
  root: string,
) => {
  if (!isSupportedSourceFile(id) || !code.includes('defineComponent')) {
    return null;
  }

  const defineComponentLocalNames = collectDefineComponentLocalNames(code);

  if (defineComponentLocalNames.length === 0) {
    return null;
  }

  const insertionIndexes = collectInsertionIndexes(code, defineComponentLocalNames);

  if (insertionIndexes.length === 0) {
    return null;
  }

  const file = toSerializableSourceFile(id, root);
  let transformedCode = code;
  let offset = 0;

  insertionIndexes.forEach((objectStart) => {
    const source = toLineAndColumn(code, objectStart);
    const sourceLiteral = `__source:${JSON.stringify({
      file,
      line: source.line,
      column: source.column,
    })},`;
    const insertionIndex = objectStart + 1 + offset;

    transformedCode =
      transformedCode.slice(0, insertionIndex) +
      sourceLiteral +
      transformedCode.slice(insertionIndex);
    offset += sourceLiteral.length;
  });

  return transformedCode;
};

export const createVueInspectorSourceMetadataVitePlugin = (): Plugin => {
  let projectRoot = process.cwd();

  return {
    name: 'itera-vue-inspector-source-metadata',
    enforce: 'pre',
    configResolved(config) {
      projectRoot = config.root;
    },
    transform(code, id) {
      const transformedCode = transformVueInspectorSourceMetadataModule(
        code,
        id,
        projectRoot,
      );

      if (transformedCode === null) {
        return null;
      }

      return {
        code: transformedCode,
        map: null,
      };
    },
  };
};
