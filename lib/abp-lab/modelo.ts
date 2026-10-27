/**
 * EL LABORATORIO DE ABP: SUS REGLAS (20/10/2026).
 *
 * Un solo documento, `abp-laboratorio` en `app_documents`, con lo que se
 * crea en el taller (rutinas propias) y lo que se juega en los retos
 * (precisión en el entrenamiento y preguntas de lectura de jugada).
 *
 * Igual que las apuestas del staff: aquí sólo hay reglas, sin navegador ni
 * Supabase, y `aplica` es lo único que cambia el documento. Lo usa
 * `/api/abp-lab/guardar`, que exige la sesión de administrador; `/api/docs`
 * ni lo lee ni lo escribe (es del administrador, y nadie más lo ve todavía).
 *
 * `abiertoJugadores` es el interruptor para el día en que los retos se abran
 * a la plantilla. Hoy sólo se guarda: la pantalla sigue siendo del
 * administrador.
 */

import { extraPizarraDe, origenDe, type ExtraPizarra, type OrigenPizarra } from "@/lib/abp-lab/puente-tipos";
import type { TipoAbp } from "@/lib/abp-lab/referentes";

export const CLAVE_LAB = "abp-laboratorio";

/* ------------------------------------------------------------------ */
/*  TIPOS                                                              */
/* ------------------------------------------------------------------ */

export type Lado = "ofensivo" | "defensivo";

export type Defensa = "zona" | "mixta" | "hombre" | "cualquiera";

export type Estado = "idea" | "probada" | "partido";

export type Papel = "lanzador" | "rematador" | "bloqueador" | "senuelo" | "portero" | "segunda" | "vigilancia" | "corto" | "zonal" | "marcador";

export type Zona = "primer-palo" | "centro" | "segundo-palo" | "portero" | "frontal" | "corto" | "atras";

/** Cuándo arranca la carrera: antes del saque, con el golpeo o a por el rechace. */
export type Fase = 1 | 2 | 3;

/** Cómo va el balón por el aire: define la altura del vuelo en la simulación. */
export type Envio = "tenso" | "bombeado" | "raso";

export const ENVIOS: { key: Envio; label: string }[] = [
  { key: "tenso", label: "Tenso" },
  { key: "bombeado", label: "Bombeado" },
  { key: "raso", label: "Raso" },
];

/** Un punto del medio campo en metros: x de banda a banda (0-68), y desde la línea de fondo (0-52,5). */
export type Punto = { x: number; y: number };

export type Rol = {
  /** Id del jugador de la plantilla; vacío si el papel aún no tiene dueño. */
  jugador: string;
  papel: Papel;
  zona: Zona;
  nota?: string;
  /** Dónde arranca, si se ha colocado a mano en la pizarra (si no, sale de la zona). */
  x?: number;
  y?: number;
  /** Adónde va su carrera, si la tiene. */
  hx?: number;
  hy?: number;
  fase?: Fase;
  /** Acción real (Wyscout): el instante (0-1) en que le llega el balón; corre justo antes. */
  llega?: number;
  /** Y el de su toque anterior: no sale antes (el que saca y vuelve a tocar). */
  sale?: number;
  /** La ficha de la pizarra de ABP de la que salió (su id), para devolverla a su sitio. */
  ref?: string;
};

/** El camino de entrenamiento de una rutina, de la pizarra al partido. */
export const PROGRESION: { key: string; label: string; detalle: string }[] = [
  { key: "charla", label: "Explicada", detalle: "Pizarra y vídeo en la charla" },
  { key: "sin-oposicion", label: "Sin oposición", detalle: "Ritmos, señal y golpeo" },
  { key: "pasiva", label: "Oposición pasiva", detalle: "Con defensores que no disputan" },
  { key: "activa", label: "Oposición activa", detalle: "Contra una defensa de verdad" },
  { key: "partidillo", label: "En partidillo", detalle: "Dentro de un partido de entrenamiento" },
  { key: "oficial", label: "En partido oficial", detalle: "Ya se ha usado compitiendo" },
];

export type Desenlace = "gol" | "remate" | "nada";

export const DESENLACES: { key: Desenlace; label: string }[] = [
  { key: "gol", label: "Gol" },
  { key: "remate", label: "Remate" },
  { key: "nada", label: "Sin remate" },
];

