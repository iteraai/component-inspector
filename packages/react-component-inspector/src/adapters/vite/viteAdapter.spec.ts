import { given } from '#test/givenWhenThen';
import type { TreeNode } from '@iteraai/inspector-protocol';
import { createViteReactInspectorAdapter } from './viteAdapter';

type ViteAdapterContext = {
  adapter: ReturnType<typeof createViteReactInspectorAdapter>;
  firstSnapshotNodeIds?: string[];
  firstSnapshotNodes?: TreeNode[];
  secondSnapshotNodeIds?: string[];
  selectedNodeProps?: unknown;
  selectedDomElement?: Element | null;
  fallbackNodeId?: string;
  querySelectorAllSpy?: ReturnType<typeof vi.spyOn>;
};

const contextCreated = (): ViteAdapterContext => {
  document.body.innerHTML = '';

  return {
    adapter: createViteReactInspectorAdapter({
      doc: document,
    }),
  };
};

const inspectorDomPrepared = (
  context: ViteAdapterContext,
): ViteAdapterContext => {
  const root = document.createElement('section');
  root.dataset.inspectorNodeId = 'app-root';
  root.dataset.inspectorDisplayName = 'AppRoot';

  const content = document.createElement('article');
  content.dataset.inspectorNodeId = 'content-panel';
  content.className = 'content highlighted';
  content.setAttribute('role', 'region');
  content.setAttribute('aria-label', 'Inspector content');
  content.textContent = 'Inspector Content Panel';

  root.append(content);
  document.body.append(root);

  return context;
};

const fallbackDomPrepared = (
  context: ViteAdapterContext,
): ViteAdapterContext => {
  document.body.innerHTML = '<main><h1>Fallback Tree</h1></main>';

  return context;
};

const fallbackDomPreparedWithBlankInspectorIds = (
  context: ViteAdapterContext,
): ViteAdapterContext => {
  document.body.innerHTML = `
    <section id="root">
      <article data-inspector-node-id="">
        <button data-inspector-node-id="">Broken instrumentation</button>
      </article>
    </section>
  `;

  return context;
};

const inspectorDomPreparedWithSourceMetadata = (
  context: ViteAdapterContext,
): ViteAdapterContext => {
  document.body.innerHTML = `
    <section
      data-inspector-node-id="app-root"
      data-inspector-source-file="src/App.tsx"
      data-inspector-source-line="8"
      data-inspector-source-column="2"
    >
      <article
        data-inspector-node-id="content-panel"
        data-inspector-source='{"file":"   ","line":"18"}'
      >
        Inspector Content Panel
      </article>
    </section>
  `;

  return context;
};

const firstSnapshotLoaded = (
  context: ViteAdapterContext,
): ViteAdapterContext => {
  const firstSnapshot = context.adapter.getTreeSnapshot();

  context.firstSnapshotNodeIds = firstSnapshot.nodes.map((node) => node.id);
  context.firstSnapshotNodes = firstSnapshot.nodes;
  context.fallbackNodeId = firstSnapshot.rootIds[0];

  return context;
};

const viteReloadAppliedWithSameInspectorIds = (
  context: ViteAdapterContext,
): ViteAdapterContext => {
  document.body.innerHTML = '';

  const root = document.createElement('section');
  root.dataset.inspectorNodeId = 'app-root';
  root.dataset.inspectorDisplayName = 'AppRoot';

  const content = document.createElement('article');
  content.dataset.inspectorNodeId = 'content-panel';
  content.className = 'content highlighted';
  content.setAttribute('role', 'region');
  content.setAttribute('aria-label', 'Inspector content');
  content.textContent = 'Inspector Content Panel Reloaded';

  root.append(content);
  document.body.append(root);

  return context;
};

const viteReloadAppliedWithoutInspectorAttributes = (
  context: ViteAdapterContext,
): ViteAdapterContext => {
  document.body.innerHTML = '<main><h1>Fallback Tree Reloaded</h1></main>';

  return context;
};

const secondSnapshotLoaded = (
  context: ViteAdapterContext,
): ViteAdapterContext => {
  const secondSnapshot = context.adapter.getTreeSnapshot();

  context.secondSnapshotNodeIds = secondSnapshot.nodes.map((node) => node.id);

  return context;
};

const propsRequestedForContentPanel = (
  context: ViteAdapterContext,
): ViteAdapterContext => {
  context.selectedNodeProps = context.adapter.getNodeProps('content-panel');

  return context;
};

const domElementRequestedForContentPanel = (
  context: ViteAdapterContext,
): ViteAdapterContext => {
  context.selectedDomElement = context.adapter.getDomElement('content-panel');

  return context;
};

const propsRequestedForFallbackRoot = (
  context: ViteAdapterContext,
): ViteAdapterContext => {
  if (context.fallbackNodeId === undefined) {
    return context;
  }

  context.selectedNodeProps = context.adapter.getNodeProps(
    context.fallbackNodeId,
  );
  context.selectedDomElement = context.adapter.getDomElement(
    context.fallbackNodeId,
  );

  return context;
};

const querySelectorAllCallsTracked = (
  context: ViteAdapterContext,
): ViteAdapterContext => {
  context.querySelectorAllSpy = vi.spyOn(document, 'querySelectorAll');

  return context;
};

const expectInspectorTreeAndPropsResolved = (context: ViteAdapterContext) => {
  expect(context.firstSnapshotNodeIds).toEqual(['app-root', 'content-panel']);
  expect(context.selectedNodeProps).toEqual({
    nodeId: 'content-panel',
    tagName: 'article',
    classList: ['content', 'highlighted'],
    role: 'region',
    ariaLabel: 'Inspector content',
    textPreview: 'Inspector Content Panel',
  });
  expect(context.selectedDomElement).not.toBeNull();
  expect(context.selectedDomElement?.tagName.toLowerCase()).toBe('article');

  return context;
};

