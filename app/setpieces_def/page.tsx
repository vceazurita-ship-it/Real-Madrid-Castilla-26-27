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
  "https://docs.google.com/spreadsheets/d/e/2PACX-1vS3_1ScOV6sTyEpZSgLgCf2dKbwkLzb3zUEYM-7ZOoMbcFUTp7nvu1pBfGOP7EzppXXQYQhLeVa_SPr/pub?gid=1071911136&single=true&output=csv";

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
      tiempo: (r[2] || "").trim(),
      perfil: r[3] || "",

      tipoAccion: r[4] || "",
      perfilGolpeo: r[5] || "",
      tipoEnvio: r[6] || "",
      zonaCaida: r[7] || "",
      calidadEnvio: r[8] || "",

      nAtacantes: num(r[9]),

      tipoCarrera: r[10] || "",

      oc1P: r[11] || "",
      ocCentral: r[12] || "",
      oc2P: r[13] || "",
      ocFrontal: r[14] || "",

      remate: r[15] || "",
      tipoRemate: r[16] || "",
      zonaRemate: r[17] || "",

      xg: num(r[18]),

      segundoBalon: r[19] || "",
      resultadoFinal: r[20] || "",
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

const [perfil, setPerfil] =
  useState("ALL");

const [tiempo, setTiempo] =
  useState("ALL");
  const [visualFilters, setVisualFilters] =
  useState<{
    tipoAccion?: string;
    zonaCaida?: string;
    perfilGolpeo?: string;
    tipoRemate?: string;
    tipoEnvio?: string;
    zonaRemate?: string;
    segundoBalon?: string;
    tipoCarrera?: string;
    resultadoFinal?: string;
  }>({});
function toggleFilter(
  key: keyof typeof visualFilters,
  value?: string
) {
  if (!value) return;

  setVisualFilters((prev) => ({
    ...prev,
    [key]:
      prev[key] === value
        ? undefined
        : value,
  }));
}
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
const filtered = rows.filter((r) => {
  const matchJornada =
    jornada === "ALL" ||
    r.jornada === Number(jornada);

  const matchRival =
    rival === "ALL" ||
    r.rival === rival;

  const matchPerfil =
    perfil === "ALL" ||
    r.perfil === perfil;

  const matchTiempo =
    tiempo === "ALL" ||
    r.tiempo === tiempo;

  const matchVisualFilters =
    (!visualFilters.tipoAccion ||
      r.tipoAccion === visualFilters.tipoAccion) &&
    (!visualFilters.zonaCaida ||
      r.zonaCaida === visualFilters.zonaCaida) &&
    (!visualFilters.perfilGolpeo ||
      r.perfilGolpeo ===
        visualFilters.perfilGolpeo) &&
    (!visualFilters.tipoRemate ||
      r.tipoRemate ===
        visualFilters.tipoRemate) &&
    (!visualFilters.tipoEnvio ||
      r.tipoEnvio ===
        visualFilters.tipoEnvio) &&
    (!visualFilters.zonaRemate ||
      r.zonaRemate ===
        visualFilters.zonaRemate) &&
    (!visualFilters.segundoBalon ||
      r.segundoBalon ===
        visualFilters.segundoBalon) &&
    (!visualFilters.tipoCarrera ||
      r.tipoCarrera ===
        visualFilters.tipoCarrera) &&
    (!visualFilters.resultadoFinal ||
  (visualFilters.resultadoFinal === "Gol"
    ? r.resultadoFinal
        .toLowerCase()
        .includes("gol")
    : !r.resultadoFinal
        .toLowerCase()
        .includes("gol")))

  return (
    matchJornada &&
    matchRival &&
    matchPerfil &&
    matchTiempo &&
    matchVisualFilters
  );
});
const equiposVisualizados = useMemo(
  () =>
    [...new Set(filtered.map((r) => r.rival))]
      .filter(Boolean)
      .sort(),
  [filtered]
);

  const metrics = {
    total: filtered.length,

    xg: filtered.reduce(
      (a, b) => a + b.xg,
      0
    ),

    shots: filtered.filter((r) => {
  const remate =
    r.remate
      ?.trim()
      .toLowerCase();

  return (
    remate === "sí" ||
    remate === "si"
  );
}).length,


    goals: filtered.filter(
      (r) =>
        r.resultadoFinal
          .toLowerCase()
          .includes("gol")
    ).length,
  };

  const tipoAccion =
    countBy(filtered, "tipoAccion");

  const zonaCaida =
    countBy(filtered, "zonaCaida");

  const tipoCarrera =
    countBy(filtered, "tipoCarrera");
  
  
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
  
const zonaRemateData =
  countBy(
    filtered.filter(
      (r) => r.zonaRemate
    ),
    "zonaRemate"
  );

