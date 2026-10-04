# n8n – specyfikacja workflow (makieta)

Trzy workflow, jeden arkusz, jeden rdzeń logiki.

```
A. Przyjęcie leada     POST /webhook/lead    formularz (React) → dedup + routing → arkusz → mail do opiekuna
B. Status z maila      GET  /webhook/status  klik w przycisk w mailu → aktualizacja statusu w arkuszu
C. Kontrola SLA        co 15 min             leady bez kontaktu → przypomnienia / eskalacja do Marka
```

Cała logika biznesowa siedzi w `n8n/src/core.js`. Węzły Code dostają gotowy plik z `n8n/dist/` (budowany przez `npm run build:n8n`) – **nie edytuj kodu w n8n ręcznie**, zmieniaj `n8n/src/` i wklejaj ponownie. Dzięki temu ta sama logika jest testowana (`npm test`) i używana do importu danych z załącznika.

---

## 0. Przygotowanie

### Arkusz Google „Klimatech – leady (makieta)”

| Zakładka | Zawartość | Skąd |
|---|---|---|
| `Leady` | 28 kolumn (lista niżej) | Import `data/leady-import.csv` |
| `Handlowcy` | `handlowiec_id, imie_nazwisko, email, wojewodztwa` | Import `data/klimatech-handlowcy.csv` |
| `Historia` | `czas, lead_id, zdarzenie, szczegoly` | Import `data/historia-import.csv` |

Import: *Plik → Importuj → Prześlij → „Zastąp bieżący arkusz”*, **odznacz „Konwertuj tekst na liczby, daty i formuły”** (inaczej `+48604777321` zmieni się w liczbę, a daty w format arkusza).

Kolumny `Leady` (kolejność ma znaczenie tylko dla czytelności, n8n mapuje po nagłówkach):

```
lead_id, data_zgloszenia, zrodlo, firma, osoba, email, telefon, miasto, wojewodztwo,
zainteresowanie, szac_wartosc_pln, wiadomosc, telefon_norm, firma_klucz, wojewodztwo_zrodlo,
routing, handlowiec_id, handlowiec, duplikat_of, duplikat_typ, duplikat_powod, status,
pierwszy_kontakt, kontakt_kto, proby, sla_poziom, token, aktualizacja
```

Wartości słownikowe:
- `routing`: `handlowiec` | `bez_opiekuna` (województwo bez handlowca → Marek) | `do_ustalenia` (brak województwa → Ania)
- `duplikat_typ`: `pewny` (ten sam telefon / e-mail) | `mozliwy` (ta sama nazwa firmy / domena)
- `status`: `nowy` | `nie_odebral` | `dodzwoniono` | `umowione` | `niezainteresowany`
- `sla_poziom`: `0` brak | `1` > 4 h robocze | `2` > 1 dzień roboczy | `3` > 2 dni (eskalacja)

Dla wygody Ani i Marka: formatowanie warunkowe na `sla_poziom` (1 żółty, 2 pomarańczowy, 3 czerwony) i filtr `status = nowy`.

### n8n

- Self-hosted (Docker na Hetzner/Coolify) lub n8n Cloud. Ustawienia instancji: **Timezone = Europe/Warsaw** (dla harmonogramu; rdzeń i tak liczy czas warszawski przez `Intl`).
- Credentials: **Google Sheets OAuth2** i **Gmail OAuth2** (na self-hosted wymaga klienta OAuth w Google Cloud Console z redirect URL n8n).
- Wszystkie trzy workflow muszą być **aktywne** – adresy `/webhook/...` działają tylko wtedy (`/webhook-test/...` działa tylko przy ręcznym „Test workflow”).

### Węzeł „Konfiguracja” (Set) – identyczny w A i C

Typ: **Edit Fields (Set)**, tryb Manual, *Include Other Input Fields: off*. Pola (String):

| Pole | Przykład | Opis |
|---|---|---|
| `MAREK_EMAIL` | `marek@klimatech.example` | eskalacje i leady bez opiekuna |
| `ANIA_EMAIL` | `biuro@klimatech.example` | leady bez województwa, możliwe duplikaty (cc) |
| `TEST_INBOX` | `twoj.mail+klimatech@gmail.com` | w trybie testowym WSZYSTKO idzie tutaj |
| `TRYB_TESTOWY` | `true` | `true` = przekierowanie na TEST_INBOX, prawdziwy adresat w temacie |
| `STATUS_URL` | `https://n8n.twojadomena.pl/webhook/status` | adres webhooka B dla przycisków w mailach |

