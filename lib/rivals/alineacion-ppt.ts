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
  ANCLAS_SLOT,
  columnasDeBanda,
  columnasDeBloque,
  dibujoDeCampo,
  reparteCampograma,
  reparteEnOnce,
  type BloqueEntrada,
} from "@/lib/rivals/campograma-motor";

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
  jugadores: AlineacionJugador[];
  /**
   * Con qué dibujo se reparte la plantilla ("4-2-3-1", "3-5-2"…).
   *
   * Viene de la pantalla y no se decide aquí: el documento existe para
   * llevarse a la reunión lo que ya se ha mirado, y con otro esqueleto sería
   * otra plantilla.
   */
  dibujo?: string;
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
export const FICHA_W = 208;
export const FICHA_H = 272;

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

/* ------------------------------------------------------------------ */
/*  DÓNDE VA CADA UNO                                                  */
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

/**
 * Coloca a toda la plantilla, con **el mismo motor que el campograma de
 * pantalla** (`lib/rivals/campograma-motor.ts`).
 *
 * Eso es el punto: quien estudia al rival en `/rivals` y luego abre este
 * documento tiene que encontrarse la plantilla colocada igual —los mismos
 * bloques, en las mismas bandas y en el mismo orden—, porque el documento
 * existe para llevarse a la reunión lo que ya se ha mirado en pantalla. Antes
 * eran dos motores parecidos con números distintos y no coincidían.
 *
 * Lo único que cambia son las medidas de la ficha: la de pantalla es una foto
 * redonda con el nombre debajo (más ancha que alta) y ésta es un cartón de
 * 208×272 con retrato, dorsal y cuatro renglones. El motor recibe esas medidas
 * como funciones del tamaño porque busca por bisección el más grande que cabe.
 *
 * El campo se pinta **tumbado y atacando hacia la derecha**, que es la vista de
 * televisión y la que cabe en un 16:9; es la misma orientación que toma el
 * campograma de pantalla en un portátil.
 */
export function reparteAlineacion(
  jugadores: AlineacionJugador[],
  /** El dibujo elegido para ese rival. Sin él, el de siempre. */
  dibujo?: string,
): {
  fichas: Colocacion[];
  /** Cuánto se ha tenido que encoger la ficha para que cupiera todo. */
  k: number;
} {
  if (jugadores.length === 0) return { fichas: [], k: 1 };

  /*
  | 1 · Los bloques del dibujo elegido, los mismos que la pantalla.
  |
  | Este documento existe para llevarse a la reunión lo que ya se ha mirado en
  | `app/rivals`: si aquí se agrupara de otra forma, sería otra plantilla. Por
  | eso el dibujo viaja con los datos y no se decide aquí.
  */

  const bloques = dibujoDeCampo(dibujo);

  const porBloque = reparteEnOnce(
    jugadores,
    (jugador) => ({
      slot: jugador.slot,
      lado: ANCLAS_SLOT[jugador.slot]?.xSide ? jugador.lado : 0,
    }),
    bloques,
  );

  const entradas: BloqueEntrada<AlineacionJugador>[] = [];

  for (const bloque of bloques) {
    const gente = porBloque.get(bloque.key);

    if (!gente || gente.length === 0) continue;

    entradas.push({
      key: bloque.key,
      anchorX: bloque.anchorX,
      anchorY: bloque.anchorY,
      banda: bloque.banda,
      /* Las chapas de IMPACTO son cosa de la pantalla: aquí no hay ficha alta
         ni ficha baja, todas miden lo mismo. */
      etiquetado: false,
      jugadores: gente,
      anchoChapa: 0,
    });
  }

  /* Dentro del bloque manda el dorsal: el 1 antes que el 25. */
  for (const bloque of entradas) {
    bloque.jugadores.sort(
      (a, b) => (Number(a.dorsal) || 99) - (Number(b.dorsal) || 99),
    );
  }

  /* 2 · El reparto, con la ficha de cartón por medida. */

  /*
  | Todo lo que en pantalla es un número fijo de píxeles aquí se escala con la
  | ficha: la diapositiva es tres veces más grande que el campo de un portátil,
  | y un hueco de 14 px entre dos cartones de 208 no se ve si la ficha se
  | encoge a la mitad y el hueco no.
  */
  const escalado = (medida: number) => (tamano: number) =>
    (medida * tamano) / FICHA_W;

  const reparto = reparteCampograma(entradas, {
    ancho: ZONA.w,
    alto: ZONA.h,
    horizontal: true,
    /* La zona ya viene recortada por la cabecera y el pie: aquí no sobra nada. */
    padAncho: 0,
    padAlto: 0,
    /* En pantalla cada bloque lleva encima una chapa con su posición; aquí no,
       que la posición ya la dice el sitio y la ficha trae el nombre. */
    chapaAlto: () => 0,
    huecoFila: escalado(HUECO),
    huecoBanda: escalado(HUECO_BLOQUE),
    huecoBloque: escalado(HUECO_BLOQUE),
    paso: (tamano) => tamano + escalado(HUECO)(tamano),
    altoFicha: (tamano) => (tamano * FICHA_H) / FICHA_W,
    /* El mismo margen fino que usa la pantalla tumbada: una banda es una
       COLUMNA, y partirla reparte a su gente en dos columnas más cortas. */
    margenBanda: 0.03,
    busquedaMin: 1,
    /* La ficha no se agranda por sobrar sitio: quedaría enorme en una
       plantilla de trece. */
    busquedaMax: FICHA_W,
    suelo: FICHA_W * ENCOGIDO_MINIMO,
    opcionesColumnas: [3, 2, 1],
    columnasDeBanda,
    columnasDeBloque,
    huecoChapa: 0,
  });

  const anchoFicha = reparto.tamano;
  const altoFicha = reparto.altoFicha;

  const fichas: Colocacion[] = reparto.fichas.map((ficha) => ({
    jugador: ficha.item,
    /* El motor reparte dentro de la zona y devuelve centros; la diapositiva
       quiere la esquina de arriba a la izquierda en tanto por uno. */
    x: (ZONA.x + ficha.x - anchoFicha / 2) / W,
    y: (ZONA.y + ficha.y - altoFicha / 2) / H,
    w: anchoFicha / W,
    h: altoFicha / H,
  }));

  /*
  | De arriba abajo: en PowerPoint la última capa va delante, así que la ficha
  | de más abajo tapa a la de más arriba. Es lo que hace la profundidad de
  | campo en una foto de equipo, y evita que un solape se lea como un error.
  */
  fichas.sort((a, b) => a.y - b.y);

  return { fichas, k: anchoFicha / FICHA_W };
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
  cespedTumbado(
    ctx,
    { x: 0, y: 0, w: W, h: H },
    { x: 44, y: CABECERA + 4, w: W - 88, h: H - CABECERA - 48 },
  );

  /* -------------------------------------------------- la cabecera */

  pintaCabeceraAlineacion(ctx, data, escudo);
}

