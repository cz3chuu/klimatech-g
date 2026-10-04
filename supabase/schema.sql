-- =====================================================================
-- KLIMATECH – MINI CRM (Supabase / PostgreSQL)
-- Uruchom raz w Supabase: SQL Editor -> New query -> wklej -> Run.
-- Dane wpisuje n8n (workflow E – synchronizacja z arkusza, klucz secret/service_role).
-- Strona CRM tylko czyta – wyłącznie po zalogowaniu (Supabase Auth, RLS).
-- Daty: czas lokalny Warszawy (jak w arkuszu), typ timestamp bez strefy.
-- =====================================================================

create table if not exists public.handlowcy (
  handlowiec_id  text primary key,
  imie_nazwisko  text not null,
  email          text,
  wojewodztwa    text,                 -- "mazowieckie;łódzkie"
  whatsapp       text
);

create table if not exists public.leady (
  lead_id             text primary key,
  data_zgloszenia     timestamp,
  zrodlo              text,
  firma               text,
  osoba               text,
  email               text,
  telefon             text,
  miasto              text,
  wojewodztwo         text,
  zainteresowanie     text,
  szac_wartosc_pln    numeric,
  wiadomosc           text,
  telefon_norm        text,
  firma_klucz         text,
  wojewodztwo_zrodlo  text,
  routing             text,             -- handlowiec | bez_opiekuna | do_ustalenia
  handlowiec_id       text,
  handlowiec          text,
  duplikat_of         text,
  duplikat_typ        text,             -- pewny | mozliwy
  duplikat_powod      text,
  status              text,             -- nowy | nie_odebral | dodzwoniono | umowione | niezainteresowany
  pierwszy_kontakt    timestamp,
  kontakt_kto         text,
  proby               integer,
  sla_poziom          integer,
  notatka             text,             -- ostatnia notatka z rozmowy
  aktualizacja        timestamp,
  -- wyliczane przez rdzeń przy synchronizacji (minuty robocze pn–pt 8–16, bez świąt)
  klient_id           text,             -- lead pierwotny: wszystkie zgłoszenia tego samego klienta
  sla_start           timestamp,
  czas_reakcji_min    integer,
  czeka_min           integer,
  zsynchronizowano    timestamp
);
create index if not exists leady_klient_idx on public.leady (klient_id);
create index if not exists leady_handlowiec_idx on public.leady (handlowiec_id);

create table if not exists public.historia (
  id         text primary key,          -- skrót z (czas, lead, zdarzenie, szczegóły) – synchronizacja bez duplikatów
  czas       timestamp,
  lead_id    text,
  zdarzenie  text,                      -- import | utworzono | duplikat | przypisano | powiadomienie | status | sla
  kto        text,
  szczegoly  text
);
create index if not exists historia_lead_idx on public.historia (lead_id, czas);

-- Bezpieczeństwo: odczyt tylko dla zalogowanych (Marek, Ania); zapis tylko n8n (secret/service_role omija RLS)
alter table public.handlowcy enable row level security;
alter table public.leady     enable row level security;
alter table public.historia  enable row level security;

drop policy if exists "odczyt dla zalogowanych" on public.handlowcy;
drop policy if exists "odczyt dla zalogowanych" on public.leady;
drop policy if exists "odczyt dla zalogowanych" on public.historia;
create policy "odczyt dla zalogowanych" on public.handlowcy for select to authenticated using (true);
create policy "odczyt dla zalogowanych" on public.leady     for select to authenticated using (true);
create policy "odczyt dla zalogowanych" on public.historia  for select to authenticated using (true);

revoke all on public.handlowcy, public.leady, public.historia from anon;
grant select on public.handlowcy, public.leady, public.historia to authenticated;
grant all on public.handlowcy, public.leady, public.historia to service_role;
