/*
|--------------------------------------------------------------------------
| ZONA DE INFLUENCIA POR POSICIÓN
|--------------------------------------------------------------------------
|
| Las manchas del mapa de calor y su degradado, sin nada de dibujo: los pinta
| `components/rivals/PositionHeatmap.tsx` en SVG para la pantalla y
| `lib/rivals/once-pdf.ts` con jsPDF para el PDF del once. Vivían dentro del
| componente, pero el PDF pide la misma zona para el mismo jugador —si un día
| se retoca dónde se espera a un carrilero, no puede quedar retocada sólo en
| una de las dos—, así que el dato está aquí y el dibujo en cada sitio.
|
| No hay datos de seguimiento de los rivales: la zona **no** se mide, se deduce
| de la posición de la ficha. Es dónde se le espera, no dónde estuvo, y los dos
| dibujos lo advierten al pie.
|
| El campo va en vertical y el jugador ataca hacia arriba: y=0 es la portería
| rival y y=1 la propia.
*/

/** Mancha de calor en coordenadas relativas al campo. */
export type HeatBlob = {
  x: number;
  y: number;
  /** Radios, también relativos: el campo es más alto que ancho. */
  rx: number;
  ry: number;
  /** Cuánto pesa esta mancha (0-1). */
  w: number;
};

const FLANK = 0.155;

/*
| Zonas por slot de posición. Las claves son las de `LINE_DEFINITIONS` en
| `app/rivals/page.tsx`; el orden de las manchas no importa porque se suman.
|
| Las manchas se **solapan a propósito**: con radios cortos el resultado eran
| tres burbujas sueltas en vez de un pasillo. La regla es que el radio pase de
| la mitad de la distancia a la mancha vecina.
*/
const ZONES: Record<string, HeatBlob[]> = {
  por: [
    { x: 0.5, y: 0.94, rx: 0.3, ry: 0.1, w: 1 },
    { x: 0.5, y: 0.85, rx: 0.4, ry: 0.11, w: 0.5 },
  ],

  ld: [
    { x: 1 - FLANK, y: 0.79, rx: 0.28, ry: 0.15, w: 1 },
    { x: 1 - FLANK, y: 0.62, rx: 0.27, ry: 0.15, w: 0.78 },
    { x: 1 - FLANK, y: 0.45, rx: 0.26, ry: 0.15, w: 0.5 },
    { x: 0.62, y: 0.85, rx: 0.24, ry: 0.12, w: 0.35 },
  ],

  li: [
    { x: FLANK, y: 0.79, rx: 0.28, ry: 0.15, w: 1 },
    { x: FLANK, y: 0.62, rx: 0.27, ry: 0.15, w: 0.78 },
    { x: FLANK, y: 0.45, rx: 0.26, ry: 0.15, w: 0.5 },
    { x: 0.38, y: 0.85, rx: 0.24, ry: 0.12, w: 0.35 },
  ],

  dfc: [
    { x: 0.36, y: 0.83, rx: 0.3, ry: 0.14, w: 1 },
    { x: 0.64, y: 0.83, rx: 0.3, ry: 0.14, w: 1 },
    { x: 0.5, y: 0.71, rx: 0.34, ry: 0.13, w: 0.6 },
    { x: 0.5, y: 0.93, rx: 0.3, ry: 0.1, w: 0.45 },
  ],

  def: [
    { x: 0.5, y: 0.83, rx: 0.44, ry: 0.16, w: 1 },
    { x: 0.5, y: 0.68, rx: 0.4, ry: 0.14, w: 0.55 },
  ],

  car: [
    { x: 1 - FLANK, y: 0.7, rx: 0.28, ry: 0.18, w: 1 },
    { x: 1 - FLANK, y: 0.48, rx: 0.27, ry: 0.16, w: 0.65 },
    { x: 1 - FLANK, y: 0.87, rx: 0.27, ry: 0.13, w: 0.6 },
  ],

  mcd: [
    { x: 0.5, y: 0.66, rx: 0.34, ry: 0.15, w: 1 },
    { x: 0.32, y: 0.73, rx: 0.27, ry: 0.14, w: 0.6 },
    { x: 0.68, y: 0.73, rx: 0.27, ry: 0.14, w: 0.6 },
    { x: 0.5, y: 0.53, rx: 0.3, ry: 0.14, w: 0.5 },
  ],

  mc: [
    { x: 0.5, y: 0.52, rx: 0.35, ry: 0.17, w: 1 },
    { x: 0.3, y: 0.59, rx: 0.28, ry: 0.15, w: 0.6 },
    { x: 0.7, y: 0.59, rx: 0.28, ry: 0.15, w: 0.6 },
    { x: 0.5, y: 0.38, rx: 0.3, ry: 0.14, w: 0.55 },
  ],

  /* "MEDIO" a secas: lo mismo que un mediocentro, pero más repartido — la
     hoja lo usa cuando no consta si es de contención o de creación. */
  med: [
    { x: 0.5, y: 0.54, rx: 0.4, ry: 0.2, w: 1 },
    { x: 0.28, y: 0.6, rx: 0.28, ry: 0.16, w: 0.55 },
    { x: 0.72, y: 0.6, rx: 0.28, ry: 0.16, w: 0.55 },
  ],

  int: [
    { x: 0.31, y: 0.47, rx: 0.3, ry: 0.18, w: 1 },
    { x: 0.69, y: 0.47, rx: 0.3, ry: 0.18, w: 1 },
    { x: 0.5, y: 0.58, rx: 0.3, ry: 0.14, w: 0.45 },
    { x: 0.5, y: 0.34, rx: 0.28, ry: 0.13, w: 0.4 },
  ],

  mp: [
    { x: 0.5, y: 0.34, rx: 0.33, ry: 0.16, w: 1 },
    { x: 0.32, y: 0.41, rx: 0.27, ry: 0.14, w: 0.55 },
    { x: 0.68, y: 0.41, rx: 0.27, ry: 0.14, w: 0.55 },
    { x: 0.5, y: 0.21, rx: 0.28, ry: 0.13, w: 0.5 },
  ],

  ed: [
    { x: 1 - FLANK, y: 0.3, rx: 0.27, ry: 0.17, w: 1 },
    { x: 1 - FLANK, y: 0.48, rx: 0.26, ry: 0.16, w: 0.65 },
    { x: 0.64, y: 0.16, rx: 0.26, ry: 0.13, w: 0.55 },
  ],

  ei: [
    { x: FLANK, y: 0.3, rx: 0.27, ry: 0.17, w: 1 },
    { x: FLANK, y: 0.48, rx: 0.26, ry: 0.16, w: 0.65 },
    { x: 0.36, y: 0.16, rx: 0.26, ry: 0.13, w: 0.55 },
  ],

  ext: [
    { x: FLANK, y: 0.31, rx: 0.27, ry: 0.18, w: 1 },
    { x: 1 - FLANK, y: 0.31, rx: 0.27, ry: 0.18, w: 1 },
    { x: 0.5, y: 0.18, rx: 0.3, ry: 0.13, w: 0.4 },
  ],

  sd: [
    { x: 0.5, y: 0.2, rx: 0.32, ry: 0.15, w: 1 },
    { x: 0.34, y: 0.29, rx: 0.27, ry: 0.14, w: 0.6 },
    { x: 0.66, y: 0.29, rx: 0.27, ry: 0.14, w: 0.6 },
  ],

  dc: [
    { x: 0.5, y: 0.11, rx: 0.32, ry: 0.13, w: 1 },
    { x: 0.5, y: 0.23, rx: 0.34, ry: 0.14, w: 0.75 },
    { x: 0.3, y: 0.18, rx: 0.25, ry: 0.13, w: 0.45 },
    { x: 0.7, y: 0.18, rx: 0.25, ry: 0.13, w: 0.45 },
  ],
};

