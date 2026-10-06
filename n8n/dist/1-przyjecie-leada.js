// WYGENEROWANE przez scripts/build-n8n.mjs – nie edytuj ręcznie, zmieniaj n8n/src/*
// Kod konkretnego węzła jest NA DOLE pliku.

// =====================================================================
// KLIMATECH – RDZEŃ LOGIKI LEADÓW
// Jedno źródło prawdy. Używane przez:
//  - węzły Code w n8n (wklejane z n8n/dist/*.js, budowane skryptem)
//  - skrypt importu historycznych danych (scripts/import-csv.mjs)
//  - testy (test/core.test.mjs)
// Czysty JavaScript, bez zależności (węzeł Code w n8n nie ma npm).
// Czas: wszystkie daty to czas lokalny Warszawy w formacie "YYYY-MM-DD HH:mm".
// =====================================================================

const WOJEWODZTWA = [
  'dolnośląskie', 'kujawsko-pomorskie', 'lubelskie', 'lubuskie', 'łódzkie',
  'małopolskie', 'mazowieckie', 'opolskie', 'podkarpackie', 'podlaskie',
  'pomorskie', 'śląskie', 'świętokrzyskie', 'warmińsko-mazurskie',
  'wielkopolskie', 'zachodniopomorskie',
];

// Fallback gdy brak województwa. Produkcyjnie: kod pocztowy -> TERYT.
const MIASTA = {
  'warszawa': 'mazowieckie', 'radom': 'mazowieckie', 'płock': 'mazowieckie', 'siedlce': 'mazowieckie',
  'kraków': 'małopolskie', 'tarnów': 'małopolskie', 'nowy sącz': 'małopolskie',
  'łódź': 'łódzkie', 'piotrków trybunalski': 'łódzkie',
  'wrocław': 'dolnośląskie', 'legnica': 'dolnośląskie', 'wałbrzych': 'dolnośląskie',
  'poznań': 'wielkopolskie', 'kalisz': 'wielkopolskie', 'konin': 'wielkopolskie',
  'gdańsk': 'pomorskie', 'gdynia': 'pomorskie', 'sopot': 'pomorskie', 'słupsk': 'pomorskie',
  'szczecin': 'zachodniopomorskie', 'koszalin': 'zachodniopomorskie',
  'bydgoszcz': 'kujawsko-pomorskie', 'toruń': 'kujawsko-pomorskie', 'włocławek': 'kujawsko-pomorskie',
  'lublin': 'lubelskie', 'zamość': 'lubelskie', 'chełm': 'lubelskie',
  'białystok': 'podlaskie', 'suwałki': 'podlaskie', 'łomża': 'podlaskie',
  'katowice': 'śląskie', 'gliwice': 'śląskie', 'częstochowa': 'śląskie', 'bielsko-biała': 'śląskie',
  'kielce': 'świętokrzyskie', 'ostrowiec świętokrzyski': 'świętokrzyskie',
  'rzeszów': 'podkarpackie', 'krosno': 'podkarpackie', 'przemyśl': 'podkarpackie',
  'olsztyn': 'warmińsko-mazurskie', 'elbląg': 'warmińsko-mazurskie',
  'opole': 'opolskie',
  'zielona góra': 'lubuskie', 'gorzów wielkopolski': 'lubuskie', 'żary': 'lubuskie',
};

const DARMOWE_DOMENY = ['gmail.com', 'wp.pl', 'o2.pl', 'onet.pl', 'interia.pl', 'op.pl', 'poczta.onet.pl', 'outlook.com', 'hotmail.com', 'yahoo.com', 'icloud.com', 'tlen.pl', 'gazeta.pl'];
const SLOWA_POMIJANE = ['phu', 'pphu', 'fhu', 'zph', 'ppuh', 'phup', 'firma', 'przedsiębiorstwo', 'zakład'];

const STATUSY = ['nowy', 'nie_odebral', 'dodzwoniono', 'umowione', 'niezainteresowany'];
const STATUSY_ZAMYKAJACE_SLA = ['dodzwoniono', 'umowione', 'niezainteresowany'];
const STATUS_ETYKIETY = { nowy: 'Nowy', nie_odebral: 'Nie odebrał', dodzwoniono: 'Dodzwoniono się', umowione: 'Umówione spotkanie', niezainteresowany: 'Niezainteresowany' };

const GODZ_OD = 8, GODZ_DO = 16;
// Progi SLA (ustalone z klientem):
//  1 – przypomnienie po 4 h roboczych,
//  2 – „doba robocza”: termin do 16:00 NASTĘPNEGO dnia roboczego po dniu zgłoszenia,
//  3 – eskalacja: termin do 16:00 DRUGIEGO dnia roboczego po dniu zgłoszenia.
// Osobna wiadomość tylko przy progu 1. Termin doby i eskalacja trafiają do porannych zestawień (8:00):
// „termin dziś” – rano, zanim minie; „po terminie” i eskalacje – handlowiec i Marek.
const SLA_PROGI = [240];

// ---------------- Czas ----------------

function parseLocal(s) {
  const m = String(s || '').trim().match(/^(\d{4})-(\d{2})-(\d{2})[ T](\d{2}):(\d{2})/);
  if (!m) return null;
  return new Date(Date.UTC(+m[1], +m[2] - 1, +m[3], +m[4], +m[5]));
}
function formatLocal(d) {
  return d.toISOString().slice(0, 16).replace('T', ' ');
}
function nowWarsaw() {
  const s = new Intl.DateTimeFormat('sv-SE', {
    timeZone: 'Europe/Warsaw', year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit', hour12: false,
  }).format(new Date());
  return s.replace(',', '').slice(0, 16);
}

function easter(y) { // algorytm Meeusa/Jonesa/Butchera
  const a = y % 19, b = Math.floor(y / 100), c = y % 100, d = Math.floor(b / 4), e = b % 4;
  const f = Math.floor((b + 8) / 25), g = Math.floor((b - f + 1) / 3);
  const h = (19 * a + b - d - g + 15) % 30, i = Math.floor(c / 4), k = c % 4;
  const l = (32 + 2 * e + 2 * i - h - k) % 7, m = Math.floor((a + 11 * h + 22 * l) / 451);
  const month = Math.floor((h + l - 7 * m + 114) / 31), day = ((h + l - 7 * m + 114) % 31) + 1;
  return new Date(Date.UTC(y, month - 1, day));
}
const _swieta = {};
function holidays(y) {
  if (_swieta[y]) return _swieta[y];
  const iso = (d) => d.toISOString().slice(0, 10);
  const plus = (d, n) => new Date(d.getTime() + n * 864e5);
  const e = easter(y);
  const stale = ['01-01', '01-06', '05-01', '05-03', '08-15', '11-01', '11-11', '12-25', '12-26'];
  if (y >= 2025) stale.push('12-24'); // Wigilia wolna od 2025
  const set = new Set(stale.map((md) => `${y}-${md}`));
  [e, plus(e, 1), plus(e, 49), plus(e, 60)].forEach((d) => set.add(iso(d))); // Wielkanoc, pon., Zielone Świątki, Boże Ciało
  _swieta[y] = set;
  return set;
}
function isBusinessDay(d) {
  const wd = d.getUTCDay();
  return wd !== 0 && wd !== 6 && !holidays(d.getUTCFullYear()).has(d.toISOString().slice(0, 10));
}
function isBusinessTime(s) {
  const d = parseLocal(s);
  return !!d && isBusinessDay(d) && d.getUTCHours() >= GODZ_OD && d.getUTCHours() < GODZ_DO;
}
// Minuty robocze (pn–pt 8–16, bez świąt) między dwiema datami
function businessMinutes(fromStr, toStr) {
  const a = parseLocal(fromStr), b = parseLocal(toStr);
  if (!a || !b || b <= a) return 0;
  let total = 0;
  const day = new Date(Date.UTC(a.getUTCFullYear(), a.getUTCMonth(), a.getUTCDate()));
  while (day <= b) {
    if (isBusinessDay(day)) {
      const s = new Date(day.getTime() + GODZ_OD * 36e5), e = new Date(day.getTime() + GODZ_DO * 36e5);
      const from = a > s ? a : s, to = b < e ? b : e;
      if (to > from) total += (to - from) / 6e4;
    }
    day.setUTCDate(day.getUTCDate() + 1);
  }
  return Math.round(total);
}
// Moment startu zegara SLA (lead po 16:00 lub w weekend -> następny dzień roboczy 8:00)
function slaStart(createdStr) {
  const d = parseLocal(createdStr);
  if (!d) return null;
  if (isBusinessTime(createdStr)) return createdStr;
  const day = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
  if (!isBusinessDay(day) || d.getUTCHours() >= GODZ_DO) day.setUTCDate(day.getUTCDate() + 1);
  while (!isBusinessDay(day)) day.setUTCDate(day.getUTCDate() + 1);
  return formatLocal(new Date(day.getTime() + GODZ_OD * 36e5));
}
// n-ty dzień roboczy po dniu daty (data „YYYY-MM-DD…”) -> „YYYY-MM-DD”
function dzienRoboczyPo(dataStr, n) {
  const d = parseLocal(String(dataStr).slice(0, 10) + ' 00:00');
  if (!d) return '';
  for (let k = 0; k < n;) { d.setUTCDate(d.getUTCDate() + 1); if (isBusinessDay(d)) k++; }
  return d.toISOString().slice(0, 10);
}
const koniecDnia = (dzien) => (dzien ? `${dzien} ${String(GODZ_DO).padStart(2, '0')}:00` : '');
function terminDoby(createdStr) { return parseLocal(createdStr) ? koniecDnia(dzienRoboczyPo(createdStr, 1)) : ''; }
function terminEskalacji(createdStr) { return parseLocal(createdStr) ? koniecDnia(dzienRoboczyPo(createdStr, 2)) : ''; }
// Poziom SLA leada bez kontaktu w chwili now: 0 brak, 1 > 4 h, 2 po terminie doby, 3 eskalacja
function slaLevelAt(createdStr, now) {
  if (!parseLocal(createdStr) || !parseLocal(now)) return 0;
  const n = String(now).slice(0, 16);
  if (n >= terminEskalacji(createdStr)) return 3;
  if (n >= terminDoby(createdStr)) return 2;
  return businessMinutes(createdStr, n) >= SLA_PROGI[0] ? 1 : 0;
}
function fmtGodziny(min) {
  const h = Math.floor(min / 60), m = min % 60;
  return h ? `${h} h ${m} min` : `${m} min`;
}

// ---------------- Normalizacja ----------------

function normalizePhone(raw) {
  let d = String(raw ?? '').replace(/\D/g, '');
  if (d.startsWith('0048')) d = d.slice(4);
  else if (d.length === 11 && d.startsWith('48')) d = d.slice(2);
  return d.length === 9 ? '+48' + d : '';
}
function formatPhone(norm) {
  return norm ? norm.replace(/^\+48(\d{3})(\d{3})(\d{3})$/, '+48 $1 $2 $3') : '';
}
function normalizeEmail(raw) {
  const e = String(raw ?? '').trim().toLowerCase();
  return /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(e) ? e : '';
}
function emailDomain(email) {
  const d = email.split('@')[1] || '';
  return DARMOWE_DOMENY.includes(d) ? '' : d;
}
// "ZPH Termex" i "Termex ZPH Sp. j." -> "termex"
function companyKey(raw) {
  let s = String(raw ?? '').toLowerCase();
  s = s.replace(/\bsp(ółka|\.)?\s*z\s*o\.?\s*o\.?/g, ' ')
    .replace(/\bsp(ółka|\.)?\s*(j|k|c|p)\.?(?=\s|$)/g, ' ')
    .replace(/\bs\.?\s*a\.?(?=\s|$)/g, ' ')
    .replace(/[^\p{L}\p{N}]+/gu, ' ');
  const tokens = [...new Set(s.split(' ').filter((t) => t && !SLOWA_POMIJANE.includes(t)))];
  return tokens.sort().join(' ');
}
function normalizeWojewodztwo(raw, miasto) {
  const w = String(raw ?? '').trim().toLowerCase().replace(/^woj(\.|ewództwo)?\s*/, '');
  if (WOJEWODZTWA.includes(w)) return { wojewodztwo: w, zrodlo: 'formularz' };
  const z = MIASTA[String(miasto ?? '').trim().toLowerCase()];
  if (z) return { wojewodztwo: z, zrodlo: 'miasto' };
  return { wojewodztwo: '', zrodlo: 'brak' };
}

