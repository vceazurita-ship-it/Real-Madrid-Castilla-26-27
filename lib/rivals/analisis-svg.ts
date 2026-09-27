/**
 * LA LÁMINA DE ANÁLISIS, DIBUJADA CON EL CROMO DE LA PIZARRA DE ABP.
 *
 * Una sola función pinta la lámina entera como texto SVG a 1920×1080. De esa
 * misma cadena sale todo: la pantalla la usa de fondo y pone encima las marcas
 * que se arrastran, y el PDF, el PPT y el informe del microciclo la pasan a
 * imagen. Tener un segundo dibujo «para exportar» era garantizar que un día la
 * pantalla y el documento no dijesen lo mismo.
 *
 * **Se parece a propósito a la pizarra de balón parado propia**
 * (`components/abp/pizarra/TableroSlide.tsx`): la misma cabecera azul noche con
 * el escudo en su círculo de oro, el filo oro-rosa, la foto del estadio a
 * sangre con sus velos, los paneles de cristal azul noche con rótulos en oro y
 * la tarjeta blanca de consignas. Los colores salen de `COLORES` de
 * `lib/abp/pizarra.ts`, no se copian: si la pizarra cambia de tono, cambia
 * también esto.
 *
 * Las marcas se guardan en metros y se llevan a la foto con una homografía
 * sacada de las cuatro esquinas del área grande: la foto está en perspectiva y
 * un reparto lineal dejaba los remates del segundo palo fuera del área.
 */

import { COLORES as PIZARRA, CABECERA_H } from "@/lib/abp/pizarra";
import {
  CAMPO_ANCHO,
  CAMPO_FONDO,
  COLORES,
  type ColorMarca,
  type Lamina,
  type Marca,
  type Punto,
} from "@/lib/rivals/analisis";

export const LAMINA_W = 1920;
export const LAMINA_H = 1080;

export const NAVY = PIZARRA.noche;

const FUENTE = "'Barlow Condensed Pizarra', 'Barlow Condensed', 'Arial Narrow', Arial, sans-serif";

/** Lo que se puede tocar del campo: todo lo que no es cabecera ni columna. */
export const COLUMNA = { x: 1548, w: 352 };

export const TABLERO = { x: 0, y: CABECERA_H + 5, w: COLUMNA.x - 8, h: LAMINA_H - CABECERA_H - 5 };

/**
 * La foto del campo va corrida a la izquierda para que la banda derecha —de
 * donde salen la mitad de los centros— no quede debajo de la columna. Lo que
 * sobra a la derecha se apaga hacia el azul noche, como en el plano de
 * portería de la pizarra.
 */
const FOTO_X = -170;

/* ------------------------------------------------------------------ */
/*  LA PERSPECTIVA                                                     */
/* ------------------------------------------------------------------ */

type Matriz = number[];

/** Homografía que lleva cuatro puntos a otros cuatro (DLT con h33 = 1). */
function homografia(de: Punto[], a: Punto[]): Matriz {
  const filas: number[][] = [];
  const b: number[] = [];

  de.forEach((p, i) => {
    const q = a[i];

    filas.push([p.x, p.y, 1, 0, 0, 0, -q.x * p.x, -q.x * p.y]);
    b.push(q.x);
    filas.push([0, 0, 0, p.x, p.y, 1, -q.y * p.x, -q.y * p.y]);
    b.push(q.y);
  });

  /* Gauss con pivote: ocho ecuaciones, ocho incógnitas. */
  const n = 8;
  const m = filas.map((fila, i) => [...fila, b[i]]);

  for (let c = 0; c < n; c++) {
    let pivote = c;

    for (let f = c + 1; f < n; f++) if (Math.abs(m[f][c]) > Math.abs(m[pivote][c])) pivote = f;

    [m[c], m[pivote]] = [m[pivote], m[c]];

    for (let f = 0; f < n; f++) {
      if (f === c) continue;

      const k = m[f][c] / m[c][c];

      for (let k2 = c; k2 <= n; k2++) m[f][k2] -= k * m[c][k2];
    }
  }

  return [...m.map((fila, i) => fila[n] / fila[i]), 1];
}

const aplica = (h: Matriz, p: Punto): Punto => {
  const w = h[6] * p.x + h[7] * p.y + h[8];

  return { x: (h[0] * p.x + h[1] * p.y + h[2]) / w, y: (h[3] * p.x + h[4] * p.y + h[5]) / w };
};

