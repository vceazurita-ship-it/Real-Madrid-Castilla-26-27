/**
 * IDENTIDAD EN EL CAMPO, MEDIDA CON OPTA (10/11/2026).
 *
 * Cada principio de la Identidad de Juego que Opta puede medir con una cifra
 * de equipo defendible, con la del Castilla, su puesto en el grupo y en la
 * categoría (40 equipos, los dos grupos de Primera RFEF), su percentil y cómo
 * va en los últimos partidos. Funciones puras: se prueban en Node con las
 * copias de `.cache/opta`.
 *
 * DE DÓNDE SALE CADA CIFRA
 * - La de la temporada, de `opta:equipos` (lo que agrega Opta): los
 *   recuentos, por partido (total ÷ partidos); los cocientes (PPDA, % de
 *   duelos…), tal cual. Así la cifra es la misma que en /opta.
 * - La evolución, de `opta:partidos` (equipo × partido): la media de los
 *   últimos `ULTIMOS` partidos frente a la de los anteriores. Sólo se dice
 *   «mejora» o «empeora» si la diferencia pasa de dos errores típicos
 *   (calculados con la dispersión de nuestros propios partidos); si no,
 *   «estable» (sin cambio claro). Con menos de tres partidos antes, nada.
 * - Las que Opta sólo da por temporada (contraataques, robos altos, pases
 *   progresivos) no llevan evolución.
 * - El dominio (`dominioOpta`) sale de `opta:momento`, con la misma curva y
 *   el mismo umbral que la pestaña Estilos de /opta.
 *
 * LO QUE NO SE MIDE AQUÍ (y por qué)
 * - Transición defensiva: Opta no trae por equipo los contraataques del
 *   rival ni cuántos acaban en remate.
 * - «Amenazar la profundidad» con pases al hueco: el Castilla da menos de
 *   uno por partido, muestra demasiado pequeña para colocarle.
 * - «Ganar duelos» con balón: Opta no separa los duelos ofensivos de los
 *   defensivos; el % de duelos va una vez, en «Ganar mi duelo».
 *
 * Aquí no hay ningún dato: el repo es público.
 */

import type { Unidad } from "@/lib/data-analisis/metricas";
import type { BloqueKey } from "@/lib/identidad/campo";
import { CASTILLA_OPTA, num, percentil } from "@/lib/opta";
import { partidosDe, valorEquipo, valorPartido, type Fila } from "@/lib/opta-analisis";
import { UMBRAL_DOMINIO, momentumLiga } from "@/lib/opta-estilos";
import { curvaMomento, type MomentoPartido } from "@/lib/opta-eventos";

/** Cuántos partidos son «los últimos». */
export const ULTIMOS = 5;

export type RasgoOpta = {
  id: string;
  bloque: BloqueKey;
  /** El principio de la Identidad de Juego al que responde (texto corto). */
  principio: string;
  /** La métrica, en castellano. */
  nombre: string;
  /** Qué mide, en una línea. */
  que: string;
  mejorAlto: boolean;
  unidad: Unidad;
  /** La cifra de la temporada de una fila de `opta:equipos` (porcentajes en tanto por cien). */
  temporada: (f: Fila) => number | null;
  /** La de un partido de `opta:partidos`; sin esto, no hay evolución. */
  partido?: (f: Fila) => number | null;
};

const enTemporada = (a: string) => (f: Fila) => valorEquipo(f, a, "partido");
const enPartido = (a: string) => (f: Fila) => valorPartido(f, a);
const proporcion = (arriba: string, abajo: string) => (f: Fila) => {
  const x = num(f[arriba]);
  const y = num(f[abajo]);
  return x != null && y != null && y > 0 ? (x / y) * 100 : null;
};

