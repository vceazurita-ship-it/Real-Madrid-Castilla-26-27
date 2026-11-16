/**
 * EL RESUMEN OFICIAL DEL PARTIDO DE UN GOL (16/11/2026).
 *
 * «Los enlaces a todos los goles de todos los rivales»: el vídeo exacto de un
 * gol no existe (los resúmenes de la RFEF no traen capítulos, subtítulos ni
 * reloj, y ni Opta ni Wyscout dejan enlazar un clip; ver memoria
 * youtube-segundo-exacto). Lo que sí hay es el resumen de cada partido en el
 * canal de la RFEF, donde salen sus goles. Aquí se busca el de un partido a
 * partir de los dos equipos (como los escriba Opta) y la fecha.
 *
 * Los nombres no coinciden («Atl Madrileño», «RM Castilla», «R. Majadahonda»,
 * «Gimnàstic»): cada equipo se reconoce por sus palabras propias, quitando las
 * genéricas (real, club, cf, ud…). Si se han enfrentado dos veces (ida y
 * vuelta), la fecha decide: la ida es la jornada más baja.
 */

import { desnuda } from "@/lib/rivals/youtube-listas";
import type { ResumenRfef } from "@/lib/rivals/resumenes-rfef";

const GENERICAS = new Set(["real", "club", "cf", "cd", "ud", "ad", "sd", "ce", "ue", "rc", "rcd", "sad", "fc", "cp", "de", "del", "la", "el", "b", "r", "rm", "atl", "atletico", "madrid", "ind", "industrial"]);

/* Opta llama a los filiales «… II»; la RFEF, por su nombre de filial. */
const FILIALES: [RegExp, string][] = [
  [/\breal madrid ii\b/, "castilla"],
  [/\bdeportivo( de a coruna)? ii\b/, "fabril"],
  [/\bathletic( club| bilbao)? ii\b/, "athletic"],
  [/\bvillarreal ii\b/, "villarreal"],
];

const palabras = (nombre: string) => {
  const d = desnuda(nombre);
  const filial = FILIALES.find(([re]) => re.test(d));

  return (filial ? filial[1] : d).split(" ").filter((p) => p.length > 1 && !GENERICAS.has(p));
};

/** ¿Son el mismo equipo? Basta una palabra propia en común («madrileno», «castilla», «majadahonda»…). */
export function mismoEquipo(a: string, b: string) {
  const pa = new Set(palabras(a));

  return palabras(b).some((p) => pa.has(p) || [...pa].some((q) => q.length > 5 && p.length > 5 && (q.startsWith(p) || p.startsWith(q))));
}

/** El resumen del partido entre `a` y `b` jugado el día `fecha` (AAAA-MM-DD), o null. */
export function resumenDelPartido(resumenes: ResumenRfef[], a: string, b: string, fecha: string): ResumenRfef | null {
  const dia = Date.parse(`${String(fecha).slice(0, 10)}T12:00:00Z`);

  if (!Number.isFinite(dia)) return null;

  /* La temporada empieza en julio: un partido de enero de 2027 es de la 2026/27. */
  const d = new Date(dia);
  const temporada = d.getUTCMonth() >= 6 ? d.getUTCFullYear() : d.getUTCFullYear() - 1;

  const candidatos = resumenes
    .filter((r) => r.temporada === temporada)
    .filter((r) => (mismoEquipo(r.local, a) && mismoEquipo(r.visitante, b)) || (mismoEquipo(r.local, b) && mismoEquipo(r.visitante, a)))
    .sort((x, y) => x.jornada - y.jornada);

  if (candidatos.length <= 1) return candidatos[0] ?? null;

  /* Ida y vuelta: la primera vuelta acaba hacia mediados de enero (19 jornadas). */
  const mitad = Date.parse(`${temporada + 1}-01-15T12:00:00Z`);

  return dia < mitad ? candidatos[0] : candidatos[candidatos.length - 1];
}

export const urlResumen = (r: ResumenRfef) => `https://www.youtube.com/watch?v=${encodeURIComponent(r.id)}`;

/* La descarga, una vez por pestaña (la misma ruta que usa la ficha del rival). */
let enVuelo: Promise<ResumenRfef[]> | null = null;

export function cargaResumenesRfef(): Promise<ResumenRfef[]> {
  enVuelo ??= fetch("/api/rivals/resumenes")
    .then((r) => r.json() as Promise<{ ok?: boolean; videos?: ResumenRfef[] }>)
    .then((j) => (j?.ok && Array.isArray(j.videos) ? j.videos : []))
    .catch(() => {
      enVuelo = null;

      return [];
    });

  return enVuelo;
}
