/**
 * LA LÁMINA DE ANÁLISIS, DIBUJADA.
 *
 * Una sola función pinta la lámina entera como texto SVG a 1920×1080, con el
 * aspecto de los informes del cuerpo técnico: barra azul noche con el título,
 * medio campo verde con la portería arriba y las fichas de los jugadores a la
 * derecha. De esa misma cadena sale todo:
 *
 * - la pantalla la usa de fondo y pone encima las marcas que se arrastran;
 * - el PDF, el PPT y el informe del microciclo la pasan a imagen.
 *
 * Tener un segundo dibujo «para exportar» era garantizar que un día la
 * pantalla y el documento no dijesen lo mismo.
 *
 * Las fuentes son de sistema a propósito: un SVG que se pinta como imagen no
 * puede pedir fuentes de fuera, y con una web se quedaría en la de por defecto.
 */

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

export const NAVY = "#0E1F5B";

const FUENTE = "Calibri, 'Segoe UI', Arial, sans-serif";

/** El recuadro verde, en píxeles de la lámina. */
export const TABLERO = { x: 36, y: 100, w: 1464, h: 950 };

/** Píxeles por metro: el medio campo entero tiene que caber a lo alto. */
export const ESCALA = 20.2;

const PX0 = TABLERO.x + (TABLERO.w - CAMPO_ANCHO * ESCALA) / 2;
const PY0 = TABLERO.y + 34;

export const aPx = (p: Punto) => ({ x: PX0 + p.x * ESCALA, y: PY0 + p.y * ESCALA });

export const aMetros = (p: Punto) => ({
  x: Math.min(CAMPO_ANCHO + 1.5, Math.max(-1.5, (p.x - PX0) / ESCALA)),
  y: Math.min(CAMPO_FONDO + 0.3, Math.max(-1.5, (p.y - PY0) / ESCALA)),
});

/** Lo que la ficha necesita de un jugador. */
export type FichaLamina = {
  nombre: string;
  altura: string;
  edad: string;
  pie: string;
  foto: string;
};

export type OpcionesSvg = {
  /** Resuelve cada jugador de la lámina; `null` si ya no está en la hoja. */
  ficha: (clave: string, nombre: string) => FichaLamina | null;
  escudo?: string;
  /** La pantalla pinta las marcas aparte para poder arrastrarlas. */
  sinMarcas?: boolean;
};

export const esc = (valor: string) =>
  valor
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");

/* ------------------------------------------------------------------ */
/*  EL CAMPO                                                           */
/* ------------------------------------------------------------------ */

function campo() {
  const { x, y, w, h } = TABLERO;

  const linea = `stroke="#FFFFFF" stroke-width="4" fill="none"`;

  const px = (m: number) => m * ESCALA;

  const izq = PX0;
  const der = PX0 + px(CAMPO_ANCHO);
  const fondo = PY0;
  const centro = PX0 + px(CAMPO_ANCHO / 2);

  const franjas = Array.from({ length: 10 }, (_, i) =>
    i % 2
      ? `<rect x="${x}" y="${y + (i * h) / 10}" width="${w}" height="${h / 10}" fill="#000" opacity=".045"/>`
      : "",
  ).join("");

  const area = { w: px(40.32), h: px(16.5) };
  const chica = { w: px(18.32), h: px(5.5) };
  const porteria = px(7.32);
  const penalti = { x: centro, y: fondo + px(11) };
  const radio = px(9.15);

  /* El arco del área: sólo lo que queda fuera de ella. */
  const dy = fondo + area.h - penalti.y;
  const dx = Math.sqrt(radio * radio - dy * dy);

  /* La red, a rombos, como en la plantilla del club. */
  const red = Array.from({ length: 14 }, (_, i) => {
    const xi = centro - porteria / 2 + (i * porteria) / 13;

    return `<line x1="${xi}" y1="${fondo - 30}" x2="${xi}" y2="${fondo}" stroke="#FFFFFF" stroke-width="1.2" opacity=".75"/>`;
  }).join("");

  const redH = [0.25, 0.5, 0.75]
    .map(
      (t) =>
        `<line x1="${centro - porteria / 2}" y1="${fondo - 30 * t}" x2="${centro + porteria / 2}" y2="${fondo - 30 * t}" stroke="#FFFFFF" stroke-width="1.2" opacity=".75"/>`,
    )
    .join("");

  const medio = PY0 + px(52.5);

  return `
  <defs><clipPath id="tablero"><rect x="${x}" y="${y}" width="${w}" height="${h}"/></clipPath></defs>
  <rect x="${x}" y="${y}" width="${w}" height="${h}" fill="#1D7A1F"/>
  ${franjas}
  <g clip-path="url(#tablero)">
    <rect x="${izq}" y="${fondo}" width="${der - izq}" height="${px(60)}" ${linea}/>
    <rect x="${centro - area.w / 2}" y="${fondo}" width="${area.w}" height="${area.h}" ${linea}/>
    <rect x="${centro - chica.w / 2}" y="${fondo}" width="${chica.w}" height="${chica.h}" ${linea}/>
    <circle cx="${penalti.x}" cy="${penalti.y}" r="5" fill="#FFFFFF"/>
    <path d="M ${penalti.x - dx} ${fondo + area.h} A ${radio} ${radio} 0 0 0 ${penalti.x + dx} ${fondo + area.h}" ${linea}/>
    <path d="M ${izq + px(1)} ${fondo} A ${px(1)} ${px(1)} 0 0 1 ${izq} ${fondo + px(1)}" ${linea}/>
    <path d="M ${der - px(1)} ${fondo} A ${px(1)} ${px(1)} 0 0 0 ${der} ${fondo + px(1)}" ${linea}/>
    <circle cx="${centro}" cy="${medio}" r="${radio}" ${linea}/>
    <line x1="${izq}" y1="${medio}" x2="${der}" y2="${medio}" stroke="#FFFFFF" stroke-width="4"/>
    <rect x="${centro - porteria / 2}" y="${fondo - 30}" width="${porteria}" height="30" fill="#FFFFFF" fill-opacity=".12" stroke="#FFFFFF" stroke-width="4"/>
    ${red}${redH}
  </g>`;
}

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

  return `<path d="${d}" stroke="#111" stroke-width="15" stroke-linecap="square"/><path d="${d}" stroke="${COLORES[color]}" stroke-width="9" stroke-linecap="square"/>`;
}

