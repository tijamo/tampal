import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import type { Profile, Role } from '@/lib/supabase/types';

/** The role an admin is currently previewing the app as -- always equal to
 * their real role unless they're a real admin who's chosen to preview a
 * lower one. */
export type ViewMode = Role;
const VIEW_MODE_COOKIE = 'view_as';
const VIEW_MODES: readonly Role[] = ['admin', 'register_taker', 'member'];

export interface SessionContext {
  userId: string;
  email: string | null;
  profile: Profile | null;
  /** The user's actual role, ignoring the view-mode preview. */
  role: Role;
  /** Effective admin status for this request -- false while an admin is previewing a lower role. */
  isAdmin: boolean;
  /** The user's actual admin status, ignoring the view-mode preview. Only this should gate showing the selector itself. */
  isRealAdmin: boolean;
  /** Effective ability to take/edit attendance registers -- admin or register_taker, respecting
   * the preview. Doesn't include browsing/managing Meetings itself, which stays admin-only;
   * a register_taker reaches a register via Home's per-meeting links instead. */
  canTakeRegister: boolean;
  /** The role currently in effect for this request: the real role for everyone except a
   * previewing admin, who can pick any of the three. */
  viewMode: ViewMode;
}

/**
 * Resolves the current user and their profile/role for a Server Component or
 * Server Action. Redirects to /login if not authenticated.
 */
export async function requireSession(): Promise<SessionContext> {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect('/login');

  const { data: profile } = await supabase
    .from('profiles')
    .select('*')
    .eq('user_id', user.id)
    .maybeSingle();

  const role: Role = (profile?.role as Role | undefined) ?? 'member';
  const isRealAdmin = role === 'admin';
  // Only a real admin can pick a preview role; anyone else's cookie value is
  // irrelevant since viewMode falls back to their own real role, so this can
  // only ever hide privilege, never grant it.
  const cookieValue = cookies().get(VIEW_MODE_COOKIE)?.value;
  const viewMode: ViewMode =
    isRealAdmin && cookieValue && VIEW_MODES.includes(cookieValue as Role)
      ? (cookieValue as Role)
      : role;

  return {
    userId: user.id,
    email: user.email ?? null,
    profile: (profile as Profile) ?? null,
    role,
    isAdmin: viewMode === 'admin',
    isRealAdmin,
    canTakeRegister: viewMode === 'admin' || viewMode === 'register_taker',
    viewMode,
  };
}

/** Like requireSession but redirects non-admins away. */
export async function requireAdmin(): Promise<SessionContext> {
  const ctx = await requireSession();
  if (!ctx.isAdmin) redirect('/');
  return ctx;
}

/** Like requireSession but redirects users who can't take a register away. */
export async function requireRegisterAccess(): Promise<SessionContext> {
  const ctx = await requireSession();
  if (!ctx.canTakeRegister) redirect('/');
  return ctx;
}