Tryb testowy jest konieczny, bo adresy handlowców w danych są fikcyjne (`.example`).

---

## A. Przyjęcie leada

```
Webhook ─► Konfiguracja ─► Pobierz handlowców ─► Pobierz leady ─► Przetwórz lead ─► Czy poprawny?
                                                                                     │ true
                                                                                     ├─► Wiersz do zapisu ─► Zapisz lead ─► Historia ─► Zapisz historię ─► Wyślij mail ─► Odpowiedz OK
                                                                                     │ false
                                                                                     └─► Odpowiedz błąd
```

| # | Nazwa węzła (dokładnie tak – kod odwołuje się po nazwach) | Typ | Ustawienia |
|---|---|---|---|
| 1 | `Webhook` | Webhook | Method `POST`, Path `lead`, Respond: **Using 'Respond to Webhook' Node**. Options → **Allowed Origins (CORS)**: `*` (lub `http://localhost:5173`) |
| 2 | `Konfiguracja` | Edit Fields (Set) | jak wyżej |
| 3 | `Pobierz handlowców` | Google Sheets → Get Row(s) | arkusz, zakładka `Handlowcy`, bez filtrów. Settings: **Execute Once: on**, **Always Output Data: on** |
| 4 | `Pobierz leady` | Google Sheets → Get Row(s) | zakładka `Leady`, bez filtrów. Settings: **Execute Once: on**, **Always Output Data: on** |
| 5 | `Przetwórz lead` | Code (JavaScript) | Mode **Run Once for All Items**, kod: `n8n/dist/A-przetworz-lead.js` |
| 6 | `Czy poprawny?` | If | `{{ $json.valid }}` is true (Boolean) |
| 7 | `Wiersz do zapisu` | Code | `return [{ json: $('Przetwórz lead').first().json.row }];` |
| 8 | `Zapisz lead` | Google Sheets → Append Row | zakładka `Leady`, Mapping **Map Automatically**. Options → Cell Format: **Use Format From n8n** |
| 9 | `Historia` | Code | `return $('Przetwórz lead').first().json.historia.map(h => ({ json: h }));` |
| 10 | `Zapisz historię` | Google Sheets → Append Row | zakładka `Historia`, Map Automatically |
| 11 | `Wyślij mail` | Gmail → Send | To `{{ $('Przetwórz lead').first().json.email.to }}`, Subject `{{ $('Przetwórz lead').first().json.email.subject }}`, Email Type **HTML**, Message `{{ $('Przetwórz lead').first().json.email.html }}`. Options: Append n8n Attribution **off**. Settings: **Execute Once: on** (inaczej poleci tyle maili, ile wpisów historii) |
| 12 | `Odpowiedz OK` | Respond to Webhook | Respond With **JSON**, Body `{{ JSON.stringify($('Przetwórz lead').first().json.response) }}` |
| 13 | `Odpowiedz błąd` | Respond to Webhook | Respond With JSON, Response Code **400**, Body `{{ JSON.stringify($json.response) }}` |

Pułapki, które te ustawienia rozwiązują:
- **Execute Once** w węzłach 3–4: bez tego „Pobierz leady” uruchomi się raz na każdego handlowca (6×).
- **Always Output Data**: przy pustym arkuszu Get Rows zwraca 0 elementów i workflow się zatrzymuje.
- **Execute Once** w Gmailu: po „Zapisz historię” płynie kilka elementów.
- CC: w trybie testowym rdzeń przenosi CC do tematu. Na produkcji dodaj w Gmailu Options → CC `{{ $('Przetwórz lead').first().json.email.cc }}` (używane przy możliwym duplikacie).

### Kontrakt webhooka (dla formularza React)

Request `POST {N8N}/webhook/lead`, `Content-Type: application/json`:

```json
{
  "firma": "Instal-Tech Kowalczyk",
  "osoba": "Andrzej Kowalczyk",
  "email": "a.kowalczyk@instaltech.example",
  "telefon": "607 210 530",
  "miasto": "Radom",
  "wojewodztwo": "mazowieckie",
  "zainteresowanie": "pompy ciepła",
  "szac_wartosc_pln": 56000,
  "wiadomosc": "Ponawiam zapytanie",
  "zrodlo": "formularz"
}
```

