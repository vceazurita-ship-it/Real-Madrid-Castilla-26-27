"use client";
import { traeJson } from "@/lib/hojaCsv";
import { ResponsiveConVistas } from "@/components/data/visual/ResponsiveConVistas";

import { useCallback, useEffect, useMemo, useState, type ReactNode } from "react";
import type { LucideIcon } from "lucide-react";
import { nombrePuesto } from "@/lib/posiciones";
import { nombreVisible } from "@/lib/nombreJugador";
import { chipInk } from "@/lib/theme";

/* Cifras con coma decimal, como el resto del área de jugadores. */
/* 19/11/2026: redondea siempre a un decimal (salía «68,36461126005362 %»). */
const cm = (v: ReactNode) =>
  typeof v === "number" ? String(Math.round(v * 10) / 10).replace(".", ",") : v;

import { Sidebar } from "@/components/ui/sidebar";
import { Topbar } from "@/components/ui/topbar";
import { usePlayers } from "@/hooks/usePlayers";
import { alineaSeguimiento, DIAS_SIN_SEGUIMIENTO, esDeSeguimiento, medianaSeguimientos, sinSeguimientoReciente } from "@/lib/seguimiento";
import { recordDateKey } from "@/lib/calendar";
import { mismoJugador } from "@/lib/fichajes";
import { PLAYER_PHOTO_FALLBACK } from "@/lib/playerImages";
import { descargaEnMarcha, encargaDescarga } from "@/lib/trabajos/descargas";
import { EnlacesJugador, NombreJugador } from "@/components/individual/EnlacesJugador";

import {
  AlertTriangle,
  ArrowDown,
  ArrowUp,
  CalendarDays,
  ChevronDown,
  Clock,
  Download,
  Layers,
  MessageSquareText,
  Minus,
  Search,
  Sparkles,
  Target,
  TrendingUp,
  UserCheck,
  Users,
  Video,
} from "lucide-react";

import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  PieChart,
  Pie,
  Cell,
  LineChart,
  Line,
  LabelList,
} from "recharts";


type TrackingRecord = {
  ID_REGISTRO: string;
  ID_JUGADOR: string;
  FECHA: string;
  OBJETIVO_OFENSIVO: string;
  OBJETIVO_DEFENSIVO: string;
  OBJETIVO_MENTAL: string;
  FEEDBACK: string;
  QUIEN: string;
  MODALIDAD: string;
  MOMENTO: string;
  ESTRATEGIA: string;
  FECHA_CREACION?: string;
  NOMBRE?: string;
};

const MONTHS = [
  "",
  "Enero",
  "Febrero",
  "Marzo",
  "Abril",
  "Mayo",
  "Junio",
  "Julio",
  "Agosto",
  "Septiembre",
  "Octubre",
  "Noviembre",
  "Diciembre",
];

const GOLD = "#C8A96B";

const COLORS = [
  "#C8A96B",
  "#6E7F99",
  "#4C7A67",
  "#8B5E5E",
  "#8B5CF6",
  "#3B82F6",
  "#10B981",
  "#F97316",
];

const AXIS = { fill: "#94A3B8", fontSize: 11 };

/* ------------------------------------------------------------------ */
/* Helpers                                                             */
/* ------------------------------------------------------------------ */

const SEASON_START_MONTH = 6; // julio (0-index)
const SEASON_START_DAY = 8;

/*
| 08/11/2026 (jueces): las semanas van de LUNES a domingo, como el microciclo.
| El 8 de julio de 2026 cae en miércoles: las semanas salían de miércoles a
| martes y el «día 6 de 7» no cuadraba. Se arranca en el lunes de esa semana.
*/
/*
| Estrategia y entrenador vienen compuestos en la hoja («VÍDEO Y CHARLA»,
| «JULIÁN Y MIGUEL»). Filtrar por «VÍDEO» dejaba fuera los de vídeo y charla
| (16/11/2026): un valor casa si tiene todas las partes del elegido.
*/
const partes = (v: unknown) =>
  String(v ?? "")
    .toUpperCase()
    .split(/\s+Y\s+|\s*[,/+]\s*/)
    .map((p) => p.trim())
    .filter(Boolean);

function contiene(valor: unknown, elegido: string) {
  const suyas = new Set(partes(valor));

  return partes(elegido).every((p) => suyas.has(p));
}

/** Las opciones del filtro: primero cada parte suelta, luego las combinaciones que hay. */
function conPartes(valores: string[]) {
  const sueltas = [...new Set(valores.flatMap((v) => partes(v)))].sort();

  return [...sueltas, ...valores.filter((v) => partes(v).length > 1)];
}

/*
| ENTRENADORES, UNO A UNO (16/11/2026, jueces). La hoja escribe «JULIÁN Y
| MIGUEL» o «TODOS»: el filtro ofrece sólo a cada autor y casa por «incluye
| a»; el registro de «JULIÁN Y MIGUEL» sale con Julián y con Miguel, y el de
| «TODOS» (todo el cuerpo técnico) con cualquiera.
*/
const TODOS_EL_CUERPO = "TODOS";
const CUERPO_TECNICO = "Todo el cuerpo técnico";

function autores(valor: unknown) {
  return partes(valor).filter((p) => p !== TODOS_EL_CUERPO);
}

function incluyeA(valor: unknown, entrenador: string) {
  if (entrenador === CUERPO_TECNICO) return partes(valor).includes(TODOS_EL_CUERPO);

  return partes(valor).includes(TODOS_EL_CUERPO) || contiene(valor, entrenador);
}

function lunesDeTemporada(año: number) {
  const d = new Date(año, SEASON_START_MONTH, SEASON_START_DAY);
  d.setDate(d.getDate() - ((d.getDay() + 6) % 7));
  return d;
}

function getSeasonWeek(fecha: string) {
  const d = new Date(fecha);

  const seasonStartYear =
    d.getMonth() >= SEASON_START_MONTH ? d.getFullYear() : d.getFullYear() - 1;

  const seasonStart = lunesDeTemporada(seasonStartYear);

  const diffDays = Math.floor(
    (d.getTime() - seasonStart.getTime()) / 86400000
  );

  return Math.floor(diffDays / 7) + 1;
}

/** «lun 2 – dom 8 nov»: la semana de temporada `week`; la fecha de un registro da el año. */
function inicioDeSemana(week: number, referencia: string) {
  const d = new Date(referencia);

  const año =
    d.getMonth() >= SEASON_START_MONTH ? d.getFullYear() : d.getFullYear() - 1;

  const inicio = lunesDeTemporada(año);
  inicio.setDate(inicio.getDate() + (week - 1) * 7);
  const fin = new Date(inicio);
  fin.setDate(fin.getDate() + 6);

  const mes = (x: Date) => x.toLocaleDateString("es-ES", { month: "short" }).replace(".", "");

  return inicio.getMonth() === fin.getMonth()
    ? `lun ${inicio.getDate()} – dom ${fin.getDate()} ${mes(fin)}`
    : `lun ${inicio.getDate()} ${mes(inicio)} – dom ${fin.getDate()} ${mes(fin)}`;
}

