/**
 * Abrir y escribir MP4 a mano.
 *
 * Es lo que hace falta para montar los vídeos del coding **sin ir a tiempo
 * real**. Grabar la pantalla con `MediaRecorder` obliga a reproducir el
 * partido entero mientras se graba: cuatro minutos de cortes son cuatro
 * minutos de espera, y encima sale WebM. Con WebCodecs el navegador
 * descodifica y codifica tan rápido como puede la máquina —en esta, muy por
 * encima del tiempo real—, pero WebCodecs **no abre ficheros ni escribe
 * ninguno**: da y toma fotogramas sueltos. Quien tiene que sacar las muestras
 * del partido y volver a meterlas en un fichero es este módulo.
 *
 * No trae ninguna librería, por lo mismo que el ZIP de `lib/export/zip.ts`
 * está escrito a mano: la app se usa desde el campo y cada dependencia nueva
 * es peso que se descarga. Un MP4 es una caja de cajas, y de las docenas que
 * existen aquí hacen falta unas quince.
 *
 * ---
 *
 * **Lo que se lee** (`abreMp4`): la tabla de muestras de cada pista —dónde
 * empieza cada fotograma dentro del fichero, cuánto pesa, a qué instante
 * corresponde y si es un fotograma clave—. Con eso se puede saltar al corte
 * sin leer el partido entero: se busca el fotograma clave anterior y se
 * descodifica desde ahí.
 *
 * **Lo que se escribe** (`MuxorMp4`): un MP4 corriente con el índice delante
 * (`faststart`), H.264 y AAC. Delante y no detrás porque un vídeo que se sube
 * a la nube del club se abre antes de terminar de bajar.
 *
 * Todo en microsegundos hacia fuera, que es la moneda de WebCodecs.
 */

import type { Bytes } from "@/lib/export/zip";

/* ------------------------------------------------------------------ */
/*  LOS BYTES                                                          */
/* ------------------------------------------------------------------ */

const nuevo = (n: number) => new Uint8Array(n) as Bytes;

const marca = (texto: string) =>
  nuevo(4).map((_, i) => texto.charCodeAt(i)) as Bytes;

function u8(...valores: number[]) {
  return Uint8Array.from(valores) as Bytes;
}

function u16(valor: number) {
  const salida = nuevo(2);
  new DataView(salida.buffer).setUint16(0, valor);
  return salida;
}

function u32(valor: number) {
  const salida = nuevo(4);
  new DataView(salida.buffer).setUint32(0, valor >>> 0);
  return salida;
}

function i32(valor: number) {
  const salida = nuevo(4);
  new DataView(salida.buffer).setInt32(0, valor);
  return salida;
}

/** Un entero de 64 bits, que es lo que aguanta un partido de dos horas. */
function u64(valor: number) {
  const salida = nuevo(8);
  const vista = new DataView(salida.buffer);

  vista.setUint32(0, Math.floor(valor / 2 ** 32));
  vista.setUint32(4, valor >>> 0);

  return salida;
}

function junta(partes: Uint8Array[]): Bytes {
  const total = partes.reduce((suma, parte) => suma + parte.length, 0);
  const salida = nuevo(total);

  let cursor = 0;

  for (const parte of partes) {
    salida.set(parte, cursor);
    cursor += parte.length;
  }

  return salida;
}

/** Una caja del formato: cuatro bytes de tamaño, cuatro de nombre, y dentro. */
function caja(tipo: string, ...dentro: Uint8Array[]): Bytes {
  const cuerpo = junta(dentro);

  return junta([u32(cuerpo.length + 8), marca(tipo), cuerpo]);
}

/** Una caja con versión y banderas, que son la mayoría. */
const cajaV = (tipo: string, version: number, banderas: number, ...dentro: Uint8Array[]) =>
  caja(tipo, u8(version, (banderas >> 16) & 255, (banderas >> 8) & 255, banderas & 255), ...dentro);

const CERO16 = nuevo(16);

/** La matriz de siempre: sin rotación ni espejo. */
const MATRIZ = junta([
  u32(0x00010000), u32(0), u32(0),
  u32(0), u32(0x00010000), u32(0),
  u32(0), u32(0), u32(0x40000000),
]);

/* ------------------------------------------------------------------ */
/*  LEER                                                               */
/* ------------------------------------------------------------------ */

/**
 * Una pista del fichero, con su tabla de muestras en vectores tipados.
 *
 * En vectores y no en una lista de objetos porque un partido de dos horas a
 * 25 fotogramas son ciento ochenta mil muestras: como objetos son decenas de
 * megas de memoria y un buen rato de recolector; así son dos megas.
 */
