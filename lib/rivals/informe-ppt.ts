/*
|--------------------------------------------------------------------------
| EL INFORME DEL RIVAL (.pptx)
|--------------------------------------------------------------------------
|
| Las diez diapositivas de `public/INFORME RIVAL.pptx`, montadas solas con lo
| que `scripts/rivals-informe.mjs` baja de BeSoccer.
|
| El documento existía: lo hacía el cuerpo técnico a mano cada semana, pegando
| capturas de BeSoccer en un PowerPoint —la clasificación, la lista de
| resultados, los onces de los últimos partidos—. Eso es media mañana por
| rival, y las capturas envejecen sin avisar: la tabla que se enseña el viernes
| es la del martes. Aquí se pinta cada diapositiva con los datos, no con la
| foto de los datos, así que sale a la hora que se pida y con la jornada de
| hoy.
|
| El reparto de las diez hojas es el del original y el lenguaje visual es el de
| `INDIVIDUAL.pptx` —papel, verde, azul, crema, rosa y Barlow Condensed—, el
| mismo de la portada del jugador, del PDF del once y del campograma de día de
| partido. Todo eso vive en `lienzo-club.ts`.
|
| **Cada diapositiva va como una imagen.** Es lo contrario del campograma de
| día de partido, que manda cada ficha suelta para poder borrar a los que no
| salen (`lib/export/pptx.ts` lo explica de los dos lados). Aquí no hay nada
| que borrar: el informe se lee, no se manipula, y si un dato cambia se vuelve
| a exportar, que cuesta un clic.
|
| Como `once-pdf` y `portada`, esto **no sabe nada de la hoja ni del estado de
| la página**: recibe el informe ya resuelto y sólo lo coloca y lo pinta.
|
| Una diapositiva sin datos no se pinta vacía: se salta. En agosto no hay
| clasificación que enseñar y en un rival cuyos amistosos nadie ha subido a
| BeSoccer no hay alineaciones; el documento sale con las hojas que tengan algo
| dentro, que es lo que haría cualquiera a mano.
*/

import { creaPptx, type DiapositivaPptx } from "@/lib/export/pptx";
import { descarga } from "@/lib/export/lienzos";
import { esperaFuentePortada } from "@/lib/rivals/portada-font";

import {
  balance,
  filaPropia,
  jugados,
  type FilaClasificacion,
  type InformeEquipo,
  type OncePartido,
  type Partido,
} from "@/lib/rivals/informe";

import {
  ajusta,
  anchoEspaciado,
  C,
  cargaImagen,
  chapa,
  cubre,
  encaja,
  fuente,
  rectRedondo,
  textoEspaciado,
  type Ctx,
} from "@/lib/rivals/lienzo-club";

/* ------------------------------------------------------------------ */
/*  LO QUE RECIBE                                                      */
/* ------------------------------------------------------------------ */

export type InformeData = {
  informe: InformeEquipo;
  /** "7". Vacío si el calendario no dice contra quién toca. */
  jornada: string;
  /** "YYYY-MM-DD" del partido, o "". */
  fecha: string;
  /** Se juega **en su campo**: manda enseñar su tabla de local. */
  enSuCampo: boolean;
  /** "26 / 27". */
  temporada: string;
  /** "Primera Federación · Grupo 2". */
  competicion: string;
};

/* ------------------------------------------------------------------ */
/*  MEDIDAS                                                            */
/* ------------------------------------------------------------------ */

/** La diapositiva: 12192000×6858000 EMU a 6350 EMU por píxel. */
const W = 1920;
const H = 1080;

/** A cuánto se multiplican los lienzos. Igual que la portada: 2 llega a 4K. */
const ESCALA = 2;

/** La franja de cabecera, con el título y el escudo. */
const CABECERA = 116;

/** Margen lateral. Los cuerpos de las hojas caben entre estas dos líneas. */
const MARGEN = 56;

/** Dónde empieza y dónde acaba el cuerpo de una hoja con cabecera. */
const CUERPO_Y = CABECERA + 40;
const CUERPO_ALTO = H - CUERPO_Y - 64;

const ANCHO = W - MARGEN * 2;

/* Las tres tintas de resultado, las mismas de toda la app. */
const VERDE_VICTORIA = "#2E7D52";
const AMARILLO_EMPATE = "#C8A96B";
const ROJO_DERROTA = "#B4454F";

/* ------------------------------------------------------------------ */
/*  LIENZO                                                             */
/* ------------------------------------------------------------------ */

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

/* ------------------------------------------------------------------ */
/*  TEXTO                                                              */
/* ------------------------------------------------------------------ */

/*
| Aquí NO vale `ctx.textAlign`: `textoEspaciado` pinta letra a letra y
| centrado cada letra se centraría sobre su propio cursor. Se centra y se
| alinea a la derecha a mano, con el ancho medido, que es además el único que
| cuenta el espaciado entre letras. Es la misma nota que hay en
| `alineacion-ppt.ts`.
*/

function escribe(
  ctx: Ctx,
  texto: string,
  x: number,
  y: number,
  opciones: {
    tamano: number;
    peso?: 500 | 600 | 700;
    tinta?: string;
    espaciado?: number;
    /** "izq" (por defecto), "centro" o "dcha". */
    alinea?: "izq" | "centro" | "dcha";
    /** Encoge la letra hasta que quepa. */
    maxAncho?: number;
  },
) {
  const {
    tamano,
    peso = 700,
    tinta = C.navy,
    espaciado = 0,
    alinea = "izq",
    maxAncho,
  } = opciones;

  if (!texto) return 0;

  if (maxAncho) ajusta(ctx, texto, maxAncho, tamano, peso, espaciado);
  else fuente(ctx, tamano, peso);

  const ancho = anchoEspaciado(ctx, texto, espaciado);

  const izquierda =
    alinea === "centro" ? x - ancho / 2 : alinea === "dcha" ? x - ancho : x;

  ctx.fillStyle = tinta;

  textoEspaciado(ctx, texto, izquierda, y, espaciado);

  return ancho;
}

/* ------------------------------------------------------------------ */
/*  FECHAS                                                             */
/* ------------------------------------------------------------------ */

const MESES = [
  "ENE",
  "FEB",
  "MAR",
  "ABR",
  "MAY",
  "JUN",
  "JUL",
  "AGO",
  "SEP",
  "OCT",
  "NOV",
  "DIC",
];

/** "2026-08-22T20:00:00+02:00" -> "22 AGO 2026". */
function fechaCorta(iso: string) {
  const partes = String(iso ?? "").match(/^(\d{4})-(\d{2})-(\d{2})/);

  if (!partes) return "";

  const mes = MESES[Number(partes[2]) - 1] ?? "";

  return `${partes[3]} ${mes} ${partes[1]}`;
}

/** "2026-09-06" -> "06/09/2026". */
function fechaLarga(iso: string) {
  const partes = String(iso ?? "").match(/^(\d{4})-(\d{2})-(\d{2})/);

  return partes ? `${partes[3]}/${partes[2]}/${partes[1]}` : "";
}

/* ------------------------------------------------------------------ */
/*  CROMO COMPARTIDO                                                   */
/* ------------------------------------------------------------------ */

/** El papel: es el fondo de todas las hojas menos la portada y la contra. */
function papel(ctx: Ctx) {
  ctx.fillStyle = C.crema;
  ctx.fillRect(0, 0, W, H);
}

/**
 * La franja de arriba: título a la izquierda, escudo y equipo a la derecha.
 *
 * Es lo que hace que las diez hojas se lean como un documento y no como diez
 * capturas: el mismo alto, la misma tinta y el mismo sitio en todas.
 */
function cabecera(
  ctx: Ctx,
  titulo: string,
  data: InformeData,
  escudo: HTMLImageElement | null,
) {
  ctx.fillStyle = C.navy;
  ctx.fillRect(0, 0, W, CABECERA);

  /* La pincelada verde de abajo, que es la firma de la plantilla. */
  ctx.fillStyle = C.verde;
  ctx.fillRect(0, CABECERA - 6, W, 6);

  escribe(ctx, titulo, MARGEN, 74, {
    tamano: 52,
    tinta: C.papel,
    espaciado: 3,
    maxAncho: W - MARGEN * 2 - 460,
  });

  /* -------------------------------------------------- a la derecha */

  const derecha = W - MARGEN;

  if (escudo) encaja(ctx, escudo, derecha - 78, 16, 78, 78);

  const finTexto = escudo ? derecha - 96 : derecha;

  escribe(ctx, data.informe.nombreLargo.toUpperCase(), finTexto, 56, {
    tamano: 34,
    tinta: C.papel,
    espaciado: 2,
    alinea: "dcha",
    maxAncho: 380,
  });

  escribe(ctx, `TEMPORADA ${data.temporada}`, finTexto, 84, {
    tamano: 20,
    peso: 500,
    tinta: "#8FA3B8",
    espaciado: 3,
    alinea: "dcha",
  });
}

