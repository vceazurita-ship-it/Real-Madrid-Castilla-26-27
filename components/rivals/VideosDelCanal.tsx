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

import { createContext, useContext, useEffect, useMemo, useState } from "react";
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
import { useAdmin } from "@/hooks/useAdmin";
import { traeJson } from "@/lib/hojaCsv";
import { useDuelosClave } from "@/hooks/useDuelosClave";
import { useCalendario } from "@/hooks/useCalendario";
import { comoNuestro } from "@/lib/castilla/calendario";
import { nombreEquipo } from "@/lib/equipos";
import { mismoClub } from "@/lib/rivals/mismoClub";
import { mismoNombreRival } from "@/lib/rivals/rival-en-curso";
import Link from "next/link";
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
  etiquetaEnCaseta,
  jornadaDeLista,
  jugadorDelTitulo,
  tituloSoloRepite,
  resumenDeTemporada,
  temaDelTitulo,
  type JugadorPlantilla,
  type RasgoCorto,
  type ListaCanal,
  type ListasRivales,
} from "@/lib/rivals/youtube-listas";
import { Explicativo } from "@/components/ui/textos-analisis";
import { VideosDelRival } from "@/components/portada/VideosDelRival";
import { ClipsHudlJugador, useCuentaHudl } from "@/components/rivals/ClipsDeHudl";
import { MEJOR, PEOR } from "@/components/data/graficas";

type Video = {
  id: string;
  titulo: string;
  descripcion: string;
  miniatura: string;
  publicado: string;
  posicion: number;
  /** Segundos, si YouTube los ha dado (16/11/2026). */
  duracion?: number;
};

/** 65 → «1:05». */
const duracionLegible = (segundos?: number) =>
  segundos && segundos > 0 ? `${Math.floor(segundos / 60)}:${String(Math.round(segundos % 60)).padStart(2, "0")}` : "";