export const RASGOS_OPTA: RasgoOpta[] = [
  {
    id: "verticalidad",
    bloque: "atqGeneral",
    principio: "Verticalidad",
    nombre: "Velocidad de avance de la jugada",
    que: "Metros que avanza cada secuencia hacia la portería rival por segundo (Opta, «DirectSpeed»). Más alto, más directo.",
    mejorAlto: true,
    unidad: "decimal",
    temporada: enTemporada("DirectSpeed"),
    partido: enPartido("DirectSpeed"),
  },
  {
    id: "perdidas-propio",
    bloque: "prog",
    principio: "Evitar pérdidas que permitan transitar",
    nombre: "Pérdidas en el tercio propio por partido",
    que: "Balones perdidos en nuestro primer tercio: los que dejan al rival cerca de nuestra portería. Menos es mejor.",
    mejorAlto: false,
    unidad: "decimal",
    temporada: enTemporada("PsLostD3"),
    partido: enPartido("PsLostD3"),
  },
  {
    id: "progresivos",
    bloque: "prog",
    principio: "Progresar con alternancia para acelerar",
    nombre: "Pases progresivos por partido",
    que: "Pases que acercan el balón de forma clara a la portería rival (definición de Opta). Opta sólo lo da por temporada.",
    mejorAlto: true,
    unidad: "decimal",
    temporada: enTemporada("ProgPass"),
  },
  {
    id: "juego-largo",
    bloque: "prog",
    principio: "Reducir envíos directos sin continuidad",
    nombre: "Balones largos sobre el total de pases",
    que: "Qué parte de nuestros pases son en largo (no si llegan). Menos es mejor: es lo que pide el principio.",
    mejorAlto: false,
    unidad: "porcentaje",
    temporada: enTemporada("LongBall%"),
    partido: proporcion("LgBall", "PsAtt"),
  },
  {
    id: "xg",
    bloque: "pos",
    principio: "Finalizar ataques",
    nombre: "Goles esperados (xG) por partido",
    que: "La calidad de las ocasiones que nos generamos: la suma del xG de cada remate.",
    mejorAlto: true,
    unidad: "decimal",
    temporada: enTemporada("ExpG"),
    partido: enPartido("ExpG"),
  },
  {
    id: "toques-area",
    bloque: "pos",
    principio: "Conquistar espacios para atacar la última línea",
    nombre: "Toques en el área rival por partido",
    que: "Cuántas veces tocamos el balón dentro de su área: llegar de verdad, no sólo tenerla.",
    mejorAlto: true,
    unidad: "decimal",
    temporada: enTemporada("TouchOpBox"),
    partido: enPartido("TouchOpBox"),
  },
  {
    id: "secuencias-tercio",
    bloque: "pos",
    principio: "Conquistar espacios para atacar la última línea",
    nombre: "Secuencias que llegan al último tercio por partido",
    que: "Jugadas nuestras que acaban en el último tercio del campo.",
    mejorAlto: true,
    unidad: "decimal",
    temporada: enTemporada("SeqEndInA3"),
    partido: enPartido("SeqEndInA3"),
  },
  {
    id: "contras",
    bloque: "tof",
    principio: "Priorizar ataque rápido y vertical",
    nombre: "Contraataques por partido",
    que: "Secuencias de contraataque según Opta. Sólo por temporada.",
    mejorAlto: true,
    unidad: "decimal",
    temporada: enTemporada("CounterAttack"),
  },
  {
    id: "contras-remate",
    bloque: "tof",
    principio: "Priorizar ataque rápido y vertical",
    nombre: "Contraataques que acaban en remate por partido",
    que: "De esos contraataques, los que terminan en tiro. Sólo por temporada.",
    mejorAlto: true,
    unidad: "decimal",
    temporada: enTemporada("CounterAttToShot"),
  },
  {
    id: "duelos",
    bloque: "defGeneral",
    principio: "Ganar mi duelo",
    nombre: "Duelos ganados",
    que: "Porcentaje de duelos (en el suelo y por arriba) que gana el equipo.",
    mejorAlto: true,
    unidad: "porcentaje",
    temporada: enTemporada("Duel%"),
    partido: enPartido("Duel%"),
  },
  {
    id: "aereos",
    bloque: "defGeneral",
    principio: "Ganar mi duelo",
    nombre: "Duelos aéreos ganados",
    que: "Porcentaje de balones divididos por arriba que gana el equipo.",
    mejorAlto: true,
    unidad: "porcentaje",
    temporada: enTemporada("Aerial%"),
    partido: enPartido("Aerial%"),
  },
  {
    id: "ppda",
    bloque: "dcr",
    principio: "Condicionar e impedir la progresión rival",
    nombre: "PPDA",
    que: "Pases que le dejamos dar al rival en su salida por cada acción defensiva nuestra. Más bajo, más presión.",
    mejorAlto: false,
    unidad: "decimal",
    temporada: enTemporada("PPDA"),
    partido: enPartido("PPDA"),
  },
  {
    id: "recuperaciones-arriba",
    bloque: "dcr",
    principio: "Recuperar para transitar rápido",
    nombre: "Recuperaciones en el último tercio por partido",
    que: "Balones que ganamos en el tercio del rival.",
    mejorAlto: true,
    unidad: "decimal",
    temporada: enTemporada("PosWonA3rd"),
    partido: enPartido("PosWonA3rd"),
  },
  {
    id: "robos-remate",
    bloque: "dcr",
    principio: "Recuperar para transitar rápido",
    nombre: "Robos altos que acaban en remate por partido",
    que: "Recuperaciones a menos de 40 m de su portería que terminan en tiro nuestro. Sólo por temporada.",
    mejorAlto: true,
    unidad: "decimal",
    temporada: enTemporada("HighTOEndShot"),
  },
  {
    id: "xg-contra",
    bloque: "dcp",
    principio: "Evitar situaciones de finalización",
    nombre: "xG en contra por partido",
    que: "La calidad de las ocasiones que concedemos. Menos es mejor.",
    mejorAlto: false,
    unidad: "decimal",
    temporada: enTemporada("ExpGAg"),
    partido: enPartido("ExpGAg"),
  },
  {
    id: "remates-contra",
    bloque: "dcp",
    principio: "Evitar situaciones de finalización",
    nombre: "Remates en contra por partido",
    que: "Cuántos tiros nos hacen. Menos es mejor.",
    mejorAlto: false,
    unidad: "decimal",
    temporada: enTemporada("ShotsAg"),
    partido: enPartido("ShotsAg"),
  },
];

