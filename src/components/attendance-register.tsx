'use client';

import { useEffect, useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import { enqueueAttendance } from '@/lib/offline-queue';
import { flushAttendanceQueue } from '@/lib/attendance-sync';
import { Banner } from '@/components/ui';

export interface RegisterPerson {
  id: string;
  full_name: string;
  present: boolean;
}

type SaveState = 'saved' | 'saving' | 'queued' | 'error';

/**
 * Touch-first attendance register. Each row is a large (>=44px) toggle button.
 * Writes go straight to Supabase when online; when offline (or on failure) they
 * are queued in IndexedDB and synced later. Optimistic UI keeps it responsive on
 * a tablet in a hall with poor signal.
 */
export function AttendanceRegister({
  meetingId,
  date,
  people,
}: {
  meetingId: string;
  date: string;
  people: RegisterPerson[];
}) {
  const [rows, setRows] = useState(people);
  const [online, setOnline] = useState(true);
  const [state, setState] = useState<Record<string, SaveState>>({});

  useEffect(() => {
    setOnline(navigator.onLine);
    const on = () => {
      setOnline(true);
      void flushAttendanceQueue();
    };
    const off = () => setOnline(false);
    window.addEventListener('online', on);
    window.addEventListener('offline', off);
    return () => {
      window.removeEventListener('online', on);
      window.removeEventListener('offline', off);
    };
  }, []);

  async function toggle(personId: string, next: boolean) {
    setRows((r) => r.map((p) => (p.id === personId ? { ...p, present: next } : p)));
    setState((s) => ({ ...s, [personId]: 'saving' }));

    if (navigator.onLine) {
      try {
        const supabase = createClient();
        const { error } = await supabase.from('attendance').upsert(
          { meeting_id: meetingId, occurrence_date: date, person_id: personId, present: next },
          { onConflict: 'meeting_id,occurrence_date,person_id' },
        );
        if (!error) {
          setState((s) => ({ ...s, [personId]: 'saved' }));
          return;
        }
      } catch {
        // Network/fetch exception (e.g. flaky connection) — fall through to
        // the offline queue below rather than losing this attendance mark.
      }
    }
    // Offline or the write failed: queue for background sync.
    await enqueueAttendance({ meetingId, occurrenceDate: date, personId, present: next });
    setState((s) => ({ ...s, [personId]: 'queued' }));
  }

  const presentCount = rows.filter((r) => r.present).length;

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <p className="font-medium" aria-live="polite">
          {presentCount} of {rows.length} present
        </p>
        {!online && (
          <span className="rounded-full bg-amber-100 px-3 py-1 text-sm font-medium text-amber-900">
            Offline — saved on device
          </span>
        )}
      </div>

      {rows.length === 0 ? (
        <Banner tone="info">
          No one is available to mark. Add people and record their consent to record attendance
          first.
        </Banner>
      ) : (
        <ul className="flex flex-col gap-2">
          {rows.map((p) => {
            const s = state[p.id];
            return (
              <li key={p.id}>
                <button
                  type="button"
                  aria-pressed={p.present}
                  onClick={() => toggle(p.id, !p.present)}
                  className={`flex min-h-touch w-full items-center justify-between gap-3 rounded-lg border px-4 py-3 text-left text-lg transition-colors ${
                    p.present
                      ? 'border-green-600 bg-green-50 text-green-900 dark:bg-green-950 dark:text-green-100'
                      : 'border-slate-300 bg-white text-slate-800 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200'
                  }`}
                >
                  <span className="font-medium">{p.full_name}</span>
                  <span className="flex items-center gap-2">
                    {s === 'queued' && <span className="text-xs text-amber-700">queued</span>}
                    {s === 'error' && <span className="text-xs text-red-700">retry</span>}
                    <span
                      aria-hidden="true"
                      className={`flex h-8 w-8 items-center justify-center rounded-full border-2 ${
                        p.present ? 'border-green-600 bg-green-600 text-white' : 'border-slate-400'
                      }`}
                    >
                      {p.present ? '✓' : ''}
                    </span>
                    <span className="sr-only">{p.present ? 'Present' : 'Not marked'}</span>
                  </span>
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
