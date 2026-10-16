/**
 * LOS APUNTES DE BALÓN PARADO, CON SU VÍDEO (16/10/2026).
 *
 * El analista prepara cada rival tomando notas así —y luego les asocia un
 * vídeo—:
 *
 *     ABP RIVAL
 *         OF
 *             CÓRNER
 *                 26: DOS BLOQUES DESDE ÁREA PEQUEÑA
 *         DEF--
 *             CORNER
 *                 24: ESTRUCTURA DEF
 *
 * y lo mismo de lo nuestro («MIN 19.45: ÁREA PEQUEÑA POR DELANTE!»). Aquí
 * vive el modelo de esos apuntes, el lector que convierte ese texto en
 * apuntes ordenados (`leeApuntes`) y cómo se pasa cada uno a un segundo del
 * vídeo.
 *
 * La referencia de delante (lo eligió el usuario el 16/10/2026):
 *   - «MIN 19.45», «MINUTO 5», «MIN 100» → minuto del partido (19:45, 5:00,
 *     100:00). Salta al vídeo sumando dónde empieza el partido en él.
 *   - «26:», «1:» → número de clip. No se sabe dónde cae en el vídeo hasta
 *     que se marca a mano (`enVideo`), viéndolo.
 *
 * Dónde se guardan, aparte de las láminas para no pisarse con la pantalla de
 * Análisis visual:
 *   - `rival-apuntes:<equipo>` → por jornada, lo del rival.
 *   - `abp-propio:jNN` → lo nuestro de esa jornada (sirve como «partido
 *     anterior» en la semana siguiente y como «contra él» en el post).
 */

import { slugClave } from "@/lib/rivals/media";

export type FaseAbp = "of" | "def";

export type TipoAbp = "corner" | "falta" | "falta-lat" | "banda" | "penalti" | "otro";

export type RefApunte = { clase: "minuto"; seg: number } | { clase: "clip"; n: number };

export type Apunte = {
  id: string;
  fase: FaseAbp;
  tipo: TipoAbp;
  ref: RefApunte | null;
  texto: string;
  /** El segundo del vídeo donde se ve, marcado a mano; manda sobre el minuto. */
  enVideo?: number | null;
};

export type VideoApuntes = {
  tipo: "mp4" | "youtube";
  url: string;
  nombre?: string;
  /** En qué segundo del vídeo empieza el partido (el minuto 0): para saltar por minuto. */
  inicio?: number;
};

export type Cuaderno = { video: VideoApuntes | null; apuntes: Apunte[]; actualizado?: string };

export const CUADERNO_VACIO: Cuaderno = { video: null, apuntes: [] };

export type ApuntesRivalDoc = { jornadas: Record<string, Cuaderno> };

export const APUNTES_RIVAL_VACIO: ApuntesRivalDoc = { jornadas: {} };

export const apuntesRivalKey = (equipo: unknown) => `rival-apuntes:${slugClave(equipo)}`;

export const apuntesPropiosKey = (jornada: number) => `abp-propio:j${String(jornada).padStart(2, "0")}`;

export const APUNTES_KIND = "abp-apuntes";

export const FASES: { id: FaseAbp; titulo: string; deQuien: { rival: string; propio: string } }[] = [
  { id: "of", titulo: "Ofensiva", deQuien: { rival: "Cuando atacan", propio: "Cuando atacamos" } },
  { id: "def", titulo: "Defensiva", deQuien: { rival: "Cuando defienden", propio: "Cuando defendemos" } },
];

export const TIPOS: { id: TipoAbp; titulo: string }[] = [
  { id: "corner", titulo: "Córner" },
  { id: "falta", titulo: "Falta" },
  { id: "falta-lat", titulo: "Falta lateral" },
  { id: "banda", titulo: "Saque de banda" },
  { id: "penalti", titulo: "Penalti" },
  { id: "otro", titulo: "Otros" },
];

export const TITULO_TIPO = new Map(TIPOS.map((t) => [t.id, t.titulo]));

export const nuevoId = () => Math.random().toString(36).slice(2, 10);

/* ------------------------------------------------------------------ */
/*  LEER EL TEXTO TAL Y COMO SE ESCRIBE                                */
/* ------------------------------------------------------------------ */

const plano = (t: string) =>
  t
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toUpperCase()
    .trim();

