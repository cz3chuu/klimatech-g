// Makiety porannych zestawień (punkt 5 klienta) – generowane TYM SAMYM kodem, który wyśle n8n, na danych z eksportu.
// Użycie: node scripts/makiety-zestawien.mjs [--now "2026-09-25 08:00"] [--handlowiec H2]
//  -> docs/makiety/index.html (przegląd), zestawienie-marka.html, zestawienie-handlowca.html, whatsapp.html
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { createRequire } from 'node:module';
import { parseCsv } from './import-csv.mjs';
const core = createRequire(import.meta.url)('../n8n/src/core.js');

const arg = (n, d) => { const i = process.argv.indexOf(n); return i > -1 ? process.argv[i + 1] : d; };
const NOW = arg('--now', '2026-09-25 08:00');
const KTO = arg('--handlowiec', 'H2');

// fikcyjne numery WhatsApp – tylko po to, żeby makieta pokazała też wersję WhatsApp
const handlowcy = parseCsv(readFileSync('data/handlowcy.csv', 'utf8')).map((h, i) => ({ ...h, whatsapp: h.whatsapp || `4860000000${i + 1}` }));
const wyjatki = parseCsv(readFileSync('data/wyjatki.csv', 'utf8'));
// Te same dane, które są w arkuszu (zapisany wynik importu) – bez ponownego losowania w regionach wspólnych
const rows = parseCsv(readFileSync('data/leady-import.csv', 'utf8'));
const historia = parseCsv(readFileSync('data/historia-import.csv', 'utf8'));
// Stan „na dzień”: tylko leady zgłoszone przed NOW; kontakt zapisany po NOW = lead jeszcze otwarty
const stan = rows.filter((r) => r.data_zgloszenia < NOW)
  .map((r) => (r.pierwszy_kontakt && r.pierwszy_kontakt >= NOW ? { ...r, status: 'nowy', pierwszy_kontakt: '', kontakt_kto: '', proby: 0 } : r));
const cfg = {
  WYJATKI: wyjatki, MAREK_EMAIL: 'marek@klimatech.example', ANIA_EMAIL: 'a.kos@klimatech.example', TRYB_TESTOWY: 'false',
  KANAL: 'oba', STATUS_URL: 'https://n8n.klimatech.pl/webhook/status', PROG_LIDER: '50000', MAREK_WHATSAPP: '48600000009',
};
const z = core.zestawieniaPoranne(stan, historia.filter((h) => h.czas < NOW), handlowcy, cfg, NOW);
const osobiste = z.osobiste.find((o) => o.osoba.id === KTO) || z.osobiste[0];

const esc = (s) => String(s ?? '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const pasek = `<div style="background:#eae9f9;color:#4b45a1;font:bold 13px Arial,sans-serif;text-align:center;padding:8px 16px">Makieta do akceptacji · dane z eksportu klienta · stan na ${esc(NOW)} · linki statusu nieaktywne</div>`;
const strona = (tytul, tresc) => `<!doctype html><html lang="pl"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${esc(tytul)}</title></head>
<body style="margin:0;background:#f2f4f6">${pasek}${tresc}</body></html>`;
const naglowekMaila = (e) => `<div style="max-width:680px;margin:16px auto 0;padding:0 16px;font:13px Arial,sans-serif;color:#5d6a76">
<b>Do:</b> ${esc(e.to)}<br><b>Temat:</b> ${esc(e.subject)}</div>`;
const dymek = (kto, tekst) => {
  // WhatsApp: *pogrubienie*, nowe linie
  const html = esc(tekst).replace(/\*([^*\n]+)\*/g, '<b>$1</b>').replace(/\n/g, '<br>');
  return `<div style="max-width:420px;margin:16px auto;padding:0 16px"><div style="font:bold 13px Arial,sans-serif;color:#5d6a76;margin-bottom:6px">WhatsApp → ${esc(kto)}</div>
<div style="background:#e7ffdb;border-radius:10px;padding:10px 12px;font:14px/1.45 Arial,sans-serif;color:#111b21;box-shadow:0 1px 1px rgba(0,0,0,.12)">${html}
<div style="text-align:right;font-size:11px;color:#667781;margin-top:4px">${esc(NOW.slice(11, 16))} ✓✓</div></div></div>`;
};

mkdirSync('docs/makiety', { recursive: true });
writeFileSync('docs/makiety/zestawienie-marka.html', strona('Zestawienie dla Marka', naglowekMaila(z.marek.email) + z.marek.email.html));
writeFileSync('docs/makiety/zestawienie-handlowca.html', strona(`Zestawienie dla handlowca – ${osobiste.osoba.nazwa}`, naglowekMaila(osobiste.email) + osobiste.email.html));
writeFileSync('docs/makiety/whatsapp.html', strona('Zestawienia na WhatsApp',
  `<div style="background:#efeae2;padding:8px 0 24px">${dymek(osobiste.osoba.nazwa, osobiste.whatsapp.message)}${dymek('Marek', z.marek.whatsapp.message)}</div>`));
writeFileSync('docs/makiety/index.html', strona('Makiety porannych zestawień', `<div style="max-width:680px;margin:24px auto;padding:0 16px;font:15px/1.5 Arial,sans-serif;color:#142029">
<h1 style="font-size:22px;margin:0 0 8px">Poranne zestawienia – makiety do akceptacji</h1>
<p style="margin:0 0 16px;color:#5d6a76">Codziennie o 8:00 w dni robocze. Wygenerowane tym samym kodem, który będzie je wysyłał, na danych z eksportu (stan na ${esc(NOW)}).</p>
<ol>
<li><a href="zestawienie-marka.html">Zbiorcze dla Marka (mail)</a> – ${esc(JSON.stringify(z.marek.liczby))}</li>
<li><a href="zestawienie-handlowca.html">Osobiste dla handlowca (mail) – ${esc(osobiste.osoba.nazwa)}</a></li>
<li><a href="whatsapp.html">Wersje WhatsApp (handlowiec i Marek)</a></li>
</ol>
<p style="color:#5d6a76;font-size:14px">Każdy handlowiec dostaje tylko swoje leady. Zestawienie dostają w tym dniu: ${z.osobiste.map((o) => esc(o.osoba.nazwa)).join(', ')} oraz Marek.</p></div>`));
console.log(`Makiety (${NOW}) -> docs/makiety/: Marek ${JSON.stringify(z.marek.liczby)} · ${osobiste.osoba.nazwa} ${JSON.stringify(osobiste.liczby)}`);
