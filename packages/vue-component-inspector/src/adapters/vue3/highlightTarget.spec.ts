import type { VueNodeLookupPayload } from './nodeLookup';
import {
  resolveVueComponentRootElements,
  resolveVueHighlightTarget,
} from './highlightTarget';

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
    displayName: 'HighlightTarget',
    parentNodeId: null,
    childNodeIds: [],
  };
};

describe('highlightTarget', () => {
  test('resolves the direct root element for DOM-rooted components', () => {
    const button = document.createElement('button');

    expect(
      resolveVueHighlightTarget(
        createLookupPayload({
          subTree: {
            el: button,
          },
        }),
      ),
    ).toBe(button);
  });

  test('falls back to the first descendant element for fragment-backed components', () => {
    const firstElement = document.createElement('section');
    const secondElement = document.createElement('aside');
    const lookupPayload = createLookupPayload({
      subTree: {
        el: document.createComment('fragment-start'),
        children: [{ el: firstElement }, { el: secondElement }],
      },
    });

    expect(resolveVueComponentRootElements(lookupPayload)).toEqual([
      firstElement,
      secondElement,
    ]);
    expect(resolveVueHighlightTarget(lookupPayload)).toBe(firstElement);
  });

  test('walks nested component subtrees when the selected node renders another component', () => {
    const nestedElement = document.createElement('article');

    expect(
      resolveVueHighlightTarget(
        createLookupPayload({
          subTree: {
            component: {
              subTree: {
                el: nestedElement,
              },
            },
          },
        }),
      ),
    ).toBe(nestedElement);
  });

  test('returns null when no highlightable element can be resolved', () => {
    expect(
      resolveVueHighlightTarget(
        createLookupPayload({
          subTree: {
            el: document.createComment('fragment-start'),
            children: [],
          },
        }),
      ),
    ).toBeNull();
  });
});
