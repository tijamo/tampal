'use server';

import { cookies } from 'next/headers';
import { revalidatePath } from 'next/cache';
import type { ViewMode } from '@/lib/auth';

/**
 * Lets an admin preview the app as any of the three roles would see it.
 * Purely a display toggle -- it never grants privilege, only ever hides it,
 * since requireSession() only honours this cookie for a real admin and
 * otherwise falls back to the caller's real role.
 */
export async function setViewMode(mode: ViewMode) {
  cookies().set('view_as', mode, {
    httpOnly: true,
    sameSite: 'lax',
    path: '/',
    maxAge: 60 * 60 * 24 * 365,
  });
  revalidatePath('/', 'layout');
}
