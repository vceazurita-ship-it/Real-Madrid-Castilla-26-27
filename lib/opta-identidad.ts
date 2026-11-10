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
 * - La evolución, de `opta:partidos` (equipo × partido): los últimos
 *   `ULTIMOS` partidos frente a los anteriores, con LA MISMA CUENTA que la
 *   cifra de la temporada (10/11/2026): los recuentos, media por partido; los
 *   cocientes (% de balones largos, % de aéreos), cociente de las sumas de
 *   cada tramo, para que una diferencia de cálculo no se lea como cambio de
 *   juego. Donde Opta sólo da el cociente ya hecho por partido (PPDA, % de
 *   duelos) no se puede: el tramo es la media de los partidos y la medida
 *   lleva `aviso` para decirlo en pantalla. Sólo se dice
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
import { cifraDe, discrepancia, magnitudDe, pasaUmbral } from "@/lib/fuentes";

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
  /**
   * Si la cifra de la temporada es un cociente de sumas, cómo se rehace en
   * cada tramo: Σ arriba ÷ Σ abajo × escala, con la fila del partido y la del
   * rival en ese partido.
   */
  tramo?: { arriba: (f: Fila, rival: Fila | null) => number | null; abajo: (f: Fila, rival: Fila | null) => number | null; escala: number };
  /** Si es un cociente pero Opta no da sus partes por partido: lo que se dice en pantalla. */
  avisoTramo?: string;
};

/** El aviso de los cocientes que Opta sólo da ya hechos partido a partido. */
const avisoMedia = (que: string) =>
  `Por partido, Opta sólo da ${que} ya dividido: «últimos ${ULTIMOS}» y «antes» son la media de los partidos, no el cociente de la temporada de la cifra grande. Compáralos entre sí.`;

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
    tramo: { arriba: (f) => num(f.LgBall), abajo: (f) => num(f.PsAtt), escala: 100 },
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
    avisoTramo: avisoMedia("el % de duelos"),
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
    /* Cada aéreo lo gana uno de los dos: los jugados son los nuestros ganados más los suyos. */
    tramo: {
      arriba: (f) => num(f.AerialWon),
      abajo: (f, r) => {
        const a = num(f.AerialWon);
        const b = r ? num(r.AerialWon) : null;
        return a != null && b != null ? a + b : null;
      },
      escala: 100,
    },
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
    avisoTramo: avisoMedia("el PPDA"),
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
  /** Si «últimos» y «antes» no se cuentan como la cifra de la temporada, por qué (para la pantalla). */
  aviso: string | null;
};

/** Las partes de un cociente en un partido (alineadas con la serie). */
export type PartesTramo = { arriba: number | null; abajo: number | null };

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
  opciones: { partes?: PartesTramo[]; escala?: number; aviso?: string } = {},
): MedidaOpta | null {
  const validos = porEquipo.filter((x): x is { teamId: string; valor: number } => x.valor != null && Number.isFinite(x.valor));
  const yo = validos.find((x) => x.teamId === CASTILLA_OPTA);
  if (!yo || validos.length < 10) return null;
  const mejorQue = (a: number, b: number) => (rasgo.mejorAlto ? a > b : a < b);
  const todos = validos.map((x) => x.valor);
  const grupo = validos.filter((x) => grupos.get(x.teamId) === grupos.get(CASTILLA_OPTA)).map((x) => x.valor);
  const p = percentil(yo.valor, todos, !rasgo.mejorAlto);
  if (p == null) return null;

  const indices = serie.flatMap((s, i) => (s.valor != null ? [i] : []));
  const conValor = indices.map((i) => serie[i] as PuntoSerie & { valor: number });
  const ult = conValor.slice(-ULTIMOS).map((s) => s.valor);
  const prev = conValor.slice(0, -ULTIMOS).map((s) => s.valor);
  /* El tramo con la cuenta de la temporada: cociente de las sumas si hay partes;
     si falta alguna parte, la media, y se dice. */
  let aviso = opciones.aviso ?? null;
  const tramo = (idx: number[], xs: number[]): number | null => {
    const { partes, escala = 1 } = opciones;
    if (!partes) return media(xs);
    let arriba = 0;
    let abajo = 0;
    for (const i of idx) {
      const p = partes[i];
      if (p?.arriba == null || p.abajo == null) {
        aviso = "En algún partido faltan las partes del cociente: «últimos» y «antes» son la media de los partidos, no el cociente de la temporada.";
        return media(xs);
      }
      arriba += p.arriba;
      abajo += p.abajo;
    }
    return abajo > 0 ? (arriba / abajo) * escala : media(xs);
  };
  const ultimos = ult.length === ULTIMOS ? tramo(indices.slice(-ULTIMOS), ult) : null;
  const antes = prev.length >= 3 ? tramo(indices.slice(0, -ULTIMOS), prev) : null;
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
    aviso: ultimos != null && antes != null ? aviso : null,
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
    const { temporada, partido, tramo, avisoTramo, ...rasgo } = r;
    const porEquipo = equipos.map((f) => ({ teamId: String(f.teamId ?? ""), valor: temporada(f) }));
    const serie = partido ? nuestros.map((p) => ({ partido: String(p.fila.partido ?? ""), fecha: p.fecha, rival: p.rival, valor: partido(p.fila) })) : [];
    const partes = tramo && partido ? nuestros.map((p) => ({ arriba: tramo.arriba(p.fila, p.otra), abajo: tramo.abajo(p.fila, p.otra) })) : undefined;
    const m = mide(rasgo, porEquipo, grupos, serie, { partes, escala: tramo?.escala, aviso: avisoTramo });
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
  /* La temporada es tramos apretando ÷ tramos jugados de todos los partidos:
     los «últimos» y «antes», igual (cociente de las sumas), no la media. */
  const partes: PartesTramo[] = [];
  const serie: PuntoSerie[] = partidosDe(partidos, CASTILLA_OPTA).map((p) => {
    const id = String(p.fila.partido ?? "");
    const mp = momento.get(id);
    const curva = mp && mp.equipos.length === 2 ? curvaMomento(mp, CASTILLA_OPTA, "mezcla") : [];
    const aprieta = curva.filter((t) => t.valor > UMBRAL_DOMINIO).length;
    partes.push(curva.length ? { arriba: aprieta, abajo: curva.length } : { arriba: null, abajo: null });
    return {
      partido: id,
      fecha: p.fecha,
      rival: p.rival,
      valor: curva.length ? (aprieta / curva.length) * 100 : null,
    };
  });
  return mide(RASGO_DOMINIO, porEquipo, grupos, serie, { partes, escala: 100 });
}

