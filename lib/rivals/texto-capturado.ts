/*
|--------------------------------------------------------------------------
| LOS TEXTOS DEL INFORME, APUNTADOS MIENTRAS SE PINTAN
|--------------------------------------------------------------------------
|
| El informe se dibuja en lienzo, y hasta el 16/09/2026 lo que salía al
| `.pptx` eran imágenes: cada pieza, su PNG. Se movía y se borraba, pero **no
| se podía corregir ni una palabra** —una errata, un apodo, «TEMPORADA 26/27»
| mal puesto: había que volver a la app y rehacer el informe entero—.
|
| Para que el texto sea texto de verdad en PowerPoint hay que saber qué se ha
| escrito, dónde y con qué letra. Y eso ya lo sabe quien lo pinta: **todo el
| texto del informe pasa por dos sitios**, `escribe()` de `informe-ppt.ts` y
| `chapa()` de `lienzo-club.ts`. Así que en vez de tocar los noventa y tantos
| sitios que escriben algo, los dos de paso lo apuntan aquí.
|
| Cada pieza se pinta entonces **dos veces**:
|
|   1. con la grabadora abierta, para quedarse con la lista de textos;
|   2. con el texto apagado, y ése es el PNG que va al `.pptx` —el marco, la
|      cinta, las barras… todo menos las letras—.
|
| Encima van las cajas de texto de verdad. Una pieza que sólo era un rótulo
| deja de tener imagen: es sólo texto, y se escribe en Office como cualquier
| otro. La cuenta la lleva `GuionHoja` en `informe-elementos.ts`.
*/

/** Un texto tal y como se ha pintado, en píxeles de la hoja de 1920×1080. */
export type TextoPintado = {
  contenido: string;
  /** Borde izquierdo ya resuelto: la alineación se aplicó antes. */
  x: number;
  /** Línea base, que es donde apoya el lienzo. */
  y: number;
  /** Lo que mide de ancho con su espaciado. */
  ancho: number;
  /** Lo que sube sobre la línea base (alto de mayúscula, casi siempre). */
  subida: number;
  /** Lo que baja de la línea base. */
  bajada: number;
  tamano: number;
  peso: 500 | 600 | 700;
  tinta: string;
  espaciado: number;
};

let apuntados: TextoPintado[] | null = null;

let apagado = false;

/**
 * Pinta apuntando lo que se escriba.
 *
 * Devuelve los textos en el orden en que se pintaron, que es el de apilado.
 */
export function capturaTextos(pinta: () => void): TextoPintado[] {
  const anteriores = apuntados;

  apuntados = [];

  try {
    pinta();

    return apuntados;
  } finally {
    apuntados = anteriores;
  }
}

/**
 * Pinta sin letras.
 *
 * Lo demás —formas, imágenes, barras— se pinta igual, y las medidas siguen
 * saliendo: quien escribe un texto suele colocar lo siguiente a partir de lo
 * que ha medido, así que apagar el pintado no puede cambiar la maqueta.
 */
export function sinTexto<T>(pinta: () => T): T {
  const antes = apagado;

  apagado = true;

  try {
    return pinta();
  } finally {
    apagado = antes;
  }
}

/** `true` mientras se está pintando la pasada sin letras. */
export function elTextoEstaApagado() {
  return apagado;
}

/** Lo llaman `escribe()` y `chapa()`, que es por donde pasa todo el texto. */
export function apuntaTexto(texto: TextoPintado) {
  if (!apuntados) return;

  /* Un texto vacío no es una caja de texto, es nada. */
  if (!texto.contenido.trim()) return;

  apuntados.push(texto);
}
