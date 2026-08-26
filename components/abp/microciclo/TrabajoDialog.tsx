"use client";

/**
 * Editor de un trabajo de balón parado del microciclo.
 *
 * Se abre desde la casilla de un día. Todo lo que define el trabajo cabe en
 * una pantalla y sin scroll en tablet, que es donde se rellena: los ejes son
 * conmutadores de un toque y las escalas, botoneras del 1 al 10. Un
 * desplegable por campo obligaría a tres toques por decisión.
 */

import { useId, useState } from "react";
import { Trash2 } from "lucide-react";

import { Button, Dialog, TextArea } from "@/components/abp/ui";
import {
  ASPECTOS_POR_GRUPO,
  ASPECTO_BY_KEY,
  DIAS,
  LADOS,
  LADO_COLOR,
  MEDIOS,
  MOMENTOS,
  ROLES,
  cargaCognitiva,
  cargaCondicional,
  type AbpLado,
  type AbpMedio,
  type AbpMomento,
  type AbpRol,
  type AspectoKey,
  type DiaKey,
  type Trabajo,
} from "@/lib/abp/microciclo";

/* ------------------------------------------------------------------ */
/*  PIEZAS                                                             */
/* ------------------------------------------------------------------ */

/** Conmutador ancho: los ejes del trabajo se eligen de un toque. */
function Conmutador<T extends string>({
  label,
  options,
  value,
  onChange,
  colorOf,
}: {
  label: string;
  options: { key: T; label: string }[];
  value: T;
  onChange: (key: T) => void;
  colorOf?: (key: T) => string;
}) {
  return (
    <div className="min-w-0">
      <p className="mb-1.5 text-[10px] uppercase tracking-[0.16em] text-white/40">
        {label}
      </p>

      <div className="grid gap-1.5" style={{ gridTemplateColumns: `repeat(${options.length}, minmax(0, 1fr))` }}>
        {options.map((option) => {
          const activo = option.key === value;
          const color = colorOf?.(option.key) ?? "#C8A96B";

          return (
            <button
              key={option.key}
              type="button"
              onClick={() => onChange(option.key)}
              aria-pressed={activo}
              className="truncate rounded-xl border px-2 py-2 text-xs font-medium transition"
              style={
                activo
                  ? {
                      borderColor: color,
                      backgroundColor: `${color}22`,
                      color,
                    }
                  : {
                      borderColor: "rgba(255,255,255,0.12)",
                      color: "rgba(255,255,255,0.55)",
                    }
              }
            >
              {option.label}
            </button>
          );
        })}
      </div>
    </div>
  );
}

/**
 * Escala del 1 al 10 con un botón por valor.
 *
 * El 0 no es un valor de la escala: significa «no lo he valorado», y por eso
 * se sale volviendo a pulsar el número marcado en vez de con un botón aparte.
 */
function Escala({
  label,
  value,
  onChange,
  hint,
  color,
}: {
  label: string;
  value: number;
  onChange: (value: number) => void;
  hint?: string;
  color: string;
}) {
  return (
    <div className="min-w-0">
      <div className="mb-1.5 flex items-baseline justify-between gap-2">
        <p className="text-[10px] uppercase tracking-[0.16em] text-white/40">
          {label}
        </p>

        <p className="text-[11px] tabular-nums text-white/45">
          {value > 0 ? `${value}/10` : "sin valorar"}
        </p>
      </div>

      <div className="grid grid-cols-10 gap-1">
        {Array.from({ length: 10 }, (_, index) => index + 1).map((n) => {
          const activo = value >= n;

          return (
            <button
              key={n}
              type="button"
              onClick={() => onChange(value === n ? 0 : n)}
              aria-label={`${label} ${n}`}
              aria-pressed={value === n}
              className="h-8 rounded-lg border text-[11px] font-medium tabular-nums transition"
              style={
                activo
                  ? { borderColor: color, backgroundColor: `${color}26`, color }
                  : {
                      borderColor: "rgba(255,255,255,0.10)",
                      color: "rgba(255,255,255,0.35)",
                    }
              }
            >
              {n}
            </button>
          );
        })}
      </div>

      {hint && <p className="mt-1 text-[10px] text-white/30">{hint}</p>}
    </div>
  );
}

