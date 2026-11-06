'use client';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { AppMark } from '@/components/ui';
import { trpc } from '@/lib/trpc';

export default function RegisterPage() {
  const router = useRouter();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const register = trpc.auth.register.useMutation({ onSuccess: () => router.push('/dashboard') });
  const registration = trpc.auth.registrationEnabled.useQuery();

  if (registration.data === false) {
    return (
      <main className="pt-safe pb-safe flex min-h-dvh items-center justify-center p-4 sm:p-6">
        <div
          data-testid="registration-closed"
          className="w-full max-w-sm rounded-2xl bg-surface p-8 text-center shadow-card"
        >
          <h1 className="mb-2 text-2xl font-semibold tracking-tight">Registrácia je vypnutá</h1>
          <p className="mb-6 text-sm text-muted">Nové účty sa na tejto inštancii nedajú vytvoriť.</p>
          <Link className="text-sm text-accent hover:underline" href="/login">Prihlásiť sa</Link>
        </div>
      </main>
    );
  }

  return (
    <main className="pt-safe pb-safe flex min-h-dvh items-center justify-center p-4 sm:p-6">
      <div className="w-full max-w-sm rounded-2xl bg-surface p-6 shadow-card sm:p-8">
        <AppMark size={48} className="mb-5" />
        <h1 className="mb-1 text-2xl font-semibold tracking-tight">Registrácia</h1>
        <p className="mb-6 text-sm text-muted">Vytvorte si nový účet</p>
        <form
          className="space-y-4"
          onSubmit={(e) => { e.preventDefault(); register.mutate({ username, password }); }}
        >
          <input
            data-testid="username" value={username} onChange={(e) => setUsername(e.target.value)}
            placeholder="Prihlasovacie meno" autoComplete="username"
            className="w-full rounded-xl border border-line bg-surface px-4 py-2.5 text-base outline-none sm:text-sm focus:border-accent focus:ring-2 focus:ring-accent/20"
          />
          <input
            data-testid="password" type="password" value={password} onChange={(e) => setPassword(e.target.value)}
            placeholder="Heslo" autoComplete="new-password"
            className="w-full rounded-xl border border-line bg-surface px-4 py-2.5 text-base outline-none sm:text-sm focus:border-accent focus:ring-2 focus:ring-accent/20"
          />
          {register.error && (
            <p data-testid="form-error" className="text-sm text-danger">{register.error.message}</p>
          )}
          <button
            data-testid="submit" type="submit" disabled={register.isPending}
            className="min-h-11 w-full rounded-xl bg-accent py-2.5 text-sm font-medium text-white transition hover:bg-accent-hover disabled:opacity-50"
          >
            Zaregistrovať sa
          </button>
        </form>
        <p className="mt-6 text-center text-sm text-muted">
          Máte účet?{' '}
          <Link className="text-accent hover:underline" href="/login">Prihláste sa</Link>
        </p>
      </div>
    </main>
  );
}
