# Klimatech – propozycja rozwiązania: leady bez strat

Dla: Marek (Klimatech) · Przygotował: zespół wdrożeniowy · Stan cen: październik 2026

## 1. Co pokazały Pana dane

Przeanalizowaliśmy eksport arkusza z ostatnich dwóch tygodni (21.09–04.10, 40 wpisów). Czas liczyliśmy w godzinach pracy firmy (pn–pt 8–16, bez świąt).

- **37 różnych zapytań, kontakt dostało 12 (32%).** Bez telefonu czeka 25 zapytań o łącznej szacowanej wartości **~710 000 zł**.
- **Mediana czasu do pierwszego telefonu: 5 h roboczych**, ale w ciągu godziny nie oddzwoniono ani razu. 16 zapytań czeka dłużej niż 2 dni robocze.
- **Lubuskie i podlaskie nie mają handlowca.** To 7 zapytań za ~328 000 zł, w tym największe w zestawieniu (hurtownia z Gorzowa, 180 000 zł) – żadne nie dostało telefonu.
- **3 zapytania to duplikaty.** Instal-Tech Kowalczyk i Termex napisały ponownie po tygodniu bez odpowiedzi („nikt się nie odezwał”, „czy dostanę odpowiedź?”), Opolterm wysłał formularz dwa razy w ciągu 8 minut. W arkuszu wyglądają jak różne firmy („ZPH Termex” i „Termex ZPH Sp. j.”), a telefony są wpisane w 5 różnych formatach.

Problemem nie jest liczba zapytań, tylko to, że po wpisaniu do arkusza nikt nie pilnuje, czy ktoś zadzwonił.

## 2. Co proponujemy

**System, który sam przekazuje każde zapytanie właściwemu handlowcowi na WhatsApp, pilnuje telefonu w ciągu doby i po dwóch dniach przychodzi z tym do Pana.** Bez nowego programu dla handlowców i bez zmiany pracy biura.

**Handlowiec** dostaje na WhatsApp krótką wiadomość: firma, numer do kliknięcia, wartość, treść zapytania. Po rozmowie odpowiada jedną cyfrą (1 – dodzwoniłem się, 2 – nie odebrał, 3 – umówione, 4 – niezainteresowany), może dopisać notatkę („cena 4 200 zł/szt., oddzwonić w piątek”). Dostaje wyłącznie leady ze swoich województw.

**Ania** dalej pracuje w arkuszu. Zapytania z telefonu i maila wpisuje do jednej zakładki – system od razu odpisuje w wierszu, do kogo lead trafił albo co poprawić. Formularz ze strony trafia do systemu sam.

**Pan** dostaje: eskalację na WhatsApp i mail, gdy lead czeka ponad 2 dni robocze; leady z województw bez handlowca do decyzji; prosty panel (CRM) z listą leadów, historią każdego klienta – kto, kiedy i co ustalił – oraz czasem reakcji każdego handlowca.

**Klient**, który pisze drugi raz, nie ginie: handlowiec dostaje „PONOWIENIE – klient czeka”. Jeśli rozmowa już była, dostaje informację, kto rozmawiał i co ustalił – koniec z dwoma telefonami i dwiema cenami.

Działającą makietę na Pana danych pokazujemy na spotkaniu (formularz → arkusz → WhatsApp → odpowiedź handlowca → panel).

## 3. Etapy wdrożenia

| Etap | Zakres | Efekt |
|---|---|---|
| **1. Start (ok. 2 tygodnie)** | serwer automatyzacji, formularz ze strony → system, przydział po województwach, wykrywanie duplikatów, powiadomienia WhatsApp + mail, odpowiedzi handlowców, przypomnienia i eskalacje, zakładka dla Ani | żaden lead nie ginie, Pan wie o każdym opóźnieniu |
| **2. Panel i porządek w danych (ok. 2 tygodnie)** | baza Supabase jako główne źródło danych, panel CRM z edycją notatek i statusów, cotygodniowy raport dla Pana, zapytania z maila biuro@ odczytywane automatycznie (AI), Ania tylko zatwierdza | własny CRM, który Pan może rozwijać sam w Claude Code |
| **3. Historia zakupów** | dane z Subiekta przy powiadomieniu („kupił u nas 3 pompy w 2025”) | handlowiec przed telefonem wie, z kim rozmawia |

## 4. Na czym to działa i dlaczego

