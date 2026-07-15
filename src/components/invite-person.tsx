'use client';

import { useState, useTransition } from 'react';
import { Button, Banner } from '@/components/ui';
import { invitePerson } from '@/app/(app)/people/actions';

/**
 * Sends a Supabase invite email that turns this person record into a user
 * with a login. Shows the result inline since there's nothing to confirm.
 */
export function InvitePerson({ personId, email }: { personId: string; email: string | null }) {
  const [pending, startTransition] = useTransition();
  const [message, setMessage] = useState<{ tone: 'success' | 'error'; text: string } | null>(null);

  if (!email) {
    return (
      <p className="text-sm text-slate-600 dark:text-slate-400">
        Add an email address to this person before inviting them as a user.
      </p>
    );
  }

  return (
    <div className="flex flex-col gap-3">
      <Button
        type="button"
        variant="secondary"
        disabled={pending}
        onClick={() =>
          startTransition(async () => {
            const result = await invitePerson(personId, email);
            setMessage(
              result.error
                ? { tone: 'error', text: result.error }
                : { tone: 'success', text: result.success ?? 'Invite sent.' },
            );
          })
        }
      >
        {pending ? 'Sending invite…' : 'Invite as user'}
      </Button>
      {message && <Banner tone={message.tone}>{message.text}</Banner>}
    </div>
  );
}
