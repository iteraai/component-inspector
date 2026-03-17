import { given } from '#test/givenWhenThen';
import {
  traverseFiberRootsFromProbe,
  type FiberTraversalSnapshot,
} from './fiberTraversal';
import { probeDevtoolsFiberRoots } from './devtoolsProbe';
import type { DevtoolsProbeResult, DevtoolsProbeWindow } from './types';

type MockRenderer = Readonly<{
  rendererId: number;
  renderer: unknown;
}>;

type FiberNode = {
  tag: number;
  type?: unknown;
  child?: FiberNode | null;
  sibling?: FiberNode | null;
};

type FiberRootLike = Readonly<{
  current: FiberNode | null;
}>;

type NextRuntimeStatus =
  | 'supported-now'
  | 'conditionally-supported'
  | 'unsupported';

type NextRuntimeObservation = Readonly<{
  status: NextRuntimeStatus;
  reason: string;
  displayNames: string[];
  divergenceNotes: string[];
}>;

type NextRuntimeContext = {
  windowRef: DevtoolsProbeWindow;
  rendererRef: MockRenderer;
  probeResult?: DevtoolsProbeResult;
  traversalSnapshot?: FiberTraversalSnapshot;
  observation?: NextRuntimeObservation;
};

type MockDevtoolsHookOptions = Readonly<{
  renderers?: MockRenderer[];
  getFiberRoots?: (rendererId: number) => unknown;
}>;

const FUNCTION_COMPONENT_TAG = 0;
const FORWARD_REF_COMPONENT_TAG = 11;

const assessNextRuntimeProbe = (
  probeResult: DevtoolsProbeResult,
  traversalSnapshot: FiberTraversalSnapshot,
): NextRuntimeObservation => {
  if (probeResult.status === 'ok') {
    const displayNames = traversalSnapshot.nodes.map((node) => {
      return node.displayName;
    });

    if (displayNames.length === 0) {
      return {
        status: 'unsupported',
        reason: 'component-fibers-empty',
        displayNames,
        divergenceNotes: [
          'Next runtime root is reachable, but no component fibers were collected from current roots.',
        ],
      };
    }

    if (displayNames.includes('Anonymous')) {
      return {
        status: 'conditionally-supported',
        reason: 'anonymous-wrapper-names',
        displayNames,
        divergenceNotes: [
          'Next client wrappers can resolve as Anonymous when function/object names are stripped.',
        ],
      };
    }

    return {
      status: 'supported-now',
      reason: 'next-client-fibers-readable',
      displayNames,
      divergenceNotes: [
        'DevTools renderer roots and component display names were readable in Next client runtime.',
      ],
    };
  }

  if (probeResult.status === 'empty' && probeResult.reason === 'root-empty') {
    return {
      status: 'unsupported',
      reason: 'next-client-boundary-missing',
      displayNames: [],
      divergenceNotes: [
        'Next server-only shell path returns no client fiber roots and must fail soft to empty tree.',
      ],
    };
  }

  return {
    status: 'unsupported',
    reason: probeResult.reason,
    displayNames: [],
    divergenceNotes: [
      'Next runtime cannot be classified as supported because the DevTools probe did not return usable roots.',
    ],
  };
};

const createMockRenderers = (renderers: MockRenderer[] = []) => {
  return new Map<unknown, unknown>(
    renderers.map((rendererInput) => {
      return [rendererInput.rendererId, rendererInput.renderer];
    }),
  );
};

const createMockDevtoolsHook = (
  options: MockDevtoolsHookOptions,
): Record<string, unknown> => {
  return {
    ...(options.renderers !== undefined && {
      renderers: createMockRenderers(options.renderers),
    }),
    ...(options.getFiberRoots !== undefined && {
      getFiberRoots: options.getFiberRoots,
    }),
  };
};

const createFiberNode = (
  tag: number,
  options: Omit<FiberNode, 'tag'> = {},
): FiberNode => {
  return {
    tag,
    ...options,
  };
};

const contextCreated = (): NextRuntimeContext => {
  return {
    windowRef: {},
    rendererRef: {
      rendererId: 1,
      renderer: {
        rendererName: 'next-client-renderer',
      },
    },
  };
};

const hookConfiguredForNamedNextClientTree = (
  context: NextRuntimeContext,
): NextRuntimeContext => {
  const pageNode = createFiberNode(FUNCTION_COMPONENT_TAG, {
    type: function Page() {
      return null;
    },
  });
  const layoutNode = createFiberNode(FUNCTION_COMPONENT_TAG, {
    type: function LayoutRouter() {
      return null;
    },
    child: pageNode,
  });
  const appRouterNode = createFiberNode(FUNCTION_COMPONENT_TAG, {
    type: function AppRouter() {
      return null;
    },
    child: layoutNode,
  });
  const hostRootNode = createFiberNode(3, {
    child: appRouterNode,
  });

  const nextClientRoot: FiberRootLike = {
    current: hostRootNode,
  };

  context.windowRef.__REACT_DEVTOOLS_GLOBAL_HOOK__ = createMockDevtoolsHook({
    renderers: [context.rendererRef],
    getFiberRoots: (rendererId: number) => {
      if (rendererId !== context.rendererRef.rendererId) {
        return new Set<unknown>();
      }

      return new Set<unknown>([nextClientRoot]);
    },
  });

  return context;
};

