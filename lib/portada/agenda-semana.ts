/**
 * MIS TAREAS DEL MICROCICLO (28/10/2026, sólo el analista).
 *
 * Las responsabilidades de cada semana, ancladas al calendario: el día tras
 * el partido se analiza lo jugado; el MD+2 se valora y se cierra la semana
 * (microciclos e informe post de ABP); con el rival se trabaja del MD-4 al
 * MD-1; cada día de entreno se detalla la sesión antes y se analiza después;
 * la quiniela, el día antes de su cierre (viernes 12:00).
 */

export type TareaAgenda = {
  id: string;
  texto: string;
  /** Lo que hay que dejar hecho, para darla por cerrada. */
  hecho: string;
  href?: string;
  bloque: "partido" | "semana" | "rival" | "sesion" | "envio";
  /** La que tiene que estar hecha antes (se avisa si no). */
  requiere?: string;
  /** Con la semana corta, la que se puede recortar. */
  recortable?: boolean;
};

export type DiaAgenda = { fecha: string; md: string; tareas: TareaAgenda[] };

const DIA = 86_400_000;

const iso = (t: number) => new Date(t).toISOString().slice(0, 10);

/** El día civil de un «2026-10-25T12:00» de BeSoccer, en milisegundos UTC a medianoche. */
const diaDe = (cuando: string) => Date.parse(`${cuando.slice(0, 10)}T00:00:00Z`);

const T: Record<string, TareaAgenda> = {
  colectivo: { id: "colectivo", texto: "Post colectivo: análisis del partido jugado", hecho: "Datos y vídeos del equipo, con las claves para el cuerpo técnico", href: "/data-analisis", bloque: "partido" },
  "abp-ultimo": { id: "abp-ultimo", texto: "Análisis del ABP del último partido", hecho: "Acciones etiquetadas y lectura a favor y en contra", href: "/setpieces", bloque: "partido" },
  individual: { id: "individual", texto: "Individual: análisis del partido", hecho: "Datos y vídeos de cada jugador", href: "/individual", bloque: "partido" },
  rendimiento: { id: "rendimiento", texto: "Individual: valoración del rendimiento", hecho: "Nota de cada jugador que participó", href: "/ratings", bloque: "partido", requiere: "individual", recortable: true },
  "informe-post": { id: "informe-post", texto: "Enviar el informe de ABP del último partido", hecho: "Enviado al cuerpo técnico", href: "/abp-microciclo", bloque: "envio", requiere: "abp-ultimo" },
  "abp-rival": { id: "abp-rival", texto: "Análisis del ABP del rival", hecho: "Sus acciones a favor y en contra, con vídeo", href: "/scout-rival-abp", bloque: "rival" },
  "micro-entreno": { id: "micro-entreno", texto: "Definir el microciclo de entrenamientos", hecho: "Días, cargas y contenidos de la semana", href: "/microcycles", bloque: "semana" },
  "micro-abp": { id: "micro-abp", texto: "Definir el microciclo de ABP", hecho: "Aspectos, minutos y objetivo de cada tarea", href: "/abp-microciclo", bloque: "semana", requiere: "abp-rival" },
  "once-rival": { id: "once-rival", texto: "Posible once y clips individuales del rival", hecho: "Once probable y clips de los peligrosos", href: "/rivals", bloque: "rival" },
  plan: { id: "plan", texto: "Plan de partido", hecho: "Tres claves por fase, dónde hacerles daño y clips enlazados, compartido", href: "/match-plans", bloque: "rival", requiere: "once-rival" },
  pizarra: { id: "pizarra", texto: "Crear la pizarra de ABP del partido", hecho: "Rutinas ofensivas y defensivas con marcas por dorsal", href: "/abp-pizarra", bloque: "rival", requiere: "micro-abp" },
  "informe-previa": { id: "informe-previa", texto: "Enviar el informe de ABP del próximo partido", hecho: "PDF por jugador y vídeo enviados", href: "/abp-pizarra", bloque: "envio", requiere: "pizarra" },
};