/* Las esquinas del área grande en la foto a 1920×1080 (medidas a mano). */
const AREA_M: Punto[] = [
  { x: 13.84, y: 0 },
  { x: 54.16, y: 0 },
  { x: 13.84, y: 16.5 },
  { x: 54.16, y: 16.5 },
];

const AREA_PX: Punto[] = [
  { x: 513 + FOTO_X, y: 222 },
  { x: 1353 + FOTO_X, y: 222 },
  { x: 443 + FOTO_X, y: 468 },
  { x: 1418 + FOTO_X, y: 468 },
];

const H_IDA = homografia(AREA_M, AREA_PX);
const H_VUELTA = homografia(AREA_PX, AREA_M);

export const aPx = (p: Punto) => aplica(H_IDA, p);

export const aMetros = (p: Punto) => {
  const m = aplica(H_VUELTA, p);

  return {
    x: Math.min(CAMPO_ANCHO + 3, Math.max(-3, m.x)),
    y: Math.min(CAMPO_FONDO + 10, Math.max(-2, m.y)),
  };
};

/** Píxeles por metro alrededor de un punto: de lejos, el campo encoge. */
export function escalaEn(p: Punto) {
  const c = aPx(p);
  const dx = aPx({ x: p.x + 1, y: p.y });
  const dy = aPx({ x: p.x, y: p.y + 1 });

  return { x: Math.hypot(dx.x - c.x, dx.y - c.y), y: Math.hypot(dy.x - c.x, dy.y - c.y) };
}

/* ------------------------------------------------------------------ */
/*  OPCIONES                                                           */
/* ------------------------------------------------------------------ */

/** Lo que la ficha necesita de un jugador. */
export type FichaLamina = {
  nombre: string;
  altura: string;
  edad: string;
  pie: string;
  foto: string;
};

export type RecursosLamina = {
  campo: string;
  logo: string;
  bold: string;
  semi: string;
};

export const RECURSOS: RecursosLamina = {
  campo: "/abp-campo-ancho.png",
  logo: "/logo.png",
  bold: "/fuentes/BarlowCondensed-Bold.ttf",
  semi: "/fuentes/BarlowCondensed-SemiBold.ttf",
};

export type OpcionesSvg = {
  /** Resuelve cada jugador de la lámina; `null` si ya no está en la hoja. */
  ficha: (clave: string, nombre: string) => FichaLamina | null;
  escudo?: string;
  /** Lo que se lee en la placa del rival de la cabecera. */
  equipo?: string;
  jornada?: string;
  /** La pantalla pinta las marcas aparte para poder arrastrarlas. */
  sinMarcas?: boolean;
  /** Para exportar van dentro, como `data:`; en pantalla, por su ruta. */
  recursos?: Partial<RecursosLamina>;
};

export const esc = (valor: string) =>
  valor
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");

const ORO = PIZARRA.oro;
const ORO_CLARO = PIZARRA.oroClaro;
const NOCHE = PIZARRA.noche;
const NOCHE_ALTO = PIZARRA.nocheAlto;

/* ------------------------------------------------------------------ */
/*  LAS MARCAS                                                         */
/* ------------------------------------------------------------------ */

const BALON: Record<ColorMarca, string> = {
  rojo: "#E46A6A",
  amarillo: "#E7D46A",
  azul: "#6F97EE",
  blanco: "#F4F4F4",
};

export function cruzSvg(cx: number, cy: number, color: ColorMarca, r = 17) {
  const d = `M ${cx - r} ${cy - r} L ${cx + r} ${cy + r} M ${cx + r} ${cy - r} L ${cx - r} ${cy + r}`;

  return `<path d="${d}" stroke="#081524" stroke-width="15" stroke-linecap="square" opacity=".9"/><path d="${d}" stroke="${COLORES[color]}" stroke-width="9" stroke-linecap="square"/>`;
}

