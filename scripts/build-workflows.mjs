// Generuje gotowe do importu workflow n8n z kodem z n8n/dist/. Cztery workflow, każdy z jednym zadaniem:
//   1. Przyjęcie leada      – webhook strony WWW i formularz klienta -> rdzeń -> arkusz -> WhatsApp/mail
//      (wpisy biura: zakładka „Wpisz lead”, obsługiwana w 2.; n8n nie pozwala na dwa formularze n8n w jednej ścieżce)
//   2. Obsługa co minutę    – skrzynka „Wpisz lead”, odpowiedzi z WhatsAppa, SLA i eskalacje (co 15 min)
//   3. Status z linku       – klik w przycisk w mailu (Marek, Ania)
//   4. Synchronizacja z CRM – arkusz -> Supabase (osobno: awaria CRM nie zatrzymuje leadów)
// Użycie: node scripts/build-workflows.mjs
//  - zawsze:                           n8n/workflows/*.json        (szablon do repo, wartości przykładowe)
//  - jeśli jest n8n/config.local.json: n8n/workflows.local/*.json (Twoje ID arkusza, credentials, adresy) – w .gitignore
// Import: n8n UI → Workflows → Import from File, albo CLI: n8n import:workflow --input=plik.json
import { readFileSync, writeFileSync, mkdirSync, existsSync, rmSync } from 'node:fs';

const dist = (f) => readFileSync(`n8n/dist/${f}`, 'utf8');

const PRZYKLAD = {
  SHEET_ID: 'WKLEJ_ID_ARKUSZA',
  SHEETS_CRED: { id: '', name: 'Google Sheets account' },
  GMAIL_CRED: { id: '', name: 'Gmail account' },
  SUPABASE_CRED: { id: '', name: 'Supabase – klucz secret' }, // credential typu Custom Auth z nagłówkiem apikey
  MAREK_EMAIL: 'marek@klimatech.example',
  ANIA_EMAIL: 'biuro@klimatech.example',
  TEST_INBOX: 'twoj.mail+klimatech@gmail.com',
  TRYB_TESTOWY: 'true', // true = wszystkie maile i WhatsAppy idą na TEST_INBOX / TEST_WHATSAPP
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
};

// Węzeł „Zgłoszenie”: ujednolica trzy wejścia do jednego kształtu danych i zapisuje, skąd przyszło (_wejscie)
const ZGLOSZENIE = `// Webhook strony (JSON w body) | formularz klienta (etykiety pól) -> jeden kształt danych
const j = $input.first().json;
if (j.body && typeof j.body === 'object') return [{ json: { ...j.body, _wejscie: 'webhook' } }];
if (typeof j.body === 'string') { try { return [{ json: { ...JSON.parse(j.body), _wejscie: 'webhook' } }]; } catch (e) { return [{ json: { _wejscie: 'webhook' } }]; } }
const POLA = {
  'Firma': 'firma', 'E-mail': 'email', 'Telefon': 'telefon', 'Miasto': 'miasto', 'Województwo': 'wojewodztwo', 'Wiadomość': 'wiadomosc',
  // formularz klienta
  'Imię i nazwisko': 'osoba', 'Czym jesteś zainteresowany?': 'zainteresowanie', 'Orientacyjna wartość zamówienia (zł)': 'szac_wartosc_pln', 'Zgoda': 'zgoda',
};
const out = { _wejscie: 'klient' };
for (const [etykieta, pole] of Object.entries(POLA)) if (j[etykieta] !== undefined && j[etykieta] !== '') out[pole] = j[etykieta];
if (['(nie wiem)', '(ustal z miasta)'].includes(out.wojewodztwo)) delete out.wojewodztwo;
// pola wielokrotnego wyboru przychodzą jako lista
if (Array.isArray(out.zainteresowanie)) out.zainteresowanie = out.zainteresowanie.join(', ');
if (Array.isArray(out.zgoda)) out.zgoda = out.zgoda.length > 0;
const kim = [].concat(j['Kim jesteś?'] || []).join(', ');
if (kim) out.wiadomosc = '[' + kim + '] ' + (out.wiadomosc || '');
return [{ json: out }];`;