/* ------------------------------------------------------------------ */
/*  EL CRUCE CON LA PARTE DE WYSCOUT (lib/fuentes.ts)                  */
/* ------------------------------------------------------------------ */

/**
 * /identidad-campo enseña arriba los principios con Wyscout y abajo con Opta.
 * Donde los dos miden el mismo principio, aquí se dice quién manda (la regla
 * de `lib/fuentes.ts`) y si es o no la misma cuenta. `magnitud` es la clave
 * del diccionario de fuentes; `distinta`, para los pares que ni siquiera
 * están en la misma unidad (un % frente a un recuento).
 */
type Cruce = {
  rasgo: string;
  /** Clave de `METRICAS` del indicador de Wyscout (nuestro lado). */
  wyscout: string;
  nombre: string;
  magnitud?: string;
  manda?: "opta" | "wyscout";
  distinta?: string;
};

export const CRUCES: Cruce[] = [
  { rasgo: "ppda", wyscout: "ppda", nombre: "PPDA", magnitud: "ppda" },
  { rasgo: "xg-contra", wyscout: "xgContra", nombre: "xG en contra", magnitud: "xgContra" },
  { rasgo: "remates-contra", wyscout: "tirosContra", nombre: "Remates en contra", magnitud: "rematesContra" },
  {
    rasgo: "perdidas-propio",
    wyscout: "perdidasBajas",
    nombre: "Pérdidas",
    manda: "opta",
    distinta: "con Wyscout es qué parte de nuestras pérdidas son en campo propio (%) y con Opta cuántas perdemos en nuestro tercio por partido",
  },
  {
    rasgo: "recuperaciones-arriba",
    wyscout: "recuperacionesAltas",
    nombre: "Recuperaciones altas",
    manda: "opta",
    distinta: "con Wyscout es qué parte de las recuperaciones son altas (%) y con Opta cuántas ganamos en su tercio por partido",
  },
  { rasgo: "aereos", wyscout: "duelosAereos", nombre: "Duelos aéreos", magnitud: "duelosAereos" },
  {
    rasgo: "duelos",
    wyscout: "duelosDefensivos",
    nombre: "Duelos",
    manda: "wyscout",
    distinta: "con Wyscout son sólo los duelos defensivos y con Opta todos, en el suelo y por arriba",
  },
];

const mandaDe = (c: Cruce) => c.manda ?? magnitudDe(c.magnitud ?? "")?.principal ?? "opta";

/**
 * La nota bajo una cifra de la parte de Opta. `valorWyscout` = la del mismo
 * indicador arriba (en la misma unidad cuando hay `magnitud`). Sin cruce, null.
 */
export function notaOpta(rasgo: string, valorOpta: number, valorWyscout: number | null | undefined): string | null {
  const c = CRUCES.find((x) => x.rasgo === rasgo);
  if (!c) return null;
  if (c.distinta) {
    return mandaDe(c) === "opta"
      ? `No es la misma cuenta que la de arriba: ${c.distinta}.`
      : `Segunda lectura: en duelos manda Wyscout (arriba), y no es la misma cuenta: ${c.distinta}.`;
  }
  const m = magnitudDe(c.magnitud ?? "");
  if (!m) return null;
  if (m.principal === "opta") {
    return discrepancia(m, valorOpta, valorWyscout) ?? (m.deQue === "cálculo" || !m.mismaCosa ? `No es la misma cuenta que la de arriba: ${m.porQueDifiere}.` : null);
  }
  if (valorWyscout != null && Number.isFinite(valorWyscout) && pasaUmbral(m, valorWyscout, valorOpta)) {
    return `Manda Wyscout, que da ${cifraDe(m, valorWyscout)} arriba: la diferencia es de ${m.deQue ?? "modelo"}, no de juego (${m.porQueDifiere}).`;
  }
  return "Segunda lectura: en duelos manda Wyscout (arriba).";
}

/** La nota bajo un indicador de la parte de Wyscout cuando la cifra que manda es la de Opta (abajo). */
export function notaWyscout(metrica: string): string | null {
  const c = CRUCES.find((x) => x.wyscout === metrica);
  if (!c || mandaDe(c) !== "opta") return null;
  const m = magnitudDe(c.magnitud ?? "");
  const porque = c.distinta
    ? `; no es la misma cuenta: ${c.distinta}`
    : m && (m.deQue === "cálculo" || !m.mismaCosa)
      ? `; no es la misma cuenta: ${m.porQueDifiere}`
      : m
        ? ` (${m.porQueDifiere})`
        : "";
  return `${c.nombre}: la cifra que manda es la de Opta, abajo${porque}.`;
}