export function balonSvg(cx: number, cy: number, color: ColorMarca) {
  const pentagono = Array.from({ length: 5 }, (_, i) => {
    const a = -Math.PI / 2 + (i * 2 * Math.PI) / 5;

    return `${cx + 6 * Math.cos(a)},${cy + 6 * Math.sin(a)}`;
  }).join(" ");

  return `<circle cx="${cx}" cy="${cy + 3}" r="16" fill="#000" opacity=".3"/><circle cx="${cx}" cy="${cy}" r="16" fill="${BALON[color]}" stroke="#2A2A2A" stroke-width="2.5"/><polygon points="${pentagono}" fill="#2A2A2A" opacity=".55"/><path d="M ${cx - 12} ${cy - 9} Q ${cx} ${cy - 16} ${cx + 12} ${cy - 9}" stroke="#2A2A2A" stroke-width="1.6" fill="none" opacity=".5"/>`;
}

/** Ancho del rótulo: sin medir texto, que en un SVG suelto no se puede. */
export const anchoEtiqueta = (texto: string) => Math.max(88, texto.length * 16 + 44);

export function etiquetaSvg(marca: Extract<Marca, { tipo: "etiqueta" }>) {
  const c = aPx(marca);
  const w = anchoEtiqueta(marca.texto);
  const h = 48;

  const lineas = marca.a
    .map((p) => {
      const destino = aPx(p);

      const desde = destino.y < c.y ? c.y - h / 2 : c.y + h / 2;

      return `<line x1="${c.x}" y1="${desde}" x2="${destino.x}" y2="${destino.y}" stroke="#081524" stroke-width="6" opacity=".35"/><line x1="${c.x}" y1="${desde}" x2="${destino.x}" y2="${destino.y}" stroke="#FFFFFF" stroke-width="3"/>`;
    })
    .join("");

  return `${lineas}<rect x="${c.x - w / 2}" y="${c.y - h / 2 + 4}" width="${w}" height="${h}" rx="6" fill="#000" opacity=".35"/><rect x="${c.x - w / 2}" y="${c.y - h / 2}" width="${w}" height="${h}" rx="6" fill="${NOCHE}" stroke="${ORO}" stroke-opacity=".7" stroke-width="1.5"/><rect x="${c.x - w / 2 + 10}" y="${c.y + h / 2 - 5}" width="${w - 20}" height="2" fill="${ORO}"/><text x="${c.x}" y="${c.y + 10}" text-anchor="middle" font-family="${FUENTE}" font-weight="700" font-size="29" letter-spacing="1" fill="#FFFFFF">${esc(marca.texto)}</text>`;
}

export function flechaSvg(marca: Extract<Marca, { tipo: "flecha" }>) {
  const a = aPx(marca);
  const b = aPx({ x: marca.x2, y: marca.y2 });
  const color = COLORES[marca.color];

  const ang = Math.atan2(b.y - a.y, b.x - a.x);
  const punta = (giro: number) =>
    `${b.x - 26 * Math.cos(ang + giro)},${b.y - 26 * Math.sin(ang + giro)}`;

  /* La línea acaba antes de la punta, o asoma por delante. */
  const fin = { x: b.x - 18 * Math.cos(ang), y: b.y - 18 * Math.sin(ang) };

  return `<line x1="${a.x}" y1="${a.y}" x2="${fin.x}" y2="${fin.y}" stroke="#081524" stroke-width="10" opacity=".3" stroke-linecap="round"/><line x1="${a.x}" y1="${a.y}" x2="${fin.x}" y2="${fin.y}" stroke="${color}" stroke-width="6" ${marca.discontinua ? 'stroke-dasharray="16 11"' : ""} stroke-linecap="round"/><polygon points="${b.x},${b.y} ${punta(0.42)} ${punta(-0.42)}" fill="${color}"/>`;
}

export function zonaSvg(marca: Extract<Marca, { tipo: "zona" }>) {
  const c = aPx(marca);
  const e = escalaEn(marca);
  const color = COLORES[marca.color];

  return `<ellipse cx="${c.x}" cy="${c.y}" rx="${marca.rx * e.x}" ry="${marca.ry * e.y}" fill="${color}" fill-opacity=".26" stroke="${color}" stroke-width="3" stroke-dasharray="10 7"/>`;
}

export function marcaSvg(marca: Marca) {
  switch (marca.tipo) {
    case "cruz": {
      const c = aPx(marca);

      return cruzSvg(c.x, c.y, marca.color);
    }
    case "balon": {
      const c = aPx(marca);

      return balonSvg(c.x, c.y, marca.color);
    }
    case "etiqueta":
      return etiquetaSvg(marca);
    case "flecha":
      return flechaSvg(marca);
    case "zona":
      return zonaSvg(marca);
  }
}

