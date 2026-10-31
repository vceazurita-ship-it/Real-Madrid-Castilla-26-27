"use client";

/**
 * Mis tareas del microciclo (28/10/2026; editable desde el 31/10/2026): la
 * agenda del analista entre el último partido y el próximo, éste incluido.
 * Cada día lleva su etiqueta (MD+1… MD) y si se entrena, se libra o se compite:
 * el partido sale del calendario de BeSoccer y las sesiones, de la hoja de
 * registro de tareas. Las tareas se reparten solas por el día del micro y el
 * analista las añade, edita (texto, día, prioridad), quita y marca. Sólo la ve
 * el administrador (la monta la portada). Modelo en `lib/portada/mis-tareas.ts`.
 */

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { ArrowDownToLine, Check, Pencil, Plus, Trash2, X } from "lucide-react";

import { useCalendario } from "@/hooks/useCalendario";
import { useMisTareas, useSesionesDelMicro } from "@/hooks/useMisTareas";
import type { Prioridad } from "@/lib/portada/agenda-semana";
import {
  NOMBRE_PRIORIDAD,
  NOMBRE_TIPO,
  PRIORIDADES,
  alternaHechaAuto,
  alternaHechaPropia,
  anade,
  edita,
  hoyEnMadrid,
  nuevoId,
  pendientesAnteriores,
  quita,
  rotuloDia,
  semanaDelMicro,
  type TareaDelDia,
} from "@/lib/portada/mis-tareas";

const COLOR_TIPO = {
  entreno: "border-emerald-400/40 text-emerald-300",
  libre: "border-white/20 text-white/55",
  partido: "border-[#D8B45A]/60 text-[#D8B45A]",
} as const;

const COLOR_PRIORIDAD: Record<Prioridad, string> = {
  alta: "bg-red-500/15 text-red-300",
  media: "bg-white/10 text-white/60",
  baja: "bg-sky-500/10 text-sky-300",
};

type Formulario = { clave: string | null; fecha: string; texto: string; prioridad: Prioridad };

