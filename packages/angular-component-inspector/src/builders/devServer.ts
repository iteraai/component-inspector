import { createBuilder } from '@angular-devkit/architect';
import {
  createPassThroughAngularBuilderHandler,
  type AngularInspectorBuilderOptions,
} from './delegateBuilder';

export type AngularInspectorDevServerBuilderOptions =
  AngularInspectorBuilderOptions;

export default createBuilder<AngularInspectorDevServerBuilderOptions>(
  createPassThroughAngularBuilderHandler('dev-server'),
);
