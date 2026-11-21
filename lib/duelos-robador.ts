/**
 * EL ROBADOR OCULTO DEL RIVAL (13/11/2026), para /duelos.
 *
 * Un jugador sólo puede cortar cuando el balón lo tiene el otro. En un equipo
 * que casi no tiene el balón defiende mucho rato y sus cortes por 90 salen
 * inflados; en uno que lo tiene casi siempre defiende poco y salen cortos.
 * Se lleva la cifra a un partido con la posesión repartida a medias, con la
 * misma fórmula que la Comparativa (`lib/comparativa-posesion.ts`, el PAdj
 * de siempre):
 *
 *   ajustada = interceptaciones/90 × 50 / (100 − posesión media de su equipo)
 *
 *   Con el 56 % de balón defiende el 44 %: 8,4 × 50 / 44 = 9,5 (SUBE).
 *   Con el 39 % defiende el 61 %: 3,2 × 50 / 61 = 2,6 (BAJA).
 *   (21/11/2026: el texto de la pantalla decía «con menos balón corta más»
 *   para un equipo del 56 %; la cuenta era buena y la frase, al revés.)
 *
 * - **La cifra** es «Interceptaciones/90» de Wyscout: la descarga de jugadores
 *   no trae las recuperaciones sueltas, y la intercepción es el corte limpio.
 * - **El percentil** es contra los de su puesto en la categoría (esta
 *   temporada, 90′ o más) con la cifra ajustada igual, cada uno con la posesión
 *   de su equipo. Los de equipos sin posesión en Wyscout no entran: no se
 *   compara una cifra ajustada con una que no lo está.
 * - **Robador** = P80 o más ajustado. **Oculto** = además, en bruto queda por
 *   debajo del P80: es el que la tabla normal no enseña.
 * - **La zona** sale de Opta (`opta:jugadores`): de sus recuperaciones de la
 *   temporada, en qué tercio gana más balones (PosWonA3rd / M3rd / D3rd). Si
 *   no está en Opta o tiene muy pocas, no se pone nada.
 *
 * Funciones puras: no leen nada por su cuenta.
 */

import type { FilaJugador } from "@/lib/data-analisis/leer";
import { MINUTOS_MINIMOS, percentilEnPlantilla, puestoDe, valorDe, type Puesto } from "@/lib/data-analisis/individual";
import { mismaPersona, mismoEquipo, nombreCanonico } from "@/lib/data-analisis/nombres";
import { factorPosesion, posesionDe, type Posesiones } from "@/lib/comparativa-posesion";
import type { JugadorDuelo } from "@/lib/duelos";

export const COLUMNA_ROBO = "Interceptaciones/90";

/** Por debajo de estos minutos no se marca a nadie como robador: es tendencia (el umbral de Duelos). */
export const MUESTRA_ROBO = 450;

/** Desde este percentil (ajustado) se marca como robador. */
export const UMBRAL_ROBADOR = 80;

/**
 * Hacia dónde mueve el ajuste las cifras de un equipo con esta posesión, y la
 * frase que lo explica en pantalla (21/11/2026, jueces de fútbol). Con más de
 * la mitad del balón el ajuste SUBE (defiende menos rato del que tendría en un
 * partido a medias); con menos, BAJA; con el 50 %, no cambia.
 */
export function lecturaDelAjuste(posesion: number): { sentido: "sube" | "baja" | "igual"; defiende: number; factor: number; frase: string } {
  const pos = Math.round(posesion);
  const defiende = 100 - pos;
  const factor = factorPosesion(posesion);
  const sentido = Math.abs(factor - 1) < 0.005 ? "igual" : factor > 1 ? "sube" : "baja";
  const frase =
    sentido === "igual"
      ? `su equipo tiene el ${pos} % de posesión media en sus partidos de liga (Wyscout): defiende la mitad del partido y el ajuste no cambia sus cifras.`
      : sentido === "sube"
        ? `su equipo tiene el balón el ${pos} % (posesión media en sus partidos de liga, Wyscout) y defiende sólo el ${defiende} % del partido: con la mitad del partido para defender cortaría más, así que el ajuste sube sus cifras.`
        : `su equipo tiene el balón el ${pos} % (posesión media en sus partidos de liga, Wyscout) y defiende el ${defiende} % del partido: le sobran ratos para cortar, así que el ajuste baja sus cifras.`;
  return { sentido, defiende, factor, frase };
}

/** Por debajo de tantas recuperaciones en Opta, la zona no se dice. */
const MINIMO_ZONA = 5;

export type ZonaRobo = {
  /** Visto desde su lado: el «último tercio» suyo es nuestra salida. */
  tercio: "alta" | "media" | "baja";
  /** Qué parte de sus recuperaciones gana ahí (0-100). */
  parte: number;
  total: number;
};

export type RoboJugador = {
  jugador: JugadorDuelo;
  bruto: number;
  /** null si su equipo no tiene posesión en Wyscout: entonces no se marca. */
  ajustado: number | null;
  posesion: number | null;
  percentil: number | null;
  percentilBruto: number | null;
  robador: boolean;
  oculto: boolean;
  /** Menos de 450′ en Wyscout: se enseña como tendencia y sin la marca de robador (16/11/2026, jueces). */
  tendencia: boolean;
  zona: ZonaRobo | null;
};

