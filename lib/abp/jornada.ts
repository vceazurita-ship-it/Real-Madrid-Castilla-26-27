/**
 * La jornada: lo que ata la pizarra de balón parado con el resto de la semana.
 *
 * El plan de partido (`/match-preparation`) y el informe del rival
 * (`/scout-rival-collective`) leen la **misma fila** de la hoja RIVALES, y se
 * abren por su `ID`. La pizarra sólo sabía de un partido del calendario, que es
 * otra fuente —el CSV de resultados—, así que era una isla: se montaba el ABP
 * del rival sin poder ver de un clic lo que el análisis ya decía de él.
 *
 * Aquí está el puente. Se lee la hoja una vez, se busca la fila que le
 * corresponde al partido —por `ID` si ya está atado, y si no por nombre o por
 * fecha— y se devuelven los enlaces con los que la pizarra abre el plan y el
 * análisis en el sitio correcto.
 */

import { compareMatches } from "@/lib/ratings/matches";
import type { MatchMeta } from "@/lib/ratings/types";

export type FilaRival = Record<string, string>;

export type JornadaRival = {
  /** `ID` de la hoja: la llave con la que abren el plan y el análisis. */
  id: string;
  /** "1", "2"… tal y como viene. Vacío si la fila no la trae. */
  jornada: string;
  equipo: string;
  /** "YYYY-MM-DD" o "" si no se entiende lo que hay en la hoja. */
  fecha: string;
  /** Se juega en casa. La hoja lo escribe en `LOCAL_VISITANTE`. */
  local: boolean;
  /** Lo que el plan de partido dice del balón parado del rival. */
  abpOf: string;
  abpDef: string;
  fila: FilaRival;
};

/* ------------------------------------------------------------------ */
/*  CARGA                                                              */
/* ------------------------------------------------------------------ */

const texto = (valor: unknown) => String(valor ?? "").trim();

/** La hoja puede devolver ISO completo o "dd/mm/yyyy". */
export function claveFecha(raw: unknown) {
  const valor = texto(raw);

  if (!valor) return "";

  const iso = valor.match(/^(\d{4})-(\d{2})-(\d{2})/);

  if (iso) return `${iso[1]}-${iso[2]}-${iso[3]}`;

  const corta = valor.match(/^(\d{1,2})[/\-.](\d{1,2})[/\-.](\d{2,4})$/);

  if (corta) {
    const anio = corta[3].length === 2 ? `20${corta[3]}` : corta[3];

    return `${anio}-${corta[2].padStart(2, "0")}-${corta[1].padStart(2, "0")}`;
  }

  const fecha = new Date(valor);

  if (Number.isNaN(fecha.getTime())) return "";

  const local = new Date(fecha.getTime() - fecha.getTimezoneOffset() * 60000);

  return local.toISOString().slice(0, 10);
}

function aJornada(fila: FilaRival): JornadaRival {
  return {
    id: texto(fila.ID),
    jornada: texto(fila.JORNADA),
    equipo: texto(fila.EQUIPO),
    fecha: claveFecha(fila.FECHA),
    local: /^local/i.test(texto(fila.LOCAL_VISITANTE)),
    abpOf: texto(fila.ABP_OF),
    abpDef: texto(fila.ABP_DEF),
    fila,
  };
}

/**
 * Las jornadas de la hoja RIVALES, ordenadas.
 *
 * Va por `/api/rivals`, que es el proxy del Apps Script: llamar al script
 * directamente desde el navegador es lo que hacen las páginas más viejas, pero
 * el proxy ya está y evita el CORS.
 */
export async function cargaJornadas(signal?: AbortSignal): Promise<JornadaRival[]> {
  const response = await fetch("/api/rivals?action=rivales", {
    cache: "no-store",
    signal,
  });

  if (!response.ok) throw new Error(`HTTP ${response.status}`);

  const data = await response.json();

  if (!Array.isArray(data)) return [];

  return (data as FilaRival[])
    .filter((fila) => fila && typeof fila === "object")
    .map(aJornada)
    .filter((jornada) => jornada.id || jornada.equipo)
    .sort((a, b) => Number(a.jornada || 0) - Number(b.jornada || 0));
}

/* ------------------------------------------------------------------ */
/*  CRUCE                                                              */
/* ------------------------------------------------------------------ */

