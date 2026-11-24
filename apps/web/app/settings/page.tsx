import { Page, PageHeader } from '@/components/page';
import { getSubscription, updatesOff } from '@/lib/server/updates';
import { requireOnboarded } from '@/lib/server/viewer';
import ApiKeysPanel from './api-keys-panel';
import ProfilePanel from './profile-panel';
import UpdatesPanel from './updates-panel';

export const metadata = { title: 'Settings' };

export default async function SettingsPage() {
  const viewer = await requireOnboarded('/settings');
  const lists = updatesOff()
    ? null
    : await getSubscription(viewer.email.toLowerCase())
        .then((s) => s.lists)
        .catch((e) => {
          console.error('[updates] read failed', e);
          return null;
        });
  return (
    <Page>
      <PageHeader title="Settings" />
      <div className="grid grid-cols-1 items-start gap-5 lg:grid-cols-2">
        <ProfilePanel
          email={viewer.email}
          initial={{
            username: viewer.username ?? '',
            name: viewer.name,
            affiliation: viewer.affiliation ?? '',
            website: viewer.website ?? '',
          }}
        />
        <div className="flex flex-col gap-5">
          <UpdatesPanel email={viewer.email} initial={lists} />
          <ApiKeysPanel />
        </div>
      </div>
    </Page>
  );
}
