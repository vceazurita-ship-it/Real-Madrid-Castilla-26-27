import { normalizePlayerName } from "@/lib/playerImages";
import { FAMILIAS, porJugador, type PartidoEventos } from "./eventos";
import {
  METRICAS_JUGADOR,
  PUESTOS,
  comparablesDe,
  esNuestro,
  metricasDe,
  puestoDe,
  type Ambito,
  type MetricaJugador,
  type Puesto,
} from "./individual";
import { percentil } from "./metricas";
import type { FilaJugador } from "./leer";
import type { AreaKey } from "@/lib/ratings/types";
import type { PlayerSummary } from "@/lib/ratings/compute";

/**
 * EL ONCE, MIRADO POR TRES SITIOS.
 *
 * La misma alineación contada por quien la mide de tres maneras distintas, y
 * el usuario elige con cuál se queda:
 *
 * - **Wyscout**: cincuenta y una métricas por jugador, agrupadas, y el
 *   percentil contra los de su puesto. Es la vista rica.
 * - **Opta**: lo que se puede contar de su registro de eventos —robos,
 *   rechaces, duelos—. **Es una muestra corta a propósito declarada**: el
 *   fichero trae del orden de diez o veinte acciones por jugador en tres
 *   partidos, así que la vista lo dice en vez de disfrazarlo de estadística.
 * - **Nosotros**: la nota del cuerpo técnico por áreas, con la forma de los
 *   últimos partidos y la tendencia. Es la única que juzga, en vez de contar.
 *
 * **No se mezclan.** Cada fuente mide cosas distintas con escalas distintas, y
 * un número medio entre un percentil de Wyscout y un 7,5 nuestro no significa
 * nada. Se enseñan por separado y se compara con los ojos, que es lo que hace
 * el cuerpo técnico de todas formas.
 */

export type FuenteOnce = "wyscout" | "opta" | "nuestra";

export const FUENTES: {
  key: FuenteOnce;
  label: string;
  /** Qué contesta esta vista, en una línea. */
  pregunta: string;
}[] = [
  {
    key: "wyscout",
    label: "Wyscout",
    pregunta: "Qué hace cada uno con el balón y sin él, contra los de su puesto",
  },
  {
    key: "opta",
    label: "Opta",
    pregunta: "Las acciones defensivas que registra su log, acción por acción",
  },
  {
    key: "nuestra",
    label: "Nuestra valoración",
    pregunta: "La nota del cuerpo técnico por áreas, con su forma y su tendencia",
  },
];

/* ------------------------------------------------------------------ */
/*  LAS LÍNEAS DEL ONCE                                                */
/* ------------------------------------------------------------------ */

/**
 * Las cuatro columnas del informe, como en la pizarra: el once entero y sus
 * tres líneas. El portero entra en el once pero no hace línea propia: con un
 * solo jugador, una «media de la línea» es su nota, y ya sale en su ficha.
 */
export type LineaOnce = "once" | "defensas" | "medios" | "puntas";

export const LINEAS: { key: LineaOnce; label: string; puestos: Puesto[] }[] = [
  { key: "once", label: "Once", puestos: ["POR", "CEN", "LAT", "MED", "BAN", "DEL"] },
  { key: "defensas", label: "Defensas", puestos: ["CEN", "LAT"] },
  { key: "medios", label: "Medios", puestos: ["MED"] },
  { key: "puntas", label: "Puntas", puestos: ["BAN", "DEL"] },
];

export const lineaDe = (puesto: Puesto): LineaOnce =>
  puesto === "CEN" || puesto === "LAT"
    ? "defensas"
    : puesto === "MED"
      ? "medios"
      : puesto === "BAN" || puesto === "DEL"
        ? "puntas"
        : "once";

/* ------------------------------------------------------------------ */
/*  UNA FILA DE LA REJILLA                                             */
/* ------------------------------------------------------------------ */

/**
 * Un ítem de la rejilla: una fila con su valor por columna.
 *
 * `valor` es lo que se escribe y `fuerza` (0..1) lo que se pinta: así una
 * barra de percentil y una nota de 0 a 10 se dibujan con la misma regla sin
 * que haya que saber de dónde viene cada una.
 */
