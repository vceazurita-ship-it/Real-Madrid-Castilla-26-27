"use client";

/**
 * EL VISOR DE CLIPS (29/10/2026; revisión con teclado desde el 30/10/2026).
 *
 * Cada barra, punto o cifra del panel (./PanelVisual.tsx) abre aquí las
 * acciones que la forman, y el paso «Revisar» de la cabecera abre la cola
 * de lo que queda sin validar. Arriba el reproductor; debajo, el veredicto y
 * los tres botones; al fondo, la lista para saltar.
 *
 * Revisión del 30/10/2026 (el analista: «mucho más fiable y más usable»):
 *   - Teclado: ← → para moverse, 1/C correcta, 2/M mejorable, 3/D descartar,
 *     0 quitar la validación, espacio o K para parar y seguir el vídeo.
 *   - Tras validar salta sola a la siguiente sin validar (se puede apagar).
 *   - La acción que se acaba de validar ya no desaparece de la lista aunque
 *     deje de casar con el filtro: antes el visor saltaba a la primera y se
 *     perdía el sitio.
 *   - «Revisadas X de N» siempre a la vista.
 *   - Hudl se abre en el vídeo, no en el minuto: el texto ya no promete el
 *     salto (no lo hace).
 *
 * No se corta un clip de cada acción (sólo un ejemplo de cada veredicto por
 * objetivo): las que no lo tienen dicen su minuto y abren el vídeo de Hudl.
 */

import { useEffect, useMemo, useRef, useState } from "react";
import { Check, ChevronLeft, ChevronRight, CircleDashed, ExternalLink, Film, Keyboard, RotateCcw, ThumbsDown, ThumbsUp, X } from "lucide-react";

import { Dialog } from "@/components/abp/ui";
import { mmss, veredictoFinal, type AccionEntreno, type Validacion, type Veredicto } from "@/lib/entreno/modelo";

/** Una acción con lo que hace falta para enseñarla fuera de su día. */
export type Pieza = { accion: AccionEntreno; fecha: string; objetivo: string; fuenteUrl: string | null };

export type FiltroVisor = "todas" | "sin-validar" | Veredicto | "descartada";

/** `inicial` es la `claveDe` de la pieza con la que se abre. */
export type PeticionVisor = {
  titulo: string;
  subtitulo?: string;
  piezas: Pieza[];
  inicial?: string;
  /** Con qué filtro se abre («sin-validar» para revisar). */
  filtro?: FiltroVisor;
  /** «clip»: primero las que tienen clip (para enseñar); «minuto»: en el orden de la sesión (para revisar). */
  orden?: "clip" | "minuto";
};

/** Los ids de acción sólo son únicos dentro de su día: el visor mezcla días en la evolución. */
export const claveDe = (p: Pieza) => `${p.fecha}|${p.accion.id}`;

/** Paleta validada de DATA (memoria data-analisis): separa en daltonismo, a diferencia del verde/rojo. */
export const COLOR_BIEN = "#1B9E77";
export const COLOR_MEJORABLE = "#D95F02";

const FOCO = "focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-[#C8A96B]";
const ddmm = (f: string) => f.split("-").reverse().slice(0, 2).join("/");

const FILTROS: [FiltroVisor, string][] = [
  ["todas", "Todas"],
  ["sin-validar", "Sin validar"],
  ["correcta", "Correctas"],
  ["mejorable", "Mejorables"],
  ["descartada", "Descartadas"],
];

