/**
 * El log de Opta: evento a evento, no un agregado.
 *
 * Wyscout baja **totales por partido** —«74 recuperaciones»— y con eso se
 * compara a un equipo con la liga, pero no se puede contestar a quién las hace,
 * en qué minuto ni después de cuánto tiempo con el balón el rival. Opta baja
 * cada acción con su jugador, su reloj y su secuencia, así que aquí se saca lo
 * que el otro informe no puede dar:
 *
 * - **Quién hace el trabajo defensivo**, acción por acción.
 * - **Cuándo**, por tramos de cuarto de hora: si el equipo se cae al final, se
 *   ve en el reparto, no en el total.
 * - **Cuánto dura la posesión del rival antes del robo.** Es la medida de
 *   presión que ningún total da: robar a los cinco segundos es presión alta;
 *   robar al minuto es replegarse y esperar.
 *
 * La descarga que trae el cuerpo técnico es de **acciones defensivas de un
 * partido** —no hay remates ni pases—, así que eso es lo que se explota y eso
 * es lo que dice la pantalla. Si algún día bajan el log completo, las mismas
 * piezas valen: lo único que cambia es qué tipos de acción aparecen.
 */

export type EventoOpta = {
  tipo: string;
  jugador: string;
  /** Segundos desde el inicio del periodo. */
  reloj: number;
  periodo: number;
  /** Minuto del partido, ya sumando los periodos anteriores. */
  minuto: number;
  /** Segundos que llevaba el balón en juego en esa posesión. */
  segundosPosesion: number | null;
  equipo: string;
  rival: string;
  fecha: string;
  resultado: string;
};

export type PartidoEventos = {
  fecha: string;
  equipo: string;
  rival: string;
  resultado: string;
  eventos: EventoOpta[];
};

/** Cómo se agrupan los tipos de Opta para que la pantalla se lea. */
export const FAMILIAS: { familia: string; tipos: string[]; explica: string }[] = [
  {
    familia: "Robo",
    tipos: ["BallRecovery", "Interception", "Tackle", "BlockedPass"],
    explica: "Balón recuperado: el equipo pasa a tenerlo.",
  },
  {
    familia: "Rechace",
    tipos: ["Clearance", "Sweeper", "Shield"],
    explica: "Balón alejado sin control: se quita el peligro, no se recupera.",
  },
  {
    familia: "Duelo",
    tipos: ["Aerial", "Challenge"],
    explica: "Disputa directa, por arriba o al suelo.",
  },
  {
    familia: "Parada",
    tipos: ["Save"],
    explica: "Intervención del portero.",
  },
  {
    familia: "Fuera de juego",
    tipos: ["OffsideProvoked"],
    explica: "Fuera de juego provocado por la línea.",
  },
];

const FAMILIA_DE = new Map(
  FAMILIAS.flatMap((f) => f.tipos.map((t) => [t, f.familia] as const)),
);

export const familiaDe = (tipo: string) => FAMILIA_DE.get(tipo) ?? "Otras";

/**
 * Lee el `export.json` de Opta.
 *
 * El fichero trae la cabecera aparte y las filas como listas de valores, así
 * que primero se monta el índice de columnas. Ojo: **hay nombres de columna
 * repetidos** (`team`, `teamId` salen dos veces); se usa el primero, que es el
 * del bloque del evento.
 */
