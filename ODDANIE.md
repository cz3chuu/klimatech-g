# Klimatech – oddanie zadania

---

## 1. Jak pracowałem

### Jak podszedłem do problemu

Zacząłem od maila "od" Marka. Przeczytałem go kilka razy i przeanalizowałem go na spokojnie, z racji tego, że problem nie był duży to nie było potrzeby skorzystania z AI do analizy problemu.

Wziąłem pod uwagę to, że:

- leady giną, bo nikt nie pilnuje, czy ktoś zadzwonił (piątek → środa),
- dwie osoby dzwonią do tego samego klienta i podają różne ceny, bo nigdzie nie zapisuje się, że był kontakt,
- ci sami klienci są w arkuszu kilka razy, a telefony każdy wpisuje inaczej,
- handlowcy nie czytają maili, czytają WhatsAppa,
- twarde zasady: lead tylko do opiekuna województwa, pn–pt 8–16, telefon w ciągu doby roboczej, po dwóch dniach sprawa idzie do Marka.

Potem przejrzałem eksport arkusza. Chciałem sprawdzić, czy dane potwierdzają to, co pisze Marek, i ile to kosztuje. Sprawdziłem:

- ile zapytań dostało kontakt i po jakim czasie (liczone w godzinach pracy, nie zegarowo w innym przypadku piątkowy lead wyglądałby kiepsko, choć część tego czasu to weekend),
- duplikaty, czyli ten sam telefon w różnym zapisie, ta sama firma pod inną nazwą,
- formaty telefonów, brakujące województwa i e-maile, zgłoszenia po godzinach,
- czy każde województwo ma handlowca.

Wyszło na to, że kontakt dostało tylko 12 z 37 zapytań, bez telefonu czeka ok. 710 tys. zł, a lubuskie i podlaskie nie mają opiekuna w ogóle (7 leadów, 0 kontaktów). Wniosek był prosty: problemem nie jest liczba zapytań, tylko brak kogoś, kto pilnuje, co się z nimi dzieje. Pełne zestawienie generuje `npm run import` (plik `docs/raport.md`).

### Plan działania

1. Rdzeń logiki na danych z załącznika: ujednolicenie telefonów, wykrywanie duplikatów, przydział po województwie, czas reakcji w godzinach pracy (ze świętami). Wszystko z testami, żeby było wiadomo, że liczby się zgadzają.
2. Integracji w n8n: formularz, arkusz, powiadomienie do handlowca.
3. Kanał na whatsapp'ie i informacja zwrotna, że ktoś zadzwonił.
4. Widok dla szefa Marka, w którym widać wszystko o leadzie (czyli kontrola i spokojna głowa szefostwa).
5. Dokumentacja i propozycja dla klienta. (późniejsze etapy)

### Najważniejsze decyzje i dlaczego

- Arkusz zostaje ponieważ buiro i Marek go znają, przez co jest to wygodne dla klienta, Pipedrive odpadł, więc na ten moment nie wracam do tematu. Nie chciałem na start zmieniać ludziom pracy.
- Whatsapp ze względu na to, że to wygodne rozwiązanie dla handlowców, stwierdziłem, że nie wystarczyłby mail. Według mnie powiadomienie mailem do handlowca, który maili nie czyta, nie rozwiązałoby problemu. W makiecie użyłem Green API, bo konfiguracja zajęła kilka minut (potem przejście może do WhatsApp Business Api). W propozycji dla klienta jest oficjalne WhatsApp Business API, co do Green API nie do końca jestem w stanie stwierdzić, czy używa się w takich rozwiązaniach stąd propozycja przejśca na WhatsApp Buisiness Api.
- W gotowym produkcie leady nie byłby oczywiście na jeden numer, nie na grupę handlowców, dlatego, że grupę musiałby śledzić każdy i ktoś mógłby pominąć swojego LEADa.
- Potwierdzenie kontaktu odpowiedzią na WhatsAppie, nie linkiem.Handlowiec w trasie odpisuje jedną cyfrą (1 – dodzwoniłem się, 2 – nie odebrał, itp.) i może dopisać notatkę. Zero klikania i logowania.
- Notatka z rozmowy i ostrzeżenie „znany klient". To moja odpowiedź na problem „każdy podał inną cenę”: kiedy klient pisze drugi raz, handlowiec od razu widzi, kto z nim rozmawiał i co ustalił.
- Mini CRM na Supabase. Klient sam napisał, że chciałby własny CRM i że zna trochę Claude Code. Zrobiłem prosty panel: lista leadów, karta klienta z historią „kto, co, kiedy”, statystyki handlowców. Celowo działa na kopii arkusza i osobno od reszty, ponieważ awaria CRM nie może zatrzymać przypomnień.
- Zakładka „Wpisz lead” dla biura. Zapytania z telefonu i maila Ania nadal wpisuje do arkusza, ale do osobnej zakładki. Wiersz wpisany prosto do listy leadów ominąłby duplikaty, przydział i powiadomienie. System odpisuje w wierszu, do kogo lead trafił albo co poprawić.
- Formularz dla klientów zabezpieczony przed literówkami. Pola wymagane, listy wyboru, błędny numer kończy się stroną „popraw dane” zamiast fałszywego „dziękujemy”, a na stronie z podziękowaniem klient widzi numer, na który oddzwonimy. Podwójne wysłanie nie tworzy drugiego leada.

