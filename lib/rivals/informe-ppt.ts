/*
|--------------------------------------------------------------------------
| EL INFORME DEL RIVAL (.pptx)
|--------------------------------------------------------------------------
|
| Las doce diapositivas de `public/INFORME RIVAL.pptx`, montadas solas con lo
| que `scripts/rivals-informe.mjs` baja de BeSoccer y con lo que la pantalla de
| plantillas sabe del rival:
|
|   portada · clasificación · resultados · estadísticas · tipología de gol ·
|   el club · plantilla · once probable · tres hojas de partidos ·
|   contraportada.
|
| El documento existía: lo hacía el cuerpo técnico a mano cada semana, pegando
| capturas de BeSoccer en un PowerPoint —la clasificación, la lista de
| resultados, los onces de los últimos partidos—. Eso es media mañana por
| rival, y las capturas envejecen sin avisar: la tabla que se enseña el viernes
| es la del martes. Aquí se pinta cada diapositiva con los datos, no con la
| foto de los datos, así que sale a la hora que se pida y con la jornada de
| hoy.
|
| El reparto de las hojas es el del original y el lenguaje visual es el de
| `INDIVIDUAL.pptx` —papel, verde, azul, crema, rosa y Barlow Condensed—, el
| mismo de la portada del jugador, del PDF del once y del campograma de día de
| partido. Todo eso vive en `lienzo-club.ts`.
|
| Dos hojas **no salen de BeSoccer**: la plantilla y el once probable, que se
| pintan con la ficha del campograma de día de partido y con lo que manda la
| pantalla en `InformeData.plantilla` y `.onceProbable`. Sin eso, el informe se
| monta sin esas dos hojas.
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
  cespedTumbado,
  FICHA_H,
  FICHA_W,
  pintaFichaAlineacion,
  reparteAlineacion,
  type AlineacionJugador,
} from "@/lib/rivals/alineacion-ppt";

import {
  balance,
  balanceAmistosos,
  carreraDelEntrenador,
  esLiga,
  etapasConLoDeAhora,
  estructuraDeDemarcaciones,
  filaPropia,
  jugados,
  onceFinal,
  reparteOnceInicial,
  rotuloCompeticion,
  tipologiaGoles,
  type FilaClasificacion,
  type InformeEquipo,
  type OncePartido,
  type Partido,
} from "@/lib/rivals/informe";

import {
  FILAS_TIPOLOGIA,
  FILA_PROPIA,
  TIPOLOGIA_VACIA,
  sumaColumna,
  type ColumnaTipologia,
  type TipologiaManual,
} from "@/lib/rivals/tipologia";

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
  /**
   * El reparto de goles de la hoja «TIPOLOGÍA DE GOL», escrito a mano.
   *
   * Ese reparto no sale de ningún dato —lo codifica el analista viendo el
   * partido—, así que se escribe en el pop-up de antes del informe y se guarda
   * por rival. Sin él, las casillas salen punteadas como siempre.
   */
  tipologia?: TipologiaManual;
  /**
   * La plantilla del rival, la misma que se lleva al campograma de día de
   * partido. Sale de la hoja RIVALES, no de BeSoccer: es la que tiene pie
   * dominante, altura, peso y la foto que se usa en toda la app.
   *
   * Sin ella el informe se monta igual, sin las dos hojas de campograma.
   */
  plantilla?: AlineacionJugador[];
  /**
   * El once probable, tal y como lo dejó puesto el cuerpo técnico en la
   * pantalla de plantillas.
   *
   * `x` e `y` van en tanto por uno del **campo vertical** del pop-up —el mismo
   * que el PDF del once—; aquí se tumban para que el campograma mire como el
   * de día de partido.
   */
  onceProbable?: {
    clave: string;
    x: number;
    y: number;
    estado: "titular" | "duda";
  }[];
  /**
   * Presente cuando el once **no** lo ha marcado nadie: lo ha propuesto la app
   * con los que el rival viene sacando.
   *
   * La hoja lo dice al pie —«PROPUESTO CON LOS ÚLTIMOS ONCES · 1-4-2-3-1 · 5
   * alineaciones»— porque no es lo mismo llevar a la charla lo que ha decidido
   * el cuerpo técnico que un punto de partida: quien lo mire tiene que saber
   * cuál de las dos cosas está viendo.
   */
  onceSugerido?: { motivo: string };
  /**
   * Qué partidos van a las hojas de partidos (las 9 y 10), por `partidoId` y
   * en el orden en el que se quieren ver.
   *
   * Los elige el cuerpo técnico en el pop-up que sale antes de montar el
   * informe. Antes iban siempre los seis últimos que hubiera bajados y salían
   * tres hojas: con la pretemporada de por medio, dos de esas hojas eran
   * amistosos que a nadie le interesaban y la que importaba —el último partido
   * de liga en casa— quedaba enterrada. Sin esto se sigue haciendo lo de
   * siempre, que es lo que hace el arnés de consola.
   */
  partidosElegidos?: string[];
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
 * Cómo se rotula la competición de un partido en la tira de últimos partidos.
 *
 * En la línea caben dos o tres palabras: la liga se dice «LIGA» —que es lo
 * único que hace falta saber de ella— y lo demás se escribe con su nombre,
 * porque es justo lo que hay que distinguir. BeSoccer llama «Partidos
 * Amistosos» a la pretemporada; en la hoja cabe «AMISTOSO».
 */
function etiquetaCompeticion(partido: Partido) {
  if (esLiga(partido)) return "LIGA";

  const nombre = String(partido.competicion ?? "").trim();

  if (!nombre) return "OTRO TORNEO";

  return /amistos/i.test(nombre) ? "AMISTOSO" : nombre.toUpperCase();
}