export type CeldaOnce = {
  /** Lo que se escribe: «7,5», «p78», «11». `null` si no se sabe. */
  texto: string | null;
  /** 0..1 para la barra. `null` no pinta barra. */
  fuerza: number | null;
  /** Si un valor alto es bueno, malo, o ninguna de las dos. */
  sentido: boolean | null;
};

export type FilaOnce = {
  clave: string;
  etiqueta: string;
  grupo: string;
  /** Cómo se lee, para el `title` de la fila. */
  comoLeer: string;
  /** Por línea: `once`, `defensas`, `medios`, `puntas`. */
  celdas: Record<LineaOnce, CeldaOnce>;
};

export type BloqueOnce = {
  grupo: string;
  filas: FilaOnce[];
};

export type RejillaOnce = {
  fuente: FuenteOnce;
  bloques: BloqueOnce[];
  /** Lo que hay que saber antes de leerla. Vacío si no hay nada que avisar. */
  avisos: string[];
};

const VACIA: CeldaOnce = { texto: null, fuerza: null, sentido: null };

const celdas = (): Record<LineaOnce, CeldaOnce> => ({
  once: VACIA,
  defensas: VACIA,
  medios: VACIA,
  puntas: VACIA,
});

/** La media de unos números, o `null` si no hay ninguno. */
function media(valores: number[]) {
  const buenos = valores.filter((v) => Number.isFinite(v));

  return buenos.length
    ? buenos.reduce((t, v) => t + v, 0) / buenos.length
    : null;
}

/* ------------------------------------------------------------------ */
/*  QUIÉN JUEGA                                                        */
/* ------------------------------------------------------------------ */

/** Un jugador del once, ya resuelto contra las tres fuentes. */
export type JugadorOnce = {
  /** El id de la plantilla, que es con el que se guarda el once. */
  id: string;
  nombre: string;
  puesto: Puesto;
  linea: LineaOnce;
  /** Su fila de Wyscout, si la hay. */
  wyscout: FilaJugador | null;
  /** Su resumen de valoraciones, si lo hay. */
  nuestra: PlayerSummary | null;
  /** Sus acciones en el log de Opta. */
  opta: { total: number; familias: Record<string, number> } | null;
};

/**
 * Cruza un nombre de plantilla con el de otra fuente.
 *
 * Wyscout escribe «Oscar Naasei», Opta abrevia a «O. Naasei» y la hoja dice
 * «Óscar Naasei»: por eso se compara sin acentos y, si no hay coincidencia
 * exacta, por el **apellido**, que es lo único que las tres respetan. Ver
 * [[ids-jugador-renumerados]]: por id no se puede, cada fuente tiene el suyo.
 */
export function casaNombre<T>(
  nombre: string,
  candidatos: T[],
  nombreDe: (uno: T) => string,
): T | null {
  const limpio = normalizePlayerName(nombre);

  const exacto = candidatos.find((uno) => normalizePlayerName(nombreDe(uno)) === limpio);

  if (exacto) return exacto;

  /* Por apellido: el trozo más largo, que es el que nadie abrevia. */
  const trozos = limpio.split(" ").filter((t) => t.length > 2);

  const apellido = trozos[trozos.length - 1];

  if (!apellido) return null;

  const porApellido = candidatos.filter((uno) => {
    const suyos = normalizePlayerName(nombreDe(uno)).split(" ");

    return suyos.includes(apellido);
  });

  /* Sólo si no hay duda: dos «Martínez» no se resuelven solos. */
  return porApellido.length === 1 ? porApellido[0] : null;
}

/* ------------------------------------------------------------------ */
/*  LAS TRES REJILLAS                                                  */
/* ------------------------------------------------------------------ */

/**
 * Wyscout: el percentil de cada métrica, por línea.
 *
 * La barra es el percentil **contra los de su puesto** y no el valor en bruto,
 * porque un lateral y un delantero no se comparan en pases al último tercio.
 * El número que se escribe sí es el valor, que es lo que se mira.
 */
