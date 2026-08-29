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

  const videoId = await new Promise<string>((resuelve, rechaza) => {
    const peticion = new XMLHttpRequest();

    peticion.open("PUT", url, true);
    peticion.setRequestHeader("Content-Type", tipo);

    peticion.upload.onprogress = (evento) => {
      if (evento.lengthComputable) onProgreso?.(evento.loaded / evento.total);
    };

    peticion.onload = () => {
      /*
      | Google contesta 200 o 201 con el vídeo dentro; cualquier otra cosa es
      | un fallo aunque el `PUT` haya «terminado».
      */
      if (peticion.status !== 200 && peticion.status !== 201) {
        rechaza(new Error(explica(peticion.status, peticion.responseText)));
        return;
      }

      try {
        const datos = JSON.parse(peticion.responseText) as { id?: string };

        if (!datos.id) throw new Error("sin id");

        resuelve(datos.id);
      } catch {
        rechaza(new Error("YouTube ha aceptado el vídeo pero no ha dicho cuál es."));
      }
    };

    peticion.onerror = () =>
      rechaza(new Error("Se ha cortado la conexión con YouTube durante la subida."));

    peticion.onabort = () => rechaza(new Error(SUBIDA_CANCELADA));

    senal?.addEventListener("abort", () => peticion.abort(), { once: true });

    peticion.send(blob);
  });

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

export const SUBIDA_CANCELADA = "subida-cancelada";

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

  return `YouTube respondió ${estado} al recibir el vídeo.`;
}
