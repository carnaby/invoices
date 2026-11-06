// Service worker at /sw.js (root scope). Served by a route handler because the
// standalone Docker image does not copy /public.
//
// It caches nothing on purpose: invoices are private, money data and every deploy
// must show up right away. It only replaces the browser's error page with an
// offline notice when a page cannot be loaded.
export const dynamic = 'force-static';

const OFFLINE_HTML = `<!doctype html>
<html lang="sk"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover">
<title>Faktúry · offline</title>
<style>
  body{margin:0;min-height:100vh;display:flex;align-items:center;justify-content:center;padding:24px;
    font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;
    background:#f5f5f7;color:#1d1d1f;text-align:center}
  .card{max-width:360px;background:#fff;border-radius:16px;padding:32px;box-shadow:0 1px 3px rgba(0,0,0,.08)}
  h1{font-size:18px;margin:0 0 8px}p{font-size:14px;color:#6e6e73;margin:0 0 24px}
  button{font:inherit;font-size:14px;font-weight:500;border:0;border-radius:999px;padding:10px 20px;
    background:#0071e3;color:#fff}
</style></head>
<body><div class="card"><h1>Ste offline</h1>
<p>Faktúry potrebujú pripojenie na internet. Skontrolujte sieť a skúste to znova.</p>
<button onclick="location.reload()">Skúsiť znova</button></div></body></html>`;

const SW = `
const OFFLINE_HTML = ${JSON.stringify(OFFLINE_HTML)};
self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', (event) => event.waitUntil(self.clients.claim()));
self.addEventListener('fetch', (event) => {
  if (event.request.mode !== 'navigate') return;
  event.respondWith(
    fetch(event.request).catch(
      () => new Response(OFFLINE_HTML, { headers: { 'content-type': 'text/html; charset=utf-8' } }),
    ),
  );
});
`;

export function GET() {
  return new Response(SW, {
    headers: {
      'content-type': 'application/javascript; charset=utf-8',
      // Browsers check for a new worker on every navigation only if this is not cached.
      'cache-control': 'no-cache',
    },
  });
}
