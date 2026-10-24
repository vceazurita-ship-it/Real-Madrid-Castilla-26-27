/**
 * LA SESIÓN DE UN DÍA EN TRES PANTALLAS (24/10/2026).
 *
 * El mismo entrenamiento se toca en tres sitios: el microciclo lo planifica
 * (hoja «registro de tareas», `/microcycles` y su editor), Jugadores sesión
 * hace los equipos de cada tarea (Supabase `jugadores-sesion`) y el análisis
 * de entrenamiento mide objetivos en el vídeo (`entreno:` y
 * `entreno-analisis:`). Aquí está lo que los ata, sin React, para poder
 * probarlo en Node.
 *
 * QUIÉN MANDA EN CADA CAMPO
 *
 *   | Campo                                   | Manda                  | Cómo llega a los otros                            |
 *   |-----------------------------------------|------------------------|---------------------------------------------------|
 *   | Tareas del día: tipo, formato, minutos, | Microciclo (la hoja,   | Jugadores sesión las trae al crear la sesión y    |
 *   | contenido, orden                        | vía el editor)         | ofrece «Traer del microciclo» si luego cambian.   |
 *   |                                         |                        | El análisis las lista para atar objetivos.        |
 *   | Tareas añadidas, quitadas, renombradas  | Jugadores sesión       | PROPUESTA: el editor del microciclo la enseña en  |
 *   | o reordenadas en la sesión              | (lo que pasó de        | el día y se acepta con un clic; después se        |
 *   |                                         | verdad)                | escribe con «Escribir en la hoja», como siempre.  |
 *   | Quién estaba, equipos y comodines       | Jugadores sesión       | Sólo lectura en el microciclo y en el análisis    |
 *   |                                         |                        | (el análisis puede crear un objetivo por equipo). |
 *   | Objetivos por tarea y su resultado      | Análisis de            | Sólo lectura junto a la tarea en el microciclo y  |
 *   |                                         | entrenamiento          | en Jugadores sesión.                              |
 *   | Evaluación y análisis post de la tarea  | La hoja (editor)       | Sólo lectura en las otras dos.                    |
 *
 * Nadie escribe solo en la hoja desde fuera del editor: la hoja tiene tres
 * columnas con fórmula y reescribir un micro es borrar sus filas y volver a
 * escribirlas (ver lib/registro/hoja.ts). Por eso lo que cambia en la sesión
 * llega al microciclo como propuesta, no como escritura.
 *
 * LA CLAVE DE UNIÓN es la fecha (ISO) más el código de la hoja («L-T2»). El
 * código cambia al renumerar (mover una tarea en el editor convierte la T3 en
 * T2), así que cada tarea de la sesión guarda además la FIRMA de la tarea del
 * plan (tipo + formato + contenido): primero se casa por firma, luego por el
 * código y, si no, por el nombre y el orden (lo que ya hacía la diapositiva).
 */

import type { RegistroTarea } from "@/lib/abp/registro";
import { cuentas, cumpleMeta, lecturaCuentas, porcentajeOTendencia, type AnalisisEntreno, type SesionEntreno } from "@/lib/entreno/modelo";
import { TIPOS_TAREA, fechaIsoDeHoja, renumera, tareaVacia, type TareaNueva } from "@/lib/registro/hoja";
import type { DetalleTarea } from "@/lib/sesion-equipos/registro";
import { COLOR_COMODIN, COMODIN, FUERA, claveNombre, conEquipos, nuevaTarea, type JugadorSesion, type SesionEquipos, type TareaEquipos } from "@/lib/sesion-equipos/modelo";

/* ------------------------------------------------------------------ */
/*  LA TAREA DEL PLAN                                                  */
/* ------------------------------------------------------------------ */

/** Una tarea planificada de un día, venga de la hoja o del editor. */
export type TareaPlan = {
  /** «L-T2». */
  codigo: string;
  tipo: string;
  formato: string;
  espacio: string;
  tiempo: number;
  contenidoPrincipal: string;
  contenidoSecundario: string;
  comodines: number;
  evaluacion: number;
  analisisPost: string;
  observaciones: string;
  micro: number;
  rival: string;
  md: string;
  /** Su sitio en las tareas de la sesión del editor (sólo con `planDeSesionNueva`). */
  indice?: number;
};

