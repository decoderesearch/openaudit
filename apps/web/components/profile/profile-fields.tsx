'use client';

import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { HANDLE_MAX } from '@/lib/handles';
import type { ProfileInput } from '@/lib/profile';
import { normalizeWebsite } from '@/lib/urls';

// The profile form fields, shared by onboarding and settings.
export default function ProfileFields({
  value,
  onChange,
  email,
}: {
  value: ProfileInput;
  onChange: (next: ProfileInput) => void;
  email?: string;
}) {
  const set = (key: keyof ProfileInput) => (e: React.ChangeEvent<HTMLInputElement>) =>
    onChange({ ...value, [key]: e.target.value });

  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
      <div className="flex flex-col gap-y-1.5">
        <Label htmlFor="p-username">Username</Label>
        <Input
          id="p-username"
          value={value.username}
          onChange={set('username')}
          autoCapitalize="none"
          autoCorrect="off"
          spellCheck={false}
          maxLength={HANDLE_MAX}
          placeholder="jlin"
          aria-describedby="p-username-hint"
        />
        <span id="p-username-hint" className="text-xs text-slate-500">
          Lowercase letters, digits and underscores. Used as a prefix for your aliases.
        </span>
      </div>
      <div className="flex flex-col gap-y-1.5">
        <Label htmlFor="p-name">Name</Label>
        <Input id="p-name" value={value.name} onChange={set('name')} autoComplete="name" placeholder="Jane Appleseed" />
      </div>
      {email !== undefined && (
        <div className="flex flex-col gap-y-1.5">
          <Label htmlFor="p-email">Email</Label>
          <Input id="p-email" value={email} disabled />
        </div>
      )}
      <div className={email === undefined ? 'flex flex-col gap-y-1.5 sm:col-span-2' : 'flex flex-col gap-y-1.5'}>
        <Label htmlFor="p-affiliation">Affiliation (optional)</Label>
        <Input
          id="p-affiliation"
          value={value.affiliation}
          onChange={set('affiliation')}
          placeholder="University, lab or independent"
        />
      </div>
      <div className="flex flex-col gap-y-1.5 sm:col-span-2">
        <Label htmlFor="p-website">Website (optional)</Label>
        <Input
          id="p-website"
          inputMode="url"
          autoComplete="url"
          value={value.website}
          onChange={set('website')}
          onBlur={() => {
            const website = normalizeWebsite(value.website);
            if (website !== null && website !== value.website) onChange({ ...value, website });
          }}
          placeholder="example.com"
          autoCapitalize="none"
          autoCorrect="off"
          spellCheck={false}
        />
      </div>
    </div>
  );
}
