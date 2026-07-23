'use server';

import { revalidatePath } from 'next/cache';
import { requireAdmin } from '@/lib/auth';
import { createClient } from '@/lib/supabase/server';
import { parseWorkbookRows } from '@/lib/import/parse-workbook';
import {
  parseChMeetingsRows,
  type ImportFamilyDraft,
  type ImportPersonDraft,
  type SkippedRow,
} from '@/lib/import/chmeetings';

export type PersonMatch = 'new' | 'update-by-ref' | 'update-by-email';

export interface PreviewPerson extends ImportPersonDraft {
  match: PersonMatch;
  matchedPersonId: string | null;
  include: boolean;
}

export interface ImportPreview {
  people: PreviewPerson[];
  families: ImportFamilyDraft[];
  skipped: SkippedRow[];
  error?: string;
}

/**
 * Parses an uploaded CHMeetings export and classifies each row against
 * existing people, without writing anything. The admin reviews/adjusts this
 * in the UI before commitImport() is called.
 */
export async function previewImport(formData: FormData): Promise<ImportPreview> {
  await requireAdmin();

  const file = formData.get('file');
  if (!(file instanceof File) || file.size === 0) {
    return { people: [], families: [], skipped: [], error: 'Please choose a .xlsx file to upload.' };
  }

  let rows;
  try {
    rows = await parseWorkbookRows(await file.arrayBuffer());
  } catch {
    return {
      people: [],
      families: [],
      skipped: [],
      error: 'Could not read this file. Is it a valid .xlsx export?',
    };
  }

  const { people, families, skipped } = parseChMeetingsRows(rows);
  if (people.length === 0) {
    return { people: [], families, skipped, error: 'No importable rows were found in this file.' };
  }

  const supabase = createClient();
  const externalRefs = people.map((p) => p.externalRef);
  const emails = Array.from(new Set(people.map((p) => p.email).filter((e): e is string => !!e)));

  const [{ data: byRef }, { data: byEmail }] = await Promise.all([
    supabase.from('people').select('id, external_ref').is('deleted_at', null).in('external_ref', externalRefs),
    emails.length
      ? supabase.from('people').select('id, email').is('deleted_at', null).in('email', emails)
      : Promise.resolve({ data: [] as { id: string; email: string }[] }),
  ]);

  const refMap = new Map((byRef ?? []).map((r) => [r.external_ref as string, r.id as string]));
  const emailMap = new Map((byEmail ?? []).map((r) => [(r.email as string).toLowerCase(), r.id as string]));

  const preview: PreviewPerson[] = people.map((p) => {
    const byRefId = refMap.get(p.externalRef);
    if (byRefId) return { ...p, match: 'update-by-ref', matchedPersonId: byRefId, include: true };

    const byEmailId = p.email ? emailMap.get(p.email) : undefined;
    if (byEmailId) return { ...p, match: 'update-by-email', matchedPersonId: byEmailId, include: true };

    return { ...p, match: 'new', matchedPersonId: null, include: true };
  });

  return { people: preview, families, skipped };
}

export interface ImportResult {
  peopleCreated: number;
  peopleUpdated: number;
  familiesCreated: number;
  familiesUpdated: number;
  errors: string[];
}

/** Writes the (admin-reviewed) preview to the database. Safe to re-run: matching is by external_ref/email. */
export async function commitImport(
  people: PreviewPerson[],
  families: ImportFamilyDraft[],
): Promise<ImportResult> {
  const { userId } = await requireAdmin();
  const supabase = createClient();
  const result: ImportResult = {
    peopleCreated: 0,
    peopleUpdated: 0,
    familiesCreated: 0,
    familiesUpdated: 0,
    errors: [],
  };

  const included = people.filter((p) => p.include);
  const refToPersonId = new Map<string, string>();

  for (const p of included) {
    const displayName = [p.firstName, p.surname].filter(Boolean).join(' ');
    const payload = {
      first_name: p.firstName,
      surname: p.surname,
      email: p.email,
      phone: p.phone,
      address_line1: p.addressLine1,
      address_line2: p.addressLine2,
      city: p.city,
      postcode: p.postcode,
      notes: p.notes,
      birthdate: p.birthdate,
      baptism_date: p.baptismDate,
      baptism_location: p.baptismLocation,
      join_date: p.joinDate,
      talents_hobbies: p.talentsHobbies,
      home_church: p.homeChurch,
      tags: p.tags,
      person_type: p.personType,
      external_ref: p.externalRef,
    };

    if (p.matchedPersonId) {
      const { error } = await supabase.from('people').update(payload).eq('id', p.matchedPersonId);
      if (error) {
        result.errors.push(`${displayName}: ${error.message}`);
        continue;
      }
      refToPersonId.set(p.externalRef, p.matchedPersonId);
      result.peopleUpdated++;
    } else {
      const { data, error } = await supabase
        .from('people')
        .insert({ ...payload, created_by: userId })
        .select('id')
        .single();
      if (error || !data) {
        result.errors.push(`${displayName}: ${error?.message ?? 'could not create this person'}`);
        continue;
      }
      refToPersonId.set(p.externalRef, data.id);
      result.peopleCreated++;
    }
  }

  for (const f of families) {
    const memberIds = f.memberExternalRefs
      .map((ref) => refToPersonId.get(ref))
      .filter((id): id is string => !!id);
    if (memberIds.length === 0) continue; // every member of this family was excluded or failed above

    const { data: existingFamily } = await supabase
      .from('families')
      .select('id')
      .eq('external_ref', f.externalRef)
      .maybeSingle();

    let familyId: string;
    if (existingFamily) {
      familyId = existingFamily.id;
      await supabase.from('families').update({ name: f.name }).eq('id', familyId);
      result.familiesUpdated++;
    } else {
      const { data: created, error } = await supabase
        .from('families')
        .insert({ name: f.name, external_ref: f.externalRef, created_by: userId })
        .select('id')
        .single();
      if (error || !created) {
        result.errors.push(`Family "${f.name}": ${error?.message ?? 'could not create this family'}`);
        continue;
      }
      familyId = created.id;
      result.familiesCreated++;
    }

    await supabase.from('people').update({ family_id: familyId }).in('id', memberIds);

    const primaryId = f.primaryExternalRef ? refToPersonId.get(f.primaryExternalRef) : undefined;
    if (primaryId) {
      await supabase.from('families').update({ primary_contact_person_id: primaryId }).eq('id', familyId);
    }
  }

  revalidatePath('/people');
  revalidatePath('/families');
  return result;
}
