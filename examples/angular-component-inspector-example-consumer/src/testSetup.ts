import '@angular/compiler';
import 'zone.js';
import { HeroCard } from './app/heroCard.component';
import { ExampleEmbeddedHarness } from './app/app.component';
import { PublishButton } from './app/publishButton.component';
import { WorkflowChecklist } from './app/workflowChecklist.component';

const applyTestSourceMetadata = (
  target: object,
  source: {
    file: string;
    line: number;
    column: number;
  },
) => {
  Object.defineProperty(target, '__iteraSource', {
    configurable: true,
    value: source,
  });
};

applyTestSourceMetadata(ExampleEmbeddedHarness, {
  file: 'src/app/app.component.ts',
  line: 5,
  column: 1,
});
applyTestSourceMetadata(HeroCard, {
  file: 'src/app/heroCard.component.ts',
  line: 3,
  column: 1,
});
applyTestSourceMetadata(WorkflowChecklist, {
  file: 'src/app/workflowChecklist.component.ts',
  line: 4,
  column: 1,
});
applyTestSourceMetadata(PublishButton, {
  file: 'src/app/publishButton.component.ts',
  line: 3,
  column: 1,
});

type WindowWithIterationRuntime = Window & {
  __ITERA_ITERATION_INSPECTOR_RUNTIME__?: unknown;
};

beforeEach(() => {
  document.body.innerHTML = '';
  window.history.replaceState({}, '', '/?fixture=1');
  delete (window as WindowWithIterationRuntime)
    .__ITERA_ITERATION_INSPECTOR_RUNTIME__;
});

afterEach(() => {
  delete (window as WindowWithIterationRuntime)
    .__ITERA_ITERATION_INSPECTOR_RUNTIME__;
});
