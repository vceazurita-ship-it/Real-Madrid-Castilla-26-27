/**
 * LOS ENCARGOS AL ORDENADOR DEL CLUB.
 *
 * Hay trabajos que el servidor no puede hacer: BeSoccer no atiende a las IP de
 * centro de datos y Wyscout sólo se baja manejando un Chrome con la sesión
 * puesta. Los hace el ordenador del club. Los botones de Ajustes **dejan un
 * encargo** en el documento `mantenimiento` y el vigía de ese ordenador
 * (`scripts/vigia.cjs`) lo recoge en segundos, lo ejecuta y apunta cómo fue.
 *
 * Este módulo es la forma del documento y las reglas para leerlo. Lo comparten
 * la pantalla, las rutas y los scripts de Node (por `scripts/cargador-ts.cjs`),
 * así que no importa nada de React ni del servidor.
 */

import type { EtapaHecha, ProgresoVivo } from "./progreso";

export const CLAVE_MANTENIMIENTO = "mantenimiento";

/** El latido del vigía va en su propio documento: escribe cada medio minuto y
    no debe pisar un encargo que se deja en ese mismo instante. */
export const CLAVE_VIGIA = "mantenimiento:vigia";

/* `carpeta` (27/09/2026): recoger la carpeta de análisis de una jornada —vídeos
   de ABP y de centros, y los PDF— y dejarla en la ficha del rival.
   `partido` (02/10/2026): el análisis entero del último partido —Wyscout, el
   timeline de Hudl y la cámara táctica— volcado en todas las secciones que lo
   leen. Lo hace `scripts/analisis-partido.cjs`. */
export const TAREAS = ["quiniela", "rivales", "wyscout", "carpeta", "partido"] as const;

export type Tarea = (typeof TAREAS)[number];

export type Encargo = {
  /** Cuándo se pidió la última vez, y quién. */
  pedidoEn?: string;
  pedidoPor?: string;
  /** Cuándo empezó el ordenador del club a hacerlo. */
  empezadoEn?: string;
  /** Cuándo terminó y cómo fue. */
  hechoEn?: string;
  resultado?: string;
  ok?: boolean;
  /** Por dónde va un trabajo largo («3/6 · Timeline de Hudl»); sólo `partido`. */
  paso?: string;
  /**
   * Las etapas que hay que hacer en esta pasada (índices de `ETAPAS`); sin
   * él, todas. Lo pone quien pide «repetir sólo lo que falló»: el resto se
   * aprovecha de la pasada anterior (lib/progreso.ts, `planRecomendado`).
   */
  plan?: number[];
  /** Cómo fue cada etapa de la última pasada, con lo que tardó (lib/progreso.ts). */
  recorrido?: EtapaHecha[];
  /** Cómo quedó cada sección al acabar; sólo `partido`. */
  secciones?: SeccionPartido[];
  /** Lo que necesita el encargo para hacerse; sólo lo usa `carpeta`. */
  datos?: DatosCarpeta;
};

export type SeccionPartido = {
  /** «Saques de banda ofensivos», «Robos y transiciones»… */
  nombre: string;
  ok: boolean;
  /** «17 de 17 en la hoja», «no hay timeline en Hudl»… */
  detalle: string;
};

export type DatosCarpeta = {
  /** La carpeta tal y como se ve en el ordenador del club. */
  ruta: string;
  /** El equipo tal y como viene en la hoja de plantillas rivales. */
  equipo: string;
  /** «J5»; si no viene, sale del nombre de la carpeta. */
  jornada?: string;
};

export type Mantenimiento = Partial<Record<Tarea, Encargo>>;

export type Vigia = {
  vistoEn?: string;
  equipo?: string;
  /** Lo que está haciendo ahora mismo. */
  ocupado?: Tarea[];
  /** Por dónde va el análisis del partido, si está en marcha (va aquí y no en
      el encargo para no reescribir los encargos cada pocos segundos). */
  paso?: string;
  /** Por dónde va cada trabajo en marcha: etapa, cuenta y lo aprendido de
      otras pasadas (lib/progreso.ts). Viaja aquí, en el latido, por lo mismo
      que `paso`. */
  progreso?: Partial<Record<Tarea, ProgresoVivo>>;
};

