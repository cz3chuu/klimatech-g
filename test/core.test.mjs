// Uruchom: node --test test/
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { parseCsv, importLeads } from '../scripts/import-csv.mjs';
const require = createRequire(import.meta.url);
const core = require('../n8n/src/core.js');

const leady = parseCsv(readFileSync('data/klimatech-leady.csv', 'utf8'));
const handlowcy = parseCsv(readFileSync('data/klimatech-handlowcy.csv', 'utf8'));
const NOW = '2026-10-04 23:59';
const { rows } = importLeads(leady, handlowcy, NOW);
const byId = Object.fromEntries(rows.map((r) => [r.lead_id, r]));
const cfg = { MAREK_EMAIL: 'marek@klimatech.example', ANIA_EMAIL: 'biuro@klimatech.example', TEST_INBOX: 'test@example.com', TRYB_TESTOWY: 'false', STATUS_URL: 'https://n8n.example/webhook/status' };

// --- normalizacja ---
test('telefon: wszystkie formaty z arkusza -> +48XXXXXXXXX', () => {
  for (const t of ['+48 601 223 410', '601-223-410', '601 223 410', '+48601223410', '601223410', '0048601223410'])
    assert.equal(core.normalizePhone(t), '+48601223410');
  assert.equal(core.normalizePhone('12345'), '');
});
test('firma: kolejność słów i forma prawna bez znaczenia', () => {
  assert.equal(core.companyKey('ZPH Termex'), core.companyKey('Termex ZPH Sp. j.'));
  assert.equal(core.companyKey('Ekoterm Sp. z o.o.'), 'ekoterm');
  assert.notEqual(core.companyKey('Instal Szczecin'), core.companyKey('Instal Kielce Plus'));
});

// --- dane z załącznika ---
test('wykrywa wszystkie 3 pary duplikatów z eksportu', () => {
  assert.deepEqual(rows.filter((r) => r.duplikat_typ).map((r) => [r.lead_id, r.duplikat_of]),
    [['L-016', 'L-015'], ['L-023', 'L-007'], ['L-038', 'L-031']]);
});
test('duplikat zostaje u opiekuna oryginału', () => {
  assert.equal(byId['L-023'].handlowiec_id, byId['L-007'].handlowiec_id);
});
test('podlaskie i lubuskie -> bez opiekuna (7 leadów)', () => {
  const b = rows.filter((r) => r.routing === 'bez_opiekuna').map((r) => r.lead_id);
  assert.deepEqual(b, ['L-003', 'L-009', 'L-013', 'L-020', 'L-026', 'L-033', 'L-036']);
});
test('L-027 bez województwa -> świętokrzyskie z miasta -> Katarzyna Lis', () => {
  assert.equal(byId['L-027'].wojewodztwo, 'świętokrzyskie');
  assert.equal(byId['L-027'].wojewodztwo_zrodlo, 'miasto');
  assert.equal(byId['L-027'].handlowiec_id, 'H2');
});

// --- czas roboczy ---
test('SLA: lead z niedzieli startuje w poniedziałek 8:00', () => {
  assert.equal(core.slaStart('2026-10-04 19:30'), '2026-10-05 08:00');
  assert.equal(core.slaStart('2026-10-02 16:30'), '2026-10-05 08:00');
  assert.equal(core.slaStart('2026-10-01 10:00'), '2026-10-01 10:00');
});
test('godziny robocze: weekend się nie liczy, 11.11 to święto', () => {
  assert.equal(core.businessMinutes('2026-10-02 15:00', '2026-10-05 09:00'), 120);
  assert.equal(core.businessMinutes('2026-11-10 15:00', '2026-11-12 09:00'), 120);
  assert.ok(core.holidays(2026).has('2026-06-04')); // Boże Ciało
});
test('progi SLA: 4 h, 1 dzień, 2 dni robocze', () => {
  assert.deepEqual([239, 240, 480, 959, 960].map(core.slaLevel), [0, 1, 2, 2, 3]);
});

