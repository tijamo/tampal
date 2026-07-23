import type { PersonType } from '@/lib/supabase/types';

/**
 * Normalises a raw CHMeetings "People" export into the shape we import.
 * Pure/no I/O so it's unit-testable without a real spreadsheet.
 */

export interface RawImportRow {
  [header: string]: string | number | Date | null | undefined;
}

export interface ImportPersonDraft {
  externalRef: string;
  firstName: string;
  surname: string | null;
  email: string | null;
  phone: string | null;
  addressLine1: string | null;
  addressLine2: string | null;
  city: string | null;
  postcode: string | null;
  notes: string | null;
  birthdate: string | null;
  baptismDate: string | null;
  baptismLocation: string | null;
  joinDate: string | null;
  talentsHobbies: string | null;
  homeChurch: string | null;
  tags: string[];
  personType: PersonType;
  familyExternalRef: string | null;
  isFamilyPrimary: boolean;
  sourceRow: number;
}

export interface ImportFamilyDraft {
  externalRef: string;
  name: string;
  memberExternalRefs: string[];
  primaryExternalRef: string | null;
}

export interface SkippedRow {
  sourceRow: number;
  reason: string;
}

export interface ParsedImport {
  people: ImportPersonDraft[];
  families: ImportFamilyDraft[];
  skipped: SkippedRow[];
}

function str(row: RawImportRow, key: string): string | null {
  const v = row[key];
  if (v === null || v === undefined) return null;
  const s = String(v).trim();
  return s ? s : null;
}

function toIsoDate(value: unknown): string | null {
  if (value === null || value === undefined || value === '') return null;
  if (value instanceof Date) {
    if (Number.isNaN(value.getTime())) return null;
    return value.toISOString().slice(0, 10);
  }
  const parsed = new Date(String(value));
  return Number.isNaN(parsed.getTime()) ? null : parsed.toISOString().slice(0, 10);
}

function derivePersonType(groupName: string | null): PersonType {
  return groupName && /visitor/i.test(groupName) ? 'visitor' : 'member';
}

function deriveTags(groupName: string | null): string[] {
  if (!groupName) return [];
  return Array.from(
    new Set(
      groupName
        .split(',')
        .map((t) => t.trim())
        .filter(Boolean),
    ),
  );
}

function buildNotes(row: RawImportRow, phoneUsedForPhone: string | null): string | null {
  const lines: string[] = [];
  const notes = str(row, 'Notes');
  if (notes) lines.push(notes);

  const nickname = str(row, 'Nickname');
  if (nickname) lines.push(`Known as: ${nickname}`);

  const middleName = str(row, 'Middle Name');
  if (middleName) lines.push(`Middle name: ${middleName}`);

  const homePhone = str(row, 'Home Phone');
  if (homePhone && homePhone !== phoneUsedForPhone) lines.push(`Home phone: ${homePhone}`);

  const country = str(row, 'Constituent Country');
  if (country) lines.push(`Country: ${country}`);

  return lines.length > 0 ? lines.join('\n') : null;
}

/** Parses one raw row into a person draft, or returns a skip reason. */
function parsePersonRow(
  row: RawImportRow,
  sourceRow: number,
): { person: ImportPersonDraft } | { skip: string } {
  const personId = str(row, 'Person Id');
  if (!personId) return { skip: 'Missing Person Id.' };

  const firstName = str(row, 'First Name');
  if (!firstName) return { skip: 'Missing First Name.' };

  const mobilePhone = str(row, 'Mobile Phone');
  const homePhone = str(row, 'Home Phone');
  const phone = mobilePhone ?? homePhone;
  const groupName = str(row, 'Group Name');
  const familyRole = str(row, 'Family Role');
  const familyId = str(row, 'Family Id');

  const person: ImportPersonDraft = {
    externalRef: `chmeetings:${personId}`,
    firstName,
    surname: str(row, 'Last Name'),
    email: str(row, 'Email')?.toLowerCase() ?? null,
    phone,
    addressLine1: str(row, 'Address Line'),
    addressLine2: str(row, 'Address Line 2'),
    city: str(row, 'City'),
    postcode: str(row, 'Postal Code'),
    notes: buildNotes(row, phone),
    birthdate: toIsoDate(row['Birthdate']),
    baptismDate: toIsoDate(row['Baptism Date']),
    baptismLocation: str(row, 'Baptism Location'),
    joinDate: toIsoDate(row['Join Date']),
    talentsHobbies: str(row, 'Talents And Hobbies'),
    homeChurch: str(row, 'Church'),
    tags: deriveTags(groupName),
    personType: derivePersonType(groupName),
    // A blank Family Role means CHMeetings has no real family assignment for
    // this person (its export uses a shared placeholder Family Id for
    // everyone in that state), so we ignore Family Id unless a role is set.
    familyExternalRef: familyRole && familyId ? `chmeetings:family:${familyId}` : null,
    isFamilyPrimary: familyRole === 'Primary',
    sourceRow,
  };

  return { person };
}

function familyName(members: ImportPersonDraft[]): string {
  const surnameCounts = new Map<string, number>();
  for (const m of members) {
    if (!m.surname) continue;
    surnameCounts.set(m.surname, (surnameCounts.get(m.surname) ?? 0) + 1);
  }
  let commonSurname: string | null = null;
  let max = 0;
  for (const [surname, count] of surnameCounts) {
    if (count > max) {
      max = count;
      commonSurname = surname;
    }
  }
  if (commonSurname && max >= 2) return `The ${commonSurname} Family`;

  const first = members[0];
  return `${[first.firstName, first.surname].filter(Boolean).join(' ')}'s Family`;
}

function pickPrimary(members: ImportPersonDraft[]): string | null {
  const explicit = members.find((m) => m.isFamilyPrimary);
  if (explicit) return explicit.externalRef;

  const sorted = [...members].sort((a, b) => {
    const surnameCmp = (a.surname ?? '').localeCompare(b.surname ?? '');
    return surnameCmp !== 0 ? surnameCmp : a.firstName.localeCompare(b.firstName);
  });
  return sorted[0]?.externalRef ?? null;
}

export function parseChMeetingsRows(rows: RawImportRow[]): ParsedImport {
  const people: ImportPersonDraft[] = [];
  const skipped: SkippedRow[] = [];

  rows.forEach((row, index) => {
    const sourceRow = index + 2; // header is row 1
    const result = parsePersonRow(row, sourceRow);
    if ('skip' in result) {
      skipped.push({ sourceRow, reason: result.skip });
    } else {
      people.push(result.person);
    }
  });

  const groups = new Map<string, ImportPersonDraft[]>();
  for (const person of people) {
    if (!person.familyExternalRef) continue;
    const group = groups.get(person.familyExternalRef) ?? [];
    group.push(person);
    groups.set(person.familyExternalRef, group);
  }

  const families: ImportFamilyDraft[] = Array.from(groups.entries()).map(
    ([externalRef, members]) => ({
      externalRef,
      name: familyName(members),
      memberExternalRefs: members.map((m) => m.externalRef),
      primaryExternalRef: pickPrimary(members),
    }),
  );

  return { people, families, skipped };
}
