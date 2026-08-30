/**
 * SUBIR LOS VÍDEOS DEL CODING AL CANAL DEL CLUB.
 *
 * Un vídeo unificado se descarga al ordenador del analista, pero el sitio
 * donde acaba —el móvil del jugador, el grupo del cuerpo técnico, la sala—
 * casi siempre es un enlace. Aquí se sube al canal de YouTube de la cuenta que
 * se configure, **en oculto** por defecto: cualquiera con el enlace lo ve, y
 * nadie lo encuentra buscando. Un análisis individual no puede salir en el
 * canal público del club, y un vídeo privado no se lo puede ver el jugador.
 *
 * **Esto es sólo de servidor**: usa `docStore`, que va con la clave de
 * servicio de Supabase. Lo que toca el navegador está en
 * `lib/coding/youtube-cliente.ts`.
 *
 * Tres decisiones que valen para todo el módulo:
 *
 * 1. **Los bytes no pasan por aquí.** El servidor sólo pide la sesión de
 *    subida y devuelve su URL; los gigas van del navegador a Google
 *    directamente. Es lo mismo que ya obliga a montar el vídeo en el
 *    navegador: con la app desplegada, el cuerpo de una petición no llega a
 *    4,5 MB y una función se corta a los 300 s. Ver `coding/navegador.ts`.
 * 2. **El `refresh_token` no sale de aquí.** Vive en `app_documents` bajo una
 *    clave `secreto:` —que `/api/docs` no sirve— y el navegador nunca ve ni
 *    él ni el `access_token`: la URL de subida que se le entrega ya viene
 *    autorizada por Google y caduca sola.
 * 3. **Sin credenciales, la pantalla lo dice.** `YOUTUBE_CLIENT_ID` y
 *    `YOUTUBE_CLIENT_SECRET` los da la consola de Google, y hasta que estén
 *    el panel explica qué falta en vez de fallar al pulsar.
 */

import { readDoc, writeDoc } from "@/lib/docStore";

/* ------------------------------------------------------------------ */
/*  LO QUE SE GUARDA                                                   */
/* ------------------------------------------------------------------ */

/**
 * La clave lleva `secreto:` a propósito.
 *
 * `/api/docs` sirve cualquier documento por su clave al primero que la pida
 * desde el navegador. Guardar aquí el `refresh_token` con una clave normal
 * —`coding:youtube`— sería publicarlo. El prefijo está vetado en esa ruta.
 */
export const CLAVE_YOUTUBE = "secreto:youtube";

/** Quién puede ver el vídeo recién subido. */
export type PrivacidadYoutube = "unlisted" | "private" | "public";

export type AjustesYoutube = {
  /** Lo único que no se enseña nunca al navegador. */
  refreshToken: string;
  canalId: string;
  canalTitulo: string;
  /** Por defecto **oculto**: con enlace se ve, buscando no aparece. */
  privacidad: PrivacidadYoutube;
  /** La lista de reproducción donde cae el vídeo, o vacío para ninguna. */
  listaId: string;
  listaNombre: string;
  /** Subir al terminar cada montaje sin tener que pedirlo. */
  subeSiempre: boolean;
  /** Cuándo se conectó la cuenta, para poder decirlo en la pantalla. */
  conectadoEn: string;
};

/** Lo que sí puede ver el navegador: todo menos el `refresh_token`. */
export type EstadoYoutube = {
  /** Hay `YOUTUBE_CLIENT_ID` y `YOUTUBE_CLIENT_SECRET` en el entorno. */
  configurado: boolean;
  conectado: boolean;
  canalTitulo: string;
  privacidad: PrivacidadYoutube;
  listaId: string;
  listaNombre: string;
  subeSiempre: boolean;
  conectadoEn: string;
  /** Las listas del canal, para poder elegir. Vacío si no se han podido leer. */
  listas: { id: string; nombre: string; cuenta: number }[];
  /** Qué ha fallado al leer el canal, si es que ha fallado. */
  aviso?: string;
};

const POR_DEFECTO: AjustesYoutube = {
  refreshToken: "",
  canalId: "",
  canalTitulo: "",
  privacidad: "unlisted",
  listaId: "",
  listaNombre: "",
  subeSiempre: true,
  conectadoEn: "",
};

