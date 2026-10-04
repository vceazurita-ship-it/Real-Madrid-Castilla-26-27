"use client";

/**
 * LO QUE EL INFORME NO SABE, DICHO ANTES DE MANDARLO (04/10/2026).
 *
 * Los informes llevaban al final un capítulo «Lo que este informe no sabe»:
 * que faltaba el plan, que una acción no tenía zona… Eso es trabajo pendiente
 * de quien lo manda, no algo que deba leer quien lo recibe. Ahora no sale ni
 * en el correo ni en los adjuntos: se enseña aquí, al pulsar «Enviar», para
 * completarlo antes o mandarlo igual sabiéndolo.
 */

import { AlertTriangle, Send, X } from "lucide-react";

export function AvisoAntesDeMandar({
  avisos,
  onMandar,
  onRevisar,
}: {
  avisos: string[];
  onMandar: () => void;
  onRevisar: () => void;
}) {
  return (
    <div className="fixed inset-0 z-[200] flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm" role="dialog" aria-modal="true" aria-label="Antes de mandar">
      <div className="w-full max-w-[560px] rounded-2xl border border-amber-300/30 bg-[#11161D] p-5 shadow-2xl">
        <div className="flex items-start justify-between gap-3">
          <p className="flex items-center gap-2 text-[15px] font-semibold text-white/90">
            <AlertTriangle size={17} className="shrink-0 text-amber-300" aria-hidden />
            Antes de mandarlo: al informe le falta esto
          </p>
          <button type="button" onClick={onRevisar} className="rounded-lg p-1 text-white/40 hover:text-white" aria-label="Cerrar">
            <X size={16} />
          </button>
        </div>

        <ul className="mt-3 max-h-[45vh] list-disc space-y-1.5 overflow-y-auto pl-5 text-[13px] leading-relaxed text-white/70">
          {avisos.map((aviso) => (
            <li key={aviso}>{aviso}</li>
          ))}
        </ul>

        <p className="mt-3 text-[12px] text-white/40">No va escrito ni en el correo ni en los adjuntos: es para ti. Puedes completarlo y volver, o mandarlo así.</p>

        <div className="mt-4 flex flex-wrap justify-end gap-2">
          <button type="button" onClick={onRevisar} className="rounded-lg border border-white/10 px-3.5 py-2 text-[12px] text-white/70 transition hover:border-white/25 hover:text-white">
            Revisar antes
          </button>
          <button
            type="button"
            onClick={onMandar}
            className="inline-flex items-center gap-1.5 rounded-lg bg-[#C8A96B] px-3.5 py-2 text-[12px] font-semibold text-[#0B0F14] transition hover:brightness-110"
          >
            <Send size={13} aria-hidden /> Mandar igual
          </button>
        </div>
      </div>
    </div>
  );
}
