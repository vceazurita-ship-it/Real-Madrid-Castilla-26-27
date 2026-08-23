import {
  Activity,
  BarChart3,
  Binoculars,
  BookOpen,
  Brain,
  CalendarDays,
  Clipboard,
  ClipboardCheck,
  ClipboardList,
  ClipboardPen,
  Database,
  Dumbbell,
  Flag,
  Goal,
  Handshake,
  HeartHandshake,
  History,
  MonitorPlay,
  Network,
  PenTool,
  Scale,
  Search,
  Shield,
  ShieldHalf,
  Star,
  Swords,
  User,
  Users,
  Video,
} from "lucide-react";

import type { LucideIcon } from "lucide-react";

/**
 * Catálogo de módulos de la plataforma.
 *
 * Es la fuente de la portada: el área a la que pertenece cada módulo decide
 * su color, así que el color deja de ser decorativo y pasa a significar algo.
 */

export type AreaKey =
  | "IDENTIDAD"
  | "COMPETICIÓN"
  | "METODOLOGÍA"
  | "INDIVIDUAL"
  | "RELACIONAL"
  | "COLECTIVO"
  | "RIVAL"
  | "RENDIMIENTO"
  | "OPERATIVA";

export interface Area {
  key: AreaKey;
  label: string;
  /* Color del área. Se inyecta como variable CSS en cada tarjeta. */
  color: string;
}

export const AREAS: Area[] = [
  { key: "IDENTIDAD", label: "Identidad", color: "#D8B45A" },
  { key: "COMPETICIÓN", label: "Competición", color: "#60A5FA" },
  { key: "METODOLOGÍA", label: "Metodología", color: "#22D3EE" },
  { key: "INDIVIDUAL", label: "Individual", color: "#A78BFA" },
  { key: "RELACIONAL", label: "Relacional", color: "#F472B6" },
  { key: "COLECTIVO", label: "Colectivo", color: "#34D399" },
  { key: "RIVAL", label: "Rival", color: "#FB7185" },
  { key: "RENDIMIENTO", label: "Rendimiento", color: "#FB923C" },
  { key: "OPERATIVA", label: "Operativa", color: "#94A3B8" },
];

export const AREA_BY_KEY = new Map(AREAS.map((area) => [area.key, area]));

export interface AppModule {
  href: string;
  area: AreaKey;
  title: string;
  desc: string;
  icon: LucideIcon;
  /** Peso base en el orden de la portada; el uso real lo va corrigiendo. */
  rank: number;
  /** Sinónimos que también deben encontrar el módulo al buscar. */
  alias?: string[];
}

