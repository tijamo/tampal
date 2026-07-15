'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { requireAdmin } from '@/lib/auth';
import { createClient } from '@/lib/supabase/server';
import type { Recurrence } from '@/lib/supabase/types';

export interface MeetingFormState {
  error?: string;
}

const RECURRENCES: Recurrence[] = ['none', 'weekly', 'monthly', 'annually'];

export async function createMeeting(
  _prev: MeetingFormState,
  form: FormData,
): Promise<MeetingFormState> {
  const { userId } = await requireAdmin();
  const supabase = createClient();

  const title = (form.get('title') as string)?.trim();
  const date = form.get('date') as string; // YYYY-MM-DD
  const time = (form.get('time') as string) || '10:30';
  const recurrence = form.get('recurrence') as Recurrence;

  if (!title) return { error: 'A title is required.' };
  if (!date) return { error: 'A start date is required.' };
  if (!RECURRENCES.includes(recurrence)) return { error: 'Choose how often it repeats.' };

  const startsAt = new Date(`${date}T${time}:00`);
  if (Number.isNaN(startsAt.getTime())) return { error: 'The start date or time is invalid.' };

  const untilRaw = (form.get('recurrence_until') as string)?.trim();
  const duration = parseInt((form.get('duration_minutes') as string) || '90', 10);

  const { error } = await supabase.from('meetings').insert({
    title,
    description: ((form.get('description') as string) || '').trim() || null,
    location: ((form.get('location') as string) || '').trim() || null,
    starts_at: startsAt.toISOString(),
    duration_minutes: Number.isFinite(duration) && duration > 0 ? duration : 90,
    recurrence,
    recurrence_until: recurrence !== 'none' && untilRaw ? untilRaw : null,
    created_by: userId,
  });

  if (error) return { error: 'Could not create the meeting. Please try again.' };

  revalidatePath('/meetings');
  redirect('/meetings');
}

export async function updateMeeting(
  _prev: MeetingFormState,
  form: FormData,
): Promise<MeetingFormState> {
  await requireAdmin();
  const supabase = createClient();

  const id = form.get('id') as string;
  if (!id) return { error: 'Missing meeting id.' };

  const title = (form.get('title') as string)?.trim();
  const date = form.get('date') as string; // YYYY-MM-DD
  const time = (form.get('time') as string) || '10:30';
  const recurrence = form.get('recurrence') as Recurrence;

  if (!title) return { error: 'A title is required.' };
  if (!date) return { error: 'A start date is required.' };
  if (!RECURRENCES.includes(recurrence)) return { error: 'Choose how often it repeats.' };

  const startsAt = new Date(`${date}T${time}:00`);
  if (Number.isNaN(startsAt.getTime())) return { error: 'The start date or time is invalid.' };

  const untilRaw = (form.get('recurrence_until') as string)?.trim();
  const duration = parseInt((form.get('duration_minutes') as string) || '90', 10);

  const { error } = await supabase
    .from('meetings')
    .update({
      title,
      description: ((form.get('description') as string) || '').trim() || null,
      location: ((form.get('location') as string) || '').trim() || null,
      starts_at: startsAt.toISOString(),
      duration_minutes: Number.isFinite(duration) && duration > 0 ? duration : 90,
      recurrence,
      recurrence_until: recurrence !== 'none' && untilRaw ? untilRaw : null,
    })
    .eq('id', id);

  if (error) return { error: 'Could not update the meeting. Please try again.' };

  revalidatePath('/meetings');
  redirect('/meetings');
}

/** Soft-remove: archive so historical attendance stays intact and auditable. */
export async function archiveMeeting(meetingId: string) {
  await requireAdmin();
  const supabase = createClient();
  await supabase.from('meetings').update({ archived: true }).eq('id', meetingId);
  revalidatePath('/meetings');
}
