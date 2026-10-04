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
// Progi SLA w minutach roboczych: 4 h -> przypomnienie, 1 dzień -> "po SLA", 2 dni -> eskalacja do Marka
const SLA_PROGI = [240, 480, 960];

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
function slaLevel(minutes) {
  return SLA_PROGI.filter((p) => minutes >= p).length; // 0..3
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

function parseHandlowcy(rows) {
  const map = {};
  rows.forEach((h) => String(h.wojewodztwa || '').split(';').map((w) => w.trim().toLowerCase()).filter(Boolean)
    .forEach((w) => { map[w] = { id: h.handlowiec_id, nazwa: h.imie_nazwisko, email: h.email }; }));
  return map;
}
function route(wojewodztwo, handlowcyMap) {
  if (!wojewodztwo) return { routing: 'do_ustalenia', handlowiec: null };
  const h = handlowcyMap[wojewodztwo];
  return h ? { routing: 'handlowiec', handlowiec: h } : { routing: 'bez_opiekuna', handlowiec: null };
}
function recipientFor(row, handlowcyRows, cfg) {
  if (row.routing === 'bez_opiekuna') return { id: 'MAREK', nazwa: 'Marek', email: cfg.MAREK_EMAIL };
  if (row.routing === 'do_ustalenia') return { id: 'ANIA', nazwa: 'Ania (biuro)', email: cfg.ANIA_EMAIL };
  const h = handlowcyRows.find((x) => x.handlowiec_id === row.handlowiec_id);
  return h ? { id: h.handlowiec_id, nazwa: h.imie_nazwisko, email: h.email } : { id: 'ANIA', nazwa: 'Ania (biuro)', email: cfg.ANIA_EMAIL };
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

// ---------------- Przetworzenie nowego zapytania (workflow A) ----------------

function validateInput(inp) {
  const errors = [];
  if (!String(inp.firma || '').trim() && !String(inp.osoba || '').trim()) errors.push('Podaj firmę lub osobę kontaktową.');
  const tel = normalizePhone(inp.telefon), mail = normalizeEmail(inp.email);
  if (!tel && !mail) errors.push('Podaj poprawny telefon (9 cyfr) lub e-mail.');
  if (String(inp.telefon || '').trim() && !tel) errors.push('Niepoprawny numer telefonu.');
  if (String(inp.email || '').trim() && !mail) errors.push('Niepoprawny adres e-mail.');
  return errors;
}

function buildLeadRow(inp, existing, handlowcyRows, now, opts = {}) {
  const hMap = parseHandlowcy(handlowcyRows);
  const telefon_norm = normalizePhone(inp.telefon);
  const email_norm = normalizeEmail(inp.email);
  const firma_klucz = companyKey(inp.firma);
  const woj = normalizeWojewodztwo(inp.wojewodztwo, inp.miasto);
  const dup = findDuplicate({ telefon_norm, email_norm, firma_klucz }, existing);

  // Pewny duplikat zostaje u opiekuna oryginału (ciągłość relacji)
  let routing, handlowiec;
  if (dup && dup.typ === 'pewny' && dup.original) {
    routing = dup.original.routing;
    handlowiec = dup.original.handlowiec_id ? { id: dup.original.handlowiec_id, nazwa: dup.original.handlowiec } : null;
  } else {
    ({ routing, handlowiec } = route(woj.wojewodztwo, hMap));
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
  return { row, dup };
}

function processInquiry(inp, existing, handlowcyRows, cfg, now) {
  const errors = validateInput(inp);
  if (errors.length) return { valid: false, errors, response: { ok: false, errors } };

  const { row, dup } = buildLeadRow(inp, existing, handlowcyRows, now);
  const original = dup && dup.original;
  const pewny = dup && dup.typ === 'pewny' && original;
  const oryginalZamkniety = pewny && STATUSY_ZAMYKAJACE_SLA.includes(original.status);

  // Przyciski statusu: przy pewnym duplikacie dotyczą leada pierwotnego
  const target = pewny ? original : row;
  const odbiorca = recipientFor(row, handlowcyRows, cfg);
  const opis = `${row.firma || row.osoba} (${row.wojewodztwo || 'woj. nieustalone'})`;

  let subject, intro;
  if (pewny && oryginalZamkniety) {
    subject = `Znany klient pisze ponownie: ${opis}`;
    intro = `Ten klient był już obsłużony: ${original.lead_id} z ${original.data_zgloszenia}, status <b>${STATUS_ETYKIETY[original.status] || original.status}</b>` +
      `${original.pierwszy_kontakt ? `, kontakt ${original.pierwszy_kontakt}` : ''}${original.kontakt_kto ? ` (${esc(original.kontakt_kto)})` : ''}. ` +
      'Zanim zadzwonisz, sprawdź ustalenia z poprzedniej rozmowy, żeby nie podać innej ceny.';
  } else if (pewny) {
    subject = `⚠ PONOWIENIE – klient czeka: ${opis}`;
    intro = `Klient pisze <b>drugi raz</b>. Pierwsze zapytanie ${original.lead_id} z ${original.data_zgloszenia} nadal bez kontaktu ` +
      `(dopasowanie po: ${dup.powod}). Priorytet – zadzwoń jak najszybciej.`;
  } else if (row.routing === 'bez_opiekuna') {
    subject = `BEZ OPIEKUNA: ${row.wojewodztwo} – ${row.firma || row.osoba}, ${zl(row.szac_wartosc_pln)}`;
    intro = `Województwo <b>${esc(row.wojewodztwo)}</b> nie ma przypisanego handlowca. Lead trafia do Pana, dopóki nie zapadnie decyzja, kto obsługuje ten region.`;
  } else if (row.routing === 'do_ustalenia') {
    subject = `Do przypisania: ${row.firma || row.osoba} – brak województwa`;
    intro = 'Nie udało się ustalić województwa (brak w formularzu, nieznane miasto). Proszę ustalić i przypisać handlowca.';
  } else {
    subject = `Nowy lead: ${opis} – ${row.zainteresowanie || 'zapytanie'}, ${zl(row.szac_wartosc_pln)}`;
    intro = row.wojewodztwo_zrodlo === 'miasto'
      ? `Województwo ustalone automatycznie na podstawie miasta (${esc(row.miasto)}).`
      : 'Nowe zapytanie z Twojego regionu. Cel: telefon w ciągu 4 godzin roboczych.';
  }

  const cc = [];
  if (dup && dup.typ === 'mozliwy') {
    intro += `<br><br>ℹ Możliwy duplikat ${dup.original ? dup.original.lead_id : ''} (${dup.powod}) – do potwierdzenia przez biuro.`;
    if (cfg.ANIA_EMAIL && odbiorca.email !== cfg.ANIA_EMAIL) cc.push(cfg.ANIA_EMAIL);
  }

  const html = `<div style="font-family:Arial,sans-serif;font-size:14px;max-width:600px">
<p>${intro}</p>${leadTable(row)}
<p style="margin-top:16px"><b>Po telefonie kliknij jeden przycisk:</b><br>${statusButtons(cfg, target.lead_id, target.token, odbiorca.id)}</p>
<p style="color:#888;font-size:12px">${row.lead_id}${pewny ? ` → dotyczy ${original.lead_id}` : ''} · zgłoszono ${row.data_zgloszenia} · zegar SLA od ${slaStart(row.data_zgloszenia)}</p></div>`;

  const email = wrapTestMode({ to: odbiorca.email, cc: cc.join(','), subject, html }, cfg);

  const historia = [
    { czas: now, lead_id: row.lead_id, zdarzenie: 'utworzono', szczegoly: `źródło: ${row.zrodlo}; woj.: ${row.wojewodztwo || '—'} (${row.wojewodztwo_zrodlo})` },
  ];
  if (dup) historia.push({ czas: now, lead_id: row.lead_id, zdarzenie: dup.typ === 'pewny' ? 'duplikat' : 'mozliwy_duplikat', szczegoly: `${dup.original ? dup.original.lead_id : ''} po: ${dup.powod}` });
  historia.push({ czas: now, lead_id: row.lead_id, zdarzenie: 'przypisano', szczegoly: `${row.routing}: ${odbiorca.nazwa}` });
  historia.push({ czas: now, lead_id: row.lead_id, zdarzenie: 'powiadomienie', szczegoly: `mail do ${odbiorca.email}${cc.length ? ' cc ' + cc.join(',') : ''}` });

  return {
    valid: true,
    row,
    email,
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

  const zamyka = STATUSY_ZAMYKAJACE_SLA.includes(q.s);
  const update = {
    lead_id: row.lead_id,
    status: q.s,
    proby: (Number(row.proby) || 0) + 1,
    aktualizacja: now,
  };
  if (zamyka && !row.pierwszy_kontakt) {
    update.pierwszy_kontakt = now;
    update.kontakt_kto = q.kto || row.handlowiec_id || '';
  }
  const czas = zamyka && !row.pierwszy_kontakt ? ` Czas do kontaktu: ${fmtGodziny(businessMinutes(row.data_zgloszenia, now))} roboczych.` : '';
  return {
    ok: true,
    update,
    historia: [{ czas: now, lead_id: row.lead_id, zdarzenie: 'status', szczegoly: `${q.s} (kliknął: ${q.kto || '—'})` }],
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
    const level = slaLevel(min);
    if (level <= (Number(r.sla_poziom) || 0)) continue;
    const owner = recipientFor(r, handlowcyRows, cfg);
    const marek = { id: 'MAREK', nazwa: 'Marek', email: cfg.MAREK_EMAIL };
    out.push({
      lead_id: r.lead_id, poziom: level, minuty: min,
      do: level >= 3 ? marek : owner,
      opiekun: owner,
      wiersz: r,
    });
  }
  return out;
}

const SLA_OPIS = {
  1: { tytul: 'Przypomnienie: leady czekają ponad 4 h robocze', kolor: '#b45309' },
  2: { tytul: 'PO SLA: leady bez kontaktu ponad 1 dzień roboczy', kolor: '#b91c1c' },
  3: { tytul: 'ESKALACJA: leady bez kontaktu ponad 2 dni robocze', kolor: '#7f1d1d' },
};
function groupSlaEmails(items, cfg) {
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

// === Węzeł Code: "Ustaw status" (workflow B, tryb: Run Once for All Items) ===
const query = $('Webhook').first().json.query || {};
const rows = $('Pobierz lead').all().map((i) => i.json).filter((r) => r.lead_id);

const wynik = applyStatusClick(query, rows, nowWarsaw());
return [{ json: wynik }];
