/*
|--------------------------------------------------------------------------
| EL INFORME, PIEZA A PIEZA
|--------------------------------------------------------------------------
|
| El informe del rival se pintaba de una vez: una imagen por diapositiva, a
| sangre, y lo que salía del `.pptx` era una foto. Se leía bien y no se podía
| tocar nada — ni mover un panel, ni quitar el equipo que sobra de la tabla, ni
| llevarse una ficha del once a otra hoja.
|
| Aquí se rompe en piezas. Cada bloque del dibujo —la cinta de un panel, una
| fila de la clasificación, una ficha del campo, un rótulo— se pinta en **su
| propio lienzo transparente**, y la hoja pasa a ser un fondo de papel con un
| montón de piezas encima. Eso da las dos cosas que hacían falta:
|
|   · un editor antes de exportar, donde cada pieza se arrastra, se estira, se
|     replica y se borra (`components/rivals/InformePptEditor.tsx`);
|   · un `.pptx` en el que cada pieza es **un objeto propio de PowerPoint**, no
|     un píxel de una captura, así que el cuerpo técnico lo remata en Office
|     sin volver a la app.
|
| El truco para no reescribir el dibujo es `el()`: recibe el mismo pintor de
| siempre —que razona en coordenadas absolutas de la hoja, de 0 a 1920— y le da
| un lienzo trasladado. El código de dentro no se entera de que ya no está
| pintando sobre la diapositiva entera.
|
| Y luego **el recorte**: se escanea el alfa y la pieza se queda con la caja de
| lo que de verdad ha pintado. Por eso quien llama puede declarar cajas
| generosas sin medir al píxel, y por eso una pieza que no pinta nada —el panel
| de un dato que no existe— desaparece sola en vez de quedar como un rectángulo
| invisible que estorba en el editor.
*/

/** El lienzo de la diapositiva: 1920×1080 px son 12192000×6858000 EMU. */
export const LIENZO_W = 1920;
export const LIENZO_H = 1080;

/** A cuánto se multiplican los lienzos. Igual que la portada: 2 llega a 4K. */
export const ESCALA_INFORME = 2;

/**
 * Lo que se le da de más a la caja declarada antes de pintar.
 *
 * Un texto baja un poco de su línea base y una sombra se sale de su rectángulo:
 * sin margen, el recorte cortaría justo eso. Como después se recorta, lo que
 * sobra no se queda en la pieza.
 */
const HOLGURA = 16;

export type CajaInforme = { x: number; y: number; w: number; h: number };

/** Una pieza suelta de una diapositiva. */
export type ElementoInforme = {
  id: string;
  /** Lo que se lee en el panel de selección de PowerPoint y en el editor. */
  nombre: string;
  /** Píxeles sobre el lienzo de 1920×1080. */
  x: number;
  y: number;
  w: number;
  h: number;
  /** `data:image/png;base64,…`, con transparencia. */
  imagen: string;
  /** 0..1. Se toca en el editor; se hornea en la imagen al exportar. */
  opacidad?: number;
  /** Sólo lo que ha creado el usuario en el editor lleva texto rehacible. */
  texto?: TextoElemento;
};

/** Un rótulo escrito a mano en el editor, que se puede volver a escribir. */
export type TextoElemento = {
  contenido: string;
  tamano: number;
  tinta: string;
  peso: 500 | 600 | 700;
  espaciado: number;
  /** Con fondo de chapa detrás, para que se lea sobre una foto. */
  conChapa: boolean;
};

export type HojaInforme = {
  id: string;
  /** El de las propiedades del `.pptx`: "Clasificación". */
  titulo: string;
  /** El papel, a sangre: `data:image/jpeg;base64,…`. */
  fondo: string;
  elementos: ElementoInforme[];
};

/* ------------------------------------------------------------------ */
/*  LIENZO                                                             */
/* ------------------------------------------------------------------ */

export type Ctx2D = CanvasRenderingContext2D;

/** Un lienzo a la escala del documento, con el contexto ya en píxeles de hoja. */
export function lienzoInforme(ancho: number, alto: number) {
  const canvas = document.createElement("canvas");

  canvas.width = Math.max(1, Math.round(ancho * ESCALA_INFORME));
  canvas.height = Math.max(1, Math.round(alto * ESCALA_INFORME));

  const ctx = canvas.getContext("2d");

  if (!ctx) throw new Error("El navegador no ha dado lienzo.");

  ctx.scale(ESCALA_INFORME, ESCALA_INFORME);
  ctx.imageSmoothingQuality = "high";
  ctx.textBaseline = "alphabetic";

  return { canvas, ctx };
}

/**
 * La caja de lo que se ha pintado de verdad, en píxeles del lienzo.
 *
 * `null` cuando no se ha pintado nada: esa pieza no llega a existir.
 */
