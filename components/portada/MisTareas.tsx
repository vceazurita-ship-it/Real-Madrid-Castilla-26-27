"use client";

/**
 * Mis tareas del microciclo (28/10/2026; editable desde el 31/10/2026): la
 * agenda del analista entre el último partido y el próximo, éste incluido.
 * Cada día lleva su etiqueta (MD+1… MD) y si se entrena, se libra o se compite:
 * el partido sale del calendario de BeSoccer y las sesiones, de la hoja de
 * registro de tareas. Las tareas se reparten solas por el día del micro y el
 * analista las añade, edita (texto, día, prioridad), quita y marca. Sólo la ve
 * el administrador (la monta la portada). Modelo en `lib/portada/mis-tareas.ts`.
 *
 * Arrastrar (03/11/2026): una tarea se arrastra a otro día o a otro puesto de
 * su día (dnd-kit). Ratón: se coge al moverla unos píxeles. Dedo: pulsación
 * larga, para que deslizar siga siendo desplazar la página. Teclado: el asa
 * (Espacio o Intro, flechas, Espacio para soltar). Sin arrastrar: el botón del
 * calendario de cada tarea abre «Mover a» / «Duplicar en» con los días. Todo
 * se guarda por el mismo camino (`cambiaDoc` → `agenda:mis-tareas`) y se puede
 * deshacer desde el aviso o con Ctrl+Z (`Rastro`: el paso al revés, no una
 * foto, para no pisar lo cambiado después).
 */

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState, type ReactNode } from "react";
import {
  DndContext,
  DragOverlay,
  KeyboardSensor,
  MouseSensor,
  TouchSensor,
  closestCorners,
  pointerWithin,
  useDroppable,
  useSensor,
  useSensors,
  type Announcements,
  type CollisionDetection,
  type DragEndEvent,
  type DragOverEvent,
  type DragStartEvent,
} from "@dnd-kit/core";
import { SortableContext, arrayMove, sortableKeyboardCoordinates, useSortable, verticalListSortingStrategy } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { ArrowDownToLine, CalendarDays, Check, GripVertical, Pencil, Plus, Trash2, X } from "lucide-react";
import { toast } from "sonner";

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
  deshaz,
  duplica,
  edita,
  hoyEnMadrid,
  mueve,
  nuevoId,
  pendientesAnteriores,
  quita,
  rotuloCorto,
  rotuloDia,
  semanaDelMicro,
  type DiaVista,
  type Rastro,
  type TareaDelDia,
} from "@/lib/portada/mis-tareas";
import { confirmar } from "@/lib/avisos";

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

/** Lo que lleva cada pieza que se arrastra o recibe. */
type DatosTarea = { tipo: "tarea"; fecha: string; seccion: "dia" | "antes" };
type DatosDia = { tipo: "dia"; fecha: string };

const ID_DIA = (fecha: string) => `dia:${fecha}`;

/** Cuántos pasos se pueden deshacer con Ctrl+Z. */
const PASOS = 20;

/**
 * Con puntero: lo que hay justo debajo, y antes una tarea que el día que la
 * contiene. Con teclado (sin puntero): la esquina más cercana.
 */
