import { given } from '#test/givenWhenThen';
import { resolveFiberHighlightTarget } from './highlightTarget';
import type { FiberNodeLookupPayload } from './nodeLookup';

type MockFiber = {
  tag: number;
  stateNode?: unknown;
  child?: MockFiber;
  sibling?: MockFiber;
};

type HighlightTargetContext = {
  lookupPayload: FiberNodeLookupPayload;
  resolvedElement?: Element | null;
};

const createLookupPayload = (fiber: unknown): FiberNodeLookupPayload => {
  return {
    nodeId: 'node-1',
    recordKey: 'fiber:1:0:0.0',
    fiber,
    tag: 0,
    rendererId: 1,
    rendererRootIndex: 0,
    path: '0.0',
    parentNodeId: null,
    childNodeIds: [],
  };
};

const contextCreated = (): HighlightTargetContext => {
  return {
    lookupPayload: createLookupPayload({
      tag: 0,
    }),
  };
};

const contextWithHostFiberStateNodeElement = (
  context: HighlightTargetContext,
): HighlightTargetContext => {
  const directHostElement = document.createElement('button');

  context.lookupPayload = createLookupPayload({
    tag: 5,
    stateNode: directHostElement,
  });

  return context;
};

const contextWithHostDescendantFallback = (
  context: HighlightTargetContext,
): HighlightTargetContext => {
  const unresolvedHostFiber: MockFiber = {
    tag: 5,
    stateNode: 'not-an-element',
  };
  const fallbackHostElement = document.createElement('section');
  const fallbackHostFiber: MockFiber = {
    tag: 5,
    stateNode: fallbackHostElement,
  };
  const intermediateFiber: MockFiber = {
    tag: 11,
    child: unresolvedHostFiber,
  };
  const siblingFiber: MockFiber = {
    tag: 0,
    child: fallbackHostFiber,
  };
  const rootFiber: MockFiber = {
    tag: 0,
    child: intermediateFiber,
  };

  intermediateFiber.sibling = siblingFiber;

  context.lookupPayload = createLookupPayload(rootFiber);

  return context;
};

const contextWithoutResolvableHostElement = (
  context: HighlightTargetContext,
): HighlightTargetContext => {
  const rootFiber: MockFiber = {
    tag: 0,
    child: {
      tag: 11,
      child: {
        tag: 5,
        stateNode: null,
      },
    },
  };

  context.lookupPayload = createLookupPayload(rootFiber);

  return context;
};

const highlightTargetResolved = (
  context: HighlightTargetContext,
): HighlightTargetContext => {
  context.resolvedElement = resolveFiberHighlightTarget(context.lookupPayload);

  return context;
};

const expectDirectHostStateNodeElementResolution = (
  context: HighlightTargetContext,
) => {
  expect((context.resolvedElement as Element).tagName).toBe('BUTTON');
};

const expectHostDescendantFallbackResolution = (
  context: HighlightTargetContext,
) => {
  expect((context.resolvedElement as Element).tagName).toBe('SECTION');
};

const expectUnresolvableFiberToFailSoft = (context: HighlightTargetContext) => {
  expect(context.resolvedElement).toBeNull();
};

describe('highlightTarget', () => {
  test('should resolve the host fiber stateNode element when the selected fiber is a host component', () => {
    return given(contextCreated)
      .when(contextWithHostFiberStateNodeElement)
      .when(highlightTargetResolved)
      .then(expectDirectHostStateNodeElementResolution);
  });

  test('should resolve the first host descendant stateNode element when selected fiber is not host-backed', () => {
    return given(contextCreated)
      .when(contextWithHostDescendantFallback)
      .when(highlightTargetResolved)
      .then(expectHostDescendantFallbackResolution);
  });

  test('should return null when no resolvable host stateNode element exists for the selected fiber subtree', () => {
    return given(contextCreated)
      .when(contextWithoutResolvableHostElement)
      .when(highlightTargetResolved)
      .then(expectUnresolvableFiberToFailSoft);
  });
});
