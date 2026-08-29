import { NextRequest, NextResponse } from "next/server";

import {
  abreSubida,
  credenciales,
  dameAcceso,
  dameListas,
  esPrivacidad,
  guardaAjustes,
  leeAjustes,
  meteEnLista,
  urlDeVuelta,
  type EstadoYoutube,
} from "@/lib/coding/youtube";

/**
 * CODING · la cuenta de YouTube y las dos mitades de una subida.
 *
 * - `GET` cuenta cómo está la cosa: si hay credenciales en el servidor, qué
 *   canal está conectado, sus listas de reproducción y los ajustes.
 * - `POST` con `accion`:
 *   - `ajustes` guarda privacidad, lista y si sube solo al exportar.
 *   - `desconectar` olvida la cuenta.
 *   - `subida` abre la subida y devuelve **la URL a la que el navegador manda
 *     los bytes**. Aquí no pasa el vídeo: son gigas, y con la app desplegada
 *     el cuerpo de una petición no llega a 4,5 MB.
 *   - `publica` mete el vídeo ya subido en la lista y devuelve su enlace.
 *
 * El `refresh_token` no sale en ninguna respuesta.
 */

const mal = (mensaje: string, estado = 400) =>
  NextResponse.json({ ok: false, error: mensaje }, { status: estado });

export async function GET(request: NextRequest) {
  const { hay } = credenciales();

  const ajustes = await leeAjustes();

  const base: EstadoYoutube = {
    configurado: hay,
    conectado: hay && Boolean(ajustes.refreshToken),
    canalTitulo: ajustes.canalTitulo,
    privacidad: ajustes.privacidad,
    listaId: ajustes.listaId,
    listaNombre: ajustes.listaNombre,
    subeSiempre: ajustes.subeSiempre,
    conectadoEn: ajustes.conectadoEn,
    listas: [],
  };

  /* La URL de vuelta se enseña siempre: es lo que hay que dar de alta en Google. */
  const vuelta = urlDeVuelta(request);

  if (!base.conectado) {
    return NextResponse.json({ ok: true, estado: base, vuelta });
  }

  /*
  | Las listas se piden aquí y no al desplegar el selector.
  |
  | Es también la única forma de saber que la cuenta **sigue** valiendo: un
  | permiso retirado desde Google no avisa a nadie, y enterarse al terminar un
  | montaje de veinte minutos es enterarse tarde.
  */
  try {
    const acceso = await dameAcceso(ajustes);

    return NextResponse.json({
      ok: true,
      estado: { ...base, listas: await dameListas(acceso) },
      vuelta,
    });
  } catch (error) {
    return NextResponse.json({
      ok: true,
      estado: {
        ...base,
        conectado: false,
        aviso: error instanceof Error ? error.message : "La cuenta ya no responde.",
      },
      vuelta,
    });
  }
}

export async function POST(request: NextRequest) {
  let cuerpo: Record<string, unknown>;

  try {
    cuerpo = (await request.json()) as Record<string, unknown>;
  } catch {
    return mal("La petición no trae datos.");
  }

  const accion = String(cuerpo.accion ?? "");

  try {
    if (accion === "desconectar") {
      const ajustes = await leeAjustes();

      /* Se olvida la cuenta, no la configuración: reconectar deja todo como estaba. */
      await guardaAjustes({
        ...ajustes,
        refreshToken: "",
        canalId: "",
        canalTitulo: "",
        conectadoEn: "",
      });

      return NextResponse.json({ ok: true });
    }

    if (accion === "ajustes") {
      const ajustes = await leeAjustes();

      const privacidad = cuerpo.privacidad;
      const listaId = cuerpo.listaId;

      await guardaAjustes({
        ...ajustes,
        privacidad: esPrivacidad(privacidad) ? privacidad : ajustes.privacidad,
        listaId: listaId === undefined ? ajustes.listaId : String(listaId ?? ""),
        listaNombre:
          cuerpo.listaNombre === undefined
            ? ajustes.listaNombre
            : String(cuerpo.listaNombre ?? ""),
        subeSiempre:
          typeof cuerpo.subeSiempre === "boolean"
            ? cuerpo.subeSiempre
            : ajustes.subeSiempre,
      });

      return NextResponse.json({ ok: true });
    }

    if (accion === "subida") {
      const bytes = Number(cuerpo.bytes ?? 0);

      if (!Number.isFinite(bytes) || bytes <= 0) return mal("El vídeo no tiene tamaño.");

      const ajustes = await leeAjustes();
      const acceso = await dameAcceso(ajustes);

      const url = await abreSubida({
        acceso,
        titulo: String(cuerpo.titulo ?? "Vídeo del coding"),
        descripcion: String(cuerpo.descripcion ?? ""),
        privacidad: ajustes.privacidad,
        bytes,
        tipo: String(cuerpo.tipo ?? "video/mp4"),
      });

      return NextResponse.json({
        ok: true,
        url,
        privacidad: ajustes.privacidad,
        listaNombre: ajustes.listaNombre,
      });
    }

    if (accion === "publica") {
      const videoId = String(cuerpo.videoId ?? "");

      if (!videoId) return mal("Falta el vídeo que se acaba de subir.");

      const ajustes = await leeAjustes();

      /*
      | La lista es lo único que puede fallar **después** de subir, y no puede
      | tumbar la subida: el vídeo ya está en el canal y el enlace ya sirve.
      | Se avisa de que no se ha podido ordenar, y ya está.
      */
      let enLista = false;
      let aviso: string | undefined;

      if (ajustes.listaId) {
        try {
          await meteEnLista(await dameAcceso(ajustes), ajustes.listaId, videoId);

          enLista = true;
        } catch (error) {
          aviso =
            error instanceof Error
              ? error.message
              : "No se ha podido meter en la lista de reproducción.";
        }
      }

      return NextResponse.json({
        ok: true,
        url: `https://youtu.be/${videoId}`,
        enLista,
        listaNombre: ajustes.listaNombre,
        privacidad: ajustes.privacidad,
        aviso,
      });
    }

    return mal("Acción desconocida.");
  } catch (error) {
    console.error("[youtube] POST", accion, error);

    return mal(
      error instanceof Error ? error.message : "No se ha podido hablar con YouTube.",
      500,
    );
  }
}