/**
 * El césped tumbado con sus líneas: el fondo de un campograma de plantilla.
 *
 * Va aparte de la cabecera desde que el informe del rival
 * (`lib/rivals/informe-ppt.ts`) trae sus dos hojas de campograma —la plantilla
 * entera y el once probable—: allí la cabecera es la del informe, la misma de
 * las otras once hojas, pero el campo tiene que ser **este**, con las mismas
 * medidas y el mismo verde, o las dos versiones del mismo dibujo no se
 * parecerían.
 */
export function cespedTumbado(
  ctx: Ctx,
  fondo: { x: number; y: number; w: number; h: number },
  campo: { x: number; y: number; w: number; h: number },
) {
  ctx.fillStyle = C.verde;
  ctx.fillRect(fondo.x, fondo.y, fondo.w, fondo.h);

  /* Las franjas de corte del césped: casi no se ven, y sin ellas el verde
     plano parece un error de exportación. */
  ctx.fillStyle = "rgba(255,255,255,0.022)";

  const FRANJAS = 12;

  for (let i = 0; i < FRANJAS; i += 2) {
    ctx.fillRect(fondo.x + (i * fondo.w) / FRANJAS, fondo.y, fondo.w / FRANJAS, fondo.h);
  }

  /* -------------------------------------------------- las líneas */

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
}

/** La franja de arriba del campograma de día de partido. */
function pintaCabeceraAlineacion(
  ctx: Ctx,
  data: AlineacionData,
  escudo: HTMLImageElement | null,
) {
  ctx.fillStyle = "rgba(4,18,31,0.55)";
  ctx.fillRect(0, 0, W, CABECERA);

  const MARGEN = 52;

  if (escudo) encaja(ctx, escudo, MARGEN, 18, 96, 96);

  const x = MARGEN + (escudo ? 116 : 0);

  const club = (data.equipo || "Rival").toUpperCase();

  const cuerpo = ajusta(ctx, club, W - x - 560, 54, 700, 1.6);

  ctx.fillStyle = C.crema;
  textoEspaciado(ctx, club, x, 62 + cuerpo * 0.36, 1.6);

  chapa(ctx, `TEMPORADA ${data.temporada}`, {
    x,
    y: 82,
    alto: 34,
    fondo: C.rosa,
    tinta: C.navy,
    tamano: 18,
    espaciado: 3.5,
    padding: 18,
  });

  /*
  | La chapa se centra en la cabecera y no lleva fecha debajo. La llevaba —la
  | del día en que se exportaba— y le ponía caducidad a un documento que se
  | prepara la víspera y se abre el día del partido: al abrirlo parecía de
  | ayer. Lo que sitúa al documento en el tiempo es la temporada, que ya está
  | en la chapa de la izquierda.
  */
  chapa(ctx, "ALINEACIÓN RIVAL", {
    x: W - MARGEN,
    y: (CABECERA - 4 - 38) / 2,
    alto: 38,
    fondo: C.crema,
    tinta: C.verde,
    tamano: 20,
    espaciado: 4,
    padding: 24,
    desdeDerecha: true,
  });

  ctx.fillStyle = C.rosa;
  ctx.fillRect(0, CABECERA - 4, W, 4);

  /* -------------------------------------------------- el pie */

  /*
  | Sólo la firma. Aquí iba además un aviso explicando que cada ficha es un
  | objeto suelto que se puede borrar; fuera, porque el documento se proyecta
  | en la charla y una instrucción de manejo escrita en el césped se lee como
  | parte del análisis. Quien monta el once ya sabe cómo funciona.
  */
  fuente(ctx, 17, 500);
  ctx.fillStyle = "rgba(247,244,236,0.30)";
  ctx.textAlign = "right";
  ctx.fillText("RMCF CASTILLA", W - MARGEN, H - 18);
  ctx.textAlign = "left";
}

