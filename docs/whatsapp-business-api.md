# WhatsApp Business API (Meta) – przygotowanie do wpięcia numeru firmy

**Stan:** gotowe do włączenia. Wysyłka, odbiór kliknięć i szablony są zbudowane i przetestowane na przykładowych wiadomościach w formacie Meta. Do uruchomienia brakuje tylko danych od klienta (numer zarejestrowany w Meta, zatwierdzone szablony, token). Do tego czasu makieta działa przez Green API.

## Dlaczego oficjalne API, a nie Green API

| | Green API (makieta) | WhatsApp Business API (produkcja) |
|---|---|---|
| Status | nieoficjalne – podpina zwykłe konto jak WhatsApp Web | oficjalne API Meta |
| Ryzyko | blokada numeru, dane przez zewnętrzną firmę | brak |
| Wiadomości z inicjatywy firmy | dowolny tekst | **tylko zatwierdzone szablony** (pola `{{1}}`, `{{2}}`…) |
| Odpowiedź handlowca | wpisuje cyfrę 1–4 | **klika przycisk** (Dodzwoniłem się / Nie odebrał / Umówione / Niezainteresowany) |
| Zwykły tekst | zawsze | tylko w ciągu 24 h od wiadomości odbiorcy – np. nasze „✅ Zapisano” |

## Kroki po stronie klienta

1. **Konto Meta Business** (business.facebook.com) i **weryfikacja firmy**: NIP, dokument rejestrowy, strona WWW i domena e-mail. Trwa zwykle kilka dni – warto zacząć od razu.
2. **Numer firmy**: osobny numer komórkowy, który nie jest używany w aplikacji WhatsApp. Jeśli jest – trzeba usunąć na nim konto WhatsApp (Ustawienia → Konto → Usuń konto), inaczej Meta go nie zarejestruje.
3. **Aplikacja w Meta for Developers** z produktem WhatsApp, dodanie numeru, zatwierdzenie **nazwy wyświetlanej** (np. „Klimatech”).
4. **Zgłoszenie 5 szablonów** z listy niżej (kategoria *Utility*, język *Polski*). Zatwierdzenie trwa zwykle od kilku minut do doby.
5. **Token stały** (użytkownik systemowy z uprawnieniem `whatsapp_business_messaging`) i **Phone Number ID** – przekazać nam bezpiecznym kanałem, nie mailem.
6. **Numery WhatsApp handlowców** – wpisać w CRM (zakładka Zespół → Edytuj → WhatsApp). Handlowcy powinni wyrazić zgodę na wiadomości służbowe.

## Szablony do zgłoszenia w Meta

Treść wklejamy dokładnie tak, jak niżej (pola `{{n}}` wypełnia system). Zasady Meta: pole nie może zawierać nowych linii – system zamienia je na „·”.

### 1. `klimatech_nowy_lead` – nowy lead / ponowienie / znany klient
Kategoria: Utility · Język: pl
```
{{1}}
{{2}} · {{3}}
Telefon: {{4}}
{{5}}
{{6}}
Lead: {{7}} – po rozmowie wybierz przycisk poniżej.
```
Przyciski (Szybka odpowiedź / Quick reply), w tej kolejności: `✅ Dodzwoniłem się` · `📵 Nie odebrał` · `📅 Umówione` · `✖ Niezainteresowany`

Pola: 1 nagłówek (np. „🔔 NOWY LEAD”, „⚠️ PONOWIENIE – klient czeka”, „♻️ ZNANY KLIENT pisze ponownie”), 2 firma – osoba, 3 województwo, 4 telefon klienta, 5 wartość · zainteresowanie, 6 informacja (np. zastępstwo, poprzednia rozmowa) albo treść zapytania, 7 numer leada.

### 2. `klimatech_przypomnienie` – lead czeka ponad 4 h robocze
```
Przypomnienie: {{1}} lead(y) czeka ponad 4 h robocze bez telefonu: {{2}}. Po rozmowie odpowiedz numerem leada i cyfrą, np. L-041 1 (1 dodzwoniłem się, 2 nie odebrał, 3 umówione, 4 niezainteresowany).
```
Pola: 1 liczba leadów, 2 lista „Firma (L-041, telefon) · …”.

