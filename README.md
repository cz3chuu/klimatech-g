# Klimatech – automatyzacja leadów (makieta)

Makieta systemu, który pilnuje, żeby **każde zapytanie od instalatora trafiło do właściwego handlowca i dostało telefon w ciągu doby roboczej**. Powstała jako zadanie rekrutacyjne na podstawie maila od klienta (Marek, właściciel hurtowni pomp ciepła) i eksportu jego arkusza leadów.

Ten plik jest dla osoby z zespołu, która ma przejąć projekt albo pomóc przy nim bez rozmowy z autorem. Propozycja dla klienta (koszty, czego od niego potrzebujemy): [docs/propozycja-dla-klienta.md](docs/propozycja-dla-klienta.md). Liczby z danych klienta są w propozycji (sekcja 1); pełne zestawienie generuje `npm run import`.

---

## 1. Problem klienta w pięciu zdaniach

- Sześciu handlowców, każdy ma swoje województwa. Lead ma iść **tylko** do opiekuna regionu (była awantura o prowizje).
- Zapytania przychodzą z formularza WWW, maili i telefonów. Ania z biura przepisuje wszystko do jednego arkusza.
- Leady giną: z eksportu wynika, że kontakt dostało **12 z 37** zapytań (32%), a bez kontaktu czeka **~710 tys. zł**. Dwa województwa (lubuskie, podlaskie) nie mają handlowca wcale.
- Ta sama firma pisze drugi raz, bo nikt nie oddzwonił. Zdarzyło się, że zadzwoniły dwie osoby i podały różne ceny.
- Handlowcy **nie czytają maili**, czytają WhatsAppa. Pracują pn–pt 8–16. Marek chce telefonu w ciągu doby roboczej i eskalacji do siebie po dwóch dniach.

## 2. Co robi makieta

| Potrzeba | Rozwiązanie w makiecie |
|---|---|
| Lead do opiekuna regionu | przydział po województwie; brak województwa → ustalane z miasta; region bez handlowca → Marek |
| Telefony wpisywane po swojemu, te same firmy dwa razy | normalizacja telefonu (`+48XXXXXXXXX`), klucz nazwy firmy, wykrywanie duplikatów: **pewny** (telefon / e-mail) i **możliwy** (nazwa / domena) |
| Klient pisze drugi raz | powiadomienie „⚠ PONOWIENIE – klient czeka”, ten sam opiekun |
| Dwie osoby dzwonią i podają różne ceny | po rozmowie handlowiec odpisuje na WhatsAppie `1 + notatka`; przy kolejnym zgłoszeniu tego klienta powiadomienie pokazuje **kto rozmawiał, kiedy i co ustalił** |
| Handlowcy czytają WhatsAppa | krótkie powiadomienie na WhatsApp (Green API) + mail jako kopia |
| Telefon w ciągu doby, eskalacja po 2 dniach | SLA liczone w **minutach roboczych** (pn–pt 8–16, święta PL): przypomnienie po 4 h, „po SLA” po 1 dniu, eskalacja do Marka po 2 dniach |
| Lead nie może „przeczekać” – także zaległy z importu albo zignorowany po eskalacji | **poranny raport** w dni robocze: każdy dostaje listę swoich otwartych leadów, Marek wszystko po SLA i regiony bez handlowca – codziennie, aż lead zostanie zamknięty |
| Maile i telefony wpisywane przez biuro | zakładka arkusza **„Wpisz lead”** – Ania wpisuje wiersz, system odpisuje w wierszu ✅ / ⚠ / ❌ |
| Szef ma widzieć wszystko | **mini CRM** (Supabase + prosta strona): lista leadów, karta klienta z osią czasu „kto, co, kiedy”, statystyki handlowców |

Zgodnie z ustaleniem z PM integracje są „working dummy” na darmowych kontach: formularz n8n zamiast strony WordPress, Gmail zamiast poczty klienta, Green API (darmowy plan) zamiast oficjalnego WhatsApp API. **Rdzeń logiki działa naprawdę na danych z załącznika.**

---

## 3. Architektura

