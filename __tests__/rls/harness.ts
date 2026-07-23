/**
 * Ephemeral local-Postgres harness for exercising the project's real RLS
 * policies (supabase/migrations/*.sql) without the full Supabase/Docker
 * stack. Spins up a throwaway `initdb` cluster, applies an `auth` schema
 * shim (see auth-shim.sql) plus every migration verbatim, then exposes a
 * `queryAs(sub, sql, params)` helper that opens a connection, `set role
 * authenticated`, and sets the `request.jwt.claim.sub` GUC PostgREST would
 * set from the caller's JWT -- so tests hit the same policies Supabase
 * would enforce in production.
 */
import { execFileSync } from "node:child_process";
import { randomUUID } from "node:crypto";
import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";
import { Client, type QueryResultRow } from "pg";

const PG_BIN_CANDIDATES = [
  process.env.PG_BINDIR,
  "/usr/lib/postgresql/16/bin",
  "/usr/lib/postgresql/15/bin",
  "/usr/lib/postgresql/14/bin",
  "/usr/local/opt/postgresql/bin",
].filter((p): p is string => !!p);

function findPgBinDir(): string | null {
  for (const dir of PG_BIN_CANDIDATES) {
    if (fs.existsSync(path.join(dir, "initdb")) && fs.existsSync(path.join(dir, "pg_ctl"))) {
      return dir;
    }
  }
  try {
    const fromPath = execFileSync("which", ["initdb"], { encoding: "utf8" }).trim();
    if (fromPath) return path.dirname(fromPath);
  } catch {
    // not on PATH either
  }
  return null;
}

/** True when this environment can actually run the RLS harness. */
export function rlsHarnessAvailable(): boolean {
  return findPgBinDir() !== null;
}

const isRoot = typeof process.getuid === "function" && process.getuid() === 0;

/** Runs a shell command, transparently `su postgres` when running as root (initdb/postgres refuse to run as root). */
function runAsPgUser(cmd: string): void {
  if (isRoot) {
    execFileSync("su", ["postgres", "-c", cmd], { stdio: "pipe" });
  } else {
    execFileSync("bash", ["-c", cmd], { stdio: "pipe" });
  }
}

export interface RlsCluster {
  port: number;
  dataDir: string;
  stop: () => Promise<void>;
  /** Query as an authenticated user impersonating the given auth.users id (or unauthenticated if omitted). */
  queryAs: <T extends QueryResultRow = QueryResultRow>(
    sub: string | null,
    sql: string,
    params?: unknown[],
  ) => Promise<{ rows: T[]; rowCount: number | null }>;
  /** Query as the Postgres superuser, bypassing RLS entirely (for seeding/assertions). */
  querySuper: <T extends QueryResultRow = QueryResultRow>(
    sql: string,
    params?: unknown[],
  ) => Promise<{ rows: T[]; rowCount: number | null }>;
}

const MIGRATIONS_DIR = path.join(__dirname, "..", "..", "supabase", "migrations");
const AUTH_SHIM_PATH = path.join(__dirname, "auth-shim.sql");

/** pg_cron isn't installed in this bare cluster; strip its scheduling block from 0002 (the two purge functions it defines still get created and tested directly). */
function loadMigrationSql(file: string): string {
  const raw = fs.readFileSync(path.join(MIGRATIONS_DIR, file), "utf8");
  if (file === "0002_retention.sql") {
    return raw.split("-- Schedule daily")[0];
  }
  return raw;
}

export async function startRlsCluster(): Promise<RlsCluster> {
  const pgBin = findPgBinDir();
  if (!pgBin) {
    throw new Error("No local Postgres server binaries found; is postgresql-server installed?");
  }

  const port = 40000 + Math.floor(Math.random() * 10000);
  const base = isRoot ? "/var/lib/postgresql" : os.tmpdir();
  const dataDir = path.join(base, `tampal-rls-${randomUUID()}`);
  const socketDir = isRoot ? "/tmp" : os.tmpdir();

  runAsPgUser(`mkdir -p ${dataDir}`);
  runAsPgUser(`${path.join(pgBin, "initdb")} -D ${dataDir} -U postgres --auth=trust >/dev/null`);
  runAsPgUser(
    `${path.join(pgBin, "pg_ctl")} -D ${dataDir} -o "-p ${port} -k ${socketDir} -c listen_addresses=''" -l ${dataDir}/server.log -w start`,
  );

  const connect = () =>
    new Client({ host: socketDir, port, user: "postgres", database: "postgres" });

  try {
    const admin = connect();
    await admin.connect();
    await admin.query(fs.readFileSync(AUTH_SHIM_PATH, "utf8"));
    for (const file of [
      "0001_init.sql",
      "0002_retention.sql",
      "0003_grants.sql",
      "0004_self_service.sql",
      "0005_self_service_rls.sql",
      "0006_split_full_name.sql",
      "0007_lock_down_maintenance_rpcs.sql",
      "0008_families_and_import_fields.sql",
      "0009_directory_family_id.sql",
      "0010_register_taker_role.sql",
      "0011_register_taker_rls.sql",
      "0012_self_service_erasure.sql",
      "0013_directory_consent_types.sql",
      "0014_granular_directory_consent.sql",
      "0015_directory_hidden_consent_type.sql",
      "0016_directory_hidden_rls.sql",
      "0017_directory_visible_consent_type.sql",
      "0018_directory_visible_rls.sql",
      "0019_directory_members_only.sql",
    ]) {
      await admin.query(loadMigrationSql(file));
    }
    await admin.end();
  } catch (err) {
    runAsPgUser(`${path.join(pgBin, "pg_ctl")} -D ${dataDir} -m immediate stop || true`);
    throw err;
  }

  const stop = async () => {
    runAsPgUser(`${path.join(pgBin, "pg_ctl")} -D ${dataDir} -m immediate stop`);
    runAsPgUser(`rm -rf ${dataDir}`);
  };

  const queryAs: RlsCluster["queryAs"] = async (sub, sql, params) => {
    const client = connect();
    await client.connect();
    try {
      await client.query("begin");
      await client.query("set local role authenticated");
      if (sub) {
        await client.query("select set_config('request.jwt.claim.sub', $1, true)", [sub]);
      }
      const result = await client.query(sql, params);
      await client.query("commit");
      return { rows: result.rows, rowCount: result.rowCount };
    } catch (err) {
      await client.query("rollback").catch(() => {});
      throw err;
    } finally {
      await client.end();
    }
  };

  const querySuper: RlsCluster["querySuper"] = async (sql, params) => {
    const client = connect();
    await client.connect();
    try {
      const result = await client.query(sql, params);
      return { rows: result.rows, rowCount: result.rowCount };
    } finally {
      await client.end();
    }
  };

  return { port, dataDir, stop, queryAs, querySuper };
}
