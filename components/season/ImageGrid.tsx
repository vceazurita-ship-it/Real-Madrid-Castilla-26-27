"use client";

import Image from "next/image";
import { Download, Maximize2, Trash2 } from "lucide-react";
import { downloadUrl } from "@/lib/season/utils";

export interface ImageGridItem {
  url: string;
  caption?: string;
  subtitle?: string;
}

interface Props {
  items: ImageGridItem[];
  /** "contain" muestra la imagen completa; "cover" recorta para una rejilla uniforme. */
  fit?: "contain" | "cover";
  columnsClassName?: string;
  onOpen: (index: number) => void;
  onDelete?: (index: number) => void;
  onGoToWeek?: (index: number) => void;
}

export default function ImageGrid({
  items,
  fit = "contain",
  columnsClassName = "grid-cols-1 sm:grid-cols-2",
  onOpen,
  onDelete,
  onGoToWeek,
}: Props) {
  return (
    <div className={`grid gap-4 ${columnsClassName}`}>
      {items.map((item, index) => (
        <div
          key={`${item.url}-${index}`}
          className="group overflow-hidden rounded-2xl border border-white/10 bg-[#0B0F14] transition hover:border-[#C8A96B]/40"
        >
          <div className="relative aspect-[4/3] w-full bg-black">
            <button
              type="button"
              onClick={() => onOpen(index)}
              className="block h-full w-full cursor-zoom-in"
              aria-label={`Ampliar ${item.caption ?? "imagen"}`}
            >
              <Image
                src={item.url}
                alt={item.caption ?? `Imagen ${index + 1}`}
                fill
                sizes="(max-width: 768px) 100vw, 40vw"
                className={
                  fit === "cover"
                    ? "object-cover transition duration-300 group-hover:scale-[1.02]"
                    : "object-contain transition duration-300 group-hover:scale-[1.02]"
                }
                loading={index < 4 ? "eager" : "lazy"}
              />
            </button>

            {/* ACCIONES */}

            <div className="pointer-events-none absolute inset-x-0 top-0 flex justify-end gap-1.5 bg-gradient-to-b from-black/70 to-transparent p-2 opacity-0 transition group-hover:opacity-100 focus-within:opacity-100">
              <button
                type="button"
                onClick={() => onOpen(index)}
                title="Ampliar"
                className="pointer-events-auto rounded-lg bg-black/70 p-2 text-white/80 transition hover:bg-black hover:text-white"
              >
                <Maximize2 size={15} />
              </button>

              <a
                href={downloadUrl(item.url)}
                download
                title="Descargar"
                className="pointer-events-auto rounded-lg bg-black/70 p-2 text-white/80 transition hover:bg-black hover:text-white"
              >
                <Download size={15} />
              </a>

              {onDelete && (
                <button
                  type="button"
                  onClick={() => onDelete(index)}
                  title="Eliminar imagen"
                  className="pointer-events-auto rounded-lg bg-red-600/90 p-2 text-white transition hover:bg-red-600"
                >
                  <Trash2 size={15} />
                </button>
              )}
            </div>
          </div>

          {(item.caption || item.subtitle || onGoToWeek) && (
            <div className="flex items-center justify-between gap-3 px-4 py-3">
              <div className="min-w-0">
                {item.caption && (
                  <p className="truncate text-sm font-medium">{item.caption}</p>
                )}

                {item.subtitle && (
                  <p className="truncate text-xs text-white/40">
                    {item.subtitle}
                  </p>
                )}
              </div>

              {onGoToWeek && (
                <button
                  type="button"
                  onClick={() => onGoToWeek(index)}
                  className="shrink-0 rounded-lg border border-[#C8A96B]/30 px-2.5 py-1.5 text-xs text-[#C8A96B] transition hover:bg-[#C8A96B]/10"
                >
                  Ir a la semana →
                </button>
              )}
            </div>
          )}
        </div>
      ))}
    </div>
  );
}
