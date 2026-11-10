"use client";
import { traeJson } from "@/lib/hojaCsv";
import { nombreVisible } from "@/lib/nombreJugador";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowRight, Users } from "lucide-react";
import { usePlayers } from "@/hooks/usePlayers";
import { alineaSeguimiento, DIAS_SIN_SEGUIMIENTO, sinSeguimientoReciente } from "@/lib/seguimiento";
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
  MONTHS,
  buildSeasonMonths,
  currentMonthIndex,
  normalizeText,
  parseDateKey,
  recordDateKey,
} from "@/lib/calendar";
import { cn } from "@/lib/utils";


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

/* 30/10/2026: «Charla» y «Vídeo y charla» con su propio color y su cifra.
   Antes «Vídeo y charla» contaba como vídeo y «Charla» caía en «Otros», y las
   tarjetas de cada día decían una cosa y la leyenda otra. «Otros» queda para
   lo que no trae tipo escrito, y sólo sale si hay alguno. */
type StrategyKey = "CAMPO" | "VIDEO" | "CHARLA" | "VIDEO_CHARLA" | "OTRO";

const STRATEGY_STYLES: Record<
  StrategyKey,
  { stripe: string; dot: string; label: string }
> = {
  CAMPO: { stripe: "border-l-sky-400", dot: "bg-sky-400", label: "Campo" },
  VIDEO: { stripe: "border-l-yellow-400", dot: "bg-yellow-400", label: "Vídeo" },
  CHARLA: { stripe: "border-l-emerald-400", dot: "bg-emerald-400", label: "Charla" },
  VIDEO_CHARLA: { stripe: "border-l-orange-400", dot: "bg-orange-400", label: "Vídeo y charla" },
  OTRO: { stripe: "border-l-white/40", dot: "bg-white/40", label: "Sin tipo escrito" },
};

const TIPOS: StrategyKey[] = ["CAMPO", "VIDEO", "CHARLA", "VIDEO_CHARLA", "OTRO"];

/** Máximo de tarjetas visibles dentro de una celda antes de resumir. */
const MAX_VISIBLE_PER_DAY = 3;