/** Lo que la diapositiva de Jugadores sesión pinta bajo el título (lib/sesion-equipos/registro.ts). */
export const detalleDePlan = (t: TareaPlan): DetalleTarea => ({
  micro: t.micro,
  rival: t.rival,
  md: t.md,
  tipo: t.tipo,
  formato: t.formato,
  espacio: t.espacio,
  tiempo: t.tiempo,
  contenido: [t.contenidoPrincipal, t.contenidoSecundario].filter(Boolean).join(" · "),
});

/** Lo que una tarea de Jugadores sesión recuerda de la del plan de la que salió. */
export type VinculoPlan = {
  codigo: string;
  firma: string;
  /** El nombre que se le puso al traerla: si ahora es otro, se ha renombrado en la sesión. */
  nombre: string;
};

/** Lo mínimo de una fila de la hoja (sirve `RegistroTarea` y la fila propia de /microcycles). */
export type FilaPlan = Pick<RegistroTarea, "fecha" | "tarea" | "tipoTarea" | "formato" | "tiempo" | "contenidoPrincipal" | "contenidoSecundario" | "nComodines" | "evaluacion" | "analisisPost" | "observaciones" | "micro" | "rival" | "md" | "fase"> & { espacio?: string };

const esCompeticion = (t: { tarea?: string; tipoTarea?: string; fase?: string; md?: string }) =>
  /-COMP$/i.test((t.tarea ?? "").trim()) || /competici|partido oficial/i.test(t.tipoTarea ?? "") || /competici/i.test(t.fase ?? "") || /^md$/i.test((t.md ?? "").trim());

/** «Rondo 6v3» (tipo y formato) o, si no, el contenido: lo que el análisis enseña junto al código. */
export const textoDeTareaPlan = (t: Pick<TareaPlan, "tipo" | "formato" | "contenidoPrincipal">) => [t.tipo, t.formato].filter(Boolean).join(" ") || t.contenidoPrincipal;

/**
 * La firma de una tarea del plan: lo que la identifica aunque cambie su
 * código. Formato y contenido, SIN el tipo: aceptar un nombre de la sesión
 * cambia el tipo, y con él dentro la firma se perdía justo antes de un
 * renumerado. Sólo si no hay ni formato ni contenido, el tipo.
 */
export const firmaTarea = (t: Pick<TareaPlan, "tipo" | "formato" | "contenidoPrincipal" | "contenidoSecundario">) =>
  claveNombre([t.formato, t.contenidoPrincipal, t.contenidoSecundario].join(" ")) || `t ${claveNombre(t.tipo)}`;

/** El nombre que lleva en Jugadores sesión: el tipo en mayúsculas («RONDO»); si no hay, el contenido. */
export const nombreEnSesion = (t: TareaPlan) => (t.tipo.trim() || t.contenidoPrincipal.trim() || t.codigo).toUpperCase();

/**
 * El nombre para ENSEÑAR una tarea: salta los «???» (con o sin «(copia)») y los
 * vacíos que a veces trae la hoja, y cae al tipo, al contenido y, al final, al
 * código. No toca `nombreEnSesion`: ése es la clave de unión y no debe moverse.
 */
export const nombreVisible = (...candidatos: Array<string | undefined>) => {
  const vale = (s: string) => s !== "" && !/^[?¿\s]*(\(copia\))?$/i.test(s);

  return candidatos.map((c) => (c ?? "").trim()).find(vale) ?? "";
};

/** Las tareas planificadas de un día en la hoja, en su orden y sin la fila del partido. */
export function planDeRegistro(filas: FilaPlan[], fechaIso: string | undefined): TareaPlan[] {
  if (!fechaIso) return [];

  return filas
    .filter((t) => fechaIsoDeHoja(t.fecha) === fechaIso && t.tarea.trim() && !esCompeticion(t))
    .map((t) => ({
      codigo: t.tarea.trim(),
      tipo: t.tipoTarea.trim(),
      formato: t.formato.trim(),
      espacio: (t.espacio ?? "").trim(),
      tiempo: t.tiempo,
      contenidoPrincipal: t.contenidoPrincipal.trim(),
      contenidoSecundario: t.contenidoSecundario.trim(),
      comodines: t.nComodines,
      evaluacion: t.evaluacion,
      analisisPost: t.analisisPost.trim(),
      observaciones: t.observaciones.trim(),
      micro: t.micro,
      rival: t.rival,
      md: t.md,
    }));
}

