"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowRight, Users } from "lucide-react";
import { usePlayers } from "@/hooks/usePlayers";
import { alineaSeguimiento } from "@/lib/seguimiento";
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
  buildSeasonMonths,
  currentMonthIndex,
  normalizeText,
  parseDateKey,
  recordDateKey,
} from "@/lib/calendar";
import { cn } from "@/lib/utils";

const APPS_SCRIPT_URL =
  "https://script.google.com/macros/s/AKfycbxCaJ90F28CYdcLVNnI4RZjyQL5IJlXVunEAobWY-Qr6lUL8No9H1B3RdASk83Z_NUd/exec";

type TrackingRecord = {
  ID_REGISTRO: string;
  ID_JUGADOR: string;
  /** El nombre que escribió la hoja. Manda sobre el ID, que se renumera. */
  NOMBRE?: string;
  FECHA: string;
  OBJETIVO_OFENSIVO: string;
  OBJETIVO_DEFENSIVO: string;
  OBJETIVO_MENTAL: string;
  FEEDBACK: string;
  QUIEN: string;
  MODALIDAD: string;
  MOMENTO: string;
  ESTRATEGIA: string;
};

type StrategyKey = "CAMPO" | "VIDEO" | "OTRO";

const STRATEGY_STYLES: Record<
  StrategyKey,
  { stripe: string; dot: string; label: string }
> = {
  CAMPO: { stripe: "border-l-sky-400", dot: "bg-sky-400", label: "Campo" },
  VIDEO: { stripe: "border-l-yellow-400", dot: "bg-yellow-400", label: "Vídeo" },
  OTRO: { stripe: "border-l-emerald-400", dot: "bg-emerald-400", label: "Otros" },
};

const LEGEND: CalendarLegendItem[] = (
  Object.keys(STRATEGY_STYLES) as StrategyKey[]
).map((key) => ({
  label: STRATEGY_STYLES[key].label,
  color: STRATEGY_STYLES[key].dot,
}));

/** Máximo de tarjetas visibles dentro de una celda antes de resumir. */
const MAX_VISIBLE_PER_DAY = 3;

function strategyKey(value: string): StrategyKey {
  const normalized = normalizeText(value);

  if (normalized.includes("CAMPO")) return "CAMPO";
  if (normalized.includes("VIDEO")) return "VIDEO";
  return "OTRO";
}