export type PistaMp4 = {
  tipo: "video" | "audio";
  /** El identificador que quiere WebCodecs: `avc1.640028`, `mp4a.40.2`… */
  codec: string;
  /** `avcC`, `hvcC` o la configuración del AAC, tal cual viene. */
  descripcion: Bytes | null;
  ancho: number;
  alto: number;
  canales: number;
  frecuencia: number;
  /** Cuántas muestras hay. */
  n: number;
  /** Dónde empieza cada muestra dentro del fichero. */
  offsets: Float64Array;
  tam: Uint32Array;
  /** Cuándo se descodifica y cuándo se enseña, en microsegundos. */
  dtsUs: Float64Array;
  ptsUs: Float64Array;
  duracionUs: Float64Array;
  /** 1 si es fotograma clave. */
  clave: Uint8Array;
  /** Bits por segundo de la pista, medidos sumando lo que pesa. */
  bitrate: number;
};

export type Mp4Abierto = {
  video: PistaMp4 | null;
  audio: PistaMp4 | null;
  duracionUs: number;
};

async function trozo(fichero: Blob, desde: number, hasta: number) {
  const limite = Math.min(hasta, fichero.size);

  if (desde >= limite) return nuevo(0);

  return new Uint8Array(await fichero.slice(desde, limite).arrayBuffer()) as Bytes;
}

const nombreDe = (datos: Uint8Array, en: number) =>
  String.fromCharCode(datos[en], datos[en + 1], datos[en + 2], datos[en + 3]);

/** Recorre las cajas de un tramo y devuelve las que se piden. */
function* hijas(datos: Uint8Array, desde: number, hasta: number) {
  const vista = new DataView(datos.buffer, datos.byteOffset, datos.byteLength);

  let cursor = desde;

  while (cursor + 8 <= hasta) {
    let tam = vista.getUint32(cursor);
    const tipo = nombreDe(datos, cursor + 4);

    let cuerpo = cursor + 8;

    if (tam === 1) {
      tam = Number(vista.getBigUint64(cursor + 8));
      cuerpo = cursor + 16;
    } else if (tam === 0) {
      tam = hasta - cursor;
    }

    if (tam < 8 || cursor + tam > hasta) return;

    yield { tipo, cuerpo, fin: cursor + tam, vista };

    cursor += tam;
  }
}

function busca(datos: Uint8Array, desde: number, hasta: number, tipo: string) {
  for (const hija of hijas(datos, desde, hasta)) {
    if (hija.tipo === tipo) return hija;
  }

  return null;
}

/**
 * El nombre del códec tal y como lo quiere WebCodecs.
 *
 * Sale de los primeros bytes de la configuración, que es donde el propio
 * formato guarda perfil y nivel. Inventárselo no vale: un `avc1.42E01E` de
 * mentira sobre un vídeo `High` hace que el descodificador se niegue.
 */
function codecDeAvcc(avcc: Uint8Array) {
  const hex = (n: number) => n.toString(16).padStart(2, "0");

  return `avc1.${hex(avcc[1])}${hex(avcc[2])}${hex(avcc[3])}`;
}

function codecDeHvcc(hvcc: Uint8Array) {
  const perfilEspacio = (hvcc[1] >> 6) & 3;
  const nivel = hvcc[12];
  const perfil = hvcc[1] & 31;

  const compat = new DataView(hvcc.buffer, hvcc.byteOffset).getUint32(2);

  /* Las banderas de constricción, sin los ceros de la derecha. */
  const bytes: string[] = [];

  for (let i = 6; i <= 11; i += 1) bytes.push(hvcc[i].toString(16).toUpperCase());

  while (bytes.length > 1 && bytes[bytes.length - 1] === "0") bytes.pop();

  const espacio = ["", "A", "B", "C"][perfilEspacio];

  return `hvc1.${espacio}${perfil}.${compat.toString(16).toUpperCase()}.L${nivel}.${bytes.join(".")}`;
}

/** El `DecoderSpecificInfo` que esconde un `esds`, que es AAC en la práctica. */
function configDeEsds(esds: Uint8Array) {
  let cursor = 4; /* versión y banderas */

  const longitud = () => {
    let valor = 0;

    for (let i = 0; i < 4; i += 1) {
      const byte = esds[cursor++];

      valor = (valor << 7) | (byte & 127);

      if (!(byte & 128)) break;
    }

    return valor;
  };

  let objeto = 0x40;

  while (cursor < esds.length) {
    const etiqueta = esds[cursor++];
    const largo = longitud();

    if (etiqueta === 0x03) {
      cursor += 2;

      const banderas = esds[cursor++];

      if (banderas & 0x80) cursor += 2;
      if (banderas & 0x40) cursor += esds[cursor] + 1;
      if (banderas & 0x20) cursor += 2;

      continue;
    }

    if (etiqueta === 0x04) {
      objeto = esds[cursor];
      cursor += 13;
      continue;
    }

    if (etiqueta === 0x05) {
      return {
        objeto,
        config: esds.slice(cursor, cursor + largo) as Bytes,
      };
    }

    cursor += largo;
  }

  return { objeto, config: null };
}