/** Las tareas de un día tal y como están en el editor (lo que aún no se ha escrito en la hoja también cuenta). */
export function planDeSesionNueva(sesion: { tareas: TareaNueva[]; md: string; rival?: string }, micro: { micro: number; rival: string }): TareaPlan[] {
  return sesion.tareas.flatMap((t, indice) => {
    const vacia = !t.tipoTarea.trim() && !t.contenidoPrincipal.trim() && !t.contenidoSecundario.trim() && !t.observaciones.trim() && !(t.tiempo > 0);

    if (vacia || esCompeticion({ tarea: t.tarea, tipoTarea: t.tipoTarea, fase: t.fase })) return [];

    return [
      {
        codigo: t.tarea,
        tipo: t.tipoTarea.trim(),
        formato: t.formato.trim(),
        espacio: String(t.extra?.["Espacio"] ?? "").trim(),
        tiempo: t.tiempo,
        contenidoPrincipal: t.contenidoPrincipal.trim(),
        contenidoSecundario: t.contenidoSecundario.trim(),
        comodines: t.nComodines,
        evaluacion: Number(t.extra?.["Evaluación"]) || 0,
        analisisPost: String(t.extra?.["Análisis Post"] ?? "").trim(),
        observaciones: t.observaciones.trim(),
        micro: micro.micro,
        rival: sesion.rival ?? micro.rival,
        md: sesion.md,
        indice,
      },
    ];
  });
}

/**
 * Cuántos equipos y comodines pide el formato: «8v8+1» → 2 y 1; «4v4v4» → 3;
 * «5x5+2» → 2 y 2. `null` si el formato no lo dice.
 */
export function equiposDeFormato(formato: string, comodinesHoja = 0): { equipos: number; comodines: number } | null {
  const m = formato.match(/(\d+)\s*(?:[vx]\s*\d+\s*)+(?:\+\s*(\d+))?/i);

  if (!m) return null;

  const equipos = (m[0].match(/[vx]/gi) ?? []).length + 1;

  return { equipos: Math.min(6, Math.max(1, equipos)), comodines: Number(m[2] ?? 0) || comodinesHoja || 0 };
}

/* ------------------------------------------------------------------ */
/*  CASAR LAS TAREAS DE LA SESIÓN CON LAS DEL PLAN                     */
/* ------------------------------------------------------------------ */

const palabras = (t: string) => claveNombre(t).split(" ").filter((p) => p.length > 1);

/** Cuánto se parecen dos nombres: palabras que casan, enteras o por el principio (desde 3 letras). */
export function parecido(a: string, b: string) {
  const pa = palabras(a);
  const pb = palabras(b);

  if (!pa.length || !pb.length) return 0;

  const casa = (x: string, y: string) => x === y || (x.length >= 3 && y.startsWith(x)) || (y.length >= 3 && x.startsWith(y));

  return pa.filter((x) => pb.some((y) => casa(x, y))).length / pa.length;
}

type TareaQueSeCasa = { nombre: string; plan?: VinculoPlan };

/**
 * La tarea del plan (su índice) de cada tarea de la sesión, o `null`.
 *
 * 1. Las que recuerdan de dónde salieron: por la firma (si hay dos iguales,
 *    la del mismo código) y, si la tarea del plan ha cambiado de contenido,
 *    por el código.
 * 2. Las demás, por el nombre (tipo, contenido u observaciones).
 * 3. Y si el día tiene tantas tareas como la sesión, las que quedan por el orden.
 */
