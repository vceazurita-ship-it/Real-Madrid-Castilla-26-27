/**
 * EL ANÁLISIS DE UN ENTRENAMIENTO (16/10/2026; terminado el 19/10/2026 y
 * abierto al cuerpo técnico en /analisis-entrenamiento).
 *
 * El analista sube el entrenamiento del día a Hudl (con la fecha en el título)
 * y, cuando la hay, deja la grabación de la cámara táctica en
 * `C:\Users\Usuario\Downloads\RMCF CASTILLA\SESIONES`. En la pantalla define
 * objetivos —uno o varios jugadores, qué se busca, cómo reconocerlos en el
 * vídeo y qué es correcto o mejorable— y pide el análisis. El ordenador del
 * club (`scripts/entreno/analiza-entreno.mjs`, encargo `entreno` del vigía)
 * busca el vídeo, Gemini propone las acciones de cada objetivo con su
 * veredicto, se cortan clips de ejemplo y se cuentan. El analista valida o
 * corrige cada acción: los números finales salen de lo validado.
 *
 * Dos documentos por día, separados para no pisarse:
 *   - `entreno:AAAA-MM-DD` → lo que escribe la pantalla (objetivos y validaciones).
 *   - `entreno-analisis:AAAA-MM-DD` → lo que escribe el ordenador del club.
 */

export type JugadorObjetivo = { id: string; nombre: string };

export type ObjetivoEntreno = {
  id: string;
  jugadores: JugadorObjetivo[];
  /** «Perfilarse antes de recibir para jugar hacia delante». */
  objetivo: string;
  /** Cómo encontrarlos en el vídeo: «peto naranja, dorsal 8», «el lateral izquierdo del equipo de blanco». */
  reconocer?: string;
  /** Qué cuenta como acción correcta y qué como mejorable (lo que lee la IA para decidir). */
  correcto?: string;
  mejorable?: string;
  /** Si sólo interesa una tarea o un tramo: «rondo 6v3», «del minuto 20 al 45». */
  donde?: string;
  /*
  | Lo que se añadió el 19/10/2026 (opcional: los objetivos guardados antes
  | siguen valiendo tal cual). Sólo `tarea` entra en `huellaObjetivo`, y sólo
  | sin «Mirar sólo en»: desde el 21/10/2026 se le pasa a la IA como pista.
  | El resto no cambia lo que mira la IA y tocarlo no pide volver a analizar.
  */
  /** La tarea del registro del día en la que mirarlo: «L-T1». */
  tarea?: string;
  /** Cómo se llama esa tarea en el registro, copiado al elegirla: «Rondo 6v3 + 2». */
  tareaTexto?: string;
  /** El porcentaje de correctas que se pide (1-100): con él se dice si se cumple. */
  meta?: number;
  /** De dónde sale el objetivo: «Seguimiento individual», «Qué toca · post J8»… */
  origen?: string;
};

export type Veredicto = "correcta" | "mejorable";

/** Lo que decide el analista sobre una acción propuesta. */
export type Validacion = Veredicto | "descartada";

export type SesionEntreno = {
  objetivos: ObjetivoEntreno[];
  /** Por id de acción: lo que dijo el analista (manda sobre la IA). */
  validaciones?: Record<string, Validacion>;
  /** Notas generales de la sesión. */
  notas?: string;
  /*
  | El sello de cada validación (30/10/2026): el `hechoEn` del análisis que se
  | estaba mirando al validar. Los ids de acción son «objetivo-segundo», así que
  | al volver a analizar una acción NUEVA podía heredar el veredicto que se le
  | dio a otra del análisis anterior en el mismo segundo. Con el sello, una
  | validación sólo vale para el análisis en el que se hizo. Las de antes del
  | sello (sin él) siguen valiendo tal cual.
  */
  validadoEn?: Record<string, string>;
};

export const SESION_VACIA: SesionEntreno = { objetivos: [], validaciones: {} };

export type AccionEntreno = {
  id: string;
  objetivoId: string;
  /** Segundos desde el principio del vídeo analizado. */
  inicio: number;
  fin: number;
  veredicto: Veredicto;
  /** Quién (como lo describió la IA) y por qué ese veredicto. */
  jugador?: string;
  explicacion: string;
  /** El clip cortado (bucket), si se cortó: no se corta todo, sólo ejemplos. */
  clip?: string | null;
};

