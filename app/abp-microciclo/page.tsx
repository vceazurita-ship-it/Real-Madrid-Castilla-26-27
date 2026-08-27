"use client";

/**
 * Microciclo de balón parado: qué se trabaja cada día y si eso llega al partido.
 *
 * La pantalla junta dos cosas que hasta ahora vivían separadas:
 *
 * 1. **La semana**, de lunes a domingo, con cada trabajo de ABP —lado, aspecto,
 *    momento de la sesión, campo o vídeo, con qué roles, cuánto tiempo y qué
 *    desgaste deja—. Es lo que se planifica el domingo por la noche.
 *
 * 2. **El cruce con la competición**: las cuatro hojas de ABP dicen qué ocurre
 *    de verdad en los partidos, y comparándolo con lo entrenado sale lo único
 *    que interesa de verdad —qué está urgido de trabajo y si lo trabajado se
 *    nota—.
 *
 * El desgaste no se inventa: cuando una tarea ya está en la hoja de registro,
 * se importa con sus cargas medidas (`lib/abp/registro.ts`). Lo que se planifica
 * a futuro se estima con la misma cuenta que usa esa hoja, y se dice que es una
 * estimación.
 *
 * Las cuentas viven fuera: `lib/abp/microciclo.ts` (vocabulario y cargas),
 * `lib/abp/competicion.ts` (lo que pasó en los partidos) y
 * `lib/abp/transferencia.ts` (urgencia y transferencia).
 */

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  Brain,
  CalendarDays,
  Dumbbell,
  Flame,
  Plus,
  Download,
  Target,
  TriangleAlert,
} from "lucide-react";

import { toast } from "sonner";

import { Sidebar } from "@/components/ui/sidebar";
import { Topbar } from "@/components/ui/topbar";
import {
  AbpHeader,
  Button,
  EmptyState,
  Meter,
  Notice,
  Panel,
  SaveState,
  Segmented,
  StatCard,
  StatRow,
} from "@/components/abp/ui";
import { SemanaGrid } from "@/components/abp/microciclo/SemanaGrid";
import { TrabajoDialog } from "@/components/abp/microciclo/TrabajoDialog";
import {
  ImportarRegistro,
  type Importacion,
} from "@/components/abp/microciclo/ImportarRegistro";
import { CruceTabla } from "@/components/abp/microciclo/CruceTabla";
import { EscudoEquipo } from "@/components/rivals/EscudoEquipo";
import { useEscudos } from "@/hooks/useEscudos";
import { useRemoteDoc } from "@/hooks/useRemoteDoc";
import { chipInk } from "@/lib/theme";
import {
  EMPTY_MICRO_STORE,
  LADOS,
  LADO_COLOR,
  LADO_LABEL,
  MOMENTOS,
  ROLES,
  claveAspecto,
  claveMicro,
  diasCompletos,
  duplicaTrabajo,
  etiquetaTrabajo,
  fmtMin,
  minutosPorAspecto,
  nuevoTrabajo,
  planVacio,
  totalesDe,
  trabajosDelPlan,
  type AbpLado,
  type DiaKey,
  type MicroPlan,
  type MicroStore,
  type TipoDia,
  type Trabajo,
} from "@/lib/abp/microciclo";
import {
  buscaPartido,
  loadCompeticion,
  type CompeticionDataset,
} from "@/lib/abp/competicion";
import {
  esTareaAbp,
  loadRegistro,
  type RegistroDataset,
} from "@/lib/abp/registro";
import {
  colorUrgencia,
  construyeCruce,
  construyeTrabajoPrevio,
  etiquetaUrgencia,
  ordenaPorUrgencia,
} from "@/lib/abp/transferencia";

/* ------------------------------------------------------------------ */
/*  AYUDAS                                                             */
/* ------------------------------------------------------------------ */

type MicroOpcion = {
  clave: string;
  temporada: string;
  micro: number;
  rival: string;
  /** Está en la hoja de registro de tareas. */
  enRegistro: boolean;
  /** Tiene plan de ABP guardado. */
  planificado: boolean;
};

const acota = (valor: number) => Math.max(0, Math.min(10, Math.round(valor)));

/** Identifica una tarea de la hoja para no importarla dos veces. */
function idTarea(micro: number, dia: string, tarea: string) {
  return `${micro}-${dia}-${tarea}`;
}