type FilaOpta = Record<string, string | number | null>;

const numero = (v: unknown) => (typeof v === "number" && Number.isFinite(v) ? v : Number.isFinite(Number(v)) && v !== "" && v != null ? Number(v) : null);

/** Su zona habitual de robo en Opta, o null si no se le encuentra o tiene muy pocas. */
export function zonaDeRobo(jugador: JugadorDuelo, equipo: string, opta: FilaOpta[]): ZonaRobo | null {
  const delEquipo = opta.filter((f) => mismoEquipo(String(f.equipo ?? ""), equipo));
  const nombres = [jugador.nombre, jugador.wyscout?.jugador ?? ""].filter(Boolean);
  const candidatos = delEquipo.filter((f) => nombres.some((n) => mismaPersona(String(f.jugador ?? ""), n)));
  /* Dos del mismo apellido en el equipo: sólo vale el nombre entero. */
  const limpio = (s: string) => nombreCanonico(s).normalize("NFD").replace(/\p{Diacritic}/gu, "").toLowerCase().trim();
  const fila =
    candidatos.length === 1
      ? candidatos[0]
      : candidatos.find((f) => nombres.some((n) => limpio(String(f.jugador ?? "")) === limpio(n)));
  if (!fila) return null;

  const alta = numero(fila.PosWonA3rd) ?? 0;
  const media = numero(fila.PosWonM3rd) ?? 0;
  const baja = numero(fila.PosWonD3rd) ?? 0;
  const total = alta + media + baja;
  if (total < MINIMO_ZONA) return null;
  const [tercio, n] = ([["alta", alta], ["media", media], ["baja", baja]] as const).reduce((a, b) => (b[1] > a[1] ? b : a));
  return { tercio, parte: Math.round((n / total) * 100), total: Math.round(total) };
}

/** Lo que se lee en pantalla: el tercio desde nuestro punto de vista. */
export const rotuloZona = (z: ZonaRobo) =>
  z.tercio === "alta" ? "en nuestra salida (su último tercio)" : z.tercio === "media" ? "en el centro del campo" : "en su área y su tercio propio";

/**
 * La cifra, el percentil y la marca de cada suyo del once (sin el portero),
 * ordenados de más a menos cortes ajustados.
 */
export function robadoresDelOnce(
  once: JugadorDuelo[],
  jugadores: FilaJugador[],
  posesiones: Posesiones,
  opta: FilaOpta[],
  equipo: string,
): RoboJugador[] {
  /* La población de cada puesto, en bruto y ajustada con su propia posesión. */
  const porPuesto = new Map<Puesto, { bruto: number[]; ajustado: number[] }>();
  for (const j of jugadores) {
    if (j.temporada !== "actual" || j.minutos < MINUTOS_MINIMOS) continue;
    const v = valorDe(j, COLUMNA_ROBO);
    if (v === null) continue;
    const pos = posesionDe(j, posesiones);
    if (pos === null) continue;
    const p = puestoDe(j.posicion);
    const lista = porPuesto.get(p) ?? { bruto: [], ajustado: [] };
    lista.bruto.push(v);
    lista.ajustado.push(v * factorPosesion(pos));
    porPuesto.set(p, lista);
  }

  const salida: RoboJugador[] = [];
  for (const jugador of once) {
    const fila = jugador.wyscout;
    if (!fila || fila.minutos < MINUTOS_MINIMOS || jugador.puesto === "POR") continue;
    const bruto = valorDe(fila, COLUMNA_ROBO);
    if (bruto === null) continue;
    const posesion = posesionDe(fila, posesiones);
    const ajustado = posesion === null ? null : bruto * factorPosesion(posesion);
    const ref = porPuesto.get(puestoDe(fila.posicion));
    const hayRef = Boolean(ref && ref.ajustado.length >= 5);
    const percentil = ajustado !== null && hayRef ? percentilEnPlantilla(ajustado, ref!.ajustado, true) : null;
    const percentilBruto = hayRef ? percentilEnPlantilla(bruto, ref!.bruto, true) : null;
    /* Con menos de 450′ (Diao, 234′) el percentil es de muy pocos partidos: tendencia, sin marca. */
    const tendencia = fila.minutos < MUESTRA_ROBO;
    const robador = !tendencia && percentil !== null && percentil >= UMBRAL_ROBADOR;
    salida.push({
      jugador,
      bruto,
      ajustado,
      posesion,
      percentil,
      percentilBruto,
      robador,
      oculto: robador && percentilBruto !== null && percentilBruto < UMBRAL_ROBADOR,
      tendencia,
      zona: zonaDeRobo(jugador, equipo, opta),
    });
  }
  /* Primero los que tienen cifra ajustada (comparables entre sí); después, en bruto. */
  return salida.sort((a, b) => Number(b.ajustado != null) - Number(a.ajustado != null) || (b.ajustado ?? b.bruto) - (a.ajustado ?? a.bruto));
}
