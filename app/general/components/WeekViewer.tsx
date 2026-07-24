"use client";

import Image from "next/image";
import {
  CalendarDays,
  FileText,
  ImageIcon,
  Plus,
} from "lucide-react";
import { WeekData } from "../data";
import UploadZone from "./UploadZone";
import { uploadFile } from "@/lib/uploadFile";
import { useEffect, useState } from "react";
import { deleteFile } from "@/lib/deleteFile";
import { Trash2 } from "lucide-react";
import dynamic from "next/dynamic";
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

interface Props {
  week: WeekData | null;
  updateWeek: (week: WeekData) => void;
}

export default function WeekViewer({
  week,
  updateWeek,
}: Props) {
    const [fullscreenIndex, setFullscreenIndex] = useState<number | null>(null);

const fullscreenImage =
  fullscreenIndex !== null ? week?.images[fullscreenIndex] ?? null : null;
  if (!week) {
    return (
      <div className="rounded-3xl border border-white/10 bg-[#11161D] p-8">
        <div className="flex h-[600px] flex-col items-center justify-center text-center">
          <CalendarDays
            size={48}
            className="mb-6 text-[#C8A96B]"
          />

          <h2 className="text-2xl font-semibold">
            Selecciona una semana
          </h2>

          <p className="mt-4 max-w-md text-white/50 leading-7">
            Pulsa sobre cualquier semana del calendario para
            visualizar las imágenes y el documento PDF de esa
            semana.
          </p>
        </div>
      </div>
    );
  }
const handleImagesUpload = async (files: File[]) => {
  if (!week) return;

  try {
    const uploaded = await Promise.all(
      files.map((file) =>
        uploadFile(
          file,
          `2026/semana-${week.id
            .toString()
            .padStart(2, "0")}/images`
        )
      )
    );

    const urls = uploaded.map((item) => item.url);

    updateWeek({
      ...week,
      images: [...week.images, ...urls],
    });
  } catch (error) {
    console.error(error);
    alert("Error al subir las imágenes");
  }
};
const handlePdfUpload = async (files: File[]) => {
  if (!week) return;

  try {
    const uploaded = await Promise.all(
      files.map((file) =>
        uploadFile(
          file,
          `2026/semana-${week.id
            .toString()
            .padStart(2, "0")}/pdf`
        )
      )
    );

    const urls = uploaded.map((item) => item.url);

    updateWeek({
      ...week,
      pdfs: [...(week.pdfs ?? []), ...urls],
    });

  } catch (error) {
    console.error(error);
    alert("Error al subir los PDFs");
  }
};

const handleDeleteImage = async (image: string) => {
  if (!week) return;

  if (!confirm("¿Eliminar esta imagen?")) return;

  try {
    await deleteFile(image, "general");

    updateWeek({
      ...week,
      images: week.images.filter((img) => img !== image),
    });

  } catch (error) {
    console.error(error);
    alert("No se pudo eliminar la imagen");
  }
};

const handleDeletePdf = async (pdf: string) => {
  if (!week) return;

  if (!confirm("¿Eliminar este PDF?")) return;

  try {
    await deleteFile(pdf, "general");

    updateWeek({
      ...week,
      pdfs: week.pdfs?.filter((p) => p !== pdf) ?? [],
    });
  } catch (error) {
    console.error(error);
    alert("No se pudo eliminar el PDF");
  }
};


useEffect(() => {
  if (fullscreenIndex === null || !week) return;

  const handleKeyDown = (e: KeyboardEvent) => {
    if (e.key === "Escape") {
      setFullscreenIndex(null);
    }

    if (e.key === "ArrowRight") {
      setFullscreenIndex((prev) =>
        prev === null
          ? null
          : (prev + 1) % week.images.length
      );
    }

    if (e.key === "ArrowLeft") {
      setFullscreenIndex((prev) =>
        prev === null
          ? null
          : (prev - 1 + week.images.length) % week.images.length
      );
    }
  };

  window.addEventListener("keydown", handleKeyDown);

  return () => {
    window.removeEventListener("keydown", handleKeyDown);
  };
}, [fullscreenIndex, week]);
useEffect(() => {
  if (
    fullscreenIndex !== null &&
    week &&
    fullscreenIndex >= week.images.length
  ) {
    setFullscreenIndex(null);
  }
}, [week, fullscreenIndex]);
  return (
    <div className="overflow-hidden rounded-3xl border border-white/10 bg-[#11161D]">

      {/* CABECERA */}

      <div className="border-b border-white/10 p-8">

        <p className="text-xs uppercase tracking-[0.3em] text-[#C8A96B]">
          {week.month}
        </p>

        <h2 className="mt-2 text-3xl font-semibold">
          {week.week}
        </h2>

        <p className="mt-3 text-white/60">
          {week.start} — {week.end}
        </p>

      </div>

      {/* ESTADÍSTICAS */}

      <div className="grid grid-cols-2 gap-4 p-8">

        <div className="rounded-2xl bg-[#0B0F14] p-5">

          <div className="flex items-center gap-3 text-[#C8A96B]">

            <ImageIcon size={20} />

            <span className="text-sm uppercase">
              Imágenes
            </span>

          </div>

          <p className="mt-4 text-3xl font-semibold">
            {week.images.length}
          </p>

        </div>

        <div className="rounded-2xl bg-[#0B0F14] p-5">

          <div className="flex items-center gap-3 text-[#C8A96B]">

            <FileText size={20} />

            <span className="text-sm uppercase">
              PDF
            </span>

          </div>

          <p className="mt-4 text-3xl font-semibold">
            {week.pdfs?.length ?? 0}
          </p>

        </div>

      </div>

      {/* SUBIDA DE ARCHIVOS */}

      <div className="px-8 pb-8">

        <h3 className="mb-5 text-lg font-semibold">
          Gestión de archivos
        </h3>

        <div className="grid gap-5 md:grid-cols-2">

  <UploadZone
    type="images"
    maxFiles={20}
    onUpload={handleImagesUpload}
/>

  <UploadZone
    type="pdf"
    onUpload={handlePdfUpload}
/>

</div>

      </div>

      {/* IMÁGENES */}

      <div className="border-t border-white/10 px-8 py-8">

        <div className="mb-5 flex items-center justify-between">

          <h3 className="text-lg font-semibold">
            Imágenes
          </h3>

          

        </div>

        {week.images.length === 0 ? (

          <div className="rounded-2xl border border-dashed border-white/10 p-10 text-center text-white/40">
            No hay imágenes disponibles.
          </div>

        ) : (

          <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">

            {week.images.map((image, index) => (

              <div
  key={index}
  className="relative overflow-hidden rounded-2xl border border-white/10 bg-black"
>

 <button
    type="button"
    onClick={() => handleDeleteImage(image)}
    className="
      absolute
      top-3
      right-3
      z-10
      rounded-lg
      bg-red-600/90
      p-2
      text-white
      hover:bg-red-700
    "
  >
    <Trash2 size={16} />
  </button>

  <div className="relative w-full">

  <button
    type="button"
    onClick={() => setFullscreenIndex(index)}
    className="block w-full cursor-zoom-in"
  >
    <Image
      src={image}
      alt={`${week.week}-${index}`}
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
      priority={index === 0}
    />
  </button>
</div></div>

            ))}

          </div>

        )}

      </div>

      {/* PDF */}

      <div className="border-t border-white/10 p-8">

        <div className="mb-5 flex items-center justify-between">

          <h3 className="text-lg font-semibold">
            Documento semanal
          </h3>

    

        </div>

        {week.pdfs && week.pdfs.length > 0 ? (

  <div className="space-y-6">

    {week.pdfs.map((pdf, index) => {

      const fileName = decodeURIComponent(
        pdf.split("/").pop() ?? "PDF"
      );

      return (

        <div
          key={index}
          className="
            overflow-hidden
            rounded-2xl
            border
            border-white/10
            bg-[#0B0F14]
          "
        >

          {/* PREVISUALIZACIÓN DE LA PRIMERA PÁGINA */}

          <a
            href={pdf}
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

            <PdfPreview file={pdf} />

          </a>


          {/* INFORMACIÓN Y ACCIONES */}

          <div
            className="
              flex
              items-center
              justify-between
              gap-4
              p-5
            "
          >

            <a
              href={pdf}
              target="_blank"
              rel="noopener noreferrer"
              className="min-w-0 flex-1"
            >

              <p className="truncate font-medium">
                {fileName}
              </p>

              <span className="text-sm text-white/50">
                Abrir PDF completo
              </span>

            </a>


            <div className="flex items-center gap-3">

              <FileText
                size={24}
                className="shrink-0 text-[#C8A96B]"
              />

              <a
                href={pdf}
                download
                target="_blank"
                rel="noopener noreferrer"
                className="
                  rounded-lg
                  border
                  border-white/10
                  px-3
                  py-2
                  text-sm
                  text-white/70
                  transition
                  hover:bg-white/[0.06]
                  hover:text-white
                "
              >
                Descargar
              </a>

              <button
                type="button"
                onClick={() => handleDeletePdf(pdf)}
                className="
                  rounded-lg
                  bg-red-600
                  p-2
                  text-white
                  transition
                  hover:bg-red-700
                "
              >
                <Trash2 size={16} />
              </button>

            </div>

          </div>

        </div>

      );

    })}

  </div>

) : (

  <div className="rounded-2xl border border-dashed border-white/10 p-10 text-center text-white/40">
    No hay PDF disponible.
  </div>

)}

      </div>

    
          {fullscreenImage && (
        <div
          className="
            fixed
            inset-0
            z-50
            flex
            items-center
            justify-center
            bg-black/90
            p-6
          "
          onClick={() => setFullscreenIndex(null)}
        >

          <button
  type="button"
  className="
    absolute
    right-6
    top-6
    text-3xl
    text-white/80
    hover:text-white
  "
  onClick={() => setFullscreenIndex(null)}
>
  ✕
</button>

<button
  type="button"
  onClick={(e) => {
    e.stopPropagation();
    setFullscreenIndex(
      (fullscreenIndex! - 1 + week.images.length) %
        week.images.length
    );
  }}
  className="
    absolute
    left-6
    top-1/2
    -translate-y-1/2
    text-6xl
    text-white/70
    hover:text-white
    transition
  "
>
  ‹
</button>

<button
  type="button"
  onClick={(e) => {
    e.stopPropagation();
    setFullscreenIndex(
      (fullscreenIndex! + 1) %
        week.images.length
    );
  }}
  className="
    absolute
    right-6
    top-1/2
    -translate-y-1/2
    text-6xl
    text-white/70
    hover:text-white
    transition
  "
>
  ›
</button>

<Image
  src={fullscreenImage}
  alt="Imagen ampliada"
  width={2400}
  height={1600}
  className="
    max-h-[90vh]
    w-auto
    rounded-xl
    object-contain
  "
  onClick={(e) => e.stopPropagation()}
/>

        </div>
      )}
      </div>
  );
}