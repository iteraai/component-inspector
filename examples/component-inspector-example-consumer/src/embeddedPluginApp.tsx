import { useState } from 'react';

type PublishButtonProps = {
  label: string;
  variant: 'primary' | 'secondary';
};

const PublishButton = ({ label, variant }: PublishButtonProps) => {
  const [clickCount, setClickCount] = useState(0);

  return (
    <button
      data-testid='publish-button'
      type='button'
      className='example-cta'
      data-variant={variant}
      onClick={() => setClickCount((currentCount) => currentCount + 1)}
    >
      {label}
      {clickCount > 0 ? ` (${clickCount})` : ''}
    </button>
  );
};

const StatusPanel = () => {
  return (
    <section className='example-card example-card--panel'>
      <p className='example-section-label'>Plugin bootstrap</p>
      <ul className='example-list'>
        <li>No runtime imports exist in this app entrypoint.</li>
        <li>The bridge is injected by `@iteraai/vite-plugin-react-inspector`.</li>
        <li>The React inspector runtime uses the existing fiber path.</li>
      </ul>
    </section>
  );
};

export const EmbeddedPluginApp = () => {
  return (
    <div className='example-page example-page--embedded'>
      <div className='example-shell'>
        <header className='example-card example-card--panel'>
          <p className='example-eyebrow'>React Vite Plugin</p>
          <h1>Plugin-injected embedded app</h1>
          <p className='example-copy'>
            This fixture mounts a normal React-Vite app. The inspector bridge and
            iteration runtime come from the Vite plugin, not from this React
            entrypoint.
          </p>
          <div className='example-chip-row'>
            <span className='example-chip'>Trusted host: 127.0.0.1:4173</span>
            <span className='example-chip'>Embedded port: 4175</span>
          </div>
        </header>

        <main className='example-grid'>
          <StatusPanel />

          <PublishButton label='Publish iteration' variant='primary' />

          <section className='example-card example-card--panel'>
            <p className='example-section-label'>Inspectable media</p>
            <p className='example-copy example-copy-compact'>
              Use this card to validate tree traversal, highlighting, and
              element selection against a plugin-injected runtime.
            </p>
            <img
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
