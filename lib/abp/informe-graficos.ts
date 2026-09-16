/**
 * LOS GRÁFICOS DEL INFORME DE ABP, DIBUJADOS COMO IMAGEN.
 *
 * Un correo no ejecuta nada: ni una librería de gráficos, ni un `<svg>` —que
 * Gmail tira—, ni un `<canvas>`. Lo único que sobrevive en todos los clientes
 * es **una imagen**, así que los gráficos se pintan aquí en un lienzo y salen
 * en PNG. El mismo PNG se enseña en la vista previa y viaja dentro del correo
 * (ver `lib/correo/gmail.ts`, que los manda como partes con `Content-ID`).
 *
 * **AQUÍ NO SE PINTA NADA QUE NO ESTÉ MEDIDO** (16/09/2026).
 *
 * La primera versión comparaba «goles de balón parado» equipo por equipo, y
 * eso **nadie lo publica**: Wyscout da remates por vía y penaltis marcados, y
 * de goles sólo el total. Aquello era un reparto proporcional a los remates, y
 * con tres jornadas inventaba —0,81 goles de córner para el Zaragoza, 0,00 para
 * nosotros habiendo metido dos—. Ahora se pinta lo que las fuentes miden:
 *
 *   · de la **liga** (Wyscout): córners, faltas lanzadas, jugadas de ABP,
 *     cuántas acaban en remate, qué parte de todos los remates nace de
 *     estrategia y los penaltis;
 *   · de **nosotros** (nuestras cuatro hojas de ABP): acciones, remates,
 *     peligro, xG y **goles de verdad**, que ahí sí los registra el analista
 *     acción por acción.
 *
 * Se pinta a **dos veces el tamaño** y se enseña a la mitad: es lo que hace que
 * en un móvil o en una pantalla buena no se vean los bordes pastosos.
 *
 * Funciona igual en el navegador y en el arnés de Node: lo único que se pide
 * del entorno es `document.createElement("canvas")`, que el arnés sustituye por
 * `@napi-rs/canvas`. Nada de `window`, nada de medir con el DOM.
 */

/* ------------------------------------------------------------------ */
/*  LO QUE LLEGA                                                       */
/* ------------------------------------------------------------------ */

/** Una métrica de las que Wyscout mide de verdad. */
export type MedidaAbp = {
  key: string;
  rotulo: string;
  /** "alto" = cuanto más, mejor. "neutro" = ni bueno ni malo, es un rasgo. */
  sentido: "alto" | "neutro";
};

export type ValoresAbp = Record<
  string,
  { favor: number | null; contra: number | null }
>;

export type FilaEquipoAbp = {
  equipo: string;
  partidos: number;
  valores: ValoresAbp;
};

export type FilaTemporadaAbp = FilaEquipoAbp & {
  temporada: string;
  esActual: boolean;
};

/** Lo que devuelve `/api/data-analisis?abpInforme=1`. */
export type ComparativaAbp = {
  temporada: string;
  jugados: number;
  equipos: number;
  medidas: MedidaAbp[];
  liga: FilaEquipoAbp[];
  nosotros: FilaEquipoAbp | null;
  historico: FilaTemporadaAbp[];
};

/**
 * Nuestro balón parado tal y como lo registra el analista en las cuatro hojas.
 *
 * Esto **sí** trae goles: cada acción lleva su resultado escrito a mano. Lo
 * arma el diálogo con `lib/data-analisis/abp-propio.ts`.
 */
export type PropioAbp = {
  partidos: number;
  acciones: number;
  remates: number;
  goles: number;
  peligros: number;
  xg: number;
  cuotaRemate: number;
  cuotaPeligro: number;
  /** Lo mismo, partido por el lado del campo. */
  ofensivo: { acciones: number; remates: number; goles: number; peligros: number; xg: number };
  defensivo: { acciones: number; remates: number; goles: number; peligros: number; xg: number };
  porAspecto: { etiqueta: string; acciones: number; peligro: number; goles: number }[];
  /**
   * Lo mismo, pero partido por familia **y por lado**, sin pegar el lado al
   * texto de la etiqueta.
   *
   * `porAspecto` junta las dos cosas en una cadena («corner (en contra)»), que
   * vale para una lista pero no para poner el córner a favor al lado del
   * córner en contra: para eso hacen falta separados. Las familias son las de
   * la hoja —`corner`, `falta-lateral`, `banda`…—, sin traducir, que de eso se
   * encarga quien pinta.
   */
  porFamiliaYLado: {
    familia: string;
    lado: "ofensivo" | "defensivo";
    acciones: number;
    remates: number;
    goles: number;
    peligros: number;
    xg: number;
  }[];
  porJornada: { etiqueta: string; acciones: number; peligro: number; goles: number; nota: string }[];
  rematadores: { jugador: string; total: number; peligro: number }[];
  sacadores: { jugador: string; total: number; peligro: number }[];
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

  const escalon = valor <= 1 ? 0.25 : valor <= 3 ? 0.5 : valor <= 12 ? 1 : 5;

  return Math.ceil(valor / escalon) * escalon;
}

function fmt(valor: number, decimales = 2) {
  return valor.toFixed(decimales).replace(".", ",");
}

/** Cómo se escribe cada métrica: los porcentajes con un decimal y un %. */
function fmtMedida(valor: number | null, key: string) {
  if (valor === null || !Number.isFinite(valor)) return "—";

  return /Remate|remate|cuota/.test(key) || key.endsWith("Remate") || key === "cuotaRematesAbp"
    ? `${fmt(valor, 1)} %`
    : fmt(valor, key === "penaltis" ? 2 : 1);
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

  const palabras = limpio.split(/\s+/).filter((una) => una.length > 2);

  const larga = palabras.sort((a, b) => b.length - a.length)[0] ?? limpio;

  return larga.slice(0, 13);
}

const valorDe = (fila: FilaEquipoAbp, key: string, lado: "favor" | "contra") =>
  fila.valores?.[key]?.[lado] ?? null;

function mediana(valores: number[]) {
  if (valores.length === 0) return 0;

  const orden = [...valores].sort((a, b) => a - b);
  const medio = Math.floor(orden.length / 2);

  return orden.length % 2 ? orden[medio] : (orden[medio - 1] + orden[medio]) / 2;
}

/* ------------------------------------------------------------------ */
/*  1 · DISPERSIÓN DE LA CATEGORÍA                                     */
/* ------------------------------------------------------------------ */

/**
 * Cada equipo de la categoría en dos métricas medidas.
 *
 * Los empates exactos se agrupan en un anillo con **una sola etiqueta**: con
 * pocas jornadas media categoría comparte cifra y, uno encima de otro, no se
 * lee ni un nombre.
 */
