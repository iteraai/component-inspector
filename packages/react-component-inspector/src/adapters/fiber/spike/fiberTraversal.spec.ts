import { given } from '#test/givenWhenThen';
import { resolveFiberDisplayName } from './displayName';
import {
  traverseFiberRootsFromProbe,
  type FiberTraversalSnapshot,
} from './fiberTraversal';
import type { DevtoolsProbeResult, FiberRootRef } from './types';

const FUNCTION_COMPONENT_TAG = 0;
const CLASS_COMPONENT_TAG = 1;
const HOST_ROOT_TAG = 3;
const HOST_COMPONENT_TAG = 5;
const FORWARD_REF_COMPONENT_TAG = 11;
const MEMO_COMPONENT_TAG = 14;

type MockFiber = {
  tag: number;
  type?: unknown;
  child?: MockFiber;
  sibling?: MockFiber;
  return?: MockFiber;
};

type FiberTraversalContext = {
  probeResult: DevtoolsProbeResult;
  traversal?: FiberTraversalSnapshot;
  repeatedTraversal?: FiberTraversalSnapshot;
  displayNamesByCase: Record<string, string>;
};

const connectFiberChildren = (parent: MockFiber, children: MockFiber[]) => {
  if (children.length === 0) {
    return;
  }

  parent.child = children[0];

  children.forEach((child, index) => {
    child.return = parent;
    child.sibling = children[index + 1];
  });
};

const createProbeResult = (roots: FiberRootRef[]): DevtoolsProbeResult => {
  return {
    status: 'ok',
    renderers: [
      {
        rendererId: 1,
        renderer: {
          name: 'vite-dev-renderer',
        },
      },
    ],
    roots,
  };
};

const contextCreated = (): FiberTraversalContext => {
  return {
    probeResult: createProbeResult([]),
    displayNamesByCase: {},
  };
};

const viteLikeProbeResultConfigured = (
  context: FiberTraversalContext,
): FiberTraversalContext => {
  const rootFiber: MockFiber = {
    tag: HOST_ROOT_TAG,
  };

  const appShellFiber: MockFiber = {
    tag: FUNCTION_COMPONENT_TAG,
    type: function AppShell() {
      return null;
    },
  };

  const hostContainerFiber: MockFiber = {
    tag: HOST_COMPONENT_TAG,
    type: 'section',
  };

  const forwardRefFiber: MockFiber = {
    tag: FORWARD_REF_COMPONENT_TAG,
    type: {
      $$typeof: Symbol.for('react.forward_ref'),
      render: function ToolbarButton() {
        return null;
      },
    },
  };

  const memoFiber: MockFiber = {
    tag: MEMO_COMPONENT_TAG,
    type: {
      $$typeof: Symbol.for('react.memo'),
      type: function MemoPanel() {
        return null;
      },
    },
  };

  const settingsPanelFiber: MockFiber = {
    tag: CLASS_COMPONENT_TAG,
    type: class SettingsPanel {},
  };

  connectFiberChildren(rootFiber, [appShellFiber, settingsPanelFiber]);
  connectFiberChildren(appShellFiber, [hostContainerFiber]);
  connectFiberChildren(hostContainerFiber, [forwardRefFiber, memoFiber]);

  context.probeResult = createProbeResult([
    {
      rendererId: 1,
      root: {
        current: rootFiber,
      },
    },
  ]);

  return context;
};

const probeResultConfiguredWithTraversalCycle = (
  context: FiberTraversalContext,
): FiberTraversalContext => {
  const rootFiber: MockFiber = {
    tag: HOST_ROOT_TAG,
  };

  const primaryFiber: MockFiber = {
    tag: FUNCTION_COMPONENT_TAG,
    type: function PrimaryNode() {
      return null;
    },
  };

  const secondaryFiber: MockFiber = {
    tag: FUNCTION_COMPONENT_TAG,
    type: function SecondaryNode() {
      return null;
    },
  };

  connectFiberChildren(rootFiber, [primaryFiber]);
  connectFiberChildren(primaryFiber, [secondaryFiber]);

  secondaryFiber.sibling = primaryFiber;

  context.probeResult = createProbeResult([
    {
      rendererId: 1,
      root: {
        current: rootFiber,
      },
    },
  ]);

  return context;
};

