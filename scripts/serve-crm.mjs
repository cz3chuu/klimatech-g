// Lokalny serwer mini CRM (bez zależności): node scripts/serve-crm.mjs  ->  http://localhost:5180
// Serwuje crm/ oraz /config.js z adresem Supabase i kluczem PUBLICZNYM z n8n/config.local.json
// (klucz secret nigdy nie trafia do przeglądarki; dane chroni logowanie + RLS).
import { createServer } from 'node:http';
import { readFileSync, existsSync } from 'node:fs';
import { extname, join, normalize } from 'node:path';

const PORT = Number(process.env.PORT) || 5180;
const TYPY = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8', '.svg': 'image/svg+xml' };

// Tryb podglądu (/?demo): dane z eksportu Ani przepuszczone przez rdzeń – bez Supabase i bez logowania
async function demo() {
  const { createRequire } = await import('node:module');
  const core = createRequire(import.meta.url)('../n8n/src/core.js');
  const { parseCsv, importLeads } = await import('./import-csv.mjs');
  const handlowcy = parseCsv(readFileSync('data/handlowcy.csv', 'utf8'));
  const wyjatki = parseCsv(readFileSync('data/wyjatki.csv', 'utf8'));
  const teraz = '2026-10-05 12:00';
  const { rows, historia } = importLeads(parseCsv(readFileSync('data/klimatech-leady.csv', 'utf8')), handlowcy, teraz, wyjatki);
  const leady = rows.map(({ token, ...r }) => ({
    ...r,
    klient_id: r.duplikat_typ === 'pewny' && r.duplikat_of ? r.duplikat_of : r.lead_id,
    sla_start: core.slaStart(r.data_zgloszenia),
    czas_reakcji_min: r.pierwszy_kontakt ? core.businessMinutes(r.data_zgloszenia, r.pierwszy_kontakt) : null,
    czeka_min: r.pierwszy_kontakt ? null : core.businessMinutes(r.data_zgloszenia, teraz),
    zsynchronizowano: teraz,
  }));
  // przykładowa nieobecność – pokazuje zakładkę Zespół w podglądzie
  const nieobecnosci = [{ id: 'demo-1', handlowiec_id: 'H1', od_dnia: '2026-10-07', do_dnia: '2026-10-20', zastepca_id: 'H2', powod: 'L4', anulowana: false }];
  return { leady, historia: historia.map((h, i) => ({ id: String(i), ...h })), handlowcy, nieobecnosci };
}

function config() {
  const plik = 'n8n/config.local.json';
  const c = existsSync(plik) ? JSON.parse(readFileSync(plik, 'utf8')) : {};
  return `window.CRM_CONFIG = ${JSON.stringify({ url: c.SUPABASE_URL || '', key: c.SUPABASE_PUBLIC_KEY || '' })};\n`;
}

createServer(async (req, res) => {
  const path = decodeURIComponent(new URL(req.url, 'http://x').pathname);
  if (path === '/demo.json') { res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' }); return res.end(JSON.stringify(await demo())); }
  if (path === '/config.js') { res.writeHead(200, { 'Content-Type': TYPY['.js'], 'Cache-Control': 'no-store' }); return res.end(config()); }
  const plik = normalize(join('crm', path === '/' ? 'index.html' : path));
  if (!plik.startsWith('crm') || !existsSync(plik)) { res.writeHead(404); return res.end('Nie znaleziono'); }
  res.writeHead(200, { 'Content-Type': TYPY[extname(plik)] || 'application/octet-stream', 'Cache-Control': 'no-store' });
  res.end(readFileSync(plik));
}).listen(PORT, () => console.log(`Mini CRM: http://localhost:${PORT}`));
