"use client";

import { useCallback } from "react";
import { useDropzone } from "react-dropzone";
import {
  UploadCloud,
  ImageIcon,
  FileText,
} from "lucide-react";

interface UploadZoneProps {
  type: "images" | "pdf";
  maxFiles?: number;
  onUpload?: (files: File[]) => void;
}

export default function UploadZone({
  type,
  maxFiles = 1,
  onUpload,
}: UploadZoneProps) {
  const onDrop = useCallback(
    (acceptedFiles: File[]) => {
      if (onUpload) {
        onUpload(acceptedFiles);
      }
    },
    [onUpload]
  );

  const {
    getRootProps,
    getInputProps,
    isDragActive,
  } = useDropzone({
    onDrop,
    multiple: type === "images" || maxFiles > 1,
    maxFiles,
    accept:
      type === "images"
        ? {
            "image/jpeg": [],
            "image/png": [],
            "image/webp": [],
          }
        : {
            "application/pdf": [],
          },
  });

  return (
    <div
      {...getRootProps()}
      className={`
        cursor-pointer
        rounded-3xl
        border-2
        border-dashed
        p-10
        transition-all
        duration-300
        ${
          isDragActive
            ? "border-[#C8A96B] bg-[#161D26]"
            : "border-white/10 bg-[#0B0F14] hover:border-[#C8A96B]/50 hover:bg-[#141A22]"
        }
      `}
    >
      <input {...getInputProps()} />

      <div className="flex flex-col items-center text-center">
        <div
          className="
            mb-6
            flex
            h-20
            w-20
            items-center
            justify-center
            rounded-full
            bg-[#11161D]
            border
            border-white/10
          "
        >
          {type === "images" ? (
            <ImageIcon
              size={36}
              className="text-[#C8A96B]"
            />
          ) : (
            <FileText
              size={36}
              className="text-[#C8A96B]"
            />
          )}
        </div>

        <h3 className="text-xl font-semibold">
          {type === "images"
            ? "Subir imágenes"
            : "Subir PDFs"}
        </h3>

        <p className="mt-3 max-w-md text-white/60 leading-7">
          {isDragActive
            ? "Suelta los archivos aquí..."
            : "Arrastra archivos aquí o pulsa para seleccionarlos"}
        </p>

        <div className="mt-8 flex items-center gap-3 rounded-full border border-[#C8A96B]/30 bg-[#11161D] px-6 py-3">
          <UploadCloud
            size={20}
            className="text-[#C8A96B]"
          />

          <span className="text-sm font-medium">
            Seleccionar archivos
          </span>
        </div>

        <div className="mt-6 text-sm text-white/40">
  {type === "images"
    ? "JPG · PNG · WEBP"
    : "PDF"}
</div>
      </div>
    </div>
  );
}