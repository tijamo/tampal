// Hand-written types mirroring the Supabase schema (supabase/migrations).
// Regenerate with `supabase gen types typescript` once the CLI is set up.

export type Role = 'admin' | 'member' | 'register_taker';
export type PersonType = 'member' | 'visitor';
export type Recurrence = 'none' | 'weekly' | 'monthly' | 'annually';
// directory_listing is retired (superseded by the three granular directory_*
// types below) but stays in the union since historical consent rows still
// carry it and Postgres enum values can't be removed.
export type ConsentType =
  | 'attendance_records'
  | 'contact_storage'
  | 'directory_listing'
  | 'directory_phone'
  | 'directory_email'
  | 'directory_address';

/** The subset of ConsentType that set_own_directory_consent() accepts. */
export type DirectoryConsentType = 'directory_phone' | 'directory_email' | 'directory_address';

export interface Person {
  id: string;
  first_name: string;
  surname: string | null;
  person_type: PersonType;
  email: string | null;
  phone: string | null;
  address_line1: string | null;
  address_line2: string | null;
  city: string | null;
  postcode: string | null;
  notes: string | null;
  family_id: string | null;
  birthdate: string | null; // date
  baptism_date: string | null; // date
  baptism_location: string | null;
  join_date: string | null; // date
  talents_hobbies: string | null;
  home_church: string | null;
  tags: string[];
  external_ref: string | null;
  created_at: string;
  created_by: string | null;
  deleted_at: string | null;
}

export interface Family {
  id: string;
  name: string;
  primary_contact_person_id: string | null;
  external_ref: string | null;
  created_at: string;
  created_by: string | null;
}

export interface Profile {
  user_id: string;
  person_id: string | null;
  role: Role;
  created_at: string;
}

export interface Meeting {
  id: string;
  title: string;
  description: string | null;
  location: string | null;
  starts_at: string; // timestamptz of the first occurrence
  duration_minutes: number;
  recurrence: Recurrence;
  recurrence_until: string | null; // date
  created_by: string | null;
  archived: boolean;
  created_at: string;
}

export interface Attendance {
  id: string;
  meeting_id: string;
  occurrence_date: string; // date
  person_id: string;
  present: boolean;
  recorded_by: string | null;
  recorded_at: string;
}

export interface Consent {
  id: string;
  person_id: string;
  consent_type: ConsentType;
  granted: boolean;
  version: string;
  granted_at: string | null;
  withdrawn_at: string | null;
  captured_by: string | null;
  created_at: string;
}
