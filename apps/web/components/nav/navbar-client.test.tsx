import type { Viewer } from '@/lib/server/viewer';
import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import NavbarClient from './navbar-client';

vi.mock('next/navigation', () => ({
  usePathname: () => '/',
  useSearchParams: () => new URLSearchParams(),
  useRouter: () => ({ push: vi.fn(), refresh: vi.fn() }),
}));
vi.mock('nextjs-toploader/app', () => ({ useRouter: () => ({ push: vi.fn(), refresh: vi.fn() }) }));
vi.mock('@/lib/auth-client', () => ({ signOut: vi.fn(async () => undefined) }));

const viewer = (role: Viewer['role']): Viewer => ({
  id: 'u1',
  email: 'a@example.com',
  name: 'A',
  username: 'a',
  role,
  banned: false,
  onboardedAt: new Date('2026-01-01'),
  affiliation: null,
  website: null,
});

const show = (v: Viewer, adminTodo?: number) =>
  render(<NavbarClient viewer={v} signIn menus={{ orgs: null, methods: null }} adminTodo={adminTodo} />);

describe('account button', () => {
  it('shows an admin the count of admin work that waits', () => {
    show(viewer('admin'), 3);
    const buttons = screen.getAllByRole('button', { name: 'Account: 3 admin tasks' });
    expect(buttons.length).toBeGreaterThan(0);
    for (const b of buttons) expect(b.textContent).toBe('3');
  });

  it('shows no count when nothing waits', () => {
    show(viewer('admin'), 0);
    for (const b of screen.getAllByRole('button', { name: 'Account' })) expect(b.textContent).toBe('');
  });

  it('shows no count to a user who is not an admin', () => {
    show(viewer('moderator'), 5);
    expect(screen.queryAllByRole('button', { name: /admin task/ })).toEqual([]);
  });

  it('caps a large count', () => {
    show(viewer('admin'), 150);
    for (const b of screen.getAllByRole('button', { name: 'Account: 150 admin tasks' }))
      expect(b.textContent).toBe('99+');
  });
});
