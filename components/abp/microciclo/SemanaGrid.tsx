"use client";

/**
 * La semana de lunes a domingo.
 *
 * Siete columnas, una por día, con lo que se trabaja de balón parado en cada
 * una. La rejilla no se apila en móvil: se desplaza en horizontal. Un
 * microciclo se lee comparando los días entre sí —dónde está la carga, qué día
 * queda vacío— y en una lista vertical de siete bloques eso se pierde.
 */

import { Monitor, Plus } from "lucide-react";

import { chipInk } from "@/lib/theme";

import {
  ASPECTO_BY_KEY,
  DIAS,
  LADO_COLOR,
  MOMENTO_SHORT,
  ROL_SHORT,
  TIPOS_DIA,
  cargaCognitiva,
  cargaCondicional,
  fmtMin,
  type DiaKey,
  type PlanDia,
  type TipoDia,
  type Trabajo,
} from "@/lib/abp/microciclo";

/* ------------------------------------------------------------------ */
/*  FICHA DE UN TRABAJO                                                */
/* ------------------------------------------------------------------ */

function TrabajoCard({
  trabajo,
  onClick,
}: {
  trabajo: Trabajo;
  onClick: () => void;
}) {
  const aspecto = ASPECTO_BY_KEY.get(trabajo.aspecto);
  const color = LADO_COLOR[trabajo.lado];

  return (
    <button
      type="button"
      onClick={onClick}
      className="w-full min-w-0 rounded-xl border border-white/10 bg-white/[0.03] p-2 text-left transition hover:border-white/25 hover:bg-white/[0.06]"
      style={{ borderLeft: `3px solid ${color}` }}
    >
      <div className="flex items-start justify-between gap-1.5">
        <p className="min-w-0 flex-1 truncate text-[11.5px] font-medium leading-tight text-white">
          {aspecto?.short ?? trabajo.aspecto}
        </p>

        <span className="shrink-0 text-[11px] font-semibold tabular-nums text-white/70">
          {trabajo.minutos}′
        </span>
      </div>

      <div className="mt-1.5 flex flex-wrap items-center gap-1">
        <span
          className="rounded px-1.5 py-0.5 text-[9px] font-semibold tracking-wide"
          style={{ backgroundColor: `${color}22`, color: chipInk(color) }}
        >
          {MOMENTO_SHORT[trabajo.momento]}
        </span>

        {trabajo.medio === "video" && (
          <span
            className="inline-flex items-center gap-0.5 rounded bg-sky-400/15 px-1.5 py-0.5 text-[9px] font-semibold text-sky-300"
            title="Trabajo en vídeo"
          >
            <Monitor size={9} />
            VÍDEO
          </span>
        )}

        {trabajo.roles.map((rol) => (
          <span
            key={rol}
            className="rounded bg-white/[0.07] px-1.5 py-0.5 text-[9px] font-semibold text-white/50"
          >
            {ROL_SHORT[rol]}
          </span>
        ))}

        {trabajo.origen === "registro" && (
          <span
            className="rounded bg-emerald-400/12 px-1.5 py-0.5 text-[9px] font-semibold text-emerald-300/80"
            title="Importado de la hoja de registro de tareas"
          >
            HOJA
          </span>
        )}
      </div>

      {trabajo.notas && (
        <p className="mt-1 truncate text-[10px] text-white/35">
          {trabajo.notas}
        </p>
      )}
    </button>
  );
}

/* ------------------------------------------------------------------ */
/*  COLUMNA DE UN DÍA                                                  */
/* ------------------------------------------------------------------ */

