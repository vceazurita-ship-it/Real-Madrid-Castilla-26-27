"use client";

/**
 * ABP del rival: qué hace y qué concede a balón parado.
 *
 * La página trabaja con dos orígenes y siempre dice cuál está enseñando. Ver
 * `lib/abp/rival.ts` para la diferencia entre el dato observado y el deducido.
 */

import { useEffect, useMemo, useState } from "react";
import {
  CornerDownRight,
  Flag,
  Ruler,
  Target,
  Users,
} from "lucide-react";

import { Sidebar } from "@/components/ui/sidebar";
import { Topbar } from "@/components/ui/topbar";
import {
  AbpHeader,
  EmptyState,
  FilterDrawer,
  Meter,
  Notice,
  Panel,
  Segmented,
  Select,
  SourceBadge,
  StatCard,
  StatRow,
  TeamPicker,
} from "@/components/abp/ui";
import { AbpFamily, FAMILY_LABEL } from "@/lib/abp/model";
import { RIVAL_SCOUT_COLUMNS } from "@/lib/abp/sheets";
import {
  AbpEvent,
  AbpSide,
  RivalPlayerAerial,
  bandaByZone,
  buildAerialThreats,
  loadRivalAbp,
  rankPeople,
  statsByFamily,
} from "@/lib/abp/rival";

const SIDES: { key: AbpSide; label: string }[] = [
  { key: "ofensivo", label: "Su ataque" },
  { key: "defensivo", label: "Su defensa" },
];

/* El orden en que el cuerpo técnico repasa el balón parado. */
const FAMILY_ORDER: AbpFamily[] = [
  "corner",
  "falta-lateral",
  "falta-directa",
  "penalti",
  "banda",
  "saque-medio",
  "saque-meta",
];

const TODOS = "Todas";

const pct = (value: number) => `${value.toFixed(0)}%`;

