/**
 * LOS GRÁFICOS DEL INFORME DE ABP, DIBUJADOS COMO IMAGEN.
 *
 * Un correo no ejecuta nada: ni una librería de gráficos, ni un `<svg>` —que
 * Gmail tira—, ni un `<canvas>`. Lo único que sobrevive en todos los clientes
 * es **una imagen**, así que los gráficos se pintan aquí en un lienzo y salen
 * en PNG. El mismo PNG se enseña en la vista previa y viaja dentro del correo
 * (ver `lib/correo/gmail.ts`, que los manda como partes con `Content-ID`).
 *
 * Se pinta a **dos veces el tamaño** y se enseña a la mitad: es lo que hace que
 * en un móvil o en una pantalla buena no se vean los bordes pastosos.
 *
 * Funciona igual en el navegador y en el arnés de Node: lo único que se pide
 * del entorno es `document.createElement("canvas")`, que el arnés sustituye por
 * `@napi-rs/canvas`. Nada de `window`, nada de medir con el DOM.
 */

/** Una fila de la liga, tal y como la devuelve `/api/data-analisis?abpInforme=1`. */
export type FilaLigaAbp = {
  equipo: string;
  partidos: number;
  favor: number;
  favorPorPartido: number;
  contra: number;
  contraPorPartido: number;
  penaltisFavor: number;
  penaltisContra: number;
  corners: number | null;
  cornersContra: number | null;
};

/** Una temporada nuestra, ya recortada a los mismos partidos. */
export type FilaTemporadaAbp = FilaLigaAbp & {
  temporada: string;
  esActual: boolean;
};

export type ComparativaAbp = {
  temporada: string;
  jugados: number;
  equipos: number;
  liga: FilaLigaAbp[];
  nosotros: FilaLigaAbp | null;
  puesto: number | null;
  historico: FilaTemporadaAbp[];
};

/* ------------------------------------------------------------------ */
/*  PALETA Y LIENZO                                                    */
/* ------------------------------------------------------------------ */

const ORO = "#C8A96B";
const NAVY = "#0F1E3D";
const TINTA = "#374151";
const SUAVE = "#9AA3AE";
const REJILLA = "#E8E4DA";
const PAPEL = "#FFFFFF";

/** Verde y naranja de la casa: separan bien también en daltonismo. */
const BIEN = "#1B9E77";
const MAL = "#D95F02";

const FAMILIA = '"Barlow Condensed", Arial, Helvetica, sans-serif';

const ESCALA = 2;

type Pincel = CanvasRenderingContext2D;

function lienzo(ancho: number, alto: number) {
  const canvas = document.createElement("canvas");

  canvas.width = ancho * ESCALA;
  canvas.height = alto * ESCALA;

  const ctx = canvas.getContext("2d") as Pincel | null;

  if (!ctx) throw new Error("El navegador no ha dado lienzo.");

  ctx.scale(ESCALA, ESCALA);

  ctx.fillStyle = PAPEL;
  ctx.fillRect(0, 0, ancho, alto);

  ctx.textBaseline = "alphabetic";

  return { canvas, ctx };
}

function fuente(ctx: Pincel, px: number, peso: 400 | 600 | 700 = 600) {
  ctx.font = `${peso} ${px}px ${FAMILIA}`;
}

function escribe(
  ctx: Pincel,
  texto: string,
  x: number,
  y: number,
  opciones: {
    px?: number;
    peso?: 400 | 600 | 700;
    tinta?: string;
    alinea?: CanvasTextAlign;
  } = {},
) {
  const { px = 12, peso = 600, tinta = TINTA, alinea = "left" } = opciones;

  fuente(ctx, px, peso);
  ctx.fillStyle = tinta;
  ctx.textAlign = alinea;
  ctx.fillText(texto, x, y);
  ctx.textAlign = "left";
}

