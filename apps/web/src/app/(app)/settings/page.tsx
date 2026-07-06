'use client';
import { SettingsForm } from '@/components/settings-form';
import { PageHeader } from '@/components/ui';
import { trpc } from '@/lib/trpc';

export default function SettingsPage() {
  const query = trpc.settings.get.useQuery();

  if (query.isLoading || !query.data) return null;

  return (
    <div>
      <PageHeader title="Nastavenia" />
      <SettingsForm initial={query.data} />
    </div>
  );
}
