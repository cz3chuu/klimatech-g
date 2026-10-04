// Lokalny serwer mini CRM (bez zależności): node scripts/serve-crm.mjs  ->  http://localhost:5180
// Serwuje crm/ oraz /config.js z adresem Supabase i kluczem PUBLICZNYM z n8n/config.local.json
// (klucz secret nigdy nie trafia do przeglądarki; dane chroni logowanie + RLS).
import { createServer } from 'node:http';
import { readFileSync, existsSync } from 'node:fs';
import { extname, join, normalize } from 'node:path';

const PORT = Number(process.env.PORT) || 5180;
const TYPY = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8', '.svg': 'image/svg+xml' };

function config() {
  const plik = 'n8n/config.local.json';
  const c = existsSync(plik) ? JSON.parse(readFileSync(plik, 'utf8')) : {};
  return `window.CRM_CONFIG = ${JSON.stringify({ url: c.SUPABASE_URL || '', key: c.SUPABASE_PUBLIC_KEY || '' })};\n`;
}

createServer((req, res) => {
  const path = decodeURIComponent(new URL(req.url, 'http://x').pathname);
  if (path === '/config.js') { res.writeHead(200, { 'Content-Type': TYPY['.js'], 'Cache-Control': 'no-store' }); return res.end(config()); }
  const plik = normalize(join('crm', path === '/' ? 'index.html' : path));
  if (!plik.startsWith('crm') || !existsSync(plik)) { res.writeHead(404); return res.end('Nie znaleziono'); }
  res.writeHead(200, { 'Content-Type': TYPY[extname(plik)] || 'application/octet-stream', 'Cache-Control': 'no-store' });
  res.end(readFileSync(plik));
}).listen(PORT, () => console.log(`Mini CRM: http://localhost:${PORT}`));
