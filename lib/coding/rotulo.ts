/**
 * CODING · el rótulo de cada corte.
 *
 * Un vídeo de veinte cortes pasado en la sala no dice de quién es cada uno ni
 * por qué está ahí: el analista lo cuenta de palabra o se pierde. En la
 * televisión eso lo resuelve el «tercio inferior»: al empezar cada jugada sale
 * un rótulo con el nombre y lo que se va a ver, y se va solo. Esto es eso.
 *
 * - **Qué dice**: el sujeto con su dorsal («9 · MESTRE») y debajo la
 *   categoría, los descriptores y el minuto del vídeo. Lo que no está, no se
 *   nombra: un corte sin categoría ni descriptores sólo lleva el minuto.
 * - **Cuánto dura**: los primeros 3,5 s del corte, entrando y saliendo con un
 *   fundido corto. Más largo tapa la jugada; más corto no da para leerlo.
 * - **Dónde**: abajo a la izquierda, en el hueco donde las retransmisiones
 *   ponen el suyo, con el ancho medido sobre el texto.
 *
 * El dibujo es uno solo para los dos motores del navegador (`rapido.ts` y
 * `navegador.ts`), así que el rótulo sale igual se monte por donde se monte.
 * El servidor lo pinta con `drawtext` de ffmpeg y la misma letra.
 */

/*
| Sólo tipos de `modelo`: este módulo lo cargan los motores del montaje, y
| `modelo` arrastra la telestración entera.
*/
import type { CategoriaCoding, ClipCoding } from "@/lib/coding/modelo";

export type RotuloClip = {
  /** «9 · MESTRE», en mayúsculas al pintarlo. */
  titulo: string;
  /** «Recuperación · Bien · min 12:04». */
  detalle: string;
  /** El color de la categoría, para la raya de la izquierda. */
  color: string;
};

/** Lo que se queda en pantalla al empezar cada corte. */
export const ROTULO_MS = 3500;

const FUNDIDO_MS = 280;

/** El minuto del vídeo, sin milisegundos: «12:04» o «1:02:10». */
function minutoDeVideo(ms: number) {
  const total = Math.max(0, Math.floor(ms / 1000));
  const horas = Math.floor(total / 3600);
  const minutos = Math.floor((total % 3600) / 60);
  const segundos = total % 60;
  const dos = (valor: number) => String(valor).padStart(2, "0");

  return horas > 0
    ? `${horas}:${dos(minutos)}:${dos(segundos)}`
    : `${dos(minutos)}:${dos(segundos)}`;
}

export function rotuloDeClip(
  clip: ClipCoding,
  categorias: CategoriaCoding[],
): RotuloClip {
  const categoria = categorias.find((una) => una.id === clip.categoriaId);

  const titulo = [
    typeof clip.jugadorDorsal === "number" ? String(clip.jugadorDorsal) : "",
    clip.jugadorNombre.trim(),
  ]
    .filter(Boolean)
    .join(" · ");

  const detalle = [
    categoria?.nombre ?? "",
    ...clip.tags.map((tag) => tag.trim()).filter(Boolean),
    `min ${minutoDeVideo(clip.codingInicioMs)}`,
  ]
    .filter(Boolean)
    .join(" · ");

  return {
    titulo,
    detalle,
    color: categoria?.color ?? "#C8A96B",
  };
}

/**
 * Cuánto se ve el rótulo en el milisegundo `t` del corte: de 0 a 1.
 *
 * Sube y baja en `FUNDIDO_MS`; fuera de sus 3,5 s, cero.
 */
export function opacidadRotulo(tMs: number) {
  if (tMs < 0 || tMs > ROTULO_MS) return 0;

  return Math.min(1, tMs / FUNDIDO_MS, (ROTULO_MS - tMs) / FUNDIDO_MS);
}

type Pincel = CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D;

/** Corta el texto con «…» hasta que quepa en `ancho`. */
function cabe(pincel: Pincel, texto: string, ancho: number) {
  if (pincel.measureText(texto).width <= ancho) return texto;

  let corto = texto;

  while (corto.length > 1 && pincel.measureText(`${corto}…`).width > ancho) {
    corto = corto.slice(0, -1);
  }

  return `${corto.trimEnd()}…`;
}

/**
 * Pinta el rótulo encima de lo que ya hay en el lienzo.
 *
 * Todas las medidas salen del alto del vídeo, así que en 720p y en 4K ocupa
 * lo mismo de la imagen. `familia` es la de `ctx.font` (`FAMILIA_PORTADA`):
 * el motor no puede importar `next/font`.
 */
export function pintaRotulo(
  pincel: Pincel,
  ancho: number,
  alto: number,
  rotulo: RotuloClip,
  tMs: number,
  familia: string,
) {
  const alfa = opacidadRotulo(tMs);

  if (alfa <= 0) return;

  const u = alto / 100;

  const margen = Math.round(4.2 * u);
  const raya = Math.max(3, Math.round(0.7 * u));
  const relleno = Math.round(1.6 * u);
  const altoTitulo = Math.round(5.2 * u);
  const altoDetalle = Math.round(2.9 * u);
  const maximo = ancho * 0.62;

  pincel.save();

  pincel.globalAlpha = alfa;

  /* Entra deslizando un poco desde la izquierda: se nota que es un rótulo. */
  const entrada = (1 - Math.min(1, tMs / FUNDIDO_MS)) * 2 * u;

  pincel.font = `700 ${altoTitulo}px ${familia}`;
  const titulo = cabe(pincel, rotulo.titulo.toUpperCase(), maximo);
  const anchoTitulo = pincel.measureText(titulo).width;

  pincel.font = `500 ${altoDetalle}px ${familia}`;
  const detalle = rotulo.detalle ? cabe(pincel, rotulo.detalle, maximo) : "";
  const anchoDetalle = detalle ? pincel.measureText(detalle).width : 0;

  const anchoCaja = Math.round(
    raya + relleno * 2 + Math.max(anchoTitulo, anchoDetalle),
  );
  const altoCaja = Math.round(
    relleno * 2 + altoTitulo + (detalle ? altoDetalle + 0.6 * u : 0),
  );

  const x = Math.round(margen - entrada);
  const y = Math.round(alto - margen - altoCaja);

  pincel.fillStyle = "rgba(11, 15, 20, 0.82)";
  pincel.fillRect(x, y, anchoCaja, altoCaja);

  pincel.fillStyle = rotulo.color;
  pincel.fillRect(x, y, raya, altoCaja);

  pincel.textBaseline = "top";

  pincel.fillStyle = "#FFFFFF";
  pincel.font = `700 ${altoTitulo}px ${familia}`;
  pincel.fillText(titulo, x + raya + relleno, y + relleno - 0.2 * u);

  if (detalle) {
    pincel.fillStyle = "#C8A96B";
    pincel.font = `500 ${altoDetalle}px ${familia}`;
    pincel.fillText(
      detalle,
      x + raya + relleno,
      y + relleno + altoTitulo + 0.4 * u,
    );
  }

  pincel.restore();
}
