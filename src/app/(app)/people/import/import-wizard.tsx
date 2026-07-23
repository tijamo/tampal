'use client';

import { useState, useTransition } from 'react';
import { Button, Banner, Card } from '@/components/ui';
import { previewImport, commitImport, type ImportPreview, type ImportResult, type PreviewPerson } from './actions';

const MATCH_LABEL: Record<PreviewPerson['match'], string> = {
  new: 'New person',
  'update-by-ref': 'Update (previously imported)',
  'update-by-email': 'Update (matched by email)',
};

export function ImportWizard() {
  const [preview, setPreview] = useState<ImportPreview | null>(null);
  const [result, setResult] = useState<ImportResult | null>(null);
  const [pending, startTransition] = useTransition();

  if (result) {
    return (
      <Card className="flex flex-col gap-3">
        <h2 className="text-lg font-semibold">Import complete</h2>
        <ul className="text-sm text-slate-700 dark:text-slate-300">
          <li>{result.peopleCreated} people created</li>
          <li>{result.peopleUpdated} people updated</li>
          <li>{result.familiesCreated} families created</li>
          <li>{result.familiesUpdated} families updated</li>
        </ul>
        {result.errors.length > 0 && (
          <Banner tone="error">
            <p className="font-medium">Some rows could not be saved:</p>
            <ul className="mt-1 list-inside list-disc">
              {result.errors.map((e, i) => (
                <li key={i}>{e}</li>
              ))}
            </ul>
          </Banner>
        )}
        <Banner tone="info">
          Imported people have no attendance/contact consent recorded yet &mdash; review and
          capture consent on each person&rsquo;s page before they appear in the directory or
          registers.
        </Banner>
        <div>
          <Button
            variant="secondary"
            onClick={() => {
              setResult(null);
              setPreview(null);
            }}
          >
            Import another file
          </Button>
        </div>
      </Card>
    );
  }

  if (!preview) {
    return (
      <Card className="flex flex-col gap-4">
        <h2 className="text-lg font-semibold">1. Choose a file</h2>
        <p className="text-sm text-slate-600 dark:text-slate-400">
          Upload the &ldquo;People&rdquo; .xlsx export from CHMeetings. Nothing is saved until you
          review and confirm on the next step.
        </p>
        <form
          onSubmit={(e) => {
            e.preventDefault();
            const formData = new FormData(e.currentTarget);
            startTransition(async () => {
              setPreview(await previewImport(formData));
            });
          }}
          className="flex flex-col gap-4"
        >
          <div className="flex flex-col gap-1">
            <label htmlFor="file" className="font-medium">
              CHMeetings export (.xlsx)
            </label>
            <input
              id="file"
              name="file"
              type="file"
              accept=".xlsx"
              required
              className="min-h-touch rounded-md border border-slate-400 bg-white px-3 py-2 dark:border-slate-600 dark:bg-slate-950"
            />
          </div>
          <div>
            <Button type="submit" disabled={pending}>
              {pending ? 'Reading file…' : 'Preview import'}
            </Button>
          </div>
        </form>
      </Card>
    );
  }

  if (preview.error) {
    return (
      <Card className="flex flex-col gap-4">
        <Banner tone="error">{preview.error}</Banner>
        <div>
          <Button variant="secondary" onClick={() => setPreview(null)}>
            Try again
          </Button>
        </div>
      </Card>
    );
  }

  const included = preview.people.filter((p) => p.include);
  const newCount = included.filter((p) => p.match === 'new').length;
  const updateCount = included.length - newCount;

  function toggleInclude(externalRef: string) {
    setPreview((prev) =>
      prev
        ? {
            ...prev,
            people: prev.people.map((p) =>
              p.externalRef === externalRef ? { ...p, include: !p.include } : p,
            ),
          }
        : prev,
    );
  }

  function setPersonType(externalRef: string, personType: 'member' | 'visitor') {
    setPreview((prev) =>
      prev
        ? {
            ...prev,
            people: prev.people.map((p) => (p.externalRef === externalRef ? { ...p, personType } : p)),
          }
        : prev,
    );
  }

  return (
    <div className="flex flex-col gap-4">
      <Card className="flex flex-col gap-2">
        <h2 className="text-lg font-semibold">2. Review</h2>
        <p className="text-sm text-slate-700 dark:text-slate-300">
          {included.length} of {preview.people.length} rows will be imported: {newCount} new,{' '}
          {updateCount} updates to existing people. {preview.families.length} families will be
          created or updated.
        </p>
        {preview.skipped.length > 0 && (
          <Banner tone="info">
            {preview.skipped.length} row(s) were skipped (missing a name or id):{' '}
            {preview.skipped.map((s) => `row ${s.sourceRow} (${s.reason})`).join(', ')}
          </Banner>
        )}
      </Card>

      <Card className="overflow-x-auto">
        <table className="w-full min-w-[40rem] text-left text-sm">
          <thead>
            <tr className="border-b border-slate-200 dark:border-slate-800">
              <th className="py-2 pr-2">Include</th>
              <th className="py-2 pr-2">Name</th>
              <th className="py-2 pr-2">Type</th>
              <th className="py-2 pr-2">Status</th>
              <th className="py-2 pr-2">Email</th>
            </tr>
          </thead>
          <tbody>
            {preview.people.map((p) => (
              <tr key={p.externalRef} className="border-b border-slate-100 dark:border-slate-900">
                <td className="py-2 pr-2">
                  <label className="sr-only" htmlFor={`include-${p.externalRef}`}>
                    Include {p.firstName} {p.surname}
                  </label>
                  <input
                    id={`include-${p.externalRef}`}
                    type="checkbox"
                    checked={p.include}
                    onChange={() => toggleInclude(p.externalRef)}
                    className="h-5 w-5"
                  />
                </td>
                <td className="py-2 pr-2">
                  {p.firstName} {p.surname}
                </td>
                <td className="py-2 pr-2">
                  <label className="sr-only" htmlFor={`type-${p.externalRef}`}>
                    Person type for {p.firstName} {p.surname}
                  </label>
                  <select
                    id={`type-${p.externalRef}`}
                    value={p.personType}
                    disabled={!p.include}
                    onChange={(e) => setPersonType(p.externalRef, e.target.value as 'member' | 'visitor')}
                    className="rounded-md border border-slate-400 bg-white px-2 py-1 dark:border-slate-600 dark:bg-slate-950"
                  >
                    <option value="member">Member</option>
                    <option value="visitor">Visitor</option>
                  </select>
                </td>
                <td className="py-2 pr-2 text-slate-600 dark:text-slate-400">
                  {MATCH_LABEL[p.match]}
                </td>
                <td className="py-2 pr-2 text-slate-600 dark:text-slate-400">{p.email ?? '—'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </Card>

      <div className="flex gap-3">
        <Button variant="secondary" onClick={() => setPreview(null)}>
          Start over
        </Button>
        <Button
          disabled={pending || included.length === 0}
          onClick={() =>
            startTransition(async () => {
              setResult(await commitImport(preview.people, preview.families));
            })
          }
        >
          {pending ? 'Importing…' : `Import ${included.length} people`}
        </Button>
      </div>
    </div>
  );
}
