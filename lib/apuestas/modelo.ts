/**
 * LAS APUESTAS DEL STAFF (09/10/2026).
 *
 * Uno del cuerpo técnico tira una predicción —«el Castilla acaba la primera
 * vuelta entre los cinco primeros»—, dice qué se juega y pone la fecha en que
 * se comprueba. Los demás se ponen **a favor** o **en contra** hasta ese día;
 * llegado el día, cualquiera que haya entrado dice si acertó o falló, y el
 * marcador se cuenta solo.
 *
 * Juegan **las mismas personas que en la quiniela**, con la misma cuenta y la
 * misma sesión (`lib/quiniela/staff.ts`, `/api/quiniela/cuenta`).
 *
 * Lo que vive aquí son las reglas, sin navegador ni Supabase, para que se
 * puedan comprobar sueltas: `aplica` es lo único que escribe en el documento y
 * lo usa la ruta `/api/apuestas/guardar`. El documento es `apuestas-staff` en
 * `app_documents`; `/api/docs` se niega a escribirlo, como con la quiniela.
 */

import { PERSONA_POR_SLUG } from "@/lib/quiniela/staff";

export const CLAVE_APUESTAS = "apuestas-staff";

export type Postura = "favor" | "contra";

export type Veredicto = "acertada" | "fallada";

export type Apuesta = {
  id: string;
  /** Quién la lanza (slug del staff). Va a favor de sí mismo, claro. */
  autor: string;
  prediccion: string;
  /** Qué se juega: «un desayuno para todos», «la cena de Navidad». */
  enJuego: string;
  /** El día que se comprueba, "2026-10-20". */
  comprobar: string;
  creadaEn: string;
  /** Quién se ha puesto a favor o en contra. El autor no está aquí. */
  posturas: Record<string, Postura>;
  veredicto?: Veredicto | null;
  resueltaEn?: string;
  resueltaPor?: string;
};

export type DocumentoApuestas = {
  apuestas: Apuesta[];
};

export const APUESTAS_VACIAS: DocumentoApuestas = { apuestas: [] };

export const PREDICCION_MAXIMA = 280;

export const EN_JUEGO_MAXIMO = 120;

/** Hasta cuándo se puede poner la fecha de comprobación: dos temporadas. */
const DIAS_MAXIMOS = 730;

export type EstadoApuesta = "abierta" | "a-comprobar" | "acertada" | "fallada";

/* ------------------------------------------------------------------ */
/*  FECHAS                                                             */
/* ------------------------------------------------------------------ */

const dos = (n: number) => String(n).padStart(2, "0");

/** El día de hoy en Madrid, "2026-10-09": las fechas se comparan como texto. */
export function hoyMadrid(ahora: Date = new Date()) {
  const partes = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Europe/Madrid",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(ahora);

  const de = (tipo: string) => partes.find((p) => p.type === tipo)?.value ?? "";

  return `${de("year")}-${de("month")}-${de("day")}`;
}

export function esFecha(texto: unknown): texto is string {
  if (typeof texto !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(texto)) return false;

  const [a, m, d] = texto.split("-").map(Number);

  const fecha = new Date(Date.UTC(a, m - 1, d));

  return (
    fecha.getUTCFullYear() === a &&
    fecha.getUTCMonth() === m - 1 &&
    fecha.getUTCDate() === d
  );
}

/** "2026-10-20" → "20 oct 2026". */
export function fechaLarga(fecha: string) {
  if (!esFecha(fecha)) return fecha;

  const [a, m, d] = fecha.split("-");

  const meses = ["ene", "feb", "mar", "abr", "may", "jun", "jul", "ago", "sep", "oct", "nov", "dic"];

  return `${Number(d)} ${meses[Number(m) - 1]} ${a}`;
}

/** Días que faltan desde `hoy` hasta `fecha` (negativo si ya pasó). */
export function diasHasta(fecha: string, hoy: string) {
  const [a1, m1, d1] = hoy.split("-").map(Number);
  const [a2, m2, d2] = fecha.split("-").map(Number);

  return Math.round((Date.UTC(a2, m2 - 1, d2) - Date.UTC(a1, m1 - 1, d1)) / 86_400_000);
}

function sumaDias(fecha: string, dias: number) {
  const [a, m, d] = fecha.split("-").map(Number);

  const f = new Date(Date.UTC(a, m - 1, d + dias));

  return `${f.getUTCFullYear()}-${dos(f.getUTCMonth() + 1)}-${dos(f.getUTCDate())}`;
}

/* ------------------------------------------------------------------ */
/*  ESTADO                                                             */
/* ------------------------------------------------------------------ */

export function estadoDe(apuesta: Apuesta, hoy: string): EstadoApuesta {
  if (apuesta.veredicto === "acertada" || apuesta.veredicto === "fallada") {
    return apuesta.veredicto;
  }

  return hoy >= apuesta.comprobar ? "a-comprobar" : "abierta";
}

