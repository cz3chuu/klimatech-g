-- =====================================================================
-- KLIMATECH – MIGRACJA: ZESPÓŁ W CRM (handlowcy, nieobecności, administratorzy)
-- Uruchom raz w Supabase: SQL Editor -> New query -> wklej -> Run (po schema.sql).
-- Od teraz dane zespołu są edytowane w CRM (zakładka „Zespół”) i trafiają do arkusza
-- (zakładki Handlowcy i Nieobecności) przez workflow 4 – arkusz jest ich podglądem.
-- Zmieniać mogą tylko administratorzy (tabela crm_admini), czytać – każdy zalogowany.
-- =====================================================================

-- Handlowiec: data odejścia (po niej nie dostaje leadów) i znacznik zmiany
alter table public.handlowcy add column if not exists aktywny_do date;
alter table public.handlowcy add column if not exists zmieniono timestamptz default now();

-- Lead: za kogo obsłużony w zastępstwie (ważne przy prowizjach)
alter table public.leady add column if not exists zastepstwo_za text;

-- Nieobecności: urlop, L4, szkolenie… z zastępcą. Usuwanie = anulowanie (zostaje ślad).
create table if not exists public.nieobecnosci (
  id           uuid primary key default gen_random_uuid(),
  handlowiec_id text not null references public.handlowcy(handlowiec_id),
  od_dnia      date not null,
  do_dnia      date,                       -- puste = bezterminowo (np. odejście do czasu zatrudnienia następcy)
  zastepca_id  text references public.handlowcy(handlowiec_id),
  powod        text,
  anulowana    boolean not null default false,
  utworzyl     text,
  utworzono    timestamptz not null default now(),
  constraint nieobecnosci_daty check (do_dnia is null or do_dnia >= od_dnia),
  constraint nieobecnosci_zastepca check (zastepca_id is null or zastepca_id <> handlowiec_id)
);
create index if not exists nieobecnosci_handlowiec_idx on public.nieobecnosci (handlowiec_id, od_dnia);

-- Administratorzy CRM (mogą edytować zespół)
create table if not exists public.crm_admini (email text primary key);

create or replace function public.czy_admin() returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.crm_admini where lower(email) = lower(auth.jwt() ->> 'email'));
$$;
revoke all on function public.czy_admin() from public;
grant execute on function public.czy_admin() to authenticated;

-- Zasady dostępu
alter table public.nieobecnosci enable row level security;
alter table public.crm_admini  enable row level security;

drop policy if exists "odczyt dla zalogowanych" on public.nieobecnosci;
drop policy if exists "zmiany tylko admin" on public.nieobecnosci;
drop policy if exists "zmiany tylko admin" on public.handlowcy;
drop policy if exists "dodawanie tylko admin" on public.handlowcy;
drop policy if exists "dodawanie tylko admin" on public.nieobecnosci;
drop policy if exists "własny wpis" on public.crm_admini;

create policy "odczyt dla zalogowanych" on public.nieobecnosci for select to authenticated using (true);
create policy "dodawanie tylko admin"   on public.nieobecnosci for insert to authenticated with check (public.czy_admin());
create policy "zmiany tylko admin"      on public.nieobecnosci for update to authenticated using (public.czy_admin()) with check (public.czy_admin());
create policy "dodawanie tylko admin"   on public.handlowcy    for insert to authenticated with check (public.czy_admin());
create policy "zmiany tylko admin"      on public.handlowcy    for update to authenticated using (public.czy_admin()) with check (public.czy_admin());
-- każdy zalogowany widzi tylko, czy sam jest administratorem
create policy "własny wpis" on public.crm_admini for select to authenticated using (lower(email) = lower(auth.jwt() ->> 'email'));

grant select, insert, update on public.handlowcy, public.nieobecnosci to authenticated;
grant select on public.crm_admini to authenticated;
grant all on public.handlowcy, public.nieobecnosci, public.crm_admini to service_role;
-- (usuwania handlowców i nieobecności celowo nie ma: odejście = aktywny_do, nieobecność = anulowana)

-- >>> WPISZ ADRES, którym logujesz się do CRM (i ewentualnie Marka / Ani), potem Run:
insert into public.crm_admini (email) values ('TWOJ-EMAIL-DO-CRM@example.com') on conflict do nothing;
