/**
 * MIS TAREAS: LA SEMANA DEL MICRO CON LO QUE EL ANALISTA CAMBIA (31/10/2026).
 *
 * Las tareas de cada día salen solas de `agendaSemana` (el calendario de
 * BeSoccer dice cuándo se compite; la hoja de registro de tareas, cuándo se
 * entrena). Encima, el analista puede añadir, editar, mover, quitar y marcar.
 *
 * Se guarda en dos documentos de `app_documents` (`useRemoteDoc`):
 * - `agenda:responsabilidades`: lo marcado de las tareas automáticas, con su
 *   clave `<partido>|<fecha>|<id>` (el formato de siempre, para no perder lo
 *   marcado desde el 28/10).
 * - `agenda:mis-tareas`: las tareas propias y las automáticas que se quitaron.
 *   Editar o mover una automática la «materializa»: se quita la automática y
 *   nace una propia con su texto, su enlace y la fecha nueva. Así una tarea
 *   pasada a hoy aparece en hoy aunque hoy sea ya de otro microciclo.
 *
 * Todo es puro: lo usan la portada, el aviso al entrar y el correo de las
 * 7:00 (`scripts/tareas-pendientes-correo.mjs`), y los tres cuentan igual.
 */

import { alrededorDe, type PartidoCastilla } from "@/lib/castilla/calendario";
import type { RegistroTarea } from "@/lib/abp/registro";

import { agendaSemana, cierreQuinielaAntesDe, type DiaAgenda, type Prioridad, type TareaAgenda, type TipoDia } from "./agenda-semana";

export const CLAVE_HECHAS = "agenda:responsabilidades";
export const CLAVE_PROPIAS = "agenda:mis-tareas";
export const KIND_AGENDA = "agenda";

/** Lo cambiado en un aparato avisa a las otras piezas de la misma pestaña. */
export const EVENTO_CAMBIO = "rmcf:mis-tareas-cambio";
/** «Ir a mis tareas» estando ya en la portada. */
export const EVENTO_ABRIR = "rmcf:mis-tareas-abrir";

/** El aviso y el correo no miran antes de aquí: es el día en que se estrenan. */
export const INICIO_AVISOS = "2026-10-31";
/** Ni más de una semana hacia atrás: lo de hace un mes ya no se va a hacer. */
export const DIAS_DE_AVISO = 7;

export type Hechas = Record<string, true>;

export type TareaPropia = {
  id: string;
  fecha: string;
  texto: string;
  prioridad: Prioridad;
  hecha?: boolean;
  hecho?: string;
  href?: string;
  /** La automática de la que sale, si salió de editar o mover una. */
  origen?: string;
};

export type DocPropias = { propias: TareaPropia[]; quitadas: Record<string, true> };

export const HECHAS_VACIAS: Hechas = {};
export const PROPIAS_VACIAS: DocPropias = { propias: [], quitadas: {} };

export const PRIORIDADES: Prioridad[] = ["alta", "media", "baja"];

export const NOMBRE_PRIORIDAD: Record<Prioridad, string> = { alta: "Alta", media: "Media", baja: "Baja" };

export const NOMBRE_TIPO: Record<TipoDia, string> = { entreno: "Entreno", libre: "Libre", partido: "Partido" };

const PESO: Record<Prioridad, number> = { alta: 0, media: 1, baja: 2 };

const DIA = 86_400_000;

const isoMas = (fecha: string, dias: number) => new Date(Date.parse(`${fecha}T12:00:00Z`) + dias * DIA).toISOString().slice(0, 10);

/** El documento tal cual llegue (vacío, de otra versión), con su forma. */
export function normalizaPropias(valor: unknown): DocPropias {
  const v = (valor && typeof valor === "object" ? valor : {}) as Partial<DocPropias>;

  return {
    propias: Array.isArray(v.propias) ? v.propias.filter((t) => t && typeof t.id === "string" && typeof t.fecha === "string") : [],
    quitadas: v.quitadas && typeof v.quitadas === "object" ? v.quitadas : {},
  };
}

export const claveAuto = (partido: string, fecha: string, id: string) => `${partido.slice(0, 10)}|${fecha}|${id}`;

/** «2026-10-31» de lo que escriba la hoja: «31/10/2026», «2026-10-31…». */
function fechaDeHoja(texto: string) {
  const t = String(texto ?? "").trim();

  const iso = t.match(/^(\d{4})-(\d{2})-(\d{2})/);

  if (iso) return `${iso[1]}-${iso[2]}-${iso[3]}`;

  const barras = t.match(/^(\d{1,2})[/-](\d{1,2})[/-](\d{4})/);

  return barras ? `${barras[3]}-${barras[2].padStart(2, "0")}-${barras[1].padStart(2, "0")}` : "";
}

