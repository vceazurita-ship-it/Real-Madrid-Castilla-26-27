/**
 * LA PLANIFICACIÓN DE LA SEMANA DE ABP, SOLA (28/10/2026).
 *
 * Para mandarla por correo o por WhatsApp al cuerpo técnico: qué se hace cada
 * día (aspecto, lado, dónde, cuánto y para qué), sin el informe ni sus
 * lecturas. Sólo lo que está puesto en la semana.
 */

import { ASPECTOS, DIAS, LADOS, MEDIOS, MOMENTOS, fmtMin, type DiaKey, type MicroPlan, type Trabajo } from "@/lib/abp/microciclo";

export type TareaPlanificada = {
  /** «Córner directo y córner indirecto». */
  que: string;
  /** «Defensivo», «Ofensivo» o «Ofensivo y defensivo». */
  lado: string;
  /** «Campo · Intra entreno». */
  donde: string;
  minutos: number;
  objetivo: string;
  notas: string;
};

export type DiaPlanificado = {
  clave: DiaKey;
  /** «Miércoles 28/10». */
  dia: string;
  md: string;
  tipo: MicroPlan["dias"][DiaKey]["tipo"];
  tareas: TareaPlanificada[];
  minutos: number;
};

const ASPECTO = new Map(ASPECTOS.map((a) => [a.key, a.label]));
const LADO = new Map(LADOS.map((l) => [l.key, l.label]));
const MEDIO = new Map(MEDIOS.map((m) => [m.key, m.label]));
const MOMENTO = new Map(MOMENTOS.map((m) => [m.key, m.label]));
const NOMBRE_DIA = new Map(DIAS.map((d) => [d.key, d.label]));

const enLista = (partes: string[]) => (partes.length > 1 ? `${partes.slice(0, -1).join(", ")} y ${partes.at(-1)}` : partes[0] ?? "");

function tarea(t: Trabajo): TareaPlanificada {
  const aspectos = t.aspectos.map((a) => ASPECTO.get(a) ?? a);

  return {
    que: enLista(aspectos.map((a, i) => (i === 0 ? a : a.toLowerCase()))),
    lado: enLista(t.lados.map((l, i) => (i === 0 ? LADO.get(l) ?? l : (LADO.get(l) ?? l).toLowerCase()))),
    donde: [MEDIO.get(t.medio), MOMENTO.get(t.momento)].filter(Boolean).join(" · "),
    minutos: t.minutos,
    objetivo: (t.objetivo ?? "").trim(),
    notas: t.notas.trim(),
  };
}

/** La semana en el orden de sus días, con la fecha de cada uno (la de la ventana del micro). */
export function planificacion(plan: MicroPlan, dias: { clave: DiaKey; fecha: string }[]): DiaPlanificado[] {
  return dias.map(({ clave, fecha }) => {
    const dia = plan.dias[clave];

    const tareas = (dia?.trabajos ?? []).map(tarea);

    const [, mes, d] = fecha.split("-");

    return {
      clave,
      dia: `${NOMBRE_DIA.get(clave) ?? clave}${d && mes ? ` ${d}/${mes}` : ""}`,
      md: dia?.md ?? "",
      tipo: dia?.tipo ?? "entreno",
      tareas,
      minutos: tareas.reduce((suma, t) => suma + t.minutos, 0),
    };
  });
}

export function tituloPlanificacion(micro: number, rival: string) {
  return `Balón parado · Microciclo ${micro}${rival ? ` · ${rival}` : ""}`;
}

/** El texto para WhatsApp (con *negritas*) o para el cuerpo del correo (sin ellas). */
export function textoPlanificacion(dias: DiaPlanificado[], micro: number, rival: string, whatsapp: boolean) {
  const b = (t: string) => (whatsapp ? `*${t}*` : t);

  const lineas = [b(tituloPlanificacion(micro, rival).toUpperCase()), "Planificación de la semana", ""];

  for (const d of dias) {
    const cabeza = [d.dia, d.md, d.tipo === "partido" ? "Partido" : d.tipo === "descanso" ? "Descanso" : ""].filter(Boolean).join(" · ");

    if (!d.tareas.length) {
      /* Un día de entreno sin balón parado no se nombra; el partido y el descanso sí, para situar la semana. */
      if (d.tipo !== "entreno") lineas.push(b(cabeza), "");

      continue;
    }

    lineas.push(b(`${cabeza} · ${fmtMin(d.minutos)}`));

    for (const t of d.tareas) {
      lineas.push(`• ${t.que} (${t.lado.toLowerCase()}) · ${t.donde} · ${fmtMin(t.minutos)}`);

      if (t.objetivo) lineas.push(`   Objetivo: ${t.objetivo}`);

      if (t.notas) lineas.push(`   ${t.notas}`);
    }

    lineas.push("");
  }

  const total = dias.reduce((suma, d) => suma + d.minutos, 0);

  if (total) lineas.push(`Total: ${fmtMin(total)} de balón parado`);

  return lineas.join("\n").trim();
}
