import { describeIterationInspectorRuntimeCaptureSuite } from '../../../inspector-runtime-core/src/iterationInspector/runtime.capture.shared-spec';
import { ITERATION_INSPECTOR_CHANNEL } from './types';
import {
  buildIterationElementSelection,
  createIterationInspectorRuntime,
} from './runtime';

describeIterationInspectorRuntimeCaptureSuite({
  ITERATION_INSPECTOR_CHANNEL,
  buildIterationElementSelection,
  createIterationInspectorRuntime,
});
