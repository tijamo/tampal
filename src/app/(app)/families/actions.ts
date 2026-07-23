'use server';

import { revalidatePath } from 'next/cache';
import { requireAdmin } from '@/lib/auth';
import { createClient } from '@/lib/supabase/server';

export async function createFamily(form: FormData): Promise<void> {
  const { userId } = await requireAdmin();
  const name = (form.get('name') as string | null)?.trim();
  if (!name) return;

  const supabase = createClient();
  await supabase.from('families').insert({ name, created_by: userId });
  revalidatePath('/families');
}

export async function renameFamily(familyId: string, name: string) {
  await requireAdmin();
  const trimmed = name.trim();
  if (!trimmed) return;

  const supabase = createClient();
  await supabase.from('families').update({ name: trimmed }).eq('id', familyId);
  revalidatePath('/families');
}

/** personId must already be a member of the family (family_id set via the person form); null clears it. */
export async function setPrimaryContact(familyId: string, personId: string | null) {
  await requireAdmin();
  const supabase = createClient();

  if (personId) {
    const { data } = await supabase
      .from('people')
      .select('id')
      .eq('id', personId)
      .eq('family_id', familyId)
      .maybeSingle();
    if (!data) return;
  }

  await supabase.from('families').update({ primary_contact_person_id: personId }).eq('id', familyId);
  revalidatePath('/families');
}

/** Deleting a family just ungroups its members (people.family_id -> null via FK); it never deletes people. */
export async function deleteFamily(familyId: string) {
  await requireAdmin();
  const supabase = createClient();
  await supabase.from('families').delete().eq('id', familyId);
  revalidatePath('/families');
}
