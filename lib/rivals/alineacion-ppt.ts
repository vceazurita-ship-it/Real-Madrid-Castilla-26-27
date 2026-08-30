/*
|--------------------------------------------------------------------------
| CAMPOGRAMA DE DÍA DE PARTIDO (.pptx)
|--------------------------------------------------------------------------
|
| La plantilla entera del rival colocada en el campo, en una diapositiva, y
| **cada jugador como una imagen suelta de PowerPoint**.
|
| Eso último es el motivo de que exista el documento. Cuando se cruzan
| alineaciones —media hora antes, en el vestuario o en el autobús— no hay
| tiempo de montar nada: se abre el .pptx, se borra a los que no salen y lo que
| queda en pantalla es el once del rival, cada uno en su sitio y con sus
| números. Por eso las fichas no van quemadas en una captura como en la pizarra
| de balón parado (`lib/export/pptx.ts` lo explica del otro lado): van como
| PNG con transparencia, uno por jugador, con su nombre puesto para que el
| panel de selección de PowerPoint diga a quién se está quitando.
|
| El reparto es el de `ALINEACION TENERIFE.pptx` —la plantilla que el cuerpo
| técnico montaba a mano— y el lenguaje visual es el de `INDIVIDUAL.pptx`, el
| mismo de la portada del jugador y del PDF del once: papel, verde, azul,
| crema, rosa y Barlow Condensed, todo en `lienzo-club.ts`.
|
| Como `once-pdf` y `portada`, esto **no sabe nada de la hoja ni del estado de
| la página**: recibe a los jugadores ya resueltos y sólo los coloca y los
| pinta.
*/

import { creaPptx, type CapaPptx } from "@/lib/export/pptx";
import { descarga } from "@/lib/export/lienzos";
import { esperaFuentePortada } from "@/lib/rivals/portada-font";

import {
  ajusta,
  anchoEspaciado,
  C,
  cargaImagen,
  centimetros,
  chapa,
  cubre,
  encaja,
  fuente,
  kilos,
  pieDominante,
  rectRedondo,
  textoEspaciado,
  type Ctx,
} from "@/lib/rivals/lienzo-club";

/* ------------------------------------------------------------------ */
/*  LO QUE RECIBE                                                      */
/* ------------------------------------------------------------------ */

export type AlineacionJugador = {
  /** `playerKey()`: la clave que ya usan el once y los recursos. */
  clave: string;
  dorsal: string;
  /** Nombre deportivo, el que va en la chapa. */
  nombre: string;
  /** Clave del slot del campograma: "dfc", "ei", "mcd"… */
  slot: string;
  /** -1 izquierda, 0 sin lado, 1 derecha. */
  lado: -1 | 0 | 1;
  edad: string;
  /** Tal y como lo escribe la hoja: se normaliza aquí. */
  pie: string;
  altura: string | number;
  peso: string | number;
  foto: string;
  /** "LESIONADO", "SANCIONADO"… Lo que no sea disponible se marca. */
  estado: string;
  /** BeSoccer le da columnas distintas: goles encajados en vez de goles. */
  portero: boolean;
  /** De la temporada que manda. `null` cuando no hay números. */
  titular: number | null;
  goles: number | null;
  encajados: number | null;
};

export type AlineacionData = {
  equipo: string;
  escudo?: string;
  /** "26 / 27". */
  temporada: string;
  /** "30 de agosto de 2026". */
  fecha: string;
  jugadores: AlineacionJugador[];
};

/* ------------------------------------------------------------------ */
/*  MEDIDAS                                                            */
/* ------------------------------------------------------------------ */

/** La diapositiva: 12192000×6858000 EMU a 6350 EMU por píxel. */
const W = 1920;
const H = 1080;

/** A cuánto se multiplican los lienzos. Igual que la portada: 2 llega a 4K. */
const ESCALA = 2;

/** La cabecera se queda con la franja de arriba; el resto es campo. */
const CABECERA = 132;

/** Dónde pueden caer las fichas. */
const ZONA = { x: 52, y: 146, w: W - 104, h: H - 146 - 46 };

/** La ficha a tamaño natural. El motor la encoge si la plantilla no cabe. */
const FICHA_W = 208;
const FICHA_H = 272;

/** Aire entre fichas de un mismo bloque y entre bloques. */
const HUECO = 14;
const HUECO_BLOQUE = 20;