export function leeEventosOpta(crudo: unknown): PartidoEventos | null {
  const doc = crudo as {
    header?: { columnId?: string }[];
    rows?: unknown[][];
  };

  if (!Array.isArray(doc?.header) || !Array.isArray(doc?.rows)) return null;

  const indice = new Map<string, number>();

  doc.header.forEach((col, i) => {
    const id = col?.columnId;

    if (id && !indice.has(id)) indice.set(id, i);
  });

  const col = (fila: unknown[], nombre: string) => {
    const i = indice.get(nombre);

    return i === undefined ? null : fila[i];
  };

  const eventos: EventoOpta[] = [];

  for (const fila of doc.rows) {
    const tipo = String(col(fila, "playType") ?? "").trim();

    if (!tipo || tipo === "TOTAL") continue;

    const periodo = Number(col(fila, "period")) || 1;
    const reloj = Number(col(fila, "gameClock")) || 0;

    const posesion = col(fila, "possessionSeconds");

    eventos.push({
      tipo,
      jugador: String(col(fila, "toucher") ?? "").trim(),
      reloj,
      periodo,
      /* `gameClock` ya va acumulado desde el saque inicial: sumarle el periodo
         mandaba la segunda parte al minuto 135 y dejaba media hora vacía. */
      minuto: Math.floor(reloj / 60),
      segundosPosesion:
        posesion === null || posesion === "" ? null : Number(posesion),
      equipo: String(col(fila, "teamFullName") ?? col(fila, "team") ?? "").trim(),
      rival: String(col(fila, "opponent") ?? "").trim(),
      fecha: String(col(fila, "date") ?? "").slice(0, 10),
      resultado: String(col(fila, "result") ?? "").trim(),
    });
  }

  if (eventos.length === 0) return null;

  return {
    fecha: eventos[0].fecha,
    equipo: eventos[0].equipo,
    rival: eventos[0].rival,
    resultado: eventos[0].resultado,
    eventos,
  };
}

/* ------------------------------------------------------------------ */
/*  LO QUE SE SACA DEL LOG                                             */
/* ------------------------------------------------------------------ */

/** Cuántas acciones hace cada jugador, y de qué familia. */
export function porJugador(eventos: EventoOpta[]) {
  const mapa = new Map<string, { jugador: string; total: number; familias: Record<string, number> }>();

  for (const evento of eventos) {
    if (!evento.jugador) continue;

    const fila = mapa.get(evento.jugador) ?? {
      jugador: evento.jugador,
      total: 0,
      familias: {},
    };

    const familia = familiaDe(evento.tipo);

    fila.total += 1;
    fila.familias[familia] = (fila.familias[familia] ?? 0) + 1;

    mapa.set(evento.jugador, fila);
  }

  return [...mapa.values()].sort((a, b) => b.total - a.total);
}

/** El reparto por tramos de cuarto de hora. */
export function porTramo(eventos: EventoOpta[], ancho = 15) {
  const tope = Math.max(...eventos.map((e) => e.minuto), 90);

  const tramos: { etiqueta: string; desde: number; total: number }[] = [];

  for (let desde = 0; desde <= tope; desde += ancho) {
    tramos.push({
      etiqueta: `${desde}–${desde + ancho}′`,
      desde,
      total: eventos.filter((e) => e.minuto >= desde && e.minuto < desde + ancho)
        .length,
    });
  }

  return tramos;
}

/** Cuántas acciones hay de cada familia. */
export function porFamilia(eventos: EventoOpta[]) {
  const cuenta = new Map<string, number>();

  for (const evento of eventos) {
    const familia = familiaDe(evento.tipo);

    cuenta.set(familia, (cuenta.get(familia) ?? 0) + 1);
  }

  return [...cuenta.entries()]
    .map(([familia, total]) => ({ familia, total }))
    .sort((a, b) => b.total - a.total);
}

/**
 * Cuánto aguanta el rival el balón antes de que se lo quiten.
 *
 * Se mira sólo en las acciones que **recuperan** —robo, intercepción,
 * entrada—: un despeje no termina una posesión del rival, la alarga. La
 * mediana dice más que la media porque una posesión larga del rival en su
 * campo desplaza la media entera.
 */
export function tiempoHastaElRobo(eventos: EventoOpta[]) {
  const segundos = eventos
    .filter((e) => familiaDe(e.tipo) === "Robo" && e.segundosPosesion !== null)
    .map((e) => e.segundosPosesion as number)
    .sort((a, b) => a - b);

  if (segundos.length === 0) return null;

  const medio = Math.floor(segundos.length / 2);

  return {
    cuantos: segundos.length,
    mediana:
      segundos.length % 2
        ? segundos[medio]
        : (segundos[medio - 1] + segundos[medio]) / 2,
    media: segundos.reduce((a, b) => a + b, 0) / segundos.length,
    /* Los robos rápidos son los que valen: recuperar en menos de cinco
       segundos es presión tras pérdida, no repliegue. */
    rapidos: segundos.filter((s) => s <= 5).length,
    lentos: segundos.filter((s) => s > 30).length,
  };
}
