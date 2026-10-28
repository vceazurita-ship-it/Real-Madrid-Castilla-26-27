/**
 * LA PLANIFICACIÓN DE LA SEMANA DE ABP, SOLA (28/10/2026).
 *
 * Para mandarla por correo o por WhatsApp al cuerpo técnico: qué se hace cada
 * día (aspecto, lado, dónde, cuánto y para qué), sin el informe ni sus
 * lecturas. Sólo lo que está puesto en la semana.
 */

import { ASPECTOS, DIAS, LADOS, MEDIOS, MOMENTOS, ROLES, fmtMin, type DiaKey, type MicroPlan, type Trabajo } from "@/lib/abp/microciclo";

export type TareaPlanificada = {
  /** «Córner directo y córner indirecto». */
  que: string;
  /** Para el calendario: con muchos aspectos, sus etiquetas cortas («Córner dir. · Falta lat. dir.…»). */
  queCorto: string;
  /** Orden de la sesión: pre, intra, post. */
  momento: number;
  /** «Defensivo», «Ofensivo» o «Ofensivo y defensivo». */
  lado: string;
  /** «Campo · Intra entreno». */
  donde: string;
  minutos: number;
  objetivo: string;
  notas: string;
  /** Quién la trabaja: «Sacadores y rematadores». */
  quien: string;
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
const ROL = new Map(ROLES.map((r) => [r.key, r.label]));
const NOMBRE_DIA = new Map(DIAS.map((d) => [d.key, d.label]));

const ORDEN_MOMENTO = new Map(MOMENTOS.map((m, i) => [m.key, i]));

const enLista = (partes: string[]) => (partes.length > 1 ? `${partes.slice(0, -1).join(", ")} y ${partes.at(-1)}` : partes[0] ?? "");

/* Sólo la primera letra en minúscula: «Saque de banda Z2» no se convierte en «z2» a media frase. */
const minusculaInicial = (texto: string) => texto.charAt(0).toLowerCase() + texto.slice(1);

/** Un objetivo escrito en mayúsculas sostenidas, a frase normal («ESPECÍFICO CON EDU» → «Específico con edu»). */
function enFrase(texto: string) {
  const letras = texto.replace(/[^A-Za-zÁÉÍÓÚÑáéíóúñ]/g, "");

  const mayusculas = letras.replace(/[^A-ZÁÉÍÓÚÑ]/g, "").length;

  if (letras.length < 8 || mayusculas / letras.length < 0.6) return texto;

  /* Sólo las palabras en mayúsculas sostenidas: un nombre ya escrito con su mayúscula («Edu») se queda. */
  const bajo = texto.replace(/[A-Za-z0-9ÁÉÍÓÚÑÜáéíóúñü]+/g, (palabra) => (!/\d/.test(palabra) && palabra === palabra.toUpperCase() ? palabra.toLowerCase() : palabra));

  return bajo.charAt(0).toUpperCase() + bajo.slice(1);
}

const GRUPO = new Map(ASPECTOS.map((a) => [a.key, a.grupo]));

const FAMILIA: Record<string, string> = { corner: "córners", falta: "faltas", banda: "saques de banda" };

/**
 * Con 4 aspectos o más, por familias y cuántos (comunicación, 28/10/2026):
 * «Córners, faltas y saques de banda · 6 acciones». La lista exacta va en el detalle.
 */
function porFamilias(aspectos: Trabajo["aspectos"]) {
  const familias = [...new Set(aspectos.map((a) => FAMILIA[GRUPO.get(a) ?? ""] ?? (ASPECTO.get(a) ?? a).toLowerCase()))];

  const texto = enLista(familias);

  return `${texto.charAt(0).toUpperCase()}${texto.slice(1)}\u00a0· ${aspectos.length}\u00a0acciones`;
}

function tarea(t: Trabajo): TareaPlanificada {
  const aspectos = t.aspectos.map((a) => ASPECTO.get(a) ?? a);

  return {
    que: enLista(aspectos.map((a, i) => (i === 0 ? a : minusculaInicial(a)))),
    /* Con 4 aspectos o más, las etiquetas cortas: el título largo tapaba el criterio (expertos, 28/10/2026). */
    queCorto: t.aspectos.length >= 4 ? porFamilias(t.aspectos) : enLista(aspectos.map((a, i) => (i === 0 ? a : minusculaInicial(a)))),
    momento: ORDEN_MOMENTO.get(t.momento) ?? 9,
    lado: enLista(t.lados.map((l, i) => (i === 0 ? LADO.get(l) ?? l : (LADO.get(l) ?? l).toLowerCase()))),
    donde: [MEDIO.get(t.medio), MOMENTO.get(t.momento)].filter(Boolean).join(" · "),
    minutos: t.minutos,
    quien: enLista(t.roles.map((r, i) => (i === 0 ? ROL.get(r) ?? r : (ROL.get(r) ?? r).toLowerCase()))),
    objetivo: enFrase((t.objetivo ?? "").trim()),
    /* Sin la nota del boceto («Boceto · A favor: 25 acciones, 41 % con peligro…»): es método, no planificación. */
    notas: t.notas
      .split(/\n+/)
      .filter((linea) => linea.trim() && !/^boceto\b/i.test(linea.trim()))
      .join(" ")
      .trim(),
  };
}

/** La semana en el orden de sus días, con la fecha de cada uno (la de la ventana del micro). */
export function planificacion(plan: MicroPlan, dias: { clave: DiaKey; fecha: string }[]): DiaPlanificado[] {
  return dias.map(({ clave, fecha }) => {
    const dia = plan.dias[clave];

    /* En el orden de la sesión (pre, intra, post): así lo lee el entrenador. */
    const tareas = (dia?.trabajos ?? []).map(tarea).sort((a, b) => a.momento - b.momento);

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
