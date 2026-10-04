// === Węzeł Code: "Ustaw status" (workflow B, tryb: Run Once for All Items) ===
const query = $('Webhook').first().json.query || {};
const rows = $('Pobierz lead').all().map((i) => i.json).filter((r) => r.lead_id);

const wynik = applyStatusClick(query, rows, nowWarsaw());
return [{ json: wynik }];
