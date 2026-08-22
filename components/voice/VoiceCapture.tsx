"use client";

import { Loader2, Mic, Square, X } from "lucide-react";

import { useVoiceRecorder, type VoiceClip } from "@/hooks/useVoiceRecorder";
import { MAX_RECORDING_MS } from "@/lib/voice/audio";
import { cn } from "@/lib/utils";

interface Props {
  /** Recibe el audio grabado; debe devolver la promesa de su interpretación. */
  onClip: (clip: VoiceClip) => void | Promise<void>;
  onError?: (message: string) => void;
  /** El padre está interpretando el dictado. */
  busy?: boolean;
  disabled?: boolean;
  label?: string;
  busyLabel?: string;
  className?: string;
}

function clock(seconds: number) {
  const minutes = Math.floor(seconds / 60);

  return `${minutes}:${String(seconds % 60).padStart(2, "0")}`;
}

/**
 * Botón de dictado: graba, convierte el audio y se lo pasa al padre.
 *
 * Mientras graba muestra el nivel de voz para que se vea que el micrófono
 * está entrando, que es la duda habitual en la banda del campo.
 */
export default function VoiceCapture({
  onClip,
  onError,
  busy = false,
  disabled = false,
  label = "Dictar",
  busyLabel = "Interpretando…",
  className,
}: Props) {
  const { state, seconds, level, supported, start, stop, cancel } =
    useVoiceRecorder({ onClip, onError });

  const working = busy || state === "encoding";

  if (!supported) {
    return (
      <span
        className={cn(
          "inline-flex items-center gap-1.5 rounded-xl border border-white/10 px-3 py-2 text-[11px] text-white/35",
          className
        )}
        title="El dictado necesita un navegador con acceso al micrófono."
      >
        <Mic size={14} />
        Dictado no disponible
      </span>
    );
  }

  if (state === "recording") {
    const remaining = Math.max(
      0,
      Math.round(MAX_RECORDING_MS / 1000) - seconds
    );

    return (
      <span
        className={cn(
          "inline-flex items-center gap-2 rounded-xl border border-red-500/40 bg-red-500/10 px-2.5 py-1.5",
          className
        )}
      >
        <span className="relative flex h-2.5 w-2.5 shrink-0">
          <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-red-400/70" />
          <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-red-500" />
        </span>

        <span className="text-[11px] font-semibold tabular-nums text-red-200">
          {clock(seconds)}
        </span>

        {/* Nivel de voz */}
        <span className="flex h-4 items-end gap-0.5">
          {[0.15, 0.35, 0.55, 0.75, 0.95].map((threshold) => (
            <span
              key={threshold}
              className={cn(
                "w-0.5 rounded-full transition-all duration-75",
                level >= threshold ? "bg-red-300" : "bg-white/15"
              )}
              style={{ height: `${30 + threshold * 70}%` }}
            />
          ))}
        </span>

        {remaining <= 20 && (
          <span className="text-[10px] text-red-300/70">-{remaining}s</span>
        )}

        <button
          type="button"
          onClick={stop}
          title="Terminar e interpretar"
          className="inline-flex items-center gap-1 rounded-lg bg-[#C8A96B] px-2 py-1 text-[11px] font-semibold text-[#0B0F14] transition hover:bg-[#d8ba7c]"
        >
          <Square size={11} fill="currentColor" />
          Interpretar
        </button>

        <button
          type="button"
          onClick={cancel}
          title="Descartar"
          className="rounded-lg p-1 text-white/40 transition hover:bg-white/10 hover:text-white"
        >
          <X size={13} />
        </button>
      </span>
    );
  }

  return (
    <button
      type="button"
      onClick={start}
      disabled={disabled || working}
      className={cn(
        "inline-flex items-center gap-1.5 rounded-xl border border-[#C8A96B]/40 bg-[#C8A96B]/10 px-3 py-2 text-[11px] font-semibold text-[#C8A96B] transition hover:bg-[#C8A96B]/20 disabled:cursor-not-allowed disabled:opacity-50",
        className
      )}
    >
      {working ? (
        <>
          <Loader2 size={14} className="animate-spin" />
          {busyLabel}
        </>
      ) : (
        <>
          <Mic size={14} />
          {label}
        </>
      )}
    </button>
  );
}
