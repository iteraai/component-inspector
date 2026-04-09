import { ChangeDetectionStrategy, Component } from '@angular/core';
import { HeroCard } from './heroCard.component';
import { WorkflowChecklist } from './workflowChecklist.component';

@Component({
  selector: 'example-embedded-harness',
  standalone: true,
  imports: [HeroCard, WorkflowChecklist],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <main class="example-shell">
      <hero-card></hero-card>
      <workflow-checklist></workflow-checklist>
    </main>
  `,
  styles: [
    `
      .example-shell {
        display: grid;
        gap: 1.5rem;
        margin: 0 auto;
        max-width: 960px;
        min-height: 100vh;
        padding: 3rem 1.25rem;
      }
    `,
  ],
})
export class ExampleEmbeddedHarness {}
