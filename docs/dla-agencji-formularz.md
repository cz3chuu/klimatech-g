# Formularz na stronie → system leadów Klimatech – instrukcja dla agencji

Cel: formularz zapytania (Contact Form 7) oprócz maila na biuro@ wysyła **drugi mail na `leady@klimatech.pl`**. System leadów czyta tę skrzynkę co minutę i przekazuje zgłoszenie handlowcowi z województwa klienta. Mail na biuro@ zostaje bez zmian.

Bez dodatkowych wtyczek – tylko ustawienia formularza.

## 1. Drugi mail w Contact Form 7

1. Edycja formularza zapytania → zakładka **Mail**.
2. Na dole zaznacz **Użyj Mail (2)** (*Use Mail (2)*).
3. Ustaw:
   - **Do:** `leady@klimatech.pl`
   - **Temat:** `Zapytanie ze strony – [your-company]`
   - **Treść:** dokładnie układ z punktu 2 (etykiety i dwukropki bez zmian, kolejność dowolna)
   - **Typ treści:** zwykły tekst (bez zaznaczania „Użyj treści HTML”)
4. Zapisz.

## 2. Treść maila (do wklejenia)

```
Firma: [your-company]
Imię i nazwisko: [your-name]
Telefon: [your-tel]
E-mail: [your-email]
Miasto: [your-city]
Województwo: [your-region]
Zainteresowanie: [zainteresowanie]
Kim jesteś: [kim-jestes]
Wartość: [wartosc]
Zgoda: [acceptance-rodo]
Wiadomość:
[your-message]
```

Nazwy w nawiasach to tagi pól formularza. Jeśli w formularzu pola nazywają się inaczej, wystarczy wstawić własne tagi – ważne, żeby **etykiety przed dwukropkiem zostały takie jak wyżej**. Pola, których formularz nie ma, można pominąć. Minimum: firma lub imię i nazwisko oraz telefon (albo e-mail).

## 3. Pola, które warto dodać do formularza

Jeśli formularz ich jeszcze nie ma – przyspieszają przydział do handlowca:

```
[text* your-city placeholder "Miasto"]
[select* your-region first_as_label "Województwo" "nie wiem" "dolnośląskie" "kujawsko-pomorskie" "lubelskie" "lubuskie" "łódzkie" "małopolskie" "mazowieckie" "opolskie" "podkarpackie" "podlaskie" "pomorskie" "śląskie" "świętokrzyskie" "warmińsko-mazurskie" "wielkopolskie" "zachodniopomorskie"]
[checkbox* zainteresowanie "pompy ciepła" "klimatyzacja" "rekuperacja"]
[number wartosc min:0 placeholder "Orientacyjna wartość (zł)"]
```

## 4. Test

Wyślij formularz z testowymi danymi (np. firma „TEST AGENCJA”, telefon `700 000 000`) i daj nam znać – potwierdzimy, że zgłoszenie dotarło do systemu. Gdyby układ maila był nieczytelny, system nie gubi zgłoszenia: przekazuje je biuru do ręcznego wpisania.
