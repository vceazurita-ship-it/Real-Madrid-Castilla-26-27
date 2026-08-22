"use client";

import { useMemo, useState } from "react";
import { toast } from "sonner";
import {
  AlertTriangle,
  ChevronLeft,
  ChevronRight,
  Layers,
  Plus,
  Quote,
  Replace,
  Sparkles,
  X,
} from "lucide-react";

import PitchMarkings from "@/components/tactics/PitchMarkings";
import VoiceCapture from "@/components/voice/VoiceCapture";
import type { VoiceClip } from "@/hooks/useVoiceRecorder";
import { scenesFromVoice } from "@/lib/tactics/fromVoice";
import { pathFrom, rectFrom } from "@/lib/tactics/helpers";
import type { RivalSquad } from "@/lib/tactics/rivals";
import {
  CROP_LABEL,
  CROP_VIEWBOX,
  type PitchCrop,
  type TacticScene,
  type TacticsDoc,
} from "@/lib/tactics/types";
import type { TacticsVoiceResult } from "@/lib/voice/types";
import type { Player } from "@/types/player";

interface Props {
  doc: TacticsDoc;
  /** Escena visible, para que el modelo parta de lo que ya hay pintado. */
  scene: TacticScene;
  roster: Player[];
  rivalSquads: RivalSquad[];
  /** Tablero de una sola escena: el dictado ocupa la que hay. */
  singleScene?: boolean;
  onApply: (payload: {
    scenes: TacticScene[];
    crop?: PitchCrop;
    mode: "append" | "replace";
  }) => void;
  onClose: () => void;
}

const PREVIEW_TOKEN: Record<string, { fill: string; stroke: string; text: string; r: number }> = {
  home: { fill: "#F8FAFC", stroke: "#0B0F14", text: "#0B0F14", r: 2.4 },
  away: { fill: "#1E293B", stroke: "#F87171", text: "#FFFFFF", r: 2.4 },
  ball: { fill: "#FDE68A", stroke: "#0B0F14", text: "#0B0F14", r: 1.3 },
  cone: { fill: "#FB923C", stroke: "#0B0F14", text: "#0B0F14", r: 1.5 },
};

/** Vista reducida de una escena propuesta, solo para revisarla. */
function ScenePreview({ scene, crop }: { scene: TacticScene; crop: PitchCrop }) {
  return (
    <svg
      viewBox={CROP_VIEWBOX[crop]}
      preserveAspectRatio="xMidYMid meet"
      className="block w-full rounded-xl bg-[#0B1A12]"
    >
      <defs>
        <marker
          id="voice-preview-arrow"
          viewBox="0 0 10 10"
          refX="8"
          refY="5"
          markerWidth="5"
          markerHeight="5"
          orient="auto-start-reverse"
        >
          <path d="M 0 0 L 10 5 L 0 10 z" fill="context-stroke" />
        </marker>
      </defs>

      <PitchMarkings />

      {scene.shapes.map((shape) => {
        if (shape.tool === "zone") {
          const rect = rectFrom(shape);

          return (
            <rect
              key={shape.id}
              {...rect}
              fill={shape.color}
              fillOpacity={0.14}
              stroke={shape.color}
              strokeWidth={0.35}
              strokeDasharray="1.4 1"
            />
          );
        }

        if (shape.tool === "text") {
          return (
            <text
              key={shape.id}
              x={shape.points[0].x}
              y={shape.points[0].y}
              fill={shape.color}
              fontSize={2.6}
              fontWeight={600}
            >
              {shape.text}
            </text>
          );
        }

        return (
          <path
            key={shape.id}
            d={pathFrom(shape)}
            fill="none"
            stroke={shape.color}
            strokeWidth={0.5}
            strokeLinecap="round"
            strokeDasharray={shape.tool === "dashed" ? "1.6 1.2" : undefined}
            markerEnd={
              shape.tool === "arrow" ? "url(#voice-preview-arrow)" : undefined
            }
          />
        );
      })}

      {scene.tokens.map((token) => {
        const style = PREVIEW_TOKEN[token.kind] ?? PREVIEW_TOKEN.home;

        return (
          <g key={token.id}>
            <circle
              cx={token.x}
              cy={token.y}
              r={style.r}
              fill={style.fill}
              stroke={style.stroke}
              strokeWidth={0.35}
            />

            {token.label && (
              <text
                x={token.x}
                y={token.y + 0.8}
                textAnchor="middle"
                fill={style.text}
                fontSize={2.1}
                fontWeight={700}
              >
                {token.label}
              </text>
            )}
          </g>
        );
      })}
    </svg>
  );
}

