import type { Metadata } from 'next';
import { requireAdmin } from '@/lib/auth';
import { createClient } from '@/lib/supabase/server';
import { Card, PageHeading, LinkButton } from '@/components/ui';
import { auditLogQuery, resolveActorNames, type AuditLogRow } from '@/lib/audit';

export const metadata: Metadata = { title: 'Audit log' };

const ENTITIES = ['people', 'attendance', 'consents', 'meetings', 'families'] as const;
const ROW_LIMIT = 300;

function toQueryString(params: Record<string, string | undefined>): string {
  const search = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (value) search.set(key, value);
  }
  const s = search.toString();
  return s ? `?${s}` : '';
}

export default async function AuditLogPage({
  searchParams,
}: {
  searchParams: { since?: string; until?: string; entity?: string };
}) {
  await requireAdmin();
  const supabase = createClient();

  const filters = { since: searchParams.since, until: searchParams.until, entity: searchParams.entity };
  const { data } = await auditLogQuery(supabase, filters)
    .order('at', { ascending: false })
    .limit(ROW_LIMIT);
  const rows = (data as AuditLogRow[]) ?? [];
  const actorNames = await resolveActorNames(supabase, rows);

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <PageHeading>Audit log</PageHeading>
        <LinkButton variant="secondary" href={`/api/audit-log/export${toQueryString(filters)}`}>
          Export CSV
        </LinkButton>
      </div>
      <p className="text-sm text-slate-600 dark:text-slate-400">
        Every change to people, attendance, consents, meetings and families, with who made it and
        when. Showing the most recent {ROW_LIMIT} matching entries &mdash; narrow the filters or
        export for the full range.
      </p>

      <Card>
        <form className="flex flex-wrap items-end gap-3" method="get">
          <div className="flex flex-col gap-1">
            <label htmlFor="since" className="text-sm font-medium">
              From
            </label>
            <input
              id="since"
              name="since"
              type="date"
              defaultValue={searchParams.since}
              className="min-h-touch rounded-md border border-slate-400 bg-white px-3 py-2 dark:border-slate-600 dark:bg-slate-950"
            />
          </div>
          <div className="flex flex-col gap-1">
            <label htmlFor="until" className="text-sm font-medium">
              To
            </label>
            <input
              id="until"
              name="until"
              type="date"
              defaultValue={searchParams.until}
              className="min-h-touch rounded-md border border-slate-400 bg-white px-3 py-2 dark:border-slate-600 dark:bg-slate-950"
            />
          </div>
          <div className="flex flex-col gap-1">
            <label htmlFor="entity" className="text-sm font-medium">
              Table
            </label>
            <select
              id="entity"
              name="entity"
              defaultValue={searchParams.entity ?? ''}
              className="min-h-touch rounded-md border border-slate-400 bg-white px-3 py-2 dark:border-slate-600 dark:bg-slate-950"
            >
              <option value="">All</option>
              {ENTITIES.map((e) => (
                <option key={e} value={e}>
                  {e}
                </option>
              ))}
            </select>
          </div>
          <button
            type="submit"
            className="min-h-touch rounded-md bg-brand-700 px-4 py-2 text-base font-medium text-white hover:bg-brand-800"
          >
            Filter
          </button>
        </form>
      </Card>

      <Card className="overflow-x-auto">
        {rows.length === 0 ? (
          <p className="text-slate-600 dark:text-slate-400">No matching entries.</p>
        ) : (
          <table className="w-full min-w-[40rem] text-left text-sm">
            <thead>
              <tr className="border-b border-slate-200 dark:border-slate-800">
                <th className="py-2 pr-2">Time</th>
                <th className="py-2 pr-2">Actor</th>
                <th className="py-2 pr-2">Action</th>
                <th className="py-2 pr-2">Table</th>
                <th className="py-2 pr-2">Record</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr key={row.id} className="border-b border-slate-100 dark:border-slate-900">
                  <td className="whitespace-nowrap py-2 pr-2">
                    <time dateTime={row.at}>{new Date(row.at).toLocaleString('en-GB')}</time>
                  </td>
                  <td className="py-2 pr-2">
                    {row.actor_user_id ? actorNames.get(row.actor_user_id) ?? 'Unknown' : 'System'}
                  </td>
                  <td className="py-2 pr-2">{row.action}</td>
                  <td className="py-2 pr-2">{row.entity}</td>
                  <td className="max-w-[10rem] truncate py-2 pr-2 font-mono text-xs" title={row.entity_id ?? ''}>
                    {row.entity_id}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </Card>
    </div>
  );
}