/** Barra con rótulo y valor: el reparto de minutos se lee de un vistazo. */
function Reparto({
  filas,
  total,
}: {
  filas: { label: string; valor: number; color: string }[];
  total: number;
}) {
  const maximo = Math.max(1, ...filas.map((fila) => fila.valor));

  return (
    <div className="space-y-2">
      {filas.map((fila) => (
        <div key={fila.label} className="flex items-center gap-2.5">
          <span className="w-[132px] shrink-0 truncate text-[11px] text-white/50">
            {fila.label}
          </span>

          <Meter
            value={fila.valor}
            max={maximo}
            color={fila.color}
            label={fila.label}
          />

          <span className="w-[74px] shrink-0 text-right text-[11px] tabular-nums text-white/60">
            {fila.valor ? fmtMin(fila.valor) : "—"}
            {total > 0 && fila.valor > 0 && (
              <span className="ml-1 text-white/40">
                {Math.round((fila.valor / total) * 100)}%
              </span>
            )}
          </span>
        </div>
      ))}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  PÁGINA                                                             */
/* ------------------------------------------------------------------ */

export default function AbpMicrocicloPage() {
  /* El escudo del club, que la hoja no trae: ver `hooks/useEscudos`. */
  const escudoDe = useEscudos();

  const {
    value: store,
    setValue: setStore,
    status,
    localOnly,
    lastSavedAt,
  } = useRemoteDoc<MicroStore>({
    key: "abp-microciclo",
    kind: "abp-microciclo",
    fallback: EMPTY_MICRO_STORE,
  });

  const [registro, setRegistro] = useState<RegistroDataset | null>(null);
  const [competicion, setCompeticion] = useState<CompeticionDataset | null>(
    null,
  );
  const [cargando, setCargando] = useState(true);
  const [errorRegistro, setErrorRegistro] = useState(false);

  /* --------------------------- CARGA DE HOJAS --------------------------- */

  useEffect(() => {
    let cancelado = false;

    const cargar = async () => {
      const [datosRegistro, datosCompeticion] = await Promise.all([
        loadRegistro().catch(() => null),
        loadCompeticion(),
      ]);

      if (cancelado) return;

      setRegistro(datosRegistro);
      setErrorRegistro(datosRegistro === null);
      setCompeticion(datosCompeticion);
      setCargando(false);
    };

    void cargar();

    return () => {
      cancelado = true;
    };
  }, []);

  /* ---------------------------- MICROCICLOS ---------------------------- */

  const micros = useMemo<MicroOpcion[]>(() => {
    const mapa = new Map<string, MicroOpcion>();

    registro?.micros.forEach((micro) => {
      const clave = claveMicro(micro.temporada, micro.micro);

      mapa.set(clave, {
        clave,
        temporada: micro.temporada,
        micro: micro.micro,
        rival: micro.rival,
        enRegistro: true,
        planificado: false,
      });
    });

    Object.entries(store.micros ?? {}).forEach(([clave, plan]) => {
      const existente = mapa.get(clave);

      if (existente) {
        existente.planificado = true;

        /* El rival del plan manda: puede haberse corregido a mano. */
        if (plan.rival) existente.rival = plan.rival;

        return;
      }

      mapa.set(clave, {
        clave,
        temporada: plan.temporada,
        micro: plan.micro,
        rival: plan.rival,
        enRegistro: false,
        planificado: true,
      });
    });

    return [...mapa.values()].sort(
      (a, b) =>
        a.temporada.localeCompare(b.temporada, "es") || a.micro - b.micro,
    );
  }, [registro, store.micros]);

  const [seleccion, setSeleccion] = useState<string | null>(null);

  /* El microciclo más reciente es el que se está preparando: es el que se
     abre solo. Se calcula en vez de fijarse en un efecto para que no haya un
     instante con la pantalla en el micro que no es. */
  const claveActiva =
    seleccion && micros.some((micro) => micro.clave === seleccion)
      ? seleccion
      : (micros[micros.length - 1]?.clave ?? "");

  const microActivo = micros.find((micro) => micro.clave === claveActiva);

  const plan = useMemo<MicroPlan>(() => {
    const guardado = store.micros?.[claveActiva];

    if (guardado) return { ...guardado, dias: diasCompletos(guardado) };

    return planVacio(
      microActivo?.temporada ?? "",
      microActivo?.micro ?? 0,
      microActivo?.rival ?? "",
    );
  }, [store.micros, claveActiva, microActivo]);

  /* ------------------------------ EDICIÓN ------------------------------ */

  const mutaPlan = useCallback(
    (fn: (plan: MicroPlan) => MicroPlan) => {
      if (!claveActiva) return;

      setStore((actual) => {
        const micros = actual.micros ?? {};

        const base =
          micros[claveActiva] ??
          planVacio(
            microActivo?.temporada ?? "",
            microActivo?.micro ?? 0,
            microActivo?.rival ?? "",
          );

        /* Los documentos viejos pueden traer días a medias. */
        const completo: MicroPlan = { ...base, dias: diasCompletos(base) };

        return {
          ...actual,
          micros: { ...micros, [claveActiva]: fn(completo) },
        };
      });
    },
    [claveActiva, microActivo, setStore],
  );

  const cambiaTipo = useCallback(
    (dia: DiaKey, tipo: TipoDia) =>
      mutaPlan((actual) => ({
        ...actual,
        dias: { ...actual.dias, [dia]: { ...actual.dias[dia], tipo } },
      })),
    [mutaPlan],
  );

  const cambiaMd = useCallback(
    (dia: DiaKey, md: string) =>
      mutaPlan((actual) => ({
        ...actual,
        dias: { ...actual.dias, [dia]: { ...actual.dias[dia], md } },
      })),
    [mutaPlan],
  );

  const cambiaRival = useCallback(
    (rival: string) => mutaPlan((actual) => ({ ...actual, rival })),
    [mutaPlan],
  );

  /** Guarda un trabajo, moviéndolo de día si hace falta. */
  const guardaTrabajo = useCallback(
    (trabajo: Trabajo, destino: DiaKey, origen: DiaKey | null) =>
      mutaPlan((actual) => {
        const dias = { ...actual.dias };

        if (origen) {
          dias[origen] = {
            ...dias[origen],
            trabajos: dias[origen].trabajos.filter(
              (item) => item.id !== trabajo.id,
            ),
          };
        }

        dias[destino] = {
          ...dias[destino],
          trabajos: [...dias[destino].trabajos, trabajo],
        };

        return { ...actual, dias };
      }),
    [mutaPlan],
  );

  const borraTrabajo = useCallback(
    (dia: DiaKey, id: string) =>
      mutaPlan((actual) => ({
        ...actual,
        dias: {
          ...actual.dias,
          [dia]: {
            ...actual.dias[dia],
            trabajos: actual.dias[dia].trabajos.filter(
              (item) => item.id !== id,
            ),
          },
        },
      })),
    [mutaPlan],
  );

  /**
   * Mueve un bloque de sitio: de un día a otro o dentro del mismo.
   *
   * `antesDe` es el bloque delante del cual cae; `null` lo pone al final del
   * día. Se quita primero y se calcula el índice después, para que reordenar
   * dentro de un día no se descuadre por el hueco que deja el propio bloque.
   */
  const mueveTrabajo = useCallback(
    (origen: DiaKey, id: string, destino: DiaKey, antesDe: string | null) =>
      mutaPlan((actual) => {
        const trabajo = actual.dias[origen].trabajos.find(
          (item) => item.id === id,
        );

        if (!trabajo) return actual;

        const dias = { ...actual.dias };

        dias[origen] = {
          ...dias[origen],
          trabajos: dias[origen].trabajos.filter((item) => item.id !== id),
        };

        const lista = [...dias[destino].trabajos];

        const indice = antesDe
          ? lista.findIndex((item) => item.id === antesDe)
          : -1;

        if (indice < 0) lista.push(trabajo);
        else lista.splice(indice, 0, trabajo);

        dias[destino] = { ...dias[destino], trabajos: lista };

        return { ...actual, dias };
      }),
    [mutaPlan],
  );

  /** Copia el bloque justo detrás del original, en el mismo día. */
  const duplicaEnDia = useCallback(
    (dia: DiaKey, trabajo: Trabajo) =>
      mutaPlan((actual) => {
        const lista = [...actual.dias[dia].trabajos];
        const indice = lista.findIndex((item) => item.id === trabajo.id);

        const copia = duplicaTrabajo(trabajo);

        if (indice < 0) lista.push(copia);
        else lista.splice(indice + 1, 0, copia);

        return {
          ...actual,
          dias: { ...actual.dias, [dia]: { ...actual.dias[dia], trabajos: lista } },
        };
      }),
    [mutaPlan],
  );

  /**
   * Quita un bloque desde la propia ficha, con deshacer.
   *
   * Quitar es un solo toque en una columna estrecha, así que se falla; y el
   * plan se autoguarda, de modo que no hay «cancelar» al que volver. El
   * deshacer lo devuelve a su sitio exacto, no al final del día.
   */
  const quitaDesdeLaSemana = useCallback(
    (dia: DiaKey, trabajo: Trabajo) => {
      const posicion = (
        plan.dias[dia]?.trabajos ?? []
      ).findIndex((item) => item.id === trabajo.id);

      borraTrabajo(dia, trabajo.id);

      toast(`Quitado: ${etiquetaTrabajo(trabajo, true)}`, {
        action: {
          label: "Deshacer",
          onClick: () =>
            mutaPlan((actual) => {
              const lista = [...actual.dias[dia].trabajos];

              lista.splice(
                posicion < 0 ? lista.length : Math.min(posicion, lista.length),
                0,
                trabajo,
              );

              return {
                ...actual,
                dias: {
                  ...actual.dias,
                  [dia]: { ...actual.dias[dia], trabajos: lista },
                },
              };
            }),
        },
      });
    },
    [borraTrabajo, mutaPlan, plan],
  );

  /* ------------------------------ DIÁLOGOS ----------------------------- */

  const [editor, setEditor] = useState<{
    trabajo: Trabajo;
    dia: DiaKey;
    /** `null` cuando todavía no está en ningún día. */
    origen: DiaKey | null;
  } | null>(null);

  const [importando, setImportando] = useState(false);

  /* --------------------------- TAREAS DE LA HOJA ------------------------ */

  const tareasAbpDelMicro = useMemo(() => {
    if (!registro || !microActivo) return [];

    return registro.tareas.filter(
      (tarea) =>
        tarea.micro === microActivo.micro &&
        tarea.temporada === microActivo.temporada &&
        esTareaAbp(tarea),
    );
  }, [registro, microActivo]);

  const yaImportadas = useMemo(
    () =>
      new Set(
        trabajosDelPlan(plan)
          .map(({ trabajo }) => trabajo.tareaId)
          .filter((id): id is string => Boolean(id)),
      ),
    [plan],
  );

  const importa = useCallback(
    (seleccionadas: Importacion[]) => {
      mutaPlan((actual) => {
        const dias = { ...actual.dias };

        seleccionadas.forEach(({ tarea, lado, aspecto }) => {
          const dia = (tarea.dia || "L") as DiaKey;

          const trabajo = nuevoTrabajo({
            lado,
            aspectos: [aspecto],
            /* La hoja no anota el momento de la sesión; intra es lo habitual
               y se corrige de un toque. */
            momento: "intra",
            medio: /video|v[ií]deo|sala/i.test(
              `${tarea.tipoTarea} ${tarea.contenidoSecundario}`,
            )
              ? "video"
              : "campo",
            minutos: Math.round(tarea.tiempo) || 0,
            intensidad: acota(tarea.intensidad),
            exigCognitiva: acota(tarea.exigCog),
            cargaRegistrada: tarea.carga || null,
            cargaCogRegistrada: tarea.cargaCog || null,
            origen: "registro",
            tareaId: idTarea(tarea.micro, tarea.dia, tarea.tarea),
            notas: tarea.contenidoSecundario || tarea.tarea,
          });

          dias[dia] = {
            ...dias[dia],
            md: dias[dia].md || tarea.md,
            trabajos: [...dias[dia].trabajos, trabajo],
          };
        });

        return { ...actual, dias };
      });

      setImportando(false);
    },
    [mutaPlan],
  );

  /* ------------------------------ TOTALES ------------------------------ */

  const entradas = useMemo(() => trabajosDelPlan(plan), [plan]);
  const totales = useMemo(() => totalesDe(entradas), [entradas]);

  const minutosMicro = useMemo(() => minutosPorAspecto(entradas), [entradas]);

  const minutosTemporada = useMemo(() => {
    const mapa = new Map<string, number>();

    Object.values(store.micros ?? {}).forEach((otro) => {
      trabajosDelPlan(otro).forEach(({ trabajo }) => {
        /* Los minutos se reparten entre los aspectos de la tarea, igual que
           en el microciclo activo. */
        const aspectos = trabajo.aspectos;
        const parte = (trabajo.minutos || 0) / aspectos.length;

        aspectos.forEach((aspecto) => {
          const clave = claveAspecto(aspecto, trabajo.lado);

          mapa.set(clave, (mapa.get(clave) ?? 0) + parte);
        });
      });
    });

    return mapa;
  }, [store.micros]);

  const partidos = useMemo(() => competicion?.partidos ?? [], [competicion]);

  const trabajoPrevio = useMemo(
    () =>
      construyeTrabajoPrevio(
        Object.values(store.micros ?? {}).map((otro) => ({
          rival: otro.rival,
          minutos: minutosPorAspecto(trabajosDelPlan(otro)),
        })),
        partidos,
      ),
    [store.micros, partidos],
  );

  const filas = useMemo(
    () =>
      construyeCruce({
        events: competicion?.events ?? [],
        partidos,
        minutosMicro,
        minutosTemporada,
        trabajoPrevio,
      }),
    [competicion, partidos, minutosMicro, minutosTemporada, trabajoPrevio],
  );

  const partidoDelMicro = useMemo(
    () => (plan.rival ? buscaPartido(plan.rival, partidos) : null),
    [plan.rival, partidos],
  );

  /* ------------------------------- CRUCE ------------------------------- */

  const [filtroLado, setFiltroLado] = useState<"todos" | AbpLado>("todos");
  const [orden, setOrden] = useState<"urgencia" | "minutos" | "catalogo">(
    "urgencia",
  );

  const filasVisibles = useMemo(() => {
    const filtradas =
      filtroLado === "todos"
        ? filas
        : filas.filter((fila) => fila.lado === filtroLado);

    if (orden === "catalogo") return filtradas;

    return [...filtradas].sort((a, b) => {
      if (orden === "minutos") {
        return b.minutosTemporada - a.minutosTemporada;
      }

      return (b.urgencia ?? -1) - (a.urgencia ?? -1);
    });
  }, [filas, filtroLado, orden]);

  const prioridades = useMemo(
    () => ordenaPorUrgencia(filas).slice(0, 5),
    [filas],
  );

  /* Acciones de banda que la hoja dejó sin zona: no caben en ninguna fila. */
  const bandaSinZona = competicion
    ? competicion.bandaSinZona.ofensivo + competicion.bandaSinZona.defensivo
    : 0;

  /* --------------------------- NUEVO MICROCICLO ------------------------ */

  const creaMicro = useCallback(() => {
    const ultimo = micros[micros.length - 1];

    const temporada = ultimo?.temporada || "2026 - 2027";
    const numero = (ultimo?.micro ?? 0) + 1;
    const clave = claveMicro(temporada, numero);

    setStore((actual) => ({
      ...actual,
      micros: {
        ...(actual.micros ?? {}),
        [clave]: planVacio(temporada, numero, ""),
      },
    }));

    setSeleccion(clave);
  }, [micros, setStore]);

  /* ------------------------------ RENDER ------------------------------- */

  const sinMicros = !cargando && !micros.length;

  return (
    <div className="flex min-h-screen bg-[#0B0F14] text-white">
      <Sidebar />

      <main className="min-w-0 flex-1">
        <Topbar />

        <div className="mx-auto min-w-0 max-w-[1500px] px-4 py-6 md:px-8 md:py-8">
          <AbpHeader
            area="RMCF Castilla · Metodología"
            title="Microciclo de Balón Parado"
            lead="Qué se trabaja de ABP cada día de la semana —lado, aspecto, momento de la sesión, campo o vídeo, con qué roles y con cuánto desgaste— y si eso se está notando en el partido."
            aside={
              <SaveState
                status={status}
                localOnly={localOnly}
                savedAt={lastSavedAt}
              />
            }
          />

          {/* ======================= AVISOS ======================= */}

          {competicion?.fallos.length ? (
            <div className="mt-5">
              <Notice tone="warn" title="Falta parte del dato de competición">
                No se han podido leer estas hojas:{" "}
                {competicion.fallos.join(", ")}. Lo que se ve abajo está
                calculado sin ellas.
              </Notice>
            </div>
          ) : null}

          {errorRegistro && (
            <div className="mt-5">
              <Notice tone="warn" title="Sin la hoja de registro de tareas">
                No se ha podido leer el registro, así que no hay lista de
                microciclos ni cargas medidas que importar. La planificación se
                puede escribir igualmente creando un microciclo a mano.
              </Notice>
            </div>
          )}

          {/* ====================== SELECTOR ====================== */}

          <div className="mt-6 flex flex-wrap items-end gap-3">
            <label className="block min-w-[200px]">
              <span className="mb-1.5 block text-[10px] uppercase tracking-[0.16em] text-white/40">
                Microciclo
              </span>

              <select
                value={claveActiva}
                onChange={(event) => setSeleccion(event.target.value)}
                disabled={!micros.length}
                className="w-full rounded-xl border border-white/10 bg-white/[0.04] px-3 py-2 text-sm text-white outline-none transition focus:border-[#C8A96B]/50 disabled:opacity-40"
              >
                {micros.map((micro) => (
                  <option
                    key={micro.clave}
                    value={micro.clave}
                    className="bg-[#11161C]"
                  >
                    {`Micro ${micro.micro} · ${micro.rival || "sin rival"}`}
                    {micro.planificado ? " ✓" : ""}
                    {micro.enRegistro ? "" : " (nuevo)"}
                  </option>
                ))}
              </select>
            </label>

            <label className="block min-w-[220px] flex-1">
              <span className="mb-1.5 block text-[10px] uppercase tracking-[0.16em] text-white/40">
                Rival de la semana
              </span>

              {/* El escudo delante del nombre: es lo que dice de un vistazo
                  con qué rival se ha cruzado la semana, porque el desplegable
                  de al lado es un <select> nativo y no puede llevarlo. */}
              <span className="flex min-w-0 items-center gap-2">
                {plan.rival.trim() && (
                  <EscudoEquipo
                    nombre={plan.rival}
                    escudo={escudoDe(plan.rival)}
                    lado={26}
                  />
                )}

                <input
                  value={plan.rival}
                  onChange={(event) => cambiaRival(event.target.value)}
                  placeholder="Contra quién se juega"
                  className="w-full min-w-0 rounded-xl border border-white/10 bg-white/[0.04] px-3 py-2 text-sm text-white outline-none transition placeholder:text-white/25 focus:border-[#C8A96B]/50"
                />
              </span>
            </label>

            <Button
              icon={Download}
              onClick={() => setImportando(true)}
              disabled={!tareasAbpDelMicro.length}
              title={
                tareasAbpDelMicro.length
                  ? "Traer las tareas de ABP ya registradas de este microciclo"
                  : "Este microciclo no tiene tareas de ABP en la hoja de registro"
              }
            >
              Importar del registro
              {tareasAbpDelMicro.length ? ` (${tareasAbpDelMicro.length})` : ""}
            </Button>

            <Button icon={Plus} onClick={creaMicro}>
              Nuevo microciclo
            </Button>
          </div>

          {/* Qué partido mide esta semana. Sin esto, la transferencia es magia. */}
          <p className="mt-2 text-[11px] text-white/35">
            {partidoDelMicro ? (
              <>
                Se mide contra{" "}
                <span className="text-white/60">{partidoDelMicro.jornada}</span>{" "}
                · {partidoDelMicro.rival}.
              </>
            ) : plan.rival ? (
              <>
                Todavía no hay partido registrado contra{" "}
                <span className="text-white/60">{plan.rival}</span> en las hojas
                de ABP: este microciclo aún no puede medir transferencia.
              </>
            ) : (
              "Escribe el rival de la semana para poder cruzar este microciclo con su partido."
            )}
          </p>

          {cargando ? (
            <p className="mt-10 text-sm text-white/45">
              Cargando registro de tareas y hojas de ABP…
            </p>
          ) : sinMicros ? (
            <div className="mt-8">
              <EmptyState
                title="Todavía no hay ningún microciclo"
                description="La lista sale de la hoja de registro de tareas. Si aún no hay nada registrado, crea uno a mano con «Nuevo microciclo»."
              />
            </div>
          ) : (
            <>
              {/* ===================== RESUMEN ===================== */}

              <div className="mt-7">
                <StatRow>
                  <StatCard
                    label="Minutos de ABP"
                    value={fmtMin(totales.minutos)}
                    hint={`${totales.trabajos} trabajo${totales.trabajos === 1 ? "" : "s"} · ${totales.diasConAbp} día${totales.diasConAbp === 1 ? "" : "s"}`}
                    accent="var(--rmcf-gold-ink)"
                  />

                  <StatCard
                    label="Ofensivo / Defensivo"
                    value={`${fmtMin(totales.porLado.ofensivo)} / ${fmtMin(totales.porLado.defensivo)}`}
                    hint={
                      totales.minutos
                        ? `${Math.round((totales.porLado.ofensivo / totales.minutos) * 100)} % ofensivo`
                        : "sin reparto todavía"
                    }
                  />

                  <StatCard
                    label="Carga condicional"
                    value={Math.round(totales.carga) || "—"}
                    hint="tiempo × intensidad"
                    accent={chipInk("#FBBF24")}
                  />

                  <StatCard
                    label="Carga cognitiva"
                    value={Math.round(totales.cargaCog) || "—"}
                    hint="tiempo × exigencia"
                    accent={chipInk("#8B5CF6")}
                  />

                  <StatCard
                    label="Campo / Vídeo"
                    value={`${fmtMin(totales.minutosCampo)} / ${fmtMin(totales.minutosVideo)}`}
                    hint={
                      totales.minutosVideo
                        ? `${Math.round((totales.minutosVideo / totales.minutos) * 100)} % en sala`
                        : "todo en campo"
                    }
                  />
                </StatRow>
              </div>

              {/* ====================== SEMANA ===================== */}

              <div className="mt-6">
                <Panel
                  title="La semana"
                  subtitle="Pulsa un bloque para editarlo y arrástralo para cambiarlo de día; cada uno se puede duplicar o quitar"
                  icon={CalendarDays}
                >
                  <SemanaGrid
                    dias={plan.dias}
                    onCambiaTipo={cambiaTipo}
                    onCambiaMd={cambiaMd}
                    onAbrir={(dia, trabajo) =>
                      setEditor({ trabajo, dia, origen: dia })
                    }
                    onAnadir={(dia) =>
                      setEditor({ trabajo: nuevoTrabajo(), dia, origen: null })
                    }
                    onMover={mueveTrabajo}
                    onDuplicar={duplicaEnDia}
                    onBorrar={quitaDesdeLaSemana}
                  />
                </Panel>
              </div>

              {/* ====================== REPARTO ==================== */}

              <div className="mt-6 grid gap-5 lg:grid-cols-3">
                <Panel title="Por lado" icon={Target}>
                  <Reparto
                    total={totales.minutos}
                    filas={LADOS.map((lado) => ({
                      label: lado.label,
                      valor: totales.porLado[lado.key],
                      color: lado.color,
                    }))}
                  />
                </Panel>

                <Panel title="Por momento de la sesión" icon={Dumbbell}>
                  <Reparto
                    total={totales.minutos}
                    filas={MOMENTOS.map((momento) => ({
                      label: momento.label,
                      valor: totales.porMomento[momento.key],
                      color: "#C8A96B",
                    }))}
                  />
                </Panel>

                <Panel
                  title="Por rol"
                  subtitle="Un trabajo puede sumar en varios"
                  icon={Brain}
                >
                  <Reparto
                    total={0}
                    filas={ROLES.map((rol) => ({
                      label: rol.label,
                      valor: totales.porRol[rol.key],
                      color: "#5E7FB8",
                    }))}
                  />
                </Panel>
              </div>

              {/* ==================== PRIORIDADES ================== */}

              <div className="mt-6">
                <Panel
                  title="Lo más urgente ahora mismo"
                  subtitle="Mucho volumen en competición, mal rendimiento y pocos minutos encima"
                  icon={Flame}
                >
                  {prioridades.length ? (
                    <div className="grid gap-2.5 sm:grid-cols-2 xl:grid-cols-5">
                      {prioridades.map((fila) => {
                        const color = colorUrgencia(fila.urgencia ?? 0);

                        return (
                          <button
                            key={`${fila.aspecto.key}-${fila.lado}`}
                            type="button"
                            onClick={() =>
                              setEditor({
                                trabajo: nuevoTrabajo({
                                  aspectos: [fila.aspecto.key],
                                  lado: fila.lado,
                                }),
                                dia: "L",
                                origen: null,
                              })
                            }
                            className="min-w-0 rounded-2xl border border-white/10 bg-white/[0.03] p-3 text-left transition hover:border-white/25 hover:bg-white/[0.06]"
                          >
                            <div className="flex items-center justify-between gap-2">
                              <span
                                className="rounded px-1.5 py-0.5 text-[9px] font-semibold uppercase tracking-wide"
                                style={{
                                  backgroundColor: `${LADO_COLOR[fila.lado]}1F`,
                                  color: chipInk(LADO_COLOR[fila.lado]),
                                }}
                              >
                                {LADO_LABEL[fila.lado]}
                              </span>

                              <span
                                className="text-sm font-semibold tabular-nums"
                                style={{ color: chipInk(color) }}
                              >
                                {Math.round(fila.urgencia ?? 0)}
                              </span>
                            </div>

                            <p className="mt-1.5 truncate text-[13px] font-medium text-white">
                              {fila.aspecto.label}
                            </p>

                            <p className="mt-0.5 text-[10.5px] tabular-nums text-white/40">
                              {fila.stats.acciones} acciones ·{" "}
                              {fila.peligroAjustado.toFixed(0)} % peligro ·{" "}
                              {fila.minutosTemporada
                                ? fmtMin(fila.minutosTemporada)
                                : "sin trabajar"}
                            </p>

                            <p className="mt-1.5 text-[10px] uppercase tracking-wide text-white/40">
                              Urgencia {etiquetaUrgencia(fila.urgencia ?? 0)} ·
                              planificar
                            </p>
                          </button>
                        );
                      })}
                    </div>
                  ) : (
                    <EmptyState
                      title="Sin datos de competición"
                      description="Las hojas de ABP no han devuelto acciones, así que no se puede ordenar nada por urgencia."
                    />
                  )}
                </Panel>
              </div>

              {/* ======================= CRUCE ===================== */}

              <div className="mt-6">
                <Panel
                  title="Cruce con la competición"
                  subtitle={`${partidos.length} partido${partidos.length === 1 ? "" : "s"} en las hojas de ABP · minutos de todos los microciclos planificados`}
                  icon={TriangleAlert}
                  action={
                    <div className="flex flex-wrap items-center gap-2">
                      <Segmented
                        ariaLabel="Lado"
                        value={filtroLado}
                        onChange={setFiltroLado}
                        options={[
                          { key: "todos" as const, label: "Todo" },
                          { key: "ofensivo" as const, label: "Ofensivo" },
                          { key: "defensivo" as const, label: "Defensivo" },
                        ]}
                      />

                      <Segmented
                        ariaLabel="Orden"
                        value={orden}
                        onChange={setOrden}
                        options={[
                          { key: "urgencia" as const, label: "Urgencia" },
                          { key: "minutos" as const, label: "Minutos" },
                          { key: "catalogo" as const, label: "Catálogo" },
                        ]}
                      />
                    </div>
                  }
                  bodyClassName="p-0"
                >
                  <CruceTabla filas={filasVisibles} />

                  <div className="space-y-1.5 border-t border-white/10 px-4 py-3 sm:px-5">
                    <p className="text-[10.5px] leading-relaxed text-white/35">
                      <span className="text-white/55">Urgencia</span> pesa el
                      volumen en competición (40 %), lo mal que sale la jugada
                      comparada con las de su familia (35 %) y lo poco que se ha
                      trabajado (25 %). Un saque de banda no se juzga con la vara
                      de un córner: la referencia de cada aspecto es la media de
                      su propia familia, y aparece junto al peligro. Los dos
                      últimos ingredientes se ponderan por la muestra, así que un
                      aspecto que nunca ocurre no puede salir urgente.
                    </p>

                    <p className="text-[10.5px] leading-relaxed text-white/35">
                      <span className="text-white/55">Transferencia</span>{" "}
                      compara los partidos precedidos de trabajo de ese aspecto
                      con los que no lo tuvieron, enlazando cada microciclo con
                      su partido por el rival. Sólo cuentan las semanas que
                      están planificadas aquí.
                    </p>

                    <p className="text-[10.5px] leading-relaxed text-white/35">
                      Las hojas no separan el córner directo del jugado en corto:
                      esa división se lee del{" "}
                      <span className="text-white/55">Tipo_Envio</span> (corto =
                      indirecto). Y no registran saque de medio, reinicio de
                      portería ni libre indirecto dentro del área, así que ahí no
                      hay nada que cruzar todavía.
                    </p>

                    {bandaSinZona > 0 && (
                      <p className="text-[10.5px] leading-relaxed text-amber-300/60">
                        {bandaSinZona} saque{bandaSinZona === 1 ? "" : "s"} de
                        banda sin zona anotada en la hoja: no entra
                        {bandaSinZona === 1 ? "" : "n"} en Z1, Z2 ni Z3, así que
                        queda{bandaSinZona === 1 ? "" : "n"} fuera de este
                        reparto.
                      </p>
                    )}
                  </div>
                </Panel>
              </div>
            </>
          )}
        </div>
      </main>

      {/* ======================== DIÁLOGOS ======================== */}

      {editor && (
        <TrabajoDialog
          trabajo={editor.trabajo}
          dia={editor.dia}
          nuevo={editor.origen === null}
          onGuardar={(trabajo, destino) => {
            guardaTrabajo(trabajo, destino, editor.origen);
            setEditor(null);
          }}
          onBorrar={
            editor.origen
              ? () => {
                  borraTrabajo(editor.origen as DiaKey, editor.trabajo.id);
                  setEditor(null);
                }
              : undefined
          }
          onCerrar={() => setEditor(null)}
        />
      )}

      {importando && (
        <ImportarRegistro
          tareas={tareasAbpDelMicro}
          yaImportadas={yaImportadas}
          onImportar={importa}
          onCerrar={() => setImportando(false)}
        />
      )}
    </div>
  );
}
