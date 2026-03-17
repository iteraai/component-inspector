import { given } from '#test/givenWhenThen';
import {
  getNormalizedTreeNodeSourceFromElement,
  normalizeTreeNodeSource,
} from './sourceMetadata';

type SourceMetadataContext = {
  rawSource?: unknown;
  normalizedSource?: ReturnType<typeof normalizeTreeNodeSource>;
  element?: Element;
  extractedSource?: ReturnType<typeof getNormalizedTreeNodeSourceFromElement>;
};

const contextCreated = (): SourceMetadataContext => {
  document.body.innerHTML = '';

  return {};
};

const rawSourceSetToValidObject = (
  context: SourceMetadataContext,
): SourceMetadataContext => {
  context.rawSource = {
    file: 'src/App.tsx',
    line: 24,
    column: 9,
  };

  return context;
};

const rawSourceSetToWhitespaceFile = (
  context: SourceMetadataContext,
): SourceMetadataContext => {
  context.rawSource = {
    file: '   ',
    line: 24,
  };

  return context;
};

const rawSourceSetToInvalidLine = (
  context: SourceMetadataContext,
): SourceMetadataContext => {
  context.rawSource = {
    file: 'src/App.tsx',
    line: 'line-24',
  };

  return context;
};

const rawSourceSetToInvalidColumn = (
  context: SourceMetadataContext,
): SourceMetadataContext => {
  context.rawSource = {
    file: 'src/App.tsx',
    line: 24,
    column: 0,
  };

  return context;
};

const sourceNormalized = (
  context: SourceMetadataContext,
): SourceMetadataContext => {
  context.normalizedSource = normalizeTreeNodeSource(context.rawSource);

  return context;
};

const elementPreparedWithSplitSourceAttributes = (
  context: SourceMetadataContext,
): SourceMetadataContext => {
  document.body.innerHTML = `
    <section
      data-inspector-source-file="src/components/Button.tsx"
      data-inspector-source-line="18"
      data-inspector-source-column="4"
    ></section>
  `;

  context.element = document.querySelector('section') ?? undefined;

  return context;
};

const elementPreparedWithJsonSourceAttribute = (
  context: SourceMetadataContext,
): SourceMetadataContext => {
  document.body.innerHTML = `
    <section data-inspector-source='{"file":"src/routes/Home.tsx","line":"44","column":"12"}'></section>
  `;

  context.element = document.querySelector('section') ?? undefined;

  return context;
};

const elementPreparedWithLocationStringSourceAttribute = (
  context: SourceMetadataContext,
): SourceMetadataContext => {
  document.body.innerHTML = `
    <section data-inspector-source="src/routes/Home.tsx:44:12"></section>
  `;

  context.element = document.querySelector('section') ?? undefined;

  return context;
};

const elementPreparedWithLocationStringSourceAttributeWithoutColumn = (
  context: SourceMetadataContext,
): SourceMetadataContext => {
  document.body.innerHTML = `
    <section data-inspector-source="src/routes/Home.tsx:44"></section>
  `;

  context.element = document.querySelector('section') ?? undefined;

  return context;
};

const elementPreparedWithInvalidSourceAttributes = (
  context: SourceMetadataContext,
): SourceMetadataContext => {
  document.body.innerHTML = `
    <section
      data-inspector-source-file="src/routes/Home.tsx"
      data-inspector-source-line="line-44"
      data-inspector-source-column="12"
    ></section>
  `;

  context.element = document.querySelector('section') ?? undefined;

  return context;
};

const sourceExtractedFromElement = (
  context: SourceMetadataContext,
): SourceMetadataContext => {
  if (context.element === undefined) {
    return context;
  }

  context.extractedSource = getNormalizedTreeNodeSourceFromElement(
    context.element,
  );

  return context;
};

const expectSourceNormalized = (context: SourceMetadataContext) => {
  expect(context.normalizedSource).toEqual({
    file: 'src/App.tsx',
    line: 24,
    column: 9,
  });

  return context;
};

