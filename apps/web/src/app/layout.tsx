import type { Metadata, Viewport } from 'next';
import './globals.css';
import { Providers } from './providers';
import { ServiceWorker } from './service-worker';

export const metadata: Metadata = {
  title: 'Faktúry',
  applicationName: 'Faktúry',
  appleWebApp: { capable: true, title: 'Faktúry', statusBarStyle: 'default' },
  formatDetection: { telephone: false },
};

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  viewportFit: 'cover',
  themeColor: '#f5f5f7',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="sk">
      <body>
        <Providers>{children}</Providers>
        <ServiceWorker />
      </body>
    </html>
  );
}