/**
 * Hasta dónde se deja encoger la ficha.
 *
 * Por debajo de esto el nombre deja de leerse proyectado, y una plantilla de
 * treinta que no cabe es mejor apretarla —las fichas se rozan, pero se leen—
 * que dejarla ilegible. El apretón se nota en el campo y se arregla borrando
 * a cuatro, que es justo lo que se va a hacer con el documento delante.
 */
const ENCOGIDO_MINIMO = 0.62;

/*
| Ancla de cada slot en fracciones del campo, atacando **hacia arriba**. Son
| las mismas del campograma de pantalla: si allí un carrilero está a media
| altura, aquí tiene que estarlo también, o el documento y la pantalla dejan de
| contar lo mismo.
|
| `xSide` es cuánto se aparta a un lado cuando la posición trae lado
| ("interior derecho"); los slots que ya son de un lado no lo llevan.
*/
const ANCLAS: Record<string, { x: number; y: number; xSide?: number }> = {
  dc: { x: 0.5, y: 0.1, xSide: 0.16 },
  sd: { x: 0.5, y: 0.19, xSide: 0.16 },
  ei: { x: 0.12, y: 0.28 },
  ed: { x: 0.88, y: 0.28 },
  ext: { x: 0.5, y: 0.28, xSide: 0.38 },
  mp: { x: 0.5, y: 0.35, xSide: 0.16 },
  int: { x: 0.5, y: 0.47, xSide: 0.26 },
  mc: { x: 0.5, y: 0.5, xSide: 0.18 },
  med: { x: 0.5, y: 0.5, xSide: 0.18 },
  mcd: { x: 0.5, y: 0.63, xSide: 0.18 },
  car: { x: 0.5, y: 0.7, xSide: 0.4 },
  li: { x: 0.11, y: 0.79 },
  ld: { x: 0.89, y: 0.79 },
  dfc: { x: 0.5, y: 0.81, xSide: 0.15 },
  def: { x: 0.5, y: 0.81, xSide: 0.3 },
  por: { x: 0.5, y: 0.93 },
};

/** Quien no cae en ningún slot se queda en tierra de nadie, en el centro. */
const ANCLA_SUELTA = { x: 0.5, y: 0.56 };

/*
| Slots pegados a una banda. Su bloque se reparte **en profundidad** —hacia la
| portería contraria— en vez de hacia dentro del campo: tres laterales
| izquierdos apilados hacia el centro se comen el sitio del pivote, y en el
| documento eso es un solape con el bloque vecino.
*/
const SLOTS_DE_BANDA = new Set(["ei", "ed", "ext", "li", "ld", "car"]);

/* ------------------------------------------------------------------ */
/*  EL MOTOR DE COLOCACIÓN                                             */
/* ------------------------------------------------------------------ */

/**
 * Dónde acaba cada ficha, en **tanto por uno de la diapositiva**.
 *
 * Se devuelve así y no en píxeles porque quien lo consume es el `.pptx`, que
 * mide en EMU: la fracción es lo único que no hay que volver a convertir.
 */
export type Colocacion = {
  jugador: AlineacionJugador;
  x: number;
  y: number;
  w: number;
  h: number;
};

type Bloque = {
  key: string;
  jugadores: AlineacionJugador[];
  /** Rejilla del bloque: columnas en profundidad, filas a lo ancho del campo. */
  cols: number;
  filas: number;
  /** Dónde querría estar, en tanto por uno del campo tumbado. */
  campoX: number;
  campoY: number;
};

type Banda = {
  bloques: Bloque[];
  campoX: number;
};

/**
 * Reparte una fila de cajas entre `desde` y `hasta`: cada una lo más cerca
 * posible de donde querría estar, sin pisar a la anterior y sin salirse.
 *
 * Es el mismo `packRow` del campograma de pantalla, y por el mismo motivo: los
 * límites se encadenan desde los **dos** extremos —el mínimo de una caja sale
 * de lo que ocupan todas las anteriores y su máximo de lo que necesitan todas
 * las siguientes—. Empujar hacia un lado y recortar al final deja dos cajas en
 * la misma posición cuando la fila no cabe. Si no cabe, el hueco se encoge
 * —puede quedar negativo— y el apretón se reparte entre todas.
 */
