// === Węzeł Code: "Przetwórz z Meta" (workflow 5 – WhatsApp Business (Meta) – odbiór, tryb: Run Once for All Items) ===
// Webhook Meta -> wiadomości w formacie rdzenia -> ta sama obsługa odpowiedzi co z Green API (status, notatka, potwierdzenie).
// GREEN_PHONE pusty: przy Meta numerem firmowym jest numer Meta – wiadomości z niego nie przychodzą jako przychodzące
const cfg = { ...$('Konfiguracja').first().json, GREEN_PHONE: '', NIEOBECNOSCI: $('Pobierz nieobecności').all().map((i) => i.json).filter((n) => n.handlowiec_id) };
const payload = $('Wiadomość z Meta').first().json.body || {};
const rows = $('Pobierz leady').all().map((i) => i.json).filter((r) => r.lead_id);
const handlowcy = $('Pobierz handlowców').all().map((i) => i.json).filter((r) => r.handlowiec_id);

// Meta może dostarczyć to samo zdarzenie więcej niż raz – pamiętamy obsłużone identyfikatory
const pamiec = $getWorkflowStaticData('global');
const zrobione = new Set(pamiec.meta || []);
const wiadomosci = metaDoWiadomosci(payload).filter((m) => !zrobione.has(m.idMessage));
pamiec.meta = [...zrobione, ...wiadomosci.map((m) => m.idMessage)].slice(-500);

return processWaReplies(wiadomosci, rows, handlowcy, cfg, nowWarsaw()).map((w) => ({ json: w }));