/* ------------------------------------------------------------------ */
/*  LA FICHA DE UN JUGADOR                                             */
/* ------------------------------------------------------------------ */

/**
 * Las cuatro líneas de números, las mismas del pptx que se copiaba a mano.
 *
 * Tres cuando la ficha lleva etiqueta de estado al pie: la píldora le quita
 * treinta píxeles a la franja, y repartir cuatro renglones en lo que queda los
 * deja a la mitad de cuerpo que los de las fichas de al lado. Una ficha que se
 * lee peor que sus vecinas canta más que un dato de menos, y el dato que se va
 * es el último —los goles—, que es el que la etiqueta ya está matizando.
 */
function lineasDeFicha(jugador: AlineacionJugador, tope = 4) {
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

  return lineas.slice(0, tope);
}

/**
 * Lo que se marca de un jugador que hoy no está entero.
 *
 * El pptx original le ponía una X roja encima. Aquí es una chapa con la
 * palabra: proyectada, una X se confunde con el aspa de un dorsal tachado, y
 * «SANCIONADO» no significa lo mismo que «TOCADO» cuando se decide a quién se
 * estudia.
 *
 * **Lesionado y tocado dicen los dos TOCADO.** Para preparar un partido la
 * diferencia no existe: los dos son gente que puede no salir o salir a medias,
 * y son dos palabras distintas para lo mismo en la charla. Una sola etiqueta se
 * lee de un vistazo en las veinticinco fichas.
 *
 * **La chapa sólo sale cuando dice algo.** La hoja escribe «ACTIVO» en todo el
 * que está disponible —es lo que pone el formulario al dar de alta a alguien—,
 * así que la plantilla entera salía con una chapa que no avisaba de nada.
 */
function baja(estado: string) {
  const limpio = estado.trim().toUpperCase();

  if (
    !limpio ||
    limpio === "." ||
    /DISPONIBLE|ACTIVO|ALTA|OK/.test(limpio)
  ) {
    return "";
  }

  if (/LESION|TOCAD|MOLESTIA|DUDA/.test(limpio)) return "TOCADO";

  return limpio.slice(0, 18);
}

/**
 * Pinta la ficha en su propio lienzo transparente y la devuelve en PNG.
 *
 * La comparte el informe del rival: sus hojas de plantilla y de once probable
 * llevan **esta misma ficha** —retrato, dorsal, nombre, pie, altura y peso—,
 * que es la que el cuerpo técnico ya conoce del campograma de día de partido.
 */
export function pintaFichaAlineacion(
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

  /*
  | La etiqueta de estado —TOCADO, SANCIONADO— va **al pie de la ficha**, no
  | encima de la cabeza: ahí tapaba media frente del retrato, que es lo que se
  | reconoce de un jugador al proyectarlo. Abajo se lee igual de bien y la
  | ficha se ve entera.
  |
  | El hueco se le resta a la franja de números en vez de superponerse: son
  | cuatro renglones que ya van justos, y una chapa encima del último borra el
  | dato en el que se apoya media charla.
  */
  const marca = baja(jugador.estado);

  const CHAPA_ALTO = 24;

  const ARRIBA = 174;
  const ABAJO = FICHA_H - 10 - (marca ? CHAPA_ALTO + 6 : 0);

  const lineas = lineasDeFicha(jugador, marca ? 3 : 4);

  if (marca) {
    chapa(ctx, marca, {
      x: FICHA_W / 2,
      y: FICHA_H - 10 - CHAPA_ALTO,
      alto: CHAPA_ALTO,
      fondo: C.rosaHondo,
      tinta: C.navy,
      tamano: 15,
      espaciado: 2,
      padding: 12,
      anchoMax: FICHA_W - 16,
      desdeCentro: true,
    });
  }

  /*
  | Aquí NO vale `ctx.textAlign = "center"`: `textoEspaciado` pinta letra a
  | letra, y centrado cada letra se centraría sobre su propio cursor —salía
  | «D IESTRO» y «PJ T ITULAR»—. Se centra a mano con el ancho medido, que es
  | además el único que cuenta el espaciado entre letras.
  |
  | Va después de la chapa a posta: `chapa` deja puesto su propio color y su
  | propia alineación, y los renglones saldrían del color de la píldora.
  */
  ctx.textAlign = "left";
  ctx.fillStyle = C.navy;

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

  const { fichas, k } = reparteAlineacion(data.jugadores, data.dibujo);

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
    imagen: pintaFichaAlineacion(
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
