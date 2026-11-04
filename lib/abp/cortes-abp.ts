/*
|--------------------------------------------------------------------------
| TODO EL BALÓN PARADO DEL PARTIDO, EN VÍDEO (03/11/2026)
|--------------------------------------------------------------------------
|
| Lo pidió el analista: el vídeo post de ABP tiene que llevar TODO lo que nos
| lanzan a nuestro área (córners, faltas y penaltis) y todo lo nuestro, con
| rigor en la selección y en el relato. Antes los cortes salían de Hudl con
| un tope por tipo (4 córners, 3 faltas…) y Hudl llama «Set Pieces» a
| cualquier reanudación: entraban faltas en el centro del campo y faltaban
| la mayoría de los córners en contra (4 de 14 en la J10).
|
| Ahora MANDAN NUESTRAS HOJAS de ABP: cada fila es una acción que el analista
| ya ha dado por balón parado al área. Cada fila se casa con su momento del
| timeline de Hudl por lado, parte y minuto (el código «Corners» para un
| córner; «Free kicks» y luego «Set Pieces» del último tercio para una
| falta) y de ahí sale el corte. El relato de cada corte sale de la fila
| —envío, zona, remate, segundo balón, final—, no de una lectura del vídeo.
|
| Puro y sin dependencias: lo usan el script del ordenador del club
| (scripts/partido/video-informe.mjs) y el vídeo del navegador.
*/

export type LadoAbp = "favor" | "contra";

/** Una fila de nuestras hojas de ABP del partido, con lo que cuenta el corte. */
export type FilaAbpCorte = {
  lado: LadoAbp;
  /** Posición entre las filas de ESE partido en su hoja: desempata dos acciones iguales del mismo minuto. */
  orden?: number;
  parte: 1 | 2;
  minuto: number;
  /** «Córner», «Falta lateral interior Z3», «Penalti»… tal cual la hoja. */
  accion: string;
  clase: "corner" | "falta" | "penalti";
  sacador: string;
  envio: string;
  zonaCaida: string;
  remate: boolean;
  rematador: string;
  tipoRemate: string;
  zonaRemate: string;
  xg: number;
  segundoBalon: string;
  final: string;
  /** Falta tirada a puerta: la hoja pone Remate «No aplica» (el tiro es la propia falta) y le da xG. */
  tiroDirecto?: boolean;
};

/**
 * Un momento del timeline de Hudl que puede ser un balón parado. `conSaque`:
 * la sesión de jugador tiene a alguien sacando (córner, falta o penalti) a
 * ±3 s. Un «Set Pieces» sin saque suele ser un saque de banda o de meta.
 */
export type MomentoAbpHudl = { ini: number; fin: number; codigo: string; propio: boolean; tercio: string; penalti: boolean; conSaque?: boolean };

/** Una fila ya casada con su momento de Hudl: lo que hay que cortar. */
export type AccionAbpCortada = FilaAbpCorte & { ini: number; fin: number };

const limpia = (t: unknown) => String(t ?? "").replace(/\s+/g, " ").trim();
const sinTildes = (t: string) => t.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();

/** El CSV publicado de una hoja (comillas incluidas). */
export function leeCsv(texto: string): Record<string, string>[] {
  const filas: string[][] = [];
  let fila: string[] = [];
  let celda = "";
  let comillas = false;

  for (let i = 0; i < texto.length; i += 1) {
    const ch = texto[i];

    if (comillas) {
      if (ch === '"' && texto[i + 1] === '"') {
        celda += '"';
        i += 1;
      } else if (ch === '"') comillas = false;
      else celda += ch;
    } else if (ch === '"') comillas = true;
    else if (ch === ",") {
      fila.push(celda);
      celda = "";
    } else if (ch === "\n" || ch === "\r") {
      if (ch === "\r" && texto[i + 1] === "\n") i += 1;
      fila.push(celda);
      filas.push(fila);
      fila = [];
      celda = "";
    } else celda += ch;
  }

  if (celda || fila.length) {
    fila.push(celda);
    filas.push(fila);
  }

  const [cabecera, ...resto] = filas;

  if (!cabecera) return [];

  return resto.filter((f) => f.some((c) => c.trim())).map((f) => Object.fromEntries(cabecera.map((h, i) => [h.trim(), (f[i] ?? "").trim()])));
}

