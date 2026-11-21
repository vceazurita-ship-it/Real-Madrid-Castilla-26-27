"use client";
import { traeJson } from "@/lib/hojaCsv";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { AlertTriangle, Brain, CalendarDays, ClipboardCheck, Clock3, Dumbbell, FileText, Users } from "lucide-react";
import { EnlacesDelRival, enlacesDelRival, useJornadasRivales } from "@/components/rivals/EnlacesDelRival";
import { BotonGolesEnVideo } from "@/components/rivals/BotonGolesEnVideo";
import { enlaceAnalisis, enlaceSesion } from "@/lib/sesion-dia/conexion";
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
import { cuentaDias, esFilaDePartido, fechaIsoDeHoja } from "@/lib/microciclo/cuenta";
import { diasPlanificados, mdALaVista, mdDelCalendario } from "@/lib/microciclo/semana-de-hoy";
import { contenidoUnificado } from "@/lib/microciclo/contenidos";
import { estadoDelDia } from "@/lib/sesion-dia/estado-dia";
import { useDiasConectados } from "@/hooks/useDiasConectados";
import { nombreCorto } from "@/lib/abp/informe-graficos";
import { useCalendario } from "@/hooks/useCalendario";
import { useSemanaDeHoy } from "@/hooks/useSemanaDeHoy";
import { comoNuestro, horaDelCalendarioLocal, soloDia } from "@/lib/castilla/calendario";

/** Nombre con el que sale el Castilla en la lista de escudos de BeSoccer. */
const NOSOTROS = "RM Castilla";
/** Sin fechas: de useDiasConectados sólo se quieren los equipos (el almacén entero). */
const SIN_FECHAS: string[] = [];

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

  /** Sólo planificada: viene de la hoja publicada y aún no está en la copia de lo hecho (16/11/2026). */
  _plan?: boolean;
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

