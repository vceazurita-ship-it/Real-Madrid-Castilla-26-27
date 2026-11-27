"use client";

/*
| ENLACES DE UN JUGADOR (16/11/2026, ronda 18 de expertos).
|
| «De cualquier jugador a su ficha, su seguimiento, sus valoraciones, su Data
| análisis y sus vídeos, con el jugador ya elegido.» Una sola pieza para todas
| las pantallas del área Jugador: listas, avisos, rankings y gráficos.
|
| Las direcciones son las que ya entienden las pantallas:
|  - /individual?player=ID&pestana=…  (o ?nombre= si sólo hay nombre: se casa
|    con `mismoJugador`, apellido + inicial)
|  - /individual?player=ID&pestana=seguimiento&nuevo=seguimiento  abre el
|    formulario de «Nuevo seguimiento» con el jugador ya elegido
|  - /data-analisis?area=individual&jugador=NOMBRE (PanelIndividual)
|  - /comparative_ind?jugador=NOMBRE
|  - /calendar?player=ID
|  - /individual_proc?player=ID  (Dashboard Seguimiento, ya filtrado)
*/

import Link from "next/link";
import { BarChart3, CalendarDays, ClipboardList, LayoutDashboard, PlusCircle, Star, UserRound, Video, Scale } from "lucide-react";
import type { ReactNode } from "react";

export type DestinoJugador =
  | "ficha"
  | "seguimiento"
  | "registrar"
  | "valoraciones"
  | "videos"
  | "data"
  | "comparativa"
  | "calendario"
  /** /individual_proc con el jugador ya filtrado (20/11/2026, ronda 5). */
  | "dashboard"
  /** /ratings con sus notas abiertas (17/11/2026, ronda 19). */
  | "notas";

export interface JugadorEnlazable {
  /** ID vigente de la hoja JUGADORES (JUG-XX). Sin él, se va por nombre. */
  id?: string | null;
  nombre: string;
}

const enc = encodeURIComponent;

/** La dirección de un destino para un jugador. */
export function hrefJugador(destino: DestinoJugador, j: JugadorEnlazable): string {
  const ficha = j.id ? `/individual?player=${enc(j.id)}` : `/individual?nombre=${enc(j.nombre)}`;

  switch (destino) {
    case "ficha":
      return ficha;
    case "seguimiento":
      return `${ficha}&pestana=seguimiento`;
    case "registrar":
      return `${ficha}&pestana=seguimiento&nuevo=seguimiento`;
    case "valoraciones":
      return `${ficha}&pestana=valoraciones`;
    case "videos":
      return `${ficha}&pestana=videos`;
    case "data":
      return `/data-analisis?area=individual&jugador=${enc(j.nombre)}`;
    case "comparativa":
      return `/comparative_ind?jugador=${enc(j.nombre)}`;
    case "calendario":
      return j.id ? `/calendar?player=${enc(j.id)}` : `/calendar`;
    case "dashboard":
      /* Con el nombre también: el Dashboard casa por nombre antes que por ID
         (la lista de /individual y la hoja no siempre dan el mismo JUG-XX). */
      return `/individual_proc?${j.id ? `player=${enc(j.id)}&` : ""}jugador=${enc(j.nombre)}`;
    case "notas":
      return j.id ? `/ratings?player=${enc(j.id)}` : `/ratings?jugador=${enc(j.nombre)}`;
  }
}

const ROTULO: Record<DestinoJugador, { label: string; icono: ReactNode; titulo: string }> = {
  ficha: { label: "Ficha", icono: <UserRound size={12} aria-hidden />, titulo: "Abrir su ficha" },
  seguimiento: { label: "Seguimiento", icono: <ClipboardList size={12} aria-hidden />, titulo: "Sus seguimientos, en su ficha" },
  registrar: { label: "Registrar seguimiento", icono: <PlusCircle size={12} aria-hidden />, titulo: "Nuevo seguimiento con el jugador ya elegido" },
  valoraciones: { label: "Valoraciones", icono: <Star size={12} aria-hidden />, titulo: "Sus notas partido a partido" },
  videos: { label: "Vídeos", icono: <Video size={12} aria-hidden />, titulo: "Sus vídeos" },
  data: { label: "Data análisis", icono: <BarChart3 size={12} aria-hidden />, titulo: "Sus datos de Wyscout y Opta" },
  comparativa: { label: "Comparativa", icono: <Scale size={12} aria-hidden />, titulo: "Contra la categoría, en su puesto" },
  notas: { label: "Notas", icono: <Star size={12} aria-hidden />, titulo: "Sus notas en Valoraciones, con él ya abierto" },
  dashboard: { label: "Dashboard Seguimiento", icono: <LayoutDashboard size={12} aria-hidden />, titulo: "Su seguimiento en el Dashboard Seguimiento, ya filtrado" },
  calendario: { label: "Calendario", icono: <CalendarDays size={12} aria-hidden />, titulo: "Su seguimiento en el calendario" },
};

export const DESTINOS_HABITUALES: DestinoJugador[] = ["ficha", "seguimiento", "valoraciones", "data", "videos"];

/**
 * Fila de accesos de un toque. `destinos` decide cuáles y en qué orden;
 * `compacto` deja sólo los iconos (con su rótulo al pasar el ratón y para
 * el lector de pantalla), para filas de tabla y chips.
 */
