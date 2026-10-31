"use client";

/**
 * «Este es el ordenador principal» (31/10/2026): se marca en el ordenador del
 * club, donde corre el vigía y están las grabaciones tácticas. Se guarda en
 * este navegador; en los demás aparatos sigue apagado.
 */

import { HardDrive } from "lucide-react";
import { toast } from "sonner";

import { marcaOrdenadorPrincipal, useOrdenadorPrincipal } from "@/hooks/useOrdenadorPrincipal";

export function InterruptorOrdenadorPrincipal() {
  const principal = useOrdenadorPrincipal();

  const cambia = () => {
    marcaOrdenadorPrincipal(!principal);

    toast.success(
      !principal
        ? "Este navegador queda como el del ordenador principal"
        : "Este navegador ya no es el del ordenador principal",
    );
  };

  return (
    <div className="mt-5 flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-white/10 bg-white/[0.03] px-4 py-3">
      <div className="min-w-0">
        <p className="flex items-center gap-2 text-sm font-semibold text-white">
          <HardDrive size={15} className="text-[#C8A96B]" aria-hidden />
          Este es el ordenador principal
        </p>
        <p className="mt-0.5 text-[12px] leading-relaxed text-white/45">
          El del club, donde están las grabaciones tácticas de los partidos. Encendido, Vídeo Análisis de Partidos
          enseña el botón «Grabación táctica», que abre el vídeo en el reproductor de este ordenador. Se recuerda sólo
          en este navegador.
        </p>
      </div>

      <button
        type="button"
        role="switch"
        aria-checked={principal}
        onClick={cambia}
        className={`relative h-6 w-11 shrink-0 rounded-full border transition ${
          principal ? "border-[#C8A96B] bg-[#C8A96B]" : "border-white/15 bg-white/10"
        }`}
      >
        <span className="sr-only">Este es el ordenador principal</span>
        <span
          className={`absolute top-0.5 h-[18px] w-[18px] rounded-full bg-white shadow transition-all ${
            principal ? "left-[22px]" : "left-0.5"
          }`}
        />
      </button>
    </div>
  );
}

export default InterruptorOrdenadorPrincipal;