/*
| Revisado por el experto de fútbol (28/10/2026): el ABP del rival antes de
| definir el micro de ABP; la pizarra antes de la primera sesión con ABP
| (MD-3) y el informe al jugador en MD-2, no el MD-1 (que es repaso); el plan
| de partido en MD-4, con el once ya hecho; la sesión se detalla la víspera.
*/
const POR_DIA: { desde?: number; hasta?: number; ids: string[] }[] = [
  { desde: 1, ids: ["colectivo", "abp-ultimo", "individual"] },
  { desde: 2, ids: ["informe-post", "abp-rival", "micro-entreno", "micro-abp"] },
  { hasta: 4, ids: ["once-rival", "plan", "rendimiento"] },
  { hasta: 3, ids: ["pizarra"] },
  { hasta: 2, ids: ["informe-previa"] },
];

/* Con la semana corta, por orden de dependencia: post, después rival y micros, después partido. */
const GRUPOS = [["colectivo", "abp-ultimo", "individual"], ["informe-post", "abp-rival", "micro-entreno", "micro-abp", "rendimiento"], ["once-rival", "plan", "pizarra"], ["informe-previa"]];

const despues = (sesion: boolean): TareaAgenda[] =>
  sesion
    ? [
        { id: "entreno", texto: "Después de la sesión: análisis del entrenamiento", hecho: "Cada objetivo de la sesión revisado con vídeo", href: "/analisis-entrenamiento", bloque: "sesion" },
        { id: "evaluacion", texto: "Después de la sesión: evaluación", hecho: "Cada objetivo individual con sí/no y un clip", href: "/laboratorio/microciclo", bloque: "sesion" },
      ]
    : [];

const antes = (mananaSesion: boolean): TareaAgenda[] =>
  mananaSesion
    ? [{ id: "detallar", texto: "Detallar la sesión de mañana", hecho: "Tareas, jugadores por tarea y objetivos colectivos e individuales observables (antes de las 20:00)", href: "/laboratorio/microciclo", bloque: "sesion" }]
    : [];

/**
 * Los días entre el último partido y el próximo (ambos fuera), cada uno con
 * sus tareas. Hay sesión del MD+2 al MD-1 (el MD+1 es recuperación); cada
 * sesión se detalla la víspera. Con la semana corta, las tareas se reparten
 * por grupos en orden de dependencia y lo recortable queda marcado.
 */
export function agendaSemana(anterior: string | null, proximo: string, quinielaCierre?: string | null): DiaAgenda[] {
  const p = diaDe(proximo);

  const a = anterior ? diaDe(anterior) : p - 7 * DIA;

  const n = Math.round((p - a) / DIA) - 1;

  if (n <= 0) return [];

  const corta = n < 6;

  const dias: DiaAgenda[] = [];

  for (let k = 0; k < n; k++) {
    const desde = k + 1;
    const hasta = n - k;

    const fijas = corta
      ? (GRUPOS[Math.min(k, GRUPOS.length - 1)] ?? []).concat(k === n - 1 ? GRUPOS.slice(k + 1).flat() : [])
      : POR_DIA.filter((r) => r.desde === desde || r.hasta === hasta).flatMap((r) => r.ids);

    /* Lo de grupos que no tuvieron día (semana de 2-3 días) cae en el último. */
    const tareas = fijas.map((id) => ({ ...T[id], recortable: corta ? T[id].recortable : undefined }));

    dias.push({
      fecha: iso(a + desde * DIA),
      md: desde <= 2 && desde < hasta ? `MD+${desde}` : `MD-${hasta}`,
      tareas: [...antes(hasta >= 2 && desde + 1 >= 2), ...tareas, ...despues(desde >= 2)],
    });
  }

  /* La quiniela, el día antes de su cierre si cae dentro de la semana; la última del día (no es del partido). */
  if (quinielaCierre) {
    const dia = iso(Date.parse(`${quinielaCierre.slice(0, 10)}T00:00:00Z`) - DIA);

    dias.find((d) => d.fecha === dia)?.tareas.push({ id: "quiniela", texto: "Quiniela", hecho: "Apuesta hecha antes del cierre (viernes 12:00)", href: "/quiniela", bloque: "envio", ...(corta ? { recortable: true } : {}) });
  }

  return dias;
}

/** El viernes de la semana del próximo partido, a las 12:00 (el cierre de la quiniela). */
export function cierreQuinielaAntesDe(proximo: string) {
  const p = diaDe(proximo);

  const dia = new Date(p).getUTCDay();

  /* El viernes anterior (o el mismo día si el partido es viernes). */
  const atras = (dia - 5 + 7) % 7;

  return iso(p - atras * DIA);
}
