import type { PropType, Slot } from 'vue';
import { createApp, defineComponent, h } from 'vue';
import { bootstrapEmbeddedInspectorBridgeOnMount } from '@iteraai/vue-component-inspector';
import { bootIterationInspectorRuntime } from '@iteraai/vue-component-inspector/iterationInspector';
import { resolveExampleHostOrigins } from './exampleEmbeddedRuntimeConfig';

export type VueEmbeddedHarnessAppProps = {
  enabled?: boolean;
  hostOrigins?: readonly string[];
  allowSelfMessaging?: boolean;
};

const renderOptionalSlot = (slot?: Slot) => {
  return slot?.() ?? [];
};

const HeroCard = defineComponent({
  name: 'HeroCard',
  props: {
    enabled: {
      type: Boolean,
      required: true,
    },
    hostOrigins: {
      type: Array as PropType<string[]>,
      required: true,
    },
  },
  setup: (props) => {
    return () =>
      h('header', { class: 'example-card' }, [
        h('p', { class: 'example-eyebrow' }, 'Public SDK Consumer'),
        h('h1', 'Embedded Vue Fixture'),
        h(
          'p',
          { class: 'example-copy' },
          'This Vue 3 app boots the public bridge and iteration runtime the same way a customer preview surface would.',
        ),
        h('div', { class: 'example-chip-row' }, [
          h('span', { class: 'example-chip' }, `Enabled: ${props.enabled}`),
          h(
            'span',
            { class: 'example-chip' },
            `Trusted hosts: ${props.hostOrigins.join(', ')}`,
          ),
        ]),
      ]);
  },
});

const PublishButton = defineComponent({
  name: 'PublishButton',
  props: {
    label: {
      type: String,
      required: true,
    },
    variant: {
      type: String,
      required: true,
    },
  },
  setup: (props) => {
    return () =>
      h(
        'button',
        {
          'data-testid': 'publish-button',
          'data-variant': props.variant,
          type: 'button',
          class: 'example-cta',
        },
        props.label,
      );
  },
});

const WorkflowChecklist = defineComponent({
  name: 'WorkflowChecklist',
  setup: (_, { slots }) => {
    return () =>
      h('section', { class: 'example-card example-card--panel' }, [
        h('p', { class: 'example-section-label' }, 'Fixture contract'),
        h('ul', { class: 'example-list' }, [
          h('li', 'Host posts `HELLO`; embedded replies `READY`.'),
          h('li', 'Host requests tree, node props, highlight, and snapshot data.'),
          h('li', 'Embedded posts preview-path updates after handshake.'),
          h('li', 'Iteration runtime can select the publish button.'),
        ]),
        h('div', { class: 'example-chip-row' }, renderOptionalSlot(slots.default)),
      ]);
  },
});

const ExampleEmbeddedHarness = defineComponent({
  name: 'ExampleEmbeddedHarness',
  props: {
    enabled: {
      type: Boolean,
      required: true,
    },
    hostOrigins: {
      type: Array as PropType<string[]>,
      required: true,
    },
  },
  setup: (props) => {
    return () =>
      h('div', { class: 'example-page example-page--embedded' }, [
        h('div', { class: 'example-shell' }, [
          h(HeroCard, {
            enabled: props.enabled,
            hostOrigins: props.hostOrigins,
          }),
          h('main', { class: 'example-grid' }, [
            h(WorkflowChecklist, null, {
              default: () => [
                h(PublishButton, {
                  label: 'Publish iteration',
                  variant: 'primary',
                }),
              ],
            }),
          ]),
        ]),
      ]);
  },
});

export const renderVueEmbeddedHarnessApp = (
  container: Element,
  props: VueEmbeddedHarnessAppProps = {},
) => {
  const enabled = props.enabled ?? true;
  const hostOrigins = resolveExampleHostOrigins(props.hostOrigins);
  const app = createApp(ExampleEmbeddedHarness, {
    enabled,
    hostOrigins,
  });
  const bridge = bootstrapEmbeddedInspectorBridgeOnMount(app, {
    enabled,
    hostOrigins,
    mode: 'iteration',
    capabilities: ['tree', 'props', 'highlight'],
  });
  const runtime = bootIterationInspectorRuntime({
    allowSelfMessaging: props.allowSelfMessaging ?? false,
  });

  app.mount(container);

  return {
    unmount: () => {
      runtime?.stop();
      delete window.__ITERA_ITERATION_INSPECTOR_RUNTIME__;
      bridge.destroy();
      app.unmount();
    },
  };
};