/** Una vez que se usó compitiendo, con lo que dio. */
export type Uso = { fecha: string; rival: string; desenlace: Desenlace };

export type Rutina = {
  id: string;
  nombre: string;
  tipo: TipoAbp;
  lado: Lado;
  /** Id de un referente o de una rutina de referente (`lib/abp-lab/referentes.ts`). */
  inspiracion?: string;
  contra: Defensa;
  /** Cómo se canta en el campo: «mano a la cabeza», «Bernabéu». */
  senal: string;
  idea: string;
  roles: Rol[];
  variantes: string[];
  estado: Estado;
  /** El recorrido del balón: el primer punto es donde se golpea. */
  balon?: Punto[];
  /** Cómo va el balón por el aire (si no se dice, tenso). */
  envio?: Envio;
  /** La rutina de la que es variante (su id), para la biblioteca. */
  padre?: string;
  /** Los pasos de `PROGRESION` ya dados. */
  progreso?: string[];
  /** Las veces que se ha usado compitiendo. */
  usos?: Uso[];
  /** La diapositiva de la pizarra de ABP de la que salió (ver `puente-pizarra.ts`). */
  origen?: OrigenPizarra;
  /** Lo de esa diapositiva que el laboratorio no pinta, para devolverlo sin perder nada. */
  pizarra?: ExtraPizarra;
  creadaEn: string;
  actualizadaEn: string;
};

export type Pregunta = {
  id: string;
  enunciado: string;
  opciones: string[];
  correcta: number;
  explicacion?: string;
  fuente?: { titulo: string; url: string };
};

export type TipoReto = "precision" | "quiz";

export type Reto = {
  id: string;
  tipo: TipoReto;
  titulo: string;
  descripcion: string;
  /** Día del reto, "2026-10-21". */
  fecha: string;
  /** Precisión: la marca máxima («de 10»). */
  maximo: number;
  /** Puntos por cada acierto (precisión: por unidad de marca; quiz: por pregunta). */
  puntos: number;
  preguntas: Pregunta[];
  /** Precisión: la marca de cada jugador. */
  marcas: Record<string, number>;
  /** Quiz: quién acertó cada pregunta. */
  aciertos: Record<string, string[]>;
  /** Quiz: quién jugó (para que fallarlo todo también cuente como jugado). */
  participantes: string[];
  cerrado: boolean;
  creadoEn: string;
};

export type DocumentoLab = {
  rutinas: Rutina[];
  retos: Reto[];
  abiertoJugadores: boolean;
};

export const LAB_VACIO: DocumentoLab = { rutinas: [], retos: [], abiertoJugadores: false };

/* ------------------------------------------------------------------ */
/*  ROTULOS                                                            */
/* ------------------------------------------------------------------ */

export const TIPOS: { key: TipoAbp; label: string }[] = [
  { key: "corner", label: "Córner" },
  { key: "falta", label: "Falta" },
  { key: "banda", label: "Saque de banda" },
  { key: "penalti", label: "Penalti" },
  { key: "saque", label: "Saque de centro" },
];

export const DEFENSAS: { key: Defensa; label: string }[] = [
  { key: "zona", label: "Contra zona" },
  { key: "mixta", label: "Contra mixta" },
  { key: "hombre", label: "Contra hombre" },
  { key: "cualquiera", label: "Contra cualquiera" },
];

export const ESTADOS: { key: Estado; label: string }[] = [
  { key: "idea", label: "Idea" },
  { key: "probada", label: "Probada" },
  { key: "partido", label: "En partido" },
];

export const PAPELES: { key: Papel; label: string; lado: Lado | "ambos" }[] = [
  { key: "lanzador", label: "Lanzador", lado: "ofensivo" },
  { key: "rematador", label: "Rematador", lado: "ofensivo" },
  { key: "bloqueador", label: "Bloqueador", lado: "ofensivo" },
  { key: "senuelo", label: "Señuelo", lado: "ofensivo" },
  { key: "portero", label: "Al portero", lado: "ofensivo" },
  { key: "corto", label: "Opción en corto", lado: "ambos" },
  { key: "segunda", label: "Segunda jugada", lado: "ambos" },
  { key: "vigilancia", label: "Vigilancia", lado: "ambos" },
  { key: "zonal", label: "Zonal", lado: "defensivo" },
  { key: "marcador", label: "Al hombre", lado: "defensivo" },
];

