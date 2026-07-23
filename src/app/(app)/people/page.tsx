import type { Metadata } from 'next';
import Link from 'next/link';
import { requireAdmin } from '@/lib/auth';
import { createClient } from '@/lib/supabase/server';
import { LinkButton, Card, PageHeading } from '@/components/ui';
import { personName } from '@/lib/person';
import type { Person } from '@/lib/supabase/types';

export const metadata: Metadata = { title: 'People' };

export default async function PeoplePage() {
  await requireAdmin();
  const supabase = createClient();

  const { data } = await supabase
    .from('people')
    .select('*')
    .is('deleted_at', null)
    .order('surname', { nullsFirst: false })
    .order('first_name');
  const people = (data as Person[]) ?? [];

  const members = people.filter((p) => p.person_type === 'member');
  const visitors = people.filter((p) => p.person_type === 'visitor');

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

      <PeopleGroup title="Members" people={members} />
      <PeopleGroup title="Visitors" people={visitors} />
    </div>
  );
}

function PeopleGroup({ title, people }: { title: string; people: Person[] }) {
  return (
    <section aria-labelledby={`${title}-heading`} className="flex flex-col gap-3">
      <h2 id={`${title}-heading`} className="text-xl font-semibold">
        {title} <span className="font-normal text-slate-500">({people.length})</span>
      </h2>
      {people.length === 0 ? (
        <p className="text-slate-600 dark:text-slate-400">None yet.</p>
      ) : (
        <ul className="flex flex-col gap-2">
          {people.map((p) => (
            <li key={p.id}>
              <Card className="flex items-center justify-between gap-3 py-3">
                <span className="font-medium">{personName(p)}</span>
                <Link
                  href={`/people/${p.id}`}
                  className="inline-flex min-h-touch items-center rounded-md px-3 text-brand-700 underline"
                >
                  View<span className="sr-only"> {personName(p)}</span>
                </Link>
              </Card>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
