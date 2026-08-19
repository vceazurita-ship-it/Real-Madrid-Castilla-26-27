"use client";

import { useMemo, useState } from "react";
import { FileText, ImageIcon, Search, X } from "lucide-react";
import { FileKind, SeasonFile } from "@/lib/season/types";
import { fileNameFromUrl } from "@/lib/season/utils";
import { useBodyScrollLock } from "./useBodyScrollLock";
import ImageGrid from "./ImageGrid";
import Lightbox from "./Lightbox";
import PdfCard from "./PdfCard";

interface Props {
  kind: FileKind;
  files: SeasonFile[];
  onClose: () => void;
  onSelectWeek: (weekId: number) => void;
}

export default function SeasonFilesViewer({
  kind,
  files,
  onClose,
  onSelectWeek,
}: Props) {
  const [query, setQuery] = useState("");
  const [month, setMonth] = useState("all");
  const [order, setOrder] = useState<"recent" | "oldest">("recent");
  const [lightboxIndex, setLightboxIndex] = useState<number | null>(null);

  useBodyScrollLock(true);

  const months = useMemo(
    () => Array.from(new Set(files.map((file) => file.month))),
    [files]
  );

  const visible = useMemo(() => {
    const normalized = query.trim().toLowerCase();

    const filtered = files.filter((file) => {
      if (month !== "all" && file.month !== month) return false;

      if (!normalized) return true;

      return [fileNameFromUrl(file.url), file.week, file.month]
        .join(" ")
        .toLowerCase()
        .includes(normalized);
    });

    return order === "recent"
      ? filtered
      : [...filtered].sort((a, b) => a.weekId - b.weekId);
  }, [files, query, month, order]);

  const isImages = kind === "images";

  const goToWeek = (weekId: number) => {
    onSelectWeek(weekId);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-[60] overflow-y-auto bg-[#0B0F14]">
      {/* CABECERA */}

      <div className="sticky top-0 z-20 border-b border-white/10 bg-[#0B0F14]/95 backdrop-blur">
        <div className="flex items-center justify-between gap-4 px-5 py-4 lg:px-10">
          <div className="flex min-w-0 items-center gap-4">
            <div className="rounded-xl bg-[#11161D] p-3 text-[#C8A96B]">
              {isImages ? <ImageIcon size={22} /> : <FileText size={22} />}
            </div>

            <div className="min-w-0">
              <h2 className="truncate text-lg font-semibold sm:text-xl">
                {isImages ? "Todas las imágenes" : "Todos los PDFs"}
              </h2>

              <p className="mt-0.5 text-sm text-white/50">
                {visible.length}
                {visible.length !== files.length && ` de ${files.length}`}{" "}
                {isImages ? "imágenes" : "documentos"}
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            aria-label="Cerrar"
            className="shrink-0 rounded-xl p-3 text-white/60 transition hover:bg-white/10 hover:text-white"
          >
            <X size={22} />
          </button>
        </div>

        {/* FILTROS */}

        {files.length > 0 && (
          <div className="flex flex-wrap items-center gap-2 px-5 pb-4 lg:px-10">
            <div className="relative min-w-[200px] flex-1 sm:max-w-xs">
              <Search
                size={16}
                className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-white/30"
              />

              <input
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="Buscar por nombre o semana..."
                aria-label="Buscar archivo"
                className="w-full rounded-xl border border-white/10 bg-[#11161D] py-2.5 pl-10 pr-3 text-sm text-white placeholder:text-white/30 focus:border-[#C8A96B]/50 focus:outline-none"
              />
            </div>

            <select
              value={month}
              onChange={(event) => setMonth(event.target.value)}
              aria-label="Filtrar por mes"
              className="rounded-xl border border-white/10 bg-[#11161D] px-3 py-2.5 text-sm text-white/70 focus:border-[#C8A96B]/50 focus:outline-none"
            >
              <option value="all">Todos los meses</option>

              {months.map((name) => (
                <option key={name} value={name}>
                  {name}
                </option>
              ))}
            </select>

            <select
              value={order}
              onChange={(event) =>
                setOrder(event.target.value as "recent" | "oldest")
              }
              aria-label="Ordenar"
              className="rounded-xl border border-white/10 bg-[#11161D] px-3 py-2.5 text-sm text-white/70 focus:border-[#C8A96B]/50 focus:outline-none"
            >
              <option value="recent">Más recientes primero</option>
              <option value="oldest">Más antiguos primero</option>
            </select>

            {(query || month !== "all") && (
              <button
                type="button"
                onClick={() => {
                  setQuery("");
                  setMonth("all");
                }}
                className="rounded-xl border border-white/10 px-3 py-2.5 text-sm text-white/50 transition hover:bg-white/[0.06] hover:text-white"
              >
                Limpiar
              </button>
            )}
          </div>
        )}
      </div>

      {/* CONTENIDO */}

      <div className="p-5 lg:p-10">
        {visible.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-white/10 p-14 text-center text-white/40">
            {files.length === 0
              ? `Todavía no hay ${isImages ? "imágenes" : "PDFs"} en la temporada.`
              : "Ningún archivo coincide con los filtros."}
          </div>
        ) : isImages ? (
          <ImageGrid
            items={visible.map((file) => ({
              url: file.url,
              caption: file.week,
              subtitle: `${file.month} · ${file.start} — ${file.end}`,
            }))}
            columnsClassName="grid-cols-1 md:grid-cols-2 xl:grid-cols-3"
            onOpen={setLightboxIndex}
            onGoToWeek={(index) => goToWeek(visible[index].weekId)}
          />
        ) : (
          <div className="space-y-4">
            {visible.map((file, index) => (
              <PdfCard
                key={`${file.url}-${index}`}
                url={file.url}
                meta={`${file.week} · ${file.month} · ${file.start} — ${file.end}`}
                onGoToWeek={() => goToWeek(file.weekId)}
              />
            ))}
          </div>
        )}
      </div>

      {isImages && (
        <Lightbox
          items={visible.map((file) => ({
            url: file.url,
            caption: fileNameFromUrl(file.url),
            subtitle: `${file.week} · ${file.month}`,
          }))}
          index={lightboxIndex}
          onIndexChange={setLightboxIndex}
          onClose={() => setLightboxIndex(null)}
        />
      )}
    </div>
  );
}
