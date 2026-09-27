/**
 * LEER UN INFORME EN PDF Y CONVERTIRLO EN LÁMINAS.
 *
 * Para las jornadas que no se preparan dentro de la plataforma: el cuerpo
 * técnico sigue montando algunos informes en PowerPoint y los pasa a PDF (el
 * del Alcorcón de la J5 es el modelo). Ese PDF no es una foto: PowerPoint deja
 * dentro cada cosa por separado, y de ahí se saca todo sin adivinar nada:
 *
 * - **El título** de la barra de arriba, que dice la sección («CORNER
 *   OFENSIVO…», «CENTROS LATERALES…»).
 * - **Las cruces**: formas vectoriales de doce vértices rellenas de rojo
 *   (#FF0000) o amarillo (#FFFF00). Las que caen fuera del campo son la
 *   leyenda, con su texto al lado.
 * - **Los balones**: imágenes pequeñas; su color se lee de sus píxeles.
 * - **Los rótulos** («CORTA», «RASO»): rectángulos azul marino con su texto, y
 *   las líneas blancas que salen de ellos hacia lo que señalan.
 * - **Las fichas** de la derecha: el nombre en su barra azul y debajo la
 *   altura y la edad o el pie. Se cruzan con la plantilla del rival.
 *
 * La portada y el cierre no tienen campo y se saltan.
 *
 * **La escala sale de la imagen del campo**, que es la misma en todas las
 * diapositivas de la plantilla del club: se calibró con las líneas del área
 * sobre el informe del Alcorcón. Si algún día cambia el fondo del campo, hay
 * que volver a medir `CALIBRACION`.
 */

import {
  type ColorMarca,
  type JugadorLamina,
  type Lamina,
  laminaNueva,
  type Marca,
  nuevoIdAnalisis,
  type Punto,
  type SeccionId,
} from "@/lib/rivals/analisis";
import { playerKey } from "@/lib/rivals/once";

/* ------------------------------------------------------------------ */
/*  TIPOS                                                              */
/* ------------------------------------------------------------------ */

export type FilaPlantilla = Record<string, unknown>;

export type LaminaImportada = {
  pagina: number;
  lamina: Lamina;
  cuenta: { cruces: number; balones: number; rotulos: number; jugadores: number };
  /** Los nombres de las fichas que no se han encontrado en la plantilla. */
  sinCasar: string[];
};

export type ResultadoImportacion = {
  laminas: LaminaImportada[];
  /** Páginas sin campo: portada, cierre… */
  saltadas: number[];
};

/* Lo mínimo de pdfjs que se usa: así sirve la versión del navegador y la de
   Node para las pruebas. */
type PdfPagina = {
  view: number[];
  getOperatorList: () => Promise<{ fnArray: number[]; argsArray: unknown[][] }>;
  getTextContent: () => Promise<{ items: unknown[] }>;
  objs: { get: (id: string, callback?: (obj: unknown) => void) => unknown };
  /** Las imágenes que se repiten entre páginas viven aquí, no en `objs`. */
  commonObjs?: { get: (id: string, callback?: (obj: unknown) => void) => unknown };
};

export type PdfLib = {
  OPS: Record<string, number>;
  getDocument: (fuente: { data: Uint8Array; verbosity?: number }) => {
    promise: Promise<{ numPages: number; getPage: (n: number) => Promise<PdfPagina> }>;
  };
};

type Caja = { x0: number; y0: number; x1: number; y1: number };

type Forma = {
  color: string;
  caja: Caja;
  puntos: Punto[];
  relleno: boolean;
};

type Imagen = { id: string; caja: Caja; clip: Caja | null };

type Texto = { texto: string; x: number; y: number; ancho: number };

/* ------------------------------------------------------------------ */
/*  CALIBRACIÓN                                                        */
/* ------------------------------------------------------------------ */

