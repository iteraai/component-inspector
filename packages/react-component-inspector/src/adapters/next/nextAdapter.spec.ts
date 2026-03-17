import { given } from '#test/givenWhenThen';
import type { TreeNode } from '@iteraai/inspector-protocol';
import { createNextReactInspectorAdapter } from './nextAdapter';

type NextAdapterContext = {
  adapter: ReturnType<typeof createNextReactInspectorAdapter>;
  snapshotNodeIds?: string[];
  snapshotNodes?: TreeNode[];
  snapshotRootIds?: string[];
  selectedNodeProps?: unknown;
  selectedDomElement?: Element | null;
};

const contextCreated = (): NextAdapterContext => {
  document.body.innerHTML = '';

  return {
    adapter: createNextReactInspectorAdapter({
      doc: document,
    }),
  };
};

const nextPagesDomPreparedWithInspectorIds = (
  context: NextAdapterContext,
): NextAdapterContext => {
  document.body.innerHTML = `
    <div id="__next">
      <section data-inspector-node-id="root-app">
        <header data-inspector-node-id="header-card">Header</header>
        <main data-inspector-node-id="content-panel">
          <button data-inspector-node-id="cta-button">Publish iteration</button>
        </main>
      </section>
    </div>
  `;

  return context;
};

const nextPagesDomPreparedWithoutInspectorIds = (
  context: NextAdapterContext,
): NextAdapterContext => {
  document.body.innerHTML = `
    <div id="__next">
      <main>
        <h1>Next pages root</h1>
      </main>
    </div>
  `;

  return context;
};

const nextAppRouterDomPreparedWithoutInspectorIds = (
  context: NextAdapterContext,
): NextAdapterContext => {
  document.body.innerHTML = `
    <div data-nextjs-scroll-focus-boundary>
      <main>
        <h1>Next app router boundary</h1>
      </main>
    </div>
  `;

  return context;
};

const serverOnlyDomPrepared = (
  context: NextAdapterContext,
): NextAdapterContext => {
  document.body.innerHTML = `
    <main>
      <h1>Server region shell</h1>
    </main>
  `;

  return context;
};

const nextPagesDomPreparedWithSourceMetadata = (
  context: NextAdapterContext,
): NextAdapterContext => {
  document.body.innerHTML = `
    <div id="__next">
      <section
        data-inspector-node-id="root-app"
        data-inspector-source="src/app/page.tsx:12:5"
      >
        <button
          data-inspector-node-id="cta-button"
          data-inspector-source='{"file":"src/app/page.tsx","line":"invalid"}'
        >
          Publish iteration
        </button>
      </section>
    </div>
  `;

  return context;
};

const snapshotLoaded = (context: NextAdapterContext): NextAdapterContext => {
  const snapshot = context.adapter.getTreeSnapshot();

  context.snapshotNodeIds = snapshot.nodes.map((node) => node.id);
  context.snapshotNodes = snapshot.nodes;
  context.snapshotRootIds = snapshot.rootIds;

  return context;
};

const propsRequestedForCtaButton = (
  context: NextAdapterContext,
): NextAdapterContext => {
  context.selectedNodeProps = context.adapter.getNodeProps('cta-button');
  context.selectedDomElement = context.adapter.getDomElement('cta-button');

  return context;
};

const propsRequestedForPagesRoot = (
  context: NextAdapterContext,
): NextAdapterContext => {
  context.selectedNodeProps = context.adapter.getNodeProps('next-pages-root');
  context.selectedDomElement = context.adapter.getDomElement('next-pages-root');

  return context;
};

const propsRequestedForAppRouterRoot = (
  context: NextAdapterContext,
): NextAdapterContext => {
  context.selectedNodeProps = context.adapter.getNodeProps(
    'next-app-router-root',
  );
  context.selectedDomElement = context.adapter.getDomElement(
    'next-app-router-root',
  );

  return context;
};

const propsRequestedForUnknownNode = (
  context: NextAdapterContext,
): NextAdapterContext => {
  context.selectedNodeProps = context.adapter.getNodeProps('unknown-node');
  context.selectedDomElement = context.adapter.getDomElement('unknown-node');

  return context;
};