/** El título y el pie que llevan todos los gráficos, iguales. */
function marco(
  ctx: Pincel,
  ancho: number,
  alto: number,
  titulo: string,
  pie: string,
) {
  escribe(ctx, titulo.toUpperCase(), 0, 16, { px: 14, peso: 700, tinta: NAVY });

  if (pie) {
    escribe(ctx, pie, 0, alto - 4, { px: 11, peso: 400, tinta: SUAVE });
  }

  return { arriba: 30, abajo: alto - (pie ? 22 : 8), izquierda: 0, derecha: ancho };
}

/** Un número redondo por encima del máximo, para que el eje no acabe en 3,7. */
function techo(valor: number) {
  if (valor <= 0) return 1;

  const escalon = valor <= 1 ? 0.25 : valor <= 3 ? 0.5 : 1;

  return Math.ceil(valor / escalon) * escalon;
}

function fmt(valor: number, decimales = 2) {
  return valor.toFixed(decimales).replace(".", ",");
}

/*
| Cómo se llama a cada equipo cuando sólo caben doce letras.
|
| Cortar por la mitad es lo que daba «Madrid Castill», «Rayo Majadahon» y
| «Gimnàstic Tarr»: se lee mal y encima todos empiezan igual. Los que no se
| resuelven quitando el «CD» de delante van escritos como los llama todo el
| mundo. Lo que no esté aquí se queda con su palabra más larga, que casi
| siempre es la buena («Algeciras CF» → «Algeciras»).
*/
const APODOS: Record<string, string> = {
  "real madrid castilla": "Castilla",
  "atletico madrid b": "At. Madrileño",
  "atletico madrileno": "At. Madrileño",
  "gimnastic tarragona": "Nàstic",
  "rayo majadahonda": "Majadahonda",
  "juventud torremolinos": "Torremolinos",
  "sd huesca b": "Huesca B",
  "ue sant andreu": "Sant Andreu",
  "ce europa": "Europa",
  "real murcia": "Murcia",
  "real zaragoza": "Zaragoza",
  "real jaen": "Jaén",
  "ud ibiza": "Ibiza",
  "villarreal b": "Villarreal B",
  "fc cartagena": "Cartagena",
  "aguilas fc": "Águilas",
  "ad alcorcon": "Alcorcón",
  "antequera cf": "Antequera",
  "algeciras cf": "Algeciras",
  "cd teruel": "Teruel",
  "hercules cf": "Hércules",
};