Wymagane: `firma` lub `osoba` oraz `telefon` (9 cyfr, dowolny format) lub `email`. `wojewodztwo` opcjonalne – brak → ustalane z miasta.

Response 200:

```json
{
  "ok": true,
  "lead_id": "L-041",
  "routing": "handlowiec",
  "przypisano": "Tomasz Wrona",
  "wojewodztwo": "mazowieckie",
  "wojewodztwo_zrodlo": "formularz",
  "duplikat": { "typ": "pewny", "powod": "telefon", "lead_id": "L-007" },
  "telefon_norm": "+48607210530",
  "sla_start": "2026-10-05 09:12"
}
```

Response 400: `{ "ok": false, "errors": ["Podaj poprawny telefon (9 cyfr) lub e-mail."] }`

Jeśli przeglądarka blokuje CORS mimo ustawienia: wysyłaj z React `Content-Type: text/plain` (brak preflightu) – n8n i tak sparsuje JSON do `body`; w razie czego w `Przetwórz lead` dodać `typeof body === 'string' ? JSON.parse(body) : body`.

---

## B. Status z maila (jedno kliknięcie)

Link w mailu: `{STATUS_URL}?lead=L-007&t=<token>&s=dodzwoniono&kto=H1`

```
Webhook ─► Pobierz lead ─► Ustaw status ─► Czy poprawny? ─ true ─► Wiersz do aktualizacji ─► Aktualizuj lead ─► Historia ─► Zapisz historię ─► Pokaż potwierdzenie
                                                         └ false ─► Pokaż błąd
```

| # | Nazwa | Typ | Ustawienia |
|---|---|---|---|
| 1 | `Webhook` | Webhook | Method `GET`, Path `status`, Respond: Using 'Respond to Webhook' Node |
| 2 | `Pobierz lead` | Google Sheets → Get Row(s) | zakładka `Leady`, Filters: column `lead_id` = `{{ $json.query.lead }}`. Settings: **Always Output Data: on** |
| 3 | `Ustaw status` | Code | Run Once for All Items, kod: `n8n/dist/B-ustaw-status.js` |
| 4 | `Czy poprawny?` | If | `{{ $json.ok }}` is true |
| 5 | `Wiersz do aktualizacji` | Code | `return [{ json: $('Ustaw status').first().json.update }];` |
| 6 | `Aktualizuj lead` | Google Sheets → Update Row | zakładka `Leady`, Mapping Map Automatically, **Column to Match On: `lead_id`** |
| 7 | `Historia` | Code | `return $('Ustaw status').first().json.historia.map(h => ({ json: h }));` |
| 8 | `Zapisz historię` | Google Sheets → Append Row | zakładka `Historia` |
| 9 | `Pokaż potwierdzenie` | Respond to Webhook | Respond With **Text**, Body `{{ $('Ustaw status').first().json.html }}`, Options → Response Headers: `Content-Type: text/html; charset=utf-8` |
| 10 | `Pokaż błąd` | Respond to Webhook | jak 9, Response Code 400, Body `{{ $json.html }}` |

`update` zawiera tylko zmieniane kolumny – `pierwszy_kontakt` ustawiany jest tylko raz (pierwsza skuteczna rozmowa), „Nie odebrał” zwiększa licznik `proby`, ale **nie zatrzymuje SLA**.

---

## C. Kontrola SLA co 15 minut

```
Schedule ─► Konfiguracja ─► Pobierz handlowców ─► Pobierz leady ─► Sprawdź SLA ─► Zapisz poziom SLA ─► Historia SLA ─► Zapisz historię ─► Grupuj maile ─► Wyślij mail
```

| # | Nazwa | Typ | Ustawienia |
|---|---|---|---|
| 1 | `Schedule` | Schedule Trigger | Every 15 minutes |
| 2–4 | `Konfiguracja`, `Pobierz handlowców`, `Pobierz leady` | jak w A | Execute Once + Always Output Data |
| 5 | `Sprawdź SLA` | Code | Run Once for All Items, `n8n/dist/C-sprawdz-sla.js`. Pusty wynik (poza godzinami pracy albo nic nowego) kończy przebieg |
| 6 | `Zapisz poziom SLA` | Google Sheets → Update Row | Match on `lead_id`, **Map Each Column Manually**: `lead_id` = `{{ $json.lead_id }}`, `sla_poziom` = `{{ $json.sla_poziom }}`, `aktualizacja` = `{{ $json.aktualizacja }}` |
| 7 | `Historia SLA` | Code | `n8n/dist/C-historia-sla.js` |
| 8 | `Zapisz historię` | Google Sheets → Append Row | zakładka `Historia` |
| 9 | `Grupuj maile` | Code | Run Once for All Items, `n8n/dist/C-grupuj-maile.js` |
| 10 | `Wyślij mail` | Gmail → Send | To `{{ $json.to }}`, Subject `{{ $json.subject }}`, HTML `{{ $json.html }}` (per element, bez Execute Once) |

