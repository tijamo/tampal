import type { Metadata } from 'next';
import { requireSession } from '@/lib/auth';
import { createClient } from '@/lib/supabase/server';
import { PageHeading, Card, Banner, LinkButton } from '@/components/ui';
import { ProfileForm } from '@/components/profile-form';
import { ToggleSwitch } from '@/components/toggle-switch';
import { ErasePerson } from '@/components/erase-person';
import { setOwnDirectoryConsent, eraseSelf } from './actions';
import { latestConsent } from '@/lib/consent';
import { personName } from '@/lib/person';
import type { Person, Consent } from '@/lib/supabase/types';

export const metadata: Metadata = { title: 'My profile' };

export default async function ProfilePage() {
  const { profile } = await requireSession();

  if (!profile?.person_id) {
    return (
      <div className="flex flex-col gap-4">
        <PageHeading>My profile</PageHeading>
        <Banner tone="info">
          Your account isn&rsquo;t linked to a member record yet. Please contact an administrator.
        </Banner>
      </div>
    );
  }

  const supabase = createClient();
  const [{ data: person }, { data: consentRows }] = await Promise.all([
    supabase.from('people').select('*').eq('id', profile.person_id).maybeSingle(),
    supabase.from('consents').select('*').eq('person_id', profile.person_id),
  ]);

  if (!person) {
    return (
      <div className="flex flex-col gap-4">
        <PageHeading>My profile</PageHeading>
        <Banner tone="error">
          Your linked member record could not be found. Please contact an administrator.
        </Banner>
      </div>
    );
  }

  const consents = (consentRows as Consent[]) ?? [];

  return (
    <div className="flex flex-col gap-6">
      <PageHeading>My profile</PageHeading>
      <ProfileForm person={person as Person} />

      <section aria-labelledby="directory-heading">
        <h2 id="directory-heading" className="mb-2 text-xl font-semibold">
          Directory listing
        </h2>
        <p className="mb-2 text-sm text-slate-600 dark:text-slate-400">
          Each of these is independent &mdash; sharing one doesn&rsquo;t share the others.
        </p>
        <Card className="flex flex-col divide-y divide-slate-200 dark:divide-slate-800">
          <ToggleSwitch
            id="directory-phone"
            label="Show my phone number in the member directory"
            granted={latestConsent(consents, 'directory_phone')}
            onToggle={setOwnDirectoryConsent.bind(null, 'directory_phone')}
          />
          <ToggleSwitch
            id="directory-email"
            label="Show my email address in the member directory"
            granted={latestConsent(consents, 'directory_email')}
            onToggle={setOwnDirectoryConsent.bind(null, 'directory_email')}
          />
          <ToggleSwitch
            id="directory-address"
            label="Show my postal address in the member directory"
            granted={latestConsent(consents, 'directory_address')}
            onToggle={setOwnDirectoryConsent.bind(null, 'directory_address')}
          />
        </Card>
      </section>

      <section aria-labelledby="rights-heading">
        <h2 id="rights-heading" className="mb-2 text-xl font-semibold">
          Your data rights
        </h2>
        <Card className="flex flex-col gap-4">
          <p className="text-sm text-slate-600 dark:text-slate-400">
            Download a full copy of everything we hold about you, or request erasure. Erasing your
            data signs you out and cannot be undone.
          </p>
          <div className="flex flex-wrap gap-3">
            <LinkButton variant="secondary" href={`/api/people/${profile.person_id}/export`}>
              Download my data (JSON)
            </LinkButton>
            <ErasePerson
              personName={personName(person as Person)}
              action={eraseSelf}
              description="This permanently removes your contact details and anonymises your attendance records, then signs you out. This cannot be undone."
              triggerLabel="Erase my data"
            />
          </div>
        </Card>
      </section>
    </div>
  );
}
