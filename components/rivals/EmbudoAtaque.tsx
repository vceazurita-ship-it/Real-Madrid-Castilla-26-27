"use client";

/**
 * EMBUDO DEL ATAQUE (Scout colectivo, 16/11/2026): secuencias → último
 * tercio → toques en el área → remates, con el paso de cada escalón y la
 * media de nuestro grupo al lado. El selector cambia a lo que le hacen a él
 * («Cómo le atacan»): si su defensa cae antes del área o dentro.
 *
 * Datos: `opta:partidos` por `useOptaLigero` (la misma descarga que
 * «Evolución comparada»). Las cuentas, en `lib/rivals/embudo-ataque.ts`.
 * Si el rival no cruza con Opta, el bloque no se pinta. Nada se pide hasta
 * que asoma.
 */

import { useMemo, useState } from "react";

import { useAsoma } from "@/hooks/useAsoma";

import { COMPARADO, MEJOR, PEOR, tinta } from "@/components/data/graficas";
import { useOptaLigero } from "@/hooks/useOptaLigero";
import { CASTILLA_OPTA } from "@/lib/opta";
import { casaEquipo } from "@/lib/opta-eventos";
import { desvio, embudosDe, lecturaEmbudo, UMBRAL_DESVIO, type Escalon, type LadoEmbudo } from "@/lib/rivals/embudo-ataque";

const coma = (v: number, d = 1) => v.toFixed(d).replace(".", ",");

const valorPaso = (v: number | null, unidad: Escalon["unidad"]) => (v == null ? "" : unidad === "%" ? `${coma(v, 0)} %` : coma(v, 2));

export function EmbudoAtaque({ equipo }: { equipo: string }) {
  /* El mismo «al asomar o, como muy tarde, a los 2,5 s» que los demás bloques del rival: sin bajar (captura, exportación) también se pinta. */
  const { caja, abierto } = useAsoma<HTMLDivElement>();

  return <div ref={caja} className="min-w-0">{abierto && <Bloque equipo={equipo} />}</div>;
}

