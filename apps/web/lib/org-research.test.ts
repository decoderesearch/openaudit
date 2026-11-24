import { describe, expect, it } from 'vitest';
import {
  commonsThumb,
  firstSourceDate,
  formatDate,
  formatLongDate,
  formatShortDate,
  hostOf,
  incidentDate,
  initials,
  localPhoto,
  plainText,
  storyUrl,
} from './org-research';

describe('org research helpers', () => {
  it('formats a date only as exactly as its precision', () => {
    expect(formatDate('2024-07-04', 'day')).toBe('Jul 4, 2024');
    expect(formatDate('2023-04', 'month')).toBe('Apr 2023');
    expect(formatDate('2023', 'year')).toBe('2023');
    expect(formatDate('2023-04')).toBe('Apr 2023');
    expect(formatDate(null)).toBeNull();
  });

  it('formats a long date with the full month', () => {
    expect(formatLongDate('2026-10-02', 2027)).toBe('October 2, 2026');
    expect(formatLongDate('2026-05-11', 2027)).toBe('May 11, 2026');
    expect(formatLongDate('2026-08', 2027)).toBe('August 2026');
    expect(formatLongDate('2026', 2027)).toBe('2026');
  });

  it('leaves out the year of a long date in this year', () => {
    expect(formatLongDate('2026-10-02', 2026)).toBe('October 2');
    expect(formatLongDate('2026-08', 2026)).toBe('August');
    expect(formatLongDate('2026', 2026)).toBe('2026');
  });

  it('gives a short date, with the year only when it is not this year', () => {
    expect(formatShortDate('2026-10-23', 2026)).toBe('Oct 23');
    expect(formatShortDate('2025-10-02', 2026)).toBe('Oct 2, 2025');
    expect(formatShortDate('2026-08', 2026)).toBe('Aug');
    expect(formatShortDate('2025-08', 2026)).toBe('Aug 2025');
  });

  it('makes plain text from Markdown', () => {
    expect(plainText('A **hacker** [reportedly](https://x.example) got in.\n\nMore.')).toBe(
      'A hacker reportedly got in. More.',
    );
  });

  it('makes Commons thumbnails for photos only', () => {
    expect(commonsThumb('https://upload.wikimedia.org/wikipedia/commons/a/ab/Jan_Leike.jpg')).toBe(
      'https://upload.wikimedia.org/wikipedia/commons/thumb/a/ab/Jan_Leike.jpg/330px-Jan_Leike.jpg',
    );
    const svg = 'https://upload.wikimedia.org/wikipedia/commons/a/ab/X.svg';
    expect(commonsThumb(svg)).toBe(svg);
  });

  it('names our copy of a Commons thumbnail with safe characters', () => {
    const url = 'https://upload.wikimedia.org/wikipedia/commons/d/d4/Ilya_and_Sam_%28cropped%29.jpg';
    expect(localPhoto(url, 120)).toBe('/photos/120px-Ilya_and_Sam__cropped_.jpg');
    expect(localPhoto('https://upload.wikimedia.org/wikipedia/commons/a/ab/X.svg', 120)).toBeNull();
  });

  it('links a story to its newest dated source, else its first', () => {
    const a = { url: 'https://a.com', date: '2026-06-17' };
    const b = { url: 'https://b.com', date: '2026-07' };
    const c = { url: 'https://c.com' };
    expect(storyUrl([a, c], [b])).toBe('https://b.com');
    expect(storyUrl([c, { url: 'https://d.com' }])).toBe('https://c.com');
    expect(storyUrl([], null, 'x', [{ title: 'no url' }])).toBeUndefined();
  });

  it('gives the earliest full date of the sources', () => {
    const list = [{ date: '2026-11-12' }, { date: '2026-11' }, { date: '2026-11-04' }, {}];
    expect(firstSourceDate(list)).toBe('2026-11-04');
    expect(firstSourceDate([{ date: '2026-11' }])).toBeNull();
    expect(firstSourceDate(null)).toBeNull();
  });

  it('adds the disclosure date to an incident date only when it came later', () => {
    const day = { date: '2026-08-20', datePrecision: 'day' as const };
    expect(incidentDate({ ...day, disclosed: '2026-11-04' })).toBe('Aug 20 · Disclosed Nov 4, 2026');
    expect(incidentDate({ ...day, disclosed: '2027-01-02' })).toBe('Aug 20, 2026 · Disclosed Jan 2, 2027');
    expect(incidentDate({ ...day, disclosed: '2026-11-04' }, true)).toBe('Aug 20 · Disclosed Nov 4');
    expect(incidentDate({ ...day, disclosed: '2026-08-20' })).toBe('Aug 20, 2026');
    expect(incidentDate({ ...day, disclosed: null })).toBe('Aug 20, 2026');
    const month = { date: '2026-05', datePrecision: 'month' as const };
    expect(incidentDate({ ...month, disclosed: '2026-05-30' })).toBe('May 2026');
    expect(incidentDate({ ...month, disclosed: '2026-09-04' })).toBe('May 2026 · Disclosed Sep 4, 2026');
  });

  it('initials and hosts', () => {
    expect(initials('Jan Leike')).toBe('JL');
    expect(initials('Ilya  Sutskever (co-founder)')).toBe('IS');
    expect(hostOf('https://www.openai.com/about')).toBe('openai.com');
  });
});
