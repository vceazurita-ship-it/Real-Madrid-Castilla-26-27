"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  Download,
  FileImage,
  FileStack,
  FileText,
  Loader2,
} from "lucide-react";
import { toast } from "sonner";

/**
 * Botón flotante disponible en todas las páginas.
 *
 * Captura la página entera (no solo la parte visible): antes de la captura se
 * entra en "modo exportación", que despega los elementos sticky, esconde el
 * cromo flotante (menús, FABs, toasts) y expande cualquier contenedor con
 * scroll interno para que nada quede recortado.
 *
 * **Con un pop-up abierto se exporta solo el pop-up.** Es lo que se está
 * mirando, y la página de detrás queda tapada por el velo: capturarla entera
 * daba un PDF de la pantalla equivocada.
 *
 * - Para exportar solo una zona concreta, añade `data-export-root` al
 *   contenedor que quieras capturar.
 * - Para excluir un elemento de la captura, añade `data-export-hide`.
 * - Para marcar a mano qué tarjeta de un modal es la exportable, añade
 *   `data-export-panel`.
 */

const TRANSPARENT_PIXEL =
  "data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7";

const FALLBACK_BG = "#0B0F14";

/* Límites prudentes del canvas del navegador: por encima de esto Chrome
   devuelve una imagen en blanco en lugar de fallar. */
const MAX_CANVAS_SIDE = 14000;
const MAX_CANVAS_AREA = 55_000_000;

/* A4 en puntos. */
const PDF_MARGIN = 18;
const PDF_FOOTER = 24;

/* Por debajo de este porcentaje de página no merece la pena adelantar un
   corte para respetar una tarjeta: dejaría demasiado hueco en blanco. */
const MIN_PAGE_FILL = 0.55;

type Cleanup = () => void;

/* Caja (en px CSS, relativa al inicio de la captura) que no debería quedar
   partida entre dos páginas del PDF. */
type Box = { top: number; bottom: number };

type Capture = {
  dataUrl: string;
  width: number;
  height: number;
  pixelRatio: number;
  boxes: Box[];
  /** La captura es la de un pop-up abierto, no la de la página. */
  dialog: boolean;
};

function fileBaseName(suffix?: string) {
  const fromPath = window.location.pathname
    .split("/")
    .filter(Boolean)
    .join("-");

  const fromTitle = (document.title || "pagina")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-zA-Z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .toLowerCase();

  const now = new Date();

  const stamp = [
    now.getFullYear(),
    String(now.getMonth() + 1).padStart(2, "0"),
    String(now.getDate()).padStart(2, "0"),
  ].join("-");

  const name = (fromPath || fromTitle || "pagina").slice(0, 60);

  return [name, suffix, stamp].filter(Boolean).join("_");
}

function resolveBackground(root: HTMLElement) {
  const candidates = [root, document.body, document.documentElement];

  for (const node of candidates) {
    const bg = getComputedStyle(node).backgroundColor;

    if (bg && bg !== "transparent" && !bg.startsWith("rgba(0, 0, 0, 0)")) {
      return bg;
    }
  }

  return FALLBACK_BG;
}

function nextFrame() {
  return new Promise<void>((resolve) =>
    requestAnimationFrame(() => requestAnimationFrame(() => resolve()))
  );
}

function wait(ms: number) {
  return new Promise<void>((resolve) => window.setTimeout(resolve, ms));
}

/** ¿Hay imágenes servidas desde otro dominio dentro de la captura? */
function hasRemoteImages(root: HTMLElement) {
  return Array.from(root.querySelectorAll("img")).some((img) => {
    const src = img.currentSrc || img.src;

    if (!src || src.startsWith("data:") || src.startsWith("blob:")) {
      return false;
    }

    try {
      return new URL(src, window.location.href).origin !== window.location.origin;
    } catch {
      return false;
    }
  });
}

function isClipping(value: string) {
  return value === "auto" || value === "scroll" || value === "hidden";
}

/**
 * Panel del pop-up abierto, si lo hay.
 *
 * Se reconoce por `role="dialog"` + `aria-modal`, que es como están montados
 * los modales de la app, y gana el último del DOM: es el que está encima.
 */
