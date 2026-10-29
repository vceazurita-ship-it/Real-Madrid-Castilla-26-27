"use client";

/**
 * «TU SESIÓN» (19/10/2026): el mensaje corto de un jugador para mandárselo
 * por WhatsApp. Sólo lo prepara: el texto se puede retocar, y el botón abre
 * WhatsApp con el mensaje escrito (wa.me, como los informes:
 * lib/correo/whatsapp.ts). Nada sale solo.
 *
 * El teléfono del jugador se recuerda en ESTE aparato y en ningún otro sitio:
 * los documentos del día los puede leer cualquiera que entre en la web, y un
 * móvil de un jugador no debe viajar ahí.
 */

import { useState } from "react";
import { Copy, MessageCircle } from "lucide-react";
import { toast } from "sonner";

import { Notice } from "@/components/abp/ui";
import { enlaceWhatsapp, esTelefono, normalizaTelefono } from "@/lib/correo/whatsapp";
import type { TuSesion as Mensaje } from "@/lib/entreno/jugador";

import { CAMPO } from "./ObjetivoEditor";

const claveTelefono = (jugador: string) => `rmcf-entreno-telefono:${jugador}`;

function leeTelefono(jugador: string) {
  try {
    return window.localStorage.getItem(claveTelefono(jugador)) ?? "";
  } catch {
    return "";
  }
}

function guardaTelefono(jugador: string, telefono: string) {
  try {
    if (telefono.trim()) window.localStorage.setItem(claveTelefono(jugador), telefono.trim());
    else window.localStorage.removeItem(claveTelefono(jugador));
  } catch {
    /* Sin almacenamiento (ventana privada): se usa sólo esta vez. */
  }
}

/**
 * Se monta con `key` por jugador y día: así el texto retocado vuelve a lo
 * propuesto al cambiar de jugador o de día, sin efectos que reescriban estado.
 */
export function TuSesion({ jugador, nombre, mensaje }: { jugador: string; nombre: string; mensaje: Mensaje }) {
  const [texto, setTexto] = useState(mensaje.texto);
  const [telefono, setTelefono] = useState(() => (typeof window === "undefined" ? "" : leeTelefono(jugador)));
  const numero = esTelefono(telefono) ? normalizaTelefono(telefono) : null;
  const telefonoMal = telefono.trim() !== "" && !numero;

  const copia = async () => {
    try {
      await navigator.clipboard.writeText(texto);
      toast.success("Mensaje copiado");
    } catch {
      toast.error("No se ha podido copiar: selecciona el texto y cópialo a mano");
    }
  };

  return (
    <div className="space-y-3">
      {mensaje.sinValidar > 0 ? (
        <Notice tone="warn" title={`${mensaje.sinValidar} ${mensaje.sinValidar === 1 ? "acción suya sigue" : "acciones suyas siguen"} sin validar`}>
          El mensaje cuenta con lo que se propuso solo. Valídalas en «El día» antes de mandarlo si quieres que sea tu criterio.
        </Notice>
      ) : null}

      <label className="block">
        <span className="mb-1 block text-[10px] font-semibold uppercase tracking-[0.14em] text-white/45">El mensaje (puedes retocarlo)</span>
        <textarea value={texto} onChange={(e) => setTexto(e.target.value)} rows={Math.min(14, texto.split("\n").length + 2)} className={`${CAMPO} resize-y font-mono text-[13px] leading-relaxed`} />
      </label>

      <div className="flex flex-wrap items-end gap-2">
        <label className="block min-w-0 flex-1 basis-48">
          <span className="mb-1 block text-[10px] font-semibold uppercase tracking-[0.14em] text-white/45">Móvil de {nombre} (opcional)</span>
          <input
            type="tel"
            inputMode="tel"
            autoComplete="off"
            value={telefono}
            onChange={(e) => setTelefono(e.target.value)}
            onBlur={() => guardaTelefono(jugador, telefono)}
            placeholder="600 11 22 33"
            className={CAMPO}
          />
        </label>
        <a
          href={enlaceWhatsapp(numero, texto)}
          target="_blank"
          rel="noreferrer"
          onClick={() => guardaTelefono(jugador, telefono)}
          className="inline-flex shrink-0 items-center gap-1.5 rounded-xl border border-[#C8A96B] bg-[#C8A96B] px-3 py-2 text-xs font-semibold text-black hover:bg-[#d8bc82] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#C8A96B]"
        >
          <MessageCircle size={14} /> {numero ? "Abrir su chat en WhatsApp" : "Elegir chat en WhatsApp"}
        </a>
        <button
          type="button"
          onClick={() => void copia()}
          className="inline-flex shrink-0 items-center gap-1.5 rounded-xl border border-white/12 px-3 py-2 text-xs font-medium text-white/70 hover:text-white focus-visible:outline focus-visible:outline-2 focus-visible:outline-[#C8A96B]"
        >
          <Copy size={14} /> Copiar
        </button>
      </div>
      <p className={`text-[11px] ${telefonoMal ? "text-amber-300/80" : "text-white/45"}`}>
        {telefonoMal
          ? "Ese número no parece un móvil: sin él, WhatsApp te deja elegir el chat."
          : "WhatsApp se abre con el mensaje escrito: lo mandas tú con «Enviar». El móvil sólo se recuerda en este aparato."}
      </p>
    </div>
  );
}
