/**
 * Bajar los vídeos de ABP por jugador (27/10/2026): uno, o todos en un .zip
 * de una vez (antes iban de uno en uno y el navegador pedía permiso para cada
 * descarga). En el móvil, uno va por la hoja de compartir: «Guardar vídeo» lo
 * deja en la galería, que es donde se busca después.
 *
 * Las librerías se cargan al pulsar: esto lo importa el layout.
 */

import type { HechoVideo } from "@/lib/abp/trabajo-pdfs";

/** Un .zip sin comprimir: el MP4 ya va comprimido y así sale al instante. */
export async function descargaVideos(videos: HechoVideo[], nombre: string) {
  if (videos.length === 0) return;

  const [{ creaZip }, { descarga }] = await Promise.all([import("@/lib/export/zip"), import("@/lib/export/lienzos")]);

  if (videos.length === 1) {
    descarga(videos[0].blob, videos[0].nombre);

    return;
  }

  const entradas = await Promise.all(videos.map(async (v) => ({ nombre: v.nombre, datos: new Uint8Array(await v.blob.arrayBuffer()) })));

  descarga(creaZip(entradas), nombre.replace(/\s+/g, "-").replace(/-+/g, "-"));
}

/** En el móvil, la hoja de compartir (con «Guardar vídeo»); en el ordenador, la descarga. */
export async function guardaVideo(video: HechoVideo) {
  const archivo = new File([video.blob], video.nombre, { type: "video/mp4" });
  const tactil = typeof window !== "undefined" && window.matchMedia?.("(pointer: coarse)").matches;

  if (tactil && navigator.canShare?.({ files: [archivo] })) {
    try {
      await navigator.share({ files: [archivo], title: video.nombre });
    } catch {
      /* Cancelado en la hoja de compartir: nada que avisar. */
    }

    return;
  }

  await descargaVideos([video], video.nombre);
}
