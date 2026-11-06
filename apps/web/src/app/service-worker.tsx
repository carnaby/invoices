'use client';
import { useEffect } from 'react';

/** Registers /sw.js so the app can be installed and shows an offline page.
 * Only in production builds: in `next dev` it would just add noise. */
export function ServiceWorker() {
  useEffect(() => {
    if (process.env.NODE_ENV !== 'production' || !('serviceWorker' in navigator)) return;
    navigator.serviceWorker.register('/sw.js').catch(() => {
      // Not fatal: the app works the same without it.
    });
  }, []);
  return null;
}
