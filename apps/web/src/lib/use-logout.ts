'use client';
import { useRouter } from 'next/navigation';
import { trpc } from './trpc';

/** Logs out, drops every cached query and goes to the login page. */
export function useLogout() {
  const router = useRouter();
  const utils = trpc.useUtils();
  return trpc.auth.logout.useMutation({
    onSuccess: () => {
      utils.invalidate();
      router.replace('/login');
    },
  });
}
