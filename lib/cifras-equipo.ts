/**
 * LA CIFRA DE UN EQUIPO CON SU FUENTE PRINCIPAL (10/11/2026).
 *
 * `lib/fuentes.ts` dice quién manda en cada magnitud; esto la lee. Opta manda
 * en xG, xG en contra, remates (a favor y en contra) y PPDA, y la portada y el
 * área de datos ya las daban de Opta, mientras el informe del partido, el
 * boceto del plan y el vídeo seguían con Wyscout: la misma semana salían dos
 * cifras para lo mismo. Todos esos sitios leen ahora por aquí.
 *
 * - **Temporada**: la media por partido del equipo. Los recuentos (xG,
 *   remates) son la suma entre los partidos; el **PPDA de temporada es el de
 *   Opta, cociente de las sumas** (`opta:equipos`), no la media de los
 *   partidos. Con `corte` (sólo lo de antes de ese día), los recuentos se
 *   suman partido a partido (`opta:partidos`); el PPDA, que no se puede
 *   rehacer sin sus dos sumas, sólo sale si el corte no deja fuera ningún
 *   partido del equipo.
 * - **Partido**: la cifra de ese partido, tal cual.
 * - **Población**: el grupo del equipo en Opta (los 20 con los que juega),
 *   para el puesto, el percentil y la mediana. Igual que la portada.
 * - Si Opta no tiene ese equipo, esa fecha o esa magnitud, sale la cifra de
 *   Wyscout que traiga el llamador (`wyscout`), marcada como tal.
 *
 * Funciones puras: reciben las tablas de Opta ya cargadas (el navegador con
 * `/api/docs`, Node con supabase-js o con las copias de `.cache/opta`). Ni
 * una cifra aquí: el repositorio es público.
 */

import type { Fuente, Magnitud } from "@/lib/fuentes";
import { MAGNITUD, nombresOpta } from "@/lib/fuentes";
import { aObjetos, num, type MetaOpta, type TablaOpta } from "@/lib/opta";
import { catalogoDe, gruposDe, valorEquipo, valorPartido, type Fila } from "@/lib/opta-analisis";
import { casaEquipo } from "@/lib/opta-eventos";
import { percentil as percentilWyscout } from "@/lib/data-analisis/metricas";
import { cierraPerfil, type MetricaEquipo, type PerfilColectivo } from "@/lib/data-analisis/equipo";
import type { Duelo, MetricaDuelo, PartidoForma } from "@/lib/informe-partido/modelo";

export type TablasOpta = {
  equipos: TablaOpta | null;
  partidos: TablaOpta | null;
  meta?: MetaOpta | null;
};

/** Las claves de Wyscout (`METRICAS`) que pasan a Opta, con su magnitud de `lib/fuentes.ts`. */
export const WYSCOUT_A_MAGNITUD: Record<string, string> = {
  xg: "xg",
  xgContra: "xgContra",
  tiros: "remates",
  tirosContra: "rematesContra",
  ppda: "ppda",
};

/** Las magnitudes que esta lectura sabe dar de Opta. */
const CON_OPTA = new Set(Object.values(WYSCOUT_A_MAGNITUD));

export type CifraEquipo = {
  valor: number;
  fuente: Fuente;
  /** Partidos detrás de la cifra (1 si es la de un partido). */
  partidos: number;
  /** «grupo (20 equipos)». */
  poblacion: string;
  /** 1 = el mejor (en estilo, el que más). */
  puesto: number | null;
  /** Puesto contando siempre de más a menos. */
  puestoDeMas: number | null;
  de: number;
  /** 0-100, a la derecha mejor; null si la magnitud no tiene mejor. */
  percentil: number | null;
  mediana: number | null;
  media: number | null;
};

export type OpcionesCifra = {
  opta?: TablasOpta | null;
  /** Un partido concreto: su fecha (con ±2 días de margen) y, si se sabe, el rival. */
  partido?: { fecha: string; rival?: string } | null;
  /** Sólo lo jugado antes de este día (AAAA-MM-DD). */
  corte?: string | null;
  /** Lo que se usa si Opta no tiene la cifra (la de Wyscout, ya calculada). */
  wyscout?: Omit<CifraEquipo, "fuente"> | null;
  /** El sentido de la métrica para el puesto (por defecto el de la magnitud). */
  mejor?: boolean | null;
};

/* ------------------------------------------------------------------ */
/*  LAS TABLAS, PREPARADAS UNA VEZ                                      */
/* ------------------------------------------------------------------ */

