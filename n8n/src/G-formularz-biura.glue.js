// === Węzeł Code: "Przetwórz lead" (workflow G – Formularz biura, tryb: Run Once for All Items) ===
// Ten sam rdzeń co formularz WWW; dodatkowo gotowa strona HTML z podsumowaniem dla Ani.
const cfg = $('Konfiguracja').first().json;
const body = $('Zgłoszenie').first().json || {};
const existing = $('Pobierz leady').all().map((i) => i.json).filter((r) => r.lead_id);
const handlowcy = $('Pobierz handlowców').all().map((i) => i.json).filter((r) => r.handlowiec_id);

const wynik = processInquiry(body, existing, handlowcy, cfg, nowWarsaw());
wynik.strona = biuroPage(wynik, cfg.FORM_BIURO_URL || '/form/biuro');
return [{ json: wynik }];
