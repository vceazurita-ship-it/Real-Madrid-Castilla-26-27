"use client";

import dynamic from "next/dynamic";
import { traeJson } from "@/lib/hojaCsv";

import {
  useCallback,
  useEffect,
  useDeferredValue,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";

import { chipInk } from "@/lib/theme";
import { useTheme } from "@/components/theme-provider";
import { toast } from "sonner";

import { Sidebar } from "@/components/ui/sidebar";
import { Topbar } from "@/components/ui/topbar";
import { useSaveGuard } from "@/hooks/useSaveGuard";
import { useBodyScrollLock } from "@/components/season/useBodyScrollLock";
import RivalBoardPanel from "@/components/tactics/RivalBoardPanel";
import RivalVoicePanel from "@/components/voice/RivalVoicePanel";
import PlayerStatsCard from "@/components/rivals/PlayerStatsCard";
import { useRivalStats } from "@/hooks/useRivalStats";
import { useRivalInforme } from "@/hooks/useRivalInforme";
import { leeTipologia } from "@/lib/rivals/tipologia";
import { useAutoSave } from "@/hooks/useAutoSave";
import { AutoSaveStatus } from "@/components/save-guard/AutoSaveStatus";
import { ColumnasPerdidas } from "@/components/save-guard/ColumnasPerdidas";
import { useRivalOnce } from "@/hooks/useRivalOnce";
import type { AlineacionJugador } from "@/lib/rivals/alineacion-ppt";
import { findStats, findTeam, highlightSeason } from "@/lib/rivals/stats";
import EscudoEquipo from "@/components/rivals/EscudoEquipo";
import {
  exportPortadaPdf,
  exportPortadaPng,
  metricasDeTemporada,
  type PortadaData,
} from "@/lib/rivals/portada";
import { ofrecePortada } from "@/lib/rivals/portada-slot";
import { explicaErrorScript } from "@/lib/appsScriptErrors";
import {
  ONCE_COLOR,
  ONCE_ETIQUETA,
  PARAM_EQUIPO,
  PARAM_JUGADOR,
  fichaRivalPath,
  playerKey,
  seDibuja,
  type OnceEstado,
} from "@/lib/rivals/once";
import { reparteCampo } from "@/lib/rivals/once-campo";
import {
  explicaSugerencia,
  sugiereOnce,
  type OnceSugerido,
} from "@/lib/rivals/once-sugerido";
import type {
  OnceCampoCandidato,
  OnceCampoFicha,
} from "@/components/rivals/OnceCampoDialog";
import type { PorteroCandidato } from "@/components/rivals/PorteroPdfDialog";
import Link from "next/link";

import { enlaceAbrible } from "@/lib/rivals/media";
import type {
  OncePdfEnlace,
  OncePdfPlayer,
  OncePdfEstado,
  OncePdfVariante,
} from "@/lib/rivals/once-pdf";
import { buildRivalSquads } from "@/lib/tactics/rivals";
import {
  cargaOrdenRivales,
  comparaPorCalendario,
  enfrentamientoDe,
  esElProximo,
  etiquetaDelProximo,
  SIN_ORDEN,
  type OrdenRivales,
} from "@/lib/rivals/orden-calendario";
import { esLiga, findInforme, type InformeEquipo } from "@/lib/rivals/informe";
import type { InformeData } from "@/lib/rivals/informe-ppt";
import type { HojaInforme } from "@/lib/rivals/informe-elementos";
import type { PartidoElegible } from "@/components/rivals/InformePartidosDialog";
import {
  ANCLAS_SLOT,
  columnasDeBanda,
  columnasDeBloque,
  reparteCampograma,
  ONCE_1_4_2_3_1,
  reparteEnOnce,
  type BloqueEntrada,
} from "@/lib/rivals/campograma-motor";
import type { RivalVoiceField } from "@/lib/voice/types";

import {
  AlertTriangle,
  ArrowBigUp,
  Ban,
  Bandage,
  BarChart3,
  BatteryCharging,
  BatteryLow,
  Brain,
  Check,
  ChevronLeft,
  ChevronRight,
  CircleAlert,
  Crown,
  Dumbbell,
  ExternalLink,
  FileDown,
  FileText,
  Flag,
  Flame,
  Footprints,
  Frown,
  Ghost,
  Hand,
  Handshake,
  HeartPulse,
  LayoutGrid,
  Loader2,
  MoveDown,
  Plus,
  Presentation,
  RectangleHorizontal,
  RotateCcw,
  Ruler,
  Save,
  Search,
  ShieldOff,
  Shirt,
  Snail,
  SquarePen,
  Shuffle,
  Sparkles,
  Star,
  Swords,
  Tags,
  ChevronDown,
  Target,
  ThumbsDown,
  Trash2,
  UserRound,
  Video,
  Wand2,
  Wind,
  X,
  Zap,
} from "lucide-react";

import type { LucideIcon } from "lucide-react";

/*
|--------------------------------------------------------------------------
| LO QUE NO HACE FALTA PARA PINTAR LA PANTALLA
|--------------------------------------------------------------------------
|
| Ésta es la pantalla más grande de la app, y buena parte de lo que cargaba
| al abrirla no se usa hasta que alguien pulsa un botón: los cuatro pop-ups
| —el campo del once, la elección de partidos, el editor del informe y el
| del portero— y los tres motores de dibujo —el PDF del once, el .pptx del
| informe y el campograma de día de partido—, que entre todos son más de
| diez mil líneas de código de exportación.
|
| Ahora llegan cuando se piden. Los pop-ups con `next/dynamic`, porque sólo
| se montan si están abiertos; los motores con un `import()` dentro del
| propio manejador, que además ya cargaban así su `jspdf`.
|
| Los tipos siguen arriba con `import type`: no viajan al navegador.
*/

const ClipsDelJugador = dynamic(
  () =>
    import("@/components/coding/ClipsDelJugador").then(
      (modulo) => modulo.ClipsDelJugador,
    ),
  { ssr: false },
);

const OnceCampoDialog = dynamic(
  () => import("@/components/rivals/OnceCampoDialog"),
);

const PorteroPdfDialog = dynamic(
  () => import("@/components/rivals/PorteroPdfDialog"),
);

const InformePptEditor = dynamic(
  () => import("@/components/rivals/InformePptEditor"),
);

const InformePartidosDialog = dynamic(
  () => import("@/components/rivals/InformePartidosDialog"),
);


const RIVALS_API_URL = "/api/rivals";

/**
 * Cuántos partidos vienen marcados en el pop-up del informe.
 *
 * Cuatro, que son dos diapositivas —la 9 y la 10—. Se puede subir a seis en el
 * pop-up, que es lo que había antes de que se pudieran elegir.
 */
const PARTIDOS_INFORME_POR_DEFECTO = 4;

/** Tope del pop-up: seis partidos son tres hojas, y ahí se corta. */
const PARTIDOS_INFORME_MAXIMO = 6;

/** "2026-09-06T18:00:00+02:00" -> "6 sep 2026". */
function fechaDePartido(iso: string) {
  const fecha = new Date(String(iso ?? ""));

  return Number.isNaN(fecha.getTime())
    ? String(iso ?? "")
    : fecha.toLocaleDateString("es-ES", {
        day: "numeric",
        month: "short",
        year: "numeric",
      });
}

/* Los tres estados del once en la ficha, en el orden en que se piensan. */
const ESTADOS_ONCE: { label: string; valor: OnceEstado }[] = [
  { label: "Titular", valor: "titular" },
  { label: "Duda", valor: "duda" },
  { label: "Fuera", valor: null },
];

type RivalPlayer = {
  ID_JUGADOR: string;
  ID_EQUIPO: string;
  NOMBRE_EQUIPO: string;
  DORSAL: string | number;
  JUGADOR: string;
  "NOMBRE DEPORTIVO": string;
  "LUGAR DE NACIMIENTO": string;
  EDAD: string | number;
  PESO: string | number;
  ALTURA: string;
  "POSICIÓN": string;
  "2º POSICIÓN": string;
  "PIE DOMINANTE": string;
  PROCEDENCIA: string;
  "FECHA INCORPORACIÓN": string;

  IMPACTO: string;
  ROL: string;
  CARACTERÍSTICAS: string;
  FORTALEZAS: string;
  DEBILIDADES: string;
  OBSERVACIONES: string;

  VIDEO: string;
  DOC: string;
  FOTO: string;
  ESTADO: string;
};

function normalize(value: unknown) {
  return String(value || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim();
}

/** Texto de la hoja listo para pintar: el "." de "sin dato" cuenta como vac\u00edo. */
function textoUtil(value: unknown) {
  const texto = String(value ?? "").trim();

  return texto && texto !== "." ? texto : "";
}

/*
| El retrato de la hoja, a la resoluci\u00f3n que pide una portada.
|
| La columna FOTO trae el recorte de BeSoccer a 128 px, que en la ficha va
| sobrado y en una diapositiva a 1920 px se ve a cuadros. El CDN sirve el
| mismo archivo al tama\u00f1o que se le pida con `?size=`, as\u00ed que se le piden
| 500, que es el m\u00e1ximo que devuelve. Cualquier otra URL \u2014una foto subida a
| Supabase, por ejemplo\u2014 se deja como est\u00e1.
*/
function fotoGrande(url: string) {
  if (!url || !/cdn\.resfu\.com/.test(url) || /[?&]size=/.test(url)) return url;

  return `${url}${url.includes("?") ? "&" : "?"}size=500x&lossy=1`;
}

/** "2026/27" -> "26 / 27", como lo escribe la plantilla de la portada. */
function temporadaCorta(temporada: string | undefined) {
  const match = String(temporada ?? "").match(/(\d{2})(\d{2})\/(\d{2})/);

  return match ? `${match[2]} / ${match[3]}` : "26 / 27";
}

/*
| Enlace directo a una ficha: `/rivals?equipo=\u2026&jugador=\u2026`.
|
| Es lo que llevan dentro los PDF del once probable, que se leen en el m\u00f3vil y
| desde donde hay que poder saltar al jugador sin buscarlo a mano. Se lee una
| sola vez, al montar la p\u00e1gina, y despu\u00e9s la URL se limpia.
*/
function leerEnlaceDirecto() {
  if (typeof window === "undefined") return null;

  const params = new URLSearchParams(window.location.search);

  const equipo = params.get(PARAM_EQUIPO) ?? "";
  const clave = params.get(PARAM_JUGADOR) ?? "";

  return equipo || clave ? { equipo, clave } : null;
}

/*
|--------------------------------------------------------------------------
| LÍNEAS DE POSICIÓN
|--------------------------------------------------------------------------
| Una única fuente de verdad para clasificar posiciones: la usan el listado
| por líneas, el color del badge y el campograma.
*/

type LineKey = "portero" | "defensa" | "medio" | "ataque";

/*
| Cada línea se parte en "slots": la posición canónica con su código corto
| (POR, LD, DFC…). El orden de los slots manda en la aparición de los
| subgrupos dentro de la línea; para clasificar un texto libre no vale ese
| orden, sino el patrón más largo que encaje (ver getSlot).
*/

type PositionSlot = {
  key: string;
  code: string;
  label: string;
  match: string[];
};

const LINE_DEFINITIONS: {
  key: LineKey;
  title: string;
  slots: PositionSlot[];
  color: string;
}[] = [
  {
    key: "portero",
    title: "PORTEROS",
    color: "#D4A017",
    slots: [
      {
        key: "por",
        code: "POR",
        label: "Portero",
        match: ["portero", "arquero", "guardameta", "guardavallas"],
      },
    ],
  },
  {
    key: "defensa",
    title: "DEFENSAS",
    color: "#7DA6D9",
    slots: [
      {
        key: "ld",
        code: "LD",
        label: "Lateral derecho",
        match: [
          "lateral derecho",
          "lateral der",
          "lateral d",
          "defensa derecho",
          "carrilero derecho",
          "carrilero der",
        ],
      },
      {
        key: "dfc",
        code: "DFC",
        label: "Central",
        match: ["central", "zaguero", "defensa central", "libero"],
      },
      {
        key: "li",
        code: "LI",
        label: "Lateral izquierdo",
        match: [
          "lateral izquierdo",
          "lateral izq",
          "lateral i",
          "defensa izquierdo",
          "carrilero izquierdo",
          "carrilero izq",
        ],
      },
      {
        key: "car",
        code: "CAR",
        label: "Carrilero",
        match: ["carrilero"],
      },
      {
        key: "def",
        code: "DEF",
        label: "Defensa",
        match: ["lateral", "defensa"],
      },
    ],
  },
  {
    key: "medio",
    title: "CENTROCAMPISTAS",
    color: "#52B788",
    slots: [
      {
        key: "mcd",
        code: "MCD",
        label: "Pivote",
        match: [
          "mediocentro defensivo",
          "medio centro defensivo",
          "mediocampista defensivo",
          /* La hoja abrevia: "MEDIO CENTRO DEF". */
          "mediocentro def",
          "medio centro def",
          "pivote",
        ],
      },
      {
        key: "mc",
        code: "MC",
        label: "Mediocentro",
        match: [
          "mediocentro",
          "medio centro",
          "centrocampista",
          "mediocampista",
        ],
      },
      {
        key: "int",
        code: "INT",
        label: "Interior",
        /* "interir" es una errata que trae la hoja. */
        match: ["interior", "interir", "volante"],
      },
      {
        key: "mp",
        code: "MP",
        label: "Media punta",
        match: [
          "media punta",
          "mediapunta",
          "enganche",
          "mediocentro ofensivo",
          "medio centro ofensivo",
          /* La hoja abrevia: "MEDIO CENTRO OF". */
          "mediocentro of",
          "medio centro of",
        ],
      },
      {
        key: "med",
        code: "MED",
        label: "Medio",
        match: ["medio"],
      },
    ],
  },
  {
    key: "ataque",
    title: "ATACANTES",
    color: "#D46A6A",
    slots: [
      {
        key: "ed",
        code: "ED",
        label: "Extremo derecho",
        match: ["extremo derecho", "extremo der", "extremo d", "banda derecha"],
      },
      {
        key: "ei",
        code: "EI",
        label: "Extremo izquierdo",
        match: [
          "extremo izquierdo",
          "extremo izq",
          "extremo i",
          "banda izquierda",
        ],
      },
      {
        key: "ext",
        code: "EXT",
        label: "Extremo",
        match: ["extremo", "exterior"],
      },
      {
        key: "sd",
        code: "SD",
        label: "Segundo punta",
        match: ["segundo delantero", "segunda punta", "segundo punta"],
      },
      {
        key: "dc",
        code: "DC",
        label: "Delantero",
        match: ["delantero", "punta", "ariete", "killer"],
      },
    ],
  },
];

/* Índice plano línea+slot con los patrones ya normalizados. */
const SLOT_INDEX = LINE_DEFINITIONS.flatMap((line) =>
  line.slots.map((slot, slotIndex) => ({
    line,
    slot,
    slotIndex,
    patterns: slot.match.map(normalize).filter(Boolean),
  })),
);

/*
| Gana el patrón más largo que encaje, no el primero: así "mediocentro
| ofensivo" cae en MP y no en MC, y "lateral izquierdo" en LI y no en DEF.
*/
function getSlot(position: string) {
  const value = normalize(position);
  if (!value) return null;

  let best: (typeof SLOT_INDEX)[number] | null = null;
  let bestLength = 0;

  for (const entry of SLOT_INDEX) {
    for (const pattern of entry.patterns) {
      if (pattern.length > bestLength && value.includes(pattern)) {
        best = entry;
        bestLength = pattern.length;
      }
    }
  }

  return best;
}

function getLine(position: string) {
  return getSlot(position)?.line ?? null;
}

/* Orden de un jugador dentro de su línea (lateral → central → ...). */
function positionRank(position: string) {
  return getSlot(position)?.slotIndex ?? 999;
}

/*
| Portería → defensa → medio → ataque, y dentro de cada línea por posición: el
| mismo orden en el que se lee la lista de la pantalla y en el que salen las
| fichas de los PDF.
*/
function ordenDelOnce(a: RivalPlayer, b: RivalPlayer) {
  const linea = (player: RivalPlayer) =>
    LINE_DEFINITIONS.findIndex(
      (item) => item.key === getLine(player["POSICIÓN"])?.key,
    );

  const lineaA = linea(a);
  const lineaB = linea(b);

  if (lineaA !== lineaB) return lineaA - lineaB;

  return positionRank(a["POSICIÓN"]) - positionRank(b["POSICIÓN"]);
}

/*
| Los que el portero se lleva estudiados si no se le dice otra cosa: quien le
| va a tirar. Extremos, delanteros y medias puntas del once —titulares y
| dudas—; a los demás se les marca a mano en el pop-up.
*/
const SLOTS_DEL_PORTERO = new Set(["ed", "ei", "ext", "sd", "dc", "mp"]);

/*
| La cara de un jugador tal como la pinta el pop-up de antes del PDF. La usan
| los que están marcados en el once y también la plantilla entera —de ahí
| salen los recambios cuando allí se cambia a uno por otro—, así que vive
| fuera del componente.
*/
function fichaDeCampo(player: RivalPlayer): OnceCampoCandidato {
  const slotEntry = getSlot(player["POSICIÓN"]);

  return {
    clave: playerKey(player),
    dorsal: textoUtil(player.DORSAL),
    nombre: player["NOMBRE DEPORTIVO"] || player.JUGADOR || "Sin nombre",
    posCode: slotEntry?.slot.code ?? "",
    posicion: textoUtil(player["POSICIÓN"]),
    linea: slotEntry?.line.key ?? null,
    color: slotEntry?.line.color ?? "#8892A0",
    foto: textoUtil(player.FOTO),
  };
}

const EMPTY_PLAYER_KEYS: (keyof RivalPlayer)[] = [
  "DORSAL",
  "JUGADOR",
  "NOMBRE DEPORTIVO",
  "LUGAR DE NACIMIENTO",
  "EDAD",
  "PESO",
  "ALTURA",
  "POSICIÓN",
  "2º POSICIÓN",
  "PIE DOMINANTE",
  "PROCEDENCIA",
  "FECHA INCORPORACIÓN",
  "IMPACTO",
  "ROL",
  "CARACTERÍSTICAS",
  "FORTALEZAS",
  "DEBILIDADES",
  "OBSERVACIONES",
  "VIDEO",
  "DOC",
  "FOTO",
  "ESTADO",
];

export default function RivalPlayersPage() {
  const [players, setPlayers] = useState<RivalPlayer[]>([]);

  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [reloadKey, setReloadKey] = useState(0);

  /*
  | El enlace directo se resuelve antes del primer render: así la carga de
  | plantillas ya arranca con el equipo puesto y no se ve el salto desde el
  | primero de la lista al del enlace.
  */
  const [enlaceDirecto] = useState(leerEnlaceDirecto);

  const [selectedTeam, setSelectedTeam] = useState<string>(
    () => enlaceDirecto?.equipo ?? "",
  );

  /*
  | En qué orden salen los equipos: por el calendario de la ida, empezando por
  | el rival de esta semana. Se lee de la hoja RIVALES junto con las plantillas
  | —ver la carga de más abajo— y hasta que llega manda el orden alfabético.
  */
  const [ordenRivales, setOrdenRivales] = useState<OrdenRivales>(SIN_ORDEN);

  const [search, setSearch] = useState("");
  const [positionSearch, setPositionSearch] = useState("");

  /*
  | Las etiquetas, plegadas.
  |
  | Son cuatro grupos de píldoras y ocupaban media pantalla por encima del
  | listado; casi siempre se entra a esta pantalla a mirar el campograma, no a
  | filtrar. Se abren desde su propia línea, y las que estén puestas se ven en
  | esa línea aunque esté cerrada: un filtro activo que no se ve es la forma de
  | mirar una lista recortada creyendo que está entera.
  */
  const [etiquetasAbiertas, setEtiquetasAbiertas] = useState(false);

  /* Claves de etiqueta activas: un jugador debe tenerlas TODAS para pasar. */
  const [activeTags, setActiveTags] = useState<string[]>([]);

  const [selectedPlayer, setSelectedPlayer] = useState<RivalPlayer | null>(
    null,
  );

  const [editForm, setEditForm] = useState<RivalPlayer | null>(null);

  const [isCreating, setIsCreating] = useState(false);
  const [saving, setSaving] = useState(false);

  /* Comprueba que la hoja se ha quedado de verdad con lo que se le envía. */
  const {
    verificar: verificarGuardado,
    dialogo: avisoGuardado,
    columnasPerdidas,
  } = useSaveGuard();

  /* Partidos, minutos, goles y tarjetas de BeSoccer (Supabase, sólo lectura). */
  const {
    doc: statsDoc,
    loading: statsLoading,
    missing: statsMissing,
  } = useRivalStats();

  /*
  | El informe del rival (clasificación, resultados, entrenador, estadio y
  | alineaciones). No se pide al abrir la pantalla como las estadísticas: trae
  | la temporada entera de los diecinueve equipos y sólo hace falta cuando se
  | pulsa el botón de descargarlo, así que se baja entonces.
  */
  const { pide: pideInforme } = useRivalInforme();

  const [showPitch, setShowPitch] = useState(true);

  /* Plantilla (listado + campograma) o pizarra táctica del rival. */
  const [view, setView] = useState<"plantilla" | "pizarra">("plantilla");

  const touchStartX = useRef<number | null>(null);

  /* Snapshot del jugador al abrir el modal, para detectar cambios sin guardar. */
  const [pristineForm, setPristineForm] = useState("");

  /*
  | La ficha se consulta mucho más de lo que se edita: los quince campos de
  | datos (altura, peso, procedencia, URLs…) viven plegados detrás de «Editar
  | datos» y lo que manda en pantalla es el análisis del jugador.
  */
  const [editandoDatos, setEditandoDatos] = useState(false);

  useBodyScrollLock(Boolean(editForm));

  /*
  |--------------------------------------------------------------------------
  | CARGA DE PLANTILLAS
  |--------------------------------------------------------------------------
  */

  useEffect(() => {
    let cancelled = false;

    async function loadPlayers() {
      try {
        setLoading(true);
        setLoadError(null);

        /*
        | Las plantillas y el calendario se piden a la vez: son dos hojas del
        | mismo libro y esperar una detrás de otra sólo retrasa la pantalla.
        | `cargaOrdenRivales` no lanza nunca, así que un calendario caído deja
        | las plantillas en orden alfabético en vez de tumbar la página.
        */
        const [data, orden] = await Promise.all([
          traeJson<RivalPlayer[]>(`${RIVALS_API_URL}?action=rivalesPlantillas`, {
            /* El botón de recargar sí vuelve a preguntar. */
            forzar: reloadKey > 0,
          }),
          cargaOrdenRivales(),
        ]);

        if (cancelled) return;

        setOrdenRivales(orden);

        if (Array.isArray(data)) {
          setPlayers(data);

          setSelectedTeam((current) => {
            if (current && data.some((p) => p.NOMBRE_EQUIPO === current)) {
              return current;
            }

            /* Al entrar, el rival de esta semana: es el primero de la fila y
               es la plantilla que se viene a mirar. */
            const equipos = [
              ...new Set(
                data
                  .map((p) => String(p.NOMBRE_EQUIPO || ""))
                  .filter(Boolean),
              ),
            ].sort(comparaPorCalendario(orden));

            return equipos[0] ?? data[0]?.NOMBRE_EQUIPO ?? "";
          });
        } else {
          console.error(data);
          setPlayers([]);
          setLoadError("La respuesta del servidor no es válida.");
        }
      } catch (error) {
        if (cancelled) return;

        console.error("Error cargando jugadores rivales:", error);

        setPlayers([]);
        setLoadError("No se han podido cargar las plantillas rivales.");
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    loadPlayers();

    return () => {
      cancelled = true;
    };
  }, [reloadKey]);

  /*
  |--------------------------------------------------------------------------
  | EQUIPOS
  |--------------------------------------------------------------------------
  */

  /*
  | Los equipos salen **en el orden en que toca jugar contra ellos**,
  | arrancando por el rival de esta semana: es la plantilla que se abre cada
  | lunes. Al día siguiente del partido ese equipo se va al final solo, porque
  | su siguiente partido pasa a ser el de la vuelta.
  |
  | Mientras el calendario no ha llegado —o si la hoja no contesta—
  | `comparaPorCalendario` deja a todos empatados y manda el nombre, que es el
  | orden alfabético de siempre.
  */
  const teams = useMemo(() => {
    const counts = new Map<string, number>();

    players.forEach((player) => {
      const team = String(player.NOMBRE_EQUIPO || "");
      if (!team) return;

      counts.set(team, (counts.get(team) ?? 0) + 1);
    });

    const compara = comparaPorCalendario(ordenRivales);

    return [...counts.entries()]
      .map(([name, count]) => ({ name, count }))
      .sort((a, b) => compara(a.name, b.name));
  }, [players, ordenRivales]);

  /*
  | El escudo de un club rival.
  |
  | Viaja en el documento de estadísticas y no en la hoja: RIVALES escribe por
  | nombre de columna y no tiene ninguna para el escudo, así que un guardado
  | ahí se descartaría en silencio. Lo baja `scripts/rivals-stats.mjs`.
  */
  const escudoDe = useCallback(
    (equipo: { ID_EQUIPO?: unknown; NOMBRE_EQUIPO?: unknown } | string | null) =>
      findTeam(statsDoc, equipo)?.escudo,
    [statsDoc],
  );

  /* La plantilla del equipo elegido, reducida a lo que pinta la pizarra. */
  const boardSquad = useMemo(() => {
    if (!selectedTeam) return null;

    const [squad] = buildRivalSquads(
      players.filter((player) => player.NOMBRE_EQUIPO === selectedTeam),
    );

    return squad ?? { equipo: selectedTeam, players: [] };
  }, [players, selectedTeam]);

  /*
  |--------------------------------------------------------------------------
  | FILTRADO
  |--------------------------------------------------------------------------
  */

  /*
  | Lo que se teclea entra al momento en la caja; la lista se rehace
  | después, y sin bloquear. Son cientos de fichas filtrándose con cada
  | tecla, y hasta ahora el cursor se quedaba atrás al escribir deprisa.
  */
  const searchDiferido = useDeferredValue(search);
  const posicionDiferida = useDeferredValue(positionSearch);

  const filteredPlayers = useMemo(() => {
    const searchValue = normalize(searchDiferido);
    const positionSearchValue = normalize(posicionDiferida);

    return players.filter((player) => {
      const matchesPosition =
        !positionSearchValue ||
        normalize(player["POSICIÓN"]).includes(positionSearchValue) ||
        normalize(player["2º POSICIÓN"]).includes(positionSearchValue) ||
        /* También se puede buscar por el código corto: LD, DFC, MP… */
        normalize(getSlot(player["POSICIÓN"])?.slot.code).startsWith(
          positionSearchValue,
        ) ||
        normalize(getSlot(player["2º POSICIÓN"])?.slot.code).startsWith(
          positionSearchValue,
        );

      if (!matchesPosition) return false;

      /* Sin búsqueda general se muestra solo el equipo seleccionado. */
      if (!searchValue) {
        return player.NOMBRE_EQUIPO === selectedTeam;
      }

      /* Con búsqueda general se busca en todos los equipos. */
      return (
        normalize(player.JUGADOR).includes(searchValue) ||
        normalize(player["NOMBRE DEPORTIVO"]).includes(searchValue) ||
        normalize(player.NOMBRE_EQUIPO).includes(searchValue) ||
        String(player.DORSAL).includes(searchValue) ||
        normalize(player["POSICIÓN"]).includes(searchValue) ||
        normalize(player["2º POSICIÓN"]).includes(searchValue) ||
        normalize(player.ROL).includes(searchValue) ||
        normalize(player.IMPACTO).includes(searchValue)
      );
    });
  }, [players, selectedTeam, searchDiferido, posicionDiferida]);

  /*
  | El filtro por etiquetas sólo recorta el listado: en el campograma se sigue
  | pintando la plantilla entera y los que no cumplen quedan atenuados, que es
  | justo la lectura útil (dónde están los que me interesan).
  */
  const listPlayers = useMemo(() => {
    if (activeTags.length === 0) return filteredPlayers;

    return filteredPlayers.filter((player) => {
      const keys = new Set(
        parseTags(player.IMPACTO).tags.map((tag) => tag.key),
      );

      return activeTags.every((key) => keys.has(key));
    });
  }, [filteredPlayers, activeTags]);

  /* Recuento por etiqueta dentro del ámbito actual, para las píldoras. */
  const tagCounts = useMemo(() => {
    const counts = new Map<string, number>();

    filteredPlayers.forEach((player) => {
      parseTags(player.IMPACTO).tags.forEach((tag) => {
        counts.set(tag.key, (counts.get(tag.key) ?? 0) + 1);
      });
    });

    return counts;
  }, [filteredPlayers]);

  /* Equipos representados en el resultado actual (relevante al buscar global). */
  const teamsInResults = useMemo(() => {
    return [
      ...new Set(filteredPlayers.map((p) => String(p.NOMBRE_EQUIPO || ""))),
    ].filter(Boolean);
  }, [filteredPlayers]);

  /*
  |--------------------------------------------------------------------------
  | CAMPOGRAMA
  |--------------------------------------------------------------------------
  | Sólo tiene sentido con un equipo: si la búsqueda mezcla plantillas nos
  | quedamos con la del equipo seleccionado (o la primera del resultado).
  */

  const pitchTeam = useMemo(() => {
    if (teamsInResults.includes(selectedTeam)) return selectedTeam;
    return teamsInResults[0] ?? "";
  }, [teamsInResults, selectedTeam]);

  const pitchPlayers = useMemo(() => {
    return filteredPlayers.filter(
      (player) =>
        player["POSICIÓN"] && player.NOMBRE_EQUIPO === pitchTeam,
    );
  }, [filteredPlayers, pitchTeam]);

  /*
  |--------------------------------------------------------------------------
  | ONCE PROBABLE
  |--------------------------------------------------------------------------
  | Quién sale de inicio y de quién se duda. Va por equipo, se guarda solo en
  | `app_documents` y no toca la hoja: es una lectura de análisis que cambia
  | varias veces por semana, no un dato del club.
  */

  const once = useRivalOnce(pitchTeam || selectedTeam);

  /*
  | El once vive por equipo, así que sólo se marca a la gente del equipo que
  | está en el campo. Con una búsqueda que cruce plantillas, las filas de los
  | otros equipos se quedan sin control en vez de escribir en el once que no es.
  */
  const onceDe = useCallback(
    (player: RivalPlayer): OnceEstado =>
      player.NOMBRE_EQUIPO === pitchTeam ? once.estado(playerKey(player)) : null,
    [once, pitchTeam],
  );

  const ciclarOnceDe = useCallback(
    (player: RivalPlayer) =>
      player.NOMBRE_EQUIPO === pitchTeam
        ? () => once.ciclar(playerKey(player))
        : undefined,
    [once, pitchTeam],
  );

  const onceResumen = useMemo(() => {
    const claves = new Set(pitchPlayers.map((player) => playerKey(player)));

    /* Sólo cuenta la gente que sigue en la plantilla: si alguien se da de
       baja, su marca no puede seguir sumando en el contador. */
    return {
      titulares: once.doc.titulares.filter((key) => claves.has(key)).length,
      dudas: once.doc.dudas.filter((key) => claves.has(key)).length,
    };
  }, [once.doc, pitchPlayers]);

  /*
  |--------------------------------------------------------------------------
  | PDF DEL ONCE PROBABLE
  |--------------------------------------------------------------------------
  | Once titular y dudas en un documento que se pasa por WhatsApp. De cada
  | jugador sale la misma ficha que se abre al pulsarlo aquí —foto, datos,
  | rendimiento y análisis—, y con dos enlaces vivos: uno a su ficha en la app
  | y otro a su vídeo, tanto en el campograma como en la tarjeta. Lo dibuja
  | `lib/rivals/once-pdf.ts`; aquí sólo se resuelve qué entra y con qué datos.
  |
  | Se mira la plantilla entera del equipo, **no** la lista filtrada: una
  | búsqueda a medias no puede dejar fuera del PDF a medio once.
  |
  | El botón no descarga directamente: abre antes el pop-up
  | `OnceCampoDialog`, donde se coloca a cada uno en el campo y se decide qué
  | dudas se pintan. Lo que se decide ahí se guarda en el documento del once
  | y es lo que se le pasa a `once-pdf`.
  */

  const [exportando, setExportando] = useState(false);

  /* Con el pop-up abierto, lo que se está preparando es el documento. */
  const [preparandoPdf, setPreparandoPdf] = useState(false);

  /* El PDF sale con el tema con el que se está viendo la plataforma: en modo
     día, sobre papel blanco; en modo noche, oscuro como la pantalla. */
  const { theme } = useTheme();

  const equipoDelOnce = pitchTeam || selectedTeam;

  const marcados = useMemo(() => {
    if (!equipoDelOnce) return [];

    return players
      .filter((player) => player.NOMBRE_EQUIPO === equipoDelOnce)
      .map((player) => ({ player, estado: once.estado(playerKey(player)) }))
      .filter(
        (fila): fila is { player: RivalPlayer; estado: OncePdfEstado } =>
          fila.estado !== null,
      );
  }, [players, equipoDelOnce, once]);

  /* Lo que necesita el pop-up: la cara, el dorsal y a qué línea tira cada
     uno. El PDF se monta aparte, con la ficha entera. */
  const campoJugadores = useMemo<OnceCampoFicha[]>(
    () =>
      marcados.map(({ player, estado }) => ({
        ...fichaDeCampo(player),
        estado,
        enCampo: seDibuja(once.doc, playerKey(player)),
      })),
    [marcados, once.doc],
  );

  /*
  | La plantilla entera del rival, de portería a ataque: de aquí salen los
  | recambios cuando en el pop-up se cambia a uno por otro. Va sin filtrar por
  | la búsqueda, igual que `marcados` —una búsqueda a medias no puede esconder
  | al jugador por el que se quiere cambiar—.
  */
  const plantillaDelOnce = useMemo<OnceCampoCandidato[]>(() => {
    if (!equipoDelOnce) return [];

    /* La hoja acaba en filas en blanco —el sitio donde se dan las altas—:
       sin nombre no hay jugador, y además todas comparten clave. */
    const dePlantilla = players.filter(
      (player) =>
        player.NOMBRE_EQUIPO === equipoDelOnce &&
        Boolean(textoUtil(player["NOMBRE DEPORTIVO"]) || textoUtil(player.JUGADOR)),
    );

    /* Sin posición reconocible no hay línea, y ésos van al final: la lista se
       lee de portería a ataque. */
    const linea = (player: RivalPlayer) => {
      const indice = LINE_DEFINITIONS.findIndex(
        (item) => item.key === getLine(player["POSICIÓN"])?.key,
      );

      return indice < 0 ? LINE_DEFINITIONS.length : indice;
    };

    return dePlantilla
      .sort((a, b) => {
        const lineaA = linea(a);
        const lineaB = linea(b);

        if (lineaA !== lineaB) return lineaA - lineaB;

        return positionRank(a["POSICIÓN"]) - positionRank(b["POSICIÓN"]);
      })
      .map(fichaDeCampo);
  }, [players, equipoDelOnce]);

  /*
  | La ficha de un jugador tal y como la pide el PDF: la banda de datos, los
  | enlaces vivos, el mapa de zona y el análisis. La comparten los dos
  | documentos —el del once entero y el del portero—, así que se resuelve aquí
  | una sola vez: dos copias de esto se separan al primer campo nuevo de la
  | hoja.
  */
  const fichaDePdf = useCallback(
    (player: RivalPlayer, estado: OncePdfEstado): OncePdfPlayer => {
      const slotEntry = getSlot(player["POSICIÓN"]);
      const segundo = getSlot(player["2º POSICIÓN"]);

      const stats = findStats(statsDoc, player);

      const edad = textoUtil(player.EDAD);

      /* La misma banda de datos que se lee en la cabecera de la ficha. */
      const datos = [
        { label: "Edad", valor: edad ? `${edad} años` : "" },
        { label: "Altura", valor: textoUtil(player.ALTURA) },
        { label: "Peso", valor: textoUtil(player.PESO) },
        { label: "Pie", valor: textoUtil(player["PIE DOMINANTE"]) },
        { label: "Estado", valor: textoUtil(player.ESTADO) },
        { label: "Procedencia", valor: textoUtil(player.PROCEDENCIA) },
        {
          label: "Nacimiento",
          valor: textoUtil(player["LUGAR DE NACIMIENTO"]),
        },
        {
          label: "Incorporación",
          valor: textoUtil(player["FECHA INCORPORACIÓN"]),
        },
      ].filter((dato) => dato.valor);

      /* La ficha y el vídeo viajan aparte del resto de enlaces: el PDF les
         da sitio propio —un botón cada uno en la tarjeta y su chapa en el
         campograma—, porque son los dos que se buscan con el dedo. */
      const video = textoUtil(player.VIDEO);
      const documento = textoUtil(player.DOC);

      const enlaces: OncePdfEnlace[] = [];

      if (documento) {
        enlaces.push({ label: "Informe", url: enlaceAbrible(documento) });
      }

      /* La ficha de BeSoccer trae vídeos y datos de partido a partido: es
         el segundo sitio al que se va cuando el vídeo propio no basta. */
      if (stats?.url) {
        enlaces.push({ label: "BeSoccer", url: enlaceAbrible(stats.url) });
      }

      return {
        clave: playerKey(player),
        dorsal: textoUtil(player.DORSAL),
        nombre: player["NOMBRE DEPORTIVO"] || player.JUGADOR || "Sin nombre",
        nombreCompleto: textoUtil(player.JUGADOR),
        posCode: slotEntry?.slot.code ?? "",
        posicion: textoUtil(player["POSICIÓN"]),
        segunda:
          segundo && segundo.slot.key !== slotEntry?.slot.key
            ? `2ª ${segundo.slot.code}`
            : "",
        rol: textoUtil(player.ROL),
        linea: slotEntry?.line.key ?? null,
        color: slotEntry?.line.color ?? "#8892A0",
        estado,
        /* Los titulares siempre; las dudas, sólo las que se hayan metido
           en el campo desde el pop-up. */
        enCampo: seDibuja(once.doc, playerKey(player)),
        foto: textoUtil(player.FOTO),
        datos,
        /* El mapa de zona se deduce de la posición, igual que en la ficha
           de pantalla: el slot dice dónde y el lado hacia qué banda. */
        slot: slotEntry?.slot.key ?? null,
        side: detectSide(player["POSICIÓN"] || ""),
        portero: Boolean(stats?.portero),
        temporadas: stats?.temporadas ?? [],
        temporadaActual: statsDoc?.temporada,
        tags: parseTags(player.IMPACTO).tags.map((tag) => ({
          label: tag.short,
          tone: tag.tone,
        })),
        caracteristicas: textoUtil(player["CARACTERÍSTICAS"]),
        fortalezas: textoUtil(player.FORTALEZAS),
        debilidades: textoUtil(player.DEBILIDADES),
        observaciones: textoUtil(player.OBSERVACIONES),
        ficha: new URL(
          fichaRivalPath(player.NOMBRE_EQUIPO, playerKey(player)),
          window.location.origin,
        ).toString(),
        video: video ? enlaceAbrible(video) : "",
        enlaces,
      };
    },
    [statsDoc, once.doc],
  );

  /*
  | Montar el documento y descargarlo. Es lo mismo para las dos hojas —se
  | ordenan los jugadores, se resuelven sus fichas y se guarda—; lo único que
  | cambia es la variante, que es la que pone los rótulos y el nombre del
  | archivo. Devuelve si ha salido, para que quien lo llame cierre su pop-up.
  */
  const exportaPdf = useCallback(
    async (
      variante: OncePdfVariante,
      filas: { player: RivalPlayer; estado: OncePdfEstado }[],
    ) => {
      setExportando(true);

      try {
        const jugadores: OncePdfPlayer[] = [...filas]
          .sort((a, b) => ordenDelOnce(a.player, b.player))
          .map(({ player, estado }) => fichaDePdf(player, estado));

        const { exportOncePdf } = await import("@/lib/rivals/once-pdf");

        const nombre = await exportOncePdf({
          equipo: equipoDelOnce,
          /* El escudo firma el título de la portada: en una carpeta con los
             diecinueve documentos del grupo es lo que dice de quién es cada
             hoja de un vistazo. */
          escudo: escudoDe(equipoDelOnce),
          jugadores,
          tema: theme,
          /* Dónde ha dejado el entrenador a cada uno en el pop-up. */
          campo: once.doc.campo,
          variante,
        });

        toast.success(
          variante === "portero"
            ? "PDF para el portero exportado"
            : "Once probable exportado",
          { description: nombre },
        );

        return true;
      } catch (error) {
        console.error("Error exportando el PDF del rival:", error);

        toast.error("No se ha podido generar el PDF.");

        return false;
      } finally {
        setExportando(false);
      }
    },
    [equipoDelOnce, escudoDe, theme, once.doc, fichaDePdf],
  );

  const exportarOncePdf = useCallback(async () => {
    if (!marcados.length) return;

    if (await exportaPdf("once", marcados)) setPreparandoPdf(false);
  }, [marcados, exportaPdf]);

  /*
  |--------------------------------------------------------------------------
  | EL .PPTX DE DÍA DE PARTIDO
  |--------------------------------------------------------------------------
  | La plantilla entera colocada en el campo, con **cada jugador como una
  | imagen suelta de PowerPoint**: cuando se cruzan alineaciones se borra a los
  | que no salen y lo que queda es el once del rival, ya colocado.
  |
  | No pasa por pop-up como el PDF, y es a propósito: aquí no hay nada que
  | elegir —sale la plantilla entera, que es el punto— y el sitio donde se
  | decide quién juega es el propio PowerPoint, media hora antes del partido.
  */
  /*
  | La plantilla del rival con la ficha entera: cara, dorsal, pie, altura, peso
  | y los números de la temporada que manda.
  |
  | La comparten el campograma de día de partido y las dos hojas de campograma
  | del informe del rival, que llevan **la misma ficha** a propósito: el mismo
  | equipo no puede salir de dos maneras distintas en dos documentos de la
  | misma carpeta.
  */
  /*
  | Va sobre **la plantilla entera del equipo**, no sobre la lista filtrada.
  |
  | Los dos documentos que la usan dicen lo mismo en su botón: «la plantilla
  | entera colocada, para borrar a los que no salgan». Saliendo de
  | `pitchPlayers`, una búsqueda a medias —«zurdo», el nombre de uno— dejaba
  | fuera del PowerPoint a los que no coincidían, sin avisar; es el mismo
  | motivo por el que `marcados` y `plantillaDelOnce` no miran el filtro.
  |
  | Y de aquí sale además el reparto de claves con el que se propone el once,
  | así que un jugador que no esté aquí no podría proponerse.
  */
  const plantillaDelEquipo = useMemo(
    () =>
      players.filter(
        (player) =>
          player.NOMBRE_EQUIPO === (pitchTeam || selectedTeam) &&
          player["POSICIÓN"],
      ),
    [players, pitchTeam, selectedTeam],
  );

  const jugadoresPlantilla = useMemo<AlineacionJugador[]>(
    () =>
      plantillaDelEquipo.map((player) => {
        const stats = findStats(statsDoc, player);

        /* La temporada en curso, la misma que resalta la ficha. Estas cifras
           van a las hojas de plantilla y de once probable del informe y al
           campograma de día de partido, donde se pinta **una sola temporada y
           sin etiqueta**: si fuera la del año pasado, quien mire el documento
           daría por hecho que es la de ahora. */
        const season = highlightSeason(
          stats?.temporadas ?? [],
          statsDoc?.temporada,
        );

        return {
          clave: playerKey(player),
          dorsal: textoUtil(player.DORSAL),
          nombre: player["NOMBRE DEPORTIVO"] || player.JUGADOR || "Sin nombre",
          slot: getSlot(player["POSICIÓN"])?.slot.key ?? "otros",
          lado: detectSide(normalize(player["POSICIÓN"])) as -1 | 0 | 1,
          edad: textoUtil(player.EDAD),
          /* En bruto: el «1,84» contra «184» y el «DCHO» contra «Diestro» los
             resuelve el documento, que es el que sabe cómo se lee proyectado. */
          pie: textoUtil(player["PIE DOMINANTE"]),
          altura: textoUtil(player.ALTURA),
          peso: textoUtil(player.PESO),
          foto: fotoGrande(textoUtil(player.FOTO)),
          estado: textoUtil(player.ESTADO),
          portero: Boolean(stats?.portero),
          titular: season ? season.titular : null,
          goles: season?.goles ?? null,
          encajados: season?.encajados ?? null,
        };
      }),
    [plantillaDelEquipo, statsDoc],
  );

  /*
  | Dónde está puesto cada uno del once probable, en tanto por uno del campo
  | vertical: lo mismo que ve el pop-up del PDF y lo que se lleva la hoja de
  | «once probable» del informe. Quien tenga sitio a mano se queda con el suyo.
  */
  const onceProbableSitios = useMemo(() => {
    const enCampo = campoJugadores.filter((jugador) => jugador.enCampo);

    if (enCampo.length === 0) return [];

    const sitios = reparteCampo(enCampo, once.doc.campo);

    return enCampo.flatMap((jugador) => {
      const sitio = sitios.get(jugador.clave);

      return sitio
        ? [
            {
              clave: jugador.clave,
              x: sitio.x,
              y: sitio.y,
              estado: jugador.estado,
            },
          ]
        : [];
    });
  }, [campoJugadores, once.doc.campo]);

  /*
  |--------------------------------------------------------------------------
  | EL ONCE QUE SE PROPONE
  |--------------------------------------------------------------------------
  | Hay diecinueve rivales y la semana tiene los días que tiene: al abrir un
  | equipo al que todavía no se había mirado no hay once marcado, así que la
  | hoja de «once probable» del informe no salía y el documento llegaba a la
  | charla sin ella.
  |
  | Aquí se propone uno con los onces que el rival viene sacando
  | (`lib/rivals/once-sugerido.ts`). No decide nada: lo escribe en el documento
  | del once **como si lo hubiera puesto una persona**, así que después se
  | cambia con un clic en la lista, se arrastra en el pop-up del PDF o se
  | sustituye entero. Lo que diga el cuerpo técnico manda.
  |
  | El informe no se pide al abrir la pantalla —trae la temporada entera de los
  | diecinueve equipos—, así que se baja aquí, en el clic.
  */
  const [sugiriendo, setSugiriendo] = useState(false);

  const proponeOnce = useCallback(
    async (informeDoc?: Awaited<ReturnType<typeof pideInforme>>) => {
      if (!equipoDelOnce) return null;

      const doc = informeDoc ?? (await pideInforme());

      const informe = findInforme(doc, equipoDelOnce);

      if (!informe) return null;

      return sugiereOnce(informe, jugadoresPlantilla);
    },
    [equipoDelOnce, jugadoresPlantilla, pideInforme],
  );

  const sugerirOnce = useCallback(async () => {
    if (!equipoDelOnce) return;

    setSugiriendo(true);

    try {
      const sugerido = await proponeOnce();

      if (!sugerido) {
        toast.error("No hay de dónde sacar el once de este equipo.", {
          description:
            "Hacen falta alineaciones bajadas: «node scripts/rivals-informe.mjs».",
        });

        return;
      }

      once.proponer(sugerido.titulares, sugerido.campo);

      toast.success(`Once probable propuesto · ${explicaSugerencia(sugerido)}`, {
        description:
          sugerido.sinFicha.length > 0
            ? `Sin ficha en la hoja: ${sugerido.sinFicha.join(", ")}`
            : "Cámbialo pulsando a cualquiera de la lista.",
      });
    } catch (error) {
      console.error("Error proponiendo el once del rival:", error);

      toast.error("No se ha podido proponer el once.");
    } finally {
      setSugiriendo(false);
    }
  }, [equipoDelOnce, once, proponeOnce]);

  const exportarAlineacionPptx = useCallback(async () => {
    if (!pitchPlayers.length) return;

    setExportando(true);

    try {
      const { exportAlineacionPptx } = await import(
        "@/lib/rivals/alineacion-ppt"
      );

      const nombre = await exportAlineacionPptx({
        equipo: equipoDelOnce,
        escudo: escudoDe(equipoDelOnce),
        temporada: temporadaCorta(statsDoc?.temporada),
        jugadores: jugadoresPlantilla,
      });

      toast.success("Campograma de día de partido exportado", {
        description: `${nombre} · borra en PowerPoint a los que no salen`,
      });
    } catch (error) {
      console.error("Error exportando el campograma del rival:", error);

      toast.error(
        error instanceof Error
          ? error.message
          : "No se ha podido generar el PowerPoint.",
      );
    } finally {
      setExportando(false);
    }
  }, [pitchPlayers, jugadoresPlantilla, statsDoc, equipoDelOnce, escudoDe]);

  /*
  |--------------------------------------------------------------------------
  | EL INFORME DEL RIVAL (.pptx)
  |--------------------------------------------------------------------------
  | Las diez diapositivas de `public/INFORME RIVAL.pptx` —clasificación,
  | resultados con sus goleadores, estadísticas, entrenador, estadio y las
  | últimas alineaciones— montadas con lo que `scripts/rivals-informe.mjs` baja
  | de BeSoccer. Lo dibuja `lib/rivals/informe-ppt.ts`.
  |
  | Aquí sólo se resuelve **de qué partido se habla**: la jornada en la que
  | toca este rival y si se juega en su campo, que es lo que decide qué tabla
  | de la clasificación se destaca. Sale del calendario de la hoja, el mismo
  | que ordena la fila de equipos.
  |
  | **Sí pasa por pop-up**, al revés que el campograma. No para elegir datos
  | —eso lo decide el calendario—, sino para dar el último repaso al documento:
  | el informe se monta en piezas sueltas y en `InformePptEditor` se mueven, se
  | replican y se borran antes de exportar. Lo que salga de ahí es lo que se
  | escribe en el `.pptx`, con cada pieza como objeto propio de PowerPoint.
  */
  const [hojasInforme, setHojasInforme] = useState<HojaInforme[] | null>(null);

  const [datosInforme, setDatosInforme] = useState<InformeData | null>(null);

  /*
  |--------------------------------------------------------------------------
  | QUÉ PARTIDOS SE LLEVAN LAS HOJAS DE PARTIDOS (LAS 9 Y 10)
  |--------------------------------------------------------------------------
  |
  | Antes iban siempre los seis últimos onces bajados y salían tres hojas. En
  | agosto eso son dos hojas de amistosos y el partido que de verdad se estudia
  | queda en la tercera, así que ahora se eligen: un pop-up con los partidos
  | que tienen alineación bajada, cuatro marcados de casa —los últimos de
  | liga— y dos por diapositiva.
  |
  | Se guarda el documento entero de BeSoccer al abrir el pop-up para no
  | volver a bajarlo al aceptar: son los diecinueve equipos de la temporada.
  */
  const [eleccionInforme, setEleccionInforme] = useState<{
    doc: Awaited<ReturnType<typeof pideInforme>>;
    informe: InformeEquipo;
    partidos: PartidoElegible[];
    porDefecto: string[];
  } | null>(null);

  const [partidosInforme, setPartidosInforme] = useState<string[]>([]);

  const abrirInforme = useCallback(async () => {
    if (!selectedTeam) return;

    setExportando(true);

    try {
      const doc = await pideInforme();

      const informe = findInforme(doc, selectedTeam);

      if (!informe) {
        toast.error("Todavía no hay informe de este equipo.", {
          description:
            "Se descarga con «node scripts/rivals-informe.mjs» y se guarda en Supabase.",
        });

        return;
      }

      /* Elegibles son los que tienen alineación: sin ella no hay campograma
         que dibujar y la hoja saldría vacía. */
      const porId = new Map(informe.partidos.map((uno) => [uno.id, uno]));

      const partidos: PartidoElegible[] = informe.onces.flatMap((once) => {
        const partido = porId.get(once.partidoId);

        if (!partido) return [];

        const contra = partido.enCasa ? partido.visitante : partido.local;

        return [
          {
            id: partido.id,
            fecha: fechaDePartido(partido.fecha),
            competicion: partido.competicion,
            deLiga: esLiga(partido),
            rival: contra.nombre,
            enCasa: partido.enCasa,
            marcador: partido.jugado
              ? `${partido.local.goles ?? 0}-${partido.visitante.goles ?? 0}`
              : "—",
            resultado: partido.resultado,
          },
        ];
      });

      /*
      | Los cuatro últimos de liga. Si no llegan a cuatro —agosto, cuando la
      | mitad de lo bajado es pretemporada— se completan con lo que haya, que
      | es mejor que dejar media hoja en blanco.
      */
      const porDefecto = new Set(
        [
          ...partidos.filter((uno) => uno.deLiga),
          ...partidos.filter((uno) => !uno.deLiga),
        ]
          .slice(0, PARTIDOS_INFORME_POR_DEFECTO)
          .map((uno) => uno.id),
      );

      /* Siempre en el orden de la lista —del más reciente al más antiguo—,
         que es el orden en el que van a salir las hojas. */
      const marcados = partidos
        .map((uno) => uno.id)
        .filter((id) => porDefecto.has(id));

      setEleccionInforme({ doc, informe, partidos, porDefecto: marcados });
      setPartidosInforme(marcados);
    } catch (error) {
      console.error("Error pidiendo el informe del rival:", error);

      toast.error(
        error instanceof Error
          ? error.message
          : "No se ha podido cargar el informe.",
      );
    } finally {
      setExportando(false);
    }
  }, [selectedTeam, pideInforme]);

  const montarInforme = useCallback(
    async (elegidos: string[]) => {
      if (!eleccionInforme || !selectedTeam) return;

      const { doc, informe } = eleccionInforme;

      setExportando(true);

      try {
        const partido = enfrentamientoDe(ordenRivales, selectedTeam);

        /*
        | La hoja de «once probable» tiene que salir **en todos** los informes.
        | Si el cuerpo técnico no ha marcado a nadie todavía —diecinueve
        | rivales y una semana— se propone uno con los onces que el rival viene
        | sacando, y se dice en la propia hoja que es una propuesta. Marcarlo a
        | mano en la pantalla lo sustituye siempre.
        */
        let sugerido: OnceSugerido | null = null;

        if (onceProbableSitios.length === 0) {
          sugerido = await proponeOnce(doc);
        }

        const onceProbable = sugerido
          ? sugerido.titulares.flatMap((clave) => {
              const pos = sugerido!.campo[clave];

              return pos
                ? [{ clave, x: pos.x, y: pos.y, estado: "titular" as const }]
                : [];
            })
          : onceProbableSitios;

        const data: InformeData = {
          informe,
          jornada: partido?.jornada ?? "",
          fecha: partido?.fecha ?? "",
          /* `local` de la hoja es **nuestro** campo: en su campo es lo
             contrario. Sin calendario se asume fuera, que es cuando el informe
             se mira con más detalle. */
          enSuCampo: partido ? !partido.local : true,
          temporada: temporadaCorta(doc?.temporada),
          competicion: doc?.competicion ?? "",
          /* Las dos hojas de campograma salen de la hoja RIVALES y del once
             que ha colocado el cuerpo técnico, no de BeSoccer. */
          plantilla: jugadoresPlantilla,
          onceProbable,
          /* Para que la hoja lo diga: un once propuesto no es el del míster. */
          onceSugerido: sugerido
            ? { motivo: explicaSugerencia(sugerido) }
            : undefined,
          /* Y los partidos que se han marcado en el pop-up: dos por hoja. */
          partidosElegidos: elegidos,
          /* El reparto de goles que ha escrito el analista en ese mismo
             pop-up; sin nada escrito, las casillas salen punteadas. */
          tipologia: await leeTipologia(equipoDelOnce),
        };

        const { construyeHojasInforme } = await import(
          "@/lib/rivals/informe-ppt"
        );

        const hojas = await construyeHojasInforme(data);

        setDatosInforme(data);
        setHojasInforme(hojas);
        setEleccionInforme(null);
      } catch (error) {
        console.error("Error montando el informe del rival:", error);

        toast.error(
          error instanceof Error
            ? error.message
            : "No se ha podido generar el informe.",
        );
      } finally {
        setExportando(false);
      }
    },
    [
      eleccionInforme,
      selectedTeam,
      /* Es de quién lee la tipología escrita a mano: sin esto, el informe del
         segundo rival de la sesión se montaría con los números del primero. */
      equipoDelOnce,
      ordenRivales,
      proponeOnce,
      jugadoresPlantilla,
      onceProbableSitios,
    ],
  );

  /** Lo que sale del editor: las hojas ya retocadas, al `.pptx`. */
  const exportarInformeEditado = useCallback(
    async (hojas: HojaInforme[]) => {
      if (!datosInforme) return;

      setExportando(true);

      try {
        const { exportaHojasInforme } = await import(
          "@/lib/rivals/informe-ppt"
        );

        const nombre = await exportaHojasInforme(hojas, datosInforme);

        toast.success("Informe del rival exportado", {
          description: `${nombre} · cada elemento va suelto y se edita en PowerPoint`,
        });

        setHojasInforme(null);
      } catch (error) {
        console.error("Error exportando el informe del rival:", error);

        toast.error(
          error instanceof Error
            ? error.message
            : "No se ha podido generar el informe.",
        );
      } finally {
        setExportando(false);
      }
    },
    [datosInforme],
  );

  /*
  |--------------------------------------------------------------------------
  | PDF PARA EL PORTERO
  |--------------------------------------------------------------------------
  | El mismo documento que el del once —portada, campo, fichas y saltos
  | internos—, pero con los jugadores que el portero tiene que llevarse
  | estudiados en vez de con el equipo entero. Lo dibuja el mismo módulo, con
  | otra variante (`lib/rivals/once-pdf.ts`).
  |
  | Se elige entre los que están marcados en el once, que es de donde sale
  | todo este flujo: quien no está ni de titular ni de duda no tiene ficha que
  | llevarse. Vienen marcados de casa los extremos, los delanteros y las
  | medias puntas, y desde el pop-up se quita o se añade a quien haga falta.
  */

  const [preparandoPortero, setPreparandoPortero] = useState(false);

  /*
  | Lo elegido a mano, con el equipo al que pertenece: cambiar de rival deja
  | la elección sin sentido —son otras claves— y guardar de quién era es lo
  | que la caduca sola, sin un efecto que la vacíe.
  |
  | Mientras no se haya tocado nada vale `null` y mandan los de siempre.
  */
  const [elegidosPortero, setElegidosPortero] = useState<{
    equipo: string;
    claves: string[];
  } | null>(null);

  const porteroElegidos =
    elegidosPortero && elegidosPortero.equipo === equipoDelOnce
      ? elegidosPortero.claves
      : null;

  /*
  | De quién se elige.
  |
  | Lo normal es que sean los del once probable, que es de donde sale este
  | flujo. Pero el botón está para todos los equipos —no sólo para el que se
  | está preparando—, y en un rival sin once marcado la lista salía vacía y el
  | pop-up no servía para nada: entonces se ofrece la plantilla entera.
  */
  const sinOnceMarcado = marcados.length === 0;

  const fuentePortero = useMemo(() => {
    if (!sinOnceMarcado) return marcados;

    if (!equipoDelOnce) return [];

    return players
      .filter(
        (player) =>
          player.NOMBRE_EQUIPO === equipoDelOnce &&
          Boolean(
            textoUtil(player["NOMBRE DEPORTIVO"]) || textoUtil(player.JUGADOR),
          ),
      )
      .map((player) => ({ player, estado: "titular" as OncePdfEstado }));
  }, [equipoDelOnce, marcados, players, sinOnceMarcado]);

  const candidatosPortero = useMemo<PorteroCandidato[]>(
    () =>
      [...fuentePortero]
        .sort((a, b) => ordenDelOnce(a.player, b.player))
        .map(({ player, estado }) => {
          const slotEntry = getSlot(player["POSICIÓN"]);

          return {
            ...fichaDeCampo(player),
            grupo: slotEntry?.line.title ?? "SIN POSICIÓN",
            estado,
          };
        }),
    [fuentePortero],
  );

  const porteroPorDefecto = useMemo(
    () =>
      candidatosPortero
        .filter((candidato) => {
          const clave = getSlot(candidato.posicion)?.slot.key;

          return Boolean(clave && SLOTS_DEL_PORTERO.has(clave));
        })
        .map((candidato) => candidato.clave),
    [candidatosPortero],
  );

  const exportarPorteroPdf = useCallback(
    async (claves: string[]) => {
      const elegidos = new Set(claves);

      const filas = fuentePortero.filter(({ player }) =>
        elegidos.has(playerKey(player)),
      );

      if (!filas.length) return;

      if (await exportaPdf("portero", filas)) setPreparandoPortero(false);
    },
    [fuentePortero, exportaPdf],
  );


  /*
  |--------------------------------------------------------------------------
  | PORTADA DEL JUGADOR
  |--------------------------------------------------------------------------
  | La diapositiva que abre un análisis individual: escudo del rival, cara del
  | jugador y "ANÁLISIS INDIVIDUAL" a toda página, con los números de la
  | temporada que manda. La dibuja `lib/rivals/portada.ts`; aquí sólo se
  | resuelve con qué datos.
  |
  | La descarga no sale de la ficha sino del botón flotante de exportar, junto
  | al PNG y a los dos PDF: es el mismo gesto —«llévame esto»— y no tenía
  | sentido repartirlo en dos sitios de la pantalla. Como ese botón vive en el
  | layout y no sabe qué hay debajo, la portada se le **ofrece** mientras la
  | ficha está abierta (`lib/rivals/portada-slot.ts`).
  */
  const datosPortada = useMemo<PortadaData | null>(() => {
    if (!editForm || isCreating) return null;

    const stats = findStats(statsDoc, editForm);

    /* La temporada en curso, la misma que resalta la ficha y la que rotula
       la portada. */
    const season = highlightSeason(
      stats?.temporadas ?? [],
      statsDoc?.temporada,
    );

    return {
      equipo: textoUtil(editForm.NOMBRE_EQUIPO),
      escudo: escudoDe(editForm),
      temporada: temporadaCorta(statsDoc?.temporada),
      nombre:
        editForm["NOMBRE DEPORTIVO"] || editForm.JUGADOR || "Sin nombre",
      nombreCompleto: textoUtil(editForm.JUGADOR),
      posicion: textoUtil(editForm["POSICIÓN"]),
      pieDominante: textoUtil(editForm["PIE DOMINANTE"]),
      /* En bruto: las unidades y el «1,84» contra «184» los resuelve la
         portada, que es la que sabe cómo se lee proyectado. */
      altura: textoUtil(editForm.ALTURA),
      edad: textoUtil(editForm.EDAD),
      peso: textoUtil(editForm.PESO),
      dorsal: textoUtil(editForm.DORSAL),
      foto: fotoGrande(textoUtil(editForm.FOTO)),
      contexto: season
        ? [season.temporada, season.equipos.join(" / ")]
            .filter(Boolean)
            .join(" · ")
        : undefined,
      metricas: season
        ? metricasDeTemporada(season, Boolean(stats?.portero))
        : undefined,
    };
  }, [editForm, isCreating, statsDoc, escudoDe]);

  /*
  | Los datos van por referencia y no dentro de lo que se ofrece: el objeto se
  | rehace con cada tecla que se escribe en la ficha, y registrarlo cada vez
  | obligaría a repintar el menú del botón flotante mientras se teclea. Lo que
  | se ofrece sólo cambia al cambiar de jugador.
  */
  const portadaRef = useRef<PortadaData | null>(null);

  useEffect(() => {
    portadaRef.current = datosPortada;
  }, [datosPortada]);

  const etiquetaPortada = datosPortada
    ? [datosPortada.nombre, datosPortada.equipo].filter(Boolean).join(" · ")
    : "";

  useEffect(() => {
    if (!etiquetaPortada) {
      ofrecePortada(null);

      return;
    }

    ofrecePortada({
      etiqueta: etiquetaPortada,
      exportar: (formato) => {
        const data = portadaRef.current;

        if (!data) throw new Error("Ya no hay ninguna ficha abierta.");

        return formato === "png"
          ? exportPortadaPng(data)
          : exportPortadaPdf(data);
      },
    });

    return () => {
      ofrecePortada(null);
    };
  }, [etiquetaPortada]);

  /*
  |--------------------------------------------------------------------------
  | AGRUPACIÓN POR LÍNEAS
  |--------------------------------------------------------------------------
  */

  const lines = useMemo(() => {
    return LINE_DEFINITIONS.map((line) => {
      const linePlayers = listPlayers
        .filter((player) => getLine(player["POSICIÓN"])?.key === line.key)
        .sort((a, b) => {
          const rankA = positionRank(a["POSICIÓN"]);
          const rankB = positionRank(b["POSICIÓN"]);

          if (rankA !== rankB) return rankA - rankB;

          return (Number(a.DORSAL) || 999) - (Number(b.DORSAL) || 999);
        });

      /* Subgrupos por posición concreta, en el orden de los slots. */
      const groups = line.slots
        .map((slot) => ({
          slot,
          players: linePlayers.filter(
            (player) => getSlot(player["POSICIÓN"])?.slot.key === slot.key,
          ),
        }))
        .filter((group) => group.players.length > 0);

      return { ...line, players: linePlayers, groups };
    });
  }, [listPlayers]);

  /* Jugadores cuya posición no encaja en ninguna línea conocida. */
  const unclassified = useMemo(() => {
    return listPlayers.filter((player) => !getLine(player["POSICIÓN"]));
  }, [listPlayers]);

  /*
  |--------------------------------------------------------------------------
  | ABRIR / CERRAR JUGADOR
  |--------------------------------------------------------------------------
  */

  const createEmptyPlayer = useCallback((): RivalPlayer => {
    const empty = {
      ID_JUGADOR: "",
      ID_EQUIPO: "",
      NOMBRE_EQUIPO: selectedTeam,
    } as RivalPlayer;

    EMPTY_PLAYER_KEYS.forEach((key) => {
      (empty as Record<string, unknown>)[key] = "";
    });

    empty.ESTADO = "ACTIVO";

    return empty;
  }, [selectedTeam]);

  /*
  | Cambiar de ficha con el retardo del autoguardado a medias se llevaría por
  | delante lo último escrito, así que primero se consolida. El puente por
  | referencia hace falta porque el hook se declara más abajo.
  */
  const flushFicha = useRef<() => Promise<void>>(async () => {});

  const openPlayer = useCallback((player: RivalPlayer) => {
    void flushFicha.current().then(() => {
      const copy = { ...player };

      setIsCreating(false);
      setSelectedPlayer(player);
      setPristineForm(JSON.stringify(copy));
      setEditForm(copy);
    });
  }, []);

  const openCreatePlayer = () => {
    void flushFicha.current().then(() => {
      const empty = createEmptyPlayer();

      setIsCreating(true);
      setSelectedPlayer(null);
      setPristineForm(JSON.stringify(empty));
      setEditForm(empty);
    });
  };

  /*
  |--------------------------------------------------------------------------
  | ENLACE DIRECTO A UNA FICHA
  |--------------------------------------------------------------------------
  | El equipo ya viaja en el estado inicial; lo que falta es abrir la ficha, y
  | para eso hacen falta las plantillas cargadas.
  |
  | La clave del jugador es la misma que usa el once (`playerKey`), no el
  | `ID_JUGADOR` de la hoja: esos se renumeran con cada alta y el enlace
  | acabaría apuntando a otro.
  */

  const enlaceAtendido = useRef(false);

  useEffect(() => {
    if (enlaceAtendido.current || !enlaceDirecto || !players.length) return;

    enlaceAtendido.current = true;

    const { equipo, clave } = enlaceDirecto;

    if (clave) {
      const encontrado = players.find(
        (player) =>
          playerKey(player) === clave &&
          (!equipo || player.NOMBRE_EQUIPO === equipo),
      );

      if (encontrado) openPlayer(encontrado);
      else toast.error("Ese jugador ya no está en la plantilla del rival.");
    }

    /* La URL vuelve a su sitio: si no, recargar reabriría la ficha y quien
       copiase la barra de direcciones compartiría la de otro jugador. */
    window.history.replaceState(null, "", window.location.pathname);
  }, [enlaceDirecto, players, openPlayer]);

  const isDirty =
    editForm !== null && JSON.stringify(editForm) !== pristineForm;

  const closePlayer = useCallback(
    (force = false) => {
      /* Con un jugador nuevo a medias todavía no hay nada guardado: la ficha
         sigue siendo la única copia y por eso aquí sí se pregunta. */
      if (!force && isCreating && isDirty) {
        const confirmed = window.confirm(
          "El jugador nuevo no se ha añadido todavía. ¿Descartarlo?",
        );

        if (!confirmed) return;
      }

      /* Los cambios sobre un jugador que ya existe se guardan solos; lo que
         quede pendiente sale ahora, sin preguntar nada. */
      if (!isCreating) void flushFicha.current();

      setSelectedPlayer(null);
      setEditForm(null);
      setIsCreating(false);
      setPristineForm("");
    },
    [isDirty, isCreating],
  );

  const updateForm = (key: keyof RivalPlayer, value: string) => {
    setEditForm((current) =>
      current ? { ...current, [key]: value } : current,
    );
  };

  /*
  |--------------------------------------------------------------------------
  | DICTADO POR VOZ
  |--------------------------------------------------------------------------
  | El dictado escribe en el formulario y de ahí lo recoge el autoguardado,
  | igual que si se hubiera tecleado: hay unos segundos de margen para
  | corregir antes de que salga hacia la hoja.
  */

  /* Del catálogo de etiquetas al dictado solo le hace falta cómo se llaman. */
  const voiceTagCatalog = useMemo(
    () =>
      PLAYER_TAGS.map(({ key, label, aliases }) => ({ key, label, aliases })),
    [],
  );

  const voiceTagKeys = useMemo(
    () => parseTags(editForm?.IMPACTO).tags.map((tag) => tag.key),
    [editForm?.IMPACTO],
  );

  const applyVoice = useCallback(
    ({
      campos,
      etiquetas,
    }: {
      campos: Partial<Record<RivalVoiceField, string>>;
      etiquetas: string[] | null;
    }) => {
      setEditForm((current) => {
        if (!current) return current;

        const next = { ...current, ...campos } as RivalPlayer;

        if (etiquetas) {
          const known = new Map(PLAYER_TAGS.map((tag) => [tag.key, tag]));

          next.IMPACTO = serializeTags({
            tags: etiquetas
              .map((key) => known.get(key))
              .filter((tag): tag is PlayerTag => Boolean(tag)),
            /* El texto suelto que ya hubiera en IMPACTO se respeta. */
            extra: parseTags(current.IMPACTO).extra,
          });
        }

        return next;
      });
    },
    [],
  );

  /*
  |--------------------------------------------------------------------------
  | DERIVADOS DE LA FICHA
  |--------------------------------------------------------------------------
  */

  const slotDelJugador = useMemo(
    () => (editForm ? getSlot(editForm["POSICIÓN"]) : null),
    [editForm],
  );

  /*
  | Los datos de la cabecera, en horizontal. Sólo entran los que tienen valor:
  | una chapa que pone "Peso —" ocupa el mismo sitio que una que informa.
  */
  const datosCabecera = useMemo(() => {
    if (!editForm) return [];

    const limpio = (valor: unknown) => {
      const texto = String(valor ?? "").trim();

      /* La hoja escribe "." donde no hay dato (ver la 2ª posición). */
      return texto && texto !== "." ? texto : "";
    };

    return [
      { label: "Edad", valor: limpio(editForm.EDAD) },
      { label: "Altura", valor: limpio(editForm.ALTURA) },
      { label: "Peso", valor: limpio(editForm.PESO) },
      { label: "Pie", valor: limpio(editForm["PIE DOMINANTE"]) },
      { label: "Estado", valor: limpio(editForm.ESTADO) },
      { label: "Procedencia", valor: limpio(editForm.PROCEDENCIA) },
      { label: "Nacimiento", valor: limpio(editForm["LUGAR DE NACIMIENTO"]) },
      {
        label: "Incorporación",
        valor: limpio(editForm["FECHA INCORPORACIÓN"]),
      },
    ].filter((dato) => dato.valor);
  }, [editForm]);

  /*
  | Estadísticas del jugador y, con ellas, su ficha en BeSoccer.
  |
  | El enlace lo llevaba el PDF del once y no la pantalla, que es donde más se
  | usa: es a donde se va cuando el vídeo propio no basta —ahí están los datos
  | partido a partido y los vídeos de BeSoccer—. La URL no está en la hoja: la
  | trae el documento de estadísticas, que es quien sabe con qué ficha se ha
  | emparejado a cada uno.
  */
  const statsDelJugador = useMemo(
    () => (editForm ? findStats(statsDoc, editForm) : null),
    [statsDoc, editForm],
  );

  const besoccerDelJugador = statsDelJugador?.url
    ? enlaceAbrible(statsDelJugador.url)
    : "";

  /*
  | El once vive por equipo: la ficha sólo lo ofrece si el jugador es del
  | equipo que hay en el campo. Con un jugador de otro equipo (búsqueda global)
  | no hay nada que marcar sin escribir en el once que no es.
  */
  const onceDelJugador = useMemo(() => {
    if (!editForm || isCreating) return null;

    if (editForm.NOMBRE_EQUIPO !== pitchTeam) return null;

    const key = playerKey(editForm);

    return {
      estado: once.estado(key),
      marcar: (siguiente: OnceEstado) => once.marcar(key, siguiente),
    };
  }, [editForm, isCreating, once, pitchTeam]);

  /*
  |--------------------------------------------------------------------------
  | NAVEGACIÓN
  |--------------------------------------------------------------------------
  */

  const selectedIndex = selectedPlayer
    ? listPlayers.findIndex(
        (player) => player.ID_JUGADOR === selectedPlayer.ID_JUGADOR,
      )
    : -1;

  const navigatePlayer = useCallback(
    (direction: number) => {
      if (selectedIndex === -1 || listPlayers.length === 0) return;

      const nextIndex = selectedIndex + direction;

      if (nextIndex < 0 || nextIndex >= listPlayers.length) return;

      if (isDirty) {
        const confirmed = window.confirm(
          "Hay cambios sin guardar. ¿Seguro que quieres cambiar de jugador?",
        );

        if (!confirmed) return;
      }

      openPlayer(listPlayers[nextIndex]);
    },
    [selectedIndex, listPlayers, openPlayer, isDirty],
  );

  /*
  |--------------------------------------------------------------------------
  | TECLADO
  |--------------------------------------------------------------------------
  | Las flechas no deben navegar entre jugadores mientras se está escribiendo
  | dentro de un campo del formulario.
  */

  useEffect(() => {
    if (!editForm) return;

    const handleKeyDown = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement | null;

      const typing =
        target instanceof HTMLInputElement ||
        target instanceof HTMLTextAreaElement ||
        target instanceof HTMLSelectElement ||
        target?.isContentEditable;

      if (event.key === "Escape") {
        closePlayer();
        return;
      }

      if (typing || isCreating) return;

      if (event.key === "ArrowLeft") navigatePlayer(-1);
      if (event.key === "ArrowRight") navigatePlayer(1);
    };

    window.addEventListener("keydown", handleKeyDown);

    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [editForm, isCreating, navigatePlayer, closePlayer]);

  /*
  |--------------------------------------------------------------------------
  | AUTOGUARDADO DE LA FICHA
  |--------------------------------------------------------------------------
  |
  | Una ficha de rival se rellena a trozos: se ve un vídeo, se anota una
  | debilidad, se cambia de jugador con las flechas. Ahí es donde un
  | «Guardar» olvidado se lleva el trabajo, así que lo escrito sale solo unos
  | segundos después.
  |
  | Sólo para jugadores que ya existen. Dar de alta a uno nuevo sigue siendo
  | un botón: autoguardar un formulario a medias crearía una fila en la hoja
  | por cada pausa al teclear.
  */

  const escribirJugador = useCallback(
    async (form: RivalPlayer | null) => {
      if (!form?.ID_JUGADOR) return true;

      const response = await fetch(RIVALS_API_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "guardarRivalJugador",
          player: form,
        }),
      });

      const result = await response.json();

      if (!result.success) {
        /* El error de la hoja, traducido a algo accionable. */
        throw new Error(explicaErrorScript(result.error));
      }

      const verificacion = await verificarGuardado({
        titulo: `Jugador rival · ${
          form["NOMBRE DEPORTIVO"] || form.JUGADOR
        }`,
        enviado: form as unknown as Record<string, unknown>,
        modoAuto: true,
        releer: async () => {
          /* `fresco=1`: la copia del servidor no vale para comprobar un
             guardado, por reciente que sea. Ver `app/api/rivals/route.ts`. */
          const relectura = await fetch(
            `${RIVALS_API_URL}?action=rivalesPlantillas&fresco=1`,
            { cache: "no-store" },
          );

          if (!relectura.ok) return null;

          const filas = await relectura.json();

          if (!Array.isArray(filas)) return null;

          return (
            filas.find(
              (fila) => String(fila?.ID_JUGADOR) === String(form.ID_JUGADOR),
            ) ?? null
          );
        },
      });

      if (verificacion.ok) {
        setPlayers((current) =>
          current.map((player) =>
            player.ID_JUGADOR === form.ID_JUGADOR ? form : player,
          ),
        );

        setPristineForm(JSON.stringify(form));
      }

      return verificacion.ok;
    },
    [verificarGuardado],
  );

  const autoFicha = useAutoSave<RivalPlayer | null>({
    value: editForm,
    enabled: Boolean(editForm) && !isCreating,
    debounce: 1800,
    save: escribirJugador,
  });

  useEffect(() => {
    flushFicha.current = autoFicha.flush;
  }, [autoFicha.flush]);

  /* Abrir otra ficha no es una edición: se toma como nueva base. */
  const idFicha = editForm?.ID_JUGADOR ?? "";
  const idFichaAnterior = useRef(idFicha);

  useEffect(() => {
    if (idFichaAnterior.current === idFicha) return;

    idFichaAnterior.current = idFicha;

    autoFicha.sync();
  }, [idFicha, autoFicha]);

  /*
  |--------------------------------------------------------------------------
  | GUARDAR
  |--------------------------------------------------------------------------
  */

  const savePlayer = async () => {
    if (!editForm) return;

    if (!editForm.JUGADOR.trim() && !editForm["NOMBRE DEPORTIVO"].trim()) {
      toast.error("Indica al menos el nombre del jugador.");
      return;
    }

    try {
      setSaving(true);

      const action = isCreating
        ? "crearRivalJugador"
        : "guardarRivalJugador";

      const timestamp = Date.now();

      const playerToSave: RivalPlayer = {
        ...editForm,

        ID_JUGADOR: editForm.ID_JUGADOR || `RIV-JUG-${timestamp}`,
        ID_EQUIPO: editForm.ID_EQUIPO || `RIV-${timestamp}`,
        NOMBRE_EQUIPO: editForm.NOMBRE_EQUIPO || selectedTeam,
        ESTADO: editForm.ESTADO || "ACTIVO",
      };

      const response = await fetch(RIVALS_API_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action, player: playerToSave }),
      });

      const result = await response.json();

      if (!result.success) {
        throw new Error(explicaErrorScript(result.error) || "No se pudo guardar");
      }

      /* La hoja escribe por nombre de columna: lo que no tiene cabecera se
         descarta sin que la respuesta lo refleje. Se relee la plantilla y se
         compara antes de cerrar la ficha. */
      const verificacion = await verificarGuardado({
        titulo: `Jugador rival · ${
          playerToSave["NOMBRE DEPORTIVO"] || playerToSave.JUGADOR
        }`,
        enviado: playerToSave as unknown as Record<string, unknown>,
        releer: async () => {
          /* `fresco=1`: la copia del servidor no vale para comprobar un
             guardado, por reciente que sea. Ver `app/api/rivals/route.ts`. */
          const relectura = await fetch(
            `${RIVALS_API_URL}?action=rivalesPlantillas&fresco=1`,
            { cache: "no-store" },
          );

          if (!relectura.ok) return null;

          const filas = await relectura.json();

          if (!Array.isArray(filas)) return null;

          return (
            filas.find(
              (fila) =>
                String(fila?.ID_JUGADOR) === String(playerToSave.ID_JUGADOR),
            ) ?? null
          );
        },
      });

      /* Con campos perdidos la ficha se queda abierta y con el texto puesto,
         que es la única copia que queda. */
      if (!verificacion.ok) return;

      if (isCreating) {
        setPlayers((current) => [...current, playerToSave]);
        setSelectedTeam(playerToSave.NOMBRE_EQUIPO);

        toast.success("Jugador añadido correctamente");
      } else {
        setPlayers((current) =>
          current.map((player) =>
            player.ID_JUGADOR === playerToSave.ID_JUGADOR
              ? playerToSave
              : player,
          ),
        );

        toast.success("Jugador guardado correctamente");
      }

      closePlayer(true);
    } catch (error) {
      console.error(error);

      /* El motivo casi nunca está en la app: si la hoja se cae, el mensaje
         dice qué hay que tocar en ella. Tragárselo dejaba «no se pudo
         guardar» a secas y parecía un fallo de la pantalla. */
      toast.error(
        isCreating
          ? "No se pudo añadir el jugador"
          : "No se pudo guardar el jugador",
        { description: error instanceof Error ? error.message : undefined },
      );
    } finally {
      setSaving(false);
    }
  };

  const deletePlayer = async () => {
    if (!editForm) return;

    const playerName = editForm["NOMBRE DEPORTIVO"] || editForm.JUGADOR;

    const confirmed = window.confirm(
      `¿Seguro que quieres eliminar a ${playerName}?`,
    );

    if (!confirmed) return;

    /* Sin esto, un autoguardado pendiente volvería a escribir la fila que se
       acaba de borrar. `sync` da por buena la versión actual sin enviarla. */
    autoFicha.sync();

    try {
      setSaving(true);

      const response = await fetch(RIVALS_API_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "eliminarRivalJugador",
          ID_JUGADOR: editForm.ID_JUGADOR,
        }),
      });

      const result = await response.json();

      if (!result.success) {
        throw new Error(explicaErrorScript(result.error) || "No se pudo eliminar");
      }

      setPlayers((current) =>
        current.filter(
          (player) => player.ID_JUGADOR !== editForm.ID_JUGADOR,
        ),
      );

      closePlayer(true);

      toast.success("Jugador eliminado correctamente");
    } catch (error) {
      console.error(error);

      toast.error("No se pudo eliminar el jugador", {
        description: error instanceof Error ? error.message : undefined,
      });
    } finally {
      setSaving(false);
    }
  };

  /*
  |--------------------------------------------------------------------------
  | TOUCH / SWIPE
  |--------------------------------------------------------------------------
  */

  const handleTouchStart = (event: React.TouchEvent) => {
    touchStartX.current = event.touches[0].clientX;
  };

  const handleTouchEnd = (event: React.TouchEvent) => {
    if (touchStartX.current === null || isCreating) {
      touchStartX.current = null;
      return;
    }

    const difference = touchStartX.current - event.changedTouches[0].clientX;

    if (Math.abs(difference) > 60) {
      navigatePlayer(difference > 0 ? 1 : -1);
    }

    touchStartX.current = null;
  };

  const resetFilters = () => {
    setSearch("");
    setPositionSearch("");
    setActiveTags([]);
  };

  const hasFilters = Boolean(
    search || positionSearch || activeTags.length > 0,
  );

  /*
  |--------------------------------------------------------------------------
  | RENDER
  |--------------------------------------------------------------------------
  */

  return (
    <main className="min-h-screen overflow-x-clip bg-[#0B0F14] text-white">
      <div className="flex min-h-screen w-full">
        <Sidebar />

        <section className="min-w-0 flex-1">
          <Topbar />

          <div className="w-full min-w-0 px-4 py-6 sm:px-6 md:px-8 md:py-8">
            {/* HEADER */}

            <p className="text-xs uppercase tracking-[0.35em] text-[#C8A96B]">
              RMCF CASTILLA · RIVALES
            </p>

            <div className="mt-4 flex min-w-0 items-center gap-4">
              <h1 className="min-w-0 truncate text-2xl font-semibold md:text-4xl">
                Plantillas rivales
              </h1>

              <div className="hidden h-px min-w-0 flex-1 bg-gradient-to-r from-[#C8A96B]/30 via-white/10 to-transparent md:block" />

              <div className="flex shrink-0 items-center gap-1 rounded-xl border border-white/10 bg-white/[0.03] p-1">
                <button
                  onClick={() => setView("plantilla")}
                  className={`flex items-center gap-1.5 rounded-lg px-3 py-2 text-xs transition ${
                    view === "plantilla"
                      ? "bg-[#C8A96B]/15 text-[#C8A96B]"
                      : "text-white/50 hover:text-white"
                  }`}
                >
                  <Shirt size={14} />
                  <span className="hidden sm:inline">Plantilla</span>
                </button>

                <button
                  onClick={() => setView("pizarra")}
                  className={`flex items-center gap-1.5 rounded-lg px-3 py-2 text-xs transition ${
                    view === "pizarra"
                      ? "bg-[#C8A96B]/15 text-[#C8A96B]"
                      : "text-white/50 hover:text-white"
                  }`}
                >
                  <SquarePen size={14} />
                  <span className="hidden sm:inline">Pizarra</span>
                </button>
              </div>
            </div>

            {/* ERROR */}

            {loadError && (
              <div className="mt-6 flex flex-wrap items-center gap-4 rounded-2xl border border-red-500/30 bg-red-500/10 p-4 text-sm text-red-200">
                <span className="min-w-0 flex-1">{loadError}</span>

                <button
                  onClick={() => setReloadKey((key) => key + 1)}
                  className="flex items-center gap-2 rounded-xl border border-red-400/40 px-4 py-2 transition hover:bg-red-500/20"
                >
                  <RotateCcw size={14} />
                  Reintentar
                </button>
              </div>
            )}

            {/* SELECTOR DE EQUIPO */}

            <div className="mt-8 flex max-w-full items-center gap-2">
              <div className="flex min-w-0 flex-1 gap-2 overflow-x-auto pb-2">
                {teams.map((team) => (
                  <button
                    key={team.name}
                    title={
                      esElProximo(ordenRivales, team.name)
                        ? etiquetaDelProximo(ordenRivales)
                        : undefined
                    }
                    onClick={() => {
                      setSelectedTeam(team.name);
                      setPositionSearch("");
                      setSearch("");
                    }}
                    className={`flex shrink-0 items-center gap-2 whitespace-nowrap rounded-xl border px-4 py-3 text-sm transition ${
                      selectedTeam === team.name
                        ? "border-[#C8A96B] bg-[#C8A96B]/10 text-[#C8A96B]"
                        : "border-white/10 bg-white/[0.03] text-white/60 hover:border-white/30"
                    }`}
                  >
                    {/* El escudo se reconoce antes que el nombre escrito. */}
                    <EscudoEquipo
                      nombre={team.name}
                      escudo={escudoDe(team.name)}
                      lado={22}
                    />

                    {team.name}

                    {/*
                    | Contra quién se juega ya. La fila se reordena sola cada
                    | jornada, así que conviene que se vea por qué éste está
                    | el primero y no es una casualidad del alfabeto.
                    */}
                    {esElProximo(ordenRivales, team.name) && (
                      <span className="rounded-full bg-[#C8A96B] px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-black">
                        Próximo
                      </span>
                    )}

                    <span
                      className={`rounded-full px-2 py-0.5 text-[10px] ${
                        selectedTeam === team.name
                          ? "bg-[#C8A96B]/20"
                          : "bg-white/5 text-white/40"
                      }`}
                    >
                      {team.count}
                    </span>
                  </button>
                ))}
              </div>

              <button
                onClick={openCreatePlayer}
                className="flex shrink-0 items-center gap-2 rounded-xl border border-[#C8A96B]/40 bg-[#C8A96B]/10 px-4 py-3 text-sm text-[#C8A96B] transition hover:bg-[#C8A96B]/20"
              >
                <Plus size={16} />

                <span className="hidden sm:inline">Añadir jugador</span>
              </button>
            </div>

            {view === "plantilla" && (
              <>
              {/* FILTROS */}

              <div className="mt-6 grid min-w-0 gap-3 md:grid-cols-2">
                <SearchInput
                  value={search}
                  onChange={setSearch}
                  placeholder="Buscar jugador, equipo, dorsal o rol..."
                />

                <SearchInput
                  value={positionSearch}
                  onChange={setPositionSearch}
                  placeholder="Buscar posición..."
                />
              </div>

              {/* ETIQUETAS */}

              <div className="mt-4 min-w-0 rounded-2xl border border-white/10 bg-white/[0.025] px-4 py-3">
                {/* LA LÍNEA: abre y cierra, y enseña lo que hay puesto */}
                <div className="flex min-w-0 flex-wrap items-center gap-x-3 gap-y-2">
                  <button
                    type="button"
                    onClick={() => setEtiquetasAbiertas((abierto) => !abierto)}
                    aria-expanded={etiquetasAbiertas}
                    className="flex shrink-0 items-center gap-2 text-[11px] uppercase tracking-[0.25em] text-[#C8A96B] transition hover:text-white"
                  >
                    <Tags size={14} />
                    Etiquetas
                    <ChevronDown
                      size={14}
                      className={`transition-transform ${
                        etiquetasAbiertas ? "rotate-180" : ""
                      }`}
                    />
                  </button>

                  {/* Cerrada, las activas se siguen viendo y se quitan de aquí. */}
                  {!etiquetasAbiertas && activeTags.length > 0 && (
                    <div className="flex min-w-0 flex-wrap items-center gap-2">
                      {TAG_GROUPS.flatMap((group) => group.tags)
                        .filter((tag) => activeTags.includes(tag.key))
                        .map((tag) => (
                          <TagChip
                            key={tag.key}
                            tag={tag}
                            count={tagCounts.get(tag.key) ?? 0}
                            active
                            onClick={() =>
                              setActiveTags((current) =>
                                current.filter((key) => key !== tag.key),
                              )
                            }
                          />
                        ))}
                    </div>
                  )}

                  <span className="ml-auto shrink-0 text-[11px] text-white/30">
                    {activeTags.length > 0
                      ? "Se atenúan en el campo los que no las cumplen"
                      : etiquetasAbiertas
                        ? "Pulsa para filtrar · se editan en la ficha del jugador"
                        : "Sin filtro"}
                  </span>
                </div>

                <div
                  hidden={!etiquetasAbiertas}
                  className="mt-3 min-w-0 space-y-3"
                >
                  {TAG_GROUPS.map((group) => (
                    <div key={group.tone} className="min-w-0">
                      <span className="mb-1.5 block text-[10px] uppercase tracking-[0.2em] text-white/25">
                        {group.label}
                      </span>

                      <div className="flex min-w-0 flex-wrap gap-2">
                        {group.tags.map((tag) => {
                          const count = tagCounts.get(tag.key) ?? 0;

                          /* Sin nadie etiquetado la píldora sigue visible pero apagada. */
                          return (
                            <TagChip
                              key={tag.key}
                              tag={tag}
                              count={count}
                              active={activeTags.includes(tag.key)}
                              onClick={() =>
                                setActiveTags((current) =>
                                  current.includes(tag.key)
                                    ? current.filter((key) => key !== tag.key)
                                    : [...current, tag.key],
                                )
                              }
                            />
                          );
                        })}
                      </div>
                    </div>
                  ))}

                  {activeTags.length > 0 && (
                    <button
                      onClick={() => setActiveTags([])}
                      className="flex shrink-0 items-center gap-1.5 rounded-full border border-white/10 px-2.5 py-1 text-[11px] text-white/50 transition hover:border-white/30 hover:text-white"
                    >
                      <X size={11} />
                      Quitar filtro
                    </button>
                  )}
                </div>
              </div>

              {/* CONTADOR */}

              <div className="mt-6 flex min-w-0 flex-wrap items-center justify-between gap-4">
                <div className="flex min-w-0 flex-wrap items-center gap-3">
                  <p className="shrink-0 text-sm text-white/50">
                    {listPlayers.length}{" "}
                    {listPlayers.length === 1 ? "jugador" : "jugadores"}
                  </p>

                  {search && teamsInResults.length > 1 && (
                    <span className="rounded-full border border-[#C8A96B]/30 bg-[#C8A96B]/10 px-3 py-1 text-xs text-[#C8A96B]">
                      {teamsInResults.length} equipos en el resultado
                    </span>
                  )}

                  {hasFilters && (
                    <button
                      onClick={resetFilters}
                      className="flex items-center gap-1.5 rounded-full border border-white/10 px-3 py-1 text-xs text-white/50 transition hover:border-white/30 hover:text-white"
                    >
                      <RotateCcw size={12} />
                      Limpiar
                    </button>
                  )}
                </div>

                <div className="flex shrink-0 items-center gap-3">
                  <p className="min-w-0 truncate text-right text-xs text-white/30">
                    {selectedTeam}
                  </p>

                  <button
                    onClick={() => setShowPitch((value) => !value)}
                    className="flex items-center gap-2 rounded-xl border border-white/10 px-3 py-2 text-xs text-white/60 transition hover:border-[#C8A96B] hover:text-white lg:hidden"
                  >
                    {showPitch ? <Shirt size={14} /> : <LayoutGrid size={14} />}
                    {showPitch ? "Ver listado" : "Ver campograma"}
                  </button>
                </div>
              </div>

              {columnasPerdidas.length > 0 && (
                <div className="mt-6">
                  <ColumnasPerdidas columnas={columnasPerdidas} />
                </div>
              )}

              {/* PLANTILLA + CAMPOGRAMA */}

              {loading ? (
                <RivalsSkeleton />
              ) : (
                /* El campograma manda: es donde se lee la plantilla de un
                   golpe. El listado se queda en una sola columna, como índice
                   para buscar a alguien concreto.

                   En `xl` —el ancho de un portátil normal— el listado pasa a
                   ancho fijo y TODO lo que sobra es del campograma: tumbado, el
                   campo se dibuja con las proporciones de la foto de fondo
                   (3:2), así que cada píxel de ancho que gana son dos tercios
                   de alto, y con ellos fichas más grandes. */
                <div className="mt-6 grid min-w-0 items-stretch gap-5 lg:grid-cols-[minmax(230px,1fr)_minmax(0,3fr)] xl:gap-4 xl:grid-cols-[236px_minmax(0,1fr)]">
                  {/* ============================================ */}
                  {/* COLUMNA IZQUIERDA — LISTADO DE JUGADORES */}
                  {/* ============================================ */}

                  <div
                    className={`min-w-0 space-y-5 ${
                      showPitch ? "hidden lg:block" : ""
                    }`}
                  >
                    {lines.map((line) =>
                      line.players.length === 0 ? null : (
                        <section
                          key={line.key}
                          className="min-w-0 overflow-hidden rounded-2xl border border-white/10 bg-white/[0.025]"
                        >
                          <div className="flex min-w-0 items-center justify-between gap-4 border-b border-white/10 bg-white/[0.025] px-4 py-3">
                            <h2 className="flex min-w-0 items-center gap-2 truncate text-xs font-semibold uppercase tracking-[0.25em] text-[#C8A96B]">
                              <span
                                className="h-2 w-2 shrink-0 rounded-full"
                                style={{ background: line.color }}
                              />
                              {line.title}
                            </h2>

                            <span className="shrink-0 text-xs text-white/30">
                              {line.players.length}
                            </span>
                          </div>

                          {/* Subgrupos por posición concreta.
                              El `gap-px` es `bg-white/10` y no `bg-white/5`
                              porque en modo día esta última se resuelve al
                              mismo blanco que las filas: las separaciones se
                              perdían. */}

                          <div className="min-w-0">
                            {line.groups.map((group) => (
                              <div key={group.slot.key} className="min-w-0">
                                {line.groups.length > 1 && (
                                  /* `bg-[#181F27]` y no `bg-white/[0.02]`: en
                                     modo día las utilidades `bg-white/[0.0x]`
                                     caen todas en `--rmcf-surface`, el mismo
                                     blanco de las filas, y la banda
                                     desaparecía. */
                                  <div className="flex min-w-0 items-center gap-2 border-y border-white/5 bg-[#181F27] px-4 py-1.5">
                                    <span
                                      className="shrink-0 rounded px-1.5 py-0.5 text-[9px] font-bold tracking-wider"
                                      style={{
                                        background: `${line.color}26`,
                                        color: chipInk(line.color),
                                      }}
                                    >
                                      {group.slot.code}
                                    </span>

                                    <span className="min-w-0 truncate text-[10px] uppercase tracking-[0.18em] text-white/40">
                                      {group.slot.label}
                                    </span>

                                    <span className="ml-auto shrink-0 text-[10px] text-white/25">
                                      {group.players.length}
                                    </span>
                                  </div>
                                )}

                                <div className="grid min-w-0 gap-px bg-white/10 sm:grid-cols-2 lg:grid-cols-1">
                                  {group.players.map((player) => (
                                    <PlayerRow
                                      key={player.ID_JUGADOR}
                                      player={player}
                                      showTeam={teamsInResults.length > 1}
                                      onceEstado={onceDe(player)}
                                      onCiclarOnce={ciclarOnceDe(player)}
                                      onClick={() => openPlayer(player)}
                                    />
                                  ))}
                                </div>
                              </div>
                            ))}
                          </div>
                        </section>
                      ),
                    )}

                    {unclassified.length > 0 && (
                      <section className="min-w-0 overflow-hidden rounded-2xl border border-white/10 bg-white/[0.025]">
                        <div className="flex min-w-0 items-center justify-between gap-4 border-b border-white/10 bg-white/[0.025] px-4 py-3">
                          <h2 className="min-w-0 truncate text-xs font-semibold uppercase tracking-[0.25em] text-white/40">
                            SIN CLASIFICAR
                          </h2>

                          <span className="shrink-0 text-xs text-white/30">
                            {unclassified.length}
                          </span>
                        </div>

                        <div className="grid min-w-0 gap-px bg-white/10 sm:grid-cols-2 lg:grid-cols-1">
                          {unclassified.map((player) => (
                            <PlayerRow
                              key={player.ID_JUGADOR}
                              player={player}
                              showTeam={teamsInResults.length > 1}
                              onceEstado={onceDe(player)}
                              onCiclarOnce={ciclarOnceDe(player)}
                              onClick={() => openPlayer(player)}
                            />
                          ))}
                        </div>
                      </section>
                    )}

                    {listPlayers.length === 0 && (
                      <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-10 text-center text-white/40">
                        No se han encontrado jugadores.
                      </div>
                    )}
                  </div>

                  {/* ============================================ */}
                  {/* COLUMNA DERECHA — CAMPOGRAMA */}
                  {/* ============================================ */}

                  <div
                    className={`flex min-w-0 ${
                      showPitch ? "" : "hidden lg:flex"
                    }`}
                  >
                    <div className="sticky top-6 flex h-fit w-full flex-col overflow-hidden rounded-2xl border border-white/10 bg-[#11161D]">
                      {/*
                        La cabecera se **parte en dos renglones** cuando no
                        caben los botones.

                        En el móvil iba en una sola fila con `shrink-0`: la
                        tira medía 627 px dentro de una tarjeta de 390 con
                        `overflow-hidden`, así que PPT e INFORME quedaban
                        fuera de la pantalla y no había forma de llegar a
                        ellos. Con `flex-wrap` bajan solos a su renglón y en
                        el ordenador se ve igual que antes, porque ahí caben.
                      */}
                      <div className="flex min-w-0 flex-wrap items-center justify-between gap-x-3 gap-y-2 border-b border-white/10 bg-white/[0.025] px-4 py-3">
                        <h2 className="min-w-0 truncate text-xs font-semibold uppercase tracking-[0.25em] text-[#C8A96B]">
                          CAMPOGRAMA
                          {pitchTeam && teamsInResults.length > 1 && (
                            <span className="ml-2 normal-case tracking-normal text-white/30">
                              · {pitchTeam}
                            </span>
                          )}
                        </h2>

                        <div className="flex min-w-0 flex-wrap items-center justify-end gap-1.5 text-xs text-white/30 sm:gap-2">
                          {activeTags.length > 0 && (
                            <span className="text-[#C8A96B]">
                              {listPlayers.length} destacados
                            </span>
                          )}

                          {/* ONCE PROBABLE — cuántos hay puestos y cuántas dudas */}

                          <span
                            title="Titulares marcados en el once probable"
                            className="flex items-center gap-1 rounded-full border px-2.5 py-1 font-semibold sm:px-2 sm:py-0.5"
                            style={{
                              borderColor: `${ONCE_COLOR.titular}55`,
                              background: `${ONCE_COLOR.titular}18`,
                              color: chipInk(ONCE_COLOR.titular),
                            }}
                          >
                            {onceResumen.titulares}/11
                          </span>

                          {onceResumen.dudas > 0 && (
                            <span
                              title="Jugadores en duda para el once"
                              className="flex items-center gap-1 rounded-full border px-2.5 py-1 font-semibold sm:px-2 sm:py-0.5"
                              style={{
                                borderColor: `${ONCE_COLOR.duda}55`,
                                background: `${ONCE_COLOR.duda}18`,
                                color: chipInk(ONCE_COLOR.duda),
                              }}
                            >
                              {onceResumen.dudas} ?
                            </span>
                          )}

                          {/*
                            El once que se propone con los que el rival viene
                            sacando. No decide nada: deja el once puesto para
                            poder cambiarlo —pulsando a cualquiera de la lista,
                            arrastrando en el pop-up del PDF o sustituyendo—.
                            Con un once ya marcado avisa antes de pisarlo.
                          */}

                          {pitchPlayers.length > 0 && (
                            <button
                              type="button"
                              data-export-hide
                              onClick={() => {
                                if (
                                  onceResumen.titulares > 0 &&
                                  !window.confirm(
                                    "Ya hay un once marcado. ¿Sustituirlo por el que se propone con los últimos onces del rival?",
                                  )
                                ) {
                                  return;
                                }

                                void sugerirOnce();
                              }}
                              disabled={sugiriendo || exportando}
                              title={`Proponer el once de ${equipoDelOnce} con los últimos onces que ha sacado — después se cambia a mano`}
                              className="flex items-center gap-1 rounded-full border border-[#C8A96B]/40 bg-[#C8A96B]/10 px-2.5 py-1 font-semibold text-[#C8A96B] transition hover:bg-[#C8A96B]/20 disabled:opacity-50 sm:px-2 sm:py-0.5"
                            >
                              {sugiriendo ? (
                                <Loader2 size={11} className="animate-spin" />
                              ) : (
                                <Wand2 size={11} />
                              )}
                              SUGERIR 11
                            </button>
                          )}

                          {/*
                            El once, en un PDF que salta a cada ficha.

                            Sale para **todos** los equipos, no sólo para los
                            que ya tienen once marcado: antes el botón aparecía
                            con el primer jugador marcado, así que en un rival
                            al que no se había mirado no había ni por dónde
                            empezar. El once se monta ahora dentro del pop-up.
                          */}

                          {pitchPlayers.length > 0 && (
                            <button
                              type="button"
                              data-export-hide
                              /* No descarga: abre el pop-up donde se coloca
                                 el once y se eligen las dudas que se pintan. */
                              onClick={() => setPreparandoPdf(true)}
                              disabled={exportando}
                              title={`Preparar el PDF del once probable de ${equipoDelOnce}`}
                              className="flex items-center gap-1 rounded-full border border-[#C8A96B]/40 bg-[#C8A96B]/10 px-2.5 py-1 font-semibold text-[#C8A96B] transition hover:bg-[#C8A96B]/20 disabled:opacity-50 sm:px-2 sm:py-0.5"
                            >
                              {exportando ? (
                                <Loader2 size={11} className="animate-spin" />
                              ) : (
                                <FileDown size={11} />
                              )}
                              PDF
                            </button>
                          )}

                          {/* Y el que se lleva el portero: los que le tiran. */}

                          {pitchPlayers.length > 0 && (
                            <button
                              type="button"
                              data-export-hide
                              /* Tampoco descarga: abre el pop-up donde se
                                 elige a quién se lleva estudiado. */
                              onClick={() => setPreparandoPortero(true)}
                              disabled={exportando}
                              title={`Preparar el PDF para el portero — quién tira de ${equipoDelOnce}`}
                              className="flex items-center gap-1 rounded-full border border-[#C8A96B]/40 bg-[#C8A96B]/10 px-2.5 py-1 font-semibold text-[#C8A96B] transition hover:bg-[#C8A96B]/20 disabled:opacity-50 sm:px-2 sm:py-0.5"
                            >
                              {exportando ? (
                                <Loader2 size={11} className="animate-spin" />
                              ) : (
                                <Hand size={11} />
                              )}
                              PORTERO
                            </button>
                          )}

                          {/*
                            Y la plantilla entera en un PowerPoint, con cada
                            jugador como imagen suelta: es el documento que se
                            abre al cruzar alineaciones para borrar a los que
                            no salen. No depende del once —sale todo el mundo—,
                            así que está siempre que haya gente en el campo.
                          */}

                          {pitchPlayers.length > 0 && (
                            <button
                              type="button"
                              data-export-hide
                              onClick={() => void exportarAlineacionPptx()}
                              disabled={exportando}
                              title={`PowerPoint de día de partido de ${equipoDelOnce} — la plantilla entera colocada, para borrar a los que no salgan`}
                              className="flex items-center gap-1 rounded-full border border-[#C8A96B]/40 bg-[#C8A96B]/10 px-2.5 py-1 font-semibold text-[#C8A96B] transition hover:bg-[#C8A96B]/20 disabled:opacity-50 sm:px-2 sm:py-0.5"
                            >
                              {exportando ? (
                                <Loader2 size={11} className="animate-spin" />
                              ) : (
                                <Presentation size={11} />
                              )}
                              PPT
                            </button>
                          )}

                          {/*
                            Y el informe del rival: las diez diapositivas de
                            siempre —clasificación, resultados, entrenador,
                            estadio y las últimas alineaciones— con los datos
                            de BeSoccer en vez de con capturas pegadas a mano.

                            No depende de la plantilla ni del once: habla del
                            club, así que está siempre que haya equipo elegido.
                          */}

                          {selectedTeam && (
                            <button
                              type="button"
                              data-export-hide
                              onClick={() => void abrirInforme()}
                              disabled={exportando}
                              title={`Informe de rival de ${equipoDelOnce} — clasificación, resultados, entrenador, estadio y los partidos que se marquen. Se eligen antes, y el documento se retoca antes de exportar`}
                              className="flex items-center gap-1 rounded-full border border-[#C8A96B]/40 bg-[#C8A96B]/10 px-2.5 py-1 font-semibold text-[#C8A96B] transition hover:bg-[#C8A96B]/20 disabled:opacity-50 sm:px-2 sm:py-0.5"
                            >
                              {exportando ? (
                                <Loader2 size={11} className="animate-spin" />
                              ) : (
                                <FileText size={11} />
                              )}
                              INFORME
                            </button>
                          )}

                          {(onceResumen.titulares > 0 ||
                            onceResumen.dudas > 0) && (
                            <button
                              type="button"
                              data-export-hide
                              onClick={() => {
                                if (
                                  window.confirm(
                                    "¿Vaciar el once probable de este equipo?",
                                  )
                                ) {
                                  once.limpiar();
                                }
                              }}
                              title="Vaciar el once probable"
                              className="rounded-full border border-white/10 p-1 text-white/35 transition hover:border-white/30 hover:text-white"
                            >
                              <RotateCcw size={11} />
                            </button>
                          )}

                          <span>{pitchPlayers.length} jugadores</span>
                        </div>
                      </div>

                      <TacticalPitch
                        players={pitchPlayers}
                        selectedId={selectedPlayer?.ID_JUGADOR}
                        activeTags={activeTags}
                        onceEstado={onceDe}
                        onCiclarOnce={ciclarOnceDe}
                        onPlayerClick={openPlayer}
                      />
                    </div>
                  </div>
                </div>
              )}
              </>
            )}

            {/* PIZARRA TÁCTICA DEL RIVAL */}

            {view === "pizarra" && boardSquad && (
              <RivalBoardPanel key={boardSquad.equipo} squad={boardSquad} />
            )}
          </div>
        </section>
      </div>

      {/* CÓMO VA A SALIR EL ONCE — PASO PREVIO AL PDF */}

      {preparandoPdf && (
        <OnceCampoDialog
          equipo={equipoDelOnce}
          jugadores={campoJugadores}
          plantilla={plantillaDelOnce}
          campo={once.doc.campo}
          tema={theme}
          exportando={exportando}
          onMover={once.mover}
          onAlCampo={once.alCampo}
          onQuitar={once.quitar}
          onAnadir={(clave) => once.marcar(clave, "titular")}
          onSustituir={once.sustituir}
          onRecolocar={once.recolocar}
          onSugerir={() => void sugerirOnce()}
          sugiriendo={sugiriendo}
          onExportar={() => void exportarOncePdf()}
          onCerrar={() => setPreparandoPdf(false)}
        />
      )}

      {/* QUÉ PARTIDOS SE LLEVAN LAS HOJAS 9 Y 10 */}

      {eleccionInforme && !hojasInforme && (
        <InformePartidosDialog
          equipo={equipoDelOnce}
          partidos={eleccionInforme.partidos}
          elegidos={partidosInforme}
          porDefecto={eleccionInforme.porDefecto}
          maximo={PARTIDOS_INFORME_MAXIMO}
          montando={exportando}
          onCambiar={setPartidosInforme}
          onMontar={(ids) => void montarInforme(ids)}
          onCerrar={() => setEleccionInforme(null)}
        />
      )}

      {/* EL INFORME DEL RIVAL, ANTES DE EXPORTARLO */}

      {hojasInforme && (
        <InformePptEditor
          equipo={equipoDelOnce}
          hojas={hojasInforme}
          exportando={exportando}
          onExportar={(hojas) => void exportarInformeEditado(hojas)}
          onCerrar={() => setHojasInforme(null)}
        />
      )}

      {/* QUIÉN SALE EN EL PDF DEL PORTERO */}

      {preparandoPortero && (
        <PorteroPdfDialog
          equipo={equipoDelOnce}
          candidatos={candidatosPortero}
          porDefecto={porteroPorDefecto}
          elegidos={porteroElegidos}
          sinOnce={sinOnceMarcado}
          exportando={exportando}
          onCambiar={(claves) =>
            setElegidosPortero({ equipo: equipoDelOnce, claves })
          }
          onExportar={(claves) => void exportarPorteroPdf(claves)}
          onCerrar={() => setPreparandoPortero(false)}
        />
      )}

      {/* MODAL */}

      {editForm && (
        <div
          /* `modal-veil` y no `bg-black/80`: esa clase de Tailwind arrastra a
             blanco todo el texto que lleva dentro en modo día (ver
             `app/globals.css`), y la ficha se quedaba en blanco sobre blanco. */
          className="modal-veil fixed inset-0 z-50 flex items-center justify-center overflow-y-auto p-2 backdrop-blur-sm sm:p-4 md:p-8"
          role="dialog"
          aria-modal="true"
          onClick={() => closePlayer()}
        >
          <div
            /* Lo que se lleva la exportación a PNG / PDF: la ficha, no la
               página que ha quedado detrás del velo. */
            data-export-panel
            /* La ficha ya no es una columna estrecha con todo apilado: se
               despliega a lo ancho, así que necesita el ancho de la pantalla. */
            className="relative flex max-h-[96vh] w-full min-w-0 max-w-[1500px] flex-col overflow-hidden rounded-2xl border border-white/10 bg-[#11161D] shadow-2xl"
            onClick={(event) => event.stopPropagation()}
            onTouchStart={handleTouchStart}
            onTouchEnd={handleTouchEnd}
          >
            {/* HEADER MODAL */}

            <div className="flex min-w-0 items-center justify-between gap-3 border-b border-white/10 p-3 sm:p-4 md:p-6">
              <div className="flex min-w-0 items-center gap-2 sm:gap-3">
                {!isCreating && (
                  <button
                    data-export-hide
                    onClick={() => navigatePlayer(-1)}
                    disabled={selectedIndex <= 0}
                    aria-label="Jugador anterior"
                    className="shrink-0 rounded-full border border-white/10 p-2 transition hover:border-[#C8A96B] disabled:opacity-20"
                  >
                    <ChevronLeft size={20} />
                  </button>
                )}

                {/* El club al que se está mirando, con su escudo: la ficha se
                    exporta suelta y sin él no se sabe de quién es. */}
                {!isCreating && (
                  <EscudoEquipo
                    nombre={editForm.NOMBRE_EQUIPO || ""}
                    escudo={escudoDe(editForm)}
                    lado={40}
                    className="hidden sm:flex"
                  />
                )}

                <div className="min-w-0">
                  <p className="truncate text-xs uppercase tracking-[0.2em] text-[#C8A96B]">
                    {isCreating ? "NUEVO JUGADOR" : editForm.NOMBRE_EQUIPO}

                    {!isCreating && selectedIndex >= 0 && (
                      <span className="ml-2 text-white/25">
                        {selectedIndex + 1}/{listPlayers.length}
                      </span>
                    )}
                  </p>

                  <h2 className="truncate text-lg font-semibold sm:text-xl md:text-2xl">
                    {isCreating
                      ? "Añadir jugador"
                      : editForm["NOMBRE DEPORTIVO"] || editForm.JUGADOR}
                  </h2>
                </div>

                {!isCreating && (
                  <button
                    data-export-hide
                    onClick={() => navigatePlayer(1)}
                    disabled={selectedIndex >= listPlayers.length - 1}
                    aria-label="Jugador siguiente"
                    className="shrink-0 rounded-full border border-white/10 p-2 transition hover:border-[#C8A96B] disabled:opacity-20"
                  >
                    <ChevronRight size={20} />
                  </button>
                )}
              </div>

              {/* Los mandos de la ventana no pintan nada en un PDF. */}

              <div data-export-hide className="flex shrink-0 items-center gap-3">
                {isCreating ? (
                  isDirty && (
                    <span className="hidden rounded-full border border-[#C8A96B]/30 bg-[#C8A96B]/10 px-3 py-1 text-xs text-[#C8A96B] sm:inline">
                      Sin añadir todavía
                    </span>
                  )
                ) : (
                  <AutoSaveStatus
                    estado={autoFicha.status}
                    guardadoEn={autoFicha.lastSavedAt}
                    onReintentar={() => void autoFicha.flush()}
                    className="hidden sm:inline-flex"
                  />
                )}

                <button
                  onClick={() => closePlayer()}
                  aria-label="Cerrar"
                  className="shrink-0 rounded-full p-2 text-white/50 transition hover:bg-white/10 hover:text-white"
                >
                  <X size={22} />
                </button>
              </div>
            </div>

            {/* BODY */}

            <div className="min-w-0 overflow-y-auto">
              {/* ================================================== */}
              {/* BANDA DE CABECERA — la ficha en horizontal          */}
              {/* ================================================== */}

              <div className="flex min-w-0 flex-col gap-4 border-b border-white/10 bg-gradient-to-r from-[#C8A96B]/[0.07] via-transparent to-transparent p-3 sm:p-4 md:flex-row md:items-start md:gap-5 md:p-6">
                {/* FOTO */}

                <div className="relative shrink-0 self-center md:self-start">
                  <div className="h-32 w-32 overflow-hidden rounded-2xl border border-white/10 bg-[#0B0F14] sm:h-40 sm:w-40">
                    {editForm.FOTO ? (
                      /* eslint-disable-next-line @next/next/no-img-element */
                      <img
                        src={editForm.FOTO}
                        alt={
                          editForm["NOMBRE DEPORTIVO"] || editForm.JUGADOR || ""
                        }
                        className="h-full w-full object-cover"
                      />
                    ) : (
                      <div className="flex h-full items-center justify-center">
                        <UserRound size={64} className="text-white/20" />
                      </div>
                    )}
                  </div>

                  {editForm.DORSAL !== "" && editForm.DORSAL !== undefined && (
                    <span className="absolute -bottom-2 -right-2 flex h-9 min-w-9 items-center justify-center rounded-full bg-[#C8A96B] px-2 text-base font-bold text-black shadow-lg">
                      {editForm.DORSAL}
                    </span>
                  )}
                </div>

                {/* IDENTIDAD Y DATOS */}

                <div className="min-w-0 flex-1">
                  <div className="flex min-w-0 flex-wrap items-center gap-2">
                    {slotDelJugador && (
                      <span
                        className="shrink-0 rounded-md px-2 py-0.5 text-[11px] font-bold tracking-wider"
                        style={{
                          background: `${slotDelJugador.line.color}26`,
                          color: chipInk(slotDelJugador.line.color),
                        }}
                      >
                        {slotDelJugador.slot.code}
                      </span>
                    )}

                    <span className="min-w-0 truncate text-sm text-white/50">
                      {editForm["POSICIÓN"] || "Sin posición"}
                    </span>

                    {editForm["2º POSICIÓN"] &&
                      editForm["2º POSICIÓN"] !== "." && (
                        <span className="shrink-0 rounded-md border border-white/10 px-1.5 py-0.5 text-[10px] text-white/40">
                          2ª {editForm["2º POSICIÓN"]}
                        </span>
                      )}

                    {editForm.ROL && (
                      <span className="shrink-0 rounded-full border border-[#C8A96B]/30 bg-[#C8A96B]/10 px-2.5 py-0.5 text-[11px] font-semibold text-[#E4C977]">
                        {editForm.ROL}
                      </span>
                    )}
                  </div>

                  <p className="mt-2 min-w-0 truncate text-sm text-white/45">
                    {editForm.JUGADOR}
                  </p>

                  {/* DATOS EN HORIZONTAL — lo que se mira de un vistazo */}

                  <dl className="mt-3 flex min-w-0 flex-wrap gap-2">
                    {datosCabecera.map((dato) => (
                      <div
                        key={dato.label}
                        className="min-w-0 rounded-xl border border-white/10 bg-white/[0.03] px-3 py-1.5"
                      >
                        <dt className="text-[9px] uppercase tracking-[0.16em] text-white/35">
                          {dato.label}
                        </dt>

                        <dd className="mt-0.5 max-w-[160px] truncate text-sm font-semibold text-white">
                          {dato.valor}
                        </dd>
                      </div>
                    ))}
                  </dl>
                </div>

                {/* ONCE PROBABLE + ENLACES */}

                <div className="flex shrink-0 flex-col gap-3 md:w-52">
                  {onceDelJugador && (
                    <div className="rounded-2xl border border-white/10 bg-[#0B0F14] p-3">
                      <p className="mb-2 text-[10px] uppercase tracking-[0.18em] text-white/35">
                        Once probable
                      </p>

                      {/*
                      | En el PNG / PDF sobrevive sólo la opción marcada: las
                      | otras dos son un selector que en papel no se puede
                      | pulsar, y la que queda se lee como el dato. Es el mismo
                      | criterio que siguen las etiquetas.
                      */}
                      <div
                        role="group"
                        aria-label="Estado en el once probable"
                        className="flex items-center gap-1"
                      >
                        {ESTADOS_ONCE.map((opcion) => {
                          const activo = onceDelJugador.estado === opcion.valor;

                          const color = opcion.valor
                            ? ONCE_COLOR[opcion.valor]
                            : null;

                          return (
                            <button
                              key={opcion.label}
                              type="button"
                              {...(activo ? {} : { "data-export-hide": "" })}
                              onClick={() => onceDelJugador.marcar(opcion.valor)}
                              className={`flex-1 rounded-lg border px-2 py-1.5 text-[11px] font-semibold transition ${
                                activo
                                  ? ""
                                  : "border-white/10 text-white/40 hover:border-white/30 hover:text-white/70"
                              }`}
                              style={
                                activo && color
                                  ? {
                                      borderColor: `${color}80`,
                                      background: `${color}26`,
                                      color: chipInk(color),
                                    }
                                  : activo
                                    ? {
                                        /* «Fuera» no tiene color propio, así
                                           que lleva la tinta del tema: en
                                           blanco fijo desaparecía en modo
                                           día. */
                                        borderColor:
                                          "rgb(var(--rmcf-ink-rgb) / .35)",
                                        color: "rgb(var(--rmcf-ink-rgb) / 1)",
                                      }
                                    : undefined
                              }
                            >
                              {opcion.label}
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  )}

                  <div className="flex flex-wrap gap-2">
                    {editForm.VIDEO && (
                      <a
                        href={editForm.VIDEO}
                        target="_blank"
                        rel="noreferrer"
                        className="flex flex-1 items-center justify-center gap-1.5 rounded-xl border border-white/10 bg-white/[0.04] px-3 py-2 text-[12px] transition hover:border-[#C8A96B]"
                      >
                        <Video size={14} className="text-[#C8A96B]" />
                        Ver vídeo
                        <ExternalLink size={11} />
                      </a>
                    )}

                    {editForm.DOC && (
                      <a
                        href={editForm.DOC}
                        target="_blank"
                        rel="noreferrer"
                        className="flex flex-1 items-center justify-center gap-1.5 rounded-xl border border-white/10 bg-white/[0.04] px-3 py-2 text-[12px] transition hover:border-[#C8A96B]"
                      >
                        <FileText size={14} className="text-[#C8A96B]" />
                        Documento
                        <ExternalLink size={11} />
                      </a>
                    )}

                    {besoccerDelJugador && (
                      <a
                        href={besoccerDelJugador}
                        target="_blank"
                        rel="noreferrer"
                        className="flex flex-1 items-center justify-center gap-1.5 rounded-xl border border-white/10 bg-white/[0.04] px-3 py-2 text-[12px] transition hover:border-[#C8A96B]"
                      >
                        <BarChart3 size={14} className="text-[#C8A96B]" />
                        BeSoccer
                        <ExternalLink size={11} />
                      </a>
                    )}
                  </div>

                  <button
                    type="button"
                    data-export-hide
                    onClick={() => setEditandoDatos((abierto) => !abierto)}
                    className={`flex items-center justify-center gap-1.5 rounded-xl border px-3 py-2 text-[12px] font-semibold transition ${
                      editandoDatos
                        ? "border-[#C8A96B] bg-[#C8A96B]/15 text-[#C8A96B]"
                        : "border-white/10 text-white/55 hover:border-[#C8A96B] hover:text-white"
                    }`}
                  >
                    {editandoDatos ? <X size={13} /> : <SquarePen size={13} />}
                    {editandoDatos ? "Cerrar datos" : "Editar datos"}
                  </button>
                </div>
              </div>

              {/* ================================================== */}
              {/* FICHA DE DATOS — sólo al pedirla                    */}
              {/* ================================================== */}

              {editandoDatos && (
                <div
                  data-export-hide
                  className="min-w-0 border-b border-white/10 bg-[#0B0F14]/60 p-3 sm:p-4 md:p-6"
                >
                  <p className="mb-4 text-[10px] uppercase tracking-[0.2em] text-white/35">
                    Datos del jugador
                  </p>

                  <div className="grid min-w-0 gap-3 sm:grid-cols-2 lg:grid-cols-4">
                    <EditableField
                      label="Nombre completo"
                      value={editForm.JUGADOR}
                      onChange={(value) => updateForm("JUGADOR", value)}
                    />

                    <EditableField
                      label="Nombre deportivo"
                      value={editForm["NOMBRE DEPORTIVO"]}
                      onChange={(value) =>
                        updateForm("NOMBRE DEPORTIVO", value)
                      }
                    />

                    <EditableField
                      label="Equipo"
                      value={editForm.NOMBRE_EQUIPO}
                      onChange={(value) => updateForm("NOMBRE_EQUIPO", value)}
                    />

                    <EditableField
                      label="Dorsal"
                      value={editForm.DORSAL}
                      inputMode="numeric"
                      onChange={(value) => updateForm("DORSAL", value)}
                    />

                    <EditableField
                      label="Posición"
                      value={editForm["POSICIÓN"]}
                      onChange={(value) => updateForm("POSICIÓN", value)}
                    />

                    <EditableField
                      label="2ª posición"
                      value={editForm["2º POSICIÓN"]}
                      onChange={(value) => updateForm("2º POSICIÓN", value)}
                    />

                    <EditableField
                      label="Pie"
                      value={editForm["PIE DOMINANTE"]}
                      onChange={(value) => updateForm("PIE DOMINANTE", value)}
                    />

                    <EditableField
                      label="Edad"
                      value={editForm.EDAD}
                      inputMode="numeric"
                      onChange={(value) => updateForm("EDAD", value)}
                    />

                    <EditableField
                      label="Altura"
                      value={editForm.ALTURA}
                      onChange={(value) => updateForm("ALTURA", value)}
                    />

                    <EditableField
                      label="Peso"
                      value={editForm.PESO}
                      onChange={(value) => updateForm("PESO", value)}
                    />

                    <EditableField
                      label="Procedencia"
                      value={editForm.PROCEDENCIA}
                      onChange={(value) => updateForm("PROCEDENCIA", value)}
                    />

                    <EditableField
                      label="Lugar nacimiento"
                      value={editForm["LUGAR DE NACIMIENTO"]}
                      onChange={(value) =>
                        updateForm("LUGAR DE NACIMIENTO", value)
                      }
                    />

                    <EditableDateField
                      label="Fecha incorporación"
                      value={editForm["FECHA INCORPORACIÓN"]}
                      onChange={(value) =>
                        updateForm("FECHA INCORPORACIÓN", value)
                      }
                    />

                    <EditableField
                      label="Estado"
                      value={editForm.ESTADO}
                      onChange={(value) => updateForm("ESTADO", value)}
                    />

                    <EditableField
                      label="Rol"
                      value={editForm.ROL}
                      onChange={(value) => updateForm("ROL", value)}
                    />

                    <EditableField
                      label="Foto URL"
                      value={editForm.FOTO}
                      onChange={(value) => updateForm("FOTO", value)}
                    />

                    <EditableField
                      label="Vídeo YouTube (URL)"
                      value={editForm.VIDEO}
                      onChange={(value) => updateForm("VIDEO", value)}
                      placeholder="https://youtu.be/…"
                    />

                    <EditableField
                      label="Documento URL"
                      value={editForm.DOC}
                      onChange={(value) => updateForm("DOC", value)}
                    />
                  </div>
                </div>
              )}

              {/* ================================================== */}
              {/* RENDIMIENTO — a todo lo ancho, que es como se lee    */}
              {/* ================================================== */}

              <div className="min-w-0 p-3 sm:p-4 md:p-6">
                <PlayerStatsCard
                  stats={statsDelJugador}
                  loading={statsLoading}
                  missing={statsMissing}
                  slot={slotDelJugador?.slot.key ?? null}
                  side={detectSide(editForm["POSICIÓN"])}
                  positionCode={slotDelJugador?.slot.code}
                  temporadaActual={statsDoc?.temporada}
                />

                {/* El dictado es una herramienta de edición: fuera del PDF. */}

                <div data-export-hide className="mt-5">
                  <RivalVoicePanel
                    current={editForm as unknown as Record<string, unknown>}
                    equipo={editForm.NOMBRE_EQUIPO || selectedTeam}
                    tagCatalog={voiceTagCatalog}
                    activeTagKeys={voiceTagKeys}
                    onApply={applyVoice}
                  />
                </div>

                {/* ============================================== */}
                {/* ANÁLISIS                                        */}
                {/* ============================================== */}

                {/*
                | Las etiquetas, en una franja fina a todo lo ancho: son el
                | resumen de lo que viene debajo y se leen de corrido, no
                | metidas en una columna.
                |
                | Y debajo tres columnas del mismo ancho y el mismo alto —lo que
                | hace bien en verde, por dónde se le gana en rojo, y quién es en
                | la tercera—, que es como sale también el PDF del once. Antes
                | eran tres columnas descuadradas (etiquetas + características,
                | fortalezas + debilidades, observaciones sola) y no había manera
                | de comparar lo bueno con lo malo de un vistazo.
                */}

                <div className="mt-5">
                  <TagPicker
                    value={editForm.IMPACTO}
                    onChange={(value) => updateForm("IMPACTO", value)}
                    compacto
                  />
                </div>

                <div className="mt-3 grid min-w-0 items-stretch gap-3 lg:grid-cols-3">
                  <AnalisisColumna color={TONE_COLOR.fortaleza}>
                    <EditableTextarea
                      label="Fortalezas"
                      color={TONE_COLOR.fortaleza}
                      crece
                      value={editForm.FORTALEZAS}
                      onChange={(value) => updateForm("FORTALEZAS", value)}
                    />
                  </AnalisisColumna>

                  <AnalisisColumna color={TONE_COLOR.debilidad}>
                    <EditableTextarea
                      label="Debilidades"
                      color={TONE_COLOR.debilidad}
                      crece
                      value={editForm.DEBILIDADES}
                      onChange={(value) => updateForm("DEBILIDADES", value)}
                    />
                  </AnalisisColumna>

                  {/* La tercera junta las dos que describen al jugador: se leen
                      del tirón y por separado dejaban la fila coja. */}

                  <AnalisisColumna color={ORO}>
                    <EditableTextarea
                      label="Características"
                      color={ORO}
                      crece
                      rows={3}
                      value={editForm.CARACTERÍSTICAS}
                      onChange={(value) =>
                        updateForm("CARACTERÍSTICAS", value)
                      }
                    />

                    <EditableTextarea
                      label="Observaciones"
                      color={ORO}
                      crece
                      rows={3}
                      value={editForm.OBSERVACIONES}
                      onChange={(value) => updateForm("OBSERVACIONES", value)}
                    />
                  </AnalisisColumna>
                </div>

                {/*
                  Los cortes del coding de este jugador.

                  Salen de codificar un vídeo del rival en /coding: se marcan
                  allí y aparecen aquí solos, en la ficha desde la que se
                  prepara el análisis individual. El vídeo unificado se monta
                  con esta misma portada delante.

                  Va con `data-export-hide`: es cromo de trabajo y no tiene que
                  salir en el PNG ni en el PDF de la ficha.
                */}
                {!isCreating && editForm.ID_JUGADOR && (
                  <div
                    data-export-hide
                    className="mt-4 rounded-2xl border border-white/10 bg-white/[0.02] p-4"
                  >
                    <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
                      <div className="min-w-0">
                        <h4 className="text-sm font-semibold text-white/85">
                          Cortes del coding
                        </h4>

                        <p className="text-[11px] text-white/35">
                          Lo marcado en los vídeos de este rival
                        </p>
                      </div>

                      <Link
                        href={`/coding?ambito=rival&equipo=${encodeURIComponent(
                          textoUtil(editForm.NOMBRE_EQUIPO),
                        )}`}
                        className="rounded-xl border border-white/12 px-3 py-1.5 text-xs text-white/70 transition hover:border-white/25 hover:text-white"
                      >
                        Abrir el coding
                      </Link>
                    </div>

                    <ClipsDelJugador
                      jugadorId={textoUtil(editForm.ID_JUGADOR)}
                      ambito="rival"
                      caratula={
                        datosPortada ?? {
                          equipo: textoUtil(editForm.NOMBRE_EQUIPO),
                          temporada: "",
                          nombre: textoUtil(editForm["NOMBRE DEPORTIVO"]),
                          posicion: textoUtil(editForm["POSICIÓN"]),
                          dorsal: textoUtil(editForm.DORSAL),
                        }
                      }
                    />
                  </div>
                )}
              </div>
            </div>

            {/* FOOTER MODAL */}

            <div
              data-export-hide
              className="flex items-center justify-between gap-3 border-t border-white/10 p-3 sm:p-4 md:p-6"
            >
              {!isCreating ? (
                <button
                  onClick={deletePlayer}
                  disabled={saving}
                  className="flex items-center gap-2 rounded-xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-300 transition hover:bg-red-500/20 disabled:opacity-50"
                >
                  <Trash2 size={16} />
                  Eliminar
                </button>
              ) : (
                <div />
              )}

              <div className="flex items-center gap-3">
                {/* Dar de alta sigue siendo un botón: hasta pulsarlo, el
                    jugador nuevo no existe en ningún sitio. Editar uno que ya
                    existe, en cambio, se guarda solo. */}
                {isCreating ? (
                  <>
                    <button
                      onClick={() => closePlayer()}
                      className="rounded-xl border border-white/10 px-4 py-3 text-sm text-white/60 transition hover:border-white/30 hover:text-white"
                    >
                      Cancelar
                    </button>

                    <button
                      onClick={savePlayer}
                      disabled={saving}
                      className="flex items-center gap-2 rounded-xl bg-[#C8A96B] px-5 py-3 text-sm font-semibold text-black transition hover:bg-[#d8ba7c] disabled:opacity-50"
                    >
                      <Save size={16} />
                      {saving ? "Añadiendo..." : "Añadir jugador"}
                    </button>
                  </>
                ) : (
                  <>
                    <AutoSaveStatus
                      estado={autoFicha.status}
                      guardadoEn={autoFicha.lastSavedAt}
                      onReintentar={() => void autoFicha.flush()}
                      className="sm:hidden"
                    />

                    <button
                      onClick={() => closePlayer()}
                      className="flex items-center gap-2 rounded-xl bg-[#C8A96B] px-5 py-3 text-sm font-semibold text-black transition hover:bg-[#d8ba7c]"
                    >
                      <Check size={16} />
                      Hecho
                    </button>
                  </>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {avisoGuardado}
    </main>
  );
}

/*
|--------------------------------------------------------------------------
| COMPONENTES AUXILIARES
|--------------------------------------------------------------------------
*/

function SearchInput({
  value,
  onChange,
  placeholder,
}: {
  value: string;
  onChange: (value: string) => void;
  placeholder: string;
}) {
  return (
    <div className="relative min-w-0">
      <Search
        size={18}
        className="absolute left-4 top-1/2 -translate-y-1/2 text-white/40"
      />

      <input
        value={value}
        onChange={(event) => onChange(event.target.value)}
        placeholder={placeholder}
        className="w-full min-w-0 rounded-xl border border-white/10 bg-[#11161D] py-3 pl-11 pr-11 outline-none transition focus:border-[#C8A96B]"
      />

      {value && (
        <button
          onClick={() => onChange("")}
          aria-label="Limpiar búsqueda"
          className="absolute right-3 top-1/2 -translate-y-1/2 rounded-full p-1 text-white/40 transition hover:bg-white/10 hover:text-white"
        >
          <X size={16} />
        </button>
      )}
    </div>
  );
}

function PlayerRow({
  player,
  showTeam,
  onceEstado = null,
  onCiclarOnce,
  onClick,
}: {
  player: RivalPlayer;
  showTeam: boolean;
  /** Marca en el once probable, si el equipo tiene once montado. */
  onceEstado?: OnceEstado;
  onCiclarOnce?: () => void;
  onClick: () => void;
}) {
  const { tags } = parseTags(player.IMPACTO);
  const slotEntry = getSlot(player["POSICIÓN"]);

  /* La 2ª posición sólo aporta si es distinta de la principal. */
  const second = getSlot(player["2º POSICIÓN"]);
  const secondSlot = second?.slot.key === slotEntry?.slot.key ? null : second;

  const onceColor = onceEstado ? ONCE_COLOR[onceEstado] : null;

  return (
    /* `div` y no `button`: dentro va el botón del once, y un botón dentro de
       otro no es HTML válido —el navegador lo desanida y se pierde el clic. */
    <div
      role="button"
      tabIndex={0}
      onClick={onClick}
      onKeyDown={(event) => {
        if (event.key === "Enter" || event.key === " ") {
          event.preventDefault();
          onClick();
        }
      }}
      className="group flex min-w-0 cursor-pointer items-center gap-3 bg-[#11161D] p-3 text-left transition hover:bg-white/[0.07]"
    >
      {/* FOTO */}

      <div
        className="relative h-12 w-12 shrink-0 overflow-hidden rounded-full border bg-[#0B0F14]"
        style={{
          borderColor: onceColor ?? "rgba(255,255,255,0.1)",
          borderWidth: onceEstado ? 2 : 1,
          /* La duda va en línea discontinua: sin mirar el color ya se
             distingue del titular confirmado. */
          borderStyle: onceEstado === "duda" ? "dashed" : "solid",
        }}
      >
        {player.FOTO ? (
          /* eslint-disable-next-line @next/next/no-img-element */
          <img
            src={player.FOTO}
            alt={player["NOMBRE DEPORTIVO"] || player.JUGADOR}
            loading="lazy"
            className="h-full w-full object-cover transition group-hover:scale-110"
          />
        ) : (
          <div className="flex h-full items-center justify-center">
            <UserRound size={20} className="text-white/20" />
          </div>
        )}
      </div>

      {/* DORSAL */}

      <div className="w-6 shrink-0 text-center">
        <span className="text-lg font-bold text-white/30">
          {player.DORSAL || "—"}
        </span>
      </div>

      {/* NOMBRE Y POSICIÓN */}

      <div className="min-w-0 flex-1">
        <p className="truncate font-semibold">
          {player["NOMBRE DEPORTIVO"] || player.JUGADOR}
        </p>

        <div className="mt-1 flex min-w-0 items-center gap-1.5">
          {slotEntry ? (
            <span
              className="shrink-0 rounded-md px-1.5 py-0.5 text-[10px] font-bold tracking-wider"
              style={{
                background: `${slotEntry.line.color}26`,
                color: chipInk(slotEntry.line.color),
              }}
            >
              {slotEntry.slot.code}
            </span>
          ) : (
            <span className="shrink-0 rounded-md border border-white/10 bg-white/10 px-1.5 py-0.5 text-[10px] text-white/70">
              ?
            </span>
          )}

          <span className="min-w-0 truncate text-[10px] text-white/45">
            {player["POSICIÓN"] || "—"}
          </span>

          {secondSlot && (
            <span
              title={player["2º POSICIÓN"]}
              className="shrink-0 rounded-md border border-white/10 px-1 py-0.5 text-[9px] text-white/35"
            >
              2ª {secondSlot.slot.code}
            </span>
          )}
        </div>

        {showTeam && (
          <p className="mt-1 min-w-0 truncate text-[10px] text-white/30">
            {player.NOMBRE_EQUIPO}
          </p>
        )}

        {/* ETIQUETAS */}

        {tags.length > 0 && (
          <div className="mt-1.5 flex flex-wrap items-center gap-1">
            {tags.map((tag) => {
              const Icon = tag.icon;

              return (
                <span
                  key={tag.key}
                  title={tag.label}
                  className="flex items-center gap-1 rounded-full px-1.5 py-0.5 text-[9px] font-medium"
                  style={{
                    background: `${tag.color}1F`,
                    color: chipInk(tag.color),
                  }}
                >
                  <Icon size={9} className="shrink-0" />
                  {tag.short}
                </span>
              );
            })}
          </div>
        )}
      </div>

      {/* ROL — la columna estrecha ya no le deja sitio; vuelve en pantallas anchas */}

      {player.ROL && (
        <div className="hidden min-w-0 shrink-0 text-right 2xl:block">
          <p className="text-[9px] uppercase tracking-wider text-white/30">
            Rol
          </p>

          <p className="mt-0.5 max-w-[80px] truncate text-xs text-[#C8A96B]">
            {player.ROL}
          </p>
        </div>
      )}

      {/* ONCE PROBABLE — un clic recorre titular → duda → fuera */}

      {onCiclarOnce && (
        <button
          type="button"
          data-export-hide
          onClick={(event) => {
            /* El clic es del botón, no de la fila: si sube, abre la ficha. */
            event.stopPropagation();
            onCiclarOnce();
          }}
          title={
            onceEstado
              ? `${ONCE_ETIQUETA[onceEstado]} · pulsa para cambiar`
              : "Marcar en el once probable"
          }
          aria-label={`Once probable de ${
            player["NOMBRE DEPORTIVO"] || player.JUGADOR
          }: ${onceEstado ? ONCE_ETIQUETA[onceEstado] : "sin marcar"}`}
          className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full border text-[10px] font-bold transition"
          style={
            onceColor
              ? {
                  borderColor: `${onceColor}80`,
                  background: `${onceColor}26`,
                  color: chipInk(onceColor),
                  borderStyle: onceEstado === "duda" ? "dashed" : "solid",
                }
              : undefined
          }
        >
          {onceEstado === "titular" ? (
            "11"
          ) : onceEstado === "duda" ? (
            "?"
          ) : (
            <Shirt size={13} className="text-white/20" />
          )}
        </button>
      )}
    </div>
  );
}

function EditableField({
  label,
  value,
  onChange,
  inputMode,
  placeholder,
}: {
  label: string;
  value: unknown;
  onChange: (value: string) => void;
  inputMode?: "numeric" | "text";
  placeholder?: string;
}) {
  return (
    <label className="block min-w-0">
      <span className="mb-2 block text-xs uppercase tracking-wider text-white/40">
        {label}
      </span>

      <input
        value={String(value ?? "")}
        inputMode={inputMode}
        placeholder={placeholder}
        onChange={(event) => onChange(event.target.value)}
        className="w-full min-w-0 rounded-xl border border-white/10 bg-[#0B0F14] px-4 py-3 text-sm outline-none transition focus:border-[#C8A96B]"
      />
    </label>
  );
}

/*
| Un texto de análisis.
|
| `color` es el tono del bloque —verde lo que hace bien, rojo por dónde se le
| gana— y tiñe el rótulo, el punto que lo precede y el filo del recuadro. Va en
| `style` y no en clases de Tailwind porque son colores de dato: los mismos que
| llevan las etiquetas y el PDF del once.
|
| Con `crece` la caja se estira hasta llenar su columna. Es lo que mantiene a la
| misma altura las tres columnas del análisis aunque una lleve un párrafo y otra
| dos líneas.
*/
function EditableTextarea({
  label,
  value,
  onChange,
  color,
  crece = false,
  rows = 4,
}: {
  label: string;
  value: unknown;
  onChange: (value: string) => void;
  color?: string;
  crece?: boolean;
  rows?: number;
}) {
  return (
    <label className={`flex min-w-0 flex-col ${crece ? "flex-1" : ""}`}>
      <span
        className="mb-2 flex items-center gap-1.5 text-xs uppercase tracking-wider text-white/40"
        style={color ? { color: chipInk(color) } : undefined}
      >
        {color && (
          <span
            aria-hidden
            className="h-1.5 w-1.5 shrink-0 rounded-full"
            style={{ background: color }}
          />
        )}

        {label}
      </span>

      <textarea
        value={String(value ?? "")}
        onChange={(event) => onChange(event.target.value)}
        rows={rows}
        className={`w-full min-w-0 resize-y rounded-xl border border-white/10 bg-[#0B0F14] px-4 py-3 text-sm outline-none transition focus:border-[#C8A96B] ${
          crece ? "min-h-[110px] flex-1" : ""
        }`}
        style={color ? { borderColor: `${color}3D` } : undefined}
      />
    </label>
  );
}

/*
| Una de las tres columnas del análisis. El panel tintado es lo que las hace
| distinguibles de un vistazo —y lo que ata la ficha de pantalla con la del PDF,
| que las pinta igual—. Todas ocupan el mismo ancho y la rejilla las estira al
| mismo alto.
*/
function AnalisisColumna({
  color,
  children,
}: {
  color: string;
  children: ReactNode;
}) {
  return (
    <div
      className="flex min-w-0 flex-col gap-4 rounded-2xl border p-3 sm:p-4"
      style={{ borderColor: `${color}2E`, background: `${color}0F` }}
    >
      {children}
    </div>
  );
}

function formatDateForInput(value: unknown) {
  if (!value) return "";

  const raw = String(value).trim();

  /* "DD/MM/YYYY" no lo interpreta bien `new Date()`: lo convertimos a mano. */
  const slash = raw.match(/^(\d{1,2})[/-](\d{1,2})[/-](\d{4})$/);

  if (slash) {
    const [, day, month, year] = slash;
    return `${year}-${month.padStart(2, "0")}-${day.padStart(2, "0")}`;
  }

  const date = new Date(raw);

  if (isNaN(date.getTime())) return "";

  return date.toISOString().split("T")[0];
}

function EditableDateField({
  label,
  value,
  onChange,
}: {
  label: string;
  value: unknown;
  onChange: (value: string) => void;
}) {
  return (
    <label className="block min-w-0">
      <span className="mb-2 block text-xs uppercase tracking-wider text-white/40">
        {label}
      </span>

      <input
        type="date"
        value={formatDateForInput(value)}
        onChange={(event) => onChange(event.target.value)}
        className="w-full min-w-0 rounded-xl border border-white/10 bg-[#0B0F14] px-4 py-3 text-sm text-white outline-none transition focus:border-[#C8A96B]"
      />
    </label>
  );
}

function RivalsSkeleton() {
  return (
    <div className="mt-6 grid min-w-0 gap-5 lg:grid-cols-[minmax(230px,1fr)_minmax(0,3fr)]">
      <div className="space-y-5">
        {Array.from({ length: 3 }).map((_, index) => (
          <div
            key={index}
            className="h-56 animate-pulse rounded-2xl border border-white/10 bg-white/[0.03]"
          />
        ))}
      </div>

      <div className="h-[700px] animate-pulse rounded-2xl border border-white/10 bg-white/[0.03]" />
    </div>
  );
}

/*
|--------------------------------------------------------------------------
| ETIQUETAS DE JUGADOR
|--------------------------------------------------------------------------
| Viven en el campo IMPACTO de la hoja, separadas por ";" (o ","), guardadas
| con su etiqueta legible para que la hoja siga siendo entendible a simple
| vista. Al leer aceptamos también la clave y varios alias, así que da igual
| si alguien escribe "cerebro", "El cerebro" u "organizador".
*/

/**
 * De qué habla la etiqueta: de lo que hace bien o de por dónde se le gana.
 *
 * No es sólo cosmética. Una ficha de rival se lee buscando dos cosas
 * distintas —a quién hay que frenar y por dónde se le puede hacer daño—, así
 * que el catálogo se presenta separado en los dos bloques y las debilidades
 * mandan en el campograma, donde sólo caben unas pocas píldoras.
 */
type TagTone = "fortaleza" | "debilidad";

/*
| El color sale del tono, no de la etiqueta.
|
| Antes cada una traía el suyo y una chapa morada no decía nada por sí sola:
| había que leerla para saber si era buena o mala noticia. Con verde y rojo la
| ficha se lee de un vistazo —lo verde es lo que hay que frenar, lo rojo por
| dónde se le gana— y quien distingue una etiqueta de otra es el icono.
*/
/* El dorado de la casa. La tercera columna del análisis —la que describe al
   jugador— no es ni fortaleza ni debilidad, así que lleva éste. */
const ORO = "#C8A96B";

const TONE_COLOR: Record<TagTone, string> = {
  fortaleza: "#34D399",
  debilidad: "#F87171",
};

type PlayerTag = {
  key: string;
  label: string;
  /* Texto corto que se pinta en fichas y tooltips del campograma. */
  short: string;
  icon: LucideIcon;
  color: string;
  aliases: string[];
  tone: TagTone;
};

/* El tono —y con él el color— lo pone el bloque, no cada entrada. */
type TagDef = Omit<PlayerTag, "tone" | "color">;

const FORTALEZAS: TagDef[] = [
  {
    key: "cerebro",
    label: "El cerebro",
    short: "Cerebro",
    icon: Brain,
    aliases: ["cerebro", "organizador", "director de juego", "faro"],
  },
  {
    key: "crack",
    label: "El crack",
    short: "Crack",
    icon: Star,
    aliases: ["crack", "estrella", "diferencial", "franquicia"],
  },
  {
    key: "desequilibrante",
    label: "El desequilibrante",
    short: "Desequilibra",
    icon: Zap,
    aliases: ["desequilibrante", "desequilibra", "desborde"],
  },
  {
    key: "regateador",
    label: "El regateador",
    short: "Regate",
    icon: Shuffle,
    aliases: ["regateador", "regate", "driblador", "encarador"],
  },
  {
    key: "rapido",
    label: "El rápido",
    short: "Rápido",
    icon: Wind,
    aliases: ["rapido", "veloz", "velocidad", "explosivo"],
  },
  {
    key: "fuerte",
    label: "El fuerte",
    short: "Fuerte",
    icon: Dumbbell,
    aliases: ["fuerte", "potente", "fisico", "poderoso"],
  },
  {
    key: "duro",
    label: "El duro",
    short: "Duro",
    icon: Swords,
    aliases: ["duro", "agresivo", "intenso", "guerrero"],
  },
  {
    key: "alto",
    label: "El alto",
    short: "Alto",
    icon: Ruler,
    aliases: ["alto", "aereo", "juego aereo", "dominante por alto"],
  },
  {
    key: "goleador",
    label: "El goleador",
    short: "Gol",
    icon: Target,
    aliases: ["goleador", "gol", "killer", "definidor"],
  },
  {
    key: "asistente",
    label: "El asistente",
    short: "Asiste",
    icon: Handshake,
    aliases: ["asistente", "asistencias", "ultimo pase", "pasador"],
  },
  {
    key: "tecnico",
    label: "El técnico",
    short: "Técnico",
    icon: Sparkles,
    aliases: ["tecnico", "calidad", "talento", "buen pie"],
  },
  {
    key: "motor",
    label: "El motor",
    short: "Motor",
    icon: BatteryCharging,
    aliases: ["motor", "incansable", "box to box", "recorrido", "pulmon"],
  },
  {
    key: "presionador",
    label: "El presionador",
    short: "Presiona",
    icon: Flame,
    aliases: ["presionador", "presion", "primer presionador", "robador"],
  },
  {
    key: "lider",
    label: "El líder",
    short: "Líder",
    icon: Crown,
    aliases: ["lider", "capitan", "referente"],
  },
  {
    key: "zurdo",
    label: "Zurdo diferencial",
    short: "Zurdo",
    icon: Footprints,
    aliases: ["zurdo diferencial", "zurdo", "pierna izquierda"],
  },
  {
    key: "abp-sacador",
    label: "Sacador de ABP",
    short: "Saca ABP",
    icon: Flag,
    aliases: [
      "sacador de abp",
      "sacador abp",
      "lanzador",
      "lanzador de abp",
      "saca abp",
      "especialista abp",
    ],
  },
  {
    key: "abp-rematador",
    label: "Rematador de ABP",
    short: "Remata ABP",
    icon: ArrowBigUp,
    aliases: [
      "rematador de abp",
      "rematador abp",
      "remata abp",
      "referencia abp",
      "rematador",
    ],
  },
  {
    key: "peligro",
    label: "Peligro",
    short: "Peligro",
    icon: AlertTriangle,
    aliases: ["peligro", "vigilar", "atencion", "ojo"],
  },
];

/*
 * Por dónde se le gana. Se escriben en el mismo campo IMPACTO y con la misma
 * mecánica que las fortalezas: lo único que cambia es el bloque en el que se
 * presentan y que pesan más al recortar píldoras.
 */
const DEBILIDADES: TagDef[] = [
  {
    key: "perdedor-duelos",
    label: "Perdedor de duelos",
    short: "Pierde duelos",
    icon: ThumbsDown,
    aliases: [
      "perdedor de duelo",
      "perdedor de duelos",
      "pierde duelos",
      "pierde los duelos",
      "flojo en el duelo",
      "debil en el duelo",
    ],
  },
  {
    key: "lento",
    label: "Lento",
    short: "Lento",
    icon: Snail,
    aliases: [
      "lento",
      "lentitud",
      "poca velocidad",
      "falta de ritmo",
      "le ganan la espalda",
    ],
  },
  {
    key: "errores",
    label: "Comete errores no forzados",
    short: "Errores",
    icon: CircleAlert,
    aliases: [
      "comete errores no forzados",
      "errores no forzados",
      "errores",
      "impreciso",
      "regala balones",
      "perdidas",
    ],
  },
  {
    key: "lesionado",
    label: "Lesionado",
    short: "Lesionado",
    icon: Bandage,
    aliases: ["lesionado", "lesion", "baja", "de baja", "no disponible"],
  },
  {
    key: "tocado",
    label: "Tocado",
    short: "Tocado",
    icon: HeartPulse,
    aliases: [
      "tocado",
      "con molestias",
      "molestias",
      "entre algodones",
      "duda fisica",
    ],
  },
  {
    key: "tarjeteable",
    label: "Tarjeteable",
    short: "Tarjeta",
    icon: RectangleHorizontal,
    aliases: [
      "tarjeteable",
      "apercibido",
      "amonestado",
      "tarjetas",
      "ve muchas tarjetas",
    ],
  },
  {
    key: "flojo-alto",
    label: "Flojo por alto",
    short: "Flojo alto",
    icon: MoveDown,
    aliases: [
      "flojo por alto",
      "flojo de cabeza",
      "no gana por alto",
      "debil en el juego aereo",
      "bajo",
    ],
  },
  {
    key: "perfil-unico",
    label: "Sólo una pierna",
    short: "Perfil único",
    icon: Ban,
    aliases: [
      "solo una pierna",
      "solo un perfil",
      "perfil unico",
      "no usa la otra pierna",
      "monopierna",
    ],
  },
  {
    key: "presionable",
    label: "Sufre la presión",
    short: "Presionable",
    icon: ShieldOff,
    aliases: [
      "sufre la presion",
      "presionable",
      "se le presiona bien",
      "no sale bajo presion",
      "se atasca con presion",
    ],
  },
  {
    key: "no-repliega",
    label: "No repliega",
    short: "No repliega",
    icon: Ghost,
    aliases: [
      "no repliega",
      "no vuelve",
      "no defiende",
      "deja la espalda",
      "poco trabajo defensivo",
    ],
  },
  {
    key: "se-cae",
    label: "Se cae físicamente",
    short: "Se cae",
    icon: BatteryLow,
    aliases: [
      "se cae fisicamente",
      "se cae",
      "baja el ritmo",
      "le falta fondo",
      "poco fondo",
    ],
  },
  {
    key: "descentrado",
    label: "Se descentra",
    short: "Descentra",
    icon: Frown,
    aliases: [
      "se descentra",
      "nervioso",
      "se calienta",
      "pierde la cabeza",
      "reactivo",
    ],
  },
];

function withTone(tags: TagDef[], tone: TagTone): PlayerTag[] {
  return tags.map((tag) => ({ ...tag, tone, color: TONE_COLOR[tone] }));
}

const TAG_GROUPS: { tone: TagTone; label: string; tags: PlayerTag[] }[] = [
  {
    tone: "fortaleza",
    label: "Fortalezas",
    tags: withTone(FORTALEZAS, "fortaleza"),
  },
  {
    tone: "debilidad",
    label: "Por dónde se le gana",
    tags: withTone(DEBILIDADES, "debilidad"),
  },
];

const PLAYER_TAGS: PlayerTag[] = TAG_GROUPS.flatMap((group) => group.tags);

/* En el campograma sólo caben unas pocas: que una lesión no se quede fuera. */
function tagsByPriority(tags: PlayerTag[]) {
  return [
    ...tags.filter((tag) => tag.tone === "debilidad"),
    ...tags.filter((tag) => tag.tone === "fortaleza"),
  ];
}

const TAG_BY_TOKEN = new Map<string, PlayerTag>();

PLAYER_TAGS.forEach((tag) => {
  TAG_BY_TOKEN.set(tag.key, tag);
  TAG_BY_TOKEN.set(normalize(tag.label), tag);

  tag.aliases.forEach((alias) => TAG_BY_TOKEN.set(normalize(alias), tag));
});

/* Etiquetas del catálogo + cualquier texto suelto que ya hubiera escrito. */
type ParsedTags = { tags: PlayerTag[]; extra: string[] };

const NO_TAGS: ParsedTags = { tags: [], extra: [] };

function parseTags(value: unknown): ParsedTags {
  const raw = String(value ?? "").trim();

  if (!raw) return NO_TAGS;

  const tags: PlayerTag[] = [];
  const extra: string[] = [];
  const seen = new Set<string>();

  raw
    .split(/[;,|/\n]+/)
    .map((token) => token.trim())
    .filter(Boolean)
    .forEach((token) => {
      const tag = TAG_BY_TOKEN.get(normalize(token));

      if (!tag) {
        extra.push(token);
        return;
      }

      if (seen.has(tag.key)) return;

      seen.add(tag.key);
      tags.push(tag);
    });

  return { tags, extra };
}

function serializeTags({ tags, extra }: ParsedTags) {
  return [...tags.map((tag) => tag.label), ...extra].join("; ");
}

function toggleTagValue(value: unknown, tag: PlayerTag) {
  const parsed = parseTags(value);

  const exists = parsed.tags.some((item) => item.key === tag.key);

  const tags = exists
    ? parsed.tags.filter((item) => item.key !== tag.key)
    : [...parsed.tags, tag];

  return serializeTags({ tags, extra: parsed.extra });
}

/*
|--------------------------------------------------------------------------
| COMPONENTES DE ETIQUETA
|--------------------------------------------------------------------------
*/

function TagChip({
  tag,
  active = true,
  size = "md",
  count,
  onClick,
  hideOnExport = false,
}: {
  tag: PlayerTag;
  active?: boolean;
  size?: "sm" | "md";
  count?: number;
  onClick?: () => void;
  /** No sale en el PNG / PDF: es una opción del catálogo, no un dato. */
  hideOnExport?: boolean;
}) {
  const Icon = tag.icon;

  const className = `flex shrink-0 items-center gap-1.5 rounded-full border transition ${
    size === "sm" ? "px-1.5 py-0.5 text-[9px]" : "px-2.5 py-1 text-[11px]"
  } ${
    active
      ? ""
      : "border-white/10 bg-white/[0.03] text-white/40 hover:border-white/25 hover:text-white/70"
  }`;

  const style = active
    ? {
        borderColor: `${tag.color}59`,
        background: `${tag.color}1F`,
        color: chipInk(tag.color),
      }
    : undefined;

  const content = (
    <>
      <Icon size={size === "sm" ? 9 : 12} className="shrink-0" />

      <span className="truncate">{size === "sm" ? tag.short : tag.label}</span>

      {count !== undefined && (
        <span className={active ? "opacity-60" : "text-white/25"}>{count}</span>
      )}
    </>
  );

  const exportAttr = hideOnExport ? { "data-export-hide": "" } : {};

  if (!onClick) {
    return (
      <span
        {...exportAttr}
        className={className}
        style={style}
        title={tag.label}
      >
        {content}
      </span>
    );
  }

  return (
    <button
      {...exportAttr}
      type="button"
      onClick={onClick}
      className={className}
      style={style}
    >
      {content}
    </button>
  );
}

/*
| Selector de etiquetas del modal: escribe sobre el campo IMPACTO.
|
| De entrada sólo se ven **las elegidas**. El catálogo son treinta píldoras y
| en una ficha que se consulta más de lo que se edita eran treinta veces más
| ruido que dato: había que buscar las cuatro encendidas entre las apagadas.
| El catálogo entero vive detrás de «Editar», y ahí sí se despliega completo,
| agrupado y con su campo de texto libre.
*/
/*
| Las etiquetas de IMPACTO.
|
| `compacto` es la forma que tiene en la ficha del jugador: una franja fina a
| todo lo ancho, con el rótulo y las chapas en la misma línea. La forma alta
| —cada grupo con su titulillo y sus chapas debajo— sigue estando para donde el
| selector es el contenido y no un resumen.
|
| El catálogo completo, se elija la forma que se elija, sólo aparece al pulsar
| «Editar» y nunca sale en el PNG ni en el PDF.
*/
function TagPicker({
  value,
  onChange,
  compacto = false,
}: {
  value: unknown;
  onChange: (value: string) => void;
  compacto?: boolean;
}) {
  const [editando, setEditando] = useState(false);

  const parsed = useMemo(() => parseTags(value), [value]);

  const activeKeys = useMemo(
    () => new Set(parsed.tags.map((tag) => tag.key)),
    [parsed.tags],
  );

  /* Agrupadas por tono para que las debilidades no se mezclen con las
     fortalezas ni siquiera en la vista corta. */
  const elegidasPorGrupo = TAG_GROUPS.map((group) => ({
    ...group,
    chosen: group.tags.filter((tag) => activeKeys.has(tag.key)),
  })).filter((group) => group.chosen.length > 0);

  /*
  | En la franja fina las chapas van seguidas, sin partir en dos bloques: las
  | debilidades primero, que es lo que se busca antes de un partido, y detrás
  | las fortalezas. El color de cada chapa ya dice de cuál se trata, así que el
  | titulillo del grupo sólo hace falta en la forma alta.
  */
  const enFila = [
    ...parsed.tags.filter((tag) => tag.tone === "debilidad"),
    ...parsed.tags.filter((tag) => tag.tone === "fortaleza"),
  ];

  if (compacto) {
    return (
      <div className="flex min-w-0 flex-wrap items-center gap-x-3 gap-y-2 rounded-xl border border-white/10 bg-[#0B0F14] px-3 py-2">
        <span className="flex shrink-0 items-center gap-2 text-[11px] uppercase tracking-wider text-white/40">
          <Tags size={13} className="text-[#C8A96B]" />
          Etiquetas
        </span>

        {enFila.length > 0 ? (
          <span className="flex min-w-0 flex-1 flex-wrap items-center gap-1.5">
            {enFila.map((tag) => (
              <TagChip
                key={tag.key}
                tag={tag}
                active
                onClick={
                  editando ? undefined : () => onChange(toggleTagValue(value, tag))
                }
              />
            ))}
          </span>
        ) : (
          <span className="flex-1 text-[11px] text-white/30">
            Sin etiquetas.
          </span>
        )}

        <button
          type="button"
          data-export-hide
          onClick={() => setEditando((abierto) => !abierto)}
          className={`flex shrink-0 items-center gap-1.5 rounded-full border px-2.5 py-1 text-[11px] transition ${
            editando
              ? "border-[#C8A96B] bg-[#C8A96B]/15 text-[#C8A96B]"
              : "border-white/15 text-white/55 hover:border-[#C8A96B] hover:text-white"
          }`}
        >
          {editando ? <X size={11} /> : <SquarePen size={11} />}
          {editando ? "Cerrar" : "Editar"}
        </button>

        {/* CATÁLOGO COMPLETO — sólo al editar, y nunca en el PNG / PDF */}

        {editando && (
          <div
            data-export-hide
            className="w-full space-y-3 border-t border-white/10 pt-3"
          >
            {TAG_GROUPS.map((group) => (
              <div key={group.tone}>
                <span className="mb-1.5 block text-[10px] uppercase tracking-[0.2em] text-white/25">
                  {group.label}
                </span>

                <div className="flex flex-wrap gap-2">
                  {group.tags.map((tag) => (
                    <TagChip
                      key={tag.key}
                      tag={tag}
                      active={activeKeys.has(tag.key)}
                      onClick={() => onChange(toggleTagValue(value, tag))}
                    />
                  ))}
                </div>
              </div>
            ))}

            <label className="block pt-1">
              <span className="mb-2 block text-[11px] uppercase tracking-wider text-white/30">
                Valor guardado (columna IMPACTO)
              </span>

              <input
                value={String(value ?? "")}
                onChange={(event) => onChange(event.target.value)}
                placeholder="El cerebro; Sacador de ABP"
                className="w-full min-w-0 rounded-xl border border-white/10 bg-[#11161D] px-4 py-2.5 text-xs outline-none transition focus:border-[#C8A96B]"
              />
            </label>
          </div>
        )}

        {parsed.extra.length > 0 && (
          <p className="w-full text-[11px] text-white/40">
            Texto libre conservado:{" "}
            <span className="text-white/60">{parsed.extra.join(", ")}</span>
          </p>
        )}
      </div>
    );
  }

  return (
    <div className="min-w-0 rounded-2xl border border-white/10 bg-[#0B0F14] p-4">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <span className="flex items-center gap-2 text-xs uppercase tracking-wider text-white/40">
          <Tags size={14} className="text-[#C8A96B]" />
          Etiquetas

          {parsed.tags.length > 0 && (
            <span className="rounded-full bg-white/[0.06] px-1.5 text-[10px] text-white/40">
              {parsed.tags.length}
            </span>
          )}
        </span>

        <button
          type="button"
          data-export-hide
          onClick={() => setEditando((abierto) => !abierto)}
          className={`flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[11px] transition ${
            editando
              ? "border-[#C8A96B] bg-[#C8A96B]/15 text-[#C8A96B]"
              : "border-white/15 text-white/55 hover:border-[#C8A96B] hover:text-white"
          }`}
        >
          {editando ? <X size={11} /> : <SquarePen size={11} />}
          {editando ? "Cerrar" : "Editar"}
        </button>
      </div>

      {/* LO ELEGIDO — lo único que se ve de entrada y lo único que sale en PDF */}

      {elegidasPorGrupo.length > 0 ? (
        <div className="space-y-2.5">
          {elegidasPorGrupo.map((group) => (
            <div key={group.tone}>
              <span className="mb-1.5 block text-[10px] uppercase tracking-[0.2em] text-white/25">
                {group.label}
              </span>

              <div className="flex flex-wrap gap-2">
                {group.chosen.map((tag) => (
                  <TagChip
                    key={tag.key}
                    tag={tag}
                    active
                    /* En la vista corta la píldora también quita: es el gesto
                       que se espera al ver algo marcado. */
                    onClick={
                      editando
                        ? undefined
                        : () => onChange(toggleTagValue(value, tag))
                    }
                  />
                ))}
              </div>
            </div>
          ))}
        </div>
      ) : (
        <p className="text-[11px] text-white/30">
          Sin etiquetas.{" "}
          {!editando && "Pulsa «Editar» para elegirlas del catálogo."}
        </p>
      )}

      {/* CATÁLOGO COMPLETO — sólo al editar, y nunca en el PNG / PDF */}

      {editando && (
        <div
          data-export-hide
          className="mt-4 space-y-3 border-t border-white/10 pt-4"
        >
          {TAG_GROUPS.map((group) => (
            <div key={group.tone}>
              <span className="mb-1.5 block text-[10px] uppercase tracking-[0.2em] text-white/25">
                {group.label}
              </span>

              <div className="flex flex-wrap gap-2">
                {group.tags.map((tag) => (
                  <TagChip
                    key={tag.key}
                    tag={tag}
                    active={activeKeys.has(tag.key)}
                    onClick={() => onChange(toggleTagValue(value, tag))}
                  />
                ))}
              </div>
            </div>
          ))}

          <label className="block pt-1">
            <span className="mb-2 block text-[11px] uppercase tracking-wider text-white/30">
              Valor guardado (columna IMPACTO)
            </span>

            <input
              value={String(value ?? "")}
              onChange={(event) => onChange(event.target.value)}
              placeholder="El cerebro; Sacador de ABP"
              className="w-full min-w-0 rounded-xl border border-white/10 bg-[#11161D] px-4 py-2.5 text-xs outline-none transition focus:border-[#C8A96B]"
            />
          </label>
        </div>
      )}

      {parsed.extra.length > 0 && (
        <p className="mt-3 text-[11px] text-white/40">
          Texto libre conservado:{" "}
          <span className="text-white/60">{parsed.extra.join(", ")}</span>
        </p>
      )}
    </div>
  );
}

/*
|--------------------------------------------------------------------------
| CAMPOGRAMA · MOTOR DE COLOCACIÓN
|--------------------------------------------------------------------------
| El campograma no reparte a la gente por líneas anchas, sino por POSICIÓN:
| cada slot (POR, LI, DFC, MCD, EI…) tiene su ancla en el campo y todos los
| jugadores de ese slot se pintan juntos, en bloque compacto y bajo una misma
| chapa. Así se ve de un golpe cuántos centrales o extremos hay.
|
| La geometría —bandas, tamaño de ficha, reparto sin solapes— ya no vive aquí:
| está en `lib/rivals/campograma-motor.ts` y la comparte con el `.pptx` de día
| de partido, para que la plantilla salga colocada igual en la pantalla y en el
| documento que se lleva a la reunión. Lo que queda en este fichero es lo que
| sólo sabe la pantalla: quién cae en qué slot, cuánto ocupa una ficha con foto
| redonda y nombre debajo, y las medidas apretadas del móvil.
*/

/* La hoja mezcla IZQUIERDO / IZQ / IZDO / I y DERECHO / DCHO / DER / D. */
const LEFT_PATTERN =
  /(^|[\s\-/(.])(izquierd[oa]|izq(da|do)?|izd[oa]?|zurd[oa]|i)([\s\-/).]|$)/;

const RIGHT_PATTERN =
  /(^|[\s\-/(.])(derech[oa]|dch[oa]|dcha|der|dr|d)([\s\-/).]|$)/;

function detectSide(position: string) {
  if (LEFT_PATTERN.test(position)) return -1;
  if (RIGHT_PATTERN.test(position)) return 1;

  return 0;
}

type PlacedPlayer = {
  player: RivalPlayer;
  x: number;
  y: number;
  color: string;
  /**
   * El bloque reserva fila de chapas. Se pinta aunque este jugador no lleve
   * ninguna: si unas fichas la tienen y otras no, cada una se centra con una
   * altura distinta y las fotos de una misma fila quedan a distinto nivel.
   */
  tagRow: boolean;
};

type PlacedCluster = {
  key: string;
  code: string;
  color: string;
  count: number;
  x: number;
  y: number;
  /**
   * Caja del bloque: el fondo que agrupa bajo una misma chapa a todos los de
   * una posición. Lleva su propia X porque la chapa puede acabar desplazada
   * para no pisar a la vecina, y el fondo tiene que quedarse donde está su
   * gente.
   */
  boxX: number;
  boxTop: number;
  boxWidth: number;
  boxHeight: number;
};

type PitchLayout = {
  placed: PlacedPlayer[];
  clusters: PlacedCluster[];
  avatar: number;
  stepX: number;
};

const EMPTY_LAYOUT: PitchLayout = {
  placed: [],
  clusters: [],
  avatar: 0,
  stepX: 0,
};

/*
| Medidas de la ficha para un tamaño de foto dado. Las comparten el motor de
| colocación (para reservar sitio) y el render (para pintar): cuando sólo las
| sabía el render, el motor reservaba menos alto del que ocupaba la ficha y las
| filas se pisaban.
*/
function cardMetrics(avatar: number, compact: boolean) {
  const badge = compact
    ? Math.max(9, Math.min(14, Math.round(avatar * 0.32)))
    : Math.max(11, Math.min(19, Math.round(avatar * 0.32)));

  const nameFont = compact
    ? Math.max(8, Math.min(11, Math.round(avatar * 0.21)))
    : Math.max(9, Math.min(12, Math.round(avatar * 0.21)));

  return { badge, nameFont };
}

function layoutPitch(
  players: RivalPlayer[],
  width: number,
  height: number,
  compact = false,
  horizontal = false,
): PitchLayout {
  if (players.length === 0 || width < 120 || height < 200) return EMPTY_LAYOUT;

  /*
  | 1 · Los once bloques del 1-4-2-3-1.
  |
  | El esqueleto es siempre el mismo y lo que cambia es cuánta gente cae en
  | cada bloque; así dos plantillas seguidas se comparan de un vistazo. Ver
  | `ONCE_1_4_2_3_1` en el motor.
  */

  /* Lo que el motor no necesita saber y el render sí: el código de la chapa y
     el color de la línea. */
  const adornos = new Map<string, { code: string; color: string }>();

  const porBloque = reparteEnOnce(players, (player) => {
    const position = player["POSICIÓN"];
    const entry = getSlot(position);

    const slotKey = entry?.slot.key ?? "otros";
    const anchor = ANCLAS_SLOT[slotKey];

    return {
      slot: slotKey,
      lado: anchor?.xSide ? detectSide(normalize(position)) : 0,
    };
  });

  const entradas: BloqueEntrada<RivalPlayer>[] = [];

  ONCE_1_4_2_3_1.forEach((bloque) => {
    const gente = porBloque.get(bloque.key);

    /* Un bloque vacío no se pinta: sería una chapa flotando en el césped. */
    if (!gente || gente.length === 0) return;

    /*
    | El color de la chapa sale de la línea del PRIMER jugador del bloque y no
    | del bloque: dentro de "MP" puede haber una media punta y un segundo
    | punta, y el color dice de qué línea es la mayoría de ahí.
    */
    adornos.set(bloque.key, {
      code: bloque.code,
      color: getSlot(gente[0]["POSICIÓN"])?.line.color ?? "#9AA3AD",
    });

    entradas.push({
      key: bloque.key,
      anchorX: bloque.anchorX,
      anchorY: bloque.anchorY,
      banda: bloque.banda,
      etiquetado: false,
      jugadores: gente,
      anchoChapa: 0,
    });
  });

  entradas.forEach((bloque) => {
    bloque.jugadores.sort(
      (a, b) => (Number(a.DORSAL) || 999) - (Number(b.DORSAL) || 999),
    );

    bloque.etiquetado = bloque.jugadores.some(
      (player) => parseTags(player.IMPACTO).tags.length > 0,
    );

    /*
    | Ancho de la chapa de posición: px-1.5 y borde a cada lado, el código a
    | 9 px y el contador al lado. Un bloque de una sola columna es más estrecho
    | que su chapa, así que las chapas se deslizan aparte; ensanchar el bloque
    | para que cupiera la chapa le costaba 6 px de foto a toda la plantilla.
    */
    bloque.anchoChapa =
      14 +
      (adornos.get(bloque.key)?.code.length ?? 3) * 5.6 +
      4 +
      String(bloque.jugadores.length).length * 5.4;
  });

  /* 2 · Medidas de la ficha de pantalla. */

  /*
  | En móvil el campo mide poco más de 300 px de ancho: con los márgenes y los
  | pasos de escritorio pedía más sitio del que hay, así que ahí van todos
  | apretados. Los valores de PC son los de siempre.
  */
  const padX = compact ? 10 : 26;
  const padY = compact ? 10 : 16;
  const chipHeight = compact ? 13 : 15;
  const rowGap = compact ? 6 : 8;
  const bandGap = compact ? 7 : 10;
  const stepFactor = compact ? 1.18 : 1.45;
  const gapFactor = compact ? 0.46 : 0.62;

  /*
  | Paso entre fichas de un mismo bloque. La foto no mide `avatar` sino
  | `avatar` más 2 px de borde por lado, así que con el factor a secas, en
  | fotos pequeñas, el paso se quedaba corto y los círculos se tocaban. El
  | mínimo garantiza el borde y un poco de aire.
  */
  const stepFor = (size: number) => Math.max(size * stepFactor, size + 6);

  /*
  | Lo que cuelga por debajo de la foto, medido con las mismas fórmulas que
  | pinta el render. Antes era un número fijo (28 en móvil, 34 en PC) que se
  | quedaba corto en cuanto la ficha llevaba fila de chapas, y las filas se
  | pisaban. La fila de chapas sólo se reserva en los bloques que llevan
  | alguna: reservarla para todos encogía la foto en plantillas donde casi
  | nadie va etiquetado.
  */
  const labelFor = (size: number, tagged: boolean) => {
    const { badge, nameFont } = cardMetrics(size, compact);

    /* border-2 (2+2) + mt-1 + alto de línea leading-tight + py-0.5 (2+2). */
    const base = 4 + 4 + Math.round(nameFont * 1.25) + 4;

    return tagged ? base + 4 + badge : base;
  };

  const reparto = reparteCampograma(entradas, {
    ancho: width,
    alto: height,
    horizontal,
    padAncho: padX,
    padAlto: padY,
    chapaAlto: () => chipHeight,
    huecoFila: () => rowGap,
    huecoBanda: () => bandGap,
    /*
    | Hueco entre dos bloques de la misma banda. De pie es aire lateral y se
    | paga a gusto. Tumbado los bloques van uno debajo de otro y ya vienen
    | separados por la chapa de posición del de abajo: cobrarles además medio
    | ancho de foto dejaba la ficha en 19 px en las plantillas con muchos
    | bloques atrás. Los píxeles de más son para que se vea el corte entre un
    | bloque y el siguiente —dos fondos pegados del mismo color se leían como
    | una sola mancha— y salen del alto que gana el campo al ensancharse.
    */
    huecoBloque: (size) => (horizontal ? rowGap + 12 : size * gapFactor),
    paso: stepFor,
    altoFicha: (size, tagged) => size + labelFor(size, tagged),
    /*
    | De pie una banda es una FILA y las bandas se apilan a lo alto, que es lo
    | que escasea: agrupar de más es lo que hace que quepa la plantilla.
    | Tumbado una banda es una COLUMNA y lo que escasea es el alto DENTRO de
    | ella, así que partirla no cuesta nada y reparte a su gente en dos
    | columnas más cortas. Con el margen ancho, tumbado, la media punta caía en
    | la banda de los extremos y el carrilero en la del pivote.
    */
    margenBanda: horizontal ? 0.03 : 0.07,
    busquedaMin: 1,
    busquedaMax: 62,
    /*
    | Suelo del tamaño de foto. Es sólo una red por si la búsqueda devolviera
    | algo absurdo: como ya devuelve la foto más grande que CABE, cualquier
    | mínimo por encima de ella es pedir un solape a cambio de unos píxeles.
    | Con plantillas reales nunca baja de 22 px.
    */
    suelo: 6,
    opcionesColumnas: [3, 2, 1],
    columnasDeBanda,
    columnasDeBloque,
    huecoChapa: 3,
  });

  /* 3 · Del reparto a lo que pinta el JSX. */

  const placed: PlacedPlayer[] = [];

  const clusters: PlacedCluster[] = reparto.bloques.map((bloque) => {
    const adorno = adornos.get(bloque.key);

    const color = adorno?.color ?? "#9AA3AD";

    bloque.fichas.forEach((ficha) => {
      placed.push({
        player: ficha.item,
        color,
        tagRow: ficha.etiquetado,
        x: ficha.x,
        y: ficha.y,
      });
    });

    return {
      key: bloque.key,
      code: adorno?.code ?? "S/P",
      color,
      count: bloque.cuantos,
      x: bloque.chapaX,
      y: bloque.arriba - 3,
      boxX: bloque.cajaX,
      boxTop: bloque.cajaArriba,
      boxWidth: bloque.cajaAncho,
      boxHeight: bloque.cajaAlto,
    };
  });

  return {
    placed,
    clusters,
    avatar: reparto.tamano,
    stepX: reparto.paso,
  };
}

/*
|--------------------------------------------------------------------------
| CAMPOGRAMA · RENDER
|--------------------------------------------------------------------------
*/

/*
| Ancho del detalle que sale al pasar el ratón. Está aquí y no en una clase de
| Tailwind porque hace falta el número para saber cuánto hay que empujarlo
| hacia dentro en las fichas pegadas a una banda.
*/
const TOOLTIP_ANCHO = 192;

/*
| A partir de este ancho de columna el campo se tumba —atacando a la derecha—
| en vez de pintarse de pie. Es la pantalla de un portátil: ahí sobra ancho y
| falta alto, y un campo vertical de 680 px obliga a hacer scroll para ver la
| plantilla entera. El número es el ancho que la columna del campograma alcanza
| en un portátil normal (~1280 px de ventana), no antes: en `lg` justo, con la
| columna en 530 px, tumbarlo dejaría las bandas sin sitio a lo ancho.
*/
const HORIZONTAL_DESDE = 620;

function TacticalPitch({
  players,
  selectedId,
  activeTags,
  onceEstado,
  onCiclarOnce,
  onPlayerClick,
}: {
  players: RivalPlayer[];
  selectedId?: string;
  activeTags: string[];
  /** Marca de cada jugador en el once probable. */
  onceEstado?: (player: RivalPlayer) => OnceEstado;
  onCiclarOnce?: (player: RivalPlayer) => (() => void) | undefined;
  onPlayerClick: (player: RivalPlayer) => void;
}) {
  const containerRef = useRef<HTMLDivElement>(null);

  const [size, setSize] = useState({ width: 0, height: 0 });

  /*
  | Móvil = por debajo de `md`, que es donde el campograma pasa a ocupar el
  | ancho completo de un teléfono. No vale mirar el ancho del contenedor: en PC
  | la columna del campo también puede ser estrecha y ahí el reparto de
  | escritorio ya está bien.
  */
  const [compact, setCompact] = useState(false);

  useEffect(() => {
    const query = window.matchMedia("(max-width: 767px)");

    const update = () => setCompact(query.matches);

    update();

    query.addEventListener("change", update);

    return () => query.removeEventListener("change", update);
  }, []);

  useEffect(() => {
    const node = containerRef.current;

    if (!node) return;

    const update = () =>
      setSize({ width: node.clientWidth, height: node.clientHeight });

    update();

    const observer = new ResizeObserver(update);

    observer.observe(node);

    return () => observer.disconnect();
  }, []);

  /*
  | En cuanto la columna es claramente apaisada el campo se tumba: es lo que
  | pide un portátil, y es como se pinta ya el campograma de la plantilla
  | propia (`components/ratings/SquadPitch.tsx`). En el móvil manda `compact` y
  | el campo se queda de pie, que es lo que cabe en una pantalla estrecha.
  */
  const horizontal = !compact && size.width >= HORIZONTAL_DESDE;

  const { placed, clusters, avatar, stepX } = useMemo(
    () => layoutPitch(players, size.width, size.height, compact, horizontal),
    [players, size.width, size.height, compact, horizontal],
  );

  /* Las mismas medidas con las que el motor ha reservado el sitio. */
  const { badge: badgeSize, nameFont } = cardMetrics(avatar, compact);

  /*
  | El nombre nunca puede ser más ancho que el paso entre fichas: si lo es, las
  | etiquetas de dos vecinos se solapan aunque las fotos no lo hagan. En móvil
  | por eso ya no lleva suelo: el de 26 px en móvil y el de 46 en PC se comían
  | el paso en cuanto la foto era pequeña, que es cuando la plantilla aprieta.
  */
  const nameWidth = stepX - 4;

  const maxBadges = avatar < 34 ? 2 : avatar < 48 ? 3 : 4;

  return (
    <div
      ref={containerRef}
      className={`pitch-photo relative w-full overflow-hidden bg-[#173b2a] ${
        horizontal
          ? /* Tumbado el campo ya no lleva un alto suelto: toma el ancho que
               le da la columna y de ahí saca el alto con la proporción de la
               foto de fondo (1536×1024 = 3:2). Antes el alto mandaba y la caja
               salía mucho más cuadrada que la foto, así que `object-cover` se
               comía las dos áreas —justo los extremos que se miran cuando el
               campo ataca hacia la derecha—. Ahora la caja ES la foto: se ve
               entera y, como en `xl` la columna se queda con todo el ancho
               sobrante, además es más grande que antes.

               El techo mantiene la tarjeta dentro de la ventana (nada de
               scroll para ver la plantilla) y el suelo de 500 px no es
               decorativo: lo que aprieta tumbado es el alto —es donde se
               reparten los bloques de cada banda— y por debajo la foto se
               queda en nada (a 460 px, una plantilla con cinco bloques atrás
               baja a 18 px). Sólo en pantallas de 1280 px justos entra ese
               suelo, y ahí la foto se estira un pelo en vez de recortarse. */
            "aspect-[3/2] max-h-[calc(100vh-96px)] min-h-[500px]"
          : /* De pie el alto manda: con menos de 680 px una plantilla de 25 no
               cabe en las seis bandas y la foto se va al mínimo. Antes bajaba a
               560 en md. */
            "h-[min(900px,calc(100vh-120px))] min-h-[680px]"
      }`}
    >
      {/* FONDO DEL CAMPO */}

      {/* La imagen es un campo apaisado: de pie hay que girarla, tumbada no. */}

      <div className="pointer-events-none absolute inset-0 overflow-hidden">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src="/emotional-field-bg.webp"
          alt=""
          className={
            horizontal
              ? /* `object-fill` y no `object-cover`: la caja ya viene con la
                   proporción de la foto, así que las dos dan lo mismo salvo
                   cuando entra el suelo de alto. Ahí `cover` recortaría los
                   extremos del campo y `fill` los conserva a cambio de un
                   estiramiento que no se nota en el césped. */
                "absolute inset-0 h-full w-full object-fill"
              : "absolute left-1/2 top-1/2 h-[75%] w-[240%] max-w-none -translate-x-1/2 -translate-y-1/2 rotate-90 object-fill sm:h-[133%] sm:w-[240%] lg:h-[135%] lg:w-[100%]"
          }
        />
      </div>

      <div className="pitch-photo-veil pointer-events-none absolute inset-0 bg-gradient-to-b from-black/45 via-black/10 to-black/45" />

      {/* Modo día: aclara el césped hasta los tonos del tema claro (globals.css) */}

      <div className="pitch-photo-wash" />

      {/* FONDO DEL BLOQUE — el grupo de una posición, de un vistazo */}

      {/* Los colores van en `style` y no en clases de Tailwind porque son los
          de cada línea, y porque las utilidades `bg-white/[0.0x]` se resuelven
          al mismo blanco en modo día (ver `app/globals.css`) y el fondo
          desaparecería sobre el césped aclarado. */}

      {clusters.map((cluster) => (
        <div
          key={`caja-${cluster.key}`}
          className="pointer-events-none absolute rounded-2xl border"
          style={{
            left: cluster.boxX - cluster.boxWidth / 2,
            top: cluster.boxTop,
            width: cluster.boxWidth,
            height: cluster.boxHeight,
            borderColor: `${cluster.color}59`,
            background: `${cluster.color}1F`,
            /* Un filo oscuro por fuera separa dos bloques vecinos de la misma
               línea, que llevan el mismo color y pegados se leían como uno. */
            boxShadow:
              "inset 0 1px 0 rgba(255,255,255,0.07), 0 0 0 1px rgba(8,12,16,0.35)",
          }}
        />
      ))}

      {/* CHAPA DE POSICIÓN — una por bloque, encima de su gente */}

      {clusters.map((cluster) => (
        <span
          key={cluster.key}
          className="pointer-events-none absolute z-10 flex -translate-x-1/2 -translate-y-full items-center gap-1 rounded-full border px-1.5 py-[1px] text-[9px] font-bold uppercase tracking-wider backdrop-blur-sm"
          /* Chapa sólida del color de la línea: es el rótulo del bloque y
             tiene que ganarle al césped y a los bloques de al lado. Antes era
             texto de color sobre fondo oscuro y, en una columna con tres
             bloques seguidos, no marcaba dónde empezaba cada uno. */
          style={{
            left: cluster.x,
            top: cluster.y,
            color: "#0B0F14",
            borderColor: "rgba(8,12,16,0.45)",
            background: cluster.color,
          }}
        >
          {cluster.code}

          <span className="font-semibold text-black/45">{cluster.count}</span>
        </span>
      ))}

      {/* JUGADORES */}

      {placed.map(({ player, x, y, color, tagRow }) => {
        const selected = selectedId === player.ID_JUGADOR;

        const { tags } = parseTags(player.IMPACTO);

        const matchesFilter =
          activeTags.length === 0 ||
          activeTags.every((key) => tags.some((tag) => tag.key === key));

        const visibleTags = tagsByPriority(tags).slice(0, maxBadges);
        const hiddenCount = tags.length - visibleTags.length;

        const name = player["NOMBRE DEPORTIVO"] || player.JUGADOR;

        const enElOnce = onceEstado?.(player) ?? null;
        const ciclar = onCiclarOnce?.(player);

        /*
        | El detalle es un cuadro de 192 px centrado en la ficha, y el campo
        | recorta lo que se salga (`overflow-hidden`). En los extremos —el
        | lateral izquierdo, el extremo derecho— eso dejaba media ventana
        | fuera: justo la gente que más se mira al preparar una banda. Se
        | empuja hacia dentro lo justo para que quepa entera.
        */
        const mitad = TOOLTIP_ANCHO / 2;

        const desplazado =
          size.width > TOOLTIP_ANCHO + 8
            ? Math.min(Math.max(x, mitad + 4), size.width - mitad - 4) - x
            : 0;

        return (
          <div
            key={player.ID_JUGADOR}
            role="button"
            tabIndex={0}
            onClick={() => onPlayerClick(player)}
            onKeyDown={(event) => {
              if (event.key === "Enter" || event.key === " ") {
                event.preventDefault();
                onPlayerClick(player);
              }
            }}
            title={`${name} · ${player["POSICIÓN"]}${
              enElOnce ? ` · ${ONCE_ETIQUETA[enElOnce]}` : ""
            }${
              tags.length ? ` · ${tags.map((tag) => tag.label).join(", ")}` : ""
            }`}
            className={`group absolute z-10 flex -translate-x-1/2 -translate-y-1/2 cursor-pointer flex-col items-center transition duration-200 hover:z-30 ${
              matchesFilter
                ? "opacity-100 hover:scale-110"
                : "opacity-20 grayscale hover:opacity-70"
            }`}
            style={{ left: x, top: y }}
          >
            {/* FOTO — el borde lleva el color de la línea */}

            {/* Contenedor sin recorte: el recorte circular es del `img` de
                dentro, para que dorsal y chapa del once puedan asomar fuera. */}
            <div
              className="relative shrink-0"
              style={{ height: avatar, width: avatar }}
            >
              <div
                className={`h-full w-full overflow-hidden rounded-full border-2 bg-[#11161D] shadow-[0_4px_14px_rgba(0,0,0,0.55)] ${
                  selected ? "ring-2 ring-[#C8A96B]/60" : ""
                }`}
                style={{
                  borderColor: selected ? "#C8A96B" : color,
                  /*
                  | El once se ve antes que nada: un aro exterior verde para el
                  | titular y ámbar para la duda, por fuera del borde de línea
                  | para no pisar el color de la posición. Con `box-shadow` en
                  | vez de otro borde porque no cambia el tamaño de la foto y
                  | el motor de colocación ya repartió el sitio contando con él.
                  */
                  boxShadow: enElOnce
                    ? `0 0 0 3px ${ONCE_COLOR[enElOnce]}${
                        enElOnce === "duda" ? "99" : ""
                      }, 0 4px 14px rgba(0,0,0,0.55)`
                    : undefined,
                }}
              >
                {player.FOTO ? (
                  /* eslint-disable-next-line @next/next/no-img-element */
                  <img
                    src={player.FOTO}
                    alt={name}
                    loading="lazy"
                    className="h-full w-full object-cover"
                  />
                ) : (
                  <UserRound
                    size={Math.round(avatar * 0.5)}
                    className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 text-white/30"
                  />
                )}
              </div>

              {/* DORSAL */}

              {player.DORSAL !== "" && player.DORSAL !== undefined && (
                <span
                  className="absolute -bottom-0.5 -right-0.5 flex items-center justify-center rounded-full bg-[#C8A96B] px-0.5 font-bold text-black shadow"
                  style={{
                    height: badgeSize,
                    minWidth: badgeSize,
                    fontSize: Math.max(8, Math.round(badgeSize * 0.55)),
                  }}
                >
                  {player.DORSAL}
                </span>
              )}

              {/* ONCE PROBABLE — chapa arriba a la izquierda, y también el
                  botón para marcarlo sin abrir la ficha. */}

              {ciclar ? (
                <button
                  type="button"
                  data-export-hide={enElOnce ? undefined : ""}
                  onClick={(event) => {
                    event.stopPropagation();
                    ciclar();
                  }}
                  title={
                    enElOnce
                      ? `${ONCE_ETIQUETA[enElOnce]} · pulsa para cambiar`
                      : "Marcar en el once probable"
                  }
                  aria-label={`Once probable de ${name}: ${
                    enElOnce ? ONCE_ETIQUETA[enElOnce] : "sin marcar"
                  }`}
                  className={`absolute -left-1 -top-1 flex items-center justify-center rounded-full border border-black/40 font-bold shadow transition ${
                    enElOnce
                      ? ""
                      : "opacity-0 group-hover:opacity-100 focus-visible:opacity-100"
                  }`}
                  style={{
                    height: badgeSize,
                    minWidth: badgeSize,
                    fontSize: Math.max(8, Math.round(badgeSize * 0.5)),
                    background: enElOnce
                      ? ONCE_COLOR[enElOnce]
                      : "rgba(8,12,16,0.85)",
                    color: enElOnce ? "#000" : "rgba(255,255,255,0.7)",
                  }}
                >
                  {enElOnce === "titular" ? "11" : enElOnce === "duda" ? "?" : "+"}
                </button>
              ) : (
                enElOnce && (
                  <span
                    title={ONCE_ETIQUETA[enElOnce]}
                    className="absolute -left-1 -top-1 flex items-center justify-center rounded-full border border-black/40 font-bold text-black shadow"
                    style={{
                      height: badgeSize,
                      minWidth: badgeSize,
                      fontSize: Math.max(8, Math.round(badgeSize * 0.5)),
                      background: ONCE_COLOR[enElOnce],
                    }}
                  >
                    {enElOnce === "titular" ? "11" : "?"}
                  </span>
                )
              )}
            </div>

            {/* NOMBRE */}

            <span
              className={`mt-1 truncate rounded bg-black/75 py-0.5 font-semibold leading-tight text-white ${
                compact ? "px-1" : "px-1.5"
              }`}
              style={{ fontSize: nameFont, maxWidth: nameWidth }}
            >
              {name}
            </span>

            {/* ETIQUETAS */}

            {tagRow && (
              <span
                className="mt-1 flex items-center justify-center gap-0.5"
                style={{ height: badgeSize }}
              >
                {visibleTags.map((tag) => {
                  const Icon = tag.icon;

                  return (
                    <span
                      key={tag.key}
                      title={tag.label}
                      className="flex items-center justify-center rounded-full border border-black/40 shadow"
                      style={{
                        height: badgeSize,
                        width: badgeSize,
                        background: tag.color,
                      }}
                    >
                      <Icon
                        size={Math.round(badgeSize * 0.62)}
                        strokeWidth={2.6}
                        className="text-black"
                      />
                    </span>
                  );
                })}

                {hiddenCount > 0 && (
                  <span
                    className="flex items-center justify-center rounded-full bg-black/80 font-bold text-white"
                    style={{
                      height: badgeSize,
                      minWidth: badgeSize,
                      fontSize: Math.max(7, Math.round(badgeSize * 0.5)),
                    }}
                  >
                    +{hiddenCount}
                  </span>
                )}
              </span>
            )}

            {/* DETALLE AL PASAR EL RATÓN */}

            <span
              className={`pointer-events-none absolute left-1/2 z-40 rounded-xl border border-white/15 bg-[#0B0F14]/95 p-2.5 text-left opacity-0 shadow-2xl backdrop-blur transition group-hover:opacity-100 ${
                /* En móvil no hay ratón: el detalle sólo aparecía recortado
                   por el borde del campo al tocar la ficha. */
                compact ? "hidden" : ""
              } ${
                y > size.height / 2 ? "bottom-full mb-2" : "top-full mt-2"
              }`}
              style={{
                width: TOOLTIP_ANCHO,
                /* `-50%` centra sobre la ficha; `desplazado` lo mete dentro
                   del campo cuando la ficha está pegada a una banda. */
                transform: `translateX(calc(-50% + ${desplazado}px))`,
              }}
            >
              <span className="block truncate text-[11px] font-semibold text-white">
                {name}
              </span>

              <span className="mt-0.5 block truncate text-[10px] text-[#C8A96B]">
                {player["POSICIÓN"] || "—"}

                {player["2º POSICIÓN"] && player["2º POSICIÓN"] !== "." && (
                  <span className="text-white/35">
                    {" "}
                    · {player["2º POSICIÓN"]}
                  </span>
                )}
              </span>

              {enElOnce && (
                <span
                  className="mt-1.5 inline-flex items-center gap-1 rounded-full px-1.5 py-0.5 text-[9px] font-semibold"
                  style={{
                    background: `${ONCE_COLOR[enElOnce]}26`,
                    color: chipInk(ONCE_COLOR[enElOnce]),
                  }}
                >
                  {enElOnce === "titular" ? "11" : "?"}{" "}
                  {ONCE_ETIQUETA[enElOnce]}
                </span>
              )}

              {tags.length > 0 && (
                <span className="mt-1.5 flex flex-wrap gap-1">
                  {tags.map((tag) => (
                    <span
                      key={tag.key}
                      className="rounded-full px-1.5 py-0.5 text-[9px] font-medium"
                      style={{
                        background: `${tag.color}26`,
                        color: chipInk(tag.color),
                      }}
                    >
                      {tag.short}
                    </span>
                  ))}
                </span>
              )}
            </span>
          </div>
        );
      })}

      {players.length === 0 && (
        <div className="absolute inset-0 flex items-center justify-center px-6 text-center text-sm text-white/50">
          No hay jugadores con posición asignada.
        </div>
      )}
    </div>
  );
}
