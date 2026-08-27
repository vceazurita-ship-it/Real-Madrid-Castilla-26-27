"use client";

import { useRef, useState } from "react";
import {
  FileText,
  Image as IconoImagen,
  Loader2,
  Music,
  Paperclip,
  Video,
  X,
} from "lucide-react";
import { toast } from "sonner";

import {
  familiaAdjunto,
  pesoLegible,
  type Adjunto,
  type FamiliaAdjunto,
} from "@/lib/alertas/modelo";
import { uploadFile } from "@/lib/uploadFile";

/**
 * La foto, el vídeo o la canción que acompaña al aviso.
 *
 * El fichero se sube al bucket `performance` de Supabase en cuanto se elige, y
 * lo que se guarda en la alerta es solo el enlace. Al correo va ese enlace, no
 * el binario: Gmail rechaza los adjuntos de más de 25 MB y un vídeo de
 * entrenamiento los pasa casi siempre.
 */

interface Props {
  valor: Adjunto[];
  onChange: (adjuntos: Adjunto[]) => void;
  /** Carpeta del bucket: una por alerta, para que no choquen los nombres. */
  alertaId: string;
}

const ICONOS: Record<FamiliaAdjunto, typeof IconoImagen> = {
  foto: IconoImagen,
  video: Video,
  audio: Music,
  documento: FileText,
};

export default function CampoAdjuntos({ valor, onChange, alertaId }: Props) {
  const [subiendo, setSubiendo] = useState(0);
  const entrada = useRef<HTMLInputElement>(null);

  const subir = async (ficheros: FileList | null) => {
    if (!ficheros?.length) return;

    const lista = Array.from(ficheros);

    setSubiendo(lista.length);

    const subidos: Adjunto[] = [];

    for (const fichero of lista) {
      try {
        /*
        | La ruta de subida rechaza sobrescribir, así que un mismo nombre
        | subido dos veces fallaría. El prefijo de tiempo lo evita sin tener
        | que enseñar al usuario un error que no puede arreglar.
        */
        const unico = new File(
          [fichero],
          `${Date.now().toString(36)}-${fichero.name}`,
          { type: fichero.type },
        );

        const resultado = await uploadFile(unico, `alertas/${alertaId}`);

        if (!resultado?.url) throw new Error("La subida no devolvió enlace");

        subidos.push({
          nombre: fichero.name,
          url: resultado.url,
          tipo: fichero.type,
          tamano: fichero.size,
        });
      } catch (error) {
        console.error("[alertas] subida", error);

        toast.error(`No se ha podido subir «${fichero.name}»`, {
          description:
            error instanceof Error ? error.message : "Error de subida",
        });
      }
    }

    setSubiendo(0);

    if (subidos.length) onChange([...valor, ...subidos]);

    /* Sin esto, volver a elegir el mismo fichero no dispara `change`. */
    if (entrada.current) entrada.current.value = "";
  };

  const quitar = (url: string) =>
    onChange(valor.filter((adjunto) => adjunto.url !== url));

  return (
    <div className="space-y-2">
      <label className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.14em] text-white/40">
        <Paperclip className="h-3.5 w-3.5" aria-hidden />
        Adjuntos
      </label>

      {valor.length > 0 && (
        <div className="space-y-1.5">
          {valor.map((adjunto) => {
            const familia = familiaAdjunto(adjunto);
            const Icono = ICONOS[familia];

            return (
              <div
                key={adjunto.url}
                className="flex items-center gap-2.5 rounded-2xl border border-white/10 bg-white/[0.03] px-3 py-2"
              >
                <Icono className="h-4 w-4 shrink-0 text-white/40" aria-hidden />

                <span className="min-w-0 flex-1 truncate text-sm text-white/80">
                  {adjunto.nombre}
                </span>

                {adjunto.tamano > 0 && (
                  <span className="shrink-0 text-[11px] text-white/30">
                    {pesoLegible(adjunto.tamano)}
                  </span>
                )}

                <button
                  type="button"
                  onClick={() => quitar(adjunto.url)}
                  aria-label={`Quitar ${adjunto.nombre}`}
                  className="shrink-0 rounded-full p-1 text-white/40 transition hover:bg-white/10 hover:text-white"
                >
                  <X className="h-3.5 w-3.5" aria-hidden />
                </button>
              </div>
            );
          })}
        </div>
      )}

      <input
        ref={entrada}
        type="file"
        multiple
        className="hidden"
        onChange={(evento) => void subir(evento.target.files)}
      />

      <button
        type="button"
        disabled={subiendo > 0}
        onClick={() => entrada.current?.click()}
        className="flex w-full items-center justify-center gap-2 rounded-2xl border border-dashed border-white/15 bg-white/[0.02] px-3 py-3 text-sm text-white/60 transition hover:bg-white/[0.05] hover:text-white disabled:opacity-60"
      >
        {subiendo > 0 ? (
          <>
            <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
            Subiendo {subiendo}…
          </>
        ) : (
          <>
            <Paperclip className="h-4 w-4" aria-hidden />
            Subir una foto, un vídeo, una canción…
          </>
        )}
      </button>

      <p className="text-[11px] leading-relaxed text-white/30">
        Se suben al servidor y al correo va el enlace, así que no hay límite de
        tamaño. Las fotos, además, se ven dentro del propio correo.
      </p>
    </div>
  );
}