export function enlaza(tareas: TareaQueSeCasa[], plan: TareaPlan[]): (number | null)[] {
  const usadas = new Set<number>();
  const salida: (number | null)[] = tareas.map(() => null);
  const firmas = plan.map(firmaTarea);

  tareas.forEach((t, i) => {
    if (!t.plan) return;

    const candidatas = firmas.map((f, k) => (f === t.plan!.firma && !usadas.has(k) ? k : -1)).filter((k) => k >= 0);
    const k = candidatas.find((c) => plan[c].codigo === t.plan!.codigo) ?? candidatas[0];

    if (k !== undefined) {
      salida[i] = k;
      usadas.add(k);
    }
  });

  tareas.forEach((t, i) => {
    if (!t.plan || salida[i] !== null) return;

    const k = plan.findIndex((p, j) => !usadas.has(j) && p.codigo.toLowerCase() === t.plan!.codigo.toLowerCase());

    if (k >= 0) {
      salida[i] = k;
      usadas.add(k);
    }
  });

  tareas.forEach((t, i) => {
    if (salida[i] !== null) return;

    let mejor = -1;
    let nota = 0.5;

    plan.forEach((p, k) => {
      if (usadas.has(k)) return;

      const n = Math.max(parecido(t.nombre, p.tipo), parecido(t.nombre, p.contenidoPrincipal) * 0.9, parecido(t.nombre, p.observaciones) * 0.8);

      if (n > nota) {
        nota = n;
        mejor = k;
      }
    });

    if (mejor >= 0) {
      salida[i] = mejor;
      usadas.add(mejor);
    }
  });

  if (plan.length === tareas.length) {
    salida.forEach((k, i) => {
      if (k === null && !usadas.has(i)) {
        salida[i] = i;
        usadas.add(i);
      }
    });
  }

  return salida;
}

export const vinculoDe = (t: TareaPlan, nombre = nombreEnSesion(t)): VinculoPlan => ({ codigo: t.codigo, firma: firmaTarea(t), nombre });

/* ------------------------------------------------------------------ */
/*  DEL PLAN A LA SESIÓN                                               */
/* ------------------------------------------------------------------ */

/** Una tarea de Jugadores sesión a partir de la del plan: nombre, equipos y comodines del formato, y su vínculo. */
export function tareaDesdePlan(t: TareaPlan, numero: number, jugadores: JugadorSesion[]): TareaEquipos {
  const base = nuevaTarea(numero, jugadores);
  const formato = equiposDeFormato(t.formato, t.comodines);
  const conSusEquipos = formato ? conEquipos(base, formato.equipos) : base;

  return {
    ...conSusEquipos,
    nombre: nombreEnSesion(t),
    comodines: formato?.comodines ?? 0,
    colorComodin: COLOR_COMODIN,
    plan: vinculoDe(t),
  };
}

/** ¿Es una tarea que nadie ha tocado («Tarea 1» sin nadie colocado)? */
const tareaSinTocar = (t: TareaEquipos) => /^tarea \d+$/i.test(t.nombre.trim()) && !Object.values(t.sitio).some((s) => s !== FUERA);

/**
 * Coloca unas piezas en el orden que dicen sus índices del plan, dejando las
 * que no son del plan (`null`) en su sitio. Sirve en los dos sentidos.
 */
function ordenaPorPlan<T>(lista: T[], enlace: (number | null)[]): T[] {
  const huecos = lista.map((_, i) => i).filter((i) => enlace[i] !== null);
  const enOrden = [...huecos].sort((a, b) => (enlace[a] ?? 0) - (enlace[b] ?? 0));
  const salida = [...lista];

  huecos.forEach((hueco, n) => {
    salida[hueco] = lista[enOrden[n]];
  });

  return salida;
}

/** Lo que el plan tiene distinto de la sesión: lo que ofrece «Traer del microciclo». */
export type CambiosDelPlan = {
  /** Tareas del plan que la sesión no tiene (y que no se quitaron a propósito en la sesión). */
  nuevas: TareaPlan[];
  /** Tareas que el plan ha renombrado y la sesión no (la sesión conservaba el nombre que trajo). */
  renombradas: { id: string; de: string; a: string }[];
  /** El orden de la sesión no es el del plan. */
  orden: boolean;
  /** Tareas de la sesión que aún no saben de qué tarea del plan son. */
  sinVinculo: number;
};