export function EnlacesJugador({
  jugador,
  destinos = DESTINOS_HABITUALES,
  compacto = false,
  soloIconos = false,
  rotuloAncho = false,
  mas = [],
  extraMas,
  className = "",
}: {
  jugador: JugadorEnlazable;
  destinos?: DestinoJugador[];
  compacto?: boolean;
  /** Sólo iconos en todos los anchos (tarjetas estrechas); el rótulo, al pasar el ratón y para el lector. */
  soloIconos?: boolean;
  /** Con `compacto`: el rótulo también se ve desde pantalla ancha (lg); en el móvil, sólo el icono. */
  rotuloAncho?: boolean;
  /**
   * 27/11/2026 (ronda 11 de expertos): destinos secundarios, plegados tras un
   * chip «Más» que se abre en el sitio (sin capa flotante, para que no lo
   * recorte una tarjeta estrecha). Sin `mas` ni `extraMas`, todo como antes.
   */
  mas?: DestinoJugador[];
  /** Algo más dentro de «Más» (p. ej. un botón propio de la pantalla). */
  extraMas?: ReactNode;
  className?: string;
}) {
  if (!jugador.nombre && !jugador.id) return null;

  return (
    /* 17/11/2026 (ronda 19): con «hidden sm:inline-flex» la base
       «inline-flex» ganaba en el CSS y los iconos salían igual en el móvil,
       doblando el alto de cada fila. Si la clase trae «hidden», manda ella. */
    <span className={`${/(^|\s)hidden(\s|$)/.test(className) ? "" : "inline-flex"} flex-wrap items-center gap-1 ${className}`}>
      {destinos.map((d) => {
        const r = ROTULO[d];
        const principal = d === "registrar";

        return (
          <Link
            key={d}
            href={hrefJugador(d, jugador)}
            title={`${r.titulo} · ${jugador.nombre}`}
            aria-label={`${r.label} de ${jugador.nombre}`}
            onClick={(e) => e.stopPropagation()}
            /* 20/11/2026 (ronda 5): sólo con icono, 36 px de dedo en el móvil. */
            className={`inline-flex ${soloIconos ? "min-h-[36px] min-w-[36px] justify-center sm:min-h-[26px] sm:min-w-0" : "min-h-[26px]"} items-center gap-1 rounded-full border px-2 py-0.5 text-[11px] font-semibold transition ${
              principal
                ? "border-[#C8A96B]/50 bg-[#C8A96B]/15 text-[#C8A96B] hover:bg-[#C8A96B]/25"
                : "border-white/10 bg-white/[0.03] text-white/70 hover:text-white"
            }`}
          >
            {r.icono}
            {/* 17/11/2026 (ronda 20, jueces): con `rotuloAncho`, el compacto lleva su rótulo («Ficha», «Vídeos»…) en pantalla ancha; en el móvil, sólo el icono. */}
            {(soloIconos || compacto) && !principal ? (
              <span className={rotuloAncho && !soloIconos ? "sr-only lg:not-sr-only" : "sr-only"}>{r.label}</span>
            ) : (
              <span>{r.label}</span>
            )}
          </Link>
        );
      })}
      {(mas.length > 0 || extraMas) && (
        <details className="group inline-block max-w-full align-middle" onClick={(e) => e.stopPropagation()}>
          <summary
            className="inline-flex min-h-[26px] cursor-pointer list-none items-center gap-1 rounded-full border border-white/10 bg-white/[0.03] px-2 py-0.5 text-[11px] font-semibold text-white/70 transition hover:text-white [&::-webkit-details-marker]:hidden"
            aria-label={`Más accesos de ${jugador.nombre}`}
          >
            Más
            <span aria-hidden className="transition group-open:rotate-180">▾</span>
          </summary>
          <span className="mt-1 flex w-full flex-wrap items-center gap-1">
            {mas.map((d) => {
              const r = ROTULO[d];

              return (
                <Link
                  key={d}
                  href={hrefJugador(d, jugador)}
                  title={`${r.titulo} · ${jugador.nombre}`}
                  aria-label={`${r.label} de ${jugador.nombre}`}
                  onClick={(e) => e.stopPropagation()}
                  className="inline-flex min-h-[26px] items-center gap-1 rounded-full border border-white/10 bg-white/[0.03] px-2 py-0.5 text-[11px] font-semibold text-white/70 transition hover:text-white"
                >
                  {r.icono}
                  <span>{r.label}</span>
                </Link>
              );
            })}
            {extraMas}
          </span>
        </details>
      )}
    </span>
  );
}

/** Un nombre de jugador que abre su ficha (para listas, podios y avisos). */
export function NombreJugador({
  jugador,
  className = "",
  children,
}: {
  jugador: JugadorEnlazable;
  className?: string;
  children?: ReactNode;
}) {
  return (
    <Link
      href={hrefJugador("ficha", jugador)}
      title={`Abrir la ficha de ${jugador.nombre}`}
      onClick={(e) => e.stopPropagation()}
      className={`underline-offset-2 transition hover:text-[#C8A96B] hover:underline ${className}`}
    >
      {children ?? jugador.nombre}
    </Link>
  );
}
