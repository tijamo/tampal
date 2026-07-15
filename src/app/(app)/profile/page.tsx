import type { Metadata } from 'next';
import { requireSession } from '@/lib/auth';
import { createClient } from '@/lib/supabase/server';
import { PageHeading, Card, Banner } from '@/components/ui';
import { ProfileForm } from '@/components/profile-form';
import { ToggleSwitch } from '@/components/toggle-switch';
import { setOwnDirectoryConsent } from './actions';
import type { Person, Consent, ConsentType } from '@/lib/supabase/types';

export const metadata: Metadata = { title: 'My profile' };

function latestConsent(consents: Consent[], type: ConsentType): boolean {
  const rows = consents
    .filter((c) => c.consent_type === type)
    .sort((a, b) => b.created_at.localeCompare(a.created_at));
  return rows[0]?.granted ?? false;
}

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
        <Card>
          <ToggleSwitch
            id="directory-listing"
            label="Show my phone and email in the member directory"
            granted={latestConsent(consents, 'directory_listing')}
            onToggle={setOwnDirectoryConsent}
          />
        </Card>
      </section>
    </div>
  );
}
