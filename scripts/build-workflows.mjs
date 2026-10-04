// Generuje gotowe do importu workflow n8n (A, B, C, D, E) z kodem z n8n/dist/.
// Użycie: node scripts/build-workflows.mjs
//  - zawsze:                       n8n/workflows/*.json        (szablon do repo, wartości przykładowe)
//  - jeśli jest n8n/config.local.json: n8n/workflows.local/*.json (Twoje ID arkusza, credentials, adresy) – w .gitignore
// Import: n8n UI → Workflows → Import from File, albo CLI: n8n import:workflow --input=plik.json
import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'node:fs';

const dist = (f) => readFileSync(`n8n/dist/${f}`, 'utf8');

const PRZYKLAD = {
  SHEET_ID: 'WKLEJ_ID_ARKUSZA',
  SHEETS_CRED: { id: '', name: 'Google Sheets account' },
  GMAIL_CRED: { id: '', name: 'Gmail account' },
  MAREK_EMAIL: 'marek@klimatech.example',
  ANIA_EMAIL: 'biuro@klimatech.example',
  TEST_INBOX: 'twoj.mail+klimatech@gmail.com',
  TRYB_TESTOWY: 'true',
  N8N_URL: 'http://localhost:5678',
  KANAL: 'oba', // mail | whatsapp | oba
  TEST_WHATSAPP: '48600000000',
  GREEN_API_URL: 'https://7107.api.greenapi.com',
  GREEN_ID: 'WKLEJ_ID_INSTANCJI',
  GREEN_TOKEN: 'WKLEJ_TOKEN',
  GREEN_PHONE: '',
  MAREK_WHATSAPP: '',
  ANIA_WHATSAPP: '',
  SUPABASE_URL: 'https://TWOJ-PROJEKT.supabase.co',
  SUPABASE_CRED: { id: '', name: 'Supabase – klucz secret' }, // credential typu Custom Auth (nagłówki apikey/Authorization)
};

// Kod małych węzłów (bez rdzenia)
const ZGLOSZENIE = `// Ujednolica wejście: formularz n8n (etykiety pól) albo webhook (JSON w body – np. wtyczka WordPress)
const j = $input.first().json;
if (j.body && typeof j.body === 'object') return [{ json: j.body }];
if (typeof j.body === 'string') { try { return [{ json: JSON.parse(j.body) }]; } catch (e) { return [{ json: {} }]; } }
const POLA = {
  'Firma': 'firma', 'Osoba kontaktowa': 'osoba', 'E-mail': 'email', 'Telefon': 'telefon', 'Miasto': 'miasto',
  'Województwo': 'wojewodztwo', 'Zainteresowanie': 'zainteresowanie', 'Szacowana wartość (zł)': 'szac_wartosc_pln',
  'Wiadomość': 'wiadomosc', 'Źródło zgłoszenia': 'zrodlo',
};
const out = {};
for (const [etykieta, pole] of Object.entries(POLA)) if (j[etykieta] !== undefined && j[etykieta] !== '') out[pole] = j[etykieta];
if (out.wojewodztwo === '(nie wiem)') delete out.wojewodztwo;
return [{ json: out }];`;

const WOJ = ['(nie wiem)', 'dolnośląskie', 'kujawsko-pomorskie', 'lubelskie', 'lubuskie', 'łódzkie', 'małopolskie', 'mazowieckie', 'opolskie',
  'podkarpackie', 'podlaskie', 'pomorskie', 'śląskie', 'świętokrzyskie', 'warmińsko-mazurskie', 'wielkopolskie', 'zachodniopomorskie'];

