import { UserRoleControl } from '@/components/admin/user-role-control';
import { Section } from '@/components/catalog/parts';
import Link from '@/components/link';
import { LocalTime } from '@/components/local-time';
import { Page, PageHeader } from '@/components/page';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { adminUsers, USERS_SHOWN } from '@/lib/server/user-admin';
import { getViewer, isAdmin } from '@/lib/server/viewer';
import { cn } from '@/lib/utils';
import type { Metadata } from 'next';
import { notFound } from 'next/navigation';

export const metadata: Metadata = { title: 'Users', robots: { index: false, follow: false } };

// Admins only. Other viewers get 404, so the page does not show that it exists.
export default async function AdminUsersPage({ searchParams }: { searchParams: Promise<{ q?: string }> }) {
  const viewer = await getViewer();
  if (!viewer || !isAdmin(viewer)) notFound();
  const { q } = await searchParams;
  const { users, total } = await adminUsers(q);
  const th = 'px-2 py-1.5 font-medium whitespace-nowrap';
  const td = 'px-2 py-1.5 align-middle';
  return (
    <Page>
      <PageHeader
        eyebrow={
          <Link href="/admin" className="hover:text-sky-700">
            Admin
          </Link>
        }
        title="Users"
        description="Moderators can start runs that the site's OpenRouter key pays for, with no approval. Admins can do that too, and use the admin pages. You cannot change your own role."
      />
      <form action="/admin/users" className="flex gap-2">
        <Input
          name="q"
          type="search"
          defaultValue={q}
          placeholder="Search by email, name or handle"
          className="max-w-sm"
        />
        <Button type="submit" variant="outline">
          Search
        </Button>
      </form>
      <Section title={total > users.length ? `Users (first ${USERS_SHOWN} of ${total})` : `Users (${total})`}>
        {users.length ? (
          <div className="overflow-x-auto rounded-md border border-slate-200 bg-white">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 text-slate-500">
                <tr>
                  <th className={th}>User</th>
                  <th className={th}>Joined</th>
                  <th className={th}>Role</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {users.map((u) => (
                  <tr key={u.id} className={cn('hover:bg-slate-50', u.banned && 'opacity-60')}>
                    <td className={td}>
                      <div className="font-medium text-slate-800">
                        {u.email}
                        {u.id === viewer.id && <span className="ml-1.5 font-normal text-slate-400">(you)</span>}
                        {u.banned && <span className="ml-1.5 font-normal text-rose-700">Banned</span>}
                      </div>
                      <div className="text-slate-500">
                        {u.name}
                        {u.username && <span className="text-slate-400"> · @{u.username}</span>}
                      </div>
                    </td>
                    <td className={cn(td, 'whitespace-nowrap text-slate-500')}>
                      <LocalTime value={u.createdAt} />
                    </td>
                    <td className={td}>
                      <UserRoleControl userId={u.id} email={u.email} role={u.role} self={u.id === viewer.id} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <p className="text-sm text-slate-500">No users match.</p>
        )}
      </Section>
    </Page>
  );
}
