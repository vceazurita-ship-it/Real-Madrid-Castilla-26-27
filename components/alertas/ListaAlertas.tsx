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
  type ContactoAgenda,
  type PartidoParaAlerta,
} from "@/lib/alertas/modelo";
import { STAFF } from "@/lib/quiniela/staff";
import { comoNuestro, type PartidoCastilla } from "@/lib/castilla/calendario";

/*
| Para qué partido sale el aviso (30/10/2026): «vie 6 nov» a secas no decía
| de qué partido era. Los partidos son los del calendario de BeSoccer, que
| traen local y visitante; se busca el que cae `dias` después del aviso.
*/
function partidoDelAviso(partidos: PartidoParaAlerta[], aviso: Date, dias: number) {
  const dia = new Date(aviso.getTime());

  dia.setDate(dia.getDate() + dias);

  const clave = `${dia.getFullYear()}-${String(dia.getMonth() + 1).padStart(2, "0")}-${String(dia.getDate()).padStart(2, "0")}`;
  const partido = partidos.find((p) => String(p.cuando).slice(0, 10) === clave) as (PartidoParaAlerta & Partial<PartidoCastilla>) | undefined;

  if (!partido || !partido.local || !partido.visitante) return "";

  const fecha = new Date(partido.cuando);
  const cuando = Number.isNaN(fecha.getTime())
    ? ""
    : fecha.toLocaleDateString("es-ES", { weekday: "short", day: "numeric", month: "short" }).replace(/\./g, "").replace(",", "");

  return `vs ${comoNuestro(partido as PartidoCastilla).rival}${cuando ? ` (${cuando})` : ""}`;
}

/*
| La regla y el partido en una sola frase (30/10/2026): «2 días antes del
| partido vs Hércules (dom 8 nov)». Antes eran dos piezas —«Sale 2 días antes
| del partido» por un lado y «· vs Hércules, dom, 8 nov» pegado a la fecha—
| que a 390 px se partían en columnas cortadas a media palabra.
*/
function reglaDelPartido(alerta: Alerta, para: string) {
  const dias = Math.max(0, Math.round(alerta.diasAntesDelPartido ?? 2));
  const regla =
    dias === 0 ? "El día del partido" : dias === 1 ? "El día antes del partido" : `${dias} días antes del partido`;

  return para ? `${regla} ${para}` : regla;
}

/** «vie 6 nov · 09:00», sin comas ni puntos de abreviatura. */
function fechaDeSalida(iso: string | null) {
  return iso ? fechaLegible(iso).replace(/,/g, "") : "";
}

/** ¿Lleva una fecha de verdad? Vacía o ilegible, la alerta no suena. */
function fechaValida(iso: string | null | undefined) {
  return Boolean(iso) && !Number.isNaN(new Date(String(iso)).getTime());
}

/** Minúsculas, sin tildes y sólo letras: «López de Lerma» -> «lopezdelerma». */
function plano(texto: string) {
  return texto
    /* NFD separa la tilde de la letra y el filtro de abajo la quita. */
    .normalize("NFD")
    .toLowerCase()
    .replace(/[^a-z]/g, "");
}

/*
| El nombre del cuerpo técnico que corresponde a un usuario de correo
| (29/10/2026, análisis): «jlopezdelerma» es Julián López de Lerma y
| «mbarrio.trainer», Miguel Barrio. Se acepta si el usuario empieza por el
| nombre o por su inicial y lleva el primer apellido.
*/
function nombreDelStaff(usuario: string) {
  const alias = plano(usuario);

  if (alias.length < 4) return null;

  for (const persona of STAFF) {
    const partes = persona.nombre
      .split(/\s+/)
      .map(plano)
      .filter((p) => p && !["de", "del", "la", "las", "los"].includes(p));
    const [nombre, apellido] = partes;

    if (!nombre || !apellido) continue;

    if ((alias.startsWith(nombre) || alias.startsWith(nombre[0] + apellido)) && alias.includes(apellido))
      return persona.nombre;
  }

  return null;
}

