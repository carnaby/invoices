import type { MetadataRoute } from 'next';
import icon192 from '@/assets/pwa/icon-192.png';
import icon512 from '@/assets/pwa/icon-512.png';
import iconMaskable from '@/assets/pwa/icon-maskable-512.png';

// Icons are imported (not placed in /public) so they ship inside .next/static,
// which the standalone Docker image already copies.
export default function manifest(): MetadataRoute.Manifest {
  return {
    id: '/',
    name: 'Faktúry',
    short_name: 'Faktúry',
    description: 'Vystavovanie a evidencia faktúr',
    lang: 'sk',
    start_url: '/dashboard',
    scope: '/',
    display: 'standalone',
    orientation: 'portrait',
    background_color: '#f5f5f7',
    theme_color: '#f5f5f7',
    icons: [
      { src: icon192.src, sizes: '192x192', type: 'image/png', purpose: 'any' },
      { src: icon512.src, sizes: '512x512', type: 'image/png', purpose: 'any' },
      { src: iconMaskable.src, sizes: '512x512', type: 'image/png', purpose: 'maskable' },
    ],
    shortcuts: [{ name: 'Nová faktúra', url: '/invoices/new' }],
  };
}
