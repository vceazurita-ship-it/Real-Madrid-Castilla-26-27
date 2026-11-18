/**
 * LAS MÉTRICAS QUE CUENTAN EN CADA PUESTO (18/11/2026, ronda 23, jueces de
 * fútbol y guionista).
 *
 * El mejor y el peor percentil de un jugador rival se elegían entre TODAS las
 * métricas de Wyscout y salían cosas sin lectura táctica: «Faltas cometidas»
 * como virtud de un central, «Pases hacia adelante» de un portero, «Remates
 * bloqueados» o los remates de un pivote. Aquí vive la lista cerrada por
 * puesto, la única de la app: la usan la radiografía de Scout individual
 * (`RadiografiaDelOnce`, las tarjetas de `VideosDelCanal`) y «El once de un
 * vistazo» de /rivals (`ResumenDelOnce`). El puesto es el de la comparación de
 * Wyscout (`perfil.puesto`): la lista va con la población con la que se le mide.
 *
 * Y la jerarquía: «Peligro» y «Explotable» marcaban a 10 de 11. Ahora sólo
 * quien pasa de 8 de cada 10 (P80) en una de las suyas, o baja de 2 de cada 10
 * (P20), como mucho 3 de cada lado, los más extremos; un jugador, un veredicto.
 */
import type { Puesto } from "@/lib/data-analisis/individual";
import type { PerfilWyscout, RasgoWyscout } from "@/lib/rivals/perfil-wyscout";

/** Columnas del Excel de Wyscout con lectura táctica para cada puesto. */
export const METRICAS_DEL_PUESTO: Record<Puesto, string[]> = {
  /* Paradas, goles evitados, salidas y juego con el pie. */
  POR: ["Paradas, %", "Goles evitados/90", "Salidas/90", "Precisión pases, %", "Precisión pases largos, %", "Pases largos/90"],
  /* Duelos aéreos y defensivos, interceptaciones y pase progresivo. */
  CEN: [
    "Duelos aéreos ganados, %",
    "Duelos aéreos en los 90",
    "Duelos defensivos ganados, %",
    "Duelos defensivos/90",
    "Interceptaciones/90",
    "Pases progresivos/90",
    "Precisión pases progresivos, %",
  ],
  /* Centros, acciones de ataque, duelos defensivos y progresión. */
  LAT: [
    "Centros/90",
    "Precisión centros, %",
    "Acciones de ataque exitosas/90",
    "Duelos defensivos ganados, %",
    "Duelos defensivos/90",
    "Pases progresivos/90",
    "Carreras en progresión/90",
  ],
  /* Pivote: recuperaciones (acciones defensivas), interceptaciones, pase progresivo y duelos. */
  MED: [
    "Acciones defensivas realizadas/90",
    "Interceptaciones/90",
    "Pases progresivos/90",
    "Precisión pases progresivos, %",
    "Duelos defensivos ganados, %",
    "Duelos aéreos ganados, %",
  ],
  /* Mediapunta y extremo: regate, pase clave, último tercio, xA y remate. */
  BAN: [
    "Regates/90",
    "Regates realizados, %",
    "Jugadas claves/90",
    "Pases en el último tercio/90",
    "xA/90",
    "Remates/90",
    "xG/90",
  ],
  /* Delantero: xG, remates, toques en el área y el juego aéreo. */
  DEL: ["xG/90", "Remates/90", "Tiros a la portería, %", "Toques en el área de penalti/90", "Duelos aéreos ganados, %", "Goles de cabeza/90"],
};

/** Por debajo de esto, una fila de la radiografía lleva «tendencia» (450′ = cinco partidos enteros). */
export const MINUTOS_TENDENCIA = 450;

/** Peligro: mejor que 8 de cada 10 de su puesto; explotable: peor que 8 de cada 10. */
export const UMBRAL_PELIGRO = 80;
export const UMBRAL_EXPLOTABLE = 20;
/** Como mucho, de cada lado. */
export const CUANTOS_POR_LADO = 3;

