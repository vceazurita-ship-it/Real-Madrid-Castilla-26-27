/**
 * ESTILOS DE LOS JUGADORES (11/11/2026): el Venn de «dominio, peligro y
 * solidez» de los equipos (`lib/opta-estilos.ts`), pero jugador a jugador y
 * por puesto, para el área «Estilos de juego» de Análisis de datos.
 *
 * Fuente: `opta:jugadores` (Supabase), que trae a TODOS los jugadores de la
 * categoría (los dos grupos, ≈1.000) con su puesto más repetido
 * (`gameDetailedPosition`) y unas 70 métricas de temporada. Es la que ya usa
 * la app para el percentil por puesto («Área de mejora», `MINUTOS_REFERENCIA`).
 *
 * Cómo se cuenta: cada conjunto es la media de los percentiles de sus métricas
 * por 90′ (los porcentajes, tal cual) contra los jugadores de su mismo puesto
 * con el mínimo de minutos y dentro del ámbito elegido. Un jugador entra en un
 * círculo cuando ese índice llega al umbral. Las métricas cambian con el
 * puesto: a un central no se le pide lo mismo que a un extremo, y por eso los
 * tres conjuntos cambian de contenido, aunque no de nombre.
 *
 * Los porteros se quedan fuera: lo suyo (paradas, goles evitados, salida) no
 * se reparte en estos tres conjuntos sin forzarlo.
 *
 * Funciones puras: se prueban en Node con las copias de `.cache/opta`.
 */

import { percentil, type MetricaOpta } from "@/lib/opta";
import { familiaDe, nombreEquipo, valorJugador, type Fila } from "@/lib/opta-analisis";
import type { Indice, MetricaIndice } from "@/lib/opta-estilos";

export type PuestoEstilo = "Centrales" | "Laterales" | "Mediocentros" | "Mediapuntas" | "Delanteros";

type Conjunto = { que: string; metricas: MetricaIndice[] };

export const PUESTOS_ESTILO: {
  clave: PuestoEstilo;
  nombre: string;
  /** Las familias de `FAMILIA_PUESTO` que entran (mediapuntas y extremos van juntos). */
  familias: string[];
  conjuntos: Record<Indice, Conjunto>;
}[] = [
  {
    clave: "Centrales",
    nombre: "Centrales",
    familias: ["Centrales"],
    conjuntos: {
      dominio: { que: "Sacar el balón y dar juego", metricas: [{ a: "Touches" }, { a: "PsAtt" }, { a: "Pass%" }, { a: "LgBallCp" }] },
      peligro: { que: "Pisar el área rival", metricas: [{ a: "ExpG" }, { a: "ShtIncBl" }, { a: "Arl%AH" }, { a: "Chance" }] },
      solidez: {
        que: "Ganar duelos y no regalar nada atrás",
        metricas: [{ a: "Duel%" }, { a: "Aerial%" }, { a: "Int" }, { a: "Clrnce" }, { a: "PsLostD3", inverso: true }],
      },
    },
  },
  {
    clave: "Laterales",
    nombre: "Laterales",
    familias: ["Laterales"],
    conjuntos: {
      dominio: { que: "Participar y subir", metricas: [{ a: "Touches" }, { a: "PsAtt" }, { a: "Pass%" }, { a: "TchsA3" }] },
      peligro: { que: "Centrar y crear", metricas: [{ a: "xA" }, { a: "Chance" }, { a: "CrossCmp" }, { a: "TouchOpBox" }] },
      solidez: {
        que: "Defender su banda",
        metricas: [{ a: "Duel%" }, { a: "Tackle%" }, { a: "Int" }, { a: "Recovery" }, { a: "PossLost", inverso: true }],
      },
    },
  },
  {
    clave: "Mediocentros",
    nombre: "Mediocentros",
    familias: ["Mediocentros"],
    conjuntos: {
      dominio: { que: "Tener el balón y moverlo", metricas: [{ a: "Touches" }, { a: "PsAtt" }, { a: "Pass%" }, { a: "Ps%InA3rd" }] },
      peligro: { que: "Dar el último pase o llegar", metricas: [{ a: "xA" }, { a: "ExpG" }, { a: "Chance" }, { a: "ThrghBalls" }] },
      solidez: {
        que: "Recuperar y no perderla",
        metricas: [{ a: "Recovery" }, { a: "Int" }, { a: "Duel%" }, { a: "PossLost", inverso: true }],
      },
    },
  },
  {
    clave: "Mediapuntas",
    nombre: "Mediapuntas y extremos",
    familias: ["Mediapuntas", "Bandas"],
    conjuntos: {
      dominio: { que: "Recibir arriba y aguantarla", metricas: [{ a: "Touches" }, { a: "TchsA3" }, { a: "Ps%InA3rd" }, { a: "FoulSuf" }] },
      peligro: { que: "Remate, último pase y regate", metricas: [{ a: "ExpG" }, { a: "xA" }, { a: "TouchOpBox" }, { a: "1v1InBox" }] },
      solidez: {
        que: "Apretar y no regalarla",
        metricas: [{ a: "PosWonA3rd" }, { a: "Duel%" }, { a: "PossLost", inverso: true }, { a: "Disposs", inverso: true }],
      },
    },
  },
  {
    clave: "Delanteros",
    nombre: "Delanteros",
    familias: ["Delanteros"],
    conjuntos: {
      dominio: { que: "Ser referencia: tocar, ganar arriba, aguantar", metricas: [{ a: "Touches" }, { a: "AerialWon" }, { a: "Aerial%" }, { a: "FoulSuf" }] },
      peligro: { que: "Rematar y pisar el área", metricas: [{ a: "ExpG" }, { a: "ShtIncBl" }, { a: "TouchOpBox" }, { a: "xA" }] },
      solidez: {
        que: "Presionar y no perderla",
        metricas: [{ a: "PosWonA3rd" }, { a: "Recovery" }, { a: "Duel%" }, { a: "PossLost", inverso: true }],
      },
    },
  },
];

