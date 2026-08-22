"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  FileText,
  Image as ImageIcon,
  Pencil,
  Plus,
  Trash2,
  TriangleAlert,
} from "lucide-react";
import {
  CalendarShell,
  CalendarStat,
  type CalendarLegendItem,
} from "@/components/ui/calendar-shell";
import {
  CalendarDayModal,
  CalendarEmptyState,
} from "@/components/ui/calendar-day-modal";
import { useRemoteDoc } from "@/hooks/useRemoteDoc";
import {
  SEASON_FIRST_DAY,
  SEASON_LAST_DAY,
  buildSeasonMonths,
  currentMonthIndex,
  dateKey,
  parseDateKey,
  recordDateKey,
} from "@/lib/calendar";
import { cn } from "@/lib/utils";

type EventType =
  | "REUNION"
  | "VIAJE"
  | "LOGISTICA"
  | "MEDICO"
  | "INSTITUCIONAL";

interface GeneralEvent {
  id: string;
  fecha: string;
  tipo: EventType;
  titulo: string;
  descripcion: string;
  responsable: string;
  hora: string;
  lugar: string;
  participantes: string;
}

interface EventsDoc {
  events: GeneralEvent[];
}

/** Documento del Área General, fechado en su día de subida por la API. */
type DayFile = {
  url: string;
  name: string;
  created_at: string;
  type: "image" | "pdf";
  /** Día del calendario: el de la subida ("YYYY-MM-DD"). */
  date?: string;
  /** Semana del Área General a la que pertenece ("" si es un archivo suelto). */
  week?: string;
  weekRange?: string;
  month?: string;
};

type FilesByDay = Record<string, { images: DayFile[]; pdfs: DayFile[] }>;

const TYPE_THEMES: Record<
  EventType,
  { label: string; dot: string; stripe: string }
> = {
  REUNION: { label: "Reunión", dot: "bg-sky-400", stripe: "border-l-sky-400" },
  VIAJE: { label: "Viaje", dot: "bg-purple-400", stripe: "border-l-purple-400" },
  LOGISTICA: {
    label: "Logística",
    dot: "bg-yellow-400",
    stripe: "border-l-yellow-400",
  },
  MEDICO: {
    label: "Médico",
    dot: "bg-emerald-400",
    stripe: "border-l-emerald-400",
  },
  INSTITUCIONAL: {
    label: "Institucional",
    dot: "bg-red-400",
    stripe: "border-l-red-400",
  },
};

const EVENT_TYPES = Object.keys(TYPE_THEMES) as EventType[];

const LEGEND: CalendarLegendItem[] = EVENT_TYPES.map((type) => ({
  label: TYPE_THEMES[type].label,
  color: TYPE_THEMES[type].dot,
}));

const EMPTY_FILES = { images: [] as DayFile[], pdfs: [] as DayFile[] };
const EMPTY_DOC: EventsDoc = { events: [] };

const MAX_VISIBLE_PER_DAY = 3;

let idCounter = 0;
function newEventId() {
  idCounter += 1;
  return `ev-${Date.now().toString(36)}-${idCounter.toString(36)}`;
}