/**
 * Dónde están las líneas del campo dentro de su imagen, en tanto por uno
 * (0 = borde izquierdo / de arriba de la imagen).
 *
 * Medido sobre el informe de ABP del Alcorcón: bandas a 0,0591 y 0,9440 del
 * ancho; línea de fondo a 0,1216 y línea del área grande (16,5 m) a 0,3606 del
 * alto. El campo de la plantilla es un dibujo plano, así que la escala es la
 * misma en todo él.
 */
const CALIBRACION = { u0: 0.0591, u1: 0.944, v0: 0.1216, vArea: 0.3606 };

const aMetros = (p: Punto, campo: Caja): Punto => {
  const u = (p.x - campo.x0) / (campo.x1 - campo.x0);
  const v = (campo.y1 - p.y) / (campo.y1 - campo.y0);

  return {
    x: +(((u - CALIBRACION.u0) / (CALIBRACION.u1 - CALIBRACION.u0)) * 68).toFixed(2),
    y: +(((v - CALIBRACION.v0) / (CALIBRACION.vArea - CALIBRACION.v0)) * 16.5).toFixed(2),
  };
};

/* ------------------------------------------------------------------ */
/*  AYUDAS                                                             */
/* ------------------------------------------------------------------ */

const centro = (c: Caja): Punto => ({ x: (c.x0 + c.x1) / 2, y: (c.y0 + c.y1) / 2 });
const ancho = (c: Caja) => c.x1 - c.x0;
const alto = (c: Caja) => c.y1 - c.y0;

const dentro = (p: Punto, c: Caja, margen = 0) =>
  p.x >= c.x0 - margen && p.x <= c.x1 + margen && p.y >= c.y0 - margen && p.y <= c.y1 + margen;

const cajaDe = (puntos: Punto[]): Caja => ({
  x0: Math.min(...puntos.map((p) => p.x)),
  y0: Math.min(...puntos.map((p) => p.y)),
  x1: Math.max(...puntos.map((p) => p.x)),
  y1: Math.max(...puntos.map((p) => p.y)),
});

type Matriz = number[];

const multiplica = (a: Matriz, b: Matriz): Matriz => [
  a[0] * b[0] + a[2] * b[1],
  a[1] * b[0] + a[3] * b[1],
  a[0] * b[2] + a[2] * b[3],
  a[1] * b[2] + a[3] * b[3],
  a[0] * b[4] + a[2] * b[5] + a[4],
  a[1] * b[4] + a[3] * b[5] + a[5],
];

const aplica = (m: Matriz, x: number, y: number): Punto => ({
  x: m[0] * x + m[2] * y + m[4],
  y: m[1] * x + m[3] * y + m[5],
});