/** Zonas y flechas debajo; cruces, balones y rótulos encima. */
export const ordenPintado = (marca: Marca) =>
  marca.tipo === "zona" ? 0 : marca.tipo === "flecha" ? 1 : marca.tipo === "etiqueta" ? 3 : 2;

/* ------------------------------------------------------------------ */
/*  EL CROMO                                                           */
/* ------------------------------------------------------------------ */

function fuentes(r: RecursosLamina) {
  return `<style>@font-face{font-family:'Barlow Condensed Pizarra';font-weight:700;src:url('${esc(r.bold)}') format('truetype');}@font-face{font-family:'Barlow Condensed Pizarra';font-weight:600;src:url('${esc(r.semi)}') format('truetype');}</style>`;
}

function campo(r: RecursosLamina) {
  return `
  <rect width="${LAMINA_W}" height="${LAMINA_H}" fill="${PIZARRA.tinta}"/>
  <image href="${esc(r.campo)}" x="${FOTO_X}" y="0" width="${LAMINA_W}" height="${LAMINA_H}" preserveAspectRatio="none"/>
  <defs>
    <linearGradient id="veloV" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0" stop-color="${NOCHE}" stop-opacity=".46"/>
      <stop offset=".36" stop-color="${NOCHE}" stop-opacity=".06"/>
      <stop offset="1" stop-color="${NOCHE}" stop-opacity=".34"/>
    </linearGradient>
    <radialGradient id="veloR" cx=".42" cy=".36" r=".9">
      <stop offset=".4" stop-color="${NOCHE}" stop-opacity="0"/>
      <stop offset=".76" stop-color="${NOCHE}" stop-opacity=".32"/>
      <stop offset="1" stop-color="${NOCHE}" stop-opacity=".62"/>
    </radialGradient>
    <linearGradient id="veloD" x1="0" y1="0" x2="1" y2="0">
      <stop offset="0" stop-color="${NOCHE}" stop-opacity="0"/>
      <stop offset=".62" stop-color="${NOCHE}" stop-opacity="0"/>
      <stop offset=".76" stop-color="${NOCHE}" stop-opacity=".55"/>
      <stop offset=".88" stop-color="${NOCHE}" stop-opacity=".9"/>
      <stop offset="1" stop-color="${NOCHE}" stop-opacity=".96"/>
    </linearGradient>
    <clipPath id="tablero"><rect x="${TABLERO.x}" y="${TABLERO.y}" width="${TABLERO.w}" height="${TABLERO.h}"/></clipPath>
  </defs>
  <rect width="${LAMINA_W}" height="${LAMINA_H}" fill="url(#veloV)"/>
  <rect width="${LAMINA_W}" height="${LAMINA_H}" fill="url(#veloR)"/>
  <rect width="${LAMINA_W}" height="${LAMINA_H}" fill="url(#veloD)"/>`;
}

