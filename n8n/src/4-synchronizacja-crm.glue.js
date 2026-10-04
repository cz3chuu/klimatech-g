// === Węzeł Code: "Przygotuj dane" (workflow 4 – Synchronizacja z CRM, tryb: Run Once for All Items) ===
// Arkusz -> Supabase. Zwraca 3 paczki (handlowcy, leady, historia) do wysłania jako upsert przez REST API.
const now = nowWarsaw();
const tekst = (v) => (v === '' || v === undefined || v === null ? null : String(v));
const liczba = (v) => (v === '' || v === undefined || v === null || isNaN(Number(v)) ? null : Number(v));
const data = (v) => (parseLocal(v) ? String(v).trim().slice(0, 16) : null);
function skrot(s) { // FNV-1a 64-bit (2×32) – stabilny identyfikator wpisu historii
  let h1 = 0x811c9dc5, h2 = 0x01000193;
  for (let i = 0; i < s.length; i++) { const c = s.charCodeAt(i); h1 = Math.imul(h1 ^ c, 16777619); h2 = Math.imul(h2 ^ c, 2246822519); }
  return (h1 >>> 0).toString(16).padStart(8, '0') + (h2 >>> 0).toString(16).padStart(8, '0');
}

const handlowcy = $('Pobierz handlowców').all().map((i) => i.json).filter((r) => r.handlowiec_id).map((r) => ({
  handlowiec_id: r.handlowiec_id, imie_nazwisko: tekst(r.imie_nazwisko), email: tekst(r.email), wojewodztwa: tekst(r.wojewodztwa), whatsapp: tekst(r.whatsapp),
}));

const TEKSTOWE = ['zrodlo', 'firma', 'osoba', 'email', 'telefon', 'miasto', 'wojewodztwo', 'zainteresowanie', 'wiadomosc', 'telefon_norm', 'firma_klucz',
  'wojewodztwo_zrodlo', 'routing', 'handlowiec_id', 'handlowiec', 'duplikat_of', 'duplikat_typ', 'duplikat_powod', 'status', 'kontakt_kto', 'notatka'];
const leady = $('Pobierz leady').all().map((i) => i.json).filter((r) => r.lead_id).map((r) => {
  const row = { lead_id: r.lead_id };
  TEKSTOWE.forEach((k) => { row[k] = tekst(r[k]); });
  Object.assign(row, {
    data_zgloszenia: data(r.data_zgloszenia), pierwszy_kontakt: data(r.pierwszy_kontakt), aktualizacja: data(r.aktualizacja),
    szac_wartosc_pln: liczba(r.szac_wartosc_pln), proby: liczba(r.proby), sla_poziom: liczba(r.sla_poziom),
    klient_id: r.duplikat_typ === 'pewny' && r.duplikat_of ? r.duplikat_of : r.lead_id,
    sla_start: slaStart(r.data_zgloszenia),
    czas_reakcji_min: r.pierwszy_kontakt ? businessMinutes(r.data_zgloszenia, r.pierwszy_kontakt) : null,
    czeka_min: r.pierwszy_kontakt ? null : businessMinutes(r.data_zgloszenia, now),
    zsynchronizowano: now,
  });
  return row; // token celowo pomijamy – to sekret linków w mailach
});

const historia = $('Pobierz historię').all().map((i) => i.json).filter((h) => h.lead_id && h.czas).map((h) => ({
  id: skrot(`${h.czas}|${h.lead_id}|${h.zdarzenie}|${h.szczegoly}`),
  czas: data(h.czas), lead_id: h.lead_id, zdarzenie: tekst(h.zdarzenie), kto: tekst(h.kto), szczegoly: tekst(h.szczegoly),
}));
// ten sam wpis dwa razy w arkuszu -> jeden w bazie (upsert nie przyjmie duplikatu w jednej paczce)
const unikalna = [...new Map(historia.map((h) => [h.id, h])).values()];

return [
  { json: { tabela: 'handlowcy', on_conflict: 'handlowiec_id', prefer: 'resolution=merge-duplicates,return=minimal', rows: handlowcy } },
  { json: { tabela: 'leady', on_conflict: 'lead_id', prefer: 'resolution=merge-duplicates,return=minimal', rows: leady } },
  { json: { tabela: 'historia', on_conflict: 'id', prefer: 'resolution=ignore-duplicates,return=minimal', rows: unikalna } },
].filter((p) => p.json.rows.length);
