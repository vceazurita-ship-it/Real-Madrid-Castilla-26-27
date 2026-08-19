"use client";

import { useCallback } from "react";
import { useDropzone, FileRejection } from "react-dropzone";
import { FileText, ImageIcon, Loader2, UploadCloud } from "lucide-react";
import { toast } from "sonner";

interface Props {
  type: "images" | "pdf";
  maxFiles?: number;
  busy?: boolean;
  busyLabel?: string;
  onUpload: (files: File[]) => void;
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
} as const;

export default function UploadZone({
  type,
  maxFiles = 20,
  busy = false,
  busyLabel = "Subiendo archivos...",
  onUpload,
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

  return (
    <div
      {...getRootProps()}
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
          ) : type === "images" ? (
            <ImageIcon size={28} />
          ) : (
            <FileText size={28} />
          )}
        </div>

        <h3 className="text-lg font-semibold">
          {type === "images" ? "Subir imágenes" : "Subir PDFs"}
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
          Seleccionar archivos
        </button>

        <p className="mt-4 text-xs text-white/30">
          {type === "images"
            ? `JPG · PNG · WEBP · hasta ${maxFiles} archivos`
            : `PDF · hasta ${maxFiles} archivos`}
        </p>
      </div>
    </div>
  );
}
