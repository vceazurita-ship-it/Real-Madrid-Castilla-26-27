"use client";
import { traeJson } from "@/lib/hojaCsv";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Brain, Clock3, Dumbbell } from "lucide-react";
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
  formatMinutes,
  normalizeText,
  parseDateKey,
  recordDateKey,
} from "@/lib/calendar";
import { cn } from "@/lib/utils";
import { EstadoError } from "@/components/ui/estados";
import { buscadorDeEscudos, traeEscudos, type Escudos } from "@/lib/data-analisis/escudos";

/** Nombre con el que sale el Castilla en la lista de escudos de BeSoccer. */
const NOSOTROS = "RM Castilla";

/**
 * ¿Es día de partido? La hoja lo marca con «MD» y una tarea de competición.
 * Se mira el MD y no sólo la tarea porque un MD-2 puede llevar un «partido
 * reducido» apuntado como competición.
 */
function esDiaDePartido(tareas: MicrocycleRecord[]) {
  return tareas.some(
    (t) =>
      String(t.MD ?? "").trim().toUpperCase() === "MD" &&
      /COMPETICION/.test(normalizeText(`${t["Tipo Tarea"]} ${t["Contenido Principal"]} ${t.Fase}`)),
  );
}

/** «UE SANT ANDREU» → «UE Sant Andreu»; las siglas cortas se quedan en mayúscula. */
function nombreBonito(nombre: string) {
  return nombre
    .toLowerCase()
    .split(/\s+/)
    .map((p) => (/^(de|del|la|el)$/.test(p) ? p : p.length <= 3 ? p.toUpperCase() : p.charAt(0).toUpperCase() + p.slice(1)))
    .join(" ");
}

/** Escudo del club o, si no lo hay (amistosos), sus iniciales en un círculo. */
function Escudo({ url, nombre, className }: { url: string | null; nombre: string; className?: string }) {
  const [roto, setRoto] = useState(false);

  if (url && !roto) {
    return (
      // eslint-disable-next-line @next/next/no-img-element -- escudo pequeño por el proxy propio
      <img
        src={url}
        alt={nombre}
        title={nombre}
        onError={() => setRoto(true)}
        className={cn("shrink-0 object-contain", className)}
      />
    );
  }

  const iniciales = nombre
    .replace(/[^\p{L}\s]/gu, " ")
    .split(/\s+/)
    .filter((p) => p.length > 2)
    .slice(0, 2)
    .map((p) => p[0])
    .join("")
    .toUpperCase();

  return (
    <span
      title={nombre}
      className={cn(
        "flex shrink-0 items-center justify-center rounded-full border border-white/20 bg-white/10 text-[8px] font-bold text-white/70",
        className,
      )}
    >
      {iniciales || "?"}
    </span>
  );
}


type MicrocycleRecord = {
  Temporada: string;
  Micro: string;
  Rival: string;
  Día: string;
  MD: string;
  Fecha: string;

  Tarea: string;
  "Tipo Tarea": string;

  Formato: string;
  "Nº Jugadores": number;
  Grupo: string;
  Espacio: string;

  "Contenido Principal": string;
  "Contenido Secundario": string;

  Fase: string;

  Tiempo: number;

  "Intensidad (1-10)": number;
  "Carga Ponderada": number;

  "Demanda Cognitiva(1-10)": number;
  "Carga cognitiva": number;

  Observaciones: string;
};

type PhaseTheme = {
  label: string;
  dot: string;
  chip: string;
  cell: string;
  bar: string;
};

const PHASE_THEMES: Record<string, PhaseTheme> = {
  OFENSIVA: {
    label: "Ofensiva",
    dot: "bg-emerald-400",
    chip: "bg-emerald-500/15 text-emerald-300 border border-emerald-500/30",
    cell: "bg-emerald-500/10",
    bar: "bg-emerald-400",
  },
  DEFENSIVA: {
    label: "Defensiva",
    dot: "bg-red-400",
    chip: "bg-red-500/15 text-red-300 border border-red-500/30",
    cell: "bg-red-500/10",
    bar: "bg-red-400",
  },
  TR_OFENSIVA: {
    label: "Transición ofensiva",
    dot: "bg-sky-400",
    chip: "bg-sky-500/15 text-sky-300 border border-sky-500/30",
    cell: "bg-sky-500/10",
    bar: "bg-sky-400",
  },
  TR_DEFENSIVA: {
    label: "Transición defensiva",
    dot: "bg-orange-400",
    chip: "bg-orange-500/15 text-orange-300 border border-orange-500/30",
    cell: "bg-orange-500/10",
    bar: "bg-orange-400",
  },
  ABP: {
    label: "ABP",
    dot: "bg-violet-400",
    chip: "bg-violet-500/15 text-violet-300 border border-violet-500/30",
    cell: "bg-violet-500/10",
    bar: "bg-violet-400",
  },
  GLOBAL: {
    label: "Global",
    dot: "bg-yellow-400",
    chip: "bg-yellow-500/15 text-yellow-300 border border-yellow-500/30",
    cell: "bg-yellow-500/10",
    bar: "bg-yellow-400",
  },
};

