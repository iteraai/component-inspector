import { transformVueInspectorSourceMetadataModule } from './sourceMetadataVitePlugin';

describe('sourceMetadataVitePlugin', () => {
  test('injects source metadata into Vue defineComponent option objects', () => {
    const transformedCode = transformVueInspectorSourceMetadataModule(
      [
        "import { defineComponent, h } from 'vue';",
        '',
        'export const ExampleButton = defineComponent({',
        "  name: 'ExampleButton',",
        '  setup: (props) => () =>',
        "    h('button', { id: `${props.variant}-button` }, props.label),",
        '});',
      ].join('\n'),
      '/workspace/src/ExampleButton.ts?direct',
      '/workspace',
    );

    expect(transformedCode).toContain(
      'defineComponent({__source:{"file":"src/ExampleButton.ts","line":3,',
    );
    expect(transformedCode).toMatch(/"column":\d+\},/);
    expect(transformedCode).toContain("name: 'ExampleButton'");
  });

  test('supports aliased defineComponent imports from vue', () => {
    const transformedCode = transformVueInspectorSourceMetadataModule(
      [
        "import { defineComponent as _defineComponent } from 'vue';",
        '',
        'export const ExampleCard = _defineComponent({',
        "  name: 'ExampleCard',",
        '});',
      ].join('\n'),
      '/workspace/src/ExampleCard.ts',
      '/workspace',
    );

    expect(transformedCode).toContain(
      '_defineComponent({__source:{"file":"src/ExampleCard.ts","line":3,',
    );
    expect(transformedCode).toMatch(/"column":\d+\},/);
  });

  test('ignores defineComponent-like text inside strings and comments', () => {
    const sourceModule = [
      "import { defineComponent } from 'vue';",
      '',
      '// defineComponent({ should not be instrumented })',
      'const label = "defineComponent({ still not code })";',
      'export const ExampleCard = defineComponent({',
      "  name: 'ExampleCard',",
      '});',
    ].join('\n');
    const transformedCode = transformVueInspectorSourceMetadataModule(
      sourceModule,
      '/workspace/src/ExampleCard.ts',
      '/workspace',
    );

    expect(transformedCode).toContain(
      'const label = "defineComponent({ still not code })";',
    );
    expect(transformedCode).toContain(
      'defineComponent({__source:{"file":"src/ExampleCard.ts","line":5,',
    );
    expect(transformedCode?.match(/__source:/g)).toHaveLength(1);
  });

  test('supports generic defineComponent invocations', () => {
    const transformedCode = transformVueInspectorSourceMetadataModule(
      [
        "import { defineComponent } from 'vue';",
        '',
        'type Props = {',
        '  label: string;',
        '};',
        '',
        'export const ExampleCard = defineComponent<Props>({',
        "  name: 'ExampleCard',",
        '});',
      ].join('\n'),
      '/workspace/src/ExampleCard.ts',
      '/workspace',
    );

    expect(transformedCode).toContain(
      'defineComponent<Props>({__source:{"file":"src/ExampleCard.ts","line":7,',
    );
    expect(transformedCode).toMatch(/"column":\d+\},/);
  });

  test('leaves files without a Vue defineComponent import unchanged', () => {
    const transformedCode = transformVueInspectorSourceMetadataModule(
      [
        'const defineComponent = (value) => value;',
        '',
        'export const ExampleCard = defineComponent({',
        "  name: 'ExampleCard',",
        '});',
      ].join('\n'),
      '/workspace/src/ExampleCard.ts',
      '/workspace',
    );

    expect(transformedCode).toBeNull();
  });
});
