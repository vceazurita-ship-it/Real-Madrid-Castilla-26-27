"use client";

/**
 * Los vídeos del rival que hay en nuestro canal de YouTube.
 *
 * En el canal hay **una lista de reproducción por equipo rival** con los cortes
 * que se han ido montando en el coding. Hasta ahora ese material vivía sólo
 * allí: para verlo había que abrir YouTube, acordarse de cómo se llamaba la
 * lista y buscar a mano el corte del jugador. Aquí entra en el scouting
 * individual, que es donde se mira al rival jugador a jugador.
 *
 * Lo que hace que sirva, y no sea un marco con YouTube dentro:
 *
 * - **La lista se encuentra sola.** Se empareja por el nombre del equipo
 *   (`lib/rivals/youtube-listas.ts`); lo que no case se elige una vez y se
 *   recuerda para todo el mundo.
 * - **Cada vídeo se le cuelga a su jugador.** Buscando en el título los
 *   nombres de la plantilla que ya está en la hoja. Lo que no se pueda
 *   atribuir con seguridad se queda en «del equipo», que es más honesto que
 *   adivinar.
 * - **Se ve aquí dentro.** El corte se abre en un pop-up sin salir de la
 *   pantalla, con el enlace a mano para pegarlo en un informe.
 */

import { useEffect, useMemo, useState } from "react";
import {
  AlertTriangle,
  ChevronLeft,
  ChevronRight,
  ExternalLink,
  Link2,
  ListVideo,
  Loader2,
  Play,
  RefreshCw,
  Search,
  SquarePlay as Youtube,
  Users,
  X,
} from "lucide-react";
import { toast } from "sonner";

import { useRemoteDoc } from "@/hooks/useRemoteDoc";
import { useCalendario } from "@/hooks/useCalendario";
import { comoNuestro } from "@/lib/castilla/calendario";
import { nombreEquipo } from "@/lib/equipos";
import {
  CLAVE_LISTAS,
  LISTAS_VACIAS,
  buscaLista,
  parecido,
  desnuda,
  enlaceIncrustado,
  enlaceLista,
  enlaceVideo,
  esEtiquetaDebil,
  jugadorDelTitulo,
  tituloSoloRepite,
  resumenDeTemporada,
  temaDelTitulo,
  type JugadorPlantilla,
  type ListaCanal,
  type ListasRivales,
} from "@/lib/rivals/youtube-listas";
import { Explicativo } from "@/components/ui/textos-analisis";
import { MEJOR, PEOR } from "@/components/data/graficas";

type Video = {
  id: string;
  titulo: string;
  descripcion: string;
  miniatura: string;
  publicado: string;
  posicion: number;
};

/**
 * El título en bruto del canal a veces es sólo el dorsal o «CLUB Nº7» una vez quitado el nombre:
 * eso no dice qué mirar, así que se numera el corte.
 */
function temaLegible(tema: string, posicion: number, descripcion = "") {
  const limpio = tema
    .replace(/\bN[º°o]\s*\d+\b/gi, " ")
    .replace(/^\d+\b/, " ")
    .replace(/\s+/g, " ")
    .trim();

  if (limpio.length >= 3 && /\p{L}{3}/u.test(limpio) && !/\bC\.?F\.?(\s|$)/i.test(limpio)) return tema;

  /* Sin título que diga algo, la primera línea de la descripción (24/10/2026); si tampoco, el número del corte. */
  const linea = descripcion
    .split(/\r?\n/)
    .map((l) => l.trim())
    .find((l) => l.length >= 8 && !/^https?:/i.test(l) && /\p{L}{4}/u.test(l));

  return linea ? (linea.length > 90 ? `${linea.slice(0, 87)}...` : linea) : `Corte ${posicion + 1}`;
}

/** Orden de los puestos para los chips: portero, defensa, medio, delantero; lo desconocido, al final. */
function rangoDePuesto(puesto: string) {
  const p = puesto.toLowerCase().trim();

  if (/portero|^(por|pt|gk)$/.test(p)) return 0;
  if (/lateral|central|defensa|carrilero|^(df|dfc|dfd|dfi|ld|li|lb|rb|cb)$/.test(p)) return 1;
  if (/medio|pivote|interior|mediapunta|centrocampista|volante|^(mc|mcd|mco|mp|cmf|dmf|amf)$/.test(p)) return 2;
  if (/extremo|delantero|punta|banda|^(dc|ed|ei|ex|cf|lw|rw)$/.test(p)) return 3;

  return 4;
}

/** El rótulo de cada línea, por el rango de `rangoDePuesto`. */
const LINEAS = ["Porteros", "Defensas", "Centrocampistas", "Delanteros", "Otros"] as const;

/** Un vídeo ya colocado: de quién es y de qué va, además del vídeo. */
type Pieza = {
  video: Video;
  /** El título sin el nombre del jugador: lo que describe el corte. */
  tema: string;
  /** Vacío cuando el título no dice de quién es. */
  jugador: string;
  dorsal: string;
  /** Su puesto y sus etiquetas, para que la ficha diga qué mirar del corte. */
  puesto: string;
  etiquetas: string[];
  /** «titular en 5 de 8 · 540 min», para decidir a quién ver primero. */
  resumen: string;
};

type Estado =
  | { fase: "cargando" }
  | { fase: "sin-conectar"; aviso: string; caido?: boolean }
  | { fase: "listo"; canal: string; listas: ListaCanal[] };

/* ------------------------------------------------------------------ */
/*  CUÁNTAS FICHAS POR FILA                                            */
/* ------------------------------------------------------------------ */

/**
 * El tamaño de las fichas, a elegir.
 *
 * Repasar a un jugador con seis cortes y barrer los ochenta de un equipo son
 * dos trabajos distintos: el primero quiere la miniatura grande y el segundo
 * quiere verlos todos de una pantallada. Las clases se escriben **enteras**
 * porque Tailwind las busca en el texto del archivo: `grid-cols-${n}` no
 * compila.
 */
const TAMANOS = [
  {
    key: "grande",
    label: "Grande",
    columnas: "grid-cols-1 sm:grid-cols-2 xl:grid-cols-3",
  },
  {
    key: "medio",
    label: "Medio",
    columnas: "grid-cols-2 sm:grid-cols-3 xl:grid-cols-4",
  },
  {
    key: "pequeno",
    label: "Pequeño",
    columnas: "grid-cols-2 sm:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6",
  },
] as const;

type TamanoKey = (typeof TAMANOS)[number]["key"];

/** La marca que se guardaba al elegir «Ninguna» lista: ya no se ofrece, pero puede quedar guardada. */
const SIN_LISTA = "-";

