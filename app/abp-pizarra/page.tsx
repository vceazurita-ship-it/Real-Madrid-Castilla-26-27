"use client";

/**
 * Pizarra de balón parado: el PowerPoint del partido, vivo.
 *
 * Sustituye a montar a mano `RMCF CASTILLA - LIG.01 CD TERUEL.pptx` cada
 * semana. Un tablero por partido, con las siete diapositivas de siempre —se
 * pueden quitar, duplicar, reordenar y añadir—, las caras de la plantilla
 * colocadas sobre el campo en perspectiva y el panel de puestos a la derecha.
 *
 * Tres cosas que el pptx no podía hacer:
 *
 * 1. **Copiar el partido anterior.** De una semana a la siguiente cambian
 *    cuatro nombres, no las siete diapositivas.
 * 2. **Aprender los puestos.** Cada vez que alguien se coloca en un puesto
 *    queda anotado; los habituales salen los primeros al elegir.
 * 3. **Colocar automáticamente.** Rellena los puestos vacíos —de una
 *    diapositiva o de todas— con lo aprendido, por prioridad y sin repetir a
 *    nadie dentro de la misma.
 *
 * El modelo y las medidas viven en `lib/abp/pizarra.ts` (sacadas del propio
 * pptx); el dibujo, en `components/abp/pizarra/TableroSlide.tsx`.
 */

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  ChevronLeft,
  ChevronRight,
  Copy,
  CopyPlus,
  LayoutGrid,
  Plus,
  Trash2,
  Wand2,
} from "lucide-react";
import { toast } from "sonner";

import { Sidebar } from "@/components/ui/sidebar";
import { Topbar } from "@/components/ui/topbar";
import {
  AbpHeader,
  Button,
  EmptyState,
  Notice,
  Panel,
  SaveState,
} from "@/components/abp/ui";
import { TableroSlide } from "@/components/abp/pizarra/TableroSlide";
import { SelectorJugador } from "@/components/abp/pizarra/SelectorJugador";
import { useRemoteDoc } from "@/hooks/useRemoteDoc";
import { usePlayers } from "@/hooks/usePlayers";
import {
  compareMatches,
  fetchMatches,
  formatMatchDate,
  matchLabel,
} from "@/lib/ratings/matches";
import { RATINGS_SEASON, type MatchMeta } from "@/lib/ratings/types";
import {
  EMPTY_PIZARRA_STORE,
  PLANTILLAS,
  PLANTILLA_BY_KEY,
  aprende,
  colocaAutomatico,
  copiaTablero,
  cuentaPuestos,
  fichaNueva,
  puestoDe,
  slideDePlantilla,
  tableroVacio,
  type PizarraStore,
  type SlidePizarra,
  type TableroPizarra,
} from "@/lib/abp/pizarra";
import { barlowCondensed } from "@/lib/rivals/portada-font";

/* "2026-2027" → "26 / 27", que es como lo escribe la plantilla. */
function temporadaCorta(season: string) {
  const [desde, hasta] = season.split("-");

  return `${desde?.slice(2) ?? ""} / ${hasta?.slice(2) ?? ""}`;
}

