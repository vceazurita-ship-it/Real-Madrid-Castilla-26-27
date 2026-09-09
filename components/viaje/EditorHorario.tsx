"use client";

/**
 * El editor del horario del viaje: los días y lo que pasa en cada uno.
 *
 * La idea de la que cuelga todo: **el horario se calcula desde la hora del
 * partido**. La salida del autobús, la comida, la llegada al estadio y el
 * calentamiento son siempre el mismo desfase respecto al saque inicial, y en
 * el documento de Word que esto sustituye había que recalcular las once horas
 * a mano cada semana —y cuando la federación movía el partido media hora,
 * otra vez—.
 *
 * **Y un desplazamiento casi nunca cabe en un día.** Lo normal fuera de casa
 * es salir la víspera, dormir en el hotel y jugar al día siguiente; a veces se
 * va y se vuelve en la jornada, y a veces son tres. Así que el editor es una
 * lista de días y cada uno es una hoja del horario. De ahí las herramientas,
 * que son las que se echaban de menos al montar esto en un procesador de
 * textos:
 *
 * - **Plantillas de viaje**: un día, dos o tres, con el calendario entero
 *   montado desde la fecha y la hora del partido.
 * - **Plantillas de día** para rellenar uno suelto —la víspera, el regreso—
 *   sin tocar los demás.
 * - **Replicar un día**: la copia cae al día siguiente con las mismas horas,
 *   que es lo que se hace en una concentración larga.
 * - **Arrastrar**: una cita de un día a otro, y un día a otro sitio de la
 *   lista. Con teclas y botones para lo mismo, que en el autobús se edita
 *   desde el móvil.
 * - **Copiar y pegar** las citas de un día en otro.
 * - **Mover el día entero** cuando cambia la hora, y **encadenar las fechas**
 *   cuando cambia el calendario.
 * - **Deshacer**, porque todo lo anterior se hace de un clic.
 *
 * Las citas se guardan **en minutos desde la medianoche de su día** y pueden
 * pasar de 1440: volver de un desplazamiento largo es llegar a las 3:15 del
 * día siguiente y ese renglón pertenece a la hoja del día que se jugó, no a la
 * del día de después.
 *
 * El arrastre usa el montaje de `components/abp/microciclo/SemanaGrid`:
 * `PointerSensor` con distancia mínima —para que un toque siga escribiendo en
 * el campo— y `TouchSensor` con retardo, que es lo que separa arrastrar de
 * desplazar la página en tablet.
 */

import { useMemo, useRef, useState } from "react";
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
import {
  ArrowDown,
  ArrowUp,
  CalendarClock,
  CalendarPlus,
  CalendarRange,
  ChevronDown,
  ChevronRight,
  ClipboardPaste,
  Copy,
  CopyPlus,
  Eraser,
  GripVertical,
  Link2,
  Plus,
  Trash2,
  Undo2,
  Wand2,
} from "lucide-react";
import { toast } from "sonner";

import { Button, Notice, Panel } from "@/components/abp/ui";
import {
  PLANTILLAS_DIA,
  PLANTILLAS_HORARIO,
  PLANTILLAS_VIAJE,
  TIPO_CITA,
  aHora,
  aMinutos,
  citaDeHora,
  clonaCitas,
  comoDesfase,
  conCitas,
  desfaseCita,
  diaCorto,
  diaVacio,
  diasDePlantillaViaje,
  diasEntre,
  diaSiguienteCorto,
  duplicaDia,
  encadenaFechas,
  esDiaSiguiente,
  horarioDePlantilla,
  indiceDiaPartido,
  mueveEnLista,
  nuevoId,
  ordenaDias,
  rotuloDia,
  sumaDias,
  type CitaHorario,
  type DiaViaje,
  type Desplazamiento,
  type TipoCita,
} from "@/lib/viaje/modelo";

/* ------------------------------------------------------------------ */
/*  IDENTIDADES DEL ARRASTRE                                           */
/* ------------------------------------------------------------------ */

/*
| Cuatro registros con prefijo propio: la cita que se arrastra, el día que se
| arrastra, el cuerpo de cada día —soltar ahí mete la cita en ese día— y el
| hueco entre dos días, que es lo que permite reordenarlos. Los prefijos evitan
| que una cita duplicada y su original compartan identidad de arrastre.
*/
const idCita = (diaId: string, citaId: string) => `cita:${diaId}:${citaId}`;
const idDia = (diaId: string) => `dia:${diaId}`;
const idZona = (diaId: string) => `zona:${diaId}`;
const idHueco = (indice: number) => `hueco:${indice}`;