const campo = (f: Record<string, string>, ...claves: string[]) => {
  for (const k of claves) {
    const hit = Object.keys(f).find((h) => sinTildes(h) === sinTildes(k));

    if (hit && limpia(f[hit])) return limpia(f[hit]);
  }

  return "";
};

const claseDe = (accion: string): FilaAbpCorte["clase"] | null => {
  const a = sinTildes(accion);

  if (/penalti/.test(a)) return "penalti";
  if (/corner/.test(a)) return "corner";
  if (/falta/.test(a)) return "falta";

  return null;
};

/** «67» → 67; «45+2» → 47, como lo cuenta `parseMinuto` (lib/abp/partido.ts). Vacío → NaN. */
export function minutoDeHoja(t: string): number {
  const [base, extra] = String(t ?? "").replace(",", ".").split("+");

  if (!String(base ?? "").trim()) return NaN;

  return Math.round(Number(base) + (Number(extra) || 0));
}

/** «2», «2T», «T2» → 2. */
const parteDe = (t: string): 1 | 2 => (/2/.test(t) ? 2 : 1);

/**
 * Las filas de las dos hojas que son de ESE partido («LIGA 10»), en orden de
 * partido. Sólo córners, faltas y penaltis: es lo que va al área.
 */
export function filasAbpDelPartido(ofensivo: Record<string, string>[], defensivo: Record<string, string>[], jornada: number): FilaAbpCorte[] {
  const esJornada = (f: Record<string, string>) => {
    const j = campo(f, "JORNADA").toUpperCase();

    return /^LIGA\b/.test(j) && Number(j.match(/(\d+)/)?.[1]) === jornada;
  };

  const de = (lista: Record<string, string>[], lado: LadoAbp) =>
    lista.filter(esJornada).flatMap((f, orden): FilaAbpCorte[] => {
      const fila = filaAbpDeHoja(f, lado, orden);

      return fila ? [fila] : [];
    });

  return [...de(ofensivo, "favor"), ...de(defensivo, "contra")].sort((a, b) => a.parte - b.parte || a.minuto - b.minuto);
}

/** Una fila de la hoja (por el nombre de sus columnas) contada para el corte; null si no es córner, falta ni penalti o no tiene minuto. */
export function filaAbpDeHoja(f: Record<string, string>, lado: LadoAbp, orden?: number): FilaAbpCorte | null {
  const accion = campo(f, "Tipo_Accion");
  const clase = claseDe(accion);
  const minuto = minutoDeHoja(campo(f, "Minuto", "MINUTO"));

  if (!clase || !Number.isFinite(minuto) || minuto <= 0 || minuto > 130) return null;

  const remate = /^s[ií]/i.test(campo(f, "Remate"));
  const xg = Number(campo(f, "xG").replace(",", ".")) || 0;
  const tiroDirecto = clase === "falta" && !remate && /no aplica/i.test(campo(f, "Remate")) && xg > 0;

  return {
    lado,
    ...(orden === undefined ? {} : { orden }),
    /* Pasado el 50 sólo puede ser la segunda parte, diga lo que diga «Tiempo» (J03: «T1» en el 52 y el 75). */
    parte: minuto > 50 ? 2 : parteDe(campo(f, "Tiempo")),
    minuto,
    accion,
    clase,
    sacador: campo(f, "Sacador"),
    envio: campo(f, "Tipo_Envio"),
    zonaCaida: campo(f, "Zona_Caida"),
    remate,
    rematador: remate ? campo(f, "Rematador") : "",
    tipoRemate: remate ? campo(f, "Tipo_Remate") : "",
    zonaRemate: remate ? campo(f, "Zona_Remate") : "",
    xg,
    segundoBalon: campo(f, "Segundo_Balon"),
    final: campo(f, "Resultado_Final"),
    ...(tiroDirecto ? { tiroDirecto } : {}),
  };
}

