'use client';

import ProfileFields from '@/components/profile/profile-fields';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import type { ProfileInput } from '@/lib/profile';
import { useRouter } from 'nextjs-toploader/app';
import { useState } from 'react';
import { completeOnboarding } from './actions';

// The profile, then back to where the user was going.
export default function OnboardingForm({ initial, returnTo }: { initial: ProfileInput; returnTo: string }) {
  const router = useRouter();
  const [value, setValue] = useState(initial);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit() {
    setBusy(true);
    setError(null);
    const result = await completeOnboarding(value);
    setBusy(false);
    if (!result.ok) {
      setError(result.error);
      return;
    }
    router.push(returnTo);
    router.refresh();
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-sky-800">Welcome to OpenAudit</CardTitle>
      </CardHeader>
      <CardContent>
        <form
          className="flex flex-col gap-y-4"
          onSubmit={(e) => {
            e.preventDefault();
            void submit();
          }}
        >
          <ProfileFields value={value} onChange={setValue} />
          {error && (
            <div role="alert" className="text-xs text-red-600">
              {error}
            </div>
          )}
          <Button type="submit" disabled={busy} className="sm:self-end">
            {busy ? 'Saving…' : 'Continue'}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}
