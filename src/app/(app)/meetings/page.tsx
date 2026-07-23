import type { Metadata } from 'next';
import { requireAdmin } from '@/lib/auth';
import { createClient } from '@/lib/supabase/server';
import { LinkButton, Card, PageHeading } from '@/components/ui';
import { ArchiveMeeting } from '@/components/archive-meeting';
import { nextOccurrence } from '@/lib/recurrence';
import type { Meeting, Recurrence } from '@/lib/supabase/types';

export const metadata: Metadata = { title: 'Meetings' };

const RECURRENCE_LABEL: Record<Recurrence, string> = {
  none: 'One-off',
  weekly: 'Weekly',
  monthly: 'Monthly',
  annually: 'Annually',
};

export default async function MeetingsPage() {
  await requireAdmin();
  const supabase = createClient();

  const { data } = await supabase
    .from('meetings')
    .select('*')
    .eq('archived', false)
    .order('starts_at');
  const meetings = (data as Meeting[]) ?? [];

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <PageHeading>Meetings</PageHeading>
        <LinkButton href="/meetings/new">Add meeting</LinkButton>
      </div>

      {meetings.length === 0 ? (
        <Card>
          <p className="text-slate-600 dark:text-slate-400">No meetings yet.</p>
        </Card>
      ) : (
        <ul className="flex flex-col gap-3">
          {meetings.map((m) => {
            const next = nextOccurrence(m);
            return (
              <li key={m.id}>
                <Card className="flex flex-col gap-3">
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <div>
                      <h2 className="text-lg font-semibold">{m.title}</h2>
                      <p className="text-sm text-slate-600 dark:text-slate-400">
                        {RECURRENCE_LABEL[m.recurrence]}
                        {m.location ? ` · ${m.location}` : ''}
                      </p>
                    </div>
                    <span className="rounded-full bg-brand-50 px-3 py-1 text-sm text-brand-800 dark:bg-slate-800 dark:text-brand-100">
                      {next ? formatDate(next.date) : 'No upcoming date'}
                    </span>
                  </div>
                  {m.description && <p className="text-sm">{m.description}</p>}
                  <div className="flex flex-wrap gap-3">
                    {next && (
                      <LinkButton href={`/register/${m.id}/${next.date}`}>
                        Take register
                      </LinkButton>
                    )}
                    <LinkButton variant="secondary" href={`/meetings/${m.id}/edit`}>
                      Edit
                    </LinkButton>
                    <ArchiveMeeting meetingId={m.id} title={m.title} />
                  </div>
                </Card>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}

function formatDate(date: string): string {
  return new Date(`${date}T00:00:00`).toLocaleDateString('en-GB', {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });
}