function cajaPintada(canvas: HTMLCanvasElement) {
  const ctx = canvas.getContext("2d");

  if (!ctx) return null;

  const { width, height } = canvas;

  const datos = ctx.getImageData(0, 0, width, height).data;

  let minX = width;
  let minY = height;
  let maxX = -1;
  let maxY = -1;

  for (let y = 0; y < height; y += 1) {
    const fila = y * width * 4;

    for (let x = 0; x < width; x += 1) {
      /* Un alfa de 6 sobre 255 no se ve en un proyector, y colar esos píxeles
         estiraría la caja hasta el borde por culpa del suavizado. */
      if (datos[fila + x * 4 + 3] > 6) {
        if (x < minX) minX = x;
        if (x > maxX) maxX = x;
        if (y < minY) minY = y;
        if (y > maxY) maxY = y;
      }
    }
  }

  if (maxX < 0) return null;

  return { x: minX, y: minY, w: maxX - minX + 1, h: maxY - minY + 1 };
}

/* ------------------------------------------------------------------ */
/*  EL GUION DE UNA HOJA                                               */
/* ------------------------------------------------------------------ */

/**
 * Va recogiendo las piezas de una diapositiva mientras se pinta.
 *
 * Se usa igual que se usaba el contexto: `g.fondo(...)` para lo que va a
 * sangre y `g.el(nombre, caja, pintor)` para cada pieza. El pintor sigue
 * escribiendo en coordenadas de la hoja entera.
 */
export class GuionHoja {
  readonly titulo: string;

  private readonly fondoCanvas: HTMLCanvasElement;

  private readonly fondoCtx: Ctx2D;

  private readonly piezas: ElementoInforme[] = [];

  private contador = 0;

  constructor(
    titulo: string,
    /** Sale en los ids de las piezas, para que sean únicos en el documento. */
    private readonly prefijo: string,
  ) {
    this.titulo = titulo;

    const { canvas, ctx } = lienzoInforme(LIENZO_W, LIENZO_H);

    this.fondoCanvas = canvas;
    this.fondoCtx = ctx;
  }

  /** Lo que va a sangre y no se mueve: el papel, el azul de la portada. */
  fondo(pinta: (ctx: Ctx2D) => void) {
    this.fondoCtx.save();
    pinta(this.fondoCtx);
    this.fondoCtx.restore();
  }

  /**
   * Una pieza suelta.
   *
   * Devuelve la pieza —o `null` si no pintó nada—, por si quien la crea quiere
   * saber dónde acabó.
   */
  el(nombre: string, caja: CajaInforme, pinta: (ctx: Ctx2D) => void) {
    const x0 = caja.x - HOLGURA;
    const y0 = caja.y - HOLGURA;
    const w0 = Math.max(1, caja.w + HOLGURA * 2);
    const h0 = Math.max(1, caja.h + HOLGURA * 2);

    const { canvas, ctx } = lienzoInforme(w0, h0);

    ctx.save();
    ctx.translate(-x0, -y0);
    pinta(ctx);
    ctx.restore();

    const recorte = cajaPintada(canvas);

    if (!recorte) return null;

    const { canvas: ajustado, ctx: destino } = lienzoInforme(
      recorte.w / ESCALA_INFORME,
      recorte.h / ESCALA_INFORME,
    );

    /* El destino ya está escalado, así que se copia en píxeles de hoja. */
    destino.drawImage(
      canvas,
      recorte.x,
      recorte.y,
      recorte.w,
      recorte.h,
      0,
      0,
      recorte.w / ESCALA_INFORME,
      recorte.h / ESCALA_INFORME,
    );

    this.contador += 1;

    const pieza: ElementoInforme = {
      id: `${this.prefijo}-${this.contador}`,
      nombre,
      x: x0 + recorte.x / ESCALA_INFORME,
      y: y0 + recorte.y / ESCALA_INFORME,
      w: recorte.w / ESCALA_INFORME,
      h: recorte.h / ESCALA_INFORME,
      imagen: ajustado.toDataURL("image/png"),
    };

    this.piezas.push(pieza);

    return pieza;
  }

  /**
   * Una pieza que ya viene pintada, en `data:image/png`.
   *
   * Es para lo que se dibuja fuera —las fichas de plantilla, que las pinta
   * `alineacion-ppt.ts` con el mismo cartón del campograma de día de partido—:
   * ni se repinta ni se recorta, porque la caja ya es la suya.
   */
  imagen(nombre: string, caja: CajaInforme, dataUrl: string) {
    this.contador += 1;

    const pieza: ElementoInforme = {
      id: `${this.prefijo}-${this.contador}`,
      nombre,
      x: caja.x,
      y: caja.y,
      w: caja.w,
      h: caja.h,
      imagen: dataUrl,
    };

    this.piezas.push(pieza);

    return pieza;
  }

  /** La hoja terminada. El fondo va en JPEG: es papel y pesa un tercio. */
  hoja(): HojaInforme {
    return {
      id: this.prefijo,
      titulo: this.titulo,
      fondo: this.fondoCanvas.toDataURL("image/jpeg", 0.92),
      elementos: this.piezas,
    };
  }
}
