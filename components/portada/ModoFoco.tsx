"use client";

/**
 * MODO FOCO (22/11/2026). Las tareas pendientes de hoy (y lo atrasado), una a
 * una y a pantalla completa. Una tecla por decisión:
 *
 *   H o Intro → hecha · S o → → saltar · P → posponer a mañana · Esc → salir
 *
 * Nada pide confirmación: hecha y pospuesta se deshacen desde el aviso (lo
 * pone quien la monta, `onHecha` / `onPospone`). Al acabar, el resumen y una
 * celebración corta (sin ella con prefers-reduced-motion). Lo montan «Tu día»
 * de la portada y «Mis tareas».
 */

import { useCallback, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import Link from "next/link";
import { ArrowRight, CalendarClock, Check, X } from "lucide-react";

import { toast } from "sonner";

import { useBodyScrollLock } from "@/components/season/useBodyScrollLock";
import type { useMisTareas } from "@/hooks/useMisTareas";
import {
  alternaHechaAuto,
  alternaHechaPropia,
  deshaz,
  diaSiguiente,
  nuevoId,
  pospone,
  PROPIAS_VACIAS,
  rotuloDia,
  type DiaVista,
  type TareaDelDia,
} from "@/lib/portada/mis-tareas";

type Salida = "hecha" | "saltada" | "pospuesta";

const CONFETI = Array.from({ length: 26 }, (_, i) => ({
  left: `${(i * 37) % 100}%`,
  deriva: `${((i * 53) % 40) - 20}vw`,
  retraso: `${(i % 7) * 0.08}s`,
  color: ["#C8A96B", "#E3C98F", "#4F8FE8", "#F5F7FA", "#1B9E77"][i % 5],
}));

export function ModoFoco({
  tareas,
  hoy,
  onHecha,
  onPospone,
  onCierra,
}: {
  tareas: TareaDelDia[];
  hoy: string;
  onHecha: (t: TareaDelDia) => void;
  onPospone: (t: TareaDelDia) => void;
  onCierra: () => void;
}) {
  /* La cola se fija al abrir: marcar una no la reordena por debajo. */
  const [cola] = useState(tareas);
  const [i, setI] = useState(0);
  const [saliendo, setSaliendo] = useState<Salida | null>(null);
  const [cuenta, setCuenta] = useState<Record<Salida, number>>({ hecha: 0, saltada: 0, pospuesta: 0 });
  const caja = useRef<HTMLDivElement>(null);

  useBodyScrollLock(true);

  useEffect(() => {
    caja.current?.focus();
  }, []);

  const t = cola[i];
  const terminado = i >= cola.length;

  const decide = useCallback(
    (s: Salida) => {
      if (!t || saliendo) return;
      if (s === "hecha") onHecha(t);
      if (s === "pospuesta") onPospone(t);
      setCuenta((c) => ({ ...c, [s]: c[s] + 1 }));
      const quieto = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
      if (quieto) {
        setI((n) => n + 1);
        return;
      }
      setSaliendo(s);
      window.setTimeout(() => {
        setSaliendo(null);
        setI((n) => n + 1);
      }, 320);
    },
    [t, saliendo, onHecha, onPospone],
  );

  useEffect(() => {
    const tecla = (e: KeyboardEvent) => {
      if (e.ctrlKey || e.metaKey || e.altKey) return;
      const k = e.key.toLowerCase();
      /* Intro sobre un botón o enlace ya lo pulsa el navegador: no se decide dos veces. */
      const el = e.target as HTMLElement | null;
      if (k === "enter" && el?.closest("button, a")) return;
      if (k === "escape") {
        e.preventDefault();
        onCierra();
        return;
      }
      if (terminado) {
        if (k === "enter") {
          e.preventDefault();
          onCierra();
        }
        return;
      }
      if (k === "h" || k === "enter") {
        e.preventDefault();
        decide("hecha");
      } else if (k === "s" || k === "arrowright") {
        e.preventDefault();
        decide("saltada");
      } else if (k === "p") {
        e.preventDefault();
        decide("pospuesta");
      }
    };
    window.addEventListener("keydown", tecla);
    return () => window.removeEventListener("keydown", tecla);
  }, [decide, onCierra, terminado]);

  const atrasada = t && t.fecha < hoy;

  return createPortal(
    <div className="modal-veil foco-velo fixed inset-0 z-[90] flex items-center justify-center p-4" role="dialog" aria-modal="true" aria-label="Modo foco: tareas de hoy">
      <div ref={caja} tabIndex={-1} className="foco-panel relative w-full max-w-xl rounded-3xl border border-white/10 p-6 outline-none sm:p-8">
        <button type="button" onClick={onCierra} aria-label="Salir del modo foco (Esc)" className="absolute right-3 top-3 flex h-11 w-11 items-center justify-center rounded-full text-white/60 hover:bg-white/10 hover:text-white">
          <X className="h-5 w-5" />
        </button>

        {/* Progreso: una raya por tarea. */}
        <div className="flex gap-1 pr-12" aria-hidden>
          {cola.map((c, n) => (
            <span key={c.clave} className={`h-1.5 flex-1 rounded-full transition-colors duration-300 ${n < i ? "bg-[#C8A96B]" : n === i ? "bg-[#C8A96B]/45" : "bg-white/10"}`} />
          ))}
        </div>

        {terminado ? (
          <div className="py-8 text-center" aria-live="polite">
            <div className="foco-celebra mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-[#C8A96B] text-[#0B0F14]">
              <Check className="h-8 w-8" />
            </div>
            <h2 className="fuente-club mt-5 text-3xl font-bold uppercase text-white">Día despachado</h2>
            <p className="mt-2 text-sm text-white/70">
              {cuenta.hecha} {cuenta.hecha === 1 ? "hecha" : "hechas"}
              {cuenta.pospuesta ? ` · ${cuenta.pospuesta} a mañana` : ""}
              {cuenta.saltada ? ` · ${cuenta.saltada} ${cuenta.saltada === 1 ? "saltada" : "saltadas"} (siguen en su día)` : ""}
            </p>
            <button type="button" onClick={onCierra} className="mt-6 min-h-11 rounded-full bg-[#C8A96B] px-6 text-sm font-semibold text-[#0B0F14]">
              Volver (Intro)
            </button>
            {cuenta.hecha > 0 && (
              <div aria-hidden className="pointer-events-none">
                {CONFETI.map((c, n) => (
                  <span key={n} className="lab-confeti" style={{ left: c.left, background: c.color, animationDelay: c.retraso, ["--deriva" as string]: c.deriva }} />
                ))}
              </div>
            )}
          </div>
        ) : (
          t && (
            <div key={t.clave} className={`foco-tarjeta py-8 ${saliendo ? `foco-sale-${saliendo}` : ""}`} aria-live="polite">
              <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-white/50">
                {i + 1} de {cola.length}
                {atrasada ? ` · atrasada, del ${rotuloDia(t.fecha)}` : " · hoy"}
                {t.prioridad === "alta" ? " · prioridad alta" : ""}
              </p>
              <h2 className="mt-3 text-2xl font-bold leading-snug text-white sm:text-3xl">{t.texto}</h2>
              {t.hecho && <p className="mt-2 text-sm leading-relaxed text-white/65">{t.hecho}</p>}
              {t.href && (
                <Link href={t.href} onClick={onCierra} className="mt-3 inline-flex items-center gap-1 text-sm font-semibold text-[color:var(--rmcf-gold-ink)] hover:underline">
                  Abrir donde se hace <ArrowRight className="h-3.5 w-3.5" />
                </Link>
              )}
            </div>
          )
        )}

        {!terminado && (
          <div className="grid grid-cols-3 gap-2">
            <button type="button" onClick={() => decide("pospuesta")} className="flex min-h-12 flex-col items-center justify-center gap-0.5 rounded-2xl border border-white/12 text-sm font-semibold text-white/80 hover:bg-white/[0.06]">
              <CalendarClock className="h-4 w-4" aria-hidden /> Mañana <kbd className="text-[10px] font-normal text-white/45">P</kbd>
            </button>
            <button type="button" onClick={() => decide("saltada")} className="flex min-h-12 flex-col items-center justify-center gap-0.5 rounded-2xl border border-white/12 text-sm font-semibold text-white/80 hover:bg-white/[0.06]">
              <ArrowRight className="h-4 w-4" aria-hidden /> Saltar <kbd className="text-[10px] font-normal text-white/45">S · →</kbd>
            </button>
            <button type="button" onClick={() => decide("hecha")} className="flex min-h-12 flex-col items-center justify-center gap-0.5 rounded-2xl bg-[#C8A96B] text-sm font-semibold text-[#0B0F14]">
              <Check className="h-4 w-4" aria-hidden /> Hecha <kbd className="text-[10px] font-normal text-[#0B0F14]/70">H · Intro</kbd>
            </button>
          </div>
        )}
      </div>
    </div>,
    document.body,
  );
}

type Tareas = ReturnType<typeof useMisTareas>;

/** Lo pendiente para el modo foco: primero lo atrasado, luego lo de hoy; dentro, la prioridad alta antes. */
export function colaDelFoco(deHoy: TareaDelDia[], atrasadas: TareaDelDia[]) {
  const peso = (t: TareaDelDia) => (t.prioridad === "alta" ? 0 : t.prioridad === "media" ? 1 : 2);
  const orden = (ts: TareaDelDia[]) => ts.filter((t) => !t.hecha).sort((a, b) => peso(a) - peso(b));
  /* La misma tarea del mismo día, una vez (como la ventana de atrasadas). */
  const vistas = new Set<string>();
  return [...orden(atrasadas), ...orden(deHoy)].filter((t) => {
    const clave = `${t.texto.trim().toLowerCase()}|${t.fecha}`;
    if (vistas.has(clave) || vistas.has(t.clave)) return false;
    vistas.add(clave);
    vistas.add(t.clave);
    return true;
  });
}

/** Hecha y pospuesta con su «Deshacer» en el aviso (en vez de preguntar antes). */
export function useAccionesFoco({ cambiaHechas, cambiaDoc, dias, hoy }: { cambiaHechas: Tareas["cambiaHechas"]; cambiaDoc: Tareas["cambiaDoc"]; dias: DiaVista[]; hoy: string }) {
  const marca = useCallback(
    (t: TareaDelDia, hecha: boolean) => {
      if (t.tipo === "auto") cambiaHechas((h) => alternaHechaAuto(h, t.clave, hecha));
      else cambiaDoc((d) => alternaHechaPropia(d, t.id, hecha));
    },
    [cambiaHechas, cambiaDoc],
  );

  const onHecha = useCallback(
    (t: TareaDelDia) => {
      marca(t, true);
      toast(`«${t.texto}» hecha`, { duration: 6000, action: { label: "Deshacer", onClick: () => marca(t, false) } });
    },
    [marca],
  );

  const onPospone = useCallback(
    (t: TareaDelDia) => {
      const fecha = dias.find((d) => d.fecha > hoy)?.fecha ?? diaSiguiente(hoy);
      const id = nuevoId();
      const { rastro } = pospone(PROPIAS_VACIAS, t, fecha, id);
      cambiaDoc((d) => pospone(d, t, fecha, id).doc);
      toast(`«${t.texto}» → ${rotuloDia(fecha)}`, { duration: 6000, action: { label: "Deshacer", onClick: () => cambiaDoc((d) => deshaz(d, rastro)) } });
    },
    [cambiaDoc, dias, hoy],
  );

  return { onHecha, onPospone };
}