/** Más de esto sin latido y el vigía se da por apagado. */
export const VIGIA_VIVO_MS = 2 * 60_000;

/**
 * Lo que puede tardar cada trabajo antes de darlo por cortado.
 *
 * Si el ordenador se apaga a media pasada, el encargo se quedaría «en marcha»
 * para siempre y el botón bloqueado. Pasado este plazo se puede volver a pedir
 * y el vigía lo vuelve a coger.
 */
export const LIMITE_MIN: Record<Tarea, number> = {
  quiniela: 10,
  rivales: 100,
  wyscout: 60,
  carpeta: 45,
  /* Wyscout, Hudl y mirar en vídeo cada jugada a balón parado: horas. Más
     allá de esto, el ordenador se apagó a media pasada. */
  partido: 12 * 60,
};

export function esTarea(valor: unknown): valor is Tarea {
  return typeof valor === "string" && (TAREAS as readonly string[]).includes(valor);
}

const ms = (iso?: string) => {
  const valor = iso ? Date.parse(iso) : NaN;

  return Number.isFinite(valor) ? valor : 0;
};

const masReciente = (a?: string, b?: string) => (ms(a) >= ms(b) ? a : b);

/**
 * El documento tal y como venga, en la forma de ahora.
 *
 * Hasta el 19/09/2026 sólo había un encargo —el de los rivales— y sus campos
 * iban sueltos en la raíz. Si aparecen, se leen como del de los rivales y se
 * queda la fecha más reciente de cada uno.
 */
export function normalizaMantenimiento(crudo: unknown): Mantenimiento {
  const doc = (crudo && typeof crudo === "object" ? crudo : {}) as Record<string, unknown>;

  const salida: Mantenimiento = {};

  for (const tarea of TAREAS) {
    const suyo = doc[tarea];

    if (suyo && typeof suyo === "object") salida[tarea] = { ...(suyo as Encargo) };
  }

  const viejo = doc as Encargo;

  if (viejo.pedidoEn || viejo.hechoEn) {
    const rivales = salida.rivales ?? {};

    const pedido = masReciente(rivales.pedidoEn, viejo.pedidoEn);

    const hecho = masReciente(rivales.hechoEn, viejo.hechoEn);

    salida.rivales = {
      ...rivales,
      pedidoEn: pedido,
      pedidoPor: pedido === viejo.pedidoEn ? viejo.pedidoPor : rivales.pedidoPor,
      hechoEn: hecho,
      resultado: hecho === viejo.hechoEn ? viejo.resultado : rivales.resultado,
    };
  }

  return salida;
}

export type EstadoEncargo =
  /** Nada pendiente. */
  | "libre"
  /** Pedido y todavía sin empezar. */
  | "pedido"
  /** El ordenador del club está en ello. */
  | "en-marcha"
  /** Empezó hace más de lo que puede durar y no terminó: se cortó. */
  | "cortado";

export function estadoEncargo(
  tarea: Tarea,
  encargo: Encargo | undefined,
  ahora = Date.now(),
): EstadoEncargo {
  if (!encargo) return "libre";

  const pedido = ms(encargo.pedidoEn);

  const empezado = ms(encargo.empezadoEn);

  const hecho = ms(encargo.hechoEn);

  /* Un pedido posterior a todo lo demás manda: es lo que se vuelve a pedir
     después de una pasada cortada. */
  if (pedido && pedido > hecho && pedido > empezado) return "pedido";

  if (empezado && empezado > hecho) {
    return ahora - empezado > LIMITE_MIN[tarea] * 60_000 ? "cortado" : "en-marcha";
  }

  return "libre";
}

export function vigiaVivo(vigia: Vigia | null | undefined, ahora = Date.now()) {
  const visto = ms(vigia?.vistoEn);

  return visto > 0 && ahora - visto < VIGIA_VIVO_MS;
}
