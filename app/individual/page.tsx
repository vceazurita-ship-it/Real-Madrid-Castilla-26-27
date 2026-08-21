"use client";

import type { ReactNode } from "react";
import { useCallback, useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";

import {
  AlertTriangle,
  Brain,
  CalendarDays,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  ClipboardList,
  ExternalLink,
  FileText,
  Gauge,
  Loader2,
  Pencil,
  PlayCircle,
  Plus,
  RotateCcw,
  Search,
  Shield,
  Star,
  Target,
  Trash2,
  Users,
  Video,
  X,
} from "lucide-react";

import { toast } from "sonner";

import { Sidebar } from "@/components/ui/sidebar";
import { Topbar } from "@/components/ui/topbar";
import { useBodyScrollLock } from "@/components/season/useBodyScrollLock";
import { PlayerRatingsTab } from "@/components/ratings/PlayerRatingsTab";
import { useRatingsSeason } from "@/hooks/useRatings";
import { playerEntries } from "@/lib/ratings/compute";

import {
  RadarChart,
  PolarGrid,
  PolarAngleAxis,
  PolarRadiusAxis,
  Radar,
  ResponsiveContainer,
} from "recharts";

/* ------------------------------------------------------------------ */
/*  CONSTANTES                                                         */
/* ------------------------------------------------------------------ */

const GOLD = "#C8A96B";

const SHEET_VIDEOS =
  "https://docs.google.com/spreadsheets/d/e/2PACX-1vTkdtHaPU7QWiWPxOWJYkfpD-RvFF3dsnRDGVjh9e3rkoA9pDQFNp6WPNRZafrAMNfe8cLlBqkf9S9k/pub?gid=1875419243&single=true&output=csv";

const SHEET_INFORMES =
  "https://docs.google.com/spreadsheets/d/e/2PACX-1vTkdtHaPU7QWiWPxOWJYkfpD-RvFF3dsnRDGVjh9e3rkoA9pDQFNp6WPNRZafrAMNfe8cLlBqkf9S9k/pub?gid=1812683440&single=true&output=csv";

const APPS_SCRIPT_URL =
  "https://script.google.com/macros/s/AKfycbxCaJ90F28CYdcLVNnI4RZjyQL5IJlXVunEAobWY-Qr6lUL8No9H1B3RdASk83Z_NUd/exec";

const DEFAULT_CON_BALON = "Contenido por definir";
const DEFAULT_SIN_BALON = "Contenido por definir";
const DEFAULT_MENTAL = "Contenido por definir";

/* ------------------------------------------------------------------ */
/*  TIPOS                                                              */
/* ------------------------------------------------------------------ */

type Player = {
  idJugador: string;
  name: string;
  position: string;
  photo: string;

  externo?: boolean;

  conBalon?: string;
  sinBalon?: string;
  mental?: string;
  hudlPerfilUrl?: string;

  mentalidad?: number;
  habitos?: number;
  interpretacion?: number;
  capacidadFisica?: number;
  tecnica?: number;
};

/* Jugador con los datos de la hoja ya cruzados y sus contadores. */
type MergedPlayer = Player & {
  conBalon: string;
  sinBalon: string;
  mental: string;
  hudlPerfilUrl: string;

  mentalidad: number;
  habitos: number;
  interpretacion: number;
  capacidadFisica: number;
  tecnica: number;

  sessions: number;
  videos: number;
  hasReport: boolean;
  score: number;
  lastSession: Date | null;
};

type TrackingRecord = {
  ID_REGISTRO: string;
  ID_JUGADOR: string;
  FECHA: string;
  OBJETIVO_OFENSIVO: string;
  OBJETIVO_DEFENSIVO: string;
  OBJETIVO_MENTAL: string;
  FEEDBACK: string;
  QUIEN: string;
  MODALIDAD: string;
  MOMENTO: string;
  ESTRATEGIA: string;
};

type VideoItem = {
  ID_VIDEO: string;
  ID_JUGADOR: string;
  CATEGORIA: string;
  TITULO: string;
  DESCRIPCION: string;
  URL_VIDEO: string;
  FECHA: string;
};

type ReportItem = {
  ID_JUGADOR: string;
  RESUMEN_EJECUTIVO: string;
  FORTALEZAS_INFORME: string;
  ASPECTOS_MEJORA_INFORME: string;
  OBJETIVOS: string;
  OBSERVACIONES_FINALES: string;
};

type TabKey =
  | "perfil"
  | "seguimiento"
  | "valoraciones"
  | "videos"
  | "informe";

/* ------------------------------------------------------------------ */
/*  OPCIONES DE FORMULARIO                                             */
/* ------------------------------------------------------------------ */

const QUIEN_OPTIONS = [
  "JULIÁN",
  "MIGUEL",
  "VICTOR",
  "JULIÁN Y MIGUEL",
  "JULIÁN Y VICTOR",
  "MIGUEL Y VICTOR",
  "TODOS",
];

const MODALIDAD_OPTIONS = ["GRUPAL", "INDIVIDUAL"];

const MOMENTO_OPTIONS = [
  "PRE-ENTRENAMIENTO",
  "ENTRENAMIENTO",
  "POST-ENTRENAMIENTO",
];

const ESTRATEGIA_OPTIONS = ["CAMPO", "VÍDEO", "CHARLA"];

/* Las cinco competencias que alimentan el radar y la media del jugador. */
const METRICS = [
  { key: "mentalidad", label: "Mentalidad", short: "Mentalidad" },
  { key: "habitos", label: "Hábitos", short: "Hábitos" },
  { key: "interpretacion", label: "Interpretación", short: "Interpret." },
  { key: "capacidadFisica", label: "Capacidad física", short: "Cap. física" },
  { key: "tecnica", label: "Técnica", short: "Técnica" },
] as const;

const LINES = [
  { key: "Portero", title: "Porteros", color: "#EAB308" },
  { key: "Defensa", title: "Defensas", color: "#38BDF8" },
  { key: "Centrocampista", title: "Centrocampistas", color: "#4ADE80" },
  { key: "Delantero", title: "Delanteros", color: "#F87171" },
];

const players: Player[] = [
  // PORTEROS
  {
    idJugador: "JUG-24",
    name: "Mestre",
    position: "Portero",
    photo:
      "https://assets.realmadrid.com/is/image/realmadrid/SERGIO_MESTRE_380x501?$Desktop$&fit=wrap&wid=288&hei=384",
  },
  {
    idJugador: "JUG-25",
    name: "Javi Navarro",
    position: "Portero",
    photo:
      "https://assets.realmadrid.com/is/image/realmadrid/JAVI_NAVARRO_550x650?$Desktop$&fit=wrap&wid=288&hei=384",
  },
  {
    idJugador: "JUG-26",
    name: "F. Quetglas",
    position: "Portero",
    photo:
      "https://assets.realmadrid.com/is/image/realmadrid/FERRAN_QUETGLAS_380x501?$Desktop$&fit=wrap&wid=288&hei=384",
  },

  // DEFENSAS
  {
    idJugador: "JUG-01",
    name: "Fortea",
    position: "Defensa",
    photo:
      "https://assets.realmadrid.com/is/image/realmadrid/JESUS_FORTEA_380x501?$Desktop$&fit=wrap&wid=288&hei=384",
  },
  {
    idJugador: "JUG-02",
    name: "Melvin Ukpeigbe",
    position: "Defensa",
    photo:
      "https://assets.realmadrid.com/is/image/realmadrid/MELVIN_DB10242_380x501%20%E2%80%93%201?$Desktop$&fit=wrap&wid=288&hei=384",
  },
  {
    idJugador: "JUG-03",
    name: "Valdepeñas",
    position: "Defensa",
    photo:
      "https://assets.realmadrid.com/is/image/realmadrid/VICTOR_VALDEPEÑAS_380x501?$Desktop$&fit=wrap&wid=288&hei=384",
  },
  {
    idJugador: "JUG-04",
    name: "Diego Aguado",
    position: "Defensa",
    photo:
      "https://assets.realmadrid.com/is/image/realmadrid/DIEGO_AGUADO_380x501?$Desktop$&fit=wrap&wid=288&hei=384",
  },
  {
    idJugador: "JUG-06",
    name: "Álvaro Lezcano",
    position: "Defensa",
    photo:
      "https://assets.realmadrid.com/is/image/realmadrid/ALVARO%20LEZCANO_JT11325_550x650?$Desktop$&fit=wrap&wid=288&hei=384",
  },
  {
    idJugador: "JUG-05",
    name: "Manu Serrano",
    position: "Defensa",
    photo:
      "https://assets.realmadrid.com/is/image/realmadrid/MANU_SERRANO_380x501?$Desktop$&fit=wrap&wid=288&hei=384",
  },
  {
    idJugador: "JUG-07",
    name: "Joan Martínez",
    position: "Defensa",
    photo:
      "https://assets.realmadrid.com/is/image/realmadrid/JOAN_MARTINEZ_380x501?$Desktop$&fit=wrap&wid=288&hei=384",
  },
  {
    idJugador: "JUG-08",
    name: "Mario Rivas",
    position: "Defensa",
    photo:
      "https://assets.realmadrid.com/is/image/realmadrid/MARIO_RIVAS_380x501?$Desktop$&fit=wrap&wid=288&hei=384",
  },
  {
    idJugador: "JUG-09",
    name: "Lamini",
    position: "Defensa",
    photo:
      "https://assets.realmadrid.com/is/image/realmadrid/LAMINI_DB10244_380x501?$Desktop$&fit=wrap&wid=288&hei=384",
  },
  {
    idJugador: "JUG-10",
    name: "Ariel Ncoghe",
    position: "Defensa",
    photo:
      "https://assets.realmadrid.com/is/image/realmadrid/ARIEL%20NKOGHE_JT11313_550x650?$Desktop$&fit=wrap&wid=288&hei=384",
  },

  // CENTROCAMPISTAS
  {
    idJugador: "JUG-11",
    name: "Cestero",
    position: "Centrocampista",
    photo:
      "https://assets.realmadrid.com/is/image/realmadrid/JORGE_CESTERO_380x501?$Desktop$&fit=wrap&wid=288&hei=384",
  },
  {
    idJugador: "JUG-12",
    name: "Cristian David",
    position: "Centrocampista",
    photo:
      "https://assets.realmadrid.com/is/image/realmadrid/CRISTIAN_DAVID_380x501?$Desktop$&fit=wrap&wid=288&hei=384",
  },
  {
    idJugador: "JUG-13",
    name: "Thiago",
    position: "Centrocampista",
    photo:
      "https://assets.realmadrid.com/is/image/realmadrid/THIAGO_PITARCH_550x650?$Desktop$&fit=wrap&wid=288&hei=384",
  },
  {
    idJugador: "JUG-15",
    name: "M. Rezola",
    position: "Centrocampista",
    photo:
      "https://assets.realmadrid.com/is/image/realmadrid/MANEX-REZOLA_AV17806_550x650?$Desktop$&fit=wrap&wid=420",
  },
  {
    idJugador: "JUG-14",
    name: "Diego Lacosta",
    position: "Centrocampista",
    photo:
      "https://assets.realmadrid.com/is/image/realmadrid/DIEGO%20LASCOSTA_JT11305_550X650?$Desktop$&fit=wrap&wid=288&hei=384",
  },
  {
    idJugador: "JUG-16",
    name: "Roberto",
    position: "Centrocampista",
    photo:
      "https://assets.realmadrid.com/is/image/realmadrid/ROBERTO_MARTIN_380x501?$Desktop$&fit=wrap&wid=288&hei=384",
  },
  {
    idJugador: "JUG-17",
    name: "Pol Fortuny",
    position: "Centrocampista",
    photo:
      "https://assets.realmadrid.com/is/image/realmadrid/POL_FORTUNY_380x501?$Desktop$&fit=wrap&wid=288&hei=384",
  },
  {
    idJugador: "JUG-18",
    name: "Mesonero",
    position: "Centrocampista",
    photo:
      "https://assets.realmadrid.com/is/image/realmadrid/DANIEL_MESONERO_380x501?$Desktop$&fit=wrap&wid=288&hei=384",
  },
  {
    idJugador: "JUG-19",
    name: "Yáñez",
    position: "Centrocampista",
    photo:
      "https://assets.realmadrid.com/is/image/realmadrid/DANIEL_YAÑEZ_380x501?$Desktop$&fit=wrap&wid=288&hei=384",
  },
  {
    idJugador: "JUG-20",
    name: "Alexis Ciria",
    position: "Centrocampista",
    photo:
      "https://assets.realmadrid.com/is/image/realmadrid/ALEXIS-CIRIA_JT10268_380x501?$Desktop$&fit=wrap&wid=288&hei=384",
  },
  {
    idJugador: "JUG-21",
    name: "Á. Leiva",
    position: "Centrocampista",
    photo:
      "https://assets.realmadrid.com/is/image/realmadrid/ALVARO_LEIVA_380x501?$Desktop$&fit=wrap&wid=288&hei=384",
  },

  // DELANTEROS
  {
    idJugador: "JUG-23",
    name: "Rachad",
    position: "Delantero",
    photo:
      "https://assets.realmadrid.com/is/image/realmadrid/RACHAD_FETTAL_380x501?$Desktop$&fit=wrap&wid=288&hei=384",
  },
  {
    idJugador: "JUG-22",
    name: "Jacobo",
    position: "Delantero",
    photo:
      "https://assets.realmadrid.com/is/image/realmadrid/JACOBO_ORTEGA_380x501?$Desktop$&fit=wrap&wid=288&hei=384",
  },
  {
    idJugador: "JUG-27",
    name: "Carvajal",
    position: "Delantero",
    photo:
      "https://assets.realmadrid.com/is/image/realmadrid/ANGEL-CARVAJAL_JT14583?$Desktop$&fit=wrap&wid=420",
  },
  // NUEVOS
// PORTEROS
{
  idJugador: "JUG-43",
  name: "Illia",
  position: "Portero",
  externo: true,
  photo:
    "https://assets.realmadrid.com/is/image/realmadrid/IILIA%20VOLOSHYN_DB10246_380x501%20%E2%80%93%201?$Desktop$&fit=wrap&wid=288&hei=384",
},
{
  idJugador: "JUG-44",
  name: "Álvaro",
  position: "Portero",
  externo: true,
  photo:
    "https://assets.realmadrid.com/is/image/realmadrid/ALVARO_GONZALEZ_380x501?$Desktop$&fit=wrap&wid=288&hei=384",
},

// DEFENSAS
{
  idJugador: "JUG-37",
  name: "Bailón",
  position: "Defensa",
  externo: true,
  photo:
    "https://assets.realmadrid.com/is/image/realmadrid/JAVIER%20BAILON_JT11321_JT11482_550X650?$Desktop$&fit=wrap&wid=288&hei=384",
},
{
  idJugador: "JUG-38",
  name: "Jime",
  position: "Defensa",
  externo: true,
  photo:
    "https://assets.realmadrid.com/is/image/realmadrid/DAVID_JIMENEZ_380x501?$Desktop$&fit=wrap&wid=288&hei=384",
},
{
  idJugador: "JUG-39",
  name: "Liberto",
  position: "Defensa",
  externo: true,
  photo:
    "https://assets.realmadrid.com/is/image/realmadrid/LIBERTO%20NAVASCUES_DB10237_380x501?$Desktop$&fit=wrap&wid=288&hei=384",
},
{
  idJugador: "JUG-40",
  name: "Aimar Gar",
  position: "Defensa",
  externo: true,
  photo: "/players/AIMAR_GARCIA.jpg",
},
{
  idJugador: "JUG-42",
  name: "Seco",
  position: "Defensa",
  externo: true,
  photo:
    "https://assets.realmadrid.com/is/image/realmadrid/FERRAN%20SECO_JT11296_550x650?$Desktop$&fit=wrap&wid=288&hei=384",
},
{
  idJugador: "JUG-45",
  name: "Sotres",
  position: "Defensa",
  externo: true,
  photo:
    "https://assets.realmadrid.com/is/image/realmadrid/SOSTRES_380x501?$Desktop$&fit=wrap&wid=288&hei=384",
},

// CENTROCAMPISTAS
{
  idJugador: "JUG-34",
  name: "Mami",
  position: "Centrocampista",
  externo: true,
  photo:
    "https://assets.realmadrid.com/is/image/realmadrid/MANUEL_ANGEL_380x501?$Desktop$&fit=wrap&wid=288&hei=384",
},
{
  idJugador: "JUG-35",
  name: "Beto",
  position: "Centrocampista",
  externo: true,
  photo:
    "https://assets.realmadrid.com/is/image/realmadrid/diego_martinez?$Desktop$&fit=wrap&wid=288&hei=384",
},
{
  idJugador: "JUG-46",
  name: "Izan",
  position: "Centrocampista",
  photo:
    "https://assets.realmadrid.com/is/image/realmadrid/IZAN_REGUEIRA_380x501?$Desktop$&fit=wrap&wid=288&hei=384",
},
{
  idJugador: "JUG-47",
  name: "Cherif",
  position: "Centrocampista",
  externo: true,
  photo:
    "https://assets.realmadrid.com/is/image/realmadrid/MOCTAR%20CHERIF_550x650?$Desktop$&fit=wrap&wid=288&hei=384",
},

// DELANTEROS
{
  idJugador: "JUG-33",
  name: "Castrelo",
  position: "Centrocampista",
  externo: true,
  photo:
    "https://assets.realmadrid.com/is/image/realmadrid/GABRIEL_CASTRELO_380x501?$Desktop$&fit=wrap&wid=288&hei=384",
},
{
  idJugador: "JUG-48",
  name: "Gabri",
  position: "Centrocampista",
  externo: true,
  photo:
    "https://assets.realmadrid.com/is/image/realmadrid/GABRIEL%20VALERO_JT11314_550x650?$Desktop$&fit=wrap&wid=288&hei=384",
},
{
  idJugador: "JUG-28",
  name: "Barroso",
  position: "Delantero",
  externo: true,
  photo:
    "https://assets.realmadrid.com/is/image/realmadrid/JAIME%20BARROSO_DB10239380x501%20%E2%80%93%201?$Desktop$&fit=wrap&wid=288&hei=384",
},
{
  idJugador: "JUG-31",
  name: "Carlos D.",
  position: "Centrocampista",
  externo: true,
  photo:
    "https://assets.realmadrid.com/is/image/realmadrid/CARLOS%20DIEZ_DB10299_380x501%20%E2%80%93%201?$Desktop$&fit=wrap&wid=288&hei=384",
},
{
  idJugador: "JUG-32",
  name: "Ginés",
  position: "Delantero",
  externo: true,
  photo:
    "https://assets.realmadrid.com/is/image/realmadrid/ALVARO_GINES_380x501?$Desktop$&fit=wrap&wid=288&hei=384",
},


];

/* ------------------------------------------------------------------ */
/*  UTILIDADES                                                         */
/* ------------------------------------------------------------------ */

function normalize(text = "") {
  return text
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");
}

function parseCSV(text: string) {
  const rows: string[][] = [];
  let row: string[] = [];
  let value = "";
  let inQuotes = false;

  for (let i = 0; i < text.length; i++) {
    const char = text[i];
    const next = text[i + 1];

    if (char === '"') {
      if (inQuotes && next === '"') {
        value += '"';
        i++;
      } else {
        inQuotes = !inQuotes;
      }
    } else if (char === "," && !inQuotes) {
      row.push(value.trim());
      value = "";
    } else if ((char === "\n" || char === "\r") && !inQuotes) {
      if (value || row.length) {
        row.push(value.trim());
        rows.push(row);
        row = [];
        value = "";
      }

      if (char === "\r" && next === "\n") {
        i++;
      }
    } else {
      value += char;
    }
  }

  if (value || row.length) {
    row.push(value.trim());
    rows.push(row);
  }

  const headers = rows[0] || [];

  return rows.slice(1).map((r) =>
    headers.reduce((obj: Record<string, string>, h, i) => {
      obj[h.trim()] = (r[i] || "").trim();
      return obj;
    }, {}),
  );
}

/* Drive y YouTube necesitan la variante /preview o /embed para incrustarse. */
function embedUrl(url = "") {
  const clean = url.trim();

  if (!clean) return "";

  const drive = clean.match(/drive\.google\.com\/file\/d\/([^/?]+)/);

  if (drive) return `https://drive.google.com/file/d/${drive[1]}/preview`;

  const youtube = clean.match(
    /(?:youtu\.be\/|youtube\.com\/(?:watch\?v=|embed\/))([\w-]{6,})/,
  );

  if (youtube) return `https://www.youtube.com/embed/${youtube[1]}`;

  return clean.replace("/view", "/preview");
}

function parseDate(value = "") {
  if (!value) return null;

  const date = new Date(value);

  return Number.isNaN(date.getTime()) ? null : date;
}

function formatDate(value = "") {
  const date = parseDate(value);

  if (!date) return value || "Sin fecha";

  return date.toLocaleDateString("es-ES", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

function capitalize(text: string) {
  return text.charAt(0).toUpperCase() + text.slice(1);
}

function relativeFrom(date: Date | null) {
  if (!date) return "";

  const days = Math.round((Date.now() - date.getTime()) / 86400000);

  if (days < 0) return "programado";
  if (days === 0) return "hoy";
  if (days === 1) return "ayer";
  if (days < 30) return `hace ${days} días`;
  if (days < 60) return "hace 1 mes";

  return `hace ${Math.round(days / 30)} meses`;
}

/* Media de las competencias puntuadas (las que están a 0 no cuentan). */
function averageScore(player: Player) {
  const values = METRICS.map((m) => Number(player[m.key] || 0)).filter(
    (v) => v > 0,
  );

  if (!values.length) return 0;

  return values.reduce((a, b) => a + b, 0) / values.length;
}

function scoreColor(score: number) {
  if (score >= 8) return "#4ADE80";
  if (score >= 6.5) return GOLD;
  if (score >= 5) return "#FBBF24";

  return "#F87171";
}

/* ------------------------------------------------------------------ */
/*  PIEZAS DE UI                                                       */
/* ------------------------------------------------------------------ */

function StatTile({
  icon: Icon,
  label,
  value,
  hint,
}: {
  icon: typeof Users;
  label: string;
  value: string | number;
  hint?: string;
}) {
  return (
    <div className="min-w-0 rounded-2xl border border-white/10 bg-white/[0.025] p-4 transition hover:border-white/20">
      <div className="flex items-center gap-2 text-[10px] uppercase tracking-[0.25em] text-white/40">
        <Icon size={13} className="shrink-0 text-[#C8A96B]" />
        <span className="truncate">{label}</span>
      </div>

      <p className="mt-2 text-2xl font-semibold tabular-nums">{value}</p>

      {hint && (
        <p className="mt-0.5 truncate text-[11px] text-white/30">{hint}</p>
      )}
    </div>
  );
}

function ScoreRing({ value, size = 56 }: { value: number; size?: number }) {
  const clamped = Math.max(0, Math.min(10, value));
  const pct = (clamped / 10) * 100;
  const color = scoreColor(clamped);

  return (
    <div className="relative shrink-0" style={{ width: size, height: size }}>
      <svg viewBox="0 0 36 36" className="h-full w-full -rotate-90">
        <circle
          cx="18"
          cy="18"
          r="15.9155"
          fill="none"
          stroke="rgba(255,255,255,0.08)"
          strokeWidth="3"
        />

        <circle
          cx="18"
          cy="18"
          r="15.9155"
          fill="none"
          stroke={color}
          strokeWidth="3"
          strokeLinecap="round"
          strokeDasharray={`${pct} ${100 - pct}`}
        />
      </svg>

      <div className="absolute inset-0 flex items-center justify-center">
        <span className="text-sm font-semibold tabular-nums" style={{ color }}>
          {clamped ? clamped.toFixed(1) : "—"}
        </span>
      </div>
    </div>
  );
}

function Panel({
  title,
  icon: Icon,
  count,
  action,
  children,
  className = "",
}: {
  title: string;
  icon?: typeof Users;
  count?: string | number;
  action?: ReactNode;
  children: ReactNode;
  className?: string;
}) {
  return (
    <section
      className={`min-w-0 overflow-hidden rounded-2xl border border-white/10 bg-white/[0.025] ${className}`}
    >
      <div className="flex min-w-0 items-center justify-between gap-3 border-b border-white/10 bg-white/[0.025] px-4 py-3">
        <h3 className="flex min-w-0 items-center gap-2 truncate text-[11px] font-semibold uppercase tracking-[0.25em] text-[#C8A96B]">
          {Icon && <Icon size={13} className="shrink-0" />}
          <span className="truncate">{title}</span>
        </h3>

        <div className="flex shrink-0 items-center gap-3">
          {count !== undefined && (
            <span className="text-xs tabular-nums text-white/30">{count}</span>
          )}
          {action}
        </div>
      </div>

      <div className="min-w-0 p-4">{children}</div>
    </section>
  );
}

function EmptyState({
  icon: Icon,
  title,
  hint,
  action,
}: {
  icon: typeof Users;
  title: string;
  hint?: string;
  action?: ReactNode;
}) {
  return (
    <div className="flex flex-col items-center justify-center gap-3 rounded-2xl border border-dashed border-white/10 bg-white/[0.02] px-6 py-12 text-center">
      <Icon size={26} className="text-white/20" />

      <p className="text-sm text-white/50">{title}</p>

      {hint && <p className="max-w-sm text-xs text-white/30">{hint}</p>}

      {action}
    </div>
  );
}

function GoldButton({
  onClick,
  children,
  icon: Icon,
  disabled,
  className = "",
}: {
  onClick?: () => void;
  children: ReactNode;
  icon?: typeof Users;
  disabled?: boolean;
  className?: string;
}) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className={`inline-flex shrink-0 items-center justify-center gap-2 rounded-xl border border-[#C8A96B]/40 bg-[#C8A96B]/10 px-3.5 py-2 text-xs font-medium text-[#C8A96B] transition hover:bg-[#C8A96B]/20 disabled:cursor-not-allowed disabled:opacity-40 ${className}`}
    >
      {Icon && <Icon size={14} className="shrink-0" />}
      {children}
    </button>
  );
}

function IconButton({
  onClick,
  label,
  icon: Icon,
  tone = "neutral",
}: {
  onClick: () => void;
  label: string;
  icon: typeof Users;
  tone?: "neutral" | "danger";
}) {
  return (
    <button
      onClick={onClick}
      title={label}
      aria-label={label}
      className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-lg border transition ${
        tone === "danger"
          ? "border-white/10 text-white/40 hover:border-red-400/50 hover:bg-red-500/10 hover:text-red-300"
          : "border-white/10 text-white/40 hover:border-[#C8A96B]/50 hover:bg-[#C8A96B]/10 hover:text-[#C8A96B]"
      }`}
    >
      <Icon size={13} />
    </button>
  );
}

function Chip({
  children,
  tone = "muted",
}: {
  children: ReactNode;
  tone?: "muted" | "gold";
}) {
  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-[10px] uppercase tracking-wider ${
        tone === "gold"
          ? "border border-[#C8A96B]/30 bg-[#C8A96B]/10 text-[#C8A96B]"
          : "border border-white/10 bg-white/5 text-white/50"
      }`}
    >
      {children}
    </span>
  );
}

