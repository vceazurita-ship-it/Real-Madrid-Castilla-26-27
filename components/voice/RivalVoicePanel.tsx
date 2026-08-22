"use client";

import { useMemo, useState } from "react";
import { toast } from "sonner";
import {
  AlertTriangle,
  Check,
  Quote,
  Sparkles,
  Tags,
  Trash2,
  Wand2,
} from "lucide-react";

import VoiceCapture from "@/components/voice/VoiceCapture";
import type { VoiceClip } from "@/hooks/useVoiceRecorder";
import {
  RIVAL_LONG_FIELDS,
  RIVAL_VOICE_FIELDS,
  type RivalVoiceChange,
  type RivalVoiceField,
  type RivalVoiceResult,
} from "@/lib/voice/types";
import { cn } from "@/lib/utils";

export interface VoiceTagOption {
  key: string;
  label: string;
  aliases: string[];
}

interface Props {
  /** Valores actuales del formulario, para que el modelo no repita lo escrito. */
  current: Record<string, unknown>;
  equipo: string;
  tagCatalog: VoiceTagOption[];
  activeTagKeys: string[];
  /** Aplica los campos elegidos; `etiquetas` es null si no se han aceptado. */
  onApply: (payload: {
    campos: Partial<Record<RivalVoiceField, string>>;
    etiquetas: string[] | null;
  }) => void;
}

const FIELD_SET = new Set<string>(RIVAL_VOICE_FIELDS);
const LONG_SET = new Set<string>(RIVAL_LONG_FIELDS);

function text(value: unknown) {
  return String(value ?? "").trim();
}

/** Une lo que ya había con lo dictado sin duplicar el separador. */
function append(previous: string, addition: string) {
  if (!previous) return addition;
  if (!addition) return previous;

  return /[.;:,\-–]\s*$/.test(previous)
    ? `${previous} ${addition}`
    : `${previous}. ${addition}`;
}

/**
 * Dictado del informe de un jugador rival.
 *
 * El modelo nunca escribe en la ficha: propone campo a campo y el entrenador
 * marca lo que entra. Los campos largos se pueden ampliar en vez de
 * sobrescribirse, que es como se trabaja un informe a lo largo de la semana.
 */
