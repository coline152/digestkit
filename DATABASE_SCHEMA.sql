-- ============================================================
-- DIGESTKIT - DATABASE SCHEMA (v3 META ARCHITECTURE)
-- Supabase / PostgreSQL
-- Last update: 28-02-2026
-- ============================================================

-- ============================================================
-- EXTENSIONS (needed for gen_random_uuid)
-- ============================================================
create extension if not exists "pgcrypto";

-- ============================================================
-- TABLE: daily_entries
-- 1 row per user per day
-- Meta JSONB stores flexible modules data:
-- - pain_unusual (boolean)
-- - pain_spots (array of {zone,text})
-- - mood_tags (array of mood_states ids)
-- - mood_note (string)
-- - symptom_tags (array of symptom_states ids)
-- - symptom_note (string)
-- - custom_sections_notes (object: { sectionId: "note du jour" })
-- ============================================================
create table if not exists daily_entries (
  user_id uuid references auth.users(id) on delete cascade,
  entry_date date not null,

  -- Douleurs
  pain_level integer,

  -- Moral
  mood_level integer,

  -- Stockage flexible
  meta jsonb default '{}'::jsonb,
  notes text, -- legacy (v1/v2). kept for migration / fallback if needed

  created_at timestamp with time zone default now(),
  updated_at timestamp with time zone default now(),

  primary key (user_id, entry_date)
);

-- Optional: keep meta as an object (prevents accidental arrays/strings)
alter table daily_entries
  add constraint if not exists daily_entries_meta_is_object
  check (jsonb_typeof(meta) = 'object');

-- ============================================================
-- TABLE: mood_states
-- États personnalisables du moral (persistants)
-- ============================================================
create table if not exists mood_states (
  id uuid default gen_random_uuid() primary key,
  user_id uuid references auth.users(id) on delete cascade,
  label text not null,
  created_at timestamp with time zone default now(),
  unique (user_id, label)
);

-- ============================================================
-- TABLE: symptom_states
-- États personnalisables des symptômes (persistants)
-- ============================================================
create table if not exists symptom_states (
  id uuid default gen_random_uuid() primary key,
  user_id uuid references auth.users(id) on delete cascade,
  label text not null,
  created_at timestamp with time zone default now(),
  unique (user_id, label)
);

-- ============================================================
-- TABLE: custom_sections
-- Sections personnalisées persistantes créées via bouton "+"
-- La description quotidienne est stockée dans daily_entries.meta.custom_sections_notes
-- ============================================================
create table if not exists custom_sections (
  id uuid default gen_random_uuid() primary key,
  user_id uuid references auth.users(id) on delete cascade,
  label text not null,
  created_at timestamp with time zone default now(),
  unique (user_id, label)
);

-- ============================================================
-- TABLE: user_consents
-- ============================================================
create table if not exists user_consents (
  id uuid default gen_random_uuid() primary key,
  user_id uuid references auth.users(id) on delete cascade,
  consent_version text not null,
  consent_text text not null,
  accepted_at timestamp with time zone default now()
);

-- ============================================================
-- ENABLE ROW LEVEL SECURITY
-- ============================================================
alter table daily_entries enable row level security;
alter table mood_states enable row level security;
alter table symptom_states enable row level security;
alter table custom_sections enable row level security;
alter table user_consents enable row level security;

-- ============================================================
-- POLICIES
-- ============================================================

-- daily_entries
drop policy if exists "daily_entries_select_own" on daily_entries;
drop policy if exists "daily_entries_insert_own" on daily_entries;
drop policy if exists "daily_entries_update_own" on daily_entries;
drop policy if exists "daily_entries_delete_own" on daily_entries;

create policy "daily_entries_select_own"
on daily_entries for select
using (auth.uid() = user_id);

create policy "daily_entries_insert_own"
on daily_entries for insert
with check (auth.uid() = user_id);

create policy "daily_entries_update_own"
on daily_entries for update
using (auth.uid() = user_id);

create policy "daily_entries_delete_own"
on daily_entries for delete
using (auth.uid() = user_id);

-- mood_states
drop policy if exists "mood_states_select_own" on mood_states;
drop policy if exists "mood_states_insert_own" on mood_states;
drop policy if exists "mood_states_update_own" on mood_states;
drop policy if exists "mood_states_delete_own" on mood_states;

create policy "mood_states_select_own"
on mood_states for select
using (auth.uid() = user_id);

create policy "mood_states_insert_own"
on mood_states for insert
with check (auth.uid() = user_id);

create policy "mood_states_update_own"
on mood_states for update
using (auth.uid() = user_id);

create policy "mood_states_delete_own"
on mood_states for delete
using (auth.uid() = user_id);

-- symptom_states
drop policy if exists "symptom_states_select_own" on symptom_states;
drop policy if exists "symptom_states_insert_own" on symptom_states;
drop policy if exists "symptom_states_update_own" on symptom_states;
drop policy if exists "symptom_states_delete_own" on symptom_states;

create policy "symptom_states_select_own"
on symptom_states for select
using (auth.uid() = user_id);

create policy "symptom_states_insert_own"
on symptom_states for insert
with check (auth.uid() = user_id);

create policy "symptom_states_update_own"
on symptom_states for update
using (auth.uid() = user_id);

create policy "symptom_states_delete_own"
on symptom_states for delete
using (auth.uid() = user_id);

-- custom_sections
drop policy if exists "custom_sections_select_own" on custom_sections;
drop policy if exists "custom_sections_insert_own" on custom_sections;
drop policy if exists "custom_sections_update_own" on custom_sections;
drop policy if exists "custom_sections_delete_own" on custom_sections;

create policy "custom_sections_select_own"
on custom_sections for select
using (auth.uid() = user_id);

create policy "custom_sections_insert_own"
on custom_sections for insert
with check (auth.uid() = user_id);

create policy "custom_sections_update_own"
on custom_sections for update
using (auth.uid() = user_id);

create policy "custom_sections_delete_own"
on custom_sections for delete
using (auth.uid() = user_id);

-- user_consents
drop policy if exists "user_consents_select_own" on user_consents;
drop policy if exists "user_consents_insert_own" on user_consents;
drop policy if exists "user_consents_delete_own" on user_consents;

create policy "user_consents_select_own"
on user_consents for select
using (auth.uid() = user_id);

create policy "user_consents_insert_own"
on user_consents for insert
with check (auth.uid() = user_id);

create policy "user_consents_delete_own"
on user_consents for delete
using (auth.uid() = user_id);

-- ============================================================
-- TRIGGER: auto update updated_at
-- ============================================================
create or replace function update_updated_at_column()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

drop trigger if exists set_updated_at on daily_entries;

create trigger set_updated_at
before update on daily_entries
for each row
execute procedure update_updated_at_column();

-- ============================================================
-- OPTIONAL INDEXES (performance for meta queries later)
-- ============================================================
-- create index if not exists daily_entries_meta_gin on daily_entries using gin (meta);