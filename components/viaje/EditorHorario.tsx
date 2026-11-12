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

import { useEffect, useMemo, useRef, useState } from "react";
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
  MoreHorizontal,
  Pencil,
  Pin,
  Plus,
  Route,
  Trash2,
  Undo2,
  Wand2,
} from "lucide-react";
import { toast } from "sonner";

import { Button, Notice, Panel } from "@/components/abp/ui";
import { EntradaHora } from "@/components/viaje/EntradaHora";
import { srcImagen } from "@/components/viaje/DossierViaje";
import { CLAVES_LUGAR, nombreLugar, resuelveLugar } from "@/lib/viaje/rutas";
import { pideTrayecto, recuerdaDuracion } from "@/lib/viaje/trayectos-cliente";
import { comoFrase, propiosDelViaje, type LineaAviso } from "@/lib/viaje/revision";
import {
  EVENTOS_PALETA,
  EVENTO_POR_CLAVE,
  citasDeEvento,
  comoDuracion,
  emojiDeCita,
  encadenaCitas,
  esSalida,
  leeDuracion,
  medioDeCita,
  type EventoPaleta,
  type ImagenViaje,
  PLANTILLAS_DIA,
  PLANTILLAS_HORARIO,
  PLANTILLAS_VIAJE,
  TIPO_CITA,
  aHora,
  aMinutos,
  anclaDelHorario,
  citaDeHora,
  clonaCitas,
  comoDesfase,
  conCitas,
  cuentaDeCita,
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
  esDiaDelPartido,
  indiceDiaPartido,
  mueveDiaPartido,
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

/** Las citas de un día copiadas para pegarlas en otro, también de otro viaje. */
export type DiaCopiado = { rotulo: string; citas: CitaHorario[] };

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
/** Un evento de la paleta, camino de un día (11/11/2026). */
type ArrastrePaleta = { tipo: "paleta"; clave: string };
type Arrastre = ArrastreCita | ArrastreDia | ArrastrePaleta;

const idPaleta = (clave: string) => `paleta:${clave}`;

/** Lo que dice el chip: el texto del evento o, el personalizable, «Otra». */
const rotuloEvento = (evento: EventoPaleta) => evento.texto || "Otra cita";

/* ------------------------------------------------------------------ */
/*  LA PALETA                                                          */
/* ------------------------------------------------------------------ */

/**
 * Un evento que se arrastra a un día, como un emoticono a un chat. Con un
 * toque, sin arrastrar, va al día que se diga (`onToca`).
 */
function ChipPaleta({ evento, onToca, titulo }: { evento: EventoPaleta; onToca: () => void; titulo: string }) {
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({
    id: idPaleta(evento.clave),
    data: { tipo: "paleta", clave: evento.clave } satisfies ArrastrePaleta,
  });

  return (
    <button
      type="button"
      ref={setNodeRef}
      {...listeners}
      {...attributes}
      onClick={onToca}
      title={titulo}
      className={`flex shrink-0 items-center gap-1.5 rounded-full border border-white/10 bg-white/[0.03] px-2.5 py-1 text-[12px] text-white/75 transition hover:border-[#C8A96B]/50 hover:text-white ${
        isDragging ? "opacity-30" : ""
      }`}
      style={{ borderLeft: `3px solid ${TIPO_CITA[evento.tipo].color}` }}
    >
      <span aria-hidden className="text-[15px] leading-none">{evento.emoji}</span>
      {rotuloEvento(evento)}
    </button>
  );
}

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
  enfoca = false,
  onCambia,
  onQuita,
  onDuplica,
  onMueveA,
  lugares,
  estadoTrayecto,
  onCalcula,
  onDuracionManual,
}: {
  cita: CitaHorario;
  dia: DiaViaje;
  viaje: Desplazamiento;
  dias: DiaViaje[];
  arrastrando: boolean;
  /** Recién creada: el cursor va directo a escribir qué es. */
  enfoca?: boolean;
  /** `sinCadena`: el cambio no corre las de detrás (pasar a la madrugada siguiente). */
  onCambia: (parche: Partial<CitaHorario>, sinCadena?: boolean) => void;
  onQuita: () => void;
  onDuplica: () => void;
  onMueveA: (diaId: string) => void;
  lugares?: Record<string, ImagenViaje>;
  /** «calculando» mientras se pide; si falló, por qué. */
  estadoTrayecto?: string;
  /** Pide lo que dura el trayecto (con los lugares que se le pasen, si acaban de cambiar). */
  onCalcula: (parche?: Partial<CitaHorario>) => void;
  onDuracionManual: (minutos: number | null) => void;
}) {
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({
    id: idCita(dia.id, cita.id),
    data: { tipo: "cita", diaId: dia.id, citaId: cita.id } satisfies ArrastreCita,
  });

  const tono = TIPO_CITA[cita.tipo] ?? TIPO_CITA.otro;

  const desfase = desfaseCita(cita, dia, viaje);
  const minutoPartido = aMinutos(viaje.hora);
  const cuenta = desfase !== null && minutoPartido !== null ? cuentaDeCita(desfase, minutoPartido) : null;

  /*
  | 11/11/2026 (revisión de los expertos): a la vista, en el móvil y en el
  | ordenador, sólo la hora, qué es y la cuenta al partido. El detalle, el
  | tipo, el día, los cinco minutos y lo demás, tras «⋯». Antes cada cita
  | repetía tres desplegables y dos flechas: 18 citas eran 90 mandos.
  | Una recién creada abre ya desplegada.
  */
  const [editar, setEditar] = useState(Boolean(enfoca));

  /* La duración se escribe en borrador y se guarda al salir: «4 h 15», «255». */
  const [borradorDuracion, setBorradorDuracion] = useState<string | null>(null);

  const emoji = emojiDeCita(cita);
  const conTrayecto = esSalida(cita) || cita.tipo === "viaje";
  const hasta = resuelveLugar(cita.hasta, viaje, lugares);

  const confirmaDuracion = () => {
    if (borradorDuracion === null) return;

    const minutos = leeDuracion(borradorDuracion);

    setBorradorDuracion(null);

    if (borradorDuracion.trim() === "") {
      onDuracionManual(null);

      return;
    }

    if (minutos !== null && minutos > 0 && minutos !== cita.duracion) onDuracionManual(minutos);
  };

  return (
    <div
      ref={setNodeRef}
      id={`cita-${cita.id}`}
      className={`grid min-w-0 scroll-mt-24 grid-cols-[auto_96px_minmax(0,1fr)_auto] items-start gap-2 rounded-xl border border-white/10 bg-white/[0.03] px-2 py-2 transition ${
        isDragging || arrastrando ? "opacity-30" : ""
      }`}
    >
      {/* El asa lleva el color del tipo: se agarra y se reconoce la fila. */}
      <button
        type="button"
        {...listeners}
        {...attributes}
        title="Arrastrar a otro día"
        className="flex h-9 w-6 shrink-0 cursor-grab touch-none items-center justify-center rounded-md text-white/25 transition hover:text-white/60 active:cursor-grabbing"
        style={{ borderLeft: `3px solid ${tono.color}` }}
      >
        <GripVertical size={13} />
      </button>

      <div className="min-w-0">
        {/* Se escribe entero y se guarda al salir: ver `EntradaHora`. */}
        <EntradaHora
          minuto={cita.minuto}
          onCambia={(minuto) => {
            if (minuto !== null) onCambia({ minuto });
          }}
          etiqueta={`Hora de «${cita.texto || "la cita"}»`}
          className="w-full rounded-lg border border-white/10 bg-white/[0.04] px-2 py-1.5 text-center text-sm font-semibold tabular-nums text-white outline-none transition focus:border-[#C8A96B]/50"
        />

        {cuenta && (
          /* 11/11/2026: «MD-1 · faltan 29 h 15», como se cuenta en la caseta (antes «−1 d 5 h 15»). */
          <p className="mt-1 text-center text-[12px] leading-tight tabular-nums text-white/60" title={cuenta.frase}>
            <span className="block font-semibold text-[#C8A96B]">{cuenta.md}</span>
            {cuenta.cuanto}
          </p>
        )}
      </div>

      <div className="min-w-0">
        <span className="flex min-w-0 items-center gap-1.5">
          {emoji && (
            <span aria-hidden className="w-6 shrink-0 text-center text-[17px] leading-none">
              {emoji}
            </span>
          )}
          <input
            value={cita.texto}
            onChange={(evento) => onCambia({ texto: evento.target.value })}
            autoFocus={enfoca}
            data-texto-cita
            placeholder="Qué es: salida bus, comida…"
            className="w-full min-w-0 rounded-lg border border-white/10 bg-white/[0.04] px-2.5 py-1.5 text-sm text-white outline-none transition placeholder:text-white/25 focus:border-[#C8A96B]/50"
          />
        </span>

        {!editar && (cita.nota || esDiaSiguiente(cita.minuto) || cita.fijada || (conTrayecto && (cita.hasta || cita.duracion)) || estadoTrayecto) && (
          <p className="mt-1 flex min-w-0 flex-wrap items-center gap-x-2 text-[12px] text-white/55">
            {cita.fijada && (
              <span className="flex shrink-0 items-center gap-0.5 font-semibold text-[#C8A96B]" title="Fijada: el encadenado no la mueve">
                <Pin size={11} /> fijada
              </span>
            )}
            {esDiaSiguiente(cita.minuto) && (
              <span className="shrink-0 font-semibold uppercase tracking-wide text-[#C8A96B]">
                Ya es {diaSiguienteCorto(dia.fecha).toLowerCase()}
              </span>
            )}
            {conTrayecto && (cita.desde || cita.hasta) && (
              <span className="min-w-0 truncate">
                {[nombreLugar(cita.desde, viaje), nombreLugar(cita.hasta, viaje)].filter(Boolean).join(" → ")}
              </span>
            )}
            {conTrayecto && cita.duracion ? (
              <span className="shrink-0 font-semibold text-white/75">
                {comoDuracion(cita.duracion)} · llega {aHora(cita.minuto + cita.duracion)}
              </span>
            ) : null}
            {estadoTrayecto && <span className="shrink-0 text-white/45">{estadoTrayecto === "calculando" ? "calculando el trayecto…" : estadoTrayecto}</span>}
            {cita.nota ? <span className="min-w-0 truncate">{cita.nota}</span> : null}
          </p>
        )}
      </div>

      <button
        type="button"
        onClick={() => setEditar((v) => !v)}
        aria-expanded={editar}
        aria-label="Más de la cita: detalle, tipo, día y quitar"
        title="Detalle, tipo, día, mover cinco minutos, duplicar o quitar"
        className={`flex h-9 w-9 items-center justify-center rounded-lg border transition ${
          editar ? "border-[#C8A96B]/50 text-[#C8A96B]" : "border-white/10 text-white/60 hover:text-white"
        }`}
      >
        <MoreHorizontal size={16} />
      </button>

      {/* Lo de menos uso, en línea y no flotando: el día lleva overflow-hidden y lo cortaría. */}
      {editar && (
        <div className="col-span-full grid min-w-0 gap-2 rounded-xl border border-white/10 bg-white/[0.03] p-2 sm:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)_minmax(0,1fr)]">
          <label className="block min-w-0">
            <span className="mb-1 block text-[11px] uppercase tracking-[0.14em] text-white/45">Detalle</span>
            <input
              value={cita.nota ?? ""}
              onChange={(evento) => onCambia({ nota: evento.target.value })}
              placeholder="Opcional: sale en la hoja bajo la cita"
              className="w-full min-w-0 rounded-lg border border-white/10 bg-white/[0.04] px-2.5 py-1.5 text-sm text-white/85 outline-none transition placeholder:text-white/25 focus:border-[#C8A96B]/50"
            />
          </label>

          <label className="block min-w-0">
            <span className="mb-1 block text-[11px] uppercase tracking-[0.14em] text-white/45">Tipo</span>
            <select
              value={cita.tipo}
              onChange={(evento) => onCambia({ tipo: evento.target.value as TipoCita })}
              className="w-full min-w-0 rounded-lg border border-white/10 bg-white/[0.04] px-2 py-1.5 text-sm text-white outline-none transition focus:border-[#C8A96B]/50"
            >
              {Object.entries(TIPO_CITA).map(([key, valor]) => (
                <option key={key} value={key} className="bg-[#11161C]">
                  {valor.label}
                </option>
              ))}
            </select>
          </label>

          {/* Cambiar de día sin arrastrar: es como se edita desde el móvil. */}
          {dias.length > 1 && (
            <label className="block min-w-0">
              <span className="mb-1 block text-[11px] uppercase tracking-[0.14em] text-white/45">Día</span>
              <select
                value={dia.id}
                onChange={(evento) => onMueveA(evento.target.value)}
                title="Pasar la cita a otro día"
                className="w-full min-w-0 rounded-lg border border-white/10 bg-white/[0.04] px-2 py-1.5 text-sm text-white outline-none transition focus:border-[#C8A96B]/50"
              >
                {dias.map((item, indice) => (
                  <option key={item.id} value={item.id} className="bg-[#11161C]">
                    {`Día ${indice + 1} · ${diaCorto(item.fecha).toLowerCase() || item.fecha}`}
                  </option>
                ))}
              </select>
            </label>
          )}

          {/* 11/11/2026: el emoticono y la marca de fijada. */}
          <div className="col-span-full flex min-w-0 flex-wrap items-end gap-3">
            <label className="block w-24 min-w-0">
              <span className="mb-1 block text-[11px] uppercase tracking-[0.14em] text-white/45">Emoticono</span>
              <input
                value={cita.emoji ?? ""}
                onChange={(evento) => onCambia({ emoji: evento.target.value.slice(0, 8) })}
                placeholder={emoji || "🙂"}
                aria-label="Emoticono de la cita"
                className="w-full rounded-lg border border-white/10 bg-white/[0.04] px-2 py-1.5 text-center text-[17px] text-white outline-none transition placeholder:text-white/40 focus:border-[#C8A96B]/50"
              />
            </label>

            <label className="flex items-center gap-2 rounded-lg border border-white/10 px-2.5 py-1.5 text-[13px] text-white/75">
              <input
                type="checkbox"
                checked={Boolean(cita.fijada)}
                onChange={(evento) => onCambia({ fijada: evento.target.checked || undefined })}
                className="h-4 w-4 accent-[#C8A96B]"
              />
              <Pin size={13} className="text-[#C8A96B]" />
              Fijada: al cambiar otra cita, ésta no se mueve
            </label>
          </div>

          {/* El trayecto: de dónde a dónde y cuánto se tarda (11/11/2026). */}
          {conTrayecto && (
            <div className="col-span-full grid min-w-0 gap-2 rounded-lg border border-white/10 p-2 sm:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_minmax(0,1fr)]">
              {(["desde", "hasta"] as const).map((campo) => (
                <label key={campo} className="block min-w-0">
                  <span className="mb-1 block text-[11px] uppercase tracking-[0.14em] text-white/45">{campo === "desde" ? "Sale de" : "Va a"}</span>
                  <select
                    value={cita[campo] ?? ""}
                    onChange={(evento) => {
                      const parche = { [campo]: evento.target.value || undefined } as Partial<CitaHorario>;

                      onCambia(parche);

                      /* Con los dos lugares puestos, el autobús se calcula solo. */
                      if (medioDeCita(cita) === "bus" || cita.duracion === undefined) onCalcula(parche);
                    }}
                    className="w-full min-w-0 rounded-lg border border-white/10 bg-white/[0.04] px-2 py-1.5 text-sm text-white outline-none transition focus:border-[#C8A96B]/50"
                  >
                    <option value="" className="bg-[#11161C]">—</option>
                    {CLAVES_LUGAR.map((clave) => (
                      <option key={clave} value={clave} className="bg-[#11161C]">
                        {nombreLugar(clave, viaje)}
                      </option>
                    ))}
                  </select>
                </label>
              ))}

              <label className="block min-w-0">
                <span className="mb-1 block text-[11px] uppercase tracking-[0.14em] text-white/45">
                  Duración{" "}
                  {cita.duracionFuente ? (
                    <span className="normal-case tracking-normal text-white/40">
                      · {cita.duracionFuente === "osrm" ? "calculada (OpenStreetMap)" : cita.duracionFuente === "memoria" ? "la que pusiste la otra vez" : "escrita a mano"}
                    </span>
                  ) : null}
                </span>
                <span className="flex min-w-0 items-center gap-1.5">
                  <input
                    value={borradorDuracion ?? comoDuracion(cita.duracion)}
                    onChange={(evento) => setBorradorDuracion(evento.target.value)}
                    onBlur={confirmaDuracion}
                    onKeyDown={(evento) => {
                      if (evento.key === "Enter") (evento.target as HTMLInputElement).blur();
                    }}
                    placeholder="4 h 15"
                    title="Se recuerda para este trayecto en los próximos viajes"
                    className="w-full min-w-0 rounded-lg border border-white/10 bg-white/[0.04] px-2 py-1.5 text-sm tabular-nums text-white outline-none transition placeholder:text-white/25 focus:border-[#C8A96B]/50"
                  />
                  <Button icon={Route} onClick={() => onCalcula()} disabled={estadoTrayecto === "calculando"} title="Calcular con OpenStreetMap (autobús) o traer la que se guardó">
                    Calcular
                  </Button>
                </span>
              </label>

              {hasta?.foto?.url && (
                <div className="col-span-full flex min-w-0 items-center gap-2">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={srcImagen(hasta.foto.url)} alt="" className="h-14 w-24 shrink-0 rounded-md object-cover" />
                  <span className="min-w-0 text-[12px] text-white/55">La foto de {hasta.nombre}: sale en la diapositiva «El viaje».</span>
                </div>
              )}

              {estadoTrayecto && estadoTrayecto !== "calculando" && (
                <p className="col-span-full text-[12px] text-amber-300/80">{estadoTrayecto}</p>
              )}
            </div>
          )}

          {/* La valoración de la cita: para la próxima vez, no sale en ningún PDF. */}
          <div className="col-span-full grid min-w-0 gap-2 sm:grid-cols-[110px_minmax(0,1fr)]">
            <label className="block min-w-0">
              <span className="mb-1 block text-[11px] uppercase tracking-[0.14em] text-white/45">Nota</span>
              <select
                value={cita.valoracion?.nota ?? ""}
                onChange={(evento) =>
                  onCambia({ valoracion: { ...cita.valoracion, nota: evento.target.value ? Number(evento.target.value) : undefined } })
                }
                className="w-full rounded-lg border border-white/10 bg-white/[0.04] px-2 py-1.5 text-sm text-white outline-none transition focus:border-[#C8A96B]/50"
              >
                <option value="" className="bg-[#11161C]">—</option>
                {Array.from({ length: 10 }, (_, i) => i + 1).map((n) => (
                  <option key={n} value={n} className="bg-[#11161C]">{n}</option>
                ))}
              </select>
            </label>
            <label className="block min-w-0">
              <span className="mb-1 block text-[11px] uppercase tracking-[0.14em] text-white/45">Cómo salió · no va en el PDF</span>
              <input
                value={cita.valoracion?.texto ?? ""}
                onChange={(evento) => onCambia({ valoracion: { ...cita.valoracion, texto: evento.target.value } })}
                placeholder="«Llegó 20 min tarde», «la sala, pequeña»"
                className="w-full min-w-0 rounded-lg border border-white/10 bg-white/[0.04] px-2.5 py-1.5 text-sm text-white/85 outline-none transition placeholder:text-white/25 focus:border-[#C8A96B]/50"
              />
            </label>
          </div>

          <div className="col-span-full flex min-w-0 flex-wrap items-center gap-1.5">
            <Button icon={ArrowUp} onClick={() => onCambia({ minuto: Math.max(0, cita.minuto - 5) })} title="Cinco minutos antes">
              5 min antes
            </Button>

            <Button icon={ArrowDown} onClick={() => onCambia({ minuto: cita.minuto + 5 })} title="Cinco minutos después">
              5 min después
            </Button>

            {/* La vuelta que llega a las 3:15 pertenece a la hoja del día que se jugó: esto la manda a la de después, y otra vez la trae. */}
            <Button onClick={() => onCambia({ minuto: esDiaSiguiente(cita.minuto) ? cita.minuto - 1440 : cita.minuto + 1440 }, true)}>
              {esDiaSiguiente(cita.minuto) ? "Volver a este día" : "Pasar a la madrugada siguiente"}
            </Button>

            <Button icon={CopyPlus} onClick={onDuplica}>
              Duplicar media hora después
            </Button>

            <Button tone="danger" icon={Trash2} onClick={onQuita}>
              Quitar
            </Button>

            <button
              type="button"
              onClick={() => setEditar(false)}
              className="ml-auto rounded-lg border border-white/10 px-3 py-1.5 text-[13px] font-semibold text-white/70 transition hover:text-white"
            >
              Listo
            </button>
          </div>
        </div>
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
  recien,
  onRecien,
  encadenar,
  lugares,
  estados,
  onCalcula,
  onDuracionManual,
  onEvento,
  erratas,
  onCorrige,
}: {
  /** Las citas de este día que parecen mal escritas, con su corrección (12/11/2026). */
  erratas?: LineaAviso[];
  onCorrige?: (linea: LineaAviso) => void;
  /** Si cambiar una hora mueve las de detrás (11/11/2026). */
  encadenar: boolean;
  lugares?: Record<string, ImagenViaje>;
  /** Por cita: «calculando» o por qué no se pudo calcular el trayecto. */
  estados: Record<string, string>;
  onCalcula: (cita: CitaHorario) => void;
  onDuracionManual: (citaId: string, minutos: number | null) => void;
  onEvento: (evento: EventoPaleta) => void;
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
  /** La cita que se acaba de añadir a mano: se abre con el cursor dentro. */
  recien: string | null;
  onRecien: (id: string | null) => void;
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
    disabled: arrastre?.tipo !== "cita" && arrastre?.tipo !== "paleta",
  });

  const minutoPartido = aMinutos(viaje.hora);

  /* Las acciones del día, plegadas tras «Opciones del día». */
  const [opciones, setOpciones] = useState(false);

  const esDelPartido = esDiaDelPartido(dia, viaje);

  const citas = dia.citas;

  /* Los nombres propios del viaje, para leer las citas plegadas con su mayúscula. */
  const propios = propiosDelViaje(viaje);

  /*
  | Encadenado (11/11/2026): cambiar la hora de una cita corre las de detrás lo
  | mismo, hasta la primera fijada o el partido. Ver `encadenaCitas`.
  */
  const cambia = (id: string, parche: Partial<CitaHorario>, sinCadena = false) => {
    if (!encadenar || sinCadena) {
      onCambiaCitas(citas.map((cita) => (cita.id === id ? { ...cita, ...parche } : cita)));

      return;
    }

    const { citas: nuevas, movidas } = encadenaCitas(citas, id, parche);

    onCambiaCitas(nuevas);

    if (movidas > 0) {
      toast.message(`${movidas === 1 ? "Se mueve 1 cita" : `Se mueven ${movidas} citas`} detrás`, {
        description: "Encadenado: lo fijado y el partido no se tocan. Se puede deshacer.",
      });
    }
  };

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

  /*
  | Una cita a mano: media hora después de la última, que es donde se suele
  | escribir la siguiente, y con el cursor ya en el texto. Antes caía encima
  | del saque inicial —justo donde está el partido— y llamada «Nueva cita»,
  | que había que borrar antes de escribir.
  */
  const anade = () => {
    const ultima = citas.length ? Math.max(...citas.map((cita) => cita.minuto)) : null;

    const nueva: CitaHorario = {
      id: nuevoId("CI"),
      minuto:
        ultima !== null
          ? ultima + 30
          : esDelPartido && minutoPartido !== null
            ? Math.max(0, minutoPartido - 300)
            : 12 * 60,
      texto: "",
      tipo: "otro",
    };

    onCambiaCitas([...citas, nueva]);

    onRecien(nueva.id);
  };

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
            <span className="shrink-0 rounded-full bg-[#C8A96B]/15 px-2 py-0.5 text-[11px] font-semibold uppercase tracking-[0.16em] text-[#C8A96B]">
              Partido
            </span>
          )}
        </div>

        {/* ------------------------ ACCIONES ------------------------ */}

        {/*
        | 11/11/2026 (revisión de los expertos): a la vista, «Editar» y el
        | pegado; plantilla, mover el día, copiar, replicar, vaciar, subir,
        | bajar y eliminar van tras «Opciones del día». Eran catorce botones
        | repetidos en cada día.
        */}
        <div className="mt-2 flex flex-wrap items-center gap-1.5">
          {plegado && citas.length > 0 && (
            <Button icon={Pencil} tone="primary" onClick={onPliega} title="Abrir el día para cambiar sus citas">
              Editar
            </Button>
          )}

          {copiado && (
            <Button
              icon={ClipboardPaste}
              onClick={onPega}
              title={`Poner aquí las ${copiado.citas.length} citas de ${copiado.rotulo}, en lugar de las de este día`}
            >
              Pegar ({copiado.citas.length})
            </Button>
          )}

          <Button icon={MoreHorizontal} onClick={() => setOpciones((v) => !v)} title="Plantilla, mover el día, copiar, replicar, vaciar o quitar el día">
            {opciones ? "Cerrar opciones" : "Opciones del día"}
          </Button>
        </div>

        {opciones && (
        <div className="mt-2 flex flex-wrap items-center gap-1.5 rounded-xl border border-white/10 bg-white/[0.03] p-2">
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

          {/* «Mover el día» en una tira que se desliza en el móvil (30/10/2026): partida en dos líneas se leía cortada. */}
          <span className="flex min-w-0 max-w-full items-center gap-1.5 overflow-x-auto pb-0.5 [scrollbar-width:thin]">
            <span className="ml-1 shrink-0 text-[11px] uppercase tracking-[0.16em] text-white/30">
              Mover el día
            </span>

            {[-60, -30, -15, 15, 30, 60].map((minutos) => (
              <span key={minutos} className="shrink-0">
                <Button
                  onClick={() => desplaza(minutos)}
                  disabled={citas.length === 0}
                  title={`Adelantar o retrasar las ${citas.length} citas de este día ${Math.abs(minutos)} minutos`}
                >
                  {minutos > 0 ? `+${minutos}` : minutos}
                </Button>
              </span>
            ))}
          </span>

          <span className="mx-1 h-4 w-px bg-white/10" />

          <Button
            icon={Copy}
            onClick={onCopia}
            disabled={citas.length === 0}
            title="Copiar las citas de este día para pegarlas en otro"
          >
            Copiar
          </Button>

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
        )}
      </header>

      {/*
      | El día plegado se LEE (11/11/2026): hora y qué es de cada cita, en
      | columnas. Así el horario entero cabe en una pantalla y se abre sólo el
      | día que se va a tocar.
      */}
      {plegado && citas.length > 0 && (
        /*
        | xl:columns-2: en escritorio ancho el formulario comparte la fila con la vista previa.
        | 12/11/2026 (expertos): en COLUMNAS de periódico, no en rejilla: se llena
        | la de la izquierda de arriba abajo y luego la siguiente, y se lee en
        | orden como la hoja A4 (la rejilla iba fila a fila, alternando columnas).
        */
        <ol className="columns-1 gap-x-4 px-3 py-2.5 sm:columns-2 lg:columns-3 xl:columns-2 2xl:columns-3">
          {[...citas]
            .sort((a, b) => a.minuto - b.minuto)
            .map((cita) => (
              <li key={cita.id} id={`cita-${cita.id}`} className="mb-1 flex min-w-0 break-inside-avoid scroll-mt-24 flex-wrap items-baseline gap-x-2 gap-y-0.5 rounded-md text-[14px]">
                <span
                  className="w-12 shrink-0 font-semibold tabular-nums text-white"
                  style={{ borderLeft: `3px solid ${(TIPO_CITA[cita.tipo] ?? TIPO_CITA.otro).color}`, paddingLeft: 6 }}
                >
                  {aHora(cita.minuto)}
                </span>
                {esDiaSiguiente(cita.minuto) && (
                  <span className="shrink-0 text-[12px] font-semibold uppercase tracking-wide text-[#C8A96B]">{diaSiguienteCorto(dia.fecha).toLowerCase()}</span>
                )}
                {emojiDeCita(cita) && <span aria-hidden className="shrink-0 text-[14px] leading-none">{emojiDeCita(cita)}</span>}
                {/* 12/11/2026: con mayúscula sólo al principio, para leerlo igual («SALIDA BUS» y «Salida hacia…»); lo guardado no cambia. */}
                {/* 12/11/2026 (expertos): el nombre entero, sin «Parid…»; si no cabe, baja de línea. */}
                <span className="min-w-[12ch] flex-1 text-white/75 [overflow-wrap:anywhere]" title={cita.texto}>{cita.texto ? comoFrase(cita.texto, propios) : "Sin nombre"}</span>
                {cita.fijada && <Pin size={11} className="shrink-0 text-[#C8A96B]" aria-label="fijada" />}
                {/*
                | 12/11/2026 (expertos): la errata, pegada a su fila. El aviso de
                | «Cómo va el viaje» la nombra, pero la cita mal escrita se veía
                | aquí sin marca. Se corrige al pulsar, nunca sola.
                */}
                {(() => {
                  const errata = erratas?.find((linea) => linea.citaId === cita.id && linea.corregido);

                  if (!errata || !onCorrige) return null;

                  /* En su propia línea, bajo el nombre (12/11/2026, expertos): antes se comía el nombre de la cita. */
                  return (
                    <span className="basis-full pl-[56px]">
                      <button
                        type="button"
                        onClick={() => onCorrige(errata)}
                        title={`Corregir a «${errata.corregido}»`}
                        className="max-w-full rounded-full border border-amber-400/50 px-2 py-px text-left text-[12px] font-semibold text-amber-300 transition hover:bg-amber-400/10"
                      >
                        ¿{errata.corregido}?
                      </button>
                    </span>
                  );
                })()}
              </li>
            ))}
        </ol>
      )}

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
              enfoca={recien === cita.id}
              onCambia={(parche, sinCadena) => cambia(cita.id, parche, sinCadena)}
              onQuita={() =>
                onCambiaCitas(citas.filter((item) => item.id !== cita.id))
              }
              onDuplica={() =>
                onCambiaCitas([
                  ...citas,
                  { ...cita, id: nuevoId("CI"), minuto: cita.minuto + 30, valoracion: undefined },
                ])
              }
              onMueveA={(destino) => onMueveCita(cita.id, destino)}
              lugares={lugares}
              estadoTrayecto={estados[cita.id]}
              onCalcula={(parche) => onCalcula({ ...cita, ...parche })}
              onDuracionManual={(minutos) => onDuracionManual(cita.id, minutos)}
            />
          ))}

          {/*
          | Las de siempre, de un toque y ya a su hora: el día del partido, a
          | su distancia del saque inicial; cualquier otro, a la hora de
          | siempre. Es lo que evita escribir «Merienda» y calcular 18:30 cada
          | semana. Desde el 11/11/2026 son los eventos de la paleta, con su
          | emoticono (y también se arrastran desde la paleta de arriba).
          */}
          <div className="flex flex-wrap items-center gap-1.5 pt-1">
            <Button icon={Plus} onClick={anade}>
              Añadir cita
            </Button>

            <span className="ml-1 text-[11px] uppercase tracking-[0.16em] text-white/30">
              Rápidas
            </span>

            {EVENTOS_PALETA.map((evento) => (
              <button
                key={evento.clave}
                type="button"
                onClick={() => onEvento(evento)}
                title={`Añadir «${rotuloEvento(evento)}» a este día`}
                className="flex items-center gap-1 rounded-full border border-white/10 px-2 py-0.5 text-[11px] text-white/60 transition hover:border-[#C8A96B]/50 hover:text-white"
                style={{ borderLeft: `3px solid ${TIPO_CITA[evento.tipo].color}` }}
              >
                <span aria-hidden>{evento.emoji}</span>
                {rotuloEvento(evento)}
              </button>
            ))}
          </div>
        </div>
      )}
    </section>
  );
}

