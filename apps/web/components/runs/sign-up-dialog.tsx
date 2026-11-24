'use client';

import SignInForm from '@/app/signin/sign-in-form';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import type { ReactNode } from 'react';

/** For a guest: a dialog that asks them to sign up before they queue an evaluation, with the email
 * sign-up form. The link in the email brings them back to `returnTo`. */
export function SignUpDialog({
  open,
  onOpenChange,
  returnTo,
  turnstileSiteKey,
  children,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  returnTo: string;
  turnstileSiteKey: string | null;
  /** The trigger. */
  children: ReactNode;
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogTrigger asChild>{children}</DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Sign Up to Queue an Evaluation</DialogTitle>
          <DialogDescription>
            You need a free account to queue a new evaluation. Enter your email, then open the link that we send you to
            confirm it.
          </DialogDescription>
        </DialogHeader>
        <SignInForm returnTo={returnTo} turnstileSiteKey={turnstileSiteKey} bare />
      </DialogContent>
    </Dialog>
  );
}