type Preparada = {
  equipos: Fila[];
  partidos: Fila[];
  grupos: Map<string, number>;
  catalogo: ReturnType<typeof catalogoDe>;
  lista: { teamId: string; equipo: string }[];
  porEquipo: Map<string, Fila[]>;
  porPartido: Map<string, Fila[]>;
};

const preparadas = new WeakMap<TablaOpta, Preparada>();

function prepara(t: TablasOpta | null | undefined): Preparada | null {
  if (!t?.equipos || !t.partidos) return null;
  const hecha = preparadas.get(t.equipos);
  if (hecha && hecha.partidos.length === t.partidos.filas.length) return hecha;
  const equipos = aObjetos(t.equipos);
  const partidos = aObjetos(t.partidos);
  const porEquipo = new Map<string, Fila[]>();
  const porPartido = new Map<string, Fila[]>();
  for (const f of partidos) {
    const id = String(f.teamId ?? "");
    porEquipo.set(id, [...(porEquipo.get(id) ?? []), f]);
    const p = String(f.partido ?? "");
    porPartido.set(p, [...(porPartido.get(p) ?? []), f]);
  }
  const p: Preparada = {
    equipos,
    partidos,
    grupos: gruposDe(t.partidos),
    catalogo: catalogoDe(t.meta ?? null),
    lista: equipos.map((f) => ({ teamId: String(f.teamId ?? ""), equipo: String(f.equipo ?? "") })),
    porEquipo,
    porPartido,
  };
  preparadas.set(t.equipos, p);
  return p;
}

const dia = (fecha: string) => String(fecha ?? "").slice(0, 10);
const dias = (a: string, b: string) => Math.abs(Date.parse(`${dia(a)}T12:00:00Z`) - Date.parse(`${dia(b)}T12:00:00Z`)) / 86_400_000;

/** El teamId de Opta de un nombre de cualquier fuente (o el propio id). */
export function equipoOpta(equipo: string, opta: TablasOpta | null | undefined): string | null {
  const p = prepara(opta);
  if (!p || !equipo) return null;
  if (p.lista.some((e) => e.teamId === equipo)) return equipo;
  return casaEquipo(equipo, p.lista);
}

/* ------------------------------------------------------------------ */
/*  LOS VALORES DE OPTA                                                */
/* ------------------------------------------------------------------ */

function columna(m: Magnitud) {
  return m.opta.clave;
}

/** La media por partido de la temporada (o hasta `corte`), con sus partidos. */
function deTemporada(p: Preparada, m: Magnitud, teamId: string, corte?: string | null): { valor: number; partidos: number } | null {
  const fila = p.equipos.find((f) => f.teamId === teamId);
  const suyos = p.porEquipo.get(teamId) ?? [];
  const antes = corte ? suyos.filter((f) => dia(String(f.fecha ?? "")) < corte) : suyos;
  const col = columna(m);
  const gm = fila ? num(fila.GM) : null;

  /* Sin nada fuera por el corte: la de la tabla de equipos, la misma que la portada. */
  if (fila && gm && (!corte || (antes.length === suyos.length && suyos.length >= gm))) {
    const v = valorEquipo(fila, col, "partido", p.catalogo);
    return v == null ? null : { valor: v, partidos: gm };
  }

  /* El PPDA de temporada es el cociente de las sumas: con partidos fuera no se rehace. */
  if (m.clave === "ppda" || !antes.length) return null;

  const valores = antes.map((f) => valorPartido(f, col, p.catalogo)).filter((v): v is number => v != null);
  if (valores.length !== antes.length) return null;
  return { valor: valores.reduce((a, b) => a + b, 0) / valores.length, partidos: valores.length };
}

/** La fila de Opta del equipo en el partido de esa fecha (±2 días; si se sabe el rival, contra él). */
export function filaDelPartido(opta: TablasOpta | null | undefined, equipo: string, partido: { fecha: string; rival?: string }): Fila | null {
  const p = prepara(opta);
  const id = equipoOpta(equipo, opta);
  if (!p || !id) return null;
  const rivalId = partido.rival ? casaEquipo(partido.rival, p.lista) : null;
  const cerca = (p.porEquipo.get(id) ?? [])
    .filter((f) => dias(String(f.fecha ?? ""), partido.fecha) <= 2)
    .filter((f) => !rivalId || (p.porPartido.get(String(f.partido ?? "")) ?? []).some((o) => o.teamId === rivalId))
    .sort((a, b) => dias(String(a.fecha ?? ""), partido.fecha) - dias(String(b.fecha ?? ""), partido.fecha));
  return cerca[0] ?? null;
}

