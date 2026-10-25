"use client";

import { Eye, Mail, MessageCircle, X } from "lucide-react";
import { useEffect, useState } from "react";
import { toast } from "sonner";

import { Button } from "@/components/abp/ui";
import { descarga } from "@/lib/export/lienzos";
import { enlaceWhatsappConImagen, mensajeCorto } from "@/lib/quiniela/envio";
import { blobABase64, creaLamina } from "@/lib/quiniela/lamina";
import type { Signo } from "@/lib/quiniela/modelo";

/** Con la apuesta guardada: pasársela a uno mismo, en imagen, por WhatsApp o por correo. */
export function EnviarMiQuiniela({
  jornada,
  nombre,
  slug,
  guardados,
  telefono,
  cierre,
  cerrada,
}: {
  jornada: number;
  nombre: string;
  slug?: string | null;
  guardados: (Signo | null | undefined)[];
  telefono?: string | null;
  cierre?: string;
  cerrada?: boolean;
}) {
  const [ocupado, setOcupado] = useState<"" | "vista" | "whatsapp" | "correo">("");
  const [vista, setVista] = useState<string | null>(null);

  useEffect(() => {
    return () => {
      if (vista) URL.revokeObjectURL(vista);
    };
  }, [vista]);

  const lamina = () => creaLamina({ jornada, nombre, slug, signos: guardados, cierre, cerrada });
  const archivo = `mi-quiniela-jornada-${jornada}.png`;

  async function verVista() {
    setOcupado("vista");

    try {
      setVista(URL.createObjectURL(await lamina()));
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "No se ha podido crear la lámina");
    } finally {
      setOcupado("");
    }
  }

  async function porWhatsapp() {
    setOcupado("whatsapp");

    try {
      const blob = await lamina();
      const fichero = new File([blob], archivo, { type: "image/png" });

      if (navigator.canShare?.({ files: [fichero] })) {
        try {
          await navigator.share({ files: [fichero], text: mensajeCorto(jornada) });
        } catch (e) {
          if (e instanceof DOMException && e.name === "AbortError") return;
          throw e;
        }
      } else {
        descarga(blob, archivo);
        window.open(enlaceWhatsappConImagen(jornada, telefono), "_blank", "noopener,noreferrer");
        toast.success("Imagen descargada: adjúntala en WhatsApp");
      }
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "No se ha podido preparar la imagen");
    } finally {
      setOcupado("");
    }
  }

  async function porCorreo() {
    setOcupado("correo");

    try {
      const imagen = await blobABase64(await lamina());

      const r = await fetch("/api/quiniela/enviar", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ jornada, imagen }),
      });
      const d = (await r.json().catch(() => null)) as { ok?: boolean; error?: string } | null;

      if (!r.ok || !d?.ok) throw new Error(d?.error ?? `HTTP ${r.status}`);

      toast.success("Te la hemos mandado a tu correo");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "No se ha podido mandar el correo");
    } finally {
      setOcupado("");
    }
  }

  return (
    <div className="mt-3 flex flex-wrap items-center justify-end gap-2">
      <span className="mr-auto text-[11px] text-white/35">Llévatela contigo, en imagen:</span>

      <Button icon={Eye} onClick={() => void verVista()} disabled={ocupado !== ""}>
        {ocupado === "vista" ? "Preparando…" : "Vista previa"}
      </Button>

      <Button icon={MessageCircle} onClick={() => void porWhatsapp()} disabled={ocupado !== ""}>
        {ocupado === "whatsapp" ? "Preparando…" : "Por WhatsApp"}
      </Button>

      <Button icon={Mail} onClick={() => void porCorreo()} disabled={ocupado !== ""}>
        {ocupado === "correo" ? "Enviando…" : "Por correo"}
      </Button>

      {vista && (
        <div
          className="modal-veil fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4 backdrop-blur-sm"
          role="dialog"
          aria-label="Vista previa de tu quiniela"
          onClick={() => setVista(null)}
        >
          <div className="relative max-h-full w-full max-w-sm" onClick={(e) => e.stopPropagation()}>
            <button
              type="button"
              aria-label="Cerrar"
              onClick={() => setVista(null)}
              className="absolute -top-3 -right-3 z-10 flex h-8 w-8 items-center justify-center rounded-full bg-[#C8A96B] text-black"
            >
              <X size={16} />
            </button>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={vista} alt={`Mi quiniela, jornada ${jornada}`} className="max-h-[85vh] w-full rounded-xl object-contain" />
          </div>
        </div>
      )}
    </div>
  );
}
