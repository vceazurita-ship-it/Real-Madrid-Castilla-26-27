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

import { ANCHO, LARGO, VUELO, limita } from "@/lib/abp-lab/campo";
import type { Punto, Rol, Zona } from "@/lib/abp-lab/modelo";
import type { TipoAbp } from "@/lib/abp-lab/referentes";

export type TipoAccion = "corner" | "falta" | "directa" | "banda" | "penalti";

export type ResultadoAccion = "gol" | "puerta" | "palo" | "bloqueado" | "fuera";

/** Un punto de Wyscout: [x (hacia la portería rival), y (de banda a banda)], de 0 a 100. */
export type PuntoWy = [number, number];

/** Un toque de la cadena: dónde, quién y si es del rival. */
export type PasoWy = [number, number, string] | [number, number, string, 1];

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
  /**
   * Los toques entre el saque y el remate, en orden: [x, y, jugador] y un 1
   * detrás si es del rival (ya girado a nuestro sentido). Sin ellos, la acción
   * fue saque y remate (o se bajó antes del 27/10/2026).
   */
  pasos?: PasoWy[];
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

const suaveInversa = (f: number) => (f < 0.5 ? Math.sqrt(f / 2) : 1 - Math.sqrt(2 * (1 - f)) / 2);

/**
 * El instante (0-1) en que el balón pasa por cada punto del camino: el mismo
 * reloj que `estadoBalon` (velocidad constante con arranque y frenada suaves
 * dentro de `VUELO`), para que cada jugador esté en su toque justo entonces.
 */
function llegadas(camino: Punto[]) {
  const tramos = camino.slice(1).map((p, i) => distancia(p, camino[i]));

  const total = tramos.reduce((x, y) => x + y, 0) || 1;

  let suma = 0;

  return camino.map((_, k) => {
    if (k > 0) suma += tramos[k - 1];

    return VUELO[0] + (VUELO[1] - VUELO[0]) * suaveInversa(Math.min(1, suma / total));
  });
}

const r3 = (v: number) => Math.round(v * 1000) / 1000;

/** El papel de un toque intermedio, por dónde fue: cerca del saque es la jugada en corto. */
function papelDelToque(p: Punto, golpeo?: Punto): Rol["papel"] {
  if (golpeo && distancia(p, golpeo) < 20) return "corto";

  if (p.y > 16.5) return "segunda";

  if (p.x < 13.84 || p.x > 54.16) return "corto";

  return "rematador";
}

/**
 * La rutina que se dibuja de una acción, tal como fue: el balón pasa por cada
 * toque de Wyscout (saque, toques intermedios, remate) y cada jugador nuestro
 * que lo toca está en su sitio cuando le llega. Lo único que no da Wyscout es
 * de dónde arranca el rematador que no había tocado antes: unos metros por
 * detrás de su remate, para que se vea la carrera.
 */
export function rutinaDeAccion(a: Accion): { nombre: string; tipo: TipoAbp; roles: Rol[]; balon: Punto[] } {
  const tipo = tipoAbpDe(a.t);

  const { saque, caida, remate } = enMetros(a);

  const nombre = `${a.eq ?? TIPO_ACCION[a.t]} · ${a.min}'`;

  const golpeo = saque ?? (a.t === "penalti" ? { x: 34, y: 11 } : undefined);

  const directo = a.t === "directa" || a.t === "penalti";

  if (directo) {
    const roles: Rol[] = [];

    const final = remate ?? golpeo;

    if (final) roles.push({ jugador: "", papel: "lanzador", zona: zonaDe(final, golpeo), x: final.x, y: final.y, ...(a.rm ? { nota: a.rm } : {}) });

    return { nombre, tipo, roles, balon: golpeo ? [golpeo, PORTERIA_CENTRO] : [] };
  }

  const toques = (a.pasos ?? []).map(([x, y, j, r]) => ({ p: aMetros([x, y]), j, rival: r === 1 }));

  const final = remate ?? (toques.length ? undefined : caida);

  /* Sin cadena, el camino de antes: saque, caída y remate (si la caída no es ya el remate). */
  const balon: Punto[] = [];

  if (golpeo) balon.push(golpeo);

  if (toques.length) balon.push(...toques.map((t) => t.p));
  else if (caida && (!remate || distancia(caida, remate) > 2.5)) balon.push(caida);

  if (final) balon.push(final);

  const t = llegadas(balon);

  /* Quién toca y en qué punto del camino (el saque es el 0; el remate, el último). */
  const desfase = golpeo ? 1 : 0;

  const lanzador = a.lz ?? (golpeo ? a.rm : undefined);

  const toquesDe = new Map<string, number[]>();

  const apunta = (j: string, k: number) => toquesDe.set(j, [...(toquesDe.get(j) ?? []), k]);

  if (golpeo && lanzador) apunta(lanzador, 0);

  toques.forEach((x, i) => {
    if (!x.rival && x.j) apunta(x.j, i + desfase);
  });

  if (final && a.rm) apunta(a.rm, balon.length - 1);

  const roles: Rol[] = [];

  if (golpeo && !lanzador) roles.push({ jugador: "", papel: "lanzador", zona: a.t === "falta" ? "frontal" : "corto", x: golpeo.x, y: golpeo.y });

  /* Un toque nuestro sin nombre (Wyscout casi siempre lo da) se dibuja quieto en su sitio. */
  toques.forEach((x) => {
    if (!x.rival && !x.j) roles.push({ jugador: "", papel: papelDelToque(x.p, golpeo), zona: zonaDe(x.p, golpeo), x: x.p.x, y: x.p.y });
  });

  for (const [j, ks] of toquesDe) {
    const primero = ks[0];

    const ultimo = ks[ks.length - 1];

    const remata = final !== undefined && ultimo === balon.length - 1 && j === a.rm;

    const papel: Rol["papel"] = primero === 0 && golpeo ? "lanzador" : remata ? "rematador" : papelDelToque(balon[primero], golpeo);

    /* El rematador que no había tocado antes arranca unos metros por detrás (eso no lo da Wyscout). */
    const salida =
      remata && ks.length === 1 ? limita({ x: balon[ultimo].x + (balon[ultimo].x < 34 ? 2.5 : -2.5), y: balon[ultimo].y + 5.5 }) : balon[primero];

    const corre = ks.length > 1 || remata;

    roles.push({
      jugador: "",
      papel,
      zona: papel === "lanzador" ? (a.t === "falta" ? "frontal" : "corto") : zonaDe(balon[ultimo], golpeo),
      x: salida.x,
      y: salida.y,
      ...(corre && distancia(salida, balon[ultimo]) > 0.3
        ? { hx: balon[ultimo].x, hy: balon[ultimo].y, fase: 2 as const, llega: r3(t[ultimo]), ...(ks.length > 1 ? { sale: r3(t[ks[ks.length - 2]]) } : {}) }
        : {}),
      nota: j,
    });
  }

  return { nombre, tipo, roles, balon };
}

