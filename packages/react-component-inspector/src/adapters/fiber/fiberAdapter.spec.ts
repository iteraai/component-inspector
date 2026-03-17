import { given } from '#test/givenWhenThen';
import type { ReactTreeSnapshot } from '../base/baseAdapter';
import { createFiberReactInspectorAdapter } from './fiberAdapter';

type MockFiber = {
  tag: number;
  type?: unknown;
  memoizedProps?: unknown;
  stateNode?: unknown;
  child?: MockFiber;
  sibling?: MockFiber;
  return?: MockFiber;
};

type FiberAdapterContext = {
  adapter?: ReturnType<typeof createFiberReactInspectorAdapter>;
  firstSnapshot?: ReactTreeSnapshot;
  secondSnapshot?: ReactTreeSnapshot;
  thirdSnapshot?: ReactTreeSnapshot;
  removedNodeIdFromFirstSnapshot?: string;
  currentNodeProps?: unknown;
  staleNodeProps?: unknown;
  staleNodeDomElement?: Element | null;
  missingNodeProps?: unknown;
  missingNodeDomElement?: Element | null;
  resolvedComponentPath?: ReadonlyArray<string>;
  unresolvedComponentPath?: ReadonlyArray<string>;
};

const windowRefWithDevtoolsHook = window as Window & {
  __REACT_DEVTOOLS_GLOBAL_HOOK__?: unknown;
};

