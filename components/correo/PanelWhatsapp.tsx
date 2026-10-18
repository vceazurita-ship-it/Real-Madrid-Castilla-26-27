"use client";

import { useState } from "react";
import { Check, Copy, FileDown, MessageCircle, Share2, Users, X } from "lucide-react";

import { enlaceWhatsapp, telefonoLegible, type MensajeWhatsapp } from "@/lib/correo/whatsapp";

/**
 * Los mensajes de WhatsApp listos (15/10/2026): un botón por mensaje y por
 * persona que abre el chat con todo escrito. Los navegadores no dejan abrir
 * varias pestañas de un clic, así que va uno a uno; cada botón se marca al
 * pulsarlo para saber por dónde se va.
 */
export function PanelWhatsapp({ mensajes, telefonos, archivo, onCierra }: { mensajes: MensajeWhatsapp[]; telefonos: string[]; /** El PDF del informe, para mandarlo como archivo (18/10/2026). */ archivo?: File | null; onCierra: () => void }) {
  const [abiertos, setAbiertos] = useState<Set<string>>(new Set());
  const [copiado, setCopiado] = useState<number | null>(null);

  if (!mensajes.length) return null;

  /* El móvil (y Windows con la app de WhatsApp) deja compartir el archivo; si no, se descarga y se adjunta a mano. */
  const comparteArchivo = typeof navigator !== "undefined" && Boolean(archivo) && Boolean(navigator.canShare?.({ files: [archivo!] }));

  const comparte = async () => {
    if (!archivo) return;

    try {
      await navigator.share({ files: [archivo], title: archivo.name, text: mensajes[0]?.texto });
    } catch {
      /* Cancelado: no pasa nada. */
    }
  };

  const descarga = () => {
    if (!archivo) return;

    const url = URL.createObjectURL(archivo);
    const a = document.createElement("a");

    a.href = url;
    a.download = archivo.name;
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 10_000);
  };

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

      {archivo ? (
        <div className="flex flex-wrap items-center gap-1.5">
          {comparteArchivo ? (
            <button type="button" onClick={() => void comparte()} className="flex items-center gap-1.5 rounded-lg bg-emerald-500 px-3 py-1.5 text-sm font-medium text-black hover:bg-emerald-400">
              <Share2 size={14} /> Compartir el PDF
            </button>
          ) : null}
          <button type="button" onClick={descarga} className="flex items-center gap-1.5 rounded-lg border border-white/15 px-3 py-1.5 text-sm text-white/75 hover:bg-white/10">
            <FileDown size={14} /> Descargar el PDF
          </button>
          <span className="text-[11px] text-white/45">
            {comparteArchivo ? "Sale el PDF como archivo; elige WhatsApp y el chat." : "Para mandarlo como archivo, descárgalo y adjúntalo en el chat."} La primera página lleva el vídeo enlazado.
          </span>
        </div>
      ) : null}

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
