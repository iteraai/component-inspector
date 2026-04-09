import { createBuilder } from '@angular-devkit/architect';
import type { AngularInspectorBuilderOptions } from './delegateBuilder';
import { executeAngularDevServerBuilder } from './programmaticBuilder';

export type AngularInspectorDevServerBuilderOptions =
  AngularInspectorBuilderOptions;

export default createBuilder<AngularInspectorDevServerBuilderOptions>(
  executeAngularDevServerBuilder,
);
