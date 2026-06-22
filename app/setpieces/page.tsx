"use client";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import { Sidebar } from "@/components/ui/sidebar";
import { Topbar } from "@/components/ui/topbar";
import type { LegendProps } from "recharts";
import { FileDown } from "lucide-react";
import * as htmlToImage from "html-to-image";

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
  "#C8A96B",
  "#D6B985",
  "#E5CCA2",
  "#8A6A35",
  "#B8945B",
  "#F1E4C8",
];

type Row = {
  jornada: number;
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
  resultadoFinal: string;
  rutina: string;
  repetir: string;
};

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

function parseCSV(text: string): Row[] {
  const parsed = Papa.parse<string[]>(text, {
    header: false,
    skipEmptyLines: true,
  });

  return parsed.data
    .slice(1)
    .map((r) => ({
      jornada: num(r[0]),
      rival: r[1] || "",
      tiempo: num(r[2]),
      minuto: num(r[3]),

      sacador: r[6] || "",

      tipoAccion: r[8] || "",
      perfilGolpeo: r[9] || "",
      tipoEnvio: r[10] || "",
      zonaCaida: r[11] || "",

      tipoCarrera: r[16] || "",

      defensaRival: r[21] || "",
      debilidadRival: r[22] || "",

      rematador: r[24] || "",
      tipoRemate: r[25] || "",
      zonaRemate: r[26] || "",

      xg: num(r[27]),

      segundoBalon: r[28] || "",
      resultadoFinal: r[29] || "",
      rutina: r[30] || "",
      repetir: r[31] || "",
    }))
    .filter((r) => r.jornada > 0);
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
  const [tiempo, setTiempo] =
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
  useEffect(() => {
    fetch(CSV_URL)
      .then((r) => r.text())
      .then((t) =>
        setRows(parseCSV(t))
      );
  }, []);

  const jornadas = useMemo(
    () =>
      [
        ...new Set(
          rows.map((r) => r.jornada)
        ),
      ].sort((a, b) => a - b),
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
    String(r.jornada) === jornada;

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

  const tiempoOk =
    tiempo === "ALL" ||
    (tiempo === "0-30" &&
      r.minuto < 30) ||
    (tiempo === "30-60" &&
      r.minuto >= 30 &&
      r.minuto < 60) ||
    (tiempo === "60-90" &&
      r.minuto >= 60);
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
  (
    resultadoFilter === "Gol"
      ? r.resultadoFinal
          .toLowerCase()
          .includes("gol")
      : !r.resultadoFinal
          .toLowerCase()
          .includes("gol")
  );

  return (
    jornadaOk &&
    rivalOk &&
    sacadorOk &&
    accionOk &&
    tiempoOk &&
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
    value: jornada,
    clear: () => setJornada("ALL"),
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
    label: "Tiempo",
    value: tiempo,
    clear: () => setTiempo("ALL"),
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
        "Nadie",
        "No aplica",
      ].includes(r.rematador)
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

const resultadoData = [
  {
    name: "Gol",
    total:
      filtered.filter((r) =>
        r.resultadoFinal
          .toLowerCase()
          .includes("gol")
      ).length,
  },
  {
    name: "No Gol",
    total:
      filtered.filter(
        (r) =>
          !r.resultadoFinal
            .toLowerCase()
            .includes("gol")
      ).length,
  },
];
const totalTipoCarrera =
  tipoCarrera.reduce(
    (acc, item) => acc + item.total,
    0
  );
  const timeline =
    Array.from(
      { length: 6 },
      (_, i) => {
        const start =
          i * 15;

        return {
          tramo: `${start}-${start + 15}`,
          total:
            filtered.filter(
              (r) =>
                r.minuto >=
                  start &&
                r.minuto <
                  start + 15
            ).length,
        };
      }
    );
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
      id: "grafico-conversión",
      title: "Conversión",
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
  return (
    <main className="min-h-screen bg-[#0B0F14] text-white">
      <div className="flex">

  <Sidebar />


        <div className="flex-1">
          <Topbar />

          <section className="px-4 sm:px-8 pb-8 sm:pb-12 pt-6 sm:pt-10">

  {/* Header */}
  <div className="mb-8">
    <p className="text-xs uppercase tracking-[0.35em] text-[#C8A96B]">
      RMCF CASTILLA COLECTIVO
    </p>

    <div className="mt-4 flex items-center gap-3 sm:gap-5">
      <h1 className="text-3xl sm:text-4xl font-semibold tracking-tight">
        ABP Ofensivo
      </h1>

      <div className="h-px flex-1 bg-gradient-to-r from-[#C8A96B]/30 via-white/10 to-transparent" />
    </div>
  </div>

  {/* Selector + KPIs */}
  <div className="rounded-[24px] sm:rounded-[32px] border border-white/10 bg-gradient-to-b from-white/[0.05] to-white/[0.02] p-5 sm:p-8 shadow-[0_12px_40px_rgba(0,0,0,0.35)] backdrop-blur-sm">

    <select
      value={jornada}
      onChange={(e) =>
        setJornada(e.target.value)
      }
      className="w-full sm:w-auto rounded-2xl border border-white/10 bg-[#11161C] text-white px-4 py-3 text-sm sm:text-base"
    >
      <option value="ALL">
        Todas
      </option>

      {jornadas.map((m) => (
        <option
          key={m}
          value={m}
        >
          Jornada {m}
        </option>
      ))}
    </select>
    <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4 mt-4">

  <select
    value={rival}
    onChange={(e) =>
      setRival(e.target.value)
    }
    className="rounded-2xl border border-white/10 bg-[#11161C] text-white px-4 py-3"
  >
    <option value="ALL">
      Todos los rivales
    </option>

    {rivales.map((v) => (
      <option key={v} value={v}>
        {v}
      </option>
    ))}
  </select>

  <select
    value={sacador}
    onChange={(e) =>
      setSacador(e.target.value)
    }
    className="rounded-2xl border border-white/10 bg-[#11161C] text-white px-4 py-3"
  >
    <option value="ALL">
      Todos los sacadores
    </option>

    {sacadores.map((v) => (
      <option key={v} value={v}>
        {v}
      </option>
    ))}
  </select>

  <select
    value={tipoAccionFilter}
    onChange={(e) =>
      setTipoAccionFilter(
        e.target.value
      )
    }
    className="rounded-2xl border border-white/10 bg-[#11161C] text-white px-4 py-3"
  >
    <option value="ALL">
      Todas las acciones
    </option>

    {tiposAccion.map((v) => (
      <option key={v} value={v}>
        {v}
      </option>
    ))}
  </select>
  <select
  value={tiempo}
  onChange={(e) =>
    setTiempo(e.target.value)
  }
  className="rounded-2xl border border-white/10 bg-[#11161C] text-white px-4 py-3"
>
  <option value="ALL">
    Todo el partido
  </option>

  <option value="0-30">
    0 - 30'
  </option>

  <option value="30-60">
    30' - 60'
  </option>

  <option value="60-90">
    60' - 90'
  </option>
</select>
</div>
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
    <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-7 gap-4 sm:gap-5 mt-5 sm:mt-6">
      <Card
        title="ABP"
        value={metrics.total}
      />

      <Card
        title="xG"
        value={metrics.xg.toFixed(2)}
      />
 
      <Card
        title="Remates"
        value={metrics.shots}
      />

      <Card
        title="Goles"
        value={metrics.goals}
      />
      <Card
  title="Conversión"
  value={`${metrics.conversion.toFixed(
    1
  )}%`}
/>
<Card
  title="xG / ABP"
  value={metrics.xgAccion.toFixed(2)}
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

            <div className="grid grid-cols-1 md:grid-cols-2 gap-5 md:gap-6 mt-8 md:mt-10">

              <Panel title="Tipo de acción">
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
            fill: "#F8FAFC",
            fontWeight: 600,
            fontSize: 12,
          }}
        />
      </Bar>
    </BarChart>
  </Chart>
  </div>
</Panel>
<Panel title="Zona de saque">
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
<Panel title="Impacto sacador">
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
<Panel title="Impacto rematadores">
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
<Panel title="xG por tipo envío">
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
<Panel title="Zona remate">
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
<Panel title="Segundo balón">
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

<Panel title="Tipo carrera">
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
<Panel title="Defensa rival">
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
<Panel title="Timeline">
  <div id="grafico-timeline">

  <Chart>
    <LineChart
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

      <XAxis
        dataKey="tramo"
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

      <Line
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
    </LineChart>
  </Chart></div>
</Panel>
<Panel title="xG por tipo de acción">
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

<Panel title="Top rivales por xG concedido">
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
<Panel title="xG por zona caida">
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
<Panel title="Conversión">
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
        <Cell fill="#10B981" />
        <Cell fill="#475569" />
   <Label
value={`${metrics.conversion.toFixed(0)}%`}
  position="center"
  fill="#fff"
  fontSize={isMobile ? 22 : 30}
/>    <LabelList
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

      <Legend />
    </PieChart>
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

function Card({
  title,
  value,
}: any) {
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