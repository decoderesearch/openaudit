import { describe, expect, it, vi } from 'vitest';

vi.mock('@/lib/db', () => ({ prisma: {} }));

import { crumbsFor, evalMenu } from './breadcrumbs';

const link = (slug: string) => ({ label: slug, href: `/evaluations/${slug}` });
const links = ['a', 'b', 'c', 'd'].map(link);
const runnable = new Set(['/evaluations/b', '/evaluations/d']);
const hrefs = (menu: ReturnType<typeof evalMenu>) =>
  menu.map((g) => [g.title ?? '', g.links.map((l) => l.label).join(',')]);

describe('evalMenu', () => {
  it('lists the runnable evals first, and puts the current eval on top when it is not runnable', () => {
    expect(hrefs(evalMenu(links, runnable, '/evaluations/c'))).toEqual([
      ['', 'c'],
      ['Runnable Evals', 'b,d'],
      ['Other Evals', 'a'],
    ]);
  });

  it('keeps a runnable current eval in its place', () => {
    expect(hrefs(evalMenu(links, runnable, '/evaluations/b'))).toEqual([
      ['', ''],
      ['Runnable Evals', 'b,d'],
      ['Other Evals', 'a,c'],
    ]);
  });

  it('is one list when no eval is runnable', () => {
    expect(hrefs(evalMenu(links, new Set(), '/evaluations/c'))).toEqual([['', 'a,b,c,d']]);
  });
});

describe('crumbsFor', () => {
  it('puts only Home before the Contribute, FAQs and Why pages', async () => {
    expect(await crumbsFor(['contribute'])).toEqual([{ label: 'How to Contribute' }]);
    expect(await crumbsFor(['features'])).toEqual([{ label: 'OpenAudit Features' }]);
    expect(await crumbsFor(['faqs'])).toEqual([{ label: 'Frequently Asked Questions' }]);
    expect(await crumbsFor(['faqs', 'x'])).toBeNull();
  });
});