function reparteFila(
  tamanos: number[],
  querido: number[],
  desde: number,
  hasta: number,
  hueco: number,
): number[] {
  const mitades = tamanos.map((valor) => valor / 2);

  const total = tamanos.reduce((suma, valor) => suma + valor, 0);

  const aire = Math.min(
    hueco,
    (hasta - desde - total) / Math.max(1, tamanos.length - 1),
  );

  const minimos: number[] = [];
  const maximos: number[] = [];

  mitades.forEach((mitad, indice) => {
    minimos[indice] =
      indice === 0
        ? desde + mitad
        : minimos[indice - 1] + mitades[indice - 1] + aire + mitad;
  });

  for (let indice = mitades.length - 1; indice >= 0; indice -= 1) {
    maximos[indice] =
      indice === mitades.length - 1
        ? hasta - mitades[indice]
        : maximos[indice + 1] - mitades[indice + 1] - aire - mitades[indice];
  }

  const centros: number[] = [];

  let siguienteMinimo = -Infinity;

  mitades.forEach((mitad, indice) => {
    const objetivo = Math.min(
      Math.max(querido[indice], minimos[indice]),
      maximos[indice],
    );

    centros[indice] = Math.max(objetivo, siguienteMinimo);

    siguienteMinimo = centros[indice] + mitad + aire + (mitades[indice + 1] ?? 0);
  });

  return centros;
}

/**
 * Forma de la rejilla de un bloque: cuántas columnas quiere.
 *
 * En banda se reparte a lo largo de la línea de cal —en profundidad—, que es
 * donde hay sitio; en el centro del campo se apila a lo ancho, que es lo que
 * deja la fila del once tal y como se lee.
 *
 * **La columna se corta en tres.** Cuatro centrales en fila vertical estiran
 * su banda hasta el alto entero de la diapositiva, y entonces todo el campo
 * tiene que encogerse por ese bloque: una plantilla de 22 salía más pequeña
 * que una de 25 y con cuatro solapes. A partir del cuarto se abre una segunda
 * columna, que cuesta ancho —del que sobra— en vez de alto.
 */
function forma(cuantos: number, banda: boolean) {
  const cols = banda
    ? Math.min(cuantos, 3)
    : cuantos <= 3
      ? 1
      : cuantos <= 6
        ? 2
        : 3;

  return { cols, filas: Math.ceil(cuantos / cols) };
}

/**
 * Coloca a toda la plantilla.
 *
 * El campo se pinta **tumbado y atacando hacia la derecha**, que es la vista
 * de televisión y la que cabe en un 16:9. Las anclas están escritas de pie, así
 * que se giran: la profundidad del ataque pasa a ser la X (`1 - ancla.y`) y el
 * ancho del campo pasa a ser la Y (`ancla.x`). Con eso, la banda izquierda
 * queda arriba, como en la tele.
 */