/** Los días con sesión en la hoja de registro de tareas (el partido no cuenta). */
export function sesionesDeRegistro(tareas: RegistroTarea[]): Set<string> {
  const dias = new Set<string>();

  for (const t of tareas) {
    const fecha = fechaDeHoja(t.fecha);

    if (!fecha) continue;

    if (/COMP/i.test(t.tarea) || /^MD$/i.test(t.md.trim()) || /COMPETICI/i.test(t.tipoTarea)) continue;

    dias.add(fecha);
  }

  return dias;
}

/* ------------------------------------------------------------------ */
/*  LA SEMANA, CON LO DEL ANALISTA ENCIMA                              */
/* ------------------------------------------------------------------ */

export type TareaDelDia = {
  /** Auto: `<partido>|<fecha>|<id>`; propia: su id. */
  clave: string;
  tipo: "auto" | "propia";
  /** El id de la plantilla (auto) o el de la propia. */
  id: string;
  fecha: string;
  texto: string;
  hecho?: string;
  href?: string;
  prioridad: Prioridad;
  hecha: boolean;
  requiere?: string;
  recortable?: boolean;
};

export type DiaVista = { fecha: string; md: string; tipo: TipoDia; tareas: TareaDelDia[] };

const deLaPlantilla = (partido: string, dia: DiaAgenda, t: TareaAgenda, hechas: Hechas): TareaDelDia => {
  const clave = claveAuto(partido, dia.fecha, t.id);

  return {
    clave,
    tipo: "auto",
    id: t.id,
    fecha: dia.fecha,
    texto: t.texto,
    hecho: t.hecho,
    href: t.href,
    prioridad: t.prioridad ?? "media",
    hecha: Boolean(hechas[clave]),
    requiere: t.requiere,
    recortable: t.recortable,
  };
};

const dePropia = (t: TareaPropia): TareaDelDia => ({
  clave: t.id,
  tipo: "propia",
  id: t.id,
  fecha: t.fecha,
  texto: t.texto,
  hecho: t.hecho,
  href: t.href,
  prioridad: PRIORIDADES.includes(t.prioridad) ? t.prioridad : "media",
  hecha: Boolean(t.hecha),
});

/** Las automáticas de un microciclo (el que acaba en `partido`), con el día del partido. */
function agendaDelMicro(partido: string, anterior: string | null, sesiones: Set<string> | null) {
  return agendaSemana(anterior, partido, cierreQuinielaAntesDe(partido), { sesiones, conPartido: true });
}

type Entrada = {
  partidos: PartidoCastilla[];
  /** «2026-10-31», en Madrid. */
  hoy: string;
  hechas: Hechas;
  doc: DocPropias;
  /** Días con sesión según la hoja; `null` mientras no llega (se supone la semana de siempre). */
  sesiones: Set<string> | null;
};

/**
 * El microciclo en el que cae hoy (del día siguiente al último partido hasta
 * el próximo, éste incluido), día a día, con lo quitado fuera y lo propio
 * dentro.
 */
export function semanaDelMicro({ partidos, hoy, hechas, doc, sesiones }: Entrada) {
  const alrededor = alrededorDe(partidos, Date.parse(`${hoy}T12:00:00`));

  const proximo = alrededor.proximo;

  if (!proximo) return null;

  const dias: DiaVista[] = agendaDelMicro(proximo.cuando, alrededor.anterior?.cuando ?? null, sesiones).map((d) => ({
    fecha: d.fecha,
    md: d.md,
    tipo: d.tipo,
    tareas: d.tareas.map((t) => deLaPlantilla(proximo.cuando, d, t, hechas)).filter((t) => !doc.quitadas[t.clave]),
  }));

  for (const t of doc.propias) dias.find((d) => d.fecha === t.fecha)?.tareas.push(dePropia(t));

  for (const d of dias) d.tareas = ordena(d.tareas);

  return { proximo, anterior: alrededor.anterior, dias };
}

/** Las de alta primero; dentro de la misma prioridad, el orden de la plantilla. */
function ordena(tareas: TareaDelDia[]) {
  return tareas.map((t, i) => ({ t, i })).sort((a, b) => PESO[a.t.prioridad] - PESO[b.t.prioridad] || a.i - b.i).map((x) => x.t);
}

/**
 * Lo que quedó sin hacer de días anteriores a hoy: lo de los microciclos que
 * tocan la última semana (sin pasar de `INICIO_AVISOS`) y cualquier tarea
 * propia vencida. Es lo que enseña el aviso al entrar y lo que manda el correo.
 */
