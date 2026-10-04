// === Węzeł Code: "Przetwórz lead" (workflow H – Formularz klienta (makieta strony), tryb: Run Once for All Items) ===
// Ten sam rdzeń co formularz WWW; dodatkowo strona dla klienta z numerem, na który oddzwonimy.
const cfg = $('Konfiguracja').first().json;
const body = $('Zgłoszenie').first().json || {};
const existing = $('Pobierz leady').all().map((i) => i.json).filter((r) => r.lead_id);
const handlowcy = $('Pobierz handlowców').all().map((i) => i.json).filter((r) => r.handlowiec_id);

const wynik = processInquiry(body, existing, handlowcy, cfg, nowWarsaw());
wynik.strona = klientPage(wynik, cfg.FORM_KLIENT_URL || "/form/klimatech");
return [{ json: wynik }];