export function balonSvg(cx: number, cy: number, color: ColorMarca) {
  const pentagono = Array.from({ length: 5 }, (_, i) => {
    const a = -Math.PI / 2 + (i * 2 * Math.PI) / 5;

    return `${cx + 6 * Math.cos(a)},${cy + 6 * Math.sin(a)}`;
  }).join(" ");

  return `<circle cx="${cx}" cy="${cy}" r="16" fill="${BALON[color]}" stroke="#3A3A3A" stroke-width="2.5"/><polygon points="${pentagono}" fill="#3A3A3A" opacity=".55"/><path d="M ${cx - 12} ${cy - 9} Q ${cx} ${cy - 16} ${cx + 12} ${cy - 9}" stroke="#3A3A3A" stroke-width="1.6" fill="none" opacity=".5"/>`;
}

/** Ancho del rótulo: sin medir texto, que en un SVG suelto no se puede. */
export const anchoEtiqueta = (texto: string) => Math.max(90, texto.length * 17 + 44);

export function etiquetaSvg(marca: Extract<Marca, { tipo: "etiqueta" }>) {
  const c = aPx(marca);
  const w = anchoEtiqueta(marca.texto);
  const h = 48;

  const lineas = marca.a
    .map((p) => {
      const destino = aPx(p);

      const desde = destino.y < c.y ? c.y - h / 2 : c.y + h / 2;

      return `<line x1="${c.x}" y1="${desde}" x2="${destino.x}" y2="${destino.y}" stroke="#FFFFFF" stroke-width="3"/>`;
    })
    .join("");

  return `${lineas}<rect x="${c.x - w / 2}" y="${c.y - h / 2}" width="${w}" height="${h}" fill="${NAVY}"/><text x="${c.x}" y="${c.y + 10}" text-anchor="middle" font-family="${FUENTE}" font-weight="700" font-size="29" fill="#FFFFFF">${esc(marca.texto)}</text>`;
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

  return `<line x1="${a.x}" y1="${a.y}" x2="${fin.x}" y2="${fin.y}" stroke="${color}" stroke-width="6" ${marca.discontinua ? 'stroke-dasharray="16 11"' : ""} stroke-linecap="round"/><polygon points="${b.x},${b.y} ${punta(0.42)} ${punta(-0.42)}" fill="${color}"/>`;
}