export function reparteAlineacion(jugadores: AlineacionJugador[]): {
  fichas: Colocacion[];
  /** Cuánto se ha tenido que encoger la ficha para que cupiera todo. */
  k: number;
} {
  if (jugadores.length === 0) return { fichas: [], k: 1 };

  /* 1 · Un bloque por posición (slot + lado). */

  const porClave = new Map<string, Bloque>();

  for (const jugador of jugadores) {
    const ancla = ANCLAS[jugador.slot] ?? ANCLA_SUELTA;

    const lado = ancla.xSide ? jugador.lado : 0;
    const clave = `${jugador.slot}:${lado}`;

    const existente = porClave.get(clave);

    if (existente) {
      existente.jugadores.push(jugador);
      continue;
    }

    const anchoDeCampo = ancla.x + (ancla.xSide ?? 0) * lado;

    porClave.set(clave, {
      key: clave,
      jugadores: [jugador],
      cols: 1,
      filas: 1,
      /* El giro: la profundidad manda en X y el ancho del campo, en Y. */
      campoX: 1 - ancla.y,
      campoY: Math.min(0.94, Math.max(0.06, anchoDeCampo)),
    });
  }

  const bloques = [...porClave.values()];

  for (const bloque of bloques) {
    const banda = SLOTS_DE_BANDA.has(bloque.key.split(":")[0]);
    const rejilla = forma(bloque.jugadores.length, banda);

    bloque.cols = rejilla.cols;
    bloque.filas = rejilla.filas;

    /* Dentro del bloque manda el dorsal: el 1 antes que el 25. */
    bloque.jugadores.sort(
      (a, b) => (Number(a.dorsal) || 99) - (Number(b.dorsal) || 99),
    );
  }

  /* 2 · Bandas: bloques a profundidad parecida comparten columna. */

  const bandas: Banda[] = [];

  for (const bloque of [...bloques].sort((a, b) => a.campoX - b.campoX)) {
    const ultima = bandas[bandas.length - 1];

    if (ultima && Math.abs(bloque.campoX - ultima.campoX) <= 0.055) {
      ultima.bloques.push(bloque);

      /* La banda se queda en la media de los suyos, no en la del primero. */
      ultima.campoX =
        ultima.bloques.reduce((suma, uno) => suma + uno.campoX, 0) /
        ultima.bloques.length;

      continue;
    }

    bandas.push({ bloques: [bloque], campoX: bloque.campoX });
  }

  /* 3 · Cuánto hay que encoger la ficha para que quepa todo. */

  const anchoBloque = (bloque: Bloque, k: number) =>
    bloque.cols * FICHA_W * k + (bloque.cols - 1) * HUECO * k;

  const altoBloque = (bloque: Bloque, k: number) =>
    bloque.filas * FICHA_H * k + (bloque.filas - 1) * HUECO * k;

  const anchoBanda = (banda: Banda, k: number) =>
    Math.max(...banda.bloques.map((bloque) => anchoBloque(bloque, k)));

  const altoBanda = (banda: Banda, k: number) =>
    banda.bloques.reduce((suma, bloque) => suma + altoBloque(bloque, k), 0) +
    (banda.bloques.length - 1) * HUECO_BLOQUE * k;

  const anchoTotal =
    bandas.reduce((suma, banda) => suma + anchoBanda(banda, 1), 0) +
    (bandas.length - 1) * HUECO_BLOQUE;

  const altoMayor = Math.max(...bandas.map((banda) => altoBanda(banda, 1)));

  /*
  | El ancho y el alto escalan igual de linealmente, así que no hace falta
  | buscar por bisección: el factor que cabe es el menor de los dos, y nunca
  | más de 1 —la ficha no se agranda por sobrar sitio, que la dejaría enorme
  | en una plantilla de trece—.
  */
  const k = Math.max(
    ENCOGIDO_MINIMO,
    Math.min(1, ZONA.w / anchoTotal, ZONA.h / altoMayor),
  );

  /* 4 · Las bandas, repartidas a lo largo del campo. */

  const centrosX = reparteFila(
    bandas.map((banda) => anchoBanda(banda, k)),
    bandas.map((banda) => ZONA.x + banda.campoX * ZONA.w),
    ZONA.x,
    ZONA.x + ZONA.w,
    HUECO_BLOQUE * k,
  );

  const fichas: Colocacion[] = [];

  bandas.forEach((banda, indiceBanda) => {
    const centroX = centrosX[indiceBanda];

    /* 5 · Los bloques de la banda, repartidos a lo ancho del campo. */

    const centrosY = reparteFila(
      banda.bloques.map((bloque) => altoBloque(bloque, k)),
      banda.bloques.map((bloque) => ZONA.y + bloque.campoY * ZONA.h),
      ZONA.y,
      ZONA.y + ZONA.h,
      HUECO_BLOQUE * k,
    );

    banda.bloques.forEach((bloque, indiceBloque) => {
      const centroY = centrosY[indiceBloque];

      const alto = altoBloque(bloque, k);

      bloque.jugadores.forEach((jugador, indice) => {
        const columna = indice % bloque.cols;
        const fila = Math.floor(indice / bloque.cols);

        /*
        | La última fila puede ir a medias —cinco en una rejilla de dos—, así
        | que se centra sola en vez de dejar un hueco a la derecha.
        */
        const enLaFila = Math.min(
          bloque.cols,
          bloque.jugadores.length - fila * bloque.cols,
        );

        const anchoFila = enLaFila * FICHA_W * k + (enLaFila - 1) * HUECO * k;

        const x =
          centroX -
          anchoFila / 2 +
          columna * (FICHA_W + HUECO) * k;

        const y =
          centroY - alto / 2 + fila * (FICHA_H + HUECO) * k;

        fichas.push({
          jugador,
          x: x / W,
          y: y / H,
          w: (FICHA_W * k) / W,
          h: (FICHA_H * k) / H,
        });
      });
    });
  });

  /*
  | De arriba abajo: en PowerPoint la última capa va delante, así que la ficha
  | de más abajo tapa a la de más arriba. Es lo que hace la profundidad de
  | campo en una foto de equipo, y evita que un solape se lea como un error.
  */
  fichas.sort((a, b) => a.y - b.y);

  return { fichas, k };
}

