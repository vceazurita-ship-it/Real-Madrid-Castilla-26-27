"use client";

/**
 * EL PROGRESO DE UN ENCARGO DE AJUSTES (04/10/2026).
 *
 * Un porcentaje grande, una barra partida en sus etapas (cada una tan ancha
 * como lo que suele tardar) y la lista: lo hecho con lo que tardó, lo que está
 * haciendo con su cuenta («80/532 · Sant Andreu · …») y lo que queda con lo que
 * suele tardar. Las cuentas salen de `lib/progreso.ts`.
 *
 * Se mueve solo cada segundo aunque el vigía publique cada pocos: el reloj de
 * aquí es sólo para el «lleva / quedan» y la parte de la etapa que sale del
 * tiempo.
 */

import { useEffect, useMemo, useState } from "react";
import { AlertTriangle, Check, CheckCheck, Circle, Loader2, Minus, RotateCcw, X } from "lucide-react";

import type { Tarea } from "@/lib/mantenimiento";
import { completaPlan, duracion, ETAPAS, obligadas, vistaProgreso, type EtapaHecha, type ProgresoVivo } from "@/lib/progreso";

const ORO = "#C8A96B";
const VERDE = "#34D399";
const ROJO = "#F87171";

/* Lo que viene hecho de la pasada anterior: verde apagado. */
const PREVIA = "rgba(52,211,153,0.35)";

/** Un reloj que avanza cada segundo mientras el componente esté a la vista. */
function useReloj(activo: boolean) {
  const [ahora, setAhora] = useState(0);

  useEffect(() => {
    if (!activo) return;

    const tic = () => setAhora(Date.now());

    tic();

    const reloj = setInterval(tic, 1_000);

    return () => clearInterval(reloj);
  }, [activo]);

  return ahora;
}

const horaDe = (ms: number) => new Date(ms).toLocaleTimeString("es-ES", { hour: "2-digit", minute: "2-digit" });

