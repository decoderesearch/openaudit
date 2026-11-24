import { evalExpansion, evalTitle, SEARCH_MAX_TOKENS, searchTokens, squash } from '@/lib/search';
import { describe, expect, it } from 'vitest';

const matches = (query: string, text: string) => searchTokens(query).every((t) => squash(text).includes(t));

describe('searchTokens', () => {
  it('splits on spaces and punctuation', () => {
    expect(searchTokens('  Qwen 27B ')).toEqual(['qwen', '27b']);
    expect(searchTokens('qwen-27b')).toEqual(['qwen', '27b']);
    expect(searchTokens('meta-llama/Llama-3.1_8B')).toEqual(['meta', 'llama', '3', '1', '8b']);
  });

  it('splits a word from a number that follows it', () => {
    expect(searchTokens('qwen27b')).toEqual(['qwen', '27b']);
    expect(searchTokens('gpt4o')).toEqual(['gpt', '4o']);
    expect(searchTokens('o3')).toEqual(['o3']);
  });

  it('drops empty and repeated tokens and caps the count', () => {
    expect(searchTokens('--- / ')).toEqual([]);
    expect(searchTokens('qwen qwen')).toEqual(['qwen']);
    expect(searchTokens('a b c d e f g h i j')).toHaveLength(SEARCH_MAX_TOKENS);
  });
});

describe('evalTitle', () => {
  const m = (...names: string[]) => names.map((name) => ({ name }));

  it('adds the authors without their notes', () => {
    expect(evalTitle('GDM stealth', m('Google DeepMind (Inspect Evals port)'))).toBe('GDM stealth (Google DeepMind)');
    expect(evalTitle('MASK', m('Center for AI Safety', 'Scale AI'))).toBe('MASK (Center for AI Safety, Scale AI)');
  });

  it('keeps a title that names the author', () => {
    expect(evalTitle('Malicious computer use (Anthropic)', m('Anthropic'))).toBe('Malicious computer use (Anthropic)');
    expect(evalTitle('Promptfoo Red Team', m('Promptfoo'))).toBe('Promptfoo Red Team');
    expect(evalTitle('Mine', [])).toBe('Mine');
  });

  it('uses the note when the name only repeats the title', () => {
    expect(evalTitle('SAEBench', m('SAEBench authors (Karvonen, Rager, et al.)'))).toBe(
      'SAEBench (Karvonen, Rager, et al.)',
    );
  });

  it("puts the authors in the title's own parentheses", () => {
    expect(evalTitle('Shade IPI (coding)', m('Gray Swan'))).toBe('Shade IPI (coding, Gray Swan)');
  });
});

describe('evalExpansion', () => {
  it('finds the long form in the aliases', () => {
    expect(
      evalExpansion('BBQ', ['Bias Benchmark for QA', 'Bias Benchmark for Question Answering (BBQ)', 'BBQ Benchmark']),
    ).toBe('Bias Benchmark for Question Answering');
    expect(evalExpansion('XSTest', ['XSTEST', 'eXaggerated Safety Test'])).toBe('eXaggerated Safety Test');
    expect(evalExpansion('NARCBench', ['Neural Activation Reading for Collusion Benchmark', 'NARC Bench'])).toBe(
      'Neural Activation Reading for Collusion Benchmark',
    );
    expect(evalExpansion('OR-Bench', ['ORBench', 'Over-Refusal Benchmark'])).toBe('Over-Refusal Benchmark');
  });

  it('gives nothing for a name that is not an abbreviation or has no long form', () => {
    expect(evalExpansion('ToxiGen', ['Toxigen Discriminative'])).toBeUndefined();
    expect(evalExpansion('MACHIAVELLI', ['Machiavelli', 'MACHIAVELLI Benchmark'])).toBeUndefined();
    expect(evalExpansion('SAEBench', ['SAE Bench', 'saebench'])).toBeUndefined();
  });
});

describe('matching', () => {
  it('ignores spaces and separators', () => {
    expect(matches('qwen 27b', 'Qwen3.6-27B')).toBe(true);
    expect(matches('qwen 27b', 'qwen-27b')).toBe(true);
    expect(matches('qwen27b', 'Qwen/Qwen3.6-27B')).toBe(true);
    expect(matches('deepseekr1', 'deepseek-ai/DeepSeek-R1')).toBe(true);
    expect(matches('swe bench', 'SWE-bench Verified')).toBe(true);
  });

  it('needs every token', () => {
    expect(matches('qwen 32b', 'Qwen3.6-27B')).toBe(false);
  });
});
