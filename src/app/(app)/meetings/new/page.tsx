import type { Metadata } from 'next';
import { requireAdmin } from '@/lib/auth';
import { PageHeading } from '@/components/ui';
import { MeetingForm } from '@/components/meeting-form';
import { createMeeting } from '../actions';

export const metadata: Metadata = { title: 'Add meeting' };

export default async function NewMeetingPage() {
  await requireAdmin();
  return (
    <div className="flex flex-col gap-6">
      <PageHeading>Add a meeting</PageHeading>
      <MeetingForm action={createMeeting} mode="create" />
    </div>
  );
}
