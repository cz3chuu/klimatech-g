// === Węzeł Code: "Grupuj maile" (workflow C, tryb: Run Once for All Items) ===
// Jeden mail na odbiorcę i poziom, zamiast osobnego maila na każdy lead.
const cfg = $('Konfiguracja').first().json;
const items = $('Sprawdź SLA').all().map((i) => i.json._sla);
return groupSlaEmails(items, cfg).map((e) => ({ json: e }));
