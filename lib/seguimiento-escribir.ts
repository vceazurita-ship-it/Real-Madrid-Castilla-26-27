/**
 * CREAR SEGUIMIENTOS, DE UNO EN UNO O A VARIOS A LA VEZ (13/10/2026).
 *
 * El seguimiento grupal es el mismo registro repetido en cada jugador: la
 * hoja guarda una fila por jugador, así que «grupal» es escribir la misma
 * fila N veces con `MODALIDAD: GRUPAL`. Lo usan la ficha de `/individual`
 * (el formulario de siempre, con «replicar en…») y el pop-up del día de la
 * portada.
 *
 * Va contra el mismo Apps Script que `/individual` (text/plain, ver la nota
 * «hoja-guardar-json-no-formulario») y, al acabar, avisa a la caché de
 * `/api/rivals` para que la lista no enseñe la copia de antes.
 *
 * Se puede usar en el navegador.
 */

import { olvidaLoGuardado } from "@/lib/hojaRivales";

export const SEGUIMIENTO_SCRIPT_URL =
  "https://script.google.com/macros/s/AKfycbxCaJ90F28CYdcLVNnI4RZjyQL5IJlXVunEAobWY-Qr6lUL8No9H1B3RdASk83Z_NUd/exec";

export const QUIEN_OPTIONS = ["JULIÁN", "MIGUEL", "VICTOR", "JULIÁN Y MIGUEL", "JULIÁN Y VICTOR", "MIGUEL Y VICTOR", "TODOS"];

export const MODALIDAD_OPTIONS = ["GRUPAL", "INDIVIDUAL"];

export const MOMENTO_OPTIONS = ["PRE-ENTRENAMIENTO", "ENTRENAMIENTO", "POST-ENTRENAMIENTO"];

export const ESTRATEGIA_OPTIONS = ["CAMPO", "VÍDEO", "CHARLA", "VÍDEO Y CHARLA"];

export type CamposSeguimiento = {
  FECHA: string;
  OBJETIVO_OFENSIVO: string;
  OBJETIVO_DEFENSIVO: string;
  OBJETIVO_MENTAL: string;
  FEEDBACK: string;
  QUIEN: string;
  MODALIDAD: string;
  MOMENTO: string;
  ESTRATEGIA: string;
};

export const seguimientoVacio = (fecha = ""): CamposSeguimiento => ({
  FECHA: fecha,
  OBJETIVO_OFENSIVO: "",
  OBJETIVO_DEFENSIVO: "",
  OBJETIVO_MENTAL: "",
  FEEDBACK: "",
  QUIEN: "",
  MODALIDAD: "",
  MOMENTO: "",
  ESTRATEGIA: "",
});

export type ResultadoSeguimientos = {
  /** Los que se han escrito, con el ID_REGISTRO que ha dado la hoja. */
  hechos: { idJugador: string; idRegistro: string }[];
  /** Los que no, con el motivo. */
  fallidos: { idJugador: string; motivo: string }[];
};

async function creaUno(idJugador: string, campos: CamposSeguimiento) {
  const respuesta = await fetch(SEGUIMIENTO_SCRIPT_URL, {
    method: "POST",
    headers: { "Content-Type": "text/plain;charset=utf-8" },
    body: JSON.stringify({ action: "crearSeguimiento", ID_JUGADOR: idJugador, ...campos }),
  });

  const datos = JSON.parse(await respuesta.text()) as { success?: boolean; id?: string; error?: string };

  if (!datos.success) throw new Error(datos.error || "la hoja no lo ha aceptado");

  return String(datos.id ?? "");
}

/**
 * Escribe el mismo seguimiento en cada jugador, de uno en uno (el script no
 * aguanta escrituras a la vez en la misma pestaña). Un fallo no para a los
 * demás: se devuelve quién quedó sin escribir.
 */
export async function creaSeguimientos(
  idsJugador: string[],
  campos: CamposSeguimiento,
  alProgreso?: (hechos: number, total: number) => void,
): Promise<ResultadoSeguimientos> {
  const ids = [...new Set(idsJugador.filter(Boolean))];
  const modalidad = campos.MODALIDAD || (ids.length > 1 ? "GRUPAL" : "INDIVIDUAL");
  const resultado: ResultadoSeguimientos = { hechos: [], fallidos: [] };

  for (const [i, id] of ids.entries()) {
    try {
      resultado.hechos.push({ idJugador: id, idRegistro: await creaUno(id, { ...campos, MODALIDAD: modalidad }) });
    } catch (error) {
      resultado.fallidos.push({ idJugador: id, motivo: error instanceof Error ? error.message : String(error) });
    }

    alProgreso?.(i + 1, ids.length);
  }

  if (resultado.hechos.length) olvidaLoGuardado();

  return resultado;
}
