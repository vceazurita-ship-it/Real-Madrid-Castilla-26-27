"use client";

/**
 * EL ÚLTIMO PARTIDO EN 3D, EN LA PORTADA (14/11/2026, petición del analista).
 *
 * El retrato 3D animado (components/data/RelievePartido) del último partido
 * del Castilla en Opta, si ya tiene su evento a evento (opta:directo:<id>, lo
 * deja el directo o «Repasar otro partido»). Si no lo tiene, no ocupa sitio.
 */

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { ArrowRight } from "lucide-react";

import { RelievePartido } from "@/components/data/RelievePartido";
import { useOptaLigero } from "@/hooks/useOptaLigero";
import { CASTILLA_OPTA, DOCS_OPTA, aObjetos, traeOpta, type TablaOpta } from "@/lib/opta";

type Doc = { eventos?: TablaOpta; equipos?: TablaOpta; fecha?: string };

export function UltimoPartido3D() {
  const { opta } = useOptaLigero();
  const ultimo = useMemo(() => {
    const nuestros = (opta?.partidos ?? []).filter((f) => f.teamId === CASTILLA_OPTA && String(f.partido ?? ""));
    nuestros.sort((x, y) => String(y.fecha ?? "").localeCompare(String(x.fecha ?? "")));
    return nuestros[0] ? String(nuestros[0].partido) : "";
  }, [opta]);
  const [doc, setDoc] = useState<Doc | null>(null);
  useEffect(() => {
    if (!ultimo) return;
    let vivo = true;
    void traeOpta<Doc>(DOCS_OPTA.directo(ultimo)).then((d) => {
      if (vivo) setDoc(d);
    });
    return () => {
      vivo = false;
    };
  }, [ultimo]);

  const filas = aObjetos(doc?.equipos ?? null).sort((x, y) => (x.teamId === CASTILLA_OPTA ? -1 : y.teamId === CASTILLA_OPTA ? 1 : 0));
  const [x, y] = [filas[0], filas[1]];
  if (!doc?.eventos?.filas?.length || !x || !y) return null;
  const nom = (f: Record<string, unknown>) => (f.teamId === CASTILLA_OPTA ? "Real Madrid Castilla" : String(f.equipo ?? ""));
  const n = (v: unknown) => (typeof v === "number" && Number.isFinite(v) ? v : Number(v) || 0);
  const coma = (v: number, d = 2) => v.toFixed(d).replace(".", ",");
  /* Tres cifras que cuentan el partido sin abrirlo: ocasiones, puntería y balón. */
  const cifras: [string, string, string][] = [
    ["xG", coma(n(x.ExpG)), coma(n(y.ExpG))],
    ["Remates a puerta", String(n(x.SOG)), String(n(y.SOG))],
    ["Posesión", `${Math.round(n(x["Poss%"]) * (n(x["Poss%"]) <= 1 ? 100 : 1))} %`, `${Math.round(n(y["Poss%"]) * (n(y["Poss%"]) <= 1 ? 100 : 1))} %`],
  ];
  const gx = n(x.Goal);
  const gy = n(y.Goal);
  const dxg = n(x.ExpG) - n(y.ExpG);
  const lectura =
    gx > gy
      ? dxg >= 0.3 ? "Victoria merecida: más ocasiones que el rival." : dxg <= -0.3 ? "Victoria por encima de las ocasiones: el rival generó más." : "Victoria en un partido de ocasiones igualadas."
      : gx < gy
        ? dxg >= 0.3 ? "Derrota con más ocasiones que el rival: faltó acierto." : dxg <= -0.3 ? "Derrota en la que el rival generó más." : "Derrota en un partido de ocasiones igualadas."
        : dxg >= 0.3 ? "Empate con más ocasiones nuestras." : dxg <= -0.3 ? "Empate con más ocasiones del rival." : "Empate con ocasiones igualadas.";
  const eq = (f: Record<string, unknown>) => ({ teamId: String(f.teamId ?? ""), nombre: nom(f), color: String(f.color ?? ""), campo: String(f.campo ?? "") });

  return (
    <section className="rounded-3xl border border-white/10 bg-white/[0.03] p-3 sm:p-4">
      <div className="mb-2 flex flex-wrap items-baseline justify-between gap-2 px-1">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-white/50">El último partido en 3D</p>
          <p className="text-sm font-semibold text-white">
            {nom(x)} {String(x.Goal ?? "")}-{String(y.Goal ?? "")} {nom(y)}
            {doc.fecha ? <span className="ml-2 text-xs font-normal text-white/50">{String(doc.fecha).slice(0, 10)}</span> : null}
          </p>
        </div>
        <Link href={`/data-analisis?area=directo&partido=${ultimo}`} className="inline-flex items-center gap-1 text-xs font-semibold text-white/70 hover:text-white">
          Verlo entero con los mapas
          <ArrowRight size={13} aria-hidden />
        </Link>
      </div>
      <div className="mb-3 grid gap-2 px-1 sm:grid-cols-[1.4fr_repeat(3,1fr)]">
        <p className="self-center text-sm font-semibold leading-snug text-[#E3C27E]">{lectura}</p>
        {cifras.map(([t, a, b]) => (
          <div key={t} className="rounded-xl border border-white/10 bg-white/[0.03] px-3 py-1.5">
            <p className="text-xs uppercase tracking-[0.12em] text-white/50">{t}</p>
            <p className="font-mono text-lg font-bold tabular-nums text-white">
              {a} <span className="text-white/40">–</span> {b}
            </p>
          </div>
        ))}
      </div>
      <RelievePartido eventos={doc.eventos} a={eq(x)} b={eq(y)} partido={ultimo} />
    </section>
  );
}
