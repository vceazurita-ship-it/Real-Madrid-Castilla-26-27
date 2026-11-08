/**
 * PDF de la ficha individual (08/11/2026).
 *
 * Desde /individual se puede sacar en PDF la ficha completa de un jugador o
 * una sola pestaña (por ejemplo «Área de mejora»). Se fotografía lo que la
 * pantalla ya pinta, así que el PDF dice exactamente lo mismo que la ficha.
 *
 * - **Ancho de documento fijo.** Mientras se exporta, cada sección se maqueta a
 *   `ANCHO_DOC` px, sea cual sea el aparato. Desde el móvil (≈360 px) el PDF
 *   salía estirado, basto y descolocado; en el portátil (≈1100 px), con la
 *   letra diminuta. Con un ancho fijo sale igual desde cualquier sitio.
 * - **Reparto en hojas.** Se planifica con las medidas de la página: cada
 *   bloque entra entero en la hoja si cabe; si no cabe y en la hoja queda
 *   mucho hueco, o si es más alto que una hoja, se baja a sus partes (sus
 *   hijos). Sólo lo que no se puede partir y no cabe en una hoja se corta.
 * - **Cabecera** en la primera hoja: jugador, sección y fecha.
 *
 * Cada hoja lleva al pie el jugador, la sección y la página. Lo marcado con
 * `data-export-hide` y los mandos de pantalla (botones de edición, selectores)
 * no salen.
 */
import { capturaNodo, fuentesListas, respira } from "@/lib/export/captura";
import { apodo, esperaFotos, PIXEL_VACIO, type HojaPdf } from "@/lib/export/lienzos";
import type { ResultadoDescarga } from "@/lib/trabajos/descargas";

export type SeccionFicha = {
  titulo: string;
  nodo: HTMLElement;
};

/** A4 vertical en puntos, con los mismos márgenes y pie que `pdfDeHojas`. */
const A4 = { ancho: 595.28, alto: 841.89, margen: 26, pie: 26 };
const PROPORCION = (A4.alto - A4.margen * 2 - A4.pie) / (A4.ancho - A4.margen * 2);
/** Ancho al que se maqueta la ficha para el PDF: unos 11 pt de letra en el A4. */
const ANCHO_DOC = 820;
const ALTO_HOJA = Math.floor(ANCHO_DOC * PROPORCION);
const NITIDEZ = 2;
const HUECO = 14; // px CSS entre bloques
const CABECERA = 74; // px CSS de la cabecera de la primera hoja
/** Si al saltar de hoja quedaría más de esto vacío, el bloque se parte. */
const HUECO_MAXIMO = 0.35;

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

function visibles(nodo: HTMLElement) {
  return Array.from(nodo.children).filter(
    (hijo): hijo is HTMLElement =>
      hijo instanceof HTMLElement &&
      !hijo.hasAttribute("data-export-hide") &&
      !esMando(hijo) &&
      hijo.getBoundingClientRect().height > 1,
  );
}

/** Los hijos van uno debajo de otro (no en columnas): se pueden repartir en hojas. */
function apilados(hijos: HTMLElement[]) {
  for (let i = 1; i < hijos.length; i++) {
    if (hijos[i].getBoundingClientRect().top < hijos[i - 1].getBoundingClientRect().bottom - 2) return false;
  }

  return hijos.length > 1;
}

/** Tiene borde o fondo propio: es una tarjeta y partirla la deja sin marco. */
function tieneMarco(nodo: HTMLElement) {
  const estilo = getComputedStyle(nodo);
  const borde = parseFloat(estilo.borderTopWidth) > 0 && estilo.borderTopStyle !== "none";
  const fondo = estilo.backgroundColor && estilo.backgroundColor !== "transparent" && !/rgba\([^)]*,\s*0\)$/.test(estilo.backgroundColor);

  return borde || Boolean(fondo);
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

/* ------------------------------------------------------------------ */
/*  REPARTO EN HOJAS                                                   */
/* ------------------------------------------------------------------ */

type Pieza = { nodo: HTMLElement; alto: number; hoja: number; y: number };

/**
 * Coloca los bloques de una sección en hojas con sus medidas reales. Devuelve
 * cada pieza con su hoja y su altura dentro de ella. `inicio` es lo que ya
 * ocupa la primera hoja (la cabecera).
 */
