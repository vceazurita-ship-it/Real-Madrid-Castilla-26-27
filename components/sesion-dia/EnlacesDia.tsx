"use client";

/**
 * Los tres sitios de un mismo entrenamiento, enlazados (24/10/2026): el
 * microciclo, Jugadores sesión y el análisis de entrenamiento, para la misma
 * fecha. La pantalla en la que se está no sale. Ver lib/sesion-dia/conexion.ts.
 */

import Link from "next/link";
import { CalendarRange, ClipboardCheck, Users } from "lucide-react";

import { enlaceAnalisis, enlaceMicro, enlaceSesion } from "@/lib/sesion-dia/conexion";

const ENLACE =
  "inline-flex min-w-0 items-center gap-1.5 rounded-lg border border-white/12 px-2.5 py-1 text-[11px] font-medium text-white/70 transition hover:border-[#C8A96B]/50 hover:text-white focus-visible:outline focus-visible:outline-2 focus-visible:outline-[#C8A96B]";

export function EnlacesDia({
  fecha,
  micro,
  actual,
  textos = {},
}: {
  fecha: string;
  /** El número del microciclo, si se sabe: abre /microcycles en él. */
  micro?: number | null;
  actual: "microciclo" | "sesion" | "analisis";
  /** Para cambiar la etiqueta según lo que haya («Hacer los equipos» si aún no hay sesión). */
  textos?: Partial<Record<"microciclo" | "sesion" | "analisis", string>>;
}) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(fecha)) return null;

  return (
    <nav aria-label="Este día en las otras pantallas" className="flex min-w-0 flex-wrap items-center gap-1.5">
      {actual !== "microciclo" && (
        <Link href={enlaceMicro(micro)} className={ENLACE} title="El microciclo de este día">
          <CalendarRange size={12} className="shrink-0 text-[#C8A96B]" aria-hidden />
          <span className="truncate">{textos.microciclo ?? (micro ? `Microciclo ${micro}` : "Microciclo")}</span>
        </Link>
      )}
      {actual !== "sesion" && (
        <Link href={enlaceSesion(fecha)} className={ENLACE} title="Los equipos de cada tarea de este día">
          <Users size={12} className="shrink-0 text-[#C8A96B]" aria-hidden />
          <span className="truncate">{textos.sesion ?? "Jugadores sesión"}</span>
        </Link>
      )}
      {actual !== "analisis" && (
        <Link href={enlaceAnalisis(fecha)} className={ENLACE} title="Los objetivos medidos en el vídeo de este día">
          <ClipboardCheck size={12} className="shrink-0 text-[#C8A96B]" aria-hidden />
          <span className="truncate">{textos.analisis ?? "Análisis del entreno"}</span>
        </Link>
      )}
    </nav>
  );
}