/**
 * Dictado de una jugada sobre la pizarra.
 *
 * Se explica la jugada de viva voz, se revisa el dibujo propuesto escena a
 * escena y se decide si se añade a la pizarra o si la sustituye entera.
 */
export default function TacticsVoicePanel({
  doc,
  scene,
  roster,
  rivalSquads,
  singleScene = false,
  onApply,
  onClose,
}: Props) {
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<TacticsVoiceResult | null>(null);
  const [preview, setPreview] = useState(0);

  const scenes = useMemo(
    () => (result ? scenesFromVoice(result) : []),
    [result]
  );

  const crop = (result?.crop ?? doc.crop) as PitchCrop;

  const shown = scenes[Math.min(preview, scenes.length - 1)] ?? null;

  const interpret = async (clip: VoiceClip) => {
    setBusy(true);
    setResult(null);
    setPreview(0);

    try {
      const response = await fetch("/api/voice", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          mode: "tactics",
          audio: clip.data,
          mimeType: clip.mimeType,
          context: {
            titulo: doc.titulo,
            recorte: doc.crop,
            /* Este tablero no encadena escenas: todo va en una sola. */
            escenaUnica: singleScene,
            escenaVisible: {
              nombre: scene.nombre,
              fichas: scene.tokens.map((token) => ({
                equipo: token.kind,
                etiqueta: token.label,
                nombre: token.nombre,
                x: Math.round(token.x),
                y: Math.round(token.y),
              })),
            },
            plantillaPropia: roster.slice(0, 40).map((player) => ({
              dorsal: player.dorsal ?? "",
              nombre: player.apodo || player.nombre,
              posicion: player.posicion ?? "",
            })),
            plantillasRivales: rivalSquads.map((squad) => ({
              equipo: squad.equipo,
              jugadores: squad.players.map((player) => ({
                dorsal: player.dorsal,
                nombre: player.nombre,
                posicion: player.posicion ?? "",
              })),
            })),
          },
        }),
      });

      const data = await response.json();

      if (!data.success) throw new Error(data.error || "Fallo del servidor");

      setResult(data.result as TacticsVoiceResult);
    } catch (error) {
      console.error(error);
      toast.error("No se pudo interpretar el dictado.");
    } finally {
      setBusy(false);
    }
  };

  const apply = (mode: "append" | "replace") => {
    if (scenes.length === 0) return;

    onApply({ scenes, crop: result?.crop, mode });

    setResult(null);
    setPreview(0);

    if (singleScene) {
      toast.success("Jugada dibujada en la pizarra");
      return;
    }

    toast.success(
      mode === "append"
        ? `${scenes.length} escena${scenes.length > 1 ? "s" : ""} añadida${
            scenes.length > 1 ? "s" : ""
          }`
        : "Pizarra sustituida por el dictado"
    );
  };

  return (
    <div
      data-export-hide
      className="space-y-3 rounded-2xl border border-[#C8A96B]/25 bg-[#11161D] p-3"
    >
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="flex items-center gap-2 text-[10px] font-semibold uppercase tracking-[0.25em] text-white/45">
          <Sparkles size={13} className="text-[#C8A96B]" />
          Dictar jugada
        </p>

        <div className="flex items-center gap-2">
          <VoiceCapture
            busy={busy}
            onClip={interpret}
            onError={(message) => toast.error(message)}
            label="Grabar"
          />

          <button
            type="button"
            onClick={onClose}
            title="Cerrar el dictado"
            className="rounded-lg p-1.5 text-white/35 transition hover:bg-white/10 hover:text-white"
          >
            <X size={14} />
          </button>
        </div>
      </div>

      {!result && !busy && (
        <p className="text-[11px] leading-relaxed text-white/35">
          Explica la jugada como se la contarías al grupo: sistemas, quién tiene
          el balón, los desmarques y qué pasa después. Cada momento nuevo se
          convierte en una escena, y las escenas se animan.
        </p>
      )}

      {result && (
        <div className="space-y-3">
          <div className="rounded-xl border border-[#C8A96B]/20 bg-[#C8A96B]/[0.06] p-3">
            <p className="text-xs leading-relaxed text-white/75">
              {result.resumen}
            </p>

            {String(result.transcripcion ?? "").trim() && (
              <p className="mt-2 flex gap-2 text-[11px] italic leading-relaxed text-white/35">
                <Quote size={11} className="mt-0.5 shrink-0" />
                {result.transcripcion}
              </p>
            )}
          </div>

          {scenes.length === 0 ? (
            <p className="rounded-xl border border-dashed border-white/10 px-3 py-4 text-center text-[11px] text-white/35">
              No se ha podido dibujar nada con ese audio.
            </p>
          ) : (
            <>
              {/* NAVEGACIÓN DE ESCENAS */}

              <div className="flex items-center justify-between gap-2">
                <button
                  type="button"
                  onClick={() => setPreview((index) => Math.max(0, index - 1))}
                  disabled={preview === 0}
                  className="rounded-lg border border-white/10 p-1.5 text-white/50 transition hover:text-white disabled:opacity-20"
                >
                  <ChevronLeft size={14} />
                </button>

                <p className="min-w-0 truncate text-center text-[11px] font-semibold text-white/70">
                  {shown?.nombre}

                  <span className="ml-2 font-normal text-white/30">
                    {preview + 1}/{scenes.length}
                  </span>
                </p>

                <button
                  type="button"
                  onClick={() =>
                    setPreview((index) => Math.min(scenes.length - 1, index + 1))
                  }
                  disabled={preview >= scenes.length - 1}
                  className="rounded-lg border border-white/10 p-1.5 text-white/50 transition hover:text-white disabled:opacity-20"
                >
                  <ChevronRight size={14} />
                </button>
              </div>

              {shown && <ScenePreview scene={shown} crop={crop} />}

              <p className="flex flex-wrap items-center justify-center gap-x-3 gap-y-1 text-[10px] text-white/35">
                <span>{shown?.tokens.length ?? 0} fichas</span>
                <span>{shown?.shapes.length ?? 0} dibujos</span>
              </p>
            </>
          )}

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

          {scenes.length > 0 && (
            <div className="flex flex-wrap items-center justify-end gap-2">
              <button
                type="button"
                onClick={() => setResult(null)}
                className="rounded-xl border border-white/10 px-3 py-2 text-[11px] text-white/55 transition hover:border-white/30 hover:text-white"
              >
                Descartar
              </button>

              {!singleScene && (
                <button
                  type="button"
                  onClick={() => apply("replace")}
                  className="inline-flex items-center gap-1.5 rounded-xl border border-white/15 px-3 py-2 text-[11px] font-semibold text-white/70 transition hover:border-red-400/40 hover:text-red-200"
                >
                  <Replace size={13} />
                  Sustituir la pizarra
                </button>
              )}

              <button
                type="button"
                onClick={() => apply(singleScene ? "replace" : "append")}
                className="inline-flex items-center gap-1.5 rounded-xl bg-[#C8A96B] px-4 py-2 text-[11px] font-semibold text-[#0B0F14] transition hover:bg-[#d8ba7c]"
              >
                {singleScene ? <Replace size={13} /> : <Plus size={13} />}

                {singleScene
                  ? "Dibujar en la pizarra"
                  : `Añadir ${
                      scenes.length > 1 ? `${scenes.length} escenas` : "escena"
                    }`}
              </button>
            </div>
          )}

          {result.crop && result.crop !== doc.crop && (
            <p className="flex items-center justify-center gap-1.5 text-[10px] text-white/30">
              <Layers size={11} />
              También se cambiará el encuadre a {CROP_LABEL[result.crop]}.
            </p>
          )}
        </div>
      )}
    </div>
  );
}
