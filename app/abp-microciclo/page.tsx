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

import { useCallback, useEffect, useMemo, useRef, useState, useSyncExternalStore } from "react";
import {
  Brain,
  CalendarDays,
  ClipboardCopy,
  Dumbbell,
  Flame,
  Mail,
  Plus,
  Download,
  Sparkles,
  Target,
  TriangleAlert,
  CalendarRange as PestanaCalendarRange,
  PieChart as PestanaPieChart,
  Trophy as PestanaTrophy,
} from "lucide-react";

import { BocetoDialog } from "@/components/abp/microciclo/BocetoDialog";
import { InformeMicroDialog, type DatosDelMicro, type ResultadoIncrustado } from "@/components/abp/InformeMicroDialog";
import { objetivoDeLaSemana } from "@/lib/abp/informe-micro";
import {
  VIDEO_JUGADORES_KEY,
  eligeVideoJugadores,
  normalizaVideosJugadores,
  type DocVideoJugadores,
} from "@/lib/abp/video-jugadores";

import { toast } from "sonner";

import { Sidebar } from "@/components/ui/sidebar";
import { Topbar } from "@/components/ui/topbar";
import { EsqueletoPantalla } from "@/components/ui/estados";
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
} from "@/components/abp/ui";
import { Pestanas, usePestanaUrl } from "@/components/analisis/Pestanas";
import { useTextosExplicativos } from "@/components/ui/textos-analisis";
import { SemanaGrid } from "@/components/abp/microciclo/SemanaGrid";
import { TrabajoDialog } from "@/components/abp/microciclo/TrabajoDialog";
import {
  ImportarRegistro,
  type Importacion,
} from "@/components/abp/microciclo/ImportarRegistro";
import { CruceTabla } from "@/components/abp/microciclo/CruceTabla";
import { CopiarMicro } from "@/components/abp/microciclo/CopiarMicro";
import { copiaPlan, type MdPorDia, type ModoCopia } from "@/lib/abp/copia-micro";
import { useEscudos } from "@/hooks/useEscudos";
import { useRemoteDoc } from "@/hooks/useRemoteDoc";
import { chipInk } from "@/lib/theme";
import {
  DIAS,
  EMPTY_MICRO_STORE,
  LADOS,
  LADO_COLOR,
  LADO_LABEL,
  MOMENTOS,
  ROLES,
  claveAspecto,
  claveMicro,
  diasCompletos,
  diasDeLaSemana,
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
  type PlanDia,
} from "@/lib/abp/microciclo";
import {
  buscaPartido,
  loadCompeticion,
  type CompeticionDataset,
} from "@/lib/abp/competicion";
import {
  aspectosDeTarea,
  esTareaAbp,
  ladoDeTarea,
  loadRegistro,
  type RegistroDataset,
} from "@/lib/abp/registro";
import { etiquetaDia, ventanaDelMicro } from "@/lib/abp/ventana";
import {
  conVentana,
  lecturaDelPartido,
  revisaSemana,
  type DiaSabido,
  type PuntoRevision,
} from "@/lib/abp/semana-revision";
import {
  buscaJornada,
  cargaJornadas,
  enlaceAbpRival,
  enlacePlanDePartido,
  type JornadaRival,
} from "@/lib/abp/jornada";
import { PartidoDeLaSemana } from "@/components/abp/microciclo/PartidoDeLaSemana";
import { LecturaDelPartido, RevisionSemana } from "@/components/abp/microciclo/RevisionSemana";
import {
  soloDia,
  type PartidoCastilla,
} from "@/lib/castilla/calendario";
import { cargaCalendario } from "@/hooks/useCalendario";
import {
  colorUrgencia,
  construyeCruce,
  construyeTrabajoPrevio,
  etiquetaUrgencia,
  formulaUrgencia,
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

/*
| INCRUSTADA (03/10/2026).
|
| El informe del partido, en Microciclos, abre esta pantalla en un marco oculto
| con `?incrustado=<temporada>|<micro>&modo=previa|post` para llevarse el
| informe de balón parado entero sin calcularlo dos veces. En ese modo la
| pantalla **sólo lee**: no rellena el plan con las tareas del registro ni
| guarda nada, y entrega el informe por `postMessage` a quien la abrió.
|
| Se lee de la barra de direcciones con `useSyncExternalStore`, como en la
| pizarra táctica: `useSearchParams` obligaría a envolver la página en un
| `Suspense`, y con la instantánea de servidor vacía no hay desajuste al hidratar.
*/
const parametro = (nombre: string) => () => new URLSearchParams(window.location.search).get(nombre) ?? "";

const parametroIncrustado = parametro("incrustado");

const parametroModo = parametro("modo");

function sinParametro() {
  return "";
}

function seSabraAlLlegar(avisa: () => void) {
  const aviso = setTimeout(avisa, 0);

  return () => clearTimeout(aviso);
}

/** «2026 - 2027» y «2026-2027» son la misma temporada. */
const mismaTemporada = (una: string, otra: string) => una.replace(/\s+/g, "") === otra.replace(/\s+/g, "");

/** Entrega el resultado a quien abrió la pantalla en el marco. */
function entrega(resultado: ResultadoIncrustado) {
  if (window.parent === window) return;

  window.parent.postMessage({ tipo: "abp-informe", ...resultado }, window.location.origin);
}

export default function AbpMicrocicloPage() {
  /*
  | Tres vistas (14/10/2026): la semana (cifras y plan, donde se trabaja), el
  | reparto (lado, momento, rol) y el cruce con la competición.
  */
  const [vista, setVista] = usePestanaUrl<"semana" | "reparto" | "competicion">("vista", ["semana", "reparto", "competicion"], "semana");
  const explicativos = useTextosExplicativos();

  const pedidoIncrustado = useSyncExternalStore(seSabraAlLlegar, parametroIncrustado, sinParametro);

  const modoIncrustado = useSyncExternalStore(seSabraAlLlegar, parametroModo, sinParametro) === "post" ? "post" : "previa";

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

  /* Nuestro calendario, para saber qué día es MD-1 de cada microciclo. Lo baja
     de BeSoccer el ordenador del club (scripts/castilla-calendario.cjs). */
  const [calendario, setCalendario] = useState<PartidoCastilla[]>([]);

  const [hoy, setHoy] = useState("");

  /*
  | Las jornadas de la hoja RIVALES (21/10/2026): con su `ID` se abren la
  | pizarra de ABP y el plan de ese partido. Va aparte de la carga principal
  | porque puede tardar, y la semana no tiene por qué esperarla.
  */
  const [jornadas, setJornadas] = useState<JornadaRival[]>([]);

  useEffect(() => {
    const control = new AbortController();

    cargaJornadas(control.signal)
      .then((lista) => setJornadas(lista))
      .catch(() => undefined);

    return () => control.abort();
  }, []);

  /* --------------------------- CARGA DE HOJAS --------------------------- */

  useEffect(() => {
    let cancelado = false;

    const cargar = async () => {
      const [datosRegistro, datosCompeticion, partidos] = await Promise.all([
        loadRegistro().catch(() => null),
        loadCompeticion(),
        /* El calendario compartido: `[]` si no está o falla. */
        cargaCalendario(),
      ]);

      if (cancelado) return;

      /* Hoy, para «faltan 4 días»: se toma aquí y no en el render, que tiene
         que ser puro. La fecha de Madrid, no la UTC. */
      setHoy(new Intl.DateTimeFormat("sv-SE", { timeZone: "Europe/Madrid" }).format(new Date()));

      setRegistro(datosRegistro);
      setErrorRegistro(datosRegistro === null);
      setCompeticion(datosCompeticion);
      setCalendario(partidos);
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
  /* Incrustada, el micro lo dice la dirección: «<temporada>|<micro>». */
  const microIncrustado = useMemo(() => {
    if (!pedidoIncrustado) return undefined;

    const corte = pedidoIncrustado.lastIndexOf("|");

    const temporada = pedidoIncrustado.slice(0, corte);
    const numero = Number(pedidoIncrustado.slice(corte + 1));

    return micros.find((micro) => micro.micro === numero && mismaTemporada(micro.temporada, temporada));
  }, [pedidoIncrustado, micros]);

  const claveActiva = pedidoIncrustado
    ? (microIncrustado?.clave ?? "")
    : seleccion && micros.some((micro) => micro.clave === seleccion)
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

  /**
   * TODAS las tareas de la hoja de este microciclo, no sólo las de ABP.
   *
   * Son las que dicen **qué días se entrena**: el microciclo del Sant Andreu va
   * de domingo a miércoles, y eso no se puede deducir del calendario.
   */
  const tareasDelMicro = useMemo(() => {
    if (!registro || !microActivo) return [];

    return registro.tareas.filter(
      (tarea) =>
        tarea.micro === microActivo.micro &&
        tarea.temporada === microActivo.temporada,
    );
  }, [registro, microActivo]);

  /** Los días de este microciclo, en su orden, con su fecha y su partido. */
  const ventana = useMemo(
    () =>
      ventanaDelMicro({
        tareas: tareasDelMicro,
        rival: microActivo?.rival ?? "",
        partidos: calendario,
        /* Para un microciclo que todavía no está escrito en la hoja: con esto
           los días salen del calendario en vez de un lunes-a-domingo vacío. */
        diasEntrenados: plan.diasEntrenados,
      }),
    [tareasDelMicro, microActivo, calendario, plan.diasEntrenados],
  );

  /* Sin letras repetidas: dos columnas con la misma inicial editarían el mismo
     día, y dnd-kit no sabría en cuál se suelta. La ventana lo avisa. */
  const ordenDias = useMemo(
    () => [...new Set(ventana.dias.map((dia) => dia.clave))],
    [ventana],
  );

  const etiquetasDia = useMemo(() => {
    const mapa: Partial<Record<DiaKey, string>> = {};

    /* "domingo 20" no cabe en la cabecera: sólo el número. */
    for (const dia of ventana.dias) mapa[dia.clave] = dia.fecha.slice(8, 10);

    return mapa;
  }, [ventana]);

  /*
  | LO QUE LA HOJA YA SABE DE LOS DÍAS (21/10/2026).
  |
  | Qué día se juega, cuál se descansa y qué MD es cada uno lo dice la hoja de
  | registro (o el calendario). Mientras nadie los marque a mano, se pintan
  | encima del plan: todo día nace «entreno», y la semana sin tocar enseñaba el
  | domingo de partido como sesión y contaba siete días de trabajo. Al editar,
  | lo pintado se guarda con lo demás (`mutaPlan`).
  */
  const sabidos = useMemo<DiaSabido[]>(
    () => ventana.dias.map((dia) => ({ clave: dia.clave, tipo: dia.tipo, rotulo: dia.rotulo })),
    [ventana],
  );

  const planVisto = useMemo(() => conVentana(plan, sabidos), [plan, sabidos]);


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

        /* Los documentos viejos pueden traer días a medias. Y lo que la hoja
           sabe de los días se guarda con el primer cambio: lo que se ve es lo
           que queda. */
        const completo: MicroPlan = conVentana({ ...base, dias: diasCompletos(base) }, sabidos);

        return {
          ...actual,
          micros: { ...micros, [claveActiva]: fn(completo) },
        };
      });
    },
    [claveActiva, microActivo, setStore, sabidos],
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

  /**
   * Cuántos días se entrenó, dicho a mano.
   *
   * Vacío vuelve a lo deducido del plan. Existe porque el tipo de los días no
   * se puede creer mientras nadie lo toque: todo día nace «entreno», así que
   * una semana sin marcar declaraba siete entrenamientos y el objetivo de
   * minutos salía al máximo en todas.
   */
  const cambiaDiasEntrenados = useCallback(
    (texto: string) =>
      mutaPlan((actual) => {
        const numero = Number.parseInt(texto, 10);

        const limpio =
          Number.isFinite(numero) && numero > 0
            ? Math.min(7, numero)
            : undefined;

        return { ...actual, diasEntrenados: limpio };
      }),
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

  /* El boceto de la semana: lo propone la app y se aplica al plan a mano. */
  const [bocetoAbierto, setBocetoAbierto] = useState(false);

  /* El informe de la semana: se mira aquí y se manda por correo desde la
     cuenta del club. Lo arma `lib/abp/informe-micro.ts`. */
  const [informeAbierto, setInformeAbierto] = useState(false);

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

        seleccionadas.forEach(({ tarea, lado, aspecto, lados, aspectos }) => {
          const dia = (tarea.dia || "L") as DiaKey;

          const trabajo = nuevoTrabajo({
            /* La hoja anota un lado por tarea; aquí se pueden marcar los dos
               abriendo el bloque. El relleno automático ya trae los dos
               cuando la hoja menciona of y def. */
            lados: lados?.length ? lados : [lado],
            aspectos: aspectos?.length ? aspectos : [aspecto],
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

        /* Lo importado a mano también cuenta como tratado: el relleno
           automático no lo vuelve a meter. */
        const tratadas = new Set(actual.deRegistro ?? []);

        for (const { tarea } of seleccionadas) tratadas.add(idTarea(tarea.micro, tarea.dia, tarea.tarea));

        return { ...actual, dias, deRegistro: [...tratadas] };
      });

      setImportando(false);
    },
    [mutaPlan],
  );

  /*
  | EL MICROCICLO DE ABP SE RELLENA SOLO CON LO QUE DICE EL MICROCICLO
  | (02/10/2026).
  |
  | Al abrir un micro, las tareas de balón parado que tiene en la hoja de
  | registro y que todavía no están en la semana entran solas: su día, su
  | lado (los dos si la hoja dice «of y def»), sus aspectos, sus minutos y
  | sus cargas medidas. Encima de eso se edita como siempre.
  |
  | Cada tarea se trata UNA vez (`deRegistro`): si se borra de la semana, no
  | vuelve. Las que no dicen qué aspecto trabajan («ABP global») no se
  | inventan: se avisa y quedan para «Importar del registro».
  */
  const rellenadas = useRef(new Set<string>());

  useEffect(() => {
    /* Incrustada sólo se lee: nada de rellenar el plan al abrir. */
    if (pedidoIncrustado) return;

    if (status === "loading" || !registro || !microActivo || !claveActiva) return;

    const tratadas = new Set([...(plan.deRegistro ?? []), ...yaImportadas]);

    const nuevas = tareasAbpDelMicro.filter((tarea) => {
      const id = idTarea(tarea.micro, tarea.dia, tarea.tarea);

      return !tratadas.has(id) && !rellenadas.current.has(`${claveActiva}|${id}`);
    });

    if (!nuevas.length) return;

    for (const tarea of nuevas) rellenadas.current.add(`${claveActiva}|${idTarea(tarea.micro, tarea.dia, tarea.tarea)}`);

    const entran: Importacion[] = [];

    let sinAspecto = 0;

    for (const tarea of nuevas) {
      const aspectos = aspectosDeTarea(tarea);

      if (!aspectos.length) {
        sinAspecto += 1;

        continue;
      }

      const lado = ladoDeTarea(tarea);

      entran.push({
        tarea,
        lado: lado ?? "ofensivo",
        aspecto: aspectos[0],
        lados: lado ? [lado] : ["ofensivo", "defensivo"],
        aspectos,
      });
    }

    importa(entran);

    /* Las que no se pudieron leer también quedan tratadas: no se insiste. */
    if (sinAspecto) {
      mutaPlan((actual) => ({
        ...actual,
        deRegistro: [
          ...new Set([
            ...(actual.deRegistro ?? []),
            ...nuevas.map((tarea) => idTarea(tarea.micro, tarea.dia, tarea.tarea)),
          ]),
        ],
      }));
    }

    if (entran.length || sinAspecto) {
      toast.success(`Microciclo ${microActivo.micro}: ${entran.length === 1 ? "1 tarea de ABP del registro puesta" : `${entran.length} tareas de ABP del registro puestas`} en la semana`, {
        description:
          (sinAspecto ? `${sinAspecto} no dicen qué aspecto trabajan: están en «Importar del registro». ` : "") +
          "Edítalo encima como quieras: lo que quites no vuelve.",
      });
    }
  }, [pedidoIncrustado, status, registro, microActivo, claveActiva, plan.deRegistro, yaImportadas, tareasAbpDelMicro, importa, mutaPlan]);

  /* ------------------------------ BOCETO ------------------------------- */

  /**
   * Aplicar lo propuesto.
   *
   * Llega la semana entera ya montada (`lib/abp/boceto.ts`): los días con su
   * tipo y su MD, y las tareas con su marca. Se escribe de una vez —un solo
   * guardado— y se apunta el rival del próximo partido si el microciclo no
   * tenía ninguno, que es lo que ata el plan con la competición.
   */
  const aplicaBoceto = useCallback(
    (dias: Record<DiaKey, PlanDia>, rival: string, diasEntrenados: number) => {
      /* Volver a proponer sustituye los bloques del boceto anterior, también
         los retocados a mano: con «Deshacer», como al copiar otro micro
         (19/10/2026). Vuelve a ESTA semana aunque se cambie de micro. */
      const destino = claveActiva;
      const antes = destino ? store.micros?.[destino] : undefined;

      mutaPlan((actual) => ({
        ...actual,
        rival: actual.rival || rival,
        dias,
        diasEntrenados,
      }));

      setBocetoAbierto(false);

      toast.success("Boceto aplicado", {
        description: "Está en la semana como cualquier otra tarea: muévelo, recórtalo y ciérralo.",
        action: destino
          ? {
              label: "Deshacer",
              onClick: () =>
                setStore((actual) => {
                  const lista = { ...(actual.micros ?? {}) };

                  if (antes) lista[destino] = antes;
                  else delete lista[destino];

                  return { ...actual, micros: lista };
                }),
            }
          : undefined,
      });
    },
    [mutaPlan, claveActiva, store.micros, setStore],
  );

  /* ----------------------- COPIAR OTRO MICROCICLO ---------------------- */

  const [copiando, setCopiando] = useState(false);

  /** El MD de cada día de una ventana, por su letra. */
  const mdDeVentana = useCallback((dias: { clave: DiaKey; rotulo: string; md: number | null }[]) => {
    const mapa: MdPorDia = {};

    for (const dia of dias) {
      mapa[dia.clave] = dia.rotulo || (dia.md === null ? "" : dia.md === 0 ? "MD" : `MD-${dia.md}`);
    }

    return mapa;
  }, []);

  /* Las semanas de las que se puede copiar: las que tienen algún bloque. */
  const opcionesCopia = useMemo(
    () =>
      micros
        .filter((uno) => uno.clave !== claveActiva)
        .map((uno) => ({
          clave: uno.clave,
          etiqueta: `Micro ${uno.micro} · ${store.micros?.[uno.clave]?.rival || uno.rival || "sin rival"}`,
          trabajos: trabajosDelPlan(store.micros?.[uno.clave]).length,
        }))
        .filter((uno) => uno.trabajos > 0)
        .reverse(),
    [micros, claveActiva, store.micros],
  );

  /** La copia de otra semana sobre ésta, sin aplicarla todavía. */
  const copiaDe = useCallback(
    (clave: string, modo: ModoCopia) => {
      const origen = store.micros?.[clave];
      const suyo = micros.find((uno) => uno.clave === clave);

      if (!origen || !suyo) return null;

      /* Los días del otro micro salen de su propia ventana: su MD-1 no tiene
         por qué caer en la misma letra que el de ésta. */
      const ventanaOrigen = ventanaDelMicro({
        tareas: (registro?.tareas ?? []).filter(
          (tarea) => tarea.micro === suyo.micro && tarea.temporada === suyo.temporada,
        ),
        rival: suyo.rival,
        partidos: calendario,
        diasEntrenados: origen.diasEntrenados,
      });

      return copiaPlan(origen, planVisto, {
        modo,
        mdOrigen: mdDeVentana(ventanaOrigen.dias),
        mdDestino: mdDeVentana(ventana.dias),
        diasDestino: ordenDias,
      });
    },
    [store.micros, micros, registro, calendario, planVisto, mdDeVentana, ventana, ordenDias],
  );

  const aplicaCopia = useCallback(
    (clave: string, modo: ModoCopia) => {
      const hecho = copiaDe(clave, modo);

      if (!hecho || !claveActiva) return;

      /* El deshacer vuelve a ESTA semana aunque entretanto se haya cambiado de micro. */
      const destino = claveActiva;
      const antes = store.micros?.[destino];

      mutaPlan(() => hecho.plan);

      setCopiando(false);

      const nombre = opcionesCopia.find((uno) => uno.clave === clave)?.etiqueta ?? "el otro micro";

      toast.success(`Copiado de ${nombre}`, {
        description:
          `${hecho.puestas === 1 ? "1 bloque atado" : `${hecho.puestas} bloques atados`} por MD.` +
          (hecho.sinPareja > 0 ? ` ${hecho.sinPareja} sin su MD en esta semana se han quedado fuera.` : "") +
          " Repasa minutos y aspectos.",
        action: {
          label: "Deshacer",
          onClick: () =>
            setStore((actual) => {
              const lista = { ...(actual.micros ?? {}) };

              if (antes) lista[destino] = antes;
              else delete lista[destino];

              return { ...actual, micros: lista };
            }),
        },
      });
    },
    [copiaDe, claveActiva, store.micros, mutaPlan, opcionesCopia, setStore],
  );

  /* ------------------------------ TOTALES ------------------------------ */

  const entradas = useMemo(() => trabajosDelPlan(plan), [plan]);
  const totales = useMemo(() => totalesDe(entradas), [entradas]);

  /* Con qué comparar las cargas: la media de los demás micros guardados que
     las llevan puestas. Una cifra suelta no lleva a ninguna decisión. */
  const mediaCargas = useMemo(() => {
    const otras = Object.entries(store.micros ?? {})
      /* Sólo micros con rival: la semana introductoria o sin partido no es comparable. */
      .filter(([clave, otro]) => clave !== claveActiva && Boolean(otro.rival))
      .map(([, otro]) => totalesDe(trabajosDelPlan(otro)));

    const media = (campo: "carga" | "cargaCog") => {
      const con = otras.filter((una) => una[campo] > 0);

      return con.length
        ? { valor: Math.round(con.reduce((suma, una) => suma + una[campo], 0) / con.length), n: con.length }
        : null;
    };

    return { carga: media("carga"), cargaCog: media("cargaCog") };
  }, [store.micros, claveActiva]);

  /* Los días que cuentan para el objetivo, y de dónde sale ese número. */
  const semana = useMemo(() => diasDeLaSemana(planVisto), [planVisto]);

  const objetivoSemana = useMemo(
    () => objetivoDeLaSemana(totales.minutos, semana.dias, semana.origen),
    [totales.minutos, semana],
  );

  const minutosMicro = useMemo(() => minutosPorAspecto(entradas), [entradas]);

  const minutosTemporada = useMemo(() => {
    const mapa = new Map<string, number>();

    Object.values(store.micros ?? {}).forEach((otro) => {
      trabajosDelPlan(otro).forEach(({ trabajo }) => {
        /* Los minutos se reparten entre los aspectos y los lados de la
           tarea, igual que en el microciclo activo. */
        const { aspectos, lados } = trabajo;

        const parte = (trabajo.minutos || 0) / (aspectos.length * lados.length);

        aspectos.forEach((aspecto) => {
          lados.forEach((lado) => {
            const clave = claveAspecto(aspecto, lado);

            mapa.set(clave, (mapa.get(clave) ?? 0) + parte);
          });
        });
      });
    });

    return mapa;
  }, [store.micros]);

  const partidos = useMemo(() => competicion?.partidos ?? [], [competicion]);

  /*
  | De dónde salen las cifras del cruce (21/10/2026). «15 partidos» con 8
  | jornadas jugadas no se entendía: son todos los partidos de nuestras hojas
  | de ABP, también los de pretemporada y copa, y las acciones son las del
  | Castilla (atacando, las nuestras; defendiendo, las del rival contra
  | nosotros).
  */
  const baseDelCruce = useMemo(() => {
    const cuenta = (tipo: string) => partidos.filter((uno) => uno.competicion === tipo).length;
    const liga = cuenta("liga");
    const copa = cuenta("copa");
    const amistosos = cuenta("amistoso");
    const trozos = [
      liga ? `${liga} de liga` : "",
      copa ? `${copa} de copa` : "",
      amistosos ? `${amistosos} de pretemporada` : "",
    ].filter(Boolean);

    if (!partidos.length) return "Minutos de todos los microciclos planificados";

    return `Acciones del Castilla en ${partidos.length} ${partidos.length === 1 ? "partido" : "partidos"} de nuestras hojas de ABP (${trozos.join(", ")}): atacando, las nuestras; defendiendo, las del rival. Minutos de todos los microciclos planificados.`;
  }, [partidos]);

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

  /* ------------------------------ LA SEMANA ---------------------------- */

  /*
  | Cómo se pintan los bloques.
  |
  | «Completa» de salida: la semana se comparte por pantallazo con gente que
  | no entra en la app, y con la ficha recortada no se podía saber qué se iba
  | a trabajar. «Compacta» es la de antes, para cuando lo que se está haciendo
  | es mover bloques de un día a otro y hacen falta más días a la vista.
  */
  /* «Según el día» de salida (21/10/2026): completa, salvo los días con tres
     o más tareas, que van compactos para no hacer columnas larguísimas. */
  const [vistaSemana, setVistaSemana] = useState<"auto" | "completa" | "compacta">(
    "auto",
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

    /*
    | Por urgencia o por minutos, sólo lo que tiene algo que decir: lo que
    | ninguna hoja registra o no ha pasado ni se ha trabajado nunca se queda
    | en «Catálogo» (21/10/2026). Eran ocho filas de ceros al pie de la tabla.
    */
    const conAlgo = filtradas.filter(
      (fila) => fila.urgencia != null && (fila.stats.acciones > 0 || fila.minutosTemporada > 0),
    );

    return [...conAlgo].sort((a, b) => {
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

  /* ------------------------ PARTIDO Y REVISIÓN ------------------------- */

  /*
  | Dónde cae una tarea nueva que se pide desde fuera de la rejilla (una
  | urgencia, la revisión): el primer día de sesión del microciclo. Antes era
  | siempre el lunes, que en un microciclo de domingo a miércoles no existe.
  */
  const primerDiaSesion = useMemo<DiaKey>(
    () => ordenDias.find((clave) => planVisto.dias[clave]?.tipo === "entreno") ?? ordenDias[0] ?? "L",
    [ordenDias, planVisto],
  );

  const planificaAspecto = useCallback(
    (aspecto: Trabajo["aspectos"][number], lado: AbpLado) =>
      setEditor({
        trabajo: nuevoTrabajo({ aspectos: [aspecto], lados: [lado] }),
        dia: primerDiaSesion,
        origen: null,
      }),
    [primerDiaSesion],
  );

  /* La jornada de la hoja RIVALES de este partido: la llave de la pizarra. */
  const jornadaRival = useMemo(
    () =>
      buscaJornada(jornadas, {
        fecha: ventana.partido ? soloDia(ventana.partido.cuando) : undefined,
        rival: ventana.partido?.rival || plan.rival,
      }),
    [jornadas, ventana.partido, plan.rival],
  );

  const enlaces = useMemo(
    () => ({
      pizarra: jornadaRival?.id ? `/abp-pizarra?rival=${encodeURIComponent(jornadaRival.id)}` : "/abp-pizarra",
      abpRival: enlaceAbpRival(ventana.partido?.rival || plan.rival),
      plan: jornadaRival ? enlacePlanDePartido(jornadaRival) : null,
    }),
    [jornadaRival, ventana.partido, plan.rival],
  );

  const puntosRevision = useMemo<PuntoRevision[]>(
    () => revisaSemana({ plan: planVisto, orden: ordenDias, objetivo: objetivoSemana, urgentes: prioridades }),
    [planVisto, ordenDias, objetivoSemana, prioridades],
  );

  /*
  | Lo que dejó el partido, cuando ya se jugó: las acciones de ESA jornada de
  | liga, no las del rival en la ida.
  */
  const lectura = useMemo(() => {
    const partido = ventana.partido;

    if (!partido?.jugado || !competicion) return null;

    const delPartido = competicion.events.filter(
      (event) => event.contexto.jornada.competicion === "liga" && event.contexto.jornada.numero === partido.jornada,
    );

    if (!delPartido.length) return null;

    return lecturaDelPartido(delPartido, minutosMicro);
  }, [ventana.partido, competicion, minutosMicro]);

  /*
  | La pieza de la semana (21/10/2026): nuestro vídeo de ABP para los
  | jugadores de esta jornada, el que sube el vigía. Si no está, no se nombra.
  */
  const [videosJugadores, setVideosJugadores] = useState<DocVideoJugadores | null>(null);

  useEffect(() => {
    let cancelado = false;

    fetch(`/api/docs?key=${encodeURIComponent(VIDEO_JUGADORES_KEY)}`, { cache: "no-store" })
      .then((respuesta) => (respuesta.ok ? respuesta.json() : null))
      .then((datos) => {
        if (!cancelado) setVideosJugadores(normalizaVideosJugadores(datos?.data));
      })
      .catch(() => {});

    return () => {
      cancelado = true;
    };
  }, []);

  const pieza = useMemo(() => {
    if (!videosJugadores || !ventana.partido) return null;

    const video = eligeVideoJugadores(videosJugadores, ventana.partido.jornada ?? null, ventana.partido.rival);

    return video ? { url: video.url, segundos: video.segundos } : null;
  }, [videosJugadores, ventana.partido]);

  /* Los días del diálogo de una tarea: los de este microciclo, con su MD. */
  const diasDialogo = useMemo(
    () =>
      ordenDias.map((clave) => {
        const info = DIAS.find((dia) => dia.key === clave);

        return {
          clave,
          rotulo: `${info?.corto ?? clave} ${etiquetasDia[clave] ? Number(etiquetasDia[clave]) : ""}`.trim(),
          detalle: planVisto.dias[clave]?.md || undefined,
        };
      }),
    [ordenDias, etiquetasDia, planVisto],
  );

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

  /* Lo que el informe de ABP necesita de esta pantalla. */
  const datosInforme: DatosDelMicro = {
    temporada: plan.temporada || microActivo?.temporada || "",
    micro: plan.micro || microActivo?.micro || 0,
    rival: plan.rival,
    partido: partidoDelMicro
      ? {
          jornada: partidoDelMicro.jornada,
          rival: partidoDelMicro.rival,
        }
      : null,
    /*
    | El partido de la semana en el calendario: jornada, hora y, si ya
    | se jugó, el resultado. Con él el informe decide si toca previa o
    | post y encuentra las acciones de ESA jornada (no las de la ida).
    */
    partidoCalendario: ventana.partido
      ? {
          jornada: ventana.partido.jornada,
          cuando: ventana.partido.cuando,
          rival: ventana.partido.rival,
          lado: ventana.partido.lado,
          golesFavor: ventana.partido.golesFavor,
          golesContra: ventana.partido.golesContra,
          jugado: ventana.partido.jugado,
        }
      : null,
    /*
    | Los días de ESTE microciclo, para que el reparto por día del
    | informe no se dibuje sobre las siete letras de la semana natural.
    */
    dias: ventana.dias.map((dia) => ({
      clave: dia.clave,
      etiqueta: dia.etiqueta,
      tipo: dia.tipo,
      fecha: dia.fecha,
    })),
    /* De dónde viene la semana: el microciclo va de partido a partido. */
    partidoAnterior: ventana.partidoAnterior
      ? {
          rival: ventana.partidoAnterior.rival,
          cuando: etiquetaDia(soloDia(ventana.partidoAnterior.cuando)),
        }
      : null,
    entradas,
    totales,
    tareas: tareasAbpDelMicro,
    filas,
    prioridades,
    /*
    | Los días de ENTRENAMIENTO de la semana: con ellos se prorratea el
    | objetivo de minutos de ABP (90-100′ en una semana de seis, y su
    | parte en las de menos; el tope de seis lo pone el propio cálculo).
    |
    | Aquí se contaban los días con `tipo === "entreno"` a pelo, y eso
    | estaba roto: **todo día nace «entreno»**, así que un plan al que
    | nadie marca los descansos declaraba siete y el objetivo salía
    | 90-100′ en todas las semanas. `diasDeLaSemana` distingue los tres
    | casos y dice de cuál viene el número, para que el informe pueda
    | contarlo en vez de dar una cifra que nadie puede comprobar.
    */
    diasEntreno: semana.dias,
    origenDias: semana.origen,
    minutosPorAspecto: [...minutosMicro.entries()].map(
      ([clave, minutos]) => ({ clave, minutos }),
    ),
    /*
    | Con qué rehacer el cruce dentro del informe (19/10/2026): el de esta
    | pantalla mete los amistosos de julio y las propuestas del boceto, y el
    | informe habla de competición y de los minutos que cuentan (`minutosAbp`).
    */
    cruce: {
      events: competicion?.events ?? [],
      partidos,
      minutosTemporada,
      trabajoPrevio,
    },
  };

  /* Incrustada: el micro pedido no existe, o la hoja no ha cargado. */
  const incrustadaLista = Boolean(pedidoIncrustado) && !cargando && status !== "loading";

  useEffect(() => {
    if (!incrustadaLista || microIncrustado) return;

    entrega({
      ok: false,
      clave: pedidoIncrustado,
      error: errorRegistro
        ? "No se ha podido leer la hoja de registro de tareas."
        : `No encuentro el microciclo ${pedidoIncrustado.replace("|", " · ")} en Microciclo de Balón Parado.`,
    });
  }, [incrustadaLista, microIncrustado, pedidoIncrustado, errorRegistro]);

  return (
    <div className="flex min-h-screen bg-[#0B0F14] text-white">
      <Sidebar />

      <main className="min-w-0 flex-1">
        <Topbar />

        <div className="mx-auto min-w-0 max-w-[1500px] px-4 py-6 md:px-8 md:py-8">
          <AbpHeader
            area="RMCF Castilla · Balón Parado"
            title="Microciclo de Balón Parado"
            lead={
              explicativos
                ? "Qué se trabaja de ABP cada día de la semana —lado, aspecto, momento de la sesión, campo o vídeo, con qué roles y con cuánto desgaste— y si eso se está notando en el partido."
                : undefined
            }
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

          {/* ====================== SELECTOR ======================
              Dos filas desde el 21/10/2026: qué semana (microciclo, rival y
              días) a la izquierda y qué hacer con ella a la derecha, con lo
              principal —proponerla e informarla— delante. Antes eran ocho
              piezas en una fila que se partía por cualquier sitio. */}

          <div className="mt-6 grid min-w-0 gap-3 2xl:grid-cols-[minmax(0,1fr)_auto] 2xl:items-end">
            <div className="grid min-w-0 gap-3 sm:grid-cols-[minmax(0,1.2fr)_minmax(0,1fr)_150px]">
              <label className="block min-w-0">
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

              <label className="block min-w-0">
                <span className="mb-1.5 block text-[10px] uppercase tracking-[0.16em] text-white/40">
                  Rival de la semana
                </span>

                <input
                  value={plan.rival}
                  onChange={(event) => cambiaRival(event.target.value)}
                  placeholder="Contra quién se juega"
                  className="w-full min-w-0 rounded-xl border border-white/10 bg-white/[0.04] px-3 py-2 text-sm text-white outline-none transition placeholder:text-white/25 focus:border-[#C8A96B]/50"
                />
              </label>

              {/*
                LOS DÍAS QUE SE ENTRENÓ.
                |
                | Con ellos se prorratea el objetivo de balón parado de la semana
                | (90-100′ en una de seis). En blanco se deduce del plan, que desde
                | el 21/10/2026 ya trae los descansos y el partido que dice la hoja.
              */}
              <label className="block min-w-0">
                <span className="mb-1.5 block text-[10px] uppercase tracking-[0.16em] text-white/40">
                  Días entrenados
                </span>

                <input
                  type="number"
                  inputMode="numeric"
                  min={0}
                  max={7}
                  value={plan.diasEntrenados ?? semana.dias}
                  onChange={(event) => cambiaDiasEntrenados(event.target.value)}
                  aria-describedby="dias-entrenados-ayuda"
                  className="w-full rounded-xl border border-white/10 bg-white/[0.04] px-3 py-2 text-sm text-white outline-none transition placeholder:text-white/40 focus:border-[#C8A96B]/50"
                />

                <span id="dias-entrenados-ayuda" className="mt-1 block text-[10px] leading-snug text-white/40">
                  {semana.origen === "a mano"
                    ? "Fijados en el plan"
                    : semana.origen === "marcados"
                      ? `${semana.dias} en el microciclo`
                      : `${semana.dias} con balón parado`}
                </span>
              </label>
            </div>

            <div className="flex min-w-0 flex-wrap gap-2 2xl:justify-end 2xl:pb-[18px]">
              <Button
                tone="primary"
                icon={Sparkles}
                onClick={() => setBocetoAbierto(true)}
                disabled={!claveActiva}
                title="Proponer la semana entera: días, aspectos y minutos, según el próximo partido, nuestro rendimiento y el del rival"
              >
                Proponer boceto
              </Button>

              <Button
                icon={Mail}
                onClick={() => setInformeAbierto(true)}
                disabled={!claveActiva}
                title="Ver el informe de balón parado de esta semana y mandarlo"
              >
                Informe de la semana
              </Button>

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

              <Button
                icon={ClipboardCopy}
                onClick={() => setCopiando(true)}
                disabled={!claveActiva || !opcionesCopia.length}
                title="Traer a esta semana los bloques de otro microciclo, atados por MD"
              >
                Copiar de otro micro
              </Button>

              <Button icon={Plus} onClick={creaMicro}>
                Nuevo microciclo
              </Button>
            </div>
          </div>

          {/* =================== EL PARTIDO DE LA SEMANA =================== */}

          {!cargando && !sinMicros && (
            <PartidoDeLaSemana
              partido={ventana.partido}
              anterior={
                ventana.partidoAnterior
                  ? { rival: ventana.partidoAnterior.rival, cuando: etiquetaDia(soloDia(ventana.partidoAnterior.cuando)) }
                  : null
              }
              rival={plan.rival}
              escudo={escudoDe(ventana.partido?.rival || plan.rival)}
              hoy={hoy}
              minutos={totales.minutos}
              objetivo={objetivoSemana}
              porLado={totales.porLado}
              enlaces={enlaces}
              onVerPost={ventana.partido?.jugado ? () => setInformeAbierto(true) : undefined}
              onProponer={claveActiva ? () => setBocetoAbierto(true) : undefined}
              pieza={pieza}
            />
          )}

          {cargando ? (
            <div className="mt-8">
              <EsqueletoPantalla titulo="el registro de tareas y las hojas de ABP" />
            </div>
          ) : sinMicros ? (
            <div className="mt-8">
              <EmptyState
                title="Todavía no hay ningún microciclo"
                description="La lista sale de la hoja de registro de tareas. Si aún no hay nada registrado, crea uno a mano con «Nuevo microciclo»."
              />
            </div>
          ) : (
            <>
              <div className="mt-6 sm:px-2 md:px-0 lg:px-2">
                <Pestanas
                  etiqueta="Vistas del microciclo de balón parado"
                  valor={vista}
                  onCambia={setVista}
                  opciones={[
                    { clave: "semana", label: "La semana", icono: PestanaCalendarRange },
                    { clave: "reparto", label: "Reparto", icono: PestanaPieChart },
                    { clave: "competicion", label: "Competición", icono: PestanaTrophy },
                  ]}
                />
              </div>

              {vista === "semana" && (
                <>
              {/* ===================== RESUMEN ===================== */}

              {/* Con la semana vacía no hay resumen (21/10/2026): cinco tarjetas
                  con «0′», «0′ / 0′» y «—» parecían una pantalla rota. Lo que
                  queda por hacer ya lo dice la tarjeta del partido. */}
              {totales.minutos > 0 && (
              <div className="mt-7">
                {/* Dos por fila en el móvil: cinco tarjetas apiladas eran una
                    pantalla entera antes de llegar a la semana. */}
                <div className="grid min-w-0 grid-cols-2 gap-3 lg:auto-cols-fr lg:grid-flow-col">
                  <StatCard
                    label="Minutos de ABP"
                    value={fmtMin(totales.minutos)}
                    hint={`${totales.trabajos} trabajo${totales.trabajos === 1 ? "" : "s"} · ${totales.diasConAbp} día${totales.diasConAbp === 1 ? "" : "s"}`}
                    accent="var(--rmcf-gold-ink)"
                  />

                  {/* El reparto ofensivo/defensivo ya va en la tarjeta del
                      partido, justo encima: aquí se repetía. */}
                  {totales.carga > 0 && (
                    <StatCard
                      label="Carga condicional"
                      value={Math.round(totales.carga)}
                      hint={`tiempo × intensidad (más carga = más trabajo, no mejor)${mediaCargas.carga ? ` · media de ${mediaCargas.carga.n} micros: ${mediaCargas.carga.valor}` : ""}`}
                      accent={chipInk("#FBBF24")}
                    />
                  )}

                  {totales.cargaCog > 0 && (
                    <StatCard
                      label="Carga cognitiva"
                      value={Math.round(totales.cargaCog)}
                      hint={`tiempo × exigencia${mediaCargas.cargaCog ? ` · media de ${mediaCargas.cargaCog.n} micros: ${mediaCargas.cargaCog.valor}` : ""}`}
                      accent={chipInk("#8B5CF6")}
                    />
                  )}

                  <StatCard
                    label="Campo / Vídeo"
                    value={`${fmtMin(totales.minutosCampo)} / ${fmtMin(totales.minutosVideo)}`}
                    hint={
                      totales.minutosVideo
                        ? `${Math.round((totales.minutosVideo / totales.minutos) * 100)} % en sala`
                        : "todo en campo"
                    }
                  />
                </div>
              </div>
              )}

              {/* ================ LO QUE DEJÓ EL PARTIDO ================ */}

              {lectura && ventana.partido && (
                <div className="mt-6">
                  <LecturaDelPartido
                    lectura={lectura}
                    rival={ventana.partido.rival}
                    marcador={
                      ventana.partido.golesFavor != null && ventana.partido.golesContra != null
                        ? `${ventana.partido.golesFavor}-${ventana.partido.golesContra}`
                        : null
                    }
                  />
                </div>
              )}

              {/* ======================= REVISIÓN ======================= */}

              <div className="mt-6">
                <RevisionSemana
                  puntos={puntosRevision}
                  onAbrir={(dia, trabajo) => setEditor({ trabajo, dia, origen: dia })}
                  onPlanificar={(falta) => planificaAspecto(falta.aspecto, falta.lado)}
                />
              </div>

              {/* ====================== SEMANA ===================== */}

              <div className="mt-6">
                <Panel
                  title="La semana"
                  subtitle={
                    vistaSemana !== "compacta"
                      ? "Cada bloque enseña todo lo que se trabaja, para que un pantallazo se entienda sin entrar en la app. Pulsa uno para editarlo y arrástralo para cambiarlo de día"
                      : "Fichas cortas, para mover bloques de día. Pulsa uno para editarlo; cada uno se puede duplicar o quitar"
                  }
                  icon={CalendarDays}
                  action={
                    <Segmented
                      ariaLabel="Cómo se ven los bloques"
                      value={vistaSemana}
                      onChange={setVistaSemana}
                      options={[
                        { key: "auto" as const, label: "Según el día" },
                        { key: "completa" as const, label: "Ficha completa" },
                        { key: "compacta" as const, label: "Compacta" },
                      ]}
                    />
                  }
                >
                  {/* De qué partido viene y a cuál va: en la tarjeta del partido
                      de la semana, arriba (21/10/2026). */}

                  {ventana.avisos.length > 0 && (
                    <div className="mb-3">
                      <Notice tone="warn" title="Ojo con los días de este microciclo">
                        <ul className="space-y-1">
                          {ventana.avisos.map((aviso) => (
                            <li key={aviso}>{aviso}</li>
                          ))}
                        </ul>
                      </Notice>
                    </div>
                  )}

                  <SemanaGrid
                    dias={planVisto.dias}
                    orden={ordenDias}
                    etiquetas={etiquetasDia}
                    detalle={vistaSemana === "auto" ? "auto" : vistaSemana === "completa"}
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

                </>
              )}

              {vista === "reparto" && (
                <>
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

                </>
              )}

              {vista === "competicion" && (
                <>
              {/* ==================== PRIORIDADES ================== */}

              <div className="mt-6">
                <Panel
                  title="Lo más urgente ahora mismo"
                  subtitle="Lo que más daño nos hace (peligro y goles), lo que peor nos sale frente a los suyos y lo menos trabajado"
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
                            onClick={() => planificaAspecto(fila.aspecto.key, fila.lado)}
                            aria-label={`Planificar ${fila.aspecto.label} ${LADO_LABEL[fila.lado].toLowerCase()}`}
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
                              {fila.stats.acciones} {fila.stats.acciones === 1 ? "acción" : "acciones"}
                              {fila.stats.remates
                                ? ` · ${fila.stats.remates} ${fila.stats.remates === 1 ? "remate" : "remates"}`
                                : ""}
                              {fila.stats.goles
                                ? ` · ${fila.stats.goles} ${fila.stats.goles === 1 ? "gol" : "goles"} ${fila.lado === "defensivo" ? "en contra" : "a favor"}`
                                : ""}
                              {" · "}
                              {fila.minutosTemporada ? fmtMin(fila.minutosTemporada) : "sin trabajar"}
                            </p>

                            <p
                              className="mt-1.5 text-[10px] uppercase tracking-wide text-white/40"
                              title={formulaUrgencia(fila)}
                            >
                              Urgencia {etiquetaUrgencia(fila.urgencia ?? 0).toLowerCase()} ·
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
                  subtitle={baseDelCruce}
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

                  {/* Cómo se calcula cada columna es método: sólo con los
                      textos explicativos (21/10/2026). */}
                  {explicativos && (
                  <div className="space-y-1.5 border-t border-white/10 px-4 py-3 sm:px-5">
                    <p className="text-[10.5px] leading-relaxed text-white/35">
                      <span className="text-white/55">Urgencia</span> pesa el
                      daño (50 %: defendiendo, las acciones con peligro que nos
                      hacen, y cada gol tres veces; atacando, el peligro que nos
                      falta por las veces que ocurre), lo mal que sale la jugada
                      comparada con las de su familia (30 %) y lo poco que se ha
                      trabajado (20 %). Un aspecto con goles en contra nunca baja
                      de alta ni del tercer puesto. Un saque de banda no se juzga con la vara
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
                      <span className="text-white/55">tipo de envío</span> (corto =
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
                  )}
                </Panel>
              </div>
                </>
              )}
            </>
          )}
        </div>
      </main>

      {/* ======================== DIÁLOGOS ======================== */}

      {editor && (
        <TrabajoDialog
          trabajo={editor.trabajo}
          dia={editor.dia}
          dias={diasDialogo}
          nuevo={editor.origen === null}
          onGuardar={(trabajo, destino) => {
            guardaTrabajo(trabajo, destino, editor.origen);
            setEditor(null);
          }}
          onBorrar={
            editor.origen
              ? () => {
                  /* Por el mismo camino que la tarjeta de la semana, con su
                     «Deshacer» (19/10/2026): el plan se guarda solo y un toque
                     de más en «Quitar» perdía el bloque. */
                  quitaDesdeLaSemana(editor.origen as DiaKey, editor.trabajo);
                  setEditor(null);
                }
              : undefined
          }
          onCerrar={() => setEditor(null)}
        />
      )}

      {bocetoAbierto && (
        <BocetoDialog
          filas={filas}
          plan={planVisto}
          events={competicion?.events ?? []}
          tareasDelMicro={tareasDelMicro}
          rivalDelMicro={microActivo?.rival ?? plan.rival}
          micro={{
            temporada: plan.temporada || microActivo?.temporada || "",
            numero: plan.micro || microActivo?.micro || 0,
          }}
          onAplicar={aplicaBoceto}
          onCerrar={() => setBocetoAbierto(false)}
        />
      )}

      {copiando && (
        <CopiarMicro
          destino={`Micro ${plan.micro || microActivo?.micro || ""}${plan.rival ? ` · ${plan.rival}` : ""}`}
          opciones={opcionesCopia}
          trabajosDestino={entradas.length}
          previa={copiaDe}
          onCopiar={aplicaCopia}
          onCerrar={() => setCopiando(false)}
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

      {incrustadaLista && microIncrustado && (
        <InformeMicroDialog datos={datosInforme} onClose={() => undefined} incrustado={{ modo: modoIncrustado, alListo: entrega }} />
      )}

      {informeAbierto && (
        <InformeMicroDialog
          datos={datosInforme}
          onClose={() => setInformeAbierto(false)}
        />
      )}
    </div>
  );
}