export function rejillaWyscout(
  once: JugadorOnce[],
  jugadores: FilaJugador[],
  ambito: Ambito = "liga",
): RejillaOnce {
  const conDato = once.filter((uno) => uno.wyscout);

  const avisos: string[] = [];

  const sinDato = once.filter((uno) => !uno.wyscout);

  if (sinDato.length > 0) {
    avisos.push(
      `Sin datos de Wyscout: ${sinDato.map((uno) => uno.nombre).join(", ")}.`,
    );
  }

  /* El percentil de un jugador en una métrica, contra los de su puesto. */
  const percentilDe = (uno: JugadorOnce, metrica: MetricaJugador) => {
    if (!uno.wyscout) return null;

    const valor = uno.wyscout.datos[metrica.columna];

    if (valor === undefined) return null;

    const { lista } = comparablesDe(jugadores, uno.puesto, ambito);

    const suyos = lista
      .map((j) => j.datos[metrica.columna])
      .filter((v): v is number => v !== undefined);

    if (suyos.length < 3) return null;

    const pct = percentil(valor, suyos, metrica.mejorAlto);

    /* `percentil` devuelve null si no hay con quién comparar: entonces el
       valor se sabe pero el puesto no, y una barra sin percentil mentiría. */
    return pct === null ? null : { valor, pct };
  };

  const grupos = [...new Set(METRICAS_JUGADOR.map((m) => m.grupo))];

  const bloques = grupos.map((grupo) => {
    const filas = METRICAS_JUGADOR.filter((m) => m.grupo === grupo).map((metrica) => {
      const fila: FilaOnce = {
        clave: metrica.columna,
        etiqueta: metrica.nombre,
        grupo,
        comoLeer: metrica.comoLeer,
        celdas: celdas(),
      };

      for (const { key, puestos } of LINEAS) {
        /* Sólo los de esa línea a los que la métrica les dice algo. */
        const suyos = conDato.filter(
          (uno) =>
            puestos.includes(uno.puesto) &&
            (!metrica.puestos || metrica.puestos.includes(uno.puesto)),
        );

        const medidos = suyos
          .map((uno) => percentilDe(uno, metrica))
          .filter((m): m is { valor: number; pct: number } => m !== null);

        if (medidos.length === 0) continue;

        const pct = media(medidos.map((m) => m.pct));
        const valor = media(medidos.map((m) => m.valor));

        fila.celdas[key] = {
          texto: valor === null ? null : formatea(valor, metrica),
          fuerza: pct === null ? null : pct / 100,
          sentido: metrica.mejorAlto,
        };
      }

      return fila;
    });

    /* Un grupo en el que ninguna línea tiene dato no se enseña vacío. */
    return {
      grupo,
      filas: filas.filter((f) => Object.values(f.celdas).some((c) => c.texto !== null)),
    };
  });

  return {
    fuente: "wyscout",
    bloques: bloques.filter((b) => b.filas.length > 0),
    avisos,
  };
}

function formatea(valor: number, metrica: MetricaJugador) {
  if (metrica.unidad === "porcentaje") return `${Math.round(valor)} %`;

  if (metrica.unidad === "entero") return String(Math.round(valor));

  return valor.toFixed(2).replace(".", ",");
}

/**
 * Opta: las acciones de su registro de eventos, por familia.
 *
 * **Esto no es una estadística, es un recuento**, y la rejilla lo dice: el log
 * trae del orden de diez o veinte acciones por jugador en los partidos que
 * haya, casi todas defensivas —robos, rechaces, duelos—, porque es lo que ese
 * fichero registra. Sirve para ver quién aparece y quién no, no para decir
 * quién defiende mejor.
 */
