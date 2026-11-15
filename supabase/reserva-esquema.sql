-- Esquema de la reserva (14/11/2026): las mismas tablas que en Supabase,
-- para el Postgres propio que usa lib/datos/cliente.cjs con DATOS_PG_URL.
create table if not exists app_documents (
  key         text primary key,
  kind        text not null default 'generic',
  data        jsonb not null default '{}'::jsonb,
  updated_at  timestamptz not null default now()
);
create index if not exists app_documents_kind_idx on app_documents (kind);

create table if not exists general_seasons (
  id          bigserial primary key,
  season      text not null,
  data        jsonb not null default '[]'::jsonb,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz default now()
);
create index if not exists general_seasons_season_idx on general_seasons (season, updated_at desc);

create table if not exists performance_seasons (
  id          bigserial primary key,
  season      text not null,
  data        jsonb not null default '[]'::jsonb,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz default now()
);
create index if not exists performance_seasons_season_idx on performance_seasons (season, updated_at desc);

-- Valoraciones (15/11/2026): faltaba y /individual, /comparative_ind y
-- /dashboard-plantilla daban 500. La temporada en blanco lleva fecha de 1970
-- para que, al traer la de Supabase con datos-copia.mjs, gane la de verdad.
create table if not exists match_ratings (
  season      text primary key,
  data        jsonb not null default '{}'::jsonb,
  updated_at  timestamptz not null default now()
);
insert into match_ratings (season, data, updated_at)
values ('2026-2027', '{"season":"2026-2027","matches":{},"updatedAt":""}'::jsonb, 'epoch')
on conflict (season) do nothing;
