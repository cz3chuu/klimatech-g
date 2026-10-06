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
  ANIA_EMAIL: 'a.kos@klimatech.example',
  PROG_LIDER: '50000', // lead powyżej tej wartości = dodatkowe powiadomienie dla Marka (lider sprzedaży)
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
  // WhatsApp Business API (Meta) – po weryfikacji firmy i rejestracji numeru: WHATSAPP = 'meta' (do tego czasu Green API)
  WHATSAPP: 'green',
  WEBHOOK_KLUCZ: '', // klucz dostępu do adresu formularza (w config.local.json – losowy, nie trafia do repo)
  META_API_WERSJA: 'v21.0',
  META_PHONE_ID: 'WKLEJ_PHONE_NUMBER_ID',
  META_TOKEN: 'WKLEJ_TOKEN_SYSTEM_USER',
  META_VERIFY_TOKEN: 'WYMYSL_DLUGI_LOSOWY_CIAG',
};

// Węzeł „Zgłoszenie”: ujednolica trzy wejścia do jednego kształtu danych i zapisuje, skąd przyszło (_wejscie)
const ZGLOSZENIE = `// Formularz na stronie (Contact Form 7 -> webhook, JSON) | formularz klienta n8n (etykiety pól) -> jeden kształt danych
const j = $input.first().json;
// klucz dostępu: ?klucz=… w adresie albo nagłówek X-Klimatech-Token (sprawdza go węzeł „Przetwórz lead”)
const klucz = (j.query || {}).klucz || (j.headers || {})['x-klimatech-token'] || '';
if (j.body && typeof j.body === 'object') return [{ json: { ...j.body, _wejscie: 'webhook', _klucz: klucz } }];
if (typeof j.body === 'string') { try { return [{ json: { ...JSON.parse(j.body), _wejscie: 'webhook', _klucz: klucz } }]; } catch (e) { return [{ json: { _wejscie: 'webhook', _klucz: klucz } }]; } }
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

// Strona po otwarciu adresu formularza w przeglądarce: z poprawnym kluczem – „działa” i skrót instrukcji, bez – brak dostępu
const STRONA_ADRESU = `const k = $('Konfiguracja (adres)').first().json;
const q = $('Sprawdzenie adresu formularza').first().json.query || {};
const ok = !String(k.WEBHOOK_KLUCZ || '').trim() || q.klucz === k.WEBHOOK_KLUCZ;
const ramka = (t) => '<!doctype html><html lang="pl"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Klimatech – adres formularza</title></head>'
  + '<body style="margin:0;background:#f2f4f6;font:15px/1.55 Arial,sans-serif;color:#142029"><div style="max-width:640px;margin:32px auto;padding:24px;background:#fff;border:1px solid #e1e6eb;border-radius:12px">' + t + '</div></body></html>';
const html = ok ? ramka('<h1 style="font-size:22px;margin:0 0 6px;color:#17803d">✅ Adres formularza działa</h1>'
  + '<p style="margin:0 0 14px;color:#5d6a76">To jest adres, na który Contact Form 7 ma wysyłać zgłoszenia. Klucz dostępu jest poprawny.</p>'
  + '<ul style="padding-left:20px;margin:0 0 14px"><li>Metoda: <b>POST</b>, format <b>JSON</b> (wtyczka „CF7 to Webhook”)</li>'
  + '<li>Adres: ten sam, z parametrem <code>?klucz=…</code> (albo nagłówek <code>X-Klimatech-Token</code>)</li>'
  + '<li>Pola: domyślne nazwy CF7 (<code>your-name</code>, <code>your-email</code>, <code>your-tel</code>, <code>your-message</code>) oraz <code>your-company</code>, <code>your-city</code>, <code>your-region</code>, <code>zainteresowanie</code>, <code>wartosc</code>, <code>acceptance-rodo</code></li></ul>'
  + '<p style="margin:0;color:#5d6a76;font-size:14px">Zgłoszenie trafia od razu do handlowca z województwa klienta (WhatsApp + mail). Mail na biuro@ z formularza zostaje jako kopia.</p>')
  : ramka('<h1 style="font-size:22px;margin:0 0 6px;color:#b42318">⚠️ Brak dostępu</h1><p style="margin:0;color:#5d6a76">Brakuje klucza albo jest nieprawidłowy. Użyj pełnego adresu z parametrem <code>?klucz=…</code>.</p>');
