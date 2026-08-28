"use client";

import { BellRing } from "lucide-react";

import {
  AVISOS_POSIBLES,
  normalizaAvisos,
  type Repeticion,
} from "@/lib/alertas/modelo";

/**
 * Cuándo tiene que sonar el móvil.
 *
 * El correo llega en silencio y se lee cuando alguien mira la bandeja; lo que
 * despierta a la gente es el calendario del teléfono. Por eso el aviso viaja
 * además como cita adjunta al correo, y aquí se elige qué campanadas lleva.
 *
 * Sin ninguna marcada el correo sale pelado, exactamente como antes de que
 * este campo existiera: quitar todas es una opción legítima, no un error.
 */

interface Props {
  valor: number[];
  onChange: (avisos: number[]) => void;
  /** Solo para avisar de lo que una tarea de una sola vez no puede hacer. */
  repeticion: Repeticion;
}

export default function CampoAvisos({ valor, onChange, repeticion }: Props) {
  const elegidos = normalizaAvisos(valor);

  const alternar = (minutos: number) =>
    onChange(
      elegidos.includes(minutos)
        ? elegidos.filter((uno) => uno !== minutos)
        : normalizaAvisos([...elegidos, minutos]),
    );

  /*
  | El aviso previo de una tarea de una sola vez no puede sonar la primera vez:
  | el correo con la cita sale a la hora señalada, y para entonces «el día
  | antes» ya pasó. En las que se repiten sí vale, porque la cita lleva la
  | serie entera y el calendario avisa de las siguientes. Se dice aquí y no en
  | un comentario del código porque quien lo elige es quien tiene que saberlo.
  */
  const anticipadoImposible =
    repeticion === "una-vez" && elegidos.some((minutos) => minutos > 0);

  return (
    <div className="space-y-2">
      <label className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.14em] text-white/40">
        <BellRing className="h-3.5 w-3.5" aria-hidden />
        Alarma en el móvil
      </label>

      <div className="flex flex-wrap gap-1.5" role="group">
        {AVISOS_POSIBLES.map((opcion) => {
          const puesto = elegidos.includes(opcion.minutos);

          return (
            <button
              key={opcion.minutos}
              type="button"
              onClick={() => alternar(opcion.minutos)}
              aria-pressed={puesto}
              className={`rounded-full px-3 py-1.5 text-xs transition ${
                puesto
                  ? "bg-[#C8A96B] font-semibold text-[#0B0F14]"
                  : "border border-white/10 bg-white/[0.03] text-white/60 hover:bg-white/[0.08] hover:text-white"
              }`}
            >
              {opcion.etiqueta}
            </button>
          );
        })}
      </div>

      <p className="text-[11px] leading-relaxed text-white/35">
        {elegidos.length
          ? "El correo lleva la cita adjunta: quien la añada al calendario recibe la alarma en el móvil aunque no abra la app."
          : "Sin ninguna marcada solo llega el correo, sin cita ni alarma."}
      </p>

      {anticipadoImposible && (
        <p className="rounded-2xl bg-amber-500/10 px-3.5 py-2.5 text-[11px] leading-relaxed text-amber-300/90">
          Como la tarea es de una sola vez, los avisos anticipados no llegarán a
          sonar: el correo con la cita sale a la hora señalada, y para entonces
          ya habrán pasado. En las tareas que se repiten sí funcionan.
        </p>
      )}
    </div>
  );
}
