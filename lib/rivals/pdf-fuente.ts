/*
|--------------------------------------------------------------------------
| BARLOW CONDENSED DENTRO DEL PDF
|--------------------------------------------------------------------------
|
| Los documentos del club se escriben en **Barlow Condensed**: es la letra de
| `public/INDIVIDUAL.pptx`, la plantilla de la que salen los análisis, y por
| tanto la que se reconoce proyectada en la sala. Los PDF que monta jsPDF
| salían en Helvetica, que es lo único que trae de serie, y al lado de una
| diapositiva del club cantaban como de otra casa.
|
| jsPDF sí sabe incrustar una fuente, pero necesita el TTF entero en base64.
| Meterlo en el código serían ~400 KB de JavaScript en cada carga de la app
| para algo que sólo hace falta al pulsar «Exportar», así que los tres pesos
| viven en `public/fuentes/` y se van a buscar cuando toca. Se quedan
| guardados en memoria, así que exportar dos veces seguidas sólo paga la
| descarga la primera; y como la app es una PWA, el service worker se los
| queda en el móvil.
|
| **No es obligatoria.** Si la descarga falla —sin cobertura, con la caché
| vacía— el documento sale en Helvetica y no pasa nada más: `registraBarlow`
| devuelve la familia que se ha podido poner y quien pinta usa esa.
*/

/** Lo que entiende `doc.setFont(familia, estilo)`. */
export const FAMILIA_BARLOW = "BarlowCondensed";
export const FAMILIA_RESPALDO = "helvetica";

/**
 * Los tres pesos de la plantilla, con el nombre de estilo que les toca en
 * jsPDF.
 *
 * El 500 hace de redonda: en una condensada a 7 pt, la Regular sobre papel se
 * queda en un gris que no se lee de un vistazo. El 600 es el de las chapas y
 * el 700 el de los titulares, igual que en el pptx.
 */
const PESOS = [
  { estilo: "normal", archivo: "BarlowCondensed-Medium.ttf" },
  { estilo: "semibold", archivo: "BarlowCondensed-SemiBold.ttf" },
  { estilo: "bold", archivo: "BarlowCondensed-Bold.ttf" },
] as const;

/** Base64 ya resuelto, por archivo. Se comparte entre exportaciones. */
const cache = new Map<string, string>();

/** Descarga en vuelo, para que dos exportaciones a la vez no pidan dos veces. */
let enVuelo: Promise<boolean> | null = null;

function aBase64(buffer: ArrayBuffer) {
  const bytes = new Uint8Array(buffer);

  /* En trozos: `String.fromCharCode(...bytes)` con cien mil argumentos revienta
     la pila de llamadas en Safari y en Chrome de móvil. */
  let binario = "";

  for (let i = 0; i < bytes.length; i += 8192) {
    binario += String.fromCharCode(...bytes.subarray(i, i + 8192));
  }

  return btoa(binario);
}

async function descarga(): Promise<boolean> {
  try {
    await Promise.all(
      PESOS.map(async ({ archivo }) => {
        if (cache.has(archivo)) return;

        const res = await fetch(`/fuentes/${archivo}`);
        if (!res.ok) throw new Error(`${archivo}: ${res.status}`);

        cache.set(archivo, aBase64(await res.arrayBuffer()));
      }),
    );

    return true;
  } catch (error) {
    console.warn("[pdf] no se ha podido cargar Barlow Condensed", error);
    return false;
  }
}

/**
 * Mete Barlow Condensed en el documento y devuelve la familia que hay que usar.
 *
 * Devuelve `"helvetica"` si no se ha podido: quien pinta no tiene que
 * comprobar nada, sólo guardarse lo que le den y pasárselo a `setFont`.
 */
export async function registraBarlow(doc: {
  addFileToVFS: (nombre: string, datos: string) => void;
  addFont: (archivo: string, familia: string, estilo: string) => string;
}): Promise<string> {
  if (typeof fetch === "undefined") return FAMILIA_RESPALDO;

  enVuelo = enVuelo ?? descarga();

  const ok = await enVuelo;

  /* La promesa se guarda sólo mientras vuela: si falló, el siguiente intento
     vuelve a probar (puede haber vuelto la cobertura). */
  if (!ok) {
    enVuelo = null;
    return FAMILIA_RESPALDO;
  }

  PESOS.forEach(({ estilo, archivo }) => {
    const datos = cache.get(archivo);
    if (!datos) return;

    doc.addFileToVFS(archivo, datos);
    doc.addFont(archivo, FAMILIA_BARLOW, estilo);
  });

  return FAMILIA_BARLOW;
}
