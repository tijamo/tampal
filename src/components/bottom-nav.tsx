'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { HomeIcon, CalendarIcon, DirectoryIcon, PeopleIcon, ProfileIcon } from './icons';

const links = [
  { href: '/', label: 'Home', icon: HomeIcon, access: 'all' },
  { href: '/meetings', label: 'Meetings', icon: CalendarIcon, access: 'admin' },
  { href: '/directory', label: 'Directory', icon: DirectoryIcon, access: 'all' },
  { href: '/people', label: 'People', icon: PeopleIcon, access: 'admin' },
  { href: '/profile', label: 'Profile', icon: ProfileIcon, access: 'all' },
] as const;

/**
 * Thumb-reachable tab bar for small screens, mirroring AppNav's links.
 * Hidden at sm+ where the top nav's link list takes over instead.
 */
export function BottomNav({ isAdmin }: { isAdmin: boolean }) {
  const pathname = usePathname();
  const items = links.filter((l) => l.access === 'all' || isAdmin);

  return (
    <nav
      aria-label="Primary"
      className="fixed inset-x-0 bottom-0 z-40 border-t border-slate-200 bg-white pb-[env(safe-area-inset-bottom)] sm:hidden dark:border-slate-800 dark:bg-slate-900"
    >
      <ul className="flex">
        {items.map((l) => {
          const active = l.href === '/' ? pathname === '/' : pathname.startsWith(l.href);
          const Icon = l.icon;
          return (
            <li key={l.href} className="flex-1">
              <Link
                href={l.href}
                aria-current={active ? 'page' : undefined}
                className={`flex min-h-touch flex-col items-center justify-center gap-0.5 py-2 text-xs font-medium ${
                  active
                    ? 'text-brand-700 dark:text-brand-300'
                    : 'text-slate-600 dark:text-slate-400'
                }`}
              >
                <Icon className="h-6 w-6" />
                {l.label}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
