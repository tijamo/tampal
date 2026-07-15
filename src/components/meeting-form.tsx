'use client';

import { useState } from 'react';
import { useFormState, useFormStatus } from 'react-dom';
import { Button, Field, Banner, Card } from '@/components/ui';
import type { MeetingFormState } from '@/app/(app)/meetings/actions';
import type { Meeting, Recurrence } from '@/lib/supabase/types';

const RECURRENCE_OPTIONS: { value: Recurrence; label: string }[] = [
  { value: 'none', label: 'Does not repeat' },
  { value: 'weekly', label: 'Every week' },
  { value: 'monthly', label: 'Every month' },
  { value: 'annually', label: 'Every year' },
];

function SubmitButton({ label }: { label: string }) {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" disabled={pending}>
      {pending ? 'Saving…' : label}
    </Button>
  );
}

/** Splits a stored UTC `starts_at` back into the server-local date/time the
 * create form originally submitted (mirrors the `${date}T${time}:00` -> UTC
 * conversion in the actions). */
function localDateTimeParts(iso: string): { date: string; time: string } {
  const d = new Date(iso);
  const pad = (n: number) => String(n).padStart(2, '0');
  return {
    date: `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`,
    time: `${pad(d.getHours())}:${pad(d.getMinutes())}`,
  };
}

export function MeetingForm({
  action,
  meeting,
  mode,
}: {
  action: (prev: MeetingFormState, form: FormData) => Promise<MeetingFormState>;
  meeting?: Meeting;
  mode: 'create' | 'edit';
}) {
  const [state, formAction] = useFormState(action, {});
  const [recurrence, setRecurrence] = useState<Recurrence>(meeting?.recurrence ?? 'weekly');
  const { date, time } = meeting
    ? localDateTimeParts(meeting.starts_at)
    : { date: '', time: '10:30' };

  return (
    <form action={formAction} className="flex flex-col gap-6" noValidate>
      {meeting && <input type="hidden" name="id" value={meeting.id} />}
      {state.error && <Banner tone="error">{state.error}</Banner>}

      <Card className="flex flex-col gap-4">
        <Field label="Title" name="title" required defaultValue={meeting?.title ?? ''} />
        <Field label="Location" name="location" defaultValue={meeting?.location ?? ''} />
        <Field label="Description" name="description" defaultValue={meeting?.description ?? ''} />
      </Card>

      <Card className="flex flex-col gap-4">
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Field label="First date" name="date" type="date" required defaultValue={date} />
          <Field label="Start time" name="time" type="time" defaultValue={time} />
        </div>
        <Field
          label="Duration (minutes)"
          name="duration_minutes"
          type="number"
          min={1}
          defaultValue={meeting?.duration_minutes ?? 90}
        />

        <div className="flex flex-col gap-1">
          <label htmlFor="recurrence" className="font-medium">
            Repeats
          </label>
          <select
            id="recurrence"
            name="recurrence"
            value={recurrence}
            onChange={(e) => setRecurrence(e.target.value as Recurrence)}
            className="min-h-touch rounded-md border border-slate-400 bg-white px-3 py-2 dark:border-slate-600 dark:bg-slate-950"
          >
            {RECURRENCE_OPTIONS.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </select>
        </div>

        {recurrence !== 'none' && (
          <Field
            label="Repeat until (optional)"
            name="recurrence_until"
            type="date"
            hint="Leave blank to repeat indefinitely."
            defaultValue={meeting?.recurrence_until ?? ''}
          />
        )}
      </Card>

      <div>
        <SubmitButton label={mode === 'create' ? 'Add meeting' : 'Save changes'} />
      </div>
    </form>
  );
}
