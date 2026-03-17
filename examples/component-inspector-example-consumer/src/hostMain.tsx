import React from 'react';
import ReactDOM from 'react-dom/client';
import { HostHarnessApp } from './hostHarnessApp';
import './styles.css';

const rootElement = document.getElementById('root');

if (rootElement === null) {
  throw new Error('Host example root element was not found.');
}

ReactDOM.createRoot(rootElement).render(
  <React.StrictMode>
    <HostHarnessApp />
  </React.StrictMode>,
);
