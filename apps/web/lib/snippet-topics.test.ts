import { describe, expect, it } from 'vitest';
import { snippetTopics } from './snippet-topics';

describe('snippetTopics', () => {
  it('adds only the setting topics of the eval, once', () => {
    expect(snippetTopics('bio_chem', ['harmful_requests', 'jailbreaks', 'bio_chem', 'cyber'])).toEqual([
      'bio_chem',
      'jailbreaks',
    ]);
    expect(snippetTopics('agentic_misuse', ['agentic_misuse', 'jailbreaks', 'harmful_requests'])).toEqual([
      'agentic_misuse',
      'jailbreaks',
    ]);
    expect(snippetTopics('honesty', ['auditing', 'eval_awareness', 'sycophancy'])).toEqual(['honesty', 'auditing']);
    expect(snippetTopics('harmful_content')).toEqual(['harmful_content']);
  });
});
