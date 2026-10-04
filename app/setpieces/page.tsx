"use client";
import { traeCsv } from "@/lib/hojaCsv";
import { Sidebar } from "@/components/ui/sidebar";
import { Topbar } from "@/components/ui/topbar";
import type { LegendProps } from "recharts";
import { FileDown } from "lucide-react";
import ABPFlowField, { zonaRemateDelCampo } from '@/components/abp/ABPFlowField';
import { AbpHeader, FilterDrawer, Select } from '@/components/abp/ui';
import {
  Conclusiones,
  Explicativo,
  useTextosExplicativos,
} from "@/components/ui/textos-analisis";
import {
  AnalisisSeccion,
  type LectorAnalisis,
} from "@/components/abp/AnalisisSeccion";
import type { ClaveMetrica } from "@/lib/abp/analisis";
import ABPObjectiveFlow, {
  type ABPFlowCol,
} from "@/components/abp/ABPObjectiveFlow";
import ABPZoneMap, {
  ZONA_AREA_LABEL,
  zonasDeAccion,
} from "@/components/abp/ABPZoneMap";
import {
  AvisoPretemporada,
  BarraFiltros,
  PULSA,
  SIN_PRETEMPORADA,
  alterna,
  filtraFilas,
  igual,
  marca,
  pulsaIndice,
  type Chip,
  type Dimension,
} from "@/components/abp/filtroCruzado";
import {
  lee,
  numero,
  COMPETICIONES,
  COMPETICION_LABEL,
  ESTADOS,
  ESTADO_COLOR,
  TRAMOS,
  comparaJornadas,
  competicionesPresentes,
  contextoDeFila,
  type ContextoAccion,
} from "@/lib/abp/partido";

import {
  useEffect,
  useMemo,
  useState,
} from "react";
import Papa from "papaparse";
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  Line,
  Label,
  CartesianGrid,
  PieChart,
  Pie,
  Cell,
  LabelList,
  Legend,
  ComposedChart,
} from "recharts";

const CSV_URL =
  "https://docs.google.com/spreadsheets/d/e/2PACX-1vS3_1ScOV6sTyEpZSgLgCf2dKbwkLzb3zUEYM-7ZOoMbcFUTp7nvu1pBfGOP7EzppXXQYQhLeVa_SPr/pub?gid=675048698&single=true&output=csv";

const COLORS = {
  gold: "#C8A96B",
  blue: "#3B82F6",
  purple: "#8B5CF6",
  green: "#10B981",
};

const PIE_COLORS = [
  "#C8A96B", // Oro
  "#66758A", // Acero azulado
  "#567A68", // Verde bosque
  "#8A6262", // Burdeos
  "#5E7FB8", // Azul real
  "#7C6F9F", // Púrpura grisáceo
];

const RESULTADO_COLORS: Record<string, string> = {
  "Gol": "#10B981",
  "Ocasión": "#C8A96B",
  "ABP": "#5E7FB8",
  "Nada": "#475569",
  "Transición Rival": "#8A6262",
};

/** El nodo del flujo que agrupa todas las superioridades. */
const SUPERIORIDAD = "Superioridad en corto";

/** Intención como la lee el flujo: «Penati» es un error de tecleo de la hoja. */
function intencionDe(r: { intencion: string }) {
  return (r.intencion || "").replace(/penati/gi, "Penalti");
}