/** ¿Esta columna tiene lectura para su puesto? Sin columna (respuestas viejas), por el nombre. */
const NOMBRE_DE_COLUMNA: Record<string, string> = {
  "Paradas, %": "Paradas %",
  "Goles evitados/90": "Goles evitados",
  "Salidas/90": "Salidas",
  "Precisión pases, %": "Acierto de pase %",
  "Precisión pases largos, %": "Acierto en largo %",
  "Pases largos/90": "Pases largos",
  "Duelos aéreos ganados, %": "Duelos aéreos ganados %",
  "Duelos aéreos en los 90": "Duelos aéreos",
  "Duelos defensivos ganados, %": "Duelos defensivos ganados %",
  "Duelos defensivos/90": "Duelos defensivos",
  "Interceptaciones/90": "Interceptaciones",
  "Pases progresivos/90": "Pases progresivos",
  "Precisión pases progresivos, %": "Acierto de pase progresivo %",
  "Centros/90": "Centros",
  "Precisión centros, %": "Acierto de centro %",
  "Acciones de ataque exitosas/90": "Acciones de ataque exitosas",
  "Carreras en progresión/90": "Conducciones progresivas",
  "Acciones defensivas realizadas/90": "Acciones defensivas",
  "Regates/90": "Regates intentados",
  "Regates realizados, %": "Regates ganados %",
  "Jugadas claves/90": "Pases clave",
  "Pases en el último tercio/90": "Pases en el último tercio",
  "xA/90": "xA",
  "Remates/90": "Remates",
  "xG/90": "xG",
  "Tiros a la portería, %": "Remates a puerta %",
  "Toques en el área de penalti/90": "Toques en el área",
  "Goles de cabeza/90": "Goles de cabeza",
};

export function esDelPuesto(r: Pick<RasgoWyscout, "nombre"> & { columna?: string }, puesto: Puesto): boolean {
  const lista = METRICAS_DEL_PUESTO[puesto] ?? [];

  if (r.columna) return lista.includes(r.columna);

  return lista.some((c) => NOMBRE_DE_COLUMNA[c] === r.nombre);
}

/** Un porcentaje de menos de 15 intentos o un penalti no es un rasgo. */
const fiable = (r: RasgoWyscout) => !/penalti/i.test(r.nombre) && !(r.unidad === "porcentaje" && r.intentos != null && r.intentos < 15);

/**
 * Su mejor y su peor cifra entre las de su puesto. El ▲ sólo por encima de la
 * mediana y el ▼ sólo por debajo: si todo lo suyo es medio, no se inventa.
 */
export function lecturaDelPuesto(perfil: PerfilWyscout | undefined | null): { fuerte?: RasgoWyscout; flojo?: RasgoWyscout } {
  if (!perfil || perfil.muestraCorta) return {};

  /* `delPuesto` lo manda el servidor desde el 18/11/2026; en una copia vieja, lo que haya en fuertes, flojos y peor. */
  const todas = (perfil.delPuesto ?? [...perfil.fuertes, ...perfil.flojos, ...(perfil.peor ? [perfil.peor] : [])].filter((r) => esDelPuesto(r, perfil.puesto)))
    .filter(fiable)
    .sort((a, b) => b.percentil - a.percentil);
  const fuerte = todas[0] && todas[0].percentil > 50 ? todas[0] : undefined;
  const ultima = todas[todas.length - 1];
  const flojo = ultima && ultima.percentil < 50 && ultima !== fuerte ? ultima : undefined;

  return { fuerte, flojo };
}

/** «mejor que 9 de cada 10» / «peor que 8 de cada 10», siempre en el sentido «más es mejor». */
export const deCadaDiez = (percentil: number) =>
  percentil >= 50
    ? `mejor que ${Math.min(9, Math.max(1, Math.round(percentil / 10)))} de cada 10`
    : `peor que ${Math.min(9, Math.max(1, Math.round((100 - percentil) / 10)))} de cada 10`;

/** El nombre sin el «%» del final: «Duelos aéreos ganados %» → «Duelos aéreos ganados». */
export const nombreDelRasgo = (r: Pick<RasgoWyscout, "nombre">) => r.nombre.replace(/\s*%\s*$/, "").trim();

