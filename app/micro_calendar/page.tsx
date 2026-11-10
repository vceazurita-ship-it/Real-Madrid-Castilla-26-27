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
import { cuentaDias, esFilaDePartido, mdDeLaFecha, textoEntrenosYPartidos } from "@/lib/microciclo/cuenta";
import { useCalendario } from "@/hooks/useCalendario";
import { comoNuestro, horaDelCalendarioLocal, soloDia } from "@/lib/castilla/calendario";

/** Nombre con el que sale el Castilla en la lista de escudos de BeSoccer. */
const NOSOTROS = "RM Castilla";

/**
 * ¿Es día de partido? La hoja lo marca con «MD» y una tarea de competición.
 * Se mira el MD y no sólo la tarea porque un MD-2 puede llevar un «partido
 * reducido» apuntado como competición.
 */
function esDiaDePartido(tareas: MicrocycleRecord[]) {
  return tareas.some((t) => esFilaDePartido(filaDeCuenta(t)));
}

/** Una fila de la hoja en la forma de lib/microciclo/cuenta.ts. */
function filaDeCuenta(t: MicrocycleRecord) {
  return { md: String(t.MD ?? ""), fase: t.Fase, tipo: t["Tipo Tarea"], contenidoPrincipal: t["Contenido Principal"] };
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
  | EL PARTIDO, CON HORA, LADO Y RESULTADO (07/11/2026). La hoja sólo dice
  | «MD vs Gimnàstic · Competición»: la hora, si es en casa o fuera y el
  | marcador salen del calendario de BeSoccer, el mismo del Calendario
  | Operativo. Lo que BeSoccer no tiene no se escribe.
  */
  const { partidos: calendarioBesoccer } = useCalendario();

  const partidoDelDia = useMemo(() => {
    const mapa = new Map<string, ReturnType<typeof comoNuestro>>();

    for (const p of calendarioBesoccer) {
      if (typeof p?.cuando !== "string") continue;
      mapa.set(soloDia(p.cuando), comoNuestro(p));
    }

    return mapa;
  }, [calendarioBesoccer]);

  /** «16:00 · en casa · 2-1» — sólo las piezas que hay. */
  const lineaPartido = (key: string) => {
    const p = partidoDelDia.get(key);
    if (!p) return "";
    const hora = horaDelCalendarioLocal(p.cuando);
    const marcador = p.jugado && p.golesFavor !== null && p.golesContra !== null ? `${p.golesFavor}-${p.golesContra}` : "";

    return [hora, p.lado === "casa" ? "en casa" : "fuera", marcador].filter(Boolean).join(" · ");
  };

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

  /*
  | LA MISMA CUENTA QUE EL CALENDARIO OPERATIVO (07/11/2026). «7 sesiones»
  | contaba los dos partidos y /calendar_general decía 5: ahora son «5 entrenos
  | + 2 partidos» en las dos (lib/microciclo/cuenta.ts). Las medias de carga son
  | por día de entreno, sin la fila del partido.
  |
  | Y se compara con los MISMOS DÍAS del mes anterior: un mes a medias contra
  | uno entero no dice nada. `hastaDia` corta el mes anterior en el último día
  | que tiene registros el mes que se mira.
  */
  const statsDelMes = useCallback(
    (month: number, year: number, hastaDia = 31) => {
      let minutos = 0;
      let carga = 0;
      let cognitiva = 0;
      let tareas = 0;
      let ultimoDia = 0;
      /* 10/11/2026: los días de entreno con carga apuntada. Los planificados
         (sin minutos todavía) no bajan la media ni alargan la ventana. */
      let hechos = 0;
      const siglas = new Set<string>();
      const porMd = new Map<string, { carga: number; dias: number }>();
      const dentro = new Map<string, { md?: string; fase?: string; tipo?: string; contenidoPrincipal?: string }[]>();

      sessionDays.forEach((key) => {
        const date = parseDateKey(key);
        if (date.getMonth() !== month || date.getFullYear() !== year || date.getDate() > hastaDia) return;

        const dayTasks = tasksByDay.get(key) ?? [];
        const filas = dayTasks.map(filaDeCuenta);

        dentro.set(key, filas);
        const entreno = dayTasks.filter((t, i) => !esFilaDePartido(filas[i]));

        tareas += entreno.length;

        dayTasks.forEach((t) => {
          const rotulo = `${t["Contenido Principal"] || t["Tipo Tarea"] || ""}`;
          siglasDe(rotulo).forEach((s) => siglas.add(s.sigla));
        });

        let cargaDia = 0;

        entreno.forEach((t) => {
          minutos += minutesOf(t);
          cargaDia += Number(t["Carga Ponderada"]) || 0;
          cognitiva += Number(t["Carga cognitiva"]) || 0;
        });

        carga += cargaDia;

        /* La ventana de comparación acaba en el último entreno HECHO (con carga),
           no en un partido ni en un día sólo planificado (10/11/2026). */
        const conCarga = cargaDia > 0 || entreno.some((t) => minutesOf(t) > 0);
        if (entreno.length > 0 && conCarga) {
          hechos += 1;
          ultimoDia = Math.max(ultimoDia, date.getDate());
        }

        const md = String(entreno[0]?.MD ?? "").trim().toUpperCase().replace(/\s+/g, "");

        if (md && cargaDia > 0) {
          const uno = porMd.get(md) ?? { carga: 0, dias: 0 };

          uno.carga += cargaDia;
          uno.dias += 1;
          porMd.set(md, uno);
        }
      });

      const { entrenos, partidos } = cuentaDias(dentro, () => true);

      return {
        sesiones: entrenos,
        hechos,
        planificados: Math.max(0, entrenos - hechos),
        tareas,
        partidos,
        siglas,
        minutos,
        ultimoDia,
        porMd,
        cargaMedia: hechos > 0 ? Math.round(carga / hechos) : 0,
        cognitivaMedia: hechos > 0 ? Math.round(cognitiva / hechos) : 0,
      };
    },
    [sessionDays, tasksByDay]
  );

  const monthStats = useMemo(
    () => statsDelMes(active.month, active.year),
    [statsDelMes, active]
  );

  /* El mes anterior, en los mismos días (del 1 al último con registros de este mes). */
  const mesPrevio = useMemo(() => {
    const month = active.month === 0 ? 11 : active.month - 1;
    const year = active.month === 0 ? active.year - 1 : active.year;
    const hasta = monthStats.ultimoDia || 31;
    const diasDelPrevio = new Date(year, month + 1, 0).getDate();
    const completo = hasta >= diasDelPrevio;

    return { month, completo, hasta, stats: statsDelMes(month, year, hasta) };
  }, [statsDelMes, active, monthStats.ultimoDia]);

  /** «octubre» o «el 1 al 8 de octubre»: contra qué días se compara. */
  const nombrePrevio = mesPrevio.completo
    ? MONTHS[mesPrevio.month].toLowerCase()
    : `los mismos días de ${MONTHS[mesPrevio.month].toLowerCase()} (del 1 al ${mesPrevio.hasta})`;

  /** «+12 % sobre septiembre»; vacío si el mes anterior no tuvo sesiones. */
  const frente = (actual: number, previo: number) => {
    if (mesPrevio.stats.sesiones === 0 || previo <= 0) return "";
    const pct = Math.round(((actual - previo) / previo) * 100);
    if (pct === 0) return ` · igual que en ${nombrePrevio}`;
    return ` · ${pct > 0 ? "+" : "−"}${Math.abs(pct)} % sobre ${nombrePrevio}`;
  };

  /** «5 entrenos hechos»: la base de las medias de carga (sólo los días con carga). */
  const baseDelMes = `${monthStats.hechos} ${monthStats.hechos === 1 ? "entreno hecho" : "entrenos hechos"}`;
  /** «5 entrenos hechos + 3 planificados + 2 partidos»: lo que hay en el mes. */
  const cuentaDelMes = [
    monthStats.planificados > 0 ? baseDelMes : textoEntrenosYPartidos(monthStats.sesiones, 0),
    monthStats.planificados > 0 ? `${monthStats.planificados} ${monthStats.planificados === 1 ? "planificado" : "planificados"}` : "",
    monthStats.partidos ? textoEntrenosYPartidos(0, monthStats.partidos) : "",
  ]
    .filter(Boolean)
    .join(" + ");

  /*
  | «Más carga no es mejor» (30/10/2026): si cambia mucho contra el mes
  | anterior y hay otro número de partidos, se dice por qué puede ser.
  | 07/11/2026: dice de qué días sale la comparación y acaba en una orden —qué
  | MD subir o bajar la semana que viene—, sacada del MD que más se ha movido.
  */
  const lecturaCarga = (() => {
    const previo = mesPrevio.stats;
    if (previo.hechos === 0 || previo.cargaMedia <= 0 || monthStats.hechos === 0) return "";
    const pct = Math.round(((monthStats.cargaMedia - previo.cargaMedia) / previo.cargaMedia) * 100);
    if (Math.abs(pct) < 5) return "";
    const base = `${monthStats.cargaMedia} por entreno frente a ${previo.cargaMedia} en ${nombrePrevio}`;

    /* El MD que más se mueve, con su media por día. */
    const cambios = [...monthStats.porMd.entries()]
      .map(([md, a]) => {
        const b = previo.porMd.get(md);
        if (!b || b.carga <= 0) return null;
        const mediaA = a.carga / a.dias;
        const mediaB = b.carga / b.dias;
        return { md, mediaA, mediaB, pct: Math.round(((mediaA - mediaB) / mediaB) * 100) };
      })
      .filter((c): c is { md: string; mediaA: number; mediaB: number; pct: number } => c !== null && Math.abs(c.pct) >= 10)
      .sort((x, y) => Math.abs(y.pct) - Math.abs(x.pct));
    const mueve = cambios[0];
    /* 10/11/2026: cada cifra con su base («310 en 1 MD-4 de noviembre frente a
       222 de media en 3 MD-4 de octubre»). Con menos de 3 sesiones de ese MD
       en cualquiera de los dos lados es una tendencia: se dice, sin orden. */
    const enDias = (n: number, md: string, mes: string) => `${n} ${md} de ${mes}`;
    const mesActual = MONTHS[active.month].toLowerCase();
    const mesAntes = MONTHS[mesPrevio.month].toLowerCase();
    const cifras = mueve
      ? `${Math.round(mueve.mediaA)}${monthStats.porMd.get(mueve.md)!.dias > 1 ? " de media" : ""} en ${enDias(monthStats.porMd.get(mueve.md)!.dias, mueve.md, mesActual)} frente a ${Math.round(mueve.mediaB)}${previo.porMd.get(mueve.md)!.dias > 1 ? " de media" : ""} en ${enDias(previo.porMd.get(mueve.md)!.dias, mueve.md, mesAntes)} (${mueve.pct > 0 ? "+" : "−"}${Math.abs(mueve.pct)} %)`
      : "";
    const pocas = mueve ? Math.min(monthStats.porMd.get(mueve.md)!.dias, previo.porMd.get(mueve.md)!.dias) < 3 : false;
    const orden = !mueve
      ? ""
      : pocas
        ? ` Tendencia en el ${mueve.md}, con pocas sesiones para mover nada: ${cifras}.`
        : ` La semana que viene, ${mueve.pct < 0 ? "subir" : "bajar"} el ${mueve.md} si no se busca ese cambio: ${cifras}.`;

    if (pct < 0 && monthStats.partidos > previo.partidos) {
      return `La carga media baja un ${Math.abs(pct)} % (${base}) con más partidos (${monthStats.partidos} frente a ${previo.partidos}): es la descarga de las semanas de competición.${orden}`;
    }
    if (pct > 0 && monthStats.partidos < previo.partidos) {
      return `La carga media sube un ${pct} % (${base}) con menos partidos (${monthStats.partidos} frente a ${previo.partidos}): hay más días de carga entre partidos.${orden}`;
    }
    return pct < 0
      ? `La carga media baja un ${Math.abs(pct)} % (${base}) con los mismos partidos.${orden || " Si no es una descarga buscada, subir la carga del día más cargado de la semana que viene."}`
      : `La carga media sube un ${pct} % (${base}).${orden || " Vigilar la recuperación en los MD-1 y MD+1 de la semana que viene."}`;
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
      md: selectedTasks.map((t) => String(t.MD ?? "").trim()).find(Boolean) ?? "",
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
          ? `${cuentaDelMes}${monthStats.minutos > 0 ? ` y ${formatMinutes(monthStats.minutos)} de entreno` : ""} en ${MONTHS[active.month].toLowerCase()}`
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
            label="Entrenos"
            value={monthStats.sesiones}
            hint={`${monthStats.planificados > 0 ? `${monthStats.hechos} hechos y ${monthStats.planificados} planificados · ` : ""}${monthStats.partidos ? `+ ${monthStats.partidos} ${monthStats.partidos === 1 ? "partido" : "partidos"} · ` : ""}${monthStats.tareas} tareas de entreno en ${MONTHS[active.month].toLowerCase()}`}
          />
          <CalendarStat
            label="Volumen"
            value={formatMinutes(monthStats.minutos)}
            hint={`de entreno en ${MONTHS[active.month].toLowerCase()}, sin los partidos`}
          />
          {/* Las dos cargas son puntos sin unidad: se dice de qué salen
              (19/10/2026), si no un 420 no le dice nada a nadie. 30/10/2026:
              y sobre cuántas sesiones y partidos, porque un mes con más
              partidos baja la media a propósito (bajar no es peor). */}
          <CalendarStat
            label="Carga física media / entreno"
            value={monthStats.cargaMedia}
            hint={`Minutos × intensidad por día de entreno, sobre ${baseDelMes}${frente(monthStats.cargaMedia, mesPrevio.stats.cargaMedia)}`}
          />
          <CalendarStat
            label="Carga cognitiva media / entreno"
            value={monthStats.cognitivaMedia}
            hint={`Minutos × demanda cognitiva por día de entreno, sobre ${baseDelMes}${frente(monthStats.cognitivaMedia, mesPrevio.stats.cognitivaMedia)}`}
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
        /* 07/11/2026: el MD de cualquier tarea del día; sin ninguno, «fuera de micro» (nada de casilla sin etiqueta). */
        const mdHoja = dayTasks.map((t) => String(t.MD ?? "").trim()).find(Boolean) ?? "";
        /* Sin MD en la hoja, el del próximo partido del calendario (misma regla que /calendar_general). */
        const md = mdHoja || (esDiaDePartido(dayTasks) ? "" : mdDeLaFecha(key, partidoDelDia.keys()));

        const partido = esDiaDePartido(dayTasks) ? String(dayTasks[0]?.Rival ?? "").trim() : "";
        const detallePartido = partido ? lineaPartido(key) : "";

        return {
          hasContent: true,
          accentClass: theme.cell,
          onClick: () => setSelectedKey(key),
          badges: (
            <div className="flex items-center gap-1">
              {md ? (
                <span
                  className="whitespace-nowrap rounded-full px-1.5 py-0.5 text-[10px] font-semibold uppercase"
                  style={{ background: "#1F2937", color: "#FFFFFF" }}
                >
                  {md}
                </span>
              ) : (
                <span
                  className="whitespace-nowrap rounded-full border border-white/15 px-1.5 py-0.5 text-[10px] font-semibold text-white/60"
                  title="Sesión apuntada sin MD en la hoja: no entra en ningún microciclo"
                >
                  fuera de micro
                </span>
              )}

              {/* Mismo formato con o sin minutos; el total del mes sólo suma los que los tienen. */}
              {/* 29/10/2026: sin minutos no sale ni píldora ni «sin tiempo»: lo que no hay no se nombra. */}
              {totalMinutes > 0 && (
                <span className="rounded-full border border-[#C8A96B]/30 bg-[#C8A96B]/10 px-2 py-0.5 text-[10px] font-semibold text-[#C8A96B]">
                  {formatMinutes(totalMinutes)}
                </span>
              )}
              {/* 10/11/2026: un entreno que aún no tiene minutos en la hoja es
                  un día planificado; se dice, para que el mes se lea igual de
                  principio a fin (la hoja no guarda minutos previstos). */}
              {totalMinutes === 0 && !esDiaDePartido(dayTasks) && (
                <span
                  className="whitespace-nowrap rounded-full border border-white/15 px-1.5 py-0.5 text-[10px] font-semibold text-white/60"
                  title="Entreno planificado: la hoja aún no tiene sus minutos ni su intensidad"
                >
                  planificado
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
                  <span className="min-w-0 truncate text-[10px] font-semibold text-white/85 md:text-[11px]">
                    {nombreBonito(partido)}
                  </span>
                </div>
              )}
              {detallePartido && (
                <p className="truncate text-[10px] font-semibold text-[#C8A96B] md:text-[11px]" title={detallePartido}>
                  {detallePartido}
                </p>
              )}

              {/* 30/10/2026: una tarea sin minutos deja sólo su nombre (sin
                  barra vacía ni cifra), y la letra no baja de 11 px. */}
              {orderedBlocks.map(([name, minutes]) => (
                <div key={name} title={tituloConSiglas(name)}>
                  <div className="flex items-baseline justify-between gap-2">
                    {/* 10/11/2026: dos líneas antes de cortar; el nombre entero va en el title. */}
                    <span className="line-clamp-2 min-w-0 break-words text-[11px] leading-tight md:text-xs">{name}</span>

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
            Fondo del día = fase con más minutos · barra = minutos de ese contenido sobre los de la sesión.
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
              selectedSummary.md || "fuera de micro",
              selectedSummary.micro && `Micro ${selectedSummary.micro}`,
              selectedSummary.rival && `vs ${selectedSummary.rival}`,
              esDiaDePartido(selectedTasks) && selectedKey ? lineaPartido(selectedKey) : "",
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
