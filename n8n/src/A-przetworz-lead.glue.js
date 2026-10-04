// === Węzeł Code: "Przetwórz lead" (workflow A, tryb: Run Once for All Items) ===
const cfg = $('Konfiguracja').first().json;
const body = $('Zgłoszenie').first().json || {};
const existing = $('Pobierz leady').all().map((i) => i.json).filter((r) => r.lead_id);
const handlowcy = $('Pobierz handlowców').all().map((i) => i.json).filter((r) => r.handlowiec_id);

const wynik = processInquiry(body, existing, handlowcy, cfg, nowWarsaw());
return [{ json: wynik }];