function findOpenDialog(): HTMLElement | null {
  const selector =
    '[data-export-modal], [role="dialog"][aria-modal="true"]';

  const candidates = Array.from(
    document.querySelectorAll<HTMLElement>(selector)
  ).filter((el) => {
    if (el.closest("[data-export-hide]")) return false;

    const cs = getComputedStyle(el);

    if (cs.display === "none" || cs.visibility === "hidden") return false;

    const rect = el.getBoundingClientRect();

    return rect.width > 80 && rect.height > 80;
  });

  const dialog = candidates[candidates.length - 1];

  if (!dialog) return null;

  const marked = dialog.querySelector<HTMLElement>("[data-export-panel]");

  if (marked) return marked;

  /* El nodo que lleva `role="dialog"` suele ser el velo a pantalla completa:
     si de él cuelga un único hijo, ese hijo es la tarjeta y lo demás fondo. */
  const children = Array.from(dialog.children).filter(
    (node): node is HTMLElement => node instanceof HTMLElement
  );

  return children.length === 1 ? children[0] : dialog;
}

/**
 * Deja el documento listo para una captura completa y devuelve la función que
 * restaura el estado original.
 *
 * `keep` es la raíz de la captura: ni ella, ni lo que lleva dentro, ni los
 * contenedores de los que cuelga pueden esconderse por la regla que aparta el
 * cromo flotante. Sin esa salvedad, exportar un modal —que vive dentro de un
 * velo `position: fixed`— se llevaba por delante justamente lo que se quería
 * capturar.
 */
function enterExportMode(keep?: HTMLElement | null): Cleanup {
  const undo: Cleanup[] = [];

  const scrollX = window.scrollX;
  const scrollY = window.scrollY;

  const patch = (el: HTMLElement, styles: Record<string, string>) => {
    const previous = el.getAttribute("style");

    Object.entries(styles).forEach(([property, value]) => {
      el.style.setProperty(property, value, "important");
    });

    undo.push(() => {
      if (previous === null) el.removeAttribute("style");
      else el.setAttribute("style", previous);
    });
  };

  const style = document.createElement("style");

  style.textContent = `
    html[data-exporting] [data-export-hide],
    html[data-exporting] [data-sonner-toaster],
    html[data-exporting] [data-radix-popper-content-wrapper] {
      display: none !important;
    }

    html[data-exporting] *,
    html[data-exporting] *::before,
    html[data-exporting] *::after {
      animation: none !important;
      transition: none !important;
      caret-color: transparent !important;
    }

    html[data-exporting] *::-webkit-scrollbar {
      display: none !important;
    }
  `;

  document.head.appendChild(style);
  undo.push(() => style.remove());

  document.documentElement.setAttribute("data-exporting", "");
  undo.push(() => document.documentElement.removeAttribute("data-exporting"));

  window.scrollTo(0, 0);
  undo.push(() => window.scrollTo(scrollX, scrollY));

  const elements = Array.from(
    document.body.querySelectorAll<HTMLElement>("*")
  );

  for (const el of elements) {
    if (el.closest("[data-export-hide]")) continue;

    const cs = getComputedStyle(el);

    if (cs.display === "none") continue;

    const inCapture =
      keep && (el === keep || el.contains(keep) || keep.contains(el));

    /* El cromo flotante (FABs, drawers, modales) nunca forma parte del
       documento: fuera de la captura. */
    if (cs.position === "fixed" && !inCapture) {
      patch(el, { display: "none" });
      continue;
    }

    /* Sticky con scroll a 0 ya está en su sitio, pero al crecer el lienzo
       podría "seguir" el scroll del clon: lo anclamos al flujo. */
    if (cs.position === "sticky") {
      patch(el, { position: "static" });
    }
  }

  /* Los contenedores con scroll se despliegan de dentro hacia fuera: si
     empezáramos por el padre, todavía no habría crecido y su recorte se
     quedaría puesto (era lo que cortaba las tablas anchas). `html` y
     `body` entran también en la lista: el layout usa `overflow-x-hidden`
     en el body y sin levantarlo nada puede sobresalir. */
  const scrollers = [
    ...elements.reverse(),
    document.body,
    document.documentElement,
  ];

  for (const el of scrollers) {
    if (el.closest("[data-export-hide]")) continue;

    const cs = getComputedStyle(el);

    if (cs.display === "none") continue;

    const needsY = isClipping(cs.overflowY) && el.scrollHeight > el.clientHeight + 1;
    const needsX = isClipping(cs.overflowX) && el.scrollWidth > el.clientWidth + 1;

    if (!needsX && !needsY) continue;

    /* Los dos ejes a la vez: en CSS un `overflow-x: visible` junto a un
       `overflow-y: hidden` vuelve a comportarse como `auto` y seguiría
       recortando. */
    const styles: Record<string, string> = { overflow: "visible" };

    if (needsY) {
      styles["max-height"] = "none";
      styles.height = "auto";
    }

    if (needsX) styles["max-width"] = "none";

    patch(el, styles);
  }

  return () => {
    while (undo.length) undo.pop()?.();
  };
}