const WOJ = ['dolnośląskie', 'kujawsko-pomorskie', 'lubelskie', 'lubuskie', 'łódzkie', 'małopolskie', 'mazowieckie', 'opolskie',
  'podkarpackie', 'podlaskie', 'pomorskie', 'śląskie', 'świętokrzyskie', 'warmińsko-mazurskie', 'wielkopolskie', 'zachodniopomorskie'];

function build(c) {
  let n = 0;
  const uid = (p) => `${p}-0000-4000-8000-${String(++n).padStart(12, '0')}`;
  const sheetsCred = c.SHEETS_CRED.id ? { googleSheetsOAuth2Api: c.SHEETS_CRED } : undefined;
  const gmailCred = c.GMAIL_CRED.id ? { gmailOAuth2: c.GMAIL_CRED } : undefined;
  const supaCred = c.SUPABASE_CRED.id ? { httpCustomAuth: c.SUPABASE_CRED } : undefined;

  // ---------- klocki ----------
  const node = (name, type, typeVersion, position, parameters, extra = {}) =>
    ({ id: uid('a1b2c3d4'), name, type, typeVersion, position, parameters, ...extra });
  const code = (name, pos, jsCode, extra) => node(name, 'n8n-nodes-base.code', 2, pos, { jsCode }, extra);
  const sheet = (tab) => ({ __rl: true, value: tab, mode: 'name' });
  const doc = { __rl: true, value: c.SHEET_ID, mode: 'id' };
  const getRows = (name, pos, tab, extra = {}) => node(name, 'n8n-nodes-base.googleSheets', 4.7, pos,
    { authentication: 'oAuth2', resource: 'sheet', operation: 'read', documentId: doc, sheetName: sheet(tab), options: {} },
    { executeOnce: true, alwaysOutputData: true, credentials: sheetsCred, ...extra });
  const append = (name, pos, tab) => node(name, 'n8n-nodes-base.googleSheets', 4.7, pos, {
    authentication: 'oAuth2', resource: 'sheet', operation: 'append', documentId: doc, sheetName: sheet(tab),
    columns: { mappingMode: 'autoMapInputData', value: {}, matchingColumns: [], schema: [], attemptToConvertTypes: false, convertFieldsToString: false },
    options: { cellFormat: 'RAW' },
  }, { credentials: sheetsCred });
  const update = (name, pos, tab = 'Leady', klucz = 'lead_id') => node(name, 'n8n-nodes-base.googleSheets', 4.7, pos, {
    authentication: 'oAuth2', resource: 'sheet', operation: 'update', documentId: doc, sheetName: sheet(tab),
    columns: { mappingMode: 'autoMapInputData', value: {}, matchingColumns: [klucz], schema: [], attemptToConvertTypes: false, convertFieldsToString: false },
    options: { cellFormat: 'RAW' },
  }, { credentials: sheetsCred });
  const gmail = (name, pos, to, subject, message, extra = {}) => node(name, 'n8n-nodes-base.gmail', 2.1, pos,
    { resource: 'message', operation: 'send', sendTo: to, subject, emailType: 'html', message, options: { appendAttribution: false } },
    { credentials: gmailCred, onError: 'continueRegularOutput', ...extra });
  const ifTrue = (name, pos, expr, extra = {}) => node(name, 'n8n-nodes-base.if', 2.2, pos, {
    conditions: {
      options: { caseSensitive: true, leftValue: '', typeValidation: 'loose', version: 2 },
      conditions: [{ id: uid('c0ffee00'), leftValue: expr, rightValue: '', operator: { type: 'boolean', operation: 'true', singleValue: true } }],
      combinator: 'and',
    },
    options: {},
  }, extra);
  const konfiguracja = (pos, extraFields = []) => node('Konfiguracja', 'n8n-nodes-base.set', 3.4, pos, {
    mode: 'manual',
    includeOtherFields: false,
    assignments: {
      assignments: [
        ['MAREK_EMAIL', c.MAREK_EMAIL], ['ANIA_EMAIL', c.ANIA_EMAIL], ['TEST_INBOX', c.TEST_INBOX], ['TRYB_TESTOWY', c.TRYB_TESTOWY],
        ['STATUS_URL', `${c.N8N_URL}/webhook/status`], ['FORM_KLIENT_URL', `${c.N8N_URL}/form/klimatech`],
        ['KANAL', c.KANAL], ['TEST_WHATSAPP', c.TEST_WHATSAPP], ['MAREK_WHATSAPP', c.MAREK_WHATSAPP], ['ANIA_WHATSAPP', c.ANIA_WHATSAPP],
        ['GREEN_API_URL', c.GREEN_API_URL], ['GREEN_ID', c.GREEN_ID], ['GREEN_TOKEN', c.GREEN_TOKEN], ['GREEN_PHONE', c.GREEN_PHONE],
        ['SUPABASE_URL', c.SUPABASE_URL], ...extraFields,
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
  const waGet = (name, pos, metoda) => node(name, 'n8n-nodes-base.httpRequest', 4.2, pos,
    { method: 'GET', url: greenUrl(metoda, '?minutes=10'), options: {} },
    { executeOnce: true, alwaysOutputData: true, onError: 'continueRegularOutput' }); // Green API niedostępne = brak wiadomości, reszta działa
  const ifOnce = (name, pos, expr) => ifTrue(name, pos, expr, { executeOnce: true });
  const to = (name) => ({ node: name, type: 'main', index: 0 });
  const chain = (...names) => Object.fromEntries(names.slice(0, -1).map((a, i) => [a, { main: [[to(names[i + 1])]] }]));
  const wf = (id, name, nodes, connections) => ({
    id, name, active: false, nodes, connections, settings: { executionOrder: 'v1', timezone: 'Europe/Warsaw' }, pinData: {},
  });
  const X = (i) => 220 * i;
  const opcje = (a) => ({ values: a.map((option) => ({ option })) });
  const trigger1min = () => [
    node('Co minutę', 'n8n-nodes-base.scheduleTrigger', 1.2, [0, -100], { rule: { interval: [{ field: 'minutes', minutesInterval: 1 }] } }),
    node('Test ręczny', 'n8n-nodes-base.manualTrigger', 1, [0, 100], {}),
  ];

  // ======================================================================
  // 1. PRZYJĘCIE LEADA – dwa wejścia, jeden rdzeń, odpowiedź zależna od wejścia
  // ======================================================================
  const PL = "$('Przetwórz lead').first().json";
  const W1 = wf('KlimatechWfA0001', 'Klimatech 1 – Przyjęcie leada', [
    // Produkcja: wtyczka formularza WordPress wysyła JSON na /webhook/lead
    node('Webhook strony WWW', 'n8n-nodes-base.webhook', 2, [0, -220], {
      httpMethod: 'POST', path: 'lead', responseMode: 'lastNode', responseData: 'firstEntryJson', options: { allowedOrigins: '*' },
    }, { webhookId: uid('e0e0e0e0') }),
    // Makieta formularza ze strony – dla klientów
    node('Formularz klienta', 'n8n-nodes-base.formTrigger', 2.2, [0, 0], {
      formTitle: 'Zapytanie ofertowe – Klimatech',
      formDescription: 'Pompy ciepła, klimatyzacja i rekuperacja dla instalatorów i inwestorów. Zostaw kontakt – doradca z Twojego województwa oddzwoni najpóźniej w ciągu jednego dnia roboczego (pn–pt 8–16).',
      formFields: {
        values: [
          { fieldLabel: 'Firma', placeholder: 'np. Instal-Tech Kowalczyk', requiredField: true },
          { fieldLabel: 'Imię i nazwisko', requiredField: true },
          { fieldLabel: 'Telefon', placeholder: 'np. 601 222 333', requiredField: true },
          { fieldLabel: 'E-mail', fieldType: 'email', placeholder: 'opcjonalnie' },
          { fieldLabel: 'Miasto', requiredField: true },
          { fieldLabel: 'Województwo', fieldType: 'dropdown', fieldOptions: opcje(['(nie wiem)', ...WOJ]), requiredField: true },
          { fieldLabel: 'Czym jesteś zainteresowany?', fieldType: 'checkbox', fieldOptions: opcje(['pompy ciepła', 'klimatyzacja', 'rekuperacja']), requiredField: true },
          { fieldLabel: 'Kim jesteś?', fieldType: 'radio', fieldOptions: opcje(['instalator / firma instalacyjna', 'hurtownia', 'deweloper / inwestor', 'klient indywidualny']) },
          { fieldLabel: 'Orientacyjna wartość zamówienia (zł)', fieldType: 'number', placeholder: 'opcjonalnie' },
          { fieldLabel: 'Wiadomość', fieldType: 'textarea', placeholder: 'np. ile urządzeń, na kiedy, jaki obiekt' },
          { fieldLabel: 'Zgoda', fieldType: 'checkbox', fieldOptions: opcje(['Zgadzam się na kontakt telefoniczny i mailowy w sprawie tego zapytania. Administratorem danych jest Klimatech.']), requiredField: true },
        ],
      },
      responseMode: 'lastNode',
      options: { appendAttribution: false, buttonLabel: 'Wyślij zapytanie', path: 'klimatech' },
    }, { webhookId: uid('f0f0f0f0') }),
    code('Zgłoszenie', [X(1), 0], ZGLOSZENIE),
    konfiguracja([X(2), 0]),
    getRows('Pobierz handlowców', [X(3), 0], 'Handlowcy'),
    getRows('Pobierz leady', [X(4), 0], 'Leady'),
    code('Przetwórz lead', [X(5), 0], dist('1-przyjecie-leada.js')),
    ifTrue('Nowy i poprawny?', [X(6), 0], '={{ $json.valid && !$json.powtorka }}'),
    code('Wiersz do zapisu', [X(7), -120], `return [{ json: ${PL}.row }];`),
    append('Zapisz lead', [X(8), -120], 'Leady'),
    code('Historia', [X(9), -120], `return ${PL}.historia.map((h) => ({ json: h }));`),
    append('Zapisz historię', [X(10), -120], 'Historia'),
    ifOnce('Mail?', [X(11), -120], `={{ ${K('KANAL')} !== 'whatsapp' }}`),
    gmail('Wyślij mail', [X(12), -240], `={{ ${PL}.email.to }}`, `={{ ${PL}.email.subject }}`, `={{ ${PL}.email.html }}`, { executeOnce: true }),
    ifOnce('WhatsApp?', [X(13), -120], `={{ !!${PL}.whatsapp }}`),
    waSend('Wyślij WhatsApp', [X(14), -240], `${PL}.whatsapp.chatId`, `${PL}.whatsapp.message`, { executeOnce: true }),
    // Odpowiedź: formularze -> strona wyniku; webhook -> JSON (200 / 400)
    ifOnce('Z formularza?', [X(15), 0], `={{ ${PL}.wejscie !== 'webhook' }}`),
    node('Strona wyniku', 'n8n-nodes-base.form', 1, [X(16), -100], { operation: 'completion', respondWith: 'showText', responseText: `={{ ${PL}.strona }}` }),
    // n8n nie pozwala na „Respond to Webhook” obok formularza n8n -> webhook odsyła wynik ostatniego węzła (ten JSON).
    // Kod HTTP zawsze 200; o powodzeniu mówi pole ok (true/false) i lista errors.
    code('Odpowiedź JSON', [X(16), 100], `return [{ json: ${PL}.response }];`),
  ], {
    'Webhook strony WWW': { main: [[to('Zgłoszenie')]] },
    'Formularz klienta': { main: [[to('Zgłoszenie')]] },
    ...chain('Zgłoszenie', 'Konfiguracja', 'Pobierz handlowców', 'Pobierz leady', 'Przetwórz lead', 'Nowy i poprawny?'),
    // błąd walidacji albo powtórne wysłanie: nic nie zapisujemy, od razu odpowiedź
    'Nowy i poprawny?': { main: [[to('Wiersz do zapisu')], [to('Z formularza?')]] },
    ...chain('Wiersz do zapisu', 'Zapisz lead', 'Historia', 'Zapisz historię', 'Mail?'),
    'Mail?': { main: [[to('Wyślij mail')], [to('WhatsApp?')]] },
    'Wyślij mail': { main: [[to('WhatsApp?')]] },
    'WhatsApp?': { main: [[to('Wyślij WhatsApp')], [to('Z formularza?')]] },
    'Wyślij WhatsApp': { main: [[to('Z formularza?')]] },
    'Z formularza?': { main: [[to('Strona wyniku')], [to('Odpowiedź JSON')]] },
  });

  // ======================================================================
  // 2. OBSŁUGA CO MINUTĘ – jeden odczyt arkusza, jeden przebieg rdzenia, zapisy przed powiadomieniami
  // ======================================================================
  const OB = "$('Obsłuż').first().json";
  const galaz = (nazwa, y, pole) => code(nazwa, [X(8), y], `return ${OB}.${pole}.map((x) => ({ json: x }));`);
  const W2 = wf('KlimatechWfC0001', 'Klimatech 2 – Obsługa co minutę', [
    ...trigger1min(),
    konfiguracja([X(1), 0], [['TERAZ', ''], ['RAPORT_TERAZ', '']]),
    getRows('Pobierz handlowców', [X(2), 0], 'Handlowcy'),
    getRows('Pobierz leady', [X(3), 0], 'Leady'),
    getRows('Pobierz skrzynkę', [X(4), 0], 'Wpisz lead', { onError: 'continueRegularOutput' }), // brak zakładki nie zatrzymuje SLA
    waGet('Pobierz wiadomości', [X(5), 0], 'lastIncomingMessages'),
    waGet('Pobierz wysłane', [X(6), 0], 'lastOutgoingMessages'),
    code('Obsłuż', [X(7), 0], dist('2-obsluga-co-minute.js')),
    // n8n wykonuje gałęzie od góry: najpierw zapisy w arkuszu, na końcu powiadomienia
    galaz('Nowe leady', -375, 'nowe_leady'), append('Zapisz nowe leady', [X(9), -375], 'Leady'),
    galaz('Zmiany leadów', -225, 'aktualizacje'), update('Aktualizuj leady', [X(9), -225]),
    galaz('Wpisy historii', -75, 'historia'), append('Zapisz historię', [X(9), -75], 'Historia'),
    galaz('Wyniki skrzynki', 75, 'wyniki'), update('Zapisz wynik w wierszu', [X(9), 75], 'Wpisz lead', 'row_number'),
    galaz('Maile', 225, 'emaile'), gmail('Wyślij mail', [X(9), 225], '={{ $json.to }}', '={{ $json.subject }}', '={{ $json.html }}'),
    galaz('WhatsAppy', 375, 'whatsapp'), waSend('Wyślij WhatsApp', [X(9), 375], '$json.chatId', '$json.message'),
  ], {
    'Co minutę': { main: [[to('Konfiguracja')]] },
    'Test ręczny': { main: [[to('Konfiguracja')]] },
    ...chain('Konfiguracja', 'Pobierz handlowców', 'Pobierz leady', 'Pobierz skrzynkę', 'Pobierz wiadomości', 'Pobierz wysłane', 'Obsłuż'),
    'Obsłuż': { main: [[to('Nowe leady'), to('Zmiany leadów'), to('Wpisy historii'), to('Wyniki skrzynki'), to('Maile'), to('WhatsAppy')]] },
    'Nowe leady': { main: [[to('Zapisz nowe leady')]] },
    'Zmiany leadów': { main: [[to('Aktualizuj leady')]] },
    'Wpisy historii': { main: [[to('Zapisz historię')]] },
    'Wyniki skrzynki': { main: [[to('Zapisz wynik w wierszu')]] },
    'Maile': { main: [[to('Wyślij mail')]] },
    'WhatsAppy': { main: [[to('Wyślij WhatsApp')]] },
  });

  // ======================================================================
  // 3. STATUS Z LINKU – klik w przycisk w mailu
  // ======================================================================
  const page = (body, codeNum) => ({
    respondWith: 'text', responseBody: body,
    options: { responseCode: codeNum, responseHeaders: { entries: [{ name: 'Content-Type', value: 'text/html; charset=utf-8' }] } },
  });
  const W3 = wf('KlimatechWfB0001', 'Klimatech 3 – Status z linku w mailu', [
    node('Klik w link', 'n8n-nodes-base.webhook', 2, [0, 0], { httpMethod: 'GET', path: 'status', responseMode: 'responseNode', options: {} }, { webhookId: uid('e1e1e1e1') }),
    getRows('Pobierz lead', [X(1), 0], 'Leady'),
    code('Ustaw status', [X(2), 0], dist('3-status-z-linku.js')),
    ifTrue('Czy poprawny?', [X(3), 0], '={{ $json.ok }}'),
    code('Wiersz do aktualizacji', [X(4), -100], "return [{ json: $('Ustaw status').first().json.update }];"),
    update('Aktualizuj lead', [X(5), -100]),
    code('Historia', [X(6), -100], "return $('Ustaw status').first().json.historia.map((h) => ({ json: h }));"),
    append('Zapisz historię', [X(7), -100], 'Historia'),
    node('Pokaż potwierdzenie', 'n8n-nodes-base.respondToWebhook', 1.1, [X(8), -100], page("={{ $('Ustaw status').first().json.html }}", 200)),
    node('Pokaż błąd', 'n8n-nodes-base.respondToWebhook', 1.1, [X(4), 100], page('={{ $json.html }}', 400)),
  ], {
    ...chain('Klik w link', 'Pobierz lead', 'Ustaw status', 'Czy poprawny?'),
    'Czy poprawny?': { main: [[to('Wiersz do aktualizacji')], [to('Pokaż błąd')]] },
    ...chain('Wiersz do aktualizacji', 'Aktualizuj lead', 'Historia', 'Zapisz historię', 'Pokaż potwierdzenie'),
  });

  // ======================================================================
  // 4. SYNCHRONIZACJA Z CRM – arkusz -> Supabase (lustro), osobno od leadów
  // ======================================================================
  const W4 = wf('KlimatechWfE0001', 'Klimatech 4 – Synchronizacja z CRM', [
    ...trigger1min(),
    konfiguracja([X(1), 0]),
    getRows('Pobierz handlowców', [X(2), 0], 'Handlowcy'),
    getRows('Pobierz leady', [X(3), 0], 'Leady'),
    getRows('Pobierz historię', [X(4), 0], 'Historia'),
    code('Przygotuj dane', [X(5), 0], dist('4-synchronizacja-crm.js')),
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

  return {
    '1-przyjecie-leada': W1,
    '2-obsluga-co-minute': W2,
    '3-status-z-linku': W3,
    '4-synchronizacja-crm': W4,
  };
}

function write(dir, cfg) {
  rmSync(dir, { recursive: true, force: true }); // bez starych plików po zmianie architektury
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