Czego świadomie nie zrobiłem: 
- AI do czytania maili
- nagrywania + tranksypcji rozmów z klientem które automatycznie zostałyby zapisane do google sheets.

Oczywiście w rozmowie z klientem można wspomnieć o takim rozszerzeniu.

### Do czego użyłem AI

Pracowałem głownie z Claude Code. Podział wyglądał tak:

Moje: ocena problemu, co jest priorytetem i jak całość ma działać. To ja zdecydowałem o WhatsAppie zamiast maila, o Green API na makietę, o wysyłce na jeden numer zamiast grupy, o mini CRM i o tym, co ma w nim być widać, o obsłudze ręcznych wpisów biura, o ochronie formularza przed literówkami i o scaleniu workflow. Każdą funkcję przetestowałem sam: wypełniałem formularz, dostawałem widomości na telefon, odpisywałem z notatką, sprawdzałem arkusz i CRM.

AI:
- pisało kod według moich założeń: generator workflow n8n, obsługę WhatsAppa (wysyłka, rozpoznawanie odpowiedzi), panel CRM, schemat bazy Supabase, formularz klienta i testy automatyczne. Ja mówiłem, co ma robić i dlaczego, sprawdzałem efekt i zgłaszałem poprawki,
- pomagało szukać błędów, np. zła nazwa zakładki, polskie znaki psute przez terminal, konflikty formularzy w n8n,
- sprawdziło aktualne ceny narzędzi do kosztorysu,
- pomagało zredagować README, propozycję dla klienta na podstawie moich decyzji i notatek, potem je poprawiłem.


### Narzędzia

Claude Code - pisanie kodu, rozwiązywanie problemów, redakcja dokumentów |
n8n (lokalnie w Dockerze) - workflow: przyjęcie leada, obsługa co minutę, linki w mailach, synchronizacja z CRM
Google Sheets, Gmail, Google Cloud Console - arkusz jako baza makiety, powiadomienia mailowe, dostęp n8n do Google
Green API, WhatsApp w makiecie (numer testowy)
Supabase - baza i logowanie dla mini CRM
VS Code, Git - przeglądarka konfiguracja, historia zmian, testy formularzy i panelu

### Ile to trwało


Analiza maila i danych, plan - około 20 minut
Rdzeń logiki, testy, raport z danymi, około 10 minut
n8n: formularz → arkusz → mail, konfiguracja Google, około 30 minut
WhatsApp (Green API) i odpowiedzi handlowców, około 20 minut
Notatki z rozmów i mini CRM (Supabase, panel, logowanie, wygląd), około 20 minut
Wejścia: zakładka dla biura, formularz klienta z walidacją, około 30 minut
Scalenie workflow i test całościowy, 20 minut max, ze względu na to, że od początku wiedziałem jak to ma wyglądać i robiłem na spokojnie krok po kroku, nie dokładałem nic po drodze aby nie psuć planu który obrałem
Porządki w repo, README, propozycja, ten opis 20 minut


Całość wyszła około 3-3,5h. Świadomie dołożyłem WhatsAppa, notatki z rozmów i CRM, bo bez nich moim zdaniem klient nie byłby w pełni usatysfakcjonowany.

---

## 2. Propozycja dla klienta (skrót)

Pełna wersja: [docs/propozycja-dla-klienta.md](docs/propozycja-dla-klienta.md).

