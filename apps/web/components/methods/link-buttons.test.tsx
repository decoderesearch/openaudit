import { describe, expect, it } from 'vitest';
import { splitDemo, splitLinks } from './link-buttons';

const link = (url: string) => ({ kind: 'homepage', url });

describe('splitDemo', () => {
  it('takes the first Neuronpedia demo out of the links', () => {
    const paper = { kind: 'paper', url: 'https://arxiv.org/abs/1' };
    const docs = link('https://docs.neuronpedia.org/jacobian-lens');
    const demo = link('https://www.neuronpedia.org/jlens');
    expect(splitDemo([paper, docs, demo, link('https://neuronpedia.org')])).toEqual({
      demo,
      rest: [paper, docs, link('https://neuronpedia.org')],
    });
  });

  it('gives no demo for docs, other hosts or bad urls', () => {
    const links = [link('https://docs.neuronpedia.org'), link('https://neuronpedia.org.evil.com'), link('not a url')];
    expect(splitDemo(links)).toEqual({ demo: undefined, rest: links });
  });
});

describe('splitLinks', () => {
  const blog = { kind: 'blog', url: 'https://example.org/post' };
  const paper = { kind: 'paper', url: 'https://arxiv.org/abs/1' };
  const paper2 = { kind: 'paper', url: 'https://arxiv.org/abs/2' };

  it('takes the first paper out, before any blog post', () => {
    expect(splitLinks([blog, paper, paper2])).toEqual({ demo: undefined, paper, rest: [blog, paper2] });
  });

  it('takes a blog post when there is no paper', () => {
    const home = link('https://example.org');
    expect(splitLinks([home, blog])).toEqual({ demo: undefined, paper: blog, rest: [home] });
  });
});
