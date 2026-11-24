import { render } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { QuantizedNotice } from './quantized-notice';

vi.mock('next/link', () => ({
  default: ({ href, children, ...rest }: { href: string; children: React.ReactNode }) => (
    <a href={href} {...rest}>
      {children}
    </a>
  ),
}));

const model = { id: 'copy' };
const parent = { displayName: 'Qwen3.6-27B', href: '/Qwen/Qwen3.6-27B' };
const card = (...modelIds: string[]) => ({ covers: modelIds.map((modelId) => ({ modelId })) });
const text = (systemCards: ReturnType<typeof card>[], audited = true) =>
  render(<QuantizedNotice model={model} parent={parent} systemCards={systemCards} audited={audited} />).container
    .textContent;

describe('QuantizedNotice', () => {
  it('says that neither model has a system card and that we evaluated the copy', () => {
    expect(text([])).toBe(
      'This model is a quantized copy of Qwen3.6-27B and has no system card. We evaluated this model directly, not the original model.',
    );
  });

  it("says when the page compares the copy with the original's system card", () => {
    expect(text([card('base')])).toBe(
      'This model is a quantized copy of Qwen3.6-27B and has no system card of its own. The system card on this page is for the original model. We evaluated this model directly, not the original model. We compare our results with the system card of the original model.',
    );
  });

  it('counts only a card that covers the copy as its own', () => {
    expect(text([card('base', 'copy'), card('base')], false)).toBe(
      'This model is a quantized copy of Qwen3.6-27B. This page also shows the system card of the original model.',
    );
    expect(text([card('copy'), card('base')])).toContain('We compare our results with the system cards of both models.');
  });
});