export function rejillaOpta(
  once: JugadorOnce[],
  partidos: number,
  /**
   * Cuántas acciones hay en el log EN TOTAL, con dueño y sin él.
   *
   * Hace falta para poder decir qué parte se está enseñando: sin esto, un
   * «Robo: 64» parece el total del equipo y son 83 de 186, porque más de la
   * mitad de los robos llegan sin nombre.
   */
  enElLog?: { con: number; sin: number },
): RejillaOnce {
  const conDato = once.filter((uno) => uno.opta && uno.opta.total > 0);

  const total = conDato.reduce((t, uno) => t + (uno.opta?.total ?? 0), 0);

  const avisos: string[] = [
    partidos > 0
      ? `Muestra corta: ${total} acciones en ${partidos} partido${partidos === 1 ? "" : "s"}, ${
          conDato.length ? Math.round(total / conDato.length) : 0
        } por jugador de media. Son recuentos, no promedios: con estos números nadie es mejor que nadie por una acción de diferencia.`
      : "No hay ningún partido con registro de eventos de Opta.",
    "El log de Opta sólo guarda acciones defensivas. Lo que hace un jugador con el balón no está aquí, está en Wyscout.",
  ];

  /*
  | Y cuántas de las acciones del log llevan nombre.
  |
  | No es un detalle: de los 186 robos de estos tres partidos, 103 llegan sin
  | jugador —`BallRecovery` nunca lo trae—. Lo que se reparte aquí es la parte
  | que sí tiene dueño, y quien lo lea tiene que saberlo antes de sumar.
  */
  if (enElLog && enElLog.sin > 0) {
    const todas = enElLog.con + enElLog.sin;

    avisos.push(
      `De las ${todas} acciones del log, ${enElLog.sin} llegan sin nombre y no se pueden repartir: aquí se enseñan las ${enElLog.con} que sí lo traen.`,
    );
  }

  /*
  | Las familias que NO se pueden repartir por jugador se quedan fuera.
  |
  | Los duelos (`Aerial`, `Challenge`) llegan sin `toucher` en el log: el
  | fichero registra que hubo duelo, no quién lo disputó. Pintar una fila
  | «Duelo: 0» en las cuatro columnas diría que nadie disputó ninguno, que es
  | falso —en estos tres partidos hubo 75—. Se avisa y no se pinta.
  */
  const conDueno = FAMILIAS.filter((familia) =>
    conDato.some((uno) => (uno.opta?.familias[familia.familia] ?? 0) > 0),
  );

  const sinDueno = FAMILIAS.filter((una) => !conDueno.includes(una));

  if (sinDueno.length > 0) {
    avisos.push(
      `No se reparten por jugador ${sinDueno
        .map((una) => una.familia.toLowerCase())
        .join(" ni ")}: el log registra la acción pero no de quién fue, así que no se enseñan en vez de dar ceros que no son ceros.`,
    );
  }

  const filas: FilaOnce[] = conDueno.map((familia) => {
    const fila: FilaOnce = {
      clave: familia.familia,
      etiqueta: familia.familia,
      grupo: "Acciones registradas",
      comoLeer: familia.explica,
      celdas: celdas(),
    };

    /* El tope manda la barra: es un recuento, no hay percentil que valga. */
    const tope = Math.max(
      1,
      ...LINEAS.map(({ puestos }) =>
        conDato
          .filter((uno) => puestos.includes(uno.puesto))
          .reduce((t, uno) => t + (uno.opta?.familias[familia.familia] ?? 0), 0),
      ),
    );

    for (const { key, puestos } of LINEAS) {
      const suyos = conDato.filter((uno) => puestos.includes(uno.puesto));

      if (suyos.length === 0) continue;

      const suma = suyos.reduce(
        (t, uno) => t + (uno.opta?.familias[familia.familia] ?? 0),
        0,
      );

      fila.celdas[key] = {
        texto: String(suma),
        fuerza: suma / tope,
        /* Más robos es mejor; más rechaces no dice nada por sí solo. */
        sentido: familia.familia === "Robo" ? true : null,
      };
    }

    return fila;
  });

  return {
    fuente: "opta",
    bloques: [{ grupo: "Acciones registradas", filas }],
    avisos,
  };
}

/** Las cuatro áreas que puntúa el cuerpo técnico, más la nota global. */
const AREAS_NUESTRAS: { clave: AreaKey | "global" | "form"; etiqueta: string; comoLeer: string }[] = [
  {
    clave: "global",
    etiqueta: "Nota",
    comoLeer: "La nota del partido, de 0 a 10. Es la media de las que se le han puesto.",
  },
  { clave: "tecnica", etiqueta: "Técnica", comoLeer: "Lo que hace con el balón." },
  { clave: "tactica", etiqueta: "Táctica", comoLeer: "Dónde se coloca y qué decide." },
  { clave: "fisica", etiqueta: "Física", comoLeer: "Lo que aguanta y lo que repite." },
  { clave: "mental", etiqueta: "Mental", comoLeer: "Cómo compite cuando viene mal dada." },
  {
    clave: "form",
    etiqueta: "Forma (5 últimos)",
    comoLeer: "La media de sus cinco últimos partidos valorados: dice el momento, no el curso.",
  },
];