const expectInspectorTreeAndPropsResolved = (context: NextAdapterContext) => {
  expect(context.snapshotRootIds).toEqual(['root-app']);
  expect(context.snapshotNodeIds).toEqual([
    'root-app',
    'header-card',
    'content-panel',
    'cta-button',
  ]);
  expect(context.selectedNodeProps).toEqual(
    expect.objectContaining({
      nodeId: 'cta-button',
      tagName: 'button',
      textPreview: 'Publish iteration',
    }),
  );
  expect(context.selectedDomElement).not.toBeNull();
  expect(context.selectedDomElement?.tagName.toLowerCase()).toBe('button');

  return context;
};

const expectPagesRootFallbackResolved = (context: NextAdapterContext) => {
  expect(context.snapshotRootIds).toEqual(['next-pages-root']);
  expect(context.snapshotNodeIds).toEqual(['next-pages-root']);
  expect(context.selectedNodeProps).toEqual(
    expect.objectContaining({
      nodeId: 'next-pages-root',
      tagName: 'div',
      elementId: '__next',
      routerMode: 'pages',
    }),
  );
  expect(context.selectedDomElement).not.toBeNull();
  expect(context.selectedDomElement?.id).toBe('__next');

  return context;
};

const expectAppRouterFallbackResolved = (context: NextAdapterContext) => {
  expect(context.snapshotRootIds).toEqual(['next-app-router-root']);
  expect(context.snapshotNodeIds).toEqual(['next-app-router-root']);
  expect(context.selectedNodeProps).toEqual(
    expect.objectContaining({
      nodeId: 'next-app-router-root',
      tagName: 'div',
      routerMode: 'app',
    }),
  );
  expect(context.selectedDomElement).not.toBeNull();
  expect(context.selectedDomElement?.tagName.toLowerCase()).toBe('div');

  return context;
};

const expectServerOnlyContextFailSoft = (context: NextAdapterContext) => {
  expect(context.snapshotRootIds).toEqual([]);
  expect(context.snapshotNodeIds).toEqual([]);
  expect(context.selectedNodeProps).toBeUndefined();
  expect(context.selectedDomElement).toBeNull();

  return context;
};

const expectSourceMetadataNormalizedAndInvalidDropped = (
  context: NextAdapterContext,
) => {
  const rootNode = context.snapshotNodes?.find(
    (node) => node.id === 'root-app',
  );
  const ctaNode = context.snapshotNodes?.find(
    (node) => node.id === 'cta-button',
  );

  expect(rootNode?.source).toEqual({
    file: 'src/app/page.tsx',
    line: 12,
    column: 5,
  });
  expect(ctaNode?.source).toBeUndefined();

  return context;
};

describe('nextAdapter', () => {
  afterEach(() => {
    document.body.innerHTML = '';
    vi.restoreAllMocks();
  });

  test('should resolve tree props and highlight lookup in common Next client flows', () => {
    return given(contextCreated)
      .when(nextPagesDomPreparedWithInspectorIds)
      .when(snapshotLoaded)
      .when(propsRequestedForCtaButton)
      .then(expectInspectorTreeAndPropsResolved);
  });

  test('should fall back to __next root in pages-router client flows without explicit inspector ids', () => {
    return given(contextCreated)
      .when(nextPagesDomPreparedWithoutInspectorIds)
      .when(snapshotLoaded)
      .when(propsRequestedForPagesRoot)
      .then(expectPagesRootFallbackResolved);
  });

  test('should fall back to Next app-router boundary in client flows without explicit inspector ids', () => {
    return given(contextCreated)
      .when(nextAppRouterDomPreparedWithoutInspectorIds)
      .when(snapshotLoaded)
      .when(propsRequestedForAppRouterRoot)
      .then(expectAppRouterFallbackResolved);
  });

  test('should fail soft with empty tree in unsupported server-only regions', () => {
    return given(contextCreated)
      .when(serverOnlyDomPrepared)
      .when(snapshotLoaded)
      .when(propsRequestedForUnknownNode)
      .then(expectServerOnlyContextFailSoft);
  });

  test('should normalize source metadata and safely drop malformed source values', () => {
    return given(contextCreated)
      .when(nextPagesDomPreparedWithSourceMetadata)
      .when(snapshotLoaded)
      .then(expectSourceMetadataNormalizedAndInvalidDropped);
  });
});
