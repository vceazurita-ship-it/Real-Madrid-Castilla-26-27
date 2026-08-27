"use client";

import { useEffect, useState } from "react";
import { AlarmClock, Loader2, Send, X } from "lucide-react";

import { useBodyScrollLock } from "@/components/season/useBodyScrollLock";
import {
  inputLocalAIso,
  isoAInputLocal,
  problemasDe,
  REPETICIONES,
  type Alerta,
  type ContactoAgenda,
  type Repeticion,
} from "@/lib/alertas/modelo";
import CampoAdjuntos from "./CampoAdjuntos";
import CampoDestinatarios from "./CampoDestinatarios";

/**
 * Alta y edición de una tarea con alerta.
 *
 * El formulario trabaja sobre una copia y solo escribe al guardar: media
 * alerta guardada es una alarma que suena sin destinatarios.
 */

interface Props {
  alerta: Alerta;
  agenda: ContactoAgenda[];
  /** `true` cuando la alerta aún no está en la hoja. */
  esNueva: boolean;
  onGuardar: (alerta: Alerta) => Promise<boolean>;
  onEnviarAhora: (alerta: Alerta) => Promise<boolean>;
  onCerrar: () => void;
}

export default function DialogoAlerta({
  alerta,
  agenda,
  esNueva,
  onGuardar,
  onEnviarAhora,
  onCerrar,
}: Props) {
  const [borrador, setBorrador] = useState<Alerta>(alerta);
  const [trabajando, setTrabajando] = useState<"" | "guardar" | "enviar">("");

  useBodyScrollLock(true);

  useEffect(() => {
    const alPulsar = (evento: KeyboardEvent) => {
      if (evento.key === "Escape" && !trabajando) onCerrar();
    };

    window.addEventListener("keydown", alPulsar);

    return () => window.removeEventListener("keydown", alPulsar);
  }, [onCerrar, trabajando]);

  const cambia = <C extends keyof Alerta>(campo: C, valor: Alerta[C]) =>
    setBorrador((actual) => ({ ...actual, [campo]: valor }));

  const problemas = problemasDe(borrador);
  const listo = problemas.length === 0;

  const guardar = async () => {
    if (!listo) return;

    setTrabajando("guardar");

    const bien = await onGuardar(borrador);

    setTrabajando("");

    if (bien) onCerrar();
  };

  const enviar = async () => {
    if (!listo) return;

    setTrabajando("enviar");

    /* Hay que guardar antes: la hoja envía leyendo su propia fila. */
    const guardada = await onGuardar(borrador);

    if (guardada) await onEnviarAhora(borrador);

    setTrabajando("");

    if (guardada) onCerrar();
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={esNueva ? "Nueva tarea con alerta" : "Editar alerta"}
      className="modal-veil fixed inset-0 z-[90] flex items-start justify-center overflow-y-auto p-4 py-10 backdrop-blur-sm"
      onClick={() => !trabajando && onCerrar()}
    >
      <div
        data-export-panel
        className="w-full max-w-lg rounded-3xl border border-white/10 bg-[#11161D] shadow-2xl"
        onClick={(evento) => evento.stopPropagation()}
      >
        {/* ---------------------- CABECERA ---------------------- */}

        <div className="flex items-start justify-between gap-4 border-b border-white/10 p-5">
          <div className="flex items-center gap-3">
            <div className="rounded-2xl bg-white/[0.06] p-2.5 text-[#C8A96B]">
              <AlarmClock size={20} aria-hidden />
            </div>

            <div>
              <h2 className="text-lg font-semibold">
                {esNueva ? "Nueva tarea" : "Editar tarea"}
              </h2>

              <p className="text-xs text-white/40">
                Se avisa por correo a quien indiques
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onCerrar}
            aria-label="Cerrar"
            className="rounded-full p-1.5 text-white/40 transition hover:bg-white/10 hover:text-white"
          >
            <X size={18} aria-hidden />
          </button>
        </div>

        {/* ------------------------ CAMPOS ----------------------- */}

        <div className="space-y-5 p-5">
          <div className="space-y-2">
            <label
              htmlFor="alerta-titulo"
              className="text-[11px] font-semibold uppercase tracking-[0.14em] text-white/40"
            >
              Tarea
            </label>

            <input
              id="alerta-titulo"
              value={borrador.titulo}
              onChange={(evento) => cambia("titulo", evento.target.value)}
              placeholder="Mandar el informe del rival"
              autoFocus
              className="w-full rounded-2xl border border-white/10 bg-white/[0.03] px-3.5 py-2.5 text-sm text-white outline-none transition focus:bg-white/[0.06] placeholder:text-white/30"
            />
          </div>

          <div className="space-y-2">
            <label
              htmlFor="alerta-mensaje"
              className="text-[11px] font-semibold uppercase tracking-[0.14em] text-white/40"
            >
              Mensaje
            </label>

            <textarea
              id="alerta-mensaje"
              value={borrador.mensaje}
              onChange={(evento) => cambia("mensaje", evento.target.value)}
              rows={3}
              placeholder="Lo que quieras que lean en el correo…"
              className="w-full resize-y rounded-2xl border border-white/10 bg-white/[0.03] px-3.5 py-2.5 text-sm leading-relaxed text-white outline-none transition focus:bg-white/[0.06] placeholder:text-white/30"
            />
          </div>

          <CampoDestinatarios
            valor={borrador.destinatarios}
            onChange={(destinatarios) => cambia("destinatarios", destinatarios)}
            agenda={agenda}
          />

          <CampoAdjuntos
            valor={borrador.adjuntos}
            onChange={(adjuntos) => cambia("adjuntos", adjuntos)}
            alertaId={borrador.id}
          />

          {/* ---------------------- CUÁNDO ---------------------- */}

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <label
                htmlFor="alerta-cuando"
                className="text-[11px] font-semibold uppercase tracking-[0.14em] text-white/40"
              >
                Primer aviso
              </label>

              <input
                id="alerta-cuando"
                type="datetime-local"
                value={isoAInputLocal(borrador.proximoEnvio)}
                onChange={(evento) =>
                  cambia("proximoEnvio", inputLocalAIso(evento.target.value))
                }
                className="w-full rounded-2xl border border-white/10 bg-white/[0.03] px-3.5 py-2.5 text-sm text-white outline-none transition focus:bg-white/[0.06]"
              />
            </div>

            <div className="space-y-2">
              <label
                htmlFor="alerta-repeticion"
                className="text-[11px] font-semibold uppercase tracking-[0.14em] text-white/40"
              >
                Se repite
              </label>

              <select
                id="alerta-repeticion"
                value={borrador.repeticion}
                onChange={(evento) =>
                  cambia("repeticion", evento.target.value as Repeticion)
                }
                className="w-full rounded-2xl border border-white/10 bg-white/[0.03] px-3.5 py-2.5 text-sm text-white outline-none transition focus:bg-white/[0.06]"
              >
                {REPETICIONES.map((opcion) => (
                  <option
                    key={opcion.valor}
                    value={opcion.valor}
                    className="bg-[#11161D]"
                  >
                    {opcion.etiqueta}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {borrador.repeticion === "personalizada" && (
            <div className="space-y-2">
              <label
                htmlFor="alerta-intervalo"
                className="text-[11px] font-semibold uppercase tracking-[0.14em] text-white/40"
              >
                Cada cuántos días
              </label>

              <input
                id="alerta-intervalo"
                type="number"
                min={1}
                max={365}
                value={borrador.intervaloDias}
                onChange={(evento) =>
                  cambia("intervaloDias", Number(evento.target.value) || 1)
                }
                className="w-full rounded-2xl border border-white/10 bg-white/[0.03] px-3.5 py-2.5 text-sm text-white outline-none transition focus:bg-white/[0.06] sm:w-32"
              />
            </div>
          )}

          {problemas.length > 0 && (
            <ul className="space-y-1 rounded-2xl bg-amber-500/10 px-4 py-3">
              {problemas.map((problema) => (
                <li key={problema} className="text-xs text-amber-300">
                  {problema}
                </li>
              ))}
            </ul>
          )}
        </div>

        {/* ------------------------ PIE ------------------------- */}

        <div className="flex flex-wrap items-center justify-end gap-2 border-t border-white/10 p-5">
          <button
            type="button"
            onClick={onCerrar}
            disabled={Boolean(trabajando)}
            className="rounded-full px-4 py-2.5 text-sm text-white/60 transition hover:bg-white/[0.06] hover:text-white disabled:opacity-50"
          >
            Cancelar
          </button>

          <button
            type="button"
            onClick={() => void enviar()}
            disabled={!listo || Boolean(trabajando)}
            className="inline-flex items-center gap-2 rounded-full bg-white/[0.06] px-4 py-2.5 text-sm text-white/80 transition hover:bg-white/10 hover:text-white disabled:opacity-40"
          >
            {trabajando === "enviar" ? (
              <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
            ) : (
              <Send className="h-4 w-4" aria-hidden />
            )}
            Enviar ahora
          </button>

          <button
            type="button"
            onClick={() => void guardar()}
            disabled={!listo || Boolean(trabajando)}
            className="inline-flex items-center gap-2 rounded-full bg-[#C8A96B] px-5 py-2.5 text-sm font-semibold text-[#0B0F14] transition hover:brightness-110 disabled:opacity-40"
          >
            {trabajando === "guardar" && (
              <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
            )}
            Guardar
          </button>
        </div>
      </div>
    </div>
  );
}