const segundoBalonData =
  countBy(
    filtered.filter(
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

    filtered.forEach((r) => {
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
  }, [filtered]);
  const rematadoresData =
  useMemo(() => {
    const grouped: Record<
      string,
      number
    > = {};

    filtered.forEach((r) => {
      if (
        !r.tipoRemate ||
        r.tipoRemate === "No Remate"
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
  }, [filtered]);
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
  const timeline = [
  {
    tramo: "1T",
    total: filtered.filter(
      (r) => r.tiempo === "1T"
    ).length,
  },
  {
    tramo: "2T",
    total: filtered.filter(
      (r) => r.tiempo === "2T"
    ).length,
  },
];
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
    ? (metrics.goals / metrics.shots) * 100
    : 0;

const xgAccion =
  metrics.total > 0
    ? metrics.xg / metrics.total
    : 0;

const activeFilters = [
  {
    label: "Jornada",
    value: jornada,
  },
  {
    label: "Rival",
    value: rival,
  },
  {
    label: "Perfil",
    value: perfil,
  },
  {
    label: "Tiempo",
    value: tiempo,
  },
];
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
      `${conversion.toFixed(
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
    xgAccion.toFixed(2),
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
// DATOS RESUMEN
// ==========================================

const resumen = [
  `• ${metrics.total} acciones ABP ofensivas analizadas`,
  `• ${metrics.xg.toFixed(2)} xG generado`,
  `• Conversión del ${conversion.toFixed(1)}%`,
  `• ${metrics.shots} remates totales`,
  `• ${metrics.goals} goles obtenidos`,
  `• Mejor sacador: ${sacadorData[0]?.name || "-"}`,
  `• xG por acción: ${xgAccion.toFixed(2)}`,
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
        "Todas las ABP ofensivas",
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
    id: "grafico-conversion",
    title: "Conversión",
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

          <section className="px-4 sm:px-8 pb-8 sm:pb-12 pt-3 sm:pt-5">

  {/* Header */}
  <div className="mb-8">
    <p className="text-xs uppercase tracking-[0.35em] text-[#C8A96B]">
      RMC COLECTIVO
    </p>

    <div className="mt-4 flex items-center gap-3 sm:gap-5">
      <h1 className="text-3xl sm:text-4xl font-semibold tracking-tight">
        ABP Defensivo
      </h1>

      <div className="h-px flex-1 bg-gradient-to-r from-[#C8A96B]/30 via-white/10 to-transparent" />
    </div>
  </div>

  {/* Selector + KPIs */}
  <div className="rounded-[24px] sm:rounded-[32px] border border-white/10 bg-gradient-to-b from-white/[0.05] to-white/[0.02] p-5 sm:p-8 shadow-[0_12px_40px_rgba(0,0,0,0.35)] backdrop-blur-sm">

    <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4 mt-4">

  <select
    value={jornada}
    onChange={(e) =>
      setJornada(e.target.value)
    }
    className="rounded-2xl border border-white/10 bg-[#11161C] text-white px-4 py-3"
  >
    <option value="ALL">
      Todas las jornadas
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

    {rivales.map((r) => (
      <option
        key={r}
        value={r}
      >
        {r}
      </option>
    ))}
  </select>

  <select
    value={perfil}
    onChange={(e) =>
      setPerfil(e.target.value)
    }
    className="rounded-2xl border border-white/10 bg-[#11161C] text-white px-4 py-3"
  >
    <option value="ALL">
      Todos los perfiles
    </option>

    {perfiles.map((p) => (
      <option
        key={p}
        value={p}
      >
        {p}
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

<option value="1T">
  Primer tiempo
</option>

<option value="2T">
  Segundo tiempo
</option>
  </select>

</div>
<div className="mt-5">
  <p className="text-sm text-zinc-400 mb-3">
    Equipos visualizados (
    {equiposVisualizados.length}
    )
  </p>
  <div className="flex flex-wrap gap-2 mt-4">
  {Object.entries(
    visualFilters
  ).map(([key, value]) =>
    value ? (
      <button
        key={key}
        onClick={() =>
          toggleFilter(
            key as any,
            value
          )
        }
        className="
          px-3 py-1
          rounded-full
          bg-[#C8A96B]
          text-black
          text-xs
          font-semibold
        "
      >
        {value} ✕
      </button>
    ) : null
  )}
</div>

  <div className="flex flex-wrap gap-2">
  {equiposVisualizados.map((equipo) => {
    const active = rival === equipo;

    return (
      <button
        key={equipo}
        type="button"
        onClick={() =>
          setRival(
            active ? "ALL" : equipo
          )
        }
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
    lg:grid-cols-4
    xl:grid-cols-7
  "
>
  <Card
    title="ABP"
    value={metrics.total.toLocaleString()}
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
/>

  <Card
    title="xG"
    value={metrics.xg.toFixed(2)}
  />

  <Card
    title="Remates"
    value={metrics.shots.toLocaleString()}
  />

  <Card
    title="Goles"
    value={metrics.goals.toLocaleString()}
  />
  <div
className="
  h-[96px]
  sm:h-[112px]
  rounded-[20px]
  sm:rounded-[24px]
  border
  border-white/10
  bg-white/[0.03]
  p-3
  sm:p-5
  flex
  flex-col
  justify-between
"
>
  <p className="text-sm text-zinc-400">
Mayor xG concedido  </p>

  <h3 className="mt-4 text-lg md:text-xl font-semibold text-[#C8A96B]">
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
        onClick={(data) =>
    toggleFilter(
      "tipoAccion",
      data.name
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
  </Chart></div>
</Panel>
<Panel title="Zona caída">
  <div id="grafico-zona-caida">
  <Chart>
    <PieChart>
      <Pie
        data={zonaCaida}
        onClick={(data) =>
    toggleFilter(
      "zonaCaida",
      data.name
    )
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
        )}<Label
  value={filtered.length}
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
        onClick={(data) =>
    toggleFilter(
      "perfilGolpeo",
      data.name
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
<Panel title="Impacto rematadores"><div id="grafico-impacto-rematadores">
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
        onClick={(data) =>
  toggleFilter(
    "tipoRemate",
    data.name
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
<Panel title="xG por tipo envío"><div id="grafico-tipo-envio">
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
        onClick={(data) =>
  toggleFilter(
    "tipoEnvio",
    data.name
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
<Panel title="Zona remate"><div id="grafico-zona-remate">
  <Chart>
    <PieChart>
      <Pie
        data={zonaRemateData}
        onClick={(data) =>
    toggleFilter(
      "zonaRemate",
      data.name
    )
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

      <Legend {...pieLegendProps} />
    </PieChart>
  </Chart></div>
</Panel>
<Panel title="Segundo balón"><div id="grafico-segundo-balon">
  <Chart>
    <PieChart>
      <Pie
        data={segundoBalonData}
         onClick={(data) =>
    toggleFilter(
      "segundoBalon",
      data.name
    )
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

      <Legend {...pieLegendProps} />
    </PieChart>
  </Chart></div>
</Panel>

<Panel title="Tipo carrera"><div id="grafico-tipo-carrera">
  <Chart>
    <PieChart>
      <Pie
        data={tipoCarrera}
         onClick={(data) =>
  toggleFilter(
    "tipoCarrera",
    data.name
  )
}
        dataKey="total"
        nameKey="name"
        innerRadius={isMobile ? 65 : 95}
        outerRadius={isMobile ? 90 : 120}
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
        )} 
        <Label
  value={filtered.length}
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
<Panel title="Distribución por periodo"><div id="grafico-distribucion-periodo">
  <Chart>
    <BarChart data={timeline}>
  <CartesianGrid
    stroke="#1E232A"
    vertical={false}
  />

  <XAxis
    dataKey="tramo"
    domain={[0, (dataMax: number) => Math.ceil(dataMax * 1.15)]}
    axisLine={false}
    tickLine={false}
  />

  <YAxis
    axisLine={false}
    tickLine={false}
  />

  <Tooltip />

  <Bar
    dataKey="total"
    fill={COLORS.green}
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
<Panel title="xG por tipo de acción"><div id="grafico-xg-tipo-accion">
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

<Panel title="Top rivales por xG concedido"><div id="grafico-rivales-xg-concedido">
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
<Panel title="xG por zona caida"><div id="grafico-xg-zona-caida">
  <Chart>
    <BarChart
  data={xgZonaCaida}
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
        <LabelList
          dataKey="total"
          position="right"
        />
      </Bar>
    </BarChart>
  </Chart></div>
</Panel>
<Panel title="Conversión"><div id="grafico-conversion">
  <Chart>
    <PieChart>
      <Pie
        data={resultadoData}
         onClick={(data) =>
    toggleFilter(
      "resultadoFinal",
      data.name === "Gol"
        ? "Gol"
        : "No Gol"
    )}
        dataKey="total"
        nameKey="name"
innerRadius={isMobile ? 65 : 95}
outerRadius={isMobile ? 90 : 120}
        paddingAngle={4}
        cornerRadius={8}
        stroke="transparent"
><Label
  value={filtered.length}
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
        <Cell fill="#10B981" />
        <Cell fill="#475569" />
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

function Card({
  title,
  value,
}: any) {
  return (
    <div
      className="
        h-[96px]
        sm:h-[112px]
        rounded-[20px]
        sm:rounded-[24px]
        border
        border-white/10
        bg-white/[0.03]
        p-3
        sm:p-5
        flex
        flex-col
        justify-between
      "
    >
      <p className="text-xs sm:text-sm text-zinc-400">
  {title}
</p>

<h3
  className="
    mt-2
    text-lg
    sm:text-2xl
    lg:text-[34px]
    font-semibold
    leading-none
    truncate
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