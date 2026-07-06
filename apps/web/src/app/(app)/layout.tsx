'use client';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useEffect } from 'react';
import { trpc } from '@/lib/trpc';

const nav = [
  { href: '/dashboard', label: 'Dashboard' },
  { href: '/invoices', label: 'Faktúry' },
  { href: '/contacts', label: 'Kontakty' },
  { href: '/settings', label: 'Nastavenia' },
];

export default function AppLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const me = trpc.auth.me.useQuery();
  const utils = trpc.useUtils();
  const logout = trpc.auth.logout.useMutation({
    onSuccess: () => { utils.invalidate(); router.replace('/login'); },
  });

  useEffect(() => {
    if (me.isSuccess && !me.isFetching && me.data === null) router.replace('/login');
  }, [me.isSuccess, me.isFetching, me.data, router]);

  if (me.isLoading || !me.data) return null;

  return (
    <div className="flex min-h-screen">
      <aside className="fixed inset-y-0 flex w-60 flex-col border-r border-[#e8e8ed] bg-white p-4">
        <div className="mb-8 px-3 text-lg font-semibold tracking-tight">Faktúry</div>
        <nav className="flex flex-1 flex-col gap-1">
          {nav.map((item) => (
            <Link
              key={item.href} href={item.href} data-testid={`nav-${item.href.slice(1)}`}
              className={`rounded-xl px-3 py-2 text-sm font-medium transition ${
                pathname.startsWith(item.href)
                  ? 'bg-[#0071e3]/10 text-[#0071e3]'
                  : 'text-[#1d1d1f] hover:bg-[#f5f5f7]'
              }`}
            >
              {item.label}
            </Link>
          ))}
        </nav>
        <div className="border-t border-[#e8e8ed] pt-3">
          <div data-testid="nav-user" className="truncate px-3 text-sm text-[#6e6e73]">{me.data.username}</div>
          <button
            data-testid="logout" onClick={() => logout.mutate()}
            className="mt-1 w-full rounded-xl px-3 py-2 text-left text-sm text-[#ff3b30] hover:bg-[#f5f5f7]"
          >
            Odhlásiť sa
          </button>
        </div>
      </aside>
      <main className="ml-60 flex-1 p-8">{children}</main>
    </div>
  );
}
