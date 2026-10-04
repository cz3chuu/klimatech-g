// === Węzeł Code: "Sprawdź SLA" (workflow C, tryb: Run Once for All Items) ===
// Zwraca jeden item na lead, który przekroczył kolejny próg SLA. Pusta lista = koniec przebiegu.
// TERAZ w Konfiguracji (np. "2026-10-05 10:00") symuluje czas – do demo poza godzinami pracy. Puste = czas rzeczywisty.
const cfg = $('Konfiguracja').first().json;
const rows = $('Pobierz leady').all().map((i) => i.json).filter((r) => r.lead_id);
const handlowcy = $('Pobierz handlowców').all().map((i) => i.json).filter((r) => r.handlowiec_id);
const now = String(cfg.TERAZ || '').trim() || nowWarsaw();

return checkSla(rows, handlowcy, cfg, now).map((it) => ({
  json: { lead_id: it.lead_id, sla_poziom: it.poziom, aktualizacja: now, _sla: it },
}));
