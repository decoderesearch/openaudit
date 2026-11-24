import { NEXT_PUBLIC_URL } from '@/lib/env';
import { CANARY, NO_TRAINING } from '@/lib/legal';

// AI training crawlers may not read the site. Search crawlers and AI agents may, but not eval
// samples. Content-Signal is Cloudflare's format for the same rule.
const TRAINING_CRAWLERS = [
  'GPTBot',
  'ClaudeBot',
  'anthropic-ai',
  'CCBot',
  'Google-Extended',
  'Applebot-Extended',
  'Bytespider',
  'Meta-ExternalAgent',
  'FacebookBot',
  'cohere-ai',
  'cohere-training-data-crawler',
  'Diffbot',
  'Amazonbot',
  'AI2Bot',
  'PanguBot',
  'Timpibot',
  'omgili',
];

const PRIVATE = ['/evaluations/*/samples', '/api/', '/settings', '/onboarding'];

export function GET() {
  const body = [
    `# ${NO_TRAINING} See ${NEXT_PUBLIC_URL}/terms#ai-training`,
    `# ${CANARY}`,
    '',
    ...TRAINING_CRAWLERS.map((agent) => `User-agent: ${agent}`),
    'Disallow: /',
    '',
    'User-agent: *',
    'Content-Signal: search=yes, ai-input=yes, ai-train=no',
    ...PRIVATE.map((path) => `Disallow: ${path}`),
    '',
    `Sitemap: ${NEXT_PUBLIC_URL}/sitemap.xml`,
    `Host: ${NEXT_PUBLIC_URL}`,
    '',
  ].join('\n');
  return new Response(body, {
    headers: { 'content-type': 'text/plain; charset=utf-8', 'cache-control': 'public, max-age=3600' },
  });
}