/* ------------------------------------------------------------------ */
/*  FORMULARIOS                                                        */
/* ------------------------------------------------------------------ */

const FIELD_CLASS =
  "w-full rounded-xl border border-white/10 bg-[#0B0F14] px-4 py-3 text-sm text-white placeholder-white/25 outline-none transition hover:border-white/20 focus:border-[#C8A96B] focus:ring-2 focus:ring-[#C8A96B]/20";

function Field({
  label,
  children,
  hint,
  className = "",
}: {
  label: string;
  children: ReactNode;
  hint?: string;
  className?: string;
}) {
  return (
    <div className={`min-w-0 space-y-2 ${className}`}>
      <div className="flex items-baseline justify-between gap-3">
        <span className="text-[10px] font-semibold uppercase tracking-[0.25em] text-white/40">
          {label}
        </span>

        {hint && <span className="text-[10px] text-white/25">{hint}</span>}
      </div>

      {children}
    </div>
  );
}

function FormModal({
  title,
  subtitle,
  onClose,
  onSubmit,
  submitLabel,
  saving,
  children,
  maxWidth = "max-w-3xl",
}: {
  title: string;
  subtitle?: string;
  onClose: () => void;
  onSubmit: () => void;
  submitLabel: string;
  saving: boolean;
  children: ReactNode;
  maxWidth?: string;
}) {
  return (
    <div
      className="fixed inset-0 z-[999999] flex items-center justify-center bg-black/80 p-3 backdrop-blur-sm sm:p-6"
      onClick={onClose}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className={`flex max-h-[92dvh] w-full ${maxWidth} min-w-0 flex-col overflow-hidden rounded-3xl border border-white/10 bg-[#11161D] shadow-2xl`}
      >
        <div className="flex min-w-0 shrink-0 items-center justify-between gap-4 border-b border-white/10 px-5 py-4">
          <div className="min-w-0">
            <h3 className="truncate text-lg font-semibold text-white">
              {title}
            </h3>

            {subtitle && (
              <p className="mt-0.5 truncate text-xs text-white/40">{subtitle}</p>
            )}
          </div>

          <button
            onClick={onClose}
            aria-label="Cerrar"
            className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-white/50 transition hover:bg-white/10 hover:text-white"
          >
            <X size={16} />
          </button>
        </div>

        <div className="min-w-0 flex-1 overflow-y-auto px-5 py-5">
          {children}
        </div>

        <div className="flex shrink-0 items-center justify-end gap-3 border-t border-white/10 px-5 py-4">
          <button
            onClick={onClose}
            className="rounded-xl border border-white/10 px-4 py-2.5 text-sm text-white/60 transition hover:border-white/30 hover:text-white"
          >
            Cancelar
          </button>

          <button
            onClick={onSubmit}
            disabled={saving}
            className="inline-flex items-center gap-2 rounded-xl bg-[#C8A96B] px-5 py-2.5 text-sm font-medium text-black transition hover:bg-[#d8bd82] disabled:cursor-not-allowed disabled:opacity-60"
          >
            {saving && <Loader2 size={14} className="animate-spin" />}
            {saving ? "Guardando..." : submitLabel}
          </button>
        </div>
      </div>
    </div>
  );
}