function build(c) {
  let n = 0;
  const uid = (p) => `${p}-0000-4000-8000-${String(++n).padStart(12, '0')}`;
  const sheetsCred = c.SHEETS_CRED.id ? { googleSheetsOAuth2Api: c.SHEETS_CRED } : undefined;
  const gmailCred = c.GMAIL_CRED.id ? { gmailOAuth2: c.GMAIL_CRED } : undefined;
  const supaCred = c.SUPABASE_CRED.id ? { httpCustomAuth: c.SUPABASE_CRED } : undefined;

  const node = (name, type, typeVersion, position, parameters, extra = {}) =>
    ({ id: uid('a1b2c3d4'), name, type, typeVersion, position, parameters, ...extra });
  const code = (name, pos, jsCode, extra) => node(name, 'n8n-nodes-base.code', 2, pos, { jsCode }, extra);
  const sheet = (tab) => ({ __rl: true, value: tab, mode: 'name' });
  const doc = { __rl: true, value: c.SHEET_ID, mode: 'id' };
  const getRows = (name, pos, tab) => node(name, 'n8n-nodes-base.googleSheets', 4.7, pos,
    { authentication: 'oAuth2', resource: 'sheet', operation: 'read', documentId: doc, sheetName: sheet(tab), options: {} },
    { executeOnce: true, alwaysOutputData: true, credentials: sheetsCred });
  const append = (name, pos, tab) => node(name, 'n8n-nodes-base.googleSheets', 4.7, pos,
    {
      authentication: 'oAuth2', resource: 'sheet', operation: 'append', documentId: doc, sheetName: sheet(tab),
      columns: { mappingMode: 'autoMapInputData', value: {}, matchingColumns: [], schema: [], attemptToConvertTypes: false, convertFieldsToString: false },
      options: { cellFormat: 'RAW' },
    }, { credentials: sheetsCred });
  const update = (name, pos) => node(name, 'n8n-nodes-base.googleSheets', 4.7, pos,
    {
      authentication: 'oAuth2', resource: 'sheet', operation: 'update', documentId: doc, sheetName: sheet('Leady'),
      columns: { mappingMode: 'autoMapInputData', value: {}, matchingColumns: ['lead_id'], schema: [], attemptToConvertTypes: false, convertFieldsToString: false },
      options: { cellFormat: 'RAW' },
    }, { credentials: sheetsCred });
  const gmail = (name, pos, to, subject, message, extra = {}) => node(name, 'n8n-nodes-base.gmail', 2.1, pos,
    { resource: 'message', operation: 'send', sendTo: to, subject, emailType: 'html', message, options: { appendAttribution: false } },
    { credentials: gmailCred, ...extra });
  const ifTrue = (name, pos, expr) => node(name, 'n8n-nodes-base.if', 2.2, pos, {
    conditions: {
      options: { caseSensitive: true, leftValue: '', typeValidation: 'loose', version: 2 },
      conditions: [{ id: uid('c0ffee00'), leftValue: expr, rightValue: '', operator: { type: 'boolean', operation: 'true', singleValue: true } }],
      combinator: 'and',
    },
    options: {},
  });
  const konfiguracja = (pos, extraFields = []) => node('Konfiguracja', 'n8n-nodes-base.set', 3.4, pos, {
    mode: 'manual',
    includeOtherFields: false,
    assignments: {
      assignments: [
        ['MAREK_EMAIL', c.MAREK_EMAIL], ['ANIA_EMAIL', c.ANIA_EMAIL], ['TEST_INBOX', c.TEST_INBOX],
        ['TRYB_TESTOWY', c.TRYB_TESTOWY], ['STATUS_URL', `${c.N8N_URL}/webhook/status`],
        ['KANAL', c.KANAL], ['TEST_WHATSAPP', c.TEST_WHATSAPP], ['MAREK_WHATSAPP', c.MAREK_WHATSAPP], ['ANIA_WHATSAPP', c.ANIA_WHATSAPP],
        ['GREEN_API_URL', c.GREEN_API_URL], ['GREEN_ID', c.GREEN_ID], ['GREEN_TOKEN', c.GREEN_TOKEN], ['GREEN_PHONE', c.GREEN_PHONE], ['SUPABASE_URL', c.SUPABASE_URL], ...extraFields,
      ].map(([name, value]) => ({ id: uid('5e7f1e1d'), name, value, type: 'string' })),
    },
    options: {},
  });
  const K = (f) => `$('Konfiguracja').first().json.${f}`;
  const greenUrl = (metoda, query = '') => `={{ ${K('GREEN_API_URL')} }}/waInstance{{ ${K('GREEN_ID')} }}/${metoda}/{{ ${K('GREEN_TOKEN')} }}${query}`;
  const waSend = (name, pos, chatIdExpr, messageExpr, extra = {}) => node(name, 'n8n-nodes-base.httpRequest', 4.2, pos, {
    method: 'POST', url: greenUrl('sendMessage'), sendBody: true, specifyBody: 'json',
    jsonBody: `={{ JSON.stringify({ chatId: ${chatIdExpr}, message: ${messageExpr} }) }}`, options: {},
  }, { onError: 'continueRegularOutput', ...extra });
  const ifExpr = (name, pos, expr) => { const n = ifTrue(name, pos, expr); n.executeOnce = true; return n; };
  const to = (name) => ({ node: name, type: 'main', index: 0 });
  const chain = (...names) => Object.fromEntries(names.slice(0, -1).map((a, i) => [a, { main: [[{ node: names[i + 1], type: 'main', index: 0 }]] }]));
  const wf = (id, name, nodes, connections) => ({
    id, name, active: false, nodes, connections, settings: { executionOrder: 'v1', timezone: 'Europe/Warsaw' }, pinData: {},
  });
  const X = (i) => 220 * i;

  // ---------- A. Przyjęcie leada ----------
  const A = wf('KlimatechWfA0001', 'Klimatech A – Przyjęcie leada', [
    node('Formularz', 'n8n-nodes-base.formTrigger', 2.2, [0, -100], {
      formTitle: 'Klimatech – zapytanie handlowe',
      formDescription: 'Makieta formularza ze strony (WordPress). Ania używa go też do wpisywania zapytań z telefonu i maila – wtedy zmienia „Źródło zgłoszenia”.',
      formFields: {
        values: [
          { fieldLabel: 'Firma' },
          { fieldLabel: 'Osoba kontaktowa' },
          { fieldLabel: 'Telefon', placeholder: 'np. 601 222 333' },
          { fieldLabel: 'E-mail', fieldType: 'email' },
          { fieldLabel: 'Miasto' },
          { fieldLabel: 'Województwo', fieldType: 'dropdown', fieldOptions: { values: WOJ.map((option) => ({ option })) } },
          { fieldLabel: 'Zainteresowanie', fieldType: 'dropdown', fieldOptions: { values: ['pompy ciepła', 'klimatyzacja', 'rekuperacja', 'inne'].map((option) => ({ option })) } },
          { fieldLabel: 'Szacowana wartość (zł)', fieldType: 'number' },
          { fieldLabel: 'Wiadomość', fieldType: 'textarea' },
          { fieldLabel: 'Źródło zgłoszenia', fieldType: 'dropdown', fieldOptions: { values: ['formularz', 'mail', 'telefon'].map((option) => ({ option })) } },
        ],
      },
      options: { appendAttribution: false, buttonLabel: 'Wyślij zapytanie', path: 'klimatech', respondWithOptions: { values: { respondWith: 'text', formSubmittedText: 'Dziękujemy! Handlowiec z Twojego regionu oddzwoni najpóźniej w ciągu jednego dnia roboczego.' } } },
    }, { webhookId: uid('f0f0f0f0') }),
    node('Webhook', 'n8n-nodes-base.webhook', 2, [0, 100], {
      httpMethod: 'POST', path: 'lead', responseMode: 'lastNode', responseData: 'firstEntryJson', options: { allowedOrigins: '*' },
    }, { webhookId: uid('e0e0e0e0') }),
    code('Zgłoszenie', [X(1), 0], ZGLOSZENIE),
    konfiguracja([X(2), 0]),
    getRows('Pobierz handlowców', [X(3), 0], 'Handlowcy'),
    getRows('Pobierz leady', [X(4), 0], 'Leady'),
    code('Przetwórz lead', [X(5), 0], dist('A-przetworz-lead.js')),
    ifTrue('Czy poprawny?', [X(6), 0], '={{ $json.valid }}'),
    code('Wiersz do zapisu', [X(7), -100], "return [{ json: $('Przetwórz lead').first().json.row }];"),
    append('Zapisz lead', [X(8), -100], 'Leady'),
    code('Historia', [X(9), -100], "return $('Przetwórz lead').first().json.historia.map((h) => ({ json: h }));"),
    append('Zapisz historię', [X(10), -100], 'Historia'),
    ifExpr('Mail?', [X(11), -100], `={{ ${K('KANAL')} !== 'whatsapp' }}`),
    gmail('Wyślij mail', [X(12), -200], "={{ $('Przetwórz lead').first().json.email.to }}",
      "={{ $('Przetwórz lead').first().json.email.subject }}", "={{ $('Przetwórz lead').first().json.email.html }}", { executeOnce: true, onError: 'continueRegularOutput' }),
    ifExpr('WhatsApp?', [X(13), -100], "={{ !!$('Przetwórz lead').first().json.whatsapp }}"),
    waSend('Wyślij WhatsApp', [X(14), -200], "$('Przetwórz lead').first().json.whatsapp.chatId", "$('Przetwórz lead').first().json.whatsapp.message", { executeOnce: true }),
    code('Odpowiedź', [X(15), -100], "// Odpowiedź dla webhooka (JSON z lead_id, routingiem, duplikatem)\nreturn [{ json: $('Przetwórz lead').first().json.response }];"),
    code('Błąd walidacji', [X(7), 100], "// Nic nie zapisujemy – zwracamy listę błędów\nreturn [{ json: $('Przetwórz lead').first().json.response }];"),
  ], {
    Formularz: { main: [[{ node: 'Zgłoszenie', type: 'main', index: 0 }]] },
    Webhook: { main: [[{ node: 'Zgłoszenie', type: 'main', index: 0 }]] },
    ...chain('Zgłoszenie', 'Konfiguracja', 'Pobierz handlowców', 'Pobierz leady', 'Przetwórz lead', 'Czy poprawny?'),
    'Czy poprawny?': { main: [[{ node: 'Wiersz do zapisu', type: 'main', index: 0 }], [{ node: 'Błąd walidacji', type: 'main', index: 0 }]] },
    ...chain('Wiersz do zapisu', 'Zapisz lead', 'Historia', 'Zapisz historię', 'Mail?'),
    'Mail?': { main: [[to('Wyślij mail')], [to('WhatsApp?')]] },
    'Wyślij mail': { main: [[to('WhatsApp?')]] },
    'WhatsApp?': { main: [[to('Wyślij WhatsApp')], [to('Odpowiedź')]] },
    'Wyślij WhatsApp': { main: [[to('Odpowiedź')]] },
  });

  // ---------- B. Status z maila ----------
  const page = (body, codeNum) => ({
    respondWith: 'text', responseBody: body,
    options: { responseCode: codeNum, responseHeaders: { entries: [{ name: 'Content-Type', value: 'text/html; charset=utf-8' }] } },
  });
  const B = wf('KlimatechWfB0001', 'Klimatech B – Status z maila', [
    node('Webhook', 'n8n-nodes-base.webhook', 2, [0, 0], { httpMethod: 'GET', path: 'status', responseMode: 'responseNode', options: {} }, { webhookId: uid('e1e1e1e1') }),
    getRows('Pobierz lead', [X(1), 0], 'Leady'),
    code('Ustaw status', [X(2), 0], dist('B-ustaw-status.js')),
    ifTrue('Czy poprawny?', [X(3), 0], '={{ $json.ok }}'),
    code('Wiersz do aktualizacji', [X(4), -100], "return [{ json: $('Ustaw status').first().json.update }];"),
    update('Aktualizuj lead', [X(5), -100]),
    code('Historia', [X(6), -100], "return $('Ustaw status').first().json.historia.map((h) => ({ json: h }));"),
    append('Zapisz historię', [X(7), -100], 'Historia'),
    node('Pokaż potwierdzenie', 'n8n-nodes-base.respondToWebhook', 1.1, [X(8), -100], page("={{ $('Ustaw status').first().json.html }}", 200)),
    node('Pokaż błąd', 'n8n-nodes-base.respondToWebhook', 1.1, [X(4), 100], page('={{ $json.html }}', 400)),
  ], {
    ...chain('Webhook', 'Pobierz lead', 'Ustaw status', 'Czy poprawny?'),
    'Czy poprawny?': { main: [[{ node: 'Wiersz do aktualizacji', type: 'main', index: 0 }], [{ node: 'Pokaż błąd', type: 'main', index: 0 }]] },
    ...chain('Wiersz do aktualizacji', 'Aktualizuj lead', 'Historia', 'Zapisz historię', 'Pokaż potwierdzenie'),
  });

  // ---------- C. Kontrola SLA ----------
  const C = wf('KlimatechWfC0001', 'Klimatech C – Kontrola SLA (co 15 min)', [
    node('Co 15 minut', 'n8n-nodes-base.scheduleTrigger', 1.2, [0, -100], { rule: { interval: [{ field: 'minutes', minutesInterval: 15 }] } }),
    node('Test ręczny', 'n8n-nodes-base.manualTrigger', 1, [0, 100], {}),
    konfiguracja([X(1), 0], [['TERAZ', '']]),
    getRows('Pobierz handlowców', [X(2), 0], 'Handlowcy'),
    getRows('Pobierz leady', [X(3), 0], 'Leady'),
    code('Sprawdź SLA', [X(4), 0], dist('C-sprawdz-sla.js')),
    code('Wiersze SLA', [X(5), 0], '// Do arkusza tylko 3 kolumny\nreturn $input.all().map((i) => ({ json: { lead_id: i.json.lead_id, sla_poziom: i.json.sla_poziom, aktualizacja: i.json.aktualizacja } }));'),
    update('Zapisz poziom SLA', [X(6), 0]),
    code('Historia SLA', [X(7), 0], dist('C-historia-sla.js')),
    append('Zapisz historię', [X(8), 0], 'Historia'),
    code('Grupuj maile', [X(9), 0], dist('C-grupuj-maile.js')),
    gmail('Wyślij mail', [X(10), 0], '={{ $json.to }}', '={{ $json.subject }}', '={{ $json.html }}', { onError: 'continueRegularOutput' }),
    code('Grupuj WhatsApp', [X(9), 200], dist('C-grupuj-whatsapp.js')),
    waSend('Wyślij WhatsApp', [X(10), 200], '$json.chatId', '$json.message'),
  ], {
    'Co 15 minut': { main: [[{ node: 'Konfiguracja', type: 'main', index: 0 }]] },
    'Test ręczny': { main: [[{ node: 'Konfiguracja', type: 'main', index: 0 }]] },
    ...chain('Konfiguracja', 'Pobierz handlowców', 'Pobierz leady', 'Sprawdź SLA', 'Wiersze SLA', 'Zapisz poziom SLA', 'Historia SLA', 'Zapisz historię'),
    'Zapisz historię': { main: [[to('Grupuj maile'), to('Grupuj WhatsApp')]] },
    'Grupuj maile': { main: [[to('Wyślij mail')]] },
    'Grupuj WhatsApp': { main: [[to('Wyślij WhatsApp')]] },
  });

  // ---------- D. Odpowiedzi z WhatsAppa ----------
  const D = wf('KlimatechWfD0001', 'Klimatech D – Odpowiedzi z WhatsAppa (co 1 min)', [
    node('Co minutę', 'n8n-nodes-base.scheduleTrigger', 1.2, [0, -100], { rule: { interval: [{ field: 'minutes', minutesInterval: 1 }] } }),
    node('Test ręczny', 'n8n-nodes-base.manualTrigger', 1, [0, 100], {}),
    konfiguracja([X(1), 0]),
    node('Pobierz wiadomości', 'n8n-nodes-base.httpRequest', 4.2, [X(2), 0], { method: 'GET', url: greenUrl('lastIncomingMessages', '?minutes=10'), options: {} },
      { executeOnce: true, alwaysOutputData: true }),
    node('Pobierz wysłane', 'n8n-nodes-base.httpRequest', 4.2, [X(3), 0], { method: 'GET', url: greenUrl('lastOutgoingMessages', '?minutes=10'), options: {} },
      { executeOnce: true, alwaysOutputData: true }),
    getRows('Pobierz leady', [X(4), 0], 'Leady'),
    getRows('Pobierz handlowców', [X(5), 0], 'Handlowcy'),
    code('Przetwórz odpowiedzi', [X(6), 0], dist('D-odpowiedzi-wa.js')),
    code('Aktualizacje', [X(7), -200], 'return $input.all().filter((i) => i.json.update).map((i) => ({ json: i.json.update }));'),
    update('Aktualizuj lead', [X(8), -200]),
    code('Wpisy historii', [X(7), 0], 'return $input.all().flatMap((i) => (i.json.historia || []).map((h) => ({ json: h })));'),
    append('Zapisz historię', [X(8), 0], 'Historia'),
    code('Potwierdzenia', [X(7), 200], 'return $input.all().filter((i) => i.json.reply).map((i) => ({ json: i.json.reply }));'),
    waSend('Odpisz na WhatsApp', [X(8), 200], '$json.chatId', '$json.message'),
  ], {
    'Co minutę': { main: [[to('Konfiguracja')]] },
    'Test ręczny': { main: [[to('Konfiguracja')]] },
    ...chain('Konfiguracja', 'Pobierz wiadomości', 'Pobierz wysłane', 'Pobierz leady', 'Pobierz handlowców', 'Przetwórz odpowiedzi'),
    'Przetwórz odpowiedzi': { main: [[to('Aktualizacje'), to('Wpisy historii'), to('Potwierdzenia')]] },
    'Aktualizacje': { main: [[to('Aktualizuj lead')]] },
    'Wpisy historii': { main: [[to('Zapisz historię')]] },
    'Potwierdzenia': { main: [[to('Odpisz na WhatsApp')]] },
  });

  // ---------- E. Synchronizacja arkusz -> Supabase (mini CRM) ----------
  const E = wf('KlimatechWfE0001', 'Klimatech E – Synchronizacja z CRM (co 1 min)', [
    node('Co minutę', 'n8n-nodes-base.scheduleTrigger', 1.2, [0, -100], { rule: { interval: [{ field: 'minutes', minutesInterval: 1 }] } }),
    node('Test ręczny', 'n8n-nodes-base.manualTrigger', 1, [0, 100], {}),
    konfiguracja([X(1), 0]),
    getRows('Pobierz handlowców', [X(2), 0], 'Handlowcy'),
    getRows('Pobierz leady', [X(3), 0], 'Leady'),
    getRows('Pobierz historię', [X(4), 0], 'Historia'),
    code('Przygotuj dane', [X(5), 0], dist('E-synchronizacja.js')),
    node('Zapisz w Supabase', 'n8n-nodes-base.httpRequest', 4.2, [X(6), 0], {
      method: 'POST',
      url: `={{ ${K('SUPABASE_URL')} }}/rest/v1/{{ $json.tabela }}?on_conflict={{ $json.on_conflict }}`,
      authentication: 'genericCredentialType', genericAuthType: 'httpCustomAuth',
      sendHeaders: true,
      headerParameters: { parameters: [{ name: 'Prefer', value: '={{ $json.prefer }}' }] },
      sendBody: true, specifyBody: 'json', jsonBody: '={{ JSON.stringify($json.rows) }}',
      options: {},
    }, { credentials: supaCred }),
    code('Do usunięcia', [X(7), 0], `// CRM = lustro arkusza: usuwa wiersze, których w arkuszu już nie ma (np. po wyczyszczeniu testów).
// Zabezpieczenie: pusty odczyt arkusza nie kasuje niczego.
const p = Object.fromEntries($('Przygotuj dane').all().map((i) => [i.json.tabela, i.json.rows]));
const out = [];
if (p.leady && p.leady.length) out.push({ json: { tabela: 'leady', filtr: 'lead_id=not.in.(' + p.leady.map((r) => r.lead_id).join(',') + ')' } });
if (p.historia && p.historia.length) out.push({ json: { tabela: 'historia', filtr: 'id=not.in.(' + p.historia.map((r) => r.id).join(',') + ')' } });
return out;`, { executeOnce: true }),
    node('Usuń nieaktualne', 'n8n-nodes-base.httpRequest', 4.2, [X(8), 0], {
      method: 'DELETE',
      url: `={{ ${K('SUPABASE_URL')} }}/rest/v1/{{ $json.tabela }}?{{ $json.filtr }}`,
      authentication: 'genericCredentialType', genericAuthType: 'httpCustomAuth',
      options: {},
    }, { credentials: supaCred }),
  ], {
    'Co minutę': { main: [[to('Konfiguracja')]] },
    'Test ręczny': { main: [[to('Konfiguracja')]] },
    ...chain('Konfiguracja', 'Pobierz handlowców', 'Pobierz leady', 'Pobierz historię', 'Przygotuj dane', 'Zapisz w Supabase', 'Do usunięcia', 'Usuń nieaktualne'),
  });

  return { 'A-przyjecie-leada': A, 'B-status-z-maila': B, 'C-kontrola-sla': C, 'D-odpowiedzi-whatsapp': D, 'E-synchronizacja-crm': E };
}

function write(dir, cfg) {
  mkdirSync(dir, { recursive: true });
  for (const [f, w] of Object.entries(build(cfg))) {
    writeFileSync(`${dir}/${f}.json`, JSON.stringify(w, null, 2) + '\n');
    console.log('zbudowano', `${dir}/${f}.json`);
  }
}

write('n8n/workflows', PRZYKLAD);
if (existsSync('n8n/config.local.json')) {
  const local = JSON.parse(readFileSync('n8n/config.local.json', 'utf8'));
  write('n8n/workflows.local', { ...PRZYKLAD, ...local });
}
