"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { FileText, Image as ImageIcon, Plus, Trash2, Pencil } from "lucide-react";
import { usePlayers } from "@/hooks/usePlayers";
import {
  CalendarShell,
  CalendarStat,
  type CalendarLegendItem,
} from "@/components/ui/calendar-shell";
import {
  CalendarDayModal,
  CalendarEmptyState,
} from "@/components/ui/calendar-day-modal";
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

const APPS_SCRIPT_URL =
  "https://script.google.com/macros/s/AKfycbxCaJ90F28CYdcLVNnI4RZjyQL5IJlXVunEAobWY-Qr6lUL8No9H1B3RdASk83Z_NUd/exec";

type EventType =
  | "FUERZA"
  | "PREVENTIVO"
  | "READAPTACION"
  | "MOVILIDAD"
  | "RECUPERACION";

type ConditionalEvent = {
  ID_EVENTO: string;
  FECHA: string;
  TIPO: EventType;
  TITULO: string;
  DESCRIPCION: string;
  JUGADORES: string;
  RESPONSABLE: string;
  DURACION: string;
  INTENSIDAD: string;
};

type DayFile = {
  url: string;
  name: string;
  created_at: string;
  type: "image" | "pdf";
};

type FilesByDay = Record<string, { images: DayFile[]; pdfs: DayFile[] }>;

const TYPE_THEMES: Record<
  EventType,
  { label: string; dot: string; stripe: string }
> = {
  FUERZA: { label: "Fuerza", dot: "bg-red-400", stripe: "border-l-red-400" },
  PREVENTIVO: {
    label: "Preventivo",
    dot: "bg-emerald-400",
    stripe: "border-l-emerald-400",
  },
  READAPTACION: {
    label: "Readaptación",
    dot: "bg-sky-400",
    stripe: "border-l-sky-400",
  },
  MOVILIDAD: {
    label: "Movilidad",
    dot: "bg-purple-400",
    stripe: "border-l-purple-400",
  },
  RECUPERACION: {
    label: "Recuperación",
    dot: "bg-yellow-400",
    stripe: "border-l-yellow-400",
  },
};

const EVENT_TYPES = Object.keys(TYPE_THEMES) as EventType[];

const LEGEND: CalendarLegendItem[] = EVENT_TYPES.map((type) => ({
  label: TYPE_THEMES[type].label,
  color: TYPE_THEMES[type].dot,
}));

const EMPTY_FILES = { images: [] as DayFile[], pdfs: [] as DayFile[] };

const MAX_VISIBLE_PER_DAY = 3;

