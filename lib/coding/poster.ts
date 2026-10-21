"use client";

/**
 * El póster de un MP4 que no tiene carátula: un fotograma suyo en JPEG.
 *
 * El vídeo unificado con carátula ya tiene póster —la propia carátula—. Los
 * demás (un corte suelto, un unificado sin carátula) salían sin nada que
 * poner en el correo o en el PDF junto al enlace. Aquí se saca del propio
 * fichero ya montado, así que es exactamente lo que se va a ver: con el
 * rótulo puesto si lo lleva, porque se coge a mitad de su tiempo en pantalla.
 *
 * Sólo usa el navegador —un `<video>` sobre el Blob y un lienzo—, nada sale
 * del ordenador.
 */

/** El instante del póster: con el rótulo ya entrado y antes de que se vaya. */
export const SEGUNDO_POSTER = 1.5;

const CALIDAD = 0.9;

/** Lo que tarda como mucho en salir; si no, se sigue sin póster. */
const PLAZO_MS = 15_000;

export async function posterDeVideo(
  blob: Blob,
  segundo = SEGUNDO_POSTER,
): Promise<string | null> {
  const url = URL.createObjectURL(blob);
  const video = document.createElement("video");

  video.muted = true;
  video.playsInline = true;
  video.preload = "auto";
  video.src = url;

  try {
    await new Promise<void>((resuelve, rechaza) => {
      const plazo = setTimeout(() => rechaza(new Error("plazo")), PLAZO_MS);

      video.addEventListener(
        "loadedmetadata",
        () => {
          /* Un corte de menos de segundo y medio: su mitad. */
          const destino = Math.min(segundo, Math.max(0, (video.duration || 0) / 2));

          video.addEventListener(
            "seeked",
            () => {
              clearTimeout(plazo);
              resuelve();
            },
            { once: true },
          );

          video.currentTime = destino;
        },
        { once: true },
      );

      video.addEventListener(
        "error",
        () => {
          clearTimeout(plazo);
          rechaza(new Error("vídeo ilegible"));
        },
        { once: true },
      );
    });

    if (!video.videoWidth || !video.videoHeight) return null;

    const lienzo = document.createElement("canvas");

    lienzo.width = video.videoWidth;
    lienzo.height = video.videoHeight;

    const ctx = lienzo.getContext("2d");

    if (!ctx) return null;

    ctx.drawImage(video, 0, 0, lienzo.width, lienzo.height);

    return lienzo.toDataURL("image/jpeg", CALIDAD);
  } catch (error) {
    console.warn("[coding] no se ha podido sacar el póster del vídeo", error);

    return null;
  } finally {
    video.removeAttribute("src");
    video.load();
    URL.revokeObjectURL(url);
  }
}