/* ------------------------------------------------------------------ */
/*  LA CUENTA                                                          */
/* ------------------------------------------------------------------ */

export type PuntoSerie = { partido: string; fecha: string; rival: string; valor: number | null };

export type Tendencia = "mejora" | "empeora" | "estable";

export type MedidaOpta = {
  rasgo: Pick<RasgoOpta, "id" | "bloque" | "principio" | "nombre" | "que" | "mejorAlto" | "unidad">;
  valor: number;
  /** 1 = el mejor (según el sentido de la métrica). */
  puestoGrupo: number | null;
  deGrupo: number;
  puestoCategoria: number;
  deCategoria: number;
  /** Percentil en la categoría, siempre «más alto, mejor». */
  percentil: number;
  mediana: number;
  /** Partido a partido del Castilla (vacío si Opta sólo da la temporada). */
  serie: PuntoSerie[];
  ultimos: number | null;
  antes: number | null;
  tendencia: Tendencia | null;
};

const media = (xs: number[]) => (xs.length ? xs.reduce((s, x) => s + x, 0) / xs.length : null);
const mediana = (xs: number[]) => {
  const o = [...xs].sort((a, b) => a - b);
  const k = Math.floor(o.length / 2);
  return o.length % 2 ? o[k] : (o[k - 1] + o[k]) / 2;
};
const desviacion = (xs: number[]) => {
  const m = media(xs);
  return m == null || xs.length < 2 ? null : Math.sqrt(xs.reduce((s, x) => s + (x - m) ** 2, 0) / (xs.length - 1));
};

