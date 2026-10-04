// === Węzeł Code: "Przetwórz skrzynkę" (workflow F, tryb: Run Once for All Items) ===
// Zakładka „Wpisz lead”: wiersze bez wyniku -> ten sam rdzeń co formularz. Brak nowych wierszy = koniec przebiegu.
const cfg = $('Konfiguracja').first().json;
const wpisy = $('Pobierz skrzynkę').all().map((i) => i.json);
const existing = $('Pobierz leady').all().map((i) => i.json).filter((r) => r.lead_id);
const handlowcy = $('Pobierz handlowców').all().map((i) => i.json).filter((r) => r.handlowiec_id);

const wynik = processInbox(wpisy, existing, handlowcy, cfg, nowWarsaw());
return wynik.wyniki.length ? [{ json: wynik }] : [];