export const ZONAS: { key: Zona; label: string }[] = [
  { key: "primer-palo", label: "Primer palo" },
  { key: "centro", label: "Centro" },
  { key: "segundo-palo", label: "Segundo palo" },
  { key: "portero", label: "Sobre el portero" },
  { key: "frontal", label: "Frontal" },
  { key: "corto", label: "En corto" },
  { key: "atras", label: "Atrás" },
];

export const etiqueta = <K extends string>(lista: { key: K; label: string }[], key: K) => lista.find((x) => x.key === key)?.label ?? key;

/* ------------------------------------------------------------------ */
/*  RECHAZOS                                                           */
/* ------------------------------------------------------------------ */

export class Rechazo extends Error {
  constructor(
    mensaje: string,
    public estado = 400,
  ) {
    super(mensaje);
  }
}

/* ------------------------------------------------------------------ */
/*  NORMALIZAR LO QUE VIENE                                            */
/* ------------------------------------------------------------------ */

const texto = (v: unknown, max: number) => (typeof v === "string" ? v.trim().slice(0, max) : "");

const de = <K extends string>(lista: { key: K }[], v: unknown, defecto: K): K => (lista.some((x) => x.key === v) ? (v as K) : defecto);

const esFecha = (v: unknown): v is string => typeof v === "string" && /^\d{4}-\d{2}-\d{2}$/.test(v);

const entero = (v: unknown, min: number, max: number, defecto: number) => {
  const n = Math.round(Number(v));

  return Number.isFinite(n) ? Math.min(max, Math.max(min, n)) : defecto;
};

const LADOS: { key: Lado }[] = [{ key: "ofensivo" }, { key: "defensivo" }];

/** Una lista opcional: si viene vacía, el campo no se escribe (el documento no se llena de `[]`). */
const listaSi = <K extends string, T>(clave: K, lista: T[]) => (lista.length ? ({ [clave]: lista } as Record<K, T[]>) : {});

/** Una coordenada del medio campo, con un decimal; null si no es un número. */
const metro = (v: unknown, max: number) => {
  const n = Number(v);

  return v === null || v === undefined || v === "" || !Number.isFinite(n) ? null : Math.round(Math.min(max, Math.max(0, n)) * 10) / 10;
};

const punto = (v: unknown): Punto | null => {
  if (!v || typeof v !== "object") return null;

  const p = v as Record<string, unknown>;

  const x = metro(p.x, 68);

  const y = metro(p.y, 52.5);

  return x === null || y === null ? null : { x, y };
};

function rol(v: unknown): Rol | null {
  if (!v || typeof v !== "object") return null;

  const r = v as Record<string, unknown>;

  const inicio = punto(r);

  const destino = punto({ x: r.hx, y: r.hy });

  const fase = Number(r.fase);

  const llega = Number(r.llega);

  const sale = Number(r.sale);

  return {
    jugador: texto(r.jugador, 60),
    papel: de(PAPELES, r.papel, "rematador"),
    zona: de(ZONAS, r.zona, "centro"),
    ...(texto(r.nota, 140) ? { nota: texto(r.nota, 140) } : {}),
    ...(inicio ? { x: inicio.x, y: inicio.y } : {}),
    ...(destino ? { hx: destino.x, hy: destino.y } : {}),
    ...(fase === 1 || fase === 2 || fase === 3 ? { fase: fase as Fase } : {}),
    ...(r.llega != null && llega >= 0 && llega <= 1 ? { llega } : {}),
    ...(r.llega != null && r.sale != null && sale >= 0 && sale <= 1 ? { sale } : {}),
    ...(texto(r.ref, 40) ? { ref: texto(r.ref, 40) } : {}),
  };
}

function uso(v: unknown): Uso | null {
  if (!v || typeof v !== "object") return null;

  const u = v as Record<string, unknown>;

  if (!esFecha(u.fecha)) return null;

  return { fecha: u.fecha, rival: texto(u.rival, 60), desenlace: de(DESENLACES, u.desenlace, "nada") };
}