/**
 * La racha: los últimos partidos en una línea por partido.
 *
 * Es lo que en el original iba suelto en la hoja de estructuras —una tira de
 * resultados— y aquí sirve además para llenar el hueco que dejan las tablas en
 * agosto, cuando media clasificación está a cero. Se pinta en dos sitios (la
 * clasificación y el club) y por eso está fuera de los dos.
 *
 * **Lo que no es liga se pinta como lo que es.** Antes las seis líneas iban
 * todas iguales y un amistoso de pretemporada se leía como una derrota de
 * liga: en agosto, que es cuando esta tira es lo único que dice algo, eso
 * cambia la lectura del rival entera. Ahora el partido que no es de liga
 * lleva banda gris, filo a trazos, disco hueco y tinta apagada, y **cada
 * línea dice de qué torneo habla**.
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

    const deLiga = esLiga(partido);

    g.el(
      `Racha · ${partido.resultado || "·"} ${rival.nombre} · ${
        deLiga ? "liga" : "no liga"
      }`,
      { x: caja.x, y, w: caja.w, h: paso },
      (ctx) => {
        const centro = y + paso / 2;

        const tinta = tintaResultado(partido.resultado);

        /* La banda gris de lo que no es liga: agrupa de un vistazo, sin tener
           que leer nada. */
        if (!deLiga) {
          ctx.fillStyle = "#ECE5D5";
          rectRedondo(ctx, caja.x + 4, y + 2, caja.w - 8, paso - 4, 10);
          ctx.fill();
        }

        /* El filo de la izquierda: macizo en liga, a trazos en lo demás. */
        ctx.strokeStyle = deLiga ? C.verde : "#B9B2A0";
        ctx.lineWidth = 4;
        ctx.setLineDash(deLiga ? [] : [5, 5]);
        ctx.beginPath();
        ctx.moveTo(caja.x + 10, y + 5);
        ctx.lineTo(caja.x + 10, y + paso - 5);
        ctx.stroke();
        ctx.setLineDash([]);

        /* El disco con la letra: es lo que se lee de un vistazo. Macizo si el
           partido cuenta para la tabla, hueco si no. */
        const radio = Math.min(17, paso / 2 - 5);

        const centroDisco = caja.x + 28 + radio;

        if (deLiga) {
          ctx.fillStyle = tinta;
          ctx.beginPath();
          ctx.arc(centroDisco, centro, radio, 0, Math.PI * 2);
          ctx.fill();
        } else {
          ctx.strokeStyle = tinta;
          ctx.lineWidth = 2.5;
          ctx.beginPath();
          ctx.arc(centroDisco, centro, radio - 1.5, 0, Math.PI * 2);
          ctx.stroke();
        }

        escribe(
          ctx,
          partido.resultado || "·",
          centroDisco,
          centro + radio * 0.42,
          {
            tamano: radio * 1.2,
            tinta: deLiga ? C.papel : tinta,
            alinea: "centro",
          },
        );

        /* Con sitio, el nombre sube y debajo cabe de qué torneo se habla. Sin
           él —muchos partidos en poco alto— manda el nombre. */
        const conEtiqueta = paso >= 34;

        const xTexto = caja.x + 40 + radio * 2;

        const anchoTexto = caja.x + caja.w - 94 - xTexto;

        /* Contra quién, y en qué campo. */
        escribe(
          ctx,
          `${partido.enCasa ? "vs" : "@"} ${rival.nombre.toUpperCase()}`,
          xTexto,
          centro + (conEtiqueta ? 1 : 8),
          {
            tamano: conEtiqueta ? 22 : 23,
            peso: 600,
            tinta: deLiga ? C.navy : "#6E6858",
            espaciado: 0.5,
            maxAncho: anchoTexto,
          },
        );

        if (conEtiqueta) {
          escribe(ctx, etiquetaCompeticion(partido), xTexto, centro + 18, {
            tamano: 15,
            peso: 700,
            tinta: deLiga ? "#2F6B52" : "#A86A38",
            espaciado: 2,
            maxAncho: anchoTexto,
          });
        }

        escribe(
          ctx,
          `${partido.local.goles ?? 0}-${partido.visitante.goles ?? 0}`,
          caja.x + caja.w - 24,
          centro + 8,
          {
            tamano: 26,
            tinta,
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

  /*
  | Por minuto, que es como se cuenta un partido. BeSoccer los da del último al
  | primero, que es el orden de una retransmisión, no el de un informe.
  |
  | El «90+2» se ordenaba como un 90 seco y quedaba delante de los goles del
  | 90 aunque llegara dos minutos después; se suma el añadido.
  */
  const enOrden = [...goles].sort(
    (a, b) => minutoOrdenado(a.minuto) - minutoOrdenado(b.minuto),
  );

  /*
  | Cómo se escribe un gol: «EDU GALLARDO 41'», y con la marca de lo que fue si
  | no fue de jugada. Es lo que distingue un 2-0 de dos penaltis de un 2-0 de
  | dos jugadas, que es justo lo que se mira aquí.
  */
  const comoSeLee = (gol: (typeof enOrden)[number]) =>
    `${gol.jugador.toUpperCase()} ${gol.minuto}'${
      gol.tipo === "penalti" ? " (P)" : gol.tipo === "propia" ? " (PP)" : ""
    }`;

  const propios = enOrden.filter((gol) => gol.propio).map(comoSeLee);

  const ajenos = enOrden.filter((gol) => !gol.propio).map(comoSeLee);

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

  /*
  | En dos renglones si hace falta. Antes iban todos en uno con `maxAncho`, que
  | encoge la letra hasta que quepa: un 4-3 dejaba los goleadores a cuerpo
  | nueve, ilegibles proyectados. Ahora se parten por la mitad y el segundo
  | renglón sube desde el borde.
  */
  const pintaLista = (
    lista: string[],
    x: number,
    tinta: string,
    alinea: "izq" | "dcha",
  ) => {
    if (lista.length === 0) return;

    const enDos = lista.length > 2;

    const renglones = enDos
      ? [
          lista.slice(0, Math.ceil(lista.length / 2)),
          lista.slice(Math.ceil(lista.length / 2)),
        ]
      : [lista];

    renglones.forEach((renglon, indice) => {
      escribe(
        ctx,
        renglon.join(" · "),
        x,
        caja.y + caja.h - 14 - (renglones.length - 1 - indice) * 19,
        {
          tamano: 17,
          peso: 500,
          tinta,
          espaciado: 0.5,
          alinea,
          maxAncho: caja.w / 2 - 40,
        },
      );
    });
  };

  pintaLista(izquierda, caja.x + 24, tintaIzquierda, "izq");
  pintaLista(derecha, caja.x + caja.w - 20, tintaDerecha, "dcha");
}

/** "90+2" cuenta como 92 para ordenar los goles de un partido. */
function minutoOrdenado(minuto: string) {
  const partes = String(minuto ?? "").split("+");

  return (Number(partes[0]) || 0) + (Number(partes[1]) || 0);
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

  const golesEnLiga = conFichaLiga.reduce(
    (total, partido) => total + (partido.goles?.length ?? 0),
    0,
  );

  /*
  | En la jornada 1 «los tramos de liga» son dos goles y el gráfico sale con
  | una barra sola de punta a punta, que no dice nada. Con menos de cuatro goles
  | se suma la pretemporada y se rotula que van juntas; en cuanto hay liga de
  | verdad, la pretemporada se queda fuera.
  */
  const mezcla = deLiga && golesEnLiga < 4 && conFichaAmistosos.length > 0;

  const paraTramos = mezcla
    ? conFicha
    : deLiga
      ? conFichaLiga
      : conFichaAmistosos;

  const dentro = panel(
    g,
    MARGEN,
    yAbajo,
    anchoTramos,
    altoAbajo,
    `CUÁNDO MARCA Y CUÁNDO ENCAJA · ${
      mezcla ? "LIGA Y PRETEMPORADA" : deLiga ? "LIGA" : "PRETEMPORADA"
    }`,
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
    /* La escala nunca baja de dos: con un gol en un solo tramo, la barra se iba
       de punta a punta del panel y se leía como un dato enorme. */
    const maximo = Math.max(2, ...reparto.favor, ...reparto.contra);

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
  /*
  | Con la mezcla puesta, el pie decía «7 partidos de liga · 6 amistosos fuera
  | del gráfico» cuando esos seis amistosos estaban **dentro**: la cuenta y la
  | frase se leían al revés. Cada uno de los tres casos se dice como es.
  */
  const cuantos = (lista: Partido[]) =>
    `${lista.length} PARTIDO${lista.length === 1 ? "" : "S"}`;

  const deDonde = mezcla
    ? `TRAMOS DE ${cuantos(conFichaLiga)} DE LIGA Y ${
        conFichaAmistosos.length
      } AMISTOSO${conFichaAmistosos.length === 1 ? "" : "S"}`
    : deLiga
      ? `TRAMOS DE ${cuantos(conFichaLiga)} DE LIGA${
          conFichaAmistosos.length > 0
            ? ` · ${conFichaAmistosos.length} AMISTOSO${
                conFichaAmistosos.length === 1 ? "" : "S"
              } FUERA DEL GRÁFICO`
            : ""
        }`
      : `TRAMOS DE ${cuantos(conFichaAmistosos)} DE PRETEMPORADA`;

  pie(g, `${deDonde} · GOLEADORES DE TODA LA TEMPORADA · FUENTE BESOCCER`);
}

/* ------------------------------------------------------------------ */
/*  5 · TIPOLOGÍA DE GOL                                               */
/* ------------------------------------------------------------------ */

/*
| La tabla que el cuerpo técnico rellena a mano en `INFORME RIVAL.pptx`: cómo
| se marcan y cómo se encajan los goles, repartidos en ataque organizado,
| transición, balón parado y errores individuales.
|
| **Esto no lo da BeSoccer y no se puede inventar.** Es codificación de vídeo:
| alguien mira el gol y decide si fue un centro desde el perfil del lateral
| izquierdo o una contra en campo propio. Lo que sí sabemos de cada gol es el
| minuto, el autor y si fue de penalti o en propia puerta, que son dos casillas
| de esta misma tabla.
|
| Así que la hoja sale **con la tabla montada y las casillas puestas**: las dos
| que se saben, escritas; las demás, con su punteado para escribirlas encima en
| PowerPoint —que ahora se puede, porque cada fila es un objeto suelto—. Antes
| esta hoja no existía y el analista copiaba la tabla de un informe viejo.
*/

/** Una columna de la tabla: a favor o en contra. */
function pintaColumnaTipologia(
  g: GuionHoja,
  titulo: string,
  cuenta: { total: number; penaltis: number; propia: number },
  caja: { x: number; y: number; w: number; h: number },
  acento: string,
  /* Lo que ha escrito el analista para esta columna. */
  manual: ColumnaTipologia,
) {
  const dentro = panel(g, caja.x, caja.y, caja.w, caja.h, titulo);

  /* El total, arriba a la derecha de la cinta: es la cifra que cuadra la
     tabla, y sin ella las casillas vacías no dicen sobre cuántos goles van. */
  g.el(
    `${titulo} · total`,
    { x: caja.x + caja.w - 220, y: dentro + 6, w: 200, h: 76 },
    (ctx) => {
      escribe(ctx, String(cuenta.total), caja.x + caja.w - 30, dentro + 66, {
        tamano: 62,
        tinta: acento,
        alinea: "dcha",
      });

      escribe(ctx, "GOLES", caja.x + caja.w - 30, dentro + 86, {
        tamano: 17,
        peso: 500,
        tinta: "#8A8370",
        espaciado: 2,
        alinea: "dcha",
      });
    },
  );

  const filas = FILAS_TIPOLOGIA.reduce(
    (total, bloque) => total + bloque.filas.length + 1,
    1,
  );

  const alto = (caja.h - (dentro - caja.y) - 108) / filas;

  let y = dentro + 96;

  for (const bloque of FILAS_TIPOLOGIA) {
    const yCinta = y;

    g.el(
      `${titulo} · ${bloque.seccion}`,
      { x: caja.x + 16, y: yCinta, w: caja.w - 32, h: alto },
      (ctx) => {
        ctx.fillStyle = "rgba(27,58,46,0.10)";
        rectRedondo(ctx, caja.x + 16, yCinta + 2, caja.w - 32, alto - 4, 6);
        ctx.fill();

        escribe(ctx, bloque.seccion, caja.x + 32, yCinta + alto * 0.72, {
          tamano: 21,
          peso: 700,
          tinta: C.verde,
          espaciado: 2.5,
        });

        /* El porcentaje se saca solo de lo escrito: es una suma, y hacerla a
           mano en la reunión es la forma más tonta de equivocarse. */
        const enLaSeccion = bloque.filas.reduce(
          (suma, una) => suma + (manual[una] ?? 0),
          0,
        );

        const base = sumaColumna(manual) || cuenta.total;

        const rotulo =
          enLaSeccion > 0 && base > 0
            ? `${Math.round((enLaSeccion / base) * 100)}%`
            : "%";

        escribe(ctx, rotulo, caja.x + caja.w - 32, yCinta + alto * 0.72, {
          tamano: 20,
          peso: 500,
          tinta: "#9A9384",
          alinea: "dcha",
        });
      },
    );

    y += alto;

    for (const fila of bloque.filas) {
      const yFila = y;

      /*
      | Manda lo que haya escrito el analista. Si no ha escrito nada, se pinta
      | lo único que se sabe solo —los penaltis los canta el marcador— y el
      | resto se queda punteado, para rellenarlo a boli si hace falta.
      */
      const escrito = manual[fila];

      const valor =
        escrito !== undefined
          ? String(escrito)
          : fila === "PENALTI"
            ? String(cuenta.penaltis)
            : "";

      g.el(
        `${titulo} · ${fila}`,
        { x: caja.x + 16, y: yFila, w: caja.w - 32, h: alto },
        (ctx) => {
          escribe(ctx, fila, caja.x + 44, yFila + alto * 0.7, {
            tamano: 20,
            peso: 500,
            tinta: C.navy,
            espaciado: 1,
            maxAncho: caja.w - 220,
          });

          /* La casilla. Con dato dentro, o punteada para escribirla. */
          const cajaX = caja.x + caja.w - 130;

          ctx.strokeStyle = "rgba(0,0,0,0.16)";
          ctx.lineWidth = 1.5;
          ctx.setLineDash(valor ? [] : [4, 4]);
          rectRedondo(ctx, cajaX, yFila + 5, 92, alto - 12, 5);
          ctx.stroke();
          ctx.setLineDash([]);

          if (valor) {
            escribe(ctx, valor, cajaX + 46, yFila + alto * 0.72, {
              tamano: 22,
              tinta: acento,
              alinea: "centro",
            });
          }
        },
      );

      y += alto;
    }
  }

  /* Los goles en propia puerta no son una casilla del original —allí se
     apuntan en errores individuales— pero sí un dato que se tiene. */
  const yPropia = y;

  g.el(
    `${titulo} · en propia puerta`,
    { x: caja.x + 16, y: yPropia, w: caja.w - 32, h: alto },
    (ctx) =>
      escribe(
        ctx,
        `EN PROPIA PUERTA: ${manual[FILA_PROPIA] ?? cuenta.propia}`,
        caja.x + 44,
        yPropia + alto * 0.7,
        {
          tamano: 19,
          peso: 500,
          tinta: "#8A8370",
          espaciado: 1,
        },
      ),
  );
}

function pintaTipologia(
  g: GuionHoja,
  data: InformeData,
  escudo: HTMLImageElement | null,
  partidos: Partido[],
) {
  papel(g);
  cabecera(g, "TIPOLOGÍA DE GOL", data, escudo);

  const cuentas = tipologiaGoles(partidos);

  const tipologia = data.tipologia ?? TIPOLOGIA_VACIA;

  const mitad = (ANCHO - 24) / 2;

  pintaColumnaTipologia(
    g,
    "GOLES A FAVOR",
    cuentas.aFavor,
    { x: MARGEN, y: CUERPO_Y, w: mitad, h: CUERPO_ALTO },
    C.verde,
    tipologia.aFavor,
  );

  pintaColumnaTipologia(
    g,
    "GOLES EN CONTRA",
    cuentas.enContra,
    { x: MARGEN + mitad + 24, y: CUERPO_Y, w: mitad, h: CUERPO_ALTO },
    "#9A6169",
    tipologia.enContra,
  );

  pie(
    g,
    `${partidos.length} PARTIDO${
      partidos.length === 1 ? "" : "S"
    } CON FICHA · PENALTIS Y PROPIAS DE BESOCCER · EL REPARTO LO CODIFICA EL ANALISTA`,
  );
}

/* ------------------------------------------------------------------ */
/*  6 · ENTRENADOR Y ESTADIO                                           */
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
  | Los dos paneles miden lo que necesitan y lo que queda abajo se lo lleva la
  | trayectoria del entrenador: ficha de entrenador y ficha de estadio son dos
  | bloques cortos, y estirados a toda la hoja dejaban medio folio en blanco
  | cada uno.
  */
  const altoFicha = 566;

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

    /*
    | Su carrera, no la temporada.
    |
    | Aquí iban los partidos, ganados, empatados y perdidos **de este equipo**,
    | que son exactamente los mismos números que ya están dos hojas antes en la
    | clasificación y otra vez en la de resultados. De un entrenador al que no
    | se conoce lo que hace falta saber es de dónde viene: cuánto lleva en
    | banquillos, por cuántos clubes ha pasado y con qué porcentaje. El detalle
    | club a club va en la tabla de abajo.
    */
    const carrera = carreraDelEntrenador(entrenador);

    const registro: [string, string, string][] = [
      [String(carrera.clubes || "—"), "CLUBES", C.navy],
      [String(carrera.partidos || "—"), "PARTIDOS DIRIGIDOS", C.navy],
      [
        carrera.partidos > 0 ? `${carrera.porcentaje}%` : "—",
        "VICTORIAS",
        VERDE_VICTORIA,
      ],
      [
        String(carrera.enEsteClub || "—"),
        "EN ESTE CLUB",
        carrera.enEsteClub > 0 ? C.verde : "#9A9384",
      ],
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

  /* -------------------------------------------------- la trayectoria */

  /*
  | Aquí iba la tira de últimos resultados, que es exactamente lo que ya
  | enseñan la hoja de clasificación y la de resultados. Lo que no dice ninguna
  | otra hoja —y es lo que se quiere saber de un entrenador que no se conoce—
  | es de dónde viene: por qué clubes ha pasado, cuánto duró en cada uno y con
  | qué dibujo trabajó allí.
  */
  const yEtapas = CUERPO_Y + altoFicha + 24;

  const altoEtapas = CUERPO_Y + CUERPO_ALTO - yEtapas;

  /* Caben cinco clubes. Cuando ha pasado por más, se dice: si no, el «6
     CLUBES» de arriba y las cinco filas de aquí se contradicen a la vista. */
  const todasSusEtapas = entrenador?.trayectoria?.length ?? 0;

  const dentroEtapas = panel(
    g,
    MARGEN,
    yEtapas,
    ANCHO,
    altoEtapas,
    todasSusEtapas > 5
      ? `TRAYECTORIA DEL ENTRENADOR · LOS 5 ÚLTIMOS DE ${todasSusEtapas}`
      : "TRAYECTORIA DEL ENTRENADOR",
  );

  /* Con los números de ahora en la primera fila: la tabla de BeSoccer deja
     la etapa en curso en blanco y salía un «0-0-0» que se lee como un balance
     y no como un hueco. */
  const etapas = etapasConLoDeAhora(entrenador).slice(0, 5);

  if (etapas.length === 0) {
    g.el(
      "Trayectoria · sin datos",
      { x: MARGEN, y: dentroEtapas + 20, w: ANCHO, h: 44 },
      (ctx) =>
        escribe(
          ctx,
          entrenador
            ? "SIN TRAYECTORIA PUBLICADA · VUELVE A BAJAR EL INFORME"
            : "SIN ENTRENADOR EN LA FICHA DEL CLUB",
          W / 2,
          dentroEtapas + 54,
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
    /* Las columnas, con su ancho: club, fechas, partidos, balance y dibujo. */
    const COLS = [
      { titulo: "CLUB", x: 0.0, w: 0.34, alinea: "izq" as const },
      { titulo: "DESDE · HASTA", x: 0.34, w: 0.24, alinea: "izq" as const },
      { titulo: "PJ", x: 0.58, w: 0.08, alinea: "centro" as const },
      { titulo: "G-E-P", x: 0.66, w: 0.16, alinea: "centro" as const },
      { titulo: "DIBUJO", x: 0.82, w: 0.18, alinea: "centro" as const },
    ];

    const izquierda = MARGEN + 24;
    const anchoTabla = ANCHO - 48;

    const alto = Math.min(
      44,
      (altoEtapas - (dentroEtapas - yEtapas) - 46) / etapas.length,
    );

    g.el(
      "Trayectoria · cabecera",
      { x: izquierda, y: dentroEtapas + 4, w: anchoTabla, h: 30 },
      (ctx) => {
        for (const columna of COLS) {
          const x =
            izquierda +
            anchoTabla * columna.x +
            (columna.alinea === "centro" ? (anchoTabla * columna.w) / 2 : 0);

          escribe(ctx, columna.titulo, x, dentroEtapas + 26, {
            tamano: 17,
            peso: 600,
            tinta: "#8A8370",
            espaciado: 2,
            alinea: columna.alinea,
          });
        }
      },
    );

    etapas.forEach((etapa, indice) => {
      const y = dentroEtapas + 36 + alto * indice;

      /* La primera fila es el club de ahora: se marca, que es la que sitúa a
         las demás en el tiempo. */
      const actual = indice === 0;

      const celdas = [
        etapa.equipo.toUpperCase(),
        `${etapa.desde || "—"} · ${etapa.hasta || "—"}`,
        String(etapa.partidos || "—"),
        `${etapa.ganados}-${etapa.empatados}-${etapa.perdidos}`,
        etapa.tactica || "—",
      ];

      g.el(
        `Trayectoria · ${etapa.equipo}`,
        { x: izquierda - 12, y, w: anchoTabla + 24, h: alto },
        (ctx) => {
          if (actual) {
            ctx.fillStyle = "rgba(246,175,182,0.35)";
            rectRedondo(ctx, izquierda - 12, y, anchoTabla + 24, alto - 4, 8);
            ctx.fill();
          } else if (indice % 2 === 1) {
            ctx.fillStyle = "rgba(0,0,0,0.028)";
            ctx.fillRect(izquierda - 12, y, anchoTabla + 24, alto - 4);
          }

          COLS.forEach((columna, cual) => {
            const x =
              izquierda +
              anchoTabla * columna.x +
              (columna.alinea === "centro" ? (anchoTabla * columna.w) / 2 : 0);

            escribe(ctx, celdas[cual], x, y + alto * 0.66, {
              tamano: cual === 0 ? 23 : 21,
              peso: cual === 0 ? 700 : 500,
              tinta: cual === 0 ? C.navy : "#4A4438",
              espaciado: 0.5,
              alinea: columna.alinea,
              maxAncho: anchoTabla * columna.w - 12,
            });
          });
        },
      );
    });
  }

  pie(g, "TRAYECTORIA Y DATOS DEL CLUB · FUENTE BESOCCER");
}

/* ------------------------------------------------------------------ */
/*  7-8 · PLANTILLA Y ONCE PROBABLE, CON CARAS                         */
/* ------------------------------------------------------------------ */

/*
| Las dos hojas de campograma del original: la plantilla entera repartida por
| puestos y el once que se espera, las dos con la cara de cada uno.
|
| No se dibujan aquí: son **la misma ficha y el mismo reparto** del campograma
| de día de partido (`alineacion-ppt.ts`), que es el documento que el cuerpo
| técnico se lleva al vestuario. Si el informe colocara a la plantilla por su
| cuenta, el mismo equipo saldría de dos maneras distintas en dos documentos de
| la misma carpeta.
|
| Los datos de estas dos hojas **no vienen de BeSoccer**: salen de la hoja
| RIVALES —pie dominante, altura, peso, foto— y del once probable que el cuerpo
| técnico coloca a mano en la pantalla de plantillas. Por eso son opcionales:
| sin plantilla cargada, el informe se monta sin ellas.
*/

/** La zona donde caen las fichas, con la cabecera del informe descontada. */
const ZONA_CAMPO = {
  x: 52,
  y: CABECERA + 24,
  w: W - 104,
  h: H - CABECERA - 24 - 52,
};

/** El césped tumbado de las dos hojas, a sangre. */
function fondoCampograma(g: GuionHoja) {
  g.fondo((ctx) =>
    cespedTumbado(
      ctx,
      { x: 0, y: 0, w: W, h: H },
      { x: 44, y: CABECERA + 8, w: W - 88, h: H - CABECERA - 52 },
    ),
  );
}

/** El pie de una hoja de césped: el crema del papel no se lee sobre verde. */
function pieSobreCesped(g: GuionHoja, nota: string) {
  g.el("Firma del pie", { x: MARGEN, y: H - 44, w: 420, h: 28 }, (ctx) =>
    escribe(ctx, "REAL MADRID CASTILLA", MARGEN, H - 22, {
      tamano: 18,
      peso: 600,
      tinta: "rgba(247,244,236,0.55)",
      espaciado: 3,
    }),
  );

  g.el(
    "Nota del pie",
    { x: W - MARGEN - 1100, y: H - 44, w: 1100, h: 28 },
    (ctx) =>
      escribe(ctx, nota, W - MARGEN, H - 22, {
        tamano: 18,
        peso: 500,
        tinta: "rgba(247,244,236,0.55)",
        espaciado: 2,
        alinea: "dcha",
      }),
  );
}

/** La plantilla entera, colocada por puestos. */
function pintaPlantilla(
  g: GuionHoja,
  data: InformeData,
  escudo: HTMLImageElement | null,
  retratos: Map<string, HTMLImageElement | null>,
) {
  fondoCampograma(g);
  cabecera(g, "PLANTILLA", data, escudo);

  const { fichas, k } = reparteAlineacion(data.plantilla ?? []);

  for (const ficha of fichas) {
    g.imagen(
      `${ficha.jugador.dorsal ? `Nº${ficha.jugador.dorsal} · ` : ""}${
        ficha.jugador.nombre
      }`,
      {
        x: ficha.x * W,
        y: ficha.y * H,
        w: ficha.w * W,
        h: ficha.h * H,
      },
      pintaFichaAlineacion(
        ficha.jugador,
        retratos.get(ficha.jugador.foto) ?? null,
        FICHA_W * k,
        FICHA_H * k,
      ),
    );
  }

  pieSobreCesped(
    g,
    `${(data.plantilla ?? []).length} JUGADORES · HOJA RIVALES · CADA FICHA ES UN OBJETO SUELTO`,
  );
}

/**
 * El once probable, con las caras y en el sitio en el que se le colocó.
 *
 * Sustituye a la hoja de «último once» que había aquí. El último once ya sale
 * en las hojas de partidos, con su estructura y sus cambios, y puede estar muy
 * lejos del que se espera: lo que se lleva a la charla es lo que el cuerpo
 * técnico ha decidido que va a jugar, no lo que jugó el rival hace tres
 * semanas contra otro.
 */
function pintaOnceProbable(
  g: GuionHoja,
  data: InformeData,
  escudo: HTMLImageElement | null,
  retratos: Map<string, HTMLImageElement | null>,
) {
  fondoCampograma(g);
  cabecera(
    g,
    data.onceSugerido ? "ONCE PROBABLE (PROPUESTA)" : "ONCE PROBABLE",
    data,
    escudo,
  );

  const porClave = new Map(
    (data.plantilla ?? []).map((jugador) => [jugador.clave, jugador]),
  );

  const puestos = (data.onceProbable ?? [])
    .map((sitio) => ({ sitio, jugador: porClave.get(sitio.clave) }))
    .filter(
      (uno): uno is { sitio: (typeof uno)["sitio"]; jugador: AlineacionJugador } =>
        Boolean(uno.jugador),
    );

  /*
  | El campo va tumbado y atacando a la derecha, como el de día de partido, y
  | el once viene colocado sobre el campo **vertical** del pop-up: se gira un
  | cuarto de vuelta. La banda izquierda del ataque queda arriba, que es como
  | se ve un partido por televisión.
  */
  const colocados = puestos.map(({ sitio, jugador }) => ({
    jugador,
    estado: sitio.estado,
    x: 1 - sitio.y,
    y: sitio.x,
  }));

  /*
  | Cuánto encoge la ficha.
  |
  | Se miraba cuántos caían en la misma franja de un décimo y se repartía el
  | alto entre ellos, pero eso da por hecho que la columna va repartida a
  | partes iguales, y no lo está: una línea de cuatro se coloca entre el 0,2 y
  | el 0,8 del campo —huecos de 0,2, no de 0,25— y las fichas se pisaban. Con
  | el once puesto a mano, además, cada uno está donde le hayan dejado.
  |
  | Así que se mira **par a par**: dos fichas se tapan sólo si se solapan a lo
  | ancho **y** a lo alto, de modo que cada pareja permite como mucho el mayor
  | de sus dos huecos. El más pequeño de todos manda.
  */
  const AIRE = 1.06;

  let tope = 1;

  for (let i = 0; i < colocados.length; i += 1) {
    for (let j = i + 1; j < colocados.length; j += 1) {
      const dx = Math.abs(colocados[i].x - colocados[j].x) * ZONA_CAMPO.w;
      const dy = Math.abs(colocados[i].y - colocados[j].y) * ZONA_CAMPO.h;

      const cabe = Math.max(dx / FICHA_W, dy / FICHA_H) / AIRE;

      tope = Math.min(tope, cabe);
    }
  }

  /* Y que la fila de arriba y la de abajo no se salgan del césped. */
  const alturas = colocados.map((uno) => uno.y);

  const margen =
    Math.min(Math.min(...alturas), 1 - Math.max(...alturas)) * ZONA_CAMPO.h;

  /* La ficha va centrada en su sitio, así que de la línea de más arriba (o de
     más abajo) sólo le cabe media. El suelo de 0,32 es para que un once
     arrastrado al filo del campo no acabe con once sellos ilegibles: antes
     que eso, que asome. */
  const k = Math.max(0.32, Math.min(1, tope, (margen * 2) / FICHA_H));

  const ancho = FICHA_W * k;
  const alto = FICHA_H * k;

  /* De arriba abajo, para que en PowerPoint la de abajo tape a la de arriba. */
  for (const uno of [...colocados].sort((a, b) => a.y - b.y)) {
    const jugador = uno.jugador;

    const caja = {
      x: ZONA_CAMPO.x + ZONA_CAMPO.w * uno.x - ancho / 2,
      y: ZONA_CAMPO.y + ZONA_CAMPO.h * uno.y - alto / 2,
      w: ancho,
      h: alto,
    };

    g.imagen(
      `${jugador.dorsal ? `Nº${jugador.dorsal} · ` : ""}${jugador.nombre}${
        uno.estado === "duda" ? " (duda)" : ""
      }`,
      caja,
      pintaFichaAlineacion(
        jugador,
        retratos.get(jugador.foto) ?? null,
        ancho,
        alto,
      ),
    );

    /*
    | La duda va en su propia chapa encima de la ficha, no por el campo de
    | estado: ese lo lee `baja()` y convierte cualquier duda en «TOCADO», que es
    | lo que quiere decir cuando lo escribe la hoja —parte médico— y no lo que
    | quiere decir aquí, que es que el cuerpo técnico no lo tiene claro.
    */
    if (uno.estado !== "duda") continue;

    g.el(
      `Duda · ${jugador.nombre}`,
      { x: caja.x + 4, y: caja.y - 6, w: 120, h: 34 },
      (ctx) =>
        chapa(ctx, "DUDA", {
          x: caja.x + 8,
          y: caja.y - 4,
          alto: 28,
          fondo: C.rosa,
          tinta: C.navy,
          tamano: 16,
          espaciado: 2,
          padding: 12,
        }),
    );
  }

  const dudas = colocados.filter((uno) => uno.estado === "duda").length;

  pieSobreCesped(
    g,
    `${
      data.onceSugerido
        ? `PROPUESTA CON LOS ÚLTIMOS ONCES · ${data.onceSugerido.motivo.toUpperCase()}`
        : "ONCE PROBABLE DEL CUERPO TÉCNICO"
    }${dudas > 0 ? ` · ${dudas} DUDA${dudas === 1 ? "" : "S"}` : ""} · NO ES EL ÚLTIMO ONCE PUBLICADO`,
  );
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
 * El reparto lo hace `reparteOnceInicial`, que vive en `informe.ts` porque lo
 * comparte con el **once probable sugerido**: aquél deduce en qué línea juega
 * cada uno mirando dónde le dejaron estos mismos sitios, y los dos tienen que
 * leer el dibujo que publica BeSoccer de la misma manera.
 */
function reparteOnce(once: OncePartido) {
  return reparteOnceInicial(once);
}

/**
 * Lo que le pasó a un jugador en el partido y se pinta sobre su ficha.
 *
 * Las asistencias **sí** salen: se creía que BeSoccer no publicaba el asistente
 * en Primera Federación —el campo llegaba siempre a cero— pero lo que pasaba es
 * que se leían los goles de la lista de todos los eventos, donde no está. En la
 * pestaña de goles de la ficha va el segundo nombre, en gris.
 *
 * Sigue faltando en los partidos bajados antes de septiembre de 2026 y en los
 * de temporadas pasadas, de los que ya no queda ficha: ahí el icono no llega a
 * pintarse, que es lo que debe pasar.
 */
type MarcasFicha = {
  goles: number;
  asistencias: number;
  amarillas: number;
  rojas: number;
  /** "46" si entró en ese minuto. */
  entra?: string;
  /** "46" si le cambiaron. */
  sale?: string;
};

const SIN_MARCAS: MarcasFicha = {
  goles: 0,
  asistencias: 0,
  amarillas: 0,
  rojas: 0,
};

/** Una ficha del once sobre el campo: dorsal en círculo y nombre debajo. */
function pintaFichaOnce(
  ctx: Ctx,
  jugador: { dorsal: string; nombre: string },
  x: number,
  y: number,
  radio: number,
  marcas: MarcasFicha = SIN_MARCAS,
  /** Lo que puede ocupar el nombre sin pisar al vecino de al lado. */
  anchoMax = 0,
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

  /*
  | El nombre, sobre una tira oscura para que se lea encima del césped.
  |
  | Con cinco fichas en una línea de campo estrecho, «GUILLEM MOLINA» pisaba a
  | su vecino y las tiras se tapaban unas a otras. Cuando no cabe entero se
  | prueba con el apellido —que es como se llama a la gente en una charla— y si
  | tampoco, se encoge la letra.
  */
  const cuerpo = radio * 0.62;

  const tope = anchoMax > 0 ? anchoMax - 14 : Infinity;

  fuente(ctx, cuerpo, 600);

  let nombre = jugador.nombre.toUpperCase();

  if (anchoEspaciado(ctx, nombre, 0.5) > tope) {
    const palabras = nombre.split(/\s+/).filter(Boolean);

    if (palabras.length > 1) nombre = palabras[palabras.length - 1];
  }

  const cuerpoFinal =
    anchoMax > 0 ? ajusta(ctx, nombre, tope, cuerpo, 600, 0.5) : cuerpo;

  const ancho = anchoEspaciado(ctx, nombre, 0.5) + 14;

  ctx.fillStyle = "rgba(4,18,31,0.82)";
  rectRedondo(ctx, x - ancho / 2, y + radio + 6, ancho, radio * 0.9, radio * 0.3);
  ctx.fill();

  escribe(ctx, nombre, x, y + radio + 6 + radio * 0.66, {
    tamano: cuerpoFinal,
    peso: 600,
    tinta: C.papel,
    espaciado: 0.5,
    alinea: "centro",
  });

  pintaMarcasFicha(ctx, x, y, radio, marcas);
}

/**
 * Los iconos de la ficha: goles, asistencias, tarjetas y el minuto del cambio.
 *
 * Van pegados al círculo del dorsal, en columna a la derecha, que es donde no
 * tapan ni la cifra ni el nombre. Un solo gol es un balón; dos o más, el balón
 * con el número dentro, que ocupa lo mismo.
 */
function pintaMarcasFicha(
  ctx: Ctx,
  x: number,
  y: number,
  radio: number,
  marcas: MarcasFicha,
) {
  const iconos: { fondo: string; tinta: string; texto: string; balon?: boolean }[] =
    [];

  if (marcas.goles > 0) {
    iconos.push({
      fondo: C.papel,
      tinta: C.navy,
      texto: marcas.goles > 1 ? String(marcas.goles) : "",
      balon: true,
    });
  }

  for (let i = 0; i < marcas.asistencias; i += 1) {
    iconos.push({ fondo: AZUL_ASISTENCIA, tinta: C.papel, texto: "A" });
  }

  for (let i = 0; i < marcas.amarillas; i += 1) {
    iconos.push({ fondo: "#E7C24B", tinta: "#4A4438", texto: "" });
  }

  for (let i = 0; i < marcas.rojas; i += 1) {
    iconos.push({ fondo: "#B4454F", tinta: C.papel, texto: "" });
  }

  const lado = radio * 0.62;

  iconos.forEach((icono, indice) => {
    const cx = x + radio * 0.86;
    const cy = y - radio * 0.7 + indice * (lado + 3);

    ctx.fillStyle = icono.fondo;

    if (icono.balon) {
      /* Con dos goles o más el número va dentro y el pentágono estorba. */
      if (icono.texto) {
        ctx.beginPath();
        ctx.arc(cx, cy, lado / 2, 0, Math.PI * 2);
        ctx.fill();

        ctx.strokeStyle = C.navy;
        ctx.lineWidth = 1.5;
        ctx.stroke();
      } else {
        balon(ctx, cx, cy, lado / 2, icono.fondo, C.navy);
      }
    } else {
      /* Las tarjetas son rectángulos, como en un acta. */
      rectRedondo(ctx, cx - lado * 0.34, cy - lado / 2, lado * 0.68, lado, 2);
      ctx.fill();
    }

    if (icono.texto) {
      escribe(ctx, icono.texto, cx, cy + lado * 0.3, {
        tamano: lado * 0.8,
        tinta: icono.tinta,
        alinea: "centro",
      });
    }
  });

  /* El minuto del cambio, debajo del nombre. */
  const cambio = marcas.entra
    ? { minuto: marcas.entra, entra: true, tinta: "#2E7D52" }
    : marcas.sale
      ? { minuto: marcas.sale, entra: false, tinta: "#B4454F" }
      : null;

  if (!cambio) return;

  const cuerpo = radio * 0.58;

  const base = y + radio * 2.5;

  /*
  | El triángulo va **dibujado**, no escrito.
  |
  | Aquí se ponía «▲ 46'» y «▼ 46'» con el carácter de la flecha dentro del
  | texto. Barlow Condensed no tiene esos dos glifos, así que en el `.pptx` (y
  | en cualquier PowerPoint que no encuentre otra fuente que los tenga) salía
  | el cuadradito de «no sé pintar esto» delante de cada minuto, en las once
  | fichas y en toda la convocatoria. Un triángulo son tres líneas.
  */
  fuente(ctx, cuerpo, 700);

  const texto = `${cambio.minuto}'`;

  const anchoTexto = ctx.measureText(texto).width;

  const punta = cuerpo * 0.62;

  const total = punta + cuerpo * 0.28 + anchoTexto;

  const izquierda = x - total / 2;

  triangulo(ctx, izquierda + punta / 2, base - cuerpo * 0.34, punta, cambio.entra, cambio.tinta);

  escribe(ctx, texto, izquierda + punta + cuerpo * 0.28, base, {
    tamano: cuerpo,
    peso: 700,
    tinta: cambio.tinta,
  });
}

/** El azul de la asistencia, el mismo en la ficha y en la convocatoria. */
const AZUL_ASISTENCIA = "#3E7BA6";

/**
 * Un balón: el círculo y el pentágono de en medio.
 *
 * El pentágono está porque sin él es un punto, y en una hoja donde el gol, la
 * asistencia y la tarjeta van uno al lado de otro y del tamaño de una letra,
 * un punto no se distingue de una chapa cualquiera. Con la pieza negra del
 * centro se lee «balón» de lejos, que es como se mira una diapositiva.
 */
function balon(
  ctx: Ctx,
  cx: number,
  cy: number,
  radio: number,
  fondo: string,
  tinta: string,
) {
  ctx.save();

  ctx.fillStyle = fondo;
  ctx.beginPath();
  ctx.arc(cx, cy, radio, 0, Math.PI * 2);
  ctx.fill();

  ctx.strokeStyle = tinta;
  ctx.lineWidth = Math.max(1, radio * 0.16);
  ctx.stroke();

  /* El pentágono, con la punta arriba. */
  ctx.fillStyle = tinta;
  ctx.beginPath();

  for (let lado = 0; lado < 5; lado += 1) {
    const angulo = -Math.PI / 2 + (lado * Math.PI * 2) / 5;

    const px = cx + Math.cos(angulo) * radio * 0.46;
    const py = cy + Math.sin(angulo) * radio * 0.46;

    if (lado === 0) ctx.moveTo(px, py);
    else ctx.lineTo(px, py);
  }

  ctx.closePath();
  ctx.fill();

  ctx.restore();
}

/**
 * El triángulo del cambio: hacia arriba el que entra, hacia abajo el que sale.
 *
 * Es lo mismo que dice un acta y lo mismo que decían los caracteres «▲» y «▼»
 * que había antes, sólo que pintado, que es lo único que se ve igual en
 * cualquier ordenador que abra el `.pptx`.
 */
function triangulo(
  ctx: Ctx,
  cx: number,
  cy: number,
  lado: number,
  arriba: boolean,
  tinta: string,
) {
  const media = lado / 2;

  /* Un triángulo equilátero se ve más ancho que alto: se le quita un pelo. */
  const alto = lado * 0.86;

  ctx.save();
  ctx.fillStyle = tinta;
  ctx.beginPath();

  if (arriba) {
    ctx.moveTo(cx, cy - alto / 2);
    ctx.lineTo(cx + media, cy + alto / 2);
    ctx.lineTo(cx - media, cy + alto / 2);
  } else {
    ctx.moveTo(cx, cy + alto / 2);
    ctx.lineTo(cx + media, cy - alto / 2);
    ctx.lineTo(cx - media, cy - alto / 2);
  }

  ctx.closePath();
  ctx.fill();
  ctx.restore();
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
  marcasDe?: (jugador: { nombre: string }) => MarcasFicha,
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

  /*
  | Lo que hay de un jugador al de al lado.
  |
  | Una línea de cuatro se coloca en 1/5, 2/5, 3/5 y 4/5 del ancho, así que
  | entre vecinos hay **un quinto**, no un cuarto: repartiendo el ancho entre
  | cuatro, la chapa del nombre se pasaba de su sitio y la del vecino la
  | tapaba —«MARC AZNAR» salía «MARC AZNAF»—. Son N+1 huecos, no N.
  */
  const hueco = caja.w / (masLlena + 1);

  const cabe = Math.min(radio, hueco / 2.3);

  /*
  | Debajo del círculo van la chapa del nombre y, si le cambiaron, el minuto:
  | tres radios largos. El portero está en el 0,9 del campo y ese minuto le
  | caía **a caballo del borde del césped**, mitad en verde y mitad en el
  | papel, ilegible en rojo. Se sube lo justo para que quepa entero dentro.
  */
  const abajo = caja.y + caja.h - cabe * 3.1;

  for (const sitio of sitios) {
    const cx = caja.x + caja.w * sitio.x;
    const cy = Math.min(caja.y + caja.h * sitio.y, abajo);

    g.el(
      `${etiqueta ? `${etiqueta} · ` : ""}Nº${sitio.jugador.dorsal || "·"} ${
        sitio.jugador.nombre
      }`,
      { x: cx - 210, y: cy - cabe - 4, w: 420, h: cabe * 3.4 + 24 },
      (ctx) =>
        pintaFichaOnce(
          ctx,
          sitio.jugador,
          cx,
          cy,
          cabe,
          marcasDe?.(sitio.jugador) ?? SIN_MARCAS,
          hueco,
        ),
    );
  }
}

/* ------------------------------------------------------------------ */
/*  9-11 · PARTIDOS: DOS POR HOJA, CUATRO CAMPOGRAMAS                  */
/* ------------------------------------------------------------------ */

/*
| Cada hoja lleva dos partidos y cada partido dos campogramas: el once que
| salió y el que acabó, con la convocatoria en medio.
|
| Es la hoja que más se mira de todo el informe y la que peor estaba: enseñaba
| un campo por partido, con el once inicial y nada más. Un partido no se lee
| así —lo que dice cómo compite un equipo es qué toca el entrenador cuando va
| por detrás, quién sale del banquillo y con qué dibujo termina—, y eso estaba
| entero en la ficha de BeSoccer sin bajarse.
|
| Aquí las fichas van con dorsal y nombre, sin cara: son cuarenta y cuatro en
| una hoja, y con retrato no se lee ninguna. La cara está en la hoja de
| plantilla y en la del once probable, que es donde sirve.
*/

/** "Primera Federación. Jornada 1" → "JORNADA 1". Un amistoso lo dice. */
function jornadaDe(partido: Partido | null) {
  if (!partido) return "";

  if (!esLiga(partido)) return rotuloCompeticion(partido);

  const numero = partido.competicion.match(/jornada\s*(\d+)/i)?.[1];

  return numero ? `JORNADA ${numero}` : partido.competicion.toUpperCase();
}

/** Lo que le pasó a cada jugador del equipo en ese partido. */
function marcasDelPartido(once: OncePartido, partido: Partido | null) {
  const marcas = new Map<string, MarcasFicha>();

  const dame = (nombre: string) => {
    const clave = normalizaNombre(nombre);

    const previa = marcas.get(clave);

    if (previa) return previa;

    const nueva: MarcasFicha = { goles: 0, asistencias: 0, amarillas: 0, rojas: 0 };

    marcas.set(clave, nueva);

    return nueva;
  };

  /* Los goles del equipo del informe: los del rival no se pintan en su campo. */
  for (const gol of partido?.goles ?? []) {
    if (!gol.propio || gol.tipo === "propia") continue;

    dame(gol.jugador).goles += 1;

    /* Y quien se la puso, que ya lo publica BeSoccer en la pestaña de goles. */
    if (gol.asistente) dame(gol.asistente).asistencias += 1;
  }

  for (const tarjeta of once.tarjetas ?? []) {
    const marca = dame(tarjeta.jugador);

    if (tarjeta.tipo === "roja") marca.rojas += 1;
    else marca.amarillas += 1;
  }

  for (const cambio of once.cambios ?? []) {
    if (cambio.sale) dame(cambio.sale).sale = cambio.minuto;
    if (cambio.entra) dame(cambio.entra).entra = cambio.minuto;
  }

  return marcas;
}

/**
 * Cómo se busca a un jugador entre nombres que vienen de sitios distintos.
 *
 * El de la alineación y el del evento los escribe BeSoccer, pero no siempre
 * igual —«Diego Gómez» y «D. Gómez»—, así que se compara sin acentos ni
 * puntos. Es la misma idea que `informe.ts` usa para cruzar los cambios.
 */
function normalizaNombre(valor: string) {
  return String(valor ?? "")
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

/** Las marcas de un jugador, buscándolo por nombre. */
function marcasDe(marcas: Map<string, MarcasFicha>, nombre: string) {
  const clave = normalizaNombre(nombre);

  const directa = marcas.get(clave);

  if (directa) return directa;

  /*
  | Un apellido contra un nombre completo: se acepta que uno contenga al otro,
  | que es lo que resuelve las abreviaturas. De cuatro letras para abajo no,
  | que «Pau» está dentro de «Pau Torres» y de «Paulino» y le colgaría el gol
  | de otro.
  */
  if (clave.length < 4) return SIN_MARCAS;

  for (const [otra, marca] of marcas) {
    if (otra.length < 4) continue;

    if (otra.includes(clave) || clave.includes(otra)) return marca;
  }

  return SIN_MARCAS;
}

/**
 * La columna del medio: quién estaba convocado.
 *
 * Titulares arriba y suplentes debajo, con el minuto al lado del que entró. Es
 * la lista que el original llevaba escrita a mano bajo cada campo y que no
 * decía quién se quedó sentado.
 */
function pintaConvocatoria(
  g: GuionHoja,
  once: OncePartido,
  marcas: Map<string, MarcasFicha>,
  caja: { x: number; y: number; w: number; h: number },
  etiqueta: string,
) {
  const dentro = panel(g, caja.x, caja.y, caja.w, caja.h, "CONVOCATORIA");

  const titulares = [...once.jugadores].sort((a, b) => a.puesto - b.puesto);

  const suplentes = once.suplentes ?? [];

  /* Dos rótulos de sección y una fila por jugador; el paso sale de lo que
     haya, que va de doce a veinticinco líneas según el partido. */
  const filas = titulares.length + suplentes.length + 2;

  const paso = Math.min(30, (caja.h - (dentro - caja.y) - 18) / Math.max(1, filas));

  let y = dentro + 10;

  const seccion = (titulo: string, cuantos: number) => {
    const yTitulo = y;

    g.el(
      `${etiqueta} · ${titulo}`,
      { x: caja.x + 10, y: yTitulo, w: caja.w - 20, h: paso },
      (ctx) =>
        escribe(
          ctx,
          `${titulo} (${cuantos})`,
          caja.x + 16,
          yTitulo + paso * 0.75,
          {
            tamano: Math.min(18, paso * 0.62),
            peso: 700,
            tinta: C.verde,
            espaciado: 2.5,
          },
        ),
    );

    y += paso;
  };

  const fila = (
    dorsal: string,
    nombre: string,
    minuto: string,
    entra: boolean,
    demarcacion: string,
  ) => {
    const yFila = y;

    g.el(
      `${etiqueta} · ${dorsal} ${nombre}`,
      { x: caja.x + 10, y: yFila, w: caja.w - 20, h: paso },
      (ctx) => {
        const marca = marcasDe(marcas, nombre);

        escribe(ctx, dorsal || "·", caja.x + 34, yFila + paso * 0.74, {
          tamano: Math.min(19, paso * 0.66),
          tinta: C.verde,
          alinea: "dcha",
        });

        escribe(ctx, nombre.toUpperCase(), caja.x + 42, yFila + paso * 0.74, {
          tamano: Math.min(19, paso * 0.66),
          peso: 600,
          /* En tinta fuerte el que jugó: el titular que aguantó los noventa y
             el suplente que llegó a entrar. El que se quedó sentado, en gris. */
          tinta: entra && !minuto ? "#6C6659" : C.navy,
          espaciado: 0.4,
          maxAncho: caja.w - 110,
        });

        /* A la derecha, lo que hizo: el minuto del cambio y los iconos. */
        let x = caja.x + caja.w - 14;

        if (minuto) {
          const cuerpo = Math.min(15, paso * 0.5);

          const tinta = entra ? "#2E7D52" : "#B4454F";

          escribe(ctx, `${minuto}'`, x, yFila + paso * 0.74, {
            tamano: cuerpo,
            peso: 700,
            tinta,
            alinea: "dcha",
          });

          /* El triángulo, pintado y no escrito: Barlow Condensed no trae «▲»
             ni «▼» y en su sitio salía el cuadradito de la fuente que falta. */
          fuente(ctx, cuerpo, 700);

          const anchoMinuto = ctx.measureText(`${minuto}'`).width;

          triangulo(
            ctx,
            x - anchoMinuto - cuerpo * 0.44,
            yFila + paso * 0.74 - cuerpo * 0.34,
            cuerpo * 0.62,
            entra,
            tinta,
          );

          x -= 46;
        }

        const alto = Math.min(14, paso * 0.5);

        for (let i = 0; i < marca.rojas; i += 1) {
          ctx.fillStyle = "#B4454F";
          rectRedondo(ctx, x - alto * 0.68, yFila + paso * 0.32, alto * 0.68, alto, 2);
          ctx.fill();

          x -= alto;
        }

        for (let i = 0; i < marca.amarillas; i += 1) {
          ctx.fillStyle = "#E7C24B";
          rectRedondo(ctx, x - alto * 0.68, yFila + paso * 0.32, alto * 0.68, alto, 2);
          ctx.fill();

          x -= alto;
        }

        /* La asistencia, que ya la publica BeSoccer en la pestaña de goles. */
        for (let i = 0; i < marca.asistencias; i += 1) {
          ctx.fillStyle = AZUL_ASISTENCIA;
          ctx.beginPath();
          ctx.arc(x - alto / 2, yFila + paso * 0.32 + alto / 2, alto / 2, 0, Math.PI * 2);
          ctx.fill();

          escribe(ctx, "A", x - alto / 2, yFila + paso * 0.32 + alto * 0.78, {
            tamano: alto * 0.78,
            peso: 700,
            tinta: C.papel,
            alinea: "centro",
          });

          x -= alto + 2;
        }

        if (marca.goles > 0) {
          if (marca.goles > 1) {
            ctx.fillStyle = C.verde;
            ctx.beginPath();
            ctx.arc(x - alto / 2, yFila + paso * 0.32 + alto / 2, alto / 2, 0, Math.PI * 2);
            ctx.fill();

            escribe(
              ctx,
              String(marca.goles),
              x - alto / 2,
              yFila + paso * 0.32 + alto * 0.78,
              { tamano: alto * 0.8, tinta: C.papel, alinea: "centro" },
            );
          } else {
            balon(
              ctx,
              x - alto / 2,
              yFila + paso * 0.32 + alto / 2,
              alto / 2,
              C.papel,
              C.verde,
            );
          }

          x -= alto + 2;
        }

        if (demarcacion) {
          escribe(ctx, demarcacion, x - 6, yFila + paso * 0.74, {
            tamano: Math.min(14, paso * 0.46),
            peso: 500,
            tinta: "#9A9384",
            espaciado: 1,
            alinea: "dcha",
          });
        }
      },
    );

    y += paso;
  };

  seccion("TITULARES", titulares.length);

  for (const jugador of titulares) {
    const marca = marcasDe(marcas, jugador.nombre);

    fila(
      jugador.dorsal,
      jugador.nombre,
      marca.sale ?? "",
      false,
      jugador.demarcacion ?? "",
    );
  }

  if (suplentes.length > 0) {
    seccion("SUPLENTES", suplentes.length);

    for (const suplente of suplentes) {
      fila(
        suplente.dorsal,
        suplente.nombre,
        suplente.entra ?? "",
        true,
        suplente.demarcacion ?? "",
      );
    }
  } else {
    const yAviso = y;

    g.el(
      `${etiqueta} · sin banquillo`,
      { x: caja.x + 10, y: yAviso, w: caja.w - 20, h: paso * 2 },
      (ctx) =>
        escribe(
          ctx,
          "SIN BANQUILLO PUBLICADO",
          caja.x + caja.w / 2,
          yAviso + paso,
          {
            tamano: 16,
            peso: 500,
            tinta: "#9A9384",
            espaciado: 1.5,
            alinea: "centro",
            maxAncho: caja.w - 30,
          },
        ),
    );
  }

  /*
  | Aquí iba el marcador otra vez, al pie de la columna. Fuera: ya está en el
  | titular del partido, tres centímetros más arriba, y con quince suplentes la
  | lista llega hasta abajo y se le montaba encima.
  */
}

/** Un partido: rótulo, once inicial, convocatoria y once final. */
function pintaBloquePartido(
  g: GuionHoja,
  once: OncePartido,
  partido: Partido | null,
  caja: { x: number; y: number; w: number; h: number },
) {
  const etiqueta = partido
    ? `${partido.local.nombre}-${partido.visitante.nombre}`
    : "Partido";

  const marcas = marcasDelPartido(once, partido);

  /* -------------------------------------------------- el rótulo */

  /*
  | Centrado sobre los dos campos, que es donde lo pidió el cuerpo técnico: el
  | partido, la jornada, el resultado y con qué dibujo empieza y acaba. Antes
  | el titular iba pegado a la izquierda y con dos partidos por hoja no se
  | sabía cuál era de quién.
  */
  const titulo = partido
    ? `${partido.local.nombre.toUpperCase()}  ${partido.local.goles ?? 0} - ${
        partido.visitante.goles ?? 0
      }  ${partido.visitante.nombre.toUpperCase()}`
    : "PARTIDO";

  const centro = caja.x + caja.w / 2;

  g.el(
    `Partido · ${etiqueta}`,
    { x: caja.x, y: caja.y, w: caja.w, h: 42 },
    (ctx) =>
      escribe(ctx, titulo, centro, caja.y + 32, {
        tamano: 28,
        tinta: C.navy,
        espaciado: 1,
        alinea: "centro",
        maxAncho: caja.w - 20,
      }),
  );

  const jornada = jornadaDe(partido);

  const fecha = partido ? fechaCorta(partido.fecha) : "";

  g.el(
    `Jornada · ${etiqueta}`,
    { x: caja.x, y: caja.y + 42, w: caja.w, h: 30 },
    (ctx) =>
      escribe(
        ctx,
        [jornada, fecha].filter(Boolean).join(" · "),
        centro,
        caja.y + 66,
        {
          tamano: 20,
          peso: 600,
          tinta: "#8A8370",
          espaciado: 3,
          alinea: "centro",
          maxAncho: caja.w - 20,
        },
      ),
  );

  /*
  | Con qué dibujo empieza y con cuál acaba.
  |
  | La de salida la publica BeSoccer y es la buena. La del final **no la publica
  | nadie**: se cuenta por las demarcaciones de los once que terminan, que es
  | una lectura gruesa —un 1-4-2-3-1 se cuenta como 1-4-5-1—, así que sólo se
  | escribe cuando de verdad cambia respecto de contar igual el once inicial, y
  | se dice que es por demarcación. Poner las dos sin más las hacía comparables
  | y no lo son.
  */
  const finales = onceFinal(once);

  const inicial = once.estructura || estructuraDeDemarcaciones(once.jugadores);

  const final = estructuraDeDemarcaciones(finales);

  const cambia = Boolean(final) && final !== estructuraDeDemarcaciones(once.jugadores);

  g.el(
    `Estructuras · ${etiqueta}`,
    { x: caja.x, y: caja.y + 74, w: caja.w, h: 40 },
    (ctx) => {
      const texto = !inicial
        ? "SIN ESTRUCTURA PUBLICADA"
        : cambia
          ? `INICIA ${inicial}   ·   TERMINA ${final} (POR DEMARCACIÓN)`
          : `INICIA ${inicial}   ·   TERMINA IGUAL`;

      escribe(ctx, texto, centro, caja.y + 104, {
        tamano: 22,
        peso: 700,
        tinta: cambia ? C.verde : C.navy,
        espaciado: 2,
        alinea: "centro",
        maxAncho: caja.w - 20,
      });
    },
  );

  /* -------------------------------------------------- los campos */

  const arriba = caja.y + 120;

  const anchoCampo = 300;

  const altoCampo = Math.min(caja.h - 150, anchoCampo / 0.63);

  const zonaMedio = {
    x: caja.x + anchoCampo + 12,
    y: arriba,
    w: caja.w - anchoCampo * 2 - 24,
    h: caja.y + caja.h - arriba,
  };

  pintaOnceEnCampo(
    g,
    once,
    { x: caja.x, y: arriba, w: anchoCampo, h: altoCampo },
    20,
    `${etiqueta} inicial`,
    (jugador) => {
      const marca = marcasDe(marcas, jugador.nombre);

      /* En el campo de salida, del cambio sólo interesa que se fue. */
      return { ...marca, entra: undefined };
    },
  );

  pintaOnceEnCampo(
    g,
    { ...once, jugadores: finales },
    {
      x: caja.x + caja.w - anchoCampo,
      y: arriba,
      w: anchoCampo,
      h: altoCampo,
    },
    20,
    `${etiqueta} final`,
    (jugador) => {
      const marca = marcasDe(marcas, jugador.nombre);

      /* Y en el de llegada, que entró. */
      return { ...marca, sale: undefined };
    },
  );

  const rotulo = (texto: string, x: number) => {
    const y = arriba + altoCampo + 6;

    g.el(
      `${etiqueta} · ${texto}`,
      { x, y, w: anchoCampo, h: 32 },
      (ctx) =>
        chapa(ctx, texto, {
          x: x + anchoCampo / 2,
          y: y + 2,
          alto: 28,
          fondo: C.navy,
          tinta: C.crema,
          tamano: 16,
          espaciado: 3,
          padding: 14,
          desdeCentro: true,
        }),
    );
  };

  rotulo("ONCE INICIAL", caja.x);

  rotulo(
    (once.cambios ?? []).length > 0 ? "TRAS LOS CAMBIOS" : "SIN CAMBIOS PUBLICADOS",
    caja.x + caja.w - anchoCampo,
  );

  /* -------------------------------------------------- la convocatoria */

  pintaConvocatoria(g, once, marcas, zonaMedio, etiqueta);
}

/** Dos partidos por hoja, cada uno con sus dos campogramas. */
function pintaPartidos(
  g: GuionHoja,
  data: InformeData,
  escudo: HTMLImageElement | null,
  onces: OncePartido[],
  partidos: Map<string, Partido>,
) {
  papel(g);
  cabecera(g, "PARTIDOS", data, escudo);

  /*
  | La columna mide siempre media hoja, aunque el partido venga solo: el bloque
  | es campo-lista-campo y estirado a lo ancho de la diapositiva deja una
  | columna de convocatoria de un palmo de ancha con los campos en los extremos.
  | Un partido suelto se centra, que es lo que se hace a mano.
  */
  const mitad = (ANCHO - 40) / 2;

  const izquierda =
    onces.length > 1 ? MARGEN : MARGEN + (ANCHO - mitad) / 2;

  onces.forEach((once, indice) => {
    pintaBloquePartido(g, once, partidos.get(once.partidoId) ?? null, {
      x: izquierda + indice * (mitad + 40),
      y: CUERPO_Y - 24,
      w: mitad,
      h: CUERPO_ALTO + 24,
    });
  });

  const conCambios = onces.filter((once) => (once.cambios ?? []).length > 0);

  pie(
    g,
    conCambios.length === onces.length
      ? "ONCE INICIAL, CAMBIOS Y CONVOCATORIA · FUENTE BESOCCER"
      : "BESOCCER NO PUBLICA CAMBIOS DE TODOS LOS PARTIDOS · LO QUE FALTE SE VE EN EL CAMPO DE LA IZQUIERDA",
  );
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

  /*
  | Qué partidos se llevan las hojas de partidos.
  |
  | Lo que elija la pantalla, en su orden; y si no elige nada —el arnés de
  | consola—, los últimos que haya bajados hasta seis, que es lo que se hacía
  | antes de que hubiera pop-up.
  */
  const onces = (data.partidosElegidos ?? []).length
    ? data.partidosElegidos!.flatMap((id) => {
        const once = informe.onces.find((uno) => uno.partidoId === id);

        return once ? [once] : [];
      })
    : informe.onces.slice(0, ONCES_EN_INFORME);

  /* -------------------------------------------------- las imágenes */

  const urls: string[] = [informe.escudo];

  if (informe.entrenador?.foto) urls.push(informe.entrenador.foto);
  if (informe.estadio?.foto) urls.push(informe.estadio.foto);

  for (const fila of informe.clasificacion.total) urls.push(fila.escudo);

  for (const partido of resultados) {
    urls.push(partido.local.escudo, partido.visitante.escudo);
  }

  /* Los retratos de la plantilla, para las dos hojas de campograma. Son los
     de la hoja RIVALES —Supabase—, no los de BeSoccer. */
  for (const jugador of data.plantilla ?? []) {
    if (jugador.foto) urls.push(jugador.foto);
  }

  for (const etapa of informe.entrenador?.trayectoria ?? []) {
    if (etapa.escudo) urls.push(etapa.escudo);
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

  /*
  | El entrenador va el CUARTO, antes de los números.
  |
  | Se lee así en la reunión: quién es el rival (portada), cómo va (tabla y
  | resultados) y **a quién nos enfrentamos** —el entrenador y su casa— antes
  | de entrar en estadísticas y tipología. Ojo: la posición es la cuarta
  | cuando están las hojas de clasificación y resultados; si el rival no las
  | tiene, sube, porque cada hoja sólo se pinta si hay algo que enseñar.
  */
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

  hoja("Estadísticas", (g) => pintaEstadisticas(g, data, escudo, conFicha));

  /* La tabla de tipología del original. Sin goles no hay nada que repartir. */
  if (conFicha.length > 0) {
    hoja("Tipología de gol", (g) => pintaTipologia(g, data, escudo, conFicha));
  }

  /*
  | Las dos hojas de campograma. Van con la plantilla de la hoja RIVALES, no
  | con BeSoccer, así que sólo salen cuando la pantalla las manda —el arnés de
  | consola, por ejemplo, no tiene plantilla y monta el informe sin ellas—.
  */
  if ((data.plantilla ?? []).length > 0) {
    hoja("Plantilla", (g) => pintaPlantilla(g, data, escudo, imagenes));
  }

  if ((data.onceProbable ?? []).length > 0) {
    hoja("Once probable", (g) => pintaOnceProbable(g, data, escudo, imagenes));
  }

  /*
  | Y los partidos, de dos en dos hasta los seis. Aquí ya no hay hoja de
  | «último once»: el once que se espera es el de la hoja anterior, que lo pone
  | el cuerpo técnico, y el que jugó el rival sale aquí con sus cambios.
  |
  | Cuántos son ya está decidido arriba: cuatro partidos son dos hojas —la 9 y
  | la 10—, que es lo que se pide casi siempre.
  */
  for (let i = 0; i < onces.length; i += 2) {
    const pareja = onces.slice(i, i + 2);

    const cuales = pareja
      .map((once) => {
        const partido = porId.get(once.partidoId);

        return partido ? (esLiga(partido) ? "liga" : "amistoso") : "?";
      })
      .join(" y ");

    hoja(`Partidos · ${cuales}`, (g) =>
      pintaPartidos(g, data, escudo, pareja, porId),
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
