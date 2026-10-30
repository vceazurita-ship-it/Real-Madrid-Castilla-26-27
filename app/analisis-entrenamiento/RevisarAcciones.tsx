"use client";

/**
 * REVISAR LAS ACCIONES DEL DÍA (30/10/2026; antes, «Lo que dice el vídeo» al
 * fondo de la página).
 *
 * Cada objetivo medido con su cuenta y sus acciones. Cada acción, en una
 * fila: su clip en miniatura (un toque lo abre en el visor, donde se revisa
 * seguido y con teclado), el veredicto, si está validada o sigue como
 * propuesta automática y los tres botones. Lo validado va con borde
 * continuo; lo que sólo se propuso, discontinuo (los colores de borde no
 * llegan a pintarse en esta app: ver la memoria tema-dia-noche).
 *
 * Las cuentas salen de `sesion` ya con sólo las validaciones vigentes
 * (lib/entreno/modelo.ts, `sesionVigente`).
 */

import { useState } from "react";
import { Check, CheckCheck, CircleDashed, Film, ListChecks, Play, RotateCcw, ThumbsDown, ThumbsUp, X } from "lucide-react";

import { Button, Notice } from "@/components/abp/ui";
import { anteriorDelObjetivo, type DiaEntreno } from "@/lib/entreno/jugador";
import {
  MINIMO_PORCENTAJE,
  avisoLegible,
  cuentas,
  cumpleMeta,
  lecturaCuentas,
  mmss,
  objetivoMedido,
  porcentajeOTendencia,
  veredictoFinal,
  type AccionEntreno,
  type AnalisisEntreno,
  type SesionEntreno,
  type Validacion,
} from "@/lib/entreno/modelo";

import { COLOR_BIEN, COLOR_MEJORABLE, claveDe, type PeticionVisor, type Pieza } from "./VisorClips";

const FOCO = "focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-[#C8A96B]";
const ddmm = (f: string) => f.split("-").reverse().slice(0, 2).join("/");

type Vista = "todas" | "sin-validar" | "correcta" | "mejorable" | "descartada" | "con-clip";

const VISTAS: [Vista, string][] = [
  ["todas", "Todas"],
  ["sin-validar", "Sin validar"],
  ["correcta", "Correctas"],
  ["mejorable", "Mejorables"],
  ["descartada", "Descartadas"],
  ["con-clip", "Con clip"],
];

