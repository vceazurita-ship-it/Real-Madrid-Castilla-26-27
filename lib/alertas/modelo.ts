/**
 * Tareas con alerta por correo.
 *
 * Una alerta es una tarea que se recuerda sola: tiene destinatarios, puede
 * llevar adjuntos (una foto, un vídeo, una canción) y se repite cada cierto
 * tiempo hasta que se apaga.
 *
 * **La hoja manda.** El calendario vive en la pestaña `ALERTAS` de la hoja de
 * cálculo, no en Supabase, y no por capricho: las alarmas tienen que sonar con
 * la app cerrada, y lo único que hay aquí capaz de despertarse solo es el
 * disparador horario de Apps Script. Guardar además una copia en Supabase sería
 * un segundo origen que acabaría discrepando del que de verdad envía.
 *
 * Lo que sí vive en Supabase son los adjuntos: el fichero se sube al bucket
 * `performance` y al correo va el enlace, no el archivo. Un vídeo de
 * entrenamiento pasa de los 25 MB que admite Gmail y llegaría rebotado.
 */

export type Repeticion =
  | "una-vez"
  | "diaria"
  | "semanal"
  | "mensual"
  | "personalizada";

/** Cada cuánto vuelve a sonar, para el desplegable del formulario. */
export const REPETICIONES: { valor: Repeticion; etiqueta: string }[] = [
  { valor: "una-vez", etiqueta: "Una sola vez" },
  { valor: "diaria", etiqueta: "Cada día" },
  { valor: "semanal", etiqueta: "Cada semana" },
  { valor: "mensual", etiqueta: "Cada mes" },
  { valor: "personalizada", etiqueta: "Cada N días" },
];

/** Fichero subido al bucket. Al correo va `url`, nunca el binario. */
export interface Adjunto {
  nombre: string;
  url: string;
  /** MIME que devolvió el navegador: `image/jpeg`, `video/mp4`, `audio/mpeg`… */
  tipo: string;
  /** Bytes. Solo para enseñar el peso en la ficha. */
  tamano: number;
}

export interface Alerta {
  id: string;
  titulo: string;
  mensaje: string;
  destinatarios: string[];
  adjuntos: Adjunto[];
  /** Cuándo suena la próxima vez, en ISO con zona (UTC). */
  proximoEnvio: string;
  repeticion: Repeticion;
  /** Días entre avisos. Solo se mira con `repeticion: "personalizada"`. */
  intervaloDias: number;
  activa: boolean;
  creada: string;
  ultimoEnvio: string | null;
  envios: number;
  /**
   * Campanadas del calendario, en minutos de antelación. `0` es «a la hora».
   *
   * Con al menos una, el correo lleva adjunta la cita (`.ics`) y el móvil
   * suena solo aunque nadie mire la bandeja. Vacío = correo pelado, que es
   * como se comportaba esto antes de que existiera el campo.
   */
  avisos: number[];
}

/**
 * Un correo que la app ya ha visto usar.
 *
 * Esto es lo que hace que la app "aprenda": cada envío suma un uso, y el
 * formulario ofrece primero los más usados. Nadie escribe una agenda a mano.
 */
export interface ContactoAgenda {
  email: string;
  nombre: string;
  usos: number;
  ultimoUso: string;
}

/* ------------------------------------------------------------------ */
/*  CORREOS                                                            */
/* ------------------------------------------------------------------ */

/*
| Deliberadamente simple: un arroba, algo a cada lado y un punto en el dominio.
| Validar direcciones "de verdad" con una expresión es un clásico que acaba
| rechazando correos legítimos; quien manda es el servidor de correo.
*/
const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

export function esEmail(valor: string) {
  return EMAIL.test(valor.trim());
}

export function normalizaEmail(valor: string) {
  return valor.trim().toLowerCase();
}

/**
 * Parte lo que se acaba de escribir o pegar en direcciones sueltas.
 *
 * Acepta comas, puntos y comas, espacios y saltos de línea, porque pegar una
 * lista copiada de otro correo es la forma más rápida de rellenar esto.
 */
export function separaEmails(texto: string): string[] {
  return texto
    .split(/[,;\s]+/)
    .map(normalizaEmail)
    .filter(Boolean);
}

/* ------------------------------------------------------------------ */
/*  ADJUNTOS                                                           */
/* ------------------------------------------------------------------ */

