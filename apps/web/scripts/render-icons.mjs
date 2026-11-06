// Renders the PWA PNG icons from their SVG sources. Run after changing an icon SVG:
//   node apps/web/scripts/render-icons.mjs
import { chromium } from '@playwright/test';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';

const src = (p) => fileURLToPath(new URL(`../src/${p}`, import.meta.url));

const targets = [
  { svg: 'app/icon.svg', out: 'assets/pwa/icon-192.png', size: 192 },
  { svg: 'app/icon.svg', out: 'assets/pwa/icon-512.png', size: 512 },
  { svg: 'assets/pwa/icon-maskable.svg', out: 'assets/pwa/icon-maskable-512.png', size: 512 },
  { svg: 'assets/pwa/icon-apple.svg', out: 'app/apple-icon.png', size: 180 },
];

// CHROMIUM_PATH: use an already installed browser when Playwright's own is missing.
const browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH || undefined });
for (const { svg, out, size } of targets) {
  const markup = (await readFile(src(svg), 'utf8')).replace('<svg ', `<svg width="${size}" height="${size}" `);
  const page = await browser.newPage({ viewport: { width: size, height: size } });
  await page.setContent(`<html><body style="margin:0">${markup}</body></html>`);
  await page.screenshot({ path: src(out), omitBackground: true });
  await page.close();
  console.log(`${out} (${size}px)`);
}
await browser.close();
