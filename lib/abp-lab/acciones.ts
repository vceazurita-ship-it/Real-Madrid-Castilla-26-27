/**
 * LO MEJOR A BALÓN PARADO DE CADA JORNADA (laboratorio de ABP, 25/10/2026).
 *
 * El dato es `public/data/abp-acciones.json`, que arma `scripts/abp-acciones.cjs`
 * con lo que baja de Wyscout `scripts/wyscout-abp-acciones.mjs`: por
 * competición y jornada, las cinco mejores acciones a balón parado que
 * acabaron en remate. Aquí sólo hay tipos y cuentas puras: cómo se pasa una
 * acción de las coordenadas de Wyscout (0-100, atacando hacia x = 100) a los
 * metros de la pizarra del laboratorio (`campo.ts`: x de banda a banda, y desde
 * la línea de fondo) y el borrador de rutina que crea «Al taller».
 *
 * Lo que Wyscout no da no viene en el JSON y no se nombra.
 */

import { ANCHO, LARGO, limita } from "@/lib/abp-lab/campo";
import type { Punto, Rol, Zona } from "@/lib/abp-lab/modelo";
import type { TipoAbp } from "@/lib/abp-lab/referentes";

export type TipoAccion = "corner" | "falta" | "directa" | "banda" | "penalti";

export type ResultadoAccion = "gol" | "puerta" | "palo" | "bloqueado" | "fuera";

/** Un punto de Wyscout: [x (hacia la portería rival), y (de banda a banda)], de 0 a 100. */
export type PuntoWy = [number, number];

export type Accion = {
  t: TipoAccion;
  r: ResultadoAccion;
  min: number;
  /** Segundo del partido según Wyscout (para saltar en nuestro vídeo). */
  seg: number;
  parte: number;
  /** «Arsenal - Everton 2-0». */
  p: string;
  /** Id del partido en Wyscout. */
  id: string;
  fecha: string;
  eq?: string;
  rival?: string;
  /** Lanzador (sólo si no es el mismo que remata). */
  lz?: string;
  /** Rematador. */
  rm?: string;
  xg?: number;
  cabeza?: boolean;
  /** Segundos entre el saque y el remate. */
  tras?: number;
  saque?: PuntoWy;
  caida?: PuntoWy;
  remate?: PuntoWy;
  /** Segundo del resumen de YouTube en el que se ve (sólo si una marca del vídeo la nombra sin duda). */
  vt?: number;
};

export type JornadaAcciones = {
  n: number | null;
  etiqueta: string;
  desde: string;
  hasta: string;
  partidos: number;
  acciones: number;
  goles: number;
  porTipo: Partial<Record<TipoAccion, number>>;
  top: Accion[];
};

export type CompeticionAcciones = {
  slug: string;
  nombre: string;
  corto: string;
  partidos: number;
  acciones: number;
  goles: number;
  /** Partidos de la competición con su resumen oficial encontrado en YouTube. */
  conVideo?: number;
  jornadas: JornadaAcciones[];
  /** Id del partido en Wyscout → resumen oficial en YouTube (vídeo y canal). */
  videos?: Record<string, { v: string; c: string }>;
};

export type AbpAcciones = { generado: string; temporada: string; competiciones: CompeticionAcciones[] };

export const TIPO_ACCION: Record<TipoAccion, string> = {
  corner: "Córner",
  falta: "Falta",
  directa: "Falta directa",
  banda: "Saque de banda",
  penalti: "Penalti",
};

export const RESULTADO_ACCION: Record<ResultadoAccion, string> = {
  gol: "Gol",
  puerta: "A puerta",
  palo: "Al palo",
  bloqueado: "Bloqueado",
  fuera: "Fuera",
};

/** El tipo de la pizarra del laboratorio que le corresponde. */
export const tipoAbpDe = (t: TipoAccion): TipoAbp => (t === "directa" ? "falta" : t);

/** De Wyscout a metros de la pizarra. */
export function aMetros([x, y]: PuntoWy): Punto {
  return limita({ x: (y / 100) * ANCHO, y: Math.min(LARGO, ((100 - x) / 100) * 105) });
}

const PORTERIA_CENTRO: Punto = { x: 34, y: 0.2 };

const distancia = (a: Punto, b: Punto) => Math.hypot(a.x - b.x, a.y - b.y);

/** En qué zona cae un balón, mirando desde qué lado se sacó (el primer palo es el del lanzador). */
export function zonaDe(p: Punto, desde?: Punto): Zona {
  if (p.y > 16.5) return "frontal";

  if (p.x < 13.84 || p.x > 54.16) return "corto";

  if (Math.abs(p.x - 34) <= 3) return p.y <= 2.5 ? "portero" : "centro";

  const izquierda = (desde?.x ?? 0) < 34;

  return p.x < 34 === izquierda ? "primer-palo" : "segundo-palo";
}

export const ZONA_TEXTO: Record<Zona, string> = {
  "primer-palo": "en el primer palo",
  centro: "en el centro del área pequeña",
  "segundo-palo": "en el segundo palo",
  portero: "encima del portero",
  frontal: "en la frontal",
  corto: "en corto",
  atras: "atrás, lejos del área",
};

