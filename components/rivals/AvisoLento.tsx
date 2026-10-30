"use client";

import { RefreshCw } from "lucide-react";

/**
 * El aviso de las pantallas de rival cuando la hoja tarda más de 8 s
 * (patrón de `/duelos`). Se pinta encima del esqueleto o de la última copia.
 */
export function AvisoLento({
  onReintentar,
  className = "",
}: {
  onReintentar: () => void;
  className?: string;
}) {
  return (
    <div
      role="status"
      className={`rounded-xl border border-amber-400/30 bg-amber-400/[0.07] px-4 py-3 text-sm text-white/85 ${className}`}
    >
      Los datos tardan más de lo normal en llegar (la hoja de Google está despertando).{" "}
      <button
        type="button"
        onClick={onReintentar}
        className="inline-flex items-center gap-1.5 font-semibold underline"
      >
        <RefreshCw size={13} />
        Reintentar
      </button>
    </div>
  );
}

export default AvisoLento;
