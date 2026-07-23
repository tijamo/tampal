import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import Link from 'next/link';
import { requireRegisterAccess } from '@/lib/auth';
import { createClient } from '@/lib/supabase/server';
import { PageHeading } from '@/components/ui';
import { AttendanceRegister, type RegisterPerson } from '@/components/attendance-register';
import { personName } from '@/lib/person';
import type { Meeting, Attendance } from '@/lib/supabase/types';

export const metadata: Metadata = { title: 'Attendance register' };

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

export default async function RegisterPage({
  params,
}: {
  params: { meetingId: string; date: string };
}) {
  const { isAdmin } = await requireRegisterAccess();
  if (!DATE_RE.test(params.date)) notFound();
  const supabase = createClient();

  const { data: meeting } = await supabase
    .from('meetings')
    .select('*')
    .eq('id', params.meetingId)
    .maybeSingle();
  if (!meeting) notFound();
  const m = meeting as Meeting;

  // register_eligible_people already filters to people with a granted
  // attendance-consent, so an admin/register_taker can take the register
  // without needing raw access to the `people`/`consents` tables.
  const [{ data: peopleRows }, { data: attendanceRows }] = await Promise.all([
    supabase
      .from('register_eligible_people')
      .select('*')
      .order('surname', { nullsFirst: false })
      .order('first_name'),
    supabase
      .from('attendance')
      .select('*')
      .eq('meeting_id', params.meetingId)
      .eq('occurrence_date', params.date),
  ]);

  const people =
    (peopleRows as { id: string; first_name: string; surname: string | null }[]) ?? [];
  const attendance = (attendanceRows as Attendance[]) ?? [];
  const presentSet = new Set(attendance.filter((a) => a.present).map((a) => a.person_id));

  const register: RegisterPerson[] = people.map((p) => ({
    id: p.id,
    name: personName(p),
    present: presentSet.has(p.id),
  }));

  return (
    <div className="flex flex-col gap-6">
      <div>
        <Link href={isAdmin ? '/meetings' : '/'} className="text-sm text-brand-700 underline">
          ← Back to {isAdmin ? 'meetings' : 'home'}
        </Link>
        <PageHeading>{m.title}</PageHeading>
        <p className="mt-1 text-slate-600 dark:text-slate-400">
          <time dateTime={params.date}>{formatDate(params.date)}</time>
          {m.location ? ` · ${m.location}` : ''}
        </p>
      </div>

      <AttendanceRegister meetingId={params.meetingId} date={params.date} people={register} />

      <p className="text-sm text-slate-500">
        Only people who have consented to attendance recording are shown. Manage consent from the
        People section.
      </p>
    </div>
  );
}

function formatDate(date: string): string {
  return new Date(`${date}T00:00:00`).toLocaleDateString('en-GB', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });
}