async function waitForAssets(root: HTMLElement) {
  if (document.fonts?.ready) {
    await document.fonts.ready.catch(() => undefined);
  }

  const images = Array.from(root.querySelectorAll("img"));

  await Promise.all(
    images.map((img) =>
      img.complete
        ? Promise.resolve()
        : new Promise<void>((resolve) => {
            const done = () => resolve();

            img.addEventListener("load", done, { once: true });
            img.addEventListener("error", done, { once: true });

            /* Nunca bloqueamos la exportación por una imagen colgada. */
            window.setTimeout(done, 4000);
          })
    )
  );

  /* Al desplegar los contenedores cambian los anchos: los gráficos
     (ResponsiveContainer) se remiden con un ResizeObserver, así que hay
     que darles un respiro antes de capturar o saldrían con el tamaño
     antiguo. */
  window.dispatchEvent(new Event("resize"));

  await nextFrame();
  await wait(260);
  await nextFrame();
}

/**
 * Recoge las cajas (texto, imágenes, tarjetas) que el PDF no debería partir
 * entre dos páginas. Se miden con el documento ya en modo exportación.
 */
function collectBoxes(root: HTMLElement, height: number): Box[] {
  const boxes: Box[] = [];

  const rootTop = root.getBoundingClientRect().top;

  const elements = Array.from(root.querySelectorAll<HTMLElement>("*"));

  for (const el of elements) {
    const cs = getComputedStyle(el);

    if (cs.display === "none" || cs.visibility === "hidden") continue;

    const rect = el.getBoundingClientRect();

    if (rect.height <= 2) continue;

    const tag = el.tagName.toUpperCase();

    const isMedia =
      tag === "IMG" || tag === "SVG" || tag === "CANVAS" || tag === "VIDEO";

    const hasOwnText = Array.from(el.childNodes).some(
      (node) => node.nodeType === Node.TEXT_NODE && node.textContent?.trim()
    );

    const isCard = parseFloat(cs.borderTopLeftRadius) >= 8;

    if (!isMedia && !hasOwnText && !isCard) continue;

    boxes.push({
      top: Math.max(0, Math.round(rect.top - rootTop)),
      bottom: Math.min(height, Math.round(rect.bottom - rootTop)),
    });
  }

  return boxes;
}

/**
 * Convierte las cajas en un mapa de alturas "prohibidas" para cortar. Las
 * cajas más altas que una página se ignoran: cortarlas es inevitable.
 */
function buildOccupancy(capture: Capture, sliceHeight: number) {
  const occupied = new Uint8Array(capture.height + 2);

  const limit = sliceHeight * 0.9;

  for (const box of capture.boxes) {
    if (box.bottom - box.top > limit) continue;

    for (let y = box.top + 1; y < box.bottom; y += 1) occupied[y] = 1;
  }

  return occupied;
}