function DiaColumna({
  dia,
  plan,
  onCambiaTipo,
  onCambiaMd,
  onAbrir,
  onAnadir,
}: {
  dia: DiaKey;
  plan: PlanDia;
  onCambiaTipo: (tipo: TipoDia) => void;
  onCambiaMd: (md: string) => void;
  onAbrir: (trabajo: Trabajo) => void;
  onAnadir: () => void;
}) {
  const info = DIAS.find((item) => item.key === dia);

  const minutos = plan.trabajos.reduce(
    (total, trabajo) => total + (trabajo.minutos || 0),
    0,
  );

  const carga = plan.trabajos.reduce(
    (total, trabajo) => total + cargaCondicional(trabajo),
    0,
  );

  const cargaCog = plan.trabajos.reduce(
    (total, trabajo) => total + cargaCognitiva(trabajo),
    0,
  );

  const descansa = plan.tipo === "descanso";

  return (
    <div
      className={`flex min-w-0 flex-col rounded-2xl border ${
        descansa
          ? "border-white/[0.06] bg-white/[0.01]"
          : "border-white/10 bg-white/[0.025]"
      }`}
    >
      {/* ---------------------- CABECERA ---------------------- */}

      <div className="border-b border-white/10 px-2.5 py-2">
        <div className="flex items-baseline justify-between gap-1.5">
          <p className="text-xs font-semibold uppercase tracking-wider text-white">
            {info?.corto}
          </p>

          <input
            value={plan.md}
            onChange={(event) => onCambiaMd(event.target.value)}
            placeholder="MD"
            aria-label={`Día de partido de ${info?.label}`}
            className="w-14 rounded-md border border-white/10 bg-white/[0.04] px-1.5 py-0.5 text-right text-[10px] uppercase tracking-wide text-[#C8A96B] outline-none transition placeholder:text-white/20 focus:border-[#C8A96B]/50"
          />
        </div>

        <div className="mt-1.5 grid grid-cols-3 gap-1">
          {TIPOS_DIA.map((tipo) => {
            const activo = tipo.key === plan.tipo;

            return (
              <button
                key={tipo.key}
                type="button"
                onClick={() => onCambiaTipo(tipo.key)}
                aria-pressed={activo}
                title={tipo.label}
                className={`truncate rounded-md px-1 py-1 text-[9px] font-semibold uppercase tracking-wide transition ${
                  activo
                    ? "bg-[#C8A96B] text-black"
                    : "bg-white/[0.05] text-white/40 hover:text-white/70"
                }`}
              >
                {tipo.label.slice(0, 4)}
              </button>
            );
          })}
        </div>
      </div>

      {/* ---------------------- TRABAJOS ---------------------- */}

      <div className="flex min-h-[110px] flex-1 flex-col gap-1.5 p-2">
        {plan.trabajos.map((trabajo) => (
          <TrabajoCard
            key={trabajo.id}
            trabajo={trabajo}
            onClick={() => onAbrir(trabajo)}
          />
        ))}

        {!plan.trabajos.length && (
          <p className="px-1 py-3 text-center text-[10px] leading-relaxed text-white/35">
            {descansa ? "Descanso" : "Sin ABP"}
          </p>
        )}

        <button
          type="button"
          onClick={onAnadir}
          className="mt-auto inline-flex items-center justify-center gap-1 rounded-xl border border-dashed border-white/12 px-2 py-1.5 text-[10px] font-medium text-white/40 transition hover:border-[#C8A96B]/50 hover:text-[#C8A96B]"
        >
          <Plus size={11} />
          Añadir
        </button>
      </div>

      {/* ----------------------- TOTALES ---------------------- */}

      {minutos > 0 && (
        <div className="flex items-center justify-between gap-1 border-t border-white/10 px-2.5 py-1.5 text-[10px] tabular-nums">
          <span className="font-semibold text-white/75">{fmtMin(minutos)}</span>

          <span className="text-white/35" title="Carga condicional · cognitiva">
            {Math.round(carga)} · {Math.round(cargaCog)}
          </span>
        </div>
      )}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  SEMANA                                                             */
/* ------------------------------------------------------------------ */

export function SemanaGrid({
  dias,
  onCambiaTipo,
  onCambiaMd,
  onAbrir,
  onAnadir,
}: {
  dias: Record<DiaKey, PlanDia>;
  onCambiaTipo: (dia: DiaKey, tipo: TipoDia) => void;
  onCambiaMd: (dia: DiaKey, md: string) => void;
  onAbrir: (dia: DiaKey, trabajo: Trabajo) => void;
  onAnadir: (dia: DiaKey) => void;
}) {
  return (
    <div className="overflow-x-auto pb-1">
      <div className="grid min-w-[980px] grid-cols-7 items-stretch gap-2">
        {DIAS.map((dia) => (
          <DiaColumna
            key={dia.key}
            dia={dia.key}
            plan={dias[dia.key]}
            onCambiaTipo={(tipo) => onCambiaTipo(dia.key, tipo)}
            onCambiaMd={(md) => onCambiaMd(dia.key, md)}
            onAbrir={(trabajo) => onAbrir(dia.key, trabajo)}
            onAnadir={() => onAnadir(dia.key)}
          />
        ))}
      </div>
    </div>
  );
}
