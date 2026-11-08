/**
 * PDF de la ficha individual (08/11/2026).
 *
 * Desde /individual se puede sacar en PDF la ficha completa de un jugador o
 * una sola pestaña (por ejemplo «Área de mejora"). Se fotografía lo que la
 * pantalla ya pinta, así que el PDF dice exactamente lo mismo que la ficha.
 *
 * Cómo se reparte en páginas: cada sección se fotografía **bloque a bloque**
 * (sus hijos directos) y los bloques se apilan en hojas A4 verticales sin
 * partirlos; sólo un bloque más alto que una hoja entera se corta. Así no
 * salen tarjetas partidas por la mitad, que es lo que pasaba al cortar una
 * foto larga a tiras.
 *
 * Cada hoja lleva al pie el jugador, la sección y la página. Lo marcado con
 * `data-export-hide` (botones de edición) no sale.
 */
import { capturaNodo, fuentesListas, respira } from "@/lib/export/captura";
import { apodo, descarga, esperaFotos, PIXEL_VACIO, type HojaPdf } from "@/lib/export/lienzos";

export type SeccionFicha = {
  titulo: string;
  nodo: HTMLElement;
};

/** A4 vertical en puntos, con los mismos márgenes y pie que `pdfDeHojas`. */
const A4 = { ancho: 595.28, alto: 841.89, margen: 26, pie: 26 };
const PROPORCION = (A4.alto - A4.margen * 2 - A4.pie) / (A4.ancho - A4.margen * 2);
const NITIDEZ = 2;
const HUECO = 16; // px CSS entre bloques

/** El primer color de fondo opaco subiendo desde el nodo: el del modo día o el de noche. */
export function fondoDe(nodo: HTMLElement) {
  let actual: HTMLElement | null = nodo;

  while (actual) {
    const color = getComputedStyle(actual).backgroundColor;

    if (color && color !== "transparent" && !/rgba\([^)]*,\s*0\)$/.test(color)) return color;

    actual = actual.parentElement;
  }

  return "#0B0F14";
}

/** Los bloques de una sección: sus hijos visibles; si sólo tiene uno, los de ese. */
function bloquesDe(nodo: HTMLElement): HTMLElement[] {
  let raiz = nodo;

  for (let vuelta = 0; vuelta < 3; vuelta++) {
    const hijos = visibles(raiz);

    if (hijos.length !== 1) break;

    raiz = hijos[0];
  }

  const hijos = visibles(raiz);

  return hijos.length ? hijos : [raiz];
}

function visibles(nodo: HTMLElement) {
  return Array.from(nodo.children).filter(
    (hijo): hijo is HTMLElement =>
      hijo instanceof HTMLElement &&
      !hijo.hasAttribute("data-export-hide") &&
      hijo.getBoundingClientRect().height > 1,
  );
}

function cargaImagen(dataUrl: string) {
  return new Promise<HTMLImageElement>((listo, falla) => {
    const imagen = new Image();

    imagen.onload = () => listo(imagen);
    imagen.onerror = () => falla(new Error("No se pudo leer la captura"));
    imagen.src = dataUrl;
  });
}

type Bloque = { imagen: HTMLImageElement; ancho: number; alto: number; nitidez: number };

/**
 * Apila los bloques en hojas. Devuelve una imagen JPEG por hoja, con la
 * proporción exacta del hueco útil del A4.
 */
