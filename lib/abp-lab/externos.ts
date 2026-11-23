/**
 * ANÁLISIS EXTERNOS DEL LABORATORIO DE ABP (23/11/2026).
 *
 * Petición del analista: «añade en el laboratorio de ABP una sección con
 * análisis externos que por ahora absorban las publicaciones de @HybridMarking
 * y sus vídeos, y que haya una alerta para mi usuario cuando haya algo nuevo
 * a ver, por lo que todas las mañanas lo revise y lo incorpore sin necesitar
 * reinicio».
 *
 * Cómo llega: cada mañana, al acabar las ideas de X (scripts/x-ideas.mjs, el
 * encargo `x` del vigía), scripts/abp-externos.mjs lee la cuenta con el
 * mismo Chrome de X, junta cada hilo (la publicación y sus respuestas del
 * propio autor), saca los vídeos de la ficha pública de cada publicación y le
 * pide a Claude, sin herramientas que escriban, el análisis en castellano.
 * Todo va al documento `abp-externos` de Supabase: la pantalla lo lee al
 * abrirse, sin publicar ni reiniciar nada.
 *
 * Los vídeos NO se copian: se reproducen desde X (video.twimg.com). Así no
 * gastan nada de Backblaze; si el autor borra una publicación, su vídeo deja
 * de verse y el análisis se queda.
 *
 * Sólo el administrador: la clave está vetada en /api/docs y se lee por
 * /api/abp-lab/externos con la cookie de admin.
 */

import type { Rutina } from "@/lib/abp-lab/modelo";

type TipoAbp = Rutina["tipo"];

export const CLAVE_EXTERNOS = "abp-externos";

export type FuenteExterna = {
  cuenta: string;
  nombre: string;
  /** Quién es, para la cabecera de la sección. */
  quien: string;
};

/** Por ahora una; la pantalla y el script ya van por la lista. */
export const FUENTES_EXTERNAS: readonly FuenteExterna[] = [
  { cuenta: "HybridMarking", nombre: "HybridMarking", quien: "Analista de balón parado (UEFA B), hilos por equipo con vídeo de cada acción" },
];

export type VideoExterno = {
  /** mp4 de unos 360p para verlo en la lista. */
  ligero: string;
  /** El mejor mp4 (720p) para pantalla completa. */
  bueno?: string;
  poster?: string;
  segundos?: number;
};

export type PiezaExterna = {
  id: string;
  url: string;
  fecha: string;
  texto: string;
  imagenes: string[];
  videos: VideoExterno[];
};

export const TIPOS_EXTERNOS = ["corner", "falta", "banda", "penalti", "saque", "segunda", "otro"] as const;
export type TipoExterno = (typeof TIPOS_EXTERNOS)[number];

export const NOMBRE_TIPO: Record<TipoExterno, string> = {
  corner: "Córner",
  falta: "Falta",
  banda: "Saque de banda",
  penalti: "Penalti",
  saque: "Saque de centro",
  segunda: "Segunda jugada",
  otro: "Otro",
};

export type ClipAnalizado = {
  /** Índice de la pieza del hilo (0 = la primera). */
  pieza: number;
  tipo: TipoExterno;
  lado: "ofensivo" | "defensivo";
  /** Qué pasa, en una frase. */
  que: string;
  /** El detalle que lo hace funcionar (bloqueo, arrastre, carrera, señal…). */
  clave: string;
  resultado: "gol" | "remate" | "nada" | null;
};

export type AnalisisExterno = {
  titulo: string;
  equipo: string;
  competicion: string;
  resumen: string;
  clips: ClipAnalizado[];
  principios: string[];
  /** Cómo llevarlo al Castilla: qué probar, qué entrenar, de qué cuidarnos. */
  paraNosotros: string[];
  etiquetas: string[];
};

export type ItemExterno = {
  /** El id de la primera publicación del hilo. */
  id: string;
  cuenta: string;
  url: string;
  fecha: string;
  piezas: PiezaExterna[];
  analisis?: AnalisisExterno;
  /** Cuándo llegó a la app (para «nuevo»). */
  llegoEn: string;
  /** Cuándo se analizó por última vez (se rehace si llegan piezas nuevas). */
  analizadoEn?: string;
  /** Por qué no se pudo analizar, si no se pudo. */
  fallo?: string;
};

export type LecturaFuente = {
  cuenta: string;
  leidoEn: string;
  estado: "ok" | "falta-sesion" | "comprobacion" | "error" | "sin-chrome";
  detalle?: string;
  nuevos?: number;
  vistos: string[];
};

export type DocExternos = {
  items: ItemExterno[];
  lecturas: LecturaFuente[];
  /** Hasta cuándo lo ha visto el analista: lo que llegó después es «nuevo». */
  vistoHasta?: string;
};

export const MAX_ITEMS = 200;

const texto = (x: unknown, max: number) =>
  String(x ?? "")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, max);

const lista = (x: unknown, max: number, largo: number) =>
  (Array.isArray(x) ? x : [])
    .map((v) => texto(v, largo))
    .filter(Boolean)
    .slice(0, max);

/** Sólo enlaces de X que se pueden enseñar sin miedo. */
export const urlDeX = (u: unknown) => {
  const s = String(u ?? "");
  return /^https:\/\/(video\.twimg\.com|pbs\.twimg\.com|x\.com|twitter\.com)\/[\w\-./?=&%:+,~]*$/.test(s) && s.length <= 500 ? s : null;
};

