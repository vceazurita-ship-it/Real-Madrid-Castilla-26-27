/**
 * Hojas de ABP publicadas en Google Sheets.
 *
 * Están todas en el mismo libro; sólo cambia el `gid`. Centralizarlas aquí
 * evita que la misma URL de 200 caracteres viva copiada en cinco páginas.
 */

import Papa from "papaparse";

const BOOK =
  "https://docs.google.com/spreadsheets/d/e/2PACX-1vS3_1ScOV6sTyEpZSgLgCf2dKbwkLzb3zUEYM-7ZOoMbcFUTp7nvu1pBfGOP7EzppXXQYQhLeVa_SPr/pub";

export const ABP_GIDS = {
  /** Córners y faltas a favor. */
  piezasOf: "675048698",
  /** Córners y faltas en contra. */
  piezasDef: "1071911136",
  /** Saques de banda a favor. */
  bandaOf: "1484189905",
  /** Saques de banda en contra. */
  bandaDef: "1250621633",
} as const;

/**
 * Hoja de scouting de ABP del rival: sus propios partidos, no sólo los que
 * juega contra nosotros. Mientras esté vacía, `/scout-rival-abp` funciona con
 * lo que puede deducir de las cuatro hojas de arriba y lo dice en pantalla.
 *
 * Al crearla, publícala como CSV y pega aquí su `gid`. Columnas esperadas
 * (`RIVAL_SCOUT_COLUMNS` documenta el contrato completo):
 *
 *   JORNADA · Equipo · Rival · Condicion · Tiempo · Minuto · Tipo_Accion ·
 *   Zona_Saque · Sacador · Perfil_Golpeo · Tipo_Envio · Zona_Caida ·
 *   Calidad_Envio · N_Atacantes · N_Bloqueadores · Tipo_Carrera · Remate ·
 *   Rematador · Tipo_Remate · Zona_Remate · xG · Segundo_Balon ·
 *   Resultado_Final · Patron · Observaciones
 */
export const RIVAL_SCOUT_GID = "";

/**
 * Contrato de la hoja de scouting rival. Se muestra en la propia página
 * cuando la hoja todavía no existe, para que montarla no requiera abrir
 * el código.
 */
export const RIVAL_SCOUT_COLUMNS: { name: string; hint: string }[] = [
  { name: "JORNADA", hint: "Jornada o partido observado" },
  { name: "Equipo", hint: "Equipo analizado — el que ejecuta o defiende" },
  { name: "Rival", hint: "Su oponente en ese partido" },
  { name: "Condicion", hint: "Ofensivo | Defensivo, desde el equipo analizado" },
  { name: "Tiempo", hint: "1T / 2T" },
  { name: "Minuto", hint: "Minuto de la acción" },
  {
    name: "Tipo_Accion",
    hint: "Córner · Falta lateral … Z4 · Falta directa … Z3 · Penalti · Saque de banda · Saque de medio · Saque de meta",
  },
  { name: "Zona_Saque", hint: "Zona 1 / 2 / 3 en saques de banda" },
  { name: "Sacador", hint: "Quién ejecuta" },
  { name: "Perfil_Golpeo", hint: "Cerrado / Abierto / Tenso…" },
  { name: "Tipo_Envio", hint: "Corto / Largo / Tenso…" },
  { name: "Zona_Caida", hint: "Dónde cae el balón" },
  { name: "Calidad_Envio", hint: "Escala 1 a 4" },
  { name: "N_Atacantes", hint: "Atacantes en el área" },
  { name: "N_Bloqueadores", hint: "Bloqueadores empleados" },
  { name: "Tipo_Carrera", hint: "Desde atrás / Estático…" },
  { name: "Remate", hint: "Sí / No" },
  { name: "Rematador", hint: "Quién remata — alimenta el ranking y las estaturas" },
  { name: "Tipo_Remate", hint: "Limpio / Forzado…" },
  { name: "Zona_Remate", hint: "1er palo / Central / 2º palo / Frontal" },
  { name: "xG", hint: "xG de la acción" },
  { name: "Segundo_Balon", hint: "Quién gana el rechace" },
  { name: "Resultado_Final", hint: "Gol · Ocasión · ABP · Posicional · Nada (+ « Rival »)" },
  {
    name: "Patron",
    hint: "Rutina reconocible — sólo en las acciones que van al plan de partido",
  },
  { name: "Observaciones", hint: "Texto libre" },
];