/** Puesto, percentil y evolución de un valor del Castilla dentro de los de todos los equipos. */
function mide(
  rasgo: MedidaOpta["rasgo"],
  porEquipo: { teamId: string; valor: number | null }[],
  grupos: Map<string, number>,
  serie: PuntoSerie[],
): MedidaOpta | null {
  const validos = porEquipo.filter((x): x is { teamId: string; valor: number } => x.valor != null && Number.isFinite(x.valor));
  const yo = validos.find((x) => x.teamId === CASTILLA_OPTA);
  if (!yo || validos.length < 10) return null;
  const mejorQue = (a: number, b: number) => (rasgo.mejorAlto ? a > b : a < b);
  const todos = validos.map((x) => x.valor);
  const grupo = validos.filter((x) => grupos.get(x.teamId) === grupos.get(CASTILLA_OPTA)).map((x) => x.valor);
  const p = percentil(yo.valor, todos, !rasgo.mejorAlto);
  if (p == null) return null;

  const conValor = serie.filter((s): s is PuntoSerie & { valor: number } => s.valor != null);
  const ult = conValor.slice(-ULTIMOS).map((s) => s.valor);
  const prev = conValor.slice(0, -ULTIMOS).map((s) => s.valor);
  const ultimos = ult.length === ULTIMOS ? media(ult) : null;
  const antes = prev.length >= 3 ? media(prev) : null;
  /* «Mejora» o «empeora» sólo si la diferencia pasa de dos errores típicos
     (con la dispersión de sus propios partidos): si no, sin cambio claro. */
  let tendencia: Tendencia | null = null;
  const sd = desviacion(conValor.map((s) => s.valor));
  if (ultimos != null && antes != null && sd != null) {
    const dif = ultimos - antes;
    const error = sd * Math.sqrt(1 / ult.length + 1 / prev.length);
    tendencia = Math.abs(dif) <= 2 * error ? "estable" : (dif > 0) === rasgo.mejorAlto ? "mejora" : "empeora";
  }

  return {
    rasgo,
    valor: yo.valor,
    puestoGrupo: grupos.size ? grupo.filter((v) => mejorQue(v, yo.valor)).length + 1 : null,
    deGrupo: grupo.length,
    puestoCategoria: todos.filter((v) => mejorQue(v, yo.valor)).length + 1,
    deCategoria: todos.length,
    percentil: p,
    mediana: mediana(todos),
    serie: serie.length ? serie : [],
    ultimos,
    antes,
    tendencia,
  };
}

/**
 * Cada rasgo de `RASGOS_OPTA` medido. `equipos` = `opta:equipos`,
 * `partidos` = `opta:partidos` (como objetos), `grupos` = `gruposDe`.
 * Los rasgos sin cifra del Castilla o con menos de 10 equipos con dato no
 * salen.
 */
export function identidadOpta(equipos: Fila[], partidos: Fila[], grupos: Map<string, number>): MedidaOpta[] {
  const nuestros = partidosDe(partidos, CASTILLA_OPTA);
  const salida: MedidaOpta[] = [];
  for (const r of RASGOS_OPTA) {
    const { temporada, partido, ...rasgo } = r;
    const porEquipo = equipos.map((f) => ({ teamId: String(f.teamId ?? ""), valor: temporada(f) }));
    const serie = partido ? nuestros.map((p) => ({ partido: String(p.fila.partido ?? ""), fecha: p.fecha, rival: p.rival, valor: partido(p.fila) })) : [];
    const m = mide(rasgo, porEquipo, grupos, serie);
    if (m) salida.push(m);
  }
  return salida;
}

/* ------------------------------------------------------------------ */
/*  DOMINIO (opta:momento)                                             */
/* ------------------------------------------------------------------ */

export const RASGO_DOMINIO: MedidaOpta["rasgo"] = {
  id: "dominio",
  bloque: "atqGeneral",
  principio: "Dominar el partido",
  nombre: "Minutos apretando",
  que: "Porcentaje de tramos de 5′ en que nuestro xG y nuestros toques en su área superan a los suyos (la curva de momentum de /opta, con su umbral).",
  mejorAlto: true,
  unidad: "porcentaje",
};

/** El dominio del Castilla frente a la categoría, con su partido a partido. `momento` = `momentoDe(opta:momento)`. */
export function dominioOpta(momento: Map<string, MomentoPartido>, partidos: Fila[], grupos: Map<string, number>): MedidaOpta | null {
  if (!momento.size) return null;
  const liga = momentumLiga(momento, []);
  const porEquipo = liga.map((f) => ({ teamId: f.teamId, valor: f.dominio == null ? null : f.dominio * 100 }));
  const serie: PuntoSerie[] = partidosDe(partidos, CASTILLA_OPTA).map((p) => {
    const id = String(p.fila.partido ?? "");
    const mp = momento.get(id);
    const curva = mp && mp.equipos.length === 2 ? curvaMomento(mp, CASTILLA_OPTA, "mezcla") : [];
    return {
      partido: id,
      fecha: p.fecha,
      rival: p.rival,
      valor: curva.length ? (curva.filter((t) => t.valor > UMBRAL_DOMINIO).length / curva.length) * 100 : null,
    };
  });
  return mide(RASGO_DOMINIO, porEquipo, grupos, serie);
}
