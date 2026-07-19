import type { Metadata } from 'next';

export const metadata: Metadata = { title: 'Offline' };

export default function OfflinePage() {
  return (
    <main id="main" className="mx-auto max-w-md px-4 py-16 text-center">
      <h1 className="text-2xl font-bold">You&apos;re offline</h1>
      <p className="mt-3 text-slate-600 dark:text-slate-400">
        Tampal couldn&apos;t reach the internet. Any attendance you record now is saved on this
        device and will sync automatically once you&apos;re back online.
      </p>
    </main>
  );
}
