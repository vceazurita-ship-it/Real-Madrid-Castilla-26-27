# Valoraciones de partido

Nota de cada jugador en cada partido, guardada para siempre y compartida por
`/ratings` (equipo) y la pestaña **Valoraciones** de `/individual`.

## Dónde se guarda

Todo el histórico de una temporada es un único JSON:

```
RatingsSeason
 └── matches: { [idPartido]: { match, players: { [idJugador]: PlayerRating } } }
```

`lib/ratings/store.ts` lo escribe en Supabase con dos destinos, en este orden:

1. **Tabla `match_ratings`** — destino preferente.
2. **Bucket privado `ratings`** (`2026-2027.json`) — se usa mientras la tabla no
   exista, para que el módulo funcione desde el primer día.

En cuanto se cree la tabla, la primera lectura migra automáticamente lo que
hubiera en el bucket y a partir de ahí manda la tabla. No hay que exportar nada
a mano.

## SQL para crear la tabla (opcional)

En el editor SQL de Supabase:

```sql
create table if not exists public.match_ratings (
  season      text primary key,
  data        jsonb not null default '{}'::jsonb,
  updated_at  timestamptz not null default now()
);

alter table public.match_ratings enable row level security;
```

No hacen falta políticas: las rutas de `/api/ratings/*` entran con la
`SUPABASE_SERVICE_ROLE_KEY`, que salta RLS. Dejar RLS activo sin políticas es
justo lo que impide que nadie lea el histórico con la clave pública.

## De dónde salen los partidos

Del mismo CSV que alimenta `/match-plans` (`lib/ratings/matches.ts`). El id de
un partido es `fecha-rival`, así que se mantiene estable aunque se reordene la
hoja. Los partidos añadidos a mano llevan el prefijo `m-` y viven dentro del
propio histórico.

## Jugadores

De `hooks/usePlayers` (hoja de plantilla). Las posiciones son las de la hoja
—`PORTERO`, `CENTRAL`, `LATERAL D./I.`, `6`, `8`, `10`, `7`, `11`, `9`— y son
las que coloca el campograma de `lib/ratings/pitch.ts`.