/** El pie: quién lo firma y de dónde salen los números. */
function pie(ctx: Ctx, nota: string) {
  ctx.fillStyle = "#C3BCA9";
  ctx.fillRect(MARGEN, H - 52, ANCHO, 1);

  escribe(ctx, "REAL MADRID CASTILLA", MARGEN, H - 26, {
    tamano: 19,
    peso: 600,
    tinta: "#8A8370",
    espaciado: 3,
  });

  escribe(ctx, nota, W - MARGEN, H - 26, {
    tamano: 19,
    peso: 500,
    tinta: "#8A8370",
    espaciado: 2,
    alinea: "dcha",
  });
}

/** Un panel de los que dividen el cuerpo de una hoja. */
function panel(
  ctx: Ctx,
  x: number,
  y: number,
  w: number,
  h: number,
  titulo: string,
) {
  ctx.fillStyle = C.papel;
  rectRedondo(ctx, x, y, w, h, 18);
  ctx.fill();

  if (!titulo) return y + 28;

  ctx.fillStyle = C.verde;
  rectRedondo(ctx, x, y, w, 46, 18);
  ctx.fill();

  /* Las esquinas de abajo de la cinta, cuadradas: la redondez es del panel. */
  ctx.fillRect(x, y + 28, w, 18);

  escribe(ctx, titulo, x + 20, y + 32, {
    tamano: 24,
    tinta: C.papel,
    espaciado: 3,
    maxAncho: w - 40,
  });

  return y + 46;
}

/** La píldora de un resultado: G verde, E ámbar, P roja. */
function tintaResultado(resultado: string) {
  return resultado === "G"
    ? VERDE_VICTORIA
    : resultado === "E"
      ? AMARILLO_EMPATE
      : resultado === "P"
        ? ROJO_DERROTA
        : "#9A9384";
}

/**
 * La racha: los últimos partidos en una línea por partido.
 *
 * Es lo que en el original iba suelto en la hoja de estructuras —una tira de
 * resultados— y aquí sirve además para llenar el hueco que dejan las tablas en
 * agosto, cuando media clasificación está a cero. Se pinta en dos sitios (la
 * clasificación y el club) y por eso está fuera de los dos.
 */
function pintaRacha(
  ctx: Ctx,
  partidos: Partido[],
  caja: { x: number; y: number; w: number; h: number },
) {
  if (partidos.length === 0) {
    escribe(ctx, "SIN PARTIDOS JUGADOS", caja.x + caja.w / 2, caja.y + 46, {
      tamano: 24,
      peso: 500,
      tinta: "#9A9384",
      espaciado: 2,
      alinea: "centro",
    });

    return;
  }

  const paso = Math.min(56, caja.h / partidos.length);

  partidos.forEach((partido, indice) => {
    const y = caja.y + paso * indice;

    const centro = y + paso / 2;

    /* El disco con la letra: es lo que se lee de un vistazo. */
    const radio = Math.min(17, paso / 2 - 5);

    ctx.fillStyle = tintaResultado(partido.resultado);
    ctx.beginPath();
    ctx.arc(caja.x + 24 + radio, centro, radio, 0, Math.PI * 2);
    ctx.fill();

    escribe(ctx, partido.resultado || "·", caja.x + 24 + radio, centro + radio * 0.42, {
      tamano: radio * 1.2,
      tinta: C.papel,
      alinea: "centro",
    });

    /* Contra quién, y en qué campo. */
    const rival = partido.enCasa ? partido.visitante : partido.local;

    escribe(
      ctx,
      `${partido.enCasa ? "vs" : "@"} ${rival.nombre.toUpperCase()}`,
      caja.x + 34 + radio * 2,
      centro + 8,
      {
        tamano: 23,
        peso: 600,
        tinta: C.navy,
        espaciado: 0.5,
        maxAncho: caja.w - radio * 2 - 190,
      },
    );

    escribe(
      ctx,
      `${partido.local.goles ?? 0}-${partido.visitante.goles ?? 0}`,
      caja.x + caja.w - 24,
      centro + 8,
      {
        tamano: 26,
        tinta: tintaResultado(partido.resultado),
        espaciado: 1,
        alinea: "dcha",
      },
    );

    escribe(ctx, fechaCorta(partido.fecha), caja.x + caja.w - 82, centro + 7, {
      tamano: 17,
      peso: 500,
      tinta: "#9A9384",
      espaciado: 1,
      alinea: "dcha",
    });
  });
}

/* ------------------------------------------------------------------ */
/*  1 · PORTADA                                                        */
/* ------------------------------------------------------------------ */

/**
 * La portada, con el estadio del rival de fondo.
 *
 * El original llevaba una foto genérica de un campo; aquí va **su** campo, que
 * es el que BeSoccer da junto a los datos del club y el que se va a pisar. Si
 * no lo hay, queda el azul de la casa, que es lo que hacía el original antes
 * de que alguien pegara la foto.
 */
function pintaPortada(
  ctx: Ctx,
  data: InformeData,
  escudo: HTMLImageElement | null,
  estadio: HTMLImageElement | null,
) {
  ctx.fillStyle = C.navy;
  ctx.fillRect(0, 0, W, H);

  if (estadio) {
    cubre(ctx, estadio, 0, 0, W, H, 0.4);

    /* El velo: sin él la foto se come el texto, y con él el documento tiene el
       azul de la casa en la primera hoja. */
    const velo = ctx.createLinearGradient(0, 0, W, H);

    velo.addColorStop(0, "rgba(15,30,61,0.94)");
    velo.addColorStop(1, "rgba(15,30,61,0.72)");

    ctx.fillStyle = velo;
    ctx.fillRect(0, 0, W, H);
  }

  /* -------------------------------------------------- el escudo */

  if (escudo) encaja(ctx, escudo, MARGEN + 20, H / 2 - 190, 340, 340);

  /* -------------------------------------------------- el titular */

  const x = MARGEN + 420;

  if (data.jornada) {
    chapa(ctx, `JORNADA ${data.jornada}`, {
      x,
      y: H / 2 - 214,
      alto: 52,
      fondo: C.rosa,
      tinta: C.navy,
      tamano: 28,
      espaciado: 5,
      padding: 26,
    });
  }

  escribe(ctx, "INFORME DE RIVAL", x, H / 2 - 116, {
    tamano: 46,
    peso: 600,
    tinta: "#8FA3B8",
    espaciado: 12,
  });

  escribe(ctx, data.informe.nombreLargo.toUpperCase(), x, H / 2 + 10, {
    tamano: 128,
    tinta: C.papel,
    espaciado: 2,
    maxAncho: W - x - MARGEN,
  });

  /* Dónde y cuándo se juega. */
  const donde = data.enSuCampo
    ? data.informe.estadio?.nombre?.toUpperCase() || "EN SU CAMPO"
    : "EN EL ALFREDO DI STÉFANO";

  const cuando = data.fecha ? ` · ${fechaLarga(data.fecha)}` : "";

  escribe(ctx, `${donde}${cuando}`, x, H / 2 + 66, {
    tamano: 30,
    peso: 500,
    tinta: C.rosa,
    espaciado: 5,
    maxAncho: W - x - MARGEN,
  });

  /* -------------------------------------------------- el pie */

  ctx.fillStyle = "rgba(255,255,255,0.18)";
  ctx.fillRect(MARGEN, H - 108, ANCHO, 1);

  escribe(ctx, `REAL MADRID CASTILLA · TEMP ${data.temporada}`, MARGEN, H - 62, {
    tamano: 28,
    peso: 600,
    tinta: C.papel,
    espaciado: 6,
  });

  escribe(ctx, data.competicion.toUpperCase(), W - MARGEN, H - 62, {
    tamano: 24,
    peso: 500,
    tinta: "#8FA3B8",
    espaciado: 4,
    alinea: "dcha",
  });
}

/* ------------------------------------------------------------------ */
/*  2 · CLASIFICACIÓN                                                  */
/* ------------------------------------------------------------------ */

/** Las columnas de la tabla, con su ancho y su cabecera. */
const COLUMNAS: { clave: keyof FilaClasificacion; titulo: string; w: number }[] =
  [
    { clave: "puntos", titulo: "PTS", w: 58 },
    { clave: "jugados", titulo: "PJ", w: 48 },
    { clave: "ganados", titulo: "PG", w: 48 },
    { clave: "empatados", titulo: "PE", w: 48 },
    { clave: "perdidos", titulo: "PP", w: 48 },
    { clave: "favor", titulo: "GF", w: 48 },
    { clave: "contra", titulo: "GC", w: 48 },
  ];