const expectNodeIdsStableAcrossInspectorReload = (
  context: ViteAdapterContext,
) => {
  expect(context.firstSnapshotNodeIds).toEqual(['app-root', 'content-panel']);
  expect(context.secondSnapshotNodeIds).toEqual(['app-root', 'content-panel']);

  return context;
};

const expectFallbackNodeIdStableAcrossReload = (
  context: ViteAdapterContext,
) => {
  expect(context.firstSnapshotNodeIds).toHaveLength(1);
  expect(context.secondSnapshotNodeIds).toHaveLength(1);
  expect(context.firstSnapshotNodeIds?.[0]).toBe(
    context.secondSnapshotNodeIds?.[0],
  );

  return context;
};

const expectFallbackPropsAndHighlightLookupResolved = (
  context: ViteAdapterContext,
) => {
  expect(context.fallbackNodeId).toBeDefined();
  expect(context.selectedNodeProps).toEqual(
    expect.objectContaining({
      nodeId: context.fallbackNodeId,
      tagName: 'body',
    }),
  );
  expect(context.selectedDomElement).not.toBeNull();
  expect(context.selectedDomElement?.tagName.toLowerCase()).toBe('body');

  return context;
};

const expectBlankInspectorIdsIgnoredForFallbackDiscovery = (
  context: ViteAdapterContext,
) => {
  expect(context.fallbackNodeId).toBe('itera-app-root');
  expect(context.firstSnapshotNodeIds).toEqual(['itera-app-root']);
  expect(context.selectedNodeProps).toEqual(
    expect.objectContaining({
      nodeId: 'itera-app-root',
      tagName: 'section',
      elementId: 'root',
    }),
  );
  expect(context.selectedDomElement).not.toBeNull();
  expect(context.selectedDomElement?.id).toBe('root');

  return context;
};

const expectSingleTreeBuildPerLookupRequest = (context: ViteAdapterContext) => {
  expect(context.querySelectorAllSpy).toHaveBeenCalledTimes(2);
  expect(context.selectedNodeProps).toEqual(
    expect.objectContaining({
      nodeId: 'content-panel',
      tagName: 'article',
    }),
  );
  expect(context.selectedDomElement).not.toBeNull();
  expect(context.selectedDomElement?.tagName.toLowerCase()).toBe('article');

  return context;
};

const expectSourceMetadataNormalizedAndInvalidDropped = (
  context: ViteAdapterContext,
) => {
  expect(context.firstSnapshotNodeIds).toEqual(['app-root', 'content-panel']);

  const appRootNode = context.firstSnapshotNodes?.find(
    (node) => node.id === 'app-root',
  );
  const contentPanelNode = context.firstSnapshotNodes?.find(
    (node) => node.id === 'content-panel',
  );

  expect(appRootNode?.source).toEqual({
    file: 'src/App.tsx',
    line: 8,
    column: 2,
  });
  expect(contentPanelNode?.source).toBeUndefined();

  return context;
};

describe('viteAdapter', () => {
  afterEach(() => {
    document.body.innerHTML = '';
    vi.restoreAllMocks();
  });

  test('should resolve deterministic tree props and highlight lookups for inspector-tagged nodes', () => {
    return given(contextCreated)
      .when(inspectorDomPrepared)
      .when(firstSnapshotLoaded)
      .when(propsRequestedForContentPanel)
      .when(domElementRequestedForContentPanel)
      .then(expectInspectorTreeAndPropsResolved);
  });

  test('should keep node identity stable across Vite-style reloads when inspector ids are unchanged', () => {
    return given(contextCreated)
      .when(inspectorDomPrepared)
      .when(firstSnapshotLoaded)
      .when(viteReloadAppliedWithSameInspectorIds)
      .when(secondSnapshotLoaded)
      .then(expectNodeIdsStableAcrossInspectorReload);
  });

  test('should keep generated fallback node identity stable across Vite-style reloads within a session', () => {
    return given(contextCreated)
      .when(fallbackDomPrepared)
      .when(firstSnapshotLoaded)
      .when(viteReloadAppliedWithoutInspectorAttributes)
      .when(secondSnapshotLoaded)
      .when(propsRequestedForFallbackRoot)
      .then(expectFallbackNodeIdStableAcrossReload)
      .then(expectFallbackPropsAndHighlightLookupResolved);
  });

  test('should ignore blank inspector node ids and keep fallback rooted at document root', () => {
    return given(contextCreated)
      .when(fallbackDomPreparedWithBlankInspectorIds)
      .when(firstSnapshotLoaded)
      .when(propsRequestedForFallbackRoot)
      .then(expectBlankInspectorIdsIgnoredForFallbackDiscovery);
  });

  test('should avoid rebuilding tree model inside props and highlight lookup callbacks', () => {
    return given(contextCreated)
      .when(inspectorDomPrepared)
      .when(querySelectorAllCallsTracked)
      .when(propsRequestedForContentPanel)
      .when(domElementRequestedForContentPanel)
      .then(expectSingleTreeBuildPerLookupRequest);
  });

  test('should normalize source metadata and safely drop malformed source values', () => {
    return given(contextCreated)
      .when(inspectorDomPreparedWithSourceMetadata)
      .when(firstSnapshotLoaded)
      .then(expectSourceMetadataNormalizedAndInvalidDropped);
  });
});
