/*
|--------------------------------------------------------------------------
| DÓNDE JUEGA CADA UNO Y DÓNDE LO PONE EL CUERPO TÉCNICO (14/10/2026)
|--------------------------------------------------------------------------
|
| Hasta hoy la herramienta sólo distinguía cinco puestos (portero, defensa,
| medio, extremo, delantero) y rellenaba los huecos del dibujo por ese orden:
| un lateral izquierdo podía acabar de central derecho y un extremo derecho
| en la izquierda. Ahora cada jugador tiene un **punto preferido** en el
| campo y se le coloca en el hueco más cercano a él, todos a la vez (la
| asignación que menos distancia suma, no el primero que llega).
|
| El punto preferido sale, por este orden:
|   1. de lo **aprendido**: dónde lo ha puesto el cuerpo técnico a mano en las
|      sesiones anteriores (media ponderada, lo reciente pesa más);
|   2. de su **demarcación** (la de la plantilla, PORTERO / LATERAL D. / 6 …,
|      o la que se le ponga a mano en la sesión);
|   3. de su **puesto** de cinco.
|
| Y al cambiar el dibujo de un equipo ya colocado, cada uno va al hueco del
| dibujo nuevo más parecido al que tenía (el lateral sigue en su banda, el
| de atrás sigue atrás), en vez de borrar lo hecho.
|
| Coordenadas como en `estructura.ts`: x de 0 (izquierda) a 1 (derecha),
| y de 1 (su portería, abajo) a 0 (la contraria, arriba). Sin React.
*/

import { claveNombre, type JugadorSesion, type Puesto } from "@/lib/sesion-equipos/modelo";

export type Punto = { x: number; y: number };

export type Demarcacion = "por" | "li" | "dfc" | "ld" | "mcd" | "mc" | "mp" | "ei" | "ed" | "dc";

export const DEMARCACIONES: { clave: Demarcacion; nombre: string; corto: string; puesto: Puesto; punto: Punto }[] = [
  { clave: "por", nombre: "Portero", corto: "POR", puesto: "POR", punto: { x: 0.5, y: 0.95 } },
  { clave: "li", nombre: "Lateral izquierdo", corto: "LI", puesto: "DEF", punto: { x: 0.14, y: 0.76 } },
  { clave: "dfc", nombre: "Central", corto: "DFC", puesto: "DEF", punto: { x: 0.5, y: 0.84 } },
  { clave: "ld", nombre: "Lateral derecho", corto: "LD", puesto: "DEF", punto: { x: 0.86, y: 0.76 } },
  { clave: "mcd", nombre: "Pivote (6)", corto: "MCD", puesto: "MED", punto: { x: 0.5, y: 0.64 } },
  { clave: "mc", nombre: "Interior (8)", corto: "MC", puesto: "MED", punto: { x: 0.5, y: 0.52 } },
  { clave: "mp", nombre: "Mediapunta (10)", corto: "MP", puesto: "MED", punto: { x: 0.5, y: 0.36 } },
  { clave: "ei", nombre: "Extremo izquierdo (11)", corto: "EI", puesto: "EXT", punto: { x: 0.14, y: 0.3 } },
  { clave: "ed", nombre: "Extremo derecho (7)", corto: "ED", puesto: "EXT", punto: { x: 0.86, y: 0.3 } },
  { clave: "dc", nombre: "Delantero (9)", corto: "DC", puesto: "DEL", punto: { x: 0.5, y: 0.14 } },
];

const POR_CLAVE = new Map(DEMARCACIONES.map((d) => [d.clave, d]));

export const demarcacion = (clave: Demarcacion | undefined) => (clave ? POR_CLAVE.get(clave) : undefined);

/** Un punto para cada puesto de cinco, cuando no se sabe más. */
const PUNTO_PUESTO: Record<Puesto, Punto> = {
  POR: { x: 0.5, y: 0.95 },
  DEF: { x: 0.5, y: 0.8 },
  MED: { x: 0.5, y: 0.55 },
  EXT: { x: 0.5, y: 0.3 },
  DEL: { x: 0.5, y: 0.14 },
};

/**
 * La columna POSICION de la plantilla en demarcación. Es el mismo vocabulario
 * que traduce `lib/ratings/pitch.ts`: PORTERO, CENTRAL, LATERAL D./I. y los
 * dorsales de rol 6, 8, 10, 7, 11 y 9.
 */
export function demarcacionDePosicion(posicion: string): Demarcacion | undefined {
  const p = posicion
    .trim()
    .toUpperCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "");

  if (!p) return undefined;
  if (p.startsWith("PORTER") || p === "1") return "por";
  if (p.startsWith("LATERAL I") || p.startsWith("CARRILERO I")) return "li";
  if (p.startsWith("LATERAL D") || p.startsWith("CARRILERO D")) return "ld";
  if (p.startsWith("CENTRAL") || p.startsWith("DEFENSA") || /^[2-5]$/.test(p)) return "dfc";
  if (p === "6" || p.startsWith("PIVOTE")) return "mcd";
  if (p === "8" || p.startsWith("INTERIOR") || p.startsWith("MEDIO")) return "mc";
  if (p === "10" || p.startsWith("MEDIAPUNTA")) return "mp";
  if (p === "11" || p.startsWith("EXTREMO I")) return "ei";
  if (p === "7" || p.startsWith("EXTREMO D")) return "ed";
  if (p === "9" || p.startsWith("DELANTER") || p.startsWith("PUNTA")) return "dc";

  return undefined;
}

