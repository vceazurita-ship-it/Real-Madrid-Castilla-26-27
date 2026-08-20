"use client";

import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";

import { toast } from "sonner";

import { Sidebar } from "@/components/ui/sidebar";
import { Topbar } from "@/components/ui/topbar";
import { useBodyScrollLock } from "@/components/season/useBodyScrollLock";

import {
  ChevronLeft,
  ChevronRight,
  LayoutGrid,
  Search,
  Shirt,
  X,
  Save,
  ExternalLink,
  FileText,
  Video,
  UserRound,
  Plus,
  RotateCcw,
  Trash2,
} from "lucide-react";

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

  const [selectedPlayer, setSelectedPlayer] = useState<RivalPlayer | null>(
    null,
  );

  const [editForm, setEditForm] = useState<RivalPlayer | null>(null);

  const [isCreating, setIsCreating] = useState(false);
  const [saving, setSaving] = useState(false);

  const [showPitch, setShowPitch] = useState(true);

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
        normalize(player.ROL).includes(searchValue)
      );
    });
  }, [players, selectedTeam, search, positionSearch]);

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
      const linePlayers = filteredPlayers
        .filter((player) => getLine(player["POSICIÓN"])?.key === line.key)
        .sort((a, b) => {
          const rankA = positionRank(a["POSICIÓN"]);
          const rankB = positionRank(b["POSICIÓN"]);

          if (rankA !== rankB) return rankA - rankB;

          return (Number(a.DORSAL) || 999) - (Number(b.DORSAL) || 999);
        });

      return { ...line, players: linePlayers };
    });
  }, [filteredPlayers]);

  /* Jugadores cuya posición no encaja en ninguna línea conocida. */
  const unclassified = useMemo(() => {
    return filteredPlayers.filter((player) => !getLine(player["POSICIÓN"]));
  }, [filteredPlayers]);

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
  | NAVEGACIÓN
  |--------------------------------------------------------------------------
  */

  const selectedIndex = selectedPlayer
    ? filteredPlayers.findIndex(
        (player) => player.ID_JUGADOR === selectedPlayer.ID_JUGADOR,
      )
    : -1;

  const navigatePlayer = useCallback(
    (direction: number) => {
      if (selectedIndex === -1 || filteredPlayers.length === 0) return;

      const nextIndex = selectedIndex + direction;

      if (nextIndex < 0 || nextIndex >= filteredPlayers.length) return;

      if (isDirty) {
        const confirmed = window.confirm(
          "Hay cambios sin guardar. ¿Seguro que quieres cambiar de jugador?",
        );

        if (!confirmed) return;
      }

      openPlayer(filteredPlayers[nextIndex]);
    },
    [selectedIndex, filteredPlayers, openPlayer, isDirty],
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
  };

  const hasFilters = Boolean(search || positionSearch);

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

            {/* CONTADOR */}

            <div className="mt-6 flex min-w-0 flex-wrap items-center justify-between gap-4">
              <div className="flex min-w-0 flex-wrap items-center gap-3">
                <p className="shrink-0 text-sm text-white/50">
                  {filteredPlayers.length}{" "}
                  {filteredPlayers.length === 1 ? "jugador" : "jugadores"}
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

                  {filteredPlayers.length === 0 && (
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
                        {pitchPlayers.length} jugadores
                      </span>
                    </div>

                    <TacticalPitch
                      players={pitchPlayers}
                      selectedId={selectedPlayer?.ID_JUGADOR}
                      onPlayerClick={openPlayer}
                    />
                  </div>
                </div>
              </div>
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
                        {selectedIndex + 1}/{filteredPlayers.length}
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
                    disabled={selectedIndex >= filteredPlayers.length - 1}
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
                  <div className="grid gap-4 md:grid-cols-3">
                    <EditableField
                      label="Estado"
                      value={editForm.ESTADO}
                      onChange={(value) => updateForm("ESTADO", value)}
                    />

                    <EditableField
                      label="Impacto"
                      value={editForm.IMPACTO}
                      onChange={(value) => updateForm("IMPACTO", value)}
                    />

                    <EditableField
                      label="Rol"
                      value={editForm.ROL}
                      onChange={(value) => updateForm("ROL", value)}
                    />
                  </div>

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
| CAMPOGRAMA
|--------------------------------------------------------------------------
*/

function TacticalPitch({
  players,
  selectedId,
  onPlayerClick,
}: {
  players: RivalPlayer[];
  selectedId?: string;
  onPlayerClick: (player: RivalPlayer) => void;
}) {
  const positionedPlayers = useMemo(
    () => getPitchPlayers(players),
    [players],
  );

  return (
    <div className="relative h-[min(900px,calc(100vh-120px))] min-h-[560px] w-full overflow-hidden bg-[#173b2a]">
      {/* FONDO DEL CAMPO */}

      <div className="pointer-events-none absolute inset-0 overflow-hidden">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src="/emotional-field-bg.png"
          alt=""
          className="absolute left-1/2 top-1/2 h-[75%] w-[240%] max-w-none -translate-x-1/2 -translate-y-1/2 rotate-90 object-fill sm:h-[133%] sm:w-[240%] lg:h-[135%] lg:w-[100%]"
        />
      </div>

      <div className="pointer-events-none absolute inset-0 bg-black/20" />

      {/* JUGADORES */}

      {positionedPlayers.map(({ player, top, left }) => {
        const selected = selectedId === player.ID_JUGADOR;

        return (
          <button
            key={player.ID_JUGADOR}
            onClick={() => onPlayerClick(player)}
            title={`${player["NOMBRE DEPORTIVO"] || player.JUGADOR} · ${
              player["POSICIÓN"]
            }`}
            className="group absolute z-10 flex -translate-x-1/2 -translate-y-1/2 flex-col items-center transition hover:z-20 hover:scale-110"
            style={{ top: `${top}%`, left: `${left}%` }}
          >
            {/* FOTO */}

            <div
              className={`relative h-10 w-10 overflow-hidden rounded-full border-2 bg-[#11161D] shadow-xl sm:h-14 sm:w-14 md:h-16 md:w-16 ${
                selected
                  ? "border-[#C8A96B] ring-2 ring-[#C8A96B]/60"
                  : "border-white/80"
              }`}
            >
              {player.FOTO ? (
                /* eslint-disable-next-line @next/next/no-img-element */
                <img
                  src={player.FOTO}
                  alt={player["NOMBRE DEPORTIVO"] || player.JUGADOR}
                  loading="lazy"
                  className="h-full w-full object-cover"
                />
              ) : (
                <UserRound
                  size={20}
                  className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 text-white/30"
                />
              )}

              {/* DORSAL */}

              {player.DORSAL !== "" && player.DORSAL !== undefined && (
                <span className="absolute bottom-0 right-0 flex h-5 min-w-5 items-center justify-center rounded-full bg-[#C8A96B] px-1 text-[9px] font-bold text-black">
                  {player.DORSAL}
                </span>
              )}
            </div>

            {/* NOMBRE */}

            <span className="mt-1 max-w-[72px] truncate rounded bg-black/70 px-1 py-0.5 text-[8px] font-semibold text-white sm:max-w-[110px] sm:px-2 sm:text-[11px]">
              {player["NOMBRE DEPORTIVO"] || player.JUGADOR}
            </span>

            {/* ROL */}

            {player.ROL && (
              <span className="max-w-[90px] truncate text-[8px] font-medium text-white/80 sm:max-w-[150px] sm:text-[11px]">
                {player.ROL}
              </span>
            )}
          </button>
        );
      })}

      {positionedPlayers.length === 0 && (
        <div className="absolute inset-0 flex items-center justify-center px-6 text-center text-sm text-white/50">
          No hay jugadores con posición asignada.
        </div>
      )}
    </div>
  );
}

/*
|--------------------------------------------------------------------------
| COLOCACIÓN EN EL CAMPO
|--------------------------------------------------------------------------
| Cada grupo tiene una zona (top/left en %). Todos los grupos declarados aquí
| se pintan: los genéricos (lateral, interior, extremo sin lado) también, para
| que ningún jugador con posición desaparezca del campograma.
*/

type PitchSlot = {
  /* Coordenadas en % sobre el contenedor. top 0 = portería rival. */
  top: number;
  left: number;
  /* "horizontal": se reparten en abanico. "vertical": en columna. */
  mode: "horizontal" | "vertical";
  maxWidth?: number;
  spacing: number;
  matches: (position: string) => boolean;
};

const PITCH_SLOTS: PitchSlot[] = [
  {
    top: 95,
    left: 52,
    mode: "horizontal",
    maxWidth: 30,
    spacing: 24,
    matches: (p) =>
      p.includes("portero") || p.includes("arquero") || p.includes("guardameta"),
  },

  /* DEFENSA */

  {
    top: 69,
    left: 15,
    mode: "vertical",
    spacing: 12,
    matches: (p) =>
      p.includes("lateral izquierdo") ||
      p.includes("lateral izq") ||
      p.includes("lateral i") ||
      p.includes("lat izquierdo") ||
      p.includes("lat izq") ||
      p.includes("lat i") ||
      p.includes("carrilero izquierdo") ||
      p.includes("carrilero izq"),
  },
  {
    top: 69,
    left: 87,
    mode: "vertical",
    spacing: 12,
    matches: (p) =>
      p.includes("lateral derecho") ||
      p.includes("lateral dcho") ||
      p.includes("lateral der") ||
      p.includes("lateral d") ||
      p.includes("lat derecho") ||
      p.includes("lat dcho") ||
      p.includes("lat der") ||
      p.includes("lat d") ||
      p.includes("carrilero derecho") ||
      p.includes("carrilero der"),
  },
  {
    top: 73,
    left: 52,
    mode: "horizontal",
    maxWidth: 38,
    spacing: 22,
    matches: (p) =>
      p.includes("central") ||
      p.includes("zaguero") ||
      p.includes("defensa central"),
  },
  /* Laterales/carrileros sin lado definido: entre los dos costados. */
  {
    top: 78,
    left: 52,
    mode: "horizontal",
    maxWidth: 46,
    spacing: 24,
    matches: (p) =>
      p.includes("lateral") || p.includes("carrilero") || p.includes("lat "),
  },
  {
    top: 76,
    left: 52,
    mode: "horizontal",
    maxWidth: 42,
    spacing: 22,
    matches: (p) => p.includes("defensa"),
  },

  /* MEDIO */

  {
    top: 52,
    left: 52,
    mode: "horizontal",
    maxWidth: 42,
    spacing: 22,
    matches: (p) =>
      p.includes("mediocentro") ||
      p.includes("medio centro") ||
      p.includes("pivote") ||
      p.includes("medio defensivo"),
  },
  {
    top: 44,
    left: 30,
    mode: "vertical",
    spacing: 11,
    matches: (p) =>
      p.includes("interior izquierdo") ||
      p.includes("interior izq") ||
      p.includes("interior i") ||
      p.includes("int izquierdo") ||
      p.includes("int izq") ||
      p.includes("int i"),
  },
  {
    top: 44,
    left: 74,
    mode: "vertical",
    spacing: 11,
    matches: (p) =>
      p.includes("interior derecho") ||
      p.includes("interior dcho") ||
      p.includes("interior der") ||
      p.includes("interior d") ||
      p.includes("int derecho") ||
      p.includes("int dcho") ||
      p.includes("int der") ||
      p.includes("int d"),
  },
  {
    top: 40,
    left: 52,
    mode: "horizontal",
    maxWidth: 46,
    spacing: 24,
    matches: (p) => p.includes("interior"),
  },
  {
    top: 28,
    left: 52,
    mode: "horizontal",
    maxWidth: 42,
    spacing: 22,
    matches: (p) =>
      p.includes("media punta") ||
      p.includes("mediapunta") ||
      p.includes("media-punta") ||
      p.includes("enganche"),
  },
  {
    top: 48,
    left: 52,
    mode: "horizontal",
    maxWidth: 42,
    spacing: 22,
    matches: (p) => p.includes("medio"),
  },

  /* ATAQUE */

  {
    top: 22,
    left: 14,
    mode: "vertical",
    spacing: 12,
    matches: (p) =>
      p.includes("extremo izquierdo") ||
      p.includes("extremo izq") ||
      p.includes("extremo i") ||
      p.includes("ext izquierdo") ||
      p.includes("ext izq") ||
      p.includes("ext i"),
  },
  {
    top: 22,
    left: 88,
    mode: "vertical",
    spacing: 12,
    matches: (p) =>
      p.includes("extremo derecho") ||
      p.includes("extremo dcho") ||
      p.includes("extremo der") ||
      p.includes("extremo d") ||
      p.includes("ext derecho") ||
      p.includes("ext dcho") ||
      p.includes("ext der") ||
      p.includes("ext d"),
  },
  {
    top: 18,
    left: 52,
    mode: "horizontal",
    maxWidth: 50,
    spacing: 24,
    matches: (p) => p.includes("extremo") || p.includes("ext "),
  },
  {
    top: 8,
    left: 52,
    mode: "horizontal",
    maxWidth: 42,
    spacing: 24,
    matches: (p) =>
      p.includes("delantero") ||
      p.includes("punta") ||
      p.includes("ariete") ||
      p.includes("9"),
  },
];

/* Zona por defecto para posiciones que no encajan en ningún slot. */
const FALLBACK_SLOT: Omit<PitchSlot, "matches"> = {
  top: 60,
  left: 52,
  mode: "horizontal",
  maxWidth: 34,
  spacing: 22,
};

function getPitchPlayers(players: RivalPlayer[]) {
  const buckets = PITCH_SLOTS.map(() => [] as RivalPlayer[]);
  const fallback: RivalPlayer[] = [];

  players.forEach((player) => {
    const position = normalize(player["POSICIÓN"]);

    const index = PITCH_SLOTS.findIndex((slot) => slot.matches(position));

    if (index === -1) {
      fallback.push(player);
      return;
    }

    buckets[index].push(player);
  });

  const result: { player: RivalPlayer; top: number; left: number }[] = [];

  const place = (
    slot: Omit<PitchSlot, "matches">,
    slotPlayers: RivalPlayer[],
  ) => {
    if (slotPlayers.length === 0) return;

    if (slot.mode === "vertical") {
      result.push(
        ...distributePlayersVertical(
          slotPlayers,
          slot.top,
          slot.left,
          slot.spacing,
        ),
      );
      return;
    }

    result.push(
      ...distributePlayers(
        slotPlayers,
        slot.top,
        slot.left,
        slot.maxWidth ?? 40,
        slot.spacing,
      ),
    );
  };

  PITCH_SLOTS.forEach((slot, index) => place(slot, buckets[index]));

  place(FALLBACK_SLOT, fallback);

  return result;
}

function distributePlayers(
  players: RivalPlayer[],
  top: number,
  centerLeft: number,
  maxWidth: number,
  minSpacing: number,
) {
  if (players.length === 0) return [];

  if (players.length === 1) {
    return [{ player: players[0], top, left: centerLeft }];
  }

  if (players.length === 2) {
    const spacing = Math.min(minSpacing * 1.5, maxWidth / 2);

    return [
      { player: players[0], top, left: centerLeft - spacing },
      { player: players[1], top, left: centerLeft + spacing },
    ];
  }

  if (players.length === 3) {
    const spacing = Math.min(minSpacing * 1.4, maxWidth / 2);

    return [
      { player: players[0], top, left: centerLeft - spacing },
      { player: players[1], top: top - 2, left: centerLeft },
      { player: players[2], top, left: centerLeft + spacing },
    ];
  }

  /*
  |--------------------------------------------------------------------------
  | CUATRO O MÁS: DOS FILAS
  |--------------------------------------------------------------------------
  */

  const firstRowCount = Math.ceil(players.length / 2);
  const secondRowCount = players.length - firstRowCount;

  const createRow = (rowPlayers: RivalPlayer[], rowTop: number) => {
    if (rowPlayers.length === 1) {
      return [{ player: rowPlayers[0], top: rowTop, left: centerLeft }];
    }

    const rowWidth = Math.min(
      maxWidth,
      (rowPlayers.length - 1) * minSpacing * 1.35,
    );

    const spacing = rowWidth / (rowPlayers.length - 1);
    const start = centerLeft - rowWidth / 2;

    return rowPlayers.map((player, index) => ({
      player,
      top: rowTop,
      left: start + index * spacing,
    }));
  };

  const firstRow = createRow(players.slice(0, firstRowCount), top - 8);

  const secondRow =
    secondRowCount > 0
      ? createRow(players.slice(firstRowCount), top + 8)
      : [];

  return [...firstRow, ...secondRow];
}

function distributePlayersVertical(
  players: RivalPlayer[],
  top: number,
  left: number,
  verticalSpacing: number,
) {
  if (players.length === 0) return [];

  if (players.length === 1) {
    return [{ player: players[0], top, left }];
  }

  const totalHeight = (players.length - 1) * verticalSpacing;
  const start = top - totalHeight / 2;

  return players.map((player, index) => ({
    player,
    top: start + index * verticalSpacing,
    left,
  }));
}
