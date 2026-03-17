import { given } from '#test/givenWhenThen';
import { readFiberNodeProps } from './props';
import type { FiberNodeLookupPayload } from './nodeLookup';

type PropsContext = {
  lookupPayload: FiberNodeLookupPayload;
  extractedProps?: unknown;
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

const contextCreated = (): PropsContext => {
  return {
    lookupPayload: createLookupPayload({}),
  };
};

const contextWithMemoizedProps = (context: PropsContext): PropsContext => {
  context.lookupPayload = createLookupPayload({
    memoizedProps: {
      title: 'Toolbar',
      enabled: true,
    },
  });

  return context;
};

const contextWithMissingMemoizedProps = (
  context: PropsContext,
): PropsContext => {
  context.lookupPayload = createLookupPayload({
    pendingProps: {
      title: 'Toolbar',
    },
  });

  return context;
};

const contextWithThrowingMemoizedPropsGetter = (
  context: PropsContext,
): PropsContext => {
  const fiberWithThrowingGetter = {};

  Object.defineProperty(fiberWithThrowingGetter, 'memoizedProps', {
    get: () => {
      throw new Error('memoizedProps unavailable');
    },
  });

  context.lookupPayload = createLookupPayload(fiberWithThrowingGetter);

  return context;
};

const fiberPropsExtracted = (context: PropsContext): PropsContext => {
  context.extractedProps = readFiberNodeProps(context.lookupPayload);

  return context;
};

const expectMemoizedPropsToBeReturned = (context: PropsContext) => {
  expect(context.extractedProps).toEqual({
    title: 'Toolbar',
    enabled: true,
  });
};

const expectMissingMemoizedPropsToFailSoft = (context: PropsContext) => {
  expect(context.extractedProps).toBeUndefined();
};

const expectThrowingMemoizedPropsGetterToFailSoft = (context: PropsContext) => {
  expect(context.extractedProps).toBeUndefined();
};

describe('props', () => {
  test('should return memoizedProps when available on the resolved fiber node', () => {
    return given(contextCreated)
      .when(contextWithMemoizedProps)
      .when(fiberPropsExtracted)
      .then(expectMemoizedPropsToBeReturned);
  });

  test('should return undefined when memoizedProps are unavailable for a resolved fiber node', () => {
    return given(contextCreated)
      .when(contextWithMissingMemoizedProps)
      .when(fiberPropsExtracted)
      .then(expectMissingMemoizedPropsToFailSoft);
  });

  test('should return undefined when memoizedProps cannot be read from a resolved fiber node', () => {
    return given(contextCreated)
      .when(contextWithThrowingMemoizedPropsGetter)
      .when(fiberPropsExtracted)
      .then(expectThrowingMemoizedPropsGetterToFailSoft);
  });
});