function pintaTablaClasificacion(
  ctx: Ctx,
  filas: FilaClasificacion[],
  informe: InformeEquipo,
  escudos: Map<string, HTMLImageElement | null>,
  caja: { x: number; y: number; w: number; h: number },
) {
  const anchoNumeros = COLUMNAS.reduce((total, col) => total + col.w, 0);

  const paso = Math.min(38, (caja.h - 34) / Math.max(1, filas.length));

  /* -------------------------------------------------- cabecera */

  let x = caja.x + caja.w - 12 - anchoNumeros;

  for (const columna of COLUMNAS) {
    escribe(ctx, columna.titulo, x + columna.w / 2, caja.y + 22, {
      tamano: 18,
      peso: 600,
      tinta: "#8A8370",
      espaciado: 1,
      alinea: "centro",
    });

    x += columna.w;
  }

  /* -------------------------------------------------- filas */

  filas.forEach((fila, indice) => {
    const y = caja.y + 34 + paso * indice;

    const mio = fila.slug === informe.slug;

    if (mio) {
      ctx.fillStyle = "rgba(246,175,182,0.45)";
      rectRedondo(ctx, caja.x + 4, y, caja.w - 8, paso - 2, 8);
      ctx.fill();
    } else if (indice % 2 === 1) {
      ctx.fillStyle = "rgba(0,0,0,0.028)";
      ctx.fillRect(caja.x + 4, y, caja.w - 8, paso - 2);
    }

    const centro = y + paso / 2 + 6;

    escribe(ctx, String(fila.puesto), caja.x + 30, centro, {
      tamano: 20,
      peso: mio ? 700 : 500,
      tinta: mio ? C.navy : "#6C6659",
      alinea: "dcha",
    });

    const escudo = escudos.get(fila.escudo);

    if (escudo) encaja(ctx, escudo, caja.x + 40, y + 3, paso - 8, paso - 8);

    escribe(ctx, fila.equipo, caja.x + 44 + paso, centro, {
      tamano: 22,
      peso: mio ? 700 : 600,
      tinta: C.navy,
      espaciado: 0.5,
      maxAncho: caja.w - anchoNumeros - paso - 70,
    });

    let columnaX = caja.x + caja.w - 12 - anchoNumeros;

    for (const columna of COLUMNAS) {
      escribe(
        ctx,
        String(fila[columna.clave] ?? ""),
        columnaX + columna.w / 2,
        centro,
        {
          tamano: 21,
          peso: columna.clave === "puntos" ? 700 : 500,
          tinta: columna.clave === "puntos" ? C.verde : "#4A4438",
          alinea: "centro",
        },
      );

      columnaX += columna.w;
    }
  });
}

/** El resumen de una pestaña —local o visitante— en cifras grandes. */
function pintaResumenTabla(
  ctx: Ctx,
  titulo: string,
  fila: FilaClasificacion | null,
  caja: { x: number; y: number; w: number; h: number },
  destacado: boolean,
) {
  const dentro = panel(ctx, caja.x, caja.y, caja.w, caja.h, titulo);

  if (!fila) {
    escribe(ctx, "SIN DATOS TODAVÍA", caja.x + caja.w / 2, dentro + 60, {
      tamano: 24,
      peso: 500,
      tinta: "#9A9384",
      espaciado: 2,
      alinea: "centro",
    });

    return;
  }

  if (destacado) {
    ctx.fillStyle = "rgba(246,175,182,0.35)";
    ctx.fillRect(caja.x, dentro, caja.w, caja.h - (dentro - caja.y));
  }

  /* El puesto, que es lo que se lee de lejos. */
  escribe(ctx, `${fila.puesto}º`, caja.x + 30, dentro + 78, {
    tamano: 76,
    tinta: C.navy,
  });

  escribe(ctx, `${fila.puntos} PTS`, caja.x + 30, dentro + 112, {
    tamano: 26,
    peso: 600,
    tinta: C.verde,
    espaciado: 3,
  });

  /* Y a la derecha el desglose. */
  const celdas = [
    { titulo: "PJ", valor: fila.jugados },
    { titulo: "PG", valor: fila.ganados },
    { titulo: "PE", valor: fila.empatados },
    { titulo: "PP", valor: fila.perdidos },
    { titulo: "GF", valor: fila.favor },
    { titulo: "GC", valor: fila.contra },
  ];

  const ancho = (caja.w - 190) / 3;

  celdas.forEach((celda, indice) => {
    const x = caja.x + 176 + ancho * (indice % 3) + ancho / 2;
    const y = dentro + 46 + Math.floor(indice / 3) * 66;

    escribe(ctx, String(celda.valor), x, y, {
      tamano: 34,
      tinta: C.navy,
      alinea: "centro",
    });

    escribe(ctx, celda.titulo, x, y + 22, {
      tamano: 17,
      peso: 500,
      tinta: "#8A8370",
      espaciado: 2,
      alinea: "centro",
    });
  });
}

function pintaClasificacion(
  ctx: Ctx,
  data: InformeData,
  escudo: HTMLImageElement | null,
  escudos: Map<string, HTMLImageElement | null>,
) {
  papel(ctx);
  cabecera(ctx, "CLASIFICACIÓN", data, escudo);

  const informe = data.informe;

  const anchoTabla = Math.round(ANCHO * 0.58);

  /* -------------------------------------------------- la tabla entera */

  const dentro = panel(ctx, MARGEN, CUERPO_Y, anchoTabla, CUERPO_ALTO, "TOTAL");

  pintaTablaClasificacion(ctx, informe.clasificacion.total, informe, escudos, {
    x: MARGEN,
    y: dentro + 6,
    w: anchoTabla,
    h: CUERPO_ALTO - (dentro - CUERPO_Y) - 12,
  });

  /* -------------------------------------------------- local y visitante */

  const x = MARGEN + anchoTabla + 28;
  const w = ANCHO - anchoTabla - 28;

  /*
  | Los dos resúmenes ocupan lo que necesitan —una cifra grande y seis
  | casillas— y no la mitad de la hoja cada uno: en agosto están a cero y
  | dejaban dos cuartillas en blanco. Lo que sobra se lo lleva la racha, que
  | es lo que de verdad se mira cuando la tabla todavía no dice nada.
  */
  const alto = 250;

  /*
  | El destacado va en la pestaña que toca: si se juega en su campo, lo que
  | dice algo es cómo va **de local**, y al revés. Es la lectura que el cuerpo
  | técnico hace de esta hoja y por eso se marca sola en vez de dejar las dos
  | igual de gordas.
  */
  pintaResumenTabla(
    ctx,
    "COMO LOCAL",
    filaPropia(informe.clasificacion.local, informe),
    { x, y: CUERPO_Y, w, h: alto },
    data.enSuCampo,
  );

  pintaResumenTabla(
    ctx,
    "COMO VISITANTE",
    filaPropia(informe.clasificacion.visitante, informe),
    { x, y: CUERPO_Y + alto + 20, w, h: alto },
    !data.enSuCampo,
  );

  const yRacha = CUERPO_Y + alto * 2 + 40;

  const altoRacha = CUERPO_Y + CUERPO_ALTO - yRacha;

  const dentroRacha = panel(ctx, x, yRacha, w, altoRacha, "ÚLTIMOS PARTIDOS");

  pintaRacha(ctx, jugados(informe).slice(0, 6), {
    x,
    y: dentroRacha + 8,
    w,
    h: altoRacha - (dentroRacha - yRacha) - 16,
  });

  pie(
    ctx,
    data.enSuCampo
      ? "SE JUEGA EN SU CAMPO · MIRA LA TABLA DE LOCAL"
      : "SE JUEGA EN EL DI STÉFANO · MIRA LA TABLA DE VISITANTE",
  );
}

/* ------------------------------------------------------------------ */
/*  3 · RESULTADOS DE LA TEMPORADA                                     */
/* ------------------------------------------------------------------ */

