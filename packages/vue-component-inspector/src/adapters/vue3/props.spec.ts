import type { VueNodeLookupPayload } from './nodeLookup';
import { readVueNodeProps } from './props';

const createLookupPayload = (instance: unknown): VueNodeLookupPayload => {
  return {
    nodeId: 'node-1',
    recordKey: 'root:0:uid:1',
    appRecord: {
      app: {} as never,
      container: document.createElement('div'),
      source: 'explicit',
    },
    rootIndex: 0,
    instance,
    displayName: 'Toolbar',
    parentNodeId: null,
    childNodeIds: [],
  };
};

describe('props', () => {
  test('returns a stable plain-object copy of component props', () => {
    const originalProps = {
      title: 'Toolbar',
      enabled: true,
    };

    expect(readVueNodeProps(createLookupPayload({ props: originalProps }))).toEqual(
      originalProps,
    );
    expect(
      readVueNodeProps(createLookupPayload({ props: originalProps })),
    ).not.toBe(originalProps);
  });

  test('returns an empty object when component props are unavailable', () => {
    expect(readVueNodeProps(createLookupPayload({ attrs: { id: 'toolbar' } }))).toEqual(
      {},
    );
  });

  test('fills unreadable prop keys with undefined placeholders', () => {
    const propsWithThrowingGetter = {};

    Object.defineProperty(propsWithThrowingGetter, 'title', {
      enumerable: true,
      get: () => {
        throw new Error('title unavailable');
      },
    });

    expect(
      readVueNodeProps(createLookupPayload({ props: propsWithThrowingGetter })),
    ).toEqual({
      title: undefined,
    });
  });
});