const CLAVE_TAMANO = "rmcf-videos-tamano";

/** Lo más que se espera al canal o a una lista antes de ofrecer «Volver a probar» (30/10/2026). */
const ESPERA_MAXIMA_MS = 8_000;
const CLAVE_AGRUPADO = "rmcf-videos-agrupado";

const esTamano = (valor: unknown): valor is TamanoKey =>
  TAMANOS.some((item) => item.key === valor);

const fecha = (iso: string) => {
  if (!iso) return "";

  const dia = new Date(iso);

  return Number.isNaN(dia.getTime())
    ? ""
    : dia.toLocaleDateString("es-ES", {
        day: "numeric",
        month: "short",
        year: "numeric",
      });
};


/*
| «J 06 ATLÉTICO DE MADRID B» → «J6 · Atlético de Madrid B» y fuera el
| «INDIVIDUAL» del final (29/10/2026): un solo formato en el desplegable.
*/
/*
| 29/10/2026: a las expresiones se les habían caído las barras (`s*`, `d+`) y
| ninguna casaba, así que salía el título crudo («J 06 atlético de madrid b»).
| Y con la jornada se pone el nombre oficial del rival de esa jornada en
| nuestro calendario (Atlético Madrileño, Algeciras…), no el que se tecleó.
*/
function nombreDeLista(nombre: string, rivalDeJornada?: Map<number, string>) {
  const m = /^\s*J\s*0*(\d+)\s*[-·:]?\s*(.*)$/i.exec(nombre);
  const resto = (m ? m[2] : nombre).replace(/[\s·-]+INDIVIDUAL\s*$/i, "").trim();
  const delCalendario = m ? rivalDeJornada?.get(Number(m[1])) : undefined;
  /* Sólo si es el mismo equipo (comparten alguna palabra): una lista de otro
     equipo con número de jornada no se renombra con nuestro rival de ese día. */
  const palabras = (t: string) => t.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().split(/[^a-z0-9]+/).filter((w) => w.length > 3);
  const oficial = delCalendario && palabras(delCalendario).some((w) => palabras(resto).includes(w)) ? delCalendario : undefined;
  const chicas = new Set(["de", "del", "la", "el", "los", "las", "y"]);
  const bonito = oficial
    ? oficial
    : resto !== resto.toUpperCase() && resto !== resto.toLowerCase()
      ? resto
      : resto
        .toLowerCase()
        .split(/\s+/)
        .map((w, k) => (w.length <= 2 && k > 0 && !chicas.has(w) ? w.toUpperCase() : k > 0 && chicas.has(w) ? w : w.charAt(0).toUpperCase() + w.slice(1)))
        .join(" ");

  return m ? `J${Number(m[1])} · ${bonito}` : bonito;
}