/** Una fila de resultado: escudo, nombre, marcador, escudo, nombre. */
function pintaResultado(
  ctx: Ctx,
  partido: Partido,
  escudos: Map<string, HTMLImageElement | null>,
  caja: { x: number; y: number; w: number; h: number },
) {
  ctx.fillStyle = C.papel;
  rectRedondo(ctx, caja.x, caja.y, caja.w, caja.h, 14);
  ctx.fill();

  /* El filo de color con el resultado: verde, ámbar o rojo. */
  ctx.fillStyle = tintaResultado(partido.resultado);
  rectRedondo(ctx, caja.x, caja.y, 8, caja.h, 4);
  ctx.fill();

  const centro = caja.y + caja.h / 2;

  /* -------------------------------------------------- competición y fecha */

  escribe(ctx, partido.competicion.toUpperCase(), caja.x + 24, caja.y + 24, {
    tamano: 16,
    peso: 500,
    tinta: "#9A9384",
    espaciado: 2,
    maxAncho: 260,
  });

  escribe(ctx, fechaCorta(partido.fecha), caja.x + caja.w - 20, caja.y + 24, {
    tamano: 16,
    peso: 500,
    tinta: "#9A9384",
    espaciado: 2,
    alinea: "dcha",
  });

  /* -------------------------------------------------- el marcador */

  const marcador = partido.jugado
    ? `${partido.local.goles ?? 0} - ${partido.visitante.goles ?? 0}`
    : "—";

  escribe(ctx, marcador, caja.x + caja.w / 2, centro + 16, {
    tamano: 42,
    tinta: C.navy,
    espaciado: 2,
    alinea: "centro",
  });

  /* -------------------------------------------------- los dos equipos */

  const lados = [
    { lado: partido.local, x: caja.x + caja.w / 2 - 76, alinea: "dcha" as const },
    {
      lado: partido.visitante,
      x: caja.x + caja.w / 2 + 76,
      alinea: "izq" as const,
    },
  ];

  /* Quién ganó, para escribirlo más gordo: es lo que hace BeSoccer y lo que
     deja leer un marcador sin sumar. */
  const golesLocal = partido.local.goles ?? 0;
  const golesVisitante = partido.visitante.goles ?? 0;

  for (const { lado, x, alinea } of lados) {
    const escudo = escudos.get(lado.escudo);

    const escudoX = alinea === "dcha" ? x - 40 : x + 4;

    if (escudo) encaja(ctx, escudo, escudoX, centro - 18, 36, 36);

    const gano =
      partido.jugado &&
      (lado === partido.local
        ? golesLocal > golesVisitante
        : golesVisitante > golesLocal);

    escribe(
      ctx,
      lado.nombre.toUpperCase(),
      alinea === "dcha" ? x - 48 : x + 48,
      centro + 10,
      {
        tamano: 24,
        peso: gano ? 700 : 500,
        tinta: gano ? C.navy : "#5C5648",
        espaciado: 1,
        alinea,
        maxAncho: caja.w / 2 - 140,
      },
    );
  }

  /* -------------------------------------------------- los goleadores */

  const goles = partido.goles ?? [];

  if (goles.length === 0) return;

  /* Por minuto, que es como se cuenta un partido. BeSoccer los da del último
     al primero, que es el orden de una retransmisión, no el de un informe. */
  const enOrden = [...goles].sort(
    (a, b) => Number(a.minuto.split("+")[0]) - Number(b.minuto.split("+")[0]),
  );

  const propios = enOrden
    .filter((gol) => gol.propio)
    .map((gol) => `${gol.jugador} ${gol.minuto}'`);

  const ajenos = enOrden
    .filter((gol) => !gol.propio)
    .map((gol) => `${gol.jugador} ${gol.minuto}'`);

  /*
  | Cada lista debajo del equipo que la marcó, no del que la sufre: en un
  | «Huesca 3-1 CD Teruel» los goles del Teruel van a la derecha, que es donde
  | está escrito el Teruel. Puestos siempre en el mismo sitio había que leer el
  | color para saber de quién era cada gol.
  */
  const izquierda = partido.enCasa ? propios : ajenos;
  const derecha = partido.enCasa ? ajenos : propios;

  const tintaIzquierda = partido.enCasa ? C.verde : "#9A6169";
  const tintaDerecha = partido.enCasa ? "#9A6169" : C.verde;

  escribe(ctx, izquierda.join(" · "), caja.x + 24, caja.y + caja.h - 14, {
    tamano: 17,
    peso: 500,
    tinta: tintaIzquierda,
    espaciado: 0.5,
    maxAncho: caja.w / 2 - 40,
  });

  escribe(ctx, derecha.join(" · "), caja.x + caja.w - 20, caja.y + caja.h - 14, {
    tamano: 17,
    peso: 500,
    tinta: tintaDerecha,
    espaciado: 0.5,
    alinea: "dcha",
    maxAncho: caja.w / 2 - 40,
  });
}

function pintaResultados(
  ctx: Ctx,
  data: InformeData,
  escudo: HTMLImageElement | null,
  escudos: Map<string, HTMLImageElement | null>,
  partidos: Partido[],
) {
  papel(ctx);
  cabecera(ctx, "RESULTADOS DE LA TEMPORADA", data, escudo);

  /*
  | Hasta catorce partidos, del más reciente al más antiguo: a media temporada
  | no caben los treinta y ocho en una hoja y los que importan son los
  | últimos.
  |
  | Siempre en dos columnas, aunque haya cinco partidos: la ficha está pensada
  | para ese ancho —marcador en el centro, un equipo a cada lado y los
  | goleadores debajo— y a hoja completa se descoloca. Lo que faltaba cuando
  | hay pocos no era ancho, era centrarlas, que es lo que se hace abajo.
  */
  const columnas = 2;

  const hueco = 20;

  const anchoColumna = (ANCHO - hueco * (columnas - 1)) / columnas;

  const porColumna = Math.ceil(partidos.length / columnas);

  const alto = Math.min(
    130,
    (CUERPO_ALTO - hueco * (porColumna - 1)) / Math.max(1, porColumna),
  );

  /* Centrado en el cuerpo: con cinco partidos, pegados arriba, la hoja parece
     estar a medio cargar. */
  const arriba =
    CUERPO_Y +
    Math.max(0, (CUERPO_ALTO - (alto * porColumna + hueco * (porColumna - 1))) / 2);

  partidos.forEach((partido, indice) => {
    const columna = Math.floor(indice / porColumna);
    const fila = indice % porColumna;

    pintaResultado(ctx, partido, escudos, {
      x: MARGEN + columna * (anchoColumna + hueco),
      y: arriba + fila * (alto + hueco),
      w: anchoColumna,
      h: alto,
    });
  });

  pie(ctx, "GOLEADORES DE LOS ÚLTIMOS PARTIDOS · FUENTE BESOCCER");
}

/* ------------------------------------------------------------------ */
/*  4 · ESTADÍSTICAS                                                   */
/* ------------------------------------------------------------------ */

/** Una cifra grande con su rótulo debajo. */
function cifra(
  ctx: Ctx,
  valor: string,
  rotulo: string,
  x: number,
  y: number,
  tinta = C.navy,
  tamano = 62,
) {
  escribe(ctx, valor, x, y, { tamano, tinta, alinea: "centro" });

  escribe(ctx, rotulo, x, y + 28, {
    tamano: 18,
    peso: 500,
    tinta: "#8A8370",
    espaciado: 2,
    alinea: "centro",
  });
}

/**
 * En qué tramo del partido marca y encaja.
 *
 * Sólo cuenta los partidos de los que se ha bajado la ficha —los últimos
 * ocho—, que es de donde salen los minutos. Se dice en el pie de la hoja: un
 * porcentaje sin saber sobre cuántos goles se ha calculado no significa nada.
 */
function tramos(partidos: Partido[]) {
  const cortes = [15, 30, 45, 60, 75, 90];

  const favor = new Array(cortes.length).fill(0);
  const contra = new Array(cortes.length).fill(0);

  let total = 0;

  for (const partido of partidos) {
    for (const gol of partido.goles ?? []) {
      /* "45+2" cuenta en el tramo del 45, no en el del 60. */
      const minuto = Number(String(gol.minuto).split("+")[0]) || 0;

      const indice = Math.min(
        cortes.length - 1,
        cortes.findIndex((corte) => minuto <= corte),
      );

      const casilla = indice < 0 ? cortes.length - 1 : indice;

      if (gol.propio) favor[casilla] += 1;
      else contra[casilla] += 1;

      total += 1;
    }
  }

  return { cortes, favor, contra, total };
}

