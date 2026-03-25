import {
  bootIterationInspectorRuntime,
  bootstrapEmbeddedInspectorBridge,
} from '@iteraai/react-component-inspector';
import { useEffect } from 'react';
import { resolveExampleHostOrigins } from './exampleEmbeddedRuntimeConfig';
import { createExampleHarnessAdapter } from './embeddedHarnessData';

export type EmbeddedHarnessAppProps = {
  enabled?: boolean;
  hostOrigins?: readonly string[];
  allowSelfMessaging?: boolean;
};

export const EmbeddedHarnessApp = ({
  enabled = true,
  hostOrigins,
  allowSelfMessaging = false,
}: EmbeddedHarnessAppProps) => {
  const resolvedHostOrigins = resolveExampleHostOrigins(hostOrigins);

  useEffect(() => {
    const bridge = bootstrapEmbeddedInspectorBridge({
      enabled,
      hostOrigins: resolvedHostOrigins,
      installInlineBackendHook: false,
      mode: 'iteration',
      capabilities: ['tree', 'props', 'highlight'],
      adapterFactory: () => createExampleHarnessAdapter(document),
    });
    const runtime = bootIterationInspectorRuntime({
      allowSelfMessaging,
    });

    return () => {
      runtime?.stop();
      delete window.__ITERA_ITERATION_INSPECTOR_RUNTIME__;
      bridge.destroy();
    };
  }, [allowSelfMessaging, enabled, resolvedHostOrigins]);

  return (
    <div className='example-page example-page--embedded'>
      <div className='example-shell'>
        <header data-inspector-node-id='hero-card' className='example-card'>
          <p className='example-eyebrow'>Public SDK Consumer</p>
          <h1>Embedded Customer Fixture</h1>
          <p className='example-copy'>
            This static app boots the public bridge and iteration runtime the
            same way a customer preview surface would.
          </p>
          <div className='example-chip-row'>
            <span className='example-chip'>
              Enabled: {enabled ? 'true' : 'false'}
            </span>
            <span className='example-chip'>
              Trusted hosts: {resolvedHostOrigins.join(', ')}
            </span>
          </div>
        </header>

        <main data-inspector-node-id='root-app' className='example-grid'>
          <section
            data-inspector-node-id='checklist-panel'
            className='example-card example-card--panel'
          >
            <p className='example-section-label'>Fixture contract</p>
            <ul className='example-list'>
              <li>Host posts `HELLO`; embedded replies `READY`.</li>
              <li>Host requests tree and serialized node props.</li>
              <li>Embedded posts preview-path updates after handshake.</li>
              <li>Iteration runtime can select the publish button.</li>
            </ul>
          </section>

          <button
            data-inspector-node-id='publish-button'
            data-testid='publish-button'
            type='button'
            className='example-cta'
          >
            Publish iteration
          </button>

          <section
            data-inspector-node-id='media-panel'
            className='example-card example-card--panel'
          >
            <p className='example-section-label'>Media fixture</p>
            <p className='example-copy example-copy-compact'>
              Use this image to validate asset swaps and image-target selection.
            </p>
            <img
              data-inspector-node-id='preview-image'
              data-testid='preview-image'
              className='example-media-image'
              alt='Modern workspace with a bright monitor and sketchbook'
              src='https://images.unsplash.com/photo-1496171367470-9ed9a91ea931?auto=format&fit=crop&w=1200&q=80'
            />
          </section>
        </main>
      </div>
    </div>
  );
};