/**
 * Hasta el día de comprobación, sin contarlo, y nunca el autor: él ya va a
 * favor por definición.
 */
export function puedePosicionarse(apuesta: Apuesta, slug: string | null, hoy: string) {
  return Boolean(slug) && slug !== apuesta.autor && estadoDe(apuesta, hoy) === "abierta";
}

/** Desde el día de comprobación, cualquiera que haya entrado. */
export function puedeResolverse(apuesta: Apuesta, slug: string | null, hoy: string) {
  return Boolean(slug) && hoy >= apuesta.comprobar;
}

/**
 * Retirarla sólo puede el autor, y sólo mientras nadie se haya mojado ni haya
 * veredicto: en cuanto hay alguien a favor o en contra, la apuesta ya es de
 * todos. Que haya llegado el día de comprobarla no lo impide: una apuesta en
 * la que nadie entró no le debe nada a nadie.
 */
export function puedeRetirarse(apuesta: Apuesta, slug: string | null) {
  return (
    slug === apuesta.autor &&
    !apuesta.veredicto &&
    Object.keys(apuesta.posturas).length === 0
  );
}

/** A favor y en contra, en el orden en que entraron. */
export function bandos(apuesta: Apuesta) {
  const favor: string[] = [];
  const contra: string[] = [];

  for (const [slug, postura] of Object.entries(apuesta.posturas)) {
    (postura === "favor" ? favor : contra).push(slug);
  }

  return { favor, contra };
}

/**
 * Las que están en juego primero —la que antes se comprueba, antes—, y las
 * resueltas después, de la más reciente a la más antigua.
 */
export function ordenadas(apuestas: Apuesta[], hoy: string) {
  const vivas = apuestas
    .filter((una) => !una.veredicto)
    .sort((a, b) => a.comprobar.localeCompare(b.comprobar) || a.creadaEn.localeCompare(b.creadaEn));

  const resueltas = apuestas
    .filter((una) => Boolean(una.veredicto))
    .sort((a, b) => (b.resueltaEn ?? "").localeCompare(a.resueltaEn ?? ""));

  return { vivas, resueltas, hoy };
}

/* ------------------------------------------------------------------ */
/*  EL MARCADOR                                                        */
/* ------------------------------------------------------------------ */

export type LineaMarcador = {
  slug: string;
  /** Apuestas lanzadas, resueltas o no. */
  lanzadas: number;
  /** Veces que se ha mojado en las de otros. */
  seguidas: number;
  aciertos: number;
  fallos: number;
  balance: number;
};

/**
 * Cuenta sólo las resueltas. El autor acierta si su apuesta se cumple; quien
 * va a favor acierta con él, quien va en contra acierta si falla. Se ordena
 * por balance y, a igual balance, por aciertos.
 */
export function marcador(apuestas: Apuesta[]): LineaMarcador[] {
  const lineas = new Map<string, LineaMarcador>();

  const linea = (slug: string) => {
    let una = lineas.get(slug);

    if (!una) {
      una = { slug, lanzadas: 0, seguidas: 0, aciertos: 0, fallos: 0, balance: 0 };
      lineas.set(slug, una);
    }

    return una;
  };

  const apunta = (slug: string, acierto: boolean) => {
    const l = linea(slug);

    if (acierto) l.aciertos += 1;
    else l.fallos += 1;

    l.balance = l.aciertos - l.fallos;
  };

  for (const apuesta of apuestas) {
    linea(apuesta.autor).lanzadas += 1;

    for (const slug of Object.keys(apuesta.posturas)) linea(slug).seguidas += 1;

    if (!apuesta.veredicto) continue;

    const seCumplio = apuesta.veredicto === "acertada";

    apunta(apuesta.autor, seCumplio);

    for (const [slug, postura] of Object.entries(apuesta.posturas)) {
      apunta(slug, postura === "favor" ? seCumplio : !seCumplio);
    }
  }

  return [...lineas.values()].sort(
    (a, b) =>
      b.balance - a.balance ||
      b.aciertos - a.aciertos ||
      b.lanzadas + b.seguidas - (a.lanzadas + a.seguidas) ||
      a.slug.localeCompare(b.slug),
  );
}

/* ------------------------------------------------------------------ */
/*  ESCRIBIR                                                           */
/* ------------------------------------------------------------------ */

/** Un rechazo con su código HTTP: la ruta lo convierte en respuesta. */
export class Rechazo extends Error {
  estado: number;

  constructor(mensaje: string, estado = 400) {
    super(mensaje);
    this.estado = estado;
  }
}

const texto = (valor: unknown, maximo: number) => String(valor ?? "").trim().slice(0, maximo);