const posicion = (valor: number, todos: number[], mejor: boolean | null) => {
  const orden = [...todos].sort((a, b) => a - b);
  const n = orden.length;
  return {
    puesto: mejor === false ? todos.filter((x) => x < valor).length + 1 : todos.filter((x) => x > valor).length + 1,
    puestoDeMas: todos.filter((x) => x > valor).length + 1,
    de: n,
    percentil: mejor === null ? null : percentilWyscout(valor, todos, mejor),
    mediana: n ? (n % 2 ? orden[(n - 1) / 2] : (orden[n / 2 - 1] + orden[n / 2]) / 2) : null,
    media: n ? todos.reduce((a, b) => a + b, 0) / n : null,
  };
};

/**
 * LA LECTURA. La cifra de `magnitud` (clave de `lib/fuentes.ts`, o la de
 * Wyscout: `tiros`, `ppda`…) para `equipo` (nombre de cualquier fuente o
 * teamId de Opta): de la temporada, o de un partido con `partido`. Opta si la
 * tiene; si no, la de Wyscout que se pase; si tampoco, `null`.
 */
export function cifraEquipo(magnitud: string, equipo: string, op: OpcionesCifra = {}): CifraEquipo | null {
  const m = MAGNITUD.get(WYSCOUT_A_MAGNITUD[magnitud] ?? magnitud) ?? null;
  const deWyscout = op.wyscout ? { ...op.wyscout, fuente: "wyscout" as const } : null;
  const p = prepara(op.opta);
  const id = p ? equipoOpta(equipo, op.opta) : null;
  if (!m || !p || !id || m.principal !== "opta" || !CON_OPTA.has(m.clave)) return deWyscout;

  const mejor = op.mejor === undefined ? m.mejor : op.mejor;
  const grupo = p.grupos.get(id);
  const delGrupo = p.equipos.map((f) => String(f.teamId ?? "")).filter((t) => grupo === undefined || p.grupos.get(t) === grupo);
  const poblacion = (n: number) => `grupo (${n} equipos)`;

  if (op.partido) {
    const fila = filaDelPartido(op.opta, id, op.partido);
    const valor = fila ? valorPartido(fila, columna(m), p.catalogo) : null;
    if (valor == null) return deWyscout;
    /* El sitio de esa cifra entre los partidos del grupo de esa temporada. */
    const todos = p.partidos
      .filter((f) => delGrupo.includes(String(f.teamId ?? "")))
      .map((f) => valorPartido(f, columna(m), p.catalogo))
      .filter((v): v is number => v != null);
    return { valor, fuente: "opta", partidos: 1, poblacion: `${todos.length} partidos del grupo`, ...posicion(valor, todos, mejor) };
  }

  const suya = deTemporada(p, m, id, op.corte);
  if (!suya) return deWyscout;
  const todos = delGrupo.map((t) => deTemporada(p, m, t, op.corte)?.valor).filter((v): v is number => v != null && Number.isFinite(v));
  if (todos.length < 4) return deWyscout;
  return { valor: suya.valor, fuente: "opta", partidos: suya.partidos, poblacion: poblacion(todos.length), ...posicion(suya.valor, todos, mejor) };
}

/** Las cifras de cada partido del equipo antes de `corte` (para «lo habitual»). */
export function cifrasPorPartido(magnitud: string, equipo: string, opta: TablasOpta | null | undefined, corte?: string | null): number[] {
  const m = MAGNITUD.get(WYSCOUT_A_MAGNITUD[magnitud] ?? magnitud);
  const p = prepara(opta);
  const id = p ? equipoOpta(equipo, opta) : null;
  if (!m || !p || !id) return [];
  return (p.porEquipo.get(id) ?? [])
    .filter((f) => !corte || dia(String(f.fecha ?? "")) < corte)
    .map((f) => valorPartido(f, columna(m), p.catalogo))
    .filter((v): v is number => v != null);
}

/* ------------------------------------------------------------------ */
/*  EL PERFIL DE WYSCOUT CON LAS CIFRAS DE OPTA                        */
/* ------------------------------------------------------------------ */

/**
 * El perfil colectivo de Wyscout (`perfilDe`) con xG, remates y PPDA de Opta
 * donde Opta los tiene: valor, puesto, percentil y mediana de Opta, con el
 * sentido de la métrica de Wyscout. Fuertes, flojos y fases se rehacen.
 */
