/*
|--------------------------------------------------------------------------
| LO QUE LOS CRITERIOS NECESITAN DE FUERA (02/11/2026)
|--------------------------------------------------------------------------
|
| Los criterios de lib/sesion-equipos/criterios.ts no saben de la pizarra
| táctica ni de Wyscout: reciben ids de la sesión. Aquí se traduce:
|
|   - los TITULARES: el once de la pizarra táctica (`onceDeLaPizarra`) casado
|     por NOMBRE con la lista del delegado —nunca por id: los JUG-XX se
|     renumeran— pasando por la plantilla (la pizarra pone «Rober», la lista
|     «ROBERTO MARTÍN», la plantilla tiene los dos);
|   - las PAREJAS: las sinergias de Wyscout (`sinergiasDe`, lib/data-analisis/
|     sinergias.ts) de los de la sesión que tienen fila, con el puesto que le
|     da su demarcación aquí;
|   - los RASGOS: lo que más destaca de cada uno contra los de su puesto en la
|     liga (percentil ≥ 60, con el filtro de volumen de la ficha individual).
|
| Los que suben del RMC o del Juvenil A no tienen fila de Wyscout del
| Castilla: no entran en parejas ni rasgos y se reparten por su línea.
*/

import type { JugadorSesion } from "@/lib/sesion-equipos/modelo";
import type { Demarcacion } from "@/lib/sesion-equipos/demarcacion";
import type { ParejaSesion, RasgoSesion } from "@/lib/sesion-equipos/criterios";
import { casaNombre as casaNombrePizarra, type OnceDeLaPizarra } from "@/lib/tactics/onceDeLaPizarra";
import { casaNombre, ladoDeWyscout, lineaDe, sitioDe, type JugadorOnce, type Lado } from "@/lib/data-analisis/once";
import { comparablesDe, esNuestro, puestoDe as puestoWyscout, volumenDelPorcentaje, type Puesto as PuestoWys } from "@/lib/data-analisis/individual";
import { percentil } from "@/lib/data-analisis/metricas";
import { sinergiasDe } from "@/lib/data-analisis/sinergias";
import type { FilaJugador } from "@/lib/data-analisis/leer";

/* ------------------------------------------------------------------ */
/*  TITULARES                                                          */
/* ------------------------------------------------------------------ */

/**
 * Los de la sesión que están en el once de la pizarra. `nombresDe` da los
 * nombres por los que se le conoce (el de la lista y los de su ficha).
 * Cada ficha de la pizarra casa con uno solo, el que mejor casa.
 */
export function titularesDeLaSesion(once: OnceDeLaPizarra | null, jugadores: JugadorSesion[], nombresDe: (j: JugadorSesion) => string[]) {
  const ids = new Set<string>();

  if (!once) return ids;

  for (const ficha of once.fichas) {
    if (!ficha.nombre) continue;

    let mejor: JugadorSesion | undefined;
    let fuerza = 0;

    for (const j of jugadores) {
      if (ids.has(j.id)) continue;

      for (const n of nombresDe(j)) {
        const f = casaNombrePizarra(ficha.nombre, n);

        if (f > fuerza) {
          fuerza = f;
          mejor = j;
        }
      }
    }

    if (mejor) ids.add(mejor.id);
  }

  return ids;
}

/* ------------------------------------------------------------------ */
/*  DE NUESTRA DEMARCACIÓN AL PUESTO DE WYSCOUT                        */
/* ------------------------------------------------------------------ */

const PUESTO_DE: Record<Demarcacion, { puesto: PuestoWys; lado: Lado }> = {
  por: { puesto: "POR", lado: "C" },
  li: { puesto: "LAT", lado: "I" },
  ld: { puesto: "LAT", lado: "D" },
  dfc: { puesto: "CEN", lado: "C" },
  mcd: { puesto: "MED", lado: "C" },
  mc: { puesto: "MED", lado: "C" },
  mp: { puesto: "BAN", lado: "C" },
  ei: { puesto: "BAN", lado: "I" },
  ed: { puesto: "BAN", lado: "D" },
  dc: { puesto: "DEL", lado: "C" },
};

/** Los de la sesión con su fila de Wyscout del Castilla, como jugador del once. */
export function jugadoresConWyscout(
  jugadores: JugadorSesion[],
  filas: FilaJugador[],
  demarcacionDe: (j: JugadorSesion) => Demarcacion | undefined,
  nombresDe: (j: JugadorSesion) => string[],
): JugadorOnce[] {
  const nuestros = filas.filter((f) => esNuestro(f) && f.temporada === "actual");
  const usadas = new Set<FilaJugador>();
  const salida: JugadorOnce[] = [];

  for (const j of jugadores) {
    let fila: FilaJugador | null = null;

    for (const n of nombresDe(j)) {
      fila = casaNombre(n, nuestros.filter((f) => !usadas.has(f)), (f) => f.jugador);
      if (fila) break;
    }

    if (!fila) continue;

    usadas.add(fila);

    const d = demarcacionDe(j);
    const sitio = sitioDe("", fila.posicion);
    const nuestro = d ? PUESTO_DE[d] : null;
    /* El central: el lado lo dice Wyscout (LCB / RCB); nuestra demarcación no lo distingue. */
    const puesto = nuestro?.puesto ?? sitio.puesto;
    const lado = nuestro ? (nuestro.puesto === "CEN" || nuestro.puesto === "MED" ? ladoDeWyscout(fila.posicion) : nuestro.lado) : sitio.lado;

    salida.push({ id: j.id, nombre: j.nombre, puesto, lado, linea: lineaDe(puesto), sitio, wyscout: fila, nuestra: null, opta: null });
  }

  return salida;
}

