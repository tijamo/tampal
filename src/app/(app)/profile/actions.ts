'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { requireSession } from '@/lib/auth';
import { createClient } from '@/lib/supabase/server';
import type { DirectoryConsentType } from '@/lib/supabase/types';

export interface ProfileFormState {
  error?: string;
  success?: string;
}

function str(form: FormData, key: string): string | null {
  const v = (form.get(key) as string | null)?.trim();
  return v ? v : null;
}

/** Self-service edit of the caller's own contact details, via a SECURITY
 * DEFINER RPC that only ever touches contact columns (see
 * supabase/migrations/0005_self_service_rls.sql). */
export async function updateOwnProfile(
  _prev: ProfileFormState,
  form: FormData,
): Promise<ProfileFormState> {
  const { profile } = await requireSession();
  if (!profile?.person_id) {
    return { error: 'Your account is not linked to a member record. Contact an administrator.' };
  }

  const first_name = str(form, 'first_name');
  if (!first_name) return { error: 'A first name is required.' };

  const supabase = createClient();
  const { error } = await supabase.rpc('update_own_contact_details', {
    p_first_name: first_name,
    p_surname: str(form, 'surname'),
    p_email: str(form, 'email'),
    p_phone: str(form, 'phone'),
    p_address_line1: str(form, 'address_line1'),
    p_address_line2: str(form, 'address_line2'),
    p_city: str(form, 'city'),
    p_postcode: str(form, 'postcode'),
  });

  if (error) return { error: 'Could not save your details. Please try again.' };

  revalidatePath('/profile');
  revalidatePath('/directory');
  return { success: 'Your details have been updated.' };
}

/**
 * Self-service opt-in/out of sharing one specific field (phone, email, or
 * address) in the member directory. Each is independent -- sharing your
 * phone doesn't imply sharing your address.
 */
export async function setOwnDirectoryConsent(type: DirectoryConsentType, granted: boolean) {
  const { profile } = await requireSession();
  if (!profile?.person_id) return;

  const supabase = createClient();
  await supabase.rpc('set_own_directory_consent', { p_consent_type: type, p_granted: granted });

  revalidatePath('/profile');
  revalidatePath('/directory');
}

/**
 * GDPR self-service erasure (Article 17). Shares erase_person_data() with
 * the admin erasure action (see 0012_self_service_erasure.sql) -- the RPC
 * itself enforces "admin, or your own record", not this check. Signs the
 * caller out afterwards since there's nothing meaningful left in their
 * account once their personal data is gone.
 */
export async function eraseSelf() {
  const { profile } = await requireSession();
  if (!profile?.person_id) return;

  const supabase = createClient();
  await supabase.rpc('erase_person_data', { p_person_id: profile.person_id });
  await supabase.auth.signOut();

  redirect('/login');
}
