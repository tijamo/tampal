import type { Metadata } from 'next';
import Link from 'next/link';
import { requireSession } from '@/lib/auth';
import { createClient } from '@/lib/supabase/server';
import { PageHeading } from '@/components/ui';
import { PeopleBrowser } from '@/components/people-browser';
import type { Family, PersonType } from '@/lib/supabase/types';

export const metadata: Metadata = { title: 'Directory' };

interface DirectoryEntry {
  id: string;
  first_name: string;
  surname: string | null;
  person_type: PersonType;
  phone: string | null;
  email: string | null;
  family_id: string | null;
  address_line1: string | null;
  address_line2: string | null;
  city: string | null;
  postcode: string | null;
}

export default async function DirectoryPage() {
  await requireSession();
  const supabase = createClient();

  const [{ data }, { data: familyRows }] = await Promise.all([
    supabase.from('people_directory').select('*'),
    supabase.from('families').select('id, name'),
  ]);
  const people = (data as DirectoryEntry[]) ?? [];
  const families = (familyRows as Pick<Family, 'id' | 'name'>[]) ?? [];

  return (
    <div className="flex flex-col gap-6">
      <PageHeading>Directory</PageHeading>
      <p className="text-sm text-slate-600 dark:text-slate-400">
        Phone, email and address are each shown only for people who&rsquo;ve separately chosen to
        share them. Manage your own listing from{' '}
        <Link href="/profile" className="underline">
          My profile
        </Link>
        .
      </p>

      <PeopleBrowser people={people} families={families} variant="directory" />
    </div>
  );
}
