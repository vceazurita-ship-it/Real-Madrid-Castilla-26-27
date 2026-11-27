"use client";

/*
| AVISO «DOMINAMOS EN xG Y EL MARCADOR NO LO REFLEJA» (27/11/2026, idea de X).
| Va en la cabecera del marcador de /directo. Las cuentas, en lib/sala/dominio.ts.
|
| La temporada: los partidos ya jugados del archivo se leen UNA vez, sólo cuando
| salta el aviso, y cada uno se guarda en el aparato (un partido acabado no
| cambia): la siguiente vez no se baja nada (cuidado con la bajada de Supabase).
*/

import { useEffect, useState } from "react";
import { TrendingUp } from "lucide-react";

import { casoDescanso, DOMINIO_XG, type CasoDescanso } from "@/lib/sala/dominio";
import { partidoDe, type DocPartido } from "@/lib/sala/modelo";
import { S } from "./piezas";

const COPIA = "sala:dominio:v1:";
const dos = (v: number) => v.toLocaleString("es-ES", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

function deCopia(clave: string): CasoDescanso | null | undefined {
  try {
    const v = window.localStorage.getItem(COPIA + clave);
    if (v == null) return undefined;
    return v === "-" ? null : (JSON.parse(v) as CasoDescanso);
  } catch {
    return undefined;
  }
}
function aCopia(clave: string, c: CasoDescanso | null) {
  try {
    window.localStorage.setItem(COPIA + clave, c ? JSON.stringify(c) : "-");
  } catch {
    /* sin sitio: se vuelve a leer otro día */
  }
}

async function leeCaso(prefijo: string, id: string): Promise<CasoDescanso | null | undefined> {
  const guardado = deCopia(prefijo + id);
  if (guardado !== undefined) return guardado;
  try {
    const r = await fetch(`/api/docs?key=${encodeURIComponent(prefijo + id)}`, { cache: "no-store" });
    if (!r.ok) return undefined;
    const d = ((await r.json())?.data ?? null) as DocPartido | null;
    const p = d ? partidoDe(d) : null;
    /* Sin acabar (o sin cuadrar aún): no se guarda, se mira la próxima vez. */
    if (!p || !p.acabado) return undefined;
    const c = casoDescanso(p);
    aCopia(prefijo + id, c);
    return c;
  } catch {
    return undefined;
  }
}

/** Los partidos ya jugados de la temporada (antes de este), mirados al descanso. Sólo se leen con `activo`. */
export function useTemporadaDescanso(prefijo: string, ids: string[], activo: boolean) {
  const [casos, setCasos] = useState<{ clave: string; lista: CasoDescanso[] } | null>(null);
  const clave = `${prefijo}|${ids.join(",")}`;
  const listo = casos?.clave === clave;
  useEffect(() => {
    if (!activo || listo || !ids.length) return;
    let vivo = true;
    void (async () => {
      const salida: CasoDescanso[] = [];
      /* De tres en tres: no se pide todo el archivo de golpe. */
      for (let i = 0; i < ids.length && vivo; i += 3) {
        const lote = await Promise.all(ids.slice(i, i + 3).map((id) => leeCaso(prefijo, id)));
        for (const c of lote) if (c) salida.push(c);
      }
      if (vivo) setCasos({ clave, lista: salida });
    })();
    return () => {
      vivo = false;
    };
    // `clave` resume prefijo e ids.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activo, listo, clave]);
  return { lista: listo ? casos.lista : null, sinPartidos: !ids.length };
}

export function AvisoDominio({ dxg, dg, nuestro, lista, sinPartidos }: { dxg: number; dg: number; nuestro: string; lista: CasoDescanso[] | null; sinPartidos: boolean }) {
  const asi = (lista ?? []).filter((c) => c.situacion);
  const escapados = asi.filter((c) => c.escapado);
  const empates = escapados.filter((c) => c.final[0] === c.final[1]).length;
  const derrotas = escapados.length - empates;
  const marcador = dg > 0 ? `ganando sólo por ${dg}` : dg === 0 ? "empatados" : `perdiendo por ${-dg}`;
  return (
    <div
      id="x-idea-2126405399641231380-2"
      role="status"
      className="relative mb-4 flex flex-wrap items-start gap-x-4 gap-y-2 rounded-2xl px-3 py-2.5 sm:px-4"
      style={{ background: "rgba(233,196,106,0.10)", border: "1px solid rgba(233,196,106,0.45)" }}
    >
      <div className="flex min-w-0 flex-1 items-start gap-2">
        <TrendingUp size={18} className="mt-0.5 shrink-0" style={{ color: S.oro }} aria-hidden />
        <div className="min-w-0">
          <p className="text-[12px] font-bold uppercase tracking-[0.14em]" style={{ color: S.oro }}>
            Dominamos en xG y el marcador no lo refleja
          </p>
          <p className="text-[13px] leading-snug" style={{ color: S.texto }}>
            {nuestro} +{dos(dxg)} de xG y {marcador}. ¿Seguir atacando para cerrarlo o protegerlo?
          </p>
        </div>
      </div>
      <div className="min-w-0 basis-full text-[13px] leading-snug sm:basis-auto sm:max-w-[26rem]" style={{ color: S.suave }}>
        {sinPartidos ? (
          <span>Aún no hay partidos de la temporada para comparar.</span>
        ) : lista == null ? (
          <span>Mirando la temporada…</span>
        ) : !asi.length ? (
          <span>
            Esta temporada ({lista.length} partidos), ninguno llegó al descanso así (+{dos(DOMINIO_XG)} de xG y un gol de ventaja o menos).
          </span>
        ) : (
          <>
            <span>
              Esta temporada, al descanso así:{" "}
              <b className="font-mono tabular-nums" style={{ color: escapados.length ? S.aviso : S.favor }}>
                {escapados.length} de {asi.length}
              </b>{" "}
              se escaparon
              {escapados.length ? ` (${[empates ? `${empates} ${empates === 1 ? "empate" : "empates"}` : "", derrotas ? `${derrotas} ${derrotas === 1 ? "derrota" : "derrotas"}` : ""].filter(Boolean).join(", ")})` : ""}.
            </span>
            <span className="mt-1 flex flex-wrap gap-1">
              {asi.map((c) => (
                <span
                  key={c.id}
                  className="whitespace-nowrap rounded-md px-1.5 py-0.5 font-mono text-[11px] tabular-nums"
                  style={{ background: "rgba(255,255,255,0.05)", border: `1px solid ${c.escapado ? "rgba(255,138,61,0.5)" : "rgba(43,227,160,0.4)"}`, color: S.texto }}
                  title={`Al descanso ${c.golesDescanso.join("-")} con xG ${dos(c.xgDescanso[0])} – ${dos(c.xgDescanso[1])}; final ${c.final.join("-")}`}
                >
                  {c.rival} {c.golesDescanso.join("-")} → {c.final.join("-")}
                </span>
              ))}
            </span>
          </>
        )}
      </div>
    </div>
  );
}
