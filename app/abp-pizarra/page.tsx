"use client";

/**
 * Pizarra de balón parado: el PowerPoint del partido, vivo.
 *
 * Sustituye a montar a mano `RMCF CASTILLA - LIG.01 CD TERUEL.pptx` cada
 * semana. Un tablero por partido, con las siete diapositivas de siempre —se
 * pueden quitar, duplicar, reordenar y añadir—, las caras de la plantilla
 * colocadas sobre el campo en perspectiva y el panel de puestos a la derecha.
 *
 * Cinco cosas que el pptx no podía hacer:
 *
 * 1. **Copiar el partido anterior.** De una semana a la siguiente cambian
 *    cuatro nombres, no las siete diapositivas.
 * 2. **Aprender los puestos.** Cada vez que alguien se coloca en un puesto
 *    queda anotado; los habituales salen los primeros al elegir.
 * 3. **Colocar automáticamente.** Rellena los puestos vacíos —de una
 *    diapositiva o de todas— con lo aprendido, por prioridad y sin repetir a
 *    nadie dentro de la misma.
 * 4. **Guardar el histórico de la jornada.** El pptx se guardaba encima de sí
 *    mismo y la versión del martes se perdía. Aquí cada jornada conserva sus
 *    versiones: la app las va congelando sola cuando se deja de tocar, y se
 *    puede guardar una a mano antes de enseñarla en la sala. Se restauran.
 * 5. **Estar atada al resto de la semana.** El nombre del rival se escribe —la
 *    hoja dice «CD Teruel» y en la sala se dice «Teruel»— y el tablero se cruza
 *    con la fila de la hoja RIVALES, que es la que abren el plan de partido y
 *    el informe del rival. Desde aquí se saltan los tres.
 *
 * El modelo y las medidas viven en `lib/abp/pizarra.ts` (sacadas del propio
 * pptx); el dibujo, en `components/abp/pizarra/TableroSlide.tsx`.
 */

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import {
  Binoculars,
  ChevronLeft,
  ChevronRight,
  ClipboardList,
  GripVertical,
  Copy,
  CopyPlus,
  History,
  LayoutGrid,
  Link2,
  Pencil,
  Pin,
  PinOff,
  Plus,
  RotateCcw,
  Save,
  Shield,
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
  Field,
  Notice,
  Panel,
  SaveState,
} from "@/components/abp/ui";
import { TableroSlide } from "@/components/abp/pizarra/TableroSlide";
import { SelectorJugador } from "@/components/abp/pizarra/SelectorJugador";
import { ExportaPizarra } from "@/components/abp/pizarra/ExportaPizarra";
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
  MOTIVO_LABEL,
  PLANTILLAS,
  PLANTILLA_BY_KEY,
  aplicaVersion,
  aprende,
  colocaAutomatico,
  copiaTablero,
  cuentaPuestos,
  etiquetaVersion,
  fichaNueva,
  fijaVersion,
  huellaTablero,
  huellaVersion,
  puestoDe,
  quitaVersion,
  registraVersion,
  renombraVersion,
  slideDePlantilla,
  normalizaTablero,
  tableroVacio,
  tieneFichas,
  type PizarraStore,
  type SlidePizarra,
  type TableroPizarra,
  type VersionPizarra,
} from "@/lib/abp/pizarra";
import {
  buscaJornada,
  cargaJornadas,
  enlaceAbpRival,
  enlaceAnalisisRival,
  enlacePlanDePartido,
  etiquetaJornada,
  mezclaCalendario,
  mismoEquipo,
  type JornadaRival,
} from "@/lib/abp/jornada";
import { barlowCondensed } from "@/lib/rivals/portada-font";

/**
 * Cuánto se espera, sin tocar nada, antes de congelar una versión.
 *
 * No se guarda una versión por pulsación: eso llenaría el histórico de fotos
 * indistinguibles. Se espera a que el entrenador pare —colocar una diapositiva
 * entera son muchos clics seguidos— y entonces se anota lo que ha quedado.
 */
const ESPERA_VERSION_MS = 45_000;

/**
 * Cómo se lee un partido en el desplegable: "J07 · 18 oct 2026 · @ Teruel".
 *
 * La jornada va delante porque es como el cuerpo técnico llama a la semana. Los
 * amistosos de pretemporada no la tienen y empiezan por la fecha.
 */
function etiquetaPartido(partido: MatchMeta) {
  const numero = partido.competition.match(/^Jornada\s+(\d+)/i);

  const jornada = numero ? `J${numero[1].padStart(2, "0")} · ` : "";

  return `${jornada}${formatMatchDate(partido)} · ${matchLabel(partido)}`;
}