/** Lo guardado, con los huecos rellenos: un documento viejo no puede romper nada. */
export async function leeAjustes(): Promise<AjustesYoutube> {
  const { data } = await readDoc<Partial<AjustesYoutube>>(CLAVE_YOUTUBE);

  if (!data || typeof data !== "object") return POR_DEFECTO;

  return {
    refreshToken: String(data.refreshToken ?? ""),
    canalId: String(data.canalId ?? ""),
    canalTitulo: String(data.canalTitulo ?? ""),
    privacidad: esPrivacidad(data.privacidad) ? data.privacidad : "unlisted",
    listaId: String(data.listaId ?? ""),
    listaNombre: String(data.listaNombre ?? ""),
    subeSiempre: data.subeSiempre !== false,
    conectadoEn: String(data.conectadoEn ?? ""),
  };
}

export async function guardaAjustes(ajustes: AjustesYoutube) {
  await writeDoc(CLAVE_YOUTUBE, "coding", ajustes);
}

export function esPrivacidad(valor: unknown): valor is PrivacidadYoutube {
  return valor === "unlisted" || valor === "private" || valor === "public";
}

/* ------------------------------------------------------------------ */
/*  LAS CREDENCIALES                                                   */
/* ------------------------------------------------------------------ */

/**
 * Los permisos que se le piden a Google, y por qué son dos.
 *
 * `youtube.upload` sube el vídeo y no puede hacer nada más —ni leer, ni
 * borrar—, pero **no** basta para meterlo en una lista de reproducción: eso lo
 * hace `playlistItems.insert`, y ése exige `youtube`. Como el cuerpo técnico
 * quiere los vídeos ordenados por partido en su lista, hacen falta los dos.
 */
export const PERMISOS = [
  "https://www.googleapis.com/auth/youtube.upload",
  "https://www.googleapis.com/auth/youtube",
].join(" ");

export function credenciales() {
  const id = process.env.YOUTUBE_CLIENT_ID ?? "";
  const secreto = process.env.YOUTUBE_CLIENT_SECRET ?? "";

  return { id, secreto, hay: Boolean(id && secreto) };
}

/**
 * A dónde vuelve Google después de que el analista diga que sí.
 *
 * Se saca del origen de la petición y no de una variable: la app corre en el
 * portátil (`http://localhost:3001`), en la máquina de la sala y desplegada, y
 * pedir una variable por sitio era la forma segura de que la mitad de las
 * veces la URL no coincidiera con la registrada y Google contestara
 * `redirect_uri_mismatch` sin decir cuál esperaba.
 *
 * Ojo: la que salga de aquí es **exactamente** la que hay que dar de alta en
 * la consola de Google. El panel la enseña para poder copiarla.
 */
export function urlDeVuelta(peticion: Request) {
  return new URL("/api/youtube/callback", peticion.url).toString();
}

/* ------------------------------------------------------------------ */
/*  HABLAR CON GOOGLE                                                  */
/* ------------------------------------------------------------------ */

/**
 * Un `access_token` fresco a partir del `refresh_token`.
 *
 * No se guarda en ningún sitio: dura una hora, pedirlo cuesta una llamada y
 * guardarlo obligaría a llevar la cuenta de cuándo caduca en un documento que
 * se escribe desde varias pestañas a la vez.
 */
export async function dameAcceso(ajustes: AjustesYoutube) {
  const { id, secreto, hay } = credenciales();

  if (!hay) throw new Error("Faltan las credenciales de Google en el servidor.");
  if (!ajustes.refreshToken) throw new Error("No hay ninguna cuenta de YouTube conectada.");

  const respuesta = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: id,
      client_secret: secreto,
      refresh_token: ajustes.refreshToken,
      grant_type: "refresh_token",
    }),
  });

  const datos = (await respuesta.json().catch(() => null)) as {
    access_token?: string;
    error?: string;
    error_description?: string;
  } | null;

  if (!respuesta.ok || !datos?.access_token) {
    /*
    | `invalid_grant` es el permiso retirado, no un fallo pasajero.
    |
    | Pasa cuando alguien quita el acceso desde su cuenta de Google, cuando se
    | cambia la contraseña o cuando el proyecto sigue «en pruebas» y los siete
    | días de gracia se han cumplido. Reintentar no arregla ninguna: hay que
    | volver a conectar, y eso es lo que tiene que decir la pantalla.
    */
    throw new Error(
      datos?.error === "invalid_grant"
        ? "Google ha caducado el permiso. Vuelve a conectar la cuenta de YouTube."
        : datos?.error_description ?? "Google no ha dado acceso a la cuenta.",
    );
  }

  return datos.access_token;
}

