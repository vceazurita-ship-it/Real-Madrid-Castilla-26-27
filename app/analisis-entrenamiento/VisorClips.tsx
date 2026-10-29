"use client";

/**
 * EL VISOR DE CLIPS DE LOS GRÁFICOS (29/10/2026).
 *
 * Cada barra, punto o cifra del panel visual (./PanelVisual.tsx) abre aquí
 * las acciones que la forman: el analista pidió que todo número de la
 * sección esté «siempre vinculado a los clips que lo muestran». Arriba el
 * reproductor (el mismo `<video>` de la lista del día), debajo la lista para
 * saltar entre acciones (también con ← y →) y, si la acción es del día
 * abierto, los mismos botones de validar que en el detalle.
 *
 * No se corta un clip de cada acción (sólo un ejemplo de cada veredicto por
 * objetivo): las que no lo tienen dicen su minuto y abren el vídeo de Hudl.
 * Por eso la lista pone primero las que tienen clip.
 */

import { useEffect, useMemo, useState } from "react";
import { Check, ChevronLeft, ChevronRight, Film, Play, ThumbsDown, ThumbsUp, X } from "lucide-react";

import { Button, Dialog } from "@/components/abp/ui";
import { mmss, veredictoFinal, type AccionEntreno, type Validacion, type Veredicto } from "@/lib/entreno/modelo";

/** Una acción con lo que hace falta para enseñarla fuera de su día. */
export type Pieza = { accion: AccionEntreno; fecha: string; objetivo: string; fuenteUrl: string | null };

/** `inicial` es la `claveDe` de la pieza con la que se abre. */
export type PeticionVisor = { titulo: string; subtitulo?: string; piezas: Pieza[]; inicial?: string };

/** Los ids de acción sólo son únicos dentro de su día: el visor mezcla días en la evolución. */
export const claveDe = (p: Pieza) => `${p.fecha}|${p.accion.id}`;

/** Paleta validada de DATA (memoria data-analisis): separa en daltonismo, a diferencia del verde/rojo. */
export const COLOR_BIEN = "#1B9E77";
export const COLOR_MEJORABLE = "#D95F02";

const FOCO = "focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-[#C8A96B]";

type Filtro = "todas" | Veredicto;