export default function ScoutRivalAbpPage() {
  const [events, setEvents] = useState<AbpEvent[]>([]);
  const [equipos, setEquipos] = useState<string[]>([]);
  const [hasScout, setHasScout] = useState(false);
  const [squad, setSquad] = useState<unknown>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [equipo, setEquipo] = useState("");
  const [side, setSide] = useState<AbpSide>("ofensivo");
  const [jornada, setJornada] = useState(TODOS);
  const [familia, setFamilia] = useState(TODOS);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      try {
        const [dataset, squadResponse] = await Promise.all([
          loadRivalAbp(),
          fetch("/api/rivals?action=rivalesPlantillas", { cache: "no-store" })
            .then((response) => response.json())
            .catch(() => []),
        ]);

        if (cancelled) return;

        setEvents(dataset.events);
        setEquipos(dataset.equipos);
        setHasScout(dataset.hasScout);
        setSquad(squadResponse);
        setEquipo((current) => current || dataset.equipos[0] || "");
      } catch (caught) {
        if (cancelled) return;

        console.error("[scout-rival-abp]", caught);
        setError("No se pudieron cargar las hojas de ABP.");
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    void load();

    return () => {
      cancelled = true;
    };
  }, []);

  /* --------------------------- selección --------------------------- */

  const delEquipo = useMemo(
    () => events.filter((event) => event.equipo === equipo),
    [events, equipo],
  );

  const jornadas = useMemo(
    () => [
      TODOS,
      ...[...new Set(delEquipo.map((event) => event.jornada).filter(Boolean))].sort(),
    ],
    [delEquipo],
  );

  const familiasPresentes = useMemo(
    () => [
      TODOS,
      ...FAMILY_ORDER.filter((family) =>
        delEquipo.some((event) => event.family === family),
      ).map((family) => FAMILY_LABEL[family]),
    ],
    [delEquipo],
  );

  const filtered = useMemo(
    () =>
      delEquipo.filter((event) => {
        if (event.side !== side) return false;
        if (jornada !== TODOS && event.jornada !== jornada) return false;
        if (familia !== TODOS && FAMILY_LABEL[event.family] !== familia) {
          return false;
        }
        return true;
      }),
    [delEquipo, side, jornada, familia],
  );

  const activeFilters =
    (jornada !== TODOS ? 1 : 0) + (familia !== TODOS ? 1 : 0);

  /* --------------------------- agregados --------------------------- */

  const familyStats = useMemo(() => statsByFamily(filtered), [filtered]);

  const statsPorFamilia = useMemo(
    () => new Map(familyStats.map((stat) => [stat.family, stat])),
    [familyStats],
  );

  const zonas = useMemo(() => bandaByZone(filtered), [filtered]);

  const sacadores = useMemo(() => rankPeople(filtered, "sacador"), [filtered]);
  const rematadores = useMemo(
    () => rankPeople(filtered, "rematador"),
    [filtered],
  );

  const aereos: RivalPlayerAerial[] = useMemo(
    () => buildAerialThreats(squad, delEquipo, equipo),
    [squad, delEquipo, equipo],
  );

  const alturaMedia = useMemo(() => {
    const valores = aereos
      .map((player) => player.altura)
      .filter((value): value is number => value != null);

    if (!valores.length) return null;

    return Math.round(
      valores.reduce((total, value) => total + value, 0) / valores.length,
    );
  }, [aereos]);

  const totales = useMemo(() => {
    const remates = filtered.filter((event) => event.remate).length;
    const peligro = filtered.filter((event) => event.peligro).length;

    return {
      acciones: filtered.length,
      remates,
      goles: filtered.filter(
        (event) => event.peligro && event.result.rank === 5,
      ).length,
      xg: filtered.reduce((total, event) => total + event.xg, 0),
      peligroPct: filtered.length ? (peligro / filtered.length) * 100 : 0,
    };
  }, [filtered]);

  const etiquetados = useMemo(
    () => ({
      rematan: aereos.filter((player) => player.remataAbp),
      sacan: aereos.filter((player) => player.sacaAbp),
    }),
    [aereos],
  );

  /* ----------------------------- render ---------------------------- */

  return (
    <div className="flex min-h-screen bg-[#0B0F14] text-white">
      <Sidebar />

      <main className="min-w-0 flex-1">
        <Topbar />

        <div className="mx-auto min-w-0 max-w-[1500px] px-4 py-6 md:px-8 md:py-8">
          <AbpHeader
            area="RMCF Castilla · Rival"
            title="ABP del Rival"
            lead="Cómo ataca y cómo defiende el rival a balón parado: córners, faltas, penaltis y saques de banda por zona, con sus lanzadores, sus rematadores y la estatura que meten al área."
            aside={
              <SourceBadge tone={hasScout ? "scout" : "derivado"}>
                {hasScout ? "Scouting propio" : "Deducido"}
              </SourceBadge>
            }
          />

          {loading ? (
            <p className="mt-10 text-sm text-white/45">Cargando datos de ABP…</p>
          ) : error ? (
            <div className="mt-8">
              <Notice tone="warn" title={error}>
                Revisa que las hojas sigan publicadas en Google Sheets.
              </Notice>
            </div>
          ) : equipos.length === 0 ? (
            <div className="mt-8">
              <EmptyState
                title="Todavía no hay acciones registradas"
                description="Ni la hoja de scouting de ABP rival ni las hojas de córners y saques de banda tienen filas utilizables."
              />
            </div>
          ) : (
            <div className="mt-6 space-y-5">
              {/* ---------------- selección de rival ---------------- */}

              <div className="space-y-3">
                <TeamPicker teams={equipos} value={equipo} onChange={setEquipo} />

                <div className="flex flex-wrap items-center gap-3">
                  <Segmented
                    options={SIDES}
                    value={side}
                    onChange={setSide}
                    ariaLabel="Lado del balón parado"
                  />

                  <span className="text-[11px] text-white/35">
                    {filtered.length} acciones ·{" "}
                    {side === "ofensivo"
                      ? "lo que genera el rival"
                      : "lo que le generan al rival"}
                  </span>
                </div>
              </div>

              <FilterDrawer
                activeCount={activeFilters}
                summary={`${jornadas.length - 1} ${jornadas.length === 2 ? "jornada" : "jornadas"} con datos`}
              >
                <Select
                  label="Jornada"
                  value={jornada}
                  options={jornadas}
                  onChange={setJornada}
                />

                <Select
                  label="Tipo de acción"
                  value={familia}
                  options={familiasPresentes}
                  onChange={setFamilia}
                />
              </FilterDrawer>

              {!hasScout && (
                <Notice
                  tone="warn"
                  title="Datos deducidos de los partidos contra el Castilla"
                >
                  La hoja de scouting de ABP rival todavía no existe, así que
                  esto sale de nuestras propias hojas: su ataque es lo que
                  registramos defendiendo y su defensa lo que registramos
                  atacando. Cubre sólo los partidos frente a nosotros y no trae
                  nombres de lanzador ni de rematador. Para completarlo, crea la
                  hoja con las columnas de más abajo y pega su <code>gid</code>{" "}
                  en <code>RIVAL_SCOUT_GID</code>.
                </Notice>
              )}

              {/* ---------------------- totales --------------------- */}

              <StatRow>
                <StatCard
                  label="Acciones"
                  value={totales.acciones}
                  hint={side === "ofensivo" ? "Ejecutadas" : "Defendidas"}
                />
                <StatCard
                  label="Remates"
                  value={totales.remates}
                  hint={
                    totales.acciones
                      ? `${pct((totales.remates / totales.acciones) * 100)} de las acciones`
                      : undefined
                  }
                />
                <StatCard
                  label="xG"
                  value={totales.xg.toFixed(2)}
                  hint="Acumulado"
                />
                <StatCard
                  label="Goles"
                  value={totales.goles}
                  accent={
                    totales.goles > 0 ? "var(--rmcf-rate-low)" : undefined
                  }
                />
                <StatCard
                  label="Peligro"
                  value={pct(totales.peligroPct)}
                  hint="Acaba en gol u ocasión"
                  accent="var(--rmcf-gold-ink)"
                />
              </StatRow>

              {/* ------------- amenaza por tipo de ABP -------------- */}

              <Panel
                title="Amenaza por tipo de balón parado"
                subtitle="Volumen, remate y cuántas acaban en gol u ocasión"
                icon={Target}
                bodyClassName="p-0"
              >
                <div className="overflow-x-auto">
                  <table className="w-full min-w-[640px] border-collapse text-sm">
                    <thead>
                      <tr className="border-b border-white/10 text-left text-[10px] uppercase tracking-[0.16em] text-white/40">
                        <th className="px-4 py-2.5 font-medium sm:px-5">Acción</th>
                        <th className="px-4 py-2.5 font-medium">Acciones</th>
                        <th className="px-4 py-2.5 font-medium">Remates</th>
                        <th className="px-4 py-2.5 font-medium">xG</th>
                        <th className="px-4 py-2.5 font-medium">Goles</th>
                        <th className="w-[180px] px-4 py-2.5 font-medium sm:px-5">
                          Peligro
                        </th>
                      </tr>
                    </thead>

                    <tbody>
                      {FAMILY_ORDER.map((family) => {
                        const stat = statsPorFamilia.get(family);
                        const sinDatos = !stat || stat.acciones === 0;

                        /* Saque de medio y de meta no los registra ninguna
                           hoja todavía: se listan igual para que se vea que
                           faltan, no para fingir un cero real. */
                        const noRegistrado =
                          sinDatos &&
                          (family === "saque-medio" || family === "saque-meta");

                        return (
                          <tr
                            key={family}
                            className="border-b border-white/[0.06] last:border-0"
                          >
                            <td className="px-4 py-3 font-medium text-white/85 sm:px-5">
                              {FAMILY_LABEL[family]}
                            </td>

                            {noRegistrado ? (
                              <td
                                colSpan={5}
                                className="px-4 py-3 text-[12px] italic text-white/30"
                              >
                                Sin columna en las hojas actuales
                              </td>
                            ) : sinDatos ? (
                              <td
                                colSpan={5}
                                className="px-4 py-3 text-[12px] text-white/30"
                              >
                                Sin registros
                              </td>
                            ) : (
                              <>
                                <td className="px-4 py-3 tabular-nums text-white/70">
                                  {stat.acciones}
                                </td>
                                <td className="px-4 py-3 tabular-nums text-white/70">
                                  {stat.remates}
                                </td>
                                <td className="px-4 py-3 tabular-nums text-white/70">
                                  {stat.xg.toFixed(2)}
                                </td>
                                <td className="px-4 py-3 tabular-nums text-white/70">
                                  {stat.goles}
                                </td>
                                <td className="px-4 py-3 sm:px-5">
                                  {/* La barra mide el propio porcentaje, no el
                                      volumen: si midiera volumen, el saque de
                                      banda saldría el más largo con 0 % de
                                      peligro y se leería al revés. */}
                                  <span className="flex items-center gap-2.5">
                                    <Meter
                                      value={stat.peligroPct}
                                      max={100}
                                      color={
                                        stat.peligroPct >= 25
                                          ? "var(--rmcf-rate-low)"
                                          : "var(--rmcf-gold-ink)"
                                      }
                                      label={`${pct(stat.peligroPct)} de peligro`}
                                    />
                                    <span className="w-10 shrink-0 text-right text-[11px] tabular-nums text-white/55">
                                      {pct(stat.peligroPct)}
                                    </span>
                                  </span>
                                </td>
                              </>
                            )}
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </Panel>

              {/* --------------- saque de banda por zona ------------ */}

              <Panel
                title="Saque de banda por zona"
                subtitle="Zona 1 tercio propio · Zona 2 medio · Zona 3 último tercio"
                icon={CornerDownRight}
              >
                {zonas.every((zone) => zone.acciones === 0) ? (
                  <EmptyState title="Sin saques de banda registrados para esta selección" />
                ) : (
                  <div className="grid gap-3 sm:grid-cols-3">
                    {zonas.map((zone) => (
                      <div
                        key={zone.zona}
                        className="rounded-xl border border-white/10 bg-white/[0.03] px-4 py-3.5"
                      >
                        <p className="text-[10px] uppercase tracking-[0.18em] text-white/40">
                          Zona {zone.zona}
                        </p>

                        <p className="mt-1.5 text-2xl font-semibold tabular-nums text-white">
                          {zone.acciones}
                        </p>

                        <p className="mt-0.5 text-[11px] text-white/35">
                          {pct(zone.peligroPct)} acaba en peligro
                        </p>

                        <div className="mt-2.5">
                          <Meter
                            value={zone.acciones}
                            max={Math.max(1, ...zonas.map((z) => z.acciones))}
                            label={`${zone.acciones} saques`}
                          />
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </Panel>

              {/* ------------- lanzadores y rematadores ------------- */}

              <div className="grid gap-5 xl:grid-cols-2">
                <Panel
                  title="Lanzadores"
                  subtitle="Quién ejecuta el balón parado"
                  icon={Flag}
                >
                  {sacadores.length > 0 ? (
                    <PeopleList people={sacadores} />
                  ) : etiquetados.sacan.length > 0 ? (
                    <TaggedList
                      players={etiquetados.sacan}
                      note="Del scouting de plantilla, no de las acciones registradas."
                    />
                  ) : (
                    <EmptyState
                      title="Sin lanzadores identificados"
                      description="Las hojas actuales no guardan el nombre del sacador rival. Etiqueta a sus lanzadores en la ficha de plantilla o completa la hoja de scouting."
                    />
                  )}
                </Panel>

                <Panel
                  title="Rematadores"
                  subtitle="Quién ataca el balón"
                  icon={Users}
                >
                  {rematadores.length > 0 ? (
                    <PeopleList people={rematadores} />
                  ) : etiquetados.rematan.length > 0 ? (
                    <TaggedList
                      players={etiquetados.rematan}
                      note="Del scouting de plantilla, no de las acciones registradas."
                    />
                  ) : (
                    <EmptyState
                      title="Sin rematadores identificados"
                      description="Las hojas actuales no guardan el nombre del rematador rival. Etiqueta «Rematador de ABP» en su ficha o completa la hoja de scouting."
                    />
                  )}
                </Panel>
              </div>

              {/* -------------------- estaturas --------------------- */}

              <Panel
                title="Amenaza aérea"
                subtitle={
                  alturaMedia
                    ? `Altura media de la plantilla: ${alturaMedia} cm`
                    : "Estatura de la plantilla rival"
                }
                icon={Ruler}
              >
                {aereos.length === 0 ? (
                  <EmptyState
                    title={`No hay plantilla cargada para ${equipo}`}
                    description="La hoja de plantillas rivales aún no incluye este equipo, así que no se pueden cruzar las estaturas con sus acciones de ABP."
                  />
                ) : (
                  <AerialList players={aereos} />
                )}
              </Panel>

              {/* --------------- contrato de la hoja ---------------- */}

              {!hasScout && <ScoutSheetContract />}
            </div>
          )}
        </div>
      </main>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  SUBCOMPONENTES                                                     */
/* ------------------------------------------------------------------ */

function PeopleList({
  people,
}: {
  people: { nombre: string; acciones: number; remates: number; peligro: number; xg: number }[];
}) {
  const max = Math.max(1, ...people.map((person) => person.acciones));

  return (
    <ul className="space-y-2.5">
      {people.slice(0, 8).map((person) => (
        <li key={person.nombre} className="flex items-center gap-3">
          <span className="w-28 shrink-0 truncate text-sm text-white/85 sm:w-36">
            {person.nombre}
          </span>

          <Meter value={person.acciones} max={max} />

          <span className="w-24 shrink-0 text-right text-[11px] tabular-nums text-white/45">
            {person.acciones} · {person.peligro} pel.
          </span>
        </li>
      ))}
    </ul>
  );
}

function TaggedList({
  players,
  note,
}: {
  players: RivalPlayerAerial[];
  note: string;
}) {
  return (
    <div>
      <ul className="flex flex-wrap gap-2">
        {players.map((player) => (
          <li
            key={player.id}
            className="flex items-center gap-2 rounded-full border border-[#C8A96B]/40 bg-[#C8A96B]/10 px-3 py-1.5 text-xs"
          >
            {player.dorsal && (
              <span className="tabular-nums text-[#C8A96B]">{player.dorsal}</span>
            )}
            <span className="text-white/85">{player.nombre}</span>
            {player.altura && (
              <span className="tabular-nums text-white/45">{player.altura} cm</span>
            )}
          </li>
        ))}
      </ul>

      <p className="mt-3 text-[11px] text-white/35">{note}</p>
    </div>
  );
}

function AerialList({ players }: { players: RivalPlayerAerial[] }) {
  const conAltura = players.filter((player) => player.altura != null);
  const max = Math.max(1, ...conAltura.map((player) => player.altura ?? 0));
  const min = Math.min(...conAltura.map((player) => player.altura ?? 0), max);

  return (
    <ul className="space-y-2">
      {players.slice(0, 12).map((player) => {
        const altura = player.altura;

        /* La barra compara dentro de la propia plantilla: con un origen en
           cero, 175 y 195 cm se verían casi iguales. */
        const ratio =
          altura != null && max > min ? ((altura - min) / (max - min)) * 100 : 0;

        return (
          <li key={player.id} className="flex items-center gap-3">
            <span className="w-6 shrink-0 text-right text-[11px] tabular-nums text-white/35">
              {player.dorsal}
            </span>

            <span className="w-28 shrink-0 truncate text-sm text-white/85 sm:w-40">
              {player.nombre}
            </span>

            <span className="hidden w-24 shrink-0 truncate text-[11px] text-white/35 sm:block">
              {player.posicion}
            </span>

            <span className="flex h-1.5 w-full min-w-[48px] overflow-hidden rounded-full bg-white/[0.08]">
              <span
                className="h-full rounded-full bg-[#C8A96B] transition-[width] duration-500"
                style={{ width: `${Math.max(4, ratio)}%` }}
              />
            </span>

            <span className="w-14 shrink-0 text-right text-[11px] tabular-nums text-white/55">
              {altura != null ? `${altura} cm` : "—"}
            </span>

            {player.remataAbp && (
              <span className="hidden shrink-0 rounded-full border border-[#C8A96B]/40 px-2 py-0.5 text-[9px] font-semibold uppercase tracking-wider text-[#C8A96B] sm:inline">
                Remata
              </span>
            )}
          </li>
        );
      })}
    </ul>
  );
}

/** Qué columnas tiene que llevar la hoja de scouting cuando se cree. */
function ScoutSheetContract() {
  return (
    <Panel
      title="Cómo completar esta página"
      subtitle="Columnas que espera la hoja de scouting de ABP rival"
      bodyClassName="p-0"
    >
      <div className="overflow-x-auto">
        <table className="w-full min-w-[560px] border-collapse text-sm">
          <tbody>
            {RIVAL_SCOUT_COLUMNS.map((column) => (
              <tr
                key={column.name}
                className="border-b border-white/[0.06] last:border-0"
              >
                <td className="w-44 px-4 py-2 font-mono text-[12px] text-[#C8A96B] sm:px-5">
                  {column.name}
                </td>
                <td className="px-4 py-2 text-[12px] text-white/50">
                  {column.hint}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </Panel>
  );
}
