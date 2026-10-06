// === Węzeł Code: "Obsłuż" (workflow 2 – Obsługa co minutę, tryb: Run Once for All Items) ===
// Skrzynka „Wpisz lead” -> odpowiedzi z WhatsAppa -> SLA (co 15 min, przy teście ręcznym zawsze) -> poranny raport (raz dziennie).
// TERAZ w Konfiguracji (np. "2026-10-05 10:00") symuluje czas – do demo poza godzinami pracy.
const cfg = { ...$('Konfiguracja').first().json, WYJATKI: $('Pobierz wyjątki').all().map((i) => i.json).filter((w) => w.dopasowanie) };
const now = String(cfg.TERAZ || '').trim() || nowWarsaw();
const rows = $('Pobierz leady').all().map((i) => i.json).filter((r) => r.lead_id);
const handlowcy = $('Pobierz handlowców').all().map((i) => i.json).filter((r) => r.handlowiec_id);
const wpisy = $('Pobierz skrzynkę').all().map((i) => i.json).filter((r) => r.row_number); // brak zakładki = brak wpisów
const wszystkie = [...$('Pobierz wiadomości').all(), ...$('Pobierz wysłane').all()].map((i) => i.json).filter((m) => m && m.idMessage);

// Pamięć przetworzonych wiadomości WhatsApp – n8n zapisuje ją w przebiegach aktywnego workflow
const pamiec = $getWorkflowStaticData('global');
const zrobione = new Set(pamiec.wa || []);
const unikalne = [...new Map(wszystkie.map((m) => [m.idMessage, m])).values()]; // ta sama wiadomość w obu listach = jedna
const wiadomosci = unikalne.filter((m) => !zrobione.has(m.idMessage)).sort((a, b) => (a.timestamp || 0) - (b.timestamp || 0));
pamiec.wa = [...zrobione, ...wiadomosci.map((m) => m.idMessage)].slice(-500);

const sla = $execution.mode === 'manual' || !!String(cfg.TERAZ || '').trim() || Number(now.slice(14, 16)) % 15 === 0;

// Poranny raport: raz na dzień roboczy, przy pierwszym przebiegu od 8:00 (gdy n8n o 8:00 nie działał – przy następnym).
// RAPORT_TERAZ = true w Konfiguracji wymusza raport (test ręczny).
const dzis = now.slice(0, 10);
const raport = isBusinessTime(now) && (pamiec.raport !== dzis || String(cfg.RAPORT_TERAZ) === 'true');
if (raport) pamiec.raport = dzis;

const wynik = processCycle({ wpisy, wiadomosci, rows, handlowcy, cfg, now, sla, raport });
return wynik.cokolwiek ? [{ json: wynik }] : [];