/*
| EL MINUTO DEL CORTE (16/11/2026, jueces): si el título o la descripción lo
| dicen («63'», «min 63», «63′»), sale en el pie: «J13 · 63′ · 0:42». El canal
| no lo guarda aparte, así que si no está escrito no se pone.
*/
function minutoDe(video: Pick<Video, "titulo" | "descripcion">) {
  const texto = `${video.titulo}\n${video.descripcion}`;
  const m = /\b(?:min(?:uto)?\.?\s*)(\d{1,3})\b/i.exec(texto) ?? /\b(\d{1,3})\s*(?:'|′|’)(?!\w)/.exec(texto);
  const minuto = m ? Number(m[1]) : NaN;

  return Number.isFinite(minuto) && minuto >= 1 && minuto <= 130 ? `${minuto}′` : "";
}

/** «J13 · Real Murcia» → «J13»: en el pie, el rival ya está en el título de la pantalla. */
const soloJornada = (etiqueta: string) => /^J\d+/.exec(etiqueta)?.[0] ?? etiqueta;

/**
 * El título en bruto del canal a veces es sólo el dorsal o «CLUB Nº7» una vez quitado el nombre:
 * eso no dice qué mirar, así que se numera el corte.
 */
function temaLegible(tema: string, _posicion: number, descripcion = "") {
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

  /* Sin nada que diga, nada (16/11/2026): «Corte 4» no enseñaba qué mirar; el pie ya da jornada y duración. */
  return linea ? (linea.length > 90 ? `${linea.slice(0, 87)}...` : linea) : "";
}

/** Orden de los puestos para los chips: portero, defensa, medio, delantero; lo desconocido, al final. */
export function rangoDePuesto(puesto: string) {
  const p = puesto.toLowerCase().trim();

  if (/portero|^(por|pt|gk)$/.test(p)) return 0;
  if (/lateral|central|defensa|carrilero|^(df|dfc|dfd|dfi|ld|li|lb|rb|cb)$/.test(p)) return 1;
  /* «Media punta» en dos palabras caía en delanteros por «punta» (07/11/2026). */
  if (/medio|media\s*punta|pivote|interior|mediapunta|centrocampista|volante|^(mc|mcd|mco|mp|cmf|dmf|amf)$/.test(p)) return 2;
  if (/extremo|delantero|punta|banda|^(dc|ed|ei|ex|cf|lw|rw)$/.test(p)) return 3;

  return 4;
}

/** El rótulo de cada línea, por el rango de `rangoDePuesto`. */
export const LINEAS = ["Porteros", "Defensas", "Centrocampistas", "Delanteros", "Otros"] as const;

/** Etiquetas de la ficha que hablan de balón parado: rematador, lanzador, córner, falta directa… */
const ES_ABP = /abp|bal[oó]n parado|rematador|lanzador|c[oó]rner|falta directa|penalti/i;

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
  /** Su clave en Plantillas rivales, para enlazar su ficha (16/11/2026). */
  clave?: string;
  /** Las etiquetas ya en lenguaje de caseta, con su cifra si la hay (16/11/2026). */
  enCaseta: { texto: string; debil: boolean }[];
  /** Su ▲ y su ▼ de Wyscout contra su puesto, con la base aparte (17/11/2026, ronda 21). */
  rasgos: RasgoCorto[];
  poblacion: string;
  /** Cuántos cortes suyos hay en la lista: en lo que se apoyan sus etiquetas. */
  clips: number;
  /** Del once probable: su ▲/▼ de Wyscout ya está en la radiografía de arriba y no se repite en la tarjeta. */
  titular: boolean;
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

/** Lo más que se espera al canal o a una lista antes de ofrecer «Reintentar» (30/10/2026; 12 s desde el 20/11/2026). */
const ESPERA_MAXIMA_MS = 12_000;

/* Lo que contesta /api/youtube/videos (siempre 200: sin cuenta, `conectado: false`). */
type RespuestaCanal = { conectado?: boolean; aviso?: string; canal?: string; listas?: ListaCanal[]; videos?: Video[] };

/*
| La espera, con tope (20/11/2026, jueces): «Preguntando al canal…» no
| terminaba. La lectura va por `traeJson` —con su copia en el aparato, que se
| enseña al momento mientras se renueva por detrás— y compite con un reloj de
| 12 s que se corta con un AbortController: al vencer, aviso y «Reintentar».
| `traeJson` no se corta (la descarga es de todos los que la esperan).
*/
function conTope<T>(promesa: Promise<T>, control: AbortController, ms = ESPERA_MAXIMA_MS): Promise<T> {
  return new Promise<T>((resuelve, rechaza) => {
    const reloj = window.setTimeout(() => control.abort(), ms);
    const alCortar = () => rechaza(new DOMException("Sin respuesta a tiempo", "TimeoutError"));

    if (control.signal.aborted) {
      window.clearTimeout(reloj);
      alCortar();

      return;
    }

    control.signal.addEventListener("abort", alCortar, { once: true });

    promesa.then(
      (valor) => {
        window.clearTimeout(reloj);
        control.signal.removeEventListener("abort", alCortar);
        resuelve(valor);
      },
      (error: unknown) => {
        window.clearTimeout(reloj);
        control.signal.removeEventListener("abort", alCortar);
        rechaza(error);
      },
    );
  });
}

const esCorte = (error: unknown) => error instanceof DOMException && error.name === "TimeoutError";

const URL_CANAL = "/api/youtube/videos";
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
function nombreDeLista(nombre: string, rivalDeJornada?: Map<number, string>, equiposTira: string[] = []) {
  const m = /^\s*J\s*0*(\d+)\s*[-·:]?\s*(.*)$/i.exec(nombre);
  const resto = (m ? m[2] : nombre).replace(/[\s·-]+INDIVIDUAL\s*$/i, "").trim();
  const delCalendario = m ? rivalDeJornada?.get(Number(m[1])) : undefined;
  /* Sólo si es el mismo equipo (comparten alguna palabra): una lista de otro
     equipo con número de jornada no se renombra con nuestro rival de ese día. */
  /* «Nastic» es el Gimnàstic (16/11/2026): el apodo no comparte palabras con el nombre. */
  const palabras = (t: string) =>
    t.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().split(/[^a-z0-9]+/).filter((w) => w.length > 3).map((w) => (w === "nastic" ? "gimnastic" : w));
  const delMismo = delCalendario && (palabras(delCalendario).some((w) => palabras(resto).includes(w)) || mismoClub(delCalendario, resto)) ? delCalendario : undefined;
  /*
  | El nombre corto, el de la tira de escudos (16/11/2026, fútbol): el
  | desplegable mezclaba «J12 · Nastic» con «J10 · FC Cartagena».
  */
  const oficial = delMismo ? (equiposTira.find((e) => mismoClub(e, delMismo)) ?? delMismo) : undefined;
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
  visionados = {},
  equipos = [],
  jugadorInicial = "",
  vista = "clips",
  jornada,
  onReparto,
  onIrALista,
}: {
  equipo: string;
  /** «clips» (la pantalla) o «lista» (la pestaña secundaria con la lista del canal, 17/11/2026, ronda 21). */
  vista?: "clips" | "lista";
  /** La jornada elegida arriba: se abre la lista «J<n> · …» de ese partido, si está en el canal. */
  jornada?: number;
  /** Cortes de cada jugador (por su nombre de pantalla) en la lista abierta; `null` mientras no se sabe. */
  onReparto?: (cuenta: Record<string, number> | null) => void;
  /** Lleva a la pestaña «Lista del canal». */
  onIrALista?: () => void;
  plantilla: JugadorPlantilla[];
  /** `?jugador=` (desde Duelos, 16/11/2026): se abre con sus cortes filtrados. */
  jugadorInicial?: string;
  /** Los nombres de la tira de escudos: el nombre corto de cada lista sale de aquí. */
  equipos?: string[];
  /** Cuántas veces se ha abierto cada vídeo en la app, por su id (10/11/2026). */
  visionados?: Record<string, number>;
}) {
  const [estado, setEstado] = useState<Estado>({ fase: "cargando" });
  const [busca, setBusca] = useState("");
  const [abierto, setAbierto] = useState<Video | null>(null);
  /* Las vistas y el aviso de líneas sin cortes, sólo para el analista (16/11/2026, jueces). */
  const { admin } = useAdmin();

  /* Quién le marca: nuestro jugador del duelo de cada uno, la misma cuenta que /duelos y el Plan (20/11/2026, jueces de fútbol). */
  const duelosClave = useDuelosClave(equipo);
  const marcas = useMemo<Marca[]>(() => {
    if (!duelosClave) return [];
    const g = duelosClave.grupos;
    return [...g.buscar, ...g.doble, ...g.vigilar, ...g.parejos, ...g.tendencia].flatMap((d) => d.suyos.map((suyo) => ({ suyo, nuestros: d.nuestros })));
  }, [duelosClave]);

  /* El rival oficial de cada jornada de nuestro calendario, para nombrar las listas (29/10/2026). */
  const { partidos } = useCalendario();
  const rivalDeJornada = useMemo(
    () => new Map(partidos.map((p) => comoNuestro(p)).filter((p) => p.jornada && p.rival).map((p) => [p.jornada, nombreEquipo(p.rival)] as const)),
    [partidos],
  );

  /* Las jornadas en que jugamos contra este rival: la lista «J12 · …» es la suya aunque se llame por su apodo (10/11/2026). */
  const jornadasDelEquipo = useMemo(
    () => partidos.map((p) => comoNuestro(p)).filter((p) => p.jornada && p.rival && mismoClub(nombreEquipo(p.rival), equipo)).map((p) => p.jornada),
    [partidos, equipo],
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
    let vivo = true;

    /* Lo que llega (la copia del aparato o lo nuevo) se pinta igual. */
    const aplica = (datos: RespuestaCanal | null) => {
      if (!vivo) return;

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
    };

    /* El estado se toca **después** del `await`: cambiarlo en el cuerpo del
       efecto es un render en cascada y el linter de React lo prohíbe. */
    void (async () => {
      try {
        /* «Reintentar» salta la copia y vuelve a preguntar de verdad. */
        const datos = await conTope(
          traeJson<RespuestaCanal>(URL_CANAL, { forzar: intento > 0, alRenovar: aplica }),
          control,
        );

        aplica(datos);
      } catch (error) {
        if (!vivo) return;

        if (esCorte(error)) {
          setEstado({
            fase: "sin-conectar",
            aviso: `El canal de YouTube no ha contestado en ${ESPERA_MAXIMA_MS / 1000} s.`,
            caido: true,
          });

          return;
        }

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
      vivo = false;
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

    /* La jornada elegida arriba manda (17/11/2026, ronda 21): la lista «J32 · …» si existe y es de este rival. */
    const deLaJornada = jornada ? listas.find((item) => jornadaDeLista(item.nombre) === jornada && buscaLista([item], equipo, [jornada])) : null;

    return deLaJornada ?? puesta ?? buscaLista(listas, equipo, jornadasDelEquipo);
  }, [clave, elegidas.porEquipo, equipo, estado, jornadasDelEquipo, jornada]);

  /* ¿Hay lista de la jornada elegida arriba? Si no, se dice y se ofrece otra cosa (20/11/2026). */
  const sinListaDeLaJornada = Boolean(
    jornada &&
      estado.fase === "listo" &&
      !estado.listas.some((item) => jornadaDeLista(item.nombre) === jornada && buscaLista([item], equipo, [jornada])),
  );

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

  const sospechosa = puestaAMano && lista ? parecido(lista.nombre, equipo) < 0.6 && !buscaLista([lista], equipo, jornadasDelEquipo) : false;

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
    let vivo = true;

    const aplica = (datos: RespuestaCanal | null) => {
      if (!vivo) return;

      /* Un fallo no es una lista vacía: antes se decía «no tiene vídeos»
         cuando lo que había fallado era la conexión (19/10/2026). */
      if (!Array.isArray(datos?.videos)) {
        setTraidos({ listaId, videos: [], fallo: true });
        return;
      }

      setTraidos({ listaId, videos: datos.videos as Video[] });
    };

    /* El mismo tope que el canal (12 s), y la copia del aparato mientras. */
    void (async () => {
      try {
        const datos = await conTope(
          traeJson<RespuestaCanal>(`${URL_CANAL}?lista=${encodeURIComponent(listaId)}`, { forzar: intentoVideos > 0, alRenovar: aplica }),
          control,
        );

        aplica(datos);
      } catch (error) {
        if (!vivo) return;

        if (!esCorte(error)) console.error("[VideosDelCanal] vídeos", error);

        setTraidos({ listaId, videos: [], fallo: true });
      }
    })();

    return () => {
      vivo = false;
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

  /* El partido de la lista para el pie de cada ficha: «J12 · Gimnàstic de Tarragona». */
  const etiquetaLista = lista ? nombreDeLista(lista.nombre, rivalDeJornada, equipos) : "";

  /* ------------------- REPARTIDOS POR JUGADOR -------------------- */

  const termino = busca.trim().toLowerCase();

  /* Cortes de cada jugador en la lista, sin el buscador: la base de sus etiquetas y de la radiografía de arriba. */
  const cortesDe = useMemo(() => {
    const cuenta: Record<string, number> = {};

    for (const video of videos) {
      const jugador = jugadorDelTitulo(video.titulo, plantilla);

      if (jugador) cuenta[jugador.nombre] = (cuenta[jugador.nombre] ?? 0) + 1;
    }

    return cuenta;
  }, [videos, plantilla]);

  const listoElReparto = estado.fase === "listo" && (!lista || (!cargandoVideos && !falloVideos));

  useEffect(() => {
    onReparto?.(listoElReparto ? cortesDe : null);
  }, [onReparto, listoElReparto, cortesDe]);

  const grupos = useMemo(() => {
    const porJugador = new Map<string, { jugador: string; dorsal: string; puesto: string; titular: boolean; minutos: number; resumen: string; explotables: number; videos: Pieza[] }>();

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
        puesto: jugador?.rol || jugador?.puesto || "",
        etiquetas: jugador?.etiquetas ?? [],
        resumen: resumenDeTemporada(jugador),
        clave: jugador?.clave,
        enCaseta: (jugador?.etiquetas ?? []).map((e) => ({ texto: etiquetaEnCaseta(e, jugador, plantilla), debil: esEtiquetaDebil(e) })).filter((e) => e.texto),
        rasgos: jugador?.rasgos ?? [],
        poblacion: jugador?.poblacion ?? "",
        clips: jugador ? cortesDe[jugador.nombre] ?? 0 : 0,
        titular: Boolean(jugador?.titular),
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
        explotables: (jugador.etiquetas ?? []).filter(esEtiquetaDebil).length,
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
  }, [plantilla, termino, videos, cortesDe]);

  /*
  | Ver sólo a uno.
  |
  | Con quince jugadores y ochenta cortes, la lista entera obliga a desplazarse
  | buscando un nombre. Los chips de arriba son el índice **y** el filtro: dicen
  | de un vistazo quién tiene material y cuánto, y al pulsar dejan sólo lo suyo.
  */
  /* `null` = nadie ha tocado los chips: manda el jugador del enlace, si tiene cortes. */
  const [soloElegido, setSoloDe] = useState<string | null>(null);
  const delEnlace = useMemo(() => {
    if (!jugadorInicial.trim()) return "";

    return grupos.jugadores.find((g) => mismoNombreRival(g.jugador, jugadorInicial))?.jugador ?? "";
  }, [grupos.jugadores, jugadorInicial]);
  const soloDe = soloElegido ?? delEnlace;

  const SUELTOS = "__equipo";

  /* Los chips van por puesto (portero, defensas, medios, delanteros) y dentro de cada puesto por minutos. */
  const jugadoresPorPuesto = useMemo(
    () =>
      [...grupos.jugadores].sort(
        /* Dentro de cada puesto, primero los del once probable (08/11/2026, jueces): el miércoles se ve primero a quien va a jugar. */
        /* Y luego quien tiene más naranja, lo que podemos explotar (16/11/2026, fútbol): es lo que se enseña. */
        (a, b) => rangoDePuesto(a.puesto) - rangoDePuesto(b.puesto) || Number(b.titular) - Number(a.titular) || b.explotables - a.explotables || b.minutos - a.minutos,
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
  /* Primero el once probable (10/11/2026, jueces): al abrir se ven los cortes de quien va a jugar, sin elegir nada. */
  const porLinea = useMemo(() => {
    const titulares = jugadoresVisibles.filter((g) => g.titular);
    const hayOnce = titulares.length > 0 && titulares.length < jugadoresVisibles.length;
    const resto = hayOnce ? jugadoresVisibles.filter((g) => !g.titular) : jugadoresVisibles;
    const linea = (rango: number, rotulo: string, suyos: typeof jugadoresVisibles) => ({
      rango,
      rotulo,
      unCorte: suyos.filter((g) => g.videos.length === 1).flatMap((g) => g.videos),
      variosCortes: suyos.filter((g) => g.videos.length > 1),
    });

    return [
      /* «Once probable · 5 con vídeo de 11» (16/11/2026, marketing), por línea: portero, defensa, medios, delanteros. */
      ...(hayOnce ? [linea(-1, `Once probable · ${titulares.length} con vídeo de ${Math.max(titulares.length, plantilla.filter((j) => j.titular).length)}`, titulares)] : []),
      /* «Fuera del once probable · defensas» (16/11/2026, fútbol): «Defensas» a secas se confundía con la línea del once. */
      ...LINEAS.map((rotulo, rango) => linea(rango, hayOnce ? `Fuera del once probable · ${rotulo.toLowerCase()}` : rotulo, resto.filter((g) => rangoDePuesto(g.puesto) === rango))),
    ].filter((l) => l.unCorte.length > 0 || l.variosCortes.length > 0);
  }, [jugadoresVisibles, plantilla]);

  /*
  | LÍNEAS SIN CORTES, PARA EL ANALISTA (16/11/2026, fútbol): con cinco vídeos,
  | todos de defensas, se le avisa de qué líneas faltan. Sólo con su sesión: el
  | cuerpo técnico ve lo que hay.
  */
  const lineasSinCortes = useMemo(() => {
    const conVideo = new Set(grupos.jugadores.map((g) => rangoDePuesto(g.puesto)));
    const enPlantilla = new Set(plantilla.map((j) => rangoDePuesto(j.puesto ?? "")));

    return ([0, 1, 2, 3] as const).filter((r) => enPlantilla.has(r) && !conVideo.has(r)).map((r) => LINEAS[r].toLowerCase());
  }, [grupos.jugadores, plantilla]);

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

  /* Cada clip que se abre se apunta en /visionados (06/11/2026): quién —si
     este aparato lo ha dicho—, qué clip, de qué jugador y de qué puesto. */
  useEffect(() => {
    if (!abierto) return;
    const jugador = jugadorDelTitulo(abierto.titulo, plantilla);
    let quien = "";
    try {
      quien = localStorage.getItem("rmcf:quien") ?? "";
    } catch {
      /* sin almacenamiento */
    }
    void fetch("/api/visionados", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ video: abierto.id, titulo: abierto.titulo, equipo, jugador: jugador?.hoja ?? jugador?.nombre ?? "", puesto: jugador?.puesto ?? "", quien }),
    }).catch(() => {});
  }, [abierto, equipo, plantilla]);

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
        {/* Con tope (20/11/2026): a los 12 s pasa al aviso con «Reintentar». */}
        Preguntando al canal… (como mucho {ESPERA_MAXIMA_MS / 1000} s)
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
          Reintentar
        </button>

        {/* Mientras, lo que sí hay de este rival: sus goles en vídeo (20/11/2026). */}
        {vista === "clips" && (
          <div className="mt-3 flex min-w-0 flex-wrap items-center gap-2 border-t border-white/10 pt-3">
            <VideosDelRival rival={equipo} etiqueta={`${equipo} · vídeo`} />
          </div>
        )}
      </div>
    );
  }

  /* El aviso de una lista puesta a mano que no parece de este rival: en las dos pestañas. */
  const avisoSospechosa =
    sospechosa && lista ? (
      <div className="mt-3 flex flex-wrap items-center gap-3 rounded-2xl border border-amber-400/30 bg-amber-400/[0.07] px-4 py-3">
        <AlertTriangle size={15} className="shrink-0 text-amber-300" />

        <p className="min-w-0 flex-1 text-[12px] leading-relaxed text-white/70">
          «{lista.nombre}» no parece la lista de <strong>{equipo}</strong>, y
          está puesta a mano. Si es un despiste, lo que se ve son los cortes de
          otro rival.
        </p>

        <button
          type="button"
          onClick={olvidaLaLista}
          className="shrink-0 rounded-xl border border-white/15 px-3 py-1.5 text-xs text-white/70 transition hover:border-white/30 hover:text-white"
        >
          Quitar el emparejado
        </button>
      </div>
    ) : null;

  /*
  | LA PESTAÑA «LISTA DEL CANAL» (17/11/2026, ronda 21): qué lista del canal
  | se ve para este rival y, si hace falta, cambiarla por otra. Lo elegido vale
  | para todo el cuerpo técnico. «J» = nuestra jornada contra ese rival.
  */
  if (vista === "lista") {
    return (
      <div className="min-w-0 space-y-3">
        <section className="min-w-0 rounded-2xl border border-white/10 bg-white/[0.03] p-4">
          <p className="flex items-center gap-2 text-xs uppercase tracking-[0.16em] text-white/50">
            <ListVideo size={15} className="shrink-0 text-[#C8A96B]" />
            Lista del canal
          </p>
          <p className="mt-1 text-sm font-semibold text-white">
            {lista ? `${etiquetaLista} · ${lista.cuenta} ${lista.cuenta === 1 ? "vídeo" : "vídeos"}` : `Elige la lista de ${equipo}`}
          </p>

          <div className="mt-3 flex flex-wrap items-center gap-2">
            <select
              value={lista?.id ?? ""}
              aria-label="Lista del canal de este rival"
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
              {!lista && (
                <option value="" className="bg-[#11161C]">
                  Elige la lista de este rival…
                </option>
              )}

              {lista && (
                <option value={lista.id} className="bg-[#11161C]">
                  {etiquetaLista} · {lista.cuenta} {lista.cuenta === 1 ? "vídeo" : "vídeos"}
                </option>
              )}
              <optgroup label="Otras jornadas" className="bg-[#11161C]">
                {estado.listas
                  .filter((item) => item.id !== lista?.id)
                  .map((item) => (
                    <option key={item.id} value={item.id} className="bg-[#11161C]">
                      {nombreDeLista(item.nombre, rivalDeJornada, equipos)} · {item.cuenta} {item.cuenta === 1 ? "vídeo" : "vídeos"}
                    </option>
                  ))}
              </optgroup>
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
          </div>

          <p className="mt-2 text-[12px] text-white/50">
            Se empareja sola por el nombre del rival y la jornada; lo que elijas aquí vale para todo el cuerpo técnico. J = nuestra jornada contra ese rival · {estado.canal}
          </p>
        </section>

        {/* Nunca en blanco (20/11/2026): sin listas en el canal, qué falta y dónde se hace. */}
        {estado.listas.length === 0 && (
          <div className="min-w-0 rounded-2xl border border-white/10 bg-white/[0.03] px-4 py-4">
            <p className="text-sm font-medium text-white/85">El canal todavía no tiene listas de reproducción.</p>
            <p className="mt-1 text-[12px] text-white/55">
              Se crean al subir los cortes desde Coding: una lista por rival, con la jornada delante («J12 · …»).
            </p>
            <Link
              href="/coding"
              className="mt-3 inline-flex min-h-9 items-center gap-1.5 rounded-full border border-[#C8A96B]/50 px-3 py-1 text-[13px] font-semibold text-[#C8A96B] transition hover:bg-[#C8A96B]/10"
            >
              Ir a Coding
            </Link>
          </div>
        )}

        {avisoSospechosa}
      </div>
    );
  }

  return (
    <MarcasDelDuelo.Provider value={marcas}>
    <div className="min-w-0">
      {/* ---------------------- QUÉ LISTA SE MIRA --------------------- */}

      {/*
      | LA LISTA DEL CANAL, A SU PESTAÑA (17/11/2026, ronda 21, análisis): el
      | rival se elige una vez arriba (rival y jornada) y la lista se empareja
      | sola. Cambiarla a mano vive en la pestaña «Lista del canal»; aquí sólo
      | queda el aviso si la puesta a mano no parece de este rival.
      */}
      {/* Sin lista emparejada, el aviso para todos va abajo, con «Abrir la lista del canal» (20/11/2026). */}

      {avisoSospechosa}

      {/* -------------------------- BUSCADOR -------------------------- */}

      {lista && (
        <div className="mt-3 flex flex-wrap items-center gap-2">
          {/* A todo el ancho en el móvil: compartiendo fila con los botones se quedaba en «Buscar en l…». */}
          <div className="relative min-w-[9rem] flex-1">
            <Search
              size={14}
              className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-white/30"
            />

            <input
              value={busca}
              onChange={(evento) => setBusca(evento.target.value)}
              placeholder="Buscar"
              aria-label="Buscar en los títulos: córner, pérdida, un nombre…"
              title="Busca en los títulos: córner, pérdida, un nombre…"
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
              { valor: false, label: "Todos" },
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
          {/* En el móvil la rejilla es de dos: el tamaño sólo sirve en pantallas anchas (10/11/2026). */}
          <div className="hidden shrink-0 items-center rounded-xl border border-white/10 bg-white/[0.03] p-0.5 sm:flex">
            {TAMANOS.map((item) => (
              <button
                key={item.key}
                type="button"
                onClick={() => eligeTamano(item.key)}
                aria-pressed={tamano === item.key}
                title={`Fichas de tamaño ${item.label.toLowerCase()}`}
                aria-label={`Fichas de tamaño ${item.label.toLowerCase()}`}
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
            <span>Copiar enlaces</span>
          </button>
        </div>
      )}

      {/* ---------------------- QUIÉN TIENE VÍDEO ---------------------- */}

      {lista && !cargandoVideos && videos.length > 0 && (
        <p className="mt-3 text-[12px] text-white/55">
          En cada ficha:{" "}
          <span className="font-semibold" style={{ color: MEJOR }}>▲ verde = lo que hace bien</span>
          {" · "}
          <span className="font-semibold" style={{ color: PEOR }}>▼ naranja = lo que podemos explotar</span>
          . Es la lectura del analista; con un solo clip suyo va atenuada y dice «tendencia». Las cifras de Wyscout de los del once están en la radiografía de arriba; «Ver base» dice contra cuántos de su puesto y con cuántos minutos.
        </p>
      )}

      {lista && !cargandoVideos && videos.length > 0 && (
        <>
        {/*
        | EN EL MÓVIL, UN SELECTOR (17/11/2026, ronda 21, análisis): la tira de
        | chips se cortaba sin decir que seguía. A 390 px, un desplegable con
        | los jugadores por puesto; desde 640 px, los chips de siempre.
        */}
        <label className="mt-3 block sm:hidden">
          <span className="sr-only">Ver los cortes de</span>
          <select
            value={soloDe}
            onChange={(evento) => setSoloDe(evento.target.value)}
            className="w-full min-w-0 rounded-xl border border-white/10 bg-white/[0.04] px-3 py-2 text-sm text-white outline-none transition focus:border-[#C8A96B]/50"
          >
            <option value="" className="bg-[#11161C]">
              Todos los vídeos ({grupos.jugadores.reduce((suma, g) => suma + g.videos.length, 0) + grupos.sueltos.length})
            </option>
            {LINEAS.map((rotulo, rango) => {
              const suyos = jugadoresPorPuesto.filter((g) => rangoDePuesto(g.puesto) === rango);

              return suyos.length ? (
                <optgroup key={rotulo} label={rotulo} className="bg-[#11161C]">
                  {suyos.map((g) => (
                    <option key={g.jugador} value={g.jugador} className="bg-[#11161C]">
                      {[g.dorsal, g.jugador].filter(Boolean).join(" ")} · {g.videos.length} {g.videos.length === 1 ? "corte" : "cortes"}
                      {g.titular ? " · once probable" : ""}
                    </option>
                  ))}
                </optgroup>
              ) : null;
            })}
            {grupos.sueltos.length > 0 && (
              <option value={SUELTOS} className="bg-[#11161C]">
                Del equipo ({grupos.sueltos.length})
              </option>
            )}
          </select>
        </label>

        <div className="mt-3 hidden flex-wrap items-center gap-1.5 sm:flex">
          <Chip
            activo={!soloDe}
            onClick={() => setSoloDe("")}
            /* «Todos los vídeos»: la cifra son cortes, no jugadores (30/10/2026). */
            texto="Todos los vídeos"
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
                  <span className="ml-1.5 text-[11px] font-semibold uppercase tracking-[0.12em] text-white/45">
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
        </>
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
            Reintentar
          </button>
        </div>
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
            etiqueta={etiquetaLista}
            visionados={admin ? visionados : {}}
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
                ? `${grupos.jugadores.length} ${grupos.jugadores.length === 1 ? "jugador" : "jugadores"} con vídeo, de los ${plantilla.length} de la plantilla`
                : `${jugadoresVisibles.length} ${jugadoresVisibles.length === 1 ? "jugador" : "jugadores"} con vídeo`}
            </span>

            {/* Muestra corta (16/11/2026, análisis): con menos de 10 cortes, se dice. */}
            {!soloDe && !termino && videos.length > 0 && videos.length < 10 && (
              <span className="text-[11px] text-white/55">· muestra corta: {videos.length} {videos.length === 1 ? "vídeo" : "vídeos"} en la lista</span>
            )}

            {/* Qué cortar primero (16/11/2026, fútbol): los del once probable sin clip, sólo para el analista. */}
            {admin && !soloDe && !termino && (() => {
              const conVideo = new Set(grupos.jugadores.map((g) => g.jugador));
              const faltan = plantilla.filter((j) => j.titular && !conVideo.has(j.nombre)).map((j) => j.nombre);

              return faltan.length > 0 ? (
                <span className="w-full text-[11px] text-white/55">
                  Del once probable, sin clip: {faltan.join(", ")} · sólo lo ves tú
                </span>
              ) : null;
            })()}

            {admin && !soloDe && !termino && lineasSinCortes.length > 0 && (
              <span className="w-full text-[11px] text-white/55 sm:w-auto">
                Sin cortes de {lineasSinCortes.join(", ").replace(/, ([^,]*)$/, " ni $1")} · sólo lo ves tú
              </span>
            )}
          </header>

          <div className="space-y-6">
            {porLinea.map(({ rango, rotulo, unCorte, variosCortes }) => (
            <div key={rango} className="min-w-0 space-y-4">
            {conRotulos && (
              <p className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.18em] text-white/45">
                {rotulo}
                <span className="h-px flex-1 bg-white/10" />
              </p>
            )}

            {unCorte.length > 0 && (
              <div className="min-w-0">
                {variosCortes.length > 0 && (
                  <p className="mb-2 text-[11px] text-white/35">Un corte por jugador</p>
                )}

                <Rejilla piezas={unCorte} columnas={columnas} conJugador equipo={equipo} etiqueta={etiquetaLista} visionados={admin ? visionados : {}} onAbrir={setAbierto} onCopiar={copiaEnlace} />
              </div>
            )}

            {variosCortes.map((grupo) => (
              <div key={grupo.jugador} id={anclaDe(grupo.jugador)} className="min-w-0 scroll-mt-24">
                <div className="mb-2 flex flex-wrap items-center gap-2">
                  {grupo.dorsal && (
                    <span className="rounded-md bg-[#C8A96B]/15 px-1.5 py-0.5 text-[11px] font-semibold tabular-nums text-[#C8A96B]">
                      {grupo.dorsal}
                    </span>
                  )}

                  <h3 className="truncate text-sm font-semibold text-white">
                    {grupo.jugador}
                  </h3>

                  {grupo.titular && (
                    <span className="rounded-full border border-[#C8A96B]/50 px-1.5 py-0.5 text-[11px] font-semibold text-[#C8A96B]">Once probable</span>
                  )}

                  <span className="text-[11px] text-white/35">
                    {grupo.videos.length}{" "}
                    {grupo.videos.length === 1 ? "vídeo" : "vídeos"}
                  </span>

                  {grupo.resumen && <span className="text-[11px] text-white/45">· {grupo.resumen}</span>}

                  {/* Sus clips de Hudl, para bajar al portátil (17/11/2026); sin lista en Hudl no sale. */}
                  <ClipsHudlJugador
                    compacto
                    className="basis-full"
                    equipo={equipo}
                    jugador={{ nombres: [grupo.jugador, plantilla.find((j) => j.nombre === grupo.jugador)?.hoja], dorsal: grupo.dorsal }}
                    plantilla={plantilla.map((j) => ({ nombres: [j.nombre, j.hoja], dorsal: j.dorsal }))}
                  />

                  {(() => {
                    const vistos = grupo.videos.reduce((suma, pieza) => suma + (visionados[pieza.video.id] ?? 0), 0);

                    return admin && vistos > 0 ? <span className="text-[11px] tabular-nums text-white/45">· {vistos} {vistos === 1 ? "vista" : "vistas"} en YouTube</span> : null;
                  })()}
                </div>

                {/* Con varios cortes, su lectura y sus enlaces una vez, encima de los vídeos (18/11/2026, ronda 22). */}
                {grupo.videos[0] && (
                  <div className="mb-2 min-w-0 max-w-3xl">
                    <LecturaDelJugador
                      enCaseta={grupo.videos[0].enCaseta}
                      rasgos={grupo.videos[0].rasgos}
                      poblacion={grupo.videos[0].poblacion}
                      clips={grupo.videos[0].clips}
                      conCifras={!grupo.titular}
                    />
                    <BotonesDelJugador equipo={equipo} clave={grupo.videos[0].clave} nombre={grupo.jugador} etiquetas={grupo.videos[0].etiquetas} puesto={grupo.videos[0].puesto} className="mt-1.5" />
                  </div>
                )}

                <Rejilla
                  piezas={grupo.videos}
                  columnas={columnas}
                  equipo={equipo}
                  etiqueta={etiquetaLista}
                  visionados={admin ? visionados : {}}
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

      {/*
      | EL RESTO DE SU ONCE PROBABLE (16/11/2026; 17/11/2026, ronda 21): los
      | titulares sin corte en el canal, con la MISMA tarjeta que los de arriba
      | (▲/▼ en una línea, «Ver base», Su ficha y Su duelo con el mismo peso) y
      | sus clips de Hudl para ver o bajar: ningún titular se queda sin vídeo
      | si lo hay en Hudl. Sale también sin lista en el canal.
      */}
      {!cargandoVideos && !falloVideos && !soloDe && !termino && (() => {
        const conVideo = new Set(grupos.jugadores.map((g) => g.jugador));
        const resto = plantilla
          .filter((j) => j.titular && !conVideo.has(j.nombre))
          .sort((a, b) => rangoDePuesto(a.puesto ?? "") - rangoDePuesto(b.puesto ?? "") || (b.minutos ?? 0) - (a.minutos ?? 0));

        return resto.length > 0 ? <RestoDelOnce equipo={equipo} resto={resto} plantilla={plantilla} hayCortes={conVideo.size > 0} /> : null;
      })()}

      {/*
      | SIN CORTES DE ESA JORNADA (20/11/2026, jueces): la sección no se queda
      | en blanco ni cargando. Se dice qué falta y se ofrece la lista del canal
      | (elegir otra) o los goles del rival en vídeo.
      */}
      {!cargandoVideos && !falloVideos && (!lista || videos.length === 0 || sinListaDeLaJornada) && (
        <div className="mt-4 min-w-0 rounded-2xl border border-white/10 bg-white/[0.03] px-4 py-4">
          <p className="text-sm font-medium text-white/85">
            {!lista
              ? `${equipo} no tiene cortes en el canal${jornada ? ` de la J${jornada}` : ""}.`
              : videos.length === 0
                ? `La lista «${etiquetaLista}» todavía no tiene cortes.`
                : `No hay cortes de la J${jornada} en el canal: se ven los de «${etiquetaLista}».`}
          </p>
          <p className="mt-1 text-[12px] text-white/55">Mientras, sus goles en vídeo, o elige otra lista del canal.</p>
          <div className="mt-3 flex min-w-0 flex-wrap items-center gap-2">
            {onIrALista && (
              <button
                type="button"
                onClick={onIrALista}
                className="inline-flex min-h-9 items-center gap-1.5 rounded-full border border-white/15 px-3 py-1 text-[13px] font-semibold text-white/80 transition hover:border-[#C8A96B] hover:text-white"
              >
                <ListVideo size={13} aria-hidden />
                Abrir la lista del canal
              </button>
            )}
            <VideosDelRival rival={equipo} etiqueta={`${equipo} · vídeo`} />
          </div>
        </div>
      )}

      {/* Sin cortes en el canal, el resto de la plantilla (los titulares ya van arriba). */}
      {!cargandoVideos && (!lista || (!falloVideos && videos.length === 0)) && <PlantillaSinVideos equipo={equipo} plantilla={plantilla} />}

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
              etiqueta={etiquetaLista}
              visionados={visionados}
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
    </MarcasDelDuelo.Provider>
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
/*
| NUNCA EL HUECO EN BLANCO (18/11/2026, ronda 22, los cuatro jueces): las
| tarjetas de Usse Diao y Álvaro Giménez, abajo del todo («Fuera del once
| probable»), salían con un recuadro blanco. No era su vídeo: era el
| `loading="lazy"`. La imagen no se pide hasta que se acerca a la pantalla, y
| en una captura de la página entera, en un PDF o al bajar deprisa en el móvil
| esas dos quedaban sin pedir. Ahora se piden al montar (son una docena de
| JPG de YouTube) y, mientras llegan o si no hay póster, debajo está su ficha
| compacta: dorsal e iniciales sobre el fondo de la tarjeta.
*/
const inicialesDe = (nombre: string) =>
  nombre
    .split(/\s+/)
    .filter((p) => /^[A-Za-zÁÉÍÓÚÑÜáéíóúñü]/.test(p) && p.replace(/\./g, "").length > 1)
    .slice(0, 2)
    .map((p) => p.charAt(0).toUpperCase())
    .join("") || nombre.charAt(0).toUpperCase();

function Miniatura({ video, nombre = "", dorsal = "" }: { video: Video; nombre?: string; dorsal?: string }) {
  const respaldo = `https://i.ytimg.com/vi/${video.id}/hqdefault.jpg`;

  const [fuente, setFuente] = useState(video.miniatura || respaldo);
  const [rota, setRota] = useState(false);
  const [lista, setLista] = useState(false);

  return (
    <span className="relative block aspect-video w-full overflow-hidden bg-white/[0.05]">
      {/* La ficha compacta: se ve mientras carga el fotograma y si YouTube no tiene. */}
      <span className="absolute inset-0 flex flex-col items-center justify-center gap-1" aria-hidden>
        {nombre ? (
          <>
            <span className="flex h-12 w-12 items-center justify-center rounded-full border border-[#C8A96B]/45 bg-[#C8A96B]/10 text-base font-bold text-[#C8A96B]">
              {inicialesDe(nombre)}
            </span>
            <span className="text-[12px] font-semibold tabular-nums text-white/60">
              {dorsal ? `${dorsal} · ` : ""}
              {nombre}
            </span>
          </>
        ) : (
          <Youtube size={26} className="text-white/30" />
        )}
      </span>

      {!rota && (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={fuente}
          alt=""
          loading="eager"
          decoding="async"
          onError={() => (fuente === respaldo ? setRota(true) : setFuente(respaldo))}
          /* YouTube no da error si no hay póster: sirve un gris de 120 × 90 (la de I. Obeng salía en blanco, 07/11/2026). */
          onLoad={(e) => {
            if (e.currentTarget.naturalWidth > 0 && e.currentTarget.naturalWidth <= 120) {
              if (fuente === respaldo) setRota(true);
              else setFuente(respaldo);

              return;
            }

            setLista(true);
          }}
          className={`relative aspect-video w-full object-cover transition-opacity duration-200 ${lista ? "opacity-100" : "opacity-0"}`}
        />
      )}
    </span>
  );
}

function Rejilla({
  piezas,
  columnas,
  conJugador,
  equipo,
  etiqueta = "",
  visionados = {},
  onAbrir,
  onCopiar,
}: {
  piezas: Pieza[];
  /** La lista de la que sale («J12 · Gimnàstic de Tarragona»), para el pie. */
  etiqueta?: string;
  /** Aperturas en la app por id de vídeo. */
  visionados?: Record<string, number>;
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
      {piezas.map(({ video, tema, jugador, dorsal, puesto, resumen, clave, enCaseta, rasgos, poblacion, clips, etiquetas, titular }, i) => {
        /* Su lectura y sus enlaces, una vez por jugador: en su primera tarjeta (18/11/2026, ronda 22). */
        const primera = Boolean(jugador) && piezas.findIndex((p) => p.jugador === jugador) === i;

        return (
        <div
          key={video.id}
          id={conJugador && primera ? anclaDe(jugador) : undefined}
          title={[video.titulo, fecha(video.publicado) && `subido el ${fecha(video.publicado)}`].filter(Boolean).join(" · ")}
          className="group min-w-0 scroll-mt-24 overflow-hidden rounded-xl border border-white/10 bg-white/[0.03] transition hover:border-[#C8A96B]/40"
        >
          <button
            type="button"
            onClick={() => onAbrir(video)}
            className="relative block w-full"
          >
            <Miniatura video={video} nombre={jugador} dorsal={dorsal} />

            <span className="absolute inset-0 flex items-center justify-center bg-black/40 opacity-0 transition group-hover:opacity-100">
              <Play size={26} className="text-white drop-shadow" />
            </span>
          </button>

          <div className="p-2.5">
            {conJugador && (
              <p className="mb-1 flex items-center gap-1.5 truncate text-[11px] font-semibold uppercase tracking-wide">
                {dorsal && (
                  <span className="tabular-nums text-[#C8A96B]">{dorsal}</span>
                )}

                <span className={jugador ? "text-[#C8A96B]" : "text-white/35"}>
                  {jugador || "Del equipo"}
                </span>
              </p>
            )}

            {conJugador && resumen && <p className="mb-1 text-[11px] tabular-nums text-white/60">{resumen}</p>}

            {/* Qué mirar: su puesto y sus etiquetas de la ficha. */}
            {/* Las etiquetas son el criterio del analista, no una cifra: se
                dice al pasar por ellas (30/10/2026, análisis). */}
            {/*
            | LA LEYENDA PEGADA A LAS ETIQUETAS (16/11/2026, análisis y
            | marketing): en el móvil la frase de arriba quedaba lejos. Cada
            | grupo dice qué es: «▲ Hace bien» en verde, «▼ Explotable» en naranja.
            */}
            {conJugador && puesto && <p className="mb-0.5 text-[12px] leading-snug text-white/60">{puesto}</p>}
            {/*
            | LA LECTURA UNA VEZ (18/11/2026, ronda 22, análisis y marketing):
            | el ▲/▼ de Wyscout de los del once ya está en la radiografía de
            | arriba; aquí, la lectura del analista y «Ver base». A los de fuera
            | del once, que no salen arriba, sí su ▲/▼.
            */}
            {conJugador && primera && <LecturaDelJugador enCaseta={enCaseta} rasgos={rasgos} poblacion={poblacion} clips={clips} conCifras={!titular || enCaseta.length === 0} />}

            {/* El título original del vídeo, en pequeño: lo que manda es quién es. */}
            {/* «Corte 14», el nombre del equipo o un título que sólo repite al jugador
                («8 BLASSIS», «FC CARTAGENA Nº 20 RUBÉN») no dicen qué enseña el clip. */}
            {(() => {
              const repite = Boolean(jugador) && tituloSoloRepite(video.titulo, jugador, equipo);
              const texto = repite ? "" : temaLegible(tema, video.posicion, video.descripcion);
              const vacio = !texto || (conJugador && jugador && (/^Corte \d+$/.test(texto) || (equipo && desnuda(texto) === desnuda(equipo))));

              return vacio ? null : (
                <p className={`line-clamp-2 leading-snug ${conJugador ? "text-[12px] text-white/60" : "text-[13px] text-white/85"}`}>
                  {texto}
                </p>
              );
            })()}

            {/* Del vídeo a la consigna: Su ficha y Su duelo con el mismo peso, y Su ABP si toca. */}
            {conJugador && primera && equipo && <BotonesDelJugador equipo={equipo} clave={clave} nombre={jugador} etiquetas={etiquetas} puesto={puesto} className="mt-1.5" />}

            {/* El pie (16/11/2026, jueces): «J13 · 63′ · 0:42», la jornada, el minuto si
                el título lo dice y lo que dura; ya no «corte 4». Las vistas, sólo al analista. */}
            <div className="mt-1.5 flex items-center gap-2">
              <span className="min-w-0 flex-1 truncate text-[12px] tabular-nums text-white/55" title={video.titulo}>
                {[
                  /* 17/11/2026 (ronda 20, fútbol): «J13» se leía como la jornada del corte; es la lista de NUESTRO partido. El rival del corte, si el título lo dice. */
                  rivalDelCorte(video.titulo, equipo ?? ""),
                  soloJornada(etiqueta) ? `lista ${soloJornada(etiqueta)}` : "",
                  minutoDe(video),
                  duracionLegible(video.duracion),
                  visionados[video.id] ? `${visionados[video.id]} ${visionados[video.id] === 1 ? "vista" : "vistas"} en YouTube` : "",
                ]
                  .filter(Boolean)
                  .join(" · ")}
              </span>

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
        );
      })}
    </div>
  );
}

/** «vs Alcorcón» si el título del vídeo dice contra quién es el corte («… vs Alcorcón», «… contra el Ibiza»); si no, nada. */
function rivalDelCorte(titulo: string, suEquipo: string): string {
  const m = /(?:^|\s)(?:vs\.?|v\.|contra(?:\s+el)?|ante(?:\s+el)?|frente\s+al?)\s+([A-ZÁÉÍÓÚÑ][\wÁÉÍÓÚÑáéíóúñü.'-]*(?:\s+[A-ZÁÉÍÓÚÑ][\wÁÉÍÓÚÑáéíóúñü.'-]*){0,3})/u.exec(titulo ?? "");

  const otro = m?.[1].trim() ?? "";

  /* «Alcorcón vs Real Murcia» en un vídeo del Murcia: el del corte es el otro, no él. */
  if (!otro || (suEquipo && (desnuda(otro).includes(desnuda(suEquipo)) || desnuda(suEquipo).includes(desnuda(otro))))) return "";

  return `vs ${otro}`;
}

/* ------------------------------------------------------------------ */
/*  SIN VÍDEOS: LA PLANTILLA                                           */
/* ------------------------------------------------------------------ */

/**
 * Sin lista emparejada, o con la lista vacía, la pantalla no se queda en un
 * aviso (10/11/2026, jueces): enseña la plantilla, primero el once probable y
 * después por puesto, con lo que el analista ha escrito de cada uno y el
 * enlace a su ficha.
 */
function PlantillaSinVideos({ equipo, plantilla }: { equipo: string; plantilla: JugadorPlantilla[] }) {
  const hayOnce = plantilla.some((j) => j.titular);
  const ordenados = plantilla.filter((j) => !j.titular).sort(
    (a, b) => Number(Boolean(b.titular)) - Number(Boolean(a.titular)) || rangoDePuesto(a.puesto ?? "") - rangoDePuesto(b.puesto ?? "") || (b.minutos ?? 0) - (a.minutos ?? 0),
  );

  if (ordenados.length === 0) return null;


  /*
  | 27/11/2026 (jueces, ronda 9): con once probable, el resto de la plantilla
  | va plegado en una fila (lo que se ve al abrir es el once), y sin «todavía
  | sin cortes»: lo que no tiene dato no se nombra.
  */
  return (
    <details open={!hayOnce} className="group mt-4 min-w-0">
      <summary className="mb-3 flex cursor-pointer list-none flex-wrap items-baseline gap-2 border-b border-white/10 pb-2 [&::-webkit-details-marker]:hidden">
        <h2 className="text-sm font-semibold text-white">
          {hayOnce ? `El resto de la plantilla: ${ordenados.length} jugadores` : `Su plantilla: ${ordenados.length} jugadores`}
        </h2>
        <span className="text-[12px] text-white/55">
          {hayOnce ? <span className="text-[var(--rmcf-gold-ink,#C8A96B)] group-open:hidden">Ver ▾ · </span> : null}
          cada ficha abre su ficha y sus clips
        </span>
      </summary>

      <div className="grid min-w-0 grid-cols-1 gap-2 sm:grid-cols-2 xl:grid-cols-3">
        {ordenados.map((jugador) => {
          const resumen = resumenDeTemporada(jugador);

          return (
            /* Con <a>: la misma pantalla con otro ?jugador= se carga entera y abre su ficha. */
            <a
              key={jugador.hoja ?? jugador.nombre}
              href={`/scout-rival-individual?equipo=${encodeURIComponent(equipo)}&jugador=${encodeURIComponent(jugador.hoja ?? jugador.nombre)}`}
              className="min-w-0 rounded-xl border border-white/10 bg-white/[0.03] px-3 py-2.5 transition hover:border-[#C8A96B]/40"
            >
              <p className="flex min-w-0 items-center gap-1.5 text-sm font-semibold text-white">
                {jugador.dorsal && <span className="tabular-nums text-[#C8A96B]">{jugador.dorsal}</span>}
                <span className="min-w-0 truncate" title={jugador.nombre}>{jugador.nombre}</span>
                {jugador.titular && (
                  <span className="shrink-0 rounded-full border border-[#C8A96B]/50 px-1.5 py-0.5 text-[11px] font-semibold text-[#C8A96B]">Once probable</span>
                )}
              </p>

              {(jugador.puesto || resumen) && (
                <p className="mt-0.5 text-[12px] tabular-nums text-white/55">{[jugador.puesto, resumen].filter(Boolean).join(" · ")}</p>
              )}

              {(jugador.etiquetas?.length ?? 0) > 0 && (
                <p className="mt-0.5 line-clamp-2 text-[12px] leading-snug">
                  {/* Con su marca, como en las fichas con vídeo (16/11/2026). */}
                  {jugador.etiquetas!.map((e, i) => (
                    <span key={e} className="font-semibold" style={{ color: esEtiquetaDebil(e) ? PEOR : MEJOR }}>
                      {i > 0 ? " · " : ""}
                      {esEtiquetaDebil(e) ? "▼ " : "▲ "}
                      {e}
                    </span>
                  ))}
                </p>
              )}
            </a>
          );
        })}
      </div>
    </details>
  );
}

/** El ancla de la tarjeta de un jugador: la radiografía de arriba salta a ella. */
export const anclaDe = (nombre: string) => `ficha-${desnuda(nombre).replace(/\s+/g, "-")}`;

/** «1 clip, tendencia» o «3 clips»: en cuántos cortes se apoya la lectura del analista. */
export const apoyoDeClips = (clips: number) => (clips <= 0 ? "" : clips === 1 ? "1 clip, tendencia" : `${clips} clips`);

/*
| LA LECTURA DE CADA JUGADOR, UNA VEZ (18/11/2026, ronda 22, los cuatro
| jueces): la ronda 21 la había dejado en dos líneas «▲ Hace bien / ▼
| Explotable» con las etiquetas y el ▲/▼ de Wyscout, pero ese ▲/▼ ya está en
| la radiografía del once, arriba: se leía dos veces. Ahora:
|
| - las etiquetas del analista, cada una con su color y sin el rótulo (la
|   leyenda de encima de las fichas dice qué es verde y qué naranja);
| - apoyadas en un solo clip, atenuadas y en cursiva, con «1 clip, tendencia»:
|   que no parezcan hechos firmes;
| - el ▲/▼ de Wyscout sólo en quien no sale en la radiografía (`conCifras`,
|   los de fuera del once probable);
| - y un único «Ver base» con contra cuántos se le compara, sus minutos y la
|   raya de cada cifra (con la mediana y los extremos rotulados).
*/
export function LecturaDelJugador({
  enCaseta,
  rasgos,
  poblacion,
  clips,
  conCifras = true,
}: {
  enCaseta: { texto: string; debil: boolean }[];
  rasgos: RasgoCorto[];
  poblacion?: string;
  /** Clips suyos (canal o Hudl) en los que se apoyan sus etiquetas. */
  clips: number;
  /** Pinta su ▲/▼ de Wyscout; `false` en los del once, que ya lo tienen en la radiografía. */
  conCifras?: boolean;
}) {
  const apoyo = apoyoDeClips(clips);
  const tendencia = clips === 1;
  const etiquetas = [...enCaseta.filter((e) => !e.debil), ...enCaseta.filter((e) => e.debil)];

  if (!etiquetas.length && !rasgos.length) return null;

  return (
    <div className="min-w-0">
      {etiquetas.length > 0 && (
        <p className={`mb-0.5 text-[12px] leading-snug ${tendencia ? "italic opacity-65" : ""}`} title={tendencia ? "Lectura del analista sobre un solo clip suyo: tendencia, no patrón" : "Lectura del analista (su ficha)"}>
          {etiquetas.map((e, i) => (
            <span key={`${e.texto}-${i}`} style={{ color: e.debil ? PEOR : MEJOR }}>
              {i > 0 ? <span className="text-white/35"> · </span> : null}
              <span className={tendencia ? "" : "font-semibold"}>{e.debil ? "▼" : "▲"}</span> {e.texto}
            </span>
          ))}
          {apoyo && <span className="not-italic text-white/50"> · {apoyo}</span>}
        </p>
      )}

      {/* Su ▲/▼ en una línea de 12 px (18/11/2026, ronda 23): ninguna tarjeta sin conclusión. */}
      {conCifras && rasgos.length > 0 && (
        <p className="mb-0.5 text-[12px] leading-snug tabular-nums">
          {rasgos.map((r, i) => (
            <span key={r.signo} style={{ color: r.signo === "▲" ? MEJOR : PEOR }}>
              {i > 0 ? <span className="text-white/35"> · </span> : null}
              {r.signo} {r.corta} <b>{r.marca}</b>
            </span>
          ))}
        </p>
      )}

      {rasgos.length > 0 && (
        <details className="mt-0.5 min-w-0">
          <summary className="inline-flex min-h-[44px] cursor-pointer list-none items-center gap-1 text-[12px] text-white/55 transition hover:text-white sm:min-h-0">
            Ver base ▾
          </summary>
          {/* Con quién se le compara y con cuántos minutos (Wyscout, esta temporada). */}
          {poblacion && <p className="mt-1 text-[12px] leading-snug text-white/60">{poblacion.charAt(0).toUpperCase() + poblacion.slice(1)}.</p>}
          <ul className="mt-1 space-y-1.5 text-[12px] leading-snug text-white/65">
            {rasgos.map((r) => (
              <li key={r.signo} className="min-w-0">
                <span style={{ color: r.signo === "▲" ? MEJOR : PEOR }}>{r.signo}</span> {r.corta} · {r.base}
                <span className="relative mt-1 block h-1.5 w-full max-w-[14rem] rounded-full bg-white/10" aria-hidden>
                  <span className="absolute inset-y-0 left-0 rounded-full" style={{ width: `${Math.max(3, Math.min(100, r.percentil))}%`, background: r.signo === "▼" ? PEOR : MEJOR }} />
                  <span className="absolute -top-0.5 bottom-[-2px] left-1/2 w-px bg-white/55" />
                </span>
                <span className="mt-0.5 flex w-full max-w-[14rem] justify-between text-[11px] tabular-nums text-white/45" aria-hidden>
                  <span>el peor</span>
                  <span>mediana</span>
                  <span>el mejor</span>
                </span>
              </li>
            ))}
          </ul>
        </details>
      )}
    </div>
  );
}

/*
| SU FICHA, SU DUELO Y EL PLAN (18/11/2026, ronda 22, marketing): al lado, el
| Plan de partido con el rival ya elegido. Los rivales no tienen seguimiento
| en la app: no hay «Su seguimiento» que enlazar.
*/
/** Nuestro jugador (o los dos) que le toca a cada uno de los suyos en /duelos. */
type Marca = { suyo: string; nuestros: string[] };
const MarcasDelDuelo = createContext<Marca[]>([]);

export function BotonesDelJugador({
  equipo,
  clave,
  nombre,
  etiquetas = [],
  puesto = "",
  className = "",
}: {
  equipo: string;
  clave?: string;
  nombre: string;
  etiquetas?: string[];
  /** Su puesto: al portero no se le ofrece «Su duelo» (no tiene duelo en /duelos; 18/11/2026, ronda 23). */
  puesto?: string;
  className?: string;
}) {
  const portero = /portero|guardameta/i.test(puesto);
  const marcas = useContext(MarcasDelDuelo);
  const quien = portero ? undefined : marcas.find((m) => mismoNombreRival(m.suyo, nombre));
  const boton =
    "inline-flex min-h-[44px] items-center rounded-full border border-[#C8A96B]/40 px-2.5 font-semibold text-[#C8A96B] transition hover:bg-[#C8A96B]/10 sm:min-h-0 sm:py-0.5";

  return (
    <p className={`flex flex-wrap gap-1.5 text-[12px] ${className}`}>
      <Link href={`/rivals?equipo=${encodeURIComponent(equipo)}${clave ? `&jugador=${encodeURIComponent(clave)}` : ""}`} className={boton}>
        Su ficha →
      </Link>
      {!portero && (
        <Link href={`/duelos?equipo=${encodeURIComponent(equipo)}&jugador=${encodeURIComponent(nombre)}`} className={boton}>
          Su duelo →
        </Link>
      )}
      {/* «Quién le marca», con la ficha de nuestro jugador (20/11/2026, jueces de fútbol). «Plan de partido» sale ya en la tira de arriba (marketing). */}
      {quien?.nuestros.slice(0, 2).map((n) => (
        <Link key={n} href={`/individual?nombre=${encodeURIComponent(n)}`} className={boton} title={`Le marca ${n}: su ficha en Individual`}>
          Le marca {n} →
        </Link>
      ))}
      {etiquetas.some((e) => ES_ABP.test(e)) && (
        <Link href={`/scout-rival-abp?equipo=${encodeURIComponent(equipo)}`} className={boton}>
          Su ABP →
        </Link>
      )}
    </p>
  );
}

/* ------------------------------------------------------------------ */
/*  EL RESTO DE SU ONCE PROBABLE                                       */
/* ------------------------------------------------------------------ */

function RestoDelOnce({
  equipo,
  resto,
  plantilla,
  hayCortes,
}: {
  equipo: string;
  resto: JugadorPlantilla[];
  plantilla: JugadorPlantilla[];
  /** Hay cortes de otros en el canal: entonces son «el resto». */
  hayCortes: boolean;
}) {
  const paraHudl = useMemo(() => plantilla.map((j) => ({ nombres: [j.nombre, j.hoja], dorsal: j.dorsal })), [plantilla]);
  const buscados = useMemo(() => resto.map((j) => ({ clave: j.hoja ?? j.nombre, nombres: [j.nombre, j.hoja], dorsal: j.dorsal })), [resto]);
  const hudl = useCuentaHudl(equipo, buscados, paraHudl);
  const conHudl = Object.keys(hudl).length;

  return (
    <section className="mt-6 min-w-0">
      <header className="mb-3 flex flex-wrap items-baseline gap-2 border-b border-white/10 pb-2">
        <h2 className="text-[11px] font-semibold uppercase tracking-[0.18em] text-[#C8A96B]">{hayCortes ? "El resto de su once probable" : "Su once probable"}</h2>
        <span className="text-[12px] text-white/55">
          {/* Sin «sin corte en el canal» (27/11/2026, ronda 9): se dice lo que hay. */}
          {resto.length} {resto.length === 1 ? "jugador" : "jugadores"}{conHudl > 0 ? ` · ${conHudl} con sus clips de Hudl para ver o bajar` : ""}
        </span>
      </header>
      <div className="grid min-w-0 grid-cols-1 gap-2.5 sm:grid-cols-2 xl:grid-cols-3">
        {resto.map((j) => {
          const enCaseta = (j.etiquetas ?? []).map((e) => ({ texto: etiquetaEnCaseta(e, j, plantilla), debil: esEtiquetaDebil(e) })).filter((e) => e.texto);
          const resumen = resumenDeTemporada(j);
          const puesto = j.rol || j.puesto;

          return (
            <div key={j.hoja ?? j.nombre} id={anclaDe(j.nombre)} className="min-w-0 scroll-mt-24 rounded-xl border border-white/10 bg-white/[0.03] p-3">
              <p className="flex min-w-0 items-center gap-1.5 text-[12px] font-semibold uppercase tracking-wide text-[#C8A96B]">
                {j.dorsal && <span className="tabular-nums">{j.dorsal}</span>}
                <span className="min-w-0 truncate">{j.nombre}</span>
              </p>
              {puesto && <p className="mt-0.5 text-[12px] leading-snug text-white/60">{puesto}</p>}
              {resumen && <p className="mb-1 text-[12px] tabular-nums text-white/60">{resumen}</p>}
              <LecturaDelJugador enCaseta={enCaseta} rasgos={j.rasgos ?? []} poblacion={j.poblacion} clips={hudl[j.hoja ?? j.nombre] ?? 0} conCifras={!j.titular} />
              <BotonesDelJugador equipo={equipo} clave={j.clave} nombre={j.nombre} etiquetas={j.etiquetas} puesto={[j.rol, j.puesto].filter(Boolean).join(" ")} className="mt-1.5" />
              <ClipsHudlJugador
                className="mt-2"
                equipo={equipo}
                jugador={{ nombres: [j.nombre, j.hoja], dorsal: j.dorsal }}
                plantilla={paraHudl}
              />
            </div>
          );
        })}
      </div>
    </section>
  );
}