/* ------------------------------------------------------------------ */
/*  EL EDITOR                                                          */
/* ------------------------------------------------------------------ */

/**
 * Si de `antes` a `despues` sólo ha cambiado el texto o la nota de UNA cita,
 * su clave («id:texto»); si no, `null`. Así se agrupan las letras en un paso.
 */
function soloTextoDe(antes: DiaViaje[], despues: DiaViaje[]): string | null {
  if (antes.length !== despues.length) return null;

  let clave: string | null = null;

  for (let i = 0; i < antes.length; i += 1) {
    const a = antes[i];
    const d = despues[i];

    if (a === d) continue;

    if (a.id !== d.id || a.fecha !== d.fecha || a.titulo !== d.titulo || a.citas.length !== d.citas.length) return null;

    for (let k = 0; k < a.citas.length; k += 1) {
      const x = a.citas[k];
      const y = d.citas[k];

      if (x === y) continue;

      if (x.id !== y.id || x.minuto !== y.minuto || clave) return null;

      const campos = x.texto !== y.texto ? "texto" : x.nota !== y.nota ? "nota" : "";

      if (!campos || JSON.stringify({ ...x, texto: "", nota: "" }) !== JSON.stringify({ ...y, texto: "", nota: "" })) return null;

      clave = `${x.id}:${campos}`;
    }
  }

  return clave;
}