export function cambiosDelPlan(sesion: SesionEquipos, plan: TareaPlan[]): CambiosDelPlan {
  const enlace = enlaza(sesion.tareas, plan);
  const usadas = new Set(enlace.filter((k): k is number => k !== null));
  const quitadas = new Set(sesion.planQuitadas ?? []);
  const ordenados = enlace.filter((k): k is number => k !== null);

  return {
    nuevas: plan.filter((p, k) => !usadas.has(k) && !quitadas.has(firmaTarea(p))),
    renombradas: sesion.tareas.flatMap((t, i) => {
      const k = enlace[i];

      if (k === null || !t.plan) return [];

      const delPlan = nombreEnSesion(plan[k]);
      const sinTocar = claveNombre(t.nombre) === claveNombre(t.plan.nombre);

      return sinTocar && claveNombre(delPlan) !== claveNombre(t.nombre) ? [{ id: t.id, de: t.nombre, a: delPlan }] : [];
    }),
    orden: ordenados.some((k, i) => i > 0 && k < ordenados[i - 1]),
    sinVinculo: sesion.tareas.filter((t, i) => enlace[i] !== null && !t.plan).length,
  };
}

/* Atar las que casan por el nombre no es un cambio que haya que avisar: lo hace «Traer» de paso. */
export const hayCambiosDelPlan = (c: CambiosDelPlan) => c.nuevas.length > 0 || c.renombradas.length > 0 || c.orden;

/**
 * «Traer del microciclo»: ata cada tarea a la suya del plan, añade las que
 * faltan (con sus equipos), pone los nombres que el plan ha cambiado y el
 * orden del plan. Las tareas propias de la sesión se quedan donde estaban, y
 * nadie pierde su sitio. Una sesión recién creada con «Tarea 1» vacía la
 * cambia por las del plan.
 */
export function traeDelPlan(sesion: SesionEquipos, plan: TareaPlan[]): SesionEquipos {
  if (!plan.length) return sesion;

  const propias = sesion.tareas.length === 1 && tareaSinTocar(sesion.tareas[0]) ? [] : sesion.tareas;
  const enlace = enlaza(propias, plan);
  const cambios = cambiosDelPlan({ ...sesion, tareas: propias }, plan);
  const renombre = new Map(cambios.renombradas.map((r) => [r.id, r.a]));

  const atadas = propias.map((t, i) => {
    const k = enlace[i];

    if (k === null) return t;

    const nombre = renombre.get(t.id) ?? t.nombre;

    return { ...t, nombre, plan: vinculoDe(plan[k], t.plan && !renombre.has(t.id) ? t.plan.nombre : nombre) };
  });

  const nuevas = cambios.nuevas.map((p, n) => tareaDesdePlan(p, atadas.length + n + 1, sesion.jugadores));
  const todas = [...atadas, ...nuevas];
  const enlaceTodas = [...enlace, ...cambios.nuevas.map((p) => plan.indexOf(p))];

  /* Las quitadas a propósito no vuelven: siguen apuntadas para que el microciclo proponga quitarlas. */
  return { ...sesion, tareas: ordenaPorPlan(todas, enlaceTodas) };
}

/** Al quitar una tarea en la sesión, se apunta su firma: el plan no la vuelve a ofrecer y el microciclo propone quitarla. */
export function apuntaQuitada(sesion: SesionEquipos, tarea: TareaEquipos): SesionEquipos {
  if (!tarea.plan) return sesion;

  return { ...sesion, planQuitadas: [...new Set([...(sesion.planQuitadas ?? []), tarea.plan.firma])] };
}

/* ------------------------------------------------------------------ */
/*  DE LA SESIÓN AL PLAN: PROPUESTAS                                   */
/* ------------------------------------------------------------------ */

export type Propuesta =
  | { tipo: "anadir"; clave: string; nombre: string; /** Tras qué tarea del plan va (su índice), o -1 al principio. */ tras: number }
  | { tipo: "quitar"; clave: string; codigo: string; nombre: string; indice: number }
  | { tipo: "renombrar"; clave: string; codigo: string; de: string; a: string; indice: number }
  | { tipo: "orden"; clave: string; /** Los índices del plan en el orden de la sesión. */ orden: number[]; texto: string };