/*
| CADA CIFRA CON SU UNIDAD (18/11/2026, ronda 23, guionista): «Remates 1,0»
| no decía de qué. Por 90′ con un decimal («1,0 por 90′»; dos si con uno
| saldría 0,0), los porcentajes con uno y «%».
*/
export function cifraConUnidad(r: Pick<RasgoWyscout, "valor" | "unidad" | "nombre">): string {
  const coma = (t: string) => t.replace(".", ",").replace(/^-/, "−");

  if (r.unidad === "porcentaje") return `${coma(r.valor.toFixed(1))} %`;
  if (r.unidad === "entero" || r.unidad === "minutos") return Math.round(r.valor).toLocaleString("es-ES");

  const uno = r.valor.toFixed(1);
  const cifra = coma(uno === "0.0" && r.valor !== 0 ? r.valor.toFixed(2) : uno);

  return `${cifra} por 90′`;
}

/** Dónde se le hace daño o dónde hace daño, para el titular: «Palmberg por alto». */
const EN_QUE: Record<string, string> = {
  "Paradas, %": "bajo palos",
  "Goles evitados/90": "bajo palos",
  "Salidas/90": "en las salidas",
  "Precisión pases, %": "con el pie",
  "Precisión pases largos, %": "en el juego largo",
  "Pases largos/90": "en el juego largo",
  "Duelos aéreos ganados, %": "por alto",
  "Duelos aéreos en los 90": "por alto",
  "Goles de cabeza/90": "por alto",
  "Duelos defensivos ganados, %": "en el uno contra uno",
  "Duelos defensivos/90": "en el duelo",
  "Interceptaciones/90": "al cortar líneas de pase",
  "Acciones defensivas realizadas/90": "en la recuperación",
  "Pases progresivos/90": "con balón",
  "Precisión pases progresivos, %": "con balón",
  "Carreras en progresión/90": "en conducción",
  "Centros/90": "en el centro",
  "Precisión centros, %": "en el centro",
  "Acciones de ataque exitosas/90": "en ataque",
  "Regates/90": "en el regate",
  "Regates realizados, %": "en el regate",
  "Jugadas claves/90": "en el último pase",
  "Pases en el último tercio/90": "en el último tercio",
  "xA/90": "en el último pase",
  "Remates/90": "en el remate",
  "xG/90": "en el remate",
  "Tiros a la portería, %": "en el remate",
  "Toques en el área de penalti/90": "en el área",
};

export function enQue(r: Pick<RasgoWyscout, "nombre"> & { columna?: string }): string {
  const columna = r.columna ?? Object.keys(NOMBRE_DE_COLUMNA).find((c) => NOMBRE_DE_COLUMNA[c] === r.nombre);

  return columna ? EN_QUE[columna] ?? "" : "";
}

/**
 * Peligro y explotable con jerarquía: de todos, los que pasan el umbral en una
 * métrica de su puesto, los 3 más extremos de cada lado; un jugador, un
 * veredicto (el lado en el que está más lejos de la mediana).
 */
export function jerarquiaDelOnce<T extends { id: string; fuerte?: { percentil: number }; flojo?: { percentil: number } }>(
  jugadores: T[],
): Map<string, "peligro" | "explotable"> {
  const lado = new Map<string, { tipo: "peligro" | "explotable"; fuerza: number }>();

  for (const j of jugadores) {
    const p = j.fuerte && j.fuerte.percentil >= UMBRAL_PELIGRO ? j.fuerte.percentil - 50 : -1;
    const e = j.flojo && j.flojo.percentil <= UMBRAL_EXPLOTABLE ? 50 - j.flojo.percentil : -1;

    if (p < 0 && e < 0) continue;
    lado.set(j.id, p >= e ? { tipo: "peligro", fuerza: p } : { tipo: "explotable", fuerza: e });
  }

  const resultado = new Map<string, "peligro" | "explotable">();

  for (const tipo of ["peligro", "explotable"] as const) {
    [...lado.entries()]
      .filter(([, v]) => v.tipo === tipo)
      .sort((a, b) => b[1].fuerza - a[1].fuerza || a[0].localeCompare(b[0]))
      .slice(0, CUANTOS_POR_LADO)
      .forEach(([id]) => resultado.set(id, tipo));
  }

  return resultado;
}

/** La leyenda de la jerarquía, la misma en las dos pantallas. */
export const LEYENDA_JERARQUIA = `como mucho ${CUANTOS_POR_LADO} de cada lado: peligro, mejor que 8 de cada 10 de su puesto en una métrica clave; explotable, peor que 8 de cada 10 (Wyscout)`;