/** «OF», «DEF--», «OFENSIVA», «EN CONTRA»… → la fase; `null` si la línea no es eso. */
function faseDe(linea: string): FaseAbp | null {
  const p = plano(linea).replace(/[-:.\s]+$/g, "");

  if (/^(OF|OFE|OFENSIV[AO]|ATAQUE|A FAVOR)$/.test(p)) return "of";
  if (/^(DEF|DEFENSIV[AO]|DEFENSA|EN CONTRA)$/.test(p)) return "def";

  return null;
}

/** El tipo con el que empieza una cabecera («CÓRNER :», «FALTAS LAT», «SBO», «SAQUE DE BANDA EN CONTRA: …»). */
function tipoDe(linea: string): { tipo: TipoAbp; resto: string; fase?: FaseAbp } | null {
  const p = plano(linea);
  const reglas: [RegExp, TipoAbp][] = [
    [/^(CORNERS?|CORNER)\b/, "corner"],
    [/^FALTAS?\s+(LAT|LATERAL|LATERALES)\b\.?/, "falta-lat"],
    [/^FALTAS?\b/, "falta"],
    [/^(SBO|SBD|SAQUES?\s+DE\s+BANDA)\b/, "banda"],
    [/^PENALTI(S)?\b/, "penalti"],
  ];

  for (const [re, tipo] of reglas) {
    const m = p.match(re);

    if (!m) continue;

    /* Lo que sigue a la cabecera, en el texto original (con sus tildes). */
    let resto = linea.trim().slice(m[0].length).trim();
    let fase: FaseAbp | undefined;

    /* «SBO» = saque de banda ofensivo; «SBD» o «… EN CONTRA» = defensivo. */
    if (/^SBO/.test(p)) fase = "of";
    if (/^SBD/.test(p)) fase = "def";

    const enContra = resto.match(/^(EN\s+CONTRA|A\s+FAVOR)\b/i);

    if (enContra) {
      fase = /CONTRA/i.test(enContra[0]) ? "def" : "of";
      resto = resto.slice(enContra[0].length).trim();
    }

    return { tipo, resto: resto.replace(/^[:\-–\s]+/, "").trim(), fase };
  }

  return null;
}

