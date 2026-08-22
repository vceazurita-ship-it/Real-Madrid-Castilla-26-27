"use client";

import { useCallback, useRef, useState } from "react";
import Image from "next/image";
import { useDropzone } from "react-dropzone";
import {
  ClipboardPaste,
  Image as ImageIcon,
  Loader2,
  MessageSquareText,
  Sparkles,
  TriangleAlert,
  Upload,
  X,
} from "lucide-react";
import { toast } from "sonner";
import { uploadFile } from "@/lib/uploadFile";
import { cn } from "@/lib/utils";

export interface TrainingPlayer {
  /** Id del jugador oficial, si el emparejamiento lo resolvió. */
  id: string | null;
  detected: string;
  official: string | null;
  confidence: number;
  photo: string;
}

export interface PendingPlayer {
  name: string;
  photo: string;
  candidates: {
    player: {
      ID_JUGADOR: string;
      NOMBRE: string;
      FOTO_URL?: string;
    };
    confidence: number;
  }[];
}

export interface TrainingImport {
  available: TrainingPlayer[];
  injury: TrainingPlayer[];
  promotion: TrainingPlayer[];
  nationalTeam: TrainingPlayer[];
  others: TrainingPlayer[];

  pendingPlayers: PendingPlayer[];
  sessionPlayers: string[];
}

type Mode = "imagen" | "texto";

type Props = {
  initialImageUrl?: string;
  onImport: (data: TrainingImport) => void;
};

function todayKey() {
  const now = new Date();

  return [
    now.getFullYear(),
    String(now.getMonth() + 1).padStart(2, "0"),
    String(now.getDate()).padStart(2, "0"),
  ].join("-");
}

