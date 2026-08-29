"use client";

/**
 * Las imágenes de una exportación no viajan dentro de la petición.
 *
 * La carátula del vídeo unificado y cada pizarra quemada son fotogramas a la
 * resolución del partido. Metidas en el JSON de `/api/coding/export` —que es
 * como iban— la exportación se estrella contra el techo del despliegue: el
 * cuerpo de una petición no puede pasar de **4,5 MB** en una función, no hay
 * ajuste que lo suba, y lo que se veía era un **413** seco antes de que la
 * aplicación llegara a mirar nada. Con una carátula de 3840×2160 en PNG
 * bastaba: ella sola pasaba del techo, y por eso fallaba también sin una sola
 * pizarra.
 *
 * Aquí cada imagen sube **suelta** por `/api/coding/imagenes` —unos cientos de
 * kilobytes cada una— y a la exportación sólo le viaja el enlace. El cuerpo
 * deja de crecer con el número de pizarras, que era el problema de fondo.
 *
 * Si la subida falla —sin bucket, sin red— la imagen se queda en el cuerpo
 * como antes: en la máquina del analista eso funciona perfectamente, y así un
 * bucket caído no deja al cuerpo técnico sin cortar el partido. Lo que ya no
 * puede pasar es un 413 sin explicación: `pesaDemasiado` lo dice antes de
 * salir.
 */

/** Lo que el servidor sabe quemar dentro de un clip. */
export type ParadaConImagen = {
  imagen: string;
  enMs: number;
  duracionMs: number;
};

/*
| El techo real es 4,5 MB. Se avisa antes para no jugársela con las cabeceras
| ni con el crecimiento del `JSON.stringify`.
*/
const TOPE_CUERPO = 4 * 1024 * 1024;

/** De `data:` URL a bytes, sin pasar por `fetch` ni por `atob` a mano. */
function bytesDeDataUrl(dataUrl: string) {
  const coma = dataUrl.indexOf(",");

  if (!dataUrl.startsWith("data:") || coma < 0) return null;

  const cabecera = dataUrl.slice(5, coma);

  if (!cabecera.includes("base64")) return null;

  const tipo = cabecera.split(";")[0].trim().toLowerCase() || "image/png";

  const crudo = atob(dataUrl.slice(coma + 1));

  const bytes = new Uint8Array(crudo.length);

  for (let i = 0; i < crudo.length; i += 1) bytes[i] = crudo.charCodeAt(i);

  return { bytes, tipo };
}

/**
 * Sube una imagen y devuelve su enlace, o `null` si no se ha podido.
 *
 * No lanza: quien llama tiene un plan B —dejarla en el cuerpo— y una carátula
 * que no sube no puede tumbar una exportación de media hora.
 */
async function sube(dataUrl: string) {
  const trozo = bytesDeDataUrl(dataUrl);

  if (!trozo) return null;

  try {
    const respuesta = await fetch("/api/coding/imagenes", {
      method: "POST",
      headers: { "Content-Type": trozo.tipo },
      body: new Blob([trozo.bytes as BlobPart], { type: trozo.tipo }),
    });

    if (!respuesta.ok) return null;

    const datos = (await respuesta.json()) as {
      ok?: boolean;
      url?: string;
      ruta?: string;
    };

    return datos.ok && datos.url && datos.ruta
      ? { url: datos.url, ruta: datos.ruta }
      : null;
  } catch (error) {
    console.warn("[coding] no se ha podido subir la imagen", error);

    return null;
  }
}

export type ImagenesDeExport = {
  /** La carátula, ya como enlace del bucket (o su `data:` URL de respaldo). */
  portada?: string;
  paradas: Map<string, ParadaConImagen[]>;
  /** Lo subido, para borrarlo al terminar. */
  rutas: string[];
  /** Lo que se ha quedado dentro del cuerpo, en bytes. */
  peso: number;
};

/**
 * Deja la carátula y las pizarras listas para la petición de exportación.
 *
 * `onProgreso` es para el aviso de pantalla: subir treinta fotogramas no es
 * instantáneo y un aviso quieto no se distingue de uno colgado.
 */
export async function preparaImagenes(opciones: {
  portada?: string | null;
  paradas?: Map<string, ParadaConImagen[]> | null;
  onProgreso?: (hechas: number, total: number) => void;
}): Promise<ImagenesDeExport> {
  const { portada, paradas, onProgreso } = opciones;

  const total =
    (portada ? 1 : 0) +
    [...(paradas?.values() ?? [])].reduce((suma, lista) => suma + lista.length, 0);

  const rutas: string[] = [];

  let hechas = 0;
  let peso = 0;

  const resuelve = async (imagen: string) => {
    const subida = await sube(imagen);

    hechas += 1;
    onProgreso?.(hechas, total);

    if (subida) {
      rutas.push(subida.ruta);

      return subida.url;
    }

    peso += imagen.length;

    return imagen;
  };

  const portadaLista = portada ? await resuelve(portada) : undefined;

  const paradasListas = new Map<string, ParadaConImagen[]>();

  for (const [clip, lista] of paradas ?? []) {
    const preparadas: ParadaConImagen[] = [];

    for (const parada of lista) {
      preparadas.push({ ...parada, imagen: await resuelve(parada.imagen) });
    }

    paradasListas.set(clip, preparadas);
  }

  return { portada: portadaLista, paradas: paradasListas, rutas, peso };
}

/** Las imágenes de usar y tirar, fuera del bucket. No lanza. */
export async function borraImagenes(rutas: string[]) {
  if (rutas.length === 0) return;

  try {
    await fetch("/api/coding/imagenes", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ rutas }),
    });
  } catch (error) {
    console.warn("[coding] no se han podido borrar las imágenes", error);
  }
}

/**
 * ¿El cuerpo de la petición cabe? Devuelve el aviso, o `null` si cabe.
 *
 * Es la red de seguridad del plan B: si las imágenes no han podido subir y se
 * han quedado dentro, el analista tiene que enterarse **aquí**, con lo que
 * pesa y qué hacer, y no con un 413 del despliegue que no dice nada.
 */
export function pesaDemasiado(cuerpo: string) {
  const bytes = new Blob([cuerpo]).size;

  if (bytes <= TOPE_CUERPO) return null;

  return (
    `La petición pesa ${(bytes / 1024 ** 2).toFixed(1)} MB y el servidor no ` +
    "acepta más de 4,5 MB. No se han podido subir las imágenes (carátula y " +
    "pizarras) por separado: revisa la conexión y vuelve a intentarlo, o " +
    "exporta sin quemar las pizarras."
  );
}
