"use client";

import { Sidebar } from "@/components/ui/sidebar";
import { Topbar } from "@/components/ui/topbar";
import { useEffect, useMemo, useState } from "react";
import Papa from "papaparse";
import { toast } from "sonner";
import {
  CalendarDays,
  ChevronDown,
  Clapperboard,
  Copy,
  Film,
  LayoutGrid,
  Play,
  RotateCcw,
  Search,
  Shield,
  Swords,
  Users,
} from "lucide-react";

const CSV_URL =
  "https://docs.google.com/spreadsheets/d/e/2PACX-1vS3_1ScOV6sTyEpZSgLgCf2dKbwkLzb3zUEYM-7ZOoMbcFUTp7nvu1pBfGOP7EzppXXQYQhLeVa_SPr/pub?gid=1662164849&single=true&output=csv";

const GOLD = "#C8A96B";

/* ------------------------------------------------------------------ */
/* Datos                                                               */
/* ------------------------------------------------------------------ */

type Clip = {
  id: string;
  jugador: string;
  equipo: string;
  posicion: string;
  categoria: string;
  subcategoria: string;
  rival: string;
  competicion: string;
  fecha: string;
  tiempo: number;
  minuto: string;
  resultado: string;
  url: string;
};

/** Campos por los que se puede filtrar con un desplegable. */
const FACETS = [
  { key: "equipo", label: "Todos los equipos" },
  { key: "posicion", label: "Todas las posiciones" },
  { key: "categoria", label: "Todas las categorías" },
  { key: "subcategoria", label: "Todas las subcategorías" },
  { key: "rival", label: "Todos los partidos" },
  { key: "competicion", label: "Todas las competiciones" },
] as const;

type FacetKey = (typeof FACETS)[number]["key"];

type Filters = Record<FacetKey, string>;

const EMPTY_FILTERS: Filters = {
  equipo: "",
  posicion: "",
  categoria: "",
  subcategoria: "",
  rival: "",
  competicion: "",
};

const SORTS = [
  { key: "recientes", label: "Más recientes" },
  { key: "antiguos", label: "Más antiguos" },
  { key: "jugador", label: "Jugador (A-Z)" },
  { key: "equipo", label: "Equipo (A-Z)" },
] as const;

type SortKey = (typeof SORTS)[number]["key"];

const clean = (v?: string) => String(v ?? "").trim();

/** dd/mm/yyyy -> milisegundos (0 si la fecha no es legible). */
function parseFecha(value: string) {
  const [d, m, y] = value.split(/[/\-.]/);

  if (!d || !m || !y) return 0;

  const time = new Date(`${y.length === 2 ? `20${y}` : y}-${m}-${d}`).getTime();

  return Number.isNaN(time) ? 0 : time;
}

function toClip(row: Record<string, string>, index: number): Clip {
  const fecha = clean(row.Fecha);

  return {
    id: `${index}`,
    jugador: clean(row.Jugador),
    equipo: clean(row.Equipo),
    posicion: clean(row["Posición"]),
    categoria: clean(row["Categoría"]),
    subcategoria: clean(row["Subcategoría"]),
    rival: clean(row.Rival),
    competicion: clean(row["Competición"]),
    fecha,
    tiempo: parseFecha(fecha),
    minuto: clean(row.Minuto),
    resultado: clean(row.Resultado),
    url: clean(row["URL Hudl"]),
  };
}

/* ------------------------------------------------------------------ */
/* Página                                                              */
/* ------------------------------------------------------------------ */

