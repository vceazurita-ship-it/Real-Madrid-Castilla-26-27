/**
 * Cuánto dura un vídeo, sin tocar el reproductor de la pantalla.
 *
 * Se mide con un `<video>` suelto y `preload="metadata"`: el navegador baja la
 * cabecera del fichero y nada más, así que vale igual para un blob del disco,
 * para el vídeo servido por trozos desde la carpeta de partidos y para un
 * enlace de Supabase.
 *
 * **No se usa la duración del reproductor** aunque esté a mano. Ese número es
 * del vídeo que se está mirando y no se pone a cero al cambiar de fichero: al
 * abrir varios de golpe —las dos partes de un partido— habría dado a los dos
 * la duración del primero, y un corte de inicio a fin con la medida del otro
 * vídeo es un corte mal hecho.
 */

/** La duración en milisegundos, o 0 si el navegador no puede leerla. */
export function duracionDeVideoMs(src: string, esperaMs = 20_000) {
  return new Promise<number>((resuelve) => {
    if (!src) {
      resuelve(0);
      return;
    }

    const video = document.createElement("video");

    video.preload = "metadata";
    video.muted = true;

    let terminado = false;

    const acaba = (ms: number) => {
      if (terminado) return;

      terminado = true;

      clearTimeout(reloj);

      video.removeEventListener("loadedmetadata", alCargar);
      video.removeEventListener("error", alFallar);

      /* Se suelta la descarga: el metadato ya está leído. */
      video.removeAttribute("src");
      video.load();

      resuelve(ms);
    };

    const alCargar = () =>
      acaba(
        Number.isFinite(video.duration) && video.duration > 0
          ? Math.round(video.duration * 1000)
          : 0,
      );

    const alFallar = () => acaba(0);

    const reloj = setTimeout(() => acaba(0), esperaMs);

    video.addEventListener("loadedmetadata", alCargar);
    video.addEventListener("error", alFallar);

    video.src = src;
  });
}
