# Klimatech – propozycja rozwiązania: leady bez strat

Dla: Marek (Klimatech) · Przygotował: zespół wdrożeniowy · Stan cen: październik 2026

## 1. Co proponujemy

System, który sam przekazuje każde zapytanie właściwemu handlowcowi na WhatsApp, pilnuje telefonu w ciągu doby i po dwóch dniach przychodzi z tym do Pana. Bez nowego programu dla handlowców i bez zmiany pracy biura.

Handlowiec dostaje na WhatsApp krótką wiadomość: firma, numer do kliknięcia, wartość, treść zapytania. Po rozmowie odpowiada jedną cyfrą (1 - dodzwoniłem się, 2 - nie odebrał, 3 - umówione, 4 - niezainteresowany), może dopisać notatkę („cena 4 200 zł/szt., oddzwonić w piątek”). Dostaje wyłącznie leady ze swoich województw.

Biuro dalej pracuje w arkuszu. Zapytania z telefonu i maila wpisuje do jednej zakładki, a system od razu odpisuje w wierszu, do kogo lead trafił albo co poprawić. Formularz ze strony trafia do systemu sam.

Pan dostaje: eskalację na WhatsApp i mail, gdy lead czeka ponad 2 dni robocze; leady z województw bez handlowca do decyzji; prosty panel (CRM) z listą leadów, historią każdego klienta - kto, kiedy i co ustalił - oraz czasem reakcji każdego handlowca.

Klient, który pisze drugi raz, nie ginie: handlowiec dostaje „PONOWIENIE - klient czeka”. Jeśli rozmowa już była, dostaje informację, kto rozmawiał i co ustalił - koniec z dwoma telefonami i dwiema cenami.

Działającą makietę na Pana danych pokazujemy na spotkaniu (formularz → arkusz → WhatsApp → odpowiedź handlowca → panel).

## 2. Koszty miesięczne narzędzi

Szacunek dla obecnego ruchu (~80–90 zapytań miesięcznie w sezonie, 6 handlowców). Ceny netto.

Serwer n8n (Hetzner CX23, 5,99 € + kopie zapasowe) ~30 zł 
WhatsApp Cloud API (chyba, że zostajemy na Green API) – wiadomości szablonowe do handlowców ~20–60 zł (lub 10$ za Green API)
Google Workspace (już Państwo mają) 0 zł 
Supabase - baza i logowanie do panelu (plan Pro: 25 $; darmowy plan bez kopii zapasowych) ~100 zł
AI do odczytu maili 5-15zł w zależności od liczby maili
Domena / certyfikat HTTPS (subdomena obecnej domeny) (nieznany koszt)
Razem około 200zł


## 3. Czego potrzebujemy od Pana

Decyzje
1. Kto obsługuje lubuskie i podlaskie (do czasu decyzji leady trafiają do Pana).
2. Potwierdzenie progów: przypomnienie po 4 h, „po czasie” po 1 dniu, eskalacja do Pana po 2 dniach roboczych.
3. Kto poza Panem i Anią ma mieć dostęp do panelu.

Dostępy i dane
4. Konto Google (techniczne lub Ani) z dostępem do arkusza i skrzynki biuro@ - do podłączenia systemu.
5. Numery WhatsApp handlowców i ich zgoda na wiadomości służbowe.
6. Numer telefonu firmy dla WhatsApp Business API (lub Green API) – nowy albo niepodpięty do aplikacji WhatsApp – oraz weryfikacja firmy w Meta Business (NIP, dokumenty firmy, strona WWW). Weryfikacja trwa zwykle kilka dni, dlatego warto zacząć od razu.
7. Kontakt do agencji od strony WWW i nazwa wtyczki formularza (ok. 15 minut pracy agencji).

## 4. Proponowany następny krok

30-minutowe spotkanie online: pokazujemy makietę na Pana danych, ustalamy decyzje z punktu 6 i termin startu etapu 1. Weryfikację Meta (punkt 6.6) warto rozpocząć równolegle, bo to najdłuższy element.