function Bloque({ equipo }: { equipo: string }) {
  const { opta } = useOptaLigero();
  const [lado, setLado] = useState<LadoEmbudo>("ataque");

  const datos = useMemo(() => {
    if (!opta) return null;
    const equipos = opta.equipos.map((f) => ({ teamId: String(f.teamId ?? ""), equipo: String(f.equipo ?? "") }));
    const rivalId = casaEquipo(equipo, equipos);
    if (!rivalId || rivalId === CASTILLA_OPTA) return null;
    const nombre = equipos.find((e) => e.teamId === rivalId)?.equipo || equipo;
    const g = opta.grupos.get(CASTILLA_OPTA) ?? opta.grupos.get(rivalId);
    const grupo = new Set([...opta.grupos.entries()].filter(([, n]) => n === g).map(([id]) => id));
    const embudos = embudosDe(opta.partidos, rivalId, grupo);
    return embudos.length ? { embudos, nombre } : null;
  }, [opta, equipo]);

  if (!datos) return null;
  const { embudos, nombre } = datos;
  const embudo = embudos.find((e) => e.lado === lado) ?? embudos[0];
  const enDefensa = embudo.lado === "defensa";
  const frase = lecturaEmbudo(embudo, nombre);

  return (
    <section aria-label="Embudo del ataque" className="mt-8 min-w-0 rounded-2xl border border-white/10 bg-white/[0.03] px-4 py-4 sm:px-5">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <p className="flex flex-wrap items-baseline gap-x-2 text-base font-bold text-white">
          Embudo del ataque
          <span className="rounded-full border border-white/15 px-2 py-0.5 text-[11px] font-semibold text-white/60">
            dato · Opta, {embudo.partidos} {embudo.partidos === 1 ? "partido" : "partidos"}
          </span>
        </p>
        <div role="group" aria-label="Qué embudo" className="flex rounded-full border border-white/15 p-0.5 text-[11px] font-semibold">
          {embudos.map((e) => (
            <button
              key={e.lado}
              type="button"
              onClick={() => setLado(e.lado)}
              aria-pressed={embudo.lado === e.lado}
              className={`rounded-full px-3 py-1 transition ${embudo.lado === e.lado ? "bg-white/15 text-white" : "text-white/55 hover:text-white"}`}
            >
              {e.lado === "ataque" ? "Su ataque" : "Cómo le atacan"}
            </button>
          ))}
        </div>
      </div>

      <p className="mt-1 text-sm leading-6 text-white/75">
        {enDefensa
          ? `Lo que hacen sus rivales contra ${nombre}, por partido: dónde se les corta y dónde no.`
          : `Lo que hace ${nombre} con el balón, por partido: cuánto llega y cuánto convierte cuando llega.`}
        {frase && <> <strong className="text-white">{frase}</strong></>}
      </p>

      <p className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-[11px] text-white/60">
        <span className="inline-flex min-w-0 items-center gap-1.5">
          <span aria-hidden className="inline-block h-2.5 w-5 shrink-0 rounded-sm" style={{ background: COMPARADO }} />
          <span className="truncate">{enDefensa ? `Contra ${nombre}` : nombre}</span>
        </span>
        <span className="inline-flex items-center gap-1.5">Paso · <span className="text-white/45">media de nuestro grupo</span></span>
      </p>

      <ol className="mt-3 space-y-2.5">
        {embudo.escalones.map((e) => {
          const d = desvio(e);
          /* En ataque, pasar más es bueno para él; en defensa, malo. */
          const bueno = d == null || Math.abs(d) < UMBRAL_DESVIO ? null : enDefensa ? d < 0 : d > 0;
          const colorPaso = bueno == null ? undefined : bueno ? MEJOR : PEOR;
          return (
            <li key={e.key} className="min-w-0">
              <div className="flex min-w-0 flex-wrap items-baseline justify-between gap-x-3 text-[12px]">
                <span className="min-w-0 truncate font-semibold text-white">{e.rotulo}</span>
                <span className="shrink-0 tabular-nums text-white/60">
                  {coma(e.porPartido)}/partido
                  {e.paso != null && (
                    <>
                      {" · "}
                      <strong className="text-white" style={colorPaso ? { color: colorPaso } : undefined}>
                        {valorPaso(e.paso, e.unidad)}
                      </strong>
                      {e.unidad === "por llegada" && " por llegada"}
                      {e.pasoLiga != null && <span className="text-white/45"> · grupo {valorPaso(e.pasoLiga, e.unidad)}</span>}
                    </>
                  )}
                </span>
              </div>
              <div
                className="mt-1 h-3 min-w-0 rounded-sm"
                style={{ background: tinta(0.06) }}
                role="img"
                aria-label={`${e.rotulo}: ${coma(e.porPartido)} por partido${e.paso != null ? `, ${valorPaso(e.paso, e.unidad)}${e.unidad === "por llegada" ? " por llegada" : ""}` : ""}${e.pasoLiga != null ? `; media del grupo ${valorPaso(e.pasoLiga, e.unidad)}` : ""}`}
              >
                <div className="h-full rounded-sm" style={{ width: `${Math.max(1, e.ancho * 100)}%`, background: COMPARADO }} />
              </div>
            </li>
          );
        })}
      </ol>

      <p className="mt-3 text-[11px] leading-5 text-white/45">
        Una secuencia es la cadena de una posesión. «Llegan al último tercio» es el % de secuencias que lo pisan; toques en el área y remates van por cada
        llegada (un toque no es una secuencia y una secuencia puede tener dos remates). En verde, mejor que la media de nuestro grupo para{" "}
        {enDefensa ? "su defensa" : "su ataque"}; en naranja, peor.
      </p>
    </section>
  );
}
