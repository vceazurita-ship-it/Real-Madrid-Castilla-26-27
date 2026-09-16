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

/** Qué se trabaja y qué renta, aspecto por aspecto, de nuestras hojas. */
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

export type GraficoInforme = {
  /** El identificador con el que el correo lo llama: `src="cid:…"`. */
  cid: string;
  titulo: string;
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

/**
 * Los gráficos del informe, en el orden en que se leen.
 *
 * Lo que no tenga dato no se dibuja: un gráfico vacío ocupa lo mismo que uno
 * lleno y no dice nada.
 */
export function graficosDelInforme(
  comparativa: ComparativaAbp | null,
  propio: PropioAbp | null,
): GraficoInforme[] {
  const graficos: GraficoInforme[] = [];

  /* ---- Lo nuestro primero: es lo único con goles de verdad ---- */

  if (propio && propio.acciones > 0) {
    graficos.push({
      cid: "abp-aspectos",
      titulo: "Nuestro balón parado, acción por acción",
      imagen: nuestroPorAspecto(propio),
      ancho: 760,
    });

    if (propio.porJornada.length > 1) {
      graficos.push({
        cid: "abp-jornadas",
        titulo: "Jornada a jornada",
        imagen: nuestraEvolucion(propio),
        ancho: 760,
      });
    }

    if (propio.rematadores.length > 0 || propio.sacadores.length > 0) {
      graficos.push({
        cid: "abp-nombres",
        titulo: "Quién remata y quién saca",
        imagen: nuestrosNombres(propio),
        ancho: 760,
      });
    }
  }

  /* ---- Y la categoría, con lo que Wyscout mide ---- */

  if (comparativa && comparativa.liga.length > 0) {
    graficos.push({
      cid: "abp-dispersion-corners",
      titulo: "Córners: los que sacamos y los que concedemos",
      imagen: dispersion(
        comparativa,
        { key: "corners", lado: "favor", rotulo: "CÓRNERS A FAVOR" },
        { key: "corners", lado: "contra", rotulo: "CÓRNERS CONCEDIDOS", menosEsMejor: true },
        `Córners en la categoría · ${comparativa.temporada}`,
        "Por partido. Arriba y a la derecha: se sacan muchos y se conceden pocos. Fuente Wyscout.",
      ),
      ancho: 760,
    });

    graficos.push({
      cid: "abp-dispersion-acierto",
      titulo: "Volumen contra acierto",
      imagen: dispersion(
        comparativa,
        { key: "corners", lado: "favor", rotulo: "CÓRNERS POR PARTIDO" },
        { key: "cornersRemate", lado: "favor", rotulo: "% QUE ACABA EN REMATE" },
        "Cuántos córners se sacan y cuántos se rematan",
        "El volumen lo pone el partido; el porcentaje que acaba en remate, el entrenamiento. Fuente Wyscout.",
      ),
      ancho: 760,
    });

    graficos.push({
      cid: "abp-ranking-corners",
      titulo: "Córners a favor en la categoría",
      imagen: ranking(comparativa, medidaDe(comparativa, "corners"), "favor"),
      ancho: 760,
    });

    graficos.push({
      cid: "abp-ranking-corners-contra",
      titulo: "Córners concedidos en la categoría",
      imagen: ranking(comparativa, medidaDe(comparativa, "corners"), "contra"),
      ancho: 760,
    });

    graficos.push({
      cid: "abp-ranking-remate",
      titulo: "Qué parte de los remates nace de estrategia",
      imagen: ranking(
        comparativa,
        medidaDe(comparativa, "cuotaRematesAbp"),
        "favor",
      ),
      ancho: 760,
    });

    if (comparativa.historico.length > 1) {
      graficos.push({
        cid: "abp-temporadas-corners",
        titulo: "Córners, temporada a temporada",
        imagen: temporadas(comparativa, medidaDe(comparativa, "corners")),
        ancho: 760,
      });

      graficos.push({
        cid: "abp-temporadas-remate",
        titulo: "Córners con remate, temporada a temporada",
        imagen: temporadas(comparativa, medidaDe(comparativa, "cornersRemate")),
        ancho: 760,
      });
    }
  }

  return graficos;
}
