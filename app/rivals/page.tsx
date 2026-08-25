"use client";

import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";

import { chipInk } from "@/lib/theme";
import { toast } from "sonner";

import { Sidebar } from "@/components/ui/sidebar";
import { Topbar } from "@/components/ui/topbar";
import { useSaveGuard } from "@/hooks/useSaveGuard";
import { useBodyScrollLock } from "@/components/season/useBodyScrollLock";
import RivalBoardPanel from "@/components/tactics/RivalBoardPanel";
import RivalVoicePanel from "@/components/voice/RivalVoicePanel";
import PlayerStatsCard from "@/components/rivals/PlayerStatsCard";
import { useRivalStats } from "@/hooks/useRivalStats";
import { useAutoSave } from "@/hooks/useAutoSave";
import { AutoSaveStatus } from "@/components/save-guard/AutoSaveStatus";
import { ColumnasPerdidas } from "@/components/save-guard/ColumnasPerdidas";
import { useRivalOnce } from "@/hooks/useRivalOnce";
import { findStats } from "@/lib/rivals/stats";
import {
  ONCE_COLOR,
  ONCE_ETIQUETA,
  playerKey,
  type OnceEstado,
} from "@/lib/rivals/once";
import { buildRivalSquads } from "@/lib/tactics/rivals";
import type { RivalVoiceField } from "@/lib/voice/types";

import {
  AlertTriangle,
  ArrowBigUp,
  Ban,
  Bandage,
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
  FileText,
  Flag,
  Flame,
  Footprints,
  Frown,
  Ghost,
  Handshake,
  HeartPulse,
  LayoutGrid,
  MoveDown,
  Plus,
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
  Target,
  ThumbsDown,
  Trash2,
  UserRound,
  Video,
  Wind,
  X,
  Zap,
} from "lucide-react";

import type { LucideIcon } from "lucide-react";

