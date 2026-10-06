// === Węzeł Code: "Przetwórz lead" (workflow 1 – Przyjęcie leada, tryb: Run Once for All Items) ===
// Jedno wejście dla: webhooka strony WWW (JSON) i formularza klienta. Dla formularza dokłada stronę z podziękowaniem.
// Wyjątki z zakładki „Wyjątki” (np. Termex -> biuro); brak zakładki = brak wyjątków
const cfg = { ...$('Konfiguracja').first().json, WYJATKI: $('Pobierz wyjątki').all().map((i) => i.json).filter((w) => w.dopasowanie) };
const body = $('Zgłoszenie').first().json || {};
const existing = $('Pobierz leady').all().map((i) => i.json).filter((r) => r.lead_id);
const handlowcy = $('Pobierz handlowców').all().map((i) => i.json).filter((r) => r.handlowiec_id);

const wynik = processInquiry(body, existing, handlowcy, cfg, nowWarsaw());
wynik.wejscie = body._wejscie || 'webhook';
if (wynik.wejscie === 'klient') wynik.strona = klientPage(wynik, cfg.FORM_KLIENT_URL || '/form/klimatech');
return [{ json: wynik }];