### 3. `klimatech_duzy_lead` – informacja dla Marka (lead powyżej 50 tys.)
```
Duży lead {{1}}: {{2}} ({{3}}). Opiekun: {{4}}. Lead: {{5}}. Informacyjnie – lead zostaje u handlowca.
```

### 4. `klimatech_zestawienie` – poranne zestawienie handlowca (8:00)
```
Dzień dobry, {{1}}! Do telefonu dziś: {{2}}, nowe: {{3}}, otwarte: {{4}}, wczoraj obsłużone: {{5}}. Najpilniejsze: {{6}}. Pełna lista z przyciskami statusu w mailu.
```

### 5. `klimatech_zestawienie_zespolu` – poranne zestawienie Marka (8:00)
```
Zestawienie zespołu – {{1}}. Wczoraj: nowe {{2}}, obsłużone {{3}}, w terminie doby {{4}}. Otwarte: {{5}}, po terminie {{6}}, eskalacje {{7}}. Eskalacje: {{8}}. Szczegóły w mailu.
```

Potwierdzenia po kliknięciu („✅ Zapisano: L-041 … – Dodzwoniono się”) i komunikaty („❓ Nie rozpoznałem…”) idą zwykłym tekstem – są wysyłane w ciągu 24 h od wiadomości handlowca, więc szablon nie jest potrzebny.

## Jak to włączyć (po stronie zespołu)

1. W `n8n/config.local.json` uzupełnić:
   ```json
   "WHATSAPP": "meta",
   "META_PHONE_ID": "<Phone Number ID>",
   "META_TOKEN": "<token stały>",
   "META_VERIFY_TOKEN": "<dowolny długi losowy ciąg>"
   ```
   i zbudować workflow: `npm run build:workflows`, zaimportować, aktywować (w tym **5 – WhatsApp Business (Meta) – odbiór**).
2. W aplikacji Meta → WhatsApp → Configuration → **Webhook**: adres `https://n8n.klimatech.pl/webhook/whatsapp`, *Verify token* = `META_VERIFY_TOKEN`, subskrypcja pola **messages**. Meta sprawdzi adres (workflow 5 odsyła jej kod weryfikacyjny).
3. W CRM wpisać numery WhatsApp handlowców, przełączyć `TRYB_TESTOWY` na `false`.

Przełącznik `WHATSAPP` działa we wszystkich miejscach naraz: nowy lead, duży lead, przypomnienie 4 h, poranne zestawienia i potwierdzenia. Powrót do Green API = `WHATSAPP: green`.

## Co jest zbudowane i przetestowane

| Element | Gdzie | Test |
|---|---|---|
| Wiadomości w formacie Meta (szablon + pola + przyciski, albo tekst w oknie 24 h) | `metaBody`, `wrapTestModeWa` w `n8n/src/core.js` | 3 testy automatyczne (pola bez nowych linii, 4 przyciski z numerem leada, numer bez `@c.us`) |
| Wysyłka do `graph.facebook.com/{wersja}/{PHONE_ID}/messages` z tokenem | węzły „Wyślij WhatsApp” w workflow 1, 2, 5 | Green API sprawdzony na żywo po przebudowie węzła |
| Weryfikacja webhooka (`hub.verify_token` → `hub.challenge`) | workflow 5 | na żywo: poprawny token → 200 + kod, zły → 403 |
| Kliknięcie przycisku / odpowiedź tekstem → status, notatka, historia, potwierdzenie | `metaDoWiadomosci` + `processWaReplies`, workflow 5 | na żywo przykładowym zdarzeniem w formacie Meta: status leada w arkuszu, wpis w historii, „✅ Zapisano” |
| Powtórne dostarczenie tego samego zdarzenia przez Meta | pamięć identyfikatorów w workflow 5 | – |

## Koszty

Meta nalicza opłatę za wiadomości szablonowe *utility* wysłane z inicjatywy firmy (stawka dla Polski wg aktualnego cennika Meta, zmienia się kwartalnie). Odpowiedzi w oknie 24 h są bezpłatne. Przy ~80–90 leadach miesięcznie to szacunkowo kilkadziesiąt złotych miesięcznie – szczegóły w [propozycji](propozycja-dla-klienta.md).
