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
 *   Resultado_Final · Observaciones
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
  { name: "Observaciones", hint: "Texto libre" },
];

export function sheetUrl(gid: string) {
  return `${BOOK}?gid=${gid}&single=true&output=csv`;
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
