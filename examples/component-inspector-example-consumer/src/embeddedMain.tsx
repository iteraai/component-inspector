import React from 'react';
import ReactDOM from 'react-dom/client';
import {
  EmbeddedHarnessApp,
  defaultExampleHostOrigins,
} from './embeddedHarnessApp';
import './styles.css';

const params = new URLSearchParams(window.location.search);
const rawHostOrigins = params.get('hostOrigins');
const hostOrigins =
  rawHostOrigins === null
    ? [...defaultExampleHostOrigins]
    : rawHostOrigins
        .split(',')
        .map((origin) => origin.trim())
        .filter((origin) => origin.length > 0);
const enabled = params.get('enabled') !== '0';
const allowSelfMessaging = params.get('allowSelfMessaging') === '1';
const rootElement = document.getElementById('root');

if (rootElement === null) {
  throw new Error('Embedded example root element was not found.');
}

ReactDOM.createRoot(rootElement).render(
  <React.StrictMode>
    <EmbeddedHarnessApp
      allowSelfMessaging={allowSelfMessaging}
      enabled={enabled}
      hostOrigins={hostOrigins}
    />
  </React.StrictMode>,
);
