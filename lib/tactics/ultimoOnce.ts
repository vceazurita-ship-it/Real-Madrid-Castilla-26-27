/*
|--------------------------------------------------------------------------
| NUESTRO ÚLTIMO ONCE (23/10/2026)
|--------------------------------------------------------------------------
|
| Los titulares del último partido según Valoraciones, repartidos por hueco
| con `proponeOnce`. Aparte de `oncesSemana` porque lo usan también Duelos y
| el informe del partido, que no tienen por qué cargar el calendario.
*/

import { casaNombre, proponeOnce, sitioDe, type Candidato } from "@/lib/data-analisis/once";
import type { RatingsSeason } from "@/lib/ratings/types";
import type { Player } from "@/types/player";

/**
 * Quién ocupa cada hueco en nuestro último once (hueco → id de la ficha).
 *
 * Es el reparto que usa la pizarra y que, desde el 23/10/2026, también toma
 * Duelos como punto de partida: una sola fuente para «nuestro once de la
 * semana».
 */
export function huecosDelUltimoOnce(temporada: RatingsSeason | null, plantilla: Player[], aMano: Record<string, string> = {}) {
  const hoy = new Date().toISOString().slice(0, 10);
  const partidos = Object.values(temporada?.matches ?? {})
    .filter((m) => !(temporada?.ocultos ?? []).includes(m.match.id))
    .filter((m) => m.match.date && m.match.date <= hoy)
    .map((m) => ({ m, titulares: Object.values(m.players).filter((p) => p.starter) }))
    /* Un partido a medio valorar (el J7 tenía seis titulares marcados) sigue siendo el último: lo que falte sale del anterior. */
    .filter((x) => x.titulares.length >= 5)
    .sort((a, b) => b.m.match.date.localeCompare(a.m.match.date));

  const ultimo = partidos[0];
  const anterior = partidos.find((x, i) => i > 0 && x.titulares.length >= 9) ?? partidos[1];
  /* Toda la plantilla: un titular con licencia del RMC o del Juvenil A también cuenta (14/10/2026).
     Para tapar un hueco, antes uno con ficha del Castilla (1 frente a 0). */
  const delCastilla = plantilla.filter((p) => p.activo !== false);
  const porId = new Map(plantilla.map((p) => [p.id, p]));

  /*
  | Los titulares del último partido primero; si no llegan a once, los del
  | anterior; y el resto de la plantilla sólo para tapar un hueco que quede.
  */
  const peso = new Map<string, number>();

  for (const t of anterior?.titulares ?? []) peso.set(t.playerId, 5_000);
  for (const t of ultimo?.titulares ?? []) peso.set(t.playerId, 10_000);

  const completado = (ultimo?.titulares.length ?? 0) < 11 && anterior && anterior !== ultimo;
  const candidatos: Candidato[] = delCastilla.map((p) => ({ id: p.id, sitio: sitioDe(String(p.posicion ?? ""), null), minutos: peso.get(p.id) ?? (p.esCastilla === false ? 0 : 1) }));

  /*
  | Lo cambiado a mano en Duelos (`duelos:<rival>`, lado «nuestro») manda sobre
  | la propuesta, como ya pasa con el once rival. Duelos lo guarda con la clave
  | de Wyscout (o `plantilla:<id>`): aquí se vuelve a la ficha.
  */
  const elegidos: Record<string, string> = {};

  for (const [hueco, clave] of Object.entries(aMano)) {
    if (!clave || clave === "∅") continue;

    const id = clave.startsWith("plantilla:")
      ? clave.slice("plantilla:".length)
      : (casaNombre(clave, plantilla, (p) => p.nombre) ?? casaNombre(clave, plantilla, (p) => p.apodo ?? ""))?.id;

    if (id && porId.has(id)) elegidos[hueco] = id;
  }

  const huecos = proponeOnce(candidatos, elegidos);

  for (const [hueco, clave] of Object.entries(aMano)) if (clave === "∅") huecos[hueco] = "";

  return { huecos, ultimo, anterior, completado, porId };
}

/** Lo que se pone en el pie del once: de qué partido sale. */
export function fuenteUltimoOnce(r: ReturnType<typeof huecosDelUltimoOnce>) {
  const { ultimo, anterior, completado } = r;

  return ultimo
    ? `Nuestro último once: ${ultimo.m.match.opponent}${ultimo.m.match.result ? ` (${ultimo.m.match.result})` : ""}, ${ultimo.m.match.date.split("-").reverse().join("/")}${completado ? ` (completado con el de ${anterior!.m.match.opponent}: faltan titulares por marcar en Valoraciones)` : ""}`
    : "Sin titulares en Valoraciones: once por puesto de la plantilla";
}
