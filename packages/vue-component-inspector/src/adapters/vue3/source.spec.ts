import { readVueNodeSource } from './source';

describe('readVueNodeSource', () => {
  test('normalizes rich __source metadata when line and column are available', () => {
    expect(
      readVueNodeSource({
        __source: {
          file: 'src/components/PublishButton.ts',
          line: '12',
          column: 8,
        },
      }),
    ).toEqual({
      file: 'src/components/PublishButton.ts',
      line: 12,
      column: 8,
    });
  });

  test('falls back to a best-effort line when only file metadata exists', () => {
    expect(
      readVueNodeSource({
        __file: 'src/components/PublishButton.ts',
      }),
    ).toEqual({
      file: 'src/components/PublishButton.ts',
      line: 1,
    });
  });

  test('drops malformed source metadata safely', () => {
    expect(
      readVueNodeSource({
        __source: {
          file: '   ',
          line: 0,
          column: 'not-a-number',
        },
      }),
    ).toBeUndefined();
  });
});