```
                          ┌──────────────── n8n/src/core.js (rdzeń logiki, testowany) ────────────────┐
                          │ normalizacja · duplikaty · przydział · SLA · treści maili/WhatsApp · CRM │
                          └────────────────────────────────────┬──────────────────────────────────────┘
                                                               │ (ten sam kod wklejony do węzłów Code)
 Formularz klienta (n8n) ─┐                                    │
 Webhook /webhook/lead ───┴─► [1] Przyjęcie leada ─────────────┤──► Google Sheets: Leady, Historia, Handlowcy
   (docelowo WordPress)                                        │          ▲            │
                                                               │          │            ▼
 Zakładka „Wpisz lead” ───┐                                    │          │     [4] Synchronizacja z CRM ──► Supabase ──► mini CRM (crm/)
 WhatsApp „1 + notatka” ──┴─► [2] Obsługa co minutę ───────────┘          │
                               (skrzynka, odpowiedzi, SLA, raport)        │
 Przycisk w mailu ───────────► [3] Status z linku ────────────────────────┘
                                                               │
                                     WhatsApp (Green API) + Gmail do handlowca / Marka / Ani
```

**Źródłem prawdy jest arkusz Google** (tak pracuje dziś biuro). Supabase to kopia dla CRM, odświeżana co minutę. Docelowo role się odwracają – patrz [Co dalej](#11-co-dalej).

### Cztery workflow – każdy ma jedno zadanie

| # | Workflow | Wyzwalacz | Zadanie |
|---|---|---|---|
| 1 | **Przyjęcie leada** | webhook `POST /webhook/lead`, formularz `/form/klimatech` | nowe zgłoszenie → rdzeń → arkusz → WhatsApp + mail → odpowiedź (JSON dla strony albo strona podziękowania) |
| 2 | **Obsługa co minutę** | co 1 min (+ test ręczny) | skrzynka „Wpisz lead” → odpowiedzi handlowców z WhatsAppa → SLA i eskalacje (co 15 min) → poranny raport (dni robocze, od 8:00) |
| 3 | **Status z linku w mailu** | `GET /webhook/status?lead=…&t=…&s=…` | klik w przycisk statusu w mailu (Marek, Ania przy komputerze) |
| 4 | **Synchronizacja z CRM** | co 1 min | arkusz → Supabase (lustro). Osobno, żeby awaria CRM nie zatrzymała leadów |

---

## 4. Jak to działa krok po kroku (życie jednego leada)

1. **Zgłoszenie.** Klient wypełnia formularz (albo strona wysyła JSON na webhook, albo Ania wpisuje wiersz w „Wpisz lead”).
2. **Ujednolicenie.** Węzeł *Zgłoszenie* zamienia etykiety formularza / JSON na jeden kształt danych (`firma, osoba, telefon, email, miasto, wojewodztwo, …`).
3. **Walidacja.** Wymagana firma lub osoba oraz poprawny telefon (9 cyfr, dowolny format) lub e-mail. Błąd → klient widzi „Sprawdź dane w formularzu”, nic nie jest zapisywane.
4. **Powtórka?** Ten sam telefon z tego samego źródła w ciągu 30 min = podwójne kliknięcie. Nie zapisujemy drugi raz, klient widzi „To zgłoszenie już do nas dotarło”.
5. **Duplikat?** Szukamy w arkuszu: ten sam telefon / e-mail → *pewny* (lead zostaje u opiekuna oryginału), ta sama nazwa firmy / domena → *możliwy* (do potwierdzenia przez biuro, kopia do Ani).
6. **Przydział.** Województwo z formularza, a gdy brak – z miasta. Województwo → handlowiec z zakładki *Handlowcy*. Bez handlowca → Marek. Nieustalone → Ania.
7. **Zapis.** Nowy wiersz w *Leady* (z `lead_id`, `token` do linków, `sla_poziom = 0`) i wpisy w *Historia* (`utworzono`, `przypisano`, `powiadomienie`, kto, skąd, zgoda RODO).
8. **Powiadomienie.** WhatsApp do opiekuna (krótko: firma, telefon do kliknięcia, wartość, wiadomość, `🆔 L-041`, instrukcja odpowiedzi) + mail z przyciskami statusu. W trybie testowym wszystko idzie na numer i skrzynkę testową, a prawdziwy adresat jest w nagłówku `[TEST → Ewa Sowa]`.
9. **Kontakt.** Handlowiec dzwoni i odpowiada na wiadomość: `1` dodzwoniłem się · `2` nie odebrał · `3` umówione · `4` niezainteresowany, opcjonalnie z notatką (`1 chce ofertę na 10 szt.`). Workflow 2 co minutę pobiera wiadomości, rozpoznaje leada po `🆔` z cytowanej wiadomości, zapisuje status, `pierwszy_kontakt`, notatkę i odsyła „✅ Zapisano”. „Nie odebrał” nie zatrzymuje zegara SLA.
10. **SLA.** Co 15 min w godzinach pracy: lead bez kontaktu > 4 h → przypomnienie do opiekuna, > 1 dzień → „po SLA”, > 2 dni → **eskalacja do Marka**. Każdy poziom wysyłany raz, jedna zbiorcza wiadomość na odbiorcę. Lead z weekendu startuje w poniedziałek 8:00.
11. **Poranny raport.** W dzień roboczy, przy pierwszym przebiegu od 8:00: handlowiec dostaje mail (pełna lista z przyciskami statusu) i WhatsApp (5 najpilniejszych) ze **wszystkimi swoimi otwartymi leadami** (nowe i „nie odebrał”), Marek – wszystko po SLA oraz leady z regionów bez handlowca, Ania – leady do przypisania. Kolejność: najpierw **ponowienia** (klient pisał drugi raz), potem **wartość × dni robocze czekania**. Lead wraca w raporcie codziennie, aż ktoś go zamknie – dzięki temu nie ginie ani zaległość z importu (jej `sla_poziom` jest ustawiony na dzień importu, więc progi jej nie „obudzą”), ani lead zignorowany po eskalacji (poziom 3 to ostatnie powiadomienie progowe).
12. **CRM.** Co minutę arkusz trafia do Supabase. Strona CRM pokazuje listę, kartę klienta (wszystkie zgłoszenia, ostatnie ustalenia, oś czasu) i statystyki handlowców.

---

## 5. Reguły biznesowe (wszystkie w `n8n/src/core.js`)

| Reguła | Wartość | Gdzie |
|---|---|---|
| Godziny pracy | pn–pt 8:00–16:00, święta PL (z Wielkanocą liczoną algorytmem, Wigilia od 2025) | `isBusinessDay`, `businessMinutes` |
| Progi SLA | 240 / 480 / 960 minut roboczych | `SLA_PROGI` |
| Start zegara | zgłoszenie po 16:00 lub w weekend → najbliższy dzień roboczy 8:00 | `slaStart` |
| Statusy zamykające SLA | `dodzwoniono`, `umowione`, `niezainteresowany` | `STATUSY_ZAMYKAJACE_SLA` |
| Duplikat pewny / możliwy | telefon, e-mail / nazwa firmy, firmowa domena | `findDuplicate` |
| Powtórne wysłanie | ten sam telefon, to samo źródło, ≤ 30 min | `powtorneWyslanie` |
| Województwo z miasta | krótka lista miast (docelowo kod pocztowy / TERYT) | `MIASTA` |
| Odpowiedź WhatsApp | cyfra 1–4 lub słowa („dodzwoniłem”, „nie odebrał”…), lead z cytatu `🆔` lub `L-041 1` | `parseWaReply` |
| Poranny raport | dzień roboczy, pierwszy przebieg od 8:00, raz dziennie (data w pamięci workflow); otwarte = `nowy` / `nie_odebral`, bez pewnych duplikatów; Marek dostaje leady ≥ 1 dzień roboczy | `morningReport`, `otwarteLeady` |
| Kolejność w raporcie | ponowienia → wartość × max(1, dni robocze czekania) → czas czekania | `otwarteLeady` |

Wartości słownikowe w arkuszu: `routing` = `handlowiec | bez_opiekuna | do_ustalenia`, `duplikat_typ` = `pewny | mozliwy`, `status` = `nowy | nie_odebral | dodzwoniono | umowione | niezainteresowany`, `sla_poziom` = `0–3`.

---

## 6. Struktura repozytorium

```
n8n/src/core.js                 rdzeń logiki – JEDYNE miejsce, gdzie zmienia się reguły
n8n/src/1-…4-*.glue.js          kod konkretnych węzłów Code (krótki, woła funkcje rdzenia)
n8n/dist/*.js                   rdzeń + glue sklejone do wklejenia w n8n (generowane)
n8n/workflows/*.json            gotowe workflow do importu (generowane, wartości przykładowe)
n8n/config.example.json         wzór konfiguracji lokalnej (ID arkusza, poświadczenia, numery)
scripts/build-n8n.mjs           src -> dist
scripts/build-workflows.mjs     dist + konfiguracja -> workflow JSON (cała definicja węzłów i połączeń)
scripts/import-csv.mjs          eksport arkusza Ani -> pliki do importu + docs/raport.md
scripts/serve-crm.mjs           lokalny serwer strony CRM (+ tryb podglądu /?demo)
crm/index.html                  mini CRM (jeden plik, supabase-js z CDN)
supabase/schema.sql             tabele, indeksy, RLS (odczyt tylko po zalogowaniu)
data/klimatech-*.csv            załączniki od klienta (eksport arkusza, handlowcy)
data/leady-import.csv …         wynik importu do zakładek Leady / Historia
data/wpisz-lead-szablon.csv     zakładka „Wpisz lead” z 3 przykładowymi wierszami
test/core.test.mjs              35 testów (node:test, bez zależności)
docs/                           raport z danych, propozycja dla klienta
```

**Zasada:** kodu w węzłach n8n nie edytuje się ręcznie. Zmieniasz `n8n/src/`, uruchamiasz `npm test` i `npm run build:workflows`, importujesz workflow ponownie. Dzięki temu ta sama logika jest testowana, używana przez import danych i przez n8n.

---

## 7. Uruchomienie od zera

Wymagania: Node.js 20+, n8n (testowane na 1.116 w Dockerze, strefa `Europe/Warsaw`), konto Google. Opcjonalnie: Green API (WhatsApp), Supabase (CRM). Zależności npm: brak.

```bash
npm test                    # 35 testów rdzenia na danych z załącznika
npm run import              # (opcjonalnie) ponowne wygenerowanie data/*-import.csv i docs/raport.md
```

### 7.1 Arkusz Google
Nowy arkusz z zakładkami **dokładnie**: `Leady`, `Handlowcy`, `Historia`, `Wpisz lead`. Do każdej: *Plik → Importuj → Prześlij → Zastąp bieżący arkusz*, **odznacz „Konwertuj tekst na liczby, daty i formuły”** (inaczej `+48…` i daty się zepsują):

| Zakładka | Plik |
|---|---|
| Leady | `data/leady-import.csv` |
| Handlowcy | `data/klimatech-handlowcy.csv` (opcjonalna kolumna `whatsapp` z numerami handlowców) |
| Historia | `data/historia-import.csv` |
| Wpisz lead | `data/wpisz-lead-szablon.csv` |

### 7.2 Poświadczenia w n8n
1. Google Cloud Console: projekt, włączone **Google Sheets API, Gmail API, Google Drive API**, ekran zgody *External* z sobą jako *Test user*, klient OAuth *Web* z redirect `http://localhost:5678/rest/oauth2-credential/callback`.
2. n8n → *Credentials*: **Google Sheets OAuth2 API** i **Gmail OAuth2 API** (ten sam Client ID/Secret, *Sign in with Google*).
3. (CRM) n8n → *Credentials* → **Custom Auth** z JSON `{"headers":{"apikey":"<klucz secret Supabase>"}}`.

### 7.3 Konfiguracja i import workflow
```bash
cp n8n/config.example.json n8n/config.local.json   # uzupełnij ID arkusza, ID poświadczeń, numery
npm run build:workflows                             # -> n8n/workflows.local/*.json
```
Import: n8n → *Workflows → Import from File* (4 pliki z `n8n/workflows.local/`) → w każdym przełącz **Active**. Albo z CLI w kontenerze:
```bash
docker cp n8n/workflows.local/. n8n:/tmp/kt/ && docker exec n8n n8n import:workflow --separate --input=/tmp/kt
```
Po imporcie z CLI workflow są **nieaktywne** – aktywuj w UI albo `n8n update:workflow --id=… --active=true` i zrestartuj kontener. W Git Bash na Windows przed `docker exec` ustaw `MSYS_NO_PATHCONV=1`.

### 7.4 WhatsApp (Green API, opcjonalnie)
Darmowa instancja *Developer* na console.green-api.com, zeskanowany QR telefonem „firmowym”, w ustawieniach włączone `incomingWebhook` i `outgoingMessageWebhook`. W konfiguracji `GREEN_*` i `TEST_WHATSAPP`. Gdy `TEST_WHATSAPP` = numer instancji, działa tryb „jeden telefon” (odpowiedzi w czacie „Ty”).

### 7.5 Mini CRM (Supabase, opcjonalnie)
1. Projekt Supabase (region UE) → *SQL Editor* → uruchom `supabase/schema.sql`.
2. *Authentication → Sign In / Providers → Email*: do makiety wyłącz *Confirm email*.
3. W `config.local.json`: `SUPABASE_URL`, `SUPABASE_PUBLIC_KEY`.
4. `npm run crm` → http://localhost:5180 (załóż konto na ekranie logowania). Podgląd bez Supabase na danych z eksportu: http://localhost:5180/?demo

---

## 8. Jak przetestować

| Scenariusz | Jak | Oczekiwany efekt |
|---|---|---|
| Nowy lead | formularz `/form/klimatech`, województwo pomorskie | wiersz w *Leady*, WhatsApp + mail `[TEST → Ewa Sowa] NOWY LEAD`, strona „Dziękujemy…, oddzwonimy na numer …” |
| Literówka w numerze | telefon `700 820 91` | strona „Sprawdź dane w formularzu”, nic nie zapisane |
| Podwójne wysłanie | ten sam formularz drugi raz w ciągu 30 min | „To zgłoszenie już do nas dotarło”, brak drugiego leada i powiadomienia |
| Ponowienie | telefon `607-210-530` (Instal-Tech z eksportu) | duplikat pewny `L-007`, „⚠ PONOWIENIE”, opiekun Tomasz Wrona |
| Znany klient | telefon `+48604777321` (Ekoterm, był kontakt) | „♻️ ZNANY KLIENT”, kto rozmawiał i ostatnia notatka |
| Region bez handlowca | miasto Zielona Góra, bez województwa | lubuskie z miasta → Marek |
| Webhook strony | `POST /webhook/lead` z JSON (pola jak w arkuszu) | JSON `{ ok, lead_id, routing, przypisano, duplikat, sla_start }` |
| Wpis biura | wiersz w „Wpisz lead” | po ≤ 1 min kolumna `wynik`: `✅ L-0xx → …` / `⚠ ponowienie` / `❌ popraw` |
| Kontakt z WhatsAppa | odpowiedz na wiadomość z leadem: `1 wysłałem cennik` | po ≤ 1 min „✅ Zapisano…📝”, w arkuszu status, `pierwszy_kontakt`, notatka |
| SLA poza godzinami | w workflow 2 → *Konfiguracja* → `TERAZ = 2026-10-05 10:00` → *Test ręczny* | przypomnienia i eskalacje do Marka (potem wyczyść `TERAZ`) |
| Poranny raport | w workflow 2 → *Konfiguracja* → `RAPORT_TERAZ = true` (i ewentualnie `TERAZ` w godzinach pracy) → *Test ręczny* | mail i WhatsApp `Poranny raport: …` do każdego handlowca i do Marka; normalnie raz dziennie od 8:00 (potem wyczyść pola) |
| CRM | `npm run crm` | nowy lead na górze listy, karta z osią czasu |

Przed demo: ponownie zaimportuj CSV do arkusza (czyści testowe leady); CRM wyczyści się sam w ciągu minuty.

---

## 9. Najważniejsze decyzje i dlaczego

- **Arkusz zostaje bazą makiety.** Biuro i Marek go znają; Pipedrive przepadł, bo „za dużo klikania”. Supabase jest pokazany jako kierunek (CRM już działa na kopii danych).
- **Handlowcy pracują tylko w WhatsAppie.** Jedna cyfra jako odpowiedź, żadnej nowej aplikacji – warunek Marka „nic, co ich spowolni”.
- **Mail zamiast WhatsAppa dla Marka i Ani** (kopia), bo siedzą przy komputerze; przyciski statusu w mailu działają przez workflow 3.
- **Jeden rdzeń, wiele wejść.** Formularz, webhook i wpis biura przechodzą przez tę samą funkcję – duplikaty i przydział działają identycznie, logika jest testowana bez n8n.
- **Biuro wpisuje do zakładki „Wpisz lead”, nie do „Leady”.** Wiersz wpisany wprost do *Leady* ominąłby duplikaty, przydział i powiadomienie.
- **CRM osobno od leadów.** Awaria Supabase nie może zatrzymać przypomnień SLA.
- **Import historii ustawia `sla_poziom` na stan z dnia importu**, żeby pierwszy przebieg nie wysłał kilkunastu zaległych przypomnień naraz. Zaległości nie giną: zbiera je **poranny raport** – jedno zestawienie zamiast lawiny pojedynczych maili.

## 10. Znane ograniczenia makiety (świadome)

| Ograniczenie | Produkcyjnie |
|---|---|
| Arkusz jako baza: brak transakcji, dwa zgłoszenia w tej samej sekundzie mogą dostać ten sam `lead_id` | Supabase jako źródło prawdy (sekwencja, unikalny indeks na `telefon_norm`) |
| Green API – nieoficjalne (ryzyko blokady numeru, dane przez zewnętrzną firmę) | oficjalne WhatsApp Cloud API, szablony *utility* |
| Webhook bez uwierzytelnienia | Header Auth z sekretem ustawionym we wtyczce WordPress |
| Token w linkach z `Math.random()` | podpis HMAC |
| CRM: otwarta rejestracja, tylko odczyt | konta na zaproszenie, edycja notatek/statusów z panelu |
| Województwo z krótkiej listy miast | kod pocztowy → TERYT |
| Odpowiedzi WhatsApp pobierane co minutę (polling) | webhook Green API / Meta (natychmiast, mniej wykonań) |
| n8n: dwa formularze n8n nie mogą dzielić jednej ścieżki (strona końcowa szuka „swojego” formularza), „Respond to Webhook” nie działa obok formularza n8n | dlatego webhook odsyła JSON z ostatniego węzła (kod HTTP zawsze 200, sukces w polu `ok`) |
| Pamięć obsłużonych wiadomości WhatsApp (`staticData`) zapisuje się tylko w przebiegach aktywnego workflow | przy teście ręcznym te same wiadomości mogą zostać obsłużone ponownie |

## 11. Co dalej

Kolejność wg wartości dla klienta (szczegóły i koszty w [propozycji](docs/propozycja-dla-klienta.md)):

1. **Wdrożenie produkcyjne:** n8n na serwerze z HTTPS, formularz WordPress → webhook (wtyczka agencji), prawdziwe numery handlowców, decyzja Marka o lubuskim i podlaskim.
2. **WhatsApp Cloud API** zamiast Green API: numer firmowy, weryfikacja Meta Business, szablon *utility* z przyciskami szybkiej odpowiedzi (zamiast wpisywania cyfry).
3. **Maile na biuro@ → skrzynka „Wpisz lead”**: Gmail Trigger + model AI (np. Claude Haiku) wyciąga pola, wiersz z `akcja = SPRAWDŹ`, Ania zatwierdza. Mechanizm `akcja/wynik` już działa.
4. **Supabase jako źródło prawdy**, arkusz jako widok dla biura; edycja w CRM (status, notatka, zmiana opiekuna).
5. **Historia zakupów z Subiekta** w powiadomieniu („klient kupił u nas 3 pompy w 2025”) – nocny eksport lub Sfera.
6. **Raport tygodniowy dla Marka** (czas reakcji, leady po SLA, wartość czekających) – workflow + mail w poniedziałek rano.
7. Telefony: nagrywanie i transkrypcja rozmów → wiersz do zatwierdzenia (wymaga centrali VoIP i zgody rozmówcy).
