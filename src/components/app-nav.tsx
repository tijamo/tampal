'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';

const links = [
  { href: '/', label: 'Home', adminOnly: false },
  { href: '/meetings', label: 'Meetings', adminOnly: false },
  { href: '/directory', label: 'Directory', adminOnly: false },
  { href: '/people', label: 'People', adminOnly: true },
  { href: '/profile', label: 'My profile', adminOnly: false },
];

export function AppNav({ isAdmin, email }: { isAdmin: boolean; email: string | null }) {
  const pathname = usePathname();

  return (
    <header className="border-b border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900">
      <div className="mx-auto flex max-w-4xl flex-wrap items-center gap-x-4 gap-y-2 px-4 py-3">
        <Link href="/" className="text-xl font-bold text-brand-700">
          TamFam
        </Link>
        <nav aria-label="Primary" className="flex-1">
          <ul className="flex flex-wrap gap-1">
            {links
              .filter((l) => !l.adminOnly || isAdmin)
              .map((l) => {
                const active = l.href === '/' ? pathname === '/' : pathname.startsWith(l.href);
                return (
                  <li key={l.href}>
                    <Link
                      href={l.href}
                      aria-current={active ? 'page' : undefined}
                      className={`inline-flex min-h-touch items-center rounded-md px-3 py-2 font-medium ${
                        active
                          ? 'bg-brand-50 text-brand-800 dark:bg-slate-800 dark:text-brand-100'
                          : 'text-slate-700 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800'
                      }`}
                    >
                      {l.label}
                    </Link>
                  </li>
                );
              })}
          </ul>
        </nav>
        <form action="/auth/signout" method="post" className="flex items-center gap-2">
          {email && (
            <span className="hidden text-sm text-slate-600 dark:text-slate-400 sm:inline">
              {email}
            </span>
          )}
          <button
            type="submit"
            className="inline-flex min-h-touch items-center rounded-md border border-slate-300 px-3 py-2 text-sm font-medium hover:bg-slate-100 dark:border-slate-700 dark:hover:bg-slate-800"
          >
            Sign out
          </button>
        </form>
      </div>
    </header>
  );
}