/** Lee una `trak` entera y la convierte en la tabla de muestras. */
function leeTrak(datos: Uint8Array, desde: number, hasta: number): PistaMp4 | null {
  const mdia = busca(datos, desde, hasta, "mdia");

  if (!mdia) return null;

  const mdhd = busca(datos, mdia.cuerpo, mdia.fin, "mdhd");
  const hdlr = busca(datos, mdia.cuerpo, mdia.fin, "hdlr");
  const minf = busca(datos, mdia.cuerpo, mdia.fin, "minf");

  if (!mdhd || !hdlr || !minf) return null;

  const vista = mdhd.vista;
  const version = vista.getUint8(mdhd.cuerpo);

  const escala =
    version === 1
      ? vista.getUint32(mdhd.cuerpo + 20)
      : vista.getUint32(mdhd.cuerpo + 12);

  const clase = nombreDe(datos, hdlr.cuerpo + 8);

  const tipo = clase === "vide" ? "video" : clase === "soun" ? "audio" : null;

  if (!tipo || !escala) return null;

  const stbl = busca(datos, minf.cuerpo, minf.fin, "stbl");

  if (!stbl) return null;

  const dame = (nombre: string) => busca(datos, stbl.cuerpo, stbl.fin, nombre);

  const stsd = dame("stsd");
  const stts = dame("stts");
  const stsc = dame("stsc");
  const stsz = dame("stsz");
  const stco = dame("stco") ?? dame("co64");
  const stss = dame("stss");
  const ctts = dame("ctts");

  if (!stsd || !stts || !stsc || !stsz || !stco) return null;

  /* -------------------------------------------------- la descripción */

  let codec = "";
  let descripcion: Bytes | null = null;
  let ancho = 0;
  let alto = 0;
  let canales = 2;
  let frecuencia = 48000;

  const primera = busca(datos, stsd.cuerpo + 8, stsd.fin, "avc1") ??
    busca(datos, stsd.cuerpo + 8, stsd.fin, "avc3") ??
    busca(datos, stsd.cuerpo + 8, stsd.fin, "hvc1") ??
    busca(datos, stsd.cuerpo + 8, stsd.fin, "hev1") ??
    busca(datos, stsd.cuerpo + 8, stsd.fin, "mp4a") ??
    null;

  if (!primera) return null;

  if (tipo === "video") {
    ancho = vista.getUint16(primera.cuerpo + 24);
    alto = vista.getUint16(primera.cuerpo + 26);

    const avcc = busca(datos, primera.cuerpo + 78, primera.fin, "avcC");
    const hvcc = busca(datos, primera.cuerpo + 78, primera.fin, "hvcC");

    if (avcc) {
      descripcion = datos.slice(avcc.cuerpo, avcc.fin) as Bytes;
      codec = codecDeAvcc(descripcion);
    } else if (hvcc) {
      descripcion = datos.slice(hvcc.cuerpo, hvcc.fin) as Bytes;
      codec = codecDeHvcc(descripcion);
    } else {
      return null;
    }
  } else {
    canales = vista.getUint16(primera.cuerpo + 16);
    frecuencia = vista.getUint32(primera.cuerpo + 24) >>> 16;

    const esds = busca(datos, primera.cuerpo + 28, primera.fin, "esds");

    if (!esds) return null;

    const { objeto, config } = configDeEsds(datos.slice(esds.cuerpo, esds.fin));

    if (!config) return null;

    descripcion = config;
    codec = `mp4a.${objeto.toString(16)}.${(config[0] >> 3) & 31}`;

    /*
    | La frecuencia de verdad está en la configuración, no en la caja.
    |
    | Un AAC con SBR («HE-AAC») declara 24 kHz arriba y 48 kHz dentro, y
    | dárselo al descodificador al revés lo deja mudo o a media velocidad.
    */
    const indice = ((config[0] & 7) << 1) | (config[1] >> 7);
    const FRECUENCIAS = [
      96000, 88200, 64000, 48000, 44100, 32000, 24000, 22050, 16000, 12000,
      11025, 8000, 7350,
    ];

    if (FRECUENCIAS[indice]) frecuencia = FRECUENCIAS[indice];

    const canalesConfig = (config[1] >> 3) & 15;

    if (canalesConfig >= 1 && canalesConfig <= 8) canales = canalesConfig;
  }

  /* ------------------------------------------------- cuántas muestras */

  const cuenta = (caja_: { cuerpo: number }, saltoExtra = 0) =>
    vista.getUint32(caja_.cuerpo + 4 + saltoExtra);

  const tamFijo = vista.getUint32(stsz.cuerpo + 4);
  const n = vista.getUint32(stsz.cuerpo + 8);

  if (n === 0) return null;

  const tam = new Uint32Array(n);

  if (tamFijo > 0) {
    tam.fill(tamFijo);
  } else {
    for (let i = 0; i < n; i += 1) {
      tam[i] = vista.getUint32(stsz.cuerpo + 12 + i * 4);
    }
  }

  /* --------------------------------------------------- los instantes */

  const dts = new Float64Array(n);
  const dur = new Float64Array(n);

  {
    const entradas = cuenta(stts);

    let muestra = 0;
    let reloj = 0;

    for (let e = 0; e < entradas && muestra < n; e += 1) {
      const veces = vista.getUint32(stts.cuerpo + 8 + e * 8);
      const delta = vista.getUint32(stts.cuerpo + 12 + e * 8);

      for (let i = 0; i < veces && muestra < n; i += 1) {
        dts[muestra] = reloj;
        dur[muestra] = delta;

        reloj += delta;
        muestra += 1;
      }
    }

    /* Una tabla corta deja muestras sin instante: se estiran con el último. */
    for (let i = muestra; i < n; i += 1) {
      dts[i] = reloj;
      dur[i] = dur[muestra - 1] || 0;
      reloj += dur[i];
    }
  }

  const pts = new Float64Array(n);

  pts.set(dts);

  if (ctts) {
    const entradas = cuenta(ctts);
    const versionCtts = vista.getUint8(ctts.cuerpo);

    let muestra = 0;

    for (let e = 0; e < entradas && muestra < n; e += 1) {
      const veces = vista.getUint32(ctts.cuerpo + 8 + e * 8);
      const salto =
        versionCtts === 1
          ? vista.getInt32(ctts.cuerpo + 12 + e * 8)
          : vista.getUint32(ctts.cuerpo + 12 + e * 8);

      for (let i = 0; i < veces && muestra < n; i += 1) {
        pts[muestra] = dts[muestra] + salto;
        muestra += 1;
      }
    }
  }

  /* ------------------------------------------------ los fotogramas clave */

  const clave = new Uint8Array(n);

  if (stss) {
    const entradas = cuenta(stss);

    for (let e = 0; e < entradas; e += 1) {
      const numero = vista.getUint32(stss.cuerpo + 8 + e * 4);

      if (numero >= 1 && numero <= n) clave[numero - 1] = 1;
    }
  } else {
    clave.fill(1);
  }

  /* ------------------------------------------------------ dónde están */

  const esCo64 = nombreDe(datos, stco.cuerpo - 4) === "co64";
  const trozos = cuenta(stco);
  const inicioTrozo = new Float64Array(trozos);

  for (let c = 0; c < trozos; c += 1) {
    inicioTrozo[c] = esCo64
      ? Number(vista.getBigUint64(stco.cuerpo + 8 + c * 8))
      : vista.getUint32(stco.cuerpo + 8 + c * 4);
  }

  const offsets = new Float64Array(n);

  {
    const entradas = cuenta(stsc);

    const primeros: number[] = [];
    const porTrozo: number[] = [];

    for (let e = 0; e < entradas; e += 1) {
      primeros.push(vista.getUint32(stsc.cuerpo + 8 + e * 12));
      porTrozo.push(vista.getUint32(stsc.cuerpo + 12 + e * 12));
    }

    let muestra = 0;

    for (let e = 0; e < entradas && muestra < n; e += 1) {
      const hastaTrozo = e + 1 < entradas ? primeros[e + 1] - 1 : trozos;

      for (let c = primeros[e]; c <= hastaTrozo && muestra < n; c += 1) {
        let dentro = inicioTrozo[c - 1] ?? 0;

        for (let i = 0; i < porTrozo[e] && muestra < n; i += 1) {
          offsets[muestra] = dentro;
          dentro += tam[muestra];
          muestra += 1;
        }
      }
    }
  }

  /* ------------------------------------------- de la escala a los micros */

  const aUs = 1_000_000 / escala;

  /*
  | El instante cero es el que diga la lista de edición, y si no la hay, el
  | primer fotograma.
  |
  | Muchos partidos empiezan con un desfase de un par de fotogramas —el
  | `ctts` del primer grupo de imágenes— y traen un `elst` que le dice al
  | reproductor que empiece ahí. La página lo descuenta porque lo hace el
  | `<video>`; si aquí no se descontara, los cortes saldrían movidos justo esa
  | fracción respecto a lo que marcó el analista.
  */
  let pts0 = Infinity;

  for (let i = 0; i < n; i += 1) pts0 = Math.min(pts0, pts[i]);

  const edts = busca(datos, desde, hasta, "edts");
  const elst = edts ? busca(datos, edts.cuerpo, edts.fin, "elst") : null;

  if (elst && vista.getUint32(elst.cuerpo + 4) >= 1) {
    const versionElst = vista.getUint8(elst.cuerpo);

    const enMedia =
      versionElst === 1
        ? Number(vista.getBigInt64(elst.cuerpo + 8 + 8))
        : vista.getInt32(elst.cuerpo + 8 + 4);

    /* Un `-1` es una espera en negro al principio, no un salto: no cuenta. */
    if (enMedia >= 0) pts0 = enMedia;
  }

  const ptsUs = new Float64Array(n);
  const dtsUs = new Float64Array(n);
  const duracionUs = new Float64Array(n);

  for (let i = 0; i < n; i += 1) {
    ptsUs[i] = (pts[i] - pts0) * aUs;
    dtsUs[i] = (dts[i] - pts0) * aUs;
    duracionUs[i] = dur[i] * aUs;
  }

  let bytes = 0;

  for (let i = 0; i < n; i += 1) bytes += tam[i];

  const duracionTotal = ptsUs[n - 1] + duracionUs[n - 1];

  return {
    tipo,
    codec,
    descripcion,
    ancho,
    alto,
    canales,
    frecuencia,
    n,
    offsets,
    tam,
    dtsUs,
    ptsUs,
    duracionUs,
    clave,
    bitrate: duracionTotal > 0 ? (bytes * 8) / (duracionTotal / 1_000_000) : 0,
  };
}

