"use client";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import { Sidebar } from "@/components/ui/sidebar";
import { Topbar } from "@/components/ui/topbar";
import type { LegendProps } from "recharts";
import { FileDown } from "lucide-react";
import * as htmlToImage from "html-to-image";
import ABPFlowField from '@/components/abp/ABPFlowField';
import { AbpHeader, FilterDrawer, Select } from '@/components/abp/ui';
import {
  AnalisisSeccion,
  type LectorAnalisis,
} from "@/components/abp/AnalisisSeccion";
import type { ClaveMetrica } from "@/lib/abp/analisis";
import ABPObjectiveFlow from "@/components/abp/ABPObjectiveFlow";
import ABPZoneMap from "@/components/abp/ABPZoneMap";
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
const [competicionFilter, setCompeticionFilter] = useState("ALL");
const [estadoFilter, setEstadoFilter] = useState("ALL");
const [tramoFilter, setTramoFilter] = useState("ALL");
const [rutinaFilter, setRutinaFilter] = useState("ALL");
  useEffect(() => {
    fetch(CSV_URL)
      .then((r) => r.text())
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

const filtered = rows.filter((r) => {
  const jornadaOk =
    jornada === "ALL" ||
    r.contexto.jornada.clave === jornada;

  const competicionOk =
    competicionFilter === "ALL" ||
    r.contexto.jornada.competicion === competicionFilter;

  /* Una acción sin marcador anotado no responde a «¿qué pasa yendo por
     delante?», así que no entra en esa muestra. */
  const estadoOk =
    estadoFilter === "ALL" ||
    r.contexto.marcador.estado === estadoFilter;

  const tramoOk =
    tramoFilter === "ALL" || r.contexto.minuto.tramo === tramoFilter;

  const rutinaOk = rutinaFilter === "ALL" || r.rutina === rutinaFilter;

  const rivalOk =
    rival === "ALL" ||
    r.rival === rival;

  const sacadorOk =
    sacador === "ALL" ||
    r.sacador === sacador;

  const accionOk =
    tipoAccionFilter === "ALL" ||
    r.tipoAccion ===
      tipoAccionFilter;

const zonaCaidaOk =
  zonaCaidaFilter === "ALL" ||
  r.zonaCaida === zonaCaidaFilter;

const zonaRemateOk =
  zonaRemateFilter === "ALL" ||
  r.zonaRemate === zonaRemateFilter;

const segundoBalonOk =
  segundoBalonFilter === "ALL" ||
  r.segundoBalon === segundoBalonFilter;

const tipoCarreraOk =
  tipoCarreraFilter === "ALL" ||
  r.tipoCarrera === tipoCarreraFilter;
  const defensaOk =
  defensaFilter === "ALL" ||
  r.defensaRival === defensaFilter;

const tipoEnvioOk =
  tipoEnvioFilter === "ALL" ||
  r.tipoEnvio === tipoEnvioFilter;

const rematadorOk =
  rematadorFilter === "ALL" ||
  r.rematador === rematadorFilter;

const resultadoOk =
  resultadoFilter === "ALL" ||
  normalizaResultado(r.resultadoFinal) ===
    resultadoFilter;

  return (
    jornadaOk &&
    competicionOk &&
    estadoOk &&
    tramoOk &&
    rutinaOk &&
    rivalOk &&
    sacadorOk &&
    accionOk &&
    zonaCaidaOk &&
    zonaRemateOk &&
    segundoBalonOk &&
    tipoCarreraOk &&
    defensaOk &&
    tipoEnvioOk &&
    rematadorOk &&
    resultadoOk
  );
});

  const shots = filtered.filter(
  (r) =>
    r.tipoRemate &&
    ![
      "",
      "No Remate",
      "No aplica",
    ].includes(r.tipoRemate)
).length;

const goals = filtered.filter(
  (r) =>
    r.resultadoFinal
      .toLowerCase()
      .includes("gol")
).length;

const totalXg = filtered.reduce(
  (a, b) => a + b.xg,
  0
);
const activeFilters = [
  {
    label: "Jornada",
    value:
      jornada === "ALL"
        ? "ALL"
        : (jornadas.find((una) => una.clave === jornada)?.etiqueta ?? jornada),
    clear: () => setJornada("ALL"),
  },
  {
    label: "Competición",
    value:
      competicionFilter === "ALL"
        ? "ALL"
        : COMPETICION_LABEL[
            competicionFilter as keyof typeof COMPETICION_LABEL
          ],
    clear: () => setCompeticionFilter("ALL"),
  },
  {
    label: "Marcador",
    value:
      estadoFilter === "ALL"
        ? "ALL"
        : (ESTADOS.find((uno) => uno.key === estadoFilter)?.label ?? estadoFilter),
    clear: () => setEstadoFilter("ALL"),
  },
  {
    label: "Tramo",
    value:
      tramoFilter === "ALL"
        ? "ALL"
        : (TRAMOS.find((uno) => uno.key === tramoFilter)?.label ?? tramoFilter),
    clear: () => setTramoFilter("ALL"),
  },
  {
    label: "Rutina",
    value: rutinaFilter,
    clear: () => setRutinaFilter("ALL"),
  },
  {
    label: "Rival",
    value: rival,
    clear: () => setRival("ALL"),
  },
  {
    label: "Sacador",
    value: sacador,
    clear: () => setSacador("ALL"),
  },
  {
    label: "Tipo acción",
    value: tipoAccionFilter,
    clear: () => setTipoAccionFilter("ALL"),
  },
  {
    label: "Zona caída",
    value: zonaCaidaFilter,
    clear: () => setZonaCaidaFilter("ALL"),
  },
  {
    label: "Zona remate",
    value: zonaRemateFilter,
    clear: () => setZonaRemateFilter("ALL"),
  },
  {
    label: "Segundo balón",
    value: segundoBalonFilter,
    clear: () => setSegundoBalonFilter("ALL"),
  },
  {
    label: "Tipo carrera",
    value: tipoCarreraFilter,
    clear: () => setTipoCarreraFilter("ALL"),
  },
  {
    label: "Defensa",
    value: defensaFilter,
    clear: () => setDefensaFilter("ALL"),
  },
  {
    label: "Tipo envío",
    value: tipoEnvioFilter,
    clear: () => setTipoEnvioFilter("ALL"),
  },
  {
    label: "Rematador",
    value: rematadorFilter,
    clear: () => setRematadorFilter("ALL"),
  },
  {
    label: "Resultado",
    value: resultadoFilter,
    clear: () => setResultadoFilter("ALL"),
  },
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
    countBy(filtered, "tipoAccion");

  const zonaCaida =
    countBy(filtered, "zonaCaida");

  const tipoCarrera =
    countBy(filtered, "tipoCarrera");

  const defensa =
    countBy(filtered, "defensaRival");

  const sacadorData =
    useMemo(() => {
      const grouped:
        Record<
          string,
          { xg: number }
        > = {};

      filtered.forEach((r) => {
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
    }, [filtered]);

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

    filtered.forEach((r) => {
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
  }, [filtered]);
  const rematadoresData =
  useMemo(() => {
    const grouped: Record<
      string,
      number
    > = {};

    filtered
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
  }, [filtered]);

const zonaRemateData =
  countBy(
    filtered.filter(
      (r) => r.zonaRemate
    ),
    "zonaRemate"
  );
  
const totalZonaRemate =
  zonaRemateData.reduce(
    (acc, item) => acc + item.total,
    0
  );
const segundoBalonData =
  countBy(
    filtered.filter(
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

    filtered.forEach((r) => {
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
  }, [filtered]); 
  
const rivalesData =
  useMemo(() => {
    const grouped: Record<
      string,
      number
    > = {};

    filtered.forEach((r) => {
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
  }, [filtered]);

const xgZonaCaida =
  useMemo(() => {
    const grouped: Record<
      string,
      number
    > = {};

    filtered.forEach((r) => {
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
  }, [filtered]);

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

  filtered.forEach((r) => {
    const k = normalizaResultado(r.resultadoFinal);
    grouped[k] = (grouped[k] || 0) + 1;
  });

  return orden
    .filter((name) => grouped[name] > 0)
    .map((name) => ({
      name,
      total: grouped[name],
    }));
}, [filtered]);

// Acciones que terminan produciendo peligro (gol u ocasión)
const accionesPeligrosas = filtered.filter((r) => {
  const res = normalizaResultado(r.resultadoFinal);
  return res === "Gol" || res === "Ocasión";
}).length;

const tasaPeligro =
  filtered.length > 0
    ? (accionesPeligrosas / filtered.length) * 100
    : 0;

// Calidad del envío (1-4) frente al peligro que genera
const calidadEnvioData = useMemo(() => {
  const grouped: Record<
    number,
    { total: number; xg: number; remates: number }
  > = {};

  filtered.forEach((r) => {
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
}, [filtered]);

// Superioridades generadas en el juego en corto (3v2, 2v1...)
const superioridadData = useMemo(() => {
  const grouped: Record<
    string,
    { total: number; xg: number; goles: number }
  > = {};

  filtered
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
}, [filtered]);

// Estructura de la jugada: atacantes y bloqueadores frente al xG generado
const estructuraData = useMemo(() => {
  const grouped: Record<
    number,
    { total: number; xg: number; bloqueadores: number }
  > = {};

  filtered.forEach((r) => {
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
}, [filtered]);
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
  const conMinuto = filtered.filter(
    (r) => r.contexto.minuto.tramo !== null
  );

  const sinMinuto =
    filtered.length - conMinuto.length;

  const esGol = (r: Row) =>
    r.resultadoFinal.toLowerCase().includes("gol");

  const esRemate = (r: Row) =>
    Boolean(r.tipoRemate) &&
    !["", "No Remate", "No aplica"].includes(r.tipoRemate);

  const timeline = TRAMOS.map((tramo) => {
    const dentro = conMinuto.filter(
      (r) => r.contexto.minuto.tramo === tramo.key
    );

    return {
      tramo: tramo.label,
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

    filtered.forEach((r) => {
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
          goles: dentro.filter((r) =>
            r.resultadoFinal.toLowerCase().includes("gol")
          ).length,
          xg: Number(dentro.reduce((suma, r) => suma + r.xg, 0).toFixed(2)),
          rematePct: dentro.length ? (remates / dentro.length) * 100 : 0,
        };
      })
      .sort((a, b) => b.xg - a.xg || b.total - a.total);
  }, [filtered]);

  const sinRutina = filtered.filter((r) => !r.rutina).length;

  /*
  | Y lo mismo según cómo iba el partido.
  |
  | Es la lectura que abre el marcador: un equipo saca más córners cuando va
  | perdiendo, pero lo que interesa es si además le rinden. Las acciones sin
  | marcador anotado quedan fuera y se cuentan aparte, igual que arriba.
  */
  const conMarcador = filtered.filter(
    (r) => r.contexto.marcador.estado !== null
  );

  const sinMarcador = filtered.length - conMarcador.length;

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
    sacadorData[0]?.name || "-",
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
  `• Mejor sacador: ${sacadorData[0]?.name || "-"}`,
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
   #grafico-zona-saque, \
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
      id: "grafico-zona-saque",
      title: "Zona saque",
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
    categoria?: (fila: Row) => string;
    destacado?: boolean;
  } = {},
) => (
  <AnalisisSeccion
    filas={filtered}
    todas={rows}
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
    lead="Córners y faltas a favor: qué se lanza, dónde cae el balón, quién remata y cuánto peligro acaba generando cada rutina."
  />

  {/* Selector + KPIs */}
  <div className="mt-6 rounded-[24px] sm:rounded-[32px] border border-white/10 bg-gradient-to-b from-white/[0.05] to-white/[0.02] p-5 sm:p-8 shadow-[0_12px_40px_rgba(0,0,0,0.35)] backdrop-blur-sm">

    {/* Los cinco desplegables iban sueltos y sin etiqueta: sólo se sabía qué
        filtraba cada uno abriéndolo. Ahora van plegados y rotulados. */}
    <FilterDrawer
      activeCount={
        [
          jornada,
          competicionFilter,
          estadoFilter,
          tramoFilter,
          rutinaFilter,
          rival,
          sacador,
          tipoAccionFilter,
        ].filter((value) => value !== "ALL").length
      }
      summary="8 filtros disponibles"
    >
      {/*
        La competición va la primera porque es la que cambia de qué se está
        hablando: un córner de un amistoso de julio contra un juvenil y uno de
        la jornada 1 no son la misma muestra, y hasta ahora se sumaban.
      */}
      {competiciones.length > 1 && (
        <Select
          label="Competición"
          value={competicionFilter}
          onChange={setCompeticionFilter}
          options={[
            { value: "ALL", label: "Liga y pretemporada" },
            ...COMPETICIONES.filter((una) =>
              competiciones.includes(una.key),
            ).map((una) => ({ value: una.key, label: una.label })),
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
    {[...new Set(filtered.map((r) => r.rival))]
      .length}
    )
  </p>

  <div className="flex flex-wrap gap-2">
    {[...new Set(filtered.map((r) => r.rival))]
      .sort()
      .map((equipo) => (
        <button
  key={equipo}
  onClick={() =>
    setRival(
      rival === equipo
        ? "ALL"
        : equipo
    )
  }
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
<div className="flex flex-wrap gap-2 mb-4">
  {activeFilters
    .filter(f => f.value !== "ALL")
    .map(f => (
      <button
        key={f.label}
        onClick={f.clear}
        className="px-3 py-1 rounded-full bg-blue-500 text-white text-xs"
      >
        {f.label}: {f.value} ✕
      </button>
    ))}
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
      />
      <Card
  title="Conversión"
  value={`${metrics.conversion.toFixed(
    1
  )}%`}
  hint="Goles sobre el total de ABP"
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

<div className="rounded-2xl md:rounded-3xl border border-white/10 bg-white/[0.03] p-4 md:p-6">
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
    {sacadorData[0]?.name || "-"}
  </h3>
</div>
    </div>

  </div>

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
      rows={filtered.map((r) => ({
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
  rows={filtered.map((r) => ({
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
  rows={filtered.map((r) => ({
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


              <Panel title="Tipo de acción" analisis={pie({ dimension: "tipo de acción", categoria: (r) => r.tipoAccion })}>
                <div id="grafico-tipo-accion">
  <Chart>
    <BarChart
      data={tipoAccion}
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
        onClick={(data:any)=>
  setTipoAccionFilter(
    tipoAccionFilter === data.name
      ? "ALL"
      : data.name
  )
}
        radius={[8, 8, 0, 0]}
      >
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
<Panel title="Zona de saque" analisis={pie({ dimension: "zona de caída", categoria: (r) => r.zonaCaida })}>
  <div id="grafico-zona-saque">

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
    onClick={(data: any) =>
      setZonaCaidaFilter(
        zonaCaidaFilter === data.name
          ? "ALL"
          : data.name
      )
    }
  ><Label
  value={filtered.length}
  position="center"
  fill="#fff"
  fontSize={isMobile ? 22 : 30}
/>

    {zonaCaida.map((_, i) => (
      <Cell
        key={i}
        fill={
          PIE_COLORS[
            i % PIE_COLORS.length
          ]
        }
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
  wrapperStyle={{
    fontSize: 10,
    lineHeight: "14px",
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
        onClick={(data:any)=>
  setSacador(
    sacador === data.name
      ? "ALL"
      : data.name
  )
}
        radius={[0, 8, 8, 0]}
      >
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
        onClick={(data:any) =>
    setRematadorFilter(
      rematadorFilter === data.name
        ? "ALL"
        : data.name
    )
  }
        radius={[0, 8, 8, 0]}
      >
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
         onClick={(data:any) =>
    setTipoEnvioFilter(
      tipoEnvioFilter === data.name
        ? "ALL"
        : data.name
    )
  }
        radius={[0, 8, 8, 0]}
      >
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
    onClick={(data:any) =>
    setZonaRemateFilter(
      zonaRemateFilter === data.name
        ? "ALL"
        : data.name
    )
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
          (_, i) => (
            <Cell
              key={i}
              fill={
                PIE_COLORS[
                  i %
                    PIE_COLORS.length
                ]
              }
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

<Legend {...pieLegendProps} />
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
      onClick={(data:any) =>
    setSegundoBalonFilter(
      segundoBalonFilter === data.name
        ? "ALL"
        : data.name
    )
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
          (_, i) => (
            <Cell
              key={i}
              fill={
                PIE_COLORS[
                  i %
                    PIE_COLORS.length
                ]
              }
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

<Legend {...pieLegendProps} />
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
  onClick={(data:any) =>
    setTipoCarreraFilter(
      tipoCarreraFilter === data.name
        ? "ALL"
        : data.name
    )
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
          (_, i) => (
            <Cell
              key={i}
              fill={
                PIE_COLORS[
                  i %
                    PIE_COLORS.length
                ]
              }
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

 <Legend {...pieLegendProps} />
    </PieChart>
  </Chart></div>
</Panel>
<Panel title="Defensa rival" analisis={pie({ dimension: "defensa del rival", categoria: (r) => r.defensaRival })}>
  <div id="grafico-defensa-rival">

  <Chart>
    <BarChart
      data={defensa}
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
         onClick={(data:any) =>
    setDefensaFilter(
      defensaFilter === data.name
        ? "ALL"
        : data.name
    )
  }
        radius={[8, 8, 0, 0]}
      >
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
  <p className="-mt-3 mb-4 text-xs text-zinc-500">
    Acciones y remates por tramos de 15&apos;.
    {sinMinuto > 0 &&
      ` ${sinMinuto} acciones quedan fuera por no tener minuto registrado.`}
  </p>

  <div id="grafico-timeline">

  <Chart>
    <ComposedChart
      data={timeline}
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
      />

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
  <p className="-mt-3 mb-4 text-xs text-zinc-500">
    Lo que produce cada jugada ensayada, de más a menos xG.
    {sinRutina > 0 &&
      ` ${sinRutina} acciones no llevan rutina anotada.`}
  </p>

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
            className="rounded-xl border border-white/10 bg-white/[0.02] p-3"
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
            <tr key={fila.nombre}>
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
  <p className="-mt-3 mb-4 text-xs text-zinc-500">
    Acciones, remates y goles según cómo iba el partido.
    {sinMarcador > 0 &&
      ` ${sinMarcador} acciones quedan fuera por no tener marcador anotado.`}
  </p>

  <div id="grafico-abp-marcador">

  <Chart>
    <ComposedChart
      data={porMarcador}
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
          <Cell key={fila.key} fill={ESTADO_COLOR[fila.key]} />
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
      <div
        key={fila.key}
        className="rounded-xl border border-white/10 bg-white/[0.02] p-3 text-center"
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
      </div>
    ))}
  </div>
</Panel>
<Panel title="xG por tipo de acción" analisis={pie({ metrica: "xg", dimension: "tipo de acción", categoria: (r) => r.tipoAccion })}>
  <div id="grafico-xg-tipo-accion">

  <Chart>
    <BarChart
      data={xgByTipoAccion}
      layout="vertical"
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
        onClick={(data:any)=>
  setRival(
    rival === data.name
      ? "ALL"
      : data.name
  )
}
        radius={[8, 8, 0, 0]}
      >
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
        onClick={(data:any)=>
  setZonaCaidaFilter(
    zonaCaidaFilter === data.name
      ? "ALL"
      : data.name
  )
}
        radius={[0, 8, 8, 0]}
      >
        <LabelList
          dataKey="total"
          position="right"
        />
      </Bar>
    </BarChart>
  </Chart></div>
</Panel>
<Panel title="Resultado final" analisis={pie({ dimension: "resultado", categoria: (r) => normalizaResultado(r.resultadoFinal) })}>
  <p className="-mt-3 mb-4 text-xs text-zinc-500">
    {accionesPeligrosas} de {metrics.total} acciones acaban en gol u
    ocasión ({tasaPeligro.toFixed(1)}%). Pulsa un sector para filtrar.
  </p>

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
       onClick={(data:any) =>
    setResultadoFilter(
      resultadoFilter === data.name
        ? "ALL"
        : data.name
    )
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
            cursor="pointer"
          />
        ))}
   <Label
value={`${tasaPeligro.toFixed(0)}%`}
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

      <Legend {...pieLegendProps} />
    </PieChart>
  </Chart></div>
</Panel>

<Panel title="Calidad del envío" analisis={pie({ metrica: "xg", dimension: "calidad de envío", categoria: (r) => (r.calidadEnvio ? "Calidad " + r.calidadEnvio : "") })}>
  <p className="-mt-3 mb-4 text-xs text-zinc-500">
    Escala 1-4 valorada por el cuerpo técnico: volumen de envíos y
    porcentaje que termina en remate.
  </p>

  <div id="grafico-calidad-envio">
  <Chart>
    <ComposedChart
      data={calidadEnvioData}
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
  <p className="-mt-3 mb-4 text-xs text-zinc-500">
    Ventajas numéricas creadas antes del envío al área. Estos valores no
    son zonas de caída, por eso se analizan aparte.
  </p>

  <div id="grafico-superioridad">
  <Chart>
    <BarChart
      data={superioridadData}
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
        onClick={(data: any) =>
          setZonaCaidaFilter(
            zonaCaidaFilter === data.name
              ? "ALL"
              : data.name
          )
        }
        cursor="pointer"
      >
        <LabelList dataKey="total" position="top" />
      </Bar>

      <Bar
        dataKey="goles"
        name="Goles"
        fill={COLORS.green}
        radius={[8, 8, 0, 0]}
      />
    </BarChart>
  </Chart></div>
</Panel>

<Panel title="Estructura de la jugada" analisis={pie({ dimension: "atacantes en el área", categoria: (r) => (r.nAtacantes ? r.nAtacantes + " atacantes" : "") })}>
  <p className="-mt-3 mb-4 text-xs text-zinc-500">
    Número de atacantes implicados frente al xG medio generado y a los
    bloqueadores utilizados.
  </p>

  <div id="grafico-estructura">
  <Chart>
    <ComposedChart
      data={estructuraData}
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
}: any) {
  return (
    <div
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
}: {
  title: string;
  value: React.ReactNode;
  hint?: string;
}) {
  return (
    <div className="rounded-2xl md:rounded-3xl border border-white/10 bg-white/[0.03] p-4 md:p-6">
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
    </div>
  );
}

function Panel({
  title,
  children,
}: any) {
  return (
    <div className="rounded-2xl md:rounded-3xl border border-white/10 bg-white/[0.03] p-5 md:p-8 shadow-xl overflow-hidden">
      <h2 className="mb-5 md:mb-6 text-lg md:text-2xl font-semibold">
        {title}
      </h2>

      {children}
    </div>
  );
}
