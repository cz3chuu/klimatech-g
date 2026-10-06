// Przepuszcza eksport arkusza Ani przez rdzeń i tworzy:
//  - data/leady-import.csv       -> import do zakładki "Leady" w Google Sheets
//  - data/historia-import.csv    -> import do zakładki "Historia"
//  - docs/raport.md              -> liczby do analizy i maila do Marka
// Użycie: node scripts/import-csv.mjs [--now "2026-10-05 08:00"]
import { readFileSync, writeFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { pathToFileURL } from 'node:url';
const require = createRequire(import.meta.url);
const core = require('../n8n/src/core.js');

export const KOLUMNY_LEADY = [
  'lead_id', 'data_zgloszenia', 'zrodlo', 'firma', 'osoba', 'email', 'telefon', 'miasto', 'wojewodztwo',
  'zainteresowanie', 'szac_wartosc_pln', 'wiadomosc', 'telefon_norm', 'firma_klucz', 'wojewodztwo_zrodlo',
  'routing', 'handlowiec_id', 'handlowiec', 'duplikat_of', 'duplikat_typ', 'duplikat_powod', 'status',
  'pierwszy_kontakt', 'kontakt_kto', 'proby', 'sla_poziom', 'token', 'aktualizacja', 'notatka',
];
export const KOLUMNY_HISTORIA = ['czas', 'lead_id', 'zdarzenie', 'kto', 'szczegoly'];

export function parseCsv(text) {
  const rows = []; let row = [], field = '', q = false;
  text = text.replace(/^\uFEFF/, '');
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (q) {
      if (c === '"' && text[i + 1] === '"') { field += '"'; i++; }
      else if (c === '"') q = false;
      else field += c;
    } else if (c === '"') q = true;
    else if (c === ',') { row.push(field); field = ''; }
    else if (c === '\n' || c === '\r') {
      if (c === '\r' && text[i + 1] === '\n') i++;
      row.push(field); field = '';
      if (row.some((v) => v !== '')) rows.push(row);
      row = [];
    } else field += c;
  }
  if (field !== '' || row.length) { row.push(field); rows.push(row); }
  const [head, ...body] = rows;
  return body.map((r) => Object.fromEntries(head.map((h, i) => [h.trim(), (r[i] ?? '').trim()])));
}
const csvCell = (v) => { const s = String(v ?? ''); return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s; };
const toCsv = (cols, rows) => [cols.join(','), ...rows.map((r) => cols.map((c) => csvCell(r[c])).join(','))].join('\n') + '\n';

// Rdzeń na danych historycznych: chronologicznie, każdy lead względem wcześniejszych – według AKTUALNYCH reguł
// (wspólne regiony, wyjątki), więc ponowny import jest też migracją zaległych leadów do nowych opiekunów.
export function importLeads(leadyRaw, handlowcy, now, wyjatki = []) {
  const sorted = [...leadyRaw].sort((a, b) => a.data_zgloszenia.localeCompare(b.data_zgloszenia));
  const out = [], historia = [];
  for (const src of sorted) {
    const { row, dup, wyjatek, podzial } = core.buildLeadRow(src, out, handlowcy, now, { lead_id: src.lead_id, data_zgloszenia: src.data_zgloszenia, wyjatki });
    if (src.pierwszy_kontakt) {
      row.status = 'dodzwoniono';
      row.pierwszy_kontakt = src.pierwszy_kontakt;
      row.kontakt_kto = row.handlowiec_id;
      row.proby = 1;
    }
    // Poziom SLA na moment importu – żeby pierwszy przebieg workflow C nie wysłał zaległych przypomnień hurtem
    if (row.status === 'nowy' && row.duplikat_typ !== 'pewny') row.sla_poziom = core.slaLevelAt(row.data_zgloszenia, now);
    row.aktualizacja = now;
    out.push(row);
    historia.push({ czas: row.data_zgloszenia, lead_id: row.lead_id, zdarzenie: 'import', kto: 'Ania (biuro)', szczegoly: `z arkusza biura; ${row.routing}: ${row.handlowiec || '—'}${wyjatek ? ` (wyjątek: ${wyjatek.opis || wyjatek.wartosc})` : ''}${podzial ? ' (region wspólny)' : ''}${dup ? `; ${dup.typ} duplikat ${dup.original.lead_id} (${dup.powod})` : ''}` });
  }
  // Kontakty z arkusza biura jako wpisy historii – oś czasu w CRM od pierwszego dnia
  out.filter((r) => r.pierwszy_kontakt).forEach((r) => historia.push({
    czas: r.pierwszy_kontakt, lead_id: r.lead_id, zdarzenie: 'status', kto: r.handlowiec || 'biuro', szczegoly: 'Dodzwoniono się (wpis z arkusza biura)',
  }));
  historia.sort((a, b) => a.czas.localeCompare(b.czas));
  return { rows: out.sort((a, b) => a.lead_id.localeCompare(b.lead_id)), historia };
}

