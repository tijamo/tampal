'use client';

import { useState, useTransition } from 'react';
import Link from 'next/link';
import { Button } from '@/components/ui';
import { renameFamily, setPrimaryContact, deleteFamily } from '@/app/(app)/families/actions';
import { personName } from '@/lib/person';
import type { Person } from '@/lib/supabase/types';

export function FamilyCard({
  familyId,
  name,
  members,
  primaryContactId,
}: {
  familyId: string;
  name: string;
  members: Person[];
  primaryContactId: string | null;
}) {
  const [pending, startTransition] = useTransition();
  const [editingName, setEditingName] = useState(false);
  const [nameDraft, setNameDraft] = useState(name);

  return (
    <div className="flex flex-col gap-3 rounded-lg border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900">
      <div className="flex flex-wrap items-center justify-between gap-2">
        {editingName ? (
          <form
            className="flex items-center gap-2"
            onSubmit={(e) => {
              e.preventDefault();
              startTransition(async () => {
                await renameFamily(familyId, nameDraft);
                setEditingName(false);
              });
            }}
          >
            <label htmlFor={`name-${familyId}`} className="sr-only">
              Family name
            </label>
            <input
              id={`name-${familyId}`}
              value={nameDraft}
              onChange={(e) => setNameDraft(e.target.value)}
              className="min-h-touch rounded-md border border-slate-400 px-3 py-1 dark:border-slate-600 dark:bg-slate-950"
            />
            <Button type="submit" variant="secondary" disabled={pending}>
              Save
            </Button>
          </form>
        ) : (
          <h3 className="text-lg font-semibold">{name}</h3>
        )}
        <div className="flex gap-2">
          {!editingName && (
            <Button variant="secondary" onClick={() => setEditingName(true)}>
              Rename
            </Button>
          )}
          <Button
            variant="secondary"
            disabled={pending}
            onClick={() => {
              if (confirm(`Remove the “${name}” family group? Members keep their own records.`)) {
                startTransition(() => {
                  void deleteFamily(familyId);
                });
              }
            }}
          >
            Remove
          </Button>
        </div>
      </div>

      {members.length === 0 ? (
        <p className="text-sm text-slate-600 dark:text-slate-400">
          No members assigned yet. Add people to this family from their person page.
        </p>
      ) : (
        <>
          <ul className="flex flex-col gap-1">
            {members.map((m) => (
              <li key={m.id} className="flex items-center justify-between gap-2">
                <Link href={`/people/${m.id}`} className="text-brand-700 underline">
                  {personName(m)}
                </Link>
                {m.id === primaryContactId && (
                  <span className="rounded-full bg-brand-50 px-2 py-0.5 text-xs font-medium text-brand-800 dark:bg-slate-800 dark:text-brand-200">
                    Primary contact
                  </span>
                )}
              </li>
            ))}
          </ul>

          <div className="flex flex-col gap-1">
            <label htmlFor={`primary-${familyId}`} className="text-sm font-medium">
              Primary contact
            </label>
            <select
              id={`primary-${familyId}`}
              defaultValue={primaryContactId ?? ''}
              disabled={pending}
              onChange={(e) =>
                startTransition(() => {
                  void setPrimaryContact(familyId, e.target.value || null);
                })
              }
              className="min-h-touch rounded-md border border-slate-400 bg-white px-3 py-2 dark:border-slate-600 dark:bg-slate-950"
            >
              <option value="">None set</option>
              {members.map((m) => (
                <option key={m.id} value={m.id}>
                  {personName(m)}
                </option>
              ))}
            </select>
          </div>
        </>
      )}
    </div>
  );
}
