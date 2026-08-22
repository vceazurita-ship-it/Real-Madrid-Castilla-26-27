-- ============================================================
--  RMCF Castilla · Almacén genérico de documentos de la app
--  Ejecutar una sola vez en el SQL Editor de Supabase.
-- ============================================================
--  Guarda como JSON las pizarras (sesión, competición, táctica)
--  y el calendario de operativa general. Una fila por documento.
-- ============================================================

create table if not exists public.app_documents (
  key         text primary key,
  kind        text not null default 'generic',
  data        jsonb not null default '{}'::jsonb,
  updated_at  timestamptz not null default now()
);

create index if not exists app_documents_kind_idx
  on public.app_documents (kind);

-- El acceso se hace siempre desde el servidor con la service role key,
-- que ignora RLS. Dejamos RLS activo y sin políticas públicas.
alter table public.app_documents enable row level security;
