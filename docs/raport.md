# Raport z danych – eksport leadów Klimatech

Wygenerowano: `node scripts/import-csv.mjs` · stan na: **2026-10-04 23:59** · czas liczony w godzinach roboczych (pn–pt 8–16, bez świąt)

## Najważniejsze liczby

| Wskaźnik | Wartość |
|---|---|
| Wpisów w arkuszu | 40 |
| Unikalnych zapytań (po deduplikacji) | 37 |
| Z kontaktem | 12 (32%) |
| Bez kontaktu | 25, szac. 710 000 zł |
| Mediana czasu do 1. kontaktu | 5,2 h roboczych |
| Kontakt w ≤ 1 h roboczą | 0 z 12 |
| Kontakt w ≤ 1 dzień roboczy | 8 z 12 |
| Bez kontaktu > 1 dzień roboczy | 20 |
| Bez kontaktu > 2 dni robocze (eskalacja) | 16 |
| Województwa bez handlowca | lubuskie, podlaskie |
| Leady w tych województwach | 7, szac. 328 000 zł, z kontaktem: 0 |

## Duplikaty

| Lead | Firma | Duplikat leada | Typ | Dopasowanie |
|---|---|---|---|---|
| L-016 | Opolterm | L-015 | pewny | telefon |
| L-023 | Instal-Tech Kowalczyk | L-007 | pewny | telefon |
| L-038 | Termex ZPH Sp. j. | L-031 | pewny | telefon |

## Problemy jakości danych

- Formaty telefonu w arkuszu: `+99 999 999 999`, `999-999-999`, `999 999 999`, `+99999999999`, `999999999`
- Województwo uzupełnione automatycznie z miasta: L-027 (Kielce → świętokrzyskie)
- Brak e-maila: L-019
- Zgłoszenia w weekend lub po 16:00: L-003, L-004, L-011, L-018, L-020, L-024, L-025, L-039, L-040

## Handlowcy

| Handlowiec | Województwa | Zapytań | Z kontaktem | Bez kontaktu (wartość) |
|---|---|---|---|---|
| Tomasz Wrona | mazowieckie, łódzkie | 6 | 2 | 175 000 zł |
| Katarzyna Lis | małopolskie, podkarpackie, lubelskie, świętokrzyskie | 8 | 3 | 60 000 zł |
| Piotr Nowak | śląskie, opolskie | 4 | 1 | 61 000 zł |
| Bartosz Zając | wielkopolskie, kujawsko-pomorskie | 4 | 2 | 26 500 zł |
| Ewa Sowa | pomorskie, warmińsko-mazurskie, zachodniopomorskie | 6 | 3 | 42 500 zł |
| Michał Kruk | dolnośląskie | 2 | 1 | 17 000 zł |

## Najdłużej czekające bez kontaktu

| Lead | Firma | Woj. | Opiekun | Wartość | Czeka (robocze) |
|---|---|---|---|---|---|
| L-003 | Instalbud Grabowski | podlaskie | **BRAK** | 40 000 zł | 72,0 h |
| L-005 | Hydro-Max | wielkopolskie | Bartosz Zając | 18 000 zł | 70,5 h |
| L-007 | Instal-Tech Kowalczyk | mazowieckie | Tomasz Wrona | 56 000 zł | 65,7 h |
| L-009 | Zielona Energia Gorzów | lubuskie | **BRAK** | 180 000 zł | 61,3 h |
| L-011 | Instal Szczecin | zachodniopomorskie | Ewa Sowa | 8000 zł | 56,0 h |
| L-013 | Eko-Instal Suwałki | podlaskie | **BRAK** | 6000 zł | 52,6 h |
| L-015 | Opolterm | opolskie | Piotr Nowak | 11 000 zł | 48,0 h |
| L-019 | Instalatorstwo J. Baran | świętokrzyskie | Katarzyna Lis | 9000 zł | 40,7 h |
| L-018 | Warszawskie Centrum Klimatyzacji | mazowieckie | Tomasz Wrona | 45 000 zł | 40,0 h |
| L-020 | Zielonogórska Termotechnika | lubuskie | **BRAK** | 22 000 zł | 40,0 h |