function cabecera(lamina: Lamina, opciones: OpcionesSvg, r: RecursosLamina) {
  const equipo = (opciones.equipo ?? "").toUpperCase();
  const pie = [opciones.jornada, "TEMPORADA 26 / 27"].filter(Boolean).join(" · ");

  /* La placa del rival crece con el nombre, como la de la pizarra. */
  const placaW = Math.min(440, Math.max(230, equipo.length * 15 + 60, pie.length * 9 + 50));
  const placaX = LAMINA_W - 32 - placaW;

  const escudo = opciones.escudo
    ? `<image href="${esc(opciones.escudo)}" x="${placaX - 78}" y="${CABECERA_H / 2 - 32}" width="64" height="64" preserveAspectRatio="xMidYMid meet"/>`
    : "";

  return `
  <defs>
    <linearGradient id="cabecera" x1="0" y1="0" x2="1" y2=".1">
      <stop offset="0" stop-color="${NOCHE}"/><stop offset=".52" stop-color="${NOCHE_ALTO}"/><stop offset="1" stop-color="${NOCHE}"/>
    </linearGradient>
    <linearGradient id="cabeceraOro" x1="0" y1="0" x2="1" y2="0">
      <stop offset="0" stop-color="${ORO}" stop-opacity="0"/><stop offset=".48" stop-color="${ORO}" stop-opacity=".10"/><stop offset="1" stop-color="${ORO}" stop-opacity=".24"/>
    </linearGradient>
    <linearGradient id="filo" x1="0" y1="0" x2="1" y2="0">
      <stop offset="0" stop-color="${ORO}"/><stop offset=".26" stop-color="${ORO_CLARO}"/><stop offset=".62" stop-color="${PIZARRA.rosa}"/><stop offset="1" stop-color="${ORO}" stop-opacity=".25"/>
    </linearGradient>
    <linearGradient id="divisor" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0" stop-color="${ORO}" stop-opacity="0"/><stop offset=".5" stop-color="${ORO}" stop-opacity=".6"/><stop offset="1" stop-color="${ORO}" stop-opacity="0"/>
    </linearGradient>
  </defs>
  <rect x="0" y="${CABECERA_H - 6}" width="${LAMINA_W}" height="30" fill="#000" opacity=".25"/>
  <rect width="${LAMINA_W}" height="${CABECERA_H}" fill="url(#cabecera)"/>
  <rect x="${LAMINA_W - 720}" width="720" height="${CABECERA_H}" fill="url(#cabeceraOro)"/>
  <circle cx="74" cy="${CABECERA_H / 2}" r="46" fill="#FFFFFF" fill-opacity=".04" stroke="${ORO}" stroke-opacity=".38"/>
  <image href="${esc(r.logo)}" x="42" y="${CABECERA_H / 2 - 32}" width="64" height="64" preserveAspectRatio="xMidYMid meet"/>
  <rect x="144" y="${CABECERA_H / 2 - 33}" width="1" height="66" fill="url(#divisor)"/>
  <text x="170" y="44" font-family="${FUENTE}" font-weight="600" font-size="13" letter-spacing="4.4" fill="${ORO}">REAL MADRID CF - CASTILLA · ANÁLISIS DEL RIVAL</text>
  <text x="170" y="94" font-family="${FUENTE}" font-weight="700" font-size="42" letter-spacing=".6" fill="#FFFFFF">${esc(lamina.titulo.toUpperCase())}</text>
  ${escudo}
  <rect x="${placaX}" y="${CABECERA_H / 2 - 38}" width="${placaW}" height="76" rx="12" fill="#FFFFFF" fill-opacity=".05" stroke="${ORO}" stroke-opacity=".32"/>
  <text x="${placaX + placaW - 20}" y="${CABECERA_H / 2 - 14}" text-anchor="end" font-family="${FUENTE}" font-weight="600" font-size="10" letter-spacing="3" fill="${ORO}" fill-opacity=".85">RIVAL</text>
  <text x="${placaX + placaW - 20}" y="${CABECERA_H / 2 + 12}" text-anchor="end" font-family="${FUENTE}" font-weight="700" font-size="24" letter-spacing="1.2" fill="#FFFFFF">${esc(equipo || "RIVAL")}</text>
  <text x="${placaX + placaW - 20}" y="${CABECERA_H / 2 + 30}" text-anchor="end" font-family="${FUENTE}" font-weight="600" font-size="10" letter-spacing="2.6" fill="#FFFFFF" fill-opacity=".45">${esc(pie)}</text>
  <rect x="0" y="${CABECERA_H}" width="${LAMINA_W}" height="5" fill="url(#filo)"/>`;
}

/** Un panel de cristal azul noche con su rótulo en oro, como «Asignaciones». */
function panel(y: number, alto: number, titulo: string, derecha = "") {
  return `<rect x="${COLUMNA.x}" y="${y + 6}" width="${COLUMNA.w}" height="${alto}" rx="16" fill="#000" opacity=".35"/><rect x="${COLUMNA.x}" y="${y}" width="${COLUMNA.w}" height="${alto}" rx="16" fill="${NOCHE}" fill-opacity=".92" stroke="${ORO}" stroke-opacity=".3"/><text x="${COLUMNA.x + 20}" y="${y + 28}" font-family="${FUENTE}" font-weight="600" font-size="12" letter-spacing="3.6" fill="${ORO}">${esc(titulo)}</text>${derecha ? `<text x="${COLUMNA.x + COLUMNA.w - 20}" y="${y + 28}" text-anchor="end" font-family="${FUENTE}" font-weight="600" font-size="12" fill="#FFFFFF" fill-opacity=".4">${esc(derecha)}</text>` : ""}<rect x="${COLUMNA.x + 20}" y="${y + 40}" width="${COLUMNA.w - 40}" height="1" fill="${ORO}" fill-opacity=".25"/>`;
}

