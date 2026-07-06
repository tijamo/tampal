/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  poweredByHeader: false,
  // Emit a self-contained server bundle (.next/standalone) for the Docker image
  // used by Coolify / any container host. Ignored by adapters like Netlify.
  output: 'standalone',
  experimental: {
    // Next 14's client Router Cache otherwise keeps a stale snapshot of a
    // visited page for up to 30s, so navigating back after adding a person or
    // meeting can show the old list even though revalidatePath() already
    // refreshed the server-side data. This data is per-user and RLS-gated, so
    // it must always be fresh, not served from an in-memory client cache.
    staleTimes: { dynamic: 0, static: 0 },
  },
  async headers() {
    // Allow the browser to reach the Supabase API, whether it's Supabase Cloud
    // (*.supabase.co) or a self-hosted instance on a custom domain. We derive the
    // self-hosted origin from NEXT_PUBLIC_SUPABASE_URL so the CSP isn't hardwired.
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    let selfHosted = '';
    if (supabaseUrl) {
      try {
        const { protocol, host } = new URL(supabaseUrl);
        if (!host.endsWith('.supabase.co')) {
          const ws = protocol === 'https:' ? 'wss:' : 'ws:';
          selfHosted = ` ${protocol}//${host} ${ws}//${host}`;
        }
      } catch {
        /* ignore malformed URL; fall back to the *.supabase.co wildcard */
      }
    }

    // Security headers. The app uses only strictly-necessary auth cookies and no
    // third-party scripts, so a tight CSP is achievable.
    const csp = [
      "default-src 'self'",
      // Next.js needs inline styles/scripts for hydration; keep as tight as practical.
      "script-src 'self' 'unsafe-inline'",
      "style-src 'self' 'unsafe-inline'",
      "img-src 'self' data: blob:",
      "font-src 'self'",
      // Supabase REST/Realtime endpoints are reached from the browser.
      `connect-src 'self' https://*.supabase.co wss://*.supabase.co${selfHosted}`,
      "manifest-src 'self'",
      "worker-src 'self'",
      "frame-ancestors 'none'",
      "base-uri 'self'",
      "form-action 'self'",
    ].join('; ');

    return [
      {
        source: '/:path*',
        headers: [
          { key: 'Content-Security-Policy', value: csp },
          { key: 'X-Content-Type-Options', value: 'nosniff' },
          { key: 'X-Frame-Options', value: 'DENY' },
          { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
          { key: 'Permissions-Policy', value: 'camera=(), microphone=(), geolocation=()' },
          {
            key: 'Strict-Transport-Security',
            value: 'max-age=63072000; includeSubDomains; preload',
          },
        ],
      },
      {
        // Never cache the service worker itself.
        source: '/sw.js',
        headers: [{ key: 'Cache-Control', value: 'no-cache, no-store, must-revalidate' }],
      },
    ];
  },
};

module.exports = nextConfig;
