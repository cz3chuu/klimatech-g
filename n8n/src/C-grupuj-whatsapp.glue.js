// === Węzeł Code: "Grupuj WhatsApp" (workflow C, tryb: Run Once for All Items) ===
// Jedna krótka wiadomość na odbiorcę. Pusta lista, gdy KANAL = mail.
const cfg = $('Konfiguracja').first().json;
const items = $('Sprawdź SLA').all().map((i) => i.json._sla);
return groupSlaWhatsapp(items, cfg).map((w) => ({ json: w }));