/**
 * Abre el partido y devuelve sus pistas, o `null` si no es un MP4 que se pueda
 * recorrer.
 *
 * `null` no es un fallo: hay ficheros —un MKV, un MP4 troceado en `moof`— que
 * este módulo no sabe leer y que el `<video>` sí reproduce. Quien llama se va
 * entonces al camino de siempre. Por eso no lanza.
 */
export async function abreMp4(fichero: Blob): Promise<Mp4Abierto | null> {
  try {
    let cursor = 0;
    let moov: Bytes | null = null;

    while (cursor + 8 <= fichero.size && !moov) {
      const cabecera = await trozo(fichero, cursor, cursor + 16);

      if (cabecera.length < 8) break;

      const vista = new DataView(cabecera.buffer, cabecera.byteOffset);

      let tam = vista.getUint32(0);
      const tipo = nombreDe(cabecera, 4);

      if (tam === 1) tam = Number(vista.getBigUint64(8));
      else if (tam === 0) tam = fichero.size - cursor;

      if (tam < 8) break;

      if (tipo === "moov") moov = await trozo(fichero, cursor, cursor + tam);

      cursor += tam;
    }

    if (!moov) return null;

    let video: PistaMp4 | null = null;
    let audio: PistaMp4 | null = null;
    let duracionUs = 0;

    for (const hija of hijas(moov, 8, moov.length)) {
      if (hija.tipo === "mvhd") {
        const version = hija.vista.getUint8(hija.cuerpo);

        const escala =
          version === 1
            ? hija.vista.getUint32(hija.cuerpo + 20)
            : hija.vista.getUint32(hija.cuerpo + 12);

        const duracion =
          version === 1
            ? Number(hija.vista.getBigUint64(hija.cuerpo + 24))
            : hija.vista.getUint32(hija.cuerpo + 16);

        if (escala) duracionUs = (duracion / escala) * 1_000_000;
      }

      if (hija.tipo !== "trak") continue;

      const pista = leeTrak(moov, hija.cuerpo, hija.fin);

      if (!pista) continue;

      if (pista.tipo === "video" && !video) video = pista;
      if (pista.tipo === "audio" && !audio) audio = pista;
    }

    if (!video) return null;

    return { video, audio, duracionUs };
  } catch (error) {
    console.warn("[coding] no se ha podido leer el MP4", error);

    return null;
  }
}

