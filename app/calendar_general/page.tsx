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
  MONTHS,
  SEASON_FIRST_DAY,
  SEASON_LAST_DAY,
  buildSeasonMonths,
  currentMonthIndex,
  dateKey,
  parseDateKey,
  recordDateKey,
} from "@/lib/calendar";
import { cn } from "@/lib/utils";
import { mismoEquipo } from "@/lib/data-analisis/nombres";
import { CALENDARIO_CASTILLA_KEY, type PartidoBesoccer } from "@/lib/viaje/calendario";
import type { ViajeStore } from "@/lib/viaje/modelo";

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

/** Lo que ya existe en otras pantallas y aquí sólo se lee: partidos (BeSoccer) y viajes (/desplazamiento). */
type EventoAuto = {
  id: string;
  fecha: string;
  clase: "PARTIDO" | "VIAJE";
  titulo: string;
  detalle: string;
  hora: string;
  enlace: string;
};

const AUTO_THEMES: Record<EventoAuto["clase"], { label: string; stripe: string; dot: string }> = {
  PARTIDO: { label: "Partido", stripe: "border-l-[#C8A96B]", dot: "bg-[#C8A96B]" },
  VIAJE: { label: "Viaje", stripe: "border-l-purple-400", dot: "bg-purple-400" },
};

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

const EMPTY_FILES = { images: [] as DayFile[], pdfs: [] as DayFile[] };
const EMPTY_DOC: EventsDoc = { events: [] };

const MAX_VISIBLE_PER_DAY = 3;