export function VisorClips({
  peticion,
  onClose,
  validacionesDe,
  fechaEditable,
  onValida,
  bloqueado = false,
}: {
  peticion: PeticionVisor;
  onClose: () => void;
  validacionesDe: (fecha: string) => Record<string, Validacion> | undefined;
  /** Sólo se valida lo del día abierto (lo demás vive en su propio documento). */
  fechaEditable: string;
  onValida: (id: string, v: Validacion | null) => void;
  /** Mientras se lee el documento del día no se valida: lo escrito se perdería. */
  bloqueado?: boolean;
}) {
  const [filtro, setFiltro] = useState<FiltroVisor>(peticion.filtro ?? "todas");
  const [autoAvance, setAutoAvance] = useState(true);
  const video = useRef<HTMLVideoElement | null>(null);

  const ordenadas = useMemo(
    () =>
      [...peticion.piezas].sort((a, b) =>
        peticion.orden === "minuto"
          ? a.fecha.localeCompare(b.fecha) || a.accion.inicio - b.accion.inicio
          : Number(Boolean(b.accion.clip)) - Number(Boolean(a.accion.clip)) || a.fecha.localeCompare(b.fecha) || a.accion.inicio - b.accion.inicio,
      ),
    [peticion.piezas, peticion.orden],
  );
  const valDe = (p: Pieza) => validacionesDe(p.fecha)?.[p.accion.id];
  const veredictoDe = (p: Pieza) => veredictoFinal(p.accion, validacionesDe(p.fecha));
  const casa = (p: Pieza, f: FiltroVisor) => (f === "todas" ? true : f === "sin-validar" ? !valDe(p) : f === "descartada" ? veredictoDe(p) === null : veredictoDe(p) === f);
  const cuentaDe = (f: FiltroVisor) => ordenadas.filter((p) => casa(p, f)).length;

  /* La primera con la que se abre: la pedida o, si no, la primera del filtro. */
  const [elegida, setElegida] = useState<string | null>(() => {
    if (peticion.inicial) return peticion.inicial;

    const primera = ordenadas.find((p) => casa(p, peticion.filtro ?? "todas"));

    return primera ? claveDe(primera) : null;
  });

  /* La elegida sigue en la lista aunque, al validarla, deje de casar con el filtro. */
  const visibles = ordenadas.filter((p) => casa(p, filtro) || claveDe(p) === elegida);
  const indice = Math.max(
    0,
    visibles.findIndex((p) => claveDe(p) === elegida),
  );
  const actual = visibles[indice] ?? null;

  const mueve = (paso: number) => {
    if (!visibles.length) return;

    setElegida(claveDe(visibles[(indice + paso + visibles.length) % visibles.length]));
  };

  const editables = ordenadas.filter((p) => p.fecha === fechaEditable);
  const revisadas = editables.filter((p) => valDe(p)).length;
  const v = actual ? veredictoDe(actual) : null;
  const val = actual ? valDe(actual) : undefined;
  const editable = actual?.fecha === fechaEditable && !bloqueado;
  const conClip = ordenadas.filter((p) => p.accion.clip).length;

  /** Valida la actual y, si toca, salta a la siguiente que siga sin validar. */
  const decide = (nueva: Validacion | null) => {
    if (!actual || !editable) return;

    onValida(actual.accion.id, nueva);

    if (!nueva || !autoAvance) return;

    const resto = [...ordenadas.slice(ordenadas.indexOf(actual) + 1), ...ordenadas.slice(0, ordenadas.indexOf(actual))];
    const siguiente = resto.find((p) => p.fecha === fechaEditable && !valDe(p) && casa(p, filtro === "sin-validar" ? "todas" : filtro));

    if (siguiente) setElegida(claveDe(siguiente));
  };

  /* El teclado lee siempre lo último (referencia al día en un efecto, la forma que pasa el linter). */
  const teclas = useRef<(e: KeyboardEvent) => void>(() => {});

  useEffect(() => {
    teclas.current = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement | null;

      if (e.metaKey || e.ctrlKey || e.altKey) return;
      if (t instanceof HTMLInputElement || t instanceof HTMLTextAreaElement || t instanceof HTMLSelectElement) return;

      const k = e.key.toLowerCase();

      /* Con el foco en el vídeo, las flechas mueven el vídeo (es lo que espera quien lo usa). */
      if ((k === "arrowright" || k === "arrowleft") && t instanceof HTMLVideoElement) return;

      if (k === "arrowright") mueve(1);
      else if (k === "arrowleft") mueve(-1);
      else if (k === "1" || k === "c") decide("correcta");
      else if (k === "2" || k === "m") decide("mejorable");
      else if (k === "3" || k === "d") decide("descartada");
      else if (k === "0") decide(null);
      else if ((k === " " && !(t instanceof HTMLButtonElement) && !(t instanceof HTMLVideoElement)) || k === "k") {
        const el = video.current;

        if (!el) return;
        if (el.paused) void el.play().catch(() => undefined);
        else el.pause();
      } else return;

      e.preventDefault();
    };
  });

  useEffect(() => {
    const oyente = (e: KeyboardEvent) => teclas.current(e);

    window.addEventListener("keydown", oyente);

    return () => window.removeEventListener("keydown", oyente);
  }, []);

  const etiquetaVal = (x: Validacion | undefined, a: AccionEntreno) => (x ? (x !== "descartada" && x !== a.veredicto ? "Validada (cambiada)" : "Validada") : "Propuesta automática");

  return (
    <Dialog
      title={peticion.titulo}
      subtitle={[peticion.subtitulo, `${ordenadas.length} ${ordenadas.length === 1 ? "acción" : "acciones"}${conClip ? ` · ${conClip} con clip` : ""}`, editables.length ? `${revisadas} de ${editables.length} revisadas` : ""].filter(Boolean).join(" · ")}
      onClose={onClose}
    >
      <div className="space-y-3">
        {editables.length ? (
          <div className="h-1 overflow-hidden rounded-full bg-white/10" role="progressbar" aria-valuemin={0} aria-valuemax={editables.length} aria-valuenow={revisadas} aria-label="Acciones revisadas">
            <div className="h-full transition-all" style={{ width: `${(100 * revisadas) / editables.length}%`, background: "var(--rmcf-gold-ink)" }} />
          </div>
        ) : null}

        <div className="flex flex-wrap gap-1.5 text-xs" role="group" aria-label="Filtrar acciones del visor">
          {FILTROS.filter(([k]) => k === "todas" || k === filtro || cuentaDe(k) > 0).map(([k, t]) => (
            <button key={k} type="button" aria-pressed={filtro === k} onClick={() => setFiltro(k)} className={`rounded-lg px-3 py-1.5 ${FOCO} ${filtro === k ? "bg-[#C8A96B] font-semibold text-black" : "border border-white/12 text-white/65 hover:text-white"}`}>
              {t} <span className="tabular-nums opacity-70">{cuentaDe(k)}</span>
            </button>
          ))}
        </div>

        {actual ? (
          <div className="space-y-2.5">
            {actual.accion.clip ? (
              /* Siempre oscuro: es una pantalla de vídeo, también en modo día. */
              <div className="siempre-oscuro overflow-hidden rounded-xl" style={{ background: "#000" }}>
                <video ref={video} key={claveDe(actual)} src={actual.accion.clip} controls autoPlay loop preload="metadata" playsInline className="aspect-video w-full" />
              </div>
            ) : (
              <div className="flex aspect-video w-full flex-col items-center justify-center gap-2 rounded-xl border border-dashed border-white/15 bg-white/[0.03] px-4 text-center">
                <p className="text-4xl font-semibold tabular-nums text-white">{mmss(actual.accion.inicio)}</p>
                <p className="max-w-sm text-xs text-white/55">Esta acción no tiene clip cortado (se corta un ejemplo de cada veredicto por objetivo): búscala en ese minuto del vídeo de la sesión.</p>
                {actual.fuenteUrl ? (
                  <a href={actual.fuenteUrl} target="_blank" rel="noreferrer" className={`inline-flex items-center gap-1.5 rounded-lg border border-[#C8A96B]/40 px-3 py-1.5 text-xs font-semibold text-[#C8A96B] hover:bg-[#C8A96B]/10 ${FOCO}`}>
                    <ExternalLink size={12} aria-hidden /> Abrir el vídeo en Hudl
                  </a>
                ) : null}
              </div>
            )}

            <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5 text-xs">
              <span className="inline-flex items-center gap-0.5">
                <button type="button" onClick={() => mueve(-1)} disabled={visibles.length < 2} aria-label="Acción anterior" title="Anterior (←)" className={`rounded-lg border border-white/12 p-1.5 text-white/70 hover:text-white disabled:opacity-40 ${FOCO}`}>
                  <ChevronLeft size={15} />
                </button>
                <span className="min-w-[3.5rem] text-center tabular-nums text-white/60">
                  {indice + 1} de {visibles.length}
                </span>
                <button type="button" onClick={() => mueve(1)} disabled={visibles.length < 2} aria-label="Acción siguiente" title="Siguiente (→)" className={`rounded-lg border border-white/12 p-1.5 text-white/70 hover:text-white disabled:opacity-40 ${FOCO}`}>
                  <ChevronRight size={15} />
                </button>
              </span>
              <span className="inline-flex items-center gap-1.5 font-semibold text-white/90">
                <span className="h-2.5 w-2.5 rounded-full" style={{ background: v === "correcta" ? COLOR_BIEN : v === "mejorable" ? COLOR_MEJORABLE : "rgb(var(--rmcf-ink-rgb) / .3)" }} aria-hidden />
                {v === null ? "Descartada" : v === "correcta" ? "Correcta" : "Mejorable"}
              </span>
              <span className={`inline-flex items-center gap-1 ${val ? "text-white/75" : "text-white/55"}`}>
                {val ? <Check size={12} aria-hidden /> : <CircleDashed size={12} aria-hidden />}
                {etiquetaVal(val, actual.accion)}
              </span>
              <span className="tabular-nums text-white/55">
                {actual.fecha !== fechaEditable ? `${ddmm(actual.fecha)} · ` : ""}
                {mmss(actual.accion.inicio)}–{mmss(actual.accion.fin)}
              </span>
            </div>

            <div className="space-y-1">
              <p className="text-[11px] uppercase tracking-wider text-[#C8A96B]">{actual.objetivo}</p>
              {actual.accion.jugador ? <p className="text-xs font-medium text-white/70">{actual.accion.jugador}</p> : null}
              {actual.accion.explicacion ? <p className="text-sm leading-relaxed text-white/85">{actual.accion.explicacion}</p> : null}
            </div>

            {actual.fecha === fechaEditable ? (
              <div className="space-y-2">
                <div className="grid grid-cols-3 gap-2">
                  <BotonVeredicto icono={ThumbsUp} texto="Correcta" tecla="1" activo={val === "correcta"} color={COLOR_BIEN} disabled={!editable} onClick={() => decide(val === "correcta" ? null : "correcta")} />
                  <BotonVeredicto icono={ThumbsDown} texto="Mejorable" tecla="2" activo={val === "mejorable"} color={COLOR_MEJORABLE} disabled={!editable} onClick={() => decide(val === "mejorable" ? null : "mejorable")} />
                  <BotonVeredicto icono={val === "descartada" ? RotateCcw : X} texto={val === "descartada" ? "Recuperar" : "Descartar"} tecla="3" activo={val === "descartada"} disabled={!editable} onClick={() => decide(val === "descartada" ? null : "descartada")} />
                </div>
                <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-[11px] text-white/50">
                  <label className="inline-flex cursor-pointer items-center gap-1.5">
                    <input type="checkbox" checked={autoAvance} onChange={(e) => setAutoAvance(e.target.checked)} className="accent-[#C8A96B]" />
                    Pasar sola a la siguiente sin validar
                  </label>
                  <span className="hidden items-center gap-1.5 sm:inline-flex">
                    <Keyboard size={12} aria-hidden />
                    <Tecla>1</Tecla> correcta · <Tecla>2</Tecla> mejorable · <Tecla>3</Tecla> descartar · <Tecla>0</Tecla> quitar · <Tecla>←</Tecla>
                    <Tecla>→</Tecla> moverse · <Tecla>espacio</Tecla> vídeo
                  </span>
                  {bloqueado ? <span className="text-amber-300/80">Leyendo los objetivos del día: en un momento se puede validar.</span> : null}
                </div>
              </div>
            ) : (
              <p className="text-[11px] text-white/50">Es de otro día: se valida abriendo ese día.</p>
            )}
          </div>
        ) : (
          <p className="py-6 text-center text-sm text-white/60">Nada con este filtro.</p>
        )}

        {visibles.length > 1 ? (
          <ul className="max-h-64 space-y-0.5 overflow-y-auto border-t border-white/10 pt-2" aria-label="Acciones">
            {visibles.map((p) => {
              const vp = veredictoDe(p);
              const sel = actual !== null && claveDe(p) === claveDe(actual);
              const validada = Boolean(valDe(p));

              return (
                <li key={claveDe(p)}>
                  <button
                    type="button"
                    onClick={() => setElegida(claveDe(p))}
                    aria-current={sel ? "true" : undefined}
                    className={`flex w-full min-w-0 items-center gap-2 rounded-lg px-2 py-1.5 text-left text-xs ${FOCO} ${sel ? "bg-white/[0.08] text-white" : "text-white/70 hover:bg-white/[0.04]"}`}
                  >
                    {/* Relleno = validada; aro = propuesta automática. */}
                    <span
                      className="h-2.5 w-2.5 shrink-0 rounded-full"
                      style={{
                        background: validada ? (vp === "correcta" ? COLOR_BIEN : vp === "mejorable" ? COLOR_MEJORABLE : "rgb(var(--rmcf-ink-rgb) / .3)") : "transparent",
                        border: `2px solid ${vp === "correcta" ? COLOR_BIEN : vp === "mejorable" ? COLOR_MEJORABLE : "rgb(var(--rmcf-ink-rgb) / .3)"}`,
                      }}
                      aria-label={validada ? "Validada" : "Sin validar"}
                    />
                    <span className="w-11 shrink-0 tabular-nums text-white/55">{mmss(p.accion.inicio)}</span>
                    {p.accion.clip ? <Film size={12} className="shrink-0 text-[#C8A96B]" aria-label="Con clip" /> : <span className="w-3 shrink-0" aria-hidden />}
                    <span className={`min-w-0 flex-1 truncate ${vp === null ? "line-through opacity-60" : ""}`}>{p.accion.explicacion || p.objetivo}</span>
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

function Tecla({ children }: { children: string }) {
  return <kbd className="rounded border border-white/15 bg-white/[0.06] px-1 font-sans text-[10px] text-white/70">{children}</kbd>;
}

function BotonVeredicto({
  icono: Icono,
  texto,
  tecla,
  activo,
  color,
  disabled,
  onClick,
}: {
  icono: typeof ThumbsUp;
  texto: string;
  tecla: string;
  activo: boolean;
  color?: string;
  disabled: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={(e) => {
        /* Sin el foco en el botón: el espacio y los números siguen siendo del visor y no repiten el clic. */
        e.currentTarget.blur();
        onClick();
      }}
      disabled={disabled}
      aria-pressed={activo}
      aria-keyshortcuts={tecla}
      title={activo ? "Quitar la validación" : `${texto} (${tecla})`}
      className={`inline-flex min-h-11 items-center justify-center gap-1.5 rounded-xl border px-2 text-sm font-semibold transition disabled:cursor-not-allowed disabled:opacity-50 ${FOCO} ${activo ? "text-white" : "border-white/12 text-white/75 hover:text-white"}`}
      style={activo ? { background: color ?? "rgb(var(--rmcf-ink-rgb) / .35)", borderColor: color ?? "transparent", color: "#fff" } : undefined}
    >
      <Icono size={15} aria-hidden />
      {texto}
    </button>
  );
}
