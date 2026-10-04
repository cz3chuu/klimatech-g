// === Węzeł Code: "Historia SLA" (workflow C, tryb: Run Once for All Items) ===
const opis = { 1: 'przypomnienie 4h', 2: 'po SLA (1 dzień)', 3: 'eskalacja do Marka (2 dni)' };
return $('Sprawdź SLA').all().map((i) => ({
  json: {
    czas: i.json.aktualizacja,
    lead_id: i.json.lead_id,
    zdarzenie: 'sla',
    szczegoly: `${opis[i.json.sla_poziom]}; czeka ${i.json._sla.minuty} min roboczych; powiadomienie do ${i.json._sla.do.nazwa}`,
  },
}));