export function VisorClips({
  peticion,
  onClose,
  validacionesDe,
  fechaEditable,
  onValida,
}: {
  peticion: PeticionVisor;
  onClose: () => void;
  validacionesDe: (fecha: string) => Record<string, Validacion> | undefined;
  /** Sólo se valida lo del día abierto (lo demás vive en su propio documento). */
  fechaEditable: string;
  onValida: (id: string, v: Validacion | null) => void;
}) {
  const [filtro, setFiltro] = useState<Filtro>("todas");

  /* Con clip primero; después por día y minuto. Las descartadas no entran en los gráficos y tampoco aquí, salvo que se descarten con el visor abierto. */
  const ordenadas = useMemo(
    () => [...peticion.piezas].sort((a, b) => Number(Boolean(b.accion.clip)) - Number(Boolean(a.accion.clip)) || a.fecha.localeCompare(b.fecha) || a.accion.inicio - b.accion.inicio),
    [peticion.piezas],
  );
  const veredictoDe = (p: Pieza) => veredictoFinal(p.accion, validacionesDe(p.fecha));
  const visibles = filtro === "todas" ? ordenadas : ordenadas.filter((p) => veredictoDe(p) === filtro);
  const cuentaDe = (f: Filtro) => (f === "todas" ? ordenadas.length : ordenadas.filter((p) => veredictoDe(p) === f).length);

  const [elegida, setElegida] = useState<string | null>(peticion.inicial ?? null);
  const indice = Math.max(
    0,
    visibles.findIndex((p) => claveDe(p) === elegida),
  );
  const actual = visibles[indice] ?? null;
  const mueve = (paso: number) => {
    if (!visibles.length) return;

    setElegida(claveDe(visibles[(indice + paso + visibles.length) % visibles.length]));
  };

  /* ← y → saltan de acción, salvo escribiendo o con el foco en el vídeo (allí mueven el vídeo). */
  useEffect(() => {
    const tecla = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement | null;

      if (t instanceof HTMLInputElement || t instanceof HTMLTextAreaElement || t instanceof HTMLVideoElement) return;

      if (e.key === "ArrowRight") setElegida((id) => siguiente(visibles, id, 1));
      else if (e.key === "ArrowLeft") setElegida((id) => siguiente(visibles, id, -1));
    };

    window.addEventListener("keydown", tecla);

    return () => window.removeEventListener("keydown", tecla);
  }, [visibles]);

  const conClip = ordenadas.filter((p) => p.accion.clip).length;
  const v = actual ? veredictoDe(actual) : null;
  const val = actual ? validacionesDe(actual.fecha)?.[actual.accion.id] : undefined;
  const editable = actual?.fecha === fechaEditable;

  return (
    <Dialog title={peticion.titulo} subtitle={[peticion.subtitulo, `${ordenadas.length} ${ordenadas.length === 1 ? "acción" : "acciones"}${conClip ? ` · ${conClip} con clip` : ""}`].filter(Boolean).join(" · ")} onClose={onClose}>
      <div className="space-y-3">
        <div className="flex flex-wrap gap-1.5 text-xs" role="group" aria-label="Filtrar acciones del visor">
          {(
            [
              ["todas", "Todas"],
              ["correcta", "Correctas"],
              ["mejorable", "Mejorables"],
            ] as const
          )
            .filter(([k]) => k === "todas" || cuentaDe(k) > 0)
            .map(([k, t]) => (
              <button key={k} type="button" aria-pressed={filtro === k} onClick={() => setFiltro(k)} className={`rounded-lg px-3 py-1.5 ${FOCO} ${filtro === k ? "bg-[#C8A96B] font-semibold text-black" : "border border-white/12 text-white/65 hover:text-white"}`}>
                {t} <span className="tabular-nums opacity-70">{cuentaDe(k)}</span>
              </button>
            ))}
        </div>

        {actual ? (
          <div className="space-y-2">
            {actual.accion.clip ? (
              <video key={claveDe(actual)} src={actual.accion.clip} controls autoPlay preload="metadata" playsInline className="aspect-video w-full rounded-lg bg-black" />
            ) : (
              <div className="flex aspect-video w-full flex-col items-center justify-center gap-2 rounded-lg border border-dashed border-white/15 bg-white/[0.03] px-4 text-center">
                <p className="text-3xl font-semibold tabular-nums text-white">{mmss(actual.accion.inicio)}</p>
                <p className="text-xs text-white/55">Minuto del vídeo de la sesión: se corta un clip de ejemplo por veredicto y objetivo.</p>
                {actual.fuenteUrl ? (
                  <a href={actual.fuenteUrl} target="_blank" rel="noreferrer" className={`inline-flex items-center gap-1.5 rounded-lg border border-[#C8A96B]/40 px-3 py-1.5 text-xs font-semibold text-[#C8A96B] hover:bg-[#C8A96B]/10 ${FOCO}`}>
                    <Play size={12} aria-hidden /> Abrir en Hudl y ir al {mmss(actual.accion.inicio)}
                  </a>
                ) : null}
              </div>
            )}

            <div className="flex flex-wrap items-center gap-2 text-xs">
              <Button icon={ChevronLeft} onClick={() => mueve(-1)} aria-label="Acción anterior" title="Anterior (←)" disabled={visibles.length < 2} />
              <span className="tabular-nums text-white/55">
                {indice + 1} / {visibles.length}
              </span>
              <Button icon={ChevronRight} onClick={() => mueve(1)} aria-label="Acción siguiente" title="Siguiente (→)" disabled={visibles.length < 2} />
              <span className="inline-flex items-center gap-1.5 font-semibold text-white/85">
                <span className="h-2.5 w-2.5 rounded-full" style={{ background: v === "correcta" ? COLOR_BIEN : v === "mejorable" ? COLOR_MEJORABLE : "rgb(var(--rmcf-ink-rgb) / .3)" }} aria-hidden />
                {v === null ? "Descartada" : v === "correcta" ? "Correcta" : "Mejorable"}
              </span>
              <span className="text-white/55">{val ? (val !== "descartada" && val !== actual.accion.veredicto ? "Validada (cambiada)" : "Validada") : "Propuesta automática"}</span>
              <span className="tabular-nums text-white/55">
                {actual.fecha !== fechaEditable ? `${actual.fecha.split("-").reverse().slice(0, 2).join("/")} · ` : ""}
                {mmss(actual.accion.inicio)}–{mmss(actual.accion.fin)}
              </span>
            </div>
            <p className="text-[11px] uppercase tracking-wider text-white/45">{actual.objetivo}</p>
            {actual.accion.jugador ? <p className="text-xs text-white/60">{actual.accion.jugador}</p> : null}
            <p className="text-sm text-white/85">{actual.accion.explicacion}</p>

            {editable ? (
              <div className="flex flex-wrap gap-1.5">
                <Button icon={ThumbsUp} tone={val === "correcta" ? "primary" : "ghost"} aria-pressed={val === "correcta"} onClick={() => onValida(actual.accion.id, val === "correcta" ? null : "correcta")}>
                  Correcta
                </Button>
                <Button icon={ThumbsDown} tone={val === "mejorable" ? "primary" : "ghost"} aria-pressed={val === "mejorable"} onClick={() => onValida(actual.accion.id, val === "mejorable" ? null : "mejorable")}>
                  Mejorable
                </Button>
                <Button icon={X} tone="danger" aria-pressed={val === "descartada"} onClick={() => onValida(actual.accion.id, val === "descartada" ? null : "descartada")}>
                  {val === "descartada" ? "Recuperar" : "Descartar"}
                </Button>
              </div>
            ) : null}
          </div>
        ) : null}

        {visibles.length > 1 ? (
          <ul className="max-h-64 space-y-1 overflow-y-auto border-t border-white/10 pt-2" aria-label="Acciones">
            {visibles.map((p) => {
              const vp = veredictoDe(p);
              const sel = actual !== null && claveDe(p) === claveDe(actual);

              return (
                <li key={claveDe(p)}>
                  <button
                    type="button"
                    onClick={() => setElegida(claveDe(p))}
                    aria-current={sel ? "true" : undefined}
                    className={`flex w-full min-w-0 items-center gap-2 rounded-lg px-2 py-1.5 text-left text-xs ${FOCO} ${sel ? "bg-white/[0.08] text-white" : "text-white/70 hover:bg-white/[0.04]"}`}
                  >
                    <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ background: vp === "correcta" ? COLOR_BIEN : vp === "mejorable" ? COLOR_MEJORABLE : "rgb(var(--rmcf-ink-rgb) / .3)" }} aria-hidden />
                    <span className="w-11 shrink-0 tabular-nums text-white/55">{mmss(p.accion.inicio)}</span>
                    {p.accion.clip ? <Film size={12} className="shrink-0 text-[#C8A96B]" aria-label="Con clip" /> : <span className="w-3 shrink-0" aria-hidden />}
                    <span className="min-w-0 flex-1 truncate">{p.accion.explicacion}</span>
                    {validacionesDe(p.fecha)?.[p.accion.id] ? <Check size={12} className="shrink-0 text-white/60" aria-label="Validada" /> : null}
                  </button>
                </li>
              );
            })}
          </ul>
        ) : null}
      </div>
    </Dialog>
  );
}

function siguiente(lista: Pieza[], id: string | null, paso: number) {
  if (!lista.length) return id;

  const i = Math.max(
    0,
    lista.findIndex((p) => claveDe(p) === id),
  );

  return claveDe(lista[(i + paso + lista.length) % lista.length]);
}