function sinTildes(texto: string) {
  return texto
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

/** El nombre con el que se reconoce a un equipo en un gráfico pequeño. */
export function nombreCorto(equipo: string) {
  const conocido = APODOS[sinTildes(equipo)];

  if (conocido) return conocido;

  const limpio = equipo
    .replace(/^(cd|ud|cf|fc|sd|ad|rc|rcd|ce|ue|club|real)\s+/i, "")
    .replace(/\s+(cf|fc|cd|sad)$/i, "")
    .trim();

  if (limpio.length <= 13) return limpio || equipo;

  /* La palabra más larga es la que distingue: «Deportivo Alavés» → «Alavés». */
  const palabras = limpio.split(/\s+/).filter((una) => una.length > 2);

  const larga = palabras.sort((a, b) => b.length - a.length)[0] ?? limpio;

  return larga.slice(0, 13);
}

/* ------------------------------------------------------------------ */
/*  1 · LA DISPERSIÓN DE LA LIGA                                       */
/* ------------------------------------------------------------------ */

/**
 * Cada equipo de la categoría, por lo que marca y lo que le marcan de ABP.
 *
 * El eje de lo que se encaja va **al revés** a propósito: así arriba siempre es
 * mejor y la esquina de arriba a la derecha es donde se quiere estar. Las
 * medianas parten el cuadro en cuatro para poder decir «estamos en el cuadrante
 * bueno» sin hacer cuentas.
 */
export function dispersionLiga(
  comparativa: ComparativaAbp,
  ancho = 760,
  alto = 420,
) {
  const { canvas, ctx } = lienzo(ancho, alto);

  const caja = marco(
    ctx,
    ancho,
    alto,
    `Balón parado en la categoría · ${comparativa.temporada}`,
    "Goles de ABP por partido, estimados con los remates de cada vía (los penaltis son dato). Arriba y a la derecha, mejor.",
  );

  const margenIzq = 46;
  const margenAbajo = 30;

  const x0 = margenIzq;
  const x1 = ancho - 16;

  /* Aire arriba: las etiquetas de los puntos van por encima de su disco y sin
     este margen se meten debajo del título. */
  const y0 = caja.arriba + 26;
  const y1 = caja.abajo - margenAbajo;

  const filas = comparativa.liga;

  const maxX = techo(Math.max(0.5, ...filas.map((f) => f.favorPorPartido)));
  const maxY = techo(Math.max(0.5, ...filas.map((f) => f.contraPorPartido)));

  const px = (valor: number) => x0 + (valor / maxX) * (x1 - x0);

  /* Invertido: menos goles encajados, más arriba. */
  const py = (valor: number) => y0 + (valor / maxY) * (y1 - y0);

  /* --- rejilla --- */

  ctx.strokeStyle = REJILLA;
  ctx.lineWidth = 1;

  for (let i = 0; i <= 4; i += 1) {
    const y = y0 + ((y1 - y0) * i) / 4;

    ctx.beginPath();
    ctx.moveTo(x0, y);
    ctx.lineTo(x1, y);
    ctx.stroke();

    escribe(ctx, fmt((maxY * i) / 4, 1), x0 - 6, y + 4, {
      px: 10,
      peso: 400,
      tinta: SUAVE,
      alinea: "right",
    });
  }

  for (let i = 0; i <= 4; i += 1) {
    const x = x0 + ((x1 - x0) * i) / 4;

    ctx.beginPath();
    ctx.moveTo(x, y0);
    ctx.lineTo(x, y1);
    ctx.stroke();

    escribe(ctx, fmt((maxX * i) / 4, 1), x, y1 + 14, {
      px: 10,
      peso: 400,
      tinta: SUAVE,
      alinea: "center",
    });
  }

  escribe(ctx, "MARCA MÁS →", x1, y1 + 26, {
    px: 10,
    peso: 600,
    tinta: SUAVE,
    alinea: "right",
  });

  /*
  | El rótulo del eje vertical va GIRADO en el margen, no en la esquina.
  |
  | Puesto arriba a la izquierda se cruzaba con la etiqueta del equipo que
  | ocupa el (0,0) —el que no encaja ni un gol de ABP, que es justo donde se
  | quiere estar y donde estamos—, y se leían los dos uno encima del otro.
  */
  ctx.save();
  ctx.translate(13, (y0 + y1) / 2);
  ctx.rotate(-Math.PI / 2);

  escribe(ctx, "ENCAJA MENOS →", 0, 0, {
    px: 10,
    peso: 600,
    tinta: SUAVE,
    alinea: "center",
  });

  ctx.restore();

  /* --- medianas --- */

  const mediana = (valores: number[]) => {
    if (valores.length === 0) return 0;

    const orden = [...valores].sort((a, b) => a - b);
    const medio = Math.floor(orden.length / 2);

    return orden.length % 2 ? orden[medio] : (orden[medio - 1] + orden[medio]) / 2;
  };

  const medX = mediana(filas.map((f) => f.favorPorPartido));
  const medY = mediana(filas.map((f) => f.contraPorPartido));

  ctx.save();
  ctx.setLineDash([4, 4]);
  ctx.strokeStyle = "#C9C2B2";

  ctx.beginPath();
  ctx.moveTo(px(medX), y0);
  ctx.lineTo(px(medX), y1);
  ctx.stroke();

  ctx.beginPath();
  ctx.moveTo(x0, py(medY));
  ctx.lineTo(x1, py(medY));
  ctx.stroke();
  ctx.restore();

  /* --- los equipos --- */

  const nuestro = comparativa.nosotros;

  /*
  | LOS EMPATES SE AGRUPAN, O NO SE LEE NADA.
  |
  | Con tres jornadas jugadas media categoría comparte cifra exacta —cinco
  | equipos a 0,67 y 0,33—, así que los discos caen unos encima de otros y los
  | nombres se pisan hasta ser ilegibles. Cada coordenada se dibuja como un
  | anillo de discos con **una sola etiqueta**: el nombre si está solo, y
  | «n equipos» si no. Donde estamos nosotros manda nuestro nombre, que es lo
  | que se busca al abrir el gráfico.
  */
  const grupos = new Map<string, FilaLigaAbp[]>();

  filas.forEach((fila) => {
    const clave = `${fila.favorPorPartido.toFixed(3)}|${fila.contraPorPartido.toFixed(3)}`;

    grupos.set(clave, [...(grupos.get(clave) ?? []), fila]);
  });

  grupos.forEach((delGrupo) => {
    const cx = px(delGrupo[0].favorPorPartido);
    const cy = py(delGrupo[0].contraPorPartido);

    const conNosotros =
      nuestro !== null && delGrupo.some((una) => una.equipo === nuestro.equipo);

    const radio = delGrupo.length === 1 ? 0 : 5 + delGrupo.length;

    delGrupo.forEach((fila, indice) => {
      const angulo = (Math.PI * 2 * indice) / delGrupo.length - Math.PI / 2;

      const x = cx + Math.cos(angulo) * radio;
      const y = cy + Math.sin(angulo) * radio;

      const esNuestro = nuestro !== null && fila.equipo === nuestro.equipo;

      ctx.beginPath();
      ctx.arc(x, y, esNuestro ? 7 : 4.5, 0, Math.PI * 2);
      ctx.fillStyle = esNuestro ? ORO : "rgba(15,30,61,0.28)";
      ctx.fill();

      if (esNuestro) {
        ctx.lineWidth = 2;
        ctx.strokeStyle = NAVY;
        ctx.stroke();
      }
    });

    const etiqueta =
      delGrupo.length === 1
        ? nombreCorto(delGrupo[0].equipo)
        : conNosotros && nuestro
          ? `${nombreCorto(nuestro.equipo)} y ${delGrupo.length - 1} más`
          : `${delGrupo.length} equipos`;

    escribe(ctx, etiqueta, cx, cy - radio - 9, {
      px: conNosotros ? 12 : 10,
      peso: conNosotros ? 700 : 400,
      tinta: conNosotros ? NAVY : SUAVE,
      alinea: "center",
    });
  });

  return canvas.toDataURL("image/png");
}

/* ------------------------------------------------------------------ */
/*  2 · EL RANKING                                                     */
/* ------------------------------------------------------------------ */

/**
 * La categoría entera en barras, de más a menos, con nosotros encendidos.
 *
 * La dispersión dice en qué cuadrante estamos; esto dice el número exacto y
 * cuántos hay por delante, que es lo primero que se pregunta al verlo.
 */
export function rankingLiga(
  comparativa: ComparativaAbp,
  cual: "favor" | "contra" = "favor",
  ancho = 760,
  alto = 300,
) {
  const { canvas, ctx } = lienzo(ancho, alto);

  const aFavor = cual === "favor";

  const filas = [...comparativa.liga].sort((a, b) =>
    aFavor
      ? b.favorPorPartido - a.favorPorPartido
      : a.contraPorPartido - b.contraPorPartido,
  );

  const caja = marco(
    ctx,
    ancho,
    alto,
    aFavor
      ? "Quién marca más de balón parado"
      : "Quién encaja menos de balón parado",
    `Goles por partido · ${comparativa.temporada} · ${comparativa.jugados} jornada${comparativa.jugados === 1 ? "" : "s"} jugada${comparativa.jugados === 1 ? "" : "s"}`,
  );

  const x0 = 4;
  const x1 = ancho - 8;

  const disponible = caja.abajo - caja.arriba;

  const paso = Math.max(9, Math.min(16, disponible / Math.max(1, filas.length)));

  const anchoBarra = x1 - x0 - 150;

  const maximo = Math.max(
    0.2,
    ...filas.map((f) => (aFavor ? f.favorPorPartido : f.contraPorPartido)),
  );

  const nuestro = comparativa.nosotros;

  filas.forEach((fila, indice) => {
    const y = caja.arriba + indice * paso;

    if (y + paso > caja.abajo) return;

    const esNuestro = nuestro !== null && fila.equipo === nuestro.equipo;

    const valor = aFavor ? fila.favorPorPartido : fila.contraPorPartido;

    escribe(ctx, `${indice + 1}`, x0 + 14, y + paso - 3, {
      px: 10,
      peso: 400,
      tinta: SUAVE,
      alinea: "right",
    });

    escribe(ctx, nombreCorto(fila.equipo), x0 + 20, y + paso - 3, {
      px: esNuestro ? 12 : 11,
      peso: esNuestro ? 700 : 400,
      tinta: esNuestro ? NAVY : TINTA,
    });

    const largo = (valor / maximo) * anchoBarra;

    ctx.fillStyle = esNuestro ? ORO : "rgba(15,30,61,0.18)";
    ctx.fillRect(x0 + 130, y + 2, Math.max(1, largo), paso - 6);

    escribe(ctx, fmt(valor), x0 + 136 + largo, y + paso - 3, {
      px: 10,
      peso: esNuestro ? 700 : 400,
      tinta: esNuestro ? NAVY : SUAVE,
    });
  });

  return canvas.toDataURL("image/png");
}

/* ------------------------------------------------------------------ */
/*  3 · NUESTRAS TEMPORADAS, A ESTAS ALTURAS                           */
/* ------------------------------------------------------------------ */

/**
 * El Castilla contra el Castilla, con los mismos partidos jugados.
 *
 * Es la comparación honesta: los tres partidos de este año contra los tres
 * primeros de cada temporada anterior, no contra sus treinta y ocho. A favor en
 * verde, en contra en naranja, y la temporada en curso con el filo dorado.
 */
export function temporadasCastilla(
  comparativa: ComparativaAbp,
  ancho = 760,
  alto = 320,
) {
  const { canvas, ctx } = lienzo(ancho, alto);

  const filas = comparativa.historico;

  const caja = marco(
    ctx,
    ancho,
    alto,
    "Nuestro balón parado, temporada a temporada",
    `Goles de ABP en los ${comparativa.jugados} primeros partidos de cada temporada · verde a favor, naranja en contra`,
  );

  if (filas.length === 0) {
    escribe(ctx, "Todavía no hay temporadas que comparar.", 0, caja.arriba + 30, {
      px: 13,
      peso: 400,
      tinta: SUAVE,
    });

    return canvas.toDataURL("image/png");
  }

  const x0 = 38;
  const x1 = ancho - 10;
  const y0 = caja.arriba + 10;
  const y1 = caja.abajo - 26;

  const maximo = Math.max(1, ...filas.flatMap((f) => [f.favor, f.contra]));

  /*
  | Aquí se cuentan goles, así que el eje va de uno en uno.
  |
  | Con cuatro divisiones fijas y un máximo de 2, las etiquetas salían «2, 2,
  | 1, 1, 0»: la mitad repetidas y ninguna en su sitio. Se parte en tantos
  | escalones como goles haya, y si algún día son muchos, de cuatro en cuatro.
  */
  const divisiones = maximo <= 6 ? maximo : 4;

  const escalon = maximo / divisiones;

  ctx.strokeStyle = REJILLA;

  for (let i = 0; i <= divisiones; i += 1) {
    const y = y1 - ((y1 - y0) * i) / divisiones;

    ctx.beginPath();
    ctx.moveTo(x0, y);
    ctx.lineTo(x1, y);
    ctx.stroke();

    escribe(ctx, fmt(escalon * i, escalon < 1 ? 1 : 0), x0 - 6, y + 4, {
      px: 10,
      peso: 400,
      tinta: SUAVE,
      alinea: "right",
    });
  }

  const paso = (x1 - x0) / filas.length;

  const anchoBarra = Math.min(30, paso / 2.6);

  filas.forEach((fila, indice) => {
    const centro = x0 + paso * (indice + 0.5);

    const alturaFavor = ((y1 - y0) * fila.favor) / maximo;
    const alturaContra = ((y1 - y0) * fila.contra) / maximo;

    ctx.fillStyle = BIEN;
    ctx.fillRect(centro - anchoBarra - 2, y1 - alturaFavor, anchoBarra, alturaFavor);

    ctx.fillStyle = MAL;
    ctx.fillRect(centro + 2, y1 - alturaContra, anchoBarra, alturaContra);

    escribe(ctx, fmt(fila.favor, 0), centro - anchoBarra / 2 - 2, y1 - alturaFavor - 4, {
      px: 11,
      peso: 700,
      tinta: BIEN,
      alinea: "center",
    });

    escribe(ctx, fmt(fila.contra, 0), centro + anchoBarra / 2 + 2, y1 - alturaContra - 4, {
      px: 11,
      peso: 700,
      tinta: MAL,
      alinea: "center",
    });

    escribe(ctx, fila.temporada, centro, y1 + 16, {
      px: fila.esActual ? 12 : 11,
      peso: fila.esActual ? 700 : 400,
      tinta: fila.esActual ? NAVY : TINTA,
      alinea: "center",
    });

    if (fila.esActual) {
      ctx.fillStyle = ORO;
      ctx.fillRect(centro - paso / 2 + 4, y1 + 21, paso - 8, 2);
    }
  });

  return canvas.toDataURL("image/png");
}

/* ------------------------------------------------------------------ */
/*  LOS TRES, CON SU SITIO EN EL INFORME                               */
/* ------------------------------------------------------------------ */

export type GraficoInforme = {
  /** El identificador con el que el correo lo llama: `src="cid:…"`. */
  cid: string;
  titulo: string;
  /** `data:image/png;base64,…` */
  imagen: string;
  ancho: number;
};

/**
 * Dibuja los gráficos del informe.
 *
 * Si no hay dato de la categoría no se dibuja nada: un gráfico vacío ocupa lo
 * mismo que uno lleno y no dice nada.
 */
export function graficosDelInforme(
  comparativa: ComparativaAbp | null,
): GraficoInforme[] {
  if (!comparativa || comparativa.liga.length === 0) return [];

  const graficos: GraficoInforme[] = [
    {
      cid: "abp-dispersion",
      titulo: "Dónde estamos en la categoría",
      imagen: dispersionLiga(comparativa),
      ancho: 760,
    },
    {
      cid: "abp-ranking-favor",
      titulo: "Quién marca más de balón parado",
      imagen: rankingLiga(comparativa, "favor"),
      ancho: 760,
    },
    {
      cid: "abp-ranking-contra",
      titulo: "Quién encaja menos de balón parado",
      imagen: rankingLiga(comparativa, "contra"),
      ancho: 760,
    },
  ];

  if (comparativa.historico.length > 1) {
    graficos.push({
      cid: "abp-temporadas",
      titulo: "Nuestro balón parado, temporada a temporada",
      imagen: temporadasCastilla(comparativa),
      ancho: 760,
    });
  }

  return graficos;
}