function fichas(lamina: Lamina, opciones: OpcionesSvg, y0: number) {
  const lista = lamina.jugadores.slice(0, 6);

  if (!lista.length) return { svg: "", fin: y0 };

  const FILA = 112;
  const alto = 52 + lista.length * FILA;

  let svg = panel(y0, alto, (lamina.tituloJugadores || "JUGADORES CLAVE").toUpperCase(), String(lista.length));

  lista.forEach((jugador, i) => {
    const ficha = opciones.ficha(jugador.clave, jugador.nombre);

    /* El nombre de la lámina manda: en el vestuario es «IRU», no «IRURITA». */
    const nombre = (jugador.nombre || ficha?.nombre || "").toUpperCase();
    const dato = jugador.dato === "pie" ? (ficha?.pie ?? "") : ficha?.edad ? `${ficha.edad} AÑOS` : "";

    const y = y0 + 52 + i * FILA;
    const fx = COLUMNA.x + 20;

    svg += `<clipPath id="foto${i}"><rect x="${fx}" y="${y}" width="92" height="100" rx="10"/></clipPath>`;
    svg += `<rect x="${fx}" y="${y}" width="92" height="100" rx="10" fill="${NOCHE_ALTO}" stroke="${ORO}" stroke-opacity=".3"/>`;

    if (ficha?.foto) {
      svg += `<image href="${esc(ficha.foto)}" x="${fx - 4}" y="${y + 2}" width="100" height="104" preserveAspectRatio="xMidYMin slice" clip-path="url(#foto${i})"/>`;
    }

    const tx = fx + 112;

    svg += `<text x="${tx}" y="${y + 36}" font-family="${FUENTE}" font-weight="700" font-size="${nombre.length > 14 ? 22 : 26}" letter-spacing=".5" fill="#FFFFFF">${esc(nombre)}</text>`;

    const chapa = (texto: string, x: number) => {
      const w = texto.length * 10 + 18;

      return {
        svg: `<rect x="${x}" y="${y + 52}" width="${w}" height="26" rx="4" fill="${ORO}" fill-opacity=".16" stroke="${ORO}" stroke-opacity=".3"/><text x="${x + w / 2}" y="${y + 71}" text-anchor="middle" font-family="${FUENTE}" font-weight="700" font-size="17" letter-spacing=".6" fill="${ORO_CLARO}">${esc(texto)}</text>`,
        w,
      };
    };

    let x = tx;

    for (const texto of [ficha?.altura ?? "", dato].filter(Boolean)) {
      const c = chapa(texto, x);

      svg += c.svg;
      x += c.w + 8;
    }

    if (i < lista.length - 1) {
      svg += `<rect x="${fx}" y="${y + FILA - 6}" width="${COLUMNA.w - 40}" height="1" fill="${ORO}" fill-opacity=".12"/>`;
    }
  });

  return { svg, fin: y0 + alto };
}

function leyenda(lamina: Lamina, y0: number) {
  const usados = new Set(
    lamina.marcas
      .filter((m) => m.tipo === "cruz" || m.tipo === "balon")
      .map((m) => (m as { color: ColorMarca }).color),
  );

  const entradas = (Object.entries(lamina.leyenda ?? {}) as [ColorMarca, string][]).filter(
    ([color, texto]) => usados.has(color) && texto.trim(),
  );

  if (!entradas.length) return { svg: "", fin: y0 };

  const alto = 56 + entradas.length * 42;

  let svg = panel(y0, alto, "LEYENDA");

  entradas.forEach(([color, texto], i) => {
    const y = y0 + 74 + i * 42;

    svg += `${cruzSvg(COLUMNA.x + 40, y - 8, color, 12)}<text x="${COLUMNA.x + 68}" y="${y}" font-family="${FUENTE}" font-weight="700" font-size="21" letter-spacing=".6" fill="#FFFFFF">${esc(texto.toUpperCase())}</text>`;
  });

  return { svg, fin: y0 + alto };
}