export type ResumenObjetivo = { objetivoId: string; total: number; correctas: number; mejorables: number };

export type AnalisisEntreno = {
  fecha: string;
  hechoEn: string;
  fuente: { tipo: "camara" | "hudl"; nombre: string; duracion: number; url?: string | null };
  acciones: AccionEntreno[];
  resumen: ResumenObjetivo[];
  /** Lo que conviene saber (partes que la IA no pudo leer, cuota agotada…). */
  avisos: string[];
  /** Los objetivos tal y como estaban al analizar: si luego cambian, se avisa. */
  objetivosAnalizados: string[];
  /** Sólo en pantalla (normalizaAnalisis): cuántas acciones repetidas se juntaron en una. */
  repetidas?: number;
};

export const claveSesion = (fecha: string) => `entreno:${fecha}`;
export const claveAnalisis = (fecha: string) => `entreno-analisis:${fecha}`;
export const KIND_ENTRENO = "entreno";

/** Una huella de los objetivos (lo que importa para el análisis) para saber si han cambiado desde el último. */
export const huellaObjetivo = (o: ObjetivoEntreno) =>
  [o.id, o.objetivo.trim(), o.jugadores.map((j) => j.id).sort().join(","), (o.reconocer ?? "").trim(), (o.correcto ?? "").trim(), (o.mejorable ?? "").trim(), (o.donde ?? "").trim(), ...(!(o.donde ?? "").trim() && o.tarea ? [`t:${o.tarea.trim()}`] : [])].join("|");

/** El veredicto que vale: el del analista si lo hay; si no, el de la IA. `null` = descartada. */
export function veredictoFinal(a: AccionEntreno, validaciones: Record<string, Validacion> | undefined): Veredicto | null {
  const v = validaciones?.[a.id];

  if (v === "descartada") return null;

  return v ?? a.veredicto;
}

/**
 * Con menos acciones que esto no se da porcentaje (19/10/2026): un 67 % de
 * tres acciones se leía igual que uno de cuarenta. Por debajo, «tendencia».
 */
export const MINIMO_PORCENTAJE = 8;

export type Cuentas = {
  /** Las que cuentan (Y): todas menos las descartadas. */
  total: number;
  correctas: number;
  mejorables: number;
  /** De las que cuentan, cuántas ha validado alguien (Z). Las demás van con lo que dijo la IA. */
  validadas: number;
  /** Las que siguen como las dejó la IA, sin que nadie las mire (descartadas aparte). */
  porValidar: number;
  descartadas: number;
  /** Lo que propuso la IA, descartadas incluidas. */
  propuestas: number;
  /** El porcentaje de correctas, sólo con `MINIMO_PORCENTAJE` acciones o más. */
  pct: number | null;
  /** El porcentaje aunque la muestra sea corta (para la barra y para comparar). */
  pctBruto: number | null;
  muestraCorta: boolean;
};

/** Las cuentas de un conjunto de acciones con lo validado. */
export function cuentasDe(suyas: AccionEntreno[], validaciones: Record<string, Validacion> | undefined): Cuentas {
  const vigentes = suyas.filter((a) => veredictoFinal(a, validaciones) !== null);
  const correctas = vigentes.filter((a) => veredictoFinal(a, validaciones) === "correcta").length;
  const validadas = vigentes.filter((a) => validaciones?.[a.id]).length;
  const pctBruto = vigentes.length ? Math.round((100 * correctas) / vigentes.length) : null;

  return {
    total: vigentes.length,
    correctas,
    mejorables: vigentes.length - correctas,
    validadas,
    porValidar: suyas.filter((a) => !validaciones?.[a.id]).length,
    descartadas: suyas.length - vigentes.length,
    propuestas: suyas.length,
    pct: vigentes.length >= MINIMO_PORCENTAJE ? pctBruto : null,
    pctBruto,
    muestraCorta: vigentes.length > 0 && vigentes.length < MINIMO_PORCENTAJE,
  };
}

/** Las cuentas de un objetivo con lo validado. */
export function cuentas(objetivoId: string, acciones: AccionEntreno[], validaciones: Record<string, Validacion> | undefined) {
  return cuentasDe(
    acciones.filter((a) => a.objetivoId === objetivoId),
    validaciones,
  );
}

