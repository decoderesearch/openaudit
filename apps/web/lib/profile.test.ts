import { describe, expect, it } from 'vitest';
import { firstIssue, ProfileSchema } from './profile';

const base = { username: 'jlin', name: 'Johnny', affiliation: '', website: '' };

describe('ProfileSchema', () => {
  it('normalizes the username and trims fields', () => {
    const out = ProfileSchema.parse({ ...base, username: ' JLin ', name: ' Johnny ' });
    expect(out.username).toBe('jlin');
    expect(out.name).toBe('Johnny');
  });

  it('reports the handle rule', () => {
    const r = ProfileSchema.safeParse({ ...base, username: 'admin' });
    expect(r.success).toBe(false);
    if (!r.success) expect(firstIssue(r.error)).toBe('Username: This name is reserved.');
  });

  it('requires a name and a web address for the website', () => {
    expect(ProfileSchema.safeParse({ ...base, name: ' ' }).success).toBe(false);
    expect(ProfileSchema.parse({ ...base, website: 'example.com' }).website).toBe('https://example.com');
    expect(ProfileSchema.parse({ ...base, website: 'https://example.com' }).website).toBe('https://example.com');
    const r = ProfileSchema.safeParse({ ...base, website: 'javascript:alert(1)' });
    expect(r.success).toBe(false);
    if (!r.success) expect(firstIssue(r.error)).toBe('Website: enter a web address, like example.com.');
  });
});