/** Parte un texto en renglones de hasta `ancho` letras, por palabras. */
function renglones(texto: string, ancho: number) {
  const salida: string[] = [];

  for (const parrafo of texto.split(/\n+/)) {
    let actual = "";

    for (const palabra of parrafo.trim().split(/\s+/).filter(Boolean)) {
      if ((actual + " " + palabra).trim().length > ancho && actual) {
        salida.push(actual);
        actual = palabra;
      } else {
        actual = `${actual} ${palabra}`.trim();
      }
    }

    if (actual) salida.push(actual);
  }

  return salida;
}

/** La tarjeta blanca de consignas, con la viñeta de oro de la pizarra. */
function consignas(lamina: Lamina, y0: number) {
  const puntos = (lamina.notas ?? "")
    .split(/\n+/)
    .map((linea) => linea.replace(/^[-•·*]\s*/, "").trim())
    .filter(Boolean);

  if (!puntos.length) return "";

  const lineas = puntos.map((punto) => renglones(punto.toUpperCase(), 27));
  const total = lineas.reduce((n, l) => n + l.length, 0);

  const alto = Math.min(LAMINA_H - 20 - y0, 58 + total * 24 + puntos.length * 8);

  if (alto < 90) return "";

  let svg = `<clipPath id="consignas"><rect x="${COLUMNA.x}" y="${y0}" width="${COLUMNA.w}" height="${alto}" rx="16"/></clipPath>`;

  svg += `<rect x="${COLUMNA.x}" y="${y0 + 6}" width="${COLUMNA.w}" height="${alto}" rx="16" fill="#000" opacity=".35"/>`;
  svg += `<g clip-path="url(#consignas)"><rect x="${COLUMNA.x}" y="${y0}" width="${COLUMNA.w}" height="${alto}" fill="${PIZARRA.papel}"/><rect x="${COLUMNA.x}" y="${y0}" width="6" height="${alto}" fill="${ORO}"/>`;
  svg += `<text x="${COLUMNA.x + 26}" y="${y0 + 28}" font-family="${FUENTE}" font-weight="700" font-size="12" letter-spacing="3.6" fill="${ORO}">CONSIGNAS</text><rect x="${COLUMNA.x + 26}" y="${y0 + 38}" width="${COLUMNA.w - 50}" height="1" fill="${PIZARRA.navy}" fill-opacity=".12"/>`;

  let y = y0 + 64;

  lineas.forEach((grupo) => {
    svg += `<rect x="${COLUMNA.x + 26}" y="${y - 12}" width="7" height="7" rx="1" fill="${ORO}"/>`;

    grupo.forEach((renglon) => {
      svg += `<text x="${COLUMNA.x + 42}" y="${y}" font-family="${FUENTE}" font-weight="600" font-size="19" fill="${PIZARRA.navy}">${esc(renglon)}</text>`;
      y += 24;
    });

    y += 8;
  });

  svg += "</g>";

  return svg;
}

/* ------------------------------------------------------------------ */
/*  LA LÁMINA ENTERA                                                   */
/* ------------------------------------------------------------------ */

export function laminaSvg(lamina: Lamina, opciones: OpcionesSvg) {
  const r: RecursosLamina = { ...RECURSOS, ...opciones.recursos };

  const marcas = opciones.sinMarcas
    ? ""
    : [...lamina.marcas]
        .sort((a, b) => ordenPintado(a) - ordenPintado(b))
        .map(marcaSvg)
        .join("");

  const conFichas = fichas(lamina, opciones, TABLERO.y + 16);
  /* La leyenda va también en el fondo de la pantalla: sin ella la tarjeta de
     consignas se colocaba más arriba que en el PDF. */
  const conLeyenda = leyenda(lamina, conFichas.fin + (conFichas.svg ? 16 : 0));

  return `<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" viewBox="0 0 ${LAMINA_W} ${LAMINA_H}" width="${LAMINA_W}" height="${LAMINA_H}">
  ${fuentes(r)}
  ${campo(r)}
  <g clip-path="url(#tablero)">${marcas}</g>
  ${cabecera(lamina, opciones, r)}
  ${conFichas.svg}
  ${conLeyenda.svg}
  ${consignas(lamina, conLeyenda.fin + (conLeyenda.svg || conFichas.svg ? 16 : 0))}
</svg>`;
}

/* ------------------------------------------------------------------ */
/*  A IMAGEN                                                           */
/* ------------------------------------------------------------------ */