/* ------------------------------------------------------------------ */
/*  EL CAMPO                                                           */
/* ------------------------------------------------------------------ */

/** Un lienzo del tamaño pedido, ya escalado y con el suavizado puesto. */
function lienzo(ancho: number, alto: number) {
  const canvas = document.createElement("canvas");

  canvas.width = Math.round(ancho * ESCALA);
  canvas.height = Math.round(alto * ESCALA);

  const ctx = canvas.getContext("2d");

  if (!ctx) throw new Error("El navegador no ha dado lienzo.");

  ctx.scale(ESCALA, ESCALA);
  ctx.imageSmoothingQuality = "high";
  ctx.textBaseline = "alphabetic";

  return { canvas, ctx };
}

/**
 * El césped, las líneas y la cabecera.
 *
 * El campo va tumbado y atacando hacia la derecha —la portería del rival, a la
 * derecha—, que es como se lee una alineación en la tele y lo que cabe en una
 * diapositiva 16:9. Las líneas van en crema y translúcidas: son referencia,
 * no dibujo, y a plena opacidad le quitan protagonismo a las caras.
 */
function pintaCampo(ctx: Ctx, data: AlineacionData, escudo: HTMLImageElement | null) {
  ctx.fillStyle = C.verde;
  ctx.fillRect(0, 0, W, H);

  /* Las franjas de corte del césped: casi no se ven, y sin ellas el verde
     plano parece un error de exportación. */
  ctx.fillStyle = "rgba(255,255,255,0.022)";

  const FRANJAS = 12;

  for (let i = 0; i < FRANJAS; i += 2) {
    ctx.fillRect((i * W) / FRANJAS, 0, W / FRANJAS, H);
  }

  /* -------------------------------------------------- las líneas */

  const campo = { x: 44, y: CABECERA + 4, w: W - 88, h: H - CABECERA - 48 };

  ctx.strokeStyle = "rgba(247,244,236,0.30)";
  ctx.lineWidth = 3;

  ctx.strokeRect(campo.x, campo.y, campo.w, campo.h);

  const medioX = campo.x + campo.w / 2;
  const medioY = campo.y + campo.h / 2;

  ctx.beginPath();
  ctx.moveTo(medioX, campo.y);
  ctx.lineTo(medioX, campo.y + campo.h);
  ctx.stroke();

  ctx.beginPath();
  ctx.arc(medioX, medioY, campo.h * 0.135, 0, Math.PI * 2);
  ctx.stroke();

  ctx.beginPath();
  ctx.arc(medioX, medioY, 6, 0, Math.PI * 2);
  ctx.fillStyle = "rgba(247,244,236,0.30)";
  ctx.fill();

  /* Las dos áreas, medidas sobre el ancho del campo como en un campo real. */
  const areaW = campo.w * 0.115;
  const areaH = campo.h * 0.58;
  const chicaW = campo.w * 0.04;
  const chicaH = campo.h * 0.26;

  for (const lado of [-1, 1] as const) {
    const borde = lado === -1 ? campo.x : campo.x + campo.w;

    ctx.strokeRect(
      lado === -1 ? borde : borde - areaW,
      medioY - areaH / 2,
      areaW,
      areaH,
    );

    ctx.strokeRect(
      lado === -1 ? borde : borde - chicaW,
      medioY - chicaH / 2,
      chicaW,
      chicaH,
    );

    const punto = borde + lado * areaW * 0.66;

    ctx.beginPath();
    ctx.arc(punto, medioY, 5, 0, Math.PI * 2);
    ctx.fill();
  }

  /* -------------------------------------------------- la cabecera */

  ctx.fillStyle = "rgba(4,18,31,0.55)";
  ctx.fillRect(0, 0, W, CABECERA);

  const MARGEN = 52;

  if (escudo) encaja(ctx, escudo, MARGEN, 18, 96, 96);

  const x = MARGEN + (escudo ? 116 : 0);

  const club = (data.equipo || "Rival").toUpperCase();

  const cuerpo = ajusta(ctx, club, W - x - 560, 54, 700, 1.6);

  ctx.fillStyle = C.crema;
  textoEspaciado(ctx, club, x, 62 + cuerpo * 0.36, 1.6);

  chapa(ctx, `PLANTILLA ${data.temporada}`, {
    x,
    y: 82,
    alto: 34,
    fondo: C.rosa,
    tinta: C.navy,
    tamano: 18,
    espaciado: 3.5,
    padding: 18,
  });

  chapa(ctx, "DÍA DE PARTIDO", {
    x: W - MARGEN,
    y: 34,
    alto: 38,
    fondo: C.crema,
    tinta: C.verde,
    tamano: 20,
    espaciado: 4,
    padding: 24,
    desdeDerecha: true,
  });

  fuente(ctx, 21, 500);
  ctx.fillStyle = "rgba(247,244,236,0.55)";
  ctx.textAlign = "right";
  ctx.fillText(data.fecha.toUpperCase(), W - MARGEN, 104);
  ctx.textAlign = "left";

  ctx.fillStyle = C.rosa;
  ctx.fillRect(0, CABECERA - 4, W, 4);

  /* -------------------------------------------------- el pie */

  /*
  | El aviso de la izquierda no es un adorno: quien abre el fichero por primera
  | vez no tiene por qué saber que cada ficha es un objeto suelto, y ése es
  | justo el truco del documento. Va pequeño y translúcido —debajo de las
  | fichas, no compitiendo con ellas— y se borra como todo lo demás.
  */
  fuente(ctx, 17, 500);
  ctx.fillStyle = "rgba(247,244,236,0.30)";
  ctx.fillText(
    "CADA JUGADOR ES UNA IMAGEN SUELTA · BORRA A LOS QUE NO SALGAN Y QUEDA EL ONCE",
    MARGEN,
    H - 18,
  );

  ctx.textAlign = "right";
  ctx.fillText("RMCF CASTILLA", W - MARGEN, H - 18);
  ctx.textAlign = "left";
}

