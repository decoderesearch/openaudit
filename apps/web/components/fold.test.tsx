import { Fold } from '@/components/fold';
import { fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

/** The content's height, in px. The fold's box is as high as its max height, or the content. */
function sized(content: number) {
  vi.spyOn(HTMLElement.prototype, 'scrollHeight', 'get').mockImplementation(() => content);
  vi.spyOn(HTMLElement.prototype, 'clientHeight', 'get').mockImplementation(function (this: HTMLElement) {
    const max = parseFloat(this.style.maxHeight);
    return Number.isNaN(max) ? content : Math.min(max, content);
  });
}

const clip = () => screen.getByText('Rows').parentElement!;

describe('Fold', () => {
  afterEach(() => vi.restoreAllMocks());

  it('shows no button when the content fits', () => {
    sized(200);
    render(
      <Fold more="Show more rows">
        <p>Rows</p>
      </Fold>,
    );
    expect(screen.queryByRole('button', { name: /Show more rows/ })).toBeNull();
  });

  it('cuts long content, and each click shows more until all of it shows', () => {
    vi.stubGlobal('innerHeight', 700);
    sized(3000);
    render(
      <Fold more="Show more rows">
        <p>Rows</p>
      </Fold>,
    );
    expect(clip().style.maxHeight).toBe('448px');
    fireEvent.click(screen.getByRole('button', { name: /Show more rows/ }));
    expect(clip().style.maxHeight).toBe(`${448 + 1400}px`);
    fireEvent.click(screen.getByRole('button', { name: /Show more rows/ }));
    expect(clip().style.maxHeight).toBe('');
    expect(screen.queryByRole('button', { name: /Show more rows/ })).toBeNull();
    vi.unstubAllGlobals();
  });
});
