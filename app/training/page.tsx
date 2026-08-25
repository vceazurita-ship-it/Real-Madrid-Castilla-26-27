"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Loader2, RefreshCw, Search, UserPlus, Users } from "lucide-react";
import { toast } from "sonner";

import { Sidebar } from "@/components/ui/sidebar";
import { Topbar } from "@/components/ui/topbar";
import { useAutoSave } from "@/hooks/useAutoSave";
import { AutoSaveStatus } from "@/components/save-guard/AutoSaveStatus";
import ImportAvailability, {
  TrainingImport,
} from "@/components/session/ImportAvailability";
import { PLAYER_PHOTO_FALLBACK } from "@/lib/playerImages";
import { statusTheme } from "@/lib/session-board/status";
import type { EstadoJugador } from "@/types/player";
import { cn } from "@/lib/utils";

interface SquadPlayer {
  id: string;
  nombre: string;
  apodo: string;
  posicion: string;
  dorsal?: number;
  foto: string;
  licencia: string;
  activo: boolean;
  estado: string;
}

/** Estados que puede tener un jugador en la sesión. */
const ESTADOS = [
  "ÓPTIMO",
  "CONTROL DE CARGA",
  "TOCADO",
  "REINCORPORACIÓN",
  "SANCIONADO",
  "LESIONADO",
  "PRIMER EQUIPO",
  "SELECCIÓN",
  "OTROS",
  "NO CONVOCADO",
] as const;

/** Estados con los que el jugador pisa el campo. */
const ENTRENAN = new Set([
  "ÓPTIMO",
  "CONTROL DE CARGA",
  "TOCADO",
  "REINCORPORACIÓN",
  "SANCIONADO",
]);

type Filter = "todos" | "entrenan" | "fuera";

function todayKey() {
  const now = new Date();

  return [
    now.getFullYear(),
    String(now.getMonth() + 1).padStart(2, "0"),
    String(now.getDate()).padStart(2, "0"),
  ].join("-");
}