export default function ScoutRivalIndividual() {
  const [clips, setClips] = useState<Clip[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  const [search, setSearch] = useState("");
  const [filters, setFilters] = useState<Filters>(EMPTY_FILTERS);
  const [sort, setSort] = useState<SortKey>("recientes");
  const [view, setView] = useState<"clips" | "jugadores">("clips");
  const [expanded, setExpanded] = useState<string | null>(null);

  useEffect(() => {
    Papa.parse<Record<string, string>>(CSV_URL, {
      download: true,
      header: true,
      skipEmptyLines: true,

      complete: (results) => {
        const rows = results.data
          .filter(
            (row) =>
              clean(row.Tipo) === "Rival" && clean(row.Nivel) === "Individual"
          )
          .map(toClip)
          .filter((clip) => clip.jugador);

        setClips(rows);
        setLoading(false);
      },

      error: () => {
        setError(true);
        setLoading(false);
      },
    });
  }, []);

  /* ---------------- filtrado ---------------- */

  const term = search.trim().toLowerCase();

  /**
   * Un clip pasa el filtro si cumple todas las facetas activas. `skip`
   * permite ignorar una faceta para calcular sus propias opciones: así el
   * desplegable solo ofrece valores que devuelven resultados.
   */
  const matches = (clip: Clip, skip?: FacetKey) => {
    if (
      term &&
      !`${clip.jugador} ${clip.equipo}`.toLowerCase().includes(term)
    ) {
      return false;
    }

    return FACETS.every(
      ({ key }) => key === skip || !filters[key] || clip[key] === filters[key]
    );
  };

  const filtered = useMemo(() => {
    const list = clips.filter((clip) => matches(clip));

    const byName = (a: Clip, b: Clip) =>
      a.jugador.localeCompare(b.jugador, "es");

    return list.sort((a, b) => {
      if (sort === "jugador") return byName(a, b);

      if (sort === "equipo") {
        return a.equipo.localeCompare(b.equipo, "es") || byName(a, b);
      }

      const diff = b.tiempo - a.tiempo;

      return sort === "antiguos" ? -diff : diff;
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [clips, term, filters, sort]);

  /** Opciones vivas de cada desplegable, calculadas sobre el resto de filtros. */
  const facetOptions = useMemo(() => {
    const result = {} as Record<FacetKey, string[]>;

    for (const { key } of FACETS) {
      const values = new Set<string>();

      for (const clip of clips) {
        if (clip[key] && matches(clip, key)) values.add(clip[key]);
      }

      /* El valor elegido nunca desaparece de su propio desplegable. */
      if (filters[key]) values.add(filters[key]);

      result[key] = [...values].sort((a, b) => a.localeCompare(b, "es"));
    }

    return result;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [clips, term, filters]);

  /* ---------------- agrupación por jugador ---------------- */

  const players = useMemo(() => {
    const groups = new Map<
      string,
      {
        key: string;
        jugador: string;
        equipo: string;
        posicion: string;
        clips: Clip[];
      }
    >();

    for (const clip of filtered) {
      const key = `${clip.jugador}__${clip.equipo}`;

      const group =
        groups.get(key) ??
        {
          key,
          jugador: clip.jugador,
          equipo: clip.equipo,
          posicion: clip.posicion,
          clips: [],
        };

      group.clips.push(clip);
      groups.set(key, group);
    }

    return [...groups.values()].sort(
      (a, b) =>
        b.clips.length - a.clips.length ||
        a.jugador.localeCompare(b.jugador, "es")
    );
  }, [filtered]);

  const stats = useMemo(
    () => ({
      clips: filtered.length,
      jugadores: new Set(filtered.map((c) => `${c.jugador}__${c.equipo}`)).size,
      equipos: new Set(filtered.map((c) => c.equipo).filter(Boolean)).size,
      partidos: new Set(
        filtered.map((c) => `${c.rival}__${c.fecha}`).filter((k) => k !== "__")
      ).size,
    }),
    [filtered]
  );

  const activeFilters = FACETS.filter(({ key }) => filters[key]);

  const hasFilters = activeFilters.length > 0 || term.length > 0;

  const reset = () => {
    setFilters(EMPTY_FILTERS);
    setSearch("");
  };

  const setFacet = (key: FacetKey, value: string) =>
    setFilters((prev) => ({ ...prev, [key]: value }));

  const copyLinks = async () => {
    const links = filtered.map((c) => c.url).filter(Boolean);

    if (!links.length) {
      toast.error("No hay enlaces que copiar");
      return;
    }

    try {
      await navigator.clipboard.writeText(links.join("\n"));

      toast.success(
        `${links.length} ${links.length === 1 ? "enlace copiado" : "enlaces copiados"}`
      );
    } catch {
      toast.error("El navegador no ha permitido copiar");
    }
  };

  /* ------------------------------------------------------------------ */

  return (
    <div className="flex min-h-screen bg-[#0B0F14] text-white">
      <Sidebar />

      <main className="min-w-0 flex-1">
        <Topbar />

        <div className="p-6 md:p-10">
          {/* ---------------- cabecera ---------------- */}

          <header>
            <p className="text-xs uppercase tracking-[0.3em] text-[#C8A96B]">
              RMCF CASTILLA · SCOUTING
            </p>

            <h1 className="mt-2 text-3xl font-bold sm:text-4xl">
              Videoteca individual · Rivales
            </h1>

            <p className="mt-3 max-w-2xl text-white/60">
              Clips individuales de los jugadores rivales, ordenados y
              filtrables por equipo, posición y contenido analizado.
            </p>
          </header>

          {/* ---------------- resumen ---------------- */}

          <div className="mt-8 grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4">
            <StatCard icon={Film} label="Clips" value={stats.clips} />
            <StatCard icon={Users} label="Jugadores" value={stats.jugadores} />
            <StatCard icon={Shield} label="Equipos" value={stats.equipos} />
            <StatCard icon={Swords} label="Partidos" value={stats.partidos} />
          </div>

          {/* ---------------- filtros ---------------- */}

          <section className="mt-6 rounded-3xl border border-white/10 bg-white/[0.03] p-4 sm:p-5">
            <div className="flex flex-col gap-3 lg:flex-row lg:items-center">
              <div className="relative flex-1">
                <Search className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-white/35" />

                <input
                  type="search"
                  placeholder="Buscar jugador o equipo…"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="w-full rounded-xl border border-white/10 bg-white/[0.03] py-3 pl-11 pr-4 text-white outline-none transition focus:border-[#C8A96B]/50"
                />
              </div>

              <div className="flex flex-wrap items-center gap-2">
                <select
                  aria-label="Ordenar"
                  value={sort}
                  onChange={(e) => setSort(e.target.value as SortKey)}
                  className="rounded-xl border border-white/10 bg-[#111827] px-4 py-3 text-sm"
                >
                  {SORTS.map((s) => (
                    <option key={s.key} value={s.key}>
                      {s.label}
                    </option>
                  ))}
                </select>

                <div className="flex rounded-xl border border-white/10 bg-[#111827] p-1">
                  <ViewTab
                    active={view === "clips"}
                    icon={LayoutGrid}
                    label="Clips"
                    onClick={() => setView("clips")}
                  />

                  <ViewTab
                    active={view === "jugadores"}
                    icon={Users}
                    label="Jugadores"
                    onClick={() => setView("jugadores")}
                  />
                </div>

                <button
                  type="button"
                  onClick={copyLinks}
                  title="Copiar los enlaces de los clips filtrados"
                  className="flex items-center gap-2 rounded-xl border border-white/10 bg-[#111827] px-3.5 py-3 text-sm text-white/70 transition hover:border-[#C8A96B]/50 hover:text-white"
                >
                  <Copy className="h-4 w-4" />
                  <span className="hidden sm:inline">Copiar enlaces</span>
                </button>
              </div>
            </div>

            <div className="mt-3 grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
              {FACETS.map(({ key, label }) => (
                <select
                  key={key}
                  aria-label={label}
                  value={filters[key]}
                  onChange={(e) => setFacet(key, e.target.value)}
                  className={`min-w-0 rounded-xl border px-4 py-3 text-sm transition ${
                    filters[key]
                      ? "border-[#C8A96B]/50 bg-[#C8A96B]/10 text-white"
                      : "border-white/10 bg-[#111827] text-white/80"
                  }`}
                >
                  <option value="">{label}</option>

                  {facetOptions[key].map((value) => (
                    <option key={value} value={value}>
                      {value}
                    </option>
                  ))}
                </select>
              ))}
            </div>

            {hasFilters && (
              <div className="mt-3 flex flex-wrap items-center gap-2">
                {activeFilters.map(({ key }) => (
                  <button
                    key={key}
                    type="button"
                    onClick={() => setFacet(key, "")}
                    className="flex items-center gap-1.5 rounded-lg border border-[#C8A96B]/25 bg-[#C8A96B]/10 px-2.5 py-1 text-xs text-[#C8A96B] transition hover:bg-[#C8A96B]/20"
                  >
                    {filters[key]}
                    <span aria-hidden>×</span>
                  </button>
                ))}

                <button
                  type="button"
                  onClick={reset}
                  className="flex items-center gap-1.5 rounded-lg border border-white/10 px-2.5 py-1 text-xs text-white/55 transition hover:text-white"
                >
                  <RotateCcw className="h-3 w-3" />
                  Limpiar
                </button>
              </div>
            )}
          </section>

          {/* ---------------- contenido ---------------- */}

          {loading && (
            <div className="mt-6 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
              {Array.from({ length: 6 }).map((_, i) => (
                <div
                  key={i}
                  className="h-56 animate-pulse rounded-2xl border border-white/10 bg-white/[0.03]"
                />
              ))}
            </div>
          )}

          {!loading && error && (
            <EmptyState
              title="No se han podido cargar los clips"
              text="Revisa la conexión o que la hoja de cálculo siga publicada."
            />
          )}

          {!loading && !error && !filtered.length && (
            <EmptyState
              title="Ningún clip coincide con el filtro"
              text="Prueba a quitar alguna condición para ampliar la búsqueda."
              action={hasFilters ? reset : undefined}
            />
          )}

          {!loading && !error && filtered.length > 0 && view === "clips" && (
            <div className="mt-6 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
              {filtered.map((clip) => (
                <ClipCard key={clip.id} clip={clip} />
              ))}
            </div>
          )}

          {!loading && !error && filtered.length > 0 && view === "jugadores" && (
            <div className="mt-6 space-y-3">
              {players.map((player) => {
                const open = expanded === player.key;

                return (
                  <div
                    key={player.key}
                    className="overflow-hidden rounded-2xl border border-white/10 bg-white/[0.03]"
                  >
                    <button
                      type="button"
                      onClick={() => setExpanded(open ? null : player.key)}
                      className="flex w-full items-center gap-4 px-4 py-4 text-left transition hover:bg-white/[0.04] sm:px-5"
                    >
                      <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-[#C8A96B]/25 bg-[#C8A96B]/10 text-sm font-semibold text-[#C8A96B]">
                        {player.clips.length}
                      </span>

                      <span className="min-w-0 flex-1">
                        <span className="block truncate font-semibold">
                          {player.jugador}
                        </span>

                        <span className="block truncate text-sm text-white/50">
                          {[player.equipo, player.posicion]
                            .filter(Boolean)
                            .join(" · ") || "—"}
                        </span>
                      </span>

                      <ChevronDown
                        className={`h-4 w-4 shrink-0 text-white/40 transition ${
                          open ? "rotate-180" : ""
                        }`}
                      />
                    </button>

                    {open && (
                      <div className="border-t border-white/10 p-3 sm:p-4">
                        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
                          {player.clips.map((clip) => (
                            <ClipCard key={clip.id} clip={clip} compact />
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </main>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Piezas                                                              */
/* ------------------------------------------------------------------ */

function StatCard({
  icon: Icon,
  label,
  value,
}: {
  icon: typeof Film;
  label: string;
  value: number;
}) {
  return (
    <div className="rounded-2xl border border-white/10 bg-white/[0.03] px-4 py-3.5">
      <div className="flex items-center gap-2 text-xs uppercase tracking-wider text-white/40">
        <Icon className="h-3.5 w-3.5" style={{ color: GOLD }} />
        {label}
      </div>

      <p className="mt-1.5 text-2xl font-semibold">{value}</p>
    </div>
  );
}

function ViewTab({
  active,
  icon: Icon,
  label,
  onClick,
}: {
  active: boolean;
  icon: typeof Film;
  label: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`flex items-center gap-2 rounded-lg px-3 py-2 text-sm transition ${
        active
          ? "bg-[#C8A96B] font-medium text-black"
          : "text-white/60 hover:text-white"
      }`}
    >
      <Icon className="h-4 w-4" />
      <span className="hidden sm:inline">{label}</span>
    </button>
  );
}

function Chip({
  children,
  tone = "muted",
}: {
  children: React.ReactNode;
  tone?: "gold" | "muted";
}) {
  return (
    <span
      className={`rounded-lg px-2 py-1 text-[11px] leading-tight ${
        tone === "gold"
          ? "border border-[#C8A96B]/25 bg-[#C8A96B]/10 text-[#C8A96B]"
          : "border border-white/10 bg-white/[0.04] text-white/60"
      }`}
    >
      {children}
    </span>
  );
}

function ClipCard({ clip, compact }: { clip: Clip; compact?: boolean }) {
  const open = () => {
    if (clip.url) window.open(clip.url, "_blank", "noopener,noreferrer");
  };

  return (
    <article className="flex flex-col rounded-2xl border border-white/10 bg-white/[0.03] p-4 transition hover:border-[#C8A96B]/30 hover:bg-white/[0.05]">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h3 className="truncate text-lg font-semibold" title={clip.jugador}>
            {clip.jugador}
          </h3>

          <p className="truncate text-sm text-[#C8A96B]">
            {clip.equipo || "—"}
          </p>

          {clip.posicion && (
            <p className="truncate text-sm text-white/45">{clip.posicion}</p>
          )}
        </div>

        {clip.minuto && (
          <span className="shrink-0 rounded-lg border border-white/10 bg-white/[0.04] px-2 py-1 text-xs text-[#C8A96B]">
            {clip.minuto}&apos;
          </span>
        )}
      </div>

      {(clip.categoria || clip.subcategoria) && (
        <div className="mt-3 flex flex-wrap gap-1.5">
          {clip.categoria && <Chip tone="gold">{clip.categoria}</Chip>}
          {clip.subcategoria && <Chip>{clip.subcategoria}</Chip>}
        </div>
      )}

      {!compact && (
        <dl className="mt-3 space-y-1.5 text-sm">
          <Meta icon={Swords} label="Partido">
            {clip.rival || "—"}
          </Meta>

          <Meta icon={Clapperboard} label="Competición">
            {clip.competicion || "—"}
          </Meta>

          <Meta icon={CalendarDays} label="Fecha">
            {clip.fecha || "—"}
          </Meta>
        </dl>
      )}

      {compact && (clip.rival || clip.fecha) && (
        <p className="mt-3 truncate text-xs text-white/45">
          {[clip.rival, clip.fecha].filter(Boolean).join(" · ")}
        </p>
      )}

      <div className="mt-4 flex items-center justify-between gap-3 pt-1">
        {clip.resultado ? (
          <Chip tone="gold">{clip.resultado}</Chip>
        ) : (
          <span />
        )}

        <button
          type="button"
          onClick={open}
          disabled={!clip.url}
          className="flex items-center gap-1.5 rounded-xl bg-[#C8A96B] px-4 py-2 text-sm font-medium text-black transition hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-40"
        >
          <Play className="h-3.5 w-3.5 fill-current" />
          {clip.url ? "Ver clip" : "Sin enlace"}
        </button>
      </div>
    </article>
  );
}

function Meta({
  icon: Icon,
  label,
  children,
}: {
  icon: typeof Film;
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex items-start gap-2">
      <Icon className="mt-0.5 h-3.5 w-3.5 shrink-0 text-white/30" />

      <dt className="sr-only">{label}</dt>

      <dd className="min-w-0 flex-1 truncate text-white/70" title={label}>
        {children}
      </dd>
    </div>
  );
}

function EmptyState({
  title,
  text,
  action,
}: {
  title: string;
  text: string;
  action?: () => void;
}) {
  return (
    <div className="mt-8 rounded-3xl border border-white/10 bg-white/[0.02] px-6 py-16 text-center">
      <Film className="mx-auto h-8 w-8 text-white/20" />

      <p className="mt-4 text-lg font-medium">{title}</p>

      <p className="mt-1 text-sm text-white/50">{text}</p>

      {action && (
        <button
          type="button"
          onClick={action}
          className="mt-5 rounded-xl border border-white/10 px-4 py-2 text-sm text-white/70 transition hover:border-[#C8A96B]/50 hover:text-white"
        >
          Limpiar filtros
        </button>
      )}
    </div>
  );
}
