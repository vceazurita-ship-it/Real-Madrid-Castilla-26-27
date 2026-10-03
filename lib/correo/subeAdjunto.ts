/**
 * SUBIR UN ADJUNTO GRANDE DESDE EL NAVEGADOR (03/10/2026).
 *
 * El PDF o el PPT del rival no caben en la petición del correo (Vercel corta a
 * ~4,5 MB), así que se suben antes, **directos a Supabase**:
 *
 *   1. `/api/informe/subida` comprueba la sesión y firma una URL de subida.
 *   2. Los bytes van del navegador a Supabase con esa URL, sin pasar por
 *      Vercel. Es lo mismo que hace `uploadToSignedUrl` de supabase-js —PUT
 *      con un formulario de `cacheControl` y el archivo en el campo sin nombre,
 *      `x-upsert: false`— escrito con XMLHttpRequest para poder enseñar el
 *      progreso.
 *   3. Lo que devuelve (`url`) va en `adjuntosUrl` al mandar el correo, y el
 *      servidor se lo trae y lo adjunta.
 *
 * Se puede usar en el navegador.
 */

export type AdjuntoSubido = { nombre: string; url: string; tipo: string; tamano: number; path: string };

/** Dónde se guarda: para un correo (se barre a la semana) o como documento del rival (se queda). */
export type DestinoSubida = { carpeta?: "informe" | "rival"; equipo?: string };

const TIPOS: Record<string, string> = {
  pdf: "application/pdf",
  pptx: "application/vnd.openxmlformats-officedocument.presentationml.presentation",
};

/** El tipo del archivo; Windows a veces no lo da y se saca de la extensión. */
function tipoDe(file: File) {
  if (file.type) return file.type;

  return TIPOS[file.name.split(".").pop()?.toLowerCase() ?? ""] ?? "";
}

export async function subeAdjunto(file: File, alProgreso?: (fraccion: number) => void, destino: DestinoSubida = {}): Promise<AdjuntoSubido> {
  const tipo = tipoDe(file);

  const firma = await fetch("/api/informe/subida", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ nombre: file.name, tipo, tamano: file.size, carpeta: destino.carpeta ?? "informe", equipo: destino.equipo ?? "" }),
  });

  if (firma.status === 401) {
    throw new Error("Entra con tu cuenta del cuerpo técnico (la de la quiniela) para adjuntar archivos.");
  }

  const datos = (await firma.json().catch(() => null)) as {
    ok?: boolean;
    error?: string;
    subida?: string;
    url?: string;
    path?: string;
  } | null;

  if (!firma.ok || !datos?.ok || !datos.subida || !datos.url) {
    throw new Error(datos?.error ?? "No se ha podido preparar la subida del archivo.");
  }

  const subida = datos.subida;

  const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? "";

  const formulario = new FormData();

  formulario.append("cacheControl", "3600");
  formulario.append("", file);

  await new Promise<void>((resuelve, falla) => {
    const xhr = new XMLHttpRequest();

    xhr.open("PUT", subida);

    /* Lo mismo que manda el cliente de supabase-js: la firma va en la URL
       (`token`) y la pasarela de Supabase pide además la clave pública. */
    if (anon) {
      xhr.setRequestHeader("apikey", anon);
      xhr.setRequestHeader("Authorization", `Bearer ${anon}`);
    }

    xhr.setRequestHeader("x-upsert", "false");

    xhr.upload.onprogress = (evento) => {
      if (evento.lengthComputable) alProgreso?.(evento.loaded / evento.total);
    };

    xhr.onload = () => {
      if (xhr.status >= 200 && xhr.status < 300) {
        alProgreso?.(1);
        resuelve();

        return;
      }

      let motivo = "";

      try {
        motivo = (JSON.parse(xhr.responseText) as { message?: string; error?: string }).message ?? "";
      } catch {
        /* Sin cuerpo legible: vale con el código. */
      }

      falla(new Error(`No se ha podido subir «${file.name}»${motivo ? `: ${motivo}` : ` (${xhr.status})`}.`));
    };

    xhr.onerror = () => falla(new Error(`No se ha podido subir «${file.name}»: se ha cortado la conexión.`));

    xhr.send(formulario);
  });

  return { nombre: file.name, url: datos.url, tipo, tamano: file.size, path: datos.path ?? "" };
}