async function capturePage(): Promise<Capture> {
  /* El pop-up manda sobre `data-export-root`: si hay uno abierto es lo que el
     usuario está mirando. */
  const dialog = findOpenDialog();

  const root =
    dialog ??
    (document.querySelector("[data-export-root]") as HTMLElement | null) ??
    document.body;

  const restore = enterExportMode(dialog);

  try {
    await waitForAssets(root);

    const rect = root.getBoundingClientRect();

    /* Si exportamos el documento entero, `html` puede ser más alto que `body`
       (por ejemplo si la página monta su propio contenedor de scroll). */
    const isDocument = root === document.body;

    const width = Math.ceil(
      Math.max(
        root.scrollWidth,
        root.clientWidth,
        rect.width,
        isDocument ? document.documentElement.scrollWidth : 0,
        1
      )
    );

    const height = Math.ceil(
      Math.max(
        root.scrollHeight,
        root.clientHeight,
        rect.height,
        isDocument ? document.documentElement.scrollHeight : 0,
        1
      )
    );

    const pixelRatio = Math.max(
      0.5,
      Math.min(
        2,
        MAX_CANVAS_SIDE / width,
        MAX_CANVAS_SIDE / height,
        Math.sqrt(MAX_CANVAS_AREA / (width * height))
      )
    );

    const boxes = collectBoxes(root, height);

    const htmlToImage = await import("html-to-image");

    const options = {
      width,
      height,
      cacheBust: true,
      backgroundColor: resolveBackground(root),
      imagePlaceholder: TRANSPARENT_PIXEL,
      style: {
        margin: "0",
        transform: "none",
        transformOrigin: "top left",
      },
      filter: (node: HTMLElement) => {
        if (!(node instanceof HTMLElement)) return true;

        if (node.hasAttribute("data-export-hide")) return false;
        if (node.hasAttribute("data-sonner-toaster")) return false;
        if (node.tagName === "SCRIPT") return false;
        if (node.tagName === "NOSCRIPT") return false;

        return true;
      },
    };

    /* Pasada de calentamiento: html-to-image descarga e incrusta las
       imágenes remotas la primera vez, así que sin ella la captura buena
       sale a veces sin fotos. Solo hace falta cuando hay imágenes de otro
       dominio (Supabase, escudos…); va a resolución mínima y deja los
       recursos en la caché interna de la librería. */
    if (hasRemoteImages(root)) {
      await htmlToImage
        .toPng(root, { ...options, pixelRatio: 0.05 })
        .catch(() => undefined);
    }

    /* Si el lienzo se pasa de tamaño el navegador devuelve una imagen en
       blanco en lugar de fallar: bajamos la resolución y repetimos. Solo
       tiene sentido vigilarlo en páginas grandes; en una corta un PNG
       pequeño es simplemente un PNG pequeño. */
    const risky = width * height * pixelRatio * pixelRatio > 12_000_000;

    const looksEmpty = (url: string) => risky && url.length < 6000;

    let dataUrl = "";
    let used = pixelRatio;

    for (const ratio of [pixelRatio, pixelRatio * 0.6, pixelRatio * 0.35]) {
      used = Math.max(0.25, ratio);

      dataUrl = await htmlToImage.toPng(root, { ...options, pixelRatio: used });

      if (!looksEmpty(dataUrl)) break;
    }

    if (looksEmpty(dataUrl)) {
      throw new Error("La captura ha salido vacía");
    }

    return {
      dataUrl,
      width,
      height,
      pixelRatio: used,
      boxes,
      dialog: Boolean(dialog),
    };
  } finally {
    restore();
  }
}

function loadImage(src: string) {
  return new Promise<HTMLImageElement>((resolve, reject) => {
    const img = new Image();

    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error("No se pudo leer la captura"));
    img.src = src;
  });
}

function downloadDataUrl(dataUrl: string, filename: string) {
  const link = document.createElement("a");

  link.href = dataUrl;
  link.download = filename;

  document.body.appendChild(link);
  link.click();
  link.remove();
}

/** Busca hacia arriba el primer corte que no parta una tarjeta. */
function findBreak(occupied: Uint8Array, target: number, floor: number) {
  for (let y = Math.min(target, occupied.length - 1); y > floor; y -= 1) {
    if (!occupied[y]) return y;
  }

  return target;
}

function paginate(capture: Capture, sliceHeight: number) {
  const occupied = buildOccupancy(capture, sliceHeight);

  const pages: { from: number; to: number }[] = [];

  let cursor = 0;

  while (cursor < capture.height - 1) {
    let end = Math.min(capture.height, cursor + sliceHeight);

    if (end < capture.height) {
      end = findBreak(occupied, end, cursor + sliceHeight * MIN_PAGE_FILL);
    }

    if (end <= cursor) end = Math.min(capture.height, cursor + sliceHeight);

    pages.push({ from: cursor, to: end });

    cursor = end;
  }

  return pages.length ? pages : [{ from: 0, to: capture.height }];
}