const NEUTRAL_THEME: PhaseTheme = {
  label: "Sin fase",
  dot: "bg-white/40",
  chip: "bg-white/10 text-white/70 border border-white/10",
  cell: "bg-[#141B24]",
  bar: "bg-white/30",
};

const LEGEND: CalendarLegendItem[] = Object.values(PHASE_THEMES).map((t) => ({
  label: t.label,
  color: t.dot,
}));

/**
 * Resuelve el tema de una fase. Las transiciones se comprueban antes que
 * ofensiva/defensiva porque "TR OFENSIVA" contiene ambas palabras.
 */
function phaseTheme(fase: string): PhaseTheme {
  const value = normalizeText(fase);

  if (!value) return NEUTRAL_THEME;

  const isTransition = /\bTR\b|TRANSICION/.test(value);

  if (isTransition && value.includes("OFENS")) return PHASE_THEMES.TR_OFENSIVA;
  if (isTransition && value.includes("DEFENS")) return PHASE_THEMES.TR_DEFENSIVA;
  if (value.includes("ABP")) return PHASE_THEMES.ABP;
  if (value.includes("GLOBAL")) return PHASE_THEMES.GLOBAL;
  if (value.includes("OFENS")) return PHASE_THEMES.OFENSIVA;
  if (value.includes("DEFENS")) return PHASE_THEMES.DEFENSIVA;

  return NEUTRAL_THEME;
}

const minutesOf = (task: MicrocycleRecord) => Number(task.Tiempo) || 0;

/*
| SIGLAS DE LOS CONTENIDOS (30/10/2026). «Defensa CR», «Ataque CP» o
| «Ind.Finalización» no se entendían fuera del cuerpo técnico. Son las mismas
| que explica la ayuda del Plan de partido (lib/ayuda/paginas.ts). Se ponen de
| `title` en cada barra y en una leyenda bajo el calendario, sólo las que
| salen ese mes.
*/
const SIGLAS: { re: RegExp; sigla: string; es: string }[] = [
  { re: /\bCP\b/, sigla: "CP", es: "ataque posicional u organizado" },
  { re: /\bCR\b/, sigla: "CR", es: "contraataque o transición rápida" },
  { re: /\bABP\b/, sigla: "ABP", es: "acciones a balón parado" },
  { re: /\bInd\b\.?/i, sigla: "Ind.", es: "trabajo individual" },
];

/** Las siglas que lleva un rótulo, ya desarrolladas: «CP: ataque posicional…». */
function siglasDe(nombre: string) {
  return SIGLAS.filter((s) => s.re.test(nombre));
}

function tituloConSiglas(nombre: string) {
  const s = siglasDe(nombre);

  return s.length ? `${nombre} (${s.map((x) => `${x.sigla}: ${x.es}`).join("; ")})` : nombre;
}

function MetricBar({
  value,
  max = 100,
  className,
}: {
  value: number;
  max?: number;
  className?: string;
}) {
  const pct = max > 0 ? Math.min(Math.max((value / max) * 100, 0), 100) : 0;

  return (
    <div className="h-1.5 w-full overflow-hidden rounded-full bg-white/10">
      <div
        className={cn("h-full rounded-full bg-[#C8A96B]", className)}
        style={{ width: `${pct}%` }}
      />
    </div>
  );
}

