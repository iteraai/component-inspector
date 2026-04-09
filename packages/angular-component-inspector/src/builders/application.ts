import { createBuilder } from '@angular-devkit/architect';
import type { AngularInspectorBuilderOptions } from './delegateBuilder';
import { executeAngularApplicationBuilder } from './programmaticBuilder';

export type AngularInspectorApplicationBuilderOptions =
  AngularInspectorBuilderOptions;

export default createBuilder<AngularInspectorApplicationBuilderOptions>(
  executeAngularApplicationBuilder,
);
