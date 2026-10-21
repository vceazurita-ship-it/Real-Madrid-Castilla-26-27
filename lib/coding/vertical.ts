/**
 * CODING · el vídeo vertical, para el móvil del jugador.
 *
 * Todo lo que sale de coding era 16:9, y el vídeo de consignas que ve un
 * jugador en el teléfono se ve en vertical: un 16:9 ahí es una franja con dos
 * bandas negras. Esto es el formato de las redes: el corte entero en el
 * centro, a todo el ancho, y detrás el mismo fotograma ampliado, desenfocado y
 * oscurecido, para que no haya negro y la jugada siga mandando.
 *
 * Se pide con la medida `VERTICAL` en la barra («Móvil vertical»), y la
 * entienden los tres motores: los dos del navegador pintan con
 * `pintaVertical`, y el servidor hace lo mismo con ffmpeg
 * (`split` + `boxblur` + `overlay`).
 */

/** La medida que pide el vertical en la barra: no es un ancho, es un formato. */
export const VERTICAL = -1;

/** 1080 × 1920, el 9:16 que piden WhatsApp y las historias. */
export const MEDIDA_VERTICAL = { ancho: 1080, alto: 1920 } as const;

export function esVertical(medida: number | undefined) {
  return medida === VERTICAL;
}

type Pincel = CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D;

/*
| El fondo se pinta en pequeño y se amplía: el suavizado al estirar ya
| desenfoca, y es mucho más barato que un `filter: blur()` sobre 1080 × 1920
| en cada fotograma de un montaje que va a tiempo real.
*/
let pequeno: OffscreenCanvas | HTMLCanvasElement | null = null;

function lienzoPequeno() {
  if (pequeno) return pequeno;

  pequeno =
    typeof OffscreenCanvas !== "undefined"
      ? new OffscreenCanvas(54, 96)
      : Object.assign(document.createElement("canvas"), { width: 54, height: 96 });

  return pequeno;
}

/**
 * Pinta un fotograma 16:9 dentro de un lienzo vertical.
 *
 * `anchoFuente` y `altoFuente` son los del fotograma: un `VideoFrame` o un
 * `<video>` no los dicen igual, así que los pasa quien llama.
 */
export function pintaVertical(
  pincel: Pincel,
  fuente: CanvasImageSource,
  anchoFuente: number,
  altoFuente: number,
  ancho: number,
  alto: number,
) {
  const fondo = lienzoPequeno();
  const ctx = fondo.getContext("2d") as Pincel | null;

  if (ctx && anchoFuente > 0 && altoFuente > 0) {
    const cubre = Math.max(fondo.width / anchoFuente, fondo.height / altoFuente);
    const w = anchoFuente * cubre;
    const h = altoFuente * cubre;

    ctx.drawImage(fuente, (fondo.width - w) / 2, (fondo.height - h) / 2, w, h);

    pincel.save();
    pincel.imageSmoothingEnabled = true;
    pincel.imageSmoothingQuality = "high";
    pincel.drawImage(fondo, 0, 0, ancho, alto);
    pincel.fillStyle = "rgba(0, 0, 0, 0.45)";
    pincel.fillRect(0, 0, ancho, alto);
    pincel.restore();
  } else {
    pincel.fillStyle = "#000";
    pincel.fillRect(0, 0, ancho, alto);
  }

  /* El corte, a todo el ancho y en el centro. */
  const escala = ancho / Math.max(1, anchoFuente);
  const h = Math.round(altoFuente * escala);

  pincel.drawImage(fuente, 0, Math.round((alto - h) / 2), ancho, h);
}
