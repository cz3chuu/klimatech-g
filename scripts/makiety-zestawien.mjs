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
const m = z.marek.liczby, o = osobiste.liczby;
const opisMarka = `nowe ${m.nowe}, obsłużone ${m.obsluzone}, w terminie doby ${m.wTerminie}, otwarte ${m.otwarte}, po terminie ${m.poTerminie}, eskalacje ${m.eskalacje}`;
const opisHandlowca = `zadzwoń dziś ${o.doTelefonuDzis}, nowe ${o.nowe}, otwarte ${o.otwarte}, wczoraj obsłużone ${o.obsluzone}`;
const doAkceptacji = `<ol style="margin:8px 0 0;padding-left:20px">
<li>Godzina wysyłki: <b>8:00 w dni robocze</b> (pn–pt, bez świąt); „wczoraj” = od 8:00 poprzedniego dnia roboczego, w poniedziałek z weekendem.</li>
<li>Handlowiec: sekcje <b>przypomnij dziś · nowe · jeszcze nieobsłużone · wczoraj obsłużone</b>; widzi wyłącznie swoje leady (i leady osoby, którą zastępuje).</li>
<li>Marek: <b>liczby zespołu, tabela handlowców, eskalacje (ponad 2 dni robocze), po terminie doby, duże leady, wczoraj obsłużone</b> – zamiast osobnego maila przy każdym leadzie po 48 h.</li>
<li>Kanał: <b>mail z pełną listą + krótki WhatsApp</b> (5 najpilniejszych). Czy Marek chce też WhatsApp, czy wystarczy mail?</li>
<li>Czy w zestawieniu Marka mają być też wszystkie otwarte leady, czy tylko problemy (jak na makiecie)?</li>
</ol>`;
writeFileSync('docs/makiety/index.html', strona('Makiety porannych zestawień', `<div style="max-width:680px;margin:24px auto;padding:0 16px;font:15px/1.5 Arial,sans-serif;color:#142029">
<h1 style="font-size:22px;margin:0 0 8px">Poranne zestawienia – makiety do akceptacji</h1>
<p style="margin:0 0 16px;color:#5d6a76">Wygenerowane tym samym kodem, który będzie je wysyłał, na danych z eksportu (stan na ${esc(NOW)}).</p>
<ol>
<li><a href="zestawienie-marka.html">Zbiorcze dla Marka (mail)</a> – ${esc(opisMarka)}</li>
<li><a href="zestawienie-handlowca.html">Osobiste dla handlowca (mail) – ${esc(osobiste.osoba.nazwa)}</a> – ${esc(opisHandlowca)}</li>
<li><a href="whatsapp.html">Wersje WhatsApp (handlowiec i Marek)</a></li>
<li><a href="komplet.html">Wszystko na jednej stronie (do wysłania jednym plikiem)</a></li>
</ol>
<h2 style="font-size:16px;margin:20px 0 0">Do akceptacji</h2>${doAkceptacji}
<p style="color:#5d6a76;font-size:14px">Każdy handlowiec dostaje tylko swoje leady. Zestawienie dostają w tym dniu: ${z.osobiste.map((x) => esc(x.osoba.nazwa)).join(', ')} oraz Marek.</p></div>`));

// Komplet: oba zestawienia i WhatsApp na jednej stronie – jeden plik do maila
const naglowekSekcji = (t, opis) => `<div style="max-width:680px;margin:32px auto 0;padding:0 16px;font:15px/1.5 Arial,sans-serif;color:#142029"><h2 style="font-size:19px;margin:0">${t}</h2><p style="margin:2px 0 0;color:#5d6a76">${opis}</p></div>`;
const tresc = `<div style="max-width:680px;margin:24px auto 0;padding:0 16px;font:15px/1.5 Arial,sans-serif;color:#142029">
<h1 style="font-size:24px;margin:0 0 6px">Klimatech – poranne zestawienia (makiety do akceptacji)</h1>
<p style="margin:0;color:#5d6a76">Prawdziwe dane z eksportu arkusza, stan na ${esc(NOW)}. Wygenerowane tym samym kodem, który będzie je wysyłał.</p>
<div style="margin-top:14px;padding:12px 14px;background:#ffffff;border:1px solid #e1e6eb;border-radius:10px"><b>Do akceptacji</b>${doAkceptacji}</div></div>
${naglowekSekcji('1. Zbiorcze dla Marka – mail', esc(opisMarka))}${naglowekMaila(z.marek.email)}${z.marek.email.html}
${naglowekSekcji(`2. Osobiste dla handlowca – mail (${esc(osobiste.osoba.nazwa)})`, esc(opisHandlowca))}${naglowekMaila(osobiste.email)}${osobiste.email.html}
${naglowekSekcji('3. Wersje WhatsApp', 'Krótko – do przeczytania w trasie; pełna lista w mailu.')}
<div style="background:#efeae2;padding:8px 0 24px;margin-top:12px">${dymek(osobiste.osoba.nazwa, osobiste.whatsapp.message)}${dymek('Marek', z.marek.whatsapp.message)}</div>`;
writeFileSync('docs/makiety/komplet.html', strona('Klimatech – poranne zestawienia (makiety)', tresc));
// Wersja do publikacji jako strona (bez szkieletu dokumentu – dokłada go publikacja)
const artefakt = process.argv.indexOf('--strona') > -1 ? process.argv[process.argv.indexOf('--strona') + 1] : '';
if (artefakt) writeFileSync(artefakt, `<title>Poranne zestawienia Klimatech</title>
<style>:root{color-scheme:light}body{background:#f2f4f6;color:#142029;margin:0}a{color:#0e5c88}</style>
${pasek}${tresc}`);
console.log(`Makiety (${NOW}) -> docs/makiety/: Marek ${JSON.stringify(z.marek.liczby)} · ${osobiste.osoba.nazwa} ${JSON.stringify(osobiste.liczby)}`);