const displayNameCasesConfigured = (
  context: FiberTraversalContext,
): FiberTraversalContext => {
  context.displayNamesByCase = {
    functionComponent: resolveFiberDisplayName({
      tag: FUNCTION_COMPONENT_TAG,
      type: function FunctionCard() {
        return null;
      },
    }),
    classComponent: resolveFiberDisplayName({
      tag: CLASS_COMPONENT_TAG,
      type: class LegacyPanel {},
    }),
    forwardRefComponent: resolveFiberDisplayName({
      tag: FORWARD_REF_COMPONENT_TAG,
      type: {
        $$typeof: Symbol.for('react.forward_ref'),
        render: function ForwardToolbarButton() {
          return null;
        },
      },
    }),
    memoComponent: resolveFiberDisplayName({
      tag: MEMO_COMPONENT_TAG,
      type: {
        $$typeof: Symbol.for('react.memo'),
        type: function MemoPanel() {
          return null;
        },
      },
    }),
    explicitDisplayName: resolveFiberDisplayName({
      tag: FUNCTION_COMPONENT_TAG,
      type: {
        displayName: 'ExplicitCard',
      },
    }),
  };

  return context;
};

const traversalExecuted = (
  context: FiberTraversalContext,
): FiberTraversalContext => {
  context.traversal = traverseFiberRootsFromProbe(context.probeResult);

  return context;
};

const traversalExecutedAgain = (
  context: FiberTraversalContext,
): FiberTraversalContext => {
  context.repeatedTraversal = traverseFiberRootsFromProbe(context.probeResult);

  return context;
};

const expectDeterministicViteTraversalEvidence = (
  context: FiberTraversalContext,
) => {
  expect(context.traversal).toEqual(context.repeatedTraversal);

  const nodes = context.traversal?.nodes ?? [];
  const displayNames = nodes.map((node) => node.displayName);

  expect(displayNames).toEqual([
    'AppShell',
    'ForwardRef(ToolbarButton)',
    'Memo(MemoPanel)',
    'SettingsPanel',
  ]);
  expect(nodes.length).toBeGreaterThan(1);

  const appShellNode = nodes.find((node) => node.displayName === 'AppShell');
  const forwardRefNode = nodes.find(
    (node) => node.displayName === 'ForwardRef(ToolbarButton)',
  );
  const memoNode = nodes.find((node) => node.displayName === 'Memo(MemoPanel)');
  const settingsNode = nodes.find(
    (node) => node.displayName === 'SettingsPanel',
  );

  expect(appShellNode).toBeDefined();
  expect(forwardRefNode).toBeDefined();
  expect(memoNode).toBeDefined();
  expect(settingsNode).toBeDefined();

  expect(forwardRefNode?.parentId).toBe(appShellNode?.id);
  expect(memoNode?.parentId).toBe(appShellNode?.id);
  expect(settingsNode?.parentId).toBeNull();
  expect(appShellNode?.childrenIds).toEqual([forwardRefNode?.id, memoNode?.id]);
  expect(context.traversal?.rootIds).toEqual([
    appShellNode?.id,
    settingsNode?.id,
  ]);
};

const expectCycleTraversalToRemainBounded = (
  context: FiberTraversalContext,
) => {
  const nodes = context.traversal?.nodes ?? [];

  expect(nodes.map((node) => node.displayName)).toEqual([
    'PrimaryNode',
    'SecondaryNode',
  ]);
  expect(nodes).toHaveLength(2);
  expect(context.traversal?.rootIds).toEqual([nodes[0]?.id]);
};

const expectDisplayNameFallbacks = (context: FiberTraversalContext) => {
  expect(context.displayNamesByCase).toEqual({
    functionComponent: 'FunctionCard',
    classComponent: 'LegacyPanel',
    forwardRefComponent: 'ForwardRef(ForwardToolbarButton)',
    memoComponent: 'Memo(MemoPanel)',
    explicitDisplayName: 'ExplicitCard',
  });

  Object.values(context.displayNamesByCase).forEach((displayName) => {
    expect(displayName).not.toEqual('');
  });
};

describe('fiberTraversal', () => {
  test('should traverse discovered roots in deterministic component order for vite-like runtime trees', () => {
    return given(contextCreated)
      .when(viteLikeProbeResultConfigured)
      .when(traversalExecuted)
      .when(traversalExecutedAgain)
      .then(expectDeterministicViteTraversalEvidence);
  });

  test('should protect traversal from cyclic fiber links', () => {
    return given(contextCreated)
      .when(probeResultConfiguredWithTraversalCycle)
      .when(traversalExecuted)
      .then(expectCycleTraversalToRemainBounded);
  });

  test('should resolve non-empty display names for common component type forms', () => {
    return given(contextCreated)
      .when(displayNameCasesConfigured)
      .then(expectDisplayNameFallbacks);
  });
});
