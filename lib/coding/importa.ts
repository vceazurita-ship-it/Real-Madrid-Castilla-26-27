/**
 * Subir a la carpeta de partidos el vídeo abierto del ordenador.
 *
 * La pareja de cliente de `app/api/coding/importar`. Va con `XMLHttpRequest` y
 * no con `fetch` por una sola razón, pero de peso: **`fetch` no informa de lo
 * que lleva subido**. Copiar un partido son varios gigas y varios minutos, y
 * una barra quieta durante ese rato no se distingue de un cuelgue —que es
 * justo lo que se quiere evitar aquí—.
 *
 * El fichero se manda en crudo como cuerpo de la petición: el navegador lo lee
 * del disco a trozos y no se carga entero en memoria.
 */

export type VideoImportado = {
  /** Ruta relativa dentro de la carpeta de partidos. */
  ruta: string;
  nombre: string;
  tamano: number;
};

export function llevaVideoALaCarpeta(
  fichero: File,
  onProgreso?: (fraccion: number) => void,
): Promise<VideoImportado> {
  return new Promise((listo, falla) => {
    const peticion = new XMLHttpRequest();

    peticion.open(
      "POST",
      `/api/coding/importar?nombre=${encodeURIComponent(fichero.name)}`,
    );

    peticion.upload.addEventListener("progress", (evento) => {
      if (!evento.lengthComputable || !evento.total) return;

      onProgreso?.(Math.min(1, evento.loaded / evento.total));
    });

    peticion.addEventListener("load", () => {
      let datos: Partial<VideoImportado> & { ok?: boolean; error?: string } = {};

      try {
        datos = JSON.parse(peticion.responseText);
      } catch {
        /* Sin JSON de vuelta queda el código de estado, que ya dice algo. */
      }

      if (peticion.status >= 200 && peticion.status < 300 && datos.ok) {
        listo({
          ruta: String(datos.ruta),
          nombre: String(datos.nombre),
          tamano: Number(datos.tamano) || fichero.size,
        });

        return;
      }

      falla(
        new Error(datos.error ?? `El servidor respondió ${peticion.status}`),
      );
    });

    peticion.addEventListener("error", () => {
      falla(new Error("Se ha cortado la copia del vídeo."));
    });

    peticion.addEventListener("abort", () => {
      falla(new Error("Copia cancelada."));
    });

    peticion.setRequestHeader("Content-Type", "application/octet-stream");
    peticion.send(fichero);
  });
}

/** El `src` con el que se reproduce un vídeo ya de la carpeta. */
export function srcDeCarpeta(ruta: string) {
  return `/api/coding/video?ruta=${encodeURIComponent(ruta)}`;
}
