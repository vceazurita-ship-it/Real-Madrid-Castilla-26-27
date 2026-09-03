"use client";
import { traeCsv } from "@/lib/hojaCsv";

import { Sidebar } from "@/components/ui/sidebar";
import { chipInk } from "@/lib/theme";
import { Topbar } from "@/components/ui/topbar";
import { useDeferredValue, useEffect, useMemo, useState } from "react";
import Papa from "papaparse";
import {
  Activity,
  ArrowDown,
  ArrowUp,
  Brain,
  CalendarDays,
  Clock,
  Download,
  Flame,
  Gauge,
  Layers,
  ListChecks,
  Minus,
  Search,
  Sparkles,
  Star,
  Target,
} from "lucide-react";
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  Line,
  CartesianGrid,
  Area,
  ComposedChart,
  Legend,
  LabelList,
  PieChart,
  Pie,
  Cell,
  RadarChart,
  Radar,
  PolarGrid,
  PolarAngleAxis,
  PolarRadiusAxis,
  ScatterChart,
  Scatter,
  ZAxis,
  ReferenceLine,
} from "recharts";

const CSV_URL =
  "https://docs.google.com/spreadsheets/d/e/2PACX-1vS3_1ScOV6sTyEpZSgLgCf2dKbwkLzb3zUEYM-7ZOoMbcFUTp7nvu1pBfGOP7EzppXXQYQhLeVa_SPr/pub?gid=111318766&single=true&output=csv";

const COLORS = {
  gold: "#C8A96B",
  blue: "#3B82F6",
  purple: "#8B5CF6",
  green: "#10B981",
  orange: "#F97316",
  pink: "#EC4899",
  gray: "#64748B",
};

const PIE_COLORS = [
  "#C8A96B",
  "#3B82F6",
  "#8B5CF6",
  "#10B981",
  "#F97316",
  "#EC4899",
  "#64748B",
  "#EAB308",
  "#06B6D4",
];

/* ------------------------------------------------------------------ */
/* Helpers                                                             */
/* ------------------------------------------------------------------ */

const getEvalColor = (value: number) => {
  if (value >= 7.5) return "#10B981";
  if (value >= 6.5) return "#C8A96B";
  if (value >= 5.5) return "#F59E0B";
  if (value > 0) return "#EF4444";
  return "#475569";
};