/** Cuántos papeles caben en una rutina (una diapositiva de la pizarra puede traer más de catorce caras). */
export const MAX_ROLES = 24;

export function rutinaDe(v: unknown, ahora: string, previa?: Rutina): Rutina {
  const r = (v && typeof v === "object" ? v : {}) as Record<string, unknown>;

  const nombre = texto(r.nombre, 80);

  if (!nombre) throw new Rechazo("La rutina necesita un nombre.");

  const origen = origenDe(r.origen);

  const pizarra = extraPizarraDe(r.pizarra);

  return {
    id: previa?.id ?? (texto(r.id, 40) || `rut-${Date.parse(ahora).toString(36)}${Math.random().toString(36).slice(2, 6)}`),
    nombre,
    tipo: de(TIPOS, r.tipo, "corner"),
    lado: de(LADOS, r.lado, "ofensivo"),
    ...(texto(r.inspiracion, 60) ? { inspiracion: texto(r.inspiracion, 60) } : {}),
    contra: de(DEFENSAS, r.contra, "cualquiera"),
    senal: texto(r.senal, 80),
    idea: texto(r.idea, 1200),
    roles: (Array.isArray(r.roles) ? r.roles : []).map(rol).filter((x): x is Rol => Boolean(x)).slice(0, MAX_ROLES),
    variantes: (Array.isArray(r.variantes) ? r.variantes : []).map((x) => texto(x, 240)).filter(Boolean).slice(0, 8),
    estado: de(ESTADOS, r.estado, "idea"),
    ...(r.envio === "tenso" || r.envio === "bombeado" || r.envio === "raso" ? { envio: r.envio as Envio } : {}),
    ...(texto(r.padre, 40) ? { padre: texto(r.padre, 40) } : {}),
    ...listaSi("balon", (Array.isArray(r.balon) ? r.balon : []).map(punto).filter((x): x is Punto => Boolean(x)).slice(0, 6)),
    ...listaSi("progreso", [...new Set((Array.isArray(r.progreso) ? r.progreso : []).filter((x): x is string => PROGRESION.some((p) => p.key === x)))]),
    ...listaSi(
      "usos",
      (Array.isArray(r.usos) ? r.usos : [])
        .map(uso)
        .filter((x): x is Uso => Boolean(x))
        .sort((a, b) => b.fecha.localeCompare(a.fecha))
        .slice(0, 60),
    ),
    ...(origen ? { origen } : {}),
    ...(pizarra ? { pizarra } : {}),
    creadaEn: previa?.creadaEn ?? ahora,
    actualizadaEn: ahora,
  };
}

function preguntaDe(v: unknown, i: number): Pregunta | null {
  if (!v || typeof v !== "object") return null;

  const p = v as Record<string, unknown>;

  const enunciado = texto(p.enunciado, 300);

  const opciones = (Array.isArray(p.opciones) ? p.opciones : []).map((x) => texto(x, 120)).filter(Boolean).slice(0, 4);

  if (!enunciado || opciones.length < 2) return null;

  const fuente = p.fuente && typeof p.fuente === "object" ? (p.fuente as Record<string, unknown>) : null;

  return {
    id: texto(p.id, 40) || `p${i + 1}`,
    enunciado,
    opciones,
    correcta: entero(p.correcta, 0, opciones.length - 1, 0),
    ...(texto(p.explicacion, 400) ? { explicacion: texto(p.explicacion, 400) } : {}),
    ...(fuente && texto(fuente.url, 400).startsWith("https://") ? { fuente: { titulo: texto(fuente.titulo, 160), url: texto(fuente.url, 400) } } : {}),
  };
}

