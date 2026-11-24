import { comparedOf, type ComparedMethod } from '@/lib/method-compares';
import { describe, expect, it } from 'vitest';

const method = (slug: string, label: string): ComparedMethod => ({
  slug,
  label,
  summary: `About ${label}.`,
  tagline: `${label} tagline.`,
});
const SAE = method('sparse-autoencoders', 'Sparse Autoencoders');
const PROBES = method('probes', 'Probes');
const MONITORS = method('llm-monitors', 'LLM Monitors');

describe('comparedOf', () => {
  it('is null with no methods', () => {
    expect(comparedOf([], 'honesty')).toBeNull();
  });

  it('is the method, with its tagline and summary, for one method', () => {
    expect(comparedOf([SAE], null)).toEqual({
      key: 'sparse-autoencoders',
      label: 'Sparse Autoencoders',
      href: '/methods/sparse-autoencoders',
      tagline: 'Sparse Autoencoders tagline.',
      about: 'About Sparse Autoencoders.',
    });
  });

  it('is the topic, with its text, for several methods', () => {
    expect(comparedOf([MONITORS, PROBES, SAE], 'honesty')).toEqual({
      key: 'topic:honesty',
      label: 'Honesty',
      href: null,
      tagline: 'Does the model say what it believes to be true, and admit what it does not know.',
      about:
        'Does the model say what it believes to be true, and admit what it does not know. Compares LLM Monitors, Probes and Sparse Autoencoders.',
      topic: true,
    });
  });

  it('is the method names with no topic', () => {
    expect(comparedOf([MONITORS, PROBES], null)).toMatchObject({
      key: 'llm-monitors+probes',
      label: 'LLM Monitors and Probes',
      href: null,
      tagline: null,
    });
  });
});
