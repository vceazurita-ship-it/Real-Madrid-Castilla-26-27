"use client";

import Image from "next/image";
import {
  CalendarDays,
  FileText,
  ImageIcon,
} from "lucide-react";
import { WeekData } from "../data";

interface Props {
  week: WeekData | null;
}

export default function WeekViewer({ week }: Props) {
  if (!week) {
    return (
      <div className="rounded-3xl border border-white/10 bg-[#11161D] p-8">

        <div className="flex h-[500px] flex-col items-center justify-center text-center">

          <CalendarDays
            size={46}
            className="text-[#C8A96B] mb-6"
          />

          <h2 className="text-2xl font-semibold">
            Selecciona una semana
          </h2>

          <p className="mt-3 max-w-md text-white/50 leading-7">
            Pulsa sobre cualquier semana del calendario para
            visualizar las imágenes, el PDF y toda la
            información disponible.
          </p>

        </div>

      </div>
    );
  }

  return (
    <div className="rounded-3xl border border-white/10 bg-[#11161D] overflow-hidden">

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
            {week.pdf ? 1 : 0}
          </p>

        </div>

      </div>

      {/* GALERÍA */}

      <div className="px-8 pb-8">

        <h3 className="mb-5 text-lg font-semibold">
          Imágenes
        </h3>

        {week.images.length === 0 ? (

          <div className="rounded-2xl border border-dashed border-white/10 p-10 text-center text-white/40">
            No hay imágenes disponibles.
          </div>

        ) : (

          <div className="grid grid-cols-2 gap-4">

            {week.images.map((image, index) => (

              <div
                key={index}
                className="group relative aspect-square overflow-hidden rounded-2xl border border-white/10"
              >

                <Image
                  src={image}
                  alt={`${week.week}-${index}`}
                  fill
                  className="object-cover transition duration-500 group-hover:scale-105"
                />

              </div>

            ))}

          </div>

        )}

      </div>

      {/* PDF */}

      <div className="border-t border-white/10 p-8">

        <h3 className="mb-5 text-lg font-semibold">
          Documento semanal
        </h3>

        {week.pdf ? (

          <a
            href={week.pdf}
            target="_blank"
            className="
              flex
              items-center
              justify-between
              rounded-2xl
              border
              border-white/10
              bg-[#0B0F14]
              p-5
              transition
              hover:border-[#C8A96B]
            "
          >

            <div>

              <p className="font-medium">
                Planificación semanal
              </p>

              <span className="text-sm text-white/50">
                Abrir PDF
              </span>

            </div>

            <FileText
              className="text-[#C8A96B]"
              size={24}
            />

          </a>

        ) : (

          <div className="rounded-2xl border border-dashed border-white/10 p-10 text-center text-white/40">
            No hay PDF disponible.
          </div>

        )}

      </div>

    </div>
  );
}