type ArrastreCita = { tipo: "cita"; diaId: string; citaId: string };
type ArrastreDia = { tipo: "dia"; diaId: string };
type Arrastre = ArrastreCita | ArrastreDia;

type DestinoZona = { tipo: "zona"; diaId: string };
type DestinoHueco = { tipo: "hueco"; indice: number };

/* ------------------------------------------------------------------ */
/*  UNA CITA                                                           */
/* ------------------------------------------------------------------ */

function FilaCita({
  cita,
  dia,
  viaje,
  dias,
  arrastrando,
  onCambia,
  onQuita,
  onDuplica,
  onMueveA,
}: {
  cita: CitaHorario;
  dia: DiaViaje;
  viaje: Desplazamiento;
  dias: DiaViaje[];
  arrastrando: boolean;
  onCambia: (parche: Partial<CitaHorario>) => void;
  onQuita: () => void;
  onDuplica: () => void;
  onMueveA: (diaId: string) => void;
}) {
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({
    id: idCita(dia.id, cita.id),
    data: { tipo: "cita", diaId: dia.id, citaId: cita.id } satisfies ArrastreCita,
  });

  const tono = TIPO_CITA[cita.tipo] ?? TIPO_CITA.otro;

  const desfase = desfaseCita(cita, dia, viaje);

  return (
    <div
      ref={setNodeRef}
      className={`grid min-w-0 items-center gap-2 rounded-xl border border-white/10 bg-white/[0.03] px-2 py-2 transition lg:grid-cols-[auto_92px_minmax(0,1.5fr)_minmax(0,1fr)_104px_auto] ${
        isDragging || arrastrando ? "opacity-30" : ""
      }`}
    >
      {/* El asa lleva el color del tipo: se agarra y se reconoce la fila. */}
      <button
        type="button"
        {...listeners}
        {...attributes}
        title="Arrastrar a otro día"
        className="flex h-8 w-6 shrink-0 cursor-grab touch-none items-center justify-center rounded-md text-white/25 transition hover:text-white/60 active:cursor-grabbing"
        style={{ borderLeft: `3px solid ${tono.color}` }}
      >
        <GripVertical size={13} />
      </button>

      <div className="min-w-0">
        <input
          value={aHora(cita.minuto)}
          onChange={(evento) => {
            const minutos = aMinutos(evento.target.value);

            if (minutos === null) return;

            /* Escribir "03:15" en una cita de madrugada tiene que dejarla en
               la madrugada, no mandarla al amanecer. */
            onCambia({
              minuto: esDiaSiguiente(cita.minuto) ? minutos + 1440 : minutos,
            });
          }}
          className="w-full rounded-lg border border-white/10 bg-white/[0.04] px-2 py-1.5 text-center text-sm font-semibold tabular-nums text-white outline-none transition focus:border-[#C8A96B]/50"
        />

        {desfase !== null && (
          <p className="mt-1 text-center text-[10px] tabular-nums text-white/35">
            {desfase === 0 ? "saque inicial" : comoDesfase(desfase)}
          </p>
        )}
      </div>

      <input
        value={cita.texto}
        onChange={(evento) => onCambia({ texto: evento.target.value })}
        placeholder="Salida bus"
        className="min-w-0 rounded-lg border border-white/10 bg-white/[0.04] px-2.5 py-1.5 text-sm text-white outline-none transition placeholder:text-white/25 focus:border-[#C8A96B]/50"
      />

      <input
        value={cita.nota ?? ""}
        onChange={(evento) => onCambia({ nota: evento.target.value })}
        placeholder="Detalle: Lavandería, ENTREGA…"
        className="min-w-0 rounded-lg border border-white/10 bg-white/[0.04] px-2.5 py-1.5 text-xs text-white/80 outline-none transition placeholder:text-white/25 focus:border-[#C8A96B]/50"
      />

      <select
        value={cita.tipo}
        onChange={(evento) =>
          onCambia({ tipo: evento.target.value as TipoCita })
        }
        className="rounded-lg border border-white/10 bg-white/[0.04] px-2 py-1.5 text-xs text-white outline-none transition focus:border-[#C8A96B]/50"
      >
        {Object.entries(TIPO_CITA).map(([key, valor]) => (
          <option key={key} value={key} className="bg-[#11161C]">
            {valor.label}
          </option>
        ))}
      </select>

      <div className="flex flex-wrap items-center gap-1">
        {/* Cambiar de día sin arrastrar: es como se edita desde el móvil. */}
        {dias.length > 1 && (
          <select
            value={dia.id}
            onChange={(evento) => onMueveA(evento.target.value)}
            title="Pasar la cita a otro día"
            className="rounded-lg border border-white/10 bg-white/[0.04] px-2 py-1.5 text-[11px] text-white/70 outline-none transition focus:border-[#C8A96B]/50"
          >
            {dias.map((item, indice) => (
              <option key={item.id} value={item.id} className="bg-[#11161C]">
                {`D${indice + 1} · ${diaCorto(item.fecha).toLowerCase() || item.fecha}`}
              </option>
            ))}
          </select>
        )}

        <Button
          icon={ArrowUp}
          onClick={() => onCambia({ minuto: Math.max(0, cita.minuto - 5) })}
          title="Cinco minutos antes"
        />

        <Button
          icon={ArrowDown}
          onClick={() => onCambia({ minuto: cita.minuto + 5 })}
          title="Cinco minutos después"
        />

        <Button icon={CopyPlus} onClick={onDuplica} title="Duplicar media hora después" />

        <Button tone="danger" icon={Trash2} onClick={onQuita} title="Quitar la cita" />
      </div>

      {esDiaSiguiente(cita.minuto) && (
        <p className="col-span-full text-[10px] uppercase tracking-wide text-[#C8A96B]/70">
          Ya es {diaSiguienteCorto(dia.fecha).toLowerCase()}
        </p>
      )}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  EL HUECO ENTRE DOS DÍAS                                            */
/* ------------------------------------------------------------------ */

/** Sólo existe mientras se arrastra un día: es donde va a caer. */
function HuecoDia({ indice, activo }: { indice: number; activo: boolean }) {
  const { setNodeRef, isOver } = useDroppable({
    id: idHueco(indice),
    data: { tipo: "hueco", indice } satisfies DestinoHueco,
    disabled: !activo,
  });

  if (!activo) return null;

  return (
    <div ref={setNodeRef} className="py-1">
      <div
        className={`h-1 rounded-full transition ${
          isOver ? "bg-[#C8A96B]" : "bg-white/10"
        }`}
      />
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  UN DÍA                                                             */
/* ------------------------------------------------------------------ */

function TarjetaDia({
  dia,
  indice,
  total,
  viaje,
  dias,
  plegado,
  copiado,
  arrastre,
  onPliega,
  onCambiaDia,
  onCambiaCitas,
  onSube,
  onBaja,
  onDuplica,
  onElimina,
  onCopia,
  onPega,
  onMueveCita,
}: {
  dia: DiaViaje;
  indice: number;
  total: number;
  viaje: Desplazamiento;
  dias: DiaViaje[];
  plegado: boolean;
  copiado: { rotulo: string; citas: CitaHorario[] } | null;
  arrastre: Arrastre | null;
  onPliega: () => void;
  onCambiaDia: (parche: Partial<DiaViaje>) => void;
  onCambiaCitas: (citas: CitaHorario[]) => void;
  onSube: () => void;
  onBaja: () => void;
  onDuplica: () => void;
  onElimina: () => void;
  onCopia: () => void;
  onPega: () => void;
  onMueveCita: (citaId: string, destinoId: string) => void;
}) {
  /* Se desestructura en la llamada: el linter de React no deja leer `.current`
     ni ningún campo de lo que devuelve un hook de arrastre durante el render. */
  const {
    attributes: atributosDia,
    listeners: asaDia,
    setNodeRef: refAsaDia,
  } = useDraggable({
    id: idDia(dia.id),
    data: { tipo: "dia", diaId: dia.id } satisfies ArrastreDia,
  });

  const { setNodeRef: refZona, isOver: sobreZona } = useDroppable({
    id: idZona(dia.id),
    data: { tipo: "zona", diaId: dia.id } satisfies DestinoZona,
    disabled: arrastre?.tipo !== "cita",
  });

  const minutoPartido = aMinutos(viaje.hora);

  const esDelPartido = dia.fecha === viaje.fecha;

  const citas = dia.citas;

  const cambia = (id: string, parche: Partial<CitaHorario>) =>
    onCambiaCitas(
      citas.map((cita) => (cita.id === id ? { ...cita, ...parche } : cita)),
    );

  /** Mueve el día entero. Se usa cuando cambia la hora del partido. */
  const desplaza = (minutos: number) =>
    onCambiaCitas(
      citas.map((cita) => ({
        ...cita,
        minuto: Math.max(0, cita.minuto + minutos),
      })),
    );

  const aplicaPlantilla = (key: string) => {
    /* Las relativas se anclan al saque inicial; las de día, al reloj. */
    const relativa = PLANTILLAS_HORARIO.find((item) => item.key === key);

    if (relativa && minutoPartido !== null) {
      onCambiaCitas(horarioDePlantilla(relativa, minutoPartido).citas);

      return;
    }

    const suelta = PLANTILLAS_DIA.find((item) => item.key === key);

    if (suelta) onCambiaCitas(suelta.horas.map(citaDeHora));
  };

  const anade = () =>
    onCambiaCitas([
      ...citas,
      {
        id: nuevoId("CI"),
        minuto: esDelPartido ? (minutoPartido ?? 20 * 60) : 12 * 60,
        texto: "Nueva cita",
        tipo: "otro",
      },
    ]);

  const fantasma = arrastre?.tipo === "dia" && arrastre.diaId === dia.id;

  return (
    <section
      ref={refZona}
      className={`min-w-0 overflow-hidden rounded-2xl border transition ${
        fantasma
          ? "border-white/10 opacity-30"
          : sobreZona
            ? "border-[#C8A96B]/60 bg-[#C8A96B]/[0.05]"
            : esDelPartido
              ? "border-[#C8A96B]/25 bg-white/[0.03]"
              : "border-white/10 bg-white/[0.02]"
      }`}
    >
      {/* ------------------------ IDENTIDAD ------------------------ */}

      <header className="border-b border-white/8 px-3 py-2.5">
        <div className="flex min-w-0 flex-wrap items-center gap-2">
          <button
            type="button"
            ref={refAsaDia}
            {...asaDia}
            {...atributosDia}
            title="Arrastrar el día a otro sitio"
            className="flex h-8 w-7 shrink-0 cursor-grab touch-none items-center justify-center rounded-md text-white/30 transition hover:text-white/70 active:cursor-grabbing"
          >
            <GripVertical size={15} />
          </button>

          <button
            type="button"
            onClick={onPliega}
            title={plegado ? "Abrir el día" : "Plegar el día"}
            className="flex items-center gap-1.5 rounded-lg border border-white/10 px-2 py-1 text-[11px] font-semibold uppercase tracking-[0.14em] text-white/70 transition hover:border-white/25 hover:text-white"
          >
            {plegado ? <ChevronRight size={12} /> : <ChevronDown size={12} />}
            Día {indice + 1}
          </button>

          <input
            type="date"
            value={dia.fecha}
            onChange={(evento) => onCambiaDia({ fecha: evento.target.value })}
            title="La fecha del día"
            className="rounded-lg border border-white/10 bg-white/[0.04] px-2 py-1.5 text-xs tabular-nums text-white outline-none transition [color-scheme:dark] focus:border-[#C8A96B]/50"
          />

          <input
            value={dia.titulo}
            onChange={(evento) => onCambiaDia({ titulo: evento.target.value })}
            placeholder={rotuloDia({ ...dia, titulo: "" }, viaje, indice)}
            title="Cómo se llama este día en la hoja"
            /* El mínimo no es decorativo: sin él, en el móvil este campo se
               encoge a dos píxeles entre la fecha y el recuento en vez de
               bajar a su propia línea. */
            className="min-w-[11rem] flex-1 rounded-lg border border-white/10 bg-white/[0.04] px-2.5 py-1.5 text-sm text-white outline-none transition placeholder:text-white/30 focus:border-[#C8A96B]/50"
          />

          <span className="shrink-0 text-[11px] tabular-nums text-white/35">
            {diaCorto(dia.fecha).toLowerCase() || "sin fecha"} ·{" "}
            {citas.length} {citas.length === 1 ? "cita" : "citas"}
          </span>

          {esDelPartido && (
            <span className="shrink-0 rounded-full bg-[#C8A96B]/15 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.16em] text-[#C8A96B]">
              Partido
            </span>
          )}
        </div>

        {/* ------------------------ ACCIONES ------------------------ */}

        <div className="mt-2 flex flex-wrap items-center gap-1.5">
          <select
            value=""
            onChange={(evento) => {
              aplicaPlantilla(evento.target.value);

              evento.target.value = "";
            }}
            title="Rellenar el día de golpe. Lo escrito a mano se pierde."
            className="rounded-lg border border-white/10 bg-white/[0.04] px-2 py-1.5 text-[11px] text-white/70 outline-none transition focus:border-[#C8A96B]/50"
          >
            <option value="" className="bg-[#11161C]">
              Plantilla del día…
            </option>

            {esDelPartido && minutoPartido !== null && (
              <optgroup label="Desde la hora del partido">
                {PLANTILLAS_HORARIO.map((plantilla) => (
                  <option
                    key={plantilla.key}
                    value={plantilla.key}
                    className="bg-[#11161C]"
                  >
                    {plantilla.label}
                  </option>
                ))}
              </optgroup>
            )}

            <optgroup label="A hora fija">
              {PLANTILLAS_DIA.map((plantilla) => (
                <option
                  key={plantilla.key}
                  value={plantilla.key}
                  className="bg-[#11161C]"
                >
                  {plantilla.label}
                </option>
              ))}
            </optgroup>
          </select>

          <span className="ml-1 text-[10px] uppercase tracking-[0.16em] text-white/30">
            Mover el día
          </span>

          {[-60, -30, -15, 15, 30, 60].map((minutos) => (
            <Button
              key={minutos}
              onClick={() => desplaza(minutos)}
              disabled={citas.length === 0}
              title={`Adelantar o retrasar las ${citas.length} citas de este día ${Math.abs(minutos)} minutos`}
            >
              {minutos > 0 ? `+${minutos}` : minutos}
            </Button>
          ))}

          <span className="mx-1 h-4 w-px bg-white/10" />

          <Button
            icon={Copy}
            onClick={onCopia}
            disabled={citas.length === 0}
            title="Copiar las citas de este día para pegarlas en otro"
          >
            Copiar
          </Button>

          {copiado && (
            <Button
              icon={ClipboardPaste}
              onClick={onPega}
              title={`Poner aquí las ${copiado.citas.length} citas de ${copiado.rotulo}, en lugar de las de este día`}
            >
              Pegar ({copiado.citas.length})
            </Button>
          )}

          <Button
            icon={CopyPlus}
            onClick={onDuplica}
            title="Replicar el día: la copia cae al día siguiente con las mismas horas"
          >
            Replicar
          </Button>

          <Button
            icon={Eraser}
            onClick={() => onCambiaCitas([])}
            disabled={citas.length === 0}
            title="Dejar el día sin citas"
          >
            Vaciar
          </Button>

          <Button
            icon={ArrowUp}
            onClick={onSube}
            disabled={indice === 0}
            title="Subir el día"
          />

          <Button
            icon={ArrowDown}
            onClick={onBaja}
            disabled={indice === total - 1}
            title="Bajar el día"
          />

          <Button
            tone="danger"
            icon={Trash2}
            onClick={onElimina}
            title="Quitar el día entero"
          >
            Eliminar
          </Button>
        </div>
      </header>

      {/* ------------------------- LAS CITAS ------------------------ */}

      {!plegado && (
        <div className="space-y-1.5 p-3">
          {citas.length === 0 && (
            <p className="py-5 text-center text-xs text-white/35">
              Día sin citas. Elige una plantilla, pega las de otro día o
              arrastra aquí lo que sobre de otro.
            </p>
          )}

          {citas.map((cita) => (
            <FilaCita
              key={cita.id}
              cita={cita}
              dia={dia}
              viaje={viaje}
              dias={dias}
              arrastrando={
                arrastre?.tipo === "cita" && arrastre.citaId === cita.id
              }
              onCambia={(parche) => cambia(cita.id, parche)}
              onQuita={() =>
                onCambiaCitas(citas.filter((item) => item.id !== cita.id))
              }
              onDuplica={() =>
                onCambiaCitas([
                  ...citas,
                  { ...cita, id: nuevoId("CI"), minuto: cita.minuto + 30 },
                ])
              }
              onMueveA={(destino) => onMueveCita(cita.id, destino)}
            />
          ))}

          <div className="pt-1">
            <Button icon={Plus} onClick={anade}>
              Añadir cita
            </Button>
          </div>
        </div>
      )}
    </section>
  );
}

/* ------------------------------------------------------------------ */
/*  EL EDITOR                                                          */
/* ------------------------------------------------------------------ */

export function EditorHorario({
  viaje,
  onCambio,
}: {
  viaje: Desplazamiento;
  onCambio: (dias: DiaViaje[]) => void;
}) {
  const dias = viaje.dias;

  const minutoPartido = aMinutos(viaje.hora);

  const [arrastre, setArrastre] = useState<Arrastre | null>(null);
  const [plegados, setPlegados] = useState<string[]>([]);
  const [copiado, setCopiado] = useState<{
    rotulo: string;
    citas: CitaHorario[];
  } | null>(null);

  /*
  | Deshacer, de una sola pila y en memoria: casi todo lo de esta pantalla
  | —una plantilla, un pegado, un día borrado— rehace el trabajo de media hora
  | con un clic, y sin vuelta atrás eso da miedo de usar. No se guarda entre
  | sesiones a propósito: lo que vale es el documento, no el camino.
  */
  const pila = useRef<DiaViaje[][]>([]);

  const [pasos, setPasos] = useState(0);

  const guarda = (siguientes: DiaViaje[], aviso?: string) => {
    pila.current = [...pila.current.slice(-19), dias];

    setPasos(pila.current.length);

    onCambio(siguientes);

    if (aviso) toast.success(aviso);
  };

  const deshace = () => {
    const previo = pila.current.pop();

    setPasos(pila.current.length);

    if (!previo) return;

    onCambio(previo);

    toast.success("Deshecho");
  };

  const cambiaDia = (id: string, parche: Partial<DiaViaje>) =>
    guarda(dias.map((dia) => (dia.id === id ? { ...dia, ...parche } : dia)));

  const cambiaCitas = (id: string, citas: CitaHorario[]) =>
    guarda(dias.map((dia) => (dia.id === id ? conCitas(dia, citas) : dia)));

  /** Pasa una cita de un día a otro conservando su hora. */
  const mueveCita = (citaId: string, origenId: string, destinoId: string) => {
    if (origenId === destinoId) return;

    const origen = dias.find((dia) => dia.id === origenId);
    const cita = origen?.citas.find((item) => item.id === citaId);

    if (!origen || !cita) return;

    const destino = dias.find((dia) => dia.id === destinoId);

    if (!destino) return;

    guarda(
      dias.map((dia) => {
        if (dia.id === origenId) {
          return conCitas(
            dia,
            dia.citas.filter((item) => item.id !== citaId),
          );
        }

        if (dia.id === destinoId) return conCitas(dia, [...dia.citas, cita]);

        return dia;
      }),
      `«${cita.texto}» pasa al ${diaCorto(destino.fecha).toLowerCase() || "otro día"}`,
    );
  };

  const anadeDia = (donde: "antes" | "despues") => {
    if (dias.length === 0) {
      guarda([diaVacio(viaje.fecha, "Día de partido")]);

      return;
    }

    if (donde === "antes") {
      guarda([diaVacio(sumaDias(dias[0].fecha, -1)), ...dias]);

      return;
    }

    guarda([...dias, diaVacio(sumaDias(dias[dias.length - 1].fecha, 1))]);
  };

  const aplicaViaje = (key: string) => {
    const plantilla = PLANTILLAS_VIAJE.find((item) => item.key === key);

    if (!plantilla) return;

    guarda(
      diasDePlantillaViaje(plantilla, viaje),
      `${plantilla.label}: ${plantilla.dias.length} ${
        plantilla.dias.length === 1 ? "día" : "días"
      } montados desde la hora del partido`,
    );
  };

  /* --------------------------- ARRASTRE --------------------------- */

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(TouchSensor, {
      activationConstraint: { delay: 180, tolerance: 8 },
    }),
  );

  const empieza = (evento: DragStartEvent) => {
    setArrastre((evento.active.data.current as Arrastre | undefined) ?? null);
  };

  const termina = (evento: DragEndEvent) => {
    const activo = evento.active.data.current as Arrastre | undefined;
    const destino = evento.over?.data.current as
      | DestinoZona
      | DestinoHueco
      | undefined;

    setArrastre(null);

    if (!activo || !destino) return;

    if (activo.tipo === "cita" && destino.tipo === "zona") {
      mueveCita(activo.citaId, activo.diaId, destino.diaId);

      return;
    }

    if (activo.tipo === "dia" && destino.tipo === "hueco") {
      const desde = dias.findIndex((dia) => dia.id === activo.diaId);

      /* El hueco cuenta posiciones de la lista original: al sacar el día de
         su sitio, todos los de detrás se corren uno. */
      const hasta = destino.indice > desde ? destino.indice - 1 : destino.indice;

      if (desde < 0 || desde === hasta) return;

      guarda(mueveEnLista(dias, desde, hasta));
    }
  };

  const citaArrastrada = useMemo(() => {
    if (arrastre?.tipo !== "cita") return null;

    return (
      dias
        .find((dia) => dia.id === arrastre.diaId)
        ?.citas.find((cita) => cita.id === arrastre.citaId) ?? null
    );
  }, [arrastre, dias]);

  const diaArrastrado = useMemo(() => {
    if (arrastre?.tipo !== "dia") return null;

    return dias.find((dia) => dia.id === arrastre.diaId) ?? null;
  }, [arrastre, dias]);

  /* ---------------------------- LA VISTA --------------------------- */

  const sinDiaDePartido = dias.length > 0 && indiceDiaPartido(viaje) < 0;

  const total = dias.reduce((suma, dia) => suma + dia.citas.length, 0);

  const desordenadas = dias.some(
    (dia, indice) => indice > 0 && dia.fecha < dias[indice - 1].fecha,
  );

  /* Cuánto calendario ocupa el viaje, que no es lo mismo que cuántos días
     tiene: dos días con una jornada de por medio son tres de calendario. */
  const abarca = dias.length
    ? diasEntre(dias[0].fecha, dias[dias.length - 1].fecha) + 1
    : 0;

  return (
    <Panel
      title="El horario del viaje"
      subtitle={
        minutoPartido === null
          ? "Escribe la hora del partido y el día se monta solo"
          : `${dias.length} ${dias.length === 1 ? "día" : "días"} · ${total} ${
              total === 1 ? "cita" : "citas"
            } · una hoja A4 por día, todo contado desde el partido de las ${aHora(minutoPartido)}`
      }
      icon={CalendarClock}
      action={
        <Button icon={Undo2} onClick={deshace} disabled={pasos === 0}>
          Deshacer
        </Button>
      }
    >
      {/* -------------------- PLANTILLAS DE VIAJE ------------------- */}

      <div className="flex flex-wrap items-center gap-2">
        <span className="text-[10px] uppercase tracking-[0.18em] text-white/40">
          Montar el viaje
        </span>

        {[...PLANTILLAS_VIAJE]
          .sort((a, b) =>
            a.condicion === b.condicion
              ? 0
              : a.condicion === viaje.condicion
                ? -1
                : 1,
          )
          .map((plantilla) => (
            <Button
              key={plantilla.key}
              icon={Wand2}
              onClick={() => aplicaViaje(plantilla.key)}
              disabled={minutoPartido === null}
              title={`${plantilla.pista}. Rehace los días enteros desde la fecha y la hora del partido.`}
            >
              {plantilla.label}
            </Button>
          ))}

        <span className="text-[11px] text-white/30">
          Rehacen el viaje entero: lo escrito a mano se pierde
        </span>
      </div>

      {/* ------------------------ LOS DÍAS -------------------------- */}

      <div className="mt-3 flex flex-wrap items-center gap-2 border-t border-white/8 pt-3">
        <span className="text-[10px] uppercase tracking-[0.18em] text-white/40">
          Los días
        </span>

        <Button icon={CalendarPlus} onClick={() => anadeDia("antes")}>
          Añadir día antes
        </Button>

        <Button icon={CalendarPlus} onClick={() => anadeDia("despues")}>
          Añadir día después
        </Button>

        <Button
          icon={CalendarRange}
          onClick={() => guarda(ordenaDias(dias))}
          disabled={dias.length < 2 || !desordenadas}
          title="Poner los días en el orden de sus fechas"
        >
          Ordenar por fecha
        </Button>

        <Button
          icon={Link2}
          onClick={() =>
            guarda(
              encadenaFechas(dias),
              "Fechas encadenadas: días seguidos desde el primero",
            )
          }
          disabled={dias.length < 2}
          title="Poner fechas seguidas desde el primer día, respetando el orden de la lista"
        >
          Encadenar fechas
        </Button>

        {dias.length > 1 && (
          <Button
            onClick={() =>
              setPlegados(plegados.length ? [] : dias.map((dia) => dia.id))
            }
          >
            {plegados.length ? "Abrir todos" : "Plegar todos"}
          </Button>
        )}
      </div>

      {sinDiaDePartido && (
        <div className="mt-3">
          <Notice
            tone="warn"
            title="Ningún día cae en la fecha del partido"
          >
            El partido es el {viaje.fecha || "—"} y ninguno de los días del
            viaje lleva esa fecha, así que no hay ninguno anclado al saque
            inicial: las plantillas por desfase y la cuenta atrás de cada cita
            se quedan sin referencia. Cambia la fecha del día que se juega, o
            encadena las fechas desde el primero.
          </Notice>
        </div>
      )}

      {dias.length === 0 && (
        <p className="py-8 text-center text-xs text-white/35">
          Todavía no hay ningún día. Monta el viaje con una plantilla de arriba
          o añade los días a mano.
        </p>
      )}

      <DndContext
        sensors={sensors}
        collisionDetection={closestCenter}
        onDragStart={empieza}
        onDragEnd={termina}
        onDragCancel={() => setArrastre(null)}
      >
        <div className="mt-3 space-y-2">
          {dias.map((dia, indice) => (
            <div key={dia.id}>
              <HuecoDia indice={indice} activo={arrastre?.tipo === "dia"} />

              <TarjetaDia
                dia={dia}
                indice={indice}
                total={dias.length}
                viaje={viaje}
                dias={dias}
                plegado={plegados.includes(dia.id)}
                copiado={copiado}
                arrastre={arrastre}
                onPliega={() =>
                  setPlegados(
                    plegados.includes(dia.id)
                      ? plegados.filter((item) => item !== dia.id)
                      : [...plegados, dia.id],
                  )
                }
                onCambiaDia={(parche) => cambiaDia(dia.id, parche)}
                onCambiaCitas={(citas) => cambiaCitas(dia.id, citas)}
                onSube={() => guarda(mueveEnLista(dias, indice, indice - 1))}
                onBaja={() => guarda(mueveEnLista(dias, indice, indice + 1))}
                onDuplica={() =>
                  guarda(
                    [
                      ...dias.slice(0, indice + 1),
                      duplicaDia(dia),
                      ...dias.slice(indice + 1),
                    ],
                    `Día replicado en el ${diaCorto(sumaDias(dia.fecha, 1)).toLowerCase()}`,
                  )
                }
                onElimina={() =>
                  guarda(
                    dias.filter((item) => item.id !== dia.id),
                    `Quitado el día ${diaCorto(dia.fecha).toLowerCase()}. Se puede deshacer.`,
                  )
                }
                onCopia={() => {
                  setCopiado({
                    rotulo: diaCorto(dia.fecha).toLowerCase() || `día ${indice + 1}`,
                    citas: dia.citas,
                  });

                  toast.success(
                    `Copiadas las ${dia.citas.length} citas: pégalas en otro día`,
                  );
                }}
                onPega={() => {
                  if (!copiado) return;

                  cambiaCitas(dia.id, clonaCitas(copiado.citas));

                  toast.success(
                    `Pegadas las citas de ${copiado.rotulo}. Se puede deshacer.`,
                  );
                }}
                onMueveCita={(citaId, destinoId) =>
                  mueveCita(citaId, dia.id, destinoId)
                }
              />
            </div>
          ))}

          <HuecoDia indice={dias.length} activo={arrastre?.tipo === "dia"} />
        </div>

        <DragOverlay dropAnimation={null}>
          {citaArrastrada && (
            <div
              className="flex items-center gap-2 rounded-xl border border-white/25 bg-[#141A21] px-3 py-2 shadow-2xl"
              style={{
                borderLeft: `4px solid ${
                  (TIPO_CITA[citaArrastrada.tipo] ?? TIPO_CITA.otro).color
                }`,
              }}
            >
              <span className="text-sm font-semibold tabular-nums text-white">
                {aHora(citaArrastrada.minuto)}
              </span>

              <span className="text-xs text-white/70">
                {citaArrastrada.texto}
              </span>
            </div>
          )}

          {diaArrastrado && (
            <div className="rounded-xl border border-white/25 bg-[#141A21] px-3 py-2 shadow-2xl">
              <p className="text-xs font-semibold uppercase tracking-[0.14em] text-white">
                {diaCorto(diaArrastrado.fecha).toLowerCase()}
              </p>

              <p className="mt-0.5 text-[11px] text-white/50">
                {diaArrastrado.citas.length}{" "}
                {diaArrastrado.citas.length === 1 ? "cita" : "citas"}
              </p>
            </div>
          )}
        </DragOverlay>
      </DndContext>

      <p className="mt-3 text-[11px] leading-relaxed text-white/35">
        Cada día es una hoja A4 del horario y sale en el PDF por orden. Las
        citas se ordenan solas por hora, así que arrastrarlas sirve para pasarlas
        de un día a otro —o el desplegable de la fila, que es lo cómodo desde el
        móvil—; los días se arrastran por su asa. Del día del partido cuelgan las
        plantillas por desfase: si la federación cambia la hora, se mueve el día
        entero con los botones y los desfases se conservan.
        {abarca > dias.length
          ? ` Ojo: los ${dias.length} días abarcan ${abarca} de calendario, así que hay alguno suelto en medio.`
          : ""}
      </p>
    </Panel>
  );
}
