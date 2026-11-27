"use client";

/*
| A UN TOQUE (16/11/2026, expertos, ronda 18): la fila de enlaces que lleva de
| una pantalla de análisis a lo que la completa, con el partido, el rival o el
| jugador ya elegidos (robos ↔ pérdidas ↔ faltas ↔ post del partido, goles en
| vídeo, ABP del rival, plan, ficha del jugador). Sólo se pintan los enlaces
| que traen `href`: lo que no existe no se nombra.
|
| 18/11/2026: un enlace con `golesEnVideo` es un botón que abre el pop-up de
| los goles (components/rivals/BotonGolesEnVideo.tsx), sin salir de la
| pantalla; no necesita `href`.
*/

import Link from "next/link";
import type { LucideIcon } from "lucide-react";
import { ArrowUpRight } from "lucide-react";

import { BotonGolesEnVideo, type GolesEnVideo } from "@/components/rivals/BotonGolesEnVideo";

export type EnlaceRapido = {
  href?: string | null;
  texto: string;
  title?: string;
  icono?: LucideIcon;
  /** Abre el pop-up de los goles en vídeo con el equipo (y el partido) ya puestos. */
  golesEnVideo?: GolesEnVideo | null;
};

const CHIP =
  "inline-flex min-h-9 min-w-0 max-w-full items-center gap-1.5 rounded-full border border-white/15 bg-white/[0.04] px-3 py-1.5 text-xs font-semibold text-white/80 transition hover:border-[#C8A96B]/50 hover:text-white";

export function EnlacesRapidos({
  enlaces,
  titulo = "A un toque",
  className = "",
  aLaVista,
}: {
  enlaces: EnlaceRapido[];
  titulo?: string;
  className?: string;
  /**
   * 27/11/2026 (jueces, ronda 10): cuántos chips se ven; el resto va plegado
   * en «Más (n)». Sin él, se ven todos, como siempre.
   */
  aLaVista?: number;
}) {
  const visibles = enlaces.filter((e) => Boolean(e.href) || Boolean(e.golesEnVideo?.equipo));
  if (visibles.length === 0) return null;
  /* Plegar uno solo no ahorra nada: se pliega a partir de dos. */
  const corte = aLaVista !== undefined && visibles.length - aLaVista >= 2 ? aLaVista : visibles.length;
  const delante = visibles.slice(0, corte);
  const plegados = visibles.slice(corte);
  const pinta = (e: EnlaceRapido) => {
    const Icono = e.icono ?? ArrowUpRight;
    const contenido = (
      <>
        <Icono size={13} aria-hidden className="shrink-0 text-[#C8A96B]" />
        <span className="min-w-0 truncate">{e.texto}</span>
      </>
    );
    if (e.golesEnVideo) {
      return (
        <BotonGolesEnVideo key={`goles|${e.texto}`} {...e.golesEnVideo} title={e.title} className={CHIP}>
          {contenido}
        </BotonGolesEnVideo>
      );
    }
    return (
      <Link key={`${e.href}|${e.texto}`} href={e.href ?? ""} title={e.title} className={CHIP}>
        {contenido}
      </Link>
    );
  };
  if (plegados.length > 0) {
    return (
      <nav aria-label={titulo} className={`flex min-w-0 flex-wrap items-center gap-1.5 ${className}`}>
        <span className="mr-1 text-[11px] font-semibold uppercase tracking-[0.14em] text-white/50">{titulo}</span>
        {delante.map(pinta)}
        <details className="group min-w-0 open:basis-full">
          <summary className={`${CHIP} cursor-pointer list-none [&::-webkit-details-marker]:hidden`}>
            <span className="group-open:hidden">Más ({plegados.length})</span>
            <span className="hidden group-open:inline">Menos</span>
          </summary>
          <div className="mt-1.5 flex min-w-0 flex-wrap gap-1.5">{plegados.map(pinta)}</div>
        </details>
      </nav>
    );
  }
  return (
    <nav aria-label={titulo} className={`flex min-w-0 flex-wrap items-center gap-1.5 ${className}`}>
      <span className="mr-1 text-[11px] font-semibold uppercase tracking-[0.14em] text-white/50">{titulo}</span>
      {visibles.map((e) => {
        const Icono = e.icono ?? ArrowUpRight;
        const contenido = (
          <>
            <Icono size={13} aria-hidden className="shrink-0 text-[#C8A96B]" />
            <span className="min-w-0 truncate">{e.texto}</span>
          </>
        );
        if (e.golesEnVideo) {
          return (
            <BotonGolesEnVideo key={`goles|${e.texto}`} {...e.golesEnVideo} title={e.title} className={CHIP}>
              {contenido}
            </BotonGolesEnVideo>
          );
        }
        return (
          <Link key={`${e.href}|${e.texto}`} href={e.href ?? ""} title={e.title} className={CHIP}>
            {contenido}
          </Link>
        );
      })}
    </nav>
  );
}
