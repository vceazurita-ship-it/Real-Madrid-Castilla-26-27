"use client";
import { traeCsv } from "@/lib/hojaCsv";
import { ResponsiveConVistas } from "@/components/data/visual/ResponsiveConVistas";
import { EstadoError } from "@/components/ui/estados";
import { useFiltroPersistente } from "@/hooks/useFiltroPersistente";

import { Sidebar } from "@/components/ui/sidebar";
import { chipInk } from "@/lib/theme";
import { Topbar } from "@/components/ui/topbar";
import { InformePartidoDialog } from "@/components/informe-partido/InformePartidoDialog";
import {
  useDeferredValue,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import Papa from "papaparse";
import Link from "next/link";
import { EnlacesDelRival } from "@/components/rivals/EnlacesDelRival";
import { DiaConectado } from "@/components/sesion-dia/DiaConectado";
import { useDiasConectados } from "@/hooks/useDiasConectados";
import { enlaza, nombreVisible, planDeRegistro, propuestasDeLaSesion, sesionDeFecha, type FilaPlan } from "@/lib/sesion-dia/conexion";
import type { LucideIcon } from "lucide-react";
import { nombreCorto as nombreCortoEquipo } from "@/lib/abp/informe-graficos";
import { esFilaDePartido, etiquetaMicro, fechaIsoDeHoja, rivalDelMicro, separaSemanas, tipoDeTareaUnificado } from "@/lib/microciclo/cuenta";
import { fechasDePartido, mdDelDia, microDeHoy as microDeHoyComun } from "@/lib/microciclo/semana-de-hoy";
import { useCalendario } from "@/hooks/useCalendario";
import { comoNuestro, horaDelCalendarioLocal } from "@/lib/castilla/calendario";
import {
  Activity,
  ArrowDown,
  ArrowUp,
  Brain,
  CalendarDays,
  Clock,
  Download,
  FileText,
  Flame,
  Gauge,
  Layers,
  ListChecks,
  Minus,
  Pencil,
  Search,
  Sparkles,
  Star,
  Target,
} from "lucide-react";
import {
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

/* El partido es la fila de competición del día MD: la misma regla que el editor (lib/microciclo/cuenta.ts, 10/11/2026). */

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

/*
| 29/10/2026: los tres formateadores van con «de-DE» a propósito. Separa igual
| que el español (coma decimal, punto de millar), pero «es-ES» no pone el punto
| en las cifras de cuatro dígitos (deja «1098» en vez de «1.098»), que es lo que
| se veía en el titular y en el indicador de carga física.
*/
const LOCALE_CIFRAS = "de-DE";

/** Número con coma decimal y punto de millar («6,6», «58,5»). */
function fmtDec(n: number, d = 1) {
  return n.toLocaleString(LOCALE_CIFRAS, {
    minimumFractionDigits: d,
    maximumFractionDigits: d,
  });
}

/** Hasta un decimal, sin ceros de relleno: «6,5», «7», «1.098». */
function fmt1(n: number) {
  return n.toLocaleString(LOCALE_CIFRAS, { maximumFractionDigits: 1 });
}

function pctCambio(cur: number, prev: number) {
  return prev > 0 ? +(((cur - prev) / prev) * 100).toFixed(1) : 0;
}

function fmtInt(n: number) {
  return Math.round(n).toLocaleString(LOCALE_CIFRAS);
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
  /*
  | Se parte por los espacios: `\s`, con su barra.
  |
  | Sin ella la expresión partía por la letra «s» y se la comía, así que en
  | todos los gráficos de esta pantalla se leía «Tran ición ofen iva» en vez de
  | «Transición ofensiva». Es una barra invertida que se perdió al escribir el
  | fichero desde la consola.
  */
  const words = String(label ?? "")
    .trim()
    .split(/\s+/)
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

  /*
  | Una palabra suelta más larga que la línea se parte por la fuerza.
  |
  | Con un par de caracteres de más se deja entera: partir «Finalización» en
  | «Finalizació» y una «n» sola debajo se lee mucho peor que dejarla asomar
  | dos píxeles, y los nombres de contenido de la hoja rondan justo esa
  | medida. El sobrante cabe: el ancho del eje se calcula con
  | `TICK_CHAR_WIDTH`, que es el ancho MEDIO de un carácter, y una palabra
  | larga suele traer letras estrechas.
  */
  const HOLGURA = 2;

  const split: string[] = [];

  for (const line of lines) {
    if (line.length <= maxChars + HOLGURA) {
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

    const lines = label.length > 11 ? wrapLabel(label, 14, 3) : [label];

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

  const filas = parsed.data
    .slice(1)
    .map((r) => ({
      temporada: r[0] || "",
      micro: num(r[1]),
      rival: r[2] || "",
      dia: (r[3] || "").trim().toUpperCase(),
      md: normalizeMD(r[4]),
      fecha: r[5] || "",
      tarea: r[6] || "",
      tipo: tipoDeTareaUnificado(r[7] || ""),
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

  return separaSemanas(filas);
}

/* ------------------------------------------------------------------ */
/*  Un micro con dos rivales son dos semanas                           */
/* ------------------------------------------------------------------ */

/* Desde el 07/11/2026 la separación (13 y «13B») y la etiqueta viven en
   lib/microciclo/cuenta.ts: el editor y los calendarios cuentan igual. */
const fechaIso = fechaIsoDeHoja;

/**
 * El micro que toca hoy, para abrir la pantalla en él.
 *
 * Desde el 16/11/2026 es la regla compartida de lib/microciclo/semana-de-hoy.ts
 * (la misma de los dos calendarios y de Jugadores sesión): el que tiene a hoy
 * entre su primera y su última fecha; entre dos (el libre después del
 * partido), el siguiente si ya está planificado. Si la hoja no tiene fechas
 * que se entiendan, el de número más alto. «ALL» mientras no se sepa el día.
 */
/**
 * UN SOLO NOMBRE DE EQUIPO (16/11/2026, jueces): la hoja mezcla «HÉRCULES»,
 * «R.FERROL» y «Murcia». El nombre corto de siempre, en mayúscula inicial
 * (las siglas cortas se quedan: «UD», «CF»); la semana sin partido, «Sin partido».
 */
function nombreEquipo(rival: string) {
  const r = rivalDelMicro(rival);

  if (r !== rival) return r;

  const corto = nombreCortoEquipo(rival);

  if (corto !== corto.toUpperCase()) return corto;

  return corto
    .toLowerCase()
    .split(/(\s+|\.|-)/)
    .map((p) => (/^(de|del|la|el)$/.test(p) ? p : /^[a-záéíóúñü]{1,2}$/.test(p) ? p.toUpperCase() : p.charAt(0).toUpperCase() + p.slice(1)))
    .join("");
}

function microDeHoy(rows: Row[], hoy: Date | null): string {
  if (!hoy || rows.length === 0) return "ALL";

  const iso = `${hoy.getFullYear()}-${String(hoy.getMonth() + 1).padStart(2, "0")}-${String(hoy.getDate()).padStart(2, "0")}`;
  const deHoy = microDeHoyComun(rows, iso);

  return deHoy === null ? String(Math.max(...rows.map((r) => r.micro))) : String(deHoy);
}

type TabKey =
  | "resumen"
  | "cargas"
  | "contenidos"
  | "cognitivo"
  | "tareas";

const TABS: { key: TabKey; label: string; icon: LucideIcon }[] = [
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

/** Los valores distintos de una columna, sin vacíos y en orden. */
function uniqueSorted(rows: Row[], key: keyof Row) {
  return [
    ...new Set(rows.map((r) => String(r[key] ?? "").trim()).filter(Boolean)),
  ].sort();
}

/** Suma las tareas por el valor de una columna (contenido, fase, tipo…). */
function groupBy(key: keyof Row, source: Row[]) {
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
}

export default function Page() {
  const [isMobile, setIsMobile] = useState(false);
  const [isNarrow, setIsNarrow] = useState(false);

  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);

  const [tab, setTab] = useState<TabKey>("resumen");

  /*
  | EL MICRO DE HOY, DE ENTRADA (11/10/2026).
  |
  | La pantalla abría en «Todos los microciclos» —la temporada entera
  | mezclada— y había que ir al desplegable cada vez. Ahora abre en el micro
  | que toca hoy, calculado de las fechas de la hoja (`microDeHoy`), y lo que
  | se elija después se queda en la URL y en la pestaña (`useFiltroPersistente`):
  | volver del informe del partido no lo pierde y «?micro=13» se puede mandar.
  | El día se apunta en un efecto, nunca en el render: el linter no deja
  | mirar el reloj mientras se pinta.
  */
  const [hoy, setHoy] = useState<Date | null>(null);

  useEffect(() => {
    const id = setTimeout(() => {
      const d = new Date();

      setHoy(new Date(d.getFullYear(), d.getMonth(), d.getDate()));
    }, 0);

    return () => clearTimeout(id);
  }, []);

  const microActual = useMemo(() => microDeHoy(rows, hoy), [rows, hoy]);

  /* Las fechas de partido de BeSoccer, para el MD de cada día (lib/microciclo/semana-de-hoy.ts). */
  const { partidos: calendarioBesoccer } = useCalendario();
  const fechasPartido = useMemo(() => fechasDePartido(calendarioBesoccer.map((p) => String(p?.cuando ?? ""))), [calendarioBesoccer]);

  const [micro, setMicro] = useFiltroPersistente("micro", microActual);
  const [informeAbierto, setInformeAbierto] = useState(false);
  const [tipoFilter, setTipoFilter] = useState("ALL");
  const [contenidoPrincipalFilter, setContenidoPrincipalFilter] =
    useState("ALL");
  const [evaluacionFilter, setEvaluacionFilter] = useState("ALL");
  const [faseFilter, setFaseFilter] = useState("ALL");
  /* 16/11/2026: «?md=MD-3» llega del calendario de contenidos (un día → su micro y su MD). */
  const [mdFilter, setMdFilter] = useFiltroPersistente<string>("md", "ALL");
  const [search, setSearch] = useState("");
  const [excludeComp, setExcludeComp] = useState(true);
  /* 29/10/2026: en el móvil los filtros van plegados tras «Filtros (n)». */
  const [filtrosAbiertos, setFiltrosAbiertos] = useState(false);

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

  /* Si la hoja falla se dice y se puede reintentar (11/10/2026): antes el
     fallo salía como «Sin resultados», que es otra cosa. Cambiar `intento`
     relanza la descarga saltándose la copia del aparato. */
  const [errorHoja, setErrorHoja] = useState<unknown>(null);
  const [intento, setIntento] = useState(0);

  useEffect(() => {
    let vivo = true;

    traeCsv(CSV_URL, { forzar: intento > 0 })
      .then((t) => {
        if (!vivo) return;

        setRows(parseCSV(t));
        setErrorHoja(null);
        setLoading(false);
      })
      .catch((e: unknown) => {
        if (!vivo) return;

        console.error(e);
        setErrorHoja(e);
        setLoading(false);
      });

    return () => {
      vivo = false;
    };
  }, [intento]);

  /*
  | TIEMPO LÍMITE (30/10/2026): si la hoja no ha llegado en 15 s, el esqueleto
  | deja paso a un aviso con «Reintentar». La descarga sigue viva por detrás:
  | si llega después, se pinta sola. Se apunta en un temporizador, nunca en
  | el render ni de forma síncrona en el efecto.
  */
  const [lenta, setLenta] = useState(false);

  useEffect(() => {
    if (!loading) return;

    const id = setTimeout(() => setLenta(true), 15_000);

    return () => clearTimeout(id);
  }, [loading, intento]);

  /* Sólo cuenta mientras se espera: al llegar la hoja deja de verse sola. */
  const esperaLarga = loading && lenta;

  const reintentaHoja = () => {
    setLoading(true);
    setErrorHoja(null);
    setLenta(false);
    setIntento((n) => n + 1);
  };

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
    () => (excludeComp ? filtered.filter((r) => !esFilaDePartido(r)) : filtered),
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
    /* La valoración, sólo de las tareas de entreno (10/11/2026): con el partido salían
       «14 valoradas» en un micro de 13 tareas de entreno. */
    const evals = filtered.filter((r) => !esFilaDePartido(r)).map((r) => r.evaluacion).filter((n) => n > 0);

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
      /* La misma cuenta en todas las pantallas (07/11/2026): «X entrenos + Y partidos». */
      entrenos: new Set(filtered.filter((r) => !esFilaDePartido(r)).map((r) => `${r.micro}-${r.md}`)).size,
      partidos: new Set(filtered.filter((r) => esFilaDePartido(r)).map((r) => `${r.micro}-${r.md}`)).size,
      tareasEntreno: filtered.filter((r) => !esFilaDePartido(r)).length,
      diversidad: new Set(filtered.map((r) => r.tipo).filter(Boolean)).size,
      jugadores: avg(filtered.map((r) => r.nJug).filter((n) => n > 0)),
    };
  }, [filtered]);

  const avgLoadPerTask = metrics.tasks ? metrics.load / metrics.tasks : 0;
  const avgCogPerTask = metrics.tasks ? metrics.cog / metrics.tasks : 0;
  const avgTimePerTask = metrics.tasks ? metrics.tiempo / metrics.tasks : 0;
  const cogRatio = metrics.load ? metrics.cog / metrics.load : 0;
  /* ¿Hay algo medido? (10/11/2026). Un micro con las tareas sin tiempo ni intensidad
     salía con «0'», «0», «0,00» y «−100 % frente al M20»: lo que no tiene minutos no
     se pinta ni se compara. */
  const hayCarga = metrics.load > 0 && metrics.tiempo > 0;
  /* Menos de la mitad de las tareas de entreno valoradas: la media es provisional (11/11/2026). */
  const evalParcial = metrics.tareasEntreno > 0 && metrics.evaluadas * 2 < metrics.tareasEntreno;

  /** Per-microcycle aggregates over the FULL dataset (for trends & rail) */
  const microStats = useMemo(() => {
    return micros.map((m) => {
      const set = rows.filter((r) => r.micro === m);
      const noComp = set.filter((r) => !esFilaDePartido(r));
      const evals = noComp.map((r) => r.evaluacion).filter((n) => n > 0);
      const fecha = set.map((r) => parseFecha(r.fecha)).filter(Boolean) as Date[];

      return {
        micro: m,
        label: `M${etiquetaMicro(m)}`,
        rival: set.find((r) => r.rival)?.rival || "",
        tareas: set.length,
        /* Las de entreno (sin el partido): un micro con sólo el partido no es «1 tarea · 0'». */
        entreno: noComp.length,
        tiempoEntreno: sum(noComp.map((r) => r.tiempo)),
        tiempo: sum(set.map((r) => r.tiempo)),
        eval: avg(evals),
        valoradas: evals.length,
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

    /*
    | LOS MISMOS DÍAS (30/10/2026). Con la semana a medias —MD-2 y MD-1 sin
    | tiempo ni intensidad todavía— la carga del micro salía un 40 % por debajo
    | del anterior y se leía como «descarga». Ahora, si hay días sin medir, se
    | compara sólo en los días MD que sí lo están, contra esos mismos días del
    | micro anterior, y se dice.
    */
    const deCur = rows.filter((r) => r.micro === cur.micro && !esFilaDePartido(r));
    const medido = (r: Row) => r.tiempo > 0 && r.intensidad > 0;
    const mds = [...new Set(deCur.map((r) => r.md).filter(Boolean))];
    const medidos = mds.filter((md) => deCur.some((r) => r.md === md && medido(r)));
    const faltan = mds.filter((md) => !medidos.includes(md));
    const posMd = (md: string) => {
      const i = (MD_SEQUENCE as readonly string[]).indexOf(md);
      return i === -1 ? 99 : i;
    };
    const ordenMd = (a: string, b: string) => posMd(a) - posMd(b);

    if (faltan.length && medidos.length) {
      const enDias = (m: number) => rows.filter((r) => r.micro === m && !esFilaDePartido(r) && medidos.includes(r.md));
      const a = enDias(cur.micro);
      const b = enDias(prev.micro);
      const evA = avg(a.map((r) => r.evaluacion).filter((n) => n > 0));
      const evB = avg(b.map((r) => r.evaluacion).filter((n) => n > 0));
      const loadA = sum(a.map((r) => r.carga));
      const loadB = sum(b.map((r) => r.carga));
      const cogA = sum(a.map((r) => r.cargaCog));
      const cogB = sum(b.map((r) => r.cargaCog));

      return {
        prev,
        mismosDias: [...medidos].sort(ordenMd),
        faltan: [...faltan].sort(ordenMd),
        loadDias: loadA,
        eval: evA > 0 && evB > 0 ? +(evA - evB).toFixed(1) : 0,
        /* Antes → después, para que cada diferencia lleve su base (07/11/2026). */
        evalAntes: evB,
        evalAhora: evA,
        loadAntes: loadB,
        loadAhora: loadA,
        cogAntes: cogB,
        cogAhora: cogA,
        load: loadA - loadB,
        loadPct: pctCambio(loadA, loadB),
        cog: cogA - cogB,
        cogPct: pctCambio(cogA, cogB),
        tareas: a.length - b.length,
        tiempo: sum(a.map((r) => r.tiempo)) - sum(b.map((r) => r.tiempo)),
      };
    }

    return {
      prev,
      mismosDias: null as string[] | null,
      faltan: [] as string[],
      loadDias: cur.load,
      eval: cur.eval > 0 && prev.eval > 0 ? +(cur.eval - prev.eval).toFixed(1) : 0,
      evalAntes: prev.eval,
      evalAhora: cur.eval,
      loadAntes: prev.load,
      loadAhora: cur.load,
      cogAntes: prev.cog,
      cogAhora: cur.cog,
      load: cur.load - prev.load,
      loadPct: pctCambio(cur.load, prev.load),
      cog: cur.cog - prev.cog,
      cogPct: pctCambio(cur.cog, prev.cog),
      /* Sólo las de entreno (16/11/2026): la tarjeta cuenta 13 y el partido va aparte. */
      tareas: cur.entreno - prev.entreno,
      tiempo: cur.tiempo - prev.tiempo,
    };
  }, [micro, microStats, rows]);

  /** «MD-4 y MD-3»: los días con que se compara cuando la semana está a medias. */
  const listaDias = (l: string[]) => (l.length <= 1 ? l.join("") : `${l.slice(0, -1).join(", ")} y ${l[l.length - 1]}`);

  /** «el M18» o «los mismos días del M18 (MD-4 y MD-3)»: contra qué se comparan las tarjetas. */
  const frenteA = microDelta
    ? microDelta.mismosDias
      ? `los mismos días del M${etiquetaMicro(microDelta.prev.micro)} (${listaDias(microDelta.mismosDias)})`
      : `el M${etiquetaMicro(microDelta.prev.micro)}`
    : undefined;

  /* ---------------- MD distribution ---------------- */

  const mdData = useMemo(() => {
    return mdOrder.map((md) => {
      const set = work.filter((r) => r.md === md);
      const totalLoad = sum(work.map((r) => r.carga)) || 1;

      return {
        md,
        tareas: set.length,
        carga: sum(set.map((r) => r.carga)),
        cargaCog: sum(set.map((r) => r.cargaCog)),
        tiempo: sum(set.map((r) => r.tiempo)),
        /* null (no 0) si ese día no tiene intensidad medida: la línea se corta. */
        intensidad:
          avg(set.map((r) => r.intensidad).filter((n) => n > 0)) || null,
        exigCog: avg(set.map((r) => r.exigCog).filter((n) => n > 0)),
        eval: avg(set.map((r) => r.evaluacion).filter((n) => n > 0)),
        pctCarga: +((sum(set.map((r) => r.carga)) / totalLoad) * 100).toFixed(1),
        /*
        | 17/11/2026 (jueces): con un micro elegido, la media de la temporada
        | de ese MD (UA de cada día con carga, de los demás micros), para ver
        | si el día va por encima o por debajo de lo habitual.
        */
        mediaMd:
          micro === "ALL"
            ? null
            : (() => {
                const porMicro = new Map<number, number>();

                for (const r of rows) {
                  if (r.md !== md || !(r.carga > 0) || String(r.micro) === micro) continue;
                  if (esFilaDePartido(r)) continue;
                  porMicro.set(r.micro, (porMicro.get(r.micro) ?? 0) + r.carga);
                }

                return porMicro.size >= 3 ? Math.round(sum([...porMicro.values()]) / porMicro.size) : null;
              })(),
      };
    });
  }, [work, mdOrder, rows, micro]);

  /* La orden de la carga por día: el MD que más se aparta de su media (±15 %), con su cifra. */
  const ordenCarga = useMemo(() => {
    const conMedia = mdData.filter((d) => d.carga > 0 && d.mediaMd);
    const peor = conMedia
      .map((d) => ({ md: d.md, pct: Math.round((100 * (d.carga - (d.mediaMd ?? 0))) / (d.mediaMd ?? 1)) }))
      .sort((a, b) => Math.abs(b.pct) - Math.abs(a.pct))[0];

    if (!peor) return "";
    if (Math.abs(peor.pct) < 15) return `Carga por día en línea con la temporada (${conMedia.length} ${conMedia.length === 1 ? "día" : "días"} comparados)`;

    return peor.pct > 0
      ? `${peor.md} va un ${peor.pct} % por encima de su media: bajar volumen si no se busca`
      : `${peor.md} va un ${Math.abs(peor.pct)} % por debajo de su media: subirlo si no es una descarga buscada`;
  }, [mdData]);

  /* Días con tareas pero sin tiempo o intensidad medidos: se avisa en una línea. */
  const diasSinMedida = useMemo(
    () =>
      mdData
        .filter((d) => d.tareas > 0 && (d.intensidad === null || d.tiempo <= 0))
        .map((d) => d.md),
    [mdData]
  );

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

  const trendData = useMemo(() => {
    const todos = microStats.map((m) => ({
      micro: m.label,
      value: m.eval > 0 ? m.eval : null,
      rival: m.rival,
      load: m.load,
      cog: m.cog,
      tareas: m.tareas,
    }));
    /* Segunda vuelta (16/11/2026): los micros del final sin ninguna valorada (el que
       está en curso) no entran: no son un hueco, aún no se han valorado. */
    let fin = todos.length;
    while (fin > 0 && todos[fin - 1].value === null) fin -= 1;
    return todos.slice(0, fin);
  }, [microStats]);

  const evalMean = avg(trendData.map((d) => d.value ?? 0).filter((n) => n > 0));

  /* El suelo del eje (5, o menos si algún micro baja de ahí) y los micros sin valorar,
     que son los huecos de la línea (16/11/2026). */
  const trendSuelo = Math.min(5, Math.floor(Math.min(10, ...trendData.map((d) => d.value ?? 10))));
  const trendSinValorar = trendData.filter((d) => d.value === null).map((d) => d.micro);

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

    /*
    | MISMA ESCALA QUE EL RESTO (07/11/2026). La carga por tarea se medía
    | contra la tarea más cargada de la hoja —el partido, 90'— y salía 0,7 de
    | 10. Ahora el 10 es el micro de la temporada con más carga por tarea de
    | entreno, y se cuenta sin el partido, como el resto de la metodología.
    */
    const porTarea = (key: "carga" | "cargaCog", set: Row[]) => {
      const s = set.filter((r) => !esFilaDePartido(r));

      return s.length ? sum(s.map((r) => r[key])) / s.length : 0;
    };
    const maxPorMicro = (key: "carga" | "cargaCog") =>
      Math.max(...micros.map((m) => porTarea(key, rows.filter((r) => r.micro === m))), 1);
    const loadTarea = porTarea("carga", filtered);
    const cogTarea = porTarea("cargaCog", filtered);
    const maxDiversidad = Math.max(
      ...microStats.map((m) => m.diversidad),
      1
    );

    /* Sólo los ejes con dato (10/11/2026): sin minutos, «Intensidad 0» con «Exig. cog. 9» no dice nada. */
    return [
      { metric: "Evaluación", value: metrics.eval, raw: metrics.eval },
      { metric: "Intensidad", value: metrics.intensidad, raw: metrics.intensidad },
      { metric: "Exig. cog.", value: metrics.exigCog, raw: metrics.exigCog },
      {
        metric: "Fís./tarea",
        value: scale(loadTarea, maxPorMicro("carga")),
        raw: Math.round(loadTarea),
      },
      {
        metric: "Cog./tarea",
        value: scale(cogTarea, maxPorMicro("cargaCog")),
        raw: Math.round(cogTarea),
      },
      {
        metric: "Diversidad",
        value: scale(metrics.diversidad, maxDiversidad),
        raw: metrics.diversidad,
      },
    ].filter((d) => d.value > 0);
  }, [
    rows,
    filtered,
    micros,
    metrics,
    microStats,
  ]);

  /* 11/11/2026: el subtítulo del perfil nombra los ejes que se dibujan, cada uno con su base. */
  const perfilSubtitulo = useMemo(() => {
    const base: Record<string, string> = {
      "Evaluación": `Evaluación: media de ${metrics.evaluadas} tarea${metrics.evaluadas === 1 ? "" : "s"} valorada${metrics.evaluadas === 1 ? "" : "s"}`,
      "Intensidad": `Intensidad: media (1-10) de las ${metrics.tareasEntreno} tareas de entreno`,
      "Exig. cog.": `Exig. cog.: demanda cognitiva media (1-10) de las ${metrics.tareasEntreno} tareas de entreno`,
      "Fís./tarea": "Fís./tarea: 10 = el micro con más carga física por tarea",
      "Cog./tarea": "Cog./tarea: 10 = el micro con más carga cognitiva por tarea",
      "Diversidad": "Diversidad: 10 = el micro con más tipos de tarea",
    };

    return `Cada eje de 0 a 10. ${radarData.map((d) => base[d.metric]).filter(Boolean).join(" · ")}`;
  }, [radarData, metrics.evaluadas, metrics.tareasEntreno]);

  /*
  | LA MEDIA DE LA TEMPORADA EN CADA BARRA DEL PERFIL (16/11/2026, segunda
  | vuelta): «Exig. cog. 9» sola no tenía referencia. Por eje, la media de los
  | micros que tienen ese dato (sin el elegido), y cuántos son.
  */
  const mediaPerfil = useMemo(() => {
    const otros = micros.filter((m) => String(m) !== micro);
    const maxDiv = Math.max(...microStats.map((m) => m.diversidad), 1);
    const porMicro = otros.map((m) => {
      const s = rows.filter((r) => r.micro === m && !esFilaDePartido(r));
      return {
        "Evaluación": avg(s.map((r) => r.evaluacion).filter((n) => n > 0)),
        "Intensidad": avg(s.map((r) => r.intensidad).filter((n) => n > 0)),
        "Exig. cog.": avg(s.map((r) => r.exigCog).filter((n) => n > 0)),
        "Diversidad": s.length ? Math.min((new Set(s.map((r) => r.tipo).filter(Boolean)).size / maxDiv) * 10, 10) : 0,
      } as Record<string, number>;
    });
    const salida: Record<string, { media: number; n: number; de: number }> = {};
    for (const eje of ["Evaluación", "Intensidad", "Exig. cog.", "Diversidad"]) {
      const v = porMicro.map((p) => p[eje]).filter((n) => n > 0);
      if (v.length >= 3) salida[eje] = { media: avg(v), n: v.length, de: porMicro.length };
    }
    return salida;
  }, [micros, micro, microStats, rows]);

  /*
  | LA CARGA DEL MICRO FRENTE A LA TEMPORADA (16/11/2026), con el cálculo de
  | /micro_calendar: UA (minutos × intensidad) de los días con carga apuntada,
  | sin el partido, entre esos días. La media de la temporada es la de los
  | demás micros con carga; con menos de 3 no se compara.
  */
  const cargaPerfil = useMemo(() => {
    if (micro === "ALL") return null;

    const porEntreno = (set: Row[]) => {
      const hechas = set.filter((r) => !esFilaDePartido(r) && r.carga > 0);
      const dias = new Set(hechas.map((r) => fechaIso(r.fecha) || r.md)).size;

      return dias ? { media: sum(hechas.map((r) => r.carga)) / dias, dias } : null;
    };

    const actual = porEntreno(rows.filter((r) => String(r.micro) === micro));
    const otros = micros
      .filter((m) => String(m) !== micro)
      .map((m) => porEntreno(rows.filter((r) => r.micro === m)))
      .filter((o): o is { media: number; dias: number } => o !== null);

    if (!actual || otros.length < 3) return null;

    const temporada = avg(otros.map((o) => o.media));

    return {
      actual: actual.media,
      dias: actual.dias,
      temporada,
      micros: otros.length,
      pct: temporada > 0 ? Math.round(((actual.media - temporada) / temporada) * 100) : 0,
    };
  }, [rows, micros, micro]);

  /* ---------------- grouped aggregations ---------------- */

  const contenidoPrincipalMetrics = useMemo(
    () => groupBy("contenidoPrincipal", work),
    [work]
  );

  const contenidoSecundarioMetrics = useMemo(
    () => groupBy("contenidoSecundario", work),
    [work]
  );

  /* 11/11/2026: el reparto por fase sigue al botón «Competición excluida»: sin el partido, sólo las de entreno. */
  /*
  | EL ANILLO DE FASES, LEGIBLE (17/11/2026, jueces). «Global» era el 64 % y
  | tapaba lo demás: va aparte, en una línea. Una tarea con dos fases («Tr
  | Ofensiva, Tr Defensiva») cuenta media en cada una, no una categoría mixta.
  | Las fases de una tarea o menos se juntan en «Otras». Y el título dice la
  | conclusión: qué fase no se ha trabajado o cuál pesa más.
  */
  const repartoFases = useMemo(() => {
    const cuenta = new Map<string, number>();
    /* 17/11/2026 (r20): «ABP» y «ABP Defensivo» salían como dos fases. Van
       juntas como «ABP», con su lado al pie; se guarda el nombre crudo para filtrar. */
    const lados = new Map<string, number>();
    const crudo = new Map<string, Set<string>>();
    const canonFase = (p: string) => (/abp|bal[oó]n\s+parado/i.test(p) ? "ABP" : p);
    let global = 0;
    let conFase = 0;

    for (const r of work) {
      const partes = String(r.fase ?? "")
        .split(/[,;/+]|\sy\s/)
        .map((s) => s.trim())
        .filter(Boolean);

      if (!partes.length) continue;

      const peso = 1 / partes.length;

      if (partes.some((p) => !/^global/i.test(p))) conFase++;

      for (const p of partes) {
        if (/^global/i.test(p)) {
          global += peso;
          continue;
        }

        const c = canonFase(p);

        cuenta.set(c, (cuenta.get(c) ?? 0) + peso);
        if (!crudo.has(c)) crudo.set(c, new Set());
        crudo.get(c)!.add(String(r.fase ?? "").trim());
        if (c === "ABP") {
          const lado = /defens/i.test(p) ? "defensivo" : "ofensivo";

          lados.set(lado, (lados.get(lado) ?? 0) + peso);
        }
      }
    }

    const lista = [...cuenta.entries()].sort((a, b) => b[1] - a[1]);
    /* 17/11/2026 (r20): si TODAS las fases eran pequeñas, se juntaban todas y
       el anillo salía con una sola porción («Otras 100 %»). Sólo se juntan con
       alguna grande al lado y al menos dos pequeñas. */
    const pequenas = lista.filter(([, n]) => n <= 1);
    const juntar = pequenas.length >= 2 && pequenas.length < lista.length;
    const detalle = (nombre: string) =>
      nombre === "ABP" && lados.size > 1 ? [...lados.entries()].map(([k, n]) => `${k} ${fmt1(n)}`) : [];
    const filtroDe = (nombre: string) => {
      const set = crudo.get(nombre);

      return set && set.size === 1 ? [...set][0] : null;
    };
    const datos = [
      ...lista
        .filter(([, n]) => !juntar || n > 1)
        .map(([nombre, valor]) => ({ nombre, valor, otras: detalle(nombre), filtro: filtroDe(nombre) })),
      ...(juntar
        ? [{ nombre: "Otras", valor: pequenas.reduce((s, [, n]) => s + n, 0), otras: pequenas.map(([n]) => n), filtro: null as string | null }]
        : []),
    ];
    const claves = [...cuenta.keys()];
    const canon = [
      { nombre: "organización ofensiva", re: /^(fase\s+)?(organizaci[oó]n\s+)?ofens|^ataque/i },
      { nombre: "organización defensiva", re: /^(fase\s+)?(organizaci[oó]n\s+)?defens|^defensa/i },
      { nombre: "transición ofensiva", re: /^tr(ansici[oó]n)?\.?\s*ofens/i },
      { nombre: "transición defensiva", re: /^tr(ansici[oó]n)?\.?\s*defens/i },
    ];
    const faltan = claves.length ? canon.filter((c) => !claves.some((k) => c.re.test(k))).map((c) => c.nombre) : [];

    return { datos, global, total: work.length, conFase, enAnillo: datos.reduce((s, d) => s + d.valor, 0), faltan, principal: lista[0] ?? null };
  }, [work]);

  const tipoMetrics = useMemo(() => groupBy("tipo", work), [work]);

  const formatoMetrics = useMemo(() => groupBy("formato", work), [work]);

  const analisisMetrics = useMemo(() => groupBy("analisisPost", work), [work]);

  const sortedByMetric = (
    data: ReturnType<typeof groupBy>,
    key: ContentMetricKey
  ) => [...data].sort((a, b) => b[key] - a[key]);

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
        Micro: etiquetaMicro(r.micro),
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

  /*
  | LECTURAS ORDENADAS Y CON QUÉ HACER (24/10/2026). Cada lectura lleva su
  | peso —lo que pide actuar va arriba: lo peor valorado, lo que falta por
  | valorar, el cambio de carga— y, cuando hay algo que hacer, lo dice.
  */
  const insights = useMemo(() => {
    const out: { icon: LucideIcon; text: string; tone: string; peso: number }[] = [];

    if (!filtered.length) return out;

    /* Con días sin medir (30/10/2026) el reparto de la carga por MD y la «descarga» no se leen: faltan días. */
    const aMedias = Boolean(microDelta?.faltan.length);

    /* La base de cada lectura es la misma población que la cifra (07/11/2026):
       sin el partido, «de 14 tareas de entreno», no las 15 de la cabecera. */
    const baseTareas = `${work.length} tarea${work.length === 1 ? "" : "s"}${excludeComp ? " de entreno" : ""}`;

    if (peakMD && peakMD.carga > 0 && !aMedias) {
      /* Contra qué se compara: el peso medio de ese MD en los micros de la temporada. */
      let mediaTemporada = 0;

      if (micro !== "ALL") {
        const pcts = micros
          .map((m) => {
            const set = rows.filter((r) => r.micro === m && (!excludeComp || !esFilaDePartido(r)));
            const total = sum(set.map((r) => r.carga));
            const delMd = sum(set.filter((r) => r.md === peakMD.md).map((r) => r.carga));

            return total > 0 && delMd > 0 ? (delMd / total) * 100 : null;
          })
          .filter((n): n is number => n !== null);

        mediaTemporada = pcts.length >= 3 ? avg(pcts) : 0;
      }

      const dif = mediaTemporada ? peakMD.pctCarga - mediaTemporada : 0;
      const orden = !mediaTemporada
        ? peakMD.pctCarga >= 50
          ? ": comprobar que el pico cae en el día que se quiere."
          : "."
        : dif >= 8
          ? `, por encima del ${fmtDec(mediaTemporada)} % de su media en la temporada: si no se busca, repartir parte de su carga en los otros días.`
          : dif <= -8
            ? `, por debajo del ${fmtDec(mediaTemporada)} % de su media en la temporada: el pico de la semana es más bajo de lo habitual.`
            : `, en línea con su media de la temporada (${fmtDec(mediaTemporada)} %).`;

      out.push({
        icon: Flame,
        tone: "text-[#C8A96B]",
        peso: peakMD.pctCarga >= 50 || Math.abs(dif) >= 8 ? 65 : 35,
        text: `${peakMD.md} concentra el ${fmtDec(peakMD.pctCarga)} % de la carga física del periodo${excludeComp ? "" : " (el partido cuenta en las cuentas)"}${orden}`,
      });
    }

    const bestTipo = [...tipoMetrics]
      /* 16/11/2026 (jueces): con menos de 5 tareas valoradas no es una lectura; no sale. */
      .filter((t) => t.eval > 0 && t.tareas >= 5)
      .sort((a, b) => b.eval - a.eval)[0];

    if (bestTipo) {
      out.push({
        icon: Star,
        tone: "text-emerald-400",
        peso: 50,
        text: `"${bestTipo.name}", el mejor valorado (${fmt1(bestTipo.eval)} de media en ${bestTipo.tareas} tarea${bestTipo.tareas === 1 ? "" : "s"}): mantenerlo en el plan.`,
      });
    }

    const worstTipo = [...tipoMetrics]
      /* 16/11/2026 (jueces): con menos de 5 tareas valoradas no es una lectura; no sale. */
      .filter((t) => t.eval > 0 && t.tareas >= 5)
      .sort((a, b) => a.eval - b.eval)[0];

    if (worstTipo && bestTipo && worstTipo.name !== bestTipo.name) {
      out.push({
        icon: Target,
        tone: "text-rose-400",
        peso: 90,
        text: `"${worstTipo.name}", valorado ${fmt1(worstTipo.eval)} de media en ${worstTipo.tareas} tareas: revisar el diseño o el día en que se aplica.`,
      });
    }

    if (hayCarga) out.push({
      icon: Brain,
      tone: "text-violet-400",
      peso: 30,
      text:
        cogRatio > 1.1
          ? `Predomina la carga cognitiva: ratio cognitivo/físico de ${fmtDec(cogRatio, 2)}.`
          : cogRatio >= 0.9
            ? `Carga equilibrada: la cognitiva y la física van a la par (${fmtDec(cogRatio, 1)}).`
            : `Predomina la carga física: ratio cognitivo/físico de ${fmtDec(cogRatio, 2)}.`,
    });

    const topContenido = contenidoPrincipalMetrics[0];

    if (topContenido) {
      out.push({
        icon: Layers,
        tone: "text-sky-400",
        peso: 20,
        text: `El contenido más trabajado es "${topContenido.name}" (${topContenido.tareas} de ${baseTareas} · ${fmt1(topContenido.pctTareas)} %).`,
      });
    }

    /* Sin minutos medidos no hay comparación de carga; la de la evaluación, sólo con 5 tareas valoradas o más (10/11/2026). */
    if (microDelta && (hayCarga || metrics.evaluadas >= 5)) {
      const prevM = microDelta.mismosDias ? `los mismos días del M${etiquetaMicro(microDelta.prev.micro)} (${listaDias(microDelta.mismosDias)})` : `M${etiquetaMicro(microDelta.prev.micro)}`;
      const evalTxt =
        microDelta.prev.eval > 0
          ? microDelta.eval === 0
            ? "la evaluación se mantiene"
            : `la evaluación ${microDelta.eval > 0 ? "sube" : "baja"} ${fmtDec(Math.abs(microDelta.eval))} pts${microDelta.evalAntes > 0 && microDelta.evalAhora > 0 ? ` (${fmtDec(microDelta.evalAntes)} → ${fmtDec(microDelta.evalAhora)})` : ""}`
          : "";
      const cargaTxt =
        microDelta.load === 0
          ? "la carga física se mantiene"
          : `la carga física ${microDelta.load > 0 ? "sube" : "baja"} ${fmtDec(Math.abs(microDelta.loadPct))} %${microDelta.loadAntes > 0 ? ` (${fmtInt(microDelta.loadAntes)} → ${fmtInt(microDelta.loadAhora)})` : ""}`;

      if (!hayCarga) {
        if (evalTxt) out.push({
          icon: Activity,
          tone: "text-amber-400",
          peso: 70,
          text: `Respecto al M${etiquetaMicro(microDelta.prev.micro)}, ${evalTxt}, en ${metrics.evaluadas} tareas valoradas.`,
        });
      } else out.push({
        icon: Activity,
        tone: "text-amber-400",
        peso: 70,
        text: `Respecto a${microDelta.mismosDias ? "" : "l"} ${prevM}, ${evalTxt ? `${evalTxt} y ` : ""}${cargaTxt}${aMedias ? `; la comparación llega hasta el último día jugado.` : microDelta.load < 0 ? ": confirmar que es la descarga buscada." : microDelta.load > 0 ? ": vigilar la recuperación." : "."}`,
      });
    }

    const sinEval = metrics.tareasEntreno - metrics.evaluadas;

    if (sinEval > 0) {
      out.push({
        icon: ListChecks,
        tone: "text-white/60",
        peso: 80,
        text: `${sinEval} tarea${sinEval === 1 ? "" : "s"} sin evaluación: valorarla${sinEval === 1 ? "" : "s"} en «Editar este micro».`,
      });
    }

    return out.sort((a, b) => b.peso - a.peso);
  }, [
    filtered,
    peakMD,
    tipoMetrics,
    cogRatio,
    contenidoPrincipalMetrics,
    microDelta,
    metrics.evaluadas,
    metrics.tareasEntreno,
    hayCarga,
    excludeComp,
    work.length,
    micro,
    micros,
    rows,
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

  const contenidoPrincipalOptions = useMemo(
    () => uniqueSorted(rows, "contenidoPrincipal"),
    [rows]
  );

  const tipoOptions = useMemo(() => uniqueSorted(rows, "tipo"), [rows]);
  const faseOptions = useMemo(() => uniqueSorted(rows, "fase"), [rows]);

  const selectedMicroStat =
    micro === "ALL"
      ? null
      : microStats.find((m) => String(m.micro) === micro) ?? null;

  /* El titular del micro elegido: «Micro 18: 19 tareas y 3h 14'; carga física 1.165 (−37,7 % sobre el M17)». */
  const titular =
    selectedMicroStat && metrics.tasks > 0
      ? /* 11/11/2026: lo que importa primero —las tareas de entreno y cuántas
           están valoradas—; el partido no se cuenta como tarea. */
        `Micro ${etiquetaMicro(selectedMicroStat.micro)}: ${metrics.tareasEntreno} ${metrics.tareasEntreno === 1 ? "tarea" : "tareas"} de entreno${metrics.tiempo > 0 ? ` y ${fmtMin(metrics.tiempo)}` : ""}${metrics.evaluadas > 0 ? `, ${metrics.evaluadas === metrics.tareasEntreno ? (metrics.evaluadas === 1 ? "valorada" : "todas valoradas") : `${metrics.evaluadas} valorada${metrics.evaluadas === 1 ? "" : "s"}`}` : ""}${
          metrics.load > 0
            ? microDelta?.mismosDias
              ? `; carga física ${listaDias(microDelta.mismosDias)}: ${fmtInt(microDelta.loadDias)}${microDelta.load !== 0 ? `, ${microDelta.load < 0 ? "−" : "+"}${fmtDec(Math.abs(microDelta.loadPct))} % frente a los mismos días del M${etiquetaMicro(microDelta.prev.micro)}` : ""} (${listaDias(microDelta.faltan)}, sin medir todavía)`
              : `; carga física ${fmtInt(metrics.load)}${microDelta && microDelta.load !== 0 ? ` (${microDelta.load < 0 ? "−" : "+"}${fmtDec(Math.abs(microDelta.loadPct))} % sobre el M${etiquetaMicro(microDelta.prev.micro)}, que tuvo ${fmtInt(microDelta.loadAntes)})` : ""}`
            : ""
        }`
      : null;

  /*
  | EL PARTIDO DEL MICRO (16/11/2026, segunda vuelta): el primero del
  | calendario desde el último día con tareas (hasta 6 días después). Si aún
  | no se ha jugado, el micro está «en curso»: titular con el MD de hoy y el
  | partido, y sin la lectura de «tareas sin evaluación».
  */
  const isoLocal = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
  const partidoDelMicro = useMemo(() => {
    if (!selectedMicroStat?.hasta) return null;
    const ultimo = isoLocal(selectedMicroStat.hasta);
    const limite = new Date(selectedMicroStat.hasta.getTime() + 6 * 86_400_000);
    return (
      calendarioBesoccer
        .filter((p) => typeof p?.cuando === "string")
        .map((p) => ({ p, dia: String(p.cuando).slice(0, 10) }))
        .filter(({ dia }) => dia >= ultimo && dia <= isoLocal(limite))
        .sort((a, b) => a.dia.localeCompare(b.dia))[0] ?? null
    );
  }, [selectedMicroStat, calendarioBesoccer]);

  const partidoPorJugar = Boolean(partidoDelMicro && !comoNuestro(partidoDelMicro.p).jugado);

  /* Con el micro en curso, «13 tareas sin evaluación» no es un hueco: se valora después del MD. */
  const lecturas = partidoPorJugar ? insights.filter((i) => !/sin evaluación/.test(i.text)) : insights;

  const titularSemana = (() => {
    if (!selectedMicroStat || !partidoDelMicro || !partidoPorJugar) return "";
    const nuestro = comoNuestro(partidoDelMicro.p);
    const hoyIso = hoy ? isoLocal(hoy) : "";
    const md = hoyIso && hoyIso <= partidoDelMicro.dia ? mdDelDia(hoyIso, fechasPartido) : "";
    const dia = new Date(`${partidoDelMicro.dia}T12:00:00Z`);
    const fecha = `${["dom", "lun", "mar", "mié", "jue", "vie", "sáb"][dia.getUTCDay()]} ${partidoDelMicro.dia.slice(8, 10)}/${partidoDelMicro.dia.slice(5, 7)}`;
    const hora = horaDelCalendarioLocal(partidoDelMicro.p.cuando);
    return [
      `Micro ${etiquetaMicro(selectedMicroStat.micro)}`,
      md,
      `${partidoDelMicro.p.jornada ? `J${partidoDelMicro.p.jornada} ` : ""}${nuestro.lado === "casa" ? "vs" : "en"} ${nombreEquipo(nuestro.rival)}`,
      `${fecha}${hora ? `, ${hora}` : ""}`,
    ]
      .filter(Boolean)
      .join(" · ");
  })();

  /*
  | LA SEMANA EN SESIÓN (24/10/2026). Por cada día del micro elegido, sus
  | tareas con los equipos de Jugadores sesión y lo que concluyó el análisis de
  | entrenamiento, y lo que se cambió en la sesión (se acepta en el editor, que
  | es el que escribe en la hoja). Ver lib/sesion-dia/conexion.ts.
  */
  const diasDelMicro = useMemo(() => {
    if (micro === "ALL") return [];

    const suyas: FilaPlan[] = rows
      .filter((r) => String(r.micro) === micro)
      .map((r) => ({
        fecha: r.fecha,
        tarea: r.tarea,
        tipoTarea: r.tipo,
        formato: r.formato,
        espacio: r.espacio,
        tiempo: r.tiempo,
        contenidoPrincipal: r.contenidoPrincipal,
        contenidoSecundario: r.contenidoSecundario,
        nComodines: r.nComodines,
        evaluacion: r.evaluacion,
        analisisPost: r.analisisPost,
        observaciones: r.observaciones,
        micro: Math.floor(r.micro),
        rival: r.rival,
        md: r.md,
        fase: r.fase,
      }));

    const fechas = [...new Set(suyas.map((r) => fechaIso(r.fecha)).filter(Boolean))].sort();

    /* El MD con la regla compartida (16/11/2026): el mismo que dan el creador y los calendarios. */
    return fechas
      .map((fecha) => ({
        fecha,
        md: mdDelDia(fecha, fechasPartido) || (suyas.find((r) => fechaIso(r.fecha) === fecha)?.md ?? ""),
        plan: planDeRegistro(suyas, fecha),
      }))
      .filter((d) => d.plan.length > 0);
  }, [rows, micro, fechasPartido]);

  const fechasDelMicro = useMemo(() => diasDelMicro.map((d) => d.fecha), [diasDelMicro]);

  const { almacen: almacenEquipos, entrenos } = useDiasConectados(fechasDelMicro);

  /*
  | 17/11/2026 (jueces): lo que el plan tenía y la sesión no («L-T1 Juego de
  | Posesión no se hizo») es una lectura de la semana, con su día. Misma regla
  | que «no se hizo» en cada día (lib/sesion-dia/conexion.ts, `enlaza`).
  */
  /* 17/11/2026 (r20, jueces): una lectura por día, con el verbo en el titular
     («Lunes: no hicimos el Juego de Posesión previsto»). */
  const lecturasDeLaSemana = useMemo(() => {
    const out: { icon: LucideIcon; text: string; tone: string; peso: number; titular?: string }[] = [];

    for (const d of diasDelMicro) {
      const equipos = sesionDeFecha(almacenEquipos?.sesiones, d.fecha);

      if (!equipos) continue;

      const enlace = enlaza(equipos.tareas, d.plan);
      const noHechas: string[] = [];
      const nombres: string[] = [];

      d.plan.forEach((p, k) => {
        if (enlace.includes(k)) return;
        const nombre = nombreVisible(p.tipo, p.contenidoPrincipal, p.formato);

        noHechas.push(`${p.codigo} ${nombre}`.trim());
        nombres.push(nombre);
      });

      if (!noHechas.length) continue;

      const dia = new Date(`${d.fecha}T12:00:00`).toLocaleDateString("es-ES", { weekday: "long" });

      out.push({
        icon: ListChecks,
        tone: "text-white/60",
        peso: 75,
        titular: `${dia.charAt(0).toUpperCase()}${dia.slice(1)}: no hicimos ${nombres.length === 1 && nombres[0] ? `el ${nombres[0]} previsto` : `${nombres.length} tareas previstas`}`,
        text: `${noHechas.join(", ")}: ${noHechas.length === 1 ? "estaba" : "estaban"} en el plan de la sesión de ${d.plan.length} tareas y no ${noHechas.length === 1 ? "se hizo" : "se hicieron"}.`,
      });
    }

    return out;
  }, [diasDelMicro, almacenEquipos]);

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

          <section className="px-4 max-[420px]:pr-12 sm:px-8 pb-12 pt-6 sm:pt-10">
            {/* ---------------- Header ---------------- */}

            <div className="mb-6">
              <p className="text-xs uppercase tracking-[0.35em] text-[#C8A96B]">
                RMCF CASTILLA · METODOLOGÍA{titular ? " · MICROCICLOS" : ""}
              </p>

              <div className="mt-4 flex flex-wrap items-center gap-3 sm:gap-5">
                {/* Con un micro elegido, el título es su lectura (24/10/2026): qué se hizo y cómo va contra el anterior. */}
                {/* Segunda vuelta (16/11/2026): con el partido por jugar, el titular es la
                    semana («Micro 22 · MD-4 · J13 vs Real Murcia · vie 20/11, 21:15») y la
                    cuenta de tareas pasa a la línea de debajo. */}
                <div className="min-w-0">
                  <h1 className={`min-w-0 font-semibold tracking-tight ${titular ? "text-2xl sm:text-3xl" : "text-3xl sm:text-4xl"}`}>
                    {titularSemana || titular || "Microciclos"}
                  </h1>
                  {titularSemana && titular ? <p className="mt-1 text-sm text-white/60">{titular.replace(/^Micro [^:]+: /, "")}</p> : null}
                </div>

                {selectedMicroStat && (
                  <span className="rounded-full border border-[#C8A96B]/40 bg-[#C8A96B]/10 px-3 py-1 text-xs sm:text-sm text-[#C8A96B]">
                    M{etiquetaMicro(selectedMicroStat.micro)}
                    {selectedMicroStat.rival
                      ? ` · ${nombreEquipo(selectedMicroStat.rival)}`
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

                {/* Del análisis a la edición de ese mismo micro (21/10/2026): antes había que buscarlo otra vez en el editor. */}
                {selectedMicroStat && /^[0-9]+$/.test(String(selectedMicroStat.micro)) && (
                  <Link
                    href={`/laboratorio/microciclo?micro=${selectedMicroStat.micro}`}
                    className="inline-flex items-center gap-2 rounded-2xl border border-white/12 px-4 py-2.5 text-sm text-white/70 transition hover:border-white/25 hover:text-white"
                    title="Abrir este microciclo en el editor: mover tareas, copiar días, sacar la lámina"
                  >
                    <Pencil className="h-4 w-4" />
                    Editar este micro
                  </Link>
                )}

                <button
                  onClick={() => setInformeAbierto(true)}
                  className="inline-flex items-center gap-2 rounded-2xl border border-[#C8A96B]/40 bg-[#C8A96B]/10 px-4 py-2.5 text-sm text-[#C8A96B] transition hover:bg-[#C8A96B]/20"
                  title="Previa o post del partido: resumen en tres diapositivas (con los duelos y el rival de un vistazo) e informe completo, por correo"
                >
                  <FileText className="h-4 w-4" />
                  Informe del partido
                </button>

                {/*
                | 17/11/2026 (jueces): el post del micro anterior es lo que corrige
                | la semana: un toque lo abre (elige ese micro y su informe).
                */}
                {(() => {
                  const i = selectedMicroStat ? microStats.findIndex((m) => m.micro === selectedMicroStat.micro) : -1;
                  const previo = i > 0 ? microStats[i - 1] : null;

                  return previo ? (
                    <button
                      type="button"
                      onClick={() => {
                        setMicro(String(previo.micro));
                        setInformeAbierto(true);
                      }}
                      className="inline-flex items-center gap-2 rounded-2xl border border-white/12 px-4 py-2.5 text-sm text-white/70 transition hover:border-white/25 hover:text-white"
                      title={`El informe post del micro ${etiquetaMicro(previo.micro)}`}
                    >
                      <FileText className="h-4 w-4" />
                      Post del M{etiquetaMicro(previo.micro)}
                      {previo.rival ? ` · ${nombreEquipo(previo.rival)}` : ""}
                    </button>
                  ) : null;
                })()}
              </div>

              {/*
              | 16/11/2026 (jueces): el rival del titular lleva a lo suyo, ya
              | elegido: plan, ABP, goles en vídeo y plantilla, con las mismas
              | llaves que la portada (components/rivals/EnlacesDelRival.tsx).
              */}
              {selectedMicroStat?.rival && !/sin partido|introduct|pretemporada|amistos/i.test(selectedMicroStat.rival) ? (
                <EnlacesDelRival
                  className="mt-3"
                  rival={nombreEquipo(selectedMicroStat.rival)}
                  fecha={
                    selectedMicroStat.hasta
                      ? `${selectedMicroStat.hasta.getFullYear()}-${String(selectedMicroStat.hasta.getMonth() + 1).padStart(2, "0")}-${String(selectedMicroStat.hasta.getDate()).padStart(2, "0")}`
                      : undefined
                  }
                />
              ) : null}
            </div>

            {informeAbierto && (
              <InformePartidoDialog
                temporada={selectedMicroStat ? rows.find((r) => r.micro === selectedMicroStat.micro)?.temporada : undefined}
                micro={selectedMicroStat?.micro}
                onClose={() => setInformeAbierto(false)}
              />
            )}

            {/* ---------------- Micro rail ---------------- */}

            {/* Su hueco mientras carga: al llegar empujaba los filtros y la
                tabla hacia abajo (Lighthouse, salto de 0,2; 14/10/2026). */}
            {loading && (
              <div aria-hidden className="mb-6 -mx-4 sm:mx-0 px-4 sm:px-0">
                <div className="flex gap-3 overflow-hidden pb-3">
                  {Array.from({ length: 6 }, (_, i) => (
                    <div key={i} className={`h-[144px] shrink-0 animate-pulse rounded-2xl border border-white/10 bg-white/[0.03] ${i ? "w-[190px]" : "w-[150px]"}`} />
                  ))}
                </div>
              </div>
            )}

            {!loading && microStats.length > 0 && (
              <div className="relative mb-6 -mx-4 sm:mx-0 px-4 sm:px-0">
                {/* 16/11/2026: un degradado a la derecha avisa de que hay más micros detrás. */}
                <div aria-hidden className="pointer-events-none absolute inset-y-0 right-0 z-10 w-16 bg-gradient-to-l from-[#0B0F14] to-transparent" />
                <div className="flex gap-3 overflow-x-auto pb-3 pr-16 scrollbar-thin">
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

                  {[...microStats].reverse().map((m) => {
                    const active = String(m.micro) === micro;
                    /* 11/11/2026: con menos de la mitad de las tareas valoradas, la
                       media es provisional: se dice su base y no lleva color de nota. */
                    const valParcial = m.entreno > 0 && m.valoradas * 2 < m.entreno;

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
                            Micro {etiquetaMicro(m.micro)}
                          </p>

                          {/* 30/10/2026: la insignia dice qué es («Val. 6,8») y sobre cuántas tareas. */}
                          {m.eval > 0 && (
                            <span
                              className={`rounded-md px-1.5 py-0.5 text-[11px] font-bold ${valParcial ? "bg-white/10 text-white/70" : ""}`}
                              style={
                                valParcial
                                  ? undefined
                                  : {
                                      background: `${getEvalColor(m.eval)}22`,
                                      color: chipInk(getEvalColor(m.eval)),
                                    }
                              }
                              title={`Valoración media ${fmtDec(m.eval)} · ${m.valoradas}${m.entreno > 0 ? ` de ${m.entreno}` : ""} tarea${m.valoradas === 1 && m.entreno <= 1 ? "" : "s"} valorada${m.valoradas === 1 && m.entreno <= 1 ? "" : "s"}${valParcial ? " · provisional" : ""}`}
                            >
                              Val. {fmtDec(m.eval)}
                              {valParcial ? ` · ${m.valoradas} de ${m.entreno}` : ""}
                            </span>
                          )}
                        </div>

                        {/* Nombre corto del club (Nàstic, Cartagena): sin «…» en el móvil (07/11/2026). */}
                        {m.rival && (
                          <p
                            className="mt-1 truncate text-sm font-semibold"
                            title={m.rival}
                          >
                            {nombreEquipo(m.rival)}
                          </p>
                        )}

                        {m.eval > 0 && (
                          <p className="mt-1 text-[11px] text-white/45">
                            {m.entreno > 0
                              ? `Valoración${valParcial ? " provisional" : " media"} · ${m.valoradas} de ${m.entreno} tareas valoradas`
                              : `Valoración media · ${m.valoradas} tarea${m.valoradas === 1 ? "" : "s"} valorada${m.valoradas === 1 ? "" : "s"}`}
                          </p>
                        )}

                        <p className="mt-3 text-[11px] text-white/50">
                          {m.entreno === 0
                            ? "Sólo el partido · sin tareas de entreno"
                            : `${m.entreno} tarea${m.entreno === 1 ? "" : "s"} de entreno${m.tiempoEntreno > 0 ? ` · ${fmtMin(m.tiempoEntreno)}` : ""}`}
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

            {/* Cabecera más ligera (10/11/2026): sin sombra ni degradado, los filtros no compiten con los indicadores. */}
            <div className="rounded-[24px] border border-white/10 bg-white/[0.02] p-4 max-md:pr-14 sm:p-6">
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-3">
                <Select
                  value={micro}
                  onChange={setMicro}
                  label="Microciclo"
                  options={[
                    { value: "ALL", label: "Todos los microciclos" },
                    ...[...microOptions].reverse().map((m) => ({
                      value: String(m.micro),
                      label: `Micro ${etiquetaMicro(m.micro)}${m.rival ? ` · ${nombreEquipo(m.rival)}` : ""}`,
                    })),
                  ]}
                />

                {/*
                | 29/10/2026: en el móvil (por debajo de sm) los seis desplegables,
                | el buscador y «Competición excluida» ocupaban una pantalla entera
                | antes de los indicadores. Ahí sólo queda a la vista el microciclo
                | y las píldoras de lo que está filtrado; el resto, tras el botón.
                */}
                <button
                  type="button"
                  onClick={() => setFiltrosAbiertos((v) => !v)}
                  aria-expanded={filtrosAbiertos}
                  /* 16/11/2026 (jueces): plegados también en el ordenador; ocupaban media pantalla antes del contenido. */
                  className="self-end rounded-2xl border border-white/10 bg-white/[0.03] px-4 py-2.5 text-left text-sm text-white/70 transition hover:border-white/25"
                >
                  {filtrosAbiertos ? "Ocultar filtros" : "Filtros"}
                  {activeFilters - (micro !== "ALL" ? 1 : 0) > 0
                    ? ` (${activeFilters - (micro !== "ALL" ? 1 : 0)})`
                    : ""}
                </button>

                <div className={filtrosAbiertos ? "contents" : "hidden"}>
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
              </div>

              <div className={`mt-4 flex-col sm:flex-row gap-3 ${filtrosAbiertos ? "flex" : "hidden"}`}>
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
                  aria-pressed={!excludeComp}
                  title="El partido (las filas de fase Competición) cuenta o no en las cifras y gráficos de esta pantalla"
                >
                  {/* 16/11/2026 (jueces): dice qué hace, no la jerga de la hoja. */}
                  {excludeComp ? "Cifras sin el partido" : "Cifras con el partido"}
                </button>
              </div>

              {/* 30/10/2026: sin chip del micro; ya lo dice el desplegable MICROCICLO. */}
              {activeFilters - (micro !== "ALL" ? 1 : 0) > 0 && (
                <div className="mt-4 flex flex-wrap gap-2">

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

              {/* KPIs. Mientras llega la hoja, su silueta en vez de ceros (30/10/2026). */}

              {loading && (
                <div aria-hidden className="mt-7 grid grid-cols-2 md:grid-cols-3 xl:grid-cols-6 gap-3 sm:gap-4">
                  {Array.from({ length: 6 }, (_, i) => (
                    <div key={i} className="h-[112px] animate-pulse rounded-2xl border border-white/10 bg-white/[0.03]" />
                  ))}
                </div>
              )}

              <div className={`mt-7 grid grid-cols-2 md:grid-cols-3 xl:grid-cols-6 gap-3 sm:gap-4 ${loading ? "hidden" : ""}`}>
                <StatCard
                  icon={ListChecks}
                  title="Tareas de entreno"
                  /* UNA SOLA CIFRA (16/11/2026): la cabecera decía 13 y la tarjeta 14 (con
                     el partido). El número es el de entreno y la base va debajo, en una
                     línea: «13 de entreno + 1 partido · 4 entrenos». */
                  value={fmtInt(metrics.tareasEntreno)}
                  hint={`${metrics.tareasEntreno} de entreno${metrics.partidos ? ` + ${metrics.partidos} partido${metrics.partidos === 1 ? "" : "s"}` : ""} · ${metrics.entrenos} entreno${metrics.entrenos === 1 ? "" : "s"}`}
                  delta={microDelta?.tareas}
                  deltaTono="neutro"
                  deltaQue="tareas"
                  deltaFrente={frenteA}
                />

                {/* Sin minutos medidos no se pinta nada del tiempo ni de la carga
                    (11/11/2026): la rejilla se queda en Tareas y Valoración. */}

                {hayCarga && (<>
                <StatCard
                  icon={Clock}
                  title="Tiempo total"
                  value={fmtMin(metrics.tiempo)}
                  hint={`Con partido incluido · ${Math.round(avgTimePerTask)}' por tarea`}
                  delta={microDelta?.tiempo}
                  deltaSuffix="'"
                  deltaTono="neutro"
                  deltaFrente={frenteA}
                />

                </>)}

                {/* 30/10/2026: sin valoraciones la tarjeta no se pinta (nada de «—»). */}
                {/* 11/11/2026: con menos de la mitad de las tareas valoradas la media es
                    provisional: la comparación sale en gris como tendencia, no en rojo o verde. */}
                {metrics.eval > 0 && (
                  <StatCard
                    icon={Star}
                    title={evalParcial ? "Valoración provisional" : "Valoración media"}
                    value={fmtDec(metrics.eval)}
                    hint={`${metrics.evaluadas} de ${metrics.tareasEntreno} tarea${metrics.tareasEntreno === 1 ? "" : "s"} de entreno valorada${metrics.evaluadas === 1 ? "" : "s"}${evalParcial ? " · tendencia" : ""}`}
                    accent={evalParcial ? "#9CA3AF" : getEvalColor(metrics.eval)}
                    delta={microDelta?.eval}
                    decimals={1}
                    deltaTono={evalParcial ? "neutro" : "valor"}
                    deltaFrente={frenteA}
                    deltaBase={microDelta && microDelta.evalAntes > 0 && microDelta.evalAhora > 0 ? `${fmtDec(microDelta.evalAntes)} → ${fmtDec(microDelta.evalAhora)}` : undefined}
                  />
                )}

                {hayCarga && (<>
                <StatCard
                  icon={Flame}
                  title="Carga física"
                  value={fmtInt(metrics.load)}
                  hint={`minutos × intensidad · ${Math.round(avgLoadPerTask)} por tarea`}
                  accent={COLORS.blue}
                  delta={microDelta?.loadPct}
                  deltaSuffix=" %"
                  decimals={1}
                  deltaTono="neutro"
                  deltaFrente={frenteA}
                  deltaBase={microDelta && microDelta.loadAntes > 0 ? `${fmtInt(microDelta.loadAntes)} → ${fmtInt(microDelta.loadAhora)}` : undefined}
                />

                <StatCard
                  icon={Brain}
                  title="Carga cognitiva"
                  value={fmtInt(metrics.cog)}
                  hint={`minutos × demanda cognitiva · ${Math.round(avgCogPerTask)} por tarea`}
                  accent={COLORS.purple}
                  delta={microDelta?.cogPct}
                  deltaSuffix=" %"
                  decimals={1}
                  deltaTono="neutro"
                  deltaFrente={frenteA}
                  deltaBase={microDelta && microDelta.cogAntes > 0 ? `${fmtInt(microDelta.cogAntes)} → ${fmtInt(microDelta.cogAhora)}` : undefined}
                />

                <StatCard
                  icon={Gauge}
                  title="Cognitiva / física"
                  value={fmtDec(cogRatio, 2)}
                  hint={`más de 1 = pesa más lo cognitivo; menos de 1, lo físico${metrics.intensidad ? ` · intensidad media ${fmtDec(metrics.intensidad)}` : ""}`}
                  accent={COLORS.green}
                />
                </>)}
              </div>
            </div>

            {/* ---------------- Tabs ---------------- */}

            {/* En el móvil las pestañas pasan a otra línea: ninguna queda escondida a la derecha (07/11/2026). */}
            <div className="mt-8 flex flex-wrap gap-2 pb-1 sm:flex-nowrap sm:overflow-x-auto">
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

            {esperaLarga && (
              <EstadoError
                className="mt-8"
                titulo="La hoja de microciclos está tardando más de lo normal"
                error="Sigue cargando por detrás: si llega, se pinta sola. También puedes pedirla otra vez."
                onReintentar={reintentaHoja}
              />
            )}

            {loading && !esperaLarga && (
              <div className="mt-8 grid grid-cols-1 xl:grid-cols-2 gap-6">
                {[0, 1, 2, 3].map((i) => (
                  <div
                    key={i}
                    className="h-[380px] animate-pulse rounded-3xl border border-white/10 bg-white/[0.03]"
                  />
                ))}
              </div>
            )}

            {!loading && errorHoja !== null && rows.length === 0 && (
              <EstadoError
                className="mt-10"
                titulo="No se ha podido cargar la hoja de microciclos"
                error={errorHoja}
                onReintentar={reintentaHoja}
              />
            )}

            {!loading && !(errorHoja !== null && rows.length === 0) && filtered.length === 0 && (
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
              /*
              | 16/11/2026 (jueces, segunda vuelta): lo primero, la conclusión —las
              | lecturas, el perfil y la tendencia—; la semana tarea a tarea, debajo.
              | Con «order», sin mover los bloques.
              */
              <div className="mt-8 flex flex-col gap-6">
                {diasDelMicro.length > 0 && (
                  <Panel
                    className="order-3"
                    title="La semana en sesión"
                    subtitle="Los equipos de Jugadores sesión y lo que midió el análisis de entrenamiento, junto a cada tarea"
                  >
                    {/* Una lista de días, de arriba abajo (10/11/2026): en dos columnas quedaba el martes a un lado y el miércoles suelto. */}
                    <div className="grid min-w-0 grid-cols-1 gap-4">
                      {diasDelMicro.map((d) => {
                        const equipos = sesionDeFecha(almacenEquipos?.sesiones, d.fecha);

                        return (
                          <div key={d.fecha} className="min-w-0 space-y-1.5">
                            <p className="text-sm font-semibold">
                              {new Date(`${d.fecha}T12:00:00`).toLocaleDateString("es-ES", { weekday: "long", day: "numeric", month: "short" })}
                              {d.md ? <span className="ml-2 text-xs font-normal text-[#C8A96B]">{d.md}</span> : null}
                              <span className="ml-2 text-xs font-normal text-white/45">
                                {d.plan.length} {d.plan.length === 1 ? "tarea" : "tareas"}
                              </span>
                            </p>
                            <DiaConectado
                              fecha={d.fecha}
                              plan={d.plan}
                              sesion={equipos}
                              entreno={entrenos[d.fecha]}
                              micro={d.plan[0]?.micro}
                              propuestas={propuestasDeLaSesion(equipos, d.plan)}
                            />
                          </div>
                        );
                      })}
                    </div>
                  </Panel>
                )}

                {/*
                | 17/11/2026 (r20, jueces): el Resumen abre con la carga por MD (la
                | orden de la semana). Las lecturas pasan a dos tarjetas con el verbo
                | en el titular; el resto, plegado.
                */}
                {[...lecturasDeLaSemana, ...lecturas].length > 0 && (() => {
                  const todas = [...lecturasDeLaSemana, ...lecturas]
                    .map((l, k) => ({ icon: l.icon, tone: l.tone, peso: l.peso, text: l.text, titular: ("titular" in l ? l.titular : undefined) as string | undefined, k }))
                    .sort((a, b) => b.peso - a.peso || a.k - b.k);
                  const partir = (l: (typeof todas)[number]) => {
                    if (l.titular) return { t: l.titular, c: l.text };
                    const corte = l.text.search(/[:.](\s|$)/);

                    return corte > 0 && corte <= 80 ? { t: l.text.slice(0, corte), c: l.text.slice(corte + 1).trim() } : { t: l.text, c: "" };
                  };

                  return (
                    <div className="order-2">
                      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
                        {todas.slice(0, 2).map((l) => {
                          const Icon = l.icon;
                          const { t, c } = partir(l);

                          return (
                            <div key={l.k} className="rounded-3xl border border-white/10 bg-gradient-to-br from-[#C8A96B]/[0.07] to-white/[0.02] p-5">
                              <p className="flex items-start gap-2 text-base font-semibold leading-snug">
                                <Icon className={`mt-0.5 h-4 w-4 shrink-0 ${l.tone}`} />
                                {t}
                              </p>
                              {c ? <p className="mt-2 text-sm leading-relaxed text-white/70">{c}</p> : null}
                            </div>
                          );
                        })}
                      </div>
                      {todas.length > 2 && (
                        <details className="mt-3 rounded-2xl border border-white/10 bg-white/[0.02] px-4 py-3">
                          <summary className="cursor-pointer text-sm font-semibold text-white/75">
                            <Sparkles className="mr-1.5 inline h-4 w-4 text-[#C8A96B]" />
                            {todas.length - 2} {todas.length - 2 === 1 ? "lectura más" : "lecturas más"}
                          </summary>
                          <div className="mt-3 grid grid-cols-1 gap-x-8 gap-y-3 lg:grid-cols-2">
                            {todas.slice(2).map((l) => {
                              const Icon = l.icon;

                              return (
                                <div key={l.k} className="flex items-start gap-3">
                                  <Icon className={`mt-0.5 h-4 w-4 shrink-0 ${l.tone}`} />
                                  <p className="text-sm leading-relaxed text-white/75">{l.text}</p>
                                </div>
                              );
                            })}
                          </div>
                        </details>
                      )}
                    </div>
                  );
                })()}

                {/* items-start (16/11/2026): cada tarjeta mide lo que su contenido; el perfil
                    de dos barras ya no se estira a la altura del gráfico de al lado. */}
                <div className="order-1 grid grid-cols-1 items-stretch xl:grid-cols-2 gap-5 sm:gap-6">
                  {/* 11/11/2026: sin minutos medidos el bloque no se pinta (nada de «aún sin medir»). */}
                  {hayCarga && (
                  <Panel
                    className="order-first xl:col-span-2"
                    /* 17/11/2026 (jueces): el título es la orden de la semana, con la media de cada MD dibujada. */
                    title={ordenCarga || "Distribución de carga en el microciclo"}
                    subtitle={`Carga física y cognitiva por día (UA = minutos × intensidad), con intensidad media${mdData.some((d) => d.mediaMd) ? "; la línea discontinua es la media de la temporada de cada MD" : ""}`}
                  >
                    {!mdData.some((d) => d.carga > 0 || d.cargaCog > 0) ? (
                      <p className="rounded-2xl border border-white/10 bg-white/[0.02] px-4 py-6 text-sm text-white/60">
                        Las {metrics.tareasEntreno} tareas de entreno aún no tienen tiempo ni intensidad: la carga por día sale en cuanto se midan.
                      </p>
                    ) : (<>
                    {diasSinMedida.length > 0 && (
                      <p className="mb-2 text-[11px] text-white/45">
                        {diasSinMedida.join(", ")}: sesión sin tiempo o
                        intensidad medidos; la línea de intensidad se corta ahí.
                      </p>
                    )}
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
                          ticks={[0, 2, 4, 6, 8, 10]}
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
                          isAnimationActive={false}
                          radius={[8, 8, 0, 0]}
                        />

                        <Bar
                          yAxisId="left"
                          dataKey="cargaCog"
                          name="Carga cognitiva"
                          fill={COLORS.blue}
                          isAnimationActive={false}
                          radius={[8, 8, 0, 0]}
                        />

                        {mdData.some((d) => d.mediaMd) ? (
                          <Line
                            yAxisId="left"
                            type="monotone"
                            dataKey="mediaMd"
                            name="Media de la temporada (física)"
                            isAnimationActive={false}
                            stroke="rgba(148,163,184,.9)"
                            strokeDasharray="5 4"
                            strokeWidth={2}
                            dot={{ r: 3 }}
                            connectNulls={false}
                          />
                        ) : null}

                        <Line
                          yAxisId="right"
                          type="monotone"
                          dataKey="intensidad"
                          name="Intensidad"
                          isAnimationActive={false}
                          stroke={COLORS.purple}
                          strokeWidth={3}
                          dot={{ r: 4, fill: COLORS.purple }}
                          activeDot={{ r: 6 }}
                        />
                      </ComposedChart>
                    </Chart>
                    </>)}
                  </Panel>
                  )}

                  {/*
                  | 16/11/2026 (jueces): con barras (3 ejes o menos), el perfil va a
                  | todo el ancho y en una fila de tres; a media columna dejaba un
                  | hueco junto a la tendencia.
                  */}
                  <Panel
                    className={`order-1 ${radarData.length < 4 ? "xl:col-span-2" : ""}`}
                    title="Perfil del microciclo"
                    subtitle={perfilSubtitulo}
                  >
                    {/* 16/11/2026: la carga del micro frente a la temporada, con el cálculo de
                        /micro_calendar (UA de los días hechos ÷ esos días). */}
                    {cargaPerfil ? (
                      <p className="mb-4 rounded-xl border border-white/10 bg-white/[0.03] px-3 py-2 text-[13px] text-white/75">
                        <span className="font-semibold text-[#C8A96B]">{fmtInt(cargaPerfil.actual)} UA</span> de carga física por entreno ({cargaPerfil.dias} {cargaPerfil.dias === 1 ? "entreno hecho" : "entrenos hechos"}) frente a{" "}
                        <span className="font-semibold">{fmtInt(cargaPerfil.temporada)} UA</span> de media en la temporada ({cargaPerfil.micros} micros)
                        {cargaPerfil.pct !== 0 ? ` · ${cargaPerfil.pct > 0 ? "+" : "−"}${Math.abs(cargaPerfil.pct)} %` : ""}
                      </p>
                    ) : null}
                    {/* Con 3 ejes o menos un triángulo no se lee: van como barras de 0 a 10 (11/11/2026). */}
                    {radarData.length >= 4 ? (
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
                          isAnimationActive={false}
                          dataKey="value"
                          stroke={COLORS.gold}
                          strokeWidth={3}
                          fill={COLORS.gold}
                          fillOpacity={0.35}
                        />
                      </RadarChart>
                    </Chart>
                    ) : (
                      <div className="grid gap-4 sm:grid-cols-3">
                        {radarData.map((d) => {
                          /* 16/11/2026 (jueces): con menos de 5 micros con dato no hay media firme: «tendencia · 3 micros» y sin marca. */
                          const ref = mediaPerfil[d.metric];
                          const firme = Boolean(ref && ref.n >= 5);

                          return (
                          <div key={d.metric} className="min-w-0">
                            <div className="flex flex-wrap items-baseline justify-between gap-x-2 text-xs">
                              <span className="text-white/60">{d.metric}</span>
                              <span className="font-semibold text-[#C8A96B]">
                                {fmt1(d.value)}
                                {ref ? (
                                  <span className="ml-1.5 font-normal text-white/55">
                                    {firme ? `· media ${fmt1(ref.media)} en ${ref.n} micros` : `· tendencia · ${ref.n} de ${ref.de} micros con dato`}
                                  </span>
                                ) : null}
                              </span>
                            </div>
                            <div className="relative mt-1 h-2 rounded-full bg-white/10">
                              {/* 17/11/2026 (jueces): sin base firme, atenuada y rayada: no se lee como fortaleza. */}
                              <div
                                className={`h-full rounded-full ${ref && !firme ? "opacity-40" : ""}`}
                                style={{
                                  width: `${Math.min(d.value, 10) * 10}%`,
                                  background: ref && !firme ? "repeating-linear-gradient(135deg, #C8A96B 0 4px, transparent 4px 7px)" : "#C8A96B",
                                }}
                              />
                              {/* La marca de la media de la temporada (16/11/2026), sólo con base firme. */}
                              {ref && firme ? (
                                <span
                                  aria-hidden
                                  title={`Media de la temporada: ${fmt1(ref.media)} (${ref.n} micros)`}
                                  className="absolute -top-1 h-4 w-0.5 rounded-full"
                                  style={{ left: `${Math.min(ref.media, 10) * 10}%`, background: "rgb(var(--rmcf-ink-rgb) / .85)" }}
                                />
                              ) : null}
                              {/* Marcas en 2, 4, 6 y 8. */}
                              {[2, 4, 6, 8].map((t) => (
                                <span key={t} aria-hidden className="absolute top-0 h-full w-px bg-white/20" style={{ left: `${t * 10}%` }} />
                              ))}
                            </div>
                          </div>
                          );
                        })}
                        {/* 17/11/2026 (r20): el rayado se explica. */}
                        {radarData.some((d) => mediaPerfil[d.metric] && mediaPerfil[d.metric].n < 5) ? (
                          <p className="flex items-center gap-2 text-[11px] text-white/55 sm:col-span-3">
                            <span
                              aria-hidden
                              className="inline-block h-2 w-8 rounded-full opacity-60"
                              style={{ background: "repeating-linear-gradient(135deg, #C8A96B 0 4px, transparent 4px 7px)" }}
                            />
                            Rayada: menos de 5 micros con dato para comparar; se lee como tendencia, no como media.
                          </p>
                        ) : null}
                      </div>
                    )}

                    <div className={`mt-4 grid grid-cols-3 gap-2 ${radarData.length < 4 ? "hidden" : ""}`}>
                      {radarData.map((d) => (
                        <div
                          key={d.metric}
                          className="rounded-xl border border-white/5 bg-white/[0.03] px-3 py-2"
                        >
                          <p className="truncate text-[10px] uppercase tracking-wider text-white/40">
                            {d.metric}
                          </p>

                          <p className="text-sm font-semibold text-[#C8A96B]">
                            {typeof d.value === "number" ? fmt1(d.value) : d.value}
                          </p>
                        </div>
                      ))}
                    </div>
                  </Panel>

                  <Panel
                    className="order-2"
                    title="Tendencia de evaluación por microciclo"
                    /* 16/11/2026: el corte de la línea se explica (micros sin tareas valoradas). */
                    subtitle={`Media de la temporada: ${fmt1(evalMean)}${trendSinValorar.length ? ` · la línea se corta en ${trendSinValorar.join(", ")}: sin tareas valoradas` : ""}`}
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

                        {/* Eje acotado (16/11/2026): las medias viven entre 6 y 8, y de 0 a 10 la línea salía plana. */}
                        <YAxis
                          domain={[trendSuelo, 10]}
                          ticks={Array.from({ length: 11 - trendSuelo }, (_, i) => trendSuelo + i)}
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
                          isAnimationActive={false}
                          stroke={COLORS.gold}
                          strokeWidth={3}
                          fill="url(#evalGrad)"
                          connectNulls={false}
                          dot={{ r: 4, fill: COLORS.gold }}
                          activeDot={{ r: 7 }}
                        />
                      </ComposedChart>
                    </Chart>
                    {/*
                    | 17/11/2026 (jueces): bajo la línea, el mejor, el peor y el último
                    | micro valorados, para que el panel no deje un hueco y se lea sin
                    | pasar el ratón.
                    */}
                    {(() => {
                      const valorados = trendData.filter((d) => d.value !== null) as { micro: string; value: number; rival: string }[];

                      if (valorados.length < 2) return null;

                      const mejor = valorados.reduce((a, b) => (b.value > a.value ? b : a));
                      const peor = valorados.reduce((a, b) => (b.value < a.value ? b : a));
                      const ultimo = valorados[valorados.length - 1];
                      const fila = (rotulo: string, d: { micro: string; value: number; rival: string }) => (
                        <div key={rotulo} className="min-w-0 rounded-xl border border-white/10 bg-white/[0.03] px-3 py-2">
                          <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-white/50">{rotulo}</p>
                          <p className="text-lg font-semibold tabular-nums text-[#C8A96B]">{fmt1(d.value)}</p>
                          <p className="truncate text-[12px] text-white/60">
                            {d.micro}
                            {d.rival ? ` · ${nombreEquipo(d.rival)}` : ""}
                          </p>
                        </div>
                      );

                      return <div className="mt-3 grid grid-cols-3 gap-2">{[fila("Mejor", mejor), fila("Peor", peor), fila("Último", ultimo)]}</div>;
                    })()}
                  </Panel>

                  <Panel
                    className="order-3"
                    title={
                      repartoFases.faltan.length
                        ? `Sin ${repartoFases.faltan.join(" ni ")} ${micro !== "ALL" ? "esta semana" : "en el periodo"}: 0 de ${repartoFases.total}`
                        : repartoFases.principal
                          ? `Más peso: ${repartoFases.principal[0]} (${fmt1(repartoFases.principal[1])} de ${repartoFases.total} tareas)`
                          : "Reparto por fase de juego"
                    }
                    subtitle={`${
                      repartoFases.global > 0
                        ? `Fuera de Global (${fmt1(repartoFases.global)} de ${repartoFases.total}), ${repartoFases.conFase} tarea${repartoFases.conFase === 1 ? "" : "s"}${excludeComp ? " de entreno" : ""}: ${repartoFases.datos
                            .map((f) => `${f.nombre} ${fmt1(f.valor)}`)
                            .join(", ")}`
                        : `Reparto por fase de juego · ${repartoFases.total} tarea${repartoFases.total === 1 ? "" : "s"}${excludeComp ? " de entreno" : ""}`
                    } · una tarea con dos fases cuenta media en cada una`}
                  >
                    {/* 17/11/2026 (r20): con menos de 6 tareas con fase el anillo no se
                        lee; van barras horizontales con su cifra. */}
                    {repartoFases.enAnillo > 0 && repartoFases.enAnillo < 6 ? (
                      <div className="space-y-2">
                        {repartoFases.datos.map((f, i) => {
                          const max = Math.max(...repartoFases.datos.map((d) => d.valor), 1);

                          return (
                            <button
                              key={f.nombre}
                              onClick={() => {
                                if (f.filtro) setFaseFilter(faseFilter === f.filtro ? "ALL" : f.filtro);
                              }}
                              className="grid w-full grid-cols-[minmax(0,9rem)_1fr_auto] items-center gap-3 rounded-xl px-2 py-1.5 text-left hover:bg-white/5"
                            >
                              <span className="min-w-0 text-sm text-white/80">
                                {f.nombre}
                                {f.otras.length ? <span className="block text-[11px] text-white/55">{f.otras.join(" · ")}</span> : null}
                              </span>
                              <span className="h-3 rounded-full bg-white/5">
                                <span
                                  className="block h-3 rounded-full"
                                  style={{ width: `${(100 * f.valor) / max}%`, background: PIE_COLORS[i % PIE_COLORS.length] }}
                                />
                              </span>
                              <span className="text-sm font-semibold tabular-nums">{fmt1(f.valor)}</span>
                            </button>
                          );
                        })}
                      </div>
                    ) : (
                    <div className="flex flex-col lg:flex-row items-center gap-4">
                      {/* 16/11/2026: el anillo se dibuja a mano en SVG. El de recharts iba
                          diferido y animado, y en la captura de los jueces quedaba medio
                          panel en blanco. */}
                      <div className="flex w-full justify-center lg:w-1/2">
                        <AnilloFases
                          datos={repartoFases.datos.map((f, i) => ({ nombre: f.nombre, valor: f.valor, color: PIE_COLORS[i % PIE_COLORS.length] }))}
                          activo={faseFilter}
                          total={Math.round(repartoFases.enAnillo * 10) / 10}
                          onElige={(n) => {
                            const fil = repartoFases.datos.find((d) => d.nombre === n)?.filtro;

                            if (fil) setFaseFilter(faseFilter === fil ? "ALL" : fil);
                          }}
                        />
                      </div>

                      <div className="w-full lg:w-1/2 space-y-2">
                        {repartoFases.datos.map((f, i) => (
                          <button
                            key={f.nombre}
                            onClick={() => {
                              if (f.filtro) setFaseFilter(faseFilter === f.filtro ? "ALL" : f.filtro);
                            }}
                            title={f.otras.length ? f.otras.join(", ") : undefined}
                            className="flex w-full items-center gap-3 rounded-xl px-2 py-1.5 text-left hover:bg-white/5"
                          >
                            <span
                              className="h-2.5 w-2.5 shrink-0 rounded-full"
                              style={{
                                background: PIE_COLORS[i % PIE_COLORS.length],
                              }}
                            />

                            <span className="min-w-0 flex-1 text-sm text-white/80">
                              {f.nombre}
                              {f.otras.length ? <span className="block text-[11px] text-white/50">{f.otras.join(", ")}</span> : null}
                            </span>

                            <span className="text-sm font-semibold tabular-nums">
                              {fmt1(f.valor)}
                            </span>

                            <span className="w-12 text-right text-xs text-white/45">
                              {repartoFases.enAnillo > 0 ? fmt1((100 * f.valor) / repartoFases.enAnillo) : "0"} %
                            </span>
                          </button>
                        ))}
                      </div>
                    </div>
                    )}
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
                          ticks={[0, 2, 4, 6, 8, 10]}
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
                          content={({ active, payload }) => {
                            if (!active || !payload?.length) return null;

                            const d = payload[0].payload;

                            return (
                              <div className="rounded-xl border border-white/10 bg-[#141A22] p-3 shadow-xl">
                                <p className="mb-1 font-semibold text-white">
                                  {d.tarea}
                                </p>

                                <p className="text-xs text-white/50">
                                  M{etiquetaMicro(d.micro)} · {d.md} · {d.tipo}
                                </p>

                                <div className="mt-2 space-y-0.5 text-xs">
                                  <p style={{ color: chipInk(getEvalColor(d.eval)) }}>
                                    Evaluación: {typeof d.eval === "number" ? fmt1(d.eval) : d.eval}
                                  </p>

                                  <p className="text-slate-300">
                                    Carga física: {typeof d.carga === "number" ? fmt1(d.carga) : d.carga}
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
                      <ResponsiveConVistas width="100%" height="100%" initialDimension={{ width: 560, height: contenidoPrincipalHeight }}>
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
                            onClick={(d) => {
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
                              formatter={(v) =>
                                typeof v === "number"
                                  ? contentMetric === "eval"
                                    ? fmtDec(v)
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
                      </ResponsiveConVistas>
                    </div>
                  </Panel>

                  <Panel
                    title="Contenido secundario"
                    subtitle="Top 15 subcontenidos trabajados"
                  >
                    <div style={{ height: contenidoSecundarioHeight }}>
                      <ResponsiveConVistas width="100%" height="100%" initialDimension={{ width: 560, height: contenidoSecundarioHeight }}>
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
                              formatter={(v) =>
                                typeof v === "number"
                                  ? contentMetric === "eval"
                                    ? fmtDec(v)
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
                      </ResponsiveConVistas>
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
                                  {fmt1(c.pctTareas)} %
                                </span>
                              </div>
                            </td>

                            <td className="px-3 text-right text-white/75">
                              {c.tiempo}&apos;
                            </td>

                            <td className="px-3 text-right text-white/50">
                              {fmt1(c.pctTiempo)} %
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
                      <ResponsiveConVistas width="100%" height="100%">
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
                            ticks={[0, 2, 4, 6, 8, 10]}
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
                            onClick={(d) => {
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
                              formatter={(v) =>
                                typeof v === "number" ? fmtDec(v) : v ?? ""
                              }
                              style={{
                                fill: "#fff",
                                fontSize: 11,
                                fontWeight: 600,
                              }}
                            />
                          </Bar>
                        </BarChart>
                      </ResponsiveConVistas>
                    </div>
                  </Panel>

                  <Panel
                    title="Formatos de tarea más usados"
                    subtitle="Top 12 estructuras de juego (jugadores + comodines)"
                  >
                    <div style={{ height: formatoHeight }}>
                      <ResponsiveConVistas width="100%" height="100%">
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
                      </ResponsiveConVistas>
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
                          ticks={[0, 2, 4, 6, 8, 10]}
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
                          ticks={[0, 2, 4, 6, 8, 10]}
                          tick={{ fill: "#94A3B8", fontSize: 11 }}
                        />

                        <YAxis
                          type="number"
                          dataKey="eval"
                          name="Evaluación"
                          domain={[0, 10]}
                          ticks={[0, 2, 4, 6, 8, 10]}
                          tick={{ fill: "#94A3B8", fontSize: 11 }}
                        />

                        <ZAxis dataKey="tiempo" range={[60, 320]} />

                        <Tooltip
                          cursor={{ strokeDasharray: "3 3" }}
                          content={({ active, payload }) => {
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
                                  <p>Demanda cognitiva: {typeof d.demandaCog === "number" ? fmt1(d.demandaCog) : d.demandaCog}</p>
                                  <p style={{ color: chipInk(getEvalColor(d.eval)) }}>
                                    Evaluación: {typeof d.eval === "number" ? fmt1(d.eval) : d.eval}
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
                      <ResponsiveConVistas width="100%" height="100%">
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
                      </ResponsiveConVistas>
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
                      {/* Con el índice: la hoja repite nombres de tarea en
                          un mismo micro (dos «L-T1» el 21/09) y la clave
                          repetida deja filas sin pintar. */}
                      {topTasks.map((t, i) => (
                        <TaskRow key={`${t.micro}-${t.tarea}-${i}`} row={t} />
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
                      {bottomTasks.map((t, i) => (
                        <TaskRow key={`${t.micro}-${t.tarea}-b${i}`} row={t} />
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
                            titulo="Minutos de la tarea"
                            k="tiempo"
                            sortKey={sortKey}
                            sortDir={sortDir}
                            onSort={toggleSort}
                            align="right"
                          />
                          <Th
                            label="Int"
                            titulo="Intensidad de la tarea"
                            k="intensidad"
                            sortKey={sortKey}
                            sortDir={sortDir}
                            onSort={toggleSort}
                            align="right"
                          />
                          <Th
                            label="C.Fís"
                            titulo="Carga física: minutos × intensidad"
                            k="carga"
                            sortKey={sortKey}
                            sortDir={sortDir}
                            onSort={toggleSort}
                            align="right"
                          />
                          <Th
                            label="C.Cog"
                            titulo="Carga cognitiva: minutos × demanda cognitiva"
                            k="cargaCog"
                            sortKey={sortKey}
                            sortDir={sortDir}
                            onSort={toggleSort}
                            align="right"
                          />
                          <Th
                            label="Eval"
                            titulo="Evaluación del cuerpo técnico"
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
                                {/* «M13B», no «M13.1» (19/10/2026): la
                                    semana del segundo rival lleva su letra
                                    igual que en el resto de la pantalla. */}
                                M{etiquetaMicro(r.micro)}
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

/** Lo que Recharts le pasa al contenido del tooltip, en lo que aquí se usa. */
type EntradaTooltip = {
  name?: string | number;
  value?: ReactNode;
  color?: string;
  payload?: Record<string, ReactNode>;
};

function Chart({
  children,
  height,
}: {
  children: ReactNode;
  height?: number;
}) {
  /*
  | Con medida de partida (24/10/2026): sin ella, ResponsiveContainer no pinta
  | nada hasta que el navegador le dice cuánto mide, y en una captura (o un
  | móvil lento) las tarjetas salían en blanco. Al llegar la medida de verdad
  | se redibuja con ella.
  */
  return (
    <div className="w-full" style={{ height: height ?? 380 }}>
      <ResponsiveConVistas width="100%" height="100%" initialDimension={{ width: 560, height: height ?? 380 }}>
        {children}
      </ResponsiveConVistas>
    </div>
  );
}

function Panel({
  title,
  subtitle,
  action,
  children,
  className = "",
}: {
  title: ReactNode;
  subtitle?: ReactNode;
  action?: ReactNode;
  children?: ReactNode;
  className?: string;
}) {
  return (
    <div className={`min-w-0 rounded-3xl border border-white/10 bg-white/[0.03] p-4 sm:p-6 shadow-xl ${className}`}>
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

/**
 * El anillo del reparto por fase (16/11/2026), en SVG sin librerías: se ve en
 * cuanto hay datos, sin esperar a medir el contenedor ni a una animación. Cada
 * tramo se pulsa para filtrar, como la lista de al lado; en el centro, el total.
 */
function AnilloFases({
  datos,
  activo,
  total,
  onElige,
}: {
  datos: { nombre: string; valor: number; color: string }[];
  activo: string;
  total: number;
  onElige: (nombre: string) => void;
}) {
  const suma = datos.reduce((s, d) => s + d.valor, 0);

  if (suma <= 0) return null;

  const R = 92;
  const r = 58;
  const C = 110;
  const punto = (ang: number, radio: number) => [C + radio * Math.sin(ang), C - radio * Math.cos(ang)];
  /* Dónde empieza cada tramo: la suma de los anteriores. */
  const inicios = datos.map((_, i) => datos.slice(0, i).reduce((s, d) => s + d.valor, 0) / suma);

  return (
    <svg viewBox="0 0 220 220" className="h-[220px] w-[220px] max-w-full" role="img" aria-label={`Reparto por fase de ${total} tareas`}>
      {datos.map((d, i) => {
        const frac = d.valor / suma;
        const desde = inicios[i];
        const a0 = desde * 2 * Math.PI;
        const a1 = (desde + frac) * 2 * Math.PI - (datos.length > 1 ? 0.025 : 0);

        const apagado = activo !== "ALL" && activo !== d.nombre;

        if (frac >= 0.999) {
          return (
            <circle key={d.nombre} cx={C} cy={C} r={(R + r) / 2} fill="none" strokeWidth={R - r} style={{ stroke: d.color, opacity: apagado ? 0.25 : 1, cursor: "pointer" }} onClick={() => onElige(d.nombre)}>
              <title>{`${d.nombre}: ${d.valor}`}</title>
            </circle>
          );
        }

        const grande = a1 - a0 > Math.PI ? 1 : 0;
        const [x0, y0] = punto(a0, R);
        const [x1, y1] = punto(a1, R);
        const [x2, y2] = punto(a1, r);
        const [x3, y3] = punto(a0, r);

        return (
          <path
            key={d.nombre}
            d={`M${x0} ${y0} A${R} ${R} 0 ${grande} 1 ${x1} ${y1} L${x2} ${y2} A${r} ${r} 0 ${grande} 0 ${x3} ${y3} Z`}
            style={{ fill: d.color, opacity: apagado ? 0.25 : 1, cursor: "pointer" }}
            onClick={() => onElige(d.nombre)}
          >
            <title>{`${d.nombre}: ${d.valor} (${Math.round(frac * 100)} %)`}</title>
          </path>
        );
      })}
      <text x={C} y={C - 4} textAnchor="middle" style={{ fill: "rgb(var(--rmcf-ink-rgb) / .9)", fontSize: 30, fontWeight: 700 }}>
        {total}
      </text>
      <text x={C} y={C + 18} textAnchor="middle" style={{ fill: "rgb(var(--rmcf-ink-rgb) / .6)", fontSize: 11 }}>
        {total === 1 ? "tarea" : "tareas"}
      </text>
    </svg>
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
  deltaTono = "valor",
  deltaFrente,
  deltaQue,
  deltaBase,
}: {
  icon: LucideIcon;
  title: string;
  value: ReactNode;
  hint?: string;
  accent?: string;
  delta?: number;
  /** Antes → después, la base de la diferencia: «7,0 → 6,7» (07/11/2026). */
  deltaBase?: string;
  deltaSuffix?: string;
  decimals?: number;
  /** «valor»: subir es mejor (verde/rojo). «neutro»: sólo dice el sentido. */
  deltaTono?: "valor" | "neutro";
  /** Contra qué se compara, con su artículo: «el M18» o «los mismos días del M18 (MD-4 y MD-3)». */
  deltaFrente?: string;
  /** Qué cambia, p. ej. «tareas». */
  deltaQue?: string;
}) {
  const showDelta = typeof delta === "number" && delta !== 0;

  const DeltaIcon = !showDelta ? Minus : delta > 0 ? ArrowUp : ArrowDown;

  /*
  | 30/10/2026: la carga, las tareas y el tiempo que bajan NO son malos de por
  | sí —la semana de partido o un MD-1 son más cortos a propósito—. Ahí la
  | diferencia va en color neutro y con el sentido escrito («−40,4 % frente al
  | M18»; desde el 30/10/2026 la página pasa el artículo); sólo la valoración se pinta en verde o rojo, porque ahí subir sí es
  | mejor.
  */
  const neutro = deltaTono === "neutro";

  /* «frente al M18» y «frente a los mismos días del M18»: la contracción, bien escrita. */
  const frenteCon = (t: string) => (t.startsWith("el ") ? `al ${t.slice(3)}` : `a ${t}`);

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

      <div className="mt-2.5 flex flex-wrap items-center gap-x-2 gap-y-1">
        {hint && <span className="text-[11px] text-white/40">{hint}</span>}

        {showDelta && neutro && (
          <span className="text-[11px] text-white/55">
            {delta > 0 ? "+" : "−"}
            {fmtDec(Math.abs(delta), decimals)}
            {deltaSuffix}
            {deltaQue ? ` ${deltaQue}` : ""}
            {deltaFrente ? ` frente ${frenteCon(deltaFrente)}` : ""}
            {deltaBase ? ` (${deltaBase})` : ""}
          </span>
        )}

        {showDelta && !neutro && (
          <span
            className={`inline-flex items-center gap-0.5 rounded-md px-1.5 py-0.5 text-[10px] font-semibold ${
              delta > 0
                ? "bg-emerald-500/15 text-emerald-400"
                : "bg-rose-500/15 text-rose-400"
            }`}
          >
            <DeltaIcon className="h-2.5 w-2.5" />
            {delta > 0 ? "+" : "−"}
            {fmtDec(Math.abs(delta), decimals)}
            {deltaSuffix}
            {deltaFrente ? ` frente ${frenteCon(deltaFrente)}` : ""}
            {deltaBase ? ` (${deltaBase})` : ""}
          </span>
        )}
      </div>
    </div>
  );
}

function Select({
  value,
  onChange,
  label,
  options,
}: {
  value: string;
  onChange: (value: string) => void;
  label: string;
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
        className="w-full rounded-2xl border border-white/10 bg-[#11161C] px-3.5 py-2.5 text-sm text-white outline-none focus:border-[#C8A96B]/50"
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

const CHIP_STYLES: Record<string, string> = {
  gold: "border-[#C8A96B]/40 bg-[#C8A96B]/10 text-[#C8A96B]",
  blue: "border-blue-400/40 bg-blue-400/10 text-blue-300",
  purple: "border-purple-400/40 bg-purple-400/10 text-purple-300",
  green: "border-green-400/40 bg-green-400/10 text-green-300",
  orange: "border-orange-400/40 bg-orange-400/10 text-orange-300",
};

function FilterChip({
  label,
  color,
  onClear,
}: {
  label: ReactNode;
  color: string;
  onClear: () => void;
}) {
  return (
    <button
      onClick={onClear}
      className={`rounded-full border px-3 py-1.5 text-xs transition hover:opacity-80 ${CHIP_STYLES[color]}`}
    >
      {label} ×
    </button>
  );
}

function Th({
  label,
  k,
  sortKey,
  sortDir,
  onSort,
  align = "left",
  titulo,
}: {
  label: string;
  /** Qué es la columna, cuando el rótulo va abreviado. */
  titulo?: string;
  k: keyof Row;
  sortKey: keyof Row;
  sortDir: "asc" | "desc";
  onSort: (key: keyof Row) => void;
  align?: "left" | "right" | "center";
}) {
  const active = sortKey === k;

  return (
    <th
      onClick={() => onSort(k)}
      title={titulo}
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

      <div className="space-y-0.5">
        {payload.map((p, i) => (
          <p
            key={i}
            className="text-xs"
            style={{ color: chipInk(p.color ?? "#CBD5E1") }}
          >
            {p.name}: <span className="font-semibold">{typeof p.value === "number" ? fmt1(p.value) : p.value}</span>
          </p>
        ))}

        {rows?.map(([rowLabel, key]) =>
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

function FragmentRow({
  row,
  max,
  selected,
  onSelectMicro,
  onSelectCell,
}: {
  row: {
    micro: number;
    rival: string;
    values: {
      md: string;
      carga: number;
      cog: number;
      tiempo: number;
      tareas: number;
      eval: number;
    }[];
  };
  max: number;
  selected: boolean;
  onSelectMicro: () => void;
  onSelectCell: (md: string) => void;
}) {
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
        <span className="text-xs font-semibold">Micro {etiquetaMicro(row.micro)}</span>

        <span className="w-full truncate text-[10px] text-white/40">
          {row.rival || "—"}
        </span>
      </button>

      {row.values.map((v) => {
        const t = max ? v.carga / max : 0;

        return (
          <button
            key={v.md}
            onClick={() => v.tareas > 0 && onSelectCell(v.md)}
            disabled={!v.tareas}
            title={
              v.tareas
                ? `M${etiquetaMicro(row.micro)} · ${v.md}\n${v.tareas} tarea${v.tareas === 1 ? "" : "s"} · ${v.tiempo}'\nCarga ${fmtInt(
                    v.carga
                  )} · Cog ${fmtInt(v.cog)}${v.eval ? `\nEval ${fmt1(v.eval)}` : ""}`
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
          M{etiquetaMicro(row.micro)} · {row.md} · {row.tipo}
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