Reguły (w rdzeniu):
- działa tylko pn–pt 8–16 poza świętami (żadnych maili w nocy i w weekend),
- liczony czas od zgłoszenia w **minutach roboczych**; lead z weekendu startuje w poniedziałek 8:00,
- poziom 1 (4 h) i 2 (1 dzień) → opiekun leada; poziom 3 (2 dni) → **Marek**,
- każdy poziom wysyłany raz (`sla_poziom` w arkuszu), jeden zbiorczy mail na odbiorcę,
- pewne duplikaty pomijane – liczy się lead pierwotny,
- leady `bez_opiekuna` przypominane Markowi, `do_ustalenia` – Ani.

Import historycznych danych ustawia `sla_poziom` na stan z chwili importu, żeby pierwszy przebieg nie wysłał hurtem kilkunastu zaległych przypomnień. Żeby na demo zobaczyć eskalacje: w arkuszu wyzeruj `sla_poziom` kilku leadów i uruchom C ręcznie w godzinach pracy.

---

## Scenariusze testu end-to-end

| # | Wejście (formularz) | Oczekiwany efekt |
|---|---|---|
| 1 | Nowa firma, tel. `700 100 200`, woj. pomorskie | wiersz `L-041`, routing `handlowiec`, mail do Ewy Sowy |
| 2 | Tel. `607-210-530` (Instal-Tech), inna nazwa | `duplikat_of = L-007` (pewny), temat „PONOWIENIE”, przyciski dotyczą L-007 |
| 3 | Tel. `+48604777321` (Ekoterm, był kontakt) | temat „Znany klient pisze ponownie”, info o poprzedniej rozmowie |
| 4 | Woj. podlaskie | routing `bez_opiekuna`, mail do Marka |
| 5 | Bez województwa, miasto Kielce | woj. ustalone z miasta → Katarzyna Lis |
| 6 | Bez telefonu i e-maila | HTTP 400, komunikat w formularzu, nic nie zapisane |
| 7 | Klik „Dodzwoniłem się” w mailu z #1 | status `dodzwoniono`, `pierwszy_kontakt`, strona „Zapisano” |
| 8 | Ponowny klik ze zmienionym tokenem w URL | strona „Nieprawidłowy link” |

---

## Ograniczenia makiety (świadome)

- **Arkusz jako baza:** brak transakcji – dwa zgłoszenia w tej samej sekundzie mogą dostać ten sam `lead_id`. Produkcyjnie: Supabase/PostgreSQL (sekwencja, unikalny indeks na `telefon_norm`).
- **Token w linku** generowany `Math.random()` (węzeł Code bez modułu `crypto` w domyślnej konfiguracji). Wystarcza na makietę; produkcyjnie podpis HMAC.
- **Webhook A bez uwierzytelnienia** – produkcyjnie nagłówek z sekretem (Header Auth w n8n) ustawiony we wtyczce formularza WordPress.
- **Województwo z miasta** to krótka lista miast; produkcyjnie mapowanie kodu pocztowego (baza TERYT/kodów).
- **Mail zamiast WhatsAppa** – zgodnie z briefem.

## Ścieżka do produkcji

| Makieta | Produkcja |
|---|---|
| Formularz React → webhook A | Formularz WordPress (agencja) → ten sam webhook A (wtyczka webhook / CF7 → HTTP POST) |
| — | Maile na `biuro@` → Gmail Trigger (etykieta) → AI wyciąga pola do JSON → ten sam rdzeń, Ania zatwierdza |
| Gmail | WhatsApp Cloud API (węzeł HTTP Request) – wiadomość szablonowa typu *utility* z przyciskami-URL do webhooka B |
| Google Sheets | Supabase (PostgreSQL) + prosty panel; arkusz może zostać jako widok dla biura |
| — | Historia zakupów z Subiekta (eksport nocny / Sfera) dołączana do powiadomienia |
