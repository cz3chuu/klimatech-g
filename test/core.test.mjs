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
    Webhook: [{ body: { firma: 'Test', telefon: '700 300 400', miasto: 'Gdańsk' } }],
    'Pobierz leady': rows,
    'Pobierz handlowców': handlowcy,
  };
  const $ = (n) => ({ all: () => nodes[n].map((json) => ({ json })), first: () => ({ json: nodes[n][0] }) });
  const out = new Function('$', code)($);
  assert.equal(out[0].json.valid, true);
  assert.equal(out[0].json.row.handlowiec_id, 'H5');
});