const norm = (v?: string) =>
  (v || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim();

const isCompeticion = (fase?: string) => norm(fase).includes("competicion");

function num(v?: string) {
  if (!v) return 0;

  return (
    Number(
      String(v)
        .replace(",", ".")
        .replace(/[^\d.-]/g, "")
    ) || 0
  );
}

function avg(arr: number[]) {
  if (!arr.length) return 0;

  return +(arr.reduce((a, b) => a + b, 0) / arr.length).toFixed(1);
}

function sum(arr: number[]) {
  return arr.reduce((a, b) => a + b, 0);
}

function normalizeMD(v?: string) {
  if (!v) return "";

  return String(v).trim().toUpperCase().replace(/\s+/g, "");
}

function fmtInt(n: number) {
  return Math.round(n).toLocaleString("es-ES");
}

function fmtMin(n: number) {
  const h = Math.floor(n / 60);
  const m = Math.round(n % 60);

  return h > 0 ? `${h}h ${m}'` : `${m}'`;
}

/** dd/mm/yyyy -> Date */
function parseFecha(v?: string): Date | null {
  if (!v) return null;

  const m = String(v).trim().match(/^(\d{1,2})[/-](\d{1,2})[/-](\d{2,4})$/);

  if (!m) {
    const d = new Date(v);
    return isNaN(d.getTime()) ? null : d;
  }

  const year = Number(m[3].length === 2 ? `20${m[3]}` : m[3]);

  return new Date(year, Number(m[2]) - 1, Number(m[1]));
}

function fmtFechaCorta(v?: string) {
  const d = parseFecha(v);

  if (!d) return v || "—";

  return d.toLocaleDateString("es-ES", {
    day: "2-digit",
    month: "short",
  });
}

const MD_SEQUENCE = [
  "MD-7",
  "MD-6",
  "MD-5",
  "MD-4",
  "MD-3",
  "MD-2",
  "MD-1",
  "MD",
  "MD+1",
  "MD+2",
];

const DIA_LABEL: Record<string, string> = {
  L: "Lunes",
  M: "Martes",
  X: "Miércoles",
  J: "Jueves",
  V: "Viernes",
  S: "Sábado",
  D: "Domingo",
};

/* ------------------------------------------------------------------ */
/* Etiquetas de ejes                                                   */
/* ------------------------------------------------------------------ */

/*
 * Con muchas categorías (o con nombres largos) las etiquetas se pisaban
 * unas con otras. El texto se reparte ahora en varias líneas según el
 * ancho real reservado para el eje, se recorta con puntos suspensivos a
 * partir de cierto número de líneas y la altura del gráfico se calcula
 * a partir de las líneas que realmente ocupa la etiqueta más alta.
 */

/** Ancho medio de un carácter a 11px con la tipografía de la app. */
const TICK_CHAR_WIDTH = 6.15;

/** Interlineado de las etiquetas de categoría. */
const TICK_LINE_HEIGHT = 13;

function wrapLabel(label: string, maxChars: number, maxLines: number) {
  const words = String(label ?? "")
    .trim()
    .split(/s+/)
    .filter(Boolean);

  if (!words.length) return [""];

  const lines: string[] = [];

  let current = "";

  for (const word of words) {
    const candidate = current ? `${current} ${word}` : word;

    if (!current || candidate.length <= maxChars) {
      current = candidate;
    } else {
      lines.push(current);
      current = word;
    }
  }

  lines.push(current);

  /* Una palabra suelta más larga que la línea se parte por la fuerza. */
  const split: string[] = [];

  for (const line of lines) {
    if (line.length <= maxChars) {
      split.push(line);
      continue;
    }

    for (let i = 0; i < line.length; i += maxChars) {
      split.push(line.slice(i, i + maxChars));
    }
  }

  if (split.length <= maxLines) return split;

  const trimmed = split.slice(0, maxLines);

  trimmed[maxLines - 1] =
    `${trimmed[maxLines - 1].slice(0, Math.max(1, maxChars - 1)).trimEnd()}…`;

  return trimmed;
}

/** Líneas que ocupa una etiqueta dentro del ancho reservado al eje. */
function labelLines(label: string, width: number, maxLines = 3) {
  const maxChars = Math.max(6, Math.floor((width - 14) / TICK_CHAR_WIDTH));

  return wrapLabel(label, maxChars, maxLines);
}

/** Alto que necesita cada banda para que dos etiquetas no se toquen. */
function categoryBandHeight(
  items: { name: string }[],
  width: number,
  maxLines = 3
) {
  const lines = items.reduce(
    (max, item) => Math.max(max, labelLines(item.name, width, maxLines).length),
    1
  );

  return Math.max(30, lines * TICK_LINE_HEIGHT + 12);
}

/** Alto total de un gráfico de barras horizontales. */
function categoryChartHeight(
  items: { name: string }[],
  width: number,
  { min = 320, maxLines = 3, extra = 56 } = {}
) {
  return Math.max(
    min,
    items.length * categoryBandHeight(items, width, maxLines) + extra
  );
}

/* Recharts entrega las coordenadas como `string | number`. */
type AxisTickProps = {
  x?: string | number;
  y?: string | number;
  payload?: { value?: string | number };
};

type PolarTickProps = AxisTickProps & {
  cx?: string | number;
  cy?: string | number;
};

/** Tick de categoría (eje Y de las barras horizontales). */
const makeCategoryTick =
  (width: number, maxLines = 3) =>
  function CategoryTick({ x, y, payload }: AxisTickProps) {
    const label = String(payload?.value ?? "");

    const px = Number(x) || 0;
    const py = Number(y) || 0;

    const lines = labelLines(label, width, maxLines);

    return (
      <text
        x={px}
        y={py}
        fill="#CBD5E1"
        fontSize={11}
        textAnchor="end"
        dominantBaseline="middle"
      >
        <title>{label}</title>

        {lines.map((line, index) => (
          <tspan
            key={index}
            x={px}
            dy={
              index === 0
                ? -((lines.length - 1) * TICK_LINE_HEIGHT) / 2
                : TICK_LINE_HEIGHT
            }
          >
            {line}
          </tspan>
        ))}
      </text>
    );
  };

/**
 * Propiedades del eje X cuando el número de categorías es variable:
 * a partir de cierto punto se inclinan las etiquetas y, si aun así no
 * caben, se muestra una de cada N.
 */
function categoryAxisProps(count: number, isMobile: boolean) {
  const maxTicks = isMobile ? 8 : 26;

  const interval = count > maxTicks ? Math.ceil(count / maxTicks) - 1 : 0;

  const rotate = count > (isMobile ? 5 : 12);

  return {
    interval,
    axisLine: false,
    tickLine: false,
    tick: { fill: "#94A3B8", fontSize: count > 18 ? 10 : 12 },
    ...(rotate
      ? {
          angle: -40,
          textAnchor: "end" as const,
          height: 64,
          tickMargin: 6,
        }
      : { height: 34, tickMargin: 8 }),
  };
}

/** Tick de un radar: parte los nombres largos y los separa del polígono. */
const makePolarTick =
  (fontSize: number) =>
  function PolarTick({ x, y, cx, cy, payload }: PolarTickProps) {
    const label = String(payload?.value ?? "");

    const px = Number(x) || 0;
    const py = Number(y) || 0;
    const centerX = Number(cx) || 0;
    const centerY = Number(cy) || 0;

    const lines = label.length > 11 ? wrapLabel(label, 11, 2) : [label];

    const anchor =
      Math.abs(px - centerX) < 14 ? "middle" : px > centerX ? "start" : "end";

    /* Un pequeño empujón radial evita que el texto toque el polígono. */
    const offsetX = anchor === "middle" ? 0 : px > centerX ? 4 : -4;

    const above = py < centerY;

    const startDy = above ? -((lines.length - 1) * (fontSize + 2)) : 0;

    return (
      <text
        x={px + offsetX}
        y={py}
        fill="#E2E8F0"
        fontSize={fontSize}
        fontWeight={500}
        textAnchor={anchor}
        dominantBaseline="middle"
      >
        <title>{label}</title>

        {lines.map((line, index) => (
          <tspan
            key={index}
            x={px + offsetX}
            dy={index === 0 ? startDy : fontSize + 2}
          >
            {line}
          </tspan>
        ))}
      </text>
    );
  };

/* ------------------------------------------------------------------ */
/* Data                                                                */
/* ------------------------------------------------------------------ */

type Row = {
  temporada: string;
  micro: number;
  rival: string;
  dia: string;
  md: string;
  fecha: string;
  tarea: string;
  tipo: string;
  evaluacion: number;
  analisisPost: string;
  formato: string;
  grupo: string;
  espacio: string;
  contenidoPrincipal: string;
  contenidoSecundario: string;
  fase: string;
  tiempo: number;
  intensidad: number;
  carga: number;
  exigCog: number;
  cargaCog: number;
  demandaCog: number;
  densidad: number;
  nJug: number;
  nComodines: number;
  normativa: number;
  incertidumbre: number;
  familiaridad: number;
  motivacion: number;
  observaciones: string;
};

function parseCSV(text: string): Row[] {
  const parsed = Papa.parse<string[]>(text, {
    header: false,
    skipEmptyLines: true,
  });

  return parsed.data
    .slice(1)
    .map((r) => ({
      temporada: r[0] || "",
      micro: num(r[1]),
      rival: r[2] || "",
      dia: (r[3] || "").trim().toUpperCase(),
      md: normalizeMD(r[4]),
      fecha: r[5] || "",
      tarea: r[6] || "",
      tipo: r[7] || "",
      evaluacion: num(r[8]),
      analisisPost: r[9] || "",
      formato: r[10] || "",
      grupo: r[12] || "",
      espacio: r[13] || "",
      contenidoPrincipal: r[14] || "",
      contenidoSecundario: r[15] || "",
      fase: r[16] || "",
      tiempo: num(r[17]),
      intensidad: num(r[18]),
      carga: num(r[19]),
      exigCog: num(r[20]),
      cargaCog: num(r[21]),
      demandaCog: num(r[22]),
      densidad: num(r[23]),
      nJug: num(r[24]),
      nComodines: num(r[25]),
      normativa: num(r[26]),
      incertidumbre: num(r[27]),
      familiaridad: num(r[28]),
      motivacion: num(r[29]),
      observaciones: r[30] || "",
    }))
    .filter((r) => r.micro > 0 && r.md && r.tarea.trim() !== "");
}

type TabKey =
  | "resumen"
  | "cargas"
  | "contenidos"
  | "cognitivo"
  | "tareas";

const TABS: { key: TabKey; label: string; icon: any }[] = [
  { key: "resumen", label: "Resumen", icon: Sparkles },
  { key: "cargas", label: "Cargas", icon: Flame },
  { key: "contenidos", label: "Contenidos", icon: Layers },
  { key: "cognitivo", label: "Cognitivo", icon: Brain },
  { key: "tareas", label: "Tareas", icon: ListChecks },
];

const CONTENT_METRICS = [
  { key: "tareas", label: "Nº Tareas", color: COLORS.gold, unit: "" },
  { key: "tiempo", label: "Tiempo", color: COLORS.green, unit: "'" },
  { key: "carga", label: "Carga Física", color: COLORS.blue, unit: "" },
  { key: "cargaCog", label: "Carga Cognitiva", color: COLORS.purple, unit: "" },
  { key: "eval", label: "Evaluación", color: COLORS.orange, unit: "" },
] as const;

type ContentMetricKey = (typeof CONTENT_METRICS)[number]["key"];

/* ------------------------------------------------------------------ */
/* Page                                                                */
/* ------------------------------------------------------------------ */

export default function Page() {
  const [isMobile, setIsMobile] = useState(false);
  const [isNarrow, setIsNarrow] = useState(false);

  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);

  const [tab, setTab] = useState<TabKey>("resumen");

  const [micro, setMicro] = useState("ALL");
  const [tipoFilter, setTipoFilter] = useState("ALL");
  const [contenidoPrincipalFilter, setContenidoPrincipalFilter] =
    useState("ALL");
  const [evaluacionFilter, setEvaluacionFilter] = useState("ALL");
  const [faseFilter, setFaseFilter] = useState("ALL");
  const [mdFilter, setMdFilter] = useState("ALL");
  const [search, setSearch] = useState("");
  const [excludeComp, setExcludeComp] = useState(true);

  const [contentMetric, setContentMetric] =
    useState<ContentMetricKey>("tareas");

  const [sortKey, setSortKey] = useState<keyof Row>("micro");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("asc");

  useEffect(() => {
    const check = () => {
      setIsMobile(window.innerWidth < 768);
      setIsNarrow(window.innerWidth < 1200);
    };

    check();

    window.addEventListener("resize", check);

    return () => window.removeEventListener("resize", check);
  }, []);

  useEffect(() => {
    traeCsv(CSV_URL)
      .then((t) => {
        setRows(parseCSV(t));
        setLoading(false);
      })
      .catch((e) => {
        console.error(e);
        setLoading(false);
      });
  }, []);

  const micros = useMemo(
    () => [...new Set(rows.map((r) => r.micro))].sort((a, b) => a - b),
    [rows]
  );

  const mdOrder = useMemo(
    () => MD_SEQUENCE.filter((md) => rows.some((r) => r.md === md)),
    [rows]
  );

  /* ---------------- filtering ---------------- */

  /*
  | Lo que se teclea entra al momento en la caja; la lista se rehace
  | después, y sin bloquear. Son cientos de fichas filtrándose con cada
  | tecla, y hasta ahora el cursor se quedaba atrás al escribir deprisa.
  */
  const searchDiferido = useDeferredValue(search);

  const filtered = useMemo(() => {
    const q = norm(searchDiferido);

    return rows.filter((r) => {
      if (micro !== "ALL" && String(r.micro) !== micro) return false;
      if (faseFilter !== "ALL" && r.fase !== faseFilter) return false;
      if (tipoFilter !== "ALL" && r.tipo !== tipoFilter) return false;
      if (mdFilter !== "ALL" && r.md !== mdFilter) return false;

      if (
        contenidoPrincipalFilter !== "ALL" &&
        r.contenidoPrincipal !== contenidoPrincipalFilter
      )
        return false;

      if (
        evaluacionFilter !== "ALL" &&
        r.evaluacion < Number(evaluacionFilter)
      )
        return false;

      if (
        q &&
        !norm(
          `${r.tarea} ${r.tipo} ${r.contenidoPrincipal} ${r.contenidoSecundario} ${r.fase} ${r.formato} ${r.analisisPost}`
        ).includes(q)
      )
        return false;

      return true;
    });
  }, [
    rows,
    micro,
    tipoFilter,
    contenidoPrincipalFilter,
    evaluacionFilter,
    faseFilter,
    mdFilter,
    searchDiferido,
  ]);

  /** Working set for methodology analytics (competition optionally excluded) */
  const work = useMemo(
    () => (excludeComp ? filtered.filter((r) => !isCompeticion(r.fase)) : filtered),
    [filtered, excludeComp]
  );

  const activeFilters =
    (micro !== "ALL" ? 1 : 0) +
    (tipoFilter !== "ALL" ? 1 : 0) +
    (contenidoPrincipalFilter !== "ALL" ? 1 : 0) +
    (evaluacionFilter !== "ALL" ? 1 : 0) +
    (faseFilter !== "ALL" ? 1 : 0) +
    (mdFilter !== "ALL" ? 1 : 0) +
    (search ? 1 : 0);

  const clearAll = () => {
    setMicro("ALL");
    setTipoFilter("ALL");
    setContenidoPrincipalFilter("ALL");
    setFaseFilter("ALL");
    setEvaluacionFilter("ALL");
    setMdFilter("ALL");
    setSearch("");
  };

  /* ---------------- global metrics ---------------- */

  const metrics = useMemo(() => {
    const evals = filtered.map((r) => r.evaluacion).filter((n) => n > 0);

    return {
      eval: avg(evals),
      load: sum(filtered.map((r) => r.carga)),
      cog: sum(filtered.map((r) => r.cargaCog)),
      tasks: filtered.length,
      tiempo: sum(filtered.map((r) => r.tiempo)),
      intensidad: avg(filtered.map((r) => r.intensidad).filter((n) => n > 0)),
      exigCog: avg(filtered.map((r) => r.exigCog).filter((n) => n > 0)),
      demandaCog: avg(
        filtered.map((r) => r.demandaCog).filter((n) => n > 0)
      ),
      evaluadas: evals.length,
      sesiones: new Set(filtered.map((r) => `${r.micro}-${r.md}`)).size,
      diversidad: new Set(filtered.map((r) => r.tipo).filter(Boolean)).size,
      jugadores: avg(filtered.map((r) => r.nJug).filter((n) => n > 0)),
    };
  }, [filtered]);

  const avgLoadPerTask = metrics.tasks ? metrics.load / metrics.tasks : 0;
  const avgCogPerTask = metrics.tasks ? metrics.cog / metrics.tasks : 0;
  const avgTimePerTask = metrics.tasks ? metrics.tiempo / metrics.tasks : 0;
  const cogRatio = metrics.load ? metrics.cog / metrics.load : 0;

  /** Per-microcycle aggregates over the FULL dataset (for trends & rail) */
  const microStats = useMemo(() => {
    return micros.map((m) => {
      const set = rows.filter((r) => r.micro === m);
      const noComp = set.filter((r) => !isCompeticion(r.fase));
      const evals = set.map((r) => r.evaluacion).filter((n) => n > 0);
      const fecha = set.map((r) => parseFecha(r.fecha)).filter(Boolean) as Date[];

      return {
        micro: m,
        label: `M${m}`,
        rival: set.find((r) => r.rival)?.rival || "",
        tareas: set.length,
        tiempo: sum(set.map((r) => r.tiempo)),
        eval: avg(evals),
        load: sum(set.map((r) => r.carga)),
        cog: sum(set.map((r) => r.cargaCog)),
        intensidad: avg(set.map((r) => r.intensidad).filter((n) => n > 0)),
        diversidad: new Set(noComp.map((r) => r.tipo).filter(Boolean)).size,
        desde: fecha.length
          ? new Date(Math.min(...fecha.map((d) => d.getTime())))
          : null,
        hasta: fecha.length
          ? new Date(Math.max(...fecha.map((d) => d.getTime())))
          : null,
      };
    });
  }, [micros, rows]);

  const maxMicroLoad = Math.max(...microStats.map((m) => m.load), 1);

  /** Delta of current micro vs previous one */
  const microDelta = useMemo(() => {
    if (micro === "ALL") return null;

    const idx = microStats.findIndex((m) => String(m.micro) === micro);

    if (idx <= 0) return null;

    const cur = microStats[idx];
    const prev = microStats[idx - 1];

    return {
      prev,
      eval: +(cur.eval - prev.eval).toFixed(1),
      load: cur.load - prev.load,
      cog: cur.cog - prev.cog,
      tareas: cur.tareas - prev.tareas,
      tiempo: cur.tiempo - prev.tiempo,
    };
  }, [micro, microStats]);

  /* ---------------- MD distribution ---------------- */

  const mdData = useMemo(() => {
    return mdOrder.map((md) => {
      const set = filtered.filter((r) => r.md === md);
      const totalLoad = sum(filtered.map((r) => r.carga)) || 1;

      return {
        md,
        tareas: set.length,
        carga: sum(set.map((r) => r.carga)),
        cargaCog: sum(set.map((r) => r.cargaCog)),
        tiempo: sum(set.map((r) => r.tiempo)),
        intensidad: avg(set.map((r) => r.intensidad).filter((n) => n > 0)),
        exigCog: avg(set.map((r) => r.exigCog).filter((n) => n > 0)),
        eval: avg(set.map((r) => r.evaluacion).filter((n) => n > 0)),
        pctCarga: +((sum(set.map((r) => r.carga)) / totalLoad) * 100).toFixed(1),
      };
    });
  }, [filtered, mdOrder]);

  const peakMD = useMemo(
    () =>
      mdData.reduce(
        (best, cur) => (cur.carga > best.carga ? cur : best),
        mdData[0] ?? { md: "—", carga: 0, pctCarga: 0 }
      ),
    [mdData]
  );

  /* ---------------- heatmap micro x MD ---------------- */

  const heatmap = useMemo(() => {
    const cells = micros.map((m) => ({
      micro: m,
      rival: rows.find((r) => r.micro === m && r.rival)?.rival || "",
      values: mdOrder.map((md) => {
        const set = rows.filter((r) => r.micro === m && r.md === md);

        return {
          md,
          carga: sum(set.map((r) => r.carga)),
          cog: sum(set.map((r) => r.cargaCog)),
          tiempo: sum(set.map((r) => r.tiempo)),
          tareas: set.length,
          eval: avg(set.map((r) => r.evaluacion).filter((n) => n > 0)),
        };
      }),
    }));

    const max = Math.max(
      ...cells.flatMap((c) => c.values.map((v) => v.carga)),
      1
    );

    return { cells, max };
  }, [micros, mdOrder, rows]);

  /* ---------------- trends ---------------- */

  const trendData = useMemo(
    () =>
      microStats.map((m) => ({
        micro: m.label,
        value: m.eval,
        rival: m.rival,
        load: m.load,
        cog: m.cog,
        tareas: m.tareas,
      })),
    [microStats]
  );

  const evalMean = avg(trendData.map((d) => d.value).filter((n) => n > 0));

  const compareData = useMemo(
    () =>
      microStats.map((m) => ({
        micro: m.label,
        eval: m.eval,
        load: m.load,
        cog: m.cog,
        tiempo: m.tiempo,
        intensidad: m.intensidad,
      })),
    [microStats]
  );

  /* ---------------- scatter ---------------- */

  const scatterData = useMemo(
    () =>
      work
        .filter((r) => r.carga > 0 && r.cargaCog > 0 && r.evaluacion > 0)
        .map((r) => ({
          carga: r.carga,
          cargaCog: r.cargaCog,
          eval: r.evaluacion,
          tipo: r.tipo,
          tarea: r.tarea,
          md: r.md,
          micro: r.micro,
          fill: getEvalColor(r.evaluacion),
        })),
    [work]
  );

  /* ---------------- radar profile ---------------- */

  const radarData = useMemo(() => {
    const scale = (value: number, max: number) =>
      +Math.min((value / (max || 1)) * 10, 10).toFixed(1);

    const maxLoadTask = Math.max(...rows.map((r) => r.carga), 1);
    const maxCogTask = Math.max(...rows.map((r) => r.cargaCog), 1);
    const maxDiversidad = Math.max(
      ...microStats.map((m) => m.diversidad),
      1
    );

    return [
      { metric: "Evaluación", value: metrics.eval, raw: metrics.eval },
      { metric: "Intensidad", value: metrics.intensidad, raw: metrics.intensidad },
      { metric: "Exig. Cognitiva", value: metrics.exigCog, raw: metrics.exigCog },
      {
        metric: "Carga/Tarea",
        value: scale(avgLoadPerTask, maxLoadTask),
        raw: Math.round(avgLoadPerTask),
      },
      {
        metric: "Cog/Tarea",
        value: scale(avgCogPerTask, maxCogTask),
        raw: Math.round(avgCogPerTask),
      },
      {
        metric: "Diversidad",
        value: scale(metrics.diversidad, maxDiversidad),
        raw: metrics.diversidad,
      },
    ];
  }, [
    rows,
    metrics,
    avgLoadPerTask,
    avgCogPerTask,
    microStats,
  ]);

  /* ---------------- grouped aggregations ---------------- */

  const groupBy = (key: keyof Row, source: Row[] = work) => {
    const grouped: Record<
      string,
      {
        tareas: number;
        tiempo: number;
        carga: number;
        cargaCog: number;
        ponderada: number;
        evals: number[];
        intens: number[];
      }
    > = {};

    source.forEach((r) => {
      const raw = String(r[key] ?? "").trim();

      if (!raw) return;

      if (!grouped[raw]) {
        grouped[raw] = {
          tareas: 0,
          tiempo: 0,
          carga: 0,
          cargaCog: 0,
          ponderada: 0,
          evals: [],
          intens: [],
        };
      }

      const g = grouped[raw];

      g.tareas += 1;
      g.tiempo += r.tiempo;
      g.carga += r.carga;
      g.cargaCog += r.cargaCog;
      g.ponderada += r.carga * r.cargaCog;

      if (r.evaluacion > 0) g.evals.push(r.evaluacion);
      if (r.intensidad > 0) g.intens.push(r.intensidad);
    });

    const totalTareas = source.length || 1;
    const totalTiempo = sum(source.map((r) => r.tiempo)) || 1;

    return Object.entries(grouped)
      .map(([name, v]) => ({
        name,
        tareas: v.tareas,
        tiempo: Math.round(v.tiempo),
        carga: Math.round(v.carga),
        cargaCog: Math.round(v.cargaCog),
        ponderada: Math.round(v.ponderada),
        eval: avg(v.evals),
        intensidad: avg(v.intens),
        pctTareas: +((v.tareas / totalTareas) * 100).toFixed(1),
        pctTiempo: +((v.tiempo / totalTiempo) * 100).toFixed(1),
      }))
      .sort((a, b) => b.tareas - a.tareas);
  };

  const contenidoPrincipalMetrics = useMemo(
    () => groupBy("contenidoPrincipal"),
    [work]
  );

  const contenidoSecundarioMetrics = useMemo(
    () => groupBy("contenidoSecundario"),
    [work]
  );

  const faseMetrics = useMemo(() => groupBy("fase", filtered), [filtered]);

  const tipoMetrics = useMemo(() => groupBy("tipo"), [work]);

  const formatoMetrics = useMemo(() => groupBy("formato"), [work]);

  const analisisMetrics = useMemo(() => groupBy("analisisPost"), [work]);

  const sortedByMetric = (
    data: ReturnType<typeof groupBy>,
    key: ContentMetricKey
  ) => [...data].sort((a, b) => (b as any)[key] - (a as any)[key]);

  /* ---------------- cognitive ---------------- */

  const cognitiveRadar = useMemo(() => {
    const src = work.filter((r) => r.demandaCog > 0 || r.normativa > 0);

    return [
      {
        metric: "Normativa",
        value: avg(src.map((r) => r.normativa).filter((n) => n > 0)) * 2,
        raw: avg(src.map((r) => r.normativa).filter((n) => n > 0)),
      },
      {
        metric: "Incertidumbre",
        value: avg(src.map((r) => r.incertidumbre).filter((n) => n > 0)) * 2,
        raw: avg(src.map((r) => r.incertidumbre).filter((n) => n > 0)),
      },
      {
        metric: "Dificultad",
        value: avg(src.map((r) => r.familiaridad).filter((n) => n > 0)) * 2,
        raw: avg(src.map((r) => r.familiaridad).filter((n) => n > 0)),
      },
      {
        metric: "Motivación",
        value: avg(src.map((r) => r.motivacion).filter((n) => n > 0)) * 2,
        raw: avg(src.map((r) => r.motivacion).filter((n) => n > 0)),
      },
      {
        metric: "Exigencia",
        value: avg(src.map((r) => r.exigCog).filter((n) => n > 0)),
        raw: avg(src.map((r) => r.exigCog).filter((n) => n > 0)),
      },
      {
        metric: "Demanda",
        value: avg(src.map((r) => r.demandaCog).filter((n) => n > 0)),
        raw: avg(src.map((r) => r.demandaCog).filter((n) => n > 0)),
      },
    ];
  }, [work]);

  const cognitiveByMD = useMemo(
    () =>
      mdOrder.map((md) => {
        const set = work.filter((r) => r.md === md);

        return {
          md,
          normativa: avg(set.map((r) => r.normativa).filter((n) => n > 0)),
          incertidumbre: avg(
            set.map((r) => r.incertidumbre).filter((n) => n > 0)
          ),
          familiaridad: avg(
            set.map((r) => r.familiaridad).filter((n) => n > 0)
          ),
          motivacion: avg(set.map((r) => r.motivacion).filter((n) => n > 0)),
          demandaCog: avg(set.map((r) => r.demandaCog).filter((n) => n > 0)),
        };
      }),
    [work, mdOrder]
  );

  const cognitiveByTipo = useMemo(() => {
    const grouped: Record<string, Row[]> = {};

    work.forEach((r) => {
      const key = r.tipo || "—";

      if (!grouped[key]) grouped[key] = [];

      grouped[key].push(r);
    });

    return Object.entries(grouped)
      .map(([tipo, set]) => ({
        tipo,
        tareas: set.length,
        normativa: avg(set.map((r) => r.normativa).filter((n) => n > 0)),
        incertidumbre: avg(
          set.map((r) => r.incertidumbre).filter((n) => n > 0)
        ),
        familiaridad: avg(set.map((r) => r.familiaridad).filter((n) => n > 0)),
        motivacion: avg(set.map((r) => r.motivacion).filter((n) => n > 0)),
        demandaCog: avg(set.map((r) => r.demandaCog).filter((n) => n > 0)),
        eval: avg(set.map((r) => r.evaluacion).filter((n) => n > 0)),
      }))
      .sort((a, b) => b.demandaCog - a.demandaCog);
  }, [work]);

  const cogVsEval = useMemo(
    () =>
      work
        .filter((r) => r.demandaCog > 0 && r.evaluacion > 0)
        .map((r) => ({
          demandaCog: r.demandaCog,
          eval: r.evaluacion,
          tiempo: r.tiempo,
          tarea: r.tarea,
          tipo: r.tipo,
          fill: getEvalColor(r.evaluacion),
        })),
    [work]
  );

  /* ---------------- intensity histogram ---------------- */

  const intensityHistogram = useMemo(() => {
    const buckets: Record<number, number> = {};

    work.forEach((r) => {
      if (r.intensidad <= 0) return;

      const b = Math.round(r.intensidad);

      buckets[b] = (buckets[b] || 0) + 1;
    });

    return Object.entries(buckets)
      .map(([k, v]) => ({ intensidad: Number(k), tareas: v }))
      .sort((a, b) => a.intensidad - b.intensidad);
  }, [work]);

  /* ---------------- best / worst tasks ---------------- */

  const rankedTasks = useMemo(
    () =>
      work
        .filter((r) => r.evaluacion > 0)
        .sort((a, b) => b.evaluacion - a.evaluacion),
    [work]
  );

  const topTasks = rankedTasks.slice(0, 5);
  const bottomTasks = [...rankedTasks].reverse().slice(0, 5);

  /* ---------------- task table ---------------- */

  const sortedTasks = useMemo(() => {
    const data = [...filtered];

    data.sort((a, b) => {
      const av = a[sortKey];
      const bv = b[sortKey];

      if (typeof av === "number" && typeof bv === "number") {
        return sortDir === "asc" ? av - bv : bv - av;
      }

      return sortDir === "asc"
        ? String(av).localeCompare(String(bv))
        : String(bv).localeCompare(String(av));
    });

    return data;
  }, [filtered, sortKey, sortDir]);

  const toggleSort = (key: keyof Row) => {
    if (sortKey === key) {
      setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    } else {
      setSortKey(key);
      setSortDir("desc");
    }
  };

  const exportCSV = () => {
    const csv = Papa.unparse(
      sortedTasks.map((r) => ({
        Micro: r.micro,
        Rival: r.rival,
        Dia: r.dia,
        MD: r.md,
        Fecha: r.fecha,
        Tarea: r.tarea,
        Tipo: r.tipo,
        Fase: r.fase,
        "Contenido Principal": r.contenidoPrincipal,
        "Contenido Secundario": r.contenidoSecundario,
        Formato: r.formato,
        Tiempo: r.tiempo,
        Intensidad: r.intensidad,
        "Carga Fisica": r.carga,
        "Exig. Cognitiva": r.exigCog,
        "Carga Cognitiva": r.cargaCog,
        "Demanda Cognitiva": r.demandaCog,
        Evaluacion: r.evaluacion,
        "Analisis Post": r.analisisPost,
      }))
    );

    const blob = new Blob([`﻿${csv}`], {
      type: "text/csv;charset=utf-8;",
    });

    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");

    a.href = url;
    a.download = `microciclos_${micro === "ALL" ? "todos" : micro}.csv`;
    a.click();

    URL.revokeObjectURL(url);
  };

  /* ---------------- insights ---------------- */

  const insights = useMemo(() => {
    const out: { icon: any; text: string; tone: string }[] = [];

    if (!filtered.length) return out;

    if (peakMD && peakMD.carga > 0) {
      out.push({
        icon: Flame,
        tone: "text-[#C8A96B]",
        text: `${peakMD.md} concentra el ${peakMD.pctCarga}% de la carga física del periodo.`,
      });
    }

    const bestTipo = [...tipoMetrics]
      .filter((t) => t.eval > 0 && t.tareas >= 2)
      .sort((a, b) => b.eval - a.eval)[0];

    if (bestTipo) {
      out.push({
        icon: Star,
        tone: "text-emerald-400",
        text: `"${bestTipo.name}" es el tipo de tarea mejor valorado (${bestTipo.eval} de media en ${bestTipo.tareas} tareas).`,
      });
    }

    const worstTipo = [...tipoMetrics]
      .filter((t) => t.eval > 0 && t.tareas >= 2)
      .sort((a, b) => a.eval - b.eval)[0];

    if (worstTipo && bestTipo && worstTipo.name !== bestTipo.name) {
      out.push({
        icon: Target,
        tone: "text-rose-400",
        text: `"${worstTipo.name}" es el peor valorado (${worstTipo.eval}) — revisar diseño o momento de aplicación.`,
      });
    }

    out.push({
      icon: Brain,
      tone: "text-violet-400",
      text: `Ratio cognitivo/físico de ${cogRatio.toFixed(
        2
      )} — ${cogRatio >= 0.7 ? "sesgo cognitivo alto" : cogRatio >= 0.5 ? "equilibrio adecuado" : "predominio del componente físico"}.`,
    });

    const topContenido = contenidoPrincipalMetrics[0];

    if (topContenido) {
      out.push({
        icon: Layers,
        tone: "text-sky-400",
        text: `El contenido más trabajado es "${topContenido.name}" (${topContenido.tareas} tareas · ${topContenido.pctTareas}% del total).`,
      });
    }

    if (microDelta) {
      const arrow = microDelta.eval > 0 ? "sube" : microDelta.eval < 0 ? "baja" : "se mantiene";

      out.push({
        icon: Activity,
        tone: "text-amber-400",
        text: `Respecto a M${microDelta.prev.micro}, la evaluación ${arrow} ${Math.abs(
          microDelta.eval
        )} pts y la carga varía ${microDelta.load >= 0 ? "+" : ""}${fmtInt(
          microDelta.load
        )}.`,
      });
    }

    const sinEval = filtered.length - metrics.evaluadas;

    if (sinEval > 0) {
      out.push({
        icon: ListChecks,
        tone: "text-white/60",
        text: `${sinEval} tarea${sinEval === 1 ? "" : "s"} sin evaluación registrada.`,
      });
    }

    return out;
  }, [
    filtered,
    peakMD,
    tipoMetrics,
    cogRatio,
    contenidoPrincipalMetrics,
    microDelta,
    metrics.evaluadas,
  ]);

  /* ---------------- options ---------------- */

  const microOptions = useMemo(
    () =>
      micros.map((m) => ({
        micro: m,
        rival: rows.find((r) => r.micro === m && r.rival)?.rival || "",
      })),
    [micros, rows]
  );

  const uniqueSorted = (key: keyof Row) =>
    [
      ...new Set(rows.map((r) => String(r[key] ?? "").trim()).filter(Boolean)),
    ].sort();

  const contenidoPrincipalOptions = useMemo(
    () => uniqueSorted("contenidoPrincipal"),
    [rows]
  );

  const tipoOptions = useMemo(() => uniqueSorted("tipo"), [rows]);
  const faseOptions = useMemo(() => uniqueSorted("fase"), [rows]);

  const selectedMicroStat =
    micro === "ALL"
      ? null
      : microStats.find((m) => String(m.micro) === micro) ?? null;

  const yAxisWidth = isMobile ? 120 : isNarrow ? 160 : 220;

  const tipoAxisWidth = isMobile ? 140 : isNarrow ? 170 : 220;

  const formatoAxisWidth = isMobile ? 96 : 120;

  /* Los altos se calculan a partir de las líneas que ocupa la etiqueta
     más larga, para que dos categorías nunca se solapen. */

  const taskChartHeight = categoryChartHeight(tipoMetrics, tipoAxisWidth, {
    min: 420,
    extra: 60,
  });

  const contenidoPrincipalHeight = categoryChartHeight(
    contenidoPrincipalMetrics,
    yAxisWidth,
    { min: 380 }
  );

  const contenidoSecundarioTop = sortedByMetric(
    contenidoSecundarioMetrics,
    contentMetric
  ).slice(0, 15);

  const contenidoSecundarioHeight = categoryChartHeight(
    contenidoSecundarioTop,
    yAxisWidth,
    { min: 380 }
  );

  const formatoTop = formatoMetrics.slice(0, 12);

  const formatoHeight = categoryChartHeight(formatoTop, formatoAxisWidth, {
    min: 380,
    maxLines: 2,
  });

  const analisisHeight = categoryChartHeight(analisisMetrics, yAxisWidth, {
    min: 320,
    extra: 40,
  });

  const microAxisProps = categoryAxisProps(trendData.length, isMobile);

  const polarTick = makePolarTick(isMobile ? 10 : 12);

  /* ------------------------------------------------------------------ */

  return (
    <main className="min-h-screen bg-[#0B0F14] text-white">
      <div className="flex">
        <Sidebar />

        <div className="flex-1 min-w-0">
          <Topbar />

          <section className="px-4 sm:px-8 pb-12 pt-6 sm:pt-10">
            {/* ---------------- Header ---------------- */}

            <div className="mb-6">
              <p className="text-xs uppercase tracking-[0.35em] text-[#C8A96B]">
                RMCF CASTILLA · METODOLOGÍA
              </p>

              <div className="mt-4 flex flex-wrap items-center gap-3 sm:gap-5">
                <h1 className="text-3xl sm:text-4xl font-semibold tracking-tight">
                  Microciclos
                </h1>

                {selectedMicroStat && (
                  <span className="rounded-full border border-[#C8A96B]/40 bg-[#C8A96B]/10 px-3 py-1 text-xs sm:text-sm text-[#C8A96B]">
                    M{selectedMicroStat.micro}
                    {selectedMicroStat.rival
                      ? ` · ${selectedMicroStat.rival}`
                      : ""}
                  </span>
                )}

                {selectedMicroStat?.desde && (
                  <span className="inline-flex items-center gap-1.5 text-xs text-white/50">
                    <CalendarDays className="h-3.5 w-3.5" />
                    {selectedMicroStat.desde.toLocaleDateString("es-ES", {
                      day: "2-digit",
                      month: "short",
                    })}
                    {" — "}
                    {selectedMicroStat.hasta?.toLocaleDateString("es-ES", {
                      day: "2-digit",
                      month: "short",
                    })}
                  </span>
                )}

                <div className="hidden sm:block h-px flex-1 bg-gradient-to-r from-[#C8A96B]/30 via-white/10 to-transparent" />
              </div>
            </div>

            {/* ---------------- Micro rail ---------------- */}

            {!loading && microStats.length > 0 && (
              <div className="mb-6 -mx-4 sm:mx-0 px-4 sm:px-0">
                <div className="flex gap-3 overflow-x-auto pb-3 scrollbar-thin">
                  <button
                    onClick={() => setMicro("ALL")}
                    className={`shrink-0 w-[150px] rounded-2xl border p-4 text-left transition ${
                      micro === "ALL"
                        ? "border-[#C8A96B] bg-[#C8A96B]/10"
                        : "border-white/10 bg-white/[0.03] hover:border-white/25"
                    }`}
                  >
                    <p className="text-xs text-white/50">Temporada</p>

                    <p className="mt-1 text-lg font-semibold">Todos</p>

                    <p className="mt-3 text-xs text-white/50">
                      {rows.length} tareas
                    </p>

                    <div className="mt-2 h-1.5 rounded-full bg-white/10">
                      <div
                        className="h-full rounded-full bg-[#C8A96B]"
                        style={{ width: "100%" }}
                      />
                    </div>
                  </button>

                  {microStats.map((m) => {
                    const active = String(m.micro) === micro;

                    return (
                      <button
                        key={m.micro}
                        onClick={() =>
                          setMicro(active ? "ALL" : String(m.micro))
                        }
                        className={`shrink-0 w-[190px] rounded-2xl border p-4 text-left transition ${
                          active
                            ? "border-[#C8A96B] bg-[#C8A96B]/10"
                            : "border-white/10 bg-white/[0.03] hover:border-white/25"
                        }`}
                      >
                        <div className="flex items-center justify-between">
                          <p className="text-xs text-white/50">
                            Micro {m.micro}
                          </p>

                          <span
                            className="rounded-md px-1.5 py-0.5 text-[11px] font-bold"
                            style={{
                              background: `${getEvalColor(m.eval)}22`,
                              color: chipInk(getEvalColor(m.eval)),
                            }}
                          >
                            {m.eval || "—"}
                          </span>
                        </div>

                        <p
                          className="mt-1 truncate text-sm font-semibold"
                          title={m.rival}
                        >
                          {m.rival || "—"}
                        </p>

                        <p className="mt-3 text-[11px] text-white/50">
                          {m.tareas} tareas · {fmtMin(m.tiempo)}
                        </p>

                        <div className="mt-2 h-1.5 rounded-full bg-white/10">
                          <div
                            className="h-full rounded-full bg-[#C8A96B]"
                            style={{
                              width: `${(m.load / maxMicroLoad) * 100}%`,
                            }}
                          />
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>
            )}

            {/* ---------------- Filters ---------------- */}

            <div className="rounded-[24px] sm:rounded-[32px] border border-white/10 bg-gradient-to-b from-white/[0.05] to-white/[0.02] p-5 sm:p-7 shadow-[0_12px_40px_rgba(0,0,0,0.35)] backdrop-blur-sm">
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-3">
                <Select
                  value={micro}
                  onChange={setMicro}
                  label="Microciclo"
                  options={[
                    { value: "ALL", label: "Todos los microciclos" },
                    ...microOptions.map((m) => ({
                      value: String(m.micro),
                      label: `Micro ${m.micro}${m.rival ? ` · ${m.rival}` : ""}`,
                    })),
                  ]}
                />

                <Select
                  value={mdFilter}
                  onChange={setMdFilter}
                  label="Día (MD)"
                  options={[
                    { value: "ALL", label: "Todos los días" },
                    ...mdOrder.map((md) => ({ value: md, label: md })),
                  ]}
                />

                <Select
                  value={tipoFilter}
                  onChange={setTipoFilter}
                  label="Tipo de tarea"
                  options={[
                    { value: "ALL", label: "Todos los tipos" },
                    ...tipoOptions.map((t) => ({ value: t, label: t })),
                  ]}
                />

                <Select
                  value={contenidoPrincipalFilter}
                  onChange={setContenidoPrincipalFilter}
                  label="Contenido principal"
                  options={[
                    { value: "ALL", label: "Todos los contenidos" },
                    ...contenidoPrincipalOptions.map((c) => ({
                      value: c,
                      label: c,
                    })),
                  ]}
                />

                <Select
                  value={faseFilter}
                  onChange={setFaseFilter}
                  label="Fase"
                  options={[
                    { value: "ALL", label: "Todas las fases" },
                    ...faseOptions.map((f) => ({ value: f, label: f })),
                  ]}
                />

                <Select
                  value={evaluacionFilter}
                  onChange={setEvaluacionFilter}
                  label="Evaluación"
                  options={[
                    { value: "ALL", label: "Todas las evaluaciones" },
                    ...[5, 6, 7, 8, 9].map((n) => ({
                      value: String(n),
                      label: `Evaluación ≥ ${n}`,
                    })),
                  ]}
                />
              </div>

              <div className="mt-4 flex flex-col sm:flex-row gap-3">
                <div className="relative flex-1">
                  <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-white/35" />

                  <input
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    placeholder="Buscar tarea, contenido, formato, análisis…"
                    className="w-full rounded-2xl border border-white/10 bg-[#11161C] py-3 pl-10 pr-4 text-sm outline-none placeholder:text-white/30 focus:border-[#C8A96B]/50"
                  />
                </div>

                <button
                  onClick={() => setExcludeComp((v) => !v)}
                  className={`rounded-2xl border px-4 py-3 text-sm transition ${
                    excludeComp
                      ? "border-[#C8A96B]/40 bg-[#C8A96B]/10 text-[#C8A96B]"
                      : "border-white/10 bg-[#11161C] text-white/60 hover:border-white/25"
                  }`}
                  title="Excluye las tareas de fase Competición de los análisis metodológicos"
                >
                  {excludeComp ? "Competición excluida" : "Competición incluida"}
                </button>
              </div>

              {activeFilters > 0 && (
                <div className="mt-4 flex flex-wrap gap-2">
                  {micro !== "ALL" && (
                    <FilterChip
                      color="gold"
                      onClear={() => setMicro("ALL")}
                      label={`Micro ${micro}`}
                    />
                  )}

                  {mdFilter !== "ALL" && (
                    <FilterChip
                      color="orange"
                      onClear={() => setMdFilter("ALL")}
                      label={mdFilter}
                    />
                  )}

                  {tipoFilter !== "ALL" && (
                    <FilterChip
                      color="blue"
                      onClear={() => setTipoFilter("ALL")}
                      label={`Tipo: ${tipoFilter}`}
                    />
                  )}

                  {contenidoPrincipalFilter !== "ALL" && (
                    <FilterChip
                      color="purple"
                      onClear={() => setContenidoPrincipalFilter("ALL")}
                      label={`Contenido: ${contenidoPrincipalFilter}`}
                    />
                  )}

                  {faseFilter !== "ALL" && (
                    <FilterChip
                      color="green"
                      onClear={() => setFaseFilter("ALL")}
                      label={`Fase: ${faseFilter}`}
                    />
                  )}

                  {evaluacionFilter !== "ALL" && (
                    <FilterChip
                      color="gold"
                      onClear={() => setEvaluacionFilter("ALL")}
                      label={`Eval ≥ ${evaluacionFilter}`}
                    />
                  )}

                  {search && (
                    <FilterChip
                      color="blue"
                      onClear={() => setSearch("")}
                      label={`"${search}"`}
                    />
                  )}

                  <button
                    onClick={clearAll}
                    className="rounded-full border border-white/10 px-3 py-1.5 text-xs text-white/60 hover:bg-white/10"
                  >
                    Limpiar todo
                  </button>
                </div>
              )}

              {/* KPIs */}

              <div className="mt-7 grid grid-cols-2 md:grid-cols-3 xl:grid-cols-6 gap-3 sm:gap-4">
                <StatCard
                  icon={ListChecks}
                  title="Tareas"
                  value={fmtInt(metrics.tasks)}
                  hint={`${metrics.sesiones} sesiones`}
                  delta={microDelta?.tareas}
                />

                <StatCard
                  icon={Clock}
                  title="Tiempo total"
                  value={fmtMin(metrics.tiempo)}
                  hint={`${Math.round(avgTimePerTask)}' por tarea`}
                  delta={microDelta?.tiempo}
                  deltaSuffix="'"
                />

                <StatCard
                  icon={Star}
                  title="Evaluación media"
                  value={metrics.eval || "—"}
                  hint={`${metrics.evaluadas} evaluadas`}
                  accent={getEvalColor(metrics.eval)}
                  delta={microDelta?.eval}
                  decimals={1}
                />

                <StatCard
                  icon={Flame}
                  title="Carga física"
                  value={fmtInt(metrics.load)}
                  hint={`${Math.round(avgLoadPerTask)} / tarea`}
                  accent={COLORS.blue}
                  delta={microDelta?.load}
                />

                <StatCard
                  icon={Brain}
                  title="Carga cognitiva"
                  value={fmtInt(metrics.cog)}
                  hint={`${Math.round(avgCogPerTask)} / tarea`}
                  accent={COLORS.purple}
                  delta={microDelta?.cog}
                />

                <StatCard
                  icon={Gauge}
                  title="Ratio Cog/Fís"
                  value={cogRatio.toFixed(2)}
                  hint={`Int. media ${metrics.intensidad}`}
                  accent={COLORS.green}
                />
              </div>
            </div>

            {/* ---------------- Tabs ---------------- */}

            <div className="mt-8 flex gap-2 overflow-x-auto pb-1">
              {TABS.map((t) => {
                const Icon = t.icon;
                const active = tab === t.key;

                return (
                  <button
                    key={t.key}
                    onClick={() => setTab(t.key)}
                    className={`inline-flex shrink-0 items-center gap-2 rounded-2xl border px-4 py-2.5 text-sm transition ${
                      active
                        ? "border-[#C8A96B] bg-[#C8A96B] text-black font-semibold"
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
                    className="h-[380px] animate-pulse rounded-3xl border border-white/10 bg-white/[0.03]"
                  />
                ))}
              </div>
            )}

            {!loading && filtered.length === 0 && (
              <div className="mt-10 rounded-3xl border border-white/10 bg-white/[0.03] p-12 text-center">
                <p className="text-lg font-semibold">Sin resultados</p>

                <p className="mt-2 text-sm text-white/50">
                  Ningún registro coincide con los filtros seleccionados.
                </p>

                <button
                  onClick={clearAll}
                  className="mt-5 rounded-2xl bg-[#C8A96B] px-5 py-2.5 text-sm font-semibold text-black"
                >
                  Limpiar filtros
                </button>
              </div>
            )}

            {/* ================= RESUMEN ================= */}

            {!loading && filtered.length > 0 && tab === "resumen" && (
              <div className="mt-8 space-y-6">
                {insights.length > 0 && (
                  <div className="rounded-3xl border border-white/10 bg-gradient-to-br from-[#C8A96B]/[0.07] to-white/[0.02] p-6 sm:p-7">
                    <h2 className="mb-5 flex items-center gap-2 text-lg font-semibold">
                      <Sparkles className="h-5 w-5 text-[#C8A96B]" />
                      Lecturas del periodo
                    </h2>

                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-x-8 gap-y-3">
                      {insights.map((i, idx) => {
                        const Icon = i.icon;

                        return (
                          <div key={idx} className="flex items-start gap-3">
                            <Icon
                              className={`mt-0.5 h-4 w-4 shrink-0 ${i.tone}`}
                            />

                            <p className="text-sm leading-relaxed text-white/75">
                              {i.text}
                            </p>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}

                <div className="grid grid-cols-1 xl:grid-cols-2 gap-5 sm:gap-6">
                  <Panel
                    title="Distribución de carga en el microciclo"
                    subtitle="Carga física y cognitiva por día, con intensidad media"
                  >
                    <Chart>
                      <ComposedChart
                        data={mdData}
                        margin={{ top: 10, right: 10, left: 0, bottom: 30 }}
                      >
                        <CartesianGrid stroke="#1E232A" vertical={false} />

                        <XAxis
                          dataKey="md"
                          tick={{ fill: "#94A3B8", fontSize: 12 }}
                          axisLine={false}
                          tickLine={false}
                        />

                        <YAxis
                          yAxisId="left"
                          tick={{ fill: "#94A3B8", fontSize: 11 }}
                          axisLine={false}
                          tickLine={false}
                        />

                        <YAxis
                          yAxisId="right"
                          orientation="right"
                          domain={[0, 10]}
                          tick={{ fill: COLORS.purple, fontSize: 11 }}
                          axisLine={false}
                          tickLine={false}
                        />

                        <Tooltip content={<DarkTooltip />} />

                        <Legend
                          verticalAlign="bottom"
                          wrapperStyle={{
                            fontSize: 11,
                            color: "#CBD5E1",
                            paddingTop: 16,
                          }}
                        />

                        <Bar
                          yAxisId="left"
                          dataKey="carga"
                          name="Carga física"
                          fill={COLORS.gold}
                          radius={[8, 8, 0, 0]}
                        />

                        <Bar
                          yAxisId="left"
                          dataKey="cargaCog"
                          name="Carga cognitiva"
                          fill={COLORS.blue}
                          radius={[8, 8, 0, 0]}
                        />

                        <Line
                          yAxisId="right"
                          type="monotone"
                          dataKey="intensidad"
                          name="Intensidad"
                          stroke={COLORS.purple}
                          strokeWidth={3}
                          dot={{ r: 4, fill: COLORS.purple }}
                          activeDot={{ r: 6 }}
                        />
                      </ComposedChart>
                    </Chart>
                  </Panel>

                  <Panel
                    title="Perfil del microciclo"
                    subtitle="Todas las dimensiones normalizadas a escala 0-10"
                  >
                    <Chart>
                      <RadarChart
                        cx="50%"
                        cy="50%"
                        outerRadius={isMobile ? "58%" : "72%"}
                        data={radarData}
                      >
                        <PolarGrid stroke="rgba(255,255,255,.12)" />

                        <PolarAngleAxis dataKey="metric" tick={polarTick} />

                        <PolarRadiusAxis
                          domain={[0, 10]}
                          tick={false}
                          axisLine={false}
                        />

                        <Tooltip
                          content={
                            <DarkTooltip
                              rows={[["Valor real", "raw"]]}
                            />
                          }
                        />

                        <Radar
                          name="Perfil"
                          dataKey="value"
                          stroke={COLORS.gold}
                          strokeWidth={3}
                          fill={COLORS.gold}
                          fillOpacity={0.35}
                        />
                      </RadarChart>
                    </Chart>

                    <div className="mt-4 grid grid-cols-3 gap-2">
                      {radarData.map((d) => (
                        <div
                          key={d.metric}
                          className="rounded-xl border border-white/5 bg-white/[0.03] px-3 py-2"
                        >
                          <p className="truncate text-[10px] uppercase tracking-wider text-white/40">
                            {d.metric}
                          </p>

                          <p className="text-sm font-semibold text-[#C8A96B]">
                            {d.raw}
                          </p>
                        </div>
                      ))}
                    </div>
                  </Panel>

                  <Panel
                    title="Tendencia de evaluación por microciclo"
                    subtitle={`Media de la temporada: ${evalMean}`}
                  >
                    <Chart>
                      <ComposedChart data={trendData}>
                        <defs>
                          <linearGradient
                            id="evalGrad"
                            x1="0"
                            y1="0"
                            x2="0"
                            y2="1"
                          >
                            <stop
                              offset="0%"
                              stopColor={COLORS.gold}
                              stopOpacity={0.45}
                            />
                            <stop
                              offset="100%"
                              stopColor={COLORS.gold}
                              stopOpacity={0}
                            />
                          </linearGradient>
                        </defs>

                        <CartesianGrid stroke="#1E232A" vertical={false} />

                        <XAxis dataKey="micro" {...microAxisProps} />

                        <YAxis
                          domain={[0, 10]}
                          tick={{ fill: "#94A3B8", fontSize: 11 }}
                          axisLine={false}
                          tickLine={false}
                        />

                        <Tooltip
                          content={
                            <DarkTooltip
                              rows={[
                                ["Rival", "rival"],
                                ["Tareas", "tareas"],
                                ["Carga", "load"],
                              ]}
                            />
                          }
                        />

                        <ReferenceLine
                          y={evalMean}
                          stroke="rgba(255,255,255,.35)"
                          strokeDasharray="4 4"
                        />

                        <Area
                          dataKey="value"
                          name="Evaluación"
                          stroke={COLORS.gold}
                          strokeWidth={3}
                          fill="url(#evalGrad)"
                          dot={{ r: 4, fill: COLORS.gold }}
                          activeDot={{ r: 7 }}
                        />
                      </ComposedChart>
                    </Chart>
                  </Panel>

                  <Panel
                    title="Reparto por fase de juego"
                    subtitle="Peso de cada fase sobre el total de tareas"
                  >
                    <div className="flex flex-col lg:flex-row items-center gap-4">
                      <div className="h-[260px] w-full lg:w-1/2">
                        <ResponsiveContainer width="100%" height="100%">
                          <PieChart>
                            <Pie
                              data={faseMetrics}
                              dataKey="tareas"
                              nameKey="name"
                              innerRadius={58}
                              outerRadius={100}
                              paddingAngle={2}
                              cursor="pointer"
                              onClick={(d: any) => {
                                const name = d?.payload?.name ?? d?.name;
                                if (name) setFaseFilter(name);
                              }}
                            >
                              {faseMetrics.map((f, i) => (
                                <Cell
                                  key={f.name}
                                  fill={PIE_COLORS[i % PIE_COLORS.length]}
                                  opacity={
                                    faseFilter !== "ALL" &&
                                    faseFilter !== f.name
                                      ? 0.25
                                      : 1
                                  }
                                />
                              ))}
                            </Pie>

                            <Tooltip content={<DarkTooltip />} />
                          </PieChart>
                        </ResponsiveContainer>
                      </div>

                      <div className="w-full lg:w-1/2 space-y-2">
                        {faseMetrics.map((f, i) => (
                          <button
                            key={f.name}
                            onClick={() =>
                              setFaseFilter(
                                faseFilter === f.name ? "ALL" : f.name
                              )
                            }
                            className="flex w-full items-center gap-3 rounded-xl px-2 py-1.5 text-left hover:bg-white/5"
                          >
                            <span
                              className="h-2.5 w-2.5 shrink-0 rounded-full"
                              style={{
                                background: PIE_COLORS[i % PIE_COLORS.length],
                              }}
                            />

                            <span className="flex-1 truncate text-sm text-white/80">
                              {f.name}
                            </span>

                            <span className="text-sm font-semibold">
                              {f.tareas}
                            </span>

                            <span className="w-12 text-right text-xs text-white/45">
                              {f.pctTareas}%
                            </span>
                          </button>
                        ))}
                      </div>
                    </div>
                  </Panel>
                </div>
              </div>
            )}

            {/* ================= CARGAS ================= */}

            {!loading && filtered.length > 0 && tab === "cargas" && (
              <div className="mt-8 space-y-6">
                <Panel
                  title="Mapa de calor · Carga por microciclo y día"
                  subtitle="Cada celda muestra la carga física acumulada. Pulsa para filtrar."
                >
                  <div className="overflow-x-auto">
                    <div className="min-w-[720px]">
                      <div
                        className="grid gap-1.5"
                        style={{
                          gridTemplateColumns: `170px repeat(${mdOrder.length}, minmax(0,1fr))`,
                        }}
                      >
                        <div />

                        {mdOrder.map((md) => (
                          <div
                            key={md}
                            className="pb-1 text-center text-[11px] font-semibold uppercase tracking-wider text-white/45"
                          >
                            {md}
                          </div>
                        ))}

                        {heatmap.cells.map((row) => (
                          <FragmentRow
                            key={row.micro}
                            row={row}
                            max={heatmap.max}
                            selected={String(row.micro) === micro}
                            onSelectMicro={() =>
                              setMicro(
                                String(row.micro) === micro
                                  ? "ALL"
                                  : String(row.micro)
                              )
                            }
                            onSelectCell={(md: string) => {
                              setMicro(String(row.micro));
                              setMdFilter(md);
                            }}
                          />
                        ))}
                      </div>

                      <div className="mt-5 flex items-center gap-3 text-[11px] text-white/45">
                        <span>Menos carga</span>

                        <div className="flex gap-1">
                          {[0.12, 0.3, 0.48, 0.66, 0.84, 1].map((t) => (
                            <span
                              key={t}
                              className="h-3 w-7 rounded"
                              style={{
                                background: `rgba(200,169,107,${t})`,
                              }}
                            />
                          ))}
                        </div>

                        <span>Más carga</span>
                      </div>
                    </div>
                  </div>
                </Panel>

                <div className="grid grid-cols-1 xl:grid-cols-2 gap-5 sm:gap-6">
                  <Panel
                    title="Carga acumulada por microciclo"
                    subtitle="Física vs cognitiva, con evaluación superpuesta"
                  >
                    <Chart>
                      <ComposedChart data={compareData}>
                        <CartesianGrid stroke="#1E232A" vertical={false} />

                        <XAxis dataKey="micro" {...microAxisProps} />

                        <YAxis
                          yAxisId="left"
                          tick={{ fill: "#94A3B8", fontSize: 11 }}
                          axisLine={false}
                          tickLine={false}
                        />

                        <YAxis
                          yAxisId="right"
                          orientation="right"
                          domain={[0, 10]}
                          tick={{ fill: COLORS.gold, fontSize: 11 }}
                          axisLine={false}
                          tickLine={false}
                        />

                        <Tooltip content={<DarkTooltip />} />

                        <Legend
                          verticalAlign="top"
                          align="right"
                          iconType="circle"
                          wrapperStyle={{ paddingBottom: 16, fontSize: 12 }}
                        />

                        <Bar
                          yAxisId="left"
                          dataKey="load"
                          name="Carga física"
                          fill={COLORS.blue}
                          radius={[8, 8, 0, 0]}
                          barSize={22}
                        />

                        <Bar
                          yAxisId="left"
                          dataKey="cog"
                          name="Carga cognitiva"
                          fill={COLORS.purple}
                          radius={[8, 8, 0, 0]}
                          barSize={22}
                        />

                        <Line
                          yAxisId="right"
                          type="monotone"
                          dataKey="eval"
                          name="Evaluación"
                          stroke={COLORS.gold}
                          strokeWidth={3}
                          dot={{
                            r: 4,
                            strokeWidth: 2,
                            stroke: COLORS.gold,
                            fill: "#0B0F14",
                          }}
                        />
                      </ComposedChart>
                    </Chart>
                  </Panel>

                  <Panel
                    title="Carga física vs cognitiva por tarea"
                    subtitle="Tamaño y color según evaluación de la tarea"
                  >
                    <Chart>
                      <ScatterChart
                        margin={{ top: 20, right: 20, bottom: 20, left: 10 }}
                      >
                        <CartesianGrid stroke="#1E232A" />

                        <XAxis
                          type="number"
                          dataKey="carga"
                          name="Carga física"
                          tick={{ fill: "#94A3B8", fontSize: 11 }}
                        />

                        <YAxis
                          type="number"
                          dataKey="cargaCog"
                          name="Carga cognitiva"
                          tick={{ fill: "#94A3B8", fontSize: 11 }}
                        />

                        <ZAxis dataKey="eval" range={[70, 380]} />

                        <Tooltip
                          cursor={{ strokeDasharray: "3 3" }}
                          content={({ active, payload }: any) => {
                            if (!active || !payload?.length) return null;

                            const d = payload[0].payload;

                            return (
                              <div className="rounded-xl border border-white/10 bg-[#141A22] p-3 shadow-xl">
                                <p className="mb-1 font-semibold text-white">
                                  {d.tarea}
                                </p>

                                <p className="text-xs text-white/50">
                                  M{d.micro} · {d.md} · {d.tipo}
                                </p>

                                <div className="mt-2 space-y-0.5 text-xs">
                                  <p style={{ color: chipInk(getEvalColor(d.eval)) }}>
                                    Evaluación: {d.eval}
                                  </p>

                                  <p className="text-slate-300">
                                    Carga física: {d.carga}
                                  </p>

                                  <p className="text-slate-300">
                                    Carga cognitiva: {d.cargaCog}
                                  </p>
                                </div>
                              </div>
                            );
                          }}
                        />

                        <Scatter data={scatterData}>
                          {scatterData.map((entry, index) => (
                            <Cell key={index} fill={entry.fill} />
                          ))}
                        </Scatter>
                      </ScatterChart>
                    </Chart>
                  </Panel>

                  <Panel
                    title="Tiempo y tareas por día del microciclo"
                    subtitle="Volumen de trabajo repartido en la semana"
                  >
                    <Chart>
                      <ComposedChart data={mdData}>
                        <CartesianGrid stroke="#1E232A" vertical={false} />

                        <XAxis
                          dataKey="md"
                          tick={{ fill: "#94A3B8", fontSize: 12 }}
                          axisLine={false}
                          tickLine={false}
                        />

                        <YAxis
                          yAxisId="left"
                          tick={{ fill: "#94A3B8", fontSize: 11 }}
                          axisLine={false}
                          tickLine={false}
                        />

                        <YAxis
                          yAxisId="right"
                          orientation="right"
                          tick={{ fill: COLORS.green, fontSize: 11 }}
                          axisLine={false}
                          tickLine={false}
                        />

                        <Tooltip content={<DarkTooltip />} />

                        <Legend
                          verticalAlign="top"
                          align="right"
                          iconType="circle"
                          wrapperStyle={{ paddingBottom: 16, fontSize: 12 }}
                        />

                        <Bar
                          yAxisId="left"
                          dataKey="tiempo"
                          name="Minutos"
                          fill={COLORS.green}
                          radius={[8, 8, 0, 0]}
                        >
                          <LabelList
                            dataKey="tiempo"
                            position="top"
                            style={{ fill: "#94A3B8", fontSize: 11 }}
                          />
                        </Bar>

                        <Line
                          yAxisId="right"
                          type="monotone"
                          dataKey="tareas"
                          name="Nº tareas"
                          stroke={COLORS.orange}
                          strokeWidth={3}
                          dot={{ r: 4, fill: COLORS.orange }}
                        />
                      </ComposedChart>
                    </Chart>
                  </Panel>

                  <Panel
                    title="Distribución de intensidad"
                    subtitle="Cuántas tareas se diseñan en cada nivel de intensidad"
                  >
                    <Chart>
                      <BarChart data={intensityHistogram}>
                        <CartesianGrid stroke="#1E232A" vertical={false} />

                        <XAxis
                          dataKey="intensidad"
                          tick={{ fill: "#94A3B8", fontSize: 12 }}
                          axisLine={false}
                          tickLine={false}
                        />

                        <YAxis
                          tick={{ fill: "#94A3B8", fontSize: 11 }}
                          axisLine={false}
                          tickLine={false}
                        />

                        <Tooltip content={<DarkTooltip />} />

                        <Bar
                          dataKey="tareas"
                          name="Tareas"
                          radius={[8, 8, 0, 0]}
                        >
                          {intensityHistogram.map((d) => (
                            <Cell
                              key={d.intensidad}
                              fill={
                                d.intensidad >= 8
                                  ? COLORS.orange
                                  : d.intensidad >= 6
                                  ? COLORS.gold
                                  : COLORS.gray
                              }
                            />
                          ))}

                          <LabelList
                            dataKey="tareas"
                            position="top"
                            style={{ fill: "#94A3B8", fontSize: 11 }}
                          />
                        </Bar>
                      </BarChart>
                    </Chart>
                  </Panel>
                </div>
              </div>
            )}

            {/* ================= CONTENIDOS ================= */}

            {!loading && filtered.length > 0 && tab === "contenidos" && (
              <div className="mt-8 space-y-6">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="mr-1 text-sm text-white/45">
                    Métrica:
                  </span>

                  {CONTENT_METRICS.map((m) => (
                    <button
                      key={m.key}
                      onClick={() => setContentMetric(m.key)}
                      className={`rounded-xl border px-3.5 py-2 text-xs sm:text-sm transition ${
                        contentMetric === m.key
                          ? "border-transparent font-semibold text-black"
                          : "border-white/10 bg-white/[0.03] text-white/65 hover:border-white/25"
                      }`}
                      style={
                        contentMetric === m.key
                          ? { background: m.color }
                          : undefined
                      }
                    >
                      {m.label}
                    </button>
                  ))}
                </div>

                <div className="grid grid-cols-1 xl:grid-cols-2 gap-5 sm:gap-6">
                  <Panel
                    title="Contenido principal"
                    subtitle={`Ordenado por ${
                      CONTENT_METRICS.find((m) => m.key === contentMetric)
                        ?.label
                    }`}
                  >
                    <div style={{ height: contenidoPrincipalHeight }}>
                      <ResponsiveContainer width="100%" height="100%">
                        <BarChart
                          data={sortedByMetric(
                            contenidoPrincipalMetrics,
                            contentMetric
                          )}
                          layout="vertical"
                          margin={{ top: 6, right: 46, left: 10, bottom: 6 }}
                        >
                          <CartesianGrid stroke="#1E232A" vertical={false} />

                          <XAxis
                            type="number"
                            domain={
                              contentMetric === "eval" ? [0, 10] : undefined
                            }
                            tick={{ fill: "#94A3B8", fontSize: 11 }}
                            axisLine={false}
                            tickLine={false}
                          />

                          <YAxis
                            type="category"
                            dataKey="name"
                            width={yAxisWidth}
                            interval={0}
                            axisLine={false}
                            tickLine={false}
                            tick={makeCategoryTick(yAxisWidth)}
                          />

                          <Tooltip
                            cursor={{ fill: "rgba(255,255,255,0.03)" }}
                            content={
                              <DarkTooltip
                                rows={[
                                  ["Tareas", "tareas"],
                                  ["Tiempo", "tiempo"],
                                  ["Carga física", "carga"],
                                  ["Carga cognitiva", "cargaCog"],
                                  ["Evaluación", "eval"],
                                ]}
                              />
                            }
                          />

                          <Bar
                            dataKey={contentMetric}
                            radius={[0, 10, 10, 0]}
                            barSize={16}
                            cursor="pointer"
                            onClick={(d: any) => {
                              const name = d?.payload?.name;
                              if (name)
                                setContenidoPrincipalFilter(
                                  contenidoPrincipalFilter === name
                                    ? "ALL"
                                    : name
                                );
                            }}
                          >
                            {sortedByMetric(
                              contenidoPrincipalMetrics,
                              contentMetric
                            ).map((entry) => (
                              <Cell
                                key={entry.name}
                                fill={
                                  contentMetric === "eval"
                                    ? getEvalColor(entry.eval)
                                    : CONTENT_METRICS.find(
                                        (m) => m.key === contentMetric
                                      )!.color
                                }
                                opacity={
                                  contenidoPrincipalFilter !== "ALL" &&
                                  contenidoPrincipalFilter !== entry.name
                                    ? 0.25
                                    : 1
                                }
                              />
                            ))}

                            <LabelList
                              dataKey={contentMetric}
                              position="right"
                              formatter={(v: any) =>
                                typeof v === "number"
                                  ? contentMetric === "eval"
                                    ? v.toFixed(1)
                                    : fmtInt(v)
                                  : v ?? ""
                              }
                              style={{
                                fill: "#fff",
                                fontSize: 11,
                                fontWeight: 600,
                              }}
                            />
                          </Bar>
                        </BarChart>
                      </ResponsiveContainer>
                    </div>
                  </Panel>

                  <Panel
                    title="Contenido secundario"
                    subtitle="Top 15 subcontenidos trabajados"
                  >
                    <div style={{ height: contenidoSecundarioHeight }}>
                      <ResponsiveContainer width="100%" height="100%">
                        <BarChart
                          data={contenidoSecundarioTop}
                          layout="vertical"
                          margin={{ top: 6, right: 46, left: 10, bottom: 6 }}
                        >
                          <CartesianGrid stroke="#1E232A" vertical={false} />

                          <XAxis
                            type="number"
                            domain={
                              contentMetric === "eval" ? [0, 10] : undefined
                            }
                            tick={{ fill: "#94A3B8", fontSize: 11 }}
                            axisLine={false}
                            tickLine={false}
                          />

                          <YAxis
                            type="category"
                            dataKey="name"
                            width={yAxisWidth}
                            interval={0}
                            axisLine={false}
                            tickLine={false}
                            tick={makeCategoryTick(yAxisWidth)}
                          />

                          <Tooltip
                            cursor={{ fill: "rgba(255,255,255,0.03)" }}
                            content={
                              <DarkTooltip
                                rows={[
                                  ["Tareas", "tareas"],
                                  ["Tiempo", "tiempo"],
                                  ["Carga cognitiva", "cargaCog"],
                                  ["Evaluación", "eval"],
                                ]}
                              />
                            }
                          />

                          <Bar
                            dataKey={contentMetric}
                            radius={[0, 10, 10, 0]}
                            barSize={16}
                            fill={COLORS.pink}
                          >
                            {contenidoSecundarioTop.map((entry) => (
                              <Cell
                                key={entry.name}
                                fill={
                                  contentMetric === "eval"
                                    ? getEvalColor(entry.eval)
                                    : COLORS.pink
                                }
                              />
                            ))}

                            <LabelList
                              dataKey={contentMetric}
                              position="right"
                              formatter={(v: any) =>
                                typeof v === "number"
                                  ? contentMetric === "eval"
                                    ? v.toFixed(1)
                                    : fmtInt(v)
                                  : v ?? ""
                              }
                              style={{
                                fill: "#fff",
                                fontSize: 11,
                                fontWeight: 600,
                              }}
                            />
                          </Bar>
                        </BarChart>
                      </ResponsiveContainer>
                    </div>
                  </Panel>
                </div>

                <Panel
                  title="Tabla comparativa de contenidos principales"
                  subtitle="Todas las métricas en una sola vista"
                >
                  <div className="overflow-x-auto">
                    <table className="w-full min-w-[760px] text-sm">
                      <thead>
                        <tr className="border-b border-white/10 text-left text-xs uppercase tracking-wider text-white/40">
                          <th className="pb-3 pr-3 font-medium">Contenido</th>
                          <th className="pb-3 px-3 text-right font-medium">
                            Tareas
                          </th>
                          <th className="pb-3 px-3 text-right font-medium">
                            % Tareas
                          </th>
                          <th className="pb-3 px-3 text-right font-medium">
                            Tiempo
                          </th>
                          <th className="pb-3 px-3 text-right font-medium">
                            % Tiempo
                          </th>
                          <th className="pb-3 px-3 text-right font-medium">
                            C. Física
                          </th>
                          <th className="pb-3 px-3 text-right font-medium">
                            C. Cognitiva
                          </th>
                          <th className="pb-3 pl-3 text-right font-medium">
                            Evaluación
                          </th>
                        </tr>
                      </thead>

                      <tbody>
                        {contenidoPrincipalMetrics.map((c) => (
                          <tr
                            key={c.name}
                            onClick={() =>
                              setContenidoPrincipalFilter(
                                contenidoPrincipalFilter === c.name
                                  ? "ALL"
                                  : c.name
                              )
                            }
                            className="cursor-pointer border-b border-white/5 transition hover:bg-white/[0.04]"
                          >
                            <td className="py-3 pr-3">
                              <div className="flex items-center gap-2">
                                <span className="h-2 w-2 rounded-full bg-[#C8A96B]" />
                                {c.name}
                              </div>
                            </td>

                            <td className="px-3 text-right font-semibold">
                              {c.tareas}
                            </td>

                            <td className="px-3 text-right">
                              <div className="flex items-center justify-end gap-2">
                                <div className="h-1.5 w-16 rounded-full bg-white/10">
                                  <div
                                    className="h-full rounded-full bg-[#C8A96B]"
                                    style={{
                                      width: `${Math.min(c.pctTareas * 2, 100)}%`,
                                    }}
                                  />
                                </div>

                                <span className="w-11 text-white/60">
                                  {c.pctTareas}%
                                </span>
                              </div>
                            </td>

                            <td className="px-3 text-right text-white/75">
                              {c.tiempo}&apos;
                            </td>

                            <td className="px-3 text-right text-white/50">
                              {c.pctTiempo}%
                            </td>

                            <td className="px-3 text-right text-white/75">
                              {fmtInt(c.carga)}
                            </td>

                            <td className="px-3 text-right text-white/75">
                              {fmtInt(c.cargaCog)}
                            </td>

                            <td className="pl-3 text-right">
                              <span
                                className="rounded-md px-2 py-1 text-xs font-bold"
                                style={{
                                  background: `${getEvalColor(c.eval)}22`,
                                  color: chipInk(getEvalColor(c.eval)),
                                }}
                              >
                                {c.eval || "—"}
                              </span>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </Panel>

                <div className="grid grid-cols-1 xl:grid-cols-2 gap-5 sm:gap-6">
                  <Panel
                    title="Evaluación por tipo de tarea"
                    subtitle="Pulsa una barra para filtrar el dashboard"
                  >
                    <div style={{ height: taskChartHeight }}>
                      <ResponsiveContainer width="100%" height="100%">
                        <BarChart
                          data={[...tipoMetrics].sort(
                            (a, b) => b.eval - a.eval
                          )}
                          layout="vertical"
                          margin={{ top: 6, right: 46, left: 10, bottom: 6 }}
                          barCategoryGap={8}
                        >
                          <CartesianGrid stroke="#1E232A" vertical={false} />

                          <XAxis
                            type="number"
                            domain={[0, 10]}
                            tick={{ fill: "#94A3B8", fontSize: 11 }}
                            axisLine={false}
                            tickLine={false}
                          />

                          <YAxis
                            type="category"
                            dataKey="name"
                            width={tipoAxisWidth}
                            interval={0}
                            axisLine={false}
                            tickLine={false}
                            tick={makeCategoryTick(tipoAxisWidth)}
                          />

                          <Tooltip
                            cursor={{ fill: "rgba(255,255,255,0.03)" }}
                            content={
                              <DarkTooltip
                                rows={[
                                  ["Tareas", "tareas"],
                                  ["Tiempo", "tiempo"],
                                  ["Intensidad", "intensidad"],
                                ]}
                              />
                            }
                          />

                          <Bar
                            dataKey="eval"
                            name="Evaluación"
                            radius={[0, 10, 10, 0]}
                            barSize={isMobile ? 15 : 17}
                            cursor="pointer"
                            onClick={(d: any) => {
                              const name = d?.payload?.name;
                              if (name)
                                setTipoFilter(
                                  tipoFilter === name ? "ALL" : name
                                );
                            }}
                          >
                            {[...tipoMetrics]
                              .sort((a, b) => b.eval - a.eval)
                              .map((entry) => (
                                <Cell
                                  key={entry.name}
                                  fill={getEvalColor(entry.eval)}
                                  opacity={
                                    tipoFilter !== "ALL" &&
                                    tipoFilter !== entry.name
                                      ? 0.25
                                      : 1
                                  }
                                />
                              ))}

                            <LabelList
                              dataKey="eval"
                              position="right"
                              formatter={(v: any) =>
                                typeof v === "number" ? v.toFixed(1) : v ?? ""
                              }
                              style={{
                                fill: "#fff",
                                fontSize: 11,
                                fontWeight: 600,
                              }}
                            />
                          </Bar>
                        </BarChart>
                      </ResponsiveContainer>
                    </div>
                  </Panel>

                  <Panel
                    title="Formatos de tarea más usados"
                    subtitle="Top 12 estructuras de juego (jugadores + comodines)"
                  >
                    <div style={{ height: formatoHeight }}>
                      <ResponsiveContainer width="100%" height="100%">
                        <BarChart
                          data={formatoTop}
                          layout="vertical"
                          margin={{ top: 6, right: 46, left: 10, bottom: 6 }}
                        >
                          <CartesianGrid stroke="#1E232A" vertical={false} />

                          <XAxis
                            type="number"
                            tick={{ fill: "#94A3B8", fontSize: 11 }}
                            axisLine={false}
                            tickLine={false}
                          />

                          <YAxis
                            type="category"
                            dataKey="name"
                            width={formatoAxisWidth}
                            interval={0}
                            axisLine={false}
                            tickLine={false}
                            tick={makeCategoryTick(formatoAxisWidth, 2)}
                          />

                          <Tooltip
                            cursor={{ fill: "rgba(255,255,255,0.03)" }}
                            content={
                              <DarkTooltip
                                rows={[
                                  ["Tiempo", "tiempo"],
                                  ["Evaluación", "eval"],
                                ]}
                              />
                            }
                          />

                          <Bar
                            dataKey="tareas"
                            name="Tareas"
                            fill={COLORS.green}
                            radius={[0, 10, 10, 0]}
                            barSize={16}
                          >
                            <LabelList
                              dataKey="tareas"
                              position="right"
                              style={{
                                fill: "#fff",
                                fontSize: 11,
                                fontWeight: 600,
                              }}
                            />
                          </Bar>
                        </BarChart>
                      </ResponsiveContainer>
                    </div>
                  </Panel>
                </div>
              </div>
            )}

            {/* ================= COGNITIVO ================= */}

            {!loading && filtered.length > 0 && tab === "cognitivo" && (
              <div className="mt-8 space-y-6">
                <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-6 gap-3 sm:gap-4">
                  {cognitiveRadar.map((c) => (
                    <div
                      key={c.metric}
                      className="rounded-2xl border border-white/10 bg-white/[0.03] p-4"
                    >
                      <p className="text-xs text-white/45">{c.metric}</p>

                      <p className="mt-2 text-2xl font-semibold text-violet-300">
                        {c.raw || "—"}
                      </p>

                      <div className="mt-3 h-1.5 rounded-full bg-white/10">
                        <div
                          className="h-full rounded-full bg-violet-400"
                          style={{
                            width: `${Math.min((c.value / 10) * 100, 100)}%`,
                          }}
                        />
                      </div>
                    </div>
                  ))}
                </div>

                <div className="grid grid-cols-1 xl:grid-cols-2 gap-5 sm:gap-6">
                  <Panel
                    title="Perfil cognitivo de las tareas"
                    subtitle="Normativa, incertidumbre, dificultad y motivación escaladas a 0-10"
                  >
                    <Chart>
                      <RadarChart
                        cx="50%"
                        cy="50%"
                        outerRadius={isMobile ? "58%" : "72%"}
                        data={cognitiveRadar}
                      >
                        <PolarGrid stroke="rgba(255,255,255,.12)" />

                        <PolarAngleAxis dataKey="metric" tick={polarTick} />

                        <PolarRadiusAxis
                          domain={[0, 10]}
                          tick={false}
                          axisLine={false}
                        />

                        <Tooltip
                          content={<DarkTooltip rows={[["Valor real", "raw"]]} />}
                        />

                        <Radar
                          name="Perfil cognitivo"
                          dataKey="value"
                          stroke={COLORS.purple}
                          strokeWidth={3}
                          fill={COLORS.purple}
                          fillOpacity={0.32}
                        />
                      </RadarChart>
                    </Chart>
                  </Panel>

                  <Panel
                    title="Evolución cognitiva en el microciclo"
                    subtitle="Cómo varían las exigencias cognitivas día a día"
                  >
                    <Chart>
                      <ComposedChart data={cognitiveByMD}>
                        <CartesianGrid stroke="#1E232A" vertical={false} />

                        <XAxis
                          dataKey="md"
                          tick={{ fill: "#94A3B8", fontSize: 12 }}
                          axisLine={false}
                          tickLine={false}
                        />

                        <YAxis
                          domain={[0, 10]}
                          tick={{ fill: "#94A3B8", fontSize: 11 }}
                          axisLine={false}
                          tickLine={false}
                        />

                        <Tooltip content={<DarkTooltip />} />

                        <Legend
                          verticalAlign="bottom"
                          wrapperStyle={{
                            fontSize: 11,
                            color: "#CBD5E1",
                            paddingTop: 12,
                          }}
                        />

                        <Bar
                          dataKey="demandaCog"
                          name="Demanda cognitiva"
                          fill="rgba(139,92,246,0.35)"
                          radius={[8, 8, 0, 0]}
                        />

                        <Line
                          type="monotone"
                          dataKey="incertidumbre"
                          name="Incertidumbre"
                          stroke={COLORS.orange}
                          strokeWidth={2.5}
                          dot={{ r: 3 }}
                        />

                        <Line
                          type="monotone"
                          dataKey="normativa"
                          name="Normativa"
                          stroke={COLORS.blue}
                          strokeWidth={2.5}
                          dot={{ r: 3 }}
                        />

                        <Line
                          type="monotone"
                          dataKey="familiaridad"
                          name="Dificultad"
                          stroke={COLORS.pink}
                          strokeWidth={2.5}
                          dot={{ r: 3 }}
                        />

                        <Line
                          type="monotone"
                          dataKey="motivacion"
                          name="Motivación"
                          stroke={COLORS.green}
                          strokeWidth={2.5}
                          dot={{ r: 3 }}
                        />
                      </ComposedChart>
                    </Chart>
                  </Panel>

                  <Panel
                    title="Demanda cognitiva vs evaluación"
                    subtitle="¿Las tareas más exigentes se valoran mejor?"
                  >
                    <Chart>
                      <ScatterChart
                        margin={{ top: 20, right: 20, bottom: 20, left: 10 }}
                      >
                        <CartesianGrid stroke="#1E232A" />

                        <XAxis
                          type="number"
                          dataKey="demandaCog"
                          name="Demanda cognitiva"
                          domain={[0, 10]}
                          tick={{ fill: "#94A3B8", fontSize: 11 }}
                        />

                        <YAxis
                          type="number"
                          dataKey="eval"
                          name="Evaluación"
                          domain={[0, 10]}
                          tick={{ fill: "#94A3B8", fontSize: 11 }}
                        />

                        <ZAxis dataKey="tiempo" range={[60, 320]} />

                        <Tooltip
                          cursor={{ strokeDasharray: "3 3" }}
                          content={({ active, payload }: any) => {
                            if (!active || !payload?.length) return null;

                            const d = payload[0].payload;

                            return (
                              <div className="rounded-xl border border-white/10 bg-[#141A22] p-3 shadow-xl">
                                <p className="font-semibold text-white">
                                  {d.tarea}
                                </p>

                                <p className="text-xs text-white/50">
                                  {d.tipo}
                                </p>

                                <div className="mt-2 space-y-0.5 text-xs text-slate-300">
                                  <p>Demanda cognitiva: {d.demandaCog}</p>
                                  <p style={{ color: chipInk(getEvalColor(d.eval)) }}>
                                    Evaluación: {d.eval}
                                  </p>
                                  <p>Tiempo: {d.tiempo}&apos;</p>
                                </div>
                              </div>
                            );
                          }}
                        />

                        <Scatter data={cogVsEval}>
                          {cogVsEval.map((e, i) => (
                            <Cell key={i} fill={e.fill} />
                          ))}
                        </Scatter>
                      </ScatterChart>
                    </Chart>
                  </Panel>

                  <Panel
                    title="Análisis post-tarea"
                    subtitle="Etiquetas cualitativas registradas por el staff"
                  >
                    <div style={{ height: analisisHeight }}>
                      <ResponsiveContainer width="100%" height="100%">
                        <BarChart
                          data={analisisMetrics}
                          layout="vertical"
                          margin={{ top: 6, right: 46, left: 10, bottom: 6 }}
                        >
                          <CartesianGrid stroke="#1E232A" vertical={false} />

                          <XAxis
                            type="number"
                            tick={{ fill: "#94A3B8", fontSize: 11 }}
                            axisLine={false}
                            tickLine={false}
                          />

                          <YAxis
                            type="category"
                            dataKey="name"
                            width={yAxisWidth}
                            interval={0}
                            axisLine={false}
                            tickLine={false}
                            tick={makeCategoryTick(yAxisWidth)}
                          />

                          <Tooltip
                            cursor={{ fill: "rgba(255,255,255,0.03)" }}
                            content={
                              <DarkTooltip
                                rows={[["Evaluación media", "eval"]]}
                              />
                            }
                          />

                          <Bar
                            dataKey="tareas"
                            name="Tareas"
                            radius={[0, 10, 10, 0]}
                            barSize={18}
                          >
                            {analisisMetrics.map((entry) => (
                              <Cell
                                key={entry.name}
                                fill={getEvalColor(entry.eval)}
                              />
                            ))}

                            <LabelList
                              dataKey="tareas"
                              position="right"
                              style={{
                                fill: "#fff",
                                fontSize: 11,
                                fontWeight: 600,
                              }}
                            />
                          </Bar>
                        </BarChart>
                      </ResponsiveContainer>
                    </div>
                  </Panel>
                </div>

                <Panel
                  title="Matriz cognitiva por tipo de tarea"
                  subtitle="Intensidad de color = mayor exigencia en esa dimensión"
                >
                  <div className="overflow-x-auto">
                    <table className="w-full min-w-[760px] text-sm">
                      <thead>
                        <tr className="border-b border-white/10 text-left text-xs uppercase tracking-wider text-white/40">
                          <th className="pb-3 pr-3 font-medium">
                            Tipo de tarea
                          </th>
                          <th className="pb-3 px-2 text-center font-medium">
                            Tareas
                          </th>
                          <th className="pb-3 px-2 text-center font-medium">
                            Normativa
                          </th>
                          <th className="pb-3 px-2 text-center font-medium">
                            Incert.
                          </th>
                          <th className="pb-3 px-2 text-center font-medium">
                            Dificultad
                          </th>
                          <th className="pb-3 px-2 text-center font-medium">
                            Motivación
                          </th>
                          <th className="pb-3 px-2 text-center font-medium">
                            Demanda
                          </th>
                          <th className="pb-3 pl-2 text-center font-medium">
                            Eval
                          </th>
                        </tr>
                      </thead>

                      <tbody>
                        {cognitiveByTipo.map((t) => (
                          <tr
                            key={t.tipo}
                            className="border-b border-white/5 hover:bg-white/[0.03]"
                          >
                            <td className="py-2.5 pr-3">{t.tipo}</td>

                            <td className="px-2 text-center text-white/55">
                              {t.tareas}
                            </td>

                            <CogCell value={t.normativa} max={5} />
                            <CogCell value={t.incertidumbre} max={5} />
                            <CogCell value={t.familiaridad} max={5} />
                            <CogCell value={t.motivacion} max={5} />
                            <CogCell value={t.demandaCog} max={10} />

                            <td className="pl-2 text-center">
                              <span
                                className="rounded-md px-2 py-1 text-xs font-bold"
                                style={{
                                  background: `${getEvalColor(t.eval)}22`,
                                  color: chipInk(getEvalColor(t.eval)),
                                }}
                              >
                                {t.eval || "—"}
                              </span>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </Panel>
              </div>
            )}

            {/* ================= TAREAS ================= */}

            {!loading && filtered.length > 0 && tab === "tareas" && (
              <div className="mt-8 space-y-6">
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-5 sm:gap-6">
                  <Panel
                    title="Mejor valoradas"
                    subtitle="Las 5 tareas con mayor evaluación"
                  >
                    <div className="space-y-2.5">
                      {topTasks.map((t) => (
                        <TaskRow key={`${t.micro}-${t.tarea}`} row={t} />
                      ))}

                      {!topTasks.length && (
                        <p className="text-sm text-white/40">
                          Sin tareas evaluadas.
                        </p>
                      )}
                    </div>
                  </Panel>

                  <Panel
                    title="A revisar"
                    subtitle="Las 5 tareas con menor evaluación"
                  >
                    <div className="space-y-2.5">
                      {bottomTasks.map((t) => (
                        <TaskRow key={`${t.micro}-${t.tarea}-b`} row={t} />
                      ))}

                      {!bottomTasks.length && (
                        <p className="text-sm text-white/40">
                          Sin tareas evaluadas.
                        </p>
                      )}
                    </div>
                  </Panel>
                </div>

                <Panel
                  title={`Detalle de tareas (${sortedTasks.length})`}
                  subtitle="Pulsa una columna para ordenar"
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
                  <div className="overflow-x-auto">
                    <table className="w-full min-w-[1080px] text-sm">
                      <thead>
                        <tr className="border-b border-white/10 text-left text-xs uppercase tracking-wider text-white/40">
                          <Th
                            label="Micro"
                            k="micro"
                            sortKey={sortKey}
                            sortDir={sortDir}
                            onSort={toggleSort}
                          />
                          <Th
                            label="Día"
                            k="md"
                            sortKey={sortKey}
                            sortDir={sortDir}
                            onSort={toggleSort}
                          />
                          <Th
                            label="Tarea"
                            k="tarea"
                            sortKey={sortKey}
                            sortDir={sortDir}
                            onSort={toggleSort}
                          />
                          <Th
                            label="Tipo"
                            k="tipo"
                            sortKey={sortKey}
                            sortDir={sortDir}
                            onSort={toggleSort}
                          />
                          <Th
                            label="Contenido"
                            k="contenidoPrincipal"
                            sortKey={sortKey}
                            sortDir={sortDir}
                            onSort={toggleSort}
                          />
                          <Th
                            label="Fase"
                            k="fase"
                            sortKey={sortKey}
                            sortDir={sortDir}
                            onSort={toggleSort}
                          />
                          <Th
                            label="Formato"
                            k="formato"
                            sortKey={sortKey}
                            sortDir={sortDir}
                            onSort={toggleSort}
                            align="center"
                          />
                          <Th
                            label="Min"
                            k="tiempo"
                            sortKey={sortKey}
                            sortDir={sortDir}
                            onSort={toggleSort}
                            align="right"
                          />
                          <Th
                            label="Int"
                            k="intensidad"
                            sortKey={sortKey}
                            sortDir={sortDir}
                            onSort={toggleSort}
                            align="right"
                          />
                          <Th
                            label="C.Fís"
                            k="carga"
                            sortKey={sortKey}
                            sortDir={sortDir}
                            onSort={toggleSort}
                            align="right"
                          />
                          <Th
                            label="C.Cog"
                            k="cargaCog"
                            sortKey={sortKey}
                            sortDir={sortDir}
                            onSort={toggleSort}
                            align="right"
                          />
                          <Th
                            label="Eval"
                            k="evaluacion"
                            sortKey={sortKey}
                            sortDir={sortDir}
                            onSort={toggleSort}
                            align="center"
                          />
                        </tr>
                      </thead>

                      <tbody>
                        {sortedTasks.map((r, i) => (
                          <tr
                            key={`${r.micro}-${r.tarea}-${i}`}
                            className="border-b border-white/5 transition hover:bg-white/[0.04]"
                          >
                            <td className="py-3 pr-3 whitespace-nowrap">
                              <span className="rounded-md bg-white/5 px-2 py-1 text-xs">
                                M{r.micro}
                              </span>
                            </td>

                            <td className="px-3 whitespace-nowrap">
                              <div className="flex flex-col">
                                <span className="text-xs font-semibold text-[#C8A96B]">
                                  {r.md}
                                </span>

                                <span className="text-[10px] text-white/35">
                                  {DIA_LABEL[r.dia] || r.dia} ·{" "}
                                  {fmtFechaCorta(r.fecha)}
                                </span>
                              </div>
                            </td>

                            <td className="px-3 font-medium">{r.tarea}</td>

                            <td className="px-3 text-white/70">{r.tipo}</td>

                            <td className="px-3">
                              <div className="flex flex-col">
                                <span className="text-white/70">
                                  {r.contenidoPrincipal || "—"}
                                </span>

                                {r.contenidoSecundario && (
                                  <span className="text-[11px] text-white/35">
                                    {r.contenidoSecundario}
                                  </span>
                                )}
                              </div>
                            </td>

                            <td className="px-3">
                              <span className="rounded-md border border-white/10 px-2 py-0.5 text-[11px] text-white/60">
                                {r.fase || "—"}
                              </span>
                            </td>

                            <td className="px-3 text-center text-white/60">
                              {r.formato || "—"}
                            </td>

                            <td className="px-3 text-right text-white/70">
                              {r.tiempo || "—"}
                            </td>

                            <td className="px-3 text-right text-white/70">
                              {r.intensidad || "—"}
                            </td>

                            <td className="px-3 text-right text-white/70">
                              {fmtInt(r.carga)}
                            </td>

                            <td className="px-3 text-right text-white/70">
                              {fmtInt(r.cargaCog)}
                            </td>

                            <td className="px-3 text-center">
                              <span
                                className="rounded-md px-2 py-1 text-xs font-bold"
                                style={{
                                  background: `${getEvalColor(r.evaluacion)}22`,
                                  color: chipInk(getEvalColor(r.evaluacion)),
                                }}
                              >
                                {r.evaluacion || "—"}
                              </span>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </Panel>
              </div>
            )}
          </section>
        </div>
      </div>
    </main>
  );
}

/* ------------------------------------------------------------------ */
/* UI pieces                                                           */
/* ------------------------------------------------------------------ */

function Chart({ children, height }: any) {
  return (
    <div className="w-full" style={{ height: height ?? 380 }}>
      <ResponsiveContainer width="100%" height="100%">
        {children}
      </ResponsiveContainer>
    </div>
  );
}

function Panel({ title, subtitle, action, children }: any) {
  return (
    <div className="rounded-3xl border border-white/10 bg-white/[0.03] p-4 sm:p-6 shadow-xl">
      <div className="mb-5 flex items-start justify-between gap-3">
        <div>
          <h2 className="text-base sm:text-xl font-semibold leading-tight">
            {title}
          </h2>

          {subtitle && (
            <p className="mt-1 text-xs sm:text-sm text-white/40">{subtitle}</p>
          )}
        </div>

        {action}
      </div>

      {children}
    </div>
  );
}

function StatCard({
  icon: Icon,
  title,
  value,
  hint,
  accent = "#C8A96B",
  delta,
  deltaSuffix = "",
  decimals = 0,
}: any) {
  const showDelta = typeof delta === "number" && delta !== 0;

  const DeltaIcon = !showDelta ? Minus : delta > 0 ? ArrowUp : ArrowDown;

  return (
    <div className="group rounded-2xl border border-white/10 bg-white/[0.03] p-4 transition hover:border-white/25">
      <div className="flex items-center justify-between">
        <p className="text-[11px] uppercase tracking-wider text-white/40">
          {title}
        </p>

        <Icon
          className="h-4 w-4 opacity-60"
          style={{ color: chipInk(accent) }}
        />
      </div>

      <p
        className="mt-2.5 text-2xl sm:text-[28px] font-semibold leading-none"
        style={{ color: chipInk(accent) }}
      >
        {value}
      </p>

      <div className="mt-2.5 flex items-center gap-2">
        {hint && <span className="text-[11px] text-white/40">{hint}</span>}

        {showDelta && (
          <span
            className={`inline-flex items-center gap-0.5 rounded-md px-1.5 py-0.5 text-[10px] font-semibold ${
              delta > 0
                ? "bg-emerald-500/15 text-emerald-400"
                : "bg-rose-500/15 text-rose-400"
            }`}
          >
            <DeltaIcon className="h-2.5 w-2.5" />
            {Math.abs(delta).toFixed(decimals)}
            {deltaSuffix}
          </span>
        )}
      </div>
    </div>
  );
}

function Select({ value, onChange, label, options }: any) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-[10px] uppercase tracking-wider text-white/35">
        {label}
      </span>

      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="w-full rounded-2xl border border-white/10 bg-[#11161C] px-3.5 py-2.5 text-sm text-white outline-none focus:border-[#C8A96B]/50"
      >
        {options.map((o: any) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
    </label>
  );
}

const CHIP_STYLES: Record<string, string> = {
  gold: "border-[#C8A96B]/40 bg-[#C8A96B]/10 text-[#C8A96B]",
  blue: "border-blue-400/40 bg-blue-400/10 text-blue-300",
  purple: "border-purple-400/40 bg-purple-400/10 text-purple-300",
  green: "border-green-400/40 bg-green-400/10 text-green-300",
  orange: "border-orange-400/40 bg-orange-400/10 text-orange-300",
};

function FilterChip({ label, color, onClear }: any) {
  return (
    <button
      onClick={onClear}
      className={`rounded-full border px-3 py-1.5 text-xs transition hover:opacity-80 ${CHIP_STYLES[color]}`}
    >
      {label} ×
    </button>
  );
}

function Th({ label, k, sortKey, sortDir, onSort, align = "left" }: any) {
  const active = sortKey === k;

  return (
    <th
      onClick={() => onSort(k)}
      className={`cursor-pointer select-none pb-3 px-3 font-medium transition hover:text-white ${
        active ? "text-[#C8A96B]" : ""
      } ${
        align === "right"
          ? "text-right"
          : align === "center"
          ? "text-center"
          : "text-left"
      }`}
    >
      {label}
      {active && (sortDir === "asc" ? " ↑" : " ↓")}
    </th>
  );
}

function DarkTooltip({ active, payload, label, rows }: any) {
  if (!active || !payload?.length) return null;

  const d = payload[0].payload ?? {};

  return (
    <div className="rounded-xl border border-white/10 bg-[#141A22] p-3 shadow-2xl">
      {label !== undefined && (
        <p className="mb-1.5 text-sm font-semibold text-white">{label}</p>
      )}

      <div className="space-y-0.5">
        {payload.map((p: any, i: number) => (
          <p
            key={i}
            className="text-xs"
            style={{ color: chipInk(p.color ?? "#CBD5E1") }}
          >
            {p.name}: <span className="font-semibold">{p.value}</span>
          </p>
        ))}

        {rows?.map(([rowLabel, key]: [string, string]) =>
          d[key] !== undefined && d[key] !== "" ? (
            <p key={key} className="text-xs text-white/50">
              {rowLabel}: <span className="font-semibold">{d[key]}</span>
            </p>
          ) : null
        )}
      </div>
    </div>
  );
}

function CogCell({ value, max }: { value: number; max: number }) {
  const t = max ? Math.min(value / max, 1) : 0;

  return (
    <td className="px-2 text-center">
      <span
        className="inline-block min-w-[38px] rounded-md px-2 py-1 text-xs font-semibold"
        style={{
          background: `rgba(139,92,246,${0.08 + t * 0.55})`,
          color: t > 0.55 ? "#fff" : chipInk("#C4B5FD"),
        }}
      >
        {value || "—"}
      </span>
    </td>
  );
}

function FragmentRow({ row, max, selected, onSelectMicro, onSelectCell }: any) {
  return (
    <>
      <button
        onClick={onSelectMicro}
        className={`flex flex-col items-start justify-center rounded-xl border px-3 py-2 text-left transition ${
          selected
            ? "border-[#C8A96B] bg-[#C8A96B]/10"
            : "border-white/5 bg-white/[0.02] hover:border-white/20"
        }`}
      >
        <span className="text-xs font-semibold">Micro {row.micro}</span>

        <span className="w-full truncate text-[10px] text-white/40">
          {row.rival || "—"}
        </span>
      </button>

      {row.values.map((v: any) => {
        const t = max ? v.carga / max : 0;

        return (
          <button
            key={v.md}
            onClick={() => v.tareas > 0 && onSelectCell(v.md)}
            disabled={!v.tareas}
            title={
              v.tareas
                ? `M${row.micro} · ${v.md}\n${v.tareas} tareas · ${v.tiempo}'\nCarga ${fmtInt(
                    v.carga
                  )} · Cog ${fmtInt(v.cog)}${v.eval ? `\nEval ${v.eval}` : ""}`
                : "Sin tareas"
            }
            className="flex h-[54px] flex-col items-center justify-center rounded-xl border border-white/5 transition hover:border-white/30 disabled:cursor-default disabled:hover:border-white/5"
            style={{
              background: v.carga
                ? `rgba(200,169,107,${0.12 + t * 0.78})`
                : "rgba(255,255,255,0.02)",
            }}
          >
            <span
              className="text-sm font-semibold"
              style={{
                color: t > 0.5 ? "#0B0F14" : "rgb(var(--rmcf-ink-rgb) / .88)",
              }}
            >
              {v.carga ? fmtInt(v.carga) : "·"}
            </span>

            {v.tareas > 0 && (
              <span
                className="text-[10px]"
                style={{
                  color:
                    t > 0.5
                      ? "rgba(11,15,20,.65)"
                      : "rgb(var(--rmcf-ink-rgb) / .45)",
                }}
              >
                {v.tareas} tar.
              </span>
            )}
          </button>
        );
      })}
    </>
  );
}

function TaskRow({ row }: { row: Row }) {
  return (
    <div className="flex items-center gap-3 rounded-2xl border border-white/5 bg-white/[0.02] p-3">
      <span
        className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl text-base font-bold"
        style={{
          background: `${getEvalColor(row.evaluacion)}22`,
          color: chipInk(getEvalColor(row.evaluacion)),
        }}
      >
        {row.evaluacion}
      </span>

      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-semibold">{row.tarea}</p>

        <p className="truncate text-xs text-white/40">
          M{row.micro} · {row.md} · {row.tipo}
        </p>
      </div>

      <div className="hidden shrink-0 text-right sm:block">
        <p className="text-xs text-white/60">{row.tiempo}&apos;</p>

        <p className="text-[11px] text-white/35">
          {row.formato || "—"}
        </p>
      </div>
    </div>
  );
}
