"use client";

/*
| LAS PIEZAS DE LA SALA DE PARTIDO (24/11/2026). Todo en SVG y HTML, con
| colores fijos: la sala es oscura en los dos temas (va dentro de
| `siempre-oscuro`), como una sala de control. Cuentas en lib/sala/modelo.ts.
|
| REVISIÓN DEL 26/11/2026 (el analista: «algo top top top, que suban 2 puntos
| los expertos»; notas de partida: comunicación 7, fútbol 6, análisis 6):
| - El partido en una frase bajo el marcador, con los goles (minuto, autor,
|   xG), las tarjetas y los cambios; al final, el «resultado justo» por xG.
| - Letra mínima de 12 px y grises más claros (desde el palco no se leía).
| - Campo plano (la perspectiva deformaba los tamaños), con leyenda, filtro por
|   equipo, ficha del remate al tocarlo y una capa nueva: por dónde llega cada uno.
| - Avisos con jerarquía: uno grande y el resto en lista, con minuto y ventana.
| - Cara a cara con la diferencia frente a su media (y de cuántos partidos), sin
|   las cifras que no cuadran con Opta; PPDA y a puerta ajustados a la oficial.
| - Nuevos: tramos de 15′, balón parado y transiciones, jugadores de cada equipo
|   y la lectura del tramo (descanso, final o la parte elegida).
|
| 26/11/2026, tarde (el analista: «el mapa quedaría mejor como mapa de calor,
| como en las huellas»): la capa «Territorio» de rectángulos pasa a «Mapa de
| calor» continuo (la misma densidad suavizada ~6 m que la huella táctica y el
| directo, lib/opta-directo-mapas.ts). Con los dos equipos, quién domina cada
| zona; con uno, dónde toca él. El remate elegido ya no salta a otro al cambiar
| de equipo o de tramo, y «ataca…» se lee en el móvil.
*/

import { useMemo, useState, type ReactNode } from "react";
import Link from "next/link";
import { AlertTriangle, ArrowLeftRight, Flame, Zap } from "lucide-react";

import { VideoOpta } from "@/components/opta/VideoOpta";

import { MX, MY, densidad } from "@/lib/opta-directo-mapas";
import { type Cruce, type Rumbo } from "@/lib/sala/rumbo";
import {
  DURACION,
  aPuertaDe,
  carriles,
  cifrasEntre,
  detalleAbp,
  curvaProbabilidad,
  curvaXg,
  enArea,
  esAbp,
  jugadoresDe,
  lecturaTramo,
  nombreEquipoCorto,
  oficialEntre,
  porcentaje,
  ppda,
  pulso,
  red,
  reloj,
  tramos15,
  transiciones,
  type Alerta,
  type Calibracion,
  type Cifras,
  type FichaGol,
  type Hito,
  type Lado,
  type Partido,
  type Tiro,
  type TramoClave,
  type Ventana,
} from "@/lib/sala/modelo";

/* ------------------------------------------------------------------ */
/*  PALETA FIJA                                                        */
/* ------------------------------------------------------------------ */

export const S = {
  fondo: "#030812",
  panel: "rgba(14, 26, 48, 0.62)",
  borde: "rgba(120, 170, 255, 0.18)",
  texto: "#EEF4FF",
  /* Más claros que antes (26/11/2026): 0,62/0,38 no se leían desde lejos. */
  suave: "rgba(222, 234, 255, 0.78)",
  tenue: "rgba(214, 228, 255, 0.68)",
  linea: "rgba(150, 190, 255, 0.16)",
  favor: "#2BE3A0",
  aviso: "#FF8A3D",
  info: "#6FB2FF",
  oro: "#E9C46A",
  empate: "rgba(200, 214, 240, 0.45)",
};

const fmt = (v: number | null | undefined, d = 1) => (v == null || !Number.isFinite(v) ? "—" : v.toLocaleString("es-ES", { minimumFractionDigits: d, maximumFractionDigits: d }));
const colorDe = (p: Partido, l: Lado) => (l === "L" ? p.local.color : p.visitante.color);
const cortoDe = (p: Partido, l: Lado) => nombreEquipoCorto(l === "L" ? p.local.nombre : p.visitante.nombre);
const otro = (l: Lado): Lado => (l === "L" ? "V" : "L");

/**
 * A dónde lleva el nombre de un jugador (28/11/2026, los tres jueces): los del
 * Castilla, a su ficha y a su seguimiento; los de un equipo del grupo, a su
 * ficha en /rivals; si no hay ficha que abrir, null (el nombre va sin enlace).
 */
export type EnlaceJugador = (lado: Lado, nombre: string) => { ficha: string; seguimiento?: string } | null;

/** El nombre, con enlace si lo tiene (y el seguimiento al lado, en los nuestros). */
function NombreJugador({ lado, nombre, texto, enlace, color, seguimiento = false }: { lado: Lado; nombre: string; texto: ReactNode; enlace?: EnlaceJugador; color?: string; seguimiento?: boolean }) {
  const e = enlace?.(lado, nombre) ?? null;
  if (!e) return <>{texto}</>;
  return (
    <>
      <Link href={e.ficha} className="underline decoration-dotted underline-offset-2 hover:decoration-solid" style={color ? { color } : undefined} title={`Abrir la ficha de ${nombre}`}>
        {texto}
      </Link>
      {seguimiento && e.seguimiento && (
        <Link href={e.seguimiento} className="ml-1.5 whitespace-nowrap text-[11px] font-semibold underline decoration-dotted underline-offset-2" style={{ color: S.tenue }} title={`Seguimiento de ${nombre}`}>
          seguimiento
        </Link>
      )}
    </>
  );
}

export function Panel({ titulo, detalle, children, className = "", derecha, id }: { titulo: string; detalle?: ReactNode; children: ReactNode; className?: string; derecha?: ReactNode; id?: string }) {
  return (
    <section
      id={id}
      className={`relative min-w-0 scroll-mt-28 overflow-hidden rounded-2xl p-4 sm:p-5 sala-entra ${className}`}
      style={{ background: S.panel, border: `1px solid ${S.borde}`, boxShadow: "inset 0 1px 0 rgba(255,255,255,0.04), 0 20px 60px -30px rgba(0,0,0,0.8)", backdropFilter: "blur(10px)" }}
    >
      <div aria-hidden className="pointer-events-none absolute inset-x-0 top-0 h-px" style={{ background: "linear-gradient(90deg, transparent, rgba(120,190,255,0.55), transparent)" }} />
      <header className="mb-3 flex min-w-0 flex-wrap items-start justify-between gap-x-3 gap-y-2">
        <div className="min-w-0">
          <h2 className="fuente-club flex items-center gap-2 text-[17px] uppercase tracking-[0.16em]" style={{ color: S.texto }}>
            <span aria-hidden className="inline-block h-4 w-[3px] shrink-0 rounded-full" style={{ background: S.oro }} />
            {titulo}
          </h2>
          {detalle && (
            <p className="mt-0.5 max-w-[60ch] text-[12px] leading-snug" style={{ color: S.tenue }}>
              {detalle}
            </p>
          )}
        </div>
        {derecha}
      </header>
      {children}
    </section>
  );
}

/** Un botón de pastilla (capas, tramos, filtros). */
function Pastilla({ activa, onClick, children, desactivada, titulo }: { activa: boolean; onClick: () => void; children: ReactNode; desactivada?: boolean; titulo?: string }) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={desactivada}
      aria-pressed={activa}
      title={titulo}
      className="min-h-[32px] shrink-0 whitespace-nowrap rounded-full px-3 py-1 text-[12px] font-semibold transition disabled:cursor-not-allowed disabled:opacity-35"
      style={{ background: activa ? "rgba(120,190,255,0.22)" : "rgba(255,255,255,0.04)", color: activa ? S.texto : S.suave, border: `1px solid ${activa ? "rgba(120,190,255,0.65)" : S.borde}` }}
    >
      {children}
    </button>
  );
}

/* ------------------------------------------------------------------ */
/*  MARCADOR                                                           */
/* ------------------------------------------------------------------ */

export type Titular = { texto: string; clave: string; detalle: string };

