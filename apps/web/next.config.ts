import type { NextConfig } from 'next';
const nextConfig: NextConfig = {
  output: 'standalone',
  // The dev-only badge sits over the phone tab bar and swallows taps in e2e tests.
  devIndicators: false,
  transpilePackages: ['@invoices/shared'],
};
export default nextConfig;
