import React from 'react';
import ReactDOM from 'react-dom/client';
import { EmbeddedPluginApp } from './embeddedPluginApp';
import './styles.css';

const rootElement = document.getElementById('root');

if (rootElement === null) {
  throw new Error('React Vite plugin example root element was not found.');
}

ReactDOM.createRoot(rootElement).render(
  <React.StrictMode>
    <EmbeddedPluginApp />
  </React.StrictMode>,
);