/** El minuto de juego de un instante de Hudl, sin el «+»: el 45+2 de la primera parte es 47, como en la hoja. */
export function minutoDeJuego(t: number, periodos: number[]): { parte: 1 | 2; minuto: number } {
  const [t1 = 0, t2 = Infinity] = periodos;

  return t >= t2 ? { parte: 2, minuto: 45 + Math.floor((t - t2) / 60) + 1 } : { parte: 1, minuto: Math.max(1, Math.floor((t - t1) / 60) + 1) };
}

type MomentoTimeline = { startTimeMs: number; endTimeMs?: number; tags: { key: string; values: string[] }[] };
type TimelineHudl = { data: { taggingSessions: { items: { moments: { items: MomentoTimeline[] } }[] } } };

/**
 * Los momentos de balón parado del timeline, de las DOS sesiones: la de
 * equipo («Cartagena - Corners», «… - Free kicks», «… - Set Pieces») y la
 * de jugador, donde el que saca lleva «Corner», «Free kick…» o «Penalty».
 * La de equipo se salta saques (en la J10, nuestra falta del 90' y el último
 * córner del Cartagena); la de jugador los tiene. Medido en la J10: el evento
 * del que saca empieza ~2 s antes que el momento de equipo, así que se
 * retrasa 2 s para cortar igual. Un «Set Pieces» que coincide con un córner o
 * una falta es el mismo saque y no se cuenta dos veces.
 */
export function momentosAbpDeHudl(timeline: TimelineHudl, nosotros = "Real Madrid Castilla"): { momentos: MomentoAbpHudl[]; periodos: number[] } {
  const SES = timeline.data.taggingSessions.items;
  const cod = (m: MomentoTimeline) => (m.tags.find((t) => t.key === "HUDL_CODE") || { values: [""] }).values[0];
  const tag = (m: MomentoTimeline, re: RegExp) => m.tags.find((t) => re.test(t.key))?.values ?? [];
  const EQ = SES.find((s) => s.moments.items.some((m) => / - Possessions$/.test(cod(m)))) || SES[0];
  const JUG = SES.find((s) => s !== EQ);
  const periodos = EQ.moments.items
    .filter((m) => cod(m) === "Periods")
    .map((m) => m.startTimeMs / 1000)
    .sort((a, b) => a - b);

  /* De qué equipo es cada jugador: por los momentos de equipo en los que aparece (como `eligeMomentos`). */
  const equipo: Record<string, boolean> = {};

  for (const m of EQ.moments.items) {
    const c = cod(m);

    if (/ - /.test(c)) for (const p of tag(m, /Players$/)) equipo[p] ??= c.startsWith(nosotros);
  }

  const deEquipo: MomentoAbpHudl[] = EQ.moments.items
    .filter((m) => / - (Corners|Free kicks|Set Pieces)$/.test(cod(m)))
    .map((m) => ({
      ini: m.startTimeMs / 1000,
      fin: (m.endTimeMs ?? m.startTimeMs) / 1000,
      codigo: cod(m),
      propio: cod(m).startsWith(nosotros),
      tercio: tag(m, /^\d+ - Location third$/)[0] ?? "",
      penalti: false,
    }));
  const fuertes = deEquipo.filter((m) => !/Set Pieces$/.test(m.codigo));
  const unicos = deEquipo.filter((m) => !/Set Pieces$/.test(m.codigo) || !fuertes.some((f) => f.propio === m.propio && Math.abs(f.ini - m.ini) < 3));

  const deJugador: MomentoAbpHudl[] = (JUG?.moments.items ?? []).flatMap((m): MomentoAbpHudl[] => {
    const tipos = tag(m, /^\d+ - Type$/);
    const propio = equipo[cod(m)];
    /* Sólo el que lo tira: «Penalty foul» es del que lo comete y «Penalty save» del portero (04/11/2026: en la J03 salían tres penaltis y hubo uno). */
    const penalti = tipos.includes("Penalty");
    const clase = penalti ? "Free kicks" : tipos.includes("Corner") ? "Corners" : tipos.some((t) => /^Free kick/.test(t)) ? "Free kicks" : "";

    if (!clase || propio === undefined) return [];

    const ini = m.startTimeMs / 1000 + 2;

    return [{ ini, fin: ini + 3, codigo: `${propio ? nosotros : "Rival"} - ${clase}`, propio, tercio: "", penalti, conSaque: true }];
  });

  /* El de jugador, sólo si el de equipo no tiene ese saque. */
  const extra = deJugador.filter((p) => !unicos.some((u) => u.propio === p.propio && Math.abs(u.ini - p.ini) < 5));

  /* ¿Alguien saca en ese momento de equipo? (el evento del que saca va ~2 s antes; aquí ya lleva los 2 s sumados). */
  for (const u of unicos) u.conSaque = deJugador.some((p) => p.propio === u.propio && Math.abs(p.ini - u.ini) <= 3);

  return { momentos: [...unicos, ...extra].sort((a, b) => a.ini - b.ini), periodos };
}