function rgb(color: unknown): [number, number, number] | null {
  if (typeof color === "string") {
    const hex = color.match(/^#?([0-9a-f]{6})$/i)?.[1];

    if (!hex) return null;

    return [0, 2, 4].map((i) => parseInt(hex.slice(i, i + 2), 16)) as [number, number, number];
  }

  return null;
}

const hexDe = (args: unknown[]): string => {
  if (typeof args[0] === "string") return args[0].toLowerCase();

  const [r, g, b] = args.map((v) => Math.round(Number(v) * (Number(v) <= 1 ? 255 : 1)));

  return `#${[r, g, b].map((v) => (v || 0).toString(16).padStart(2, "0")).join("")}`;
};

/** El color de una cruz, o `null` si no es de los que se usan para marcar. */
function colorMarca(hex: string): ColorMarca | null {
  const c = rgb(hex);

  if (!c) return null;

  const [r, g, b] = c;

  if (r > 190 && g < 110 && b < 110) return "rojo";
  if (r > 190 && g > 170 && b < 120) return "amarillo";
  if (b > 160 && r < 120 && g < 170) return "azul";
  if (r > 235 && g > 235 && b > 235) return "blanco";

  return null;
}

const esMarino = (hex: string) => {
  const c = rgb(hex);

  return Boolean(c && c[0] < 70 && c[1] < 90 && c[2] > 60 && c[2] - c[0] > 30);
};

const esBlanco = (hex: string) => {
  const c = rgb(hex);

  return Boolean(c && c[0] > 220 && c[1] > 220 && c[2] > 220);
};

/** El color de un balón, mirando sus píxeles con color. */
function colorDePixeles(datos: ArrayLike<number>, canales: number): ColorMarca {
  let r = 0;
  let g = 0;
  let b = 0;
  let n = 0;
  let total = 0;

  for (let i = 0; i + 2 < datos.length; i += canales) {
    if (canales === 4 && datos[i + 3] < 128) continue;

    total++;

    const pr = datos[i];
    const pg = datos[i + 1];
    const pb = datos[i + 2];

    if (Math.max(pr, pg, pb) - Math.min(pr, pg, pb) < 45) continue;

    r += pr;
    g += pg;
    b += pb;
    n++;
  }

  /* Casi sin color: el balón blanco de siempre. */
  if (!n || n < total * 0.12) return "blanco";

  r /= n;
  g /= n;
  b /= n;

  if (r > g * 1.35 && r > b * 1.2) return "rojo";
  if (r > 140 && g > 120 && b < r * 0.8) return "amarillo";
  if (b > r && b > g) return "azul";

  return "blanco";
}

async function colorDeImagen(pagina: PdfPagina, id: string): Promise<ColorMarca> {
  const almacen = id.startsWith("g_") && pagina.commonObjs ? pagina.commonObjs : pagina.objs;

  /* Con tope: si pdfjs no la entrega, el balón sale blanco en vez de dejar
     la importación colgada para siempre. */
  const objeto = await new Promise<unknown>((resolve) => {
    const tope = setTimeout(() => resolve(null), 2_000);
    const listo = (valor: unknown) => {
      clearTimeout(tope);
      resolve(valor);
    };

    try {
      const inmediato = almacen.get(id, listo);

      if (inmediato) listo(inmediato);
    } catch {
      listo(null);
    }
  });

  const img = objeto as {
    data?: ArrayLike<number>;
    width?: number;
    height?: number;
    bitmap?: CanvasImageSource & { width: number; height: number };
  } | null;

  if (!img) return "blanco";

  if (img.data && img.width && img.height) {
    const canales = Math.round(img.data.length / (img.width * img.height));

    return colorDePixeles(img.data, canales >= 4 ? 4 : 3);
  }

  /* En el navegador pdfjs las da ya decodificadas como ImageBitmap. */
  if (img.bitmap && typeof document !== "undefined") {
    const lienzo = document.createElement("canvas");

    lienzo.width = Math.min(64, img.bitmap.width);
    lienzo.height = Math.min(64, img.bitmap.height);

    const ctx = lienzo.getContext("2d");

    if (!ctx) return "blanco";

    ctx.drawImage(img.bitmap, 0, 0, lienzo.width, lienzo.height);

    return colorDePixeles(ctx.getImageData(0, 0, lienzo.width, lienzo.height).data, 4);
  }

  return "blanco";
}

/* ------------------------------------------------------------------ */
/*  LA PÁGINA POR DENTRO                                               */
/* ------------------------------------------------------------------ */

async function desmonta(pagina: PdfPagina, OPS: Record<string, number>) {
  const nombre: Record<number, string> = Object.fromEntries(
    Object.entries(OPS).map(([k, v]) => [v, k]),
  );

  const { fnArray, argsArray } = await pagina.getOperatorList();

  const formas: Forma[] = [];
  const imagenes: Imagen[] = [];

  type Estado = { m: Matriz; relleno: string; trazo: string; clip: Caja | null };

  let estado: Estado = { m: [1, 0, 0, 1, 0, 0], relleno: "#000000", trazo: "#000000", clip: null };
  const pila: Estado[] = [];
  let ultimaCaja: Caja | null = null;

  const RELLENA = new Set(["fill", "eoFill", "fillStroke", "eoFillStroke", "closeFillStroke", "closeEOFillStroke"]);
  const TRAZA = new Set(["stroke", "closeStroke", "fillStroke", "eoFillStroke", "closeFillStroke", "closeEOFillStroke"]);

  for (let i = 0; i < fnArray.length; i++) {
    const op = nombre[fnArray[i]];
    const args = (argsArray[i] ?? []) as unknown[];

    switch (op) {
      case "save":
        pila.push({ ...estado });
        break;
      case "restore":
        estado = pila.pop() ?? estado;
        break;
      case "transform":
        estado = { ...estado, m: multiplica(estado.m, args.map(Number)) };
        break;
      case "setFillRGBColor":
        estado = { ...estado, relleno: hexDe(args) };
        break;
      case "setStrokeRGBColor":
        estado = { ...estado, trazo: hexDe(args) };
        break;
      case "clip":
      case "eoClip":
        if (ultimaCaja) estado = { ...estado, clip: ultimaCaja };
        break;
      case "constructPath": {
        const dibujo = nombre[Number(args[0])] ?? "";
        const crudo = args[1] as unknown;
        const datos = (Array.isArray(crudo) && crudo.length && typeof crudo[0] !== "number"
          ? crudo[0]
          : crudo) as ArrayLike<number> | null;

        const puntos: Punto[] = [];

        if (datos && typeof datos.length === "number") {
          for (let k = 0; k < datos.length; ) {
            const orden = datos[k];

            if (orden === 0 || orden === 1) {
              puntos.push(aplica(estado.m, datos[k + 1], datos[k + 2]));
              k += 3;
            } else if (orden === 2) {
              puntos.push(aplica(estado.m, datos[k + 5], datos[k + 6]));
              k += 7;
            } else if (orden === 3) {
              puntos.push(aplica(estado.m, datos[k + 3], datos[k + 4]));
              k += 5;
            } else {
              k += 1;
            }
          }
        }

        if (!puntos.length) break;

        const caja = cajaDe(puntos);

        ultimaCaja = caja;

        if (RELLENA.has(dibujo)) formas.push({ color: estado.relleno, caja, puntos, relleno: true });
        if (TRAZA.has(dibujo)) formas.push({ color: estado.trazo, caja, puntos, relleno: false });
        break;
      }
      case "paintImageXObject":
      case "paintInlineImageXObject": {
        const esquinas = [aplica(estado.m, 0, 0), aplica(estado.m, 1, 1), aplica(estado.m, 0, 1), aplica(estado.m, 1, 0)];

        imagenes.push({ id: String(args[0]), caja: cajaDe(esquinas), clip: estado.clip });
        break;
      }
    }
  }

  const contenido = await pagina.getTextContent();

  const textos: Texto[] = (contenido.items as { str?: string; transform?: number[]; width?: number }[])
    .filter((item) => item.str && item.str.trim() && item.transform)
    .map((item) => ({
      texto: String(item.str).trim(),
      x: item.transform![4],
      y: item.transform![5],
      ancho: Number(item.width ?? 0),
    }));

  return { formas, imagenes, textos };
}

/* ------------------------------------------------------------------ */
/*  LA PLANTILLA                                                       */
/* ------------------------------------------------------------------ */

const normaliza = (valor: unknown) =>
  String(valor ?? "")
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toUpperCase()
    .replace(/[^A-Z0-9 ]/g, " ")
    .replace(/\s+/g, " ")
    .trim();

/**
 * Busca en la plantilla al jugador de una ficha.
 *
 * En los informes va el nombre del vestuario: «IRU» es IRURITA, «LANCHO» es
 * JAVI LANCHO, «BERLANGA» es M. BERLANGA. Se prueba de más a menos exacto y
 * sólo vale si hay UN candidato.
 */
export function casaJugador(nombre: string, plantilla: FilaPlantilla[]): FilaPlantilla | null {
  const buscado = normaliza(nombre);

  if (!buscado) return null;

  const nombres = (fila: FilaPlantilla) =>
    [fila["NOMBRE DEPORTIVO"], fila.JUGADOR].map(normaliza).filter(Boolean);

  const pruebas: ((fila: FilaPlantilla) => boolean)[] = [
    (fila) => nombres(fila).includes(buscado),
    (fila) => nombres(fila).some((n) => n.split(" ").includes(buscado)),
    (fila) =>
      buscado.length >= 3 && nombres(fila).some((n) => n.split(" ").some((pieza) => pieza.startsWith(buscado))),
    (fila) => buscado.length >= 4 && nombres(fila).some((n) => n.includes(buscado)),
  ];

  for (const prueba of pruebas) {
    const candidatos = plantilla.filter(prueba);

    if (candidatos.length === 1) return candidatos[0];
  }

  return null;
}

/* ------------------------------------------------------------------ */
/*  LA SECCIÓN                                                         */
/* ------------------------------------------------------------------ */

export function seccionDeTitulo(titulo: string): SeccionId | null {
  const t = normaliza(titulo);
  const defiende = /\bDEF/.test(t);

  if (/CENTRO/.test(t)) return defiende ? "centros-def" : "centros-of";
  if (/CORNER/.test(t)) return defiende ? "corner-def" : "corner-of";
  if (/FALTA|LIBRE DIRECTO|LIBRE INDIRECTO/.test(t)) return defiende ? "falta-def" : "falta-of";

  return null;
}

/* ------------------------------------------------------------------ */
/*  PRINCIPAL                                                          */
/* ------------------------------------------------------------------ */

export async function importaPdfAnalisis(
  pdfjs: PdfLib,
  datos: ArrayBuffer | Uint8Array,
  plantilla: FilaPlantilla[],
): Promise<ResultadoImportacion> {
  const documento = await pdfjs.getDocument({
    data: datos instanceof Uint8Array ? datos : new Uint8Array(datos),
    verbosity: 0,
  }).promise;

  const laminas: LaminaImportada[] = [];
  const saltadas: number[] = [];

  for (let n = 1; n <= documento.numPages; n++) {
    const pagina = await documento.getPage(n);
    const [, , paginaW, paginaH] = pagina.view;

    const { formas, imagenes, textos } = await desmonta(pagina, pdfjs.OPS);

    /* El campo: una imagen que ocupa casi todo el alto y la mayor parte del
       ancho, sin llegar a sangre (eso es la foto de la portada). */
    const campo = imagenes
      .filter(
        (img) =>
          ancho(img.caja) > paginaW * 0.55 &&
          ancho(img.caja) < paginaW * 0.97 &&
          alto(img.caja) > paginaH * 0.75 &&
          img.caja.x0 < paginaW * 0.1,
      )
      .sort((a, b) => ancho(b.caja) * alto(b.caja) - ancho(a.caja) * alto(a.caja))[0];

    if (!campo) {
      saltadas.push(n);
      continue;
    }

    /* Lo que se ve del campo: su recorte, o la imagen si no lo tiene. */
    const zona: Caja = campo.clip
      ? {
          x0: Math.max(campo.clip.x0, campo.caja.x0),
          y0: Math.max(campo.clip.y0, campo.caja.y0),
          x1: Math.min(campo.clip.x1, campo.caja.x1),
          y1: Math.min(campo.clip.y1, campo.caja.y1),
        }
      : campo.caja;

    const metros = (p: Punto) => aMetros(p, campo.caja);

    /* ---------------- el título ---------------- */

    const titulo = textos
      .filter((t) => t.y > zona.y1 - 2)
      .sort((a, b) => a.x - b.x)
      .map((t) => t.texto)
      .join(" ")
      .replace(/\s+/g, " ")
      .trim();

    const seccion = seccionDeTitulo(titulo);

    if (!seccion) {
      saltadas.push(n);
      continue;
    }

    const lamina = laminaNueva(seccion);

    lamina.titulo = titulo.toUpperCase();
    lamina.leyenda = {};
    lamina.tituloJugadores = "";

    /* ---------------- las cruces ---------------- */

    const cruces: { color: ColorMarca; p: Punto; dentro: boolean }[] = [];

    for (const forma of formas) {
      if (!forma.relleno || forma.puntos.length < 8) continue;

      const color = colorMarca(forma.color);
      const w = ancho(forma.caja);
      const h = alto(forma.caja);

      if (!color || w < 8 || h < 8 || w > 50 || h > 50 || w / h < 0.6 || w / h > 1.6) continue;

      const p = centro(forma.caja);

      /* PowerPoint pinta a veces la misma cruz dos veces (relleno y borde). */
      if (cruces.some((c) => c.color === color && Math.hypot(c.p.x - p.x, c.p.y - p.y) < 3)) continue;

      cruces.push({ color, p, dentro: dentro(p, zona) });
    }

    const marcas: Marca[] = cruces
      .filter((c) => c.dentro)
      .map((c) => ({ id: nuevoIdAnalisis(), tipo: "cruz", color: c.color, ...metros(c.p) }));

    /* La leyenda: las cruces de fuera del campo, con su texto a la derecha. */
    for (const c of cruces.filter((una) => !una.dentro)) {
      const rotulo = textos
        .filter((t) => Math.abs(t.y - c.p.y) < 16 && t.x > c.p.x && t.x - c.p.x < 170)
        .sort((a, b) => a.x - b.x)[0];

      if (rotulo) lamina.leyenda = { ...lamina.leyenda, [c.color]: rotulo.texto.toUpperCase() };
    }

    /* ---------------- los balones ---------------- */

    let balones = 0;

    for (const img of imagenes) {
      if (img === campo) continue;

      const w = ancho(img.caja);
      const h = alto(img.caja);
      const p = centro(img.caja);

      if (w < 8 || h < 8 || w > 45 || h > 45 || w / h < 0.6 || w / h > 1.6 || !dentro(p, zona)) continue;

      const color = await colorDeImagen(pagina, img.id);

      marcas.push({ id: nuevoIdAnalisis(), tipo: "balon", color, ...metros(p) });
      balones++;
    }

    /* ---------------- los rótulos y sus líneas ---------------- */

    const rotulos: { caja: Caja; marca: Extract<Marca, { tipo: "etiqueta" }> }[] = [];

    for (const forma of formas) {
      if (!forma.relleno || !esMarino(forma.color)) continue;

      const w = ancho(forma.caja);
      const h = alto(forma.caja);

      if (w < 20 || w > 320 || h < 12 || h > 55 || !dentro(centro(forma.caja), zona)) continue;

      const texto = textos
        .filter((t) => dentro({ x: t.x + t.ancho / 2, y: t.y + 4 }, forma.caja, 4))
        .sort((a, b) => b.y - a.y || a.x - b.x)
        .map((t) => t.texto)
        .join(" ")
        .trim();

      if (!texto) continue;

      rotulos.push({
        caja: forma.caja,
        marca: { id: nuevoIdAnalisis(), tipo: "etiqueta", texto: texto.toUpperCase(), a: [], ...metros(centro(forma.caja)) },
      });
    }

    for (const forma of formas) {
      if (forma.relleno || !esBlanco(forma.color) || forma.puntos.length < 2) continue;

      const p = forma.puntos[0];
      const q = forma.puntos[forma.puntos.length - 1];

      if (Math.hypot(p.x - q.x, p.y - q.y) < 8 || !dentro(p, zona, 2) || !dentro(q, zona, 2)) continue;

      /* La punta que está pegada a un rótulo es la suya; la otra, lo que señala. */
      const distancia = (punto: Punto, caja: Caja) =>
        Math.hypot(
          Math.max(caja.x0 - punto.x, 0, punto.x - caja.x1),
          Math.max(caja.y0 - punto.y, 0, punto.y - caja.y1),
        );

      let mejor: { rotulo: (typeof rotulos)[number]; destino: Punto; d: number } | null = null;

      for (const rotulo of rotulos) {
        for (const [cerca, lejos] of [
          [p, q],
          [q, p],
        ] as const) {
          const d = distancia(cerca, rotulo.caja);

          if (d < 14 && (!mejor || d < mejor.d)) mejor = { rotulo, destino: lejos, d };
        }
      }

      if (mejor) mejor.rotulo.marca.a.push(metros(mejor.destino));
    }

    marcas.push(...rotulos.map((r) => r.marca));

    /* ---------------- las fichas ---------------- */

    const barras = formas
      .filter(
        (f) =>
          f.relleno &&
          esMarino(f.color) &&
          f.caja.x0 > zona.x1 - 10 &&
          alto(f.caja) >= 12 &&
          alto(f.caja) <= 60,
      )
      .sort((a, b) => b.caja.y1 - a.caja.y1);

    const textoEn = (caja: Caja) =>
      textos
        .filter((t) => dentro({ x: t.x + t.ancho / 2, y: t.y + 4 }, caja, 4))
        .sort((a, b) => b.y - a.y || a.x - b.x)
        .map((t) => t.texto)
        .join(" ")
        .trim();

    /* Las barras de nombre van a la derecha de la foto; el rótulo del panel
       («PRINCIPALES CENTRADORES») arranca pegado al campo y es más alto. */
    const anchoPanel = Math.max(...barras.map((b) => b.caja.x1)) - zona.x1;
    const esNombre = (b: Forma) => b.caja.x0 - zona.x1 > anchoPanel * 0.3;

    const cabecera = barras.find((b) => !esNombre(b) && b.caja.y0 > zona.y0 && b.caja.y1 < zona.y1 + 2);

    /* El rótulo del panel va en dos renglones y el segundo se sale de su
       barra por abajo: se lee hasta donde empieza la primera ficha. */
    if (cabecera) {
      const primera = barras.find((b) => esNombre(b) && b.caja.y1 < cabecera.caja.y1);

      lamina.tituloJugadores = textoEn({
        ...cabecera.caja,
        y0: Math.max(cabecera.caja.y0 - 34, (primera?.caja.y1 ?? -Infinity) + 1),
      }).toUpperCase();
    }

    const jugadores: JugadorLamina[] = [];
    const sinCasar: string[] = [];

    for (const barra of barras.filter(esNombre)) {
      const nombre = textoEn(barra.caja);

      if (!nombre || jugadores.length >= 6) continue;

      const debajo = textos
        .filter(
          (t) =>
            t.x + t.ancho / 2 >= barra.caja.x0 - 4 &&
            t.x + t.ancho / 2 <= barra.caja.x1 + 4 &&
            t.y < barra.caja.y0 &&
            t.y > barra.caja.y0 - 70,
        )
        .sort((a, b) => b.y - a.y)
        .map((t) => t.texto.toUpperCase());

      const segundo = debajo.find((t) => !/\d+\s*CM/.test(t)) ?? "";

      const fila = casaJugador(nombre, plantilla);

      if (!fila) sinCasar.push(nombre.toUpperCase());

      jugadores.push({
        clave: fila ? playerKey(fila) : "",
        nombre: nombre.toUpperCase(),
        dato: /ZURD|DIEST|AMBI|IZQ|DERECH|PIE/.test(segundo) ? "pie" : "edad",
      });
    }

    lamina.jugadores = jugadores;
    lamina.marcas = marcas;

    laminas.push({
      pagina: n,
      lamina,
      cuenta: {
        cruces: marcas.filter((m) => m.tipo === "cruz").length,
        balones,
        rotulos: rotulos.length,
        jugadores: jugadores.length,
      },
      sinCasar,
    });
  }

  return { laminas, saltadas };
}