/*
| EL FONDO DEL DÍA (11/11/2026). Casi todas las sesiones tienen más minutos
| de «Global» que de nada, y el fondo salía amarillo todos los días: no
| distinguía nada. Ahora es la fase con más minutos SIN contar Global; el día
| que sólo tiene Global (o nada) se queda con el fondo normal. La leyenda,
| sólo con las fases que colorean algún día del mes.
*/
function faseDelDia(tareas: { Fase?: string; Tiempo?: number | string }[]): PhaseTheme | null {
  const minutos = new Map<PhaseTheme, number>();

  tareas.forEach((t) => {
    const tema = phaseTheme(t.Fase ?? "");
    if (tema === NEUTRAL_THEME || tema === PHASE_THEMES.GLOBAL) return;
    minutos.set(tema, (minutos.get(tema) ?? 0) + (Number(t.Tiempo) || 0));
  });

  return [...minutos.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] ?? null;
}

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
  /* 16/11/2026: «Ritmo de juego, finalización y TAD» salía sin explicar. */
  { re: /\bTAD\b/, sigla: "TAD", es: "transición ataque-defensa (tras pérdida)" },
  { re: /\bTDA\b/, sigla: "TDA", es: "transición defensa-ataque (tras robo)" },
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

  /*
  | «?fecha=AAAA-MM-DD» (17/11/2026, r20, jueces): el análisis de entrenamiento
  | abre aquí la sesión de su tarea con el día ya elegido. Se lee tras montar.
  */
  useEffect(() => {
    const id = setTimeout(() => {
      const f = new URLSearchParams(window.location.search).get("fecha");

      if (!f || !/^\d{4}-\d{2}-\d{2}$/.test(f)) return;

      const [a, mes] = f.split("-").map(Number);
      const idx = months.findIndex((x) => x.month === mes - 1 && x.year === a);

      if (idx !== -1) setCurrentMonth(idx);
      setSelectedKey(f);
    }, 0);

    return () => clearTimeout(id);
  }, [months]);

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

  /*
  | 16/11/2026 (jueces): los enlaces también DENTRO de la casilla, no sólo en
  | el día abierto. El partido jugado lleva a su micro en Microciclos (donde
  | está «Informe del partido»); el que falta, a su Plan de partido con el
  | rival ya elegido. Pulsarlos no abre el día (stopPropagation).
  */
  const jornadasRivales = useJornadasRivales();
  const enlaceDelPartido = (key: string, rival: string, micro?: string) => {
    const p = partidoDelDia.get(key);
    const n = Number(micro);

    if (p?.jugado) return { href: Number.isInteger(n) && n > 0 ? `/microcycles?micro=${n}` : "/microcycles", texto: "Informe del partido" };

    return { href: enlacesDelRival(jornadasRivales, nombreBonito(rival), key)[0]?.href ?? "/match-preparation", texto: "Plan de partido" };
  };
  const sinAbrirElDia = (e: { stopPropagation: () => void }) => e.stopPropagation();

  /** «16:00 · en casa · 2-1» — sólo las piezas que hay. */
  const lineaPartido = (key: string) => {
    const p = partidoDelDia.get(key);
    if (!p) return "";
    const hora = horaDelCalendarioLocal(p.cuando);
    /* 16/11/2026: el resultado con su sentido («ganado 1-0», el Castilla primero). */
    const marcador =
      p.jugado && p.golesFavor !== null && p.golesContra !== null
        ? `${p.golesFavor > p.golesContra ? "ganado" : p.golesFavor < p.golesContra ? "perdido" : "empate"} ${p.golesFavor}-${p.golesContra}`
        : "";

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

  /*
  | LO PLANIFICADO TAMBIÉN SE PINTA (16/11/2026). La copia de la hoja que llega
  | por el Apps Script sólo trae lo ya hecho, y la semana del micro 22 (13
  | tareas del 16 al 19/11) salía vacía mientras /microcycles la enseñaba. Los
  | días que esa copia no tiene se completan con la hoja publicada, la fuente
  | común de las cuatro pantallas (hooks/useSemanaDeHoy.ts), y se dibujan con
  | borde discontinuo y «planificado».
  */
  const { registro, fechasDePartido: fechasPartido, semana, hoy: hoyComun } = useSemanaDeHoy();
  /* 20/11/2026 (jueces): el estado de cada día con la regla de /microcycles (lib/sesion-dia/estado-dia.ts): con equipos, hecha; la tarea que no casa, no se hizo. */
  const { almacen: almacenEquipos } = useDiasConectados(SIN_FECHAS, { entreno: false });
  const estadoDe = useCallback((key: string, minutos: number, apuntada = false) => estadoDelDia(key, hoyComun || "", registro, almacenEquipos, minutos, apuntada), [hoyComun, registro, almacenEquipos]);

  /*
  | SÓLO LO HECHO SUMA (20/11/2026, ronda 7, fútbol). El 27/10 daba 43′ con la
  | tarea «no se hizo» dentro; /calendar_general daba 29′. Los minutos del día,
  | el VOLUMEN y las UA salen sólo de las tareas hechas, con la misma regla de
  | lib/sesion-dia/estado-dia.ts (la tarea del plan que no casa con los equipos
  | de Jugadores sesión no se hizo).
  */
  const hechasDe = useCallback(
    (key: string, tareas: MicrocycleRecord[]) => {
      const no = estadoDe(key, 0).noHechas;

      return no.size ? tareas.filter((t) => !no.has(String(t.Tarea ?? "").trim())) : tareas;
    },
    [estadoDe],
  );

  /** Tareas agrupadas por día. */
  const tasksByDay = useMemo(() => {
    const map = new Map<string, MicrocycleRecord[]>();

    microcycleData.forEach((crudo) => {
      const key = recordDateKey(crudo.Fecha);
      if (!key) return;

      /* 17/11/2026 (jueces): el mismo contenido con un solo nombre (lib/microciclo/contenidos.ts). */
      const task = { ...crudo, "Contenido Principal": contenidoUnificado(String(crudo["Contenido Principal"] ?? "")) };
      const list = map.get(key);
      if (list) list.push(task);
      else map.set(key, [task]);
    });

    diasPlanificados(registro, new Set(map.keys())).forEach((filas, key) => {
      map.set(
        key,
        filas.map((t) => ({
          Temporada: t.temporada,
          Micro: String(t.micro),
          Rival: t.rival,
          Día: t.dia,
          MD: t.md,
          Fecha: fechaIsoDeHoja(t.fecha),
          Tarea: t.tarea,
          "Tipo Tarea": t.tipoTarea,
          Formato: t.formato,
          "Nº Jugadores": t.jugadores,
          Grupo: t.grupo,
          Espacio: t.espacio ?? "",
          "Contenido Principal": contenidoUnificado(t.contenidoPrincipal),
          "Contenido Secundario": t.contenidoSecundario,
          Fase: t.fase,
          Tiempo: t.tiempo,
          "Intensidad (1-10)": t.intensidad,
          "Carga Ponderada": t.carga,
          "Demanda Cognitiva(1-10)": t.exigCog,
          "Carga cognitiva": t.cargaCog,
          Observaciones: t.observaciones,
          _plan: true,
        })),
      );
    });

    return map;
  }, [microcycleData, registro]);

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
      /* Entrenos con equipos hechos y sin minutos en la hoja todavía: hechos, aunque no entren en las medias de carga. */
      let hechosSinCarga = 0;
      const siglas = new Set<string>();
      const porMd = new Map<string, { carga: number; dias: number }>();
      const dentro = new Map<string, { md?: string; fase?: string; tipo?: string; contenidoPrincipal?: string }[]>();

      sessionDays.forEach((key) => {
        const date = parseDateKey(key);
        if (date.getMonth() !== month || date.getFullYear() !== year || date.getDate() > hastaDia) return;

        const dayTasks = tasksByDay.get(key) ?? [];
        const filas = dayTasks.map(filaDeCuenta);

        dentro.set(key, filas);
        const entrenoTodo = dayTasks.filter((t, i) => !esFilaDePartido(filas[i]));
        /* Ronda 7: lo que «no se hizo» no suma minutos ni carga. */
        const entreno = hechasDe(key, entrenoTodo);

        tareas += entrenoTodo.length;

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
        if (entrenoTodo.length > 0 && conCarga) {
          hechos += 1;
          ultimoDia = Math.max(ultimoDia, date.getDate());
        } else if (entrenoTodo.length > 0 && estadoDe(key, 0).hecha) {
          hechosSinCarga += 1;
        }

        const md = String(entrenoTodo[0]?.MD ?? "").trim().toUpperCase().replace(/\s+/g, "");

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
        planificados: Math.max(0, entrenos - hechos - hechosSinCarga),
        /** Los hechos para decirlo («6 hechos»), con o sin minutos; las medias van con `hechos`. */
        hechosVista: hechos + hechosSinCarga,
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
    [sessionDays, tasksByDay, estadoDe, hechasDe]
  );

  const monthStats = useMemo(
    () => statsDelMes(active.month, active.year),
    [statsDelMes, active]
  );

  /* Las fases que colorean algún día del mes que se mira (sin Global). */
  const leyendaMes = useMemo<CalendarLegendItem[]>(() => {
    const vistas = new Set<PhaseTheme>();

    sessionDays.forEach((key) => {
      const date = parseDateKey(key);
      if (date.getMonth() !== active.month || date.getFullYear() !== active.year) return;
      const tema = faseDelDia(tasksByDay.get(key) ?? []);
      if (tema) vistas.add(tema);
    });

    /* 16/11/2026: la base del color, en la propia leyenda y no sólo al pie. */
    const fases = Object.values(PHASE_THEMES)
      .filter((t) => vistas.has(t))
      .map((t) => ({ label: t.label, color: t.dot }));
    /* Segunda vuelta: la barra y el discontinuo también se explican aquí, encima del mes. */
    const extra = [
      { label: "Barra = minutos del contenido", color: "hidden" },
      { label: "MD-n = días hasta el partido · discontinuo = planificado, sin minutos", color: "hidden" },
    ];
    return fases.length ? [{ label: "Fase con más minutos (sin Global):", color: "hidden" }, ...fases, ...extra] : extra;
  }, [sessionDays, tasksByDay, active]);

  /*
  | LA CARGA DEL MES, PRIMERO EN BARRAS (17/11/2026, jueces): una barra por
  | entreno hecho del mes (UA = suma de la «Carga Ponderada» de sus tareas,
  | sin el partido), coloreada por su MD, con la marca de la media de ese MD en
  | la temporada (3 días o más). Lo visual antes que el calendario.
  */
  const cargaDias = useMemo(() => {
    const todos: { key: string; md: string; ua: number }[] = [];

    for (const key of sessionDays) {
      const tareas = tasksByDay.get(key) ?? [];
      const entreno = hechasDe(key, tareas.filter((t) => !esFilaDePartido(filaDeCuenta(t))));
      const ua = entreno.reduce((s, t) => s + (Number(t["Carga Ponderada"]) || 0), 0);

      if (ua <= 0) continue;

      /* 20/11/2026 (jueces): el MD del calendario, el mismo que la casilla (el 10/11 salía como MD-3 de la hoja y era MD+2). */
      todos.push({ key, md: (mdDelCalendario(key, fechasPartido) || String(entreno[0]?.MD ?? "")).trim().toUpperCase().replace(/\s+/g, ""), ua: Math.round(ua) });
    }

    const suma = new Map<string, { ua: number; n: number }>();

    for (const d of todos) {
      if (!d.md) continue;

      const s = suma.get(d.md) ?? { ua: 0, n: 0 };

      s.ua += d.ua;
      s.n += 1;
      suma.set(d.md, s);
    }

    const media = new Map([...suma.entries()].filter(([, s]) => s.n >= 3).map(([md, s]) => [md, Math.round(s.ua / s.n)]));
    const delMes = todos.filter((d) => {
      const f = parseDateKey(d.key);

      return f.getMonth() === active.month && f.getFullYear() === active.year;
    });

    return { delMes, media };
  }, [sessionDays, tasksByDay, active, fechasPartido, hechasDe]);

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

  /*
  | 11/11/2026: con menos de 3 entrenos hechos en uno de los dos lados no se
  | compara (una sesión contra otra no es una tendencia). Y la comparación
  | dice su base: «del 1 al 7 de octubre, 5 entrenos».
  */
  const MINIMO_PARA_COMPARAR = 3;
  const comparable = monthStats.hechos >= MINIMO_PARA_COMPARAR && mesPrevio.stats.hechos >= MINIMO_PARA_COMPARAR;
  const basePrevio = `${nombrePrevio}, ${mesPrevio.stats.hechos} ${mesPrevio.stats.hechos === 1 ? "entreno" : "entrenos"}`;

  /** «+12 % sobre septiembre»; vacío si no hay base para comparar. */
  const frente = (actual: number, previo: number) => {
    if (!comparable || previo <= 0) return "";
    const pct = Math.round(((actual - previo) / previo) * 100);
    if (pct === 0) return ` · igual que en ${basePrevio}`;
    return ` · ${pct > 0 ? "+" : "−"}${Math.abs(pct)} % sobre ${basePrevio}`;
  };

  /** «5 entrenos hechos»: la base de las medias de carga (sólo los días con carga). */
  const baseDelMes = `${monthStats.hechos} ${monthStats.hechos === 1 ? "entreno hecho" : "entrenos hechos"}`;

  /*
  | «Más carga no es mejor» (30/10/2026): si cambia mucho contra el mes
  | anterior y hay otro número de partidos, se dice por qué puede ser.
  | 07/11/2026: dice de qué días sale la comparación y acaba en una orden —qué
  | MD subir o bajar la semana que viene—, sacada del MD que más se ha movido.
  */
  /*
  | 16/11/2026: «MD+1 de la semana que viene» pasa a los días reales del micro
  | de hoy (la fuente común): su MD-1 y el día después de su partido.
  */
  const diasAVigilar = (() => {
    if (!semana) return "";
    const corto = (iso: string) =>
      new Date(`${iso}T12:00:00Z`).toLocaleDateString("es-ES", { weekday: "long", day: "numeric", month: "numeric", timeZone: "UTC" });
    const md1 = semana.dias.find((d) => d.md === "MD-1");
    const partido = semana.dias.find((d) => d.partido);
    const despues = partido ? new Date(Date.parse(`${partido.fecha}T12:00:00Z`) + 86_400_000).toISOString().slice(0, 10) : "";
    /*
    | Segunda vuelta (16/11/2026): la orden se ata a un dato. El MD-1 lleva la
    | carga media de los MD-1 ya hechos de la temporada (UA por día, como las
    | tarjetas); con menos de 3, no se cita.
    */
    /*
    | 20/11/2026 (ronda 7): cada día citado lleva la media de SU MD. Antes el
    | sábado (día después del partido) salía con la media de los MD-1, que ya
    | había pasado: dos bases mezcladas en una frase.
    */
    const mediaDe = (etiqueta: string, antesDe: string) => {
      let carga = 0;
      let dias = 0;
      tasksByDay.forEach((tareas, key) => {
        if (key >= antesDe) return;
        const entreno = hechasDe(key, tareas.filter((t) => !esFilaDePartido(filaDeCuenta(t))));
        const md = String(entreno[0]?.MD ?? "").trim().toUpperCase().replace(/\s+/g, "");
        const c = entreno.reduce((s, t) => s + (Number(t["Carga Ponderada"]) || 0), 0);
        if (md === etiqueta && c > 0) {
          carga += c;
          dias += 1;
        }
      });
      return dias >= 3 ? { ua: Math.round(carga / dias), dias } : null;
    };
    /* 20/11/2026 (fútbol, ronda 5): sólo los días que vienen; el 20/11 citaba aún el jueves 19 (MD-1). */
    const viene = (iso: string) => Boolean(iso) && Boolean(hoyComun) && iso > (hoyComun ?? "");
    const partes = [
      md1 && viene(md1.fecha) ? { fecha: md1.fecha, md: "MD-1" } : null,
      viene(despues) ? { fecha: despues, md: "MD+1" } : null,
    ]
      .filter((x): x is { fecha: string; md: string } => x !== null)
      .map((x) => {
        const m = mediaDe(x.md, x.fecha);
        return m ? `el ${corto(x.fecha)} (${x.md}) sin pasar de ${m.ua} UA, la media de ${m.dias} ${x.md} de la temporada` : "";
      })
      .filter(Boolean);
    return partes.length ? `del micro ${semana.etiqueta}: ${partes.join("; ")}` : "";
  })();

  const lecturaCarga = (() => {
    const previo = mesPrevio.stats;
    if (!comparable || previo.cargaMedia <= 0) return "";
    const pct = Math.round(((monthStats.cargaMedia - previo.cargaMedia) / previo.cargaMedia) * 100);
    if (Math.abs(pct) < 5) return "";
    const base = `${monthStats.cargaMedia} UA por entreno frente a ${previo.cargaMedia} en ${basePrevio}`;

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
    /* 11/11/2026: con menos de 3 sesiones de ese MD en cada mes no se dice nada del MD. */
    const orden = !mueve || pocas
      ? ""
      : ` La semana que viene, ${mueve.pct < 0 ? "subir" : "bajar"} el ${mueve.md} si no se busca ese cambio: ${cifras}.`;

    if (pct < 0 && monthStats.partidos > previo.partidos) {
      return `La carga media baja un ${Math.abs(pct)} % (${base}) con más partidos (${monthStats.partidos} frente a ${previo.partidos}): es la descarga de las semanas de competición.${orden}`;
    }
    if (pct > 0 && monthStats.partidos < previo.partidos) {
      return `La carga media sube un ${pct} % (${base}) con menos partidos (${monthStats.partidos} frente a ${previo.partidos}): hay más días de carga entre partidos.${orden}`;
    }
    return pct < 0
      ? `La carga media baja un ${Math.abs(pct)} % (${base}) con los mismos partidos.${orden || " Si no es una descarga buscada, subir la carga del día más cargado de la semana que viene."}`
      : `La carga media sube un ${pct} % (${base}).${orden || (diasAVigilar ? ` Vigilar la recuperación ${diasAVigilar}.` : "")}`;
  })();

  /*
  | LAS DOS CARGAS (16/11/2026): la física salía en el titular y en la lectura,
  | y la cognitiva —que bajaba un 25 %— sólo en su tarjeta. Ahora la lectura
  | dice las dos.
  */
  const lecturaCognitiva = (() => {
    const previo = mesPrevio.stats;
    if (!comparable || previo.cognitivaMedia <= 0 || monthStats.cognitivaMedia <= 0) return "";
    const pct = Math.round(((monthStats.cognitivaMedia - previo.cognitivaMedia) / previo.cognitivaMedia) * 100);
    if (Math.abs(pct) < 5) return "";
    return `La carga cognitiva media ${pct > 0 ? "sube" : "baja"} un ${Math.abs(pct)} % (${monthStats.cognitivaMedia} UA por entreno frente a ${previo.cognitivaMedia} en ${basePrevio}).`;
  })();

  /*
  | LA ORDEN Y SU PORQUÉ (20/11/2026, jueces). La alerta era un párrafo de
  | cinco líneas: arriba queda la frase que manda hacer algo (la última de la
  | lectura) y la explicación con sus cifras pasa al pie del gráfico.
  */
  const frasesCarga = lecturaCarga.split(/(?<=\.)\s+(?=[A-ZÁÉÍÓÚ])/).filter(Boolean);
  const ordenCarga = frasesCarga.length > 1 ? frasesCarga.slice(1).join(" ") : frasesCarga[0] ?? lecturaCognitiva;
  const porqueCarga = [frasesCarga.length > 1 ? frasesCarga[0] : "", ordenCarga === lecturaCognitiva ? "" : lecturaCognitiva].filter(Boolean).join(" ");

  /*
  | EL TITULAR CON EL DATO (11/11/2026). Antes repetía la tarjeta ENTRENOS
  | («5 entrenos hechos + 3 planificados + 2 partidos y 3h 47'…»). Ahora:
  | «Noviembre: 8 entrenos (5 hechos) · 3h 47' · carga +17 % frente a octubre».
  | La carga sólo sale si hay base para comparar (3 entrenos hechos por lado).
  */
  const titular = (() => {
    if (monthStats.sesiones === 0) return "Calendario de Microciclo";
    const pctDe = (a: number, b: number) => (comparable && b > 0 && a > 0 ? Math.round(((a - b) / b) * 100) : null);
    const pctCarga = pctDe(monthStats.cargaMedia, mesPrevio.stats.cargaMedia);
    const pctCog = pctDe(monthStats.cognitivaMedia, mesPrevio.stats.cognitivaMedia);
    const signo = (p: number) => (p === 0 ? "igual" : `${p > 0 ? "+" : "−"}${Math.abs(p)} %`);
    /*
    | Segunda vuelta (16/11/2026): titular corto con la idea («Noviembre: carga
    | física +19 %, cognitiva −25 %») y la base en la línea de debajo
    | (`subtitulo`). En el móvil el H1 ocupaba seis líneas.
    */
    /* 17/11/2026 (r20, jueces): la base en el propio titular y, con menos de 25
       entrenos por lado, marcado «tendencia». */
    /*
    | 20/11/2026 (ronda 7, fútbol y marketing): en el titular sólo la
    | conclusión («Noviembre: más carga física (+19 %) y menos cognitiva
    | (−25 %) que octubre»); la base (entrenos con minutos, días y
    | «tendencia») baja al subtítulo.
    */
    if (pctCarga !== null) {
      const mesAntes = MONTHS[mesPrevio.month].toLowerCase();
      const parte = (que: string, p: number) => (p === 0 ? `la misma carga ${que}` : `${p > 0 ? "más" : "menos"} carga ${que} (${signo(p)})`);
      const fisica = parte("física", pctCarga);
      const cognitiva = pctCog === null ? "" : pctCog === 0 ? " y la misma cognitiva" : ` y ${pctCog > 0 ? "más" : "menos"} cognitiva (${signo(pctCog)})`;

      return `${MONTHS[active.month]}: ${fisica}${cognitiva} que ${mesAntes}`;
    }
    return [
      `${MONTHS[active.month]}: ${monthStats.sesiones} ${monthStats.sesiones === 1 ? "entreno" : "entrenos"}`,
      monthStats.minutos > 0 ? formatMinutes(monthStats.minutos) : "",
    ]
      .filter(Boolean)
      .join(" · ");
  })();

  /** La base del titular: entrenos, volumen y, si se compara, contra qué días (los mismos de cada mes). */
  const subtitulo = (() => {
    if (monthStats.sesiones === 0) return "";
    const mesAntes = MONTHS[mesPrevio.month].toLowerCase();
    const mesAhora = MONTHS[active.month].toLowerCase();
    const entrenos = `${monthStats.sesiones} ${monthStats.sesiones === 1 ? "entreno" : "entrenos"}${monthStats.planificados > 0 ? ` (${monthStats.hechosVista} ${monthStats.hechosVista === 1 ? "hecho" : "hechos"}, ${monthStats.planificados} ${monthStats.planificados === 1 ? "planificado" : "planificados"})` : ""}`;
    const volumen = monthStats.minutos > 0 ? `${formatMinutes(monthStats.minutos)} de entreno` : "";
    /* Ronda 7: la base que salía en el titular («8 entrenos con minutos frente a 6, días 1-12 · tendencia»). */
    const nMin = Math.min(monthStats.hechos, mesPrevio.stats.hechos);
    const base =
      comparable && mesPrevio.stats.cargaMedia > 0 && monthStats.cargaMedia > 0
        ? `${monthStats.hechos} ${monthStats.hechos === 1 ? "entreno" : "entrenos"} con minutos frente a ${mesPrevio.stats.hechos}${
            mesPrevio.completo ? ` en ${mesAntes}` : `, días 1-${mesPrevio.hasta} de ${mesAhora} y ${mesAntes}`
          }${nMin < 25 ? " · tendencia" : ""}`
        : "";
    return [entrenos, volumen, base].filter(Boolean).join(" · ");
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
    /* Ronda 7: los minutos del día, sólo de lo hecho; lo que «no se hizo» se marca en su tarjeta. */
    const noHechasDia = selectedKey ? estadoDe(selectedKey, 0).noHechas : new Set<string>();
    const minutos = (selectedKey ? hechasDe(selectedKey, selectedTasks) : selectedTasks).reduce((s, t) => s + minutesOf(t), 0);
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
      noHechasDia,
      micro: head?.Micro ?? "",
      md: selectedTasks.map((t) => String(t.MD ?? "").trim()).find(Boolean) ?? "",
      rival: head?.Rival ?? "",
    };
  }, [selectedTasks, selectedKey, estadoDe, hechasDe]);

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
      title={titular}
      subtitle={subtitulo}
      months={months}
      monthIndex={currentMonth}
      onMonthChange={setCurrentMonth}
      loading={loading}
      keyboardEnabled={!selectedKey}
      legend={leyendaMes}
      /*
      | 17/11/2026 (jueces): la decisión de la semana (la lectura de la carga)
      | sube a una tarjeta de aviso bajo el titular, y la carga del mes va en
      | barras antes que el calendario. Lo que no hay no se pinta.
      */
      franja={
        lecturaCarga || lecturaCognitiva || cargaDias.delMes.length >= 2 ? (
          <div className="space-y-3">
            {/* 20/11/2026 (jueces): arriba, una frase de orden; el porqué, al pie del gráfico. */}
            {ordenCarga ? (
              <p className="flex items-start gap-2 rounded-2xl border border-amber-400/35 bg-amber-400/[0.07] px-4 py-3 text-[14px] leading-snug text-white/85">
                <AlertTriangle size={16} className="mt-0.5 shrink-0 text-amber-300" aria-hidden />
                <span>{ordenCarga}{cargaDias.delMes.length < 2 && porqueCarga ? ` ${porqueCarga}` : ""}</span>
              </p>
            ) : null}
            {cargaDias.delMes.length >= 2 ? (
              <BarrasCargaMes
                dias={cargaDias.delMes}
                media={cargaDias.media}
                mes={MONTHS[active.month].toLowerCase()}
                comparacion={
                  comparable && mesPrevio.stats.cargaMedia > 0 && monthStats.cargaMedia > 0
                    ? { antes: mesPrevio.stats.cargaMedia, ahora: monthStats.cargaMedia, mesAntes: MONTHS[mesPrevio.month].toLowerCase(), base: mesPrevio.completo ? "" : `1-${mesPrevio.hasta}`, nAntes: mesPrevio.stats.hechos, nAhora: monthStats.hechos }
                    : null
                }
                pie={porqueCarga}
                onElige={setSelectedKey}
              />
            ) : null}
          </div>
        ) : undefined
      }
      stats={
        <>
          <CalendarStat
            label="Entrenos"
            value={monthStats.sesiones}
            hint={`${monthStats.planificados > 0 ? `${monthStats.hechosVista} ${monthStats.hechosVista === 1 ? "hecho" : "hechos"} y ${monthStats.planificados} ${monthStats.planificados === 1 ? "planificado" : "planificados"} · ` : ""}${monthStats.partidos ? `+ ${monthStats.partidos} ${monthStats.partidos === 1 ? "partido" : "partidos"} · ` : ""}${monthStats.tareas} tareas de entreno en ${MONTHS[active.month].toLowerCase()}`}
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
            value={<>{monthStats.cargaMedia} <span className="text-sm font-medium text-white/55">UA</span></>}
            hint={`UA = minutos × intensidad (1-10) · media de ${baseDelMes}${frente(monthStats.cargaMedia, mesPrevio.stats.cargaMedia)}`}
          />
          <CalendarStat
            label="Carga cognitiva media / entreno"
            value={<>{monthStats.cognitivaMedia} <span className="text-sm font-medium text-white/55">UA</span></>}
            hint={`UA = minutos × demanda cognitiva (1-10) · media de ${baseDelMes}${frente(monthStats.cognitivaMedia, mesPrevio.stats.cognitivaMedia)}`}
          />
        </>
      }
      renderDay={({ key }) => {
        const dayTasks = tasksByDay.get(key) ?? [];
        /* 11/11/2026: entre la primera y la última sesión apuntada, el día sin
           nada es libre y se dice con una palabra, como en /calendar_general. */
        if (dayTasks.length === 0) {
          /*
          | 16/11/2026 (jueces): el partido de BeSoccer sale aunque la hoja aún
          | no tenga ninguna fila ese día (la J14 del 29/11 salía vacía), igual
          | que en /calendar_general; y los días de esa semana llevan su MD
          | (sólo MD-5 a MD-1: más lejos es ruido).
          */
          const suyo = partidoDelDia.get(key);

          if (suyo?.rival) {
            const detalle = lineaPartido(key);

            return {
              hasContent: true,
              onClick: () => setSelectedKey(key),
              badges: (
                <span className="whitespace-nowrap rounded-full px-1.5 py-0.5 text-[10px] font-semibold uppercase" style={{ background: "#1F2937", color: "#FFFFFF" }}>
                  MD
                </span>
              ),
              children: (
                <>
                  <div className="flex items-center gap-1 rounded-md border border-[#C8A96B]/30 bg-[#C8A96B]/10 px-1.5 py-1" title={`Castilla vs ${nombreBonito(suyo.rival)}`}>
                    <Escudo url={escudoDe(NOSOTROS)} nombre="RM Castilla" className="h-4 w-4 md:h-5 md:w-5" />
                    <span className="shrink-0 text-[10px] font-semibold text-[#C8A96B]">vs</span>
                    <Escudo url={escudoDe(suyo.rival)} nombre={nombreBonito(suyo.rival)} className="h-4 w-4 md:h-5 md:w-5" />
                    <span className="min-w-0 truncate text-[10px] font-semibold leading-tight text-white/85 md:text-[11px]" title={nombreBonito(suyo.rival)}>{nombreCorto(nombreBonito(suyo.rival))}</span>
                  </div>
                  {detalle ? <p className="line-clamp-2 break-words text-[11px] font-semibold leading-tight text-[#C8A96B]">{detalle}</p> : null}
                  {(() => {
                    const e = enlaceDelPartido(key, suyo.rival);

                    return (
                      <Link href={e.href} onClick={sinAbrirElDia} className="block text-[11px] font-semibold text-sky-300 underline-offset-2 hover:underline">
                        {e.texto} →
                      </Link>
                    );
                  })()}
                  <EnlacesRivalCasilla jornadas={jornadasRivales} rival={suyo.rival} fecha={key} onClick={sinAbrirElDia} />
                </>
              ),
              crece: true,
            };
          }

          /*
          | 17/11/2026 (r20, jueces): la regla común de los dos calendarios
          | (lib/microciclo/semana-de-hoy.ts, mdALaVista): MD+1 · recuperación,
          | MD+2 y MD-n; el 22/11 y el 23/11 ya no se quedan sin etiqueta.
          */
          const mdVacio = mdALaVista(key, fechasPartido, hoyComun);
          const trasPartido = mdVacio === "MD+1";
          const enSemana = Boolean(mdVacio) && !trasPartido;
          const libre = !mdVacio && sessionDays.length > 1 && key > sessionDays[0] && key < sessionDays[sessionDays.length - 1];

          return libre || enSemana || trasPartido
            ? {
                badges: (
                  <span className="flex items-center gap-1">
                    {trasPartido ? (
                      <span className="whitespace-nowrap rounded-full border border-white/20 px-1.5 py-0.5 text-[10px] font-semibold text-white/65" title="El día después del partido">
                        MD+1 · recuperación
                      </span>
                    ) : enSemana ? (
                      <span className="whitespace-nowrap rounded-full border border-white/20 px-1.5 py-0.5 text-[10px] font-semibold uppercase text-white/65" title="Días que faltan para el próximo partido (sin tareas en la hoja todavía)">
                        {mdVacio}
                      </span>
                    ) : null}
                    {libre && !trasPartido ? <span className="text-[10px] font-semibold uppercase tracking-wide text-white/45">Libre</span> : null}
                  </span>
                ),
              }
            : {};
        }

        const totalMinutes = dayTasks.reduce((s, t) => s + minutesOf(t), 0);
        /* Los minutos de lo planificado no dicen que se hiciera: sólo cuentan los de la copia de lo hecho. */
        /* 20/11/2026 (ronda 5): el día que ya está en la copia de lo hecho cuenta como hecho, como en /calendar_general. */
        const estadoDia = estadoDe(key, dayTasks.every((t) => t._plan) ? 0 : totalMinutes, !dayTasks.every((t) => t._plan));
        /* La tarea del plan que no se hizo no se cuenta como contenido del día: va tachada aparte. */
        const noHechas = dayTasks.filter((t) => estadoDia.noHechas.has(String(t.Tarea ?? "").trim()));
        const hechasDelDia = noHechas.length ? dayTasks.filter((t) => !noHechas.includes(t)) : dayTasks;
        /* Ronda 7 (fútbol): el total del día, sólo con lo hecho (el 27/10 daba 43′ y son 29′). */
        const minutosHechos = hechasDelDia.reduce((s, t) => s + minutesOf(t), 0);

        // Minutos por contenido principal, ordenados de mayor a menor.
        const blocks = new Map<string, number>();
        hechasDelDia.forEach((t) => {
          /* Sin contenido principal se rotula con el tipo de tarea; sin ninguno, no se pinta. */
          const name = (t["Contenido Principal"] || t["Tipo Tarea"] || "").trim();
          blocks.set(name, (blocks.get(name) ?? 0) + minutesOf(t));
        });

        const orderedBlocks = [...blocks.entries()]
          /* 11/11/2026: el día de partido no repite «Competición 90'»: la duración ya va en la cabecera del día. */
          .filter(([name]) => name && !(esDiaDePartido(dayTasks) && /^competici/i.test(name)))
          .sort((a, b) => b[1] - a[1]);

        // Fase dominante sin contar Global; sin ninguna, el fondo normal.
        const theme = faseDelDia(dayTasks) ?? NEUTRAL_THEME;
        /* 07/11/2026: el MD de cualquier tarea del día; sin ninguno, «fuera de micro» (nada de casilla sin etiqueta). */
        const mdHoja = dayTasks.map((t) => String(t.MD ?? "").trim()).find(Boolean) ?? "";
        /* 16/11/2026: el MD sale de la regla común (lib/microciclo/semana-de-hoy.ts), la misma
           del creador de micros y de /calendar_general; el de la hoja, si no hay partido a la vista. */
        const md = esDiaDePartido(dayTasks) ? "MD" : mdDelCalendario(key, fechasPartido) || mdHoja;
        /* Todo el día sólo planificado (sin minutos ni copia de lo hecho): borde discontinuo. */
        const soloPlan = !estadoDia.hecha && (dayTasks.every((t) => t._plan) || (totalMinutes === 0 && !esDiaDePartido(dayTasks)));

        const partido = esDiaDePartido(dayTasks) ? String(dayTasks[0]?.Rival ?? "").trim() : "";
        const detallePartido = partido ? lineaPartido(key) : "";

        return {
          hasContent: true,
          accentClass: theme === NEUTRAL_THEME ? undefined : theme.cell,
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
              {/* 16/11/2026: el día de partido no lleva duración (el 13/11 no la tenía y
                  los demás sí): el partido no es minutos de entreno, y así salen todos igual. */}
              {minutosHechos > 0 && !esDiaDePartido(dayTasks) && (
                <span className="rounded-full border border-[#C8A96B]/30 bg-[#C8A96B]/10 px-2 py-0.5 text-[10px] font-semibold text-[#C8A96B]">
                  {formatMinutes(minutosHechos)}
                </span>
              )}
              {/* 10/11/2026: un entreno que aún no tiene minutos en la hoja es
                  un día planificado; se dice, para que el mes se lea igual de
                  principio a fin (la hoja no guarda minutos previstos). */}
              {totalMinutes === 0 && !esDiaDePartido(dayTasks) && estadoDia.hecha && (
                <span
                  className="whitespace-nowrap rounded-full border border-emerald-400/30 bg-emerald-400/10 px-1.5 py-0.5 text-[10px] font-semibold text-emerald-300"
                  title="Sesión hecha: tiene equipos en Jugadores sesión; la hoja aún no tiene sus minutos"
                >
                  hecha
                </span>
              )}
              {totalMinutes === 0 && !esDiaDePartido(dayTasks) && !estadoDia.hecha && (
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
                  {/* Truncado con el nombre entero al pasar (19/11/2026: salía «Majadahond a»). */}
                  <span className="min-w-0 truncate text-[10px] font-semibold leading-tight text-white/85 md:text-[11px]" title={nombreBonito(partido)}>
                    {nombreCorto(nombreBonito(partido))}
                  </span>
                </div>
              )}
              {/* 16/11/2026 (jueces): en dos líneas; cortado decía «ganado 2…». */}
              {detallePartido && (
                <p className="line-clamp-2 break-words text-[11px] font-semibold leading-tight text-[#C8A96B]" title={detallePartido}>
                  {detallePartido}
                </p>
              )}
              {partido ? (() => {
                const e = enlaceDelPartido(key, partido, String(dayTasks[0]?.Micro ?? ""));

                return (
                  <>
                    <Link href={e.href} onClick={sinAbrirElDia} className="block text-[11px] font-semibold text-sky-300 underline-offset-2 hover:underline">
                      {e.texto} →
                    </Link>
                    <EnlacesRivalCasilla jornadas={jornadasRivales} rival={nombreBonito(partido)} fecha={key} onClick={sinAbrirElDia} />
                  </>
                );
              })() : null}

              {/* 16/11/2026 (jueces): la fase escrita, no sólo el color de fondo (daltonismo y móvil). */}
              {theme !== NEUTRAL_THEME && !partido ? (
                <p className={cn("block w-fit max-w-full truncate rounded-full px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide", theme.chip)} title={`Fase con más minutos: ${theme.label}`}>
                  {theme.label}
                </p>
              ) : null}

              {/* 30/10/2026: una tarea sin minutos deja sólo su nombre (sin
                  barra vacía ni cifra), y la letra no baja de 11 px.
                  16/11/2026: lo sólo planificado va dentro de un borde discontinuo. */}
              <div className={soloPlan && orderedBlocks.length ? "space-y-1 rounded-md border border-dashed border-white/30 px-1.5 py-1" : "contents"} style={soloPlan ? { borderStyle: "dashed", borderColor: "rgb(var(--rmcf-ink-rgb) / .35)" } : undefined}>
              {orderedBlocks.map(([name, minutes]) => (
                <div key={name} title={tituloConSiglas(name)}>
                  <div className="flex items-baseline justify-between gap-2">
                    {/* 10/11/2026: dos líneas antes de cortar; el nombre entero va en el title. */}
                    <span className="min-w-0 break-words text-[11px] leading-tight md:text-xs">{name}</span>

                    {minutes > 0 && (
                      <span className="shrink-0 text-[11px] text-white/55">
                        {minutes}&apos;
                      </span>
                    )}
                  </div>

                  {minutes > 0 && minutosHechos > 0 && (
                    <div className="mt-1">
                      <MetricBar
                        value={minutes}
                        max={minutosHechos}
                        className={theme.bar}
                      />
                    </div>
                  )}
                </div>
              ))}
              </div>
              {noHechas.length ? (
                <p className="text-[11px] leading-tight text-white/50" title="Estaba en el plan y no se hizo (según los equipos de Jugadores sesión)">
                  <span className="line-through decoration-white/40">{noHechas.map((t) => String(t["Contenido Principal"] || t["Tipo Tarea"] || t.Tarea || "").trim()).filter(Boolean).join(", ")}</span> · no se hizo
                </p>
              ) : null}

              {/* 16/11/2026 (jueces): el día de entreno abre su sesión en Microciclos, con su micro y su MD, desde la propia casilla. */}
              {!partido && Number(dayTasks[0]?.Micro) > 0 ? (
                <Link
                  href={`/microcycles?micro=${Number(dayTasks[0]?.Micro)}${md ? `&md=${encodeURIComponent(md.toUpperCase().replace(/\s+/g, ""))}` : ""}`}
                  onClick={sinAbrirElDia}
                  className="block text-[11px] font-semibold text-[#C8A96B] underline-offset-2 hover:underline"
                >
                  Ver la sesión →
                </Link>
              ) : null}
              {/* 20/11/2026 (marketing, ronda 5): desde el día, sus equipos y su análisis, con la fecha ya puesta. */}
              {!partido && key <= (hoyComun || "") ? (
                <span className="flex flex-wrap gap-x-2 text-[11px] font-semibold">
                  {/* Ronda 7 (marketing): el rótulo dice adónde lleva («Equipos →» no se entendía). */}
                  <Link href={`/jugadores-sesion?fecha=${key}`} onClick={sinAbrirElDia} title="Jugadores sesión de este día" className="text-[#C8A96B] underline-offset-2 hover:underline">
                    Jugadores sesión →
                  </Link>
                  <Link href={`/analisis-entrenamiento?fecha=${key}`} onClick={sinAbrirElDia} title="Análisis de entrenamiento de este día" className="text-[#C8A96B] underline-offset-2 hover:underline">
                    Análisis del entreno →
                  </Link>
                </span>
              ) : null}
            </>
          ),
          /* 16/11/2026: la casilla crece con su contenido; los nombres ya no se cortan dentro de su propio scroll. */
          crece: true,
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
            {leyendaMes.length > 0 ? "Fondo del día = fase con más minutos, sin contar Global · " : ""}Barra = minutos de ese contenido sobre los de la sesión.
          </p>
          <p>Borde discontinuo y «planificado» = entreno de la hoja que aún no tiene minutos. MD-n = días que faltan para el próximo partido, como en el creador de micros.</p>
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
            /* 16/11/2026: el día de partido sin filas en la hoja (sólo BeSoccer) se cuenta con el partido. */
            (selectedTasks.length === 0 && selectedKey && partidoDelDia.get(selectedKey)
              ? ["MD", `vs ${nombreBonito(partidoDelDia.get(selectedKey)?.rival ?? "")}`, lineaPartido(selectedKey)]
              : [
              `${selectedTasks.length} ${
                selectedTasks.length === 1 ? "tarea" : "tareas"
              }`,
              selectedSummary.minutos > 0 ? formatMinutes(selectedSummary.minutos) : "",
              selectedSummary.md || "fuera de micro",
              selectedSummary.micro && `Micro ${selectedSummary.micro}`,
              selectedSummary.rival && `vs ${selectedSummary.rival}`,
              esDiaDePartido(selectedTasks) && selectedKey ? lineaPartido(selectedKey) : "",
            ])
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
            {/*
            | 16/11/2026 (jueces): el día abre lo que lo completa, ya elegido.
            | Entreno: su micro y su MD en Microciclos, sus equipos y su análisis.
            | Partido jugado: el informe (en Microciclos, botón «Informe del
            | partido»); por jugar: el plan, el ABP y los goles del rival.
            */}
            {selectedKey ? (() => {
              const suyo = partidoDelDia.get(selectedKey);
              const esPartido = esDiaDePartido(selectedTasks) || (selectedTasks.length === 0 && Boolean(suyo));
              const microNum = Number(selectedSummary.micro);
              const conMicro = Number.isInteger(microNum) && microNum > 0;
              const enlace = "inline-flex min-h-10 items-center gap-1.5 rounded-xl border px-3 py-2 text-[13px] font-semibold transition focus-visible:outline focus-visible:outline-2 focus-visible:outline-[#C8A96B]";
              const oro = `${enlace} border-[#C8A96B]/40 bg-[#C8A96B]/10 text-[#C8A96B] hover:bg-[#C8A96B]/20`;
              const gris = `${enlace} border-white/15 text-white/75 hover:text-white`;

              if (esPartido) {
                const rival = suyo?.rival || selectedSummary.rival;

                return (
                  <div className="flex flex-wrap gap-2">
                    {suyo?.jugado ? (
                      <Link href={conMicro ? `/microcycles?micro=${microNum}` : "/microcycles"} className={oro}>
                        <FileText size={15} aria-hidden /> Informe del partido
                      </Link>
                    ) : rival ? (
                      <EnlacesDelRival rival={nombreBonito(rival)} fecha={selectedKey} solo={["Plan de partido", "Su ABP", "Sus goles en vídeo"]} />
                    ) : null}
                  </div>
                );
              }

              if (!selectedTasks.length) return null;

              return (
                <div className="flex flex-wrap gap-2">
                  <Link
                    href={conMicro ? `/microcycles?micro=${microNum}${selectedSummary.md ? `&md=${encodeURIComponent(selectedSummary.md.toUpperCase().replace(/\s+/g, ""))}` : ""}` : "/microcycles"}
                    className={oro}
                  >
                    <CalendarDays size={15} aria-hidden /> {conMicro ? `Micro ${microNum}${selectedSummary.md ? ` · ${selectedSummary.md}` : ""} en Microciclos` : "Abrir en Microciclos"}
                  </Link>
                  <Link href={enlaceSesion(selectedKey)} className={gris}>
                    <Users size={15} aria-hidden /> Equipos de la sesión
                  </Link>
                  <Link href={enlaceAnalisis(selectedKey)} className={gris}>
                    <ClipboardCheck size={15} aria-hidden /> Análisis del entreno
                  </Link>
                </div>
              );
            })() : null}

            {selectedTasks.length === 0 && !(selectedKey && partidoDelDia.get(selectedKey)) && (
              <CalendarEmptyState>
                No hay tareas registradas este día.
              </CalendarEmptyState>
            )}

            {Object.entries(grouped).map(([bloque, tareas]) => {
              /* Ronda 7: lo que «no se hizo» no suma al bloque. */
              const noSeHizo = (t: MicrocycleRecord) => selectedSummary.noHechasDia.has(String(t.Tarea ?? "").trim());
              const bloqueMinutos = tareas.reduce((s, t) => s + (noSeHizo(t) ? 0 : minutesOf(t)), 0);

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

                            {noSeHizo(t) && (
                              <span className="rounded-full border border-white/20 px-3 py-1 text-[11px] font-semibold text-white/70" title="Estaba en el plan y no se hizo (según los equipos de Jugadores sesión): sus minutos no cuentan">
                                no se hizo · no suma
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

/* Un color por MD (17/11/2026): el mismo en las barras y en su leyenda. */
const COLOR_MD: Record<string, string> = {
  "MD-1": "#38BDF8",
  "MD-2": "#A78BFA",
  "MD-3": "#34D399",
  "MD-4": "#C8A96B",
  "MD-5": "#FB7185",
  /* 20/11/2026 (jueces): los que faltaban; antes el MD+2 salía verde como un MD-3. */
  "MD-6": "#F472B6",
  "MD+1": "#94A3B8",
  "MD+2": "#F97316",
};

/**
 * LA CARGA DEL MES EN BARRAS (17/11/2026, jueces). Una barra por entreno
 * hecho, coloreada por su MD, con la raya de la media de ese MD en la
 * temporada; y, si se puede comparar, la media del mes frente a la del
 * anterior en los mismos días.
 */
function BarrasCargaMes({
  dias,
  media,
  mes,
  comparacion,
  pie,
  onElige,
}: {
  /** Ronda 7: pinchar la fila de un entreno abre su día (con sus enlaces a Jugadores sesión y al análisis). */
  onElige?: (key: string) => void;
  dias: { key: string; md: string; ua: number }[];
  media: Map<string, number>;
  mes: string;
  comparacion: { antes: number; ahora: number; mesAntes: string; base: string; nAntes?: number; nAhora?: number } | null;
  /** 20/11/2026: el porqué de la orden de arriba, al pie del gráfico. */
  pie?: string;
}) {
  const max = Math.max(1, ...dias.map((d) => d.ua), ...dias.map((d) => media.get(d.md) ?? 0));
  const mds = [...new Set(dias.map((d) => d.md).filter(Boolean))].sort();
  const titulo = comparacion
    ? `${comparacion.ahora > comparacion.antes ? "Más" : comparacion.ahora < comparacion.antes ? "Menos" : "La misma"} carga por entreno que en ${comparacion.mesAntes}: ${comparacion.ahora} UA frente a ${comparacion.antes}${comparacion.base ? ` (días ${comparacion.base})` : ""}`
    : `Carga física por entreno en ${mes}`;

  return (
    <section aria-label="Carga física por entreno del mes" className="min-w-0 rounded-2xl border border-white/10 bg-white/[0.03] p-4">
      <h2 className="text-[14px] font-semibold text-white/90">{titulo}</h2>
      <p className="mt-0.5 text-[12px] text-white/55">
        Una barra por entreno hecho (UA = minutos × intensidad). Encima, sus UA; debajo, el día y su MD (MD-5 = cinco días antes del partido, MD+2 = dos después); la raya es la media de ese MD en la temporada.
      </p>

      <div className="mt-3 grid min-w-0 gap-4 md:grid-cols-[minmax(0,1fr)_200px]">
        {/*
        | 20/11/2026 (ronda 7, marketing): «3 / −5» se leía como una diferencia.
        | Ahora cada barra lleva su valor encima y debajo un solo rótulo con el
        | día y el MD entero («3 · MD-5»). En el móvil, una fila por entreno con
        | la cifra escrita (nada que pinchar) que abre su día.
        */}
        <div className="hidden h-36 min-w-0 items-end gap-1 overflow-x-auto md:flex" role="img" aria-label={`Carga de ${dias.length} entrenos de ${mes}`}>
          {dias.map((d) => {
            const m = media.get(d.md);

            return (
              <div key={d.key} className="flex min-w-[30px] flex-1 flex-col items-center gap-1" title={`${d.key.slice(8, 10)}/${d.key.slice(5, 7)} · ${d.md || "sin MD"} · ${d.ua} UA${m ? ` (media del ${d.md}: ${m})` : ""}`}>
                <span className="text-[11px] font-semibold leading-none tabular-nums text-white/75">{d.ua}</span>
                <div className="relative h-20 w-full">
                  <span className="absolute inset-x-0 bottom-0 rounded-t-[3px]" style={{ height: `${(100 * d.ua) / max}%`, background: COLOR_MD[d.md] ?? "rgb(var(--rmcf-ink-rgb) / .35)" }} />
                  {m ? <span className="absolute inset-x-[-2px] h-0.5 rounded-full" style={{ bottom: `${(100 * m) / max}%`, background: "rgb(var(--rmcf-ink-rgb) / .85)" }} /> : null}
                </div>
                <span className="whitespace-nowrap text-center text-[11px] leading-tight tabular-nums text-white/65">
                  {Number(d.key.slice(8, 10))}
                  {d.md ? <span className="block text-[10px] text-white/55">{d.md}</span> : null}
                </span>
              </div>
            );
          })}
        </div>
        <ul className="min-w-0 space-y-1 md:hidden" aria-label={`Carga de ${dias.length} entrenos de ${mes}`}>
          {dias.map((d) => {
            const m = media.get(d.md);

            return (
              <li key={d.key}>
                <button type="button" onClick={() => onElige?.(d.key)} className="grid min-h-9 w-full grid-cols-[76px_minmax(0,1fr)_52px] items-center gap-2 rounded-md px-1 text-left text-[12px] hover:bg-white/5">
                  <span className="whitespace-nowrap tabular-nums text-white/70">
                    {Number(d.key.slice(8, 10))}/{Number(d.key.slice(5, 7))} · {d.md || "sin MD"}
                  </span>
                  <span className="relative h-3 rounded-sm bg-white/5">
                    <span className="absolute inset-y-0 left-0 rounded-sm" style={{ width: `${(100 * d.ua) / max}%`, background: COLOR_MD[d.md] ?? "rgb(var(--rmcf-ink-rgb) / .35)" }} />
                    {m ? <span className="absolute inset-y-[-2px] w-0.5 rounded-full" style={{ left: `${(100 * m) / max}%`, background: "rgb(var(--rmcf-ink-rgb) / .85)" }} /> : null}
                  </span>
                  <span className="text-right font-semibold tabular-nums text-white/80">{d.ua} UA</span>
                </button>
              </li>
            );
          })}
        </ul>

        <div className="min-w-0 space-y-2">
          {comparacion ? (
            <div className="space-y-1">
              {[
                { rotulo: comparacion.mesAntes, ua: comparacion.antes, n: comparacion.nAntes, color: "rgb(var(--rmcf-ink-rgb) / .35)" },
                { rotulo: mes, ua: comparacion.ahora, n: comparacion.nAhora, color: "#C8A96B" },
              ].map((b) => (
                <div key={b.rotulo} className="text-[12px]">
                  <p className="flex justify-between gap-2 text-white/70">
                    <span>
                      <span className="capitalize">{b.rotulo}</span>
                      {b.n ? <span className="text-white/50"> · {b.n} {b.n === 1 ? "entreno" : "entrenos"}</span> : null}
                    </span>
                    <span className="tabular-nums font-semibold">{b.ua} UA</span>
                  </p>
                  <div className="h-2 overflow-hidden rounded-full bg-white/10">
                    <div className="h-full rounded-full" style={{ width: `${(100 * b.ua) / Math.max(comparacion.antes, comparacion.ahora)}%`, background: b.color }} />
                  </div>
                </div>
              ))}
            </div>
          ) : null}
          <p className="flex flex-wrap gap-x-3 gap-y-1 text-[11px] text-white/60">
            {mds.map((md) => (
              <span key={md} className="inline-flex items-center gap-1">
                <span className="h-2.5 w-2.5 rounded-sm" style={{ background: COLOR_MD[md] ?? "rgb(var(--rmcf-ink-rgb) / .35)" }} aria-hidden />
                {md}
              </span>
            ))}
            {dias.some((d) => !d.md) ? (
              <span className="inline-flex items-center gap-1">
                <span className="h-2.5 w-2.5 rounded-sm" style={{ background: "rgb(var(--rmcf-ink-rgb) / .35)" }} aria-hidden />
                fuera de micro
              </span>
            ) : null}
          </p>
        </div>
      </div>
      {pie ? <p className="mt-3 border-t border-white/10 pt-2 text-[12px] leading-snug text-white/60">{pie}</p> : null}
    </section>
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

/**
 * Sus goles en vídeo y su ABP dentro de la casilla del partido, con el rival
 * ya elegido (17/11/2026, r20, jueces). Pulsarlos no abre el día.
 */
function EnlacesRivalCasilla({
  jornadas,
  rival,
  fecha,
  onClick,
}: {
  jornadas: ReturnType<typeof useJornadasRivales>;
  rival: string;
  fecha: string;
  onClick: (e: { stopPropagation: () => void }) => void;
}) {
  const enlaces = enlacesDelRival(jornadas, rival, fecha).filter((e) => e.texto === "Su ABP" || e.texto === "Sus goles en vídeo");

  if (!enlaces.length) return null;

  return (
    <span className="flex flex-wrap gap-x-2 gap-y-0.5">
      {enlaces.map((e) =>
        /* 18/11/2026: «Sus goles» abre el pop-up de la portada, sin salir del calendario. */
        e.golesEnVideo ? (
          <BotonGolesEnVideo key={e.texto} {...e.golesEnVideo} title={e.title} className="text-left text-[11px] font-semibold text-sky-300 underline-offset-2 hover:underline">
            ▶ Sus goles
          </BotonGolesEnVideo>
        ) : (
          <Link key={e.texto} href={e.href} title={e.title} onClick={onClick} className="text-[11px] font-semibold text-sky-300 underline-offset-2 hover:underline">
            {e.texto}
          </Link>
        ),
      )}
    </span>
  );
}