function pintaEstadisticas(
  ctx: Ctx,
  data: InformeData,
  escudo: HTMLImageElement | null,
  conFicha: Partido[],
) {
  papel(ctx);
  cabecera(ctx, "ESTADÍSTICAS", data, escudo);

  const informe = data.informe;

  const liga = balance(informe, true);
  const todo = balance(informe, false);

  /*
  | Antes de la primera jornada no hay competición oficial y el balance salía
  | con seis ceros, que es peor que no poner nada: lo que hay son los
  | amistosos, y es lo que se enseña, dicho con todas las letras en el rótulo
  | del panel. En cuanto empieza la liga manda la liga.
  */
  const oficial = liga.partidos > 0;

  const cuenta = oficial ? liga : todo;

  /* Los dos paneles de arriba son una fila de cifras: miden lo que mide esa
     fila y el resto de la hoja se lo lleva el gráfico, que es lo que gana con
     el alto. */
  const alto = 210;

  const altoAbajo = CUERPO_ALTO - 24 - alto;

  /* -------------------------------------------------- arriba: el balance */

  const anchoIzq = Math.round(ANCHO * 0.62);

  let dentro = panel(
    ctx,
    MARGEN,
    CUERPO_Y,
    anchoIzq,
    alto,
    oficial ? "BALANCE OFICIAL" : "PRETEMPORADA",
  );

  const celdas: [string, string, string][] = [
    [String(cuenta.partidos), "PARTIDOS", C.navy],
    [String(cuenta.ganados), "GANADOS", VERDE_VICTORIA],
    [String(cuenta.empatados), "EMPATADOS", AMARILLO_EMPATE],
    [String(cuenta.perdidos), "PERDIDOS", ROJO_DERROTA],
    [String(cuenta.favor), "A FAVOR", C.verde],
    [String(cuenta.contra), "EN CONTRA", "#9A6169"],
  ];

  const ancho = anchoIzq / 6;

  /* En una sola fila: el panel es ancho y bajo, y seis cifras seguidas se leen
     de corrido como el marcador de un estadio. */
  celdas.forEach(([valor, rotulo, tinta], indice) => {
    cifra(ctx, valor, rotulo, MARGEN + ancho * indice + ancho / 2, dentro + 96, tinta);
  });

  /* -------------------------------------------------- arriba dcha: medias */

  const xDer = MARGEN + anchoIzq + 24;
  const wDer = ANCHO - anchoIzq - 24;

  dentro = panel(ctx, xDer, CUERPO_Y, wDer, alto, "POR PARTIDO");

  const media = (valor: number) =>
    cuenta.partidos > 0 ? (valor / cuenta.partidos).toFixed(2) : "—";

  cifra(ctx, media(cuenta.favor), "GOLES A FAVOR", xDer + wDer / 4, dentro + 96, C.verde);

  cifra(
    ctx,
    media(cuenta.contra),
    "GOLES EN CONTRA",
    xDer + (wDer * 3) / 4,
    dentro + 96,
    "#9A6169",
  );

  /* -------------------------------------------------- abajo izq: tramos */

  const yAbajo = CUERPO_Y + alto + 24;

  const anchoTramos = Math.round(ANCHO * 0.62);

  dentro = panel(
    ctx,
    MARGEN,
    yAbajo,
    anchoTramos,
    altoAbajo,
    "CUÁNDO MARCA Y CUÁNDO ENCAJA",
  );

  const reparto = tramos(conFicha);

  if (reparto.total === 0) {
    escribe(ctx, "SIN GOLES QUE REPARTIR TODAVÍA", MARGEN + anchoTramos / 2, dentro + 90, {
      tamano: 26,
      peso: 500,
      tinta: "#9A9384",
      espaciado: 2,
      alinea: "centro",
    });
  } else {
    const maximo = Math.max(1, ...reparto.favor, ...reparto.contra);

    const anchoBarra = (anchoTramos - 60) / reparto.cortes.length;

    const base = yAbajo + altoAbajo - 54;

    const altoMax = base - dentro - 40;

    reparto.cortes.forEach((corte, indice) => {
      const x = MARGEN + 30 + anchoBarra * indice;

      const mitad = anchoBarra / 2 - 8;

      /* A favor a la izquierda de la casilla, en contra a la derecha. */
      const barras: [number, string, number][] = [
        [reparto.favor[indice], C.verde, x + 6],
        [reparto.contra[indice], "#B4737B", x + mitad + 14],
      ];

      for (const [valor, tinta, barraX] of barras) {
        const altura = (valor / maximo) * altoMax;

        if (valor > 0) {
          ctx.fillStyle = tinta;
          rectRedondo(ctx, barraX, base - altura, mitad, altura, 6);
          ctx.fill();

          escribe(ctx, String(valor), barraX + mitad / 2, base - altura - 10, {
            tamano: 20,
            tinta,
            alinea: "centro",
          });
        }
      }

      escribe(
        ctx,
        `${corte - 14}'-${corte}'`,
        x + anchoBarra / 2,
        base + 26,
        {
          tamano: 17,
          peso: 500,
          tinta: "#8A8370",
          espaciado: 1,
          alinea: "centro",
        },
      );
    });
  }

  /* -------------------------------------------------- abajo dcha: goleadores */

  const goleadores = informe.goleadores.slice(0, 8);

  const PASO_GOLEADOR = 62;

  /* El panel mide lo que miden sus filas. En agosto hay dos o tres goleadores
     y estirado al alto del gráfico de al lado quedaba medio panel vacío; más
     corto que su vecino se lee como una lista que se ha acabado. */
  const altoGoleadores = Math.min(
    altoAbajo,
    46 + 28 + Math.max(1, goleadores.length) * PASO_GOLEADOR,
  );

  dentro = panel(ctx, xDer, yAbajo, wDer, altoGoleadores, "MÁXIMOS GOLEADORES");

  if (goleadores.length === 0) {
    escribe(ctx, "SIN GOLEADORES REGISTRADOS", xDer + wDer / 2, dentro + 80, {
      tamano: 24,
      peso: 500,
      tinta: "#9A9384",
      espaciado: 2,
      alinea: "centro",
    });
  } else {
    const paso = PASO_GOLEADOR;

    goleadores.forEach((goleador, indice) => {
      const y = dentro + 20 + paso * indice;

      ctx.fillStyle = indice % 2 === 0 ? "rgba(0,0,0,0.03)" : "transparent";
      ctx.fillRect(xDer + 12, y, wDer - 24, paso - 6);

      escribe(ctx, goleador.nombre.toUpperCase(), xDer + 28, y + paso / 2 + 6, {
        tamano: 26,
        peso: 600,
        tinta: C.navy,
        espaciado: 1,
        maxAncho: wDer - 140,
      });

      chapa(ctx, `${goleador.goles}`, {
        x: xDer + wDer - 28,
        y: y + paso / 2 - 17,
        alto: 34,
        fondo: C.verde,
        tinta: C.papel,
        tamano: 22,
        espaciado: 1,
        padding: 14,
        anchoMin: 44,
        desdeDerecha: true,
      });
    });
  }

  pie(
    ctx,
    `MINUTOS Y GOLEADORES DE LOS ÚLTIMOS ${conFicha.length} PARTIDOS · FUENTE BESOCCER`,
  );
}

/* ------------------------------------------------------------------ */
/*  5 · ENTRENADOR Y ESTADIO                                           */
/* ------------------------------------------------------------------ */

