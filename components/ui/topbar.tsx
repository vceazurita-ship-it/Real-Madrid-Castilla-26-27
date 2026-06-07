"use client";

import { useState } from "react";
import Image from "next/image";
import { AIInsightsPanel } from "@/components/ai-insights-panel";


export function Topbar() {
  const [isAIOpen, setIsAIOpen] = useState(false);
  return (
    <header className="sticky top-0 z-30 border-b border-white/10 bg-[#0B0F14]/85 backdrop-blur-xl">
      <div className="flex items-center justify-between px-4 py-4 md:px-10 md:py-5">

        {/* LEFT */}
        <div className="ml-16 flex items-center gap-3 md:ml-0 md:gap-5">

          <div className="flex h-12 w-12 items-center justify-center rounded-full border border-white/10 bg-white/[0.03] shadow-[0_0_30px_rgba(200,169,107,0.08)] md:h-14 md:w-14">

            <Image
              src="/logo.png"
              alt="Real Madrid C"
              width={34}
              height={34}
              priority
            />

          </div>

          <div>
            <p className="text-[10px] uppercase tracking-[0.28em] text-[#C8A96B] md:text-[11px] md:tracking-[0.35em]">
              Real Madrid C
            </p>

            <h2 className="mt-1 text-xl font-semibold tracking-tight text-white md:text-2xl">
              Plataforma Integral
            </h2>
          </div>

        </div>

        {/* RIGHT */}
        <div className="flex items-center gap-3">

          <div className="rounded-2xl border border-white/10 bg-white/[0.03] px-3 py-2 md:px-4 md:py-3">

            <p className="text-[9px] uppercase tracking-[0.22em] text-gray-500 md:text-[10px]">
              Season
            </p>

            <p className="mt-1 text-sm font-medium text-white">
              2025 — 2026
            </p>

          </div>

          <button
  onClick={() => setIsAIOpen(true)}
  className="
    hidden md:flex
    items-center gap-2
    rounded-2xl
    border border-[#C8A96B]/30
    bg-white/[0.03]
    px-4 py-3
    transition-all
    hover:border-[#C8A96B]
    hover:bg-white/[0.05]
  "
>
  <span className="text-[#C8A96B]">
    ✨
  </span>

  <span className="text-sm font-medium text-white">
    Analizar
  </span>
</button>

        </div>

      </div>
          {isAIOpen && (
        <>
          {/* Fondo oscuro */}
          <div
            onClick={() => setIsAIOpen(false)}
            className="fixed inset-0 z-40 bg-black/50"
          />

          {/* Panel IA */}
          <div
            className="
              fixed
              top-0
              right-0
              z-50
              h-screen
              w-[420px]
              max-w-[90vw]
              border-l
              border-white/10
              bg-[#0B0F14]
              p-6
              shadow-2xl
            "
          >
            <div className="flex items-center justify-between">
              <h2 className="text-xl font-semibold text-white">
                ✨ Asistente IA
              </h2>

              <button
                onClick={() => setIsAIOpen(false)}
                className="text-white/60 hover:text-white"
              >
                ✕
              </button>
            </div>

            <div className="mt-8 space-y-3">
              <button className="w-full rounded-xl border border-white/10 p-3 text-left hover:bg-white/[0.03]">
                Resumir página
              </button>

              <button className="w-full rounded-xl border border-white/10 p-3 text-left hover:bg-white/[0.03]">
                Detectar fortalezas
              </button>

              <button className="w-full rounded-xl border border-white/10 p-3 text-left hover:bg-white/[0.03]">
                Detectar debilidades
              </button>

              <button className="w-full rounded-xl border border-white/10 p-3 text-left hover:bg-white/[0.03]">
                Comparar rendimiento
              </button>
            </div>

            <div className="mt-8">
              <textarea
                placeholder="Pregunta sobre esta página..."
                className="
                  w-full
                  rounded-xl
                  border
                  border-white/10
                  bg-white/[0.03]
                  p-4
                  text-white
                  outline-none
                "
                rows={5}
              />
            </div>

            <div className="mt-4 flex justify-between">
              <button className="rounded-xl border border-white/10 px-4 py-2">
                🎤
              </button>

              <button className="rounded-xl bg-[#C8A96B] px-5 py-2 font-medium text-black">
                Enviar
              </button>
            </div>
          </div>
        </>
      )}
    </header>
  );
}