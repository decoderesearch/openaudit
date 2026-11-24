import { Page } from '@/components/page';
import { SIGN_IN_ENABLED, TURNSTILE_ENABLED, TURNSTILE_SITE_KEY } from '@/lib/env';
import { getViewer } from '@/lib/server/viewer';
import { safeReturnTo } from '@/lib/urls';
import { notFound, redirect } from 'next/navigation';
import SignInForm from './sign-in-form';

export const metadata = { title: 'Sign in' };

export default async function SignInPage({ searchParams }: { searchParams: Promise<{ returnTo?: string }> }) {
  if (!SIGN_IN_ENABLED) notFound();
  const returnTo = safeReturnTo((await searchParams).returnTo);
  const viewer = await getViewer();
  if (viewer) redirect(viewer.onboardedAt ? returnTo : `/onboarding?returnTo=${encodeURIComponent(returnTo)}`);
  return (
    <Page width="narrow">
      <div className="pt-6 sm:pt-12">
        <SignInForm returnTo={returnTo} turnstileSiteKey={TURNSTILE_ENABLED ? TURNSTILE_SITE_KEY : null} />
      </div>
    </Page>
  );
}
