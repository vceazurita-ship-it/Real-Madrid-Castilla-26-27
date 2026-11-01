"use client";

/*
|--------------------------------------------------------------------------
| PROPUESTA DE ONCE PARA EL PRÓXIMO PARTIDO (01/11/2026)
|--------------------------------------------------------------------------
|
| «Cómo decide»: los siete factores con su porcentaje (suman 100), una frase
| de qué mide cada uno, su casilla para apagarlo y un deslizador para darle
| más o menos peso; al mover uno, los demás se reajustan. La propuesta se
| rehace al momento y los pesos se recuerdan en este aparato. Una línea por
| jugador con el porqué, sin método. «Aplicar propuesta» la pasa al once y se
| puede deshacer: nunca se aplica sola. El cálculo vive en
| `lib/tactics/propuestaOnce.ts` y los pesos en `pesosPropuesta.ts`.
|
| Quién no puede jugar sale de las bajas marcadas en «Nuestro once», no de la
| columna ESTADO de la hoja.
*/

import { Check, Loader2, RotateCcw, Sparkles, X } from "lucide-react";
import { useEffect, useMemo, useState } from "react";

import type { ConBaja } from "@/lib/tactics/disponibilidad";
import {
  CLAVES_PESO,
  FACTORES_PESO,
  PESOS_POR_DEFECTO,
  TODOS_ENCENDIDOS,
  cuentan,
  enciende,
  guardaPreferencia,
  leePreferencia,
  olvidaPreferencia,
  pesosEfectivos,
  reparte,
  type FactorPeso,
  type PreferenciaPesos,
} from "@/lib/tactics/pesosPropuesta";
import { cargaDatosPropuesta } from "@/lib/tactics/propuestaCarga";
import { FACTORES, preparaPropuesta, proponOnceDelPartido, type DatosPropuesta, type Elegido, type Factor } from "@/lib/tactics/propuestaOnce";
import { cn } from "@/lib/utils";

const ES_DE_DATOS = new Set<string>(FACTORES.map((f) => f.clave));