/**
 * La cuenta, dicha siempre igual (19/10/2026): «9 de 14 correctas (11
 * validadas)». Con muestra corta no hay porcentaje: «tendencia».
 */
export function lecturaCuentas(c: Cuentas) {
  if (!c.total) return "Ninguna acción cuenta";

  const validadas = c.validadas === c.total ? "todas validadas" : c.validadas === 0 ? "ninguna validada" : `${c.validadas} validada${c.validadas === 1 ? "" : "s"}`;
  const base = `${c.correctas} de ${c.total} correctas (${validadas})`;

  return c.pct !== null ? `${base} · ${c.pct} %` : `${base} · tendencia`;
}

/** El porcentaje o, con muestra corta, la palabra «tendencia». */
export const porcentajeOTendencia = (c: Cuentas) => (c.pct !== null ? `${c.pct} %` : c.total ? "Tendencia" : "");

/** ¿Llega a la meta? `null` si no hay meta o la muestra no deja decirlo. */
export function cumpleMeta(c: Cuentas, meta: number | undefined): boolean | null {
  if (!meta || c.pct === null) return null;

  return c.pct >= meta;
}

export const mmss = (s: number) => `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, "0")}`;

export const nuevoId = () => Math.random().toString(36).slice(2, 10);

export function normalizaSesion(x: unknown): SesionEntreno {
  const s = (x && typeof x === "object" ? x : {}) as Partial<SesionEntreno>;

  return {
    objetivos: Array.isArray(s.objetivos)
      ? s.objetivos
          .filter((o) => o && typeof o.objetivo === "string")
          /* Sin id, uno fijo por su sitio: uno al azar cambiaría en cada pintado y la edición iría a parar a otro. */
          .map((o, i) => ({
            ...o,
            id: o.id || `obj-${i}`,
            jugadores: Array.isArray(o.jugadores) ? o.jugadores.filter((j) => j && j.id) : [],
            /* La meta, sólo si es un número con sentido: un texto o un 0 la quitan en vez de romper la cuenta. */
            meta: typeof o.meta === "number" && o.meta >= 1 && o.meta <= 100 ? Math.round(o.meta) : undefined,
          }))
      : [],
    validaciones: s.validaciones && typeof s.validaciones === "object" ? s.validaciones : {},
    notas: typeof s.notas === "string" ? s.notas : "",
    ...(s.validadoEn && typeof s.validadoEn === "object" ? { validadoEn: s.validadoEn } : {}),
  };
}

/* ------------------------------------------------------------------ */
/*  LO QUE VALE DE VERDAD (30/10/2026)                                 */
/* ------------------------------------------------------------------ */

/*
| La revisión de fiabilidad del 30/10/2026. Antes cada parte de la pantalla
| decidía por su cuenta qué acciones contaban (el detalle contaba las de un
| objetivo vaciado, el panel no) y leía el documento del análisis tal cual
| (un campo que faltara rompía la página). Desde aquí todo pasa por:
|
|   - `normalizaAnalisis`: el documento del ordenador del club, saneado y sin
|     acciones repetidas.
|   - `validacionesVigentes` / `sesionVigente`: sólo las validaciones que son
|     de ESTE análisis.
|   - `objetivoMedido` / `accionesQueCuentan`: la misma regla de qué entra.
*/

/** Lo que dura cada parte que mira el análisis (scripts/entreno/analiza-entreno.mjs, PARTE_S). */
export const PARTE_S = 20 * 60;

const numero = (x: unknown) => (typeof x === "number" && Number.isFinite(x) ? x : null);

/** ¿Son la misma acción? Mismo objetivo, mismo veredicto y casi el mismo segundo (o a caballo entre dos partes). */
function mismaAccion(a: AccionEntreno, b: AccionEntreno) {
  if (a.objetivoId !== b.objetivoId || a.veredicto !== b.veredicto) return false;

  const distancia = Math.abs(b.inicio - a.inicio);
  const quienA = (a.jugador ?? "").trim().toLowerCase();
  const quienB = (b.jugador ?? "").trim().toLowerCase();

  /* Dentro de una parte: el mismo jugador nombrado y a 2 s o menos. */
  if (distancia <= 2 && quienA === quienB) return true;

  /* En el corte entre dos partes cada una ve un trozo de la misma jugada y la cuenta: hasta 8 s, si no nombran a dos jugadores distintos. */
  if (Math.floor(a.inicio / PARTE_S) === Math.floor(b.inicio / PARTE_S) || distancia > 8) return false;

  const palabras = (t: string) => new Set(t.split(/[^a-záéíóúüñ0-9]+/).filter((p) => p.length >= 3));
  const pa = palabras(quienA);
  const pb = palabras(quienB);

  return !pa.size || !pb.size || [...pa].some((p) => pb.has(p));
}

