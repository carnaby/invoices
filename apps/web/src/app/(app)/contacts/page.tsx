'use client';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { Button, Card, ChevronRightIcon, cn, ConfirmDialog, EmptyState, Input, PageHeader, PlusIcon, TrashIcon } from '@/components/ui';
import { trpc } from '@/lib/trpc';

const cols = 'md:grid-cols-[minmax(0,1.6fr)_7rem_minmax(0,1fr)_minmax(0,1.4fr)_4rem] md:gap-x-4';

export default function ContactsPage() {
  const router = useRouter();
  const utils = trpc.useUtils();
  const [search, setSearch] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [pendingDelete, setPendingDelete] = useState<{ id: string; companyName: string } | null>(null);

  useEffect(() => {
    const t = setTimeout(() => setDebouncedSearch(search), 300);
    return () => clearTimeout(t);
  }, [search]);

  const contacts = trpc.contacts.list.useQuery({ search: debouncedSearch || undefined });
  const remove = trpc.contacts.remove.useMutation({
    onSuccess: () => {
      utils.contacts.list.invalidate();
      setPendingDelete(null);
    },
  });

  const rows = contacts.data ?? [];

  return (
    <div>
      <PageHeader
        title="Kontakty"
        action={
          <Button data-testid="new-contact" onClick={() => router.push('/contacts/new')}>
            <PlusIcon size={18} />
            Nový kontakt
          </Button>
        }
      />

      <Card className="mb-4 sm:mb-6">
        <Input
          type="search"
          data-testid="search"
          placeholder="Hľadať podľa firmy, IČO alebo mesta…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
      </Card>

      <Card className="py-2 sm:py-6">
        {rows.length === 0 ? (
          <EmptyState>Žiadne kontakty.</EmptyState>
        ) : (
          <div role="table" className="text-sm">
            <div
              role="row"
              className={cn('hidden border-b border-line pb-3 text-xs font-medium uppercase tracking-wide text-muted md:grid', cols)}
            >
              <span role="columnheader">Firma</span>
              <span role="columnheader">IČO</span>
              <span role="columnheader">Mesto</span>
              <span role="columnheader">E-mail</span>
              <span role="columnheader" className="text-right">
                Akcie
              </span>
            </div>
            <div className="divide-y divide-line">
              {rows.map((c) => (
                <div
                  key={c.id}
                  role="row"
                  data-testid={`contact-row-${c.companyName}`}
                  className={cn(
                    'grid cursor-pointer grid-cols-[minmax(0,1fr)_auto] items-center gap-x-3 py-3 transition',
                    '-mx-4 px-4 active:bg-canvas sm:-mx-6 sm:px-6 md:mx-0 md:px-0 md:hover:bg-canvas/60',
                    cols,
                  )}
                  onClick={() => router.push(`/contacts/${c.id}`)}
                >
                  <div role="cell" className="min-w-0">
                    <Link
                      href={`/contacts/${c.id}`}
                      onClick={(e) => e.stopPropagation()}
                      className="block truncate font-medium text-ink"
                    >
                      {c.companyName}
                    </Link>
                    {/* Phone: the other columns as one muted line. */}
                    <p className="truncate text-xs text-muted md:hidden">
                      {[c.ico && `IČO ${c.ico}`, c.city, c.email].filter(Boolean).join(' · ') || '—'}
                    </p>
                  </div>
                  <span role="cell" className="hidden md:block">{c.ico || '—'}</span>
                  <span role="cell" className="hidden truncate md:block">{c.city || '—'}</span>
                  <span role="cell" className="hidden truncate md:block">{c.email || '—'}</span>
                  <div role="cell" className="flex items-center justify-end gap-1">
                    <button
                      type="button"
                      data-testid="delete-contact"
                      aria-label="Zmazať kontakt"
                      onClick={(e) => {
                        e.stopPropagation();
                        setPendingDelete({ id: c.id, companyName: c.companyName });
                      }}
                      className="rounded-lg p-2 text-subtle transition hover:bg-danger/10 hover:text-danger md:p-1.5"
                    >
                      <TrashIcon size={18} />
                    </button>
                    <ChevronRightIcon size={18} className="text-subtle md:hidden" />
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </Card>

      <ConfirmDialog
        open={pendingDelete !== null}
        title="Zmazať kontakt?"
        description={pendingDelete ? `Kontakt „${pendingDelete.companyName}“ bude natrvalo odstránený.` : undefined}
        confirmLabel="Zmazať"
        onConfirm={() => pendingDelete && remove.mutate({ id: pendingDelete.id })}
        onCancel={() => setPendingDelete(null)}
      />
    </div>
  );
}
