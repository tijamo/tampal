'use client';

import { useMemo, useState, type ReactNode } from 'react';
import { personName } from '@/lib/person';
import type { PersonType } from '@/lib/supabase/types';

export interface BrowsablePerson {
  id: string;
  first_name: string;
  surname: string | null;
  person_type: PersonType;
  family_id: string | null;
}

type SortBy = 'surname' | 'surname-desc' | 'first_name' | 'first_name-desc';
type View = 'alphabetical' | 'family';

const SORT_OPTIONS: { value: SortBy; label: string }[] = [
  { value: 'surname', label: 'Surname (A–Z)' },
  { value: 'surname-desc', label: 'Surname (Z–A)' },
  { value: 'first_name', label: 'First name (A–Z)' },
  { value: 'first_name-desc', label: 'First name (Z–A)' },
];

const LETTERS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'.split('');

function sortKey(p: BrowsablePerson, sortBy: SortBy): string {
  return sortBy.startsWith('first_name') ? p.first_name : p.surname ?? '';
}

function compare(a: BrowsablePerson, b: BrowsablePerson, sortBy: SortBy): number {
  const cmp = sortKey(a, sortBy).localeCompare(sortKey(b, sortBy));
  return sortBy.endsWith('-desc') ? -cmp : cmp;
}

function matchesSearch(p: BrowsablePerson, query: string): boolean {
  if (!query) return true;
  return personName(p).toLowerCase().includes(query.toLowerCase());
}

function surnameLetter(p: BrowsablePerson): string {
  const c = (p.surname ?? '').trim().charAt(0).toUpperCase();
  return /[A-Z]/.test(c) ? c : '#';
}

export function PeopleBrowser<T extends BrowsablePerson>({
  people,
  families,
  renderItem,
}: {
  people: T[];
  families: { id: string; name: string }[];
  renderItem: (person: T) => ReactNode;
}) {
  const [query, setQuery] = useState('');
  const [sortBy, setSortBy] = useState<SortBy>('surname');
  const [view, setView] = useState<View>('alphabetical');
  const [activeLetter, setActiveLetter] = useState<string | null>(null);

  const searched = useMemo(
    () => people.filter((p) => matchesSearch(p, query)),
    [people, query],
  );

  const availableLetters = useMemo(
    () => new Set(searched.map(surnameLetter)),
    [searched],
  );

  const familyNames = useMemo(() => new Map(families.map((f) => [f.id, f.name])), [families]);

  if (view === 'family') {
    const groups = new Map<string, T[]>();
    for (const p of searched) {
      const key = p.family_id ?? '__none__';
      const group = groups.get(key) ?? [];
      group.push(p);
      groups.set(key, group);
    }

    const sortedGroupKeys = Array.from(groups.keys()).sort((a, b) => {
      if (a === '__none__') return 1;
      if (b === '__none__') return -1;
      return (familyNames.get(a) ?? '').localeCompare(familyNames.get(b) ?? '');
    });

    return (
      <div className="flex flex-col gap-6">
        <Controls
          query={query}
          onQuery={setQuery}
          sortBy={sortBy}
          onSortBy={setSortBy}
          view={view}
          onView={setView}
        />
        {sortedGroupKeys.length === 0 ? (
          <p className="text-slate-600 dark:text-slate-400">No matches.</p>
        ) : (
          sortedGroupKeys.map((key) => {
            const groupPeople = [...groups.get(key)!].sort((a, b) => compare(a, b, sortBy));
            const title = key === '__none__' ? 'No family' : familyNames.get(key) ?? 'Unknown family';
            return (
              <PersonGroup key={key} title={title} people={groupPeople} renderItem={renderItem} />
            );
          })
        )}
      </div>
    );
  }

  const letterFiltered = activeLetter
    ? searched.filter((p) => surnameLetter(p) === activeLetter)
    : searched;
  const members = letterFiltered.filter((p) => p.person_type === 'member').sort((a, b) => compare(a, b, sortBy));
  const visitors = letterFiltered
    .filter((p) => p.person_type === 'visitor')
    .sort((a, b) => compare(a, b, sortBy));

  return (
    <div className="flex flex-col gap-6">
      <Controls
        query={query}
        onQuery={setQuery}
        sortBy={sortBy}
        onSortBy={setSortBy}
        view={view}
        onView={setView}
      />

      <div className="flex flex-wrap gap-1" role="group" aria-label="Jump to surname">
        <button
          type="button"
          onClick={() => setActiveLetter(null)}
          aria-pressed={activeLetter === null}
          className={`min-h-touch min-w-touch rounded-md px-2 text-sm font-medium ${
            activeLetter === null
              ? 'bg-brand-700 text-white'
              : 'text-slate-600 hover:bg-slate-100 dark:text-slate-400 dark:hover:bg-slate-800'
          }`}
        >
          All
        </button>
        {LETTERS.map((letter) => {
          const has = availableLetters.has(letter);
          return (
            <button
              key={letter}
              type="button"
              disabled={!has}
              onClick={() => setActiveLetter(letter)}
              aria-pressed={activeLetter === letter}
              className={`min-h-touch min-w-touch rounded-md px-2 text-sm font-medium disabled:opacity-30 ${
                activeLetter === letter
                  ? 'bg-brand-700 text-white'
                  : 'text-slate-600 hover:bg-slate-100 dark:text-slate-400 dark:hover:bg-slate-800'
              }`}
            >
              {letter}
            </button>
          );
        })}
      </div>

      <PersonGroup title="Members" people={members} renderItem={renderItem} />
      <PersonGroup title="Visitors" people={visitors} renderItem={renderItem} />
    </div>
  );
}

