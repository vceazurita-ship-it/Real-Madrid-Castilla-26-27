"use client";

import { useEffect, useState } from "react";
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
  saldriaSiSeReactiva,
  tituloLegible,
  type Alerta,
  type PartidoParaAlerta,
} from "@/lib/alertas/modelo";

/** ¿Lleva una fecha de verdad? Vacía o ilegible, la alerta no suena. */
function fechaValida(iso: string | null | undefined) {
  return Boolean(iso) && !Number.isNaN(new Date(String(iso)).getTime());
}

/** Quién recibe el correo, por nombre: «ana, luis y 2 más». */
function nombresDestino(destinatarios: string[]) {
  /* 29/10/2026: «v ceazurita» se lee «V. Ceazurita»: palabras con mayúscula y la inicial suelta con punto. */
  const legible = (usuario: string) =>
    usuario
      .replace(/[._-]+/g, " ")
      .trim()
      .split(/s+/)
      .map((p) => (p.length === 1 ? `${p.toUpperCase()}.` : p.charAt(0).toUpperCase() + p.slice(1)))
      .join(" ");

  const nombres = destinatarios.map((d) => legible(d.split("@")[0])).filter(Boolean);

  if (nombres.length === 0) return "Sin destinatarios";
  if (nombres.length === 1) return nombres[0];
  if (nombres.length === 2) return `${nombres[0]} y ${nombres[1]}`;

  return `${nombres[0]}, ${nombres[1]} y ${nombres.length - 2} más`;
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
  /** El calendario, para decir cuándo saldría una tarea silenciada al reactivarla. */
  partidos?: PartidoParaAlerta[];
  /** Se pinta la última copia: nada se edita hasta que conteste la hoja. */
  comprobando?: boolean;
}

