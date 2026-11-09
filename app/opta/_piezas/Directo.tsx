"use client";

/**
 * EL DIRECTO: las cifras de Opta de los partidos del día mientras se juegan.
 *
 * Las escribe `scripts/opta-directo.mjs` (GitHub Actions, se lanza desde
 * Ajustes): un índice `opta:directo` con los partidos del día y un documento
 * `opta:directo:<partido>` por partido. Aquí sólo se leen, cada minuto, y se
 * aguanta que falte cualquier cosa: sin índice, sin partido, sin cifras.
 */

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { Radio, RefreshCw } from "lucide-react";

import { MEJOR, ORO, tinta } from "@/components/data/graficas";
import { CASTILLA_OPTA, DOCS_OPTA, aObjetos, num, traeOpta, type TablaOpta } from "@/lib/opta";
import { NOMBRE_CASTILLA, valorPartido, type Fila } from "@/lib/opta-analisis";
import { defMetrica, nombreMetrica } from "@/lib/opta-nombres";

import { Elegir, fmt, Panel } from "./comun";
import type { DatosOpta } from "./useOpta";

type PartidoIndice = { partido: string; fecha?: string; estado?: string; conDatos?: boolean; equipos?: string[] };
type Indice = { dia?: string; actualizado?: string; hasta?: string; partidos?: PartidoIndice[] };
type DocDirecto = {
  partido?: string;
  fecha?: string;
  local?: string;
  visitante?: string;
  minuto?: number | string;
  estado?: string;
  actualizado?: string;
  equipos?: TablaOpta;
};

const CADA_MS = 60_000;
const NO_METRICA = new Set(["partido", "teamId", "equipo"]);
const CASTILLA_NOMBRE_OPTA = "Real Madrid II";

const hora = (iso?: string) => {
  if (!iso) return "";
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? "" : d.toLocaleTimeString("es-ES", { hour: "2-digit", minute: "2-digit", timeZone: "Europe/Madrid" });
};

const ESTADO: Record<string, string> = {
  played: "Terminado",
  fixture: "Por empezar",
  playing: "En juego",
  live: "En juego",
  postponed: "Aplazado",
};
const estadoEnPalabras = (e?: string) => (e ? (ESTADO[e.toLowerCase()] ?? e) : "");

const nombre = (f: Fila) => (f.teamId === CASTILLA_OPTA ? NOMBRE_CASTILLA : String(f.equipo ?? ""));

