import type { Metadata } from 'next';
import { requireAdmin } from '@/lib/auth';
import { createClient } from '@/lib/supabase/server';
import { PageHeading } from '@/components/ui';
import { PersonForm } from '@/components/person-form';
import { createPerson } from '../actions';
import type { Family } from '@/lib/supabase/types';

export const metadata: Metadata = { title: 'Add person' };

export default async function NewPersonPage() {
  await requireAdmin();
  const supabase = createClient();
  const { data: families } = await supabase.from('families').select('*').order('name');

  return (
    <div className="flex flex-col gap-6">
      <PageHeading>Add a person</PageHeading>
      <PersonForm action={createPerson} mode="create" families={(families as Family[]) ?? []} />
    </div>
  );
}