function sliceToDataUrl(
  img: HTMLImageElement,
  canvas: HTMLCanvasElement,
  background: string,
  from: number,
  to: number,
  pixelRatio: number
) {
  const sourceY = Math.round(from * pixelRatio);
  const sourceH = Math.max(1, Math.round((to - from) * pixelRatio));

  canvas.width = img.width;
  canvas.height = sourceH;

  const ctx = canvas.getContext("2d");

  if (!ctx) throw new Error("Canvas no disponible");

  ctx.fillStyle = background;
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  ctx.drawImage(
    img,
    0,
    sourceY,
    img.width,
    sourceH,
    0,
    0,
    img.width,
    sourceH
  );

  return canvas.toDataURL("image/jpeg", 0.95);
}

async function buildPagedPdf(capture: Capture) {
  const img = await loadImage(capture.dataUrl);

  const { jsPDF } = await import("jspdf");

  /*
  | Una página ancha pide apaisado. Una ficha no: mide poco más de 1150 px de
  | ancho pero es mucho más alta, y en apaisado cabe la mitad de alto por
  | hoja, así que se parte en el doble de páginas. Ahí manda la proporción.
  */
  const orientation = capture.dialog
    ? capture.width > capture.height
      ? "landscape"
      : "portrait"
    : capture.width > 1150
      ? "landscape"
      : "portrait";

  const doc = new jsPDF({
    orientation,
    unit: "pt",
    format: "a4",
    compress: true,
  });

  const pageW = doc.internal.pageSize.getWidth();
  const pageH = doc.internal.pageSize.getHeight();

  const contentW = pageW - PDF_MARGIN * 2;
  const contentH = pageH - PDF_MARGIN * 2 - PDF_FOOTER;

  /* Puntos de PDF por píxel CSS: el ancho de la página manda. */
  const ptPerPx = contentW / capture.width;

  const sliceHeight = Math.floor(contentH / ptPerPx);

  const pages = paginate(capture, sliceHeight);

  const canvas = document.createElement("canvas");
  const background = resolveBackground(document.body);

  const stamp = new Date().toLocaleDateString("es-ES");
  const label = document.title || "Real Madrid Castilla";

  pages.forEach((page, index) => {
    if (index > 0) doc.addPage();

    const slice = sliceToDataUrl(
      img,
      canvas,
      background,
      page.from,
      page.to,
      capture.pixelRatio
    );

    doc.addImage(
      slice,
      "JPEG",
      PDF_MARGIN,
      PDF_MARGIN,
      contentW,
      (page.to - page.from) * ptPerPx,
      undefined,
      "FAST"
    );

    doc.setFontSize(7);
    doc.setTextColor(150);

    doc.text(`${label} · ${stamp}`, PDF_MARGIN, pageH - 14);

    doc.text(`${index + 1} / ${pages.length}`, pageW - PDF_MARGIN, pageH - 14, {
      align: "right",
    });
  });

  return { doc, pages: pages.length };
}

async function buildSinglePagePdf(capture: Capture) {
  const { jsPDF } = await import("jspdf");

  const doc = new jsPDF({
    orientation: capture.width >= capture.height ? "landscape" : "portrait",
    unit: "px",
    format: [capture.width, capture.height],
    compress: true,
  });

  doc.addImage(
    capture.dataUrl,
    "PNG",
    0,
    0,
    capture.width,
    capture.height,
    undefined,
    "FAST"
  );

  return doc;
}

type Mode = "png" | "pdf" | "pdf-single";