export const puestoEstilo = (clave: PuestoEstilo) => PUESTOS_ESTILO.find((p) => p.clave === clave) ?? PUESTOS_ESTILO[2];

/** El puesto del Venn de un jugador (o null si es portero o no tiene puesto). */
export function puestoEstiloDe(f: Fila): PuestoEstilo | null {
  const fam = familiaDe(f);
  return PUESTOS_ESTILO.find((p) => p.familias.includes(fam))?.clave ?? null;
}

export type IndicesJugador = {
  playerId: string;
  jugador: string;
  teamId: string;
  equipo: string;
  minutos: number;
} & Record<Indice, number | null>;

const media = (xs: (number | null)[]) => {
  const v = xs.filter((x): x is number => x != null);
  return v.length ? v.reduce((s, x) => s + x, 0) / v.length : null;
};

/**
 * Los tres índices (0-100) de cada jugador de `muestra` contra los demás de
 * `muestra`. Quien llama ya ha filtrado puesto, minutos y ámbito.
 */
export function indicesJugadores(muestra: Fila[], puesto: PuestoEstilo, catalogo?: Map<string, MetricaOpta>): IndicesJugador[] {
  const def = puestoEstilo(puesto);
  const claves = Object.keys(def.conjuntos) as Indice[];
  const valores = new Map<string, (number | null)[]>();
  for (const k of claves)
    for (const m of def.conjuntos[k].metricas)
      if (!valores.has(m.a)) valores.set(m.a, muestra.map((f) => valorJugador(f, m.a, 1, catalogo)));
  return muestra.map((f, i) => {
    const salida = {
      playerId: String(f.playerId ?? ""),
      jugador: String(f.jugador ?? ""),
      teamId: String(f.teamId ?? ""),
      equipo: nombreEquipo(f),
      minutos: Number(f.Min) || 0,
    } as IndicesJugador;
    for (const k of claves) {
      salida[k] = media(
        def.conjuntos[k].metricas.map((m) => {
          const xs = valores.get(m.a)!;
          return percentil(xs[i], xs, m.inverso);
        }),
      );
    }
    return salida;
  });
}

/** Máscara de pertenencia (bit 0 dominio, 1 peligro, 2 solidez) con un umbral de 0-100. */
export function mascaraJugador(x: IndicesJugador, umbral: number): number {
  return ((x.dominio ?? -1) >= umbral ? 1 : 0) | ((x.peligro ?? -1) >= umbral ? 2 : 0) | ((x.solidez ?? -1) >= umbral ? 4 : 0);
}

/** «Lucho García» se queda; «Juan Antonio Rodríguez» pasa a «J. Rodríguez». */
export function nombreCortoJugador(n: string): string {
  const t = n.trim();
  if (t.length <= 14) return t;
  const partes = t.split(/\s+/);
  if (partes.length < 2) return t;
  return `${partes[0][0]}. ${partes[partes.length - 1]}`;
}