export function ProgresoEncargo({
  tarea,
  vivo,
  empezadoEn,
  enCola,
}: {
  tarea: Tarea;
  /** Lo que publica el vigía; sin él se estima con el reloj. */
  vivo: ProgresoVivo | null | undefined;
  empezadoEn?: string;
  /** Pedido y aún sin empezar. */
  enCola?: boolean;
}) {
  const ahora = useReloj(true);

  if (!ahora) return null;

  if (enCola) {
    return (
      <div className="mt-3 rounded-xl border border-white/10 bg-white/[0.03] p-3" role="status">
        <div className="flex items-baseline justify-between gap-3">
          <span className="shrink-0 whitespace-nowrap text-[26px] font-semibold tabular-nums leading-none text-white/80">0 %</span>
          <span className="text-[11px] text-white/45">En cola: empieza en cuanto lo coja el ordenador del club</span>
        </div>
        <div className="mt-2.5 h-2 overflow-hidden rounded-full" style={{ background: "rgba(128,128,128,0.18)" }}>
          <div className="h-full w-1/4 animate-pulse rounded-full" style={{ background: `${ORO}40` }} />
        </div>
      </div>
    );
  }

  const v = vistaProgreso(tarea, vivo, empezadoEn, ahora);

  const actual = v.etapas.find((e) => e.estado === "ahora");

  const delPlan = v.etapas.filter((e) => e.estado !== "previa");

  const numero = delPlan.findIndex((e) => e.estado === "ahora") + 1;

  const previas = v.etapas.length - delPlan.length;

  return (
    <div className="mt-3 rounded-xl border border-white/10 bg-white/[0.03] p-3" role="status" aria-live="polite">
      {/* La cifra y el tiempo. */}
      <div className="flex flex-wrap items-end justify-between gap-x-4 gap-y-1">
        <div className="flex items-baseline gap-2">
          <span className="whitespace-nowrap text-[30px] font-semibold tabular-nums leading-none" style={{ color: ORO }}>
            {v.porcentaje} %
          </span>
          <span className="text-[11px] text-white/45">
            etapa {numero || delPlan.length} de {delPlan.length}
            {previas ? ` · ${previas} de la vez anterior` : ""}
          </span>
        </div>
        <div className="text-right text-[11px] leading-snug text-white/55">
          <p>
            Lleva <span className="tabular-nums text-white/80">{duracion(v.lleva)}</span> · quedan{" "}
            <span className="tabular-nums text-white/80">~{duracion(v.quedan)}</span>
          </p>
          <p className="text-white/35">
            acabaría hacia las {horaDe(ahora + v.quedan * 60_000)}
            {v.estimado ? " · estimado por el reloj" : ""}
          </p>
        </div>
      </div>

      {/* La barra, partida en etapas. */}
      <div className="mt-3 flex h-2.5 gap-[3px]" aria-hidden>
        {v.etapas.map((e) => {
          const relleno = e.estado === "ahora" ? parteDe(e, v) : e.estado === "pendiente" ? 0 : 100;

          return (
            <div
              key={e.nombre}
              className="relative h-full overflow-hidden rounded-full"
              style={{ flexGrow: Math.max(e.peso, 0.025), flexBasis: 0, background: "rgba(128,128,128,0.18)" }}
              title={e.nombre}
            >
              <div
                className={`h-full rounded-full transition-[width] duration-700 ${e.estado === "ahora" ? "progreso-rayas" : ""}`}
                style={{
                  width: `${relleno}%`,
                  background:
                    e.estado === "saltada" ? "rgba(128,128,128,0.4)" : e.estado === "ahora" ? ORO : e.estado === "previa" ? PREVIA : e.estado === "fallo" ? ROJO : VERDE,
                }}
              />
            </div>
          );
        })}
      </div>

      {/* Lo que está haciendo ahora, en grande. */}
      {actual && (
        <div className="mt-3 flex items-start gap-2 text-[12px]">
          <Loader2 size={13} className="mt-0.5 shrink-0 animate-spin" style={{ color: ORO }} aria-hidden />
          <div className="min-w-0">
            <p className="text-white/85">
              {actual.nombre}
              {actual.cuenta ? (
                <span className="ml-2 tabular-nums text-white/55">
                  {actual.cuenta[0]} de {actual.cuenta[1]}
                </span>
              ) : null}
            </p>
            {actual.detalle ? <p className="truncate text-[11px] text-white/40">{actual.detalle}</p> : null}
          </div>
        </div>
      )}

      {/* Todas las etapas: hecho, ahora, pendiente. */}
      <ol
        className="mt-3 grid gap-x-5 gap-y-1 border-t border-white/[0.06] pt-2.5 text-[11px]"
        style={{ gridTemplateColumns: "repeat(auto-fill, minmax(230px, 1fr))" }}
      >
        {v.etapas.map((e) => (
          <li key={e.nombre} className="flex min-w-0 items-center gap-1.5">
            {e.estado === "hecha" ? (
              <Check size={12} className="shrink-0 text-emerald-300" aria-label="hecho" />
            ) : e.estado === "ahora" ? (
              <Loader2 size={12} className="shrink-0 animate-spin" style={{ color: ORO }} aria-label="en marcha" />
            ) : e.estado === "previa" ? (
              <CheckCheck size={12} className="shrink-0 text-emerald-300" aria-label="de la vez anterior" />
            ) : e.estado === "fallo" ? (
              <X size={12} className="shrink-0 text-red-300" aria-label="ha fallado" />
            ) : e.estado === "saltada" ? (
              <Minus size={12} className="shrink-0 text-white/30" aria-label="no hacía falta" />
            ) : (
              <Circle size={10} className="mx-[1px] shrink-0 text-white/25" aria-label="pendiente" />
            )}
            <span className={`truncate ${e.estado === "pendiente" ? "text-white/40" : e.estado === "ahora" ? "text-white/85" : "text-white/60"}`}>{e.nombre}</span>
            <span className="ml-auto shrink-0 pl-2 tabular-nums text-white/30">
              {e.estado === "hecha" && e.tardo !== undefined
                ? duracion(e.tardo, true)
                : e.estado === "pendiente"
                  ? `~${duracion(e.minutos, true)}`
                  : e.estado === "saltada"
                    ? "no hacía falta"
                    : e.estado === "previa"
                      ? "de la vez anterior"
                      : e.estado === "fallo"
                        ? "ha fallado"
                        : ""}
            </span>
          </li>
        ))}
      </ol>
    </div>
  );
}

