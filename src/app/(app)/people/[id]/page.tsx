import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { requireAdmin } from '@/lib/auth';
import { createClient } from '@/lib/supabase/server';
import { LinkButton, Card, PageHeading } from '@/components/ui';
import { ToggleSwitch } from '@/components/toggle-switch';
import { ErasePerson } from '@/components/erase-person';
import { InvitePerson } from '@/components/invite-person';
import { setConsent, setUserRole } from '../actions';
import { latestConsent } from '@/lib/consent';
import { personName } from '@/lib/person';
import type { Person, Consent, Profile, Family } from '@/lib/supabase/types';

export const metadata: Metadata = { title: 'Person' };

export default async function PersonDetailPage({ params }: { params: { id: string } }) {
  const { userId } = await requireAdmin();
  const supabase = createClient();

  const { data: person } = await supabase
    .from('people')
    .select('*')
    .eq('id', params.id)
    .is('deleted_at', null)
    .maybeSingle();

  if (!person) notFound();
  const p = person as Person;

  const [{ data: consentRows }, { data: linkedProfileRow }, { data: familyRow }] =
    await Promise.all([
      supabase.from('consents').select('*').eq('person_id', p.id),
      supabase.from('profiles').select('user_id, role').eq('person_id', p.id).maybeSingle(),
      p.family_id
        ? supabase.from('families').select('*, people(*)').eq('id', p.family_id).maybeSingle()
        : Promise.resolve({ data: null }),
    ]);
  const consents = (consentRows as Consent[]) ?? [];
  const linkedProfile = linkedProfileRow as Pick<Profile, 'user_id' | 'role'> | null;
  const family = familyRow as (Family & { people: Person[] }) | null;
  const familyMembers = (family?.people ?? []).filter((m) => !m.deleted_at && m.id !== p.id);

  const contact = [
    p.email,
    p.phone,
    p.address_line1,
    p.address_line2,
    p.city,
    p.postcode,
    p.notes,
    p.birthdate,
    p.join_date,
    p.baptism_date,
    p.home_church,
    p.talents_hobbies,
    ...p.tags,
  ].filter(Boolean);

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <PageHeading>{personName(p)}</PageHeading>
          <p className="mt-1 capitalize text-slate-600 dark:text-slate-400">{p.person_type}</p>
        </div>
        <LinkButton variant="secondary" href={`/people/${p.id}/edit`}>
          Edit
        </LinkButton>
      </div>

      <section aria-labelledby="contact-heading">
        <h2 id="contact-heading" className="mb-2 text-xl font-semibold">
          Contact details
        </h2>
        <Card>
          {contact.length === 0 ? (
            <p className="text-slate-600 dark:text-slate-400">No contact details stored.</p>
          ) : (
            <dl className="grid grid-cols-1 gap-2 sm:grid-cols-[8rem_1fr]">
              {p.email && <Row label="Email" value={p.email} />}
              {p.phone && <Row label="Phone" value={p.phone} />}
              {(p.address_line1 || p.city || p.postcode) && (
                <Row
                  label="Address"
                  value={[p.address_line1, p.address_line2, p.city, p.postcode]
                    .filter(Boolean)
                    .join(', ')}
                />
              )}
              {p.notes && <Row label="Notes" value={p.notes} />}
              {p.birthdate && <Row label="Date of birth" value={p.birthdate} />}
              {p.join_date && <Row label="Join date" value={p.join_date} />}
              {p.baptism_date && (
                <Row
                  label="Baptism"
                  value={[p.baptism_date, p.baptism_location].filter(Boolean).join(' — ')}
                />
              )}
              {p.home_church && <Row label="Home church" value={p.home_church} />}
              {p.talents_hobbies && <Row label="Talents/hobbies" value={p.talents_hobbies} />}
              {p.tags.length > 0 && <Row label="Tags" value={p.tags.join(', ')} />}
            </dl>
          )}
        </Card>
      </section>

      {family && (
        <section aria-labelledby="family-heading">
          <h2 id="family-heading" className="mb-2 text-xl font-semibold">
            Family
          </h2>
          <Card className="flex flex-col gap-2">
            <div className="flex items-center justify-between gap-3">
              <p className="font-medium">{family.name}</p>
              <Link href="/families" className="text-brand-700 underline">
                Manage families
              </Link>
            </div>
            {family.primary_contact_person_id === p.id && (
              <p className="text-sm text-slate-600 dark:text-slate-400">
                {personName(p)} is the primary contact for this family.
              </p>
            )}
            {familyMembers.length > 0 && (
              <ul className="flex flex-col gap-1">
                {familyMembers.map((m) => (
                  <li key={m.id}>
                    <Link href={`/people/${m.id}`} className="text-brand-700 underline">
                      {personName(m)}
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </Card>
        </section>
      )}

      <section aria-labelledby="consent-heading">
        <h2 id="consent-heading" className="mb-2 text-xl font-semibold">
          Consent
        </h2>
        <Card className="flex flex-col divide-y divide-slate-200 dark:divide-slate-800">
          <ToggleSwitch
            id="attendance_records"
            label="Record attendance at meetings (reveals religious belief)"
            granted={latestConsent(consents, 'attendance_records')}
            onToggle={setConsent.bind(null, p.id, 'attendance_records')}
          />
          <ToggleSwitch
            id="contact_storage"
            label="Store contact and address details"
            granted={latestConsent(consents, 'contact_storage')}
            onToggle={setConsent.bind(null, p.id, 'contact_storage')}
          />
        </Card>
      </section>

      <section aria-labelledby="account-heading">
        <h2 id="account-heading" className="mb-2 text-xl font-semibold">
          User account
        </h2>
        <Card className="flex flex-col gap-3">
          {linkedProfile ? (
            <>
              <p className="text-sm text-slate-600 dark:text-slate-400">
                This person has a login
                {linkedProfile.role === 'admin' ? ' with admin rights' : ''}.
              </p>
              {linkedProfile.user_id !== userId && (
                <ToggleSwitch
                  id="admin-role"
                  label="Admin rights"
                  granted={linkedProfile.role === 'admin'}
                  onToggle={setUserRole.bind(null, linkedProfile.user_id, p.id)}
                />
              )}
            </>
          ) : (
            <InvitePerson personId={p.id} email={p.email} />
          )}
        </Card>
      </section>

      <section aria-labelledby="rights-heading">
        <h2 id="rights-heading" className="mb-2 text-xl font-semibold">
          Data subject rights
        </h2>
        <Card className="flex flex-col gap-4">
          <p className="text-sm text-slate-600 dark:text-slate-400">
            Export a full copy of this person&rsquo;s data, or erase it on request.
          </p>
          <div className="flex flex-wrap gap-3">
            <LinkButton variant="secondary" href={`/api/people/${p.id}/export`}>
              Export data (JSON)
            </LinkButton>
            <ErasePerson personId={p.id} personName={personName(p)} />
          </div>
        </Card>
      </section>
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <>
      <dt className="font-medium text-slate-600 dark:text-slate-400">{label}</dt>
      <dd>{value}</dd>
    </>
  );
}
