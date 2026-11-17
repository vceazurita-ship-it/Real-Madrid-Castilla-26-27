"use client";
import { traeJson } from "@/lib/hojaCsv";
import { nombreVisible } from "@/lib/nombreJugador";

import { useCallback, useEffect, useMemo, useState, useSyncExternalStore } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowRight, Users } from "lucide-react";
import { usePlayers } from "@/hooks/usePlayers";
import { useCalendario } from "@/hooks/useCalendario";
import { comoNuestro, soloDia, type PartidoNuestro } from "@/lib/castilla/calendario";
import { idVigente } from "@/lib/fichajes";
import { EnlacesJugador, NombreJugador } from "@/components/individual/EnlacesJugador";
import { alineaSeguimiento, DIAS_SIN_SEGUIMIENTO, esPortero, sinPorteros, sinSeguimientoReciente } from "@/lib/seguimiento";
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

/* ?player=ID (16/11/2026): se entra ya filtrado desde la ficha, un aviso o
   el Dashboard Seguimiento. Leído sin useSearchParams (no pide Suspense) y
   sin setState en un efecto (regla del linter). */
const sinSuscripcion = () => () => {};
const jugadorDeLaUrl = () => new URLSearchParams(window.location.search).get("player") ?? "";
const sinUrl = () => "";

