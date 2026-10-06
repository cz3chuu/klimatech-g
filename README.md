# Klimatech – automatyzacja leadów (makieta)

Makieta systemu, który pilnuje, żeby **każde zapytanie od instalatora trafiło do właściwego handlowca i dostało telefon w ciągu doby roboczej**. Powstała jako zadanie rekrutacyjne na podstawie maila od klienta (Marek, właściciel hurtowni pomp ciepła) i eksportu jego arkusza leadów, a potem została rozbudowana o drugą rundę ustaleń z klientem (regiony wspólne, wyjątki, SLA, nieobecności, zestawienia, Contact Form 7, WhatsApp Business API).

Ten plik jest dla osoby z zespołu, która ma przejąć projekt albo pomóc przy nim bez rozmowy z autorem. Dokumenty obok:

| Dokument | Dla kogo |
|---|---|
| [docs/propozycja-dla-klienta.md](docs/propozycja-dla-klienta.md) | klient: rozwiązanie, koszty, czego od niego potrzebujemy |
| [docs/dla-agencji-cf7.md](docs/dla-agencji-cf7.md) | agencja WWW: jak podpiąć Contact Form 7 |
| [docs/whatsapp-business-api.md](docs/whatsapp-business-api.md) | klient + zespół: kroki w Meta, 5 szablonów do zgłoszenia, jak przełączyć |
| [docs/makiety/](docs/makiety/index.html) | klient: poranne zestawienia do akceptacji (`komplet.html` = wszystko w jednym pliku) |

---

## 1. Problem klienta w pięciu zdaniach

- Sześciu handlowców, każdy ma swoje województwa. Lead ma iść **tylko** do opiekuna regionu (była awantura o prowizje).
- Zapytania przychodzą z formularza WWW (Contact Form 7), maili i telefonów. Ania z biura przepisuje wszystko do jednego arkusza.
- Leady giną: z eksportu wynika, że kontakt dostało **12 z 37** zapytań (32%), a bez kontaktu czeka **~710 tys. zł**. Dwa województwa (lubuskie, podlaskie) nie miały handlowca wcale.
- Ta sama firma pisze drugi raz, bo nikt nie oddzwonił. Zdarzyło się, że zadzwoniły dwie osoby i podały różne ceny.
- Handlowcy **nie czytają maili**, czytają WhatsAppa. Pracują pn–pt 8–16. Marek chce telefonu w ciągu doby roboczej i eskalacji do siebie.

## 2. Co robi makieta

| Potrzeba | Rozwiązanie w makiecie |
|---|---|
| Lead do opiekuna regionu | przydział po województwie; brak województwa → ustalane z miasta; **regiony wspólne** (lubuskie: Bartosz/Michał, podlaskie: Tomasz/Kasia) dzielone po równo; **wyjątki** (Termex z Płocka → Ania); lead **> 50 tys.** = dodatkowe powiadomienie dla Marka |
| Telefony wpisywane po swojemu, te same firmy dwa razy | normalizacja telefonu (`+48XXXXXXXXX`), klucz nazwy firmy, wykrywanie duplikatów: **pewny** (telefon / e-mail) i **możliwy** (nazwa / domena) |
| Klient pisze drugi raz | powiadomienie „⚠ PONOWIENIE – klient czeka”, ten sam opiekun |
| Dwie osoby dzwonią i podają różne ceny | po rozmowie handlowiec odpisuje na WhatsAppie `1 + notatka` (albo klika przycisk); przy kolejnym zgłoszeniu powiadomienie pokazuje **kto rozmawiał, kiedy i co ustalił** |
| Handlowcy czytają WhatsAppa | powiadomienie na WhatsApp + mail jako kopia. Makieta: Green API. Produkcja: **WhatsApp Business API (Meta)** – gotowe, włącza się jednym przełącznikiem |
| Telefon w ciągu doby | terminy w **godzinach pracy** (pn–pt 8–16, święta PL): przypomnienie po 4 h; **doba robocza = do 16:00 następnego dnia roboczego**; eskalacja = do 16:00 drugiego dnia roboczego – bez osobnych maili, w porannych zestawieniach |
| Lead nie może „przeczekać” | **poranny raport** w dni robocze (działa), a obok **nowe zestawienia o 8:00** (handlowiec + Marek) – makiety czekają na akceptację klienta |
| Urlop, L4, odejście handlowca | **nieobecności z zastępcą** (lead i przypomnienia idą do zastępcy, w treści „zastępstwo za …”), **odejście** = data `aktywny_do`, po niej handlowiec znika z przydziału |
| Kto zarządza zespołem | **zakładka Zespół w CRM**: handlowcy, województwa, pokrycie mapy, nieobecności – edycja tylko dla administratora. Zmiany co minutę trafiają do arkusza |
| Formularz na stronie | **Contact Form 7 → webhook z kluczem dostępu**, tłumaczenie domyślnych pól CF7, strona sprawdzająca adres, instrukcja dla agencji |
| Maile i telefony wpisywane przez biuro | zakładka arkusza **„Wpisz lead”** – Ania wpisuje wiersz, system odpisuje w wierszu ✅ / ⚠ / ❌ |
| Szef ma widzieć wszystko | **mini CRM** (Supabase + prosta strona): leady, karta klienta z osią czasu, statystyki handlowców, zespół |