export function MisTareas() {
  const { partidos } = useCalendario();
  const { sesiones } = useSesionesDelMicro();
  const { hechas, doc, cambiaHechas, cambiaDoc, guardando, error } = useMisTareas();

  const [hoy, setHoy] = useState("");

  useEffect(() => {
    const id = setTimeout(() => setHoy(hoyEnMadrid()), 0);

    return () => clearTimeout(id);
  }, []);

  /* El formulario abierto: `clave` null es una tarea nueva. */
  const [form, setForm] = useState<Formulario | null>(null);

  const semana = useMemo(
    () => (hoy && partidos.length ? semanaDelMicro({ partidos, hoy, hechas, doc, sesiones }) : null),
    [partidos, hoy, hechas, doc, sesiones],
  );

  const vencidas = useMemo(
    () => (hoy && partidos.length ? pendientesAnteriores({ partidos, hoy, hechas, doc, sesiones }) : []),
    [partidos, hoy, hechas, doc, sesiones],
  );

  if (!semana) return <p className="rounded-2xl border border-white/10 p-5 text-sm text-white/60">Cargando el calendario…</p>;

  const { proximo, dias } = semana;

  const primero = dias[0]?.fecha ?? hoy;
  const ultimo = dias[dias.length - 1]?.fecha ?? hoy;

  /* Lo vencido que no cabe en la semana (del micro anterior o movido a mano). */
  const deAntes = vencidas.filter((t) => t.fecha < primero);

  const masAdelante = doc.propias.filter((t) => t.fecha > ultimo).sort((a, b) => a.fecha.localeCompare(b.fecha));

  const todas = dias.flatMap((d) => d.tareas);
  const total = todas.length;
  const hechasN = todas.filter((t) => t.hecha).length;

  const hechaId = (id: string) => todas.some((t) => t.id === id && t.hecha);
  const nombreDe = (id: string) => todas.find((t) => t.id === id)?.texto ?? "la anterior";

  const marca = (t: TareaDelDia, hecha: boolean) => {
    if (t.tipo === "auto") cambiaHechas((h) => alternaHechaAuto(h, t.clave, hecha));
    else cambiaDoc((d) => alternaHechaPropia(d, t.id, hecha));
  };

  const borra = (t: TareaDelDia) => {
    if (!window.confirm(`¿Quitar «${t.texto}»?`)) return;

    cambiaDoc((d) => quita(d, t));
  };

  const pasaAHoy = (t: TareaDelDia) => {
    const id = nuevoId();

    cambiaDoc((d) => edita(d, t, { fecha: hoy }, id));
  };

  const guarda = () => {
    if (!form || !form.texto.trim() || !form.fecha) return;

    const id = nuevoId();
    const original = form.clave ? [...todas, ...deAntes].find((t) => t.clave === form.clave) : null;

    if (original) cambiaDoc((d) => edita(d, original, { texto: form.texto, fecha: form.fecha, prioridad: form.prioridad }, id));
    else cambiaDoc((d) => anade(d, { fecha: form.fecha, texto: form.texto, prioridad: form.prioridad }, id));

    setForm(null);
  };

  const abreEdicion = (t: TareaDelDia) => setForm({ clave: t.clave, fecha: t.fecha, texto: t.texto, prioridad: t.prioridad });

  const abreNueva = (fecha: string) => setForm({ clave: null, fecha, texto: "", prioridad: "media" });

  const editor = (
    <FormularioTarea
      form={form}
      dias={dias.map((d) => ({ fecha: d.fecha, rotulo: `${rotuloDia(d.fecha)} · ${d.md}` }))}
      onCambia={setForm}
      onGuarda={guarda}
      onCancela={() => setForm(null)}
    />
  );

  const fila = (t: TareaDelDia, pasado: boolean, conPasarAHoy = false) => {
    if (form?.clave === t.clave) return <li key={t.clave}>{editor}</li>;

    return (
      <li key={t.clave} className="group flex min-w-0 items-start gap-2">
        <button
          type="button"
          onClick={() => marca(t, !t.hecha)}
          aria-pressed={t.hecha}
          aria-label={t.hecha ? `Desmarcar ${t.texto}` : `Marcar ${t.texto} como hecha`}
          className={`mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-md border ${t.hecha ? "border-emerald-400 bg-emerald-500/80" : pasado ? "border-red-400/70" : "border-white/30"}`}
        >
          {t.hecha && <Check className="h-3.5 w-3.5 text-white" />}
        </button>

        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-1.5">
            {t.href ? (
              <Link href={t.href} className={`text-sm font-medium hover:underline ${t.hecha ? "text-white/45 line-through" : pasado ? "text-red-300" : "text-white/90"}`}>
                {t.texto}
              </Link>
            ) : (
              <span className={`text-sm font-medium ${t.hecha ? "text-white/45 line-through" : pasado ? "text-red-300" : "text-white/90"}`}>{t.texto}</span>
            )}
            {t.prioridad !== "media" && <span className={`rounded-full px-1.5 py-px text-[10px] font-semibold uppercase tracking-wide ${COLOR_PRIORIDAD[t.prioridad]}`}>{NOMBRE_PRIORIDAD[t.prioridad]}</span>}
          </div>
          {t.hecho && <p className="text-xs text-white/50">{t.hecho}</p>}
          {!t.hecha && t.requiere && !hechaId(t.requiere) && <p className="text-xs text-amber-300">Antes: {nombreDe(t.requiere)}</p>}
          {t.recortable && <p className="text-xs text-white/40">Recortable esta semana</p>}
          {conPasarAHoy && <p className="text-xs text-red-300/80">Del {rotuloDia(t.fecha)}</p>}
        </div>

        <div className="flex shrink-0 items-center gap-0.5 opacity-70 group-hover:opacity-100">
          {conPasarAHoy && (
            <button type="button" onClick={() => pasaAHoy(t)} aria-label={`Pasar ${t.texto} a hoy`} title="Pasar a hoy" className="rounded-md p-1 text-white/55 hover:bg-white/10 hover:text-white">
              <ArrowDownToLine className="h-3.5 w-3.5" />
            </button>
          )}
          <button type="button" onClick={() => abreEdicion(t)} aria-label={`Editar ${t.texto}`} title="Editar" className="rounded-md p-1 text-white/55 hover:bg-white/10 hover:text-white">
            <Pencil className="h-3.5 w-3.5" />
          </button>
          <button type="button" onClick={() => borra(t)} aria-label={`Quitar ${t.texto}`} title="Quitar" className="rounded-md p-1 text-white/55 hover:bg-white/10 hover:text-red-300">
            <Trash2 className="h-3.5 w-3.5" />
          </button>
        </div>
      </li>
    );
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div className="min-w-0">
          <h2 className="text-xl font-bold text-white">Mis tareas del microciclo</h2>
          <p className="text-sm text-white/60">
            Hasta el partido ante {proximo.rival} · {hechasN} de {total} hechas
            {guardando ? " · guardando…" : error ? " · no se ha podido guardar, se reintenta" : ""}
          </p>
        </div>
        <div className="flex items-center gap-3">
          <div className="h-2 w-40 overflow-hidden rounded-full bg-white/10">
            <div className="h-full rounded-full bg-[#D8B45A]" style={{ width: `${total ? (hechasN / total) * 100 : 0}%` }} />
          </div>
          <button
            type="button"
            onClick={() => abreNueva(dias.some((d) => d.fecha === hoy) ? hoy : primero)}
            className="inline-flex items-center gap-1.5 rounded-full bg-[#D8B45A] px-3.5 py-1.5 text-sm font-semibold text-[#0B0F14]"
          >
            <Plus className="h-4 w-4" /> Añadir tarea
          </button>
        </div>
      </div>

      {form && form.clave === null && <div className="max-w-xl">{editor}</div>}

      {deAntes.length > 0 && (
        <section className="rounded-2xl border border-red-400/40 bg-red-500/[0.06] p-4">
          <h3 className="mb-2 font-semibold text-red-200">Sin hacer de días anteriores · {deAntes.length}</h3>
          <ul className="space-y-1.5">{deAntes.map((t) => fila(t, true, true))}</ul>
        </section>
      )}

      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
        {dias.map((d) => {
          const esHoy = d.fecha === hoy;
          const pasado = Boolean(hoy) && d.fecha < hoy;

          return (
            <section key={d.fecha} className={`min-w-0 rounded-2xl border p-4 ${esHoy ? "border-[#D8B45A]/60 bg-[#D8B45A]/10" : "border-white/10 bg-white/[0.03]"}`}>
              <div className="mb-2 flex items-center justify-between gap-2">
                <h3 className="font-semibold text-white">{rotuloDia(d.fecha)}</h3>
                <div className="flex items-center gap-1.5">
                  <span className={`rounded-full border px-2 py-px text-[10px] font-semibold uppercase tracking-wide ${COLOR_TIPO[d.tipo]}`}>{NOMBRE_TIPO[d.tipo]}</span>
                  <span className="text-xs font-semibold text-white/55">{esHoy ? `HOY · ${d.md}` : d.md}</span>
                </div>
              </div>

              <ul className="space-y-1.5">{d.tareas.map((t) => fila(t, pasado, pasado && !t.hecha))}</ul>

              {d.tareas.length === 0 && <p className="text-sm text-white/45">Día despejado.</p>}

              <button type="button" onClick={() => abreNueva(d.fecha)} className="mt-2 inline-flex items-center gap-1 text-xs font-semibold text-white/50 hover:text-white">
                <Plus className="h-3.5 w-3.5" /> Añadir a este día
              </button>
            </section>
          );
        })}
      </div>

      {masAdelante.length > 0 && (
        <section className="rounded-2xl border border-white/10 bg-white/[0.03] p-4">
          <h3 className="mb-2 font-semibold text-white">Más adelante</h3>
          <ul className="space-y-1">
            {masAdelante.map((t) => (
              <li key={t.id} className="text-sm text-white/75">
                {rotuloDia(t.fecha)} · {t.texto}
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}

function FormularioTarea({
  form,
  dias,
  onCambia,
  onGuarda,
  onCancela,
}: {
  form: Formulario | null;
  dias: { fecha: string; rotulo: string }[];
  onCambia: (f: Formulario) => void;
  onGuarda: () => void;
  onCancela: () => void;
}) {
  if (!form) return null;

  const enLaSemana = dias.some((d) => d.fecha === form.fecha);

  return (
    <form
      className="space-y-2 rounded-xl border border-[#D8B45A]/40 bg-[#0B0F14] p-3"
      onSubmit={(e) => {
        e.preventDefault();
        onGuarda();
      }}
      onKeyDown={(e) => {
        if (e.key === "Escape") onCancela();
      }}
    >
      <label className="block text-xs font-semibold text-white/60">
        Tarea
        <input
          autoFocus
          value={form.texto}
          onChange={(e) => onCambia({ ...form, texto: e.target.value })}
          placeholder="Qué hay que hacer"
          className="mt-1 w-full rounded-lg border border-white/15 bg-white/5 px-2.5 py-1.5 text-sm text-white placeholder:text-white/35"
        />
      </label>

      <div className="flex flex-wrap gap-2">
        <label className="min-w-0 flex-1 text-xs font-semibold text-white/60">
          Día
          <select
            value={enLaSemana ? form.fecha : "otro"}
            onChange={(e) => onCambia({ ...form, fecha: e.target.value === "otro" ? form.fecha : e.target.value })}
            className="mt-1 w-full rounded-lg border border-white/15 bg-[#0B0F14] px-2 py-1.5 text-sm text-white"
          >
            {dias.map((d) => (
              <option key={d.fecha} value={d.fecha}>
                {d.rotulo}
              </option>
            ))}
            <option value="otro">Otro día…</option>
          </select>
        </label>

        {!enLaSemana && (
          <label className="text-xs font-semibold text-white/60">
            Fecha
            <input
              type="date"
              value={form.fecha}
              onChange={(e) => onCambia({ ...form, fecha: e.target.value })}
              className="mt-1 block rounded-lg border border-white/15 bg-white/5 px-2 py-1.5 text-sm text-white"
            />
          </label>
        )}

        <label className="text-xs font-semibold text-white/60">
          Prioridad
          <select
            value={form.prioridad}
            onChange={(e) => onCambia({ ...form, prioridad: e.target.value as Prioridad })}
            className="mt-1 block rounded-lg border border-white/15 bg-[#0B0F14] px-2 py-1.5 text-sm text-white"
          >
            {PRIORIDADES.map((p) => (
              <option key={p} value={p}>
                {NOMBRE_PRIORIDAD[p]}
              </option>
            ))}
          </select>
        </label>
      </div>

      <div className="flex justify-end gap-2">
        <button type="button" onClick={onCancela} className="inline-flex items-center gap-1 rounded-full px-3 py-1 text-sm text-white/65 hover:text-white">
          <X className="h-3.5 w-3.5" /> Cancelar
        </button>
        <button type="submit" disabled={!form.texto.trim() || !form.fecha} className="rounded-full bg-[#D8B45A] px-3.5 py-1 text-sm font-semibold text-[#0B0F14] disabled:opacity-50">
          Guardar
        </button>
      </div>
    </form>
  );
}
