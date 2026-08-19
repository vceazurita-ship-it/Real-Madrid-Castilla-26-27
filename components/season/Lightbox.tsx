"use client";

import Image from "next/image";
import { useCallback, useEffect, useRef, useState } from "react";
import {
  ChevronLeft,
  ChevronRight,
  Download,
  ExternalLink,
  X,
  ZoomIn,
  ZoomOut,
} from "lucide-react";
import { downloadUrl, fileNameFromUrl } from "@/lib/season/utils";
import { useBodyScrollLock } from "./useBodyScrollLock";

export interface LightboxItem {
  url: string;
  caption?: string;
  subtitle?: string;
}

interface Props {
  items: LightboxItem[];
  index: number | null;
  onIndexChange: (index: number) => void;
  onClose: () => void;
}

const SWIPE_THRESHOLD = 50;

export default function Lightbox({
  items,
  index,
  onIndexChange,
  onClose,
}: Props) {
  const [zoomed, setZoomed] = useState(false);

  const touchStartX = useRef<number | null>(null);

  const open = index !== null && !!items[index];

  useBodyScrollLock(open);

  const goTo = useCallback(
    (delta: number) => {
      if (index === null || items.length === 0) return;

      onIndexChange((index + delta + items.length) % items.length);
      setZoomed(false);
    },
    [index, items.length, onIndexChange]
  );

  useEffect(() => {
    if (!open) return;

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
      if (event.key === "ArrowRight") goTo(1);
      if (event.key === "ArrowLeft") goTo(-1);
    };

    window.addEventListener("keydown", handleKeyDown);

    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [open, goTo, onClose]);

  // Si se borra la última imagen mientras está abierta, cerramos el visor.
  useEffect(() => {
    if (index !== null && !items[index]) onClose();
  }, [index, items, onClose]);

  if (!open || index === null) return null;

  const current = items[index];

  return (
    <div
      className="fixed inset-0 z-[70] flex flex-col bg-black/95"
      onTouchStart={(event) => {
        touchStartX.current = event.changedTouches[0].screenX;
      }}
      onTouchEnd={(event) => {
        if (touchStartX.current === null) return;

        const distance = touchStartX.current - event.changedTouches[0].screenX;
        touchStartX.current = null;

        if (Math.abs(distance) < SWIPE_THRESHOLD) return;

        goTo(distance > 0 ? 1 : -1);
      }}
    >
      {/* BARRA SUPERIOR */}

      <div className="flex shrink-0 items-center justify-between gap-4 border-b border-white/10 px-4 py-3 sm:px-6">
        <div className="min-w-0">
          <p className="truncate text-sm font-medium text-white/90">
            {current.caption ?? fileNameFromUrl(current.url)}
          </p>

          {current.subtitle && (
            <p className="truncate text-xs text-white/40">{current.subtitle}</p>
          )}
        </div>

        <div className="flex shrink-0 items-center gap-1">
          <span className="mr-2 hidden text-sm tabular-nums text-white/50 sm:inline">
            {index + 1} / {items.length}
          </span>

          <button
            type="button"
            onClick={() => setZoomed((value) => !value)}
            className="rounded-xl p-2.5 text-white/70 transition hover:bg-white/10 hover:text-white"
            aria-label={zoomed ? "Reducir" : "Ampliar"}
            title={zoomed ? "Ajustar a pantalla" : "Ver a tamaño real"}
          >
            {zoomed ? <ZoomOut size={20} /> : <ZoomIn size={20} />}
          </button>

          <a
            href={current.url}
            target="_blank"
            rel="noopener noreferrer"
            className="rounded-xl p-2.5 text-white/70 transition hover:bg-white/10 hover:text-white"
            aria-label="Abrir en una pestaña nueva"
            title="Abrir en una pestaña nueva"
          >
            <ExternalLink size={20} />
          </a>

          <a
            href={downloadUrl(current.url)}
            download
            className="rounded-xl p-2.5 text-white/70 transition hover:bg-white/10 hover:text-white"
            aria-label="Descargar"
            title="Descargar"
          >
            <Download size={20} />
          </a>

          <button
            type="button"
            onClick={onClose}
            className="rounded-xl p-2.5 text-white/70 transition hover:bg-white/10 hover:text-white"
            aria-label="Cerrar"
          >
            <X size={22} />
          </button>
        </div>
      </div>

      {/* IMAGEN */}

      <div
        className={`relative flex flex-1 items-center justify-center p-2 sm:p-6 ${
          zoomed ? "overflow-auto" : "overflow-hidden"
        }`}
        onClick={onClose}
      >
        <Image
          src={current.url}
          alt={current.caption ?? "Imagen ampliada"}
          width={2400}
          height={1600}
          onClick={(event) => {
            event.stopPropagation();
            setZoomed((value) => !value);
          }}
          className={
            zoomed
              ? "max-w-none cursor-zoom-out rounded-lg"
              : "max-h-full w-auto max-w-full cursor-zoom-in rounded-lg object-contain"
          }
        />

        {items.length > 1 && (
          <>
            <button
              type="button"
              onClick={(event) => {
                event.stopPropagation();
                goTo(-1);
              }}
              className="absolute left-2 top-1/2 -translate-y-1/2 rounded-full bg-black/60 p-2 text-white/80 transition hover:bg-white/10 hover:text-white sm:left-6 sm:p-3"
              aria-label="Anterior"
            >
              <ChevronLeft size={30} />
            </button>

            <button
              type="button"
              onClick={(event) => {
                event.stopPropagation();
                goTo(1);
              }}
              className="absolute right-2 top-1/2 -translate-y-1/2 rounded-full bg-black/60 p-2 text-white/80 transition hover:bg-white/10 hover:text-white sm:right-6 sm:p-3"
              aria-label="Siguiente"
            >
              <ChevronRight size={30} />
            </button>
          </>
        )}
      </div>

      {/* CONTADOR MÓVIL */}

      <div className="shrink-0 pb-4 text-center text-sm tabular-nums text-white/50 sm:hidden">
        {index + 1} / {items.length}
      </div>
    </div>
  );
}
