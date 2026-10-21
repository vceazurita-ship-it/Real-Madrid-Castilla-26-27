/**
 * Lo que la diapositiva de una tarea trae del registro de tareas (21/10/2026).
 *
 * El cuerpo técnico escribe cada tarea en la hoja (tipo, formato, espacio,
 * tiempo, contenido) y en Jugadores sesión sólo ponía el nombre corto
 * («POSESIÓN»). El jugador veía con quién jugaba, no qué se jugaba. Aquí se
 * busca, para la fecha de la sesión, la tarea de la hoja que corresponde a
 * cada una de la sesión: por el nombre (palabra a palabra, aceptando
 * abreviaturas como «ATAQ-DEF» → «Ataque - Defensa») y, si no casa ninguna,
 * por el orden del día. Lo que la hoja no trae no sale.
 */

import type { RegistroTarea } from "@/lib/abp/registro";

export type DetalleTarea = {
  micro: number;
  rival: string;
  md: string;
  tipo: string;
  formato: string;
  espacio: string;
  tiempo: number;
  contenido: string;
};

export type ContextoSesion = {
  micro: number;
  rival: string;
  md: string;
};

const palabras = (t: string) =>
  t
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .split(/[^a-z0-9]+/)
    .filter((p) => p.length > 1);

/** «2026-10-21» → «21/10/2026», como la escribe la hoja. */
function fechaHoja(iso: string) {
  const [a, m, d] = iso.split("-");
  return d && m && a ? `${d}/${m}/${a}` : "";
}

/** Cuánto se parecen dos nombres: palabras que casan, enteras o por el principio (desde 3 letras). */
function parecido(a: string, b: string) {
  const pa = palabras(a);
  const pb = palabras(b);
  if (!pa.length || !pb.length) return 0;
  const casa = (x: string, y: string) => x === y || (x.length >= 3 && y.startsWith(x)) || (y.length >= 3 && x.startsWith(y));
  return pa.filter((x) => pb.some((y) => casa(x, y))).length / pa.length;
}

const deCompeticion = (t: RegistroTarea) => /competici|partido oficial/i.test(t.tipoTarea) || /^md$/i.test(t.md.trim());

/** Las tareas de la hoja de ese día, en su orden, sin la fila del partido. */
export function tareasDelDia(registro: RegistroTarea[], fechaIso: string | undefined) {
  if (!fechaIso) return [];
  const f = fechaHoja(fechaIso);
  return registro.filter((t) => t.fecha.trim() === f && !deCompeticion(t));
}

/** El micro, el rival y el MD de la sesión, si la hoja tiene ese día. */
export function contextoDeSesion(delDia: RegistroTarea[]): ContextoSesion | null {
  const t = delDia[0];
  return t ? { micro: t.micro, rival: t.rival, md: t.md } : null;
}

/**
 * La tarea de la hoja de cada tarea de la sesión. Primero por el nombre; las
 * que quedan, por el orden, y sólo si el día tiene las mismas tareas que la
 * sesión (si no, el orden no dice nada).
 */
export function detallesDeTareas(nombres: string[], delDia: RegistroTarea[]): (DetalleTarea | null)[] {
  const usadas = new Set<number>();
  const elegidas: (number | null)[] = nombres.map((nombre) => {
    let mejor = -1;
    let nota = 0.5;
    delDia.forEach((t, k) => {
      if (usadas.has(k)) return;
      const n = Math.max(parecido(nombre, t.tipoTarea), parecido(nombre, t.contenidoPrincipal) * 0.9);
      if (n > nota) {
        nota = n;
        mejor = k;
      }
    });
    if (mejor >= 0) usadas.add(mejor);
    return mejor >= 0 ? mejor : null;
  });

  if (delDia.length === nombres.length) {
    elegidas.forEach((k, i) => {
      if (k === null && !usadas.has(i)) {
        elegidas[i] = i;
        usadas.add(i);
      }
    });
  }

  return elegidas.map((k) => {
    if (k === null) return null;
    const t = delDia[k];
    return {
      micro: t.micro,
      rival: t.rival,
      md: t.md,
      tipo: t.tipoTarea,
      formato: t.formato,
      espacio: t.espacio ?? "",
      tiempo: t.tiempo,
      contenido: [t.contenidoPrincipal, t.contenidoSecundario].filter(Boolean).join(" · "),
    };
  });
}

/** La línea bajo el título de la diapositiva: sólo lo que la hoja trae. */
export function lineaDeDetalle(d: DetalleTarea | null | undefined, nombre: string) {
  if (!d) return "";
  const tipo = d.tipo && parecido(nombre, d.tipo) < 1 ? d.tipo : "";
  return [tipo, d.formato, d.espacio ? `${d.espacio}${/m\s*$/i.test(d.espacio) ? "" : " m"}` : "", d.tiempo > 0 ? `${d.tiempo}′` : "", d.contenido]
    .map((x) => x.trim())
    .filter(Boolean)
    .join(" · ");
}
