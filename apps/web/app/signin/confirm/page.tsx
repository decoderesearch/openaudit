import Link from '@/components/link';
import { Page } from '@/components/page';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { prisma } from '@/lib/db';
import { SIGN_IN_ENABLED, SITE_NAME } from '@/lib/env';
import { SIGN_IN_CONFIRM_POST, VERIFY_PARAMS } from '@/lib/sign-in';
import { LogIn } from 'lucide-react';
import { notFound } from 'next/navigation';

export const metadata = { title: 'Sign in', robots: { index: false } };

type Params = Partial<Record<(typeof VERIFY_PARAMS)[number], string>>;

// The email address a sign-in token is for, or null when the token is used or expired.
async function pendingEmail(token: string): Promise<string | null> {
  const row = await prisma.verification.findFirst({
    where: { identifier: token, expiresAt: { gt: new Date() } },
    select: { value: true },
  });
  if (!row) return null;
  try {
    const email = (JSON.parse(row.value) as { email?: unknown }).email;
    return typeof email === 'string' ? email : null;
  } catch {
    return null;
  }
}

// The sign-in email links here. Opening the page changes nothing; the button signs in.
export default async function ConfirmSignInPage({ searchParams }: { searchParams: Promise<Params> }) {
  if (!SIGN_IN_ENABLED) notFound();
  const params = await searchParams;
  const email = params.token ? await pendingEmail(params.token) : null;

  return (
    <Page width="narrow">
      <div className="pt-6 sm:pt-12">
        <Card>
          {email ? (
            <>
              <CardHeader>
                <CardTitle className="text-sky-800">Sign in to {SITE_NAME}</CardTitle>
                <CardDescription>
                  As <span className="font-medium break-all text-slate-700">{email}</span>
                </CardDescription>
              </CardHeader>
              <CardContent>
                <form method="post" action={SIGN_IN_CONFIRM_POST}>
                  {VERIFY_PARAMS.map((key) =>
                    params[key] ? <input key={key} type="hidden" name={key} value={params[key]} /> : null,
                  )}
                  <Button type="submit" className="w-full">
                    <LogIn />
                    Sign in
                  </Button>
                </form>
              </CardContent>
            </>
          ) : (
            <>
              <CardHeader>
                <CardTitle className="text-sky-800">This link does not work</CardTitle>
                <CardDescription>It was used already, or it expired. A link works once, for 5 minutes.</CardDescription>
              </CardHeader>
              <CardContent>
                <Button asChild className="w-full">
                  <Link href="/signin">Get a new link</Link>
                </Button>
              </CardContent>
            </>
          )}
        </Card>
      </div>
    </Page>
  );
}
