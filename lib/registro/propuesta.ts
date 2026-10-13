/*
|--------------------------------------------------------------------------
| PROPUESTA DE LOS CAMPOS DE LA DEMANDA COGNITIVA (13/10/2026)
|--------------------------------------------------------------------------
|
| NºJug, NºComodines, Normativa, Incertidumbre, Familiaridad (dificultad) y
| Motivación describen cómo es la tarea, y el cuerpo técnico los repite casi
| igual cada vez que monta la misma. Aquí se proponen a partir de lo que ya
| está escrito en la hoja de registro: cuanto más se rellena, mejor propone
| (la herramienta «aprende» porque lee la hoja entera cada vez).
|
| Cada tarea de la hoja vota con un peso por lo que se parece a la nueva:
|   mismo formato ×4 · mismo tipo de tarea ×3 · mismo contenido principal ×2 ·
|   misma fase ×1 · mismo contenido secundario ×1,
| y más si es reciente (la de esta semana pesa el doble que la de hace dos
| meses). Gana el valor con más peso (es una escala de 1 a 5, no se promedia).
| Para NºJug y NºComodines, si nadie ha usado ese formato, se sacan de él:
| «8v8+6» = 22 jugadores y 6 comodines (así lo escribe la hoja).
|
| Se puede usar en el navegador.
*/

import type { RegistroTarea } from "@/lib/abp/registro";
import { fechaIsoDeHoja, type ColumnaRegistro, type TareaNueva } from "@/lib/registro/hoja";

export type CampoCognitivo = "nJug" | "nComodines" | "normativa" | "incertidumbre" | "familiaridad" | "motivacion";

export const CAMPOS_COGNITIVOS: { campo: CampoCognitivo; columna: ColumnaRegistro; rotulo: string; corto: string; max: number }[] = [
  { campo: "nJug", columna: "NºJug", rotulo: "Nº jugadores en la tarea", corto: "NºJug", max: 40 },
  { campo: "nComodines", columna: "NºComodines", rotulo: "Comodines", corto: "Comod.", max: 10 },
  { campo: "normativa", columna: "Normativa", rotulo: "Normativa (1-5)", corto: "Norm.", max: 5 },
  { campo: "incertidumbre", columna: "Incertidumbre", rotulo: "Incertidumbre (1-5)", corto: "Incert.", max: 5 },
  { campo: "familiaridad", columna: "Familiaridad (dificultad)", rotulo: "Familiaridad (dificultad, 1-5)", corto: "Famil.", max: 5 },
  { campo: "motivacion", columna: "Motivacion", rotulo: "Motivación (1-5)", corto: "Motiv.", max: 5 },
];

export type Propuesta = Partial<Record<CampoCognitivo, number>> & {
  /** Cuántas tareas de la hoja se parecen (con peso), para decir lo fiable que es. */
  parecidas: number;
};

const norma = (t: string) => (t || "").normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/\s+/g, "");

/** «8v8+6» → 22 jugadores, 6 comodines. `null` si el formato no se entiende. */
export function jugadoresDelFormato(formato: string): { nJug: number; nComodines: number } | null {
  const m = norma(formato).match(/^(\d+)(?:v|x|vs|c)(\d+)(?:\+(\d+))?/);

  if (!m) return null;

  const comodines = Number(m[3] ?? 0);

  return { nJug: Number(m[1]) + Number(m[2]) + comodines, nComodines: comodines };
}

type Rasgos = Pick<TareaNueva, "formato" | "tipoTarea" | "contenidoPrincipal" | "contenidoSecundario" | "fase">;