const norm = (v?: string) =>
  String(v || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim();

function fmtFecha(v: string) {
  const d = new Date(v);

  if (isNaN(d.getTime())) return v;

  return d.toLocaleDateString("es-ES", {
    weekday: "short",
    day: "2-digit",
    month: "short",
  });
}

/**
 * La fecha de un registro, sólo si tiene sentido.
 *
 * La hoja trae fechas imposibles —un año mal escrito basta— y con ellas el
 * panel decía «último registro hace -29219184 días»: una fecha del año 82000
 * ordenaba primero y salía como lo más reciente. Se descarta lo que no caiga
 * entre 2000 y mañana; y lo que no es fecha, tampoco.
 */
const HOY_MAS_UNO = () => Date.now() + 86400000;

function fechaValida(v: string): Date | null {
  const d = new Date(v);
  const t = d.getTime();

  if (isNaN(t)) return null;
  if (t < Date.UTC(2000, 0, 1) || t > HOY_MAS_UNO()) return null;

  return d;
}

function daysAgo(v: string) {
  const d = fechaValida(v);

  if (!d) return null;

  /* 10/11/2026: días de calendario (de medianoche a medianoche), la misma
     cuenta que /calendar e /individual; por horas, un registro de ayer por
     la tarde era «hoy». */
  const ahora = new Date();
  const hoy0 = new Date(ahora.getFullYear(), ahora.getMonth(), ahora.getDate()).getTime();
  const dia0 = new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();

  return Math.round((hoy0 - dia0) / 86400000);
}

/** «hoy», «ayer» o «hace N días»: lo que se dice en voz alta. */
function hace(dias: number) {
  if (dias <= 0) return "hoy";
  if (dias === 1) return "ayer";

  return `hace ${dias} días`;
}

/** Lo mismo para una cifra suelta: «hoy», «ayer», «5d». */
function corto(dias: number) {
  if (dias <= 0) return "hoy";
  if (dias === 1) return "ayer";

  return `${dias}d`;
}

function pct(part: number, total: number) {
  return total ? +((part / total) * 100).toFixed(1) : 0;
}

/** Cuántos registros hay de cada valor de una columna, de más a menos. */
function countBy(
  registros: TrackingRecord[],
  key: keyof TrackingRecord,
  totalSessions: number,
) {
  const map: Record<string, number> = {};

  registros.forEach((s) => {
    const raw = String(s[key] ?? "").trim();

    if (!raw) return;

    map[raw] = (map[raw] ?? 0) + 1;
  });

  return Object.entries(map)
    .map(([name, value]) => ({
      name,
      value,
      percentage: pct(value, totalSessions),
    }))
    .sort((a, b) => b.value - a.value);
}

/** Trims boilerplate text so the feed stays readable */
function clean(text?: string) {
  const t = (text || "").trim();

  return t && t !== "-" ? t : "";
}

type TabKey = "resumen" | "jugadores" | "contenidos" | "registros";

const TABS: { key: TabKey; label: string; icon: LucideIcon }[] = [
  { key: "resumen", label: "Resumen", icon: Sparkles },
  { key: "jugadores", label: "Jugadores", icon: Users },
  { key: "contenidos", label: "Metodología", icon: Layers },
  { key: "registros", label: "Registros", icon: MessageSquareText },
];

const emptyFilters = {
  player: "",
  position: "",
  coach: "",
  strategy: "",
  modality: "",
  moment: "",
  month: "",
  week: "",
};

type Filters = typeof emptyFilters;

/* ------------------------------------------------------------------ */
/* Page                                                                */
/* ------------------------------------------------------------------ */

export default function DashboardSeguimiento() {
  const { players: plantillaEntera } = usePlayers();

  const [crudoTracking, setTracking] = useState<TrackingRecord[]>([]);

  /*
  | La plantilla de este panel no es la plantilla entera: `esDeSeguimiento`
  | (`lib/seguimiento.ts`, la misma regla que usa la portada) deja fuera a
  | los que no tienen licencia del Castilla y a los porteros. Se filtra aquí,
  | en un sitio, y de aquí cuelga todo lo demás —los KPI, las gráficas, los
  | filtros y la exportación—, así que ningún número de la pantalla los cuenta.
  */
  const players = useMemo(
    () => plantillaEntera.filter(esDeSeguimiento),
    [plantillaEntera],
  );

  /*
  | El nombre manda sobre el ID: la hoja JUGADORES ha renumerado los JUG-XX y
  | un seguimiento viejo apunta hoy a otra persona (ver `lib/seguimiento.ts`).
  |
  | El cruce se hace contra la plantilla ENTERA a propósito: un registro de un
  | portero también tiene que resolverse a su dueño, o se quedaría con un ID
  | viejo que hoy es de otro y se colaría aquí a nombre de quien no es.
  */
  const alineados = useMemo(
    () => alineaSeguimiento(crudoTracking, plantillaEntera),
    [crudoTracking, plantillaEntera],
  );

  const idsEnPanel = useMemo(
    () => new Set(players.map((jugador) => jugador.id)),
    [players],
  );

  const delGrupo = useMemo(
    () => alineados.filter((s) => idsEnPanel.has(s.ID_JUGADOR)),
    [alineados, idsEnPanel],
  );

  /*
  | Y **fuera lo que no tiene fecha usable**. Todo este panel se ordena por
  | fecha: la semana de temporada, el mes, la media semanal, el mapa de calor
  | y el «último registro». Un `FECHA` vacío —la hoja tiene dos, los dos con
  | el mismo ID_REGISTRO— sale como semana `NaN`, cuenta como una semana
  | activa más y puede colarse como el registro más reciente. Se dice cuántos
  | son al lado del total, para que no desaparezcan en silencio.
  */
  const [hoy] = useState(() => new Date());

  const tracking = useMemo(
    () => {
      /* La temporada entera (16/11/2026: el corte del 21/10 era sólo para las
         sesiones de entrenamiento, no para los seguimientos). Lo que no tiene
         fecha no entra en ningún cálculo ni texto de la pantalla.
         10/11/2026: y nada fechado después de hoy (un registro del 11/11
         salía como «Último registro: hoy»): eso es lo programado. */
      const hasta = new Date(hoy.getFullYear(), hoy.getMonth(), hoy.getDate(), 23, 59, 59, 999).getTime();
      return delGrupo.filter((s) => {
        const d = fechaValida(s.FECHA);
        return d !== null && d.getTime() <= hasta;
      });
    },
    [delGrupo, hoy],
  );

  const sinFecha = 0;
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<TabKey>("resumen");
  const [search, setSearch] = useState("");
  /* 20/11/2026: `?buscar=humildad` (desde los valores de /team-values e
     /identidad-cultura) abre el seguimiento con la búsqueda puesta. */
  useEffect(() => {
    const buscar = new URLSearchParams(window.location.search).get("buscar");

    // eslint-disable-next-line react-hooks/set-state-in-effect -- se lee la dirección una vez al montar
    if (buscar) setSearch(buscar);
  }, []);
  // 29/10/2026: en el móvil los 8 desplegables ocupaban casi dos pantallas
  // antes del primer dato; van plegados tras un botón «Filtros (n)».
  /* 07/11/2026: los filtros secundarios (estrategia, modalidad, momento, mes
     y semana) van plegados en «Más filtros»; se abren solos si hay alguno puesto. */
  const [masFiltros, setMasFiltros] = useState(false);
  const [expanded, setExpanded] = useState<string | null>(null);
  const [filters, setFilters] = useState<Filters>(emptyFilters);
  /*
  | 20/11/2026 (ronda 5, jueces): ?jugador=NOMBRE (y ?player=ID) abre el
  | Dashboard con ese jugador ya filtrado, desde su ficha de /individual,
  | Emocional, Valoraciones… Se casa por nombre antes que por ID (la hoja
  | renumera los JUG-XX). Una vez, en cuanto llega la plantilla.
  */
  const [urlAplicada, setUrlAplicada] = useState(false);

  useEffect(() => {
    if (urlAplicada || players.length === 0) return;

    const params = new URLSearchParams(window.location.search);
    const nombre = params.get("jugador");
    const id = params.get("player");
    const elegido =
      (nombre ? players.find((p) => mismoJugador(p.nombre, nombre)) : undefined) ??
      (id ? players.find((p) => p.id === id) : undefined);

    const t = window.setTimeout(() => {
      setUrlAplicada(true);
      if (elegido) setFilters((antes) => ({ ...antes, player: elegido.id }));
    }, 0);

    return () => window.clearTimeout(t);
  }, [players, urlAplicada]);

  const secundariosActivos = [filters.strategy, filters.modality, filters.moment, filters.month, filters.week].filter(Boolean).length;
  const verSecundarios = masFiltros || secundariosActivos > 0;

  /*
  | Cuántos registros enseña el listado. Vuelve a 20 en cuanto cambian los
  | filtros, la búsqueda o la pestaña: se guarda junto a lo que había cuando
  | se pidió «ver más» y, si ya no coincide, vale 20. Se deriva al pintar en
  | vez de reiniciarlo con un efecto.
  */
  const [feedPaginado, setFeedPaginado] = useState({
    filters,
    search,
    tab,
    limite: 20,
  });

  const feedLimit =
    feedPaginado.filters === filters &&
    feedPaginado.search === search &&
    feedPaginado.tab === tab
      ? feedPaginado.limite
      : 20;

  const verMasFeed = () =>
    setFeedPaginado({ filters, search, tab, limite: feedLimit + 20 });

  useEffect(() => {
    let cancelled = false;

    /* 20/11/2026 (ronda 5): la copia del aparato se repinta en cuanto llega
       lo nuevo, como en /individual y /calendar (las tres, la misma lista). */
    traeJson<unknown>("/api/rivals?action=seguimiento", {
      alRenovar: (nuevo) => {
        if (!cancelled && Array.isArray(nuevo)) setTracking(nuevo);
      },
    })
      .then((data) => {
        if (cancelled) return;
        setTracking(Array.isArray(data) ? data : []);
        setLoading(false);
      })
      .catch((e) => {
        console.error(e);
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, []);

  const playerMap = useMemo(
    () => Object.fromEntries(players.map((p) => [p.id, p])),
    [players]
  );

  const nameOf = useCallback(
    (r: TrackingRecord) =>
      playerMap[r.ID_JUGADOR]?.nombre ?? r.NOMBRE ?? r.ID_JUGADOR,
    [playerMap],
  );

  /* ---------------- filtering ---------------- */

  const filteredTracking = useMemo(() => {
    const q = norm(search);

    return tracking.filter((s) => {
      const jugador = playerMap[s.ID_JUGADOR];
      const month = new Date(s.FECHA).getMonth() + 1;
      const week = getSeasonWeek(s.FECHA);

      if (filters.player && s.ID_JUGADOR !== filters.player) return false;
      /* «VÍDEO» también trae los de «VÍDEO Y CHARLA», y «JULIÁN» los de «JULIÁN Y MIGUEL» (16/11/2026). */
      if (filters.strategy && !contiene(s.ESTRATEGIA, filters.strategy)) return false;
      if (filters.coach && !incluyeA(s.QUIEN, filters.coach)) return false;
      if (filters.modality && s.MODALIDAD !== filters.modality) return false;
      if (filters.moment && s.MOMENTO !== filters.moment) return false;
      if (filters.month && month !== Number(filters.month)) return false;
      if (filters.week && week !== Number(filters.week)) return false;
      if (filters.position && jugador?.posicion !== filters.position)
        return false;

      if (
        q &&
        !norm(
          `${nameOf(s)} ${s.FEEDBACK} ${s.OBJETIVO_OFENSIVO} ${s.OBJETIVO_DEFENSIVO} ${s.OBJETIVO_MENTAL} ${s.ESTRATEGIA} ${s.QUIEN}`
        ).includes(q)
      )
        return false;

      return true;
    });
  }, [tracking, playerMap, filters, search, nameOf]);

  const activeFilterCount =
    Object.values(filters).filter(Boolean).length + (search ? 1 : 0);

  const updateFilter = (key: keyof Filters, value: string) =>
    setFilters((prev) => ({ ...prev, [key]: value }));

  /* ---------------- KPIs ---------------- */

  const totalSessions = filteredTracking.length;

  const trackedIds = useMemo(
    () => new Set(filteredTracking.map((s) => s.ID_JUGADOR)),
    [filteredTracking]
  );

  const weeksSet = useMemo(
    () => new Set(filteredTracking.map((s) => getSeasonWeek(s.FECHA))),
    [filteredTracking]
  );

  const totalWeeks = weeksSet.size;

  const averageWeek = totalWeeks
    ? +(totalSessions / totalWeeks).toFixed(1)
    : 0;

  /*
  | La cobertura es **de la plantilla de ahora**, no de todo el que aparezca
  | en la hoja.
  |
  | Contar a cualquiera con registros mete a gente que se fue: por eso salía
  | «39 de 40 · 97,5%» a la vez que «5 sin registro», que no puede ser. Se
  | cuenta a los de la plantilla que sí tienen seguimiento, y sobre el mismo
  | grupo que la lista de los que no lo tienen —si hay filtro de posición, los
  | de esa posición—.
  */
  const plantillaEnFoco = useMemo(
    () =>
      players.filter(
        (p) => !filters.position || p.posicion === filters.position,
      ),
    [players, filters.position],
  );

  const squadSize = plantillaEnFoco.length;

  const cubiertos = useMemo(
    () => plantillaEnFoco.filter((p) => trackedIds.has(p.id)).length,
    [plantillaEnFoco, trackedIds],
  );

  const coverage = pct(cubiertos, squadSize);

  /*
  | Las sesiones **de los que siguen aquí**.
  |
  | Hay registros de gente que se fue —hoy nueve de 277, todos sin nombre en
  | la hoja, así que no hay a quién atarlos—. Repartirlos entre la plantilla
  | de ahora infla el promedio; y dividir entre todos los identificadores que
  | aparecen, como se hacía, lo hunde: salía 6,9 por jugador aquí mientras la
  | portada decía 8,1 de lo mismo. Lo correcto es 7,9, y ahora las dos
  | pantallas lo cuentan igual.
  */
  const idsEnFoco = useMemo(
    () => new Set(plantillaEnFoco.map((jugador) => jugador.id)),
    [plantillaEnFoco],
  );

  const sesionesDeLaPlantilla = useMemo(
    () => filteredTracking.filter((s) => idsEnFoco.has(s.ID_JUGADOR)).length,
    [filteredTracking, idsEnFoco],
  );

  const lastRecord = useMemo(() => {
    /* Sólo entre los que tienen fecha de verdad: una fecha imposible ordenaba
       primero y se anunciaba como el último seguimiento hecho. */
    const conFecha = filteredTracking.filter((s) => fechaValida(s.FECHA));

    if (!conFecha.length) return null;

    return [...conFecha].sort(
      (a, b) =>
        (fechaValida(b.FECHA)?.getTime() ?? 0) -
        (fechaValida(a.FECHA)?.getTime() ?? 0)
    )[0];
  }, [filteredTracking]);

  const sinceLast = lastRecord ? daysAgo(lastRecord.FECHA) : null;

  const individualShare = pct(
    filteredTracking.filter((s) => norm(s.MODALIDAD) === "individual").length,
    totalSessions
  );

  /* ---------------- per player ---------------- */

  const playerChart = useMemo(() => {
    const map: Record<
      string,
      { id: string; value: number; weeks: Set<number>; last: string }
    > = {};

    filteredTracking.forEach((s) => {
      const nombre = nameOf(s);

      if (!map[nombre]) {
        map[nombre] = {
          id: s.ID_JUGADOR,
          value: 0,
          weeks: new Set(),
          last: s.FECHA,
        };
      }

      map[nombre].value += 1;
      map[nombre].weeks.add(getSeasonWeek(s.FECHA));

      if (new Date(s.FECHA) > new Date(map[nombre].last)) {
        map[nombre].last = s.FECHA;
      }
    });

    return Object.entries(map)
      .map(([name, v]) => ({
        name,
        id: v.id,
        value: v.value,
        semanas: v.weeks.size,
        last: v.last,
        dias: daysAgo(v.last),
        percentage: pct(v.value, totalSessions),
        posicion: playerMap[v.id]?.posicion ?? "—",
        foto: playerMap[v.id]?.foto ?? PLAYER_PHOTO_FALLBACK,
        dorsal: playerMap[v.id]?.dorsal,
      }))
      .sort((a, b) => b.value - a.value);
  }, [filteredTracking, playerMap, totalSessions, nameOf]);

  const mostTrackedPlayer = playerChart[0] ?? { name: "—", value: 0 };

  const leastTrackedPlayer =
    playerChart[playerChart.length - 1] ?? { name: "—", value: 0 };

  const avgPerPlayer = cubiertos
    ? +(sesionesDeLaPlantilla / cubiertos).toFixed(1)
    : 0;

  /** Players in the squad with zero records under the current filters */
  const untrackedPlayers = useMemo(() => {
    return plantillaEnFoco.filter((p) => !trackedIds.has(p.id));
  }, [plantillaEnFoco, trackedIds]);

  /*
  | COBERTURA EN 14 DÍAS (16/11/2026, jueces). «Cobertura 100 %» en verde al
  | lado de «3 sin seguimiento en 14 días» parecía una contradicción: eran dos
  | ventanas. La tarjeta va ahora en la MISMA ventana que el aviso (14 días que
  | acaban hoy, regla de lib/seguimiento) y la de temporada queda debajo.
  */
  const sinSeguir14 = useMemo(
    () => sinSeguimientoReciente(delGrupo, plantillaEnFoco, hoy, (fecha) => recordDateKey(fecha)),
    [delGrupo, plantillaEnFoco, hoy],
  );

  const cubiertos14 = squadSize - sinSeguir14.length;
  const coverage14 = pct(cubiertos14, squadSize);

  /* La mediana de registros por jugador de campo (con los que tienen 0): la
     referencia de «por jugador» y la raya del ranking. */
  const medianaPorJugador = useMemo(() => {
    const cuenta = new Map<string, number>();

    filteredTracking.forEach((s) => cuenta.set(s.ID_JUGADOR, (cuenta.get(s.ID_JUGADOR) ?? 0) + 1));

    /* La misma cuenta que /individual (lib/seguimiento, 17/11/2026). */
    return medianaSeguimientos(plantillaEnFoco.map((p) => cuenta.get(p.id) ?? 0));
  }, [filteredTracking, plantillaEnFoco]);

  /* 30/10/2026: el último registro de cada uno en TODA la temporada (no sólo
     desde el corte): «sin ningún registro desde el 21/10 · último: 30/09». */
  const ultimoEnTemporada = useMemo(() => {
    const mapa = new Map<string, Date>();

    delGrupo.forEach((s) => {
      const d = fechaValida(s.FECHA);
      if (!d) return;
      const previo = mapa.get(s.ID_JUGADOR);
      if (!previo || d > previo) mapa.set(s.ID_JUGADOR, d);
    });

    return mapa;
  }, [delGrupo]);

  /** Players whose last contact is the oldest — actionable list */
  const staleContacts = useMemo(() => {
    return [...playerChart]
      .filter((p) => p.dias !== null)
      .sort((a, b) => (b.dias ?? 0) - (a.dias ?? 0))
      .slice(0, 6);
  }, [playerChart]);

  /* ---------------- categorical breakdowns ---------------- */

  /* 29/10/2026: los porcentajes de estrategia y momento se calculan sobre los
     registros que traen ese dato, que es lo que suma el anillo (31 de 34 y no
     «11 = 32,4 %» con 31 en el centro). */
  const conEstrategia = useMemo(
    () => filteredTracking.filter((s) => String(s.ESTRATEGIA ?? "").trim()).length,
    [filteredTracking]
  );

  const conMomento = useMemo(
    () => filteredTracking.filter((s) => String(s.MOMENTO ?? "").trim()).length,
    [filteredTracking]
  );

  const strategyData = useMemo(
    () => countBy(filteredTracking, "ESTRATEGIA", conEstrategia),
    [filteredTracking, conEstrategia]
  );

  const modalityData = useMemo(
    () => countBy(filteredTracking, "MODALIDAD", totalSessions),
    [filteredTracking, totalSessions]
  );

  const momentData = useMemo(
    () => countBy(filteredTracking, "MOMENTO", conMomento),
    [filteredTracking, conMomento]
  );

  /* 16/11/2026: por autor suelto (un registro de «JULIÁN Y MIGUEL» suma a los
     dos; el de «TODOS», en su propia fila de todo el cuerpo técnico). */
  const coachData = useMemo(() => {
    const mapa: Record<string, number> = {};

    filteredTracking.forEach((s) => {
      if (partes(s.QUIEN).includes(TODOS_EL_CUERPO)) mapa[CUERPO_TECNICO] = (mapa[CUERPO_TECNICO] ?? 0) + 1;

      autores(s.QUIEN).forEach((a) => {
        mapa[a] = (mapa[a] ?? 0) + 1;
      });
    });

    return Object.entries(mapa)
      .map(([name, value]) => ({ name, value, percentage: pct(value, totalSessions) }))
      .sort((a, b) => b.value - a.value);
  }, [filteredTracking, totalSessions]);

  const positionData = useMemo(() => {
    const map: Record<string, { value: number; jugadores: Set<string> }> = {};

    filteredTracking.forEach((s) => {
      const pos = playerMap[s.ID_JUGADOR]?.posicion || "Sin posición";

      if (!map[pos]) map[pos] = { value: 0, jugadores: new Set() };

      map[pos].value += 1;
      map[pos].jugadores.add(s.ID_JUGADOR);
    });

    return Object.entries(map)
      .map(([name, v]) => ({
        name,
        value: v.value,
        jugadores: v.jugadores.size,
        media: +(v.value / v.jugadores.size).toFixed(1),
        percentage: pct(v.value, totalSessions),
      }))
      .sort((a, b) => b.value - a.value);
  }, [filteredTracking, playerMap, totalSessions]);

  /* ---------------- objectives focus ---------------- */

  const focusData = useMemo(() => {
    let of = 0;
    let def = 0;
    let men = 0;

    filteredTracking.forEach((s) => {
      if (clean(s.OBJETIVO_OFENSIVO)) of += 1;
      if (clean(s.OBJETIVO_DEFENSIVO)) def += 1;
      if (clean(s.OBJETIVO_MENTAL)) men += 1;
    });

    return [
      { name: "Ofensivo", value: of, percentage: pct(of, totalSessions) },
      { name: "Defensivo", value: def, percentage: pct(def, totalSessions) },
      { name: "Mental", value: men, percentage: pct(men, totalSessions) },
    ];
  }, [filteredTracking, totalSessions]);

  const withFeedback = filteredTracking.filter((s) =>
    clean(s.FEEDBACK)
  ).length;

  /* 17/11/2026 (ronda 20, jueces): quién deja el feedback vacío (por autor;
     un registro compartido cuenta a cada uno). */
  const sinFeedbackPorAutor = (() => {
    const cuenta = new Map<string, number>();
    filteredTracking
      .filter((s) => !clean(s.FEEDBACK))
      .forEach((s) => {
        const quien = autores(s.QUIEN);
        (quien.length ? quien : ["sin autor escrito"]).forEach((a) => cuenta.set(a, (cuenta.get(a) ?? 0) + 1));
      });
    return [...cuenta.entries()].sort((a, b) => b[1] - a[1]);
  })();

  /* ---------------- weekly evolution ---------------- */

  const weeklyData = useMemo(() => {
    /* 16/11/2026 (jueces): cada barra partida en individual y grupal; un pico
       de 69 en una semana era sobre todo registros grupales (un mismo trabajo
       apuntado a muchos) y se leía como un mérito. */
    const map: Record<number, { value: number; individual: number; jugadores: Set<string> }> = {};

    filteredTracking.forEach((s) => {
      const week = getSeasonWeek(s.FECHA);

      if (!map[week]) map[week] = { value: 0, individual: 0, jugadores: new Set() };

      map[week].value += 1;
      if (norm(s.MODALIDAD) === "individual") map[week].individual += 1;
      map[week].jugadores.add(s.ID_JUGADOR);
    });

    const weeks = Object.keys(map).map(Number).sort((a, b) => a - b);

    if (!weeks.length) return [];

    const out: {
      week: string;
      desde: string;
      value: number;
      individual: number;
      grupal: number;
      jugadores: number;
      percentage: number;
    }[] = [];

    for (let w = weeks[0]; w <= weeks[weeks.length - 1]; w++) {
      out.push({
        week: `S${w}`,
        desde: inicioDeSemana(w, filteredTracking[0].FECHA),
        value: map[w]?.value ?? 0,
        individual: map[w]?.individual ?? 0,
        grupal: (map[w]?.value ?? 0) - (map[w]?.individual ?? 0),
        jugadores: map[w]?.jugadores.size ?? 0,
        percentage: pct(map[w]?.value ?? 0, totalSessions),
      });
    }

    return out;
  }, [filteredTracking, totalSessions]);

  /* 30/10/2026: qué día de la semana es hoy (1 = lunes), para no comparar
     una semana a medias con una entera. */
  const diaDeSemana = ((hoy.getDay() + 6) % 7) + 1;
  /* Fecha LOCAL (08/11/2026): con toISOString, entre las 00:00 y las 02:00 de un lunes aún era domingo en UTC y la semana en curso salía como la anterior. */
  const semanaDeHoy = `S${getSeasonWeek(`${hoy.getFullYear()}-${String(hoy.getMonth() + 1).padStart(2, "0")}-${String(hoy.getDate()).padStart(2, "0")}`)}`;

  /* 08/11/2026 (jueces): la media sólo con semanas completas; la que va en
     curso se pinta, pero no entra en la media. */
  /* 10/11/2026: tampoco la primera si el conteo empezó a media semana (el
     21/10 fue miércoles): «3 semanas completas» eran 2 y una de 5 días. */
  const primerDia = tracking.reduce((min, s) => (String(s.FECHA).slice(0, 10) < min ? String(s.FECHA).slice(0, 10) : min), "9999-12-31");
  const semanaDeInicio = `S${getSeasonWeek(`${primerDia}T12:00:00`)}`;
  const inicioEnLunes = new Date(`${primerDia}T12:00:00`).getDay() === 1;
  const semanasCerradas = weeklyData.filter(
    (w) => !(w.week === semanaDeHoy && diaDeSemana < 7) && (inicioEnLunes || w.week !== semanaDeInicio),
  );
  const weeklyMean = semanasCerradas.length
    ? +(
        semanasCerradas.reduce((a, b) => a + b.value, 0) / semanasCerradas.length
      ).toFixed(1)
    : 0;

  /* 27/11/2026 (fútbol, ronda 9): la media de las 7 últimas semanas cerradas,
     la ventana del gráfico de Calendario, para que las dos cifras se lean
     juntas y no choquen (19,7 en la temporada frente a 16,3 en 7 semanas). */
  const ultimas7 = semanasCerradas.slice(-7);
  const mediaUltimas7 = ultimas7.length >= 2 ? +(ultimas7.reduce((a, b) => a + b.value, 0) / ultimas7.length).toFixed(1) : null;

  /* La semana pico, dicha con lo que la explica (16/11/2026). */
  const notaDelPico = (() => {
    if (weeklyData.length < 3 || !weeklyMean) return "";

    const pico = weeklyData.reduce((a, b) => (b.value > a.value ? b : a));

    if (pico.value < weeklyMean * 1.5) return "";

    /* Con el mes (19/11/2026): «semana del 21 – 27 sep», no «semana del 21». */
    const semana = pico.desde.replace(/(lun|dom) /g, "");
    const deGrupo = pico.grupal >= pico.value / 2;

    return `El pico (${pico.value}, semana del ${semana}) ${
      deGrupo
        ? `es sobre todo de registros grupales (${pico.grupal} de ${pico.value}): un mismo trabajo apuntado a varios jugadores, no más contacto uno a uno`
        : `es sobre todo de registros individuales (${pico.individual} de ${pico.value})`
    }.`;
  })();

  const weeklyDelta = useMemo(() => {
    if (weeklyData.length < 3) return null;
    /* La última semana va a medias: se compara la anterior con la otra. */
    if (weeklyData[weeklyData.length - 1].week === semanaDeHoy && diaDeSemana < 7) return null;

    const last = weeklyData[weeklyData.length - 1].value;
    const prev = weeklyData[weeklyData.length - 2].value;

    return last - prev;
  }, [weeklyData, semanaDeHoy, diaDeSemana]);

  const monthlyData = useMemo(() => {
    const map: Record<number, number> = {};

    filteredTracking.forEach((s) => {
      const m = new Date(s.FECHA).getMonth() + 1;

      map[m] = (map[m] ?? 0) + 1;
    });

    return Object.entries(map)
      .map(([m, value]) => ({
        name: MONTHS[Number(m)],
        month: Number(m),
        value,
        percentage: pct(value, totalSessions),
      }))
      .sort((a, b) => a.month - b.month);
  }, [filteredTracking, totalSessions]);

  /* ---------------- heatmap player x week ---------------- */

  const heatmap = useMemo(() => {
    const weeks = [...weeksSet].sort((a, b) => a - b);

    const rows = playerChart.slice(0, 30).map((p) => ({
      name: p.name,
      id: p.id,
      total: p.value,
      cells: weeks.map((w) => ({
        week: w,
        count: filteredTracking.filter(
          (s) => s.ID_JUGADOR === p.id && getSeasonWeek(s.FECHA) === w
        ).length,
      })),
    }));

    const max = Math.max(
      ...rows.flatMap((r) => r.cells.map((c) => c.count)),
      1
    );

    return { weeks, rows, max };
  }, [playerChart, filteredTracking, weeksSet]);

  /* ---------------- strategy x moment matrix (16/11/2026) ---------------- */

  /* En vez de un segundo anillo, el cruce: qué recurso se usa en cada momento
     (marketing: «la matriz estrategia × momento sí aporta algo nuevo»). */
  const estrategiaMomento = useMemo(() => {
    const filas = strategyData.map((st) => ({
      estrategia: st.name,
      total: st.value,
      celdas: momentData.map((m) => ({
        momento: m.name,
        n: filteredTracking.filter(
          (s) => String(s.ESTRATEGIA ?? "").trim() === st.name && String(s.MOMENTO ?? "").trim() === m.name,
        ).length,
      })),
    }));

    const max = Math.max(1, ...filas.flatMap((f) => f.celdas.map((c) => c.n)));

    let mayor = { estrategia: "", momento: "", n: 0 };

    filas.forEach((f) => f.celdas.forEach((c) => {
      if (c.n > mayor.n) mayor = { estrategia: f.estrategia, momento: c.momento, n: c.n };
    }));

    return { filas, max, mayor };
  }, [strategyData, momentData, filteredTracking]);

  /* ---------------- coach x strategy matrix ---------------- */

  const coachStrategyMatrix = useMemo(() => {
    const strategies = strategyData.map((s) => s.name);

    const rows = coachData.map((c) => ({
      coach: c.name,
      total: c.value,
      cells: strategies.map((st) => ({
        strategy: st,
        count: filteredTracking.filter(
          (s) =>
            (c.name === CUERPO_TECNICO ? partes(s.QUIEN).includes(TODOS_EL_CUERPO) : contiene(s.QUIEN, c.name)) &&
            contiene(s.ESTRATEGIA, st)
        ).length,
      })),
    }));

    const max = Math.max(...rows.flatMap((r) => r.cells.map((c) => c.count)), 1);

    return { strategies, rows, max };
  }, [coachData, strategyData, filteredTracking]);

  /* ---------------- feed ---------------- */

  const feed = useMemo(
    () =>
      [...filteredTracking].sort(
        (a, b) => new Date(b.FECHA).getTime() - new Date(a.FECHA).getTime()
      ),
    [filteredTracking]
  );

  /* ---------------- insights ---------------- */

  const insights = useMemo(() => {
    /* 16/11/2026: las lecturas que nombran jugadores los llevan aparte, para
       pintarlos como enlaces (su ficha, su calendario y registrar). */
    const out: {
      icon: LucideIcon;
      tone: string;
      text: string;
      jugadores?: { id: string; nombre: string; detalle: string }[];
      /** 27/11/2026 (marketing, ronda 10): los jugadores, en su propia tarjeta con título. */
      tituloJugadores?: string;
      baseJugadores?: string;
    }[] = [];

    if (!totalSessions) return out;

    /* 07/11/2026: fuera las lecturas que repetían las tarjetas de arriba
       (cobertura y último registro). Quedan las que piden algo, primero, y
       cada una con su tarea. */
    if (untrackedPlayers.length) {
      out.push({
        icon: AlertTriangle,
        tone: "text-amber-400",
        text: `${untrackedPlayers.length} jugador${
          untrackedPlayers.length === 1 ? "" : "es"
        } sin ningún registro en todo el periodo (con los filtros actuales). Es otra cuenta que «sin seguimiento en 14 días», que incluye también a quien tuvo alguno antes.`,
      });
    }

    if (strategyData[0]) {
      const nombre = strategyData[0].name.charAt(0) + strategyData[0].name.slice(1).toLowerCase();

      out.push({
        icon: Layers,
        tone: "text-sky-400",
        text: `«${nombre}» es la estrategia más usada (${cm(strategyData[0].percentage)} % de los registros que la anotan).`,
      });
    }

    if (momentData[0]) {
      out.push({
        icon: Clock,
        tone: "text-violet-400",
        text: `El momento preferente de intervención es ${momentData[0].name.toLowerCase()} (${cm(momentData[0].percentage)} %).`,
      });
    }

    if (weeklyDelta !== null) {
      const verb =
        weeklyDelta > 0 ? "sube" : weeklyDelta < 0 ? "baja" : "se mantiene";

      out.push({
        icon: TrendingUp,
        tone: weeklyDelta >= 0 ? "text-emerald-400" : "text-rose-400",
        text: `La última semana ${verb} ${cm(Math.abs(
          weeklyDelta
        ))} seguimientos respecto a la anterior (media semanal: ${cm(weeklyMean)}).`,
      });
    }

    /* Dos lecturas que llevan a una decisión, con los mismos registros. */
    const dosSemanas = new Map<string, number>();

    plantillaEnFoco.forEach((p) => dosSemanas.set(p.id, 0));

    /* 30/10/2026: la ventana de lib/seguimiento (14 días que acaban hoy, hoy
       incluido, sin días futuros), la misma que /calendar y /individual. */
    const aCeroIds = new Set(sinSeguir14.map((p) => p.id));

    delGrupo.forEach((s) => {
      const d = daysAgo(s.FECHA);

      if (d !== null && d >= 0 && d <= DIAS_SIN_SEGUIMIENTO && dosSemanas.has(s.ID_JUGADOR)) {
        dosSemanas.set(s.ID_JUGADOR, (dosSemanas.get(s.ID_JUGADOR) ?? 0) + 1);
      }
    });

    const menos = plantillaEnFoco
      .map((p) => ({ id: p.id, nombre: p.nombre, n: dosSemanas.get(p.id) ?? 0 }))
      .sort((a, b) => a.n - b.n || a.nombre.localeCompare(b.nombre, "es"))
      .slice(0, 3);

    /* Misma regla y misma ventana (14 días) que el aviso de /calendar: quien
       no tiene ningún seguimiento. Sólo si nadie está a cero se nombran los
       tres con menos. */
    /* 10/11/2026: con los días desde su último registro (hasta hoy), como
       /calendar, para que la orden lleve su base. */
    const ultimoDias = (id: string) => {
      const dias = delGrupo
        .filter((s) => s.ID_JUGADOR === id)
        .map((s) => daysAgo(s.FECHA))
        .filter((d): d is number => d !== null && d >= 0);

      return dias.length ? Math.min(...dias) : null;
    };
    const aCero = plantillaEnFoco
      .filter((p) => aCeroIds.has(p.id))
      .map((p) => ({ id: p.id, nombre: nombreVisible(p.nombre), dias: ultimoDias(p.id) }))
      .sort((a, b) => (b.dias ?? 9999) - (a.dias ?? 9999));

    if (aCero.length > 0) {
      out.unshift({
        icon: AlertTriangle,
        tone: "text-amber-400",
        text: `Sin seguimiento en 14 días, hasta hoy: ${aCero.length} de ${plantillaEnFoco.length} de campo del Castilla. Programa una sesión individual con ${aCero.length === 1 ? "él" : "ellos"} esta semana:`,
        jugadores: aCero.map((p) => ({
          id: p.id,
          nombre: p.nombre,
          detalle: p.dias === null ? "ningún registro" : `${p.dias} días`,
        })),
      });
    } else if (menos.length === 3) {
      out.unshift({
        icon: AlertTriangle,
        tone: "text-amber-400",
        text: "Menos seguimiento en 14 días (todos tienen alguno). Programa una sesión individual con ellos esta semana:",
        jugadores: menos.map((m) => ({
          id: m.id,
          nombre: nombreVisible(m.nombre),
          detalle: `${m.n} ${m.n === 1 ? "seguimiento" : "seguimientos"}`,
        })),
      });
    }

    const [mayor, , menor] = [...focusData].sort(
      (a, b) => b.percentage - a.percentage
    );

    if (mayor && menor && mayor.percentage > menor.percentage) {
      /* 17/11/2026 (ronda 19): la lectura nombra a quién le falta ese
         objetivo en sus 3 últimos registros, cada uno con su enlace. */
      const campo = /^def/i.test(menor.name) ? "OBJETIVO_DEFENSIVO" : /^men/i.test(menor.name) ? "OBJETIVO_MENTAL" : "OBJETIVO_OFENSIVO";
      const sinObjetivo = plantillaEnFoco
        .map((p) => {
          const ultimos = filteredTracking
            .filter((s) => s.ID_JUGADOR === p.id)
            .sort((a, b) => String(b.FECHA).localeCompare(String(a.FECHA)))
            .slice(0, 3);

          return { p, ultimos, falta: ultimos.length > 0 && !ultimos.some((s) => clean(s[campo])) };
        })
        /* 20/11/2026 (ronda 4, juez de fútbol): sin los que ya nombra el aviso
           de arriba (sin seguimiento en 14 días): salían dos veces. */
        .filter((x) => x.falta && !(aCero.length > 0 && aCeroIds.has(x.p.id)))
        .map((x) => ({ id: x.p.id, nombre: nombreVisible(x.p.nombre), /* 17/11/2026 (ronda 20): la etiqueta dice su base: «0 de 1 · su único registro». */
        /* 27/11/2026 (fútbol y marketing, ronda 9): «Todos: 0 de 3» no se entendía; la etiqueta dice qué cuenta. */
        detalle: x.ultimos.length === 1
          ? `su único registro, sin objetivo ${menor.name.toLowerCase()}`
          : `ninguno de sus ${x.ultimos.length} últimos registros con objetivo ${menor.name.toLowerCase()}` }));

      out.push({
        icon: Target,
        tone: "text-sky-400",
        /* 27/11/2026 (marketing, ronda 10): una frase; los jugadores, en su tarjeta. */
        text: `${menor.name} sólo aparece en el ${cm(menor.percentage)} % de los seguimientos, frente al ${cm(mayor.percentage)} % de ${mayor.name.toLowerCase()}: en el próximo registro de cada jugador, anota también un objetivo ${menor.name.toLowerCase()}.`,
        jugadores: sinObjetivo.length ? sinObjetivo : undefined,
        tituloJugadores: sinObjetivo.length
          ? `${sinObjetivo.length} ${sinObjetivo.length === 1 ? "jugador" : "jugadores"} sin objetivo ${menor.name.toLowerCase()} en sus últimos registros`
          : undefined,
        baseJugadores: sinObjetivo.length
          ? `hasta sus 3 últimos registros${aCero.length > 0 ? ` · sin contar a los ${aCero.length} sin seguimiento del aviso de arriba` : ""}`
          : undefined,
      });
    }

    return out;
  }, [
    sinSeguir14,
    delGrupo,
    totalSessions,
    untrackedPlayers,
    strategyData,
    momentData,
    weeklyDelta,
    weeklyMean,
    plantillaEnFoco,
    focusData,
    filteredTracking,
  ]);

  const lecturasDelResumen = insights.filter((i, idx) => !(idx === 0 && i.jugadores && i.jugadores.length > 0));

  /* ---------------- filter options ---------------- */

  const filterOptions = useMemo(() => {
    const uniq = (fn: (t: TrackingRecord) => string) =>
      [...new Set(tracking.map(fn).filter(Boolean))].sort();

    return {
      positions: [...new Set(players.map((p) => p.posicion).filter(Boolean))].sort(),
      coaches: [...new Set(tracking.flatMap((t) => autores(t.QUIEN)))].sort((a, b) => a.localeCompare(b, "es")),
      strategies: conPartes(uniq((t) => t.ESTRATEGIA)),
      modalities: uniq((t) => t.MODALIDAD),
      moments: uniq((t) => t.MOMENTO),
      months: [
        ...new Set(tracking.map((t) => new Date(t.FECHA).getMonth() + 1)),
      ].sort((a, b) => a - b),
      weeks: [...new Set(tracking.map((t) => getSeasonWeek(t.FECHA)))].sort(
        (a, b) => a - b
      ),
    };
  }, [players, tracking]);

  /* En segundo plano (08/11/2026): la foto de los registros se toma en el clic
     y el anfitrión de descargas la baja y avisa. */
  const exportCSV = () => {
    const titulo = "CSV · Seguimiento individual";

    if (descargaEnMarcha(titulo)) return;

    const header = [
      "Fecha",
      "Jugador",
      "Posicion",
      "Entrenador",
      "Modalidad",
      "Momento",
      "Estrategia",
      "Objetivo ofensivo",
      "Objetivo defensivo",
      "Objetivo mental",
      "Feedback",
    ];

    const escape = (v: string) => `"${String(v ?? "").replace(/"/g, '""')}"`;

    const lines = feed.map((s) =>
      [
        new Date(s.FECHA).toLocaleDateString("es-ES"),
        nameOf(s),
        playerMap[s.ID_JUGADOR]?.posicion ?? "",
        s.QUIEN,
        s.MODALIDAD,
        s.MOMENTO,
        s.ESTRATEGIA,
        s.OBJETIVO_OFENSIVO,
        s.OBJETIVO_DEFENSIVO,
        s.OBJETIVO_MENTAL,
        s.FEEDBACK,
      ]
        .map(escape)
        .join(",")
    );

    const texto = `﻿${[header.join(","), ...lines].join("\n")}`;

    encargaDescarga({
      titulo,
      vuelta: "/individual_proc",
      tarea: async () => ({
        blob: new Blob([texto], { type: "text/csv;charset=utf-8;" }),
        nombre: "seguimiento_individual.csv",
      }),
    });
  };

  const filterLabel = (key: keyof Filters, value: string) => {
    if (key === "player") return playerMap[value]?.nombre ?? value;
    if (key === "month") return MONTHS[Number(value)];
    if (key === "week") return `Semana ${value}`;

    return value;
  };

  /* ------------------------------------------------------------------ */

  return (
    <main className="min-h-screen bg-[#0B0F14] text-white max-sm:pb-20">
      <div className="flex">
        <Sidebar />

        <section className="flex-1 min-w-0">
          <Topbar />

          <div className="px-4 md:px-8 py-6 md:py-8">
            {/* ---------------- Header ---------------- */}

            <p className="text-xs uppercase tracking-[0.35em] text-[#C8A96B]">
              RMCF CASTILLA · INDIVIDUAL
            </p>

            <div className="mt-4 flex flex-wrap items-center gap-3 md:gap-5">
              {/* 30/10/2026: el mismo nombre que en el menú. */}
              <h1 className="text-2xl md:text-4xl font-semibold tracking-tight">
                Dashboard Seguimiento
              </h1>

              <span className="rounded-full border border-white/10 bg-white/[0.04] px-3 py-1 text-xs text-white/60">
                {totalSessions} registros en la temporada
              </span>

              {/* Se dice a quién cuenta el panel: si no, la cobertura y la
                  media parecen de toda la plantilla y no lo son. 16/11/2026:
                  la misma población, con las mismas palabras, que Plantilla y
                  Calendario de Seguimiento. */}
              <span
                title="Sólo los jugadores de campo con licencia del Castilla, la misma cuenta que Plantilla y Calendario de Seguimiento. Fuera los del RMC y del juvenil que vienen a entrenar, que llevan su seguimiento en su equipo, y los porteros, que llevan un registro aparte con su entrenador."
                className="rounded-full border border-[#C8A96B]/30 bg-[#C8A96B]/10 px-3 py-1 text-xs text-[#C8A96B]"
              >
                {players.length} jugadores de campo del Castilla · porteros aparte
              </span>

              {sinFecha > 0 && (
                <span
                  title="Registros sin fecha: no entran en las semanas, los meses ni el último registro."
                  className="rounded-full border border-amber-500/30 bg-amber-500/10 px-3 py-1 text-xs text-amber-300"
                >
                  {sinFecha} sin fecha
                </span>
              )}

              {sinceLast !== null && (
                <span className="inline-flex items-center gap-1.5 text-xs text-white/45">
                  <Clock className="h-3.5 w-3.5" />
                  último registro {hace(sinceLast)}
                </span>
              )}

              <div className="hidden md:block h-px flex-1 bg-gradient-to-r from-[#C8A96B]/30 via-white/10 to-transparent" />
            </div>

            {/* 16/11/2026 (jueces): lo que pide trabajo, lo primero; cada
                nombre abre su ficha y lleva a registrar el seguimiento. */}
            {!loading && insights[0]?.jugadores && insights[0].jugadores.length > 0 && (
              <div role="status" className="mt-6 rounded-2xl border border-[#C8A96B]/30 bg-[#C8A96B]/10 px-4 py-3">
                <p className="text-sm font-semibold text-[#C8A96B]">{insights[0].text}</p>
                <JugadoresDeLectura jugadores={insights[0].jugadores} />
              </div>
            )}

            {/* 27/11/2026 (ronda 9): lo primero tras el aviso, el gráfico de la evolución semanal con su lectura (antes, bajo las tarjetas y los filtros). */}
            {!loading && weeklyData.length > 0 && (
              <div className="mt-6">
                  <Panel
                    title="Evolución semanal"
                    subtitle={
                      weeklyData.length < 3
                        ? "Seguimientos por semana"
                        : `Media de ${cm(weeklyMean)} seguimientos por semana completa (raya), de lunes a domingo · oro, individuales; gris, grupales${
                            weeklyData[weeklyData.length - 1]?.week === semanaDeHoy && diaDeSemana < 7
                              ? ` · la última va en curso, día ${diaDeSemana} de 7`
                              : ""
                          } · pulsa una barra para filtrar`
                    }
                  >
                    {/* 30/10/2026: con una o dos semanas, una barra por semana y la
                        que va en curso dice a qué día está; sin frases sobre lo
                        que falta. */}
                    {weeklyData.length < 3 ? (
                      <div className="space-y-3 py-4">
                        {weeklyData.map((w) => {
                          const maximo = Math.max(...weeklyData.map((x) => x.value), 1);
                          const enCurso = w.week === semanaDeHoy && diaDeSemana < 7;

                          return (
                            <div key={w.week}>
                              <div className="mb-1 flex items-baseline justify-between gap-3 text-sm">
                                <span className="text-white/75">
                                  Semana {w.desde}
                                  {enCurso ? ` · en curso, día ${diaDeSemana} de 7` : ""}
                                </span>
                                <span className="tabular-nums font-semibold text-[#C8A96B]">{w.value}</span>
                              </div>
                              <div className="h-2.5 w-full overflow-hidden rounded-full bg-white/10">
                                <div
                                  className="h-full rounded-full"
                                  style={{ width: `${(w.value / maximo) * 100}%`, background: GOLD, opacity: enCurso ? 0.55 : 1 }}
                                />
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    ) : (
                      /* 17/11/2026 (ronda 19): barras en HTML, sin recharts. En
                         escritorio el gráfico salía como un recuadro vacío (el
                         contenedor medía 0 al montar, el mismo fallo del anillo
                         de estrategias); estas se pintan siempre y se pulsan
                         igual en el móvil. */
                      <div title={notaDelPico || undefined}>
                      {/* 27/11/2026 (marketing, ronda 10): la frase del pico, al pasar el ratón y para el lector; en el gráfico, la anotación sobre la barra. */}
                      {notaDelPico && <p className="sr-only">{notaDelPico}</p>}
                      <BarrasSemanales
                        datos={weeklyData}
                        media={weeklyMean}
                        semanaEnCurso={diaDeSemana < 7 ? semanaDeHoy : ""}
                        activa={filters.week ? `S${filters.week}` : ""}
                        onSelect={(w) => updateFilter("week", filters.week === w.replace("S", "") ? "" : w.replace("S", ""))}
                      />
                      </div>
                    )}
                  </Panel>
              </div>
            )}

            {/* ---------------- Filters ---------------- */}

            <div className="mt-6 rounded-[24px] md:rounded-[32px] border border-white/10 bg-gradient-to-b from-white/[0.05] to-white/[0.02] p-5 md:p-7">
              {/* 17/11/2026 (ronda 20, jueces): jugador, posición y entrenador,
                  siempre a la vista (la acción principal); estrategia,
                  modalidad, momento, mes y semana, en «Más filtros». */}
              <div className="grid grid-cols-2 md:grid-cols-4 xl:grid-cols-8 gap-3">
                <Select
                  label="Jugador"
                  value={filters.player}
                  onChange={(v: string) => updateFilter("player", v)}
                  options={[
                    { value: "", label: "Todos" },
                    ...players
                      .map((p) => ({ value: p.id, label: nombreVisible(p.nombre) }))
                      .sort((a, b) => a.label.localeCompare(b.label, "es")),
                  ]}
                />

                <Select
                  label="Posición"
                  value={filters.position}
                  onChange={(v: string) => updateFilter("position", v)}
                  options={[
                    { value: "", label: "Todas" },
                    ...filterOptions.positions.map((p) => ({
                      value: p,
                      label: nombrePuesto(p),
                    })),
                  ]}
                />

                <Select
                  label="Entrenador"
                  value={filters.coach}
                  onChange={(v: string) => updateFilter("coach", v)}
                  options={[
                    { value: "", label: "Todos" },
                    ...filterOptions.coaches.map((c) => ({
                      value: c,
                      label: c,
                    })),
                  ]}
                />

                <button
                  type="button"
                  onClick={() => setMasFiltros((v) => !v)}
                  aria-expanded={verSecundarios}
                  className="self-end rounded-2xl border border-white/10 bg-[#11161C] px-4 py-3 text-left text-sm text-white/75 transition hover:border-[#C8A96B]/50"
                >
                  {verSecundarios ? "Menos filtros" : `Más filtros${secundariosActivos > 0 ? ` (${secundariosActivos})` : ""}`}
                </button>

                <div className={verSecundarios ? "contents" : "hidden"}>
                <Select
                  label="Estrategia"
                  value={filters.strategy}
                  onChange={(v: string) => updateFilter("strategy", v)}
                  options={[
                    { value: "", label: "Todas" },
                    ...filterOptions.strategies.map((s) => ({
                      value: s,
                      label: s,
                    })),
                  ]}
                />

                <Select
                  label="Modalidad"
                  value={filters.modality}
                  onChange={(v: string) => updateFilter("modality", v)}
                  options={[
                    { value: "", label: "Todas" },
                    ...filterOptions.modalities.map((m) => ({
                      value: m,
                      label: m,
                    })),
                  ]}
                />

                <Select
                  label="Momento"
                  value={filters.moment}
                  onChange={(v: string) => updateFilter("moment", v)}
                  options={[
                    { value: "", label: "Todos" },
                    ...filterOptions.moments.map((m) => ({
                      value: m,
                      label: m,
                    })),
                  ]}
                />

                {filterOptions.months.length > 1 && (
                <Select
                  label="Mes"
                  value={filters.month}
                  onChange={(v: string) => updateFilter("month", v)}
                  options={[
                    { value: "", label: "Todos" },
                    ...filterOptions.months.map((m) => ({
                      value: String(m),
                      label: MONTHS[m],
                    })),
                  ]}
                />
                )}

                {filterOptions.weeks.length > 1 && (
                <Select
                  label="Semana"
                  value={filters.week}
                  onChange={(v: string) => updateFilter("week", v)}
                  options={[
                    { value: "", label: "Todas" },
                    ...filterOptions.weeks.map((w) => ({
                      value: String(w),
                      label: `Semana ${w}`,
                    })),
                  ]}
                />
                )}
                </div>
              </div>

              <div className="mt-4 flex flex-col sm:flex-row gap-3">
                <div className="relative flex-1">
                  <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-white/35" />

                  <input
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    placeholder="Buscar en feedback, objetivos o jugadores…"
                    className="w-full rounded-2xl border border-white/10 bg-[#11161C] py-3 pl-10 pr-4 text-sm outline-none placeholder:text-white/30 focus:border-[#C8A96B]/50"
                  />
                </div>

                {/* 29/10/2026: «Limpiar» sólo cuando hay algo que limpiar. */}
                {(activeFilterCount > 0 || search) && (
                  <button
                    onClick={() => {
                      setFilters(emptyFilters);
                      setSearch("");
                    }}
                    className="rounded-2xl bg-[#C8A96B] px-5 py-3 text-sm font-semibold text-black transition hover:opacity-90"
                  >
                    Limpiar
                  </button>
                )}
              </div>

              {activeFilterCount > 0 && (
                <div className="mt-4 flex flex-wrap gap-2">
                  {(Object.entries(filters) as [keyof Filters, string][])
                    .filter(([, value]) => value)
                    .map(([key, value]) => (
                      <button
                        key={key}
                        onClick={() => updateFilter(key, "")}
                        className="rounded-full border border-[#C8A96B]/40 bg-[#C8A96B]/10 px-3 py-1.5 text-xs text-[#C8A96B] transition hover:bg-[#C8A96B]/20"
                      >
                        {filterLabel(key, value)} ×
                      </button>
                    ))}

                  {search && (
                    <button
                      onClick={() => setSearch("")}
                      className="rounded-full border border-blue-400/40 bg-blue-400/10 px-3 py-1.5 text-xs text-blue-300"
                    >
                      &quot;{search}&quot; ×
                    </button>
                  )}
                </div>
              )}

              {/* KPIs */}

              <div className="mt-7 grid grid-cols-2 md:grid-cols-3 xl:grid-cols-6 gap-3 md:gap-4 [&>*:last-child:nth-child(odd)]:col-span-2 md:[&>*:last-child:nth-child(odd)]:col-span-1">
                <StatCard
                  icon={MessageSquareText}
                  title="Seguimientos"
                  value={totalSessions}
                  /* 29/10/2026: una sola base por tarjeta: aquí registros (y
                     cuántos de ellos llevan feedback); los jugadores van en
                     «Con seguimiento» y «Cobertura». */
                  /* 10/11/2026: la ventana dicha (el registro de la temporada
                     está en /calendar) y, con un filtro que deja menos de 15,
                     el aviso de que es tendencia. */
                  /* 20/11/2026 (ronda 4, jueces): una línea con la base; la
                     explicación, al pasar el ratón. Y todos los autores sin
                     feedback, no los tres primeros (sumaban 111 de 118). */
                  /* 27/11/2026 (análisis, ronda 10): el porcentaje primero y su base
                     entre paréntesis, para que «261 de 381» y «68,5 %» se lean juntos. */
                  base={`${totalSessions > 0 ? `${cm((withFeedback / totalSessions) * 100)} % con feedback (${withFeedback} de ${totalSessions})` : "con feedback: 0"}${
                    totalSessions > 0 && totalSessions < 15 ? " · tendencia" : ""
                  }`}
                  hint={`registros de la temporada de los jugadores de campo del Castilla · ${withFeedback} de ${totalSessions} con feedback escrito${
                    sinFeedbackPorAutor.length > 0
                      ? ` · sin feedback (${totalSessions - withFeedback}): ${sinFeedbackPorAutor.map(([a, n]) => `${a} ${n}`).join(", ")}${
                          sinFeedbackPorAutor.reduce((t, [, n]) => t + n, 0) > totalSessions - withFeedback ? " (un registro compartido cuenta a cada autor)" : ""
                        }`
                      : ""
                  }${totalSessions > 0 && totalSessions < 15 ? " · tendencia: menos de 15 registros" : ""}`}
                />

                <StatCard
                  icon={Users}
                  title="Con seguimiento"
                  value={`${cubiertos} de ${squadSize}`}
                  /* 27/11/2026 (marketing, ronda 10): una línea; la media, al pasar el ratón. */
                  base={`mediana de ${cm(medianaPorJugador)} registros por jugador`}
                  hint={`jugadores de campo del Castilla con algún registro en la temporada · ${cm(avgPerPlayer)} registros por jugador con seguimiento (mediana ${cm(medianaPorJugador)})`}
                  accent="#6E7F99"
                />

                {/* 16/11/2026 (jueces): la misma ventana que el aviso de 14
                    días; la de la temporada, debajo. */}
                <StatCard
                  icon={UserCheck}
                  title={`Cobertura · últimos ${DIAS_SIN_SEGUIMIENTO} días`}
                  value={`${cubiertos14} de ${squadSize}`}
                  base={`${cm(coverage14)} % · temporada: ${cubiertos} de ${squadSize}`}
                  hint={`${cm(coverage14)} % de los jugadores de campo del Castilla con algún registro en los últimos ${DIAS_SIN_SEGUIMIENTO} días (la ventana del aviso) · en la temporada: ${cubiertos} de ${squadSize} (${cm(coverage)} %)`}
                  accent={coverage14 >= 80 ? "#10B981" : coverage14 >= 50 ? "#C8A96B" : "#EF4444"}
                  progress={coverage14}
                />

                <StatCard
                  icon={CalendarDays}
                  title={semanasCerradas.length >= 1 && weeklyData.length > 1 ? `Media semanal · ${semanasCerradas.length} sem. completas` : "Esta semana"}
                  value={cm(semanasCerradas.length >= 1 && weeklyData.length > 1 ? weeklyMean : averageWeek)}
                  base={
                    semanasCerradas.length >= 1 && weeklyData.length > 1
                      ? mediaUltimas7 !== null && semanasCerradas.length > ultimas7.length
                        ? `por semana · últimas ${ultimas7.length}: ${cm(mediaUltimas7)}`
                        : "registros por semana, de lunes a domingo"
                      : undefined
                  }
                  hint={
                    semanasCerradas.length >= 1 && weeklyData.length > 1
                      ? `registros por semana: media de ${semanasCerradas.length} ${semanasCerradas.length === 1 ? "semana completa" : "semanas completas"} (lunes a domingo)${semanasCerradas.length < weeklyData.length ? "; la primera (si empezó a media semana) y la actual van aparte" : ""}`
                      : totalWeeks === 1 ? "1 semana activa" : `${totalWeeks} semanas activas`
                  }
                  accent="#4C7A67"
                  delta={weeklyDelta ?? undefined}
                />

                <StatCard
                  icon={Target}
                  title="Individualización"
                  value={`${cm(individualShare)} %`}
                  /* 30/10/2026: es la MODALIDAD (individual frente a grupal), no
                     el foco del objetivo; podía coincidir con «Defensivo». */
                  base={`${filteredTracking.filter((x) => norm(x.MODALIDAD) === "individual").length} de ${totalSessions} individuales`}
                  hint={`modalidad individual: ${filteredTracking.filter((x) => norm(x.MODALIDAD) === "individual").length} de ${totalSessions} registros; el resto, grupales`}
                  accent="#8B5CF6"
                  progress={individualShare}
                />

                {/* 29/10/2026: sin registros la tarjeta no sale (nada de «—» ni «sin datos»). */}
                {sinceLast !== null && (
                  <StatCard
                    icon={Clock}
                    title="Último registro"
                    value={corto(sinceLast)}
                    hint={lastRecord ? `${nameOf(lastRecord)} · el más reciente de ${totalSessions}` : ""}
                    accent="#F97316"
                  />
                )}
              </div>
            </div>

            {/* ---------------- Tabs ---------------- */}

            {/* 07/11/2026: en el móvil, dos por fila y enteras («Metodolo…»
                se cortaba al deslizar). */}
            <div className="mt-8 grid grid-cols-2 gap-2 pb-1 sm:flex sm:overflow-x-auto">
              {TABS.map((t) => {
                const Icon = t.icon;
                const active = tab === t.key;

                return (
                  <button
                    key={t.key}
                    onClick={() => setTab(t.key)}
                    className={`inline-flex shrink-0 items-center justify-center gap-2 rounded-2xl border px-3 py-2.5 text-sm transition sm:justify-start sm:px-4 ${
                      active
                        ? "border-[#C8A96B] bg-[#C8A96B] font-semibold text-black"
                        : "border-white/10 bg-white/[0.03] text-white/70 hover:border-white/25 hover:text-white"
                    }`}
                  >
                    <Icon className="h-4 w-4" />
                    {t.label}
                  </button>
                );
              })}
            </div>

            {loading && (
              <div className="mt-8 grid grid-cols-1 xl:grid-cols-2 gap-6">
                {[0, 1, 2, 3].map((i) => (
                  <div
                    key={i}
                    className="h-[340px] animate-pulse rounded-3xl border border-white/10 bg-white/[0.03]"
                  />
                ))}
              </div>
            )}

            {!loading && totalSessions === 0 && (
              <div className="mt-10 rounded-3xl border border-white/10 bg-white/[0.03] p-12 text-center">
                <p className="text-lg font-semibold">Sin seguimientos</p>

                <p className="mt-2 text-sm text-white/50">
                  Ningún registro coincide con los filtros seleccionados.
                </p>

                <button
                  onClick={() => {
                    setFilters(emptyFilters);
                    setSearch("");
                  }}
                  className="mt-5 rounded-2xl bg-[#C8A96B] px-5 py-2.5 text-sm font-semibold text-black"
                >
                  Limpiar filtros
                </button>
              </div>
            )}

            {/* ================= RESUMEN ================= */}

            {!loading && totalSessions > 0 && tab === "resumen" && (
              <div className="mt-8 space-y-6">
                {/* El aviso con nombres ya va arriba, sobre las cifras: aquí, el resto. */}
                {lecturasDelResumen.length > 0 && (
                  <div className="rounded-3xl border border-white/10 bg-gradient-to-br from-[#C8A96B]/[0.07] to-white/[0.02] p-6 md:p-7">
                    <h2 className="mb-5 flex items-center gap-2 text-lg font-semibold">
                      <Sparkles className="h-5 w-5 text-[#C8A96B]" />
                      Lecturas del periodo
                    </h2>

                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-x-8 gap-y-3">
                      {lecturasDelResumen.map((i, idx) => {
                        const Icon = i.icon;

                        return (
                          <div key={idx} className="flex items-start gap-3">
                            <Icon
                              className={`mt-0.5 h-4 w-4 shrink-0 ${i.tone}`}
                            />

                            <div className="min-w-0">
                              <p className="text-sm leading-relaxed text-white/75">
                                {i.text}
                              </p>
                              {i.jugadores && i.jugadores.length > 0 && (
                                i.tituloJugadores ? (
                                  <div className="mt-2 min-w-0 rounded-xl border border-white/10 bg-white/[0.03] p-3">
                                    <p className="text-sm font-semibold text-white/85">{i.tituloJugadores}</p>
                                    {i.baseJugadores && <p className="text-xs text-white/55">{i.baseJugadores}</p>}
                                    <JugadoresDeLectura jugadores={i.jugadores} />
                                  </div>
                                ) : (
                                  <JugadoresDeLectura jugadores={i.jugadores} />
                                )
                              )}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}

                {/* 27/11/2026 (fútbol y análisis, ronda 9): la evolución semanal sube arriba, junto al aviso. */}
                <div className="grid grid-cols-1 gap-6">
                  <Panel
                    title="Foco de los objetivos"
                    subtitle={`De ${totalSessions} registros, cuántos llevan objetivo de cada tipo (uno puede llevar varios)`}
                  >
                    <div className="space-y-4 py-2">
                      {focusData.map((f) => (
                        <div key={f.name}>
                          <div className="mb-1.5 flex items-baseline justify-between gap-3 text-sm">
                            <span className="font-medium text-white/80">
                              {f.name}
                            </span>

                            <span className="tabular-nums text-white/60">
                              <span className="font-semibold text-[#C8A96B]">
                                {f.value}
                              </span>{" "}
                              con objetivo {f.name.toLowerCase()} · {cm(f.percentage)} %
                              {/* 27/11/2026 (análisis, ronda 10): con menos de 15 registros, tendencia. */}
                              {f.value < 15 ? " · tendencia" : ""}
                            </span>
                          </div>

                          <div className="h-2.5 w-full overflow-hidden rounded-full bg-white/10">
                            <div
                              className="h-full rounded-full"
                              style={{
                                width: `${Math.min(100, f.percentage)}%`,
                                background: GOLD,
                              }}
                            />
                          </div>
                        </div>
                      ))}
                    </div>
                  </Panel>

                  <Panel
                    title="Estrategias utilizadas"
                    subtitle={`${conEstrategia}${conEstrategia < totalSessions ? ` de ${totalSessions}` : ""} registros con estrategia anotada · pulsa un segmento para filtrar`}
                  >
                    <DonutWithLegend
                      data={strategyData}
                      active={filters.strategy}
                      onSelect={(name: string) =>
                        updateFilter(
                          "strategy",
                          filters.strategy === name ? "" : name
                        )
                      }
                    />
                  </Panel>

                  {/* 16/11/2026 (jueces): el segundo anillo pasa a ser el
                      cruce estrategia × momento, con su conclusión en el
                      título; el total de cada momento va en su cabecera. */}
                  <Panel
                    title={
                      estrategiaMomento.mayor.n > 0
                        ? `Lo más repetido: ${estrategiaMomento.mayor.estrategia.toLowerCase()} ${estrategiaMomento.mayor.momento.toLowerCase()} (${estrategiaMomento.mayor.n})`
                        : "Estrategia según el momento"
                    }
                    subtitle={`Qué recurso se usa en cada momento · registros con los dos datos anotados${conMomento < totalSessions ? ` · ${conMomento} de ${totalSessions} con momento` : ""} · pulsa una fila o una columna para filtrar`}
                  >
                    <div className="overflow-x-auto">
                      <table className="w-full min-w-[420px] border-separate border-spacing-1 text-sm">
                        <thead>
                          <tr>
                            <th />
                            {momentData.map((m) => (
                              <th key={m.name} className="px-1 pb-1 text-center align-bottom font-normal">
                                <button
                                  type="button"
                                  onClick={() => updateFilter("moment", filters.moment === m.name ? "" : m.name)}
                                  aria-pressed={filters.moment === m.name}
                                  className={`w-full rounded-lg px-1 py-1 text-[11px] uppercase tracking-wide transition hover:text-white ${
                                    filters.moment === m.name ? "bg-[#C8A96B]/20 text-white" : "text-white/60"
                                  }`}
                                >
                                  {m.name.toLowerCase()}
                                  <span className="block text-xs font-semibold normal-case tracking-normal text-white/80">
                                    {m.value} · {cm(m.percentage)} %
                                  </span>
                                </button>
                              </th>
                            ))}
                          </tr>
                        </thead>
                        <tbody>
                          {estrategiaMomento.filas.map((f) => (
                            <tr key={f.estrategia}>
                              <th scope="row" className="pr-2 text-left font-normal">
                                <button
                                  type="button"
                                  onClick={() => updateFilter("strategy", filters.strategy === f.estrategia ? "" : f.estrategia)}
                                  aria-pressed={filters.strategy === f.estrategia}
                                  className={`text-left text-xs transition hover:text-white ${
                                    filters.strategy === f.estrategia ? "font-semibold text-[#C8A96B]" : "text-white/75"
                                  }`}
                                >
                                  {f.estrategia.charAt(0) + f.estrategia.slice(1).toLowerCase()}
                                  <span className="ml-1 text-white/45">{f.total}</span>
                                </button>
                              </th>
                              {f.celdas.map((c) => (
                                <td
                                  key={c.momento}
                                  className="rounded-lg px-2 py-2 text-center tabular-nums"
                                  style={{
                                    background: c.n ? `rgba(200,169,107,${0.1 + 0.75 * (c.n / estrategiaMomento.max)})` : undefined,
                                  }}
                                >
                                  <span className={c.n / estrategiaMomento.max > 0.55 ? "font-semibold text-black" : "text-white/80"}>
                                    {c.n || ""}
                                  </span>
                                </td>
                              ))}
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </Panel>
                </div>

                {untrackedPlayers.length > 0 && (
                  <Panel
                    /* 29/10/2026: no es la misma lista que el aviso «sin
                       seguimiento en 14 días» de Lecturas: aquí sale quien no
                       tiene ningún registro con los filtros puestos. */
                    title={`Sin ningún registro (${untrackedPlayers.length})`}
                    subtitle={`Sin ningún registro en la temporada con los filtros actuales; junto a cada nombre, su último registro de la temporada`}
                  >
                    <div className="flex flex-wrap gap-2.5">
                      {untrackedPlayers.map((p) => (
                        <div
                          key={p.id}
                          className="flex items-center gap-2.5 rounded-2xl border border-amber-400/20 bg-amber-400/[0.06] py-1.5 pl-1.5 pr-3.5"
                        >
                          {/* eslint-disable-next-line @next/next/no-img-element */}
                          <img
                            src={p.foto}
                            alt={p.nombre}
                            className="h-8 w-8 rounded-xl object-cover"
                          />

                          <div className="leading-tight">
                            <p className="text-sm font-medium">
                              <NombreJugador jugador={{ id: p.id, nombre: nombreVisible(p.nombre) }} />
                            </p>

                            <p className="text-[11px] text-white/55">
                              {nombrePuesto(p.posicion)}
                              {ultimoEnTemporada.get(p.id)
                                ? ` · último: ${ultimoEnTemporada.get(p.id)!.toLocaleDateString("es-ES", { day: "2-digit", month: "2-digit" })}`
                                : ""}
                            </p>
                          </div>
                        </div>
                      ))}
                    </div>
                  </Panel>
                )}
              </div>
            )}

            {/* ================= JUGADORES ================= */}

            {!loading && totalSessions > 0 && tab === "jugadores" && (
              <div className="mt-8 space-y-6">
                <Panel
                  title="Ranking de seguimiento por jugador"
                  subtitle={`Registros de cada uno (de ${totalSessions}), semanas cubiertas y días desde el último contacto · la raya, la mediana de los jugadores de campo del Castilla (${cm(medianaPorJugador)}) · pulsa una fila para filtrar`}
                >
                  <div className="space-y-2">
                    {playerChart.map((p, i) => {
                      const selected = filters.player === p.id;
                      const tope = playerChart[0]?.value || 1;

                      /* 16/11/2026: fila pulsable (filtra) con sus enlaces
                         dentro: ficha, calendario y registrar. Un <button> no
                         puede llevar enlaces dentro. */
                      return (
                        <div
                          key={p.id + p.name}
                          role="button"
                          tabIndex={0}
                          aria-pressed={selected}
                          onClick={() =>
                            updateFilter("player", selected ? "" : p.id)
                          }
                          onKeyDown={(e) => {
                            if (e.target !== e.currentTarget) return;
                            if (e.key === "Enter" || e.key === " ") {
                              e.preventDefault();
                              updateFilter("player", selected ? "" : p.id);
                            }
                          }}
                          className={`flex w-full cursor-pointer flex-wrap items-center gap-3 rounded-2xl border p-2.5 text-left transition sm:flex-nowrap ${
                            selected
                              ? "border-[#C8A96B] bg-[#C8A96B]/10"
                              : "border-white/5 bg-white/[0.02] hover:border-white/20"
                          }`}
                        >
                          <span className="w-6 shrink-0 text-center text-xs text-white/30">
                            {i + 1}
                          </span>

                          {/* eslint-disable-next-line @next/next/no-img-element */}
                          <img
                            src={p.foto}
                            alt={p.name}
                            className="h-10 w-10 shrink-0 rounded-xl object-cover"
                          />

                          <div className="min-w-0 flex-1">
                            <div className="flex items-baseline gap-2">
                              <p className="truncate text-sm font-semibold">
                                {p.name}
                              </p>

                              <span className="shrink-0 text-[11px] text-white/35">
                                {nombrePuesto(p.posicion)}
                              </span>
                            </div>

                            <div className="relative mt-1.5 h-1.5 rounded-full bg-white/10">
                              <div
                                className="h-full rounded-full bg-[#C8A96B]"
                                style={{
                                  width: `${(p.value / tope) * 100}%`,
                                }}
                              />
                              {medianaPorJugador > 0 && (
                                <span
                                  aria-hidden
                                  title={`Mediana: ${cm(medianaPorJugador)}`}
                                  className="absolute -top-1 h-3.5 w-0.5 rounded bg-white/60"
                                  style={{ left: `${Math.min(100, (medianaPorJugador / tope) * 100)}%` }}
                                />
                              )}
                            </div>
                          </div>

                          <EnlacesJugador
                            jugador={{ id: p.id, nombre: nombreVisible(p.name) }}
                            destinos={["ficha", "comparativa", "calendario", "registrar"]}
                            compacto
                            className="order-last w-full justify-end sm:order-none sm:w-auto"
                          />

                          <div className="shrink-0 text-right">
                            <p className="text-sm font-bold text-[#C8A96B]">
                              {p.value}
                            </p>

                            <p className="text-[11px] text-white/50">
                              {cm(+p.percentage.toFixed(1))} %
                            </p>
                          </div>

                          <div className="hidden shrink-0 text-right sm:block">
                            <p className="text-xs text-white/60">
                              {p.semanas} sem.
                            </p>

                            <p
                              className={`text-[11px] ${
                                (p.dias ?? 0) > DIAS_SIN_SEGUIMIENTO
                                  ? "text-rose-400"
                                  : "text-white/50"
                              }`}
                            >
                              {hace(p.dias ?? 0)}
                            </p>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </Panel>

                <Panel
                  title="Mapa de contacto · jugador × semana"
                  subtitle="Intensidad de color = nº de seguimientos esa semana"
                >
                  <div className="overflow-x-auto">
                    <div
                      className="grid min-w-[680px] gap-1"
                      style={{
                        gridTemplateColumns: `180px repeat(${heatmap.weeks.length}, minmax(28px,1fr)) 52px`,
                      }}
                    >
                      <div />

                      {heatmap.weeks.map((w) => (
                        <div
                          key={w}
                          className="pb-1 text-center text-[10px] text-white/35"
                        >
                          S{w}
                        </div>
                      ))}

                      <div className="pb-1 text-center text-[10px] text-white/35">
                        Total
                      </div>

                      {heatmap.rows.map((row) => (
                        <HeatRow
                          key={row.id + row.name}
                          row={row}
                          max={heatmap.max}
                          selected={filters.player === row.id}
                          onSelectPlayer={() =>
                            updateFilter(
                              "player",
                              filters.player === row.id ? "" : row.id
                            )
                          }
                          onSelectCell={(w: number) =>
                            updateFilter("week", String(w))
                          }
                        />
                      ))}
                    </div>

                    <div className="mt-4 flex items-center gap-3 text-[11px] text-white/40">
                      <span>Menos contacto</span>

                      <div className="flex gap-1">
                        {[0.12, 0.32, 0.52, 0.72, 0.92].map((t) => (
                          <span
                            key={t}
                            className="h-3 w-7 rounded"
                            style={{ background: `rgba(200,169,107,${t})` }}
                          />
                        ))}
                      </div>

                      <span>Más contacto</span>
                    </div>
                  </div>
                </Panel>

                <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
                  <Panel
                    title="Reparto por posición"
                    subtitle="Volumen total y media por jugador de cada posición"
                  >
                    <ChartBox height={Math.max(320, positionData.length * 42)}>
                      <BarChart
                        data={positionData}
                        layout="vertical"
                        margin={{ top: 6, right: 46, left: 10, bottom: 6 }}
                      >
                        <CartesianGrid stroke="#1E232A" vertical={false} />

                        <XAxis type="number" tick={AXIS} axisLine={false} tickLine={false} />

                        <YAxis
                          type="category"
                          dataKey="name"
                          width={110}
                          interval={0}
                          axisLine={false}
                          tickLine={false}
                          tick={{ fill: "#CBD5E1", fontSize: 11 }}
                        />

                        <Tooltip
                          cursor={{ fill: "rgba(255,255,255,0.03)" }}
                          content={
                            <DarkTooltip
                              rows={[
                                ["Jugadores", "jugadores"],
                                ["Media/jugador", "media"],
                                ["% del total", "percentage"],
                              ]}
                            />
                          }
                        />

                        <Bar
                          dataKey="value"
                          name="Seguimientos"
                          radius={[0, 10, 10, 0]}
                          barSize={16}
                          cursor="pointer"
                          onClick={(d) => {
                            const pos = d?.payload?.name;

                            if (pos)
                              updateFilter(
                                "position",
                                filters.position === pos ? "" : pos
                              );
                          }}
                        >
                          {positionData.map((entry, i) => (
                            <Cell
                              key={entry.name}
                              fill={COLORS[i % COLORS.length]}
                              opacity={
                                filters.position &&
                                filters.position !== entry.name
                                  ? 0.25
                                  : 1
                              }
                            />
                          ))}

                          <LabelList
                            dataKey="value"
                            position="right"
                            style={{
                              fill: "#fff",
                              fontSize: 11,
                              fontWeight: 600,
                            }}
                          />
                        </Bar>
                      </BarChart>
                    </ChartBox>
                  </Panel>

                  <Panel
                    title="Contactos más antiguos"
                    subtitle="Jugadores con mayor tiempo sin seguimiento registrado"
                  >
                    <div className="space-y-2.5">
                      {staleContacts.map((p) => (
                        <div
                          key={p.id + p.name}
                          className="flex items-center gap-3 rounded-2xl border border-white/5 bg-white/[0.02] p-3"
                        >
                          {/* eslint-disable-next-line @next/next/no-img-element */}
                          <img
                            src={p.foto}
                            alt={p.name}
                            className="h-10 w-10 rounded-xl object-cover"
                          />

                          <div className="min-w-0 flex-1">
                            <p className="truncate text-sm font-semibold">
                              <NombreJugador jugador={{ id: p.id, nombre: nombreVisible(p.name) }} />
                            </p>

                            <p className="text-xs text-white/50">
                              {nombrePuesto(p.posicion)} · {p.value} seguimientos
                            </p>
                            <EnlacesJugador
                              jugador={{ id: p.id, nombre: nombreVisible(p.name) }}
                              destinos={["ficha", "comparativa", "calendario", "registrar"]}
                              compacto
                              className="mt-1"
                            />
                          </div>

                          <div className="text-right">
                            <p
                              className={`text-sm font-bold ${
                                (p.dias ?? 0) > 14
                                  ? "text-rose-400"
                                  : (p.dias ?? 0) > 7
                                  ? "text-amber-400"
                                  : "text-emerald-400"
                              }`}
                            >
                              {corto(p.dias ?? 0)}
                            </p>

                            <p className="text-[10px] text-white/30">
                              {fmtFecha(p.last)}
                            </p>
                          </div>
                        </div>
                      ))}
                    </div>
                  </Panel>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <MiniCard
                    title="Jugador más seguido"
                    name={mostTrackedPlayer.name}
                    value={`${mostTrackedPlayer.value} seguimientos`}
                    tone="emerald"
                  />

                  <MiniCard
                    title="Jugador menos seguido"
                    name={leastTrackedPlayer.name}
                    value={`${leastTrackedPlayer.value} seguimientos`}
                    tone="rose"
                  />
                </div>
              </div>
            )}

            {/* ================= METODOLOGÍA ================= */}

            {!loading && totalSessions > 0 && tab === "contenidos" && (
              <div className="mt-8 space-y-6">
                <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
                  <Panel
                    title="Modalidad de trabajo"
                    subtitle="Individual vs grupal"
                  >
                    <DonutWithLegend
                      data={modalityData}
                      active={filters.modality}
                      onSelect={(name: string) =>
                        updateFilter(
                          "modality",
                          filters.modality === name ? "" : name
                        )
                      }
                    />
                  </Panel>

                  <Panel
                    title="Carga de seguimiento por entrenador"
                    subtitle="Quién sostiene el contacto con los jugadores"
                  >
                    <ChartBox height={Math.max(300, coachData.length * 46)}>
                      <BarChart
                        data={coachData}
                        layout="vertical"
                        margin={{ top: 6, right: 46, left: 10, bottom: 6 }}
                      >
                        <CartesianGrid stroke="#1E232A" vertical={false} />

                        <XAxis type="number" tick={AXIS} axisLine={false} tickLine={false} />

                        <YAxis
                          type="category"
                          dataKey="name"
                          width={110}
                          interval={0}
                          axisLine={false}
                          tickLine={false}
                          tick={{ fill: "#CBD5E1", fontSize: 12 }}
                        />

                        <Tooltip
                          cursor={{ fill: "rgba(255,255,255,0.03)" }}
                          content={
                            <DarkTooltip rows={[["% del total", "percentage"]]} />
                          }
                        />

                        <Bar
                          dataKey="value"
                          name="Seguimientos"
                          radius={[0, 10, 10, 0]}
                          barSize={18}
                          cursor="pointer"
                          onClick={(d) => {
                            const c = d?.payload?.name;

                            if (c)
                              updateFilter(
                                "coach",
                                filters.coach === c ? "" : c
                              );
                          }}
                        >
                          {coachData.map((entry, i) => (
                            <Cell
                              key={entry.name}
                              fill={COLORS[i % COLORS.length]}
                              opacity={
                                filters.coach && filters.coach !== entry.name
                                  ? 0.25
                                  : 1
                              }
                            />
                          ))}

                          <LabelList
                            dataKey="value"
                            position="right"
                            style={{
                              fill: "#fff",
                              fontSize: 11,
                              fontWeight: 600,
                            }}
                          />
                        </Bar>
                      </BarChart>
                    </ChartBox>
                  </Panel>
                </div>

                <Panel
                  title="Matriz entrenador × estrategia"
                  subtitle="Qué recurso metodológico usa cada miembro del staff"
                >
                  <div className="overflow-x-auto">
                    <div
                      className="grid min-w-[560px] gap-1.5"
                      style={{
                        gridTemplateColumns: `150px repeat(${coachStrategyMatrix.strategies.length}, minmax(0,1fr))`,
                      }}
                    >
                      <div />

                      {coachStrategyMatrix.strategies.map((s) => (
                        <div
                          key={s}
                          className="pb-1 text-center text-[11px] font-medium uppercase tracking-wide text-white/40"
                        >
                          {s}
                        </div>
                      ))}

                      {coachStrategyMatrix.rows.map((row) => (
                        <MatrixRow
                          key={row.coach}
                          row={row}
                          max={coachStrategyMatrix.max}
                          selected={filters.coach === row.coach}
                          onSelectCoach={() =>
                            updateFilter(
                              "coach",
                              filters.coach === row.coach ? "" : row.coach
                            )
                          }
                          onSelectCell={(strategy: string) => {
                            updateFilter("coach", row.coach);
                            updateFilter("strategy", strategy);
                          }}
                        />
                      ))}
                    </div>
                  </div>
                </Panel>

                <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
                  <Panel
                    title="Distribución mensual"
                    subtitle="Volumen de seguimiento por mes de temporada"
                  >
                    <ChartBox>
                      <BarChart
                        data={monthlyData}
                        onClick={(state) => {
                          /* `activePayload` era de Recharts 2; se lee igual
                             que antes, sin cambiar lo que hace el clic. */
                          const m = (
                            state as {
                              activePayload?: { payload?: { month?: number } }[];
                            } | null
                          )?.activePayload?.[0]?.payload?.month;

                          if (m)
                            updateFilter(
                              "month",
                              filters.month === String(m) ? "" : String(m)
                            );
                        }}
                      >
                        <CartesianGrid stroke="#1E232A" vertical={false} />

                        <XAxis dataKey="name" tick={AXIS} axisLine={false} tickLine={false} />

                        <YAxis tick={AXIS} axisLine={false} tickLine={false} />

                        <Tooltip
                          cursor={{ fill: "rgba(255,255,255,0.03)" }}
                          content={
                            <DarkTooltip rows={[["% del total", "percentage"]]} />
                          }
                        />

                        <Bar
                          dataKey="value"
                          name="Seguimientos"
                          radius={[10, 10, 0, 0]}
                        >
                          {monthlyData.map((entry) => (
                            <Cell
                              key={entry.month}
                              fill={GOLD}
                              opacity={
                                filters.month &&
                                filters.month !== String(entry.month)
                                  ? 0.25
                                  : 1
                              }
                            />
                          ))}

                          <LabelList
                            dataKey="value"
                            position="top"
                            style={{ fill: "#94A3B8", fontSize: 11 }}
                          />
                        </Bar>
                      </BarChart>
                    </ChartBox>
                  </Panel>

                  <Panel
                    title="Jugadores alcanzados por semana"
                    subtitle="Amplitud del seguimiento, no sólo volumen"
                  >
                    <ChartBox>
                      <LineChart data={weeklyData}>
                        <CartesianGrid stroke="#1E232A" vertical={false} />

                        <XAxis dataKey="week" tick={AXIS} axisLine={false} tickLine={false} />

                        <YAxis tick={AXIS} axisLine={false} tickLine={false} />

                        <Tooltip
                          content={
                            <DarkTooltip rows={[["Seguimientos", "value"]]} />
                          }
                        />

                        <Line
                          type="monotone"
                          dataKey="jugadores"
                          name="Jugadores distintos"
                          stroke="#4C7A67"
                          strokeWidth={3}
                          dot={{ r: 4, fill: "#4C7A67" }}
                          activeDot={{ r: 6 }}
                        />
                      </LineChart>
                    </ChartBox>
                  </Panel>
                </div>
              </div>
            )}

            {/* ================= REGISTROS ================= */}

            {!loading && totalSessions > 0 && tab === "registros" && (
              <div className="mt-8 space-y-6">
                <Panel
                  title={`Registros de seguimiento (${feed.length})`}
                  subtitle="Pulsa una tarjeta para ver los objetivos y el feedback completo"
                  action={
                    <button
                      onClick={exportCSV}
                      className="inline-flex items-center gap-2 rounded-xl border border-white/10 bg-white/[0.04] px-3.5 py-2 text-xs text-white/70 transition hover:border-[#C8A96B]/50 hover:text-white"
                    >
                      <Download className="h-3.5 w-3.5" />
                      Exportar CSV
                    </button>
                  }
                >
                  <div className="space-y-3">
                    {feed.slice(0, feedLimit).map((s) => {
                      const open = expanded === s.ID_REGISTRO;
                      const jugador = playerMap[s.ID_JUGADOR];
                      /* Sólo los objetivos escritos: uno vacío no se nombra, y sin
                         objetivos ni feedback la tarjeta no se despliega (07/11/2026). */
                      const objetivos = [
                        { label: "Objetivo ofensivo", color: "#C8A96B", text: clean(s.OBJETIVO_OFENSIVO) },
                        { label: "Objetivo defensivo", color: "#3B82F6", text: clean(s.OBJETIVO_DEFENSIVO) },
                        { label: "Objetivo mental", color: "#8B5CF6", text: clean(s.OBJETIVO_MENTAL) },
                      ].filter((o) => o.text);
                      const conDetalle = objetivos.length > 0 || Boolean(clean(s.FEEDBACK));

                      return (
                        <div
                          key={s.ID_REGISTRO}
                          className={`rounded-2xl border transition ${
                            open
                              ? "border-[#C8A96B]/50 bg-[#C8A96B]/[0.05]"
                              : "border-white/5 bg-white/[0.02] hover:border-white/20"
                          }`}
                        >
                          <button
                            onClick={() =>
                              setExpanded(open ? null : s.ID_REGISTRO)
                            }
                            className="flex w-full items-center gap-3 p-3 text-left"
                          >
                            {/* eslint-disable-next-line @next/next/no-img-element */}
                            <img
                              src={jugador?.foto ?? PLAYER_PHOTO_FALLBACK}
                              alt={nameOf(s)}
                              className="h-11 w-11 shrink-0 rounded-xl object-cover"
                            />

                            <div className="min-w-0 flex-1">
                              <div className="flex flex-wrap items-center gap-2">
                                <p className="text-sm font-semibold">
                                  {nameOf(s)}
                                </p>

                                <span className="text-[11px] text-white/35">
                                  {nombrePuesto(jugador?.posicion ?? "")}
                                </span>
                              </div>

                              <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
                                <Tag icon={CalendarDays}>
                                  {fmtFecha(s.FECHA)}
                                </Tag>

                                <Tag icon={Users}>{s.QUIEN}</Tag>

                                <Tag icon={Video}>{s.ESTRATEGIA}</Tag>

                                <Tag icon={Target}>{s.MODALIDAD}</Tag>

                                <Tag icon={Clock}>{s.MOMENTO}</Tag>
                              </div>
                            </div>

                            {conDetalle && (
                              <ChevronDown
                                className={`h-4 w-4 shrink-0 text-white/40 transition ${
                                  open ? "rotate-180" : ""
                                }`}
                              />
                            )}
                          </button>

                          {open && conDetalle && (
                            <div className="border-t border-white/5 p-4 pt-3.5">
                              {objetivos.length > 0 && (
                                <div
                                  className={`grid grid-cols-1 gap-3 ${
                                    objetivos.length === 3 ? "md:grid-cols-3" : objetivos.length === 2 ? "md:grid-cols-2" : ""
                                  }`}
                                >
                                  {objetivos.map((o) => (
                                    <Objective key={o.label} label={o.label} color={o.color} text={o.text} />
                                  ))}
                                </div>
                              )}

                              {clean(s.FEEDBACK) && (
                                <div className={`${objetivos.length ? "mt-3 " : ""}rounded-xl border border-white/5 bg-white/[0.03] p-3.5`}>
                                  <p className="mb-1.5 flex items-center gap-1.5 text-[10px] uppercase tracking-wider text-white/40">
                                    <MessageSquareText className="h-3 w-3" />
                                    Feedback
                                  </p>

                                  <p className="whitespace-pre-line text-sm leading-relaxed text-white/80">
                                    {s.FEEDBACK}
                                  </p>
                                </div>
                              )}
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>

                  {feed.length > feedLimit && (
                    <button
                      onClick={verMasFeed}
                      className="mt-5 w-full rounded-2xl border border-white/10 py-3 text-sm text-white/60 transition hover:border-[#C8A96B]/40 hover:text-white"
                    >
                      Ver más ({feed.length - feedLimit} restantes)
                    </button>
                  )}
                </Panel>
              </div>
            )}
          </div>
        </section>
      </div>
    </main>
  );
}

/* ------------------------------------------------------------------ */
/* UI pieces                                                           */
/* ------------------------------------------------------------------ */

/** Los jugadores que nombra una lectura: su ficha y, a un toque, su calendario y registrar (16/11/2026). */
function JugadoresDeLectura({ jugadores }: { jugadores: { id: string; nombre: string; detalle: string }[] }) {
  /* 20/11/2026 (ronda 4, dos jueces): con muchos, el mismo chip diez veces.
     Si todos llevan la misma etiqueta, se dice una vez; y pasados seis, el
     resto se pliega tras «ver los N». */
  const comun = jugadores.length > 1 && jugadores.every((j) => j.detalle === jugadores[0].detalle) ? jugadores[0].detalle : null;
  const chip = (j: { id: string; nombre: string; detalle: string }) => (
    <li
      key={j.id}
      className="inline-flex min-w-0 flex-wrap items-center gap-1.5 rounded-2xl border border-[#C8A96B]/30 bg-white/[0.04] py-1 pl-2.5 pr-1"
    >
      {/* 27/11/2026 (marketing, ronda 9): también su ficha, a un toque.
          Ronda 10 (marketing y análisis): tres iconos sin rótulo eran ilegibles en
          el móvil: el nombre, subrayado, abre su ficha y queda un solo botón con
          su texto, «Registrar seguimiento», con él ya elegido. */}
      <NombreJugador jugador={{ id: j.id, nombre: j.nombre }} className="text-xs font-semibold text-white underline decoration-white/30" />
      {!comun && <span className="text-[11px] tabular-nums text-white/60">{j.detalle}</span>}
      <EnlacesJugador jugador={{ id: j.id, nombre: j.nombre }} destinos={["registrar"]} />
    </li>
  );
  const TOPE = 6;

  return (
    <div className="mt-2 min-w-0">
      {comun && (
        <p className="mb-1.5 text-[12px] tabular-nums text-white/65">
          {jugadores.length === 2 ? "Los dos" : `Los ${jugadores.length}`}: {comun}
        </p>
      )}
      <ul className="flex min-w-0 flex-wrap gap-2">{jugadores.slice(0, TOPE).map(chip)}</ul>
      {jugadores.length > TOPE && (
        <details className="mt-2">
          <summary className="cursor-pointer select-none text-[11px] font-semibold text-[color:var(--rmcf-gold-ink,#C8A96B)]">
            Ver los {jugadores.length} ({jugadores.length - TOPE} más)
          </summary>
          <ul className="mt-2 flex min-w-0 flex-wrap gap-2">{jugadores.slice(TOPE).map(chip)}</ul>
        </details>
      )}
    </div>
  );
}

/** Una fila de los recuentos por categoría (modalidad, entrenador…). */
type Recuento = { name: string; value: number; percentage: number };

/** Lo que Recharts le pasa al contenido del tooltip, en lo que aquí se usa. */
type EntradaTooltip = {
  name?: string | number;
  value?: ReactNode;
  color?: string;
  payload?: Record<string, ReactNode>;
};

function Panel({
  title,
  subtitle,
  action,
  children,
}: {
  title: ReactNode;
  subtitle?: ReactNode;
  action?: ReactNode;
  children?: ReactNode;
}) {
  return (
    <div className="rounded-3xl border border-white/10 bg-[#121922] p-4 md:p-6">
      <div className="mb-5 flex items-start justify-between gap-3">
        <div>
          <h3 className="text-base md:text-lg font-semibold leading-tight">
            {title}
          </h3>

          {subtitle && (
            <p className="mt-1 text-xs md:text-sm text-white/40">{subtitle}</p>
          )}
        </div>

        {action}
      </div>

      {children}
    </div>
  );
}

/* EVOLUCIÓN SEMANAL en HTML (17/11/2026, ronda 19). Barra apilada por semana:
   oro, individuales; gris, grupales; la semana en curso rayada; la media de
   las semanas completas en raya. Pulsar una barra filtra esa semana. */
function BarrasSemanales({
  datos,
  media,
  semanaEnCurso,
  activa,
  onSelect,
}: {
  datos: { week: string; desde: string; value: number; individual: number; grupal: number; jugadores: number }[];
  media: number;
  semanaEnCurso: string;
  activa: string;
  onSelect: (week: string) => void;
}) {
  const maximo = Math.max(...datos.map((d) => d.value), media, 1);
  /* 27/11/2026 (análisis, ronda 10): una semana atípica (el pico grupal de 69)
     aplastaba al resto. Si pasa de 1,6 veces la segunda, el eje se corta: la
     barra llega arriba con una marca de corte y su cifra real encima. */
  const segunda = [...datos.map((d) => d.value)].sort((a, b) => b - a)[1] ?? 0;
  const corta = datos.length >= 3 && segunda > 0 && maximo >= segunda * 1.6 && maximo >= media * 1.5;
  const tope = corta ? Math.max(segunda * 1.25, media * 1.3, 1) : maximo;
  const alto = 220;
  const rayado = "repeating-linear-gradient(135deg, rgb(var(--rmcf-ink-rgb) / 0.22) 0 4px, transparent 4px 8px)";

  return (
    <div className="pt-2">
      <div className="mb-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-[11px] text-white/60">
        <span className="inline-flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-sm" style={{ background: GOLD }} />Individuales</span>
        <span className="inline-flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-sm bg-[#6E7F99]" />Grupales</span>
        {media > 0 && <span className="inline-flex items-center gap-1.5"><span className="w-4 border-t-2 border-dashed border-white/50" />Media {String(media).replace(".", ",")}</span>}
        {semanaEnCurso && datos.some((d) => d.week === semanaEnCurso) && <span className="inline-flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-sm border border-white/30" style={{ background: rayado }} />En curso (fuera de la media)</span>}
        {corta && <span className="inline-flex items-center gap-1.5"><span className="h-2 w-3 border-y-2" style={{ borderColor: "rgb(var(--rmcf-ink-rgb) / 0.7)" }} />Eje cortado en la semana pico</span>}
      </div>
      <div className="overflow-x-auto pb-1">
        <div className="relative flex items-end gap-1 sm:gap-1.5" style={{ height: alto + 58, minWidth: datos.length * 26 }}>
          {media > 0 && (
            <div className="pointer-events-none absolute inset-x-0 border-t-2 border-dashed border-white/40" style={{ bottom: 22 + (media / tope) * alto }} aria-hidden />
          )}
          {datos.map((d, i) => {
            const enCurso = d.week === semanaEnCurso;
            /* 20/11/2026 (ronda 4, jueces): la semana atípica, marcada en el propio gráfico. */
            const pico = media > 0 && d.value === maximo && d.value >= media * 1.5;
            const cortada = corta && d.value > tope;
            const elegida = activa === d.week;
            const atenuada = Boolean(activa) && !elegida;
            const lunes = d.desde.split(" – ")[0].replace(/^lun /, "");
            /* La barra cortada llega al techo y conserva el reparto individual/grupal. */
            const escala = cortada ? alto / Math.max(1, d.value) : alto / tope;
            const hInd = d.individual * escala;
            const hGru = d.grupal * escala;

            return (
              <button
                key={d.week}
                type="button"
                onClick={() => onSelect(d.week)}
                aria-pressed={elegida}
                title={`Semana del ${lunes}${enCurso ? " (en curso)" : ""}: ${d.value} registros (${d.individual} individuales, ${d.grupal} grupales) · ${d.jugadores} jugadores distintos`}
                className={`group flex min-w-[22px] flex-1 flex-col items-center justify-end transition ${atenuada ? "opacity-40" : ""}`}
                style={{ height: alto + 58 }}
              >
                <span className="mb-0.5 text-[11px] font-bold tabular-nums text-white/85">
                  {d.value}
                  {/* 27/11/2026 (marketing, ronda 10): la explicación del pico, aquí y no en el titular. */}
                  {pico && (
                    <span className="block whitespace-nowrap text-[11px] font-semibold text-[color:var(--rmcf-gold-ink,#C8A96B)]">
                      pico · {d.grupal >= d.value / 2 ? `${d.grupal} grupales` : `${d.individual} individuales`}
                    </span>
                  )}
                </span>
                <span className={`flex w-full max-w-[48px] flex-col overflow-hidden rounded-t-md ${elegida ? "ring-2 ring-[#C8A96B]" : ""}`}>
                  {cortada && (
                    <span
                      aria-hidden
                      title="Eje cortado: la barra pasa del techo del gráfico"
                      className="block h-[7px] w-full border-y-2"
                      style={{ borderColor: "rgb(var(--rmcf-ink-rgb) / 0.7)", background: "rgb(var(--rmcf-ink-rgb) / 0.08)" }}
                    />
                  )}
                  <span className="block w-full bg-[#6E7F99]" style={{ height: hGru, backgroundImage: enCurso ? rayado : undefined }} />
                  <span className="block w-full" style={{ height: hInd, background: GOLD, backgroundImage: enCurso ? rayado : undefined }} />
                </span>
                {/* 20/11/2026 (ronda 4, juez de fútbol): el mes en el primer lunes de cada mes (y en la primera barra). */}
                <span className="mt-1 h-[18px] whitespace-nowrap text-[11px] tabular-nums text-white/55">
                  {lunes.replace(/ \p{L}+$/u, "")}
                  {(i === 0 || Number(lunes.match(/\d+/)?.[0] ?? 99) <= 7) && (
                    <span className="ml-0.5 font-semibold text-white/75">{/ \p{L}+$/u.test(lunes) ? lunes.replace(/^\d+ /, "") : d.desde.split(" ").at(-1)}</span>
                  )}
                </span>
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}

function ChartBox({
  children,
  height,
}: {
  children: ReactNode;
  height?: number;
}) {
  return (
    <div className="w-full" style={{ height: height ?? 320 }}>
      <ResponsiveConVistas width="100%" height="100%">
        {children}
      </ResponsiveConVistas>
    </div>
  );
}

function StatCard({
  icon: Icon,
  title,
  value,
  hint,
  base,
  accent = GOLD,
  progress,
  delta,
}: {
  icon: LucideIcon;
  title: string;
  value: ReactNode;
  hint?: string;
  /** 20/11/2026 (ronda 4): una línea con la base; con ella, `hint` pasa al globo. */
  base?: string;
  accent?: string;
  progress?: number;
  delta?: number;
}) {
  const showDelta = typeof delta === "number" && delta !== 0;

  const DeltaIcon = !showDelta ? Minus : delta > 0 ? ArrowUp : ArrowDown;
  const visible = base ?? hint;

  return (
    <div className={`rounded-2xl border border-white/10 bg-white/[0.03] p-4 transition hover:border-white/25 ${base && hint ? "cursor-help" : ""}`} title={base && hint ? hint : undefined}>
      <div className="flex items-center justify-between">
        <p className="text-[11px] uppercase tracking-wider text-white/55">
          {title}
        </p>

        <Icon
          className="h-4 w-4 opacity-60"
          style={{ color: chipInk(accent) }}
        />
      </div>

      <p
        className="mt-2.5 text-2xl md:text-[28px] font-semibold leading-none"
        style={{ color: chipInk(accent) }}
      >
        {value}
      </p>

      <div className="mt-2.5 flex items-center gap-2">
        {visible && (
          <span className="min-w-0 break-words text-xs leading-snug text-white/60">{visible}</span>
        )}

        {showDelta && (
          <span
            className={`inline-flex shrink-0 items-center gap-0.5 rounded-md px-1.5 py-0.5 text-[10px] font-semibold ${
              delta > 0
                ? "bg-emerald-500/15 text-emerald-400"
                : "bg-rose-500/15 text-rose-400"
            }`}
          >
            <DeltaIcon className="h-2.5 w-2.5" />
            {cm(Math.abs(delta))}
          </span>
        )}
      </div>

      {typeof progress === "number" && (
        <div className="mt-3 h-1.5 rounded-full bg-white/10">
          <div
            className="h-full rounded-full transition-all"
            style={{
              width: `${Math.min(progress, 100)}%`,
              background: accent,
            }}
          />
        </div>
      )}
    </div>
  );
}

function Select({
  label,
  value,
  onChange,
  options,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  options: { value: string; label: string }[];
}) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-[10px] uppercase tracking-wider text-white/35">
        {label}
      </span>

      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="w-full rounded-2xl border border-white/10 bg-[#11161C] px-3 py-2.5 text-sm text-white outline-none focus:border-[#C8A96B]/50"
      >
        {options.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
    </label>
  );
}

function DonutWithLegend({
  data,
  active,
  onSelect,
}: {
  data: Recuento[];
  active: string;
  onSelect: (name: string) => void;
}) {
  const total = data.reduce((a, b) => a + b.value, 0);

  return (
    <div className="flex flex-col lg:flex-row items-center gap-4">
      <div className="relative flex h-[240px] w-full items-center justify-center lg:w-1/2">
        {/* Tamaño fijo y sin animación de entrada (26/10/2026): con
            ResponsiveContainer el anillo salía vacío —sólo el total y la
            leyenda— cuando el ancho medido llegaba a 0 o la animación no
            arrancaba. Los arcos se dibujan siempre. */}
        <div className="h-[240px] w-[240px]">
          <PieChart width={240} height={240}>
            <Pie
              data={data}
              dataKey="value"
              nameKey="name"
              cx={120}
              cy={120}
              innerRadius={62}
              outerRadius={100}
              paddingAngle={2}
              isAnimationActive={false}
              cursor="pointer"
              onClick={(d) => {
                const name = d?.payload?.name ?? d?.name;

                if (name) onSelect(name);
              }}
            >
              {data.map((item, i) => (
                <Cell
                  key={item.name}
                  fill={COLORS[i % COLORS.length]}
                  opacity={active && active !== item.name ? 0.25 : 1}
                />
              ))}
            </Pie>

            <Tooltip content={<DarkTooltip rows={[["% del total", "percentage"]]} />} />
          </PieChart>
        </div>

        <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
          <p className="text-2xl font-bold text-[#C8A96B]">{total}</p>

          <p className="text-[10px] uppercase tracking-wider text-white/35">
            registros
          </p>
        </div>
      </div>

      <div className="w-full space-y-1.5 lg:w-1/2">
        {data.map((item, i) => (
          <button
            key={item.name}
            onClick={() => onSelect(item.name)}
            className="flex w-full items-center gap-3 rounded-xl px-2 py-1.5 text-left transition hover:bg-white/5"
          >
            <span
              className="h-2.5 w-2.5 shrink-0 rounded-full"
              style={{ background: COLORS[i % COLORS.length] }}
            />

            <span className="flex-1 truncate text-sm text-white/80">
              {item.name}
            </span>

            <span className="text-sm font-semibold">{item.value}</span>

            {/* 27/11/2026 (análisis, ronda 10): con menos de 15 registros, el % es tendencia. */}
            <span className="shrink-0 text-right text-xs tabular-nums text-white/55">
              {cm(item.percentage)} %{item.value < 15 ? " · tend." : ""}
            </span>
          </button>
        ))}
      </div>
    </div>
  );
}

function DarkTooltip({
  active,
  payload,
  label,
  rows,
}: {
  active?: boolean;
  payload?: EntradaTooltip[];
  label?: ReactNode;
  rows?: [string, string][];
}) {
  if (!active || !payload?.length) return null;

  const d: Record<string, ReactNode> = payload[0].payload ?? {};

  return (
    <div className="rounded-xl border border-white/10 bg-[#141A22] p-3 shadow-2xl">
      {label !== undefined && (
        <p className="mb-1.5 text-sm font-semibold text-white">{label}</p>
      )}

      {payload[0]?.name && label === undefined && (
        <p className="mb-1.5 text-sm font-semibold text-white">
          {d.name ?? payload[0].name}
        </p>
      )}

      <div className="space-y-0.5">
        {payload.map((p, i) => (
          <p
            key={i}
            className="text-xs"
            style={{ color: chipInk(p.color ?? "#CBD5E1") }}
          >
            {p.name}: <span className="font-semibold">{cm(p.value as ReactNode)}</span>
          </p>
        ))}

        {rows?.map(([rowLabel, key]) =>
          d[key] !== undefined && d[key] !== "" ? (
            <p key={key} className="text-xs text-white/50">
              {rowLabel}: <span className="font-semibold">{cm(d[key])}</span>
            </p>
          ) : null
        )}
      </div>
    </div>
  );
}

function HeatRow({
  row,
  max,
  selected,
  onSelectPlayer,
  onSelectCell,
}: {
  row: { name: string; total: number; cells: { week: number; count: number }[] };
  max: number;
  selected: boolean;
  onSelectPlayer: () => void;
  onSelectCell: (week: number) => void;
}) {
  return (
    <>
      <button
        onClick={onSelectPlayer}
        className={`truncate rounded-lg border px-2.5 py-1.5 text-left text-xs transition ${
          selected
            ? "border-[#C8A96B] bg-[#C8A96B]/10 text-[#C8A96B]"
            : "border-white/5 bg-white/[0.02] text-white/75 hover:border-white/20"
        }`}
        title={row.name}
      >
        {row.name}
      </button>

      {row.cells.map((c) => {
        const t = max ? c.count / max : 0;

        return (
          <button
            key={c.week}
            onClick={() => c.count > 0 && onSelectCell(c.week)}
            disabled={!c.count}
            title={`${row.name} · S${c.week}: ${c.count} seguimiento${
              c.count === 1 ? "" : "s"
            }`}
            className="flex h-7 items-center justify-center rounded-md border border-white/5 text-[10px] font-semibold transition hover:border-white/30 disabled:hover:border-white/5"
            style={{
              background: c.count
                ? `rgba(200,169,107,${0.12 + t * 0.8})`
                : "rgba(255,255,255,0.02)",
              color: t > 0.5 ? "#0B0F14" : "rgb(var(--rmcf-ink-rgb) / .5)",
            }}
          >
            {c.count || ""}
          </button>
        );
      })}

      <div className="flex h-7 items-center justify-center rounded-md bg-white/[0.04] text-xs font-bold text-[#C8A96B]">
        {row.total}
      </div>
    </>
  );
}

function MatrixRow({
  row,
  max,
  selected,
  onSelectCoach,
  onSelectCell,
}: {
  row: {
    coach: string;
    total: number;
    cells: { strategy: string; count: number }[];
  };
  max: number;
  selected: boolean;
  onSelectCoach: () => void;
  onSelectCell: (strategy: string) => void;
}) {
  return (
    <>
      <button
        onClick={onSelectCoach}
        className={`flex flex-col justify-center rounded-xl border px-3 py-2 text-left transition ${
          selected
            ? "border-[#C8A96B] bg-[#C8A96B]/10"
            : "border-white/5 bg-white/[0.02] hover:border-white/20"
        }`}
      >
        <span className="truncate text-xs font-semibold">{row.coach}</span>

        <span className="text-[10px] text-white/35">{row.total} registros</span>
      </button>

      {row.cells.map((c) => {
        const t = max ? c.count / max : 0;

        return (
          <button
            key={c.strategy}
            onClick={() => c.count > 0 && onSelectCell(c.strategy)}
            disabled={!c.count}
            className="flex h-[52px] items-center justify-center rounded-xl border border-white/5 text-sm font-semibold transition hover:border-white/30 disabled:hover:border-white/5"
            style={{
              background: c.count
                ? `rgba(200,169,107,${0.12 + t * 0.8})`
                : "rgba(255,255,255,0.02)",
              color: t > 0.5 ? "#0B0F14" : "rgb(var(--rmcf-ink-rgb) / .55)",
            }}
          >
            {c.count || "·"}
          </button>
        );
      })}
    </>
  );
}

function Tag({
  icon: Icon,
  children,
}: {
  icon: LucideIcon;
  children?: ReactNode;
}) {
  if (!children) return null;

  return (
    <span className="inline-flex items-center gap-1 rounded-md border border-white/5 bg-white/[0.04] px-2 py-0.5 text-[10px] text-white/55">
      <Icon className="h-2.5 w-2.5" />
      {children}
    </span>
  );
}

function Objective({
  label,
  color,
  text,
}: {
  label: string;
  color: string;
  text?: string;
}) {
  const value = clean(text);

  /* Sin texto no se pinta (nada de «Sin registrar»; 07/11/2026). */
  if (!value) return null;

  return (
    <div
      className="rounded-xl border p-3"
      style={{ borderColor: `${color}33`, background: `${color}0D` }}
    >
      <p
        className="mb-1.5 text-[10px] uppercase tracking-wider"
        style={{ color }}
      >
        {label}
      </p>

      <p className="text-sm leading-relaxed text-white/75">
        {value}
      </p>
    </div>
  );
}

function MiniCard({
  title,
  name,
  value,
  tone,
}: {
  title: string;
  name: string;
  value: string;
  tone: string;
}) {
  const tones: Record<string, string> = {
    emerald: "border-emerald-400/20 bg-emerald-400/[0.06] text-emerald-400",
    rose: "border-rose-400/20 bg-rose-400/[0.06] text-rose-400",
  };

  return (
    <div className={`rounded-3xl border p-6 ${tones[tone]}`}>
      <p className="text-xs uppercase tracking-wider text-white/45">{title}</p>

      <h3 className="mt-3 text-2xl font-bold">{name}</h3>

      <p className="mt-1.5 text-sm text-white/50">{value}</p>
    </div>
  );
}