function pintaClub(
  ctx: Ctx,
  data: InformeData,
  escudo: HTMLImageElement | null,
  retratoEntrenador: HTMLImageElement | null,
  fotoEstadio: HTMLImageElement | null,
) {
  papel(ctx);
  cabecera(ctx, "EL CLUB", data, escudo);

  const informe = data.informe;

  const mitad = (ANCHO - 24) / 2;

  /*
  | Los dos paneles miden lo que necesitan y la tira de resultados se queda con
  | el resto: ficha de entrenador y ficha de estadio son dos bloques cortos, y
  | estirados a toda la hoja dejaban medio folio en blanco cada uno.
  */
  const altoFicha = 620;

  /* -------------------------------------------------- entrenador */

  let dentro = panel(ctx, MARGEN, CUERPO_Y, mitad, altoFicha, "ENTRENADOR");

  const entrenador = informe.entrenador;

  if (!entrenador) {
    escribe(ctx, "SIN DATOS", MARGEN + mitad / 2, dentro + 80, {
      tamano: 28,
      peso: 500,
      tinta: "#9A9384",
      espaciado: 3,
      alinea: "centro",
    });
  } else {
    if (retratoEntrenador) {
      /* Redondo, como en la ficha del jugador. */
      ctx.save();
      ctx.beginPath();
      ctx.arc(MARGEN + 130, dentro + 140, 100, 0, Math.PI * 2);
      ctx.clip();
      cubre(ctx, retratoEntrenador, MARGEN + 30, dentro + 40, 200, 200, 0.2);
      ctx.restore();

      ctx.strokeStyle = C.verde;
      ctx.lineWidth = 4;
      ctx.beginPath();
      ctx.arc(MARGEN + 130, dentro + 140, 100, 0, Math.PI * 2);
      ctx.stroke();
    }

    escribe(ctx, entrenador.nombre.toUpperCase(), MARGEN + 258, dentro + 110, {
      tamano: 48,
      tinta: C.navy,
      espaciado: 1,
      maxAncho: mitad - 290,
    });

    if (entrenador.edad) {
      escribe(ctx, `${entrenador.edad} AÑOS`, MARGEN + 258, dentro + 152, {
        tamano: 26,
        peso: 500,
        tinta: "#8A8370",
        espaciado: 3,
      });
    }

    /* Su registro al frente del equipo. */
    const registro: [string, string, string][] = [
      [String(entrenador.partidos), "PARTIDOS", C.navy],
      [String(entrenador.ganados), "GANADOS", VERDE_VICTORIA],
      [String(entrenador.empatados), "EMPATADOS", AMARILLO_EMPATE],
      [String(entrenador.perdidos), "PERDIDOS", ROJO_DERROTA],
    ];

    const ancho = mitad / 4;

    registro.forEach(([valor, rotulo, tinta], indice) => {
      cifra(
        ctx,
        valor,
        rotulo,
        MARGEN + ancho * indice + ancho / 2,
        dentro + 330,
        tinta,
        52,
      );
    });

    /* Y las estructuras que ha sacado, que es lo que se lleva a la pizarra. */
    if (informe.estructuras.length > 0) {
      escribe(ctx, "ESTRUCTURAS", MARGEN + 30, dentro + 424, {
        tamano: 22,
        peso: 600,
        tinta: "#8A8370",
        espaciado: 4,
      });

      let x = MARGEN + 30;

      for (const estructura of informe.estructuras.slice(0, 4)) {
        const principal = estructura === informe.estructuras[0];

        /* "1-4-2-3-1 ×3": el aspa dice «tres veces» sin tener que explicarlo.
           Con un punto en medio parecía parte del dibujo. */
        x +=
          chapa(ctx, `${estructura.estructura} ×${estructura.veces}`, {
            x,
            y: dentro + 444,
            alto: 46,
            fondo: principal ? C.verde : "rgba(27,58,46,0.12)",
            tinta: principal ? C.papel : C.verde,
            tamano: 26,
            espaciado: 2,
            padding: 20,
          }) + 12;
      }
    }
  }

  /* -------------------------------------------------- estadio */

  const x = MARGEN + mitad + 24;

  dentro = panel(ctx, x, CUERPO_Y, mitad, altoFicha, "ESTADIO");

  const estadio = informe.estadio;

  if (!estadio) {
    escribe(ctx, "SIN DATOS", x + mitad / 2, dentro + 80, {
      tamano: 28,
      peso: 500,
      tinta: "#9A9384",
      espaciado: 3,
      alinea: "centro",
    });
  } else {
    const altoFoto = 300;

    if (fotoEstadio) {
      ctx.save();
      rectRedondo(ctx, x + 20, dentro + 20, mitad - 40, altoFoto, 12);
      ctx.clip();
      cubre(ctx, fotoEstadio, x + 20, dentro + 20, mitad - 40, altoFoto, 0.5);
      ctx.restore();
    } else {
      ctx.fillStyle = "rgba(0,0,0,0.05)";
      rectRedondo(ctx, x + 20, dentro + 20, mitad - 40, altoFoto, 12);
      ctx.fill();
    }

    escribe(ctx, estadio.nombre.toUpperCase(), x + 30, dentro + altoFoto + 84, {
      tamano: 46,
      tinta: C.navy,
      espaciado: 1,
      maxAncho: mitad - 60,
    });

    if (estadio.ciudad) {
      escribe(ctx, estadio.ciudad.toUpperCase(), x + 30, dentro + altoFoto + 120, {
        tamano: 24,
        peso: 500,
        tinta: "#8A8370",
        espaciado: 4,
        maxAncho: mitad - 60,
      });
    }

    const datos: [string, string][] = [
      [estadio.capacidad ? `${estadio.capacidad}` : "—", "ESPECTADORES"],
      [estadio.tamano || "—", "TAMAÑO"],
      [estadio.construccion || "—", "CONSTRUIDO"],
    ];

    const ancho = mitad / 3;

    datos.forEach(([valor, rotulo], indice) => {
      cifra(
        ctx,
        valor,
        rotulo,
        x + ancho * indice + ancho / 2,
        dentro + altoFoto + 210,
        C.navy,
        valor.length > 6 ? 34 : 46,
      );
    });
  }

  /* -------------------------------------------------- la racha, abajo */

  const yRacha = CUERPO_Y + altoFicha + 24;

  const altoRacha = CUERPO_Y + CUERPO_ALTO - yRacha;

  const dentroRacha = panel(
    ctx,
    MARGEN,
    yRacha,
    ANCHO,
    altoRacha,
    "ÚLTIMOS RESULTADOS",
  );

  /*
  | En dos columnas: la tira es ancha y seis partidos puestos en fila india
  | dejarían tres cuartas partes del panel vacías.
  */
  const recientes = jugados(informe).slice(0, 6);

  const mitadRacha = (ANCHO - 24) / 2;

  const alturaFilas = altoRacha - (dentroRacha - yRacha) - 16;

  [recientes.slice(0, 3), recientes.slice(3, 6)].forEach((columna, indice) => {
    if (columna.length === 0) return;

    pintaRacha(ctx, columna, {
      x: MARGEN + indice * (mitadRacha + 24),
      y: dentroRacha + 8,
      w: mitadRacha,
      h: alturaFilas,
    });
  });

  pie(ctx, "DATOS DEL CLUB · FUENTE BESOCCER");
}

/* ------------------------------------------------------------------ */
/*  CAMPO Y ONCES                                                      */
/* ------------------------------------------------------------------ */

/**
 * Un campo vertical con su césped y sus líneas, atacando hacia arriba.
 *
 * Es el mismo campo del PDF del once —vertical, porque un once se lee como una
 * formación de arriba abajo— y no el tumbado del campograma de día de partido,
 * que necesita el ancho para repartir a veinticinco fichas.
 */
function pintaCampo(ctx: Ctx, x: number, y: number, w: number, h: number) {
  ctx.save();

  rectRedondo(ctx, x, y, w, h, 14);
  ctx.clip();

  ctx.fillStyle = C.verde;
  ctx.fillRect(x, y, w, h);

  /* Las franjas de siega: seis, que es lo que se ve en una tele. */
  ctx.fillStyle = "rgba(255,255,255,0.035)";

  const franja = h / 8;

  for (let i = 0; i < 8; i += 2) {
    ctx.fillRect(x, y + franja * i, w, franja);
  }

  ctx.strokeStyle = "rgba(255,255,255,0.32)";
  ctx.lineWidth = 2;

  const borde = 14;

  ctx.strokeRect(x + borde, y + borde, w - borde * 2, h - borde * 2);

  /* Medio campo y círculo central. */
  ctx.beginPath();
  ctx.moveTo(x + borde, y + h / 2);
  ctx.lineTo(x + w - borde, y + h / 2);
  ctx.stroke();

  ctx.beginPath();
  ctx.arc(x + w / 2, y + h / 2, w * 0.15, 0, Math.PI * 2);
  ctx.stroke();

  /* Las dos áreas. */
  const areaW = w * 0.56;
  const areaH = h * 0.15;

  ctx.strokeRect(x + (w - areaW) / 2, y + borde, areaW, areaH);
  ctx.strokeRect(x + (w - areaW) / 2, y + h - borde - areaH, areaW, areaH);

  const chicaW = w * 0.28;
  const chicaH = h * 0.06;

  ctx.strokeRect(x + (w - chicaW) / 2, y + borde, chicaW, chicaH);
  ctx.strokeRect(x + (w - chicaW) / 2, y + h - borde - chicaH, chicaW, chicaH);

  ctx.restore();
}

/**
 * Dónde cae cada uno del once, en tanto por uno del campo.
 *
 * BeSoccer numera los puestos de atrás hacia adelante —`pos1` es el portero—,
 * así que con la estructura ("1-4-2-3-1") basta para repartirlos: se parte la
 * cadena en líneas, se toma a los jugadores en orden y cada línea se reparte a
 * lo ancho. Es lo mismo que hace `once-campo.ts` con el once probable, sólo
 * que allí la línea la dice la posición de la hoja y aquí la dice el dibujo
 * que ya publica BeSoccer.
 *
 * Sin estructura —los amistosos a veces no la traen— se reparte 4-4-2, que es
 * lo que deja once fichas legibles aunque no sea lo que jugaron.
 */