function apila(bloques: Bloque[], anchoCss: number, fondo: string) {
  const altoHojaCss = Math.floor(anchoCss * PROPORCION);
  const hojas: string[] = [];

  let lienzo: HTMLCanvasElement | null = null;
  let ctx: CanvasRenderingContext2D | null = null;
  let y = 0;

  const nueva = () => {
    if (lienzo) hojas.push(lienzo.toDataURL("image/jpeg", 0.9));

    lienzo = document.createElement("canvas");
    lienzo.width = Math.round(anchoCss * NITIDEZ);
    lienzo.height = Math.round(altoHojaCss * NITIDEZ);
    ctx = lienzo.getContext("2d");

    if (!ctx) throw new Error("El navegador no deja dibujar el PDF.");

    ctx.fillStyle = fondo;
    ctx.fillRect(0, 0, lienzo.width, lienzo.height);
    y = 0;
  };

  nueva();

  for (const bloque of bloques) {
    /* Los bloques se dibujan a su ancho real (≤ ancho de la sección). */
    const escala = Math.min(1, anchoCss / bloque.ancho);
    const alto = bloque.alto * escala;
    const ancho = bloque.ancho * escala;

    if (alto <= altoHojaCss) {
      if (y > 0 && y + alto > altoHojaCss) nueva();

      ctx!.drawImage(bloque.imagen, 0, y * NITIDEZ, ancho * NITIDEZ, alto * NITIDEZ);
      y += alto + HUECO;
      continue;
    }

    /* Más alto que una hoja: se corta a tiras, cada una en su hoja. */
    if (y > 0) nueva();

    const fuentePorCss = bloque.imagen.naturalHeight / alto;

    for (let desde = 0; desde < alto; desde += altoHojaCss) {
      if (desde > 0) nueva();

      const tramo = Math.min(altoHojaCss, alto - desde);

      ctx!.drawImage(
        bloque.imagen,
        0,
        desde * fuentePorCss,
        bloque.imagen.naturalWidth,
        tramo * fuentePorCss,
        0,
        0,
        ancho * NITIDEZ,
        tramo * NITIDEZ,
      );
      y = tramo + HUECO;
    }
  }

  if (lienzo && y > 0) hojas.push((lienzo as HTMLCanvasElement).toDataURL("image/jpeg", 0.9));

  return { hojas, anchoCss, altoHojaCss };
}

/**
 * Mandos de pantalla que en papel sobran: botones y enlaces cortos con icono
 * («Editar perfil», la papelera, el selector «Radiografía ▾»), campos de texto
 * y desplegables. Las filas pulsables con contenido (un partido, un jugador)
 * llevan texto largo y se quedan.
 */
function esMando(nodo: HTMLElement) {
  const tag = nodo.tagName;

  if (tag === "INPUT" || tag === "SELECT" || tag === "TEXTAREA") return true;

  /* El «Ver como ▾» de los gráficos: una etiqueta que envuelve el desplegable. */
  if (tag === "LABEL" && nodo.querySelector("select, input")) return true;

  if (tag !== "BUTTON" && tag !== "A") return false;

  return (nodo.textContent ?? "").trim().length < 32 && Boolean(nodo.querySelector("svg"));
}

/** Lo que una pestaña pinta mientras lee sus datos. */
const CARGANDO = /^(cargando|leyendo|actualizando|buscando|preparando)\b/i;

function sigueCargando(nodo: HTMLElement) {
  if (nodo.querySelector(".animate-spin, .animate-pulse")) return true;

  const textos = nodo.querySelectorAll<HTMLElement>("p, span, div");

  for (const el of textos) {
    if (el.children.length === 0 && CARGANDO.test(el.textContent?.trim() ?? "")) return true;
  }

  return false;
}

/**
 * Espera a que las pestañas recién montadas terminen de leer (Wyscout, la
 * hoja…). Sin esto el PDF salía con «Leyendo los datos de Wyscout…» en vez del
 * área de mejora. Con tope: lo que no llegue en ese tiempo sale como esté.
 */
export async function esperaDatos(nodos: HTMLElement[], tope = 60_000) {
  const desde = Date.now();

  await new Promise((r) => setTimeout(r, 800));

  while (Date.now() - desde < tope) {
    if (!nodos.some((nodo) => nodo.isConnected && sigueCargando(nodo))) {
      /* Un respiro más: un gráfico se dibuja después de llegar los datos. */
      await new Promise((r) => setTimeout(r, 600));

      if (!nodos.some((nodo) => nodo.isConnected && sigueCargando(nodo))) return true;
    }

    await new Promise((r) => setTimeout(r, 500));
  }

  return false;
}