export default function PizarraAbpPage() {
  const { players } = usePlayers();

  const {
    value: store,
    setValue: setStore,
    status,
    localOnly,
    lastSavedAt,
  } = useRemoteDoc<PizarraStore>({
    key: "abp-pizarra",
    kind: "abp",
    fallback: EMPTY_PIZARRA_STORE,
  });

  /* --------------------------- PARTIDOS ---------------------------- */

  const [partidos, setPartidos] = useState<MatchMeta[]>([]);
  const [cargando, setCargando] = useState(true);

  useEffect(() => {
    const control = new AbortController();

    fetchMatches(control.signal)
      .then((lista) => setPartidos([...lista].sort(compareMatches)))
      .catch((error) => {
        if (control.signal.aborted) return;

        console.error(error);
        toast.error("No se ha podido leer el calendario de partidos.");
      })
      .finally(() => setCargando(false));

    return () => control.abort();
  }, []);

  /*
  | Al entrar se abre el partido que ya tenga tablero más reciente; si no hay
  | ninguno, el primero del calendario. Preparar el balón parado es una tarea
  | de la semana, así que casi siempre se vuelve a lo último tocado.
  |
  | Es un valor DERIVADO y no un estado que se rellena en un efecto: elegir
  | dentro de un efecto encadena un render de más y, sobre todo, pisa la
  | elección del usuario cada vez que llega el documento remoto.
  */
  const [pedido, setPedido] = useState<string>("");

  const porDefecto = useMemo(() => {
    if (partidos.length === 0) return "";

    const conTablero = partidos.filter((item) => store.tableros?.[item.id]);

    return (conTablero.length ? conTablero[conTablero.length - 1] : partidos[0])
      .id;
  }, [partidos, store.tableros]);

  const elegido = pedido || porDefecto;

  const setElegido = setPedido;

  const partido = useMemo(
    () => partidos.find((item) => item.id === elegido) ?? null,
    [partidos, elegido],
  );

  const tablero: TableroPizarra | null = useMemo(() => {
    if (!partido) return null;

    return (
      store.tableros?.[partido.id] ?? tableroVacio(partido.id, partido.opponent)
    );
  }, [store.tableros, partido]);

  /** El último partido anterior a éste que ya tenga tablero montado. */
  const anterior = useMemo(() => {
    if (!partido) return null;

    const indice = partidos.findIndex((item) => item.id === partido.id);

    for (let i = indice - 1; i >= 0; i -= 1) {
      if (store.tableros?.[partidos[i].id]) return partidos[i];
    }

    return null;
  }, [partido, partidos, store.tableros]);

  const guardado = Boolean(partido && store.tableros?.[partido.id]);

  /* ---------------------------- MUTACIÓN --------------------------- */

  const mutaTablero = useCallback(
    (fn: (actual: TableroPizarra) => TableroPizarra) => {
      if (!partido) return;

      setStore((actual) => {
        const base =
          actual.tableros?.[partido.id] ??
          tableroVacio(partido.id, partido.opponent);

        return {
          ...actual,
          tableros: { ...actual.tableros, [partido.id]: fn(base) },
        };
      });
    },
    [partido, setStore],
  );

  const [pedida, setPedida] = useState(0);

  /* Quitar la última diapositiva deja el índice fuera de la lista: se acota
     aquí en vez de corregirlo en un efecto. */
  const activa = tablero
    ? Math.min(pedida, Math.max(0, tablero.slides.length - 1))
    : 0;

  const slide: SlidePizarra | null = tablero?.slides[activa] ?? null;

  const mutaSlide = useCallback(
    (fn: (actual: SlidePizarra) => SlidePizarra) =>
      mutaTablero((actual) => ({
        ...actual,
        slides: actual.slides.map((item, indice) =>
          indice === activa ? fn(item) : item,
        ),
      })),
    [mutaTablero, activa],
  );

  /* -------------------------- JUGADORES ---------------------------- */

  const porId = useMemo(
    () => new Map(players.map((player) => [player.id, player])),
    [players],
  );

  const disponibles = useMemo(
    () => new Set(players.map((player) => player.id)),
    [players],
  );

  /* --------------------------- PUESTOS ----------------------------- */

  const [editando, setEditando] = useState<string | null>(null);
  const [seleccion, setSeleccion] = useState<string | null>(null);

  const puestoEditado = slide ? puestoDe(slide, editando) : null;

  const ocupadoPor = useMemo(() => {
    const mapa = new Map<string, string>();

    if (!slide) return mapa;

    slide.fichas.forEach((ficha) => {
      const code = puestoDe(slide, ficha.puesto)?.code;

      if (code) mapa.set(ficha.playerId, code);
    });

    return mapa;
  }, [slide]);

  /**
   * Coloca a alguien en un puesto y lo apunta en la memoria.
   *
   * Si el jugador ya estaba en otro puesto de la misma diapositiva se le mueve:
   * duplicarlo dejaría a la misma cara en dos sitios del campo, que es un error
   * de pizarra, no una decisión.
   */
  const asigna = useCallback(
    (puestoKey: string, playerId: string) => {
      if (!slide) return;

      const puesto = puestoDe(slide, puestoKey);

      const cuando = new Date().toISOString();

      mutaSlide((actual) => {
        const limpio = actual.fichas.filter(
          (ficha) => ficha.puesto !== puestoKey && ficha.playerId !== playerId,
        );

        return { ...actual, fichas: [...limpio, fichaNueva(playerId, puesto)] };
      });

      setStore((actual) => ({
        ...actual,
        memoria: aprende(actual.memoria ?? {}, puestoKey, playerId, cuando),
      }));

      setEditando(null);
    },
    [slide, mutaSlide, setStore],
  );

  const vacia = useCallback(
    (puestoKey: string) => {
      mutaSlide((actual) => ({
        ...actual,
        fichas: actual.fichas.filter((ficha) => ficha.puesto !== puestoKey),
      }));

      setEditando(null);
    },
    [mutaSlide],
  );

  /* ------------------------ AUTOMÁTICO ----------------------------- */

/*
  | El reparto se calcula ANTES de tocar el estado, no dentro del actualizador.
  | Contando dentro, el aviso se escribía con el contador todavía a cero:
  | React ejecuta el actualizador cuando le conviene —y en desarrollo, dos
  | veces—, así que decía «no hay nada que colocar» justo después de colocar.
  */
  const coloca = useCallback(
    (todas: boolean) => {
      if (!tablero) return;

      const reparto = tablero.slides.map((item, indice) =>
        !todas && indice !== activa
          ? []
          : colocaAutomatico(item, store.memoria ?? {}, disponibles),
      );

      const puestas = reparto.reduce((total, lista) => total + lista.length, 0);

      if (puestas === 0) {
        toast.info(
          "No hay nada que colocar: o están todos los puestos ocupados o la app todavía no ha visto a nadie en ellos.",
        );

        return;
      }

      mutaTablero((actual) => ({
        ...actual,
        slides: actual.slides.map((item, indice) =>
          reparto[indice]?.length
            ? { ...item, fichas: [...item.fichas, ...reparto[indice]] }
            : item,
        ),
      }));

      toast.success(
        `${puestas} ${puestas === 1 ? "jugador colocado" : "jugadores colocados"} por prioridad`,
      );
    },
    [tablero, mutaTablero, activa, store.memoria, disponibles],
  );

  const copiaDelAnterior = useCallback(() => {
    if (!partido || !anterior) return;

    const origen = store.tableros?.[anterior.id];

    if (!origen) return;

    setStore((actual) => ({
      ...actual,
      tableros: {
        ...actual.tableros,
        [partido.id]: copiaTablero(origen, partido.id, partido.opponent),
      },
    }));

    setPedida(0);

    toast.success(`Copiado de ${matchLabel(anterior)}`);
  }, [partido, anterior, store.tableros, setStore]);

  /* ------------------------ DIAPOSITIVAS --------------------------- */

  const anadeSlide = useCallback(
    (plantilla: string) => {
      mutaTablero((actual) => ({
        ...actual,
        slides: [...actual.slides, slideDePlantilla(plantilla)],
      }));

      setPedida(tablero ? tablero.slides.length : 0);
    },
    [mutaTablero, tablero],
  );

  const duplicaSlide = useCallback(() => {
    if (!slide) return;

    mutaTablero((actual) => {
      const copia: SlidePizarra = {
        ...slide,
        id: `SL-${Math.random().toString(36).slice(2, 10)}`,
        notas: [...slide.notas],
        fichas: slide.fichas.map((ficha) => ({
          ...ficha,
          id: `FI-${Math.random().toString(36).slice(2, 10)}`,
        })),
      };

      const slides = [...actual.slides];

      slides.splice(activa + 1, 0, copia);

      return { ...actual, slides };
    });

    setPedida(activa + 1);
  }, [slide, mutaTablero, activa]);

  const quitaSlide = useCallback(() => {
    if (!tablero || tablero.slides.length <= 1) return;

    const fuera = tablero.slides[activa];

    mutaTablero((actual) => ({
      ...actual,
      slides: actual.slides.filter((_, indice) => indice !== activa),
    }));

    toast(`Quitada: ${fuera.titulo}`, {
      action: {
        label: "Deshacer",
        onClick: () =>
          mutaTablero((actual) => {
            const slides = [...actual.slides];

            slides.splice(Math.min(activa, slides.length), 0, fuera);

            return { ...actual, slides };
          }),
      },
    });
  }, [tablero, activa, mutaTablero]);

  const mueveSlide = useCallback(
    (delta: number) => {
      if (!tablero) return;

      const destino = activa + delta;

      if (destino < 0 || destino >= tablero.slides.length) return;

      mutaTablero((actual) => {
        const slides = [...actual.slides];

        [slides[activa], slides[destino]] = [slides[destino], slides[activa]];

        return { ...actual, slides };
      });

      setPedida(destino);
    },
    [tablero, activa, mutaTablero],
  );

  /* ---------------------------- RENDER ----------------------------- */

  const totales = useMemo(() => {
    if (!tablero) return { total: 0, cubiertos: 0 };

    return tablero.slides.reduce(
      (suma, item) => {
        const { total, cubiertos } = cuentaPuestos(item);

        return { total: suma.total + total, cubiertos: suma.cubiertos + cubiertos };
      },
      { total: 0, cubiertos: 0 },
    );
  }, [tablero]);

  const aprendidos = Object.keys(store.memoria ?? {}).length;

  return (
    <main
      className={`min-h-screen bg-[#0B0F14] text-white ${barlowCondensed.className}`}
      style={
        {
          "--fuente-pizarra": barlowCondensed.style.fontFamily,
        } as React.CSSProperties
      }
    >
      <div className="flex">
        <Sidebar />

        <section className="flex min-w-0 flex-1 flex-col">
          <Topbar />

          <div className="min-w-0 px-4 py-6 sm:px-6 lg:px-10">
            <AbpHeader
              area="RMCF Castilla · Balón parado"
              title="Pizarra de Balón Parado"
              lead="Las diapositivas del partido: quién va en cada puesto de cada acción, sobre el campo y en el panel. Se copia del partido anterior y se rellena sola con los puestos que ya ha visto."
              aside={
                <SaveState
                  status={status}
                  localOnly={localOnly}
                  savedAt={lastSavedAt}
                />
              }
            />

            {/* ===================== PARTIDO ===================== */}

            <div className="mt-6 grid min-w-0 gap-3 lg:grid-cols-[minmax(0,1fr)_auto]">
              <label className="block min-w-0">
                <span className="mb-1.5 block text-[10px] uppercase tracking-[0.16em] text-white/40">
                  Partido
                </span>

                <select
                  value={elegido}
                  onChange={(event) => {
                    setElegido(event.target.value);
                    setPedida(0);
                  }}
                  className="w-full rounded-xl border border-white/10 bg-white/[0.04] px-3 py-2 text-sm text-white outline-none transition focus:border-[#C8A96B]/50"
                >
                  {partidos.length === 0 && (
                    <option value="">
                      {cargando ? "Cargando calendario…" : "Sin partidos"}
                    </option>
                  )}

                  {partidos.map((item) => (
                    <option key={item.id} value={item.id} className="bg-[#11161C]">
                      {formatMatchDate(item)} · {matchLabel(item)}
                      {store.tableros?.[item.id] ? " · con pizarra" : ""}
                    </option>
                  ))}
                </select>
              </label>

              <div className="flex flex-wrap items-end gap-2">
                {anterior && (
                  <Button
                    icon={Copy}
                    onClick={copiaDelAnterior}
                    title={`Traer las diapositivas de ${matchLabel(anterior)}`}
                  >
                    {guardado ? "Rehacer desde" : "Copiar de"}{" "}
                    {matchLabel(anterior)}
                  </Button>
                )}

                <Button
                  tone="primary"
                  icon={Wand2}
                  onClick={() => coloca(true)}
                  disabled={!tablero || aprendidos === 0}
                  title={
                    aprendidos === 0
                      ? "Todavía no hay puestos aprendidos: coloca a alguien a mano y la app empieza a recordar"
                      : "Rellenar los puestos vacíos de todas las diapositivas"
                  }
                >
                  Colocar todo
                </Button>
              </div>
            </div>

            {!partido ? (
              <div className="mt-8">
                <EmptyState
                  title={cargando ? "Cargando el calendario…" : "No hay partidos"}
                  description="La pizarra se monta sobre un partido del calendario."
                />
              </div>
            ) : (
              <>
                {!guardado && (
                  <div className="mt-4">
                    <Notice tone="info" title="Pizarra sin empezar">
                      Se está viendo la plantilla de siete diapositivas en
                      blanco. En cuanto coloques a alguien —o copies el partido
                      anterior— se guarda sola.
                    </Notice>
                  </div>
                )}

                {/* ================== TIRA DE DIAPOSITIVAS ================= */}

                <div className="mt-6">
                  <Panel
                    title="Diapositivas"
                    subtitle={`${totales.cubiertos} de ${totales.total} puestos con jugador`}
                    icon={LayoutGrid}
                  >
                    <div className="flex min-w-0 flex-wrap gap-1.5">
                      {tablero?.slides.map((item, indice) => {
                        const { total, cubiertos } = cuentaPuestos(item);
                        const activo = indice === activa;

                        return (
                          <button
                            key={item.id}
                            type="button"
                            onClick={() => setPedida(indice)}
                            className={`min-w-0 rounded-xl border px-3 py-2 text-left transition ${
                              activo
                                ? "border-[#C8A96B] bg-[#C8A96B]/12"
                                : "border-white/10 text-white/60 hover:border-white/25 hover:text-white"
                            }`}
                          >
                            <span className="block max-w-[190px] truncate text-[12px] font-semibold uppercase tracking-wide">
                              {indice + 1}. {item.titulo}
                            </span>

                            <span className="block text-[10px] tabular-nums text-white/35">
                              {total ? `${cubiertos}/${total} puestos` : "libre"}
                            </span>
                          </button>
                        );
                      })}
                    </div>

                    <div className="mt-3 flex flex-wrap items-center gap-2 border-t border-white/8 pt-3">
                      <label className="min-w-0">
                        <span className="sr-only">Añadir diapositiva</span>

                        <select
                          value=""
                          onChange={(event) => {
                            if (event.target.value) anadeSlide(event.target.value);
                          }}
                          className="rounded-xl border border-white/10 bg-white/[0.04] px-3 py-1.5 text-xs text-white/70 outline-none transition focus:border-[#C8A96B]/50"
                        >
                          <option value="">+ Añadir diapositiva…</option>

                          {PLANTILLAS.map((plantilla) => (
                            <option
                              key={plantilla.key}
                              value={plantilla.key}
                              className="bg-[#11161C]"
                            >
                              {plantilla.titulo}
                            </option>
                          ))}
                        </select>
                      </label>

                      <Button icon={CopyPlus} onClick={duplicaSlide}>
                        Duplicar
                      </Button>

                      <Button
                        icon={ChevronLeft}
                        onClick={() => mueveSlide(-1)}
                        disabled={activa === 0}
                        title="Mover la diapositiva hacia delante"
                      />

                      <Button
                        icon={ChevronRight}
                        onClick={() => mueveSlide(1)}
                        disabled={
                          !tablero || activa >= tablero.slides.length - 1
                        }
                        title="Mover la diapositiva hacia atrás"
                      />

                      <Button
                        icon={Wand2}
                        onClick={() => coloca(false)}
                        disabled={aprendidos === 0}
                        title="Rellenar los puestos vacíos de esta diapositiva"
                      >
                        Colocar ésta
                      </Button>

                      <Button
                        tone="danger"
                        icon={Trash2}
                        onClick={quitaSlide}
                        disabled={!tablero || tablero.slides.length <= 1}
                      >
                        Quitar
                      </Button>
                    </div>
                  </Panel>
                </div>

                {/* ====================== TABLERO ===================== */}

                {slide && (
                  <div className="mt-5 min-w-0 overflow-hidden rounded-2xl border border-white/10">
                    <TableroSlide
                      slide={slide}
                      players={porId}
                      temporada={temporadaCorta(RATINGS_SEASON)}
                      rival={partido.opponent}
                      seleccion={seleccion}
                      onSeleccionar={setSeleccion}
                      onMover={(id, x, y) =>
                        mutaSlide((actual) => ({
                          ...actual,
                          fichas: actual.fichas.map((ficha) =>
                            ficha.id === id ? { ...ficha, x, y } : ficha,
                          ),
                        }))
                      }
                      onQuitar={(id) =>
                        mutaSlide((actual) => ({
                          ...actual,
                          fichas: actual.fichas.filter((ficha) => ficha.id !== id),
                        }))
                      }
                      onPulsarPuesto={setEditando}
                    />
                  </div>
                )}

                {/* ==================== AÑADIR SUELTOS ================ */}

                {slide && (
                  <div className="mt-5">
                    <Panel
                      title="Fichas sueltas"
                      subtitle="Alguien que no ocupa un puesto de la plantilla: se coloca a mano donde haga falta"
                      icon={Plus}
                    >
                      <div className="flex flex-wrap gap-1.5">
                        {players.map((player) => (
                          <button
                            key={player.id}
                            type="button"
                            onClick={() =>
                              mutaSlide((actual) => ({
                                ...actual,
                                fichas: [
                                  ...actual.fichas,
                                  fichaNueva(player.id, null, actual.fichas.length),
                                ],
                              }))
                            }
                            title={`Poner a ${player.apodo || player.nombre} en el campo`}
                            className="flex items-center gap-2 rounded-xl border border-white/10 px-2 py-1 text-xs text-white/65 transition hover:border-[#C8A96B]/50 hover:text-white"
                          >
                            {/* eslint-disable-next-line @next/next/no-img-element */}
                            <img
                              src={player.foto}
                              alt=""
                              className="h-6 w-6 rounded-md object-cover object-top"
                            />

                            <span className="max-w-[110px] truncate">
                              {player.apodo || player.nombre}
                            </span>
                          </button>
                        ))}
                      </div>
                    </Panel>
                  </div>
                )}

                {/* ====================== NOTAS ======================= */}

                {slide && (
                  <div className="mt-5">
                    <Panel
                      title="Consignas"
                      subtitle="Lo que se lee en la caja blanca de la diapositiva. Una por línea."
                    >
                      <textarea
                        value={slide.notas.join("\n")}
                        onChange={(event) =>
                          mutaSlide((actual) => ({
                            ...actual,
                            notas: event.target.value
                              .split("\n")
                              .map((linea) => linea.trimStart()),
                          }))
                        }
                        rows={5}
                        placeholder="Remate detrás de corta…"
                        className="w-full rounded-xl border border-white/10 bg-white/[0.04] px-3 py-2 text-sm leading-relaxed text-white outline-none transition placeholder:text-white/25 focus:border-[#C8A96B]/50"
                      />
                    </Panel>
                  </div>
                )}

                {/* ================== LO QUE HA APRENDIDO ============= */}

                <div className="mt-5">
                  <Panel
                    title="Lo que ha aprendido"
                    subtitle={
                      aprendidos
                        ? `${aprendidos} puestos con historial`
                        : "Todavía nada: coloca a alguien y empieza a recordar"
                    }
                  >
                    {aprendidos === 0 ? (
                      <p className="text-xs leading-relaxed text-white/40">
                        Cada vez que pones a un jugador en un puesto queda
                        anotado. Cuando haya historial, «Colocar todo» rellena
                        las diapositivas por prioridad: el que más veces ha
                        ocupado el puesto va primero y nadie se repite dentro de
                        una misma diapositiva.
                      </p>
                    ) : (
                      <MemoriaResumen store={store} porId={porId} />
                    )}
                  </Panel>
                </div>
              </>
            )}
          </div>
        </section>
      </div>

      {slide && puestoEditado && (
        <SelectorJugador
          puesto={puestoEditado}
          players={players}
          memoria={store.memoria?.[puestoEditado.key] ?? []}
          ocupadoPor={ocupadoPor}
          actual={
            slide.fichas.find((ficha) => ficha.puesto === puestoEditado.key)
              ?.playerId ?? null
          }
          onElegir={(playerId) => asigna(puestoEditado.key, playerId)}
          onQuitar={() => vacia(puestoEditado.key)}
          onCerrar={() => setEditando(null)}
        />
      )}
    </main>
  );
}