/* ------------------------------------------------------------------ */
/*  BUSCAR DENTRO DE UNA PISTA                                         */
/* ------------------------------------------------------------------ */

/** La primera muestra que se enseña en ese instante o después. */
export function primeraDesde(pista: PistaMp4, us: number) {
  let bajo = 0;
  let alto = pista.n - 1;
  let salida = pista.n;

  while (bajo <= alto) {
    const medio = (bajo + alto) >> 1;

    if (pista.ptsUs[medio] + pista.duracionUs[medio] > us) {
      salida = medio;
      alto = medio - 1;
    } else {
      bajo = medio + 1;
    }
  }

  return salida;
}

/**
 * El fotograma clave desde el que hay que empezar a descodificar.
 *
 * Un corte casi nunca empieza en uno: para enseñar el fotograma del minuto
 * 12:03 hay que descodificar desde el clave anterior y tirar lo de en medio.
 * Es exactamente lo que hace un reproductor al buscar.
 */
export function claveAntesDe(pista: PistaMp4, us: number) {
  const desde = Math.min(primeraDesde(pista, us), pista.n - 1);

  for (let i = desde; i >= 0; i -= 1) {
    if (pista.clave[i]) return i;
  }

  return 0;
}

/**
 * Da los bytes de las muestras una a una, leyendo el fichero por ventanas.
 *
 * Ni una muestra suelta —serían miles de lecturas— ni el corte entero de
 * golpe: un corte de un partido en 4K son cientos de megas y no caben dos
 * veces en memoria. Se leen ventanas de dieciséis megas, que es lo que ocupan
 * unos segundos de vídeo, y se avanza.
 */
export class LectorMuestras {
  private base = 0;
  private ventana: Bytes = nuevo(0);

  constructor(
    private readonly fichero: Blob,
    private readonly tamVentana = 16 * 1024 * 1024,
  ) {}

