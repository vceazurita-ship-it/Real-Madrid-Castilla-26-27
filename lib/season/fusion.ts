import { MonthData, WeekData } from "./types";

/*
| Guardado por cambios, no por temporada entera (19/10/2026).
|
| La pantalla mandaba la temporada COMPLETA en cada subida o borrado. Si dos
| personas tenían abierta la página —una subiendo a la semana 7 y otra a la
| 12—, la segunda escritura llevaba la foto vieja de la semana 7 y borraba lo
| de la primera sin que nadie se enterase (el archivo seguía en el bucket,
| pero ya no colgaba de ninguna semana).
|
| Ahora el navegador sólo dice QUÉ ha cambiado —«añade estos archivos a la
| semana N», «quita este»— y el servidor lo aplica sobre lo último que hay
| guardado. Así dos cambios a la vez se suman, aunque sean de la misma semana.
|
| Este fichero es puro (sin red) para que lo usen igual la ruta del servidor,
| la pantalla —para el cambio optimista— y el script de comprobación.
*/

export type ListaSemana = "images" | "pdfs";

export interface CambioSemana {
  weekId: number;
  anade?: Partial<Record<ListaSemana, string[]>>;
  quita?: Partial<Record<ListaSemana, string[]>>;
}

const LISTAS: ListaSemana[] = ["images", "pdfs"];

function listaDeTextos(valor: unknown): valor is string[] {
  return Array.isArray(valor) && valor.every((v) => typeof v === "string");
}

function parteValida(valor: unknown): boolean {
  if (valor === undefined) return true;
  if (!valor || typeof valor !== "object") return false;

  return Object.entries(valor).every(
    ([clave, lista]) =>
      LISTAS.includes(clave as ListaSemana) && listaDeTextos(lista)
  );
}

/** Comprueba la forma de un cambio recibido por la red. */
export function esCambioSemana(valor: unknown): valor is CambioSemana {
  if (!valor || typeof valor !== "object") return false;

  const cambio = valor as Record<string, unknown>;

  return (
    typeof cambio.weekId === "number" &&
    Number.isFinite(cambio.weekId) &&
    parteValida(cambio.anade) &&
    parteValida(cambio.quita)
  );
}

/** El cambio contrario: sirve para deshacer el optimista si el guardado falla. */
export function inverso(cambio: CambioSemana): CambioSemana {
  return { weekId: cambio.weekId, anade: cambio.quita, quita: cambio.anade };
}

/**
 * Los meses de la temporada, tal como estén guardados. Las dos áreas tienen
 * forma distinta: `general` guarda el array y `performance` lo anida en
 * `{ season, data }`. Devuelve `null` si no reconoce ninguna de las dos.
 */
export function mesesDe(raw: unknown): MonthData[] | null {
  if (Array.isArray(raw)) return raw as MonthData[];

  const anidado = (raw as { data?: unknown } | null)?.data;

  return Array.isArray(anidado) ? (anidado as MonthData[]) : null;
}

function aplicaASemana(semana: WeekData, cambio: CambioSemana): WeekData {
  const nueva: WeekData = { ...semana };

  for (const lista of LISTAS) {
    let actual = [...(semana[lista] ?? [])];

    // Las temporadas antiguas guardaban un único documento en `pdf`. La
    // pantalla lo enseña dentro de `pdfs`, así que al tocar la semana se pasa
    // ahí: si no, quitarlo desde la pantalla no lo quitaría del documento.
    if (lista === "pdfs" && semana.pdf && !actual.includes(semana.pdf)) {
      actual = [semana.pdf, ...actual];
    }

    const quitar = new Set(cambio.quita?.[lista] ?? []);
    if (quitar.size > 0) actual = actual.filter((url) => !quitar.has(url));

    for (const url of cambio.anade?.[lista] ?? []) {
      if (!actual.includes(url)) actual.push(url);
    }

    nueva[lista] = actual;
  }

  delete nueva.pdf;

  return nueva;
}

/**
 * Aplica el cambio sobre una temporada guardada SIN tocar el resto: las demás
 * semanas, los demás campos de la semana y la forma del documento (array o
 * `{ season, data }`) salen tal como entraron. No modifica `raw`.
 *
 * Devuelve `null` si la semana no existe o el documento no tiene forma de
 * temporada: en ese caso no hay que escribir nada.
 */
export function aplicaCambio(
  raw: unknown,
  cambio: CambioSemana
): { raw: unknown; semana: WeekData } | null {
  const meses = mesesDe(raw);
  if (!meses) return null;

  // Un objeto y no un `let`: TypeScript no sigue las asignaciones hechas
  // dentro de un callback y daría la variable por `null` para siempre.
  const hallada: { semana?: WeekData } = {};

  const nuevosMeses = meses.map((mes) => {
    if (!Array.isArray(mes?.weeks)) return mes;
    if (!mes.weeks.some((w) => w?.id === cambio.weekId)) return mes;

    return {
      ...mes,
      weeks: mes.weeks.map((w) => {
        if (w?.id !== cambio.weekId) return w;

        hallada.semana = aplicaASemana(w, cambio);

        return hallada.semana;
      }),
    };
  });

  if (!hallada.semana) return null;

  const nuevoRaw = Array.isArray(raw)
    ? nuevosMeses
    : { ...(raw as object), data: nuevosMeses };

  return { raw: nuevoRaw, semana: hallada.semana };
}

/** Sustituye una semana en la temporada en memoria (la que viene del servidor). */
export function poneSemana(meses: MonthData[], semana: WeekData): MonthData[] {
  return meses.map((mes) =>
    mes.weeks.some((w) => w.id === semana.id)
      ? {
          ...mes,
          weeks: mes.weeks.map((w) => (w.id === semana.id ? semana : w)),
        }
      : mes
  );
}
