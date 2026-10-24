"use client";

import { Mail, MessageCircle } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

import { Button } from "@/components/abp/ui";
import { enlaceWhatsapp, textoDeMisPronosticos } from "@/lib/quiniela/envio";
import type { Signo } from "@/lib/quiniela/modelo";

/** Con la apuesta guardada: pasársela a uno mismo por WhatsApp o por correo. */
export function EnviarMiQuiniela({
  jornada,
  nombre,
  guardados,
  telefono,
}: {
  jornada: number;
  nombre: string;
  guardados: (Signo | null | undefined)[];
  telefono?: string | null;
}) {
  const [enviando, setEnviando] = useState(false);

  const texto = textoDeMisPronosticos(jornada, nombre, guardados);

  async function porCorreo() {
    setEnviando(true);

    try {
      const r = await fetch("/api/quiniela/enviar", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ jornada }),
      });
      const d = (await r.json().catch(() => null)) as { ok?: boolean; error?: string } | null;

      if (!r.ok || !d?.ok) throw new Error(d?.error ?? `HTTP ${r.status}`);

      toast.success("Te la hemos mandado a tu correo");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "No se ha podido mandar el correo");
    } finally {
      setEnviando(false);
    }
  }

  return (
    <div className="mt-3 flex flex-wrap items-center justify-end gap-2">
      <span className="mr-auto text-[11px] text-white/35">Llévatela contigo:</span>

      <a href={enlaceWhatsapp(texto, telefono)} target="_blank" rel="noopener noreferrer">
        <Button icon={MessageCircle}>Enviármela por WhatsApp</Button>
      </a>

      <Button icon={Mail} onClick={() => void porCorreo()} disabled={enviando}>
        {enviando ? "Enviando…" : "Enviármela por correo"}
      </Button>
    </div>
  );
}
