"use client";

/**
 * Lo que toca según el último post, como objetivos (21/10/2026): un botón que
 * lee el informe post del último partido y propone sus líneas de «Qué toca en
 * el microciclo».
 *
 * Una consigna de equipo («Cerramos los partidos con ventaja») no se mide en
 * vídeo: al elegirla se abre el objetivo entero ya propuesto —a qué línea se
 * le pide, en qué tarea, qué es correcto y qué mejorable, la meta y de dónde
 * sale— (lib/entreno/plantillas.ts). Es un borrador: no entra en la sesión,
 * y por tanto no se guarda, hasta que se pulsa «Añadir a la sesión».
 */

import { useState } from "react";
import { Check, ListPlus, Loader2, Plus, X } from "lucide-react";

import { Button } from "@/components/abp/ui";
import { SeleccionJugadores, type JugadorElegible } from "@/components/seguimiento/SeleccionJugadores";
import type { ObjetivoEntreno } from "@/lib/entreno/modelo";
import { LINEAS, lineaDe, propuestaDe, type Linea, type Propuesta } from "@/lib/entreno/plantillas";
import { queTocaDelUltimoPost, type QueTocaDelPost as Leido } from "@/lib/entreno/sugerencias";

import { CAMPO, type TareaDelDia } from "./ObjetivoEditor";

const ETIQUETA = "mb-1 block text-[10px] font-semibold uppercase tracking-[0.14em] text-white/45";