return [{ json: { ok, html } }];`;

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
  const konfiguracja = (pos, extraFields = [], nazwa = 'Konfiguracja') => node(nazwa, 'n8n-nodes-base.set', 3.4, pos, {
    mode: 'manual',
    includeOtherFields: false,
    assignments: {
      assignments: [
        ['MAREK_EMAIL', c.MAREK_EMAIL], ['ANIA_EMAIL', c.ANIA_EMAIL], ['TEST_INBOX', c.TEST_INBOX], ['TRYB_TESTOWY', c.TRYB_TESTOWY],
        ['STATUS_URL', `${c.N8N_URL}/webhook/status`], ['FORM_KLIENT_URL', `${c.N8N_URL}/form/klimatech`],
        ['KANAL', c.KANAL], ['TEST_WHATSAPP', c.TEST_WHATSAPP], ['MAREK_WHATSAPP', c.MAREK_WHATSAPP], ['ANIA_WHATSAPP', c.ANIA_WHATSAPP],
        ['GREEN_API_URL', c.GREEN_API_URL], ['GREEN_ID', c.GREEN_ID], ['GREEN_TOKEN', c.GREEN_TOKEN], ['GREEN_PHONE', c.GREEN_PHONE],
        ['SUPABASE_URL', c.SUPABASE_URL], ['PROG_LIDER', c.PROG_LIDER],
        ['WEBHOOK_KLUCZ', c.WEBHOOK_KLUCZ], ['WHATSAPP', c.WHATSAPP], ['META_API_WERSJA', c.META_API_WERSJA], ['META_PHONE_ID', c.META_PHONE_ID], ['META_TOKEN', c.META_TOKEN], ['META_VERIFY_TOKEN', c.META_VERIFY_TOKEN],
        ...extraFields,
      ].map(([name, value]) => ({ id: uid('5e7f1e1d'), name, value, type: 'string' })),
    },
    options: {},
  });
  const K = (f) => `$('Konfiguracja').first().json.${f}`;
  const greenUrl = (metoda, query = '') => `={{ ${K('GREEN_API_URL')} }}/waInstance{{ ${K('GREEN_ID')} }}/${metoda}/{{ ${K('GREEN_TOKEN')} }}${query}`;
  // Wysyłka WhatsApp: WHATSAPP = green (makieta, Green API) albo meta (WhatsApp Business API – szablony z rdzenia, pole meta_body)
  const META = `${K('WHATSAPP')} === 'meta'`;
  const waSend = (name, pos, obj, extra = {}) => node(name, 'n8n-nodes-base.httpRequest', 4.2, pos, {
    method: 'POST',
    url: `={{ ${META} ? 'https://graph.facebook.com/' + ${K('META_API_WERSJA')} + '/' + ${K('META_PHONE_ID')} + '/messages' : ${K('GREEN_API_URL')} + '/waInstance' + ${K('GREEN_ID')} + '/sendMessage/' + ${K('GREEN_TOKEN')} }}`,
    sendHeaders: true,
    headerParameters: { parameters: [{ name: 'Authorization', value: `={{ ${META} ? 'Bearer ' + ${K('META_TOKEN')} : 'none' }}` }] },
    sendBody: true, specifyBody: 'json',
    jsonBody: `={{ JSON.stringify(${META} ? ${obj}.meta_body : { chatId: ${obj}.chatId, message: ${obj}.message }) }}`, options: {},
  }, { onError: 'continueRegularOutput', ...extra });
  const waGet = (name, pos, metoda) => node(name, 'n8n-nodes-base.httpRequest', 4.2, pos,
    { method: 'GET', url: greenUrl(metoda, '?minutes=10'), options: {} },
    { executeOnce: true, alwaysOutputData: true, onError: 'continueRegularOutput' }); // Green API niedostępne = brak wiadomości, reszta działa
  const ifOnce = (name, pos, expr) => ifTrue(name, pos, expr, { executeOnce: true });
  const supaGet = (name, pos, sciezka) => node(name, 'n8n-nodes-base.httpRequest', 4.2, pos, {
    method: 'GET', url: `={{ ${K('SUPABASE_URL')} }}/rest/v1/${sciezka}`,
    authentication: 'genericCredentialType', genericAuthType: 'httpCustomAuth', options: {},
  }, { credentials: supaCred, executeOnce: true, alwaysOutputData: true, onError: 'continueRegularOutput' });
  const upsertSheet = (name, pos, tab, klucz) => node(name, 'n8n-nodes-base.googleSheets', 4.7, pos, {
    authentication: 'oAuth2', resource: 'sheet', operation: 'appendOrUpdate', documentId: doc, sheetName: sheet(tab),
    columns: { mappingMode: 'autoMapInputData', value: {}, matchingColumns: [klucz], schema: [], attemptToConvertTypes: false, convertFieldsToString: false },
    options: { cellFormat: 'RAW' },
  }, { credentials: sheetsCred });
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
    // Produkcja: Contact Form 7 (wtyczka „CF7 to Webhook”) wysyła JSON na /webhook/lead?klucz=… – instrukcja: docs/dla-agencji-cf7.md
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
    getRows('Pobierz wyjątki', [X(4), 160], 'Wyjątki', { onError: 'continueRegularOutput' }),
    getRows('Pobierz nieobecności', [X(4), 320], 'Nieobecności', { onError: 'continueRegularOutput' }),
    code('Przetwórz lead', [X(5), 0], dist('1-przyjecie-leada.js')),
    ifTrue('Nowy i poprawny?', [X(6), 0], '={{ $json.valid && !$json.powtorka }}'),
    code('Wiersz do zapisu', [X(7), -120], `return [{ json: ${PL}.row }];`),
    append('Zapisz lead', [X(8), -120], 'Leady'),
    code('Historia', [X(9), -120], `return ${PL}.historia.map((h) => ({ json: h }));`),
    append('Zapisz historię', [X(10), -120], 'Historia'),
    ifOnce('Mail?', [X(11), -120], `={{ ${K('KANAL')} !== 'whatsapp' }}`),
    gmail('Wyślij mail', [X(12), -240], `={{ ${PL}.email.to }}`, `={{ ${PL}.email.subject }}`, `={{ ${PL}.email.html }}`, { executeOnce: true }),
    ifOnce('WhatsApp?', [X(13), -120], `={{ !!${PL}.whatsapp }}`),
    waSend('Wyślij WhatsApp', [X(14), -240], `${PL}.whatsapp`, { executeOnce: true }),
    // Lead powyżej progu: informacja dla Marka jako lidera sprzedaży (lead zostaje u handlowca)
    ifOnce('Lider?', [X(15), -120], `={{ !!${PL}.lider }}`),
    gmail('Mail do lidera', [X(16), -240], `={{ ${PL}.lider.email ? ${PL}.lider.email.to : '' }}`, `={{ ${PL}.lider.email ? ${PL}.lider.email.subject : '' }}`, `={{ ${PL}.lider.email ? ${PL}.lider.email.html : '' }}`, { executeOnce: true }),
    waSend('WhatsApp do lidera', [X(17), -240], `${PL}.lider.whatsapp`, { executeOnce: true }),
    // Odpowiedź: formularze -> strona wyniku; webhook -> JSON (200 / 400)
    ifOnce('Z formularza?', [X(18), 0], `={{ ${PL}.wejscie !== 'webhook' }}`),
    node('Strona wyniku', 'n8n-nodes-base.form', 1, [X(19), -100], { operation: 'completion', respondWith: 'showText', responseText: `={{ ${PL}.strona }}` }),
    // n8n nie pozwala na „Respond to Webhook” obok formularza n8n -> webhook odsyła wynik ostatniego węzła (ten JSON).
    // Kod HTTP zawsze 200; o powodzeniu mówi pole ok (true/false) i lista errors.
    code('Odpowiedź JSON', [X(19), 100], `return [{ json: ${PL}.response }];`),
  ], {
    'Webhook strony WWW': { main: [[to('Zgłoszenie')]] },
    'Formularz klienta': { main: [[to('Zgłoszenie')]] },
    ...chain('Zgłoszenie', 'Konfiguracja', 'Pobierz handlowców', 'Pobierz leady', 'Pobierz wyjątki', 'Pobierz nieobecności', 'Przetwórz lead', 'Nowy i poprawny?'),
    // błąd walidacji albo powtórne wysłanie: nic nie zapisujemy, od razu odpowiedź
    'Nowy i poprawny?': { main: [[to('Wiersz do zapisu')], [to('Z formularza?')]] },
    ...chain('Wiersz do zapisu', 'Zapisz lead', 'Historia', 'Zapisz historię', 'Mail?'),
    'Mail?': { main: [[to('Wyślij mail')], [to('WhatsApp?')]] },
    'Wyślij mail': { main: [[to('WhatsApp?')]] },
    'WhatsApp?': { main: [[to('Wyślij WhatsApp')], [to('Lider?')]] },
    'Wyślij WhatsApp': { main: [[to('Lider?')]] },
    'Lider?': { main: [[to('Mail do lidera')], [to('Z formularza?')]] },
    'Mail do lidera': { main: [[to('WhatsApp do lidera')]] },
    'WhatsApp do lidera': { main: [[to('Z formularza?')]] },
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
    getRows('Pobierz wyjątki', [X(4), 160], 'Wyjątki', { onError: 'continueRegularOutput' }),
    getRows('Pobierz nieobecności', [X(4), 320], 'Nieobecności', { onError: 'continueRegularOutput' }),
    waGet('Pobierz wiadomości', [X(5), 0], 'lastIncomingMessages'),
    waGet('Pobierz wysłane', [X(6), 0], 'lastOutgoingMessages'),
    code('Obsłuż', [X(7), 0], dist('2-obsluga-co-minute.js')),
    // n8n wykonuje gałęzie od góry: najpierw zapisy w arkuszu, na końcu powiadomienia
    galaz('Nowe leady', -375, 'nowe_leady'), append('Zapisz nowe leady', [X(9), -375], 'Leady'),
    galaz('Zmiany leadów', -225, 'aktualizacje'), update('Aktualizuj leady', [X(9), -225]),
    galaz('Wpisy historii', -75, 'historia'), append('Zapisz historię', [X(9), -75], 'Historia'),
    galaz('Wyniki skrzynki', 75, 'wyniki'), update('Zapisz wynik w wierszu', [X(9), 75], 'Wpisz lead', 'row_number'),
    galaz('Maile', 225, 'emaile'), gmail('Wyślij mail', [X(9), 225], '={{ $json.to }}', '={{ $json.subject }}', '={{ $json.html }}'),
    galaz('WhatsAppy', 375, 'whatsapp'), waSend('Wyślij WhatsApp', [X(9), 375], '$json'),
  ], {
    'Co minutę': { main: [[to('Konfiguracja')]] },
    'Test ręczny': { main: [[to('Konfiguracja')]] },
    ...chain('Konfiguracja', 'Pobierz handlowców', 'Pobierz leady', 'Pobierz skrzynkę', 'Pobierz wyjątki', 'Pobierz nieobecności', 'Pobierz wiadomości', 'Pobierz wysłane', 'Obsłuż'),
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
    // Otwarcie adresu formularza w przeglądarce (GET /webhook/lead?klucz=…) – sprawdzenie, czy adres i klucz działają
    node('Sprawdzenie adresu formularza', 'n8n-nodes-base.webhook', 2, [0, 300], { httpMethod: 'GET', path: 'lead', responseMode: 'responseNode', options: {} }, { webhookId: uid('e4e4e4e4') }),
    konfiguracja([X(1), 300], [], 'Konfiguracja (adres)'),
    code('Strona adresu', [X(2), 300], STRONA_ADRESU),
    node('Pokaż stan adresu', 'n8n-nodes-base.respondToWebhook', 1.1, [X(3), 300], {
      respondWith: 'text', responseBody: '={{ $json.html }}',
      options: { responseCode: '={{ $json.ok ? 200 : 403 }}', responseHeaders: { entries: [{ name: 'Content-Type', value: 'text/html; charset=utf-8' }] } },
    }),
  ], {
    ...chain('Sprawdzenie adresu formularza', 'Konfiguracja (adres)', 'Strona adresu', 'Pokaż stan adresu'),
    ...chain('Klik w link', 'Pobierz lead', 'Ustaw status', 'Czy poprawny?'),
    'Czy poprawny?': { main: [[to('Wiersz do aktualizacji')], [to('Pokaż błąd')]] },
    ...chain('Wiersz do aktualizacji', 'Aktualizuj lead', 'Historia', 'Zapisz historię', 'Pokaż potwierdzenie'),
  });

  // ======================================================================
  // 4. SYNCHRONIZACJA Z CRM – zespół: CRM -> arkusz; leady i historia: arkusz -> Supabase (lustro); osobno od leadów
  // ======================================================================
  const W4 = wf('KlimatechWfE0001', 'Klimatech 4 – Synchronizacja z CRM', [
    ...trigger1min(),
    konfiguracja([X(1), 0]),
    // Zespół: CRM (Supabase) -> arkusz. Błąd odczytu z CRM = nic nie zapisujemy (arkusz zostaje na ostatnim stanie).
    supaGet('Pobierz zespół z CRM', [X(2), -300], 'handlowcy?select=handlowiec_id,imie_nazwisko,email,wojewodztwa,whatsapp,aktywny_do&order=handlowiec_id'),
    supaGet('Pobierz nieobecności z CRM', [X(3), -300], 'nieobecnosci?select=id,handlowiec_id,od_dnia,do_dnia,zastepca_id,powod,anulowana&order=od_dnia'),
    code('Handlowcy do arkusza', [X(4), -380], "return $('Pobierz zespół z CRM').all().map((i) => i.json).filter((h) => h.handlowiec_id)\n  .map((h) => ({ json: { handlowiec_id: h.handlowiec_id, imie_nazwisko: h.imie_nazwisko || '', email: h.email || '', wojewodztwa: h.wojewodztwa || '', whatsapp: h.whatsapp || '', aktywny_do: h.aktywny_do || '' } }));"),
    upsertSheet('Zapisz handlowców', [X(5), -380], 'Handlowcy', 'handlowiec_id'),
    code('Nieobecności do arkusza', [X(4), -220], "return $('Pobierz nieobecności z CRM').all().map((i) => i.json).filter((n) => n.id)\n  .map((n) => ({ json: { id: n.id, handlowiec_id: n.handlowiec_id, od_dnia: n.od_dnia || '', do_dnia: n.do_dnia || '', zastepca_id: n.zastepca_id || '', powod: n.powod || '', anulowana: n.anulowana ? 'true' : 'false' } }));"),
    upsertSheet('Zapisz nieobecności', [X(5), -220], 'Nieobecności', 'id'),
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
    'Konfiguracja': { main: [[to('Pobierz zespół z CRM'), to('Pobierz leady')]] },
    'Pobierz zespół z CRM': { main: [[to('Pobierz nieobecności z CRM')]] },
    'Pobierz nieobecności z CRM': { main: [[to('Handlowcy do arkusza'), to('Nieobecności do arkusza')]] },
    'Handlowcy do arkusza': { main: [[to('Zapisz handlowców')]] },
    'Nieobecności do arkusza': { main: [[to('Zapisz nieobecności')]] },
    ...chain('Pobierz leady', 'Pobierz historię', 'Przygotuj dane', 'Zapisz w Supabase', 'Do usunięcia', 'Usuń nieaktualne'),
  });

  // ======================================================================
  // 5. WHATSAPP BUSINESS (META) – ODBIÓR: weryfikacja webhooka i kliknięcia przycisków. Włączyć po wdrożeniu (publiczny HTTPS).
  // ======================================================================
  const W5 = wf('KlimatechWfM0001', 'Klimatech 5 – WhatsApp Business (Meta) – odbiór', [
    // Meta przy podpinaniu webhooka wysyła GET z hub.verify_token i oczekuje odesłania hub.challenge
    node('Weryfikacja Meta', 'n8n-nodes-base.webhook', 2, [0, -200], { httpMethod: 'GET', path: 'whatsapp', responseMode: 'responseNode', options: {} }, { webhookId: uid('e2e2e2e2') }),
    konfiguracja([X(1), -200], [], 'Konfiguracja (weryfikacja)'),
    ifTrue('Token zgodny?', [X(2), -200], "={{ $('Weryfikacja Meta').first().json.query['hub.verify_token'] === $('Konfiguracja (weryfikacja)').first().json.META_VERIFY_TOKEN }}"),
    node('Odeślij challenge', 'n8n-nodes-base.respondToWebhook', 1.1, [X(3), -280], { respondWith: 'text', responseBody: "={{ $('Weryfikacja Meta').first().json.query['hub.challenge'] }}", options: { responseCode: 200 } }),
    node('Odmów', 'n8n-nodes-base.respondToWebhook', 1.1, [X(3), -120], { respondWith: 'text', responseBody: 'Forbidden', options: { responseCode: 403 } }),
    // Wiadomości: Meta wymaga szybkiego 200 – odpowiadamy od razu, przetwarzamy potem
    node('Wiadomość z Meta', 'n8n-nodes-base.webhook', 2, [0, 120], { httpMethod: 'POST', path: 'whatsapp', responseMode: 'onReceived', options: {} }, { webhookId: uid('e3e3e3e3') }),
    konfiguracja([X(1), 120]),
    getRows('Pobierz leady', [X(2), 120], 'Leady'),
    getRows('Pobierz handlowców', [X(3), 120], 'Handlowcy'),
    getRows('Pobierz nieobecności', [X(4), 120], 'Nieobecności', { onError: 'continueRegularOutput' }),
    code('Przetwórz z Meta', [X(5), 120], dist('5-whatsapp-meta.js')),
    code('Aktualizacje', [X(6), 0], 'return $input.all().filter((i) => i.json.update).map((i) => ({ json: i.json.update }));'),
    update('Aktualizuj lead', [X(7), 0]),
    code('Wpisy historii', [X(6), 120], 'return $input.all().flatMap((i) => (i.json.historia || []).map((h) => ({ json: h })));'),
    append('Zapisz historię', [X(7), 120], 'Historia'),
    code('Potwierdzenia', [X(6), 240], 'return $input.all().filter((i) => i.json.reply).map((i) => ({ json: i.json.reply }));'),
    waSend('Odpisz handlowcowi', [X(7), 240], '$json'),
  ], {
    ...chain('Weryfikacja Meta', 'Konfiguracja (weryfikacja)', 'Token zgodny?'),
    'Token zgodny?': { main: [[to('Odeślij challenge')], [to('Odmów')]] },
    ...chain('Wiadomość z Meta', 'Konfiguracja', 'Pobierz leady', 'Pobierz handlowców', 'Pobierz nieobecności', 'Przetwórz z Meta'),
    'Przetwórz z Meta': { main: [[to('Aktualizacje'), to('Wpisy historii'), to('Potwierdzenia')]] },
    'Aktualizacje': { main: [[to('Aktualizuj lead')]] },
    'Wpisy historii': { main: [[to('Zapisz historię')]] },
    'Potwierdzenia': { main: [[to('Odpisz handlowcowi')]] },
  });

  return {
    '5-whatsapp-meta-odbior': W5,
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