function planifica(raiz: HTMLElement, inicio: number): Pieza[] {
  const piezas: Pieza[] = [];
  let hoja = 0;
  let y = inicio;

  const salta = () => {
    hoja += 1;
    y = 0;
  };

  const coloca = (nodo: HTMLElement, hondura: number) => {
    const alto = Math.ceil(nodo.getBoundingClientRect().height);

    if (y + alto <= ALTO_HOJA) {
      piezas.push({ nodo, alto, hoja, y });
      y += alto + HUECO;

      return;
    }

    const hijos = hondura < 5 ? visibles(nodo) : [];
    const partible = apilados(hijos);
    const quedaria = (ALTO_HOJA - y) / ALTO_HOJA;

    /* Partir sólo lo que no cabe en una hoja entera, o una LISTA (filas
       sueltas sin marco común) cuando saltar dejaría mucho blanco. Una tarjeta
       que cabe va entera a la hoja siguiente: partida perdía el marco y el
       título quedaba en una hoja y el gráfico en otra. */
    const esLista = partible && !tieneMarco(nodo);

    if (partible && (alto > ALTO_HOJA || (esLista && y > 0 && quedaria > HUECO_MAXIMO))) {
      for (const hijo of hijos) coloca(hijo, hondura + 1);

      return;
    }

    if (y > 0) salta();

    piezas.push({ nodo, alto, hoja, y });
    /* Más alto que una hoja y sin partes: se cortará a tiras (ver `pinta`). */
    const hojasQueOcupa = Math.max(1, Math.ceil(alto / ALTO_HOJA));

    hoja += hojasQueOcupa - 1;
    y = alto - (hojasQueOcupa - 1) * ALTO_HOJA + HUECO;

    if (y >= ALTO_HOJA) salta();
  };

  /* La sección misma no se pinta: se reparten sus partes. */
  const partes = visibles(raiz);

  for (const parte of partes.length ? partes : [raiz]) coloca(parte, 0);

  return piezas;
}

function cargaImagen(dataUrl: string) {
  return new Promise<HTMLImageElement>((listo, falla) => {
    const imagen = new Image();

    imagen.onload = () => listo(imagen);
    imagen.onerror = () => falla(new Error("No se pudo leer la captura"));
    imagen.src = dataUrl;
  });
}

