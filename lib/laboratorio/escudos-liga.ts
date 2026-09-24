/**
 * LOS ESCUDOS DE LA LIGA, EN UN .PPTX DEL QUE SE PUEDEN SACAR.
 *
 * Para qué: hacer una portada, una convocatoria o una pizarra hace falta el
 * escudo del rival en PNG y con el fondo quitado, y hasta ahora eso era buscar
 * la imagen por internet, recortarla a mano y acabar pegando un escudo de hace
 * tres temporadas con un halo blanco alrededor.
 *
 * Aquí salen los veinte del grupo en una sola diapositiva, cada uno como un
 * objeto propio de PowerPoint: se pincha, se copia y se pega donde haga falta,
 * y lo que se pega es el PNG con su transparencia, no un recorte de la
 * captura. Eso es lo que hace que sirva de biblioteca y no de póster.
 *
 * De dónde salen: son los escudos de BeSoccer que ya se bajan para el informe
 * del rival y viven en Supabase, así que se actualizan solos con la jornada. Se
 * piden a `/api/data-analisis?escudos=1`, que devuelve los pares nombre-escudo
 * sin traerse el documento entero.
 *
 * Los de BeSoccer llegan en **PNG de 640×640 con canal alfa**, o sea que el
 * fondo ya viene quitado de origen y no hay que inventárselo. Aun así aquí se
 * comprueba, y si alguno llegara opaco se le quita el fondo por los bordes:
 * más vale eso que un escudo con recuadro blanco en medio de una portada.
 */

import { creaPptx, type CapaPptx, type DiapositivaPptx } from "@/lib/export/pptx";

/** El lienzo de la plantilla, en píxeles. Las capas van en tanto por uno. */
const LIENZO_ANCHO = 1920;
const LIENZO_ALTO = 1080;

/** Cinco columnas por cuatro filas: los veinte del grupo en una sola hoja. */
const COLUMNAS = 5;
const FILAS = 4;
const POR_HOJA = COLUMNAS * FILAS;

export type EscudoLiga = {
  equipo: string;
  /** La URL de BeSoccer, tal cual. */
  url: string;
};

export type EscudoListo = EscudoLiga & {
  /** `data:image/png;base64,…`, ya recortado y con el fondo fuera. */
  png: string;
  ancho: number;
  alto: number;
  /** Se le ha tenido que quitar un fondo opaco. */
  fondoQuitado: boolean;
};

/**
 * Los nombres repetidos del mismo escudo.
 *
 * BeSoccer escribe el mismo club de dos maneras según de dónde se lea —del
 * informe sale «CD Teruel» y de la clasificación «Teruel»—, y la lista llega
 * con las dos. Se agrupa por la URL, que es la que lleva el id del club, y se
 * queda **el nombre más largo**: entre «Alcorcón» y «AD Alcorcón», el que se
 * escribe en un documento del club es el segundo.
 */
export function sinRepetidos(lista: EscudoLiga[]): EscudoLiga[] {
  const porUrl = new Map<string, EscudoLiga>();

  for (const uno of lista) {
    if (!uno.url || !uno.equipo) continue;

    const previo = porUrl.get(uno.url);

    if (!previo || uno.equipo.length > previo.equipo.length) {
      porUrl.set(uno.url, uno);
    }
  }

  return [...porUrl.values()].sort((a, b) =>
    a.equipo.localeCompare(b.equipo, "es"),
  );
}

/**
 * Todo por el proxio del mismo origen.
 *
 * `cdn.resfu.com` no manda `Access-Control-Allow-Origin`, y aquí hay que leer
 * los píxeles de cada escudo en un `<canvas>` para recortarlo: con una imagen
 * de otro origen el lienzo queda contaminado y `toDataURL()` revienta.
 * `/api/rivals/foto` la sirve desde aquí con caché de un día.
 */
function porElProxy(url: string) {
  return url.startsWith("/") ? url : `/api/rivals/foto?url=${encodeURIComponent(url)}`;
}

export function urlDeEscudo(url: string) {
  return porElProxy(url);
}

function cargaImagen(src: string): Promise<HTMLImageElement> {
  return new Promise((listo, falla) => {
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => listo(img);
    img.onerror = () => falla(new Error(`no se pudo cargar ${src}`));
    img.src = src;
  });
}

/** Distancia entre dos colores, sin raíz: vale para comparar con un umbral. */
function distancia(
  datos: Uint8ClampedArray,
  i: number,
  r: number,
  g: number,
  b: number,
) {
  const dr = datos[i] - r;
  const dg = datos[i + 1] - g;
  const db = datos[i + 2] - b;

  return dr * dr + dg * dg + db * db;
}

/**
 * Quita el fondo de un escudo que haya llegado opaco.
 *
 * Sólo se llama cuando las cuatro esquinas son opacas, o sea cuando el escudo
 * viene con recuadro. Se inunda desde el borde con el color de la esquina
 * —nunca desde el centro, que se comería el blanco de dentro del escudo— y se
 * deja medio transparente lo que quede a medio camino, para que el contorno no
 * salga a escalones.
 *
 * Devuelve `false` si no había fondo que quitar.
 */