/** Selector de aspecto agrupado. El catálogo es largo y plano no se lee. */
function AspectoSelect({
  value,
  onChange,
}: {
  value: AspectoKey;
  onChange: (value: AspectoKey) => void;
}) {
  const id = useId();

  return (
    <label htmlFor={id} className="block min-w-0">
      <span className="mb-1.5 block text-[10px] uppercase tracking-[0.16em] text-white/40">
        Aspecto
      </span>

      <select
        id={id}
        value={value}
        onChange={(event) => onChange(event.target.value as AspectoKey)}
        className="w-full rounded-xl border border-white/10 bg-white/[0.04] px-3 py-2 text-sm text-white outline-none transition focus:border-[#C8A96B]/50"
      >
        {ASPECTOS_POR_GRUPO.map((grupo) => (
          <optgroup key={grupo.grupo} label={grupo.label}>
            {grupo.aspectos.map((aspecto) => (
              <option
                key={aspecto.key}
                value={aspecto.key}
                className="bg-[#11161C]"
              >
                {aspecto.label}
              </option>
            ))}
          </optgroup>
        ))}
      </select>
    </label>
  );
}

/* ------------------------------------------------------------------ */
/*  DIÁLOGO                                                            */
/* ------------------------------------------------------------------ */

export function TrabajoDialog({
  trabajo,
  dia,
  nuevo,
  onGuardar,
  onBorrar,
  onCerrar,
}: {
  trabajo: Trabajo;
  dia: DiaKey;
  /** Cambia el rótulo del botón: no es lo mismo crear que corregir. */
  nuevo?: boolean;
  /** El día viaja aparte del trabajo: cambiarlo lo mueve de columna. */
  onGuardar: (trabajo: Trabajo, dia: DiaKey) => void;
  onBorrar?: () => void;
  onCerrar: () => void;
}) {
  const [borrador, setBorrador] = useState<Trabajo>(trabajo);
  const [diaBorrador, setDiaBorrador] = useState<DiaKey>(dia);

  const set = <K extends keyof Trabajo>(campo: K, valor: Trabajo[K]) =>
    setBorrador((actual) => ({ ...actual, [campo]: valor }));

  const alternaRol = (rol: AbpRol) =>
    setBorrador((actual) => ({
      ...actual,
      roles: actual.roles.includes(rol)
        ? actual.roles.filter((item) => item !== rol)
        : [...actual.roles, rol],
    }));

  const aspecto = ASPECTO_BY_KEY.get(borrador.aspecto);

  const importado = borrador.origen === "registro";

  const carga = cargaCondicional(borrador);
  const cargaCog = cargaCognitiva(borrador);

  return (
    <Dialog
      title={nuevo ? "Nuevo trabajo de ABP" : aspecto?.label ?? "Trabajo de ABP"}
      subtitle={DIAS.find((item) => item.key === diaBorrador)?.label}
      onClose={onCerrar}
      footer={
        <>
          {onBorrar && (
            <Button tone="danger" icon={Trash2} onClick={onBorrar}>
              Quitar
            </Button>
          )}

          <Button onClick={onCerrar}>Cancelar</Button>

          <Button
            tone="primary"
            onClick={() => onGuardar(borrador, diaBorrador)}
            disabled={borrador.minutos <= 0}
          >
            {nuevo ? "Añadir" : "Guardar"}
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        <Conmutador
          label="Día"
          options={DIAS.map((item) => ({ key: item.key, label: item.corto }))}
          value={diaBorrador}
          onChange={(key) => setDiaBorrador(key as DiaKey)}
        />

        <Conmutador
          label="Lado"
          options={LADOS.map((lado) => ({ key: lado.key, label: lado.label }))}
          value={borrador.lado}
          onChange={(key) => set("lado", key as AbpLado)}
          colorOf={(key) => LADO_COLOR[key as AbpLado]}
        />

        <AspectoSelect
          value={borrador.aspecto}
          onChange={(key) => set("aspecto", key)}
        />

        {aspecto?.sinDato && (
          <p className="rounded-xl border border-amber-400/25 bg-amber-400/[0.06] px-3 py-2 text-[11px] leading-relaxed text-amber-200/80">
            {aspecto.sinDato} Se puede planificar igual, pero el cruce con
            competición no podrá decir nada de este aspecto.
          </p>
        )}

        <div className="grid gap-4 sm:grid-cols-2">
          <Conmutador
            label="Momento de la sesión"
            options={MOMENTOS.map((momento) => ({
              key: momento.key,
              label: momento.short,
            }))}
            value={borrador.momento}
            onChange={(key) => set("momento", key as AbpMomento)}
          />

          <Conmutador
            label="Dónde"
            options={MEDIOS.map((medio) => ({
              key: medio.key,
              label: medio.label,
            }))}
            value={borrador.medio}
            onChange={(key) => set("medio", key as AbpMedio)}
          />
        </div>

        {/* --------------------------- ROLES --------------------------- */}

        <div className="min-w-0">
          <p className="mb-1.5 text-[10px] uppercase tracking-[0.16em] text-white/40">
            Con quién se trabaja
          </p>

          <div className="flex flex-wrap gap-1.5">
            {ROLES.map((rol) => {
              const activo = borrador.roles.includes(rol.key);

              return (
                <button
                  key={rol.key}
                  type="button"
                  onClick={() => alternaRol(rol.key)}
                  aria-pressed={activo}
                  className={`rounded-xl border px-3 py-2 text-xs font-medium transition ${
                    activo
                      ? "border-[#C8A96B] bg-[#C8A96B]/15 text-[#C8A96B]"
                      : "border-white/12 text-white/50 hover:border-white/25 hover:text-white"
                  }`}
                >
                  {rol.label}
                </button>
              );
            })}
          </div>
        </div>

        {/* -------------------------- DESGASTE ------------------------- */}

        <div className="rounded-2xl border border-white/10 bg-white/[0.02] p-3.5">
          <div className="grid gap-3 sm:grid-cols-[120px_minmax(0,1fr)] sm:items-end">
            <label className="block min-w-0">
              <span className="mb-1.5 block text-[10px] uppercase tracking-[0.16em] text-white/40">
                Tiempo (min)
              </span>

              <input
                type="number"
                min={0}
                step={1}
                value={borrador.minutos || ""}
                onChange={(event) =>
                  set("minutos", Math.max(0, Number(event.target.value) || 0))
                }
                className="w-full rounded-xl border border-white/10 bg-white/[0.04] px-3 py-2 text-sm tabular-nums text-white outline-none transition focus:border-[#C8A96B]/50"
              />
            </label>

            <div className="grid grid-cols-2 gap-3 text-center">
              <div className="rounded-xl border border-white/10 bg-white/[0.03] px-3 py-2">
                <p className="text-[10px] uppercase tracking-[0.16em] text-white/35">
                  Carga condicional
                </p>

                <p className="mt-0.5 text-lg font-semibold tabular-nums text-white">
                  {carga || "—"}
                </p>
              </div>

              <div className="rounded-xl border border-white/10 bg-white/[0.03] px-3 py-2">
                <p className="text-[10px] uppercase tracking-[0.16em] text-white/35">
                  Carga cognitiva
                </p>

                <p className="mt-0.5 text-lg font-semibold tabular-nums text-white">
                  {cargaCog || "—"}
                </p>
              </div>
            </div>
          </div>

          <div className="mt-3.5 grid gap-3.5 sm:grid-cols-2">
            <Escala
              label="Intensidad"
              value={borrador.intensidad}
              onChange={(valor) => {
                set("intensidad", valor);

                /* Tocar la escala a mano deja de ser lo que midió la hoja. */
                if (importado) set("cargaRegistrada", null);
              }}
              color="#FBBF24"
            />

            <Escala
              label="Exigencia cognitiva"
              value={borrador.exigCognitiva}
              onChange={(valor) => {
                set("exigCognitiva", valor);

                if (importado) set("cargaCogRegistrada", null);
              }}
              color="#8B5CF6"
            />
          </div>

          <p className="mt-2.5 text-[10px] leading-relaxed text-white/30">
            {borrador.cargaRegistrada != null ||
            borrador.cargaCogRegistrada != null
              ? "Cargas medidas: vienen de la hoja de registro de tareas. Si tocas una escala, esa carga pasa a ser estimada."
              : "Carga condicional = tiempo × intensidad, la misma cuenta que la hoja de registro. La cognitiva es una estimación (tiempo × exigencia); la de la hoja lleva más ingredientes."}
          </p>
        </div>

        <TextArea
          label="Notas"
          value={borrador.notas}
          onChange={(valor) => set("notas", valor)}
          placeholder="Rutina concreta, jugadores implicados, vídeo de referencia…"
          rows={2}
        />
      </div>
    </Dialog>
  );
}
