// Uruchom: node --test test/
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { parseCsv, importLeads } from '../scripts/import-csv.mjs';
const require = createRequire(import.meta.url);
const core = require('../n8n/src/core.js');

const leady = parseCsv(readFileSync('data/klimatech-leady.csv', 'utf8'));
const handlowcy = parseCsv(readFileSync('data/handlowcy.csv', 'utf8')); // aktualne przypisania (wspólne regiony)
const wyjatki = parseCsv(readFileSync('data/wyjatki.csv', 'utf8'));
const NOW = '2026-10-04 23:59';
const { rows } = importLeads(leady, handlowcy, NOW, wyjatki);
const byId = Object.fromEntries(rows.map((r) => [r.lead_id, r]));
const cfg = { WYJATKI: wyjatki, MAREK_EMAIL: 'marek@klimatech.example', ANIA_EMAIL: 'a.kos@klimatech.example', TEST_INBOX: 'test@example.com', TRYB_TESTOWY: 'false', STATUS_URL: 'https://n8n.example/webhook/status' };

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
test('lubuskie i podlaskie -> regiony wspólne po równo, nikt bez opiekuna', () => {
  assert.equal(rows.filter((r) => r.routing === 'bez_opiekuna').length, 0);
  const ile = (woj, id) => rows.filter((r) => r.wojewodztwo === woj && r.duplikat_typ !== 'pewny' && r.handlowiec_id === id).length;
  assert.equal(ile('podlaskie', 'H1'), 2); // Tomasz Wrona
  assert.equal(ile('podlaskie', 'H2'), 2); // Katarzyna Lis
  assert.ok(Math.abs(ile('lubuskie', 'H4') - ile('lubuskie', 'H6')) <= 1); // Bartosz / Michał: 3 leady -> 2:1
});
test('region wspólny: kolejny lead dostaje ten, kto ma mniej; przy remisie losowo (oba warianty możliwe)', () => {
  const lub = (id, i) => ({ lead_id: 'X-' + i, wojewodztwo: 'lubuskie', handlowiec_id: id, duplikat_typ: '' });
  const r = core.processInquiry({ firma: 'Gorzów Nowy', telefon: '700 000 111', wojewodztwo: 'lubuskie' }, [...rows, lub('H4', 1), lub('H4', 2), lub('H4', 3)], handlowcy, cfg, '2026-10-05 09:00');
  assert.equal(r.row.handlowiec_id, 'H6'); // Michał ma mniej
  assert.match(r.historia.find((h) => h.zdarzenie === 'przypisano').szczegoly, /region wspólny/);
  const wyniki = new Set();
  for (let i = 0; i < 40; i++) wyniki.add(core.processInquiry({ firma: 'Remis', telefon: '700 000 112', wojewodztwo: 'podlaskie' }, rows, handlowcy, cfg, '2026-10-05 09:00').row.handlowiec_id);
  assert.deepEqual([...wyniki].sort(), ['H1', 'H2']); // 2:2 w podlaskim -> los
});
test('wyjątek: Termex z Płocka zawsze do biura (Ani), przed duplikatem i regionem', () => {
  assert.equal(byId['L-031'].routing, 'wyjatek');
  assert.equal(byId['L-031'].handlowiec_id, 'ANIA');
  assert.equal(byId['L-038'].handlowiec_id, 'ANIA'); // ponowienie też u Ani
  const r = core.processInquiry({ firma: 'Termex Sp. j.', telefon: '700 555 999', miasto: 'Płock', wojewodztwo: 'mazowieckie' }, rows, handlowcy, cfg, '2026-10-05 09:00');
  assert.equal(r.email.to, 'a.kos@klimatech.example');
  assert.match(r.email.subject, /^Lead z wyjątku/);
  // inny Termex (inne miasto) – zwykły przydział po regionie
  assert.equal(core.processInquiry({ firma: 'Termex', telefon: '700 555 998', miasto: 'Kraków', wojewodztwo: 'małopolskie' }, rows, handlowcy, cfg, '2026-10-05 09:00').row.handlowiec_id, 'H2');
});
test('lead powyżej 50 tys.: dodatkowe powiadomienie dla Marka, lead zostaje u handlowca', () => {
  const duzy = core.processInquiry({ firma: 'Duża Inwestycja', telefon: '700 222 111', wojewodztwo: 'pomorskie', szac_wartosc_pln: 60000 }, rows, handlowcy, cfgWa, '2026-10-05 09:00');
  assert.equal(duzy.row.handlowiec_id, 'H5');
  assert.match(duzy.lider.email.subject, /\[TEST → marek@klimatech\.example\] 💰 Duży lead 60\s000 zł: Duża Inwestycja → Ewa Sowa/);
  assert.match(duzy.lider.whatsapp.message, /DUŻY LEAD[\s\S]*Opiekun: \*Ewa Sowa\*/);
  assert.ok(duzy.historia.some((h) => /lider sprzedaży/.test(h.szczegoly)));
  assert.equal(core.processInquiry({ firma: 'Równo 50', telefon: '700 222 112', wojewodztwo: 'pomorskie', szac_wartosc_pln: 50000 }, rows, handlowcy, cfgWa, 'x').lider, null); // „powyżej”
  assert.equal(core.processInquiry({ firma: 'Mała', telefon: '700 222 113', wojewodztwo: 'pomorskie', szac_wartosc_pln: 9000 }, rows, handlowcy, cfgWa, 'x').lider, null);
  // skrzynka biura: powiadomienie lidera też wychodzi
  const sk = core.processInbox([{ row_number: 2, firma: 'Duży z telefonu', telefon: '700 222 114', wojewodztwo: 'śląskie', szac_wartosc_pln: '75000' }], rows, handlowcy, cfgWa, '2026-10-05 09:00');
  assert.ok(sk.emaile.some((e) => /Duży lead/.test(e.subject)));
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
test('progi SLA: 4 h, doba robocza = do 16:00 następnego dnia roboczego, eskalacja = do 16:00 drugiego', () => {
  const pon = '2026-10-05 09:00';
  assert.deepEqual(['2026-10-05 12:59', '2026-10-05 13:00', '2026-10-06 15:59', '2026-10-06 16:00', '2026-10-07 16:00'].map((n) => core.slaLevelAt(pon, n)), [0, 1, 1, 2, 3]);
  assert.equal(core.terminDoby('2026-10-05 15:59'), '2026-10-06 16:00'); // zgłoszenie tuż przed końcem dnia – też do jutra 16:00
  assert.equal(core.terminDoby('2026-10-02 17:00'), '2026-10-05 16:00'); // piątek po godzinach -> poniedziałek
  assert.equal(core.terminDoby('2026-10-03 11:00'), '2026-10-05 16:00'); // sobota -> poniedziałek
  assert.equal(core.terminEskalacji('2026-10-30 12:00'), '2026-11-03 16:00'); // przez weekend i 1 listopada
});
test('po terminie doby i eskalacja – bez osobnej wiadomości (poranne zestawienia), wiadomość tylko po 4 h', () => {
  const lead = { lead_id: 'L-900', data_zgloszenia: '2026-10-05 09:00', status: 'nowy', routing: 'handlowiec', handlowiec_id: 'H5', handlowiec: 'Ewa Sowa', sla_poziom: 2, firma: 'Eskalowany' };
  const out = core.processCycle({ rows: [lead], handlowcy, cfg: cfgWa, now: '2026-10-08 08:00', sla: true });
  const po4h = core.processCycle({ rows: [{ ...lead, lead_id: 'L-901', sla_poziom: 0 }], handlowcy, cfg: cfgWa, now: '2026-10-05 13:00', sla: true });
  assert.equal(po4h.whatsapp.length, 1); // przypomnienie po 4 h – jedyna osobna wiadomość
  assert.equal(out.aktualizacje[0].sla_poziom, 3);
  assert.match(out.historia[0].szczegoly, /w porannym zestawieniu Marka/);
  assert.equal(out.emaile.length, 0);
  assert.equal(out.whatsapp.length, 0);
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
test('A: podlaskie -> handlowiec z regionu wspólnego, nie Marek', () => {
  const r = core.processInquiry({ firma: 'Nowa Firma Białystok', telefon: '700 100 200', wojewodztwo: 'podlaskie' }, rows, handlowcy, cfg, '2026-10-05 09:00');
  assert.equal(r.row.routing, 'handlowiec');
  assert.ok(['H1', 'H2'].includes(r.row.handlowiec_id));
  assert.notEqual(r.email.to, cfg.MAREK_EMAIL);
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
  assert.ok(jutro.some((x) => x.cicho)); // eskalacje oznaczone jako „bez wiadomości”
  assert.ok(jutro.every((x) => !['L-016', 'L-023', 'L-038'].includes(x.lead_id))); // duplikaty liczone na oryginale
  assert.equal(core.checkSla(rows, handlowcy, cfg, '2026-10-10 12:00').length, 0); // sobota – cisza
  const maile = core.groupSlaEmails(jutro, cfg);
  assert.equal(maile.length, new Set(jutro.filter((x) => !x.cicho).map((x) => x.do.id)).size); // jeden mail na odbiorcę
  assert.ok(maile.every((m) => !/ESKALACJA/.test(m.subject)));
});

// --- kod wklejany do n8n działa z obiektem $ jak w węźle Code ---
test('n8n/dist: węzeł "Przetwórz lead" uruchamia się z mockiem $', () => {
  const code = readFileSync('n8n/dist/1-przyjecie-leada.js', 'utf8');
  const nodes = {
    Konfiguracja: [cfg],
    'Zgłoszenie': [{ firma: 'Test', telefon: '700 300 400', miasto: 'Gdańsk' }],
    'Pobierz leady': rows,
    'Pobierz handlowców': handlowcy,
  };
  const $ = (n) => ({ all: () => (nodes[n] || []).map((json) => ({ json })), first: () => ({ json: (nodes[n] || [])[0] }) });
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
  const code = readFileSync('n8n/dist/4-synchronizacja-crm.js', 'utf8');
  const { historia } = importLeads(leady, handlowcy, NOW);
  const nodes = { 'Pobierz handlowców': handlowcy, 'Pobierz leady': rows, 'Pobierz historię': [...historia, historia[0]] };
  const $ = (n) => ({ all: () => (nodes[n] || []).map((json) => ({ json })), first: () => ({ json: (nodes[n] || [])[0] }) });
  const out = new Function('$', code)($).map((i) => i.json);
  assert.deepEqual(out.map((p) => p.tabela), ['leady', 'historia']); // zespół płynie odwrotnie: CRM -> arkusz
  const l = Object.fromEntries(out[0].rows.map((r) => [r.lead_id, r]));
  assert.equal(l['L-023'].klient_id, 'L-007');
  assert.equal(l['L-001'].token, undefined);
  assert.equal(typeof l['L-001'].czas_reakcji_min, 'number');
  assert.equal(l['L-019'].email, null);
  assert.equal(out[1].rows.length, historia.length); // duplikat wpisu odfiltrowany
  assert.equal(new Set(out[0].rows.map((r) => Object.keys(r).join())).size, 1); // jednakowe klucze – wymóg upsertu
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
test('n8n/dist: "Obsłuż" (obsługa co minutę) – skrzynka, odpowiedź WhatsApp i SLA w jednym przebiegu', () => {
  const code = readFileSync('n8n/dist/2-obsluga-co-minute.js', 'utf8');
  const wpisy = parseCsv(readFileSync('data/wpisz-lead-szablon.csv', 'utf8')).map((r, i) => ({ ...r, row_number: i + 2 }));
  const odp = { ...msg('1 wysłałem cennik', '🆔 L-005'), idMessage: 'W1' };
  const nodes = {
    Konfiguracja: [{ ...cfgWa, TERAZ: '2026-10-05 12:30' }], 'Pobierz skrzynkę': wpisy, 'Pobierz leady': rows, 'Pobierz handlowców': handlowcy,
    'Pobierz wiadomości': [odp, odp], 'Pobierz wysłane': [{ error: 'brak' }], 'Pobierz wyjątki': wyjatki,
  };
  const $ = (n) => ({ all: () => (nodes[n] || []).map((json) => ({ json })), first: () => ({ json: (nodes[n] || [])[0] }) });
  const pamiec = {};
  const out = new Function('$', '$getWorkflowStaticData', '$execution', code)($, () => pamiec, { mode: 'trigger' })[0].json;
  assert.deepEqual(out.wyniki.map((w) => w.wynik.slice(0, 1)), ['✅', '⚠', '❌']);
  assert.match(out.wyniki[0].wynik, /Ewa Sowa \(pomorskie\)/); // Słupsk -> pomorskie z miasta
  assert.match(out.wyniki[1].wynik, /ponowienie L-031/);
  assert.equal(out.nowe_leady.length, 2);
  const l005 = out.aktualizacje.find((u) => u.lead_id === 'L-005');
  assert.equal(l005.status, 'dodzwoniono'); // ta sama wiadomość dwa razy -> jedna zmiana
  assert.equal(l005.notatka, 'wysłałem cennik');
  assert.ok(out.aktualizacje.some((u) => u.sla_poziom >= 1)); // TERAZ ustawione -> SLA policzone
  assert.ok(out.historia.some((h) => h.zdarzenie === 'sla'));
  assert.deepEqual(pamiec.wa, ['W1']);
  // drugi przebieg z tymi samymi danymi: skrzynka i wiadomość już obsłużone (wynik wpisany, id zapamiętane)
  nodes['Pobierz skrzynkę'] = wpisy.map((w, i) => ({ ...w, wynik: out.wyniki[i].wynik }));
  nodes.Konfiguracja = [cfgWa]; // bez TERAZ: SLA tylko co 15 min, test o pełnej godzinie byłby losowy -> sprawdzamy brak powtórek
  const out2 = new Function('$', '$getWorkflowStaticData', '$execution', code)($, () => pamiec, { mode: 'trigger' });
  assert.ok(out2.length === 0 || (out2[0].json.wyniki.length === 0 && !out2[0].json.aktualizacje.some((u) => u.notatka)));
});
test('Formularz klienta – podziękowanie z numerem, po godzinach termin, powtórka bez drugiego leada', () => {
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

// --- poranny raport: zaległe leady wracają codziennie, aż ktoś je zamknie ---
test('Raport: kolejność – ponowienia, potem wartość × dni czekania; zamknięte i duplikaty pominięte', () => {
  const lista = core.otwarteLeady(rows, '2026-10-05 08:00');
  const ids = lista.map((it) => it.wiersz.lead_id);
  assert.equal(lista.length, 25); // tyle leadów bez kontaktu w eksporcie
  assert.deepEqual(ids.slice(0, 3).sort(), ['L-007', 'L-015', 'L-031']); // klienci, którzy pisali drugi raz
  assert.ok(!ids.includes('L-023') && !ids.includes('L-001')); // ponowienie liczone na oryginale, zamknięte pominięte
  assert.ok(ids.indexOf('L-009') < ids.indexOf('L-013')); // 180 tys. przed 6 tys., choć oba czekają długo
});
test('Raport: każdy handlowiec dostaje swoje, Marek po SLA i regiony bez handlowca – jedna wiadomość na odbiorcę', () => {
  const r = core.morningReport(rows, handlowcy, cfgWa, '2026-10-05 08:00');
  const tematy = r.emaile.map((e) => e.subject);
  assert.equal(r.emaile.length, r.whatsapp.length);
  assert.ok(tematy.some((t) => /\[TEST → marek@klimatech\.example\] Poranny raport: \d+ lead(y|ów)? po SLA lub bez handlowca/.test(t)));
  assert.ok(tematy.some((t) => /t\.wrona@klimatech\.example\] Poranny raport: 5 otwartych leadów do telefonu/.test(t)));
  assert.ok(tematy.some((t) => /a\.kos@klimatech\.example\] Poranny raport: 1 otwarty lead do telefonu/.test(t)));
  const marek = r.emaile.find((e) => /marek@/.test(e.subject)).html;
  assert.match(marek, /Zielona Energia Gorzów/); // lubuskie – teraz u handlowca, ale po SLA, więc też u Marka
  assert.match(marek, /Instal-Tech Kowalczyk/); // lead Tomasza po SLA też u Marka
  assert.match(r.whatsapp[0].message, /☀️/);
  // lead zamknięty rano znika z raportu
  const poTelefonie = rows.map((x) => (x.lead_id === 'L-009' ? { ...x, status: 'dodzwoniono', pierwszy_kontakt: '2026-10-05 07:50' } : x));
  assert.doesNotMatch(core.morningReport(poTelefonie, handlowcy, cfgWa, '2026-10-05 08:00').emaile.map((e) => e.html).join(''), /Zielona Energia Gorzów/);
});
test('n8n/dist: raport raz dziennie (pamięć daty), poza godzinami pracy brak, RAPORT_TERAZ wymusza', () => {
  const code = readFileSync('n8n/dist/2-obsluga-co-minute.js', 'utf8');
  const uruchom = (cfgX, pamiec) => {
    const nodes = { Konfiguracja: [cfgX], 'Pobierz skrzynkę': [], 'Pobierz leady': rows, 'Pobierz handlowców': handlowcy, 'Pobierz wiadomości': [], 'Pobierz wysłane': [] };
    const $ = (n) => ({ all: () => (nodes[n] || []).map((json) => ({ json })), first: () => ({ json: (nodes[n] || [])[0] }) });
    const out = new Function('$', '$getWorkflowStaticData', '$execution', code)($, () => pamiec, { mode: 'trigger' });
    return out.length ? out[0].json : null;
  };
  const pamiec = {};
  const p1 = uruchom({ ...cfgWa, TERAZ: '2026-10-05 08:07' }, pamiec);
  assert.ok(p1.historia.some((h) => h.zdarzenie === 'raport'));
  assert.equal(pamiec.raport, '2026-10-05');
  const p2 = uruchom({ ...cfgWa, TERAZ: '2026-10-05 08:08' }, pamiec);
  assert.ok(!p2 || !p2.historia.some((h) => h.zdarzenie === 'raport')); // drugi raz tego dnia – nie
  assert.equal(uruchom({ ...cfgWa, TERAZ: '2026-10-10 09:00' }, {})?.historia.some((h) => h.zdarzenie === 'raport') || false, false); // sobota
  assert.ok(uruchom({ ...cfgWa, TERAZ: '2026-10-05 08:09', RAPORT_TERAZ: 'true' }, pamiec).historia.some((h) => h.zdarzenie === 'raport'));
});

// --- poranne zestawienia (punkt 5): osobiste i zbiorcze ---
test('Zestawienia: sekcje handlowca rozłączne, „wczoraj” z historii, Marek z eskalacjami i tabelą', () => {
  const NOW5 = '2026-09-25 08:00';
  const stan = rows.filter((r) => r.data_zgloszenia < NOW5)
    .map((r) => (r.pierwszy_kontakt && r.pierwszy_kontakt >= NOW5 ? { ...r, status: 'nowy', pierwszy_kontakt: '' } : r));
  const { historia } = importLeads(leady, handlowcy, NOW, wyjatki);
  const z = core.zestawieniaPoranne(stan, historia.filter((h) => h.czas < NOW5), handlowcy, cfgWa, NOW5);
  for (const o of z.osobiste) assert.ok(o.liczby.zalegle + o.liczby.nowe <= o.liczby.otwarte && o.liczby.doTelefonuDzis >= o.liczby.zalegle); // sekcje rozłączne
  const kasia = z.osobiste.find((o) => o.osoba.id === 'H2');
  assert.equal(kasia.liczby.obsluzone, 2); // L-010 i L-012 – rozmowy z 24.09
  assert.match(kasia.email.html, /Wczoraj obsłużone/);
  assert.match(kasia.email.html, /w terminie/);
  assert.match(kasia.email.subject, /^\[TEST → k\.lis@klimatech\.example\] ☀️ Twoje leady na piątek, 25 września/);
  assert.match(z.marek.email.html, /Eskalacje – bez kontaktu ponad 2 dni robocze/);
  assert.match(z.marek.email.html, /Instal-Tech Kowalczyk/); // L-007 z 22.09 – eskalacja 25.09
  assert.equal(z.marek.liczby.eskalacje, 4);
  assert.equal(z.marek.liczby.wTerminie, '100%');
  assert.ok(z.osobiste.every((o) => !/Termex/.test(o.email.html))); // Termex zgłosi się dopiero 1.10
  assert.ok(z.historia.some((h) => /poranne zestawienie: Marek/.test(h.szczegoly)));
});

// --- zespół: nieobecności (L4 Tomasza) i odejścia (Michał do 30.11) ---
const L4 = [{ handlowiec_id: 'H1', od: '2026-10-07', do: '2026-10-20', zastepca_id: 'H2', powod: 'L4', anulowana: '' }];
const cfgL4 = { ...cfgWa, NIEOBECNOSCI: L4 };
test('Nieobecność: nowe leady Tomasza i całe podlaskie idą do Kasi z oznaczeniem zastępstwa; po powrocie wracają', () => {
  const r = core.processInquiry({ firma: 'Radom Nowy', telefon: '700 444 001', wojewodztwo: 'mazowieckie' }, rows, handlowcy, cfgL4, '2026-10-08 10:00');
  assert.equal(r.row.handlowiec_id, 'H2');
  assert.equal(r.row.zastepstwo_za, 'H1');
  assert.match(r.whatsapp.message, /👥 Zastępstwo za Tomasz Wrona \(nieobecność do 20\.10\)/);
  assert.match(r.historia.find((h) => h.zdarzenie === 'przypisano').szczegoly, /zastępstwo za Tomasz Wrona/);
  for (let i = 0; i < 10; i++) assert.equal(core.processInquiry({ firma: 'Białystok ' + i, telefon: `700 444 1${i}0`, wojewodztwo: 'podlaskie' }, rows, handlowcy, cfgL4, '2026-10-08 10:00').row.handlowiec_id, 'H2');
  assert.equal(core.processInquiry({ firma: 'Po powrocie', telefon: '700 444 002', wojewodztwo: 'mazowieckie' }, rows, handlowcy, cfgL4, '2026-10-21 09:00').row.handlowiec_id, 'H1');
  assert.equal(core.processInquiry({ firma: 'Przed L4', telefon: '700 444 003', wojewodztwo: 'łódzkie' }, rows, handlowcy, cfgL4, '2026-10-06 15:00').row.handlowiec_id, 'H1');
  // anulowana nieobecność nie działa
  assert.equal(core.processInquiry({ firma: 'Anulowane', telefon: '700 444 004', wojewodztwo: 'mazowieckie' }, rows, handlowcy, { ...cfgWa, NIEOBECNOSCI: [{ ...L4[0], anulowana: 'true' }] }, '2026-10-08 10:00').row.handlowiec_id, 'H1');
});
test('Nieobecność: otwarte leady Tomasza – przypomnienia i zestawienie u Kasi („za”), Kasia może je potwierdzać na WhatsAppie', () => {
  const l007 = rows.find((r) => r.lead_id === 'L-007');
  const odbiorca = core.recipientFor(l007, handlowcy, cfgL4, '2026-10-08 10:00');
  assert.equal(odbiorca.id, 'H2');
  assert.equal(odbiorca.zaKogo, 'Tomasz Wrona');
  const z = core.zestawieniaPoranne(rows, [], handlowcy, cfgL4, '2026-10-08 08:00');
  const kasia = z.osobiste.find((o) => o.osoba.id === 'H2');
  assert.match(kasia.email.html, /za: Tomasz Wrona/);
  assert.ok(!z.osobiste.some((o) => o.osoba.id === 'H1')); // nieobecny nie dostaje zestawienia
  assert.match(z.marek.email.html, /Nieobecności i zastępstwa dziś[\s\S]*Tomasz Wrona[\s\S]*L4 do 20\.10[\s\S]*zastępuje: <b>Katarzyna Lis/);
  const hz = handlowcy.map((h) => ({ ...h, whatsapp: h.handlowiec_id === 'H2' ? '501000002' : h.whatsapp }));
  const prod = { ...cfgL4, TRYB_TESTOWY: 'false' };
  const odp = (now) => core.processWaReplies([msg('1 rozmawiałam za Tomka', '🆔 L-007', '48501000002@c.us')], rows, hz, prod, now)[0];
  assert.equal(odp('2026-10-08 10:00').update.status, 'dodzwoniono');
  assert.match(odp('2026-10-06 10:00').reply.message, /nie jest Twoim leadem/); // przed L4 – nie
});
test('Odejście: po dacie „aktywny do” handlowiec nie dostaje leadów, region wspólny przechodzi na drugą osobę', () => {
  const hz = handlowcy.map((h) => (h.handlowiec_id === 'H6' ? { ...h, aktywny_do: '2026-11-30' } : h));
  const lub = (now, i) => core.processInquiry({ firma: 'Lubuskie ' + i, telefon: `700 555 0${i}0`, wojewodztwo: 'lubuskie' }, rows, hz, cfgWa, now).row.handlowiec_id;
  assert.ok([...Array(8)].every((_, i) => lub('2026-12-01 09:00', i) === 'H4')); // tylko Bartosz
  const dol = core.processInquiry({ firma: 'Wrocław', telefon: '700 555 100', wojewodztwo: 'dolnośląskie' }, rows, hz, cfgWa, '2026-12-01 09:00');
  assert.equal(dol.row.routing, 'bez_opiekuna'); // dopóki nikt nie dostanie dolnośląskiego – do Marka
  assert.equal(core.processInquiry({ firma: 'Wrocław 2', telefon: '700 555 101', wojewodztwo: 'dolnośląskie' }, rows, hz, cfgWa, '2026-11-30 09:00').row.handlowiec_id, 'H6');
});

// --- WhatsApp Business API (Meta) – gotowe do włączenia, testy na przykładowych wiadomościach w formacie Meta ---
const cfgMeta = { ...cfgWa, WHATSAPP: 'meta' };
const zMety = (messages) => ({ object: 'whatsapp_business_account', entry: [{ id: 'WABA_ID', changes: [{ field: 'messages', value: {
  messaging_product: 'whatsapp', metadata: { display_phone_number: '48600999999', phone_number_id: 'PHONE_ID' },
  contacts: [{ profile: { name: 'Ewa' }, wa_id: '48600111222' }], messages } }] }] });
test('Meta: nowy lead jako szablon klimatech_nowy_lead – 7 pól bez nowych linii, 4 przyciski statusu', () => {
  const r = core.processInquiry({ firma: 'Nowa', osoba: 'Jan', telefon: '700 300 400', wojewodztwo: 'pomorskie', szac_wartosc_pln: 20000, wiadomosc: 'Linia 1\nLinia 2' }, rows, handlowcy, cfgMeta, '2026-10-05 09:00');
  const b = r.whatsapp.meta_body;
  assert.equal(b.type, 'template');
  assert.equal(b.template.name, 'klimatech_nowy_lead');
  assert.equal(b.to, '48600111222'); // tryb testowy: numer testowy, bez @c.us
  const pola = b.template.components[0].parameters.map((p) => p.text);
  assert.equal(pola.length, 7);
  assert.ok(pola.every((t) => !/[\n\t]/.test(t) && !t.includes('*'))); // wymóg Meta
  assert.equal(pola[6], 'L-041');
  assert.deepEqual(b.template.components.slice(1).map((c) => c.parameters[0].payload), ['L-041|dodzwoniono', 'L-041|nie_odebral', 'L-041|umowione', 'L-041|niezainteresowany']);
  assert.equal(core.processInquiry({ firma: 'X', telefon: '700 300 401' }, rows, handlowcy, cfgWa, '2026-10-05 09:00').whatsapp.meta_body, undefined); // Green API – bez zmian
});
test('Meta: kliknięcie przycisku i odpowiedź tekstem -> status w arkuszu i potwierdzenie zwykłym tekstem (okno 24 h)', () => {
  const klik = core.metaDoWiadomosci(zMety([{ from: '48600111222', id: 'wamid.A1', timestamp: '1791300000', type: 'button',
    button: { payload: 'L-005|dodzwoniono', text: '✅ Dodzwoniłem się' }, context: { from: '48600999999', id: 'wamid.LEAD' } }]));
  assert.deepEqual(klik, [{ type: 'incoming', idMessage: 'wamid.A1', timestamp: 1791300000, chatId: '48600111222@c.us', textMessage: 'L-005 1' }]);
  const out = core.processWaReplies(klik, rows, handlowcy, cfgMeta, '2026-10-05 10:00')[0];
  assert.equal(out.update.status, 'dodzwoniono');
  assert.equal(out.reply.meta_body.type, 'text');
  assert.match(out.reply.meta_body.text.body, /✅ Zapisano: L-005 Hydro-Max/);
  const tekst = core.metaDoWiadomosci(zMety([{ from: '48600111222', id: 'wamid.A2', timestamp: '1791300100', type: 'text', text: { body: 'L-005 3 spotkanie we wtorek' } }]));
  assert.equal(core.processWaReplies(tekst, rows, handlowcy, cfgMeta, '2026-10-05 10:00')[0].update.notatka, 'spotkanie we wtorek');
  // szablony z przyciskami jako „interactive” (button_reply) też działają; statusy doręczeń są pomijane
  assert.equal(core.metaDoWiadomosci(zMety([{ from: '48600111222', id: 'wamid.A3', type: 'interactive', interactive: { type: 'button_reply', button_reply: { id: 'L-005|umowione', title: '📅 Umówione' } } }]))[0].textMessage, 'L-005 3');
  assert.deepEqual(core.metaDoWiadomosci({ entry: [{ changes: [{ value: { statuses: [{ id: 'wamid.X', status: 'delivered' }] } }] }] }), []);
});
test('Meta: przypomnienie i zestawienia mają szablony z polami bez nowych linii', () => {
  const sla = core.processCycle({ rows: [{ lead_id: 'L-901', data_zgloszenia: '2026-10-05 09:00', status: 'nowy', routing: 'handlowiec', handlowiec_id: 'H5', handlowiec: 'Ewa Sowa', sla_poziom: 0, firma: 'Firma' }], handlowcy, cfg: cfgMeta, now: '2026-10-05 13:00', sla: true });
  assert.equal(sla.whatsapp[0].meta_body.template.name, 'klimatech_przypomnienie');
  const z = core.zestawieniaPoranne(rows, [], handlowcy, cfgMeta, '2026-10-05 08:00');
  assert.equal(z.marek.whatsapp.meta_body.template.name, 'klimatech_zestawienie_zespolu');
  assert.ok(z.osobiste.every((o) => o.whatsapp.meta_body.template.name === 'klimatech_zestawienie'));
  assert.ok([z.marek, ...z.osobiste].every((x) => x.whatsapp.meta_body.template.components[0].parameters.every((p) => !/\n/.test(p.text))));
});

// --- formularz na stronie: Contact Form 7 -> webhook (z kluczem dostępu) ---
const zCF7 = { 'your-name': 'Jan Kowal', 'your-email': 'jan@instalkowal.example', 'your-tel': '700 919 919', 'your-company': 'Instal-Kowal',
  'your-city': 'Gdańsk', 'your-region': 'pomorskie', zainteresowanie: ['pompy ciepła', 'rekuperacja'], wartosc: '40 000 zł',
  'kim-jestes': ['instalator / firma instalacyjna'], 'your-message': '10 pomp na wiosnę', 'acceptance-rodo': '1', _wpcf7: '123', _wpcf7_unit_tag: 'wpcf7-f1' };
test('CF7: domyślne nazwy pól tłumaczone na nasze, listy łączone, pola techniczne pomijane', () => {
  const p = core.zFormularzaStrony(zCF7);
  assert.deepEqual(p, { osoba: 'Jan Kowal', email: 'jan@instalkowal.example', telefon: '700 919 919', firma: 'Instal-Kowal', miasto: 'Gdańsk', wojewodztwo: 'pomorskie',
    zainteresowanie: 'pompy ciepła, rekuperacja', szac_wartosc_pln: 40000, wiadomosc: '[instalator / firma instalacyjna] 10 pomp na wiosnę', zgoda: true, zrodlo: 'formularz' });
  assert.equal(core.zFormularzaStrony({ firma: 'Nasze pola', telefon: '700 1' }).firma, 'Nasze pola'); // nasze nazwy też działają
  assert.equal(core.zFormularzaStrony({ 'your-region': '— wybierz —' }).wojewodztwo, undefined);
});
test('n8n/dist: webhook z CF7 – bez klucza odrzucony, z kluczem lead u handlowca z regionu', () => {
  const code = readFileSync('n8n/dist/1-przyjecie-leada.js', 'utf8');
  const uruchom = (klucz) => {
    const nodes = { Konfiguracja: [{ ...cfgWa, WEBHOOK_KLUCZ: 'tajny123' }], 'Zgłoszenie': [{ ...zCF7, _wejscie: 'webhook', _klucz: klucz }], 'Pobierz leady': rows, 'Pobierz handlowców': handlowcy };
    const $ = (n) => ({ all: () => (nodes[n] || []).map((json) => ({ json })), first: () => ({ json: (nodes[n] || [])[0] }) });
    return new Function('$', code)($)[0].json;
  };
  const zly = uruchom('zly');
  assert.equal(zly.valid, false);
  assert.match(zly.response.errors[0], /Brak dostępu/);
  assert.equal(uruchom('').valid, false);
  const ok = uruchom('tajny123');
  assert.equal(ok.valid, true);
  assert.equal(ok.row.handlowiec_id, 'H5'); // pomorskie -> Ewa Sowa
  assert.equal(ok.row.firma, 'Instal-Kowal');
  assert.match(ok.historia[0].szczegoly, /zgoda na kontakt \(RODO\): tak/);
  assert.equal(ok.row.szac_wartosc_pln, 40000);
});
