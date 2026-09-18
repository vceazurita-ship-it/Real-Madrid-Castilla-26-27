import { CALENDARIO } from "./calendario";

/**
 * LOS RESULTADOS DE LA JORNADA, LEÍDOS DE BESOCCER.
 *
 * Lo comparten dos sitios y por eso vive aquí y no dentro de un script: lo usa
 * el trabajo nocturno del ordenador del club (`scripts/quiniela-resultados.cjs`)
 * y el botón de la pantalla de ajustes (`/api/quiniela/actualizar`). Un solo
 * lector, un solo sitio donde mirar cuando BeSoccer cambie el HTML.
 *
 * **Se ata por número de jornada, no por fecha.** El calendario del Excel trae
 * la fecha nominal —los nueve partidos de la 4 figuran el domingo 20— y en
 * realidad se juegan repartidos entre el viernes y el domingo. BeSoccer escribe
 * «Primera Federación. Jornada 4» en cada partido de su calendario, y eso no
 * se mueve.
 *
 * **Se mira el calendario del equipo de casa**, que trae sus 38 jornadas con el
 * marcador. Una página por partido: nueve por jornada.
 *
 * **Ojo con quién pregunta.** BeSoccer responde 403 o 406 a las IP de centro de
 * datos —al runner de GitHub le contestó 406 con cero bytes el 01/09/2026— así
 * que esto funciona desde una conexión normal y puede no funcionar desde un
 * servidor. Por eso `traeResultados` devuelve el código que contestó en vez de
 * una lista vacía: quien llame tiene que poder distinguir «no se ha jugado» de
 * «no me dejan mirar».
 */

const UA =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0 Safari/537.36";

/**
 * Cada equipo de nuestro calendario, con su ficha en BeSoccer.
 *
 * Los `slug` son los mismos que usan `rivals-informe.mjs` y `rivals-stats.mjs`.
 */
export const SLUGS: Record<string, string> = {
  "AD Alcorcón": "ad-alcorcon",
  "Águilas FC": "aguilas-cf",
  "Algeciras CF": "algeciras-cf",
  "Antequera CF": "antequera",
  "Atlético Madrileño": "at-madrid-b",
  "CD Teruel": "teruel",
  "CE Europa": "ce-europa",
  "CF Rayo Majadahonda": "rayo-majadahonda",
  "FC Cartagena": "cartagena",
  "Gimnàstic de Tarragona": "gimnastic-tarragona",
  "Hércules de Alicante CF": "hercules",
  "Juventud de Torremolinos CF": "juventud-torremolinos",
  "Real Jaén CF": "real-jaen",
  "Real Murcia CF": "real-murcia",
  "Real Zaragoza": "real-zaragoza",
  "SD Huesca": "huesca",
  "UD Ibiza": "ibiza-eivissa",
  "UE Sant Andreu": "sant-andreu",
  'Villarreal CF "B"': "villarreal-b",
};

/* ------------------------------------------------------------------ */
/*  COMPARAR NOMBRES                                                   */
/* ------------------------------------------------------------------ */

/**
 * Las siglas del tipo de club, que cada sitio pone donde quiere.
 *
 * Nuestro calendario escribe «AD Alcorcón» y BeSoccer «Alcorcón»; nosotros
 * «Villarreal CF "B"» y ellos «Villarreal B». Quitando las siglas quedan los
 * nombres, que sí coinciden. La **B** no se quita: es lo único que distingue a
 * un filial de su primer equipo.
 */
const SIGLAS = new Set(["cf", "cd", "ud", "sd", "ad", "fc", "ue", "ce", "rcd", "sad", "de", "club"]);

