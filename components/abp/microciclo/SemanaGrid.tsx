"use client";

/**
 * La semana de lunes a domingo.
 *
 * Siete columnas, una por día, con lo que se trabaja de balón parado en cada
 * una. La rejilla no se apila en móvil: se desplaza en horizontal. Un
 * microciclo se lee comparando los días entre sí —dónde está la carga, qué día
 * queda vacío— y en una lista vertical de siete bloques eso se pierde.
 *
 * Los bloques se mueven arrastrando: de un día a otro y dentro del mismo día.
 * Replanificar una semana es sobre todo mover cosas de sitio —«esto lo paso al
 * MD-2»— y hacerlo abriendo el diálogo y cambiando el conmutador de día
 * costaba cuatro toques por bloque. Cada ficha lleva además duplicar y quitar,
 * que son los otros dos gestos de replanificar.
 *
 * El arrastre usa el mismo montaje que la pizarra de sesión: `PointerSensor`
 * con distancia mínima —para que un toque siga abriendo la ficha— y
 * `TouchSensor` con retardo, que es lo que separa arrastrar de desplazar la
 * rejilla en tablet.
 */

import { useState } from "react";
import {
  DndContext,
  DragOverlay,
  PointerSensor,
  TouchSensor,
  closestCenter,
  useDraggable,
  useDroppable,
  useSensor,
  useSensors,
  type DragEndEvent,
  type DragStartEvent,
} from "@dnd-kit/core";
import { Copy, Monitor, Plus, Trash2 } from "lucide-react";

import { chipInk } from "@/lib/theme";

import {
  DIAS,
  LADO_COLOR,
  MOMENTO_SHORT,
  ROL_SHORT,
  TIPOS_DIA,
  cargaCognitiva,
  cargaCondicional,
  etiquetaTrabajo,
  fmtMin,
  type DiaKey,
  type PlanDia,
  type TipoDia,
  type Trabajo,
} from "@/lib/abp/microciclo";

/* ------------------------------------------------------------------ */
/*  IDENTIDADES DEL ARRASTRE                                           */
/* ------------------------------------------------------------------ */

/*
| Tres registros distintos con ids propios: el bloque que se arrastra, la
| columna entera —soltar ahí lo pone al final— y el hueco de delante de cada
| bloque, que es lo que permite ordenar dentro de un día. Los prefijos evitan
| que dos días con el mismo trabajo (una copia) compartan id.
*/
const idBloque = (dia: DiaKey, trabajo: string) => `bloque:${dia}:${trabajo}`;
const idColumna = (dia: DiaKey) => `columna:${dia}`;
const idHueco = (dia: DiaKey, trabajo: string) => `hueco:${dia}:${trabajo}`;

type DatosArrastre = { dia: DiaKey; id: string };
type DatosDestino = { dia: DiaKey; antesDe: string | null };

/* ------------------------------------------------------------------ */
/*  FICHA DE UN TRABAJO                                                */
/* ------------------------------------------------------------------ */

/** El contenido de la ficha, sin nada de arrastre: lo comparte el fantasma. */
function TrabajoCuerpo({ trabajo }: { trabajo: Trabajo }) {
  const color = LADO_COLOR[trabajo.lado];

  return (
    <>
      <div className="flex items-start justify-between gap-1.5">
        <p className="min-w-0 flex-1 truncate text-[11.5px] font-medium leading-tight text-white">
          {etiquetaTrabajo(trabajo, true)}
        </p>

        <span className="shrink-0 text-[11px] font-semibold tabular-nums text-white/70">
          {trabajo.minutos}′
        </span>
      </div>

      <div className="mt-1.5 flex flex-wrap items-center gap-1">
        <span
          className="rounded px-1.5 py-0.5 text-[9px] font-semibold tracking-wide"
          style={{ backgroundColor: `${color}22`, color: chipInk(color) }}
        >
          {MOMENTO_SHORT[trabajo.momento]}
        </span>

        {trabajo.medio === "video" && (
          <span
            className="inline-flex items-center gap-0.5 rounded bg-sky-400/15 px-1.5 py-0.5 text-[9px] font-semibold text-sky-300"
            title="Trabajo en vídeo"
          >
            <Monitor size={9} />
            VÍDEO
          </span>
        )}

        {trabajo.roles.map((rol) => (
          <span
            key={rol}
            className="rounded bg-white/[0.07] px-1.5 py-0.5 text-[9px] font-semibold text-white/50"
          >
            {ROL_SHORT[rol]}
          </span>
        ))}

        {trabajo.origen === "registro" && (
          <span
            className="rounded bg-emerald-400/12 px-1.5 py-0.5 text-[9px] font-semibold text-emerald-300/80"
            title="Importado de la hoja de registro de tareas"
          >
            HOJA
          </span>
        )}
      </div>

      {trabajo.notas && (
        <p className="mt-1 truncate text-[10px] text-white/35">
          {trabajo.notas}
        </p>
      )}
    </>
  );
}