  async dame(offset: number, tam: number): Promise<Bytes> {
    if (offset < this.base || offset + tam > this.base + this.ventana.length) {
      this.base = offset;

      this.ventana = await trozo(
        this.fichero,
        offset,
        offset + Math.max(this.tamVentana, tam),
      );
    }

    const dentro = offset - this.base;

    return this.ventana.slice(dentro, dentro + tam) as Bytes;
  }
}

/* ------------------------------------------------------------------ */
/*  ESCRIBIR                                                           */
/* ------------------------------------------------------------------ */

type MuestraSalida = {
  datos: Bytes;
  /** En la escala de su pista. */
  instante: number;
  duracion: number;
  clave: boolean;
};

/** La escala del vídeo: microsegundos, que es lo que da WebCodecs sin redondear. */
const ESCALA_VIDEO = 1_000_000;

/*
| Con qué colores hay que leer esto. Y no sobra: es la diferencia entre que el
| vídeo se vea como se veía en la pantalla del analista o con los rojos
| apagados.
|
| El codificador del navegador convierte a **BT.709 de rango reducido** —
| medido: un rojo puro sale 63/102/240 y un gris medio 126, en 720p y en 360p
| igual— pero no lo apunta en ninguna parte, y un fichero sin apuntar lo
| interpreta cada reproductor a su manera (ffmpeg y VLC dan por hecho BT.601
| en cuanto dudan, y entonces el rojo baja a 233). Esta caja lo deja escrito.
*/
const COLR = caja(
  "colr",
  marca("nclx"),
  u16(1), /* primarios: BT.709 */
  u16(1), /* transferencia: BT.709 */
  u16(1), /* matriz: BT.709 */
  u8(0), /* rango reducido */
);

/** La escala general del fichero. */
const ESCALA_PELICULA = 1000;

type ConfigVideo = { ancho: number; alto: number; descripcion: Bytes };
type ConfigAudio = { frecuencia: number; canales: number; descripcion: Bytes };

/**
 * Junta lo que sale del codificador en un MP4.
 *
 * Se le van dando muestras y al final devuelve el fichero. El índice va
 * **delante** (`faststart`): se arma dos veces, la primera para saber cuánto
 * ocupa y la segunda ya con los sitios buenos, que es lo que hace `ffmpeg` con
 * `-movflags +faststart`.
 */
export class MuxorMp4 {
  private video: MuestraSalida[] = [];
  private audio: MuestraSalida[] = [];

  private configVideo: ConfigVideo | null = null;
  private configAudio: ConfigAudio | null = null;

  configuraVideo(config: ConfigVideo) {
    this.configVideo = config;
  }

  configuraAudio(config: ConfigAudio) {
    this.configAudio = config;
  }

  get tieneAudio() {
    return this.configAudio !== null && this.audio.length > 0;
  }

  /** Un fotograma codificado. Los instantes, en microsegundos. */
  añadeVideo(datos: Bytes, us: number, duracionUs: number, clave: boolean) {
    this.video.push({ datos, instante: us, duracion: Math.max(1, duracionUs), clave });
  }

  /** Un paquete de sonido. El instante, en muestras de audio. */
  añadeAudio(datos: Bytes, enMuestras: number, duracion: number) {
    this.audio.push({ datos, instante: enMuestras, duracion, clave: true });
  }

  /** Lo que dura lo escrito, en microsegundos. */
  get duracionUs() {
    const ultima = this.video[this.video.length - 1];

    return ultima ? ultima.instante + ultima.duracion : 0;
  }

