'use client';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { Button, Card, ConfirmDialog, Input, PageHeader, Table, TBody, Td, Th, THead, Tr } from '@/components/ui';
import { trpc } from '@/lib/trpc';

function TrashIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M3 6h18M8 6V4a1 1 0 0 1 1-1h6a1 1 0 0 1 1 1v2m3 0-1 14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2L4 6h16Z"
      />
    </svg>
  );
}

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
            Nový kontakt
          </Button>
        }
      />

      <Card className="mb-6">
        <Input
          data-testid="search"
          placeholder="Hľadať podľa firmy, IČO alebo mesta…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
      </Card>

      <Card>
        {rows.length === 0 ? (
          <p className="py-10 text-center text-sm text-[#6e6e73]">Žiadne kontakty.</p>
        ) : (
          <Table>
            <THead>
              <Tr>
                <Th>Firma</Th>
                <Th>IČO</Th>
                <Th>Mesto</Th>
                <Th>E-mail</Th>
                <Th className="text-right">Akcie</Th>
              </Tr>
            </THead>
            <TBody>
              {rows.map((c) => (
                <Tr
                  key={c.id}
                  data-testid={`contact-row-${c.companyName}`}
                  className="cursor-pointer"
                  onClick={() => router.push(`/contacts/${c.id}`)}
                >
                  <Td className="font-medium">{c.companyName}</Td>
                  <Td>{c.ico || '—'}</Td>
                  <Td>{c.city || '—'}</Td>
                  <Td>{c.email || '—'}</Td>
                  <Td className="text-right">
                    <button
                      type="button"
                      data-testid="delete-contact"
                      aria-label="Zmazať kontakt"
                      onClick={(e) => {
                        e.stopPropagation();
                        setPendingDelete({ id: c.id, companyName: c.companyName });
                      }}
                      className="rounded-lg p-1.5 text-[#8e8e93] transition hover:bg-[#ff3b30]/10 hover:text-[#ff3b30]"
                    >
                      <TrashIcon />
                    </button>
                  </Td>
                </Tr>
              ))}
            </TBody>
          </Table>
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