export type FamiliaAdjunto = "foto" | "video" | "audio" | "documento";

/** De qué tipo es el fichero, para el icono y el texto de la ficha. */
export function familiaAdjunto(adjunto: Adjunto): FamiliaAdjunto {
  const tipo = (adjunto.tipo || "").toLowerCase();

  if (tipo.startsWith("image/")) return "foto";
  if (tipo.startsWith("video/")) return "video";
  if (tipo.startsWith("audio/")) return "audio";

  /*
  | Algunos navegadores mandan `application/octet-stream` para audio y vídeo,
  | así que cuando el MIME no dice nada preguntamos a la extensión.
  */
  const extension = adjunto.nombre.split(".").pop()?.toLowerCase() ?? "";

  if (["jpg", "jpeg", "png", "gif", "webp", "heic", "avif"].includes(extension))
    return "foto";

  if (["mp4", "mov", "avi", "mkv", "webm", "m4v"].includes(extension))
    return "video";

  if (["mp3", "wav", "m4a", "aac", "ogg", "flac"].includes(extension))
    return "audio";

  return "documento";
}

export function pesoLegible(bytes: number) {
  if (!bytes) return "";

  const mega = bytes / (1024 * 1024);

  if (mega >= 1) return `${mega.toFixed(1).replace(".", ",")} MB`;

  return `${Math.max(1, Math.round(bytes / 1024))} KB`;
}

/* ------------------------------------------------------------------ */
/*  AVISOS — LO QUE HACE SONAR EL MÓVIL                                */
/* ------------------------------------------------------------------ */

/*
| Un correo no despierta a nadie: llega en silencio y se lee cuando se lee. Lo
| que sí suena es el calendario del teléfono, así que al correo se le adjunta
| la cita —un `.ics` con la serie entera y una campanada por cada antelación
| elegida— y el aviso deja de depender de que alguien mire la bandeja.
|
| Se guarda en minutos y no en texto porque es lo que entiende el `.ics`
| (`TRIGGER:-PT30M`) y porque así el desplegable puede crecer sin tocar la hoja.
*/

export const AVISOS_POSIBLES: { minutos: number; etiqueta: string }[] = [
  { minutos: 0, etiqueta: "A la hora" },
  { minutos: 10, etiqueta: "10 min antes" },
  { minutos: 30, etiqueta: "30 min antes" },
  { minutos: 60, etiqueta: "1 hora antes" },
  { minutos: 180, etiqueta: "3 horas antes" },
  { minutos: 1440, etiqueta: "1 día antes" },
  { minutos: 2880, etiqueta: "2 días antes" },
  { minutos: 10080, etiqueta: "1 semana antes" },
];

/**
 * Deja una lista de avisos utilizable venga como venga.
 *
 * Hace falta de verdad: la hoja puede estar corriendo todavía la versión
 * anterior de `alertas.gs`, y entonces las alertas llegan **sin** el campo. Un
 * `alerta.avisos.map(...)` sobre eso tumba la pantalla entera.
 */
export function normalizaAvisos(valor: unknown): number[] {
  if (!Array.isArray(valor)) return [];

  const limpios = valor
    .map((uno) => Math.round(Number(uno)))
    .filter((uno) => Number.isFinite(uno) && uno >= 0);

  return [...new Set(limpios)].sort((a, b) => a - b);
}

export function describeAviso(minutos: number): string {
  const conocido = AVISOS_POSIBLES.find((uno) => uno.minutos === minutos);

  if (conocido) return conocido.etiqueta;

  if (minutos < 60) return `${minutos} min antes`;

  if (minutos % 1440 === 0) {
    const dias = minutos / 1440;

    return dias === 1 ? "1 día antes" : `${dias} días antes`;
  }

  return `${Math.round(minutos / 60)} h antes`;
}

/** "A la hora · 1 día antes", para la ficha de la lista. */
export function describeAvisos(alerta: Alerta): string {
  const avisos = normalizaAvisos(alerta.avisos);

  if (!avisos.length) return "Sin alarma";

  return avisos.map(describeAviso).join(" · ");
}

/* ------------------------------------------------------------------ */
/*  CALENDARIO                                                         */
/* ------------------------------------------------------------------ */

