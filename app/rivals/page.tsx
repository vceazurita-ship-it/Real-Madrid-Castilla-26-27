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
  BatteryCharging,
  Brain,
  ChevronLeft,
  ChevronRight,
  Crown,
  Dumbbell,
  ExternalLink,
  FileText,
  Flag,
  Flame,
  Footprints,
  Handshake,
  LayoutGrid,
  Plus,
  RotateCcw,
  Ruler,
  Save,
  Search,
  Shirt,
  SquarePen,
  Shuffle,
  Sparkles,
  Star,
  Swords,
  Tags,
  Target,
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

const LINE_DEFINITIONS: {
  key: LineKey;
  title: string;
  /* Prefijos por orden de preferencia dentro de la línea. */
  positions: string[];
  color: string;
  badge: string;
}[] = [
  {
    key: "portero",
    title: "PORTEROS",
    positions: ["portero", "arquero", "guardameta"],
    color: "#EAB308",
    badge: "bg-yellow-500/15 text-yellow-300 border-yellow-500/30",
  },
  {
    key: "defensa",
    title: "DEFENSAS",
    positions: [
      "lateral derecho",
      "lateral d",
      "central",
      "zaguero",
      "lateral izquierdo",
      "lateral izq",
      "lateral i",
      "carrilero",
      "lateral",
      "defensa",
    ],
    color: "#7DA6D9",
    badge: "bg-blue-500/15 text-blue-300 border-blue-500/30",
  },
  {
    key: "medio",
    title: "CENTROCAMPISTAS",
    positions: [
      "mediocentro",
      "medio centro",
      "pivote",
      "interior",
      "media punta",
      "mediapunta",
      "enganche",
      "medio",
    ],
    color: "#52B788",
    badge: "bg-emerald-500/15 text-emerald-300 border-emerald-500/30",
  },
  {
    key: "ataque",
    title: "ATACANTES",
    positions: [
      "extremo derecho",
      "extremo d",
      "extremo izquierdo",
      "extremo izq",
      "extremo i",
      "extremo",
      "delantero",
      "punta",
      "ariete",
    ],
    color: "#D46A6A",
    badge: "bg-red-500/15 text-red-300 border-red-500/30",
  },
];

function getLine(position: string) {
  const value = normalize(position);
  if (!value) return null;

  return (
    LINE_DEFINITIONS.find((line) =>
      line.positions.some((item) => value.includes(normalize(item))),
    ) ?? null
  );
}

function getPositionStyle(position: string) {
  return getLine(position)?.badge ?? "bg-white/10 text-white/70 border-white/10";
}

