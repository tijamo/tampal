import type { Metadata } from 'next';
import { requireAdmin } from '@/lib/auth';
import { createClient } from '@/lib/supabase/server';
import { LinkButton, PageHeading } from '@/components/ui';
import { PeopleBrowser } from '@/components/people-browser';
import type { Family, Person } from '@/lib/supabase/types';

export const metadata: Metadata = { title: 'People' };

export default async function PeoplePage() {
  await requireAdmin();
  const supabase = createClient();

  const [{ data }, { data: familyRows }] = await Promise.all([
    supabase.from('people').select('*').is('deleted_at', null),
    supabase.from('families').select('id, name'),
  ]);
  const people = (data as Person[]) ?? [];
  const families = (familyRows as Pick<Family, 'id' | 'name'>[]) ?? [];

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <PageHeading>People</PageHeading>
        <div className="flex flex-wrap gap-3">
          <LinkButton variant="secondary" href="/families">
            Families
          </LinkButton>
          <LinkButton variant="secondary" href="/people/import">
            Import
          </LinkButton>
          <LinkButton variant="secondary" href="/audit-log">
            Audit log
          </LinkButton>
          <LinkButton href="/people/new">Add person</LinkButton>
        </div>
      </div>

      <PeopleBrowser people={people} families={families} variant="admin" />
    </div>
  );
}
