import type { Metadata } from 'next';
import Link from 'next/link';
import { requireSession } from '@/lib/auth';
import { createClient } from '@/lib/supabase/server';
import { Card, PageHeading } from '@/components/ui';
import type { PersonType } from '@/lib/supabase/types';

export const metadata: Metadata = { title: 'Directory' };

interface DirectoryEntry {
  id: string;
  full_name: string;
  person_type: PersonType;
  phone: string | null;
  email: string | null;
}

export default async function DirectoryPage() {
  await requireSession();
  const supabase = createClient();

  const { data } = await supabase.from('people_directory').select('*').order('full_name');
  const people = (data as DirectoryEntry[]) ?? [];
  const members = people.filter((p) => p.person_type === 'member');
  const visitors = people.filter((p) => p.person_type === 'visitor');

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

      <DirectoryGroup title="Members" people={members} />
      <DirectoryGroup title="Visitors" people={visitors} />
    </div>
  );
}

function DirectoryGroup({ title, people }: { title: string; people: DirectoryEntry[] }) {
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
              <Card className="flex flex-col gap-1 py-3">
                <span className="font-medium">{p.full_name}</span>
                {(p.phone || p.email) && (
                  <span className="text-sm text-slate-600 dark:text-slate-400">
                    {[p.phone, p.email].filter(Boolean).join(' · ')}
                  </span>
                )}
              </Card>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