export default function Calendar() {
  const router = useRouter();
  const months = useMemo(() => buildSeasonMonths(), []);

  const { players, loading: playersLoading } = usePlayers();

  const [currentMonth, setCurrentMonth] = useState(() =>
    currentMonthIndex(months)
  );
  const [crudoTrackingData, setTrackingData] = useState<TrackingRecord[]>([]);

  /*
  | El nombre manda sobre el ID: la hoja JUGADORES ha renumerado los JUG-XX y
  | un seguimiento viejo apunta hoy a otra persona (ver ).
  */
  const trackingData = useMemo(
    () => alineaSeguimiento(crudoTrackingData, players),
    [crudoTrackingData, players],
  );
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [playerFilter, setPlayerFilter] = useState("");
  const [selectedKey, setSelectedKey] = useState<string | null>(null);

  const playersMap = useMemo(() => {
    const map: Record<string, (typeof players)[number]> = {};

    players.forEach((p) => {
      map[p.id] = p; // búsqueda por ID
      map[p.nombre] = p; // búsqueda por nombre
    });

    return map;
  }, [players]);

  useEffect(() => {
    let cancelled = false;

    fetch(`${APPS_SCRIPT_URL}?action=seguimiento`)
      .then((r) => r.json())
      .then((data) => {
        if (cancelled) return;

        setTrackingData(Array.isArray(data) ? data : []);
        setError(Array.isArray(data) ? null : "Respuesta inesperada del servidor");
      })
      .catch((err) => {
        console.error(err);
        if (!cancelled) setError("No se pudo cargar el seguimiento");
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, []);

  const visibleData = useMemo(
    () =>
      playerFilter
        ? trackingData.filter((s) => s.ID_JUGADOR === playerFilter)
        : trackingData,
    [trackingData, playerFilter]
  );

  /** Sesiones agrupadas por día: evita recorrer todo el array en cada celda. */
  const sessionsByDay = useMemo(() => {
    const map = new Map<string, TrackingRecord[]>();

    visibleData.forEach((session) => {
      const key = recordDateKey(session.FECHA);
      if (!key) return;

      const list = map.get(key);
      if (list) list.push(session);
      else map.set(key, [session]);
    });

    return map;
  }, [visibleData]);

  const sessionDays = useMemo(
    () => [...sessionsByDay.keys()].sort(),
    [sessionsByDay]
  );

  const active = months[currentMonth];

  const monthStats = useMemo(() => {
    const inMonth = visibleData.filter((s) => {
      const key = recordDateKey(s.FECHA);
      if (!key) return false;

      const d = parseDateKey(key);
      return d.getMonth() === active.month && d.getFullYear() === active.year;
    });

    const jugadores = new Set(inMonth.map((s) => s.ID_JUGADOR)).size;
    const campo = inMonth.filter(
      (s) => strategyKey(s.ESTRATEGIA) === "CAMPO"
    ).length;
    const video = inMonth.filter(
      (s) => strategyKey(s.ESTRATEGIA) === "VIDEO"
    ).length;

    return { total: inMonth.length, jugadores, campo, video };
  }, [visibleData, active]);

  const selectedDate = selectedKey ? parseDateKey(selectedKey) : null;
  const selectedSessions = selectedKey ? sessionsByDay.get(selectedKey) ?? [] : [];
  const selectedIndex = selectedKey ? sessionDays.indexOf(selectedKey) : -1;

  /** Salta al día con seguimientos anterior/siguiente y sincroniza el mes. */
  const goToDay = useCallback(
    (index: number) => {
      const key = sessionDays[index];
      if (!key) return;

      const date = parseDateKey(key);
      const monthIdx = months.findIndex(
        (m) => m.month === date.getMonth() && m.year === date.getFullYear()
      );

      if (monthIdx !== -1) setCurrentMonth(monthIdx);
      setSelectedKey(key);
    },
    [sessionDays, months]
  );

  const openPlayer = (id: string) => {
    setSelectedKey(null);
    router.push(`/individual?player=${encodeURIComponent(id)}`);
  };

  return (
    <CalendarShell
      eyebrow="RMCF CASTILLA INDIVIDUAL"
      title="Calendario de Seguimiento"
      months={months}
      monthIndex={currentMonth}
      onMonthChange={setCurrentMonth}
      loading={loading}
      keyboardEnabled={!selectedKey}
      legend={LEGEND}
      stats={
        <>
          <CalendarStat label="Seguimientos" value={monthStats.total} />
          <CalendarStat label="Jugadores" value={monthStats.jugadores} />
          <CalendarStat label="Campo" value={monthStats.campo} />
          <CalendarStat label="Vídeo" value={monthStats.video} />
        </>
      }
      toolbar={
        <div className="relative hidden md:block">
          <Users
            size={15}
            className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-[#C8A96B]"
          />

          <select
            value={playerFilter}
            onChange={(e) => setPlayerFilter(e.target.value)}
            aria-label="Filtrar por jugador"
            className="max-w-[200px] rounded-xl border border-white/10 bg-[#11161D] py-2 pl-9 pr-3 text-sm outline-none transition hover:border-[#C8A96B] focus:border-[#C8A96B]"
          >
            <option value="">Todos los jugadores</option>

            {players.map((p) => (
              <option key={p.id} value={p.id}>
                {p.nombre}
              </option>
            ))}
          </select>
        </div>
      }
      renderDay={({ key }) => {
        const daySessions = sessionsByDay.get(key) ?? [];
        const hasSessions = daySessions.length > 0;

        if (!hasSessions) return {};

        const visible = daySessions.slice(0, MAX_VISIBLE_PER_DAY);
        const hidden = daySessions.length - visible.length;

        return {
          hasContent: true,
          onClick: () => setSelectedKey(key),
          badges: (
            <span className="rounded-full border border-[#C8A96B]/30 bg-[#C8A96B]/10 px-2 py-0.5 text-[10px] font-semibold text-[#C8A96B]">
              {daySessions.length}
            </span>
          ),
          children: (
            <>
              {visible.map((session, index) => {
                const jugador = playersMap[session.ID_JUGADOR];
                const style = STRATEGY_STYLES[strategyKey(session.ESTRATEGIA)];

                return (
                  <div
                    /*
                      La hoja repite algún ID_REGISTRO (REG00228 y SEG-A31C0B6E
                      salen dos veces), y con la clave repetida React avisa por
                      consola y puede quedarse una tarjeta sin pintar. El orden
                      dentro del día la desempata.
                    */
                    key={`${session.ID_REGISTRO}-${index}`}
                    onClick={(e) => {
                      e.stopPropagation();
                      openPlayer(session.ID_JUGADOR);
                    }}
                    className={cn(
                      "cursor-pointer rounded-md border border-l-4 border-[#C8A96B]/20 bg-[#C8A96B]/10 px-1.5 py-1 transition-all hover:border-[#C8A96B]",
                      style.stripe
                    )}
                  >
                    <p className="truncate text-[9px] font-semibold md:text-[11px]">
                      {jugador?.nombre ?? session.NOMBRE ?? session.ID_JUGADOR}
                    </p>

                    <p className="text-[8px] text-white/60 md:text-[9px]">
                      {session.ESTRATEGIA}
                    </p>

                    <p className="truncate text-[8px] text-white/40 md:text-[10px]">
                      {session.QUIEN}
                    </p>
                  </div>
                );
              })}

              {hidden > 0 && (
                <p className="pt-0.5 text-center text-[10px] font-medium text-[#C8A96B]/80">
                  +{hidden} más
                </p>
              )}
            </>
          ),
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

      {selectedDate && (
        <CalendarDayModal
          date={selectedDate}
          subtitle={`${selectedSessions.length} ${
            selectedSessions.length === 1 ? "seguimiento" : "seguimientos"
          }`}
          onClose={() => setSelectedKey(null)}
          onPrev={() => goToDay(selectedIndex - 1)}
          onNext={() => goToDay(selectedIndex + 1)}
          canPrev={selectedIndex > 0}
          canNext={selectedIndex >= 0 && selectedIndex < sessionDays.length - 1}
        >
          <div className="space-y-3">
            {selectedSessions.length === 0 && (
              <CalendarEmptyState>
                No hay seguimientos registrados este día.
              </CalendarEmptyState>
            )}

            {selectedSessions.map((session, index) => {
              const jugador = playersMap[session.ID_JUGADOR];
              const style = STRATEGY_STYLES[strategyKey(session.ESTRATEGIA)];

              return (
                <div
                  /* Ver arriba: la hoja repite identificadores de registro. */
                  key={`${session.ID_REGISTRO}-${index}`}
                  onClick={() => openPlayer(session.ID_JUGADOR)}
                  className={cn(
                    "cursor-pointer rounded-xl border border-l-4 border-white/10 bg-[#10151C] p-4 transition-all hover:border-[#C8A96B]",
                    style.stripe
                  )}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="truncate text-lg font-semibold">
                        {jugador?.nombre ?? session.NOMBRE ?? session.ID_JUGADOR}
                      </p>

                      <p className="mt-1 text-sm text-[#C8A96B]">
                        {session.ESTRATEGIA}
                        {session.QUIEN ? ` · ${session.QUIEN}` : ""}
                      </p>
                    </div>

                    <ArrowRight
                      size={18}
                      className="mt-1 shrink-0 text-white/30"
                    />
                  </div>

                  <div className="mt-4 space-y-3">
                    <Objective
                      label="Objetivo ofensivo"
                      value={session.OBJETIVO_OFENSIVO}
                    />
                    <Objective
                      label="Objetivo defensivo"
                      value={session.OBJETIVO_DEFENSIVO}
                    />
                    <Objective
                      label="Objetivo mental"
                      value={session.OBJETIVO_MENTAL}
                    />
                    <Objective label="Feedback" value={session.FEEDBACK} />
                  </div>
                </div>
              );
            })}
          </div>
        </CalendarDayModal>
      )}

      {playersLoading && !loading && (
        <span className="sr-only">Cargando jugadores…</span>
      )}
    </CalendarShell>
  );
}

function Objective({ label, value }: { label: string; value?: string }) {
  if (!value) return null;

  return (
    <div>
      <p className="text-xs text-white/50">{label}</p>
      <p className="text-sm text-white/90">{value}</p>
    </div>
  );
}
