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
  LineChart,
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
  "https://docs.google.com/spreadsheets/d/e/2PACX-1vS3_1ScOV6sTyEpZSgLgCf2dKbwkLzb3zUEYM-7ZOoMbcFUTp7nvu1pBfGOP7EzppXXQYQhLeVa_SPr/pub?gid=1071911136&single=true&output=csv";

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
  "Gol Rival": "#B45454",
  "Ocasión": "#D08A7E",
  "ABP": "#5E7FB8",
  "Nada": "#475569",
  "Transición Ofensiva": "#567A68",
  "Gol RMCF": "#10B981",
};

/** El nodo del flujo que agrupa todas las superioridades. */
const SUPERIORIDAD = "Superioridad en corto";

/**
 * Normaliza el resultado final defensivo al vocabulario cerrado del cuerpo técnico.
 * Ojo al orden: "Gol RMCF" es gol nuestro tras transición, no gol encajado.
 */
function normalizaResultado(v?: string): string {
  const t = (v || "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .trim();

  if (!t) return "Nada";
  if (t.includes("gol") && t.includes("rmcf")) return "Gol RMCF";
  if (t.includes("gol")) return "Gol Rival";
  if (t.includes("ocas")) return "Ocasión";
  if (t.includes("transici")) return "Transición Ofensiva";
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
  /** Competición, jornada, minuto y marcador de la acción. */
  contexto: ContextoAccion;
  rival: string;
  tiempo: string;
  perfil: string;

  tipoAccion: string;
  perfilGolpeo: string;
  tipoEnvio: string;
  zonaCaida: string;
  calidadEnvio: string;

  nAtacantes: number;
  tipoCarrera: string;

  oc1P: string;
  ocCentral: string;
  oc2P: string;
  ocFrontal: string;

  remate: string;
  tipoRemate: string;
  zonaRemate: string;

  xg: number;

  segundoBalon: string;
  resultadoFinal: string;
};

/** Número tolerante con la coma decimal; 0 cuando la celda no trae nada. */
function num(v?: string) {
  return numero(v) ?? 0;
}

/**
 * Lee la hoja **por el nombre de la columna**, no por su posición.
 *
 * La hoja defensiva ya escribe el minuto en una columna llamada «MINUTO» —en
 * mayúsculas y al final de todo— y va a escribir también el marcador. Leyendo
 * por índice, cualquiera de las dos cosas movía el xG de sitio sin que nada
 * fallara: los números seguían saliendo, sólo que eran otros.
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
    .map((fila) => ({
      contexto: contextoDeFila(fila),
      rival: lee(fila, "Rival"),
      tiempo: lee(fila, "Tiempo"),
      perfil: lee(fila, "Perfil"),

      tipoAccion: lee(fila, "Tipo_Accion", "TipoAccion"),
      perfilGolpeo: lee(fila, "Perfil_Golpeo"),
      tipoEnvio: lee(fila, "Tipo_Envio"),
      zonaCaida: lee(fila, "Zona_Caida"),
      calidadEnvio: lee(fila, "Calidad_Envio"),

      nAtacantes: numero(lee(fila, "N_Atacantes")) ?? 0,

      tipoCarrera: lee(fila, "Tipo_Carrera"),

      oc1P: lee(fila, "Oc_1P"),
      ocCentral: lee(fila, "Oc_Central"),
      oc2P: lee(fila, "Oc_2P"),
      ocFrontal: lee(fila, "Oc_Frontal"),

      remate: lee(fila, "Remate"),
      tipoRemate: lee(fila, "Tipo_Remate"),
      zonaRemate: lee(fila, "Zona_Remate"),

      xg: numero(lee(fila, "xG")) ?? 0,

      segundoBalon: lee(fila, "Segundo_Balon"),
      resultadoFinal: lee(fila, "Resultado_Final"),
    }))
    .filter(
      (r) =>
        Boolean(r.contexto.jornada.clave) &&
        !r.tipoAccion.toLowerCase().includes("penal"),
    );
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
 * Aquí el sujeto de la acción es **el rival**: «Ocasión» es ocasión suya y el
 * peligro se cuenta como peligro concedido, no como producción nuestra. Lo
 * nuestro va marcado a mano («Gol RMCF», «Transición Ofensiva») y por eso no
 * entra. Leído como en la hoja ofensiva, todo el peligro del rival se contaría
 * a nuestro favor y el panel saldría a cero sin fallar nada.
 */
const LECTOR: LectorAnalisis<Row> = {
  jornada: (r) => r.contexto.jornada,
  peligro: (r) =>
    ["Gol Rival", "Ocasión"].includes(normalizaResultado(r.resultadoFinal)),
  gol: (r) => normalizaResultado(r.resultadoFinal) === "Gol Rival",
  remate: (r) => ["si", "sí"].includes((r.remate || "").trim().toLowerCase()),
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

const [perfil, setPerfil] =
  useState("ALL");

const [tiempo, setTiempo] =
  useState("ALL");

/*
| Los tres filtros de contexto, los mismos que en el ABP ofensivo y en los
| saques de banda: de qué competición es el partido, cómo iba el marcador y en
| qué cuarto de hora pasó. Salen de columnas que la hoja ya trae.
*/
const [competicionFilter, setCompeticionFilter] = useState(SIN_PRETEMPORADA);
const [estadoFilter, setEstadoFilter] = useState("ALL");
const [tramoFilter, setTramoFilter] = useState("ALL");

  /*
  | Lo que se filtra pulsando los gráficos.
  |
  | Antes iba en un objeto aparte (`visualFilters`) que el cajón no veía: ahora
  | cada dimensión tiene su estado, como en el ABP ofensivo, y todas pasan por
  | la misma lista de `dimensiones` de abajo.
  */
  const [tipoAccionFilter, setTipoAccionFilter] = useState("ALL");
  const [zonaCaidaFilter, setZonaCaidaFilter] = useState("ALL");
  const [zonaAreaFilter, setZonaAreaFilter] = useState("ALL");
  const [perfilGolpeoFilter, setPerfilGolpeoFilter] = useState("ALL");
  const [tipoRemateFilter, setTipoRemateFilter] = useState("ALL");
  const [tipoEnvioFilter, setTipoEnvioFilter] = useState("ALL");
  const [zonaRemateFilter, setZonaRemateFilter] = useState("ALL");
  const [segundoBalonFilter, setSegundoBalonFilter] = useState("ALL");
  const [tipoCarreraFilter, setTipoCarreraFilter] = useState("ALL");
  const [resultadoFilter, setResultadoFilter] = useState("ALL");
  const [calidadFilter, setCalidadFilter] = useState("ALL");
  const [atacantesFilter, setAtacantesFilter] = useState("ALL");
  useEffect(() => {
    traeCsv(CSV_URL)
      .then((t) =>
        setRows(parseCSV(t))
      );
  }, []);

  /*
  | Las jornadas, cada una con su competición.
  |
  | Se indexan por `clave` («liga:1», «amistoso:1»): antes se convertía la
  | celda a número y «PRETEMPORADA 01» y «LIGA 01» eran los dos la jornada 1,
  | así que el filtro mezclaba un amistoso de julio con el primer partido de
  | liga sin que nada lo dijera.
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
  const rivales = useMemo(
  () =>
    [...new Set(rows.map(r => r.rival))]
      .filter(Boolean)
      .sort(),
  [rows]
);

const perfiles = useMemo(
  () =>
    [...new Set(rows.map(r => r.perfil))]
      .filter(Boolean)
      .sort(),
  [rows]
);
/*
| Todo lo que se puede filtrar, en un sitio.
|
| Cada dimensión lleva su estado (los del cajón y los de los clics son los
| mismos) y cómo se compara una fila con lo elegido. De aquí salen
| `filtered`, las versiones «sin esta dimensión» con las que se pinta cada
| gráfico y la tira de «Filtrando: …».
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
    clave: "rival",
    etiqueta: "Rival",
    valor: rival,
    poner: setRival,
    coincide: (r, v) => r.rival === v,
  },
  {
    clave: "perfil",
    etiqueta: "Perfil",
    valor: perfil,
    poner: setPerfil,
    coincide: (r, v) => r.perfil === v,
  },
  {
    /* La parte, comparada por el número y no por el texto: la hoja escribe
       «1T» y las de banda «T1», y el día que aquí se cambie no debe romperse. */
    clave: "tiempo",
    etiqueta: "Parte",
    valor: tiempo,
    poner: setTiempo,
    coincide: (r, v) => String(r.contexto.minuto.parte ?? "") === v,
    texto: (v) => `${v}ª parte`,
  },
  {
    clave: "tipoAccion",
    etiqueta: "Tipo acción",
    valor: tipoAccionFilter,
    poner: setTipoAccionFilter,
    coincide: (r, v) => igual(r.tipoAccion, v),
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
    coincide: (r, v) =>
      zonasDeAccion(
        { zonaCaida: r.zonaCaida, zonaRemate: r.zonaRemate },
        "defensive",
      ).includes(v),
    texto: (v) => ZONA_AREA_LABEL[v] ?? v,
  },
  {
    clave: "perfilGolpeo",
    etiqueta: "Perfil de golpeo",
    valor: perfilGolpeoFilter,
    poner: setPerfilGolpeoFilter,
    coincide: (r, v) => igual(r.perfilGolpeo, v),
  },
  {
    clave: "tipoRemate",
    etiqueta: "Tipo remate",
    valor: tipoRemateFilter,
    poner: setTipoRemateFilter,
    coincide: (r, v) => igual(r.tipoRemate, v),
  },
  {
    clave: "tipoEnvio",
    etiqueta: "Tipo envío",
    valor: tipoEnvioFilter,
    poner: setTipoEnvioFilter,
    coincide: (r, v) => igual(r.tipoEnvio, v),
  },
  {
    /* El campo de «Situación global» agrupa «Primer Palo» y «1P» en «1P»:
       vale cualquiera de las dos escrituras. */
    clave: "zonaRemate",
    etiqueta: "Zona remate",
    valor: zonaRemateFilter,
    poner: setZonaRemateFilter,
    coincide: (r, v) =>
      igual(r.zonaRemate, v) || zonaRemateDelCampo(r.zonaRemate) === v,
    rotuloCoincide: (rotulo, v) =>
      rotulo === v || zonaRemateDelCampo(rotulo) === v,
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
    coincide: (r, v) => {
      const calidad = num(r.calidadEnvio);
      return Boolean(calidad) && `Calidad ${calidad}` === v;
    },
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
const filasPerfilGolpeo = sin("perfilGolpeo");
const filasTipoAccion = sin("tipoAccion");
const filasTipoRemate = sin("tipoRemate");
const filasEnvio = sin("tipoEnvio");
const filasRival = sin("rival");
const filasZonaCaida = sin("zonaCaida");
const filasResultado = sin("resultado");
const filasCalidad = sin("calidad");
const filasAtacantes = sin("atacantes");
const filasTramo = sin("tramo");
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

const equiposVisualizados = [...new Set(filasRival.map((r) => r.rival))]
  .filter(Boolean)
  .sort();

  const metrics = {
  total: filtered.length,

  xg: filtered.reduce(
    (a, b) => a + b.xg,
    0
  ),

  shots: filtered.filter((r) => {
    const remate = r.remate?.trim().toLowerCase();
    return remate === "sí" || remate === "si";
  }).length,

  // Gol que marca el rival (encajado)
  goalsAgainst: filtered.filter((r) => {
    const res = r.resultadoFinal.toLowerCase();
    return res.includes("gol") && !res.includes("gol rmcf");
  }).length,

  // Gol que marca el RMCF tras transición
  goalsRMCF: filtered.filter((r) =>
    r.resultadoFinal.toLowerCase().includes("gol rmcf")
  ).length,
};

  const tipoAccion =
    countBy(sin("tipoAccion"), "tipoAccion");

  const zonaCaida =
    countBy(filasZonaCaida, "zonaCaida");

  const tipoCarrera =
    countBy(sin("tipoCarrera"), "tipoCarrera");
  
  
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
  
const zonaRemateData =
  countBy(
    sin("zonaRemate").filter(
      (r) => r.zonaRemate
    ),
    "zonaRemate"
  );

const segundoBalonData =
  countBy(
    sin("segundoBalon").filter(
      (r) => r.segundoBalon
    ),
    "segundoBalon"
  );
const sacadorData =
  useMemo(() => {
    const grouped: Record<
      string,
      number
    > = {};

    filasPerfilGolpeo.forEach((r) => {
      if (!r.perfilGolpeo) return;

      grouped[r.perfilGolpeo] =
        (grouped[r.perfilGolpeo] || 0) +
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
  }, [filasPerfilGolpeo]);
  const rematadoresData =
  useMemo(() => {
    const grouped: Record<
      string,
      number
    > = {};

    filasTipoRemate.forEach((r) => {
      if (
        !r.tipoRemate ||
        [
          "no remate",
          "no aplica",
          "no",
          "sin remate",
          "-",
        ].includes(r.tipoRemate.trim().toLowerCase())
      )
        return;

      grouped[r.tipoRemate] =
        (grouped[r.tipoRemate] || 0) +
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
  }, [filasTipoRemate]);
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

// Desglose completo del resultado final
// (Gol Rival / Ocasión / ABP / Nada / Transición Ofensiva / Gol RMCF)
const resultadoData = useMemo(() => {
  const orden = [
    "Gol Rival",
    "Ocasión",
    "ABP",
    "Nada",
    "Transición Ofensiva",
    "Gol RMCF",
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

// Acciones en las que el rival acaba generando peligro (gol u ocasión)
const accionesPeligrosas = filtered.filter((r) => {
  const res = normalizaResultado(r.resultadoFinal);
  return res === "Gol Rival" || res === "Ocasión";
}).length;

const tasaPeligro =
  filtered.length > 0
    ? (accionesPeligrosas / filtered.length) * 100
    : 0;

// Calidad del envío rival (1-4) frente al peligro que nos genera
const calidadEnvioData = useMemo(() => {
  const grouped: Record<
    number,
    { total: number; xg: number; remates: number }
  > = {};

  filasCalidad.forEach((r) => {
    const calidad = num(r.calidadEnvio);
    if (!calidad) return;

    if (!grouped[calidad]) {
      grouped[calidad] = {
        total: 0,
        xg: 0,
        remates: 0,
      };
    }

    grouped[calidad].total += 1;
    grouped[calidad].xg += r.xg;

    if (
      r.tipoRemate &&
      !["", "No Remate", "No aplica"].includes(r.tipoRemate)
    ) {
      grouped[calidad].remates += 1;
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

// Superioridades que el rival genera en el juego en corto (3v2, 2v1...)
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

      if (normalizaResultado(r.resultadoFinal) === "Gol Rival") {
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

// Estructura de la jugada: atacantes rivales frente al xG concedido
// y a la ocupación media que desplegamos dentro del área.
const estructuraData = useMemo(() => {
  const grouped: Record<
    number,
    { total: number; xg: number; ocupacion: number }
  > = {};

  filasAtacantes.forEach((r) => {
    if (!r.nAtacantes) return;

    if (!grouped[r.nAtacantes]) {
      grouped[r.nAtacantes] = {
        total: 0,
        xg: 0,
        ocupacion: 0,
      };
    }

    grouped[r.nAtacantes].total += 1;
    grouped[r.nAtacantes].xg += r.xg;
    grouped[r.nAtacantes].ocupacion +=
      num(r.oc1P) +
      num(r.ocCentral) +
      num(r.oc2P) +
      num(r.ocFrontal);
  });

  return Object.entries(grouped)
    .map(([atacantes, v]) => ({
      name: `${atacantes} atacantes`,
      total: v.total,
      xgMedio: +(v.xg / v.total).toFixed(3),
      ocupacionMedia: +(v.ocupacion / v.total).toFixed(1),
    }))
    .sort(
      (a, b) => parseInt(a.name) - parseInt(b.name)
    );
}, [filasAtacantes]);
  /*
  | Cuándo nos lanzan el balón parado, y cuándo hacen daño.
  |
  | Antes esto eran dos barras —primera parte y segunda— porque era lo único
  | que traía la hoja. Ahora que se anota el minuto se puede ver el cuarto de
  | hora, que es donde se ve de verdad si el equipo se descuelga al final.
  | Las acciones sin minuto se dejan fuera y se dicen.
  */
  const conMinuto = filasTramo.filter(
    (r) => r.contexto.minuto.tramo !== null
  );

  const sinMinuto = filasTramo.length - conMinuto.length;

  /* «Gol Rival», que es lo que devuelve `normalizaResultado`: comparado con
     «Gol» a secas no casaba nunca y los tramos y el marcador decían siempre
     cero encajados. */
  const esGolRival = (r: Row) =>
    normalizaResultado(r.resultadoFinal) === "Gol Rival";

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
      goles: dentro.filter(esGolRival).length,
    };
  });

  /* Y lo mismo según cómo iba el marcador cuando nos lo lanzaron. */
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
      goles: dentro.filter(esGolRival).length,
      xg: Number(dentro.reduce((suma, r) => suma + r.xg, 0).toFixed(2)),
    };
  });
   const pieLegendProps: Partial<LegendProps> = {
  layout: isNarrow
    ? "horizontal"
    : "vertical",

  verticalAlign: isNarrow
    ? "bottom"
    : "middle",

  align: isNarrow
    ? "center"
    : "right",

  wrapperStyle: {
    fontSize: 11,
    color: "#CBD5E1",
    paddingTop: isNarrow
      ? 20
      : 0,
  },
};
const conversion =
  metrics.shots > 0
    ? (metrics.goalsAgainst / metrics.shots) * 100
    : 0;

const xgAccion =
  metrics.total > 0
    ? metrics.xg / metrics.total
    : 0;

/* Lo que se escribe en el PDF como «Filtros aplicados». */
const activeFilters = [
  ...(hayPretemporada && competicionFilter === SIN_PRETEMPORADA
    ? [{ label: "Competición", value: `${rotuloOficial} (sin pretemporada)` }]
    : []),
  ...chips
    .filter((c) => !(c.clave === "competicion" && competicionFilter === SIN_PRETEMPORADA))
    .map((c) => ({ label: c.etiqueta, value: c.texto })),
];

/* El panel de «Resultado final» se pinta sin su propio filtro: su frase y su
   porcentaje central salen de esas mismas filas. */
const peligrosasResultado = filasResultado.filter(LECTOR.peligro).length;
const tasaPeligroResultado = filasResultado.length
  ? (peligrosasResultado / filasResultado.length) * 100
  : 0;

/* El perfil de golpeo que más xG nos genera con lo que se está viendo. */
const mayorPerfil = filtered
  .reduce((acc, r) => {
    if (!r.perfilGolpeo) return acc;
    const previo = acc.find((uno) => uno.name === r.perfilGolpeo);
    if (previo) previo.xg += r.xg;
    else acc.push({ name: r.perfilGolpeo, xg: r.xg });
    return acc;
  }, [] as { name: string; xg: number }[])
  .sort((a, b) => b.xg - a.xg)[0]?.name;
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
    "ABP DEFENSIVO",
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
    "Real Madrid Castilla · Análisis ABP Defensivo",
    20,
    52
  );

  // ==========================================
  // KPIs
  // ==========================================

const cards = [
  ["ABP", metrics.total.toString()],
  ["xG Concedido", metrics.xg.toFixed(2)],
  ["Remates", metrics.shots.toString()],
  ["Gol Rival", metrics.goalsAgainst.toString()],
  ["Gol RMCF", metrics.goalsRMCF.toString()],
  ["Conversión Rival", `${conversion.toFixed(1)}%`],
];

  cards.forEach(([title, value], i) => {
  const x = 18 + i * 44;

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
    "xG / ABP",
    xgAccion.toFixed(2),
  ],
  [
    "Peor Sacador Rival",
    mayorPerfil || "-",
  ],
  [
    "Remates / ABP",
    (
      metrics.shots /
      Math.max(metrics.total, 1)
    ).toFixed(2),
  ],
[
  "Gol Rival / ABP",
  (
    metrics.goalsAgainst /
    Math.max(metrics.total, 1)
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
// DATOS RESUMEN
// ==========================================

const resumen = [
  `• ${metrics.total} acciones ABP defensivas analizadas`,
  `• ${metrics.xg.toFixed(2)} xG concedido`,
`• Conversión rival del ${conversion.toFixed(1)}%`,
`• ${metrics.shots} remates recibidos`,
`• ${metrics.goalsAgainst} goles encajados`,
`• ${metrics.goalsRMCF} goles RMCF tras transición`,
  `• Sacador rival más peligroso: ${mayorPerfil || "-"}`,
  `• xG concedido por acción: ${xgAccion.toFixed(2)}`,
  `• ${tasaPeligro.toFixed(1)}% acaban en gol u ocasión del rival`,
];

// ==========================================
// FILTROS
// ==========================================

const filtros =
  activeFilters
    .filter((f) => f.value !== "ALL")
    .map(
      (f) => `${f.label}: ${f.value}`
    );

const filtrosTexto =
  filtros.length
    ? filtros
    : [
        "Temporada completa",
        "Todas las ABP defensivas",
        "Todos los rivales",
        "Todos los jugadores",
      ];

// altura común para ambas tarjetas
const cardHeight = Math.max(
  60,
  20 +
    Math.max(
      filtrosTexto.length,
      resumen.length
    ) *
      6
);

// ---------- FILTROS ----------

doc.setFillColor(
  248,
  248,
  248
);

doc.roundedRect(
  20,
  118,
  105,
  cardHeight,
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
  cardHeight,
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
    id: "grafico-impacto-rematadores",
    title: "Impacto rematadores",
  },
  {
    id: "grafico-tipo-envio",
    title: "xG por envío",
  },
  {
    id: "grafico-zona-remate",
    title: "Zona remate",
  },
  {
    id: "grafico-segundo-balon",
    title: "Segundo balón",
  },
  {
    id: "grafico-tipo-carrera",
    title: "Tipo carrera",
  },
  {
    id: "grafico-distribucion-periodo",
    title: "Distribución temporal",
  },
  {
    id: "grafico-xg-tipo-accion",
    title: "xG por acción",
  },
  {
    id: "grafico-rivales-xg-concedido",
    title: "Rivales xG",
  },
  {
    id: "grafico-xg-zona-caida",
    title: "xG zona caída",
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
    id: "grafico-conversion",
    title: "Resultado final",
  },
];

const chartNodes =
  document.querySelectorAll(
    charts
      .map((c) => `#${c.id}`)
      .join(", ")
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

  margin: {
    left: 10,
    right: 10,
  },

  tableWidth: "auto",

  didDrawPage: () => {
    paintPage();
  },

head: [[
  "Rival",
  "Tipo Acción",
  "Zona Caída",
  "Tipo Remate",
  "xG",
]],

  body: filtered.map((r) => [
    r.rival,
    r.tipoAccion,
    r.zonaCaida,
    r.tipoRemate,
    r.xg.toFixed(2),
  ]),

  theme: "striped",

  styles: {
    textColor: [30, 30, 30],
    fontSize: 8,
    cellPadding: 2.5,
    overflow: "linebreak",
    valign: "middle",
  },

  headStyles: {
    fillColor: [200, 169, 107],
    textColor: [0, 0, 0],
    fontStyle: "bold",
    halign: "center",
  },

  columnStyles: {
    0: { cellWidth: 55 },
    1: { cellWidth: 45 },
    2: { cellWidth: 55 },
    3: { cellWidth: 55 },
    4: { cellWidth: 50 },
    5: {
      cellWidth: 15,
      halign: "center",
    },
  },

  alternateRowStyles: {
    fillColor: [245, 245, 245],
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
      `Real Madrid Castilla · ABP Defensivo · Página ${i}/${pages}`,
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
    `ABP_Defensivo_${new Date()
      .toISOString()
      .slice(0, 10)}.pdf`
  );
};
/*
| Las conclusiones de arriba: qué dice lo que se está viendo, no cómo se ha
| hecho. Salen de `filtered`, las mismas filas que pintan los gráficos. Aquí
| el sujeto es el rival: lo que nos genera y lo que le concedemos.
*/
const textosExplicativos = useTextosExplicativos();

const conclusiones = useMemo(() => {
  if (!filtered.length) return [];

  const resultado = (r: Row) => normalizaResultado(r.resultadoFinal);
  const tasaPeligroDe = (grupo: Row[]) =>
    grupo.filter(LECTOR.peligro).length / grupo.length;

  const goles = filtered.filter(LECTOR.gol).length;
  const ocasiones = filtered.filter((r) => resultado(r) === "Ocasión").length;
  const xg = filtered.reduce((a, r) => a + r.xg, 0);

  const frases: (string | null)[] = [
    `${plural(filtered.length, "ABP", "ABP")} en contra: ${plural(ocasiones, "ocasión", "ocasiones")} y ${plural(goles, "gol encajado", "goles encajados")}, xG ${cifra(xg)}.`,
  ];

  const zona = mejorGrupo(
    filtered,
    (r) => (esSuperioridad(r.zonaCaida) ? "" : r.zonaCaida),
    tasaPeligroDe,
  );

  if (zona && zona.valor > 0) {
    frases.push(
      `Zona que más concede: ${zona.nombre}, ${Math.round(zona.valor * zona.n)} de ${zona.n} en gol u ocasión.`,
    );
  }

  const envio = mejorGrupo(
    filtered,
    (r) => r.tipoEnvio,
    (grupo) => grupo.reduce((a, r) => a + r.xg, 0) / grupo.length,
  );

  if (envio && envio.valor > 0) {
    frases.push(
      `Más daño con el envío ${envio.nombre.toLowerCase()}: xG ${cifra(envio.valor, 2)} por acción.`,
    );
  }

  const remates = filtered.filter(LECTOR.remate).length;

  frases.push(
    `El rival remata el ${Math.round((remates / filtered.length) * 100)} % de sus ABP.`,
  );

  const ganados = filtered.filter((r) => /gan/i.test(r.segundoBalon)).length;
  const perdidos = filtered.filter((r) => /perd/i.test(r.segundoBalon)).length;

  if (ganados + perdidos >= 3) {
    frases.push(
      perdidos >= ganados
        ? `Segundo balón: perdemos el ${Math.round((perdidos / (ganados + perdidos)) * 100)} % de los disputados.`
        : `Segundo balón: ganamos el ${Math.round((ganados / (ganados + perdidos)) * 100)} % de los disputados.`,
    );
  }

  const contras = filtered.filter((r) =>
    ["Transición Ofensiva", "Gol RMCF"].includes(resultado(r)),
  ).length;

  if (contras > 0) {
    frases.push(
      `Salimos a la contra tras ${plural(contras, "ABP rival", "ABP rivales")}.`,
    );
  }

  return frases.filter(Boolean).slice(0, 5);
}, [filtered]);

/*
| El pie de lectura de cada sección.
|
| Se llama como función y no se usa como componente: así el bloque se pinta con
| lo que ya hay calculado arriba —`filtered` contra `rows`— sin que ningún panel
| tenga que volver a filtrar por su cuenta.
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
    sentido="defensivo"
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

          <section className="px-4 sm:px-8 pb-8 sm:pb-12 pt-3 sm:pt-5">

  <AbpHeader
    area="RMCF Castilla · Colectivo"
    title="ABP Defensivo"
    lead={
      textosExplicativos
        ? "Córners y faltas en contra: cómo defiende el Castilla el balón parado y qué le acaban generando desde cada tipo de acción."
        : undefined
    }
  />

  {/* Selector + KPIs */}
  <div className="rounded-[24px] sm:rounded-[32px] border border-white/10 bg-gradient-to-b from-white/[0.05] to-white/[0.02] p-5 sm:p-8 shadow-[0_12px_40px_rgba(0,0,0,0.35)] backdrop-blur-sm">

    {/* Cuatro desplegables sin etiqueta ocupaban la cabecera: plegados y
        rotulados, el contenido empieza arriba. */}
    <FilterDrawer
      activeCount={chips.length}
      summary="7 filtros disponibles"
    >
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
          { value: "ALL", label: "Todas las jornadas" },
          ...jornadas.map((una) => ({
            value: una.clave,
            label: una.etiqueta,
          })),
        ]}
      />

      {/* Cómo iba el partido cuando nos lanzaron el ABP. */}
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

      <Select
        label="Rival"
        value={rival}
        onChange={setRival}
        options={[{ value: "ALL", label: "Todos los rivales" }, ...rivales]}
      />

      <Select
        label="Perfil de golpeo"
        value={perfil}
        onChange={setPerfil}
        options={[{ value: "ALL", label: "Todos los perfiles" }, ...perfiles]}
      />

      <Select
        label="Parte"
        value={tiempo}
        onChange={setTiempo}
        options={[
          { value: "ALL", label: "Las dos partes" },
          { value: "1", label: "Primera parte" },
          { value: "2", label: "Segunda parte" },
        ]}
      />
    </FilterDrawer>
<div className="mt-5">
  <p className="text-sm text-zinc-400 mb-3">
    Equipos visualizados (
    {equiposVisualizados.length}
    )
  </p>

  <div className="flex flex-wrap gap-2">
  {equiposVisualizados.map((equipo) => {
    const active = rival === equipo;

    return (
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
          cursor-pointer

          ${
            active
              ? `
                border-[#C8A96B]
                bg-[#C8A96B]
                text-black
                font-semibold
              `
              : `
                border-white/10
                bg-[#C8A96B]/10
                text-[#C8A96B]
                hover:bg-[#C8A96B]/20
              `
          }
        `}
      >
        {equipo}
      </button>
    );
  })}
</div>
</div>
    <div
  className="
    mt-5 sm:mt-6
    grid
    gap-3
    grid-cols-2
    sm:grid-cols-3
    xl:grid-cols-5
  "
>
  <Card
    title="ABP"
    value={metrics.total.toLocaleString()}
  hint="Acciones defendidas"
  />
  <Card
  title="% Remate"
  value={
    metrics.total
      ? `${(
          (metrics.shots /
            metrics.total) *
          100
        ).toFixed(1)}%`
      : "0%"
  }
  hint="ABP del rival que acaban en remate"
  />

<Card
  title="xG / Remate"
  value={
    metrics.shots
      ? (
          metrics.xg /
          metrics.shots
        ).toFixed(2)
      : "0"
  }
  hint="Calidad media del remate concedido"
  />

  <Card
    title="xG"
    value={metrics.xg.toFixed(2)}
  hint="Goles esperados concedidos"
  />

  <Card
    title="Remates"
    value={metrics.shots.toLocaleString()}
  hint="Concedidos a balón parado"
  />

  <Card
  title="Gol Rival"
  value={metrics.goalsAgainst.toLocaleString()}
  hint="Encajados desde su ABP"
  activo={resultadoFilter === "Gol Rival"}
  onClick={() => pulsa("resultado", "Gol Rival")}
  />

<Card
  title="Gol RMCF"
  value={metrics.goalsRMCF.toLocaleString()}
  hint="Marcados al contragolpe"
  activo={resultadoFilter === "Gol RMCF"}
  onClick={() => pulsa("resultado", "Gol RMCF")}
  />

<Card
  title="Gol u ocasión"
  value={`${tasaPeligro.toFixed(1)}%`}
  hint="ABP que nos generan peligro real"
  />
  <button
type="button"
title={PULSA}
disabled={!mayorPerfil && perfilGolpeoFilter === "ALL"}
onClick={() => {
  const elegido =
    perfilGolpeoFilter !== "ALL" ? perfilGolpeoFilter : mayorPerfil;
  if (elegido) pulsa("perfilGolpeo", elegido);
}}
className={`
  h-[96px]
  sm:h-[112px]
  rounded-[20px]
  sm:rounded-[24px]
  border
  bg-white/[0.03]
  p-3
  sm:p-5
  flex
  flex-col
  justify-between
  text-left
  transition
  hover:bg-white/[0.05]
  ${perfilGolpeoFilter !== "ALL" ? "border-[#C8A96B]" : "border-white/10"}
`}
>
  <p className="text-sm text-zinc-400">
Mayor xG concedido  </p>

  <h3 className="mt-4 text-lg md:text-xl font-semibold text-[#C8A96B]">
    {mayorPerfil || "-"}
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
                competicionFilter === SIN_PRETEMPORADA ||
                competicionFilter === "ALL" ? (
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
      mode="defensive"
      zonaFiltro={zonaAreaFilter === "ALL" ? null : zonaAreaFilter}
      onZonaFiltro={(zona) => setZonaAreaFilter(zona ?? "ALL")}
      rows={sin("zonaArea").map((r) => ({
        zonaCaida: r.zonaCaida,
        zonaRemate: r.zonaRemate,
        xg: r.xg,
        resultadoFinal: r.resultadoFinal,
        tipoRemate: r.tipoRemate,
        oc1P: num(r.oc1P),
        ocCentral: num(r.ocCentral),
        oc2P: num(r.oc2P),
        ocFrontal: num(r.ocFrontal),
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
    tiempo: r.tiempo,
    perfil: r.perfil,

    tipoAccion: r.tipoAccion,
    perfilGolpeo: r.perfilGolpeo,
    tipoEnvio: r.tipoEnvio,
    zonaCaida: r.zonaCaida,
    calidadEnvio: r.calidadEnvio,

    nAtacantes: r.nAtacantes,
    tipoCarrera: r.tipoCarrera,

    oc1P: r.oc1P,
    ocCentral: r.ocCentral,
    oc2P: r.oc2P,
    ocFrontal: r.ocFrontal,

    remate: r.remate,
    tipoRemate: r.tipoRemate,
    zonaRemate: r.zonaRemate,

    xG: r.xg,

    segundoBalon: r.segundoBalon,
    resultadoFinal: r.resultadoFinal,
  }))}
/>
  </div>
</Panel>
</div>

<div className="md:col-span-2">
<Panel title="Flujo defensivo">
  <div id="grafico-abp-objective-flow">
   <ABPObjectiveFlow
  mode="defensive"
  seleccion={{
    accion: tipoAccionFilter === "ALL" ? undefined : tipoAccionFilter,
    medio: tipoEnvioFilter === "ALL" ? undefined : tipoEnvioFilter,
    zona:
      zonaCaidaFilter === "ALL"
        ? undefined
        : esSuperioridad(zonaCaidaFilter)
          ? SUPERIORIDAD
          : zonaCaidaFilter,
    resultado: resultadoFilter === "ALL" ? undefined : resultadoFilter,
  }}
  onSeleccion={(col: ABPFlowCol, valor) =>
    ({
      accion: setTipoAccionFilter,
      medio: setTipoEnvioFilter,
      zona: setZonaCaidaFilter,
      resultado: setResultadoFilter,
    })[col](valor ?? "ALL")
  }
  rows={sin("tipoAccion", "tipoEnvio", "zonaCaida", "resultado").map((r) => ({
    jornada: r.contexto.jornada.corto,
    rival: r.rival,
    tiempo: r.tiempo,
    tipoAccion: r.tipoAccion,
    tipoEnvio: r.tipoEnvio,
    calidadEnvio: r.calidadEnvio,
    zonaCaida: r.zonaCaida,
    zonaRemate: r.zonaRemate,
    xG: Number(r.xg ?? 0),
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
  </Chart></div>
</Panel>
<Panel title="Zona caída">
  <div id="grafico-zona-caida">
  <Chart>
    <PieChart>
      <Pie
        data={zonaCaida}
        onClick={(_, i) =>
          zonaCaida[i] && pulsa("zonaCaida", zonaCaida[i].name)
        }
        dataKey="total"
        nameKey="name"
innerRadius={isMobile ? 65 : 95}
outerRadius={isMobile ? 90 : 120}
        paddingAngle={4}
        cornerRadius={8}
        stroke="transparent"
      >
        {zonaCaida.map(
          (d, i) => (
            <Cell
              key={i}
              fill={
                PIE_COLORS[
                  i %
                    PIE_COLORS.length
                ]
              }
              {...pinta("zonaCaida", d.name)}
            />
          )
        )}<Label
  value={zonaCaida.reduce((suma, d) => suma + d.total, 0)}
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
        onClick={(e) => pulsa("zonaCaida", String(e.value))}
      />
    </PieChart>
  </Chart></div>
</Panel>
<Panel title="Impacto sacador" analisis={pie({ metrica: "xg", dimension: "perfil de golpeo", categoria: (r) => r.perfilGolpeo })}>
  <div id="grafico-impacto-sacador">
  <Chart>
    <BarChart
      data={sacadorData}
      layout="vertical"
      onClick={pulsaIndice(sacadorData, (d) => pulsa("perfilGolpeo", d.name))}
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

        tick={{
          fill: "#94A3B8",
        }}
        axisLine={false}
        tickLine={false}
      />

      <YAxis
        type="category"
        dataKey="name"
       width={
  isNarrow
    ? 180
    : 240
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
          <Cell key={d.name} fill={COLORS.blue} {...pinta("perfilGolpeo", d.name)} />
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
<Panel title="Impacto rematadores" analisis={pie({ dimension: "tipo de remate", categoria: (r) => r.tipoRemate })}><div id="grafico-impacto-rematadores">
  <Chart>
    <BarChart
      data={rematadoresData}
      layout="vertical"
      onClick={pulsaIndice(rematadoresData, (d) => pulsa("tipoRemate", d.name))}
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
    ? 180
    : 240
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
          <Cell key={d.name} fill={COLORS.gold} {...pinta("tipoRemate", d.name)} />
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
<Panel title="xG por tipo envío" analisis={pie({ metrica: "xg", dimension: "tipo de envío", categoria: (r) => r.tipoEnvio })}><div id="grafico-tipo-envio">
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
    ? 180
    : 240
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
<Panel title="Zona remate" analisis={pie({ metrica: "xg", dimension: "zona de remate", categoria: (r) => r.zonaRemate })}><div id="grafico-zona-remate">
  <Chart>
    <PieChart>
      <Pie
        data={zonaRemateData}
        onClick={(_, i) =>
          zonaRemateData[i] && pulsa("zonaRemate", zonaRemateData[i].name)
        }
        dataKey="total"
        nameKey="name"
        innerRadius={isMobile ? 65 : 95}
        outerRadius={isMobile ? 90 : 120}
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
 value={zonaRemateData.reduce(
  (acc, item) => acc + item.total,
  0
)}
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
<Panel title="Segundo balón" analisis={pie({ dimension: "segundo balón", categoria: (r) => r.segundoBalon })}><div id="grafico-segundo-balon">
  <Chart>
    <PieChart>
      <Pie
        data={segundoBalonData}
        onClick={(_, i) =>
          segundoBalonData[i] && pulsa("segundoBalon", segundoBalonData[i].name)
        }
        dataKey="total"
        nameKey="name"
        innerRadius={isMobile ? 65 : 95}
        outerRadius={isMobile ? 90 : 120}
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
        )}
        <Label
  value={segundoBalonData.reduce(
  (acc, item) => acc + item.total,
  0
)}
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

<Panel title="Tipo carrera" analisis={pie({ dimension: "tipo de carrera", categoria: (r) => r.tipoCarrera })}><div id="grafico-tipo-carrera">
  <Chart>
    <PieChart>
      <Pie
        data={tipoCarrera}
        onClick={(_, i) =>
          tipoCarrera[i] && pulsa("tipoCarrera", tipoCarrera[i].name)
        }
        dataKey="total"
        nameKey="name"
        innerRadius={isMobile ? 65 : 95}
        outerRadius={isMobile ? 90 : 120}
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
        )} 
        <Label
  value={tipoCarrera.reduce((suma, d) => suma + d.total, 0)}
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
<Panel title="Momento del partido" analisis={pie({ metrica: "volumen", dimension: "tramo", categoria: (r) => TRAMOS.find((uno) => uno.key === r.contexto.minuto.tramo)?.label ?? "" })}><div id="grafico-distribucion-periodo">
  <Explicativo>

  <p className="-mt-3 mb-4 text-xs text-zinc-500">
    Lo que nos lanzan por tramos de 15&apos;, con los remates que sacan.
    {sinMinuto > 0 &&
      ` ${sinMinuto} acciones quedan fuera por no tener minuto registrado.`}
  </p>

  </Explicativo>

  <Chart>
    <BarChart
      data={timeline}
      onClick={pulsaIndice(timeline, (d) => pulsa("tramo", d.key))}
      style={{ cursor: "pointer" }}
    >
  <CartesianGrid
    stroke="#1E232A"
    vertical={false}
  />

  {/* `interval={0}`: en el móvil se perdía una etiqueta de cada dos. */}
  <XAxis
    dataKey="tramo"
    interval={0}
    tick={{ fontSize: 11 }}
    axisLine={false}
    tickLine={false}
  />

  <YAxis
    axisLine={false}
    tickLine={false}
  />

  <Tooltip />

  <Bar
    name="Acciones"
    dataKey="total"
    fill={COLORS.green}
    radius={[8, 8, 0, 0]}
  >
    {timeline.map((d) => (
      <Cell key={d.key} fill={COLORS.green} {...pinta("tramo", d.key)} />
    ))}
    <LabelList
      dataKey="total"
      position="top"
    />
  </Bar>

  {/* Los remates del rival: un tramo con muchos córners y ninguno es otra
      cosa que un tramo con tres y dos cabezazos al palo. */}
  <Bar
    name="Remates del rival"
    dataKey="remates"
    fill={COLORS.gold}
    radius={[8, 8, 0, 0]}
  >
    {timeline.map((d) => (
      <Cell key={d.key} fill={COLORS.gold} {...pinta("tramo", d.key)} />
    ))}
  </Bar>
</BarChart>
      
  </Chart></div>
</Panel>

{/*
  Qué nos lanzan según cómo va el marcador.

  Sale de «Resultado RMC» y «Resultado RIVAL», que la hoja anota en cada
  acción. Es la lectura que dice si el equipo se desordena a balón parado
  cuando se pone por delante, que es donde se pierden los partidos.
*/}
<Panel title="Según el marcador" analisis={pie({ dimension: "marcador", categoria: (r) => ESTADOS.find((uno) => uno.key === r.contexto.marcador.estado)?.label ?? "" })}><div id="grafico-abp-marcador">
  <Explicativo>

  <p className="-mt-3 mb-4 text-xs text-zinc-500">
    Acciones y remates del rival según cómo iba el partido.
    {sinMarcador > 0 &&
      ` ${sinMarcador} acciones quedan fuera por no tener marcador anotado.`}
  </p>

  </Explicativo>

  <Chart>
    <BarChart
      data={porMarcador}
      onClick={pulsaIndice(porMarcador, (d) => pulsa("estado", d.key))}
      style={{ cursor: "pointer" }}
    >
      <CartesianGrid stroke="#1E232A" vertical={false} />

      <XAxis
        dataKey="estado"
        interval={0}
        tick={{ fontSize: 11 }}
        axisLine={false}
        tickLine={false}
      />

      <YAxis axisLine={false} tickLine={false} />

      <Tooltip />

      <Bar dataKey="total" radius={[8, 8, 0, 0]} maxBarSize={54}>
        {porMarcador.map((fila) => (
          <Cell
            key={fila.key}
            fill={ESTADO_COLOR[fila.key]}
            {...pinta("estado", fila.key)}
          />
        ))}

        <LabelList dataKey="total" position="top" />
      </Bar>
    </BarChart>
  </Chart>
</div>

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
          {fila.goles} encajado{fila.goles === 1 ? "" : "s"}
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
<Panel title="xG por tipo de acción" analisis={pie({ metrica: "xg", dimension: "tipo de acción", categoria: (r) => r.tipoAccion })}><div id="grafico-xg-tipo-accion">
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
    ? 180
    : 240
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

<Panel title="Top rivales por xG concedido" analisis={pie({ metrica: "xg", dimension: "rival", categoria: (r) => r.rival })}><div id="grafico-rivales-xg-concedido">
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
<Panel title="xG por zona caida" analisis={pie({ metrica: "xg", dimension: "zona de caída", categoria: (r) => r.zonaCaida })}><div id="grafico-xg-zona-caida">
  <Chart>
    <BarChart
  data={xgZonaCaida}
  layout="vertical"
  onClick={pulsaIndice(xgZonaCaida, (d) => pulsa("zonaCaida", d.name))}
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
      ? 180
      : 240
  }
  interval={0}
  axisLine={false}
  tickLine={false}
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
    ocasión del rival ({tasaPeligroResultado.toFixed(1)}%). Pulsa un sector para
    filtrar.
  </p>

  </Explicativo>

  <div id="grafico-conversion">
  <Chart>
    <PieChart>
      <Pie
        data={resultadoData}
        onClick={(_, i) =>
          resultadoData[i] && pulsa("resultado", resultadoData[i].name)
        }
        dataKey="total"
        nameKey="name"
innerRadius={isMobile ? 65 : 95}
outerRadius={isMobile ? 90 : 120}
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

<Panel title="Calidad del envío rival" analisis={pie({ metrica: "xg", dimension: "calidad de envío", categoria: (r) => (r.calidadEnvio ? "Calidad " + r.calidadEnvio : "") })}>
  <Explicativo>

  <p className="-mt-3 mb-4 text-xs text-zinc-500">
    Escala 1-4 valorada por el cuerpo técnico: volumen de envíos del
    rival y porcentaje que termina en remate.
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
        stroke="#B45454"
        strokeWidth={2.5}
        dot={{ r: 4 }}
      />
    </ComposedChart>
  </Chart></div>
</Panel>

<Panel title="Superioridad en corto" analisis={pie({ dimension: "superioridad", categoria: (r) => (esSuperioridad(r.zonaCaida) ? r.zonaCaida : "") })}>
  <Explicativo>

  <p className="-mt-3 mb-4 text-xs text-zinc-500">
    Ventajas numéricas que el rival crea antes del envío al área. Estos
    valores no son zonas de caída, por eso se analizan aparte.
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
        fill="#5E7FB8"
        radius={[8, 8, 0, 0]}
      >
        {superioridadData.map((d) => (
          <Cell key={d.name} fill="#5E7FB8" {...pinta("zonaCaida", d.name)} />
        ))}
        <LabelList dataKey="total" position="top" />
      </Bar>

      <Bar
        dataKey="goles"
        name="Goles encajados"
        fill="#B45454"
        radius={[8, 8, 0, 0]}
      >
        {superioridadData.map((d) => (
          <Cell key={d.name} fill="#B45454" {...pinta("zonaCaida", d.name)} />
        ))}
      </Bar>
    </BarChart>
  </Chart></div>
</Panel>

<Panel title="Estructura de la jugada" analisis={pie({ dimension: "atacantes en el área", categoria: (r) => (r.nAtacantes ? r.nAtacantes + " atacantes" : "") })}>
  <Explicativo>

  <p className="-mt-3 mb-4 text-xs text-zinc-500">
    Número de atacantes rivales implicados frente al xG medio concedido y
    a la ocupación media que desplegamos en el área.
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
        name="xG medio concedido"
        stroke="#D08A7E"
        strokeWidth={2.5}
        dot={{ r: 4 }}
      />

      {/* La ocupación va al eje izquierdo: comparte magnitud con el
          volumen de acciones y no aplasta la línea de xG. */}
      <Line
        yAxisId="left"
        type="monotone"
        dataKey="ocupacionMedia"
        name="Ocupación propia (media)"
        stroke={COLORS.gold}
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
        h-[340px]
        sm:h-[360px]
        md:h-[320px]
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
 * `hint` explica qué mide el número: en defensa la diferencia entre «% Remate»
 * y «Gol u ocasión» no es evidente, y sin la definición cada uno la interpreta
 * a su manera. La altura ya no es fija porque la nota ocupa una o dos líneas.
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
  /** Las tarjetas que son un resultado concreto («Gol Rival») filtran por él. */
  onClick?: () => void;
  activo?: boolean;
}) {
  const Caja = onClick ? "button" : "div";

  return (
    <Caja
      {...(onClick ? { type: "button" as const, onClick, title: PULSA } : {})}
      className={`
        min-h-[96px]
        sm:min-h-[112px]
        rounded-[20px]
        sm:rounded-[24px]
        border
        bg-white/[0.03]
        p-3
        sm:p-4
        flex
        flex-col
        text-left
        ${activo ? "border-[#C8A96B]" : "border-white/10"}
        ${onClick ? "cursor-pointer transition hover:bg-white/[0.05]" : ""}
      `}
    >
      <p className="text-[11px] sm:text-xs text-zinc-400 leading-tight">
        {title}
      </p>

      <h3
        className="
          mt-auto
          pt-2
          text-lg
          sm:text-xl
          xl:text-2xl
          font-semibold
          leading-none
          text-white
        "
      >
        {value}
      </h3>

      {hint && (
        <p className="mt-1.5 text-[10px] leading-snug text-white/35">{hint}</p>
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
