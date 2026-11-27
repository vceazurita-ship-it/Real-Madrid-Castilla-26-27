"use client";

/*
| ENLACES DEL RIVAL (16/11/2026, ronda 18 de jueces: «desde cada pantalla, a
| un toque, lo que la completa, con el rival ya elegido»).
|
| Una fila de accesos con el rival puesto: su ABP (/scout-rival-abp?equipo=),
| sus goles en vídeo y cómo le marcan (en el pop-up de la portada,
| components/rivals/BotonGolesEnVideo.tsx, 18/11/2026; aparte, «Cómo son sus
| goles ›» lleva a /analisis-goles), su plan de partido y su pizarra de ABP (las dos por el ID de la
| hoja RIVALES, que no siempre se tiene: sin ID no salen). Lo que no tiene
| llave no se nombra.
*/

import Link from "next/link";
import { CalendarDays, ClipboardList, Film, Presentation, Shield, ShieldAlert } from "lucide-react";
import type { ReactNode } from "react";

import { BotonGolesEnVideo, EnlaceComoSonSusGoles } from "@/components/rivals/BotonGolesEnVideo";
import type { LadoGoles } from "@/lib/rivals/goles-en-video";

const CLASE =
  "inline-flex min-h-9 items-center gap-1.5 rounded-full border border-sky-400/35 bg-sky-400/10 px-3 py-1 text-xs font-semibold text-sky-300 transition hover:bg-sky-400/20 max-sm:min-h-11";

/** 27/11/2026 (ronda 11): el mismo aspecto para los botones que la pantalla añade a la fila. */
export const CLASE_ENLACE_RIVAL = CLASE;

/* 27/11/2026 (ronda 11, Pizarra ABP): «microciclo», el microciclo de ABP de la semana; sólo sale si se pide en `incluye`. */
export type EnlaceDelRival = "abp" | "goles" | "encaja" | "plan" | "pizarra" | "microciclo";

export function EnlacesDelRival({
  equipo,
  rivalId,
  incluye = ["abp", "goles", "encaja", "plan", "pizarra"],
  className = "",
  rotulo,
  extra,
}: {
  equipo: string;
  /** El ID de la hoja RIVALES (`RIV-NN`), sin el prefijo `riv-`. */
  rivalId?: string;
  incluye?: EnlaceDelRival[];
  className?: string;
  /** Lo que va delante de los enlaces (p. ej. «Real Murcia»). */
  rotulo?: ReactNode;
  /** 27/11/2026 (ronda 11): botones propios de la pantalla que van en la misma fila (p. ej. «Quién marca a quién»). */
  extra?: ReactNode;
}) {
  const nombre = equipo.trim();
  if (!nombre) return null;
  const id = (rivalId ?? "").replace(/^riv-/i, "").trim();

  const enlaces: { clave: EnlaceDelRival; href: string; texto: string; icono: ReactNode; lado?: LadoGoles }[] = [
    { clave: "abp" as const, href: `/scout-rival-abp?equipo=${encodeURIComponent(nombre)}`, texto: "Su ABP", icono: <Shield size={13} aria-hidden /> },
    { clave: "goles" as const, href: "", lado: "favor" as const, texto: "▶ Sus goles en vídeo", icono: <Film size={13} aria-hidden /> },
    { clave: "encaja" as const, href: "", lado: "contra" as const, texto: "▶ Cómo le marcan", icono: <ShieldAlert size={13} aria-hidden /> },
    ...(id
      ? [
          { clave: "plan" as const, href: `/match-preparation?rival=${encodeURIComponent(id)}`, texto: "Plan de partido", icono: <ClipboardList size={13} aria-hidden /> },
          { clave: "pizarra" as const, href: `/abp-pizarra?rival=${encodeURIComponent(id)}`, texto: "Pizarra ABP", icono: <Presentation size={13} aria-hidden /> },
        ]
      : []),
    { clave: "microciclo" as const, href: "/abp-microciclo", texto: "Microciclo ABP", icono: <CalendarDays size={13} aria-hidden /> },
  ].filter((uno) => incluye.includes(uno.clave));

  if (!enlaces.length) return null;

  return (
    <nav aria-label={`Lo que completa esta pantalla: ${nombre}`} className={`flex min-w-0 flex-wrap items-center gap-1.5 ${className}`}>
      {rotulo ? <span className="mr-1 min-w-0 text-[11px] font-semibold uppercase tracking-[0.16em] text-white/55">{rotulo}</span> : null}
      {enlaces.map((uno) =>
        /* 18/11/2026: los goles se ven en el pop-up, sin salir de la pantalla. */
        uno.lado ? (
          <BotonGolesEnVideo key={uno.clave} equipo={nombre} lado={uno.lado} className={CLASE}>
            {uno.icono}
            {uno.texto.replace(/^▶ /, "")}
          </BotonGolesEnVideo>
        ) : (
          <Link key={uno.clave} href={uno.href} className={CLASE}>
            {uno.icono}
            {uno.texto.replace(/^▶ /, "")}
          </Link>
        ),
      )}
      {extra}
      {enlaces.some((uno) => uno.lado) && <EnlaceComoSonSusGoles equipo={nombre} />}
    </nav>
  );
}
