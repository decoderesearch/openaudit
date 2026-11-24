import { cardHeading } from '@/lib/card-heading';
import { describe, expect, it } from 'vitest';

const h = (title: string, kind = 'system_card') => {
  const { eyebrow, title: t } = cardHeading({ title, kind });
  return [eyebrow, t];
};

describe('cardHeading', () => {
  it('moves the document type to the eyebrow', () => {
    expect(h('System Card: Claude Opus 5.5')).toEqual(['System Card', 'Claude Opus 5.5']);
    expect(h('GPT-5.3 Instant System Card (PDF)')).toEqual(['System Card', 'GPT-5.3 Instant']);
    expect(h('Gemma 3 model card')).toEqual(['Model Card', 'Gemma 3']);
    expect(h('Mistral Medium 3.1 model card (Mistral Docs)')).toEqual(['Model Card', 'Mistral Medium 3.1']);
    expect(h('KAT-Coder-V2.5 Technical Report', 'technical_report')).toEqual(['Technical Report', 'KAT-Coder-V2.5']);
    expect(h('Gemini 3.1 Pro - Model Card')).toEqual(['Model Card', 'Gemini 3.1 Pro']);
    expect(h('Model Card: Grok 4.5')).toEqual(['Model Card', 'Grok 4.5']);
    expect(h('The Claude 3 Model Family: Opus, Sonnet, Haiku (model card)')).toEqual([
      'Model Card',
      'The Claude 3 Model Family: Opus, Sonnet, Haiku',
    ]);
    expect(h('Seed1.8 Model Card: Towards Generalized Real-World Agency')).toEqual([
      'Model Card',
      'Seed1.8: Towards Generalized Real-World Agency',
    ]);
  });

  it('keeps the phrase when it is part of the name', () => {
    expect(h('Model Card and Evaluations for Claude Models')).toEqual([
      'Model Card',
      'Model Card and Evaluations for Claude Models',
    ]);
    expect(h('Amazon Nova Premier: Technical report and model card', 'technical_report')).toEqual([
      'Technical Report',
      'Amazon Nova Premier: Technical report and model card',
    ]);
  });

  it('names a model page by its kind, not its title', () => {
    expect(h('Codestral 25.08 model card (Mistral Docs)', 'model_page')).toEqual(['Model Page', 'Codestral 25.08']);
  });

  it('names addenda and updates', () => {
    expect(h('System Card Addendum: Claude Opus 4.1')).toEqual(['System Card Addendum', 'Claude Opus 4.1']);
    expect(h('Claude 3.5 Sonnet Model Card Addendum')).toEqual(['Model Card Addendum', 'Claude 3.5 Sonnet']);
    expect(h('Addendum to GPT-5.2 System Card: GPT-5.2-Codex (PDF)')).toEqual([
      'Addendum to GPT-5.2 System Card',
      'GPT-5.2-Codex',
    ]);
    expect(h('Update to GPT-5 System Card: GPT-5.2 (PDF)')).toEqual(['Update to GPT-5 System Card', 'GPT-5.2']);
  });

  it('keeps paper titles and gives the month and year', () => {
    expect(h('DeepSeek-VL: Towards Real-World Vision-Language Understanding', 'technical_report')).toEqual([
      'Technical Report',
      'DeepSeek-VL: Towards Real-World Vision-Language Understanding',
    ]);
    expect(cardHeading({ title: 'x', kind: 'blog', publishedDate: '2026-09-22' }).date).toBe('Sept 2026');
  });
});
