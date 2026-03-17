import { given } from '#test/givenWhenThen';
import { readFiberNodeSource } from './source';

type SourceContext = {
  fiber: unknown;
  extractedSource?: ReturnType<typeof readFiberNodeSource>;
};

const contextCreated = (): SourceContext => {
  return {
    fiber: {},
  };
};

const contextWithDebugSource = (context: SourceContext): SourceContext => {
  context.fiber = {
    _debugSource: {
      fileName: 'src/App.tsx',
      lineNumber: 12,
      columnNumber: 7,
    },
  };

  return context;
};

const contextWithPartialDebugSource = (
  context: SourceContext,
): SourceContext => {
  context.fiber = {
    _debugSource: {
      fileName: 'src/components/Card.tsx',
      lineNumber: '44',
    },
  };

  return context;
};

const contextWithMixedSourceShapeUsingFallbackValues = (
  context: SourceContext,
): SourceContext => {
  context.fiber = {
    _debugSource: {
      fileName: '   ',
      file: 'src/components/FallbackCard.tsx',
      lineNumber: 'line-44',
      line: 44,
      columnNumber: 0,
      column: 9,
    },
  };

  return context;
};

const contextWithMissingDebugSource = (
  context: SourceContext,
): SourceContext => {
  context.fiber = {
    memoizedProps: {
      title: 'Card',
    },
  };

  return context;
};

const contextWithMalformedDebugSource = (
  context: SourceContext,
): SourceContext => {
  context.fiber = {
    _debugSource: {
      fileName: '   ',
      lineNumber: 'line-44',
      columnNumber: 7,
    },
  };

  return context;
};

const contextWithThrowingDebugSourceGetter = (
  context: SourceContext,
): SourceContext => {
  const fiberWithThrowingGetter = {};

  Object.defineProperty(fiberWithThrowingGetter, '_debugSource', {
    get: () => {
      throw new Error('_debugSource unavailable');
    },
  });

  context.fiber = fiberWithThrowingGetter;

  return context;
};

const sourceExtracted = (context: SourceContext): SourceContext => {
  context.extractedSource = readFiberNodeSource(context.fiber);

  return context;
};

const expectDebugSourceToBeNormalized = (context: SourceContext) => {
  expect(context.extractedSource).toEqual({
    file: 'src/App.tsx',
    line: 12,
    column: 7,
  });
};

const expectPartialDebugSourceToBeNormalizedWithoutColumn = (
  context: SourceContext,
) => {
  expect(context.extractedSource).toEqual({
    file: 'src/components/Card.tsx',
    line: 44,
  });
};

const expectFallbackSourceKeysToBeUsedWhenPrimaryValuesAreInvalid = (
  context: SourceContext,
) => {
  expect(context.extractedSource).toEqual({
    file: 'src/components/FallbackCard.tsx',
    line: 44,
    column: 9,
  });
};

const expectSourceExtractionToFailSoft = (context: SourceContext) => {
  expect(context.extractedSource).toBeUndefined();
};

describe('source', () => {
  test('should normalize source metadata from fiber _debugSource when available', () => {
    return given(contextCreated)
      .when(contextWithDebugSource)
      .when(sourceExtracted)
      .then(expectDebugSourceToBeNormalized);
  });

  test('should normalize valid partial source metadata without a column', () => {
    return given(contextCreated)
      .when(contextWithPartialDebugSource)
      .when(sourceExtracted)
      .then(expectPartialDebugSourceToBeNormalizedWithoutColumn);
  });

  test('should fallback to alternate source keys when primary debug source values are invalid', () => {
    return given(contextCreated)
      .when(contextWithMixedSourceShapeUsingFallbackValues)
      .when(sourceExtracted)
      .then(expectFallbackSourceKeysToBeUsedWhenPrimaryValuesAreInvalid);
  });

  test('should return undefined when _debugSource is unavailable on a fiber node', () => {
    return given(contextCreated)
      .when(contextWithMissingDebugSource)
      .when(sourceExtracted)
      .then(expectSourceExtractionToFailSoft);
  });

  test('should return undefined when _debugSource is malformed', () => {
    return given(contextCreated)
      .when(contextWithMalformedDebugSource)
      .when(sourceExtracted)
      .then(expectSourceExtractionToFailSoft);
  });

  test('should return undefined when _debugSource cannot be read from a fiber node', () => {
    return given(contextCreated)
      .when(contextWithThrowingDebugSourceGetter)
      .when(sourceExtracted)
      .then(expectSourceExtractionToFailSoft);
  });
});