/* ------------------------------------------------------------------ */
/*  LA FICHA DE UN JUGADOR                                             */
/* ------------------------------------------------------------------ */

/** Las cuatro líneas de números, las mismas del pptx que se copiaba a mano. */
function lineasDeFicha(jugador: AlineacionJugador) {
  const lineas: string[] = [];

  const pie = pieDominante(jugador.pie);

  if (pie) lineas.push(pie);

  if (jugador.titular !== null) lineas.push(`PJ TITULAR: ${jugador.titular}`);

  const cm = centimetros(jugador.altura);
  const kg = kilos(jugador.peso);

  if (cm || kg) {
    lineas.push([cm ? `${cm}` : "", kg ? `${kg}KG` : ""].filter(Boolean).join("-"));
  }

  /*
  | El cero no se escribe: en una ficha de cuatro renglones, «GOLES: 0» ocupa
  | el sitio de un dato y no dice nada que no diga su ausencia. Los encajados
  | de un portero sí, que ahí el cero es la noticia.
  */
  if (jugador.portero) {
    if (jugador.encajados !== null) lineas.push(`ENCAJADOS: ${jugador.encajados}`);
  } else if (jugador.goles !== null && jugador.goles > 0) {
    lineas.push(`GOLES: ${jugador.goles}`);
  }

  return lineas.slice(0, 4);
}

/**
 * Lo que se marca de un jugador que hoy no está.
 *
 * El pptx original le ponía una X roja encima. Aquí es una chapa con la
 * palabra: proyectada, una X se confunde con el aspa de un dorsal tachado, y
 * «SANCIONADO» y «LESIONADO» no significan lo mismo cuando se decide a quién
 * se estudia.
 */
function baja(estado: string) {
  const limpio = estado.trim().toUpperCase();

  if (!limpio || limpio === "." || /DISPONIBLE|ALTA|OK/.test(limpio)) return "";

  return limpio.slice(0, 18);
}

