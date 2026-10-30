"use client";

import { useCallback } from "react";
import { useDropzone, FileRejection } from "react-dropzone";
import { FileText, ImageIcon, Loader2, UploadCloud } from "lucide-react";
import { toast } from "sonner";

interface Props {
  /** «todo»: una sola zona para imágenes y PDF (29/10/2026, /general). */
  type: "images" | "pdf" | "todo";
  maxFiles?: number;
  busy?: boolean;
  busyLabel?: string;
  onUpload: (files: File[]) => void;
  /** Para llegar a ella desde el botón de la cabecera (30/10/2026). */
  id?: string;
  /** El texto del botón, si no es «Seleccionar archivos». */
  boton?: string;
  /** Una fila en vez del bloque grande (30/10/2026): la semana vacía no necesita media pantalla de zona. */
  compacta?: boolean;
  /** Lo que se dice delante en la fila compacta («Esta semana no hay material»). */
  estado?: string;
}

const ACCEPT = {
  images: {
    "image/jpeg": [],
    "image/png": [],
    "image/webp": [],
  },
  pdf: {
    "application/pdf": [],
  },
  todo: {
    "image/jpeg": [],
    "image/png": [],
    "image/webp": [],
    "application/pdf": [],
  },
} as const;

export default function UploadZone({
  type,
  maxFiles = 20,
  busy = false,
  busyLabel = "Subiendo archivos...",
  onUpload,
  id,
  boton = "Seleccionar archivos",
  compacta = false,
  estado,
}: Props) {
  const onDrop = useCallback(
    (accepted: File[], rejected: FileRejection[]) => {
      if (rejected.length > 0) {
        toast.error(
          rejected.length === 1
            ? `"${rejected[0].file.name}" no es un archivo válido.`
            : `${rejected.length} archivos descartados por formato o límite.`
        );
      }

      if (accepted.length > 0) onUpload(accepted);
    },
    [onUpload]
  );

  const { getRootProps, getInputProps, isDragActive, open } = useDropzone({
    onDrop,
    disabled: busy,
    multiple: maxFiles > 1,
    maxFiles,
    accept: ACCEPT[type],
    noClick: true,
    noKeyboard: true,
  });

  const formatos =
    type === "todo"
      ? `JPG · PNG · WEBP · PDF · hasta ${maxFiles} archivos`
      : type === "images"
        ? `JPG · PNG · WEBP · hasta ${maxFiles} archivos`
        : `PDF · hasta ${maxFiles} archivos`;

  if (compacta) {
    return (
      <div
        {...getRootProps()}
        id={id}
        className={`flex min-w-0 flex-wrap items-center gap-x-4 gap-y-2 rounded-2xl border-2 border-dashed px-4 py-3 transition ${
          isDragActive ? "border-[#C8A96B] bg-[#161D26]" : "border-white/10 bg-[#0B0F14]"
        } ${busy ? "opacity-70" : ""}`}
      >
        <input {...getInputProps()} />

        <span className="min-w-0 flex-1">
          <span className="block text-sm font-medium text-white/85">
            {busy ? busyLabel : isDragActive ? "Suelta los archivos aquí" : estado ?? "Arrastra los archivos o pulsa el botón"}
          </span>
          <span className="block text-[13px] text-white/65">{formatos} · o arrástralos aquí</span>
        </span>

        <button
          type="button"
          onClick={open}
          disabled={busy}
          className="inline-flex min-h-11 shrink-0 items-center gap-2 rounded-xl bg-[#C8A96B] px-4 text-sm font-semibold text-[#0B0F14] transition hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {busy ? <Loader2 size={16} className="animate-spin" /> : <UploadCloud size={16} />}
          {boton}
        </button>
      </div>
    );
  }

  return (
    <div
      {...getRootProps()}
      id={id}
      className={`rounded-3xl border-2 border-dashed p-8 text-center transition-all duration-300 ${
        busy
          ? "border-white/10 bg-[#0B0F14] opacity-70"
          : isDragActive
            ? "border-[#C8A96B] bg-[#161D26]"
            : "border-white/10 bg-[#0B0F14] hover:border-[#C8A96B]/50 hover:bg-[#141A22]"
      }`}
    >
      <input {...getInputProps()} />

      <div className="flex flex-col items-center">
        <div className="mb-5 flex h-16 w-16 items-center justify-center rounded-full border border-white/10 bg-[#11161D] text-[#C8A96B]">
          {busy ? (
            <Loader2 size={28} className="animate-spin" />
          ) : type === "todo" ? (
            <UploadCloud size={28} />
          ) : type === "images" ? (
            <ImageIcon size={28} />
          ) : (
            <FileText size={28} />
          )}
        </div>

        <h3 className="text-lg font-semibold">
          {type === "todo" ? "Subir imágenes o PDFs" : type === "images" ? "Subir imágenes" : "Subir PDFs"}
        </h3>

        <p className="mt-2 max-w-xs text-sm leading-6 text-white/50">
          {busy
            ? busyLabel
            : isDragActive
              ? "Suelta los archivos aquí"
              : "Arrastra los archivos o pulsa el botón"}
        </p>

        <button
          type="button"
          onClick={open}
          disabled={busy}
          className="mt-6 inline-flex items-center gap-2 rounded-full border border-[#C8A96B]/30 bg-[#11161D] px-5 py-2.5 text-sm font-medium transition hover:border-[#C8A96B] hover:bg-[#161D26] disabled:cursor-not-allowed disabled:opacity-50"
        >
          <UploadCloud size={18} className="text-[#C8A96B]" />
          {boton}
        </button>

        <p className="mt-4 text-[13px] text-white/65">{formatos}</p>
      </div>
    </div>
  );
}
