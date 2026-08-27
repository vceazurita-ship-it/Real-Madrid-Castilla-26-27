"use client";

import {
  AlarmClock,
  BellOff,
  Paperclip,
  Pencil,
  Repeat,
  Send,
  Trash2,
  Users,
} from "lucide-react";

import {
  describeRepeticion,
  fechaLegible,
  type Alerta,
} from "@/lib/alertas/modelo";

/**
 * Las tareas con alerta, ordenadas por lo que suena antes.
 *
 * Se usa igual en el panel del botón flotante y en la página del módulo, así
 * que no sabe nada de dónde está: recibe la lista y devuelve las acciones.
 */

interface Props {
  alertas: Alerta[];
  onEditar: (alerta: Alerta) => void;
  onEnviarAhora: (alerta: Alerta) => void;
  onAlternarActiva: (alerta: Alerta) => void;
  onBorrar: (alerta: Alerta) => void;
  /** Deshabilita los botones mientras hay una operación en vuelo. */
  ocupada: string | null;
}

export default function ListaAlertas({
  alertas,
  onEditar,
  onEnviarAhora,
  onAlternarActiva,
  onBorrar,
  ocupada,
}: Props) {
  if (!alertas.length) {
    return (
      <div className="rounded-3xl border border-dashed border-white/10 px-6 py-10 text-center">
        <AlarmClock className="mx-auto h-7 w-7 text-white/20" aria-hidden />

        <p className="mt-3 text-sm text-white/50">
          Todavía no hay ninguna tarea con alerta.
        </p>
      </div>
    );
  }

  /* Las apagadas al final; entre las vivas, la que antes suena arriba. */
  const ordenadas = [...alertas].sort((a, b) => {
    if (a.activa !== b.activa) return a.activa ? -1 : 1;

    return String(a.proximoEnvio).localeCompare(String(b.proximoEnvio));
  });

  return (
    <div className="space-y-2.5">
      {ordenadas.map((alerta) => {
        const bloqueada = ocupada === alerta.id;

        return (
          <article
            key={alerta.id}
            className={`rounded-3xl border border-white/10 bg-white/[0.03] p-4 transition ${
              alerta.activa ? "" : "opacity-55"
            }`}
          >
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0 flex-1">
                <h3 className="truncate text-sm font-semibold text-white">
                  {alerta.titulo}
                </h3>

                {alerta.mensaje && (
                  <p className="mt-1 line-clamp-2 text-xs leading-relaxed text-white/50">
                    {alerta.mensaje}
                  </p>
                )}
              </div>

              <button
                type="button"
                onClick={() => onAlternarActiva(alerta)}
                disabled={bloqueada}
                title={alerta.activa ? "Silenciar" : "Reactivar"}
                aria-label={alerta.activa ? "Silenciar" : "Reactivar"}
                className="shrink-0 rounded-full p-1.5 text-white/40 transition hover:bg-white/10 hover:text-white disabled:opacity-40"
              >
                {alerta.activa ? (
                  <AlarmClock className="h-4 w-4" aria-hidden />
                ) : (
                  <BellOff className="h-4 w-4" aria-hidden />
                )}
              </button>
            </div>

            {/* ------------------- DATOS ------------------- */}

            <div className="mt-3 flex flex-wrap items-center gap-x-3 gap-y-1.5 text-[11px] text-white/40">
              <span className="inline-flex items-center gap-1.5">
                <AlarmClock className="h-3 w-3" aria-hidden />
                {alerta.activa
                  ? fechaLegible(alerta.proximoEnvio)
                  : "Silenciada"}
              </span>

              {alerta.repeticion !== "una-vez" && (
                <span className="inline-flex items-center gap-1.5">
                  <Repeat className="h-3 w-3" aria-hidden />
                  {describeRepeticion(alerta)}
                </span>
              )}

              <span className="inline-flex items-center gap-1.5">
                <Users className="h-3 w-3" aria-hidden />
                {alerta.destinatarios.length}
              </span>

              {alerta.adjuntos.length > 0 && (
                <span className="inline-flex items-center gap-1.5">
                  <Paperclip className="h-3 w-3" aria-hidden />
                  {alerta.adjuntos.length}
                </span>
              )}

              {alerta.envios > 0 && (
                <span title={`Último: ${fechaLegible(alerta.ultimoEnvio)}`}>
                  {alerta.envios} {alerta.envios === 1 ? "envío" : "envíos"}
                </span>
              )}
            </div>

            {/* ------------------ ACCIONES ----------------- */}

            <div className="mt-3 flex items-center gap-1 border-t border-white/[0.06] pt-3">
              <button
                type="button"
                onClick={() => onEditar(alerta)}
                disabled={bloqueada}
                className="inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs text-white/60 transition hover:bg-white/[0.06] hover:text-white disabled:opacity-40"
              >
                <Pencil className="h-3.5 w-3.5" aria-hidden />
                Editar
              </button>

              <button
                type="button"
                onClick={() => onEnviarAhora(alerta)}
                disabled={bloqueada}
                className="inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs text-white/60 transition hover:bg-white/[0.06] hover:text-white disabled:opacity-40"
              >
                <Send className="h-3.5 w-3.5" aria-hidden />
                Enviar ahora
              </button>

              <button
                type="button"
                onClick={() => onBorrar(alerta)}
                disabled={bloqueada}
                className="ml-auto inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs text-white/40 transition hover:bg-red-500/10 hover:text-red-300 disabled:opacity-40"
              >
                <Trash2 className="h-3.5 w-3.5" aria-hidden />
                Borrar
              </button>
            </div>
          </article>
        );
      })}
    </div>
  );
}