Zgodnie z ustaleniem z PM integracje są „working dummy” na darmowych kontach: formularz n8n zamiast strony WordPress (webhook CF7 jest gotowy), Gmail zamiast poczty klienta, Green API zamiast oficjalnego WhatsApp API (wariant Meta zbudowany i przetestowany przykładowymi zdarzeniami). **Rdzeń logiki działa naprawdę na danych z załącznika.**

---

## 3. Architektura

```
                          ┌──────────────── n8n/src/core.js (rdzeń logiki, testowany) ─────────────────┐
                          │ normalizacja · duplikaty · przydział · zespół · SLA · treści · zestawienia │
                          └────────────────────────────────────┬───────────────────────────────────────┘
                                                               │ (ten sam kod wklejony do węzłów Code)
 Contact Form 7 (WWW) ────┐  POST /webhook/lead?klucz=…        │
 Formularz klienta (n8n) ─┴─► [1] Przyjęcie leada ─────────────┤──► Google Sheets: Leady, Historia, Handlowcy,
                                                               │     Wyjątki, Nieobecności, Wpisz lead
 Zakładka „Wpisz lead” ───┐                                    │          ▲     │                    ▲
 WhatsApp „1 + notatka” ──┴─► [2] Obsługa co minutę ───────────┘          │     ▼ leady, historia    │ zespół, nieobecności
                               (skrzynka, odpowiedzi, SLA, raport)        │  [4] Synchronizacja z CRM ◄──► Supabase ◄──► mini CRM (crm/)
 Przycisk w mailu ───────────► [3] Status z linku (+ strona adresu CF7) ──┤
 Przycisk w WhatsApp (Meta) ─► [5] WhatsApp Business – odbiór ────────────┘
                                                               │
                         WhatsApp (Green API albo Meta) + Gmail do handlowca / zastępcy / Marka / Ani
```

**Podział źródeł prawdy:**
- **Leady i historia** – źródłem jest **arkusz Google** (tak pracuje dziś biuro). Supabase to lustro dla CRM, odświeżane co minutę.
- **Zespół** (handlowcy, województwa, nieobecności, odejścia) – źródłem jest **Supabase**, edytowany w CRM (zakładka Zespół, tylko administrator). Workflow 4 co minutę kopiuje go do zakładek *Handlowcy* i *Nieobecności*, z których czytają workflow 1, 2 i 5. Arkusz zostaje jako kopia i działa dalej, gdyby CRM był niedostępny.

### Pięć workflow – każdy ma jedno zadanie

| # | Workflow | Wyzwalacz | Zadanie |
|---|---|---|---|
| 1 | **Przyjęcie leada** | webhook `POST /webhook/lead` (CF7, z kluczem), formularz `/form/klimatech` | nowe zgłoszenie → rdzeń → arkusz → WhatsApp + mail (+ „duży lead” do Marka) → odpowiedź (JSON albo strona podziękowania) |
| 2 | **Obsługa co minutę** | co 1 min (+ test ręczny) | skrzynka „Wpisz lead” → odpowiedzi handlowców z WhatsAppa (Green API) → SLA (co 15 min) → poranny raport (dni robocze, od 8:00) |
| 3 | **Status z linku w mailu** | `GET /webhook/status?lead=…&t=…&s=…`, `GET /webhook/lead?klucz=…` | klik w przycisk statusu w mailu; osobno strona „✅ Adres formularza działa” do sprawdzenia adresu CF7 w przeglądarce |
| 4 | **Synchronizacja z CRM** | co 1 min | arkusz → Supabase (leady, historia) oraz Supabase → arkusz (zespół, nieobecności). Osobno, żeby awaria CRM nie zatrzymała leadów |
| 5 | **WhatsApp Business (Meta) – odbiór** | `GET/POST /webhook/whatsapp` | weryfikacja webhooka Meta i kliknięcia przycisków w szablonie → status, notatka, potwierdzenie. Potrzebny dopiero po przełączeniu na Meta |

