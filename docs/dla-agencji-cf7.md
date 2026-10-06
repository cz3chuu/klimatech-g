# Contact Form 7 → system leadów Klimatech – instrukcja dla agencji

Cel: formularz zapytania na stronie (Contact Form 7) oprócz maila na biuro@ wysyła te same dane do systemu leadów. Zgłoszenie od razu trafia do handlowca z województwa klienta. Mail na biuro@ zostaje bez zmian – jako kopia.

## 1. Adres

```
POST https://n8n.klimatech.pl/webhook/lead?klucz=<KLUCZ>
```

- `<KLUCZ>` przekazujemy osobno (nie mailem). Bez poprawnego klucza zgłoszenie jest odrzucane.
- Zamiast parametru `?klucz=` można wysłać nagłówek `X-Klimatech-Token: <KLUCZ>`, jeśli wtyczka obsługuje nagłówki.
- **Sprawdzenie:** pełny adres z kluczem otwarty w przeglądarce pokazuje stronę „✅ Adres formularza działa”. Bez klucza – „Brak dostępu”.

## 2. Wtyczka

1. Zainstaluj i włącz wtyczkę **CF7 to Webhook** (darmowa, katalog WordPress).
2. W edycji formularza zapytania: zakładka **Webhook** → zaznacz **Send to Webhook** → wklej adres z punktu 1 → zapisz.
3. Format: JSON (domyślny). Nic więcej nie trzeba ustawiać.

## 3. Pola formularza

Domyślne nazwy pól CF7 zostają – system je rozpoznaje. Pola, których formularz jeszcze nie ma, warto dodać:

| Pole w CF7 (nazwa) | Co to jest | Wymagane |
|---|---|---|
| `your-company` | firma | tak |
| `your-name` | imię i nazwisko | tak |
| `your-tel` | telefon (dowolny format) | tak (albo e-mail) |
| `your-email` | e-mail | nie |
| `your-city` | miasto | tak |
| `your-region` | województwo (lista 16 + „nie wiem”) | tak |
| `zainteresowanie` | pompy ciepła / klimatyzacja / rekuperacja (pola wyboru) | tak |
| `kim-jestes` | instalator / hurtownia / deweloper / klient indywidualny | nie |
| `wartosc` | orientacyjna wartość zamówienia (zł) | nie |
| `your-message` | wiadomość | nie |
| `acceptance-rodo` | zgoda na kontakt (RODO) | tak |

Przykładowe tagi CF7:
```
[text* your-company placeholder "Firma"]
[text* your-name placeholder "Imię i nazwisko"]
[tel* your-tel placeholder "np. 601 222 333"]
[email your-email placeholder "E-mail (opcjonalnie)"]
[text* your-city placeholder "Miasto"]
[select* your-region first_as_label "Województwo" "nie wiem" "dolnośląskie" "kujawsko-pomorskie" "lubelskie" "lubuskie" "łódzkie" "małopolskie" "mazowieckie" "opolskie" "podkarpackie" "podlaskie" "pomorskie" "śląskie" "świętokrzyskie" "warmińsko-mazurskie" "wielkopolskie" "zachodniopomorskie"]
[checkbox* zainteresowanie "pompy ciepła" "klimatyzacja" "rekuperacja"]
[radio kim-jestes default:0 "instalator / firma instalacyjna" "hurtownia" "deweloper / inwestor" "klient indywidualny"]
[number wartosc min:0 placeholder "Orientacyjna wartość (zł)"]
[textarea your-message placeholder "Ile urządzeń, na kiedy, jaki obiekt"]
[acceptance acceptance-rodo] Zgadzam się na kontakt telefoniczny i mailowy w sprawie tego zapytania. [/acceptance]
```

Inne nazwy pól też można stosować – wtedy prosimy o ich listę, dopiszemy tłumaczenie po naszej stronie.

## 4. Test po podpięciu

1. Otwórz adres z kluczem w przeglądarce – ma się pokazać „✅ Adres formularza działa”.
2. Wyślij formularz z testowymi danymi (np. firma „TEST AGENCJA”, telefon `700 000 000`).
3. Daj nam znać – potwierdzimy, że zgłoszenie dotarło do systemu i do właściwego handlowca.

## Przykład danych, które wysyła wtyczka

```json
{
  "your-company": "Instal-Kowal",
  "your-name": "Jan Kowal",
  "your-tel": "601 222 333",
  "your-email": "jan@instalkowal.pl",
  "your-city": "Gdańsk",
  "your-region": "pomorskie",
  "zainteresowanie": ["pompy ciepła", "rekuperacja"],
  "kim-jestes": ["instalator / firma instalacyjna"],
  "wartosc": "40000",
  "your-message": "10 pomp na wiosnę",
  "acceptance-rodo": "1",
  "_wpcf7": "42"
}
```

Odpowiedź systemu: `{"ok": true, "lead_id": "L-047", "przypisano": "Ewa Sowa", ...}`, a przy błędzie `{"ok": false, "errors": [...]}`. Pola techniczne CF7 (`_wpcf7…`) są pomijane.