/** Una llamada a la API de YouTube con el error ya traducido. */
async function llamaApi<T>(
  acceso: string,
  ruta: string,
  opciones: RequestInit = {},
): Promise<T> {
  const respuesta = await fetch(`https://www.googleapis.com/youtube/v3/${ruta}`, {
    ...opciones,
    headers: {
      Authorization: `Bearer ${acceso}`,
      ...(opciones.body ? { "Content-Type": "application/json" } : {}),
      ...opciones.headers,
    },
  });

  const datos = await respuesta.json().catch(() => null);

  if (!respuesta.ok) {
    const mensaje =
      (datos as { error?: { message?: string } } | null)?.error?.message ??
      `YouTube respondió ${respuesta.status}`;

    throw new Error(mensaje);
  }

  return datos as T;
}

/** El canal de la cuenta conectada. */
export async function dameCanal(acceso: string) {
  const datos = await llamaApi<{
    items?: { id: string; snippet?: { title?: string } }[];
  }>(acceso, "channels?part=snippet&mine=true");

  const canal = datos.items?.[0];

  if (!canal) {
    throw new Error(
      "Esa cuenta de Google no tiene canal de YouTube. Crea el canal y vuelve a conectar.",
    );
  }

  return { id: canal.id, titulo: canal.snippet?.title ?? "Canal sin nombre" };
}

/** Las listas de reproducción del canal, para poder elegir dónde caen los vídeos. */
export async function dameListas(acceso: string) {
  const datos = await llamaApi<{
    items?: {
      id: string;
      snippet?: { title?: string };
      contentDetails?: { itemCount?: number };
    }[];
  }>(acceso, "playlists?part=snippet,contentDetails&mine=true&maxResults=50");

  return (datos.items ?? []).map((lista) => ({
    id: lista.id,
    nombre: lista.snippet?.title ?? "Lista sin nombre",
    cuenta: lista.contentDetails?.itemCount ?? 0,
  }));
}

/**
 * Abre la subida y devuelve la URL a la que el navegador manda los bytes.
 *
 * Google contesta con una `Location` que ya lleva la autorización dentro y
 * caduca sola, así que se le puede dar al navegador sin enseñarle ningún
 * token. A partir de ahí es un `PUT` con el fichero y nada más.
 *
 * **`origen` no es un adorno.** La sesión hereda el permiso de origen cruzado
 * de la petición que la abre, y ésta la abre el servidor, donde no hay ningún
 * `Origin`. Sin decírselo, Google devuelve una URL que el navegador no puede
 * usar: el `PUT` se queda sin cabeceras CORS, se cae antes de mandar un byte y
 * lo único que se ve es un «se ha cortado la conexión» que no se arregla
 * reintentando.
 */
export async function abreSubida(opciones: {
  acceso: string;
  titulo: string;
  descripcion: string;
  privacidad: PrivacidadYoutube;
  bytes: number;
  tipo: string;
  /** El origen del navegador que va a mandar los bytes. */
  origen?: string;
}) {
  const respuesta = await fetch(
    "https://www.googleapis.com/upload/youtube/v3/videos?uploadType=resumable&part=snippet,status",
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${opciones.acceso}`,
        "Content-Type": "application/json; charset=UTF-8",
        "X-Upload-Content-Length": String(opciones.bytes),
        "X-Upload-Content-Type": opciones.tipo,
        ...(opciones.origen ? { Origin: opciones.origen } : {}),
      },
      body: JSON.stringify({
        snippet: {
          /* YouTube corta el título en 100 caracteres y rechaza `<` y `>`. */
          title: limpiaTexto(opciones.titulo).slice(0, 100) || "Vídeo del coding",
          description: limpiaTexto(opciones.descripcion).slice(0, 5000),
        },
        status: {
          privacyStatus: opciones.privacidad,
          selfDeclaredMadeForKids: false,
        },
      }),
    },
  );

  if (!respuesta.ok) {
    const datos = (await respuesta.json().catch(() => null)) as {
      error?: { message?: string };
    } | null;

    throw new Error(
      datos?.error?.message ?? `YouTube respondió ${respuesta.status} al abrir la subida.`,
    );
  }

  const destino = respuesta.headers.get("location");

  if (!destino) throw new Error("YouTube no ha dado dónde subir el vídeo.");

  return destino;
}

/** Mete el vídeo ya subido en la lista de reproducción elegida. */
export async function meteEnLista(acceso: string, listaId: string, videoId: string) {
  await llamaApi(acceso, "playlistItems?part=snippet", {
    method: "POST",
    body: JSON.stringify({
      snippet: {
        playlistId: listaId,
        resourceId: { kind: "youtube#video", videoId },
      },
    }),
  });
}

/**
 * Quita lo que YouTube no admite en un título ni en una descripción.
 *
 * `<` y `>` hacen que la API rechace el vídeo entero con un error que no
 * explica nada, y un salto de línea en el título lo corta por ahí.
 */
function limpiaTexto(valor: string) {
  return valor.replace(/[<>]/g, "").trim();
}