/**
 * Lo que ha cambiado en la sesión respecto al plan del día, como propuestas
 * para el microciclo. Sólo en sesiones atadas al plan (alguna tarea traída
 * de él): en una sesión hecha a mano, sin vínculos, todo serían «tareas
 * nuevas» y no lo son.
 */
export function propuestasDeLaSesion(sesion: SesionEquipos | null | undefined, plan: TareaPlan[]): Propuesta[] {
  if (!sesion || !sesion.tareas.some((t) => t.plan)) return [];

  const enlace = enlaza(sesion.tareas, plan);
  const usadas = new Set(enlace.filter((k): k is number => k !== null));
  const quitadas = new Set(sesion.planQuitadas ?? []);
  const salida: Propuesta[] = [];

  let anterior = -1;

  sesion.tareas.forEach((t, i) => {
    const k = enlace[i];

    if (k === null) {
      if (!tareaSinTocar(t)) salida.push({ tipo: "anadir", clave: `anadir:${t.id}`, nombre: t.nombre.trim(), tras: anterior });

      return;
    }

    anterior = k;

    if (!t.plan) return;

    const p = plan[k];
    const renombrada = claveNombre(t.nombre) !== claveNombre(t.plan.nombre);
    const yaRecogido = claveNombre(t.nombre) === claveNombre(nombreEnSesion(p)) || claveNombre(p.observaciones).includes(claveNombre(t.nombre));

    if (renombrada && !yaRecogido) salida.push({ tipo: "renombrar", clave: `renombrar:${t.id}:${claveNombre(t.nombre)}`, codigo: p.codigo, de: nombreEnSesion(p), a: t.nombre.trim(), indice: k });
  });

  plan.forEach((p, k) => {
    if (!usadas.has(k) && quitadas.has(firmaTarea(p))) salida.push({ tipo: "quitar", clave: `quitar:${firmaTarea(p)}`, codigo: p.codigo, nombre: nombreEnSesion(p), indice: k });
  });

  const ordenados = enlace.filter((k): k is number => k !== null);

  if (ordenados.some((k, i) => i > 0 && k < ordenados[i - 1])) {
    salida.push({ tipo: "orden", clave: `orden:${ordenados.join(",")}`, orden: ordenados, texto: ordenados.map((k) => plan[k].codigo).join(" → ") });
  }

  return salida;
}

/** La frase de una propuesta, como la lee el cuerpo técnico. */
export function textoDePropuesta(p: Propuesta) {
  switch (p.tipo) {
    case "anadir":
      return `En la sesión se hizo «${p.nombre}», que no está en el plan`;
    case "quitar":
      return `En la sesión se quitó ${p.codigo} («${p.nombre}»)`;
    case "renombrar":
      return `En la sesión ${p.codigo} se llama «${p.a}»`;
    case "orden":
      return `En la sesión el orden fue ${p.texto}`;
  }
}

/** El tipo de la lista de la hoja que corresponde a un nombre, si es uno de ellos («RONDO» → «Rondo»). */
export function tipoDeNombre(nombre: string) {
  const clave = claveNombre(nombre);

  return TIPOS_TAREA.find((t) => claveNombre(t) === clave);
}

/**
 * Aplica una propuesta a las tareas de un día del editor. Las piezas del plan
 * se reconocen por `indice` (`planDeSesionNueva`), así que `plan` tiene que
 * ser el del mismo estado del editor. Un nombre que no es un tipo de la lista
 * no se mete en «Tipo tarea» (rompería los agrupados de /microcycles): va a
 * «Observaciones», y la tarea se casa también por ahí.
 */
