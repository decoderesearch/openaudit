import type { FrameworkId, RiskDecision } from '@openaudit/spec';

// Public pages that describe each framework. Each links to the current version.
export const FRAMEWORKS: Record<FrameworkId, { name: string; url: string }> = {
  'anthropic-rsp': { name: 'Responsible Scaling Policy', url: 'https://www.anthropic.com/responsible-scaling-policy' },
  'anthropic-fcf': {
    name: 'Frontier Compliance Framework',
    url: 'https://www.anthropic.com/news/compliance-framework-SB53',
  },
  'openai-preparedness': {
    name: 'Preparedness Framework',
    url: 'https://cdn.openai.com/pdf/18a02b5d-6b67-4cec-ab64-68cdfbddebcd/preparedness-framework-v2.pdf',
  },
  'google-fsf': {
    name: 'Frontier Safety Framework',
    url: 'https://deepmind.google/discover/blog/strengthening-our-frontier-safety-framework/',
  },
  'meta-aasf': {
    name: 'Advanced AI Scaling Framework',
    url: 'https://ai.meta.com/static-resource/Meta_Advanced-AI-Scaling-Framework-v2/',
  },
  'amazon-fmsf': {
    name: 'Frontier Model Safety Framework',
    url: 'https://www.amazon.science/publications/amazons-frontier-model-safety-framework',
  },
  'xai-faif': {
    name: 'Frontier AI Framework',
    url: 'https://media.x.ai/v1/website/xai-frontier-artificial-intelligence-framework-30-june-2026-f1f0c916.pdf',
  },
  'xai-rmf': {
    name: 'Risk Management Framework',
    url: 'https://data.x.ai/2025-08-20-xai-risk-management-framework.pdf',
  },
  'seoul-commitments': {
    name: 'Frontier AI Safety Commitments',
    url: 'https://www.gov.uk/government/publications/frontier-ai-safety-commitments-ai-seoul-summit-2024/frontier-ai-safety-commitments-ai-seoul-summit-2024',
  },
};

/** Each framework the verdicts name, once, in the order first named. */
export function frameworksUsed(verdicts: RiskDecision[]): FrameworkId[] {
  return [...new Set(verdicts.flatMap((r) => r.frameworks ?? []))];
}
