"use client";

import dynamic from "next/dynamic";
import { useState } from "react";
import {
  ChevronDown,
  Download,
  ExternalLink,
  Eye,
  FileText,
  Trash2,
} from "lucide-react";
import { downloadUrl, fileNameFromUrl } from "@/lib/season/utils";

const PdfPreview = dynamic(
  () => import("@/components/performance/PdfPreview"),
  {
    ssr: false,
    loading: () => (
      <div className="flex h-[420px] items-center justify-center text-sm text-white/40">
        Cargando previsualización...
      </div>
    ),
  }
);

interface Props {
  url: string;
  meta?: string;
  defaultOpen?: boolean;
  onDelete?: () => void;
  onGoToWeek?: () => void;
  goToWeekLabel?: string;
}

export default function PdfCard({
  url,
  meta,
  defaultOpen = false,
  onDelete,
  onGoToWeek,
  goToWeekLabel,
}: Props) {
  const [open, setOpen] = useState(defaultOpen);

  const name = fileNameFromUrl(url);

  return (
    <div className="overflow-hidden rounded-2xl border border-white/10 bg-[#0B0F14] transition hover:border-[#C8A96B]/40">
      {/* CABECERA */}

      <div className="flex flex-wrap items-center gap-4 p-4">
        <div className="rounded-xl bg-[#11161D] p-3 text-[#C8A96B]">
          <FileText size={20} />
        </div>

        <div className="min-w-0 flex-1">
          <p className="truncate font-medium" title={name}>
            {name}
          </p>

          {meta && <p className="mt-0.5 text-xs text-white/40">{meta}</p>}
        </div>

        <div className="flex items-center gap-1.5">
          <button
            type="button"
            onClick={() => setOpen((value) => !value)}
            aria-expanded={open}
            className="inline-flex items-center gap-1.5 rounded-lg border border-white/10 px-3 py-2 text-xs text-white/70 transition hover:bg-white/[0.06] hover:text-white"
          >
            <Eye size={15} />

            <span className="hidden sm:inline">
              {open ? "Ocultar" : "Previsualizar"}
            </span>

            <ChevronDown
              size={14}
              className={`transition-transform ${open ? "rotate-180" : ""}`}
            />
          </button>

          <a
            href={url}
            target="_blank"
            rel="noopener noreferrer"
            title="Abrir PDF completo"
            className="rounded-lg border border-white/10 p-2 text-white/70 transition hover:bg-white/[0.06] hover:text-white"
          >
            <ExternalLink size={15} />
          </a>

          <a
            href={downloadUrl(url)}
            download
            title="Descargar"
            className="rounded-lg border border-white/10 p-2 text-white/70 transition hover:bg-white/[0.06] hover:text-white"
          >
            <Download size={15} />
          </a>

          {onDelete && (
            <button
              type="button"
              onClick={onDelete}
              title="Eliminar PDF"
              className="rounded-lg border border-red-500/20 p-2 text-red-400/80 transition hover:bg-red-500/10 hover:text-red-300"
            >
              <Trash2 size={15} />
            </button>
          )}
        </div>

        {onGoToWeek && (
          <button
            type="button"
            onClick={onGoToWeek}
            className="w-full rounded-lg border border-[#C8A96B]/30 px-3 py-2 text-xs text-[#C8A96B] transition hover:bg-[#C8A96B]/10 sm:w-auto"
          >
            {goToWeekLabel ?? "Ir a la semana"} →
          </button>
        )}
      </div>

      {/* PREVISUALIZACIÓN */}

      {open && (
        <a
          href={url}
          target="_blank"
          rel="noopener noreferrer"
          className="block border-t border-white/10 bg-black"
        >
          <PdfPreview file={url} />
        </a>
      )}
    </div>
  );
}