// ---------------- Deduplikacja ----------------
// pewny: ten sam telefon lub e-mail -> łączymy automatycznie
// mozliwy: ta sama nazwa firmy (po normalizacji) lub ta sama firmowa domena -> do potwierdzenia przez Anię
function findDuplicate(lead, existing) {
  const byId = Object.fromEntries(existing.map((r) => [r.lead_id, r]));
  const root = (r) => {
    let cur = r, guard = 0;
    while (cur && cur.duplikat_typ === 'pewny' && cur.duplikat_of && byId[cur.duplikat_of] && guard++ < 20) cur = byId[cur.duplikat_of];
    return cur;
  };
  const sorted = [...existing].sort((a, b) => String(a.data_zgloszenia).localeCompare(String(b.data_zgloszenia)));
  const rules = [
    ['pewny', 'telefon', (r) => lead.telefon_norm && normalizePhone(r.telefon_norm || r.telefon) === lead.telefon_norm],
    ['pewny', 'e-mail', (r) => lead.email_norm && normalizeEmail(r.email) === lead.email_norm],
    ['mozliwy', 'nazwa firmy', (r) => lead.firma_klucz && (r.firma_klucz || companyKey(r.firma)) === lead.firma_klucz],
    ['mozliwy', 'domena e-mail', (r) => { const d = emailDomain(lead.email_norm); return d && emailDomain(normalizeEmail(r.email)) === d; }],
  ];
  for (const [typ, powod, test] of rules) {
    const hit = sorted.find(test);
    if (hit) return { typ, powod, original: root(hit) };
  }
  return null;
}

// ---------------- Routing ----------------

// województwo -> lista opiekunów. Województwo wpisane u dwóch osób (zakładka Handlowcy) = region wspólny.
function parseHandlowcy(rows) {
  const map = {};
  rows.forEach((h) => String(h.wojewodztwa || '').split(';').map((w) => w.trim().toLowerCase()).filter(Boolean)
    .forEach((w) => { (map[w] = map[w] || []).push({ id: h.handlowiec_id, nazwa: h.imie_nazwisko, email: h.email }); }));
  return map;
}
// Region wspólny: lead dostaje opiekun z mniejszą liczbą leadów z tego województwa (pół na pół), przy remisie – losowo.
// Czysty los przy kilku leadach miesięcznie mógłby dać np. 5:1 – przy prowizjach to proszenie się o spór.
function route(wojewodztwo, handlowcyMap, existing = []) {
  if (!wojewodztwo) return { routing: 'do_ustalenia', handlowiec: null };
  const lista = handlowcyMap[wojewodztwo] || [];
  if (!lista.length) return { routing: 'bez_opiekuna', handlowiec: null };
  if (lista.length === 1) return { routing: 'handlowiec', handlowiec: lista[0] };
  const ile = (id) => existing.filter((r) => r.wojewodztwo === wojewodztwo && r.duplikat_typ !== 'pewny' && r.handlowiec_id === id).length;
  const liczby = lista.map((h) => ({ h, n: ile(h.id) }));
  const min = Math.min(...liczby.map((x) => x.n));
  const kandydaci = liczby.filter((x) => x.n === min);
  const wybrany = kandydaci[Math.floor(Math.random() * kandydaci.length)].h;
  return { routing: 'handlowiec', handlowiec: wybrany, podzial: liczby.map((x) => `${x.h.nazwa} ${x.n}`).join(' / ') };
}

// Wyjątki (zakładka „Wyjątki”): dopasowanie = firma | telefon | email | domena, wartosc, miasto (opcjonalnie), przypisz_do = ANIA | MAREK | H1…
// Firma: wszystkie słowa klucza z reguły muszą wystąpić w kluczu firmy leada („termex” łapie „ZPH Termex” i „Termex ZPH Sp. j.”).
function findWyjatek(lead, wyjatki = []) {
  return wyjatki.find((w) => {
    const typ = String(w.dopasowanie || '').trim().toLowerCase(), wartosc = String(w.wartosc || '').trim();
    if (!wartosc || !String(w.przypisz_do || '').trim()) return false;
    if (String(w.miasto || '').trim() && String(w.miasto).trim().toLowerCase() !== String(lead.miasto || '').trim().toLowerCase()) return false;
    if (typ === 'firma') { const t = (lead.firma_klucz || '').split(' '); return companyKey(wartosc).split(' ').every((x) => x && t.includes(x)); }
    if (typ === 'telefon') return !!lead.telefon_norm && normalizePhone(wartosc) === lead.telefon_norm;
    if (typ === 'email') return !!lead.email_norm && normalizeEmail(wartosc) === lead.email_norm;
    if (typ === 'domena') return !!lead.email_norm && lead.email_norm.split('@')[1] === wartosc.toLowerCase().replace(/^@/, '');
    return false;
  }) || null;
}
function marekOf(cfg) { return { id: 'MAREK', nazwa: 'Marek', email: cfg.MAREK_EMAIL, whatsapp: cfg.MAREK_WHATSAPP || '' }; }
function aniaOf(cfg) { return { id: 'ANIA', nazwa: 'Ania (biuro)', email: cfg.ANIA_EMAIL, whatsapp: cfg.ANIA_WHATSAPP || '' }; }
function osobaPoId(id, handlowcyRows, cfg) {
  if (id === 'ANIA') return aniaOf(cfg);
  if (id === 'MAREK') return marekOf(cfg);
  const h = handlowcyRows.find((x) => x.handlowiec_id === id);
  return h ? { id: h.handlowiec_id, nazwa: h.imie_nazwisko, email: h.email, whatsapp: h.whatsapp || '' } : null;
}
function recipientFor(row, handlowcyRows, cfg) {
  if (row.routing === 'bez_opiekuna') return marekOf(cfg);
  if (row.routing === 'do_ustalenia') return aniaOf(cfg);
  if (row.handlowiec_id === 'ANIA' || row.handlowiec_id === 'MAREK') return osobaPoId(row.handlowiec_id, handlowcyRows, cfg);
  const h = handlowcyRows.find((x) => x.handlowiec_id === row.handlowiec_id);
  return h ? { id: h.handlowiec_id, nazwa: h.imie_nazwisko, email: h.email, whatsapp: h.whatsapp || '' } : aniaOf(cfg);
}

// ---------------- Pomocnicze ----------------

