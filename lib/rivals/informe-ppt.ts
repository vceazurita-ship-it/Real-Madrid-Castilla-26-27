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
| **Cada bloque va como una pieza suelta.** Al principio no: la diapositiva
| entera salía como una imagen a sangre, porque el informe se lee y no se
| manipula. Duró poco. El cuerpo técnico remata el documento en Office —quita
| el equipo que no interesa de la tabla, se lleva un campo a otra hoja, replica
| una ficha para comparar— y sobre una captura eso no se puede hacer.
|
| Así que la hoja es ahora el papel de fondo más un montón de piezas, cada una
| en su PNG transparente y cada una un objeto propio de PowerPoint. Quien las
| recoge es `GuionHoja` (`informe-elementos.ts`), y antes de exportar se pasa
| por el editor de `components/rivals/InformePptEditor.tsx`, donde se arrastran,
| se estiran, se replican y se borran.
|
| Como `once-pdf` y `portada`, esto **no sabe nada de la hoja ni del estado de
| la página**: recibe el informe ya resuelto y sólo lo coloca y lo pinta.
|
| Una diapositiva sin datos no se pinta vacía: se salta. En agosto no hay
| clasificación que enseñar y en un rival cuyos amistosos nadie ha subido a
| BeSoccer no hay alineaciones; el documento sale con las hojas que tengan algo
| dentro, que es lo que haría cualquiera a mano.
*/

import { creaPptx, type CapaPptx, type DiapositivaPptx } from "@/lib/export/pptx";
import { descarga } from "@/lib/export/lienzos";
import { esperaFuentePortada } from "@/lib/rivals/portada-font";

import {
  GuionHoja,
  LIENZO_H,
  LIENZO_W,
  lienzoInforme,
  type ElementoInforme,
  type HojaInforme,
} from "@/lib/rivals/informe-elementos";