const createMockFiber = (tag: number, type?: unknown): MockFiber => {
  return {
    tag,
    type,
  };
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

const contextCreated = (): FiberAdapterContext => {
  document.body.innerHTML = '';
  delete windowRefWithDevtoolsHook.__REACT_DEVTOOLS_GLOBAL_HOOK__;

  return {};
};

const domPreparedWithoutInspectorNodeIds = (
  context: FiberAdapterContext,
): FiberAdapterContext => {
  document.body.innerHTML = `
    <section id="root">
      <header>Harness Header</header>
      <main>
        <button><span id="publish-label">Publish iteration</span></button>
      </main>
    </section>
  `;

  return context;
};

const fiberHookConfiguredWithComponentTree = (
  context: FiberAdapterContext,
): FiberAdapterContext => {
  const hostRootFiber = createMockFiber(3);
  const hostContainerFiber = createMockFiber(5, 'div');
  const appShellFiber = createMockFiber(0, function AppShell() {});
  const forwardRefFiber = createMockFiber(11, {
    $$typeof: Symbol.for('react.forward_ref'),
    render: function ToolbarButton() {},
  });
  const memoFiber = createMockFiber(14, {
    $$typeof: Symbol.for('react.memo'),
    type: function MemoPanel() {},
  });
  const publishButtonElement = document.querySelector('button');

  expect(publishButtonElement).not.toBeNull();
  assert(publishButtonElement instanceof HTMLButtonElement);

  const hostButtonFiber = createMockFiber(5, 'button');
  hostButtonFiber.stateNode = publishButtonElement;
  forwardRefFiber.memoizedProps = {
    label: 'Publish iteration',
    disabled: false,
  };

  connectFiberChildren(hostRootFiber, [hostContainerFiber]);
  connectFiberChildren(hostContainerFiber, [appShellFiber]);
  connectFiberChildren(appShellFiber, [forwardRefFiber, memoFiber]);
  connectFiberChildren(forwardRefFiber, [hostButtonFiber]);
  Object.defineProperty(publishButtonElement, '__reactFiber$test', {
    configurable: true,
    value: hostButtonFiber,
  });

  windowRefWithDevtoolsHook.__REACT_DEVTOOLS_GLOBAL_HOOK__ = {
    renderers: new Map([[1, { rendererName: 'mock-renderer' }]]),
    getFiberRoots: (rendererId: number) => {
      if (rendererId !== 1) {
        return new Set();
      }

      return new Set([
        {
          current: hostRootFiber,
        },
      ]);
    },
  };

  return context;
};

const adapterCreated = (context: FiberAdapterContext): FiberAdapterContext => {
  context.adapter = createFiberReactInspectorAdapter();

  return context;
};

const firstSnapshotLoaded = (
  context: FiberAdapterContext,
): FiberAdapterContext => {
  context.firstSnapshot = context.adapter?.getTreeSnapshot();

  return context;
};

const secondSnapshotLoaded = (
  context: FiberAdapterContext,
): FiberAdapterContext => {
  context.secondSnapshot = context.adapter?.getTreeSnapshot();

  return context;
};

const fiberHookConfiguredWithChangedComponentTree = (
  context: FiberAdapterContext,
): FiberAdapterContext => {
  const hostRootFiber = createMockFiber(3);
  const hostContainerFiber = createMockFiber(5, 'div');
  const appShellFiber = createMockFiber(0, function AppShell() {});

  connectFiberChildren(hostRootFiber, [hostContainerFiber]);
  connectFiberChildren(hostContainerFiber, [appShellFiber]);

  windowRefWithDevtoolsHook.__REACT_DEVTOOLS_GLOBAL_HOOK__ = {
    renderers: new Map([[1, { rendererName: 'mock-renderer' }]]),
    getFiberRoots: (rendererId: number) => {
      if (rendererId !== 1) {
        return new Set();
      }

      return new Set([
        {
          current: hostRootFiber,
        },
      ]);
    },
  };

  return context;
};

const removedNodeIdCapturedFromFirstSnapshot = (
  context: FiberAdapterContext,
): FiberAdapterContext => {
  const removedNodeId = context.firstSnapshot?.nodes.find(
    (node) => node.displayName === 'ForwardRef(ToolbarButton)',
  )?.id;

  context.removedNodeIdFromFirstSnapshot = removedNodeId;

  return context;
};

const thirdSnapshotLoaded = (
  context: FiberAdapterContext,
): FiberAdapterContext => {
  context.thirdSnapshot = context.adapter?.getTreeSnapshot();

  return context;
};

const staleAndMissingNodeOperationsExecuted = (
  context: FiberAdapterContext,
): FiberAdapterContext => {
  const adapter = context.adapter as ReturnType<
    typeof createFiberReactInspectorAdapter
  >;

  context.staleNodeProps = adapter.getNodeProps(
    context.removedNodeIdFromFirstSnapshot as string,
  );
  context.staleNodeDomElement = adapter.getDomElement(
    context.removedNodeIdFromFirstSnapshot as string,
  );
  context.missingNodeProps = adapter.getNodeProps('missing-node-id');
  context.missingNodeDomElement = adapter.getDomElement('missing-node-id');

  return context;
};

const currentNodePropsLoadedFromForwardRefFiber = (
  context: FiberAdapterContext,
): FiberAdapterContext => {
  const adapter = context.adapter as ReturnType<
    typeof createFiberReactInspectorAdapter
  >;
  const forwardRefNodeId = context.firstSnapshot?.nodes.find(
    (node) => node.displayName === 'ForwardRef(ToolbarButton)',
  )?.id;

  context.currentNodeProps =
    forwardRefNodeId === undefined
      ? undefined
      : adapter.getNodeProps(forwardRefNodeId);

  return context;
};

const expectFirstSnapshotToContainDeterministicFullTree = (
  context: FiberAdapterContext,
) => {
  const snapshot = context.firstSnapshot as ReactTreeSnapshot;

  expect(snapshot.nodes).toHaveLength(3);
  expect(snapshot.rootIds).toHaveLength(1);
  expect(snapshot.nodes.map((node) => node.displayName)).toEqual([
    'AppShell',
    'ForwardRef(ToolbarButton)',
    'Memo(MemoPanel)',
  ]);
  expect(
    snapshot.nodes.every((node) => node.tags?.includes('fiber') === true),
  ).toBe(true);

  const rootNode = snapshot.nodes.find((node) => node.parentId === null);

  expect(rootNode?.childrenIds).toHaveLength(2);

  return context;
};

const expectSecondSnapshotToRemainStable = (context: FiberAdapterContext) => {
  expect(context.secondSnapshot).toEqual(context.firstSnapshot);

  return context;
};

const expectRemovedAndMissingNodeIdsToFailSoft = (
  context: FiberAdapterContext,
) => {
  expect(context.thirdSnapshot?.nodes.map((node) => node.displayName)).toEqual([
    'AppShell',
  ]);
  expect(context.removedNodeIdFromFirstSnapshot).toBeDefined();
  expect(context.staleNodeProps).toBeUndefined();
  expect(context.staleNodeDomElement).toBeNull();
  expect(context.missingNodeProps).toBeUndefined();
  expect(context.missingNodeDomElement).toBeNull();
};

const expectCurrentSnapshotNodePropsToUseFiberMemoizedProps = (
  context: FiberAdapterContext,
) => {
  expect(context.currentNodeProps).toEqual({
    label: 'Publish iteration',
    disabled: false,
  });
};

const expectSnapshotToFailSoftWhenHookMissing = (
  context: FiberAdapterContext,
) => {
  expect(context.firstSnapshot).toEqual({
    nodes: [],
    rootIds: [],
  });

  return context;
};

const componentPathResolvedFromNestedDomElement = (
  context: FiberAdapterContext,
): FiberAdapterContext => {
  const adapter = context.adapter as ReturnType<
    typeof createFiberReactInspectorAdapter
  >;
  const nestedLabelElement = document.getElementById('publish-label');

  expect(nestedLabelElement).not.toBeNull();
  assert(nestedLabelElement instanceof HTMLElement);

  context.resolvedComponentPath =
    adapter.getReactComponentPathForElement?.(nestedLabelElement);
  context.unresolvedComponentPath = adapter.getReactComponentPathForElement?.(
    document.createElement('div'),
  );

  return context;
};

const expectNestedDomElementComponentPathToResolve = (
  context: FiberAdapterContext,
) => {
  expect(context.resolvedComponentPath).toEqual([
    'AppShell',
    'ForwardRef(ToolbarButton)',
  ]);
  expect(context.unresolvedComponentPath).toBeUndefined();
};

describe('fiberAdapter', () => {
  afterEach(() => {
    document.body.innerHTML = '';
    delete windowRefWithDevtoolsHook.__REACT_DEVTOOLS_GLOBAL_HOOK__;
  });

  test('should build a deterministic full-tree snapshot without requiring inspector node-id tags', () => {
    return given(contextCreated)
      .when(domPreparedWithoutInspectorNodeIds)
      .when(fiberHookConfiguredWithComponentTree)
      .when(adapterCreated)
      .when(firstSnapshotLoaded)
      .when(secondSnapshotLoaded)
      .then(expectFirstSnapshotToContainDeterministicFullTree)
      .then(expectSecondSnapshotToRemainStable);
  });

  test('should fail soft for stale and missing node ids after snapshot refresh', () => {
    return given(contextCreated)
      .when(domPreparedWithoutInspectorNodeIds)
      .when(fiberHookConfiguredWithComponentTree)
      .when(adapterCreated)
      .when(firstSnapshotLoaded)
      .when(removedNodeIdCapturedFromFirstSnapshot)
      .when(fiberHookConfiguredWithChangedComponentTree)
      .when(thirdSnapshotLoaded)
      .when(staleAndMissingNodeOperationsExecuted)
      .then(expectRemovedAndMissingNodeIdsToFailSoft);
  });

  test('should return memoized fiber props for nodes in the current snapshot', () => {
    return given(contextCreated)
      .when(domPreparedWithoutInspectorNodeIds)
      .when(fiberHookConfiguredWithComponentTree)
      .when(adapterCreated)
      .when(firstSnapshotLoaded)
      .when(currentNodePropsLoadedFromForwardRefFiber)
      .then(expectCurrentSnapshotNodePropsToUseFiberMemoizedProps);
  });

  test('should resolve React component ancestry for nested DOM elements in the current fiber tree', () => {
    return given(contextCreated)
      .when(domPreparedWithoutInspectorNodeIds)
      .when(fiberHookConfiguredWithComponentTree)
      .when(adapterCreated)
      .when(componentPathResolvedFromNestedDomElement)
      .then(expectNestedDomElementComponentPathToResolve);
  });

  test('should fail soft to an empty snapshot when the devtools hook is unavailable', () => {
    return given(contextCreated)
      .when(domPreparedWithoutInspectorNodeIds)
      .when(adapterCreated)
      .when(firstSnapshotLoaded)
      .then(expectSnapshotToFailSoftWhenHookMissing);
  });
});
