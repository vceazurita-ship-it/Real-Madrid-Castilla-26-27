/**
 * UN GIF ANIMADO SIN LIBRERÍAS (laboratorio de ABP, 24/10/2026).
 *
 * Para mandar la jugada por WhatsApp o pegarla en una presentación sin
 * reproductor. GIF89a con una sola paleta para toda la animación:
 * - la paleta sale de los colores más repetidos de unos cuantos fotogramas
 *   (a 5 bits por canal), que en una pizarra —césped, líneas, fichas— cubre
 *   casi todo con 255 colores;
 * - cada píxel va al color más cercano, con caché;
 * - cada fotograma se comprime con LZW, como manda el formato.
 */

type Rgba = Uint8ClampedArray;

/** La paleta común: los 255 colores más frecuentes de las muestras (y un índice libre). */
export function paletaDe(muestras: Rgba[]) {
  const cuenta = new Map<number, number>();

  for (const datos of muestras) {
    for (let i = 0; i < datos.length; i += 4 * 3) {
      const clave = ((datos[i] >> 3) << 10) | ((datos[i + 1] >> 3) << 5) | (datos[i + 2] >> 3);

      cuenta.set(clave, (cuenta.get(clave) ?? 0) + 1);
    }
  }

  const elegidos = [...cuenta.entries()].sort((a, b) => b[1] - a[1]).slice(0, 255);

  const paleta = new Uint8Array(256 * 3);

  const colores: [number, number, number][] = elegidos.map(([clave]) => [((clave >> 10) & 31) * 8 + 4, ((clave >> 5) & 31) * 8 + 4, (clave & 31) * 8 + 4]);

  colores.forEach(([r, g, b], i) => {
    paleta[i * 3] = r;
    paleta[i * 3 + 1] = g;
    paleta[i * 3 + 2] = b;
  });

  const cache = new Map<number, number>();

  const indice = (r: number, g: number, b: number) => {
    const clave = ((r >> 3) << 10) | ((g >> 3) << 5) | (b >> 3);

    const visto = cache.get(clave);

    if (visto !== undefined) return visto;

    let mejor = 0;

    let distancia = Infinity;

    for (let i = 0; i < colores.length; i++) {
      const [cr, cg, cb] = colores[i];

      const d = (cr - r) ** 2 * 2 + (cg - g) ** 2 * 4 + (cb - b) ** 2 * 3;

      if (d < distancia) {
        distancia = d;
        mejor = i;
      }
    }

    cache.set(clave, mejor);

    return mejor;
  };

  return { paleta, indice };
}

/** Pasa un fotograma RGBA a índices de la paleta. */
export function indexa(datos: Rgba, indice: (r: number, g: number, b: number) => number) {
  const salida = new Uint8Array(datos.length / 4);

  for (let i = 0, j = 0; i < datos.length; i += 4, j++) salida[j] = indice(datos[i], datos[i + 1], datos[i + 2]);

  return salida;
}

class Bytes {
  private trozos: Uint8Array[] = [];

  private actual = new Uint8Array(65536);

  private n = 0;

  byte(b: number) {
    if (this.n === this.actual.length) {
      this.trozos.push(this.actual);
      this.actual = new Uint8Array(65536);
      this.n = 0;
    }

    this.actual[this.n++] = b & 255;
  }

  bytes(lista: ArrayLike<number>) {
    for (let i = 0; i < lista.length; i++) this.byte(lista[i]);
  }

  corto(v: number) {
    this.byte(v & 255);
    this.byte((v >> 8) & 255);
  }

  texto(s: string) {
    for (let i = 0; i < s.length; i++) this.byte(s.charCodeAt(i));
  }

  blob() {
    const partes = [...this.trozos, this.actual.slice(0, this.n)];

    return new Blob(partes.map((p) => p.slice().buffer as ArrayBuffer), { type: "image/gif" });
  }
}

/** LZW de GIF con códigos de 8 bits de partida. */
function lzw(indices: Uint8Array, salida: Bytes) {
  const minimo = 8;

  const limpiar = 1 << minimo;

  const fin = limpiar + 1;

  salida.byte(minimo);

  let bloque: number[] = [];

  let acumulado = 0;

  let bits = 0;

  let ancho = minimo + 1;

  let siguiente = fin + 1;

  let tabla = new Map<number, number>();

  const emite = (codigo: number) => {
    acumulado |= codigo << bits;
    bits += ancho;

    while (bits >= 8) {
      bloque.push(acumulado & 255);
      acumulado >>>= 8;
      bits -= 8;

      if (bloque.length === 255) {
        salida.byte(255);
        salida.bytes(bloque);
        bloque = [];
      }
    }
  };

  emite(limpiar);

  let prefijo = indices[0];

  for (let i = 1; i < indices.length; i++) {
    const k = indices[i];

    const clave = (prefijo << 8) | k;

    const existe = tabla.get(clave);

    if (existe !== undefined) {
      prefijo = existe;

      continue;
    }

    emite(prefijo);

    if (siguiente < 4096) {
      tabla.set(clave, siguiente++);

      if (siguiente > 1 << ancho && ancho < 12) ancho++;
    } else {
      emite(limpiar);
      tabla = new Map();
      siguiente = fin + 1;
      ancho = minimo + 1;
    }

    prefijo = k;
  }

  emite(prefijo);
  emite(fin);

  if (bits > 0) bloque.push(acumulado & 255);

  for (let i = 0; i < bloque.length; i += 255) {
    const trozo = bloque.slice(i, i + 255);

    salida.byte(trozo.length);
    salida.bytes(trozo);
  }

  salida.byte(0);
}

/** El GIF entero: cabecera, paleta global, bucle infinito y un fotograma por entrada (retardo en centésimas). */
export function montaGif(ancho: number, alto: number, paleta: Uint8Array, fotogramas: { indices: Uint8Array; centesimas: number }[]) {
  const b = new Bytes();

  b.texto("GIF89a");
  b.corto(ancho);
  b.corto(alto);
  b.byte(0xf7);
  b.byte(0);
  b.byte(0);
  b.bytes(paleta);

  /* Que se repita sin fin. */
  b.bytes([0x21, 0xff, 0x0b]);
  b.texto("NETSCAPE2.0");
  b.bytes([0x03, 0x01, 0x00, 0x00, 0x00]);

  for (const f of fotogramas) {
    b.bytes([0x21, 0xf9, 0x04, 0x04]);
    b.corto(Math.max(2, Math.round(f.centesimas)));
    b.bytes([0x00, 0x00]);

    b.byte(0x2c);
    b.corto(0);
    b.corto(0);
    b.corto(ancho);
    b.corto(alto);
    b.byte(0);

    lzw(f.indices, b);
  }

  b.byte(0x3b);

  return b.blob();
}