/** Qué código de Hudl encaja con cada clase, de mejor a peor (null: no encaja). */
function encaje(f: FilaAbpCorte, m: MomentoAbpHudl): number | null {
  if (f.clase === "penalti") return m.penalti ? 0 : null;
  if (f.clase === "corner") return /- Corners$/.test(m.codigo) ? 0 : /- Set Pieces$/.test(m.codigo) && m.tercio === "Final third" ? 2 : null;
  if (m.penalti) return null;
  if (/- Free kicks$/.test(m.codigo)) return 0;
  /* Un «Set Pieces» en el que nadie saca una falta suele ser un saque de banda: sólo si no hay una falta de verdad a ±2 (J03: la falta del 75' se iba al saque del 73'). */
  if (/- Set Pieces$/.test(m.codigo)) return (m.tercio === "Final third" ? 1 : m.tercio === "Middle third" ? 2 : NaN) + (m.conSaque === false ? 6 : 0) || null;

  return null;
}

/**
 * Cada fila con su momento: mismo lado y parte, el minuto a ±2 y el código que
 * mejor encaja. Un momento sirve una sola vez. Primero se casan los córners
 * (su código es inequívoco) y luego faltas y penaltis, para que una falta no
 * se quede con el momento de un córner. Una fila sin momento no se corta, y
 * se dice en `sinCorte`.
 */
export function casaConHudl(filas: FilaAbpCorte[], momentos: MomentoAbpHudl[], periodos: number[]): { cortadas: AccionAbpCortada[]; sinCorte: FilaAbpCorte[] } {
  const usados = new Set<MomentoAbpHudl>();
  const cortadas: AccionAbpCortada[] = [];
  const sinCorte: FilaAbpCorte[] = [];
  const orden = [...filas].sort((a, b) => Number(a.clase !== "corner") - Number(b.clase !== "corner"));

  for (const f of orden) {
    const mejor = momentos
      .filter((m) => m.propio === (f.lado === "favor") && !usados.has(m))
      .flatMap((m) => {
        const e = encaje(f, m);
        const j = minutoDeJuego(m.ini, periodos);

        if (e === null || j.parte !== f.parte) return [];

        const dif = Math.abs(j.minuto - f.minuto);

        return dif <= 2 ? [{ m, nota: dif * 3 + e }] : [];
      })
      .sort((a, b) => a.nota - b.nota || a.m.ini - b.m.ini)[0];

    if (!mejor) {
      sinCorte.push(f);
      continue;
    }

    usados.add(mejor.m);
    cortadas.push({ ...f, ini: mejor.m.ini, fin: mejor.m.fin });
  }

  cortadas.sort((a, b) => a.ini - b.ini);

  return { cortadas, sinCorte };
}

