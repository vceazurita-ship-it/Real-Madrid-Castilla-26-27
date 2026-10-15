"use client";

import { useState } from "react";
import { Check, Copy, MessageCircle, Users, X } from "lucide-react";

import { enlaceWhatsapp, telefonoLegible, type MensajeWhatsapp } from "@/lib/correo/whatsapp";

/**
 * Los mensajes de WhatsApp listos (15/10/2026): un botón por mensaje y por
 * persona que abre el chat con todo escrito. Los navegadores no dejan abrir
 * varias pestañas de un clic, así que va uno a uno; cada botón se marca al
 * pulsarlo para saber por dónde se va.
 */
export function PanelWhatsapp({ mensajes, telefonos, onCierra }: { mensajes: MensajeWhatsapp[]; telefonos: string[]; onCierra: () => void }) {
  const [abiertos, setAbiertos] = useState<Set<string>>(new Set());
  const [copiado, setCopiado] = useState<number | null>(null);

  if (!mensajes.length) return null;

  const abre = (clave: string, numero: string | null, texto: string) => {
    window.open(enlaceWhatsapp(numero, texto), "_blank", "noopener");
    setAbiertos((s) => new Set(s).add(clave));
  };

  const copia = async (i: number, texto: string) => {
    try {
      await navigator.clipboard.writeText(texto);
      setCopiado(i);
      setTimeout(() => setCopiado(null), 1800);
    } catch {
      /* Sin permiso para el portapapeles: queda el botón de abrir. */
    }
  };

  return (
    <div className="space-y-3 rounded-xl border border-emerald-400/30 bg-emerald-400/[0.06] p-3">
      <div className="flex items-center gap-2">
        <MessageCircle size={16} className="text-emerald-300" />
        <p className="text-sm font-medium text-white">Listo para mandar por WhatsApp</p>
        <button type="button" onClick={onCierra} aria-label="Cerrar" className="ml-auto text-white/40 hover:text-white">
          <X size={15} />
        </button>
      </div>

      {mensajes.map((m, i) => (
        <div key={m.titulo} className="space-y-2">
          <p className="text-[10px] uppercase tracking-[0.16em] text-white/45">{m.titulo}</p>

          <div className="flex flex-wrap gap-1.5">
            {telefonos.map((t) => {
              const clave = `${i}:${t}`;
              const hecho = abiertos.has(clave);

              return (
                <button
                  key={t}
                  type="button"
                  onClick={() => abre(clave, t, m.texto)}
                  className={`flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-sm ${hecho ? "bg-white/10 text-white/60" : "bg-emerald-500 font-medium text-black hover:bg-emerald-400"}`}
                >
                  {hecho ? <Check size={14} /> : <MessageCircle size={14} />} {telefonoLegible(t)}
                </button>
              );
            })}

            <button
              type="button"
              onClick={() => abre(`${i}:chat`, null, m.texto)}
              className="flex items-center gap-1.5 rounded-lg border border-white/15 px-3 py-1.5 text-sm text-white/75 hover:bg-white/10"
            >
              <Users size={14} /> {telefonos.length ? "Otro chat o grupo" : "Elegir chat o grupo"}
            </button>

            <button
              type="button"
              onClick={() => void copia(i, m.texto)}
              className="flex items-center gap-1.5 rounded-lg border border-white/15 px-3 py-1.5 text-sm text-white/75 hover:bg-white/10"
            >
              {copiado === i ? <Check size={14} /> : <Copy size={14} />} Copiar el texto
            </button>
          </div>

          <pre className="max-h-40 overflow-auto whitespace-pre-wrap rounded-lg bg-black/30 p-2 font-sans text-xs text-white/60">{m.texto}</pre>
        </div>
      ))}
    </div>
  );
}