export default function CalendarGeneralPage() {
  const months = useMemo(() => buildSeasonMonths(), []);

  const {
    value,
    setValue,
    status,
    localOnly,
  } = useRemoteDoc<EventsDoc>({
    key: "general-calendar:events",
    kind: "general-calendar",
    fallback: EMPTY_DOC,
    debounce: 400,
  });

  const events = useMemo(() => value?.events ?? [], [value]);

  const [currentMonth, setCurrentMonth] = useState(() =>
    currentMonthIndex(months)
  );
  const [filesByDay, setFilesByDay] = useState<FilesByDay>({});

  const [selectedKey, setSelectedKey] = useState<string | null>(null);
  const [editingEvent, setEditingEvent] = useState<GeneralEvent | null>(null);
  const [isCreating, setIsCreating] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [fullscreenImageIndex, setFullscreenImageIndex] = useState<
    number | null
  >(null);

  useEffect(() => {
    let cancelled = false;

    const loadFiles = async () => {
      try {
        const response = await fetch("/api/general-files", {
          cache: "no-store",
        });

        const files: DayFile[] = await response.json();

        if (cancelled || !Array.isArray(files)) return;

        const grouped: FilesByDay = {};

        for (const file of files) {
          // La API ya fecha cada documento por el día en que se subió.
          const day = file.date || dateKey(new Date(file.created_at));

          if (!grouped[day]) grouped[day] = { images: [], pdfs: [] };

          if (file.type === "image") grouped[day].images.push(file);
          else grouped[day].pdfs.push(file);
        }

        setFilesByDay(grouped);
      } catch (error) {
        console.error(error);
      }
    };

    void loadFiles();

    return () => {
      cancelled = true;
    };
  }, []);

  const eventsByDay = useMemo(() => {
    const map = new Map<string, GeneralEvent[]>();

    events.forEach((event) => {
      const key = recordDateKey(event.fecha);
      if (!key) return;

      const list = map.get(key);
      if (list) list.push(event);
      else map.set(key, [event]);
    });

    return map;
  }, [events]);

  const active = months[currentMonth];

  const monthStats = useMemo(() => {
    const inMonth = (key: string) => {
      const date = parseDateKey(key);
      return (
        date.getMonth() === active.month && date.getFullYear() === active.year
      );
    };

    let eventos = 0;
    let dias = 0;

    eventsByDay.forEach((list, key) => {
      if (!inMonth(key)) return;
      eventos += list.length;
      dias += 1;
    });

    let imagenes = 0;
    let pdfs = 0;

    Object.entries(filesByDay).forEach(([key, files]) => {
      if (!inMonth(key)) return;
      imagenes += files.images.length;
      pdfs += files.pdfs.length;
    });

    return { eventos, dias, imagenes, pdfs };
  }, [eventsByDay, filesByDay, active]);

  const selectedDate = selectedKey ? parseDateKey(selectedKey) : null;
  const selectedEvents = selectedKey ? eventsByDay.get(selectedKey) ?? [] : [];
  const selectedFiles = selectedKey
    ? filesByDay[selectedKey] ?? EMPTY_FILES
    : EMPTY_FILES;

  const selectedFilesCount =
    selectedFiles.images.length + selectedFiles.pdfs.length;

  const closeModal = useCallback(() => {
    setSelectedKey(null);
    setIsCreating(false);
    setEditingEvent(null);
    setDeletingId(null);
    setFullscreenImageIndex(null);
  }, []);

  const openDay = useCallback((key: string) => {
    setSelectedKey(key);
    setIsCreating(false);
    setEditingEvent(null);
    setDeletingId(null);
  }, []);

  const shiftSelectedDay = useCallback(
    (offset: number) => {
      if (!selectedKey) return;

      const date = parseDateKey(selectedKey);
      date.setDate(date.getDate() + offset);

      if (date < SEASON_FIRST_DAY || date > SEASON_LAST_DAY) return;

      const monthIdx = months.findIndex(
        (m) => m.month === date.getMonth() && m.year === date.getFullYear()
      );

      if (monthIdx !== -1) setCurrentMonth(monthIdx);
      openDay(dateKey(date));
    },
    [selectedKey, months, openDay]
  );

  const canShift = (offset: number) => {
    if (!selectedKey) return false;

    const date = parseDateKey(selectedKey);
    date.setDate(date.getDate() + offset);

    return date >= SEASON_FIRST_DAY && date <= SEASON_LAST_DAY;
  };

  const saveEvent = (event: GeneralEvent) =>
    setValue((current) => {
      const list = current?.events ?? [];

      const exists = list.some((item) => item.id === event.id);

      return {
        events: exists
          ? list.map((item) => (item.id === event.id ? event : item))
          : [...list, event],
      };
    });

  const deleteEvent = (id: string) =>
    setValue((current) => ({
      events: (current?.events ?? []).filter((item) => item.id !== id),
    }));

  return (
    <CalendarShell
      eyebrow="RMCF CASTILLA OPERATIVA"
      title="Calendario de Operativa General"
      months={months}
      monthIndex={currentMonth}
      onMonthChange={setCurrentMonth}
      loading={status === "loading"}
      keyboardEnabled={!selectedKey}
      legend={LEGEND}
      stats={
        <>
          <CalendarStat
            label="Eventos"
            value={monthStats.eventos}
            hint={`${monthStats.dias} días con actividad`}
          />
          <CalendarStat label="Días programados" value={monthStats.dias} />
          <CalendarStat label="Imágenes" value={monthStats.imagenes} />
          <CalendarStat label="PDFs" value={monthStats.pdfs} />
        </>
      }
      renderDay={({ key }) => {
        const dayEvents = eventsByDay.get(key) ?? [];
        const dayFiles = filesByDay[key] ?? EMPTY_FILES;

        const imageCount = dayFiles.images.length;
        const pdfCount = dayFiles.pdfs.length;

        const visible = dayEvents.slice(0, MAX_VISIBLE_PER_DAY);
        const hidden = dayEvents.length - visible.length;

        return {
          hasContent:
            dayEvents.length > 0 || imageCount > 0 || pdfCount > 0,
          onClick: () => openDay(key),
          badges: (
            <div className="flex items-center gap-1">
              {imageCount > 0 && (
                <span className="flex items-center gap-1 rounded-full border border-sky-500/30 bg-sky-500/15 px-1.5 py-0.5">
                  <ImageIcon className="h-3 w-3 text-sky-300" />
                  <span className="text-[10px] font-medium text-sky-200">
                    {imageCount}
                  </span>
                </span>
              )}

              {pdfCount > 0 && (
                <span className="flex items-center gap-1 rounded-full border border-amber-500/30 bg-amber-500/15 px-1.5 py-0.5">
                  <FileText className="h-3 w-3 text-amber-300" />
                  <span className="text-[10px] font-medium text-amber-200">
                    {pdfCount}
                  </span>
                </span>
              )}
            </div>
          ),
          children:
            dayEvents.length > 0 ? (
              <>
                {visible.map((event) => (
                  <div
                    key={event.id}
                    className={cn(
                      "rounded-md border border-l-4 border-[#C8A96B]/20 bg-[#C8A96B]/10 px-1.5 py-1",
                      TYPE_THEMES[event.tipo]?.stripe ?? "border-l-white/30"
                    )}
                  >
                    <p className="truncate text-[9px] font-semibold md:text-[11px]">
                      {event.titulo}
                    </p>

                    <p className="text-[8px] text-white/60 md:text-[9px]">
                      {TYPE_THEMES[event.tipo]?.label ?? event.tipo}
                      {event.hora ? ` · ${event.hora}` : ""}
                    </p>

                    <p className="truncate text-[8px] text-white/40 md:text-[10px]">
                      {event.responsable}
                    </p>
                  </div>
                ))}

                {hidden > 0 && (
                  <p className="pt-0.5 text-center text-[10px] font-medium text-[#C8A96B]/80">
                    +{hidden} más
                  </p>
                )}
              </>
            ) : undefined,
        };
      }}
    >
      {localOnly && (
        <div className="px-4 pb-6 md:px-8">
          <p className="flex items-start gap-2 rounded-xl border border-amber-400/30 bg-amber-400/5 px-4 py-3 text-sm text-amber-200/90">
            <TriangleAlert size={16} className="mt-0.5 shrink-0" />
            <span>
              Los eventos se están guardando solo en este dispositivo. Ejecuta{" "}
              <code className="rounded bg-black/40 px-1">
                supabase/app_documents.sql
              </code>{" "}
              en Supabase para compartirlos con el resto del staff.
            </span>
          </p>
        </div>
      )}

      {selectedDate && selectedKey && (
        <CalendarDayModal
          date={selectedDate}
          size="lg"
          subtitle={[
            `${selectedEvents.length} ${
              selectedEvents.length === 1 ? "evento" : "eventos"
            }`,
            selectedFilesCount > 0
              ? `${selectedFilesCount} ${
                  selectedFilesCount === 1 ? "documento" : "documentos"
                }`
              : null,
          ]
            .filter(Boolean)
            .join(" · ")}
          onClose={closeModal}
          onPrev={() => shiftSelectedDay(-1)}
          onNext={() => shiftSelectedDay(1)}
          canPrev={canShift(-1)}
          canNext={canShift(1)}
          keyboardEnabled={fullscreenImageIndex === null}
          actions={
            !isCreating &&
            !editingEvent && (
              <button
                type="button"
                onClick={() => {
                  setIsCreating(true);
                  setEditingEvent(null);
                }}
                className="flex items-center gap-2 rounded-xl border border-[#C8A96B] bg-[#C8A96B]/10 px-4 py-2 text-sm font-medium transition hover:bg-[#C8A96B]/20"
              >
                <Plus size={16} />
                Nuevo evento
              </button>
            )
          }
        >
          {(isCreating || editingEvent) && (
            <EventForm
              key={editingEvent?.id ?? "nuevo"}
              initialData={editingEvent}
              onCancel={() => {
                setIsCreating(false);
                setEditingEvent(null);
              }}
              onSave={(form) => {
                saveEvent({
                  ...form,
                  id: editingEvent?.id ?? newEventId(),
                  fecha: selectedKey,
                });

                setIsCreating(false);
                setEditingEvent(null);
              }}
            />
          )}

          <FilesSection
            files={selectedFiles}
            onOpenImage={setFullscreenImageIndex}
          />

          <div className="space-y-3">
            {selectedEvents.length === 0 &&
              !isCreating &&
              !editingEvent &&
              selectedFiles.images.length === 0 &&
              selectedFiles.pdfs.length === 0 && (
                <CalendarEmptyState>
                  Sin operativa programada este día.
                </CalendarEmptyState>
              )}

            {selectedEvents.map((event) => {
              const theme = TYPE_THEMES[event.tipo];
              const confirming = deletingId === event.id;

              return (
                <div
                  key={event.id}
                  className={cn(
                    "rounded-xl border border-l-4 border-white/10 bg-[#10151C] p-4",
                    theme?.stripe ?? "border-l-white/30"
                  )}
                >
                  <p className="text-lg font-semibold">{event.titulo}</p>

                  <p className="mt-1 text-sm text-[#C8A96B]">
                    {theme?.label ?? event.tipo}
                    {event.hora ? ` · ${event.hora}` : ""}
                    {event.responsable ? ` · ${event.responsable}` : ""}
                  </p>

                  <div className="mt-3 space-y-2">
                    {event.descripcion && (
                      <p className="text-white/80">{event.descripcion}</p>
                    )}

                    <div className="flex flex-wrap gap-x-4 text-xs text-white/50">
                      {event.lugar && <span>Lugar: {event.lugar}</span>}
                      {event.participantes && (
                        <span>Participantes: {event.participantes}</span>
                      )}
                    </div>
                  </div>

                  <div className="mt-4 flex flex-wrap gap-2">
                    <button
                      type="button"
                      onClick={() => {
                        setEditingEvent(event);
                        setIsCreating(false);
                        setDeletingId(null);
                      }}
                      className="flex items-center gap-2 rounded-lg border border-[#C8A96B] px-3 py-2 text-sm transition hover:bg-[#C8A96B]/10"
                    >
                      <Pencil size={14} />
                      Editar
                    </button>

                    {confirming ? (
                      <>
                        <button
                          type="button"
                          onClick={() => {
                            setDeletingId(null);
                            deleteEvent(event.id);
                          }}
                          className="rounded-lg border border-red-500 bg-red-500/15 px-3 py-2 text-sm text-red-300"
                        >
                          Confirmar borrado
                        </button>

                        <button
                          type="button"
                          onClick={() => setDeletingId(null)}
                          className="rounded-lg border border-white/10 px-3 py-2 text-sm text-white/60"
                        >
                          Cancelar
                        </button>
                      </>
                    ) : (
                      <button
                        type="button"
                        onClick={() => setDeletingId(event.id)}
                        className="flex items-center gap-2 rounded-lg border border-red-500/60 px-3 py-2 text-sm text-red-400 transition hover:bg-red-500/10"
                      >
                        <Trash2 size={14} />
                        Eliminar
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>

          {fullscreenImageIndex !== null && (
            <ImageViewer
              images={selectedFiles.images}
              index={fullscreenImageIndex}
              onIndexChange={setFullscreenImageIndex}
              onClose={() => setFullscreenImageIndex(null)}
            />
          )}
        </CalendarDayModal>
      )}
    </CalendarShell>
  );
}

function FilesSection({
  files,
  onOpenImage,
}: {
  files: { images: DayFile[]; pdfs: DayFile[] };
  onOpenImage: (index: number) => void;
}) {
  if (files.images.length === 0 && files.pdfs.length === 0) return null;

  return (
    <div className="mb-6 space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-xs uppercase tracking-[0.2em] text-white/40">
          Documentación del Área General
        </p>

        <Link
          href="/general"
          className="text-xs text-[#C8A96B] transition hover:underline"
        >
          Abrir Área General →
        </Link>
      </div>

      {files.images.length > 0 && (
        <div>
          <h3 className="mb-3 flex items-center gap-2 text-lg font-semibold">
            <ImageIcon size={18} className="text-[#C8A96B]" />
            Imágenes ({files.images.length})
          </h3>

          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
            {files.images.map((img, index) => (
              <button
                key={img.url}
                type="button"
                onClick={() => onOpenImage(index)}
                className="cursor-zoom-in overflow-hidden rounded-xl border border-white/10 bg-[#10151C] text-left transition hover:border-[#C8A96B]/40"
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={img.url}
                  alt={img.name}
                  loading="lazy"
                  className="h-32 w-full object-cover transition hover:scale-[1.03]"
                />

                <FileOrigin file={img} className="px-2 py-1.5" />
              </button>
            ))}
          </div>
        </div>
      )}

      {files.pdfs.length > 0 && (
        <div>
          <h3 className="mb-3 flex items-center gap-2 text-lg font-semibold">
            <FileText size={18} className="text-[#C8A96B]" />
            PDFs ({files.pdfs.length})
          </h3>

          <div className="space-y-2">
            {files.pdfs.map((pdf) => (
              <a
                key={pdf.url}
                href={pdf.url}
                target="_blank"
                rel="noreferrer"
                className="block rounded-xl border border-white/10 bg-[#10151C] p-3 transition hover:border-[#C8A96B]/40"
              >
                <div className="flex items-center gap-3">
                  <FileText className="shrink-0 text-[#C8A96B]" />

                  <span className="min-w-0">
                    <span className="block truncate">{pdf.name}</span>
                    <FileOrigin file={pdf} />
                  </span>
                </div>
              </a>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

/** "Semana 3 · 13 Jul — 19 Jul": de qué semana del área viene el documento. */
function FileOrigin({ file, className }: { file: DayFile; className?: string }) {
  if (!file.week) return null;

  return (
    <span
      className={cn(
        "block truncate text-[10px] text-white/45 md:text-[11px]",
        className
      )}
    >
      {file.week}
      {file.weekRange ? ` · ${file.weekRange}` : ""}
    </span>
  );
}

function ImageViewer({
  images,
  index,
  onIndexChange,
  onClose,
}: {
  images: DayFile[];
  index: number;
  onIndexChange: (index: number) => void;
  onClose: () => void;
}) {
  const image = images[index];

  useEffect(() => {
    const handle = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        onClose();
      }

      if (event.key === "ArrowRight" && images.length > 0) {
        event.preventDefault();
        onIndexChange((index + 1) % images.length);
      }

      if (event.key === "ArrowLeft" && images.length > 0) {
        event.preventDefault();
        onIndexChange((index - 1 + images.length) % images.length);
      }
    };

    window.addEventListener("keydown", handle);
    return () => window.removeEventListener("keydown", handle);
  }, [index, images.length, onIndexChange, onClose]);

  if (!image) return null;

  return (
    <div
      className="fixed inset-0 z-[60] flex items-center justify-center bg-black/95 p-6"
      onClick={onClose}
    >
      <button
        type="button"
        aria-label="Cerrar"
        onClick={onClose}
        className="absolute right-3 top-3 text-3xl text-white/80 transition hover:text-white sm:right-6 sm:top-6"
      >
        ✕
      </button>

      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={image.url}
        alt={image.name}
        className="max-h-[86vh] max-w-[78vw] rounded-xl object-contain sm:max-w-[86vw]"
        onClick={(event) => event.stopPropagation()}
      />

      <div className="absolute bottom-6 left-1/2 -translate-x-1/2 rounded-xl bg-black/60 px-4 py-2 text-sm text-white/70">
        {index + 1} / {images.length}
      </div>
    </div>
  );
}

function EventForm({
  initialData,
  onCancel,
  onSave,
}: {
  initialData?: GeneralEvent | null;
  onCancel: () => void;
  onSave: (data: Omit<GeneralEvent, "id" | "fecha">) => void;
}) {
  const [tipo, setTipo] = useState<EventType>(initialData?.tipo ?? "REUNION");
  const [titulo, setTitulo] = useState(initialData?.titulo ?? "");
  const [descripcion, setDescripcion] = useState(
    initialData?.descripcion ?? ""
  );
  const [responsable, setResponsable] = useState(
    initialData?.responsable ?? ""
  );
  const [hora, setHora] = useState(initialData?.hora ?? "");
  const [lugar, setLugar] = useState(initialData?.lugar ?? "");
  const [participantes, setParticipantes] = useState(
    initialData?.participantes ?? ""
  );

  const [formError, setFormError] = useState<string | null>(null);

  const inputClass =
    "w-full rounded-xl border border-white/10 bg-[#0B0F14] px-3 py-2 outline-none transition focus:border-[#C8A96B]";

  return (
    <div className="mb-6 space-y-4 rounded-2xl border border-white/10 bg-[#10151C] p-4">
      <h3 className="text-lg font-semibold">
        {initialData ? "Editar evento" : "Nuevo evento de operativa"}
      </h3>

      <select
        value={tipo}
        onChange={(event) => setTipo(event.target.value as EventType)}
        aria-label="Tipo de evento"
        className={inputClass}
      >
        {EVENT_TYPES.map((type) => (
          <option key={type} value={type}>
            {TYPE_THEMES[type].label}
          </option>
        ))}
      </select>

      <input
        value={titulo}
        onChange={(event) => setTitulo(event.target.value)}
        placeholder="Título"
        className={inputClass}
      />

      <textarea
        value={descripcion}
        onChange={(event) => setDescripcion(event.target.value)}
        placeholder="Descripción"
        rows={3}
        className={inputClass}
      />

      <div className="grid grid-cols-2 gap-3">
        <input
          value={hora}
          onChange={(event) => setHora(event.target.value)}
          placeholder="Hora"
          className={inputClass}
        />

        <input
          value={lugar}
          onChange={(event) => setLugar(event.target.value)}
          placeholder="Lugar"
          className={inputClass}
        />
      </div>

      <input
        value={responsable}
        onChange={(event) => setResponsable(event.target.value)}
        placeholder="Responsable"
        className={inputClass}
      />

      <input
        value={participantes}
        onChange={(event) => setParticipantes(event.target.value)}
        placeholder="Participantes"
        className={inputClass}
      />

      {formError && <p className="text-sm text-red-400">{formError}</p>}

      <div className="flex justify-end gap-2">
        <button
          type="button"
          onClick={onCancel}
          className="rounded-xl border border-white/10 px-4 py-2"
        >
          Cancelar
        </button>

        <button
          type="button"
          onClick={() => {
            if (!titulo.trim()) {
              setFormError("El título es obligatorio");
              return;
            }

            setFormError(null);

            onSave({
              tipo,
              titulo: titulo.trim(),
              descripcion,
              responsable,
              hora,
              lugar,
              participantes,
            });
          }}
          className="rounded-xl border border-[#C8A96B] bg-[#C8A96B]/10 px-4 py-2 transition hover:bg-[#C8A96B]/20"
        >
          {initialData ? "Guardar cambios" : "Guardar"}
        </button>
      </div>
    </div>
  );
}
