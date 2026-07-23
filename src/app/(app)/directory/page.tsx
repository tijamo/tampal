import type { Metadata } from 'next';
import Link from 'next/link';
import { requireSession } from '@/lib/auth';
import { createClient } from '@/lib/supabase/server';
import { Card, PageHeading } from '@/components/ui';
import { PeopleBrowser } from '@/components/people-browser';
import { personName } from '@/lib/person';
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
        Phone and email are shown only for people who&rsquo;ve chosen to share them. Manage your
        own listing from{' '}
        <Link href="/profile" className="underline">
          My profile
        </Link>
        .
      </p>

      <PeopleBrowser
        people={people}
        families={families}
        renderItem={(p) => (
          <Card className="flex flex-col gap-1 py-3">
            <span className="font-medium">{personName(p)}</span>
            {(p.phone || p.email) && (
              <span className="text-sm text-slate-600 dark:text-slate-400">
                {[p.phone, p.email].filter(Boolean).join(' · ')}
              </span>
            )}
          </Card>
        )}
      />
    </div>
  );
}
