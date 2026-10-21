"use client";

import { FileDown, FileText, Hand, Mail, MessageCircle, Presentation } from "lucide-react";

import type { JornadaDeEquipo } from "@/lib/rivals/orden-calendario";

/*
|--------------------------------------------------------------------------
| PARA LA SEMANA (21/10/2026)
|--------------------------------------------------------------------------
|
| Lo que se prepara del próximo rival, junto y con su botón: el informe, el
| once en PDF, el PDF del portero y el PowerPoint de día de partido. Lo pidió
| el productor: las piezas colgaban de una barra pequeña y no se veía qué se
| podía sacar.
|
| No dice «hecho» ni «pendiente»: la app no guarda qué se ha exportado, y un
| estado inventado engaña más que ninguno. Y «Mandar» no manda nada: abre
| WhatsApp o el correo con el mensaje escrito; el analista adjunta lo que haya
| descargado y decide a quién.
*/

export type PiezaDeLaSemana = {
  clave: string;
  etiqueta: string;
  /** Qué es, en una línea, para quien no la ha abierto nunca. */
  explica: string;
  icono: "informe" | "once" | "portero" | "ppt";
  onClick: () => void;
};

const ICONOS = {
  informe: FileText,
  once: FileDown,
  portero: Hand,
  ppt: Presentation,
} as const;

export function ParaLaSemana({
  equipo,
  jornada,
  frase,
  piezas,
  ocupado,
}: {
  equipo: string;
  jornada: JornadaDeEquipo | null;
  /** La frase de «Cómo llega», que abre el mensaje. */
  frase: string;
  piezas: PiezaDeLaSemana[];
  ocupado: boolean;
}) {
  if (piezas.length === 0) return null;

  const cabecera = [`Rival de la semana: ${equipo}`, jornada?.titulo].filter(Boolean).join(" · ");
  const mensaje = [cabecera, frase, "Os paso el informe del rival y el once probable."]
    .filter(Boolean)
    .join("\n\n");

  return (
    <section
      aria-label={`Para la semana contra ${equipo}`}
      data-export-hide
      className="mt-3 min-w-0 rounded-2xl border border-white/10 bg-white/[0.025] p-3 sm:p-4"
    >
      <header className="mb-3 flex min-w-0 flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
        <h2 className="min-w-0 truncate text-xs font-semibold uppercase tracking-[0.25em] text-[#C8A96B]">
          Para la semana
        </h2>
        <p className="text-[11px] text-white/45">Lo que se saca de {equipo}, cada uno con su botón</p>
      </header>

      <ul className="grid min-w-0 grid-cols-1 gap-2 sm:grid-cols-2 xl:grid-cols-4">
        {piezas.map((pieza) => {
          const Icono = ICONOS[pieza.icono];

          return (
            <li key={pieza.clave} className="min-w-0">
              <button
                type="button"
                onClick={pieza.onClick}
                disabled={ocupado}
                className="flex h-full w-full min-w-0 items-start gap-2.5 rounded-xl border border-white/10 bg-white/[0.03] p-3 text-left transition hover:border-[#C8A96B]/50 hover:bg-[#C8A96B]/10 disabled:opacity-50"
              >
                <Icono size={16} className="mt-0.5 shrink-0 text-[#C8A96B]" aria-hidden />
                <span className="min-w-0">
                  <span className="block text-[13px] font-semibold text-white/90">{pieza.etiqueta}</span>
                  <span className="mt-0.5 block text-[12px] leading-snug text-white/50">{pieza.explica}</span>
                </span>
              </button>
            </li>
          );
        })}
      </ul>

      <div className="mt-3 flex min-w-0 flex-wrap items-center gap-2 text-[13px]">
        <span className="text-white/50">Mandar al cuerpo técnico:</span>
        <a
          href={`https://wa.me/?text=${encodeURIComponent(mensaje)}`}
          target="_blank"
          rel="noreferrer"
          className="inline-flex items-center gap-1.5 rounded-full border border-white/15 px-3 py-1 font-semibold text-white/80 transition hover:border-[#C8A96B]/60 hover:text-[#C8A96B]"
        >
          <MessageCircle size={13} aria-hidden /> WhatsApp
        </a>
        <a
          href={`mailto:?subject=${encodeURIComponent(cabecera)}&body=${encodeURIComponent(mensaje)}`}
          className="inline-flex items-center gap-1.5 rounded-full border border-white/15 px-3 py-1 font-semibold text-white/80 transition hover:border-[#C8A96B]/60 hover:text-[#C8A96B]"
        >
          <Mail size={13} aria-hidden /> Correo
        </a>
        <span className="text-[12px] text-white/40">Se abre con el mensaje escrito; lo descargado se adjunta a mano.</span>
      </div>
    </section>
  );
}