  cierra(): Blob {
    if (!this.configVideo || this.video.length === 0) {
      throw new Error("El montaje no ha llegado a codificar ni un fotograma.");
    }

    /*
    | Los instantes de la lista son de presentación y pueden venir
    | desordenados si el codificador usa fotogramas B. La tabla de tiempos
    | (`stts`) se escribe en orden de descodificación, así que las duraciones
    | se sacan de los instantes **ordenados** y la diferencia entre unos y
    | otros va al `ctts`.
    */
    const enOrden = this.video
      .map((muestra) => muestra.instante)
      .sort((uno, otro) => uno - otro);

    /*
    | El reloj de descodificación es la lista de instantes **ordenada**: la
    | i-ésima muestra que se descodifica no puede enseñarse antes que la
    | i-ésima más temprana de todas. Así crece siempre —lo único que exige el
    | formato— y lo que se desvía del instante real va al `ctts`.
    */
    const dts = new Float64Array(this.video.length);

    for (let i = 0; i < this.video.length; i += 1) dts[i] = enOrden[i];

    const duraciones = new Float64Array(this.video.length);

    for (let i = 0; i < this.video.length; i += 1) {
      duraciones[i] =
        i + 1 < this.video.length
          ? Math.max(1, Math.round(dts[i + 1] - dts[i]))
          : Math.max(1, Math.round(this.video[i].duracion));
    }

    const duracionVideo = duraciones.reduce((suma, valor) => suma + valor, 0);

    const duracionAudio = this.audio.reduce((suma, m) => suma + m.duracion, 0);

    const duracionPelicula = Math.round(
      (duracionVideo / ESCALA_VIDEO) * ESCALA_PELICULA,
    );

    /* --------------------------------------------------- los bytes */

    /*
    | Vídeo y sonido se van turnando dentro del `mdat`.
    |
    | Un fichero con todo el vídeo delante y todo el sonido detrás se
    | reproduce, pero obliga al reproductor a ir y venir por el fichero. Se
    | escriben en orden de reloj, que es como los quiere leer.
    */
    const piezas: Bytes[] = [];
    const sitioVideo = new Float64Array(this.video.length);
    const sitioAudio = new Float64Array(this.audio.length);

    let dentro = 0;
    let iv = 0;
    let ia = 0;

    const relojAudio = (i: number) =>
      this.configAudio
        ? (this.audio[i].instante / this.configAudio.frecuencia) * 1_000_000
        : 0;

    while (iv < this.video.length || ia < this.audio.length) {
      const tocaVideo =
        ia >= this.audio.length ||
        (iv < this.video.length && dts[iv] <= relojAudio(ia));

      if (tocaVideo) {
        sitioVideo[iv] = dentro;
        piezas.push(this.video[iv].datos);
        dentro += this.video[iv].datos.length;
        iv += 1;
      } else {
        sitioAudio[ia] = dentro;
        piezas.push(this.audio[ia].datos);
        dentro += this.audio[ia].datos.length;
        ia += 1;
      }
    }

    const pesoMdat = dentro;

    /* --------------------------------------------------- las tablas */

    const tablaTiempos = (duracionesDe: ArrayLike<number>) => {
      const entradas: number[] = [];

      for (let i = 0; i < duracionesDe.length; i += 1) {
        const delta = Math.round(duracionesDe[i]);
        const ultima = entradas.length - 2;

        if (entradas.length && entradas[ultima + 1] === delta) {
          entradas[ultima] += 1;
        } else {
          entradas.push(1, delta);
        }
      }

      const cuerpo: Uint8Array[] = [u32(entradas.length / 2)];

      for (let i = 0; i < entradas.length; i += 2) {
        cuerpo.push(u32(entradas[i]), u32(entradas[i + 1]));
      }

      return cajaV("stts", 0, 0, ...cuerpo);
    };

    const tablaTamanos = (muestras: MuestraSalida[]) =>
      cajaV(
        "stsz",
        0,
        0,
        u32(0),
        u32(muestras.length),
        junta(muestras.map((m) => u32(m.datos.length))),
      );

    /* Una muestra por trozo: así el `co64` lleva el sitio exacto de cada una. */
    const tablaTrozos = () =>
      cajaV("stsc", 0, 0, u32(1), u32(1), u32(1), u32(1));

    const tablaSitios = (sitios: Float64Array, base: number) =>
      cajaV(
        "co64",
        0,
        0,
        u32(sitios.length),
        junta(Array.from(sitios, (sitio) => u64(base + sitio))),
      );

    const tablaClaves = () => {
      const claves: number[] = [];

      this.video.forEach((muestra, indice) => {
        if (muestra.clave) claves.push(indice + 1);
      });

      return cajaV(
        "stss",
        0,
        0,
        u32(claves.length),
        junta(claves.map((numero) => u32(numero))),
      );
    };

    const tablaSaltos = () => {
      let hace = false;

      for (let i = 0; i < this.video.length; i += 1) {
        if (Math.round(this.video[i].instante - dts[i]) !== 0) hace = true;
      }

      if (!hace) return nuevo(0);

      const cuerpo: Uint8Array[] = [];

      let entradas = 0;

      for (let i = 0; i < this.video.length; i += 1) {
        cuerpo.push(u32(1), i32(Math.round(this.video[i].instante - dts[i])));
        entradas += 1;
      }

      return cajaV("ctts", 1, 0, u32(entradas), junta(cuerpo));
    };

    /* ----------------------------------------------------- las cajas */

    const { ancho, alto, descripcion } = this.configVideo;

    const trakVideo = (baseMdat: number) =>
      caja(
        "trak",
        cajaV(
          "tkhd",
          0,
          3,
          u32(0),
          u32(0),
          u32(1),
          u32(0),
          u32(duracionPelicula),
          u32(0),
          u32(0),
          u16(0),
          u16(0),
          u16(0),
          u16(0),
          MATRIZ,
          u32(ancho * 65536),
          u32(alto * 65536),
        ),
        caja(
          "mdia",
          cajaV(
            "mdhd",
            0,
            0,
            u32(0),
            u32(0),
            u32(ESCALA_VIDEO),
            u32(Math.round(duracionVideo)),
            u16(0x55c4),
            u16(0),
          ),
          cajaV("hdlr", 0, 0, u32(0), marca("vide"), u32(0), u32(0), u32(0), u8(0)),
          caja(
            "minf",
            cajaV("vmhd", 0, 1, u16(0), u16(0), u16(0), u16(0)),
            caja("dinf", cajaV("dref", 0, 0, u32(1), cajaV("url ", 0, 1))),
            caja(
              "stbl",
              cajaV(
                "stsd",
                0,
                0,
                u32(1),
                caja(
                  "avc1",
                  nuevo(6),
                  u16(1),
                  u16(0),
                  u16(0),
                  u32(0),
                  u32(0),
                  u32(0),
                  u16(ancho),
                  u16(alto),
                  u32(0x00480000),
                  u32(0x00480000),
                  u32(0),
                  u16(1),
                  nuevo(32),
                  u16(0x0018),
                  u16(0xffff),
                  caja("avcC", descripcion),
                  COLR,
                ),
              ),
              tablaTiempos(duraciones),
              tablaClaves(),
              tablaSaltos(),
              tablaTrozos(),
              tablaTamanos(this.video),
              tablaSitios(sitioVideo, baseMdat),
            ),
          ),
        ),
      );

    const trakAudio = (baseMdat: number) => {
      if (!this.configAudio || this.audio.length === 0) return nuevo(0);

      const { frecuencia, canales, descripcion: config } = this.configAudio;

      /* El descriptor del AAC: el envoltorio de siempre alrededor del config. */
      const descriptor = (etiqueta: number, ...dentro: Uint8Array[]) => {
        const cuerpo = junta(dentro);

        return junta([
          u8(etiqueta, 0x80, 0x80, 0x80, cuerpo.length),
          cuerpo,
        ]);
      };

      const esds = cajaV(
        "esds",
        0,
        0,
        descriptor(
          0x03,
          u16(2),
          u8(0),
          descriptor(
            0x04,
            u8(0x40, 0x15),
            u8(0, 0, 0),
            u32(0),
            u32(0),
            descriptor(0x05, config),
          ),
          descriptor(0x06, u8(0x02)),
        ),
      );

      return caja(
        "trak",
        cajaV(
          "tkhd",
          0,
          3,
          u32(0),
          u32(0),
          u32(2),
          u32(0),
          u32(
            Math.round((duracionAudio / frecuencia) * ESCALA_PELICULA),
          ),
          u32(0),
          u32(0),
          u16(0),
          u16(0),
          u16(0x0100),
          u16(0),
          MATRIZ,
          u32(0),
          u32(0),
        ),
        caja(
          "mdia",
          cajaV(
            "mdhd",
            0,
            0,
            u32(0),
            u32(0),
            u32(frecuencia),
            u32(Math.round(duracionAudio)),
            u16(0x55c4),
            u16(0),
          ),
          cajaV("hdlr", 0, 0, u32(0), marca("soun"), u32(0), u32(0), u32(0), u8(0)),
          caja(
            "minf",
            cajaV("smhd", 0, 0, u16(0), u16(0)),
            caja("dinf", cajaV("dref", 0, 0, u32(1), cajaV("url ", 0, 1))),
            caja(
              "stbl",
              cajaV(
                "stsd",
                0,
                0,
                u32(1),
                caja(
                  "mp4a",
                  nuevo(6),
                  u16(1),
                  u32(0),
                  u32(0),
                  u16(canales),
                  u16(16),
                  u16(0),
                  u16(0),
                  u32(frecuencia * 65536),
                  esds,
                ),
              ),
              tablaTiempos(this.audio.map((m) => m.duracion)),
              tablaTrozos(),
              tablaTamanos(this.audio),
              tablaSitios(sitioAudio, baseMdat),
            ),
          ),
        ),
      );
    };

    const arma = (baseMdat: number) =>
      caja(
        "moov",
        cajaV(
          "mvhd",
          0,
          0,
          u32(0),
          u32(0),
          u32(ESCALA_PELICULA),
          u32(duracionPelicula),
          u32(0x00010000),
          u16(0x0100),
          u16(0),
          u32(0),
          u32(0),
          MATRIZ,
          CERO16,
          u32(0),
          u32(0),
          u32(3),
        ),
        trakVideo(baseMdat),
        trakAudio(baseMdat),
      );

    const ftyp = caja(
      "ftyp",
      marca("isom"),
      u32(512),
      marca("isom"),
      marca("iso2"),
      marca("avc1"),
      marca("mp41"),
    );

    /*
    | Dos vueltas, y no es desperdicio.
    |
    | El índice guarda el sitio de cada muestra dentro del fichero, y ese sitio
    | depende de lo que ocupe el índice. Se arma una vez con base cero para
    | medirlo, y otra ya con la base buena: como las cajas de sitios son de
    | ocho bytes fijos, la segunda mide exactamente lo mismo que la primera.
    */
    const cabeceraMdat = junta([u32(1), marca("mdat"), u64(pesoMdat + 16)]);

    const medida = arma(0);
    const base = ftyp.length + medida.length + cabeceraMdat.length;

    return new Blob([ftyp, arma(base), cabeceraMdat, ...piezas], {
      type: "video/mp4",
    });
  }
}
