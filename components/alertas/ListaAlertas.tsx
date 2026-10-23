"use client";

import {
  AlarmClock,
  BellOff,
  BellRing,
  Paperclip,
  Pencil,
  Repeat,
  Send,
  Trash2,
  Users,
} from "lucide-react";

import {
  describeAvisos,
  describeRepeticion,
  fechaLegible,
  normalizaAvisos,
  type Alerta,
} from "@/lib/alertas/modelo";

/** ¿Lleva una fecha de verdad? Vacía o ilegible, la alerta no suena. */
function fechaValida(iso: string | null | undefined) {
  return Boolean(iso) && !Number.isNaN(new Date(String(iso)).getTime());
}

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

    /* Las que no tienen fecha, detrás de las que sí (19/10/2026): una cadena
       vacía se ordenaba la primera y la lista abría con una que no va a sonar. */
    const sinA = !fechaValida(a.proximoEnvio);
    const sinB = !fechaValida(b.proximoEnvio);

    if (sinA !== sinB) return sinA ? 1 : -1;

    return String(a.proximoEnvio).localeCompare(String(b.proximoEnvio));
  });

  const vivas = ordenadas.filter((a) => a.activa);
  const silenciadas = ordenadas.filter((a) => !a.activa);

  const pinta = (alerta: Alerta) => {
        const bloqueada = ocupada === alerta.id;

        /* Se pintaba en minúsculas tal cual se apuntó, y el cuerpo repetía el
           título cuando sólo se había escrito uno. */
        const mayuscula = (t: string) => t.charAt(0).toUpperCase() + t.slice(1);
        const titulo = mayuscula(alerta.titulo.trim());
        const mensaje = alerta.mensaje?.trim() ?? "";
        const repiteTitulo =
          mensaje.toLowerCase() === alerta.titulo.trim().toLowerCase();

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
                  {titulo}
                </h3>

                {mensaje && !repiteTitulo && (
                  <p className="mt-1 line-clamp-2 text-xs leading-relaxed text-white/50">
                    {mayuscula(mensaje)}
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
                {!alerta.activa
                  ? "Silenciada: no sonará hasta que la reactives"
                  : fechaValida(alerta.proximoEnvio)
                    ? fechaLegible(alerta.proximoEnvio)
                    : /* Antes salía una raya: una activa sin fecha no suena, y eso hay que decirlo.
                         La que va atada al partido no se arregla editándola: se queda sin
                         fecha cuando el calendario no tiene partido por delante, y la
                         recibe sola al abrir esta pantalla cuando lo haya (19/10/2026). */
                      alerta.repeticion === "partido"
                      ? "Sin fecha: espera a que haya próximo partido en el calendario"
                      : "Sin fecha: no sonará hasta que la edites"}
              </span>

              {alerta.repeticion !== "una-vez" && (
                <span className="inline-flex items-center gap-1.5">
                  <Repeat className="h-3 w-3" aria-hidden />
                  {describeRepeticion(alerta)}
                </span>
              )}

              {normalizaAvisos(alerta.avisos).length > 0 && (
                <span
                  className="inline-flex items-center gap-1.5"
                  title="Campanadas de la cita que va adjunta al correo"
                >
                  <BellRing className="h-3 w-3" aria-hidden />
                  {describeAvisos(alerta)}
                </span>
              )}

              <span className="inline-flex items-center gap-1.5" title={alerta.destinatarios.join(", ")}>
                <Users className="h-3 w-3" aria-hidden />
                {alerta.destinatarios.length}{" "}
                {alerta.destinatarios.length === 1 ? "destinatario" : "destinatarios"}
              </span>

              {alerta.adjuntos.length > 0 && (
                <span
                  className="inline-flex items-center gap-1.5"
                  title={`${alerta.adjuntos.length} ${alerta.adjuntos.length === 1 ? "adjunto" : "adjuntos"}`}
                >
                  <Paperclip className="h-3 w-3" aria-hidden />
                  {alerta.adjuntos.length}
                </span>
              )}

              {alerta.envios > 0 && (
                <span title={`Último: ${fechaLegible(alerta.ultimoEnvio)}`}>
                  {alerta.envios === 1
                    ? "Enviada 1 vez"
                    : `Enviada ${alerta.envios} veces`}
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
  };

  return (
    <div className="space-y-2.5">
      {vivas.map((alerta) => pinta(alerta))}

      {/* Las silenciadas no suenan: se apartan para que la lista diga lo que
          sí va a salir. */}
      {silenciadas.length > 0 && (
        <details className="group pt-1" open={vivas.length === 0}>
          <summary className="cursor-pointer select-none rounded-xl px-2 py-2 text-xs text-white/50 transition hover:text-white">
            Silenciadas ({silenciadas.length})
          </summary>

          <div className="mt-2 space-y-2.5">
            {silenciadas.map((alerta) => pinta(alerta))}
          </div>
        </details>
      )}
    </div>
  );
}
