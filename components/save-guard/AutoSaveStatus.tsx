"use client";

/*
|--------------------------------------------------------------------------
| INDICADOR DE AUTOGUARDADO
|--------------------------------------------------------------------------
|
| Sin botón de guardar, esto es lo único que le dice al usuario si su trabajo
| está a salvo. Por eso el estado se pinta siempre, también cuando todo va
| bien: un indicador que sólo aparece al fallar no se distingue de una app que
| no guarda nada.
|
| El error no es decorativo: ofrece reintentar en el sitio.
*/

import { Check, CloudOff, Loader2, PenLine, RefreshCw } from "lucide-react";

import type { AutoSaveStatus as Estado } from "@/hooks/useAutoSave";

function hora(fecha: Date | null) {
  if (!fecha) return null;

  return fecha.toLocaleTimeString("es-ES", {
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function AutoSaveStatus({
  estado,
  guardadoEn = null,
  onReintentar,
  className = "",
}: {
  estado: Estado;
  guardadoEn?: Date | null;
  onReintentar?: () => void;
  className?: string;
}) {
  const base =
    "inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-[11px] font-medium transition";

  if (estado === "saving") {
    return (
      <span
        data-export-hide
        className={`${base} border-[#C8A96B]/30 bg-[#C8A96B]/10 text-[#C8A96B] ${className}`}
      >
        <Loader2 size={12} className="animate-spin" />
        Guardando…
      </span>
    );
  }

  if (estado === "dirty") {
    return (
      <span
        data-export-hide
        className={`${base} border-white/15 bg-white/[0.04] text-white/55 ${className}`}
      >
        <PenLine size={12} />
        Sin guardar
      </span>
    );
  }

  if (estado === "error") {
    return (
      <span
        data-export-hide
        className={`${base} border-red-400/40 bg-red-500/10 text-red-300 ${className}`}
      >
        <CloudOff size={12} />
        No se ha podido guardar
        {onReintentar && (
          <button
            type="button"
            onClick={onReintentar}
            className="ml-1 inline-flex items-center gap-1 rounded-full border border-red-400/40 px-2 py-0.5 text-[10px] transition hover:bg-red-500/20"
          >
            <RefreshCw size={10} />
            Reintentar
          </button>
        )}
      </span>
    );
  }

  const marca = hora(guardadoEn);

  return (
    <span
      data-export-hide
      className={`${base} border-emerald-400/25 bg-emerald-500/10 text-emerald-300 ${className}`}
    >
      <Check size={12} />
      {estado === "saved" && marca ? `Guardado ${marca}` : "Guardado"}
    </span>
  );
}

export default AutoSaveStatus;