export function aplicaPropuesta(tareas: TareaNueva[], plan: TareaPlan[], p: Propuesta, dia: string): TareaNueva[] {
  const fila = (k: number) => plan[k]?.indice;
  const conNombre = (t: TareaNueva, nombre: string): TareaNueva => {
    const tipo = tipoDeNombre(nombre);

    if (tipo) return { ...t, tipoTarea: tipo };

    const nota = `En sesión: ${nombre}`;

    return { ...t, observaciones: t.observaciones.trim() ? `${t.observaciones.trim()} · ${nota}` : nota };
  };

  switch (p.tipo) {
    case "quitar": {
      const i = fila(p.indice);

      return i === undefined ? tareas : tareas.filter((_, j) => j !== i);
    }
    case "renombrar": {
      const i = fila(p.indice);

      return i === undefined ? tareas : tareas.map((t, j) => (j === i ? conNombre(t, p.a) : t));
    }
    case "anadir": {
      const tras = p.tras >= 0 ? fila(p.tras) : -1;
      const donde = tras === undefined ? tareas.length : tras + 1;
      const nueva = conNombre(tareaVacia(dia, tareas.length + 1), p.nombre);
      const salida = [...tareas];

      /* Delante del partido, si el día lo tiene: la fila del COMP va la última. */
      const antesDelComp = salida.findIndex((t) => /-COMP$/i.test(t.tarea));
      salida.splice(antesDelComp >= 0 ? Math.min(donde, antesDelComp) : donde, 0, nueva);

      return salida;
    }
    case "orden": {
      const enlace: (number | null)[] = tareas.map(() => null);

      p.orden.forEach((k, n) => {
        const i = fila(k);

        if (i !== undefined) enlace[i] = n;
      });

      return ordenaPorPlan(tareas, enlace);
    }
  }
}

/**
 * «Aceptar todo» en un día del editor: una propuesta cada vez, recalculando
 * el plan entre una y otra (cada una cambia los códigos). Una propuesta que
 * vuelve a salir después de aplicarla corta la vuelta: no se mete dos veces.
 */
export function aplicaTodasLasPropuestas(
  sesion: { tareas: TareaNueva[]; dia: string; md: string; rival?: string; fecha: string },
  micro: { micro: number; rival: string },
  equipos: SesionEquipos,
): TareaNueva[] {
  const hechas = new Set<string>();
  let tareas = sesion.tareas;

  for (let vuelta = 0; vuelta < 30; vuelta += 1) {
    const plan = planDeSesionNueva({ ...sesion, tareas }, micro);
    const p = propuestasDeLaSesion(equipos, plan)[0];

    if (!p || hechas.has(p.clave)) break;

    hechas.add(p.clave);
    tareas = renumera({ ...sesion, tareas: aplicaPropuesta(tareas, plan, p, sesion.dia) }).tareas;
  }

  return tareas;
}

/* ------------------------------------------------------------------ */
/*  LO QUE SE VE EN CADA PANTALLA                                      */
/* ------------------------------------------------------------------ */

/** Los equipos de una tarea de la sesión, en corto: color, nombre y cuántos. */
export type EquiposDeTarea = {
  nombre: string;
  equipos: { nombre: string; color: string; jugadores: string[] }[];
  comodines: string[];
  fuera: string[];
};

export function equiposDeTarea(sesion: SesionEquipos, tarea: TareaEquipos): EquiposDeTarea {
  const nombre = (id: string) => sesion.jugadores.find((j) => j.id === id)?.nombre ?? "";
  const de = (sitio: string) =>
    Object.entries(tarea.sitio)
      .filter(([, s]) => s === sitio)
      .map(([id]) => nombre(id))
      .filter(Boolean);

  return {
    nombre: tarea.nombre,
    equipos: tarea.equipos.map((e) => ({ nombre: e.nombre, color: e.color, jugadores: de(e.id) })),
    comodines: de(COMODIN),
    fuera: de(FUERA),
  };
}

/** La sesión de Jugadores sesión de una fecha (si hay dos, la última creada). */
export function sesionDeFecha(sesiones: SesionEquipos[] | undefined, fechaIso: string): SesionEquipos | null {
  return [...(sesiones ?? [])].filter((s) => s.fecha === fechaIso).sort((a, b) => b.creadaEn.localeCompare(a.creadaEn))[0] ?? null;
}

