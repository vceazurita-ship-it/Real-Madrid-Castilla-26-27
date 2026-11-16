"use client";

/*
| ENLACES DEL RIVAL (16/11/2026, ronda 18 de jueces: «desde cada pantalla, a
| un toque, lo que la completa, con el rival ya elegido»).
|
| Una fila de accesos con el rival puesto: su ABP (/scout-rival-abp?equipo=),
| sus goles en vídeo y cómo le marcan (/analisis-goles, lib/rivals/goles-en-
| video.ts), su plan de partido y su pizarra de ABP (las dos por el ID de la
| hoja RIVALES, que no siempre se tiene: sin ID no salen). Lo que no tiene
| llave no se nombra.
*/

import Link from "next/link";
import { ClipboardList, Film, Presentation, Shield, ShieldAlert } from "lucide-react";
import type { ReactNode } from "react";

import { urlGolesDelEquipo } from "@/lib/rivals/goles-en-video";

export type EnlaceDelRival = "abp" | "goles" | "encaja" | "plan" | "pizarra";

export function EnlacesDelRival({
  equipo,
  rivalId,
  incluye = ["abp", "goles", "encaja", "plan", "pizarra"],
  className = "",
  rotulo,
}: {
  equipo: string;
  /** El ID de la hoja RIVALES (`RIV-NN`), sin el prefijo `riv-`. */
  rivalId?: string;
  incluye?: EnlaceDelRival[];
  className?: string;
  /** Lo que va delante de los enlaces (p. ej. «Real Murcia»). */
  rotulo?: ReactNode;
}) {
  const nombre = equipo.trim();
  if (!nombre) return null;
  const id = (rivalId ?? "").replace(/^riv-/i, "").trim();

  const enlaces: { clave: EnlaceDelRival; href: string; texto: string; icono: ReactNode }[] = [
    { clave: "abp" as const, href: `/scout-rival-abp?equipo=${encodeURIComponent(nombre)}`, texto: "Su ABP", icono: <Shield size={13} aria-hidden /> },
    { clave: "goles" as const, href: urlGolesDelEquipo(nombre, "favor"), texto: "▶ Sus goles en vídeo", icono: <Film size={13} aria-hidden /> },
    { clave: "encaja" as const, href: urlGolesDelEquipo(nombre, "contra"), texto: "▶ Cómo le marcan", icono: <ShieldAlert size={13} aria-hidden /> },
    ...(id
      ? [
          { clave: "plan" as const, href: `/match-preparation?rival=${encodeURIComponent(id)}`, texto: "Plan de partido", icono: <ClipboardList size={13} aria-hidden /> },
          { clave: "pizarra" as const, href: `/abp-pizarra?rival=${encodeURIComponent(id)}`, texto: "Pizarra ABP", icono: <Presentation size={13} aria-hidden /> },
        ]
      : []),
  ].filter((uno) => incluye.includes(uno.clave));

  if (!enlaces.length) return null;

  return (
    <nav aria-label={`Lo que completa esta pantalla: ${nombre}`} className={`flex min-w-0 flex-wrap items-center gap-1.5 ${className}`}>
      {rotulo ? <span className="mr-1 min-w-0 text-[11px] font-semibold uppercase tracking-[0.16em] text-white/55">{rotulo}</span> : null}
      {enlaces.map((uno) => (
        <Link
          key={uno.clave}
          href={uno.href}
          className="inline-flex min-h-9 items-center gap-1.5 rounded-full border border-sky-400/35 bg-sky-400/10 px-3 py-1 text-xs font-semibold text-sky-300 transition hover:bg-sky-400/20 max-sm:min-h-11"
        >
          {uno.icono}
          {uno.texto.replace(/^▶ /, "")}
        </Link>
      ))}
    </nav>
  );
}