const hookConfiguredForAnonymousNextClientWrappers = (
  context: NextRuntimeContext,
): NextRuntimeContext => {
  const pageNode = createFiberNode(FUNCTION_COMPONENT_TAG, {
    type: function Page() {
      return null;
    },
  });
  const anonymousWrapperNode = createFiberNode(FORWARD_REF_COMPONENT_TAG, {
    type: {},
    child: pageNode,
  });
  const appRouterNode = createFiberNode(FUNCTION_COMPONENT_TAG, {
    type: function AppRouter() {
      return null;
    },
    child: anonymousWrapperNode,
  });
  const hostRootNode = createFiberNode(3, {
    child: appRouterNode,
  });

  const nextClientRoot: FiberRootLike = {
    current: hostRootNode,
  };

  context.windowRef.__REACT_DEVTOOLS_GLOBAL_HOOK__ = createMockDevtoolsHook({
    renderers: [context.rendererRef],
    getFiberRoots: () => {
      return new Set<unknown>([nextClientRoot]);
    },
  });

  return context;
};

const hookConfiguredForNextServerOnlyShell = (
  context: NextRuntimeContext,
): NextRuntimeContext => {
  context.windowRef.__REACT_DEVTOOLS_GLOBAL_HOOK__ = createMockDevtoolsHook({
    renderers: [context.rendererRef],
    getFiberRoots: () => {
      return new Set<unknown>();
    },
  });

  return context;
};

const probeExecuted = (context: NextRuntimeContext): NextRuntimeContext => {
  context.probeResult = probeDevtoolsFiberRoots(context.windowRef);

  return context;
};

const traversalCaptured = (context: NextRuntimeContext): NextRuntimeContext => {
  if (context.probeResult === undefined) {
    throw new Error('probe result missing before traversal capture');
  }

  context.traversalSnapshot = traverseFiberRootsFromProbe(context.probeResult);

  return context;
};

const nextRuntimeAssessed = (
  context: NextRuntimeContext,
): NextRuntimeContext => {
  if (context.probeResult === undefined) {
    throw new Error('probe result missing before runtime assessment');
  }

  if (context.traversalSnapshot === undefined) {
    throw new Error('traversal snapshot missing before runtime assessment');
  }

  context.observation = assessNextRuntimeProbe(
    context.probeResult,
    context.traversalSnapshot,
  );

  return context;
};

const expectSupportedNextClientObservation = (context: NextRuntimeContext) => {
  expect(context.probeResult).toEqual({
    status: 'ok',
    renderers: [context.rendererRef],
    roots: [
      {
        rendererId: context.rendererRef.rendererId,
        root: expect.any(Object),
      },
    ],
  });

  expect(
    context.traversalSnapshot?.nodes.map((node) => node.displayName),
  ).toEqual(['AppRouter', 'LayoutRouter', 'Page']);

  expect(context.observation).toEqual({
    status: 'supported-now',
    reason: 'next-client-fibers-readable',
    displayNames: ['AppRouter', 'LayoutRouter', 'Page'],
    divergenceNotes: [
      'DevTools renderer roots and component display names were readable in Next client runtime.',
    ],
  });
};

const expectConditionallySupportedNextClientObservation = (
  context: NextRuntimeContext,
) => {
  expect(context.probeResult).toEqual({
    status: 'ok',
    renderers: [context.rendererRef],
    roots: [
      {
        rendererId: context.rendererRef.rendererId,
        root: expect.any(Object),
      },
    ],
  });

  expect(
    context.traversalSnapshot?.nodes.map((node) => node.displayName),
  ).toEqual(['AppRouter', 'Anonymous', 'Page']);

  expect(context.observation).toEqual({
    status: 'conditionally-supported',
    reason: 'anonymous-wrapper-names',
    displayNames: ['AppRouter', 'Anonymous', 'Page'],
    divergenceNotes: [
      'Next client wrappers can resolve as Anonymous when function/object names are stripped.',
    ],
  });
};

const expectUnsupportedNextServerOnlyObservation = (
  context: NextRuntimeContext,
) => {
  expect(context.probeResult).toEqual({
    status: 'empty',
    reason: 'root-empty',
    renderers: [context.rendererRef],
  });

  expect(context.traversalSnapshot).toEqual({
    nodes: [],
    rootIds: [],
  });

  expect(context.observation).toEqual({
    status: 'unsupported',
    reason: 'next-client-boundary-missing',
    displayNames: [],
    divergenceNotes: [
      'Next server-only shell path returns no client fiber roots and must fail soft to empty tree.',
    ],
  });
};

describe('nextRuntimeProbe', () => {
  test('should classify Next client runtime as supported when named component fibers are readable', () => {
    return given(contextCreated)
      .when(hookConfiguredForNamedNextClientTree)
      .when(probeExecuted)
      .when(traversalCaptured)
      .when(nextRuntimeAssessed)
      .then(expectSupportedNextClientObservation);
  });

  test('should classify Next client runtime as conditionally supported when wrapper names collapse to Anonymous', () => {
    return given(contextCreated)
      .when(hookConfiguredForAnonymousNextClientWrappers)
      .when(probeExecuted)
      .when(traversalCaptured)
      .when(nextRuntimeAssessed)
      .then(expectConditionallySupportedNextClientObservation);
  });

  test('should classify Next server-only shell path as unsupported when no client roots are available', () => {
    return given(contextCreated)
      .when(hookConfiguredForNextServerOnlyShell)
      .when(probeExecuted)
      .when(traversalCaptured)
      .when(nextRuntimeAssessed)
      .then(expectUnsupportedNextServerOnlyObservation);
  });
});