/* ------------------------------------------------------------------ */
/*  RESUMEN DE LA MEMORIA                                              */
/* ------------------------------------------------------------------ */

/**
 * Qué sabe la app, en cristiano.
 *
 * Se lee agrupado por diapositiva porque un puesto no significa lo mismo en
 * dos acciones distintas: el «RL» de un córner defensivo y el de una falta
 * lateral son dos sitios diferentes del campo.
 */
function MemoriaResumen({
  store,
  porId,
}: {
  store: PizarraStore;
  porId: Map<string, { apodo?: string; nombre: string }>;
}) {
  const filas = useMemo(() => {
    const porPlantilla = new Map<
      string,
      { code: string; label: string; nombres: string[] }[]
    >();

    Object.entries(store.memoria ?? {}).forEach(([key, lista]) => {
      const [plantillaKey] = key.split(":");

      const plantilla = PLANTILLA_BY_KEY.get(plantillaKey);

      if (!plantilla) return;

      const puesto = plantilla.puestos.find((item) => item.key === key);

      if (!puesto) return;

      const nombres = lista
        .slice(0, 3)
        .map((item) => porId.get(item.playerId))
        .filter(Boolean)
        .map((player) => player!.apodo || player!.nombre);

      if (nombres.length === 0) return;

      const actuales = porPlantilla.get(plantilla.titulo) ?? [];

      actuales.push({ code: puesto.code, label: puesto.label, nombres });

      porPlantilla.set(plantilla.titulo, actuales);
    });

    return [...porPlantilla.entries()];
  }, [store.memoria, porId]);

  if (filas.length === 0) {
    return (
      <p className="text-xs text-white/40">
        Hay historial, pero de jugadores que ya no están en la plantilla.
      </p>
    );
  }

  return (
    <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
      {filas.map(([titulo, puestos]) => (
        <div key={titulo} className="min-w-0">
          <p className="mb-1.5 text-[10px] uppercase tracking-[0.16em] text-[#C8A96B]">
            {titulo}
          </p>

          <ul className="space-y-1">
            {puestos.map((puesto) => (
              <li
                key={puesto.code}
                className="flex min-w-0 items-baseline gap-2 text-xs"
              >
                <span
                  className="shrink-0 rounded bg-white/8 px-1.5 py-0.5 text-[10px] font-semibold text-white/60"
                  title={puesto.label}
                >
                  {puesto.code}
                </span>

                <span className="min-w-0 flex-1 truncate text-white/55">
                  {puesto.nombres.join(" · ")}
                </span>
              </li>
            ))}
          </ul>
        </div>
      ))}
    </div>
  );
}
