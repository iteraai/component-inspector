import { bootstrapApplication } from '@angular/platform-browser';
import { bootstrapEmbeddedInspectorBridge } from '@iteraai/angular-component-inspector/embeddedBootstrap';
import { bootIterationInspectorRuntime } from '@iteraai/angular-component-inspector/iterationInspector';
import { ExampleEmbeddedHarness } from './app.component';

export const trustedHostOrigin = 'http://127.0.0.1:4173';

const defaultHostOrigins = [trustedHostOrigin, 'http://localhost:4173'];
const appSelector = 'example-embedded-harness';

const resolveHostOrigins = (search: string) => {
  const hostOrigins = new URLSearchParams(search).get('hostOrigins');

  if (hostOrigins === null) {
    return [...defaultHostOrigins];
  }

  const resolvedHostOrigins = hostOrigins
    .split(',')
    .map((origin) => origin.trim())
    .filter((origin) => origin.length > 0);

  return resolvedHostOrigins.length > 0
    ? resolvedHostOrigins
    : [...defaultHostOrigins];
};

const ensureAppHost = (doc: Document) => {
  const existingHost = doc.querySelector(appSelector);

  if (existingHost instanceof HTMLElement) {
    return {
      created: false,
      hostElement: existingHost,
    };
  }

  const hostElement = doc.createElement(appSelector);

  doc.body.append(hostElement);

  return {
    created: true,
    hostElement,
  };
};

export type BootstrapAngularExampleConsumerOptions = {
  allowSelfMessaging?: boolean;
  hostOrigins?: readonly string[];
};

export type AngularExampleConsumerHandle = {
  destroy: () => void;
};

type WindowWithIterationRuntime = Window & {
  __ITERA_ITERATION_INSPECTOR_RUNTIME__?: unknown;
};

export const bootstrapAngularExampleConsumer = async (
  options: BootstrapAngularExampleConsumerOptions = {},
): Promise<AngularExampleConsumerHandle> => {
  const { created, hostElement } = ensureAppHost(document);
  const bridge = bootstrapEmbeddedInspectorBridge({
    enabled: true,
    hostOrigins: options.hostOrigins ?? resolveHostOrigins(window.location.search),
  });
  const iterationRuntime = bootIterationInspectorRuntime({
    allowSelfMessaging: options.allowSelfMessaging ?? false,
  });
  const appRef = await bootstrapApplication(ExampleEmbeddedHarness);

  return {
    destroy: () => {
      iterationRuntime?.stop();
      bridge.destroy();
      appRef.destroy();

      if (created) {
        hostElement.remove();
      }

      delete (window as WindowWithIterationRuntime)
        .__ITERA_ITERATION_INSPECTOR_RUNTIME__;
    },
  };
};
