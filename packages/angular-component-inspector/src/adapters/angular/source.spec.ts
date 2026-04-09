import { readAngularNodeSource } from './source';

const createAngularComponentDouble = (
  displayName: string,
  sourceMetadata?: Record<string, unknown>,
) => {
  return Object.defineProperty({}, 'constructor', {
    configurable: true,
    value: {
      name: displayName,
      ...(sourceMetadata !== undefined && {
        __iteraSource: sourceMetadata,
      }),
    },
  });
};

const createAngularComponentWithDebugInfoDouble = (
  displayName: string,
  debugInfo?: Record<string, unknown>,
) => {
  return Object.defineProperty({}, 'constructor', {
    configurable: true,
    value: {
      name: displayName,
      ...(debugInfo !== undefined && {
        ɵcmp: {
          debugInfo,
        },
      }),
    },
  });
};

test('reads normalized source metadata from the Angular component type', () => {
  expect(
    readAngularNodeSource(
      createAngularComponentDouble('ProductCardComponent', {
        file: 'src/app/product-card/product-card.component.ts',
        line: 12,
        column: 3,
      }),
    ),
  ).toEqual({
    file: 'src/app/product-card/product-card.component.ts',
    line: 12,
    column: 3,
  });
});

test('drops malformed Angular source metadata safely', () => {
  expect(
    readAngularNodeSource(
      createAngularComponentDouble('BrokenComponent', {
        file: '   ',
        line: 'nope',
      }),
    ),
  ).toBeUndefined();
});

test('drops an invalid optional source column while preserving file and line', () => {
  expect(
    readAngularNodeSource(
      createAngularComponentDouble('HeaderComponent', {
        file: 'src/app/header.component.ts',
        line: 8,
        column: 0,
      }),
    ),
  ).toEqual({
    file: 'src/app/header.component.ts',
    line: 8,
  });
});

test('reads Angular debug info metadata from the component definition', () => {
  expect(
    readAngularNodeSource(
      createAngularComponentWithDebugInfoDouble('ProductCardComponent', {
        filePath: 'src/app/product-card/product-card.component.ts',
        lineNumber: 12,
      }),
    ),
  ).toEqual({
    file: 'src/app/product-card/product-card.component.ts',
    line: 12,
  });
});