/* Orden de un jugador dentro de su línea (portero → lateral → central → ...). */
function positionRank(position: string) {
  const line = getLine(position);
  if (!line) return 999;

  const value = normalize(position);

  const index = line.positions.findIndex((item) =>
    value.includes(normalize(item)),
  );

  return index === -1 ? 998 : index;
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
        normalize(player["2º POSICIÓN"]).includes(positionSearchValue);

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

      return { ...line, players: linePlayers };
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
    <main className="min-h-screen overflow-x-hidden bg-[#0B0F14] text-white">
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

                <div className="flex min-w-0 flex-wrap gap-2">
                  {PLAYER_TAGS.map((tag) => {
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

                          <div className="grid min-w-0 gap-px bg-white/5 sm:grid-cols-2">
                            {line.players.map((player) => (
                              <PlayerRow
                                key={player.ID_JUGADOR}
                                player={player}
                                showTeam={teamsInResults.length > 1}
                                onClick={() => openPlayer(player)}
                              />
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

                        <div className="grid min-w-0 gap-px bg-white/5 sm:grid-cols-2">
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

        <div className="mt-1 flex min-w-0 items-center gap-2">
          <span
            className={`shrink-0 truncate rounded-md border px-1.5 py-0.5 text-[10px] ${getPositionStyle(
              player["POSICIÓN"],
            )}`}
          >
            {player["POSICIÓN"] || "—"}
          </span>

          {showTeam && (
            <span className="min-w-0 truncate text-[10px] text-white/30">
              {player.NOMBRE_EQUIPO}
            </span>
          )}
        </div>

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

type PlayerTag = {
  key: string;
  label: string;
  /* Texto corto que se pinta en fichas y tooltips del campograma. */
  short: string;
  icon: LucideIcon;
  color: string;
  aliases: string[];
};

const PLAYER_TAGS: PlayerTag[] = [
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

      <div className="flex flex-wrap gap-2">
        {PLAYER_TAGS.map((tag) => (
          <TagChip
            key={tag.key}
            tag={tag}
            active={activeKeys.has(tag.key)}
            onClick={() => onChange(toggleTagValue(value, tag))}
          />
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
| El reparto se calcula en píxeles sobre el tamaño real del contenedor, no
| con porcentajes fijos: así entra la plantilla completa sin solaparse.
|
|   1. Cada posición cae en una línea y recibe una preferencia horizontal en
|      [-1, 1] según el lado (izq/centro/dcho) y lo abierto que juegue
|      (lateral y extremo abren más que interior, e interior más que central).
|   2. Una línea con demasiada gente se abre en varias sub-filas alternando
|      jugadores, de modo que cada sub-fila conserva el abanico completo.
|   3. El tamaño de ficha se despeja para que TODAS las sub-filas quepan a lo
|      alto y a lo ancho, y después se relajan las alturas para garantizar la
|      separación mínima entre ellas.
*/

type PitchRowKey = "del" | "band" | "med" | "piv" | "def" | "por";

/* Altura preferida de cada línea, en fracción del alto del campo. */
const PITCH_ROWS: { key: PitchRowKey; top: number }[] = [
  { key: "del", top: 0.1 },
  { key: "band", top: 0.26 },
  { key: "med", top: 0.44 },
  { key: "piv", top: 0.585 },
  { key: "def", top: 0.745 },
  { key: "por", top: 0.915 },
];

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

function detectRow(position: string): PitchRowKey {
  const p = position;

  if (
    p.includes("portero") ||
    p.includes("arquero") ||
    p.includes("guardameta") ||
    p.includes("cancerbero")
  ) {
    return "por";
  }

  /* Antes que "punta": si no, "media punta" caería en delanteros. */
  if (
    p.includes("media punta") ||
    p.includes("mediapunta") ||
    p.includes("media-punta") ||
    p.includes("enganche") ||
    p.includes("medio ofensivo") ||
    p.includes("mediocentro ofensivo") ||
    p.includes("medio centro of")
  ) {
    return "band";
  }

  if (
    p.includes("extremo") ||
    p.includes("ext ") ||
    p.includes("banda") ||
    p.includes("winger")
  ) {
    return "band";
  }

  if (
    p.includes("delanter") ||
    p.includes("punta") ||
    p.includes("ariete") ||
    /(^|\s)9($|\s)/.test(p)
  ) {
    return "del";
  }

  if (
    p.includes("lateral") ||
    p.includes("lat ") ||
    p.includes("carrilero") ||
    p.includes("central") ||
    p.includes("defensa") ||
    p.includes("zaguero") ||
    p.includes("libero") ||
    p.includes("dfc")
  ) {
    return "def";
  }

  if (
    p.includes("pivote") ||
    p.includes("ancla") ||
    p.includes("medio centro def") ||
    p.includes("mediocentro def") ||
    p.includes("medio defensivo") ||
    p.includes("mcd")
  ) {
    return "piv";
  }

  return "med";
}

/* Cuánto abre: lateral y extremo pegados a la banda, central al eje. */
function widthRank(position: string) {
  if (
    position.includes("lateral") ||
    position.includes("lat ") ||
    position.includes("carrilero") ||
    position.includes("extremo") ||
    position.includes("ext ")
  ) {
    return 2;
  }

  if (position.includes("interior") || position.includes("volante")) return 1;

  return 0;
}

function horizontalPreference(position: string) {
  const side = detectSide(position);

  if (side === 0) return 0;

  return side * (0.55 + 0.22 * widthRank(position));
}

type PlacedPlayer = { player: RivalPlayer; x: number; y: number };

type PitchLayout = {
  placed: PlacedPlayer[];
  avatar: number;
};

const EMPTY_LAYOUT: PitchLayout = { placed: [], avatar: 0 };

function layoutPitch(
  players: RivalPlayer[],
  width: number,
  height: number,
): PitchLayout {
  if (players.length === 0 || width < 120 || height < 200) return EMPTY_LAYOUT;

  /* 1 · Agrupar por línea y ordenar de izquierda a derecha. */

  const grouped = new Map<PitchRowKey, RivalPlayer[]>();

  players.forEach((player) => {
    const key = detectRow(normalize(player["POSICIÓN"]));

    const list = grouped.get(key);

    if (list) list.push(player);
    else grouped.set(key, [player]);
  });

  grouped.forEach((list) => {
    list.sort((a, b) => {
      const prefA = horizontalPreference(normalize(a["POSICIÓN"]));
      const prefB = horizontalPreference(normalize(b["POSICIÓN"]));

      if (prefA !== prefB) return prefA - prefB;

      return (Number(a.DORSAL) || 999) - (Number(b.DORSAL) || 999);
    });
  });

  /* 2 · Repartir cada línea en sub-filas que cubran todo el ancho. */

  /*
  | En pantallas estrechas conviene apretar la sub-fila antes que abrir otra:
  | cada sub-fila extra cuesta mucho más alto del que ahorra de ancho.
  */
  const maxPerSubRow = Math.max(4, Math.min(6, Math.floor(width / 96)));

  const subRows: { players: RivalPlayer[]; band: number; top: number }[] = [];

  PITCH_ROWS.forEach((row) => {
    const list = grouped.get(row.key);

    if (!list || list.length === 0) return;

    const count = Math.ceil(list.length / maxPerSubRow);

    const chunks: RivalPlayer[][] = Array.from({ length: count }, () => []);

    /* Alterno en vez de trocear: cada sub-fila mantiene el abanico entero. */
    list.forEach((player, index) => chunks[index % count].push(player));

    chunks.forEach((chunk, index) => {
      const maxPreference = chunk.reduce(
        (max, player) =>
          Math.max(
            max,
            Math.abs(horizontalPreference(normalize(player["POSICIÓN"]))),
          ),
        0,
      );

      /* Ancho que ocupa la sub-fila: nunca menor del que pide su gente. */
      const band = Math.min(
        1,
        Math.max(0.45, maxPreference + 0.12, 0.22 * chunk.length),
      );

      subRows.push({
        players: chunk,
        band,
        top: row.top * height + (index - (count - 1) / 2),
      });
    });
  });

  if (subRows.length === 0) return EMPTY_LAYOUT;

  subRows.sort((a, b) => a.top - b.top);

  /* 3 · Tamaño de ficha con el que todas las sub-filas caben. */

  const rows = subRows.length;

  const padY = 18;
  const padX = 30;
  const labelHeight = 34;
  const rowGapExtra = 6;

  const byHeight =
    (height - 2 * padY - rowGapExtra * (rows - 1)) / rows - labelHeight;

  const narrowestSlot = subRows.reduce((min, row) => {
    const slot = ((width - 2 * padX) * row.band) / row.players.length;

    return Math.min(min, slot);
  }, Infinity);

  const avatar = Math.max(24, Math.min(62, byHeight, narrowestSlot * 0.74));

  const cardHeight = avatar + labelHeight;
  const gap = cardHeight + rowGapExtra;

  /* 4 · Relajar alturas: separación mínima y todo dentro del campo. */

  const minTop = padY + cardHeight / 2;
  const maxTop = height - padY - cardHeight / 2;

  const tops = subRows.map((row) => row.top);

  tops[0] = Math.max(tops[0], minTop);

  for (let index = 1; index < rows; index += 1) {
    tops[index] = Math.max(tops[index], tops[index - 1] + gap);
  }

  if (tops[rows - 1] > maxTop) {
    tops[rows - 1] = maxTop;

    for (let index = rows - 2; index >= 0; index -= 1) {
      tops[index] = Math.min(tops[index], tops[index + 1] - gap);
    }

    for (let index = 0; index < rows; index += 1) {
      tops[index] = Math.max(tops[index], minTop + index * gap);
    }
  }

  /*
  | Red de seguridad: si la ficha ya está en su tamaño mínimo y aun así no cabe
  | todo, preferimos amontonar un poco a que alguien se salga del campo.
  */
  for (let index = 0; index < rows; index += 1) {
    tops[index] = Math.min(Math.max(tops[index], minTop), maxTop);
  }

  /* 5 · Posición horizontal: reparto uniforme dentro de la banda. */

  const usableWidth = Math.max(80, width - 2 * padX);

  const placed: PlacedPlayer[] = [];

  subRows.forEach((row, rowIndex) => {
    const count = row.players.length;
    const y = tops[rowIndex];

    if (count === 1) {
      placed.push({ player: row.players[0], x: width / 2, y });
      return;
    }

    const bandWidth = usableWidth * row.band;
    const start = width / 2 - bandWidth / 2;

    row.players.forEach((player, index) => {
      placed.push({
        player,
        x: start + (bandWidth * (index + 0.5)) / count,
        y,
      });
    });
  });

  return { placed, avatar };
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

  const { placed, avatar } = useMemo(
    () => layoutPitch(players, size.width, size.height),
    [players, size.width, size.height],
  );

  const badgeSize = Math.max(11, Math.min(19, Math.round(avatar * 0.32)));
  const nameFont = Math.max(9, Math.min(12, Math.round(avatar * 0.21)));

  const maxBadges = avatar < 34 ? 2 : avatar < 48 ? 3 : 4;

  return (
    <div
      ref={containerRef}
      className="relative h-[min(900px,calc(100vh-120px))] min-h-[560px] w-full overflow-hidden bg-[#173b2a]"
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

      <div className="pointer-events-none absolute inset-0 bg-gradient-to-b from-black/45 via-black/10 to-black/45" />

      {/* JUGADORES */}

      {placed.map(({ player, x, y }) => {
        const selected = selectedId === player.ID_JUGADOR;

        const { tags } = parseTags(player.IMPACTO);

        const matchesFilter =
          activeTags.length === 0 ||
          activeTags.every((key) => tags.some((tag) => tag.key === key));

        const visibleTags = tags.slice(0, maxBadges);
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
            {/* FOTO */}

            <div
              className={`relative shrink-0 overflow-hidden rounded-full border-2 bg-[#11161D] shadow-[0_4px_14px_rgba(0,0,0,0.55)] ${
                selected
                  ? "border-[#C8A96B] ring-2 ring-[#C8A96B]/60"
                  : "border-white/80"
              }`}
              style={{ height: avatar, width: avatar }}
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
              className="mt-1 truncate rounded bg-black/75 px-1.5 py-0.5 font-semibold leading-tight text-white"
              style={{ fontSize: nameFont, maxWidth: avatar * 2.2 }}
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
