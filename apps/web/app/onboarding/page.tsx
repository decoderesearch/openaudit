import { Page } from '@/components/page';
import { suggestUsername } from '@/lib/server/handles';
import { requireViewer } from '@/lib/server/viewer';
import { safeReturnTo } from '@/lib/urls';
import { redirect } from 'next/navigation';
import OnboardingForm from './onboarding-form';

export const metadata = { title: 'Get started' };

export default async function OnboardingPage({ searchParams }: { searchParams: Promise<{ returnTo?: string }> }) {
  const returnTo = safeReturnTo((await searchParams).returnTo);
  const viewer = await requireViewer('/onboarding');
  if (viewer.onboardedAt) redirect(returnTo);
  // Sign-in sets the name to the part of the email before "@". Ask for a real one.
  const placeholderName = viewer.email.split('@')[0];
  return (
    <Page width="narrow">
      <OnboardingForm
        returnTo={returnTo}
        initial={{
          username: viewer.username ?? (await suggestUsername(viewer.email, viewer.id)),
          name: viewer.name === placeholderName ? '' : viewer.name,
          affiliation: viewer.affiliation ?? '',
          website: viewer.website ?? '',
        }}
      />
    </Page>
  );
}
