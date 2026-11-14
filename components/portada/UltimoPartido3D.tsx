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
  const eq = (f: Record<string, unknown>) => ({ teamId: String(f.teamId ?? ""), nombre: nom(f), color: String(f.color ?? ""), campo: String(f.campo ?? "") });

  return (
    <section className="rounded-3xl border border-white/10 bg-white/[0.03] p-3 sm:p-4">
      <div className="mb-2 flex flex-wrap items-baseline justify-between gap-2 px-1">
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-white/50">El último partido en 3D</p>
          <p className="text-sm font-semibold text-white">
            {nom(x)} {String(x.Goal ?? "")}-{String(y.Goal ?? "")} {nom(y)}
            {doc.fecha ? <span className="ml-2 text-xs font-normal text-white/50">{String(doc.fecha).slice(0, 10)}</span> : null}
          </p>
        </div>
        <Link href="/data-analisis?area=directo" className="inline-flex items-center gap-1 text-xs font-semibold text-white/70 hover:text-white">
          Verlo entero con los mapas
          <ArrowRight size={13} aria-hidden />
        </Link>
      </div>
      <RelievePartido eventos={doc.eventos} a={eq(x)} b={eq(y)} partido={ultimo} />
    </section>
  );
}