export function propuestaCognitiva(tarea: Rasgos, historico: RegistroTarea[], hoy = new Date().toISOString().slice(0, 10)): Propuesta {
  const f = norma(tarea.formato);
  const tipo = norma(tarea.tipoTarea);
  const principal = norma(tarea.contenidoPrincipal);
  const secundario = norma(tarea.contenidoSecundario);
  const fase = norma(tarea.fase);
  const diaHoy = Date.parse(hoy);

  const votos: Record<CampoCognitivo, Map<number, number>> = {
    nJug: new Map(),
    nComodines: new Map(),
    normativa: new Map(),
    incertidumbre: new Map(),
    familiaridad: new Map(),
    motivacion: new Map(),
  };

  let parecidas = 0;
  let mismoFormato = false;

  for (const h of historico) {
    let peso = 0;

    if (f && norma(h.formato) === f) {
      peso += 4;
      mismoFormato = true;
    }

    if (tipo && norma(h.tipoTarea) === tipo) peso += 3;
    if (principal && norma(h.contenidoPrincipal) === principal) peso += 2;
    if (fase && norma(h.fase) === fase) peso += 1;
    if (secundario && norma(h.contenidoSecundario) === secundario) peso += 1;

    if (peso === 0) continue;

    /* Lo reciente pesa más: media vida de sesenta días. */
    const fecha = Date.parse(fechaIsoDeHoja(h.fecha));
    const dias = Number.isFinite(fecha) ? Math.max(0, (diaHoy - fecha) / 86_400_000) : 120;

    peso *= Math.pow(0.5, dias / 60) + 0.25;
    parecidas += 1;

    const deEsteFormato = Boolean(f) && norma(h.formato) === f;

    for (const { campo } of CAMPOS_COGNITIVOS) {
      /* Jugadores y comodines dependen del formato: sólo votan las tareas con el mismo (medido: 47 % frente a 37 %). */
      if ((campo === "nJug" || campo === "nComodines") && !deEsteFormato) continue;

      const v = Number(h[campo]);

      /* NºComodines 0 es un dato (la mayoría no lleva); en las escalas 1-5 el 0 es «sin rellenar». */
      if (!Number.isFinite(v) || (v <= 0 && campo !== "nComodines")) continue;

      votos[campo].set(v, (votos[campo].get(v) ?? 0) + peso);
    }
  }

  const gana = (m: Map<number, number>) => [...m].sort((a, b) => b[1] - a[1])[0]?.[0];
  const propuesta: Propuesta = { parecidas };

  for (const { campo } of CAMPOS_COGNITIVOS) {
    const v = gana(votos[campo]);

    if (v !== undefined) propuesta[campo] = v;
  }

  /* Un formato que nadie ha usado: los jugadores salen de él, no de tareas que se parecen por otra cosa. */
  const delFormato = jugadoresDelFormato(tarea.formato);

  if (delFormato && (!mismoFormato || propuesta.nJug === undefined)) {
    propuesta.nJug = delFormato.nJug;
    propuesta.nComodines = delFormato.nComodines;
  }

  return propuesta;
}

/** El valor que tiene la tarea en un campo, contando el 0 escrito a propósito (`ceros`). */
export function valorCognitivo(tarea: TareaNueva, campo: CampoCognitivo): number | null {
  const v = Number(tarea[campo]) || 0;
  const columna = CAMPOS_COGNITIVOS.find((c) => c.campo === campo)!.columna;

  return v > 0 ? v : tarea.ceros?.includes(columna) ? 0 : null;
}

/** El cambio para poner un valor (0 incluido: va a `ceros` para que la hoja lo escriba). */
export function cambioCognitivo(tarea: TareaNueva, campo: CampoCognitivo, valor: number | null): Partial<TareaNueva> {
  const columna = CAMPOS_COGNITIVOS.find((c) => c.campo === campo)!.columna;
  const ceros = (tarea.ceros ?? []).filter((c) => c !== columna);

  if (valor === 0) ceros.push(columna);

  return { [campo]: valor && valor > 0 ? valor : 0, ceros: ceros.length ? ceros : undefined } as Partial<TareaNueva>;
}

/** Rellena con la propuesta sólo lo que está vacío. */
export function aplicaPropuesta(tarea: TareaNueva, propuesta: Propuesta): Partial<TareaNueva> {
  let actual: TareaNueva = tarea;

  for (const { campo } of CAMPOS_COGNITIVOS) {
    const p = propuesta[campo];

    if (p === undefined || valorCognitivo(actual, campo) !== null) continue;

    actual = { ...actual, ...cambioCognitivo(actual, campo, p) };
  }

  const cambio: Partial<TareaNueva> = { ceros: actual.ceros };

  for (const { campo } of CAMPOS_COGNITIVOS) cambio[campo] = actual[campo];

  return cambio;
}