export default function ImportAvailability({
  initialImageUrl,
  onImport,
}: Props) {
  const [mode, setMode] = useState<Mode>("imagen");
  const [loading, setLoading] = useState(false);

  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<string>("");
  const [texto, setTexto] = useState("");
  const [fecha, setFecha] = useState(todayKey);

  /** Petición pendiente de confirmar porque la fecha ya tenía sesión. */
  const [conflict, setConflict] = useState<string | null>(null);
  const pending = useRef<(() => FormData) | null>(null);

  const onDrop = useCallback((accepted: File[]) => {
    const next = accepted[0];

    if (!next) return;

    setFile(next);
    setPreview(URL.createObjectURL(next));
    setConflict(null);
  }, []);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: { "image/*": [] },
    multiple: false,
  });

  const send = async (build: () => FormData, replace = false) => {
    setLoading(true);

    try {
      const formData = build();

      if (replace) formData.append("replace", "true");

      const response = await fetch("/api/training-import", {
        method: "POST",
        body: formData,
      });

      if (response.status === 409) {
        pending.current = build;

        const body = await response.json();
        setConflict(body.message ?? "Ya existe una sesión para esta fecha.");

        return;
      }

      if (!response.ok) {
        const body = await response.json().catch(() => ({}));
        throw new Error(body.error ?? "No se pudo analizar la sesión.");
      }

      const data: TrainingImport = await response.json();

      setConflict(null);
      pending.current = null;

      onImport(data);

      toast.success(
        replace
          ? "Sesión reemplazada correctamente."
          : "Disponibilidad importada correctamente."
      );
    } catch (error) {
      console.error(error);

      toast.error(
        error instanceof Error
          ? error.message
          : "Ha ocurrido un error al analizar la sesión."
      );
    } finally {
      setLoading(false);
    }
  };

  const analyzeImage = async () => {
    if (!file) {
      toast.error("Selecciona primero una imagen.");
      return;
    }

    let url = "";

    try {
      const upload = await uploadFile(file, "training");
      url = upload.url;
    } catch (error) {
      // Si falla el almacenamiento seguimos: la imagen se analiza igual.
      console.error(error);
    }

    await send(() => {
      const formData = new FormData();

      formData.append("image", file);
      formData.append("imageUrl", url);
      formData.append("fecha", fecha);

      return formData;
    });
  };

  const analyzeText = async () => {
    if (texto.trim().length < 10) {
      toast.error("Pega el mensaje de WhatsApp de la sesión.");
      return;
    }

    await send(() => {
      const formData = new FormData();

      formData.append("text", texto.trim());
      formData.append("fecha", fecha);

      return formData;
    });
  };

  const pasteFromClipboard = async () => {
    try {
      const clip = await navigator.clipboard.readText();

      if (!clip.trim()) {
        toast.error("El portapapeles está vacío.");
        return;
      }

      setTexto(clip);
    } catch {
      toast.error("El navegador no ha permitido leer el portapapeles.");
    }
  };

  return (
    <div className="space-y-5">
      {/* SELECTOR DE ORIGEN */}

      <div className="flex flex-wrap items-end justify-between gap-4">
        <div className="flex gap-1.5 rounded-2xl border border-white/10 bg-[#11161D] p-1.5">
          {(
            [
              { id: "imagen" as const, label: "Imagen", icon: <ImageIcon size={15} /> },
              {
                id: "texto" as const,
                label: "Texto de WhatsApp",
                icon: <MessageSquareText size={15} />,
              },
            ]
          ).map((item) => (
            <button
              key={item.id}
              type="button"
              onClick={() => setMode(item.id)}
              className={cn(
                "inline-flex items-center gap-2 rounded-xl px-3.5 py-2 text-xs font-semibold transition",
                mode === item.id
                  ? "bg-[#C8A96B] text-[#0B0F14]"
                  : "text-white/60 hover:bg-white/[0.06] hover:text-white"
              )}
            >
              {item.icon}
              {item.label}
            </button>
          ))}
        </div>

        <label className="block">
          <span className="mb-1 block text-[10px] uppercase tracking-[0.25em] text-white/40">
            Fecha de la sesión
          </span>

          <input
            type="date"
            value={fecha}
            onChange={(event) => setFecha(event.target.value || todayKey())}
            className="rounded-xl border border-white/10 bg-[#11161D] px-3 py-2 text-sm text-white outline-none transition focus:border-[#C8A96B]/60"
          />
        </label>
      </div>

      {/* IMAGEN */}

      {mode === "imagen" && (
        <div className="space-y-4">
          <div
            {...getRootProps()}
            className={cn(
              "flex cursor-pointer flex-col items-center justify-center rounded-2xl border-2 border-dashed px-6 py-10 text-center transition",
              isDragActive
                ? "border-[#C8A96B] bg-[#C8A96B]/5"
                : "border-white/15 bg-white/[0.02] hover:border-[#C8A96B]/50"
            )}
          >
            <input {...getInputProps()} />

            <Upload size={26} className="text-[#C8A96B]" />

            <p className="mt-3 text-sm font-medium text-white/85">
              {isDragActive
                ? "Suelta la imagen aquí"
                : "Arrastra la captura del entrenamiento"}
            </p>

            <p className="mt-1 text-xs text-white/40">
              o haz clic para seleccionarla
            </p>
          </div>

          {preview && (
            <div className="relative overflow-hidden rounded-2xl border border-white/10">
              {/* Previsualización local: `next/image` no optimiza blobs. */}
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={preview}
                alt="Vista previa"
                className="max-h-[380px] w-full object-contain bg-black/40"
              />

              <button
                type="button"
                onClick={() => {
                  setFile(null);
                  setPreview("");
                }}
                className="absolute right-3 top-3 rounded-full border border-white/15 bg-black/70 p-2 text-white/70 transition hover:text-white"
              >
                <X size={14} />
              </button>
            </div>
          )}

          <AnalyzeButton
            loading={loading}
            disabled={!file}
            onClick={analyzeImage}
          />

          {initialImageUrl && !preview && (
            <div>
              <p className="mb-2 text-xs uppercase tracking-wider text-white/40">
                Última imagen importada
              </p>

              <Image
                src={initialImageUrl}
                alt="Última sesión"
                width={700}
                height={400}
                className="rounded-xl border border-white/10"
              />
            </div>
          )}
        </div>
      )}

      {/* TEXTO */}

      {mode === "texto" && (
        <div className="space-y-4">
          <div className="relative">
            <textarea
              value={texto}
              onChange={(event) => setTexto(event.target.value)}
              rows={10}
              placeholder={
                "Pega aquí el mensaje de WhatsApp. Por ejemplo:\n\nEntrenamiento 10:30\nEntrenan: Diego, Álvaro, Cherif...\nGimnasio: Aimar\nLesionados: Carlos\nSelección: Ferran"
              }
              className="w-full resize-y rounded-2xl border border-white/10 bg-[#11161D] px-4 py-3 text-sm leading-relaxed text-white outline-none transition placeholder:text-white/25 focus:border-[#C8A96B]/60"
            />

            <div className="mt-2 flex items-center justify-between">
              <button
                type="button"
                onClick={pasteFromClipboard}
                className="inline-flex items-center gap-2 rounded-xl border border-white/10 bg-white/[0.04] px-3 py-1.5 text-[11px] font-semibold text-white/70 transition hover:bg-white/[0.08] hover:text-white"
              >
                <ClipboardPaste size={13} />
                Pegar del portapapeles
              </button>

              <span className="text-[11px] tabular-nums text-white/35">
                {texto.trim().length} caracteres
              </span>
            </div>
          </div>

          <AnalyzeButton
            loading={loading}
            disabled={texto.trim().length < 10}
            onClick={analyzeText}
          />
        </div>
      )}

      {/* CONFLICTO DE FECHA */}

      {conflict && (
        <div className="flex flex-wrap items-center gap-4 rounded-2xl border border-amber-400/30 bg-amber-400/5 px-4 py-3">
          <p className="flex min-w-0 flex-1 items-start gap-2 text-xs leading-relaxed text-amber-200/90">
            <TriangleAlert size={15} className="mt-0.5 shrink-0" />
            {conflict} ¿Quieres reemplazarla con esta importación?
          </p>

          <div className="flex gap-2">
            <button
              type="button"
              disabled={loading}
              onClick={() => {
                const build = pending.current;
                if (build) void send(build, true);
              }}
              className="rounded-xl bg-[#C8A96B] px-4 py-2 text-xs font-semibold text-[#0B0F14] transition hover:bg-[#d8bd85] disabled:opacity-50"
            >
              Reemplazar
            </button>

            <button
              type="button"
              onClick={() => {
                setConflict(null);
                pending.current = null;
              }}
              className="rounded-xl border border-white/15 px-4 py-2 text-xs font-semibold text-white/70 transition hover:text-white"
            >
              Cancelar
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

function AnalyzeButton({
  loading,
  disabled,
  onClick,
}: {
  loading: boolean;
  disabled: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={loading || disabled}
      className="inline-flex items-center gap-2 rounded-xl bg-[#C8A96B] px-5 py-2.5 text-sm font-semibold text-[#0B0F14] transition hover:bg-[#d8bd85] disabled:cursor-not-allowed disabled:opacity-40"
    >
      {loading ? (
        <>
          <Loader2 size={16} className="animate-spin" />
          Analizando…
        </>
      ) : (
        <>
          <Sparkles size={16} />
          Analizar disponibilidad
        </>
      )}
    </button>
  );
}