/** Normaliza el resultado final al vocabulario cerrado que usa el cuerpo técnico. */
function normalizaResultado(v?: string): string {
  const t = (v || "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim();

  if (!t) return "Nada";
  if (t === "gol") return "Gol";
  if (t.includes("ocas")) return "Ocasión";
  if (t.includes("transici")) return "Transición Rival";
  if (t.includes("abp")) return "ABP";

  return "Nada";
}

/** true cuando el valor de Zona_Caida describe una superioridad en corto (3v2, 2v1...). */
function esSuperioridad(v?: string) {
  return /^\s*\d+\s*v\s*\d+\s*$/i.test(v || "");
}

/*
| Ayudas de las conclusiones de arriba.
|
| Las cifras van como se dicen en el vestuario: coma decimal y porcentajes
| redondos. `mejorGrupo` pide un mínimo de acciones (3) porque un 1 de 1
| saldría «lo mejor» y no dice nada.
*/
function cifra(n: number, decimales = 1) {
  return n.toLocaleString("es-ES", { maximumFractionDigits: decimales });
}

function plural(n: number, uno: string, varios: string) {
  return `${n} ${n === 1 ? uno : varios}`;
}

function mejorGrupo<T>(
  filas: T[],
  clave: (fila: T) => string,
  valor: (grupo: T[]) => number,
  minimo = 3,
) {
  const grupos = new Map<string, T[]>();

  for (const fila of filas) {
    const k = (clave(fila) || "").trim();

    if (!k) continue;

    const grupo = grupos.get(k) ?? [];

    grupo.push(fila);
    grupos.set(k, grupo);
  }

  let mejor: { nombre: string; n: number; valor: number } | null = null;

  for (const [nombre, grupo] of grupos) {
    if (grupo.length < minimo) continue;

    const v = valor(grupo);

    if (!mejor || v > mejor.valor) mejor = { nombre, n: grupo.length, valor: v };
  }

  return mejor;
}

type Row = {
  /**
   * Dónde y cuándo pasó: competición, jornada, minuto y marcador.
   *
   * Va entero en la fila porque de aquí salen a la vez los tres filtros
   * nuevos, el reparto por tramos y el rótulo que acompaña a la acción.
   */
  contexto: ContextoAccion;
  rival: string;
  tiempo: number;
  minuto: number;
  sacador: string;
  tipoAccion: string;
  perfilGolpeo: string;
  tipoEnvio: string;
  zonaCaida: string;
  tipoCarrera: string;
  defensaRival: string;
  debilidadRival: string;
  rematador: string;
  tipoRemate: string;
  zonaRemate: string;
  xg: number;
  segundoBalon: string;
  perfil: string;
  resultadoFinal: string;
  rutina: string;
  repetir: string;
    intencion: string;

  // Columnas del CSV que antes no se leían
  golesRMC: number;
  golesRival: number;
  calidadEnvio: number;
  nAtacantes: number;
  nBloqueadores: number;
  oc1P: number;
  ocCentral: number;
  oc2P: number;
  ocFrontal: number;
  remate: string;
};

/**
 * Lee la hoja **por el nombre de la columna**, no por su posición.
 *
 * Antes iba por índice (`r[27]` era el xG) y eso convertía cualquier columna
 * nueva en un desastre silencioso: meter «Marcador» delante del xG corría todo
 * el análisis una casilla y la página seguía pintando, con los datos de al
 * lado. Con la cabecera por delante, añadir columnas no rompe nada y quitar
 * una sólo vacía lo suyo.
 */
function parseCSV(text: string): Row[] {
  const parsed = Papa.parse<Record<string, string>>(text, {
    header: true,
    skipEmptyLines: true,
    transformHeader: (header) => header.trim(),
  });

  return parsed.data
    .filter((fila) =>
      Object.values(fila).some((valor) => String(valor ?? "").trim()),
    )
    .map((fila) => {
      const contexto = contextoDeFila(fila);

      return {
        contexto,
        rival: lee(fila, "Rival"),
        tiempo: contexto.minuto.parte ?? 0,
        minuto: contexto.minuto.minuto ?? 0,

        sacador: lee(fila, "Sacador"),
        perfil: lee(fila, "Perfil"),
        tipoAccion: lee(fila, "Tipo_Accion", "TipoAccion"),
        perfilGolpeo: lee(fila, "Perfil_Golpeo"),
        tipoEnvio: lee(fila, "Tipo_Envio"),
        zonaCaida: lee(fila, "Zona_Caida"),
        intencion: lee(fila, "Intencion"),
        tipoCarrera: lee(fila, "Tipo_Carrera"),

        defensaRival: lee(fila, "Defensa_Rival"),
        debilidadRival: lee(fila, "Debilidad_Rival"),

        rematador: lee(fila, "Rematador"),
        tipoRemate: lee(fila, "Tipo_Remate"),
        zonaRemate: lee(fila, "Zona_Remate"),

        xg: numero(lee(fila, "xG")) ?? 0,

        segundoBalon: lee(fila, "Segundo_Balon"),
        resultadoFinal: lee(fila, "Resultado_Final"),
        rutina: lee(fila, "Rutina"),
        repetir: lee(fila, "Repetir"),

        golesRMC: contexto.marcador.rmcf ?? 0,
        golesRival: contexto.marcador.rival ?? 0,
        calidadEnvio: numero(lee(fila, "Calidad_Envio")) ?? 0,
        nAtacantes: numero(lee(fila, "N_Atacantes")) ?? 0,
        nBloqueadores: numero(lee(fila, "N_Bloqueadores")) ?? 0,
        oc1P: numero(lee(fila, "Oc_1P")) ?? 0,
        ocCentral: numero(lee(fila, "Oc_Central")) ?? 0,
        oc2P: numero(lee(fila, "Oc_2P")) ?? 0,
        ocFrontal: numero(lee(fila, "Oc_Frontal")) ?? 0,
        remate: lee(fila, "Remate"),
      };
    })
    .filter(
      (r) =>
        /* Sin jornada no hay partido al que atribuir la acción. */
        Boolean(r.contexto.jornada.clave) &&
        !r.tipoAccion.toLowerCase().includes("penal"),
    );
}

/** La zona de remate con su clave corta («Segundo Palo» → «2P»); lo que no es zona, tal cual. */
function zonaRemateCorta(v: string) {
  return zonaRemateDelCampo(v) ?? v;
}

/** ¿Son la misma zona de remate, se escriban como se escriban? */
function mismaZonaRemate(a: string | undefined, b: string) {
  const ca = zonaRemateDelCampo(a);

  return ca !== null && ca === zonaRemateDelCampo(b);
}

function countBy(rows: Row[], key: keyof Row) {
  const grouped: Record<string, number> = {};

  rows.forEach((r) => {
    const k = String(r[key] || "Unknown");

    grouped[k] =
      (grouped[k] || 0) + 1;
  });

  return Object.entries(grouped).map(
    ([name, total]) => ({
      name,
      total,
    })
  );
}

/**
 * Cómo lee el análisis una fila de esta hoja.
 *
 * Va una sola vez y para toda la página: si cada panel decidiera por su cuenta
 * qué es «peligro», dos gráficos de la misma pantalla contarían distinto el
 * mismo córner. Esta hoja es **absoluta** —«Gol» y «Ocasión» son nuestros—,
 * así que el peligro se lee tal cual; en la defensiva no es así.
 */
const LECTOR: LectorAnalisis<Row> = {
  jornada: (r) => r.contexto.jornada,
  peligro: (r) => ["Gol", "Ocasión"].includes(normalizaResultado(r.resultadoFinal)),
  gol: (r) => normalizaResultado(r.resultadoFinal) === "Gol",
  remate: (r) =>
    Boolean(r.tipoRemate) && !["No Remate", "No aplica"].includes(r.tipoRemate),
  xg: (r) => r.xg,
};

export default function Page() {

  const [isMobile, setIsMobile] =
  useState(false);

const [isNarrow, setIsNarrow] =
  useState(false);

useEffect(() => {
  const check = () => {
    setIsMobile(
      window.innerWidth < 768
    );

    setIsNarrow(
      window.innerWidth < 1200
    );
  };

  check();

  window.addEventListener(
    "resize",
    check
  );

  return () =>
    window.removeEventListener(
      "resize",
      check
    );
}, []);
  const [rows, setRows] =
    useState<Row[]>([]);

  const [jornada, setJornada] =
    useState("ALL");
  const [rival, setRival] =
  useState("ALL");

const [sacador, setSacador] =
  useState("ALL");

const [tipoAccionFilter, setTipoAccionFilter] =
  useState("ALL");
  const [zonaCaidaFilter, setZonaCaidaFilter] =
  useState("ALL");
  const [zonaRemateFilter, setZonaRemateFilter] =
  useState("ALL");
  const [segundoBalonFilter, setSegundoBalonFilter] =
  useState("ALL");
  const [tipoCarreraFilter, setTipoCarreraFilter] =
  useState("ALL");
  const [defensaFilter, setDefensaFilter] =
  useState("ALL");

const [tipoEnvioFilter, setTipoEnvioFilter] =
  useState("ALL");

const [rematadorFilter, setRematadorFilter] =
  useState("ALL");

const [resultadoFilter, setResultadoFilter] =
  useState("ALL");

const [tipoAccionChartFilter, setTipoAccionChartFilter] =
  useState("ALL");

/*
| Los tres filtros de contexto, los mismos en las cinco páginas de ABP.
|
| «Competición» es el que pedía el cuerpo técnico: hasta ahora liga y
| pretemporada se sumaban en el mismo saco, y además con la jornada mal —
| «PRETEMPORADA 01» y «LIGA 01» daban los dos el número 1—. «Marcador» y
| «tramo» salen de columnas que la hoja ya trae y que aquí no se miraban.
*/
const [competicionFilter, setCompeticionFilter] = useState(SIN_PRETEMPORADA);
const [estadoFilter, setEstadoFilter] = useState("ALL");
const [tramoFilter, setTramoFilter] = useState("ALL");
const [rutinaFilter, setRutinaFilter] = useState("ALL");
  useEffect(() => {
    traeCsv(CSV_URL)
      .then((t) =>
        setRows(parseCSV(t))
      );
  }, []);

  /*
  | Las jornadas que hay, cada una con su competición.
  |
  | Se indexan por `clave` («liga:1», «amistoso:1») y no por el número: son dos
  | partidos distintos y antes compartían casilla.
  */
  const jornadas = useMemo(() => {
    const porClave = new Map<string, Row["contexto"]["jornada"]>();

    rows.forEach((r) => {
      if (r.contexto.jornada.clave) {
        porClave.set(r.contexto.jornada.clave, r.contexto.jornada);
      }
    });

    return [...porClave.values()].sort(comparaJornadas);
  }, [rows]);

  const competiciones = useMemo(
    () => competicionesPresentes(jornadas),
    [jornadas],
  );

  /* Las rutinas registradas, que es lo que se lleva a la pizarra. */
  const rutinas = useMemo(
    () =>
      [...new Set(rows.map((r) => r.rutina).filter(Boolean))].sort((a, b) =>
        a.localeCompare(b, "es"),
      ),
    [rows]
  );
  const rivales = [
  ...new Set(rows.map(r => r.rival))
];

const sacadores = [
  ...new Set(rows.map(r => r.sacador))
];

const tiposAccion = [
  ...new Set(rows.map(r => r.tipoAccion))
];

/* Las cuatro dimensiones que sólo se filtran pulsando: no tenían estado. */
const [zonaAreaFilter, setZonaAreaFilter] = useState("ALL");
const [intencionFilter, setIntencionFilter] = useState("ALL");
const [calidadFilter, setCalidadFilter] = useState("ALL");
const [atacantesFilter, setAtacantesFilter] = useState("ALL");

/*
| Todo lo que se puede filtrar, en un sitio.
|
| Cada dimensión lleva su estado (los mismos del cajón de filtros, así que el
| cajón y los clics en los gráficos van siempre a la par) y cómo se compara
| una fila con lo elegido. De aquí salen `filtered`, las versiones «sin esta
| dimensión» con las que se pinta cada gráfico y la tira de «Filtrando: …».
*/
const oficiales = competiciones.filter((una) => una !== "amistoso");
const hayPretemporada = competiciones.includes("amistoso");
const rotuloOficial = oficiales.length > 1 ? "Liga y copa" : "Sólo liga";

const dimensiones: Dimension<Row>[] = [
  {
    clave: "competicion",
    etiqueta: "Competición",
    valor: competicionFilter,
    poner: setCompeticionFilter,
    porDefecto: SIN_PRETEMPORADA,
    coincide: (r, v) =>
      v === SIN_PRETEMPORADA
        ? r.contexto.jornada.competicion !== "amistoso"
        : r.contexto.jornada.competicion === v,
    texto: (v) =>
      v === SIN_PRETEMPORADA
        ? rotuloOficial
        : (COMPETICION_LABEL[v as keyof typeof COMPETICION_LABEL] ?? v),
  },
  {
    clave: "jornada",
    etiqueta: "Jornada",
    valor: jornada,
    poner: setJornada,
    coincide: (r, v) => r.contexto.jornada.clave === v,
    texto: (v) => jornadas.find((una) => una.clave === v)?.etiqueta ?? v,
  },
  {
    /* Una acción sin marcador anotado no responde a «¿qué pasa yendo por
       delante?», así que no entra en esa muestra. */
    clave: "estado",
    etiqueta: "Marcador",
    valor: estadoFilter,
    poner: setEstadoFilter,
    coincide: (r, v) => r.contexto.marcador.estado === v,
    texto: (v) => ESTADOS.find((uno) => uno.key === v)?.label ?? v,
  },
  {
    clave: "tramo",
    etiqueta: "Tramo",
    valor: tramoFilter,
    poner: setTramoFilter,
    coincide: (r, v) => r.contexto.minuto.tramo === v,
    texto: (v) => TRAMOS.find((uno) => uno.key === v)?.label ?? v,
  },
  {
    clave: "rutina",
    etiqueta: "Rutina",
    valor: rutinaFilter,
    poner: setRutinaFilter,
    coincide: (r, v) => r.rutina === v,
  },
  {
    clave: "rival",
    etiqueta: "Rival",
    valor: rival,
    poner: setRival,
    coincide: (r, v) => r.rival === v,
  },
  {
    clave: "sacador",
    etiqueta: "Sacador",
    valor: sacador,
    poner: setSacador,
    coincide: (r, v) => igual(r.sacador, v),
  },
  {
    clave: "tipoAccion",
    etiqueta: "Tipo acción",
    valor: tipoAccionFilter,
    poner: setTipoAccionFilter,
    coincide: (r, v) => igual(r.tipoAccion, v),
  },
  {
    clave: "intencion",
    etiqueta: "Intención",
    valor: intencionFilter,
    poner: setIntencionFilter,
    coincide: (r, v) => igual(intencionDe(r), v),
  },
  {
    /* «Superioridad en corto» es el nodo que agrupa los 3v2, 2v1… del flujo. */
    clave: "zonaCaida",
    etiqueta: "Zona caída",
    valor: zonaCaidaFilter,
    poner: setZonaCaidaFilter,
    coincide: (r, v) =>
      v === SUPERIORIDAD
        ? esSuperioridad(r.zonaCaida)
        : igual(r.zonaCaida, v),
  },
  {
    clave: "zonaArea",
    etiqueta: "Zona del área",
    valor: zonaAreaFilter,
    poner: setZonaAreaFilter,
    coincide: (r, v) => zonasDeAccion(r, "offensive").includes(v),
    texto: (v) => ZONA_AREA_LABEL[v] ?? v,
  },
  {
    /* «Primer Palo» y «1P» (y «Segundo Palo» y «2P») son la misma zona: se
       comparan por su clave corta, la que pinta el campo y la tarta. */
    clave: "zonaRemate",
    etiqueta: "Zona remate",
    valor: zonaRemateFilter,
    poner: setZonaRemateFilter,
    coincide: (r, v) =>
      igual(r.zonaRemate, v) || mismaZonaRemate(r.zonaRemate, v),
    rotuloCoincide: (rotulo, v) =>
      rotulo === v || mismaZonaRemate(rotulo, v),
  },
  {
    clave: "segundoBalon",
    etiqueta: "Segundo balón",
    valor: segundoBalonFilter,
    poner: setSegundoBalonFilter,
    coincide: (r, v) => igual(r.segundoBalon, v),
  },
  {
    clave: "tipoCarrera",
    etiqueta: "Tipo carrera",
    valor: tipoCarreraFilter,
    poner: setTipoCarreraFilter,
    coincide: (r, v) => igual(r.tipoCarrera, v),
  },
  {
    clave: "defensa",
    etiqueta: "Defensa",
    valor: defensaFilter,
    poner: setDefensaFilter,
    coincide: (r, v) => igual(r.defensaRival, v),
  },
  {
    clave: "tipoEnvio",
    etiqueta: "Tipo envío",
    valor: tipoEnvioFilter,
    poner: setTipoEnvioFilter,
    coincide: (r, v) => igual(r.tipoEnvio, v),
  },
  {
    clave: "rematador",
    etiqueta: "Rematador",
    valor: rematadorFilter,
    poner: setRematadorFilter,
    coincide: (r, v) => igual(r.rematador, v),
  },
  {
    clave: "resultado",
    etiqueta: "Resultado",
    valor: resultadoFilter,
    poner: setResultadoFilter,
    coincide: (r, v) => normalizaResultado(r.resultadoFinal) === v,
  },
  {
    clave: "calidad",
    etiqueta: "Calidad envío",
    valor: calidadFilter,
    poner: setCalidadFilter,
    coincide: (r, v) =>
      Boolean(r.calidadEnvio) && `Calidad ${r.calidadEnvio}` === v,
  },
  {
    clave: "atacantes",
    etiqueta: "Atacantes",
    valor: atacantesFilter,
    poner: setAtacantesFilter,
    coincide: (r, v) =>
      Boolean(r.nAtacantes) && `${r.nAtacantes} atacantes` === v,
  },
];

const dimension = (clave: string) =>
  dimensiones.find((d) => d.clave === clave)!;

/** Todo filtrado salvo las dimensiones dadas: con eso se pinta cada gráfico. */
const sin = (...claves: string[]) => filtraFilas(rows, dimensiones, claves);

const filtered = sin();

/* Cada gráfico se pinta sin su propia dimensión: lo elegido sale resaltado
   y el resto atenuado, en vez de quedarse en una sola barra. */
const filasSacador = sin("sacador");
const filasTipoAccion = sin("tipoAccion");
const filasRematador = sin("rematador");
const filasEnvio = sin("tipoEnvio");
const filasRival = sin("rival");
const filasZonaCaida = sin("zonaCaida");
const filasResultado = sin("resultado");
const filasCalidad = sin("calidad");
const filasAtacantes = sin("atacantes");
const filasTramo = sin("tramo");
const filasRutina = sin("rutina");
const filasEstado = sin("estado");

/* La muestra contra la que se compara el pie de lectura: con la pretemporada
   fuera, el «global» tampoco la lleva. */
const comparables = filtraFilas(
  rows,
  dimensiones.filter((d) => d.clave === "competicion"),
);

/** Pulsar un elemento: lo elige o, si ya lo estaba, lo quita. */
const pulsa = (clave: string, valor: string) => {
  const d = dimension(clave);

  d.poner(alterna(d.valor, valor));
};

/** Aspecto de la barra o el sector `nombre` del gráfico de `clave`. */
const pinta = (clave: string, nombre: string) => {
  const d = dimension(clave);

  return marca(
    d.valor,
    nombre,
    d.valor !== "ALL" &&
      (d.rotuloCoincide ? d.rotuloCoincide(nombre, d.valor) : d.valor === nombre),
  );
};

const chips: Chip[] = dimensiones
  .filter(
    (d) =>
      d.valor !== (d.porDefecto ?? "ALL") &&
      /* La pretemporada tiene su propio aviso en la tira. */
      !(d.clave === "competicion" && d.valor === "ALL"),
  )
  .map((d) => ({
    clave: d.clave,
    etiqueta: d.etiqueta,
    texto: d.texto ? d.texto(d.valor) : d.valor,
    quitar: () => d.poner(d.porDefecto ?? "ALL"),
  }));

/* «Quitar filtros» no toca si se quiere ver la pretemporada o no. */
const quitaFiltros = () =>
  dimensiones.forEach((d) => {
    if (d.clave === "competicion") {
      if (d.valor !== "ALL") d.poner(SIN_PRETEMPORADA);
    } else {
      d.poner("ALL");
    }
  });

/* Si con la liga sola no queda nada pero con la pretemporada sí, se dice. */
const vacioSinPretemporada =
  filtered.length === 0 &&
  competicionFilter === SIN_PRETEMPORADA &&
  sin("competicion").length > 0;

  const shots = filtered.filter(
  (r) =>
    r.tipoRemate &&
    ![
      "",
      "No Remate",
      "No aplica",
    ].includes(r.tipoRemate)
).length;

/* Sólo «Gol» (del Castilla): con includes("gol") contaba también un «Gol Rival». */
const goals = filtered.filter((r) => normalizaResultado(r.resultadoFinal) === "Gol").length;

const totalXg = filtered.reduce(
  (a, b) => a + b.xg,
  0
);

/* Lo que se escribe en el PDF como «Filtros aplicados». */
const activeFilters = [
  ...(hayPretemporada && competicionFilter === SIN_PRETEMPORADA
    ? [{ label: "Competición", value: `${rotuloOficial} (sin pretemporada)` }]
    : []),
  ...chips
    .filter((c) => !(c.clave === "competicion" && competicionFilter === SIN_PRETEMPORADA))
    .map((c) => ({ label: c.etiqueta, value: c.texto })),
];
const metrics = {
  total: filtered.length,

  xg: totalXg,

  shots,

  goals,

  conversion:
    shots > 0
      ? (goals / shots) * 100
      : 0,

  xgAccion:
    filtered.length > 0
      ? totalXg /
        filtered.length
      : 0,
};
  const tipoAccion =
    countBy(sin("tipoAccion"), "tipoAccion");

  const zonaCaida =
    countBy(sin("zonaCaida"), "zonaCaida");

  const tipoCarrera =
    countBy(sin("tipoCarrera"), "tipoCarrera");

  const defensa =
    countBy(sin("defensa"), "defensaRival");

  const sacadorData =
    useMemo(() => {
      const grouped:
        Record<
          string,
          { xg: number }
        > = {};

      filasSacador.forEach((r) => {
        const k =
          r.sacador || "Unknown";

        if (!grouped[k]) {
          grouped[k] = {
            xg: 0,
          };
        }

        grouped[k].xg += r.xg;
      });

      return Object.entries(
        grouped
      ).map(([name, v]) => ({
        name,
        xg: +v.xg.toFixed(2),
      }));
    }, [filasSacador]);

  const tipoRemateData =
    useMemo(() => {
      const grouped:
        Record<
          string,
          number
        > = {};

      filtered
        .filter(
          (r) =>
            r.tipoRemate &&
            ![
              "",
              "No Remate",
              "No aplica",
            ].includes(
              r.tipoRemate
            )
        )
        .forEach((r) => {
          grouped[
            r.tipoRemate
          ] =
            (grouped[
              r.tipoRemate
            ] || 0) + r.xg;
        });

      return Object.entries(
        grouped
      ).map(
        ([name, total]) => ({
          name,
          total:
            +total.toFixed(2),
        })
      );
    }, [filtered]);
  const xgByTipoAccion =
  useMemo(() => {
    const grouped: Record<
      string,
      number
    > = {};

    filasTipoAccion.forEach((r) => {
      const k =
        r.tipoAccion || "Sin dato";

      grouped[k] =
        (grouped[k] || 0) +
        r.xg;
    });

    return Object.entries(
      grouped
    )
      .map(
        ([name, total]) => ({
          name,
          total:
            +total.toFixed(2),
        })
      )
      .sort(
        (a, b) =>
          b.total - a.total
      );
  }, [filasTipoAccion]);
  const rematadoresData =
  useMemo(() => {
    const grouped: Record<
      string,
      number
    > = {};

    filasRematador
  .filter(
    (r) =>
      r.rematador &&
      ![
        "nadie",
        "no aplica",
        "no",
        "no remate",
        "sin remate",
        "-",
      ].includes(
        r.rematador.trim().toLowerCase()
      )
  )
      .forEach((r) => {
        grouped[r.rematador] =
          (grouped[r.rematador] || 0) +
          r.xg;
      });

    return Object.entries(grouped)
      .map(([name, xg]) => ({
        name,
        xg: +xg.toFixed(2),
      }))
      .sort(
        (a, b) => b.xg - a.xg
      );
  }, [filasRematador]);

const zonaRemateData =
  countBy(
    sin("zonaRemate")
      .filter((r) => r.zonaRemate)
      /* Una sola porción por zona: «Segundo Palo» cuenta en «2P». */
      .map((r) => ({ ...r, zonaRemate: zonaRemateCorta(r.zonaRemate) })),
    "zonaRemate"
  );
  
const totalZonaRemate =
  zonaRemateData.reduce(
    (acc, item) => acc + item.total,
    0
  );
const segundoBalonData =
  countBy(
    sin("segundoBalon").filter(
      (r) => r.segundoBalon
    ),
    "segundoBalon"
  );
const totalSegundoBalon =
  segundoBalonData.reduce(
    (acc, item) => acc + item.total,
    0
  );
const tipoEnvioData =
  useMemo(() => {
    const grouped: Record<
      string,
      number
    > = {};

    filasEnvio.forEach((r) => {
      if (!r.tipoEnvio) return;

      grouped[r.tipoEnvio] =
        (grouped[r.tipoEnvio] || 0) +
        r.xg;
    });

    return Object.entries(grouped)
      .map(
        ([name, total]) => ({
          name,
          total:
            +total.toFixed(2),
        })
      )
      .sort(
        (a, b) =>
          b.total - a.total
      );
  }, [filasEnvio]); 
  
const rivalesData =
  useMemo(() => {
    const grouped: Record<
      string,
      number
    > = {};

    filasRival.forEach((r) => {
      if (!r.rival) return;

      grouped[r.rival] =
        (grouped[r.rival] || 0) +
        r.xg;
    });

    return Object.entries(grouped)
      .map(([name, total]) => ({
        name,
        total:
          +total.toFixed(2),
      }))
      .sort(
        (a, b) =>
          b.total - a.total
      )
      .slice(0, 8);
  }, [filasRival]);

const xgZonaCaida =
  useMemo(() => {
    const grouped: Record<
      string,
      number
    > = {};

    filasZonaCaida.forEach((r) => {
      if (!r.zonaCaida) return;

      // Las superioridades (3v2, 2v1...) tienen su propio panel:
      // no son zonas del área y ensucian esta comparativa.
      if (esSuperioridad(r.zonaCaida)) return;

      grouped[r.zonaCaida] =
        (grouped[r.zonaCaida] || 0) +
        r.xg;
    });

    return Object.entries(grouped)
      .map(([name, total]) => ({
        name,
        total:
          +total.toFixed(2),
      }))
      .sort(
        (a, b) =>
          b.total - a.total
      );
  }, [filasZonaCaida]);

const abpFlow = useMemo(() => {
  const nodes: Record<string, number> = {};
  const links: Record<string, number> = {};

  filtered.forEach((r) => {
    const chain = [
      r.zonaCaida,
      r.tipoAccion,
      r.tipoCarrera,
      r.zonaRemate,
    ].filter(Boolean) as string[];

    chain.forEach((k) => {
      nodes[k] = (nodes[k] || 0) + 1;
    });

    for (let i = 0; i < chain.length - 1; i++) {
      const key = `${chain[i]}->${chain[i + 1]}`;
      links[key] = (links[key] || 0) + 1;
    }
  });

  return { nodes, links };
}, [filtered]);


// Desglose completo del resultado final (Gol / Ocasión / ABP / Nada / Transición Rival)
const resultadoData = useMemo(() => {
  const orden = [
    "Gol",
    "Ocasión",
    "ABP",
    "Nada",
    "Transición Rival",
  ];

  const grouped: Record<string, number> = {};

  filasResultado.forEach((r) => {
    const k = normalizaResultado(r.resultadoFinal);
    grouped[k] = (grouped[k] || 0) + 1;
  });

  return orden
    .filter((name) => grouped[name] > 0)
    .map((name) => ({
      name,
      total: grouped[name],
    }));
}, [filasResultado]);

// Acciones que terminan produciendo peligro (gol u ocasión)
const accionesPeligrosas = filtered.filter((r) => {
  const res = normalizaResultado(r.resultadoFinal);
  return res === "Gol" || res === "Ocasión";
}).length;

const tasaPeligro =
  filtered.length > 0
    ? (accionesPeligrosas / filtered.length) * 100
    : 0;

/* El panel de «Resultado final» se pinta sin su propio filtro: su frase y su
   porcentaje central salen de esas mismas filas, o al elegir «Gol» diría
   siempre 100 %. */
const peligrosasResultado = filasResultado.filter(LECTOR.peligro).length;
const tasaPeligroResultado = filasResultado.length
  ? (peligrosasResultado / filasResultado.length) * 100
  : 0;

/* El sacador que más xG suma con lo que se está viendo. */
const mejorSacador = [...sin()]
  .reduce((acc, r) => {
    if (!r.sacador) return acc;
    const previo = acc.find((uno) => uno.name === r.sacador);
    if (previo) previo.xg += r.xg;
    else acc.push({ name: r.sacador, xg: r.xg });
    return acc;
  }, [] as { name: string; xg: number }[])
  .sort((a, b) => b.xg - a.xg)[0]?.name;

// Calidad del envío (1-4) frente al peligro que genera
const calidadEnvioData = useMemo(() => {
  const grouped: Record<
    number,
    { total: number; xg: number; remates: number }
  > = {};

  filasCalidad.forEach((r) => {
    if (!r.calidadEnvio) return;

    if (!grouped[r.calidadEnvio]) {
      grouped[r.calidadEnvio] = {
        total: 0,
        xg: 0,
        remates: 0,
      };
    }

    grouped[r.calidadEnvio].total += 1;
    grouped[r.calidadEnvio].xg += r.xg;

    if (
      r.tipoRemate &&
      !["", "No Remate", "No aplica"].includes(r.tipoRemate)
    ) {
      grouped[r.calidadEnvio].remates += 1;
    }
  });

  return Object.entries(grouped)
    .map(([calidad, v]) => ({
      name: `Calidad ${calidad}`,
      total: v.total,
      xg: +v.xg.toFixed(2),
      remates: v.remates,
      pctRemate: +((v.remates / v.total) * 100).toFixed(1),
    }))
    .sort((a, b) => a.name.localeCompare(b.name));
}, [filasCalidad]);

// Superioridades generadas en el juego en corto (3v2, 2v1...)
const superioridadData = useMemo(() => {
  const grouped: Record<
    string,
    { total: number; xg: number; goles: number }
  > = {};

  filasZonaCaida
    .filter((r) => esSuperioridad(r.zonaCaida))
    .forEach((r) => {
      const k = r.zonaCaida.trim();

      if (!grouped[k]) {
        grouped[k] = { total: 0, xg: 0, goles: 0 };
      }

      grouped[k].total += 1;
      grouped[k].xg += r.xg;

      if (normalizaResultado(r.resultadoFinal) === "Gol") {
        grouped[k].goles += 1;
      }
    });

  return Object.entries(grouped)
    .map(([name, v]) => ({
      name,
      total: v.total,
      xg: +v.xg.toFixed(2),
      goles: v.goles,
    }))
    .sort((a, b) => b.total - a.total);
}, [filasZonaCaida]);

// Estructura de la jugada: atacantes y bloqueadores frente al xG generado
const estructuraData = useMemo(() => {
  const grouped: Record<
    number,
    { total: number; xg: number; bloqueadores: number }
  > = {};

  filasAtacantes.forEach((r) => {
    if (!r.nAtacantes) return;

    if (!grouped[r.nAtacantes]) {
      grouped[r.nAtacantes] = {
        total: 0,
        xg: 0,
        bloqueadores: 0,
      };
    }

    grouped[r.nAtacantes].total += 1;
    grouped[r.nAtacantes].xg += r.xg;
    grouped[r.nAtacantes].bloqueadores += r.nBloqueadores;
  });

  return Object.entries(grouped)
    .map(([atacantes, v]) => ({
      name: `${atacantes} atacantes`,
      total: v.total,
      xgMedio: +(v.xg / v.total).toFixed(3),
      bloqueadoresMedio: +(
        v.bloqueadores / v.total
      ).toFixed(1),
    }))
    .sort(
      (a, b) => parseInt(a.name) - parseInt(b.name)
    );
}, [filasAtacantes]);
const totalTipoCarrera =
  tipoCarrera.reduce(
    (acc, item) => acc + item.total,
    0
  );
  /*
  | Lo que pasa en cada cuarto de hora.
  |
  | Las acciones sin minuto anotado se dejan fuera —si no, todas caerían en el
  | primer tramo y parecería que el equipo saca veinte córners en el minuto 0—
  | y se dice cuántas son, que es lo honesto: el minutaje se está empezando a
  | registrar ahora y media hoja todavía no lo trae.
  |
  | Además del recuento va el **peligro**: un tramo con muchos córners y ningún
  | remate no dice lo mismo que uno con tres y dos ocasiones, y era justo lo
  | que no se podía ver.
  */
  const conMinuto = filasTramo.filter(
    (r) => r.contexto.minuto.tramo !== null
  );

  const sinMinuto =
    filasTramo.length - conMinuto.length;

  const esGol = (r: Row) => normalizaResultado(r.resultadoFinal) === "Gol";

  const esRemate = (r: Row) =>
    Boolean(r.tipoRemate) &&
    !["", "No Remate", "No aplica"].includes(r.tipoRemate);

  const timeline = TRAMOS.map((tramo) => {
    const dentro = conMinuto.filter(
      (r) => r.contexto.minuto.tramo === tramo.key
    );

    return {
      tramo: tramo.label,
      key: tramo.key,
      total: dentro.length,
      remates: dentro.filter(esRemate).length,
      goles: dentro.filter(esGol).length,
      xg: Number(
        dentro.reduce((suma, r) => suma + r.xg, 0).toFixed(2)
      ),
    };
  });

  /*
  | Qué da de sí cada rutina ensayada.
  |
  | La columna «Rutina» de la hoja es el nombre con el que el cuerpo técnico
  | llama a la jugada que se entrena («CORTO PARA GOLPEO DESDE FRONTAL»), y no
  | se miraba en ninguna parte: estaba escrita y no se leía. Aquí se ordenan
  | por peligro, que es lo que decide cuál se repite el jueves.
  */
  const porRutina = useMemo(() => {
    const grupos = new Map<string, Row[]>();

    filasRutina.forEach((r) => {
      if (!r.rutina) return;

      grupos.set(r.rutina, [...(grupos.get(r.rutina) ?? []), r]);
    });

    return [...grupos.entries()]
      .map(([nombre, dentro]) => {
        const remates = dentro.filter(
          (r) =>
            Boolean(r.tipoRemate) &&
            !["", "No Remate", "No aplica"].includes(r.tipoRemate)
        ).length;

        return {
          nombre,
          total: dentro.length,
          remates,
          goles: dentro.filter((r) => normalizaResultado(r.resultadoFinal) === "Gol").length,
          xg: Number(dentro.reduce((suma, r) => suma + r.xg, 0).toFixed(2)),
          rematePct: dentro.length ? (remates / dentro.length) * 100 : 0,
        };
      })
      .sort((a, b) => b.xg - a.xg || b.total - a.total);
  }, [filasRutina]);

  const sinRutina = filasRutina.filter((r) => !r.rutina).length;

  /*
  | Y lo mismo según cómo iba el partido.
  |
  | Es la lectura que abre el marcador: un equipo saca más córners cuando va
  | perdiendo, pero lo que interesa es si además le rinden. Las acciones sin
  | marcador anotado quedan fuera y se cuentan aparte, igual que arriba.
  */
  const conMarcador = filasEstado.filter(
    (r) => r.contexto.marcador.estado !== null
  );

  const sinMarcador = filasEstado.length - conMarcador.length;

  const porMarcador = ESTADOS.map((estado) => {
    const dentro = conMarcador.filter(
      (r) => r.contexto.marcador.estado === estado.key
    );

    return {
      estado: estado.label,
      key: estado.key,
      total: dentro.length,
      remates: dentro.filter(esRemate).length,
      goles: dentro.filter(esGol).length,
      xg: Number(
        dentro.reduce((suma, r) => suma + r.xg, 0).toFixed(2)
      ),
    };
  });
   const pieLegendProps: Partial<LegendProps> = {
  layout: isMobile
    ? "horizontal"
    : "vertical",

  verticalAlign: isMobile
    ? "bottom"
    : "middle",

  align: isMobile
    ? "center"
    : "right",

  iconSize: 10,

  wrapperStyle: {
    fontSize: 11,
    color: "#CBD5E1",
    lineHeight: "18px",
    paddingLeft: 20,
  },
};
const downloadPDF = async () => {
  /*
  | El motor de PDF llega al pulsar, no al abrir la pantalla.
  |
  | `jspdf` con su `autotable` y `html-to-image` son medio mega de
  | JavaScript que solo hace falta cuando alguien pide el informe. Importados
  | arriba viajaban en el paquete de la pantalla, y había que bajarlos y
  | compilarlos antes de poder pintar la primera tabla.
  */
  const [{ default: jsPDF }, { default: autoTable }, htmlToImage] =
    await Promise.all([
      import("jspdf"),
      import("jspdf-autotable"),
      import("html-to-image"),
    ]);

  const doc = new jsPDF("l", "mm", "a4");

  const PAGE_W = 297;
  const PAGE_H = 210;

  const paintPage = () => {
    doc.setDrawColor(200, 169, 107);
    doc.setLineWidth(0.5);

    doc.line(
      10,
      10,
      PAGE_W - 10,
      10
    );

    doc.line(
      10,
      PAGE_H - 10,
      PAGE_W - 10,
      PAGE_H - 10
    );
  };

  const logo = await fetch("/logo.png")
    .then((r) => r.blob())
    .then(
      (blob) =>
        new Promise<string>((resolve) => {
          const reader =
            new FileReader();

          reader.onloadend = () =>
            resolve(
              reader.result as string
            );

          reader.readAsDataURL(blob);
        })
    );

  // ===================================================
  // PORTADA
  // ===================================================

  paintPage();

  doc.addImage(
    logo,
    "PNG",
    220,
    20,
    50,
    50
  );
doc.setTextColor(
  120,
  120,
  120
);

doc.setFontSize(10);

doc.text(
  new Date().toLocaleDateString(),
  220,
  78
);

  doc.text(
    "ABP OFENSIVO",
    20,
    30
  );

  doc.setFontSize(14);

  doc.text(
    "Informe Automático",
    20,
    40
  );

  doc.setDrawColor(
    200,
    169,
    107
  );

  doc.line(
    20,
    45,
    120,
    45
  );

  doc.setTextColor(
    120,
    120,
    120
  );

  doc.setFontSize(10);

  doc.text(
    "Real Madrid Castilla · Análisis ABP Ofensivo",
    20,
    52
  );

  // ==========================================
  // KPIs
  // ==========================================

  const cards = [
    [
      "ABP",
      metrics.total.toString(),
    ],
    [
      "xG",
      metrics.xg.toFixed(2),
    ],
    [
      "Remates",
      metrics.shots.toString(),
    ],
    [
      "Goles",
      metrics.goals.toString(),
    ],
    [
      "Conversión",
      `${metrics.conversion.toFixed(
        1
      )}%`,
    ],
  ];

  cards.forEach(
    ([title, value], i) => {
      const x =
        20 + i * 50;

      doc.setFillColor(
        245,
        245,
        245
      );

      doc.roundedRect(
        x,
        70,
        42,
        28,
        3,
        3,
        "F"
      );

      doc.setTextColor(
        120,
        120,
        120
      );

      doc.setFontSize(9);

      doc.text(
        title,
        x + 3,
        79
      );

      doc.setTextColor(
        0,
        0,
        0
      );

      doc.setFontSize(16);

      doc.text(
        value,
        x + 3,
        92
      );
    }
  );
  const miniCards = [
  [
    "xG / Acción",
    metrics.xgAccion.toFixed(2),
  ],
  [
    "Mejor Sacador",
    mejorSacador || "-",
  ],
  [
    "Remates / ABP",
    (
      metrics.shots /
      Math.max(
        metrics.total,
        1
      )
    ).toFixed(2),
  ],
  [
    "Goles / ABP",
    (
      metrics.goals /
      Math.max(
        metrics.total,
        1
      )
    ).toFixed(2),
  ],
];

miniCards.forEach(
  ([title, value], i) => {
    const x =
      20 + i * 63;

    doc.setFillColor(
      250,
      250,
      250
    );

    doc.roundedRect(
      x,
      102,
      55,
      14,
      2,
      2,
      "F"
    );

    doc.setTextColor(
      100,
      100,
      100
    );

    doc.setFontSize(7);

    doc.text(
      title,
      x + 2,
      108
    );

    doc.setTextColor(
      0,
      0,
      0
    );

    doc.setFontSize(8);

    doc.text(
      String(value),
      x + 2,
      113
    );
  }
);

  // ==========================================
  // FILTROS
  // ==========================================

const filtros =
  activeFilters
    .filter(
      (f) => f.value !== "ALL"
    )
    .map(
      (f) =>
        `${f.label}: ${f.value}`
    );

const filtrosTexto =
  filtros.length
    ? filtros
    : [
        "Temporada completa",
        "Todas las ABP ofensivas",
        "Todos los rivales",
        "Todos los jugadores",
      ];

doc.setFillColor(
  248,
  248,
  248
);

doc.roundedRect(
  20,
  118,
  105,
  60,
  3,
  3,
  "F"
);

doc.setTextColor(
  200,
  169,
  107
);

doc.setFontSize(14);

doc.text(
  "Filtros Aplicados",
  25,
  128
);

doc.setTextColor(
  0,
  0,
  0
);

doc.setFontSize(10);

filtrosTexto.forEach(
  (f, i) => {
    doc.text(
      `• ${f}`,
      28,
      138 + i * 6
    );
  }
);

  // ==========================================
  // RESUMEN EJECUTIVO
  // ==========================================

  doc.setFillColor(
  248,
  248,
  248
);

doc.roundedRect(
  145,
  118,
  115,
  60,
  3,
  3,
  "F"
);

doc.setTextColor(
  200,
  169,
  107
);

doc.setFontSize(14);

doc.text(
  "Resumen Ejecutivo",
  150,
  128
);

doc.setTextColor(
  0,
  0,
  0
);

doc.setFontSize(10);

const resumen = [
  `• ${metrics.total} acciones ABP ofensivas analizadas`,
  `• ${metrics.xg.toFixed(2)} xG generado`,
  `• Conversión del ${metrics.conversion.toFixed(1)}%`,
  `• ${metrics.shots} remates totales`,
  `• ${metrics.goals} goles obtenidos`,
  `• Mejor sacador: ${mejorSacador || "-"}`,
  `• xG por acción: ${metrics.xgAccion.toFixed(2)}`,
  `• ${tasaPeligro.toFixed(1)}% acaban en gol u ocasión`,
];

resumen.forEach(
  (txt, i) => {
    doc.text(
      txt,
      150,
      138 + i * 6
    );
  }
);

  // ===================================================
  // GRÁFICOS
  // ===================================================
// ==========================================
// MODO EXPORT PDF
// ==========================================

const chartNodes = document.querySelectorAll(
  "#grafico-tipo-accion, \
   #grafico-zona-caida, \
   #grafico-impacto-sacador, \
   #impacto-rematadores, \
   #grafico-xg-envio, \
   #grafico-zona-remate, \
   #grafico-segundo-balón, \
   #grafico-tipo-carrera, \
   #grafico-defensa-rival, \
   #grafico-timeline, \
   #grafico-xg-tipo-accion, \
   #grafico-rivales-xg-concedido, \
   #grafico-xg-caida, \
   #grafico-calidad-envio, \
   #grafico-superioridad, \
   #grafico-estructura, \
   #grafico-conversión"
);

const originalStyles: Array<{
  el: Element;
  fill: string | null;
  weight: string | null;
}> = [];

chartNodes.forEach((chart) => {
  chart
    .querySelectorAll(
      ".recharts-cartesian-axis-tick-value, .recharts-legend-item-text, .recharts-label-list text"
    )
    .forEach((el) => {
      const node = el as SVGElement;

      originalStyles.push({
        el: node,
        fill: node.getAttribute("fill"),
        weight:
          node.getAttribute(
            "font-weight"
          ),
      });

      node.setAttribute(
        "fill",
        "#000000"
      );

      node.setAttribute(
        "font-weight",
        "700"
      );
    });
});
  const charts = [
    {
      id: "grafico-tipo-accion",
      title: "Tipo acción",
    },
    {
      id: "grafico-zona-caida",
      title: "Zona caída",
    },
    {
      id: "grafico-impacto-sacador",
      title: "Impacto sacador",
    },
    {
      id: "impacto-rematadores",
      title: "Rematadores",
    },
    {
      id: "grafico-xg-envio",
      title: "xG envío",
    },
    {
      id: "grafico-zona-remate",
      title: "Zona remate",
    },
    {
      id: "grafico-segundo-balón",
      title: "Segundo balón",
    },
    {
      id: "grafico-tipo-carrera",
      title: "Carrera",
    },
    {
      id: "grafico-defensa-rival",
      title: "Defensa rival",
    },
    {
      id: "grafico-timeline",
      title: "Timeline",
    },
    {
      id: "grafico-xg-tipo-accion",
      title: "xG acción",
    },
    {
      id: "grafico-rivales-xg-concedido",
      title: "Rivales xG",
    },
    {
      id: "grafico-xg-caida",
      title: "Zona caída",
    },
    {
      id: "grafico-zone-map",
      title: "Mapa de zonas",
    },
    {
      id: "grafico-calidad-envio",
      title: "Calidad envío",
    },
    {
      id: "grafico-superioridad",
      title: "Superioridad en corto",
    },
    {
      id: "grafico-estructura",
      title: "Estructura jugada",
    },
    {
      id: "grafico-conversión",
      title: "Resultado final",
    },
  ];

  const positions = [
  { x: 10, y: 28 },
  { x: 104, y: 28 },
  { x: 198, y: 28 },

  { x: 57, y: 112 },
  { x: 151, y: 112 },
];

  let index = 0;

while (index < charts.length) {
  doc.addPage();

  paintPage();

  for (
    let slot = 0;
    slot < 5 &&
    index < charts.length;
    slot++, index++
  ) {
    const chart =
      charts[index];

    const element =
      document.getElementById(
        chart.id
      );

    if (!element)
      continue;

    const image =
      await htmlToImage.toPng(
        element,
        {
          backgroundColor:
            "#ffffff",
          pixelRatio: 3,
          cacheBust: true,
        }
      );

    const pos =
      positions[slot];

    doc.setFillColor(
      250,
      250,
      250
    );

    doc.roundedRect(
      pos.x - 2,
      pos.y - 10,
      92,
      82,
      3,
      3,
      "F"
    );

    doc.setTextColor(
      60,
      60,
      60
    );

    doc.setFontSize(10);

    doc.text(
      chart.title,
      pos.x,
      pos.y - 3
    );

    doc.addImage(
      image,
      "PNG",
      pos.x,
      pos.y,
      88,
      68
    );
  }
}

  // ===================================================
  // TABLA
  // ===================================================

  doc.addPage();

  paintPage();

  doc.setTextColor(
    200,
    169,
    107
  );

  doc.setFontSize(18);

  doc.text(
    "Detalle de Acciones",
    15,
    20
  );

  autoTable(doc, {
    startY: 28,
  pageBreak: "auto",

  rowPageBreak: "auto",
    didDrawPage: () => {
      paintPage();
    },

    head: [[
      "Rival",
      "Sacador",
      "Acción",
      "Zona",
      "Remate",
      "xG",
    ]],

    body: filtered.map((r) => [
  r.rival,
  r.sacador,
  r.tipoAccion,
  r.zonaCaida,
  r.tipoRemate,
  r.xg.toFixed(2),
]),

    theme: "striped",

   styles: {
  textColor:[30,30,30],
  fontSize:8,
  cellPadding:3,
  overflow:"linebreak",
},

    headStyles: {
      fillColor: [
        200,
        169,
        107,
      ],
      textColor: [0,0,0],
      fontStyle: "bold",
    },
    columnStyles: {
  0: { cellWidth: 45 }, // Rival
  1: { cellWidth: 35 }, // Sacador
  2: { cellWidth: 40 }, // Acción
  3: { cellWidth: 40 }, // Zona
  4: { cellWidth: 35 }, // Remate
  5: { cellWidth: 15 }, // xG
}, 
    alternateRowStyles: {
      fillColor: [
        245,
        245,
        245,
      ],
    },
  });

  // ===================================================
  // FOOTER
  // ===================================================

  const pages =
    doc.getNumberOfPages();

  for (
    let i = 1;
    i <= pages;
    i++
  ) {
    doc.setPage(i);

    doc.setTextColor(
      120,
      120,
      120
    );

    doc.setFontSize(8);

    doc.text(
      `Real Madrid Castilla · ABP Ofensivo · Página ${i}/${pages}`,
      PAGE_W / 2,
      PAGE_H - 4,
      {
        align: "center",
      }
    );
  }
originalStyles.forEach(
  ({ el, fill, weight }) => {
    if (fill)
      el.setAttribute(
        "fill",
        fill
      );

    if (weight)
      el.setAttribute(
        "font-weight",
        weight
      );
  }
);
  doc.save(
    `ABP_Ofensivo_${new Date()
      .toISOString()
      .slice(0, 10)}.pdf`
  );
};

/*
| Las conclusiones de arriba: qué dice lo que se está viendo, no cómo se ha
| hecho. Salen de `filtered`, las mismas filas que pintan los gráficos, así
| que cambian con cada filtro.
*/
const textosExplicativos = useTextosExplicativos();

const conclusiones = useMemo(() => {
  if (!filtered.length) return [];

  const resultado = (r: Row) => normalizaResultado(r.resultadoFinal);
  const tasaPeligroDe = (grupo: Row[]) =>
    grupo.filter(LECTOR.peligro).length / grupo.length;

  const goles = filtered.filter((r) => resultado(r) === "Gol").length;
  const ocasiones = filtered.filter((r) => resultado(r) === "Ocasión").length;
  const xg = filtered.reduce((a, r) => a + r.xg, 0);

  const frases: (string | null)[] = [
    `${plural(filtered.length, "ABP", "ABP")}: ${plural(ocasiones, "ocasión", "ocasiones")} y ${plural(goles, "gol", "goles")}, xG ${cifra(xg)}.`,
  ];

  const zona = mejorGrupo(
    filtered,
    (r) => (esSuperioridad(r.zonaCaida) ? "" : r.zonaCaida),
    tasaPeligroDe,
  );

  if (zona && zona.valor > 0) {
    frases.push(
      `Más peligro cayendo en ${zona.nombre}: ${Math.round(zona.valor * zona.n)} de ${zona.n} en gol u ocasión.`,
    );
  }

  /* La rutina dice más que la intención; si no hay ninguna con muestra, la
     intención. */
  const rutina = mejorGrupo(filtered, (r) => r.rutina, tasaPeligroDe);
  const intencion = rutina && rutina.valor > 0
    ? null
    : mejorGrupo(filtered, (r) => r.intencion, tasaPeligroDe);

  if (rutina && rutina.valor > 0) {
    frases.push(
      `Rutina que más rinde: «${rutina.nombre}», ${Math.round(rutina.valor * 100)} % gol u ocasión.`,
    );
  } else if (intencion && intencion.valor > 0) {
    frases.push(
      `Intención más eficaz: ${intencion.nombre.toLowerCase()}, ${Math.round(intencion.valor * 100)} % gol u ocasión.`,
    );
  }

  const lanzador = mejorGrupo(
    filtered,
    (r) => r.sacador,
    (grupo) => grupo.reduce((a, r) => a + r.xg, 0) / grupo.length,
  );

  if (lanzador && lanzador.valor > 0) {
    frases.push(
      `Más xG por envío: ${lanzador.nombre} (${cifra(lanzador.valor, 2)}).`,
    );
  }

  const ganados = filtered.filter((r) => /gan/i.test(r.segundoBalon)).length;
  const perdidos = filtered.filter((r) => /perd/i.test(r.segundoBalon)).length;

  if (ganados + perdidos >= 3) {
    frases.push(
      perdidos >= ganados
        ? `Segundo balón: perdemos el ${Math.round((perdidos / (ganados + perdidos)) * 100)} % de los disputados.`
        : `Segundo balón: ganamos el ${Math.round((ganados / (ganados + perdidos)) * 100)} % de los disputados.`,
    );
  }

  const transiciones = filtered.filter(
    (r) => resultado(r) === "Transición Rival",
  ).length;

  if (transiciones > 0) {
    frases.push(
      `${plural(transiciones, "acción acaba", "acciones acaban")} en transición rival.`,
    );
  }

  return frases.filter(Boolean).slice(0, 5);
}, [filtered]);

/*
| El pie de lectura de cada sección.
|
| Se llama como una función y no se usa como componente a propósito: así el
| bloque se pinta con lo que ya hay calculado arriba —`filtered` contra
| `rows`— sin que ningún panel tenga que volver a filtrar por su cuenta.
*/
const pie = (
  opciones: {
    metrica?: ClaveMetrica;
    dimension?: string;
    /* Agrupar por resultado y medir producción es circular: ver el pie. */
    dimensionDerivada?: boolean;
    categoria?: (fila: Row) => string;
    destacado?: boolean;
  } = {},
) => (
  <AnalisisSeccion
    filas={filtered}
    todas={comparables}
    lector={LECTOR}
    sentido="ofensivo"
    unidad="acciones"
    {...opciones}
  />
);

  return (
    <main className="min-h-screen bg-[#0B0F14] text-white">
      <div className="flex">

  <Sidebar />


        <div className="min-w-0 flex-1">
          <Topbar />

          <section className="px-4 sm:px-8 pb-8 sm:pb-12 pt-6 sm:pt-10">

  <AbpHeader
    area="RMCF Castilla · Colectivo"
    title="ABP Ofensivo"
    lead={
      textosExplicativos
        ? "Córners y faltas a favor: qué se lanza, dónde cae el balón, quién remata y cuánto peligro acaba generando cada rutina."
        : undefined
    }
  />

  {/* Selector + KPIs */}
  <div className="mt-6 rounded-[24px] sm:rounded-[32px] border border-white/10 bg-gradient-to-b from-white/[0.05] to-white/[0.02] p-5 sm:p-8 shadow-[0_12px_40px_rgba(0,0,0,0.35)] backdrop-blur-sm">

    {/* Los cinco desplegables iban sueltos y sin etiqueta: sólo se sabía qué
        filtraba cada uno abriéndolo. Ahora van plegados y rotulados. */}
    <FilterDrawer
      activeCount={chips.length}
      summary="8 filtros disponibles"
    >
      {/*
        La competición va la primera porque es la que cambia de qué se está
        hablando: un córner de un amistoso de julio contra un juvenil y uno de
        la jornada 1 no son la misma muestra, y hasta ahora se sumaban.
      */}
      {/* Por defecto sin pretemporada: los amistosos de julio se miran
          a propósito, no se cuelan en todo. */}
      {(competiciones.length > 1 || hayPretemporada) && (
        <Select
          label="Competición"
          value={competicionFilter}
          onChange={setCompeticionFilter}
          options={[
            { value: SIN_PRETEMPORADA, label: `${rotuloOficial} (sin pretemporada)` },
            ...COMPETICIONES.filter((una) =>
              competiciones.includes(una.key),
            ).map((una) => ({ value: una.key, label: una.label })),
            { value: "ALL", label: "Liga y pretemporada" },
          ]}
        />
      )}

      <Select
        label="Jornada"
        value={jornada}
        onChange={setJornada}
        options={[
          { value: "ALL", label: "Todas" },
          ...jornadas.map((una) => ({
            value: una.clave,
            label: una.etiqueta,
          })),
        ]}
      />

      {/* Cómo iba el partido: sale de «Resultado RMC» y «Resultado RIVAL». */}
      <Select
        label="Marcador"
        value={estadoFilter}
        onChange={setEstadoFilter}
        options={[
          { value: "ALL", label: "Cualquier marcador" },
          ...ESTADOS.map((uno) => ({ value: uno.key, label: uno.label })),
        ]}
      />

      <Select
        label="Tramo de 15'"
        value={tramoFilter}
        onChange={setTramoFilter}
        options={[
          { value: "ALL", label: "Todo el partido" },
          ...TRAMOS.map((uno) => ({ value: uno.key, label: uno.label })),
        ]}
      />

      {rutinas.length > 0 && (
        <Select
          label="Rutina"
          value={rutinaFilter}
          onChange={setRutinaFilter}
          options={[
            { value: "ALL", label: "Todas las rutinas" },
            ...rutinas.map((una) => ({ value: una, label: una })),
          ]}
        />
      )}

      <Select
        label="Rival"
        value={rival}
        onChange={setRival}
        options={[{ value: "ALL", label: "Todos los rivales" }, ...rivales]}
      />

      <Select
        label="Sacador"
        value={sacador}
        onChange={setSacador}
        options={[{ value: "ALL", label: "Todos los sacadores" }, ...sacadores]}
      />

      <Select
        label="Tipo de acción"
        value={tipoAccionFilter}
        onChange={setTipoAccionFilter}
        options={[{ value: "ALL", label: "Todas las acciones" }, ...tiposAccion]}
      />

    </FilterDrawer>
<div className="mt-5">
  <p className="text-sm text-zinc-400 mb-3">
    Equipos visualizados (
    {[...new Set(filasRival.map((r) => r.rival))]
      .length}
    )
  </p>

  <div className="flex flex-wrap gap-2">
    {[...new Set(filasRival.map((r) => r.rival))]
      .sort()
      .map((equipo) => (
        <button
  key={equipo}
  type="button"
  title={PULSA}
  onClick={() => pulsa("rival", equipo)}
  className={`
    px-3
    py-1.5
    rounded-full
    border
    text-xs
    transition-all

    ${
      rival === equipo
        ? "bg-[#C8A96B] text-black border-[#C8A96B]"
        : "bg-[#C8A96B]/10 text-[#C8A96B] border-white/10 hover:bg-[#C8A96B]/20"
    }
  `}
>
  {equipo}
</button>
      ))}
  </div>
</div>
    <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-4 gap-4 sm:gap-5 mt-5 sm:mt-6">
      <Card
        title="ABP"
        value={metrics.total}
        hint="Acciones lanzadas"
      />

      <Card
        title="xG"
        value={metrics.xg.toFixed(2)}
        hint="Goles esperados acumulados"
      />

      <Card
        title="Remates"
        value={metrics.shots}
        hint="Acciones que acaban en remate"
      />

      <Card
        title="Goles"
        value={metrics.goals}
        hint="Marcados a balón parado"
        activo={resultadoFilter === "Gol"}
        onClick={() => pulsa("resultado", "Gol")}
      />
      <Card
  title="Conversión"
  value={`${metrics.conversion.toFixed(
    1
  )}%`}
  hint="Goles sobre remates"
/>
<Card
  title="xG / ABP"
  value={metrics.xgAccion.toFixed(2)}
  hint="Peligro medio de cada lanzamiento"
/>

<Card
  title="Gol u ocasión"
  value={`${tasaPeligro.toFixed(1)}%`}
  hint="ABP que terminan en peligro real"
/>

<button
  type="button"
  title={PULSA}
  disabled={!mejorSacador && sacador === "ALL"}
  onClick={() =>
    mejorSacador || sacador !== "ALL"
      ? pulsa("sacador", sacador !== "ALL" ? sacador : mejorSacador!)
      : undefined
  }
  className={`rounded-2xl md:rounded-3xl border bg-white/[0.03] p-4 md:p-6 text-left transition hover:bg-white/[0.05] ${
    sacador !== "ALL" ? "border-[#C8A96B]" : "border-white/10"
  }`}
>
  <p className="text-sm text-zinc-400">
    Mejor sacador
  </p>
  <h3
    className="
      mt-4
      text-lg
      md:text-xl
      font-semibold
      text-[#C8A96B]
      leading-tight
      break-words
    "
  >
    {mejorSacador || "-"}
  </h3>
</button>
    </div>

  </div>

            {/* La tira de filtros va fuera de la tarjeta de arriba: un `sticky`
                sólo se pega dentro de su padre, y dentro de la tarjeta dejaba
                de verse en cuanto se bajaba a los gráficos. */}
<BarraFiltros
  chips={chips}
  onQuitarTodo={quitaFiltros}
  antes={
    competicionFilter === SIN_PRETEMPORADA || competicionFilter === "ALL" ? (
      <AvisoPretemporada
        fuera={competicionFilter === SIN_PRETEMPORADA}
        hayPretemporada={hayPretemporada}
        rotulo={rotuloOficial}
        onCambia={(incluir) =>
          setCompeticionFilter(incluir ? "ALL" : SIN_PRETEMPORADA)
        }
      />
    ) : null
  }
/>

{vacioSinPretemporada && (
  <p className="mt-3 rounded-xl border border-white/10 bg-white/[0.03] px-3 py-2 text-xs text-white/60">
    No hay acciones de liga con estos filtros ·{" "}
    <button
      type="button"
      onClick={() => setCompeticionFilter("ALL")}
      className="text-[#C8A96B] underline-offset-2 hover:underline"
    >
      incluir pretemporada
    </button>
  </p>
)}

            {/* Las conclusiones en pocas frases, antes de cualquier panel. */}
            <Conclusiones items={conclusiones} className="mt-6" />

            {/* La lectura de cabecera: lo que dicen los KPI de arriba puestos
                al lado del global y de las jornadas anteriores. */}
            <div className="mt-6">
              {pie({ destacado: true, dimension: "tipo de acción", categoria: (r) => r.tipoAccion })}
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-5 md:gap-6 mt-8 md:mt-10">

<div className="md:col-span-2">
<Panel title="Mapa de zonas del área" analisis={pie({ dimension: "zona de caída", categoria: (r) => r.zonaCaida })}>
  <div id="grafico-zone-map">
    <ABPZoneMap
      mode="offensive"
      zonaFiltro={zonaAreaFilter === "ALL" ? null : zonaAreaFilter}
      onZonaFiltro={(zona) => setZonaAreaFilter(zona ?? "ALL")}
      rows={sin("zonaArea").map((r) => ({
        zonaCaida: r.zonaCaida,
        zonaRemate: r.zonaRemate,
        xg: r.xg,
        resultadoFinal: r.resultadoFinal,
        tipoRemate: r.tipoRemate,
        oc1P: r.oc1P,
        ocCentral: r.ocCentral,
        oc2P: r.oc2P,
        ocFrontal: r.ocFrontal,
      }))}
    />
  </div>
</Panel>
</div>

<div className="md:col-span-2">
<Panel title="Situación Global" analisis={pie({})}>
  <div id="grafico-abp-flow">
    <ABPFlowField
  seleccion={{
    tipoAccion: tipoAccionFilter === "ALL" ? undefined : tipoAccionFilter,
    zonaRemate:
      zonaRemateFilter === "ALL"
        ? undefined
        : (zonaRemateDelCampo(zonaRemateFilter) ?? zonaRemateFilter),
  }}
  onFiltra={(filtro, valor) =>
    (filtro === "tipoAccion" ? setTipoAccionFilter : setZonaRemateFilter)(
      valor ?? "ALL",
    )
  }
  rows={sin("tipoAccion", "zonaRemate").map((r) => ({
    jornada: r.contexto.jornada.corto,
    rival: r.rival,
    minuto: r.minuto,
    tipoAccion: r.tipoAccion,
    perfil: r.perfil,
    tipoEnvio: r.tipoEnvio,
    zonaCaida: r.zonaCaida,
    zonaRemate: r.zonaRemate,
    xG: Number(r.xg ?? 0),
    rematador: r.rematador,
    tipoRemate: r.tipoRemate,
    resultadoFinal: r.resultadoFinal,
  }))}
/>
  </div>
</Panel>
</div>

<div className="md:col-span-2">
<Panel title="Flujo ofensivo" analisis={pie({ dimension: "intención", categoria: (r) => r.intencion })}>
  <div id="grafico-abp-objective-flow">
   <ABPObjectiveFlow
  mode="offensive"
  seleccion={{
    accion: tipoAccionFilter === "ALL" ? undefined : tipoAccionFilter,
    medio: intencionFilter === "ALL" ? undefined : intencionFilter,
    /* El valor tal cual: con «3v2» el flujo resalta su nodo de
       superioridades pero sólo cuenta los 3v2, como el resto de la página. */
    zona: zonaCaidaFilter === "ALL" ? undefined : zonaCaidaFilter,
    resultado: resultadoFilter === "ALL" ? undefined : resultadoFilter,
  }}
  onSeleccion={(col: ABPFlowCol, valor) =>
    ({
      accion: setTipoAccionFilter,
      medio: setIntencionFilter,
      zona: setZonaCaidaFilter,
      resultado: setResultadoFilter,
    })[col](valor ?? "ALL")
  }
  rows={sin("tipoAccion", "intencion", "zonaCaida", "resultado").map((r) => ({
    jornada: r.contexto.jornada.corto,
    rival: r.rival,
    minuto: r.minuto,
    tipoAccion: r.tipoAccion,
    perfil: r.perfil,
    tipoEnvio: r.tipoEnvio,
    intencion: r.intencion,
    zonaCaida: r.zonaCaida,
    zonaRemate: r.zonaRemate,
    xG: Number(r.xg ?? 0),
    rematador: r.rematador,
    tipoRemate: r.tipoRemate,
    resultadoFinal: r.resultadoFinal,
  }))}
/>
  </div>
</Panel>
</div>


              <Panel title="Tipo de acción">
                <div id="grafico-tipo-accion">
  <Chart>
    <BarChart
      data={tipoAccion}
      onClick={pulsaIndice(tipoAccion, (d) => pulsa("tipoAccion", d.name))}
      style={{ cursor: "pointer" }}
margin={{
  top: 10,
  right: 24,
  left: 10,
  bottom: 10,
}}
    >
      <CartesianGrid
        stroke="#1E232A"
        vertical={false}
      />

      <XAxis
        dataKey="name"
        domain={[0, (dataMax: number) => Math.ceil(dataMax * 1.15)]}
        tick={{
          fill: "#94A3B8",
          fontSize: 11,
        }}
        axisLine={false}
        tickLine={false}
      />

      <YAxis
        tick={{
          fill: "#94A3B8",
          fontSize: 11,
        }}
        axisLine={false}
        tickLine={false}
      />

      <Tooltip />

      <Bar
        dataKey="total"
        fill={COLORS.gold}
        radius={[8, 8, 0, 0]}
      >
        {tipoAccion.map((d) => (
          <Cell key={d.name} fill={COLORS.gold} {...pinta("tipoAccion", d.name)} />
        ))}
        <LabelList
          dataKey="total"
          position="top"
          formatter={(v) =>
            typeof v === "number"
              ? v
              : ""
          }
          style={{
            fill: "var(--foreground)",
            fontWeight: 600,
            fontSize: 12,
          }}
        />
      </Bar>
    </BarChart>
  </Chart>
  </div>
</Panel>
<Panel title="Zona de caída">
  <div id="grafico-zona-caida">

  <Chart>
    <PieChart
  margin={{
    top: 20,
    right: isMobile ? 10 : 140,
    bottom: isMobile ? 80 : 20,
    left: isMobile ? 10 : 20,
  }}
>
  <Pie
    data={zonaCaida}
    dataKey="total"
    nameKey="name"
    cx={isMobile ? "50%" : "50%"}
  cy="50%"
    innerRadius={isMobile ? 65 : 95}
    outerRadius={isMobile ? 90 : 120}
    paddingAngle={4}
    cornerRadius={8}
    stroke="transparent"
    onClick={(_, i) => zonaCaida[i] && pulsa("zonaCaida", zonaCaida[i].name)}
  ><Label
  value={zonaCaida.reduce((suma, d) => suma + d.total, 0)}
  position="center"
  fill="#fff"
  fontSize={isMobile ? 22 : 30}
/>

    {zonaCaida.map((d, i) => (
      <Cell
        key={i}
        fill={
          PIE_COLORS[
            i % PIE_COLORS.length
          ]
        }
        {...pinta("zonaCaida", d.name)}
      />
    ))}

    <LabelList
  dataKey="total"
  position="inside"
  fill="#fff"
  fontSize={12}
  
/>{!isMobile && (
  <LabelList
    dataKey="total"
    position="inside"
    fill="#fff"
    fontSize={12}
  />
)}
  </Pie>

  <Tooltip />

<Legend
  layout="horizontal"
  verticalAlign="bottom"
  align="center"
  onClick={(e) => pulsa("zonaCaida", String(e.value))}
  wrapperStyle={{
    fontSize: 10,
    lineHeight: "14px",
    cursor: "pointer",
  }}
/>
</PieChart>
  </Chart></div>
</Panel>
<Panel title="Impacto sacador" analisis={pie({ metrica: "xg", dimension: "sacador", categoria: (r) => r.sacador })}>
  <div id="grafico-impacto-sacador">

  <Chart>
    <BarChart
      data={sacadorData}
      layout="vertical"
      onClick={pulsaIndice(sacadorData, (d) => pulsa("sacador", d.name))}
      style={{ cursor: "pointer" }}
margin={{
  top: 10,
  right: 24,
  left: 10,
  bottom: 10,
}}
    >
      <CartesianGrid
        stroke="#1E232A"
        horizontal={false}
      />

      <XAxis
        type="number"
        domain={[0, (dataMax: number) => Math.ceil(dataMax * 1.15)]}
        axisLine={false}
        tickLine={false}
      />

      <YAxis
        type="category"
        dataKey="name"
       width={
  isNarrow
    ? 160
    : 220
}
        tick={{
          fill: "#CBD5E1",
          fontSize: 11,
        }}
        axisLine={false}
        tickLine={false}
      />

      <Tooltip />

      <Bar
        dataKey="xg"
        fill={COLORS.blue}
        radius={[0, 8, 8, 0]}
      >
        {sacadorData.map((d) => (
          <Cell key={d.name} fill={COLORS.blue} {...pinta("sacador", d.name)} />
        ))}
        <LabelList
          dataKey="xg"
          position="right"
          formatter={(v) =>
            typeof v === "number"
              ? v.toFixed(2)
              : ""
          }
          style={{
            fill: "#fff",
            fontWeight: 600,
          }}
        />
      </Bar>
    </BarChart>
  </Chart></div>
</Panel>
<Panel title="Impacto rematadores" analisis={pie({ dimension: "rematador", categoria: (r) => r.rematador })}>
  <div id="impacto-rematadores">

  <Chart>
    <BarChart
      data={rematadoresData}
      layout="vertical"
      onClick={pulsaIndice(rematadoresData, (d) => pulsa("rematador", d.name))}
      style={{ cursor: "pointer" }}
margin={{
  top: 10,
  right: 24,
  left: 10,
  bottom: 10,
}}
    >
      <CartesianGrid
        stroke="#1E232A"
        horizontal={false}
      />

      <XAxis
        type="number"
        domain={[0, (dataMax: number) => Math.ceil(dataMax * 1.15)]}
        axisLine={false}
        tickLine={false}
      />

      <YAxis
        type="category"
        dataKey="name"
        width={
  isNarrow
    ? 160
    : 220
}
        axisLine={false}
        tickLine={false}
        tick={{
          fill: "#CBD5E1",
          fontSize: 11,
        }}
      />

      <Tooltip />

      <Bar
        dataKey="xg"
        fill={COLORS.gold}
        radius={[0, 8, 8, 0]}
      >
        {rematadoresData.map((d) => (
          <Cell key={d.name} fill={COLORS.gold} {...pinta("rematador", d.name)} />
        ))}
        <LabelList
          dataKey="xg"
          position="right"
          style={{
            fill: "#fff",
            fontWeight: 600,
          }}
        />
      </Bar>
    </BarChart>
  </Chart></div>
</Panel>
<Panel title="xG por tipo envío" analisis={pie({ metrica: "xg", dimension: "tipo de envío", categoria: (r) => r.tipoEnvio })}>
  <div id="grafico-xg-envio">

  <Chart>
    <BarChart
      data={tipoEnvioData}
      layout="vertical"
      onClick={pulsaIndice(tipoEnvioData, (d) => pulsa("tipoEnvio", d.name))}
      style={{ cursor: "pointer" }}
margin={{
  top: 10,
  right: 24,
  left: 10,
  bottom: 10,
}}
    >
      <CartesianGrid
        stroke="#1E232A"
        horizontal={false}
      />

      <XAxis
        type="number"
        domain={[0, (dataMax: number) => Math.ceil(dataMax * 1.15)]}
        axisLine={false}
        tickLine={false}
      />

      <YAxis
        type="category"
        dataKey="name"
        width={
  isNarrow
    ? 160
    : 220
}
        axisLine={false}
        tickLine={false}
        tick={{
          fill: "#CBD5E1",
          fontSize: 11,
        }}
      />

      <Tooltip />

      <Bar
        dataKey="total"
        fill={COLORS.purple}
        radius={[0, 8, 8, 0]}
      >
        {tipoEnvioData.map((d) => (
          <Cell key={d.name} fill={COLORS.purple} {...pinta("tipoEnvio", d.name)} />
        ))}
        <LabelList
          dataKey="total"
          position="right"
          style={{
            fill: "#fff",
            fontWeight: 600,
          }}
        />
      </Bar>
    </BarChart>
  </Chart></div>
</Panel>
<Panel title="Zona remate" analisis={pie({ metrica: "xg", dimension: "zona de remate", categoria: (r) => r.zonaRemate })}>
  <div id="grafico-zona-remate">

  <Chart>
    <PieChart
  margin={{
    top: 20,
    right: isMobile ? 10 : 140,
    bottom: isMobile ? 80 : 20,
    left: isMobile ? 10 : 20,
  }}
>
      
    <Pie
    onClick={(_, i) =>
      zonaRemateData[i] && pulsa("zonaRemate", zonaRemateData[i].name)
    }
  data={zonaRemateData}
  dataKey="total"
  nameKey="name"
  cx={isMobile ? "50%" : "50%"}
  cy="50%"
innerRadius={
  isMobile ? 65 : 95
}

outerRadius={
  isMobile ? 90 : 120
}
  paddingAngle={4}
  cornerRadius={8}
  stroke="transparent"
>
        {zonaRemateData.map(
          (d, i) => (
            <Cell
              key={i}
              fill={
                PIE_COLORS[
                  i %
                    PIE_COLORS.length
                ]
              }
              {...pinta("zonaRemate", d.name)}
            />
          )
        )}
        <Label
value={totalZonaRemate}
  position="center"
  fill="#fff"
  fontSize={isMobile ? 22 : 30}
/>
       <LabelList
  dataKey="total"
  position="inside"
  fill="#fff"
  fontSize={12}
/>{!isMobile && (
  <LabelList
    dataKey="total"
    position="inside"
    fill="#fff"
    fontSize={12}
  />
)}
      </Pie>

      <Tooltip />

<Legend
  {...pieLegendProps}
  onClick={(e) => pulsa("zonaRemate", String(e.value))}
/>
 </PieChart>
  </Chart></div>
</Panel>
<Panel title="Segundo balón" analisis={pie({ dimension: "segundo balón", categoria: (r) => r.segundoBalon })}>
  <div id="grafico-segundo-balón">

  <Chart>
    <PieChart
  margin={{
    top: 20,
    right: isMobile ? 10 : 140,
    bottom: isMobile ? 80 : 20,
    left: isMobile ? 10 : 20,
  }}
>
      
      <Pie
      onClick={(_, i) =>
        segundoBalonData[i] && pulsa("segundoBalon", segundoBalonData[i].name)
      }
  data={segundoBalonData}
  dataKey="total"
  nameKey="name"
 cx={isMobile ? "50%" : "50%"}
  cy="50%"
  innerRadius={
  isMobile ? 65 : 95
}
  outerRadius={
  isMobile ? 90 : 120
}
  paddingAngle={4}
  cornerRadius={8}
  stroke="transparent"
>
        {segundoBalonData.map(
          (d, i) => (
            <Cell
              key={i}
              fill={
                PIE_COLORS[
                  i %
                    PIE_COLORS.length
                ]
              }
              {...pinta("segundoBalon", d.name)}
            />
          )
        )}        <Label
value={totalSegundoBalon}
  position="center"
  fill="#fff"
  fontSize={isMobile ? 22 : 30}
/>
       <LabelList
  dataKey="total"
  position="inside"
  fill="#fff"
  fontSize={12}
/>{!isMobile && (
  <LabelList
    dataKey="total"
    position="inside"
    fill="#fff"
    fontSize={12}
  />
)}
      </Pie>

      <Tooltip />

<Legend
  {...pieLegendProps}
  onClick={(e) => pulsa("segundoBalon", String(e.value))}
/>
    </PieChart>
  </Chart></div>
</Panel>

<Panel title="Tipo carrera" analisis={pie({ dimension: "tipo de carrera", categoria: (r) => r.tipoCarrera })}>
  <div id="grafico-tipo-carrera">

  <Chart>
    <PieChart
  margin={{
    top: 20,
    right: isMobile ? 10 : 140,
    bottom: isMobile ? 80 : 20,
    left: isMobile ? 10 : 20,
  }}
>
      
      <Pie
  onClick={(_, i) =>
    tipoCarrera[i] && pulsa("tipoCarrera", tipoCarrera[i].name)
  }
  data={tipoCarrera}
  dataKey="total"
  nameKey="name"
 cx={isMobile ? "50%" : "50%"}
  cy="50%"
  innerRadius={
  isMobile ? 65 : 95
}
  outerRadius={
  isMobile ? 90 : 120
}
  paddingAngle={4}
  cornerRadius={8}
  stroke="transparent">
        {tipoCarrera.map(
          (d, i) => (
            <Cell
              key={i}
              fill={
                PIE_COLORS[
                  i %
                    PIE_COLORS.length
                ]
              }
              {...pinta("tipoCarrera", d.name)}
            />
          )
        )} <Label
value={totalTipoCarrera}
  position="center"
  fill="#fff"
  fontSize={isMobile ? 22 : 30}
/>
       <LabelList
  dataKey="total"
  position="inside"
  fill="#fff"
  fontSize={12}
/>{!isMobile && (
  <LabelList
    dataKey="total"
    position="inside"
    fill="#fff"
    fontSize={12}
  />
)}
      </Pie>

      <Tooltip />

 <Legend
  {...pieLegendProps}
  onClick={(e) => pulsa("tipoCarrera", String(e.value))}
/>
    </PieChart>
  </Chart></div>
</Panel>
<Panel title="Defensa rival" analisis={pie({ dimension: "defensa del rival", categoria: (r) => r.defensaRival })}>
  <div id="grafico-defensa-rival">

  <Chart>
    <BarChart
      data={defensa}
      onClick={pulsaIndice(defensa, (d) => pulsa("defensa", d.name))}
      style={{ cursor: "pointer" }}
margin={{
  top: 10,
  right: 24,
  left: 10,
  bottom: 10,
}}
    >
      <CartesianGrid
        stroke="#1E232A"
        vertical={false}
      />

      <XAxis
        dataKey="name"
        domain={[0, (dataMax: number) => Math.ceil(dataMax * 1.15)]}
        tick={{
          fill: "#94A3B8",
        }}
        axisLine={false}
        tickLine={false}
      />

      <YAxis
        axisLine={false}
        tickLine={false}
        tick={{
          fill: "#94A3B8",
        }}
      />

      <Tooltip />

      <Bar
        dataKey="total"
        fill={COLORS.purple}
        radius={[8, 8, 0, 0]}
      >
        {defensa.map((d) => (
          <Cell key={d.name} fill={COLORS.purple} {...pinta("defensa", d.name)} />
        ))}
        <LabelList
          dataKey="total"
          position="top"
          style={{
            fill: "#fff",
            fontWeight: 600,
          }}
        />
      </Bar>
    </BarChart>
  </Chart></div>
</Panel>
<Panel title="Momento del partido" analisis={pie({ metrica: "volumen", dimension: "tramo", categoria: (r) => TRAMOS.find((uno) => uno.key === r.contexto.minuto.tramo)?.label ?? "" })}>
  <Explicativo>

  <p className="-mt-3 mb-4 text-xs text-zinc-500">
    Acciones y remates por tramos de 15&apos;.
    {sinMinuto > 0 &&
      ` ${sinMinuto} acciones quedan fuera por no tener minuto registrado.`}
  </p>

  </Explicativo>

  <div id="grafico-timeline">

  <Chart>
    <ComposedChart
      data={timeline}
      onClick={pulsaIndice(timeline, (d) => pulsa("tramo", d.key))}
      style={{ cursor: "pointer" }}
margin={{
  top: 10,
  right: 24,
  left: 10,
  bottom: 10,
}}
    >
      <CartesianGrid
        stroke="#1E232A"
        vertical={false}
      />

      {/*
        `interval={0}` obliga a pintar los seis tramos.

        Sin él, en un móvil recharts se comía una etiqueta de cada dos y la
        gráfica quedaba con el primer pico sin nombre: se veía que había un
        pico, pero no en qué cuarto de hora.
      */}
      <XAxis
        dataKey="tramo"
        interval={0}
        tick={{
          fill: "#94A3B8",
          fontSize: 11,
        }}
        axisLine={false}
        tickLine={false}
      />

      <YAxis
        axisLine={false}
        tickLine={false}
        tick={{
          fill: "#94A3B8",
        }}
      />

      <Tooltip />

      <Legend />

      {/* Las barras son los remates: es lo que separa un tramo con muchos
          córners de uno que además hizo daño. */}
      <Bar
        name="Remates"
        dataKey="remates"
        fill={COLORS.gold}
        radius={[6, 6, 0, 0]}
        maxBarSize={38}
      >
        {timeline.map((d) => (
          <Cell key={d.key} fill={COLORS.gold} {...pinta("tramo", d.key)} />
        ))}
      </Bar>

      <Line
        name="Acciones"
        dataKey="total"
        stroke={COLORS.green}
        strokeWidth={3}
        dot={{
          r: 5,
          fill: COLORS.green,
        }}
        activeDot={{
          r: 7,
        }}
      >
        <LabelList
          dataKey="total"
          position="top"
          style={{
            fill: "#fff",
            fontSize: 11,
          }}
        />
      </Line>
    </ComposedChart>
  </Chart></div>
</Panel>

{/*
  Lo que rinde cada rutina ensayada, ordenadas por xG.

  Va en tabla y no en barras porque el nombre de una rutina es una frase
  entera («AMPLIAR ESPACIO DE Z2 Y BLOQUE PARA LIBERAR REMATADOR»): en un eje
  no se lee ninguna.
*/}
<Panel title="Rutinas" analisis={pie({ dimension: "rutina", categoria: (r) => r.rutina })}>
  <Explicativo>

  <p className="-mt-3 mb-4 text-xs text-zinc-500">
    Lo que produce cada jugada ensayada, de más a menos xG.
    {sinRutina > 0 &&
      ` ${sinRutina} acciones no llevan rutina anotada.`}
  </p>

  </Explicativo>

  {porRutina.length === 0 ? (
    <p className="py-10 text-center text-sm text-zinc-500">
      Todavía no hay ninguna acción con rutina anotada en la hoja.
    </p>
  ) : (
    <>
      {/*
        En un móvil la tabla no cabe y las cuatro columnas de números se
        quedaban a la derecha, fuera de la pantalla: se veían los nombres de
        las rutinas y había que arrastrar para saber si alguna había producido
        algo. Por debajo de `sm` va en fichas, con las cifras debajo del
        nombre.
      */}
      <ul className="space-y-2 sm:hidden">
        {porRutina.map((fila) => (
          <li
            key={fila.nombre}
            role="button"
            tabIndex={0}
            title={PULSA}
            onClick={() => pulsa("rutina", fila.nombre)}
            onKeyDown={(e) => {
              if (e.key === "Enter" || e.key === " ") {
                e.preventDefault();
                pulsa("rutina", fila.nombre);
              }
            }}
            className={`cursor-pointer rounded-xl border bg-white/[0.02] p-3 transition hover:bg-white/[0.04] ${
              rutinaFilter === fila.nombre
                ? "border-[#C8A96B]"
                : rutinaFilter !== "ALL"
                  ? "border-white/10 opacity-40"
                  : "border-white/10"
            }`}
          >
            <p className="text-sm text-zinc-200">{fila.nombre}</p>

            <p className="mt-1.5 flex flex-wrap gap-x-3 gap-y-1 text-xs tabular-nums text-zinc-400">
              <span>{fila.total} ABP</span>
              <span>
                {fila.remates} remate{fila.remates === 1 ? "" : "s"} ·{" "}
                {fila.rematePct.toFixed(0)}%
              </span>
              <span style={{ color: fila.goles > 0 ? COLORS.green : undefined }}>
                {fila.goles} gol{fila.goles === 1 ? "" : "es"}
              </span>
              <span className="text-[#C8A96B]">xG {fila.xg.toFixed(2)}</span>
            </p>
          </li>
        ))}
      </ul>

    <div className="hidden overflow-x-auto sm:block">
      <table className="w-full min-w-[520px] text-left text-sm">
        <thead className="text-[11px] uppercase tracking-wide text-zinc-500">
          <tr>
            <th className="py-2 pr-3 font-medium">Rutina</th>
            <th className="py-2 px-3 text-right font-medium">ABP</th>
            <th className="py-2 px-3 text-right font-medium">Remate</th>
            <th className="py-2 px-3 text-right font-medium">Goles</th>
            <th className="py-2 pl-3 text-right font-medium">xG</th>
          </tr>
        </thead>

        <tbody className="divide-y divide-white/5">
          {porRutina.map((fila) => (
            <tr
              key={fila.nombre}
              title={PULSA}
              onClick={() => pulsa("rutina", fila.nombre)}
              className={`cursor-pointer transition hover:bg-white/[0.03] ${
                rutinaFilter === fila.nombre
                  ? "bg-[#C8A96B]/10"
                  : rutinaFilter !== "ALL"
                    ? "opacity-40"
                    : ""
              }`}
            >
              <td className="py-2.5 pr-3 text-zinc-200">{fila.nombre}</td>
              <td className="py-2.5 px-3 text-right tabular-nums text-zinc-300">
                {fila.total}
              </td>
              <td className="whitespace-nowrap py-2.5 px-3 text-right tabular-nums text-zinc-300">
                {fila.remates} · {fila.rematePct.toFixed(0)}%
              </td>
              <td
                className="py-2.5 px-3 text-right tabular-nums"
                style={{ color: fila.goles > 0 ? COLORS.green : undefined }}
              >
                {fila.goles}
              </td>
              <td className="py-2.5 pl-3 text-right tabular-nums text-[#C8A96B]">
                {fila.xg.toFixed(2)}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
    </>
  )}
</Panel>

{/*
  Cómo se comporta el equipo a balón parado según cómo vaya el marcador.

  Sale de «Resultado RMC» y «Resultado RIVAL», que la hoja escribe en cada
  acción: son los goles de cada uno **en ese momento**, así que se puede
  separar lo que se lanza yendo por delante de lo que se lanza remando.
*/}
<Panel title="Según el marcador" analisis={pie({ dimension: "marcador", categoria: (r) => ESTADOS.find((uno) => uno.key === r.contexto.marcador.estado)?.label ?? "" })}>
  <Explicativo>

  <p className="-mt-3 mb-4 text-xs text-zinc-500">
    Acciones, remates y goles según cómo iba el partido.
    {sinMarcador > 0 &&
      ` ${sinMarcador} acciones quedan fuera por no tener marcador anotado.`}
  </p>

  </Explicativo>

  <div id="grafico-abp-marcador">

  <Chart>
    <ComposedChart
      data={porMarcador}
      onClick={pulsaIndice(porMarcador, (d) => pulsa("estado", d.key))}
      style={{ cursor: "pointer" }}
      margin={{ top: 10, right: 24, left: 10, bottom: 10 }}
    >
      <CartesianGrid stroke="#1E232A" vertical={false} />

      {/* Igual aquí: en el móvil desaparecía «Empatando», que es justo la
          barra más alta. */}
      <XAxis
        dataKey="estado"
        interval={0}
        tick={{ fill: "#94A3B8", fontSize: 11 }}
        axisLine={false}
        tickLine={false}
      />

      <YAxis axisLine={false} tickLine={false} tick={{ fill: "#94A3B8" }} />

      <Tooltip />

      <Legend />

      {/* El `fill` no se ve —cada barra lleva su `Cell`— pero es el color que
          la leyenda usa para su cuadradito: sin él salía negro. */}
      <Bar
        name="Acciones"
        dataKey="total"
        fill="#8A8370"
        radius={[6, 6, 0, 0]}
        maxBarSize={54}
      >
        {porMarcador.map((fila) => (
          <Cell
            key={fila.key}
            fill={ESTADO_COLOR[fila.key]}
            {...pinta("estado", fila.key)}
          />
        ))}

        <LabelList
          dataKey="total"
          position="top"
          style={{ fill: "#fff", fontSize: 11 }}
        />
      </Bar>

      <Line
        name="Remates"
        dataKey="remates"
        stroke={COLORS.gold}
        strokeWidth={3}
        dot={{ r: 5, fill: COLORS.gold }}
      />
    </ComposedChart>
  </Chart></div>

  <div className="mt-4 grid grid-cols-3 gap-2">
    {porMarcador.map((fila) => (
      <button
        key={fila.key}
        type="button"
        title={PULSA}
        onClick={() => pulsa("estado", fila.key)}
        className={`rounded-xl border bg-white/[0.02] p-3 text-center transition hover:bg-white/[0.04] ${
          estadoFilter === fila.key
            ? "border-[#C8A96B]"
            : estadoFilter !== "ALL"
              ? "border-white/10 opacity-40"
              : "border-white/10"
        }`}
      >
        <p
          className="text-[10px] uppercase tracking-[0.16em]"
          style={{ color: ESTADO_COLOR[fila.key] }}
        >
          {fila.estado}
        </p>

        <p className="mt-1 text-lg font-semibold text-white">
          {fila.goles} gol{fila.goles === 1 ? "" : "es"}
        </p>

        <p className="text-[11px] text-zinc-500">
          {fila.total
            ? `${Math.round((fila.remates / fila.total) * 100)}% remate · xG ${fila.xg.toFixed(2)}`
            : "Sin acciones"}
        </p>
      </button>
    ))}
  </div>
</Panel>
<Panel title="xG por tipo de acción" analisis={pie({ metrica: "xg", dimension: "tipo de acción", categoria: (r) => r.tipoAccion })}>
  <div id="grafico-xg-tipo-accion">

  <Chart>
    <BarChart
      data={xgByTipoAccion}
      layout="vertical"
      onClick={pulsaIndice(xgByTipoAccion, (d) => pulsa("tipoAccion", d.name))}
      style={{ cursor: "pointer" }}
margin={{
  top: 10,
  right: 24,
  left: 10,
  bottom: 10,
}}
    >
      <CartesianGrid
        stroke="#1E232A"
        horizontal={false}
      />

      <XAxis
        type="number"
        domain={[0, (dataMax: number) => Math.ceil(dataMax * 1.15)]}
        axisLine={false}
        tickLine={false}
        tick={{
          fill: "#94A3B8",
        }}
      />

      <YAxis
        type="category"
        dataKey="name"
        width={
  isNarrow
    ? 160
    : 220
}
        axisLine={false}
        tickLine={false}
        tick={{
          fill: "#CBD5E1",
          fontSize: 11,
        }}
      />

      <Tooltip />

      <Bar
        dataKey="total"
        fill={COLORS.green}
        radius={[0, 8, 8, 0]}
      >
        {xgByTipoAccion.map((d) => (
          <Cell key={d.name} fill={COLORS.green} {...pinta("tipoAccion", d.name)} />
        ))}
        <LabelList
          dataKey="total"
          position="right"
          formatter={(v) =>
            typeof v === "number"
              ? v.toFixed(2)
              : ""
          }
          style={{
            fill: "#fff",
            fontWeight: 600,
          }}
        />
      </Bar>
    </BarChart>
  </Chart></div>
</Panel>

<Panel title="Top rivales por xG concedido" analisis={pie({ metrica: "xg", dimension: "rival", categoria: (r) => r.rival })}>
  <div id="grafico-rivales-xg-concedido">

  <Chart>
    <BarChart
      data={rivalesData}
      onClick={pulsaIndice(rivalesData, (d) => pulsa("rival", d.name))}
      style={{ cursor: "pointer" }}
    >
      <CartesianGrid
        stroke="#1E232A"
        vertical={false}
      />

      <XAxis
  dataKey="name"
  domain={[0, (dataMax: number) => Math.ceil(dataMax * 1.15)]}
  interval={0}
  height={70}
  axisLine={false}
  tickLine={false}
  tick={{
    fill: "#CBD5E1",
    fontSize: 11,
  }}
  angle={-25}
  textAnchor="end"
/>

      <YAxis
        axisLine={false}
        tickLine={false}
      />

      <Tooltip />

      <Bar
        dataKey="total"
        fill={COLORS.blue}
        radius={[8, 8, 0, 0]}
      >
        {rivalesData.map((d) => (
          <Cell key={d.name} fill={COLORS.blue} {...pinta("rival", d.name)} />
        ))}
        <LabelList
          dataKey="total"
          position="top"
        />
      </Bar>
    </BarChart>
  </Chart></div>
</Panel>
<Panel title="xG por zona caida" analisis={pie({ metrica: "xg", dimension: "zona de caída", categoria: (r) => r.zonaCaida })}>
  <div id="grafico-xg-caida">

  <Chart>
 <BarChart
  data={xgZonaCaida}
  layout="vertical"
  onClick={pulsaIndice(xgZonaCaida, (d) => pulsa("zonaCaida", d.name))}
  style={{ cursor: "pointer" }}
  barCategoryGap={20}
  margin={{
    top: 10,
    right: 24,
    left: 10,
    bottom: 10,
  }}
>
      <CartesianGrid
        stroke="#1E232A"
        horizontal={false}
      />
      <XAxis
  type="number"
  domain={[0, (dataMax: number) => Math.ceil(dataMax * 1.15)]}
  axisLine={false}
  tickLine={false}
  tick={{
    fill: "#94A3B8",
  }}
/>

      <YAxis
  type="category"
  dataKey="name"
  width={
    isNarrow
      ? 220
      : 330
  }
  interval={0}
  axisLine={false}
  tickLine={false}
  tickMargin={10}
  tick={(props) => {
  const {
    x,
    y,
    payload,
  } = props;

  const label =
  String(payload.value);

const words =
  label.length > 18
    ? label.split(" ")
    : [label];

  return (
    <text
      x={x}
      y={y}
      fill="#CBD5E1"
      fontSize="11"
      textAnchor="end"
    >
      {words.map(
        (word, index) => (
          <tspan
            key={index}
            x={x}
            dy={
              index === 0
                ? -(words.length - 1) * 6
                : 12
            }
          >
            {word}
          </tspan>
        )
      )}
    </text>
  );
}}
/>

      <Tooltip />

      <Bar
        dataKey="total"
        fill={COLORS.green}
        radius={[0, 8, 8, 0]}
      >
        {xgZonaCaida.map((d) => (
          <Cell key={d.name} fill={COLORS.green} {...pinta("zonaCaida", d.name)} />
        ))}
        <LabelList
          dataKey="total"
          position="right"
        />
      </Bar>
    </BarChart>
  </Chart></div>
</Panel>
<Panel title="Resultado final" analisis={pie({ dimension: "resultado", dimensionDerivada: true, categoria: (r) => normalizaResultado(r.resultadoFinal) })}>
  <Explicativo>

  <p className="-mt-3 mb-4 text-xs text-zinc-500">
    {peligrosasResultado} de {filasResultado.length} acciones acaban en gol u
    ocasión ({tasaPeligroResultado.toFixed(1)}%). Pulsa un sector para filtrar.
  </p>

  </Explicativo>

  <div id="grafico-conversión">

  <Chart>
    <PieChart
  margin={{
    top: 20,
    right: isMobile ? 10 : 140,
    bottom: isMobile ? 80 : 20,
    left: isMobile ? 10 : 20,
  }}
>

      <Pie
       onClick={(_, i) =>
         resultadoData[i] && pulsa("resultado", resultadoData[i].name)
       }
  data={resultadoData}
  dataKey="total"
  nameKey="name"
  cx={isMobile ? "50%" : "50%"}
  cy="50%"
innerRadius={
  isMobile ? 65 : 95
}

outerRadius={
  isMobile ? 90 : 120
}
  paddingAngle={4}
  cornerRadius={8}
  stroke="transparent"
>
        {resultadoData.map((entry) => (
          <Cell
            key={entry.name}
            fill={
              RESULTADO_COLORS[entry.name] ||
              "#475569"
            }
            {...pinta("resultado", entry.name)}
          />
        ))}
   <Label
value={`${tasaPeligroResultado.toFixed(0)}%`}
  position="center"
  fill="#fff"
  fontSize={isMobile ? 22 : 30}
/>
    <LabelList
  dataKey="total"
  position="inside"
  fill="#fff"
  fontSize={12}
/>
      </Pie>

      <Tooltip />

      <Legend
        {...pieLegendProps}
        onClick={(e) => pulsa("resultado", String(e.value))}
      />
    </PieChart>
  </Chart></div>
</Panel>

<Panel title="Calidad del envío" analisis={pie({ metrica: "xg", dimension: "calidad de envío", categoria: (r) => (r.calidadEnvio ? "Calidad " + r.calidadEnvio : "") })}>
  <Explicativo>

  <p className="-mt-3 mb-4 text-xs text-zinc-500">
    Escala 1-4 valorada por el cuerpo técnico: volumen de envíos y
    porcentaje que termina en remate.
  </p>

  </Explicativo>

  <div id="grafico-calidad-envio">
  <Chart>
    <ComposedChart
      data={calidadEnvioData}
      onClick={pulsaIndice(calidadEnvioData, (d) => pulsa("calidad", d.name))}
      style={{ cursor: "pointer" }}
      margin={{
        top: 10,
        right: 24,
        left: 10,
        bottom: 10,
      }}
    >
      <CartesianGrid
        stroke="#1E232A"
        vertical={false}
      />

      <XAxis
        dataKey="name"
        tick={{ fill: "#94A3B8", fontSize: 11 }}
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
        unit="%"
        domain={[0, 100]}
        tick={{ fill: "#94A3B8", fontSize: 11 }}
        axisLine={false}
        tickLine={false}
      />

      <Tooltip />

      <Legend {...pieLegendProps} />

      <Bar
        yAxisId="left"
        dataKey="total"
        name="Envíos"
        fill={COLORS.gold}
        radius={[8, 8, 0, 0]}
      >
        {calidadEnvioData.map((d) => (
          <Cell key={d.name} fill={COLORS.gold} {...pinta("calidad", d.name)} />
        ))}
        <LabelList dataKey="total" position="top" />
      </Bar>

      <Line
        yAxisId="right"
        type="monotone"
        dataKey="pctRemate"
        name="% que acaba en remate"
        stroke={COLORS.green}
        strokeWidth={2.5}
        dot={{ r: 4 }}
      />
    </ComposedChart>
  </Chart></div>
</Panel>

<Panel title="Superioridad en corto" analisis={pie({ dimension: "superioridad", categoria: (r) => (esSuperioridad(r.zonaCaida) ? r.zonaCaida : "") })}>
  <Explicativo>

  <p className="-mt-3 mb-4 text-xs text-zinc-500">
    Ventajas numéricas creadas antes del envío al área. Estos valores no
    son zonas de caída, por eso se analizan aparte.
  </p>

  </Explicativo>

  <div id="grafico-superioridad">
  <Chart>
    <BarChart
      data={superioridadData}
      onClick={pulsaIndice(superioridadData, (d) => pulsa("zonaCaida", d.name))}
      style={{ cursor: "pointer" }}
      margin={{
        top: 10,
        right: 24,
        left: 10,
        bottom: 10,
      }}
    >
      <CartesianGrid
        stroke="#1E232A"
        vertical={false}
      />

      <XAxis
        dataKey="name"
        tick={{ fill: "#94A3B8", fontSize: 11 }}
        axisLine={false}
        tickLine={false}
      />

      <YAxis
        tick={{ fill: "#94A3B8", fontSize: 11 }}
        axisLine={false}
        tickLine={false}
      />

      <Tooltip />

      <Legend {...pieLegendProps} />

      <Bar
        dataKey="total"
        name="Acciones"
        fill={COLORS.blue}
        radius={[8, 8, 0, 0]}
      >
        {superioridadData.map((d) => (
          <Cell key={d.name} fill={COLORS.blue} {...pinta("zonaCaida", d.name)} />
        ))}
        <LabelList dataKey="total" position="top" />
      </Bar>

      <Bar
        dataKey="goles"
        name="Goles"
        fill={COLORS.green}
        radius={[8, 8, 0, 0]}
      >
        {superioridadData.map((d) => (
          <Cell key={d.name} fill={COLORS.green} {...pinta("zonaCaida", d.name)} />
        ))}
      </Bar>
    </BarChart>
  </Chart></div>
</Panel>

<Panel title="Estructura de la jugada" analisis={pie({ dimension: "atacantes en el área", categoria: (r) => (r.nAtacantes ? r.nAtacantes + " atacantes" : "") })}>
  <Explicativo>

  <p className="-mt-3 mb-4 text-xs text-zinc-500">
    Número de atacantes implicados frente al xG medio generado y a los
    bloqueadores utilizados.
  </p>

  </Explicativo>

  <div id="grafico-estructura">
  <Chart>
    <ComposedChart
      data={estructuraData}
      onClick={pulsaIndice(estructuraData, (d) => pulsa("atacantes", d.name))}
      style={{ cursor: "pointer" }}
      margin={{
        top: 10,
        right: 24,
        left: 10,
        bottom: 10,
      }}
    >
      <CartesianGrid
        stroke="#1E232A"
        vertical={false}
      />

      <XAxis
        dataKey="name"
        tick={{ fill: "#94A3B8", fontSize: 11 }}
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
        tick={{ fill: "#94A3B8", fontSize: 11 }}
        axisLine={false}
        tickLine={false}
      />

      <Tooltip />

      <Legend {...pieLegendProps} />

      <Bar
        yAxisId="left"
        dataKey="total"
        name="Acciones"
        fill="#66758A"
        radius={[8, 8, 0, 0]}
      >
        {estructuraData.map((d) => (
          <Cell key={d.name} fill="#66758A" {...pinta("atacantes", d.name)} />
        ))}
        <LabelList dataKey="total" position="top" />
      </Bar>

      <Line
        yAxisId="right"
        type="monotone"
        dataKey="xgMedio"
        name="xG medio"
        stroke={COLORS.gold}
        strokeWidth={2.5}
        dot={{ r: 4 }}
      />

      <Line
        yAxisId="right"
        type="monotone"
        dataKey="bloqueadoresMedio"
        name="Bloqueadores (media)"
        stroke={COLORS.purple}
        strokeWidth={2}
        strokeDasharray="5 4"
        dot={{ r: 3 }}
      />
    </ComposedChart>
  </Chart></div>
</Panel>

            </div>

          </section>
        </div>
      </div>
      <button
  onClick={downloadPDF}
  className="
    fixed
    top-24
    right-5
    z-50

    h-12
    w-12

    rounded-full
    bg-[#C8A96B]
    text-black

    flex
    items-center
    justify-center

    shadow-xl
    hover:scale-105
    transition-all
  "
>
  <FileDown size={18} />
</button>
    </main>
  );
}

function Chart({
  children,
}: {
  children: React.ReactElement;
}) {
  return (
    <div
  title={PULSA}
  className="
h-[360px]
    sm:h-[450px]
    md:h-[420px]
    w-full
  "
>
      <ResponsiveContainer
        width="100%"
        height="100%"
      >
        {children}
      </ResponsiveContainer>
    </div>
  );
}

/**
 * Tarjeta de indicador.
 *
 * `hint` no es decorativo: "Conversión" o "xG / ABP" no se interpretan igual
 * según quién mire la página, y la definición corta debajo del número evita
 * que cada uno la entienda a su manera.
 */
function Card({
  title,
  value,
  hint,
  onClick,
  activo = false,
}: {
  title: string;
  value: React.ReactNode;
  hint?: string;
  /** Las tarjetas que son un valor concreto («Goles») filtran por él. */
  onClick?: () => void;
  activo?: boolean;
}) {
  const Caja = onClick ? "button" : "div";

  return (
    <Caja
      {...(onClick ? { type: "button" as const, onClick, title: PULSA } : {})}
      className={`rounded-2xl md:rounded-3xl border bg-white/[0.03] p-4 md:p-6 text-left ${
        activo ? "border-[#C8A96B]" : "border-white/10"
      } ${onClick ? "cursor-pointer transition hover:bg-white/[0.05]" : ""}`}
    >
      <p className="text-sm text-zinc-400">
        {title}
      </p>

      <h3
  className="
    mt-3 md:mt-4
    text-xl md:text-2xl
    font-semibold
    break-words
    leading-tight
  "
>
        {value}
      </h3>

      {hint && (
        <p className="mt-2 text-[11px] leading-snug text-white/35">{hint}</p>
      )}
    </Caja>
  );
}

function Panel({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
  /* Se recibe y no se pinta: así estaba ya, y el pie de cada sección se
     sigue pasando por si un día se vuelve a enseñar. */
  analisis?: React.ReactNode;
}) {
  return (
    <div className="rounded-2xl md:rounded-3xl border border-white/10 bg-white/[0.03] p-5 md:p-8 shadow-xl overflow-hidden">
      <h2 className="mb-5 md:mb-6 text-lg md:text-2xl font-semibold">
        {title}
      </h2>

      {children}
    </div>
  );
}