/**
 * Trae una imagen o una fuente como `data:`.
 *
 * Un SVG que se pinta como imagen NO carga nada de fuera: o lleva las fotos y
 * las letras dentro o salen huecas. Las fotos de BeSoccer, además, no traen
 * CORS y tienen que pasar por `/api/rivals/foto`.
 */
export async function aDataUrl(url: string): Promise<string> {
  if (!url || url.startsWith("data:")) return url;

  const deCasa = url.startsWith("/") || url.startsWith(window.location.origin);

  try {
    const respuesta = await fetch(
      deCasa ? url : `/api/rivals/foto?url=${encodeURIComponent(url)}`,
    );

    if (!respuesta.ok) return "";

    const blob = await respuesta.blob();

    return await new Promise<string>((resolve) => {
      const lector = new FileReader();

      lector.onload = () => resolve(String(lector.result ?? ""));
      lector.onerror = () => resolve("");
      lector.readAsDataURL(blob);
    });
  } catch {
    return "";
  }
}

/* Las fuentes, el campo y el escudo son los mismos en todas las láminas: se
   traen una vez por pestaña. */
const cacheRecursos = new Map<string, Promise<string>>();

const recurso = (url: string) => {
  if (!cacheRecursos.has(url)) cacheRecursos.set(url, aDataUrl(url));

  return cacheRecursos.get(url) as Promise<string>;
};

/**
 * La lámina como imagen, lista para un PDF, un PPT o un correo.
 *
 * `ancho` manda el tamaño final: 1920 para proyectar, menos para el correo.
 */
export async function laminaImagen(
  lamina: Lamina,
  opciones: OpcionesSvg,
  salida: Salida = {},
): Promise<string> {
  const fichasConFoto = new Map<string, FichaLamina | null>();

  for (const jugador of lamina.jugadores) {
    const ficha = opciones.ficha(jugador.clave, jugador.nombre);

    fichasConFoto.set(
      jugador.clave || jugador.nombre,
      ficha ? { ...ficha, foto: ficha.foto ? await recurso(ficha.foto) : "" } : null,
    );
  }

  const [campo, logo, bold, semi, escudo] = await Promise.all([
    recurso(RECURSOS.campo),
    recurso(RECURSOS.logo),
    recurso(RECURSOS.bold),
    recurso(RECURSOS.semi),
    opciones.escudo ? recurso(opciones.escudo) : Promise.resolve(""),
  ]);

  const svg = laminaSvg(lamina, {
    ...opciones,
    escudo,
    recursos: { campo, logo, bold, semi },
    ficha: (clave, nombre) => fichasConFoto.get(clave || nombre) ?? null,
  });

  return svgAImagen(svg, salida);
}

type Salida = { ancho?: number; formato?: "image/png" | "image/jpeg" };

/** Un SVG de 1920×1080 ya autosuficiente, pasado a imagen. */
async function svgAImagen(svg: string, salida: Salida): Promise<string> {
  const url = URL.createObjectURL(new Blob([svg], { type: "image/svg+xml" }));

  try {
    const img = await new Promise<HTMLImageElement>((resolve, reject) => {
      const imagen = new Image();

      imagen.onload = () => resolve(imagen);
      imagen.onerror = () => reject(new Error("No se ha podido dibujar la lámina."));
      imagen.src = url;
    });

    /* Una fuente dentro de un SVG-imagen se carga aparte: se le da un respiro
       para que no salga el primer dibujo con la letra de sistema. */
    await new Promise((resolve) => setTimeout(resolve, 60));

    const ancho = salida.ancho ?? LAMINA_W;
    const lienzo = document.createElement("canvas");

    lienzo.width = ancho;
    lienzo.height = Math.round((ancho * LAMINA_H) / LAMINA_W);

    const ctx = lienzo.getContext("2d");

    if (!ctx) throw new Error("El navegador no deja dibujar.");

    ctx.fillStyle = PIZARRA.tinta;
    ctx.fillRect(0, 0, lienzo.width, lienzo.height);
    ctx.drawImage(img, 0, 0, lienzo.width, lienzo.height);

    const formato = salida.formato ?? "image/png";

    return lienzo.toDataURL(formato, formato === "image/jpeg" ? 0.92 : undefined);
  } finally {
    URL.revokeObjectURL(url);
  }
}