export function Marcador({
  p,
  t,
  c,
  modo,
  parte,
  prob,
  justo,
  titular,
  hitos,
  fichas,
  k,
  aviso,
  enlace,
  conVideo = false,
}: {
  p: Partido;
  t: number;
  c: { L: Cifras; V: Cifras };
  modo: "vivo" | "repeticion" | "final";
  parte: number;
  prob: { L: number; X: number; V: number };
  justo: { L: number; X: number; V: number };
  titular: Titular;
  hitos: Hito[];
  fichas: FichaGol[];
  k: Calibracion;
  /** Aviso en la cabecera del marcador (27/11/2026: «dominamos en xG y el marcador no lo refleja»). */
  aviso?: ReactNode;
  enlace?: EnlaceJugador;
  /** «▶ Ver gol» con el corte de Opta ya en B2 (sólo Primera RFEF). */
  conVideo?: boolean;
}) {
  /* El apellido para el móvil; la propia puerta conserva su marca («Cestero (p. p.)» salía «p.)»). */
  const ultimoNombre = (n: string) => {
    const PP = / \(p\. p\.\)$/;
    const pp = PP.test(n);
    const limpio = n.replace(PP, "");
    return `${limpio.split(" ").slice(-1)[0] ?? limpio}${pp ? " (p.p.)" : ""}`;
  };
  const avance = Math.min(1, t / DURACION);
  const R = 34;
  const circ = 2 * Math.PI * R;
  const final = modo === "final";
  const marcas = hitos.filter((h) => h.tipo === "gol" || h.tipo === "amarilla" || h.tipo === "roja" || h.tipo === "cambio");

  const equipo = (l: Lado) => {
    const e = l === "L" ? p.local : p.visitante;
    const yo = l === "L" ? c.L : c.V;
    const color = e.color;
    /* Los goles siempre (el 26/11 los cinco cambios del Murcia los echaban de la lista).
       28/11/2026 (jueces de estilo): ya no hay tope de 7, que dejaba fuera el cambio del 84′ que
       «Cómo se movió el partido» sí nombraba (las dos piezas leen las mismas marcas de Opta). Para que
       quepa, con 3 amarillas o más van todas en una sola línea. */
    const delLado = marcas.filter((h) => h.lado === l);
    const amarillas = delLado.filter((h) => h.tipo === "amarilla");
    const juntas = amarillas.length >= 3;
    const suyas = delLado.filter((h) => !(juntas && h.tipo === "amarilla"));
    const derecha = l === "L";
    return (
      <div className={`flex min-w-0 flex-col ${derecha ? "items-end text-right" : "items-start text-left"}`}>
        {/* En el móvil, el nombre corto (CASTILLA / MURCIA); en pantalla grande, el entero. */}
        <span className="fuente-club max-w-full text-[clamp(20px,2.8vw,38px)] uppercase leading-[1.02] tracking-[0.04em]" style={{ color: S.texto, textShadow: `0 0 24px ${color}66` }}>
          <span className="sm:hidden">{cortoDe(p, l)}</span>
          <span className="hidden sm:block">
            <span className="line-clamp-2 break-words">{e.nombre}</span>
          </span>
        </span>
        <span className="mt-2 h-1 w-20 rounded-full sm:w-28" style={{ background: `linear-gradient(90deg, ${derecha ? "transparent" : color}, ${derecha ? color : "transparent"})`, boxShadow: `0 0 18px ${color}` }} />
        <span className="mt-2 flex flex-wrap items-center gap-1.5 font-mono text-[12px] tabular-nums sm:text-[13px]" style={{ color: S.suave, justifyContent: derecha ? "flex-end" : "flex-start" }}>
          <b className="rounded-md px-1.5 py-0.5 text-[14px] sm:text-[16px]" style={{ background: `${color}22`, color: S.texto, border: `1px solid ${color}55` }}>
            xG {fmt(yo.xg, 2)}
          </b>
          {/* Dos trozos que no se parten por dentro (en el móvil salía «3 a / puerta»). */}
          <span className="whitespace-nowrap">{yo.tiros} rem.</span>
          <span className="whitespace-nowrap">· {aPuertaDe(yo, l === "L" ? k.aPuerta?.L : k.aPuerta?.V)} a puerta</span>
        </span>
        {/* Goles, tarjetas y cambios (estos dos, en los documentos desde el 26/11/2026). */}
        {(suyas.length > 0 || juntas) && (
          <ul className={`mt-2 grid gap-0.5 text-[12px] sm:text-[13px] ${derecha ? "justify-items-end" : ""}`} style={{ color: S.suave }}>
            {suyas.map((h, i) => (
              <li key={i} className="flex max-w-full items-center gap-1 truncate sm:gap-1.5">
                {h.tipo === "gol" ? <span aria-label="Gol">⚽</span> : h.tipo === "amarilla" ? <span aria-label="Amarilla" className="inline-block h-3 w-2 rounded-[2px]" style={{ background: "#F5D547" }} /> : h.tipo === "roja" ? <span aria-label="Roja" className="inline-block h-3 w-2 rounded-[2px]" style={{ background: "#FF3B4E" }} /> : <ArrowLeftRight size={12} aria-label="Cambio" />}
                <span className="shrink-0 font-mono text-[11px] tabular-nums sm:text-[13px]" style={{ color: S.texto }}>
                  {reloj(h.min, h.parte)}
                </span>
                {/* En el móvil sólo el apellido («Ciria», no «Ciria po…»). */}
                <span className="min-w-0 truncate sm:hidden">{h.tipo === "cambio" ? ultimoNombre(h.entra ?? "?") : ultimoNombre(h.jugador)}</span>
                <span className="hidden truncate sm:inline">
                  {h.tipo === "cambio" ? `${h.entra ?? "?"} por ${h.jugador}` : h.jugador}
                  {h.tipo === "gol" && h.xG != null ? <span style={{ color: S.tenue }}> · xG {fmt(h.xG, 2)}</span> : null}
                </span>
              </li>
            ))}
            {juntas && (
              <li className="flex max-w-full items-center gap-1 truncate sm:gap-1.5" title={amarillas.map((h) => `${reloj(h.min, h.parte)} ${h.jugador}`).join(" · ")}>
                <span aria-label="Amarillas" className="inline-block h-3 w-2 rounded-[2px]" style={{ background: "#F5D547" }} />
                <span className="min-w-0 truncate font-mono text-[11px] tabular-nums sm:text-[13px]" style={{ color: S.texto }}>
                  {amarillas.length} amarillas<span className="hidden sm:inline"> · {amarillas.map((h) => reloj(h.min, h.parte)).join(" ")}</span>
                </span>
              </li>
            )}
          </ul>
        )}
      </div>
    );
  };

  /* La barra: en juego, la probabilidad en vivo; al final, el resultado justo por las ocasiones. */
  const barra = final ? justo : prob;
  const partes = titular.texto.split(titular.clave);

  return (
    <section className="relative overflow-hidden rounded-3xl px-3 py-5 sm:px-8 sm:py-6 sala-entra" style={{ background: "radial-gradient(120% 140% at 50% 0%, rgba(40,80,160,0.38), rgba(5,12,26,0.65) 60%)", border: `1px solid ${S.borde}` }}>
      <div aria-hidden className="pointer-events-none absolute inset-0 opacity-40" style={{ background: `linear-gradient(90deg, ${p.local.color}22, transparent 35%, transparent 65%, ${p.visitante.color}22)` }} />
      {modo === "vivo" && <div aria-hidden className="pointer-events-none absolute inset-y-0 left-0 w-1/3 sala-barrido" style={{ background: "linear-gradient(90deg, transparent, rgba(120,190,255,0.06), transparent)" }} />}
      {aviso}
      <div className="relative grid grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] items-start gap-2 sm:gap-8">
        {equipo("L")}
        <div className="flex flex-col items-center">
          <div className="flex items-center gap-2 sm:gap-5">
            <span key={`L${c.L.goles}`} className="fuente-club text-[clamp(56px,9vw,128px)] leading-none tabular-nums sala-destello" style={{ color: S.texto, textShadow: `0 0 30px ${p.local.color}` }}>
              {c.L.goles}
            </span>
            <div className="relative grid place-items-center">
              <svg width="78" height="78" viewBox="0 0 84 84" aria-hidden>
                <circle cx="42" cy="42" r={R} fill="none" stroke={S.linea} strokeWidth="4" />
                <circle cx="42" cy="42" r={R} fill="none" stroke={final ? S.oro : "url(#sala-anillo)"} strokeWidth="4" strokeLinecap="round" strokeDasharray={`${circ * avance} ${circ}`} transform="rotate(-90 42 42)" style={{ transition: "stroke-dasharray .6s ease" }} />
                <defs>
                  <linearGradient id="sala-anillo" x1="0" x2="1">
                    <stop offset="0" stopColor={p.local.color} />
                    <stop offset="1" stopColor={p.visitante.color} />
                  </linearGradient>
                </defs>
              </svg>
              <span className="absolute font-mono text-[17px] font-bold tabular-nums" style={{ color: final ? S.oro : S.texto }}>
                {/* 28/11/2026 (análisis): un solo indicador de estado; el anillo da el minuto y la pastilla dice «Final». */}
                {reloj(final ? Math.max(0, t - 0.01) : t, parte)}
              </span>
            </div>
            <span key={`V${c.V.goles}`} className="fuente-club text-[clamp(56px,9vw,128px)] leading-none tabular-nums sala-destello" style={{ color: S.texto, textShadow: `0 0 30px ${p.visitante.color}` }}>
              {c.V.goles}
            </span>
          </div>
          <span className="mt-2 inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-[11px] font-bold uppercase tracking-[0.2em]" style={{ background: modo === "vivo" ? "rgba(255,60,90,0.16)" : final ? "rgba(233,196,106,0.14)" : "rgba(120,170,255,0.12)", color: modo === "vivo" ? "#FF6B86" : final ? S.oro : S.info, border: `1px solid ${modo === "vivo" ? "rgba(255,80,110,0.45)" : final ? "rgba(233,196,106,0.45)" : S.borde}` }}>
            {modo === "vivo" && <span className="h-1.5 w-1.5 rounded-full sala-latido" style={{ background: "#FF4D6D" }} />}
            {modo === "vivo" ? "En directo" : final ? "Final" : "Repetición"}
          </span>
        </div>
        {equipo("V")}
      </div>

      {/* EL PARTIDO EN UNA FRASE. */}
      <div className="relative mx-auto mt-5 max-w-[46rem] text-center">
        <p className="fuente-club text-[clamp(20px,2.6vw,32px)] leading-tight tracking-[0.02em]" style={{ color: S.texto }}>
          {partes.length > 1 ? (
            <>
              {partes[0]}
              <span style={{ color: S.oro }}>{titular.clave}</span>
              {partes.slice(1).join(titular.clave)}
            </>
          ) : (
            titular.texto
          )}
        </p>
        {titular.detalle && (
          <p className="mt-1 font-mono text-[13px] tabular-nums" style={{ color: S.suave }}>
            {titular.detalle}
          </p>
        )}
        <span aria-hidden className="mx-auto mt-2 block h-[2px] w-24 rounded-full" style={{ background: `linear-gradient(90deg, transparent, ${S.oro}, transparent)` }} />
      </div>

      {/* 28/11/2026 (jueces de estilo): el primer gráfico, la escalera del xG acumulado con los goles. */}
      <EscaleraXg p={p} t={t} hitos={hitos} />

      {/* LA FICHA DE CADA GOL (experto de fútbol): de dónde nace, cuánto tarda y desde dónde se remata. */}
      {fichas.length > 0 && (
        <ul className="relative mx-auto mt-3 grid max-w-[58rem] gap-1.5" aria-label="Cómo llegó cada gol">
          {fichas.map((g, i) => (
            <li key={i} className="rounded-lg px-3 py-1.5 text-[13px] leading-snug sm:text-[14px]" style={{ background: "rgba(255,255,255,0.035)", borderLeft: `3px solid ${colorDe(p, g.lado)}`, color: S.suave }}>
              <span className="font-mono font-bold tabular-nums" style={{ color: S.texto }}>
                ⚽ {reloj(g.min, g.parte)} · {g.marcador}
              </span>{" "}
              <b style={{ color: colorDe(p, g.lado) }}>
                <NombreJugador lado={g.lado} nombre={(g.goleadorId && p.jugadores.get(g.goleadorId)?.nombre) || ""} texto={g.goleador} enlace={g.goleadorId ? enlace : undefined} color={colorDe(p, g.lado)} />
              </b>
              {g.asistente ? <span> (pase de {g.asistente})</span> : null} · {g.origen}{g.zona ? <> · {g.pases} {g.pases === 1 ? "pase" : "pases"} · {g.segundos} s · {g.zona}</> : null}
              {g.xG != null ? <span style={{ color: S.tenue }}> · xG {fmt(g.xG, 2)}</span> : null}
              {/* 28/11/2026 (fútbol): el gol en vídeo, el corte de Opta ya en B2; si no está, no sale. */}
              {conVideo && p.fecha && (
                <span className="ml-2 inline-block align-middle">
                  <VideoOpta evento={{ partido: p.id, fecha: p.fecha.slice(0, 10), parte: g.parte, segundo: Math.round(g.min * 60) }} tipo="shots" etiqueta="▶ Ver gol" soloCorte descripcion={`Gol de ${g.goleador}, ${reloj(g.min, g.parte)}`} />
                </span>
              )}
            </li>
          ))}
        </ul>
      )}

      {/* Probabilidad en vivo o resultado justo: cifras grandes a los lados, barra en medio. */}
      <div className="relative mt-4">
        <p className="mb-1.5 text-center text-[12px] font-semibold uppercase tracking-[0.16em]" style={{ color: S.suave }}>
          {final ? "Resultado justo según las ocasiones (cada remate, gol con la probabilidad de su xG)" : "Probabilidad de cada resultado ahora"}
        </p>
        <div className="grid grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-2 sm:gap-3">
          <span className="text-right">
            <span className="block font-mono text-[clamp(18px,2.2vw,28px)] font-bold tabular-nums leading-none" style={{ color: colorDe(p, "L") }}>
              {porcentaje(barra.L)}
            </span>
            <span className="block text-[11px] uppercase tracking-[0.12em]" style={{ color: S.suave }}>
              {cortoDe(p, "L")}
            </span>
          </span>
          <div className="flex h-4 overflow-hidden rounded-full sm:h-5" style={{ border: `1px solid ${S.borde}`, background: "rgba(255,255,255,0.03)" }}>
            {(["L", "X", "V"] as const).map((q) => (
              <div
                key={q}
                title={`${q === "X" ? "Empate" : cortoDe(p, q)}: ${porcentaje(barra[q])}`}
                style={{
                  width: `${Math.max(barra[q] * 100, 0)}%`,
                  background: q === "X" ? "rgba(180,196,225,0.32)" : `linear-gradient(90deg, ${colorDe(p, q)}dd, ${colorDe(p, q)}99)`,
                  transition: "width .7s cubic-bezier(.2,.8,.2,1)",
                  boxShadow: q === "X" ? undefined : `inset 0 0 16px ${colorDe(p, q)}66`,
                }}
              />
            ))}
          </div>
          <span className="text-left">
            <span className="block font-mono text-[clamp(18px,2.2vw,28px)] font-bold tabular-nums leading-none" style={{ color: colorDe(p, "V") }}>
              {porcentaje(barra.V)}
            </span>
            <span className="block text-[11px] uppercase tracking-[0.12em]" style={{ color: S.suave }}>
              {cortoDe(p, "V")}
            </span>
          </span>
        </div>
        <p className="mt-1 text-center font-mono text-[12px] tabular-nums" style={{ color: S.suave }}>
          Empate {porcentaje(barra.X)}
        </p>
      </div>
    </section>
  );
}

/* ------------------------------------------------------------------ */
/*  LA ESCALERA DEL xG (28/11/2026)                                    */
/* ------------------------------------------------------------------ */

/*
| Bajo el marcador, el desarrollo del partido de un vistazo: cada remate sube
| la escalera de su equipo lo que vale su xG, y cada gol es un balón sobre ella.
| Sin cifras al final: el xG del partido ya va en grande en el marcador (el
| oficial de Opta, que junta los remates de una misma jugada y puede no ser la
| suma exacta de la escalera).
*/
export function EscaleraXg({ p, t, hitos }: { p: Partido; t: number; hitos: Hito[] }) {
  const xg = useMemo(() => curvaXg(p, t), [p, t]);
  if (xg.length < 3) return null;
  const fin = Math.max(DURACION, t);
  const maxXg = Math.max(0.5, ...xg.map((q) => Math.max(q.L, q.V)));
  const valorEn = (k: Lado, m: number) => {
    let v = 0;
    for (const q of xg) {
      if (q.min > m + 1e-6) break;
      v = q[k];
    }
    return v;
  };
  const goles = hitos.filter((h) => h.tipo === "gol");
  /*
   * 28/11/2026 (los tres jueces): a 390 px era una tira ilegible. Dos dibujos del mismo dato:
   * en el móvil más estrecho y alto (unos 170 px, letras de 0′/45′/90′ legibles); en pantalla
   * grande, el de siempre.
   */
  const dibujo = (W: number, H: number, letra: number, clase: string) => {
    const X = (m: number) => 34 + (m / fin) * (W - 50);
    const Y = (v: number) => H - letra - 9 - (v / maxXg) * (H - letra - 23);
    const linea = (k: Lado) => xg.map((q, i) => `${i ? "L" : "M"}${X(q.min)},${Y(q[k])}`).join(" ");
    return (
      <svg viewBox={`0 0 ${W} ${H}`} className={clase} role="img" aria-label="Escalera del xG acumulado de cada equipo, con los goles">
        {[0, 45, 90].map((m) => (
          <g key={m}>
            <line x1={X(m)} x2={X(m)} y1={6} y2={H - letra - 7} stroke={S.linea} strokeDasharray={m === 45 ? "4 4" : undefined} />
            <text x={X(m)} y={H - 4} textAnchor="middle" fontSize={letra} style={{ fill: S.tenue }}>
              {m}′
            </text>
          </g>
        ))}
        <line x1={X(0)} x2={X(fin)} y1={Y(0)} y2={Y(0)} stroke={S.linea} />
        {(["L", "V"] as Lado[]).map((k) => (
          <path key={k} d={linea(k)} fill="none" stroke={colorDe(p, k)} strokeWidth={W < 600 ? 3 : 3.5} strokeLinejoin="round" />
        ))}
        {goles.map((g, i) => (
          <text key={i} x={X(g.min)} y={Y(valorEn(g.lado, g.min)) - 6} textAnchor="middle" fontSize={letra + 5}>
            ⚽
            <title>{`${reloj(g.min, g.parte)} · ${g.jugador}`}</title>
          </text>
        ))}
      </svg>
    );
  };
  return (
    <figure className="relative mx-auto mt-4 max-w-[58rem]">
      {/* La leyenda baja de línea si no cabe (antes se cortaba «· gol» en el móvil). */}
      <figcaption className="mb-1 flex flex-wrap items-center justify-center gap-x-3 gap-y-0.5 text-[12px] font-semibold uppercase tracking-[0.14em]" style={{ color: S.suave }}>
        <span>xG acumulado</span>
        {(["L", "V"] as Lado[]).map((k) => (
          <span key={k} className="inline-flex items-center gap-1 normal-case tracking-normal">
            <span className="inline-block h-[3px] w-4 rounded-full" style={{ background: colorDe(p, k) }} />
            {cortoDe(p, k)}
          </span>
        ))}
        <span className="whitespace-nowrap normal-case tracking-normal">⚽ gol</span>
      </figcaption>
      {dibujo(420, 190, 15, "block h-auto w-full sm:hidden")}
      {dibujo(1000, 132, 13, "hidden h-auto w-full sm:block")}
    </figure>
  );
}