export function sheetUrl(gid: string) {
  return `${BOOK}?gid=${gid}&single=true&output=csv`;
}

/**
 * Por dónde se ESCRIBE en las hojas de ABP.
 *
 * `BOOK` es el libro publicado en la web, y eso sólo sirve para leer: una URL
 * `2PACX-…` es una copia estática que Google sirve aparte del documento, sin
 * identificador real ni destino de escritura. Publicar en la web da lectura
 * pública, no permiso de edición.
 *
 * Para escribir hace falta un Apps Script en el propio libro. Está escrito en
 * `scripts/abp-hoja.gs`, con sus instrucciones: se pega una vez en
 * Extensiones → Apps Script, se implementa como aplicación web y la URL que
 * sale —la que acaba en `/exec`— se pone aquí.
 *
 * Mientras esté vacío, `escribeFilas` lo dice y no intenta nada.
 */
export const ABP_ESCRITURA_URL = "";

export type RespuestaEscritura = {
  success: boolean;
  escritas?: number;
  desdeLaFila?: number;
  /** Claves que la hoja no supo colocar: no tenían cabecera. */
  ignoradas?: string[];
  error?: string;
};

/**
 * Añade filas al final de una pestaña de ABP.
 *
 * Va como **JSON con `Content-Type: text/plain`**, y las dos cosas son a
 * propósito. El `doPost` del script hace `JSON.parse` del cuerpo, así que un
 * formulario se estrella antes de repartir por acción —es lo que tumbó el
 * guardado de RIVALES en septiembre—. Y `text/plain` es uno de los tipos que
 * el navegador considera «simples»: con `application/json` haría antes una
 * petición `OPTIONS` de comprobación, y un despliegue de Apps Script no
 * contesta a `OPTIONS`, así que el guardado moriría sin llegar a la hoja.
 *
 * Ojo: la hoja escribe por nombre de columna y devuelve en `ignoradas` lo que
 * no encajó. Quien llame **tiene que mirarlo**: un `success: true` con
 * `ignoradas` llenas significa que se han escrito filas a medias.
 */
export async function escribeFilas(
  gid: string,
  filas: Record<string, string>[],
): Promise<RespuestaEscritura> {
  if (!ABP_ESCRITURA_URL) {
    return {
      success: false,
      error:
        "Falta el Apps Script del libro de ABP: pega scripts/abp-hoja.gs y pon su URL en ABP_ESCRITURA_URL.",
    };
  }

  const respuesta = await fetch(ABP_ESCRITURA_URL, {
    method: "POST",
    headers: { "Content-Type": "text/plain;charset=utf-8" },
    body: JSON.stringify({ action: "anadirFilas", gid, filas }),
  });

  if (!respuesta.ok) {
    return { success: false, error: `La hoja contestó ${respuesta.status}.` };
  }

  const texto = await respuesta.text();

  try {
    return JSON.parse(texto) as RespuestaEscritura;
  } catch {
    /* Casi siempre la página de «Authorization required» de Google. */
    return {
      success: false,
      error:
        "La hoja no ha contestado JSON. Suele ser que la aplicación web no está publicada para «Cualquier usuario».",
    };
  }
}

export type SheetRow = Record<string, string>;

/**
 * Descarga una pestaña y la devuelve como filas con cabecera.
 *
 * Se pide con `cache: "no-store"`: las hojas se editan durante la semana y un
 * dato de ABP viejo es peor que un segundo de espera.
 */
export async function loadSheet(gid: string): Promise<SheetRow[]> {
  if (!gid) return [];

  const response = await fetch(sheetUrl(gid), { cache: "no-store" });

  if (!response.ok) {
    throw new Error(`No se pudo leer la hoja ${gid} (${response.status})`);
  }

  const text = await response.text();

  const parsed = Papa.parse<SheetRow>(text, {
    header: true,
    skipEmptyLines: true,
    transformHeader: (header) => header.trim(),
  });

  return parsed.data.filter((row) =>
    Object.values(row).some((value) => String(value ?? "").trim()),
  );
}
