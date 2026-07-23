import type { Metadata } from 'next';
import { requireAdmin } from '@/lib/auth';
import { PageHeading } from '@/components/ui';
import { ImportWizard } from './import-wizard';

export const metadata: Metadata = { title: 'Import people' };

export default async function ImportPeoplePage() {
  await requireAdmin();
  return (
    <div className="flex flex-col gap-6">
      <PageHeading>Import people</PageHeading>
      <ImportWizard />
    </div>
  );
}
