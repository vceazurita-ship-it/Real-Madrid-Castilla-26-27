/**
 * RECUPERAR LAS NOTAS DE LAS VALORACIONES (16/11/2026).
 *
 *   node --env-file=.env.local scripts/valoraciones-recupera.mjs --desde <match_ratings.json>           en seco
 *   node --env-file=.env.local scripts/valoraciones-recupera.mjs --desde <match_ratings.json> --hacer   escribe
 *
 * Supabase se cortó el 13/11 y la base de reserva (DATOS_PG_URL) arrancó con
 * `match_ratings` vacío: BeSoccer la ha ido rellenando cada noche con minutos,
 * titular, goles y tarjetas, pero las NOTAS del cuerpo técnico se quedaron en
 * Supabase. `datos-copia.mjs` no vale para traerlas: copia la fila entera y
 * gana la de `updated_at` más nuevo, que es la de la reserva, sin notas.
 *
 * Aquí se mezcla jugador a jugador:
 *   - de Supabase: rating, note, areas, unrated (lo que pone el cuerpo técnico);
 *   - de la reserva: lo demás (BeSoccer) y cualquier nota puesta DESPUÉS del
 *     corte (rating > 0, nota o «sin valorar» en la reserva → manda la reserva).
 * Un partido que en la reserva tiene otro id (BeSoccer lo creó como
 * m-<fecha>-<rival>) se empareja por fecha ±1 día y queda con el id de
 * Supabase, que es el que conocían las demás pantallas.
 *
 * `--desde`: el JSON de la fila de Supabase tal cual sale del editor SQL
 * (`select season, data, updated_at from match_ratings`): una lista de filas o
 * una sola, con `data` como objeto o como texto.
 *
 * La escritura es condicional sobre el `updated_at` leído: si alguien guarda
 * una valoración en medio, no se escribe nada y hay que volver a lanzarlo.
 */

import fs from "node:fs";
import postgres from "postgres";

const arg = (n) => {
  const i = process.argv.indexOf(`--${n}`);

  return i > 0 ? process.argv[i + 1] : null;
};

const DESDE = arg("desde");
const HACER = process.argv.includes("--hacer");
const TEMPORADA = arg("temporada") ?? "2026-2027";
const URL_PG = process.env.DATOS_PG_URL;

if (!DESDE || !URL_PG) {
  console.error("Uso: node --env-file=.env.local scripts/valoraciones-recupera.mjs --desde <json> [--hacer]  (hace falta DATOS_PG_URL)");
  process.exit(1);
}

const EVALUA = ["rating", "note", "areas", "unrated"];

const filas = [JSON.parse(fs.readFileSync(DESDE, "utf8"))].flat();
const filaSb = filas.find((f) => (f.season ?? f.data?.season) === TEMPORADA);

if (!filaSb) {
  console.error(`No hay fila de ${TEMPORADA} en ${DESDE} (temporadas: ${filas.map((f) => f.season).join(", ")})`);
  process.exit(1);
}

const sb = typeof filaSb.data === "string" ? JSON.parse(filaSb.data) : filaSb.data;

const sql = postgres(URL_PG, { max: 1, ssl: /localhost|127\.0\.0\.1/.test(URL_PG) ? false : "require", prepare: false, connect_timeout: 20, onnotice: () => {} });

const [fila] = await sql`select data, updated_at from match_ratings where season = ${TEMPORADA}`;
const reserva = fila?.data ?? { season: TEMPORADA, matches: {} };
const leidoEn = fila?.updated_at ?? null;

const dia = (iso) => Date.parse(`${String(iso).slice(0, 10)}T12:00:00Z`);
const tieneEvaluacion = (p) => (Number(p?.rating) || 0) > 0 || !!String(p?.note ?? "").trim() || p?.unrated === true || Object.keys(p?.areas ?? {}).length > 0;

const salida = structuredClone(reserva);
salida.matches ??= {};

const cuenta = { partidos: 0, emparejadosPorFecha: 0, soloSupabase: 0, notasTraidas: 0, notasQueSeQuedan: 0, jugadoresNuevos: 0 };

for (const [idSb, partidoSb] of Object.entries(sb.matches ?? {})) {
  cuenta.partidos++;

  /* El mismo partido en la reserva: por id o por fecha (±1 día). */
  let idRes = salida.matches[idSb] ? idSb : null;

  if (!idRes && partidoSb.match?.date) {
    idRes =
      Object.keys(salida.matches).find((k) => {
        const d = salida.matches[k].match?.date;

        return d && Math.abs(dia(d) - dia(partidoSb.match.date)) <= 86_400_000;
      }) ?? null;

    if (idRes) cuenta.emparejadosPorFecha++;
  }

  if (!idRes) {
    salida.matches[idSb] = partidoSb;
    cuenta.soloSupabase++;
    cuenta.notasTraidas += Object.values(partidoSb.players ?? {}).filter(tieneEvaluacion).length;
    continue;
  }

  const res = salida.matches[idRes];
  const jugadores = { ...(res.players ?? {}) };

  for (const [jid, pSb] of Object.entries(partidoSb.players ?? {})) {
    const pRes = jugadores[jid];

    if (!pRes) {
      jugadores[jid] = pSb;
      cuenta.jugadoresNuevos++;
      if (tieneEvaluacion(pSb)) cuenta.notasTraidas++;
      continue;
    }

    if (tieneEvaluacion(pRes)) {
      cuenta.notasQueSeQuedan++;
      continue;
    }

    if (tieneEvaluacion(pSb)) {
      const p = { ...pRes };

      for (const k of EVALUA) if (pSb[k] !== undefined) p[k] = pSb[k];

      jugadores[jid] = p;
      cuenta.notasTraidas++;
    }
  }

  const unido = { ...res, match: { ...partidoSb.match, ...res.match, id: idSb }, players: jugadores };

  for (const k of Object.keys(partidoSb)) if (!(k in unido)) unido[k] = partidoSb[k];

  if (idRes !== idSb) delete salida.matches[idRes];

  salida.matches[idSb] = unido;
}

salida.updatedAt = new Date().toISOString();

console.log(`Supabase: ${Object.keys(sb.matches ?? {}).length} partidos · reserva: ${Object.keys(reserva.matches ?? {}).length} · resultado: ${Object.keys(salida.matches).length}`);
console.log(cuenta);

if (!HACER) {
  fs.writeFileSync(DESDE.replace(/\.json$/, "") + ".mezcla.json", JSON.stringify(salida, null, 1));
  console.log("En seco: la mezcla está en *.mezcla.json; añade --hacer para escribirla.");
  await sql.end();
  process.exit(0);
}

const r = leidoEn
  ? await sql`update match_ratings set data = ${sql.json(salida)}, updated_at = date_trunc('milliseconds', now()) where season = ${TEMPORADA} and updated_at = ${leidoEn}`
  : await sql`insert into match_ratings (season, data, updated_at) values (${TEMPORADA}, ${sql.json(salida)}, date_trunc('milliseconds', now())) on conflict (season) do nothing`;

console.log(r.count === 1 ? "Escrito." : "NO escrito: alguien guardó en medio. Vuelve a lanzarlo.");

await sql.end();