/** Quién recibe el correo, por nombre: «ana, luis y 2 más». */
export function nombresDestino(destinatarios: string[], agenda: ContactoAgenda[] = [], completo = false) {
  /* Lo que no se reconoce se lee «V. Ceazurita»: palabras con mayúscula, la
     inicial suelta con punto y sin los números del usuario. La expresión
     había perdido su barra invertida y no partía las palabras (29/10/2026). */
  const legible = (usuario: string) =>
    usuario
      .replace(/[._\-\d]+/g, " ")
      .trim()
      .split(/\s+/)
      .filter(Boolean)
      .map((p) => (p.length === 1 ? `${p.toUpperCase()}.` : p.charAt(0).toUpperCase() + p.slice(1)))
      .join(" ");

  const porCorreo = new Map(
    agenda
      .filter((c) => c.nombre?.trim())
      .map((c) => [c.email.trim().toLowerCase(), c.nombre.trim()] as const),
  );

  const nombres = destinatarios
    .map((d) => {
      const usuario = d.split("@")[0];

      return porCorreo.get(d.trim().toLowerCase()) ?? nombreDelStaff(usuario) ?? legible(usuario);
    })
    .filter(Boolean);

  if (nombres.length === 0) return "Sin destinatarios";
  if (nombres.length === 1) return nombres[0];
  if (nombres.length === 2) return `${nombres[0]} y ${nombres[1]}`;

  /* Completo: todos por nombre, «Ana, Luis y Marta» (30/10/2026). */
  if (completo) return `${nombres.slice(0, -1).join(", ")} y ${nombres[nombres.length - 1]}`;

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
  /** La agenda de la hoja: da el nombre de cada correo cuando lo tiene. */
  agenda?: ContactoAgenda[];
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
  agenda = [],
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

  const todasSilenciadas = ordenadas
    .filter((a) => !a.activa)
    .sort((a, b) => cuandoSaldria(a) - cuandoSaldria(b));

  /* Caducadas (29/10/2026, análisis): silenciadas que ya no saldrían aunque se
     reactivaran —«Avisar a Mikel», enviada por última vez en agosto—. Van
     aparte y plegadas para que no se mezclen con las que sí volverían. */
  const caducada = (a: Alerta) => ahora > 0 && cuandoSaldria(a) === Infinity;
  const silenciadas = todasSilenciadas.filter((a) => !caducada(a));
  const caducadas = todasSilenciadas.filter(caducada);

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
            /* Columna flexible y las acciones al pie: todas las tarjetas de una
               fila miden lo mismo, con descripción o sin ella (30/10/2026). */
            className={`flex h-full flex-col rounded-3xl border border-white/10 bg-white/[0.03] p-4 transition ${
              alerta.activa ? "" : "opacity-75"
            }`}
          >
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0 flex-1">
                <h3 className="text-[15px] font-semibold leading-snug text-white">
                  {titulo}
                </h3>

                {mensaje && !repiteTitulo && (
                  <p className="mt-1 line-clamp-2 text-[13px] leading-relaxed text-white/60">
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

            {/*
              30/10/2026: la fecha de salida, en negrita y en su propia línea,
              es el dato principal; debajo, en una frase que fluye, la regla y el
              partido («2 días antes del partido vs Hércules (dom 8 nov)»).
              Antes eran piezas `inline-flex` sueltas que en el móvil se partían
              en tres columnas cortadas. Letra a 13 px.
            */}
            {(() => {
              const diasPartido = Math.max(0, Math.round(alerta.diasAntesDelPartido ?? 2));
              let principal: React.ReactNode;
              let regla: string | null =
                alerta.repeticion === "una-vez" ? null : describeRepeticion(alerta);

              if (!alerta.activa) {
                /* «Saldría» solo con fecha futura: una pasada es un resto de
                   cuando estaba viva, no un dato. */
                const futura =
                  fechaValida(alerta.proximoEnvio) &&
                  ahora > 0 &&
                  new Date(alerta.proximoEnvio).getTime() > ahora;

                const saldria =
                  ahora > 0 ? saldriaSiSeReactiva(alerta, partidos, new Date(ahora)) : null;

                if (saldria) {
                  principal = (
                    <>
                      Saldría el{" "}
                      <b className="font-semibold text-white/90">{fechaDeSalida(saldria.cuando.toISOString())}</b>
                    </>
                  );

                  if (alerta.repeticion === "partido")
                    regla = reglaDelPartido(alerta, partidoDelAviso(partidos, saldria.cuando, saldria.dias));
                } else if (futura) {
                  principal = (
                    <>
                      Saldría el{" "}
                      <b className="font-semibold text-white/90">{fechaDeSalida(alerta.proximoEnvio)}</b>
                    </>
                  );
                } else if (alerta.envios > 0 && fechaValida(alerta.ultimoEnvio)) {
                  principal = `Silenciada · enviada por última vez el ${fechaDeSalida(alerta.ultimoEnvio)}`;
                } else {
                  principal =
                    alerta.repeticion === "partido"
                      ? "Silenciada: reactívala para fijar el próximo aviso"
                      : "Silenciada: no se enviará hasta reactivarla";
                }
              } else if (fechaValida(alerta.proximoEnvio)) {
                if (ahora > 0 && new Date(alerta.proximoEnvio).getTime() < ahora) {
                  principal = (
                    <b className="font-semibold text-red-300">
                      Debería haber salido el {fechaDeSalida(alerta.proximoEnvio)}
                    </b>
                  );
                } else {
                  principal = (
                    <>
                      Sale el{" "}
                      <b className="font-semibold text-white/90">{fechaDeSalida(alerta.proximoEnvio)}</b>
                    </>
                  );

                  if (alerta.repeticion === "partido")
                    regla = reglaDelPartido(
                      alerta,
                      partidoDelAviso(partidos, new Date(alerta.proximoEnvio), diasPartido),
                    );
                }
              } else {
                /* Una activa sin fecha no suena, y eso hay que decirlo. La que
                   va atada al partido la recibe sola al abrir esta pantalla
                   cuando el calendario tenga partido por delante (19/10/2026). */
                principal =
                  alerta.repeticion === "partido"
                    ? "Sin fecha: espera a que haya próximo partido en el calendario"
                    : "Sin fecha: no sonará hasta que la edites";
              }

              const todos = nombresDestino(alerta.destinatarios, agenda, true);

              return (
                <div className="mb-3 mt-3 space-y-1.5 text-[13px] leading-relaxed text-white/60">
                  <p>
                    <AlarmClock className="mr-1.5 inline-block h-3.5 w-3.5 -translate-y-px" aria-hidden />
                    {principal}
                  </p>

                  {regla && (
                    <p>
                      <Repeat className="mr-1.5 inline-block h-3.5 w-3.5 -translate-y-px" aria-hidden />
                      {regla}
                    </p>
                  )}

                  {/* Los destinatarios, todos y por nombre: «Víctor Cea y 1 más» no decía quién (30/10/2026). */}
                  <p title={alerta.destinatarios.join(", ")}>
                    <Users className="mr-1.5 inline-block h-3.5 w-3.5 -translate-y-px" aria-hidden />
                    {todos}
                  </p>

                  {(normalizaAvisos(alerta.avisos).length > 0 ||
                    alerta.adjuntos.length > 0 ||
                    (alerta.envios > 0 && (alerta.activa || !fechaValida(alerta.ultimoEnvio)))) && (
                    <p className="flex flex-wrap gap-x-3 gap-y-1">
                      {normalizaAvisos(alerta.avisos).length > 0 && (
                        <span title="Campanadas de la cita que va adjunta al correo">
                          <BellRing className="mr-1.5 inline-block h-3.5 w-3.5 -translate-y-px" aria-hidden />
                          {describeAvisos(alerta)}
                        </span>
                      )}

                      {alerta.adjuntos.length > 0 && (
                        <span>
                          <Paperclip className="mr-1.5 inline-block h-3.5 w-3.5 -translate-y-px" aria-hidden />
                          {alerta.adjuntos.length} {alerta.adjuntos.length === 1 ? "adjunto" : "adjuntos"}
                        </span>
                      )}

                      {alerta.envios > 0 && (alerta.activa || !fechaValida(alerta.ultimoEnvio)) && (
                        <span>
                          {alerta.envios === 1 ? "Enviada 1 vez" : `Enviada ${alerta.envios} veces`}
                          {fechaValida(alerta.ultimoEnvio) && ` · la última, ${fechaDeSalida(alerta.ultimoEnvio)}`}
                        </span>
                      )}
                    </p>
                  )}
                </div>
              );
            })()}

            {/* ------------------ ACCIONES ----------------- */}

            {borrando === alerta.id ? (
              <div className="mt-auto flex flex-wrap items-center gap-2 border-t border-red-400/20 pt-3">
                <p className="min-w-0 flex-1 basis-full text-[13px] leading-relaxed text-red-300">
                  ¿Borrar «{titulo}»? Dejará de avisar a {nombresDestino(alerta.destinatarios, agenda, true)} y desaparece de la hoja.
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
            <div className="mt-auto flex flex-nowrap items-center gap-1 border-t border-white/[0.06] pt-3">
              <button
                type="button"
                onClick={() => onEditar(alerta)}
                disabled={bloqueada}
                className="inline-flex items-center gap-1.5 rounded-full px-2 py-1.5 text-xs text-white/60 transition hover:bg-white/[0.06] hover:text-white disabled:opacity-40 sm:px-3"
              >
                <Pencil className="h-3.5 w-3.5" aria-hidden />
                Editar
              </button>

              {/* 30/10/2026: la silenciada lleva su «Reactivar» con texto; la campana sola no se entendía. */}
              {!alerta.activa && (
                <button
                  type="button"
                  onClick={() => onAlternarActiva(alerta)}
                  disabled={bloqueada}
                  className="inline-flex items-center gap-1.5 rounded-full px-2 py-1.5 text-xs font-semibold text-[#C8A96B] transition hover:bg-[#C8A96B]/10 disabled:opacity-40 sm:px-3"
                >
                  <BellRing className="h-3.5 w-3.5" aria-hidden />
                  Reactivar
                </button>
              )}

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
    <div className="space-y-2.5 @3xl:grid @3xl:grid-cols-2 @3xl:items-stretch @3xl:gap-2.5 @3xl:space-y-0 @5xl:grid-cols-3">
      {vivas.map((alerta) => pinta(alerta))}

      {/* Las silenciadas no suenan: se apartan para que la lista diga lo que
          sí va a salir. */}
      {silenciadas.length > 0 && (
        <details className="group pt-1 @3xl:col-span-2 @5xl:col-span-3" open={vivas.length === 0}>
          <summary className="cursor-pointer select-none rounded-xl px-2 py-2 text-[13px] text-white/60 transition hover:text-white">
            Silenciadas ({silenciadas.length})
          </summary>

          <div className="mt-2 space-y-2.5 @3xl:grid @3xl:grid-cols-2 @3xl:items-stretch @3xl:gap-2.5 @3xl:space-y-0 @5xl:grid-cols-3">
            {silenciadas.map((alerta) => pinta(alerta))}
          </div>
        </details>
      )}

      {caducadas.length > 0 && (
        <details className="group pt-1 @3xl:col-span-2 @5xl:col-span-3">
          {/* 30/10/2026: el porqué y cuáles, en el propio título plegado; sin
              abrirlo, «Caducadas (1)» parecía un error. */}
          <summary className="cursor-pointer select-none rounded-xl px-2 py-2 text-[13px] leading-relaxed text-white/60 transition hover:text-white">
            Caducadas ({caducadas.length}):{" "}
            {caducadas.map((a) => `«${tituloLegible(a.titulo.trim())}»`).join(", ")}
            {" · "}
            {caducadas.length === 1 ? "no volvería a salir aunque se reactive" : "no volverían a salir aunque se reactiven"}
            {(() => {
              const ultimas = caducadas
                .filter((a) => fechaValida(a.ultimoEnvio))
                .map((a) => fechaDeSalida(a.ultimoEnvio));

              return ultimas.length === caducadas.length && ultimas.length === 1 ? ` (el último aviso salió el ${ultimas[0]})` : "";
            })()}
          </summary>

          <div className="mt-2 space-y-2.5 @3xl:grid @3xl:grid-cols-2 @3xl:items-stretch @3xl:gap-2.5 @3xl:space-y-0 @5xl:grid-cols-3">
            {caducadas.map((alerta) => pinta(alerta))}
          </div>

          <p className="mt-2 px-2 text-[13px] text-white/60">
            No queda una fecha por delante en la que avisar: para volver a usarla, edítala y ponle una nueva.
          </p>
        </details>
      )}
    </div>
  );
}