export default function CalendarPerformance() {
  const months = useMemo(() => buildSeasonMonths(), []);

  const { players } = usePlayers();

  const [currentMonth, setCurrentMonth] = useState(() =>
    currentMonthIndex(months)
  );
  const [events, setEvents] = useState<ConditionalEvent[]>([]);
  const [filesByDay, setFilesByDay] = useState<FilesByDay>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [selectedKey, setSelectedKey] = useState<string | null>(null);
  const [editingEvent, setEditingEvent] = useState<ConditionalEvent | null>(null);
  const [isCreating, setIsCreating] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [fullscreenImageIndex, setFullscreenImageIndex] = useState<number | null>(
    null
  );

  const reloadEvents = useCallback(async () => {
    const r = await fetch(`${APPS_SCRIPT_URL}?action=condicional`);
    const data = await r.json();

    if (!Array.isArray(data)) throw new Error("Respuesta inesperada");

    setEvents(data);
    return data as ConditionalEvent[];
  }, []);

  useEffect(() => {
    let cancelled = false;

    const load = async () => {
      try {
        await reloadEvents();
        if (!cancelled) setError(null);
      } catch (err) {
        console.error(err);
        if (!cancelled) setError("No se pudieron cargar los trabajos");
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    load();

    return () => {
      cancelled = true;
    };
  }, [reloadEvents]);

  useEffect(() => {
    let cancelled = false;

    const loadFiles = async () => {
      try {
        const response = await fetch("/api/performance-files");
        const files: DayFile[] = await response.json();

        if (cancelled || !Array.isArray(files)) return;

        const grouped: FilesByDay = {};

        for (const file of files) {
          // Fecha LOCAL de subida, para que coincida con la rejilla del calendario.
          const day = dateKey(new Date(file.created_at));

          if (!grouped[day]) grouped[day] = { images: [], pdfs: [] };

          if (file.type === "image") grouped[day].images.push(file);
          else grouped[day].pdfs.push(file);
        }

        setFilesByDay(grouped);
      } catch (err) {
        console.error(err);
      }
    };

    loadFiles();

    return () => {
      cancelled = true;
    };
  }, []);

  /** Eventos agrupados por día. */
  const eventsByDay = useMemo(() => {
    const map = new Map<string, ConditionalEvent[]>();

    events.forEach((event) => {
      const key = recordDateKey(event.FECHA);
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
      const d = parseDateKey(key);
      return d.getMonth() === active.month && d.getFullYear() === active.year;
    };

    let trabajos = 0;
    let dias = 0;

    eventsByDay.forEach((list, key) => {
      if (!inMonth(key)) return;
      trabajos += list.length;
      dias += 1;
    });

    let imagenes = 0;
    let pdfs = 0;

    Object.entries(filesByDay).forEach(([key, files]) => {
      if (!inMonth(key)) return;
      imagenes += files.images.length;
      pdfs += files.pdfs.length;
    });

    return { trabajos, dias, imagenes, pdfs };
  }, [eventsByDay, filesByDay, active]);

  const selectedDate = selectedKey ? parseDateKey(selectedKey) : null;
  const selectedEvents = selectedKey ? eventsByDay.get(selectedKey) ?? [] : [];
  const selectedFiles = selectedKey ? filesByDay[selectedKey] ?? EMPTY_FILES : EMPTY_FILES;

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

  /** Mueve el día seleccionado ±1 dentro de la temporada y sincroniza el mes. */
  const shiftSelectedDay = useCallback(
    (offset: number) => {
      if (!selectedKey) return;

      const d = parseDateKey(selectedKey);
      d.setDate(d.getDate() + offset);

      if (d < SEASON_FIRST_DAY || d > SEASON_LAST_DAY) return;

      const monthIdx = months.findIndex(
        (m) => m.month === d.getMonth() && m.year === d.getFullYear()
      );

      if (monthIdx !== -1) setCurrentMonth(monthIdx);
      openDay(dateKey(d));
    },
    [selectedKey, months, openDay]
  );

  const canShift = (offset: number) => {
    if (!selectedKey) return false;

    const d = parseDateKey(selectedKey);
    d.setDate(d.getDate() + offset);

    return d >= SEASON_FIRST_DAY && d <= SEASON_LAST_DAY;
  };

  async function saveEvent(
    payload: Partial<ConditionalEvent>,
    existing: ConditionalEvent | null
  ) {
    await fetch(APPS_SCRIPT_URL, {
      method: "POST",
      body: JSON.stringify(
        existing
          ? {
              action: "editarEventoCondicional",
              ...existing,
              ...payload,
            }
          : { action: "crearEventoCondicional", ...payload }
      ),
    });

    await reloadEvents();
  }

  async function deleteEvent(id: string) {
    await fetch(APPS_SCRIPT_URL, {
      method: "POST",
      body: JSON.stringify({
        action: "eliminarEventoCondicional",
        ID_EVENTO: id,
      }),
    });

    await reloadEvents();
  }

  return (
    <CalendarShell
      eyebrow="RMCF CASTILLA CONDICIONAL"
      title="Calendario Condicional"
      months={months}
      monthIndex={currentMonth}
      onMonthChange={setCurrentMonth}
      loading={loading}
      keyboardEnabled={!selectedKey}
      legend={LEGEND}
      stats={
        <>
          <CalendarStat
            label="Trabajos"
            value={monthStats.trabajos}
            hint={`${monthStats.dias} días con trabajo`}
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
        const hasContent = dayEvents.length > 0 || imageCount > 0 || pdfCount > 0;

        const visible = dayEvents.slice(0, MAX_VISIBLE_PER_DAY);
        const hidden = dayEvents.length - visible.length;

        return {
          hasContent,
          // Todos los días son clicables: aquí se crean trabajos nuevos.
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
                    key={event.ID_EVENTO}
                    className={cn(
                      "rounded-md border border-l-4 border-[#C8A96B]/20 bg-[#C8A96B]/10 px-1.5 py-1",
                      TYPE_THEMES[event.TIPO]?.stripe ?? "border-l-white/30"
                    )}
                  >
                    <p className="truncate text-[9px] font-semibold md:text-[11px]">
                      {event.TITULO}
                    </p>

                    <p className="text-[8px] text-white/60 md:text-[9px]">
                      {event.TIPO}
                    </p>

                    <p className="truncate text-[8px] text-white/40 md:text-[10px]">
                      {event.RESPONSABLE}
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
      {error && !loading && (
        <div className="px-4 pb-6 md:px-8">
          <p className="rounded-xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-300">
            {error}
          </p>
        </div>
      )}

      {selectedDate && selectedKey && (
        <CalendarDayModal
          date={selectedDate}
          size="lg"
          subtitle={`${selectedEvents.length} ${
            selectedEvents.length === 1
              ? "trabajo programado"
              : "trabajos programados"
          }`}
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
                Nuevo trabajo
              </button>
            )
          }
        >
          {(isCreating || editingEvent) && (
            <EventForm
              // La key reinicia el formulario al cambiar de evento editado.
              key={editingEvent?.ID_EVENTO ?? "nuevo"}
              players={players}
              initialData={editingEvent}
              onCancel={() => {
                setIsCreating(false);
                setEditingEvent(null);
              }}
              onSave={async (form) => {
                await saveEvent({ FECHA: selectedKey, ...form }, editingEvent);

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
                  Sin trabajo condicional programado este día.
                </CalendarEmptyState>
              )}

            {selectedEvents.map((event) => {
              const theme = TYPE_THEMES[event.TIPO];
              const confirming = deletingId === event.ID_EVENTO;

              return (
                <div
                  key={event.ID_EVENTO}
                  className={cn(
                    "rounded-xl border border-l-4 border-white/10 bg-[#10151C] p-4",
                    theme?.stripe ?? "border-l-white/30"
                  )}
                >
                  <p className="text-lg font-semibold">{event.TITULO}</p>

                  <p className="mt-1 text-sm text-[#C8A96B]">
                    {event.TIPO}
                    {event.RESPONSABLE ? ` · ${event.RESPONSABLE}` : ""}
                  </p>

                  <div className="mt-3 space-y-2">
                    {event.DESCRIPCION && (
                      <p className="text-white/80">{event.DESCRIPCION}</p>
                    )}

                    {event.JUGADORES && (
                      <p className="text-xs text-white/50">
                        Jugadores: {event.JUGADORES}
                      </p>
                    )}

                    <div className="flex flex-wrap gap-x-4 text-xs text-white/50">
                      {event.DURACION && <span>Duración: {event.DURACION}</span>}
                      {event.INTENSIDAD && (
                        <span>Intensidad: {event.INTENSIDAD}</span>
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
                          onClick={async () => {
                            setDeletingId(null);
                            await deleteEvent(event.ID_EVENTO);
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
                        onClick={() => setDeletingId(event.ID_EVENTO)}
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
      {files.images.length > 0 && (
        <div>
          <h3 className="mb-3 flex items-center gap-2 text-lg font-semibold">
            <ImageIcon size={18} className="text-[#C8A96B]" />
            Imágenes del día
          </h3>

          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
            {files.images.map((img, i) => (
              <button
                key={img.url}
                type="button"
                onClick={() => onOpenImage(i)}
                className="cursor-zoom-in overflow-hidden rounded-xl border border-white/10 bg-[#10151C] transition hover:border-[#C8A96B]/40"
              >
                <img
                  src={img.url}
                  alt={img.name}
                  loading="lazy"
                  className="h-32 w-full object-cover transition hover:scale-[1.03]"
                />
              </button>
            ))}
          </div>
        </div>
      )}

      {files.pdfs.length > 0 && (
        <div>
          <h3 className="mb-3 flex items-center gap-2 text-lg font-semibold">
            <FileText size={18} className="text-[#C8A96B]" />
            PDFs del día
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
                  <span className="truncate">{pdf.name}</span>
                </div>
              </a>
            ))}
          </div>
        </div>
      )}
    </div>
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
    const handle = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault();
        onClose();
      }

      if (e.key === "ArrowRight" && images.length > 0) {
        e.preventDefault();
        onIndexChange((index + 1) % images.length);
      }

      if (e.key === "ArrowLeft" && images.length > 0) {
        e.preventDefault();
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

      {images.length > 1 && (
        <>
          <button
            type="button"
            aria-label="Imagen anterior"
            onClick={(e) => {
              e.stopPropagation();
              onIndexChange((index - 1 + images.length) % images.length);
            }}
            className="absolute left-1 top-1/2 -translate-y-1/2 px-2 text-4xl text-white/70 transition hover:text-white sm:left-6 sm:text-6xl"
          >
            ‹
          </button>

          <button
            type="button"
            aria-label="Imagen siguiente"
            onClick={(e) => {
              e.stopPropagation();
              onIndexChange((index + 1) % images.length);
            }}
            className="absolute right-1 top-1/2 -translate-y-1/2 px-2 text-4xl text-white/70 transition hover:text-white sm:right-6 sm:text-6xl"
          >
            ›
          </button>
        </>
      )}

      <img
        src={image.url}
        alt={image.name}
        className="max-h-[86vh] max-w-[78vw] rounded-xl object-contain sm:max-w-[86vw]"
        onClick={(e) => e.stopPropagation()}
      />

      <div className="absolute bottom-6 left-1/2 -translate-x-1/2 rounded-xl bg-black/60 px-4 py-2 text-sm text-white/70">
        {index + 1} / {images.length}
      </div>
    </div>
  );
}

function EventForm({
  players,
  initialData,
  onCancel,
  onSave,
}: {
  players: { id: string; nombre: string }[];
  initialData?: ConditionalEvent | null;
  onCancel: () => void;
  onSave: (data: Partial<ConditionalEvent>) => Promise<void>;
}) {
  const [TIPO, setTIPO] = useState<EventType>(initialData?.TIPO ?? "FUERZA");
  const [TITULO, setTITULO] = useState(initialData?.TITULO ?? "");
  const [DESCRIPCION, setDESCRIPCION] = useState(initialData?.DESCRIPCION ?? "");
  const [JUGADORES, setJUGADORES] = useState(initialData?.JUGADORES ?? "");
  const [RESPONSABLE, setRESPONSABLE] = useState(initialData?.RESPONSABLE ?? "");
  const [DURACION, setDURACION] = useState(initialData?.DURACION ?? "");
  const [INTENSIDAD, setINTENSIDAD] = useState(initialData?.INTENSIDAD ?? "");

  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  const inputClass =
    "w-full rounded-xl border border-white/10 bg-[#0B0F14] px-3 py-2 outline-none transition focus:border-[#C8A96B]";

  const handleSave = async () => {
    if (!TITULO.trim()) {
      setFormError("El título es obligatorio");
      return;
    }

    setSaving(true);
    setFormError(null);

    try {
      await onSave({
        TIPO,
        TITULO: TITULO.trim(),
        DESCRIPCION,
        JUGADORES,
        RESPONSABLE,
        DURACION,
        INTENSIDAD,
      });
    } catch (err) {
      console.error(err);
      setFormError("No se pudo guardar. Inténtalo de nuevo.");
      setSaving(false);
    }
  };

  return (
    <div className="mb-6 space-y-4 rounded-2xl border border-white/10 bg-[#10151C] p-4">
      <h3 className="text-lg font-semibold">
        {initialData ? "Editar trabajo condicional" : "Nuevo trabajo condicional"}
      </h3>

      <select
        value={TIPO}
        onChange={(e) => setTIPO(e.target.value as EventType)}
        aria-label="Tipo de trabajo"
        className={inputClass}
      >
        {EVENT_TYPES.map((type) => (
          <option key={type} value={type}>
            {TYPE_THEMES[type].label}
          </option>
        ))}
      </select>

      <input
        value={TITULO}
        onChange={(e) => setTITULO(e.target.value)}
        placeholder="Título"
        className={inputClass}
      />

      <textarea
        value={DESCRIPCION}
        onChange={(e) => setDESCRIPCION(e.target.value)}
        placeholder="Descripción"
        rows={3}
        className={inputClass}
      />

      <div>
        <input
          value={JUGADORES}
          onChange={(e) => setJUGADORES(e.target.value)}
          placeholder="Jugadores (nombres separados por comas)"
          list="players-datalist"
          className={inputClass}
        />

        <datalist id="players-datalist">
          {players.map((p) => (
            <option key={p.id} value={p.nombre} />
          ))}
        </datalist>
      </div>

      <input
        value={RESPONSABLE}
        onChange={(e) => setRESPONSABLE(e.target.value)}
        placeholder="Responsable"
        className={inputClass}
      />

      <div className="grid grid-cols-2 gap-3">
        <input
          value={DURACION}
          onChange={(e) => setDURACION(e.target.value)}
          placeholder="Duración"
          className={inputClass}
        />

        <input
          value={INTENSIDAD}
          onChange={(e) => setINTENSIDAD(e.target.value)}
          placeholder="Intensidad"
          className={inputClass}
        />
      </div>

      {formError && <p className="text-sm text-red-400">{formError}</p>}

      <div className="flex justify-end gap-2">
        <button
          type="button"
          onClick={onCancel}
          disabled={saving}
          className="rounded-xl border border-white/10 px-4 py-2 disabled:opacity-40"
        >
          Cancelar
        </button>

        <button
          type="button"
          onClick={handleSave}
          disabled={saving}
          className="rounded-xl border border-[#C8A96B] bg-[#C8A96B]/10 px-4 py-2 transition hover:bg-[#C8A96B]/20 disabled:opacity-40"
        >
          {saving
            ? "Guardando…"
            : initialData
            ? "Guardar cambios"
            : "Guardar"}
        </button>
      </div>
    </div>
  );
}