function quitaFondo(datos: Uint8ClampedArray, ancho: number, alto: number) {
  const esquinas = [
    0,
    (ancho - 1) * 4,
    (alto - 1) * ancho * 4,
    ((alto - 1) * ancho + ancho - 1) * 4,
  ];

  if (esquinas.some((i) => datos[i + 3] < 250)) return false;

  const r = datos[0];
  const g = datos[1];
  const b = datos[2];

  /* Que las cuatro esquinas sean del mismo color: si no, no hay un fondo
     plano y tocarlo sería estropear el escudo. */
  const IGUAL = 24 * 24;
  if (esquinas.some((i) => distancia(datos, i, r, g, b) > IGUAL)) return false;

  const TOLERANCIA = 40 * 40;
  const DUDA = 78 * 78;

  const visto = new Uint8Array(ancho * alto);
  const cola: number[] = [];

  const encola = (x: number, y: number) => {
    if (x < 0 || y < 0 || x >= ancho || y >= alto) return;
    const p = y * ancho + x;
    if (visto[p]) return;
    visto[p] = 1;
    cola.push(p);
  };

  for (let x = 0; x < ancho; x += 1) {
    encola(x, 0);
    encola(x, alto - 1);
  }
  for (let y = 0; y < alto; y += 1) {
    encola(0, y);
    encola(ancho - 1, y);
  }

  while (cola.length) {
    const p = cola.pop()!;
    const i = p * 4;
    const d = distancia(datos, i, r, g, b);

    if (d > DUDA) continue;

    if (d <= TOLERANCIA) {
      datos[i + 3] = 0;
    } else {
      /*
      | Zona de duda: el píxel es medio fondo y medio escudo, que es lo que
      | pasa en el filo de una curva. Se le deja el alfa proporcional en vez de
      | decidir por él, y así el contorno no queda dentado.
      */
      const parte = (d - TOLERANCIA) / (DUDA - TOLERANCIA);
      datos[i + 3] = Math.min(datos[i + 3], Math.round(255 * parte));

      continue;
    }

    const x = p % ancho;
    const y = (p - x) / ancho;

    encola(x - 1, y);
    encola(x + 1, y);
    encola(x, y - 1);
    encola(x, y + 1);
  }

  return true;
}

/** El recuadro que ocupa de verdad el escudo, sin el aire de alrededor. */
function recorte(datos: Uint8ClampedArray, ancho: number, alto: number) {
  let x0 = ancho;
  let y0 = alto;
  let x1 = -1;
  let y1 = -1;

  for (let y = 0; y < alto; y += 1) {
    for (let x = 0; x < ancho; x += 1) {
      /* Un alfa de 8 y no de 0: los bordes suavizados dejan un halo casi
         invisible que, si se cuenta, devuelve la imagen entera. */
      if (datos[(y * ancho + x) * 4 + 3] > 8) {
        if (x < x0) x0 = x;
        if (x > x1) x1 = x;
        if (y < y0) y0 = y;
        if (y > y1) y1 = y;
      }
    }
  }

  if (x1 < 0) return null;

  return { x: x0, y: y0, ancho: x1 - x0 + 1, alto: y1 - y0 + 1 };
}

/**
 * Deja un escudo listo para meter en el documento.
 *
 * No se reescala: el PNG que sale tiene los píxeles del original —los 640×640
 * de BeSoccer—, sólo sin el aire de los márgenes. Agrandar aquí daría un
 * fichero más gordo y la misma nitidez.
 */
export async function preparaEscudo(uno: EscudoLiga): Promise<EscudoListo> {
  const img = await cargaImagen(porElProxy(uno.url));

  const ancho = img.naturalWidth || img.width;
  const alto = img.naturalHeight || img.height;

  const lienzo = document.createElement("canvas");
  lienzo.width = ancho;
  lienzo.height = alto;

  const pincel = lienzo.getContext("2d", { willReadFrequently: true });
  if (!pincel) throw new Error("sin lienzo 2d");

  pincel.drawImage(img, 0, 0);

  const mapa = pincel.getImageData(0, 0, ancho, alto);
  const fondoQuitado = quitaFondo(mapa.data, ancho, alto);
  const caja = recorte(mapa.data, ancho, alto);

  /* Un escudo entero de borde a borde no se recorta: devolverlo tal cual. */
  const destino = document.createElement("canvas");
  destino.width = caja?.ancho ?? ancho;
  destino.height = caja?.alto ?? alto;

  const pincel2 = destino.getContext("2d");
  if (!pincel2) throw new Error("sin lienzo 2d");

  const fuente = document.createElement("canvas");
  fuente.width = ancho;
  fuente.height = alto;
  fuente.getContext("2d")!.putImageData(mapa, 0, 0);

  pincel2.drawImage(
    fuente,
    caja?.x ?? 0,
    caja?.y ?? 0,
    destino.width,
    destino.height,
    0,
    0,
    destino.width,
    destino.height,
  );

  return {
    ...uno,
    png: destino.toDataURL("image/png"),
    ancho: destino.width,
    alto: destino.height,
    fondoQuitado,
  };
}

