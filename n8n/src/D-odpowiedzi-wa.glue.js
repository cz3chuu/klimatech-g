// === Węzeł Code: "Przetwórz odpowiedzi" (workflow D, tryb: Run Once for All Items) ===
// Wejście: wiadomości przychodzące z Green API (lastIncomingMessages). Wyjście: jeden item na rozpoznaną odpowiedź
// { update?, historia?, reply } – dalej trzy gałęzie: aktualizacja arkusza, historia, potwierdzenie na WhatsApp.
const cfg = $('Konfiguracja').first().json;
// Przychodzące + wysłane z telefonu (te drugie tylko dla makiety na jednym telefonie – czat „Ty”)
const wiadomosci = [...$('Pobierz wiadomości').all(), ...$('Pobierz wysłane').all()].map((i) => i.json).filter((m) => m && m.idMessage);
const rows = $('Pobierz leady').all().map((i) => i.json).filter((r) => r.lead_id);
const handlowcy = $('Pobierz handlowców').all().map((i) => i.json).filter((r) => r.handlowiec_id);

// Pamięć przetworzonych wiadomości – n8n zapisuje ją tylko w przebiegach aktywnego workflow (nie przy ręcznym teście)
const pamiec = $getWorkflowStaticData('global');
const zrobione = new Set(pamiec.wa || []);
const nowe = wiadomosci.filter((m) => !zrobione.has(m.idMessage)).sort((a, b) => (a.timestamp || 0) - (b.timestamp || 0));
pamiec.wa = [...zrobione, ...nowe.map((m) => m.idMessage)].slice(-500);

return processWaReplies(nowe, rows, handlowcy, cfg, nowWarsaw()).map((w) => ({ json: w }));
