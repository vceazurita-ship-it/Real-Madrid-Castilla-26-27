/**
 * EL RESPALDO DE OPTA EN EL SERVIDOR (17/11/2026).
 *
 * Lee los documentos de Opta (≈ 12 MB entre balón parado, remates y los
 * directos de cada partido), arma el respaldo con `calculaRespaldo` y lo
 * guarda en memoria 15 minutos: al navegador sólo le llega lo del Castilla y
 * lo que pide cada pantalla (/api/opta/respaldo).
 */

import { readDoc } from "@/lib/docStore";
import { CASTILLA_OPTA, DOCS_OPTA, type TablaOpta } from "@/lib/opta";
import { CLAVE_CALENDARIO } from "@/lib/castilla/calendario";
import { calculaRespaldo, type ClipsVideo, type DocDirecto, type JornadaCalendario } from "./calcula";
import type { RespaldoOpta } from "./tipos";

/** Los cortes de las acciones que baja `scripts/opta-acciones-video.mjs`. */
export const DOC_ACCIONES_VIDEO = "opta:acciones-video";
const DOC_GOLES_VIDEO = "opta:goles-video";

const VIDA = 15 * 60_000;
const VIDA_CORTA = 30_000;
let incompleto = false;
let guardado: { en: number; datos: RespaldoOpta; incompleto: boolean } | null = null;
let enCurso: Promise<RespaldoOpta> | null = null;

const lee = async <T>(clave: string): Promise<T | null> => {
  try {
    return (await readDoc<T>(clave)).data;
  } catch {
    return null;
  }
};

async function arma(): Promise<RespaldoOpta> {
  const [partidos, abpEventos, remates, jugadores, castilla, acciones, goles, calendario] = await Promise.all([
    lee<TablaOpta>(DOCS_OPTA.partidos),
    lee<TablaOpta>(DOCS_OPTA.abpEventos),
    lee<TablaOpta>(DOCS_OPTA.remates),
    lee<TablaOpta>(DOCS_OPTA.jugadores),
    lee<TablaOpta>(DOCS_OPTA.castilla),
    lee<{ clips?: ClipsVideo }>(DOC_ACCIONES_VIDEO),
    lee<{ clips?: ClipsVideo }>(DOC_GOLES_VIDEO),
    lee<{ partidos?: JornadaCalendario[] }>(CLAVE_CALENDARIO),
  ]);

  /* Un hipo de la base no se guarda 15 minutos (17/11/2026): sin lo básico, vida corta. */
  incompleto = !partidos || !abpEventos;

  /* Los partidos del Castilla, para pedir su directo (uno por partido). */
  const c = partidos?.cols.indexOf("teamId") ?? -1;
  const p = partidos?.cols.indexOf("partido") ?? -1;
  const ids = [...new Set((partidos?.filas ?? []).filter((f) => f[c] === CASTILLA_OPTA).map((f) => String(f[p])))];
  const directos: Record<string, DocDirecto> = {};
  await Promise.all(ids.map(async (id) => (directos[id] = await lee<DocDirecto>(DOCS_OPTA.directo(id)))));

  return calculaRespaldo({
    partidos,
    abpEventos,
    remates,
    jugadores: [jugadores, castilla].filter((t): t is TablaOpta => Boolean(t?.cols)),
    directos,
    clips: { ...(goles?.clips ?? {}), ...(acciones?.clips ?? {}) },
    calendario: Array.isArray(calendario?.partidos) ? calendario.partidos : [],
  });
}

export async function respaldoOpta(): Promise<RespaldoOpta> {
  if (guardado && Date.now() - guardado.en < (guardado.incompleto ? VIDA_CORTA : VIDA)) return guardado.datos;
  enCurso ??= arma()
    .then((datos) => {
      guardado = { en: Date.now(), datos, incompleto };
      return datos;
    })
    .finally(() => {
      enCurso = null;
    });
  return enCurso;
}