export default function RivalVoicePanel({
  current,
  equipo,
  tagCatalog,
  activeTagKeys,
  onApply,
}: Props) {
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<RivalVoiceResult | null>(null);
  const [rejected, setRejected] = useState<Set<number>>(new Set());
  const [tagsAccepted, setTagsAccepted] = useState(true);

  const changes = useMemo(() => {
    if (!result) return [];

    return (result.cambios ?? []).filter(
      (change): change is RivalVoiceChange =>
        Boolean(change) && FIELD_SET.has(change.campo) && text(change.valor) !== ""
    );
  }, [result]);

  /* Etiquetas propuestas frente a las que ya tiene el jugador. */
  const tagPlan = useMemo(() => {
    if (!result) return null;

    const known = new Map(tagCatalog.map((tag) => [tag.key, tag]));

    const next = [...new Set(result.etiquetas ?? [])].filter((key) =>
      known.has(key)
    );

    const before = new Set(activeTagKeys);

    const added = next.filter((key) => !before.has(key));
    const removed = activeTagKeys.filter((key) => !next.includes(key));

    if (added.length === 0 && removed.length === 0) return null;

    return {
      keys: next,
      added: added.map((key) => known.get(key)!),
      removed: removed.map((key) => known.get(key)!).filter(Boolean),
    };
  }, [result, tagCatalog, activeTagKeys]);

  const interpret = async (clip: VoiceClip) => {
    setBusy(true);
    setResult(null);
    setRejected(new Set());
    setTagsAccepted(true);

    try {
      const response = await fetch("/api/voice", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          mode: "rival",
          audio: clip.data,
          mimeType: clip.mimeType,
          context: {
            equipo,
            jugador: Object.fromEntries(
              RIVAL_VOICE_FIELDS.map((field) => [field, text(current[field])])
            ),
            camposLargos: RIVAL_LONG_FIELDS,
            etiquetasActivas: activeTagKeys,
            catalogoEtiquetas: tagCatalog,
          },
        }),
      });

      const data = await response.json();

      if (!data.success) throw new Error(data.error || "Fallo del servidor");

      setResult(data.result as RivalVoiceResult);
    } catch (error) {
      console.error(error);
      toast.error("No se pudo interpretar el dictado.");
    } finally {
      setBusy(false);
    }
  };

  const accepted = changes.filter((_, index) => !rejected.has(index));

  const apply = () => {
    const campos: Partial<Record<RivalVoiceField, string>> = {};

    accepted.forEach((change) => {
      const previous = text(current[change.campo]);

      const value =
        change.modo === "añadir" && LONG_SET.has(change.campo)
          ? append(text(campos[change.campo] ?? previous), text(change.valor))
          : text(change.valor);

      campos[change.campo] = value;
    });

    const etiquetas = tagsAccepted && tagPlan ? tagPlan.keys : null;

    if (Object.keys(campos).length === 0 && !etiquetas) {
      toast.error("No hay nada marcado para aplicar.");
      return;
    }

    onApply({ campos, etiquetas });

    setResult(null);
    setRejected(new Set());

    toast.success("Informe actualizado con el dictado");
  };

  const toggle = (index: number) =>
    setRejected((current) => {
      const next = new Set(current);

      if (next.has(index)) next.delete(index);
      else next.add(index);

      return next;
    });

  return (
    <div className="rounded-2xl border border-white/10 bg-[#0B0F14] p-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="flex items-center gap-2 text-[10px] font-semibold uppercase tracking-[0.25em] text-white/45">
          <Sparkles size={13} className="text-[#C8A96B]" />
          Dictar informe
        </p>

        <VoiceCapture
          busy={busy}
          onClip={interpret}
          onError={(message) => toast.error(message)}
          label="Grabar"
        />
      </div>

      {!result && !busy && (
        <p className="mt-2 text-[11px] leading-relaxed text-white/35">
          Cuenta lo que has visto del jugador —posición, pie, virtudes, puntos
          débiles, a qué hay que estar atentos— y se reparte por los campos del
          informe. Nada se guarda sin que lo revises.
        </p>
      )}

      {result && (
        <div className="mt-3 space-y-3">
          {/* LO QUE HA ENTENDIDO */}

          <div className="rounded-xl border border-[#C8A96B]/20 bg-[#C8A96B]/[0.06] p-3">
            <p className="text-xs leading-relaxed text-white/75">
              {result.resumen}
            </p>

            {text(result.transcripcion) && (
              <p className="mt-2 flex gap-2 text-[11px] italic leading-relaxed text-white/35">
                <Quote size={11} className="mt-0.5 shrink-0" />
                {result.transcripcion}
              </p>
            )}
          </div>

          {/* CAMBIOS PROPUESTOS */}

          {changes.length === 0 && !tagPlan && (
            <p className="rounded-xl border border-dashed border-white/10 px-3 py-4 text-center text-[11px] text-white/35">
              No se ha podido sacar ningún dato del audio.
            </p>
          )}

          {changes.map((change, index) => {
            const previous = text(current[change.campo]);
            const off = rejected.has(index);
            const adds = change.modo === "añadir" && LONG_SET.has(change.campo);

            return (
              <button
                key={`${change.campo}-${index}`}
                type="button"
                onClick={() => toggle(index)}
                className={cn(
                  "flex w-full gap-2.5 rounded-xl border p-3 text-left transition",
                  off
                    ? "border-white/10 bg-white/[0.02] opacity-45"
                    : "border-emerald-400/25 bg-emerald-400/[0.06]"
                )}
              >
                <span
                  className={cn(
                    "mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded border transition",
                    off
                      ? "border-white/25"
                      : "border-emerald-400 bg-emerald-400 text-[#0B0F14]"
                  )}
                >
                  {!off && <Check size={11} strokeWidth={3} />}
                </span>

                <span className="min-w-0 flex-1">
                  <span className="flex flex-wrap items-center gap-2">
                    <span className="text-[10px] font-semibold uppercase tracking-[0.15em] text-[#C8A96B]">
                      {change.campo}
                    </span>

                    <span className="rounded-full bg-white/[0.07] px-2 py-0.5 text-[9px] uppercase tracking-wider text-white/45">
                      {adds ? "Añade" : "Sustituye"}
                    </span>
                  </span>

                  {previous && (
                    <span
                      className={cn(
                        "mt-1.5 block text-[11px] leading-relaxed text-white/30",
                        !adds && "line-through"
                      )}
                    >
                      {previous}
                    </span>
                  )}

                  <span className="mt-1 block whitespace-pre-wrap text-xs leading-relaxed text-white/85">
                    {adds && previous && (
                      <span className="text-white/30">+ </span>
                    )}
                    {change.valor}
                  </span>

                  {change.motivo && (
                    <span className="mt-1 block text-[10px] text-white/30">
                      {change.motivo}
                    </span>
                  )}
                </span>
              </button>
            );
          })}

          {/* ETIQUETAS */}

          {tagPlan && (
            <button
              type="button"
              onClick={() => setTagsAccepted((value) => !value)}
              className={cn(
                "flex w-full gap-2.5 rounded-xl border p-3 text-left transition",
                tagsAccepted
                  ? "border-emerald-400/25 bg-emerald-400/[0.06]"
                  : "border-white/10 bg-white/[0.02] opacity-45"
              )}
            >
              <span
                className={cn(
                  "mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded border transition",
                  tagsAccepted
                    ? "border-emerald-400 bg-emerald-400 text-[#0B0F14]"
                    : "border-white/25"
                )}
              >
                {tagsAccepted && <Check size={11} strokeWidth={3} />}
              </span>

              <span className="min-w-0 flex-1">
                <span className="flex items-center gap-2 text-[10px] font-semibold uppercase tracking-[0.15em] text-[#C8A96B]">
                  <Tags size={12} />
                  Etiquetas
                </span>

                <span className="mt-2 flex flex-wrap gap-1.5">
                  {tagPlan.added.map((tag) => (
                    <span
                      key={tag.key}
                      className="rounded-full border border-emerald-400/30 bg-emerald-400/10 px-2 py-0.5 text-[10px] text-emerald-200"
                    >
                      + {tag.label}
                    </span>
                  ))}

                  {tagPlan.removed.map((tag) => (
                    <span
                      key={tag.key}
                      className="inline-flex items-center gap-1 rounded-full border border-red-500/30 bg-red-500/10 px-2 py-0.5 text-[10px] text-red-300"
                    >
                      <Trash2 size={9} />
                      {tag.label}
                    </span>
                  ))}
                </span>
              </span>
            </button>
          )}

          {/* AVISOS */}

          {(result.avisos ?? []).filter(Boolean).length > 0 && (
            <ul className="space-y-1 rounded-xl border border-amber-400/20 bg-amber-400/[0.05] p-3">
              {result.avisos.filter(Boolean).map((warning, index) => (
                <li
                  key={index}
                  className="flex gap-2 text-[11px] leading-relaxed text-amber-200/80"
                >
                  <AlertTriangle size={12} className="mt-0.5 shrink-0" />
                  {warning}
                </li>
              ))}
            </ul>
          )}

          {/* ACCIONES */}

          <div className="flex flex-wrap items-center justify-end gap-2">
            <button
              type="button"
              onClick={() => setResult(null)}
              className="rounded-xl border border-white/10 px-3 py-2 text-[11px] text-white/55 transition hover:border-white/30 hover:text-white"
            >
              Descartar
            </button>

            <button
              type="button"
              onClick={apply}
              disabled={accepted.length === 0 && !(tagsAccepted && tagPlan)}
              className="inline-flex items-center gap-1.5 rounded-xl bg-[#C8A96B] px-4 py-2 text-[11px] font-semibold text-[#0B0F14] transition hover:bg-[#d8ba7c] disabled:cursor-not-allowed disabled:opacity-40"
            >
              <Wand2 size={13} />
              Aplicar al informe
            </button>
          </div>

          <p className="text-center text-[10px] text-white/25">
            Se escribe en el formulario. Sigue haciendo falta pulsar Guardar.
          </p>
        </div>
      )}
    </div>
  );
}
