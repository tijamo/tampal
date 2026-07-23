import type { SupabaseClient } from '@supabase/supabase-js';

export interface AuditLogRow {
  id: number;
  actor_user_id: string | null;
  action: string;
  entity: string;
  entity_id: string | null;
  at: string;
  detail: unknown;
}

export interface AuditLogFilters {
  since?: string; // date, inclusive
  until?: string; // date, inclusive
  entity?: string;
}

/** Builds the audit_log query for the given filters; caller adds order/limit/range. */
export function auditLogQuery(supabase: SupabaseClient, filters: AuditLogFilters) {
  let query = supabase.from('audit_log').select('*');
  if (filters.since) query = query.gte('at', `${filters.since}T00:00:00.000Z`);
  if (filters.until) query = query.lte('at', `${filters.until}T23:59:59.999Z`);
  if (filters.entity) query = query.eq('entity', filters.entity);
  return query;
}

/**
 * Resolves actor_user_id -> a display name, via profiles -> people (the only
 * link available with the RLS-scoped client; we deliberately don't reach for
 * the admin/service-role client just to read an email here).
 */
export async function resolveActorNames(
  supabase: SupabaseClient,
  rows: Pick<AuditLogRow, 'actor_user_id'>[],
): Promise<Map<string, string>> {
  const actorIds = Array.from(
    new Set(rows.map((r) => r.actor_user_id).filter((id): id is string => !!id)),
  );
  if (actorIds.length === 0) return new Map();

  const { data: profiles } = await supabase
    .from('profiles')
    .select('user_id, person_id')
    .in('user_id', actorIds);

  const personIds = (profiles ?? [])
    .map((p) => p.person_id as string | null)
    .filter((id): id is string => !!id);

  const { data: people } = personIds.length
    ? await supabase.from('people').select('id, first_name, surname').in('id', personIds)
    : { data: [] as { id: string; first_name: string; surname: string | null }[] };

  const personNameById = new Map((people ?? []).map((p) => [p.id, [p.first_name, p.surname].filter(Boolean).join(' ')]));
  const nameByUserId = new Map<string, string>();
  for (const p of profiles ?? []) {
    const name = p.person_id ? personNameById.get(p.person_id) : undefined;
    nameByUserId.set(p.user_id, name ?? `Unlinked user (${p.user_id.slice(0, 8)})`);
  }
  return nameByUserId;
}

/** Quotes a CSV field only when it contains a character that requires it. */
export function csvCell(value: unknown): string {
  const s = value === null || value === undefined ? '' : String(value);
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}