export function zonaSvg(marca: Extract<Marca, { tipo: "zona" }>) {
  const c = aPx(marca);
  const color = COLORES[marca.color];

  return `<ellipse cx="${c.x}" cy="${c.y}" rx="${marca.rx * ESCALA}" ry="${marca.ry * ESCALA}" fill="${color}" fill-opacity=".28" stroke="${color}" stroke-width="3" stroke-dasharray="10 7"/>`;
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
/*  LA LEYENDA Y LAS FICHAS                                            */
/* ------------------------------------------------------------------ */

function leyenda(lamina: Lamina) {
  const usados = new Set(
    lamina.marcas
      .filter((m) => m.tipo === "cruz" || m.tipo === "balon")
      .map((m) => (m as { color: ColorMarca }).color),
  );

  const entradas = (Object.entries(lamina.leyenda ?? {}) as [ColorMarca, string][]).filter(
    ([color, texto]) => usados.has(color) && texto.trim(),
  );

  if (!entradas.length) return "";

  const paso = Math.min(460, TABLERO.w / entradas.length);
  const inicio = TABLERO.x + TABLERO.w / 2 - (paso * entradas.length) / 2;
  const y = TABLERO.y + TABLERO.h - 46;

  return entradas
    .map(([color, texto], i) => {
      const x = inicio + i * paso + paso / 2 - 110;
      const w = anchoEtiqueta(texto.toUpperCase());

      return `${cruzSvg(x, y, color, 16)}<rect x="${x + 34}" y="${y - 23}" width="${w}" height="46" fill="${NAVY}"/><text x="${x + 34 + w / 2}" y="${y + 10}" text-anchor="middle" font-family="${FUENTE}" font-weight="700" font-size="27" fill="#FFFFFF">${esc(texto.toUpperCase())}</text>`;
    })
    .join("");
}

/** Parte un título largo en dos renglones por la palabra más centrada. */
function dosRenglones(texto: string): string[] {
  if (texto.length <= 18) return [texto];

  const palabras = texto.split(/\s+/);

  let mejor = 1;
  let diferencia = Infinity;

  for (let i = 1; i < palabras.length; i++) {
    const d = Math.abs(palabras.slice(0, i).join(" ").length - palabras.slice(i).join(" ").length);

    if (d < diferencia) {
      diferencia = d;
      mejor = i;
    }
  }

  return [palabras.slice(0, mejor).join(" "), palabras.slice(mejor).join(" ")];
}

export const PANEL_X = 1516;
const PANEL_W = LAMINA_W - 20 - PANEL_X;

function fichas(lamina: Lamina, opciones: OpcionesSvg) {
  let y = TABLERO.y;

  let salida = "";

  const titulo = (lamina.tituloJugadores ?? "").trim().toUpperCase();

  if (titulo) {
    const renglones = dosRenglones(titulo);
    const alto = renglones.length * 40 + 24;

    salida += `<rect x="${PANEL_X}" y="${y}" width="${PANEL_W}" height="${alto}" fill="${NAVY}"/>`;

    renglones.forEach((renglon, i) => {
      salida += `<text x="${PANEL_X + PANEL_W / 2}" y="${y + 44 + i * 40}" text-anchor="middle" font-family="${FUENTE}" font-weight="700" font-size="31" fill="#FFFFFF">${esc(renglon)}</text>`;
    });

    y += alto + 10;
  }

  const ALTO = 142;
  const caben = Math.floor((TABLERO.y + TABLERO.h - y) / (ALTO + 8));

  lamina.jugadores.slice(0, caben).forEach((jugador, i) => {
    const ficha = opciones.ficha(jugador.clave, jugador.nombre);

    /* El nombre de la lámina manda: en el vestuario es «IRU», no «IRURITA». */
    const nombre = (jugador.nombre || ficha?.nombre || "").toUpperCase();
    const dato = jugador.dato === "pie" ? (ficha?.pie ?? "") : ficha?.edad ? `${ficha.edad} AÑOS` : "";

    const fy = y + i * (ALTO + 8);
    const fotoW = 128;
    const bx = PANEL_X + fotoW + 8;
    const bw = PANEL_W - fotoW - 8;
    const fila = (ALTO - 10) / 3;

    salida += `<clipPath id="foto${i}"><rect x="${PANEL_X}" y="${fy}" width="${fotoW}" height="${ALTO}"/></clipPath>`;

    salida += ficha?.foto
      ? `<image href="${esc(ficha.foto)}" x="${PANEL_X - 6}" y="${fy}" width="${fotoW + 12}" height="${ALTO + 12}" preserveAspectRatio="xMidYMin slice" clip-path="url(#foto${i})"/>`
      : `<rect x="${PANEL_X}" y="${fy}" width="${fotoW}" height="${ALTO}" fill="#DADDE8"/>`;

    salida += `<rect x="${bx}" y="${fy}" width="${bw}" height="${fila}" fill="${NAVY}"/><text x="${bx + bw / 2}" y="${fy + fila / 2 + 10}" text-anchor="middle" font-family="${FUENTE}" font-weight="700" font-size="${nombre.length > 13 ? 23 : 27}" fill="#FFFFFF">${esc(nombre)}</text>`;

    salida += `<rect x="${bx}" y="${fy + fila + 5}" width="${bw}" height="${fila}" fill="#CDD3EA"/><text x="${bx + bw / 2}" y="${fy + fila * 1.5 + 14}" text-anchor="middle" font-family="${FUENTE}" font-size="27" fill="#1B2440">${esc(ficha?.altura ?? "")}</text>`;

    salida += `<rect x="${bx}" y="${fy + 2 * fila + 10}" width="${bw}" height="${fila}" fill="#E6E8F2"/><text x="${bx + bw / 2}" y="${fy + fila * 2.5 + 19}" text-anchor="middle" font-family="${FUENTE}" font-size="27" fill="#1B2440">${esc(dato)}</text>`;
  });

  return salida;
}

/* ------------------------------------------------------------------ */
/*  LA LÁMINA ENTERA                                                   */
/* ------------------------------------------------------------------ */

export function laminaSvg(lamina: Lamina, opciones: OpcionesSvg) {
  /* Sin fichas, el campo se queda con todo el ancho de la barra de título. */
  const marcas = opciones.sinMarcas
    ? ""
    : [...lamina.marcas]
        .sort((a, b) => ordenPintado(a) - ordenPintado(b))
        .map(marcaSvg)
        .join("");

  const escudo = opciones.escudo
    ? `<image href="${esc(opciones.escudo)}" x="22" y="16" width="64" height="72" preserveAspectRatio="xMidYMid meet"/>`
    : "";

  return `<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" viewBox="0 0 ${LAMINA_W} ${LAMINA_H}" width="${LAMINA_W}" height="${LAMINA_H}">
  <rect width="${LAMINA_W}" height="${LAMINA_H}" fill="#FFFFFF"/>
  ${escudo}
  <rect x="100" y="22" width="${LAMINA_W - 120}" height="58" fill="${NAVY}"/>
  <text x="${100 + (LAMINA_W - 120) / 2}" y="62" text-anchor="middle" font-family="${FUENTE}" font-weight="700" font-size="31" fill="#FFFFFF" letter-spacing="1">${esc(lamina.titulo.toUpperCase())}</text>
  ${campo()}
  <g clip-path="url(#tablero)">${marcas}</g>
  ${opciones.sinMarcas ? "" : leyenda(lamina)}
  ${fichas(lamina, opciones)}
</svg>`;
}

/* ------------------------------------------------------------------ */
/*  A IMAGEN                                                           */
/* ------------------------------------------------------------------ */

/**
 * Trae una imagen como `data:`.
 *
 * Un SVG que se pinta como imagen NO carga nada de fuera: o lleva las fotos
 * dentro o salen huecas. Las de BeSoccer, además, no traen CORS y tienen que
 * pasar por `/api/rivals/foto`.
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

/**
 * La lámina como imagen, lista para un PDF, un PPT o un correo.
 *
 * `ancho` manda el tamaño final: 1920 para proyectar, menos para el correo.
 */
export async function laminaImagen(
  lamina: Lamina,
  opciones: OpcionesSvg,
  salida: { ancho?: number; formato?: "image/png" | "image/jpeg" } = {},
): Promise<string> {
  const cache = new Map<string, string>();

  const incrusta = async (url: string) => {
    if (!url) return "";

    if (!cache.has(url)) cache.set(url, await aDataUrl(url));

    return cache.get(url) ?? "";
  };

  /* Primero se traen todas las fotos y luego se dibuja con ellas dentro. */
  const fichasConFoto = new Map<string, FichaLamina | null>();

  for (const jugador of lamina.jugadores) {
    const ficha = opciones.ficha(jugador.clave, jugador.nombre);

    fichasConFoto.set(
      jugador.clave || jugador.nombre,
      ficha ? { ...ficha, foto: await incrusta(ficha.foto) } : null,
    );
  }

  const escudo = opciones.escudo ? await incrusta(opciones.escudo) : "";

  const svg = laminaSvg(lamina, {
    ...opciones,
    escudo,
    ficha: (clave, nombre) => fichasConFoto.get(clave || nombre) ?? null,
  });

  const url = URL.createObjectURL(new Blob([svg], { type: "image/svg+xml" }));

  try {
    const img = await new Promise<HTMLImageElement>((resolve, reject) => {
      const imagen = new Image();

      imagen.onload = () => resolve(imagen);
      imagen.onerror = () => reject(new Error("No se ha podido dibujar la lámina."));
      imagen.src = url;
    });

    const ancho = salida.ancho ?? LAMINA_W;
    const lienzo = document.createElement("canvas");

    lienzo.width = ancho;
    lienzo.height = Math.round((ancho * LAMINA_H) / LAMINA_W);

    const ctx = lienzo.getContext("2d");

    if (!ctx) throw new Error("El navegador no deja dibujar.");

    ctx.fillStyle = "#FFFFFF";
    ctx.fillRect(0, 0, lienzo.width, lienzo.height);
    ctx.drawImage(img, 0, 0, lienzo.width, lienzo.height);

    const formato = salida.formato ?? "image/png";

    return lienzo.toDataURL(formato, formato === "image/jpeg" ? 0.92 : undefined);
  } finally {
    URL.revokeObjectURL(url);
  }
}
