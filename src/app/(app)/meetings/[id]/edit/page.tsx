import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { requireAdmin } from '@/lib/auth';
import { createClient } from '@/lib/supabase/server';
import { PageHeading } from '@/components/ui';
import { MeetingForm } from '@/components/meeting-form';
import { updateMeeting } from '../../actions';
import type { Meeting } from '@/lib/supabase/types';

export const metadata: Metadata = { title: 'Edit meeting' };

export default async function EditMeetingPage({ params }: { params: { id: string } }) {
  await requireAdmin();
  const supabase = createClient();
  const { data } = await supabase.from('meetings').select('*').eq('id', params.id).maybeSingle();

  if (!data) notFound();

  return (
    <div className="flex flex-col gap-6">
      <PageHeading>Edit meeting</PageHeading>
      <MeetingForm action={updateMeeting} meeting={data as Meeting} mode="edit" />
    </div>
  );
}
