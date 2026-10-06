// === Węzeł Code: "Przetwórz lead" (workflow 1 – Przyjęcie leada, tryb: Run Once for All Items) ===
// Jedno wejście dla: formularza na stronie (Contact Form 7 -> webhook, JSON) i formularza klienta (makieta strony).
// Webhook: najpierw klucz dostępu, potem tłumaczenie pól CF7. Dla formularza n8n – strona z podziękowaniem.
// Wyjątki z zakładki „Wyjątki” (np. Termex -> biuro); brak zakładki = brak wyjątków
const cfg = { ...$('Konfiguracja').first().json, WYJATKI: $('Pobierz wyjątki').all().map((i) => i.json).filter((w) => w.dopasowanie),
  NIEOBECNOSCI: $('Pobierz nieobecności').all().map((i) => i.json).filter((n) => n.handlowiec_id) }; // urlopy, L4 – z CRM przez arkusz
let body = $('Zgłoszenie').first().json || {};
if (body._wejscie === 'webhook') {
  if (!kluczPoprawny(cfg, body._klucz)) {
    const errors = ['Brak dostępu: nieprawidłowy lub brakujący klucz (parametr ?klucz= albo nagłówek X-Klimatech-Token).'];
    return [{ json: { valid: false, wejscie: 'webhook', errors, response: { ok: false, errors } } }];
  }
  body = { ...zFormularzaStrony(body), _wejscie: 'webhook' };
}
const existing = $('Pobierz leady').all().map((i) => i.json).filter((r) => r.lead_id);
const handlowcy = $('Pobierz handlowców').all().map((i) => i.json).filter((r) => r.handlowiec_id);

const wynik = processInquiry(body, existing, handlowcy, cfg, nowWarsaw());
wynik.wejscie = body._wejscie || 'webhook';
if (wynik.wejscie === 'klient') wynik.strona = klientPage(wynik, cfg.FORM_KLIENT_URL || '/form/klimatech');
return [{ json: wynik }];