/* ------------------------------------------------------------------ */
/*  EL DOCUMENTO                                                       */
/* ------------------------------------------------------------------ */

const TINTA_TITULO = "#F7F4EC";
const TINTA_NOMBRE = "#E4CE9B";

/** De píxeles del lienzo a tanto por uno de la diapositiva. */
const px = (x: number, y: number, w: number, h: number) => ({
  x: x / LIENZO_ANCHO,
  y: y / LIENZO_ALTO,
  w: w / LIENZO_ANCHO,
  h: h / LIENZO_ALTO,
});

/**
 * Coloca una tanda de escudos en su hoja.
 *
 * El escudo se mete en una casilla cuadrada **respetando su forma**: los hay
 * redondos y los hay apuntados, y estirarlos para que todos midan igual es la
 * manera más rápida de que un escudo parezca falso.
 */
function hojaDeEscudos(
  tanda: EscudoListo[],
  titulo: string,
  subtitulo: string,
): DiapositivaPptx {
  const capas: CapaPptx[] = [];

  capas.push({
    nombre: "Título",
    ...px(72, 52, 1400, 60),
    texto: {
      contenido: titulo,
      tamano: 50,
      tinta: TINTA_TITULO,
      peso: 700,
      espaciado: 3,
    },
  });

  capas.push({
    nombre: "Pie del título",
    ...px(72, 116, 1400, 36),
    texto: {
      contenido: subtitulo,
      tamano: 26,
      tinta: TINTA_NOMBRE,
      peso: 500,
      espaciado: 2,
    },
  });

  /* La rejilla: de y=186 a y=1040, y todo el ancho menos los márgenes. */
  const izquierda = 72;
  const arriba = 196;
  const anchoCasilla = (LIENZO_ANCHO - izquierda * 2) / COLUMNAS;
  const altoCasilla = (1040 - arriba) / FILAS;

  /* Dentro de la casilla: el cuadrado del escudo arriba y el nombre debajo. */
  const LADO = 152;
  const ALTO_NOMBRE = 34;

  tanda.forEach((escudo, indice) => {
    const columna = indice % COLUMNAS;
    const fila = Math.floor(indice / COLUMNAS);

    const centroX = izquierda + anchoCasilla * (columna + 0.5);
    const cajaY = arriba + altoCasilla * fila + 6;

    /* Se encaja en el cuadrado sin deformarlo. */
    const escala = Math.min(LADO / escudo.ancho, LADO / escudo.alto);
    const w = escudo.ancho * escala;
    const h = escudo.alto * escala;

    capas.push({
      nombre: escudo.equipo,
      imagen: escudo.png,
      ...px(centroX - w / 2, cajaY + (LADO - h) / 2, w, h),
    });

    /*
    | El nombre va en su propia caja de texto, así que se puede corregir en
    | PowerPoint o borrar de golpe si el escudo se quiere solo. La caja no
    | ajusta el texto al ancho —PowerPoint la deja del tamaño de la letra—, así
    | que se centra a mano poniéndola centrada en la casilla.
    */
    capas.push({
      nombre: `Nombre · ${escudo.equipo}`,
      ...px(
        centroX - anchoCasilla / 2,
        cajaY + LADO + 10,
        anchoCasilla,
        ALTO_NOMBRE,
      ),
      texto: {
        contenido: escudo.equipo.toUpperCase(),
        tamano: 24,
        tinta: TINTA_NOMBRE,
        peso: 600,
        espaciado: 2,
        alinea: "centro",
      },
    });
  });

  return { titulo, capas };
}

/**
 * El documento entero: una hoja por cada veinte escudos.
 *
 * Con los veinte del grupo son dos hojas sólo si la liga creciera; hoy cabe
 * todo en una, que es lo que se pidió.
 */
export function creaPptEscudos(listos: EscudoListo[], cuando = new Date()): Blob {
  const hojas: DiapositivaPptx[] = [];

  for (let desde = 0; desde < listos.length; desde += POR_HOJA) {
    const tanda = listos.slice(desde, desde + POR_HOJA);

    const parte = listos.length > POR_HOJA ? ` (${desde / POR_HOJA + 1})` : "";

    hojas.push(
      hojaDeEscudos(
        tanda,
        `ESCUDOS DE LA LIGA${parte}`,
        `${listos.length} equipos · PNG con transparencia · cada escudo es un objeto suelto: se copia y se pega`,
      ),
    );
  }

  return creaPptx(hojas, {
    titulo: "Escudos de la liga",
    aplicacion: "RMCF Castilla · Escudos de la liga",
    cuando,
  });
}

export function nombreDelFichero(cuando = new Date()) {
  const dia = cuando.toISOString().slice(0, 10);

  return `escudos-liga-${dia}.pptx`;
}
