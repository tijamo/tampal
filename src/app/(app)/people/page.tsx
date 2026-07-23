import type { Metadata } from 'next';
import Link from 'next/link';
import { requireAdmin } from '@/lib/auth';
import { createClient } from '@/lib/supabase/server';
import { LinkButton, Card, PageHeading } from '@/components/ui';
import { PeopleBrowser } from '@/components/people-browser';
import { personName } from '@/lib/person';
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
          <LinkButton href="/people/new">Add person</LinkButton>
        </div>
      </div>

      <PeopleBrowser
        people={people}
        families={families}
        renderItem={(p) => (
          <Card className="flex items-center justify-between gap-3 py-3">
            <span className="font-medium">{personName(p)}</span>
            <Link
              href={`/people/${p.id}`}
              className="inline-flex min-h-touch items-center rounded-md px-3 text-brand-700 underline"
            >
              View<span className="sr-only"> {personName(p)}</span>
            </Link>
          </Card>
        )}
      />
    </div>
  );
}