/** La parte rellena de la etapa en marcha, en %. */
function parteDe(e: ReturnType<typeof vistaProgreso>["etapas"][number], v: ReturnType<typeof vistaProgreso>) {
  if (e.cuenta && e.cuenta[1] > 0) return Math.max(4, (e.cuenta[0] / e.cuenta[1]) * 100);

  /* Sin cuenta: lo que sale del porcentaje total menos las etapas enteras. */
  const antes = v.etapas.filter((x) => x.estado === "hecha" || x.estado === "saltada" || x.estado === "fallo").reduce((s, x) => s + x.peso, 0);

  const dentro = (v.porcentaje / 100 - antes) / (e.peso || 1);

  return Math.max(4, Math.min(100, dentro * 100));
}

/**
 * Cómo fue la última pasada: la barra entera y, si algo falló, en qué etapa.
 * Va bajo «Última vez».
 */
export function RecorridoEncargo({ recorrido }: { recorrido: EtapaHecha[] }) {
  if (!recorrido.length) return null;

  const total = recorrido.reduce((s, r) => s + (r.minutos ?? 0), 0);

  const fallo = recorrido.find((r) => r.estado === "fallo");

  return (
    <div className="mt-1.5 pl-[18px]">
      <div className="flex h-1.5 gap-[2px]" aria-hidden>
        {recorrido.map((r) => (
          <div
            key={r.nombre}
            className="h-full rounded-full"
            title={`${r.nombre}${r.minutos !== undefined ? ` · ${duracion(r.minutos)}` : ""}`}
            style={{
              flexGrow: Math.max((r.minutos ?? 0) / (total || 1), 0.04),
              flexBasis: 0,
              background: r.estado === "hecha" ? VERDE : r.estado === "fallo" ? ROJO : r.estado === "previa" ? PREVIA : "rgba(128,128,128,0.3)",
            }}
          />
        ))}
      </div>
      <p className="mt-1 text-[10px] text-white/35">
        {fallo ? (
          <span className="inline-flex items-center gap-1 text-amber-200">
            <AlertTriangle size={10} aria-hidden /> Falló en «{recorrido.filter((r) => r.estado === "fallo").map((r) => r.nombre).join("», «")}»
          </span>
        ) : (
          <>
            {recorrido.filter((r) => r.estado === "hecha").length} de {recorrido.length} etapas · {duracion(total)} en total
          </>
        )}
      </p>
    </div>
  );
}

/**
 * REPETIR SÓLO LO QUE FALTA (04/10/2026).
 *
 * Después de una pasada que no acabó bien: la lista de etapas con cómo fue
 * cada una y una casilla. Viene marcado lo que propone `planRecomendado` (lo
 * que falló y lo que arrastra); se puede cambiar. Lo que va siempre o lo que
 * obliga otra marcada sale marcado y sin poder quitarlo, diciendo por qué.
 */