/* ------------------------------------------------------------------ */
/*  La geometría por defecto de un dibujo (la misma que estructura.ts)  */
/* ------------------------------------------------------------------ */

/** Los puntos de los huecos de campo de unas líneas («4-3-3»), de atrás adelante y de izquierda a derecha. */
export function puntosDeLineas(lineas: number[]): Punto[] {
  const L = lineas.length;
  const puntos: Punto[] = [];

  lineas.forEach((n, linea) => {
    const y = L === 1 ? 0.5 : 0.84 - (linea / (L - 1)) * 0.7;

    for (let i = 0; i < n; i += 1) puntos.push({ x: (i + 1) / (n + 1), y });
  });

  return puntos;
}

/* ------------------------------------------------------------------ */
/*  La asignación que menos distancia suma                             */
/* ------------------------------------------------------------------ */

/**
 * El método húngaro para una matriz de costes filas × columnas (filas ≤
 * columnas): a cada fila, una columna distinta, sumando el mínimo. Con once
 * jugadores es instantáneo. Devuelve la columna de cada fila.
 */
export function asignacionMinima(coste: number[][]): number[] {
  const n = coste.length;

  if (!n) return [];

  const m = coste[0].length;
  const u = new Array(n + 1).fill(0);
  const v = new Array(m + 1).fill(0);
  const p = new Array(m + 1).fill(0);
  const camino = new Array(m + 1).fill(0);

  for (let i = 1; i <= n; i += 1) {
    p[0] = i;
    let j0 = 0;
    const minv = new Array(m + 1).fill(Infinity);
    const usado = new Array(m + 1).fill(false);

    do {
      usado[j0] = true;
      const i0 = p[j0];
      let delta = Infinity;
      let j1 = 0;

      for (let j = 1; j <= m; j += 1) {
        if (usado[j]) continue;

        const cur = coste[i0 - 1][j - 1] - u[i0] - v[j];

        if (cur < minv[j]) {
          minv[j] = cur;
          camino[j] = j0;
        }

        if (minv[j] < delta) {
          delta = minv[j];
          j1 = j;
        }
      }

      for (let j = 0; j <= m; j += 1) {
        if (usado[j]) {
          u[p[j]] += delta;
          v[j] -= delta;
        } else {
          minv[j] -= delta;
        }
      }

      j0 = j1;
    } while (p[j0] !== 0);

    do {
      const j1 = camino[j0];

      p[j0] = p[j1];
      j0 = j1;
    } while (j0);
  }

  const columnaDe = new Array(n).fill(-1);

  for (let j = 1; j <= m; j += 1) if (p[j]) columnaDe[p[j] - 1] = j - 1;

  return columnaDe;
}

/**
 * La distancia entre el sitio de un jugador y un hueco. La banda pesa más que
 * la altura: un lateral derecho de extremo derecho chirría menos que de
 * lateral izquierdo.
 */
const distancia = (a: Punto, b: Punto) => 1.6 * (a.x - b.x) ** 2 + (a.y - b.y) ** 2;

/**
 * Reparte jugadores en huecos: cada uno al que mejor le cae, todos a la vez.
 * Devuelve, por hueco, el índice del jugador (o -1), y los que no caben.
 */
export function colocaPorAfinidad(preferidos: Punto[], huecos: Punto[]): { porHueco: number[]; sobran: number[] } {
  const porHueco = new Array(huecos.length).fill(-1);

  if (!preferidos.length || !huecos.length) return { porHueco, sobran: preferidos.map((_, i) => i) };

  /* Más jugadores que huecos: se traspone (cada hueco elige jugador) y los que quedan, sobran. */
  if (preferidos.length > huecos.length) {
    const columna = asignacionMinima(huecos.map((h) => preferidos.map((p) => distancia(p, h))));
    const usados = new Set<number>();

    columna.forEach((jug, hueco) => {
      porHueco[hueco] = jug;
      usados.add(jug);
    });

    return { porHueco, sobran: preferidos.map((_, i) => i).filter((i) => !usados.has(i)) };
  }

  const columna = asignacionMinima(preferidos.map((p) => huecos.map((h) => distancia(p, h))));

  columna.forEach((hueco, jug) => {
    if (hueco >= 0) porHueco[hueco] = jug;
  });

  return { porHueco, sobran: [] };
}