/** Sin posición reconocible: una mancha ancha en el centro, sin inventar. */
const FALLBACK: HeatBlob[] = [{ x: 0.5, y: 0.55, rx: 0.42, ry: 0.22, w: 0.8 }];

/*
| Slots que existen en las dos bandas. Cuando la posición de la hoja dice
| "central derecho" o "extremo izquierdo" y el slot no lo distingue, la mancha
| se corre hacia esa banda en lugar de quedarse simétrica.
*/
const SIDED = new Set([
  "dfc",
  "def",
  "car",
  "mc",
  "med",
  "int",
  "mp",
  "ext",
  "sd",
  "dc",
]);

function applySide(blobs: HeatBlob[], slot: string, side: -1 | 0 | 1) {
  if (!side || !SIDED.has(slot)) return blobs;

  /* La banda contraria se apaga y el conjunto se desplaza hacia la suya. */
  return blobs
    .map((blob) => {
      const offset = (blob.x - 0.5) * side;

      return {
        ...blob,
        x: Math.min(0.9, Math.max(0.1, blob.x + 0.13 * side)),
        w: offset < -0.05 ? blob.w * 0.3 : blob.w,
      };
    })
    .filter((blob) => blob.w > 0.05);
}

/** Manchas de un jugador: su slot, corrido hacia la banda que le toca. */
export function heatBlobs(
  slot: string | null,
  side: -1 | 0 | 1 = 0,
): HeatBlob[] {
  return applySide((slot && ZONES[slot]) || FALLBACK, slot ?? "", side);
}

/*
| Paradas del degradado radial, del centro de la mancha hacia fuera. En SVG es
| un `radialGradient`; en el PDF se muestrean para pintar anillos, porque ahí
| no hay degradados que se puedan mezclar en pantalla.
*/
export const HEAT_STOPS: { offset: number; color: string; opacity: number }[] = [
  { offset: 0, color: "#FF2D00", opacity: 0.92 },
  { offset: 0.32, color: "#FF7A00", opacity: 0.66 },
  { offset: 0.58, color: "#F2D218", opacity: 0.4 },
  { offset: 0.8, color: "#5BE37A", opacity: 0.16 },
  { offset: 1, color: "#2BC4E8", opacity: 0 },
];

/** Verde del césped del mapa, de arriba abajo. */
export const HEAT_GRASS = { borde: "#123528", centro: "#16402f" };
