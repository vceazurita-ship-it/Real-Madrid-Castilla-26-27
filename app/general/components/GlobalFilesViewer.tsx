"use client";

import Image from "next/image";
import {
  X,
  FileText,
  ImageIcon,
} from "lucide-react";

interface FileItem {
  url: string;
  week: string;
  month: string;
  start: string;
  end: string;
  weekId: number;
}

interface Props {
  type: "images" | "pdfs";
  files: FileItem[];
  onClose: () => void;
}

export default function GlobalFilesViewer({
  type,
  files,
  onClose,
}: Props) {
  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-[#0B0F14]">

      {/* CABECERA */}

      <div
        className="
          sticky
          top-0
          z-20
          flex
          items-center
          justify-between
          border-b
          border-white/10
          bg-[#0B0F14]/95
          px-6
          py-5
          backdrop-blur
          lg:px-10
        "
      >

        <div className="flex items-center gap-4">

          <div className="rounded-xl bg-[#11161D] p-3 text-[#C8A96B]">

            {type === "images" ? (
              <ImageIcon size={24} />
            ) : (
              <FileText size={24} />
            )}

          </div>

          <div>

            <h2 className="text-xl font-semibold">

              {type === "images"
                ? "Todas las imágenes"
                : "Todos los PDFs"}

            </h2>

            <p className="mt-1 text-sm text-white/50">

              {files.length}{" "}
              {type === "images"
                ? "imágenes"
                : "documentos"}

            </p>

          </div>

        </div>


        {/* CERRAR */}

        <button
          type="button"
          onClick={onClose}
          className="
            rounded-xl
            p-3
            text-white/60
            transition
            hover:bg-white/10
            hover:text-white
          "
          aria-label="Cerrar"
        >

          <X size={24} />

        </button>

      </div>


      {/* CONTENIDO */}

      <div className="p-6 lg:p-10">

        {files.length === 0 ? (

          <div
            className="
              rounded-2xl
              border
              border-dashed
              border-white/10
              p-12
              text-center
              text-white/40
            "
          >

            No hay{" "}
            {type === "images"
              ? "imágenes"
              : "PDFs"}{" "}
            disponibles.

          </div>

        ) : type === "images" ? (

          /* =========================
             GALERÍA DE IMÁGENES
          ========================= */

          <div
            className="
              grid
              grid-cols-1
              gap-6
              md:grid-cols-2
              xl:grid-cols-3
            "
          >

            {files.map((file, index) => (

              <div
                key={`${file.url}-${index}`}
                className="
                  overflow-hidden
                  rounded-2xl
                  border
                  border-white/10
                  bg-[#11161D]
                  transition
                  hover:border-[#C8A96B]/40
                "
              >

                <Image
                  src={file.url}
                  alt={`${file.week} - ${file.month}`}
                  width={1200}
                  height={800}
                  className="
                    h-64
                    w-full
                    object-cover
                  "
                />

                <div className="p-4">

                  <p className="font-medium">
                    {file.week}
                  </p>

                  <p className="mt-1 text-sm text-white/50">
                    {file.month}
                  </p>

                  <p className="mt-1 text-xs text-white/40">
                    {file.start} — {file.end}
                  </p>

                </div>

              </div>

            ))}

          </div>

        ) : (

          /* =========================
             LISTADO DE PDF
          ========================= */

          <div className="space-y-4">

            {files.map((file, index) => {

              const fileName = decodeURIComponent(
                file.url.split("/").pop() ?? "PDF"
              );

              return (

                <a
                  key={`${file.url}-${index}`}
                  href={file.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="
                    flex
                    items-center
                    justify-between
                    gap-4
                    rounded-2xl
                    border
                    border-white/10
                    bg-[#11161D]
                    p-5
                    transition
                    hover:border-[#C8A96B]/50
                    hover:bg-white/[0.04]
                  "
                >

                  <div className="min-w-0">

                    <p className="truncate font-medium">
                      {fileName}
                    </p>

                    <p className="mt-1 text-sm text-white/50">
                      {file.week} · {file.month}
                    </p>

                    <p className="mt-1 text-xs text-white/40">
                      {file.start} — {file.end}
                    </p>

                  </div>

                  <FileText
                    size={24}
                    className="
                      shrink-0
                      text-[#C8A96B]
                    "
                  />

                </a>

              );

            })}

          </div>

        )}

      </div>

    </div>
  );
}