/**
 * Al cambiar de dibujo: cada uno, al hueco nuevo más parecido al que tenía.
 * Las alturas se estiran al rango del dibujo nuevo (de una línea de cuatro
 * a una de tres, el más retrasado sigue siendo el más retrasado).
 *
 * El sitio viejo solo no basta: en un 4-3-3 los tres de arriba están a la
 * misma altura y, al pasar a 4-4-2, el 9 bajaba al medio y los extremos se
 * quedaban de puntas. Por eso, si se sabe dónde juega cada uno (`preferido`),
 * se mezcla a medias con el sitio que tenía: el extremo pasa a la banda del
 * medio y el 9 sigue arriba.
 */
export function reubicaEnDibujo(viejos: { id: string; punto: Punto; preferido?: Punto }[], nuevos: Punto[]): string[] {
  if (!viejos.length) return nuevos.map(() => "");

  const ys = viejos.map((v) => v.punto.y);
  const yMin = Math.min(...ys);
  const yMax = Math.max(...ys);
  const nys = nuevos.map((p) => p.y);
  const nMin = Math.min(...nys);
  const nMax = Math.max(...nys);
  const estira = (y: number) => (yMax - yMin < 0.05 ? (nMin + nMax) / 2 : nMin + ((y - yMin) / (yMax - yMin)) * (nMax - nMin));

  const objetivo = (v: { punto: Punto; preferido?: Punto }) => {
    const antes = { x: v.punto.x, y: estira(v.punto.y) };

    return v.preferido ? { x: (antes.x + v.preferido.x) / 2, y: (antes.y + v.preferido.y) / 2 } : antes;
  };

  const { porHueco } = colocaPorAfinidad(viejos.map(objetivo), nuevos);

  return porHueco.map((i) => (i >= 0 ? viejos[i].id : ""));
}

/* ------------------------------------------------------------------ */
/*  El punto preferido de cada jugador                                 */
/* ------------------------------------------------------------------ */

export type Aprendido = { x: number; y: number; veces: number };

/**
 * El sitio de un jugador para colocarlo: lo aprendido si se le ha colocado
 * a mano al menos dos veces; si no, su demarcación; si no, su puesto.
 */
export function puntoPreferido(
  j: JugadorSesion,
  demarcacionDe: (j: JugadorSesion) => Demarcacion | undefined,
  puestoDe: (j: JugadorSesion) => Puesto | undefined,
  aprendido?: Aprendido,
): Punto {
  const d = demarcacion(demarcacionDe(j));
  const base = d?.punto ?? PUNTO_PUESTO[puestoDe(j) ?? "MED"];

  if (aprendido && aprendido.veces >= 2) {
    /* Con pocas veces, a medias con la demarcación; con muchas, manda lo aprendido. */
    const peso = Math.min(0.85, aprendido.veces / (aprendido.veces + 2));

    return { x: base.x + (aprendido.x - base.x) * peso, y: base.y + (aprendido.y - base.y) * peso };
  }

  return base;
}

/* ------------------------------------------------------------------ */
/*  Desde la plantilla, y el grupo para repartir parejo                */
/* ------------------------------------------------------------------ */

/**
 * La demarcación de cada uno de la lista según la plantilla, cruzando por
 * nombre igual que `puestosDesdePlantilla` (todas las palabras del nombre o
 * del apodo de la ficha en el de la lista; si casan dos fichas, ninguna).
 */
export function demarcacionesDesdePlantilla(jugadores: JugadorSesion[], plantilla: { nombre: string; apodo?: string; posicion: string }[]) {
  const salida: Record<string, Demarcacion> = {};

  for (const j of jugadores) {
    const suyas = new Set(claveNombre(j.nombre).split(" "));
    const casan = plantilla.filter((f) =>
      [f.nombre, f.apodo ?? ""].some((n) => {
        const pals = claveNombre(n).split(" ").filter((p) => p.length > 1);

        return pals.length > 0 && pals.every((p) => suyas.has(p));
      }),
    );
    const ds = [...new Set(casan.map((f) => demarcacionDePosicion(f.posicion)).filter(Boolean))] as Demarcacion[];

    if (ds.length === 1) salida[j.id] = ds[0];
  }

  return salida;
}

/**
 * El grupo para repartir parejo en un sorteo: no basta con que cada peto
 * lleve dos defensas, que sean un lateral y un central.
 */
export function grupoDeDemarcacion(d: Demarcacion | undefined): string | undefined {
  if (!d) return undefined;
  if (d === "li" || d === "ld") return "LAT";
  if (d === "ei" || d === "ed") return "EXT";
  if (d === "mc" || d === "mp") return "INT";

  return d.toUpperCase();
}

/**
 * La demarcación más cercana a un punto: para los que no tienen ninguna (ni
 * en la plantilla ni a mano) pero el cuerpo técnico ya los ha colocado varias
 * veces. Sin portero: al portero no se le coloca en el dibujo.
 */
export function demarcacionCercana(p: Punto): Demarcacion {
  return DEMARCACIONES.filter((d) => d.clave !== "por").sort((a, b) => distancia(a.punto, p) - distancia(b.punto, p))[0].clave;
}