/** Lo que se espera a una lectura antes de decir que no llega y ofrecer reintentar. */
const TIEMPO_LIMITE_MS = 15_000;

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
    reload: recargaDoc,
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
  const [autoEventos, setAutoEventos] = useState<EventoAuto[]>([]);
  const [proximo, setProximo] = useState<{ jornada: number; rival: string; enCasa: boolean; fecha: string; hora: string; salida: string } | null>(null);

  const [selectedKey, setSelectedKey] = useState<string | null>(null);
  const [editingEvent, setEditingEvent] = useState<GeneralEvent | null>(null);
  const [isCreating, setIsCreating] = useState(false);

  /* Lo dice la ficha de dentro: cerrar el día la desmontaría con lo escrito. */
  const [fichaSucia, setFichaSucia] = useState(false);
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

  /*
  | Partidos de BeSoccer y viajes ya montados: se leen, no se editan aquí.
  |
  | Con tiempo límite (30/10/2026): sin él, una /api/docs que no contestaba
  | dejaba el mes sin partidos ni franja y sin decir nada. Cada intento lleva
  | su número; «cargando» es que el último intento todavía no ha contestado
  | (así no hay setState síncrono dentro del efecto).
  */
  const [intentoAuto, setIntentoAuto] = useState(0);
  const [autoRespuesta, setAutoRespuesta] = useState<{ intento: number; ok: boolean } | null>(null);
  const autoCargando = autoRespuesta?.intento !== intentoAuto;
  const autoFallo = !autoCargando && autoRespuesta?.ok === false;

  useEffect(() => {
    let vivo = true;
    const corte = new AbortController();
    const reloj = setTimeout(() => corte.abort(), TIEMPO_LIMITE_MS);

    const lee = async <T,>(key: string): Promise<{ ok: boolean; data: T | null }> => {
      try {
        const r = await fetch(`/api/docs?key=${encodeURIComponent(key)}`, { signal: corte.signal });
        if (!r.ok) return { ok: false, data: null };
        const body = (await r.json()) as { data?: T | null };
        return { ok: true, data: body?.data ?? null };
      } catch {
        return { ok: false, data: null };
      }
    };

    void Promise.all([
      lee<{ partidos?: PartidoBesoccer[] }>(CALENDARIO_CASTILLA_KEY),
      lee<ViajeStore>("desplazamientos"),
    ]).then(([leidoCalendario, leidoViajes]) => {
      clearTimeout(reloj);
      if (!vivo) return;

      const calendario = leidoCalendario.data;
      const viajes = leidoViajes.data;

      /* Lo que llegue se pinta; si falta una de las dos, se ofrece reintentar. */
      setAutoRespuesta({ intento: intentoAuto, ok: leidoCalendario.ok && leidoViajes.ok });

      const lista: EventoAuto[] = [];

      for (const p of calendario?.partidos ?? []) {
        const m = typeof p?.cuando === "string" ? p.cuando.match(/^(\d{4}-\d{2}-\d{2})T(\d{2}):(\d{2})/) : null;
        if (!m) continue;

        const enCasa = /castilla/i.test(p.local);
        const rival = enCasa ? p.visitante : p.local;

        lista.push({
          id: `partido-${p.jornada}-${m[1]}`,
          fecha: m[1],
          clase: "PARTIDO",
          titulo: `J${String(p.jornada).padStart(2, "0")} · ${enCasa ? "Castilla vs" : "en"} ${rival}`,
          detalle: enCasa ? "En casa" : "A domicilio",
          hora: m[2] + ":" + m[3] === "00:00" ? "" : `${m[2]}:${m[3]}`,
          enlace: "",
        });
      }

      /* Los viajes guardados cuentan todos menos los de casa: Desplazamiento
         guarda "visitante", pero un documento viejo puede traerlo de otra forma. */
      const guardados = Object.values(viajes?.viajes ?? {}).filter((v) => v && v.condicion !== "local");

      /* Los partidos fuera aún por jugar que no tienen viaje guardado salen con la
         víspera propuesta: el calendario operativo tiene que servir antes de montar el viaje. */
      const hoy = dateKey(new Date());

      for (const p of calendario?.partidos ?? []) {
        const m = typeof p?.cuando === "string" ? p.cuando.match(/^(\d{4}-\d{2}-\d{2})T/) : null;
        if (!m || m[1] < hoy || /castilla/i.test(p.local)) continue;

        const rival = p.local;
        const [y, mo, d] = m[1].split("-").map(Number);
        const vispera = dateKey(new Date(y, mo - 1, d - 1));

        const yaGuardado = guardados.some(
          (v) =>
            mismoEquipo(v.rival ?? "", rival) &&
            ((v.dias ?? []).some((dia) => dia.fecha === vispera || dia.fecha === m[1]) ||
              v.fecha === vispera ||
              v.fecha === m[1])
        );

        if (yaGuardado) continue;

        lista.push({
          id: `viaje-propuesto-${p.jornada}-${vispera}`,
          fecha: vispera,
          clase: "VIAJE",
          titulo: `Viaje a ${rival}`,
          detalle: "Víspera del partido",
          hora: "",
          enlace: "/desplazamiento",
        });
      }

      for (const viaje of guardados) {

        const fechas = new Set(
          (viaje.dias ?? []).map((d) => d.fecha).filter(Boolean)
        );

        if (fechas.size === 0 && viaje.fecha) fechas.add(viaje.fecha);

        /* El día del partido de este viaje: los días de después son la vuelta, y se rotulan así
           para que no parezca un segundo viaje. Sin partido en el calendario, todo es «Viaje a». */
        const primero = [...fechas].sort()[0] ?? "";
        const delPartido = (calendario?.partidos ?? [])
          .filter((p) => !/castilla/i.test(p.local) && mismoEquipo(p.local, viaje.rival ?? ""))
          .map((p) => (typeof p.cuando === "string" ? p.cuando.slice(0, 10) : ""))
          .filter((f) => f && f >= primero)
          .sort()[0];

        for (const fecha of fechas) {
          lista.push({
            id: `viaje-${viaje.partidoId}-${fecha}`,
            fecha,
            clase: "VIAJE",
            titulo: delPartido && fecha > delPartido ? `Regreso de ${viaje.rival}` : `Viaje a ${viaje.rival}`,
            detalle: [viaje.estadio?.ciudad, viaje.hotel?.nombre].filter(Boolean).join(" · "),
            hora: "",
            enlace: "/desplazamiento",
          });
        }
      }

      setAutoEventos(lista);

      /* El próximo partido, para la franja de arriba. */
      const siguiente = (calendario?.partidos ?? [])
        .filter((p) => typeof p?.cuando === "string" && p.cuando.slice(0, 10) >= hoy)
        .sort((a, b) => a.cuando.localeCompare(b.cuando))[0];

      if (siguiente) {
        const enCasa = /castilla/i.test(siguiente.local);
        const fecha = siguiente.cuando.slice(0, 10);
        const hora = siguiente.cuando.slice(11, 16);

        setProximo({
          jornada: siguiente.jornada,
          rival: enCasa ? siguiente.visitante : siguiente.local,
          enCasa,
          fecha,
          hora: hora === "00:00" ? "" : hora,
          salida: enCasa
            ? ""
            : lista
                .filter((e) => e.clase === "VIAJE" && e.fecha <= fecha && mismoEquipo(e.titulo.replace(/^(Viaje a|Regreso de) /, ""), siguiente.local))
                .map((e) => e.fecha)
                .sort()[0] ?? "",
        });
      }
    });

    return () => {
      vivo = false;
      clearTimeout(reloj);
      corte.abort();
    };
  }, [intentoAuto]);

  /*
  | Los eventos propios del staff (useRemoteDoc). Ya no tapan el mes mientras
  | llegan (30/10/2026): la rejilla, los partidos y los viajes se pintan desde
  | el principio y aquí sólo se avisa de lo que falta. A los 15 s, aviso con
  | «Reintentar» en vez de un esqueleto eterno.
  */
  const [intentoDoc, setIntentoDoc] = useState(0);
  const [docTardaEn, setDocTardaEn] = useState<number | null>(null);

  useEffect(() => {
    if (status !== "loading") return;
    const reloj = setTimeout(() => setDocTardaEn(intentoDoc), TIEMPO_LIMITE_MS);
    return () => clearTimeout(reloj);
  }, [status, intentoDoc]);

  const docCargando = status === "loading" && docTardaEn !== intentoDoc;
  const docTarda = status === "loading" && docTardaEn === intentoDoc;

  const autoByDay = useMemo(() => {
    const map = new Map<string, EventoAuto[]>();

    autoEventos.forEach((e) => {
      const list = map.get(e.fecha);
      if (list) list.push(e);
      else map.set(e.fecha, [e]);
    });

    return map;
  }, [autoEventos]);

  const eventsByDay = useMemo(() => {
    const map = new Map<string, GeneralEvent[]>();

    events.forEach((event) => {
      const key = recordDateKey(event.fecha);
      if (!key) return;

      const list = map.get(key);
      if (list) list.push(event);
      else map.set(key, [event]);
    });

    /* En el orden del día, por la hora (19/10/2026): antes salían en el
       orden en que se apuntaron. Los que no tienen hora, al final. */
    map.forEach((list) =>
      list.sort((a, b) =>
        (a.hora?.trim() || "99").localeCompare(b.hora?.trim() || "99", "es", {
          numeric: true,
        })
      )
    );

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
    const diasConActividad = new Set<string>();

    eventsByDay.forEach((list, key) => {
      if (!inMonth(key)) return;
      eventos += list.length;
      diasConActividad.add(key);
    });

    autoByDay.forEach((list, key) => {
      if (!inMonth(key)) return;
      eventos += list.length;
      diasConActividad.add(key);
    });

    let imagenes = 0;
    let pdfs = 0;

    Object.entries(filesByDay).forEach(([key, files]) => {
      if (!inMonth(key)) return;
      imagenes += files.images.length;
      pdfs += files.pdfs.length;
    });

    return { eventos, dias: diasConActividad.size, imagenes, pdfs };
  }, [eventsByDay, autoByDay, filesByDay, active]);

  /* Mes en blanco con todo ya leído: se dice con una frase y se ofrece el mes del próximo partido. */
  const mesVacio =
    !autoCargando &&
    !autoFallo &&
    status !== "loading" &&
    monthStats.eventos === 0 &&
    monthStats.imagenes === 0 &&
    monthStats.pdfs === 0;

  const mesDelProximo = proximo
    ? months.findIndex((m) => {
        const d = parseDateKey(proximo.fecha);
        return m.month === d.getMonth() && m.year === d.getFullYear();
      })
    : -1;

  /* La leyenda, sólo con los tipos que tienen algo en el mes que se mira. */
  const legend = useMemo(() => {
    const enMes = (key: string) => {
      const date = parseDateKey(key);
      return date.getMonth() === active.month && date.getFullYear() === active.year;
    };

    const tipos = new Set<EventType>();
    eventsByDay.forEach((list, key) => {
      if (enMes(key)) list.forEach((e) => tipos.add(e.tipo));
    });

    const claseAuto = new Set<EventoAuto["clase"]>();
    autoByDay.forEach((list, key) => {
      if (enMes(key)) list.forEach((e) => claseAuto.add(e.clase));
    });

    const items: CalendarLegendItem[] = [];
    (Object.keys(AUTO_THEMES) as EventoAuto["clase"][]).forEach((clase) => {
      /* El viaje ya está entre los tipos de evento con el mismo color y rótulo. */
      if (claseAuto.has(clase) && !(clase === "VIAJE" && tipos.has("VIAJE"))) {
        items.push({ label: AUTO_THEMES[clase].label, color: AUTO_THEMES[clase].dot });
      }
    });
    EVENT_TYPES.forEach((type) => {
      if (tipos.has(type)) items.push({ label: TYPE_THEMES[type].label, color: TYPE_THEMES[type].dot });
    });

    return items;
  }, [eventsByDay, autoByDay, active]);

  const selectedDate = selectedKey ? parseDateKey(selectedKey) : null;
  const selectedEvents = selectedKey ? eventsByDay.get(selectedKey) ?? [] : [];
  const selectedFiles = selectedKey
    ? filesByDay[selectedKey] ?? EMPTY_FILES
    : EMPTY_FILES;

  const selectedAuto = selectedKey ? autoByDay.get(selectedKey) ?? [] : [];

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

      /* Si hay una ficha a medio rellenar, ya pregunta la ventana del día
         antes de llamar aquí (components/ui/calendar-day-modal.tsx). */

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
      keyboardEnabled={!selectedKey}
      legend={legend}
      franja={
        <div className="space-y-2">
        {proximo ? (
          <Link
            href={proximo.enCasa ? "/calendar" : "/desplazamiento"}
            className="flex min-w-0 flex-wrap items-center gap-x-3 gap-y-1 rounded-2xl border border-[#C8A96B]/30 bg-[#C8A96B]/[0.06] px-4 py-3 text-sm transition hover:border-[#C8A96B]/60"
          >
            <span className="text-[10px] font-semibold uppercase tracking-[0.2em] text-[#C8A96B]">Próximo partido</span>
            <span className="min-w-0 font-semibold text-white">
              J{String(proximo.jornada).padStart(2, "0")} · {proximo.enCasa ? "Castilla vs" : "en"} {proximo.rival}
            </span>
            <span className="text-white/70">
              {new Date(`${proximo.fecha}T12:00:00`).toLocaleDateString("es-ES", { weekday: "short", day: "numeric", month: "short" })}
              {proximo.hora ? `, ${proximo.hora}` : ""}
            </span>
            {proximo.salida ? (
              <span className="text-white/55">
                · viaje desde el {new Date(`${proximo.salida}T12:00:00`).toLocaleDateString("es-ES", { weekday: "short", day: "numeric" })}
              </span>
            ) : null}
          </Link>
        ) : autoCargando ? (
          /* El hueco de la franja mientras llegan los partidos: la misma forma, sin texto suelto. */
          <div
            aria-label="Leyendo el próximo partido"
            className="flex h-[46px] items-center gap-3 rounded-2xl border border-white/10 px-4"
          >
            <span className="h-2.5 w-24 animate-pulse rounded-full bg-white/10" />
            <span className="h-3 w-52 max-w-[40%] animate-pulse rounded-full bg-white/10" />
            <span className="h-3 w-20 animate-pulse rounded-full bg-white/[0.07]" />
          </div>
        ) : null}

        {docCargando && (
          <p className="flex items-center gap-2 text-xs text-white/55">
            <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-[#C8A96B]" />
            Leyendo los eventos del staff; partidos y viajes ya están en el mes.
          </p>
        )}

        {(autoFallo || docTarda) && (
          <div className="flex min-w-0 flex-wrap items-center gap-x-3 gap-y-2 rounded-2xl border border-amber-400/30 bg-amber-400/5 px-4 py-3 text-sm text-amber-200/90">
            <TriangleAlert size={16} className="shrink-0" />
            <span className="min-w-0 flex-1">
              {autoFallo && docTarda
                ? "No han llegado ni los partidos y viajes ni los eventos del staff."
                : autoFallo
                  ? "No han llegado los partidos de BeSoccer ni los viajes guardados."
                  : "Los eventos del staff están tardando más de la cuenta."}
            </span>
            <button
              type="button"
              onClick={() => {
                if (autoFallo) setIntentoAuto((n) => n + 1);
                if (docTarda) {
                  setIntentoDoc((n) => n + 1);
                  recargaDoc();
                }
              }}
              className="rounded-lg border border-amber-400/50 px-3 py-1.5 text-xs font-semibold transition hover:bg-amber-400/10"
            >
              Reintentar
            </button>
          </div>
        )}

        {/* En el móvil la lista del mes ya dice que no hay nada: la frase sólo sale allí si trae el salto. */}
        {mesVacio && (
          <div className={cn(
            "min-w-0 flex-wrap items-center gap-x-3 gap-y-2 rounded-2xl border border-white/10 bg-white/[0.03] px-4 py-3 text-sm text-white/70",
            mesDelProximo !== -1 && mesDelProximo !== currentMonth ? "flex" : "hidden sm:flex"
          )}>
            <span className="min-w-0 flex-1">
              Nada programado en {MONTHS[active.month].toLowerCase()}.
            </span>
            {mesDelProximo !== -1 && mesDelProximo !== currentMonth && (
              <button
                type="button"
                onClick={() => setCurrentMonth(mesDelProximo)}
                className="rounded-lg border border-[#C8A96B]/50 px-3 py-1.5 text-xs font-semibold text-[#C8A96B] transition hover:bg-[#C8A96B]/10"
              >
                Ir a {MONTHS[months[mesDelProximo].month].toLowerCase()}, mes del próximo partido
              </button>
            )}
          </div>
        )}
        </div>
      }
      stats={
        <>
          {/* El número de días iba dos veces: de pista y de tarjeta. */}
          {monthStats.eventos > 0 && (
            <CalendarStat label="Eventos" value={monthStats.eventos} />
          )}
          {monthStats.dias > 0 && (
            <CalendarStat label="Días con actividad" value={monthStats.dias} />
          )}
          {monthStats.imagenes > 0 && (
            <CalendarStat label="Imágenes" value={monthStats.imagenes} />
          )}
          {monthStats.pdfs > 0 && (
            <CalendarStat label="PDFs" value={monthStats.pdfs} />
          )}
        </>
      }
      renderDay={({ key }) => {
        const dayEvents = eventsByDay.get(key) ?? [];
        const dayFiles = filesByDay[key] ?? EMPTY_FILES;
        const dayAuto = autoByDay.get(key) ?? [];

        const imageCount = dayFiles.images.length;
        const pdfCount = dayFiles.pdfs.length;

        const visible = dayEvents.slice(0, MAX_VISIBLE_PER_DAY);
        const hidden = dayEvents.length - visible.length;

        return {
          hasContent:
            dayEvents.length > 0 || dayAuto.length > 0 || imageCount > 0 || pdfCount > 0,
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
            dayEvents.length > 0 || dayAuto.length > 0 ? (
              <>
                {dayAuto.map((auto) => (
                  <div
                    key={auto.id}
                    className={cn(
                      "rounded-md border border-l-4 border-[#C8A96B]/20 bg-[#C8A96B]/10 px-1.5 py-1",
                      AUTO_THEMES[auto.clase].stripe
                    )}
                  >
                    <p
                      title={auto.titulo}
                      className="line-clamp-2 break-words text-[9px] font-semibold md:text-[11px]"
                    >
                      {auto.titulo}
                    </p>

                    <p className="text-[8px] text-white/60 md:text-[9px]">
                      {AUTO_THEMES[auto.clase].label}
                      {auto.hora ? ` · ${auto.hora}` : ""}
                    </p>
                  </div>
                ))}

                {visible.map((event) => (
                  <div
                    key={event.id}
                    className={cn(
                      "rounded-md border border-l-4 border-[#C8A96B]/20 bg-[#C8A96B]/10 px-1.5 py-1",
                      TYPE_THEMES[event.tipo]?.stripe ?? "border-l-white/30"
                    )}
                  >
                    <p
                      title={event.titulo}
                      className="line-clamp-2 break-words text-[9px] font-semibold md:text-[11px]"
                    >
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
            {/* Sin la orden de base de datos (19/10/2026): quien lo lee es el
                cuerpo técnico. Lo técnico va en el comentario: falta la tabla
                de supabase/app_documents.sql. */}
            <span>
              Los eventos se están guardando sólo en este aparato y el resto
              del staff no los ve. Avisa al administrador de la app.
            </span>
          </p>
        </div>
      )}

      {selectedDate && selectedKey && (
        <CalendarDayModal
          date={selectedDate}
          size="lg"
          sinGuardar={fichaSucia}
          subtitle={[
            `${selectedEvents.length + selectedAuto.length} ${
              selectedEvents.length + selectedAuto.length === 1 ? "evento" : "eventos"
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
              onSucio={setFichaSucia}
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
              selectedAuto.length === 0 &&
              !isCreating &&
              !editingEvent &&
              selectedFiles.images.length === 0 &&
              selectedFiles.pdfs.length === 0 && (
                <CalendarEmptyState>
                  Sin operativa programada este día.
                </CalendarEmptyState>
              )}

            {selectedAuto.map((auto) => (
              <div
                key={auto.id}
                className={cn(
                  "rounded-xl border border-l-4 border-white/10 bg-[#10151C] p-4",
                  AUTO_THEMES[auto.clase].stripe
                )}
              >
                <p className="text-lg font-semibold">{auto.titulo}</p>

                <p className="mt-1 text-sm text-[#C8A96B]">
                  {AUTO_THEMES[auto.clase].label}
                  {auto.hora ? ` · ${auto.hora}` : ""}
                  {auto.detalle ? ` · ${auto.detalle}` : ""}
                </p>

                {auto.enlace && (
                  <Link
                    href={auto.enlace}
                    className="mt-3 inline-block text-xs text-[#C8A96B] transition hover:underline"
                  >
                    Abrir el desplazamiento →
                  </Link>
                )}
              </div>
            ))}

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
  onSucio,
}: {
  initialData?: GeneralEvent | null;
  onCancel: () => void;
  onSave: (data: Omit<GeneralEvent, "id" | "fecha">) => void;
  /**
   * Avisa al día de si hay algo escrito sin guardar.
   *
   * El formulario vive aquí dentro, pero quien cierra la ventana es el día:
   * sin este aviso, cerrarlo desmontaba la ficha a medio rellenar y no
   * quedaba rastro de lo escrito.
   */
  onSucio?: (sucio: boolean) => void;
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

  const sucio =
    tipo !== (initialData?.tipo ?? "REUNION") ||
    titulo !== (initialData?.titulo ?? "") ||
    descripcion !== (initialData?.descripcion ?? "") ||
    responsable !== (initialData?.responsable ?? "") ||
    hora !== (initialData?.hora ?? "") ||
    lugar !== (initialData?.lugar ?? "") ||
    participantes !== (initialData?.participantes ?? "");

  useEffect(() => {
    onSucio?.(sucio);

    /* Al desmontar, el día vuelve a poder cerrarse sin preguntar. */
    return () => onSucio?.(false);
  }, [sucio, onSucio]);

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
          placeholder="Hora (10:30)"
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