export default function MicroCalendar() {
  const months = useMemo(() => buildSeasonMonths(), []);

  const [currentMonth, setCurrentMonth] = useState(() =>
    currentMonthIndex(months)
  );
  const [microcycleData, setMicrocycleData] = useState<MicrocycleRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedKey, setSelectedKey] = useState<string | null>(null);

  /* Los escudos, los mismos que usan los gráficos de Data Análisis. */
  const [listaEscudos, setListaEscudos] = useState<Escudos>([]);

  useEffect(() => {
    let vivo = true;

    void traeEscudos().then((lista) => {
      if (vivo) setListaEscudos(lista);
    });

    return () => {
      vivo = false;
    };
  }, []);

  const escudoDe = useMemo(() => buscadorDeEscudos(listaEscudos), [listaEscudos]);

  /*
  | TIEMPO LÍMITE (30/10/2026): a los 15 s sin hoja, el esqueleto deja paso a
  | un aviso con «Reintentar»; la petición sigue y, si llega, se pinta sola.
  */
  const [intento, setIntento] = useState(0);
  const [lenta, setLenta] = useState(false);

  useEffect(() => {
    if (!loading) return;

    const id = setTimeout(() => setLenta(true), 15_000);

    return () => clearTimeout(id);
  }, [loading, intento]);

  const reintenta = () => {
    setLenta(false);
    setError(null);
    setLoading(true);
    setIntento((n) => n + 1);
  };

  useEffect(() => {
    let cancelled = false;

    traeJson<unknown>("/api/rivals?action=microciclo", intento > 0 ? { forzar: true } : undefined)
      .then((data) => {
        if (cancelled) return;

        if (Array.isArray(data)) {
          setMicrocycleData(data);
          setError(null);
        } else {
          console.error("Microciclo: respuesta inesperada", data);
          setMicrocycleData([]);
          setError("La hoja de microciclos ha llegado en un formato que no se entiende. Pulsa «Reintentar» y, si sigue, avisa al administrador.");
        }
      })
      .catch((err) => {
        console.error(err);
        if (!cancelled) setError("No se ha podido cargar la hoja de microciclos. Comprueba la conexión y pulsa «Reintentar».");
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [intento]);

  /** Tareas agrupadas por día. */
  const tasksByDay = useMemo(() => {
    const map = new Map<string, MicrocycleRecord[]>();

    microcycleData.forEach((task) => {
      const key = recordDateKey(task.Fecha);
      if (!key) return;

      const list = map.get(key);
      if (list) list.push(task);
      else map.set(key, [task]);
    });

    return map;
  }, [microcycleData]);

  const sessionDays = useMemo(() => [...tasksByDay.keys()].sort(), [tasksByDay]);

  const active = months[currentMonth];

  const statsDelMes = useCallback(
    (month: number, year: number) => {
      let sesiones = 0;
      let minutos = 0;
      let carga = 0;
      let cognitiva = 0;
      let tareas = 0;
      let partidos = 0;
      const siglas = new Set<string>();

      sessionDays.forEach((key) => {
        const date = parseDateKey(key);
        if (date.getMonth() !== month || date.getFullYear() !== year) return;

        const dayTasks = tasksByDay.get(key) ?? [];

        sesiones += 1;
        tareas += dayTasks.length;
        if (esDiaDePartido(dayTasks)) partidos += 1;

        dayTasks.forEach((t) => {
          const rotulo = `${t["Contenido Principal"] || t["Tipo Tarea"] || ""}`;
          siglasDe(rotulo).forEach((s) => siglas.add(s.sigla));
        });

        dayTasks.forEach((t) => {
          minutos += minutesOf(t);
          carga += Number(t["Carga Ponderada"]) || 0;
          cognitiva += Number(t["Carga cognitiva"]) || 0;
        });
      });

      return {
        sesiones,
        tareas,
        partidos,
        siglas,
        minutos,
        cargaMedia: sesiones > 0 ? Math.round(carga / sesiones) : 0,
        cognitivaMedia: sesiones > 0 ? Math.round(cognitiva / sesiones) : 0,
      };
    },
    [sessionDays, tasksByDay]
  );

  const monthStats = useMemo(
    () => statsDelMes(active.month, active.year),
    [statsDelMes, active]
  );

  /* El mes anterior, para decir contra qué se comparan las cargas medias. */
  const mesPrevio = useMemo(() => {
    const month = active.month === 0 ? 11 : active.month - 1;
    const year = active.month === 0 ? active.year - 1 : active.year;
    return { month, stats: statsDelMes(month, year) };
  }, [statsDelMes, active]);

  /** «+12 % sobre septiembre»; vacío si el mes anterior no tuvo sesiones. */
  const frente = (actual: number, previo: number) => {
    if (mesPrevio.stats.sesiones === 0 || previo <= 0) return "";
    const pct = Math.round(((actual - previo) / previo) * 100);
    const nombre = MONTHS[mesPrevio.month].toLowerCase();
    if (pct === 0) return ` · igual que en ${nombre}`;
    return ` · ${pct > 0 ? "+" : "−"}${Math.abs(pct)} % sobre ${nombre}`;
  };

  /** «24 sesiones (4 partidos)»: la base de las medias de carga. */
  const baseDelMes = `${monthStats.sesiones} ${monthStats.sesiones === 1 ? "sesión" : "sesiones"}${
    monthStats.partidos ? ` (${monthStats.partidos} ${monthStats.partidos === 1 ? "partido" : "partidos"})` : ""
  }`;

  /*
  | «Más carga no es mejor» (30/10/2026): si cambia mucho contra el mes
  | anterior y hay otro número de partidos, se dice por qué puede ser.
  */
  const lecturaCarga = (() => {
    const previo = mesPrevio.stats;
    if (previo.sesiones === 0 || previo.cargaMedia <= 0 || monthStats.sesiones === 0) return "";
    const pct = Math.round(((monthStats.cargaMedia - previo.cargaMedia) / previo.cargaMedia) * 100);
    if (Math.abs(pct) < 5) return "";
    const nombre = MONTHS[mesPrevio.month].toLowerCase();
    if (pct < 0 && monthStats.partidos > previo.partidos) {
      return `La carga media baja con más partidos que en ${nombre} (${monthStats.partidos} frente a ${previo.partidos}): es la descarga de las semanas de competición, no un peor trabajo.`;
    }
    if (pct > 0 && monthStats.partidos < previo.partidos) {
      return `La carga media sube con menos partidos que en ${nombre} (${monthStats.partidos} frente a ${previo.partidos}): hay más días de carga entre partidos.`;
    }
    return pct < 0
      ? `La carga media baja un ${Math.abs(pct)} % frente a ${nombre} sin más partidos: conviene confirmar que es la descarga buscada.`
      : `La carga media sube un ${pct} % frente a ${nombre}: vigilar la recuperación en los MD-1 y MD+1.`;
  })();

  const selectedDate = selectedKey ? parseDateKey(selectedKey) : null;
  const selectedIndex = selectedKey ? sessionDays.indexOf(selectedKey) : -1;

  const selectedTasks = useMemo(
    () => (selectedKey ? tasksByDay.get(selectedKey) ?? [] : []),
    [selectedKey, tasksByDay]
  );

  /** Tareas del día agrupadas por contenido principal. */
  const grouped = useMemo(() => {
    return selectedTasks.reduce((acc, task) => {
      const key = task["Contenido Principal"] || "";

      if (!acc[key]) acc[key] = [];
      acc[key].push(task);

      return acc;
    }, {} as Record<string, MicrocycleRecord[]>);
  }, [selectedTasks]);

  const selectedSummary = useMemo(() => {
    const minutos = selectedTasks.reduce((s, t) => s + minutesOf(t), 0);
    const head = selectedTasks[0];

    /* La barra de cada carga se mide contra la tarea más cargada del día
       (19/10/2026). Antes iba contra 100 fijo, y como la carga es minutos ×
       intensidad (20' a 7 = 140) casi todas las barras salían llenas. */
    const maxCarga = Math.max(0, ...selectedTasks.map((t) => Number(t["Carga Ponderada"]) || 0));
    const maxCognitiva = Math.max(0, ...selectedTasks.map((t) => Number(t["Carga cognitiva"]) || 0));

    return {
      maxCarga,
      maxCognitiva,
      minutos,
      micro: head?.Micro ?? "",
      md: head?.MD ?? "",
      rival: head?.Rival ?? "",
    };
  }, [selectedTasks]);

  /** Salta a la sesión anterior/siguiente y sincroniza el mes visible. */
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

  return (
    <CalendarShell
      eyebrow="RMCF CASTILLA · ENTRENAMIENTO"
      title={
        monthStats.sesiones > 0
          ? `${monthStats.sesiones} ${monthStats.sesiones === 1 ? "sesión" : "sesiones"} y ${formatMinutes(monthStats.minutos)} en ${MONTHS[active.month].toLowerCase()}`
          : "Calendario de Microciclo"
      }
      months={months}
      monthIndex={currentMonth}
      onMonthChange={setCurrentMonth}
      loading={loading}
      keyboardEnabled={!selectedKey}
      legend={LEGEND}
      stats={
        <>
          <CalendarStat
            label="Sesiones"
            value={monthStats.sesiones}
            hint={`${monthStats.tareas} tareas en ${MONTHS[active.month].toLowerCase()}`}
          />
          <CalendarStat
            label="Volumen"
            value={formatMinutes(monthStats.minutos)}
            hint={`en ${MONTHS[active.month].toLowerCase()}`}
          />
          {/* Las dos cargas son puntos sin unidad: se dice de qué salen
              (19/10/2026), si no un 420 no le dice nada a nadie. 30/10/2026:
              y sobre cuántas sesiones y partidos, porque un mes con más
              partidos baja la media a propósito (bajar no es peor). */}
          <CalendarStat
            label="Carga física media / sesión"
            value={monthStats.cargaMedia}
            hint={`Media por sesión de minutos × intensidad, sobre ${baseDelMes}${frente(monthStats.cargaMedia, mesPrevio.stats.cargaMedia)}`}
          />
          <CalendarStat
            label="Carga cognitiva media / sesión"
            value={monthStats.cognitivaMedia}
            hint={`Media por sesión de minutos × demanda cognitiva, sobre ${baseDelMes}${frente(monthStats.cognitivaMedia, mesPrevio.stats.cognitivaMedia)}`}
          />
        </>
      }
      renderDay={({ key }) => {
        const dayTasks = tasksByDay.get(key) ?? [];
        if (dayTasks.length === 0) return {};

        const totalMinutes = dayTasks.reduce((s, t) => s + minutesOf(t), 0);

        // Minutos por contenido principal, ordenados de mayor a menor.
        const blocks = new Map<string, number>();
        dayTasks.forEach((t) => {
          /* Sin contenido principal se rotula con el tipo de tarea; sin ninguno, no se pinta. */
          const name = (t["Contenido Principal"] || t["Tipo Tarea"] || "").trim();
          blocks.set(name, (blocks.get(name) ?? 0) + minutesOf(t));
        });

        const orderedBlocks = [...blocks.entries()]
          .filter(([name]) => name)
          .sort((a, b) => b[1] - a[1]);

        // Fase dominante = la que más minutos acumula.
        const phases = new Map<string, number>();
        dayTasks.forEach((t) => {
          const name = t.Fase || "Global";
          phases.set(name, (phases.get(name) ?? 0) + minutesOf(t));
        });

        const dominantPhase =
          [...phases.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] ?? "";

        const theme = phaseTheme(dominantPhase);
        const md = dayTasks[0]?.MD;

        const partido = esDiaDePartido(dayTasks) ? String(dayTasks[0]?.Rival ?? "").trim() : "";

        return {
          hasContent: true,
          accentClass: theme.cell,
          onClick: () => setSelectedKey(key),
          badges: (
            <div className="flex items-center gap-1">
              {md && (
                <span
                  className="whitespace-nowrap rounded-full px-1.5 py-0.5 text-[10px] font-semibold uppercase"
                  style={{ background: "#1F2937", color: "#FFFFFF" }}
                >
                  {md}
                </span>
              )}

              {/* Mismo formato con o sin minutos; el total del mes sólo suma los que los tienen. */}
              {/* 29/10/2026: sin minutos no sale ni píldora ni «sin tiempo»: lo que no hay no se nombra. */}
              {totalMinutes > 0 && (
                <span className="rounded-full border border-[#C8A96B]/30 bg-[#C8A96B]/10 px-2 py-0.5 text-[10px] font-semibold text-[#C8A96B]">
                  {formatMinutes(totalMinutes)}
                </span>
              )}
            </div>
          ),
          children: (
            <>
              {/* El partido del día, a la vista sin abrir la casilla. */}
              {partido && (
                <div
                  className="flex items-center gap-1 rounded-md border border-[#C8A96B]/30 bg-[#C8A96B]/10 px-1.5 py-1"
                  title={`Castilla vs ${nombreBonito(partido)}`}
                >
                  <Escudo url={escudoDe(NOSOTROS)} nombre="RM Castilla" className="h-4 w-4 md:h-5 md:w-5" />
                  <span className="shrink-0 text-[10px] font-semibold text-[#C8A96B]">vs</span>
                  <Escudo url={escudoDe(partido)} nombre={nombreBonito(partido)} className="h-4 w-4 md:h-5 md:w-5" />
                  <span className="hidden min-w-0 truncate text-[11px] font-semibold text-white/85 md:inline">
                    {nombreBonito(partido)}
                  </span>
                </div>
              )}

              {/* 30/10/2026: una tarea sin minutos deja sólo su nombre (sin
                  barra vacía ni cifra), y la letra no baja de 11 px. */}
              {orderedBlocks.map(([name, minutes]) => (
                <div key={name} title={tituloConSiglas(name)}>
                  <div className="flex items-baseline justify-between gap-2">
                    <span className="truncate text-[11px] md:text-xs">{name}</span>

                    {minutes > 0 && (
                      <span className="shrink-0 text-[11px] text-white/55">
                        {minutes}&apos;
                      </span>
                    )}
                  </div>

                  {minutes > 0 && totalMinutes > 0 && (
                    <div className="mt-1">
                      <MetricBar
                        value={minutes}
                        max={totalMinutes}
                        className={theme.bar}
                      />
                    </div>
                  )}
                </div>
              ))}
            </>
          ),
        };
      }}
    >
      {error && !loading && (
        <div className="px-4 pb-6 md:px-8">
          <EstadoError titulo="No se ha podido cargar la hoja de microciclos" error={error} onReintentar={reintenta} />
        </div>
      )}

      {loading && lenta && (
        <div className="px-4 pb-6 md:px-8">
          <EstadoError
            titulo="La hoja de microciclos está tardando más de lo normal"
            error="Sigue cargando por detrás: si llega, se pinta sola. También puedes pedirla otra vez."
            onReintentar={reintenta}
          />
        </div>
      )}

      {/* 30/10/2026: cómo se lee el calendario —qué es el fondo del día, la
          lectura de la carga del mes y las siglas que salen este mes—. */}
      {!loading && monthStats.sesiones > 0 && (
        <div className="min-w-0 space-y-2 px-4 pb-6 text-[12px] text-white/60 md:px-8">
          <p>
            El fondo de cada día es el color de la fase con más minutos; las barras, el peso de cada contenido en los
            minutos de la sesión.
          </p>
          {lecturaCarga && <p>{lecturaCarga}</p>}
          {monthStats.siglas.size > 0 && (
            <p>
              {SIGLAS.filter((s) => monthStats.siglas.has(s.sigla)).map((s, i) => (
                <span key={s.sigla}>
                  {i ? " · " : ""}
                  <span className="font-semibold text-white/80">{s.sigla}</span>: {s.es}
                </span>
              ))}
            </p>
          )}
        </div>
      )}

      {selectedDate && (
        <CalendarDayModal
          date={selectedDate}
          size="lg"
          subtitle={
            [
              `${selectedTasks.length} ${
                selectedTasks.length === 1 ? "tarea" : "tareas"
              }`,
              formatMinutes(selectedSummary.minutos),
              selectedSummary.md,
              selectedSummary.micro && `Micro ${selectedSummary.micro}`,
              selectedSummary.rival && `vs ${selectedSummary.rival}`,
            ]
              .filter(Boolean)
              .join(" · ")
          }
          onClose={() => setSelectedKey(null)}
          onPrev={() => goToDay(selectedIndex - 1)}
          onNext={() => goToDay(selectedIndex + 1)}
          canPrev={selectedIndex > 0}
          canNext={selectedIndex >= 0 && selectedIndex < sessionDays.length - 1}
        >
          <div className="space-y-4">
            {selectedTasks.length === 0 && (
              <CalendarEmptyState>
                No hay tareas registradas este día.
              </CalendarEmptyState>
            )}

            {Object.entries(grouped).map(([bloque, tareas]) => {
              const bloqueMinutos = tareas.reduce((s, t) => s + minutesOf(t), 0);

              return (
                <div
                  key={bloque}
                  className="rounded-xl border border-white/10 bg-[#10151C] p-4"
                >
                  <div className="mb-3 flex items-baseline justify-between gap-3">
                    <h3 className="font-semibold text-[#C8A96B]">{bloque}</h3>

                    <span className="shrink-0 text-xs text-white/45">
                      {bloqueMinutos > 0 && <>{formatMinutes(bloqueMinutos)} · </>}
                      {tareas.length}{" "}
                      {tareas.length === 1 ? "tarea" : "tareas"}
                    </span>
                  </div>

                  <div className="space-y-2">
                    {tareas.map((t, i) => {
                      const theme = phaseTheme(t.Fase);

                      return (
                        <div
                          key={`${t.Tarea}-${t["Contenido Secundario"]}-${t.Tiempo}-${i}`}
                          className="rounded-2xl border border-white/10 bg-[#141B24] p-4 transition-all hover:border-[#C8A96B]/40"
                        >
                          <div className="mb-3 flex flex-wrap items-center gap-2">
                            {t.Fase && (
                              <span
                                className={cn(
                                  "inline-flex items-center rounded-full px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.15em]",
                                  theme.chip
                                )}
                              >
                                {t.Fase}
                              </span>
                            )}

                            {t.Formato && (
                              <span className="rounded-full border border-white/10 bg-[#10151C] px-3 py-1 text-[11px] text-white/60">
                                {t.Formato}
                              </span>
                            )}

                            {t.Espacio && (
                              <span className="rounded-full border border-white/10 bg-[#10151C] px-3 py-1 text-[11px] text-white/60">
                                {t.Espacio}
                              </span>
                            )}
                          </div>

                          <h4 className="text-base font-semibold text-white">
                            {t["Contenido Principal"]}
                          </h4>

                          {t["Contenido Secundario"] && (
                            <p className="mt-1 text-sm text-white/60">
                              {t["Contenido Secundario"]}
                            </p>
                          )}

                          {t.Tarea && (
                            <p className="mt-2 text-sm text-white/75">{t.Tarea}</p>
                          )}

                          <div className="mt-4 mb-5 flex flex-wrap gap-2">
                            {minutesOf(t) > 0 && (
                              <Pill icon={<Clock3 size={15} />}>
                                {minutesOf(t)}&apos;
                              </Pill>
                            )}

                            {t.Grupo && <Pill>{t.Grupo}</Pill>}

                            {Number(t["Nº Jugadores"]) > 0 && (
                              <Pill>{t["Nº Jugadores"]} jug.</Pill>
                            )}
                          </div>

                          {/* Sin carga apuntada (tarea sin minutos) no se pinta una barra a cero. */}
                          {Number(t["Carga Ponderada"]) > 0 && (
                            <Metric
                              icon={<Dumbbell size={16} className="text-[#C8A96B]" />}
                              label="Carga física"
                              value={Math.round(Number(t["Carga Ponderada"]))}
                              max={selectedSummary.maxCarga}
                            />
                          )}

                          {Number(t["Carga cognitiva"]) > 0 && (
                            <div className="mt-4">
                              <Metric
                                icon={<Brain size={16} className="text-[#C8A96B]" />}
                                label="Carga cognitiva"
                                value={Math.round(Number(t["Carga cognitiva"]))}
                                max={selectedSummary.maxCognitiva}
                              />
                            </div>
                          )}

                          {t.Observaciones && (
                            <p className="mt-4 rounded-xl border border-white/5 bg-[#10151C] px-3 py-2 text-xs text-white/55">
                              {t.Observaciones}
                            </p>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>
              );
            })}
          </div>
        </CalendarDayModal>
      )}
    </CalendarShell>
  );
}

function Pill({
  icon,
  children,
}: {
  icon?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <div className="flex items-center gap-2 rounded-full border border-white/10 bg-[#10151C] px-3 py-2 text-sm font-medium">
      {icon && <span className="text-[#C8A96B]">{icon}</span>}
      {children}
    </div>
  );
}

function Metric({
  icon,
  label,
  value,
  max,
}: {
  icon: React.ReactNode;
  label: string;
  value: number;
  /** La barra llena: la tarea más cargada del día. */
  max: number;
}) {
  return (
    <div>
      <div className="mb-2 flex items-center justify-between">
        <div className="flex items-center gap-2">
          {icon}
          <span className="text-sm">{label}</span>
        </div>

        <span className="text-sm font-semibold">{value}</span>
      </div>

      <MetricBar value={value} max={max} />
    </div>
  );
}
