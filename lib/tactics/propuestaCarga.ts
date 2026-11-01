/*
|--------------------------------------------------------------------------
| LO QUE NECESITA LA PROPUESTA DE ONCE, LEÍDO (01/11/2026)
|--------------------------------------------------------------------------
|
| Sólo lectura (GET): Wyscout (`/api/data-analisis`, el mismo que ya pide la
| pizarra para los onces de la semana), las plantillas rivales, el once
| probable del rival y lo cambiado en Duelos, la hoja emocional con la capa
| editada en /emotion y las Valoraciones. Su once sale con las MISMAS
| funciones que /duelos (`lib/duelos-onces`).
|
| El lector se puede cambiar: el arnés de Node lo pasa leyendo ficheros.
*/

import Papa from "papaparse";

import { aplicaEdiciones, normalizaDocEmocional, CLAVE_DOC_EMOCIONAL, type Player as FilaEmocionalHoja } from "@/app/emotion/modelo";
import { normalizaDuelos } from "@/lib/duelos";
import { baseSuyaDe, onceSuyoDe, suyosDe } from "@/lib/duelos-onces";
import type { FilaJugador, FilaPartido } from "@/lib/data-analisis/leer";
import { isHiddenPlayer } from "@/lib/hiddenPlayers";
import { traeCsv, traeJson } from "@/lib/hojaCsv";
import type { RatingsSeason } from "@/lib/ratings/types";
import { findInforme, type InformeDoc } from "@/lib/rivals/informe";
import { slugClave } from "@/lib/rivals/media";
import { mismoClub } from "@/lib/rivals/mismoClub";
import { normalizarOnce, rivalOnceKey } from "@/lib/rivals/once";
import type { Player } from "@/types/player";

import type { DatosPropuesta, FilaEmocional } from "./propuestaOnce";

type Fila = Record<string, unknown>;

export type Lector = {
  json: <T>(url: string) => Promise<T | null>;
  csv: (url: string) => Promise<string>;
};

const texto = (v: unknown) => String(v ?? "").trim();

/** La hoja emocional publicada (la misma de /emotion). */
export const CSV_EMOCIONAL =
  "https://docs.google.com/spreadsheets/d/e/2PACX-1vS3_1ScOV6sTyEpZSgLgCf2dKbwkLzb3zUEYM-7ZOoMbcFUTp7nvu1pBfGOP7EzppXXQYQhLeVa_SPr/pub?gid=970113485&single=true&output=csv";

const LECTOR_DEL_NAVEGADOR: Lector = {
  json: async <T,>(url: string) => {
    /* Los documentos, sin caché: lo cambiado en Duelos o en /emotion tiene que verse ya. */
    if (url.startsWith("/api/docs")) {
      try {
        const r = await fetch(url, { cache: "no-store" });

        return ((await r.json()) as T) ?? null;
      } catch {
        return null;
      }
    }

    return traeJson<T>(url).catch(() => null);
  },
  csv: (url) => traeCsv(url),
};

const ES_NOTA = /^\s*\d+(?:[.,]\d+)?\s*$/;
const num = (v?: string) => Number(String(v || "").replace(",", ".")) || 0;

/** Las reglas de lectura de /emotion: cuatro notas de verdad y no el relleno de cincos. */
export function leeHojaEmocional(csv: string): FilaEmocionalHoja[] {
  const { data } = Papa.parse<string[]>(csv, { header: false, skipEmptyLines: true });

  return data
    .filter((r) => [r[2], r[3], r[4], r[5]].every((v) => ES_NOTA.test(v ?? "")))
    .filter((r) => ![r[2], r[3], r[4], r[5]].every((v) => num(v) === 5))
    .map((r) => ({ posicion: r[0]?.trim() || "", jugador: r[1]?.trim() || "", ea: num(r[2]), ie: num(r[3]), ia: num(r[4]), ee: num(r[5]) }))
    .filter((r) => r.jugador && !isHiddenPlayer(r.jugador));
}

const doc = async <T,>(lector: Lector, key: string) => (await lector.json<{ data?: T | null }>(`/api/docs?key=${encodeURIComponent(key)}`))?.data ?? null;

/** Todo lo que no es la pizarra, para el rival del próximo partido. */
export async function cargaDatosPropuesta(plantilla: Player[], rival: string, lector: Lector = LECTOR_DEL_NAVEGADOR): Promise<DatosPropuesta> {
  const [datos, filas, temporada, csvEmocional, capaEmocional] = await Promise.all([
    lector.json<{ jugadores?: FilaJugador[]; partidos?: FilaPartido[] }>("/api/data-analisis"),
    lector.json<Fila[]>("/api/rivals?action=rivalesPlantillas"),
    lector.json<{ success?: boolean; season?: RatingsSeason }>("/api/ratings/load").then((r) => (r?.success ? (r.season ?? null) : null)),
    lector.csv(CSV_EMOCIONAL).catch(() => ""),
    doc<unknown>(lector, CLAVE_DOC_EMOCIONAL),
  ]);

  const jugadores = datos?.jugadores ?? [];
  const partidos = datos?.partidos ?? [];
  const hoja = Array.isArray(filas) ? filas : [];
  const equipo = texto(hoja.find((f) => mismoClub(texto(f.NOMBRE_EQUIPO), rival))?.NOMBRE_EQUIPO) || rival;

  let onceSuyo: DatosPropuesta["onceSuyo"] = {};

  if (jugadores.length && hoja.some((f) => texto(f.NOMBRE_EQUIPO) === equipo)) {
    const [onceDoc, duelosDoc] = await Promise.all([doc<unknown>(lector, rivalOnceKey(equipo)), doc<unknown>(lector, `duelos:${slugClave(equipo)}`)]);
    const suyos = suyosDe(hoja, equipo, jugadores);
    const marcados = normalizarOnce(onceDoc).titulares;
    /* El informe de BeSoccer pesa (1 MB): sólo si no hay once marcado. */
    const informe = marcados.length >= 7 ? null : findInforme(await doc<InformeDoc>(lector, "rivals:informe"), equipo);
    const base = baseSuyaDe(suyos, marcados, informe);

    onceSuyo = onceSuyoDe(suyos, base.lista, normalizaDuelos(duelosDoc).suyo);
  }

  const emocional: FilaEmocional[] = aplicaEdiciones(csvEmocional ? leeHojaEmocional(csvEmocional) : [], normalizaDocEmocional(capaEmocional)).map((r) => ({
    jugador: r.jugador,
    ea: r.ea,
    ie: r.ie,
    ia: r.ia,
    ee: r.ee,
  }));

  return { plantilla, jugadores, partidos, rival: equipo, onceSuyo, emocional, temporada };
}
