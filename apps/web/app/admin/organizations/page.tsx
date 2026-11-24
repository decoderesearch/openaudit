import { hideModelAction, hideOrganizationAction } from '@/app/admin/organizations/actions';
import { ConfirmActionButton } from '@/components/admin/confirm-action-button';
import { Section } from '@/components/catalog/parts';
import Link from '@/components/link';
import { Page, PageHeader } from '@/components/page';
import { adminHiddenModels, adminOrganizations } from '@/lib/server/org-admin';
import { getViewer, isAdmin } from '@/lib/server/viewer';
import { cn } from '@/lib/utils';
import type { Metadata } from 'next';
import { notFound } from 'next/navigation';

export const metadata: Metadata = { title: 'Organizations', robots: { index: false, follow: false } };

// Admins only. Other viewers get 404, so the page does not show that it exists.
export default async function AdminOrganizationsPage() {
  if (!isAdmin(await getViewer())) notFound();
  const [orgs, models] = await Promise.all([adminOrganizations(), adminHiddenModels()]);
  const th = 'px-2 py-1.5 font-medium whitespace-nowrap';
  const td = 'px-2 py-1 align-middle';
  return (
    <Page>
      <PageHeader
        eyebrow={
          <Link href="/admin" className="hover:text-sky-700">
            Admin
          </Link>
        }
        title="Organizations"
        description="Hide removes an organization and its models from the map, lists, feeds and search. Their pages show only to admins. Hide does not unpublish OpenAudits; do that on the OpenAudits page. The map, menus and feeds can take 5 minutes to change."
      />
      <Section title={`Organizations (${orgs.length})`}>
        <div className="overflow-x-auto rounded-md border border-slate-200 bg-white">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-50 text-slate-500">
              <tr>
                <th className={th}>Organization</th>
                <th className={cn(th, 'text-right')}>Models</th>
                <th className={th}>Published OpenAudits</th>
                <th className={th}>State</th>
                <th className={th} />
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {orgs.map((o) => (
                <tr key={o.id} className={cn('hover:bg-slate-50', o.hidden && 'bg-amber-50/40')}>
                  <td className={td}>
                    <Link href={o.href} className="font-medium text-sky-800 hover:underline">
                      {o.displayName}
                    </Link>
                    <span className="ml-1.5 text-slate-500">{o.slug}</span>
                  </td>
                  <td className={cn(td, 'text-right text-slate-600 tabular-nums')}>{o.models}</td>
                  <td className={cn(td, 'text-slate-600')}>{o.published.join(', ') || '—'}</td>
                  <td className={td}>
                    {o.hidden ? (
                      <span className="font-medium text-amber-800">Hidden</span>
                    ) : (
                      <span className="text-slate-500">Shown</span>
                    )}
                  </td>
                  <td className={cn(td, 'text-right')}>
                    <ConfirmActionButton
                      action={hideOrganizationAction.bind(null, o.id, !o.hidden)}
                      label={o.hidden ? 'Show' : 'Hide'}
                      confirm={
                        o.hidden
                          ? `Show ${o.displayName} and its models to the public again?`
                          : `Hide ${o.displayName} and its ${o.models} models from the public?${o.published.length ? ` Its published OpenAudits stay published; unpublish them on the OpenAudits page.` : ''}`
                      }
                      done={o.hidden ? 'Shown.' : 'Hidden.'}
                    />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Section>
      <Section title={`Hidden Models (${models.length})`}>
        <p className="mb-2 text-xs text-slate-500">
          A hidden model, its page and its runs show only to admins. Hide a model on its page.
        </p>
        {models.length > 0 && (
          <div className="overflow-x-auto rounded-md border border-slate-200 bg-white">
            <table className="w-full text-left text-xs">
              <tbody className="divide-y divide-slate-100">
                {models.map((m) => (
                  <tr key={m.id} className="hover:bg-slate-50">
                    <td className={td}>
                      <Link href={m.href} className="font-medium text-sky-800 hover:underline">
                        {m.displayName}
                      </Link>
                      <span className="ml-1.5 text-slate-500">{m.name}</span>
                    </td>
                    <td className={cn(td, 'text-slate-600')}>{m.organization.displayName}</td>
                    <td className={cn(td, 'text-right')}>
                      <ConfirmActionButton
                        action={hideModelAction.bind(null, m.id, false)}
                        label="Show"
                        confirm={`Show ${m.displayName}, its page and its runs to the public again?`}
                        done="Shown."
                      />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Section>
    </Page>
  );
}