/**
 * El documento `entreno-analisis:` saneado. `null` si no hay nada.
 *
 * Acciones sin objetivo o sin minuto, fuera; el fin nunca antes del inicio; y
 * las repetidas (la misma jugada contada dos veces, sobre todo en el corte
 * entre dos partes de 20 min) se cuentan una vez, quedándose la que tiene clip.
 */
export function normalizaAnalisis(x: unknown): AnalisisEntreno | null {
  if (!x || typeof x !== "object") return null;

  const a = x as Partial<AnalisisEntreno>;
  const crudas: unknown[] = Array.isArray(a.acciones) ? a.acciones : [];
  const limpias: AccionEntreno[] = [];

  for (const cruda of crudas) {
    if (!cruda || typeof cruda !== "object") continue;

    const c = cruda as Partial<AccionEntreno>;
    const inicio = numero(c.inicio);

    if (typeof c.id !== "string" || !c.id || typeof c.objetivoId !== "string" || inicio === null || inicio < 0) continue;

    const fin = numero(c.fin);

    limpias.push({
      id: c.id,
      objetivoId: c.objetivoId,
      inicio,
      fin: fin !== null && fin > inicio ? fin : inicio + 6,
      veredicto: c.veredicto === "mejorable" ? "mejorable" : "correcta",
      ...(typeof c.jugador === "string" && c.jugador.trim() ? { jugador: c.jugador.trim() } : {}),
      explicacion: typeof c.explicacion === "string" ? c.explicacion.trim() : "",
      clip: typeof c.clip === "string" && c.clip ? c.clip : null,
    });
  }

  limpias.sort((p, q) => p.inicio - q.inicio);

  /* Sin repetidas: la primera de cada jugada, salvo que la repetida traiga el clip. */
  const unicas: AccionEntreno[] = [];
  const vistos = new Set<string>();
  let repetidas = 0;

  for (const c of limpias) {
    if (vistos.has(c.id)) {
      repetidas += 1;
      continue;
    }

    vistos.add(c.id);

    let k = -1;

    for (let i = unicas.length - 1; i >= 0 && c.inicio - unicas[i].inicio <= 8; i -= 1)
      if (mismaAccion(unicas[i], c)) {
        k = i;
        break;
      }

    if (k >= 0) {
      repetidas += 1;
      if (c.clip && !unicas[k].clip) unicas[k] = c;
      continue;
    }

    unicas.push(c);
  }

  const fuente = (a.fuente && typeof a.fuente === "object" ? a.fuente : {}) as Partial<AnalisisEntreno["fuente"]>;

  return {
    fecha: typeof a.fecha === "string" ? a.fecha : "",
    hechoEn: typeof a.hechoEn === "string" ? a.hechoEn : "",
    fuente: {
      tipo: fuente.tipo === "camara" ? "camara" : "hudl",
      nombre: typeof fuente.nombre === "string" ? fuente.nombre : "",
      duracion: Math.max(0, numero(fuente.duracion) ?? 0),
      url: typeof fuente.url === "string" && fuente.url ? fuente.url : null,
    },
    acciones: unicas,
    resumen: Array.isArray(a.resumen) ? a.resumen : [],
    avisos: Array.isArray(a.avisos) ? a.avisos.filter((t): t is string => typeof t === "string" && Boolean(t.trim())) : [],
    objetivosAnalizados: Array.isArray(a.objetivosAnalizados) ? a.objetivosAnalizados.filter((h): h is string => typeof h === "string") : [],
    ...(repetidas ? { repetidas } : {}),
  };
}

