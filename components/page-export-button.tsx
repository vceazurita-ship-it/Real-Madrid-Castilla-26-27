"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Download, FileImage, FileText, Loader2 } from "lucide-react";
import { toast } from "sonner";

/**
 * Botón flotante disponible en todas las páginas.
 * Captura la página completa y la descarga en PNG o PDF.
 *
 * - Para capturar solo una zona concreta de una página, añade el atributo
 *   `data-export-root` al contenedor que quieras exportar.
 * - Para excluir un elemento de la captura, añade `data-export-hide`.
 */

const TRANSPARENT_PIXEL =
  "data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7";

const FALLBACK_BG = "#0B0F14";

// Límites prudentes para no reventar el tamaño máximo de canvas del navegador.
const MAX_CANVAS_WIDTH = 4200;
const MAX_CANVAS_HEIGHT = 12000;

function fileBaseName() {
  const title = (document.title || "pagina")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-zA-Z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .toLowerCase()
    .slice(0, 60);

  const now = new Date();

  const stamp = [
    now.getFullYear(),
    String(now.getMonth() + 1).padStart(2, "0"),
    String(now.getDate()).padStart(2, "0"),
  ].join("-");

  return `${title || "pagina"}_${stamp}`;
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

async function capturePage() {
  const htmlToImage = await import("html-to-image");

  const root =
    (document.querySelector("[data-export-root]") as HTMLElement | null) ??
    document.body;

  const scrollX = window.scrollX;
  const scrollY = window.scrollY;

  // Con scroll a 0 los elementos fixed/sticky quedan en su sitio natural.
  window.scrollTo(0, 0);
  await nextFrame();

  const width = Math.max(root.scrollWidth, root.clientWidth, 1);
  const height = Math.max(root.scrollHeight, root.clientHeight, 1);

  const pixelRatio = Math.max(
    1,
    Math.min(2, MAX_CANVAS_WIDTH / width, MAX_CANVAS_HEIGHT / height)
  );

  try {
    const dataUrl = await htmlToImage.toPng(root, {
      width,
      height,
      pixelRatio,
      cacheBust: true,
      backgroundColor: resolveBackground(root),
      imagePlaceholder: TRANSPARENT_PIXEL,
      style: {
        margin: "0",
        transform: "none",
      },
      filter: (node) => {
        if (!(node instanceof HTMLElement)) return true;

        if (node.hasAttribute("data-export-hide")) return false;
        if (node.hasAttribute("data-sonner-toaster")) return false;
        if (node.tagName === "SCRIPT") return false;

        return true;
      },
    });

    return { dataUrl, width, height };
  } finally {
    window.scrollTo(scrollX, scrollY);
  }
}

function downloadDataUrl(dataUrl: string, filename: string) {
  const link = document.createElement("a");

  link.href = dataUrl;
  link.download = filename;

  document.body.appendChild(link);
  link.click();
  link.remove();
}

export function PageExportButton() {
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState<"png" | "pdf" | null>(null);

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

  const exportPng = useCallback(async () => {
    setBusy("png");
    setOpen(false);

    const toastId = toast.loading("Generando PNG…");

    try {
      const { dataUrl } = await capturePage();

      downloadDataUrl(dataUrl, `${fileBaseName()}.png`);

      toast.success("PNG descargado", { id: toastId });
    } catch (error) {
      console.error("[export] PNG", error);
      toast.error("No se pudo generar el PNG", { id: toastId });
    } finally {
      setBusy(null);
    }
  }, []);

  const exportPdf = useCallback(async () => {
    setBusy("pdf");
    setOpen(false);

    const toastId = toast.loading("Generando PDF…");

    try {
      const { dataUrl, width, height } = await capturePage();

      const { jsPDF } = await import("jspdf");

      const doc = new jsPDF({
        orientation: width >= height ? "landscape" : "portrait",
        unit: "px",
        format: [width, height],
        compress: true,
      });

      doc.addImage(dataUrl, "PNG", 0, 0, width, height, undefined, "FAST");
      doc.save(`${fileBaseName()}.pdf`);

      toast.success("PDF descargado", { id: toastId });
    } catch (error) {
      console.error("[export] PDF", error);
      toast.error("No se pudo generar el PDF", { id: toastId });
    } finally {
      setBusy(null);
    }
  }, []);

  return (
    <div
      ref={containerRef}
      data-export-hide
      className="fixed bottom-20 right-5 z-[60] flex flex-col items-end gap-2 print:hidden"
    >
      {open && !busy && (
        <div className="flex flex-col overflow-hidden rounded-xl border border-white/10 bg-[#121820]/95 shadow-2xl backdrop-blur">
          <button
            type="button"
            onClick={exportPng}
            className="flex items-center gap-2 px-4 py-2.5 text-left text-sm font-medium text-white transition hover:bg-white/10"
          >
            <FileImage className="h-4 w-4 text-[#C8A96B]" />
            Exportar PNG
          </button>

          <button
            type="button"
            onClick={exportPdf}
            className="flex items-center gap-2 border-t border-white/10 px-4 py-2.5 text-left text-sm font-medium text-white transition hover:bg-white/10"
          >
            <FileText className="h-4 w-4 text-[#C8A96B]" />
            Exportar PDF
          </button>
        </div>
      )}

      <button
        type="button"
        aria-label="Exportar página"
        title="Exportar página (PNG / PDF)"
        disabled={busy !== null}
        onClick={() => setOpen((value) => !value)}
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
