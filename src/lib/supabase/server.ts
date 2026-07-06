import { createServerClient, type CookieOptions } from '@supabase/ssr';
import { cookies } from 'next/headers';

type CookieToSet = { name: string; value: string; options: CookieOptions };

/**
 * Server-side Supabase client bound to the request's auth cookies. Use in
 * Server Components, Server Actions and Route Handlers. All access is subject to
 * Row-Level Security — this client acts as the signed-in user.
 */
export function createClient() {
  const cookieStore = cookies();

  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet: CookieToSet[]) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options),
            );
          } catch {
            // `set` throws in a Server Component render; the middleware refreshes
            // the session cookie instead, so this is safe to ignore.
          }
        },
      },
      // Next.js patches global fetch to cache GET requests by default; without
      // this, a Server Component's Supabase queries can be served stale by the
      // Data Cache instead of re-checking RLS-gated, per-user data on refresh.
      global: {
        fetch: (input, init) => fetch(input, { ...init, cache: 'no-store' }),
      },
    },
  );
}
