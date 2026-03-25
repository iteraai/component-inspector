import { bootstrapEmbeddedInspectorBridge } from '../embeddedBootstrap';
import {
  bootstrapStorybookPreviewInspectorBridge,
  resolveStorybookPreviewHostOrigins,
} from './previewBootstrap';

vi.mock('../embeddedBootstrap', () => {
  return {
    bootstrapEmbeddedInspectorBridge: vi.fn(() => ({ destroy: vi.fn() })),
  };
});

describe('storybook preview bootstrap', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  test('resolves direct host origins and the Storybook manager referrer origin together', () => {
    expect(
      resolveStorybookPreviewHostOrigins({
        hostOrigins: 'https://app.iteradev.ai, https://preview.iteradev.ai',
        referrer:
          'https://storybook.iteradev.ai/?path=/story/button--primary',
      }),
    ).toStrictEqual([
      'https://app.iteradev.ai',
      'https://preview.iteradev.ai',
      'https://storybook.iteradev.ai',
    ]);
  });

  test('uses default direct host origins and deduplicates the manager origin during bootstrap', () => {
    const bootstrapResult = {
      destroy: vi.fn(),
    };

    vi.mocked(bootstrapEmbeddedInspectorBridge).mockReturnValue(bootstrapResult);

    expect(
      bootstrapStorybookPreviewInspectorBridge({
        enabled: true,
        hostOrigins: '   ',
        defaultHostOrigins: ['https://app.iteradev.ai'],
        managerOrigin: 'https://app.iteradev.ai/storybook?path=/story/button',
      }),
    ).toBe(bootstrapResult);

    expect(bootstrapEmbeddedInspectorBridge).toHaveBeenCalledWith({
      enabled: true,
      hostOrigins: ['https://app.iteradev.ai'],
      defaultHostOrigins: ['https://app.iteradev.ai'],
      managerOrigin: 'https://app.iteradev.ai/storybook?path=/story/button',
    });
  });
});