export function pendientesAnteriores({ partidos, hoy, hechas, doc, sesiones }: Entrada): TareaDelDia[] {
  const ayer = isoMas(hoy, -1);

  const desde = [INICIO_AVISOS, isoMas(hoy, -DIAS_DE_AVISO)].sort()[1];

  const todos = alrededorDe(partidos, Date.parse(`${hoy}T12:00:00`)).todos;

  const fuera: TareaDelDia[] = [];

  todos.forEach((p, i) => {
    const anterior = todos[i - 1]?.cuando ?? null;

    const fin = p.cuando.slice(0, 10);

    const inicio = anterior ? isoMas(anterior.slice(0, 10), 1) : isoMas(fin, -6);

    if (fin < desde || inicio > ayer) return;

    for (const d of agendaDelMicro(p.cuando, anterior, sesiones)) {
      if (d.fecha < desde || d.fecha > ayer) continue;

      for (const t of d.tareas) {
        const una = deLaPlantilla(p.cuando, d, t, hechas);

        if (!una.hecha && !doc.quitadas[una.clave]) fuera.push(una);
      }
    }
  });

  for (const t of doc.propias) if (!t.hecha && t.fecha < hoy && t.fecha >= INICIO_AVISOS) fuera.push(dePropia(t));

  return fuera.sort((a, b) => a.fecha.localeCompare(b.fecha) || PESO[a.prioridad] - PESO[b.prioridad]);
}

/* ------------------------------------------------------------------ */
/*  LO QUE HACE EL ANALISTA                                            */
/* ------------------------------------------------------------------ */

/** Un id que no choca entre aparatos. Se llama desde un manejador, nunca en el render. */
export function nuevoId() {
  return `t-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`;
}

/** Marcar o desmarcar una automática (va al documento de lo marcado). */
export function alternaHechaAuto(hechas: Hechas, clave: string, hecha: boolean): Hechas {
  const nuevo = { ...hechas };

  if (hecha) nuevo[clave] = true;
  else delete nuevo[clave];

  return nuevo;
}

/** Marcar o desmarcar una propia. */
export function alternaHechaPropia(doc: DocPropias, id: string, hecha: boolean): DocPropias {
  return { ...doc, propias: doc.propias.map((t) => (t.id === id ? { ...t, hecha } : t)) };
}

export function quita(doc: DocPropias, t: TareaDelDia): DocPropias {
  return t.tipo === "auto"
    ? { ...doc, quitadas: { ...doc.quitadas, [t.clave]: true } }
    : { ...doc, propias: doc.propias.filter((p) => p.id !== t.id) };
}

export type Cambios = { texto?: string; fecha?: string; prioridad?: Prioridad };

/**
 * Editar (texto, día, prioridad). Una automática se quita y nace propia con
 * lo cambiado: `id` es el de la nueva, y lo da quien llama.
 */
export function edita(doc: DocPropias, t: TareaDelDia, cambios: Cambios, id: string): DocPropias {
  const texto = cambios.texto?.trim() || t.texto;

  const fecha = cambios.fecha || t.fecha;

  const prioridad = cambios.prioridad ?? t.prioridad;

  if (t.tipo === "propia") {
    return { ...doc, propias: doc.propias.map((p) => (p.id === t.id ? { ...p, texto, fecha, prioridad } : p)) };
  }

  const nueva: TareaPropia = { id, fecha, texto, prioridad, hecha: t.hecha, origen: t.clave };

  if (t.hecho) nueva.hecho = t.hecho;
  if (t.href) nueva.href = t.href;

  return { quitadas: { ...doc.quitadas, [t.clave]: true }, propias: [...doc.propias, nueva] };
}

export function anade(doc: DocPropias, nueva: { fecha: string; texto: string; prioridad: Prioridad }, id: string): DocPropias {
  return { ...doc, propias: [...doc.propias, { id, fecha: nueva.fecha, texto: nueva.texto.trim(), prioridad: nueva.prioridad }] };
}

/** «Sábado 31/10». */
export function rotuloDia(fecha: string) {
  const d = new Date(`${fecha}T12:00:00Z`);

  return `${["Domingo", "Lunes", "Martes", "Miércoles", "Jueves", "Viernes", "Sábado"][d.getUTCDay()]} ${fecha.slice(8, 10)}/${fecha.slice(5, 7)}`;
}

/** Hoy en Madrid, «2026-10-31». Para manejadores y efectos, no para el render. */
export function hoyEnMadrid() {
  return new Date().toLocaleDateString("sv-SE", { timeZone: "Europe/Madrid" });
}