/** «13/11 · V 2-0 Gimnàstic (casa)»: el marcador con el Castilla primero. */
function rotuloPartido(p: PartidoNuestro) {
  const marcador =
    p.jugado && p.golesFavor !== null && p.golesContra !== null
      ? `${p.golesFavor > p.golesContra ? "V" : p.golesFavor < p.golesContra ? "D" : "E"} ${p.golesFavor}-${p.golesContra} `
      : "";

  return `${marcador}${p.lado === "casa" ? "vs" : "@"} ${p.rival}`;
}

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

  const { players: plantillaEntera, loading: playersLoading } = usePlayers();

  /* 16/11/2026: los porteros llevan un registro independiente, con su
     entrenador. No salen en el filtro ni cuentan en ninguna cifra
     (`esPortero`, lib/seguimiento). */
  const players = useMemo(
    () => plantillaEntera.filter((p) => !esPortero(p.posicion)),
    [plantillaEntera],
  );

  const [currentMonth, setCurrentMonth] = useState(() =>
    currentMonthIndex(months)
  );
  const [crudoTrackingData, setTrackingData] = useState<TrackingRecord[]>([]);

  /*
  | El nombre manda sobre el ID: la hoja JUGADORES ha renumerado los JUG-XX y
  | un seguimiento viejo apunta hoy a otra persona (ver lib/seguimiento).
  | Se alinea contra la plantilla ENTERA y después se apartan los registros
  | de los porteros: siguen en la hoja, pero aquí no se pintan ni se cuentan.
  */
  const trackingData = useMemo(
    () => sinPorteros(alineaSeguimiento(crudoTrackingData, plantillaEntera), plantillaEntera),
    [crudoTrackingData, plantillaEntera],
  );
  const [hoy] = useState(() => new Date());
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  /* Lo elegido en el selector manda; si no se ha tocado, el de la dirección
     (traducido si es un ID viejo) en cuanto la plantilla lo reconoce. */
  const [elegido, setPlayerFilter] = useState<string | null>(null);
  const pedidoUrl = useSyncExternalStore(sinSuscripcion, jugadorDeLaUrl, sinUrl);
  const pedido = pedidoUrl ? idVigente(pedidoUrl) : "";
  const playerFilter = elegido ?? (players.some((p) => p.id === pedido) ? pedido : "");
  const [selectedKey, setSelectedKey] = useState<string | null>(null);

  /* Los días de partido del Castilla (calendario de BeSoccer, el mismo que
     la portada), con rival y resultado. */
  const { partidos } = useCalendario();
  const partidosPorDia = useMemo(() => {
    const mapa = new Map<string, PartidoNuestro>();

    partidos.forEach((p) => {
      const nuestro = comoNuestro(p);
      const dia = soloDia(nuestro.cuando);

      if (dia) mapa.set(dia, nuestro);
    });

    return mapa;
  }, [partidos]);

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

  /* 17/11/2026 (ronda 19): el MD de cada día de la semana del próximo
     partido («MD-3» el 17/11 frente al partido del 20/11), para programar el
     seguimiento dentro del microciclo. */
  const proximoPartidoKey = useMemo(
    () => [...partidosPorDia.keys()].filter((k) => k >= hoyKey).sort()[0] ?? null,
    [partidosPorDia, hoyKey],
  );
  const mdDe = (key: string) => {
    if (!proximoPartidoKey || key < hoyKey || key > proximoPartidoKey) return null;
    const d = Math.round((Date.parse(`${proximoPartidoKey}T12:00:00Z`) - Date.parse(`${key}T12:00:00Z`)) / 86_400_000);
    return d >= 0 && d <= 6 ? (d === 0 ? "MD" : `MD-${d}`) : null;
  };

  /* 16/11/2026 (jueces): las cifras sin filtro son de los jugadores de campo
     del Castilla, la misma población que Plantilla y Dashboard Seguimiento;
     los de otros equipos se pintan en la rejilla pero se cuentan aparte. */
  const nuestrosIds = useMemo(
    () => new Set(players.filter((p) => p.esCastilla).map((p) => p.id)),
    [players],
  );

  const monthStats = useMemo(() => {
    const hoyClave = `${hoy.getFullYear()}-${String(hoy.getMonth() + 1).padStart(2, "0")}-${String(hoy.getDate()).padStart(2, "0")}`;
    const base = playerFilter ? visibleData : visibleData.filter((s) => nuestrosIds.has(s.ID_JUGADOR));
    const deFueraEnMes = playerFilter
      ? 0
      : visibleData.filter((s) => {
          const key = recordDateKey(s.FECHA);
          if (!key || key > hoyClave || nuestrosIds.has(s.ID_JUGADOR)) return false;
          const d = parseDateKey(key);
          return d.getMonth() === active.month && d.getFullYear() === active.year;
        }).length;
    const inMonth = base.filter((s) => {
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
    const anterior = base.filter((s) => {
      const key = recordDateKey(s.FECHA);
      if (!key) return false;

      const d = parseDateKey(key);
      return d.getMonth() === mesPrevio && d.getFullYear() === anioPrevio && (!enCurso || d.getDate() <= hoy.getDate());
    }).length;
    const programados = base.filter((s) => {
      const key = recordDateKey(s.FECHA);

      return Boolean(key) && (key as string) > hoyClave;
    }).length;

    const ids = new Set(inMonth.map((s) => s.ID_JUGADOR));
    const jugadores = ids.size;
    const castillaConSeguimiento = players.filter((p) => p.esCastilla && ids.has(p.id)).length;

    const porTipo = Object.fromEntries(
      TIPOS.map((tipo) => [tipo, inMonth.filter((s) => strategyKey(s.ESTRATEGIA) === tipo).length]),
    ) as Record<StrategyKey, number>;

    return { total: inMonth.length, jugadores, castillaConSeguimiento, porTipo, anterior, enCurso, mesPrevio, programados, deFueraEnMes };
  }, [visibleData, active, players, hoy, playerFilter, nuestrosIds]);

  const castillaTotal = nuestrosIds.size;

  /* 07/11/2026: la temporada con su población dicha: los del Castilla y,
     aparte, los de fuera (la hoja también apunta a jugadores de otros equipos).
     16/11/2026: hasta hoy y con fecha, como el Dashboard Seguimiento (lo
     programado después de hoy no cuenta), para que las dos den lo mismo. */
  const temporadaCastilla = useMemo(() => {
    return trackingData.filter((s) => {
      const key = recordDateKey(s.FECHA);

      return nuestrosIds.has(s.ID_JUGADOR) && Boolean(key) && (key as string) <= hoyKey;
    }).length;
  }, [trackingData, nuestrosIds, hoyKey]);

  const temporadaFuera = useMemo(
    () =>
      trackingData.filter((s) => {
        const key = recordDateKey(s.FECHA);

        return !nuestrosIds.has(s.ID_JUGADOR) && Boolean(key) && (key as string) <= hoyKey;
      }).length,
    [trackingData, nuestrosIds, hoyKey],
  );

  /* Las últimas 8 semanas (lunes a domingo) de los de campo del Castilla,
     con la media de las cerradas como referencia (16/11/2026). */
  const semanas = useMemo(() => {
    const lunes = new Date(hoy.getFullYear(), hoy.getMonth(), hoy.getDate());
    lunes.setDate(lunes.getDate() - ((lunes.getDay() + 6) % 7));

    const clave = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
    const lista: { desde: string; etiqueta: string; n: number; enCurso: boolean }[] = [];

    for (let i = 7; i >= 0; i--) {
      const ini = new Date(lunes);
      ini.setDate(ini.getDate() - i * 7);
      const fin = new Date(ini);
      fin.setDate(fin.getDate() + 6);
      const a = clave(ini);
      const b = clave(fin);

      lista.push({
        desde: a,
        etiqueta: `${ini.getDate()}/${ini.getMonth() + 1}`,
        n: trackingData.filter((s) => {
          const key = recordDateKey(s.FECHA);
          return nuestrosIds.has(s.ID_JUGADOR) && Boolean(key) && (key as string) >= a && (key as string) <= b && (key as string) <= hoyKey;
        }).length,
        enCurso: i === 0,
      });
    }

    const cerradas = lista.filter((s) => !s.enCurso);
    const media = cerradas.length ? cerradas.reduce((x, s) => x + s.n, 0) / cerradas.length : 0;

    return { lista, media, max: Math.max(1, ...lista.map((s) => s.n)) };
  }, [trackingData, nuestrosIds, hoy, hoyKey]);

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
      statsColumnas={!playerFilter && semanas.lista.some((s) => s.n > 0) ? 4 : 3}
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
              Jugadores de campo del Castilla; los porteros llevan su seguimiento aparte. El nombre abre su ficha; «Registrar seguimiento», el formulario con el jugador ya elegido.
            </p>
            {/* 16/11/2026 (jueces): cada aviso, una acción. */}
            <ul className="mt-2 flex min-w-0 flex-wrap gap-1.5">
              {sinSeguimiento.map((j) => (
                <li
                  key={j.id}
                  className="inline-flex min-w-0 flex-wrap items-center gap-1.5 rounded-2xl border border-[#C8A96B]/40 bg-white/[0.04] py-1 pl-2.5 pr-1 text-xs"
                >
                  <NombreJugador jugador={{ id: j.id, nombre: j.nombre }} className="truncate font-semibold" />
                  <span className="shrink-0 tabular-nums text-white/60">
                    {j.dias == null ? "ningún registro" : `${j.dias} días`}
                  </span>
                  <EnlacesJugador jugador={{ id: j.id, nombre: j.nombre }} destinos={["registrar"]} />
                </li>
              ))}
            </ul>
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
                : (() => {
                    /* 16/11/2026 (jueces): la comparación con su sentido
                       («14 menos que octubre al mismo día, 40»). */
                    const mes = MONTHS[monthStats.mesPrevio].toLowerCase();
                    const dif = monthStats.total - monthStats.anterior;
                    const referencia = monthStats.enCurso ? `${mes} al mismo día` : mes;
                    const comparado =
                      dif === 0
                        ? `igual que ${referencia} (${monthStats.anterior})`
                        : `${Math.abs(dif)} ${dif > 0 ? "más" : "menos"} que ${referencia} (${monthStats.anterior})`;

                    return `jugadores de campo del Castilla · ${comparado}${
                      monthStats.programados > 0 ? ` · ${monthStats.programados} programado${monthStats.programados === 1 ? "" : "s"} después de hoy, aparte` : ""
                    } · temporada 26/27: ${temporadaCastilla} registros${
                      temporadaFuera > 0 || monthStats.deFueraEnMes > 0
                        ? ` (de otros equipos, aparte: ${monthStats.deFueraEnMes} este mes, ${temporadaFuera} en la temporada)`
                        : ""
                    }`;
                  })()
            }
          />
          <CalendarStat
            label={`Jugadores con seguimiento en ${MONTHS[active.month].toLowerCase()}`}
            value={playerFilter ? monthStats.jugadores : `${monthStats.castillaConSeguimiento} de ${castillaTotal}`}
            hint={
              !playerFilter && castillaTotal > 0
                ? `jugadores de campo del Castilla con algún registro este mes${
                    monthStats.jugadores > monthStats.castillaConSeguimiento ? `; además, ${monthStats.jugadores - monthStats.castillaConSeguimiento} de otros equipos` : ""
                  }`
                : undefined
            }
          />
          {!playerFilter && semanas.lista.some((s) => s.n > 0) && (
            <CalendarStat
              label="Por semana · últimas 8"
              value={
                <span className="mt-1 block">
                  <span className="flex h-12 items-end gap-1" aria-hidden>
                    {semanas.lista.map((s) => (
                      <span
                        key={s.desde}
                        title={`Semana del ${s.etiqueta}: ${s.n}${s.enCurso ? " (en curso)" : ""}`}
                        className="relative flex-1 rounded-t bg-[#C8A96B]"
                        style={{ height: `${Math.max(4, (s.n / semanas.max) * 100)}%`, opacity: s.enCurso ? 0.45 : 1 }}
                      />
                    ))}
                  </span>
                  <span
                    aria-hidden
                    className="relative -mt-12 block h-12 pointer-events-none"
                  >
                    <span
                      className="absolute inset-x-0 border-t border-dashed border-white/50"
                      style={{ bottom: `${(semanas.media / semanas.max) * 100}%` }}
                    />
                  </span>
                  <span className="sr-only">
                    {semanas.lista.map((s) => `${s.etiqueta}: ${s.n}`).join(", ")}
                  </span>
                </span>
              }
              hint={`${semanas.lista[semanas.lista.length - 2]?.n ?? 0} la semana pasada frente a una media de ${semanas.media.toFixed(1).replace(".", ",")} (raya) · la última va en curso · de los ${castillaTotal} de campo del Castilla`}
            />
          )}
          <CalendarStat
            label="Por tipo"
            hint={!playerFilter && castillaTotal > 0 ? `registros del mes de los ${castillaTotal} de campo del Castilla` : undefined}
            value={
              <span className="mt-1 grid grid-cols-1 gap-x-3 gap-y-0.5 text-[13px] font-medium min-[400px]:grid-cols-2">
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
        <div className="flex min-w-0 flex-wrap items-center gap-2">
          <div className="relative min-w-0">
            <Users
              size={15}
              className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-[#C8A96B]"
            />

            <select
              value={playerFilter}
              onChange={(e) => setPlayerFilter(e.target.value)}
              aria-label="Filtrar por jugador"
              className="max-w-[230px] rounded-xl border border-white/10 bg-[#11161D] py-2 pl-9 pr-3 text-sm outline-none transition hover:border-[#C8A96B] focus:border-[#C8A96B]"
            >
              {/* 16/11/2026: lo que de verdad enseña (los porteros llevan su
                  registro aparte); cada grupo por orden alfabético. */}
              <option value="">Todos (sin porteros)</option>

              {/* 30/10/2026: el Castilla primero y los de otros equipos aparte. */}
              {[
                { etiqueta: "Castilla · de campo", lista: players.filter((p) => p.esCastilla) },
                { etiqueta: "Otros equipos", lista: players.filter((p) => !p.esCastilla) },
              ]
                .filter((g) => g.lista.length > 0)
                .map((g) => (
                  <optgroup key={g.etiqueta} label={`${g.etiqueta} (${g.lista.length})`}>
                    {g.lista
                      .map((p) => ({ id: p.id, nombre: nombreVisible(p.nombre) }))
                      .sort((a, b) => a.nombre.localeCompare(b.nombre, "es"))
                      .map((p) => (
                        <option key={p.id} value={p.id}>
                          {p.nombre}
                        </option>
                      ))}
                  </optgroup>
                ))}
            </select>
          </div>

          {playerFilter && playersMap[playerFilter] && (
            <EnlacesJugador
              jugador={{ id: playerFilter, nombre: nombreVisible(playersMap[playerFilter].nombre) }}
              destinos={["ficha", "registrar"]}
            />
          )}
        </div>
      }
      renderDay={({ key }) => {
        const daySessions = sessionsByDay.get(key) ?? [];
        const hasSessions = daySessions.length > 0;
        const partido = partidosPorDia.get(key);

        /* 08/11/2026: el «Toca seguir» de la casilla de hoy repetía la franja
           de arriba (que ya da los días); se deja sólo la franja. */

        /* 16/11/2026 (jueces): el día de partido, marcado con su rival y su
           resultado, para leer el seguimiento contra el microciclo. */
        /* 17/11/2026 (ronda 19): la marca es un enlace: jugado, a su análisis
           post; por jugar, al rival ya elegido (goles, ABP, plan). */
        const marcaPartido = partido ? (
          <Link
            href={partido.jugado ? "/data-analisis?area=post" : `/rivals?equipo=${encodeURIComponent(partido.rival)}`}
            onClick={(e) => e.stopPropagation()}
            className="block truncate rounded-md bg-sky-500/15 px-1.5 py-0.5 text-[11px] font-semibold text-sky-300 underline-offset-2 hover:underline"
            title={`Partido · J${partido.jornada} · ${rotuloPartido(partido)} · ${partido.jugado ? "abrir su análisis" : "abrir el rival"}`}
          >
            ⚽ {rotuloPartido(partido)} →
          </Link>
        ) : null;
        const md = mdDe(key);
        const marcaMd = md ? (
          <span className="rounded-full border border-sky-500/40 bg-sky-500/10 px-1.5 py-0.5 text-[11px] font-bold text-sky-300" title="Días que faltan para el próximo partido">
            {md}
          </span>
        ) : null;

        if (!hasSessions) {
          return partido
            ? { hasContent: true, onClick: () => setSelectedKey(key), badges: marcaMd ?? undefined, children: marcaPartido }
            : marcaMd
              ? { badges: marcaMd }
              : {};
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
            <>
            {marcaMd}
            <span className="rounded-full border border-[#C8A96B]/30 bg-[#C8A96B]/10 px-2 py-0.5 text-[11px] font-semibold text-[#C8A96B]">
              {daySessions.length}
              <span className="hidden md:inline">
                {daySessions.length === 1 ? " seguimiento" : " seguimientos"}
              </span>
            </span>
            </>
          ),
          children: (
            <>
              {marcaPartido}
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

                    {/* 16/11/2026 (jueces): sin autor escrito, la segunda
                        línea dice el tipo; la tarjeta no queda con hueco. */}
                    {/* 17/11/2026 (ronda 19): sin autor, nada (el tipo ya lo dice la franja). */}
                    {session.QUIEN?.trim() && (
                      <p className="truncate text-[10px] text-white/60 md:text-[11px]">{session.QUIEN.trim()}</p>
                    )}
                  </div>
                );
              })}

              {/* 17/11/2026 (ronda 19): con más de 3, el reparto por tipo en una barra, para leer el día sin abrirlo. */}
              {hidden > 0 && (
                <span className="flex h-1.5 w-full overflow-hidden rounded-full" title={TIPOS.filter((t) => daySessions.some((x) => strategyKey(x.ESTRATEGIA) === t)).map((t) => `${STRATEGY_STYLES[t].label} ${daySessions.filter((x) => strategyKey(x.ESTRATEGIA) === t).length}`).join(" · ")}>
                  {TIPOS.map((t) => {
                    const n = daySessions.filter((x) => strategyKey(x.ESTRATEGIA) === t).length;
                    return n ? <span key={t} className={STRATEGY_STYLES[t].dot} style={{ width: `${(n / daySessions.length) * 100}%` }} /> : null;
                  })}
                </span>
              )}
              {hidden > 0 && (
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    setSelectedKey(key);
                  }}
                  className="w-full pt-0.5 text-center text-[11px] font-medium text-[#C8A96B] underline-offset-2 hover:underline"
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
            La franja de color de cada tarjeta dice el tipo (la leyenda está
            sobre el calendario); debajo del nombre, quién lo hizo. En azul, el
            día de partido con su rival y su resultado. Pulsar un día abre todos
            sus registros; pulsar una tarjeta, la ficha del jugador.
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
          subtitle={
            selectedSessions.length === 0
              ? "Día de partido"
              : `${selectedSessions.length} ${selectedSessions.length === 1 ? "seguimiento" : "seguimientos"}`
          }
          onClose={() => setSelectedKey(null)}
          onPrev={() => goToDay(selectedIndex - 1)}
          onNext={() => goToDay(selectedIndex + 1)}
          canPrev={selectedIndex > 0}
          canNext={selectedIndex >= 0 && selectedIndex < sessionDays.length - 1}
        >
          <div className="space-y-3">
            {selectedKey && partidosPorDia.get(selectedKey) && (() => {
              const p = partidosPorDia.get(selectedKey)!;

              return (
                <div className="rounded-xl border border-sky-500/30 bg-sky-500/10 p-4">
                  <p className="text-[11px] uppercase tracking-wider text-white/55">Partido · jornada {p.jornada}</p>
                  <p className="mt-1 text-lg font-semibold">{rotuloPartido(p)}</p>
                  {/* El post de Análisis de datos abre en el último partido y
                      deja elegir el resto en su desplegable. */}
                  {!p.jugado && (
                    <Link
                      href={`/rivals?equipo=${encodeURIComponent(p.rival)}`}
                      className="mt-2 inline-flex items-center gap-1 text-sm font-semibold text-[#C8A96B] hover:underline"
                    >
                      El rival: goles, ABP y su once <ArrowRight size={14} aria-hidden />
                    </Link>
                  )}
                  {p.jugado && (
                    <Link
                      href="/data-analisis?area=post"
                      className="mt-2 inline-flex items-center gap-1 text-sm font-semibold text-[#C8A96B] hover:underline"
                    >
                      Análisis del partido <ArrowRight size={14} aria-hidden />
                    </Link>
                  )}
                </div>
              );
            })()}

            {selectedSessions.length === 0 && !(selectedKey && partidosPorDia.get(selectedKey)) && (
              <CalendarEmptyState>
                Elige otro día con las flechas.
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
                        {[session.ESTRATEGIA?.trim(), session.QUIEN?.trim()].filter(Boolean).join(" · ")}
                      </p>

                      {jugador && (
                        <EnlacesJugador
                          jugador={{ id: session.ID_JUGADOR, nombre: nombreVisible(jugador.nombre) }}
                          destinos={["ficha", "seguimiento", "registrar"]}
                          className="mt-2"
                        />
                      )}
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