/** Pinta la ficha en su propio lienzo transparente y la devuelve en PNG. */
function pintaFicha(
  jugador: AlineacionJugador,
  retrato: HTMLImageElement | null,
  ancho: number,
  alto: number,
) {
  const { canvas, ctx } = lienzo(ancho, alto);

  /* Todo está pensado a tamaño natural: se escala una vez y ya. */
  const k = ancho / FICHA_W;

  ctx.scale(k, k);

  /* -------------------------------------------------- el panel */

  ctx.fillStyle = "rgba(247,244,236,0.96)";
  rectRedondo(ctx, 0, 0, FICHA_W, FICHA_H, 18);
  ctx.fill();

  /* El filo rosa de la casa, arriba: es lo que ata la ficha al INDIVIDUAL. */
  ctx.save();
  rectRedondo(ctx, 0, 0, FICHA_W, FICHA_H, 18);
  ctx.clip();
  ctx.fillStyle = C.rosa;
  ctx.fillRect(0, 0, FICHA_W, 6);
  ctx.restore();

  /* -------------------------------------------------- el retrato */

  const FOTO = { x: 50, y: 14, w: 108, h: 116 };

  ctx.save();
  rectRedondo(ctx, FOTO.x, FOTO.y, FOTO.w, FOTO.h, 12);
  ctx.clip();

  ctx.fillStyle = C.papel;
  ctx.fillRect(FOTO.x, FOTO.y, FOTO.w, FOTO.h);

  if (retrato) {
    /* El retrato de BeSoccer es un busto cuadrado: el encuadre se sube para
       que lo que se recorte sea el pecho y no la frente. */
    cubre(ctx, retrato, FOTO.x, FOTO.y, FOTO.w, FOTO.h, 0.12);
  } else {
    ctx.fillStyle = "rgba(15,30,61,0.10)";
    ctx.fillRect(FOTO.x, FOTO.y, FOTO.w, FOTO.h);

    fuente(ctx, 44, 700);
    ctx.fillStyle = "rgba(15,30,61,0.35)";
    ctx.textAlign = "center";
    ctx.fillText(
      (jugador.nombre[0] ?? "?").toUpperCase(),
      FOTO.x + FOTO.w / 2,
      FOTO.y + FOTO.h / 2 + 16,
    );
    ctx.textAlign = "left";
  }

  ctx.restore();

  /* -------------------------------------------------- el dorsal */

  if (jugador.dorsal) {
    const D = 40;

    ctx.fillStyle = C.navy;
    ctx.beginPath();
    ctx.arc(FOTO.x + FOTO.w - 4, FOTO.y + FOTO.h - 10, D / 2, 0, Math.PI * 2);
    ctx.fill();

    fuente(ctx, jugador.dorsal.length > 2 ? 18 : 22, 700);
    ctx.fillStyle = C.crema;
    ctx.textAlign = "center";
    ctx.fillText(
      jugador.dorsal,
      FOTO.x + FOTO.w - 4,
      FOTO.y + FOTO.h - 10 + (jugador.dorsal.length > 2 ? 6 : 8),
    );
    ctx.textAlign = "left";
  }

  /* -------------------------------------------------- la baja */

  const marca = baja(jugador.estado);

  if (marca) {
    chapa(ctx, marca, {
      x: FICHA_W / 2,
      y: 12,
      alto: 24,
      fondo: C.rosaHondo,
      tinta: C.navy,
      tamano: 15,
      espaciado: 2,
      padding: 12,
      anchoMax: FICHA_W - 16,
      desdeCentro: true,
    });
  }

  /* -------------------------------------------------- el nombre */

  const edad = jugador.edad.trim();

  chapa(ctx, `${jugador.nombre.toUpperCase()}${edad ? ` (${edad})` : ""}`, {
    x: FICHA_W / 2,
    y: 136,
    alto: 30,
    fondo: C.verde,
    tinta: C.crema,
    tamano: 20,
    espaciado: 1.4,
    padding: 12,
    anchoMax: FICHA_W - 12,
    anchoMin: FICHA_W - 12,
    desdeCentro: true,
  });

  /* -------------------------------------------------- los números */

  const lineas = lineasDeFicha(jugador);

  /*
  | Aquí NO vale `ctx.textAlign = "center"`: `textoEspaciado` pinta letra a
  | letra, y centrado cada letra se centraría sobre su propio cursor —salía
  | «D IESTRO» y «PJ T ITULAR»—. Se centra a mano con el ancho medido, que es
  | además el único que cuenta el espaciado entre letras.
  */
  ctx.textAlign = "left";
  ctx.fillStyle = C.navy;

  const ARRIBA = 174;
  const ABAJO = FICHA_H - 10;

  const ESPACIADO = 0.8;

  /*
  | El interlineado no se estira para llenar la ficha: con dos renglones —un
  | juvenil recién subido, sin números— quedaban uno arriba y otro pegado al
  | borde de abajo, como si faltara algo. Se pinta el bloque a su paso natural
  | y se centra en el hueco, que es lo que hace la plantilla a mano.
  */
  const paso = Math.min(24, (ABAJO - ARRIBA) / Math.max(1, lineas.length));

  const primera =
    ARRIBA + (ABAJO - ARRIBA - paso * lineas.length) / 2;

  lineas.forEach((linea, indice) => {
    /* El cuerpo no puede pasar del paso: con cuatro líneas se tocarían. */
    const cuerpo = ajusta(
      ctx,
      linea,
      FICHA_W - 24,
      Math.min(21, Math.floor(paso - 3)),
      600,
      ESPACIADO,
    );

    const ancho = anchoEspaciado(ctx, linea, ESPACIADO);

    textoEspaciado(
      ctx,
      linea,
      (FICHA_W - ancho) / 2,
      primera + paso * indice + cuerpo * 0.86,
      ESPACIADO,
    );
  });

  return canvas.toDataURL("image/png");
}

