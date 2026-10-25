/**
 * PATRONES QUE MÁS RINDEN (laboratorio de ABP, 25/10/2026).
 *
 * Agrupa TODAS las acciones a balón parado con remate de
 * `public/data/abp-acciones-todas.json` por patrón = tipo + lado del saque +
 * zona de caída. Wyscout no da el pie del lanzador ni si el envío es cerrado,
 * abierto o raso, y eso no se inventa: no entra en la clave.
 *
 * Todas las cuentas son «por acción con remate»: el dato sólo recoge los
 * balones parados que acabaron en remate.
 */

import { aMetros, rutinaDeAccion, zonaDe, ZONA_TEXTO, type Accion, type PuntoWy, type TipoAccion } from "@/lib/abp-lab/acciones";
import type { Zona } from "@/lib/abp-lab/modelo";

export type TipoPatron = Exclude<TipoAccion, "penalti">;

export const TIPOS_PATRON: TipoPatron[] = ["corner", "falta", "directa", "banda"];

export const TIPO_PATRON_TEXTO: Record<TipoPatron, string> = {
  corner: "Córner",
  falta: "Falta lateral",
  directa: "Falta directa",
  banda: "Banda larga",
};

/** Una competición de `abp-acciones-todas.json`. */
export type TodasCompeticion = {
  slug: string;
  corto: string;
  nombre: string;
  /** Id del partido → título (con marcador), fecha y jornada. */
  partidos: Record<string, { p: string; f: string; j: string }>;
  videos: Record<string, { v: string; c: string }>;
  acciones: Omit<Accion, "p" | "fecha">[];
};

export type AbpTodas = { generado: string; temporada: string; competiciones: TodasCompeticion[] };

/** Una acción con todo lo que hace falta para enseñarla. */
export type AccionPlena = { accion: Accion; jornada: string; comp: TodasCompeticion };

export type Lado = "izquierda" | "central" | "derecha";

export type Patron = {
  clave: string;
  tipo: TipoPatron;
  lado: Lado;
  zona: Zona | null;
  n: number;
  goles: number;
  /** Remates a puerta (gol o parada). */
  puerta: number;
  xg: number;
  acciones: AccionPlena[];
};

export type Orden = "goles" | "xg" | "puerta";

const LADO_TEXTO: Record<Lado, string> = { izquierda: "desde la izquierda", central: "desde el centro", derecha: "desde la derecha" };

/** Lado del saque en la pizarra (x en metros). En el córner no hay centro. */
function ladoDe(t: TipoPatron, saque: PuntoWy): Lado {
  const x = aMetros(saque).x;

  if (t === "corner") return x < 34 ? "izquierda" : "derecha";

  return x < 22 ? "izquierda" : x > 46 ? "derecha" : "central";
}

export function expande(datos: AbpTodas): AccionPlena[] {
  const salida: AccionPlena[] = [];

  for (const comp of datos.competiciones) {
    for (const a of comp.acciones) {
      const m = comp.partidos[a.id];

      if (!m) continue;

      salida.push({ accion: { ...a, p: m.p, fecha: m.f }, jornada: m.j, comp });
    }
  }

  return salida;
}

/** Agrupa; el que no tiene saque (ni caída, salvo en la directa) no entra: no se puede decir de qué patrón es. */
export function agrupa(todas: AccionPlena[]): Patron[] {
  const mapa = new Map<string, Patron>();

  for (const x of todas) {
    const a = x.accion;

    if (a.t === "penalti" || !a.saque) continue;

    const t = a.t as TipoPatron;

    const directa = t === "directa";

    if (!directa && !a.caida) continue;

    const lado = ladoDe(t, a.saque);

    const zona = directa ? null : zonaDe(aMetros(a.caida as PuntoWy), aMetros(a.saque));

    const clave = `${t}|${lado}|${zona ?? "-"}`;

    let p = mapa.get(clave);

    if (!p) {
      p = { clave, tipo: t, lado, zona, n: 0, goles: 0, puerta: 0, xg: 0, acciones: [] };

      mapa.set(clave, p);
    }

    p.n++;

    if (a.r === "gol") p.goles++;

    if (a.r === "gol" || a.r === "puerta") p.puerta++;

    p.xg += a.xg ?? 0;

    p.acciones.push(x);
  }

  return [...mapa.values()];
}

export const nombrePatron = (p: Pick<Patron, "tipo" | "lado" | "zona">) =>
  `${TIPO_PATRON_TEXTO[p.tipo]} ${LADO_TEXTO[p.lado]}${p.zona ? `, cae ${ZONA_TEXTO[p.zona]}` : ""}`;

export const golesPorAccion = (p: Patron) => p.goles / p.n;

export const xgPorAccion = (p: Patron) => p.xg / p.n;

export const pctPuerta = (p: Patron) => p.puerta / p.n;

const VALOR: Record<Orden, (p: Patron) => number> = { goles: golesPorAccion, xg: xgPorAccion, puerta: pctPuerta };

/** Ranking con muestra mínima. A igualdad, más acciones primero. */
export function ranking(patrones: Patron[], orden: Orden, minimo: number) {
  return patrones.filter((p) => p.n >= minimo).sort((a, b) => VALOR[orden](b) - VALOR[orden](a) || b.n - a.n);
}

const media = (v: PuntoWy[]): PuntoWy | undefined => (v.length ? [v.reduce((s, p) => s + p[0], 0) / v.length, v.reduce((s, p) => s + p[1], 0) / v.length] : undefined);

/** El dibujo del patrón: la media de los puntos de sus acciones. */
export function dibujoDePatron(p: Patron) {
  const de = (k: "saque" | "caida" | "remate") => media(p.acciones.map((x) => x.accion[k]).filter((v): v is PuntoWy => Array.isArray(v)));

  const media_: Accion = {
    t: p.tipo,
    r: "puerta",
    min: 0,
    seg: 0,
    parte: 1,
    p: "",
    id: "",
    fecha: "",
    saque: de("saque"),
    caida: de("caida"),
    remate: de("remate"),
  };

  return { ...rutinaDeAccion(media_), nombre: nombrePatron(p) };
}

/** Las acciones del patrón, goles primero y luego por xG. */
export function ordenadas(p: Patron) {
  return [...p.acciones].sort((a, b) => Number(b.accion.r === "gol") - Number(a.accion.r === "gol") || (b.accion.xg ?? 0) - (a.accion.xg ?? 0));
}