---

## 4. Jak to działa krok po kroku (życie jednego leada)

1. **Zgłoszenie.** Klient wypełnia formularz na stronie (CF7 wysyła JSON na webhook z kluczem) albo formularz n8n, albo Ania wpisuje wiersz w „Wpisz lead”.
2. **Klucz i ujednolicenie.** Webhook bez poprawnego klucza (`?klucz=` albo nagłówek `X-Klimatech-Token`) jest odrzucany. Pola CF7 (`your-name`, `your-tel`, `your-region`…), etykiety formularza albo JSON zamieniają się na jeden kształt danych (`firma, osoba, telefon, email, miasto, wojewodztwo, …`).
3. **Walidacja.** Wymagana firma lub osoba oraz poprawny telefon (9 cyfr, dowolny format) lub e-mail. Błąd → klient widzi „Sprawdź dane w formularzu”, nic nie jest zapisywane.
4. **Powtórka?** Ten sam telefon z tego samego źródła w ciągu 30 min = podwójne kliknięcie. Nie zapisujemy drugi raz.
5. **Duplikat?** Ten sam telefon / e-mail → *pewny* (lead zostaje u opiekuna oryginału), ta sama nazwa firmy / domena → *możliwy* (do potwierdzenia przez biuro, kopia do Ani).
6. **Przydział.** Kolejność: **wyjątek** z zakładki *Wyjątki* (Termex z Płocka → Ania) → **pewny duplikat** → **województwo** → handlowiec z zakładki *Handlowcy*. Województwo u dwóch osób = **region wspólny**: lead dostaje ta, która ma w nim mniej leadów, przy remisie losowo. Handlowcy po dacie `aktywny_do` nie biorą udziału. Nieustalone województwo → Ania.
7. **Nieobecność.** Jeśli opiekun ma w tym dniu nieobecność (zakładka *Nieobecności*), powiadomienie idzie do **zastępcy**, a w arkuszu zapisuje się `zastepstwo_za`. Lead formalnie zostaje u opiekuna regionu (prowizje); po jego powrocie przypomnienia wracają do niego automatycznie.
8. **Zapis.** Nowy wiersz w *Leady* (`lead_id`, `token`, `sla_poziom = 0`) i wpisy w *Historia*.
9. **Powiadomienie.** WhatsApp do opiekuna lub zastępcy (firma, telefon do kliknięcia, wartość, wiadomość, `🆔 L-041`) + mail z przyciskami statusu. Lead powyżej `PROG_LIDER` (50 000 zł) → dodatkowo „💰 Duży lead” do Marka. W trybie testowym wszystko idzie na numer i skrzynkę testową, prawdziwy adresat jest w nagłówku `[TEST → Ewa Sowa]`.
10. **Kontakt.** Handlowiec dzwoni i odpowiada: `1` dodzwoniłem się · `2` nie odebrał · `3` umówione · `4` niezainteresowany, opcjonalnie z notatką. Przy Meta zamiast cyfry klika przycisk pod wiadomością. Status, `pierwszy_kontakt` i notatka trafiają do arkusza, wraca „✅ Zapisano”. Zastępca też może potwierdzać. „Nie odebrał” nie zatrzymuje zegara SLA.
11. **SLA.** Co 15 min w godzinach pracy: > 4 h robocze bez kontaktu → przypomnienie (jedyna osobna wiadomość SLA). **Termin doby** = 16:00 następnego dnia roboczego (pon. 9:00 → wt. 16:00; pt. 17:00 lub sobota → pon. 16:00), **eskalacja** = 16:00 drugiego dnia roboczego. Oba progi zapisują się w `sla_poziom` po cichu – lead pokazuje się rano w zestawieniach.
12. **Rano.** W dzień roboczy od 8:00 każdy handlowiec dostaje listę swoich otwartych leadów, Marek – leady po terminie, eskalacje i regiony bez opiekuna. Lead wraca codziennie, aż ktoś go zamknie (patrz [poranne zestawienia](#poranne-zestawienia)).
13. **CRM.** Co minutę arkusz trafia do Supabase. CRM pokazuje listę, kartę klienta, statystyki i zespół.

### Poranne zestawienia

- **Działa dziś:** poranny raport (`morningReport`) – mail z pełną listą i WhatsApp z 5 najpilniejszymi; kolejność: ponowienia, potem wartość × dni czekania.
- **Do akceptacji klienta:** dwa nowe zestawienia o 8:00 (`zestawieniaPoranne` w rdzeniu, gotowe i testowane):
  - **handlowiec:** „przypomnij dziś” (termin doby mija dziś), nowe od wczoraj, wciąż nieobsłużone, wczoraj obsłużone;
  - **Marek:** KPI dnia (nowe, obsłużone, % w terminie doby), tabela handlowców, nieobecności, eskalacje, leady po terminie, duże leady.
- Makiety generuje ten sam kod na danych z eksportu: `node scripts/makiety-zestawien.mjs` → `docs/makiety/` (Marek, handlowiec, WhatsApp, `komplet.html`). **Po akceptacji:** w glue workflow 2 zamienić wywołanie `morningReport` na `zestawieniaPoranne`, a przy Meta użyć szablonów `klimatech_zestawienie` / `klimatech_zestawienie_zespolu`.

---

## 5. Reguły biznesowe (wszystkie w `n8n/src/core.js`)

| Reguła | Wartość | Gdzie |
|---|---|---|
| Godziny pracy | pn–pt 8:00–16:00, święta PL (Wielkanoc liczona algorytmem, Wigilia od 2025) | `isBusinessDay`, `businessMinutes` |
| Progi SLA | 4 h robocze (`SLA_PROGI`); termin doby i eskalacji z kalendarza dni roboczych | `slaLevelAt`, `terminDoby`, `terminEskalacji`, `dzienRoboczyPo` |
| Start zegara | zgłoszenie po 16:00 lub w weekend → najbliższy dzień roboczy 8:00 | `slaStart` |
| Statusy zamykające SLA | `dodzwoniono`, `umowione`, `niezainteresowany` | `STATUSY_ZAMYKAJACE_SLA` |
| Duplikat pewny / możliwy | telefon, e-mail / nazwa firmy, firmowa domena | `findDuplicate` |
| Region wspólny | to samo województwo u dwóch handlowców → mniej leadów z regionu wygrywa, remis = los | `route` |
| Wyjątki | zakładka *Wyjątki*: `dopasowanie` (firma / telefon / email / domena), `wartosc`, `miasto` (opcjonalnie), `przypisz_do` (ANIA / MAREK / H1…), `opis`; pierwszeństwo przed duplikatem i regionem | `findWyjatek` |
| Lider sprzedaży | lead > `PROG_LIDER` (domyślnie 50 000 zł) → dodatkowe powiadomienie dla Marka | `processInquiry` |
| Nieobecność | `od_dnia`–`do_dnia` włącznie, `zastepca_id`, `anulowana`; powiadomienia, przypomnienia i zestawienia idą do zastępcy, lead zostaje u opiekuna | `nieobecnoscDla`, `zastepcaDla`, `recipientFor` |
| Odejście | `aktywny_do` (data) – po niej handlowiec nie dostaje nowych leadów; region wspólny przechodzi na drugą osobę, pozostałe → Ania | `aktywny`, `parseHandlowcy` |
| Klucz formularza | `WEBHOOK_KLUCZ` z konfiguracji; puste = bez kontroli (tylko lokalnie) | `kluczPoprawny` |
| Pola CF7 | `your-name`, `your-tel`, `your-email`, `your-company`, `your-city`, `your-region`, `zainteresowanie`, `kim-jestes`, `wartosc`, `your-message`, `acceptance-rodo`; pola `_wpcf7…` pomijane | `CF7_POLA`, `zFormularzaStrony` |
| Powtórne wysłanie | ten sam telefon, to samo źródło, ≤ 30 min | `powtorneWyslanie` |
| Województwo z miasta | krótka lista miast (docelowo kod pocztowy / TERYT) | `MIASTA` |
| Odpowiedź WhatsApp | cyfra 1–4, słowa („dodzwoniłem”, „nie odebrał”…), przycisk Meta (payload `L-041\|status`); lead z cytatu `🆔` lub `L-041 1` | `parseWaReply`, `przyciskNaTekst`, `zMeta` |
| Wiadomości Meta | szablon + pola bez nowych linii + 4 przyciski; zwykły tekst tylko w oknie 24 h | `metaBody`, `wrapTestModeWa` |
| Poranny raport | dzień roboczy, pierwszy przebieg od 8:00, raz dziennie; otwarte = `nowy` / `nie_odebral`, bez pewnych duplikatów | `morningReport`, `otwarteLeady` |
| Zestawienia 8:00 (do akceptacji) | handlowiec: przypomnij dziś / nowe / nieobsłużone / wczoraj obsłużone; Marek: KPI, tabela, nieobecności, eskalacje | `zestawieniaPoranne`, `zestawienieHandlowca`, `zestawienieMarka` |

Wartości słownikowe w arkuszu: `routing` = `handlowiec | bez_opiekuna | do_ustalenia`, `duplikat_typ` = `pewny | mozliwy`, `status` = `nowy | nie_odebral | dodzwoniono | umowione | niezainteresowany`, `sla_poziom` = `0–3`.

---

## 6. Struktura repozytorium

```
n8n/src/core.js                 rdzeń logiki – JEDYNE miejsce, gdzie zmienia się reguły
n8n/src/1-…5-*.glue.js          kod konkretnych węzłów Code (krótki, woła funkcje rdzenia)
n8n/dist/*.js                   rdzeń + glue sklejone do wklejenia w n8n (generowane)
n8n/workflows/*.json            gotowe workflow do importu (generowane, wartości przykładowe)
n8n/config.example.json         wzór konfiguracji lokalnej (ID arkusza, poświadczenia, numery, klucze)
scripts/build-n8n.mjs           src -> dist
scripts/build-workflows.mjs     dist + konfiguracja -> workflow JSON (cała definicja węzłów i połączeń)
scripts/import-csv.mjs          eksport arkusza Ani -> pliki do importu (z --raport także docs/raport.md)
scripts/serve-crm.mjs           lokalny serwer strony CRM (+ tryb podglądu /?demo)
scripts/makiety-zestawien.mjs   makiety porannych zestawień -> docs/makiety/
crm/index.html                  mini CRM (jeden plik, supabase-js z CDN): Leady, Handlowcy, Zespół
supabase/schema.sql             tabele, indeksy, RLS (odczyt tylko po zalogowaniu)
supabase/migracja-zespol.sql    zespół w CRM: aktywny_do, nieobecnosci, crm_admini, czy_admin(), polityki zapisu
data/klimatech-*.csv            załączniki od klienta (eksport arkusza, handlowcy – oryginał)
data/handlowcy.csv              aktualne przypisania (regiony wspólne, aktywny_do) – do zakładki Handlowcy
data/wyjatki.csv                reguły wyjątków (Termex -> Ania) – do zakładki Wyjątki
data/nieobecnosci-szablon.csv   nagłówki zakładki Nieobecności
data/leady-import.csv …         wynik importu do zakładek Leady / Historia
data/wpisz-lead-szablon.csv     zakładka „Wpisz lead” z 3 przykładowymi wierszami
test/core.test.mjs              48 testów (node:test, bez zależności)
docs/                           propozycja, instrukcja CF7, WhatsApp Business API, makiety zestawień
```

**Zasada:** kodu w węzłach n8n nie edytuje się ręcznie. Zmieniasz `n8n/src/`, uruchamiasz `npm test` i `npm run build:workflows`, importujesz workflow ponownie. Dzięki temu ta sama logika jest testowana, używana przez import danych, makiety i n8n.

---

## 7. Uruchomienie od zera

Wymagania: Node.js 20+, n8n (testowane na 1.116 w Dockerze, strefa `Europe/Warsaw`), konto Google. Opcjonalnie: Green API (WhatsApp – makieta), Supabase (CRM i zespół), Meta (WhatsApp – produkcja). Zależności npm: brak.

```bash
npm test                    # 48 testów rdzenia na danych z załącznika
npm run import              # (opcjonalnie) przeliczenie historii według aktualnych reguł -> data/*-import.csv
```

### 7.1 Arkusz Google
Nowy arkusz z zakładkami **dokładnie**: `Leady`, `Handlowcy`, `Historia`, `Wpisz lead`, `Wyjątki`, `Nieobecności`. Do każdej: *Plik → Importuj → Prześlij → Zastąp bieżący arkusz*, **odznacz „Konwertuj tekst na liczby, daty i formuły”** (inaczej `+48…` i daty się zepsują):

| Zakładka | Plik |
|---|---|
| Leady | `data/leady-import.csv` |
| Handlowcy | `data/handlowcy.csv` (przy Supabase nadpisywane z CRM co minutę) |
| Wyjątki | `data/wyjatki.csv` |
| Nieobecności | `data/nieobecnosci-szablon.csv` (przy Supabase nadpisywane z CRM) |
| Historia | `data/historia-import.csv` |
| Wpisz lead | `data/wpisz-lead-szablon.csv` |

### 7.2 Poświadczenia w n8n
1. Google Cloud Console: projekt, włączone **Google Sheets API, Gmail API, Google Drive API**, ekran zgody *External* z sobą jako *Test user*, klient OAuth *Web* z redirect `http://localhost:5678/rest/oauth2-credential/callback`.
2. n8n → *Credentials*: **Google Sheets OAuth2 API** i **Gmail OAuth2 API** (ten sam Client ID/Secret, *Sign in with Google*).
3. (CRM) n8n → *Credentials* → **Custom Auth** z JSON `{"headers":{"apikey":"<klucz secret Supabase>"}}`.

### 7.3 Konfiguracja i import workflow
```bash
cp n8n/config.example.json n8n/config.local.json   # uzupełnij – plik jest w .gitignore, sekrety tylko tu
npm run build:workflows                             # -> n8n/workflows.local/*.json
```

Najważniejsze pola `config.local.json` (pełna lista w `config.example.json`):

| Pole | Co to |
|---|---|
| `TRYB_TESTOWY`, `TEST_INBOX`, `TEST_WHATSAPP` | `true` = wszystkie wiadomości idą na skrzynkę i numer testowy |
| `PROG_LIDER` | próg „dużego leada” dla Marka (domyślnie 50000) |
| `WEBHOOK_KLUCZ` | klucz dostępu do adresu formularza CF7 – długi losowy ciąg, przekazywany agencji osobno |
| `WHATSAPP` | `green` (makieta) albo `meta` (WhatsApp Business API) |
| `META_PHONE_ID`, `META_TOKEN`, `META_VERIFY_TOKEN`, `META_API_WERSJA` | dane z Meta (patrz [docs/whatsapp-business-api.md](docs/whatsapp-business-api.md)) |
| `GREEN_API_URL`, `GREEN_ID`, `GREEN_TOKEN`, `GREEN_PHONE` | Green API (makieta) |
| `SUPABASE_URL`, `SUPABASE_PUBLIC_KEY` | CRM |

Import: n8n → *Workflows → Import from File* (5 plików z `n8n/workflows.local/`) → w każdym przełącz **Active**. Albo z CLI w kontenerze:
```bash
docker cp n8n/workflows.local/. n8n:/tmp/kt/ && docker exec n8n n8n import:workflow --separate --input=/tmp/kt
```
Po imporcie z CLI workflow są **nieaktywne** – aktywuj w UI albo `n8n update:workflow --id=… --active=true` i zrestartuj kontener. W Git Bash na Windows przed `docker exec` ustaw `MSYS_NO_PATHCONV=1`.

### 7.4 WhatsApp
- **Makieta (Green API):** darmowa instancja *Developer* na console.green-api.com, zeskanowany QR telefonem „firmowym”, włączone `incomingWebhook` i `outgoingMessageWebhook`. W konfiguracji `GREEN_*` i `TEST_WHATSAPP`. Gdy `TEST_WHATSAPP` = numer instancji, działa tryb „jeden telefon”.
- **Produkcja (Meta):** osobny numer firmy, weryfikacja Meta Business, 5 szablonów *Utility*, token stały. Potem `WHATSAPP = meta`, workflow 5 aktywny, webhook w Meta na `https://<n8n>/webhook/whatsapp`. Krok po kroku: [docs/whatsapp-business-api.md](docs/whatsapp-business-api.md).

### 7.5 Mini CRM i zespół (Supabase)
1. Projekt Supabase (region UE) → *SQL Editor* → uruchom `supabase/schema.sql`, potem `supabase/migracja-zespol.sql`.
2. *Authentication → Sign In / Providers → Email*: do makiety wyłącz *Confirm email*.
3. Załóż konto na ekranie logowania CRM, potem w SQL Editor dodaj je do administratorów: `insert into crm_admini (email) values ('…');` (tylko administrator może edytować zespół i nieobecności).
4. W `config.local.json`: `SUPABASE_URL`, `SUPABASE_PUBLIC_KEY`.
5. `npm run crm` → http://localhost:5180. Podgląd bez Supabase na danych z eksportu: http://localhost:5180/?demo

### 7.6 Contact Form 7 (produkcja)
n8n musi być dostępny z internetu po HTTPS. Agencja instaluje wtyczkę **CF7 to Webhook** i wkleja `https://<n8n>/webhook/lead?klucz=<WEBHOOK_KLUCZ>`. Ten sam adres otwarty w przeglądarce pokazuje „✅ Adres formularza działa” (bez klucza – 403). Instrukcja dla agencji: [docs/dla-agencji-cf7.md](docs/dla-agencji-cf7.md).

---

## 8. Jak przetestować

| Scenariusz | Jak | Oczekiwany efekt |
|---|---|---|
| Nowy lead | formularz `/form/klimatech`, województwo pomorskie | wiersz w *Leady*, WhatsApp + mail `[TEST → Ewa Sowa] NOWY LEAD`, strona „Dziękujemy…” |
| Literówka w numerze | telefon `700 820 91` | strona „Sprawdź dane w formularzu”, nic nie zapisane |
| Podwójne wysłanie | ten sam formularz drugi raz w ciągu 30 min | „To zgłoszenie już do nas dotarło”, brak drugiego leada |
| Ponowienie | telefon `607-210-530` (Instal-Tech z eksportu) | duplikat pewny `L-007`, „⚠ PONOWIENIE”, opiekun Tomasz Wrona |
| Znany klient | telefon `+48604777321` (Ekoterm, był kontakt) | „♻️ ZNANY KLIENT”, kto rozmawiał i ostatnia notatka |
| Region wspólny | miasto Gorzów Wielkopolski, bez województwa | lubuskie z miasta → Bartosz albo Michał (kto ma mniej leadów z lubuskiego) |
| Wyjątek | firma `Termex`, miasto Płock | „Lead z wyjątku” → Ania (`a.kos@klimatech.example`) |
| Duży lead | wartość 60 000 zł | zwykłe powiadomienie do handlowca + „💰 Duży lead” do Marka |
| Nieobecność | CRM → Zespół → nieobecność Tomasza obejmująca dziś, zastępca Kasia; lead z mazowieckiego | po synchronizacji (≤ 1 min): powiadomienie do Kasi „zastępstwo za Tomasz Wrona”, w arkuszu `zastepstwo_za = H1` |
| Odejście | CRM → Zespół → Edytuj Michała → `aktywny_do` w przeszłości; lead z lubuskiego | zawsze Bartosz |
| CF7 – adres | `GET /webhook/lead?klucz=<klucz>` w przeglądarce / bez klucza | „✅ Adres formularza działa” (200) / „Brak dostępu” (403) |
| CF7 – zgłoszenie | `POST /webhook/lead?klucz=<klucz>` z JSON jak w [docs/dla-agencji-cf7.md](docs/dla-agencji-cf7.md) | `{ ok: true, lead_id, przypisano, … }`; bez klucza albo ze złym – `{ ok: false }`, nic nie zapisane |
| Wpis biura | wiersz w „Wpisz lead” | po ≤ 1 min kolumna `wynik`: `✅ L-0xx → …` / `⚠ ponowienie` / `❌ popraw` |
| Kontakt z WhatsAppa | odpowiedz na wiadomość z leadem: `1 wysłałem cennik` | po ≤ 1 min „✅ Zapisano…📝”, status, `pierwszy_kontakt`, notatka |
| Meta – weryfikacja | `GET /webhook/whatsapp?hub.mode=subscribe&hub.verify_token=<token>&hub.challenge=123` | `123` (200); zły token → 403 |
| Meta – przycisk | `POST /webhook/whatsapp` z przykładowym zdarzeniem Meta (przycisk z payloadem `L-041\|dodzwoniono`) | status leada w arkuszu, wpis w historii, potwierdzenie |
| SLA | w workflow 2 → *Konfiguracja* → `TERAZ` = godzina pracy, ≥ 4 h robocze po zgłoszeniu → *Test ręczny* | przypomnienie 4 h (potem wyczyść `TERAZ`) |
| Poranny raport | w workflow 2 → *Konfiguracja* → `RAPORT_TERAZ = true` → *Test ręczny* | mail i WhatsApp do każdego handlowca i do Marka (potem wyczyść) |
| Makiety zestawień | `node scripts/makiety-zestawien.mjs` | `docs/makiety/*.html` odświeżone z danych eksportu |
| CRM | `npm run crm` | nowy lead na górze listy, karta z osią czasu, zakładka Zespół |

Przed demo: ponownie zaimportuj CSV do zakładek *Leady* i *Historia* (czyści testowe leady); CRM wyczyści się sam w ciągu minuty.

---

## 9. Najważniejsze decyzje i dlaczego

- **Arkusz zostaje bazą leadów.** Biuro i Marek go znają; Pipedrive przepadł, bo „za dużo klikania”.
- **Zespół w Supabase/CRM, arkusz jako kopia.** Zmiany zespołu (urlop, L4, odejście, nowe województwo) to rzecz dla administratora, nie dla biura – potrzebne są uprawnienia i historia. Workflow dalej czytają z arkusza, więc awaria CRM niczego nie zatrzymuje.
- **Zastępca dostaje powiadomienia, lead zostaje u opiekuna.** Prowizje i historia klienta się nie mieszają, a po powrocie nic nie trzeba przepisywać.
- **Handlowcy pracują tylko w WhatsAppie.** Jedna cyfra albo jeden przycisk – warunek Marka „nic, co ich spowolni”.
- **Mail zamiast WhatsAppa dla Marka i Ani** (kopia), bo siedzą przy komputerze; przyciski statusu w mailu działają przez workflow 3.
- **Jeden rdzeń, wiele wejść.** CF7, formularz, wpis biura, Green API i Meta przechodzą przez te same funkcje – logika testowana bez n8n.
- **Doba i eskalacja bez osobnych maili.** Jedno poranne zestawienie zamiast lawiny pojedynczych alarmów; osobno tylko przypomnienie po 4 h.
- **Klucz w adresie formularza, nie tylko w nagłówku.** Nie każda wtyczka CF7 umie ustawić nagłówek, a adres z kluczem da się sprawdzić w przeglądarce.
- **Import historii ustawia `sla_poziom` na stan z dnia importu**, żeby pierwszy przebieg nie wysłał kilkunastu przypomnień naraz. Zaległości zbiera poranny raport.

## 10. Znane ograniczenia makiety (świadome)

| Ograniczenie | Produkcyjnie |
|---|---|
| Arkusz jako baza leadów: brak transakcji, dwa zgłoszenia w tej samej sekundzie mogą dostać ten sam `lead_id` | Supabase jako źródło prawdy (sekwencja, unikalny indeks na `telefon_norm`) |
| Green API – nieoficjalne (ryzyko blokady numeru) | WhatsApp Business API – zbudowane, czeka na numer i weryfikację klienta |
| n8n lokalnie – CF7 i Meta nie mają jak się połączyć z internetu | serwer z HTTPS (VPS albo n8n Cloud) |
| Klucz formularza stały, w adresie | zmiana klucza przy zmianie agencji; ewentualnie podpis HMAC, jeśli wtyczka go obsługuje |
| Token w linkach statusu z `Math.random()` | podpis HMAC |
| Odejście handlowca nie przepisuje jego otwartych leadów | przy `aktywny_do` – lista otwartych leadów do przepisania dla Marka |
| Paski SLA w CRM pokazują stare progi | przeliczenie według `terminDoby` / `terminEskalacji` |
| Województwo z krótkiej listy miast | kod pocztowy → TERYT |
| Odpowiedzi Green API pobierane co minutę (polling) | Meta wysyła zdarzenia od razu (workflow 5) |
| n8n: dwa formularze nie mogą dzielić ścieżki, „Respond to Webhook” nie działa obok formularza n8n | webhook odsyła JSON z ostatniego węzła (kod HTTP zawsze 200, sukces w polu `ok`) |
| Pamięć obsłużonych wiadomości (`staticData`) zapisuje się tylko w przebiegach aktywnego workflow | przy teście ręcznym te same wiadomości mogą zostać obsłużone ponownie |

## 11. Co dalej

Kolejność wg wartości dla klienta (szczegóły i koszty w [propozycji](docs/propozycja-dla-klienta.md)):

1. **Wdrożenie produkcyjne:** n8n na serwerze z HTTPS, agencja podpina CF7 (adres + klucz), prawdziwe numery handlowców w CRM, `TRYB_TESTOWY = false`.
2. **WhatsApp Business API:** klient rejestruje numer i szablony, my przełączamy `WHATSAPP = meta`.
3. **Zestawienia 8:00** po akceptacji makiet – podłączenie w workflow 2.
4. **Odejście Michała (30.11):** `aktywny_do` w CRM, przepisanie jego otwartych leadów, decyzja o lubuskim.
5. **Maile na biuro@ → „Wpisz lead”**: Gmail Trigger + model AI wyciąga pola, Ania zatwierdza. Mechanizm `akcja/wynik` już działa.
6. **Supabase jako źródło prawdy dla leadów**, arkusz jako widok dla biura; edycja statusów w CRM.
7. **Historia zakupów z Subiekta** w powiadomieniu – nocny eksport lub Sfera.
8. Telefony: nagrywanie i transkrypcja rozmów (wymaga centrali VoIP i zgody rozmówcy).