function Controls({
  query,
  onQuery,
  sortBy,
  onSortBy,
  view,
  onView,
}: {
  query: string;
  onQuery: (v: string) => void;
  sortBy: SortBy;
  onSortBy: (v: SortBy) => void;
  view: View;
  onView: (v: View) => void;
}) {
  return (
    <div className="flex flex-wrap gap-3">
      <div className="flex flex-1 min-w-[10rem] flex-col gap-1">
        <label htmlFor="people-search" className="text-sm font-medium">
          Search
        </label>
        <input
          id="people-search"
          type="search"
          value={query}
          onChange={(e) => onQuery(e.target.value)}
          placeholder="Search by name"
          className="min-h-touch rounded-md border border-slate-400 bg-white px-3 py-2 dark:border-slate-600 dark:bg-slate-950"
        />
      </div>
      <div className="flex flex-col gap-1">
        <label htmlFor="people-sort" className="text-sm font-medium">
          Sort
        </label>
        <select
          id="people-sort"
          value={sortBy}
          onChange={(e) => onSortBy(e.target.value as SortBy)}
          className="min-h-touch rounded-md border border-slate-400 bg-white px-3 py-2 dark:border-slate-600 dark:bg-slate-950"
        >
          {SORT_OPTIONS.map((o) => (
            <option key={o.value} value={o.value}>
              {o.label}
            </option>
          ))}
        </select>
      </div>
      <div className="flex flex-col gap-1">
        <label htmlFor="people-view" className="text-sm font-medium">
          View
        </label>
        <select
          id="people-view"
          value={view}
          onChange={(e) => onView(e.target.value as View)}
          className="min-h-touch rounded-md border border-slate-400 bg-white px-3 py-2 dark:border-slate-600 dark:bg-slate-950"
        >
          <option value="alphabetical">Alphabetical</option>
          <option value="family">By family</option>
        </select>
      </div>
    </div>
  );
}

function PersonGroup<T extends BrowsablePerson>({
  title,
  people,
  renderItem,
}: {
  title: string;
  people: T[];
  renderItem: (person: T) => ReactNode;
}) {
  const headingId = `${title.replace(/\s+/g, '-').toLowerCase()}-heading`;
  return (
    <section aria-labelledby={headingId} className="flex flex-col gap-3">
      <h2 id={headingId} className="text-xl font-semibold">
        {title} <span className="font-normal text-slate-500">({people.length})</span>
      </h2>
      {people.length === 0 ? (
        <p className="text-slate-600 dark:text-slate-400">None.</p>
      ) : (
        <ul className="flex flex-col gap-2">
          {people.map((p) => (
            <li key={p.id}>{renderItem(p)}</li>
          ))}
        </ul>
      )}
    </section>
  );
}
