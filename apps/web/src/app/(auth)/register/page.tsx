'use client';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { trpc } from '@/lib/trpc';

export default function RegisterPage() {
  const router = useRouter();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const register = trpc.auth.register.useMutation({ onSuccess: () => router.push('/dashboard') });

  return (
    <main className="flex min-h-screen items-center justify-center p-6">
      <div className="w-full max-w-sm rounded-2xl bg-white p-8 shadow-[0_1px_3px_rgba(0,0,0,0.08)]">
        <h1 className="mb-1 text-2xl font-semibold tracking-tight">Registrácia</h1>
        <p className="mb-6 text-sm text-[#6e6e73]">Vytvorte si nový účet</p>
        <form
          className="space-y-4"
          onSubmit={(e) => { e.preventDefault(); register.mutate({ username, password }); }}
        >
          <input
            data-testid="username" value={username} onChange={(e) => setUsername(e.target.value)}
            placeholder="Prihlasovacie meno" autoComplete="username"
            className="w-full rounded-xl border border-[#e8e8ed] bg-white px-4 py-2.5 text-sm outline-none focus:border-[#0071e3] focus:ring-2 focus:ring-[#0071e3]/20"
          />
          <input
            data-testid="password" type="password" value={password} onChange={(e) => setPassword(e.target.value)}
            placeholder="Heslo" autoComplete="new-password"
            className="w-full rounded-xl border border-[#e8e8ed] bg-white px-4 py-2.5 text-sm outline-none focus:border-[#0071e3] focus:ring-2 focus:ring-[#0071e3]/20"
          />
          {register.error && (
            <p data-testid="form-error" className="text-sm text-[#ff3b30]">{register.error.message}</p>
          )}
          <button
            data-testid="submit" type="submit" disabled={register.isPending}
            className="w-full rounded-xl bg-[#0071e3] py-2.5 text-sm font-medium text-white transition hover:bg-[#0077ed] disabled:opacity-50"
          >
            Zaregistrovať sa
          </button>
        </form>
        <p className="mt-6 text-center text-sm text-[#6e6e73]">
          Máte účet?{' '}
          <Link className="text-[#0071e3] hover:underline" href="/login">Prihláste sa</Link>
        </p>
      </div>
    </main>
  );
}
