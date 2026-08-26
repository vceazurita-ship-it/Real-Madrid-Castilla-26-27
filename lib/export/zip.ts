/**
 * Un ZIP mínimo, escrito a mano.
 *
 * Un `.pptx` no es más que un ZIP con XML dentro, así que exportar la pizarra
 * a PowerPoint sólo necesita saber empaquetar ficheros. Se escribe aquí en
 * lugar de traer una librería por dos razones: la app se usa en el campo y en
 * el móvil —cada dependencia nueva es peso que se descarga— y lo que hay que
 * meter en el paquete ya viene comprimido (las diapositivas son JPEG), así que
 * el método **almacenado** basta y no hace falta un compresor.
 *
 * Guardar sin comprimir es legal en el formato: `store` (método 0) es parte
 * del ZIP de toda la vida y PowerPoint, Keynote y Google Slides lo abren igual.
 */

/*
| Los bytes se piden con su `ArrayBuffer` explícito: desde TypeScript 5.7 un
| `Uint8Array` suelto puede estar respaldado por memoria compartida, y el
| constructor de `Blob` no la admite.
*/
export type Bytes = Uint8Array<ArrayBuffer>;

/* La tabla de CRC-32 del ZIP, la de siempre (polinomio 0xEDB88320). */
const TABLA_CRC = (() => {
  const tabla = new Uint32Array(256);

  for (let i = 0; i < 256; i += 1) {
    let valor = i;

    for (let bit = 0; bit < 8; bit += 1) {
      valor = valor & 1 ? (valor >>> 1) ^ 0xedb88320 : valor >>> 1;
    }

    tabla[i] = valor >>> 0;
  }

  return tabla;
})();

export function crc32(datos: Bytes) {
  let crc = 0xffffffff;

  for (let i = 0; i < datos.length; i += 1) {
    crc = (crc >>> 8) ^ TABLA_CRC[(crc ^ datos[i]) & 0xff];
  }

  return (crc ^ 0xffffffff) >>> 0;
}

export type EntradaZip = {
  /** Ruta dentro del paquete: "ppt/slides/slide1.xml". */
  nombre: string;
  datos: Bytes;
};

export function texto(valor: string) {
  return new TextEncoder().encode(valor);
}

/**
 * La fecha en el formato de MS-DOS que pide la cabecera del ZIP.
 *
 * Es un campo de dos palabras de 16 bits con la resolución de 1980: los
 * segundos van a saltos de dos y el año se cuenta desde 1980. Fuera de rango
 * —un reloj mal puesto— se recorta, porque una fecha imposible hace que
 * algunos descompresores se planten.
 */
function fechaDos(cuando: Date) {
  const anio = Math.min(2107, Math.max(1980, cuando.getFullYear()));

  const fecha =
    ((anio - 1980) << 9) | ((cuando.getMonth() + 1) << 5) | cuando.getDate();

  const hora =
    (cuando.getHours() << 11) |
    (cuando.getMinutes() << 5) |
    (cuando.getSeconds() >> 1);

  return { fecha, hora };
}

/** Escritor de enteros en little-endian, que es como los guarda el ZIP. */
function escribe(destino: Bytes, posicion: number, valores: [number, number][]) {
  let cursor = posicion;

  const vista = new DataView(destino.buffer, destino.byteOffset, destino.byteLength);

  valores.forEach(([bytes, valor]) => {
    if (bytes === 2) vista.setUint16(cursor, valor & 0xffff, true);
    else vista.setUint32(cursor, valor >>> 0, true);

    cursor += bytes;
  });

  return cursor;
}

/**
 * Empaqueta las entradas en un ZIP.
 *
 * El orden importa para un `.pptx`: `[Content_Types].xml` tiene que ir la
 * primera, que es como la busca Office. Quien llama es quien lo garantiza.
 */
export function creaZip(entradas: EntradaZip[], cuando = new Date()): Blob {
  const { fecha, hora } = fechaDos(cuando);

  const locales: Bytes[] = [];
  const central: Bytes[] = [];

  let desplazamiento = 0;

  entradas.forEach((entrada) => {
    const nombre = texto(entrada.nombre);
    const crc = crc32(entrada.datos);
    const tamano = entrada.datos.length;

    /* Cabecera local: 30 bytes fijos + el nombre. */
    const cabecera = new Uint8Array(30 + nombre.length);

    escribe(cabecera, 0, [
      [4, 0x04034b50],
      [2, 20], // versión necesaria para extraer
      [2, 0], // sin banderas
      [2, 0], // método 0: almacenado
      [2, hora],
      [2, fecha],
      [4, crc],
      [4, tamano],
      [4, tamano],
      [2, nombre.length],
      [2, 0], // sin campo extra
    ]);

    cabecera.set(nombre, 30);

    locales.push(cabecera, entrada.datos);

    /* Entrada del directorio central: 46 bytes fijos + el nombre. */
    const ficha = new Uint8Array(46 + nombre.length);

    escribe(ficha, 0, [
      [4, 0x02014b50],
      [2, 20], // versión con la que se creó
      [2, 20],
      [2, 0],
      [2, 0],
      [2, hora],
      [2, fecha],
      [4, crc],
      [4, tamano],
      [4, tamano],
      [2, nombre.length],
      [2, 0],
      [2, 0], // sin comentario
      [2, 0], // disco 0
      [2, 0], // atributos internos
      [4, 0], // atributos externos
      [4, desplazamiento],
    ]);

    ficha.set(nombre, 46);

    central.push(ficha);

    desplazamiento += cabecera.length + tamano;
  });

  const tamanoCentral = central.reduce((suma, parte) => suma + parte.length, 0);

  /* Cierre: dónde empieza el directorio y cuántas entradas tiene. */
  const cierre = new Uint8Array(22);

  escribe(cierre, 0, [
    [4, 0x06054b50],
    [2, 0],
    [2, 0],
    [2, entradas.length],
    [2, entradas.length],
    [4, tamanoCentral],
    [4, desplazamiento],
    [2, 0],
  ]);

  return new Blob([...locales, ...central, cierre], {
    type: "application/zip",
  });
}

/** El contenido de un `data:` URL como bytes, para meterlo en el paquete. */
export function bytesDeDataUrl(dataUrl: string) {
  const base64 = dataUrl.slice(dataUrl.indexOf(",") + 1);

  const binario = atob(base64);

  const bytes = new Uint8Array(binario.length);

  for (let i = 0; i < binario.length; i += 1) bytes[i] = binario.charCodeAt(i);

  return bytes;
}