export function normalizaExternos(crudo: unknown): DocExternos {
  const o = (crudo && typeof crudo === "object" ? crudo : {}) as Partial<DocExternos>;
  const items: ItemExterno[] = [];

  for (const i of Array.isArray(o.items) ? o.items : []) {
    if (!i || typeof i !== "object" || !i.id) continue;
    items.push({
      ...i,
      id: String(i.id),
      cuenta: String(i.cuenta ?? ""),
      url: urlDeX(i.url) ?? "",
      fecha: String(i.fecha ?? ""),
      llegoEn: String(i.llegoEn ?? i.fecha ?? ""),
      piezas: (Array.isArray(i.piezas) ? i.piezas : []).map((p) => ({
        id: String(p?.id ?? ""),
        url: urlDeX(p?.url) ?? "",
        fecha: String(p?.fecha ?? ""),
        texto: String(p?.texto ?? "").slice(0, 4000),
        imagenes: (Array.isArray(p?.imagenes) ? p.imagenes : []).map(urlDeX).filter((u): u is string => Boolean(u)),
        videos: (Array.isArray(p?.videos) ? p.videos : [])
          .map((v) => ({ ligero: urlDeX(v?.ligero) ?? "", bueno: urlDeX(v?.bueno) ?? undefined, poster: urlDeX(v?.poster) ?? undefined, segundos: Number(v?.segundos) || undefined }))
          .filter((v) => v.ligero),
      })),
      analisis: i.analisis ? analisisLimpio(i.analisis, (i.piezas ?? []).length) ?? undefined : undefined,
    });
  }

  const lecturas = (Array.isArray(o.lecturas) ? o.lecturas : []).map((l) => ({
    ...l,
    cuenta: String(l?.cuenta ?? ""),
    leidoEn: String(l?.leidoEn ?? ""),
    estado: (["ok", "falta-sesion", "comprobacion", "error", "sin-chrome"] as const).includes(l?.estado) ? l.estado : "error",
    vistos: Array.isArray(l?.vistos) ? l.vistos.map(String).slice(0, 2000) : [],
  }));

  return { items, lecturas, vistoHasta: o.vistoHasta ? String(o.vistoHasta) : undefined };
}

/** Lo más nuevo primero (por la fecha de la publicación). */
export const ordenaExternos = (items: ItemExterno[]) => [...items].sort((a, b) => (Date.parse(b.fecha) || 0) - (Date.parse(a.fecha) || 0));

/** Lo que ha llegado después de la última vez que lo vio el analista. */
export function nuevosDe(doc: DocExternos) {
  const desde = doc.vistoHasta ? Date.parse(doc.vistoHasta) : 0;
  return doc.items.filter((i) => i.analisis && (Date.parse(i.llegoEn) || 0) > desde);
}

/** El análisis que contesta Claude, comprobado: si no tiene forma, null. */
export function analisisLimpio(crudo: unknown, piezas: number): AnalisisExterno | null {
  if (!crudo || typeof crudo !== "object") return null;
  const o = crudo as Record<string, unknown>;
  const titulo = texto(o.titulo, 140);
  const resumen = texto(o.resumen, 900);
  if (!titulo || !resumen) return null;

  const clips: ClipAnalizado[] = (Array.isArray(o.clips) ? o.clips : [])
    .map((c) => {
      const k = (c ?? {}) as Record<string, unknown>;
      const pieza = Math.round(Number(k.pieza));
      const tipo = TIPOS_EXTERNOS.includes(k.tipo as TipoExterno) ? (k.tipo as TipoExterno) : "otro";
      const resultado: ClipAnalizado["resultado"] = k.resultado === "gol" || k.resultado === "remate" || k.resultado === "nada" ? k.resultado : null;
      return {
        pieza,
        tipo,
        lado: k.lado === "defensivo" ? ("defensivo" as const) : ("ofensivo" as const),
        que: texto(k.que, 300),
        clave: texto(k.clave, 300),
        resultado,
      };
    })
    .filter((c) => Number.isInteger(c.pieza) && c.pieza >= 0 && c.pieza < Math.max(1, piezas) && c.que)
    .slice(0, 40);

  return {
    titulo,
    equipo: texto(o.equipo, 80),
    competicion: texto(o.competicion, 80),
    resumen,
    clips,
    principios: lista(o.principios, 8, 300),
    paraNosotros: lista(o.paraNosotros, 6, 300),
    etiquetas: lista(o.etiquetas, 10, 40),
  };
}

/** Saca el JSON de la respuesta de Claude (el primer objeto que se lea). */
export function analisisDeRespuesta(respuesta: string, piezas: number): AnalisisExterno | null {
  const t = respuesta.replace(/```(?:json)?/g, "");
  const ini = t.indexOf("{");
  const fin = t.lastIndexOf("}");
  if (ini < 0 || fin <= ini) return null;
  try {
    return analisisLimpio(JSON.parse(t.slice(ini, fin + 1)), piezas);
  } catch {
    return null;
  }
}

/** El tipo del Taller que mejor encaja (lo que no es de ninguno, córner). */
export const tipoTaller = (t: TipoExterno): TipoAbp => (t === "falta" || t === "banda" || t === "penalti" || t === "saque" ? t : "corner");
