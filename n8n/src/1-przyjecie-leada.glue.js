// === Węzeł Code: "Przetwórz lead" (workflow 1 – Przyjęcie leada, tryb: Run Once for All Items) ===
// Jedno wejście dla: webhooka strony WWW (JSON), formularza klienta i formularza biura.
// Dla formularzy dokłada gotową stronę wyniku (klient: podziękowanie z numerem; biuro: podsumowanie).
const cfg = $('Konfiguracja').first().json;
const body = $('Zgłoszenie').first().json || {};
const existing = $('Pobierz leady').all().map((i) => i.json).filter((r) => r.lead_id);
const handlowcy = $('Pobierz handlowców').all().map((i) => i.json).filter((r) => r.handlowiec_id);

const wynik = processInquiry(body, existing, handlowcy, cfg, nowWarsaw());
wynik.wejscie = body._wejscie || 'webhook';
if (wynik.wejscie === 'klient') wynik.strona = klientPage(wynik, cfg.FORM_KLIENT_URL || '/form/klimatech');
if (wynik.wejscie === 'biuro') wynik.strona = biuroPage(wynik, cfg.FORM_BIURO_URL || '/form/biuro');
return [{ json: wynik }];