/**
 * Nuestra valoración: la nota por áreas, de 0 a 10.
 *
 * Es la única de las tres que **juzga** en vez de contar, y por eso es la que
 * el cuerpo técnico suele mirar primero. La barra es la nota sobre diez, sin
 * percentiles: un 7 es un 7 aunque toda la plantilla ande por ahí.
 */
export function rejillaNuestra(once: JugadorOnce[]): RejillaOnce {
  const conNota = once.filter((uno) => uno.nuestra && uno.nuestra.played > 0);

  const avisos: string[] = [];

  const sinNota = once.filter((uno) => !uno.nuestra || uno.nuestra.played === 0);

  if (sinNota.length > 0) {
    avisos.push(
      `Todavía sin valorar: ${sinNota.map((uno) => uno.nombre).join(", ")}.`,
    );
  }

  const filas = AREAS_NUESTRAS.map((area) => {
    const fila: FilaOnce = {
      clave: String(area.clave),
      etiqueta: area.etiqueta,
      grupo: "Valoración del cuerpo técnico",
      comoLeer: area.comoLeer,
      celdas: celdas(),
    };

    const notaDe = (uno: JugadorOnce) => {
      const suyo = uno.nuestra;

      if (!suyo) return null;

      if (area.clave === "global") return suyo.avg || null;
      if (area.clave === "form") return suyo.form || null;

      return suyo.areas[area.clave as AreaKey] || null;
    };

    for (const { key, puestos } of LINEAS) {
      const suyos = conNota.filter((uno) => puestos.includes(uno.puesto));

      const notas = suyos
        .map(notaDe)
        .filter((n): n is number => n !== null && n > 0);

      if (notas.length === 0) continue;

      const nota = media(notas)!;

      fila.celdas[key] = {
        texto: nota.toFixed(1).replace(".", ","),
        fuerza: Math.min(1, nota / 10),
        sentido: true,
      };
    }

    return fila;
  });

  return {
    fuente: "nuestra",
    bloques: [{ grupo: "Valoración del cuerpo técnico", filas }],
    avisos,
  };
}

/* ------------------------------------------------------------------ */
/*  ARMAR EL ONCE                                                      */
/* ------------------------------------------------------------------ */

/**
 * Resuelve un once contra las tres fuentes.
 *
 * Los ids son los de la plantilla; el resto se cruza **por nombre**, que es lo
 * único que comparten las tres (ver `casaNombre`).
 */
export function armaOnce(
  elegidos: { id: string; nombre: string; posicion: string }[],
  jugadores: FilaJugador[],
  resumenes: PlayerSummary[],
  eventos: PartidoEventos[],
): JugadorOnce[] {
  const nuestrosWys = jugadores.filter(
    (j) => esNuestro(j) && j.temporada === "actual",
  );

  const deOpta = porJugador(eventos.flatMap((p) => p.eventos));

  return elegidos.map((uno) => {
    const puesto = puestoDe(uno.posicion);

    const wyscout = casaNombre(uno.nombre, nuestrosWys, (j) => j.jugador);

    const opta = casaNombre(uno.nombre, deOpta, (j) => j.jugador);

    const nuestra =
      resumenes.find((r) => r.playerId === uno.id) ?? null;

    return {
      id: uno.id,
      nombre: uno.nombre,
      puesto,
      linea: lineaDe(puesto),
      wyscout,
      nuestra,
      opta: opta ? { total: opta.total, familias: opta.familias } : null,
    };
  });
}

/** La rejilla que toca, según la fuente elegida. */
export function rejillaDe(
  fuente: FuenteOnce,
  once: JugadorOnce[],
  jugadores: FilaJugador[],
  eventos: PartidoEventos[],
  ambito: Ambito = "liga",
): RejillaOnce {
  if (fuente === "opta") {
    const todos = eventos.flatMap((p) => p.eventos);

    return rejillaOpta(once, eventos.length, {
      con: todos.filter((e) => e.jugador).length,
      sin: todos.filter((e) => !e.jugador).length,
    });
  }

  if (fuente === "nuestra") return rejillaNuestra(once);

  return rejillaWyscout(once, jugadores, ambito);
}

/** Los puestos, por si la pantalla quiere ofrecerlos en orden. */
export { PUESTOS, metricasDe };