function reparteOnce(once: OncePartido) {
  const lineas = (once.estructura || "1-4-4-2")
    .split("-")
    .map((parte) => Number(parte.trim()))
    .filter((numero) => Number.isFinite(numero) && numero > 0);

  /* El primer número es el portero; las demás son las líneas de campo. */
  const campo = lineas.slice(1);

  const jugadores = [...once.jugadores].sort((a, b) => a.puesto - b.puesto);

  const sitios: { jugador: OncePartido["jugadores"][number]; x: number; y: number }[] =
    [];

  const portero = jugadores.shift();

  if (portero) sitios.push({ jugador: portero, x: 0.5, y: 0.9 });

  /* De la defensa al ataque, repartidas entre el 0,72 y el 0,14 del campo. */
  const alto = campo.length > 1 ? (0.72 - 0.14) / (campo.length - 1) : 0;

  campo.forEach((cuantos, indice) => {
    const y = campo.length > 1 ? 0.72 - alto * indice : 0.43;

    for (let puesto = 0; puesto < cuantos; puesto += 1) {
      const jugador = jugadores.shift();

      if (!jugador) return;

      sitios.push({ jugador, x: (puesto + 1) / (cuantos + 1), y });
    }
  });

  /* Lo que sobre —una estructura que no suma once— se pone en el medio, antes
     que dejarlo fuera del campo sin que nadie se entere. */
  jugadores.forEach((jugador, indice) => {
    sitios.push({
      jugador,
      x: (indice + 1) / (jugadores.length + 1),
      y: 0.5,
    });
  });

  return sitios;
}

/** Una ficha del once sobre el campo: dorsal en círculo y nombre debajo. */
function pintaFichaOnce(
  ctx: Ctx,
  jugador: OncePartido["jugadores"][number],
  x: number,
  y: number,
  radio: number,
) {
  ctx.fillStyle = C.papel;
  ctx.beginPath();
  ctx.arc(x, y, radio, 0, Math.PI * 2);
  ctx.fill();

  ctx.strokeStyle = C.navy;
  ctx.lineWidth = 3;
  ctx.stroke();

  escribe(ctx, jugador.dorsal || "·", x, y + radio * 0.36, {
    tamano: radio * 1.05,
    tinta: C.navy,
    alinea: "centro",
  });

  /* El nombre, sobre una tira oscura para que se lea encima del césped. */
  const nombre = jugador.nombre.toUpperCase();

  fuente(ctx, radio * 0.62, 600);

  const ancho = anchoEspaciado(ctx, nombre, 0.5) + 14;

  ctx.fillStyle = "rgba(4,18,31,0.82)";
  rectRedondo(ctx, x - ancho / 2, y + radio + 6, ancho, radio * 0.9, radio * 0.3);
  ctx.fill();

  escribe(ctx, nombre, x, y + radio + 6 + radio * 0.66, {
    tamano: radio * 0.62,
    peso: 600,
    tinta: C.papel,
    espaciado: 0.5,
    alinea: "centro",
  });
}

/** El campo con su once puesto. */
function pintaOnceEnCampo(
  ctx: Ctx,
  once: OncePartido,
  caja: { x: number; y: number; w: number; h: number },
  radio: number,
) {
  pintaCampo(ctx, caja.x, caja.y, caja.w, caja.h);

  const sitios = reparteOnce(once);

  /*
  | La ficha encoge con la línea más poblada. Un 4-5-1 pone cinco nombres a lo
  | ancho y con el radio de un 4-4-2 «HUGO REDÓN» se metía encima de «EDU
  | GALLARDO»: se mide la fila más llena y se ajusta para todas, que si no
  | habría fichas de dos tamaños en el mismo campo.
  */
  const porFila = new Map<number, number>();

  for (const sitio of sitios) {
    porFila.set(sitio.y, (porFila.get(sitio.y) ?? 0) + 1);
  }

  const masLlena = Math.max(1, ...porFila.values());

  const cabe = Math.min(radio, caja.w / (masLlena * 2.5));

  for (const sitio of sitios) {
    pintaFichaOnce(
      ctx,
      sitio.jugador,
      caja.x + caja.w * sitio.x,
      caja.y + caja.h * sitio.y,
      cabe,
    );
  }
}

/* ------------------------------------------------------------------ */
/*  6 · POSIBLE ALINEACIÓN                                             */
/* ------------------------------------------------------------------ */

/**
 * El once más reciente, que es la mejor apuesta de por dónde va a salir.
 *
 * No es una predicción: es literalmente el último once publicado, y así se
 * rotula. El once probable de verdad se decide en la pantalla de plantillas,
 * donde el cuerpo técnico lo coloca a mano, y sale en su propio PDF.
 */
function pintaPosibleAlineacion(
  ctx: Ctx,
  data: InformeData,
  escudo: HTMLImageElement | null,
  once: OncePartido,
  partido: Partido | null,
) {
  papel(ctx);
  cabecera(ctx, "ÚLTIMO ONCE", data, escudo);

  const anchoCampo = Math.round(CUERPO_ALTO * 0.68);

  const x = MARGEN + 40;

  pintaOnceEnCampo(
    ctx,
    once,
    { x, y: CUERPO_Y, w: anchoCampo, h: CUERPO_ALTO },
    26,
  );

  /* -------------------------------------------------- la ficha de al lado */

  const xPanel = x + anchoCampo + 36;
  const wPanel = W - MARGEN - xPanel;

  const dentro = panel(ctx, xPanel, CUERPO_Y, wPanel, CUERPO_ALTO, "EL ONCE");

  if (once.estructura) {
    escribe(ctx, once.estructura, xPanel + 24, dentro + 76, {
      tamano: 72,
      tinta: C.navy,
      espaciado: 2,
      maxAncho: wPanel - 48,
    });
  }

  if (once.entrenador) {
    escribe(ctx, once.entrenador.toUpperCase(), xPanel + 24, dentro + 116, {
      tamano: 26,
      peso: 500,
      tinta: "#8A8370",
      espaciado: 3,
      maxAncho: wPanel - 48,
    });
  }

  if (partido) {
    escribe(
      ctx,
      `${partido.local.nombre} ${partido.local.goles ?? 0}-${
        partido.visitante.goles ?? 0
      } ${partido.visitante.nombre}`,
      xPanel + 24,
      dentro + 162,
      {
        tamano: 24,
        peso: 600,
        tinta: C.verde,
        espaciado: 1,
        maxAncho: wPanel - 48,
      },
    );

    escribe(ctx, fechaCorta(partido.fecha), xPanel + 24, dentro + 192, {
      tamano: 20,
      peso: 500,
      tinta: "#9A9384",
      espaciado: 2,
    });
  }

  /* La lista, por si alguien la quiere leer en vez de mirarla. */
  const jugadores = [...once.jugadores].sort((a, b) => a.puesto - b.puesto);

  const arriba = dentro + 226;

  const paso = Math.min(
    46,
    (CUERPO_Y + CUERPO_ALTO - arriba - 16) / Math.max(1, jugadores.length),
  );

  jugadores.forEach((jugador, indice) => {
    const y = arriba + paso * indice;

    ctx.fillStyle = indice % 2 === 0 ? "rgba(0,0,0,0.03)" : "transparent";
    ctx.fillRect(xPanel + 12, y, wPanel - 24, paso - 4);

    escribe(ctx, jugador.dorsal || "·", xPanel + 46, y + paso / 2 + 7, {
      tamano: 24,
      tinta: C.verde,
      alinea: "dcha",
    });

    escribe(ctx, jugador.nombre.toUpperCase(), xPanel + 62, y + paso / 2 + 7, {
      tamano: 24,
      peso: 600,
      tinta: C.navy,
      espaciado: 0.5,
      maxAncho: wPanel - 90,
    });
  });

  pie(ctx, "EL ÚLTIMO ONCE PUBLICADO · NO ES UNA PREDICCIÓN");
}

/* ------------------------------------------------------------------ */
/*  7-8 · ALINEACIONES ANTERIORES                                      */
/* ------------------------------------------------------------------ */

