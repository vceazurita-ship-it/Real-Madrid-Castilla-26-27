"use client";

/**
 * EL PARTIDO DE LA SEMANA, ARRIBA DEL TODO (21/10/2026).
 *
 * Un microciclo de balón parado se planifica PARA un partido, y la pantalla lo
 * decía en una línea gris de 11 px debajo de los botones. Esta tarjeta contesta
 * lo primero que se mira al abrirla: contra quién, cuándo, dónde, cuánto falta
 * —o cómo acabó—, cómo va la semana contra su objetivo de minutos, y lleva de un
 * toque a lo que se usa con ella: la pizarra de ABP de ese partido, el ABP del
 * rival y el plan de partido.
 */

import Link from "next/link";
import { ArrowRight, CalendarClock, ClipboardList, Flag, LayoutTemplate, Play, Sparkles, Swords } from "lucide-react";

import { EscudoEquipo } from "@/components/rivals/EscudoEquipo";
import { fmtMin } from "@/lib/abp/microciclo";
import type { PartidoNuestro } from "@/lib/castilla/calendario";
import { esSinPartido } from "@/lib/abp/ventana";

const FECHA = new Intl.DateTimeFormat("es-ES", {
  weekday: "long",
  day: "numeric",
  month: "long",
  timeZone: "UTC",
});

/** «domingo 25 de octubre · 16:30». La hora de BeSoccer ya es la de Madrid. */
function cuandoSeJuega(cuando: string) {
  const dia = cuando.slice(0, 10);
  const hora = cuando.slice(11, 16);

  const fecha = new Date(`${dia}T12:00:00Z`);

  if (Number.isNaN(fecha.getTime())) return cuando;

  return `${FECHA.format(fecha)}${hora && hora !== "00:00" ? ` · ${hora}` : ""}`;
}

/** Días enteros de `desde` a `hasta`, los dos «AAAA-MM-DD». */
function diasEntre(desde: string, hasta: string) {
  const a = Date.parse(`${desde}T12:00:00Z`);
  const b = Date.parse(`${hasta}T12:00:00Z`);

  if (Number.isNaN(a) || Number.isNaN(b)) return null;

  return Math.round((b - a) / 86_400_000);
}

const enlaceClase =
  "inline-flex min-w-0 items-center gap-1.5 rounded-xl border border-white/12 px-3 py-1.5 text-xs font-medium text-white/70 transition hover:border-white/25 hover:text-white";

