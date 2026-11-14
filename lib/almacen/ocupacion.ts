/**
 * CONTROL DE OCUPACIÓN DEL ALMACÉN DE SUPABASE (07/11/2026).
 *
 * El plan gratis da 1 GB de ficheros. El 07/11/2026 el bucket `performance`
 * estaba en 3,5 GB sin que nadie lo viera: cada reenvío de un informe subía otra
 * copia entera de sus PDF y vídeos (prefijo al azar) y cada jornada añade
 * cortes de vídeo. Este módulo:
 *
 *   - mide lo que ocupa el bucket (recorriendo sus carpetas) y lo guarda en el
 *     documento `almacen:ocupacion`, para Ajustes y la portada;
 *   - barre los adjuntos de correo: los de más de 30 días y las copias
 *     repetidas (del mismo nombre se queda la más reciente);
 *   - decide si cabe una subida: por encima del 95 % del tope se frenan las
 *     subidas grandes (vídeos y cualquier fichero de más de 25 MB). Los PDF y
 *     PowerPoint de los informes pasan siempre: sin ellos no sale el correo.
 *
 * Sólo en el servidor (usa la llave de servicio).
 */

import { createClient, type SupabaseClient } from "@/lib/datos/cliente";

export const BUCKET = "performance";
/** El tope del plan gratis de Supabase: 1 GB de ficheros. */
export const TOPE_MB = 1024;
/** A partir de aquí se avisa en Ajustes y en la portada. */
export const AVISO = 0.8;
/** A partir de aquí se frenan las subidas grandes (si el freno está encendido). */
export const FRENO = 0.95;
/*
| El freno, APAGADO por decisión del usuario (07/11/2026): los cortes de las
| pantallas de análisis se quedan aunque el almacén pase del gratis. Se avisa
| (portada, Ajustes, respuesta de la subida) y se barren los repetidos. Para
| encenderlo: ALMACEN_FRENO=1 en el entorno del servidor.
*/
export const FRENO_ACTIVO = process.env.ALMACEN_FRENO === "1";
/** Lo que siempre pasa aunque esté lleno (los adjuntos de un correo). */
const SIEMPRE_PASA_MB = 25;
export const DOC_OCUPACION = "almacen:ocupacion";
const DIAS_INFORMES = 30;
/** La medida se repite como mucho cada 10 minutos (recorrer el bucket lleva unos segundos). */
const VIGENCIA_MS = 10 * 60_000;

export type Ocupacion = {
  mb: number;
  tope: number;
  ficheros: number;
  /** Las carpetas que más ocupan (dos niveles), de mayor a menor. */
  carpetas: { carpeta: string; mb: number; n: number }[];
  medido: string;
};

let enMemoria: { ocupacion: Ocupacion; hora: number } | null = null;

export function clienteAlmacen(): SupabaseClient | null {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const clave = process.env.SUPABASE_SERVICE_ROLE_KEY;

  return url && clave ? createClient(url, clave, { auth: { persistSession: false } }) : null;
}

type Fichero = { ruta: string; mb: number; creado: string };

async function recorre(sb: SupabaseClient, prefijo: string): Promise<Fichero[]> {
  const salida: Fichero[] = [];

  for (let desde = 0; ; desde += 1000) {
    const { data, error } = await sb.storage.from(BUCKET).list(prefijo, { limit: 1000, offset: desde });

    if (error) throw new Error(`${prefijo || "/"}: ${error.message}`);

    for (const it of data ?? []) {
      const ruta = prefijo ? `${prefijo}/${it.name}` : it.name;

      if (it.id === null) salida.push(...(await recorre(sb, ruta)));
      else salida.push({ ruta, mb: Number(it.metadata?.size ?? 0) / 1048576, creado: it.created_at ?? "" });
    }

    if ((data ?? []).length < 1000) break;
  }

  return salida;
}

/** Mide el bucket y guarda la medida. Con `fresca`, aunque la anterior sea reciente. */
export async function mideOcupacion(sb: SupabaseClient, fresca = false): Promise<Ocupacion> {
  if (!fresca && enMemoria && Date.now() - enMemoria.hora < VIGENCIA_MS) return enMemoria.ocupacion;

  const ficheros = await recorre(sb, "");
  const grupos = new Map<string, { mb: number; n: number }>();

  for (const f of ficheros) {
    const partes = f.ruta.split("/");
    const carpeta = partes.slice(0, Math.min(partes.length - 1, 2)).join("/") || "(raíz)";
    const g = grupos.get(carpeta) ?? { mb: 0, n: 0 };

    g.mb += f.mb;
    g.n += 1;
    grupos.set(carpeta, g);
  }

  const ocupacion: Ocupacion = {
    mb: Math.round(ficheros.reduce((s, f) => s + f.mb, 0) * 10) / 10,
    tope: TOPE_MB,
    ficheros: ficheros.length,
    carpetas: [...grupos.entries()]
      .map(([carpeta, g]) => ({ carpeta, mb: Math.round(g.mb * 10) / 10, n: g.n }))
      .sort((a, b) => b.mb - a.mb)
      .slice(0, 12),
    medido: new Date().toISOString(),
  };

  enMemoria = { ocupacion, hora: Date.now() };
  await sb
    .from("app_documents")
    .upsert({ key: DOC_OCUPACION, kind: "almacen", data: ocupacion, updated_at: ocupacion.medido }, { onConflict: "key" })
    .then(({ error }) => error && console.error("[almacen] guardar medida", error.message));

  return ocupacion;
}

