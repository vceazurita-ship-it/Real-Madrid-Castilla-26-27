"use client";

/**
 * La subida a YouTube, desde el navegador.
 *
 * Los bytes van del navegador a Google **sin pasar por el servidor**: el
 * vídeo unificado de un partido son cientos de megas y el cuerpo de una
 * petición no llega a 4,5 MB con la app desplegada. El servidor sólo abre la
 * subida —`POST /api/youtube` con `accion: "subida"`— y devuelve una URL de
 * Google que ya viene autorizada; aquí se le enchufa el fichero y se le
 * pregunta al servidor que lo ordene en su lista.
 *
 * Va con `XMLHttpRequest` y no con `fetch` por lo mismo que la importación de
 * partidos (`lib/coding/importa.ts`): `fetch` **no informa del progreso de
 * subida**, y una barra parada durante veinte minutos no se distingue de una
 * colgada.
 *
 * **Un corte de red no tira la subida.** Subir 800 MB por el wifi de un campo
 * tarda lo suyo, y en ese rato la conexión se cae sola más de una vez: la
 * primera versión se rendía al primer corte —«Se ha cortado la conexión con
 * YouTube»— y había que montar el vídeo otra vez. La URL que da Google es una
 * *sesión reanudable*: se le puede preguntar cuántos bytes lleva recibidos y
 * seguir desde ahí. Eso es lo que hace `subeAYoutube` ahora, hasta
 * `REINTENTOS` veces, y sólo se rinde cuando Google dice que no —permiso,
 * cuota, sesión caducada— o cuando la red no deja pasar ni un byte.
 */

export type ResultadoYoutube = {
  url: string;
  enLista: boolean;
  listaNombre: string;
  privacidad: "unlisted" | "private" | "public";
  /** Lo que ha ido regular sin impedir la subida (la lista, casi siempre). */
  aviso?: string;
};

/** Cómo se llama cada privacidad en la pantalla. */
export const NOMBRE_PRIVACIDAD = {
  unlisted: "oculto",
  private: "privado",
  public: "público",
} as const;

export const SUBIDA_CANCELADA = "subida-cancelada";

/** Cuántas veces se vuelve a intentar tras un corte antes de rendirse. */
const REINTENTOS = 4;

async function pide<T>(cuerpo: Record<string, unknown>): Promise<T> {
  const respuesta = await fetch("/api/youtube", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(cuerpo),
  });

  const datos = (await respuesta.json().catch(() => null)) as
    | ({ ok?: boolean; error?: string } & T)
    | null;

  if (!respuesta.ok || !datos?.ok) {
    throw new Error(datos?.error ?? `El servidor respondió ${respuesta.status}`);
  }

  return datos;
}

/**
 * Un fallo de la subida sabiendo si tiene arreglo reintentando.
 *
 * `fatal` es lo que no mejora esperando: la cuenta desconectada, la cuota del
 * día, la sesión caducada o el analista cancelando. Todo lo demás —un corte,
 * un 500 de Google— se reintenta reanudando.
 */
class FalloSubida extends Error {
  fatal: boolean;

  constructor(mensaje: string, fatal = false) {
    super(mensaje);

    this.fatal = fatal;
  }
}

/**
 * Sube el vídeo y lo deja en su lista. Devuelve el enlace.
 *
 * `onProgreso` recibe de 0 a 1. Se llama también al terminar con 1, que es lo
 * que cierra la barra en la pantalla.
 */
