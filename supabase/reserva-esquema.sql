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