export function nombreClave(nombre: string) {
  return (nombre || "")
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/["'.]/g, " ")
    .split(/\s+/)
    .filter((trozo) => trozo && !SIGLAS.has(trozo))
    .join(" ")
    .trim();
}

export function mismoEquipo(uno: string, otro: string) {
  const a = nombreClave(uno);
  const b = nombreClave(otro);

  if (!a || !b) return false;

  return a === b || a.includes(b) || b.includes(a);
}

/* ------------------------------------------------------------------ */
/*  EL CALENDARIO DE UN EQUIPO EN BESOCCER                             */
/* ------------------------------------------------------------------ */

export type PartidoBeSoccer = {
  /** El número que escribe BeSoccer: «Primera Federación. Jornada 4» → 4. */
  jornada: number;
  /** "2026-09-20T12:00". */
  cuando: string;
  local: string;
  visitante: string;
  golesLocal: number | null;
  golesVisitante: number | null;
};

/**
 * Los partidos de un equipo, de su página de calendario.
 *
 * Se lee el HTML a mano, como el resto del proyecto con BeSoccer: cada partido
 * es un `<a id="match-…">` con la fecha en `starttime`, la competición y la
 * jornada en `middle-info`, los dos nombres en `<div class="name">` y el
 * marcador en dos `<span class='r1'>`/`'r2'`. Sin esos dos spans, el partido
 * no se ha jugado.
 */
export function leeCalendario(html: string): PartidoBeSoccer[] {
  const partidos: PartidoBeSoccer[] = [];

  /* Sólo el panel de partidos del equipo: la página trae otros bloques con la
     misma pinta —«partidos más visitados»— de otras ligas. */
  const desde = html.indexOf('<h2 class="panel-title">Partidos</h2>');

  const bloque = desde === -1 ? html : html.slice(desde);

  for (const trozo of bloque.split('<a id="match-').slice(1)) {
    const enlace = trozo.slice(0, trozo.indexOf("</a>"));

    const jornada = Number(enlace.match(/Jornada (\d+)/)?.[1] ?? 0);

    if (!jornada) continue;

    const nombres = [...enlace.matchAll(/<div class="name">([^<]*)<\/div>/g)].map((m) =>
      m[1].replace(/&amp;/g, "&").trim(),
    );

    if (nombres.length < 2) continue;

    const marca = enlace.match(/<span class='r1'>(\d+)<\/span>-<span class='r2'>(\d+)<\/span>/);

    partidos.push({
      jornada,
      cuando: enlace.match(/starttime="([^"]+)"/)?.[1] ?? "",
      local: nombres[0],
      visitante: nombres[1],
      golesLocal: marca ? Number(marca[1]) : null,
      golesVisitante: marca ? Number(marca[2]) : null,
    });
  }

  return partidos;
}

/* ------------------------------------------------------------------ */
/*  LA JORNADA ENTERA                                                  */
/* ------------------------------------------------------------------ */

export type ResultadoPartido = {
  indice: number;
  local: string;
  visitante: string;
  /** `null` mientras no se haya jugado. */
  signo: "1" | "X" | "2" | null;
  marcador: string | null;
  /** Cuándo se juega, tal y como lo dice BeSoccer. */
  cuando: string;
  /** Por qué no hay signo, cuando no lo hay. */
  nota?: string;
};

export type LecturaJornada = {
  jornada: number;
  partidos: ResultadoPartido[];
  /** Códigos HTTP que contestó BeSoccer, para poder explicar un silencio. */
  estados: number[];
  /** Si alguna página no se pudo leer. */
  bloqueado: boolean;
};

const signoDe = (local: number, visitante: number) =>
  local > visitante ? "1" : local < visitante ? "2" : "X";

/**
 * Lee de BeSoccer los nueve partidos de una jornada.
 *
 * `traePagina` se inyecta para que cada sitio use lo suyo: el servidor, el
 * `fetch` de siempre; el script del ordenador del club, `curl`, que es lo que
 * ya usan los otros tres scripts nocturnos.
 */
