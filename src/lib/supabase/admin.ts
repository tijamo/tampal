import { createClient as createSbClient } from '@supabase/supabase-js';

/**
 * Service-role Supabase client that BYPASSES Row-Level Security.
 *
 * SERVER-ONLY. Use exclusively for privileged admin operations that the app has
 * already authorised (invites, GDPR export/erasure). Never import into client
 * components. Every caller must first verify the acting user is an admin.
 */
export function createAdminClient() {
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!key) throw new Error('SUPABASE_SERVICE_ROLE_KEY is not set');
  return createSbClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, key, {
    auth: { autoRefreshToken: false, persistSession: false },
    // Next.js patches global fetch to cache GET requests by default; disable
    // that so admin reads (invites, GDPR export/erasure) are never stale.
    global: {
      fetch: (input, init) => fetch(input, { ...init, cache: 'no-store' }),
    },
  });
}