/** Cabecera de la primera hoja: el jugador en grande, la sección y la fecha. */
function pintaCabecera(ctx: CanvasRenderingContext2D, jugador: string, seccion: string, fecha: string, tinta: string, familia: string) {
  const s = NITIDEZ;

  ctx.save();
  ctx.fillStyle = "#C8A96B";
  ctx.font = `600 ${11 * s}px ${familia}`;
  ctx.textBaseline = "top";
  ctx.fillText("REAL MADRID CASTILLA · FICHA INDIVIDUAL", 0, 4 * s);
  ctx.fillStyle = tinta;
  ctx.font = `700 ${30 * s}px ${familia}`;
  ctx.fillText(jugador, 0, 20 * s);
  ctx.font = `500 ${13 * s}px ${familia}`;
  ctx.globalAlpha = 0.7;
  const derecha = `${seccion} · ${fecha}`;
  ctx.textAlign = "right";
  ctx.fillText(derecha, ANCHO_DOC * s, 34 * s);
  ctx.globalAlpha = 1;
  ctx.fillStyle = "#C8A96B";
  ctx.fillRect(0, (CABECERA - 12) * s, ANCHO_DOC * s, 2 * s);
  ctx.restore();
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

/** Maqueta la sección a ancho de documento; devuelve cómo dejarla como estaba. */
function fijaAncho(nodo: HTMLElement) {
  const antes = nodo.getAttribute("style");

  nodo.style.width = `${ANCHO_DOC}px`;
  nodo.style.minWidth = `${ANCHO_DOC}px`;
  nodo.style.maxWidth = `${ANCHO_DOC}px`;
  nodo.style.flex = "none";

  return () => {
    if (antes === null) nodo.removeAttribute("style");
    else nodo.setAttribute("style", antes);
  };
}

export async function exportaFichaPdf(opciones: {
  jugador: string;
  /** Lo que sale en el nombre del fichero y en el pie: «Ficha completa», «Área de mejora»… */
  alcance: string;
  secciones: SeccionFicha[];
  alPaso?: (texto: string, fraccion?: number) => void;
  /** Ya no hace falta la pantalla (fotos hechas): el resto va en segundo plano. */
  alSoltar?: () => void;
}): Promise<ResultadoDescarga & { paginas: number }> {
  const { jugador, alcance, secciones, alPaso, alSoltar } = opciones;

  if (!secciones.length) throw new Error("No hay nada que exportar en esta ficha.");

  alPaso?.("Esperando a que carguen los datos…");

  await esperaDatos(secciones.map((s) => s.nodo));

  const fondo = fondoDe(secciones[0].nodo);
  const tinta = getComputedStyle(secciones[0].nodo).color || "#111";
  const familia = getComputedStyle(document.body).fontFamily || "sans-serif";
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

  const deshaz = secciones.map((s) => fijaAncho(s.nodo));

  try {
    /* Que los gráficos que miden su caja (ResizeObserver) se redibujen al ancho nuevo. */
    await new Promise((r) => setTimeout(r, 700));
    await respira(2);
    await fuentesListas();

    for (const seccion of secciones) await esperaFotos(seccion.nodo);

    for (const [orden, seccion] of secciones.entries()) {
      alPaso?.(`Fotografiando ${seccion.titulo.toLowerCase()} (${orden + 1} de ${secciones.length})`, orden / secciones.length);

      const conCabecera = orden === 0;
      const piezas = planifica(seccion.nodo, conCabecera ? CABECERA : 0);

      if (!piezas.length) continue;

      const nHojas = Math.max(...piezas.map((p) => p.hoja + Math.max(1, Math.ceil((p.y + p.alto) / ALTO_HOJA)) - 1)) + 1;
      const lienzos = Array.from({ length: nHojas }, () => {
        const lienzo = document.createElement("canvas");

        lienzo.width = ANCHO_DOC * NITIDEZ;
        lienzo.height = ALTO_HOJA * NITIDEZ;

        const ctx = lienzo.getContext("2d");

        if (!ctx) throw new Error("El navegador no deja dibujar el PDF.");

        ctx.fillStyle = fondo;
        ctx.fillRect(0, 0, lienzo.width, lienzo.height);

        return { lienzo, ctx, usada: false };
      });

      if (conCabecera) {
        pintaCabecera(lienzos[0].ctx, jugador, seccion.titulo, fecha, tinta, familia);
        lienzos[0].usada = true;
      }

      for (const pieza of piezas) {
        let imagen: HTMLImageElement;

        try {
          imagen = await cargaImagen((await capturaNodo(pieza.nodo, comunes)).dataUrl);
        } catch {
          /* Un bloque que no se deja fotografiar (un vídeo incrustado) no tumba el PDF. */
          continue;
        }

        const ancho = Math.min(ANCHO_DOC, pieza.nodo.getBoundingClientRect().width);
        const x = Math.max(0, pieza.nodo.getBoundingClientRect().left - seccion.nodo.getBoundingClientRect().left);
        const porCss = imagen.naturalHeight / pieza.alto;

        /* Lo que pasa de una hoja se corta a tiras, cada una en la siguiente. */
        for (let desde = 0, hoja = pieza.hoja, y = pieza.y; desde < pieza.alto; hoja += 1, y = 0) {
          const tramo = Math.min(pieza.alto - desde, ALTO_HOJA - y);
          const destino = lienzos[hoja];

          if (!destino) break;

          destino.ctx.drawImage(imagen, 0, desde * porCss, imagen.naturalWidth, tramo * porCss, x * NITIDEZ, y * NITIDEZ, ancho * NITIDEZ, tramo * NITIDEZ);
          destino.usada = true;
          desde += tramo;
        }
      }

      const usadas = lienzos.filter((l) => l.usada);

      usadas.forEach(({ lienzo }, i) => {
        hojasPdf.push({
          imagen: lienzo.toDataURL("image/jpeg", 0.9),
          ancho: ANCHO_DOC,
          alto: ALTO_HOJA,
          orientacion: "portrait",
          margen: A4.margen,
          pie: {
            izquierda: jugador,
            centro: usadas.length > 1 ? `${seccion.titulo} · ${i + 1}/${usadas.length}` : seccion.titulo,
            derecha: fecha,
          },
        });

        lienzo.width = 0;
        lienzo.height = 0;
      });
    }
  } finally {
    deshaz.forEach((vuelve) => vuelve());
    quieto.remove();
    estilosPropios.forEach((el, i) => {
      el.textContent = originales[i];
    });
  }

  if (!hojasPdf.length) throw new Error("La ficha ha salido vacía.");

  alSoltar?.();
  alPaso?.("Montando el PDF…", 0.95);

  const { pdfDeHojas } = await import("@/lib/export/lienzos");
  const doc = await pdfDeHojas(hojasPdf);

  return { blob: doc.output("blob"), nombre: `${apodo(jugador, "jugador")}-${apodo(alcance, "ficha")}.pdf`, paginas: hojasPdf.length };
}