/** La última medida guardada (sin recorrer el bucket). */
export async function ultimaOcupacion(sb: SupabaseClient): Promise<Ocupacion | null> {
  if (enMemoria) return enMemoria.ocupacion;

  const { data } = await sb.from("app_documents").select("data").eq("key", DOC_OCUPACION).maybeSingle();

  return (data?.data as Ocupacion | undefined) ?? null;
}

/**
 * Barre `2026/informes/<día>/`: borra los días de hace más de 30 y, en los
 * demás, las copias repetidas (mismo nombre tras el prefijo al azar; se queda
 * la más reciente y su vista previa). Devuelve los MB liberados.
 */
export async function barreAdjuntos(sb: SupabaseClient): Promise<number> {
  const cubo = sb.storage.from(BUCKET);
  const corte = new Date(Date.now() - DIAS_INFORMES * 86_400_000).toISOString().slice(0, 10);
  const { data: dias } = await cubo.list("2026/informes", { limit: 1000 });
  const fuera: Fichero[] = [];
  const vivos: (Fichero & { base: string })[] = [];

  for (const dia of dias ?? []) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(dia.name)) continue;

    const { data: archivos } = await cubo.list(`2026/informes/${dia.name}`, { limit: 1000 });

    for (const a of archivos ?? []) {
      const f = { ruta: `2026/informes/${dia.name}/${a.name}`, mb: Number(a.metadata?.size ?? 0) / 1048576, creado: a.created_at ?? "" };

      if (dia.name < corte) fuera.push(f);
      else vivos.push({ ...f, base: a.name.replace(/^[a-z0-9]{8}-/, "") });
    }
  }

  /* Las repetidas: del mismo nombre, todas menos la más reciente. */
  const porBase = new Map<string, (Fichero & { base: string })[]>();

  for (const f of vivos) porBase.set(f.base, [...(porBase.get(f.base) ?? []), f]);

  for (const lista of porBase.values()) {
    lista.sort((a, b) => b.creado.localeCompare(a.creado));
    fuera.push(...lista.slice(1));
  }

  for (let i = 0; i < fuera.length; i += 100) {
    const { error } = await cubo.remove(fuera.slice(i, i + 100).map((f) => f.ruta));

    if (error) throw new Error(error.message);
  }

  if (fuera.length) enMemoria = null;

  return fuera.reduce((s, f) => s + f.mb, 0);
}

export type Hueco = { cabe: true; aviso?: string } | { cabe: false; mensaje: string };

const mbTexto = (mb: number) => Math.round(mb).toLocaleString("es-ES");

/**
 * ¿Cabe una subida de `bytes`? Si no, barre los adjuntos y vuelve a medir.
 * Los ficheros pequeños (adjuntos de correo) pasan siempre, con aviso.
 */
export async function hayHueco(sb: SupabaseClient, bytes: number): Promise<Hueco> {
  let ocupacion: Ocupacion;

  try {
    ocupacion = await mideOcupacion(sb);
  } catch (error) {
    /* Si no se puede medir, no se bloquea a nadie. */
    console.error("[almacen] medir", error);

    return { cabe: true };
  }

  const mb = bytes / 1048576;
  const pasaria = (o: Ocupacion) => o.mb + mb <= TOPE_MB * FRENO;

  if (!pasaria(ocupacion)) {
    const liberados = await barreAdjuntos(sb).catch(() => 0);

    if (liberados > 0) ocupacion = await mideOcupacion(sb, true);
  }

  const estado = `${mbTexto(ocupacion.mb)} de ${mbTexto(TOPE_MB)} MB`;

  if (pasaria(ocupacion)) {
    return ocupacion.mb + mb > TOPE_MB * AVISO ? { cabe: true, aviso: `El almacén va por ${estado}: conviene liberar espacio (Ajustes → Almacén).` } : { cabe: true };
  }

  if (!FRENO_ACTIVO) return { cabe: true, aviso: `El almacén pasa del plan gratis (${estado}): conviene liberar espacio (Ajustes → Almacén).` };

  if (mb <= SIEMPRE_PASA_MB) return { cabe: true, aviso: `El almacén está lleno (${estado}). Este fichero pasa, pero hay que liberar espacio (Ajustes → Almacén).` };

  return {
    cabe: false,
    mensaje: `El almacén gratis está lleno (${estado}): no caben ${mb.toFixed(0)} MB más. Libera espacio en Ajustes → Almacén y repite.`,
  };
}