export async function exportaFichaPdf(opciones: {
  jugador: string;
  /** Lo que sale en el nombre del fichero y en el pie: «Ficha completa», «Área de mejora»… */
  alcance: string;
  secciones: SeccionFicha[];
  alPaso?: (texto: string) => void;
}) {
  const { jugador, alcance, secciones, alPaso } = opciones;

  if (!secciones.length) throw new Error("No hay nada que exportar en esta ficha.");

  alPaso?.("Esperando a que carguen los datos…");

  await esperaDatos(secciones.map((s) => s.nodo));

  await fuentesListas();

  for (const seccion of secciones) await esperaFotos(seccion.nodo);

  await respira(2);

  const fondo = fondoDe(secciones[0].nodo);
  const fecha = new Date().toLocaleDateString("es-ES");
  const hojasPdf: HojaPdf[] = [];

  const comunes = {
    backgroundColor: fondo,
    imagePlaceholder: PIXEL_VACIO,
    includeQueryParams: true,
    pixelRatio: NITIDEZ,
    formato: "png" as const,
    filter: (nodo: HTMLElement) => !(nodo instanceof HTMLElement) || (!nodo.hasAttribute("data-export-hide") && !esMando(nodo)),
  };

  /* Sin animaciones mientras se fotografía: la foto copia el estilo de cada
     nodo y la animación de entrada vuelve a empezar dentro de la imagen; los
     radares salían vacíos (opacidad 0 del primer fotograma). */
  const quieto = document.createElement("style");
  quieto.textContent = "[data-ficha-seccion] *, [data-ficha-seccion] *::before, [data-ficha-seccion] *::after { animation: none !important; transition: none !important; }";
  document.head.appendChild(quieto);

  /* Los gráficos que traen su propio <style> dentro del SVG (la radiografía)
     se copian tal cual en la foto, y ahí la animación empieza de cero: se
     les quita mientras dura la exportación y se les devuelve después. */
  const estilosPropios = secciones.flatMap((s) => Array.from(s.nodo.querySelectorAll("style")));
  const originales = estilosPropios.map((el) => el.textContent ?? "");

  estilosPropios.forEach((el, i) => {
    el.textContent = originales[i].replace(/animation(-[a-z-]+)?\s*:[^;}]+;?/g, "");
  });

  try {
    await capturaSecciones();
  } finally {
    quieto.remove();
    estilosPropios.forEach((el, i) => {
      el.textContent = originales[i];
    });
  }

  async function capturaSecciones() {
  for (const [orden, seccion] of secciones.entries()) {
    alPaso?.(`Preparando ${seccion.titulo.toLowerCase()} (${orden + 1} de ${secciones.length})…`);

    const anchoCss = Math.ceil(seccion.nodo.getBoundingClientRect().width);
    const bloques: Bloque[] = [];

    for (const nodo of bloquesDe(seccion.nodo)) {
      try {
        const foto = await capturaNodo(nodo, comunes);

        bloques.push({ imagen: await cargaImagen(foto.dataUrl), ancho: foto.ancho, alto: foto.alto, nitidez: foto.nitidez });
      } catch {
        /* Un bloque que no se deja fotografiar (un vídeo incrustado) no tumba el PDF. */
      }
    }

    if (!bloques.length) continue;

    const { hojas, anchoCss: w, altoHojaCss: h } = apila(bloques, anchoCss, fondo);

    hojas.forEach((imagen, i) => {
      hojasPdf.push({
        imagen,
        ancho: w,
        alto: h,
        orientacion: "portrait",
        margen: A4.margen,
        pie: {
          izquierda: jugador,
          centro: hojas.length > 1 ? `${seccion.titulo} · ${i + 1}/${hojas.length}` : seccion.titulo,
          derecha: fecha,
        },
      });
    });
  }
  }

  if (!hojasPdf.length) throw new Error("La ficha ha salido vacía.");

  alPaso?.("Montando el PDF…");

  const { pdfDeHojas } = await import("@/lib/export/lienzos");
  const doc = await pdfDeHojas(hojasPdf);

  descarga(doc.output("blob"), `${apodo(jugador, "jugador")}-${apodo(alcance, "ficha")}.pdf`);

  return hojasPdf.length;
}
