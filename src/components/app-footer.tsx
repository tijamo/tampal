'use client';

import { useTransition } from 'react';
import * as Dialog from '@radix-ui/react-dialog';
import changelog from '@/lib/changelog-data.json';
import { setViewMode } from '@/app/(app)/view-mode-actions';
import type { ViewMode } from '@/lib/auth';

const version = process.env.NEXT_PUBLIC_APP_VERSION ?? 'dev';

const VIEW_MODE_OPTIONS: { value: ViewMode; label: string }[] = [
  { value: 'member', label: 'Member' },
  { value: 'register_taker', label: 'Register Taker' },
  { value: 'admin', label: 'Admin' },
];

/**
 * App version in the footer; tapping it opens the changelog (generated from
 * commit history). Admins additionally get a 3-way pill selector to preview
 * the app as any role would see it -- isRealAdmin (not the effective isAdmin)
 * gates showing the selector, so it stays visible while previewing a lower role.
 */
export function AppFooter({
  isRealAdmin = false,
  viewMode = 'admin',
}: {
  isRealAdmin?: boolean;
  viewMode?: ViewMode;
}) {
  const [pending, startTransition] = useTransition();

  return (
    <footer className="mx-auto mt-8 flex max-w-4xl flex-col items-center gap-2 px-4 pb-6 text-center">
      {isRealAdmin && (
        <div className="flex flex-col items-center gap-1">
          <span className="text-sm font-medium text-slate-600 dark:text-slate-400">
            Viewing as
          </span>
          <div
            role="group"
            aria-label="Preview as role"
            className="inline-flex rounded-full border border-slate-300 p-1 dark:border-slate-700"
          >
            {VIEW_MODE_OPTIONS.map((opt) => (
              <button
                key={opt.value}
                type="button"
                aria-pressed={viewMode === opt.value}
                disabled={pending}
                onClick={() =>
                  startTransition(() => {
                    void setViewMode(opt.value);
                  })
                }
                className={`min-h-touch rounded-full px-3 py-1.5 text-sm font-medium transition-colors disabled:opacity-60 ${
                  viewMode === opt.value
                    ? 'bg-brand-700 text-white'
                    : 'text-slate-600 hover:bg-slate-100 dark:text-slate-400 dark:hover:bg-slate-800'
                }`}
              >
                {opt.label}
              </button>
            ))}
          </div>
        </div>
      )}
      <Dialog.Root>
        <Dialog.Trigger asChild>
          <button
            type="button"
            className="min-h-touch rounded-md px-3 py-2 text-sm text-slate-500 underline-offset-4 hover:underline dark:text-slate-400"
          >
            Tampal v{version}
          </button>
        </Dialog.Trigger>
        <Dialog.Portal>
          <Dialog.Overlay className="fixed inset-0 bg-black/50" />
          <Dialog.Content className="fixed left-1/2 top-1/2 flex max-h-[80vh] w-[min(32rem,92vw)] -translate-x-1/2 -translate-y-1/2 flex-col rounded-lg bg-white p-6 shadow-xl focus:outline-none dark:bg-slate-900">
            <Dialog.Title className="text-lg font-bold">What&rsquo;s new</Dialog.Title>
            <Dialog.Description className="mt-1 text-sm text-slate-600 dark:text-slate-400">
              Recent changes to Tampal.
            </Dialog.Description>
            <ul className="mt-4 flex-1 overflow-y-auto">
              {changelog.map((entry, i) => (
                <li
                  key={`${entry.version}-${i}`}
                  className="border-b border-slate-100 py-3 last:border-0 dark:border-slate-800"
                >
                  <div className="flex items-baseline justify-between gap-3">
                    <span className="font-semibold">v{entry.version}</span>
                    <span className="text-xs text-slate-500 dark:text-slate-400">
                      {new Date(entry.date).toLocaleDateString()}
                    </span>
                  </div>
                  <p className="text-sm text-slate-700 dark:text-slate-300">{entry.message}</p>
                </li>
              ))}
            </ul>
            <div className="mt-4 flex justify-end">
              <Dialog.Close asChild>
                <button
                  type="button"
                  className="min-h-touch rounded-md border border-slate-300 px-4 py-2 text-sm font-medium hover:bg-slate-100 dark:border-slate-700 dark:hover:bg-slate-800"
                >
                  Close
                </button>
              </Dialog.Close>
            </div>
          </Dialog.Content>
        </Dialog.Portal>
      </Dialog.Root>
    </footer>
  );
}