- Rozwiązanie: każde zapytanie (strona WWW, wpis biura z telefonu lub maila) automatycznie trafia na WhatsApp do handlowca z danego województwa. Handlowiec potwierdza rozmowę jedną cyfrą i notatką. System przypomina po 4 h, po dniu, a po 2 dniach roboczych eskaluje do Marka. Duplikaty i ponowienia są rozpoznawane, a historia każdego klienta jest w jednym miejscu.
- Na czym: n8n na własnym serwerze, oficjalne WhatsApp Business API, obecny arkusz Google (etap 1), później Supabase z panelem CRM.
- Koszt narzędzi: ok. 50–90 zł/mies. w etapie 1, ok. 155–205 zł/mies. z bazą i panelem CRM. (lecz ciężko mi dokładniej określić na ten moment)

---

## 3. Makieta

Działa lokalnie na n8n, z arkuszem Google, Gmailem, WhatsAppem (Green API, usunąłem numer telefonu z uwagi na publiczne repozytorium) i Supabase. Kod i workflow są w repozytorium z pełną historią zmian.

Rdzeń na danych z załącznika: `npm test` uruchamia 32 testy na prawdziwym eksporcie, wszystkie 3 pary duplikatów, przydział, region bez handlowca, województwo z miasta, czas reakcji w godzinach pracy, SLA.

Integracja: formularz → arkusz → powiadomienie mailem i na WhatsApp → odpowiedź handlowca z notatką → status w arkuszu → przypomnienia i eskalacje → CRM.

Szybki podgląd bez konfiguracji: `npm run crm` i http://localhost:5180/?demo - panel CRM na danych z eksportu.

Co przetestowałem na żywo: nowy lead z formularza, błędny numer, podwójne wysłanie, ponowienie klienta, znany klient z poprzednim kontaktem, region bez handlowca, województwo ustalone z miasta, wpisy biura (poprawny, ponowienie, błędny), odpowiedź na WhatsAppie z notatką, kliknięcie linku w mailu (i podrobiony link), przypomnienia SLA i eskalacja do Marka, synchronizacja z CRM.

W README.md instrukcja dla osoby z zespołu jak co działa oraz jak to uruchomić.

---

## 4. README

[README.md](README.md) stworzone dla osoby z zespołu, która przejmuje temat: problem klienta, architektura, życie leada krok po kroku, reguły biznesowe, uruchomienie od zera, scenariusze testów, decyzje, znane ograniczenia i co dalej.

---

## 5. Kilka zdań do Marka

> Dzień dobry, Panie Marku,
>
> przejrzałem eksport z ostatnich dwóch tygodni. Z 37 zapytań telefon dostało 12, a bez kontaktu czekają zapytania warte ok. 710 tys. zł. Największe z nich, hurtownia z Gorzowa za ok. 180 tys., jest z lubuskiego, gdzie podobnie jak w podlaskim, nie ma dziś żadnego handlowca. Te dwa województwa to 7 zapytań i ani jednego kontaktu. Dwie firmy (Instal-Tech i Termex) pisały ponownie, bo nikt się nie odezwał.
>
> Problemem nie jest liczba zapytań, tylko to, że nikt nie pilnuje, co się z nimi dzieje po wpisaniu do arkusza. Proponuję prosty system: każde zapytanie trafia od razu na WhatsApp do handlowca z danego województwa, handlowiec po rozmowie odpisuje jedną cyfrą i krótką notatką, a jeśli przez dwa dni robocze nikt nie zadzwoni, sprawa przychodzi do Pana. Ania pracuje dalej w arkuszu, handlowcy nie instalują żadnego programu, a Pan widzi wszystko w jednym panelu.
>
> Mam działającą makietę na Pana danych. Proponuję 30 minut online, żeby ją pokazać i ustalić dwie rzeczy na start: kto bierze lubuskie i podlaskie oraz jakie kroki podejmujemy dalej.
>
> Pozdrawiam,
> Wiktor Czechowski

---

## Pytania

- [do klienta] Kto obsługuje lubuskie i podlaskie? Do czasu decyzji leady z tych województw trafiają do Marka.
- [do klienta] Czy progi są dobre: przypomnienie po 4 h, „po czasie” po 1 dniu, eskalacja po 2 dniach roboczych?
- [do klienta] Jakiej wtyczki formularza używa strona i czy możemy poprosić agencję o dodanie wysyłki do systemu?
- [do klienta] Czy firma ma numer, który możemy przeznaczyć na WhatsApp Business API (niepodpięty do aplikacji WhatsApp)?


