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
import { useBodyScrollLock } from "@/components/season/useBodyScrollLock";
import RivalBoardPanel from "@/components/tactics/RivalBoardPanel";
import RivalVoicePanel from "@/components/voice/RivalVoicePanel";
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

  const [showPitch, setShowPitch] = useState(true);

  /* Plantilla (listado + campograma) o pizarra táctica del rival. */
  const [view, setView] = useState<"plantilla" | "pizarra">("plantilla");

  const touchStartX = useRef<number | null>(null);

  /* Snapshot del jugador al abrir el modal, para detectar cambios sin guardar. */
  const [pristineForm, setPristineForm] = useState("");

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

  const openPlayer = useCallback((player: RivalPlayer) => {
    const copy = { ...player };

    setIsCreating(false);
    setSelectedPlayer(player);
    setPristineForm(JSON.stringify(copy));
    setEditForm(copy);
  }, []);

  const openCreatePlayer = () => {
    const empty = createEmptyPlayer();

    setIsCreating(true);
    setSelectedPlayer(null);
    setPristineForm(JSON.stringify(empty));
    setEditForm(empty);
  };

  const isDirty =
    editForm !== null && JSON.stringify(editForm) !== pristineForm;

  const closePlayer = useCallback(
    (force = false) => {
      if (!force && isDirty) {
        const confirmed = window.confirm(
          "Hay cambios sin guardar. ¿Seguro que quieres cerrar?",
        );

        if (!confirmed) return;
      }

      setSelectedPlayer(null);
      setEditForm(null);
      setIsCreating(false);
      setPristineForm("");
    },
    [isDirty],
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
  | El dictado solo escribe en el formulario: el guardado sigue siendo manual,
  | así que siempre queda margen para corregir antes de tocar la hoja.
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

              {/* PLANTILLA + CAMPOGRAMA */}

              {loading ? (
                <RivalsSkeleton />
              ) : (
                <div className="mt-6 grid min-w-0 items-stretch gap-5 lg:grid-cols-[minmax(0,1fr)_minmax(420px,1fr)]">
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

                                <div className="grid min-w-0 gap-px bg-white/10 sm:grid-cols-2">
                                  {group.players.map((player) => (
                                    <PlayerRow
                                      key={player.ID_JUGADOR}
                                      player={player}
                                      showTeam={teamsInResults.length > 1}
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

                        <div className="grid min-w-0 gap-px bg-white/10 sm:grid-cols-2">
                          {unclassified.map((player) => (
                            <PlayerRow
                              key={player.ID_JUGADOR}
                              player={player}
                              showTeam={teamsInResults.length > 1}
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

                        <span className="shrink-0 text-xs text-white/30">
                          {activeTags.length > 0 && (
                            <span className="mr-2 text-[#C8A96B]">
                              {listPlayers.length} destacados
                            </span>
                          )}

                          {pitchPlayers.length} jugadores
                        </span>
                      </div>

                      <TacticalPitch
                        players={pitchPlayers}
                        selectedId={selectedPlayer?.ID_JUGADOR}
                        activeTags={activeTags}
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
          className="fixed inset-0 z-50 flex items-center justify-center overflow-y-auto bg-black/80 p-2 backdrop-blur-sm sm:p-4 md:p-8"
          role="dialog"
          aria-modal="true"
          onClick={() => closePlayer()}
        >
          <div
            className="relative flex max-h-[96vh] w-full min-w-0 max-w-6xl flex-col overflow-hidden rounded-2xl border border-white/10 bg-[#11161D] shadow-2xl"
            onClick={(event) => event.stopPropagation()}
            onTouchStart={handleTouchStart}
            onTouchEnd={handleTouchEnd}
          >
            {/* HEADER MODAL */}

            <div className="flex min-w-0 items-center justify-between gap-3 border-b border-white/10 p-3 sm:p-4 md:p-6">
              <div className="flex min-w-0 items-center gap-2 sm:gap-3">
                {!isCreating && (
                  <button
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
                    onClick={() => navigatePlayer(1)}
                    disabled={selectedIndex >= listPlayers.length - 1}
                    aria-label="Jugador siguiente"
                    className="shrink-0 rounded-full border border-white/10 p-2 transition hover:border-[#C8A96B] disabled:opacity-20"
                  >
                    <ChevronRight size={20} />
                  </button>
                )}
              </div>

              <div className="flex shrink-0 items-center gap-3">
                {isDirty && (
                  <span className="hidden rounded-full border border-[#C8A96B]/30 bg-[#C8A96B]/10 px-3 py-1 text-xs text-[#C8A96B] sm:inline">
                    Cambios sin guardar
                  </span>
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
              <div className="grid min-w-0 gap-6 p-3 sm:p-4 md:grid-cols-[280px_minmax(0,1fr)] md:p-6 lg:grid-cols-[320px_minmax(0,1fr)]">
                {/* COLUMNA IZQUIERDA */}

                <div className="min-w-0">
                  <div className="overflow-hidden rounded-2xl border border-white/10 bg-[#0B0F14]">
                    {editForm.FOTO ? (
                      /* eslint-disable-next-line @next/next/no-img-element */
                      <img
                        src={editForm.FOTO}
                        alt={
                          editForm["NOMBRE DEPORTIVO"] || editForm.JUGADOR || ""
                        }
                        className="aspect-[3/4] w-full object-cover"
                      />
                    ) : (
                      <div className="flex aspect-[3/4] items-center justify-center">
                        <UserRound size={80} className="text-white/20" />
                      </div>
                    )}
                  </div>

                  {/* IDENTIDAD */}

                  <div className="mt-4 space-y-4">
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
                  </div>

                  <div className="mt-4 grid grid-cols-2 gap-2">
                    <EditableField
                      label="Dorsal"
                      value={editForm.DORSAL}
                      inputMode="numeric"
                      onChange={(value) => updateForm("DORSAL", value)}
                    />

                    <EditableField
                      label="Edad"
                      value={editForm.EDAD}
                      inputMode="numeric"
                      onChange={(value) => updateForm("EDAD", value)}
                    />

                    <EditableField
                      label="Peso"
                      value={editForm.PESO}
                      onChange={(value) => updateForm("PESO", value)}
                    />

                    <EditableField
                      label="Altura"
                      value={editForm.ALTURA}
                      onChange={(value) => updateForm("ALTURA", value)}
                    />

                    <EditableField
                      label="Pie"
                      value={editForm["PIE DOMINANTE"]}
                      onChange={(value) =>
                        updateForm("PIE DOMINANTE", value)
                      }
                    />

                    <EditableField
                      label="Posición"
                      value={editForm["POSICIÓN"]}
                      onChange={(value) => updateForm("POSICIÓN", value)}
                    />
                  </div>

                  <div className="mt-4 space-y-2 text-sm">
                    <EditableField
                      label="Equipo"
                      value={editForm.NOMBRE_EQUIPO}
                      onChange={(value) =>
                        updateForm("NOMBRE_EQUIPO", value)
                      }
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

                    <EditableField
                      label="2ª posición"
                      value={editForm["2º POSICIÓN"]}
                      onChange={(value) => updateForm("2º POSICIÓN", value)}
                    />

                    <EditableDateField
                      label="Fecha incorporación"
                      value={editForm["FECHA INCORPORACIÓN"]}
                      onChange={(value) =>
                        updateForm("FECHA INCORPORACIÓN", value)
                      }
                    />
                  </div>
                </div>

                {/* COLUMNA DERECHA */}

                <div className="min-w-0 space-y-5">
                  <RivalVoicePanel
                    current={editForm as unknown as Record<string, unknown>}
                    equipo={editForm.NOMBRE_EQUIPO || selectedTeam}
                    tagCatalog={voiceTagCatalog}
                    activeTagKeys={voiceTagKeys}
                    onApply={applyVoice}
                  />

                  <div className="grid gap-4 md:grid-cols-2">
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
                  </div>

                  <TagPicker
                    value={editForm.IMPACTO}
                    onChange={(value) => updateForm("IMPACTO", value)}
                  />

                  <EditableTextarea
                    label="Características"
                    value={editForm.CARACTERÍSTICAS}
                    onChange={(value) => updateForm("CARACTERÍSTICAS", value)}
                  />

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

                  <EditableTextarea
                    label="Observaciones"
                    value={editForm.OBSERVACIONES}
                    onChange={(value) => updateForm("OBSERVACIONES", value)}
                  />

                  <div className="grid gap-4 md:grid-cols-2">
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
                  </div>

                  <EditableField
                    label="Documento URL"
                    value={editForm.DOC}
                    onChange={(value) => updateForm("DOC", value)}
                  />

                  {/* LINKS */}

                  <div className="flex flex-wrap gap-3">
                    {editForm.VIDEO && (
                      <a
                        href={editForm.VIDEO}
                        target="_blank"
                        rel="noreferrer"
                        className="flex items-center gap-2 rounded-xl border border-white/10 bg-white/[0.04] px-4 py-3 text-sm transition hover:border-[#C8A96B]"
                      >
                        <Video size={16} className="text-[#C8A96B]" />
                        Ver vídeo
                        <ExternalLink size={14} />
                      </a>
                    )}

                    {editForm.DOC && (
                      <a
                        href={editForm.DOC}
                        target="_blank"
                        rel="noreferrer"
                        className="flex items-center gap-2 rounded-xl border border-white/10 bg-white/[0.04] px-4 py-3 text-sm transition hover:border-[#C8A96B]"
                      >
                        <FileText size={16} className="text-[#C8A96B]" />
                        Ver documento
                        <ExternalLink size={14} />
                      </a>
                    )}
                  </div>
                </div>
              </div>
            </div>

            {/* FOOTER MODAL */}

            <div className="flex items-center justify-between gap-3 border-t border-white/10 p-3 sm:p-4 md:p-6">
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

                  {saving
                    ? "Guardando..."
                    : isCreating
                      ? "Añadir jugador"
                      : "Guardar"}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
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
  onClick,
}: {
  player: RivalPlayer;
  showTeam: boolean;
  onClick: () => void;
}) {
  const { tags } = parseTags(player.IMPACTO);
  const slotEntry = getSlot(player["POSICIÓN"]);

  /* La 2ª posición sólo aporta si es distinta de la principal. */
  const second = getSlot(player["2º POSICIÓN"]);
  const secondSlot = second?.slot.key === slotEntry?.slot.key ? null : second;

  return (
    <button
      onClick={onClick}
      className="group flex min-w-0 items-center gap-3 bg-[#11161D] p-3 text-left transition hover:bg-white/[0.07]"
    >
      {/* FOTO */}

      <div className="h-12 w-12 shrink-0 overflow-hidden rounded-full border border-white/10 bg-[#0B0F14]">
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

      <div className="w-8 shrink-0 text-center">
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

      {/* ROL */}

      {player.ROL && (
        <div className="hidden min-w-0 shrink-0 text-right xl:block">
          <p className="text-[9px] uppercase tracking-wider text-white/30">
            Rol
          </p>

          <p className="mt-0.5 max-w-[80px] truncate text-xs text-[#C8A96B]">
            {player.ROL}
          </p>
        </div>
      )}
    </button>
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
    <div className="mt-6 grid min-w-0 gap-5 lg:grid-cols-[minmax(0,1fr)_minmax(420px,1fr)]">
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

/* El tono lo pone el bloque al que pertenece, no cada entrada. */
type TagDef = Omit<PlayerTag, "tone">;

const FORTALEZAS: TagDef[] = [
  {
    key: "cerebro",
    label: "El cerebro",
    short: "Cerebro",
    icon: Brain,
    color: "#A78BFA",
    aliases: ["cerebro", "organizador", "director de juego", "faro"],
  },
  {
    key: "crack",
    label: "El crack",
    short: "Crack",
    icon: Star,
    color: "#C8A96B",
    aliases: ["crack", "estrella", "diferencial", "franquicia"],
  },
  {
    key: "desequilibrante",
    label: "El desequilibrante",
    short: "Desequilibra",
    icon: Zap,
    color: "#E879F9",
    aliases: ["desequilibrante", "desequilibra", "desborde"],
  },
  {
    key: "regateador",
    label: "El regateador",
    short: "Regate",
    icon: Shuffle,
    color: "#F472B6",
    aliases: ["regateador", "regate", "driblador", "encarador"],
  },
  {
    key: "rapido",
    label: "El rápido",
    short: "Rápido",
    icon: Wind,
    color: "#22D3EE",
    aliases: ["rapido", "veloz", "velocidad", "explosivo"],
  },
  {
    key: "fuerte",
    label: "El fuerte",
    short: "Fuerte",
    icon: Dumbbell,
    color: "#FB923C",
    aliases: ["fuerte", "potente", "fisico", "poderoso"],
  },
  {
    key: "duro",
    label: "El duro",
    short: "Duro",
    icon: Swords,
    color: "#F87171",
    aliases: ["duro", "agresivo", "intenso", "guerrero"],
  },
  {
    key: "alto",
    label: "El alto",
    short: "Alto",
    icon: Ruler,
    color: "#7DD3FC",
    aliases: ["alto", "aereo", "juego aereo", "dominante por alto"],
  },
  {
    key: "goleador",
    label: "El goleador",
    short: "Gol",
    icon: Target,
    color: "#EF4444",
    aliases: ["goleador", "gol", "killer", "definidor"],
  },
  {
    key: "asistente",
    label: "El asistente",
    short: "Asiste",
    icon: Handshake,
    color: "#34D399",
    aliases: ["asistente", "asistencias", "ultimo pase", "pasador"],
  },
  {
    key: "tecnico",
    label: "El técnico",
    short: "Técnico",
    icon: Sparkles,
    color: "#2DD4BF",
    aliases: ["tecnico", "calidad", "talento", "buen pie"],
  },
  {
    key: "motor",
    label: "El motor",
    short: "Motor",
    icon: BatteryCharging,
    color: "#A3E635",
    aliases: ["motor", "incansable", "box to box", "recorrido", "pulmon"],
  },
  {
    key: "presionador",
    label: "El presionador",
    short: "Presiona",
    icon: Flame,
    color: "#FB7185",
    aliases: ["presionador", "presion", "primer presionador", "robador"],
  },
  {
    key: "lider",
    label: "El líder",
    short: "Líder",
    icon: Crown,
    color: "#FBBF24",
    aliases: ["lider", "capitan", "referente"],
  },
  {
    key: "zurdo",
    label: "Zurdo diferencial",
    short: "Zurdo",
    icon: Footprints,
    color: "#818CF8",
    aliases: ["zurdo diferencial", "zurdo", "pierna izquierda"],
  },
  {
    key: "abp-sacador",
    label: "Sacador de ABP",
    short: "Saca ABP",
    icon: Flag,
    color: "#60A5FA",
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
    color: "#F59E0B",
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
    color: "#F43F5E",
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
    color: "#F87171",
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
    color: "#94A3B8",
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
    color: "#FCA5A5",
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
    color: "#EF4444",
    aliases: ["lesionado", "lesion", "baja", "de baja", "no disponible"],
  },
  {
    key: "tocado",
    label: "Tocado",
    short: "Tocado",
    icon: HeartPulse,
    color: "#FB7185",
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
    color: "#FACC15",
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
    color: "#60A5FA",
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
    color: "#A78BFA",
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
    color: "#FB923C",
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
    color: "#A3A3A3",
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
    color: "#FBBF24",
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
    color: "#C084FC",
    aliases: [
      "se descentra",
      "nervioso",
      "se calienta",
      "pierde la cabeza",
      "reactivo",
    ],
  },
];

const TAG_GROUPS: { tone: TagTone; label: string; tags: PlayerTag[] }[] = [
  {
    tone: "fortaleza",
    label: "Fortalezas",
    tags: FORTALEZAS.map((tag) => ({ ...tag, tone: "fortaleza" as const })),
  },
  {
    tone: "debilidad",
    label: "Por dónde se le gana",
    tags: DEBILIDADES.map((tag) => ({ ...tag, tone: "debilidad" as const })),
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
}: {
  tag: PlayerTag;
  active?: boolean;
  size?: "sm" | "md";
  count?: number;
  onClick?: () => void;
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

  if (!onClick) {
    return (
      <span className={className} style={style} title={tag.label}>
        {content}
      </span>
    );
  }

  return (
    <button type="button" onClick={onClick} className={className} style={style}>
      {content}
    </button>
  );
}

/* Selector de etiquetas del modal: escribe sobre el campo IMPACTO. */
function TagPicker({
  value,
  onChange,
}: {
  value: unknown;
  onChange: (value: string) => void;
}) {
  const parsed = useMemo(() => parseTags(value), [value]);

  const activeKeys = useMemo(
    () => new Set(parsed.tags.map((tag) => tag.key)),
    [parsed.tags],
  );

  return (
    <div className="min-w-0 rounded-2xl border border-white/10 bg-[#0B0F14] p-4">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <span className="flex items-center gap-2 text-xs uppercase tracking-wider text-white/40">
          <Tags size={14} className="text-[#C8A96B]" />
          Etiquetas
        </span>

        <span className="text-[11px] text-white/30">
          {parsed.tags.length} seleccionadas · se guardan en IMPACTO
        </span>
      </div>

      <div className="space-y-3">
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
      </div>

      {parsed.extra.length > 0 && (
        <p className="mt-3 text-[11px] text-white/40">
          Texto libre conservado:{" "}
          <span className="text-white/60">{parsed.extra.join(", ")}</span>
        </p>
      )}

      <label className="mt-4 block">
        <span className="mb-2 block text-[11px] uppercase tracking-wider text-white/30">
          Valor guardado
        </span>

        <input
          value={String(value ?? "")}
          onChange={(event) => onChange(event.target.value)}
          placeholder="El cerebro; Sacador de ABP"
          className="w-full min-w-0 rounded-xl border border-white/10 bg-[#11161D] px-4 py-2.5 text-xs outline-none transition focus:border-[#C8A96B]"
        />
      </label>
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
  cols: number;
  rows: number;
  x: number;
  width: number;
};

function layoutPitch(
  players: RivalPlayer[],
  width: number,
  height: number,
  compact = false,
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
      cols: 0,
      rows: 0,
      x: 0,
      width: 0,
    });
  });

  const clusters = [...byKey.values()];

  clusters.forEach((cluster) => {
    cluster.players.sort(
      (a, b) => (Number(a.DORSAL) || 999) - (Number(b.DORSAL) || 999),
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
  | En móvil el campo mide poco más de 300 px de ancho: con los márgenes y los
  | pasos de escritorio el reparto pedía más sitio del que hay, el avatar se
  | quedaba clavado en su mínimo y las fichas acababan pisándose. Ahí apretamos
  | márgenes, huecos y la altura de la etiqueta; en PC no cambia nada.
  */
  const padX = compact ? 10 : 26;
  const padY = compact ? 10 : 16;
  const labelHeight = compact ? 28 : 34;
  const chipHeight = compact ? 13 : 15;
  const rowGap = compact ? 6 : 8;
  const bandGap = compact ? 7 : 10;
  const stepFactor = compact ? 1.18 : 1.45;
  const gapFactor = compact ? 0.46 : 0.62;
  const minAvatar = compact ? 18 : 22;

  const freeWidth = width - 2 * padX;

  /*
  | Cada fila ocupa avatar + nombre + hueco; cada banda suma además su chapa,
  | y entre bandas va otro hueco. De ahí se despeja el avatar más grande que
  | deja que todo entre a lo alto. A lo ancho: paso entre fichas `stepFactor` ·
  | avatar y hueco entre bloques `gapFactor` · avatar.
  */
  const fitAvatar = () => {
    const totalRows = bands.reduce((sum, band) => sum + band.rows, 0);

    const freeHeight =
      height -
      2 * padY -
      bands.length * chipHeight -
      (bands.length - 1) * bandGap;

    const byHeight = freeHeight / totalRows - labelHeight - rowGap;

    const byWidth = bands.reduce((min, band) => {
      const cols = band.clusters.reduce((sum, item) => sum + item.cols, 0);
      const need = stepFactor * cols + gapFactor * (band.clusters.length - 1);

      return Math.min(min, freeWidth / need);
    }, Infinity);

    return Math.min(62, byHeight, byWidth);
  };

  /*
  | En móvil el ancho es lo que aprieta: en una banda con muchos bloques (por
  | ejemplo laterales + tres bloques de centrales) el avatar se quedaba clavado
  | en su mínimo y las fichas se pisaban. Probamos también bloques de dos y de
  | una columna — apilar en vertical estrecha la banda — y nos quedamos con el
  | reparto que deja la foto más grande. En PC sólo se prueba el de siempre.
  */
  const columnOptions = compact ? [3, 2, 1] : [3];

  let bestCols = columnOptions[0];
  let bestFit = -Infinity;

  columnOptions.forEach((maxCols) => {
    shapeClusters(maxCols);

    const fit = fitAvatar();

    if (fit > bestFit) {
      bestFit = fit;
      bestCols = maxCols;
    }
  });

  shapeClusters(bestCols);

  const avatar = Math.max(minAvatar, bestFit);

  const stepX = avatar * stepFactor;
  const clusterGap = avatar * gapFactor;
  const cardHeight = avatar + labelHeight;
  const stepY = cardHeight + rowGap;

  /* 4 · Reparto horizontal: cada bloque en su ancla, sin pisarse. */

  bands.forEach((band) => {
    band.clusters.sort((a, b) => a.anchorX - b.anchorX);

    band.clusters.forEach((cluster) => {
      cluster.width = cluster.cols * stepX;

      const half = cluster.width / 2;

      cluster.x = Math.min(
        Math.max(cluster.anchorX * width, padX + half),
        Math.max(padX + half, width - padX - half),
      );
    });

    for (let i = 1; i < band.clusters.length; i += 1) {
      const prev = band.clusters[i - 1];
      const current = band.clusters[i];

      current.x = Math.max(
        current.x,
        prev.x + prev.width / 2 + current.width / 2 + clusterGap,
      );
    }

    for (let i = band.clusters.length - 2; i >= 0; i -= 1) {
      const next = band.clusters[i + 1];
      const current = band.clusters[i];

      current.x = Math.min(
        current.x,
        next.x - next.width / 2 - current.width / 2 - clusterGap,
      );
    }

    band.clusters.forEach((cluster) => {
      cluster.x = Math.max(cluster.x, padX + cluster.width / 2);
    });

    /*
    | El empujón hacia la derecha no tiene tope, así que en una banda que no
    | cabe entera el último bloque se salía del campo (y el recorte se lo
    | comía). En móvil, donde eso pasa, preferimos apretarla y que se vea todo.
    */
    if (compact) {
      band.clusters.forEach((cluster) => {
        cluster.x = Math.min(
          cluster.x,
          Math.max(padX + cluster.width / 2, width - padX - cluster.width / 2),
        );
      });
    }
  });

  /* 5 · Reparto vertical: cada banda a su altura, sin pisar a la anterior. */

  const bandHeights = bands.map((band) => band.rows * stepY + chipHeight);

  const centers = bands.map((band) => band.anchorY * height);

  /* Bajando: nadie pisa a la banda de arriba. */
  let cursor = padY;

  bands.forEach((band, index) => {
    const half = bandHeights[index] / 2;

    centers[index] = Math.max(centers[index], cursor + half);
    cursor = centers[index] + half + bandGap;
  });

  /* Subiendo: lo que se haya salido por abajo vuelve a entrar. */
  let limit = height - padY;

  for (let index = bands.length - 1; index >= 0; index -= 1) {
    const half = bandHeights[index] / 2;

    centers[index] = Math.min(centers[index], limit - half);
    limit = centers[index] - half - bandGap;
  }

  /*
  | Red de seguridad: si ni con la ficha al mínimo cabe todo, preferimos
  | amontonar un poco a que alguien acabe fuera del campo.
  */
  cursor = padY;

  bands.forEach((band, index) => {
    const half = bandHeights[index] / 2;

    centers[index] = Math.min(
      Math.max(centers[index], cursor + half),
      Math.max(padY + half, height - padY - half),
    );

    cursor = centers[index] + half + bandGap;
  });

  /* 6 · Colocar a cada jugador dentro de su bloque. */

  const placed: PlacedPlayer[] = [];
  const placedClusters: PlacedCluster[] = [];

  bands.forEach((band, bandIndex) => {
    const bandTop = centers[bandIndex] - bandHeights[bandIndex] / 2;

    band.clusters.forEach((cluster) => {
      /* El bloque se centra a lo alto de la banda, con su chapa encima. */
      const blockHeight = cluster.rows * stepY;

      const blockTop =
        bandTop +
        chipHeight +
        (bandHeights[bandIndex] - chipHeight - blockHeight) / 2;

      placedClusters.push({
        key: cluster.key,
        code: cluster.code,
        color: cluster.color,
        count: cluster.players.length,
        x: cluster.x,
        y: blockTop - 3,
      });

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
          x: cluster.x + (column - (inRow - 1) / 2) * stepX,
          y: blockTop + row * stepY + cardHeight / 2,
        });
      });
    });
  });

  return { placed, clusters: placedClusters, avatar, stepX };
}

/*
|--------------------------------------------------------------------------
| CAMPOGRAMA · RENDER
|--------------------------------------------------------------------------
*/

function TacticalPitch({
  players,
  selectedId,
  activeTags,
  onPlayerClick,
}: {
  players: RivalPlayer[];
  selectedId?: string;
  activeTags: string[];
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

  const { placed, clusters, avatar, stepX } = useMemo(
    () => layoutPitch(players, size.width, size.height, compact),
    [players, size.width, size.height, compact],
  );

  const badgeSize = compact
    ? Math.max(9, Math.min(14, Math.round(avatar * 0.32)))
    : Math.max(11, Math.min(19, Math.round(avatar * 0.32)));

  const nameFont = compact
    ? Math.max(8, Math.min(11, Math.round(avatar * 0.21)))
    : Math.max(9, Math.min(12, Math.round(avatar * 0.21)));

  /* El nombre nunca puede ser más ancho que el paso entre fichas: si lo es,
     las etiquetas de dos vecinos se solapan aunque las fotos no lo hagan. */
  const nameWidth = Math.max(compact ? 26 : 46, stepX - 4);

  const maxBadges = avatar < 34 ? 2 : avatar < 48 ? 3 : 4;

  return (
    <div
      ref={containerRef}
      className="pitch-photo relative h-[min(900px,calc(100vh-120px))] min-h-[680px] w-full overflow-hidden bg-[#173b2a] md:min-h-[560px]"
    >
      {/* FONDO DEL CAMPO */}

      <div className="pointer-events-none absolute inset-0 overflow-hidden">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src="/emotional-field-bg.png"
          alt=""
          className="absolute left-1/2 top-1/2 h-[75%] w-[240%] max-w-none -translate-x-1/2 -translate-y-1/2 rotate-90 object-fill sm:h-[133%] sm:w-[240%] lg:h-[135%] lg:w-[100%]"
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

      {placed.map(({ player, x, y, color }) => {
        const selected = selectedId === player.ID_JUGADOR;

        const { tags } = parseTags(player.IMPACTO);

        const matchesFilter =
          activeTags.length === 0 ||
          activeTags.every((key) => tags.some((tag) => tag.key === key));

        const visibleTags = tagsByPriority(tags).slice(0, maxBadges);
        const hiddenCount = tags.length - visibleTags.length;

        const name = player["NOMBRE DEPORTIVO"] || player.JUGADOR;

        return (
          <button
            key={player.ID_JUGADOR}
            onClick={() => onPlayerClick(player)}
            title={`${name} · ${player["POSICIÓN"]}${
              tags.length ? ` · ${tags.map((tag) => tag.label).join(", ")}` : ""
            }`}
            className={`group absolute z-10 flex -translate-x-1/2 -translate-y-1/2 flex-col items-center transition duration-200 hover:z-30 ${
              matchesFilter
                ? "opacity-100 hover:scale-110"
                : "opacity-20 grayscale hover:opacity-70"
            }`}
            style={{ left: x, top: y }}
          >
            {/* FOTO — el borde lleva el color de la línea */}

            <div
              className={`relative shrink-0 overflow-hidden rounded-full border-2 bg-[#11161D] shadow-[0_4px_14px_rgba(0,0,0,0.55)] ${
                selected ? "ring-2 ring-[#C8A96B]/60" : ""
              }`}
              style={{
                height: avatar,
                width: avatar,
                borderColor: selected ? "#C8A96B" : color,
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

            {tags.length > 0 && (
              <span className="mt-1 flex items-center justify-center gap-0.5">
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
              className={`pointer-events-none absolute left-1/2 z-40 w-48 -translate-x-1/2 rounded-xl border border-white/15 bg-[#0B0F14]/95 p-2.5 text-left opacity-0 shadow-2xl backdrop-blur transition group-hover:opacity-100 ${
                /* En móvil no hay ratón: el detalle sólo aparecía recortado
                   por el borde del campo al tocar la ficha. */
                compact ? "hidden" : ""
              } ${
                y > size.height / 2 ? "bottom-full mb-2" : "top-full mt-2"
              }`}
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
          </button>
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