export function perfilConOpta(perfil: PerfilColectivo | null, equipo: string, opta: TablasOpta | null | undefined, corte?: string | null): PerfilColectivo | null {
  if (!perfil || !prepara(opta)) return perfil;
  let cambia = false;
  const metricas: MetricaEquipo[] = perfil.metricas.map((x) => {
    if (!WYSCOUT_A_MAGNITUD[x.metrica.key]) return x;
    const c = cifraEquipo(x.metrica.key, equipo, { opta, corte, mejor: x.metrica.mejorAlto });
    if (!c || c.fuente !== "opta" || c.puesto == null || c.puestoDeMas == null || c.mediana == null) return x;
    cambia = true;
    return { ...x, valor: c.valor, percentil: c.percentil, puesto: c.puesto, puestoDeMas: c.puestoDeMas, de: c.de, mediana: c.mediana, fuente: "opta", partidos: c.partidos };
  });
  return cambia ? cierraPerfil(perfil.competicion, perfil.equipos, metricas) : perfil;
}

export { nombresOpta };

/* ------------------------------------------------------------------ */
/*  EL DUELO DEL INFORME CON LAS CIFRAS DE OPTA                        */
/* ------------------------------------------------------------------ */

/**
 * El duelo de `/api/data-analisis?duelo=` (Wyscout) con xG, xG en contra,
 * remates y PPDA de Opta, fila a fila: la media de temporada de los dos (hasta
 * el día antes del partido, como Wyscout), el partido en el post y el xG de
 * los últimos cinco. Una fila se cambia entera o no se toca: nunca la media de
 * una fuente con el puesto de otra.
 */
export function dueloConOpta(
  duelo: Duelo | null,
  opta: TablasOpta | null | undefined,
  { nosotros, corte }: { nosotros: string; corte?: string | null },
): Duelo | null {
  if (!duelo || !prepara(opta)) return duelo;
  const rival = duelo.rival;

  const metricas: MetricaDuelo[] = duelo.metricas.map((x) => {
    if (!WYSCOUT_A_MAGNITUD[x.key]) return x;
    const nos = cifraEquipo(x.key, nosotros, { opta, corte, mejor: x.mejorAlto });
    const suyo = rival ? cifraEquipo(x.key, rival, { opta, corte, mejor: x.mejorAlto }) : null;
    /* Los dos de Opta o ninguno: el cara a cara no mezcla modelos. */
    if (nos?.fuente !== "opta" || (rival && suyo?.fuente !== "opta")) return x;
    const lado = (c: CifraEquipo | null) => (c && c.puesto != null ? { valor: c.valor, puesto: c.puesto, percentil: c.percentil } : null);
    return { ...x, mediana: nos.mediana, media: nos.media, nosotros: lado(nos), rival: lado(suyo), fuente: "opta", partidos: nos.partidos };
  });

  let partido = duelo.partido;
  if (partido && rival) {
    const fecha = partido.fecha;
    partido = {
      ...partido,
      metricas: partido.metricas.map((x) => {
        if (!WYSCOUT_A_MAGNITUD[x.key]) return x;
        const nuestro = cifraEquipo(x.key, nosotros, { opta, partido: { fecha, rival } });
        const suyo = cifraEquipo(x.key, rival, { opta, partido: { fecha, rival: nosotros } });
        if (nuestro?.fuente !== "opta" || suyo?.fuente !== "opta") return x;
        /* «Lo habitual»: nuestros partidos de antes, uno a uno (la media y su desviación). */
        const antes = cifrasPorPartido(x.key, nosotros, opta, dia(fecha));
        const media = antes.length ? antes.reduce((a, b) => a + b, 0) / antes.length : null;
        const desviacion =
          media != null && antes.length >= 4 ? Math.sqrt(antes.reduce((a, v) => a + (v - media) ** 2, 0) / (antes.length - 1)) : null;
        return { ...x, nuestro: nuestro.valor, suyo: suyo.valor, media, desviacion, recuento: null, fuente: "opta" };
      }),
    };
  }

  /* El xG de los últimos cinco, partido a partido. */
  const xgForma = (equipo: string | null, lista: PartidoForma[]) =>
    equipo
      ? lista.map((f) => {
          const c = cifraEquipo("xg", equipo, { opta, partido: { fecha: f.fecha, rival: f.rival } });
          return c?.fuente === "opta" ? { ...f, xg: c.valor } : f;
        })
      : lista;

  return {
    ...duelo,
    metricas,
    partido,
    forma: { nosotros: xgForma(nosotros, duelo.forma.nosotros), rival: xgForma(rival, duelo.forma.rival) },
  };
}

/** Las claves del duelo que van con Opta (para el sello). */
export const clavesOptaDelDuelo = (duelo: Duelo | null): string[] =>
  [...(duelo?.metricas ?? []), ...(duelo?.partido?.metricas ?? [])].filter((x) => (x as { fuente?: Fuente }).fuente === "opta").map((x) => x.key);