export function retoDe(v: unknown, ahora: string, previo?: Reto): Reto {
  const r = (v && typeof v === "object" ? v : {}) as Record<string, unknown>;

  const titulo = texto(r.titulo, 90);

  if (!titulo) throw new Rechazo("El reto necesita un título.");

  if (!esFecha(r.fecha)) throw new Rechazo("Falta el día del reto.");

  const tipo: TipoReto = previo?.tipo ?? (r.tipo === "quiz" ? "quiz" : "precision");

  const preguntas = tipo === "quiz" ? (Array.isArray(r.preguntas) ? r.preguntas : []).map(preguntaDe).filter((x): x is Pregunta => Boolean(x)).slice(0, 20) : [];

  if (tipo === "quiz" && !preguntas.length) throw new Rechazo("El reto de preguntas necesita al menos una pregunta con dos respuestas.");

  /* Las ids de las preguntas no se repiten: los aciertos van por id. */
  const vistas = new Set<string>();

  preguntas.forEach((p, i) => {
    if (vistas.has(p.id)) p.id = `${p.id}-${i + 1}`;

    vistas.add(p.id);
  });

  return {
    id: previo?.id ?? (texto(r.id, 40) || `reto-${Date.parse(ahora).toString(36)}${Math.random().toString(36).slice(2, 6)}`),
    tipo,
    titulo,
    descripcion: texto(r.descripcion, 600),
    fecha: r.fecha,
    maximo: tipo === "precision" ? entero(r.maximo, 1, 100, 10) : preguntas.length,
    puntos: entero(r.puntos, 1, 50, tipo === "quiz" ? 3 : 1),
    preguntas,
    marcas: previo?.marcas ?? {},
    /* Si se quita una pregunta, sus aciertos se van con ella. */
    aciertos: Object.fromEntries(Object.entries(previo?.aciertos ?? {}).filter(([id]) => vistas.has(id))),
    participantes: previo?.participantes ?? [],
    cerrado: previo?.cerrado ?? false,
    creadoEn: previo?.creadoEn ?? ahora,
  };
}

export function normaliza(v: unknown): DocumentoLab {
  if (!v || typeof v !== "object") return LAB_VACIO;

  const d = v as Partial<DocumentoLab>;

  return {
    rutinas: Array.isArray(d.rutinas) ? d.rutinas : [],
    retos: Array.isArray(d.retos)
      ? d.retos.map((r) => ({ ...r, marcas: r.marcas ?? {}, aciertos: r.aciertos ?? {}, participantes: r.participantes ?? [], preguntas: r.preguntas ?? [] }))
      : [],
    abiertoJugadores: Boolean(d.abiertoJugadores),
  };
}

/* ------------------------------------------------------------------ */
/*  APLICAR UNA ACCIÓN                                                 */
/* ------------------------------------------------------------------ */

export function aplica(actual: unknown, accion: string, cuerpo: Record<string, unknown>, ahora = new Date().toISOString()): DocumentoLab {
  const doc = normaliza(actual);

  const id = texto(cuerpo.id, 60);

  const reto = () => {
    const r = doc.retos.find((x) => x.id === id);

    if (!r) throw new Rechazo("Ese reto ya no existe.", 404);

    return r;
  };

  const cambiaReto = (r: Reto) => ({ ...doc, retos: doc.retos.map((x) => (x.id === r.id ? r : x)) });

  switch (accion) {
    case "rutina-guarda": {
      const previa = doc.rutinas.find((x) => x.id === texto((cuerpo.rutina as Record<string, unknown> | undefined)?.id, 40));

      const nueva = rutinaDe(cuerpo.rutina, ahora, previa);

      return { ...doc, rutinas: previa ? doc.rutinas.map((x) => (x.id === nueva.id ? nueva : x)) : [nueva, ...doc.rutinas] };
    }

    case "rutina-borra":
      return { ...doc, rutinas: doc.rutinas.filter((x) => x.id !== id) };

    case "reto-guarda": {
      const previo = doc.retos.find((x) => x.id === texto((cuerpo.reto as Record<string, unknown> | undefined)?.id, 40));

      const nuevo = retoDe(cuerpo.reto, ahora, previo);

      return { ...doc, retos: previo ? doc.retos.map((x) => (x.id === nuevo.id ? nuevo : x)) : [nuevo, ...doc.retos] };
    }

    case "reto-borra":
      return { ...doc, retos: doc.retos.filter((x) => x.id !== id) };

    case "reto-cierra": {
      const r = reto();

      return cambiaReto({ ...r, cerrado: Boolean(cuerpo.cerrado) });
    }

    case "reto-marca": {
      const r = reto();

      if (r.cerrado) throw new Rechazo("El reto está cerrado: ábrelo para cambiar una marca.", 423);

      if (r.tipo !== "precision") throw new Rechazo("Las marcas son de los retos de precisión.");

      const jugador = texto(cuerpo.jugador, 60);

      if (!jugador) throw new Rechazo("Falta el jugador.");

      const marcas = { ...r.marcas };

      if (cuerpo.valor === null || cuerpo.valor === "") delete marcas[jugador];
      else marcas[jugador] = entero(cuerpo.valor, 0, r.maximo, 0);

      return cambiaReto({ ...r, marcas });
    }

    case "reto-acierto": {
      const r = reto();

      if (r.cerrado) throw new Rechazo("El reto está cerrado: ábrelo para cambiar un acierto.", 423);

      const pregunta = texto(cuerpo.pregunta, 40);

      const jugador = texto(cuerpo.jugador, 60);

      if (!r.preguntas.some((p) => p.id === pregunta) || !jugador) throw new Rechazo("Falta la pregunta o el jugador.");

      const lista = new Set(r.aciertos[pregunta] ?? []);

      if (cuerpo.acierta) lista.add(jugador);
      else lista.delete(jugador);

      return cambiaReto({
        ...r,
        aciertos: { ...r.aciertos, [pregunta]: [...lista] },
        participantes: cuerpo.acierta && !r.participantes.includes(jugador) ? [...r.participantes, jugador] : r.participantes,
      });
    }

    case "reto-participa": {
      const r = reto();

      if (r.cerrado) throw new Rechazo("El reto está cerrado.", 423);

      const jugadores = (Array.isArray(cuerpo.jugadores) ? cuerpo.jugadores : []).map((x) => texto(x, 60)).filter(Boolean);

      return cambiaReto({ ...r, participantes: [...new Set(jugadores)] });
    }

    case "abierto":
      return { ...doc, abiertoJugadores: Boolean(cuerpo.valor) };

    default:
      throw new Rechazo("No se ha entendido qué hay que hacer.");
  }
}