| Element | Narzędzie | Dlaczego |
|---|---|---|
| Automatyzacja | **n8n** na własnym serwerze w UE (Hetzner, Niemcy) | otwarte oprogramowanie, bez opłat za liczbę uruchomień; system sprawdza leady co minutę, co w wersji chmurowej n8n przekroczyłoby limity tańszych planów |
| Powiadomienia | **WhatsApp Business Cloud API** (oficjalne, od Meta) + Gmail | handlowcy czytają WhatsAppa; oficjalne API nie grozi blokadą numeru |
| Dane – etap 1 | **Google Sheets** (obecny arkusz) | biuro nie zmienia nawyków |
| Dane i panel – etap 2 | **Supabase** (PostgreSQL) + prosty panel WWW | własny CRM bez abonamentu za użytkownika; łatwy do rozwijania |
| Formularz | obecny formularz WordPress (agencja dodaje wysyłkę do systemu) | strona wygląda tak samo, mail na biuro@ zostaje jako kopia |
| Odczyt maili (etap 2) | model AI (np. Claude Haiku) | grosze za maila, człowiek zatwierdza |

## 5. Koszty miesięczne narzędzi

Szacunek dla obecnego ruchu (~80–90 zapytań miesięcznie w sezonie, 6 handlowców). Ceny netto.

| Pozycja | Etap 1 | Etap 2 |
|---|---|---|
| Serwer n8n (Hetzner CX23, 5,99 € + kopie zapasowe) | ~30 zł | ~30 zł |
| WhatsApp Cloud API – wiadomości szablonowe *utility* do handlowców¹ | ~20–60 zł | ~20–60 zł |
| Google Workspace (już Państwo mają) | 0 zł | 0 zł |
| Supabase – baza i logowanie do panelu (plan Pro: 25 $; darmowy plan bez kopii zapasowych) | – | ~100 zł |
| AI do odczytu maili | – | ~5–15 zł |
| Domena / certyfikat HTTPS (subdomena obecnej domeny, Let's Encrypt) | 0 zł | 0 zł |
| **Razem** | **~50–90 zł / mies.** | **~155–205 zł / mies.** |

¹ Meta nalicza opłatę za wiadomości wysłane z inicjatywy firmy. Odpowiedzi w ciągu 24 h od wiadomości handlowca są bezpłatne. Dokładną stawkę dla Polski potwierdzimy w cenniku Meta przed wdrożeniem (stawki zmieniają się kwartalnie). Dla porównania: n8n w chmurze to 24–60 €/mies. z limitem uruchomień, a typowy CRM z abonamentem to 15–50 € za użytkownika miesięcznie.

Koszt wdrożenia (praca zespołu) wyceniamy osobno, po potwierdzeniu zakresu etapów.

## 6. Czego potrzebujemy od Pana

**Decyzje**
1. Kto obsługuje **lubuskie i podlaskie** (do czasu decyzji leady trafiają do Pana).
2. Potwierdzenie progów: przypomnienie po 4 h, „po czasie” po 1 dniu, eskalacja do Pana po 2 dniach roboczych.
3. Kto poza Panem i Anią ma mieć dostęp do panelu.

**Dostępy i dane**
4. Konto Google (techniczne lub Ani) z dostępem do arkusza i skrzynki biuro@ – do podłączenia systemu.
5. Numery WhatsApp handlowców i ich zgoda na wiadomości służbowe.
6. **Numer telefonu firmy dla WhatsApp Business API** – nowy albo niepodpięty do aplikacji WhatsApp – oraz **weryfikacja firmy w Meta Business** (NIP, dokumenty firmy, strona WWW). Weryfikacja trwa zwykle kilka dni, dlatego warto zacząć od razu.
7. Kontakt do agencji od strony WWW i nazwa wtyczki formularza (ok. 15 minut pracy agencji).
8. Subiekt (etap 3): wersja (GT czy nexo) i czy jest licencja Sfera lub możliwość nocnego eksportu.

**Formalności (RODO)**
9. Zgoda na przetwarzanie danych zapytań w UE u dostawców: Hetzner (serwer), Supabase (baza, region UE), Meta (WhatsApp). Przygotujemy listę umów powierzenia.

## 7. Ryzyka i jak je ograniczamy

| Ryzyko | Jak ograniczamy |
|---|---|
| Weryfikacja w Meta się przeciąga | start z powiadomieniami mailowymi + WhatsApp przez tymczasową bramkę; przełączenie bez zmian w logice |
| Handlowcy nie odpowiadają cyfrą | przypomnienia i eskalacja i tak działają; w panelu widać, kto nie potwierdza kontaktów |
| Awaria serwera | kopie zapasowe, mail na biuro@ zostaje jako kopia każdego zgłoszenia, panel pokazuje lukę |
| Błędny numer w formularzu | walidacja, strona z potwierdzeniem numeru dla klienta, wykrywanie ponownego wysłania |

## 8. Proponowany następny krok

30-minutowe spotkanie online: pokazujemy makietę na Pana danych, ustalamy decyzje z punktu 6 i termin startu etapu 1. Weryfikację Meta (punkt 6.6) warto rozpocząć równolegle, bo to najdłuższy element.
