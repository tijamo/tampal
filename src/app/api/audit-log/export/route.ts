import { NextResponse, type NextRequest } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { auditLogQuery, resolveActorNames, csvCell, type AuditLogRow } from '@/lib/audit';

const EXPORT_ROW_CAP = 20_000;

/** Admin-only CSV export of the full audit trail (or a filtered slice), for offline review. */
export async function GET(request: NextRequest) {
  const supabase = createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthenticated' }, { status: 401 });

  const { data: profile } = await supabase
    .from('profiles')
    .select('role')
    .eq('user_id', user.id)
    .maybeSingle();
  if (profile?.role !== 'admin') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const params = request.nextUrl.searchParams;
  const filters = {
    since: params.get('since') ?? undefined,
    until: params.get('until') ?? undefined,
    entity: params.get('entity') ?? undefined,
  };

  const { data } = await auditLogQuery(supabase, filters)
    .order('at', { ascending: false })
    .limit(EXPORT_ROW_CAP);
  const rows = (data as AuditLogRow[]) ?? [];
  const actorNames = await resolveActorNames(supabase, rows);

  const header = ['at', 'actor', 'action', 'entity', 'entity_id', 'detail'];
  const lines = [header.join(',')];
  for (const row of rows) {
    const actor = row.actor_user_id ? actorNames.get(row.actor_user_id) ?? 'Unknown' : 'System';
    lines.push(
      [row.at, actor, row.action, row.entity, row.entity_id, JSON.stringify(row.detail)]
        .map(csvCell)
        .join(','),
    );
  }

  return new NextResponse(lines.join('\n'), {
    headers: {
      'Content-Type': 'text/csv',
      'Content-Disposition': `attachment; filename="tampal-audit-log-${new Date().toISOString().slice(0, 10)}.csv"`,
      'Cache-Control': 'no-store',
    },
  });
}