export function dispersion(
  comparativa: ComparativaAbp,
  ejeX: { key: string; lado: "favor" | "contra"; rotulo: string },
  ejeY: { key: string; lado: "favor" | "contra"; rotulo: string; menosEsMejor?: boolean },
  titulo: string,
  pie: string,
  ancho = 760,
  alto = 420,
) {
  const { canvas, ctx } = lienzo(ancho, alto);

  const caja = marco(ctx, ancho, alto, titulo, pie);

  const x0 = 46;
  const x1 = ancho - 16;
  const y0 = caja.arriba + 26;
  const y1 = caja.abajo - 30;

  const filas = comparativa.liga.filter(
    (fila) =>
      valorDe(fila, ejeX.key, ejeX.lado) !== null &&
      valorDe(fila, ejeY.key, ejeY.lado) !== null,
  );

  if (filas.length === 0) {
    escribe(ctx, "Sin dato suficiente todavía.", 0, caja.arriba + 30, {
      px: 13,
      peso: 400,
      tinta: SUAVE,
    });

    return canvas.toDataURL("image/png");
  }

  const equis = filas.map((f) => valorDe(f, ejeX.key, ejeX.lado) as number);
  const yes = filas.map((f) => valorDe(f, ejeY.key, ejeY.lado) as number);

  const maxX = techo(Math.max(...equis));
  const maxY = techo(Math.max(...yes));

  const px = (valor: number) => x0 + (valor / maxX) * (x1 - x0);

  /* Si menos es mejor, el eje va al revés: arriba siempre es lo bueno. */
  const py = (valor: number) =>
    ejeY.menosEsMejor
      ? y0 + (valor / maxY) * (y1 - y0)
      : y1 - (valor / maxY) * (y1 - y0);

  ctx.strokeStyle = REJILLA;
  ctx.lineWidth = 1;

  for (let i = 0; i <= 4; i += 1) {
    const y = y0 + ((y1 - y0) * i) / 4;

    ctx.beginPath();
    ctx.moveTo(x0, y);
    ctx.lineTo(x1, y);
    ctx.stroke();

    const valor = ejeY.menosEsMejor
      ? (maxY * i) / 4
      : maxY - (maxY * i) / 4;

    escribe(ctx, fmt(valor, maxY >= 10 ? 0 : 1), x0 - 6, y + 4, {
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

    escribe(ctx, fmt((maxX * i) / 4, maxX >= 10 ? 0 : 1), x, y1 + 14, {
      px: 10,
      peso: 400,
      tinta: SUAVE,
      alinea: "center",
    });
  }

  escribe(ctx, `${ejeX.rotulo} →`, x1, y1 + 26, {
    px: 10,
    peso: 600,
    tinta: SUAVE,
    alinea: "right",
  });

  /* Girado en el margen: en la esquina se cruza con la etiqueta del equipo que
     ocupe el extremo, que es justo donde se quiere estar. */
  ctx.save();
  ctx.translate(13, (y0 + y1) / 2);
  ctx.rotate(-Math.PI / 2);

  escribe(ctx, `${ejeY.rotulo} →`, 0, 0, {
    px: 10,
    peso: 600,
    tinta: SUAVE,
    alinea: "center",
  });

  ctx.restore();

  /* Medianas: parten el cuadro en cuatro y evitan tener que hacer cuentas. */
  ctx.save();
  ctx.setLineDash([4, 4]);
  ctx.strokeStyle = "#C9C2B2";

  const medX = px(mediana(equis));
  const medY = py(mediana(yes));

  ctx.beginPath();
  ctx.moveTo(medX, y0);
  ctx.lineTo(medX, y1);
  ctx.stroke();

  ctx.beginPath();
  ctx.moveTo(x0, medY);
  ctx.lineTo(x1, medY);
  ctx.stroke();
  ctx.restore();

  const nuestro = comparativa.nosotros;

  /*
  | Se agrupa por CERCANÍA en el dibujo, no por valor idéntico.
  |
  | Con el valor exacto, «Alcorcón 5,00 / 5,33» e «Ibiza 5,00 / 5,50» caían a
  | seis píxeles uno de otro y sus nombres se pisaban igual: en la pantalla no
  | se distingue un empate de un casi-empate. Se juntan los que quedan a menos
  | de dieciocho píxeles, que es lo que ocupa una etiqueta.
  */
  const CERCA = 18;

  const puntos = filas.map((fila) => ({
    fila,
    x: px(valorDe(fila, ejeX.key, ejeX.lado) as number),
    y: py(valorDe(fila, ejeY.key, ejeY.lado) as number),
  }));

  const grupos: { cx: number; cy: number; lista: FilaEquipoAbp[] }[] = [];

  puntos.forEach((punto) => {
    const cerca = grupos.find(
      (grupo) =>
        Math.hypot(grupo.cx - punto.x, grupo.cy - punto.y) < CERCA,
    );

    if (cerca) {
      /* El centro del grupo es la media de los suyos, para no arrastrarlo. */
      const n = cerca.lista.length;

      cerca.cx = (cerca.cx * n + punto.x) / (n + 1);
      cerca.cy = (cerca.cy * n + punto.y) / (n + 1);
      cerca.lista.push(punto.fila);

      return;
    }

    grupos.push({ cx: punto.x, cy: punto.y, lista: [punto.fila] });
  });

  /*
  | Y aun agrupados, dos grupos vecinos pueden pisarse la ETIQUETA.
  |
  | «Sant Andreu» y «Villarreal B» caen a treinta y seis píxeles: los discos se
  | ven separados, pero los nombres van centrados sobre cada uno y se montan.
  | Cuando el de al lado está a menos del ancho de los dos rótulos juntos, uno
  | se escribe debajo del disco en vez de encima.
  */
  fuente(ctx, 10, 400);

  const anchoEtiqueta = (lista: FilaEquipoAbp[]) =>
    ctx.measureText(
      lista.length === 1 ? nombreCorto(lista[0].equipo) : `${lista.length} equipos`,
    ).width;

  const debajo = new Set<number>();

  grupos.forEach((grupo, indice) => {
    if (debajo.has(indice)) return;

    grupos.forEach((otro, otroIndice) => {
      if (otroIndice <= indice || debajo.has(otroIndice)) return;

      const separacion = Math.abs(grupo.cx - otro.cx);

      const juntos =
        (anchoEtiqueta(grupo.lista) + anchoEtiqueta(otro.lista)) / 2 + 6;

      if (separacion < juntos && Math.abs(grupo.cy - otro.cy) < 22) {
        debajo.add(otroIndice);
      }
    });
  });

  grupos.forEach(({ cx, cy, lista: delGrupo }, indice) => {

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
          : delGrupo.length === 2
            ? delGrupo.map((una) => nombreCorto(una.equipo)).join(" · ")
            : `${delGrupo.length} equipos`;

    escribe(
      ctx,
      etiqueta,
      cx,
      debajo.has(indice) ? cy + radio + 17 : cy - radio - 9,
      {
        px: conNosotros ? 12 : 10,
        peso: conNosotros ? 700 : 400,
        tinta: conNosotros ? NAVY : SUAVE,
        alinea: "center",
      },
    );
  });

  return canvas.toDataURL("image/png");
}

/* ------------------------------------------------------------------ */
/*  2 · RANKING DE UNA MÉTRICA                                         */
/* ------------------------------------------------------------------ */

/** La categoría entera en barras, de más a menos, con nosotros encendidos. */
export function ranking(
  comparativa: ComparativaAbp,
  medida: MedidaAbp,
  lado: "favor" | "contra",
  ancho = 760,
  alto = 300,
) {
  const { canvas, ctx } = lienzo(ancho, alto);

  const filas = comparativa.liga
    .filter((fila) => valorDe(fila, medida.key, lado) !== null)
    .sort(
      (a, b) =>
        (valorDe(b, medida.key, lado) as number) -
        (valorDe(a, medida.key, lado) as number),
    );

  const caja = marco(
    ctx,
    ancho,
    alto,
    lado === "favor"
      ? `${medida.rotulo} · a favor`
      : `${medida.rotulo} · en contra`,
    `Por partido · ${comparativa.temporada} · ${comparativa.jugados} jornada${comparativa.jugados === 1 ? "" : "s"} · fuente Wyscout`,
  );

  if (filas.length === 0) {
    escribe(ctx, "Sin dato todavía.", 0, caja.arriba + 24, {
      px: 13,
      peso: 400,
      tinta: SUAVE,
    });

    return canvas.toDataURL("image/png");
  }

  const x0 = 4;
  const x1 = ancho - 8;

  const disponible = caja.abajo - caja.arriba;

  const paso = Math.max(9, Math.min(16, disponible / filas.length));

  const anchoBarra = x1 - x0 - 160;

  const maximo = Math.max(
    0.01,
    ...filas.map((f) => valorDe(f, medida.key, lado) as number),
  );

  const nuestro = comparativa.nosotros;

  filas.forEach((fila, indice) => {
    const y = caja.arriba + indice * paso;

    if (y + paso > caja.abajo) return;

    const esNuestro = nuestro !== null && fila.equipo === nuestro.equipo;

    const valor = valorDe(fila, medida.key, lado) as number;

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

    escribe(ctx, fmtMedida(valor, medida.key), x0 + 136 + largo, y + paso - 3, {
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
 * El Castilla contra el Castilla con los mismos partidos jugados, en una
 * métrica medida: a favor en verde, en contra en naranja.
 */
export function temporadas(
  comparativa: ComparativaAbp,
  medida: MedidaAbp,
  ancho = 760,
  alto = 320,
) {
  const { canvas, ctx } = lienzo(ancho, alto);

  const filas = comparativa.historico;

  const caja = marco(
    ctx,
    ancho,
    alto,
    `${medida.rotulo}, temporada a temporada`,
    `En los ${comparativa.jugados} primeros partidos de cada temporada · verde a favor, naranja en contra · fuente Wyscout`,
  );

  if (filas.length === 0) {
    escribe(ctx, "Todavía no hay temporadas que comparar.", 0, caja.arriba + 30, {
      px: 13,
      peso: 400,
      tinta: SUAVE,
    });

    return canvas.toDataURL("image/png");
  }

  const x0 = 40;
  const x1 = ancho - 10;
  const y0 = caja.arriba + 12;
  const y1 = caja.abajo - 26;

  const todos = filas.flatMap((f) => [
    valorDe(f, medida.key, "favor") ?? 0,
    valorDe(f, medida.key, "contra") ?? 0,
  ]);

  const maximo = techo(Math.max(1, ...todos));

  const divisiones = 4;

  ctx.strokeStyle = REJILLA;

  for (let i = 0; i <= divisiones; i += 1) {
    const y = y1 - ((y1 - y0) * i) / divisiones;

    ctx.beginPath();
    ctx.moveTo(x0, y);
    ctx.lineTo(x1, y);
    ctx.stroke();

    escribe(ctx, fmt((maximo * i) / divisiones, maximo >= 10 ? 0 : 1), x0 - 6, y + 4, {
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

    const favor = valorDe(fila, medida.key, "favor") ?? 0;
    const contra = valorDe(fila, medida.key, "contra") ?? 0;

    const alturaFavor = ((y1 - y0) * favor) / maximo;
    const alturaContra = ((y1 - y0) * contra) / maximo;

    ctx.fillStyle = BIEN;
    ctx.fillRect(centro - anchoBarra - 2, y1 - alturaFavor, anchoBarra, alturaFavor);

    ctx.fillStyle = MAL;
    ctx.fillRect(centro + 2, y1 - alturaContra, anchoBarra, alturaContra);

    escribe(ctx, fmt(favor, 1), centro - anchoBarra / 2 - 2, y1 - alturaFavor - 4, {
      px: 11,
      peso: 700,
      tinta: BIEN,
      alinea: "center",
    });

    escribe(ctx, fmt(contra, 1), centro + anchoBarra / 2 + 2, y1 - alturaContra - 4, {
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
/*  4 · LO NUESTRO, DE NUESTRAS HOJAS                                  */
/* ------------------------------------------------------------------ */

/** Barras horizontales simples: rótulo, barra y cifra. */
function barras(
  ctx: Pincel,
  caja: { arriba: number; abajo: number },
  ancho: number,
  filas: { rotulo: string; valor: number; extra?: string; destaca?: boolean }[],
  color: string,
) {
  if (filas.length === 0) return;

  const x0 = 4;

  /*
  | El hueco de la derecha lo manda el texto más largo, no una cifra fija.
  |
  | Con 230 px clavados, «186 · 4,3 % peligro» y «47 · 3 con peligro» se salían
  | del lienzo y se leían cortados. Se mide lo que de verdad se va a escribir.
  */
  fuente(ctx, 11, 600);

  const masLargo = filas.reduce((tope, fila) => {
    const texto = `${fmt(fila.valor, Number.isInteger(fila.valor) ? 0 : 1)}${fila.extra ? ` · ${fila.extra}` : ""}`;

    return Math.max(tope, ctx.measureText(texto).width);
  }, 0);

  const anchoBarra = Math.max(80, ancho - 178 - masLargo);

  const paso = Math.max(
    12,
    Math.min(24, (caja.abajo - caja.arriba) / filas.length),
  );

  const maximo = Math.max(0.01, ...filas.map((una) => una.valor));

  filas.forEach((fila, indice) => {
    const y = caja.arriba + indice * paso;

    if (y + paso > caja.abajo) return;

    escribe(ctx, fila.rotulo, x0, y + paso - 5, {
      px: 12,
      peso: fila.destaca ? 700 : 400,
      tinta: fila.destaca ? NAVY : TINTA,
    });

    const largo = (fila.valor / maximo) * anchoBarra;

    ctx.fillStyle = color;
    ctx.fillRect(x0 + 160, y + 3, Math.max(1, largo), paso - 9);

    escribe(
      ctx,
      `${fmt(fila.valor, Number.isInteger(fila.valor) ? 0 : 1)}${fila.extra ? ` · ${fila.extra}` : ""}`,
      x0 + 166 + largo,
      y + paso - 5,
      { px: 11, peso: 600, tinta: SUAVE },
    );
  });
}

/*
| Cómo se llama cada familia de acción en cristiano.
|
| La hoja las escribe en clave —«corner», «falta-lateral», «banda»— y eso es lo
| que llegaba al informe: un documento que se manda al cuerpo técnico no puede
| salir con los nombres internos de una columna.
*/
const FAMILIA_LABEL: Record<string, string> = {
  corner: "Córner",
  "falta-lateral": "Falta lateral",
  "falta-directa": "Falta directa",
  banda: "Saque de banda",
  penalti: "Penalti",
  "saque-medio": "Saque de medio",
  "saque-puerta": "Saque de puerta",
  otras: "Otras",
};

/** «corner (en contra)» → «Córner (en contra)». */
export function etiquetaFamilia(bruta: string) {
  const enContra = /\(en contra\)/i.test(bruta);

  const raiz = bruta.replace(/\s*\(en contra\)\s*/i, "").trim();

  const nombre =
    FAMILIA_LABEL[raiz] ??
    raiz.charAt(0).toUpperCase() + raiz.slice(1).replace(/-/g, " ");

  return enContra ? `${nombre} (en contra)` : nombre;
}

/* ------------------------------------------------------------------ */
/*  EL TIEMPO DE LA SEMANA                                             */
/* ------------------------------------------------------------------ */

/** Lo que el informe sabe del tiempo dedicado, ya calculado. */
export type TiempoSemana = {
  minutos: number;
  minimo: number;
  maximo: number;
  diasEntreno: number;
  /**
   * Si esos días son un dato o una lectura.
   *
   * `sin marcar` significa que en el plan no hay ningún descanso ni partido
   * puesto —todo día nace «entreno»—, así que lo que se cuenta son los días con
   * trabajo. El gráfico no puede afirmar «se entrenó cuatro días» en ese caso:
   * diría como dato algo que nadie ha declarado.
   */
  origenDias?: "a mano" | "marcados" | "sin marcar";
  veredicto: "corto" | "dentro" | "pasado";
  /** Minutos por día de la semana, en orden. */
  porDia: { etiqueta: string; minutos: number; esEntreno: boolean }[];
  /** Reparto por aspecto y lado. */
  porAspecto: { etiqueta: string; ofensivo: number; defensivo: number }[];
  porMedio: { campo: number; video: number };
  porMomento: { pre: number; intra: number; post: number };
  porRol: { sacadores: number; fijadores: number; rematadores: number };
};

/**
 * El termómetro de la semana: cuánto se ha trabajado contra lo que tocaba.
 *
 * La franja verde es el objetivo **prorrateado por los días que se entrena**:
 * 90-100 minutos en una semana de seis, y su parte en las de menos. Sin
 * prorratear, una semana de cuatro sesiones salía siempre corta aunque se
 * hubiera hecho exactamente lo previsto.
 */
export function termometroTiempo(tiempo: TiempoSemana, ancho = 760, alto = 200) {
  const { canvas, ctx } = lienzo(ancho, alto);

  const caja = marco(
    ctx,
    ancho,
    alto,
    "Minutos de balón parado de la semana",
    `Objetivo del cuerpo técnico: 90-100 minutos en una semana de seis entrenamientos. Con ${tiempo.diasEntreno} día${tiempo.diasEntreno === 1 ? "" : "s"}${tiempo.origenDias === "sin marcar" ? " con trabajo" : ""}, la parte que toca son ${tiempo.minimo}-${tiempo.maximo}.`,
  );

  const x0 = 4;
  const x1 = ancho - 8;

  const tope = Math.max(tiempo.maximo * 1.25, tiempo.minutos * 1.1, 30);

  const px = (valor: number) => x0 + (valor / tope) * (x1 - x0);

  const y = caja.arriba + 26;
  const altoBarra = 26;

  /* La franja del objetivo, de fondo. */
  ctx.fillStyle = "rgba(27,158,119,0.16)";
  ctx.fillRect(px(tiempo.minimo), y - 8, px(tiempo.maximo) - px(tiempo.minimo), altoBarra + 16);

  ctx.fillStyle = "rgba(15,30,61,0.08)";
  ctx.fillRect(x0, y, x1 - x0, altoBarra);

  /*
  | El naranja se reserva para quedarse corto DE VERDAD.
  |
  | Con «falta un minuto» pintaba la semana en rojo, y eso es leer mal un
  | trabajo que está en su sitio. Por debajo de un 10 % del mínimo es ámbar —al
  | borde—, y sólo por debajo de eso, naranja.
  */
  const distancia = tiempo.minimo > 0 ? (tiempo.minimo - tiempo.minutos) / tiempo.minimo : 0;

  const alBorde = tiempo.veredicto === "corto" && distancia <= 0.1;

  const color =
    tiempo.veredicto === "dentro"
      ? BIEN
      : tiempo.veredicto === "corto"
        ? alBorde
          ? ORO
          : MAL
        : ORO;

  ctx.fillStyle = color;
  ctx.fillRect(x0, y, Math.max(2, px(tiempo.minutos) - x0), altoBarra);

  /*
  | La cifra, siempre sobre papel y nunca encima de la franja del objetivo.
  |
  | Con 89′ de 90-100 caía justo dentro del verde claro y se leía fatal: si el
  | hueco que queda a la derecha de la franja es corto, se escribe a la
  | izquierda del final de la barra, en blanco sobre el color.
  */
  const finBarra = px(tiempo.minutos);
  const finFranja = px(tiempo.maximo);

  const chocaConLaFranja = finBarra + 46 > px(tiempo.minimo) && finBarra < finFranja + 8;

  escribe(
    ctx,
    `${Math.round(tiempo.minutos)}′`,
    chocaConLaFranja ? finBarra - 8 : finBarra + 8,
    y + 19,
    {
      px: 17,
      peso: 700,
      tinta: chocaConLaFranja ? PAPEL : color,
      alinea: chocaConLaFranja ? "right" : "left",
    },
  );

  /* Las marcas del objetivo. */
  [tiempo.minimo, tiempo.maximo].forEach((marca) => {
    ctx.strokeStyle = BIEN;
    ctx.lineWidth = 2;

    ctx.beginPath();
    ctx.moveTo(px(marca), y - 10);
    ctx.lineTo(px(marca), y + altoBarra + 10);
    ctx.stroke();

    escribe(ctx, `${marca}′`, px(marca), y + altoBarra + 24, {
      px: 11,
      peso: 600,
      tinta: BIEN,
      alinea: "center",
    });
  });

  const faltan = Math.max(0, tiempo.minimo - Math.round(tiempo.minutos));

  const dice =
    tiempo.veredicto === "dentro"
      ? "Dentro del objetivo de la semana."
      : tiempo.veredicto === "corto"
        ? alBorde
          ? `A ${faltan}′ del objetivo: prácticamente en su sitio.`
          : `Faltan ${faltan}′ para llegar al mínimo.`
        : `${Math.round(tiempo.minutos) - tiempo.maximo}′ por encima del objetivo.`;

  escribe(ctx, dice, x0, y + altoBarra + 52, { px: 13, peso: 600, tinta: NAVY });

  return canvas.toDataURL("image/png");
}

/** Cómo se reparte la semana: por día, y dentro del día por momento y medio. */
export function repartoSemana(tiempo: TiempoSemana, ancho = 760, alto = 300) {
  const { canvas, ctx } = lienzo(ancho, alto);

  const caja = marco(
    ctx,
    ancho,
    alto,
    "Cómo se reparte la semana",
    "Minutos de ABP por día. Los días de descanso o partido van en gris claro.",
  );

  const filas = tiempo.porDia;

  if (filas.length === 0) return canvas.toDataURL("image/png");

  const x0 = 34;
  const x1 = ancho - 10;
  const y0 = caja.arriba + 14;
  const y1 = caja.abajo - 46;

  const maximo = techo(Math.max(5, ...filas.map((una) => una.minutos)));

  ctx.strokeStyle = REJILLA;

  for (let i = 0; i <= 4; i += 1) {
    const y = y1 - ((y1 - y0) * i) / 4;

    ctx.beginPath();
    ctx.moveTo(x0, y);
    ctx.lineTo(x1, y);
    ctx.stroke();

    escribe(ctx, `${Math.round((maximo * i) / 4)}′`, x0 - 6, y + 4, {
      px: 10,
      peso: 400,
      tinta: SUAVE,
      alinea: "right",
    });
  }

  const paso = (x1 - x0) / filas.length;
  const anchoBarra = Math.min(46, paso * 0.6);

  filas.forEach((fila, indice) => {
    const centro = x0 + paso * (indice + 0.5);
    const altura = ((y1 - y0) * fila.minutos) / maximo;

    ctx.fillStyle = fila.esEntreno ? "rgba(15,30,61,0.30)" : "rgba(15,30,61,0.08)";
    ctx.fillRect(centro - anchoBarra / 2, y1 - altura, anchoBarra, Math.max(0, altura));

    if (fila.minutos > 0) {
      escribe(ctx, `${Math.round(fila.minutos)}′`, centro, y1 - altura - 5, {
        px: 12,
        peso: 700,
        tinta: NAVY,
        alinea: "center",
      });
    }

    escribe(ctx, fila.etiqueta, centro, y1 + 16, {
      px: 11,
      peso: fila.esEntreno ? 600 : 400,
      tinta: fila.esEntreno ? TINTA : SUAVE,
      alinea: "center",
    });
  });

  /* Pie con los tres repartos que caben en una línea. */
  const pie = [
    `Campo ${Math.round(tiempo.porMedio.campo)}′ · vídeo ${Math.round(tiempo.porMedio.video)}′`,
    `Pre ${Math.round(tiempo.porMomento.pre)}′ · intra ${Math.round(tiempo.porMomento.intra)}′ · post ${Math.round(tiempo.porMomento.post)}′`,
    `Sacadores ${Math.round(tiempo.porRol.sacadores)}′ · fijadores ${Math.round(tiempo.porRol.fijadores)}′ · rematadores ${Math.round(tiempo.porRol.rematadores)}′`,
  ];

  pie.forEach((linea, indice) => {
    escribe(ctx, linea, 4, caja.abajo - 20 + indice * 13, {
      px: 11,
      peso: 400,
      tinta: SUAVE,
    });
  });

  return canvas.toDataURL("image/png");
}

/** Qué aspecto se trabaja y con qué lado: barras enfrentadas. */
export function repartoPorAspecto(tiempo: TiempoSemana, ancho = 760, alto = 300) {
  const { canvas, ctx } = lienzo(ancho, alto);

  const caja = marco(
    ctx,
    ancho,
    alto,
    "Qué se ha trabajado esta semana",
    "Minutos por aspecto. Verde lo ofensivo, naranja lo defensivo. Una tarea que trabaja dos aspectos reparte sus minutos entre ellos.",
  );

  const filas = tiempo.porAspecto.filter(
    (una) => una.ofensivo + una.defensivo > 0,
  );

  if (filas.length === 0) {
    escribe(ctx, "Sin trabajo de ABP planificado esta semana.", 4, caja.arriba + 24, {
      px: 13,
      peso: 400,
      tinta: SUAVE,
    });

    return canvas.toDataURL("image/png");
  }

  const x0 = 4;

  const paso = Math.max(14, Math.min(26, (caja.abajo - caja.arriba) / filas.length));

  const maximo = Math.max(
    1,
    ...filas.map((una) => una.ofensivo + una.defensivo),
  );

  /* El hueco de la derecha lo manda el texto más largo: «30′ (28′ / 2′)» no
     cabía en el fijo de antes y se leía cortado. */
  fuente(ctx, 11, 600);

  const masLargo = filas.reduce((tope, fila) => {
    const total = fila.ofensivo + fila.defensivo;

    const texto = `${Math.round(total)}′${fila.defensivo > 0 && fila.ofensivo > 0 ? ` (${Math.round(fila.ofensivo)}′ / ${Math.round(fila.defensivo)}′)` : ""}`;

    return Math.max(tope, ctx.measureText(texto).width);
  }, 0);

  const anchoBarra = Math.max(90, ancho - 190 - masLargo);

  filas.forEach((fila, indice) => {
    const y = caja.arriba + indice * paso;

    if (y + paso > caja.abajo) return;

    escribe(ctx, fila.etiqueta, x0, y + paso - 6, { px: 12, peso: 400, tinta: TINTA });

    const largoOf = (fila.ofensivo / maximo) * anchoBarra;
    const largoDef = (fila.defensivo / maximo) * anchoBarra;

    ctx.fillStyle = BIEN;
    ctx.fillRect(x0 + 170, y + 3, Math.max(0, largoOf), paso - 10);

    ctx.fillStyle = MAL;
    ctx.fillRect(x0 + 170 + largoOf, y + 3, Math.max(0, largoDef), paso - 10);

    const total = fila.ofensivo + fila.defensivo;

    escribe(
      ctx,
      `${Math.round(total)}′${fila.defensivo > 0 && fila.ofensivo > 0 ? ` (${Math.round(fila.ofensivo)}′ / ${Math.round(fila.defensivo)}′)` : ""}`,
      x0 + 176 + largoOf + largoDef,
      y + paso - 6,
      { px: 11, peso: 600, tinta: SUAVE },
    );
  });

  return canvas.toDataURL("image/png");
}

/* ------------------------------------------------------------------ */
/*  CONTENIDOS Y VALORACIÓN                                            */
/* ------------------------------------------------------------------ */

export type TareaValorada = {
  /** El nombre que le da la hoja, que suele ser un código («M-T4»). */
  tarea: string;
  /** Lo que se trabajó, que es lo que se reconoce de un vistazo. */
  contenido?: string;
  dia: string;
  nota: number;
  minutos: number;
};

/** Las tareas de la semana con su nota, de la hoja de registro. */
export function valoracionTareas(
  tareas: TareaValorada[],
  media: number | null,
  ancho = 760,
  alto = 300,
) {
  const { canvas, ctx } = lienzo(ancho, alto);

  const caja = marco(
    ctx,
    ancho,
    alto,
    "Cómo salieron las tareas",
    media === null
      ? "Nota de cada tarea de ABP en la hoja de registro."
      : `Nota de cada tarea de ABP · media de la semana ${media.toFixed(1)} · la línea dorada es esa media.`,
  );

  if (tareas.length === 0) {
    escribe(ctx, "Ninguna tarea de ABP valorada esta semana.", 4, caja.arriba + 24, {
      px: 13,
      peso: 400,
      tinta: SUAVE,
    });

    return canvas.toDataURL("image/png");
  }

  const x0 = 4;
  const anchoBarra = ancho - 300;

  const paso = Math.max(16, Math.min(30, (caja.abajo - caja.arriba) / tareas.length));

  tareas.forEach((tarea, indice) => {
    const y = caja.arriba + indice * paso;

    if (y + paso > caja.abajo) return;

    /* El nombre de la tarea en la hoja es un código —«M-T4»—, así que si hay
       contenido escrito manda el contenido, que es lo que se reconoce. */
    const nombre = (tarea.contenido || tarea.tarea).trim();

    /* 26 y no 30: con el día delante, un contenido largo llegaba a tocar la
       barra y las dos cosas se leían como una sola. */
    const corto = nombre.length > 26 ? `${nombre.slice(0, 25)}…` : nombre;

    escribe(ctx, `${tarea.dia} · ${corto}`, x0, y + paso - 7, {
      px: 12,
      peso: 400,
      tinta: TINTA,
    });

    const largo = (Math.max(0, Math.min(10, tarea.nota)) / 10) * anchoBarra;

    /* Verde por encima de 7, naranja por debajo de 5: el color es la lectura. */
    ctx.fillStyle = tarea.nota >= 7 ? BIEN : tarea.nota < 5 ? MAL : "rgba(200,169,107,0.85)";
    ctx.fillRect(x0 + 200, y + 3, Math.max(2, largo), paso - 12);

    escribe(ctx, tarea.nota.toFixed(1), x0 + 206 + largo, y + paso - 7, {
      px: 12,
      peso: 700,
      tinta: NAVY,
    });

    escribe(ctx, `${Math.round(tarea.minutos)}′`, ancho - 16, y + paso - 7, {
      px: 11,
      peso: 400,
      tinta: SUAVE,
      alinea: "right",
    });
  });

  if (media !== null) {
    const x = x0 + 200 + (Math.max(0, Math.min(10, media)) / 10) * anchoBarra;

    ctx.strokeStyle = ORO;
    ctx.lineWidth = 2;
    ctx.setLineDash([4, 3]);

    ctx.beginPath();
    ctx.moveTo(x, caja.arriba);
    ctx.lineTo(x, caja.abajo);
    ctx.stroke();

    ctx.setLineDash([]);
  }

  return canvas.toDataURL("image/png");
}

/* ------------------------------------------------------------------ */
/*  SEGUIMIENTO INDIVIDUAL                                             */
/* ------------------------------------------------------------------ */

export type SeguimientoResumen = {
  porJugador: { jugador: string; registros: number }[];
  porQuien: { quien: string; registros: number }[];
  total: number;
  jugadores: number;
};

/** Quién ha recibido seguimiento de ABP y quién se lo ha hecho. */
export function seguimientoAbp(
  resumen: SeguimientoResumen,
  ancho = 760,
  alto = 320,
) {
  const { canvas, ctx } = lienzo(ancho, alto);

  const caja = marco(
    ctx,
    ancho,
    alto,
    "Seguimiento individual de balón parado",
    `${resumen.total} registros · ${resumen.jugadores} jugadores · reconocido por lo que está escrito en los objetivos y el feedback, así que es una lectura, no una casilla.`,
  );

  if (resumen.porJugador.length === 0) {
    escribe(ctx, "Sin seguimientos de ABP en estas fechas.", 4, caja.arriba + 24, {
      px: 13,
      peso: 400,
      tinta: SUAVE,
    });

    return canvas.toDataURL("image/png");
  }

  const mitad = (caja.abajo - caja.arriba) / 2;

  escribe(ctx, "JUGADORES", 4, caja.arriba + 10, { px: 11, peso: 700, tinta: NAVY });

  barras(
    ctx,
    { arriba: caja.arriba + 16, abajo: caja.arriba + mitad - 6 },
    ancho,
    resumen.porJugador.slice(0, 6).map((una) => ({
      rotulo: una.jugador,
      valor: una.registros,
      extra: "registros",
    })),
    "rgba(27,158,119,0.55)",
  );

  escribe(ctx, "QUIÉN LO HACE", 4, caja.arriba + mitad + 10, {
    px: 11,
    peso: 700,
    tinta: NAVY,
  });

  barras(
    ctx,
    { arriba: caja.arriba + mitad + 16, abajo: caja.abajo },
    ancho,
    resumen.porQuien.slice(0, 5).map((una) => ({
      rotulo: una.quien || "sin anotar",
      valor: una.registros,
      extra: "registros",
    })),
    "rgba(200,169,107,0.75)",
  );

  return canvas.toDataURL("image/png");
}

/** Qué se trabaja y qué renta, aspecto por aspecto, de nuestras hojas. */
/* ------------------------------------------------------------------ */
/*  NUESTRO PARTIDO: LAS DOS VÍAS                                      */
/* ------------------------------------------------------------------ */

/**
 * Una familia de balón parado, a favor contra en contra, según **Wyscout**.
 *
 * Dos barras por métrica: lo que hacemos y lo que nos hacen. Es el espejo más
 * directo que hay del balón parado, porque las dos cifras salen del mismo
 * informe del mismo partido.
 *
 * **Wyscout no separa la falta lateral del resto de faltas ni cuenta el saque
 * de banda**, así que por esta vía sólo se puede pintar el córner y la falta
 * lanzada entera. El desglose fino vive en nuestro registro, donde el analista
 * sí lo escribe.
 */
export function wyscoutPorFamilia(
  comparativa: ComparativaAbp,
  claves: { cantidad: string; remate: string },
  titulo: string,
  ancho = 760,
  alto = 200,
) {
  const { canvas, ctx } = lienzo(ancho, alto);

  const nuestros = comparativa.nosotros?.valores ?? {};

  const cantidad = nuestros[claves.cantidad] ?? { favor: null, contra: null };
  const remate = nuestros[claves.remate] ?? { favor: null, contra: null };

  const caja = marco(
    ctx,
    ancho,
    alto,
    titulo,
    `Lo que Wyscout mide en nuestros ${comparativa.jugados} partido${
      comparativa.jugados === 1 ? "" : "s"
    }, por partido: a favor y en contra.`,
  );

  const filas = [
    {
      rotulo: "A favor",
      valor: cantidad.favor ?? 0,
      extra: remate.favor === null ? undefined : `${fmt(remate.favor, 0)} % con remate`,
      destaca: true,
    },
    {
      rotulo: "En contra",
      valor: cantidad.contra ?? 0,
      extra: remate.contra === null ? undefined : `${fmt(remate.contra, 0)} % con remate`,
    },
  ];

  barras(ctx, caja, ancho, filas, NAVY);

  return canvas.toDataURL("image/png");
}

/**
 * Una familia de balón parado según **nuestro registro**, a favor y en contra.
 *
 * Aquí el dato es más rico que en Wyscout —lleva goles, porque el analista
 * escribe el resultado de cada acción— y llega a donde Wyscout no llega: la
 * falta lateral separada de la directa y el saque de banda, que ninguna
 * plataforma cuenta.
 */
export function nuestroPorFamilia(
  propio: PropioAbp,
  familia: string,
  titulo: string,
  ancho = 760,
  alto = 200,
) {
  const { canvas, ctx } = lienzo(ancho, alto);

  const suyas = (propio.porFamiliaYLado ?? []).filter(
    (una) => una.familia === familia,
  );

  const lado = (cual: "ofensivo" | "defensivo") =>
    suyas.find((una) => una.lado === cual);

  const caja = marco(
    ctx,
    ancho,
    alto,
    titulo,
    `Lo que registra el cuerpo técnico en ${propio.partidos} partido${
      propio.partidos === 1 ? "" : "s"
    }: acciones, cuántas acaban en peligro y los goles.`,
  );

  const fila = (cual: "ofensivo" | "defensivo", rotulo: string) => {
    const datos = lado(cual);

    const acciones = datos?.acciones ?? 0;
    const peligros = datos?.peligros ?? 0;
    const goles = datos?.goles ?? 0;

    const trozos: string[] = [];

    if (acciones > 0) {
      trozos.push(`${Math.round((peligros / acciones) * 100)} % peligro`);
    }

    if (goles > 0) trozos.push(`${goles} gol${goles === 1 ? "" : "es"}`);

    return {
      rotulo,
      valor: acciones,
      extra: trozos.length ? trozos.join(" · ") : undefined,
      destaca: cual === "ofensivo",
    };
  };

  barras(
    ctx,
    caja,
    ancho,
    [fila("ofensivo", "A favor"), fila("defensivo", "En contra")],
    ORO,
  );

  return canvas.toDataURL("image/png");
}

export function nuestroPorAspecto(propio: PropioAbp, ancho = 760, alto = 320) {
  const { canvas, ctx } = lienzo(ancho, alto);

  const caja = marco(
    ctx,
    ancho,
    alto,
    "Nuestro balón parado, acción por acción",
    `${propio.acciones} acciones registradas en ${propio.partidos} partidos · nuestras hojas de ABP · la cifra de la derecha es el % que acaba en peligro`,
  );

  barras(
    ctx,
    caja,
    ancho,
    propio.porAspecto.slice(0, 10).map((una) => ({
      rotulo: etiquetaFamilia(una.etiqueta),
      valor: una.acciones,
      extra: `${fmt(una.peligro, 1)} % peligro${una.goles ? ` · ${una.goles} gol${una.goles === 1 ? "" : "es"}` : ""}`,
    })),
    "rgba(15,30,61,0.28)",
  );

  return canvas.toDataURL("image/png");
}

/** Cómo va por jornadas: volumen de acciones y qué parte acaba en peligro. */
export function nuestraEvolucion(propio: PropioAbp, ancho = 760, alto = 320) {
  const { canvas, ctx } = lienzo(ancho, alto);

  const caja = marco(
    ctx,
    ancho,
    alto,
    "Jornada a jornada",
    "Barras: acciones de ABP registradas. Línea: qué parte acaba en gol u ocasión. Nuestras hojas de ABP.",
  );

  const filas = propio.porJornada;

  if (filas.length === 0) {
    escribe(ctx, "Sin jornadas registradas todavía.", 0, caja.arriba + 30, {
      px: 13,
      peso: 400,
      tinta: SUAVE,
    });

    return canvas.toDataURL("image/png");
  }

  const x0 = 38;
  const x1 = ancho - 40;
  const y0 = caja.arriba + 14;
  const y1 = caja.abajo - 26;

  const maximo = techo(Math.max(1, ...filas.map((f) => f.acciones)));

  ctx.strokeStyle = REJILLA;

  for (let i = 0; i <= 4; i += 1) {
    const y = y1 - ((y1 - y0) * i) / 4;

    ctx.beginPath();
    ctx.moveTo(x0, y);
    ctx.lineTo(x1, y);
    ctx.stroke();

    escribe(ctx, fmt((maximo * i) / 4, 0), x0 - 6, y + 4, {
      px: 10,
      peso: 400,
      tinta: SUAVE,
      alinea: "right",
    });

    escribe(ctx, `${Math.round((100 * i) / 4)} %`, x1 + 6, y + 4, {
      px: 10,
      peso: 400,
      tinta: ORO,
    });
  }

  const paso = (x1 - x0) / filas.length;

  const anchoBarra = Math.min(34, paso * 0.55);

  filas.forEach((fila, indice) => {
    const centro = x0 + paso * (indice + 0.5);

    const altura = ((y1 - y0) * fila.acciones) / maximo;

    ctx.fillStyle = "rgba(15,30,61,0.28)";
    ctx.fillRect(centro - anchoBarra / 2, y1 - altura, anchoBarra, altura);

    escribe(ctx, String(fila.acciones), centro, y1 - altura - 5, {
      px: 11,
      peso: 700,
      tinta: NAVY,
      alinea: "center",
    });

    escribe(ctx, fila.etiqueta, centro, y1 + 16, {
      px: 10,
      peso: 400,
      tinta: TINTA,
      alinea: "center",
    });
  });

  /* La línea del peligro, sobre el mismo cuadro pero con su escala de 0 a 100. */
  ctx.strokeStyle = ORO;
  ctx.lineWidth = 2;
  ctx.beginPath();

  filas.forEach((fila, indice) => {
    const centro = x0 + paso * (indice + 0.5);
    const y = y1 - ((y1 - y0) * Math.min(100, fila.peligro)) / 100;

    if (indice === 0) ctx.moveTo(centro, y);
    else ctx.lineTo(centro, y);
  });

  ctx.stroke();

  filas.forEach((fila, indice) => {
    const centro = x0 + paso * (indice + 0.5);
    const y = y1 - ((y1 - y0) * Math.min(100, fila.peligro)) / 100;

    ctx.beginPath();
    ctx.arc(centro, y, 3.5, 0, Math.PI * 2);
    ctx.fillStyle = ORO;
    ctx.fill();
  });

  return canvas.toDataURL("image/png");
}

/** Quién remata y quién saca: los dos nombres que la hoja sí guarda. */
export function nuestrosNombres(propio: PropioAbp, ancho = 760, alto = 320) {
  const { canvas, ctx } = lienzo(ancho, alto);

  const caja = marco(
    ctx,
    ancho,
    alto,
    "Quién remata y quién saca",
    "Acciones en las que aparece cada uno · la cifra de la derecha es cuántas acabaron en gol u ocasión · nuestras hojas de ABP",
  );

  const mitad = (caja.abajo - caja.arriba) / 2;

  escribe(ctx, "REMATADORES", 4, caja.arriba + 10, { px: 11, peso: 700, tinta: NAVY });

  barras(
    ctx,
    { arriba: caja.arriba + 16, abajo: caja.arriba + mitad - 4 },
    ancho,
    propio.rematadores.slice(0, 5).map((una) => ({
      rotulo: una.jugador,
      valor: una.total,
      extra: `${una.peligro} con peligro`,
    })),
    "rgba(27,158,119,0.55)",
  );

  escribe(ctx, "SACADORES", 4, caja.arriba + mitad + 12, {
    px: 11,
    peso: 700,
    tinta: NAVY,
  });

  barras(
    ctx,
    { arriba: caja.arriba + mitad + 18, abajo: caja.abajo },
    ancho,
    propio.sacadores.slice(0, 5).map((una) => ({
      rotulo: una.jugador,
      valor: una.total,
      extra: `${una.peligro} con peligro`,
    })),
    "rgba(200,169,107,0.75)",
  );

  return canvas.toDataURL("image/png");
}

/* ------------------------------------------------------------------ */
/*  LOS GRÁFICOS DEL INFORME                                           */
/* ------------------------------------------------------------------ */

/**
 * En qué parte del informe va cada gráfico.
 *
 * El orden lo pidió el cuerpo técnico y es el orden en que se lee la semana:
 * primero lo que hay que mirar sí o sí, después cuánto se ha trabajado, luego
 * el espejo de la categoría, lo nuestro del partido, lo que se hizo en el campo
 * y, al final, el trabajo individual.
 */
export type AreaGrafico =
  | "destacados"
  | "tiempo"
  /**
   * Nuestro partido, por las dos vías: lo que mide Wyscout y lo que registra
   * el cuerpo técnico. Va justo detrás del microciclo, porque es la pregunta
   * que sigue a «qué hemos entrenado»: qué ha salido de eso en el campo.
   */
  | "partido"
  | "wyscout"
  | "nuestro"
  | "contenidos"
  | "seguimiento";

export type GraficoInforme = {
  /** El identificador con el que el correo lo llama: `src="cid:…"`. */
  cid: string;
  titulo: string;
  area: AreaGrafico;
  /**
   * Cómo se lee, en una línea.
   *
   * Va debajo de cada imagen y no es un adorno: un gráfico que hay que
   * explicar de viva voz no sirve en un correo que se lee en el móvil.
   */
  leyenda: string;
  /** `data:image/png;base64,…` */
  imagen: string;
  ancho: number;
};

const MEDIDA_POR_DEFECTO: MedidaAbp = {
  key: "corners",
  rotulo: "Córners",
  sentido: "alto",
};

function medidaDe(comparativa: ComparativaAbp, key: string) {
  return (
    comparativa.medidas?.find((una) => una.key === key) ?? {
      ...MEDIDA_POR_DEFECTO,
      key,
      rotulo: key,
    }
  );
}

/** Lo que hace falta para dibujar todo el informe. */
export type DatosGraficos = {
  comparativa: ComparativaAbp | null;
  propio: PropioAbp | null;
  tiempo: TiempoSemana | null;
  tareasValoradas: TareaValorada[];
  seguimiento: SeguimientoResumen | null;
  mediaValoracion: number | null;
};

/**
 * Los gráficos del informe, por áreas y en el orden en que se leen.
 *
 * El orden lo pidió el cuerpo técnico: **primero los cuatro que hay que mirar
 * sí o sí**, después cuánto se ha trabajado y cómo se ha repartido, luego el
 * espejo de la categoría, lo nuestro del partido, lo que se hizo en el campo y,
 * al final, el trabajo individual.
 *
 * Lo que no tenga dato no se dibuja: un gráfico vacío ocupa lo mismo que uno
 * lleno y no dice nada.
 */
export function graficosDelInforme(datos: DatosGraficos): GraficoInforme[] {
  const { comparativa, propio, tiempo, tareasValoradas, seguimiento } = datos;

  const graficos: GraficoInforme[] = [];

  const mete = (
    cid: string,
    titulo: string,
    area: AreaGrafico,
    leyenda: string,
    imagen: string,
  ) => {
    graficos.push({ cid, titulo, area, leyenda, imagen, ancho: 760 });
  };

  const hayLiga = Boolean(comparativa && comparativa.liga.length > 0);

  /* ================= 1 · LOS CUATRO DE CABECERA ================= */

  if (tiempo) {
    mete(
      "d-tiempo",
      "¿Hemos dedicado el tiempo que tocaba?",
      "destacados",
      tiempo.origenDias === "sin marcar"
        ? `La barra son los minutos de ABP de la semana; la franja verde, el objetivo prorrateado por los ${tiempo.diasEntreno} día${tiempo.diasEntreno === 1 ? "" : "s"} en los que consta trabajo. En el plan no hay descansos marcados, así que ése es el número que se puede leer, no el de días entrenados.`
        : `La barra son los minutos de ABP de la semana; la franja verde, el objetivo prorrateado por los ${tiempo.diasEntreno} día${tiempo.diasEntreno === 1 ? "" : "s"} que se ha entrenado.`,
      termometroTiempo(tiempo),
    );
  }

  if (hayLiga) {
    mete(
      "d-corners",
      "¿Cuántos córners generamos y cuántos concedemos?",
      "destacados",
      "Cada punto es un equipo de la categoría, por partido. Arriba y a la derecha es lo bueno: muchos a favor y pocos en contra. Las rayas son las medianas de la liga.",
      dispersion(
        comparativa!,
        { key: "corners", lado: "favor", rotulo: "CÓRNERS A FAVOR" },
        {
          key: "corners",
          lado: "contra",
          rotulo: "CÓRNERS CONCEDIDOS",
          menosEsMejor: true,
        },
        `Córners en la categoría · ${comparativa!.temporada}`,
        "Por partido. Arriba y a la derecha, mejor. Fuente Wyscout.",
      ),
    );

    mete(
      "d-acierto",
      "¿Y los rematamos?",
      "destacados",
      "El volumen lo pone el partido; el porcentaje que acaba en remate lo pone el entrenamiento. Estar a la derecha y abajo es sacar muchos sin rematarlos.",
      dispersion(
        comparativa!,
        { key: "corners", lado: "favor", rotulo: "CÓRNERS POR PARTIDO" },
        { key: "cornersRemate", lado: "favor", rotulo: "% QUE ACABA EN REMATE" },
        "Cuántos córners se sacan y cuántos se rematan",
        "Cada punto, un equipo. Fuente Wyscout.",
      ),
    );
  }

  if (propio && propio.acciones > 0) {
    mete(
      "d-nuestro",
      "¿Qué está rentando de lo nuestro?",
      "destacados",
      "De nuestras hojas de ABP: cuántas acciones hay de cada tipo, qué parte acaba en gol u ocasión y los goles que llevamos. Aquí los goles son dato, no estimación.",
      nuestroPorAspecto(propio),
    );
  }

  /* ================= 2 · EL TIEMPO Y SU REPARTO ================= */

  if (tiempo) {
    mete(
      "t-dias",
      "Minutos por día",
      "tiempo",
      "Dónde cayeron los minutos de balón parado dentro de la semana. Debajo, cómo se repartieron entre campo y vídeo, entre momentos de la sesión y entre roles.",
      repartoSemana(tiempo),
    );

    mete(
      "t-aspectos",
      "Qué aspecto se trabajó",
      "tiempo",
      "Minutos por aspecto: verde lo ofensivo, naranja lo defensivo. Una tarea que trabaja dos aspectos reparte sus minutos entre ellos, no los cuenta dos veces.",
      repartoPorAspecto(tiempo),
    );
  }

  /* ================= 3 · LA CATEGORÍA (WYSCOUT) ================= */

  if (hayLiga) {
    const liga = comparativa!;

    mete(
      "w-corners-favor",
      "Córners a favor",
      "wyscout",
      "Cuántos córners saca cada equipo por partido. Nosotros, en dorado.",
      ranking(liga, medidaDe(liga, "corners"), "favor"),
    );

    mete(
      "w-corners-remate",
      "Córners que acaban en remate",
      "wyscout",
      "De cada diez córners, cuántos acaban en remate. Es la nota del ensayo: el volumen lo pone el partido, esto el entrenamiento.",
      ranking(liga, medidaDe(liga, "cornersRemate"), "favor"),
    );

    mete(
      "w-corners-contra",
      "Córners concedidos",
      "wyscout",
      "Cuántos córners concede cada equipo por partido. Aquí el primero es el que menos concede.",
      ranking(liga, medidaDe(liga, "corners"), "contra"),
    );

    mete(
      "w-corners-contra-remate",
      "Córners concedidos que nos rematan",
      "wyscout",
      "Qué parte de los córners que concedemos acaba en remate del rival: es la nota de nuestra defensa del córner.",
      ranking(liga, medidaDe(liga, "cornersRemate"), "contra"),
    );

    mete(
      "w-faltas-favor",
      "Faltas lanzadas y rematadas",
      "wyscout",
      "Cuántas faltas se lanzan por partido. Depende tanto de lo que se provoque como de cómo defienda el rival.",
      ranking(liga, medidaDe(liga, "faltasTiro"), "favor"),
    );

    mete(
      "w-faltas-remate",
      "Faltas que acaban en remate",
      "wyscout",
      "De las faltas lanzadas, cuántas acaban en remate. Incluye las que se ponen al área, no sólo las que van a puerta.",
      ranking(liga, medidaDe(liga, "faltasRemate"), "favor"),
    );

    mete(
      "w-faltas-contra",
      "Faltas concedidas",
      "wyscout",
      "Faltas que le regalamos al rival para lanzar, por partido. El primero es el que menos concede.",
      ranking(liga, medidaDe(liga, "faltasTiro"), "contra"),
    );

    mete(
      "w-faltas-contra-remate",
      "Faltas concedidas que nos rematan",
      "wyscout",
      "De las faltas que concedemos, cuántas acaban en remate del rival.",
      ranking(liga, medidaDe(liga, "faltasRemate"), "contra"),
    );

    mete(
      "w-cuota",
      "Qué parte de los remates nace de estrategia",
      "wyscout",
      "De todos los remates del equipo, cuántos salen de una jugada a balón parado. Ni alto ni bajo es mejor: dice qué tipo de equipo es cada uno.",
      ranking(liga, medidaDe(liga, "cuotaRematesAbp"), "favor"),
    );

    if (liga.historico.length > 1) {
      mete(
        "w-temporadas-corners",
        "Córners, temporada a temporada",
        "wyscout",
        `Nuestros córners a favor y en contra en los ${liga.jugados} primeros partidos de cada temporada, que es la única comparación honesta.`,
        temporadas(liga, medidaDe(liga, "corners")),
      );

      mete(
        "w-temporadas-remate",
        "Córners con remate, temporada a temporada",
        "wyscout",
        "Lo mismo con el porcentaje que acaba en remate: dice si el trabajo de estos años ha movido la aguja.",
        temporadas(liga, medidaDe(liga, "cornersRemate")),
      );
    }
  }

  /* ============ 3.5 · NUESTRO PARTIDO, POR LAS DOS VÍAS ============ */

  /*
  | Lo mismo contado por Wyscout y por nosotros, uno detrás de otro.
  |
  | Va aquí —detrás del microciclo y delante del resto— porque es la pregunta
  | que sigue a «qué hemos entrenado»: qué ha salido de eso en el campo.
  |
  | **Wyscout no separa la falta lateral ni cuenta el saque de banda**, así que
  | por esa vía sólo salen el córner y la falta lanzada entera. La falta lateral
  | y la banda existen abajo, en nuestro registro, que es el único sitio donde
  | alguien las escribe.
  */
  if (comparativa?.nosotros) {
    mete(
      "p-wys-corner",
      "Córner · lo que mide Wyscout",
      "partido",
      "Córners por partido, a favor y en contra, con el porcentaje que acaba en remate. Wyscout mide igual a todos los equipos, así que esta cifra sí se puede comparar con la de cualquier rival.",
      wyscoutPorFamilia(
        comparativa,
        { cantidad: "corners", remate: "cornersRemate" },
        "Córners por partido (Wyscout)",
      ),
    );

    mete(
      "p-wys-falta",
      "Falta lanzada · lo que mide Wyscout",
      "partido",
      "Faltas lanzadas por partido, a favor y en contra. Ojo: Wyscout no separa la lateral de la directa, las cuenta todas juntas; el desglose está abajo, en nuestro registro.",
      wyscoutPorFamilia(
        comparativa,
        { cantidad: "faltasTiro", remate: "faltasRemate" },
        "Faltas lanzadas por partido (Wyscout)",
      ),
    );
  }

  if (propio && propio.acciones > 0) {
    const hayFamilia = (familia: string) =>
      (propio.porFamiliaYLado ?? []).some(
        (una) => una.familia === familia && una.acciones > 0,
      );

    const nuestras: { familia: string; cid: string; titulo: string; pie: string }[] = [
      {
        familia: "corner",
        cid: "p-nos-corner",
        titulo: "Córner · lo que registramos nosotros",
        pie: "Córners a favor y en contra según nuestras hojas, con el porcentaje que acaba en peligro y los goles. Esto trae goles y Wyscout no: aquí el analista escribe el resultado de cada acción.",
      },
      {
        familia: "falta-lateral",
        cid: "p-nos-falta",
        titulo: "Falta lateral · lo que registramos nosotros",
        pie: "La falta lateral separada de la directa, que es como se entrena y como se defiende. Ninguna plataforma la da así de desglosada.",
      },
      {
        familia: "banda",
        cid: "p-nos-banda",
        titulo: "Saque de banda · lo que registramos nosotros",
        pie: "Saques de banda a favor y en contra. No lo cuenta ni Wyscout ni Opta: sale entero de nuestras dos hojas de banda.",
      },
    ];

    for (const una of nuestras) {
      /* Una familia sin una sola acción no se pinta: un gráfico vacío ocupa
         lo mismo que uno lleno y no dice nada. */
      if (!hayFamilia(una.familia)) continue;

      mete(
        una.cid,
        una.titulo,
        "partido",
        una.pie,
        nuestroPorFamilia(propio, una.familia, una.titulo),
      );
    }
  }

  /* ================= 4 · NUESTROS REGISTROS ================= */

  if (propio && propio.acciones > 0) {
    mete(
      "n-aspectos",
      "Acción por acción",
      "nuestro",
      "Todas las acciones registradas por familia, con el porcentaje que acaba en gol u ocasión y los goles conseguidos o encajados.",
      nuestroPorAspecto(propio),
    );

    if (propio.porJornada.length > 1) {
      mete(
        "n-jornadas",
        "Jornada a jornada",
        "nuestro",
        "Barras: cuántas acciones de ABP hubo en cada partido. Línea dorada: qué parte acabó en gol u ocasión, sobre el eje de la derecha.",
        nuestraEvolucion(propio),
      );
    }

    if (propio.rematadores.length > 0 || propio.sacadores.length > 0) {
      mete(
        "n-nombres",
        "Quién remata y quién saca",
        "nuestro",
        "Los dos nombres que la hoja guarda de cada acción. A la derecha, en cuántas de ellas hubo gol u ocasión.",
        nuestrosNombres(propio),
      );
    }
  }

  /* ================= 5 · CONTENIDOS Y VALORACIÓN ================= */

  if (tareasValoradas.length > 0) {
    mete(
      "c-valoracion",
      "Cómo salieron las tareas",
      "contenidos",
      "La nota que puso el cuerpo técnico a cada tarea de ABP en la hoja de registro. Verde a partir de 7, naranja por debajo de 5, y la raya dorada es la media de la semana.",
      valoracionTareas(tareasValoradas, datos.mediaValoracion),
    );
  }

  /* ================= 6 · SEGUIMIENTO INDIVIDUAL ================= */

  if (seguimiento && seguimiento.total > 0) {
    mete(
      "s-jugadores",
      "Quién ha llevado seguimiento de ABP",
      "seguimiento",
      "Arriba, los jugadores con más registros de balón parado en estas fechas. Abajo, quién del cuerpo técnico los ha hecho.",
      seguimientoAbp(seguimiento),
    );
  }

  return graficos;
}
