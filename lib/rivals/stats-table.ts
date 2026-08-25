/*
|--------------------------------------------------------------------------
| COLUMNAS DE LA TABLA DE TEMPORADAS
|--------------------------------------------------------------------------
|
| Qué columnas lleva el rendimiento de un jugador rival, en qué orden y cómo
| se formatea cada número. Estaba dentro de `PlayerStatsCard`, pero el PDF del
| once pinta la misma tabla con jsPDF y tiene que salir columna por columna
| igual que en la ficha de pantalla: si aquí se añade una, aparece en los dos
| sitios.
|
| Los porteros cambian dos columnas: donde los de campo llevan goles y
| asistencias, ellos llevan goles encajados y penaltis parados.
*/

import {
  goalsAgainstPerGame,
  minutesPerGame,
  starterShare,
  type RivalSeasonStats,
} from "@/lib/rivals/stats";

export type ColumnaTemporada = {
  key: string;
  /** Cabecera corta, la de una tabla de fútbol. */
  label: string;
  /** Nombre completo, para el `title` de la cabecera en pantalla. */
  titulo: string;
  valor: (season: RivalSeasonStats) => string;
  /** Segunda línea pequeña bajo el número (ritmo, porcentaje…). */
  detalle?: (season: RivalSeasonStats) => string | undefined;
  /** Color del número cuando no es cero. */
  color?: string;
  /** Se estrecha en móvil; en el PDF cabe siempre. */
  secundaria?: boolean;
};

function fmt(value: number | undefined | null) {
  return value === undefined || value === null ? "—" : String(value);
}

/*
| Por debajo de esto el ritmo por 90' no dice nada: el gol suelto de un
| central sale como "0.07 cada 90'", que es ruido. Con volumen sí distingue
| al que marca porque juega del que marca de verdad.
*/
const MIN_PARA_RITMO = 3;

/** Ritmo por 90 minutos, con dos decimales y sin ceros de adorno. */
function per90(total: number, minutos: number) {
  if (!minutos) return "0";

  return String(Math.round((total / minutos) * 90 * 100) / 100);
}

function ritmo(total: number | undefined, minutos: number) {
  if (!total || total < MIN_PARA_RITMO) return undefined;

  return `${per90(total, minutos)}/90'`;
}

const COMUNES_INICIO: ColumnaTemporada[] = [
  {
    key: "partidos",
    label: "PJ",
    titulo: "Partidos jugados",
    valor: (s) => String(s.partidos),
  },
  {
    key: "titular",
    label: "Tit",
    titulo: "Partidos de titular",
    valor: (s) => String(s.titular),
    detalle: (s) => {
      const share = starterShare(s);

      return share === null ? undefined : `${share}%`;
    },
  },
  {
    key: "minutos",
    label: "Min",
    titulo: "Minutos jugados",
    valor: (s) => s.minutos.toLocaleString("es-ES"),
    detalle: (s) => (s.partidos ? `${minutesPerGame(s)}'/pj` : undefined),
  },
];

const COMUNES_FIN: ColumnaTemporada[] = [
  {
    key: "amarillas",
    label: "TA",
    titulo: "Tarjetas amarillas",
    valor: (s) => String(s.amarillas),
    color: "#FACC15",
    secundaria: true,
  },
  {
    key: "rojas",
    label: "TR",
    titulo: "Tarjetas rojas",
    valor: (s) => String(s.rojas),
    color: "#EF4444",
    secundaria: true,
  },
];

const DE_CAMPO: ColumnaTemporada[] = [
  {
    key: "goles",
    label: "G",
    titulo: "Goles",
    valor: (s) => fmt(s.goles),
    detalle: (s) => ritmo(s.goles, s.minutos),
    color: "#F87171",
  },
  {
    key: "asistencias",
    label: "A",
    titulo: "Asistencias",
    valor: (s) => fmt(s.asistencias),
    detalle: (s) => ritmo(s.asistencias, s.minutos),
    color: "#34D399",
  },
];

const DE_PORTERO: ColumnaTemporada[] = [
  {
    key: "encajados",
    label: "GC",
    titulo: "Goles encajados",
    valor: (s) => fmt(s.encajados),
    detalle: (s) => {
      const porPartido = goalsAgainstPerGame(s);

      return porPartido === null ? undefined : `${porPartido}/pj`;
    },
    color: "#F87171",
  },
  {
    key: "penaltis",
    label: "PP",
    titulo: "Penaltis parados",
    valor: (s) => fmt(s.penaltisParados),
    color: "#34D399",
  },
];

export function columnasTemporada(portero: boolean): ColumnaTemporada[] {
  return [
    ...COMUNES_INICIO,
    ...(portero ? DE_PORTERO : DE_CAMPO),
    ...COMUNES_FIN,
  ];
}

/** Las últimas temporadas: más atrás ya no dice nada de cómo llega al partido. */
export const TEMPORADAS_VISIBLES = 5;
