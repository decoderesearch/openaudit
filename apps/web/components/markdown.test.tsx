import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { Markdown, dedent, safeUrl } from './markdown';

describe('Markdown', () => {
  it('opens outside links in a new tab with noopener', () => {
    render(<Markdown text="[Reuters reported](https://www.reuters.com/x) that it did." />);
    const a = screen.getByRole('link', { name: 'Reuters reported' });
    expect(a.getAttribute('href')).toBe('https://www.reuters.com/x');
    expect(a.getAttribute('target')).toBe('_blank');
    expect(a.getAttribute('rel')).toContain('noopener');
  });

  it('shows no raw HTML and drops unsafe links', () => {
    const { container } = render(
      <Markdown
        text={'Hi <script>alert(1)</script><b>bold</b> [x](javascript:alert(1)) ![i](https://a.example/i.png)'}
      />,
    );
    expect(container.querySelector('script')).toBeNull();
    expect(container.querySelector('b')).toBeNull();
    expect(container.querySelector('img')).toBeNull();
    expect(container.querySelector('a')).toBeNull();
    expect(container.textContent).toContain('x');
  });

  it('keeps relative links in the tab', () => {
    render(<Markdown text="See [Qwen](/qwen)." inline />);
    expect(screen.getByRole('link', { name: 'Qwen' }).getAttribute('target')).toBeNull();
  });

  it('safeUrl keeps only http(s), relative and anchor URLs', () => {
    expect(safeUrl('https://a.example')).toBe('https://a.example');
    expect(safeUrl('/qwen')).toBe('/qwen');
    expect(safeUrl('#event-1')).toBe('#event-1');
    expect(safeUrl('javascript:alert(1)')).toBe('');
    expect(safeUrl('data:text/html,x')).toBe('');
    expect(safeUrl('mailto:a@b.c')).toBe('');
  });
});

describe('dedent', () => {
  it('removes the code indent, so a later paragraph is not code', () => {
    const text = `First paragraph,
        same paragraph.

        Second paragraph with a [link](/faqs).
        `;
    expect(dedent(text)).toBe('First paragraph,\nsame paragraph.\n\nSecond paragraph with a [link](/faqs).');
    const { container } = render(<Markdown text={text} dedent />);
    expect(container.querySelector('pre, code')).toBeNull();
    expect(container.querySelectorAll('p')).toHaveLength(2);
  });

  it('keeps the indent of a nested list, from a text that starts on a new line', () => {
    expect(dedent('\n    - a\n      - b\n    ')).toBe('- a\n  - b');
  });

  it('makes a table, with borders on its cells', () => {
    const text = `
        | Data | Source |
        | --- | --- |
        | Evaluations | Public |
        `;
    const { container } = render(<Markdown text={text} dedent />);
    expect([...container.querySelectorAll('th, td')].map((c) => c.textContent)).toEqual([
      'Data',
      'Source',
      'Evaluations',
      'Public',
    ]);
    expect(container.querySelector('td')?.className).toContain('border');
  });
});