export default function PropuestaOnce({
  roster,
  rival,
  onceActual,
  onAplica,
  onCierra,
}: {
  /** Con la baja vigente de cada uno: los que la tienen no entran. */
  roster: ConBaja[];
  rival: string;
  /** Quién está ahora en cada hueco (hueco → nombre de la ficha). */
  onceActual: Record<string, string>;
  onAplica: (elegidos: Elegido[]) => void;
  onCierra: () => void;
}) {
  const [datos, setDatos] = useState<DatosPropuesta | null>(null);
  const [fallo, setFallo] = useState(false);
  /* El panel sólo se monta al abrirlo (en el navegador): se puede leer lo recordado al nacer. */
  const [pref, setPref] = useState<PreferenciaPesos>(() => leePreferencia());

  useEffect(() => {
    let vivo = true;

    cargaDatosPropuesta(roster, rival)
      .then((d) => {
        if (vivo) setDatos(d);
      })
      .catch((error) => {
        console.error("[pizarra] propuesta de once", error);

        if (vivo) setFallo(true);
      });

    return () => {
      vivo = false;
    };
  }, [roster, rival]);

  const prep = useMemo(() => (datos ? preparaPropuesta(datos) : null), [datos]);

  /* Los factores de datos sin datos (sin once probable, sin valoraciones…) no pueden pesar. */
  const conDatos = useMemo(() => {
    const sinDatos = new Set(prep?.factores.filter((f) => !f.disponible).map((f) => f.clave) ?? []);

    return (k: FactorPeso) => !sinDatos.has(k as Factor);
  }, [prep]);

  const efectivos = useMemo(() => pesosEfectivos(pref.pesos, pref.encendidos, conDatos), [pref, conDatos]);
  const activos = useMemo(() => Object.fromEntries(FACTORES.map((f) => [f.clave, pref.encendidos[f.clave]])) as Record<Factor, boolean>, [pref]);
  const propuesta = useMemo(() => (prep ? proponOnceDelPartido(prep, onceActual, activos, efectivos) : null), [prep, onceActual, activos, efectivos]);

  const cambiaPref = (siguiente: PreferenciaPesos) => {
    setPref(siguiente);
    guardaPreferencia(siguiente);
  };

  const mueve = (k: FactorPeso, valor: number) => cambiaPref({ ...pref, pesos: reparte(pref.pesos, pref.encendidos, conDatos, k, valor) });

  const alterna = (k: FactorPeso, encendido: boolean) =>
    cambiaPref({ pesos: encendido ? enciende(pref.pesos, k) : pref.pesos, encendidos: { ...pref.encendidos, [k]: encendido } });

  const restablece = () => {
    setPref({ pesos: { ...PESOS_POR_DEFECTO }, encendidos: { ...TODOS_ENCENDIDOS } });
    olvidaPreferencia();
  };

  const tocados = CLAVES_PESO.some((k) => Math.abs(pref.pesos[k] - PESOS_POR_DEFECTO[k]) > 0.01 || !pref.encendidos[k]);
  /* Con uno solo encendido no hay nada que repartir: se queda en 100 %. */
  const cuentanVarios = cuentan(pref.encendidos, conDatos).length > 1;

  return (
    <section aria-label="Propuesta de once" className="rounded-2xl border border-[#C8A96B]/30 bg-[#C8A96B]/[0.05] p-3 sm:p-4">
      <header className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-[0.2em] text-[#C8A96B]">
            <Sparkles size={12} aria-hidden />
            Propuesta para el partido
          </p>
          <h3 className="mt-1 text-sm font-semibold text-white/90">Once contra el {datos?.rival ?? rival}</h3>
        </div>
        <button type="button" onClick={onCierra} aria-label="Cerrar la propuesta" className="rounded-lg p-1.5 text-white/45 transition hover:bg-white/[0.06] hover:text-white">
          <X size={16} />
        </button>
      </header>

      {!propuesta && !fallo && (
        <p className="mt-3 flex items-center gap-2 text-xs text-white/55">
          <Loader2 size={14} className="animate-spin" aria-hidden />
          Preparando la propuesta con el próximo rival…
        </p>
      )}

      {fallo && <p className="mt-3 text-xs text-amber-300">No se ha podido preparar la propuesta. Vuelve a abrirla en un momento.</p>}

      {propuesta && (
        <>
          <section aria-label="Cómo decide" className="mt-3 rounded-xl border border-white/10 bg-white/[0.02] p-3">
            <div className="flex flex-wrap items-baseline gap-2">
              <h4 className="mr-auto text-[11px] font-semibold uppercase tracking-[0.18em] text-white/60">Cómo decide</h4>
              <span className="text-[11px] text-white/45">Entre todos suman 100 %. Al mover uno, los demás se reajustan.</span>
              {tocados && (
                <button
                  type="button"
                  onClick={restablece}
                  className="inline-flex items-center gap-1 rounded-full border border-white/15 px-2.5 py-1 text-[11px] font-semibold text-white/70 transition hover:bg-white/[0.06] hover:text-white"
                >
                  <RotateCcw size={12} aria-hidden />
                  Restablecer
                </button>
              )}
            </div>

            <ul className="mt-2 grid gap-2 sm:grid-cols-2">
              {FACTORES_PESO.map((f) => {
                const estado = ES_DE_DATOS.has(f.clave) ? propuesta.factores.find((x) => x.clave === f.clave) : undefined;
                const puede = conDatos(f.clave);
                const encendido = puede && pref.encendidos[f.clave];
                const pct = efectivos[f.clave];
                const movible = encendido && cuentanVarios;
                const id = `peso-${f.clave}`;

                return (
                  <li
                    key={f.clave}
                    className={cn(
                      "rounded-xl border px-3 py-2.5 transition",
                      encendido ? "border-[#C8A96B]/40 bg-white/[0.05]" : "border-white/10 bg-white/[0.02]",
                      !puede && "opacity-60",
                    )}
                  >
                    <div className="flex items-start gap-2.5">
                      <input
                        type="checkbox"
                        checked={encendido}
                        disabled={!puede}
                        onChange={(e) => alterna(f.clave, e.target.checked)}
                        aria-label={`Tener en cuenta: ${f.rotulo}`}
                        className="mt-0.5 h-4 w-4 shrink-0 cursor-pointer accent-[#C8A96B] disabled:cursor-not-allowed"
                      />
                      <span className="min-w-0 flex-1">
                        <label htmlFor={id} className="block text-[13px] font-semibold text-white/90">
                          {f.rotulo}
                        </label>
                        <span className="mt-0.5 block text-[11px] leading-snug text-white/55">{f.mide}</span>
                        {estado?.nota ? <span className="mt-0.5 block text-[11px] leading-snug text-white/40">{estado.nota}</span> : null}
                      </span>
                      <span className="flex shrink-0 items-baseline gap-0.5">
                        <input
                          type="number"
                          inputMode="numeric"
                          min={0}
                          max={100}
                          value={pct}
                          disabled={!movible}
                          onChange={(e) => {
                            const v = Number(e.target.value);

                            if (Number.isFinite(v)) mueve(f.clave, v);
                          }}
                          aria-label={`Peso de ${f.rotulo}, en tanto por ciento`}
                          className="w-12 rounded-md border border-white/10 bg-[#0F141B] px-1.5 py-0.5 text-right text-[13px] font-bold tabular-nums text-[#C8A96B] outline-none disabled:opacity-60"
                        />
                        <span className="text-[11px] font-semibold text-white/50">%</span>
                      </span>
                    </div>
                    <input
                      id={id}
                      type="range"
                      min={0}
                      max={100}
                      step={1}
                      value={pct}
                      disabled={!movible}
                      onChange={(e) => mueve(f.clave, Number(e.target.value))}
                      className="mt-2 h-1.5 w-full cursor-pointer accent-[#C8A96B] disabled:cursor-not-allowed disabled:opacity-40"
                    />
                  </li>
                );
              })}
            </ul>
          </section>

          <ol className="mt-3 divide-y divide-white/[0.06] rounded-xl border border-white/10 bg-white/[0.02]">
            {propuesta.elegidos.map((e) => (
              <li key={e.hueco} className="flex flex-col gap-0.5 px-3 py-2 sm:flex-row sm:items-baseline sm:gap-3">
                <span className="flex min-w-0 items-baseline gap-2 sm:w-56 sm:shrink-0">
                  <span className="w-28 shrink-0 text-[10px] font-semibold uppercase tracking-[0.12em] text-white/40">{e.rotulo}</span>
                  <span className="truncate text-[13px] font-semibold text-white/90">{e.ficha.apodo || e.ficha.nombre}</span>
                  {!e.repite && <span className="shrink-0 rounded bg-emerald-400/[0.14] px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wider text-emerald-300">Entra</span>}
                </span>
                <span className="min-w-0 text-[12px] leading-snug text-white/60">{e.motivo}</span>
              </li>
            ))}
          </ol>

          {propuesta.bajas.length > 0 && (
            <p className="mt-2 text-[11px] leading-snug text-white/50">
              <b className="font-semibold text-white/70">No entran:</b> {propuesta.bajas.map((b) => `${b.nombre} (${b.estado})`).join(", ")}.
            </p>
          )}

          <div className="mt-3 flex flex-wrap items-center justify-end gap-2">
            <span className="mr-auto text-[11px] text-white/50">
              {propuesta.cambios === 0
                ? "Es el once que ya tienes en la pizarra."
                : `${propuesta.cambios} ${propuesta.cambios === 1 ? "puesto cambia" : "puestos cambian"} respecto a la pizarra.`}
            </span>
            <button
              type="button"
              onClick={onCierra}
              className="rounded-full border border-white/15 px-3.5 py-1.5 text-[12px] font-semibold text-white/70 transition hover:bg-white/[0.06] hover:text-white"
            >
              Cerrar
            </button>
            <button
              type="button"
              disabled={propuesta.cambios === 0 || propuesta.elegidos.length === 0 || datos?.plantilla !== roster}
              onClick={() => onAplica(propuesta.elegidos)}
              className="inline-flex items-center gap-1.5 rounded-full bg-[#C8A96B] px-4 py-1.5 text-[12px] font-bold text-[#0B0F14] transition hover:brightness-110 disabled:opacity-40"
            >
              <Check size={14} aria-hidden />
              Aplicar propuesta
            </button>
          </div>
        </>
      )}
    </section>
  );
}