/* ------------------------------------------------------------------ */
/*  EL DOCUMENTO                                                       */
/* ------------------------------------------------------------------ */

/** Un nombre de fichero que se pueda buscar en una carpeta de diecinueve. */
function nombreArchivo(data: AlineacionData) {
  const equipo = (data.equipo || "rival")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-zA-Z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .toLowerCase();

  return `alineacion-${equipo}.pptx`;
}

/**
 * Monta el `.pptx` y lo descarga. Devuelve cómo se ha llamado.
 *
 * Las fotos se piden **de seis en seis**: veinticinco `fetch` a la vez contra
 * el proxy hacen que alguno se caiga por tiempo de espera, y una ficha sin
 * cara en el vestuario es una ficha que no sirve.
 */
export async function exportAlineacionPptx(data: AlineacionData) {
  await esperaFuentePortada();

  const { fichas, k } = reparteAlineacion(data.jugadores);

  if (fichas.length === 0) {
    throw new Error("Esta plantilla no tiene jugadores que colocar.");
  }

  const escudo = data.escudo ? await cargaImagen(data.escudo) : null;

  const retratos = new Map<string, HTMLImageElement | null>();

  const conFoto = data.jugadores.filter((jugador) => jugador.foto);

  const TANDA = 6;

  for (let i = 0; i < conFoto.length; i += TANDA) {
    const tanda = conFoto.slice(i, i + TANDA);

    const cargadas = await Promise.all(
      tanda.map((jugador) => cargaImagen(jugador.foto).catch(() => null)),
    );

    tanda.forEach((jugador, indice) => {
      retratos.set(jugador.clave, cargadas[indice]);
    });
  }

  /* -------------------------------------------------- el fondo */

  const campo = lienzo(W, H);

  pintaCampo(campo.ctx, data, escudo);

  /* -------------------------------------------------- las fichas */

  const capas: CapaPptx[] = fichas.map((ficha) => ({
    nombre: `${ficha.jugador.dorsal ? `Nº${ficha.jugador.dorsal} · ` : ""}${
      ficha.jugador.nombre
    }`,
    imagen: pintaFicha(
      ficha.jugador,
      retratos.get(ficha.jugador.clave) ?? null,
      FICHA_W * k,
      FICHA_H * k,
    ),
    x: ficha.x,
    y: ficha.y,
    w: ficha.w,
    h: ficha.h,
  }));

  const blob = creaPptx(
    [
      {
        titulo: `${data.equipo} · día de partido`,
        /* JPEG para el césped —pesa un tercio— y PNG para las caras, que
           necesitan la transparencia. */
        imagen: campo.canvas.toDataURL("image/jpeg", 0.92),
        capas,
      },
    ],
    {
      titulo: `Alineación · ${data.equipo}`,
      aplicacion: "RMCF Castilla · Campograma de día de partido",
    },
  );

  const nombre = nombreArchivo(data);

  descarga(blob, nombre);

  return nombre;
}
