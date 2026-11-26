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
*/

import { useMemo, useState, type ReactNode } from "react";
import { AlertTriangle, ArrowLeftRight, Flame, Zap } from "lucide-react";

import {
  DURACION,
  aPuertaDe,
  carriles,
  cifrasEntre,
  detalleAbp,
  curvaProbabilidad,
  curvaXg,
  dominio,
  enArea,
  esAbp,
  jugadoresDe,
  lecturaTramo,
  nombreEquipoCorto,
  porcentaje,
  posesion,
  ppda,
  pulso,
  red,
  reloj,
  territorio,
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

export function Panel({ titulo, detalle, children, className = "", derecha }: { titulo: string; detalle?: ReactNode; children: ReactNode; className?: string; derecha?: ReactNode }) {
  return (
    <section
      className={`relative min-w-0 overflow-hidden rounded-2xl p-4 sm:p-5 sala-entra ${className}`}
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
}) {
  const ultimoNombre = (n: string) => n.split(" ").slice(-1)[0] ?? n;
  const avance = Math.min(1, t / DURACION);
  const R = 34;
  const circ = 2 * Math.PI * R;
  const final = modo === "final";
  const marcas = hitos.filter((h) => h.tipo === "gol" || h.tipo === "amarilla" || h.tipo === "roja" || h.tipo === "cambio");

  const equipo = (l: Lado) => {
    const e = l === "L" ? p.local : p.visitante;
    const yo = l === "L" ? c.L : c.V;
    const color = e.color;
    /* Los goles siempre (el 26/11 los cinco cambios del Murcia los echaban de la lista); luego tarjetas y cambios hasta 7. */
    const delLado = marcas.filter((h) => h.lado === l);
    const peso = (h: Hito) => (h.tipo === "gol" ? 0 : h.tipo === "roja" ? 1 : h.tipo === "amarilla" ? 2 : 3);
    const suyas = [...delLado].sort((a, b) => peso(a) - peso(b) || a.min - b.min).slice(0, 7).sort((a, b) => a.min - b.min);
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
          <span>
            {yo.tiros} rem. · {aPuertaDe(yo, l === "L" ? k.aPuerta?.L : k.aPuerta?.V)} a puerta
          </span>
        </span>
        {/* Goles, tarjetas y cambios (estos dos, en los documentos desde el 26/11/2026). */}
        {suyas.length > 0 && (
          <ul className={`mt-2 grid gap-0.5 text-[12px] sm:text-[13px] ${derecha ? "justify-items-end" : ""}`} style={{ color: S.suave }}>
            {suyas.map((h, i) => (
              <li key={i} className="flex max-w-full items-center gap-1.5 truncate">
                {h.tipo === "gol" ? <span aria-label="Gol">⚽</span> : h.tipo === "amarilla" ? <span aria-label="Amarilla" className="inline-block h-3 w-2 rounded-[2px]" style={{ background: "#F5D547" }} /> : h.tipo === "roja" ? <span aria-label="Roja" className="inline-block h-3 w-2 rounded-[2px]" style={{ background: "#FF3B4E" }} /> : <ArrowLeftRight size={12} aria-label="Cambio" />}
                <span className="font-mono tabular-nums" style={{ color: S.texto }}>
                  {reloj(h.min, h.parte)}
                </span>
                {/* En el móvil sólo el apellido («Ciria», no «Ciria po…»). */}
                <span className="sm:hidden">{h.tipo === "cambio" ? `⇄ ${ultimoNombre(h.entra ?? "?")}` : ultimoNombre(h.jugador)}</span>
                <span className="hidden truncate sm:inline">
                  {h.tipo === "cambio" ? `${h.entra ?? "?"} por ${h.jugador}` : h.jugador}
                  {h.tipo === "gol" && h.xG != null ? <span style={{ color: S.tenue }}> · xG {fmt(h.xG, 2)}</span> : null}
                </span>
              </li>
            ))}
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
                {final ? "FIN" : reloj(t, parte)}
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

      {/* LA FICHA DE CADA GOL (experto de fútbol): de dónde nace, cuánto tarda y desde dónde se remata. */}
      {fichas.length > 0 && (
        <ul className="relative mx-auto mt-3 grid max-w-[58rem] gap-1.5" aria-label="Cómo llegó cada gol">
          {fichas.map((g, i) => (
            <li key={i} className="rounded-lg px-3 py-1.5 text-[13px] leading-snug sm:text-[14px]" style={{ background: "rgba(255,255,255,0.035)", borderLeft: `3px solid ${colorDe(p, g.lado)}`, color: S.suave }}>
              <span className="font-mono font-bold tabular-nums" style={{ color: S.texto }}>
                ⚽ {reloj(g.min, g.parte)} · {g.marcador}
              </span>{" "}
              <b style={{ color: colorDe(p, g.lado) }}>{g.goleador}</b>
              {g.asistente ? <span> (pase de {g.asistente})</span> : null} · {g.origen} · {g.pases} {g.pases === 1 ? "pase" : "pases"} · {g.segundos} s · {g.zona}
              {g.xG != null ? <span style={{ color: S.tenue }}> · xG {fmt(g.xG, 2)}</span> : null}
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
    <div className="flex min-w-0 items-center gap-2 overflow-x-auto pb-1" role="group" aria-label="Qué tramo del partido se mira">
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
    <Panel titulo={final ? "Lo que pasó" : "Lo que está pasando"} detalle={final ? "Lo que se salió de lo normal en el partido. Verde, bueno para nosotros; naranja, malo." : p.nuestro ? "Verde, bueno para nosotros; naranja, a vigilar. Se recalcula a cada minuto." : "Lo que se sale de lo normal en el partido."}>
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

export function Lectura({ p, v, titulo, omitir, tocar, final = false }: { p: Partido; v: Ventana; titulo: string; omitir: Set<string>; tocar: string[]; final?: boolean }) {
  const frases = useMemo(() => lecturaTramo(p, v.desde, v.hasta, v.parte, omitir), [p, v.desde, v.hasta, v.parte, omitir]);
  if (!frases.length && !tocar.length) return null;
  return (
    <Panel titulo={titulo} detalle={`Lo que dejó ${v.nombre} y, desde nuestro lado, qué tocar (reglas sobre las cifras de la sala).`}>
      {tocar.length > 0 && (
        <div className="mb-3 rounded-xl p-3" style={{ background: "rgba(233,196,106,0.08)", border: "1px solid rgba(233,196,106,0.4)" }}>
          <p className="mb-1.5 text-[12px] font-bold uppercase tracking-[0.16em]" style={{ color: S.oro }}>
            {final ? "Para el próximo partido" : "Qué tocar"}
          </p>
          <ul className="grid gap-1.5">
            {tocar.map((x, i) => (
              <li key={i} className="flex gap-2 text-[14px] leading-snug" style={{ color: S.texto }}>
                <span aria-hidden style={{ color: S.oro }}>→</span>
                <span>{x}</span>
              </li>
            ))}
          </ul>
        </div>
      )}
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
    <Panel titulo="El partido por tramos" detalle="Cada 15′ (el descuento va con su tramo): xG y remates de cada uno, y el dominio territorial (de los pases en el último tercio, cuántos son de cada uno).">
      <div className="grid gap-1.5">
        <div className="grid grid-cols-[3.6rem_minmax(0,1fr)_minmax(0,1fr)_minmax(4.5rem,0.7fr)] items-center gap-2 text-[11px] uppercase tracking-[0.12em]" style={{ color: S.tenue }}>
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
          <div key={x.etiqueta} className="grid grid-cols-[3.6rem_minmax(0,1fr)_minmax(0,1fr)_minmax(4.5rem,0.7fr)] items-center gap-2">
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
            <div className="flex h-3 overflow-hidden rounded-full" title={x.dominio ? `${cortoDe(p, "L")} ${Math.round(x.dominio.L * 100)} % · ${cortoDe(p, "V")} ${Math.round(x.dominio.V * 100)} %` : "Sin pases en el último tercio"}>
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
        ))}
      </div>
      <p className="mt-2 text-[12px]" style={{ color: S.tenue }}>
        Cifra = xG · remates. La barra del dominio, de izquierda a derecha: {cortoDe(p, "L")} y {cortoDe(p, "V")}.
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
    <Panel titulo="Probabilidad minuto a minuto" detalle="Abajo gana el local, arriba el visitante y en medio el empate. Sale de los goles que faltan con el ritmo de xG de cada uno: su media de la competición mezclada con lo que lleva hoy.">
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

export type Capa = "remates" | "pordonde" | "territorio" | "redL" | "redV";

/** Coordenadas del campo (105 × 68 → 1050 × 680), el local ataca a la derecha. */
const cx = (l: Lado, x: number) => (l === "L" ? x : 100 - x) * 10.5;
const cy = (l: Lado, y: number) => (l === "L" ? 100 - y : y) * 6.8;

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
  const [elegido, setElegido] = useState<number | null>(null);
  const { tiros } = useMemo(() => cifrasEntre(p, v.desde, v.hasta, v.parte), [p, v.desde, v.hasta, v.parte]);
  const lados: Lado[] = quien === "ambos" ? ["L", "V"] : [quien];
  const vistos = tiros.filter((s) => lados.includes(s.lado));
  const ultimo = vistos.at(-1);
  const tiroElegido = elegido != null ? vistos[elegido] : null;
  const territorios = useMemo(() => (capa === "territorio" ? { L: territorio(p, "L", v.hasta, v.desde, v.parte), V: territorio(p, "V", v.hasta, v.desde, v.parte) } : null), [p, v.hasta, v.desde, v.parte, capa]);
  const redes = useMemo(() => (capa === "redL" || capa === "redV" ? red(p, capa === "redL" ? "L" : "V", t) : null), [p, t, capa]);
  const vias = useMemo(() => (capa === "pordonde" ? { L: carriles(p, "L", v.desde, v.hasta, v.parte), V: carriles(p, "V", v.desde, v.hasta, v.parte) } : null), [p, v.desde, v.hasta, v.parte, capa]);

  const opciones: { k: Capa; t: string }[] = [
    { k: "remates", t: "Remates" },
    { k: "pordonde", t: "Por dónde llega" },
    { k: "territorio", t: "Territorio" },
    { k: "redL", t: `Red · ${cortoDe(p, "L")}` },
    { k: "redV", t: `Red · ${cortoDe(p, "V")}` },
  ];

  const detalle =
    capa === "remates"
      ? "Toca un remate para ver quién, cuándo y de dónde."
      : capa === "pordonde"
        ? "Entradas al último tercio con pase bueno, por carril (derecha, centro, izquierda de quien ataca). La flecha más gruesa es por donde más llega."
        : capa === "territorio"
          ? "Quién domina cada zona: el color del que más toca ahí, más intenso cuanto más."
          : "Posición media de los titulares (todo el partido) y los pases entre ellos (3 o más).";

  return (
    <Panel
      titulo={`El campo · ${v.nombre}`}
      detalle={detalle}
      derecha={
        <div className="flex max-w-full gap-1 overflow-x-auto pb-1">
          {opciones.map((o) => (
            <Pastilla key={o.k} activa={capa === o.k} onClick={() => setCapa(o.k)}>
              {o.t}
            </Pastilla>
          ))}
        </div>
      }
    >
      {(capa === "remates" || capa === "pordonde") && (
        <div className="mb-2 flex gap-1 overflow-x-auto" role="group" aria-label="De quién">
          <Pastilla activa={quien === "ambos"} onClick={() => setQuien("ambos")}>
            Los dos
          </Pastilla>
          {(["L", "V"] as Lado[]).map((l) => (
            <Pastilla key={l} activa={quien === l} onClick={() => { setQuien(l); setElegido(null); }}>
              <span style={{ color: colorDe(p, l) }}>●</span> {cortoDe(p, l)}
            </Pastilla>
          ))}
        </div>
      )}
      {capa === "remates" && (
        <p className="mb-2 flex items-center gap-x-3 overflow-x-auto whitespace-nowrap pb-1 text-[12px]" style={{ color: S.suave }} aria-label="Leyenda">
          <span>⬤ tamaño = xG</span>
          <span className="inline-flex items-center gap-1"><span className="inline-block h-3 w-3 rounded-full" style={{ background: S.info }} /> a puerta</span>
          <span className="inline-flex items-center gap-1"><span className="inline-block h-3 w-3 rounded-full" style={{ border: `2px solid ${S.info}` }} /> fuera</span>
          <span>✕ bloqueado</span>
          <span className="inline-flex items-center gap-1"><span className="inline-block h-3 w-3 rounded-full" style={{ border: `2px solid ${S.oro}` }} /> gol</span>
          <span className="inline-flex items-center gap-1"><span className="inline-block h-3 w-3 rounded-[3px]" style={{ border: `2px solid ${S.suave}` }} /> balón parado</span>
        </p>
      )}
      <div className="relative w-full">
        <svg viewBox="-24 -30 1098 724" className="block h-auto w-full" role="img" aria-label="Campo con los remates, por dónde llega, el territorio o la red de pases">
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

          {territorios &&
            (() => {
              const W = territorios.L.W, H = territorios.L.H;
              const celda = (i: number) => {
                const col = i % W, fila = Math.floor(i / W);
                return { col, fila, l: territorios.L.malla[(H - 1 - fila) * W + col], v: territorios.V.malla[fila * W + (W - 1 - col)] };
              };
              const maxT = Math.max(1, ...Array.from({ length: W * H }, (_, i) => celda(i).l + celda(i).v));
              return Array.from({ length: W * H }, (_, i) => {
                const { col, fila, l, v: vv } = celda(i);
                const total = l + vv;
                if (!total) return null;
                const domina = l >= vv ? "L" : "V";
                const fuerza = Math.abs(l - vv) / total;
                return <rect key={i} x={(col * 1050) / W + 2} y={(fila * 680) / H + 2} width={1050 / W - 4} height={680 / H - 4} rx="6" fill={colorDe(p, domina)} fillOpacity={0.08 + 0.55 * fuerza * Math.min(1, (total / maxT) * 1.6)} />;
              });
            })()}

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
                <g key={i} filter={s.gol ? "url(#sala-luz)" : undefined} onClick={() => setElegido(i === elegido ? null : i)} style={{ cursor: "pointer" }}>
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
                  {i === elegido && <circle cx={X} cy={Y} r={r + 5} fill="none" stroke="#fff" strokeWidth="3" strokeDasharray="6 5" />}
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

          <text x="20" y="-10" fontSize="20" fontWeight="700" fill={p.visitante.color}>
            ← ataca {cortoDe(p, "V")}
          </text>
          <text x="1030" y="-10" fontSize="20" fontWeight="700" textAnchor="end" fill={p.local.color}>
            ataca {cortoDe(p, "L")} →
          </text>
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
  const pos = posesion(c);
  const dom = dominio(c);
  const filas: FilaDuelo[] = [
    { nombre: "Goles esperados (xG)", L: c.L.xg, V: c.V.xg, d: 2, previa: "ExpG", porMinuto: true },
    { nombre: "Remates", L: c.L.tiros, V: c.V.tiros, d: 0, previa: "ShtIncBl", porMinuto: true },
    { nombre: "A puerta", L: aPuertaDe(c.L, k.aPuerta?.L), V: aPuertaDe(c.V, k.aPuerta?.V), d: 0, previa: "SOG", porMinuto: true },
    { nombre: "Toques en el área", L: c.L.toquesArea, V: c.V.toquesArea, d: 0, previa: "TouchOpBox", porMinuto: true },
    { nombre: "Entradas al área con pase", L: c.L.entradasArea, V: c.V.entradasArea, d: 0, nota: "sin media de la competición" },
    { nombre: "Dominio territorial", L: dom?.L ?? null, V: dom?.V ?? null, d: 0, pct: true, nota: "de los pases en el último tercio; sin media" },
    { nombre: "Posesión", L: pos.L, V: pos.V, d: 0, pct: true, nota: "% de los pases (no es la de Opta, por tiempo)" },
    { nombre: "Acierto en el pase", L: c.L.pases ? c.L.pasesOk / c.L.pases : null, V: c.V.pases ? c.V.pasesOk / c.V.pases : null, d: 0, previa: "Pass%", pct: true },
    { nombre: "PPDA (presión)", L: ppda(c.L, k.ppda.L), V: ppda(c.V, k.ppda.V), d: 1, previa: "PPDA", menosEsMejor: true, nota: "ajustado a la cifra oficial de Opta del partido; menos es presionar más" },
    { nombre: "Pérdidas", L: c.L.perdidas, V: c.V.perdidas, d: 0, menosEsMejor: true, nota: "pase fallado (sin saques) o desposeído; sin media: Opta las cuenta de otra forma" },
  ];
  const media = (l: Lado, f: FilaDuelo) => {
    const e = l === "L" ? p.local : p.visitante;
    const m = f.previa ? e.previa?.medias[f.previa] : undefined;
    if (m == null) return null;
    return f.porMinuto ? (m * Math.min(minutos, 90)) / 90 : m;
  };
  const muestra = (x: number | null, f: FilaDuelo) => (x == null ? "—" : f.pct ? `${Math.round(x * 100)} %` : fmt(x, f.d));
  /* La diferencia con su media, en verde si es mejor y en naranja si es peor. */
  const delta = (l: Lado, f: FilaDuelo) => {
    const x = f[l];
    const m = media(l, f);
    if (x == null || m == null || !m) return null;
    const r = x / m - 1;
    if (Math.abs(r) < 0.15) return { corto: "=", texto: "como siempre", color: S.tenue };
    const mejor = f.menosEsMejor ? r < 0 : r > 0;
    /* Verde = bueno para nosotros; naranja = malo para nosotros (en el rival, al revés). Sin nosotros, neutro. */
    const color = !p.nuestro ? S.suave : (l === p.nuestro) === mejor ? S.favor : S.aviso;
    const n = Math.round(Math.abs(r) * 100);
    return { corto: `${r > 0 ? "+" : "−"}${n} %`, texto: `${n} % ${r > 0 ? "más" : "menos"} que su media`, color };
  };
  const base = [p.local.previa?.pj, p.visitante.previa?.pj].filter(Boolean);
  return (
    <Panel
      titulo={`Cara a cara · ${v.nombre}`}
      detalle={base.length ? `La raya blanca es lo que suele llevar cada uno en ese tiempo: su media de la competición sin este partido (${base.join(" y ")} partidos${base.some((n) => (n ?? 0) < 8) ? "; con menos de 8, tendencia" : ""}). Verde, bueno para nosotros; naranja, malo.` : "Las cifras del partido en el tramo elegido."}
    >
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
                  <span className="text-right text-[11.5px] leading-tight" style={{ color: dL?.color ?? S.tenue }}>
                    <span className="sm:hidden">{dL?.corto ?? ""}</span>
                    <span className="hidden sm:inline">{dL?.texto ?? ""}</span>
                  </span>
                  <span className="text-[11.5px] leading-tight" style={{ color: dV?.color ?? S.tenue }}>
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

export function AbpTransiciones({ p, v }: { p: Partido; v: Ventana }) {
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
                  {perd.map((x) => `${reloj(x.min, x.parte)} ${p.jugadores.get(x.jugador)?.corto ?? ""}${x.x < 40 ? " (en salida)" : ""}${x.gol ? " → gol" : ""}`).join(" · ")}
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

export function Jugadores({ p, v }: { p: Partido; v: Ventana }) {
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
                  {d.jugador.corto}
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
                {rivalDe ? `xG ${fmt(d.xg, 2)} · recibe en área ${d.recibeArea}` : `xG ${fmt(d.xg, 2)} · def. ${d.defensivas}${d.perdidasPropio ? ` · pierde atrás ${d.perdidasPropio}` : ""}`}
              </span>
            </li>
          ))}
        </ol>
      </div>
    );
  };
  return (
    <Panel titulo={`Quién marca el partido · ${v.nombre}`} detalle="Amenaza = xG de sus remates + valor de sus demás acciones (xPV). En el rival, cuántas veces recibe en el área (a quién vigilar); en los nuestros, acciones defensivas y pérdidas en campo propio.">
      <div className="grid gap-5 md:grid-cols-2">
        {bloque(nuestro, p.nuestro ? `Los nuestros · ${cortoDe(p, nuestro)}` : cortoDe(p, nuestro), listas.n, false)}
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
