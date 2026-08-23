"use client";

/**
 * ABP del rival: qué hace y qué concede a balón parado.
 *
 * La página trabaja con dos orígenes y siempre dice cuál está enseñando:
 *
 * - El **scouting propio**, que se registra aquí mismo y se guarda en
 *   `app_documents`. Es la única vía para un rival de liga al que todavía no
 *   hemos jugado, y la única que trae sacador y rematador.
 * - Lo **deducido** de nuestras cuatro hojas de ABP, que sólo cubre los
 *   partidos contra el Castilla —hoy, únicamente la pretemporada—.
 *
 * Ver `lib/abp/rival.ts` y `lib/abp/rivalScout.ts`.
 */

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  ChevronDown,
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
import { RivalScoutEditor } from "@/components/abp/RivalScoutEditor";
import { useRemoteDoc } from "@/hooks/useRemoteDoc";
import { AbpFamily, FAMILY_LABEL, teamKey } from "@/lib/abp/model";
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
import {
  EMPTY_SCOUT_STORE,
  RivalScoutAction,
  RivalScoutStore,
  SCOUT_DOC_KEY,
  SCOUT_DOC_KIND,
  actionsOf,
  actionsToEvents,
  scoutKey,
} from "@/lib/abp/rivalScout";

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

type Grupo = "liga" | "pretemporada";

const GRUPOS: { key: Grupo; label: string }[] = [
  { key: "liga", label: "Liga" },
  { key: "pretemporada", label: "Pretemporada" },
];

type Origen = "todo" | "scout" | "derivado";

const ORIGENES: { key: Origen; label: string }[] = [
  { key: "todo", label: "Todo" },
  { key: "scout", label: "Scouting propio" },
  { key: "derivado", label: "Deducido" },
];

const TODOS = "Todas";

/** Última selección, para volver al rival de la semana sin buscarlo. */
const LAST_TEAM_KEY = "rmcf-abp-rival:equipo";

const pct = (value: number) => `${value.toFixed(0)}%`;