/** La acción en metros: dónde se sacó, dónde cayó y dónde se remató (lo que conste). */
export function enMetros(a: Accion) {
  const saque = a.saque ? aMetros(a.saque) : undefined;

  const caida = a.caida ? aMetros(a.caida) : undefined;

  const remate = a.remate ? aMetros(a.remate) : undefined;

  return { saque, caida, remate };
}

/** ¿Hay algo que dibujar? Hace falta al menos el saque o el remate. */
export const dibujable = (a: Accion) => Boolean(a.saque || a.remate);

const coma = (v: number) => v.toFixed(2).replace(".", ",");

/** «0,31». */
export const xgTexto = (xg: number) => coma(xg);

/** La rutina que se dibuja de una acción: lanzador, rematador y el vuelo del balón. */
export function rutinaDeAccion(a: Accion): { nombre: string; tipo: TipoAbp; roles: Rol[]; balon: Punto[] } {
  const tipo = tipoAbpDe(a.t);

  const { saque, caida, remate } = enMetros(a);

  const roles: Rol[] = [];

  const golpeo = saque ?? (a.t === "penalti" ? { x: 34, y: 11 } : undefined);

  const directo = a.t === "directa" || a.t === "penalti";

  if (golpeo && !directo) {
    roles.push({ jugador: "", papel: "lanzador", zona: a.t === "falta" ? "frontal" : "corto", x: golpeo.x, y: golpeo.y, ...(a.lz ? { nota: a.lz } : {}) });
  }

  const final = remate ?? caida;

  if (final) {
    /* La salida no la da Wyscout: unos metros por detrás de donde remata, para que se vea la carrera. */
    const salida = directo ? final : limita({ x: final.x + (final.x < 34 ? 2.5 : -2.5), y: final.y + 5.5 });

    roles.push({
      jugador: "",
      papel: directo ? "lanzador" : "rematador",
      zona: zonaDe(final, golpeo),
      x: salida.x,
      y: salida.y,
      ...(directo ? {} : { hx: final.x, hy: final.y, fase: 2 as const }),
      ...(a.rm ? { nota: a.rm } : {}),
    });
  }

  const balon: Punto[] = [];

  if (golpeo) balon.push(golpeo);

  if (directo) {
    balon.push(PORTERIA_CENTRO);
  } else {
    if (caida) balon.push(caida);

    if (remate && (!caida || distancia(caida, remate) > 2.5)) balon.push(remate);
  }

  return { nombre: `${a.eq ?? TIPO_ACCION[a.t]} · ${a.min}'`, tipo, roles, balon };
}

/** El texto de la acción para la idea de la rutina: sólo lo que consta. */
export function relatoDe(a: Accion, competicion: string, jornada: string) {
  const { saque, caida } = enMetros(a);

  const partes: string[] = [];

  partes.push(`${TIPO_ACCION[a.t]} de ${a.eq ?? "Wyscout"}${a.rival ? ` ante ${a.rival}` : ""}, minuto ${a.min} (${a.p}; ${competicion}, ${jornada}).`);

  if (a.lz) partes.push(`Saca ${a.lz}.`);

  if (caida && a.t !== "directa" && a.t !== "penalti") partes.push(`El balón cae ${ZONA_TEXTO[zonaDe(caida, saque)]}.`);

  if (a.rm) partes.push(`Remata ${a.rm}${a.cabeza ? " de cabeza" : ""}${a.tras && a.tras > 4 ? `, a los ${a.tras} s del saque` : ""}.`);

  partes.push(`Resultado: ${RESULTADO_ACCION[a.r].toLowerCase()}${a.xg ? ` (xG ${xgTexto(a.xg)})` : ""}.`);

  return partes.join(" ");
}

/**
 * El vídeo de una acción. Wyscout no da enlaces a sus clips, así que es el
 * resumen oficial del partido en YouTube; con `vt`, en el segundo de la acción.
 * Sin resumen encontrado no hay vídeo (y no se enseña el botón).
 */
export function videoDe(a: Accion, c: CompeticionAcciones): { url: string; etiqueta: string; canal: string } | null {
  const v = c.videos?.[a.id];

  if (!v || !/^[\w-]{11}$/.test(v.v)) return null;

  const exacto = typeof a.vt === "number" && a.vt >= 0;

  return {
    url: `https://www.youtube.com/watch?v=${v.v}${exacto ? `&t=${Math.max(0, Math.round(a.vt as number) - 2)}s` : ""}`,
    etiqueta: exacto ? "Ver la acción" : "Resumen del partido",
    canal: v.c,
  };
}

/** La jornada que se abre por defecto: la última con acciones. */
export function ultimaJornada(c: CompeticionAcciones) {
  for (let i = c.jornadas.length - 1; i >= 0; i--) if (c.jornadas[i].top.length) return i;

  return Math.max(0, c.jornadas.length - 1);
}