/**
 * Lo que se lee al lado de un partido en el desplegable.
 *
 * Interesa el número de versiones y no un simple «con pizarra»: es lo que dice
 * de un vistazo qué jornadas se trabajaron de verdad y cuáles se quedaron a
 * medias.
 */
function marcaDeTablero(tablero?: TableroPizarra) {
  if (!tablero) return "";

  const total = tablero.versiones?.length ?? 0;

  if (total === 0) return " · con pizarra";

  return ` · ${total} ${total === 1 ? "versión" : "versiones"}`;
}

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

  const [jugados, setJugados] = useState<MatchMeta[]>([]);

  /*
  | La hoja RIVALES: la misma que leen el plan de partido y el informe del
  | rival. Se carga junto al calendario porque las dos hacen falta a la vez
  | para saber qué fila le toca a cada partido —son dos fuentes distintas, una
  | dice «CD Teruel» y la otra «Teruel»— y para poder abrir la jornada que pida
  | el enlace de llegada.
  |
  | Si la hoja no contesta, la página sigue entera: lo único que se pierde son
  | los enlaces y el ABP que el plan ya tenga escrito.
  */
  const [jornadas, setJornadas] = useState<JornadaRival[]>([]);
  const [cargando, setCargando] = useState(true);

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

  /*
  | El almacén, leído desde dentro de la carga.
  |
  | Al resolver el enlace de llegada interesa saber si algún tablero ya está
  | atado a esa jornada, pero el documento remoto puede no haber llegado
  | todavía y no se quiere rehacer la carga cada vez que cambia. Una referencia
  | dice lo que hay en ese momento sin volver a disparar nada.
  */
  const storeRef = useRef(store);

  useEffect(() => {
    storeRef.current = store;
  });

  /*
  | Las dos fuentes se piden a la vez y **fallan por separado**.
  |
  | Son dos sitios distintos —el CSV de partidos jugados y la hoja del plan— y
  | cualquiera de los dos puede no contestar. Encadenarlos dejaba la página en
  | «Cargando calendario…» cuando fallaba el CSV, aunque la hoja tuviera la
  | temporada entera; y al revés, sin hoja se sigue pudiendo trabajar sobre lo
  | jugado. Cada una cae sola y la pizarra se abre con lo que haya.
  */
  useEffect(() => {
    const control = new AbortController();

    const carga = async () => {
      const [jugadosCsv, hoja] = await Promise.all([
        fetchMatches(control.signal).catch((error) => {
          if (!control.signal.aborted) {
            console.error("[abp-pizarra] calendario", error);

            toast.error(
              "No se ha podido leer el calendario de partidos: se trabaja con las jornadas del plan.",
            );
          }

          return [] as MatchMeta[];
        }),
        cargaJornadas(control.signal).catch((error) => {
          if (!control.signal.aborted) {
            console.error("[abp-pizarra] hoja RIVALES", error);
          }

          return [] as JornadaRival[];
        }),
      ]);

      if (control.signal.aborted) return;

      setJugados([...jugadosCsv].sort(compareMatches));
      setJornadas(hoja);
      setCargando(false);

      /*
      | Llegada desde el plan de partido o desde el informe del rival:
      | /abp-pizarra?rival=<ID de la hoja RIVALES>.
      |
      | Esa fila hay que traducirla a un partido del calendario, que es sobre lo
      | que se monta el tablero. Por este orden: un tablero ya atado a la fila,
      | la fecha y el nombre. Si no cuadra ninguno no se cambia de jornada y se
      | dice: es mejor quedarse donde se estaba que abrir la equivocada.
      */
      const pedidoUrl = new URLSearchParams(window.location.search).get(
        "rival",
      );

      if (!pedidoUrl) return;

      const fila = hoja.find((item) => item.id === pedidoUrl);

      const calendario = mezclaCalendario(jugadosCsv, hoja);

      const destino = fila
        ? (calendario.find(
            (item) => storeRef.current.tableros?.[item.id]?.rivalId === fila.id,
          ) ??
          (fila.fecha
            ? calendario.find((item) => item.date === fila.fecha)
            : undefined) ??
          calendario.find((item) => mismoEquipo(item.opponent, fila.equipo)))
        : undefined;

      if (destino) {
        setPedido(destino.id);
      } else if (fila) {
        toast.info(
          `${etiquetaJornada(fila)} no está en el calendario de partidos: elige tú la jornada.`,
        );
      }

      window.history.replaceState({}, "", "/abp-pizarra");
    };

    void carga();

    return () => control.abort();
  }, []);

  /*
  | El calendario de la pizarra: lo jugado más lo que viene.
  |
  | El CSV de partidos se va llenando con lo que ya se ha jugado —en agosto
  | tiene un amistoso—, así que por sí solo no deja preparar el balón parado de
  | la jornada que viene, que es justo para lo que sirve esta página. Las
  | jornadas que faltan salen de la hoja RIVALES, la misma del plan de partido.
  */
  const partidos = useMemo(
    () => mezclaCalendario(jugados, jornadas),
    [jugados, jornadas],
  );

  /*
  | Al entrar manda el último tablero tocado —preparar el ABP es tarea de toda
  | la semana—, y si no hay ninguno se abre la **próxima** jornada, que es la
  | que se va a preparar, no la primera de la temporada.
  */
  const porDefecto = useMemo(() => {
    if (partidos.length === 0) return "";

    const conTablero = partidos.filter((item) => store.tableros?.[item.id]);

    if (conTablero.length) return conTablero[conTablero.length - 1].id;

    const hoy = new Date().toISOString().slice(0, 10);

    return (partidos.find((item) => item.date && item.date >= hoy) ?? partidos[0])
      .id;
  }, [partidos, store.tableros]);

  const elegido = pedido || porDefecto;

  const setElegido = setPedido;

  const partido = useMemo(
    () => partidos.find((item) => item.id === elegido) ?? null,
    [partidos, elegido],
  );

  /*
  | El tablero se pone al día con la plantilla al leerlo, no al guardarlo: si
  | el dibujo de una acción ha cambiado —la barrera pasa a cinco, una fila se
  | abre porque las chapas se tapaban—, la jornada montada hace semanas se abre
  | ya corregida, y lo mismo sale al exportar. Ver `normalizaTablero`.
  */
  const tablero: TableroPizarra | null = useMemo(() => {
    if (!partido) return null;

    const guardado = store.tableros?.[partido.id];

    return guardado
      ? normalizaTablero(guardado)
      : tableroVacio(partido.id, partido.opponent);
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

  /* --------------------------- JORNADA ----------------------------- */

  const jornada = useMemo(() => {
    if (!tablero) return null;

    return buscaJornada(jornadas, {
      rivalId: tablero.rivalId,
      rival: tablero.rival,
      fecha: partido?.date,
    });
  }, [jornadas, tablero, partido]);

  /** Atada a mano: manda sobre el parecido de nombres. */
  const atada = Boolean(tablero?.rivalId);

  /* Cada rival sale dos veces en la liga —ida y vuelta—, y en la lista de
     ayuda del nombre basta con una. */
  const rivalesDeLaHoja = useMemo(
    () => [...new Set(jornadas.map((item) => item.equipo).filter(Boolean))],
    [jornadas],
  );

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

  /* ---------------------- RIVAL Y JORNADA -------------------------- */

  /*
  | El nombre del rival es del tablero, no del calendario. Se escribe donde se
  | va a leer —la diapositiva se proyecta y se imprime—, así que hay que poder
  | corregir lo que trae la hoja sin tocar la hoja.
  */
  const cambiaRival = useCallback(
    (valor: string) => {
      mutaTablero((actual) => ({
        ...actual,
        rival: valor,
        actualizado: new Date().toISOString(),
      }));
    },
    [mutaTablero],
  );

  /** Ata el tablero a una fila de la hoja RIVALES, o lo suelta con "". */
  const ata = useCallback(
    (id: string) => {
      const elegida = jornadas.find((item) => item.id === id) ?? null;

      mutaTablero((actual) => ({
        ...actual,
        rivalId: elegida?.id ?? "",
        jornada: elegida?.jornada ?? "",
        /* El nombre escrito a mano no se pisa: se rellena si estaba vacío. */
        rival: actual.rival.trim() || elegida?.equipo || "",
        actualizado: new Date().toISOString(),
      }));

      if (elegida) toast.success(`Atada a ${etiquetaJornada(elegida)}`);
    },
    [jornadas, mutaTablero],
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

  /*
  | Traer la jornada anterior **no borra lo de ésta**: antes de pisar las
  | diapositivas se congela lo que hubiera, y la copia queda anotada en el
  | histórico. Rehacer la semana desde la anterior era justo el momento en el
  | que el pptx se comía el trabajo del martes.
  */
  const copiaDelAnterior = useCallback(() => {
    if (!partido || !anterior) return;

    const origen = store.tableros?.[anterior.id];

    if (!origen) return;

    const cuando = new Date().toISOString();

    mutaTablero((actual) => {
      const conPrevia = tieneFichas(actual.slides)
        ? registraVersion(actual, { cuando, motivo: "previa" })
        : actual;

      return registraVersion(copiaTablero(origen, conPrevia, cuando), {
        cuando,
        motivo: "copia",
        etiqueta: `Traída de ${matchLabel(anterior)}`,
        forzar: true,
      });
    });

    setPedida(0);

    toast.success(`Copiado de ${matchLabel(anterior)}`);
  }, [partido, anterior, store.tableros, mutaTablero]);

  /* --------------------------- VERSIONES --------------------------- */

  const versiones = useMemo(() => tablero?.versiones ?? [], [tablero]);

  const huellaActual = useMemo(
    () => (tablero ? huellaTablero(tablero.rival, tablero.slides) : ""),
    [tablero],
  );

  /*
  | Qué versión es exactamente la que se está viendo.
  |
  | Se compara con TODAS y no sólo con la última: al restaurar la del martes, la
  | pizarra vuelve a ser esa, y decir que hay cambios sin guardar —o congelarla
  | otra vez— sería mentira. Las huellas no miran los identificadores, así que
  | restaurar (que los renueva) no cuenta como cambio.
  */
  const versionEnPantalla = useMemo(
    () => versiones.find((version) => huellaVersion(version) === huellaActual) ?? null,
    [versiones, huellaActual],
  );

  const alDia = Boolean(versionEnPantalla);

  /*
  | El histórico se escribe solo.
  |
  | El temporizador se rearma con cada cambio del tablero, así que sólo salta
  | cuando se lleva un rato sin tocar nada: una versión por sesión de trabajo,
  | no una por clic. No se guarda nada de una pizarra en blanco ni de una que
  | ya esté igual que la última versión —de eso se encarga `registraVersion`—,
  | y como la huella no mira el histórico, guardar no vuelve a dispararlo.
  */
  useEffect(() => {
    if (!partido || !tablero || !guardado) return;

    if (!tieneFichas(tablero.slides) || alDia) return;

    const timer = setTimeout(() => {
      mutaTablero((actual) =>
        registraVersion(actual, {
          cuando: new Date().toISOString(),
          motivo: "auto",
        }),
      );
    }, ESPERA_VERSION_MS);

    return () => clearTimeout(timer);
  }, [partido, tablero, guardado, alDia, mutaTablero]);

  const [etiquetaNueva, setEtiquetaNueva] = useState("");

  const guardaVersionAhora = useCallback(() => {
    if (!tablero) return;

    if (!tieneFichas(tablero.slides)) {
      toast.info("La pizarra está en blanco: coloca a alguien antes de guardarla.");

      return;
    }

    const cuando = new Date().toISOString();

    const etiqueta = etiquetaNueva.trim();

    mutaTablero((actual) =>
      registraVersion(actual, {
        cuando,
        motivo: "mano",
        etiqueta,
        /* Guardada a propósito: se queda aunque entren veinte automáticas. */
        fijada: true,
        forzar: true,
      }),
    );

    setEtiquetaNueva("");

    toast.success(
      etiqueta ? `Versión guardada: ${etiqueta}` : "Versión guardada",
    );
  }, [tablero, etiquetaNueva, mutaTablero]);

  /*
  | Restaurar tampoco pierde nada: antes de traer la versión vieja se congela
  | la que está en pantalla, así que se puede ir y volver.
  */
  const restaura = useCallback(
    (version: VersionPizarra) => {
      const cuando = new Date().toISOString();

      mutaTablero((actual) => {
        const conPrevia = tieneFichas(actual.slides)
          ? registraVersion(actual, { cuando, motivo: "previa" })
          : actual;

        return aplicaVersion(conPrevia, version.id, cuando);
      });

      setPedida(0);

      toast.success(`Restaurada: ${version.etiqueta}`);
    },
    [mutaTablero],
  );

  const borraVersion = useCallback(
    (version: VersionPizarra) => {
      mutaTablero((actual) => quitaVersion(actual, version.id));

      toast(`Quitada del histórico: ${version.etiqueta}`, {
        action: {
          label: "Deshacer",
          onClick: () =>
            mutaTablero((actual) => ({
              ...actual,
              versiones: [version, ...(actual.versiones ?? [])].sort((a, b) =>
                b.creada.localeCompare(a.creada),
              ),
            })),
        },
      });
    },
    [mutaTablero],
  );

  /* ------------------- CONSIGNAS DESDE EL PLAN --------------------- */

  /** Pasa el ABP del plan de partido a las consignas de la diapositiva. */
  const anadeConsignas = useCallback(
    (texto: string) => {
      const lineas = texto
        .split(/\r?\n/)
        .map((linea) => linea.replace(/^[-•·\s]+/, "").trim())
        .filter(Boolean);

      if (lineas.length === 0) return;

      mutaSlide((actual) => {
        const previas = actual.notas.filter((linea) => linea.trim());

        const nuevas = lineas.filter((linea) => !previas.includes(linea));

        return { ...actual, notas: [...previas, ...nuevas] };
      });

      toast.success("Consignas traídas del plan de partido");
    },
    [mutaSlide],
  );

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

  /**
   * Cambia una diapositiva de sitio.
   *
   * El orden de la tira **es** el orden del PowerPoint y el del PDF: lo que se
   * arrastra aquí es la charla. Se saca del sitio y se mete en el nuevo —no se
   * intercambian las dos—, que es lo que espera quien arrastra: llevar la
   * séptima al principio no manda la primera al final.
   */
  const mueveSlideA = useCallback(
    (desde: number, hasta: number) => {
      if (!tablero) return;

      if (
        desde === hasta ||
        desde < 0 ||
        hasta < 0 ||
        desde >= tablero.slides.length ||
        hasta >= tablero.slides.length
      ) {
        return;
      }

      mutaTablero((actual) => {
        const slides = [...actual.slides];

        const [movida] = slides.splice(desde, 1);

        slides.splice(hasta, 0, movida);

        return { ...actual, slides };
      });

      setPedida(hasta);
    },
    [tablero, mutaTablero],
  );

  const mueveSlide = useCallback(
    (delta: number) => mueveSlideA(activa, activa + delta),
    [mueveSlideA, activa],
  );

  /** Qué diapositiva se está arrastrando en la tira. */
  const arrastrando = useRef<number | null>(null);

  const [encima, setEncima] = useState<number | null>(null);

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
                      {etiquetaPartido(item)}
                      {marcaDeTablero(store.tableros?.[item.id])}
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
                  icon={Save}
                  onClick={guardaVersionAhora}
                  disabled={!tablero || !tieneFichas(tablero.slides)}
                  title="Congelar la pizarra tal y como está en el histórico de la jornada"
                >
                  Guardar versión
                </Button>

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

                {/*
                  Imprimir, arriba. Los mismos dos botones que la caja del final
                  de la página: llevarse el PowerPoint o el PDF es lo último que
                  se hace antes de la charla y estaba a un scroll de distancia.
                */}
                {tablero && tablero.slides.length > 0 && (
                  <ExportaPizarra
                    variante="barra"
                    slides={tablero.slides}
                    players={porId}
                    temporada={temporadaCorta(RATINGS_SEASON)}
                    rival={tablero.rival || partido?.opponent || ""}
                    jornada={
                      tablero.jornada
                        ? `J${String(tablero.jornada).padStart(2, "0")}`
                        : undefined
                    }
                  />
                )}
              </div>
            </div>

            {partido && (
              <div className="mt-3">
                <Panel
                  title="De quién es esta pizarra"
                  subtitle="El nombre que se lee en la diapositiva y la jornada con la que se cruza el resto de la semana"
                  icon={Shield}
                >
                  <div className="grid min-w-0 gap-3 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
                    <div className="min-w-0">
                      <Field
                        label="Rival"
                        value={tablero?.rival ?? ""}
                        onChange={cambiaRival}
                        placeholder={partido.opponent}
                        suggestions={rivalesDeLaHoja}
                        hint="Se escribe como se quiera leer en la sala: es lo que sale en la cabecera de cada diapositiva."
                      />

                      {tablero &&
                        tablero.rival.trim() !== partido.opponent.trim() && (
                          <div className="mt-2">
                            <Button
                              icon={RotateCcw}
                              onClick={() => cambiaRival(partido.opponent)}
                              title="Volver al nombre que trae el calendario"
                            >
                              Usar el del calendario
                            </Button>
                          </div>
                        )}
                    </div>

                    <label className="block min-w-0">
                      <span className="mb-1.5 block text-[10px] uppercase tracking-[0.16em] text-white/40">
                        Jornada del plan de partido
                      </span>

                      <select
                        value={jornada?.id ?? ""}
                        onChange={(event) => ata(event.target.value)}
                        className="w-full rounded-xl border border-white/10 bg-white/[0.04] px-3 py-2 text-sm text-white outline-none transition focus:border-[#C8A96B]/50"
                      >
                        <option value="" className="bg-[#11161C]">
                          {jornadas.length
                            ? "Sin atar a ninguna jornada"
                            : "No se ha podido leer la hoja de rivales"}
                        </option>

                        {jornadas.map((item) => (
                          <option
                            key={item.id}
                            value={item.id}
                            className="bg-[#11161C]"
                          >
                            {etiquetaJornada(item)}
                          </option>
                        ))}
                      </select>

                      <span className="mt-1 block text-[10px] text-white/30">
                        {jornada
                          ? atada
                            ? "Atada a mano: manda sobre el nombre y la fecha."
                            : "Cruzada sola por fecha o por nombre. Eligiéndola aquí queda fijada."
                          : "Sin jornada no hay enlaces al plan ni al informe del rival."}
                      </span>
                    </label>
                  </div>

                  {jornada && (
                    <div className="mt-3 flex flex-wrap items-center gap-2 border-t border-white/8 pt-3">
                      <Link
                        href={enlacePlanDePartido(jornada)}
                        title="Abrir el plan de partido de esta jornada"
                        className="inline-flex items-center gap-1.5 rounded-xl border border-white/12 px-3 py-1.5 text-xs font-medium text-white/70 transition hover:border-[#C8A96B]/50 hover:text-white"
                      >
                        <ClipboardList size={13} />
                        Plan de partido
                      </Link>

                      <Link
                        href={enlaceAnalisisRival(jornada)}
                        title="Abrir el informe del rival"
                        className="inline-flex items-center gap-1.5 rounded-xl border border-white/12 px-3 py-1.5 text-xs font-medium text-white/70 transition hover:border-[#C8A96B]/50 hover:text-white"
                      >
                        <Binoculars size={13} />
                        Análisis rival
                      </Link>

                      <Link
                        href={enlaceAbpRival(jornada.equipo || tablero?.rival || "")}
                        title="Abrir el balón parado del rival"
                        className="inline-flex items-center gap-1.5 rounded-xl border border-white/12 px-3 py-1.5 text-xs font-medium text-white/70 transition hover:border-[#C8A96B]/50 hover:text-white"
                      >
                        <Link2 size={13} />
                        ABP del rival
                      </Link>

                      <span className="text-[11px] text-white/30">
                        {etiquetaJornada(jornada)}
                      </span>
                    </div>
                  )}

                  {jornada && (jornada.abpOf || jornada.abpDef) && (
                    <div className="mt-3 grid gap-3 border-t border-white/8 pt-3 sm:grid-cols-2">
                      {[
                        { titulo: "Su ABP ofensivo", texto: jornada.abpOf },
                        { titulo: "Su ABP defensivo", texto: jornada.abpDef },
                      ]
                        .filter((item) => item.texto)
                        .map((item) => (
                          <div key={item.titulo} className="min-w-0">
                            <p className="mb-1 text-[10px] uppercase tracking-[0.16em] text-[#C8A96B]">
                              {item.titulo} · plan de partido
                            </p>

                            <p className="whitespace-pre-line text-xs leading-relaxed text-white/55">
                              {item.texto}
                            </p>

                            {slide && (
                              <div className="mt-2">
                                <Button
                                  icon={Plus}
                                  onClick={() => anadeConsignas(item.texto)}
                                  title="Añadir estas líneas a las consignas de la diapositiva"
                                >
                                  A las consignas
                                </Button>
                              </div>
                            )}
                          </div>
                        ))}
                    </div>
                  )}
                </Panel>
              </div>
            )}

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
                    subtitle={`${totales.cubiertos} de ${totales.total} puestos con jugador · arrástralas para cambiar el orden del PowerPoint`}
                    icon={LayoutGrid}
                  >
                    <div className="flex min-w-0 flex-wrap gap-1.5">
                      {tablero?.slides.map((item, indice) => {
                        const { total, cubiertos } = cuentaPuestos(item);
                        const activo = indice === activa;
                        const destino = encima === indice;

                        return (
                          <button
                            key={item.id}
                            type="button"
                            /*
                              El orden se cambia arrastrando, que es como se
                              ordena una charla. Los botones de flecha siguen
                              ahí para el teclado y para quien no arrastre.
                            */
                            draggable
                            onDragStart={(event) => {
                              arrastrando.current = indice;
                              event.dataTransfer.effectAllowed = "move";
                              /* Firefox no arranca el arrastre sin datos. */
                              event.dataTransfer.setData("text/plain", item.id);
                            }}
                            onDragOver={(event) => {
                              if (arrastrando.current === null) return;
                              event.preventDefault();
                              event.dataTransfer.dropEffect = "move";
                              setEncima(indice);
                            }}
                            onDragLeave={() =>
                              setEncima((actual) =>
                                actual === indice ? null : actual,
                              )
                            }
                            onDrop={(event) => {
                              event.preventDefault();

                              if (arrastrando.current !== null) {
                                mueveSlideA(arrastrando.current, indice);
                              }

                              arrastrando.current = null;
                              setEncima(null);
                            }}
                            onDragEnd={() => {
                              arrastrando.current = null;
                              setEncima(null);
                            }}
                            onClick={() => setPedida(indice)}
                            title={`${item.titulo} — arrastra para moverla de sitio`}
                            className={`min-w-0 cursor-grab rounded-xl border px-3 py-2 text-left transition active:cursor-grabbing ${
                              destino
                                ? "border-[#C8A96B] bg-[#C8A96B]/25 text-white"
                                : activo
                                  ? "border-[#C8A96B] bg-[#C8A96B]/12"
                                  : "border-white/10 text-white/60 hover:border-white/25 hover:text-white"
                            }`}
                          >
                            <span className="flex items-center gap-1.5">
                              <GripVertical
                                size={12}
                                className="shrink-0 text-white/25"
                              />

                              <span className="block max-w-[176px] truncate text-[12px] font-semibold uppercase tracking-wide">
                                {indice + 1}. {item.titulo}
                              </span>
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
                        title="Adelantar esta diapositiva un puesto en el PowerPoint"
                      >
                        Antes
                      </Button>

                      <Button
                        icon={ChevronRight}
                        onClick={() => mueveSlide(1)}
                        disabled={
                          !tablero || activa >= tablero.slides.length - 1
                        }
                        title="Retrasar esta diapositiva un puesto en el PowerPoint"
                      >
                        Después
                      </Button>

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
                      rival={tablero?.rival || partido.opponent}
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

                {/* ==================== EXPORTAR ====================== */}

                {tablero && tablero.slides.length > 0 && (
                  <div className="mt-5">
                    <ExportaPizarra
                      slides={tablero.slides}
                      players={porId}
                      temporada={temporadaCorta(RATINGS_SEASON)}
                      rival={tablero.rival || partido.opponent}
                      jornada={
                        tablero.jornada
                          ? `J${String(tablero.jornada).padStart(2, "0")}`
                          : undefined
                      }
                    />
                  </div>
                )}

                {/* ==================== HISTÓRICO ===================== */}

                <div className="mt-5">
                  <Panel
                    title="Histórico de la jornada"
                    subtitle={
                      versiones.length
                        ? `${versiones.length} ${versiones.length === 1 ? "versión guardada" : "versiones guardadas"}${alDia ? " · lo que hay en pantalla ya está guardado" : " · hay cambios sin congelar"}`
                        : "Todavía ninguna: la app congela sola la pizarra cuando la dejas quieta un rato"
                    }
                    icon={History}
                  >
                    <div className="flex flex-wrap items-center gap-2">
                      <input
                        value={etiquetaNueva}
                        onChange={(event) => setEtiquetaNueva(event.target.value)}
                        placeholder="Cómo se llama esta versión: «la del sábado», «con Loren fuera»…"
                        className="min-w-0 flex-1 rounded-xl border border-white/10 bg-white/[0.04] px-3 py-1.5 text-xs text-white outline-none transition placeholder:text-white/25 focus:border-[#C8A96B]/50"
                      />

                      <Button
                        tone="primary"
                        icon={Save}
                        onClick={guardaVersionAhora}
                        disabled={!tablero || !tieneFichas(tablero.slides)}
                      >
                        Guardar versión
                      </Button>
                    </div>

                    <div className="mt-3">
                      {versiones.length === 0 ? (
                        <p className="text-xs leading-relaxed text-white/40">
                          Cada jornada guarda las suyas: la de después de
                          entrenar el martes, la que se cambió el viernes y la
                          que se enseñó en la sala. Se guardan solas al dejar de
                          tocar la pizarra —y a mano con el botón, que además
                          las deja fijas— y se puede volver a cualquiera sin
                          perder la de ahora.
                        </p>
                      ) : (
                        <HistorialVersiones
                          versiones={versiones}
                          enPantalla={versionEnPantalla?.id ?? null}
                          onRestaurar={restaura}
                          onFijar={(version, fijada) =>
                            mutaTablero((actual) =>
                              fijaVersion(actual, version.id, fijada),
                            )
                          }
                          onRenombrar={(version, etiqueta) =>
                            mutaTablero((actual) =>
                              renombraVersion(actual, version.id, etiqueta),
                            )
                          }
                          onBorrar={borraVersion}
                        />
                      )}
                    </div>
                  </Panel>
                </div>

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
/*  HISTÓRICO DE LA JORNADA                                            */
/* ------------------------------------------------------------------ */

/**
 * Las versiones de una jornada, de la más reciente a la más vieja.
 *
 * Cada línea dice lo que hace falta para reconocerla sin abrirla: cómo se
 * llama, cuándo se guardó, por qué —a mano o sola—, contra quién y cuántos
 * puestos tenía cubiertos. Las **fijadas** no se caen del histórico cuando
 * entran automáticas nuevas, y por eso se pueden marcar y desmarcar aquí.
 */
function HistorialVersiones({
  versiones,
  enPantalla,
  onRestaurar,
  onFijar,
  onRenombrar,
  onBorrar,
}: {
  versiones: VersionPizarra[];
  /** La versión que es, ahora mismo, la pizarra que se está viendo. */
  enPantalla: string | null;
  onRestaurar: (version: VersionPizarra) => void;
  onFijar: (version: VersionPizarra, fijada: boolean) => void;
  onRenombrar: (version: VersionPizarra, etiqueta: string) => void;
  onBorrar: (version: VersionPizarra) => void;
}) {
  const [renombrando, setRenombrando] = useState<string | null>(null);
  const [borrador, setBorrador] = useState("");

  const confirma = (version: VersionPizarra) => {
    if (borrador.trim() && borrador.trim() !== version.etiqueta) {
      onRenombrar(version, borrador);
    }

    setRenombrando(null);
  };

  return (
    <ul className="space-y-1.5">
      {versiones.map((version) => {
        const fichas = version.slides.reduce(
          (total, slide) => total + slide.fichas.length,
          0,
        );

        const esLaDeAhora = version.id === enPantalla;

        return (
          <li
            key={version.id}
            className={`flex min-w-0 flex-wrap items-center gap-2 rounded-xl border px-3 py-2 ${
              esLaDeAhora
                ? "border-[#C8A96B]/40 bg-[#C8A96B]/[0.06]"
                : "border-white/8"
            }`}
          >
            <div className="min-w-0 flex-1">
              {renombrando === version.id ? (
                <input
                  autoFocus
                  value={borrador}
                  onChange={(event) => setBorrador(event.target.value)}
                  onBlur={() => confirma(version)}
                  onKeyDown={(event) => {
                    if (event.key === "Enter") confirma(version);
                    if (event.key === "Escape") setRenombrando(null);
                  }}
                  className="w-full rounded-lg border border-[#C8A96B]/50 bg-white/[0.06] px-2 py-1 text-xs text-white outline-none"
                />
              ) : (
                <button
                  type="button"
                  onClick={() => {
                    setRenombrando(version.id);
                    setBorrador(version.etiqueta);
                  }}
                  title="Cambiar el nombre de la versión"
                  className="flex min-w-0 items-center gap-1.5 text-left text-xs font-semibold text-white/85 transition hover:text-white"
                >
                  <span className="truncate">{version.etiqueta}</span>

                  <Pencil size={11} className="shrink-0 text-white/25" />
                </button>
              )}

              <span className="mt-0.5 block truncate text-[10px] text-white/35">
                {MOTIVO_LABEL[version.motivo]} · {etiquetaVersion(version.creada)}
                {version.rival ? ` · ${version.rival}` : ""} · {fichas}{" "}
                {fichas === 1 ? "ficha" : "fichas"}
                {esLaDeAhora ? " · es lo que hay en pantalla" : ""}
              </span>
            </div>

            <Button
              icon={RotateCcw}
              onClick={() => onRestaurar(version)}
              disabled={esLaDeAhora}
              title={
                esLaDeAhora
                  ? "Ya es la pizarra que está en pantalla"
                  : "Traer esta versión a la pizarra"
              }
            >
              Restaurar
            </Button>

            <Button
              icon={version.fijada ? PinOff : Pin}
              onClick={() => onFijar(version, !version.fijada)}
              title={
                version.fijada
                  ? "Dejar que se caiga del histórico cuando entren versiones nuevas"
                  : "Fijarla: no se caerá del histórico"
              }
            />

            <Button
              tone="danger"
              icon={Trash2}
              onClick={() => onBorrar(version)}
              title="Quitarla del histórico"
            />
          </li>
        );
      })}
    </ul>
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