/* Texto largo del perfil / informe, con aviso cuando aún no hay contenido. */
function ProfileText({ text }: { text?: string }) {
  const clean = (text || "").trim();

  const empty =
    !clean ||
    clean === DEFAULT_CON_BALON ||
    clean === DEFAULT_SIN_BALON ||
    clean === DEFAULT_MENTAL;

  if (empty) {
    return (
      <p className="text-sm italic text-white/25">Contenido por definir</p>
    );
  }

  return (
    <p className="whitespace-pre-line text-sm leading-relaxed text-white/70">
      {clean}
    </p>
  );
}

function PlayerCard({
  player,
  onSelect,
}: {
  player: MergedPlayer;
  onSelect: (player: MergedPlayer) => void;
}) {
  return (
    <button
      onClick={() => onSelect(player)}
      className={`group relative flex min-w-0 flex-col overflow-hidden rounded-2xl border text-left transition hover:-translate-y-0.5 hover:border-[#C8A96B]/50 hover:shadow-lg hover:shadow-black/40 ${
        player.externo
          ? "border-dashed border-[#C8A96B]/40 bg-[#C8A96B]/[0.04]"
          : "border-white/10 bg-white/[0.025]"
      }`}
    >
      <div className="relative aspect-[3/4] w-full overflow-hidden bg-[#0B0F14]">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={player.photo}
          alt={player.name}
          loading="lazy"
          className="h-full w-full object-cover object-top transition duration-500 group-hover:scale-[1.04]"
        />

        <div className="absolute inset-0 bg-gradient-to-t from-[#0B0F14] via-[#0B0F14]/25 to-transparent" />

        {player.externo && (
          <span className="absolute right-1.5 top-1.5 rounded-full bg-[#C8A96B] px-1.5 py-0.5 text-[8px] font-bold uppercase text-black">
            Otro
          </span>
        )}

        {player.score > 0 && (
          <span
            className="absolute left-1.5 top-1.5 rounded-full border px-1.5 py-0.5 text-[10px] font-semibold tabular-nums backdrop-blur"
            style={{
              color: scoreColor(player.score),
              borderColor: `${scoreColor(player.score)}55`,
              background: "rgba(0,0,0,0.55)",
            }}
          >
            {player.score.toFixed(1)}
          </span>
        )}

        <div className="absolute inset-x-0 bottom-0 min-w-0 p-2.5">
          <h3 className="truncate text-sm font-semibold leading-tight">
            {player.name}
          </h3>

          <p className="truncate text-[9px] uppercase tracking-[0.2em] text-white/40">
            {player.position}
          </p>
        </div>
      </div>

      <div className="flex min-w-0 items-center justify-between gap-1 border-t border-white/10 bg-white/[0.02] px-2.5 py-2">
        <span
          className={`flex items-center gap-1 text-[10px] tabular-nums ${
            player.sessions ? "text-white/60" : "text-white/20"
          }`}
          title={`${player.sessions} sesiones de seguimiento`}
        >
          <ClipboardList size={11} />
          {player.sessions}
        </span>

        <span
          className={`flex items-center gap-1 text-[10px] tabular-nums ${
            player.videos ? "text-white/60" : "text-white/20"
          }`}
          title={`${player.videos} vídeos`}
        >
          <Video size={11} />
          {player.videos}
        </span>

        <span
          className={
            player.hasReport ? "text-[#C8A96B]" : "text-white/20"
          }
          title={player.hasReport ? "Con informe" : "Sin informe"}
        >
          <FileText size={11} />
        </span>
      </div>
    </button>
  );
}

/* ------------------------------------------------------------------ */
/*  PÁGINA                                                             */
/* ------------------------------------------------------------------ */

const TABS: { key: TabKey; label: string }[] = [
  { key: "perfil", label: "Perfil" },
  { key: "seguimiento", label: "Seguimiento" },
  { key: "valoraciones", label: "Valoraciones" },
  { key: "videos", label: "Vídeos" },
  { key: "informe", label: "Informe" },
];