/* ------------------------------ el relato ------------------------------ */

const minuscula = (t: string) => t.charAt(0).toLocaleLowerCase("es-ES") + t.slice(1);

/** «Córner», «Falta lateral», «Falta directa», «Penalti»: sin la zona del código («interior Z3»). */
export function nombreDeAccion(f: Pick<FilaAbpCorte, "accion" | "clase">) {
  if (f.clase === "corner") return "Córner";
  if (f.clase === "penalti") return "Penalti";

  const a = sinTildes(f.accion);

  if (/indirecta/.test(a)) return "Falta indirecta";
  if (/directa/.test(a)) return "Falta directa";
  if (/lateral/.test(a)) return "Falta lateral";

  return "Falta";
}

/** «al primer palo», «al punto de penalti», «2 contra 1». */
function aLaZona(z: string) {
  const s = sinTildes(z);
  const superioridad = s.match(/(\d)\s*v\s*(\d)/);

  if (superioridad) return `${superioridad[1]} contra ${superioridad[2]}`;
  if (!s || /^fuera$|no remate/.test(s)) return "";
  if (/primer/.test(s)) return "al primer palo";
  if (/segundo/.test(s)) return "al segundo palo";
  if (/penalti/.test(s)) return "al punto de penalti";
  if (/6 ?m/.test(s)) return "al área pequeña";
  if (/frontal|fuera de area/.test(s)) return "a la frontal";
  if (/barrera/.test(s)) return "a puerta";

  return "";
}

/** Cómo acabó, en pocas palabras: lo que el rótulo cuenta después del envío. */
export function desenlace(f: FilaAbpCorte) {
  const final = sinTildes(f.final);
  const segundo = sinTildes(f.segundoBalon);

  /* En la hoja de en contra «Gol RMCF» es gol NUESTRO tras salir a la contra, no un gol encajado (abp-arquitectura). */
  if (esGolDeLaAccion(f)) return f.lado === "favor" ? "gol" : "gol en contra";
  if (/gol/.test(final) && f.lado === "contra") return "salimos a la contra y marcamos";
  if (/penalti/.test(final)) return f.lado === "favor" ? "provocamos penalti" : "penalti en contra";
  if (f.tiroDirecto) return f.lado === "favor" ? "tiro directo" : "tiro directo suyo";
  if (f.remate) {
    const quien = f.lado === "favor" && f.rematador ? ` de ${f.rematador}` : "";
    const como = /limpio/i.test(f.tipoRemate) ? " limpio" : /forzado/i.test(f.tipoRemate) ? " forzado" : "";

    return `remate${como}${quien}`;
  }
  if (/ocasion/.test(final)) return "ocasión sin remate";
  if (/transicion/.test(final)) return f.lado === "favor" ? "nos salen a la contra" : "salimos a la contra";
  if (/ganado/.test(segundo)) return f.lado === "favor" ? "sin remate, rechace nuestro" : "despejamos y el rechace es nuestro";
  if (/perdido/.test(segundo)) return f.lado === "favor" ? "sin remate, rechace suyo" : "despejamos, rechace suyo";

  return "sin remate";
}

/** El rótulo del corte: «Córner en contra · 63' · bombeado al área pequeña · remate forzado». */
export function rotuloDeAccion(f: FilaAbpCorte) {
  const envio = /^corto$/i.test(f.envio) ? "en corto" : /^(tenso|bombeado|raso)$/i.test(f.envio) ? minuscula(f.envio) : "";
  const zona = aLaZona(f.zonaCaida);
  const como = envio && zona ? `${envio}${envio === "en corto" ? ", " : " "}${zona}` : envio || zona;

  return [`${nombreDeAccion(f)}${f.lado === "contra" ? " en contra" : ""}`, `${f.minuto}'`, como, desenlace(f)].filter(Boolean).join(" · ");
}

const plural = (n: number, uno: string, varios: string) => `${n} ${n === 1 ? uno : varios}`;