export function EditorHorario({
  viaje,
  onCambio,
  copiado,
  onCopiado,
  lugares,
  enfoque,
  erratas,
  onCorrige,
}: {
  viaje: Desplazamiento;
  onCambio: (dias: DiaViaje[]) => void;
  /**
   * Las citas que parecen mal escritas (`avisosHorario`, clave «erratas»): se
   * marcan en su fila con la corrección, que pulsa el analista (12/11/2026).
   */
  erratas?: LineaAviso[];
  onCorrige?: (linea: LineaAviso) => void;
  /**
   * Lo copiado de un día. Vive en la página y no aquí para poder pegarlo en
   * OTRO viaje: se copia el día de la víspera de Teruel, se cambia de partido
   * y se pega.
   */
  copiado: DiaCopiado | null;
  onCopiado: (copiado: DiaCopiado | null) => void;
  /** Las fotos de los lugares fijos de Madrid (Valdebebas, Atocha…). */
  lugares?: Record<string, ImagenViaje>;
  /**
   * La cita a la que hay que llevar (12/11/2026): «Ver» en un aviso de
   * «Revisa el horario» abre su día, la centra y la resalta. `n` cambia en
   * cada petición, para poder pedir la misma cita dos veces.
   */
  enfoque?: { diaId: string; citaId: string; n: number } | null;
}) {
  const dias = viaje.dias;

  /*
  | Lo último que se ha visto, para lo que llega tarde (11/11/2026): la
  | duración de un trayecto vuelve del servidor un segundo después, y para
  | entonces el horario puede haber cambiado. Se aplica sobre lo de AHORA.
  */
  const diasRef = useRef(dias);
  const viajeRef = useRef(viaje);

  useEffect(() => {
    diasRef.current = dias;
    viajeRef.current = viaje;
  }, [dias, viaje]);

  const minutoPartido = aMinutos(viaje.hora);

  const [arrastre, setArrastre] = useState<Arrastre | null>(null);

  /* Cambiar una hora corre las de detrás (11/11/2026); se puede apagar. */
  const [encadenar, setEncadenar] = useState(true);
  /* 12/11/2026 (expertos): las 21 citas de la paleta, plegadas tras «Añadir cita», también en escritorio. */
  const [paleta, setPaleta] = useState(false);

  /* Por cita: «calculando» o por qué no se pudo calcular su trayecto. */
  const [estados, setEstados] = useState<Record<string, string>>({});
  /*
  | 11/11/2026: los días abren PLEGADOS, en lectura (hora y qué es), y se
  | abre el que se va a tocar con «Editar». Se apuntan los abiertos, no los
  | plegados: así un día que llega después (la carga del guardado, uno
  | replicado) también sale plegado. Un día sin citas se ve siempre abierto.
  */
  const [abiertos, setAbiertos] = useState<string[]>([]);
  const estaPlegado = (dia: DiaViaje) => dia.citas.length > 0 && !abiertos.includes(dia.id);

  /*
  | Llevar a una cita desde un aviso (12/11/2026): se abre su día durante el
  | render (el patrón de React para ajustar estado a una prop) y, ya pintada,
  | se centra, se resalta un momento y se pone el cursor en su texto.
  */
  const [enfoqueVisto, setEnfoqueVisto] = useState(0);

  if (enfoque && enfoque.n !== enfoqueVisto) {
    setEnfoqueVisto(enfoque.n);

    if (!abiertos.includes(enfoque.diaId)) setAbiertos([...abiertos, enfoque.diaId]);
  }

  useEffect(() => {
    if (!enfoque) return;

    let quita: number | undefined;

    const reloj = window.setTimeout(() => {
      const fila = document.getElementById(`cita-${enfoque.citaId}`);

      if (!fila) return;

      fila.scrollIntoView({ behavior: "smooth", block: "center" });
      fila.classList.add("ring-2", "ring-[#C8A96B]");
      fila.querySelector<HTMLInputElement>("input[data-texto-cita]")?.focus({ preventScroll: true });

      quita = window.setTimeout(() => fila.classList.remove("ring-2", "ring-[#C8A96B]"), 2600);
    }, 150);

    return () => {
      window.clearTimeout(reloj);
      if (quita) window.clearTimeout(quita);
    };
  }, [enfoque]);

  /* La cita recién añadida a mano, para abrirla con el cursor dentro. */
  const [recien, setRecien] = useState<string | null>(null);

  /*
  | Deshacer, de una sola pila y en memoria: casi todo lo de esta pantalla
  | —una plantilla, un pegado, un día borrado— rehace el trabajo de media hora
  | con un clic, y sin vuelta atrás eso da miedo de usar. No se guarda entre
  | sesiones a propósito: lo que vale es el documento, no el camino.
  */
  /*
  | Cada paso recuerda la fecha y la hora del partido con las que se dio
  | (19/10/2026): si después se cambian desde arriba, deshacer devolvería los
  | días con las fechas viejas, así que esos pasos ya no se deshacen.
  */
  const pila = useRef<{ dias: DiaViaje[]; ancla: string; texto: string | null }[]>([]);

  const [pasos, setPasos] = useState(0);

  const anclaPila = `${viaje.fecha}|${viaje.hora}`;

  const guarda = (siguientes: DiaViaje[], aviso?: string) => {
    /*
    | Escribir en una cita es UN paso, no uno por letra (19/10/2026): antes
    | veinte letras llenaban la pila y un día borrado ya no se recuperaba.
    */
    const actuales = diasRef.current;
    const texto = soloTextoDe(actuales, siguientes);
    const ultimo = pila.current[pila.current.length - 1];

    if (!(texto && ultimo?.texto === texto && ultimo.ancla === anclaPila)) {
      pila.current = [...pila.current.slice(-19), { dias: actuales, ancla: anclaPila, texto }];
      setPasos(pila.current.length);
    }

    /* Dos cambios seguidos en el mismo clic (soltar y calcular) ven el primero. */
    diasRef.current = siguientes;

    onCambio(siguientes);

    if (aviso) toast.success(aviso);
  };

  /* ------------------------ TRAYECTOS (11/11/2026) ------------------------ */

  /** Aplica un cambio a una cita del horario de ahora, con encadenado si toca. */
  const parcheaCita = (citaId: string, parche: Partial<CitaHorario>, aviso?: string) => {
    const actuales = diasRef.current;
    const dia = actuales.find((uno) => uno.citas.some((cita) => cita.id === citaId));

    if (!dia) return;

    const citas = encadenar
      ? encadenaCitas(dia.citas, citaId, parche).citas
      : dia.citas.map((cita) => (cita.id === citaId ? { ...cita, ...parche } : cita));

    guarda(
      actuales.map((uno) => (uno.id === dia.id ? conCitas(uno, citas) : uno)),
      aviso,
    );
  };

  /**
   * Lo que dura el trayecto de una cita: la memoria del analista o, en
   * autobús, OSRM. Al llegar, la duración se pone y la llegada (y lo que
   * cuelga de ella) se recoloca. Una duración escrita a mano no se pisa.
   */
  const calcula = async (cita: CitaHorario, forzar = false) => {
    if (!cita.desde || !cita.hasta) return;

    setEstados((actual) => ({ ...actual, [cita.id]: "calculando" }));

    const respuesta = await pideTrayecto(cita, viajeRef.current, lugares);

    if ("error" in respuesta) {
      setEstados((actual) => ({ ...actual, [cita.id]: respuesta.error }));

      return;
    }

    setEstados((actual) => {
      const resto = { ...actual };

      delete resto[cita.id];

      return resto;
    });

    const ahora = diasRef.current.flatMap((dia) => dia.citas).find((uno) => uno.id === cita.id);

    /* Una duración escrita a mano no se pisa sola; con «Calcular» o al cambiar los lugares, sí. */
    if (!ahora || (!forzar && ahora.duracionFuente === "manual" && ahora.duracion)) return;

    if (ahora.duracion === respuesta.minutos && ahora.duracionFuente === respuesta.fuente) return;

    parcheaCita(
      cita.id,
      { duracion: respuesta.minutos, duracionFuente: respuesta.fuente },
      `${emojiDeCita(ahora) || "🚌"} ${nombreLugar(ahora.desde, viajeRef.current)} → ${nombreLugar(ahora.hasta, viajeRef.current)}: ${comoDuracion(respuesta.minutos)}${
        respuesta.km ? ` · ${respuesta.km} km` : ""
      }${respuesta.fuente === "memoria" ? " (la que pusiste la otra vez)" : ""}`,
    );
  };

  /** La duración escrita a mano: se pone, se encadena y se recuerda para ese par. */
  const duracionManual = (citaId: string, minutos: number | null) => {
    const cita = diasRef.current.flatMap((dia) => dia.citas).find((uno) => uno.id === citaId);

    if (!cita) return;

    parcheaCita(citaId, minutos === null ? { duracion: undefined, duracionFuente: undefined } : { duracion: minutos, duracionFuente: "manual" });

    void recuerdaDuracion(cita, viajeRef.current, minutos, lugares).then((hecho) => {
      if (hecho && minutos !== null) {
        toast.success(`Recordado: ${nombreLugar(cita.desde, viajeRef.current)} → ${nombreLugar(cita.hasta, viajeRef.current)} en ${comoDuracion(minutos)}`, {
          description: "Los próximos viajes con este trayecto la traerán así.",
        });
      }
    });
  };

  /** Un evento de la paleta en un día: con su hora, y si es una salida en bus, con su trayecto calculado. */
  const anadeEvento = (diaId: string, evento: EventoPaleta) => {
    const dia = diasRef.current.find((uno) => uno.id === diaId);

    if (!dia) return;

    const nuevas = citasDeEvento(evento, dia, viajeRef.current);

    setAbiertos((actual) => (actual.includes(diaId) ? actual : [...actual, diaId]));

    guarda(diasRef.current.map((uno) => (uno.id === diaId ? conCitas(uno, [...uno.citas, ...nuevas]) : uno)));

    if (evento.clave === "personal") setRecien(nuevas[0].id);

    const salida = nuevas.find((cita) => esSalida(cita) && cita.desde && cita.hasta);

    if (salida) void calcula(salida);
  };

  const deshace = () => {
    const previo = pila.current.pop();

    if (previo && previo.ancla !== anclaPila) {
      pila.current = [];
      setPasos(0);
      toast.message("No se puede deshacer", { description: "La fecha o la hora del partido han cambiado después: deshacerlo dejaría los días mal colocados." });

      return;
    }

    setPasos(pila.current.length);

    if (!previo) return;

    onCambio(previo.dias);

    toast.success("Deshecho");
  };

  const cambiaDia = (id: string, parche: Partial<DiaViaje>) =>
    guarda(dias.map((dia) => (dia.id === id ? { ...dia, ...parche } : dia)));

  const cambiaCitas = (id: string, citas: CitaHorario[]) => {
    /* El día vacío se ve abierto; al ponerle la primera cita se queda abierto (si no, se plegaría con el cursor dentro). */
    if (!dias.find((dia) => dia.id === id)?.citas.length) {
      setAbiertos((actual) => (actual.includes(id) ? actual : [...actual, id]));
    }

    guarda(dias.map((dia) => (dia.id === id ? conCitas(dia, citas) : dia)));
  };

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

    if (activo.tipo === "paleta" && destino.tipo === "zona") {
      const evento = EVENTO_POR_CLAVE.get(activo.clave);

      if (evento) anadeEvento(destino.diaId, evento);

      return;
    }

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

  const eventoArrastrado = arrastre?.tipo === "paleta" ? (EVENTO_POR_CLAVE.get(arrastre.clave) ?? null) : null;

  /* ---------------------------- LA VISTA --------------------------- */

  const sinDiaDePartido = dias.length > 0 && indiceDiaPartido(viaje) < 0;

  /* A qué hora está montado el día del partido, y cuánto se aparta de la hora. */
  const ancla = anclaDelHorario(viaje);

  const saltoHora =
    ancla !== null && minutoPartido !== null ? minutoPartido - ancla : 0;

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
          ? "Escribe la hora del partido y los días se montan solos"
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
      {/*
      | 11/11/2026: rehacer el viaje y añadir u ordenar días se usa una vez por
      | viaje; con días montados va plegado. Sin días, a la vista.
      */}
      {(() => {
        const herramientas = (
          <>
      {/* -------------------- PLANTILLAS DE VIAJE ------------------- */}

      <div className="flex flex-wrap items-center gap-2">
        <span className="text-[11px] uppercase tracking-[0.18em] text-white/40">
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
        <span className="text-[11px] uppercase tracking-[0.18em] text-white/40">
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

      </div>
          </>
        );

        if (dias.length === 0) return herramientas;

        return (
          <details className="rounded-xl border border-white/10 bg-white/[0.02] px-3 py-2">
            <summary className="cursor-pointer select-none text-[13px] font-semibold text-white/70 hover:text-white">
              Rehacer el viaje, añadir u ordenar días
            </summary>
            <div className="mt-2 pb-1">{herramientas}</div>
          </details>
        );
      })()}

      {dias.some((dia) => dia.citas.length > 0) && (
        <div className="mt-3 flex flex-wrap items-center gap-2">
          <span className="text-[13px] text-white/55">
            Cada día se lee plegado; «Editar» abre el que vas a cambiar.
          </span>

          <Button
            onClick={() =>
              setAbiertos(
                dias.every((dia) => !estaPlegado(dia)) ? [] : dias.map((dia) => dia.id),
              )
            }
          >
            {dias.every((dia) => !estaPlegado(dia)) ? "Plegar todos" : "Abrir todos"}
          </Button>
        </div>
      )}

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

      {/*
      | El día del partido montado para otra hora.
      |
      | Pasa con los viajes guardados antes de que la hora moviera el día sola,
      | y con cualquier cambio hecho a mano en la cita del partido. Se dice y
      | se arregla de un toque, en vez de dejar que la hoja salga con el
      | partido a una hora y la charla calculada para otra.
      */}
      {saltoHora !== 0 && ancla !== null && minutoPartido !== null && (
        <div className="mt-3">
          <Notice
            tone="warn"
            title={`El día del partido está montado para las ${aHora(ancla)}`}
          >
            <p>
              El partido es a las {aHora(minutoPartido)}, pero la cita «Partido»
              de ese día está a las {aHora(ancla)}: la comida, la charla y el
              calentamiento están calculados para esa otra hora.
            </p>

            <div className="mt-2">
              <Button
                icon={CalendarClock}
                onClick={() =>
                  guarda(
                    mueveDiaPartido(viaje, saltoHora),
                    `Día del partido movido ${comoDesfase(saltoHora)}. Se puede deshacer.`,
                  )
                }
              >
                Mover el día del partido {comoDesfase(saltoHora)}
              </Button>
            </div>
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
        {/*
        | LA PALETA (11/11/2026): los eventos de siempre con su emoticono, para
        | arrastrarlos al día como en un chat. Con un toque van al día del
        | partido (o al primero); cada uno trae su hora y, las salidas en bus,
        | lo que dura el trayecto. Encima, el interruptor del encadenado.
        */}
        {dias.length > 0 && (
          <div className="mt-3 rounded-xl border border-white/10 bg-white/[0.02] p-2.5">
            <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
              <button
                type="button"
                onClick={() => setPaleta((abierta) => !abierta)}
                aria-expanded={paleta}
                className="flex items-center gap-1.5 rounded-full border border-[#C8A96B]/45 px-3 py-1 text-[13px] font-semibold text-[#C8A96B] transition hover:bg-[#C8A96B]/10"
              >
                <Plus size={14} />
                Añadir cita
                <ChevronRight size={14} className={`transition ${paleta ? "rotate-90" : ""}`} />
              </button>
              {paleta && (
                <span className="text-[13px] text-white/50">Arrástrala al día, o tócala para ponerla en el día del partido</span>
              )}

              <label className="ml-auto flex items-center gap-2 text-[12px] text-white/65" title="Al cambiar la hora o la duración de una cita, las de detrás se corren lo mismo hasta la primera fijada o el partido">
                <input
                  type="checkbox"
                  checked={encadenar}
                  onChange={(evento) => setEncadenar(evento.target.checked)}
                  className="h-4 w-4 accent-[#C8A96B]"
                />
                Encadenar: mover las de detrás
              </label>
            </div>

            {paleta && (
            <div className="mt-2 flex flex-wrap gap-1.5">
              {EVENTOS_PALETA.map((evento) => {
                const destino = dias[Math.max(0, indiceDiaPartido(viaje))] ?? dias[0];

                return (
                  <ChipPaleta
                    key={evento.clave}
                    evento={evento}
                    titulo={`Arrástralo a un día, o tócalo para ponerlo en el ${diaCorto(destino.fecha).toLowerCase() || "día del partido"}`}
                    onToca={() => anadeEvento(destino.id, evento)}
                  />
                );
              })}
            </div>
            )}
          </div>
        )}

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
                plegado={estaPlegado(dia)}
                copiado={copiado}
                recien={recien}
                onRecien={setRecien}
                encadenar={encadenar}
                lugares={lugares}
                estados={estados}
                onCalcula={(cita) => void calcula(cita, true)}
                onDuracionManual={duracionManual}
                onEvento={(evento) => anadeEvento(dia.id, evento)}
                erratas={erratas?.filter((linea) => linea.diaId === dia.id)}
                onCorrige={onCorrige}
                arrastre={arrastre}
                onPliega={() =>
                  setAbiertos(
                    abiertos.includes(dia.id)
                      ? abiertos.filter((item) => item !== dia.id)
                      : [...abiertos, dia.id],
                  )
                }
                onCambiaDia={(parche) => cambiaDia(dia.id, parche)}
                onCambiaCitas={(citas) => cambiaCitas(dia.id, citas)}
                onSube={() => guarda(mueveEnLista(dias, indice, indice - 1))}
                onBaja={() => guarda(mueveEnLista(dias, indice, indice + 1))}
                onDuplica={() => {
                  /* En el primer día libre (19/10/2026): replicar la víspera caía en el día del partido. */
                  const copia = duplicaDia(dia, dias.map((uno) => uno.fecha));

                  guarda(
                    [
                      ...dias.slice(0, indice + 1),
                      copia,
                      ...dias.slice(indice + 1),
                    ],
                    `Día replicado en el ${diaCorto(copia.fecha).toLowerCase()}`,
                  );
                }}
                onElimina={() =>
                  guarda(
                    dias.filter((item) => item.id !== dia.id),
                    `Quitado el día ${diaCorto(dia.fecha).toLowerCase()}. Se puede deshacer.`,
                  )
                }
                onCopia={() => {
                  onCopiado({
                    rotulo: `${
                      diaCorto(dia.fecha).toLowerCase() || `día ${indice + 1}`
                    } · ${viaje.rival || "este viaje"}`,
                    citas: dia.citas,
                  });

                  toast.success(
                    `Copiadas las ${dia.citas.length} citas: pégalas en otro día, también de otro viaje`,
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

          {/*
          | Añadir un día también aquí abajo, y no sólo en la barra de arriba:
          | cuando se acaba de repasar el último día, el sitio donde se busca
          | «uno más» es el final de la lista, no una barra que ha quedado tres
          | pantallas atrás. Dice la fecha que va a crear para no tener que
          | comprobarla después.
          */}
          <button
            type="button"
            onClick={() => anadeDia("despues")}
            className="flex w-full items-center justify-center gap-2 rounded-2xl border border-dashed border-white/15 px-3 py-3 text-xs font-medium text-white/45 transition hover:border-[#C8A96B]/50 hover:text-white/80"
          >
            <CalendarPlus size={14} />

            {dias.length === 0
              ? "Añadir el primer día"
              : `Añadir un día más · ${
                  diaCorto(sumaDias(dias[dias.length - 1].fecha, 1)).toLowerCase() ||
                  "al final"
                }`}
          </button>
        </div>

        <DragOverlay dropAnimation={null}>
          {eventoArrastrado && (
            <div className="flex items-center gap-1.5 rounded-full border border-white/25 bg-[#11161C] px-3 py-1.5 text-[13px] text-white shadow-2xl">
              <span aria-hidden className="text-[16px] leading-none">{eventoArrastrado.emoji}</span>
              {rotuloEvento(eventoArrastrado)}
            </div>
          )}

          {citaArrastrada && (
            <div
              className="flex items-center gap-2 rounded-xl border border-white/25 bg-[#11161C] px-3 py-2 shadow-2xl"
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
            <div className="rounded-xl border border-white/25 bg-[#11161C] px-3 py-2 shadow-2xl">
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
        Las horas se escriben enteras: «1830» vale.
        {abarca > dias.length
          ? ` Ojo: los ${dias.length} días abarcan ${abarca} de calendario, así que hay alguno suelto en medio.`
          : ""}
      </p>
    </Panel>
  );
}