export function nuevoId(ahora: Date = new Date()) {
  return `${ahora.getTime().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

export function normaliza(data: unknown): DocumentoApuestas {
  const dado = (data ?? {}) as Partial<DocumentoApuestas>;

  const apuestas = Array.isArray(dado.apuestas) ? dado.apuestas : [];

  return {
    apuestas: apuestas
      .filter((una): una is Apuesta => Boolean(una && typeof una === "object" && una.id && una.autor))
      .map((una) => ({ ...una, posturas: una.posturas ?? {} })),
  };
}

/**
 * El cambio que hace cada acción sobre el documento leído.
 *
 * - `nueva` — lanza una apuesta de quien ha entrado.
 * - `postura` — `favor`, `contra` o `null` (quitarse) en la de otro.
 * - `veredicto` — `acertada`, `fallada` o `null` (deshacer), desde el día de
 *   comprobación.
 * - `retirar` — borra la propia, si nadie se ha mojado todavía.
 *
 * Lanza `Rechazo` cuando no se puede; la ruta lo cuenta tal cual.
 */
export function aplica(
  data: unknown,
  accion: string,
  cuerpo: Record<string, unknown>,
  slug: string,
  ahora: Date = new Date(),
): DocumentoApuestas {
  const base = normaliza(data);

  const hoy = hoyMadrid(ahora);

  if (accion === "nueva") {
    const prediccion = texto(cuerpo.prediccion, PREDICCION_MAXIMA);

    const enJuego = texto(cuerpo.enJuego, EN_JUEGO_MAXIMO);

    const comprobar = String(cuerpo.comprobar ?? "");

    if (prediccion.length < 8) throw new Rechazo("Escribe la predicción: qué va a pasar.");

    if (!enJuego) throw new Rechazo("Di qué te juegas.");

    if (!esFecha(comprobar)) throw new Rechazo("Pon el día en que se comprueba.");

    if (comprobar < hoy) throw new Rechazo("El día de comprobación no puede haber pasado ya.");

    if (comprobar > sumaDias(hoy, DIAS_MAXIMOS)) {
      throw new Rechazo("Eso es demasiado lejos: como mucho dos temporadas.");
    }

    const apuesta: Apuesta = {
      id: nuevoId(ahora),
      autor: slug,
      prediccion,
      enJuego,
      comprobar,
      creadaEn: ahora.toISOString(),
      posturas: {},
    };

    return { apuestas: [...base.apuestas, apuesta] };
  }

  const id = String(cuerpo.id ?? "");

  const indice = base.apuestas.findIndex((una) => una.id === id);

  if (indice < 0) throw new Rechazo("Esa apuesta ya no está.", 404);

  const apuesta = base.apuestas[indice];

  let cambiada: Apuesta | null;

  if (accion === "postura") {
    if (slug === apuesta.autor) throw new Rechazo("Es tu apuesta: ya vas a favor.");

    if (estadoDe(apuesta, hoy) !== "abierta") {
      throw new Rechazo("Esta apuesta ya no admite posturas: ha llegado el día de comprobarla.", 423);
    }

    const postura = cuerpo.postura;

    const posturas = { ...apuesta.posturas };

    if (postura === "favor" || postura === "contra") posturas[slug] = postura;
    else if (postura === null) delete posturas[slug];
    else throw new Rechazo("A favor o en contra, no hay más.");

    cambiada = { ...apuesta, posturas };
  } else if (accion === "veredicto") {
    if (hoy < apuesta.comprobar) {
      throw new Rechazo(`Se comprueba el ${fechaLarga(apuesta.comprobar)}: hasta entonces no hay veredicto.`, 423);
    }

    const veredicto = cuerpo.veredicto;

    if (veredicto === "acertada" || veredicto === "fallada") {
      cambiada = {
        ...apuesta,
        veredicto,
        resueltaEn: ahora.toISOString(),
        resueltaPor: slug,
      };
    } else if (veredicto === null) {
      cambiada = { ...apuesta, veredicto: null };
      delete cambiada.resueltaEn;
      delete cambiada.resueltaPor;
    } else {
      throw new Rechazo("Acertada o fallada, no hay más.");
    }
  } else if (accion === "retirar") {
    if (slug !== apuesta.autor) throw new Rechazo("Sólo quien la lanzó puede retirarla.", 403);

    if (apuesta.veredicto) throw new Rechazo("Ya está resuelta: deshaz el veredicto antes.", 423);

    if (!puedeRetirarse(apuesta, slug)) {
      throw new Rechazo("Ya hay gente dentro: la apuesta es de todos y no se retira.", 423);
    }

    cambiada = null;
  } else {
    throw new Rechazo("No sé qué quieres guardar.");
  }

  const apuestas = [...base.apuestas];

  if (cambiada) apuestas[indice] = cambiada;
  else apuestas.splice(indice, 1);

  return { apuestas };
}

/** Quién ha entrado existe en la lista del staff. */
export function esDelStaff(slug: string | null): slug is string {
  return Boolean(slug) && PERSONA_POR_SLUG.has(slug as string);
}