/* ------------------------------------------------------------------ */
/*  LA CLASIFICACIÓN                                                   */
/* ------------------------------------------------------------------ */

/** Lo que cada jugador saca de un reto; `null` si no lo jugó. */
export function puntosEn(reto: Reto, jugador: string): number | null {
  if (reto.tipo === "precision") return jugador in reto.marcas ? reto.marcas[jugador] * reto.puntos : null;

  const acertadas = reto.preguntas.filter((p) => (reto.aciertos[p.id] ?? []).includes(jugador)).length;

  if (!acertadas && !reto.participantes.includes(jugador)) return null;

  return acertadas * reto.puntos;
}

/** Lo que podía sacar quien lo hiciera todo bien. */
export const puntosMaximos = (reto: Reto) => (reto.tipo === "precision" ? reto.maximo * reto.puntos : reto.preguntas.length * reto.puntos);

export type Insignia = { key: string; nombre: string; texto: string };

export const INSIGNIAS: Record<string, Omit<Insignia, "key">> = {
  francotirador: { nombre: "Francotirador", texto: "El 80 % o más de la marca en un reto de precisión" },
  lector: { nombre: "Lector de juego", texto: "Todas acertadas en un reto de preguntas de tres o más" },
  racha: { nombre: "En racha", texto: "Puntuando en los tres últimos retos que ha jugado, o más" },
  mvp: { nombre: "MVP", texto: "El mejor de un reto" },
  fijo: { nombre: "Siempre está", texto: "Ha jugado todos los retos cerrados, y son tres o más" },
};

export type Fila = {
  jugador: string;
  puntos: number;
  jugados: number;
  /** Retos seguidos puntuando, del más reciente hacia atrás. */
  racha: number;
  mejorRacha: number;
  /** Puntos sobre lo posible en lo que jugó (0-1). */
  acierto: number;
  insignias: Insignia[];
  /** Ganó un reto (cuántos). */
  victorias: number;
};

