import { normalizePlayerName } from "@/lib/playerImages";
import { FAMILIAS, porJugador, type PartidoEventos } from "./eventos";
import {
  METRICAS_JUGADOR,
  PUESTOS,
  comparablesDe,
  esNuestro,
  metricasDe,
  puestoDe,
  volumenDelPorcentaje,
  type Ambito,
  type MetricaJugador,
  type Puesto,
} from "./individual";
import { percentil } from "./metricas";
import type { FilaJugador, FilaPartido } from "./leer";
import type { AreaKey } from "@/lib/ratings/types";
import type { PlayerSummary } from "@/lib/ratings/compute";

/**
 * EL ONCE, MIRADO POR TRES SITIOS.
 *
 * La misma alineación contada por quien la mide de tres maneras distintas, y
 * el usuario elige con cuál se queda:
 *
 * - **Wyscout**: setenta y ocho métricas por jugador, agrupadas, y el percentil
 *   contra los de su puesto. Es la vista rica.
 * - **Opta**: lo que se puede contar de su registro de eventos —robos,
 *   rechaces, duelos—. **Es una muestra corta a propósito declarada**: el
 *   fichero trae del orden de diez o veinte acciones por jugador en tres
 *   partidos, así que la vista lo dice en vez de disfrazarlo de estadística.
 * - **Nosotros**: la nota del cuerpo técnico y la forma de los últimos
 *   partidos. Es la única que juzga, en vez de contar.
 *
 * **No se mezclan.** Cada fuente mide cosas distintas con escalas distintas, y
 * un número medio entre un percentil de Wyscout y un 7,5 nuestro no significa
 * nada. Se enseñan por separado y se compara con los ojos, que es lo que hace
 * el cuerpo técnico de todas formas.
 *
 * **Y se puede mirar por líneas o jugador a jugador** (17/09/2026). Era la
 * carencia gorda: la rejilla sólo daba la media de la línea, así que el dato
 * individual de Wyscout —que es el que hay— quedaba escondido detrás de un
 * promedio de cuatro. Las columnas son ahora una lista, y cada vista decide
 * cuáles son; el cálculo de cada casilla es el mismo.
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
    pregunta: "La nota del cuerpo técnico y su forma en los últimos partidos",
  },
];

/** Cómo se reparten las columnas de la rejilla. */
export type VistaOnce = "lineas" | "jugadores";