// --- workflow A: nowe zapytanie ---
test('A: ponowienie od znanego klienta bez kontaktu -> PONOWIENIE do tego samego handlowca', () => {
  const r = core.processInquiry({ firma: 'Instal Tech', osoba: 'Andrzej', telefon: '607 210 530', wojewodztwo: 'mazowieckie' }, rows, handlowcy, cfg, '2026-10-05 09:00');
  assert.equal(r.response.duplikat.typ, 'pewny');
  assert.equal(r.response.duplikat.lead_id, 'L-007');
  assert.equal(r.email.to, 't.wrona@klimatech.example');
  assert.match(r.email.subject, /PONOWIENIE/);
  assert.match(r.email.html, /lead=L-007/); // przyciski dotyczą leada pierwotnego
});
test('A: znany klient po kontakcie -> info o poprzedniej rozmowie', () => {
  const r = core.processInquiry({ firma: 'Ekoterm', telefon: '604777321', wojewodztwo: 'śląskie' }, rows, handlowcy, cfg, '2026-10-05 09:00');
  assert.match(r.email.subject, /Znany klient/);
  assert.match(r.email.html, /innej ceny/);
});
test('A: podlaskie -> mail do Marka', () => {
  const r = core.processInquiry({ firma: 'Nowa Firma Białystok', telefon: '700 100 200', wojewodztwo: 'podlaskie' }, rows, handlowcy, cfg, '2026-10-05 09:00');
  assert.equal(r.row.routing, 'bez_opiekuna');
  assert.equal(r.email.to, cfg.MAREK_EMAIL);
  assert.equal(r.row.lead_id, 'L-041');
});
test('A: walidacja i tryb testowy', () => {
  assert.equal(core.processInquiry({ firma: 'X' }, rows, handlowcy, cfg, NOW).valid, false);
  const r = core.processInquiry({ firma: 'Y', telefon: '700100201', wojewodztwo: 'pomorskie' }, rows, handlowcy, { ...cfg, TRYB_TESTOWY: 'true' }, NOW);
  assert.equal(r.email.to, 'test@example.com');
  assert.match(r.email.subject, /^\[TEST → e\.sowa@/);
});

// --- workflow B: kliknięcie statusu ---
test('B: poprawny klik zapisuje kontakt, zły token odrzuca', () => {
  const lead = byId['L-007'];
  const ok = core.applyStatusClick({ lead: 'L-007', t: lead.token, s: 'dodzwoniono', kto: 'H1' }, rows, '2026-10-05 09:30');
  assert.equal(ok.ok, true);
  assert.equal(ok.update.pierwszy_kontakt, '2026-10-05 09:30');
  assert.equal(core.applyStatusClick({ lead: 'L-007', t: 'zly', s: 'dodzwoniono' }, rows, NOW).ok, false);
  const nie = core.applyStatusClick({ lead: 'L-007', t: lead.token, s: 'nie_odebral' }, rows, NOW);
  assert.equal(nie.update.pierwszy_kontakt, undefined); // nie zamyka SLA
});

// --- workflow C: SLA ---
test('C: po imporcie brak zaległych powiadomień, następnego dnia eskalacje', () => {
  assert.equal(core.checkSla(rows, handlowcy, cfg, '2026-10-05 08:00').length, 0);
  const jutro = core.checkSla(rows, handlowcy, cfg, '2026-10-06 15:00');
  assert.ok(jutro.length > 0);
  assert.ok(jutro.every((x) => !['L-016', 'L-023', 'L-038'].includes(x.lead_id))); // duplikaty liczone na oryginale
  assert.equal(core.checkSla(rows, handlowcy, cfg, '2026-10-10 12:00').length, 0); // sobota – cisza
  const maile = core.groupSlaEmails(jutro, cfg);
  assert.ok(maile.length < jutro.length); // grupowanie po odbiorcy
});

// --- kod wklejany do n8n działa z obiektem $ jak w węźle Code ---
test('n8n/dist: węzeł "Przetwórz lead" uruchamia się z mockiem $', () => {
  const code = readFileSync('n8n/dist/A-przetworz-lead.js', 'utf8');
  const nodes = {
    Konfiguracja: [cfg],
    'Zgłoszenie': [{ firma: 'Test', telefon: '700 300 400', miasto: 'Gdańsk' }],
    'Pobierz leady': rows,
    'Pobierz handlowców': handlowcy,
  };
  const $ = (n) => ({ all: () => nodes[n].map((json) => ({ json })), first: () => ({ json: nodes[n][0] }) });
  const out = new Function('$', code)($);
  assert.equal(out[0].json.valid, true);
  assert.equal(out[0].json.row.handlowiec_id, 'H5');
});

// --- WhatsApp ---
const cfgWa = { ...cfg, KANAL: 'oba', TRYB_TESTOWY: 'true', TEST_INBOX: 'test@example.com', TEST_WHATSAPP: '600 111 222', GREEN_PHONE: '48600999888' };
const msg = (text, quoted, chatId = '48600111222@c.us', id = 'M' + Math.random()) =>
  ({ type: 'incoming', idMessage: id, chatId, typeMessage: quoted ? 'quotedMessage' : 'textMessage', textMessage: quoted ? undefined : text,
    extendedTextMessage: quoted ? { text } : undefined, quotedMessage: quoted ? { textMessage: quoted } : undefined });

test('WA: nowy lead -> krótka wiadomość na numer testowy z 🆔 i instrukcją', () => {
  const r = core.processInquiry({ firma: 'Nowa', telefon: '700 300 400', miasto: 'Gdańsk', wojewodztwo: 'pomorskie' }, rows, handlowcy, cfgWa, '2026-10-05 09:00');
  assert.equal(r.whatsapp.chatId, '48600111222@c.us');
  assert.match(r.whatsapp.message, /^\[TEST → Ewa Sowa\]/);
  assert.match(r.whatsapp.message, /🆔 L-041/);
  assert.match(r.whatsapp.message, /📞 \+48 700 300 400/);
  assert.equal(core.processInquiry({ firma: 'X', telefon: '700 300 400' }, rows, handlowcy, { ...cfgWa, KANAL: 'mail' }, '2026-10-05 09:00').whatsapp, null);
});
test('WA: ponowienie -> 🆔 leada pierwotnego', () => {
  const r = core.processInquiry({ firma: 'Kowalczyk', telefon: '607210530' }, rows, handlowcy, cfgWa, '2026-10-05 09:00');
  assert.match(r.whatsapp.message, /🆔 L-007 \(nowe zgłoszenie: L-041\)/);
});
test('WA: rozpoznawanie odpowiedzi', () => {
  assert.deepEqual(core.parseWaReply('1', 'NOWY LEAD\n🆔 L-041\n1 = ...'), { status: 'dodzwoniono', lead_id: 'L-041', wiele: false, notatka: '' });
  assert.equal(core.parseWaReply('L-7 3', '').lead_id, 'L-007');
  assert.equal(core.parseWaReply('L-007 3', '').status, 'umowione');
  assert.equal(core.parseWaReply('nie odebrał', '').status, 'nie_odebral');
  assert.equal(core.parseWaReply('Dodzwoniłem się, oddzwoni w piątek', '').status, 'dodzwoniono');
  assert.deepEqual(core.parseWaReply('2', '🆔 L-035\n\n🆔 L-036'), { status: 'nie_odebral', lead_id: '', wiele: true, notatka: '' }); // zbiorcze -> podaj numer
  assert.equal(core.parseWaReply('L-036 2', '🆔 L-035\n\n🆔 L-036').lead_id, 'L-036');
});
test('WA: odpowiedź z cytatem zapisuje status, potwierdza i loguje id wiadomości', () => {
  const out = core.processWaReplies([msg('1', '🔔 NOWY LEAD\n🆔 L-005\n…')], rows, handlowcy, cfgWa, '2026-10-05 10:00');
  assert.equal(out.length, 1);
  assert.equal(out[0].update.status, 'dodzwoniono');
  assert.equal(out[0].update.pierwszy_kontakt, '2026-10-05 10:00');
  assert.equal(out[0].update.kontakt_kto, 'H4');
  assert.match(out[0].reply.message, /✅ Zapisano: L-005 Hydro-Max/);
  assert.match(out[0].historia[0].szczegoly, /wa:/);
});
test('WA: nie odebrał nie zamyka SLA; obce numery, grupy i luźne rozmowy ignorowane', () => {
  const nie = core.processWaReplies([msg('2', '🆔 L-005')], rows, handlowcy, cfgWa, '2026-10-05 10:00')[0];
  assert.equal(nie.update.status, 'nie_odebral');
  assert.equal(nie.update.pierwszy_kontakt, undefined);
  assert.equal(core.processWaReplies([msg('1', '🆔 L-005', '48999888777@c.us')], rows, handlowcy, cfgWa, 'x').length, 0);
  assert.equal(core.processWaReplies([msg('1', '🆔 L-005', '123@g.us')], rows, handlowcy, cfgWa, 'x').length, 0);
  assert.equal(core.processWaReplies([msg('cześć, jak tam?')], rows, handlowcy, cfgWa, 'x').length, 0);
});
test('WA: bez cytatu i numeru leada -> prośba o doprecyzowanie, nic nie zapisane', () => {
  const out = core.processWaReplies([msg('1')], rows, handlowcy, cfgWa, '2026-10-05 10:00');
  assert.equal(out[0].update, undefined);
  assert.match(out[0].reply.message, /którego leada/);
});
test('WA: produkcyjnie handlowiec nie zmieni cudzego leada', () => {
  const hz = handlowcy.map((h) => ({ ...h, whatsapp: h.handlowiec_id === 'H1' ? '501000001' : '' }));
  const prod = { ...cfgWa, TRYB_TESTOWY: 'false' };
  const out = core.processWaReplies([msg('1', '🆔 L-005', '48501000001@c.us')], rows, hz, prod, '2026-10-05 10:00');
  assert.match(out[0].reply.message, /nie jest Twoim leadem/);
  assert.equal(out[0].update, undefined);
});
test('WA: przypomnienia SLA – jedna wiadomość na odbiorcę', () => {
  const items = core.checkSla(rows, handlowcy, cfgWa, '2026-10-05 15:00');
  const wa = core.groupSlaWhatsapp(items, cfgWa);
  const odbiorcy = new Set(items.map((i) => i.do.id));
  assert.equal(wa.length, odbiorcy.size);
  assert.ok(wa.every((w) => w.chatId === '48600111222@c.us' && /🆔 L-\d{3}/.test(w.message)));
});
test('WA: makieta na jednym telefonie – odpowiedź w czacie „Ty” działa, wiadomości z API pomijane', () => {
  const c1 = { ...cfgWa, TEST_WHATSAPP: '48600999888' };
  const own = (text, quoted, sendByApi) => ({ ...msg(text, quoted, '48600999888@c.us'), type: 'outgoing', sendByApi });
  assert.equal(core.processWaReplies([own('1', '🆔 L-005', false)], rows, handlowcy, c1, '2026-10-05 10:00')[0].update.status, 'dodzwoniono');
  assert.equal(core.processWaReplies([own('1', '🆔 L-005', true)], rows, handlowcy, c1, 'x').length, 0);
  assert.equal(core.processWaReplies([own('✅ Zapisano: L-005 Hydro-Max – Dodzwoniono się.', '', false)], rows, handlowcy, c1, 'x').length, 0);
  assert.equal(core.processWaReplies([own('1', '🆔 L-005', false)], rows, handlowcy, cfgWa, 'x').length, 0); // tryb dwóch telefonów: ignoruj
});
test('CRM: notatka z odpowiedzi trafia do arkusza i historii z nazwiskiem', () => {
  assert.equal(core.parseWaReply('1 chce ofertę na 10 szt., oddzwonić w piątek', '🆔 L-005').notatka, 'chce ofertę na 10 szt., oddzwonić w piątek');
  assert.equal(core.parseWaReply('nie odebrał', '').notatka, '');
  const out = core.processWaReplies([msg('3 spotkanie wtorek 10:00', '🆔 L-005')], rows, handlowcy, cfgWa, '2026-10-05 10:00')[0];
  assert.equal(out.update.notatka, 'spotkanie wtorek 10:00');
  assert.equal(out.historia[0].kto, 'Bartosz Zając');
  assert.match(out.historia[0].szczegoly, /Umówione spotkanie \(WhatsApp\) – „spotkanie wtorek 10:00”/);
});
test('CRM: znany klient – w powiadomieniu ostatnia notatka i kto rozmawiał', () => {
  const zNotatka = rows.map((r) => (r.lead_id === 'L-004' ? { ...r, notatka: 'wycena 12 domów, rabat 8%' } : r));
  const r = core.processInquiry({ firma: 'Ekoterm', telefon: '+48604777321' }, zNotatka, handlowcy, cfgWa, '2026-10-05 09:00');
  assert.match(r.whatsapp.message, /Piotr Nowak/);
  assert.match(r.whatsapp.message, /📝 „wycena 12 domów, rabat 8%”/);
  assert.match(r.email.html, /Ostatnia notatka/);
});

// --- kod synchronizacji z CRM działa z obiektem $ jak w węźle Code ---
test('n8n/dist: "Przygotuj dane" (E) – paczki dla Supabase bez tokenu, z klient_id i czasami', () => {
  const code = readFileSync('n8n/dist/E-synchronizacja.js', 'utf8');
  const { historia } = importLeads(leady, handlowcy, NOW);
  const nodes = { 'Pobierz handlowców': handlowcy, 'Pobierz leady': rows, 'Pobierz historię': [...historia, historia[0]] };
  const $ = (n) => ({ all: () => nodes[n].map((json) => ({ json })), first: () => ({ json: nodes[n][0] }) });
  const out = new Function('$', code)($).map((i) => i.json);
  assert.deepEqual(out.map((p) => p.tabela), ['handlowcy', 'leady', 'historia']);
  const l = Object.fromEntries(out[1].rows.map((r) => [r.lead_id, r]));
  assert.equal(l['L-023'].klient_id, 'L-007');
  assert.equal(l['L-001'].token, undefined);
  assert.equal(typeof l['L-001'].czas_reakcji_min, 'number');
  assert.equal(l['L-019'].email, null);
  assert.equal(out[2].rows.length, historia.length); // duplikat wpisu odfiltrowany
  assert.equal(new Set(out[1].rows.map((r) => Object.keys(r).join())).size, 1); // jednakowe klucze – wymóg upsertu
});

// --- skrzynka „Wpisz lead” (wpisy Ani: telefony, maile; później AI) ---
test('Skrzynka: kilka wierszy naraz – przydział, duplikat między wierszami, błąd zostaje do poprawki', () => {
  const wpisy = [
    { row_number: 2, zrodlo: 'telefon', firma: 'Nowa Firma Gdynia', telefon: '700 555 001', miasto: 'Gdynia', wiadomosc: 'dzwonił rano', data_kontaktu: '2026-10-05 09:10' },
    { row_number: 3, zrodlo: 'mail', firma: 'Nowa Firma Gdynia sp. z o.o.', telefon: '700-555-001', miasto: 'Gdynia' }, // ten sam telefon co wiersz 2
    { row_number: 4, zrodlo: 'telefon', firma: 'Bez kontaktu' },
    { row_number: 5, firma: 'Już przetworzony', telefon: '700 555 002', wynik: '✅ L-041' },
    { row_number: 6, firma: 'Propozycja AI', telefon: '700 555 003', akcja: 'SPRAWDŹ' },
    { row_number: 7 }, // pusty wiersz
  ];
  const out = core.processInbox(wpisy, rows, handlowcy, cfgWa, '2026-10-05 11:00');
  assert.equal(out.wyniki.length, 3);
  assert.match(out.wyniki[0].wynik, /^✅ L-041 → Ewa Sowa \(pomorskie\)/);
  assert.match(out.wyniki[1].wynik, /^⚠ L-042 – ponowienie L-041/);
  assert.match(out.wyniki[2].wynik, /^❌ .*telefon/);
  assert.equal(out.leady.length, 2);
  assert.equal(out.leady[0].data_zgloszenia, '2026-10-05 09:10'); // SLA od faktycznego telefonu
  assert.equal(out.historia.find((h) => h.zdarzenie === 'utworzono').kto, 'Ania (biuro)');
  assert.equal(out.whatsapp.length, 2);
});
test('Skrzynka: przyszła data kontaktu i AI do zatwierdzenia', () => {
  const out = core.processInbox([{ row_number: 2, firma: 'X', telefon: '700 555 004', data_kontaktu: '2030-01-01 10:00', wprowadzil: 'AI z maila, zatwierdziła Ania', akcja: 'OK' }], rows, handlowcy, cfgWa, '2026-10-05 11:00');
  assert.equal(out.leady[0].data_zgloszenia, '2026-10-05 11:00');
  assert.equal(out.historia[0].kto, 'AI z maila, zatwierdziła Ania');
});
test('n8n/dist: "Przetwórz skrzynkę" (F) – szablon zakładki daje ✅, ⚠ ponowienie i ❌', () => {
  const code = readFileSync('n8n/dist/F-skrzynka.js', 'utf8');
  const wpisy = parseCsv(readFileSync('data/wpisz-lead-szablon.csv', 'utf8')).map((r, i) => ({ ...r, row_number: i + 2 }));
  const nodes = { Konfiguracja: [cfgWa], 'Pobierz skrzynkę': wpisy, 'Pobierz leady': rows, 'Pobierz handlowców': handlowcy };
  const $ = (n) => ({ all: () => nodes[n].map((json) => ({ json })), first: () => ({ json: nodes[n][0] }) });
  const out = new Function('$', code)($)[0].json;
  assert.deepEqual(out.wyniki.map((w) => w.wynik.slice(0, 1)), ['✅', '⚠', '❌']);
  assert.match(out.wyniki[0].wynik, /Ewa Sowa \(pomorskie\)/); // Słupsk -> pomorskie z miasta
  assert.match(out.wyniki[1].wynik, /ponowienie L-031/);
});
test('G: strona po wysłaniu formularza biura – podsumowanie, ostrzeżenie o duplikacie, błędy', () => {
  const ok = core.processInquiry({ firma: 'Termex', telefon: '629 707 505', miasto: 'Płock' }, rows, handlowcy, cfgWa, '2026-10-05 11:00');
  const html = core.biuroPage(ok, '/form/biuro');
  assert.match(html, /✅ L-041 przekazany: Tomasz Wrona/);
  assert.match(html, /już pisał: <b>L-031<\/b>/);
  assert.match(html, /ustalone z miasta/);
  const zle = core.biuroPage(core.processInquiry({ firma: 'X', telefon: '600 12' }, rows, handlowcy, cfgWa, 'x'), '/form/biuro');
  assert.match(zle, /❌ Lead nie został zapisany/);
  assert.match(zle, /jest niepełny lub błędny/);
});
test('H: formularz klienta – podziękowanie z numerem, po godzinach termin, powtórka bez drugiego leada', () => {
  const inp = { firma: 'Nowa', osoba: 'Jan Nowak', telefon: '700 600 500', miasto: 'Gdańsk', wojewodztwo: 'pomorskie', zgoda: true };
  const r1 = core.processInquiry(inp, rows, handlowcy, cfgWa, '2026-10-05 10:00');
  const html = core.klientPage(r1, '/form/klimatech');
  assert.match(html, /Dziękujemy, Jan!/);
  assert.match(html, /\+48 700 600 500/);
  assert.match(html, /Ewa Sowa/);
  assert.match(r1.historia[0].szczegoly, /zgoda na kontakt \(RODO\): tak/);
  const sob = core.klientPage(core.processInquiry(inp, rows, handlowcy, cfgWa, '2026-10-10 11:00'), '/f');
  assert.match(sob, /poniedziałek 12\.10 od 8:00/);
  // to samo wysłane 3 minuty później -> powtórka, nic nie zapisujemy
  const r2 = core.processInquiry(inp, [...rows, r1.row], handlowcy, cfgWa, '2026-10-05 10:03');
  assert.equal(r2.powtorka, true);
  assert.equal(r2.row.lead_id, r1.row.lead_id);
  assert.match(core.klientPage(r2, '/f'), /już do nas dotarło/);
  // poprawiony numer -> nowe zgłoszenie (nie powtórka)
  const r3 = core.processInquiry({ ...inp, telefon: '700 600 501' }, [...rows, r1.row], handlowcy, cfgWa, '2026-10-05 10:05');
  assert.equal(r3.powtorka, undefined);
  // po 30 minutach ten sam numer = prawdziwe ponowienie
  assert.equal(core.processInquiry(inp, [...rows, r1.row], handlowcy, cfgWa, '2026-10-05 10:45').response.duplikat.typ, 'pewny');
});
