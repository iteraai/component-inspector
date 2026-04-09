import { ChangeDetectionStrategy, Component, Input } from '@angular/core';

@Component({
  selector: 'publish-button',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: {
    'data-testid': 'publish-button-host',
  },
  template: `
    <button
      class="publish-button"
      data-testid="publish-button"
      type="button"
      [attr.data-variant]="variant"
    >
      {{ label }}
    </button>
  `,
  styles: [
    `
      :host {
        display: inline-flex;
      }

      .publish-button {
        border: 0;
        border-radius: 999px;
        background: linear-gradient(135deg, #0f172a, #0ea5e9);
        color: white;
        cursor: pointer;
        font: inherit;
        font-weight: 600;
        letter-spacing: 0.01em;
        padding: 0.85rem 1.3rem;
      }
    `,
  ],
})
export class PublishButton {
  @Input() label = 'Publish iteration';
  @Input() variant = 'primary';
}