/** «Saca Saka en corto a Lewis-Skelly; Saka; White; despeja Thomas (rival)…», en orden. */
export function cadenaTexto(a: Accion) {
  if (!a.pasos?.length) return "";

  return a.pasos.map(([, , j, r]) => (r === 1 ? `${j || "un rival"} (rival)` : j || "un compañero")).join(" → ");
}

/** El texto de la acción para la idea de la rutina: sólo lo que consta. */
export function relatoDe(a: Accion, competicion: string, jornada: string) {
  const { saque, caida } = enMetros(a);

  const partes: string[] = [];

  partes.push(`${TIPO_ACCION[a.t]} de ${a.eq ?? "Wyscout"}${a.rival ? ` ante ${a.rival}` : ""}, minuto ${a.min} (${a.p}; ${competicion}, ${jornada}).`);

  if (a.lz) partes.push(`Saca ${a.lz}.`);

  if (caida && a.t !== "directa" && a.t !== "penalti") partes.push(`El balón cae ${ZONA_TEXTO[zonaDe(caida, saque)]}.`);

  if (a.pasos?.length) partes.push(`Toques antes del remate: ${cadenaTexto(a)}.`);

  if (a.rm) partes.push(`Remata ${a.rm}${a.cabeza ? " de cabeza" : ""}${a.tras && a.tras > 4 ? `, a los ${a.tras} s del saque` : ""}.`);

  partes.push(`Resultado: ${RESULTADO_ACCION[a.r].toLowerCase()}${a.xg ? ` (xG ${xgTexto(a.xg)})` : ""}.`);

  return partes.join(" ");
}

/**
 * El vídeo de una acción. Wyscout no da enlaces a sus clips, así que es el
 * resumen oficial del partido en YouTube; con `vt`, en el segundo de la acción.
 * Sin resumen encontrado no hay vídeo (y no se enseña el botón).
 */
export function videoDe(a: Accion, c: Pick<CompeticionAcciones, "videos">): { url: string; etiqueta: string; canal: string } | null {
  const v = c.videos?.[a.id];

  if (!v || !/^[\w-]{11}$/.test(v.v)) return null;

  const exacto = typeof a.vt === "number" && a.vt >= 0;

  return {
    url: `https://www.youtube.com/watch?v=${v.v}${exacto ? `&t=${Math.max(0, Math.round(a.vt as number) - 2)}s` : ""}`,
    etiqueta: exacto ? "Ver la acción" : "Resumen del partido",
    canal: v.c,
  };
}

/** «58:47»: los segundos de partido que trae Wyscout. */
export const mmss = (seg: number) => `${Math.floor(seg / 60)}:${String(Math.round(seg % 60)).padStart(2, "0")}`;

/** «Antequera - Ibiza 3-2» → nombre y marcador por separado. */
export function partidoSinMarcador(p: string) {
  const m = p.match(/^(.*?)\s+(\d+-\d+)\s*$/);

  return m ? { nombre: m[1], marcador: m[2] } : { nombre: p, marcador: "" };
}

/** «Antequera - Ibiza · Jornada 1 · min 54' (58:47) · Córner»: lo que se pega en el buscador de Wyscout. */
export function textoParaBuscar(a: Accion, jornada: string) {
  return `${partidoSinMarcador(a.p).nombre} · ${jornada} · min ${a.min}' (${mmss(a.seg)}) · ${TIPO_ACCION[a.t]}`;
}

/** «12:03» del resumen de YouTube, sólo si consta. */
export const tiempoVideo = (a: Accion) => (typeof a.vt === "number" && a.vt >= 0 ? mmss(a.vt) : "");

/** La jornada que se abre por defecto: la última con acciones. */
export function ultimaJornada(c: CompeticionAcciones) {
  for (let i = c.jornadas.length - 1; i >= 0; i--) if (c.jornadas[i].top.length) return i;

  return Math.max(0, c.jornadas.length - 1);
}
