-- Schéma Supabase du plan de métro (V2 : tracés en segments, éditeur intégré).
-- À exécuter une fois dans l'éditeur SQL de Supabase.
-- Les qualifieurs et connecteurs sont des listes fermées définies dans le code (data/*.ts) ;
-- les contraintes CHECK ci-dessous doivent rester synchronisées avec ces fichiers.

create table if not exists collections (
  id text primary key,               -- 'main' pour la carte unique
  title text not null default 'Nouvelle carte',
  subtitle text not null default '',
  viewpoint text not null default 'organisation',
  created_at timestamptz not null default now()
);

create table if not exists lines (
  id uuid primary key,
  collection_id text not null references collections(id) on delete cascade,
  name text not null,
  color text not null default '#a51d34',
  parent_station_id uuid,            -- null = ligne principale ; pas de clé étrangère (dépendance circulaire)
  origin_x real not null default 0,
  origin_y real not null default 0,
  steps jsonb not null default '[]', -- [{ "dir": "S", "len": 170 }, ...]
  position int not null default 0
);

create table if not exists stations (
  id uuid primary key,
  line_id uuid not null references lines(id) on delete cascade,
  dist real not null default 0,      -- distance le long du tracé de la ligne
  qualifier text not null check (
    qualifier in ('acteur','role','collaboration','interface','processus','fonction','evenement','service')
  ),
  title text not null default '',
  description text,
  image_path text,                   -- nom du fichier dans le bucket « cards »
  source text,
  url text
);

create table if not exists tasks (
  id uuid primary key,
  station_id uuid not null references stations(id) on delete cascade,
  label text not null,
  description text,
  position int not null default 0
);

create table if not exists links (
  id uuid primary key,
  collection_id text not null references collections(id) on delete cascade,
  from_station_id uuid not null references stations(id) on delete cascade,
  to_station_id uuid not null references stations(id) on delete cascade,
  connector text not null check (
    connector in ('assignment','serving','flow','triggering','association')
  ),
  label text
);

alter table collections enable row level security;
alter table lines enable row level security;
alter table stations enable row level security;
alter table tasks enable row level security;
alter table links enable row level security;

-- Lecture publique.
create policy "lecture publique" on collections for select using (true);
create policy "lecture publique" on lines for select using (true);
create policy "lecture publique" on stations for select using (true);
create policy "lecture publique" on tasks for select using (true);
create policy "lecture publique" on links for select using (true);

-- ⚠️ ÉCRITURE OUVERTE À TOUS — TEMPORAIRE, le temps de la phase sans mot de passe.
-- Quiconque connaît l'URL du projet et la clé anon peut modifier la carte.
-- Avant la mise en ligne publique : supprimer ces policies et les remplacer par
-- « to authenticated using (auth.email() in ('toi@…', 'collegue@…')) ».
create policy "ecriture ouverte" on collections for all using (true) with check (true);
create policy "ecriture ouverte" on lines for all using (true) with check (true);
create policy "ecriture ouverte" on stations for all using (true) with check (true);
create policy "ecriture ouverte" on tasks for all using (true) with check (true);
create policy "ecriture ouverte" on links for all using (true) with check (true);

-- Images : bucket public « cards », envoi ouvert (même réserve que ci-dessus).
insert into storage.buckets (id, name, public) values ('cards', 'cards', true)
  on conflict (id) do nothing;
create policy "cards lecture" on storage.objects for select using (bucket_id = 'cards');
create policy "cards envoi ouvert" on storage.objects for insert with check (bucket_id = 'cards');