const colision: CollisionDetection = (args) => {
  const debajo = pointerWithin(args);

  if (debajo.length) {
    const tareas = debajo.filter((c) => !String(c.id).startsWith("dia:"));

    return tareas.length ? tareas : debajo;
  }

  return closestCorners(args);
};

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

  /* La tarea con «Mover a / Duplicar en» abierto. */
  const [menu, setMenu] = useState<string | null>(null);

  /* Lo que se arrastra ahora y el día (y la tarea) que tiene debajo. */
  const [arrastrada, setArrastrada] = useState<TareaDelDia | null>(null);
  const [sobre, setSobre] = useState<{ fecha: string; clave: string | null } | null>(null);

  /* Lo que se puede deshacer, lo último al final. */
  const [pila, setPila] = useState<{ id: string; rastro: Rastro }[]>([]);

  const sensores = useSensors(
    useSensor(MouseSensor, { activationConstraint: { distance: 5 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 250, tolerance: 8 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  const semana = useMemo(
    () => (hoy && partidos.length ? semanaDelMicro({ partidos, hoy, hechas, doc, sesiones }) : null),
    [partidos, hoy, hechas, doc, sesiones],
  );

  const vencidas = useMemo(
    () => (hoy && partidos.length ? pendientesAnteriores({ partidos, hoy, hechas, doc, sesiones }) : []),
    [partidos, hoy, hechas, doc, sesiones],
  );

  const deshazPaso = useCallback(
    (id: string, rastro: Rastro) => {
      cambiaDoc((d) => deshaz(d, rastro));
      setPila((p) => p.filter((x) => x.id !== id));
      toast.dismiss(id);
      toast("Deshecho", { duration: 2500 });
    },
    [cambiaDoc],
  );

  /* Ctrl+Z (o ⌘Z) deshace lo último movido, salvo escribiendo en un campo. */
  useEffect(() => {
    const tecla = (e: KeyboardEvent) => {
      if (!(e.ctrlKey || e.metaKey) || e.shiftKey || e.altKey || e.key.toLowerCase() !== "z") return;

      const el = e.target as HTMLElement | null;

      if (el && (el.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(el.tagName))) return;

      const ultimo = pila[pila.length - 1];

      if (!ultimo) return;

      e.preventDefault();
      deshazPaso(ultimo.id, ultimo.rastro);
    };

    window.addEventListener("keydown", tecla);

    return () => window.removeEventListener("keydown", tecla);
  }, [pila, deshazPaso]);

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

  const porClave = new Map([...deAntes, ...todas].map((t) => [t.clave, t]));
  const diaDe = (fecha: string) => dias.find((d) => d.fecha === fecha);
  const clavesDe = (fecha: string) => diaDe(fecha)?.tareas.map((t) => t.clave) ?? [];

  /* «el Miércoles 04/11 (MD-3)»: para avisos y lectores de pantalla. */
  const nombreDia = (fecha: string) => {
    const d = diaDe(fecha);

    return d ? `${rotuloDia(fecha)} (${d.md})` : rotuloDia(fecha);
  };

  const marca = (t: TareaDelDia, hecha: boolean) => {
    if (t.tipo === "auto") cambiaHechas((h) => alternaHechaAuto(h, t.clave, hecha));
    else cambiaDoc((d) => alternaHechaPropia(d, t.id, hecha));
  };

  const borra = async (t: TareaDelDia) => {
    if (!(await confirmar(`¿Quitar «${t.texto}»?`))) return;

    cambiaDoc((d) => quita(d, t));
  };

  /** Apunta el paso para deshacerlo y lo cuenta en un aviso con «Deshacer». */
  const apunta = (rastro: Rastro, mensaje: string) => {
    const id = nuevoId();

    setPila((p) => [...p, { id, rastro }].slice(-PASOS));

    toast(mensaje, { id, duration: 6000, action: { label: "Deshacer", onClick: () => deshazPaso(id, rastro) } });
  };

  /**
   * Mover `t` a `fecha` en el puesto `indice` (sobre la lista `destino` del
   * día de llegada). Lo mismo para arrastrar, «Mover a» y «Pasar a hoy».
   */
  const llevaA = (t: TareaDelDia, fecha: string, destino: string[], indice: number) => {
    const id = nuevoId();

    const origen = t.fecha !== fecha && diaDe(t.fecha) ? clavesDe(t.fecha) : undefined;

    const { rastro } = mueve(doc, t, fecha, destino, indice, id, origen);

    cambiaDoc((d) => mueve(d, t, fecha, destino, indice, id, origen).doc);

    apunta(rastro, t.fecha === fecha ? `Orden del ${nombreDia(fecha)} cambiado` : `«${t.texto}» → ${nombreDia(fecha)}`);
  };

  /** Al final del día: lo de «Mover a» y «Pasar a hoy». */
  const llevaAlFinal = (t: TareaDelDia, fecha: string) => {
    if (t.fecha === fecha) return;

    const destino = clavesDe(fecha);

    llevaA(t, fecha, destino, destino.length);
  };

  const duplicaEn = (t: TareaDelDia, fecha: string) => {
    const id = nuevoId();

    const { rastro } = duplica(doc, t, fecha, id);

    cambiaDoc((d) => duplica(d, t, fecha, id).doc);

    apunta(rastro, `«${t.texto}» duplicada en ${nombreDia(fecha)}`);
  };

  const pasaAHoy = (t: TareaDelDia) => {
    if (diaDe(hoy)) {
      llevaAlFinal(t, hoy);

      return;
    }

    /* Hoy fuera de la semana (raro): como siempre, sin orden a mano. */
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

  const abreEdicion = (t: TareaDelDia) => {
    setMenu(null);
    setForm({ clave: t.clave, fecha: t.fecha, texto: t.texto, prioridad: t.prioridad });
  };

  const abreNueva = (fecha: string) => setForm({ clave: null, fecha, texto: "", prioridad: "media" });

  /* ---------------------------- arrastre ---------------------------- */

  const datosDe = (d: unknown) => d as DatosTarea | DatosDia | undefined;

  /** Dónde caería: el día y, si hay una tarea debajo, ésa. */
  const destinoDe = (over: DragOverEvent["over"]) => {
    const od = datosDe(over?.data.current);

    if (!over || !od) return null;

    if (od.tipo === "dia") return { fecha: od.fecha, clave: null };

    if (od.seccion === "antes") return null;

    return { fecha: od.fecha, clave: String(over.id) };
  };

  const alEmpezar = (e: DragStartEvent) => {
    setMenu(null);
    setArrastrada(porClave.get(String(e.active.id)) ?? null);
  };

  const alPasar = (e: DragOverEvent) => {
    const nuevo = destinoDe(e.over);

    setSobre((viejo) => (viejo?.fecha === nuevo?.fecha && viejo?.clave === nuevo?.clave ? viejo : nuevo));
  };

  const alSoltar = (e: DragEndEvent) => {
    setArrastrada(null);
    setSobre(null);

    const t = porClave.get(String(e.active.id));
    const destino = destinoDe(e.over);

    if (!t || !destino) return;

    const lista = clavesDe(destino.fecha);

    if (destino.fecha === t.fecha) {
      /* Reordenar dentro del día. */
      const desde = lista.indexOf(t.clave);
      const hasta = destino.clave ? lista.indexOf(destino.clave) : lista.length - 1;

      if (desde < 0 || hasta < 0 || desde === hasta) return;

      const nueva = arrayMove(lista, desde, hasta);

      llevaA(t, destino.fecha, nueva, nueva.indexOf(t.clave));

      return;
    }

    /* A otro día: delante de la tarea que tenía debajo, o al final. */
    const indice = destino.clave ? lista.indexOf(destino.clave) : lista.length;

    llevaA(t, destino.fecha, lista, indice < 0 ? lista.length : indice);
  };

  const alCancelar = () => {
    setArrastrada(null);
    setSobre(null);
  };

  const describe = (over: DragOverEvent["over"]) => {
    const d = destinoDe(over);

    if (!d) return "fuera de los días";

    const junto = d.clave ? porClave.get(d.clave) : null;

    return junto ? `${nombreDia(d.fecha)}, junto a «${junto.texto}»` : nombreDia(d.fecha);
  };

  const textoDe = (id: string | number) => porClave.get(String(id))?.texto ?? "la tarea";

  const anuncios: Announcements = {
    onDragStart: ({ active }) => `Has cogido «${textoDe(active.id)}». Con las flechas la llevas a otro día o a otro puesto; Espacio la suelta y Escape cancela.`,
    onDragOver: ({ active, over }) => `«${textoDe(active.id)}» está sobre ${describe(over)}.`,
    onDragEnd: ({ active, over }) => (over ? `«${textoDe(active.id)}» soltada en ${describe(over)}.` : `«${textoDe(active.id)}» se queda donde estaba.`),
    onDragCancel: ({ active }) => `Cancelado. «${textoDe(active.id)}» se queda donde estaba.`,
  };

  /* ------------------------------ filas ------------------------------ */

  const editor = (
    <FormularioTarea
      form={form}
      dias={dias.map((d) => ({ fecha: d.fecha, rotulo: `${rotuloDia(d.fecha)} · ${d.md}` }))}
      onCambia={setForm}
      onGuarda={guarda}
      onCancela={() => setForm(null)}
    />
  );

  const fila = (t: TareaDelDia, pasado: boolean, seccion: "dia" | "antes", conPasarAHoy = false) => {
    if (form?.clave === t.clave) return <li key={t.clave}>{editor}</li>;

    const abierto = menu === t.clave;

    /* La raya dorada: la tarea caería delante de ésta, viniendo de otro día. */
    const raya = Boolean(arrastrada && sobre?.clave === t.clave && arrastrada.fecha !== t.fecha);

    return (
      <FilaArrastrable key={t.clave} t={t} seccion={seccion} raya={raya}>
        {(asa) => (
          <>
            <div className="flex min-w-0 items-start gap-1.5">
              {asa}

              <button
                type="button"
                onClick={() => marca(t, !t.hecha)}
                aria-pressed={t.hecha}
                aria-label={t.hecha ? `Desmarcar ${t.texto}` : `Marcar ${t.texto} como hecha`}
                className={`mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-md border sm:h-5 sm:w-5 ${t.hecha ? "border-emerald-400 bg-emerald-500/80" : pasado ? "border-red-400/70" : "border-white/30"}`}
              >
                {t.hecha && <Check className="h-3.5 w-3.5 text-white" />}
              </button>

              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-1.5">
                  {t.href ? (
                    <Link href={t.href} draggable={false} className={`text-sm font-medium hover:underline ${t.hecha ? "text-white/45 line-through" : pasado ? "text-red-300" : "text-white/90"}`}>
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
                <button
                  type="button"
                  onClick={() => setMenu(abierto ? null : t.clave)}
                  aria-expanded={abierto}
                  aria-label={`Mover o duplicar ${t.texto}`}
                  title="Mover a otro día"
                  className={`rounded-md p-1 hover:bg-white/10 hover:text-white ${abierto ? "bg-white/10 text-white" : "text-white/55"}`}
                >
                  <CalendarDays className="h-3.5 w-3.5" />
                </button>
                <button type="button" onClick={() => abreEdicion(t)} aria-label={`Editar ${t.texto}`} title="Editar" className="rounded-md p-1 text-white/55 hover:bg-white/10 hover:text-white">
                  <Pencil className="h-3.5 w-3.5" />
                </button>
                <button type="button" onClick={() => borra(t)} aria-label={`Quitar ${t.texto}`} title="Quitar" className="rounded-md p-1 text-white/55 hover:bg-white/10 hover:text-red-300">
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              </div>
            </div>

            {abierto && (
              <MenuMover
                t={t}
                dias={dias}
                hoy={hoy}
                onMueve={(fecha) => {
                  setMenu(null);
                  llevaAlFinal(t, fecha);
                }}
                onDuplica={(fecha) => {
                  setMenu(null);
                  duplicaEn(t, fecha);
                }}
                onCierra={() => setMenu(null)}
              />
            )}
          </>
        )}
      </FilaArrastrable>
    );
  };

  const clavesSinEditor = (ts: TareaDelDia[]) => ts.filter((t) => form?.clave !== t.clave).map((t) => t.clave);

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

      <DndContext
        sensors={sensores}
        collisionDetection={colision}
        onDragStart={alEmpezar}
        onDragOver={alPasar}
        onDragEnd={alSoltar}
        onDragCancel={alCancelar}
        accessibility={{
          announcements: anuncios,
          screenReaderInstructions: {
            draggable: "Para mover una tarea, pulsa Espacio o Intro sobre su asa. Con las flechas la llevas a otro día o a otro puesto del mismo día; Espacio la suelta y Escape cancela.",
          },
        }}
      >
        {deAntes.length > 0 && (
          <section className="rounded-2xl border border-red-400/40 bg-red-500/[0.06] p-4">
            <h3 className="mb-2 font-semibold text-red-200">Sin hacer de días anteriores · {deAntes.length}</h3>
            <SortableContext items={clavesSinEditor(deAntes)} strategy={verticalListSortingStrategy}>
              <ul className="space-y-1.5">{deAntes.map((t) => fila(t, true, "antes", true))}</ul>
            </SortableContext>
          </section>
        )}

        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
          {dias.map((d) => {
            const esHoy = d.fecha === hoy;
            const pasado = Boolean(hoy) && d.fecha < hoy;
            const destino = Boolean(arrastrada) && sobre?.fecha === d.fecha;

            return (
              <DiaSoltable key={d.fecha} fecha={d.fecha} esHoy={esHoy} destino={destino}>
                <div className="mb-2 flex items-center justify-between gap-2">
                  <h3 className="font-semibold text-white">{rotuloDia(d.fecha)}</h3>
                  <div className="flex items-center gap-1.5">
                    <span className={`rounded-full border px-2 py-px text-[10px] font-semibold uppercase tracking-wide ${COLOR_TIPO[d.tipo]}`}>{NOMBRE_TIPO[d.tipo]}</span>
                    <span className="text-xs font-semibold text-white/55">{esHoy ? `HOY · ${d.md}` : d.md}</span>
                  </div>
                </div>

                <SortableContext items={clavesSinEditor(d.tareas)} strategy={verticalListSortingStrategy}>
                  <ul className="space-y-1.5">{d.tareas.map((t) => fila(t, pasado, "dia", pasado && !t.hecha))}</ul>
                </SortableContext>

                {d.tareas.length === 0 && <p className="text-sm text-white/45">{destino ? "Suelta aquí." : "Día despejado."}</p>}

                <button type="button" onClick={() => abreNueva(d.fecha)} className="mt-2 inline-flex items-center gap-1 text-xs font-semibold text-white/50 hover:text-white">
                  <Plus className="h-3.5 w-3.5" /> Añadir a este día
                </button>
              </DiaSoltable>
            );
          })}
        </div>

        <DragOverlay dropAnimation={null}>
          {arrastrada && (
            <div className="flex max-w-xs cursor-grabbing items-center gap-2 rounded-xl border border-[#D8B45A]/60 bg-[#11161C] px-3 py-2 shadow-xl">
              <GripVertical className="h-4 w-4 shrink-0 text-white/40" />
              <span className={`min-w-0 truncate text-sm font-medium ${arrastrada.hecha ? "text-white/45 line-through" : "text-white/90"}`}>{arrastrada.texto}</span>
            </div>
          )}
        </DragOverlay>
      </DndContext>

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

/** Cada día recibe tareas; se ilumina cuando una va a caer en él. */
function DiaSoltable({ fecha, esHoy, destino, children }: { fecha: string; esHoy: boolean; destino: boolean; children: ReactNode }) {
  const datos: DatosDia = { tipo: "dia", fecha };

  const { setNodeRef } = useDroppable({ id: ID_DIA(fecha), data: datos });

  const fondo = esHoy ? "border-[#D8B45A]/60 bg-[#D8B45A]/10" : "border-white/10 bg-white/[0.03]";

  return (
    <section ref={setNodeRef} className={`min-w-0 rounded-2xl border p-4 transition-shadow ${fondo} ${destino ? "ring-2 ring-[#D8B45A]/70" : ""}`}>
      {children}
    </section>
  );
}

/**
 * Una tarea que se arrastra. Ratón y dedo la cogen por cualquier sitio de la
 * fila (el dedo, con pulsación larga); el teclado, sólo por el asa, para que
 * Intro y Espacio en los otros botones sigan siendo suyos.
 */
function FilaArrastrable({
  t,
  seccion,
  raya,
  children,
}: {
  t: TareaDelDia;
  seccion: "dia" | "antes";
  raya: boolean;
  children: (asa: ReactNode) => ReactNode;
}) {
  const datos: DatosTarea = { tipo: "tarea", fecha: t.fecha, seccion };

  const { attributes, listeners, setNodeRef, setActivatorNodeRef, transform, transition, isDragging } = useSortable({ id: t.clave, data: datos });

  const asa = (
    <button
      type="button"
      ref={setActivatorNodeRef}
      {...attributes}
      aria-roledescription="tarea que se puede mover"
      aria-label={`Mover ${t.texto}`}
      title="Arrastra para llevarla a otro día"
      className="mt-0.5 -ml-1 flex h-6 w-4 shrink-0 cursor-grab items-center justify-center rounded text-white/30 hover:text-white/70 active:cursor-grabbing sm:h-5"
    >
      <GripVertical className="h-3.5 w-3.5" />
    </button>
  );

  return (
    <li
      ref={setNodeRef}
      {...listeners}
      style={{ transform: CSS.Translate.toString(transform), transition }}
      className={`group relative min-w-0 rounded-md [-webkit-touch-callout:none] [@media(pointer:coarse)]:select-none ${isDragging ? "opacity-40" : ""}`}
    >
      {raya && <span aria-hidden className="pointer-events-none absolute inset-x-0 -top-1 h-0.5 rounded-full bg-[#D8B45A]" />}
      {children(asa)}
    </li>
  );
}

/** «Mover a» o «Duplicar en», con los días de la semana: la vía sin arrastrar. */
function MenuMover({
  t,
  dias,
  hoy,
  onMueve,
  onDuplica,
  onCierra,
}: {
  t: TareaDelDia;
  dias: DiaVista[];
  hoy: string;
  onMueve: (fecha: string) => void;
  onDuplica: (fecha: string) => void;
  onCierra: () => void;
}) {
  const [modo, setModo] = useState<"mover" | "duplicar">("mover");

  const pestana = (m: "mover" | "duplicar", texto: string) => (
    <button
      type="button"
      onClick={() => setModo(m)}
      aria-pressed={modo === m}
      className={`rounded-full px-2.5 py-1 text-xs font-semibold sm:py-0.5 ${modo === m ? "bg-[#D8B45A] text-[#0B0F14]" : "text-white/60 hover:text-white"}`}
    >
      {texto}
    </button>
  );

  return (
    <div
      role="group"
      aria-label={`Mover o duplicar ${t.texto}`}
      className="mt-1.5 ml-5 rounded-lg border border-white/10 bg-white/[0.03] p-2"
      onKeyDown={(e) => {
        if (e.key === "Escape") onCierra();
      }}
      /* Que coger un día no empiece a arrastrar la fila. */
      onMouseDown={(e) => e.stopPropagation()}
      onTouchStart={(e) => e.stopPropagation()}
    >
      <div className="mb-1.5 flex flex-wrap items-center gap-1">
        {pestana("mover", "Mover a")}
        {pestana("duplicar", "Duplicar en")}
        <button type="button" onClick={onCierra} aria-label="Cerrar" className="ml-auto rounded-md p-1 text-white/50 hover:bg-white/10 hover:text-white">
          <X className="h-3.5 w-3.5" />
        </button>
      </div>
      <div className="flex flex-wrap gap-1">
        {dias.map((d) => {
          const suyo = modo === "mover" && d.fecha === t.fecha;

          return (
            <button
              key={d.fecha}
              type="button"
              disabled={suyo}
              onClick={() => (modo === "mover" ? onMueve(d.fecha) : onDuplica(d.fecha))}
              className={`rounded-full border px-2.5 py-1 text-xs sm:py-0.5 ${suyo ? "border-white/10 text-white/35" : "border-white/15 text-white/75 hover:bg-white/10 hover:text-white"} ${d.fecha === hoy ? "font-semibold" : ""}`}
            >
              {rotuloCorto(d.fecha)} · {d.fecha === hoy ? `HOY · ${d.md}` : d.md}
            </button>
          );
        })}
      </div>
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