export function PageExportButton() {
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState<Mode | null>(null);

  /* Qué se va a capturar. Se mira al abrir el menú, no en cada render: es
     una lectura del DOM y sólo hace falta para rotular las opciones. */
  const [onDialog, setOnDialog] = useState(false);

  const containerRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!open) return;

    const onPointerDown = (event: PointerEvent) => {
      if (!containerRef.current?.contains(event.target as Node)) {
        setOpen(false);
      }
    };

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false);
    };

    document.addEventListener("pointerdown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);

    return () => {
      document.removeEventListener("pointerdown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [open]);

  const run = useCallback(
    async (mode: Mode, loadingText: string, action: (c: Capture) => Promise<string>) => {
      setBusy(mode);
      setOpen(false);

      const toastId = toast.loading(loadingText);

      try {
        const capture = await capturePage();
        const message = await action(capture);

        toast.success(message, { id: toastId });
      } catch (error) {
        console.error(`[export] ${mode}`, error);
        toast.error("No se pudo generar la exportación", { id: toastId });
      } finally {
        setBusy(null);
      }
    },
    []
  );

  /* Sufijo del nombre de fichero: distingue la ficha de la página. */
  const suffix = (capture: Capture) => (capture.dialog ? "ficha" : undefined);

  const exportPng = useCallback(
    () =>
      run("png", "Generando PNG…", async (capture) => {
        downloadDataUrl(capture.dataUrl, `${fileBaseName(suffix(capture))}.png`);

        return `PNG descargado (${capture.width}×${capture.height} px)`;
      }),
    [run]
  );

  const exportPdf = useCallback(
    () =>
      run("pdf", "Generando PDF A4…", async (capture) => {
        const { doc, pages } = await buildPagedPdf(capture);

        doc.save(`${fileBaseName(suffix(capture))}.pdf`);

        return `PDF descargado (${pages} ${pages === 1 ? "página" : "páginas"})`;
      }),
    [run]
  );

  const exportPdfSingle = useCallback(
    () =>
      run("pdf-single", "Generando PDF de una hoja…", async (capture) => {
        const doc = await buildSinglePagePdf(capture);

        doc.save(`${fileBaseName(suffix(capture))}_hoja-unica.pdf`);

        return "PDF de una hoja descargado";
      }),
    [run]
  );

  return (
    <div
      ref={containerRef}
      data-export-hide
      className="fixed bottom-20 right-5 z-[60] flex flex-col items-end gap-2 print:hidden"
    >
      {open && !busy && (
        <div className="w-[248px] overflow-hidden rounded-2xl border border-white/10 bg-[#121820]/95 shadow-2xl backdrop-blur">
          <p className="border-b border-white/10 px-4 py-2.5 text-[10px] uppercase tracking-[0.2em] text-white/40">
            {onDialog ? "Exportar solo la ficha" : "Exportar página completa"}
          </p>

          <button
            type="button"
            onClick={exportPdf}
            className="flex w-full items-start gap-3 px-4 py-3 text-left transition hover:bg-white/10"
          >
            <FileStack className="mt-0.5 h-4 w-4 shrink-0 text-[#C8A96B]" />

            <span>
              <span className="block text-sm font-medium text-white">
                PDF A4
              </span>

              <span className="block text-[11px] text-white/45">
                Paginado y listo para imprimir
              </span>
            </span>
          </button>

          <button
            type="button"
            onClick={exportPdfSingle}
            className="flex w-full items-start gap-3 border-t border-white/10 px-4 py-3 text-left transition hover:bg-white/10"
          >
            <FileText className="mt-0.5 h-4 w-4 shrink-0 text-[#C8A96B]" />

            <span>
              <span className="block text-sm font-medium text-white">
                PDF de una hoja
              </span>

              <span className="block text-[11px] text-white/45">
                {onDialog ? "La ficha sin cortes" : "Toda la página sin cortes"}
              </span>
            </span>
          </button>

          <button
            type="button"
            onClick={exportPng}
            className="flex w-full items-start gap-3 border-t border-white/10 px-4 py-3 text-left transition hover:bg-white/10"
          >
            <FileImage className="mt-0.5 h-4 w-4 shrink-0 text-[#C8A96B]" />

            <span>
              <span className="block text-sm font-medium text-white">PNG</span>

              <span className="block text-[11px] text-white/45">
                Imagen única en alta resolución
              </span>
            </span>
          </button>
        </div>
      )}

      <button
        type="button"
        aria-label={onDialog ? "Exportar ficha" : "Exportar página"}
        aria-expanded={open}
        title={
          onDialog
            ? "Exportar solo la ficha abierta (PDF / PNG)"
            : "Exportar página completa (PDF / PNG)"
        }
        disabled={busy !== null}
        onClick={() => {
          if (!open) setOnDialog(Boolean(findOpenDialog()));

          setOpen(!open);
        }}
        className="flex h-11 w-11 items-center justify-center rounded-full bg-[#C8A96B] text-black shadow-xl transition hover:opacity-90 disabled:cursor-wait disabled:opacity-70"
      >
        {busy ? (
          <Loader2 className="h-5 w-5 animate-spin" />
        ) : (
          <Download className="h-5 w-5" />
        )}
      </button>
    </div>
  );
}

export default PageExportButton;