export const VISTAS: { key: VistaOnce; label: string; explica: string }[] = [
  {
    key: "lineas",
    label: "Por líneas",
    explica: "El once y sus tres líneas, con la media de cada una.",
  },
  {
    /*
    | «Uno a uno» y no «jugador a jugador»: así se llama ya el área individual
    | de DATA, y dos botones con el mismo rótulo en la misma pantalla —uno que
    | cambia de área y otro que cambia de columnas— es un tropiezo seguro.
    */
    key: "jugadores",
    label: "Uno a uno",
    explica: "Una columna por futbolista: el dato de cada uno, sin promediar con nadie.",
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
/*  EL LADO                                                            */
/* ------------------------------------------------------------------ */

/**
 * Por qué lado juega. `C` es el centro, o «da igual».
 *
 * **Esto faltaba y era el fallo que se veía desde fuera**: el once tiene un
 * hueco para el lateral derecho y otro para el izquierdo, pero el puesto sólo
 * decía «LAT», así que los dos huecos se rellenaban por minutos jugados y
 * Diego Aguado —lateral izquierdo— salía de lateral derecho y Jesús Fortea al
 * revés. Con el lado, cada uno cae en su sitio y quien mire la rejilla puede
 * fiarse de los rótulos.
 */
export type Lado = "D" | "I" | "C";

/**
 * El lado que dice Wyscout en su «Posición específica».
 *
 * Las siglas llevan el lado delante: `LB` lateral izquierdo, `RB` derecho,
 * `RCB` central derecho, `LAMF` mediapunta por la izquierda. Manda la primera
 * de la lista, que es donde más ha jugado. Es **dato medido**, no una etiqueta
 * de plantilla: dice dónde ha jugado de verdad esta temporada.
 */
export function ladoDeWyscout(posicion: string): Lado {
  const primera = (posicion || "").split(",")[0].trim().toUpperCase();

  /* `L`/`R` sólo son lado cuando delante van de una sigla de puesto. */
  if (/^L[A-Z]/.test(primera)) return "I";

  if (/^R[A-Z]/.test(primera)) return "D";

  return "C";
}

/**
 * El lado que dice la hoja de plantilla.
 *
 * `LATERAL D.` y `LATERAL I.` lo escriben con todas las letras, y los números
 * de rol también lo llevan: el 7 es el extremo derecho y el 11 el izquierdo,
 * el 2 lateral derecho y el 3 izquierdo. Lo demás es centro.
 */
export function ladoDeLaHoja(posicion: string): Lado {
  const p = (posicion || "")
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .trim()
    .toUpperCase();

  if (p === "2" || /\bD\.?$/.test(p) || p.includes("DERECH")) return "D";

  if (p === "3" || /\bI\.?$/.test(p) || p.includes("IZQUIERD")) return "I";

  if (p === "7") return "D";

  if (p === "11") return "I";

  return "C";
}

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
  /** Lo que se cuenta al pasar por encima: el percentil, quién entra en la media… */
  detalle?: string;
};

/** Una columna de la rejilla: una línea entera o un solo jugador. */
export type ColumnaOnce = {
  key: string;
  label: string;
  /** La segunda línea del encabezado: el puesto, los minutos… */
  sub?: string;
  /** La del once va destacada, que es la que se lee primero. */
  destacada?: boolean;
};

export type FilaOnce = {
  clave: string;
  etiqueta: string;
  grupo: string;
  /** Cómo se lee, para el `title` de la fila. */
  comoLeer: string;
  /** Por columna, en el orden de `columnas`. */
  celdas: Record<string, CeldaOnce>;
};

export type BloqueOnce = {
  grupo: string;
  filas: FilaOnce[];
};

export type RejillaOnce = {
  fuente: FuenteOnce;
  columnas: ColumnaOnce[];
  bloques: BloqueOnce[];
  /** Lo que hay que saber antes de leerla. Vacío si no hay nada que avisar. */
  avisos: string[];
};

const VACIA: CeldaOnce = { texto: null, fuerza: null, sentido: null };

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

/**
 * El puesto de un jugador **de la hoja de plantilla**.
 *
 * No vale `puestoDe`: ésa lee las siglas de Wyscout (`GK`, `LCB`, `RB`) y la
 * columna `POSICION` de la hoja escribe **el número de rol** —1 portero, 6
 * pivote, 8 interior, 10 mediapunta, 7 y 11 extremos, 9 delantero— o el nombre
 * en castellano. Pasándole un «4» devuelve «MED», y con eso el once salía casi
 * entero sin elegir y el desplegable del portero ofrecía a los diecinueve.
 *
 * El criterio es el mismo de `detectRow` (`lib/ratings/pitch.ts`), que es el
 * que ya colocan el campograma, la pizarra y las valoraciones: si algún día
 * cambia el idioma de la hoja, cambia en los dos sitios o las pantallas
 * discrepan.
 */
export function puestoDeLaHoja(posicion: string): Puesto {
  const p = (posicion || "")
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .trim()
    .toUpperCase();

  if (p.startsWith("PORTERO") || p === "1") return "POR";

  if (p.startsWith("LATERAL") || p === "2" || p === "3") return "LAT";

  if (p.startsWith("CENTRAL") || p.startsWith("DEFENSA") || p === "4" || p === "5") {
    return "CEN";
  }

  if (p === "9" || p.startsWith("DELANTERO")) return "DEL";

  if (p === "7" || p === "11" || p.startsWith("EXTREMO")) return "BAN";

  if (p === "10" || p.startsWith("MEDIAPUNTA")) return "BAN";

  /* 6 pivote y 8 interior, y lo que no se reconozca: medio. */
  return "MED";
}

/**
 * Dónde juega uno, cruzando las dos fuentes que lo dicen.
 *
 * **Manda Wyscout cuando tiene fila suya**, porque es dónde ha jugado de
 * verdad esta temporada; la hoja es la etiqueta del club, que va por detrás de
 * los cambios —un central al que se ha pasado a lateral sigue de central en la
 * hoja hasta que alguien la toque—. Si no hay fila de Wyscout, manda la hoja,
 * que siempre está.
 *
 * Se devuelven las dos para poder **decirlo en pantalla cuando no coinciden**:
 * callarlo sería cambiarle el puesto a alguien sin avisar.
 */
export type SitioJugador = {
  puesto: Puesto;
  lado: Lado;
  /** De dónde ha salido lo anterior. */
  segun: "wyscout" | "hoja";
  /** Lo que dice Wyscout, tal cual («LB», «RCB, RB»). Vacío si no tiene fila. */
  wyscout: string;
  /** Lo que dice la hoja, tal cual («LATERAL I.», «11»). */
  hoja: string;
};

export function sitioDe(
  posicionHoja: string,
  posicionWyscout: string | null,
): SitioJugador {
  const hoja = (posicionHoja || "").trim();

  const wyscout = (posicionWyscout || "").trim();

  if (wyscout) {
    return {
      puesto: puestoDe(wyscout),
      lado: ladoDeWyscout(wyscout),
      segun: "wyscout",
      wyscout,
      hoja,
    };
  }

  return {
    puesto: puestoDeLaHoja(hoja),
    lado: ladoDeLaHoja(hoja),
    segun: "hoja",
    wyscout: "",
    hoja,
  };
}

/* ------------------------------------------------------------------ */
/*  LOS ONCE HUECOS                                                    */
/* ------------------------------------------------------------------ */

export type Hueco = {
  clave: string;
  rotulo: string;
  puesto: Puesto;
  lado: Lado;
};

/**
 * Los once puestos de la pizarra, **en 4-2-3-1**, que es como juega el equipo.
 *
 * Dos cosas que costaron un fallo cada una:
 *
 * - **Cada hueco lleva su lado** (17/09/2026). Sin eso, «lateral derecho» y
 *   «lateral izquierdo» eran el mismo hueco dos veces y se rellenaban por
 *   minutos jugados: Diego Aguado —lateral izquierdo— salía de derecho y Jesús
 *   Fortea de izquierdo.
 * - **Los huecos son los del sistema, no tres medios en fila** (18/09/2026).
 *   Había «medio derecho, medio centro y medio izquierdo», que es un 4-3-3 y no
 *   lo que juega el Castilla: son **dos pivotes** y, por delante, banda,
 *   **mediapunta** y banda. La mediapunta es `BAN` en el modelo porque Wyscout
 *   escribe `AMF` y ése es el grupo con el que se compara —«bandas y
 *   mediapuntas»—, y va sin lado para que la ocupe quien juega por dentro.
 */
export const HUECOS: Hueco[] = [
  { clave: "por", rotulo: "Portero", puesto: "POR", lado: "C" },
  { clave: "lat-d", rotulo: "Lateral derecho", puesto: "LAT", lado: "D" },
  { clave: "cen-d", rotulo: "Central derecho", puesto: "CEN", lado: "D" },
  { clave: "cen-i", rotulo: "Central izquierdo", puesto: "CEN", lado: "I" },
  { clave: "lat-i", rotulo: "Lateral izquierdo", puesto: "LAT", lado: "I" },
  { clave: "piv-d", rotulo: "Pivote derecho", puesto: "MED", lado: "D" },
  { clave: "piv-i", rotulo: "Pivote izquierdo", puesto: "MED", lado: "I" },
  { clave: "ban-d", rotulo: "Banda derecha", puesto: "BAN", lado: "D" },
  { clave: "media", rotulo: "Mediapunta", puesto: "BAN", lado: "C" },
  { clave: "ban-i", rotulo: "Banda izquierda", puesto: "BAN", lado: "I" },
  { clave: "del", rotulo: "Delantero", puesto: "DEL", lado: "C" },
];

/** Si un jugador sirve para un hueco por lado: el centro vale para los dos. */
export const vaAlLado = (hueco: Hueco, lado: Lado) =>
  hueco.lado === "C" || lado === "C" || lado === hueco.lado;

export type Candidato = {
  id: string;
  sitio: SitioJugador;
  /** Los que lleva jugados esta temporada, que es el criterio de titular. */
  minutos: number;
};

/**
 * El once que se propone solo.
 *
 * **En tres pasadas, y el orden importa**: primero quien es de ese puesto **y
 * de ese lado**, luego quien es del puesto, y al final se rellena con quien
 * quede. Hueco a hueco en una sola pasada, el lateral derecho —que va antes en
 * la lista— se llevaba al lateral izquierdo si tenía más minutos, y de ahí
 * salía el once con los dos lados cambiados.
 *
 * La tercera pasada existe porque pasa de verdad: la plantilla tiene cuatro
 * medios contando a uno que ya no está, así que al tercer medio no le queda
 * candidato de su puesto. Un desplegable vacío no dice nada y deja la rejilla
 * coja; puesto alguien, se ve el once entero y se cambia a mano en un toque.
 */
export function proponeOnce(
  candidatos: Candidato[],
  aMano: Record<string, string> = {},
): Record<string, string> {
  const puestos: Record<string, string> = {};

  const usados = new Set<string>();

  for (const hueco of HUECOS) {
    const elegido = aMano[hueco.clave];

    if (elegido && candidatos.some((uno) => uno.id === elegido)) {
      puestos[hueco.clave] = elegido;
      usados.add(elegido);
    }
  }

  const rellena = (vale: (hueco: Hueco, uno: Candidato) => boolean) => {
    for (const hueco of HUECOS) {
      if (puestos[hueco.clave]) continue;

      const candidato = candidatos
        .filter((uno) => !usados.has(uno.id) && vale(hueco, uno))
        .sort((a, b) => b.minutos - a.minutos)[0];

      if (candidato) {
        puestos[hueco.clave] = candidato.id;
        usados.add(candidato.id);
      }
    }
  };

  /*
  | 1. Su puesto y **exactamente** su lado.
  |
  | Primero el lado exacto y sólo después los de centro, que valen para
  | cualquiera de los dos: si no, un mediapunta (`AMF`, sin lado) con más
  | minutos se quedaba la banda derecha y dejaba fuera a un extremo derecho
  | puro (`RAMF`). Quien no tiene lado se coloca mejor en el hueco que sobre.
  */
  rellena(
    (hueco, uno) => uno.sitio.puesto === hueco.puesto && uno.sitio.lado === hueco.lado,
  );

  /* 2. Su puesto, y un lado que no estorbe: el centro vale para los dos. */
  rellena(
    (hueco, uno) => uno.sitio.puesto === hueco.puesto && vaAlLado(hueco, uno.sitio.lado),
  );

  /* 3. Su puesto, aunque sea del otro lado. */
  rellena((hueco, uno) => uno.sitio.puesto === hueco.puesto);

  /* 4. Quien quede. */
  rellena(() => true);

  return puestos;
}

/** Un jugador del once, ya resuelto contra las tres fuentes. */
export type JugadorOnce = {
  /** El id de la plantilla, que es con el que se guarda el once. */
  id: string;
  nombre: string;
  /** El hueco del que sale: `lat-i`, `med-c`… */
  hueco?: string;
  puesto: Puesto;
  lado: Lado;
  linea: LineaOnce;
  /** De dónde sale el puesto y qué dice cada fuente. */
  sitio: SitioJugador;
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
/*  LAS COLUMNAS                                                       */
/* ------------------------------------------------------------------ */

/** Una columna con los jugadores que entran en ella. */
type Grupo = { columna: ColumnaOnce; jugadores: JugadorOnce[] };

/** "Álvaro Leiva" → "Á. Leiva", que es lo que cabe en una columna. */
function corto(nombre: string) {
  const trozos = nombre.trim().split(/\s+/);

  if (trozos.length < 2) return nombre;

  return `${trozos[0][0]}. ${trozos.slice(1).join(" ")}`;
}

const ROTULO_LADO: Record<Lado, string> = { D: "der.", I: "izq.", C: "" };

/** Las columnas de una vista, con quién va en cada una. */
export function gruposDe(once: JugadorOnce[], vista: VistaOnce): Grupo[] {
  if (vista === "jugadores") {
    return once.map((uno) => ({
      columna: {
        key: uno.id,
        label: corto(uno.nombre),
        sub: [uno.puesto, ROTULO_LADO[uno.lado]].filter(Boolean).join(" "),
      },
      jugadores: [uno],
    }));
  }

  return LINEAS.map((linea) => ({
    columna: {
      key: linea.key,
      label: linea.label,
      destacada: linea.key === "once",
    },
    jugadores: once.filter((uno) => linea.puestos.includes(uno.puesto)),
  }));
}

/* ------------------------------------------------------------------ */
/*  LAS REJILLAS                                                       */
/* ------------------------------------------------------------------ */

/** Lo medido de un jugador en una métrica: sin percentil si la muestra es corta. */
type Medido = { valor: number; pct: number | null; flojo?: string };

/**
 * Wyscout: el percentil de cada métrica, por columna.
 *
 * La barra es el percentil **contra los de su puesto** y no el valor en bruto,
 * porque un lateral y un delantero no se comparan en pases al último tercio.
 * El número que se escribe sí es el valor, que es lo que se mira.
 */
export function rejillaWyscout(
  once: JugadorOnce[],
  jugadores: FilaJugador[],
  ambito: Ambito = "liga",
  vista: VistaOnce = "lineas",
  /** Los partidos del Castilla, para poder cruzar el equipo con el jugador. */
  nuestros: FilaPartido[] = [],
): RejillaOnce {
  const grupos = gruposDe(once, vista);

  const avisos: string[] = [];

  const sinDato = once.filter((uno) => !uno.wyscout);

  if (sinDato.length > 0) {
    avisos.push(
      `Sin datos de Wyscout: ${sinDato.map((uno) => uno.nombre).join(", ")}.`,
    );
  }

  /* El percentil de un jugador en una métrica, contra los de su puesto. */
  const percentilDe = (
    uno: JugadorOnce,
    metrica: MetricaJugador,
  ): Medido | null => {
    if (!uno.wyscout) return null;

    const valor = uno.wyscout.datos[metrica.columna];

    if (valor === undefined) return null;

    /*
    | Un porcentaje sacado de una acción no lleva barra.
    |
    | «Acierto de centro: 100 %» de un central que puso un centro es verdad y
    | no significa nada, y pintado en el percentil 97 se lee como una virtud.
    | Se enseña la cifra —esconderla sería peor— y se dice de cuántas acciones
    | sale, pero sin percentil.
    */
    const volumen = volumenDelPorcentaje(uno.wyscout, metrica.columna);

    if (!volumen.fiable) {
      return {
        valor,
        pct: null,
        flojo: `De ${formateaNumero(volumen.cuantas ?? 0)} por 90′: muy pocas para un porcentaje`,
      };
    }

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

  const nombresGrupo = [...new Set(METRICAS_JUGADOR.map((m) => m.grupo))];

  const bloques = nombresGrupo.map((grupo) => {
    const filas = METRICAS_JUGADOR.filter((m) => m.grupo === grupo).map((metrica) => {
      const fila: FilaOnce = {
        clave: metrica.columna,
        etiqueta: metrica.nombre,
        grupo,
        comoLeer: metrica.comoLeer,
        celdas: {},
      };

      for (const { columna, jugadores: suyosTodos } of grupos) {
        /* Sólo aquellos a los que la métrica les dice algo. */
        const suyos = suyosTodos.filter(
          (uno) => uno.wyscout && (!metrica.puestos || metrica.puestos.includes(uno.puesto)),
        );

        const medidos = suyos
          .map((uno) => percentilDe(uno, metrica))
          .filter((m): m is Medido => m !== null);

        if (medidos.length === 0) {
          fila.celdas[columna.key] = VACIA;

          continue;
        }

        /* Los de muestra corta cuentan para la cifra, pero no para la barra. */
        const pct = media(
          medidos.map((m) => m.pct).filter((p): p is number => p !== null),
        );

        const valor = media(medidos.map((m) => m.valor));

        const flojo = medidos.find((m) => m.flojo)?.flojo;

        fila.celdas[columna.key] = {
          texto: valor === null ? null : formatea(valor, metrica),
          fuerza: pct === null ? null : pct / 100,
          /* Sin percentil no hay bueno ni malo que pintar: dorado neutro. */
          sentido: pct === null ? null : metrica.mejorAlto,
          detalle:
            pct === null
              ? flojo
              : `Percentil ${Math.round(pct)}${
                  medidos.length > 1 ? ` · media de ${medidos.length}` : ""
                }${flojo ? ` · ${flojo}` : ""}`,
        };
      }

      return fila;
    });

    /* Un grupo en el que ninguna columna tiene dato no se enseña vacío. */
    return {
      grupo,
      filas: filas.filter((f) => Object.values(f.celdas).some((c) => c.texto !== null)),
    };
  });

  const peso = bloquePeso(grupos, nuestros);

  if (peso) {
    bloques.push(peso.bloque);
    avisos.push(peso.aviso);
  }

  return {
    fuente: "wyscout",
    columnas: grupos.map((g) => g.columna),
    bloques: bloques.filter((b) => b.filas.length > 0),
    avisos,
  };
}

function formatea(valor: number, metrica: MetricaJugador) {
  if (metrica.unidad === "porcentaje") return `${Math.round(valor)} %`;

  if (metrica.unidad === "entero") return String(Math.round(valor));

  return valor.toFixed(2).replace(".", ",");
}

/* ------------------------------------------------------------------ */
/*  LO COLECTIVO CRUZADO CON LO INDIVIDUAL                             */
/* ------------------------------------------------------------------ */

/**
 * PARES DE COLUMNAS QUE MIDEN LO MISMO EN EL EQUIPO Y EN EL JUGADOR.
 *
 * Las dos descargas de Wyscout —«Team Stats», una fila por equipo y partido, y
 * la de jugadores, una fila por cabeza con todo por noventa minutos— cuentan
 * varias cosas con el mismo criterio. Cruzarlas contesta una pregunta que
 * ninguna de las dos contesta sola: **qué parte del equipo es ese jugador**.
 *
 * El reparto es `su valor por 90 ÷ la media por partido del equipo`, y sale en
 * tanto por ciento. Con las once columnas sumadas ronda el 100 %: lo que falta
 * es de los suplentes que entraron.
 */
const PARES_PESO: { equipo: string; jugador: string; nombre: string; comoLeer: string }[] = [
  {
    equipo: "Pases",
    jugador: "Pases/90",
    nombre: "Pases",
    comoLeer: "Qué parte de la circulación del equipo pasa por él.",
  },
  {
    equipo: "Pases progresivos",
    jugador: "Pases progresivos/90",
    nombre: "Pases progresivos",
    comoLeer: "Quién lleva de verdad el balón hacia adelante.",
  },
  {
    equipo: "Pases en el último tercio",
    jugador: "Pases en el último tercio/90",
    nombre: "Pases en el último tercio",
    comoLeer: "Quién juega cerca del área contraria.",
  },
  {
    equipo: "Centros",
    jugador: "Centros/90",
    nombre: "Centros",
    comoLeer: "De los centros del equipo, cuántos pone él.",
  },
  {
    equipo: "Tiros",
    jugador: "Remates/90",
    nombre: "Remates",
    comoLeer: "Qué parte de los remates del equipo son suyos.",
  },
  {
    equipo: "xG",
    jugador: "xG/90",
    nombre: "Peligro generado (xG)",
    comoLeer: "Del peligro que genera el equipo, cuánto sale de sus remates.",
  },
  {
    equipo: "Toques en el área de penalti",
    jugador: "Toques en el área de penalti/90",
    nombre: "Toques en el área",
    comoLeer: "Quién pisa el área rival.",
  },
  {
    equipo: "Duelos defensivos",
    jugador: "Duelos defensivos/90",
    nombre: "Duelos defensivos",
    comoLeer: "Quién se come los duelos atrás.",
  },
  {
    equipo: "Duelos aéreos",
    jugador: "Duelos aéreos en los 90",
    nombre: "Duelos aéreos",
    comoLeer: "Quién salta por el equipo.",
  },
  {
    equipo: "Interceptaciones",
    jugador: "Interceptaciones/90",
    nombre: "Interceptaciones",
    comoLeer: "Quién corta.",
  },
  {
    equipo: "Entradas a ras de suelo",
    jugador: "Entradas/90",
    nombre: "Entradas",
    comoLeer: "Quién entra al suelo.",
  },
  {
    equipo: "Desmarques",
    jugador: "Desmarques/90",
    nombre: "Desmarques",
    comoLeer: "Quién ataca el espacio cuando el equipo lo busca.",
  },
  {
    equipo: "Faltas",
    jugador: "Faltas/90",
    nombre: "Faltas",
    comoLeer: "De las faltas que hace el equipo, cuántas son suyas.",
  },
];

/**
 * El bloque «Peso en el equipo»: lo colectivo cruzado con lo individual.
 *
 * `null` si no hay partidos del equipo con los que comparar —sin denominador
 * no hay reparto que valga—.
 */
function bloquePeso(
  grupos: Grupo[],
  nuestros: FilaPartido[],
): { bloque: BloqueOnce; aviso: string } | null {
  if (nuestros.length === 0) return null;

  /* La media por partido del equipo en cada columna de los «Team Stats». */
  const delEquipo = (columna: string) =>
    media(
      nuestros
        .map((partido) => partido.datos[columna])
        .filter((v): v is number => v !== undefined),
    );

  const filas: FilaOnce[] = [];

  for (const par of PARES_PESO) {
    const suma = delEquipo(par.equipo);

    if (suma === null || suma <= 0) continue;

    const fila: FilaOnce = {
      clave: `peso:${par.equipo}`,
      etiqueta: par.nombre,
      grupo: "Peso en el equipo",
      comoLeer: `${par.comoLeer} Es su valor por 90 minutos dividido entre los ${formateaNumero(
        suma,
      )} que hace el equipo por partido.`,
      celdas: {},
    };

    const partes: number[] = [];

    for (const { columna, jugadores } of grupos) {
      const suyos = jugadores
        .map((uno) => uno.wyscout?.datos[par.jugador])
        .filter((v): v is number => v !== undefined);

      if (suyos.length === 0) {
        fila.celdas[columna.key] = VACIA;

        continue;
      }

      /* Se SUMA, no se promedia: es un reparto de la tarta del equipo. */
      const parte = (suyos.reduce((t, v) => t + v, 0) / suma) * 100;

      partes.push(parte);

      fila.celdas[columna.key] = {
        texto: `${parte.toFixed(parte < 10 ? 1 : 0).replace(".", ",")} %`,
        fuerza: null,
        /* Un reparto no es bueno ni malo: dice de qué se encarga cada uno. */
        sentido: null,
        detalle: `${formateaNumero(
          suyos.reduce((t, v) => t + v, 0),
        )} por 90′ de los ${formateaNumero(suma)} del equipo por partido`,
      };
    }

    /* La barra va contra la columna que más tenga, como en el recuento de Opta. */
    const tope = Math.max(...partes, 1);

    for (const { columna } of grupos) {
      const celda = fila.celdas[columna.key];

      if (!celda || celda.texto === null) continue;

      const parte = Number(celda.texto.replace(" %", "").replace(",", "."));

      fila.celdas[columna.key] = { ...celda, fuerza: parte / tope };
    }

    filas.push(fila);
  }

  if (filas.length === 0) return null;

  return {
    bloque: { grupo: "Peso en el equipo", filas },
    aviso: `«Peso en el equipo» cruza las dos descargas de Wyscout: lo que hace cada uno por 90 minutos frente a lo que hace el equipo por partido (${nuestros.length} partido${
      nuestros.length === 1 ? "" : "s"
    }). Es un reparto, no una nota: un lateral con el 9 % de los pases no está mejor ni peor que uno con el 6 %.`,
  };
}

function formateaNumero(valor: number) {
  return valor >= 100
    ? String(Math.round(valor))
    : valor.toFixed(1).replace(".", ",");
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
  vista: VistaOnce = "lineas",
): RejillaOnce {
  const grupos = gruposDe(once, vista);

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
      celdas: {},
    };

    const sumaDe = (suyos: JugadorOnce[]) =>
      suyos.reduce((t, uno) => t + (uno.opta?.familias[familia.familia] ?? 0), 0);

    /* El tope manda la barra: es un recuento, no hay percentil que valga. */
    const tope = Math.max(1, ...grupos.map((g) => sumaDe(g.jugadores)));

    for (const { columna, jugadores } of grupos) {
      if (jugadores.length === 0) {
        fila.celdas[columna.key] = VACIA;

        continue;
      }

      const suma = sumaDe(jugadores);

      fila.celdas[columna.key] = {
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
    columnas: grupos.map((g) => g.columna),
    bloques: [{ grupo: "Acciones registradas", filas }],
    avisos,
  };
}

/**
 * Lo que se enseña de nuestra valoración: la nota y la forma.
 *
 * **Sin las cuatro áreas** (18/09/2026, a petición del cuerpo técnico): técnica,
 * táctica, física y mental sobraban aquí. En una rejilla de once columnas, cuatro
 * filas que casi siempre se mueven juntas —quien juega bien un partido puntúa
 * alto en las cuatro— ocupaban sitio sin añadir criterio. Siguen estando donde
 * se ponen y donde se leen una a una, en la ficha del jugador.
 */
const AREAS_NUESTRAS: { clave: AreaKey | "global" | "form"; etiqueta: string; comoLeer: string }[] = [
  {
    clave: "global",
    etiqueta: "Nota",
    comoLeer: "La nota del partido, de 0 a 10. Es la media de las que se le han puesto.",
  },
  {
    clave: "form",
    etiqueta: "Forma (5 últimos)",
    comoLeer: "La media de sus cinco últimos partidos valorados: dice el momento, no el curso.",
  },
];

/**
 * Nuestra valoración: la nota, de 0 a 10.
 *
 * Es la única de las tres que **juzga** en vez de contar, y por eso es la que
 * el cuerpo técnico suele mirar primero. La barra es la nota sobre diez, sin
 * percentiles: un 7 es un 7 aunque toda la plantilla ande por ahí.
 */
export function rejillaNuestra(
  once: JugadorOnce[],
  vista: VistaOnce = "lineas",
): RejillaOnce {
  const grupos = gruposDe(once, vista);

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
      celdas: {},
    };

    const notaDe = (uno: JugadorOnce) => {
      const suyo = uno.nuestra;

      if (!suyo || suyo.played === 0) return null;

      if (area.clave === "global") return suyo.avg || null;
      if (area.clave === "form") return suyo.form || null;

      return suyo.areas[area.clave as AreaKey] || null;
    };

    for (const { columna, jugadores } of grupos) {
      const notas = jugadores
        .map(notaDe)
        .filter((n): n is number => n !== null && n > 0);

      if (notas.length === 0) {
        fila.celdas[columna.key] = VACIA;

        continue;
      }

      const nota = media(notas)!;

      fila.celdas[columna.key] = {
        texto: nota.toFixed(1).replace(".", ","),
        fuerza: Math.min(1, nota / 10),
        sentido: true,
        detalle:
          notas.length > 1 ? `Media de ${notas.length} jugadores` : undefined,
      };
    }

    return fila;
  });

  /* Los partidos valorados de cada uno: sin eso, un 8 de un partido y un 8 de
     diez se leen igual. */
  const jugados: FilaOnce = {
    clave: "valorados",
    etiqueta: "Partidos valorados",
    grupo: "Valoración del cuerpo técnico",
    comoLeer: "De cuántos partidos sale la nota. Una nota de un solo partido es una impresión, no una media.",
    celdas: {},
  };

  const tope = Math.max(1, ...once.map((uno) => uno.nuestra?.played ?? 0));

  for (const { columna, jugadores } of grupos) {
    const suyos = jugadores.map((uno) => uno.nuestra?.played ?? 0);

    const valor = media(suyos);

    jugados.celdas[columna.key] =
      valor === null
        ? VACIA
        : {
            texto: valor % 1 === 0 ? String(valor) : valor.toFixed(1).replace(".", ","),
            fuerza: Math.min(1, valor / tope),
            sentido: null,
          };
  }

  return {
    fuente: "nuestra",
    columnas: grupos.map((g) => g.columna),
    bloques: [
      { grupo: "Valoración del cuerpo técnico", filas: [...filas, jugados] },
    ],
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
  elegidos: { id: string; nombre: string; posicion: string; hueco?: string }[],
  jugadores: FilaJugador[],
  resumenes: PlayerSummary[],
  eventos: PartidoEventos[],
): JugadorOnce[] {
  const nuestrosWys = jugadores.filter(
    (j) => esNuestro(j) && j.temporada === "actual",
  );

  const deOpta = porJugador(eventos.flatMap((p) => p.eventos));

  return elegidos.map((uno) => {
    const wyscout = casaNombre(uno.nombre, nuestrosWys, (j) => j.jugador);

    const opta = casaNombre(uno.nombre, deOpta, (j) => j.jugador);

    const nuestra = resumenes.find((r) => r.playerId === uno.id) ?? null;

    const sitio = sitioDe(uno.posicion, wyscout?.posicion ?? null);

    return {
      id: uno.id,
      nombre: uno.nombre,
      hueco: uno.hueco,
      puesto: sitio.puesto,
      lado: sitio.lado,
      linea: lineaDe(sitio.puesto),
      sitio,
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
  vista: VistaOnce = "lineas",
  nuestros: FilaPartido[] = [],
): RejillaOnce {
  if (fuente === "opta") {
    const todos = eventos.flatMap((p) => p.eventos);

    return rejillaOpta(
      once,
      eventos.length,
      {
        con: todos.filter((e) => e.jugador).length,
        sin: todos.filter((e) => !e.jugador).length,
      },
      vista,
    );
  }

  if (fuente === "nuestra") return rejillaNuestra(once, vista);

  return rejillaWyscout(once, jugadores, ambito, vista, nuestros);
}

/** Los puestos, por si la pantalla quiere ofrecerlos en orden. */
export { PUESTOS, metricasDe };