export function RevisarAcciones({
  fecha,
  sesion,
  analisis,
  dias,
  bloqueado,
  anteriores,
  cambiados,
  onValida,
  onValidaResto,
  onAbre,
}: {
  fecha: string;
  sesion: SesionEntreno;
  analisis: AnalisisEntreno;
  dias: DiaEntreno[];
  bloqueado: boolean;
  /** Validaciones hechas sobre un análisis anterior, que ya no cuentan. */
  anteriores: number;
  /** Objetivos nuevos o cambiados desde el análisis. */
  cambiados: number;
  onValida: (id: string, v: Validacion | null) => void;
  onValidaResto: (objetivoId: string) => void;
  onAbre: (p: PeticionVisor) => void;
}) {
  const [vista, setVista] = useState<Vista>("todas");
  const val = sesion.validaciones;
  const medidos = sesion.objetivos.map((o, i) => ({ o, numero: i + 1 })).filter(({ o }) => objetivoMedido(o, analisis));
  const ids = new Set(medidos.map(({ o }) => o.id));
  const vivas = analisis.acciones.filter((a) => ids.has(a.objetivoId));
  const casa = (a: AccionEntreno, v: Vista) => {
    const ver = veredictoFinal(a, val);

    return v === "todas" ? true : v === "sin-validar" ? !val?.[a.id] : v === "con-clip" ? Boolean(a.clip) : v === "descartada" ? ver === null : ver === v;
  };
  const cuantas = (v: Vista) => vivas.filter((a) => casa(a, v)).length;
  const fuenteUrl = analisis.fuente.url ?? null;
  const piezaDe = (a: AccionEntreno, numero: number, texto: string): Pieza => ({ accion: a, fecha, objetivo: `${numero}. ${texto}`, fuenteUrl });

  return (
    <div className="space-y-4">
      {cambiados > 0 ? (
        <Notice tone="warn" title={`${cambiados} ${cambiados === 1 ? "objetivo es nuevo o ha cambiado" : "objetivos son nuevos o han cambiado"} desde el análisis`}>
          Sus acciones son de la versión anterior (o no las tiene): vuelve a analizar para que cuenten con lo que pide ahora.
        </Notice>
      ) : null}
      {anteriores > 0 ? (
        <Notice tone="warn" title={`${anteriores} ${anteriores === 1 ? "validación era" : "validaciones eran"} de un análisis anterior`}>
          El vídeo se volvió a analizar después de validarlas y esas acciones ya no son las mismas: no cuentan hasta que las vuelvas a validar.
        </Notice>
      ) : null}
      {analisis.avisos.length || analisis.repetidas ? (
        <ul className="space-y-0.5 rounded-xl border border-white/[0.08] px-3 py-2 text-xs text-white/60">
          {analisis.avisos.map((a) => (
            <li key={a}>· {avisoLegible(a)}</li>
          ))}
          {analisis.repetidas ? (
            <li>
              · {analisis.repetidas} {analisis.repetidas === 1 ? "acción venía repetida (la misma jugada contada dos veces) y cuenta" : "acciones venían repetidas (la misma jugada contada dos veces) y cuentan"} una sola vez.
            </li>
          ) : null}
        </ul>
      ) : null}

      <div className="flex flex-wrap items-center gap-1.5 text-xs" role="group" aria-label="Filtrar acciones">
        {VISTAS.filter(([k]) => k === "todas" || k === vista || cuantas(k) > 0).map(([k, t]) => (
          <button key={k} type="button" aria-pressed={vista === k} onClick={() => setVista(k)} className={`rounded-lg px-3 py-1.5 ${FOCO} ${vista === k ? "bg-[#C8A96B] font-semibold text-black" : "border border-white/12 text-white/65 hover:text-white"}`}>
            {t} <span className="tabular-nums opacity-70">{cuantas(k)}</span>
          </button>
        ))}
      </div>

      {medidos.map(({ o, numero }) => {
        const c = cuentas(o.id, analisis.acciones, val);
        const anterior = anteriorDelObjetivo(dias, fecha, o);
        const cumple = cumpleMeta(c, o.meta);
        const todasSuyas = analisis.acciones.filter((a) => a.objetivoId === o.id).sort((a, b) => a.inicio - b.inicio);
        const pendientes = todasSuyas.filter((a) => !val?.[a.id]);
        const suyas = todasSuyas.filter((a) => casa(a, vista));
        const piezas = todasSuyas.map((a) => piezaDe(a, numero, o.objetivo));
        const abreEn = (a: AccionEntreno) => onAbre({ titulo: `${numero}. ${o.objetivo}`, piezas, inicial: claveDe(piezaDe(a, numero, o.objetivo)), orden: "minuto" });

        return (
          <section key={o.id} aria-labelledby={`obj-${o.id}`} className="min-w-0 space-y-3 rounded-2xl border border-white/10 bg-white/[0.03] p-4">
            <header className="flex flex-wrap items-start gap-3">
              <div className="min-w-0 flex-1 basis-56">
                <h3 id={`obj-${o.id}`} className="font-semibold text-white">
                  <span className="mr-1.5 text-[#C8A96B]">{numero}.</span>
                  {o.objetivo}
                </h3>
                <p className="mt-0.5 text-xs text-white/55">
                  {[o.jugadores.map((j) => j.nombre).join(", "), o.tarea ? `Tarea ${o.tarea}${o.tareaTexto ? ` (${o.tareaTexto})` : ""}` : "", o.origen ? `Sale de: ${o.origen}` : ""].filter(Boolean).join(" · ")}
                </p>
              </div>
              {c.total ? (
                <div className="flex items-center gap-4 text-center">
                  <div>
                    <p className="text-2xl font-semibold tabular-nums text-white">{c.correctas}</p>
                    <p className="flex items-center gap-1 text-[10px] uppercase tracking-wider text-white/50">
                      <span className="h-2 w-2 rounded-full" style={{ background: COLOR_BIEN }} aria-hidden /> Correctas
                    </p>
                  </div>
                  <div>
                    <p className="text-2xl font-semibold tabular-nums text-white">{c.mejorables}</p>
                    <p className="flex items-center gap-1 text-[10px] uppercase tracking-wider text-white/50">
                      <span className="h-2 w-2 rounded-full" style={{ background: COLOR_MEJORABLE }} aria-hidden /> Mejorables
                    </p>
                  </div>
                  <div>
                    <p className="text-2xl font-semibold tabular-nums text-white">{porcentajeOTendencia(c)}</p>
                    <p className="text-[10px] uppercase tracking-wider text-white/50">{c.pct !== null ? "Acierto" : `< ${MINIMO_PORCENTAJE} acciones`}</p>
                  </div>
                </div>
              ) : null}
            </header>

            <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5 text-xs">
              <span className="text-white/75">{lecturaCuentas(c)}</span>
              {o.meta ? (
                <span className={`rounded-md px-1.5 py-0.5 font-semibold ${cumple === true ? "bg-emerald-400/15 text-emerald-300" : cumple === false ? "bg-amber-400/15 text-amber-300" : "bg-white/[0.06] text-white/60"}`}>
                  Meta {o.meta} %{cumple === true ? ": cumplida" : cumple === false ? ": por debajo" : c.total ? `: hacen falta ${MINIMO_PORCENTAJE} acciones para decirlo` : ""}
                </span>
              ) : null}
              {anterior && c.total ? (
                <span className="text-white/55">
                  Sesión anterior ({ddmm(anterior.fecha)}): {anterior.cuentas.correctas} de {anterior.cuentas.total}
                  {anterior.cuentas.pct !== null ? ` (${anterior.cuentas.pct} %)` : ""}
                  {c.pct !== null && anterior.cuentas.pct !== null ? (c.pct - anterior.cuentas.pct >= 5 ? " → mejora" : c.pct - anterior.cuentas.pct <= -5 ? " → baja" : " → igual") : ""}
                </span>
              ) : null}
            </div>

            {pendientes.length ? (
              <div className="flex flex-wrap gap-1.5">
                <Button icon={ListChecks} tone="primary" onClick={() => onAbre({ titulo: `${numero}. ${o.objetivo}`, piezas, filtro: "sin-validar", orden: "minuto" })}>
                  Revisar las {pendientes.length} sin validar
                </Button>
                <Button icon={CheckCheck} disabled={bloqueado} onClick={() => onValidaResto(o.id)} title="Las que quedan sin validar se dan por buenas con el veredicto propuesto">
                  Dar por buenas las {pendientes.length} propuestas
                </Button>
              </div>
            ) : null}

            {suyas.length === 0 ? (
              <p className="text-sm text-white/60">
                {todasSuyas.length ? "Nada con este filtro." : "El vídeo no ha dado acciones de este objetivo. Lo normal es que no se reconozca al jugador: añade su peto o su dorsal en «Cómo reconocerlo» y vuelve a analizar."}
              </p>
            ) : (
              <ul className="grid gap-2.5 xl:grid-cols-2">
                {suyas.map((a) => (
                  <FilaAccion key={a.id} a={a} val={val?.[a.id]} v={veredictoFinal(a, val)} bloqueado={bloqueado} onValida={onValida} onAbre={() => abreEn(a)} />
                ))}
              </ul>
            )}
          </section>
        );
      })}
    </div>
  );
}

