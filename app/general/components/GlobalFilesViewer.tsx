"use client";

import Image from "next/image";
import { useEffect, useState, useRef } from "react";
import dynamic from "next/dynamic";
import {
  X,
  FileText,
  ImageIcon,
  ChevronLeft,
  ChevronRight,
} from "lucide-react";
const PdfPreview = dynamic(
  () => import("../../../components/performance/PdfPreview"),
  {
    ssr: false,
    loading: () => (
      <div className="flex h-[500px] items-center justify-center text-white/40">
        Cargando previsualización...
      </div>
    ),
  }
);
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

  const [fullscreenIndex, setFullscreenIndex] = useState<number | null>(
    null
  );

  const touchStartX = useRef<number | null>(null);
  const touchEndX = useRef<number | null>(null);

    const showNextImage = () => {
    setFullscreenIndex((current) => {
      if (current === null || files.length === 0) return current;

      return (current + 1) % files.length;
    });
  };

  const showPreviousImage = () => {
    setFullscreenIndex((current) => {
      if (current === null || files.length === 0) return current;

      return (
        (current - 1 + files.length) %
        files.length
      );
    });
  };

    useEffect(() => {
    if (fullscreenIndex === null) return;

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setFullscreenIndex(null);
      }

      if (event.key === "ArrowRight") {
        showNextImage();
      }

      if (event.key === "ArrowLeft") {
        showPreviousImage();
      }
    };

    window.addEventListener(
      "keydown",
      handleKeyDown
    );

    return () => {
      window.removeEventListener(
        "keydown",
        handleKeyDown
      );
    };
  }, [fullscreenIndex, files.length]);

    const handleTouchStart = (
    event: React.TouchEvent
  ) => {
    touchStartX.current =
      event.changedTouches[0].screenX;
  };

  const handleTouchEnd = (
    event: React.TouchEvent
  ) => {
    touchEndX.current =
      event.changedTouches[0].screenX;

    if (
      touchStartX.current === null ||
      touchEndX.current === null
    ) {
      return;
    }

    const distance =
      touchStartX.current -
      touchEndX.current;

    const minimumSwipeDistance = 50;

    if (
      Math.abs(distance) <
      minimumSwipeDistance
    ) {
      return;
    }

    if (distance > 0) {
      showNextImage();
    } else {
      showPreviousImage();
    }

    touchStartX.current = null;
    touchEndX.current = null;
  };

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

                <button
  type="button"
  onClick={() => setFullscreenIndex(index)}
  className="block w-full cursor-zoom-in"
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
      transition
      duration-300
      hover:scale-[1.02]
    "
  />
</button>

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

          <div className="space-y-6">

  {files.map((file, index) => {

    const fileName = decodeURIComponent(
      file.url.split("/").pop() ?? "PDF"
    );

    return (

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

        {/* PREVISUALIZACIÓN DEL PDF */}

        <a
          href={file.url}
          target="_blank"
          rel="noopener noreferrer"
          className="
            group
            block
            cursor-pointer
            border-b
            border-white/10
            bg-black
          "
        >

          <PdfPreview file={file.url} />

        </a>


        {/* INFORMACIÓN */}

        <div className="p-4">

          <p className="truncate font-medium">
            {fileName}
          </p>

          <p className="mt-1 text-sm text-white/50">
            {file.week} · {file.month}
          </p>

          <p className="mt-1 text-xs text-white/40">
            {file.start} — {file.end}
          </p>

          <p className="mt-2 text-xs text-[#C8A96B]">
            Abrir PDF completo →
          </p>

        </div>

      </div>

    );

  })}

</div>

        )}

      </div>
      {fullscreenIndex !== null &&
        files[fullscreenIndex] && (
          <div
            className="
              fixed
              inset-0
              z-[60]
              flex
              items-center
              justify-center
              bg-black/95
              p-4
              sm:p-6
            "
            onClick={() =>
              setFullscreenIndex(null)
            }
            onTouchStart={handleTouchStart}
            onTouchEnd={handleTouchEnd}
          >

            {/* CERRAR */}

            <button
              type="button"
              onClick={() =>
                setFullscreenIndex(null)
              }
              className="
                absolute
                right-4
                top-4
                z-20
                rounded-full
                bg-black/50
                p-3
                text-white/80
                transition
                hover:bg-white/10
                hover:text-white
                sm:right-6
                sm:top-6
              "
            >
              <X size={26} />
            </button>


            {/* ANTERIOR */}

            <button
              type="button"
              onClick={(event) => {
                event.stopPropagation();
                showPreviousImage();
              }}
              className="
                absolute
                left-2
                top-1/2
                z-20
                -translate-y-1/2
                rounded-full
                bg-black/50
                p-2
                text-white/80
                transition
                hover:bg-white/10
                hover:text-white
                sm:left-6
                sm:p-3
              "
            >
              <ChevronLeft
                size={32}
              />
            </button>


            {/* IMAGEN */}

            <Image
              src={files[fullscreenIndex].url}
              alt={
                files[fullscreenIndex].week
              }
              width={2400}
              height={1600}
              className="
                max-h-[90vh]
                max-w-[90vw]
                rounded-xl
                object-contain
                select-none
              "
              onClick={(event) =>
                event.stopPropagation()
              }
            />


            {/* SIGUIENTE */}

            <button
              type="button"
              onClick={(event) => {
                event.stopPropagation();
                showNextImage();
              }}
              className="
                absolute
                right-2
                top-1/2
                z-20
                -translate-y-1/2
                rounded-full
                bg-black/50
                p-2
                text-white/80
                transition
                hover:bg-white/10
                hover:text-white
                sm:right-6
                sm:p-3
              "
            >
              <ChevronRight
                size={32}
              />
            </button>


            {/* INFORMACIÓN */}

            <div
              className="
                absolute
                bottom-4
                left-1/2
                -translate-x-1/2
                rounded-xl
                bg-black/60
                px-4
                py-2
                text-center
                text-sm
                text-white/70
              "
            >
              {fullscreenIndex + 1} /{" "}
              {files.length}
            </div>

          </div>
        )}
    </div>
    
  );
}