function makeToken() {
  let t = '';
  for (let i = 0; i < 16; i++) t += Math.floor(Math.random() * 16).toString(16);
  return t;
}
function nextLeadId(existing) {
  const max = existing.reduce((m, r) => Math.max(m, parseInt(String(r.lead_id || '').replace(/\D/g, ''), 10) || 0), 0);
  return 'L-' + String(max + 1).padStart(3, '0');
}
function esc(s) {
  return String(s ?? '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
}
function zl(v) {
  const n = Number(v);
  return n ? n.toLocaleString('pl-PL') + ' zł' : '—';
}

// ---------------- Treści maili ----------------

function statusButtons(cfg, leadId, token, kto) {
  const btn = (s, label, color) =>
    `<a href="${esc(cfg.STATUS_URL)}?lead=${encodeURIComponent(leadId)}&t=${token}&s=${s}&kto=${encodeURIComponent(kto)}" ` +
    `style="display:inline-block;margin:4px 6px 4px 0;padding:10px 14px;background:${color};color:#fff;text-decoration:none;border-radius:6px;font-weight:bold">${label}</a>`;
  return btn('dodzwoniono', '✅ Dodzwoniłem się', '#15803d') + btn('nie_odebral', '📵 Nie odebrał', '#b45309') +
    btn('umowione', '📅 Umówione', '#1d4ed8') + btn('niezainteresowany', '✖ Niezainteresowany', '#6b7280');
}
function leadTable(r) {
  const rows = [
    ['Firma', r.firma], ['Osoba', r.osoba], ['Telefon', `<a href="tel:${esc(r.telefon_norm)}">${esc(formatPhone(r.telefon_norm) || r.telefon)}</a>`],
    ['E-mail', r.email || '—'], ['Miasto / woj.', `${r.miasto || '—'} / ${r.wojewodztwo || 'nieustalone'}`],
    ['Zainteresowanie', r.zainteresowanie], ['Szac. wartość', zl(r.szac_wartosc_pln)], ['Źródło', r.zrodlo], ['Wiadomość', r.wiadomosc],
  ];
  return '<table style="border-collapse:collapse;font-family:Arial,sans-serif;font-size:14px">' +
    rows.map(([k, v]) => `<tr><td style="padding:4px 12px 4px 0;color:#555">${k}</td><td style="padding:4px 0"><b>${k === 'Telefon' ? v : esc(v)}</b></td></tr>`).join('') +
    '</table>';
}
function wrapTestMode(email, cfg) {
  if (String(cfg.TRYB_TESTOWY) !== 'true') return email;
  return {
    ...email,
    to: cfg.TEST_INBOX,
    cc: '',
    subject: `[TEST → ${email.to}${email.cc ? ' cc ' + email.cc : ''}] ${email.subject}`,
  };
}

// ---------------- WhatsApp (Green API w makiecie, docelowo WhatsApp Cloud API) ----------------
// Handlowiec potwierdza kontakt, odpowiadając na wiadomość z leadem cyfrą 1–4.

const WA_ODPOWIEDZI = { 1: 'dodzwoniono', 2: 'nie_odebral', 3: 'umowione', 4: 'niezainteresowany' };
const WA_SLOWA = [
  [/dodzwoni|rozmawia/, 'dodzwoniono'], [/nie\s*odebra/, 'nie_odebral'],
  [/niezainteres|nie\s*zainteres/, 'niezainteresowany'], [/umówi|umowi|spotkani/, 'umowione'],
];
const WA_STOPKA = 'Po rozmowie *odpowiedz na tę wiadomość* cyfrą:\n1 = dodzwoniłem się · 2 = nie odebrał\n3 = umówione · 4 = niezainteresowany';

function waChatId(num) {
  let d = String(num ?? '').replace(/@.*$/, '').replace(/\D/g, '');
  if (d.length === 9) d = '48' + d;
  return d ? d + '@c.us' : '';
}
function kanalWa(cfg) { return String(cfg.KANAL || 'mail') !== 'mail'; }
function wrapTestModeWa(msg, cfg) {
  if (String(cfg.TRYB_TESTOWY) !== 'true') return msg.chatId ? msg : null;
  const chatId = waChatId(cfg.TEST_WHATSAPP);
  return chatId ? { chatId, message: `[TEST → ${msg.nazwa}]\n${msg.message}` } : null;
}
function skroc(s, n) { s = String(s ?? '').trim(); return s.length > n ? s.slice(0, n - 1) + '…' : s; }

function waLeadMessage(row, naglowek, info, target) {
  const linie = [
    `${naglowek} · ${row.wojewodztwo || 'woj. nieustalone'}`,
    `*${row.firma || row.osoba}*${row.firma && row.osoba ? ` – ${row.osoba}` : ''}`,
    row.telefon_norm ? `📞 ${formatPhone(row.telefon_norm)}` : `✉️ ${row.email || 'brak kontaktu'}`,
    `💰 ${zl(row.szac_wartosc_pln)} · ${row.zainteresowanie || 'zapytanie'}${row.miasto ? ` · ${row.miasto}` : ''}`,
    row.wiadomosc ? `💬 „${skroc(row.wiadomosc, 160)}”` : '',
    info ? `\n${info}` : '',
    `\n🆔 ${target.lead_id}${target.lead_id !== row.lead_id ? ` (nowe zgłoszenie: ${row.lead_id})` : ''}`,
    '────────',
    WA_STOPKA,
  ];
  return linie.filter(Boolean).join('\n');
}

// Rozpoznaje odpowiedź: "1", "L-041 1", "dodzwoniłem się"... oraz lead z cytowanej wiadomości
function parseWaReply(text, quoted) {
  const t = String(text ?? '').trim().toLowerCase();
  const idTxt = (t.match(/\bl-?\s?(\d{1,4})\b/) || [])[1];
  let status = '';
  const cyfra = t.replace(/\bl-?\s?\d{1,4}\b/, '').match(/(?:^|\s)([1-4])(?:\s|$|[.!,])/);
  if (cyfra) status = WA_ODPOWIEDZI[cyfra[1]];
  else for (const [re, s] of WA_SLOWA) if (re.test(t)) { status = s; break; }
  const q = String(quoted ?? '');
  // 🆔 oznacza leada, którego dotyczy wiadomość; kilka 🆔 = zbiorcze przypomnienie -> trzeba podać numer
  const ids = [...new Set([...q.matchAll(/🆔\s*(L-\d+)/g)].map((x) => x[1]))];
  const lead_id = idTxt ? 'L-' + idTxt.padStart(3, '0') : ids.length === 1 ? ids[0] : '';
  // Notatka: wszystko po cyfrze statusu (i numerze leada), np. "1 chce ofertę na 10 szt." -> "chce ofertę na 10 szt."
  const oryg = String(text ?? '').trim();
  const notatka = cyfra
    ? oryg.replace(/\bl-?\s?\d{1,4}\b/i, ' ').replace(/(^|\s)[1-4](?=\s|$|[.!,])[.!,]?/, ' ').replace(/^[\s,.;:–-]+/, '').replace(/\s+/g, ' ').trim()
    : status && oryg.length > 20 ? oryg : ''; // samo "nie odebrał" to nie notatka
  return { status, lead_id, wiele: !idTxt && ids.length > 1, notatka };
}

// Wspólne dla kliknięcia linku (B) i odpowiedzi z WhatsAppa (D)
function applyStatus(row, s, kto, now, zrodlo, opts = {}) {
  const zamyka = STATUSY_ZAMYKAJACE_SLA.includes(s);
  const pierwszy = zamyka && !row.pierwszy_kontakt;
  const update = { lead_id: row.lead_id, status: s, proby: (Number(row.proby) || 0) + 1, aktualizacja: now };
  if (pierwszy) {
    update.pierwszy_kontakt = now;
    update.kontakt_kto = kto || row.handlowiec_id || '';
  }
  if (opts.notatka) update.notatka = opts.notatka;
  const ktoNazwa = opts.ktoNazwa || kto || '—';
  const czasMin = pierwszy ? businessMinutes(row.data_zgloszenia, now) : null;
  return {
    update,
    czas: czasMin === null ? '' : `${fmtGodziny(czasMin)} roboczych`,
    historia: [{ czas: now, lead_id: row.lead_id, zdarzenie: 'status', kto: ktoNazwa, szczegoly: `${STATUS_ETYKIETY[s] || s} (${zrodlo})${opts.notatka ? ` – „${opts.notatka}”` : ''}` }],
  };
}

// Przetwarza wiadomości przychodzące z Green API (lastIncomingMessages / webhook)
function processWaReplies(messages, rows, handlowcyRows, cfg, now) {
  const test = String(cfg.TRYB_TESTOWY) === 'true';
  const firmowy = waChatId(cfg.GREEN_PHONE);
  // Makieta na jednym telefonie: numer testowy = numer firmowy -> odpowiedzi wpisywane w czacie „Ty” (wychodzące z telefonu, nie z API)
  const jedenTelefon = test && firmowy && waChatId(cfg.TEST_WHATSAPP) === firmowy;
  const out = [];
  for (const m of messages) {
    if (!m || !m.chatId || String(m.chatId).endsWith('@g.us')) continue;
    const zCzatuTy = jedenTelefon && m.type === 'outgoing' && m.chatId === firmowy && !m.sendByApi;
    if (m.type && m.type !== 'incoming' && !zCzatuTy) continue;
    if (firmowy && m.chatId === firmowy && !zCzatuTy) continue;
    const text = m.textMessage || (m.extendedTextMessage && m.extendedTextMessage.text) || '';
    if (/^\s*(\[TEST|✅|📵|📅|✖|❓|⛔)/.test(text)) continue; // nasze własne wiadomości
    const qm = m.quotedMessage || {};
    const quoted = qm.textMessage || (qm.extendedTextMessage && qm.extendedTextMessage.text) || '';
    const p = parseWaReply(text, quoted);
    // Rozmowy, które nie dotyczą leadów, ignorujemy po cichu
    if (!p.status && !/🆔|L-\d/.test(quoted) && !/\bl-?\s?\d/i.test(text)) continue;

    const reply = (message) => ({ chatId: m.chatId, message });
    const base = { idMessage: m.idMessage, chatId: m.chatId };
    const nadawcaH = handlowcyRows.find((h) => waChatId(h.whatsapp) === m.chatId);
    const marek = waChatId(cfg.MAREK_WHATSAPP) === m.chatId;
    const ania = waChatId(cfg.ANIA_WHATSAPP) === m.chatId;
    const dozwolonyTest = (test && m.chatId === waChatId(cfg.TEST_WHATSAPP)) || zCzatuTy;
    if (!nadawcaH && !marek && !ania && !dozwolonyTest) continue; // obcy numer – nie odpowiadamy

    if (!p.status) { out.push({ ...base, reply: reply('❓ Nie rozpoznałem statusu. Odpowiedz cyfrą: 1 = dodzwoniłem się, 2 = nie odebrał, 3 = umówione, 4 = niezainteresowany.') }); continue; }
    let lead_id = p.lead_id;
    if (!lead_id) {
      const otwarte = rows.filter((r) => r.lead_id && r.duplikat_typ !== 'pewny' && !STATUSY_ZAMYKAJACE_SLA.includes(r.status) &&
        (nadawcaH ? r.handlowiec_id === nadawcaH.handlowiec_id : false));
      if (otwarte.length === 1) lead_id = otwarte[0].lead_id;
      else {
        out.push({ ...base, reply: reply(p.wiele
          ? '❓ Ta wiadomość dotyczy kilku leadów. Napisz numer leada i cyfrę, np. „L-041 1”.'
          : '❓ Nie wiem, którego leada dotyczy odpowiedź. Odpowiedz bezpośrednio na wiadomość z leadem (przesuń ją w prawo) albo napisz np. „L-041 1”.') });
        continue;
      }
    }
    const row = rows.find((r) => r.lead_id === lead_id);
    if (!row) { out.push({ ...base, reply: reply(`❓ Nie znalazłem leada ${lead_id}.`) }); continue; }
    const kto = nadawcaH ? nadawcaH.handlowiec_id : marek ? 'MAREK' : ania ? 'ANIA' : (row.handlowiec_id || 'TEST');
    const ktoNazwa = nadawcaH ? nadawcaH.imie_nazwisko : marek ? 'Marek' : ania ? 'Ania (biuro)' : (row.handlowiec || 'Ania (biuro)');
    if (nadawcaH && row.handlowiec_id !== nadawcaH.handlowiec_id) {
      out.push({ ...base, reply: reply(`⛔ ${lead_id} nie jest Twoim leadem – nic nie zmieniłem.`) });
      continue;
    }
    const r = applyStatus(row, p.status, kto, now, 'WhatsApp', { notatka: p.notatka, ktoNazwa });
    const ikona = { dodzwoniono: '✅', nie_odebral: '📵', umowione: '📅', niezainteresowany: '✖' }[p.status];
    const dopisek = p.status === 'nie_odebral' ? ` To ${r.update.proby}. próba – lead dalej czeka, przypomnę.` : r.czas ? ` Czas do kontaktu: ${r.czas}.` : '';
    out.push({
      ...base, lead_id, update: r.update,
      historia: r.historia.map((h) => ({ ...h, szczegoly: `${h.szczegoly}; wa:${m.idMessage}` })),
      reply: reply(`${ikona} Zapisano: ${lead_id} ${row.firma || row.osoba} – ${STATUS_ETYKIETY[p.status]}.${dopisek}${p.notatka ? `\n📝 Notatka: „${p.notatka}”` : '\n📝 Możesz dopisać notatkę, np. „1 chce ofertę na 10 szt.”'}`),
    });
  }
  return out;
}

// ---------------- Przetworzenie nowego zapytania (workflow A) ----------------

function validateInput(inp) {
  const errors = [];
  if (!String(inp.firma || '').trim() && !String(inp.osoba || '').trim()) errors.push('Podaj firmę lub osobę kontaktową.');
  const tel = normalizePhone(inp.telefon), mail = normalizeEmail(inp.email);
  const telWpisany = String(inp.telefon || '').trim(), mailWpisany = String(inp.email || '').trim();
  if (telWpisany && !tel) errors.push(`Numer telefonu „${telWpisany}” jest niepełny lub błędny – podaj 9 cyfr, np. 601 222 333.`);
  if (mailWpisany && !mail) errors.push(`Adres e-mail „${mailWpisany}” jest niepoprawny.`);
  if (!telWpisany && !mailWpisany) errors.push('Podaj telefon (9 cyfr) lub e-mail.');
  return errors;
}

function buildLeadRow(inp, existing, handlowcyRows, now, opts = {}) {
  const hMap = parseHandlowcy(handlowcyRows);
  const telefon_norm = normalizePhone(inp.telefon);
  const email_norm = normalizeEmail(inp.email);
  const firma_klucz = companyKey(inp.firma);
  const woj = normalizeWojewodztwo(inp.wojewodztwo, inp.miasto);
  const dup = findDuplicate({ telefon_norm, email_norm, firma_klucz }, existing);
  const wyjatek = findWyjatek({ firma_klucz, telefon_norm, email_norm, miasto: inp.miasto }, opts.wyjatki || []);

  // Kolejność: wyjątek (np. Termex -> biuro) > pewny duplikat (zostaje u opiekuna oryginału) > region (wspólny: pół na pół)
  let routing, handlowiec, podzial = '';
  if (wyjatek) {
    const id = String(wyjatek.przypisz_do).trim().toUpperCase();
    const nazwa = id === 'ANIA' ? 'Ania (biuro)' : id === 'MAREK' ? 'Marek'
      : ((handlowcyRows.find((h) => String(h.handlowiec_id).toUpperCase() === id) || {}).imie_nazwisko || id);
    routing = 'wyjatek';
    handlowiec = { id, nazwa };
  } else if (dup && dup.typ === 'pewny' && dup.original) {
    routing = dup.original.routing;
    handlowiec = dup.original.handlowiec_id ? { id: dup.original.handlowiec_id, nazwa: dup.original.handlowiec } : null;
  } else {
    ({ routing, handlowiec, podzial = '' } = route(woj.wojewodztwo, hMap, existing));
  }

  const row = {
    lead_id: opts.lead_id || nextLeadId(existing),
    data_zgloszenia: opts.data_zgloszenia || now,
    zrodlo: String(inp.zrodlo || 'formularz').trim(),
    firma: String(inp.firma || '').trim(),
    osoba: String(inp.osoba || '').trim(),
    email: email_norm,
    telefon: String(inp.telefon || '').trim(),
    miasto: String(inp.miasto || '').trim(),
    wojewodztwo: woj.wojewodztwo,
    zainteresowanie: String(inp.zainteresowanie || '').trim(),
    szac_wartosc_pln: Number(inp.szac_wartosc_pln) || 0,
    wiadomosc: String(inp.wiadomosc || '').trim(),
    telefon_norm,
    firma_klucz,
    wojewodztwo_zrodlo: woj.zrodlo,
    routing,
    handlowiec_id: handlowiec ? handlowiec.id : '',
    handlowiec: handlowiec ? handlowiec.nazwa : '',
    duplikat_of: dup && dup.original ? dup.original.lead_id : '',
    duplikat_typ: dup ? dup.typ : '',
    duplikat_powod: dup ? dup.powod : '',
    status: 'nowy',
    pierwszy_kontakt: '',
    kontakt_kto: '',
    proby: 0,
    sla_poziom: 0,
    token: makeToken(),
    aktualizacja: now,
  };
  return { row, dup, wyjatek, podzial };
}

// Data faktycznego kontaktu (np. telefon o 9:10 wpisany o 11:00) – zegar SLA liczy się od niej; przyszłe daty ignorujemy
function dataKontaktu(inp, now) {
  const d = String(inp.data_kontaktu || '').trim();
  return parseLocal(d) && d.slice(0, 16) <= now ? d.slice(0, 16) : now;
}

const POWTORKA_MIN = 30;
function powtorneWyslanie(row, existing, now) {
  const t = parseLocal(now);
  if (!t) return null;
  return existing.find((r) => {
    const d = parseLocal(r.data_zgloszenia);
    if (!r.lead_id || !d || String(r.zrodlo || '') !== row.zrodlo) return false;
    const min = (t - d) / 6e4;
    if (min < 0 || min > POWTORKA_MIN) return false;
    // ten sam telefon (a jeśli podano e-mail – ten sam e-mail). Poprawiony numer = nowe zgłoszenie, nie powtórka.
    const tel = row.telefon_norm && normalizePhone(r.telefon_norm || r.telefon) === row.telefon_norm;
    const mail = !row.email || normalizeEmail(r.email) === row.email;
    return row.telefon_norm ? tel && mail : row.email && normalizeEmail(r.email) === row.email;
  }) || null;
}

function processInquiry(inp, existing, handlowcyRows, cfg, now) {
  const errors = validateInput(inp);
  if (errors.length) return { valid: false, errors, response: { ok: false, errors } };

  const { row, dup, wyjatek, podzial } = buildLeadRow(inp, existing, handlowcyRows, now, { data_zgloszenia: dataKontaktu(inp, now), wyjatki: cfg.WYJATKI || [] });
  // Podwójne kliknięcie / ponowne wysłanie tych samych danych w ciągu 30 min: nie zapisujemy drugi raz i nie alarmujemy handlowca
  const powt = powtorneWyslanie(row, existing, now);
  if (powt) {
    return {
      valid: true, powtorka: true, row: powt, historia: [],
      response: { ok: true, powtorka: true, lead_id: powt.lead_id, przypisano: powt.handlowiec || recipientFor(powt, handlowcyRows, cfg).nazwa,
        wojewodztwo: powt.wojewodztwo, telefon_norm: powt.telefon_norm, sla_start: slaStart(powt.data_zgloszenia) },
    };
  }
  const wprowadzil = String(inp.wprowadzil || '').trim() || (row.zrodlo === 'formularz' ? 'formularz WWW' : 'Ania (biuro)');
  const original = dup && dup.original;
  const pewny = dup && dup.typ === 'pewny' && original;
  const oryginalZamkniety = pewny && STATUSY_ZAMYKAJACE_SLA.includes(original.status);

  // Przyciski statusu: przy pewnym duplikacie dotyczą leada pierwotnego
  const target = pewny ? original : row;
  const odbiorca = recipientFor(row, handlowcyRows, cfg);
  const opis = `${row.firma || row.osoba} (${row.wojewodztwo || 'woj. nieustalone'})`;

  let subject, intro, waNaglowek, waInfo = '';
  if (pewny && oryginalZamkniety) {
    waNaglowek = '♻️ *ZNANY KLIENT pisze ponownie*';
    waInfo = `Był już kontakt (${original.lead_id}, ${STATUS_ETYKIETY[original.status] || original.status}${original.pierwszy_kontakt ? ', ' + original.pierwszy_kontakt : ''}${original.handlowiec ? ', ' + original.handlowiec : ''}).` +
      `${original.notatka ? `\n📝 „${skroc(original.notatka, 200)}”` : ''}\nSprawdź ustalenia, zanim podasz cenę.`;
    subject = `Znany klient pisze ponownie: ${opis}`;
    intro = `Ten klient był już obsłużony: ${original.lead_id} z ${original.data_zgloszenia}, status <b>${STATUS_ETYKIETY[original.status] || original.status}</b>` +
      `${original.pierwszy_kontakt ? `, kontakt ${original.pierwszy_kontakt}` : ''}${original.kontakt_kto ? ` (${esc(original.kontakt_kto)})` : ''}. ` +
      (original.notatka ? `Ostatnia notatka: „${esc(original.notatka)}”. ` : '') +
      'Zanim zadzwonisz, sprawdź ustalenia z poprzedniej rozmowy, żeby nie podać innej ceny.';
  } else if (pewny) {
    waNaglowek = '⚠️ *PONOWIENIE – klient czeka*';
    waInfo = `Klient pisze drugi raz. Pierwsze zapytanie ${original.lead_id} z ${original.data_zgloszenia} nadal bez kontaktu. Zadzwoń jak najszybciej.`;
    subject = `⚠ PONOWIENIE – klient czeka: ${opis}`;
    intro = `Klient pisze <b>drugi raz</b>. Pierwsze zapytanie ${original.lead_id} z ${original.data_zgloszenia} nadal bez kontaktu ` +
      `(dopasowanie po: ${dup.powod}). Priorytet – zadzwoń jak najszybciej.`;
  } else if (row.routing === 'wyjatek') {
    const powod = String(wyjatek.opis || '').trim() || 'reguła wyjątku';
    waNaglowek = '📌 *LEAD Z WYJĄTKU*';
    waInfo = `Klient obsługiwany poza regionem: ${powod}.`;
    subject = `Lead z wyjątku: ${opis} – ${row.zainteresowanie || 'zapytanie'}, ${zl(row.szac_wartosc_pln)}`;
    intro = `Ten klient zgodnie z ustaleniami trafia do Ciebie niezależnie od województwa (<b>${esc(powod)}</b>).`;
  } else if (row.routing === 'bez_opiekuna') {
    waNaglowek = '🟠 *LEAD BEZ OPIEKUNA*';
    waInfo = 'Województwo bez handlowca – lead u Pana do decyzji, kto obsługuje region.';
    subject = `BEZ OPIEKUNA: ${row.wojewodztwo} – ${row.firma || row.osoba}, ${zl(row.szac_wartosc_pln)}`;
    intro = `Województwo <b>${esc(row.wojewodztwo)}</b> nie ma przypisanego handlowca. Lead trafia do Pana, dopóki nie zapadnie decyzja, kto obsługuje ten region.`;
  } else if (row.routing === 'do_ustalenia') {
    waNaglowek = '❓ *LEAD DO PRZYPISANIA*';
    waInfo = 'Nie udało się ustalić województwa – proszę przypisać handlowca.';
    subject = `Do przypisania: ${row.firma || row.osoba} – brak województwa`;
    intro = 'Nie udało się ustalić województwa (brak w formularzu, nieznane miasto). Proszę ustalić i przypisać handlowca.';
  } else {
    waNaglowek = '🔔 *NOWY LEAD*';
    if (row.wojewodztwo_zrodlo === 'miasto') waInfo = `Województwo ustalone z miasta (${row.miasto}).`;
    if (podzial) waInfo += `${waInfo ? '\n' : ''}Region wspólny (${row.wojewodztwo}) – leady dzielone po równo.`;
    subject = `Nowy lead: ${opis} – ${row.zainteresowanie || 'zapytanie'}, ${zl(row.szac_wartosc_pln)}`;
    intro = row.wojewodztwo_zrodlo === 'miasto'
      ? `Województwo ustalone automatycznie na podstawie miasta (${esc(row.miasto)}).`
      : 'Nowe zapytanie z Twojego regionu. Cel: telefon w ciągu 4 godzin roboczych.';
  }

  const cc = [];
  if (dup && dup.typ === 'mozliwy') {
    waInfo += `${waInfo ? '\n' : ''}ℹ Możliwy duplikat ${dup.original ? dup.original.lead_id : ''} (${dup.powod}) – biuro potwierdzi.`;
    intro += `<br><br>ℹ Możliwy duplikat ${dup.original ? dup.original.lead_id : ''} (${dup.powod}) – do potwierdzenia przez biuro.`;
    if (cfg.ANIA_EMAIL && odbiorca.email !== cfg.ANIA_EMAIL) cc.push(cfg.ANIA_EMAIL);
  }

  const html = `<div style="font-family:Arial,sans-serif;font-size:14px;max-width:600px">
<p>${intro}</p>${leadTable(row)}
<p style="margin-top:16px"><b>Po telefonie kliknij jeden przycisk:</b><br>${statusButtons(cfg, target.lead_id, target.token, odbiorca.id)}</p>
<p style="color:#888;font-size:12px">${row.lead_id}${pewny ? ` → dotyczy ${original.lead_id}` : ''} · zgłoszono ${row.data_zgloszenia} · zegar SLA od ${slaStart(row.data_zgloszenia)}</p></div>`;

  const email = wrapTestMode({ to: odbiorca.email, cc: cc.join(','), subject, html }, cfg);
  const whatsapp = kanalWa(cfg)
    ? wrapTestModeWa({ chatId: waChatId(odbiorca.whatsapp), nazwa: odbiorca.nazwa, message: waLeadMessage(row, waNaglowek, waInfo, target) }, cfg)
    : null;

  // Lead powyżej progu: informacja dla Marka jako lidera sprzedaży – lead zostaje u handlowca
  const prog = Number(cfg.PROG_LIDER) || 50000;
  let lider = null;
  if (row.szac_wartosc_pln > prog && odbiorca.id !== 'MAREK') {
    const m = marekOf(cfg);
    const lSubject = `💰 Duży lead ${zl(row.szac_wartosc_pln)}: ${row.firma || row.osoba} → ${odbiorca.nazwa}`;
    const lHtml = `<div style="font-family:Arial,sans-serif;font-size:14px;max-width:600px">
<p>Informacyjnie: lead powyżej ${zl(prog)}. Obsługuje go <b>${esc(odbiorca.nazwa)}</b> – nic nie musisz robić, stan kontaktu zobaczysz w porannym raporcie.</p>${leadTable(row)}
<p style="color:#888;font-size:12px">${row.lead_id}${pewny ? ` → dotyczy ${original.lead_id} (ponowienie)` : ''} · zgłoszono ${row.data_zgloszenia}</p></div>`;
    lider = {
      email: String(cfg.KANAL || 'mail') !== 'whatsapp' ? wrapTestMode({ to: m.email, cc: '', subject: lSubject, html: lHtml }, cfg) : null,
      whatsapp: kanalWa(cfg) ? wrapTestModeWa({ chatId: waChatId(m.whatsapp), nazwa: m.nazwa, message:
        `💰 *DUŻY LEAD* · ${zl(row.szac_wartosc_pln)}${pewny ? ' · ponowienie' : ''}
*${row.firma || row.osoba}* · ${row.wojewodztwo || 'woj. nieustalone'}
Opiekun: *${odbiorca.nazwa}*
📞 ${formatPhone(row.telefon_norm) || row.email || '—'}
🆔 ${target.lead_id}
ℹ️ Informacyjnie – lead zostaje u handlowca.` }, cfg) : null,
    };
  }

  const historia = [
    { czas: now, lead_id: row.lead_id, zdarzenie: 'utworzono', kto: wprowadzil, szczegoly: `źródło: ${row.zrodlo}; woj.: ${row.wojewodztwo || '—'} (${row.wojewodztwo_zrodlo})${row.data_zgloszenia !== now ? `; kontakt klienta: ${row.data_zgloszenia}` : ''}${inp.zgoda ? '; zgoda na kontakt (RODO): tak' : ''}` },
  ];
  if (dup) historia.push({ czas: now, lead_id: row.lead_id, zdarzenie: dup.typ === 'pewny' ? 'duplikat' : 'mozliwy_duplikat', kto: 'system', szczegoly: `${dup.original ? dup.original.lead_id : ''} po: ${dup.powod}` });
  historia.push({ czas: now, lead_id: row.lead_id, zdarzenie: 'przypisano', kto: 'system', szczegoly: `${row.routing}: ${odbiorca.nazwa}${wyjatek ? ` (wyjątek: ${String(wyjatek.opis || wyjatek.wartosc).trim()})` : ''}${podzial ? ` (region wspólny, dotychczas: ${podzial})` : ''}` });
  if (String(cfg.KANAL || 'mail') !== 'whatsapp') historia.push({ czas: now, lead_id: row.lead_id, zdarzenie: 'powiadomienie', kto: 'system', szczegoly: `mail do ${odbiorca.email}${cc.length ? ' cc ' + cc.join(',') : ''}` });
  if (whatsapp) historia.push({ czas: now, lead_id: row.lead_id, zdarzenie: 'powiadomienie', kto: 'system', szczegoly: `WhatsApp do ${odbiorca.nazwa}` });
  if (lider) historia.push({ czas: now, lead_id: row.lead_id, zdarzenie: 'powiadomienie', kto: 'system', szczegoly: `lider sprzedaży: Marek (wartość powyżej ${zl(prog)})` });

  return {
    valid: true,
    row,
    email,
    whatsapp,
    lider,
    historia,
    response: {
      ok: true,
      lead_id: row.lead_id,
      routing: row.routing,
      przypisano: odbiorca.nazwa,
      wojewodztwo: row.wojewodztwo,
      wojewodztwo_zrodlo: row.wojewodztwo_zrodlo,
      duplikat: dup ? { typ: dup.typ, powod: dup.powod, lead_id: dup.original ? dup.original.lead_id : '' } : null,
      telefon_norm: row.telefon_norm,
      sla_start: slaStart(row.data_zgloszenia),
    },
  };
}

// ---------------- Skrzynka „Wpisz lead” (workflow F) ----------------
// Wspólne wejście dla wszystkiego spoza formularza: telefony i maile wpisywane przez Anię, w przyszłości AI z maili.
// Wiersz czeka, dopóki kolumna „akcja” = SPRAWDŹ (np. propozycja AI) – Ania zmienia ją na OK albo czyści.
const SKRZYNKA_POLA = ['zrodlo', 'firma', 'osoba', 'telefon', 'email', 'miasto', 'wojewodztwo', 'zainteresowanie', 'szac_wartosc_pln', 'wiadomosc', 'data_kontaktu', 'wprowadzil'];
function doPrzetworzenia(r) {
  const akcja = String(r.akcja || '').trim().toLowerCase();
  const pusty = !SKRZYNKA_POLA.some((k) => String(r[k] ?? '').trim());
  return !pusty && !String(r.wynik || '').trim() && (!akcja || akcja === 'ok');
}
function processInbox(wpisy, existing, handlowcyRows, cfg, now) {
  const baza = [...existing];
  const out = { wyniki: [], leady: [], historia: [], emaile: [], whatsapp: [] };
  for (const w of wpisy.filter(doPrzetworzenia)) {
    const inp = {};
    SKRZYNKA_POLA.forEach((k) => { inp[k] = w[k]; });
    inp.zrodlo = String(inp.zrodlo || '').trim() || 'telefon';
    const r = processInquiry(inp, baza, handlowcyRows, cfg, now);
    if (r.powtorka) { out.wyniki.push({ row_number: w.row_number, wynik: `↩ Już zapisany jako ${r.row.lead_id} (ten sam wiersz wysłany ponownie) · ${now}`, lead_id: r.row.lead_id }); continue; }
    if (!r.valid) {
      out.wyniki.push({ row_number: w.row_number, wynik: `❌ ${r.errors.join(' ')} Popraw wiersz i wyczyść tę kolumnę.`, lead_id: '' });
      continue;
    }
    baza.push(r.row); // kolejne wiersze z tej samej paczki widzą ten lead (duplikaty między wierszami)
    out.leady.push(r.row);
    out.historia.push(...r.historia);
    out.emaile.push(r.email);
    if (r.whatsapp) out.whatsapp.push(r.whatsapp);
    if (r.lider && r.lider.email) out.emaile.push(r.lider.email);
    if (r.lider && r.lider.whatsapp) out.whatsapp.push(r.lider.whatsapp);
    const d = r.response.duplikat;
    const opis = d && d.typ === 'pewny' ? `⚠ ${r.row.lead_id} – ponowienie ${d.lead_id} → ${r.response.przypisano}`
      : `✅ ${r.row.lead_id} → ${r.response.przypisano}${r.row.wojewodztwo ? ` (${r.row.wojewodztwo})` : ''}${d ? ` · możliwy duplikat ${d.lead_id}` : ''}`;
    out.wyniki.push({ row_number: w.row_number, wynik: `${opis} · ${now}`, lead_id: r.row.lead_id });
  }
  return out;
}

// Strona dla klienta po wysłaniu formularza ze strony (workflow H). Pokazuje numer, na który oddzwonimy –
// klient sam wyłapie literówkę. Po godzinach pracy mówi uczciwie, kiedy zadzwonimy.
function klientPage(wynik, formUrl) {
  const css = 'font-family:Arial,sans-serif;max-width:560px;margin:24px auto;padding:28px;border-radius:14px;color:#142029;line-height:1.5';
  const ponownie = `<p style="margin-top:18px"><a href="${esc(formUrl)}" style="color:#0e5c88;font-weight:bold">Wyślij formularz ponownie</a></p>`;
  if (!wynik.valid) {
    return `<div style="${css};background:#fae5e2"><h2 style="margin:0 0 8px;color:#b42318">Sprawdź dane w formularzu</h2>
<ul>${wynik.errors.map((e) => `<li>${esc(e)}</li>`).join('')}</ul>
<p>Zgłoszenie nie zostało jeszcze wysłane.</p>
<p><a href="${esc(formUrl)}" style="display:inline-block;padding:10px 16px;background:#b42318;color:#fff;border-radius:8px;text-decoration:none;font-weight:bold">Wypełnij formularz ponownie</a></p></div>`;
  }
  const r = wynik.row, o = wynik.response;
  const dzien = (s) => { const d = parseLocal(s); return d ? ['niedziela', 'poniedziałek', 'wtorek', 'środa', 'czwartek', 'piątek', 'sobota'][d.getUTCDay()] + ' ' + s.slice(8, 10) + '.' + s.slice(5, 7) : ''; };
  const poGodzinach = o.sla_start && r.data_zgloszenia && o.sla_start !== String(r.data_zgloszenia).slice(0, 16);
  const kiedy = poGodzinach
    ? `Pracujemy pn–pt 8–16, dlatego zadzwonimy w <b>${esc(dzien(o.sla_start))} od 8:00</b>.`
    : 'Zadzwonimy <b>najpóźniej w ciągu jednego dnia roboczego</b>, zwykle znacznie szybciej.';
  const doradca = r.routing === 'handlowiec' && o.przypisano ? `Twój doradca z regionu ${esc(r.wojewodztwo)}: <b>${esc(o.przypisano)}</b>.` : 'Zgłoszenie przejmie nasz dział handlowy.';
  const numer = r.telefon_norm ? `Oddzwonimy na numer <b style="font-size:18px">${esc(formatPhone(r.telefon_norm))}</b>.` : `Odpowiemy na adres <b>${esc(r.email)}</b>.`;
  if (wynik.powtorka) {
    return `<div style="${css};background:#e2eef6"><h2 style="margin:0 0 8px;color:#0e5c88">To zgłoszenie już do nas dotarło</h2>
<p>Mamy je pod numerem <b>${esc(r.lead_id)}</b> – nie trzeba wysyłać go ponownie. ${numer}</p><p>${kiedy}</p></div>`;
  }
  return `<div style="${css};background:#e3f3e8"><h2 style="margin:0 0 8px;color:#17803d">Dziękujemy${r.osoba ? ', ' + esc(r.osoba.split(' ')[0]) : ''}! Zapytanie przyjęte.</h2>
<p>Numer zgłoszenia: <b>${esc(r.lead_id)}</b>. ${doradca}</p>
<p>${numer}<br>${kiedy}</p>
<p style="padding:10px 12px;background:#fff;border-radius:8px;font-size:14px">Numer się nie zgadza? Wyślij formularz jeszcze raz z poprawnym numerem – przekażemy go doradcy razem z tym zgłoszeniem.</p>${ponownie}</div>`;
}

// ---------------- Kliknięcie statusu (workflow B) ----------------

function applyStatusClick(query, rows, now) {
  const page = (title, msg, color) => `<!doctype html><html lang="pl"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${title}</title></head>` +
    `<body style="font-family:Arial,sans-serif;display:flex;align-items:center;justify-content:center;min-height:90vh;margin:0"><div style="text-align:center;padding:24px">` +
    `<div style="font-size:48px">${color === 'ok' ? '✅' : '⚠️'}</div><h2>${title}</h2><p>${msg}</p></div></body></html>`;
  const q = query || {};
  const row = rows.find((r) => r && r.lead_id === q.lead);
  if (!row) return { ok: false, html: page('Nie znaleziono leada', `Brak leada ${esc(q.lead)}.`, 'err') };
  if (!q.t || String(row.token) !== String(q.t)) return { ok: false, html: page('Nieprawidłowy link', 'Link jest niepoprawny lub nieaktualny.', 'err') };
  if (!STATUSY.includes(q.s) || q.s === 'nowy') return { ok: false, html: page('Nieznany status', esc(q.s), 'err') };

  const ktoNazwa = q.kto === row.handlowiec_id ? row.handlowiec : { MAREK: 'Marek', ANIA: 'Ania (biuro)' }[q.kto] || q.kto;
  const r = applyStatus(row, q.s, q.kto, now, 'link w mailu', { ktoNazwa });
  const czas = r.czas ? ` Czas do kontaktu: ${r.czas}.` : '';
  return {
    ok: true,
    update: r.update,
    historia: r.historia,
    html: page('Zapisano', `${esc(row.firma)} – <b>${STATUS_ETYKIETY[q.s]}</b>.${czas}${q.s === 'nie_odebral' ? ' Lead dalej czeka na rozmowę, przypomnimy.' : ''}`, 'ok'),
  };
}

// ---------------- Kontrola SLA (workflow C) ----------------

function checkSla(rows, handlowcyRows, cfg, now) {
  if (!isBusinessTime(now)) return []; // nie wysyłamy przypomnień w nocy ani w weekend
  const out = [];
  for (const r of rows) {
    if (!r || !r.lead_id) continue;
    if (STATUSY_ZAMYKAJACE_SLA.includes(r.status)) continue;
    if (r.duplikat_typ === 'pewny') continue; // SLA liczone na leadzie pierwotnym
    const min = businessMinutes(r.data_zgloszenia, now);
    const level = slaLevelAt(r.data_zgloszenia, now);
    if (level <= (Number(r.sla_poziom) || 0)) continue;
    const owner = recipientFor(r, handlowcyRows, cfg);
    out.push({
      lead_id: r.lead_id, poziom: level, minuty: min,
      do: owner,
      opiekun: owner,
      cicho: level >= 2, // doba i eskalacja: bez osobnej wiadomości – w porannych zestawieniach
      wiersz: r,
    });
  }
  return out;
}

const SLA_OPIS = {
  1: { tytul: 'Przypomnienie: leady czekają ponad 4 h robocze', kolor: '#b45309' },
};
function groupSlaEmails(items, cfg) {
  items = items.filter((it) => !it.cicho && SLA_OPIS[it.poziom]); // eskalacje idą do porannego zestawienia, nie mailem
  const groups = {};
  items.forEach((it) => {
    const key = `${it.do.email}|${it.poziom}`;
    (groups[key] = groups[key] || { do: it.do, poziom: it.poziom, items: [] }).items.push(it);
  });
  return Object.values(groups).map((g) => {
    const o = SLA_OPIS[g.poziom];
    const lista = g.items.sort((a, b) => b.minuty - a.minuty).map((it) => {
      const r = it.wiersz;
      return `<div style="border:1px solid #ddd;border-radius:8px;padding:10px;margin:10px 0">
<b>${esc(r.firma || r.osoba)}</b> · ${esc(r.wojewodztwo || 'woj. nieustalone')} · ${zl(r.szac_wartosc_pln)}<br>
Tel. <a href="tel:${esc(r.telefon_norm)}">${esc(formatPhone(r.telefon_norm) || r.telefon)}</a> · czeka <b>${fmtGodziny(it.minuty)}</b> roboczych · opiekun: ${esc(it.opiekun.nazwa)}${r.status === 'nie_odebral' ? ` · nie odebrał (${r.proby}x)` : ''}<br>
<span style="color:#555">${esc(r.wiadomosc)}</span><br>${statusButtons(cfg, r.lead_id, r.token, g.do.id)}</div>`;
    }).join('');
    const subject = `${o.tytul} (${g.items.length})`;
    const html = `<div style="font-family:Arial,sans-serif;font-size:14px;max-width:640px"><h3 style="color:${o.kolor}">${o.tytul}</h3>${lista}</div>`;
    return wrapTestMode({ to: g.do.email, cc: '', subject, html }, cfg);
  });
}

// Jedna wiadomość WhatsApp na odbiorcę (wszystkie poziomy razem) – krótka, do czytania w trasie
function groupSlaWhatsapp(items, cfg) {
  if (!kanalWa(cfg)) return [];
  items = items.filter((it) => !it.cicho);
  const groups = {};
  items.forEach((it) => { (groups[it.do.id] = groups[it.do.id] || { do: it.do, items: [] }).items.push(it); });
  const ikona = { 1: '⏰', 2: '🔴', 3: '🚨' };
  return Object.values(groups).map((g) => {
    const lista = g.items.sort((a, b) => b.poziom - a.poziom || b.minuty - a.minuty).map((it) => {
      const r = it.wiersz;
      return `${ikona[it.poziom]} *${r.firma || r.osoba}* · ${r.wojewodztwo || '—'} · ${zl(r.szac_wartosc_pln)}\n` +
        `📞 ${formatPhone(r.telefon_norm) || r.telefon || r.email} · czeka ${fmtGodziny(it.minuty)}` +
        `${it.do.id !== it.opiekun.id ? ` · opiekun: ${it.opiekun.nazwa}` : ''}\n🆔 ${r.lead_id}`;
    }).join('\n\n');
    const eskalacja = g.items.some((it) => it.poziom >= 3);
    const tytul = eskalacja ? `🚨 *ESKALACJA: ${g.items.length} lead(y) bez kontaktu*` : `⏰ *Leady czekają na telefon (${g.items.length})*`;
    const stopka = g.items.length === 1 ? WA_STOPKA
      : `Po rozmowie odpowiedz na tę wiadomość: *numer leada + cyfra*, np. „${g.items[0].wiersz.lead_id} 1”\n1 = dodzwoniłem się · 2 = nie odebrał · 3 = umówione · 4 = niezainteresowany`;
    return wrapTestModeWa({ chatId: waChatId(g.do.whatsapp), nazwa: g.do.nazwa, message: `${tytul}\n\n${lista}\n────────\n${stopka}` }, cfg);
  }).filter(Boolean);
}

// ---------------- Poranny raport (dni robocze, pierwszy przebieg po 8:00) ----------------
// Domyka dwie dziury SLA: (1) leady z importu mają sla_poziom ustawiony na dzień importu, więc progi ich nie obudzą,
// (2) po eskalacji (poziom 3) nie ma kolejnych powiadomień. Lead jest w raporcie codziennie, dopóki ktoś go nie zamknie.
// Kolejność: ponowienia (klient pisał drugi raz) -> wynik = wartość × dni robocze czekania.
function otwarteLeady(rows, now) {
  const ponowienia = {};
  rows.filter((r) => r.duplikat_typ === 'pewny' && r.duplikat_of).forEach((r) => { ponowienia[r.duplikat_of] = (ponowienia[r.duplikat_of] || 0) + 1; });
  return rows
    .filter((r) => r.lead_id && r.duplikat_typ !== 'pewny' && !STATUSY_ZAMYKAJACE_SLA.includes(r.status))
    .map((r) => {
      const minuty = businessMinutes(r.data_zgloszenia, now);
      const dni = Math.max(1, minuty / 480);
      return { wiersz: r, minuty, ponowienia: ponowienia[r.lead_id] || 0, wynik: Math.round((Number(r.szac_wartosc_pln) || 0) * dni) };
    })
    .sort((a, b) => (b.ponowienia > 0) - (a.ponowienia > 0) || b.wynik - a.wynik || b.minuty - a.minuty);
}
// 1 lead, 2–4 leady, 5+ leadów (12–14 leadów)
function leadyOdm(n, przym) {
  const forma = n === 1 ? 1 : n % 10 >= 2 && n % 10 <= 4 && (n % 100 < 12 || n % 100 > 14) ? 2 : 3;
  const p = przym ? { 1: przym + 'y ', 2: przym + 'e ', 3: przym + 'ych ' }[forma] : '';
  return `${n} ${p}${{ 1: 'lead', 2: 'leady', 3: 'leadów' }[forma]}`;
}
function fmtCzeka(min) { if (min < 480) return `${fmtGodziny(min)} rob.`; const d = Math.floor(min / 480), h = Math.floor((min % 480) / 60); return `${d} ${d === 1 ? "dzień" : "dni"}${h ? ` ${h} h` : ""} rob.`; }

function morningReport(rows, handlowcyRows, cfg, now) {
  const otwarte = otwarteLeady(rows, now);
  const marek = marekOf(cfg);
  const grupy = {};
  const dodaj = (odbiorca, it) => { (grupy[odbiorca.id] = grupy[odbiorca.id] || { do: odbiorca, items: [] }).items.push(it); };
  otwarte.forEach((it) => {
    const opiekun = recipientFor(it.wiersz, handlowcyRows, cfg);
    dodaj(opiekun, { ...it, opiekun });
    // Marek widzi wszystko po SLA (> 1 dzień roboczy), także leady handlowców
    if (opiekun.id !== marek.id && slaLevelAt(it.wiersz.data_zgloszenia, now) >= 2) dodaj(marek, { ...it, opiekun });
  });
  const suma = (items) => zl(items.reduce((s, it) => s + (Number(it.wiersz.szac_wartosc_pln) || 0), 0));
  const emaile = [], whatsapp = [];
  Object.values(grupy).forEach((g) => {
    const czyMarek = g.do.id === marek.id;
    const tytul = czyMarek ? `Poranny raport: ${leadyOdm(g.items.length)} po SLA lub bez handlowca (${suma(g.items)})`
      : `Poranny raport: ${leadyOdm(g.items.length, 'otwart')} do telefonu (${suma(g.items)})`;
    const wiersze = g.items.map((it, i) => {
      const r = it.wiersz, p = slaLevelAt(r.data_zgloszenia, now);
      const kolor = ['#15803d', '#b45309', '#b91c1c', '#7f1d1d'][p];
      return `<tr style="border-top:1px solid #e1e6eb">
<td style="padding:8px 6px;color:#888">${i + 1}.</td>
<td style="padding:8px 6px"><b>${esc(r.firma || r.osoba)}</b>${it.ponowienia ? ` <span style="background:#fbefdc;color:#b45309;border-radius:6px;padding:1px 6px;font-size:12px">pisał ${it.ponowienia + 1}×</span>` : ''}<br>
<span style="color:#555;font-size:13px">${esc(r.lead_id)} · ${esc(r.wojewodztwo || 'woj. nieustalone')}${czyMarek ? ` · opiekun: ${esc(it.opiekun.nazwa)}` : ''}${r.status === 'nie_odebral' ? ` · nie odebrał (${esc(r.proby)}×)` : ''}</span>
${r.notatka ? `<br><span style="color:#555;font-size:13px">📝 ${esc(r.notatka)}</span>` : ''}</td>
<td style="padding:8px 6px;white-space:nowrap"><a href="tel:${esc(r.telefon_norm)}">${esc(formatPhone(r.telefon_norm) || r.telefon || r.email)}</a></td>
<td style="padding:8px 6px;white-space:nowrap;text-align:right">${zl(r.szac_wartosc_pln)}</td>
<td style="padding:8px 6px;white-space:nowrap;color:${kolor};font-weight:bold">${fmtCzeka(it.minuty)}</td></tr>
<tr><td></td><td colspan="4" style="padding:0 6px 8px">${statusButtons(cfg, r.lead_id, r.token, g.do.id)}</td></tr>`;
    }).join('');
    const html = `<div style="font-family:Arial,sans-serif;font-size:14px;max-width:760px">
<h3 style="margin:0 0 4px">${esc(tytul)}</h3>
<p style="margin:0 0 12px;color:#555">Lista wraca codziennie, dopóki lead nie zostanie zamknięty (dodzwoniono / umówione / niezainteresowany). Na górze ponowienia, potem wartość × czas czekania.</p>
<table style="border-collapse:collapse;width:100%">${wiersze}</table></div>`;
    emaile.push(wrapTestMode({ to: g.do.email, cc: '', subject: tytul, html }, cfg));

    if (kanalWa(cfg)) {
      const top = g.items.slice(0, 5).map((it, i) => {
        const r = it.wiersz;
        return `${i + 1}. ${it.ponowienia ? '⚠️ ' : ''}*${r.firma || r.osoba}* · ${zl(r.szac_wartosc_pln)} · czeka ${fmtCzeka(it.minuty)}\n📞 ${formatPhone(r.telefon_norm) || r.telefon || r.email} · 🆔 ${r.lead_id}`;
      }).join('\n\n');
      const reszta = g.items.length > 5 ? `\n\n…i jeszcze ${g.items.length - 5} – pełna lista w mailu.` : '';
      const naglowek = czyMarek ? `☀️ *Poranny raport – po SLA / bez handlowca: ${g.items.length}* (${suma(g.items)})`
        : `☀️ *Dzień dobry! Otwarte leady: ${g.items.length}* (${suma(g.items)})`;
      const wa = wrapTestModeWa({ chatId: waChatId(g.do.whatsapp), nazwa: g.do.nazwa,
        message: `${naglowek}\n\n${top}${reszta}\n────────\nPo rozmowie odpowiedz: *numer leada + cyfra*, np. „${g.items[0].wiersz.lead_id} 1”` }, cfg);
      if (wa) whatsapp.push(wa);
    }
  });
  const historia = Object.values(grupy).map((g) => ({ czas: now, lead_id: '', zdarzenie: 'raport', kto: 'system',
    szczegoly: `poranny raport do ${g.do.nazwa}: ${g.items.length} leadów (${g.items.map((it) => it.wiersz.lead_id).join(', ')})` }));
  return { emaile, whatsapp, historia, otwarte: otwarte.length };
}

// ---------------- Poranne zestawienia (punkt 5 klienta): osobiste dla handlowców i zbiorcze dla Marka ----------------
// Okno „wczoraj” = od 8:00 poprzedniego dnia roboczego do teraz (w poniedziałek obejmuje piątek i weekend).
// Handlowiec: przypomnij dziś · nowe · jeszcze nieobsłużone · wczoraj obsłużone. Marek: liczby zespołu, tabela, eskalacje, duże leady.
const DNI_TYG = ['niedziela', 'poniedziałek', 'wtorek', 'środa', 'czwartek', 'piątek', 'sobota'];
const MIES = ['stycznia', 'lutego', 'marca', 'kwietnia', 'maja', 'czerwca', 'lipca', 'sierpnia', 'września', 'października', 'listopada', 'grudnia'];
function dzienRoboczyPrzed(dataStr) {
  const d = parseLocal(String(dataStr).slice(0, 10) + ' 00:00');
  do { d.setUTCDate(d.getUTCDate() - 1); } while (!isBusinessDay(d));
  return d.toISOString().slice(0, 10);
}
function dataSlownie(s) { const d = parseLocal(s); return d ? `${DNI_TYG[d.getUTCDay()]}, ${d.getUTCDate()} ${MIES[d.getUTCMonth()]}` : ''; }
function terminSlownie(termin, now) {
  if (!termin) return '';
  const dzis = String(now).slice(0, 10), jutro = dzienRoboczyPo(now, 1), dzien = termin.slice(0, 10);
  if (dzien === dzis) return 'dziś do 16:00';
  if (dzien === jutro) return `${DNI_TYG[parseLocal(termin).getUTCDay()]} do 16:00`;
  return `${termin.slice(8, 10)}.${termin.slice(5, 7)} do 16:00`;
}
function statusLinki(cfg, r, kto) {
  const link = (s, t) => `<a href="${esc(cfg.STATUS_URL)}?lead=${encodeURIComponent(r.lead_id)}&t=${r.token}&s=${s}&kto=${encodeURIComponent(kto)}" style="color:#0e5c88;text-decoration:none;font-weight:bold">${t}</a>`;
  return [link('dodzwoniono', '✅ Dodzwoniłem się'), link('nie_odebral', '📵 Nie odebrał'), link('umowione', '📅 Umówione'), link('niezainteresowany', '✖ Niezainteresowany')].join(' &nbsp;·&nbsp; ');
}

// Dane do zestawień – bez HTML, testowalne
function danePoranne(rows, historia, handlowcyRows, cfg, now) {
  const od = `${dzienRoboczyPrzed(now)} 08:00`;
  const wOknie = (t) => !!t && String(t).slice(0, 16) >= od && String(t).slice(0, 16) < String(now).slice(0, 16);
  const ponowienia = {};
  rows.filter((r) => r.duplikat_typ === 'pewny' && r.duplikat_of).forEach((r) => { ponowienia[r.duplikat_of] = (ponowienia[r.duplikat_of] || 0) + 1; });
  const byId = Object.fromEntries(rows.map((r) => [r.lead_id, r]));
  const prog = Number(cfg.PROG_LIDER) || 50000;
  const dzis = String(now).slice(0, 10);

  const otwarte = otwarteLeady(rows, now).map((it) => {
    const r = it.wiersz, poziom = slaLevelAt(r.data_zgloszenia, now), termin = terminDoby(r.data_zgloszenia);
    const nowy = wOknie(r.data_zgloszenia);
    let powod = '';
    if (poziom >= 3) powod = `eskalacja – bez kontaktu ${fmtCzeka(it.minuty)}`;
    else if (poziom === 2) powod = `po terminie (minął ${termin.slice(8, 10)}.${termin.slice(5, 7)} 16:00)`;
    else if (termin.slice(0, 10) === dzis) powod = 'termin mija dziś o 16:00';
    else if (r.status === 'nie_odebral') powod = `nie odebrał (${r.proby || 1}×) – spróbuj ponownie`;
    return { ...it, poziom, termin, nowy, powod, naDzis: !!powod, opiekun: recipientFor(r, handlowcyRows, cfg) };
  });

  // Obsłużone w oknie: zmiany statusu z historii (ostatnia na lead), wynik i notatka z aktualnego wiersza
  const ostatnie = {};
  historia.filter((h) => h.zdarzenie === 'status' && wOknie(h.czas) && byId[h.lead_id])
    .sort((a, b) => String(a.czas).localeCompare(String(b.czas))).forEach((h) => { ostatnie[h.lead_id] = h; });
  const obsluzone = Object.values(ostatnie).map((h) => {
    const r = byId[h.lead_id];
    const pierwszyWOknie = wOknie(r.pierwszy_kontakt);
    return {
      wiersz: r, kto: h.kto || r.handlowiec, czas: h.czas, opiekun: recipientFor(r, handlowcyRows, cfg),
      reakcja: pierwszyWOknie ? businessMinutes(r.data_zgloszenia, r.pierwszy_kontakt) : null,
      wTerminie: pierwszyWOknie ? String(r.pierwszy_kontakt).slice(0, 16) <= terminDoby(r.data_zgloszenia) : null,
    };
  }).sort((a, b) => String(b.czas).localeCompare(String(a.czas)));

  const nowe = rows.filter((r) => wOknie(r.data_zgloszenia) && r.duplikat_typ !== 'pewny');
  return { od, now, otwarte, obsluzone, nowe, ponowienia, prog, byId };
}

function sekcja(tytul, kolor, licznik, tresc, pusto) {
  return `<tr><td style="padding:22px 24px 6px"><div style="font:bold 15px Arial,sans-serif;color:${kolor}">${tytul} <span style="color:#8a96a1;font-weight:normal">(${licznik})</span></div></td></tr>
<tr><td style="padding:0 24px">${licznik ? tresc : `<div style="font:14px Arial,sans-serif;color:#8a96a1;padding:6px 0">${pusto}</div>`}</td></tr>`;
}
function ramkaMaila(naglowek, podtytul, kafle, sekcje) {
  return `<div style="background:#f2f4f6;padding:20px 0"><table role="presentation" cellpadding="0" cellspacing="0" style="max-width:680px;width:100%;margin:0 auto;background:#ffffff;border-radius:12px;border:1px solid #e1e6eb">
<tr><td style="padding:22px 24px 16px;border-bottom:1px solid #e1e6eb"><div style="font:bold 20px Arial,sans-serif;color:#142029">${naglowek}</div>
<div style="font:13px Arial,sans-serif;color:#5d6a76;margin-top:4px">${podtytul}</div></td></tr>
<tr><td style="padding:16px 18px 0"><table role="presentation" cellpadding="0" cellspacing="0" style="width:100%"><tr>${kafle.map(([l, w, kolor]) =>
  `<td style="padding:0 6px"><div style="background:#f6f8fa;border:1px solid #e1e6eb;border-radius:10px;padding:10px 12px"><div style="font:bold 22px Arial,sans-serif;color:${kolor || '#142029'}">${w}</div><div style="font:12px Arial,sans-serif;color:#5d6a76">${l}</div></div></td>`).join('')}</tr></table></td></tr>
${sekcje.join('\n')}
<tr><td style="padding:22px 24px;font:12px Arial,sans-serif;color:#8a96a1;border-top:1px solid #e1e6eb">Zestawienie wysyłane w dni robocze o 8:00. Czas liczony w godzinach pracy (pn–pt 8–16). Termin pierwszego telefonu: do 16:00 następnego dnia roboczego po zgłoszeniu.</td></tr>
</table></div>`;
}
const badge = (t, kolor, tlo) => `<span style="display:inline-block;font:bold 11px Arial,sans-serif;color:${kolor};background:${tlo};border-radius:6px;padding:2px 6px;margin-left:4px">${t}</span>`;
function wierszLeada(it, cfg, kto, dodatki = '') {
  const r = it.wiersz;
  const kolor = it.poziom >= 3 ? '#7c1515' : it.poziom === 2 ? '#b42318' : it.powod && it.powod.startsWith('termin') ? '#b45309' : '#5d6a76';
  return `<div style="border:1px solid #e1e6eb;border-left:4px solid ${kolor};border-radius:8px;padding:10px 12px;margin:8px 0;font:14px Arial,sans-serif;color:#142029">
<b>${esc(r.firma || r.osoba)}</b>${it.ponowienia ? badge(`pisał ${it.ponowienia + 1}×`, '#b45309', '#fbefdc') : ''}${it.nowy ? badge('NOWY', '#0e5c88', '#e2eef6') : ''}${Number(r.szac_wartosc_pln) > (Number(cfg.PROG_LIDER) || 50000) ? badge('💰 duży', '#4b45a1', '#eae9f9') : ''}
<span style="float:right;font-weight:bold">${zl(r.szac_wartosc_pln)}</span><br>
<span style="color:#5d6a76;font-size:13px">${esc(r.lead_id)} · ${esc(r.miasto || '')}${r.wojewodztwo ? ', ' + esc(r.wojewodztwo) : ''} · 📞 <a href="tel:${esc(r.telefon_norm)}" style="color:#142029">${esc(formatPhone(r.telefon_norm) || r.telefon || r.email)}</a>${dodatki}</span>
${it.powod ? `<br><span style="color:${kolor};font-size:13px;font-weight:bold">${esc(it.powod)}</span>` : ''}
${r.notatka ? `<br><span style="color:#5d6a76;font-size:13px">📝 ${esc(r.notatka)}</span>` : ''}
${kto ? `<div style="margin-top:6px;font-size:12px">${statusLinki(cfg, r, kto)}</div>` : ''}</div>`;
}
function wierszObsluzony(o, pokazKto) {
  const r = o.wiersz;
  const termin = o.wTerminie === null ? '' : o.wTerminie ? badge('w terminie', '#17803d', '#e3f3e8') : badge('po terminie', '#b42318', '#fae5e2');
  return `<div style="padding:7px 0;border-bottom:1px solid #eef1f4;font:14px Arial,sans-serif;color:#142029">✅ <b>${esc(r.firma || r.osoba)}</b> – ${esc(STATUS_ETYKIETY[r.status] || r.status)}${termin}
<span style="color:#5d6a76;font-size:13px"> · ${esc(r.lead_id)}${pokazKto ? ` · ${esc(o.kto)}` : ''}${o.reakcja !== null ? ` · reakcja ${fmtCzeka(o.reakcja)}` : ''}</span>
${r.notatka ? `<br><span style="color:#5d6a76;font-size:13px">📝 ${esc(r.notatka)}</span>` : ''}</div>`;
}

function zestawienieHandlowca(osoba, d, cfg) {
  const moje = d.otwarte.filter((it) => it.opiekun.id === osoba.id);
  // Rozłącznie: starsze wymagające działania | nowe (wszystkie, z terminem) | starsze w terminie
  const naDzis = moje.filter((it) => !it.nowy && it.naDzis);
  const nowe = moje.filter((it) => it.nowy);
  const pozostale = moje.filter((it) => !it.nowy && !it.naDzis);
  const doTelefonuDzis = moje.filter((it) => it.naDzis); // też nowe z terminem dziś
  const kolejnosc = [...doTelefonuDzis].sort((a, b) => b.poziom - a.poziom || (b.ponowienia > 0) - (a.ponowienia > 0) || b.wynik - a.wynik);
  const obsl = d.obsluzone.filter((o) => o.opiekun.id === osoba.id);
  const imie = osoba.nazwa.split(' ')[0];
  const html = ramkaMaila(`☀️ Dzień dobry, ${esc(imie)}!`, `Twoje leady · ${dataSlownie(d.now)} · stan na ${d.now.slice(11, 16)}`,
    [['zadzwoń dziś', doTelefonuDzis.length, doTelefonuDzis.length ? '#b42318' : '#17803d'], ['nowe', nowe.length], ['otwarte razem', moje.length], ['wczoraj obsłużone', obsl.length, '#17803d']],
    [
      sekcja('🔔 Przypomnij dziś – zaległe, zadzwoń do 16:00', '#b42318', naDzis.length, naDzis.map((it) => wierszLeada(it, cfg, osoba.id)).join(''), 'Nic zaległego – świetnie!'),
      sekcja('🆕 Nowe od wczoraj', '#0e5c88', nowe.length, nowe.map((it) => wierszLeada({ ...it, nowy: false, powod: `termin pierwszego telefonu: ${terminSlownie(it.termin, d.now)}` }, cfg, osoba.id)).join(''), 'Brak nowych leadów.'),
      sekcja('⏳ Jeszcze nieobsłużone (w terminie)', '#5d6a76', pozostale.length, pozostale.map((it) => wierszLeada({ ...it, powod: `termin: ${terminSlownie(it.termin, d.now)}` }, cfg, osoba.id)).join(''), 'Brak.'),
      sekcja('✅ Wczoraj obsłużone', '#17803d', obsl.length, obsl.map((o) => wierszObsluzony(o, false)).join(''), 'Wczoraj nie było rozmów zapisanych w systemie.'),
    ]);
  const subject = `☀️ Twoje leady na ${dataSlownie(d.now)}: zadzwoń dziś ${doTelefonuDzis.length}, nowe ${nowe.length}, wczoraj obsłużone ${obsl.length}`;
  const top = kolejnosc.slice(0, 5).map((it, i) => `${i + 1}. ${it.ponowienia ? '⚠️ ' : ''}${it.nowy ? '🆕 ' : ''}*${it.wiersz.firma || it.wiersz.osoba}* · ${zl(it.wiersz.szac_wartosc_pln)}\n   ${it.powod}\n   📞 ${formatPhone(it.wiersz.telefon_norm) || it.wiersz.email} · 🆔 ${it.wiersz.lead_id}`).join('\n');
  const wa = `☀️ *Dzień dobry, ${imie}!*\nZadzwoń dziś: *${doTelefonuDzis.length}* · nowe: ${nowe.length} · otwarte: ${moje.length} · wczoraj obsłużone: ${obsl.length}` +
    (kolejnosc.length ? `\n\n🔔 *Do 16:00:*\n${top}${kolejnosc.length > 5 ? `\n…i jeszcze ${kolejnosc.length - 5} – w mailu.` : ''}\n────────\nPo rozmowie odpowiedz: *numer leada + cyfra*, np. „${kolejnosc[0].wiersz.lead_id} 1”` : '\n\nNic na dziś – dobrego dnia! 👍');
  return {
    osoba, liczby: { doTelefonuDzis: doTelefonuDzis.length, zalegle: naDzis.length, nowe: nowe.length, otwarte: moje.length, obsluzone: obsl.length },
    email: wrapTestMode({ to: osoba.email, cc: '', subject, html }, cfg),
    whatsapp: kanalWa(cfg) ? wrapTestModeWa({ chatId: waChatId(osoba.whatsapp), nazwa: osoba.nazwa, message: wa }, cfg) : null,
  };
}

function zestawienieMarka(d, osoby, cfg) {
  const marek = marekOf(cfg);
  const pierwsze = d.obsluzone.filter((o) => o.wTerminie !== null);
  const wTerminie = pierwsze.filter((o) => o.wTerminie).length;
  const proc = pierwsze.length ? Math.round((wTerminie / pierwsze.length) * 100) + '%' : '—';
  const eskalacje = d.otwarte.filter((it) => it.poziom >= 3);
  const poTerminie = d.otwarte.filter((it) => it.poziom === 2);
  const duze = d.otwarte.filter((it) => Number(it.wiersz.szac_wartosc_pln) > d.prog);
  const suma = (a) => zl(a.reduce((s, it) => s + (Number(it.wiersz.szac_wartosc_pln) || 0), 0));
  const tabela = `<table role="presentation" cellpadding="0" cellspacing="0" style="width:100%;border-collapse:collapse;font:13px Arial,sans-serif;color:#142029">
<tr style="color:#8a96a1;font-size:11px;text-transform:uppercase"><td style="padding:6px 4px">Opiekun</td><td style="padding:6px 4px;text-align:right">Nowe</td><td style="padding:6px 4px;text-align:right">Obsłużone</td><td style="padding:6px 4px;text-align:right">Otwarte</td><td style="padding:6px 4px;text-align:right">Po terminie</td><td style="padding:6px 4px;text-align:right">Eskalacje</td><td style="padding:6px 4px;text-align:right">Wartość otwartych</td></tr>
${osoby.map((o) => {
    const ot = d.otwarte.filter((it) => it.opiekun.id === o.id);
    const nowe = d.nowe.filter((r) => recipientFor(r, [], cfg).id === o.id || r.handlowiec_id === o.id).length;
    const ob = d.obsluzone.filter((x) => x.opiekun.id === o.id).length;
    const pt = ot.filter((it) => it.poziom === 2).length, es = ot.filter((it) => it.poziom >= 3).length;
    const czerw = (n) => (n ? `<b style="color:#b42318">${n}</b>` : '<span style="color:#8a96a1">0</span>');
    return `<tr style="border-top:1px solid #eef1f4"><td style="padding:7px 4px"><b>${esc(o.nazwa)}</b></td><td style="padding:7px 4px;text-align:right">${nowe}</td><td style="padding:7px 4px;text-align:right">${ob}</td><td style="padding:7px 4px;text-align:right">${ot.length}</td><td style="padding:7px 4px;text-align:right">${czerw(pt)}</td><td style="padding:7px 4px;text-align:right">${czerw(es)}</td><td style="padding:7px 4px;text-align:right">${suma(ot)}</td></tr>`;
  }).join('')}</table>`;
  const html = ramkaMaila('📊 Poranne zestawienie zespołu', `${dataSlownie(d.now)} · stan na ${d.now.slice(11, 16)} · „wczoraj” = od ${d.od.slice(8, 10)}.${d.od.slice(5, 7)} 8:00`,
    [['nowe', d.nowe.length], ['obsłużone', d.obsluzone.length, '#17803d'], ['w terminie doby', proc], ['otwarte', `${d.otwarte.length}`], ['po terminie', poTerminie.length, poTerminie.length ? '#b42318' : ''], ['eskalacje', eskalacje.length, eskalacje.length ? '#7c1515' : '']],
    [
      sekcja('👥 Zespół', '#142029', osoby.length, tabela, ''),
      sekcja('🚨 Eskalacje – bez kontaktu ponad 2 dni robocze', '#7c1515', eskalacje.length, eskalacje.map((it) => wierszLeada(it, cfg, '', ` · opiekun: <b>${esc(it.opiekun.nazwa)}</b>`)).join(''), 'Brak eskalacji.'),
      sekcja('⏰ Po terminie doby (wczoraj do 16:00)', '#b42318', poTerminie.length, poTerminie.map((it) => wierszLeada(it, cfg, '', ` · opiekun: <b>${esc(it.opiekun.nazwa)}</b>`)).join(''), 'Wszystkie leady w terminie.'),
      sekcja(`💰 Duże leady (powyżej ${zl(d.prog)}) bez kontaktu`, '#4b45a1', duze.length, duze.map((it) => wierszLeada(it, cfg, '', ` · opiekun: <b>${esc(it.opiekun.nazwa)}</b>`)).join(''), 'Brak otwartych dużych leadów.'),
      sekcja('✅ Wczoraj obsłużone', '#17803d', d.obsluzone.length, d.obsluzone.map((o) => wierszObsluzony(o, true)).join(''), 'Wczoraj nie było rozmów zapisanych w systemie.'),
    ]);
  const subject = `📊 Zespół ${dataSlownie(d.now)}: obsłużone ${d.obsluzone.length}, nowe ${d.nowe.length}, po terminie ${poTerminie.length}, eskalacje ${eskalacje.length}`;
  const wa = `📊 *Poranne zestawienie – ${dataSlownie(d.now)}*\nWczoraj: nowe ${d.nowe.length} · obsłużone ${d.obsluzone.length} · w terminie doby ${proc}\nOtwarte: ${d.otwarte.length} (${suma(d.otwarte)}) · po terminie ${poTerminie.length} · eskalacje *${eskalacje.length}*` +
    (eskalacje.length ? `\n\n🚨 *Eskalacje:*\n${eskalacje.slice(0, 5).map((it, i) => `${i + 1}. *${it.wiersz.firma || it.wiersz.osoba}* · ${zl(it.wiersz.szac_wartosc_pln)} · ${it.opiekun.nazwa} · czeka ${fmtCzeka(it.minuty)}`).join('\n')}${eskalacje.length > 5 ? `\n…i jeszcze ${eskalacje.length - 5} – w mailu.` : ''}` : '');
  return {
    liczby: { nowe: d.nowe.length, obsluzone: d.obsluzone.length, wTerminie: proc, otwarte: d.otwarte.length, poTerminie: poTerminie.length, eskalacje: eskalacje.length },
    email: wrapTestMode({ to: marek.email, cc: '', subject, html }, cfg),
    whatsapp: kanalWa(cfg) ? wrapTestModeWa({ chatId: waChatId(marek.whatsapp), nazwa: marek.nazwa, message: wa }, cfg) : null,
  };
}

// Wszystkie zestawienia dnia: handlowcy (i Ania, jeśli ma leady) + Marek
function zestawieniaPoranne(rows, historia, handlowcyRows, cfg, now) {
  const d = danePoranne(rows, historia, handlowcyRows, cfg, now);
  const osoby = handlowcyRows.filter((h) => h.handlowiec_id).map((h) => osobaPoId(h.handlowiec_id, handlowcyRows, cfg));
  if (d.otwarte.some((it) => it.opiekun.id === 'ANIA') || d.obsluzone.some((o) => o.opiekun.id === 'ANIA')) osoby.push(aniaOf(cfg));
  const osobiste = osoby.map((o) => zestawienieHandlowca(o, d, cfg))
    .filter((z) => z.liczby.otwarte || z.liczby.obsluzone); // kto nie ma nic – nie dostaje pustego maila
  const marek = zestawienieMarka(d, osoby, cfg);
  const historiaWpisy = [...osobiste.map((z) => z.osoba.nazwa), 'Marek'].map((kto) => ({ czas: now, lead_id: '', zdarzenie: 'raport', kto: 'system', szczegoly: `poranne zestawienie: ${kto}` }));
  return { osobiste, marek, dane: d, historia: historiaWpisy };
}

// ---------------- Obsługa co minutę (workflow „Obsługa co minutę”) ----------------
// Jeden przebieg, jeden stan: skrzynka „Wpisz lead” -> odpowiedzi z WhatsAppa -> SLA (co 15 min).
// Kolejne kroki widzą zmiany poprzednich (np. lead ze skrzynki potwierdzony w tej samej minucie).
const SLA_HISTORIA = { 1: 'przypomnienie 4h', 2: 'po terminie doby roboczej – w porannym zestawieniu', 3: 'eskalacja (2 dni robocze) – w porannym zestawieniu Marka' };
function processCycle({ wpisy = [], wiadomosci = [], rows = [], handlowcy = [], cfg, now, sla = false, raport = false }) {
  const out = { nowe_leady: [], aktualizacje: [], historia: [], emaile: [], whatsapp: [], wyniki: [] };
  const mail = String(cfg.KANAL || 'mail') !== 'whatsapp';

  // 1. Skrzynka „Wpisz lead”
  const inbox = processInbox(wpisy, rows, handlowcy, cfg, now);
  out.nowe_leady.push(...inbox.leady);
  out.historia.push(...inbox.historia);
  out.wyniki.push(...inbox.wyniki);
  if (mail) out.emaile.push(...inbox.emaile);
  out.whatsapp.push(...inbox.whatsapp);
  let stan = [...rows, ...inbox.leady];

  // 2. Odpowiedzi handlowców z WhatsAppa
  const zmiany = {};
  const zmien = (id, z) => {
    zmiany[id] = { ...(zmiany[id] || { lead_id: id }), ...z };
    stan = stan.map((r) => (r.lead_id === id ? { ...r, ...z } : r));
  };
  for (const w of processWaReplies(wiadomosci, stan, handlowcy, cfg, now)) {
    if (w.update) zmien(w.lead_id, w.update);
    if (w.historia) out.historia.push(...w.historia);
    if (w.reply) out.whatsapp.push(w.reply);
  }

  // 3. SLA: przypomnienia i eskalacje
  if (sla) {
    const items = checkSla(stan, handlowcy, cfg, now);
    items.forEach((it) => {
      zmien(it.lead_id, { sla_poziom: it.poziom, aktualizacja: now });
      out.historia.push({ czas: now, lead_id: it.lead_id, zdarzenie: 'sla', kto: 'system',
        szczegoly: `${SLA_HISTORIA[it.poziom]}; czeka ${it.minuty} min roboczych${it.cicho ? '' : `; powiadomienie do ${it.do.nazwa}`}` });
    });
    const doWyslania = items.filter((it) => !it.cicho);
    if (mail) out.emaile.push(...groupSlaEmails(doWyslania, cfg));
    out.whatsapp.push(...groupSlaWhatsapp(doWyslania, cfg));
  }

  // 4. Poranny raport (raz dziennie): lista otwartych leadów, aż ktoś je zamknie – na stanie po krokach 1–3
  if (raport) {
    const r = morningReport(stan, handlowcy, cfg, now);
    if (mail) out.emaile.push(...r.emaile);
    out.whatsapp.push(...r.whatsapp);
    out.historia.push(...r.historia);
  }

  // Zmiany leadów dodanych w tym przebiegu trafiają od razu do nowego wiersza (jeszcze go nie ma w arkuszu)
  out.nowe_leady = out.nowe_leady.map((r) => (zmiany[r.lead_id] ? { ...r, ...zmiany[r.lead_id] } : r));
  out.nowe_leady.forEach((r) => { delete zmiany[r.lead_id]; });
  out.aktualizacje = Object.values(zmiany);
  out.cokolwiek = Object.values(out).some((v) => Array.isArray(v) && v.length > 0);
  return out;
}

// === Węzeł Code: "Przetwórz lead" (workflow 1 – Przyjęcie leada, tryb: Run Once for All Items) ===
// Jedno wejście dla: webhooka strony WWW (JSON) i formularza klienta. Dla formularza dokłada stronę z podziękowaniem.
// Wyjątki z zakładki „Wyjątki” (np. Termex -> biuro); brak zakładki = brak wyjątków
const cfg = { ...$('Konfiguracja').first().json, WYJATKI: $('Pobierz wyjątki').all().map((i) => i.json).filter((w) => w.dopasowanie) };
const body = $('Zgłoszenie').first().json || {};
const existing = $('Pobierz leady').all().map((i) => i.json).filter((r) => r.lead_id);
const handlowcy = $('Pobierz handlowców').all().map((i) => i.json).filter((r) => r.handlowiec_id);

const wynik = processInquiry(body, existing, handlowcy, cfg, nowWarsaw());
wynik.wejscie = body._wejscie || 'webhook';
if (wynik.wejscie === 'klient') wynik.strona = klientPage(wynik, cfg.FORM_KLIENT_URL || '/form/klimatech');
return [{ json: wynik }];