export function RepetirEncargo({
  tarea,
  recorrido,
  recomendado,
  esperado,
  ocupado,
  onRepetir,
  onTodo,
}: {
  tarea: Tarea;
  recorrido: EtapaHecha[];
  recomendado: number[];
  /** Minutos que suele tardar cada etapa, para comparar. */
  esperado?: number[];
  ocupado: boolean;
  onRepetir: (plan: number[]) => void;
  onTodo: () => void;
}) {
  const etapas = ETAPAS[tarea];

  /* Lo que marca quien lo pide; arranca en lo propuesto. */
  const [marcadas, setMarcadas] = useState<number[] | null>(null);

  const elegidas = marcadas ?? recomendado;

  const plan = useMemo(() => completaPlan(tarea, elegidas), [tarea, elegidas]);

  const forzadas = useMemo(() => obligadas(tarea, elegidas), [tarea, elegidas]);

  const minutos = (i: number) => esperado?.[i] || etapas[i].minutos;

  const conPlan = plan.reduce((s, i) => s + minutos(i), 0);

  const entero = etapas.reduce((s, _, i) => s + minutos(i), 0);

  const cambia = (i: number, si: boolean) => {
    const base = new Set(elegidas);

    if (si) base.add(i);
    else base.delete(i);

    setMarcadas([...base].sort((a, b) => a - b));
  };

  return (
    <div className="mt-3 rounded-xl border border-amber-300/25 bg-amber-300/[0.04] p-3">
      <p className="flex items-start gap-1.5 text-[12px] text-white/80">
        <RotateCcw size={13} className="mt-0.5 shrink-0 text-amber-300" aria-hidden />
        <span>
          <strong className="text-white/90">No hace falta empezar de cero.</strong> Lo que salió bien se aprovecha: marca lo que quieres repetir.
        </span>
      </p>

      <ul className="mt-2.5 grid gap-x-5 gap-y-1 text-[11px]" style={{ gridTemplateColumns: "repeat(auto-fill, minmax(240px, 1fr))" }}>
        {etapas.map((e, i) => {
          const antes = recorrido[i]?.estado;

          const forzada = forzadas.get(i);

          const marcada = plan.includes(i);

          return (
            <li key={e.nombre} className="flex min-w-0 items-center gap-2">
              <input
                type="checkbox"
                className="shrink-0 accent-[#C8A96B]"
                checked={marcada}
                disabled={Boolean(forzada) || ocupado}
                onChange={(ev) => cambia(i, ev.target.checked)}
                aria-label={`Repetir «${e.nombre}»`}
              />
              <span className={`truncate ${marcada ? "text-white/85" : "text-white/45"}`}>{e.nombre}</span>
              <span className="ml-auto shrink-0 pl-2 text-white/35">
                {forzada === "siempre"
                  ? "va siempre"
                  : forzada === "arrastra"
                    ? "va con lo marcado"
                  : antes === "fallo"
                    ? <span className="text-red-300">falló</span>
                    : antes === "hecha" || antes === "previa"
                      ? <span className="text-emerald-300">ya está</span>
                      : "no llegó"}
              </span>
            </li>
          );
        })}
      </ul>

      <div className="mt-3 flex flex-wrap items-center justify-between gap-2 border-t border-white/[0.06] pt-2.5">
        <p className="text-[11px] text-white/45">
          {plan.length ? (
            <>
              Repetir lo marcado: <span className="text-white/75">~{duracion(conPlan)}</span> en vez de ~{duracion(entero)} de todo.
            </>
          ) : (
            "Marca al menos una etapa."
          )}
        </p>
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            disabled={ocupado}
            onClick={onTodo}
            className="rounded-lg border border-white/10 px-3 py-1.5 text-[11px] text-white/60 transition hover:border-white/25 hover:text-white disabled:opacity-40"
          >
            Todo de cero
          </button>
          <button
            type="button"
            disabled={ocupado || !plan.length}
            onClick={() => onRepetir(plan)}
            className="rounded-lg bg-[#C8A96B] px-3 py-1.5 text-[11px] font-semibold text-[#0B0F14] transition hover:brightness-110 disabled:opacity-40"
          >
            Repetir lo marcado
          </button>
        </div>
      </div>
    </div>
  );
}