export function Directo({ datos }: { datos: DatosOpta }) {
  const { catalogo } = datos;
  const [vuelta, setVuelta] = useState(0);
  const [indice, setIndice] = useState<Indice | null | undefined>(undefined);
  const [elegido, setElegido] = useState("");
  const [leido, setLeido] = useState<{ clave: string; doc: DocDirecto | null } | null>(null);

  /* Cada minuto, otra vuelta. */
  useEffect(() => {
    const t = window.setInterval(() => setVuelta((n) => n + 1), CADA_MS);
    return () => window.clearInterval(t);
  }, []);

  useEffect(() => {
    let vivo = true;
    void traeOpta<Indice>("opta:directo").then((i) => {
      if (vivo) setIndice(i);
    });
    return () => {
      vivo = false;
    };
  }, [vuelta]);

  const partidos = useMemo(() => (Array.isArray(indice?.partidos) ? indice!.partidos!.filter((p) => p?.partido) : []), [indice]);
  const delCastilla = partidos.find((p) => (p.equipos ?? []).some((e) => e === CASTILLA_NOMBRE_OPTA));
  const visto = (elegido && partidos.some((p) => p.partido === elegido) ? elegido : "") || delCastilla?.partido || partidos.find((p) => p.conDatos)?.partido || partidos[0]?.partido || "";

  useEffect(() => {
    if (!visto) return;
    let vivo = true;
    void traeOpta<DocDirecto>(DOCS_OPTA.directo(visto)).then((doc) => {
      if (vivo) setLeido({ clave: visto, doc });
    });
    return () => {
      vivo = false;
    };
  }, [visto, vuelta]);

  const doc = leido?.clave === visto ? leido.doc : null;
  const filas = useMemo(() => aObjetos(doc?.equipos ?? null), [doc]);
  /* El Castilla a la izquierda; si no juega, el local (o el primero). */
  const [a, b] = useMemo(() => {
    const ordenadas = [...filas].sort((x, y) => {
      if (x.teamId === CASTILLA_OPTA) return -1;
      if (y.teamId === CASTILLA_OPTA) return 1;
      if (doc?.local && x.equipo === doc.local) return -1;
      if (doc?.local && y.equipo === doc.local) return 1;
      return 0;
    });
    return [ordenadas[0] ?? null, ordenadas[1] ?? null];
  }, [filas, doc]);
  const metricas = doc?.equipos?.cols?.filter((c) => !NO_METRICA.has(c)) ?? [];

  const explicacion = (
    <div className="space-y-2 text-sm text-white/65">
      <p>
        El directo se lanza desde <Link href="/ajustes" className="font-semibold underline">Ajustes</Link> durante el partido: un proceso entra en Opta cada minuto y deja aquí las cifras de los
        partidos de Primera RFEF del día.
      </p>
      <p className="text-xs text-white/50">Esta pestaña se pone al día sola cada minuto; no hace falta recargar.</p>
    </div>
  );

  if (indice === undefined) {
    return <p className="mt-6 text-sm text-white/55">Buscando partidos en directo…</p>;
  }

  return (
    <div className="mt-6 space-y-6">
      <Panel
        titulo={
          <span className="inline-flex items-center gap-2">
            <Radio size={16} style={{ color: ORO }} />
            Directo
          </span>
        }
        subtitulo={
          indice?.actualizado
            ? `Última mirada a Opta a las ${hora(indice.actualizado)}${indice.hasta ? `; el proceso sigue hasta las ${hora(indice.hasta)}` : ""}.`
            : undefined
        }
        derecha={
          <>
            {partidos.length > 1 && (
              <Elegir
                etiqueta="Partido"
                valor={visto}
                alCambiar={setElegido}
                opciones={partidos.map((p) => ({
                  clave: p.partido,
                  nombre: (p.equipos?.length ? p.equipos.map((e) => (e === CASTILLA_NOMBRE_OPTA ? NOMBRE_CASTILLA : e)).join(" - ") : p.partido) + (p.conDatos ? "" : " (aún sin cifras)"),
                }))}
              />
            )}
            <button
              type="button"
              onClick={() => setVuelta((n) => n + 1)}
              className="inline-flex items-center gap-1.5 rounded-xl border border-white/10 bg-white/[0.04] px-3 py-1.5 text-xs text-white/75 hover:text-white"
            >
              <RefreshCw size={12} />
              Mirar ahora
            </button>
          </>
        }
      >
        {partidos.length === 0 ? (
          <>
            <p className="mb-2 text-sm font-semibold text-white/85">Ahora mismo no hay ningún directo en marcha.</p>
            {explicacion}
          </>
        ) : !doc || !a || !b ? (
          <>
            <p className="mb-2 text-sm font-semibold text-white/85">
              {estadoEnPalabras(partidos.find((p) => p.partido === visto)?.estado) || "Partido del día"}: Opta todavía no ha publicado cifras de este partido.
            </p>
            <p className="text-xs text-white/50">
              Puede que Opta sólo las publique al acabar; en cuanto aparezcan, salen aquí solas.
            </p>
          </>
        ) : (
          <div>
            <div className="mb-4 flex flex-wrap items-end justify-between gap-3">
              <div className="min-w-0 flex-1 text-right">
                <p className="truncate text-lg font-semibold" style={a.teamId === CASTILLA_OPTA ? { color: ORO } : undefined}>
                  {nombre(a)}
                </p>
              </div>
              <div className="shrink-0 text-center">
                <p className="text-3xl font-semibold tabular-nums text-white">
                  {num(a.Goal) ?? 0} - {num(b.Goal) ?? 0}
                </p>
                <p className="text-[11px] text-white/55">
                  {[doc.minuto != null && doc.minuto !== "" ? `${doc.minuto}′` : "", estadoEnPalabras(doc.estado), doc.actualizado ? `cifras de las ${hora(doc.actualizado)}` : ""]
                    .filter(Boolean)
                    .join(" · ")}
                </p>
              </div>
              <div className="min-w-0 flex-1">
                <p className="truncate text-lg font-semibold" style={b.teamId === CASTILLA_OPTA ? { color: ORO } : undefined}>
                  {nombre(b)}
                </p>
              </div>
            </div>

            <div className="mx-auto max-w-3xl">
              {metricas
                .filter((k) => k !== "Goal")
                .map((k) => {
                  const def = defMetrica(k, catalogo);
                  const va = valorPartido(a, k, catalogo);
                  const vb = valorPartido(b, k, catalogo);
                  if (va == null && vb == null) return null;
                  const total = Math.abs(va ?? 0) + Math.abs(vb ?? 0);
                  const parteA = total > 0 ? (Math.abs(va ?? 0) / total) * 100 : 50;
                  /* Quién va mejor en esa cifra, si es de rendimiento. */
                  const ganaA = def.mejor === null || va == null || vb == null || va === vb ? null : def.mejor ? va > vb : va < vb;
                  return (
                    <div key={k} className="border-b border-white/[0.06] py-2 last:border-0">
                      <div className="flex items-baseline gap-2 text-[13px] tabular-nums">
                        <span className={`w-20 shrink-0 text-right ${ganaA === true ? "font-semibold text-white" : "text-white/70"}`}>{fmt(va, def.unidad)}</span>
                        <span className="min-w-0 flex-1 truncate text-center text-[12px] text-white/60">
                          {nombreMetrica(k, catalogo)}
                          {def.mejor === false && <span className="ml-1 text-[10px] text-white/40">(menos es mejor)</span>}
                        </span>
                        <span className={`w-20 shrink-0 ${ganaA === false ? "font-semibold text-white" : "text-white/70"}`}>{fmt(vb, def.unidad)}</span>
                      </div>
                      {total > 0 && (
                        <div className="mt-1 flex h-1.5 overflow-hidden rounded-full" style={{ background: tinta(0.08) }}>
                          <span style={{ width: `${parteA}%`, background: a.teamId === CASTILLA_OPTA ? "#C8A96B" : ganaA === true ? MEJOR : tinta(0.4) }} />
                          <span style={{ width: `${100 - parteA}%`, background: b.teamId === CASTILLA_OPTA ? "#C8A96B" : ganaA === false ? MEJOR : tinta(0.25) }} />
                        </div>
                      )}
                    </div>
                  );
                })}
            </div>
          </div>
        )}
      </Panel>

      {partidos.length > 0 && <Panel titulo="Cómo funciona">{explicacion}</Panel>}
    </div>
  );
}