function FilaAccion({ a, val, v, bloqueado, onValida, onAbre }: { a: AccionEntreno; val: Validacion | undefined; v: "correcta" | "mejorable" | null; bloqueado: boolean; onValida: (id: string, v: Validacion | null) => void; onAbre: () => void }) {
  const color = v === "correcta" ? COLOR_BIEN : v === "mejorable" ? COLOR_MEJORABLE : "rgb(var(--rmcf-ink-rgb) / .3)";

  return (
    <li className={`flex min-w-0 flex-col gap-3 rounded-xl border p-2.5 sm:flex-row ${val ? "border-solid bg-white/[0.03]" : "border-dashed"} ${v === null ? "opacity-60" : ""}`}>
      <button type="button" onClick={onAbre} className={`group relative w-full shrink-0 overflow-hidden rounded-lg sm:w-40 ${FOCO}`} aria-label={`Ver la acción del minuto ${mmss(a.inicio)}`}>
        {a.clip ? (
          <span className="siempre-oscuro relative block aspect-video" style={{ background: "#000" }}>
            <video src={`${a.clip}#t=0.5`} preload="metadata" muted playsInline className="pointer-events-none h-full w-full object-cover" />
            <span className="absolute inset-0 flex items-center justify-center bg-black/30 transition group-hover:bg-black/10" aria-hidden>
              <span className="flex h-9 w-9 items-center justify-center rounded-full" style={{ background: "rgba(0,0,0,.6)", color: "#fff" }}>
                <Play size={15} />
              </span>
            </span>
            <span className="absolute bottom-1 left-1 inline-flex items-center gap-1 rounded px-1 text-[10px] font-semibold" style={{ background: "rgba(0,0,0,.65)", color: "#C8A96B" }}>
              <Film size={10} aria-hidden /> Clip
            </span>
          </span>
        ) : (
          <span className="flex aspect-video flex-col items-center justify-center gap-0.5 rounded-lg border border-dashed border-white/15 bg-white/[0.03] text-center">
            <span className="text-lg font-semibold tabular-nums text-white">{mmss(a.inicio)}</span>
            <span className="text-[10px] text-white/50">sin clip · ver el minuto</span>
          </span>
        )}
      </button>

      <div className="min-w-0 flex-1 space-y-1.5">
        <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-xs">
          <span className="tabular-nums text-white/55">
            {mmss(a.inicio)}–{mmss(a.fin)}
          </span>
          <span className="inline-flex items-center gap-1 font-semibold text-white/90">
            <span className="h-2.5 w-2.5 rounded-full" style={{ background: color }} aria-hidden />
            {v === null ? "Descartada" : v === "correcta" ? "Correcta" : "Mejorable"}
          </span>
          {val ? (
            <span className="inline-flex items-center gap-0.5 text-white/70">
              <Check size={12} aria-hidden /> Validada{val !== "descartada" && val !== a.veredicto ? " (cambiada)" : ""}
            </span>
          ) : (
            <span className="inline-flex items-center gap-1 text-white/55">
              <CircleDashed size={12} aria-hidden /> Propuesta automática
            </span>
          )}
        </div>
        {a.jugador ? <p className="truncate text-[11px] text-white/55">{a.jugador}</p> : null}
        {a.explicacion ? <p className="line-clamp-3 text-sm text-white/80">{a.explicacion}</p> : null}
        <div className="flex flex-wrap gap-1.5 pt-0.5">
          <Button icon={ThumbsUp} tone={val === "correcta" ? "primary" : "ghost"} disabled={bloqueado} aria-pressed={val === "correcta"} onClick={() => onValida(a.id, val === "correcta" ? null : "correcta")} title={val === "correcta" ? "Quitar la validación" : "Es correcta"}>
            Correcta
          </Button>
          <Button icon={ThumbsDown} tone={val === "mejorable" ? "primary" : "ghost"} disabled={bloqueado} aria-pressed={val === "mejorable"} onClick={() => onValida(a.id, val === "mejorable" ? null : "mejorable")} title={val === "mejorable" ? "Quitar la validación" : "Es mejorable"}>
            Mejorable
          </Button>
          <Button icon={val === "descartada" ? RotateCcw : X} tone="danger" disabled={bloqueado} aria-pressed={val === "descartada"} onClick={() => onValida(a.id, val === "descartada" ? null : "descartada")} title={val === "descartada" ? "Recuperarla" : "No es de este objetivo o no se ve"}>
            {val === "descartada" ? "Recuperar" : "Descartar"}
          </Button>
        </div>
      </div>
    </li>
  );
}