export async function traeResultados(
  jornada: number,
  traePagina: (url: string) => Promise<{ cuerpo: string; estado: number }>,
): Promise<LecturaJornada> {
  const nuestros = CALENDARIO.filter((uno) => uno.jornada === jornada);

  const calendarios = new Map<string, PartidoBeSoccer[]>();

  const estados: number[] = [];

  const partidos: ResultadoPartido[] = [];

  for (const [indice, partido] of nuestros.entries()) {
    const base: ResultadoPartido = {
      indice,
      local: partido.local,
      visitante: partido.visitante,
      signo: null,
      marcador: null,
      cuando: "",
    };

    const slug = SLUGS[partido.local];

    if (!slug) {
      partidos.push({ ...base, nota: "sin ficha de BeSoccer" });

      continue;
    }

    if (!calendarios.has(slug)) {
      const { cuerpo, estado } = await traePagina(
        `https://es.besoccer.com/equipo/partidos/${slug}`,
      );

      estados.push(estado);

      calendarios.set(slug, estado === 200 && cuerpo ? leeCalendario(cuerpo) : []);
    }

    const suyos = calendarios.get(slug) ?? [];

    /*
    | EL NÚMERO DE JORNADA NO BASTA: LA PÁGINA TRAE DOS TEMPORADAS.
    |
    | El calendario de un equipo en BeSoccer lista la temporada pasada y la
    | actual, y las dos tienen una «Jornada 4». Quedarse con la primera que
    | aparece devolvía el partido del año anterior —«At. Sanluqueño - CD Teruel»
    | del 21/09/2025— con toda la pinta de ser el bueno.
    |
    | Así que entre las candidatas se elige la que cae **cerca de la fecha que
    | dice nuestro calendario**. Diez días de margen: sobra para un partido
    | adelantado al viernes o aplazado al lunes, y no llega ni de lejos a la
    | jornada del año pasado.
    */
    const nominal = Date.parse(`${partido.fecha}T12:00:00Z`);

    const candidatas = suyos.filter((uno) => uno.jornada === jornada);

    const suyo = candidatas.find((uno) => {
      const cuando = Date.parse(uno.cuando);

      if (!Number.isFinite(cuando) || !Number.isFinite(nominal)) return false;

      return Math.abs(cuando - nominal) <= 10 * 86_400_000;
    });

    if (!suyo) {
      partidos.push({ ...base, nota: "BeSoccer no trae esa jornada" });

      continue;
    }

    /* La red de seguridad: que sea el partido que creemos. */
    if (!mismoEquipo(suyo.local, partido.local) || !mismoEquipo(suyo.visitante, partido.visitante)) {
      partidos.push({
        ...base,
        cuando: suyo.cuando,
        nota: `BeSoccer dice «${suyo.local} - ${suyo.visitante}»`,
      });

      continue;
    }

    if (suyo.golesLocal === null || suyo.golesVisitante === null) {
      partidos.push({ ...base, cuando: suyo.cuando, nota: "sin jugar" });

      continue;
    }

    partidos.push({
      ...base,
      cuando: suyo.cuando,
      signo: signoDe(suyo.golesLocal, suyo.golesVisitante),
      marcador: `${suyo.golesLocal}-${suyo.golesVisitante}`,
    });
  }

  return {
    jornada,
    partidos,
    estados,
    /* Ninguna página contestó 200: o no hay red, o no nos dejan mirar. */
    bloqueado: estados.length > 0 && estados.every((estado) => estado !== 200),
  };
}

/** La página, con el `fetch` de siempre. Es lo que usa el servidor. */
export async function traePaginaConFetch(url: string) {
  try {
    const respuesta = await fetch(url, {
      headers: {
        "User-Agent": UA,
        Accept: "text/html,application/xhtml+xml",
        "Accept-Language": "es-ES,es;q=0.9",
      },
      cache: "no-store",
    });

    return { cuerpo: respuesta.ok ? await respuesta.text() : "", estado: respuesta.status };
  } catch {
    return { cuerpo: "", estado: 0 };
  }
}