export function clasificacion(doc: DocumentoLab): Fila[] {
  const retos = [...doc.retos].sort((a, b) => (a.fecha === b.fecha ? a.creadoEn.localeCompare(b.creadoEn) : a.fecha.localeCompare(b.fecha)));

  const jugadores = new Set<string>();

  retos.forEach((r) => {
    Object.keys(r.marcas).forEach((j) => jugadores.add(j));
    r.participantes.forEach((j) => jugadores.add(j));
    Object.values(r.aciertos).forEach((l) => l.forEach((j) => jugadores.add(j)));
  });

  /* El mejor de cada reto (con algo jugado y más de cero). */
  const ganadores = new Map<string, Set<string>>();

  retos.forEach((r) => {
    const puntos = [...jugadores].map((j) => [j, puntosEn(r, j)] as const).filter(([, p]) => p !== null && p > 0) as [string, number][];

    const tope = Math.max(0, ...puntos.map(([, p]) => p));

    if (tope > 0) ganadores.set(r.id, new Set(puntos.filter(([, p]) => p === tope).map(([j]) => j)));
  });

  const cerrados = retos.filter((r) => r.cerrado);

  return [...jugadores]
    .map((jugador) => {
      const jugados = retos.map((r) => ({ r, p: puntosEn(r, jugador) })).filter((x): x is { r: Reto; p: number } => x.p !== null);

      const puntos = jugados.reduce((s, x) => s + x.p, 0);

      const posibles = jugados.reduce((s, x) => s + puntosMaximos(x.r), 0);

      let racha = 0;
      let mejorRacha = 0;
      let enCurso = 0;

      jugados.forEach((x) => {
        enCurso = x.p > 0 ? enCurso + 1 : 0;
        mejorRacha = Math.max(mejorRacha, enCurso);
      });

      racha = enCurso;

      const victorias = jugados.filter((x) => ganadores.get(x.r.id)?.has(jugador)).length;

      const insignias: Insignia[] = [];

      const pon = (key: string) => insignias.push({ key, ...INSIGNIAS[key] });

      if (jugados.some((x) => x.r.tipo === "precision" && x.p >= 0.8 * puntosMaximos(x.r))) pon("francotirador");

      if (jugados.some((x) => x.r.tipo === "quiz" && x.r.preguntas.length >= 3 && x.p === puntosMaximos(x.r))) pon("lector");

      if (racha >= 3) pon("racha");

      if (victorias) pon("mvp");

      if (cerrados.length >= 3 && cerrados.every((r) => puntosEn(r, jugador) !== null)) pon("fijo");

      return { jugador, puntos, jugados: jugados.length, racha, mejorRacha, acierto: posibles ? puntos / posibles : 0, insignias, victorias };
    })
    .sort((a, b) => b.puntos - a.puntos || b.acierto - a.acierto || b.victorias - a.victorias);
}

/* ------------------------------------------------------------------ */
/*  EL BANCO DE PREGUNTAS (con su fuente)                              */
/* ------------------------------------------------------------------ */

const ANALYST = { titulo: "The Analyst · Premier League corner stats (2023)", url: "https://theanalyst.com/articles/premier-league-corner-stats-inswingers-vs-outswingers-short-vs-crossed-kai-havertzs-defending" };

const GABRIEL = { titulo: "Premier League · How Arsenal unleash Gabriel at corners (2024)", url: "https://www.premierleague.com/en/news/4183525" };

const BLOQUEOS = { titulo: "Training Ground Guru · Arsenal and the art of blocking (2024)", url: "https://trainingground.guru/articles/arsenal-and-the-art-of-blocking-at-corners" };

const GRONNEMARK = { titulo: "Entrevista a Thomas Grønnemark", url: "https://nograssintheclouds.substack.com/p/an-interview-with-liverpools-throw" };

const GEORGSON = { titulo: "Andreas Georgson Q&A (Tottenham, 2025)", url: "https://www.tottenhamhotspur.com/news/2025/october/andreas-georgson-qa-coach-answers-fans-questions-on-reddit/" };

const VIO = { titulo: "Eurosport · Gianni Vio (2015)", url: "https://www.tntsports.co.uk/football/fiorentina-banking-on-italys-set-piece-guru_sto4716397/story.shtml" };

const FIFA = { titulo: "FIFA Training Centre · Chelsea short corners (2026)", url: "https://www.fifatrainingcentre.com/en/game/game-analysis/set-plays/set-play-routines/short-corners-structure-and-decision-making-in-chelseas-set-plays.php" };

