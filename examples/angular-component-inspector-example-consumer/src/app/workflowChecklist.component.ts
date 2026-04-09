import { ChangeDetectionStrategy, Component, Input } from '@angular/core';
import { PublishButton } from './publishButton.component';

@Component({
  selector: 'workflow-checklist',
  standalone: true,
  imports: [PublishButton],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <section class="workflow-checklist">
      <div>
        <p class="section-label">Angular smoke coverage</p>
        <h2>Validate the supported builder path.</h2>
      </div>
      <ul>
        <li>Handshake against public package imports</li>
        <li>Surface tree source metadata from the builder contract</li>
        <li>Resolve props, highlight, snapshot, and selection flows</li>
      </ul>
      <publish-button
        [label]="publishLabel"
        [variant]="publishVariant"
      ></publish-button>
    </section>
  `,
  styles: [
    `
      .workflow-checklist {
        border-radius: 24px;
        background: #0f172a;
        color: white;
        display: grid;
        gap: 1rem;
        padding: 1.5rem;
      }

      .section-label {
        color: rgba(125, 211, 252, 0.9);
        font-size: 0.75rem;
        font-weight: 700;
        letter-spacing: 0.12em;
        margin: 0 0 0.5rem;
        text-transform: uppercase;
      }

      h2 {
        font-size: 1.3rem;
        margin: 0;
      }

      ul {
        color: rgba(226, 232, 240, 0.95);
        display: grid;
        gap: 0.6rem;
        margin: 0;
        padding-left: 1.25rem;
      }
    `,
  ],
})
export class WorkflowChecklist {
  @Input() publishLabel = 'Publish iteration';
  @Input() publishVariant = 'primary';
}