import {
  balance,
  balanceAmistosos,
  esLiga,
  filaPropia,
  jugados,
  rotuloCompeticion,
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
const W = LIENZO_W;
const H = LIENZO_H;

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

const lienzo = lienzoInforme;

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
function papel(g: GuionHoja) {
  g.fondo((ctx) => {
    ctx.fillStyle = C.crema;
    ctx.fillRect(0, 0, W, H);
  });
}

/**
 * La franja de arriba: título a la izquierda, escudo y equipo a la derecha.
 *
 * Es lo que hace que las diez hojas se lean como un documento y no como diez
 * capturas: el mismo alto, la misma tinta y el mismo sitio en todas.
 */
function cabecera(
  g: GuionHoja,
  titulo: string,
  data: InformeData,
  escudo: HTMLImageElement | null,
) {
  /*
  | La franja, el título y el bloque del rival van por separado a posta: quien
  | remonta la hoja en Office suele querer el título en otro sitio, o quitar el
  | escudo porque ya lo lleva la plantilla del club, y con la cabecera en una
  | sola pieza había que borrarla entera.
  */
  g.el("Franja de cabecera", { x: 0, y: 0, w: W, h: CABECERA }, (ctx) => {
    ctx.fillStyle = C.navy;
    ctx.fillRect(0, 0, W, CABECERA);

    /* La pincelada verde de abajo, que es la firma de la plantilla. */
    ctx.fillStyle = C.verde;
    ctx.fillRect(0, CABECERA - 6, W, 6);
  });

  g.el(
    `Título · ${titulo}`,
    { x: MARGEN, y: 18, w: W - MARGEN * 2 - 460, h: 62 },
    (ctx) =>
      escribe(ctx, titulo, MARGEN, 74, {
        tamano: 52,
        tinta: C.papel,
        espaciado: 3,
        maxAncho: W - MARGEN * 2 - 460,
      }),
  );

  /* -------------------------------------------------- a la derecha */

  const derecha = W - MARGEN;

  if (escudo) {
    g.el(
      "Escudo del rival",
      { x: derecha - 78, y: 16, w: 78, h: 78 },
      (ctx) => encaja(ctx, escudo, derecha - 78, 16, 78, 78),
    );
  }

  const finTexto = escudo ? derecha - 96 : derecha;

  g.el(
    "Nombre del rival",
    { x: finTexto - 400, y: 20, w: 400, h: 44 },
    (ctx) =>
      escribe(ctx, data.informe.nombreLargo.toUpperCase(), finTexto, 56, {
        tamano: 34,
        tinta: C.papel,
        espaciado: 2,
        alinea: "dcha",
        maxAncho: 380,
      }),
  );

  g.el("Temporada", { x: finTexto - 400, y: 62, w: 400, h: 30 }, (ctx) =>
    escribe(ctx, `TEMPORADA ${data.temporada}`, finTexto, 84, {
      tamano: 20,
      peso: 500,
      tinta: "#8FA3B8",
      espaciado: 3,
      alinea: "dcha",
    }),
  );
}

/** El pie: quién lo firma y de dónde salen los números. */
function pie(g: GuionHoja, nota: string) {
  g.el("Línea del pie", { x: MARGEN, y: H - 54, w: ANCHO, h: 4 }, (ctx) => {
    ctx.fillStyle = "#C3BCA9";
    ctx.fillRect(MARGEN, H - 52, ANCHO, 1);
  });

  g.el("Firma del pie", { x: MARGEN, y: H - 48, w: 420, h: 30 }, (ctx) =>
    escribe(ctx, "REAL MADRID CASTILLA", MARGEN, H - 26, {
      tamano: 19,
      peso: 600,
      tinta: "#8A8370",
      espaciado: 3,
    }),
  );

  g.el(
    "Nota del pie",
    { x: W - MARGEN - 1100, y: H - 48, w: 1100, h: 30 },
    (ctx) =>
      escribe(ctx, nota, W - MARGEN, H - 26, {
        tamano: 19,
        peso: 500,
        tinta: "#8A8370",
        espaciado: 2,
        alinea: "dcha",
      }),
  );
}

/**
 * Un panel de los que dividen el cuerpo de una hoja.
 *
 * El panel es **una pieza sola** —marco y cinta— y lo que va dentro son otras
 * tantas: así se puede mover el bloque entero arrastrando su marco, o quitar
 * el marco y dejar el contenido suelto sobre el papel.
 *
 * Devuelve, como siempre, dónde empieza lo de dentro.
 */
function panel(
  g: GuionHoja,
  x: number,
  y: number,
  w: number,
  h: number,
  titulo: string,
) {
  g.el(
    titulo ? `Panel · ${titulo}` : "Panel",
    { x, y, w, h },
    (ctx) => {
      ctx.fillStyle = C.papel;
      rectRedondo(ctx, x, y, w, h, 18);
      ctx.fill();

      if (!titulo) return;

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
    },
  );

  return titulo ? y + 46 : y + 28;
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
  g: GuionHoja,
  partidos: Partido[],
  caja: { x: number; y: number; w: number; h: number },
) {
  if (partidos.length === 0) {
    g.el(
      "Racha · sin partidos",
      { x: caja.x, y: caja.y + 16, w: caja.w, h: 40 },
      (ctx) =>
        escribe(ctx, "SIN PARTIDOS JUGADOS", caja.x + caja.w / 2, caja.y + 46, {
          tamano: 24,
          peso: 500,
          tinta: "#9A9384",
          espaciado: 2,
          alinea: "centro",
        }),
    );

    return;
  }

  const paso = Math.min(56, caja.h / partidos.length);

  /* Una pieza por partido, no una tira entera: así se quita el amistoso que
     ensucia la racha sin repintar nada. */
  partidos.forEach((partido, indice) => {
    const y = caja.y + paso * indice;

    const rival = partido.enCasa ? partido.visitante : partido.local;

    g.el(
      `Racha · ${partido.resultado || "·"} ${rival.nombre}`,
      { x: caja.x, y, w: caja.w, h: paso },
      (ctx) => {
        const centro = y + paso / 2;

        /* El disco con la letra: es lo que se lee de un vistazo. */
        const radio = Math.min(17, paso / 2 - 5);

        ctx.fillStyle = tintaResultado(partido.resultado);
        ctx.beginPath();
        ctx.arc(caja.x + 24 + radio, centro, radio, 0, Math.PI * 2);
        ctx.fill();

        escribe(
          ctx,
          partido.resultado || "·",
          caja.x + 24 + radio,
          centro + radio * 0.42,
          {
            tamano: radio * 1.2,
            tinta: C.papel,
            alinea: "centro",
          },
        );

        /* Contra quién, y en qué campo. */
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

        escribe(
          ctx,
          fechaCorta(partido.fecha),
          caja.x + caja.w - 82,
          centro + 7,
          {
            tamano: 17,
            peso: 500,
            tinta: "#9A9384",
            espaciado: 1,
            alinea: "dcha",
          },
        );
      },
    );
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
  g: GuionHoja,
  data: InformeData,
  escudo: HTMLImageElement | null,
  estadio: HTMLImageElement | null,
) {
  /* La foto y su velo van al fondo: es el papel de esta hoja, no una pieza. */
  g.fondo((ctx) => {
    ctx.fillStyle = C.navy;
    ctx.fillRect(0, 0, W, H);

    if (!estadio) return;

    cubre(ctx, estadio, 0, 0, W, H, 0.4);

    /* El velo: sin él la foto se come el texto, y con él el documento tiene el
       azul de la casa en la primera hoja. */
    const velo = ctx.createLinearGradient(0, 0, W, H);

    velo.addColorStop(0, "rgba(15,30,61,0.94)");
    velo.addColorStop(1, "rgba(15,30,61,0.72)");

    ctx.fillStyle = velo;
    ctx.fillRect(0, 0, W, H);
  });

  /* -------------------------------------------------- el escudo */

  if (escudo) {
    g.el(
      "Escudo grande",
      { x: MARGEN + 20, y: H / 2 - 190, w: 340, h: 340 },
      (ctx) => encaja(ctx, escudo, MARGEN + 20, H / 2 - 190, 340, 340),
    );
  }

  /* -------------------------------------------------- el titular */

  const x = MARGEN + 420;

  if (data.jornada) {
    g.el(
      `Chapa · JORNADA ${data.jornada}`,
      { x, y: H / 2 - 214, w: 340, h: 52 },
      (ctx) =>
        chapa(ctx, `JORNADA ${data.jornada}`, {
          x,
          y: H / 2 - 214,
          alto: 52,
          fondo: C.rosa,
          tinta: C.navy,
          tamano: 28,
          espaciado: 5,
          padding: 26,
        }),
    );
  }

  g.el(
    "Antetítulo · INFORME DE RIVAL",
    { x, y: H / 2 - 160, w: W - x - MARGEN, h: 56 },
    (ctx) =>
      escribe(ctx, "INFORME DE RIVAL", x, H / 2 - 116, {
        tamano: 46,
        peso: 600,
        tinta: "#8FA3B8",
        espaciado: 12,
      }),
  );

  g.el(
    "Titular · nombre del rival",
    { x, y: H / 2 - 124, w: W - x - MARGEN, h: 148 },
    (ctx) =>
      escribe(ctx, data.informe.nombreLargo.toUpperCase(), x, H / 2 + 10, {
        tamano: 128,
        tinta: C.papel,
        espaciado: 2,
        maxAncho: W - x - MARGEN,
      }),
  );

  /* Dónde y cuándo se juega. */
  const donde = data.enSuCampo
    ? data.informe.estadio?.nombre?.toUpperCase() || "EN SU CAMPO"
    : "EN EL ALFREDO DI STÉFANO";

  const cuando = data.fecha ? ` · ${fechaLarga(data.fecha)}` : "";

  g.el(
    "Dónde y cuándo",
    { x, y: H / 2 + 28, w: W - x - MARGEN, h: 48 },
    (ctx) =>
      escribe(ctx, `${donde}${cuando}`, x, H / 2 + 66, {
        tamano: 30,
        peso: 500,
        tinta: C.rosa,
        espaciado: 5,
        maxAncho: W - x - MARGEN,
      }),
  );

  /* -------------------------------------------------- el pie */

  g.el(
    "Línea del pie",
    { x: MARGEN, y: H - 110, w: ANCHO, h: 4 },
    (ctx) => {
      ctx.fillStyle = "rgba(255,255,255,0.18)";
      ctx.fillRect(MARGEN, H - 108, ANCHO, 1);
    },
  );

  g.el("Firma del pie", { x: MARGEN, y: H - 96, w: 900, h: 44 }, (ctx) =>
    escribe(ctx, `REAL MADRID CASTILLA · TEMP ${data.temporada}`, MARGEN, H - 62, {
      tamano: 28,
      peso: 600,
      tinta: C.papel,
      espaciado: 6,
    }),
  );

  g.el(
    "Competición",
    { x: W - MARGEN - 800, y: H - 92, w: 800, h: 40 },
    (ctx) =>
      escribe(ctx, data.competicion.toUpperCase(), W - MARGEN, H - 62, {
        tamano: 24,
        peso: 500,
        tinta: "#8FA3B8",
        espaciado: 4,
        alinea: "dcha",
      }),
  );
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
  g: GuionHoja,
  filas: FilaClasificacion[],
  informe: InformeEquipo,
  escudos: Map<string, HTMLImageElement | null>,
  caja: { x: number; y: number; w: number; h: number },
) {
  const anchoNumeros = COLUMNAS.reduce((total, col) => total + col.w, 0);

  const paso = Math.min(38, (caja.h - 34) / Math.max(1, filas.length));

  /* -------------------------------------------------- cabecera */

  g.el(
    "Tabla · cabecera de columnas",
    { x: caja.x + caja.w - 12 - anchoNumeros, y: caja.y, w: anchoNumeros, h: 30 },
    (ctx) => {
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
    },
  );

  /* -------------------------------------------------- filas */

  /*
  | Cada equipo, una pieza. Es la razón de ser de todo esto: la tabla de
  | diecinueve no cabe en la charla, y en Office se borran de un tirón los ocho
  | que no pintan nada dejando al rival con los tres de arriba y los tres de
  | abajo.
  */
  filas.forEach((fila, indice) => {
    const y = caja.y + 34 + paso * indice;

    const mio = fila.slug === informe.slug;

    g.el(
      `Tabla · ${fila.puesto}º ${fila.equipo}`,
      { x: caja.x, y, w: caja.w, h: paso },
      (ctx) => {
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
      },
    );
  });
}

/** El resumen de una pestaña —local o visitante— en cifras grandes. */
function pintaResumenTabla(
  g: GuionHoja,
  titulo: string,
  fila: FilaClasificacion | null,
  caja: { x: number; y: number; w: number; h: number },
  destacado: boolean,
) {
  const dentro = panel(g, caja.x, caja.y, caja.w, caja.h, titulo);

  if (!fila) {
    g.el(
      `${titulo} · sin datos`,
      { x: caja.x, y: dentro + 30, w: caja.w, h: 40 },
      (ctx) =>
        escribe(ctx, "SIN DATOS TODAVÍA", caja.x + caja.w / 2, dentro + 60, {
          tamano: 24,
          peso: 500,
          tinta: "#9A9384",
          espaciado: 2,
          alinea: "centro",
        }),
    );

    return;
  }

  if (destacado) {
    g.el(
      `${titulo} · destacado`,
      { x: caja.x, y: dentro, w: caja.w, h: caja.h - (dentro - caja.y) },
      (ctx) => {
        ctx.fillStyle = "rgba(246,175,182,0.35)";
        ctx.fillRect(caja.x, dentro, caja.w, caja.h - (dentro - caja.y));
      },
    );
  }

  /* El puesto, que es lo que se lee de lejos. */
  g.el(
    `${titulo} · puesto`,
    { x: caja.x + 24, y: dentro + 6, w: 150, h: 84 },
    (ctx) =>
      escribe(ctx, `${fila.puesto}º`, caja.x + 30, dentro + 78, {
        tamano: 76,
        tinta: C.navy,
      }),
  );

  g.el(
    `${titulo} · puntos`,
    { x: caja.x + 24, y: dentro + 86, w: 150, h: 34 },
    (ctx) =>
      escribe(ctx, `${fila.puntos} PTS`, caja.x + 30, dentro + 112, {
        tamano: 26,
        peso: 600,
        tinta: C.verde,
        espaciado: 3,
      }),
  );

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

    g.el(
      `${titulo} · ${celda.titulo}`,
      { x: x - ancho / 2, y: y - 38, w: ancho, h: 70 },
      (ctx) => {
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
      },
    );
  });
}

function pintaClasificacion(
  g: GuionHoja,
  data: InformeData,
  escudo: HTMLImageElement | null,
  escudos: Map<string, HTMLImageElement | null>,
) {
  papel(g);
  cabecera(g, "CLASIFICACIÓN", data, escudo);

  const informe = data.informe;

  const anchoTabla = Math.round(ANCHO * 0.58);

  /* -------------------------------------------------- la tabla entera */

  const dentro = panel(g, MARGEN, CUERPO_Y, anchoTabla, CUERPO_ALTO, "TOTAL");

  pintaTablaClasificacion(g, informe.clasificacion.total, informe, escudos, {
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
    g,
    "COMO LOCAL",
    filaPropia(informe.clasificacion.local, informe),
    { x, y: CUERPO_Y, w, h: alto },
    data.enSuCampo,
  );

  pintaResumenTabla(
    g,
    "COMO VISITANTE",
    filaPropia(informe.clasificacion.visitante, informe),
    { x, y: CUERPO_Y + alto + 20, w, h: alto },
    !data.enSuCampo,
  );

  const yRacha = CUERPO_Y + alto * 2 + 40;

  const altoRacha = CUERPO_Y + CUERPO_ALTO - yRacha;

  const dentroRacha = panel(g, x, yRacha, w, altoRacha, "ÚLTIMOS PARTIDOS");

  pintaRacha(g, jugados(informe).slice(0, 6), {
    x,
    y: dentroRacha + 8,
    w,
    h: altoRacha - (dentroRacha - yRacha) - 16,
  });

  pie(
    g,
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
  g: GuionHoja,
  data: InformeData,
  escudo: HTMLImageElement | null,
  escudos: Map<string, HTMLImageElement | null>,
  partidos: Partido[],
) {
  papel(g);
  cabecera(g, "RESULTADOS DE LA TEMPORADA", data, escudo);

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

    const caja = {
      x: MARGEN + columna * (anchoColumna + hueco),
      y: arriba + fila * (alto + hueco),
      w: anchoColumna,
      h: alto,
    };

    /* La ficha entera es una pieza: se mueve, se replica y se borra de una,
       que es como se lee —marcador en el centro y un equipo a cada lado—. */
    g.el(
      `Resultado · ${partido.local.nombre} ${partido.local.goles ?? 0}-${
        partido.visitante.goles ?? 0
      } ${partido.visitante.nombre}${esLiga(partido) ? "" : " (amistoso)"}`,
      caja,
      (ctx) => pintaResultado(ctx, partido, escudos, caja),
    );
  });

  pie(g, "GOLEADORES DE LOS ÚLTIMOS PARTIDOS · FUENTE BESOCCER");
}

/* ------------------------------------------------------------------ */
/*  4 · ESTADÍSTICAS                                                   */
/* ------------------------------------------------------------------ */

/** Una cifra grande con su rótulo debajo, como pieza suelta. */
function cifra(
  g: GuionHoja,
  nombre: string,
  valor: string,
  rotulo: string,
  x: number,
  y: number,
  tinta = C.navy,
  tamano = 62,
) {
  g.el(
    nombre,
    { x: x - 130, y: y - tamano - 4, w: 260, h: tamano + 44 },
    (ctx) => {
      escribe(ctx, valor, x, y, { tamano, tinta, alinea: "centro" });

      escribe(ctx, rotulo, x, y + 28, {
        tamano: 18,
        peso: 500,
        tinta: "#8A8370",
        espaciado: 2,
        alinea: "centro",
      });
    },
  );
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
  g: GuionHoja,
  data: InformeData,
  escudo: HTMLImageElement | null,
  conFicha: Partido[],
) {
  papel(g);
  cabecera(g, "ESTADÍSTICAS", data, escudo);

  const informe = data.informe;

  /*
  | **Liga y amistosos, por separado.** Antes se enseñaba una sola fila de
  | cifras: la de liga en cuanto había liga, y la de pretemporada mientras no
  | la hubiera. En septiembre eso deja fuera media docena de partidos que el
  | cuerpo técnico sí mira —contra quién se probó, cuánto se encajó—, y en
  | agosto hacía creer que aquellos cuatro amistosos eran competición.
  |
  | Ahora salen los dos balances, cada uno con su rótulo y sólo si tiene
  | partidos: en octubre la pretemporada ya no ocupa hoja, y en agosto no hay
  | un panel de ceros haciendo de liga.
  */
  const liga = balance(informe, true);
  const amistosos = balanceAmistosos(informe);

  type Cuenta = ReturnType<typeof balance>;

  const bloques: { titulo: string; cuenta: Cuenta; corto: string }[] = [];

  if (liga.partidos > 0) {
    bloques.push({ titulo: "BALANCE OFICIAL", cuenta: liga, corto: "LIGA" });
  }

  if (amistosos.partidos > 0) {
    bloques.push({
      titulo: "PRETEMPORADA · AMISTOSOS",
      cuenta: amistosos,
      corto: "AMIST.",
    });
  }

  if (bloques.length === 0) {
    bloques.push({ titulo: "BALANCE", cuenta: liga, corto: "" });
  }

  const dos = bloques.length > 1;

  /* Con los dos balances las cifras encogen: siguen leyéndose de lejos y la
     hoja no se come el gráfico de abajo, que es lo que más se mira. */
  const altoBloque = dos ? 146 : 180;

  const tamanoCifra = dos ? 46 : 62;

  const alto = altoBloque * bloques.length + (bloques.length - 1) * 24;

  const altoAbajo = CUERPO_ALTO - 24 - alto;

  /* -------------------------------------------------- arriba: el balance */

  const anchoIzq = Math.round(ANCHO * 0.62);

  const ancho = anchoIzq / 6;

  bloques.forEach((bloque) => {
    const y = CUERPO_Y + bloques.indexOf(bloque) * (altoBloque + 24);

    const dentroBloque = panel(g, MARGEN, y, anchoIzq, altoBloque, bloque.titulo);

    const celdas: [string, string, string][] = [
      [String(bloque.cuenta.partidos), "PARTIDOS", C.navy],
      [String(bloque.cuenta.ganados), "GANADOS", VERDE_VICTORIA],
      [String(bloque.cuenta.empatados), "EMPATADOS", AMARILLO_EMPATE],
      [String(bloque.cuenta.perdidos), "PERDIDOS", ROJO_DERROTA],
      [String(bloque.cuenta.favor), "A FAVOR", C.verde],
      [String(bloque.cuenta.contra), "EN CONTRA", "#9A6169"],
    ];

    /* En una sola fila: el panel es ancho y bajo, y seis cifras seguidas se
       leen de corrido como el marcador de un estadio. */
    const base =
      dentroBloque + (altoBloque - 46 + tamanoCifra) / 2 - 12;

    celdas.forEach(([valor, rotulo, tinta], indice) => {
      cifra(
        g,
        `${bloque.corto || "BALANCE"} · ${rotulo}`,
        valor,
        rotulo,
        MARGEN + ancho * indice + ancho / 2,
        base,
        tinta,
        tamanoCifra,
      );
    });
  });

  /* -------------------------------------------------- arriba dcha: medias */

  const xDer = MARGEN + anchoIzq + 24;
  const wDer = ANCHO - anchoIzq - 24;

  const dentroMedias = panel(g, xDer, CUERPO_Y, wDer, alto, "POR PARTIDO");

  const altoMedia = (alto - 46) / bloques.length;

  bloques.forEach((bloque, indice) => {
    const media = (valor: number) =>
      bloque.cuenta.partidos > 0
        ? (valor / bloque.cuenta.partidos).toFixed(2)
        : "—";

    const base =
      dentroMedias + altoMedia * indice + altoMedia / 2 + tamanoCifra / 2 - 14;

    const sufijo = dos ? ` · ${bloque.corto}` : "";

    cifra(
      g,
      `MEDIA · A FAVOR${sufijo}`,
      media(bloque.cuenta.favor),
      `A FAVOR${sufijo}`,
      xDer + wDer / 4,
      base,
      C.verde,
      tamanoCifra,
    );

    cifra(
      g,
      `MEDIA · EN CONTRA${sufijo}`,
      media(bloque.cuenta.contra),
      `EN CONTRA${sufijo}`,
      xDer + (wDer * 3) / 4,
      base,
      "#9A6169",
      tamanoCifra,
    );
  });

  /* -------------------------------------------------- abajo izq: tramos */

  const yAbajo = CUERPO_Y + alto + 24;

  const anchoTramos = Math.round(ANCHO * 0.62);

  /*
  | El gráfico no mezcla: si hay partidos de liga con ficha bajada, los tramos
  | son de liga y así lo dice el rótulo; si todavía no los hay, son los de la
  | pretemporada. Sumar un 3-0 de agosto contra un juvenil a los goles de la
  | jornada daba un dibujo que no servía para preparar nada.
  */
  const conFichaLiga = conFicha.filter((partido) => esLiga(partido));

  const conFichaAmistosos = conFicha.filter((partido) => !esLiga(partido));

  const deLiga = conFichaLiga.length > 0;

  const paraTramos = deLiga ? conFichaLiga : conFichaAmistosos;

  const dentro = panel(
    g,
    MARGEN,
    yAbajo,
    anchoTramos,
    altoAbajo,
    `CUÁNDO MARCA Y CUÁNDO ENCAJA · ${deLiga ? "LIGA" : "PRETEMPORADA"}`,
  );

  const reparto = tramos(paraTramos);

  if (reparto.total === 0) {
    g.el(
      "Tramos · sin goles",
      { x: MARGEN, y: dentro + 60, w: anchoTramos, h: 44 },
      (ctx) =>
        escribe(
          ctx,
          "SIN GOLES QUE REPARTIR TODAVÍA",
          MARGEN + anchoTramos / 2,
          dentro + 90,
          {
            tamano: 26,
            peso: 500,
            tinta: "#9A9384",
            espaciado: 2,
            alinea: "centro",
          },
        ),
    );
  } else {
    const maximo = Math.max(1, ...reparto.favor, ...reparto.contra);

    const anchoBarra = (anchoTramos - 60) / reparto.cortes.length;

    const base = yAbajo + altoAbajo - 54;

    const altoMax = base - dentro - 40;

    reparto.cortes.forEach((corte, indice) => {
      const x = MARGEN + 30 + anchoBarra * indice;

      const mitad = anchoBarra / 2 - 8;

      /* Un tramo, una pieza: incluye sus dos barras, sus dos números y la
         etiqueta de minutos, que es lo que se mueve junto. */
      g.el(
        `Tramo · ${corte - 14}'-${corte}'`,
        { x, y: dentro + 20, w: anchoBarra, h: base + 34 - dentro - 20 },
        (ctx) => {
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

          escribe(ctx, `${corte - 14}'-${corte}'`, x + anchoBarra / 2, base + 26, {
            tamano: 17,
            peso: 500,
            tinta: "#8A8370",
            espaciado: 1,
            alinea: "centro",
          });
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

  const dentroGoleadores = panel(
    g,
    xDer,
    yAbajo,
    wDer,
    altoGoleadores,
    "MÁXIMOS GOLEADORES",
  );

  if (goleadores.length === 0) {
    g.el(
      "Goleadores · sin datos",
      { x: xDer, y: dentroGoleadores + 50, w: wDer, h: 40 },
      (ctx) =>
        escribe(
          ctx,
          "SIN GOLEADORES REGISTRADOS",
          xDer + wDer / 2,
          dentroGoleadores + 80,
          {
            tamano: 24,
            peso: 500,
            tinta: "#9A9384",
            espaciado: 2,
            alinea: "centro",
          },
        ),
    );
  } else {
    const paso = PASO_GOLEADOR;

    goleadores.forEach((goleador, indice) => {
      const y = dentroGoleadores + 20 + paso * indice;

      g.el(
        `Goleador · ${goleador.nombre} (${goleador.goles})`,
        { x: xDer + 12, y, w: wDer - 24, h: paso - 6 },
        (ctx) => {
          ctx.fillStyle = indice % 2 === 0 ? "rgba(0,0,0,0.03)" : "transparent";
          ctx.fillRect(xDer + 12, y, wDer - 24, paso - 6);

          escribe(
            ctx,
            goleador.nombre.toUpperCase(),
            xDer + 28,
            y + paso / 2 + 6,
            {
              tamano: 26,
              peso: 600,
              tinta: C.navy,
              espaciado: 1,
              maxAncho: wDer - 140,
            },
          );

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
        },
      );
    });
  }

  /*
  | El pie dice de cuántos partidos salen los minutos y **de qué clase son**:
  | los goleadores los da BeSoccer sumados de toda la temporada, amistosos
  | incluidos, y eso hay que decirlo donde se lee la cifra.
  */
  pie(
    g,
    `TRAMOS DE ${paraTramos.length} PARTIDO${
      paraTramos.length === 1 ? "" : "S"
    } ${deLiga ? "DE LIGA" : "DE PRETEMPORADA"}${
      deLiga && conFichaAmistosos.length > 0
        ? ` · ${conFichaAmistosos.length} AMISTOSO${
            conFichaAmistosos.length === 1 ? "" : "S"
          } FUERA DEL GRÁFICO`
        : ""
    } · GOLEADORES DE TODA LA TEMPORADA · FUENTE BESOCCER`,
  );
}

/* ------------------------------------------------------------------ */
/*  5 · ENTRENADOR Y ESTADIO                                           */
/* ------------------------------------------------------------------ */

function pintaClub(
  g: GuionHoja,
  data: InformeData,
  escudo: HTMLImageElement | null,
  retratoEntrenador: HTMLImageElement | null,
  fotoEstadio: HTMLImageElement | null,
) {
  papel(g);
  cabecera(g, "EL CLUB", data, escudo);

  const informe = data.informe;

  const mitad = (ANCHO - 24) / 2;

  /*
  | Los dos paneles miden lo que necesitan y la tira de resultados se queda con
  | el resto: ficha de entrenador y ficha de estadio son dos bloques cortos, y
  | estirados a toda la hoja dejaban medio folio en blanco cada uno.
  */
  const altoFicha = 620;

  /* -------------------------------------------------- entrenador */

  const dentro = panel(g, MARGEN, CUERPO_Y, mitad, altoFicha, "ENTRENADOR");

  const entrenador = informe.entrenador;

  if (!entrenador) {
    g.el(
      "Entrenador · sin datos",
      { x: MARGEN, y: dentro + 50, w: mitad, h: 44 },
      (ctx) =>
        escribe(ctx, "SIN DATOS", MARGEN + mitad / 2, dentro + 80, {
          tamano: 28,
          peso: 500,
          tinta: "#9A9384",
          espaciado: 3,
          alinea: "centro",
        }),
    );
  } else {
    if (retratoEntrenador) {
      g.el(
        "Retrato del entrenador",
        { x: MARGEN + 28, y: dentro + 38, w: 204, h: 204 },
        (ctx) => {
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
        },
      );
    }

    g.el(
      `Entrenador · ${entrenador.nombre}`,
      { x: MARGEN + 258, y: dentro + 56, w: mitad - 290, h: 60 },
      (ctx) =>
        escribe(ctx, entrenador.nombre.toUpperCase(), MARGEN + 258, dentro + 110, {
          tamano: 48,
          tinta: C.navy,
          espaciado: 1,
          maxAncho: mitad - 290,
        }),
    );

    if (entrenador.edad) {
      g.el(
        "Entrenador · edad",
        { x: MARGEN + 258, y: dentro + 124, w: 300, h: 34 },
        (ctx) =>
          escribe(ctx, `${entrenador.edad} AÑOS`, MARGEN + 258, dentro + 152, {
            tamano: 26,
            peso: 500,
            tinta: "#8A8370",
            espaciado: 3,
          }),
      );
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
        g,
        `ENTRENADOR · ${rotulo}`,
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
      g.el(
        "Rótulo · ESTRUCTURAS",
        { x: MARGEN + 30, y: dentro + 398, w: 300, h: 32 },
        (ctx) =>
          escribe(ctx, "ESTRUCTURAS", MARGEN + 30, dentro + 424, {
            tamano: 22,
            peso: 600,
            tinta: "#8A8370",
            espaciado: 4,
          }),
      );

      let x = MARGEN + 30;

      for (const estructura of informe.estructuras.slice(0, 4)) {
        const principal = estructura === informe.estructuras[0];

        const izquierda = x;

        /* "1-4-2-3-1 ×3": el aspa dice «tres veces» sin tener que explicarlo.
           Con un punto en medio parecía parte del dibujo.

           Cada chapa va suelta: en la pizarra se acaba tirando de una sola
           estructura, y las otras tres sobran. */
        let anchoChapa = 0;

        g.el(
          `Estructura · ${estructura.estructura} ×${estructura.veces}`,
          { x: izquierda, y: dentro + 444, w: 320, h: 46 },
          (ctx) => {
            anchoChapa = chapa(ctx, `${estructura.estructura} ×${estructura.veces}`, {
              x: izquierda,
              y: dentro + 444,
              alto: 46,
              fondo: principal ? C.verde : "rgba(27,58,46,0.12)",
              tinta: principal ? C.papel : C.verde,
              tamano: 26,
              espaciado: 2,
              padding: 20,
            });
          },
        );

        x += anchoChapa + 12;
      }
    }
  }

  /* -------------------------------------------------- estadio */

  const x = MARGEN + mitad + 24;

  const dentroEstadio = panel(g, x, CUERPO_Y, mitad, altoFicha, "ESTADIO");

  const estadio = informe.estadio;

  if (!estadio) {
    g.el(
      "Estadio · sin datos",
      { x, y: dentroEstadio + 50, w: mitad, h: 44 },
      (ctx) =>
        escribe(ctx, "SIN DATOS", x + mitad / 2, dentroEstadio + 80, {
          tamano: 28,
          peso: 500,
          tinta: "#9A9384",
          espaciado: 3,
          alinea: "centro",
        }),
    );
  } else {
    const altoFoto = 300;

    g.el(
      "Foto del estadio",
      { x: x + 20, y: dentroEstadio + 20, w: mitad - 40, h: altoFoto },
      (ctx) => {
        if (fotoEstadio) {
          ctx.save();
          rectRedondo(ctx, x + 20, dentroEstadio + 20, mitad - 40, altoFoto, 12);
          ctx.clip();
          cubre(
            ctx,
            fotoEstadio,
            x + 20,
            dentroEstadio + 20,
            mitad - 40,
            altoFoto,
            0.5,
          );
          ctx.restore();
        } else {
          ctx.fillStyle = "rgba(0,0,0,0.05)";
          rectRedondo(ctx, x + 20, dentroEstadio + 20, mitad - 40, altoFoto, 12);
          ctx.fill();
        }
      },
    );

    g.el(
      `Estadio · ${estadio.nombre}`,
      { x: x + 30, y: dentroEstadio + altoFoto + 28, w: mitad - 60, h: 60 },
      (ctx) =>
        escribe(
          ctx,
          estadio.nombre.toUpperCase(),
          x + 30,
          dentroEstadio + altoFoto + 84,
          {
            tamano: 46,
            tinta: C.navy,
            espaciado: 1,
            maxAncho: mitad - 60,
          },
        ),
    );

    if (estadio.ciudad) {
      g.el(
        "Estadio · ciudad",
        { x: x + 30, y: dentroEstadio + altoFoto + 92, w: mitad - 60, h: 34 },
        (ctx) =>
          escribe(
            ctx,
            estadio.ciudad.toUpperCase(),
            x + 30,
            dentroEstadio + altoFoto + 120,
            {
              tamano: 24,
              peso: 500,
              tinta: "#8A8370",
              espaciado: 4,
              maxAncho: mitad - 60,
            },
          ),
      );
    }

    const datos: [string, string][] = [
      [estadio.capacidad ? `${estadio.capacidad}` : "—", "ESPECTADORES"],
      [estadio.tamano || "—", "TAMAÑO"],
      [estadio.construccion || "—", "CONSTRUIDO"],
    ];

    const ancho = mitad / 3;

    datos.forEach(([valor, rotulo], indice) => {
      cifra(
        g,
        `ESTADIO · ${rotulo}`,
        valor,
        rotulo,
        x + ancho * indice + ancho / 2,
        dentroEstadio + altoFoto + 210,
        C.navy,
        valor.length > 6 ? 34 : 46,
      );
    });
  }

  /* -------------------------------------------------- la racha, abajo */

  const yRacha = CUERPO_Y + altoFicha + 24;

  const altoRacha = CUERPO_Y + CUERPO_ALTO - yRacha;

  const dentroRacha = panel(
    g,
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

    pintaRacha(g, columna, {
      x: MARGEN + indice * (mitadRacha + 24),
      y: dentroRacha + 8,
      w: mitadRacha,
      h: alturaFilas,
    });
  });

  pie(g, "DATOS DEL CLUB · FUENTE BESOCCER");
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

/**
 * El campo con su once puesto.
 *
 * El césped es una pieza y **cada jugador es otra**: así se arrastra a un
 * lateral a donde de verdad se pone, se replica una ficha para enseñar el
 * cambio de banda y se borra al que se sabe que no juega, todo en Office y sin
 * volver a la app.
 */
function pintaOnceEnCampo(
  g: GuionHoja,
  once: OncePartido,
  caja: { x: number; y: number; w: number; h: number },
  radio: number,
  etiqueta: string,
) {
  g.el(etiqueta ? `Campo · ${etiqueta}` : "Campo", caja, (ctx) =>
    pintaCampo(ctx, caja.x, caja.y, caja.w, caja.h),
  );

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
    const cx = caja.x + caja.w * sitio.x;
    const cy = caja.y + caja.h * sitio.y;

    g.el(
      `${etiqueta ? `${etiqueta} · ` : ""}Nº${sitio.jugador.dorsal || "·"} ${
        sitio.jugador.nombre
      }`,
      { x: cx - 210, y: cy - cabe - 4, w: 420, h: cabe * 2 + cabe + 24 },
      (ctx) => pintaFichaOnce(ctx, sitio.jugador, cx, cy, cabe),
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
  g: GuionHoja,
  data: InformeData,
  escudo: HTMLImageElement | null,
  once: OncePartido,
  partido: Partido | null,
) {
  papel(g);

  /* De qué partido es este once: sin esto, un 1-4-4-2 de un amistoso de
     agosto se leía el viernes como el once de la última jornada. */
  const oficial = partido ? esLiga(partido) : true;

  cabecera(
    g,
    partido ? `ÚLTIMO ONCE · ${oficial ? "LIGA" : "AMISTOSO"}` : "ÚLTIMO ONCE",
    data,
    escudo,
  );

  const anchoCampo = Math.round(CUERPO_ALTO * 0.68);

  const x = MARGEN + 40;

  pintaOnceEnCampo(
    g,
    once,
    { x, y: CUERPO_Y, w: anchoCampo, h: CUERPO_ALTO },
    26,
    "Último once",
  );

  /* -------------------------------------------------- la ficha de al lado */

  const xPanel = x + anchoCampo + 36;
  const wPanel = W - MARGEN - xPanel;

  const dentro = panel(g, xPanel, CUERPO_Y, wPanel, CUERPO_ALTO, "EL ONCE");

  if (once.estructura) {
    g.el(
      `Estructura · ${once.estructura}`,
      { x: xPanel + 24, y: dentro + 12, w: wPanel - 48, h: 80 },
      (ctx) =>
        escribe(ctx, once.estructura, xPanel + 24, dentro + 76, {
          tamano: 72,
          tinta: C.navy,
          espaciado: 2,
          maxAncho: wPanel - 48,
        }),
    );
  }

  if (once.entrenador) {
    g.el(
      "Entrenador del once",
      { x: xPanel + 24, y: dentro + 88, w: wPanel - 48, h: 34 },
      (ctx) =>
        escribe(ctx, once.entrenador.toUpperCase(), xPanel + 24, dentro + 116, {
          tamano: 26,
          peso: 500,
          tinta: "#8A8370",
          espaciado: 3,
          maxAncho: wPanel - 48,
        }),
    );
  }

  if (partido) {
    g.el(
      "Marcador del partido",
      { x: xPanel + 24, y: dentro + 134, w: wPanel - 48, h: 34 },
      (ctx) =>
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
        ),
    );

    g.el(
      "Fecha del partido",
      { x: xPanel + 24, y: dentro + 170, w: wPanel - 48, h: 28 },
      (ctx) =>
        escribe(ctx, fechaCorta(partido.fecha), xPanel + 24, dentro + 192, {
          tamano: 20,
          peso: 500,
          tinta: "#9A9384",
          espaciado: 2,
        }),
    );

    /* La competición, escrita con todas las letras: "PRIMERA FEDERACIÓN" o
       "PRETEMPORADA · AMISTOSO". */
    g.el(
      `Competición · ${oficial ? "liga" : "amistoso"}`,
      { x: xPanel + 24, y: dentro + 198, w: wPanel - 48, h: 40 },
      (ctx) =>
        chapa(ctx, rotuloCompeticion(partido), {
          x: xPanel + 24,
          y: dentro + 200,
          alto: 34,
          fondo: oficial ? C.verde : "rgba(200,169,107,0.85)",
          tinta: oficial ? C.papel : C.navy,
          tamano: 19,
          espaciado: 2,
          padding: 14,
        }),
    );
  }

  /* La lista, por si alguien la quiere leer en vez de mirarla. */
  const jugadores = [...once.jugadores].sort((a, b) => a.puesto - b.puesto);

  const arriba = dentro + 252;

  const paso = Math.min(
    46,
    (CUERPO_Y + CUERPO_ALTO - arriba - 16) / Math.max(1, jugadores.length),
  );

  jugadores.forEach((jugador, indice) => {
    const y = arriba + paso * indice;

    g.el(
      `Lista · ${jugador.dorsal || "·"} ${jugador.nombre}`,
      { x: xPanel + 12, y, w: wPanel - 24, h: paso - 4 },
      (ctx) => {
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
      },
    );
  });

  pie(
    g,
    partido
      ? `ÚLTIMO ONCE PUBLICADO · ${rotuloCompeticion(partido)} · NO ES UNA PREDICCIÓN`
      : "EL ÚLTIMO ONCE PUBLICADO · NO ES UNA PREDICCIÓN",
  );
}

/* ------------------------------------------------------------------ */
/*  7-8 · ALINEACIONES ANTERIORES                                      */
/* ------------------------------------------------------------------ */

/** Dos partidos por hoja, con su campo y su marcador. */
function pintaAlineaciones(
  g: GuionHoja,
  data: InformeData,
  escudo: HTMLImageElement | null,
  onces: OncePartido[],
  partidos: Map<string, Partido>,
) {
  papel(g);
  cabecera(g, "ALINEACIONES ANTERIORES", data, escudo);

  /* Con un solo partido —el resto de la temporada sin alineación publicada—
     la columna es la hoja entera: media hoja en blanco al lado de un campo
     estrecho se lee como un error de montaje. */
  const mitad = onces.length > 1 ? (ANCHO - 28) / 2 : ANCHO;

  onces.forEach((once, indice) => {
    const x = MARGEN + indice * (mitad + 28);

    const partido = partidos.get(once.partidoId) ?? null;

    const oficial = partido ? esLiga(partido) : true;

    /* -------------------------------------------------- el titular */

    const titulo = partido
      ? `${partido.local.nombre} ${partido.local.goles ?? 0}-${
          partido.visitante.goles ?? 0
        } ${partido.visitante.nombre}`
      : "PARTIDO";

    g.el(
      `Partido · ${titulo}`,
      { x, y: CUERPO_Y - 26, w: mitad - 140, h: 40 },
      (ctx) =>
        escribe(ctx, titulo.toUpperCase(), x, CUERPO_Y + 8, {
          tamano: 30,
          tinta: C.navy,
          espaciado: 1,
          maxAncho: mitad - 140,
        }),
    );

    if (partido) {
      g.el(
        "Fecha del partido",
        { x: x + mitad - 300, y: CUERPO_Y - 20, w: 300, h: 32 },
        (ctx) =>
          escribe(ctx, fechaCorta(partido.fecha), x + mitad, CUERPO_Y + 8, {
            tamano: 22,
            peso: 500,
            tinta: "#8A8370",
            espaciado: 2,
            alinea: "dcha",
          }),
      );
    }

    let anchoEstructura = 0;

    if (once.estructura) {
      g.el(
        `Estructura · ${once.estructura}`,
        { x, y: CUERPO_Y + 24, w: 260, h: 40 },
        (ctx) => {
          anchoEstructura = chapa(ctx, once.estructura, {
            x,
            y: CUERPO_Y + 24,
            alto: 40,
            fondo: C.verde,
            tinta: C.papel,
            tamano: 24,
            espaciado: 3,
            padding: 18,
          });
        },
      );
    }

    /*
    | Y al lado, de qué competición es. Es lo que pidió el cuerpo técnico: la
    | hoja enseña seis onces seguidos y sin esta chapa no había manera de saber
    | cuáles eran de liga y cuáles de un amistoso de pretemporada, que se
    | juegan con otra gente y no dicen lo mismo.
    */
    if (partido) {
      const xChapa = x + (anchoEstructura ? anchoEstructura + 12 : 0);

      g.el(
        `Competición · ${oficial ? "liga" : "amistoso"}`,
        { x: xChapa, y: CUERPO_Y + 24, w: 420, h: 40 },
        (ctx) =>
          chapa(ctx, rotuloCompeticion(partido), {
            x: xChapa,
            y: CUERPO_Y + 26,
            alto: 36,
            fondo: oficial ? "rgba(27,58,46,0.12)" : "rgba(200,169,107,0.85)",
            tinta: oficial ? C.verde : C.navy,
            tamano: 19,
            espaciado: 2,
            padding: 14,
          }),
      );
    }

    if (once.entrenador) {
      g.el(
        "Entrenador del once",
        { x: x + mitad - 320, y: CUERPO_Y + 26, w: 320, h: 32 },
        (ctx) =>
          escribe(ctx, once.entrenador.toUpperCase(), x + mitad, CUERPO_Y + 52, {
            tamano: 22,
            peso: 500,
            tinta: "#8A8370",
            espaciado: 2,
            alinea: "dcha",
            maxAncho: mitad - 200,
          }),
      );
    }

    /* -------------------------------------------------- el campo */

    const y = CUERPO_Y + 80;

    const alto = CUERPO_ALTO - 80;

    /* El campo guarda su proporción y se centra en la columna: estirado a lo
       ancho, un 4-4-2 parece un 4-4-2 aplastado. */
    const anchoCampo = Math.min(mitad, alto * 0.68);

    pintaOnceEnCampo(
      g,
      once,
      { x: x + (mitad - anchoCampo) / 2, y, w: anchoCampo, h: alto },
      22,
      partido
        ? `${partido.local.nombre}-${partido.visitante.nombre}`
        : `Once ${indice + 1}`,
    );
  });

  pie(g, "ALINEACIONES PUBLICADAS · LIGA Y PRETEMPORADA · FUENTE BESOCCER");
}

/* ------------------------------------------------------------------ */
/*  ÚLTIMA · CONTRAPORTADA                                             */
/* ------------------------------------------------------------------ */

function pintaContra(g: GuionHoja, data: InformeData, escudo: HTMLImageElement | null) {
  g.fondo((ctx) => {
    ctx.fillStyle = C.navy;
    ctx.fillRect(0, 0, W, H);
  });

  g.el("Filo verde", { x: 0, y: H - 12, w: W, h: 12 }, (ctx) => {
    ctx.fillStyle = C.verde;
    ctx.fillRect(0, H - 12, W, 12);
  });

  /* El bloque —escudo, nombre y firma— se centra ópticamente: colgado del
     centro exacto de la hoja se ve alto, porque casi todo su peso está arriba,
     en el escudo. */
  if (escudo) {
    g.el(
      "Escudo del rival",
      { x: W / 2 - 120, y: H / 2 - 250, w: 240, h: 240 },
      (ctx) => encaja(ctx, escudo, W / 2 - 120, H / 2 - 250, 240, 240),
    );
  }

  g.el(
    "Nombre del rival",
    { x: MARGEN, y: H / 2 - 20, w: ANCHO, h: 90 },
    (ctx) =>
      escribe(ctx, data.informe.nombreLargo.toUpperCase(), W / 2, H / 2 + 60, {
        tamano: 72,
        tinta: C.papel,
        espaciado: 6,
        alinea: "centro",
        maxAncho: ANCHO,
      }),
  );

  g.el("Firma", { x: MARGEN, y: H / 2 + 88, w: ANCHO, h: 44 }, (ctx) =>
    escribe(ctx, `REAL MADRID CASTILLA · TEMP ${data.temporada}`, W / 2, H / 2 + 122, {
      tamano: 28,
      peso: 500,
      tinta: "#8FA3B8",
      espaciado: 8,
      alinea: "centro",
    }),
  );
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
export function nombreArchivoInforme(data: InformeData) {
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
 * Cuántos onces se enseñan.
 *
 * Eran cinco y el cuerpo técnico pidió seis: con la pretemporada de por medio,
 * cinco alineaciones se quedaban en tres de liga y dos amistosos, y lo que se
 * quiere ver son las últimas seis salidas del equipo pase lo que pase. El
 * documento trae ocho bajadas (`ONCES_POR_EQUIPO` en el script), así que hay de
 * sobra.
 */
const ONCES_EN_INFORME = 6;

/**
 * Monta las hojas del informe: fondo de papel y piezas sueltas.
 *
 * Esto es lo que abre el editor. Exportar sin pasar por él es
 * `exportInformePptx`, que llama aquí y va derecho al `.pptx`.
 */
export async function construyeHojasInforme(
  data: InformeData,
): Promise<HojaInforme[]> {
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

  const hojas: HojaInforme[] = [];

  /*
  | Una hoja se pinta y se añade sólo si hay algo que enseñar. `hoja()` monta
  | el guion —fondo a sangre y piezas— y lo cierra.
  |
  | El fondo va en JPEG a 0,92: pesa un tercio que el PNG y es papel, no
  | transparencia. Las piezas sí van en PNG, que es lo que les deja el fondo
  | recortado para poder colocarlas encima de lo que sea.
  */
  const hoja = (titulo: string, pinta: (g: GuionHoja) => void) => {
    const g = new GuionHoja(titulo, `h${hojas.length + 1}`);

    pinta(g);

    hojas.push(g.hoja());
  };

  hoja("Portada", (g) =>
    pintaPortada(
      g,
      data,
      escudo,
      imagenes.get(informe.estadio?.foto ?? "") ?? null,
    ),
  );

  if (informe.clasificacion.total.length > 0) {
    hoja("Clasificación", (g) => pintaClasificacion(g, data, escudo, imagenes));
  }

  if (resultados.length > 0) {
    hoja("Resultados", (g) =>
      pintaResultados(g, data, escudo, imagenes, resultados),
    );
  }

  hoja("Estadísticas", (g) => pintaEstadisticas(g, data, escudo, conFicha));

  if (informe.entrenador || informe.estadio) {
    hoja("El club", (g) =>
      pintaClub(
        g,
        data,
        escudo,
        imagenes.get(informe.entrenador?.foto ?? "") ?? null,
        imagenes.get(informe.estadio?.foto ?? "") ?? null,
      ),
    );
  }

  if (onces.length > 0) {
    const partido = porId.get(onces[0].partidoId) ?? null;

    /* El título de la diapositiva —lo que se lee en el panel de PowerPoint y
       en el buscador de Windows— también dice de qué competición es. */
    hoja(
      partido
        ? `Último once · ${esLiga(partido) ? "liga" : "amistoso"}`
        : "Último once",
      (g) => pintaPosibleAlineacion(g, data, escudo, onces[0], partido),
    );
  }

  /* Los anteriores, de dos en dos, hasta completar los seis. */
  for (let i = 1; i < Math.min(onces.length, ONCES_EN_INFORME); i += 2) {
    const pareja = onces.slice(i, i + 2);

    const cuales = pareja
      .map((once) => {
        const partido = porId.get(once.partidoId);

        return partido ? (esLiga(partido) ? "liga" : "amistoso") : "?";
      })
      .join(" y ");

    hoja(`Alineaciones anteriores · ${cuales}`, (g) =>
      pintaAlineaciones(g, data, escudo, pareja, porId),
    );
  }

  hoja("Contraportada", (g) => pintaContra(g, data, escudo));

  return hojas;
}

/* ------------------------------------------------------------------ */
/*  DE LAS HOJAS AL PAQUETE                                            */
/* ------------------------------------------------------------------ */

/**
 * La opacidad se hornea al exportar.
 *
 * En PowerPoint la transparencia de una imagen es una propiedad del relleno y
 * no todas las versiones la respetan igual; con el alfa dentro del PNG, lo que
 * se ve en el editor es lo que se abre en Office.
 */
async function conOpacidad(elemento: ElementoInforme) {
  const opacidad = elemento.opacidad ?? 1;

  if (opacidad >= 1) return elemento.imagen;

  const imagen = await new Promise<HTMLImageElement | null>((resolve) => {
    const nueva = new Image();

    nueva.onload = () => resolve(nueva);
    nueva.onerror = () => resolve(null);
    nueva.src = elemento.imagen;
  });

  if (!imagen) return elemento.imagen;

  const { canvas, ctx } = lienzo(elemento.w, elemento.h);

  ctx.globalAlpha = Math.max(0, opacidad);
  ctx.drawImage(imagen, 0, 0, elemento.w, elemento.h);

  return canvas.toDataURL("image/png");
}

/**
 * Arma el `.pptx` con las hojas que salgan del editor y lo descarga.
 *
 * Cada pieza va como **capa**: un objeto propio de PowerPoint, con su nombre en
 * el panel de selección, que se mueve y se borra sin tocar lo demás. Es lo que
 * pedía el cuerpo técnico para rematar el documento en Office.
 */
export async function exportaHojasInforme(
  hojas: HojaInforme[],
  data: InformeData,
) {
  const diapositivas: DiapositivaPptx[] = [];

  for (const hoja of hojas) {
    const capas: CapaPptx[] = [];

    for (const elemento of hoja.elementos) {
      capas.push({
        nombre: elemento.nombre,
        imagen: await conOpacidad(elemento),
        x: elemento.x / W,
        y: elemento.y / H,
        w: elemento.w / W,
        h: elemento.h / H,
      });
    }

    diapositivas.push({ titulo: hoja.titulo, imagen: hoja.fondo, capas });
  }

  const blob = creaPptx(diapositivas, {
    titulo: `Informe de rival · ${data.informe.nombreLargo}`,
    aplicacion: "RMCF Castilla · Informe del rival",
  });

  const nombre = nombreArchivoInforme(data);

  descarga(blob, nombre);

  return nombre;
}

/* ------------------------------------------------------------------ */
/*  UNA NOTA ESCRITA EN EL EDITOR                                      */
/* ------------------------------------------------------------------ */

/**
 * Un rótulo suelto, con la letra de la casa.
 *
 * Es lo único que el editor **escribe** en vez de mover: una nota encima del
 * campo, un aviso en la portada. Va con chapa por defecto porque tiene que
 * leerse igual sobre el papel crema y sobre la foto del estadio.
 *
 * Se rehace entera cada vez que se cambia el texto, y por eso la pieza se
 * lleva puesto en `texto` con qué se pintó.
 */
export async function piezaDeTexto(
  contenido: string,
  opciones: {
    id: string;
    x: number;
    y: number;
    tamano?: number;
    tinta?: string;
    peso?: 500 | 600 | 700;
    espaciado?: number;
    conChapa?: boolean;
  },
): Promise<ElementoInforme> {
  await esperaFuentePortada();

  const {
    id,
    x,
    y,
    tamano = 44,
    tinta = C.navy,
    peso = 700,
    espaciado = 2,
    conChapa = true,
  } = opciones;

  const texto = contenido.trim() || "…";

  const alto = conChapa ? tamano + 26 : tamano + 16;

  /* Un lienzo de un píxel sólo para medir: el ancho manda el de la pieza. */
  const { ctx: medidor } = lienzo(4, 4);

  fuente(medidor, tamano, peso);

  const ancho = anchoEspaciado(medidor, texto, espaciado) + (conChapa ? 48 : 12);

  const { canvas, ctx } = lienzo(ancho, alto);

  if (conChapa) {
    chapa(ctx, texto, {
      x: 0,
      y: 0,
      alto,
      fondo: C.rosa,
      tinta,
      tamano,
      espaciado,
      padding: 24,
    });
  } else {
    escribe(ctx, texto, 6, tamano + 4, { tamano, peso, tinta, espaciado });
  }

  return {
    id,
    nombre: `Nota · ${texto.slice(0, 40)}`,
    x,
    y,
    w: ancho,
    h: alto,
    imagen: canvas.toDataURL("image/png"),
    texto: { contenido: texto, tamano, tinta, peso, espaciado, conChapa },
  };
}

/**
 * El informe entero de un tirón, sin pasar por el editor.
 *
 * Lo dejamos por si algún día vuelve a hacer falta el botón directo; la
 * pantalla de rivales abre el editor.
 */
export async function exportInformePptx(data: InformeData) {
  const hojas = await construyeHojasInforme(data);

  return exportaHojasInforme(hojas, data);
}