export function normaliza(valor: unknown) {
  return String(valor ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

/*
| Los nombres no coinciden entre fuentes: el calendario escribe "CD Teruel" y
| la hoja "Teruel", o al revés. Se quitan las siglas de club antes de comparar,
| que es lo único que suele sobrar.
*/
const SIGLAS = /\b(cd|cf|ud|sd|ad|rc|rcd|ca|club|deportivo|atletico|athletic|sad|fc|b|castilla)\b/g;

function nucleo(nombre: string) {
  return normaliza(nombre).replace(SIGLAS, " ").replace(/\s+/g, " ").trim();
}

/** ¿Son el mismo equipo escrito de dos maneras? */
export function mismoEquipo(a: string, b: string) {
  if (!a || !b) return false;

  if (normaliza(a) === normaliza(b)) return true;

  const na = nucleo(a);
  const nb = nucleo(b);

  if (!na || !nb) return false;

  return na === nb || na.includes(nb) || nb.includes(na);
}

/**
 * Qué fila de la hoja le toca a este partido.
 *
 * Por este orden: el `ID` que el tablero ya tenga atado —una decisión tomada a
 * mano manda sobre cualquier parecido—, la fecha del partido, y por último el
 * nombre. La fecha va antes que el nombre porque contra un mismo rival se juega
 * dos veces por temporada y son dos jornadas distintas.
 */
export function buscaJornada(
  jornadas: JornadaRival[],
  { rivalId, rival, fecha }: { rivalId?: string; rival?: string; fecha?: string },
): JornadaRival | null {
  if (rivalId) {
    const atada = jornadas.find((item) => item.id === rivalId);

    if (atada) return atada;
  }

  if (fecha) {
    const porFecha = jornadas.find((item) => item.fecha && item.fecha === fecha);

    if (porFecha) return porFecha;
  }

  if (rival) {
    const porNombre = jornadas.find((item) => mismoEquipo(item.equipo, rival));

    if (porNombre) return porNombre;
  }

  return null;
}

/** Cómo se lee una jornada en un botón: "J07 · CD Teruel". */
export function etiquetaJornada(jornada: JornadaRival) {
  const numero = jornada.jornada
    ? `J${String(jornada.jornada).padStart(2, "0")}`
    : "Sin jornada";

  return `${numero} · ${jornada.equipo || "Sin equipo"}`;
}

/* ------------------------------------------------------------------ */
/*  EL CALENDARIO DE LA TEMPORADA                                      */
/* ------------------------------------------------------------------ */

/**
 * Una jornada de la hoja, vista como un partido.
 *
 * El calendario de `lib/ratings/matches` se va llenando con lo **jugado**: en
 * agosto tiene un amistoso y nada más. La hoja RIVALES, en cambio, trae la liga
 * entera desde el primer día, que es lo que hace falta para preparar el balón
 * parado de la semana que viene. El identificador lleva prefijo para que no
 * choque con los del CSV y para que se vea de dónde salió.
 */
export function partidoDeJornada(jornada: JornadaRival): MatchMeta {
  return {
    id: `riv-${jornada.id}`,
    date: jornada.fecha,
    opponent: jornada.equipo,
    competition: jornada.jornada ? `Jornada ${jornada.jornada}` : "Liga",
    isHome: jornada.local,
    result: "",
    gf: null,
    ga: null,
    source: "manual",
  };
}

/**
 * El calendario con el que trabaja la pizarra: lo jugado más lo que viene.
 *
 * Manda el CSV cuando las dos fuentes hablan del mismo partido —ahí está el
 * resultado y el identificador con el que ya se guardaron las valoraciones—, y
 * la hoja aporta las jornadas que todavía no se han jugado.
 *
 * Se cruzan por **fecha** cuando las dos la tienen: contra un mismo rival se
 * juega dos veces por temporada, así que el nombre no distingue la ida de la
 * vuelta.
 */
export function mezclaCalendario(
  partidos: MatchMeta[],
  jornadas: JornadaRival[],
): MatchMeta[] {
  const sueltas = jornadas.filter(
    (jornada) =>
      !partidos.some((partido) =>
        partido.date && jornada.fecha
          ? partido.date === jornada.fecha
          : mismoEquipo(partido.opponent, jornada.equipo),
      ),
  );

  return [...partidos, ...sueltas.map(partidoDeJornada)].sort(compareMatches);
}

/* ------------------------------------------------------------------ */
/*  ENLACES                                                            */
/* ------------------------------------------------------------------ */

export function enlacePlanDePartido(jornada: JornadaRival | null) {
  return jornada?.id
    ? `/match-preparation?rival=${encodeURIComponent(jornada.id)}`
    : "/match-preparation";
}

export function enlaceAnalisisRival(jornada: JornadaRival | null) {
  return jornada?.id
    ? `/scout-rival-collective?rival=${encodeURIComponent(jornada.id)}`
    : "/scout-rival-collective";
}

/**
 * El ABP del rival se elige por **nombre de equipo**, no por `ID`: esa página
 * no lee la hoja RIVALES sino las de balón parado y la de plantillas.
 */
export function enlaceAbpRival(equipo: string) {
  return equipo
    ? `/scout-rival-abp?equipo=${encodeURIComponent(equipo)}`
    : "/scout-rival-abp";
}