/* ------------------------------------------------------------------ */
/*  QUÉ TRAMO SE MIRA                                                  */
/* ------------------------------------------------------------------ */

export function SelectorTramo({ valor, onCambia, disponibles }: { valor: TramoClave; onCambia: (v: TramoClave) => void; disponibles: Record<TramoClave, boolean> }) {
  const opciones: { k: TramoClave; t: string; titulo?: string }[] = [
    { k: "todo", t: "Todo" },
    { k: "p1", t: "1.ª parte" },
    { k: "p2", t: "2.ª parte" },
    { k: "u15", t: "Últimos 15′" },
    { k: "cambio", t: "Desde el último cambio", titulo: "Con los cambios en el documento (desde el 26/11/2026)" },
  ];
  return (
    /* 28/11/2026 (jueces de estilo): en el móvil se cortaba a la derecha sin aviso; ahora baja de línea. */
    <div className="flex min-w-0 flex-wrap items-center gap-2" role="group" aria-label="Qué tramo del partido se mira">
      <span className="shrink-0 text-[12px] font-semibold uppercase tracking-[0.16em]" style={{ color: S.suave }}>
        Mirar
      </span>
      {opciones.map((o) => (
        <Pastilla key={o.k} activa={valor === o.k} onClick={() => onCambia(o.k)} desactivada={!disponibles[o.k]} titulo={o.titulo}>
          {o.t}
        </Pastilla>
      ))}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  QUÉ TOCAMOS (28/11/2026)                                           */
/* ------------------------------------------------------------------ */

/** El bloque de la sala que sostiene cada orden (para saltar a su cifra). */
const BLOQUE_DE: { re: RegExp; id: string; texto: string }[] = [
  { re: /^carril/, id: "sala-campo", texto: "por dónde llega" },
  { re: /^tocar-salida/, id: "sala-abp", texto: "las pérdidas" },
  { re: /^tocar-corner/, id: "sala-abp", texto: "el balón parado" },
  { re: /^ppda/, id: "sala-duelo", texto: "el cara a cara" },
  { re: /^tocar-ataque/, id: "sala-campo", texto: "los remates" },
];

/**
 * Lo que se entrena el martes (experto de fútbol): antes iba en la tercera
 * tarjeta de la columna derecha («Para el próximo partido»); ahora a todo el
 * ancho bajo el marcador, cada orden con su cifra y un salto al bloque de la
 * sala que la sostiene. Sólo en los partidos del Castilla (desde nuestro lado).
 */
export function QueTocamos({ lista, final, planHref }: { lista: { clave: string; texto: string }[]; final: boolean; planHref?: string }) {
  if (!lista.length) return null;
  return (
    <section className="sala-entra relative min-w-0 overflow-hidden rounded-2xl p-4 sm:p-5" style={{ background: "linear-gradient(90deg, rgba(233,196,106,0.12), rgba(14,26,48,0.62))", border: "1px solid rgba(233,196,106,0.45)" }}>
      <header className="mb-2 flex min-w-0 flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
        <h2 className="fuente-club flex items-center gap-2 text-[17px] uppercase tracking-[0.16em]" style={{ color: S.oro }}>
          <span aria-hidden className="inline-block h-4 w-[3px] shrink-0 rounded-full" style={{ background: S.oro }} />
          {final ? "Qué tocamos esta semana" : "Qué tocar ahora"}
        </h2>
        {planHref && (
          <Link href={planHref} className="text-[12px] font-semibold underline decoration-dotted underline-offset-2" style={{ color: S.suave }}>
            Abrir el plan de partido
          </Link>
        )}
      </header>
      <ol className="grid gap-2 md:grid-cols-2">
        {lista.map((x, i) => {
          const b = BLOQUE_DE.find((q) => q.re.test(x.clave));
          return (
            <li key={x.clave} className="flex min-w-0 gap-2.5 rounded-xl px-3 py-2 text-[14px] leading-snug" style={{ background: "rgba(255,255,255,0.035)", color: S.texto }}>
              <span className="fuente-club grid h-6 w-6 shrink-0 place-items-center rounded-full text-[13px]" style={{ background: "rgba(233,196,106,0.16)", color: S.oro, border: "1px solid rgba(233,196,106,0.5)" }}>
                {i + 1}
              </span>
              <span className="min-w-0">
                {x.texto}
                {b && (
                  <a href={`#${b.id}`} className="ml-1.5 whitespace-nowrap text-[12px] font-semibold underline decoration-dotted underline-offset-2" style={{ color: S.suave }}>
                    ver {b.texto} ↓
                  </a>
                )}
              </span>
            </li>
          );
        })}
      </ol>
    </section>
  );
}

/* ------------------------------------------------------------------ */
/*  AVISOS                                                             */
/* ------------------------------------------------------------------ */

export function Alertas({ lista, p, final = false }: { lista: Alerta[]; p: Partido; final?: boolean }) {
  /* Los de vigilar primero, luego por fuerza (el experto de comunicación: «lo importante se perdía»). */
  const orden = [...lista].sort((a, b) => Number(b.tono === "aviso") - Number(a.tono === "aviso") || b.fuerza - a.fuerza);
  const [principal, ...resto] = orden;
  const colorTono = (a: Alerta) => (a.tono === "favor" ? S.favor : a.tono === "aviso" ? S.aviso : S.info);
  /* La ventana sólo cuando es un tramo («61′-71′», «desde el 82′»): «todo el partido» repetido en cada tarjeta era ruido. */
  const chip = (a: Alerta) =>
    a.ventana && a.ventana !== "todo el partido" ? (
      <span className="shrink-0 rounded-full px-2 py-0.5 font-mono text-[11px] tabular-nums" style={{ background: "rgba(255,255,255,0.05)", color: S.suave, border: `1px solid ${S.borde}` }}>
        {a.ventana}
      </span>
    ) : null;
  return (
    <Panel titulo={final ? "Lo que pasó" : "Lo que está pasando"} detalle={final ? (p.nuestro ? "Lo que se salió de lo normal en el partido. Verde, bueno para nosotros; naranja, malo." : "Lo que se salió de lo normal en el partido, frente a lo que suele hacer cada uno.") : p.nuestro ? "Verde, bueno para nosotros; naranja, a vigilar. Se recalcula a cada minuto." : "Lo que se sale de lo normal en el partido. Se recalcula a cada minuto."}>
      {!principal && (
        <p className="py-6 text-center text-[14px]" style={{ color: S.tenue }}>
          Nada fuera de lo normal todavía.
        </p>
      )}
      {principal && (
        <div className="sala-entra rounded-xl p-4" style={{ background: `linear-gradient(90deg, ${colorTono(principal)}26, rgba(255,255,255,0.02))`, borderLeft: `4px solid ${colorTono(principal)}`, border: `1px solid ${colorTono(principal)}55` }}>
          <div className="flex items-start gap-3">
            {principal.tono === "aviso" ? <AlertTriangle size={28} style={{ color: colorTono(principal) }} className="shrink-0" aria-hidden /> : principal.fuerza > 2.5 ? <Flame size={28} style={{ color: colorTono(principal) }} className="shrink-0" aria-hidden /> : <Zap size={28} style={{ color: colorTono(principal) }} className="shrink-0" aria-hidden />}
            <div className="min-w-0">
              <p className="fuente-club text-[clamp(18px,1.8vw,22px)] leading-tight" style={{ color: S.texto }}>
                {principal.titulo}
              </p>
              <p className="mt-1 text-[14px] leading-snug" style={{ color: S.suave }}>
                {principal.texto}
              </p>
              {chip(principal) && <div className="mt-2">{chip(principal)}</div>}
            </div>
          </div>
        </div>
      )}
      {resto.length > 0 && (
        <ul className="mt-2 grid gap-1.5">
          {resto.slice(0, 4).map((a) => (
            <li key={a.clave} className="flex min-w-0 items-start gap-2.5 rounded-lg px-3 py-2 sala-entra" style={{ background: "rgba(255,255,255,0.025)", borderLeft: `3px solid ${colorTono(a)}` }}>
              <div className="min-w-0 flex-1">
                <p className="text-[14px] font-semibold leading-snug" style={{ color: S.texto }}>
                  {a.titulo}
                </p>
                <p className="text-[13px] leading-snug" style={{ color: S.suave }}>
                  {a.texto}
                </p>
              </div>
              {chip(a)}
            </li>
          ))}
        </ul>
      )}
    </Panel>
  );
}

/* ------------------------------------------------------------------ */
/*  LA LECTURA DEL TRAMO (DESCANSO, FINAL O LA PARTE ELEGIDA)          */
/* ------------------------------------------------------------------ */

/* 28/11/2026 (fútbol y marketing): «Qué tocar» sale de aquí y sube bajo el marcador (QueTocamos); aquí queda lo que dejó el tramo, con su título. */
export function Lectura({ p, v, titulo, omitir }: { p: Partido; v: Ventana; titulo: string; omitir: Set<string> }) {
  const frases = useMemo(() => lecturaTramo(p, v.desde, v.hasta, v.parte, omitir), [p, v.desde, v.hasta, v.parte, omitir]);
  if (!frases.length) return null;
  return (
    <Panel titulo={titulo} detalle={`Lo que dejó ${v.nombre}: quién mandó, la cifra que más se salió de su media y por dónde llegó ${p.nuestro ? "el rival" : "el visitante"}.`}>
      <ol className="grid gap-2">
        {frases.map((f, i) => (
          <li key={i} className="flex gap-3 text-[14px] leading-snug" style={{ color: S.texto }}>
            <span className="fuente-club mt-0.5 grid h-6 w-6 shrink-0 place-items-center rounded-full text-[13px]" style={{ background: "rgba(233,196,106,0.16)", color: S.oro, border: "1px solid rgba(233,196,106,0.5)" }}>
              {i + 1}
            </span>
            <span>{f}</span>
          </li>
        ))}
      </ol>
    </Panel>
  );
}

/* ------------------------------------------------------------------ */
/*  PULSO Y CARRERA DE xG                                              */
/* ------------------------------------------------------------------ */

export function Pulso({ p, t, hitos }: { p: Partido; t: number; hitos: Hito[] }) {
  const W = 1000, H = 230, mitad = H / 2;
  const tramos = useMemo(() => pulso(p, t, 3), [p, t]);
  const xg = useMemo(() => curvaXg(p, t), [p, t]);
  const fin = Math.max(DURACION, t);
  const X = (m: number) => 40 + (m / fin) * (W - 70);
  const max = Math.max(0.15, ...tramos.map((x) => Math.max(x.L, x.V)));
  const alto = (v: number) => (v / max) * (mitad - 16);
  const area = (k: Lado) => {
    const sgn = k === "L" ? -1 : 1;
    const pts = tramos.map((x) => `${X(x.desde + 1.5)},${mitad + sgn * alto(x[k])}`);
    return `M${X(0)},${mitad} L${pts.join(" L")} L${X(Math.min(t, tramos.at(-1)!.desde + 3))},${mitad} Z`;
  };
  const XH = 160;
  const maxXg = Math.max(1, ...xg.map((q) => Math.max(q.L, q.V)));
  const YX = (v: number) => XH - 14 - (v / maxXg) * (XH - 30);
  const linea = (k: Lado) => xg.map((q, i) => `${i ? "L" : "M"}${X(q.min)},${YX(q[k])}`).join(" ");
  const goles = hitos.filter((h) => h.tipo === "gol");

  return (
    <Panel titulo="Pulso del partido" detalle="Arriba, la amenaza de cada equipo por tramos de 3′ (xG de los remates y valor de las demás acciones, xPV, de Opta). Abajo, la carrera de goles esperados.">
      <svg viewBox={`0 0 ${W} ${H}`} className="block h-auto w-full" role="img" aria-label="Pulso del partido">
        <defs>
          {(["L", "V"] as Lado[]).map((k) => (
            <linearGradient key={k} id={`sala-pulso-${k}`} x1="0" x2="0" y1={k === "L" ? "0" : "1"} y2={k === "L" ? "1" : "0"}>
              <stop offset="0" stopColor={colorDe(p, k)} stopOpacity="0.95" />
              <stop offset="1" stopColor={colorDe(p, k)} stopOpacity="0.05" />
            </linearGradient>
          ))}
          <filter id="sala-brillo" x="-20%" y="-20%" width="140%" height="140%">
            <feGaussianBlur stdDeviation="4" result="b" />
            <feMerge>
              <feMergeNode in="b" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
        </defs>
        {[15, 30, 45, 60, 75, 90].map((m) => (
          <g key={m}>
            <line x1={X(m)} x2={X(m)} y1={8} y2={H - 16} stroke={m === 45 ? "rgba(170,200,255,0.4)" : S.linea} strokeDasharray={m === 45 ? "4 4" : undefined} />
            <text x={X(m)} y={H - 2} textAnchor="middle" fontSize="13" fill={S.tenue}>
              {m}′
            </text>
          </g>
        ))}
        <text x={12} y={mitad} fontSize="12" fill={S.tenue} transform={`rotate(-90 12 ${mitad})`} textAnchor="middle">
          AMENAZA
        </text>
        <path d={area("L")} fill={`url(#sala-pulso-L)`} filter="url(#sala-brillo)" style={{ transition: "d .5s ease" }} />
        <path d={area("V")} fill={`url(#sala-pulso-V)`} filter="url(#sala-brillo)" style={{ transition: "d .5s ease" }} />
        <line x1={X(0)} x2={X(fin)} y1={mitad} y2={mitad} stroke="rgba(200,220,255,0.35)" />
        {goles.map((g, i) => {
          /* Escalón: si el gol anterior del mismo equipo está a menos de 16′, este baja (o sube) una línea. */
          const previos = goles.slice(0, i).filter((o) => o.lado === g.lado && g.min - o.min < 16).length;
          const dy = (previos % 2) * 24;
          return (
          <g key={i}>
            <circle cx={X(g.min)} cy={mitad} r="8" fill={colorDe(p, g.lado)} stroke="#fff" strokeWidth="2" className="sala-pop" />
            <text x={X(g.min)} y={g.lado === "L" ? 20 + dy : H - 22 - dy} textAnchor="middle" fontSize="14" fontWeight="700" fill={S.texto} paintOrder="stroke" stroke="#030812" strokeWidth="4">
              ⚽ {reloj(g.min, g.parte)} {g.jugador}
            </text>
          </g>
          );
        })}
        <line x1={X(t)} x2={X(t)} y1={4} y2={H - 16} stroke="#fff" strokeOpacity="0.8" strokeWidth="1.5" filter="url(#sala-brillo)" />
        <text x={44} y={24} fontSize="14" fontWeight="700" fill={p.local.color}>
          ▲ {cortoDe(p, "L")}
        </text>
        <text x={44} y={H - 26} fontSize="14" fontWeight="700" fill={p.visitante.color}>
          ▼ {cortoDe(p, "V")}
        </text>
      </svg>
      <svg viewBox={`0 0 ${W} ${XH}`} className="mt-2 block h-auto w-full" role="img" aria-label="Carrera de goles esperados">
        {[0.5, 1, 1.5, 2, 2.5, 3, 3.5, 4].filter((v) => v <= maxXg).map((v) => (
          <g key={v}>
            <line x1={40} x2={W - 30} y1={YX(v)} y2={YX(v)} stroke={S.linea} />
            <text x={34} y={YX(v) + 4} fontSize="12" textAnchor="end" fill={S.tenue}>
              {fmt(v, 1)}
            </text>
          </g>
        ))}
        {(["L", "V"] as Lado[]).map((k) => (
          <path key={k} d={linea(k)} fill="none" stroke={colorDe(p, k)} strokeWidth="3" strokeLinejoin="round" filter="url(#sala-brillo)" />
        ))}
        {(["L", "V"] as Lado[]).map((k) => {
          const u = xg.at(-1)!;
          return (
            <text key={k} x={Math.min(X(u.min) + 6, W - 60)} y={YX(u[k]) + (k === "L" ? -6 : 16)} fontSize="15" fontWeight="800" fill={colorDe(p, k)} paintOrder="stroke" stroke="#030812" strokeWidth="4">
              {fmt(u[k], 2)}
            </text>
          );
        })}
        <text x={44} y={16} fontSize="13" fill={S.tenue}>
          xG acumulado
        </text>
      </svg>
    </Panel>
  );
}

/* ------------------------------------------------------------------ */
/*  POR TRAMOS DE 15′                                                  */
/* ------------------------------------------------------------------ */

export function Tramos({ p, t }: { p: Partido; t: number }) {
  const lista = useMemo(() => tramos15(p, t), [p, t]);
  const maxXg = Math.max(0.3, ...lista.map((x) => Math.max(x.L.xg, x.V.xg)));
  return (
    <Panel titulo="El partido por tramos" detalle="Cada 15′ (el descuento va con su tramo): xG y remates de cada uno, y el dominio territorial: de los pases en el último tercio, qué parte es de cada uno (con cuántos pases hubo).">
      <div className="grid gap-1.5">
        <div className="grid grid-cols-[3.6rem_minmax(0,1fr)_minmax(0,1fr)_minmax(5.5rem,0.7fr)] items-center gap-2 text-[11px] uppercase tracking-[0.12em]" style={{ color: S.tenue }}>
          <span>Tramo</span>
          <span className="truncate text-right" style={{ color: p.local.color }}>
            {cortoDe(p, "L")}
          </span>
          <span className="truncate" style={{ color: p.visitante.color }}>
            {cortoDe(p, "V")}
          </span>
          <span className="text-center">Dominio</span>
        </div>
        {lista.map((x) => (
          <div key={x.etiqueta} className="grid grid-cols-[3.6rem_minmax(0,1fr)_minmax(0,1fr)_minmax(5.5rem,0.7fr)] items-center gap-2">
            <span className="font-mono text-[13px] tabular-nums" style={{ color: S.suave }}>
              {x.etiqueta}
            </span>
            {(["L", "V"] as Lado[]).map((l) => {
              const v = x[l];
              return (
                <div key={l} className={`flex min-w-0 items-center gap-2 ${l === "L" ? "flex-row-reverse" : ""}`}>
                  <div className="relative h-3 min-w-0 flex-1 overflow-hidden rounded-full" style={{ background: "rgba(255,255,255,0.05)" }}>
                    <div className={`absolute inset-y-0 rounded-full ${l === "L" ? "right-0" : "left-0"}`} style={{ width: `${(v.xg / maxXg) * 100}%`, background: colorDe(p, l), boxShadow: `0 0 10px ${colorDe(p, l)}88` }} />
                  </div>
                  <span className="shrink-0 font-mono text-[12px] tabular-nums" style={{ color: S.texto }}>
                    {fmt(v.xg, 2)} <span style={{ color: S.tenue }}>· {v.tiros}</span>
                    {v.goles > 0 && <span> ⚽{v.goles > 1 ? v.goles : ""}</span>}
                  </span>
                </div>
              );
            })}
            {/* 28/11/2026 (análisis): el dominio con su cifra y su base de pases, no sólo la barra. */}
            <div className="min-w-0" title={x.dominio ? `${cortoDe(p, "L")} ${Math.round(x.dominio.L * 100)} % · ${cortoDe(p, "V")} ${Math.round(x.dominio.V * 100)} %${x.dominio.pases ? ` de ${x.dominio.pases} pases en el último tercio` : ""}` : undefined}>
              {x.dominio && (
                <div className="mb-0.5 flex justify-between gap-1 font-mono text-[11px] leading-none tabular-nums">
                  <span style={{ color: p.local.color }}>{Math.round(x.dominio.L * 100)}</span>
                  {x.dominio.pases ? <span style={{ color: S.tenue }}>{x.dominio.pases} p.</span> : null}
                  <span style={{ color: p.visitante.color }}>{Math.round(x.dominio.V * 100)}</span>
                </div>
              )}
              <div className="flex h-2.5 overflow-hidden rounded-full">
                {x.dominio ? (
                  <>
                    <div style={{ width: `${x.dominio.L * 100}%`, background: `${p.local.color}cc` }} />
                    <div style={{ width: `${x.dominio.V * 100}%`, background: `${p.visitante.color}cc` }} />
                  </>
                ) : (
                  <div className="w-full" style={{ background: "rgba(255,255,255,0.05)" }} />
                )}
              </div>
            </div>
          </div>
        ))}
      </div>
      <p className="mt-2 text-[12px]" style={{ color: S.tenue }}>
        Cifra = xG · remates. Dominio: % de los pases en el último tercio de {cortoDe(p, "L")} (izquierda) y {cortoDe(p, "V")} (derecha); en medio, cuántos pases hubo («p.»).
      </p>
    </Panel>
  );
}

/* ------------------------------------------------------------------ */
/*  PROBABILIDAD EN VIVO (CURVA)                                       */
/* ------------------------------------------------------------------ */

export function Probabilidad({ p, t, hitos }: { p: Partido; t: number; hitos: Hito[] }) {
  const serie = useMemo(() => curvaProbabilidad(p, t, 1), [p, t]);
  const W = 600, H = 240;
  const fin = Math.max(DURACION, t);
  const X = (m: number) => 38 + (m / fin) * (W - 48);
  const Y = (v: number) => 12 + (1 - v) * (H - 40);
  const banda = (de: (q: (typeof serie)[number]) => number, a: (q: (typeof serie)[number]) => number) =>
    `M${serie.map((q) => `${X(q.min)},${Y(a(q))}`).join(" L")} L${[...serie].reverse().map((q) => `${X(q.min)},${Y(de(q))}`).join(" L")} Z`;
  const u = serie.at(-1)!;
  const goles = hitos.filter((h) => h.tipo === "gol");
  return (
    <Panel titulo="Probabilidad minuto a minuto" detalle="Cada franja es la probabilidad de un resultado en cada minuto, con el marcador y el ritmo de xG de cada uno (su media mezclada con lo de hoy). Al final, el resultado ya es seguro.">
      <svg viewBox={`0 0 ${W} ${H}`} className="block h-auto w-full" role="img" aria-label="Probabilidad de victoria minuto a minuto">
        <path d={banda(() => 0, (q) => q.L)} fill={p.local.color} fillOpacity="0.55" />
        <path d={banda((q) => q.L, (q) => q.L + q.X)} fill="rgba(170,190,225,0.22)" />
        <path d={banda((q) => q.L + q.X, () => 1)} fill={p.visitante.color} fillOpacity="0.55" />
        {[0, 0.5, 1].map((v) => (
          <text key={v} x={32} y={Y(v) + 4} fontSize="12" textAnchor="end" fill={S.tenue}>
            {Math.round(v * 100)} %
          </text>
        ))}
        {[45, 90].map((m) => (
          <line key={m} x1={X(m)} x2={X(m)} y1={8} y2={H - 26} stroke="rgba(255,255,255,0.25)" strokeDasharray="3 4" />
        ))}
        {goles.map((g, i) => (
          <g key={i}>
            <line x1={X(g.min)} x2={X(g.min)} y1={10} y2={H - 26} stroke="#fff" strokeOpacity="0.55" />
            <text x={X(g.min)} y={H - 14} fontSize="12" textAnchor="middle" fill={S.texto}>
              ⚽ {reloj(g.min, g.parte)}
            </text>
          </g>
        ))}
        <line x1={X(t)} x2={X(t)} y1={6} y2={H - 26} stroke="#fff" strokeWidth="2" />
        {/* 28/11/2026 (marketing): cada franja rotulada con su equipo, en el tramo donde más ancha es. */}
        {(
          [
            ["L", (q: (typeof serie)[number]) => [0, q.L] as const, cortoDe(p, "L")],
            ["X", (q: (typeof serie)[number]) => [q.L, q.L + q.X] as const, "Empate"],
            ["V", (q: (typeof serie)[number]) => [q.L + q.X, 1] as const, cortoDe(p, "V")],
          ] as const
        ).map(([k, tramo, nombre]) => {
          const mejor = serie.reduce((a, q) => (tramo(q)[1] - tramo(q)[0] > tramo(a)[1] - tramo(a)[0] ? q : a), serie[0]);
          const [de, a] = tramo(mejor);
          if (a - de < 0.12) return null;
          const xm = Math.min(Math.max(X(mejor.min), 80), W - 70);
          return (
            <text key={k} x={xm} y={Y((de + a) / 2) + 5} textAnchor="middle" fontSize="14" fontWeight="800" fill="#fff" paintOrder="stroke" stroke="#030812" strokeWidth="4">
              {nombre}
            </text>
          );
        })}
        <text x={X(0)} y={H - 2} fontSize="12" fill={S.tenue}>
          0′
        </text>
        <text x={X(45)} y={H - 2} fontSize="12" textAnchor="middle" fill={S.tenue}>
          45′
        </text>
        <text x={X(90)} y={H - 2} fontSize="12" textAnchor="middle" fill={S.tenue}>
          90′
        </text>
      </svg>
      <div className="mt-2 grid grid-cols-3 gap-2 text-center">
        {(["L", "X", "V"] as const).map((q) => (
          <div key={q} className="rounded-xl py-2" style={{ background: "rgba(255,255,255,0.03)", border: `1px solid ${S.borde}` }}>
            <div className="font-mono text-[22px] font-bold tabular-nums" style={{ color: q === "X" ? S.texto : colorDe(p, q) }}>
              {porcentaje(u[q])}
            </div>
            <div className="truncate px-1 text-[12px] uppercase tracking-[0.12em]" style={{ color: S.suave }}>
              {q === "X" ? "Empate" : cortoDe(p, q)}
            </div>
          </div>
        ))}
      </div>
    </Panel>
  );
}

/* ------------------------------------------------------------------ */
/*  EL CAMPO                                                           */
/* ------------------------------------------------------------------ */

export type Capa = "remates" | "pordonde" | "calor" | "redL" | "redV";

/** Coordenadas del campo (105 × 68 → 1050 × 680), el local ataca a la derecha. */
const cx = (l: Lado, x: number) => (l === "L" ? x : 100 - x) * 10.5;
const cy = (l: Lado, y: number) => (l === "L" ? 100 - y : y) * 6.8;

/** «#1E6BFF» o «rgb(30,107,255)» → [r, g, b]. */
function rgbDe(c: string): [number, number, number] {
  const h = c.trim().match(/^#([0-9a-f]{6})$/i);
  if (h) return [0, 2, 4].map((i) => parseInt(h[1].slice(i, i + 2), 16)) as [number, number, number];
  const r = c.match(/(\d+)\D+(\d+)\D+(\d+)/);
  return r ? [Number(r[1]), Number(r[2]), Number(r[3])] : [255, 255, 255];
}

/** Los toques de un equipo en la ventana, en la malla del calor, ya colocados en el dibujo (el local ataca a la derecha). */
function calorDe(p: Partido, l: Lado, v: Ventana) {
  const ev = p.eventos.filter((e) => e.lado === l && e.min >= v.desde && e.min <= v.hasta && (!v.parte || e.parte === v.parte));
  const d = densidad(ev);
  /* La malla va en el sentido de quien ataca; el dibujo, fila 0 arriba y el local hacia la derecha. */
  const malla = new Array(MX * MY).fill(0);
  for (let fila = 0; fila < MY; fila++)
    for (let col = 0; col < MX; col++) {
      const j = l === "L" ? MY - 1 - fila : fila;
      const i = l === "L" ? col : MX - 1 - col;
      malla[fila * MX + col] = d.malla[j * MX + i] * d.toques;
    }
  return { malla, toques: d.toques };
}

/**
 * La imagen del calor (un punto de la malla = un píxel; el navegador la estira
 * suave, como en la huella táctica). Con un equipo, su color sube hacia el
 * blanco donde más toca; con los dos, el color del que más toca en cada zona.
 */
function imagenCalor(p: Partido, capas: { L: number[]; V: number[] } | null, solo: number[] | null, colorSolo: string): string {
  if (typeof document === "undefined") return "";
  const lienzo = document.createElement("canvas");
  lienzo.width = MX;
  lienzo.height = MY;
  const c = lienzo.getContext("2d");
  if (!c) return "";
  const img = c.createImageData(MX, MY);
  if (solo) {
    const tope = Math.max(1e-9, ...solo);
    const [r, g, b] = rgbDe(colorSolo);
    solo.forEach((v, k) => {
      /* Por debajo del 12 % del máximo, nada; luego sube (más contraste que la raíz: con ella todo el campo salía igual de lleno). */
      const f = Math.max(0, (v / tope - 0.12) / 0.88) ** 0.75;
      const blanco = Math.max(0, (f - 0.6) / 0.4) * 0.65;
      img.data[k * 4] = Math.round(r + (255 - r) * blanco);
      img.data[k * 4 + 1] = Math.round(g + (255 - g) * blanco);
      img.data[k * 4 + 2] = Math.round(b + (255 - b) * blanco);
      img.data[k * 4 + 3] = Math.round(Math.min(1, f * 1.15) * 0.88 * 255);
    });
  } else if (capas) {
    const dif = capas.L.map((v, k) => v - capas.V[k]);
    const tope = Math.max(1e-9, ...dif.map(Math.abs));
    const L = rgbDe(p.local.color);
    const V = rgbDe(p.visitante.color);
    dif.forEach((v, k) => {
      const [r, g, b] = v >= 0 ? L : V;
      img.data[k * 4] = r;
      img.data[k * 4 + 1] = g;
      img.data[k * 4 + 2] = b;
      /* Lo parejo (menos del 10 % de la mayor diferencia) sin color; luego sube: se ve dónde manda cada uno, no un campo entero pintado. */
      const fz = Math.max(0, (Math.abs(v) / tope - 0.1) / 0.9) ** 0.7;
      img.data[k * 4 + 3] = Math.round(Math.min(1, fz * 1.2) * 0.85 * 255);
    });
  }
  c.putImageData(img, 0, 0);
  return lienzo.toDataURL("image/png");
}

function Lineas() {
  const c = "rgba(160, 220, 255, 0.62)";
  return (
    <g fill="none" stroke={c} strokeWidth="2.2">
      <rect x="2" y="2" width="1046" height="676" rx="2" />
      <line x1="525" y1="2" x2="525" y2="678" />
      <circle cx="525" cy="340" r="91.5" />
      <circle cx="525" cy="340" r="3" fill={c} />
      {[0, 1].map((k) => {
        const s = k ? -1 : 1;
        const x0 = k ? 1048 : 2;
        return (
          <g key={k}>
            <rect x={k ? 1048 - 165 : 2} y={340 - 201.5} width="165" height="403" />
            <rect x={k ? 1048 - 55 : 2} y={340 - 91.5} width="55" height="183" />
            <circle cx={x0 + s * 110} cy="340" r="3" fill={c} />
            <path d={`M ${x0 + s * 165} ${340 - 73} A 91.5 91.5 0 0 ${k ? 0 : 1} ${x0 + s * 165} ${340 + 73}`} />
            <rect x={k ? 1048 : -18} y={340 - 36.6} width="20" height="73.2" stroke="rgba(255,255,255,0.6)" />
          </g>
        );
      })}
    </g>
  );
}

export function Campo({ p, t, v, capa, setCapa }: { p: Partido; t: number; v: Ventana; capa: Capa; setCapa: (c: Capa) => void }) {
  const [quien, setQuien] = useState<"ambos" | Lado>("ambos");
  /* Por su clave (equipo, minuto y quién): antes era la posición en la lista y, al cambiar de equipo o de tramo, la ficha saltaba a otro remate. */
  const [elegido, setElegido] = useState<string | null>(null);
  const { tiros } = useMemo(() => cifrasEntre(p, v.desde, v.hasta, v.parte), [p, v.desde, v.hasta, v.parte]);
  const lados: Lado[] = quien === "ambos" ? ["L", "V"] : [quien];
  const vistos = tiros.filter((s) => lados.includes(s.lado));
  const ultimo = vistos.at(-1);
  const claveTiro = (s: Tiro) => `${s.lado}${s.parte}${s.min.toFixed(3)}${s.jugador}`;
  const tiroElegido = elegido != null ? (vistos.find((s) => claveTiro(s) === elegido) ?? null) : null;
  const calor = useMemo(() => {
    if (capa !== "calor") return null;
    const L = calorDe(p, "L", v);
    const V = calorDe(p, "V", v);
    const href = quien === "ambos" ? imagenCalor(p, { L: L.malla, V: V.malla }, null, "") : imagenCalor(p, null, (quien === "L" ? L : V).malla, colorDe(p, quien));
    /* La zona (de 6 × 3) donde más domina cada uno, para la frase de debajo. */
    const zonas = (["L", "V"] as Lado[]).map((l) => {
      const yo = l === "L" ? L.malla : V.malla, el = l === "L" ? V.malla : L.malla;
      let mejor = { col: 0, fila: 0, v: -Infinity };
      for (let fila = 0; fila < 3; fila++)
        for (let col = 0; col < 6; col++) {
          let d = 0;
          for (let j = Math.floor((fila * MY) / 3); j < Math.floor(((fila + 1) * MY) / 3); j++)
            for (let i = Math.floor((col * MX) / 6); i < Math.floor(((col + 1) * MX) / 6); i++) d += yo[j * MX + i] - el[j * MX + i];
          if (d > mejor.v) mejor = { col, fila, v: d };
        }
      return { l, ...mejor };
    });
    return { href, toques: { L: L.toques, V: V.toques }, zonas };
  }, [p, v, capa, quien]);
  const redes = useMemo(() => (capa === "redL" || capa === "redV" ? red(p, capa === "redL" ? "L" : "V", t) : null), [p, t, capa]);
  const vias = useMemo(() => (capa === "pordonde" ? { L: carriles(p, "L", v.desde, v.hasta, v.parte), V: carriles(p, "V", v.desde, v.hasta, v.parte) } : null), [p, v.desde, v.hasta, v.parte, capa]);

  const opciones: { k: Capa; t: string }[] = [
    { k: "remates", t: "Remates" },
    { k: "pordonde", t: "Por dónde llega" },
    { k: "calor", t: "Mapa de calor" },
    { k: "redL", t: `Red · ${cortoDe(p, "L")}` },
    { k: "redV", t: `Red · ${cortoDe(p, "V")}` },
  ];

  const detalle =
    capa === "remates"
      ? "Toca un remate para ver quién, cuándo y de dónde."
      : capa === "pordonde"
        ? "Entradas al último tercio con pase bueno, por carril (derecha, centro, izquierda de quien ataca). La flecha más gruesa es por donde más llega."
        : capa === "calor"
          ? quien === "ambos"
            ? "Mapa de calor de los toques: en cada zona, el color del que más toca ahí, más intenso cuanto más diferencia. Elige un equipo para ver sólo el suyo."
            : "Mapa de calor de los toques de un equipo (suavizado unos 6 m): más intenso y más claro donde más toca."
          : "Posición media de los titulares (todo el partido) y los pases entre ellos (3 o más).";

  return (
    <Panel
      id="sala-campo"
      titulo={`El campo · ${v.nombre}`}
      detalle={detalle}
      derecha={
        <div className="flex max-w-full flex-wrap gap-1">
          {opciones.map((o) => (
            <Pastilla key={o.k} activa={capa === o.k} onClick={() => setCapa(o.k)}>
              {o.t}
            </Pastilla>
          ))}
        </div>
      }
    >
      {(capa === "remates" || capa === "pordonde" || capa === "calor") && (
        <div className="mb-2 flex gap-1 overflow-x-auto" role="group" aria-label="De quién">
          <Pastilla activa={quien === "ambos"} onClick={() => { setQuien("ambos"); }}>
            Los dos
          </Pastilla>
          {(["L", "V"] as Lado[]).map((l) => (
            <Pastilla key={l} activa={quien === l} onClick={() => { setQuien(l); if (tiroElegido && tiroElegido.lado !== l) setElegido(null); }}>
              <span style={{ color: colorDe(p, l) }}>●</span> {cortoDe(p, l)}
            </Pastilla>
          ))}
        </div>
      )}
      {capa === "remates" && (
        <p className="mb-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-[12px] [&>span]:whitespace-nowrap" style={{ color: S.suave }} aria-label="Leyenda">
          <span>⬤ tamaño = xG</span>
          <span className="inline-flex items-center gap-1"><span className="inline-block h-3 w-3 rounded-full" style={{ background: S.info }} /> a puerta</span>
          <span className="inline-flex items-center gap-1"><span className="inline-block h-3 w-3 rounded-full" style={{ border: `2px solid ${S.info}` }} /> fuera</span>
          <span>✕ bloqueado</span>
          <span className="inline-flex items-center gap-1"><span className="inline-block h-3 w-3 rounded-full" style={{ border: `2px solid ${S.oro}` }} /> gol</span>
          <span className="inline-flex items-center gap-1"><span className="inline-block h-3 w-3 rounded-[3px]" style={{ border: `2px solid ${S.suave}` }} /> balón parado</span>
        </p>
      )}
      <div className="mb-1 flex items-center justify-between gap-2 px-[2%] text-[12px] font-bold sm:text-[14px]">
        <span style={{ color: p.visitante.color }}>← ataca {cortoDe(p, "V")}</span>
        <span style={{ color: p.local.color }}>ataca {cortoDe(p, "L")} →</span>
      </div>
      <div className="relative w-full">
        <svg viewBox="-24 -16 1098 712" className="block h-auto w-full" role="img" aria-label="Campo con los remates, por dónde llega, el territorio o la red de pases">
          <defs>
            <linearGradient id="sala-cesped" x1="0" x2="1">
              <stop offset="0" stopColor="#06231A" />
              <stop offset="0.5" stopColor="#0A2E22" />
              <stop offset="1" stopColor="#06231A" />
            </linearGradient>
            <filter id="sala-luz" x="-50%" y="-50%" width="200%" height="200%">
              <feGaussianBlur stdDeviation="6" result="b" />
              <feMerge>
                <feMergeNode in="b" />
                <feMergeNode in="SourceGraphic" />
              </feMerge>
            </filter>
            {(["L", "V"] as Lado[]).map((l) => (
              <radialGradient key={l} id={`sala-halo-${l}`}>
                <stop offset="0" stopColor={colorDe(p, l)} stopOpacity="0.55" />
                <stop offset="1" stopColor={colorDe(p, l)} stopOpacity="0" />
              </radialGradient>
            ))}
            <marker id="sala-flecha" viewBox="0 0 10 10" refX="6" refY="5" markerWidth="4" markerHeight="4" orient="auto-start-reverse">
              <path d="M0,0 L10,5 L0,10 z" fill="context-stroke" />
            </marker>
          </defs>
          <rect x="0" y="0" width="1050" height="680" fill="url(#sala-cesped)" />
          {Array.from({ length: 10 }, (_, i) => (
            <rect key={i} x={i * 105} y="0" width="105" height="680" fill={i % 2 ? "rgba(255,255,255,0.02)" : "transparent"} />
          ))}

          {calor?.href && <image href={calor.href} x="0" y="0" width="1050" height="680" preserveAspectRatio="none" style={{ imageRendering: "auto", pointerEvents: "none" }} />}

          <Lineas />

          {vias &&
            lados.map((l) => {
              const ca = vias[l];
              const max = Math.max(1, ...ca.lista.map((x) => x.n));
              /* Tres flechas en el último tercio de quien ataca; y del carril: 0-33 derecha, 33-67 centro, 67-100 izquierda. */
              return ca.lista.map((x, i) => {
                const yC = [16.7, 50, 83.3][i];
                const grosor = 6 + 30 * (x.n / max);
                const pct = ca.total ? Math.round((x.n / ca.total) * 100) : 0;
                return (
                  <g key={`${l}${x.clave}`} opacity={x.n ? 1 : 0.35}>
                    <line x1={cx(l, 52)} y1={cy(l, yC)} x2={cx(l, 86)} y2={cy(l, yC)} stroke={colorDe(p, l)} strokeOpacity={0.35 + 0.6 * (x.n / max)} strokeWidth={grosor} strokeLinecap="round" markerEnd="url(#sala-flecha)" />
                    <text x={cx(l, 69)} y={cy(l, yC) + 8} textAnchor="middle" fontSize="26" fontWeight="800" fill="#fff" paintOrder="stroke" stroke="#04131c" strokeWidth="6">
                      {pct} %
                    </text>
                  </g>
                );
              });
            })}

          {capa === "remates" &&
            vistos.map((s, i) => {
              const r = 9 + Math.sqrt(Math.max(0.01, s.xG)) * 44;
              const esUltimo = s === ultimo;
              const X = cx(s.lado, s.x), Y = cy(s.lado, s.y);
              const color = colorDe(p, s.lado);
              const abp = esAbp(s.jugada);
              return (
                <g key={i} filter={s.gol ? "url(#sala-luz)" : undefined} onClick={() => setElegido(claveTiro(s) === elegido ? null : claveTiro(s))} style={{ cursor: "pointer" }}>
                  <circle cx={X} cy={Y} r={r * 1.9} fill={`url(#sala-halo-${s.lado})`} />
                  {esUltimo && <circle cx={X} cy={Y} r={r} fill="none" stroke={color} strokeWidth="3" className="sala-onda" />}
                  {s.gol && <circle cx={X} cy={Y} r={r + 9} fill="none" stroke={S.oro} strokeWidth="3" strokeOpacity="0.9" />}
                  {abp ? (
                    <rect x={X - r} y={Y - r} width={r * 2} height={r * 2} rx={r * 0.3} fill={color} fillOpacity={s.gol ? 0.95 : s.aPuerta ? 0.7 : 0.12} stroke={s.gol ? "#fff" : color} strokeWidth={s.gol ? 4 : 2.5} className="sala-pop" />
                  ) : (
                    <circle cx={X} cy={Y} r={r} fill={color} fillOpacity={s.gol ? 0.95 : s.aPuerta ? 0.7 : 0.12} stroke={s.gol ? "#fff" : color} strokeWidth={s.gol ? 4 : 2.5} className="sala-pop" />
                  )}
                  {s.bloqueado && (
                    <path d={`M${X - r * 0.55},${Y - r * 0.55} L${X + r * 0.55},${Y + r * 0.55} M${X + r * 0.55},${Y - r * 0.55} L${X - r * 0.55},${Y + r * 0.55}`} stroke="#fff" strokeOpacity="0.8" strokeWidth="3" />
                  )}
                  {s === tiroElegido && <circle cx={X} cy={Y} r={r + 5} fill="none" stroke="#fff" strokeWidth="3" strokeDasharray="6 5" />}
                  <circle cx={X} cy={Y} r={Math.max(r, 22)} fill="transparent">
                    <title>{`${reloj(s.min, s.parte)} · ${p.jugadores.get(s.jugador)?.corto ?? ""} · xG ${fmt(s.xG, 2)}${s.gol ? " · GOL" : s.aPuerta ? " · a puerta" : ""}`}</title>
                  </circle>
                </g>
              );
            })}

          {redes &&
            (() => {
              const l: Lado = capa === "redL" ? "L" : "V";
              const pos = new Map(redes.nodos.map((n) => [n.id, n]));
              const maxN = Math.max(1, ...redes.enlaces.map((e) => e.n));
              const maxT = Math.max(1, ...redes.nodos.map((n) => n.toques));
              return (
                <g>
                  {redes.enlaces.map((e, i) => {
                    const a = pos.get(e.a)!, b = pos.get(e.b)!;
                    return <line key={i} x1={cx(l, a.x)} y1={cy(l, a.y)} x2={cx(l, b.x)} y2={cy(l, b.y)} stroke={colorDe(p, l)} strokeOpacity={0.25 + 0.6 * (e.n / maxN)} strokeWidth={1 + 9 * (e.n / maxN)} strokeLinecap="round" />;
                  })}
                  {redes.nodos.map((n) => (
                    <g key={n.id} filter="url(#sala-luz)">
                      <circle cx={cx(l, n.x)} cy={cy(l, n.y)} r={16 + 14 * (n.toques / maxT)} fill="#061424" stroke={colorDe(p, l)} strokeWidth="3.5" />
                      <text x={cx(l, n.x)} y={cy(l, n.y) + 7} textAnchor="middle" fontSize="19" fontWeight="800" fill="#fff">
                        {n.dorsal || "·"}
                      </text>
                      <text x={cx(l, n.x)} y={cy(l, n.y) + 50} textAnchor="middle" fontSize="18" fontWeight="600" fill="rgba(235,245,255,0.92)" paintOrder="stroke" stroke="#04131c" strokeWidth="5">
                        {n.corto}
                      </text>
                    </g>
                  ))}
                </g>
              );
            })()}

        </svg>
      </div>

      {capa === "remates" && (tiroElegido ?? ultimo) && (() => {
        const s = (tiroElegido ?? ultimo) as Tiro;
        return (
          <p className="mt-2 rounded-lg px-3 py-2 text-center text-[14px]" style={{ background: "rgba(255,255,255,0.04)", color: S.suave, border: `1px solid ${S.borde}` }}>
            {tiroElegido ? "Remate elegido" : "Último remate"}: <b style={{ color: colorDe(p, s.lado) }}>{p.jugadores.get(s.jugador)?.corto ?? "—"}</b> · <span className="font-mono tabular-nums">{reloj(s.min, s.parte)}</span> · xG {fmt(s.xG, 2)}
            {s.gol ? " · GOL" : s.bloqueado ? " · bloqueado" : s.aPuerta ? " · a puerta" : " · fuera"} · {enArea(s.x, s.y) ? "desde el área" : "desde fuera"}
            {esAbp(s.jugada) ? (s.jugada === "penalti" ? " · de penalti" : ` · tras ${s.jugada === "corner" ? "córner" : s.jugada === "falta" ? "falta" : "balón parado"}`) : ""}
          </p>
        );
      })()}
      {capa === "calor" && calor && (
        <div className="mt-2 grid gap-1.5 text-center text-[13px]" style={{ color: S.suave }}>
          {quien === "ambos" ? (
            <>
              <p>
                {calor.zonas
                  .filter((z) => z.v > 0)
                  .map((z) => {
                    /* La zona contada desde quien ataca: tercio propio/medio/rival y su banda derecha/centro/izquierda. */
                    const col = z.l === "L" ? z.col : 5 - z.col;
                    const fila = z.l === "L" ? z.fila : 2 - z.fila;
                    const altura = col <= 1 ? "su campo" : col <= 3 ? "el medio" : "el último tercio";
                    const banda = fila === 0 ? "por su izquierda" : fila === 1 ? "por el centro" : "por su derecha";
                    return `${cortoDe(p, z.l)} manda en ${altura} ${banda}`;
                  })
                  .join(" · ")}
              </p>
              <p className="inline-flex items-center justify-center gap-2 text-[12px]" aria-label="Escala de color">
                <span>más {cortoDe(p, "V")}</span>
                <span className="h-2.5 w-28 rounded-full" style={{ background: `linear-gradient(90deg, ${p.visitante.color}, transparent 50%, ${p.local.color})` }} />
                <span>más {cortoDe(p, "L")}</span>
              </p>
            </>
          ) : (
            <p className="inline-flex items-center justify-center gap-2 text-[12px]" aria-label="Escala de color">
              <span>{calor.toques[quien]} toques · poco</span>
              <span className="h-2.5 w-28 rounded-full" style={{ background: `linear-gradient(90deg, transparent, ${colorDe(p, quien)} 60%, #fff)` }} />
              <span>mucho</span>
            </p>
          )}
        </div>
      )}
      {capa === "pordonde" && vias && (
        <p className="mt-2 text-center text-[13px]" style={{ color: S.suave }}>
          {lados
            .map((l) => {
              const ca = vias[l];
              if (!ca.total) return `${cortoDe(p, l)}: sin entradas al último tercio`;
              const m = ca.lista.reduce((a, b) => (b.n > a.n ? b : a));
              return `${cortoDe(p, l)}: ${ca.total} entradas, sobre todo por ${m.suyo} (${Math.round((m.n / ca.total) * 100)} %)`;
            })
            .join(" · ")}
        </p>
      )}
    </Panel>
  );
}

/* ------------------------------------------------------------------ */
/*  CARA A CARA CONTRA LA PREVIA                                       */
/* ------------------------------------------------------------------ */

type FilaDuelo = { nombre: string; L: number | null; V: number | null; d: number; previa?: string; porMinuto?: boolean; menosEsMejor?: boolean; pct?: boolean; nota?: string };

export function Duelo({ p, v, k }: { p: Partido; v: Ventana; k: Calibracion }) {
  const c = useMemo(() => cifrasEntre(p, v.desde, v.hasta, v.parte), [p, v.desde, v.hasta, v.parte]);
  const minutos = Math.max(1, v.parte === 1 ? Math.min(v.hasta, 46) : v.parte === 2 ? v.hasta - 45 : v.hasta - v.desde);
  /*
   * TODO DE OPTA (27/11/2026, el analista: «debe salir todo de Opta porque será
   * en directo, y tengo que ver la media»). Con el partido hasta lo último leído,
   * la cifra oficial del partido; en un tramo, la suma de los tramos oficiales
   * de 5′ ya cerrados. Lo que Opta no da por tramos (a puerta, acierto, PPDA,
   * córners) sale del evento a evento con su misma regla (cotejado: cuadra);
   * lo que no se puede contar así (ocasiones, centros, duelos), sólo con el
   * partido entero. Todas las filas con su media de la competición.
   */
  const o = useMemo(() => oficialEntre(p, v.desde, v.hasta, v.parte), [p, v.desde, v.hasta, v.parte]);
  const of = (l: Lado, m: string) => (l === "L" ? o.L : o.V)[m] ?? null;
  const entero = (m: string) => (o.entero ? { L: of("L", m), V: of("V", m) } : { L: null, V: null });
  /* 28/11/2026 (jueces de estilo): por importancia, lo que acerca al gol primero
     (xG, remates, área, llegadas) y luego cómo se juega. */
  const filas: FilaDuelo[] = [
    { nombre: "Goles esperados (xG)", L: of("L", "ExpG"), V: of("V", "ExpG"), d: 2, previa: "ExpG", porMinuto: true },
    { nombre: "Remates", L: of("L", "ShtIncBl"), V: of("V", "ShtIncBl"), d: 0, previa: "ShtIncBl", porMinuto: true },
    { nombre: "Toques en el área rival", L: of("L", "TouchOpBox"), V: of("V", "TouchOpBox"), d: 0, previa: "TouchOpBox", porMinuto: true },
    { nombre: "Llegadas al último tercio", ...entero("SeqEndInA3"), d: 0, previa: "SeqEndInA3", porMinuto: true, nota: "posesiones que acaban en el último tercio" },
    { nombre: "A puerta", L: o.entero ? of("L", "SOG") : aPuertaDe(c.L, k.aPuerta?.L), V: o.entero ? of("V", "SOG") : aPuertaDe(c.V, k.aPuerta?.V), d: 0, previa: "SOG", porMinuto: true },
    { nombre: "Ocasiones creadas", ...entero("Chance"), d: 0, previa: "Chance", porMinuto: true },
    { nombre: "Posesión", L: of("L", "Poss%"), V: of("V", "Poss%"), d: 0, pct: true, previa: "Poss%" },
    { nombre: "Acierto en el pase", L: o.entero ? of("L", "Pass%") : c.L.pases ? c.L.pasesOk / c.L.pases : null, V: o.entero ? of("V", "Pass%") : c.V.pases ? c.V.pasesOk / c.V.pases : null, d: 0, previa: "Pass%", pct: true },
    { nombre: "PPDA (presión)", L: o.entero ? of("L", "PPDA") : ppda(c.L, k.ppda.L), V: o.entero ? of("V", "PPDA") : ppda(c.V, k.ppda.V), d: 1, previa: "PPDA", menosEsMejor: true, nota: "pases del rival por cada acción defensiva propia: menos es presionar más" },
    { nombre: "Recuperaciones arriba", L: of("L", "PosWonA3rd"), V: of("V", "PosWonA3rd"), d: 0, previa: "PosWonA3rd", porMinuto: true, nota: "balones ganados en el último tercio" },
    { nombre: "Pérdidas", L: of("L", "PossLost"), V: of("V", "PossLost"), d: 0, previa: "PossLost", porMinuto: true, menosEsMejor: true },
    { nombre: "Centros", ...entero("Crosses"), d: 0, previa: "Crosses", porMinuto: true },
    { nombre: "Córners", L: o.entero ? of("L", "Corners") : c.L.corners, V: o.entero ? of("V", "Corners") : c.V.corners, d: 0, previa: "Corners", porMinuto: true },
    { nombre: "Duelos ganados", ...entero("Duel%"), d: 0, previa: "Duel%", pct: true },
  ].filter((x) => x.L != null || x.V != null);
  const media = (l: Lado, f: FilaDuelo) => {
    const e = l === "L" ? p.local : p.visitante;
    const m = f.previa ? e.previa?.medias[f.previa] : undefined;
    if (m == null) return null;
    return f.porMinuto ? (m * Math.min(minutos, 90)) / 90 : m;
  };
  const muestra = (x: number | null, f: FilaDuelo) => (x == null ? "—" : f.pct ? `${Math.round(x * 100)} %` : fmt(x, f.d));
  /*
   * La diferencia con su media, en verde si es mejor y en naranja si es peor.
   * 28/11/2026 (análisis): con cifras pequeñas (menos de 15 acciones o media
   * menor de 5: córners 1 frente a 4,8) un «−79 %» es ruido: se da la media
   * en absoluto y «tendencia», sin color. Y en el resto, la media al lado del
   * %, para que se vea de dónde sale (Castilla y Murcia dieron −49 % en centros
   * con medias distintas, 15,6 y 19,6: cotejado con opta:partidos, no es fallo).
   */
  const delta = (l: Lado, f: FilaDuelo) => {
    const x = f[l];
    const m = media(l, f);
    if (x == null || m == null || !m) return null;
    const mm = f.pct ? `${Math.round(m * 100)} %` : fmt(m, f.d === 0 && m >= 10 ? 0 : 1);
    const cuenta = f.d === 0 && !f.pct;
    if (cuenta && (Math.max(x, m) < 15 || m < 5)) return { corto: `media ${mm}`, texto: `su media ${mm} · tendencia`, color: S.tenue };
    const r = x / m - 1;
    if (Math.abs(r) < 0.15) return { corto: "≈ media", texto: `≈ su media (${mm})`, color: S.tenue };
    const mejor = f.menosEsMejor ? r < 0 : r > 0;
    /* Verde = bueno para nosotros; naranja = malo para nosotros (en el rival, al revés). Sin nosotros, neutro. */
    const color = !p.nuestro ? S.suave : (l === p.nuestro) === mejor ? S.favor : S.aviso;
    const n = Math.round(Math.abs(r) * 100);
    return { corto: `${r > 0 ? "+" : "−"}${n} %`, texto: `${r > 0 ? "+" : "−"}${n} % · su media ${mm}`, color };
  };
  const base = [p.local.previa?.pj, p.visitante.previa?.pj].filter(Boolean);
  return (
    <Panel
      id="sala-duelo"
      titulo={`Cara a cara · ${v.nombre}`}
      detalle={`${o.entero ? "Cifras oficiales de Opta del partido" : `Cifras oficiales de Opta por tramos de 5′${o.tramos ? "" : " (aún sin tramos)"}; ocasiones, centros y duelos, sólo con el partido hasta ahora`}. ${base.length ? `La raya blanca es lo que suele llevar cada uno en ese tiempo: su media de la competición sin este partido (${base.join(" y ")} partidos${base.some((n) => (n ?? 0) < 8) ? "; con menos de 8, tendencia" : ""}).` : ""}`}
    >
      {/* 28/11/2026 (jueces de estilo): la clave, una vez y fija arriba; el color se lee siempre desde nuestro lado,
          también en el rival (que pierda menos balones que su media es naranja: malo para nosotros). */}
      {/* Sin el Castilla (28/11/2026): la clave queda en la raya de la media; los colores, neutros. */}
      <p className="mb-3 flex flex-wrap items-center justify-center gap-x-4 gap-y-1 rounded-lg px-3 py-1.5 text-[12px]" style={{ background: "rgba(255,255,255,0.04)", border: `1px solid ${S.borde}`, color: S.suave }}>
        {p.nuestro && (
          <>
            <span className="inline-flex items-center gap-1.5"><span className="inline-block h-2.5 w-2.5 rounded-full" style={{ background: S.favor }} /> bueno para {cortoDe(p, p.nuestro)}</span>
            <span className="inline-flex items-center gap-1.5"><span className="inline-block h-2.5 w-2.5 rounded-full" style={{ background: S.aviso }} /> malo para {cortoDe(p, p.nuestro)}</span>
          </>
        )}
        <span className="inline-flex items-center gap-1.5"><span className="inline-block h-3 w-[3px] rounded" style={{ background: "#fff" }} /> su media</span>
        <span>«tendencia»: cifra pequeña, sin %</span>
      </p>
      <ul className="grid gap-3">
        {filas.map((f) => {
          const a = f.L ?? 0, b = f.V ?? 0;
          const maxEscala = f.pct ? 1 : Math.max(a, b, media("L", f) ?? 0, media("V", f) ?? 0, 0.0001) * 1.1;
          const ancho = (x: number | null) => (x == null ? 0 : Math.min(100, (x / maxEscala) * 100));
          const gana = f.L == null || f.V == null ? null : f.menosEsMejor ? (a < b ? "L" : b < a ? "V" : null) : a > b ? "L" : b > a ? "V" : null;
          const dL = delta("L", f), dV = delta("V", f);
          return (
            <li key={f.nombre} className="grid grid-cols-[3.6rem_minmax(0,1fr)_minmax(0,1fr)_3.6rem] items-center gap-x-2 gap-y-0.5">
              <span className="col-span-4 text-center text-[12px] font-semibold uppercase tracking-[0.12em]" style={{ color: S.suave }}>
                {f.nombre}
                {f.menosEsMejor && (
                  <span className="ml-1.5 rounded-full px-1.5 py-px align-middle text-[11px] font-semibold normal-case tracking-normal" style={{ border: `1px solid ${S.borde}`, color: S.tenue }}>
                    menos es mejor
                  </span>
                )}
              </span>
              <span className="text-right font-mono text-[16px] font-bold tabular-nums" style={{ color: gana === "L" ? p.local.color : S.texto }}>
                {muestra(f.L, f)}
              </span>
              <div className="relative h-3 overflow-hidden rounded-full" style={{ background: "rgba(255,255,255,0.05)" }}>
                <div className="absolute inset-y-0 right-0 rounded-full" style={{ width: `${ancho(f.L)}%`, background: `linear-gradient(270deg, ${p.local.color}, ${p.local.color}55)`, boxShadow: `0 0 12px ${p.local.color}88`, transition: "width .6s ease" }} />
                {media("L", f) != null && <div className="absolute inset-y-[-3px] w-[3px] rounded" style={{ right: `${ancho(media("L", f))}%`, background: "#fff", boxShadow: "0 0 6px #fff" }} title={`Su media: ${muestra(media("L", f), f)}`} />}
              </div>
              <div className="relative h-3 overflow-hidden rounded-full" style={{ background: "rgba(255,255,255,0.05)" }}>
                <div className="absolute inset-y-0 left-0 rounded-full" style={{ width: `${ancho(f.V)}%`, background: `linear-gradient(90deg, ${p.visitante.color}, ${p.visitante.color}55)`, boxShadow: `0 0 12px ${p.visitante.color}88`, transition: "width .6s ease" }} />
                {media("V", f) != null && <div className="absolute inset-y-[-3px] w-[3px] rounded" style={{ left: `${ancho(media("V", f))}%`, background: "#fff", boxShadow: "0 0 6px #fff" }} title={`Su media: ${muestra(media("V", f), f)}`} />}
              </div>
              <span className="font-mono text-[16px] font-bold tabular-nums" style={{ color: gana === "V" ? p.visitante.color : S.texto }}>
                {muestra(f.V, f)}
              </span>
              {(dL || dV || f.nota) && (
                <>
                  <span />
                  <span className="text-right text-[12px] font-semibold leading-tight" style={{ color: dL?.color ?? S.tenue }}>
                    <span className="sm:hidden">{dL?.corto ?? ""}</span>
                    <span className="hidden sm:inline">{dL?.texto ?? ""}</span>
                  </span>
                  <span className="text-[12px] font-semibold leading-tight" style={{ color: dV?.color ?? S.tenue }}>
                    <span className="sm:hidden">{dV?.corto ?? ""}</span>
                    <span className="hidden sm:inline">{dV?.texto ?? ""}</span>
                  </span>
                  <span />
                  {f.nota && (
                    <span className="col-span-4 text-center text-[11.5px]" style={{ color: S.tenue }}>
                      {f.nota}
                    </span>
                  )}
                </>
              )}
            </li>
          );
        })}
      </ul>
    </Panel>
  );
}

/* ------------------------------------------------------------------ */
/*  BALÓN PARADO Y TRANSICIONES                                        */
/* ------------------------------------------------------------------ */

export function AbpTransiciones({ p, v, enlace }: { p: Partido; v: Ventana; enlace?: EnlaceJugador }) {
  const c = useMemo(() => cifrasEntre(p, v.desde, v.hasta, v.parte), [p, v.desde, v.hasta, v.parte]);
  const tr = useMemo(() => transiciones(p, v.desde, v.hasta, v.parte), [p, v.desde, v.hasta, v.parte]);
  const conJugada = p.eventos.some((e) => e.jugada);
  const abp = useMemo(() => ({ L: detalleAbp(p, "L", v.desde, v.hasta, v.parte), V: detalleAbp(p, "V", v.desde, v.hasta, v.parte) }), [p, v.desde, v.hasta, v.parte]);
  const fila = (l: Lado) => {
    const yo = l === "L" ? c.L : c.V;
    const perd = tr.perdidas.filter((x) => x.lado === l);
    const robos = tr.robos.filter((x) => x.lado === l);
    return { yo, perd, robos };
  };
  const celda = (valor: ReactNode, pie: string) => (
    <div className="rounded-xl px-2 py-2 text-center" style={{ background: "rgba(255,255,255,0.03)", border: `1px solid ${S.borde}` }}>
      <div className="font-mono text-[20px] font-bold tabular-nums leading-tight" style={{ color: S.texto }}>
        {valor}
      </div>
      <div className="text-[11.5px] leading-tight" style={{ color: S.suave }}>
        {pie}
      </div>
    </div>
  );
  return (
    <Panel
      id="sala-abp"
      titulo={`Balón parado y transiciones · ${v.nombre}`}
      detalle={`${conJugada ? "Remates de córner, falta o penalti según Opta." : "Remates de balón parado: del mismo equipo hasta 10 s después de su córner o de una falta en campo rival."} Transición: una pérdida que acaba en remate del rival (o un robo en remate propio) en 15 s o menos.`}
    >
      <div className="grid gap-4">
        {(["L", "V"] as Lado[]).map((l) => {
          const { yo, perd, robos } = fila(l);
          const pctAbp = yo.xg ? Math.round((yo.xgAbp / yo.xg) * 100) : 0;
          return (
            <div key={l}>
              <p className="mb-1.5 flex items-center gap-2 text-[13px] font-bold uppercase tracking-[0.14em]" style={{ color: colorDe(p, l) }}>
                <span className="h-2 w-2 rounded-full" style={{ background: colorDe(p, l) }} /> {cortoDe(p, l)}
              </p>
              <div className="grid grid-cols-2 gap-2 sm:grid-cols-5">
                {celda(yo.corners, "córners a favor")}
                {celda(yo.tirosAbp, "remates de ABP")}
                {celda(<>{fmt(yo.xgAbp, 2)}</>, `xG de ABP (${pctAbp} % del suyo)`)}
                {celda(<span style={{ color: robos.length ? S.favor : S.texto }}>{robos.length}</span>, `robos que acaban en remate${robos.length ? ` · ${fmt(robos.reduce((s, x) => s + x.xG, 0), 2)} xG` : ""}`)}
                {celda(<span style={{ color: perd.length ? S.aviso : S.texto }}>{perd.length}</span>, `pérdidas que acaban en remate rival${perd.length ? ` · ${perd.filter((x) => x.x < 40).length} en salida` : ""}`)}
              </div>
              {(() => {
                /* Sólo lo que tiene dato (regla de los informes: lo que no hay no se nombra). */
                const a = abp[l];
                const tipos = c.tiros.filter((x) => x.lado === l && esAbp(x.jugada));
                const porTipo = (j: string) => tipos.filter((x) => x.jugada === j).length;
                const trozos = [
                  a.corners ? `${a.corners} ${a.corners === 1 ? "córner" : "córners"}: primer contacto propio en ${a.cornerContacto}${a.despejados ? `, ${a.despejados} ${a.despejados === 1 ? "despejado" : "despejados"} al primer toque` : ""}${a.cornerRemate1 ? `, ${a.cornerRemate1} remate en 1.ª jugada` : ""}${a.cornerRemate2 ? `, ${a.cornerRemate2} en 2.ª` : ""}` : "",
                  a.faltasLaterales ? `${a.faltasLaterales} ${a.faltasLaterales === 1 ? "falta lateral" : "faltas laterales"} al área` : "",
                  a.faltasDirectas ? `${a.faltasDirectas} ${a.faltasDirectas === 1 ? "falta directa" : "faltas directas"} a puerta` : "",
                  a.bandasLargas ? `${a.bandasLargas} ${a.bandasLargas === 1 ? "saque de banda largo" : "saques de banda largos"} al área` : "",
                  tipos.length ? `remates de ABP: ${[["corner", "tras córner"], ["falta", "tras falta"], ["penalti", "de penalti"], ["abp", "otras jugadas a balón parado"]].map(([j, t]) => (porTipo(j) ? `${porTipo(j)} ${t}` : "")).filter(Boolean).join(", ")}` : "",
                ].filter(Boolean);
                return trozos.length ? (
                  <p className="mt-1.5 text-[13px] leading-snug" style={{ color: S.suave }}>
                    {trozos.join(" · ")}
                  </p>
                ) : null;
              })()}
              {perd.length > 0 && (
                <p className="mt-1 text-[13px] leading-snug" style={{ color: S.suave }}>
                  <b style={{ color: S.texto }}>Pérdidas que costaron remate:</b>{" "}
                  {perd.map((x, i) => {
                    const j = p.jugadores.get(x.jugador);
                    return (
                      <span key={i}>
                        {i > 0 && " · "}
                        {reloj(x.min, x.parte)} <NombreJugador lado={l} nombre={j?.nombre ?? ""} texto={j?.corto ?? ""} enlace={j ? enlace : undefined} />
                        {x.x < 40 ? " (en salida)" : ""}
                        {x.gol ? " → gol" : ""}
                      </span>
                    );
                  })}
                </p>
              )}
            </div>
          );
        })}
      </div>
    </Panel>
  );
}

/* ------------------------------------------------------------------ */
/*  LOS JUGADORES DE CADA EQUIPO                                       */
/* ------------------------------------------------------------------ */

export function Jugadores({ p, v, enlace }: { p: Partido; v: Ventana; enlace?: EnlaceJugador }) {
  const nuestro: Lado = p.nuestro ?? "L";
  const rival = otro(nuestro);
  const listas = useMemo(() => ({ n: jugadoresDe(p, nuestro, v.desde, v.hasta, 5, v.parte), r: jugadoresDe(p, rival, v.desde, v.hasta, 5, v.parte) }), [p, nuestro, rival, v.desde, v.hasta, v.parte]);
  const bloque = (l: Lado, titulo: string, lista: typeof listas.n, rivalDe: boolean) => {
    const color = colorDe(p, l);
    const max = Math.max(0.01, ...lista.map((d) => d.amenaza));
    return (
      <div className="min-w-0">
        <p className="mb-2 text-[13px] font-bold uppercase tracking-[0.14em]" style={{ color }}>
          {titulo}
        </p>
        <ol className="grid gap-1.5">
          {lista.map((d, i) => (
            <li key={d.jugador.id} className="grid grid-cols-[2.2rem_minmax(0,1fr)] items-center gap-x-2.5 gap-y-1 rounded-xl px-2.5 py-2 sala-entra sm:grid-cols-[2.2rem_minmax(0,1fr)_auto]" style={{ background: i === 0 ? `linear-gradient(90deg, ${color}26, transparent)` : "rgba(255,255,255,0.02)", border: `1px solid ${i === 0 ? `${color}66` : S.borde}` }}>
              <span className="grid h-9 w-9 place-items-center rounded-full font-mono text-[14px] font-bold" style={{ background: "#061424", border: `2px solid ${color}`, color: S.texto, boxShadow: `0 0 14px ${color}66` }}>
                {d.jugador.dorsal || i + 1}
              </span>
              <span className="min-w-0">
                <span className="block truncate text-[14px] font-semibold" style={{ color: S.texto }}>
                  {/* 28/11/2026 (los tres jueces): el nombre abre su ficha (y, en los nuestros, su seguimiento). */}
                  <NombreJugador lado={l} nombre={d.jugador.nombre} texto={d.jugador.corto} enlace={enlace} seguimiento />
                  {d.goles > 0 && <span className="ml-1.5">{"⚽".repeat(Math.min(3, d.goles))}</span>}
                </span>
                <span className="mt-1 block h-1.5 overflow-hidden rounded-full" style={{ background: "rgba(255,255,255,0.06)" }}>
                  <span className="block h-full rounded-full" style={{ width: `${(d.amenaza / max) * 100}%`, background: `linear-gradient(90deg, ${color}66, ${color})`, transition: "width .6s ease" }} />
                </span>
              </span>
              <span className="col-start-2 font-mono text-[12px] leading-tight tabular-nums sm:col-start-auto sm:text-right" style={{ color: S.suave }}>
                <b style={{ color: S.texto }}>{fmt(d.amenaza, 2)}</b> amenaza
                <br className="hidden sm:block" />
                <span className="sm:hidden"> · </span>
                {rivalDe ? `xG ${fmt(d.xg, 2)} · recibe en área ${d.recibeArea}` : `xG ${fmt(d.xg, 2)} · ${d.defensivas} acc. def.${d.perdidasPropio ? ` · ${d.perdidasPropio} ${d.perdidasPropio === 1 ? "pérdida" : "pérdidas"} en campo propio` : ""}`}
              </span>
            </li>
          ))}
        </ol>
      </div>
    );
  };
  return (
    <Panel
      titulo={`Quién marca el partido · ${v.nombre}`}
      detalle={
        p.nuestro
          ? "Amenaza = xG de sus remates + valor de sus demás acciones (xPV). En el rival, cuántas veces recibe en el área (a quién vigilar); en los nuestros, acciones defensivas y pérdidas en campo propio. Toca un nombre para abrir su ficha."
          : "Amenaza = xG de sus remates + valor de sus demás acciones (xPV), y cuántas veces recibe cada uno en el área."
      }
    >
      <div className="grid gap-5 md:grid-cols-2">
        {bloque(nuestro, p.nuestro ? `Los nuestros · ${cortoDe(p, nuestro)}` : cortoDe(p, nuestro), listas.n, !p.nuestro)}
        {bloque(rival, p.nuestro ? `Su peligro · ${cortoDe(p, rival)}` : cortoDe(p, rival), listas.r, true)}
      </div>
    </Panel>
  );
}

/* ------------------------------------------------------------------ */
/*  BARRA DE REPETICIÓN                                                */
/* ------------------------------------------------------------------ */

export function Linea({ p, t, max, hitos, final, onCambia }: { p: Partido; t: number; max: number; hitos: Hito[]; final: boolean; onCambia: (m: number) => void }) {
  /* Sin destripar la repetición (experto de análisis): lo que aún no ha pasado sale neutro, sin balón ni equipo. */
  const visto = (h: Hito) => final || h.min <= t;
  const goles = hitos.filter((h) => h.tipo === "gol");
  const tiros = hitos.filter((h) => h.tipo === "tiro" || h.tipo === "parada");
  const marcas = hitos.filter((h) => h.tipo === "amarilla" || h.tipo === "roja" || h.tipo === "cambio");
  return (
    <div className="relative h-11 w-full">
      <div className="absolute inset-x-0 top-1/2 h-1 -translate-y-1/2 rounded-full" style={{ background: "rgba(255,255,255,0.1)" }} />
      <div className="absolute left-0 top-1/2 h-1 -translate-y-1/2 rounded-full" style={{ width: `${(t / max) * 100}%`, background: `linear-gradient(90deg, ${p.local.color}, ${p.visitante.color})` }} />
      {tiros.filter(visto).map((h, i) => (
        <span key={i} aria-hidden className="absolute hidden h-2 w-[2px] rounded sm:block" style={{ left: `${(h.min / max) * 100}%`, top: h.lado === "L" ? 7 : 28, background: colorDe(p, h.lado), opacity: h.tipo === "parada" ? 0.9 : 0.45 }} />
      ))}
      {marcas.filter(visto).map((h, i) => (
        <span key={i} aria-hidden className="absolute h-2.5 w-1.5 -translate-x-1/2 rounded-[1px]" style={{ left: `${(h.min / max) * 100}%`, top: h.lado === "L" ? 0 : 33, background: h.tipo === "amarilla" ? "#F5D547" : h.tipo === "roja" ? "#FF3B4E" : "rgba(255,255,255,0.7)" }} />
      ))}
      {goles.map((h, i) =>
        visto(h) ? (
          <span key={i} aria-hidden className="absolute -translate-x-1/2 text-[14px] leading-none" style={{ left: `${(h.min / max) * 100}%`, top: h.lado === "L" ? -4 : 28 }}>
            ⚽
          </span>
        ) : null,
      )}
      <input type="range" min={0} max={max} step={0.25} value={t} onChange={(e) => onCambia(Number(e.target.value))} aria-label="Minuto del partido" className="absolute inset-0 w-full cursor-pointer opacity-0" />
      <span aria-hidden className="pointer-events-none absolute top-1/2 h-4 w-4 -translate-x-1/2 -translate-y-1/2 rounded-full" style={{ left: `${(t / max) * 100}%`, background: "#fff", boxShadow: "0 0 14px rgba(160,210,255,0.9)" }} />
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  HACIA DÓNDE VA (27/11/2026)                                        */
/* ------------------------------------------------------------------ */

export function HaciaDonde({ p, r, final }: { p: Partido; r: Rumbo; final: boolean }) {
  if (!r.ahora.length && !r.cambio && !r.proyeccion) return null;
  const pct = (x: number) => `${Math.round(x * 100)} %`;
  return (
    <Panel titulo={final ? "Cómo se movió el partido" : "Hacia dónde va"} detalle="Los últimos 15′ contra lo de antes y lo que cambió con los cambios. Cifras oficiales de Opta por tramos de 5′, por 90 minutos para poder comparar.">
      <div className="grid gap-2 text-[14px] leading-snug" style={{ color: S.suave }}>
        {r.ahora.map((x, i) => (
          <p key={i} className="flex gap-2">
            <span aria-hidden style={{ color: S.info }}>→</span>
            <span>{x}</span>
          </p>
        ))}
        {r.cambio && (
          <div className="rounded-xl px-3 py-2" style={{ background: "rgba(255,255,255,0.04)", border: `1px solid ${S.borde}` }}>
            <p className="flex items-center gap-1.5 font-semibold" style={{ color: S.texto }}>
              <ArrowLeftRight size={14} aria-hidden /> {r.cambio.titulo}
            </p>
            {r.cambio.frases.map((x, i) => (
              <p key={i} className="mt-1 text-[13px]">{x}</p>
            ))}
          </div>
        )}
        {r.proyeccion && (
          <div className="rounded-xl px-3 py-2" style={{ background: "rgba(233,196,106,0.07)", border: "1px solid rgba(233,196,106,0.35)" }}>
            <p className="text-[12px] font-semibold uppercase tracking-[0.12em]" style={{ color: S.oro }}>
              Si sigue así, en los {Math.round(r.proyeccion.restante)}′ que quedan
            </p>
            {(["L", "V"] as Lado[]).map((l) => (
              <p key={l} className="mt-1 text-[14px]">
                <b style={{ color: colorDe(p, l) }}>{cortoDe(p, l)}</b>: unos {fmt(r.proyeccion![l].xg, 2)} de xG más · {pct(r.proyeccion![l].marca)} de marcar al menos uno
              </p>
            ))}
          </div>
        )}
      </div>
    </Panel>
  );
}

/* ------------------------------------------------------------------ */
/*  EL PLAN EN EL CAMPO (27/11/2026)                                   */
/* ------------------------------------------------------------------ */

export function PlanEnCampo({ cruces, jornada }: { cruces: Cruce[]; jornada: string }) {
  const [todas, setTodas] = useState(false);
  if (!cruces.length) return null;
  /* Primero lo que tiene cifra y dice algo (bien o mal); las líneas sin cifra, plegadas. */
  const conCifra = cruces.filter((c) => c.cifra);
  const sin = cruces.filter((c) => !c.cifra);
  const orden = [...conCifra.filter((c) => c.tono !== "neutro"), ...conCifra.filter((c) => c.tono === "neutro")];
  const color = (c: Cruce) => (c.tono === "bien" ? S.favor : c.tono === "mal" ? S.aviso : S.tenue);
  return (
    <Panel titulo="El plan, en el campo" detalle={`Cada línea del plan de partido${jornada ? ` (${jornada})` : ""} con la cifra de Opta que la mide y su media. Verde, bueno para nosotros; naranja, malo; en gris, sólo el dato.`}>
      <ul className="grid gap-2">
        {orden.map((c, i) => (
          <li key={i} className="rounded-xl px-3 py-2 text-[13px] leading-snug" style={{ background: "rgba(255,255,255,0.035)", borderLeft: `3px solid ${color(c)}` }}>
            <p style={{ color: S.texto }}>
              <span className="mr-1.5 text-[11px] font-semibold uppercase tracking-[0.1em]" style={{ color: S.oro }}>{c.apartado}</span>
              {c.linea}
            </p>
            <p className="mt-0.5" style={{ color: S.suave }}>
              {c.cifra} · <b style={{ color: color(c) }}>{c.lectura}</b>
            </p>
          </li>
        ))}
      </ul>
      {sin.length > 0 && (
        <div className="mt-2">
          <button type="button" onClick={() => setTodas((x) => !x)} className="text-[12px] font-semibold underline" style={{ color: S.suave }}>
            {todas ? "Ocultar" : "Ver"} las {sin.length} líneas del plan sin cifra de Opta
          </button>
          {todas && (
            <ul className="mt-1 grid gap-1 text-[12.5px]" style={{ color: S.tenue }}>
              {sin.map((c, i) => (
                <li key={i}>
                  <span className="mr-1 font-semibold" style={{ color: S.suave }}>{c.apartado}:</span>
                  {c.linea}
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </Panel>
  );
}