export async function subeAYoutube(opciones: {
  blob: Blob;
  titulo: string;
  descripcion: string;
  onProgreso?: (fraccion: number) => void;
  /** Para poder cancelar desde el aviso. */
  senal?: AbortSignal;
}): Promise<ResultadoYoutube> {
  const { blob, titulo, descripcion, onProgreso, senal } = opciones;

  const tipo = blob.type || "video/mp4";

  const { url } = await pide<{ url: string }>({
    accion: "subida",
    titulo,
    descripcion,
    bytes: blob.size,
    tipo,
  });

  /*
  | El bucle de reanudación.
  |
  | `desde` es el primer byte que le falta a Google. Empieza en 0 y, tras cada
  | corte, se lo preguntamos a la propia sesión: si contesta que ya tiene la
  | mitad, se manda sólo la otra mitad. Si no lo puede contestar —la cabecera
  | `Range` no siempre llega al navegador— se vuelve a mandar entero, que es
  | lento pero acaba.
  */
  let desde = 0;
  let masLejos = 0;
  let ultimo: FalloSubida | null = null;
  let videoId = "";

  for (let intento = 0; intento <= REINTENTOS; intento++) {
    try {
      videoId = await mandaBytes({ url, blob, desde, tipo, onProgreso, senal });

      break;
    } catch (error) {
      const fallo =
        error instanceof FalloSubida
          ? error
          : new FalloSubida(error instanceof Error ? error.message : "Fallo al subir.");

      ultimo = fallo;

      /* Lo fatal se cuenta tal cual; lo demás, cuando se agotan los intentos. */
      if (fallo.fatal) throw fallo;

      if (intento === REINTENTOS) break;

      await esperaUnPoco(intento, senal);

      /*
      | Preguntar por dónde iba es también la forma de descubrir que la subida
      | sí había terminado: el corte puede haber sido al recibir la respuesta,
      | con el vídeo ya entero en Google.
      */
      const estado = await preguntaPorDonde(url, blob.size, senal).catch(() => null);

      if (estado && "id" in estado) {
        videoId = estado.id;

        break;
      }

      desde = estado?.recibidos ?? 0;
      masLejos = Math.max(masLejos, desde);
    }
  }

  if (!videoId) {
    throw new FalloSubida(
      masLejos === 0
        ? "No ha llegado ni un byte a YouTube. Suele ser la red —o una extensión " +
          "del navegador— cortando la subida. " +
          (ultimo?.message ?? "")
        : (ultimo?.message ?? "La subida se ha cortado demasiadas veces."),
    );
  }

  onProgreso?.(1);

  const { url: enlace, enLista, listaNombre, privacidad, aviso } = await pide<{
    url: string;
    enLista: boolean;
    listaNombre: string;
    privacidad: ResultadoYoutube["privacidad"];
    aviso?: string;
  }>({ accion: "publica", videoId });

  return { url: enlace, enLista, listaNombre, privacidad, aviso };
}

/** 2 s, 4 s, 8 s, 16 s. Cancelar durante la espera cancela de verdad. */
function esperaUnPoco(intento: number, senal?: AbortSignal) {
  return new Promise<void>((resuelve, rechaza) => {
    if (senal?.aborted) {
      rechaza(new FalloSubida(SUBIDA_CANCELADA, true));

      return;
    }

    const reloj = setTimeout(() => {
      senal?.removeEventListener("abort", corta);

      resuelve();
    }, Math.min(2000 * 2 ** intento, 20000));

    function corta() {
      clearTimeout(reloj);

      rechaza(new FalloSubida(SUBIDA_CANCELADA, true));
    }

    senal?.addEventListener("abort", corta, { once: true });
  });
}

/**
 * Manda el fichero —o lo que le falte— y devuelve el id del vídeo.
 *
 * Con `desde` a 0 es un `PUT` normal. A partir de ahí lleva `Content-Range`,
 * que es como se le dice a una sesión reanudable «esto es el trozo que va del
 * byte tal al final».
 */
function mandaBytes(opciones: {
  url: string;
  blob: Blob;
  desde: number;
  tipo: string;
  onProgreso?: (fraccion: number) => void;
  senal?: AbortSignal;
}) {
  const { url, blob, desde, tipo, onProgreso, senal } = opciones;

  const total = blob.size;

  return new Promise<string>((resuelve, rechaza) => {
    if (senal?.aborted) {
      rechaza(new FalloSubida(SUBIDA_CANCELADA, true));

      return;
    }

    const peticion = new XMLHttpRequest();

    peticion.open("PUT", url, true);
    peticion.setRequestHeader("Content-Type", tipo);

    if (desde > 0) {
      peticion.setRequestHeader("Content-Range", `bytes ${desde}-${total - 1}/${total}`);
    }

    peticion.upload.onprogress = (evento) => {
      if (evento.lengthComputable) onProgreso?.((desde + evento.loaded) / total);
    };

    peticion.onload = () => {
      /*
      | Google contesta 200 o 201 con el vídeo dentro. El 308 es «me falta
      | trozo», que aquí sólo pasa si algo se ha perdido por el camino: se
      | trata como un corte y el bucle de fuera pregunta por dónde iba.
      */
      if (peticion.status !== 200 && peticion.status !== 201) {
        rechaza(
          new FalloSubida(
            explica(peticion.status, peticion.responseText),
            esFatal(peticion.status),
          ),
        );

        return;
      }

      try {
        const datos = JSON.parse(peticion.responseText) as { id?: string };

        if (!datos.id) throw new Error("sin id");

        resuelve(datos.id);
      } catch {
        rechaza(
          new FalloSubida("YouTube ha aceptado el vídeo pero no ha dicho cuál es.", true),
        );
      }
    };

    peticion.onerror = () =>
      rechaza(new FalloSubida("Se ha cortado la conexión con YouTube durante la subida."));

    peticion.ontimeout = () =>
      rechaza(new FalloSubida("YouTube ha tardado demasiado en contestar."));

    peticion.onabort = () => rechaza(new FalloSubida(SUBIDA_CANCELADA, true));

    senal?.addEventListener("abort", () => peticion.abort(), { once: true });

    peticion.send(desde > 0 ? blob.slice(desde) : blob);
  });
}

