import { ChangeDetectionStrategy, Component, Input } from '@angular/core';

@Component({
  selector: 'hero-card',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <section class="hero-card">
      <p class="hero-eyebrow">{{ eyebrow }}</p>
      <h1>{{ title }}</h1>
      <p class="hero-copy">{{ copy }}</p>
    </section>
  `,
  styles: [
    `
      .hero-card {
        border: 1px solid rgba(15, 23, 42, 0.08);
        border-radius: 24px;
        background: rgba(255, 255, 255, 0.9);
        box-shadow: 0 20px 60px rgba(15, 23, 42, 0.08);
        padding: 1.75rem;
      }

      .hero-eyebrow {
        color: #0369a1;
        font-size: 0.75rem;
        font-weight: 700;
        letter-spacing: 0.12em;
        margin: 0 0 0.75rem;
        text-transform: uppercase;
      }

      h1 {
        font-size: 2rem;
        line-height: 1.1;
        margin: 0;
      }

      .hero-copy {
        color: #334155;
        margin: 0.75rem 0 0;
      }
    `,
  ],
})
export class HeroCard {
  @Input() eyebrow = 'Embedded Angular Fixture';
  @Input() title = 'Ship inspector changes through Angular tooling.';
  @Input() copy =
    'This fixture proves the SDK can handshake, inspect, highlight, snapshot, and select from a real Angular app.';
}