export function describeRepeticion(alerta: Alerta) {
  switch (alerta.repeticion) {
    case "diaria":
      return "Cada día";
    case "semanal":
      return "Cada semana";
    case "mensual":
      return "Cada mes";
    case "personalizada":
      return alerta.intervaloDias === 1
        ? "Cada día"
        : `Cada ${alerta.intervaloDias} días`;
    default:
      return "Una sola vez";
  }
}

/**
 * Cuándo vuelve a sonar después de un envío.
 *
 * Devuelve `null` si no se repite. Es la misma cuenta que hace el disparador
 * de Apps Script; se replica aquí para poder enseñar la próxima fecha en
 * pantalla sin ir a preguntar a la hoja.
 */
export function siguienteEnvio(alerta: Alerta, desde: Date): Date | null {
  const fecha = new Date(desde.getTime());

  switch (alerta.repeticion) {
    case "diaria":
      fecha.setDate(fecha.getDate() + 1);
      return fecha;
    case "semanal":
      fecha.setDate(fecha.getDate() + 7);
      return fecha;
    case "mensual":
      fecha.setMonth(fecha.getMonth() + 1);
      return fecha;
    case "personalizada":
      fecha.setDate(fecha.getDate() + Math.max(1, alerta.intervaloDias));
      return fecha;
    default:
      return null;
  }
}

/** "vie 28 ago · 09:30", en horario del navegador. */
export function fechaLegible(iso: string | null) {
  if (!iso) return "—";

  const fecha = new Date(iso);

  if (Number.isNaN(fecha.getTime())) return "—";

  const dia = fecha.toLocaleDateString("es-ES", {
    weekday: "short",
    day: "numeric",
    month: "short",
  });

  const hora = fecha.toLocaleTimeString("es-ES", {
    hour: "2-digit",
    minute: "2-digit",
  });

  return `${dia} · ${hora}`;
}

/**
 * ISO -> valor de un `<input type="datetime-local">`.
 *
 * El input trabaja siempre en la hora del navegador y sin zona, así que hay
 * que restar el desfase a mano: `toISOString()` daría UTC y la hora aparecería
 * corrida dos horas en verano.
 */
export function isoAInputLocal(iso: string) {
  const fecha = new Date(iso);

  if (Number.isNaN(fecha.getTime())) return "";

  const local = new Date(
    fecha.getTime() - fecha.getTimezoneOffset() * 60_000,
  );

  return local.toISOString().slice(0, 16);
}

/** Valor de un `<input type="datetime-local">` -> ISO con zona. */
export function inputLocalAIso(valor: string) {
  if (!valor) return "";

  const fecha = new Date(valor);

  return Number.isNaN(fecha.getTime()) ? "" : fecha.toISOString();
}

/* ------------------------------------------------------------------ */
/*  ALTA                                                               */
/* ------------------------------------------------------------------ */

export function nuevaAlerta(): Alerta {
  const ahora = new Date();

  /* Por defecto, mañana a las nueve: casi ninguna alerta es para ahora mismo. */
  const cuando = new Date(ahora);

  cuando.setDate(cuando.getDate() + 1);
  cuando.setHours(9, 0, 0, 0);

  return {
    id: `ALE-${ahora.getTime().toString(36).toUpperCase()}`,
    titulo: "",
    mensaje: "",
    destinatarios: [],
    adjuntos: [],
    proximoEnvio: cuando.toISOString(),
    repeticion: "una-vez",
    intervaloDias: 7,
    activa: true,
    creada: ahora.toISOString(),
    ultimoEnvio: null,
    envios: 0,
    /* Que suene, que para eso es una alarma. Se puede quitar en el formulario. */
    avisos: [0],
  };
}

/** Lo que impide guardar. Vacío = se puede guardar. */
export function problemasDe(alerta: Alerta): string[] {
  const problemas: string[] = [];

  if (!alerta.titulo.trim()) problemas.push("Ponle un título a la tarea.");

  if (!alerta.destinatarios.length)
    problemas.push("Hace falta al menos un correo de destino.");

  if (!alerta.proximoEnvio) problemas.push("Falta la fecha del aviso.");

  if (
    alerta.repeticion === "personalizada" &&
    (!alerta.intervaloDias || alerta.intervaloDias < 1)
  )
    problemas.push("El intervalo tiene que ser de un día o más.");

  return problemas;
}
