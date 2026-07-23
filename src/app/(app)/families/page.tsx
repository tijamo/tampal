import type { Metadata } from 'next';
import { requireAdmin } from '@/lib/auth';
import { createClient } from '@/lib/supabase/server';
import { Card, PageHeading, Button, Banner } from '@/components/ui';
import { FamilyCard } from '@/components/family-card';
import { createFamily } from './actions';
import type { Family, Person } from '@/lib/supabase/types';

export const metadata: Metadata = { title: 'Families' };

type FamilyWithMembers = Family & { people: Person[] };

export default async function FamiliesPage() {
  await requireAdmin();
  const supabase = createClient();

  const { data, error } = await supabase
    .from('families')
    .select('*, people(*)')
    .order('name');
  const families = (data as FamilyWithMembers[]) ?? [];

  return (
    <div className="flex flex-col gap-6">
      <PageHeading>Families</PageHeading>
      <p className="text-slate-600 dark:text-slate-400">
        Group members into families with a primary contact. Add someone to a family from their{' '}
        person page.
      </p>

      <Card className="flex flex-col gap-3">
        <h2 className="text-lg font-semibold">Create a family</h2>
        <form action={createFamily} className="flex flex-wrap items-end gap-3">
          <div className="flex flex-1 min-w-[12rem] flex-col gap-1">
            <label htmlFor="new-family-name" className="font-medium">
              Family name
            </label>
            <input
              id="new-family-name"
              name="name"
              required
              placeholder="e.g. The Smith Family"
              className="min-h-touch rounded-md border border-slate-400 bg-white px-3 py-2 dark:border-slate-600 dark:bg-slate-950"
            />
          </div>
          <Button type="submit">Create</Button>
        </form>
      </Card>

      {error && <Banner tone="error">Could not load families: {error.message}</Banner>}

      {!error && families.length === 0 ? (
        <p className="text-slate-600 dark:text-slate-400">No families yet.</p>
      ) : (
        <div className="flex flex-col gap-4">
          {families.map((f) => (
            <FamilyCard
              key={f.id}
              familyId={f.id}
              name={f.name}
              members={(f.people ?? []).filter((p) => !p.deleted_at)}
              primaryContactId={f.primary_contact_person_id}
            />
          ))}
        </div>
      )}
    </div>
  );
}