/** «MIN 19.45: …», «MINUTO 5 MÁS …», «26: …» → la referencia y el texto. */
export function refDe(texto: string): { ref: RefApunte | null; texto: string } {
  const t = texto.trim();
  const min = t.match(/^MIN(?:UTO)?\.?\s*(\d{1,3})(?:\s*[.:'’,]\s*(\d{1,2}))?\s*'?\s*[:\-–]?\s*(.*)$/i);

  if (min) return { ref: { clase: "minuto", seg: Number(min[1]) * 60 + Number(min[2] ?? 0) }, texto: min[3].trim() };

  const clip = t.match(/^(\d{1,3})\s*[:.)\-–]\s*(.*)$/);

  if (clip) return { ref: { clase: "clip", n: Number(clip[1]) }, texto: clip[2].trim() };

  return { ref: null, texto: t };
}

/** Un apunte vacío o de relleno («-», «NADA»): no se apunta. */
const vacio = (t: string) => !t.trim() || /^[-–—.\s]*$/.test(t) || /^(NADA|NINGUNO|SIN NADA)\.?$/i.test(plano(t));

/**
 * El texto de las notas, convertido en apuntes. Entiende la sangría o no
 * (va por palabras clave): una línea de fase, una de tipo y debajo los
 * apuntes con su referencia. Las líneas que no sabe qué son (títulos como
 * «ABP RIVAL» o «PROPIO IBIZA», rayas) se saltan.
 */
export function leeApuntes(texto: string): Apunte[] {
  const apuntes: Apunte[] = [];
  let fase: FaseAbp = "of";
  let tipo: TipoAbp | null = null;

  for (const cruda of texto.split(/\r?\n/)) {
    const linea = cruda.trim();

    if (!linea || /^[-_=–—\s]+$/.test(linea)) continue;

    const f = faseDe(linea);

    if (f) {
      fase = f;
      tipo = null;
      continue;
    }

    const t = tipoDe(linea);

    if (t) {
      tipo = t.tipo;

      /* Una cabecera con fase propia («SAQUE DE BANDA EN CONTRA») sólo cambia la de su apunte. */
      if (!vacio(t.resto)) {
        const { ref, texto: resto } = refDe(t.resto);

        apuntes.push({ id: nuevoId(), fase: t.fase ?? fase, tipo: t.tipo, ref, texto: resto });
      }

      continue;
    }

    /* Títulos sueltos: «ABP RIVAL», «ABP PROPIO», «PROPIO IBIZA»… */
    if (!tipo && !/^\d|^MIN/i.test(linea)) continue;

    if (vacio(linea)) continue;

    const { ref, texto: resto } = refDe(linea);

    if (vacio(resto) && !ref) continue;

    apuntes.push({ id: nuevoId(), fase, tipo: tipo ?? "otro", ref, texto: resto });
  }

  return apuntes;
}

/* ------------------------------------------------------------------ */
/*  REFERENCIAS Y VÍDEO                                                */
/* ------------------------------------------------------------------ */

export const mmss = (seg: number) => `${Math.floor(seg / 60)}:${String(Math.floor(seg % 60)).padStart(2, "0")}`;

/** «MIN 19:45» o «Clip 26»; vacío si no lleva. */
export const rotuloRef = (ref: RefApunte | null) => (!ref ? "" : ref.clase === "minuto" ? `MIN ${mmss(ref.seg)}` : `Clip ${ref.n}`);

/** El segundo del vídeo en el que se ve un apunte, o `null` si aún no se sabe. */
export function segundoEnVideo(apunte: Apunte, video: VideoApuntes | null): number | null {
  if (!video) return null;

  if (typeof apunte.enVideo === "number") return apunte.enVideo;

  if (apunte.ref?.clase === "minuto") return Math.max(0, (video.inicio ?? 0) + apunte.ref.seg);

  return null;
}

/** El id de un vídeo de YouTube (watch, youtu.be, shorts, embed), o `null`. */
export function idYoutube(url: string) {
  const m = url.match(/(?:youtube\.com\/(?:watch\?(?:.*&)?v=|shorts\/|embed\/|live\/)|youtu\.be\/)([\w-]{11})/);

  return m ? m[1] : null;
}

/** El enlace que abre el vídeo en ese segundo (para el informe y para compartir). */
export function enlaceEnSegundo(video: VideoApuntes, seg: number | null) {
  const s = Math.max(0, Math.floor(seg ?? 0));

  if (video.tipo === "youtube") {
    const id = idYoutube(video.url);

    return id ? `https://www.youtube.com/watch?v=${id}${s ? `&t=${s}s` : ""}` : video.url;
  }

  return s ? `${video.url}#t=${s}` : video.url;
}

/** Los apuntes por fase y tipo, en el orden de las listas de arriba; los grupos vacíos no salen. */
export function agrupa(apuntes: Apunte[]) {
  return FASES.map((f) => ({
    fase: f,
    tipos: TIPOS.map((t) => ({ tipo: t, apuntes: apuntes.filter((a) => a.fase === f.id && a.tipo === t.id) })).filter((g) => g.apuntes.length),
  })).filter((g) => g.tipos.length);
}

/** Lo mismo, como texto (para copiar o para la versión de texto del correo). */
export function apuntesEnTexto(apuntes: Apunte[], deQuien: "rival" | "propio") {
  return agrupa(apuntes)
    .map((g) => [
      `${g.fase.deQuien[deQuien].toUpperCase()}`,
      ...g.tipos.flatMap((t) => [`  ${t.tipo.titulo.toUpperCase()}`, ...t.apuntes.map((a) => `    ${a.ref ? `${rotuloRef(a.ref)}: ` : ""}${a.texto}`)]),
    ].join("\n"))
    .join("\n");
}

/** Lo que llega de la base, saneado (un documento a medias no tumba la pantalla). */
export function normalizaCuaderno(x: unknown): Cuaderno {
  const c = (x && typeof x === "object" ? x : {}) as Partial<Cuaderno>;
  const v = c.video && typeof c.video === "object" && typeof c.video.url === "string" && c.video.url ? c.video : null;

  return {
    video: v ? { tipo: v.tipo === "youtube" ? "youtube" : "mp4", url: v.url, nombre: v.nombre, inicio: typeof v.inicio === "number" ? v.inicio : 0 } : null,
    apuntes: Array.isArray(c.apuntes)
      ? c.apuntes
          .filter((a) => a && typeof a.texto === "string")
          .map((a) => ({
            id: a.id || nuevoId(),
            fase: a.fase === "def" ? "def" : "of",
            tipo: TIPOS.some((t) => t.id === a.tipo) ? a.tipo : "otro",
            ref: a.ref && (a.ref.clase === "minuto" || a.ref.clase === "clip") ? a.ref : null,
            texto: a.texto,
            enVideo: typeof a.enVideo === "number" ? a.enVideo : null,
          }))
      : [],
    actualizado: c.actualizado,
  };
}