/** El resultado de un objetivo del análisis, en corto. */
export type ResultadoObjetivo = {
  id: string;
  objetivo: string;
  jugadores: string[];
  /** «9 de 14 correctas (11 validadas) · 64 %». */
  lectura: string;
  /** «64 %», «Tendencia» o vacío. */
  porcentaje: string;
  /** Con meta y muestra suficiente: si llega. */
  cumple: boolean | null;
  meta?: number;
  /** Sin análisis todavía (sólo el objetivo). */
  pendiente: boolean;
};

/**
 * Los objetivos del análisis de cada tarea del plan (por su índice), y los
 * que no dicen tarea. Un objetivo se ata por el código que guardó; si el
 * texto copiado al elegirla ya no es el de esa tarea (se ha renumerado), por
 * ese texto.
 */
export function resultadosPorTarea(sesion: SesionEntreno | null | undefined, analisis: AnalisisEntreno | null | undefined, plan: TareaPlan[]) {
  const porTarea = new Map<number, ResultadoObjetivo[]>();
  const sinTarea: ResultadoObjetivo[] = [];

  for (const o of sesion?.objetivos ?? []) {
    if (!o.objetivo.trim()) continue;

    const c = analisis ? cuentas(o.id, analisis.acciones, sesion?.validaciones) : null;
    const resultado: ResultadoObjetivo = {
      id: o.id,
      objetivo: o.objetivo.trim(),
      jugadores: o.jugadores.map((j) => j.nombre),
      lectura: c && c.total ? lecturaCuentas(c) : "",
      porcentaje: c ? porcentajeOTendencia(c) : "",
      cumple: c ? cumpleMeta(c, o.meta) : null,
      ...(o.meta ? { meta: o.meta } : {}),
      pendiente: !c,
    };

    const codigo = (o.tarea ?? "").trim().toLowerCase();
    const porCodigo = codigo ? plan.findIndex((p) => p.codigo.toLowerCase() === codigo) : -1;
    const textoCasa = (k: number) => !o.tareaTexto || claveNombre(textoDeTareaPlan(plan[k])) === claveNombre(o.tareaTexto);
    const porTexto = o.tareaTexto ? plan.findIndex((p) => claveNombre(textoDeTareaPlan(p)) === claveNombre(o.tareaTexto ?? "")) : -1;
    const k = porCodigo >= 0 && textoCasa(porCodigo) ? porCodigo : porTexto >= 0 ? porTexto : porCodigo;

    if (k >= 0) porTarea.set(k, [...(porTarea.get(k) ?? []), resultado]);
    else sinTarea.push(resultado);
  }

  return { porTarea, sinTarea };
}

/** El id de la plantilla de un nombre de la lista del delegado («DANIEL YAÑEZ» → el de «Yáñez»), si casa con uno solo. */
export function idDePlantilla(nombre: string, plantilla: { id: string; nombre: string; apodo?: string }[]) {
  const suyas = new Set(claveNombre(nombre).split(" "));
  const casa = (p: string) => suyas.has(p) || (p.length >= 3 && [...suyas].some((s) => s.startsWith(p)));
  const casan = plantilla.filter((f) =>
    [f.nombre, f.apodo ?? ""].some((n) => {
      const pals = claveNombre(n).split(" ").filter((p) => p.length > 1);

      return pals.length > 0 && pals.every(casa);
    }),
  );

  return new Set(casan.map((f) => f.id)).size === 1 ? casan[0] : null;
}

/* ------------------------------------------------------------------ */
/*  ENLACES                                                            */
/* ------------------------------------------------------------------ */

export const enlaceSesion = (fechaIso: string) => `/jugadores-sesion?fecha=${fechaIso}`;
export const enlaceAnalisis = (fechaIso: string) => `/analisis-entrenamiento?fecha=${fechaIso}`;
export const enlaceMicro = (micro: number | null | undefined) => (micro && Number.isInteger(micro) ? `/microcycles?micro=${micro}` : "/microcycles");
export const enlaceEditor = (micro: number | null | undefined) => (micro && Number.isInteger(micro) ? `/laboratorio/microciclo?micro=${micro}` : "/laboratorio/microciclo");