/* ------------------------------------------------------------------ */
/*  PAREJAS                                                            */
/* ------------------------------------------------------------------ */

/** Las parejas de la sesión que Wyscout juzga, con su saldo y el porqué en pocas palabras. */
export function parejasDeLaSesion(conWyscout: JugadorOnce[], filas: FilaJugador[]): ParejaSesion[] {
  if (conWyscout.length < 2) return [];

  return sinergiasDe(conWyscout, filas, "liga")
    .filter((p) => p.saldo !== 0)
    .map((p) => {
      const buena = p.veredictos.find((v) => (p.saldo > 0 ? v.estado === "potencia" : v.estado === "hueco" || v.estado === "pisan"));

      /* «Uno por fuera, otro por dentro (izquierda)» → «… por la izquierda»: va ya entre paréntesis en la explicación. */
      const motivo = (buena?.relacion.nombre ?? p.etiqueta).toLowerCase().replace(/\s*\((izquierda|derecha)\)/, " por la $1");

      return { a: p.a.id, b: p.b.id, saldo: p.saldo, motivo };
    });
}

/* ------------------------------------------------------------------ */
/*  RASGOS                                                             */
/* ------------------------------------------------------------------ */

type Rasgo = RasgoSesion & { columna: string };

const AEREO: Rasgo = { clave: "aereo", rotulo: "Juego aéreo", columna: "Duelos aéreos ganados, %" };
const SALIDA: Rasgo = { clave: "salida", rotulo: "Salida de balón", columna: "Pases progresivos/90" };
const ANTICIPA: Rasgo = { clave: "anticipa", rotulo: "Anticipación", columna: "Interceptaciones/90" };
const RECORRIDO: Rasgo = { clave: "recorrido", rotulo: "Recorrido", columna: "Carreras en progresión/90" };
const CENTRO: Rasgo = { clave: "centro", rotulo: "Centro", columna: "Centros/90" };
const RECUPERA: Rasgo = { clave: "recupera", rotulo: "Recuperación", columna: "Acciones defensivas realizadas/90" };
const LLEGADA: Rasgo = { clave: "llegada", rotulo: "Llegada", columna: "Toques en el área de penalti/90" };
const REGATE: Rasgo = { clave: "regate", rotulo: "Regate", columna: "Regates/90" };
const PROFUNDIDAD: Rasgo = { clave: "profundidad", rotulo: "Profundidad", columna: "Ataque en profundidad/90" };
const REMATE: Rasgo = { clave: "remate", rotulo: "Remate", columna: "xG/90" };
const ASOCIA: Rasgo = { clave: "asocia", rotulo: "Asociación", columna: "Pases recibidos /90" };

/** Qué se le mira a cada puesto: lo que distingue a uno de otro del mismo puesto. */
const RASGOS_DEL_PUESTO: Record<PuestoWys, Rasgo[]> = {
  POR: [],
  CEN: [AEREO, SALIDA, ANTICIPA],
  LAT: [RECORRIDO, CENTRO, RECUPERA],
  MED: [RECUPERA, SALIDA, LLEGADA],
  BAN: [REGATE, PROFUNDIDAD, CENTRO, LLEGADA],
  DEL: [REMATE, AEREO, PROFUNDIDAD, ASOCIA],
};

/** A partir de aquí, se dice que lo tiene. */
const DESTACA = 60;

/** El rasgo que más destaca de cada uno contra los de su puesto en la liga. */
export function rasgosDeLaSesion(conWyscout: JugadorOnce[], filas: FilaJugador[]): Record<string, RasgoSesion & { percentil: number }> {
  const salida: Record<string, RasgoSesion & { percentil: number }> = {};
  const comparables = new Map<PuestoWys, FilaJugador[]>();

  for (const j of conWyscout) {
    if (!j.wyscout) continue;

    const puesto = j.puesto ?? puestoWyscout(j.wyscout.posicion);

    if (!comparables.has(puesto)) comparables.set(puesto, comparablesDe(filas, puesto, "liga").lista);

    const lista = comparables.get(puesto)!;
    let mejor: (RasgoSesion & { percentil: number }) | null = null;

    for (const r of RASGOS_DEL_PUESTO[puesto] ?? []) {
      const valor = j.wyscout.datos[r.columna];

      if (valor === undefined || !volumenDelPorcentaje(j.wyscout, r.columna).fiable) continue;

      const suyos = lista.map((f) => f.datos[r.columna]).filter((v): v is number => v !== undefined);

      if (suyos.length < 3) continue;

      const p = percentil(valor, suyos, true);

      if (p !== null && p >= DESTACA && (!mejor || p > mejor.percentil)) mejor = { clave: r.clave, rotulo: r.rotulo, percentil: Math.round(p) };
    }

    if (mejor) salida[j.id] = mejor;
  }

  return salida;
}