export function VideosDelCanal({
  equipo,
  plantilla,
}: {
  equipo: string;
  plantilla: JugadorPlantilla[];
}) {
  const [estado, setEstado] = useState<Estado>({ fase: "cargando" });
  const [busca, setBusca] = useState("");
  const [abierto, setAbierto] = useState<Video | null>(null);

  /* El rival oficial de cada jornada de nuestro calendario, para nombrar las listas (29/10/2026). */
  const { partidos } = useCalendario();
  const rivalDeJornada = useMemo(
    () => new Map(partidos.map((p) => comoNuestro(p)).filter((p) => p.jornada && p.rival).map((p) => [p.jornada, nombreEquipo(p.rival)] as const)),
    [partidos],
  );

  /*
  | El tamaño de las fichas y si se agrupan por jugador.
  |
  | Son preferencias de quien mira, no del rival, así que viven en este
  | navegador y se recuerdan: quien trabaja con la lista en pequeño no quiere
  | volver a elegirlo cada vez que cambia de equipo. Se leen con el inicializador
  | perezoso de `useState` —no con un efecto— para que no haya un primer pintado
  | con el tamaño que no es.
  */
  const [tamano, setTamano] = useState<TamanoKey>(() => {
    if (typeof window === "undefined") return "medio";

    try {
      const guardado = window.localStorage.getItem(CLAVE_TAMANO);

      return esTamano(guardado) ? guardado : "medio";
    } catch {
      return "medio";
    }
  });

  const eligeTamano = (key: TamanoKey) => {
    setTamano(key);

    try {
      window.localStorage.setItem(CLAVE_TAMANO, key);
    } catch {
      /* modo privado: se queda en esta sesión */
    }
  };

  const columnas =
    TAMANOS.find((item) => item.key === tamano)?.columnas ?? TAMANOS[1].columnas;

  /*
  | Agrupado por jugador, o todo seguido.
  |
  | Agrupar es lo que se quiere al preparar a un jugador, pero parte la rejilla:
  | un jugador con tres cortes deja la fila a medias y la página baja a saltos,
  | con tres fichas arriba y una al final. «Todo seguido» es una sola rejilla
  | que llena el ancho de punta a punta —cada ficha dice de quién es— y sirve
  | para barrer el material del rival entero de una pasada.
  */
  const [agrupado, setAgrupado] = useState(() => {
    if (typeof window === "undefined") return true;

    try {
      return window.localStorage.getItem(CLAVE_AGRUPADO) !== "no";
    } catch {
      return true;
    }
  });

  const cambiaAgrupado = (valor: boolean) => {
    setAgrupado(valor);

    try {
      window.localStorage.setItem(CLAVE_AGRUPADO, valor ? "si" : "no");
    } catch {
      /* modo privado: se queda en esta sesión */
    }
  };

  /* Sube uno cada vez que se pulsa «volver a probar». */
  const [intento, setIntento] = useState(0);

  /*
  | Los vídeos se guardan **con la lista de la que salieron**.
  |
  | Guardarlos sueltos obligaba a vaciarlos desde un efecto al cambiar de lista,
  | y eso el linter de React no lo deja pasar —con razón: es un render de más y
  | un parpadeo con los cortes del rival anterior—. Atados a su lista, «cuáles
  | toca enseñar» y «está cargando» se deducen.
  */
  const [traidos, setTraidos] = useState<{ listaId: string; videos: Video[]; fallo?: boolean }>({
    listaId: "",
    videos: [],
  });

  /* «Volver a probar» de los vídeos: sube y el efecto los vuelve a pedir. */
  const [intentoVideos, setIntentoVideos] = useState(0);

  /* La lista elegida a mano para un equipo vale para todo el cuerpo técnico. */
  const { value: elegidas, setValue: setElegidas } = useRemoteDoc<ListasRivales>({
    key: CLAVE_LISTAS,
    kind: "rivals",
    fallback: LISTAS_VACIAS,
  });

  const clave = desnuda(equipo).replace(/\s+/g, "-");

  /* -------------------------- EL CANAL --------------------------- */

  useEffect(() => {
    const control = new AbortController();

    /*
    | Tiempo máximo (30/10/2026): si el canal no contesta en 8 s se corta la
    | petición y se pasa a «no se ha podido leer», con su «Volver a probar».
    | Antes el «Preguntando al canal…» podía quedarse girando sin fin.
    */
    let vencido = false;
    const reloj = window.setTimeout(() => {
      vencido = true;
      control.abort();
    }, ESPERA_MAXIMA_MS);

    /* El estado se toca **después** del `await`: cambiarlo en el cuerpo del
       efecto es un render en cascada y el linter de React lo prohíbe. */
    void (async () => {
      try {
        const datos = await fetch("/api/youtube/videos", {
          signal: control.signal,
        }).then((r) => r.json());

        window.clearTimeout(reloj);

        if (control.signal.aborted) return;

        if (!datos?.conectado) {
          setEstado({
            fase: "sin-conectar",
            aviso: datos?.aviso ?? "No hay cuenta de YouTube conectada.",
          });

          return;
        }

        setEstado({
          fase: "listo",
          canal: datos.canal ?? "nuestro canal",
          listas: (datos.listas ?? []) as ListaCanal[],
        });
      } catch (error) {
        window.clearTimeout(reloj);

        if (vencido) {
          setEstado({
            fase: "sin-conectar",
            aviso: "El canal de YouTube tarda demasiado en contestar.",
            caido: true,
          });

          return;
        }

        if (control.signal.aborted) return;

        console.error("[VideosDelCanal] canal", error);

        /* Sin red no es «sin conectar»: se dice aparte, para no mandar a
           nadie a volver a conectar una cuenta que está bien (19/10/2026). */
        setEstado({
          fase: "sin-conectar",
          aviso: "No se ha podido hablar con YouTube: puede ser la conexión.",
          caido: true,
        });
      }
    })();

    return () => {
      window.clearTimeout(reloj);
      control.abort();
    };
  }, [intento]);

  /* ------------------------- QUÉ LISTA ES ------------------------ */

  const lista = useMemo(() => {
    const listas = estado.fase === "listo" ? estado.listas : [];

    if (listas.length === 0) return null;

    /* Lo elegido a mano manda sobre lo que se adivine por el nombre. */
    const aMano = elegidas.porEquipo?.[clave];

    /* Sin lista elegida —o con la vieja marca de «Ninguna»— se abre la de la
       jornada del rival si la hay: un selector en «Ninguna» teniendo el rival
       su lista en el canal era una pantalla vacía sin motivo (29/10/2026). */
    const puesta = aMano && aMano !== SIN_LISTA ? listas.find((item) => item.id === aMano) : null;

    return puesta ?? buscaLista(listas, equipo);
  }, [clave, elegidas.porEquipo, equipo, estado]);

  /*
  | ¿Y si la lista puesta a mano no es la de este equipo?
  |
  | Un emparejado equivocado —un clic mal dado, una lista renombrada— no da
  | ningún error: enseña los cortes de otro rival con toda naturalidad, y esos
  | vídeos acaban en una charla. Como la elección a mano manda sobre el nombre a
  | propósito, la única defensa es decirlo: si el nombre de la lista no se
  | parece al del equipo, se avisa y se quita de un clic.
  */
  const puestaAMano = Boolean(
    lista && elegidas.porEquipo?.[clave] === lista.id,
  );

  const sospechosa = puestaAMano && lista ? parecido(lista.nombre, equipo) < 0.6 : false;

  const olvidaLaLista = () =>
    setElegidas((actual) => {
      const resto = { ...actual.porEquipo };

      delete resto[clave];

      return { ...actual, porEquipo: resto };
    });

  /* -------------------------- LOS VÍDEOS ------------------------- */

  const listaId = lista?.id ?? "";

  useEffect(() => {
    if (!listaId) return;

    const control = new AbortController();

    /* El mismo tiempo máximo que el canal (30/10/2026): al vencer, «No se
       han podido traer los vídeos» con su «Volver a probar». */
    let vencido = false;
    const reloj = window.setTimeout(() => {
      vencido = true;
      control.abort();
    }, ESPERA_MAXIMA_MS);

    void (async () => {
      try {
        const respuesta = await fetch(
          `/api/youtube/videos?lista=${encodeURIComponent(listaId)}`,
          { signal: control.signal },
        );

        const datos = await respuesta.json().catch(() => null);

        window.clearTimeout(reloj);

        if (control.signal.aborted && !vencido) return;

        /* Un fallo no es una lista vacía: antes se decía «no tiene vídeos»
           cuando lo que había fallado era la conexión (19/10/2026). */
        if (!respuesta.ok || !Array.isArray(datos?.videos)) {
          setTraidos({ listaId, videos: [], fallo: true });
          return;
        }

        setTraidos({ listaId, videos: datos.videos as Video[] });
      } catch (error) {
        window.clearTimeout(reloj);

        if (control.signal.aborted && !vencido) return;

        console.error("[VideosDelCanal] vídeos", error);

        setTraidos({ listaId, videos: [], fallo: true });
      }
    })();

    return () => {
      window.clearTimeout(reloj);
      control.abort();
    };
  }, [listaId, intentoVideos]);

  const falloVideos = Boolean(listaId) && traidos.listaId === listaId && Boolean(traidos.fallo);

  /* Lo traído sólo vale si es de la lista que se está mirando. La identidad
     tiene que ser estable o el reparto por jugador se rehace en cada render. */
  const videos = useMemo(
    () => (traidos.listaId === listaId ? traidos.videos : []),
    [listaId, traidos],
  );

  const cargandoVideos = Boolean(listaId) && traidos.listaId !== listaId;

  /* ------------------- REPARTIDOS POR JUGADOR -------------------- */

  const termino = busca.trim().toLowerCase();

  const grupos = useMemo(() => {
    const porJugador = new Map<string, { jugador: string; dorsal: string; puesto: string; titular: boolean; minutos: number; resumen: string; videos: Pieza[] }>();

    const sueltos: Pieza[] = [];

    for (const video of videos) {
      if (
        termino &&
        !`${video.titulo} ${video.descripcion}`.toLowerCase().includes(termino)
      ) {
        continue;
      }

      const jugador = jugadorDelTitulo(video.titulo, plantilla);

      /* El nombre viaja con la ficha: en la vista seguida no hay cabecera de
         jugador encima que lo diga. */
      const pieza: Pieza = {
        video,
        tema: temaDelTitulo(video.titulo, jugador),
        jugador: jugador?.nombre ?? "",
        dorsal: jugador?.dorsal ?? "",
        puesto: jugador?.puesto ?? "",
        etiquetas: jugador?.etiquetas ?? [],
        resumen: resumenDeTemporada(jugador),
      };

      if (!jugador) {
        sueltos.push(pieza);

        continue;
      }

      const grupo = porJugador.get(jugador.nombre) ?? {
        jugador: jugador.nombre,
        dorsal: jugador.dorsal ?? "",
        puesto: jugador.puesto ?? "",
        titular: Boolean(jugador.titular),
        minutos: jugador.minutos ?? 0,
        resumen: resumenDeTemporada(jugador),
        videos: [],
      };

      grupo.videos.push(pieza);
      porJugador.set(jugador.nombre, grupo);
    }

    return {
      jugadores: [...porJugador.values()].sort(
        (a, b) =>
          Number(b.titular) - Number(a.titular) ||
          b.minutos - a.minutos ||
          b.videos.length - a.videos.length ||
          a.jugador.localeCompare(b.jugador, "es"),
      ),
      sueltos,
    };
  }, [plantilla, termino, videos]);

  /*
  | Ver sólo a uno.
  |
  | Con quince jugadores y ochenta cortes, la lista entera obliga a desplazarse
  | buscando un nombre. Los chips de arriba son el índice **y** el filtro: dicen
  | de un vistazo quién tiene material y cuánto, y al pulsar dejan sólo lo suyo.
  */
  const [soloDe, setSoloDe] = useState<string>("");

  const SUELTOS = "__equipo";

  /* Los chips van por puesto (portero, defensas, medios, delanteros) y dentro de cada puesto por minutos. */
  const jugadoresPorPuesto = useMemo(
    () =>
      [...grupos.jugadores].sort(
        (a, b) => rangoDePuesto(a.puesto) - rangoDePuesto(b.puesto) || b.minutos - a.minutos,
      ),
    [grupos.jugadores],
  );

  /* Las fichas salen en el mismo orden que los chips y la leyenda: por puesto.
     Antes iban por minutos y la leyenda decía otra cosa (29/10/2026). */
  const jugadoresVisibles = useMemo(
    () => jugadoresPorPuesto.filter((grupo) => !soloDe || soloDe === grupo.jugador),
    [jugadoresPorPuesto, soloDe],
  );

  /*
  | Una sección por línea, con su rótulo.
  |
  | Dentro de cada una, los jugadores con UN solo corte van juntos en una
  | rejilla (23/10/2026): una ficha por fila, con su nombre encima, dejaba una
  | columna de 260 px en una pantalla de 1440. Los que tienen varios siguen con
  | su cabecera.
  */
  const porLinea = useMemo(
    () =>
      LINEAS.map((rotulo, rango) => {
        const suyos = jugadoresVisibles.filter((g) => rangoDePuesto(g.puesto) === rango);

        return {
          rango,
          rotulo,
          unCorte: suyos.filter((g) => g.videos.length === 1).flatMap((g) => g.videos),
          variosCortes: suyos.filter((g) => g.videos.length > 1),
        };
      }).filter((linea) => linea.unCorte.length > 0 || linea.variosCortes.length > 0),
    [jugadoresVisibles],
  );

  /* Con varias líneas se rotula cada una; con una sola, el rótulo sobra. */
  const conRotulos = porLinea.length > 1;

  /* El orden de ← y → en el reproductor es el que se ve en pantalla. */
  const mostrados = useMemo(() => {
    if (soloDe === SUELTOS) return grupos.sueltos;

    if (soloDe) {
      return (
        grupos.jugadores.find((grupo) => grupo.jugador === soloDe)?.videos ?? []
      );
    }

    return [
      ...porLinea.flatMap((linea) => [...linea.unCorte, ...linea.variosCortes.flatMap((grupo) => grupo.videos)]),
      ...grupos.sueltos,
    ];
  }, [grupos, porLinea, soloDe]);

  /* Si todos tienen un corte, el «1» de cada chip no dice nada. */
  const cuentaEnChips = jugadoresPorPuesto.some((grupo) => grupo.videos.length > 1);

  /* Los chips llevan el rótulo de línea si hay más de una, como las fichas. */
  const variasLineas = new Set(jugadoresPorPuesto.map((grupo) => rangoDePuesto(grupo.puesto))).size > 1;

  const copiaEnlace = async (video: Video) => {
    try {
      await navigator.clipboard.writeText(enlaceVideo(video.id));

      toast.success("Enlace copiado");
    } catch {
      toast.error("El navegador no ha permitido copiar");
    }
  };

  const copiaTodos = async () => {
    if (mostrados.length === 0) return;

    try {
      await navigator.clipboard.writeText(
        mostrados.map(({ video }) => enlaceVideo(video.id)).join("\n"),
      );

      toast.success(
        `${mostrados.length} ${mostrados.length === 1 ? "enlace copiado" : "enlaces copiados"}`,
      );
    } catch {
      toast.error("El navegador no ha permitido copiar");
    }
  };

  /*
  | Pasar de un corte al siguiente sin cerrar el reproductor.
  |
  | Repasar a un jugador es ver sus seis cortes seguidos, y cerrar el pop-up,
  | buscar la ficha siguiente y volver a abrir rompe el repaso. Con las flechas
  | del teclado, además, se hace sin soltar el cuaderno.
  */
  const indiceAbierto = abierto
    ? mostrados.findIndex(({ video }) => video.id === abierto.id)
    : -1;

  const saltaA = (paso: number) => {
    if (indiceAbierto < 0) return;

    const destino = mostrados[indiceAbierto + paso];

    if (destino) setAbierto(destino.video);
  };

  useEffect(() => {
    if (!abierto) return;

    const tecla = (evento: KeyboardEvent) => {
      if (evento.key === "Escape") setAbierto(null);

      if (evento.key === "ArrowRight" || evento.key === "ArrowLeft") {
        const paso = evento.key === "ArrowRight" ? 1 : -1;

        setAbierto((actual) => {
          if (!actual) return actual;

          const donde = mostrados.findIndex(
            ({ video }) => video.id === actual.id,
          );

          return mostrados[donde + paso]?.video ?? actual;
        });
      }
    };

    window.addEventListener("keydown", tecla);

    return () => window.removeEventListener("keydown", tecla);
  }, [abierto, mostrados]);

  /* --------------------------- PINTADO --------------------------- */

  if (estado.fase === "cargando") {
    return (
      <div className="flex items-center justify-center gap-2 rounded-2xl border border-white/10 bg-white/[0.03] py-10 text-sm text-white/40">
        <Loader2 size={15} className="animate-spin" />
        Preguntando al canal…
      </div>
    );
  }

  if (estado.fase === "sin-conectar") {
    return (
      <div className="rounded-2xl border border-amber-400/25 bg-amber-400/[0.06] px-4 py-4">
        <p className="flex items-center gap-2 text-sm font-medium text-white/85">
          <Youtube size={15} className="text-amber-300" />
          {estado.caido ? "No se ha podido leer el canal de YouTube" : "El canal de YouTube no está conectado"}
        </p>

        <p className="mt-1 text-[12px] leading-relaxed text-white/55">
          {estado.caido ? (
            <>{estado.aviso} Comprueba la conexión y vuelve a probar.</>
          ) : (
            <>
              {estado.aviso} Se conecta una vez desde <strong>Coding</strong>, en el
              panel de YouTube, y desde entonces esta pantalla lee las listas de cada
              rival.
            </>
          )}
        </p>

        <button
          type="button"
          onClick={() => {
            setEstado({ fase: "cargando" });
            setIntento((n) => n + 1);
          }}
          className="mt-3 inline-flex items-center gap-1.5 rounded-xl border border-white/15 px-3 py-1.5 text-xs text-white/70 transition hover:border-white/30 hover:text-white"
        >
          <RefreshCw size={12} />
          Volver a probar
        </button>
      </div>
    );
  }

  return (
    <div className="min-w-0">
      {/* ---------------------- QUÉ LISTA SE MIRA --------------------- */}

      {/* En el móvil el selector va en su fila y a todo el ancho: en la misma
          línea que el rótulo y el canal salía «J10 Cartag…» (29/10/2026). */}
      <div className="flex flex-wrap items-center gap-2 rounded-2xl border border-white/10 bg-white/[0.03] px-3 py-2.5">
        <ListVideo size={15} className="shrink-0 text-[#C8A96B]" />

        <span className="text-[10px] uppercase tracking-[0.16em] text-white/40">
          Lista del canal
        </span>

        <select
          value={lista?.id ?? ""}
          onChange={(evento) => {
            const id = evento.target.value;

            if (!id) return;

            setElegidas((actual) => ({
              ...actual,
              porEquipo: { ...actual.porEquipo, [clave]: id },
            }));
          }}
          className="w-full min-w-0 rounded-lg border border-white/10 bg-white/[0.04] px-2.5 py-1.5 text-sm text-white outline-none transition focus:border-[#C8A96B]/50 sm:w-auto sm:flex-1"
        >
          {/* Sin «Ninguna»: con lista, se cambia por otra; sin ella, se elige. */}
          {!lista && (
            <option value="" className="bg-[#11161C]">
              Elige la lista de este rival…
            </option>
          )}

          {estado.listas.map((item) => (
            <option key={item.id} value={item.id} className="bg-[#11161C]">
              {nombreDeLista(item.nombre, rivalDeJornada)} · {item.cuenta} {item.cuenta === 1 ? "vídeo" : "vídeos"}
            </option>
          ))}
        </select>

        {lista && (
          <a
            href={enlaceLista(lista.id)}
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-center gap-1.5 rounded-lg border border-white/12 px-2.5 py-1.5 text-xs text-white/60 transition hover:border-white/25 hover:text-white"
          >
            <ExternalLink size={12} />
            Abrir en YouTube
          </a>
        )}

        <span className="text-[11px] text-white/30">{estado.canal}</span>
      </div>

      {!lista && (
        /* Sin lista no se deja una caja vacía (30/10/2026): una línea bajo
           el selector y nada más. */
        <p className="mt-2 px-1 text-[12px] leading-relaxed text-white/50">
          Este rival aún no tiene lista en el canal. Si la tiene con otro nombre,
          elígela arriba y queda recordada para todo el cuerpo técnico.
        </p>
      )}

      {sospechosa && lista && (
        <div className="mt-3 flex flex-wrap items-center gap-3 rounded-2xl border border-amber-400/30 bg-amber-400/[0.07] px-4 py-3">
          <AlertTriangle size={15} className="shrink-0 text-amber-300" />

          <p className="min-w-0 flex-1 text-[12px] leading-relaxed text-white/70">
            «{lista.nombre}» no parece la lista de <strong>{equipo}</strong>, y
            está puesta a mano. Si es un despiste, lo que se ve abajo son los
            cortes de otro rival.
          </p>

          <button
            type="button"
            onClick={olvidaLaLista}
            className="shrink-0 rounded-xl border border-white/15 px-3 py-1.5 text-xs text-white/70 transition hover:border-white/30 hover:text-white"
          >
            Quitar el emparejado
          </button>
        </div>
      )}

      {/* -------------------------- BUSCADOR -------------------------- */}

      {lista && (
        <div className="mt-3 flex flex-wrap items-center gap-2">
          {/* A todo el ancho en el móvil: compartiendo fila con los botones se quedaba en «Buscar en l…». */}
          <div className="relative w-full min-w-0 sm:w-auto sm:flex-1">
            <Search
              size={14}
              className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-white/30"
            />

            <input
              value={busca}
              onChange={(evento) => setBusca(evento.target.value)}
              placeholder="Buscar: córner, pérdida, un nombre…"
              className="w-full rounded-xl border border-white/10 bg-white/[0.04] py-2 pl-9 pr-3 text-sm text-white outline-none transition placeholder:text-white/25 focus:border-[#C8A96B]/50"
            />
          </div>

          <span className="shrink-0 text-[11px] tabular-nums text-white/35">
            {cargandoVideos
              ? "cargando…"
              : `${mostrados.length} ${mostrados.length === 1 ? "vídeo" : "vídeos"}`}
          </span>

          {/* Agrupado por jugador, o todos seguidos llenando el ancho. */}
          <div className="flex shrink-0 items-center rounded-xl border border-white/10 bg-white/[0.03] p-0.5">
            {[
              { valor: true, label: "Por jugador" },
              { valor: false, label: "Todos seguidos" },
            ].map((modo) => (
              <button
                key={modo.label}
                type="button"
                onClick={() => cambiaAgrupado(modo.valor)}
                aria-pressed={agrupado === modo.valor}
                className={`rounded-lg px-2.5 py-1.5 text-[11px] transition ${
                  agrupado === modo.valor
                    ? "bg-[#C8A96B]/15 text-[#C8A96B]"
                    : "text-white/50 hover:text-white"
                }`}
              >
                {modo.label}
              </button>
            ))}
          </div>

          {/*
            Cuántas fichas por fila. Antes la rejilla era fija y con las
            secciones por jugador el listado salía a trompicones: tres columnas
            arriba y una al final, con media pantalla en blanco.
          */}
          <div className="flex shrink-0 items-center rounded-xl border border-white/10 bg-white/[0.03] p-0.5">
            {TAMANOS.map((item) => (
              <button
                key={item.key}
                type="button"
                onClick={() => eligeTamano(item.key)}
                aria-pressed={tamano === item.key}
                title={`Fichas de tamaño ${item.label.toLowerCase()}`}
                className={`rounded-lg px-2.5 py-1.5 text-[11px] transition ${
                  tamano === item.key
                    ? "bg-[#C8A96B]/15 text-[#C8A96B]"
                    : "text-white/50 hover:text-white"
                }`}
              >
                {item.label}
              </button>
            ))}
          </div>

          <button
            type="button"
            onClick={() => void copiaTodos()}
            disabled={mostrados.length === 0}
            title="Copiar los enlaces de lo que se está viendo"
            className="inline-flex shrink-0 items-center gap-1.5 rounded-xl border border-white/12 px-3 py-2 text-xs text-white/60 transition hover:border-white/25 hover:text-white disabled:opacity-40"
          >
            <Link2 size={13} />
            <span className="hidden sm:inline">Copiar enlaces</span>
          </button>
        </div>
      )}

      {/* ---------------------- QUIÉN TIENE VÍDEO ---------------------- */}

      {lista && !cargandoVideos && videos.length > 0 && (
        <p className="mt-3 text-[11px] text-white/45">
          En cada ficha:{" "}
          <span className="font-semibold" style={{ color: MEJOR }}>verde = lo que hace bien</span>
          {" · "}
          <span className="font-semibold" style={{ color: PEOR }}>naranja = lo que podemos explotar</span>
          . Los jugadores van por puesto.
        </p>
      )}

      {lista && !cargandoVideos && videos.length > 0 && (
        <div className="scrollbar-none mt-3 flex items-center gap-1.5 overflow-x-auto pb-1 [mask-image:linear-gradient(to_right,#000_88%,transparent)] [&_button]:shrink-0 [&_span]:shrink-0 sm:flex-wrap sm:overflow-visible sm:pb-0 sm:[mask-image:none]">
          <Chip
            activo={!soloDe}
            onClick={() => setSoloDe("")}
            texto="Todos"
            cuenta={
              grupos.jugadores.reduce((suma, g) => suma + g.videos.length, 0) +
              grupos.sueltos.length
            }
          />

          {jugadoresPorPuesto.map((grupo, i) => {
            const rango = rangoDePuesto(grupo.puesto);
            const empiezaLinea = i === 0 || rangoDePuesto(jugadoresPorPuesto[i - 1].puesto) !== rango;

            return (
              <span key={grupo.jugador} className="contents">
                {/* El separador de línea, el mismo rótulo que en las fichas. */}
                {empiezaLinea && variasLineas && (
                  <span className="ml-1.5 text-[9px] font-semibold uppercase tracking-[0.14em] text-white/35">
                    {LINEAS[rango]}
                  </span>
                )}

                <Chip
                  activo={soloDe === grupo.jugador}
                  onClick={() =>
                    setSoloDe(soloDe === grupo.jugador ? "" : grupo.jugador)
                  }
                  texto={grupo.jugador}
                  dorsal={grupo.dorsal}
                  cuenta={cuentaEnChips ? grupo.videos.length : undefined}
                />
              </span>
            );
          })}

          {grupos.sueltos.length > 0 && (
            <Chip
              activo={soloDe === SUELTOS}
              onClick={() => setSoloDe(soloDe === SUELTOS ? "" : SUELTOS)}
              texto="Del equipo"
              cuenta={grupos.sueltos.length}
            />
          )}
        </div>
      )}

      {/* --------------------------- VÍDEOS --------------------------- */}

      {cargandoVideos && (
        <div className="mt-4 flex items-center justify-center gap-2 py-10 text-sm text-white/40">
          <Loader2 size={15} className="animate-spin" />
          Trayendo los vídeos de la lista…
        </div>
      )}

      {!cargandoVideos && lista && falloVideos && (
        <div className="mt-4 rounded-2xl border border-amber-400/25 bg-amber-400/[0.06] px-4 py-6 text-center text-xs text-white/60">
          No se han podido traer los vídeos de la lista.
          <button
            type="button"
            onClick={() => {
              setTraidos({ listaId: "", videos: [] });
              setIntentoVideos((n) => n + 1);
            }}
            className="ml-2 inline-flex items-center gap-1 font-semibold text-[#C8A96B] underline underline-offset-2"
          >
            <RefreshCw size={11} />
            Volver a probar
          </button>
        </div>
      )}

      {!cargandoVideos && lista && !falloVideos && videos.length === 0 && (
        <p className="mt-4 rounded-2xl border border-white/10 bg-white/[0.02] px-4 py-6 text-center text-xs text-white/40">
          Esa lista todavía no tiene vídeos que se puedan ver.
        </p>
      )}

      {!cargandoVideos && lista && videos.length > 0 && mostrados.length === 0 && (
        <p className="mt-4 rounded-2xl border border-white/10 bg-white/[0.02] px-4 py-6 text-center text-xs text-white/40">
          Nada coincide con lo que buscas.
        </p>
      )}

      {/*
      | DOS ÁREAS, NO UNA LISTA LARGA
      |
      | Lo individual y lo colectivo son dos trabajos distintos: repasar a un
      | jugador es ver sus cortes seguidos, y mirar el equipo es partidos
      | enteros, balón parado y análisis de bloque. Mezclados en una tira de
      | secciones, lo segundo quedaba de apéndice al final de lo primero. Cada
      | área tiene ahora su cabecera y su marco.
      */}
      {/* TODOS SEGUIDOS · una sola rejilla, sin huecos entre grupos. */}
      {!cargandoVideos && !agrupado && mostrados.length > 0 && (
        <section className="mt-5 min-w-0">
          <header className="mb-3 flex flex-wrap items-baseline gap-2 border-b border-white/10 pb-2">
            <h2 className="text-[11px] font-semibold uppercase tracking-[0.18em] text-[#C8A96B]">
              Todos los vídeos
            </h2>

            <span className="text-[11px] text-white/35">
              {mostrados.length} por puesto, del portero a la delantera
            </span>
          </header>

          <Rejilla
            piezas={mostrados}
            columnas={columnas}
            conJugador
            equipo={equipo}
            onAbrir={setAbierto}
            onCopiar={copiaEnlace}
          />
        </section>
      )}

      {!cargandoVideos && agrupado && jugadoresVisibles.length > 0 && (
        <section className="mt-5 min-w-0">
          <header className="mb-3 flex flex-wrap items-baseline gap-2 border-b border-white/10 pb-2">
            <h2 className="text-[11px] font-semibold uppercase tracking-[0.18em] text-[#C8A96B]">
              Por jugador
            </h2>

            <span className="text-[11px] text-white/35">
              {!soloDe && plantilla.length >= grupos.jugadores.length && grupos.jugadores.length > 0
                ? `${grupos.jugadores.length} de ${plantilla.length} con vídeo`
                : `${jugadoresVisibles.length} ${jugadoresVisibles.length === 1 ? "jugador" : "jugadores"} con vídeo`}
            </span>
          </header>

          <div className="space-y-6">
            {porLinea.map(({ rango, rotulo, unCorte, variosCortes }) => (
            <div key={rango} className="min-w-0 space-y-4">
            {conRotulos && (
              <p className="flex items-center gap-2 text-[10px] font-semibold uppercase tracking-[0.18em] text-white/45">
                {rotulo}
                <span className="h-px flex-1 bg-white/10" />
              </p>
            )}

            {unCorte.length > 0 && (
              <div className="min-w-0">
                {variosCortes.length > 0 && (
                  <p className="mb-2 text-[11px] text-white/35">Un corte por jugador</p>
                )}

                <Rejilla piezas={unCorte} columnas={columnas} conJugador equipo={equipo} onAbrir={setAbierto} onCopiar={copiaEnlace} />
              </div>
            )}

            {variosCortes.map((grupo) => (
              <div key={grupo.jugador} className="min-w-0">
                <div className="mb-2 flex flex-wrap items-center gap-2">
                  {grupo.dorsal && (
                    <span className="rounded-md bg-[#C8A96B]/15 px-1.5 py-0.5 text-[11px] font-semibold tabular-nums text-[#C8A96B]">
                      {grupo.dorsal}
                    </span>
                  )}

                  <h3 className="truncate text-sm font-semibold text-white">
                    {grupo.jugador}
                  </h3>

                  <span className="text-[11px] text-white/35">
                    {grupo.videos.length}{" "}
                    {grupo.videos.length === 1 ? "vídeo" : "vídeos"}
                  </span>

                  {grupo.resumen && <span className="text-[11px] text-white/45">· {grupo.resumen}</span>}
                </div>

                <Rejilla
                  piezas={grupo.videos}
                  columnas={columnas}
                  equipo={equipo}
                  onAbrir={setAbierto}
                  onCopiar={copiaEnlace}
                />
              </div>
            ))}
            </div>
            ))}
          </div>
        </section>
      )}

      {!cargandoVideos &&
        agrupado &&
        grupos.sueltos.length > 0 &&
        (!soloDe || soloDe === SUELTOS) && (
          <section className="mt-6 min-w-0 rounded-2xl border border-white/10 bg-white/[0.02] p-4">
            <header className="mb-3 flex flex-wrap items-baseline gap-2">
              <h2 className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-[0.18em] text-white/60">
                <Users size={13} />
                Del equipo
              </h2>

              <span className="text-[11px] text-white/35">
                {grupos.sueltos.length}{" "}
                {grupos.sueltos.length === 1 ? "vídeo" : "vídeos"}
              </span>

              <span className="w-full text-[11px] leading-relaxed text-white/30 sm:w-auto">
                Partidos enteros, balón parado, análisis de bloque.
                <Explicativo>
                  {" "}Lo que no habla de un jugador concreto. Si alguno sí es de uno, basta con
                  poner su nombre en el título del vídeo en YouTube.
                </Explicativo>
              </span>
            </header>

            <Rejilla
              piezas={grupos.sueltos}
              columnas={columnas}
              onAbrir={setAbierto}
              onCopiar={copiaEnlace}
            />
          </section>
        )}

      {/* ------------------------ EL REPRODUCTOR ----------------------- */}

      {abierto && (
        <div
          className="modal-veil fixed inset-0 z-[70] flex items-center justify-center p-4"
          onClick={() => setAbierto(null)}
        >
          <div
            className="w-full max-w-4xl overflow-hidden rounded-2xl border border-white/12 bg-[#11161C]"
            onClick={(evento) => evento.stopPropagation()}
          >
            <header className="flex items-center gap-2 border-b border-white/10 px-4 py-3">
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium text-white">
                  {abierto.titulo}
                </p>

                {indiceAbierto >= 0 && mostrados.length > 1 && (
                  <p className="mt-0.5 text-[11px] tabular-nums text-white/35">
                    {indiceAbierto + 1} de {mostrados.length} · con ← y → se
                    pasa de uno a otro
                  </p>
                )}
              </div>

              {mostrados.length > 1 && (
                <>
                  <button
                    type="button"
                    onClick={() => saltaA(-1)}
                    disabled={indiceAbierto <= 0}
                    title="Corte anterior (←)"
                    className="rounded-lg border border-white/12 p-1.5 text-white/60 transition hover:border-white/25 hover:text-white disabled:opacity-30"
                  >
                    <ChevronLeft size={14} />
                  </button>

                  <button
                    type="button"
                    onClick={() => saltaA(1)}
                    disabled={
                      indiceAbierto < 0 || indiceAbierto >= mostrados.length - 1
                    }
                    title="Corte siguiente (→)"
                    className="rounded-lg border border-white/12 p-1.5 text-white/60 transition hover:border-white/25 hover:text-white disabled:opacity-30"
                  >
                    <ChevronRight size={14} />
                  </button>
                </>
              )}

              <button
                type="button"
                onClick={() => void copiaEnlace(abierto)}
                title="Copiar el enlace del vídeo"
                className="rounded-lg border border-white/12 p-1.5 text-white/60 transition hover:border-white/25 hover:text-white"
              >
                <Link2 size={14} />
              </button>

              <a
                href={enlaceVideo(abierto.id)}
                target="_blank"
                rel="noreferrer"
                title="Abrir en YouTube"
                className="rounded-lg border border-white/12 p-1.5 text-white/60 transition hover:border-white/25 hover:text-white"
              >
                <ExternalLink size={14} />
              </a>

              <button
                type="button"
                onClick={() => setAbierto(null)}
                title="Cerrar"
                className="rounded-lg border border-white/12 p-1.5 text-white/60 transition hover:border-white/25 hover:text-white"
              >
                <X size={14} />
              </button>
            </header>

            <div className="aspect-video w-full bg-black">
              <iframe
                key={abierto.id}
                src={enlaceIncrustado(abierto.id)}
                title={abierto.titulo}
                allow="accelerometer; autoplay; clipboard-write; encrypted-media; picture-in-picture; fullscreen"
                allowFullScreen
                className="h-full w-full border-0"
              />
            </div>

            {abierto.descripcion.trim() && (
              <p className="max-h-28 overflow-y-auto whitespace-pre-wrap border-t border-white/10 px-4 py-3 text-[12px] leading-relaxed text-white/50">
                {abierto.descripcion}
              </p>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  EL ÍNDICE DE JUGADORES                                             */
/* ------------------------------------------------------------------ */

/** Un jugador de la tira de arriba: es a la vez índice y filtro. */
function Chip({
  activo,
  onClick,
  texto,
  dorsal,
  cuenta,
}: {
  activo: boolean;
  onClick: () => void;
  texto: string;
  dorsal?: string;
  /** Sin cuenta no se pinta el número: cuando todos valen 1 no dice nada. */
  cuenta?: number;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={activo}
      className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs transition ${
        activo
          ? "border-[#C8A96B]/60 bg-[#C8A96B]/15 text-[#C8A96B]"
          : "border-white/10 bg-white/[0.03] text-white/60 hover:border-white/25 hover:text-white"
      }`}
    >
      {dorsal && (
        <span className="tabular-nums opacity-70">{dorsal}</span>
      )}

      <span className="max-w-[14rem] truncate">{texto}</span>

      {cuenta !== undefined && <span className="tabular-nums opacity-50">{cuenta}</span>}
    </button>
  );
}

/* ------------------------------------------------------------------ */
/*  LA REJILLA DE FICHAS                                               */
/* ------------------------------------------------------------------ */

/**
 * La miniatura del corte. Si la propia no carga (en blanco: Paris Adot, Raúl
 * Rubio), se prueba la de YouTube por el id del vídeo, y si tampoco, un
 * fondo liso con el icono.
 */
function Miniatura({ video }: { video: Video }) {
  const respaldo = `https://i.ytimg.com/vi/${video.id}/hqdefault.jpg`;

  const [fuente, setFuente] = useState(video.miniatura || respaldo);
  const [rota, setRota] = useState(false);

  if (rota) {
    return (
      <span className="flex aspect-video w-full items-center justify-center bg-white/[0.04]">
        <Youtube size={26} className="text-white/25" />
      </span>
    );
  }

  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={fuente}
      alt=""
      loading="lazy"
      onError={() => (fuente === respaldo ? setRota(true) : setFuente(respaldo))}
      className="aspect-video w-full object-cover"
    />
  );
}

function Rejilla({
  piezas,
  columnas,
  conJugador,
  equipo,
  onAbrir,
  onCopiar,
}: {
  piezas: Pieza[];
  /** El rival: un título que sólo dice su nombre no se repite en la ficha. */
  equipo?: string;
  /** Las clases de columnas, ya resueltas: ver `TAMANOS`. */
  columnas: string;
  /** Pone el nombre del jugador en la ficha: en la vista seguida no hay
      cabecera encima que lo diga. */
  conJugador?: boolean;
  onAbrir: (video: Video) => void;
  onCopiar: (video: Video) => void;
}) {
  /* El título en bruto y el día de subida no van en la ficha —no dicen qué
     mirar—, pero se leen al pasar el cursor (29/10/2026). */
  return (
    <div className={`grid min-w-0 gap-2.5 ${columnas}`}>
      {piezas.map(({ video, tema, jugador, dorsal, puesto, etiquetas, resumen }) => (
        <div
          key={video.id}
          title={[video.titulo, fecha(video.publicado) && `subido el ${fecha(video.publicado)}`].filter(Boolean).join(" · ")}
          className="group min-w-0 overflow-hidden rounded-xl border border-white/10 bg-white/[0.03] transition hover:border-[#C8A96B]/40"
        >
          <button
            type="button"
            onClick={() => onAbrir(video)}
            className="relative block w-full"
          >
            <Miniatura video={video} />

            <span className="absolute inset-0 flex items-center justify-center bg-black/40 opacity-0 transition group-hover:opacity-100">
              <Play size={26} className="text-white drop-shadow" />
            </span>
          </button>

          <div className="p-2.5">
            {conJugador && (
              <p className="mb-1 flex items-center gap-1.5 truncate text-[10px] font-semibold uppercase tracking-wide">
                {dorsal && (
                  <span className="tabular-nums text-[#C8A96B]">{dorsal}</span>
                )}

                <span className={jugador ? "text-[#C8A96B]" : "text-white/35"}>
                  {jugador || "Del equipo"}
                </span>
              </p>
            )}

            {conJugador && resumen && <p className="mb-1 text-[11px] tabular-nums text-white/60 sm:text-[10px]">{resumen}</p>}

            {/* Qué mirar: su puesto y sus etiquetas de la ficha. */}
            {conJugador && (puesto || etiquetas.length > 0) && (
              <p className="mb-1 line-clamp-3 text-[11px] leading-snug text-white/55 sm:text-[10px]">
                {puesto}
                {etiquetas.map((e, i) => (
                  <span key={e} className="font-semibold" style={{ color: esEtiquetaDebil(e) ? PEOR : MEJOR }}>
                    {puesto || i > 0 ? " · " : ""}
                    {e}
                  </span>
                ))}
              </p>
            )}

            {/* El título original del vídeo, en pequeño: lo que manda es quién es. */}
            {/* «Corte 14», el nombre del equipo o un título que sólo repite al jugador
                («8 BLASSIS», «FC CARTAGENA Nº 20 RUBÉN») no dicen qué enseña el clip. */}
            {(() => {
              const repite = Boolean(jugador) && tituloSoloRepite(video.titulo, jugador, equipo);
              const texto = repite ? `Corte ${video.posicion + 1}` : temaLegible(tema, video.posicion, video.descripcion);
              const vacio = conJugador && jugador && (/^Corte \d+$/.test(texto) || (equipo && desnuda(texto) === desnuda(equipo)));

              return vacio ? null : (
                <p className={`line-clamp-2 leading-snug ${conJugador ? "text-[11px] text-white/55" : "text-[13px] text-white/85"}`}>
                  {texto}
                </p>
              );
            })()}

            <div className="mt-1.5 flex items-center justify-end gap-2">
              <button
                type="button"
                onClick={() => onCopiar(video)}
                title="Copiar el enlace"
                className="rounded-md p-1 text-white/30 transition hover:text-white/70"
              >
                <Link2 size={12} />
              </button>
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}