/**
 * Le pregunta a la sesión cuántos bytes lleva recibidos.
 *
 * Es un `PUT` vacío cuyo `Content-Range` no dice qué trozo manda sino sólo el
 * tamaño total: eso es lo que Google entiende por «¿por dónde vas?». Contesta 308
 * con una cabecera `Range: bytes=0-N` —el último byte que tiene—, o 200/201 si
 * resulta que la subida ya estaba entera. Si la cabecera no se puede leer se
 * devuelve 0 y se manda el fichero otra vez desde el principio.
 */
function preguntaPorDonde(url: string, total: number, senal?: AbortSignal) {
  return new Promise<{ recibidos: number } | { id: string }>((resuelve, rechaza) => {
    if (senal?.aborted) {
      rechaza(new FalloSubida(SUBIDA_CANCELADA, true));

      return;
    }

    const peticion = new XMLHttpRequest();

    peticion.open("PUT", url, true);
    peticion.setRequestHeader("Content-Range", `bytes */${total}`);

    peticion.onload = () => {
      if (peticion.status === 200 || peticion.status === 201) {
        const id = (JSON.parse(peticion.responseText || "{}") as { id?: string }).id;

        if (id) {
          resuelve({ id });

          return;
        }
      }

      if (peticion.status === 308) {
        const rango = peticion.getResponseHeader("Range") ?? "";
        const hasta = /bytes=0-(\d+)/.exec(rango)?.[1];

        resuelve({ recibidos: hasta ? Number(hasta) + 1 : 0 });

        return;
      }

      /*
      | 404 y 410 son la sesión caducada: las URLs de Google duran una semana,
      | pero también se mueren si se manda algo que no cuadra. Reintentar sobre
      | ella no lleva a ningún sitio.
      */
      if (peticion.status === 404 || peticion.status === 410) {
        rechaza(
          new FalloSubida(
            "La subida ha caducado en YouTube. Vuelve a exportar el vídeo para subirlo.",
            true,
          ),
        );

        return;
      }

      rechaza(new FalloSubida(explica(peticion.status, peticion.responseText)));
    };

    peticion.onerror = () =>
      rechaza(new FalloSubida("No se ha podido preguntar a YouTube por dónde iba."));

    peticion.onabort = () => rechaza(new FalloSubida(SUBIDA_CANCELADA, true));

    senal?.addEventListener("abort", () => peticion.abort(), { once: true });

    peticion.send(null);
  });
}

/** Lo que no se arregla reintentando. */
function esFatal(estado: number) {
  return estado === 400 || estado === 401 || estado === 403 || estado === 404 || estado === 410;
}

/**
 * El error de Google, en cristiano.
 *
 * Los dos que se ven de verdad son la cuota diaria de subidas —que es del
 * proyecto de Google, no del canal— y el vídeo que no pasa las normas.
 */
function explica(estado: number, texto: string) {
  const razon = /"reason":\s*"([^"]+)"/.exec(texto)?.[1] ?? "";

  if (razon === "quotaExceeded" || razon === "uploadLimitExceeded") {
    return (
      "YouTube no admite más subidas hoy con esta cuenta. Se puede pedir " +
      "más cuota en la consola de Google, o subir mañana."
    );
  }

  if (estado === 401 || estado === 403) {
    return "YouTube ha rechazado la subida: vuelve a conectar la cuenta.";
  }

  if (estado === 0) {
    return "Se ha cortado la conexión con YouTube durante la subida.";
  }

  return `YouTube respondió ${estado} al recibir el vídeo.`;
}