function strategyKey(value: string): StrategyKey {
  const normalized = normalizeText(value);

  if (normalized.includes("CAMPO")) return "CAMPO";
  if (normalized.includes("VIDEO") && normalized.includes("CHARLA")) return "VIDEO_CHARLA";
  if (normalized.includes("VIDEO")) return "VIDEO";
  if (normalized.includes("CHARLA")) return "CHARLA";
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
  const [hoy] = useState(() => new Date());
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

    traeJson<unknown>("/api/rivals?action=seguimiento")
      .then((data) => {
        if (cancelled) return;

        setTrackingData(Array.isArray(data) ? data : []);
        setError(Array.isArray(data) ? null : "El seguimiento ha llegado en un formato que no se entiende. Recarga la página y, si sigue, avisa al administrador.");
      })
      .catch((err) => {
        console.error(err);
        if (!cancelled) setError("No se ha podido cargar el seguimiento. Comprueba la conexión y recarga la página.");
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

  /* 10/11/2026: lo fechado después de hoy es lo programado: se pinta con su
     estilo y no entra en «hasta hoy». */
  const hoyKey = `${hoy.getFullYear()}-${String(hoy.getMonth() + 1).padStart(2, "0")}-${String(hoy.getDate()).padStart(2, "0")}`;

  const monthStats = useMemo(() => {
    const hoyClave = `${hoy.getFullYear()}-${String(hoy.getMonth() + 1).padStart(2, "0")}-${String(hoy.getDate()).padStart(2, "0")}`;
    const inMonth = visibleData.filter((s) => {
      const key = recordDateKey(s.FECHA);
      if (!key || key > hoyClave) return false;

      const d = parseDateKey(key);
      return d.getMonth() === active.month && d.getFullYear() === active.year;
    });

    /* La referencia: el mes anterior hasta el mismo día (si es el mes en
       curso) o entero, para que el número tenga con qué compararse. */
    const enCurso = active.month === hoy.getMonth() && active.year === hoy.getFullYear();
    const mesPrevio = active.month === 0 ? 11 : active.month - 1;
    const anioPrevio = active.month === 0 ? active.year - 1 : active.year;
    const anterior = visibleData.filter((s) => {
      const key = recordDateKey(s.FECHA);
      if (!key) return false;

      const d = parseDateKey(key);
      return d.getMonth() === mesPrevio && d.getFullYear() === anioPrevio && (!enCurso || d.getDate() <= hoy.getDate());
    }).length;
    const programados = visibleData.filter((s) => {
      const key = recordDateKey(s.FECHA);

      return Boolean(key) && (key as string) > hoyClave;
    }).length;

    const ids = new Set(inMonth.map((s) => s.ID_JUGADOR));
    const jugadores = ids.size;
    const castillaConSeguimiento = players.filter((p) => p.esCastilla && ids.has(p.id)).length;

    const porTipo = Object.fromEntries(
      TIPOS.map((tipo) => [tipo, inMonth.filter((s) => strategyKey(s.ESTRATEGIA) === tipo).length]),
    ) as Record<StrategyKey, number>;

    return { total: inMonth.length, jugadores, castillaConSeguimiento, porTipo, anterior, enCurso, mesPrevio, programados };
  }, [visibleData, active, players, hoy]);

  const castillaTotal = useMemo(() => players.filter((p) => p.esCastilla).length, [players]);

  /* 07/11/2026: la temporada con su población dicha: los del Castilla y,
     aparte, los de fuera (la hoja también apunta a jugadores de otros equipos). */
  const temporadaCastilla = useMemo(() => {
    const nuestros = new Set(players.filter((p) => p.esCastilla).map((p) => p.id));

    return trackingData.filter((s) => nuestros.has(s.ID_JUGADOR)).length;
  }, [trackingData, players]);

  /* 07/11/2026: la leyenda con los tipos que hay en TODA la hoja (con el
     filtro de jugador), no sólo en el mes: la rejilla enseña también días
     del mes de al lado y una «Charla» del 29/10 se quedaba sin leyenda. */
  const legend = useMemo<CalendarLegendItem[]>(() => {
    const hay = new Set(visibleData.map((s) => strategyKey(s.ESTRATEGIA)));

    return TIPOS.filter((tipo) => hay.has(tipo)).map((tipo) => ({
      label: STRATEGY_STYLES[tipo].label,
      color: STRATEGY_STYLES[tipo].dot,
    }));
  }, [visibleData]);

  /* Jugadores de campo del Castilla sin ningún seguimiento en los últimos 14
     días: lo que se pregunta el lunes. Sale de la misma hoja, sin filtro de
     jugador (con uno elegido la pregunta no tiene sentido). */
  /* 30/10/2026: la regla compartida de lib/seguimiento (la misma que
     /individual y /individual_proc): 14 días que acaban hoy, hoy incluido.
     Antes se comparaba con la hora del momento y un registro de hoy, fechado
     a mediodía, no contaba por la mañana. */
  const sinSeguimiento = useMemo(() => {
    if (loading || error || crudoTrackingData.length === 0) return [];

    /* 07/11/2026: con los días desde su último seguimiento, de más a menos;
       quien no tiene ninguno va primero. */
    const ultimo = new Map<string, string>();

    trackingData.forEach((s) => {
      const clave = recordDateKey(s.FECHA);

      if (!clave) return;

      const previa = ultimo.get(s.ID_JUGADOR);

      if (!previa || clave > previa) ultimo.set(s.ID_JUGADOR, clave);
    });

    const hoyMedianoche = new Date(hoy.getFullYear(), hoy.getMonth(), hoy.getDate());

    return sinSeguimientoReciente(trackingData, players, hoy, (fecha) => recordDateKey(fecha))
      .map((p) => {
        const clave = ultimo.get(p.id);
        const dias = clave
          ? Math.round((hoyMedianoche.getTime() - parseDateKey(clave).getTime()) / 86_400_000)
          : null;

        return { id: p.id, nombre: nombreVisible(p.nombre), dias };
      })
      .sort((a, b) => (b.dias ?? Infinity) - (a.dias ?? Infinity));
  }, [players, trackingData, crudoTrackingData, loading, error, hoy]);

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
      eyebrow="RMCF CASTILLA · INDIVIDUAL"
      title="Calendario de Seguimiento"
      months={months}
      monthIndex={currentMonth}
      onMonthChange={setCurrentMonth}
      loading={loading}
      keyboardEnabled={!selectedKey}
      legend={legend}
      statsColumnas={3}
      franja={
        /* La alerta va ENCIMA del calendario (26/10/2026): al final de la
           página quedaba fuera de la vista y es lo que se pregunta el lunes.
           Cada nombre lleva a su ficha. */
        !playerFilter && sinSeguimiento.length > 0 ? (
          <div
            role="status"
            className="rounded-xl border border-[#C8A96B]/30 bg-[#C8A96B]/10 px-4 py-3 text-sm text-white/80"
          >
            {/* 10/11/2026: el mismo bloque que /individual: titular, base y
                un chip por jugador con sus días, que abre su ficha. */}
            <p className="font-semibold text-[#C8A96B]">
              A quién toca seguir: {sinSeguimiento.length} del Castilla sin seguimiento en {DIAS_SIN_SEGUIMIENTO} días
            </p>
            <p className="mt-0.5 text-[11px] text-white/55">
              Jugadores de campo con licencia del Castilla; los porteros llevan su seguimiento aparte. Cada uno abre su ficha.
            </p>
            <div className="mt-2 flex min-w-0 flex-wrap gap-1.5">
              {sinSeguimiento.map((j) => (
                <button
                  key={j.id}
                  type="button"
                  onClick={() => openPlayer(j.id)}
                  className="inline-flex min-w-0 items-center gap-1.5 rounded-full border border-[#C8A96B]/40 bg-white/[0.04] px-2.5 py-1 text-xs transition hover:border-[#C8A96B]"
                >
                  <span className="truncate font-semibold">{j.nombre}</span>
                  <span className="shrink-0 tabular-nums text-white/60">
                    {j.dias == null ? "ningún registro" : `${j.dias} días`}
                  </span>
                </button>
              ))}
            </div>
          </div>
        ) : undefined
      }
      stats={
        <>
          {/* 30/10/2026: el mes y la temporada en la misma tarjeta, cada
              cifra con su periodo, para no cruzar bases. */}
          <CalendarStat
            label={`Seguimientos en ${MONTHS[active.month].toLowerCase()}${
              active.month === hoy.getMonth() && active.year === hoy.getFullYear()
                ? " hasta hoy"
                : ""
            }`}
            value={monthStats.total}
            hint={
              playerFilter
                ? undefined
                : `${monthStats.enCurso ? `${MONTHS[monthStats.mesPrevio].toLowerCase()} al mismo día: ${monthStats.anterior}` : `${MONTHS[monthStats.mesPrevio].toLowerCase()}: ${monthStats.anterior}`}${monthStats.programados > 0 ? ` · ${monthStats.programados} programado${monthStats.programados === 1 ? "" : "s"} después de hoy, aparte` : ""} · ${temporadaCastilla < trackingData.length
                  ? `Temporada 26/27: ${temporadaCastilla} registros${castillaTotal > 0 ? ` de ${castillaTotal} jugadores` : ""} del Castilla (otros equipos, aparte: ${trackingData.length - temporadaCastilla})`
                  : `${trackingData.length} en toda la temporada`}`
            }
          />
          <CalendarStat
            label={`Jugadores con seguimiento en ${MONTHS[active.month].toLowerCase()}`}
            value={monthStats.jugadores}
            hint={
              castillaTotal > 0
                ? `${monthStats.castillaConSeguimiento} de los ${castillaTotal} del Castilla${
                    monthStats.jugadores > monthStats.castillaConSeguimiento ? "; el resto, de otros equipos" : ""
                  }`
                : undefined
            }
          />
          <CalendarStat
            label="Por tipo"
            value={
              <span className="mt-1 grid grid-cols-2 gap-x-3 gap-y-0.5 text-[13px] font-medium">
                {TIPOS.filter((tipo) => monthStats.porTipo[tipo] > 0).map((tipo) => (
                  <span key={tipo} className="flex min-w-0 items-center gap-1.5">
                    <span aria-hidden className={cn("h-2 w-2 shrink-0 rounded-full", STRATEGY_STYLES[tipo].dot)} />
                    <span className="min-w-0 truncate text-white/70">{STRATEGY_STYLES[tipo].label}</span>
                    <span className="ml-auto tabular-nums">{monthStats.porTipo[tipo]}</span>
                  </span>
                ))}
              </span>
            }
          />
        </>
      }
      toolbar={
        /* También en el móvil (19/10/2026): con `hidden md:block` no se
           podía filtrar por jugador desde el teléfono. */
        <div className="relative min-w-0">
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

            {/* 30/10/2026: el Castilla primero y los de otros equipos aparte. */}
            <optgroup label={`Castilla (${players.filter((p) => p.esCastilla).length})`}>
              {players
                .filter((p) => p.esCastilla)
                .map((p) => (
                  <option key={p.id} value={p.id}>
                    {nombreVisible(p.nombre)}
                  </option>
                ))}
            </optgroup>

            <optgroup label={`Otros equipos (${players.filter((p) => !p.esCastilla).length})`}>
              {players
                .filter((p) => !p.esCastilla)
                .map((p) => (
                  <option key={p.id} value={p.id}>
                    {nombreVisible(p.nombre)}
                  </option>
                ))}
            </optgroup>
          </select>
        </div>
      }
      renderDay={({ key }) => {
        const daySessions = sessionsByDay.get(key) ?? [];
        const hasSessions = daySessions.length > 0;

        /* 08/11/2026: el «Toca seguir» de la casilla de hoy repetía la franja
           de arriba (que ya da los días); se deja sólo la franja. */

        if (!hasSessions) {
          return {};
        }

        const visible = daySessions.slice(0, MAX_VISIBLE_PER_DAY);
        const hidden = daySessions.length - visible.length;

        return {
          hasContent: true,
          /* 07/11/2026: la celda crece con sus tres tarjetas y el «+N más»;
             antes los recortaba y el 4/11 decía 6 y enseñaba 2. */
          crece: true,
          onClick: () => setSelectedKey(key),
          badges: (
            <span className="rounded-full border border-[#C8A96B]/30 bg-[#C8A96B]/10 px-2 py-0.5 text-[10px] font-semibold text-[#C8A96B]">
              {daySessions.length}
              <span className="hidden md:inline">
                {daySessions.length === 1 ? " seguimiento" : " seguimientos"}
              </span>
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
                      style.stripe,
                      key > hoyKey && "border-dashed bg-transparent opacity-75",
                    )}
                  >
                    {key > hoyKey && (
                      <p className="text-[8px] font-semibold uppercase tracking-wide text-white/60 md:text-[9px]">Programado</p>
                    )}
                    {/* 07/11/2026: el tipo lo dice la franja de color (y la
                        leyenda); en texto sólo en el globo, para no repetirlo. */}
                    <p
                      className="truncate text-[9px] font-semibold md:text-[11px]"
                      title={`${style.label}${session.QUIEN ? ` · ${session.QUIEN}` : ""}`}
                    >
                      {nombreVisible(jugador?.nombre || session.NOMBRE?.trim() || "Sin jugador en la hoja")}
                    </p>

                    {session.QUIEN?.trim() && (
                      <p className="truncate text-[8px] text-white/55 md:text-[10px]">
                        {session.QUIEN}
                      </p>
                    )}
                  </div>
                );
              })}

              {hidden > 0 && (
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    setSelectedKey(key);
                  }}
                  className="w-full pt-0.5 text-center text-[10px] font-medium text-[#C8A96B]/80 underline-offset-2 hover:underline"
                >
                  +{hidden} más · ver el día
                </button>
              )}
            </>
          ),
        };
      }}
    >
      {!loading && !error && trackingData.length > 0 && (
        <div className="px-4 pb-4 md:px-8">
          <p className="text-xs leading-relaxed text-white/55">
            La franja de color de cada tarjeta dice el tipo (ver la leyenda bajo
            el calendario; al pasar por encima, en texto); debajo del nombre,
            quién lo hizo. Si un día tiene más de {MAX_VISIBLE_PER_DAY}, «+N
            más» abre el día completo. Hoy lleva a quién toca seguir.
          </p>
        </div>
      )}

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
                        {nombreVisible(jugador?.nombre || session.NOMBRE?.trim() || "Sin jugador en la hoja")}
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
  /* Un hueco o el «-» de la hoja tampoco se nombran (07/11/2026). */
  const texto = (value ?? "").trim();

  if (!texto || texto === "-" || texto === ".") return null;

  return (
    <div>
      <p className="text-xs text-white/50">{label}</p>
      <p className="text-sm text-white/90">{value}</p>
    </div>
  );
}