export function buildReport(rows, handlowcy, now) {
  const zl = (n) => n.toLocaleString('pl-PL') + ' zł';
  const unikalne = rows.filter((r) => r.duplikat_typ !== 'pewny');
  const kontakt = unikalne.filter((r) => r.pierwszy_kontakt);
  const bezKontaktu = unikalne.filter((r) => !r.pierwszy_kontakt);
  const czasy = kontakt.map((r) => core.businessMinutes(r.data_zgloszenia, r.pierwszy_kontakt)).sort((a, b) => a - b);
  const med = czasy.length ? (czasy.length % 2 ? czasy[(czasy.length - 1) / 2] : (czasy[czasy.length / 2 - 1] + czasy[czasy.length / 2]) / 2) : 0;
  const czeka = bezKontaktu.map((r) => ({ r, min: core.businessMinutes(r.data_zgloszenia, now) }));
  const bezOpiekuna = unikalne.filter((r) => r.routing === 'bez_opiekuna');
  const pokryte = new Set(Object.keys(core.parseHandlowcy(handlowcy)));
  const niepokryte = core.WOJEWODZTWA.filter((w) => !pokryte.has(w));
  const dups = rows.filter((r) => r.duplikat_typ);
  const sum = (a) => a.reduce((s, r) => s + Number(r.szac_wartosc_pln || 0), 0);
  const h = (m) => (m / 60).toFixed(1).replace('.', ',') + ' h';

  const perH = handlowcy.map((x) => {
    const mine = unikalne.filter((r) => r.handlowiec_id === x.handlowiec_id);
    return `| ${x.imie_nazwisko} | ${x.wojewodztwa.replace(/;/g, ', ')} | ${mine.length} | ${mine.filter((r) => r.pierwszy_kontakt).length} | ${zl(sum(mine.filter((r) => !r.pierwszy_kontakt)))} |`;
  });

  return `# Raport z danych – eksport leadów Klimatech

Wygenerowano: \`node scripts/import-csv.mjs\` · stan na: **${now}** · czas liczony w godzinach roboczych (pn–pt 8–16, bez świąt)

## Najważniejsze liczby

| Wskaźnik | Wartość |
|---|---|
| Wpisów w arkuszu | ${rows.length} |
| Unikalnych zapytań (po deduplikacji) | ${unikalne.length} |
| Z kontaktem | ${kontakt.length} (${Math.round((kontakt.length / unikalne.length) * 100)}%) |
| Bez kontaktu | ${bezKontaktu.length}, szac. ${zl(sum(bezKontaktu))} |
| Mediana czasu do 1. kontaktu | ${h(med)} roboczych |
| Kontakt w ≤ 1 h roboczą | ${czasy.filter((m) => m <= 60).length} z ${czasy.length} |
| Kontakt w ≤ 1 dzień roboczy | ${czasy.filter((m) => m <= 480).length} z ${czasy.length} |
| Bez kontaktu > 1 dzień roboczy | ${czeka.filter((x) => x.min > 480).length} |
| Bez kontaktu > 2 dni robocze (eskalacja) | ${czeka.filter((x) => x.min > 960).length} |
| Województwa bez handlowca | ${niepokryte.join(', ') || '—'} |
| Leady w tych województwach | ${bezOpiekuna.length}, szac. ${zl(sum(bezOpiekuna))}, z kontaktem: ${bezOpiekuna.filter((r) => r.pierwszy_kontakt).length} |

## Duplikaty

| Lead | Firma | Duplikat leada | Typ | Dopasowanie |
|---|---|---|---|---|
${dups.map((r) => `| ${r.lead_id} | ${r.firma} | ${r.duplikat_of} | ${r.duplikat_typ} | ${r.duplikat_powod} |`).join('\n')}

## Problemy jakości danych

- Formaty telefonu w arkuszu: ${[...new Set(rows.map((r) => r.telefon.replace(/\d/g, '9')))].map((f) => `\`${f}\``).join(', ')}
- Województwo uzupełnione automatycznie z miasta: ${rows.filter((r) => r.wojewodztwo_zrodlo === 'miasto').map((r) => `${r.lead_id} (${r.miasto} → ${r.wojewodztwo})`).join(', ') || '—'}
- Brak e-maila: ${rows.filter((r) => !r.email).map((r) => r.lead_id).join(', ') || '—'}
- Zgłoszenia w weekend lub po 16:00: ${rows.filter((r) => !core.isBusinessTime(r.data_zgloszenia)).map((r) => r.lead_id).join(', ')}

## Handlowcy

| Handlowiec | Województwa | Zapytań | Z kontaktem | Bez kontaktu (wartość) |
|---|---|---|---|---|
${perH.join('\n')}

## Najdłużej czekające bez kontaktu

| Lead | Firma | Woj. | Opiekun | Wartość | Czeka (robocze) |
|---|---|---|---|---|---|
${czeka.sort((a, b) => b.min - a.min).slice(0, 10).map(({ r, min }) => `| ${r.lead_id} | ${r.firma} | ${r.wojewodztwo} | ${r.handlowiec || '**BRAK**'} | ${zl(Number(r.szac_wartosc_pln))} | ${h(min)} |`).join('\n')}
`;
}

// ---- uruchomienie z CLI ----
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const i = process.argv.indexOf('--now');
  const now = i > -1 ? process.argv[i + 1] : core.nowWarsaw();
  const leady = parseCsv(readFileSync('data/klimatech-leady.csv', 'utf8'));
  // Aktualne przypisania (data/handlowcy.csv) i wyjątki; oryginalny załącznik klienta: data/klimatech-handlowcy.csv
  const handlowcy = parseCsv(readFileSync('data/handlowcy.csv', 'utf8'));
  const wyjatki = parseCsv(readFileSync('data/wyjatki.csv', 'utf8'));
  const { rows, historia } = importLeads(leady, handlowcy, now, wyjatki);
  writeFileSync('data/leady-import.csv', toCsv(KOLUMNY_LEADY, rows));
  writeFileSync('data/historia-import.csv', toCsv(KOLUMNY_HISTORIA, historia));
  if (process.argv.includes('--raport')) writeFileSync('docs/raport.md', buildReport(rows, handlowcy, now));
  console.log(`OK: ${rows.length} leadów -> data/leady-import.csv, data/historia-import.csv (stan na ${now})${process.argv.includes('--raport') ? ', raport -> docs/raport.md' : ''}`);
}
