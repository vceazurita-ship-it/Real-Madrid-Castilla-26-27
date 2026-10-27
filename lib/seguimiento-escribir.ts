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

/*
| POR QUÉ FALLABA «A VECES» (16/10/2026).
|
| El Apps Script tarda 30-70 s en frío y, cuando se le cruzan dos escrituras o
| Google tiene un mal momento, contesta con SU página de error (HTML) en vez
| de JSON: `JSON.parse` reventaba con «Unexpected token <» y el seguimiento no
| se guardaba. Ahora cada intento tiene plazo, el error se dice en claro y se
| reintenta hasta tres veces. Antes de reintentar se mira en la hoja si la
| fila ya quedó escrita (la respuesta se pudo perder aunque la escritura
| entrara): así un reintento nunca duplica el seguimiento.
*/
const PLAZO_INTENTO = 90_000;
const ESPERAS = [3_000, 8_000];

type RespuestaScript = { success?: boolean; id?: string; error?: string };

/** Un error que merece otro intento (red, plazo, página de error de Google, cerrojo de la hoja). */
class Pasajero extends Error {}

async function llamaScript(cuerpo: Record<string, string>): Promise<RespuestaScript> {
  const corta = new AbortController();
  const reloj = setTimeout(() => corta.abort(), PLAZO_INTENTO);

  try {
    const respuesta = await fetch(SEGUIMIENTO_SCRIPT_URL, {
      method: "POST",
      headers: { "Content-Type": "text/plain;charset=utf-8" },
      body: JSON.stringify(cuerpo),
      signal: corta.signal,
    });
    const texto = await respuesta.text();

    try {
      return JSON.parse(texto) as RespuestaScript;
    } catch {
      throw new Pasajero(`la hoja ha contestado con un error (${respuesta.status})`);
    }
  } catch (error) {
    if (error instanceof Pasajero) throw error;

    throw new Pasajero(corta.signal.aborted ? "la hoja no ha contestado a tiempo" : "se ha cortado la conexión con la hoja");
  } finally {
    clearTimeout(reloj);
  }
}

/** ¿Está ya en la hoja este seguimiento de este jugador? Devuelve su ID_REGISTRO, o `null`. */
async function yaEscrito(idJugador: string, campos: CamposSeguimiento): Promise<string | null> {
  /* La lectura también se topa a veces con «No se puede abrir el archivo en estos momentos» de Google: tres intentos. */
  let filas: Record<string, unknown>[] | null = null;

  for (let i = 0; i < 3 && !filas; i += 1) {
    try {
      const respuesta = await fetch(`${SEGUIMIENTO_SCRIPT_URL}?action=seguimiento`, { cache: "no-store" });
      const datos = JSON.parse(await respuesta.text()) as unknown;

      if (Array.isArray(datos)) filas = datos as Record<string, unknown>[];
    } catch {
      /* Otra vuelta. */
    }

    if (!filas) await new Promise((r) => setTimeout(r, 2_000));
  }

  try {
    if (!filas) return null;

    const igual = (a: unknown, b: string) => String(a ?? "").trim() === b.trim();
    const fila = filas.find(
      (f) =>
        igual(f.ID_JUGADOR, idJugador) &&
        igual(f.OBJETIVO_OFENSIVO, campos.OBJETIVO_OFENSIVO) &&
        igual(f.OBJETIVO_DEFENSIVO, campos.OBJETIVO_DEFENSIVO) &&
        igual(f.OBJETIVO_MENTAL, campos.OBJETIVO_MENTAL) &&
        igual(f.FEEDBACK, campos.FEEDBACK),
    );

    return fila ? String(fila.ID_REGISTRO ?? "") : null;
  } catch {
    return null;
  }
}

async function creaUno(idJugador: string, campos: CamposSeguimiento, nombre = "") {
  let ultimo: Error | null = null;

  for (let intento = 0; intento <= ESPERAS.length; intento += 1) {
    if (intento > 0) {
      await new Promise((r) => setTimeout(r, ESPERAS[intento - 1]));

      /* Si la escritura de antes entró aunque se perdiera la respuesta, no se repite. */
      const ya = await yaEscrito(idJugador, campos);

      if (ya !== null) return ya;
    }

    try {
      /*
      | Con el nombre (27/10/2026): desde el 12/10 ningún registro lo llevaba y
      | sólo se ataban por ID, que la hoja renumera. Con nombre, el cruce por
      | nombre de `alineaSeguimiento` los sigue llevando a su jugador.
      */
      const datos = await llamaScript({ action: "crearSeguimiento", ID_JUGADOR: idJugador, ...(nombre ? { NOMBRE: nombre } : {}), ...campos });

      if (datos.success) return String(datos.id ?? "");

      /* Un «no» de la hoja por el cerrojo o un tropiezo de Google se reintenta; otro «no» es definitivo. */
      const motivo = datos.error || "la hoja no lo ha aceptado";

      if (!/lock|bloque|timeout|tiempo|service|servicio|too many|demasiad|exceed/i.test(motivo)) throw new Error(motivo);

      ultimo = new Pasajero(motivo);
    } catch (error) {
      if (!(error instanceof Pasajero)) throw error;

      ultimo = error;
    }
  }

  throw new Error(`${ultimo?.message ?? "no se ha podido guardar"} (probado ${ESPERAS.length + 1} veces)`);
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
  /** El nombre de cada uno, para la columna NOMBRE de la hoja. */
  nombreDe?: (idJugador: string) => string | undefined,
): Promise<ResultadoSeguimientos> {
  const ids = [...new Set(idsJugador.filter(Boolean))];
  const modalidad = campos.MODALIDAD || (ids.length > 1 ? "GRUPAL" : "INDIVIDUAL");
  const resultado: ResultadoSeguimientos = { hechos: [], fallidos: [] };

  for (const [i, id] of ids.entries()) {
    try {
      resultado.hechos.push({ idJugador: id, idRegistro: await creaUno(id, { ...campos, MODALIDAD: modalidad }, nombreDe?.(id) ?? "") });
    } catch (error) {
      resultado.fallidos.push({ idJugador: id, motivo: error instanceof Error ? error.message : String(error) });
    }

    alProgreso?.(i + 1, ids.length);
  }

  if (resultado.hechos.length) olvidaLoGuardado();

  return resultado;
}
