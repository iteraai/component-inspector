import { renderVueEmbeddedHarnessApp } from './renderVueEmbeddedHarnessApp';
import './styles.css';

const params = new URLSearchParams(window.location.search);
const rawHostOrigins = params.get('hostOrigins');
const hostOrigins =
  rawHostOrigins === null
    ? undefined
    : rawHostOrigins
        .split(',')
        .map((origin) => origin.trim())
        .filter((origin) => origin.length > 0);
const enabled = params.get('enabled') !== '0';
const allowSelfMessaging = params.get('allowSelfMessaging') === '1';
const rootElement = document.getElementById('root');

if (rootElement === null) {
  throw new Error('Embedded Vue example root element was not found.');
}

renderVueEmbeddedHarnessApp(rootElement, {
  allowSelfMessaging,
  enabled,
  hostOrigins,
});
