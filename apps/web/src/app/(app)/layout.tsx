'use client';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useEffect, type ComponentType } from 'react';
import {
  AppMark,
  buttonClasses,
  cn,
  ContactsIcon,
  HomeIcon,
  InvoiceIcon,
  LogoutIcon,
  PlusIcon,
  SettingsIcon,
} from '@/components/ui';
import { trpc } from '@/lib/trpc';

type NavItem = { href: string; label: string; icon: ComponentType<{ size?: number }> };

const nav: NavItem[] = [
  { href: '/dashboard', label: 'Prehľad', icon: HomeIcon },
  { href: '/invoices', label: 'Faktúry', icon: InvoiceIcon },
  { href: '/contacts', label: 'Kontakty', icon: ContactsIcon },
  { href: '/settings', label: 'Nastavenia', icon: SettingsIcon },
];

function NavLink({ item, active }: { item: NavItem; active: boolean }) {
  const Icon = item.icon;
  return (
    <Link
      href={item.href}
      data-testid={`nav-${item.href.slice(1)}`}
      aria-current={active ? 'page' : undefined}
      className={cn(
        // Phone: icon above a small label in the tab bar. Desktop: a sidebar row.
        'flex flex-1 flex-col items-center gap-0.5 py-1.5 text-[11px] font-medium transition',
        'lg:flex-none lg:flex-row lg:gap-3 lg:rounded-xl lg:px-3 lg:py-2 lg:text-sm',
        active ? 'text-accent lg:bg-accent/10' : 'text-muted hover:text-ink lg:text-ink lg:hover:bg-canvas',
      )}
    >
      <Icon size={24} />
      <span>{item.label}</span>
    </Link>
  );
}

export default function AppLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const me = trpc.auth.me.useQuery();
  const utils = trpc.useUtils();
  const logout = trpc.auth.logout.useMutation({
    onSuccess: () => {
      utils.invalidate();
      router.replace('/login');
    },
  });

  useEffect(() => {
    if (me.isSuccess && !me.isFetching && me.data === null) router.replace('/login');
  }, [me.isSuccess, me.isFetching, me.data, router]);

  if (me.isError) {
    return (
      <div className="flex min-h-dvh items-center justify-center p-6">
        <div data-testid="api-error" className="w-full max-w-md rounded-2xl bg-surface p-8 text-center shadow-card">
          <h1 className="text-lg font-semibold tracking-tight text-ink">Server nie je dostupný</h1>
          <p className="mt-2 text-sm text-muted">
            Aplikácia sa nevie spojiť s API. Skontroluj, či beží API a databáza (pnpm dev).
          </p>
          <button
            data-testid="api-retry"
            onClick={() => me.refetch()}
            disabled={me.isFetching}
            className="mt-6 rounded-full bg-accent px-5 py-2 text-sm font-medium text-white hover:bg-accent-hover disabled:opacity-50"
          >
            {me.isFetching ? 'Skúšam…' : 'Skúsiť znova'}
          </button>
        </div>
      </div>
    );
  }

  if (me.isLoading || !me.data) return null;

  const [first, ...rest] = nav;
  const isActive = (href: string) => pathname.startsWith(href);
  const newInvoiceActive = pathname === '/invoices/new';

  return (
    <div className="min-h-dvh lg:pl-64">
      {/* Phone/tablet top bar */}
      <header className="pt-safe sticky top-0 z-30 border-b border-line/70 bg-canvas/85 backdrop-blur-md lg:hidden">
        <div className="flex h-12 items-center justify-between px-4 sm:px-6">
          <Link href="/dashboard" className="flex items-center gap-2 font-semibold tracking-tight">
            <AppMark size={26} />
            Faktúry
          </Link>
          <Link
            href="/settings"
            aria-label={`Účet ${me.data.username}`}
            className="flex h-8 w-8 items-center justify-center rounded-full bg-accent/10 text-sm font-semibold uppercase text-accent"
          >
            {me.data.username.slice(0, 1)}
          </Link>
        </div>
      </header>

      {/* One navigation: bottom tab bar on phones, sidebar from lg up. */}
      <aside
        className={cn(
          'pb-safe fixed inset-x-0 bottom-0 z-40 border-t border-line bg-surface/90 backdrop-blur-md',
          'lg:inset-x-auto lg:inset-y-0 lg:left-0 lg:flex lg:w-64 lg:flex-col lg:border-t-0 lg:border-r lg:bg-surface lg:p-4 lg:backdrop-blur-none',
        )}
      >
        <Link href="/dashboard" className="mb-6 hidden items-center gap-2.5 px-3 pt-1 text-lg font-semibold tracking-tight lg:flex">
          <AppMark size={30} />
          Faktúry
        </Link>
        <nav className="mx-auto flex max-w-lg items-stretch px-2 lg:mx-0 lg:max-w-none lg:flex-1 lg:flex-col lg:gap-1 lg:px-0">
          <NavLink item={first} active={isActive(first.href)} />
          <NavLink item={rest[0]} active={isActive(rest[0].href) && !newInvoiceActive} />
          <Link
            href="/invoices/new"
            data-testid="nav-new-invoice"
            aria-label="Nová faktúra"
            className={cn(
              'flex flex-1 items-center justify-center',
              'lg:order-first lg:mb-4 lg:flex-none',
              buttonClasses('primary', 'lg:w-full'),
              // Phone: round floating button in the middle of the tab bar.
              'max-lg:-mt-5 max-lg:h-14 max-lg:w-14 max-lg:flex-none max-lg:self-start max-lg:rounded-full max-lg:p-0 max-lg:shadow-lg max-lg:shadow-accent/30 max-lg:mx-3',
            )}
          >
            <PlusIcon size={22} />
            <span className="hidden lg:inline">Nová faktúra</span>
          </Link>
          {rest.slice(1).map((item) => (
            <NavLink key={item.href} item={item} active={isActive(item.href)} />
          ))}
        </nav>
        <div className="hidden border-t border-line pt-3 lg:block">
          <div data-testid="nav-user" className="truncate px-3 text-sm text-muted">
            {me.data.username}
          </div>
          <button
            data-testid="logout"
            onClick={() => logout.mutate()}
            className="mt-1 flex w-full items-center gap-3 rounded-xl px-3 py-2 text-left text-sm text-danger hover:bg-canvas"
          >
            <LogoutIcon size={18} />
            Odhlásiť sa
          </button>
        </div>
      </aside>

      <main className="mx-auto max-w-6xl px-4 pt-4 pb-[calc(6rem+env(safe-area-inset-bottom))] sm:px-6 sm:pt-6 lg:px-8 lg:py-8">
        {children}
      </main>
    </div>
  );
}