function TrabajoCard({
  dia,
  trabajo,
  onClick,
  onDuplicar,
  onBorrar,
}: {
  dia: DiaKey;
  trabajo: Trabajo;
  onClick: () => void;
  onDuplicar: () => void;
  onBorrar: () => void;
}) {
  const color = LADO_COLOR[trabajo.lado];

  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({
    id: idBloque(dia, trabajo.id),
    data: { dia, id: trabajo.id } satisfies DatosArrastre,
  });

  /* El hueco de DELANTE de esta ficha: soltar aquí la coloca antes. */
  const { setNodeRef: huecoRef, isOver } = useDroppable({
    id: idHueco(dia, trabajo.id),
    data: { dia, antesDe: trabajo.id } satisfies DatosDestino,
  });

  return (
    <div ref={huecoRef} className="relative min-w-0">
      {/* La barra que marca dónde va a caer lo que se arrastra. */}
      {isOver && (
        <span className="pointer-events-none absolute -top-1 left-0 right-0 h-0.5 rounded-full bg-[#C8A96B]" />
      )}

      <div
        ref={setNodeRef}
        {...attributes}
        {...listeners}
        className={`group relative w-full min-w-0 rounded-xl border border-white/10 bg-white/[0.03] p-2 text-left transition hover:border-white/25 hover:bg-white/[0.06] ${
          isDragging ? "opacity-30" : ""
        }`}
        style={{ borderLeft: `3px solid ${color}`, touchAction: "none" }}
      >
        {/*
        | La ficha entera es el asa de arrastre —en una columna de 130 px no
        | cabe un asa aparte— y por eso abrir es un botón interior que ocupa
        | todo. Con la distancia mínima del sensor, un toque abre y un
        | desplazamiento arrastra.
        */}
        <button
          type="button"
          onClick={onClick}
          className="block w-full min-w-0 text-left"
          title={`${etiquetaTrabajo(trabajo)} · ${trabajo.minutos}′`}
        >
          <TrabajoCuerpo trabajo={trabajo} />
        </button>

{/*
        | Duplicar y quitar. Van en su propia fila y no encima de la ficha:
        | flotando abajo a la derecha tapaban el final de la nota, que es donde
        | está escrito lo que se hace en la tarea. Y van siempre visibles en vez
        | de salir al pasar el ratón, porque esto se usa en tablet.
        |
        | `stopPropagation` en el `pointerdown` para que empezar a pulsarlos no
        | se lea como el principio de un arrastre.
        */}
        <div className="mt-1 flex justify-end gap-0.5">
          <button
            type="button"
            onPointerDown={(event) => event.stopPropagation()}
            onClick={onDuplicar}
            title="Duplicar este bloque"
            aria-label="Duplicar este bloque"
            className="rounded-md p-1 text-white/25 transition hover:bg-white/10 hover:text-white"
          >
            <Copy size={11} />
          </button>

          <button
            type="button"
            onPointerDown={(event) => event.stopPropagation()}
            onClick={onBorrar}
            title="Quitar este bloque"
            aria-label="Quitar este bloque"
            className="rounded-md p-1 text-white/25 transition hover:bg-rose-500/15 hover:text-rose-300"
          >
            <Trash2 size={11} />
          </button>
        </div>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  COLUMNA DE UN DÍA                                                  */
/* ------------------------------------------------------------------ */

function DiaColumna({
  dia,
  plan,
  onCambiaTipo,
  onCambiaMd,
  onAbrir,
  onAnadir,
  onDuplicar,
  onBorrar,
}: {
  dia: DiaKey;
  plan: PlanDia;
  onCambiaTipo: (tipo: TipoDia) => void;
  onCambiaMd: (md: string) => void;
  onAbrir: (trabajo: Trabajo) => void;
  onAnadir: () => void;
  onDuplicar: (trabajo: Trabajo) => void;
  onBorrar: (trabajo: Trabajo) => void;
}) {
  const info = DIAS.find((item) => item.key === dia);

  const minutos = plan.trabajos.reduce(
    (total, trabajo) => total + (trabajo.minutos || 0),
    0,
  );

  const carga = plan.trabajos.reduce(
    (total, trabajo) => total + cargaCondicional(trabajo),
    0,
  );

  const cargaCog = plan.trabajos.reduce(
    (total, trabajo) => total + cargaCognitiva(trabajo),
    0,
  );

  const descansa = plan.tipo === "descanso";

  /* Soltar en la columna, fuera de cualquier ficha: va al final del día. */
  const { setNodeRef, isOver } = useDroppable({
    id: idColumna(dia),
    data: { dia, antesDe: null } satisfies DatosDestino,
  });

  return (
    <div
      className={`flex min-w-0 flex-col rounded-2xl border transition ${
        isOver
          ? "border-[#C8A96B]/60 bg-[#C8A96B]/[0.05]"
          : descansa
            ? "border-white/[0.06] bg-white/[0.01]"
            : "border-white/10 bg-white/[0.025]"
      }`}
    >
      {/* ---------------------- CABECERA ---------------------- */}

      <div className="border-b border-white/10 px-2.5 py-2">
        <div className="flex items-baseline justify-between gap-1.5">
          <p className="text-xs font-semibold uppercase tracking-wider text-white">
            {info?.corto}
          </p>

          <input
            value={plan.md}
            onChange={(event) => onCambiaMd(event.target.value)}
            placeholder="MD"
            aria-label={`Día de partido de ${info?.label}`}
            className="w-14 rounded-md border border-white/10 bg-white/[0.04] px-1.5 py-0.5 text-right text-[10px] uppercase tracking-wide text-[#C8A96B] outline-none transition placeholder:text-white/20 focus:border-[#C8A96B]/50"
          />
        </div>

        <div className="mt-1.5 grid grid-cols-3 gap-1">
          {TIPOS_DIA.map((tipo) => {
            const activo = tipo.key === plan.tipo;

            return (
              <button
                key={tipo.key}
                type="button"
                onClick={() => onCambiaTipo(tipo.key)}
                aria-pressed={activo}
                title={tipo.label}
                className={`truncate rounded-md px-1 py-1 text-[9px] font-semibold uppercase tracking-wide transition ${
                  activo
                    ? "bg-[#C8A96B] text-black"
                    : "bg-white/[0.05] text-white/40 hover:text-white/70"
                }`}
              >
                {tipo.label.slice(0, 4)}
              </button>
            );
          })}
        </div>
      </div>

      {/* ---------------------- TRABAJOS ---------------------- */}

      <div ref={setNodeRef} className="flex min-h-[110px] flex-1 flex-col gap-1.5 p-2">
        {plan.trabajos.map((trabajo) => (
          <TrabajoCard
            key={trabajo.id}
            dia={dia}
            trabajo={trabajo}
            onClick={() => onAbrir(trabajo)}
            onDuplicar={() => onDuplicar(trabajo)}
            onBorrar={() => onBorrar(trabajo)}
          />
        ))}

        {!plan.trabajos.length && (
          <p className="px-1 py-3 text-center text-[10px] leading-relaxed text-white/35">
            {descansa ? "Descanso" : "Sin ABP"}
          </p>
        )}

        <button
          type="button"
          onClick={onAnadir}
          className="mt-auto inline-flex items-center justify-center gap-1 rounded-xl border border-dashed border-white/12 px-2 py-1.5 text-[10px] font-medium text-white/40 transition hover:border-[#C8A96B]/50 hover:text-[#C8A96B]"
        >
          <Plus size={11} />
          Añadir
        </button>
      </div>

      {/* ----------------------- TOTALES ---------------------- */}

      {minutos > 0 && (
        <div className="flex items-center justify-between gap-1 border-t border-white/10 px-2.5 py-1.5 text-[10px] tabular-nums">
          <span className="font-semibold text-white/75">{fmtMin(minutos)}</span>

          <span className="text-white/35" title="Carga condicional · cognitiva">
            {Math.round(carga)} · {Math.round(cargaCog)}
          </span>
        </div>
      )}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  SEMANA                                                             */
/* ------------------------------------------------------------------ */

export function SemanaGrid({
  dias,
  onCambiaTipo,
  onCambiaMd,
  onAbrir,
  onAnadir,
  onMover,
  onDuplicar,
  onBorrar,
}: {
  dias: Record<DiaKey, PlanDia>;
  onCambiaTipo: (dia: DiaKey, tipo: TipoDia) => void;
  onCambiaMd: (dia: DiaKey, md: string) => void;
  onAbrir: (dia: DiaKey, trabajo: Trabajo) => void;
  onAnadir: (dia: DiaKey) => void;
  /** `antesDe` es el id del bloque delante del cual cae; `null`, al final. */
  onMover: (
    origen: DiaKey,
    id: string,
    destino: DiaKey,
    antesDe: string | null,
  ) => void;
  onDuplicar: (dia: DiaKey, trabajo: Trabajo) => void;
  onBorrar: (dia: DiaKey, trabajo: Trabajo) => void;
}) {
  /* Lo que se está arrastrando, sólo para pintar el fantasma. */
  const [arrastrando, setArrastrando] = useState<Trabajo | null>(null);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(TouchSensor, {
      activationConstraint: { delay: 180, tolerance: 8 },
    }),
  );

  const empieza = (event: DragStartEvent) => {
    const datos = event.active.data.current as DatosArrastre | undefined;

    if (!datos) return;

    setArrastrando(
      dias[datos.dia]?.trabajos.find((item) => item.id === datos.id) ?? null,
    );
  };

  const termina = (event: DragEndEvent) => {
    setArrastrando(null);

    const origen = event.active.data.current as DatosArrastre | undefined;
    const destino = event.over?.data.current as DatosDestino | undefined;

    if (!origen || !destino) return;

    /* Soltarlo sobre sí mismo no es un movimiento. */
    if (destino.antesDe === origen.id) return;

    onMover(origen.dia, origen.id, destino.dia, destino.antesDe);
  };

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={closestCenter}
      onDragStart={empieza}
      onDragEnd={termina}
      onDragCancel={() => setArrastrando(null)}
    >
      <div className="overflow-x-auto pb-1">
        <div className="grid min-w-[980px] grid-cols-7 items-stretch gap-2">
          {DIAS.map((dia) => (
            <DiaColumna
              key={dia.key}
              dia={dia.key}
              plan={dias[dia.key]}
              onCambiaTipo={(tipo) => onCambiaTipo(dia.key, tipo)}
              onCambiaMd={(md) => onCambiaMd(dia.key, md)}
              onAbrir={(trabajo) => onAbrir(dia.key, trabajo)}
              onAnadir={() => onAnadir(dia.key)}
              onDuplicar={(trabajo) => onDuplicar(dia.key, trabajo)}
              onBorrar={(trabajo) => onBorrar(dia.key, trabajo)}
            />
          ))}
        </div>
      </div>

      <DragOverlay dropAnimation={null}>
        {arrastrando && (
          <div
            className="w-[140px] rounded-xl border border-white/25 bg-[#141A21] p-2 shadow-2xl"
            style={{ borderLeft: `3px solid ${LADO_COLOR[arrastrando.lado]}` }}
          >
            <TrabajoCuerpo trabajo={arrastrando} />
          </div>
        )}
      </DragOverlay>
    </DndContext>
  );
}