const expectSourceRejected = (context: SourceMetadataContext) => {
  expect(context.normalizedSource).toBeUndefined();

  return context;
};

const expectSourceNormalizedWithoutColumn = (
  context: SourceMetadataContext,
) => {
  expect(context.normalizedSource).toEqual({
    file: 'src/App.tsx',
    line: 24,
  });

  return context;
};

const expectSourceExtractedFromSplitAttributes = (
  context: SourceMetadataContext,
) => {
  expect(context.extractedSource).toEqual({
    file: 'src/components/Button.tsx',
    line: 18,
    column: 4,
  });

  return context;
};

const expectSourceExtractedFromJsonAttribute = (
  context: SourceMetadataContext,
) => {
  expect(context.extractedSource).toEqual({
    file: 'src/routes/Home.tsx',
    line: 44,
    column: 12,
  });

  return context;
};

const expectSourceExtractedFromLocationStringAttribute = (
  context: SourceMetadataContext,
) => {
  expect(context.extractedSource).toEqual({
    file: 'src/routes/Home.tsx',
    line: 44,
    column: 12,
  });

  return context;
};

const expectSourceExtractedFromLocationStringAttributeWithoutColumn = (
  context: SourceMetadataContext,
) => {
  expect(context.extractedSource).toEqual({
    file: 'src/routes/Home.tsx',
    line: 44,
  });

  return context;
};

const expectSourceExtractionRejected = (context: SourceMetadataContext) => {
  expect(context.extractedSource).toBeUndefined();

  return context;
};

describe('sourceMetadata', () => {
  afterEach(() => {
    document.body.innerHTML = '';
    vi.restoreAllMocks();
  });

  test('should normalize valid source metadata with file line and column', () => {
    return given(contextCreated)
      .when(rawSourceSetToValidObject)
      .when(sourceNormalized)
      .then(expectSourceNormalized);
  });

  test('should reject source metadata when file is blank', () => {
    return given(contextCreated)
      .when(rawSourceSetToWhitespaceFile)
      .when(sourceNormalized)
      .then(expectSourceRejected);
  });

  test('should reject source metadata when line is invalid', () => {
    return given(contextCreated)
      .when(rawSourceSetToInvalidLine)
      .when(sourceNormalized)
      .then(expectSourceRejected);
  });

  test('should drop invalid optional column while preserving valid file and line', () => {
    return given(contextCreated)
      .when(rawSourceSetToInvalidColumn)
      .when(sourceNormalized)
      .then(expectSourceNormalizedWithoutColumn);
  });

  test('should extract normalized source metadata from split source attributes', () => {
    return given(contextCreated)
      .when(elementPreparedWithSplitSourceAttributes)
      .when(sourceExtractedFromElement)
      .then(expectSourceExtractedFromSplitAttributes);
  });

  test('should extract normalized source metadata from JSON source attribute', () => {
    return given(contextCreated)
      .when(elementPreparedWithJsonSourceAttribute)
      .when(sourceExtractedFromElement)
      .then(expectSourceExtractedFromJsonAttribute);
  });

  test('should extract normalized source metadata from location string source attribute', () => {
    return given(contextCreated)
      .when(elementPreparedWithLocationStringSourceAttribute)
      .when(sourceExtractedFromElement)
      .then(expectSourceExtractedFromLocationStringAttribute);
  });

  test('should extract normalized source metadata from location string source attribute without column', () => {
    return given(contextCreated)
      .when(elementPreparedWithLocationStringSourceAttributeWithoutColumn)
      .when(sourceExtractedFromElement)
      .then(expectSourceExtractedFromLocationStringAttributeWithoutColumn);
  });

  test('should reject invalid element source metadata safely', () => {
    return given(contextCreated)
      .when(elementPreparedWithInvalidSourceAttributes)
      .when(sourceExtractedFromElement)
      .then(expectSourceExtractionRejected);
  });
});