const RIVALS_API_URL = "/api/rivals";

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

  const [selectedTeam, setSelectedTeam] = useState<string>("");

  const [search, setSearch] = useState("");
  const [positionSearch, setPositionSearch] = useState("");

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

        const response = await fetch(
          `${RIVALS_API_URL}?action=rivalesPlantillas`,
        );

        const data = await response.json();

        if (cancelled) return;

        if (Array.isArray(data)) {
          setPlayers(data);

          setSelectedTeam((current) => {
            if (current && data.some((p) => p.NOMBRE_EQUIPO === current)) {
              return current;
            }

            return data[0]?.NOMBRE_EQUIPO ?? "";
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

  const teams = useMemo(() => {
    const counts = new Map<string, number>();

    players.forEach((player) => {
      const team = String(player.NOMBRE_EQUIPO || "");
      if (!team) return;

      counts.set(team, (counts.get(team) ?? 0) + 1);
    });

    return [...counts.entries()]
      .map(([name, count]) => ({ name, count }))
      .sort((a, b) => a.name.localeCompare(b.name));
  }, [players]);

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

  const filteredPlayers = useMemo(() => {
    const searchValue = normalize(search);
    const positionSearchValue = normalize(positionSearch);

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
  }, [players, selectedTeam, search, positionSearch]);

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
        throw new Error(result.error || "No se pudo guardar");
      }

      const verificacion = await verificarGuardado({
        titulo: `Jugador rival · ${
          form["NOMBRE DEPORTIVO"] || form.JUGADOR
        }`,
        enviado: form as unknown as Record<string, unknown>,
        modoAuto: true,
        releer: async () => {
          const relectura = await fetch(
            `${RIVALS_API_URL}?action=rivalesPlantillas`,
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
        throw new Error(result.error || "No se pudo guardar");
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
          const relectura = await fetch(
            `${RIVALS_API_URL}?action=rivalesPlantillas`,
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

      toast.error(
        isCreating
          ? "No se pudo añadir el jugador"
          : "No se pudo guardar el jugador",
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
        throw new Error(result.error || "No se pudo eliminar");
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

      toast.error("No se pudo eliminar el jugador");
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
                    {team.name}

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

              <div className="mt-4 min-w-0 rounded-2xl border border-white/10 bg-white/[0.025] p-4">
                <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
                  <span className="flex items-center gap-2 text-[11px] uppercase tracking-[0.25em] text-[#C8A96B]">
                    <Tags size={14} />
                    Etiquetas
                  </span>

                  <span className="text-[11px] text-white/30">
                    {activeTags.length > 0
                      ? "Se atenúan en el campo los que no las cumplen"
                      : "Pulsa para filtrar · se editan en la ficha del jugador"}
                  </span>
                </div>

                <div className="min-w-0 space-y-3">
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
                   golpe. El listado se queda en un cuarto del ancho, en una
                   sola columna, como índice para buscar a alguien concreto. */
                <div className="mt-6 grid min-w-0 items-stretch gap-5 lg:grid-cols-[minmax(230px,1fr)_minmax(0,3fr)]">
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
                      <div className="flex min-w-0 items-center justify-between gap-3 border-b border-white/10 bg-white/[0.025] px-4 py-3">
                        <h2 className="min-w-0 truncate text-xs font-semibold uppercase tracking-[0.25em] text-[#C8A96B]">
                          CAMPOGRAMA
                          {pitchTeam && teamsInResults.length > 1 && (
                            <span className="ml-2 normal-case tracking-normal text-white/30">
                              · {pitchTeam}
                            </span>
                          )}
                        </h2>

                        <div className="flex shrink-0 items-center gap-2 text-xs text-white/30">
                          {activeTags.length > 0 && (
                            <span className="text-[#C8A96B]">
                              {listPlayers.length} destacados
                            </span>
                          )}

                          {/* ONCE PROBABLE — cuántos hay puestos y cuántas dudas */}

                          <span
                            title="Titulares marcados en el once probable"
                            className="flex items-center gap-1 rounded-full border px-2 py-0.5 font-semibold"
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
                              className="flex items-center gap-1 rounded-full border px-2 py-0.5 font-semibold"
                              style={{
                                borderColor: `${ONCE_COLOR.duda}55`,
                                background: `${ONCE_COLOR.duda}18`,
                                color: chipInk(ONCE_COLOR.duda),
                              }}
                            >
                              {onceResumen.dudas} ?
                            </span>
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
                                        borderColor: "rgba(255,255,255,0.35)",
                                        color: "#fff",
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
                        Vídeo
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
                      label="Vídeo URL"
                      value={editForm.VIDEO}
                      onChange={(value) => updateForm("VIDEO", value)}
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
                  stats={findStats(statsDoc, editForm)}
                  loading={statsLoading}
                  missing={statsMissing}
                  slot={slotDelJugador?.slot.key ?? null}
                  side={detectSide(editForm["POSICIÓN"])}
                  positionCode={slotDelJugador?.slot.code}
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
                {/* ANÁLISIS — tres columnas, no una lista larga    */}
                {/* ============================================== */}

                <div className="mt-5 grid min-w-0 gap-4 xl:grid-cols-3">
                  <div className="min-w-0 space-y-4">
                    <TagPicker
                      value={editForm.IMPACTO}
                      onChange={(value) => updateForm("IMPACTO", value)}
                    />

                    <EditableTextarea
                      label="Características"
                      value={editForm.CARACTERÍSTICAS}
                      onChange={(value) =>
                        updateForm("CARACTERÍSTICAS", value)
                      }
                    />
                  </div>

                  <div className="min-w-0 space-y-4">
                    <EditableTextarea
                      label="Fortalezas"
                      value={editForm.FORTALEZAS}
                      onChange={(value) => updateForm("FORTALEZAS", value)}
                    />

                    <EditableTextarea
                      label="Debilidades"
                      value={editForm.DEBILIDADES}
                      onChange={(value) => updateForm("DEBILIDADES", value)}
                    />
                  </div>

                  <div className="min-w-0">
                    <EditableTextarea
                      label="Observaciones"
                      value={editForm.OBSERVACIONES}
                      onChange={(value) => updateForm("OBSERVACIONES", value)}
                    />
                  </div>
                </div>
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
}: {
  label: string;
  value: unknown;
  onChange: (value: string) => void;
  inputMode?: "numeric" | "text";
}) {
  return (
    <label className="block min-w-0">
      <span className="mb-2 block text-xs uppercase tracking-wider text-white/40">
        {label}
      </span>

      <input
        value={String(value ?? "")}
        inputMode={inputMode}
        onChange={(event) => onChange(event.target.value)}
        className="w-full min-w-0 rounded-xl border border-white/10 bg-[#0B0F14] px-4 py-3 text-sm outline-none transition focus:border-[#C8A96B]"
      />
    </label>
  );
}

function EditableTextarea({
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

      <textarea
        value={String(value ?? "")}
        onChange={(event) => onChange(event.target.value)}
        rows={4}
        className="w-full min-w-0 resize-y rounded-xl border border-white/10 bg-[#0B0F14] px-4 py-3 text-sm outline-none transition focus:border-[#C8A96B]"
      />
    </label>
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
function TagPicker({
  value,
  onChange,
}: {
  value: unknown;
  onChange: (value: string) => void;
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
| El campograma ya no reparte a la gente por líneas anchas, sino por
| POSICIÓN: cada slot (POR, LI, DFC, MCD, EI…) tiene su ancla en el campo y
| todos los jugadores de ese slot se pintan juntos, en bloque compacto y bajo
| una misma chapa. Así se ve de un golpe cuántos centrales o extremos hay.
|
|   1. Cada jugador cae en un slot (el mismo getSlot que usa el listado) y,
|      si el slot admite lado, se separa en variante izquierda / derecha.
|   2. Los slots a alturas parecidas comparten "banda" para no gastar alto de
|      más; dentro de la banda los bloques van uno al lado del otro.
|   3. El tamaño de ficha se despeja para que quepan todas las bandas a lo
|      alto y todos los bloques a lo ancho; después se resuelven los solapes
|      (horizontales dentro de la banda, verticales entre bandas).
|
| El mismo motor pinta el campo de pie —atacando hacia arriba, que es lo que
| pide un móvil— y tumbado —atacando hacia la derecha, que es lo que pide un
| portátil—. Para eso no razona en X/Y sino en dos ejes: el PROFUNDO, en el que
| se apilan las bandas, y el LARGO, en el que cada banda reparte sus bloques.
| De pie profundo = Y y largo = X; tumbado, al revés. Lo que no gira es la
| ficha, que siempre lleva el nombre bajo la foto: por eso cada bloque mide
| distinto en cada eje (`alongOf` / `deepOf`) en vez de tener un solo tamaño.
*/

/*
| Ancla de cada slot en fracciones del campo (el ataque, arriba). `xSide` es
| cuánto se desplaza a los lados cuando la posición trae lado ("interior
| derecho"); los slots que ya son de un lado (LI, LD, EI, ED) no lo llevan.
*/
const SLOT_ANCHORS: Record<string, { x: number; y: number; xSide?: number }> = {
  dc: { x: 0.5, y: 0.1, xSide: 0.16 },
  sd: { x: 0.5, y: 0.19, xSide: 0.16 },
  ei: { x: 0.12, y: 0.28 },
  ed: { x: 0.88, y: 0.28 },
  ext: { x: 0.5, y: 0.28, xSide: 0.38 },
  mp: { x: 0.5, y: 0.35, xSide: 0.16 },
  int: { x: 0.5, y: 0.47, xSide: 0.26 },
  mc: { x: 0.5, y: 0.5, xSide: 0.18 },
  med: { x: 0.5, y: 0.5, xSide: 0.18 },
  mcd: { x: 0.5, y: 0.63, xSide: 0.18 },
  car: { x: 0.5, y: 0.7, xSide: 0.4 },
  li: { x: 0.11, y: 0.79 },
  ld: { x: 0.89, y: 0.79 },
  dfc: { x: 0.5, y: 0.81, xSide: 0.15 },
  def: { x: 0.5, y: 0.81, xSide: 0.3 },
  por: { x: 0.5, y: 0.93 },
};

const FALLBACK_ANCHOR = { x: 0.5, y: 0.56 };

/*
| Reparte una fila de cajas entre `from` y `to`: cada una lo más cerca posible
| de donde querría estar, sin pisar a la anterior y sin salirse. Devuelve los
| centros.
|
| La clave es que los límites se encadenan desde los dos extremos: el mínimo de
| una caja sale del sitio que ya ocupan todas las anteriores y su máximo del que
| necesitan todas las siguientes. Empujar sólo hacia un lado y recortar al final
| —como se hacía antes— dejaba dos cajas en la misma posición cuando la fila no
| cabía. Si no cabe, el hueco se encoge (puede quedar negativo) y el apretón se
| reparte entre todas en vez de amontonarse en un extremo.
*/
function packRow(
  widths: number[],
  wanted: number[],
  from: number,
  to: number,
  gap: number,
): number[] {
  const halves = widths.map((width) => width / 2);

  const total = widths.reduce((sum, width) => sum + width, 0);

  const room = Math.min(
    gap,
    (to - from - total) / Math.max(1, widths.length - 1),
  );

  const low: number[] = [];
  const high: number[] = [];

  halves.forEach((half, index) => {
    low[index] =
      index === 0
        ? from + half
        : low[index - 1] + halves[index - 1] + room + half;
  });

  for (let index = halves.length - 1; index >= 0; index -= 1) {
    high[index] =
      index === halves.length - 1
        ? to - halves[index]
        : high[index + 1] - halves[index + 1] - room - halves[index];
  }

  const centers: number[] = [];

  let nextMin = -Infinity;

  halves.forEach((half, index) => {
    const target = Math.min(Math.max(wanted[index], low[index]), high[index]);

    centers[index] = Math.max(target, nextMin);

    nextMin = centers[index] + half + room + (halves[index + 1] ?? 0);
  });

  return centers;
}

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

/* Forma del bloque: cuadrado antes que fila larga, para que quede apretado. */
function clusterColumns(count: number) {
  if (count <= 3) return count;
  if (count === 4) return 2;

  return 3;
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

type PitchCluster = {
  key: string;
  code: string;
  color: string;
  anchorX: number;
  anchorY: number;
  players: RivalPlayer[];
  /** Alguien del bloque lleva chapas de IMPACTO: su ficha es más alta. */
  tagged: boolean;
  cols: number;
  rows: number;
  /** Centro del bloque en el eje que reparte su banda (X de pie, Y tumbado). */
  along: number;
  /** Lo que ocupa el bloque en pantalla: la chapa de posición va en el alto. */
  width: number;
  height: number;
  /** Alto de una ficha del bloque y salto entre filas, ya con su etiqueta. */
  cardHeight: number;
  stepY: number;
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

  /* 1 · Un bloque por posición (slot + lado). */

  const byKey = new Map<string, PitchCluster>();

  players.forEach((player) => {
    const position = player["POSICIÓN"];
    const entry = getSlot(position);

    const slotKey = entry?.slot.key ?? "otros";
    const anchor = SLOT_ANCHORS[slotKey] ?? FALLBACK_ANCHOR;

    const side = anchor.xSide ? detectSide(normalize(position)) : 0;
    const key = `${slotKey}:${side}`;

    const existing = byKey.get(key);

    if (existing) {
      existing.players.push(player);
      return;
    }

    byKey.set(key, {
      key,
      code:
        (entry?.slot.code ?? "S/P") + (side < 0 ? " I" : side > 0 ? " D" : ""),
      color: entry?.line.color ?? "#9AA3AD",
      anchorX: anchor.x + side * (anchor.xSide ?? 0),
      anchorY: anchor.y,
      players: [player],
      tagged: false,
      cols: 0,
      rows: 0,
      along: 0,
      width: 0,
      height: 0,
      cardHeight: 0,
      stepY: 0,
    });
  });

  const clusters = [...byKey.values()];

  clusters.forEach((cluster) => {
    cluster.players.sort(
      (a, b) => (Number(a.DORSAL) || 999) - (Number(b.DORSAL) || 999),
    );

    cluster.tagged = cluster.players.some(
      (player) => parseTags(player.IMPACTO).tags.length > 0,
    );
  });

  /* 2 · Bandas: slots a alturas parecidas comparten fila del campo. */

  clusters.sort((a, b) => a.anchorY - b.anchorY);

  const bands: { clusters: PitchCluster[]; anchorY: number; rows: number }[] =
    [];

  clusters.forEach((cluster) => {
    const last = bands[bands.length - 1];

    if (last && cluster.anchorY - last.anchorY <= 0.07) {
      last.clusters.push(cluster);
      return;
    }

    bands.push({
      clusters: [cluster],
      anchorY: cluster.anchorY,
      rows: 0,
    });
  });

  /*
  | Tumbado se ataca hacia la derecha: la banda que de pie va arriba —los
  | delanteros— pasa a ser la de más a la derecha. Se le da la vuelta a la lista
  | para que el resto del reparto pueda recorrer las bandas en el mismo orden en
  | que se pintan en pantalla, que es lo que dan por hecho los pasos 5 y 6.
  */
  if (horizontal) bands.reverse();

  /* Forma de los bloques con un tope de columnas dado. */
  const shapeClusters = (maxCols: number) => {
    clusters.forEach((cluster) => {
      cluster.cols = Math.min(clusterColumns(cluster.players.length), maxCols);
      cluster.rows = Math.ceil(cluster.players.length / cluster.cols);
    });

    bands.forEach((band) => {
      band.rows = band.clusters.reduce(
        (max, cluster) => Math.max(max, cluster.rows),
        0,
      );
    });
  };

  /* 3 · Tamaño de ficha con el que todo cabe. */

  /*
  | Medidas del reparto. En móvil el campo mide poco más de 300 px de ancho:
  | con los márgenes y los pasos de escritorio pedía más sitio del que hay, así
  | que ahí van todos apretados. Los valores de PC son los de siempre.
  */
  const padX = compact ? 10 : 26;
  const padY = compact ? 10 : 16;
  const chipHeight = compact ? 13 : 15;
  const rowGap = compact ? 6 : 8;
  const bandGap = compact ? 7 : 10;
  const stepFactor = compact ? 1.18 : 1.45;
  const gapFactor = compact ? 0.46 : 0.62;
  /*
  | Suelo del tamaño de foto. Es sólo una red por si `fitAvatar` devolviera
  | algo absurdo: como ya devuelve la foto más grande que CABE, cualquier
  | mínimo por encima de ella es pedir un solape a cambio de unos píxeles. Con
  | plantillas reales nunca baja de 22 px; este número sólo entra en juego con
  | plantillas imposibles (30 y pico jugadores en un campo muy corto), y ahí
  | preferimos la foto diminuta a dos fichas una encima de otra.
  */
  const minAvatar = 6;

  /*
  | Los dos ejes del reparto. De pie se ataca hacia arriba: las bandas se apilan
  | en el eje PROFUNDO (la Y) y cada banda coloca sus bloques en el eje LARGO
  | (la X). Tumbado se ataca hacia la derecha y los dos ejes se cambian el
  | papel: las bandas se apilan a lo ancho y cada una reparte a lo alto.
  |
  | Lo que no gira es la ficha: la foto siempre lleva el nombre debajo, así que
  | un bloque no mide lo mismo a lo ancho que a lo alto y hay que preguntarle al
  | eje —no al bloque— cuánto sitio ocupa.
  */
  const alongExtent = horizontal ? height : width;
  const alongPad = horizontal ? padY : padX;
  const deepExtent = horizontal ? width : height;
  const deepPad = horizontal ? padX : padY;

  const freeAlong = alongExtent - 2 * alongPad;

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

  /*
  | Lo que ocupa un bloque en pantalla con una foto de este tamaño. La chapa de
  | posición se pinta encima del bloque, así que cuenta como alto suyo.
  */
  const blockWidthFor = (cluster: PitchCluster, size: number) =>
    cluster.cols * stepFor(size);

  const blockHeightFor = (cluster: PitchCluster, size: number) =>
    chipHeight +
    cluster.rows * (size + labelFor(size, cluster.tagged) + rowGap);

  const alongOf = (cluster: PitchCluster, size: number) =>
    horizontal ? blockHeightFor(cluster, size) : blockWidthFor(cluster, size);

  /*
  | Hueco entre dos bloques de la misma banda. De pie es aire lateral y se paga
  | a gusto. Tumbado los bloques van uno debajo de otro y ya vienen separados
  | por la chapa de posición del de abajo: cobrarles además medio ancho de foto
  | dejaba la ficha en 19 px en las plantillas con muchos bloques atrás.
  */
  const gapFor = (size: number) => (horizontal ? rowGap : size * gapFactor);

  const deepOf = (cluster: PitchCluster, size: number) =>
    horizontal ? blockWidthFor(cluster, size) : blockHeightFor(cluster, size);

  /* Profundidad total que pide el reparto con una foto de este tamaño. */
  const deepFor = (size: number) =>
    2 * deepPad +
    (bands.length - 1) * bandGap +
    bands.reduce(
      (total, band) =>
        total +
        band.clusters.reduce(
          (deepest, cluster) => Math.max(deepest, deepOf(cluster, size)),
          0,
        ),
      0,
    );

  /*
  | Ancho de la chapa de posición: px-1.5 y borde a cada lado, el código a 9 px
  | y el contador al lado. Un bloque de una sola columna es más estrecho que su
  | chapa, así que las chapas se reparten aparte (paso 6): ensanchar el bloque
  | para que cupiera la chapa le costaba 6 px de foto a toda la plantilla.
  */
  const chipWidth = (cluster: PitchCluster) =>
    14 +
    cluster.code.length * 5.6 +
    4 +
    String(cluster.players.length).length * 5.4;

  /* Lo que pide, en su eje largo, la banda más apretada. */
  const alongFor = (size: number) =>
    bands.reduce((longest, band) => {
      const total = band.clusters.reduce(
        (sum, cluster) => sum + alongOf(cluster, size),
        0,
      );

      return Math.max(
        longest,
        total + (band.clusters.length - 1) * gapFor(size),
      );
    }, 0);

  /*
  | Forma de los bloques tumbado, banda a banda. Aquí no vale un tope común
  | para todo el campo: el ancho de cada banda se SUMA (son columnas, una al
  | lado de otra), así que ensanchar un bloque que no lo necesita le quita
  | ancho a todas las demás. En la banda apretada —cinco bloques de defensas
  | uno debajo de otro— interesa lo contrario: bloques anchos de una sola fila,
  | porque cada fila se come el alto, que es lo que ahí escasea.
  |
  | Se empieza con todos los bloques en una columna y se va ensanchando el que
  | más alto ocupa hasta que la banda cabe. Ensanchar es gratis mientras el
  | bloque no pase del más ancho de su banda: ésos van primero.
  */
  const shapeBands = (size: number) => {
    bands.forEach((band) => {
      band.clusters.forEach((cluster) => {
        cluster.cols = 1;
        cluster.rows = cluster.players.length;
      });

      const bandAlong = () =>
        band.clusters.reduce((sum, cluster) => sum + alongOf(cluster, size), 0) +
        (band.clusters.length - 1) * gapFor(size);

      while (bandAlong() > freeAlong) {
        const anchas = Math.max(...band.clusters.map((item) => item.cols));

        const candidatos = band.clusters.filter(
          (cluster) => cluster.cols < cluster.players.length,
        );

        if (candidatos.length === 0) break;

        const gratis = candidatos.filter((cluster) => cluster.cols < anchas);

        const worst = (gratis.length > 0 ? gratis : candidatos).reduce(
          (tallest, cluster) =>
            alongOf(cluster, size) > alongOf(tallest, size) ? cluster : tallest,
        );

        worst.cols += 1;
        worst.rows = Math.ceil(worst.players.length / worst.cols);
      }

      band.rows = band.clusters.reduce(
        (max, cluster) => Math.max(max, cluster.rows),
        0,
      );
    });
  };

  /*
  | El alto de la ficha depende del propio tamaño de la foto (la tipografía y
  | la chapa del dorsal están topadas por arriba y por abajo), así que ya no se
  | puede despejar de una fórmula: buscamos por bisección la foto más grande
  | con la que todo cabe de verdad, a lo alto y a lo ancho. Con las medidas de
  | escritorio esto da el mismo número que la fórmula que había antes.
  */
  const fitAvatar = () => {
    const fits = (size: number) => {
      /* Tumbado la forma depende del tamaño: se rehace en cada prueba. */
      if (horizontal) shapeBands(size);

      return deepFor(size) <= deepExtent && alongFor(size) <= freeAlong;
    };

    let low = 1;
    let high = 62;

    if (!fits(low)) return low;
    if (fits(high)) return high;

    for (let step = 0; step < 40; step += 1) {
      const mid = (low + high) / 2;

      if (fits(mid)) low = mid;
      else high = mid;
    }

    return low;
  };

  /*
  | En una banda con muchos bloques (laterales + tres bloques de centrales es el
  | caso típico) el ancho es lo que aprieta y la foto se queda diminuta.
  | Probamos también bloques de dos y de una columna —apilar en vertical
  | estrecha la banda— y nos quedamos con el reparto que deja la foto más
  | grande. Como `fitAvatar` elige el máximo, probar de más nunca empeora.
  */
  const columnOptions = [3, 2, 1];

  let bestCols = columnOptions[0];
  let bestFit = -Infinity;

  if (horizontal) {
    /* Tumbado la forma la decide `shapeBands` dentro de la propia búsqueda. */
    bestFit = fitAvatar();
  } else {
    columnOptions.forEach((maxCols) => {
      shapeClusters(maxCols);

      const fit = fitAvatar();

      if (fit > bestFit) {
        bestFit = fit;
        bestCols = maxCols;
      }
    });

    shapeClusters(bestCols);
  }

  const avatar = Math.max(minAvatar, bestFit);

  /* La última prueba de la bisección pudo ser con una foto que no cabía. */
  if (horizontal) shapeBands(avatar);

  const stepX = stepFor(avatar);
  const clusterGap = gapFor(avatar);

  /* Cada bloque sabe ya lo que mide: los etiquetados llevan la ficha más alta. */
  clusters.forEach((cluster) => {
    cluster.cardHeight = avatar + labelFor(avatar, cluster.tagged);
    cluster.stepY = cluster.cardHeight + rowGap;
    cluster.width = cluster.cols * stepX;
    cluster.height = chipHeight + cluster.rows * cluster.stepY;
  });

  /*
  | 4 · Reparto dentro de la banda: cada bloque en su ancla, sin pisarse. De
  | pie eso es repartir a lo ancho; tumbado, a lo alto.
  |
  | Antes se empujaba cada bloque hacia la derecha sin tope y, al final, un
  | clamp devolvía al campo lo que se hubiera salido. En una banda que no cabe
  | entera —laterales derechos + tres bloques de centrales es el caso típico—
  | ese clamp dejaba dos bloques en la misma X, uno encima del otro; y en PC,
  | donde no había clamp, el último bloque se salía del campo y el recorte se
  | lo comía. `packRow` no puede hacer ni una cosa ni la otra.
  */

  bands.forEach((band) => {
    /* Tumbado el campo gira en el sentido del reloj: la banda izquierda queda
       arriba, así que el mismo orden de anclas vale para los dos casos. */
    band.clusters.sort((a, b) => a.anchorX - b.anchorX);

    const centers = packRow(
      band.clusters.map((cluster) =>
        horizontal ? cluster.height : cluster.width,
      ),
      band.clusters.map((cluster) => cluster.anchorX * alongExtent),
      alongPad,
      alongExtent - alongPad,
      clusterGap,
    );

    band.clusters.forEach((cluster, index) => {
      cluster.along = centers[index];
    });
  });

  /* 5 · Cada banda a su profundidad, sin pisar a la anterior. */

  /* Lo que ocupa la banda en el eje profundo: su bloque más hondo. */
  const bandDeeps = bands.map((band) =>
    band.clusters.reduce(
      (deepest, cluster) =>
        Math.max(deepest, horizontal ? cluster.width : cluster.height),
      0,
    ),
  );

  const centers = bands.map(
    (band) => (horizontal ? 1 - band.anchorY : band.anchorY) * deepExtent,
  );

  /* Avanzando: nadie pisa a la banda anterior. */
  let cursor = deepPad;

  bands.forEach((band, index) => {
    const half = bandDeeps[index] / 2;

    centers[index] = Math.max(centers[index], cursor + half);
    cursor = centers[index] + half + bandGap;
  });

  /* Volviendo: lo que se haya salido por el final vuelve a entrar. */
  let limit = deepExtent - deepPad;

  for (let index = bands.length - 1; index >= 0; index -= 1) {
    const half = bandDeeps[index] / 2;

    centers[index] = Math.min(centers[index], limit - half);
    limit = centers[index] - half - bandGap;
  }

  /*
  | Red de seguridad: si ni con la ficha al mínimo cabe todo, preferimos
  | amontonar un poco a que alguien acabe fuera del campo.
  */
  cursor = deepPad;

  bands.forEach((band, index) => {
    const half = bandDeeps[index] / 2;

    centers[index] = Math.min(
      Math.max(centers[index], cursor + half),
      Math.max(deepPad + half, deepExtent - deepPad - half),
    );

    cursor = centers[index] + half + bandGap;
  });

  /* 6 · Colocar a cada jugador dentro de su bloque. */

  const placed: PlacedPlayer[] = [];
  const placedClusters: PlacedCluster[] = [];

  bands.forEach((band, bandIndex) => {
    const bandStart = centers[bandIndex] - bandDeeps[bandIndex] / 2;

    const bandChips: PlacedCluster[] = [];

    band.clusters.forEach((cluster) => {
      const stackHeight = cluster.rows * cluster.stepY;

      /*
      | De pie, la banda es una franja: el bloque se centra a lo alto de ella y
      | su sitio a lo ancho es el que le dio el paso 4. Tumbado la banda es una
      | columna y los papeles se invierten: el bloque se centra a lo ancho de la
      | columna y es el eje vertical el que le trae repartido su sitio.
      */
      const blockX = horizontal
        ? bandStart + bandDeeps[bandIndex] / 2
        : cluster.along;

      const blockTop = horizontal
        ? cluster.along - cluster.height / 2 + chipHeight
        : bandStart +
          chipHeight +
          (bandDeeps[bandIndex] - chipHeight - stackHeight) / 2;

      const chip: PlacedCluster = {
        key: cluster.key,
        code: cluster.code,
        color: cluster.color,
        count: cluster.players.length,
        x: blockX,
        y: blockTop - 3,
      };

      bandChips.push(chip);
      placedClusters.push(chip);

      cluster.players.forEach((player, index) => {
        const row = Math.floor(index / cluster.cols);
        const column = index % cluster.cols;

        const inRow = Math.min(
          cluster.cols,
          cluster.players.length - row * cluster.cols,
        );

        placed.push({
          player,
          color: cluster.color,
          tagRow: cluster.tagged,
          x: blockX + (column - (inRow - 1) / 2) * stepX,
          y: blockTop + row * cluster.stepY + cluster.cardHeight / 2,
        });
      });
    });

    /*
    | Las chapas se deslizan lo justo para no pisarse. Van centradas sobre su
    | bloque, pero una chapa es más ancha que un bloque de una sola columna, así
    | que en bandas apretadas dos vecinas se tocaban. Que una chapa quede un
    | poco descentrada sobre los suyos no se nota; que se solape con la de al
    | lado, sí.
    |
    | Tumbado no hace falta: los bloques de una banda van uno debajo de otro y
    | el hueco de cada chapa ya está reservado en el reparto del paso 4.
    */
    if (!horizontal && bandChips.length > 1) {
      const centersX = packRow(
        band.clusters.map(chipWidth),
        bandChips.map((chip) => chip.x),
        padX,
        width - padX,
        3,
      );

      bandChips.forEach((chip, index) => {
        chip.x = centersX[index];
      });
    }
  });

  return { placed, clusters: placedClusters, avatar, stepX };
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
          ? /* Tumbado el campo se queda con lo que cabe en la ventana de un
               portátil, tarjeta y márgenes incluidos, así que no hay que hacer
               scroll para verlo entero. El suelo de 500 px no es decorativo: lo
               que aprieta tumbado es el alto —es donde se reparten los bloques
               de cada banda— y por debajo la foto se queda en nada (a 460 px,
               una plantilla con cinco bloques atrás baja a 18 px). */
            "h-[clamp(500px,calc(100vh-200px),640px)]"
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
          src="/emotional-field-bg.png"
          alt=""
          className={
            horizontal
              ? "absolute inset-0 h-full w-full object-cover"
              : "absolute left-1/2 top-1/2 h-[75%] w-[240%] max-w-none -translate-x-1/2 -translate-y-1/2 rotate-90 object-fill sm:h-[133%] sm:w-[240%] lg:h-[135%] lg:w-[100%]"
          }
        />
      </div>

      <div className="pitch-photo-veil pointer-events-none absolute inset-0 bg-gradient-to-b from-black/45 via-black/10 to-black/45" />

      {/* Modo día: aclara el césped hasta los tonos del tema claro (globals.css) */}

      <div className="pitch-photo-wash" />

      {/* CHAPA DE POSICIÓN — una por bloque, encima de su gente */}

      {clusters.map((cluster) => (
        <span
          key={cluster.key}
          className="pointer-events-none absolute z-10 flex -translate-x-1/2 -translate-y-full items-center gap-1 rounded-full border px-1.5 py-[1px] text-[9px] font-bold uppercase tracking-wider backdrop-blur-sm"
          style={{
            left: cluster.x,
            top: cluster.y,
            color: cluster.color,
            borderColor: `${cluster.color}66`,
            background: "rgba(8,12,16,0.72)",
          }}
        >
          {cluster.code}

          <span className="font-semibold text-white/45">{cluster.count}</span>
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