export function QueTocaDelPost({
  yaEstan,
  jugadores,
  tareas,
  onAnade,
}: {
  /** Los orígenes de los objetivos que ya tiene la sesión. */
  yaEstan: string[];
  jugadores: JugadorElegible[];
  tareas: TareaDelDia[];
  onAnade: (objetivo: Omit<ObjetivoEntreno, "id">) => void;
}) {
  const [estado, setEstado] = useState<"quieto" | "leyendo" | "listo" | "nada">("quieto");
  const [leido, setLeido] = useState<Leido | null>(null);
  /** La línea que se está preparando y su borrador. */
  const [borrador, setBorrador] = useState<{ linea: string; p: Propuesta } | null>(null);

  const lee = async () => {
    setEstado("leyendo");

    const p = await queTocaDelUltimoPost().catch(() => null);

    setLeido(p);
    setEstado(p ? "listo" : "nada");
  };

  if (estado === "quieto" || estado === "leyendo") {
    return (
      <Button icon={estado === "leyendo" ? Loader2 : ListPlus} onClick={() => void lee()} disabled={estado === "leyendo"} title="Lee el informe post del último partido y propone lo que toca trabajar">
        {estado === "leyendo" ? "Leyendo el último post…" : "Lo que toca según el post"}
      </Button>
    );
  }

  if (estado === "nada" || !leido) {
    return <p className="text-xs text-white/50">El último post no deja nada que trabajar esta semana.</p>;
  }

  return (
    <div className="w-full min-w-0 space-y-2 rounded-xl border border-[#C8A96B]/25 bg-[#C8A96B]/[0.05] p-3">
      <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-[var(--rmcf-gold-ink,#C8A96B)]">
        Qué toca según el {leido.origen.replace(/^Post/, "post")} · {leido.rival}
      </p>
      <ul className="space-y-2">
        {leido.lineas.map((l) => {
          const consigna = l.texto.split(" · ")[0].trim();
          const puesto = yaEstan.some((o) => o.startsWith(`${leido.origen} · ${consigna}`) || o === `${leido.origen} · ${l.tema}`);
          const abierto = borrador?.linea === l.texto;

          return (
            <li key={l.texto} className="min-w-0 space-y-2">
              <div className="flex min-w-0 flex-wrap items-center gap-2">
                <span className="min-w-0 flex-1 text-sm text-white/85">{l.texto}</span>
                <Button
                  icon={puesto ? Check : abierto ? X : Plus}
                  onClick={() => setBorrador(abierto ? null : { linea: l.texto, p: propuestaDe(l.texto, leido.origen, jugadores, tareas) })}
                  disabled={puesto}
                  aria-pressed={abierto}
                  title={puesto ? "Ya es un objetivo de este día" : "Prepararlo como objetivo: a quién, en qué tarea y qué es correcto"}
                >
                  {puesto ? "Añadido" : abierto ? "Cerrar" : "Preparar objetivo"}
                </Button>
              </div>
              {abierto && borrador ? (
                <Borrador
                  p={borrador.p}
                  jugadores={jugadores}
                  tareas={tareas}
                  onCambia={(p) => setBorrador({ linea: l.texto, p })}
                  onCancela={() => setBorrador(null)}
                  onConfirma={() => {
                    onAnade(aObjetivo(borrador.p));
                    setBorrador(null);
                  }}
                />
              ) : null}
            </li>
          );
        })}
      </ul>
    </div>
  );
}

/** Lo que entra en la sesión: el objetivo sin lo que sólo sirve al borrador. */
function aObjetivo(p: Propuesta): Omit<ObjetivoEntreno, "id"> {
  return { objetivo: p.objetivo.trim(), jugadores: p.jugadores, correcto: p.correcto?.trim(), mejorable: p.mejorable?.trim(), meta: p.meta, tarea: p.tarea, tareaTexto: p.tareaTexto, origen: p.origen };
}

/** El objetivo propuesto, para corregirlo antes de que entre en la sesión. */
function Borrador({
  p,
  jugadores,
  tareas,
  onCambia,
  onCancela,
  onConfirma,
}: {
  p: Propuesta;
  jugadores: JugadorElegible[];
  tareas: TareaDelDia[];
  onCambia: (p: Propuesta) => void;
  onCancela: () => void;
  onConfirma: () => void;
}) {
  const [eligiendo, setEligiendo] = useState(false);
  const pon = (parte: Partial<Propuesta>) => onCambia({ ...p, ...parte });

  /* Encender o apagar una línea añade o quita a todos los suyos. */
  const conmuta = (linea: Linea) => {
    const dentro = p.lineas.includes(linea);
    const suyos = jugadores.filter((j) => lineaDe(j.posicion) === linea);
    const ids = new Set(suyos.map((j) => j.id));

    pon({
      lineas: dentro ? p.lineas.filter((x) => x !== linea) : [...p.lineas, linea],
      jugadores: dentro ? p.jugadores.filter((j) => !ids.has(j.id)) : [...p.jugadores.filter((j) => !ids.has(j.id)), ...suyos.map((j) => ({ id: j.id, nombre: j.nombre }))],
    });
  };

  const falta = !p.objetivo.trim() ? "qué se busca" : !p.jugadores.length ? "a quién se le pide" : !p.correcto?.trim() || !p.mejorable?.trim() ? "qué es correcto y qué mejorable" : null;

  return (
    <div className="min-w-0 space-y-3 rounded-xl border border-white/10 bg-white/[0.04] p-3">
      {!p.conPlantilla ? <p className="text-[11px] text-white/55">Esta consigna no tiene plantilla: escribe qué es correcto y qué es mejorable para poder medirla.</p> : null}

      <label className="block min-w-0">
        <span className={ETIQUETA}>Qué se busca</span>
        <textarea value={p.objetivo} onChange={(e) => pon({ objetivo: e.target.value })} rows={2} className={`${CAMPO} resize-y font-medium`} />
      </label>

      <div className="min-w-0">
        <span className={ETIQUETA}>A quién{p.grupo ? ` · ${p.grupo}` : ""}</span>
        <div className="flex flex-wrap items-center gap-1.5">
          {LINEAS.map((l) => {
            const n = jugadores.filter((j) => lineaDe(j.posicion) === l.clave).length;

            return n ? (
              <Button key={l.clave} onClick={() => conmuta(l.clave)} aria-pressed={p.lineas.includes(l.clave)} tone={p.lineas.includes(l.clave) ? "primary" : "ghost"}>
                {l.nombre} ({n})
              </Button>
            ) : null;
          })}
          <Button onClick={() => setEligiendo((x) => !x)} aria-pressed={eligiendo}>
            {eligiendo ? "Listo" : "Uno a uno"}
          </Button>
          <span className="text-[11px] text-white/50">{p.jugadores.length ? `${p.jugadores.length} jugadores` : "Nadie elegido"}</span>
        </div>
        {eligiendo ? (
          <div className="mt-2">
            <SeleccionJugadores
              jugadores={jugadores}
              seleccion={p.jugadores.map((j) => j.id)}
              onCambia={(ids) => pon({ jugadores: ids.map((id) => ({ id, nombre: jugadores.find((x) => x.id === id)?.nombre ?? id })) })}
            />
          </div>
        ) : null}
      </div>

      <div className="grid gap-2 md:grid-cols-2">
        <label className="block min-w-0">
          <span className={ETIQUETA}>Es correcta si…</span>
          <textarea value={p.correcto ?? ""} onChange={(e) => pon({ correcto: e.target.value })} rows={3} className={`${CAMPO} resize-y`} />
        </label>
        <label className="block min-w-0">
          <span className={ETIQUETA}>Es mejorable si…</span>
          <textarea value={p.mejorable ?? ""} onChange={(e) => pon({ mejorable: e.target.value })} rows={3} className={`${CAMPO} resize-y`} />
        </label>
      </div>

      <div className="grid gap-2 sm:grid-cols-[minmax(0,1.3fr)_6.5rem]">
        <label className="block min-w-0">
          <span className={ETIQUETA}>Tarea del día</span>
          {tareas.length ? (
            <select
              value={p.tarea ?? ""}
              onChange={(e) => {
                const t = tareas.find((x) => x.codigo === e.target.value);

                pon({ tarea: t?.codigo, tareaTexto: t?.texto });
              }}
              className={CAMPO}
            >
              <option value="">Toda la sesión</option>
              {tareas.map((t) => (
                <option key={t.codigo} value={t.codigo}>
                  {t.codigo} · {t.texto}
                </option>
              ))}
            </select>
          ) : (
            <input value={p.tarea ?? ""} onChange={(e) => pon({ tarea: e.target.value || undefined, tareaTexto: undefined })} placeholder="L-T1" className={CAMPO} />
          )}
        </label>
        <label className="block min-w-0">
          <span className={ETIQUETA}>Meta (%)</span>
          <input
            type="number"
            inputMode="numeric"
            min={1}
            max={100}
            step={5}
            value={p.meta ?? ""}
            onChange={(e) => {
              const n = Math.round(Number(e.target.value));

              pon({ meta: e.target.value === "" || !Number.isFinite(n) ? undefined : Math.min(100, Math.max(1, n)) });
            }}
            className={`${CAMPO} tabular-nums`}
          />
        </label>
      </div>

      <p className="text-[11px] text-white/50">De dónde sale: {p.origen}</p>

      <div className="flex flex-wrap items-center gap-2">
        <Button tone="primary" icon={Check} onClick={onConfirma} disabled={Boolean(falta)} title={falta ? `Falta ${falta}` : "Entra en la sesión y se guarda"}>
          Añadir a la sesión
        </Button>
        <Button icon={X} onClick={onCancela}>
          Descartar
        </Button>
        {falta ? <span className="text-[11px] text-amber-300/80">Falta {falta}</span> : null}
      </div>
    </div>
  );
}