/** Dos partidos por hoja, con su campo y su marcador. */
function pintaAlineaciones(
  ctx: Ctx,
  data: InformeData,
  escudo: HTMLImageElement | null,
  onces: OncePartido[],
  partidos: Map<string, Partido>,
) {
  papel(ctx);
  cabecera(ctx, "ALINEACIONES ANTERIORES", data, escudo);

  /* Con un solo partido —el resto de la temporada sin alineación publicada—
     la columna es la hoja entera: media hoja en blanco al lado de un campo
     estrecho se lee como un error de montaje. */
  const mitad = onces.length > 1 ? (ANCHO - 28) / 2 : ANCHO;

  onces.forEach((once, indice) => {
    const x = MARGEN + indice * (mitad + 28);

    const partido = partidos.get(once.partidoId) ?? null;

    /* -------------------------------------------------- el titular */

    const titulo = partido
      ? `${partido.local.nombre} ${partido.local.goles ?? 0}-${
          partido.visitante.goles ?? 0
        } ${partido.visitante.nombre}`
      : "PARTIDO";

    escribe(ctx, titulo.toUpperCase(), x, CUERPO_Y + 8, {
      tamano: 30,
      tinta: C.navy,
      espaciado: 1,
      maxAncho: mitad - 140,
    });

    if (partido) {
      escribe(ctx, fechaCorta(partido.fecha), x + mitad, CUERPO_Y + 8, {
        tamano: 22,
        peso: 500,
        tinta: "#8A8370",
        espaciado: 2,
        alinea: "dcha",
      });
    }

    if (once.estructura) {
      chapa(ctx, once.estructura, {
        x,
        y: CUERPO_Y + 24,
        alto: 40,
        fondo: C.verde,
        tinta: C.papel,
        tamano: 24,
        espaciado: 3,
        padding: 18,
      });
    }

    if (once.entrenador) {
      escribe(ctx, once.entrenador.toUpperCase(), x + mitad, CUERPO_Y + 52, {
        tamano: 22,
        peso: 500,
        tinta: "#8A8370",
        espaciado: 2,
        alinea: "dcha",
        maxAncho: mitad - 200,
      });
    }

    /* -------------------------------------------------- el campo */

    const y = CUERPO_Y + 80;

    const alto = CUERPO_ALTO - 80;

    /* El campo guarda su proporción y se centra en la columna: estirado a lo
       ancho, un 4-4-2 parece un 4-4-2 aplastado. */
    const anchoCampo = Math.min(mitad, alto * 0.68);

    pintaOnceEnCampo(
      ctx,
      once,
      { x: x + (mitad - anchoCampo) / 2, y, w: anchoCampo, h: alto },
      22,
    );
  });

  pie(ctx, "ALINEACIONES PUBLICADAS · FUENTE BESOCCER");
}

/* ------------------------------------------------------------------ */
/*  ÚLTIMA · CONTRAPORTADA                                             */
/* ------------------------------------------------------------------ */

function pintaContra(ctx: Ctx, data: InformeData, escudo: HTMLImageElement | null) {
  ctx.fillStyle = C.navy;
  ctx.fillRect(0, 0, W, H);

  ctx.fillStyle = C.verde;
  ctx.fillRect(0, H - 12, W, 12);

  /* El bloque —escudo, nombre y firma— se centra ópticamente: colgado del
     centro exacto de la hoja se ve alto, porque casi todo su peso está arriba,
     en el escudo. */
  if (escudo) encaja(ctx, escudo, W / 2 - 120, H / 2 - 250, 240, 240);

  escribe(ctx, data.informe.nombreLargo.toUpperCase(), W / 2, H / 2 + 60, {
    tamano: 72,
    tinta: C.papel,
    espaciado: 6,
    alinea: "centro",
    maxAncho: ANCHO,
  });

  escribe(ctx, `REAL MADRID CASTILLA · TEMP ${data.temporada}`, W / 2, H / 2 + 122, {
    tamano: 28,
    peso: 500,
    tinta: "#8FA3B8",
    espaciado: 8,
    alinea: "centro",
  });
}

/* ------------------------------------------------------------------ */
/*  IMÁGENES                                                           */
/* ------------------------------------------------------------------ */

/**
 * Baja todas las imágenes de una tacada y las deja indexadas por su URL.
 *
 * De seis en seis por lo mismo que el campograma: cuarenta `fetch` a la vez
 * contra el proxy hacen que alguno se caiga por tiempo de espera, y en un
 * informe eso es media clasificación sin escudos. Una que falle vale `null` y
 * su hueco se queda vacío, que es mejor que no exportar nada.
 */
async function bajaImagenes(urls: Iterable<string>) {
  const mapa = new Map<string, HTMLImageElement | null>();

  const lista = [...new Set([...urls].filter(Boolean))];

  const TANDA = 6;

  for (let i = 0; i < lista.length; i += TANDA) {
    const tanda = lista.slice(i, i + TANDA);

    const cargadas = await Promise.all(
      tanda.map((url) => cargaImagen(url).catch(() => null)),
    );

    tanda.forEach((url, indice) => mapa.set(url, cargadas[indice]));
  }

  return mapa;
}

/* ------------------------------------------------------------------ */
/*  EL DOCUMENTO                                                       */
/* ------------------------------------------------------------------ */

/** Un nombre de fichero que se pueda buscar en una carpeta de diecinueve. */
function nombreArchivo(data: InformeData) {
  const equipo = (data.informe.nombre || data.informe.nombreLargo || "rival")
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-zA-Z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .toLowerCase();

  const jornada = data.jornada ? `j${data.jornada}-` : "";

  return `informe-rival-${jornada}${equipo}.pptx`;
}

/** Cuántos resultados caben en la hoja de la temporada. */
const RESULTADOS_EN_HOJA = 14;

/**
 * Monta el `.pptx` del informe y lo descarga. Devuelve cómo se ha llamado.
 */
export async function exportInformePptx(data: InformeData) {
  await esperaFuentePortada();

  const informe = data.informe;

  /* -------------------------------------------------- qué hay que pintar */

  const partidosJugados = jugados(informe);

  const resultados = partidosJugados.slice(0, RESULTADOS_EN_HOJA);

  /* Los que traen goles son los que tienen ficha bajada: son los únicos con
     minutos, y es sobre ellos sobre los que se reparten los tramos. */
  const conFicha = partidosJugados.filter((partido) => partido.goles);

  const porId = new Map(informe.partidos.map((partido) => [partido.id, partido]));

  const onces = informe.onces;

  /* -------------------------------------------------- las imágenes */

  const urls: string[] = [informe.escudo];

  if (informe.entrenador?.foto) urls.push(informe.entrenador.foto);
  if (informe.estadio?.foto) urls.push(informe.estadio.foto);

  for (const fila of informe.clasificacion.total) urls.push(fila.escudo);

  for (const partido of resultados) {
    urls.push(partido.local.escudo, partido.visitante.escudo);
  }

  const imagenes = await bajaImagenes(urls);

  const escudo = imagenes.get(informe.escudo) ?? null;

  /* -------------------------------------------------- las hojas */

  const diapositivas: DiapositivaPptx[] = [];

  /*
  | Una hoja se pinta y se añade sólo si hay algo que enseñar. `hoja()`
  | devuelve el lienzo ya listo para que cada bloque decida por su cuenta.
  |
  | El JPEG a 0,92 pesa un tercio que el PNG y estas hojas son papel y texto,
  | no transparencias: la portada con foto de estadio en PNG se iba a varios
  | megas ella sola.
  */
  const hoja = (titulo: string, pinta: (ctx: Ctx) => void) => {
    const { canvas, ctx } = lienzo(W, H);

    pinta(ctx);

    diapositivas.push({
      titulo,
      imagen: canvas.toDataURL("image/jpeg", 0.92),
    });
  };

  hoja("Portada", (ctx) =>
    pintaPortada(
      ctx,
      data,
      escudo,
      imagenes.get(informe.estadio?.foto ?? "") ?? null,
    ),
  );

  if (informe.clasificacion.total.length > 0) {
    hoja("Clasificación", (ctx) =>
      pintaClasificacion(ctx, data, escudo, imagenes),
    );
  }

  if (resultados.length > 0) {
    hoja("Resultados", (ctx) =>
      pintaResultados(ctx, data, escudo, imagenes, resultados),
    );
  }

  hoja("Estadísticas", (ctx) => pintaEstadisticas(ctx, data, escudo, conFicha));

  if (informe.entrenador || informe.estadio) {
    hoja("El club", (ctx) =>
      pintaClub(
        ctx,
        data,
        escudo,
        imagenes.get(informe.entrenador?.foto ?? "") ?? null,
        imagenes.get(informe.estadio?.foto ?? "") ?? null,
      ),
    );
  }

  if (onces.length > 0) {
    hoja("Último once", (ctx) =>
      pintaPosibleAlineacion(
        ctx,
        data,
        escudo,
        onces[0],
        porId.get(onces[0].partidoId) ?? null,
      ),
    );
  }

  /* Los anteriores, de dos en dos: dos hojas más, como en el original. */
  for (let i = 1; i < Math.min(onces.length, 5); i += 2) {
    const pareja = onces.slice(i, i + 2);

    hoja("Alineaciones anteriores", (ctx) =>
      pintaAlineaciones(ctx, data, escudo, pareja, porId),
    );
  }

  hoja("Contraportada", (ctx) => pintaContra(ctx, data, escudo));

  /* -------------------------------------------------- el paquete */

  const blob = creaPptx(diapositivas, {
    titulo: `Informe de rival · ${informe.nombreLargo}`,
    aplicacion: "RMCF Castilla · Informe del rival",
  });

  const nombre = nombreArchivo(data);

  descarga(blob, nombre);

  return nombre;
}