/** ¿Acaba en gol del que saca? «Gol» a secas; el «Gol RMCF» de la hoja de en contra es nuestro, no del que saca. */
export function esGolDeLaAccion(f: Pick<FilaAbpCorte, "final"> & { lado?: LadoAbp }) {
  const t = sinTildes(f.final).trim();

  return /^gol\b/.test(t) && !/rmcf/.test(t);
}

/** Las cifras de un bloque, de la hoja: «3 remates, ningún gol». */
export function resumenDeBloque(filas: Pick<FilaAbpCorte, "remate" | "final">[]) {
  const remates = filas.filter((f) => f.remate).length;
  const goles = filas.filter((f) => esGolDeLaAccion(f)).length;

  return [remates ? plural(remates, "remate", "remates") : "ningún remate", goles ? plural(goles, "gol", "goles") : "ningún gol"].join(", ");
}

/* --------------------- el vídeo de cada acción en pantalla --------------------- */

/*
| EL CORTE Y EL ENLACE A HUDL DE CADA ACCIÓN (04/11/2026).
|
| Las listas de /setpieces y /setpieces_def llevan en cada acción «Ver la
| acción» (nuestro corte) y «Abrir en Hudl · mm:ss». Lo arma
| `scripts/abp-cortes.mjs` en el documento `abp:cortes`: cada fila de la hoja
| casada con su momento de Hudl (`casaConHudl`), el segundo del vídeo de Hudl
| y el corte (el de `informe-clips:jNN` → `abp` si ya estaba; si no, uno
| propio en el bucket). La pantalla encuentra su fila por `claveAccionAbp`.
*/

export const DOC_CORTES_ABP = "abp:cortes";

export type AccionAbpEnVideo = { clave: string; lado: LadoAbp; parte: 1 | 2; minuto: number; accion: string; seg: number; video?: string };

export type PartidoAbpEnVideo = { jornada: number; rival: string; hudl: string; acciones: AccionAbpEnVideo[] };

export type DocCortesAbp = { actualizado: string; jornadas: Record<string, PartidoAbpEnVideo> };

/**
 * La clave de una acción: lado, jornada de liga, minuto y tipo, y cuántas
 * iguales van antes en la hoja (dos córners en el 37' son el #0 y el #1).
 * Sin la parte a propósito: la hoja la escribe de tres maneras y hay filas
 * con la parte mal puesta; el minuto del partido ya la dice.
 */
export function claveAccionAbp(a: { lado: LadoAbp; jornada: number; minuto: number; accion: string }, n = 0) {
  return `${a.lado}|${a.jornada}|${a.minuto}|${sinTildes(limpia(a.accion))}#${n}`;
}

/** Las claves de unas filas EN EL ORDEN DE LA HOJA, con su desempate. */
export function clavesEnOrden<T>(filas: T[], de: (f: T) => { lado: LadoAbp; jornada: number; minuto: number; accion: string } | null): (string | null)[] {
  const vistas = new Map<string, number>();

  return filas.map((f) => {
    const a = de(f);

    if (!a || !Number.isFinite(a.minuto)) return null;

    const base = claveAccionAbp(a);
    const n = vistas.get(base) ?? 0;

    vistas.set(base, n + 1);

    return claveAccionAbp(a, n);
  });
}

/** Lo que pinta cada acción: el corte (si lo hay) y el enlace a Hudl con su segundo. */
export type EnlaceAccionAbp = { video?: string; hudl: { url: string; seg: number } };

/** El documento, por clave de acción. */
export function enlacesDeCortes(doc: DocCortesAbp | null | undefined): Map<string, EnlaceAccionAbp> {
  const salida = new Map<string, EnlaceAccionAbp>();

  for (const p of Object.values(doc?.jornadas ?? {})) {
    if (!p?.hudl) continue;

    for (const a of p.acciones ?? []) if (a.clave) salida.set(a.clave, { ...(a.video ? { video: a.video } : {}), hudl: { url: p.hudl, seg: a.seg } });
  }

  return salida;
}
