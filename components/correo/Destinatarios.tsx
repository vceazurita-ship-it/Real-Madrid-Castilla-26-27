"use client";

import { useState } from "react";
import { Mail, MessageCircle, Plus, X } from "lucide-react";

import { useAgendaEnvios } from "@/hooks/useAgendaEnvios";
import { esTelefono, normalizaTelefono, telefonoLegible, type CanalEnvio } from "@/lib/correo/whatsapp";

/**
 * A QUIÉN SE MANDA UN INFORME (15/10/2026).
 *
 * Correo o WhatsApp, y los destinatarios como fichas. Debajo, las propuestas:
 * todo a quien ya se ha mandado un informe (`useAgendaEnvios`), lo más usado
 * primero; un toque lo añade. Los valores siguen siendo un texto separado por
 * comas, como se guardaban antes en `*:informe-correo`.
 */

const esCorreo = (t: string) => /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(t.trim());

const lista = (texto: string) => texto.split(/[\s,;]+/).map((x) => x.trim()).filter(Boolean);

/** Los teléfonos se separan sólo por comas, punto y coma o línea: llevan espacios dentro. */
const listaTelefonos = (texto: string) => texto.split(/[,;\n]+/).map((x) => x.trim()).filter(Boolean);

type Props = {
  label: string;
  canal: CanalEnvio;
  onCanal: (canal: CanalEnvio) => void;
  correos: string;
  onCorreos: (texto: string) => void;
  telefonos: string;
  onTelefonos: (texto: string) => void;
};

export function Destinatarios({ label, canal, onCanal, correos, onCorreos, telefonos, onTelefonos }: Props) {
  const { contactos, olvida } = useAgendaEnvios();
  const [texto, setTexto] = useState("");

  const whatsapp = canal === "whatsapp";
  const puestos = whatsapp ? listaTelefonos(telefonos) : lista(correos);
  const clave = (v: string) => (whatsapp ? normalizaTelefono(v) : v.toLowerCase());
  const yaPuestos = new Set(puestos.map(clave));

  const propuestas = contactos
    .filter((c) => c.tipo === canal && !yaPuestos.has(clave(c.valor)))
    .filter((c) => !texto.trim() || c.valor.toLowerCase().includes(texto.trim().toLowerCase().replace(/\s/g, "")))
    .slice(0, 8);

  const guarda = (valores: string[]) => (whatsapp ? onTelefonos(valores.join(", ")) : onCorreos(valores.join(", ")));

  const añade = (entrada: string) => {
    const nuevos = (whatsapp ? listaTelefonos(entrada) : lista(entrada)).filter((v) => !yaPuestos.has(clave(v)));

    if (nuevos.length) guarda([...puestos, ...nuevos.map((v) => (whatsapp && esTelefono(v) ? normalizaTelefono(v) : v))]);

    setTexto("");
  };

  const quita = (v: string) => guarda(puestos.filter((x) => x !== v));

  const valido = (v: string) => (whatsapp ? esTelefono(v) : esCorreo(v));

  return (
    <div className="min-w-0 space-y-2">
      <div className="flex flex-wrap items-center gap-2">
        <span className="text-[10px] uppercase tracking-[0.16em] text-white/40">{label}</span>

        <div role="radiogroup" aria-label="Cómo se manda" className="ml-auto flex rounded-lg border border-white/15 p-0.5 text-xs">
          {(
            [
              ["correo", "Correo", Mail],
              ["whatsapp", "WhatsApp", MessageCircle],
            ] as const
          ).map(([valor, rotulo, Icono]) => (
            <button
              key={valor}
              type="button"
              role="radio"
              aria-checked={canal === valor}
              onClick={() => onCanal(valor)}
              className={`flex items-center gap-1 rounded-md px-2.5 py-1 ${canal === valor ? "bg-[#C8A96B] font-medium text-black" : "text-white/60 hover:text-white"}`}
            >
              <Icono size={13} /> {rotulo}
            </button>
          ))}
        </div>
      </div>

      <div className="flex min-h-[42px] flex-wrap items-center gap-1.5 rounded-lg border border-white/15 bg-white/[0.06] px-2 py-1.5">
        {puestos.map((v) => (
          <span
            key={v}
            className={`flex items-center gap-1 rounded-md px-2 py-0.5 text-xs ${valido(v) ? "bg-white/10 text-white" : "bg-red-500/20 text-red-200"}`}
            title={valido(v) ? undefined : whatsapp ? "No parece un teléfono" : "No parece un correo"}
          >
            {whatsapp && valido(v) ? telefonoLegible(v) : v}
            <button type="button" onClick={() => quita(v)} aria-label={`Quitar ${v}`} className="text-white/50 hover:text-white">
              <X size={12} />
            </button>
          </span>
        ))}

        <input
          value={texto}
          onChange={(e) => setTexto(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" || e.key === "," || e.key === ";") {
              e.preventDefault();
              añade(texto);
            } else if (e.key === "Backspace" && !texto && puestos.length) quita(puestos[puestos.length - 1]);
          }}
          onBlur={() => texto.trim() && añade(texto)}
          onPaste={(e) => {
            const pegado = e.clipboardData.getData("text");

            if (/[,;\n]/.test(pegado)) {
              e.preventDefault();
              añade(pegado);
            }
          }}
          inputMode={whatsapp ? "tel" : "email"}
          placeholder={puestos.length ? "" : whatsapp ? "600 11 22 33 (sin prefijo = España)" : "correo@ejemplo.com"}
          aria-label={whatsapp ? "Añadir un teléfono" : "Añadir un correo"}
          className="min-w-[160px] flex-1 bg-transparent px-1 py-0.5 text-sm text-white outline-none placeholder:text-white/30"
        />
      </div>

      {propuestas.length > 0 && (
        <div className="flex flex-wrap items-center gap-1.5">
          <span className="text-[11px] text-white/35">Otras veces:</span>
          {propuestas.map((c) => (
            <span key={c.valor} className="group flex items-center rounded-md border border-white/10 text-[11px] text-white/60">
              <button type="button" onClick={() => añade(c.valor)} className="flex items-center gap-1 px-2 py-0.5 hover:text-white">
                <Plus size={11} /> {whatsapp ? telefonoLegible(c.valor) : c.valor}
              </button>
              <button
                type="button"
                onClick={() => olvida(c.tipo, c.valor)}
                aria-label={`Olvidar ${c.valor}`}
                title="Quitar de las propuestas"
                className="hidden pr-1.5 text-white/35 hover:text-white group-hover:block"
              >
                <X size={11} />
              </button>
            </span>
          ))}
        </div>
      )}

      {whatsapp && (
        <p className="text-[11px] leading-relaxed text-white/35">
          Sale desde tu WhatsApp: al terminar se abre un botón por persona con el mensaje y los enlaces ya escritos, y
          pulsas «Enviar» en cada chat. Sin teléfonos, eliges tú el chat o el grupo.
        </p>
      )}
    </div>
  );
}
