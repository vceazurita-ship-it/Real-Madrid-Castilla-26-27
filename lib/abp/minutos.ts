/**
 * LOS MINUTOS DE BALÓN PARADO DE UNA SEMANA, CONTADOS EN UN SOLO SITIO.
 *
 * Hasta el 19/10/2026 la misma semana salía con dos cifras: 23′ en el resumen
 * del partido (lo que la hoja de registro apunta de la sesión) y 1 h 35′ en el
 * informe de ABP (el plan entero, con el vídeo, el trabajo después del entreno
 * y las tareas que proponía el boceto y nadie había confirmado). Lo pidió el
 * equipo de expertos: una cifra, una función, y que diga qué cuenta.
 *
 * Qué cuenta:
 *
 * - **Todo lo planificado en `/abp-microciclo`**: campo y vídeo, antes, durante
 *   y después del entreno. La hoja de registro sólo apunta el bloque de la
 *   sesión, así que se queda corta (el vídeo y el post-entreno no están ahí).
 * - **Menos lo que el boceto propuso y nadie ha confirmado.** Una tarea con la
 *   marca «Boceto ·» es una propuesta: no suma hasta que se confirma.
 *
 * Una tarea del boceto queda confirmada si:
 *
 * 1. Se le quita la marca «Boceto ·» de la nota (o se enlaza con la hoja de
 *    registro, que le da `tareaId`).
 * 2. O la hoja de registro tiene ese mismo día una tarea de ABP que no está
 *    enlazada con ninguna otra ficha del plan. Es la prueba de que esa sesión
 *    sí tuvo balón parado de campo, y sólo vale para las de campo: el vídeo
 *    no se apunta en la hoja. Cada tarea de la hoja confirma una sola ficha.
 *
 * Lo que no se confirma no se borra: se dice aparte, «propuesto, sin
 * confirmar», para que quien manda el informe sepa por qué el total es menor.
 */

import {
  fmtMin as fmt,
  minutosPorAspecto,
  totalesDe,
  type DiaKey,
  type TotalesPlan,
  type Trabajo,
} from "./microciclo";

import type { RegistroTarea } from "./registro";

/** La marca que deja el boceto en sus tareas (`lib/abp/boceto.ts`). */
export const MARCA_BOCETO = "Boceto ·";

export type EntradaPlan = { dia: DiaKey; trabajo: Trabajo };

export type MinutosAbp = {
  /** Minutos que cuentan: lo planificado menos lo propuesto sin confirmar. */
  confirmados: number;
  /** Minutos del boceto que siguen siendo propuesta. */
  propuestos: number;
  campo: number;
  video: number;
  /** Las fichas que cuentan, para todas las demás cuentas del informe. */
  entradas: EntradaPlan[];
  /** Las fichas que no cuentan todavía. */
  propuestas: EntradaPlan[];
  /** Los totales de lo que cuenta (minutos, carga, reparto…). */
  totales: TotalesPlan;
  /** Minutos por `aspecto|lado` de lo que cuenta. */
  porAspecto: Map<string, number>;
  /**
   * La cifra dicha en una línea, con lo que cuenta:
   * «1h 5' (35' en campo, 30' en vídeo); 30' más propuestos, sin confirmar».
   * Vacía si no hay ni un minuto, ni confirmado ni propuesto.
   */
  texto: string;
};

/** ¿Es una tarea que puso el boceto y nadie ha tocado? */
export function esPropuestaDelBoceto(trabajo: Trabajo) {
  if (trabajo.tareaId || trabajo.origen === "registro") return false;

  return String(trabajo.notas ?? "").trim().startsWith(MARCA_BOCETO);
}

/**
 * Los minutos de ABP de la semana: los que cuentan y los propuestos aparte.
 *
 * `tareas` son las tareas de ABP de ESE microciclo en la hoja de registro; sin
 * ellas, una tarea del boceto sólo se confirma quitándole la marca.
 */
export function minutosAbp(entradas: EntradaPlan[], tareas: RegistroTarea[] = []): MinutosAbp {
  /* Las tareas de la hoja que ya tienen su ficha en el plan no confirman nada más. */
  const enlazadas = new Set(entradas.map(({ trabajo }) => trabajo.tareaId).filter(Boolean));

  const libresPorDia = new Map<string, number>();

  tareas.forEach((tarea) => {
    if (!tarea.dia || enlazadas.has(tarea.tarea)) return;

    libresPorDia.set(tarea.dia, (libresPorDia.get(tarea.dia) ?? 0) + 1);
  });

  const cuentan: EntradaPlan[] = [];
  const propuestas: EntradaPlan[] = [];

  entradas.forEach((entrada) => {
    if (!esPropuestaDelBoceto(entrada.trabajo)) {
      cuentan.push(entrada);

      return;
    }

    const libres = libresPorDia.get(entrada.dia) ?? 0;

    if (entrada.trabajo.medio === "campo" && libres > 0) {
      libresPorDia.set(entrada.dia, libres - 1);
      cuentan.push(entrada);

      return;
    }

    propuestas.push(entrada);
  });

  const totales = totalesDe(cuentan);

  const propuestos = propuestas.reduce((suma, { trabajo }) => suma + (trabajo.minutos || 0), 0);

  const reparto = [
    totales.minutosCampo ? `${fmt(totales.minutosCampo)} en campo` : "",
    totales.minutosVideo ? `${fmt(totales.minutosVideo)} en vídeo` : "",
  ].filter(Boolean);

  /* Sólo lo que cuenta (25/10/2026): lo propuesto sin confirmar es cosa del analista y va a su aviso. */
  const texto = totales.minutos ? `${fmt(totales.minutos)}${reparto.length === 2 ? ` (${reparto.join(", ")})` : ""}` : "";

  return {
    confirmados: totales.minutos,
    propuestos,
    campo: totales.minutosCampo,
    video: totales.minutosVideo,
    entradas: cuentan,
    propuestas,
    totales,
    porAspecto: minutosPorAspecto(cuentan),
    texto,
  };
}