export default function JugadoresSesionPage() {
  const [squad, setSquad] = useState<SquadPlayer[]>([]);
  const [estados, setEstados] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);

  const [initialImageUrl, setInitialImageUrl] = useState("");
  const [trainingImport, setTrainingImport] =
    useState<TrainingImport | null>(null);

  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState<Filter>("todos");
  const [fecha, setFecha] = useState(todayKey);

  const [licencias, setLicencias] = useState<Record<string, string>>({});
  const [selectedPlayer, setSelectedPlayer] = useState<Record<string, string>>(
    {}
  );
  const [creating, setCreating] = useState<string | null>(null);

  /* Marca que el próximo cambio de `estados` viene del servidor, no del dedo. */
  const vieneDeFuera = useRef(false);

  const loadSquad = useCallback(async () => {
    try {
      const response = await fetch("/api/training-session", {
        cache: "no-store",
      });

      const body = await response.json();

      if (!response.ok || !body.success) throw new Error(body.error);

      const players: SquadPlayer[] = body.players;

      setSquad(players);

      vieneDeFuera.current = true;

      setEstados(
        Object.fromEntries(
          players.map((player) => [player.id, player.estado || "NO CONVOCADO"])
        )
      );
    } catch (error) {
      console.error(error);
      toast.error("No se pudo cargar la plantilla.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    // Los `setState` de `loadSquad` ocurren tras el `await`, nunca de forma
    // síncrona dentro del efecto.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void loadSquad();
  }, [loadSquad]);

  useEffect(() => {
    const load = async () => {
      try {
        const response = await fetch("/api/training-import/latest");

        if (!response.ok) return;

        const data = await response.json();

        setInitialImageUrl(data.imageUrl ?? "");
      } catch (error) {
        console.error(error);
      }
    };

    void load();
  }, []);

  /** Vuelca en el panel manual lo que ha detectado la importación. */
  const applyImport = (data: TrainingImport) => {
    setTrainingImport(data);

    const detected: Record<string, string> = {};

    const assign = (list: TrainingImport["available"], estado: string) =>
      list.forEach((player) => {
        if (player.id) detected[player.id] = estado;
      });

    assign(data.available, "ÓPTIMO");
    assign(data.promotion, "PRIMER EQUIPO");
    assign(data.injury, "LESIONADO");
    assign(data.others, "OTROS");
    assign(data.nationalTeam, "SELECCIÓN");

    vieneDeFuera.current = true;

    setEstados((current) => {
      const next: Record<string, string> = {};

      Object.keys(current).forEach((id) => {
        next[id] = detected[id] ?? "NO CONVOCADO";
      });

      return { ...next, ...detected };
    });


    localStorage.setItem(
      "training-session-players",
      JSON.stringify(data.sessionPlayers)
    );
  };

  const setEstado = (id: string, estado: string) => {
    setEstados((current) => ({ ...current, [id]: estado }));
  };

  const escribirDisponibilidad = useCallback(
    async (actual: Record<string, string>) => {
      const response = await fetch("/api/training-session", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          fecha,
          estados: actual,
          imageUrl: initialImageUrl,
        }),
      });

      const body = await response.json();

      if (!response.ok || !body.success) throw new Error(body.error);


      return true;
    },
    [fecha, initialImageUrl]
  );

  /*
  | La disponibilidad se toca sobre la marcha, en el campo y desde el móvil:
  | es justo donde un "se me olvidó darle a guardar" cuesta una sesión mal
  | montada. Se escribe sola en cuanto se deja de tocar.
  |
  | Sin `enabled`: aquí no hay modo edición, la pantalla siempre lo es. La
  | carga inicial y las importaciones no disparan guardado porque llaman a
  | `auto.sync()` para fijar la nueva base.
  */
  const auto = useAutoSave<Record<string, string>>({
    value: estados,
    debounce: 900,
    save: escribirDisponibilidad,
  });

  /*
  | Cargar la plantilla o volcar una importación cambia los estados de golpe,
  | y eso no es una edición: devolverlo al servidor sería escribir encima lo
  | que se acaba de leer. Este efecto va después del hook a propósito, para
  | poder cancelar el temporizador que aquél acaba de programar.
  */
  useEffect(() => {
    if (!vieneDeFuera.current) return;

    vieneDeFuera.current = false;

    auto.sync();
  }, [estados, auto]);

  const createPlayer = async (name: string, licencia: string) => {
    setCreating(name);

    try {
      const response = await fetch("/api/create-player", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, licencia, estado: "ÓPTIMO" }),
      });

      const result = await response.json();

      if (!result.ok) {
        toast.error("No se pudo crear el jugador");
        return;
      }

      toast.success(`${name} creado correctamente`);

      setTrainingImport((current) =>
        current
          ? {
              ...current,
              pendingPlayers: current.pendingPlayers.filter(
                (player) => player.name !== name
              ),
            }
          : current
      );

      await loadSquad();
    } finally {
      setCreating(null);
    }
  };

  const associatePlayer = async (detected: string, playerId: string) => {
    try {
      const response = await fetch("/api/save-alias", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ alias: detected, id: playerId }),
      });

      const result = await response.json();

      if (!result.ok) {
        toast.error("No se pudo guardar el alias");
        return;
      }

      toast.success("Alias guardado correctamente");

      setEstado(playerId, "ÓPTIMO");

      setTrainingImport((current) =>
        current
          ? {
              ...current,
              pendingPlayers: current.pendingPlayers.filter(
                (player) => player.name !== detected
              ),
            }
          : current
      );
    } catch (error) {
      console.error(error);
      toast.error("Error guardando el alias");
    }
  };

  const counts = useMemo(() => {
    const totals: Record<string, number> = {};

    Object.values(estados).forEach((estado) => {
      totals[estado] = (totals[estado] ?? 0) + 1;
    });

    return totals;
  }, [estados]);

  const entrenan = useMemo(
    () =>
      Object.values(estados).filter((estado) => ENTRENAN.has(estado)).length,
    [estados]
  );

  const visible = useMemo(() => {
    const term = search.trim().toLowerCase();

    return squad.filter((player) => {
      const estado = estados[player.id] ?? "NO CONVOCADO";

      if (filter === "entrenan" && !ENTRENAN.has(estado)) return false;
      if (filter === "fuera" && ENTRENAN.has(estado)) return false;

      if (!term) return true;

      return (
        player.nombre.toLowerCase().includes(term) ||
        player.apodo.toLowerCase().includes(term)
      );
    });
  }, [squad, estados, filter, search]);

  return (
    <main className="min-h-screen bg-[#0B0F14] text-white">
      <div className="flex">
        <Sidebar />

        <section className="min-w-0 flex-1">
          <Topbar />

          <div className="min-w-0 space-y-6 px-4 py-6 sm:px-6 lg:px-10">
            {/* CABECERA */}

            <header>
              <p className="text-[10px] uppercase tracking-[0.35em] text-[#C8A96B]">
                RMCF Castilla · Sesión
              </p>

              <div className="mt-3 flex flex-wrap items-center gap-4">
                <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">
                  Jugadores Sesión
                </h1>

                <div className="h-px flex-1 bg-gradient-to-r from-[#C8A96B]/40 via-white/10 to-transparent" />
              </div>

              <p className="mt-3 max-w-3xl text-sm leading-relaxed text-white/55">
                Sube la imagen del entrenamiento o pega el mensaje de WhatsApp
                para detectar la disponibilidad, y ajústala jugador a jugador
                antes de guardarla.
              </p>
            </header>

            {/* IMPORTADOR */}

            <section className="rounded-[28px] border border-white/10 bg-gradient-to-b from-white/[0.05] to-white/[0.02] p-5 shadow-[0_12px_40px_rgba(0,0,0,0.35)] sm:p-7">
              <h2 className="mb-4 text-lg font-semibold">
                Importar disponibilidad
              </h2>

              <ImportAvailability
                initialImageUrl={initialImageUrl}
                onImport={applyImport}
              />
            </section>

            {/* JUGADORES NUEVOS DETECTADOS */}

            {trainingImport && trainingImport.pendingPlayers.length > 0 && (
              <section className="rounded-[28px] border border-[#C8A96B]/30 bg-gradient-to-b from-[#161D26] to-[#11161D] p-5 shadow-[0_12px_40px_rgba(0,0,0,0.35)] sm:p-7">
                <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <h2 className="text-lg font-semibold">
                      Nombres sin identificar
                    </h2>

                    <p className="mt-0.5 text-xs text-white/50">
                      Asócialos a un jugador existente o créalos en la base de
                      datos.
                    </p>
                  </div>

                  <span className="rounded-full bg-[#C8A96B]/15 px-3 py-1 text-xs font-semibold text-[#C8A96B]">
                    {trainingImport.pendingPlayers.length} pendientes
                  </span>
                </div>

                <div className="space-y-3">
                  {trainingImport.pendingPlayers.map((player) => (
                    <div
                      key={player.name}
                      className="flex flex-col gap-4 rounded-2xl border border-white/10 bg-white/[0.03] p-4 lg:flex-row lg:items-center"
                    >
                      <div className="flex flex-1 items-center gap-3">
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img
                          src={player.photo || PLAYER_PHOTO_FALLBACK}
                          alt=""
                          className="h-11 w-11 rounded-full border border-white/10 object-cover"
                        />

                        <div className="min-w-0">
                          <p className="truncate font-semibold">
                            {player.name}
                          </p>

                          <p className="text-xs text-white/45">
                            {player.candidates?.length
                              ? "Coincidencia ambigua"
                              : "Jugador nuevo detectado"}
                          </p>
                        </div>
                      </div>

                      {player.candidates?.length ? (
                        <div className="flex flex-wrap gap-2">
                          <select
                            value={selectedPlayer[player.name] ?? ""}
                            onChange={(event) =>
                              setSelectedPlayer({
                                ...selectedPlayer,
                                [player.name]: event.target.value,
                              })
                            }
                            className="rounded-xl border border-white/10 bg-[#1A212C] px-3 py-2 text-sm outline-none"
                          >
                            <option value="">Selecciona jugador…</option>

                            {player.candidates.map((candidate) => (
                              <option
                                key={candidate.player.ID_JUGADOR}
                                value={candidate.player.ID_JUGADOR}
                              >
                                {candidate.player.NOMBRE} (
                                {candidate.confidence}%)
                              </option>
                            ))}
                          </select>

                          <button
                            type="button"
                            disabled={!selectedPlayer[player.name]}
                            onClick={() =>
                              associatePlayer(
                                player.name,
                                selectedPlayer[player.name]
                              )
                            }
                            className="rounded-xl bg-[#C8A96B] px-4 py-2 text-sm font-semibold text-[#0B0F14] transition hover:bg-[#d8bd85] disabled:opacity-40"
                          >
                            Asociar
                          </button>
                        </div>
                      ) : (
                        <div className="flex flex-wrap gap-2">
                          <select
                            value={licencias[player.name] ?? "JUV A"}
                            onChange={(event) =>
                              setLicencias({
                                ...licencias,
                                [player.name]: event.target.value,
                              })
                            }
                            className="rounded-xl border border-white/10 bg-[#1A212C] px-3 py-2 text-sm outline-none"
                          >
                            <option value="RMC">Real Madrid C</option>
                            <option value="JUV A">Juvenil A</option>
                            <option value="JUV B">Juvenil B</option>
                            <option value="RMCF Castilla">
                              Real Madrid Castilla
                            </option>
                            <option value="OTRO">Otro</option>
                          </select>

                          <button
                            type="button"
                            disabled={creating === player.name}
                            onClick={() =>
                              createPlayer(
                                player.name,
                                licencias[player.name] ?? "JUV A"
                              )
                            }
                            className="inline-flex items-center gap-2 rounded-xl bg-[#C8A96B] px-4 py-2 text-sm font-semibold text-[#0B0F14] transition hover:bg-[#d8bd85] disabled:opacity-40"
                          >
                            {creating === player.name ? (
                              <Loader2 size={15} className="animate-spin" />
                            ) : (
                              <UserPlus size={15} />
                            )}
                            Crear
                          </button>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </section>
            )}

            {/* DISPONIBILIDAD */}

            <section className="rounded-[28px] border border-white/10 bg-gradient-to-b from-[#151B23] to-[#0E131A] p-5 shadow-[0_35px_90px_rgba(0,0,0,.5)] sm:p-7">
              <div className="mb-5 flex flex-wrap items-start justify-between gap-4">
                <div>
                  <h2 className="text-lg font-semibold">
                    Disponibilidad de la plantilla
                  </h2>

                  <p className="mt-0.5 text-xs text-white/50">
                    Ajusta el estado de cada jugador y guarda la sesión.
                  </p>
                </div>

                <div className="flex flex-wrap items-end gap-2">
                  <label className="block">
                    <span className="mb-1 block text-[10px] uppercase tracking-[0.25em] text-white/40">
                      Fecha
                    </span>

                    <input
                      type="date"
                      value={fecha}
                      onChange={(event) =>
                        setFecha(event.target.value || todayKey())
                      }
                      className="rounded-xl border border-white/10 bg-[#11161D] px-3 py-2 text-sm outline-none transition focus:border-[#C8A96B]/60"
                    />
                  </label>

                  <button
                    type="button"
                    onClick={() => {
                      setLoading(true);
                      void loadSquad();
                    }}
                    className="inline-flex items-center gap-2 rounded-xl border border-white/10 bg-white/[0.04] px-3.5 py-2.5 text-xs font-semibold text-white/70 transition hover:bg-white/[0.08] hover:text-white"
                  >
                    <RefreshCw size={14} />
                    Recargar
                  </button>

                  <AutoSaveStatus
                    estado={auto.status}
                    guardadoEn={auto.lastSavedAt}
                    onReintentar={() => void auto.flush()}
                  />
                </div>
              </div>

              {/* RESUMEN */}

              <div className="mb-5 flex flex-wrap gap-2">
                <span className="inline-flex items-center gap-2 rounded-full border border-[#C8A96B]/30 bg-[#C8A96B]/10 px-3 py-1.5 text-xs font-semibold text-[#C8A96B]">
                  <Users size={13} />
                  {entrenan} entrenan
                </span>

                {ESTADOS.filter((estado) => counts[estado]).map((estado) => {
                  const theme = statusTheme(estado as EstadoJugador);

                  return (
                    <span
                      key={estado}
                      className={cn(
                        "inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-medium",
                        theme.chip
                      )}
                    >
                      <span
                        className={cn("h-1.5 w-1.5 rounded-full", theme.dot)}
                      />
                      {estado}
                      <span className="tabular-nums opacity-70">
                        {counts[estado]}
                      </span>
                    </span>
                  );
                })}
              </div>

              {/* FILTROS */}

              <div className="mb-4 flex flex-wrap items-center gap-2">
                <div className="relative min-w-[220px] flex-1">
                  <Search
                    size={15}
                    className="absolute left-3 top-1/2 -translate-y-1/2 text-white/35"
                  />

                  <input
                    value={search}
                    onChange={(event) => setSearch(event.target.value)}
                    placeholder="Buscar jugador…"
                    className="w-full rounded-xl border border-white/10 bg-[#11161D] py-2.5 pl-9 pr-3 text-sm outline-none transition placeholder:text-white/30 focus:border-[#C8A96B]/60"
                  />
                </div>

                {(
                  [
                    ["todos", "Todos"],
                    ["entrenan", "Entrenan"],
                    ["fuera", "Fuera"],
                  ] as [Filter, string][]
                ).map(([id, label]) => (
                  <button
                    key={id}
                    type="button"
                    onClick={() => setFilter(id)}
                    className={cn(
                      "rounded-xl border px-3.5 py-2 text-xs font-semibold transition",
                      filter === id
                        ? "border-[#C8A96B]/50 bg-[#C8A96B]/12 text-[#C8A96B]"
                        : "border-white/10 bg-white/[0.03] text-white/55 hover:text-white"
                    )}
                  >
                    {label}
                  </button>
                ))}
              </div>

              {/* LISTA */}

              {loading ? (
                <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-3">
                  {Array.from({ length: 9 }).map((_, index) => (
                    <div
                      key={index}
                      className="h-[68px] animate-pulse rounded-2xl border border-white/10 bg-[#11161D]"
                    />
                  ))}
                </div>
              ) : visible.length === 0 ? (
                <p className="rounded-2xl border border-dashed border-white/15 px-6 py-12 text-center text-sm text-white/40">
                  Ningún jugador coincide con el filtro.
                </p>
              ) : (
                <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-3">
                  {visible.map((player) => {
                    const estado = estados[player.id] ?? "NO CONVOCADO";
                    const theme = statusTheme(estado as EstadoJugador);

                    return (
                      <div
                        key={player.id}
                        className="flex items-center gap-3 rounded-2xl border border-white/10 bg-[#11161D] p-2.5 transition hover:border-[#C8A96B]/35"
                      >
                        <span
                          className={cn(
                            "relative h-10 w-10 shrink-0 overflow-hidden rounded-full bg-black/40 ring-2",
                            theme.ring
                          )}
                        >
                          {/* eslint-disable-next-line @next/next/no-img-element */}
                          <img
                            src={player.foto || PLAYER_PHOTO_FALLBACK}
                            alt=""
                            className="h-full w-full object-cover"
                          />
                        </span>

                        <div className="min-w-0 flex-1">
                          <p className="truncate text-sm font-semibold">
                            {player.apodo || player.nombre}
                          </p>

                          <p className="truncate text-[11px] text-white/40">
                            {player.posicion || "—"} · {player.licencia}
                          </p>
                        </div>

                        <select
                          value={estado}
                          onChange={(event) =>
                            setEstado(player.id, event.target.value)
                          }
                          className="w-[128px] shrink-0 rounded-xl border border-white/10 bg-[#0F141B] px-2 py-1.5 text-[11px] font-medium text-white outline-none transition focus:border-[#C8A96B]/60"
                        >
                          {ESTADOS.map((option) => (
                            <option key={option} value={option}>
                              {option}
                            </option>
                          ))}
                        </select>
                      </div>
                    );
                  })}
                </div>
              )}
            </section>
          </div>
        </section>
      </div>
    </main>
  );
}