export default function ScoutRivalAbpPage() {
  const [derived, setDerived] = useState<AbpEvent[]>([]);
  const [equiposHoja, setEquiposHoja] = useState<string[]>([]);
  const [squad, setSquad] = useState<unknown>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [grupo, setGrupo] = useState<Grupo>("liga");
  const [side, setSide] = useState<AbpSide>("ofensivo");
  const [origen, setOrigen] = useState<Origen>("todo");
  const [jornada, setJornada] = useState(TODOS);
  const [familia, setFamilia] = useState(TODOS);

  /*
   * El rival elegido a mano. Se lee de `localStorage` en el primer render del
   * cliente y no rompe la hidratación porque la lista de equipos llega por
   * fetch: hasta que responde, no hay ninguno seleccionable ni en servidor ni
   * en cliente.
   */
  const [equipoElegido, setEquipoElegido] = useState<string | null>(() => {
    if (typeof window === "undefined") return null;

    try {
      return window.localStorage.getItem(LAST_TEAM_KEY);
    } catch {
      return null;
    }
  });

  /* --------------------------- scouting ---------------------------- */

  const scout = useRemoteDoc<RivalScoutStore>({
    key: SCOUT_DOC_KEY,
    kind: SCOUT_DOC_KIND,
    fallback: EMPTY_SCOUT_STORE,
  });

  const { setValue: setScout } = scout;

  /* ----------------------------- carga ----------------------------- */

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

        setDerived(dataset.events);
        setEquiposHoja(dataset.equipos);
        setSquad(squadResponse);
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

  /* ---------------------------- equipos ---------------------------- */

  /* Los rivales de liga salen de la hoja de plantillas, no de las hojas de
     ABP: si dependiera de ellas, un rival al que aún no hemos jugado no se
     podría ni seleccionar, que es justo lo que hay que poder hacer. */
  const equiposLiga = useMemo(() => {
    if (!Array.isArray(squad)) return [];

    const nombres = new Set<string>();

    squad.forEach((row) => {
      if (!row || typeof row !== "object") return;

      const nombre = String(
        (row as Record<string, unknown>).NOMBRE_EQUIPO ?? "",
      ).trim();

      if (nombre) nombres.add(nombre);
    });

    return [...nombres].sort((a, b) => a.localeCompare(b, "es"));
  }, [squad]);

  const clavesLiga = useMemo(
    () => new Set(equiposLiga.map(teamKey)),
    [equiposLiga],
  );

  /* Lo que aparece en las hojas de ABP y no es rival de liga es pretemporada:
     Albacete, Ferrol, Ponferradina… No son de la competición y no deben
     mezclarse con el análisis de la jornada. */
  const equiposPretemporada = useMemo(
    () => equiposHoja.filter((nombre) => !clavesLiga.has(teamKey(nombre))),
    [equiposHoja, clavesLiga],
  );

  const equiposVisibles = grupo === "liga" ? equiposLiga : equiposPretemporada;

  /* Cuántas acciones propias tiene cada equipo, para marcarlo en el selector. */
  const registradas = useMemo(() => {
    const counts = new Map<string, number>();

    Object.entries(scout.value?.teams ?? {}).forEach(([key, actions]) => {
      if (actions?.length) counts.set(key, actions.length);
    });

    return counts;
  }, [scout.value]);

  /* Rival efectivo: el elegido si sigue en la lista visible, si no el primero.
     Derivarlo evita tener que reajustarlo cada vez que cambia la lista. */
  const equipo = useMemo(() => {
    if (equipoElegido && equiposVisibles.includes(equipoElegido)) {
      return equipoElegido;
    }

    return equiposVisibles[0] ?? "";
  }, [equipoElegido, equiposVisibles]);

  const pickTeam = useCallback((nombre: string) => {
    setEquipoElegido(nombre);

    try {
      window.localStorage.setItem(LAST_TEAM_KEY, nombre);
    } catch {
      /* modo privado o cuota llena: la selección sólo dura la sesión */
    }
  }, []);

  /* Al cambiar de grupo no hace falta reelegir equipo: como `equipo` es
     derivado, cae solo en el primero del grupo nuevo y recupera el anterior
     al volver. */

  /** Sustituye las acciones del rival seleccionado dentro del almacén. */
  const updateActions = useCallback(
    (next: RivalScoutAction[]) => {
      if (!equipo) return;

      setScout((current) => ({
        ...current,
        teams: { ...(current?.teams ?? {}), [scoutKey(equipo)]: next },
      }));
    },
    [equipo, setScout],
  );

  /* --------------------------- selección --------------------------- */

  const acciones = useMemo(
    () => actionsOf(scout.value, equipo),
    [scout.value, equipo],
  );

  const eventosScout = useMemo(
    () => actionsToEvents(equipo, acciones),
    [equipo, acciones],
  );

  const eventosDerivados = useMemo(
    () =>
      equipo
        ? derived.filter((event) => teamKey(event.equipo) === teamKey(equipo))
        : [],
    [derived, equipo],
  );

  const hayScout = eventosScout.length > 0;
  const hayDerivado = eventosDerivados.length > 0;
  const dobleOrigen = hayScout && hayDerivado;

  /* Con un solo origen no hay nada que elegir: el conmutador sólo aparece
     cuando de verdad conviven las dos fuentes. */
  const origenActivo: Origen = dobleOrigen ? origen : "todo";

  const delEquipo = useMemo(() => {
    if (origenActivo === "scout") return eventosScout;
    if (origenActivo === "derivado") return eventosDerivados;

    return [...eventosScout, ...eventosDerivados];
  }, [origenActivo, eventosScout, eventosDerivados]);

  const jornadas = useMemo(
    () => [
      TODOS,
      ...[...new Set(delEquipo.map((event) => event.jornada).filter(Boolean))].sort(
        (a, b) => a.localeCompare(b, "es", { numeric: true }),
      ),
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

  /* Un filtro que no existe en el rival recién elegido dejaría la página en
     blanco sin explicar por qué. En vez de reajustar el estado, se ignora:
     vale «Todas» hasta que se vuelva a elegir algo que sí está. */
  const jornadaActiva = jornadas.includes(jornada) ? jornada : TODOS;

  const familiaActiva = familiasPresentes.includes(familia) ? familia : TODOS;

  const filtered = useMemo(
    () =>
      delEquipo.filter((event) => {
        if (event.side !== side) return false;
        if (jornadaActiva !== TODOS && event.jornada !== jornadaActiva) {
          return false;
        }
        if (
          familiaActiva !== TODOS &&
          FAMILY_LABEL[event.family] !== familiaActiva
        ) {
          return false;
        }
        return true;
      }),
    [delEquipo, side, jornadaActiva, familiaActiva],
  );

  const activeFilters =
    (jornadaActiva !== TODOS ? 1 : 0) + (familiaActiva !== TODOS ? 1 : 0);

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

  const nombresPlantilla = useMemo(
    () => aereos.map((player) => player.nombre),
    [aereos],
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

  const sinEquipos =
    !loading &&
    !error &&
    equiposLiga.length === 0 &&
    equiposPretemporada.length === 0;

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
              equipo ? (
                <SourceBadge tone={hayScout ? "scout" : "derivado"}>
                  {hayScout
                    ? "Scouting propio"
                    : hayDerivado
                      ? "Deducido"
                      : "Sin datos"}
                </SourceBadge>
              ) : undefined
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
          ) : sinEquipos ? (
            <div className="mt-8">
              <EmptyState
                title="No hay rivales cargados"
                description="La hoja de plantillas rivales no ha devuelto ningún equipo, así que no se puede elegir a quién analizar."
              />
            </div>
          ) : (
            <div className="mt-6 space-y-5">
              {/* ---------------- selección de rival ---------------- */}

              <div className="space-y-3">
                <div className="flex flex-wrap items-center gap-3">
                  <Segmented
                    options={GRUPOS}
                    value={grupo}
                    onChange={setGrupo}
                    ariaLabel="Competición"
                  />

                  <span className="text-[11px] text-white/35">
                    {grupo === "liga"
                      ? `${equiposLiga.length} rivales de Primera RFEF`
                      : "Amistosos de pretemporada, fuera de la competición"}
                  </span>
                </div>

                {equiposVisibles.length === 0 ? (
                  <EmptyState title="No hay equipos en esta lista" />
                ) : (
                  <TeamPickerConDatos
                    teams={equiposVisibles}
                    value={equipo}
                    onChange={pickTeam}
                    counts={registradas}
                  />
                )}

                <div className="flex flex-wrap items-center gap-3">
                  <Segmented
                    options={SIDES}
                    value={side}
                    onChange={setSide}
                    ariaLabel="Lado del balón parado"
                  />

                  {dobleOrigen && (
                    <Segmented
                      options={ORIGENES}
                      value={origenActivo}
                      onChange={setOrigen}
                      ariaLabel="Origen del dato"
                    />
                  )}

                  <span className="text-[11px] text-white/35">
                    {filtered.length} acciones ·{" "}
                    {side === "ofensivo"
                      ? "lo que genera el rival"
                      : "lo que le generan al rival"}
                  </span>
                </div>
              </div>

              {delEquipo.length > 0 && (
                <FilterDrawer
                  activeCount={activeFilters}
                  summary={`${jornadas.length - 1} ${jornadas.length === 2 ? "jornada" : "jornadas"} con datos`}
                >
                  <Select
                    label="Jornada"
                    value={jornadaActiva}
                    options={jornadas}
                    onChange={setJornada}
                  />

                  <Select
                    label="Tipo de acción"
                    value={familiaActiva}
                    options={familiasPresentes}
                    onChange={setFamilia}
                  />
                </FilterDrawer>
              )}

              {/* ------------------- aviso de origen ---------------- */}

              {!hayScout && hayDerivado && (
                <Notice
                  tone="warn"
                  title="Datos deducidos de los partidos contra el Castilla"
                >
                  De este equipo no hay scouting propio, así que lo que se ve
                  sale de nuestras propias hojas: su ataque es lo que
                  registramos defendiendo y su defensa lo que registramos
                  atacando. Cubre sólo los partidos frente a nosotros y no trae
                  nombres de lanzador ni de rematador. Regístralos abajo y esta
                  página pasa a leer de ahí.
                </Notice>
              )}

              {/* ---------------------- totales --------------------- */}

              {delEquipo.length === 0 ? (
                <EmptyState
                  title={`Todavía no hay ABP registrado del ${equipo}`}
                  description="Las hojas de ABP sólo tienen los partidos del Castilla, y contra este rival aún no hemos jugado. Empieza registrando sus acciones abajo: en cuanto haya una, se llenan los totales, la tabla por tipo y los rankings."
                />
              ) : (
                <>
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
                            <th className="px-4 py-2.5 font-medium sm:px-5">
                              Acción
                            </th>
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

                            return (
                              <tr
                                key={family}
                                className="border-b border-white/[0.06] last:border-0"
                              >
                                <td className="px-4 py-3 font-medium text-white/85 sm:px-5">
                                  {FAMILY_LABEL[family]}
                                </td>

                                {sinDatos ? (
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
                                      {/* La barra mide el propio porcentaje, no
                                          el volumen: si midiera volumen, el
                                          saque de banda saldría el más largo
                                          con 0 % de peligro y se leería al
                                          revés. */}
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
                                max={Math.max(
                                  1,
                                  ...zonas.map((z) => z.acciones),
                                )}
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
                          description="Anota el sacador al registrar cada acción, o etiqueta a sus lanzadores en la ficha de plantilla."
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
                          description="Anota el rematador al registrar cada acción, o etiqueta «Rematador de ABP» en su ficha."
                        />
                      )}
                    </Panel>
                  </div>
                </>
              )}

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

              {/* ------------------ registro editable --------------- */}

              {equipo && (
                <RivalScoutEditor
                  equipo={equipo}
                  actions={acciones}
                  onChange={updateActions}
                  status={scout.status}
                  localOnly={scout.localOnly}
                  savedAt={scout.lastSavedAt}
                  squadNames={nombresPlantilla}
                />
              )}

              {/* --------------- contrato de la hoja ---------------- */}

              <ScoutSheetContract />
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

/** `TeamPicker` con el número de acciones propias ya registradas. */
function TeamPickerConDatos({
  teams,
  value,
  onChange,
  counts,
}: {
  teams: string[];
  value: string;
  onChange: (team: string) => void;
  counts: Map<string, number>;
}) {
  const conDatos = teams.some((team) => counts.get(scoutKey(team)));

  if (!conDatos) {
    return <TeamPicker teams={teams} value={value} onChange={onChange} />;
  }

  return (
    <div className="flex min-w-0 gap-2 overflow-x-auto pb-1 scrollbar-none">
      {teams.map((team) => {
        const active = team === value;
        const registradas = counts.get(scoutKey(team)) ?? 0;

        return (
          <button
            key={team}
            type="button"
            onClick={() => onChange(team)}
            aria-pressed={active}
            className={`flex shrink-0 items-center gap-2 rounded-full border px-3.5 py-1.5 text-xs font-medium transition ${
              active
                ? "border-[#C8A96B] bg-[#C8A96B]/15 text-[#C8A96B]"
                : "border-white/10 text-white/55 hover:border-white/25 hover:text-white"
            }`}
          >
            {team}

            {registradas > 0 && (
              <span
                title={`${registradas} acciones registradas`}
                className={`rounded-full px-1.5 text-[10px] tabular-nums ${
                  active
                    ? "bg-[#C8A96B]/25 text-[#C8A96B]"
                    : "bg-emerald-400/15 text-emerald-300"
                }`}
              >
                {registradas}
              </span>
            )}
          </button>
        );
      })}
    </div>
  );
}

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

/**
 * Contrato de columnas, plegado.
 *
 * Ya no hace falta para usar la página —el registro se hace aquí—, pero sigue
 * siendo la referencia de qué significa cada campo y qué cabeceras lleva el CSV
 * que exporta el editor.
 */
function ScoutSheetContract() {
  const [open, setOpen] = useState(false);

  return (
    <Panel
      title="Qué significa cada campo"
      subtitle="Mismas columnas que el CSV que exporta el registro"
      action={
        <button
          type="button"
          onClick={() => setOpen((current) => !current)}
          aria-expanded={open}
          className="inline-flex items-center gap-1.5 rounded-xl border border-white/12 px-3 py-1.5 text-xs font-medium text-white/70 transition hover:border-white/25 hover:text-white"
        >
          {open ? "Ocultar" : "Ver"}
          <ChevronDown
            size={13}
            className={`transition-transform ${open ? "rotate-180" : ""}`}
          />
        </button>
      }
      bodyClassName={open ? "p-0" : "hidden"}
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