export function PartidoDeLaSemana({
  partido,
  anterior,
  rival,
  escudo,
  hoy,
  minutos,
  objetivo,
  porLado,
  enlaces,
  onVerPost,
  onProponer,
  pieza,
}: {
  partido: PartidoNuestro | null;
  anterior: { rival: string; cuando: string } | null;
  /** El rival escrito en el plan, para cuando el calendario no lo tiene. */
  rival: string;
  escudo: string | null | undefined;
  /** «AAAA-MM-DD» de hoy, o vacío mientras no se sabe. */
  hoy: string;
  minutos: number;
  objetivo: { minimo: number; maximo: number };
  porLado: { ofensivo: number; defensivo: number };
  enlaces: { pizarra: string; abpRival: string; plan: string | null };
  /** Abre el informe del partido ya jugado. */
  onVerPost?: () => void;
  /** Con la semana vacía, la acción principal: proponer el boceto. */
  onProponer?: () => void;
  /** Nuestro vídeo de ABP para los jugadores de esta jornada, si ya está subido. */
  pieza?: { url: string; segundos: number } | null;
}) {
  /* «NO COMPETICIÓN» es como la hoja llama a una semana sin partido: no es
     un rival y no lleva escudo ni ABP del rival. */
  const nombre = partido?.rival || (esSinPartido(rival) ? "" : rival);

  const faltan = partido && hoy ? diasEntre(hoy, partido.cuando.slice(0, 10)) : null;

  const resultado =
    partido?.jugado && partido.golesFavor != null && partido.golesContra != null
      ? {
          texto: `${partido.golesFavor}-${partido.golesContra}`,
          tono:
            partido.golesFavor > partido.golesContra
              ? "ganado"
              : partido.golesFavor < partido.golesContra
                ? "perdido"
                : "empate",
        }
      : null;

  const chip = resultado
    ? {
        texto:
          resultado.tono === "ganado"
            ? `Ganado ${resultado.texto}`
            : resultado.tono === "perdido"
              ? `Perdido ${resultado.texto}`
              : `Empate ${resultado.texto}`,
        clase:
          resultado.tono === "ganado"
            ? "border-emerald-400/30 bg-emerald-400/10 text-emerald-300"
            : resultado.tono === "perdido"
              ? "border-rose-400/30 bg-rose-400/10 text-rose-300"
              : "border-white/15 bg-white/[0.05] text-white/70",
      }
    : faltan != null && faltan >= 0
      ? {
          texto: faltan === 0 ? "Hoy" : faltan === 1 ? "Mañana" : `Faltan ${faltan} días`,
          clase: "border-[#C8A96B]/40 bg-[#C8A96B]/10 text-[#C8A96B]",
        }
      : null;

  /* La barra del objetivo: hasta el máximo, con el mínimo marcado. */
  const tope = Math.max(objetivo.maximo, minutos, 1);
  const lleno = Math.min(100, (minutos / tope) * 100);
  const marcaMinimo = (objetivo.minimo / tope) * 100;

  /* Con la semana vacía no se pinta «0′», la barra ni su marca —se leía como
     una raya suelta—: una línea con el objetivo y el botón del boceto. */
  const vacia = minutos === 0;

  const estadoMinutos =
    vacia
      ? null
      : minutos < objetivo.minimo
        ? { texto: `faltan ${objetivo.minimo - minutos}′`, clase: "text-amber-300" }
        : minutos > objetivo.maximo
          ? { texto: `${minutos - objetivo.maximo}′ de más (${minutos}′ − ${objetivo.maximo}′ máximo)`, clase: "text-amber-300" }
          : { texto: "dentro del objetivo", clase: "text-emerald-300" };

  const ladoTotal = porLado.ofensivo + porLado.defensivo;
  const pctOf = ladoTotal ? Math.round((porLado.ofensivo / ladoTotal) * 100) : 0;

  return (
    <section
      aria-label="El partido de la semana"
      className="mt-5 grid min-w-0 gap-4 rounded-2xl border border-white/10 bg-white/[0.03] p-4 sm:p-5 lg:grid-cols-[minmax(0,1.15fr)_minmax(0,1fr)_auto] lg:items-center"
    >
      {/* ------------------------- EL PARTIDO ------------------------- */}

      <div className="flex min-w-0 items-center gap-3.5">
        {nombre ? (
          <EscudoEquipo nombre={nombre} escudo={escudo ?? undefined} lado={48} />
        ) : (
          <span className="grid h-12 w-12 shrink-0 place-items-center rounded-full border border-white/10 text-white/35">
            <Swords size={20} aria-hidden />
          </span>
        )}

        <div className="min-w-0">
          <p className="text-[10px] uppercase tracking-[0.18em] text-white/40">
            {partido ? `Jornada ${partido.jornada} · ${partido.lado === "casa" ? "en casa" : "fuera"}` : "Rival de la semana"}
          </p>

          <p className="truncate text-lg font-semibold leading-tight text-white sm:text-xl">
            {nombre || (esSinPartido(rival) ? "Semana sin competición" : "Escribe el rival de la semana")}
          </p>

          {partido && (
            <p className="mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-1 text-[12px] text-white/55">
              <span className="inline-flex items-center gap-1">
                <CalendarClock size={12} aria-hidden />
                {cuandoSeJuega(partido.cuando)}
              </span>

              {chip && (
                <span className={`rounded-full border px-2 py-0.5 text-[10.5px] font-semibold ${chip.clase}`}>
                  {chip.texto}
                </span>
              )}
            </p>
          )}

          {anterior && (
            <p className="mt-1 inline-flex items-center gap-1 text-[11px] text-white/40">
              <Flag size={10} aria-hidden />
              Viene de {anterior.rival} · {anterior.cuando}
            </p>
          )}
        </div>
      </div>

      {/* ------------------------- LA SEMANA ------------------------- */}

      {vacia ? (
        <div className="min-w-0">
          <p className="text-[10px] uppercase tracking-[0.18em] text-white/40">Balón parado de la semana</p>

          <p className="mt-1 text-sm text-white/75">
            Objetivo: <span className="font-semibold tabular-nums text-white">{objetivo.minimo}-{objetivo.maximo}′</span>
          </p>

          {onProponer && (
            <button
              type="button"
              onClick={onProponer}
              className="mt-2.5 inline-flex items-center gap-1.5 rounded-xl bg-[#C8A96B] px-3.5 py-2 text-[13px] font-semibold text-black transition hover:brightness-110"
            >
              <Sparkles size={14} aria-hidden />
              Proponer boceto
            </button>
          )}
        </div>
      ) : (
      <div className="min-w-0">
        <p className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-0.5">
          <span className="text-[10px] uppercase tracking-[0.18em] text-white/40">Balón parado de la semana</span>

          {estadoMinutos && (
            <span className={`text-[11px] font-medium ${estadoMinutos.clase}`}>{estadoMinutos.texto}</span>
          )}
        </p>

        <p className="mt-1 text-sm text-white/80">
          <span className="text-xl font-semibold tabular-nums text-white">{minutos}′</span>
          <span className="text-white/45">
            {" "}
            · objetivo {objetivo.minimo}-{objetivo.maximo}′
          </span>
        </p>

        <div
          className="relative mt-2 h-2 rounded-full bg-white/[0.07]"
          role="meter"
          aria-label="Minutos de balón parado frente al objetivo"
          aria-valuemin={0}
          aria-valuemax={objetivo.maximo}
          aria-valuenow={minutos}
        >
          <div
            className="h-full rounded-full"
            style={{ width: `${lleno}%`, backgroundColor: "var(--rmcf-gold-ink)" }}
          />

          <span
            aria-hidden
            className="absolute -top-0.5 h-3 w-px bg-white/50"
            style={{ left: `${marcaMinimo}%` }}
          />
        </div>

        {ladoTotal > 0 && (
          <p className="mt-2 text-[11px] tabular-nums text-white/50">
            Atacando {fmtMin(Math.round(porLado.ofensivo))} ({pctOf} %) · defendiendo{" "}
            {fmtMin(Math.round(porLado.defensivo))} ({100 - pctOf} %)
          </p>
        )}
      </div>
      )}

      {/* ------------------------- A UN TOQUE ------------------------- */}

      <nav aria-label="Lo que va con este partido" className="flex min-w-0 flex-wrap gap-2 lg:max-w-[260px] lg:justify-end">
        <Link href={enlaces.pizarra} className={enlaceClase}>
          <LayoutTemplate size={13} aria-hidden />
          Pizarra ABP
        </Link>

        {nombre && (
          <Link href={enlaces.abpRival} className={enlaceClase}>
            <Swords size={13} aria-hidden />
            ABP del rival
          </Link>
        )}

        {enlaces.plan && (
          <Link href={enlaces.plan} className={enlaceClase}>
            <ClipboardList size={13} aria-hidden />
            Plan de partido
          </Link>
        )}

        {onVerPost && (
          <button type="button" onClick={onVerPost} className={enlaceClase}>
            <ArrowRight size={13} aria-hidden />
            Informe post
          </button>
        )}

        {/* La pieza de la semana para los jugadores: sólo si ya está subida. */}
        {pieza && (
          <a href={pieza.url} target="_blank" rel="noreferrer" className={enlaceClase}>
            <Play size={13} aria-hidden />
            Vídeo de ABP
            {pieza.segundos > 0 && (
              <span className="tabular-nums text-white/45">
                {Math.floor(pieza.segundos / 60)}:{String(Math.round(pieza.segundos % 60)).padStart(2, "0")}
              </span>
            )}
          </a>
        )}
      </nav>
    </section>
  );
}