/** Las validaciones que valen para este análisis: las de sus acciones y, si llevan sello, con el suyo. */
export function validacionesVigentes(sesion: SesionEntreno, analisis: AnalisisEntreno | null): Record<string, Validacion> {
  const todas = sesion.validaciones ?? {};

  if (!analisis) return todas;

  const ids = new Set(analisis.acciones.map((a) => a.id));
  const sello = sesion.validadoEn ?? {};
  const vigentes: Record<string, Validacion> = {};

  for (const [id, v] of Object.entries(todas)) if (ids.has(id) && (!sello[id] || !analisis.hechoEn || sello[id] === analisis.hechoEn)) vigentes[id] = v;

  return vigentes;
}

/** Cuántas validaciones se hicieron sobre un análisis anterior y ya no cuentan. */
export function validacionesAnteriores(sesion: SesionEntreno, analisis: AnalisisEntreno | null) {
  if (!analisis?.hechoEn) return 0;

  const sello = sesion.validadoEn ?? {};
  const ids = new Set(analisis.acciones.map((a) => a.id));

  return Object.keys(sesion.validaciones ?? {}).filter((id) => ids.has(id) && sello[id] && sello[id] !== analisis.hechoEn).length;
}

/** La sesión con sólo las validaciones vigentes: es la que leen todas las cuentas. */
export const sesionVigente = (sesion: SesionEntreno, analisis: AnalisisEntreno | null): SesionEntreno => ({ ...sesion, validaciones: validacionesVigentes(sesion, analisis) });

/** ¿Entró este objetivo en el análisis? (con su id; si luego cambió el texto, lo dice `huellaObjetivo`). */
export const objetivoMedido = (o: ObjetivoEntreno, analisis: AnalisisEntreno | null) => Boolean(o.objetivo.trim() && analisis?.objetivosAnalizados.some((h) => h.startsWith(`${o.id}|`)));

/** Las acciones que cuentan en el día: las de objetivos que siguen en la sesión, con texto y medidos (descartadas incluidas: se apartan con el veredicto). */
export function accionesQueCuentan(sesion: SesionEntreno, analisis: AnalisisEntreno | null) {
  if (!analisis) return [];

  const medidos = new Set(sesion.objetivos.filter((o) => objetivoMedido(o, analisis)).map((o) => o.id));

  return analisis.acciones.filter((a) => medidos.has(a.objetivoId));
}

/*
| Los avisos del análisis, legibles (30/10/2026). El script los escribe para
| el administrador («la parte 2 (min 20-40) no se ha podido mirar: <error del
| motor>»); en pantalla no se nombra ningún motor y lo que importa es qué
| minutos se quedaron sin mirar, porque ahí no puede haber acciones.
*/

/** Quita los nombres de motores de un texto que viene del ordenador del club. */
export const sinMotores = (t: string) =>
  t
    .replace(/\b(gemini|claude|anthropic|openai|chatgpt|gpt|genai|google\s*ai)[\w.\-/]*/gi, "análisis automático")
    .replace(/\bla IA\b/g, "el análisis automático")
    .replace(/\bIA\b/g, "análisis automático");

/** Los tramos (en segundos) que el análisis no pudo mirar. */
export function tramosSinMirar(avisos: string[]) {
  return avisos.flatMap((t) => {
    const m = /parte\s+\d+\s*\(min\s*(\d+)\s*-\s*(\d+)\)\s*no se ha podido mirar/i.exec(t);

    return m ? [{ desde: Number(m[1]) * 60, hasta: Number(m[2]) * 60 }] : [];
  });
}

/** Un aviso, dicho para el cuerpo técnico. */
export function avisoLegible(t: string) {
  const parte = /parte\s+\d+\s*\(min\s*(\d+)\s*-\s*(\d+)\)\s*no se ha podido mirar/i.exec(t);

  if (parte) return `Del minuto ${parte[1]} al ${parte[2]} no se ha podido analizar: ese tramo no tiene acciones.`;

  const clip = /un clip\s*\((\d+)'\)\s*no se ha podido cortar/i.exec(t);

  if (clip) return `El clip del minuto ${clip[1]} no se ha podido cortar: esa acción se ve por su minuto.`;

  return sinMotores(t.split(": ")[0]).replace(/^./, (l) => l.toUpperCase());
}

/** «12 de 20»: la cuenta con su base, siempre igual. */
export const deBase = (parte: number, total: number) => `${parte} de ${total}`;
