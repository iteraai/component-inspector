import { createBuilder } from '@angular-devkit/architect';
import {
  createPassThroughAngularBuilderHandler,
  type AngularInspectorBuilderOptions,
} from './delegateBuilder';

export type AngularInspectorApplicationBuilderOptions =
  AngularInspectorBuilderOptions;

export default createBuilder<AngularInspectorApplicationBuilderOptions>(
  createPassThroughAngularBuilderHandler('application'),
);
