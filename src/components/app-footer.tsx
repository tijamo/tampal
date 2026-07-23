'use client';

import * as Dialog from '@radix-ui/react-dialog';
import changelog from '@/lib/changelog-data.json';
import { ToggleSwitch } from '@/components/toggle-switch';
import { setViewMode } from '@/app/(app)/view-mode-actions';
import type { ViewMode } from '@/lib/auth';

const version = process.env.NEXT_PUBLIC_APP_VERSION ?? 'dev';

/**
 * App version in the footer; tapping it opens the changelog (generated from
 * commit history). Admins additionally get a switch to preview the app as a
 * normal member would see it -- isRealAdmin (not the effective isAdmin) gates
 * showing the switch, so it stays visible while previewing member view.
 */
export function AppFooter({
  isRealAdmin = false,
  viewMode = 'admin',
}: {
  isRealAdmin?: boolean;
  viewMode?: ViewMode;
}) {
  return (
    <footer className="mx-auto mt-8 flex max-w-4xl flex-col items-center gap-2 px-4 pb-6 text-center">
      {isRealAdmin && (
        <div className="w-full max-w-xs">
          <ToggleSwitch
            id="view-mode"
            label="Admin view"
            granted={viewMode === 'admin'}
            onToggle={(checked) => setViewMode(checked ? 'admin' : 'member')}
            onLabel="Admin"
            offLabel="Member"
          />
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
