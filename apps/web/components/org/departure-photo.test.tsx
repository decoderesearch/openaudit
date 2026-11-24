import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { Photo } from './departure-photo';

const photo = {
  url: 'https://upload.wikimedia.org/wikipedia/commons/4/4d/Dawn_Song.jpg',
  pageUrl: 'https://commons.wikimedia.org/wiki/File:Dawn_Song.jpg',
  license: 'CC BY-SA 4.0',
  author: 'Xuthoria',
};

describe('Photo', () => {
  it('shows our copy, then the Commons thumbnail, then the initials', () => {
    // jsdom does not load images; here they are still loading.
    vi.spyOn(HTMLImageElement.prototype, 'complete', 'get').mockReturnValue(false);
    render(<Photo photo={photo} name="Dawn Song" />);
    expect(screen.getByRole('img').getAttribute('src')).toBe('/photos/120px-Dawn_Song.jpg');
    fireEvent.error(screen.getByRole('img'));
    expect(screen.getByRole('img').getAttribute('src')).toBe(
      'https://upload.wikimedia.org/wikipedia/commons/thumb/4/4d/Dawn_Song.jpg/120px-Dawn_Song.jpg',
    );
    fireEvent.error(screen.getByRole('img'));
    expect(screen.queryByRole('img')).toBeNull();
    expect(screen.getByText('DS')).toBeTruthy();
  });
});