export default function ListaAlertas({
  alertas,
  onEditar,
  onEnviarAhora,
  onAlternarActiva,
  onBorrar,
  ocupada,
  partidos = [],
  comprobando = false,
}: Props) {
  /* El reloj se apunta en un efecto: mirarlo en el render es impuro. */
  const [ahora, setAhora] = useState(0);
  /* La tarjeta que está pidiendo confirmación para borrarse. */
  const [borrando, setBorrando] = useState<string | null>(null);

  useEffect(() => {
    const id = setTimeout(() => setAhora(Date.now()), 0);

    return () => clearTimeout(id);
  }, []);

  if (!alertas.length) {
    return (
      <div className="rounded-3xl border border-dashed border-white/10 px-6 py-10 text-center">
        <AlarmClock className="mx-auto h-7 w-7 text-white/20" aria-hidden />

        <p className="mt-3 text-sm text-white/50">
          Crea la primera tarea con alerta y el correo saldrá solo el día que elijas.
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

  /* Las silenciadas, por cuándo saldrían al reactivarlas: la próxima primero y
     las que no tienen fecha al final. */
  const cuandoSaldria = (a: Alerta): number => {
    if (ahora === 0) return Infinity;

    const s = saldriaSiSeReactiva(a, partidos, new Date(ahora));

    if (s) return s.cuando.getTime();

    const t = fechaValida(a.proximoEnvio) ? new Date(a.proximoEnvio).getTime() : NaN;

    return Number.isFinite(t) && t > ahora ? t : Infinity;
  };

  const silenciadas = ordenadas
    .filter((a) => !a.activa)
    .sort((a, b) => cuandoSaldria(a) - cuandoSaldria(b));

  const pinta = (alerta: Alerta) => {
        const bloqueada = comprobando || ocupada === alerta.id;

        /* Se pintaba en minúsculas tal cual se apuntó, y el cuerpo repetía el
           título cuando sólo se había escrito uno. */
        const frase = tituloLegible;
        const titulo = frase(alerta.titulo.trim());
        const mensaje = alerta.mensaje?.trim() ?? "";
        const repiteTitulo =
          mensaje.toLowerCase() === alerta.titulo.trim().toLowerCase();

        return (
          <article
            key={alerta.id}
            className={`rounded-3xl border border-white/10 bg-white/[0.03] p-4 transition ${
              alerta.activa ? "" : "opacity-75"
            }`}
          >
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0 flex-1">
                <h3 className="truncate text-sm font-semibold text-white">
                  {titulo}
                </h3>

                {mensaje && !repiteTitulo && (
                  <p className="mt-1 line-clamp-2 text-xs leading-relaxed text-white/50">
                    {frase(mensaje)}
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

            <div className="mt-3 flex flex-wrap items-center gap-x-3 gap-y-1.5 text-xs text-white/50">
              <span className="inline-flex items-center gap-1.5">
                <AlarmClock className="h-3 w-3" aria-hidden />
                {!alerta.activa
                  ? (() => {
                      /* «Sonaría» solo con fecha futura: una pasada es un resto
                         de cuando estaba viva, no un dato. */
                      const futura =
                        fechaValida(alerta.proximoEnvio) &&
                        ahora > 0 &&
                        new Date(alerta.proximoEnvio).getTime() > ahora;

                      const saldria =
                        ahora > 0
                          ? saldriaSiSeReactiva(alerta, partidos, new Date(ahora))
                          : null;

                      /* La fecha, en negrita y una sola vez: el «N días antes del
                         partido» ya lo dice la etiqueta de repetición. */
                      if (saldria)
                        return (
                          <>
                            Saldría el{" "}
                            <b className="font-semibold text-white/80">
                              {fechaLegible(saldria.cuando.toISOString())}
                            </b>
                          </>
                        );

                      if (futura)
                        return (
                          <>
                            Saldría el{" "}
                            <b className="font-semibold text-white/80">
                              {fechaLegible(alerta.proximoEnvio)}
                            </b>
                          </>
                        );

                      if (alerta.envios > 0 && fechaValida(alerta.ultimoEnvio))
                        return `Silenciada · última vez enviada: ${fechaLegible(alerta.ultimoEnvio)}`;

                      return alerta.repeticion === "partido"
                        ? "Silenciada: reactívala para fijar el próximo aviso"
                        : "Silenciada: no se enviará hasta reactivarla";
                    })()
                  : fechaValida(alerta.proximoEnvio)
                    ? ahora > 0 && new Date(alerta.proximoEnvio).getTime() < ahora
                      ? <b className="font-semibold text-red-300">Debería haber salido: {fechaLegible(alerta.proximoEnvio)}</b>
                      : <b className="font-semibold text-white/80">{fechaLegible(alerta.proximoEnvio)}</b>
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

              <span className="inline-flex min-w-0 items-center gap-1.5" title={alerta.destinatarios.join(", ")}>
                <Users className="h-3 w-3 shrink-0" aria-hidden />
                <span className="truncate">{nombresDestino(alerta.destinatarios)}</span>
              </span>

              {alerta.adjuntos.length > 0 && (
                <span
                  className="inline-flex items-center gap-1.5"
                  title={`${alerta.adjuntos.length} ${alerta.adjuntos.length === 1 ? "adjunto" : "adjuntos"}`}
                >
                  <Paperclip className="h-3 w-3" aria-hidden />
                  {alerta.adjuntos.length}{" "}
                  {alerta.adjuntos.length === 1 ? "adjunto" : "adjuntos"}
                </span>
              )}

              {alerta.envios > 0 && (alerta.activa || !fechaValida(alerta.ultimoEnvio)) && (
                <span title={`Último: ${fechaLegible(alerta.ultimoEnvio)}`}>
                  {alerta.envios === 1
                    ? "Enviada 1 vez"
                    : `Enviada ${alerta.envios} veces`}
                  {fechaValida(alerta.ultimoEnvio) &&
                    ` · la última, ${fechaLegible(alerta.ultimoEnvio)}`}
                </span>
              )}
            </div>

            {/* ------------------ ACCIONES ----------------- */}

            {borrando === alerta.id ? (
              <div className="mt-3 flex flex-wrap items-center gap-2 border-t border-red-400/20 pt-3">
                <p className="min-w-0 flex-1 basis-full text-xs leading-relaxed text-red-300 sm:basis-0">
                  ¿Borrar «{titulo}»? Dejará de avisar y desaparece de la hoja.
                </p>

                <button
                  type="button"
                  onClick={() => {
                    setBorrando(null);
                    onBorrar(alerta);
                  }}
                  disabled={bloqueada}
                  className="inline-flex items-center gap-1.5 rounded-full bg-red-500/20 px-3 py-1.5 text-xs font-medium text-red-300 transition hover:bg-red-500/30 disabled:opacity-40"
                >
                  <Trash2 className="h-3.5 w-3.5" aria-hidden />
                  Sí, borrar
                </button>

                <button
                  type="button"
                  onClick={() => setBorrando(null)}
                  className="rounded-full px-3 py-1.5 text-xs text-white/60 transition hover:bg-white/[0.06] hover:text-white"
                >
                  Cancelar
                </button>
              </div>
            ) : (
            <div className="mt-3 flex flex-nowrap items-center gap-1 border-t border-white/[0.06] pt-3">
              <button
                type="button"
                onClick={() => onEditar(alerta)}
                disabled={bloqueada}
                className="inline-flex items-center gap-1.5 rounded-full px-2 py-1.5 text-xs text-white/60 transition hover:bg-white/[0.06] hover:text-white disabled:opacity-40 sm:px-3"
              >
                <Pencil className="h-3.5 w-3.5" aria-hidden />
                Editar
              </button>

              {/* 29/10/2026: «Reactivar» ya está en la campana de la tarjeta y en «Reactivar todas»; aquí no se repite. */}
              <button
                type="button"
                onClick={() => onEnviarAhora(alerta)}
                disabled={bloqueada}
                className="inline-flex items-center gap-1.5 rounded-full px-2 py-1.5 text-xs text-white/60 transition hover:bg-white/[0.06] hover:text-white disabled:opacity-40 sm:px-3"
              >
                <Send className="h-3.5 w-3.5" aria-hidden />
                Enviar ahora
              </button>

              <button
                type="button"
                onClick={() => setBorrando(alerta.id)}
                disabled={bloqueada}
                aria-label="Borrar"
                title="Borrar"
                className="ml-auto inline-flex items-center gap-1.5 rounded-full px-2 py-1.5 text-xs text-red-300/80 sm:px-3 transition hover:bg-red-500/10 hover:text-red-300 disabled:opacity-40"
              >
                <Trash2 className="h-3.5 w-3.5" aria-hidden />
                <span className="hidden sm:inline">Borrar</span>
              </button>
            </div>
            )}
          </article>
        );
  };

  return (
    <div className="space-y-2.5 @3xl:grid @3xl:grid-cols-2 @3xl:items-start @3xl:gap-2.5 @3xl:space-y-0">
      {vivas.map((alerta) => pinta(alerta))}

      {/* Las silenciadas no suenan: se apartan para que la lista diga lo que
          sí va a salir. */}
      {silenciadas.length > 0 && (
        <details className="group pt-1 @3xl:col-span-2" open={vivas.length === 0}>
          <summary className="cursor-pointer select-none rounded-xl px-2 py-2 text-xs text-white/50 transition hover:text-white">
            Silenciadas ({silenciadas.length})
          </summary>

          <div className="mt-2 space-y-2.5 @3xl:grid @3xl:grid-cols-2 @3xl:items-start @3xl:gap-2.5 @3xl:space-y-0">
            {silenciadas.map((alerta) => pinta(alerta))}
          </div>
        </details>
      )}
    </div>
  );
}
