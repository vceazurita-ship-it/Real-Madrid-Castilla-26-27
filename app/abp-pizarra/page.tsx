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
  AlertTriangle,
  Binoculars,
  CheckCircle2,
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
  Repeat,
  RotateCcw,
  Save,
  Shield,
  Smartphone,
  Trash2,
  Type,
  Users,
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
import { CambiaJugador } from "@/components/abp/pizarra/CambiaJugador";
import { ExportaPizarra } from "@/components/abp/pizarra/ExportaPizarra";
import {
  BarraDibujo,
  TECLA_HERRAMIENTA,
  type Herramienta,
} from "@/components/abp/pizarra/BarraDibujo";
import { ProyectaPizarra } from "@/components/abp/pizarra/ProyectaPizarra";
import { useReproduccionAbp } from "@/hooks/useReproduccionAbp";
import {
  arrastraTrazos,
  fasesDe,
  type FaseTrazo,
  type RivalPizarra,
  type TrazoPizarra,
} from "@/lib/abp/trazos";
import { EscudoEquipo } from "@/components/rivals/EscudoEquipo";
import { useEscudos } from "@/hooks/useEscudos";
import { useRemoteDoc } from "@/hooks/useRemoteDoc";
import { usePlayers } from "@/hooks/usePlayers";
import type { Player } from "@/types/player";
import {
  compareMatches,
  fetchMatches,
  formatMatchDate,
  matchLabel,
} from "@/lib/ratings/matches";
import { RATINGS_SEASON, type MatchMeta } from "@/lib/ratings/types";
import {
  CABECERA_H,
  EMPTY_PIZARRA_STORE,
  TABLERO_H,
  TABLERO_W,
  MOTIVO_LABEL,
  PLANTILLAS,
  PLANTILLA_BY_KEY,
  admiteRepetidos,
  aplicaVersion,
  alcanceDelCambio,
  aprende,
  cambiaJugador,
  colocaAutomatico,
  conElegidosDelGrupo,
  copiaTablero,
  cuentaPuestos,
  eligeEnGrupo,
  etiquetaVersion,
  fichaNueva,
  fijaVersion,
  adornosDePlantilla,
  gruposDe,
  gruposDePlantilla,
  huellaTablero,
  huellaVersion,
  memoriaDeGrupo,
  ocupantesDeGrupo,
  puestoDe,
  puestosDeGrupo,
  puestosQueHereda,
  quitaVersion,
  registraVersion,
  renombraVersion,
  revisaTablero,
  sinTextosPropios,
  slideDePlantilla,
  avisosConsignas,
  CASILLAS_GUION,
  lineasConsignas,
  normalizaMemoria,
  normalizaTablero,
  tableroVacio,
  textosDeSlide,
  tieneFichas,
  tieneTextosPropios,
  tituloVisible,
  type PizarraStore,
  type PuestoAbp,
  type SlidePizarra,
  type TableroPizarra,
  type TextosSlide,
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
import {
  colocaDefensa,
  estructuraDefensiva,
  familiaDePlantilla,
  susCabeceadores,
} from "@/lib/abp/defensa-rival";
import { SCOUT_DOC_KEY, actionsOf } from "@/lib/abp/rivalScout";
import { buildAerialThreats } from "@/lib/abp/rival";
import { enElCampo } from "@/lib/abp/pizarra";
import { traeJson } from "@/lib/hojaCsv";
import { VideoJugada } from "@/components/abp/pizarra/VideoJugada";

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

/**
 * Cuándo se tocó por última vez un tablero.
 *
 * `actualizado` sólo se sella al editar el rival o la jornada, así que un
 * tablero al que se le han colocado fichas sin tocar la cabecera no lo tiene.
 * Para ésos vale la versión más reciente, que es lo que de verdad dice cuándo
 * se trabajó ahí.
 */
function tocadoEn(tablero?: TableroPizarra) {
  if (!tablero) return "";

  return (tablero.versiones ?? []).reduce(
    (ultima, version) => (version.creada > ultima ? version.creada : ultima),
    tablero.actualizado ?? "",
  );
}

/* "2026-2027" → "26 / 27", que es como lo escribe la plantilla. */
function temporadaCorta(season: string) {
  const [desde, hasta] = season.split("-");

  return `${desde?.slice(2) ?? ""} / ${hasta?.slice(2) ?? ""}`;
}

export default function PizarraAbpPage() {
  const { players } = usePlayers();

  /* El escudo del club, que la hoja no trae: ver `hooks/useEscudos`. */
  const escudoDe = useEscudos();

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
  | Hoy en la hora de aquí, no en UTC. Con `toISOString()`, de medianoche a las
  | dos de la madrugada (verano) seguía siendo «ayer» y se abría el partido de
  | ayer como el próximo. `sv-SE` escribe la fecha como AAAA-MM-DD, que es lo
  | que traen los partidos. Se lee una vez al montar —inicializador perezoso—
  | y no en cada render.
  */
  const [hoy] = useState(() => new Date().toLocaleDateString("sv-SE"));

  /*
  | Al entrar manda el último tablero tocado —preparar el ABP es tarea de toda
  | la semana—, y si no hay ninguno se abre la **próxima** jornada, que es la
  | que se va a preparar, no la primera de la temporada.
  */
  const porDefecto = useMemo(() => {
    /*
    | Hasta que el calendario no está entero no se elige nada.
    |
    | El CSV de jugados llega en un suspiro y la hoja RIVALES puede tardar
    | medio minuto, así que durante ese rato el único partido que existe es el
    | amistoso de julio. Eligiéndolo se acababa montando el balón parado de la
    | jornada que viene encima del tablero del amistoso, y al llegar la hoja el
    | partido cambiaba solo debajo de las manos.
    */
    if (cargando || partidos.length === 0) return "";

    /* Lo primero que se ve es lo que hay que preparar: el próximo partido del
       calendario. Abrir el último ya jugado dejaba la semana del Algeciras con
       el Antequera delante. Desde ahí, «Rehacer desde» trae el de antes. */
    const proximo = partidos.find((item) => item.date && item.date >= hoy);

    if (proximo) return proximo.id;

    const conTablero = partidos.filter((item) => store.tableros?.[item.id]);

    /* Sin partido por delante, el último **tocado**, que es a lo que se
       vuelve; no el último del calendario, que es otra cosa. */
    if (conTablero.length) {
      return conTablero.reduce((ultimo, item) =>
        tocadoEn(store.tableros?.[item.id]) >
        tocadoEn(store.tableros?.[ultimo.id])
          ? item
          : ultimo,
      ).id;
    }

    return (partidos.find((item) => item.date && item.date >= hoy) ?? partidos[0])
      .id;
  }, [cargando, partidos, store.tableros, hoy]);

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
  /* Lo aprendido, con los puestos que han cambiado de nombre ya traducidos:
     si no, renombrar uno borraría de golpe quién lo hace desde agosto. */
  const memoriaAlDia = useMemo(
    () => normalizaMemoria(store.memoria ?? {}),
    [store.memoria],
  );

  const tablero: TableroPizarra | null = useMemo(() => {
    if (!partido) return null;

    const guardado = store.tableros?.[partido.id];

    return guardado
      ? normalizaTablero(guardado)
      : tableroVacio(partido.id, partido.opponent, store.textos);
  }, [store.tableros, store.textos, partido]);

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

  /*
  | SE ESCRIBE SOBRE EL TABLERO YA PUESTO AL DÍA, NO SOBRE EL GUARDADO
  |
  | La pantalla pinta `normalizaTablero(guardado)`, pero los cambios se
  | aplicaban sobre el guardado tal cual. Mientras la `rev` de la plantilla
  | fuera por delante de la de la jornada, eso dejaba las fichas clavadas: se
  | arrastraba una, el cambio se guardaba con la `rev` vieja, la siguiente
  | lectura volvía a llamar a `normalizaTablero` y la devolvía a su sitio de
  | plantilla. En la práctica, cada vez que se cambiaba el dibujo de una acción
  | las jornadas ya montadas se quedaban sin poder moverse.
  |
  | Poniéndolo al día ANTES de tocarlo, el primer cambio consolida la
  | recolocación y a partir de ahí la jornada se mueve como cualquier otra.
  | `normalizaTablero` devuelve el mismo objeto si no hay nada que cambiar, así
  | que en una jornada al día esto no cuesta nada.
  */
  const tableroAlDia = useCallback(
    (actual: PizarraStore, partidoId: string, rival: string) =>
      normalizaTablero(
        actual.tableros?.[partidoId] ??
          tableroVacio(partidoId, rival, actual.textos),
      ),
    [],
  );

  /*
  | DESHACER Y REHACER
  |
  | Se guardan las diapositivas de antes de cada cambio —no el documento
  | entero: el histórico de versiones y lo aprendido no se deshacen con
  | Ctrl+Z—, y sólo de la jornada abierta. Un gesto es UN paso: arrastrar una
  | cara son cien escrituras y se deshace de una vez. Lo mismo al escribir un
  | título o al afinar con las flechas: los cambios seguidos de la misma cosa
  | se juntan mientras no pasen dos segundos.
  |
  | Las pilas viven en refs (no se pintan); lo que se pinta son sus largos,
  | que van en estado para que los botones se enciendan y se apaguen.
  */
  const pilas = useRef<{
    partido: string;
    atras: SlidePizarra[][];
    adelante: SlidePizarra[][];
  }>({ partido: "", atras: [], adelante: [] });

  const ultimoPaso = useRef<{ clave: string; cuando: number }>({ clave: "", cuando: 0 });

  const [hayDeshacer, setHayDeshacer] = useState({ atras: 0, adelante: 0 });

  const cuentaPilas = useCallback(() => {
    setHayDeshacer({
      atras: pilas.current.atras.length,
      adelante: pilas.current.adelante.length,
    });
  }, []);

  /** Apunta las diapositivas de ahora antes de un cambio. */
  const anotaPaso = useCallback(
    (clave?: string) => {
      if (!partido || !tablero) return;

      const pila = pilas.current;

      if (pila.partido !== partido.id) {
        pilas.current = { partido: partido.id, atras: [], adelante: [] };
      }

      const ahora = Date.now();
      const previo = ultimoPaso.current;

      const junta =
        clave != null &&
        clave === previo.clave &&
        (clave.startsWith("gesto:") || ahora - previo.cuando < 2000);

      ultimoPaso.current = { clave: clave ?? "", cuando: ahora };

      if (junta) return;

      const { atras } = pilas.current;

      if (atras[atras.length - 1] !== tablero.slides) {
        atras.push(tablero.slides);

        if (atras.length > 80) atras.shift();
      }

      pilas.current.adelante = [];
      cuentaPilas();
    },
    [partido, tablero, cuentaPilas],
  );

  const mutaTablero = useCallback(
    (fn: (actual: TableroPizarra) => TableroPizarra, clave?: string) => {
      if (!partido) return;

      anotaPaso(clave);

      setStore((actual) => {
        const base = tableroAlDia(actual, partido.id, partido.opponent);

        return {
          ...actual,
          tableros: { ...actual.tableros, [partido.id]: fn(base) },
        };
      });
    },
    [tableroAlDia, partido, setStore, anotaPaso],
  );

  /** Pone unas diapositivas guardadas en la pila, sin anotar paso. */
  const ponSlides = useCallback(
    (slides: SlidePizarra[]) => {
      if (!partido) return;

      setStore((actual) => ({
        ...actual,
        tableros: {
          ...actual.tableros,
          [partido.id]: {
            ...tableroAlDia(actual, partido.id, partido.opponent),
            slides,
            actualizado: new Date().toISOString(),
          },
        },
      }));
    },
    [partido, setStore, tableroAlDia],
  );

  const deshaz = useCallback(() => {
    if (!partido || !tablero || pilas.current.partido !== partido.id) return;

    const { atras, adelante } = pilas.current;

    let previo = atras.pop();

    /* Los cambios que no tocaron las diapositivas (fijar una versión) dejan
       pasos iguales a lo que hay: se saltan. */
    while (previo && previo === tablero.slides) previo = atras.pop();

    if (previo) {
      adelante.push(tablero.slides);
      ultimoPaso.current = { clave: "", cuando: 0 };
      ponSlides(previo);
    }

    cuentaPilas();
  }, [partido, tablero, ponSlides, cuentaPilas]);

  const rehaz = useCallback(() => {
    if (!partido || !tablero || pilas.current.partido !== partido.id) return;

    const { atras, adelante } = pilas.current;

    const siguiente = adelante.pop();

    if (siguiente) {
      atras.push(tablero.slides);
      ultimoPaso.current = { clave: "", cuando: 0 };
      ponSlides(siguiente);
    }

    cuentaPilas();
  }, [partido, tablero, ponSlides, cuentaPilas]);

  /* Cada gesto del tablero (arrastrar, tirar de una flecha) es un paso. */
  const gesto = useRef(0);

  const pasoNuevo = useCallback(() => {
    gesto.current += 1;
  }, []);

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
    (fn: (actual: SlidePizarra) => SlidePizarra, clave?: string) =>
      mutaTablero(
        (actual) => ({
          ...actual,
          slides: actual.slides.map((item, indice) =>
            indice === activa ? fn(item) : item,
          ),
        }),
        clave,
      ),
    [mutaTablero, activa],
  );

  /*
  | «Poner su defensa» (ronda del sobresaliente, 21/10/2026): coloca al rival
  | como defiende esta acción según su scouting y con el dorsal de sus mejores
  | por alto. Sólo lee; las chapas quedan como cualquier rival dibujado, y la
  | colocación se deshace con Ctrl+Z.
  */
  const [poniendoDefensa, setPoniendoDefensa] = useState(false);

  const ponSuDefensa = useCallback(async () => {
    if (!slide) return;

    const familia = familiaDePlantilla(slide.plantilla);
    const equipo = tablero?.rival || partido?.opponent || "";

    if (!familia || !equipo) return;

    setPoniendoDefensa(true);

    const aviso = toast.loading(`Leyendo cómo defiende ${equipo}…`);

    try {
      const [scout, plantillas] = await Promise.all([
        fetch(`/api/docs?key=${SCOUT_DOC_KEY}`, { cache: "no-store" })
          .then((respuesta) => (respuesta.ok ? respuesta.json() : null))
          .catch(() => null),
        traeJson<unknown>("/api/rivals?action=rivalesPlantillas").catch(() => []),
      ]);

      const estructura = estructuraDefensiva(actionsOf(scout?.data ?? null, equipo), familia);
      const cabeceadores = susCabeceadores(buildAerialThreats(plantillas, [], equipo));
      const hecho = colocaDefensa(slide.plantilla, slide.fichas.filter(enElCampo), estructura, cabeceadores, equipo);

      if (!hecho) {
        toast.info(
          `De ${equipo} no hay registrado cómo defiende esta acción ni rematadores de ABP: colócalos a mano con la R.`,
          { id: aviso },
        );

        return;
      }

      const pisados = slide.rivales?.length ?? 0;

      mutaSlide((actual) => ({ ...actual, rivales: hecho.rivales }), "rivales:defensa");
      toast.success(
        pisados ? `${hecho.aviso} Sustituye a los ${pisados} rivales que había; Ctrl+Z los recupera.` : hecho.aviso,
        { id: aviso, duration: 9_000 },
      );
    } finally {
      setPoniendoDefensa(false);
    }
  }, [slide, tablero?.rival, partido?.opponent, mutaSlide]);

  /* ---------------------- CARRERAS Y BALÓN ------------------------- */

  const [herramienta, setHerramienta] = useState<Herramienta>("mover");
  const [fase, setFase] = useState<FaseTrazo>(1);
  const [trazoElegido, setTrazoElegido] = useState<string | null>(null);
  const [rivalElegido, setRivalElegido] = useState<string | null>(null);

  const rivalEnMano = useMemo(
    () => (slide?.rivales ?? []).find((rival) => rival.id === rivalElegido) ?? null,
    [slide, rivalElegido],
  );

  const creaRival = useCallback(
    (rival: RivalPizarra) => {
      mutaSlide((actual) => ({ ...actual, rivales: [...(actual.rivales ?? []), rival] }));
      setRivalElegido(rival.id);
    },
    [mutaSlide],
  );

  const cambiaRivalDibujado = useCallback(
    (id: string, cambio: Partial<RivalPizarra>, clave?: string) =>
      mutaSlide(
        (actual) => ({
          ...actual,
          rivales: (actual.rivales ?? []).map((rival) =>
            rival.id === id ? { ...rival, ...cambio } : rival,
          ),
        }),
        clave,
      ),
    [mutaSlide],
  );

  const quitaRivalDibujado = useCallback(
    (id: string) => {
      mutaSlide((actual) => ({
        ...actual,
        rivales: (actual.rivales ?? []).filter((rival) => rival.id !== id),
      }));
      setRivalElegido(null);
    },
    [mutaSlide],
  );

  const trazos = useMemo(() => slide?.trazos ?? [], [slide]);

  const trazoEnMano = useMemo(
    () => trazos.find((trazo) => trazo.id === trazoElegido) ?? null,
    [trazos, trazoElegido],
  );

  const creaTrazo = useCallback(
    (trazo: TrazoPizarra) => {
      mutaSlide((actual) => ({ ...actual, trazos: [...(actual.trazos ?? []), trazo] }));

      /* Recién dibujado queda elegido: lo normal es curvarlo o cambiarle la
         fase justo después. La herramienta sigue en la mano para el siguiente. */
      setTrazoElegido(trazo.id);
    },
    [mutaSlide],
  );

  const cambiaTrazo = useCallback(
    (id: string, cambio: Partial<TrazoPizarra>, clave?: string) =>
      mutaSlide(
        (actual) => ({
          ...actual,
          trazos: (actual.trazos ?? []).map((trazo) => {
            if (trazo.id !== id) return trazo;

            const nuevo = { ...trazo, ...cambio };

            /* «Enderezar» manda el control a undefined: se quita la clave. */
            if (nuevo.cx == null || nuevo.cy == null) {
              delete nuevo.cx;
              delete nuevo.cy;
            }

            return nuevo;
          }),
        }),
        clave,
      ),
    [mutaSlide],
  );

  const borraTrazo = useCallback(
    (id: string) => {
      mutaSlide((actual) => ({
        ...actual,
        trazos: (actual.trazos ?? []).filter((trazo) => trazo.id !== id),
      }));

      setTrazoElegido(null);
    },
    [mutaSlide],
  );

  /**
   * Mueve una cara y, con ella, las flechas que salen de sus pies.
   * La clave del gesto junta el arrastre entero en un paso de deshacer.
   */
  const mueveFicha = useCallback(
    (id: string, x: number, y: number, clave: string) =>
      mutaSlide((actual) => {
        const antes = actual.fichas.find((ficha) => ficha.id === id);

        if (!antes || (antes.x === x && antes.y === y)) return actual;

        const movidos = arrastraTrazos(actual.trazos, antes, { x, y });

        return {
          ...actual,
          fichas: actual.fichas.map((ficha) =>
            ficha.id === id ? { ...ficha, x, y } : ficha,
          ),
          ...(movidos ? { trazos: movidos } : {}),
        };
      }, clave),
    [mutaSlide],
  );

  /* ------------------------- REPRODUCIR ---------------------------- */

  const fases = fasesDe(trazos);

  const {
    tiempo: tiempoReloj,
    reproduce: reproduceReloj,
    para: paraReloj,
  } = useReproduccionAbp(fases);

  /* De qué diapositiva es lo que se reproduce: cambiar de diapositiva lo
     deja atrás sin tener que pararlo en cada sitio que cambia la activa. */
  const [reproducida, setReproducida] = useState<string | null>(null);

  const tiempo = slide && reproducida === slide.id ? tiempoReloj : null;

  const reproduce = useCallback(() => {
    if (!slide || fases === 0) return;

    setReproducida(slide.id);
    setTrazoElegido(null);
    reproduceReloj();
  }, [slide, fases, reproduceReloj]);

  const paraReproduccion = useCallback(() => {
    setReproducida(null);
    paraReloj();
  }, [paraReloj]);

  /* Al acabar se queda un momento en la foto final y vuelve a la fija. */
  useEffect(() => {
    if (tiempo == null || tiempo < fases) return;

    const vuelta = setTimeout(paraReproduccion, 1800);

    return () => clearTimeout(vuelta);
  }, [tiempo, fases, paraReproduccion]);

  /* ---------------------------- TECLADO ---------------------------- */

  /*
  | Los atajos de la pizarra. No se atienden escribiendo en un campo, con un
  | diálogo abierto ni con el proyector delante (que tiene los suyos).
  */
  const teclado = useRef<(event: KeyboardEvent) => void>(() => undefined);

  useEffect(() => {
    const atiende = (event: KeyboardEvent) => teclado.current(event);

    window.addEventListener("keydown", atiende);

    return () => window.removeEventListener("keydown", atiende);
  }, []);

  /* ------------------------- PROYECTOR ----------------------------- */

  const [proyectando, setProyectando] = useState<number | null>(null);
  /* En el móvil la cabecera de «de quién es» va plegada: el campo antes que los datos. */
  const [cabeceraAbierta, setCabeceraAbierta] = useState(false);

  /* ---------------------- TEXTOS DE LA SLIDE ----------------------- */

  /*
  | Reescribir un rótulo cambia SÓLO esta jornada. Es lo que se quiere casi
  | siempre —la mitad de los cambios son para el rival de esta semana—, y por
  | eso no hay que elegir nada para hacerlo. Lo que sí es una decisión es que el
  | cambio valga de aquí en adelante: eso es un botón aparte, y lo que hace es
  | dejar los textos de esta diapositiva como los que heredarán las jornadas
  | que se creen después. Las ya montadas no se tocan.
  */
  const cambiaTexto = useCallback(
    (fn: (textos: TextosSlide) => TextosSlide) =>
      mutaSlide((actual) => ({ ...actual, textos: fn(actual.textos ?? {}) })),
    [mutaSlide],
  );

  const dejaParaLasSiguientes = useCallback(
    (slide: SlidePizarra) => {
      setStore((actual) => ({
        ...actual,
        textos: { ...actual.textos, [slide.plantilla]: textosDeSlide(slide) },
      }));

      toast.success("Guardado para las siguientes jornadas", {
        description: `«${slide.titulo}» saldrá así en los partidos que montes a partir de ahora.`,
      });
    },
    [setStore],
  );

  const vuelveALaPlantilla = useCallback(
    (slide: SlidePizarra) => {
      mutaSlide(sinTextosPropios);

      setStore((actual) => {
        if (!actual.textos?.[slide.plantilla]) return actual;

        const { [slide.plantilla]: _fuera, ...resto } = actual.textos;

        return { ...actual, textos: resto };
      });

      toast("Textos devueltos a los de la plantilla");
    },
    [mutaSlide, setStore],
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

  /*
  | Donde se admiten repetidos, un jugador puede salir en varios sitios, así
  | que la chapa gris del selector los enseña todos: «I1·P2» se lee de un
  | vistazo y guardar la última visita escondería media verdad.
  */
  const ocupadoPor = useMemo(() => {
    const mapa = new Map<string, string>();

    if (!slide) return mapa;

    slide.fichas.forEach((ficha) => {
      const code = puestoDe(slide, ficha.puesto)?.code;

      if (!code) return;

      const previo = mapa.get(ficha.playerId);

      mapa.set(ficha.playerId, previo ? `${previo}·${code}` : code);
    });

    return mapa;
  }, [slide]);

  /**
   * Coloca a alguien en un puesto y lo apunta en la memoria.
   *
   * Si el jugador ya estaba en otro puesto de la misma diapositiva se le mueve:
   * duplicarlo dejaría a la misma cara en dos sitios del campo, que es un error
   * de pizarra, no una decisión.
   *
   * En las diapositivas de opciones —las directas— sí es una decisión, y sólo
   * se le mueve si el otro puesto era del mismo sitio: el mismo tirador puede
   * estar en la izquierda y en el penalti, pero no ser el primero y el segundo
   * de la izquierda.
   */
  const asigna = useCallback(
    (puestoKey: string, playerId: string) => {
      if (!slide) return;

      const puesto = puestoDe(slide, puestoKey);

      const repite = admiteRepetidos(slide);

      const cuando = new Date().toISOString();

      mutaSlide((actual) => {
        const limpio = actual.fichas.filter((ficha) => {
          if (ficha.puesto === puestoKey) return false;

          if (ficha.playerId !== playerId) return true;

          if (!repite) return false;

          return puestoDe(actual, ficha.puesto)?.grupo !== puesto?.grupo;
        });

        return { ...actual, fichas: [...limpio, fichaNueva(playerId, puesto)] };
      });

      setStore((actual) => ({
        ...actual,
        memoria: aprende(normalizaMemoria(actual.memoria ?? {}), puestoKey, playerId, cuando),
      }));

      setEditando(null);
    },
    [slide, mutaSlide, setStore],
  );

  /**
   * La posición entera, cuando la plantilla dice que se elige de una vez.
   *
   * Pulsar cualquiera de sus huecos —o cualquiera de sus filas del panel— abre
   * el grupo completo: en «directas a portería» se decide quién lanza desde la
   * izquierda, no quién es el segundo de la lista.
   */
  const grupoEditado = useMemo(() => {
    if (!slide || !puestoEditado || !eligeEnGrupo(slide, puestoEditado.grupo)) {
      return null;
    }

    const grupo = gruposDe(slide).find(
      (item) => item.key === puestoEditado.grupo,
    );

    if (!grupo) return null;

    return {
      key: grupo.key,
      label: grupo.label,
      puestos: puestosDeGrupo(slide, grupo.key),
    };
  }, [slide, puestoEditado]);

  /**
   * Guarda los elegidos de una posición, por orden.
   *
   * Se aprende puesto a puesto igual que al asignar de uno en uno, pero **sólo
   * de lo que cambia**: guardar dos veces la misma lista no puede subir el
   * contador de veces de nadie, o «los habituales» acabarían diciendo quién se
   * ha guardado más, no quién ha lanzado más.
   */
  const asignaGrupo = useCallback(
    (puestos: PuestoAbp[], playerIds: string[]) => {
      if (!slide) return;

      const cuando = new Date().toISOString();

      const previos = new Map(
        slide.fichas
          .filter((ficha) => ficha.puesto)
          .map((ficha) => [ficha.puesto as string, ficha.playerId]),
      );

      const nuevos = playerIds
        .slice(0, puestos.length)
        .map((playerId, indice) => ({ puesto: puestos[indice], playerId }))
        .filter(({ puesto, playerId }) => previos.get(puesto.key) !== playerId);

      mutaSlide((actual) => conElegidosDelGrupo(actual, puestos, playerIds));

      if (nuevos.length > 0) {
        setStore((actual) => ({
          ...actual,
          memoria: nuevos.reduce(
            (memoria, { puesto, playerId }) =>
              aprende(memoria, puesto.key, playerId, cuando),
            normalizaMemoria(actual.memoria ?? {}),
          ),
        }));
      }

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
          : colocaAutomatico(item, memoriaAlDia, disponibles),
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
    [tablero, mutaTablero, activa, memoriaAlDia, disponibles],
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

  /* ------------------------ CAMBIAR JUGADOR ------------------------ */

  /*
  | Uno sale del once y entra otro en su sitio en TODAS las diapositivas.
  |
  | `null` es el diálogo cerrado; abierto lleva al que sale si se abrió desde
  | un aviso concreto. Como en `coloca`, lo que se cuenta —cuántas fichas,
  | qué puestos se aprenden— se calcula ANTES de tocar el estado, y todo va en
  | un solo `setStore`: el tablero, la versión previa y la memoria se guardan
  | juntos o no se guardan.
  |
  | Antes de cambiar se congela lo que había en el histórico: si el cambio era
  | el equivocado, se restaura desde ahí.
  */
  const [cambiando, setCambiando] = useState<{ sale: string | null } | null>(null);

  const aplicaCambio = useCallback(
    (sale: string, entra: string, intercambia: boolean) => {
      if (!partido || !tablero) return;

      const alcance = alcanceDelCambio(tablero, sale, entra, intercambia);

      if (alcance.fichas === 0) {
        setCambiando(null);

        return;
      }

      const cuando = new Date().toISOString();

      const heredaEntra = puestosQueHereda(tablero, sale);

      const heredaSale = intercambia ? puestosQueHereda(tablero, entra) : [];

      const nombre = (playerId: string) => {
        const player = porId.get(playerId);

        return player?.apodo || player?.nombre || playerId;
      };

      setStore((actual) => {
        const base = tableroAlDia(actual, partido.id, partido.opponent);

        const conPrevia = tieneFichas(base.slides)
          ? registraVersion(base, {
              cuando,
              motivo: "previa",
              etiqueta: `Antes de cambiar a ${nombre(sale)} por ${nombre(entra)}`,
            })
          : base;

        let memoria = normalizaMemoria(actual.memoria ?? {});

        for (const puesto of heredaEntra) memoria = aprende(memoria, puesto, entra, cuando);

        for (const puesto of heredaSale) memoria = aprende(memoria, puesto, sale, cuando);

        return {
          ...actual,
          memoria,
          tableros: {
            ...actual.tableros,
            [partido.id]: cambiaJugador(conPrevia, sale, entra, { cuando, intercambia }),
          },
        };
      });

      setCambiando(null);

      toast.success(
        intercambia
          ? `${nombre(entra)} y ${nombre(sale)} intercambiados`
          : `${nombre(entra)} entra por ${nombre(sale)}`,
        {
          description: `${alcance.fichas} ${alcance.fichas === 1 ? "ficha cambiada" : "fichas cambiadas"} en ${alcance.slides.length} ${alcance.slides.length === 1 ? "diapositiva" : "diapositivas"}. Lo anterior queda en el histórico.`,
        },
      );
    },
    [tableroAlDia, partido, tablero, porId, setStore],
  );

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
        slides: [
          ...actual.slides,
          slideDePlantilla(plantilla, store.textos?.[plantilla]),
        ],
      }));

      setPedida(tablero ? tablero.slides.length : 0);
    },
    [mutaTablero, tablero, store.textos],
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

  /*
  | Lo que hace cada tecla. Se vuelve a escribir en cada render —en un efecto,
  | no al pintar— para leer siempre lo último sin re-suscribirse a `window`.
  */
  useEffect(() => {
    teclado.current = (event: KeyboardEvent) => {
      if (!slide || proyectando != null || editando || cambiando) return;

      const blanco = event.target as HTMLElement | null;

      if (
        blanco &&
        (blanco.isContentEditable ||
          ["INPUT", "TEXTAREA", "SELECT"].includes(blanco.tagName) ||
          blanco.closest("[role=dialog]"))
      ) {
        return;
      }

      const control = event.ctrlKey || event.metaKey;
      const tecla = event.key;

      if (control && (tecla === "z" || tecla === "Z")) {
        event.preventDefault();

        if (event.shiftKey) rehaz();
        else deshaz();

        return;
      }

      if (control && (tecla === "y" || tecla === "Y")) {
        event.preventDefault();
        rehaz();

        return;
      }

      if (control || event.altKey) return;

      /* Herramientas: V, C, B, L. */
      const herramientaDeTecla = (Object.keys(TECLA_HERRAMIENTA) as Herramienta[]).find(
        (key) => TECLA_HERRAMIENTA[key] === tecla.toUpperCase(),
      );

      if (herramientaDeTecla) {
        event.preventDefault();
        setHerramienta(herramientaDeTecla);
        setTrazoElegido(null);
        setRivalElegido(null);

        return;
      }

      if (tecla === "1" || tecla === "2" || tecla === "3") {
        event.preventDefault();

        const nueva = Number(tecla) as FaseTrazo;

        if (trazoEnMano) cambiaTrazo(trazoEnMano.id, { fase: nueva });
        else setFase(nueva);

        return;
      }

      if (tecla === "p" || tecla === "P") {
        event.preventDefault();
        setProyectando(activa);

        return;
      }

      /* Espacio reproduce; en un botón, el espacio es pulsarlo. */
      if (tecla === " " && blanco?.tagName !== "BUTTON") {
        event.preventDefault();

        if (tiempo != null) paraReproduccion();
        else reproduce();

        return;
      }

      if (tecla === "Escape") {
        if (tiempo != null) paraReproduccion();

        setHerramienta("mover");
        setTrazoElegido(null);
        setRivalElegido(null);
        setSeleccion(null);

        return;
      }

      if (tecla === "Delete" || tecla === "Backspace") {
        if (rivalEnMano) {
          event.preventDefault();
          quitaRivalDibujado(rivalEnMano.id);
        } else if (trazoEnMano) {
          event.preventDefault();
          borraTrazo(trazoEnMano.id);
        } else if (seleccion && slide.fichas.some((ficha) => ficha.id === seleccion)) {
          event.preventDefault();
          mutaSlide((actual) => ({
            ...actual,
            fichas: actual.fichas.filter((ficha) => ficha.id !== seleccion),
          }));
          setSeleccion(null);
        }

        return;
      }

      /* Las flechas afinan la cara elegida: 2 px, o 20 con Mayús. */
      const paso = event.shiftKey ? 20 : 2;
      const delta = {
        ArrowLeft: [-paso, 0],
        ArrowRight: [paso, 0],
        ArrowUp: [0, -paso],
        ArrowDown: [0, paso],
      }[tecla];

      if (delta && rivalEnMano && tiempo == null) {
        event.preventDefault();

        cambiaRivalDibujado(
          rivalEnMano.id,
          {
            x: Math.max(30, Math.min(TABLERO_W - 30, rivalEnMano.x + delta[0])),
            y: Math.max(CABECERA_H + 40, Math.min(TABLERO_H - 10, rivalEnMano.y + delta[1])),
          },
          `tecla:${rivalEnMano.id}`,
        );

        return;
      }

      if (delta && seleccion && tiempo == null) {
        const ficha = slide.fichas.find((item) => item.id === seleccion);

        if (!ficha) return;

        event.preventDefault();

        mueveFicha(
          seleccion,
          Math.max(40, Math.min(TABLERO_W - 40, ficha.x + delta[0])),
          Math.max(CABECERA_H + 120, Math.min(TABLERO_H - 10, ficha.y + delta[1])),
          `tecla:${seleccion}`,
        );
      }
    };
  });

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

  const aprendidos = Object.keys(memoriaAlDia).length;

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
                  {(partidos.length === 0 || !elegido) && (
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
                    tone={!tablero || !tieneFichas(tablero.slides) ? "primary" : undefined}
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
                  icon={Repeat}
                  onClick={() => setCambiando({ sale: null })}
                  disabled={!tablero || !tieneFichas(tablero.slides)}
                  title="Poner a otro jugador en el sitio de uno del once, en todas las diapositivas"
                >
                  Cambiar jugador
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
              <button
                type="button"
                onClick={() => setCabeceraAbierta((antes) => !antes)}
                aria-expanded={cabeceraAbierta}
                className="mt-3 w-full rounded-xl border border-white/10 px-3 py-2 text-left text-xs font-medium text-white/65 sm:hidden"
              >
                {cabeceraAbierta ? "Ocultar de quién es la pizarra" : "Cambiar el rival o la jornada de la pizarra"}
              </button>
            )}

            {partido && (
              <div className={`mt-3 ${cabeceraAbierta ? "" : "max-sm:hidden"}`}>
                <Panel
                  title="De quién es esta pizarra"
                  subtitle="El nombre que se lee en la diapositiva y la jornada con la que se cruza el resto de la semana"
                  icon={Shield}
                  action={
                    /* El desplegable de partido es un <select> nativo y no
                       puede llevar el escudo: se reconoce aquí a quién se le
                       está montando la pizarra. */
                    <span className="flex min-w-0 items-center gap-2 text-sm font-semibold text-white/70">
                      <EscudoEquipo
                        nombre={tablero?.rival || partido.opponent}
                        escudo={escudoDe(tablero?.rival || partido.opponent)}
                        lado={26}
                      />

                      <span className="truncate">
                        {tablero?.rival || partido.opponent}
                      </span>
                    </span>
                  }
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
                    subtitle={`${
                      totales.cubiertos >= totales.total
                        ? "Todos los puestos tienen jugador"
                        : `${totales.total - totales.cubiertos} ${
                            totales.total - totales.cubiertos === 1 ? "puesto sin jugador" : "puestos sin jugador"
                          }`
                    } · arrastra una diapositiva para cambiar el orden del PowerPoint`}
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
                                {indice + 1}. {tituloVisible(tablero.slides, indice)}
                              </span>
                            </span>

                            {/* La cifra, sólo si falta alguien: completa no hace falta decir nada. */}
                            {(!total || cubiertos < total) && (
                              <span className="block text-[10px] tabular-nums text-amber-300/70">
                                {total ? `Faltan ${total - cubiertos}` : "Libre"}
                              </span>
                            )}
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
                    <BarraDibujo
                      herramienta={herramienta}
                      onHerramienta={(nueva) => {
                        setHerramienta(nueva);
                        setTrazoElegido(null);
                        setRivalElegido(null);
                      }}
                      fase={fase}
                      onFase={setFase}
                      elegido={trazoEnMano}
                      onCambiarElegido={(cambio) =>
                        trazoEnMano && cambiaTrazo(trazoEnMano.id, cambio)
                      }
                      onBorrarElegido={() => trazoEnMano && borraTrazo(trazoEnMano.id)}
                      puedeDeshacer={hayDeshacer.atras > 0}
                      puedeRehacer={hayDeshacer.adelante > 0}
                      onDeshacer={deshaz}
                      onRehacer={rehaz}
                      fases={fases}
                      reproduciendo={tiempo != null}
                      onReproducir={reproduce}
                      onParar={paraReproduccion}
                      onProyectar={() => setProyectando(activa)}
                      trazos={trazos.length}
                      rival={rivalEnMano}
                      onDorsalRival={(dorsal) =>
                        rivalEnMano &&
                        cambiaRivalDibujado(
                          rivalEnMano.id,
                          { dorsal: dorsal.trim() ? dorsal.toUpperCase() : undefined },
                          `texto:dorsal:${rivalEnMano.id}`,
                        )
                      }
                      onBorrarRival={() => rivalEnMano && quitaRivalDibujado(rivalEnMano.id)}
                    />

                    {/*
                    | Su defensa y el vídeo de la jugada, justo encima del
                    | tablero: son las dos cosas que se hacen con la rutina ya
                    | dibujada, antes de llevarla a la sala.
                    */}
                    {(familiaDePlantilla(slide.plantilla) || fases > 0) && (
                      <div className="mb-3 flex flex-wrap items-center gap-2">
                        {familiaDePlantilla(slide.plantilla) && (
                          <Button
                            icon={Users}
                            onClick={() => void ponSuDefensa()}
                            disabled={poniendoDefensa}
                            title="Coloca al rival como defiende esta acción según su scouting de ABP, con el dorsal de sus rematadores"
                          >
                            {poniendoDefensa ? "Leyendo su scouting…" : "Poner su defensa"}
                          </Button>
                        )}

                        <VideoJugada
                          slide={slide}
                          titulo={tablero ? tituloVisible(tablero.slides, activa) : slide.titulo}
                          players={porId}
                          temporada={temporadaCorta(RATINGS_SEASON)}
                          rival={tablero?.rival || partido.opponent}
                          jornada={tablero?.jornada ? `J${tablero.jornada}` : undefined}
                        />
                      </div>
                    )}

                    <TableroSlide
                      slide={slide}
                      titulo={tablero ? tituloVisible(tablero.slides, activa) : undefined}
                      players={porId}
                      temporada={temporadaCorta(RATINGS_SEASON)}
                      rival={tablero?.rival || partido.opponent}
                      seleccion={seleccion}
                      onSeleccionar={setSeleccion}
                      onMover={(id, x, y) => mueveFicha(id, x, y, `gesto:${gesto.current}`)}
                      onQuitar={(id) => {
                        mutaSlide((actual) => ({
                          ...actual,
                          fichas: actual.fichas.filter((ficha) => ficha.id !== id),
                        }));

                        setSeleccion(null);
                      }}
                      onPulsarPuesto={setEditando}
                      herramienta={herramienta}
                      fase={fase}
                      trazoElegido={trazoElegido}
                      onElegirTrazo={setTrazoElegido}
                      onCrearTrazo={creaTrazo}
                      onCambiarTrazo={(id, cambio) =>
                        cambiaTrazo(id, cambio, `gesto:${gesto.current}`)
                      }
                      onPasoNuevo={pasoNuevo}
                      tiempo={tiempo}
                      rivalElegido={rivalElegido}
                      onElegirRival={setRivalElegido}
                      onCrearRival={creaRival}
                      onMoverRival={(id, x, y) =>
                        cambiaRivalDibujado(id, { x, y }, `gesto:${gesto.current}`)
                      }
                    />

                    {/*
                    | En el móvil en vertical la diapositiva es una miniatura: se
                    | ofrece verla a pantalla completa (el proyector intenta girar
                    | a horizontal) y las consignas van debajo como texto normal.
                    */}
                    <div className="mt-3 space-y-3 sm:hidden">
                      <Button icon={Smartphone} onClick={() => setProyectando(activa)}>
                        Ver en horizontal, a pantalla completa
                      </Button>

                      {lineasConsignas(slide.notas).length > 0 && (
                        <div className="rounded-xl border border-white/10 bg-white/[0.03] px-3.5 py-3">
                          <p className="mb-2 text-[11px] font-semibold uppercase tracking-[0.18em] text-white/45">
                            Consignas
                          </p>

                          <ul className="space-y-1.5">
                            {lineasConsignas(slide.notas).map((linea, indice) =>
                              linea.tipo === "subtitulo" ? (
                                <li
                                  key={`${indice}-${linea.texto}`}
                                  className="pt-1 text-[12px] font-semibold uppercase tracking-[0.16em] text-white/45"
                                >
                                  {linea.texto}
                                </li>
                              ) : (
                                <li key={`${indice}-${linea.texto}`} className="text-base leading-snug text-white/85">
                                  {linea.texto}
                                </li>
                              ),
                            )}
                          </ul>
                        </div>
                      )}
                    </div>
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

                {/* ====================== TEXTOS ====================== */}

                {slide && (
                  <div className="mt-5">
                    <TextosDeLaSlide
                      slide={slide}
                      guardadoParaSiguientes={Boolean(
                        store.textos?.[slide.plantilla],
                      )}
                      onTitulo={(titulo) =>
                        mutaSlide((actual) => ({ ...actual, titulo }), "texto:titulo")
                      }
                      onNotas={(notas) =>
                        mutaSlide((actual) => ({ ...actual, notas }), "texto:notas")
                      }
                      onGuion={(clave, texto) =>
                        mutaSlide((actual) => {
                          const guion = { ...actual.guion, [clave]: texto };

                          if (!texto.trim()) delete guion[clave];

                          const { guion: _antes, ...resto } = actual;

                          return Object.keys(guion).length ? { ...resto, guion } : resto;
                        }, `texto:guion:${clave}`)
                      }
                      onTexto={cambiaTexto}
                      onDejarParaLasSiguientes={() =>
                        dejaParaLasSiguientes(slide)
                      }
                      onVolverALaPlantilla={() => vuelveALaPlantilla(slide)}
                    />
                  </div>
                )}

                {/* ================== CONTROL DE GAZAPOS ============== */}

                {tablero && tablero.slides.length > 1 && (
                  <div className="mt-5">
                    <ControlDeGazapos
                      tablero={tablero}
                      players={porId}
                      onCambiar={(playerId) => setCambiando({ sale: playerId })}
                    />
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
                        : undefined
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
                        una misma diapositiva —en las directas, dentro de un
                        mismo sitio: el mismo tirador puede estar en los tres—.
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
          /* Cambiar de posición reinicia lo marcado: es otra decisión. */
          key={grupoEditado?.key ?? puestoEditado.key}
          puesto={puestoEditado}
          grupo={grupoEditado ?? undefined}
          players={players}
          memoria={
            grupoEditado
              ? memoriaDeGrupo(memoriaAlDia, grupoEditado.puestos)
              : (memoriaAlDia[puestoEditado.key] ?? [])
          }
          ocupadoPor={ocupadoPor}
          actual={
            slide.fichas.find((ficha) => ficha.puesto === puestoEditado.key)
              ?.playerId ?? null
          }
          elegidos={
            grupoEditado ? ocupantesDeGrupo(slide, grupoEditado.key) : undefined
          }
          onElegir={(playerId) => asigna(puestoEditado.key, playerId)}
          onGuardarGrupo={(playerIds) =>
            grupoEditado && asignaGrupo(grupoEditado.puestos, playerIds)
          }
          onQuitar={() => vacia(puestoEditado.key)}
          onCerrar={() => setEditando(null)}
        />
      )}

      {tablero && proyectando != null && (
        <ProyectaPizarra
          slides={tablero.slides}
          inicial={proyectando}
          players={porId}
          temporada={temporadaCorta(RATINGS_SEASON)}
          rival={tablero.rival || partido?.opponent || ""}
          onCerrar={(indice) => {
            setProyectando(null);
            setPedida(indice);
          }}
        />
      )}

      {tablero && cambiando && (
        <CambiaJugador
          tablero={tablero}
          players={players}
          inicial={cambiando.sale}
          onAplicar={aplicaCambio}
          onCerrar={() => setCambiando(null)}
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
  const memoriaAlDia = useMemo(
    () => normalizaMemoria(store.memoria ?? {}),
    [store.memoria],
  );

  const filas = useMemo(() => {
    const porPlantilla = new Map<
      string,
      { code: string; label: string; nombres: string[] }[]
    >();

    Object.entries(memoriaAlDia).forEach(([key, lista]) => {
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
  }, [memoriaAlDia, porId]);

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

/* ------------------------------------------------------------------ */
/*  TEXTOS DE LA DIAPOSITIVA                                           */
/* ------------------------------------------------------------------ */

/**
 * Todo lo que se lee en una diapositiva y no es un nombre de jugador.
 *
 * El título, las consignas, los rótulos de las cajas del panel y los de los
 * dibujos del campo salen de la plantilla, que es el pptx que el cuerpo
 * técnico montaba a mano. Sirve para la mayoría de las semanas y no para
 * todas: contra un equipo que ataca al segundo palo, «MARCAS» quiere decir
 * «MARCAS AL SEGUNDO PALO», y hasta ahora eso obligaba a tocar el código.
 *
 * **Escribir cambia sólo esta jornada.** Es lo normal y por eso no hay que
 * elegir nada para hacerlo. Que el cambio valga de aquí en adelante sí es una
 * decisión, y va en un botón aparte: deja estos textos como los que heredarán
 * las jornadas que se monten después, sin tocar las ya cerradas.
 */
function TextosDeLaSlide({
  slide,
  guardadoParaSiguientes,
  onTitulo,
  onNotas,
  onGuion,
  onTexto,
  onDejarParaLasSiguientes,
  onVolverALaPlantilla,
}: {
  slide: SlidePizarra;
  guardadoParaSiguientes: boolean;
  onTitulo: (titulo: string) => void;
  onNotas: (notas: string[]) => void;
  onGuion: (clave: (typeof CASILLAS_GUION)[number]["key"], texto: string) => void;
  onTexto: (fn: (textos: TextosSlide) => TextosSlide) => void;
  onDejarParaLasSiguientes: () => void;
  onVolverALaPlantilla: () => void;
}) {
  /* Los de la plantilla, para enseñarlos de marca de agua en cada casilla. */
  const grupos = gruposDePlantilla(slide);
  const adornos = adornosDePlantilla(slide);

  const propios = tieneTextosPropios(slide);

  const campo =
    "w-full rounded-xl border border-white/10 bg-white/[0.04] px-3 py-2 text-sm text-white outline-none transition placeholder:text-white/25 focus:border-[#C8A96B]/50";

  return (
    <Panel
      title="Textos de la diapositiva"
      subtitle="Lo que se lee en el tablero. Se cambia sólo para este partido salvo que lo dejes para las siguientes."
      icon={Type}
    >
      <div className="space-y-4">
        <div>
          <p className="mb-1.5 text-[11px] uppercase tracking-[0.18em] text-white/35">
            Título
          </p>

          <input
            value={slide.titulo}
            onChange={(event) => onTitulo(event.target.value)}
            placeholder={PLANTILLA_BY_KEY.get(slide.plantilla)?.titulo}
            className={campo}
          />
        </div>

        {/*
        | Señal, rutina e intención en casillas fijas: en la sala se leen en ese
        | orden y separan la señal de lo que hay que hacer. Optativas; lo que se
        | escriba sale antes de las consignas libres, cada una con su rótulo.
        */}
        <div>
          <p className="mb-1.5 text-[11px] uppercase tracking-[0.18em] text-white/35">
            Señal, rutina e intención · optativo
          </p>

          {/* Una por fila: en tres columnas la rutina, que es la más larga, se cortaba en el campo. */}
          <div className="grid gap-2">
            {CASILLAS_GUION.map((casilla) => (
              <label key={casilla.key} className="block">
                <span className="mb-1 block text-xs font-semibold text-[#E4CE9B]">
                  {casilla.rotulo}
                </span>

                <input
                  value={slide.guion?.[casilla.key] ?? ""}
                  onChange={(event) => onGuion(casilla.key, event.target.value)}
                  placeholder={casilla.ejemplo}
                  maxLength={120}
                  className={campo}
                />
              </label>
            ))}
          </div>
        </div>

        <div>
          <p className="mb-1.5 text-[11px] uppercase tracking-[0.18em] text-white/35">
            Consignas · una por línea
          </p>

          <textarea
            value={slide.notas.join("\n")}
            onChange={(event) =>
              onNotas(
                event.target.value.split("\n").map((linea) => linea.trimStart()),
              )
            }
            rows={5}
            placeholder="Remate detrás de corta…"
            className={`${campo} leading-relaxed`}
          />

          {/* En la sala se leen tres consignas cortas, no un párrafo. */}
          {avisosConsignas(slide.notas).map((aviso) => (
            <p key={aviso} className="mt-1.5 flex items-start gap-1.5 text-xs leading-relaxed text-amber-300/80">
              <AlertTriangle size={13} className="mt-0.5 shrink-0" />
              {aviso}
            </p>
          ))}

          <p className="mt-1.5 text-[11px] leading-relaxed text-white/35">
            Una línea que acaba en «:» sale como rótulo de las que van detrás.
          </p>
        </div>

        {grupos.length > 0 && (
          <div>
            <p className="mb-1.5 text-[11px] uppercase tracking-[0.18em] text-white/35">
              Cajas del panel
            </p>

            <div className="grid gap-2 sm:grid-cols-2">
              {grupos.map((grupo) => (
                <input
                  key={grupo.key}
                  value={slide.textos?.grupos?.[grupo.key] ?? ""}
                  onChange={(event) =>
                    onTexto((textos) => ({
                      ...textos,
                      grupos: {
                        ...textos.grupos,
                        [grupo.key]: event.target.value,
                      },
                    }))
                  }
                  placeholder={grupo.label}
                  className={campo}
                />
              ))}
            </div>
          </div>
        )}

        {adornos.length > 0 && (
          <div>
            <p className="mb-1.5 text-[11px] uppercase tracking-[0.18em] text-white/35">
              Rótulos del campo
            </p>

            <div className="space-y-2">
              {adornos.map((adorno, indice) => (
                <div
                  key={`${adorno.tipo}-${indice}`}
                  className={
                    adorno.tipo === "transicion"
                      ? "grid gap-2 sm:grid-cols-2"
                      : ""
                  }
                >
                  <input
                    value={slide.textos?.adornos?.[indice]?.label ?? ""}
                    onChange={(event) =>
                      onTexto((textos) => ({
                        ...textos,
                        adornos: conAdorno(textos.adornos, indice, {
                          label: event.target.value,
                        }),
                      }))
                    }
                    placeholder={adorno.label}
                    className={campo}
                  />

                  {adorno.tipo === "transicion" && (
                    <input
                      value={slide.textos?.adornos?.[indice]?.remate ?? ""}
                      onChange={(event) =>
                        onTexto((textos) => ({
                          ...textos,
                          adornos: conAdorno(textos.adornos, indice, {
                            remate: event.target.value,
                          }),
                        }))
                      }
                      placeholder={adorno.remate}
                      className={campo}
                    />
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

        <div className="flex flex-wrap items-center gap-2 border-t border-white/10 pt-3">
          <Button
            tone="ghost"
            icon={Save}
            onClick={onDejarParaLasSiguientes}
            title="Las jornadas que montes a partir de ahora nacerán con estos textos"
          >
            Dejarlo para las siguientes
          </Button>

          {(propios || guardadoParaSiguientes) && (
            <Button
              tone="ghost"
              icon={RotateCcw}
              onClick={onVolverALaPlantilla}
              title="Vuelve a los textos de la plantilla, aquí y en las jornadas nuevas"
            >
              Volver a la plantilla
            </Button>
          )}

          <p className="text-[11px] text-white/35">
            {guardadoParaSiguientes
              ? "Estos textos ya son los de siempre para esta diapositiva."
              : propios
                ? "Cambiado sólo en este partido."
                : "Tal y como viene en la plantilla."}
          </p>
        </div>
      </div>
    </Panel>
  );
}

/** Cambia un rótulo del campo sin tocar los demás ni perder los huecos. */
function conAdorno(
  actuales: TextosSlide["adornos"],
  indice: number,
  cambio: { label?: string; remate?: string },
) {
  const lista = [...(actuales ?? [])];

  while (lista.length <= indice) lista.push({});

  lista[indice] = { ...lista[indice], ...cambio };

  return lista;
}

/* ------------------------------------------------------------------ */
/*  CONTROL DE GAZAPOS                                                 */
/* ------------------------------------------------------------------ */

/**
 * Avisa cuando no sale la misma gente en todas las diapositivas del partido.
 *
 * En un partido juegan los mismos once: el que remata el córner es el que
 * marca en el córner de ellos. Si alguien está en cinco diapositivas y falta
 * en dos, o se coló un nombre que hoy no juega, o a dos diapositivas les falta
 * uno. Las dos cosas se descubrían el domingo, con la sala llena.
 *
 * **No corrige nada.** Puede haber una semana en la que de verdad no coincidan
 * —un lesionado que entra en la lista a última hora—, y quien decide es el
 * entrenador; esto sólo lo enseña, con el nombre y en qué diapositivas falta.
 */
function ControlDeGazapos({
  tablero,
  players,
  onCambiar,
}: {
  tablero: TableroPizarra;
  players: Map<string, Player>;
  /** Abre el cambio de jugador con éste como el que sale. */
  onCambiar: (playerId: string) => void;
}) {
  const revision = useMemo(() => revisaTablero(tablero), [tablero]);

  const limpio = revision.gazapos.length === 0 && revision.slidesConGente > 1;

  /* Sin dos diapositivas con gente no hay nada que cotejar: no se pinta. */
  if (revision.slidesConGente < 2) return null;

  return (
    <Panel
      title="Control de la convocatoria"
      subtitle={
        revision.slidesConGente < 2
          ? "Hace falta gente en al menos dos diapositivas para poder cotejarlas"
          : `${revision.total} jugadores repartidos por ${revision.slidesConGente} diapositivas`
      }
      icon={limpio ? CheckCircle2 : AlertTriangle}
    >
      {revision.slidesConGente < 2 ? (
        <p className="text-xs leading-relaxed text-white/40">
          Cuando haya al menos dos diapositivas montadas se comprueba aquí que
          en todas salga la misma gente.
        </p>
      ) : limpio ? (
        <p className="text-xs leading-relaxed text-emerald-300/80">
          Cuadra: nadie falta donde cabe, con {revision.total} jugadores repartidos por las{" "}
          {revision.slidesConGente} diapositivas montadas.
        </p>
      ) : (
        <div className="space-y-3">
          <p className="text-xs leading-relaxed text-amber-300/80">
            {revision.gazapos.length === 1
              ? "Hay un jugador que no está en todas las diapositivas."
              : `Hay ${revision.gazapos.length} jugadores que no están en todas las diapositivas.`}{" "}
            Revísalo antes de exportar.
          </p>

          <div className="space-y-1.5">
            {revision.gazapos.map((gazapo) => {
              const player = players.get(gazapo.playerId);

              return (
                <div
                  key={gazapo.playerId}
                  className="flex flex-wrap items-center gap-x-2 gap-y-1 rounded-xl border border-amber-300/20 bg-amber-300/[0.05] px-3 py-2"
                >
                  <span className="text-xs font-semibold text-white/85">
                    {player?.apodo || player?.nombre || gazapo.playerId}
                  </span>

                  <span className="text-[11px] text-white/40">
                    falta en {gazapo.falta.length} de {revision.slidesConGente}:
                  </span>

                  <span className="min-w-0 text-[11px] text-amber-200/70">
                    {gazapo.falta.map((slide) => slide.titulo).join(" · ")}
                  </span>

                  <button
                    type="button"
                    onClick={() => onCambiar(gazapo.playerId)}
                    title="Poner a otro en su sitio en todas las diapositivas"
                    className="ml-auto inline-flex shrink-0 items-center gap-1 rounded-lg border border-white/12 px-2.5 py-1 text-[11px] text-white/60 transition hover:border-[#C8A96B]/50 hover:text-white sm:px-2 sm:py-0.5"
                  >
                    <Repeat size={11} />
                    Cambiar
                  </button>
                </div>
              );
            })}
          </div>
        </div>
      )}

      <div className="mt-3 flex flex-wrap gap-x-3 gap-y-1 border-t border-white/10 pt-3">
        {revision.porSlide.map((slide) => (
          <span key={slide.id} className="text-[11px] text-white/35">
            {slide.titulo}{" "}
            <span className="tabular-nums text-white/55">{slide.cuantos}</span>
          </span>
        ))}
      </div>
    </Panel>
  );
}
