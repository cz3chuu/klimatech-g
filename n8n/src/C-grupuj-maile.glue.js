// === Węzeł Code: "Grupuj maile" (workflow C, tryb: Run Once for All Items) ===
// Jeden mail na odbiorcę i poziom, zamiast osobnego maila na każdy lead. Pusta lista, gdy KANAL = whatsapp.
const cfg = $('Konfiguracja').first().json;
if (String(cfg.KANAL || 'mail') === 'whatsapp') return [];
const items = $('Sprawdź SLA').all().map((i) => i.json._sla);
return groupSlaEmails(items, cfg).map((e) => ({ json: e }));