export const MODULES: AppModule[] = [
  /* ---------------------------------------------------------------- IDENTIDAD */
  {
    href: "/game-model",
    area: "IDENTIDAD",
    title: "Identidad de Juego",
    desc: "Principios ofensivos y defensivos del modelo",
    icon: Brain,
    rank: 100,
    alias: ["modelo de juego", "principios"],
  },
  {
    href: "/team-values",
    area: "IDENTIDAD",
    title: "Dinámicas y Valores",
    desc: "Cultura, normas y comportamientos del entorno",
    icon: Handshake,
    rank: 99,
    alias: ["cultura", "valores"],
  },
  {
    href: "/identidad-posicional",
    area: "IDENTIDAD",
    title: "Identidad Posicional",
    desc: "Exigencias y referencias de cada posición",
    icon: ShieldHalf,
    rank: 92,
    alias: ["posiciones", "perfiles"],
  },

  /* -------------------------------------------------------------- COMPETICIÓN */
  {
    href: "/match-preparation",
    area: "COMPETICIÓN",
    title: "Plan de Partido",
    desc: "Preparación estratégica de la próxima jornada",
    icon: ClipboardCheck,
    rank: 98,
    alias: ["preparacion de partido", "previa"],
  },
  {
    href: "/collective",
    area: "COMPETICIÓN",
    title: "Análisis de Competición",
    desc: "Rendimiento del equipo partido a partido",
    icon: Swords,
    rank: 79,
  },
  {
    href: "/collective_history",
    area: "COMPETICIÓN",
    title: "Histórico Competición",
    desc: "Evolución del rendimiento a lo largo del curso",
    icon: History,
    rank: 78,
  },
  {
    href: "/ratings",
    area: "COMPETICIÓN",
    title: "Valoraciones de Partido",
    desc: "Puntuación del staff jugador por jugador",
    icon: Star,
    rank: 84,
    alias: ["notas", "puntuaciones"],
  },

  /* ------------------------------------------------------------- METODOLOGÍA */
  {
    href: "/micro_calendar",
    area: "METODOLOGÍA",
    title: "Contenidos Microciclo",
    desc: "Qué se entrena cada día de la semana",
    icon: BookOpen,
    rank: 97,
    alias: ["calendario de contenidos"],
  },
  {
    href: "/microcycles",
    area: "METODOLOGÍA",
    title: "Microciclos",
    desc: "Diseño y control del proceso semanal",
    icon: CalendarDays,
    rank: 95,
  },
  {
    href: "/training",
    area: "METODOLOGÍA",
    title: "Jugadores Próxima Sesión",
    desc: "Importación y disponibilidad para la sesión",
    icon: Users,
    rank: 96,
    alias: ["disponibilidad"],
  },
  {
    href: "/pizarra_sesion",
    area: "METODOLOGÍA",
    title: "Pizarra Sesión",
    desc: "Organización visual de tareas y grupos",
    icon: Clipboard,
    rank: 94,
  },
  {
    href: "/pizarra",
    area: "METODOLOGÍA",
    title: "Pizarra Competición",
    desc: "Alineación y estructura para el partido",
    icon: Activity,
    rank: 88,
  },
  {
    href: "/pizarra-tactica",
    area: "METODOLOGÍA",
    title: "Pizarra Táctica",
    desc: "Escenas, dibujo y animación de jugadas",
    icon: PenTool,
    rank: 90,
    alias: ["dibujar jugada", "animacion", "dictar jugada"],
  },
  {
    href: "/match-plans",
    area: "METODOLOGÍA",
    title: "Planes de Partido",
    desc: "Biblioteca de planes ya trabajados",
    icon: ClipboardPen,
    rank: 86,
  },

  /* --------------------------------------------------------------- INDIVIDUAL */
  {
    href: "/individual",
    area: "INDIVIDUAL",
    title: "Plantilla",
    desc: "Ficha y gestión integral del jugador",
    icon: User,
    rank: 93,
  },
  {
    href: "/dashboard-plantilla",
    area: "INDIVIDUAL",
    title: "Dashboard Individual",
    desc: "Comparativa de la plantilla de un vistazo",
    icon: BarChart3,
    rank: 72,
  },
  {
    href: "/calendar",
    area: "INDIVIDUAL",
    title: "Calendario Seguimiento",
    desc: "Planificación y control de seguimientos",
    icon: ClipboardList,
    rank: 91,
  },
  {
    href: "/individual_proc",
    area: "INDIVIDUAL",
    title: "Dashboard Seguimiento",
    desc: "Indicadores del desarrollo individual",
    icon: BarChart3,
    rank: 89,
  },
  {
    href: "/video-individual",
    area: "INDIVIDUAL",
    title: "Videoteca Individual",
    desc: "Biblioteca de clips por jugador",
    icon: Video,
    rank: 70,
  },
  {
    href: "/comparative_ind",
    area: "INDIVIDUAL",
    title: "Comparativo U-21",
    desc: "Comparación y proyección de talento",
    icon: Scale,
    rank: 69,
  },

  /* --------------------------------------------------------------- RELACIONAL */
  {
    href: "/emotion",
    area: "RELACIONAL",
    title: "Emocional",
    desc: "Seguimiento del estado emocional del grupo",
    icon: HeartHandshake,
    rank: 68,
  },
  {
    href: "/sinergy",
    area: "RELACIONAL",
    title: "Sinergias",
    desc: "Relaciones funcionales entre jugadores",
    icon: Network,
    rank: 67,
  },

  /* ---------------------------------------------------------------- COLECTIVO */
  {
    href: "/setpieces",
    area: "COLECTIVO",
    title: "ABP Ofensivo",
    desc: "Acciones ofensivas a balón parado",
    icon: Goal,
    rank: 77,
    alias: ["balon parado", "corners", "faltas"],
  },
  {
    href: "/setpieces_def",
    area: "COLECTIVO",
    title: "ABP Defensivo",
    desc: "Organización defensiva a balón parado",
    icon: Shield,
    rank: 76,
    alias: ["balon parado"],
  },
  {
    href: "/throw-ins",
    area: "COLECTIVO",
    title: "Saque de Banda Ofensivo",
    desc: "Saques de banda a favor",
    icon: Flag,
    rank: 74,
  },
  {
    href: "/throw-ins-def",
    area: "COLECTIVO",
    title: "Saque de Banda Defensivo",
    desc: "Saques de banda en contra",
    icon: Shield,
    rank: 73,
  },
  {
    href: "/video-collective",
    area: "COLECTIVO",
    title: "Videoteca Colectiva",
    desc: "Biblioteca de clips de equipo",
    icon: MonitorPlay,
    rank: 75,
  },
  {
    href: "/team",
    area: "COLECTIVO",
    title: "Rendimiento de Equipo",
    desc: "Indicadores globales del colectivo",
    icon: BarChart3,
    rank: 80,
  },

  /* -------------------------------------------------------------------- RIVAL */
  {
    href: "/rivals",
    area: "RIVAL",
    title: "Plantillas Rivales",
    desc: "Fichas e informes de los jugadores del rival",
    icon: Users,
    rank: 87,
    alias: ["scouting", "informe rival", "dictar informe"],
  },
  {
    href: "/scout-rival-collective",
    area: "RIVAL",
    title: "Scout Colectivo",
    desc: "Cómo juega el rival como equipo",
    icon: Binoculars,
    rank: 85,
  },
  {
    href: "/scout-rival-individual",
    area: "RIVAL",
    title: "Scout Individual",
    desc: "Análisis jugador a jugador del rival",
    icon: Search,
    rank: 83,
  },
  {
    href: "/scout-rival-abp",
    area: "RIVAL",
    title: "ABP del Rival",
    desc: "Su balón parado: córners, faltas, bandas y amenaza aérea",
    icon: Flag,
    rank: 84,
    alias: ["abp rival", "balon parado rival", "corners rival", "estrategia rival"],
  },

  /* -------------------------------------------------------------- RENDIMIENTO */
  {
    href: "/performance",
    area: "RENDIMIENTO",
    title: "Área Condicional",
    desc: "Control del rendimiento físico",
    icon: Dumbbell,
    rank: 66,
    alias: ["fisico", "gps", "cargas"],
  },
  {
    href: "/calendar_performance",
    area: "RENDIMIENTO",
    title: "Calendario Condicional",
    desc: "Planificación del trabajo físico",
    icon: CalendarDays,
    rank: 65,
  },

  /* ---------------------------------------------------------------- OPERATIVA */
  {
    href: "/calendar_general",
    area: "OPERATIVA",
    title: "Calendario Operativa",
    desc: "Reuniones, viajes y logística del staff",
    icon: CalendarDays,
    rank: 60,
  },
  {
    href: "/general",
    area: "OPERATIVA",
    title: "Repositorio General",
    desc: "Documentación compartida del cuerpo técnico",
    icon: Database,
    rank: 58,
    alias: ["documentos", "archivos"],
  },
  {
    href: "/data-center",
    area: "OPERATIVA",
    title: "Centro de Datos",
    desc: "Bases de datos y fuentes de la plataforma",
    icon: Database,
    rank: 55,
    alias: ["repositorio", "datos"],
  },
];

/** Texto sin acentos ni mayúsculas, para buscar sin pelearse con la tilde. */
export function foldText(value: string) {
  return value
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .trim();
}

/** Índice de búsqueda de cada módulo, calculado una sola vez. */
const SEARCH_INDEX = new Map(
  MODULES.map((module) => [
    module.href,
    foldText(
      [module.title, module.desc, module.area, ...(module.alias ?? [])].join(" ")
    ),
  ])
);

export function matchesQuery(module: AppModule, query: string) {
  const needle = foldText(query);

  if (!needle) return true;

  const haystack = SEARCH_INDEX.get(module.href) ?? "";

  /* Todas las palabras deben aparecer: "pizarra tac" encuentra la táctica. */
  return needle.split(/\s+/).every((word) => haystack.includes(word));
}
