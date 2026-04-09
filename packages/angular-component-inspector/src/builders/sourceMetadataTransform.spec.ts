import ts from 'typescript';
import {
  isSupportedAngularSourceMetadataFile,
  transformAngularComponentSourceMetadata,
} from './sourceMetadataTransform';

test('instruments Angular component classes with project-relative source metadata', () => {
  const sourceFilePath =
    '/workspace/src/app/product-card/product-card.component.ts';
  const result = transformAngularComponentSourceMetadata({
    code: `import { Component } from '@angular/core';

@Component({
  selector: 'app-product-card',
  template: '<p>product-card works!</p>',
})
export class ProductCardComponent {}
`,
    sourceFilePath,
    workspaceRoot: '/workspace',
    typeScript: ts,
  });

  expect(result.changed).toBe(true);
  expect(result.componentClassNames).toEqual(['ProductCardComponent']);
  expect(result.code).toContain(
    `Object.defineProperty(ProductCardComponent, "__iteraSource"`,
  );
  expect(result.code).toContain(
    `file: "src/app/product-card/product-card.component.ts"`,
  );
  expect(result.code).toContain('line: 7');
  expect(result.code).toContain('column: 14');
});

test('supports aliased Angular Component decorators', () => {
  const result = transformAngularComponentSourceMetadata({
    code: `import { Component as NgComponent } from '@angular/core';

@NgComponent({
  selector: 'app-toolbar',
  template: '',
})
class ToolbarComponent {}
`,
    sourceFilePath: '/workspace/src/app/toolbar.component.ts',
    workspaceRoot: '/workspace',
    typeScript: ts,
  });

  expect(result.changed).toBe(true);
  expect(result.componentClassNames).toEqual(['ToolbarComponent']);
});

test('ignores non-component Angular declarations', () => {
  const result = transformAngularComponentSourceMetadata({
    code: `import { Directive } from '@angular/core';

@Directive({
  selector: '[focusTrap]',
})
export class FocusTrapDirective {}
`,
    sourceFilePath: '/workspace/src/app/focus-trap.directive.ts',
    workspaceRoot: '/workspace',
    typeScript: ts,
  });

  expect(result.changed).toBe(false);
  expect(result.componentClassNames).toEqual([]);
});

test('only instruments supported authored TypeScript source files', () => {
  expect(
    isSupportedAngularSourceMetadataFile(
      '/workspace/src/app/product-card.component.ts',
    ),
  ).toBe(true);
  expect(
    isSupportedAngularSourceMetadataFile(
      '/workspace/src/app/product-card.component.d.ts',
    ),
  ).toBe(false);
  expect(
    isSupportedAngularSourceMetadataFile(
      '/workspace/node_modules/pkg/product-card.component.ts',
    ),
  ).toBe(false);
});