export default function IndividualPage() {
  /* ---------------- datos remotos ---------------- */

  const { season: ratingsSeason, loading: loadingRatings } = useRatingsSeason();

  const [sheetData, setSheetData] = useState<Record<string, string>[]>([]);
  const [trackingData, setTrackingData] = useState<TrackingRecord[]>([]);
  const [videoData, setVideoData] = useState<VideoItem[]>([]);
  const [reportData, setReportData] = useState<ReportItem[]>([]);

  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState("");
  const [reloadKey, setReloadKey] = useState(0);

  /* ---------------- listado ---------------- */

  const [search, setSearch] = useState("");
  const [lineFilter, setLineFilter] = useState("todas");
  const [teamFilter, setTeamFilter] = useState<
    "todos" | "castilla" | "externos"
  >("todos");
  const [sortBy, setSortBy] = useState<
    "posicion" | "nombre" | "seguimientos" | "valoracion"
  >("posicion");

  /* ---------------- ficha ---------------- */

  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<TabKey>("perfil");
  const [videoCategory, setVideoCategory] = useState("todas");
  const [playingVideo, setPlayingVideo] = useState<string | null>(null);
  const [touchStart, setTouchStart] = useState<{ x: number; y: number } | null>(
    null,
  );

  /* ---------------- formularios ---------------- */

  const [showTrackingForm, setShowTrackingForm] = useState(false);
  const [editingTracking, setEditingTracking] = useState<TrackingRecord | null>(
    null,
  );
  const [trackingForm, setTrackingForm] = useState({
    FECHA: "",
    OBJETIVO_OFENSIVO: "",
    OBJETIVO_DEFENSIVO: "",
    OBJETIVO_MENTAL: "",
    FEEDBACK: "",
    QUIEN: "",
    MODALIDAD: "",
    MOMENTO: "",
    ESTRATEGIA: "",
  });

  const [showProfileForm, setShowProfileForm] = useState(false);
  const [profileForm, setProfileForm] = useState({
    conBalon: "",
    sinBalon: "",
    mental: "",
    hudlPerfilUrl: "",
    mentalidad: "",
    habitos: "",
    interpretacion: "",
    capacidadFisica: "",
    tecnica: "",
  });

  const [showVideoForm, setShowVideoForm] = useState(false);
  const [editingVideo, setEditingVideo] = useState<VideoItem | null>(null);
  const [videoForm, setVideoForm] = useState({
    CATEGORIA: "",
    TITULO: "",
    DESCRIPCION: "",
    URL_VIDEO: "",
    FECHA: "",
  });

  const [showReportForm, setShowReportForm] = useState(false);
  const [reportForm, setReportForm] = useState({
    RESUMEN_EJECUTIVO: "",
    FORTALEZAS_INFORME: "",
    ASPECTOS_MEJORA_INFORME: "",
    OBJETIVOS: "",
    OBSERVACIONES_FINALES: "",
  });

  const [saving, setSaving] = useState(false);

  const anyFormOpen =
    showTrackingForm || showProfileForm || showVideoForm || showReportForm;

  /* ---------------- carga de datos ---------------- */

  useEffect(() => {
    let cancelled = false;

    async function loadData() {
      setLoading(true);
      setLoadError("");

      const results = await Promise.allSettled([
        fetch(`${APPS_SCRIPT_URL}?action=jugadores`).then((r) => r.json()),
        fetch(`${APPS_SCRIPT_URL}?action=seguimiento`).then((r) => r.json()),
        fetch(SHEET_VIDEOS).then((r) => r.text()),
        fetch(SHEET_INFORMES).then((r) => r.text()),
      ]);

      if (cancelled) return;

      const jugadores =
        results[0].status === "fulfilled" ? results[0].value : null;

      const seguimiento =
        results[1].status === "fulfilled" ? results[1].value : null;

      const videos = results[2].status === "fulfilled" ? results[2].value : "";
      const informes =
        results[3].status === "fulfilled" ? results[3].value : "";

      setSheetData(
        Array.isArray(jugadores) ? jugadores : jugadores?.data || [],
      );

      setTrackingData(Array.isArray(seguimiento) ? seguimiento : []);
      setVideoData(parseCSV(videos) as VideoItem[]);
      setReportData(parseCSV(informes) as ReportItem[]);

      if (results.some((r) => r.status === "rejected")) {
        setLoadError(
          "No se han podido cargar todos los datos. Revisa la conexión y vuelve a intentarlo.",
        );
      }

      /* Enlace directo /individual?player=JUG-XX */
      const wanted = new URLSearchParams(window.location.search).get("player");

      if (wanted && players.some((p) => p.idJugador === wanted)) {
        setSelectedId(wanted);
        setActiveTab("perfil");

        window.history.replaceState({}, "", "/individual");
      }

      setLoading(false);
    }

    loadData();

    return () => {
      cancelled = true;
    };
  }, [reloadKey]);

  /* ---------------- derivados ---------------- */

  const mergedPlayers = useMemo<MergedPlayer[]>(() => {
    return players.map((p) => {
      const row = sheetData.find((r) => r.ID_JUGADOR === p.idJugador) || {};

      const sessions = trackingData.filter(
        (t) => t.ID_JUGADOR === p.idJugador,
      );

      const dates = sessions
        .map((s) => parseDate(s.FECHA))
        .filter((d): d is Date => Boolean(d));

      const base = {
        ...p,

        conBalon: row.CON_BALON || DEFAULT_CON_BALON,
        sinBalon: row.SIN_BALON || DEFAULT_SIN_BALON,
        mental: row.MENTAL || DEFAULT_MENTAL,
        hudlPerfilUrl: row.HUDL_PERFIL_URL || "",

        mentalidad: Number(row.MENTALIDAD || 0),
        habitos: Number(row.HABITOS || 0),
        interpretacion: Number(row.INTERPRETACION || 0),
        capacidadFisica: Number(row.CAPACIDAD_FISICA || 0),
        tecnica: Number(row.TECNICA || 0),
      };

      return {
        ...base,

        sessions: sessions.length,
        videos: videoData.filter((v) => v.ID_JUGADOR === p.idJugador).length,
        hasReport: reportData.some((r) => r.ID_JUGADOR === p.idJugador),
        score: averageScore(base),
        lastSession: dates.length
          ? new Date(Math.max(...dates.map((d) => d.getTime())))
          : null,
      };
    });
  }, [sheetData, trackingData, videoData, reportData]);

  /* La ficha se deriva del id: así nunca queda desfasada tras editar o recargar. */
  const selected = useMemo(
    () => mergedPlayers.find((p) => p.idJugador === selectedId) ?? null,
    [mergedPlayers, selectedId],
  );

  useBodyScrollLock(Boolean(selected));

  /* Cambiar de jugador reinicia el estado propio de las pestañas. */
  const goToPlayer = useCallback((player: MergedPlayer) => {
    setSelectedId(player.idJugador);
    setVideoCategory("todas");
    setPlayingVideo(null);
  }, []);

  const closePlayer = useCallback(() => {
    setSelectedId(null);
    setVideoCategory("todas");
    setPlayingVideo(null);
  }, []);

  const stats = useMemo(() => {
    const rated = mergedPlayers.filter((p) => p.score > 0);

    return {
      players: mergedPlayers.length,
      tracked: mergedPlayers.filter((p) => p.sessions > 0).length,
      sessions: trackingData.length,
      videos: videoData.length,
      reports: reportData.length,
      avg: rated.length
        ? rated.reduce((acc, p) => acc + p.score, 0) / rated.length
        : 0,
    };
  }, [mergedPlayers, trackingData, videoData, reportData]);

  /* Lista tras buscador y filtro de equipo: alimenta también los contadores. */
  const baseList = useMemo(() => {
    const query = normalize(search);

    return mergedPlayers.filter((p) => {
      if (
        query &&
        !normalize(p.name).includes(query) &&
        !normalize(p.position).includes(query)
      ) {
        return false;
      }

      if (teamFilter === "castilla" && p.externo) return false;
      if (teamFilter === "externos" && !p.externo) return false;

      return true;
    });
  }, [mergedPlayers, search, teamFilter]);

  const filtered = useMemo(() => {
    const list = baseList.filter(
      (p) => lineFilter === "todas" || p.position === lineFilter,
    );

    if (sortBy === "nombre") {
      return [...list].sort((a, b) => a.name.localeCompare(b.name, "es"));
    }

    if (sortBy === "seguimientos") {
      return [...list].sort((a, b) => b.sessions - a.sessions);
    }

    if (sortBy === "valoracion") {
      return [...list].sort((a, b) => b.score - a.score);
    }

    return list;
  }, [baseList, lineFilter, sortBy]);

  const hasFilters =
    Boolean(search) || lineFilter !== "todas" || teamFilter !== "todos";

  const currentIndex = selected
    ? mergedPlayers.findIndex((p) => p.idJugador === selected.idJugador)
    : -1;

  const previousPlayer =
    currentIndex >= 0
      ? mergedPlayers[
          (currentIndex - 1 + mergedPlayers.length) % mergedPlayers.length
        ]
      : null;

  const nextPlayer =
    currentIndex >= 0
      ? mergedPlayers[(currentIndex + 1) % mergedPlayers.length]
      : null;

  useEffect(() => {
    if (!selected) return;

    const handleKey = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null;

      const typing =
        target &&
        ["INPUT", "TEXTAREA", "SELECT"].includes(target.tagName);

      if (e.key === "Escape" && !anyFormOpen) {
        closePlayer();
        return;
      }

      if (anyFormOpen || typing) return;

      if (e.key === "ArrowLeft" && previousPlayer) goToPlayer(previousPlayer);
      if (e.key === "ArrowRight" && nextPlayer) goToPlayer(nextPlayer);
    };

    window.addEventListener("keydown", handleKey);

    return () => window.removeEventListener("keydown", handleKey);
  }, [selected, previousPlayer, nextPlayer, anyFormOpen, goToPlayer, closePlayer]);

  const playerTracking = useMemo(() => {
    if (!selected) return [];

    return trackingData
      .filter((item) => item.ID_JUGADOR === selected.idJugador)
      .sort((a, b) => {
        const da = parseDate(a.FECHA)?.getTime() ?? 0;
        const db = parseDate(b.FECHA)?.getTime() ?? 0;

        return db - da;
      });
  }, [trackingData, selected]);

  const trackingGroups = useMemo(() => {
    const groups: { key: string; label: string; items: TrackingRecord[] }[] = [];

    playerTracking.forEach((item) => {
      const date = parseDate(item.FECHA);

      const key = date
        ? `${date.getFullYear()}-${date.getMonth()}`
        : "sin-fecha";

      const label = date
        ? capitalize(
            date.toLocaleDateString("es-ES", {
              month: "long",
              year: "numeric",
            }),
          )
        : "Sin fecha";

      const group = groups.find((g) => g.key === key);

      if (group) group.items.push(item);
      else groups.push({ key, label, items: [item] });
    });

    return groups;
  }, [playerTracking]);

  const playerVideos = useMemo(() => {
    if (!selected) return [];

    return videoData
      .filter((item) => item.ID_JUGADOR === selected.idJugador)
      .sort((a, b) => {
        const da = parseDate(a.FECHA)?.getTime() ?? 0;
        const db = parseDate(b.FECHA)?.getTime() ?? 0;

        return db - da;
      });
  }, [videoData, selected]);

  const videoCategories = useMemo(
    () =>
      Array.from(
        new Set(playerVideos.map((v) => v.CATEGORIA).filter(Boolean)),
      ),
    [playerVideos],
  );

  const shownVideos =
    videoCategory === "todas"
      ? playerVideos
      : playerVideos.filter((v) => v.CATEGORIA === videoCategory);

  const playerReport = selected
    ? reportData.find((item) => item.ID_JUGADOR === selected.idJugador)
    : null;

  const playerRatings = useMemo(
    () => (selected ? playerEntries(ratingsSeason, selected.idJugador) : []),
    [ratingsSeason, selected],
  );

  /* ---------------- acciones ---------------- */

  const openPlayer = (player: MergedPlayer) => {
    goToPlayer(player);
    setActiveTab("perfil");
  };

  const openTrackingForm = (record?: TrackingRecord) => {
    setEditingTracking(record || null);

    setTrackingForm({
      FECHA: record?.FECHA?.split("T")[0] || "",
      OBJETIVO_OFENSIVO: record?.OBJETIVO_OFENSIVO || "",
      OBJETIVO_DEFENSIVO: record?.OBJETIVO_DEFENSIVO || "",
      OBJETIVO_MENTAL: record?.OBJETIVO_MENTAL || "",
      FEEDBACK: record?.FEEDBACK || "",
      QUIEN: record?.QUIEN || "",
      MODALIDAD: record?.MODALIDAD || "",
      MOMENTO: record?.MOMENTO || "",
      ESTRATEGIA: record?.ESTRATEGIA || "",
    });

    setShowTrackingForm(true);
  };

  const openVideoForm = (video?: VideoItem) => {
    setEditingVideo(video || null);

    setVideoForm({
      CATEGORIA: video?.CATEGORIA || "",
      TITULO: video?.TITULO || "",
      DESCRIPCION: video?.DESCRIPCION || "",
      URL_VIDEO: video?.URL_VIDEO || "",
      FECHA: video?.FECHA?.split("T")[0] || "",
    });

    setShowVideoForm(true);
  };

  const openProfileForm = () => {
    if (!selected) return;

    setProfileForm({
      conBalon:
        selected.conBalon === DEFAULT_CON_BALON ? "" : selected.conBalon || "",
      sinBalon:
        selected.sinBalon === DEFAULT_SIN_BALON ? "" : selected.sinBalon || "",
      mental: selected.mental === DEFAULT_MENTAL ? "" : selected.mental || "",
      hudlPerfilUrl: selected.hudlPerfilUrl || "",
      mentalidad: String(selected.mentalidad || ""),
      habitos: String(selected.habitos || ""),
      interpretacion: String(selected.interpretacion || ""),
      capacidadFisica: String(selected.capacidadFisica || ""),
      tecnica: String(selected.tecnica || ""),
    });

    setShowProfileForm(true);
  };

  const openReportForm = () => {
    setReportForm({
      RESUMEN_EJECUTIVO: playerReport?.RESUMEN_EJECUTIVO || "",
      FORTALEZAS_INFORME: playerReport?.FORTALEZAS_INFORME || "",
      ASPECTOS_MEJORA_INFORME: playerReport?.ASPECTOS_MEJORA_INFORME || "",
      OBJETIVOS: playerReport?.OBJETIVOS || "",
      OBSERVACIONES_FINALES: playerReport?.OBSERVACIONES_FINALES || "",
    });

    setShowReportForm(true);
  };

  /* Todas las escrituras van al mismo Apps Script con text/plain. */
  const postToScript = async (payload: Record<string, string>) => {
    const response = await fetch(APPS_SCRIPT_URL, {
      method: "POST",
      headers: { "Content-Type": "text/plain;charset=utf-8" },
      body: JSON.stringify(payload),
    });

    const text = await response.text();

    return JSON.parse(text);
  };

  const saveTracking = async () => {
    if (!selected || saving) return;

    if (!trackingForm.FECHA) {
      toast.error("La fecha es obligatoria");
      return;
    }

    setSaving(true);

    try {
      const payload = editingTracking
        ? {
            action: "editarSeguimiento",
            ID_REGISTRO: editingTracking.ID_REGISTRO,
            ...trackingForm,
          }
        : {
            action: "crearSeguimiento",
            ID_JUGADOR: selected.idJugador,
            ...trackingForm,
          };

      const result = await postToScript(payload);

      if (!result.success) {
        toast.error("Error guardando el seguimiento");
        return;
      }

      if (editingTracking) {
        setTrackingData((prev) =>
          prev.map((r) =>
            r.ID_REGISTRO === editingTracking.ID_REGISTRO
              ? { ...r, ...trackingForm }
              : r,
          ),
        );

        toast.success("Seguimiento actualizado");
      } else {
        setTrackingData((prev) => [
          {
            ID_REGISTRO: result.id,
            ID_JUGADOR: selected.idJugador,
            ...trackingForm,
          },
          ...prev,
        ]);

        toast.success("Seguimiento guardado");
      }

      setEditingTracking(null);
      setShowTrackingForm(false);
    } catch (error) {
      console.error(error);
      toast.error("Error de conexión");
    } finally {
      setSaving(false);
    }
  };

  const saveVideo = async () => {
    if (!selected || saving) return;

    if (!videoForm.TITULO.trim() || !videoForm.URL_VIDEO.trim()) {
      toast.error("Título y URL son obligatorios");
      return;
    }

    setSaving(true);

    try {
      const payload = editingVideo
        ? {
            action: "editarVideo",
            ID_VIDEO: editingVideo.ID_VIDEO,
            ...videoForm,
          }
        : {
            action: "crearVideo",
            ID_JUGADOR: selected.idJugador,
            ...videoForm,
          };

      const result = await postToScript(payload);

      if (!result.success) {
        toast.error("Error guardando el vídeo");
        return;
      }

      if (editingVideo) {
        setVideoData((prev) =>
          prev.map((v) =>
            v.ID_VIDEO === editingVideo.ID_VIDEO ? { ...v, ...videoForm } : v,
          ),
        );

        toast.success("Vídeo actualizado");
      } else {
        setVideoData((prev) => [
          {
            ID_VIDEO: result.id,
            ID_JUGADOR: selected.idJugador,
            ...videoForm,
          },
          ...prev,
        ]);

        toast.success("Vídeo guardado");
      }

      setEditingVideo(null);
      setShowVideoForm(false);
    } catch (error) {
      console.error(error);
      toast.error("Error guardando el vídeo");
    } finally {
      setSaving(false);
    }
  };

  const saveProfile = async () => {
    if (!selected || saving) return;

    setSaving(true);

    try {
      const result = await postToScript({
        action: "editarPerfil",
        ID_JUGADOR: selected.idJugador,

        CON_BALON: profileForm.conBalon,
        SIN_BALON: profileForm.sinBalon,
        MENTAL: profileForm.mental,
        HUDL_PERFIL_URL: profileForm.hudlPerfilUrl,

        MENTALIDAD: profileForm.mentalidad,
        HABITOS: profileForm.habitos,
        INTERPRETACION: profileForm.interpretacion,
        CAPACIDAD_FISICA: profileForm.capacidadFisica,
        TECNICA: profileForm.tecnica,
      });

      if (!result.success) {
        toast.error("Error guardando el perfil");
        return;
      }

      setSheetData((prev) => {
        const exists = prev.some(
          (row) => row.ID_JUGADOR === selected.idJugador,
        );

        const patch = {
          CON_BALON: profileForm.conBalon,
          SIN_BALON: profileForm.sinBalon,
          MENTAL: profileForm.mental,
          HUDL_PERFIL_URL: profileForm.hudlPerfilUrl,
          MENTALIDAD: profileForm.mentalidad,
          HABITOS: profileForm.habitos,
          INTERPRETACION: profileForm.interpretacion,
          CAPACIDAD_FISICA: profileForm.capacidadFisica,
          TECNICA: profileForm.tecnica,
        };

        if (exists) {
          return prev.map((row) =>
            row.ID_JUGADOR === selected.idJugador ? { ...row, ...patch } : row,
          );
        }

        return [...prev, { ID_JUGADOR: selected.idJugador, ...patch }];
      });

      setShowProfileForm(false);
      toast.success("Perfil actualizado");
    } catch (error) {
      console.error(error);
      toast.error("Error guardando el perfil");
    } finally {
      setSaving(false);
    }
  };

  const saveReport = async () => {
    if (!selected || saving) return;

    setSaving(true);

    try {
      const result = await postToScript({
        action: "editarInforme",
        ID_JUGADOR: selected.idJugador,
        ...reportForm,
      });

      if (!result.success) {
        toast.error("Error guardando el informe");
        return;
      }

      setReportData((prev) => {
        const exists = prev.some((r) => r.ID_JUGADOR === selected.idJugador);

        if (exists) {
          return prev.map((r) =>
            r.ID_JUGADOR === selected.idJugador ? { ...r, ...reportForm } : r,
          );
        }

        return [...prev, { ID_JUGADOR: selected.idJugador, ...reportForm }];
      });

      setShowReportForm(false);
      toast.success("Informe guardado");
    } catch (error) {
      console.error(error);
      toast.error("Error guardando el informe");
    } finally {
      setSaving(false);
    }
  };

  const deleteTracking = async (idRegistro: string) => {
    if (!confirm("¿Eliminar este seguimiento?")) return;

    try {
      const result = await postToScript({
        action: "eliminarSeguimiento",
        ID_REGISTRO: idRegistro,
      });

      if (!result.success) {
        toast.error("No se ha podido eliminar");
        return;
      }

      setTrackingData((prev) =>
        prev.filter((r) => r.ID_REGISTRO !== idRegistro),
      );

      toast.success("Seguimiento eliminado");
    } catch (error) {
      console.error(error);
      toast.error("Error de conexión");
    }
  };

  const deleteVideo = async (idVideo: string) => {
    if (!confirm("¿Eliminar este vídeo?")) return;

    try {
      const result = await postToScript({
        action: "eliminarVideo",
        ID_VIDEO: idVideo,
      });

      if (!result.success) {
        toast.error("No se ha podido eliminar");
        return;
      }

      setVideoData((prev) => prev.filter((v) => v.ID_VIDEO !== idVideo));

      toast.success("Vídeo eliminado");
    } catch (error) {
      console.error(error);
      toast.error("Error de conexión");
    }
  };

  /* ---------------- bloques de la ficha ---------------- */

  const radarData = selected
    ? METRICS.map((m) => ({
        subject: m.short,
        value: Number(selected[m.key] || 0),
      }))
    : [];

  const competencePanel = selected && (
    <Panel title="Perfil competencial" icon={Gauge}>
      <div className="mb-3 flex items-center gap-3">
        <ScoreRing value={selected.score} />

        <div className="min-w-0">
          <p className="text-[10px] uppercase tracking-[0.25em] text-white/40">
            Media
          </p>

          <p className="text-xs text-white/40">
            {selected.score
              ? "Sobre las competencias valoradas"
              : "Sin valoración registrada"}
          </p>
        </div>
      </div>

      <div className="h-[220px] w-full min-w-0">
        <ResponsiveContainer width="100%" height="100%">
          <RadarChart data={radarData} outerRadius="72%">
            <PolarGrid stroke="rgba(255,255,255,0.12)" />

            <PolarAngleAxis
              dataKey="subject"
              tick={{ fill: "rgba(255,255,255,0.55)", fontSize: 10 }}
            />

            <PolarRadiusAxis domain={[0, 10]} tick={false} axisLine={false} />

            <Radar
              dataKey="value"
              stroke={GOLD}
              fill={GOLD}
              fillOpacity={0.35}
            />
          </RadarChart>
        </ResponsiveContainer>
      </div>

      <div className="mt-3 space-y-2.5">
        {METRICS.map((metric) => {
          const value = Number(selected[metric.key] || 0);

          return (
            <div key={metric.key}>
              <div className="mb-1 flex items-baseline justify-between gap-2 text-[11px]">
                <span className="truncate text-white/50">{metric.label}</span>

                <span className="shrink-0 tabular-nums text-white/70">
                  {value || "—"}
                  <span className="text-white/25">/10</span>
                </span>
              </div>

              <div className="h-1.5 overflow-hidden rounded-full bg-white/[0.07]">
                <div
                  className="h-full rounded-full transition-all duration-500"
                  style={{
                    width: `${Math.max(0, Math.min(10, value)) * 10}%`,
                    background: scoreColor(value),
                  }}
                />
              </div>
            </div>
          );
        })}
      </div>
    </Panel>
  );

  const quickFacts = selected && (
    <div className="grid grid-cols-3 gap-2">
      {[
        {
          icon: ClipboardList,
          label: "Sesiones",
          value: selected.sessions,
        },
        { icon: Video, label: "Vídeos", value: selected.videos },
        {
          icon: FileText,
          label: "Informe",
          value: selected.hasReport ? "Sí" : "—",
        },
      ].map((fact) => (
        <div
          key={fact.label}
          className="min-w-0 rounded-xl border border-white/10 bg-white/[0.025] px-3 py-2.5 text-center"
        >
          <fact.icon size={13} className="mx-auto text-[#C8A96B]" />

          <p className="mt-1 text-base font-semibold tabular-nums">
            {fact.value}
          </p>

          <p className="truncate text-[9px] uppercase tracking-[0.2em] text-white/30">
            {fact.label}
          </p>
        </div>
      ))}
    </div>
  );

  /* ---------------- render ---------------- */

  return (
    <>
      <main className="min-h-screen overflow-x-hidden bg-[#0B0F14] text-white">
        <div className="flex min-h-screen w-full">
          <Sidebar />

          <section className="min-w-0 flex-1">
            <Topbar />

            <div className="w-full min-w-0 px-4 py-6 sm:px-6 md:px-8 md:py-8">
              {/* CABECERA */}

              <p className="text-xs uppercase tracking-[0.35em] text-[#C8A96B]">
                RMCF CASTILLA · INDIVIDUAL
              </p>

              <div className="mt-4 flex min-w-0 items-center gap-4">
                <h1 className="min-w-0 truncate text-2xl font-semibold md:text-4xl">
                  Seguimiento
                </h1>

                <div className="hidden h-px min-w-0 flex-1 bg-gradient-to-r from-[#C8A96B]/30 via-white/10 to-transparent md:block" />

                <button
                  onClick={() => setReloadKey((k) => k + 1)}
                  className="flex shrink-0 items-center gap-2 rounded-xl border border-white/10 px-3 py-2 text-xs text-white/50 transition hover:border-[#C8A96B] hover:text-white"
                >
                  <RotateCcw size={13} />
                  <span className="hidden sm:inline">Actualizar</span>
                </button>
              </div>

              {loadError && (
                <div className="mt-6 flex flex-wrap items-center gap-4 rounded-2xl border border-red-500/30 bg-red-500/10 p-4 text-sm text-red-200">
                  <AlertTriangle size={16} className="shrink-0" />

                  <span className="min-w-0 flex-1">{loadError}</span>

                  <button
                    onClick={() => setReloadKey((k) => k + 1)}
                    className="flex items-center gap-2 rounded-xl border border-red-400/40 px-4 py-2 transition hover:bg-red-500/20"
                  >
                    <RotateCcw size={14} />
                    Reintentar
                  </button>
                </div>
              )}

              {/* INDICADORES */}

              <div className="mt-8 grid min-w-0 grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-5">
                <StatTile
                  icon={Users}
                  label="Jugadores"
                  value={stats.players}
                  hint={`${stats.tracked} con seguimiento`}
                />

                <StatTile
                  icon={ClipboardList}
                  label="Sesiones"
                  value={stats.sessions}
                  hint="Registros de seguimiento"
                />

                <StatTile
                  icon={Video}
                  label="Vídeos"
                  value={stats.videos}
                  hint="Clips individuales"
                />

                <StatTile
                  icon={FileText}
                  label="Informes"
                  value={stats.reports}
                  hint="Fichas completadas"
                />

                <StatTile
                  icon={Gauge}
                  label="Media plantilla"
                  value={stats.avg ? stats.avg.toFixed(1) : "—"}
                  hint="Competencias valoradas"
                />
              </div>

              {/* FILTROS */}

              <div className="mt-6 grid min-w-0 gap-3 lg:grid-cols-[minmax(0,1fr)_auto]">
                <div className="flex min-w-0 items-center gap-3 rounded-2xl border border-white/10 bg-white/[0.025] px-4 py-3 transition focus-within:border-[#C8A96B]/60">
                  <Search size={16} className="shrink-0 text-white/30" />

                  <input
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    placeholder="Buscar jugador o posición..."
                    className="w-full min-w-0 bg-transparent text-sm outline-none placeholder:text-white/25"
                  />

                  {search && (
                    <button
                      onClick={() => setSearch("")}
                      className="shrink-0 text-white/30 transition hover:text-white"
                    >
                      <X size={14} />
                    </button>
                  )}
                </div>

                <div className="flex min-w-0 flex-wrap items-center gap-3">
                  <div className="flex shrink-0 rounded-2xl border border-white/10 bg-white/[0.025] p-1">
                    {[
                      { key: "todos", label: "Todos" },
                      { key: "castilla", label: "Castilla" },
                      { key: "externos", label: "Otros" },
                    ].map((option) => (
                      <button
                        key={option.key}
                        onClick={() =>
                          setTeamFilter(option.key as typeof teamFilter)
                        }
                        className={`rounded-xl px-3 py-2 text-xs transition ${
                          teamFilter === option.key
                            ? "bg-[#C8A96B] text-black"
                            : "text-white/50 hover:text-white"
                        }`}
                      >
                        {option.label}
                      </button>
                    ))}
                  </div>

                  <select
                    value={sortBy}
                    onChange={(e) =>
                      setSortBy(e.target.value as typeof sortBy)
                    }
                    className="shrink-0 rounded-2xl border border-white/10 bg-[#0B0F14] px-3 py-2.5 text-xs text-white/70 outline-none transition hover:border-white/25 focus:border-[#C8A96B]"
                  >
                    <option value="posicion">Por posición</option>
                    <option value="nombre">Por nombre</option>
                    <option value="seguimientos">Más seguidos</option>
                    <option value="valoracion">Mejor valorados</option>
                  </select>
                </div>
              </div>

              {/* LÍNEAS */}

              <div className="mt-4 flex min-w-0 flex-wrap items-center gap-2">
                <button
                  onClick={() => setLineFilter("todas")}
                  className={`flex shrink-0 items-center gap-2 rounded-full border px-3.5 py-1.5 text-xs transition ${
                    lineFilter === "todas"
                      ? "border-[#C8A96B] bg-[#C8A96B]/10 text-[#C8A96B]"
                      : "border-white/10 text-white/50 hover:border-white/30 hover:text-white"
                  }`}
                >
                  Todas
                  <span className="rounded-full bg-white/5 px-1.5 py-0.5 text-[10px] tabular-nums">
                    {baseList.length}
                  </span>
                </button>

                {LINES.map((line) => {
                  const count = baseList.filter(
                    (p) => p.position === line.key,
                  ).length;

                  return (
                    <button
                      key={line.key}
                      onClick={() => setLineFilter(line.key)}
                      className={`flex shrink-0 items-center gap-2 rounded-full border px-3.5 py-1.5 text-xs transition ${
                        lineFilter === line.key
                          ? "border-[#C8A96B] bg-[#C8A96B]/10 text-[#C8A96B]"
                          : "border-white/10 text-white/50 hover:border-white/30 hover:text-white"
                      }`}
                    >
                      <span
                        className="h-1.5 w-1.5 shrink-0 rounded-full"
                        style={{ background: line.color }}
                      />

                      {line.title}

                      <span className="rounded-full bg-white/5 px-1.5 py-0.5 text-[10px] tabular-nums">
                        {count}
                      </span>
                    </button>
                  );
                })}

                {hasFilters && (
                  <button
                    onClick={() => {
                      setSearch("");
                      setLineFilter("todas");
                      setTeamFilter("todos");
                    }}
                    className="flex shrink-0 items-center gap-1.5 rounded-full border border-white/10 px-3 py-1.5 text-xs text-white/40 transition hover:border-white/30 hover:text-white"
                  >
                    <X size={12} />
                    Limpiar
                  </button>
                )}
              </div>

              {/* PLANTILLA */}

              {loading ? (
                <div className="mt-8 grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6">
                  {Array.from({ length: 12 }).map((_, i) => (
                    <div
                      key={i}
                      className="overflow-hidden rounded-2xl border border-white/10 bg-white/[0.025]"
                    >
                      <div className="aspect-[3/4] w-full animate-pulse bg-white/[0.05]" />

                      <div className="space-y-2 p-3">
                        <div className="h-3 w-2/3 animate-pulse rounded bg-white/[0.07]" />
                        <div className="h-2 w-1/2 animate-pulse rounded bg-white/[0.05]" />
                      </div>
                    </div>
                  ))}
                </div>
              ) : filtered.length === 0 ? (
                <div className="mt-8">
                  <EmptyState
                    icon={Search}
                    title="Ningún jugador coincide con la búsqueda"
                    hint="Prueba con otro nombre o quita los filtros activos."
                    action={
                      hasFilters ? (
                        <GoldButton
                          icon={RotateCcw}
                          onClick={() => {
                            setSearch("");
                            setLineFilter("todas");
                            setTeamFilter("todos");
                          }}
                        >
                          Limpiar filtros
                        </GoldButton>
                      ) : undefined
                    }
                  />
                </div>
              ) : sortBy === "posicion" ? (
                <div className="mt-8 space-y-6">
                  {LINES.map((line) => {
                    const linePlayers = filtered.filter(
                      (p) => p.position === line.key,
                    );

                    if (!linePlayers.length) return null;

                    return (
                      <section key={line.key} className="min-w-0">
                        <div className="mb-4 flex min-w-0 items-center gap-3">
                          <span
                            className="h-2 w-2 shrink-0 rounded-full"
                            style={{ background: line.color }}
                          />

                          <h2 className="shrink-0 text-xs font-semibold uppercase tracking-[0.25em] text-[#C8A96B]">
                            {line.title}
                          </h2>

                          <div className="h-px min-w-0 flex-1 bg-white/10" />

                          <span className="shrink-0 text-xs tabular-nums text-white/25">
                            {linePlayers.length}
                          </span>
                        </div>

                        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6">
                          {linePlayers.map((player) => (
                            <PlayerCard
                              key={player.idJugador}
                              player={player}
                              onSelect={openPlayer}
                            />
                          ))}
                        </div>
                      </section>
                    );
                  })}
                </div>
              ) : (
                <div className="mt-8 grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6">
                  {filtered.map((player) => (
                    <PlayerCard
                      key={player.idJugador}
                      player={player}
                      onSelect={openPlayer}
                    />
                  ))}
                </div>
              )}
            </div>
          </section>
        </div>
      </main>

      {/* ================= FICHA DEL JUGADOR ================= */}

      {selected &&
        createPortal(
          <div
            className="fixed inset-0 z-[99999] flex items-center justify-center bg-black/80 p-2 backdrop-blur-sm sm:p-4 md:p-6"
            onClick={closePlayer}
          >
            <div
              onClick={(e) => e.stopPropagation()}
              onTouchStart={(e) =>
                setTouchStart({
                  x: e.touches[0].clientX,
                  y: e.touches[0].clientY,
                })
              }
              onTouchEnd={(e) => {
                if (!touchStart) return;

                const dx = touchStart.x - e.changedTouches[0].clientX;
                const dy = touchStart.y - e.changedTouches[0].clientY;

                /* Sólo se navega si el gesto es claramente horizontal. */
                if (Math.abs(dx) > 70 && Math.abs(dx) > Math.abs(dy) * 2) {
                  if (dx > 0 && nextPlayer) goToPlayer(nextPlayer);
                  if (dx < 0 && previousPlayer) goToPlayer(previousPlayer);
                }

                setTouchStart(null);
              }}
              className="relative flex h-[95dvh] w-full min-w-0 max-w-6xl flex-col overflow-hidden rounded-3xl border border-white/10 bg-[#11161D] shadow-2xl"
            >
              {/* CABECERA */}

              <div className="flex min-w-0 shrink-0 items-center justify-between gap-3 border-b border-white/10 px-3 py-3 sm:px-5 sm:py-4">
                <div className="flex min-w-0 items-center gap-2 sm:gap-3">
                  <button
                    onClick={() => previousPlayer && goToPlayer(previousPlayer)}
                    aria-label="Jugador anterior"
                    className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-white/10 text-white/50 transition hover:border-[#C8A96B] hover:text-[#C8A96B]"
                  >
                    <ChevronLeft size={16} />
                  </button>

                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={selected.photo}
                    alt={selected.name}
                    className="hidden h-11 w-11 shrink-0 rounded-xl border border-white/10 object-cover object-top sm:block"
                  />

                  <div className="min-w-0">
                    <p className="truncate text-[10px] uppercase tracking-[0.25em] text-[#C8A96B]">
                      {selected.position}

                      {selected.externo && (
                        <span className="ml-2 text-white/30">· Otro equipo</span>
                      )}
                    </p>

                    <h2 className="truncate text-lg font-semibold sm:text-2xl">
                      {selected.name}
                    </h2>
                  </div>

                  <button
                    onClick={() => nextPlayer && goToPlayer(nextPlayer)}
                    aria-label="Jugador siguiente"
                    className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-white/10 text-white/50 transition hover:border-[#C8A96B] hover:text-[#C8A96B]"
                  >
                    <ChevronRight size={16} />
                  </button>
                </div>

                <div className="flex shrink-0 items-center gap-3">
                  <span className="hidden rounded-full border border-white/10 px-3 py-1 text-xs tabular-nums text-white/40 sm:inline">
                    {currentIndex + 1} / {mergedPlayers.length}
                  </span>

                  <button
                    onClick={closePlayer}
                    aria-label="Cerrar ficha"
                    className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-white/50 transition hover:bg-white/10 hover:text-white"
                  >
                    <X size={16} />
                  </button>
                </div>
              </div>

              {/* PESTAÑAS */}

              <div className="shrink-0 border-b border-white/10 px-3 sm:px-5">
                <div className="flex min-w-0 gap-1 overflow-x-auto">
                  {TABS.map((tab) => {
                    const count =
                      tab.key === "seguimiento"
                        ? playerTracking.length
                        : tab.key === "videos"
                          ? playerVideos.length
                          : tab.key === "valoraciones"
                            ? playerRatings.length
                            : null;

                    const active = activeTab === tab.key;

                    return (
                      <button
                        key={tab.key}
                        onClick={() => setActiveTab(tab.key)}
                        className={`relative flex shrink-0 items-center gap-2 whitespace-nowrap px-3 py-3 text-[11px] font-semibold uppercase tracking-[0.2em] transition ${
                          active
                            ? "text-[#C8A96B]"
                            : "text-white/35 hover:text-white/70"
                        }`}
                      >
                        {tab.label}

                        {count !== null && count > 0 && (
                          <span className="rounded-full bg-white/5 px-1.5 py-0.5 text-[9px] tabular-nums text-white/40">
                            {count}
                          </span>
                        )}

                        {tab.key === "informe" && selected.hasReport && (
                          <CheckCircle2 size={11} className="text-[#4ADE80]" />
                        )}

                        {active && (
                          <span className="absolute inset-x-2 -bottom-px h-0.5 rounded-full bg-[#C8A96B]" />
                        )}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* CUERPO */}

              <div className="min-w-0 flex-1 overflow-y-auto">
                <div className="grid min-w-0 gap-5 p-3 sm:p-5 md:grid-cols-[290px_minmax(0,1fr)] lg:grid-cols-[330px_minmax(0,1fr)]">
                  {/* COLUMNA IZQUIERDA */}

                  <aside className="hidden min-w-0 space-y-4 md:block">
                    <div className="overflow-hidden rounded-2xl border border-white/10 bg-[#0B0F14]">
                      <div className="relative">
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img
                          src={selected.photo}
                          alt={selected.name}
                          className="aspect-[3/4] w-full object-cover object-top"
                        />

                        <div className="absolute inset-0 bg-gradient-to-t from-[#0B0F14] via-transparent to-transparent" />

                        {selected.externo && (
                          <span className="absolute right-2 top-2 rounded-full bg-[#C8A96B] px-2 py-0.5 text-[9px] font-bold uppercase text-black">
                            Otro equipo
                          </span>
                        )}

                        {selected.lastSession && (
                          <span className="absolute bottom-2 left-2 rounded-full border border-white/10 bg-black/60 px-2.5 py-1 text-[10px] text-white/60 backdrop-blur">
                            Última sesión {relativeFrom(selected.lastSession)}
                          </span>
                        )}
                      </div>
                    </div>

                    {quickFacts}

                    {competencePanel}
                  </aside>

                  {/* COLUMNA DERECHA */}

                  <div className="min-w-0 space-y-5">
                    <div className="md:hidden">{quickFacts}</div>

                    {/* ---------- PERFIL ---------- */}

                    {activeTab === "perfil" && (
                      <div className="min-w-0 space-y-5">
                        <div className="flex flex-wrap items-center justify-between gap-3">
                          <div className="min-w-0">
                            <h3 className="text-lg font-semibold sm:text-xl">
                              Aspectos de mejora
                            </h3>

                            <p className="text-xs text-white/35">
                              Plan de desarrollo del jugador
                            </p>
                          </div>

                          <GoldButton icon={Pencil} onClick={openProfileForm}>
                            Editar perfil
                          </GoldButton>
                        </div>

                        <div className="grid min-w-0 gap-4 lg:grid-cols-2">
                          <Panel title="Con balón" icon={Target}>
                            <ProfileText text={selected.conBalon} />
                          </Panel>

                          <Panel title="Sin balón" icon={Shield}>
                            <ProfileText text={selected.sinBalon} />
                          </Panel>

                          <Panel
                            title="Mental"
                            icon={Brain}
                            className="lg:col-span-2"
                          >
                            <ProfileText text={selected.mental} />
                          </Panel>
                        </div>

                        {selected.hudlPerfilUrl && (
                          <Panel title="Perfil Hudl" icon={ExternalLink}>
                            <a
                              href={selected.hudlPerfilUrl}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="inline-flex items-center gap-2 rounded-xl border border-[#C8A96B]/40 bg-[#C8A96B]/10 px-4 py-2 text-xs font-medium text-[#C8A96B] transition hover:bg-[#C8A96B]/20"
                            >
                              <ExternalLink size={14} />
                              Abrir perfil Hudl
                            </a>
                          </Panel>
                        )}

                        <div className="md:hidden">{competencePanel}</div>
                      </div>
                    )}

                    {/* ---------- SEGUIMIENTO ---------- */}

                    {activeTab === "seguimiento" && (
                      <div className="min-w-0 space-y-5">
                        <div className="flex flex-wrap items-center justify-between gap-3">
                          <div className="min-w-0">
                            <h3 className="text-lg font-semibold sm:text-xl">
                              Seguimiento individual
                            </h3>

                            <p className="text-xs text-white/35">
                              {playerTracking.length}{" "}
                              {playerTracking.length === 1
                                ? "sesión registrada"
                                : "sesiones registradas"}

                              {selected.lastSession &&
                                ` · última ${relativeFrom(selected.lastSession)}`}
                            </p>
                          </div>

                          <GoldButton
                            icon={Plus}
                            onClick={() => openTrackingForm()}
                          >
                            Nuevo seguimiento
                          </GoldButton>
                        </div>

                        {playerTracking.length === 0 ? (
                          <EmptyState
                            icon={ClipboardList}
                            title="Todavía no hay seguimientos"
                            hint="Registra la primera sesión con sus objetivos y el feedback del cuerpo técnico."
                            action={
                              <GoldButton
                                icon={Plus}
                                onClick={() => openTrackingForm()}
                              >
                                Registrar sesión
                              </GoldButton>
                            }
                          />
                        ) : (
                          trackingGroups.map((group) => (
                            <div key={group.key} className="min-w-0 space-y-3">
                              <div className="flex min-w-0 items-center gap-3">
                                <span className="shrink-0 text-[10px] uppercase tracking-[0.25em] text-white/30">
                                  {group.label}
                                </span>

                                <div className="h-px min-w-0 flex-1 bg-white/10" />

                                <span className="shrink-0 text-[10px] tabular-nums text-white/20">
                                  {group.items.length}
                                </span>
                              </div>

                              {group.items.map((item) => (
                                <article
                                  key={item.ID_REGISTRO}
                                  className="min-w-0 overflow-hidden rounded-2xl border border-white/10 bg-white/[0.025] transition hover:border-white/20"
                                >
                                  <div className="flex min-w-0 items-center justify-between gap-3 border-b border-white/10 bg-white/[0.02] px-4 py-2.5">
                                    <div className="flex min-w-0 items-center gap-2">
                                      <CalendarDays
                                        size={13}
                                        className="shrink-0 text-[#C8A96B]"
                                      />

                                      <span className="shrink-0 text-xs font-medium text-[#C8A96B]">
                                        {formatDate(item.FECHA)}
                                      </span>

                                      <span className="truncate text-[11px] text-white/25">
                                        {relativeFrom(parseDate(item.FECHA))}
                                      </span>
                                    </div>

                                    <div className="flex shrink-0 gap-2">
                                      <IconButton
                                        icon={Pencil}
                                        label="Editar seguimiento"
                                        onClick={() => openTrackingForm(item)}
                                      />

                                      <IconButton
                                        icon={Trash2}
                                        tone="danger"
                                        label="Eliminar seguimiento"
                                        onClick={() =>
                                          deleteTracking(item.ID_REGISTRO)
                                        }
                                      />
                                    </div>
                                  </div>

                                  <div className="grid min-w-0 gap-3 p-4 lg:grid-cols-2">
                                    {[
                                      {
                                        label: "Objetivo ofensivo",
                                        value: item.OBJETIVO_OFENSIVO,
                                      },
                                      {
                                        label: "Objetivo defensivo",
                                        value: item.OBJETIVO_DEFENSIVO,
                                      },
                                      {
                                        label: "Objetivo mental",
                                        value: item.OBJETIVO_MENTAL,
                                      },
                                      {
                                        label: "Feedback",
                                        value: item.FEEDBACK,
                                      },
                                    ].map((block) => (
                                      <div
                                        key={block.label}
                                        className="min-w-0 rounded-xl border border-white/5 bg-white/[0.02] p-3"
                                      >
                                        <h4 className="mb-1.5 text-[9px] font-semibold uppercase tracking-[0.25em] text-[#C8A96B]">
                                          {block.label}
                                        </h4>

                                        <p className="whitespace-pre-line text-sm leading-relaxed text-white/70">
                                          {block.value || "—"}
                                        </p>
                                      </div>
                                    ))}
                                  </div>

                                  {(item.QUIEN ||
                                    item.MODALIDAD ||
                                    item.MOMENTO ||
                                    item.ESTRATEGIA) && (
                                    <div className="flex min-w-0 flex-wrap gap-1.5 px-4 pb-4">
                                      {item.QUIEN && <Chip>{item.QUIEN}</Chip>}
                                      {item.MODALIDAD && (
                                        <Chip>{item.MODALIDAD}</Chip>
                                      )}
                                      {item.MOMENTO && (
                                        <Chip>{item.MOMENTO}</Chip>
                                      )}
                                      {item.ESTRATEGIA && (
                                        <Chip tone="gold">
                                          {item.ESTRATEGIA}
                                        </Chip>
                                      )}
                                    </div>
                                  )}
                                </article>
                              ))}
                            </div>
                          ))
                        )}
                      </div>
                    )}

                    {/* ---------- VÍDEOS ---------- */}

                    {activeTab === "videos" && (
                      <div className="min-w-0 space-y-5">
                        <div className="flex flex-wrap items-center justify-between gap-3">
                          <div className="min-w-0">
                            <h3 className="text-lg font-semibold sm:text-xl">
                              Biblioteca de vídeos
                            </h3>

                            <p className="text-xs text-white/35">
                              {playerVideos.length}{" "}
                              {playerVideos.length === 1 ? "clip" : "clips"} del
                              jugador
                            </p>
                          </div>

                          <GoldButton icon={Plus} onClick={() => openVideoForm()}>
                            Nuevo vídeo
                          </GoldButton>
                        </div>

                        {videoCategories.length > 1 && (
                          <div className="flex min-w-0 flex-wrap gap-2">
                            {["todas", ...videoCategories].map((category) => (
                              <button
                                key={category}
                                onClick={() => setVideoCategory(category)}
                                className={`shrink-0 rounded-full border px-3 py-1.5 text-[11px] uppercase tracking-wider transition ${
                                  videoCategory === category
                                    ? "border-[#C8A96B] bg-[#C8A96B]/10 text-[#C8A96B]"
                                    : "border-white/10 text-white/40 hover:border-white/30 hover:text-white"
                                }`}
                              >
                                {category}
                              </button>
                            ))}
                          </div>
                        )}

                        {shownVideos.length === 0 ? (
                          <EmptyState
                            icon={Video}
                            title="Sin vídeos en esta vista"
                            hint="Añade clips de Drive o YouTube para acompañar el trabajo individual."
                            action={
                              <GoldButton
                                icon={Plus}
                                onClick={() => openVideoForm()}
                              >
                                Añadir vídeo
                              </GoldButton>
                            }
                          />
                        ) : (
                          <div className="grid min-w-0 gap-4 lg:grid-cols-2">
                            {shownVideos.map((video) => (
                              <article
                                key={video.ID_VIDEO}
                                className="min-w-0 overflow-hidden rounded-2xl border border-white/10 bg-white/[0.025] transition hover:border-white/20"
                              >
                                <div className="relative aspect-video w-full bg-black">
                                  {playingVideo === video.ID_VIDEO ? (
                                    <iframe
                                      src={embedUrl(video.URL_VIDEO)}
                                      title={video.TITULO}
                                      allow="autoplay; encrypted-media; fullscreen"
                                      allowFullScreen
                                      className="h-full w-full"
                                    />
                                  ) : (
                                    <button
                                      onClick={() =>
                                        setPlayingVideo(video.ID_VIDEO)
                                      }
                                      className="group flex h-full w-full items-center justify-center bg-gradient-to-br from-white/[0.07] to-transparent"
                                    >
                                      <PlayCircle
                                        size={44}
                                        className="text-white/30 transition group-hover:scale-110 group-hover:text-[#C8A96B]"
                                      />
                                    </button>
                                  )}
                                </div>

                                <div className="min-w-0 p-4">
                                  <div className="mb-2 flex min-w-0 flex-wrap items-center gap-2">
                                    {video.CATEGORIA && (
                                      <Chip tone="gold">{video.CATEGORIA}</Chip>
                                    )}

                                    {video.FECHA && (
                                      <span className="text-[11px] text-white/30">
                                        {formatDate(video.FECHA)}
                                      </span>
                                    )}
                                  </div>

                                  <h4 className="truncate text-sm font-semibold">
                                    {video.TITULO || "Sin título"}
                                  </h4>

                                  {video.DESCRIPCION && (
                                    <p className="mt-1.5 line-clamp-3 whitespace-pre-line text-xs leading-relaxed text-white/50">
                                      {video.DESCRIPCION}
                                    </p>
                                  )}

                                  <div className="mt-4 flex min-w-0 items-center justify-between gap-3">
                                    <a
                                      href={video.URL_VIDEO}
                                      target="_blank"
                                      rel="noopener noreferrer"
                                      className="inline-flex items-center gap-2 rounded-xl border border-white/10 px-3 py-1.5 text-[11px] text-white/60 transition hover:border-[#C8A96B] hover:text-[#C8A96B]"
                                    >
                                      <ExternalLink size={12} />
                                      Abrir
                                    </a>

                                    <div className="flex shrink-0 gap-2">
                                      <IconButton
                                        icon={Pencil}
                                        label="Editar vídeo"
                                        onClick={() => openVideoForm(video)}
                                      />

                                      <IconButton
                                        icon={Trash2}
                                        tone="danger"
                                        label="Eliminar vídeo"
                                        onClick={() =>
                                          deleteVideo(video.ID_VIDEO)
                                        }
                                      />
                                    </div>
                                  </div>
                                </div>
                              </article>
                            ))}
                          </div>
                        )}
                      </div>
                    )}

                    {/* ---------- VALORACIONES ---------- */}

                    {activeTab === "valoraciones" && (
                      <div className="min-w-0 space-y-5">
                        <div className="flex flex-wrap items-center justify-between gap-3">
                          <div className="min-w-0">
                            <h3 className="text-lg font-semibold sm:text-xl">
                              Valoraciones de partido
                            </h3>

                            <p className="text-xs text-white/35">
                              Histórico de notas, evolución y comentarios
                            </p>
                          </div>

                          <a
                            href="/ratings"
                            className="inline-flex shrink-0 items-center gap-2 rounded-xl border border-[#C8A96B]/40 bg-[#C8A96B]/10 px-4 py-2 text-xs font-medium text-[#C8A96B] transition hover:bg-[#C8A96B]/20"
                          >
                            <Star size={14} />
                            Registrar valoraciones
                          </a>
                        </div>

                        {loadingRatings ? (
                          <div className="flex items-center justify-center gap-3 rounded-2xl border border-white/10 bg-[#11161D] py-16 text-sm text-white/40">
                            <Loader2
                              size={18}
                              className="animate-spin text-[#C8A96B]"
                            />
                            Cargando valoraciones…
                          </div>
                        ) : (
                          <PlayerRatingsTab
                            season={ratingsSeason}
                            playerId={selected.idJugador}
                            compact
                          />
                        )}
                      </div>
                    )}

                    {/* ---------- INFORME ---------- */}

                    {activeTab === "informe" && (
                      <div className="min-w-0 space-y-5">
                        <div className="flex flex-wrap items-center justify-between gap-3">
                          <div className="min-w-0">
                            <h3 className="text-lg font-semibold sm:text-xl">
                              Informe individual
                            </h3>

                            <p className="text-xs text-white/35">
                              Documento de síntesis del jugador
                            </p>
                          </div>

                          <GoldButton icon={Pencil} onClick={openReportForm}>
                            {playerReport ? "Editar informe" : "Crear informe"}
                          </GoldButton>
                        </div>

                        {!playerReport ? (
                          <EmptyState
                            icon={FileText}
                            title="Este jugador no tiene informe"
                            hint="Redacta el resumen ejecutivo, fortalezas, aspectos de mejora y objetivos."
                            action={
                              <GoldButton icon={Plus} onClick={openReportForm}>
                                Crear informe
                              </GoldButton>
                            }
                          />
                        ) : (
                          <div className="grid min-w-0 gap-4 lg:grid-cols-2">
                            <Panel
                              title="Resumen ejecutivo"
                              icon={FileText}
                              className="lg:col-span-2"
                            >
                              <ProfileText
                                text={playerReport.RESUMEN_EJECUTIVO}
                              />
                            </Panel>

                            <Panel title="Fortalezas" icon={CheckCircle2}>
                              <ProfileText
                                text={playerReport.FORTALEZAS_INFORME}
                              />
                            </Panel>

                            <Panel title="Aspectos de mejora" icon={Target}>
                              <ProfileText
                                text={playerReport.ASPECTOS_MEJORA_INFORME}
                              />
                            </Panel>

                            <Panel title="Objetivos" icon={Target}>
                              <ProfileText text={playerReport.OBJETIVOS} />
                            </Panel>

                            <Panel
                              title="Observaciones finales"
                              icon={ClipboardList}
                            >
                              <ProfileText
                                text={playerReport.OBSERVACIONES_FINALES}
                              />
                            </Panel>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </div>
          </div>,
          document.body,
        )}

      {/* ================= FORMULARIOS ================= */}

      {showTrackingForm &&
        selected &&
        createPortal(
          <FormModal
            title={
              editingTracking ? "Editar seguimiento" : "Nuevo seguimiento"
            }
            subtitle={selected.name}
            saving={saving}
            submitLabel={editingTracking ? "Actualizar" : "Guardar"}
            onClose={() => {
              setShowTrackingForm(false);
              setEditingTracking(null);
            }}
            onSubmit={saveTracking}
          >
            <div className="grid min-w-0 gap-5">
              <div className="grid min-w-0 gap-4 sm:grid-cols-2">
                <Field label="Fecha">
                  <input
                    type="date"
                    value={trackingForm.FECHA}
                    onChange={(e) =>
                      setTrackingForm({
                        ...trackingForm,
                        FECHA: e.target.value,
                      })
                    }
                    className={FIELD_CLASS}
                  />
                </Field>

                <Field label="Quién">
                  <select
                    value={trackingForm.QUIEN}
                    onChange={(e) =>
                      setTrackingForm({
                        ...trackingForm,
                        QUIEN: e.target.value,
                      })
                    }
                    className={FIELD_CLASS}
                  >
                    <option value="">Seleccionar...</option>

                    {QUIEN_OPTIONS.map((option) => (
                      <option key={option} value={option}>
                        {option}
                      </option>
                    ))}
                  </select>
                </Field>
              </div>

              <div className="grid min-w-0 gap-4 sm:grid-cols-3">
                <Field label="Modalidad">
                  <select
                    value={trackingForm.MODALIDAD}
                    onChange={(e) =>
                      setTrackingForm({
                        ...trackingForm,
                        MODALIDAD: e.target.value,
                      })
                    }
                    className={FIELD_CLASS}
                  >
                    <option value="">Seleccionar...</option>

                    {MODALIDAD_OPTIONS.map((option) => (
                      <option key={option} value={option}>
                        {option}
                      </option>
                    ))}
                  </select>
                </Field>

                <Field label="Momento">
                  <select
                    value={trackingForm.MOMENTO}
                    onChange={(e) =>
                      setTrackingForm({
                        ...trackingForm,
                        MOMENTO: e.target.value,
                      })
                    }
                    className={FIELD_CLASS}
                  >
                    <option value="">Seleccionar...</option>

                    {MOMENTO_OPTIONS.map((option) => (
                      <option key={option} value={option}>
                        {option}
                      </option>
                    ))}
                  </select>
                </Field>

                <Field label="Estrategia">
                  <select
                    value={trackingForm.ESTRATEGIA}
                    onChange={(e) =>
                      setTrackingForm({
                        ...trackingForm,
                        ESTRATEGIA: e.target.value,
                      })
                    }
                    className={FIELD_CLASS}
                  >
                    <option value="">Seleccionar...</option>

                    {ESTRATEGIA_OPTIONS.map((option) => (
                      <option key={option} value={option}>
                        {option}
                      </option>
                    ))}
                  </select>
                </Field>
              </div>

              <div className="grid min-w-0 gap-4 lg:grid-cols-3">
                <Field label="Objetivo ofensivo">
                  <textarea
                    value={trackingForm.OBJETIVO_OFENSIVO}
                    onChange={(e) =>
                      setTrackingForm({
                        ...trackingForm,
                        OBJETIVO_OFENSIVO: e.target.value,
                      })
                    }
                    placeholder="Qué trabajamos con balón..."
                    className={`${FIELD_CLASS} min-h-[110px] resize-y`}
                  />
                </Field>

                <Field label="Objetivo defensivo">
                  <textarea
                    value={trackingForm.OBJETIVO_DEFENSIVO}
                    onChange={(e) =>
                      setTrackingForm({
                        ...trackingForm,
                        OBJETIVO_DEFENSIVO: e.target.value,
                      })
                    }
                    placeholder="Qué trabajamos sin balón..."
                    className={`${FIELD_CLASS} min-h-[110px] resize-y`}
                  />
                </Field>

                <Field label="Objetivo mental">
                  <textarea
                    value={trackingForm.OBJETIVO_MENTAL}
                    onChange={(e) =>
                      setTrackingForm({
                        ...trackingForm,
                        OBJETIVO_MENTAL: e.target.value,
                      })
                    }
                    placeholder="Actitud, hábitos, competitividad..."
                    className={`${FIELD_CLASS} min-h-[110px] resize-y`}
                  />
                </Field>
              </div>

              <Field label="Feedback" hint="Qué se le transmitió al jugador">
                <textarea
                  value={trackingForm.FEEDBACK}
                  onChange={(e) =>
                    setTrackingForm({
                      ...trackingForm,
                      FEEDBACK: e.target.value,
                    })
                  }
                  className={`${FIELD_CLASS} min-h-[130px] resize-y`}
                />
              </Field>
            </div>
          </FormModal>,
          document.body,
        )}

      {showProfileForm &&
        selected &&
        createPortal(
          <FormModal
            title="Editar perfil"
            subtitle={selected.name}
            saving={saving}
            submitLabel="Guardar perfil"
            maxWidth="max-w-4xl"
            onClose={() => setShowProfileForm(false)}
            onSubmit={saveProfile}
          >
            <div className="grid min-w-0 gap-5">
              <div className="grid min-w-0 gap-4 lg:grid-cols-3">
                <Field label="Con balón">
                  <textarea
                    value={profileForm.conBalon}
                    onChange={(e) =>
                      setProfileForm({
                        ...profileForm,
                        conBalon: e.target.value,
                      })
                    }
                    className={`${FIELD_CLASS} min-h-[150px] resize-y`}
                  />
                </Field>

                <Field label="Sin balón">
                  <textarea
                    value={profileForm.sinBalon}
                    onChange={(e) =>
                      setProfileForm({
                        ...profileForm,
                        sinBalon: e.target.value,
                      })
                    }
                    className={`${FIELD_CLASS} min-h-[150px] resize-y`}
                  />
                </Field>

                <Field label="Mental">
                  <textarea
                    value={profileForm.mental}
                    onChange={(e) =>
                      setProfileForm({
                        ...profileForm,
                        mental: e.target.value,
                      })
                    }
                    className={`${FIELD_CLASS} min-h-[150px] resize-y`}
                  />
                </Field>
              </div>

              <Field label="URL perfil Hudl">
                <input
                  value={profileForm.hudlPerfilUrl}
                  onChange={(e) =>
                    setProfileForm({
                      ...profileForm,
                      hudlPerfilUrl: e.target.value,
                    })
                  }
                  placeholder="https://..."
                  className={FIELD_CLASS}
                />
              </Field>

              <div className="rounded-2xl border border-white/10 bg-white/[0.02] p-4">
                <p className="mb-4 text-[10px] font-semibold uppercase tracking-[0.25em] text-[#C8A96B]">
                  Competencias · 0 a 10
                </p>

                <div className="grid min-w-0 gap-4 sm:grid-cols-2">
                  {METRICS.map((metric) => {
                    const value = profileForm[metric.key];

                    return (
                      <div key={metric.key} className="min-w-0">
                        <div className="mb-2 flex items-baseline justify-between gap-2">
                          <span className="text-[10px] font-semibold uppercase tracking-[0.25em] text-white/40">
                            {metric.label}
                          </span>

                          <span
                            className="text-sm font-semibold tabular-nums"
                            style={{ color: scoreColor(Number(value || 0)) }}
                          >
                            {value || "—"}
                          </span>
                        </div>

                        <input
                          type="range"
                          min="0"
                          max="10"
                          step="1"
                          value={Number(value || 0)}
                          onChange={(e) =>
                            setProfileForm({
                              ...profileForm,
                              [metric.key]: e.target.value,
                            })
                          }
                          className="w-full accent-[#C8A96B]"
                        />
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          </FormModal>,
          document.body,
        )}

      {showVideoForm &&
        selected &&
        createPortal(
          <FormModal
            title={editingVideo ? "Editar vídeo" : "Nuevo vídeo"}
            subtitle={selected.name}
            saving={saving}
            submitLabel={editingVideo ? "Actualizar" : "Guardar"}
            onClose={() => {
              setShowVideoForm(false);
              setEditingVideo(null);
            }}
            onSubmit={saveVideo}
          >
            <div className="grid min-w-0 gap-5">
              <div className="grid min-w-0 gap-4 sm:grid-cols-2">
                <Field label="Fecha">
                  <input
                    type="date"
                    value={videoForm.FECHA}
                    onChange={(e) =>
                      setVideoForm({ ...videoForm, FECHA: e.target.value })
                    }
                    className={FIELD_CLASS}
                  />
                </Field>

                <Field label="Categoría" hint="Fortaleza, mejora, partido...">
                  <input
                    list="video-categorias"
                    value={videoForm.CATEGORIA}
                    onChange={(e) =>
                      setVideoForm({ ...videoForm, CATEGORIA: e.target.value })
                    }
                    className={FIELD_CLASS}
                  />

                  <datalist id="video-categorias">
                    {videoCategories.map((category) => (
                      <option key={category} value={category} />
                    ))}
                  </datalist>
                </Field>
              </div>

              <Field label="Título">
                <input
                  value={videoForm.TITULO}
                  onChange={(e) =>
                    setVideoForm({ ...videoForm, TITULO: e.target.value })
                  }
                  className={FIELD_CLASS}
                />
              </Field>

              <Field label="Descripción">
                <textarea
                  value={videoForm.DESCRIPCION}
                  onChange={(e) =>
                    setVideoForm({ ...videoForm, DESCRIPCION: e.target.value })
                  }
                  className={`${FIELD_CLASS} min-h-[130px] resize-y`}
                />
              </Field>

              <Field label="URL del vídeo" hint="Drive o YouTube">
                <input
                  value={videoForm.URL_VIDEO}
                  onChange={(e) =>
                    setVideoForm({ ...videoForm, URL_VIDEO: e.target.value })
                  }
                  placeholder="https://drive.google.com/file/d/..."
                  className={FIELD_CLASS}
                />
              </Field>
            </div>
          </FormModal>,
          document.body,
        )}

      {showReportForm &&
        selected &&
        createPortal(
          <FormModal
            title={playerReport ? "Editar informe" : "Nuevo informe"}
            subtitle={selected.name}
            saving={saving}
            submitLabel="Guardar informe"
            maxWidth="max-w-4xl"
            onClose={() => setShowReportForm(false)}
            onSubmit={saveReport}
          >
            <div className="grid min-w-0 gap-5">
              <Field label="Resumen ejecutivo">
                <textarea
                  value={reportForm.RESUMEN_EJECUTIVO}
                  onChange={(e) =>
                    setReportForm({
                      ...reportForm,
                      RESUMEN_EJECUTIVO: e.target.value,
                    })
                  }
                  className={`${FIELD_CLASS} min-h-[130px] resize-y`}
                />
              </Field>

              <div className="grid min-w-0 gap-4 lg:grid-cols-2">
                <Field label="Fortalezas">
                  <textarea
                    value={reportForm.FORTALEZAS_INFORME}
                    onChange={(e) =>
                      setReportForm({
                        ...reportForm,
                        FORTALEZAS_INFORME: e.target.value,
                      })
                    }
                    className={`${FIELD_CLASS} min-h-[130px] resize-y`}
                  />
                </Field>

                <Field label="Aspectos de mejora">
                  <textarea
                    value={reportForm.ASPECTOS_MEJORA_INFORME}
                    onChange={(e) =>
                      setReportForm({
                        ...reportForm,
                        ASPECTOS_MEJORA_INFORME: e.target.value,
                      })
                    }
                    className={`${FIELD_CLASS} min-h-[130px] resize-y`}
                  />
                </Field>

                <Field label="Objetivos">
                  <textarea
                    value={reportForm.OBJETIVOS}
                    onChange={(e) =>
                      setReportForm({
                        ...reportForm,
                        OBJETIVOS: e.target.value,
                      })
                    }
                    className={`${FIELD_CLASS} min-h-[130px] resize-y`}
                  />
                </Field>

                <Field label="Observaciones finales">
                  <textarea
                    value={reportForm.OBSERVACIONES_FINALES}
                    onChange={(e) =>
                      setReportForm({
                        ...reportForm,
                        OBSERVACIONES_FINALES: e.target.value,
                      })
                    }
                    className={`${FIELD_CLASS} min-h-[130px] resize-y`}
                  />
                </Field>
              </div>
            </div>
          </FormModal>,
          document.body,
        )}

    </>
  );
}