export const BANCO: Pregunta[] = [
  {
    id: "b-cerrado",
    enunciado: "En la Premier, ¿qué córner da más goles esperados por remate directo?",
    opciones: ["El cerrado (hacia la portería)", "El abierto (hacia fuera)", "El córner en corto", "Da igual"],
    correcta: 0,
    explicacion: "0,14 por remate el cerrado frente a 0,08 el abierto (22/23).",
    fuente: ANALYST,
  },
  {
    id: "b-zona-area-pequena",
    enunciado: "Córner colgado al área pequeña: ¿desde dónde vale más un remate?",
    opciones: ["Primer palo", "Centro del área pequeña", "Segundo palo", "Fuera del área pequeña"],
    correcta: 1,
    explicacion: "0,27 goles esperados por remate en el centro; 0,17 en el segundo palo y 0,12 en el primero.",
    fuente: ANALYST,
  },
  {
    id: "b-corto",
    enunciado: "¿Qué córner acaba más veces en remate directo?",
    opciones: ["El colgado", "El sacado en corto", "Los dos igual", "El que va raso al primer palo"],
    correcta: 0,
    explicacion: "El colgado acaba en remate directo el 20,8 % de las veces; el corto, el 2,8 %.",
    fuente: ANALYST,
  },
  {
    id: "b-bloqueo",
    enunciado: "Eres el bloqueador en un córner. ¿Dónde empiezas?",
    opciones: ["Pegado a tu defensor, de frente", "Por detrás de tu defensor, donde no te ve", "En el primer palo, quieto", "Fuera del área"],
    correcta: 1,
    explicacion: "Trossard sale por detrás de Andersen: no le ve hasta el último momento y no puede quejarse antes del saque.",
    fuente: BLOQUEOS,
  },
  {
    id: "b-gabriel",
    enunciado: "En los córners del Arsenal, ¿quién es el único con libertad para cambiar su posición de salida?",
    opciones: ["El lanzador", "El portero", "Gabriel, el rematador", "Todos"],
    correcta: 2,
    explicacion: "Gabriel es el objetivo en casi todos los córners; los demás bloquean o arrastran.",
    fuente: GABRIEL,
  },
  {
    id: "b-banda-linea",
    enunciado: "Saque de banda con presión. Según Grønnemark, ¿qué es lo peor que puedes hacer?",
    opciones: ["Sacar rápido", "Sacar recto por la línea", "Sacar atrás al central", "Sacar largo y plano"],
    correcta: 1,
    explicacion: "Sacar recto por la banda es «lo peor que puedes hacer»: plano y preciso, y con un plan para la acción siguiente.",
    fuente: GRONNEMARK,
  },
  {
    id: "b-banda-cuantos",
    enunciado: "¿Cuántos saques de banda hay de media en un partido?",
    opciones: ["Entre 10 y 20", "Entre 20 y 30", "Entre 40 y 60", "Más de 80"],
    correcta: 2,
    explicacion: "Entre 40 y 60, que afectan a 15-20 minutos de juego.",
    fuente: GRONNEMARK,
  },
  {
    id: "b-falta-distancia",
    enunciado: "¿A qué distancia está el punto ideal para tirar una falta directa?",
    opciones: ["10-15 metros", "16-19 metros", "20-25 metros", "Más de 30 metros"],
    correcta: 2,
    explicacion: "«Un punto dulce entre 20 y 25 metros»; más lejos, mejor otras opciones.",
    fuente: GEORGSON,
  },
  {
    id: "b-barrera-falsa",
    enunciado: "Falta frontal. Al pitido, cuatro de los nuestros se meten delante de su barrera. ¿Para qué?",
    opciones: ["Para molestar al árbitro", "Para formar una barrera falsa que tape al portero", "Para defender la contra", "Para pedir el balón en corto"],
    correcta: 1,
    explicacion: "La barrera falsa de Vio en el Catania: dos cruzan por delante y cuatro tapan la visión del portero.",
    fuente: VIO,
  },
  {
    id: "b-corto-chelsea",
    enunciado: "Córner en corto y el rival manda a tres a por los dos nuestros. ¿Qué buscamos?",
    opciones: ["Seguir combinando en la esquina", "Al libre en la frontal o centrar a un área con menos gente", "Volver al portero", "Sacar fuera"],
    correcta: 1,
    explicacion: "Si el rival manda muchos al corto, la frontal y el área se quedan cortas: ahí está la ventaja.",
    fuente: FIFA,
  },
];
