import { requireSession } from '@/lib/auth';
import { AppNav } from '@/components/app-nav';
import { BottomNav } from '@/components/bottom-nav';
import { AppFooter } from '@/components/app-footer';

/**
 * Layout for all authenticated pages. requireSession() redirects to /login when
 * there is no valid session (defence in depth alongside the middleware).
 */
export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const { isAdmin, isRealAdmin, viewMode, email } = await requireSession();

  return (
    <>
      <AppNav isAdmin={isAdmin} email={email} />
      <main
        id="main"
        className="mx-auto max-w-4xl px-4 py-6 pb-[calc(5rem+env(safe-area-inset-bottom))] sm:pb-6"
      >
        {children}
        <AppFooter isRealAdmin={isRealAdmin} viewMode={viewMode} />
      </main>
      <BottomNav isAdmin={isAdmin} />
    </>
  );
}
