import { given } from '#test/givenWhenThen';
import type { TreeNode } from '@iteraai/inspector-protocol';
import { createReactInspectorAdapter } from '../base/createReactInspectorAdapter';
import { createCraReactInspectorAdapter } from './craAdapter';

type CraAdapterContext = {
  adapter: ReturnType<typeof createCraReactInspectorAdapter>;
  snapshotNodeIds?: string[];
  snapshotNodes?: TreeNode[];
  snapshotRootIds?: string[];
  selectedNodeProps?: unknown;
  selectedDomElement?: Element | null;
};

const contextCreated = (): CraAdapterContext => {
  document.body.innerHTML = '';

  return {
    adapter: createCraReactInspectorAdapter({
      doc: document,
    }),
  };
};

const craDomPreparedWithInspectorIds = (
  context: CraAdapterContext,
): CraAdapterContext => {
  document.body.innerHTML = `
    <div id="root">
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

const craDomPreparedWithExplicitRootInspectorId = (
  context: CraAdapterContext,
): CraAdapterContext => {
  document.body.innerHTML = `
    <div id="root" data-inspector-node-id="explicit-root">
      <main>Explicit root node</main>
    </div>
  `;

  return context;
};

const craDomPreparedWithoutInspectorIds = (
  context: CraAdapterContext,
): CraAdapterContext => {
  document.body.innerHTML = `
    <div id="root">
      <main>
        <h1>CRA Root</h1>
      </main>
    </div>
  `;

  return context;
};

const legacyReactRootDomPreparedWithoutInspectorIds = (
  context: CraAdapterContext,
): CraAdapterContext => {
  document.body.innerHTML = `
    <main data-reactroot>
      <h1>Legacy React Root</h1>
    </main>
  `;

  return context;
};

const craDomPreparedWithSourceMetadata = (
  context: CraAdapterContext,
): CraAdapterContext => {
  document.body.innerHTML = `
    <div id="root">
      <section
        data-inspector-node-id="root-app"
        data-inspector-source-file="src/index.tsx"
        data-inspector-source-line="17"
      >
        <button
          data-inspector-node-id="cta-button"
          data-inspector-source="src/index.tsx:not-a-line"
        >
          Publish iteration
        </button>
      </section>
    </div>
  `;

  return context;
};

const unsupportedDomPrepared = (
  context: CraAdapterContext,
): CraAdapterContext => {
  document.body.innerHTML = `
    <main>
      <h1>No recognized CRA hooks</h1>
    </main>
  `;

  return context;
};

const snapshotLoaded = (context: CraAdapterContext): CraAdapterContext => {
  const snapshot = context.adapter.getTreeSnapshot();

  context.snapshotNodeIds = snapshot.nodes.map((node) => node.id);
  context.snapshotNodes = snapshot.nodes;
  context.snapshotRootIds = snapshot.rootIds;

  return context;
};

const propsRequestedForCtaButton = (
  context: CraAdapterContext,
): CraAdapterContext => {
  context.selectedNodeProps = context.adapter.getNodeProps('cta-button');
  context.selectedDomElement = context.adapter.getDomElement('cta-button');

  return context;
};

const propsRequestedForExplicitRoot = (
  context: CraAdapterContext,
): CraAdapterContext => {
  context.selectedNodeProps = context.adapter.getNodeProps('explicit-root');
  context.selectedDomElement = context.adapter.getDomElement('explicit-root');

  return context;
};

const propsRequestedForCraRoot = (
  context: CraAdapterContext,
): CraAdapterContext => {
  context.selectedNodeProps = context.adapter.getNodeProps('cra-root');
  context.selectedDomElement = context.adapter.getDomElement('cra-root');

  return context;
};

const propsRequestedForLegacyCraRoot = (
  context: CraAdapterContext,
): CraAdapterContext => {
  context.selectedNodeProps = context.adapter.getNodeProps('cra-legacy-root');
  context.selectedDomElement = context.adapter.getDomElement('cra-legacy-root');

  return context;
};

const propsRequestedForUnknownNode = (
  context: CraAdapterContext,
): CraAdapterContext => {
  context.selectedNodeProps = context.adapter.getNodeProps('unknown-node');
  context.selectedDomElement = context.adapter.getDomElement('unknown-node');

  return context;
};

const expectInspectorTreeAndPropsResolved = (context: CraAdapterContext) => {
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

const expectCraRootFallbackResolved = (context: CraAdapterContext) => {
  expect(context.snapshotRootIds).toEqual(['cra-root']);
  expect(context.snapshotNodeIds).toEqual(['cra-root']);
  expect(context.selectedNodeProps).toEqual(
    expect.objectContaining({
      nodeId: 'cra-root',
      tagName: 'div',
      elementId: 'root',
      runtimeMode: 'cra-like',
      introspection: 'fallback-root',
      fallbackReason: 'root-container',
    }),
  );
  expect(context.selectedDomElement).not.toBeNull();
  expect(context.selectedDomElement?.id).toBe('root');

  return context;
};

const expectLegacyRootFallbackResolved = (context: CraAdapterContext) => {
  expect(context.snapshotRootIds).toEqual(['cra-legacy-root']);
  expect(context.snapshotNodeIds).toEqual(['cra-legacy-root']);
  expect(context.selectedNodeProps).toEqual(
    expect.objectContaining({
      nodeId: 'cra-legacy-root',
      tagName: 'main',
      runtimeMode: 'cra-like',
      introspection: 'fallback-root',
      fallbackReason: 'legacy-reactroot',
    }),
  );
  expect(context.selectedDomElement).not.toBeNull();
  expect(context.selectedDomElement?.tagName.toLowerCase()).toBe('main');

  return context;
};

const expectUnsupportedContextFailSoft = (context: CraAdapterContext) => {
  expect(context.snapshotRootIds).toEqual([]);
  expect(context.snapshotNodeIds).toEqual([]);
  expect(context.selectedNodeProps).toBeUndefined();
  expect(context.selectedDomElement).toBeNull();

  return context;
};

const expectExplicitRootInspectorPropsWithoutFallbackFlags = (
  context: CraAdapterContext,
) => {
  expect(context.snapshotRootIds).toEqual(['explicit-root']);
  expect(context.snapshotNodeIds).toEqual(['explicit-root']);
  expect(context.selectedNodeProps).toEqual(
    expect.objectContaining({
      nodeId: 'explicit-root',
      tagName: 'div',
      elementId: 'root',
    }),
  );
  expect(context.selectedNodeProps).not.toEqual(
    expect.objectContaining({
      runtimeMode: 'cra-like',
      introspection: 'fallback-root',
      fallbackReason: 'root-container',
    }),
  );
  expect(context.selectedDomElement).not.toBeNull();
  expect(context.selectedDomElement?.id).toBe('root');

  return context;
};

const contextCreatedWithFactoryAdapter = (): CraAdapterContext => {
  document.body.innerHTML = '';

  return {
    adapter: createReactInspectorAdapter({
      adapter: 'cra',
    }),
  };
};

const expectFactoryRoutesToCraAdapter = (context: CraAdapterContext) => {
  expect(context.snapshotRootIds).toEqual(['cra-root']);
  expect(context.snapshotNodeIds).toEqual(['cra-root']);

  return context;
};

const expectSourceMetadataNormalizedAndInvalidDropped = (
  context: CraAdapterContext,
) => {
  const rootNode = context.snapshotNodes?.find(
    (node) => node.id === 'root-app',
  );
  const ctaNode = context.snapshotNodes?.find(
    (node) => node.id === 'cta-button',
  );

  expect(rootNode?.source).toEqual({
    file: 'src/index.tsx',
    line: 17,
  });
  expect(ctaNode?.source).toBeUndefined();

  return context;
};

describe('craAdapter', () => {
  afterEach(() => {
    document.body.innerHTML = '';
    vi.restoreAllMocks();
  });

  test('should resolve tree props and highlight lookup when inspector hooks are available', () => {
    return given(contextCreated)
      .when(craDomPreparedWithInspectorIds)
      .when(snapshotLoaded)
      .when(propsRequestedForCtaButton)
      .then(expectInspectorTreeAndPropsResolved);
  });

  test('should fall back to #root when inspector hooks are unavailable', () => {
    return given(contextCreated)
      .when(craDomPreparedWithoutInspectorIds)
      .when(snapshotLoaded)
      .when(propsRequestedForCraRoot)
      .then(expectCraRootFallbackResolved);
  });

  test('should not emit fallback metadata when root has an explicit inspector node id', () => {
    return given(contextCreated)
      .when(craDomPreparedWithExplicitRootInspectorId)
      .when(snapshotLoaded)
      .when(propsRequestedForExplicitRoot)
      .then(expectExplicitRootInspectorPropsWithoutFallbackFlags);
  });

  test('should fall back to legacy data-reactroot when #root is unavailable', () => {
    return given(contextCreated)
      .when(legacyReactRootDomPreparedWithoutInspectorIds)
      .when(snapshotLoaded)
      .when(propsRequestedForLegacyCraRoot)
      .then(expectLegacyRootFallbackResolved);
  });

  test('should fail soft with empty tree when CRA hooks are unavailable', () => {
    return given(contextCreated)
      .when(unsupportedDomPrepared)
      .when(snapshotLoaded)
      .when(propsRequestedForUnknownNode)
      .then(expectUnsupportedContextFailSoft);
  });

  test('should resolve CRA adapter through runtime factory routing', () => {
    return given(contextCreatedWithFactoryAdapter)
      .when(craDomPreparedWithoutInspectorIds)
      .when(snapshotLoaded)
      .then(expectFactoryRoutesToCraAdapter);
  });

  test('should normalize source metadata and safely drop malformed source values', () => {
    return given(contextCreated)
      .when(craDomPreparedWithSourceMetadata)
      .when(snapshotLoaded)
      .then(expectSourceMetadataNormalizedAndInvalidDropped);
  });
});
