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
import {
  CLAVE_LISTAS,
  LISTAS_VACIAS,
  buscaLista,
  parecido,
  desnuda,
  enlaceIncrustado,
  enlaceLista,
  enlaceVideo,
  jugadorDelTitulo,
  temaDelTitulo,
  type JugadorPlantilla,
  type ListaCanal,
  type ListasRivales,
} from "@/lib/rivals/youtube-listas";

type Video = {
  id: string;
  titulo: string;
  descripcion: string;
  miniatura: string;
  publicado: string;
  posicion: number;
};

/** Un vídeo ya colocado: de quién es y de qué va, además del vídeo. */
type Pieza = {
  video: Video;
  /** El título sin el nombre del jugador: lo que describe el corte. */
  tema: string;
  /** Vacío cuando el título no dice de quién es. */
  jugador: string;
  dorsal: string;
};

type Estado =
  | { fase: "cargando" }
  | { fase: "sin-conectar"; aviso: string }
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

const CLAVE_TAMANO = "rmcf-videos-tamano";
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
  const [traidos, setTraidos] = useState<{ listaId: string; videos: Video[] }>({
    listaId: "",
    videos: [],
  });

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

    /* El estado se toca **después** del `await`: cambiarlo en el cuerpo del
       efecto es un render en cascada y el linter de React lo prohíbe. */
    void (async () => {
      try {
        const datos = await fetch("/api/youtube/videos", {
          signal: control.signal,
        }).then((r) => r.json());

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
        if (control.signal.aborted) return;

        console.error("[VideosDelCanal] canal", error);

        setEstado({
          fase: "sin-conectar",
          aviso: "No se ha podido hablar con YouTube.",
        });
      }
    })();

    return () => control.abort();
  }, [intento]);

  /* ------------------------- QUÉ LISTA ES ------------------------ */

  const lista = useMemo(() => {
    const listas = estado.fase === "listo" ? estado.listas : [];

    if (listas.length === 0) return null;

    /* Lo elegido a mano manda sobre lo que se adivine por el nombre. */
    const aMano = elegidas.porEquipo?.[clave];

    const puesta = aMano ? listas.find((item) => item.id === aMano) : null;

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

    void (async () => {
      try {
        const datos = await fetch(
          `/api/youtube/videos?lista=${encodeURIComponent(listaId)}`,
          { signal: control.signal },
        ).then((r) => r.json());

        if (control.signal.aborted) return;

        setTraidos({ listaId, videos: (datos?.videos ?? []) as Video[] });
      } catch (error) {
        if (control.signal.aborted) return;

        console.error("[VideosDelCanal] vídeos", error);

        setTraidos({ listaId, videos: [] });
      }
    })();

    return () => control.abort();
  }, [listaId]);

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
    const porJugador = new Map<string, { jugador: string; dorsal: string; videos: Pieza[] }>();

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
      };

      if (!jugador) {
        sueltos.push(pieza);

        continue;
      }

      const grupo = porJugador.get(jugador.nombre) ?? {
        jugador: jugador.nombre,
        dorsal: jugador.dorsal ?? "",
        videos: [],
      };

      grupo.videos.push(pieza);
      porJugador.set(jugador.nombre, grupo);
    }

    return {
      jugadores: [...porJugador.values()].sort(
        (a, b) =>
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

  const jugadoresVisibles = useMemo(
    () => grupos.jugadores.filter((grupo) => !soloDe || soloDe === grupo.jugador),
    [grupos.jugadores, soloDe],
  );

  const mostrados = useMemo(() => {
    if (soloDe === SUELTOS) return grupos.sueltos;

    if (soloDe) {
      return (
        grupos.jugadores.find((grupo) => grupo.jugador === soloDe)?.videos ?? []
      );
    }

    return [
      ...grupos.jugadores.flatMap((grupo) => grupo.videos),
      ...grupos.sueltos,
    ];
  }, [grupos, soloDe]);

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
          El canal de YouTube no está conectado
        </p>

        <p className="mt-1 text-[12px] leading-relaxed text-white/55">
          {estado.aviso} Se conecta una vez desde <strong>Coding</strong>, en el
          panel de YouTube, y desde entonces esta pantalla lee las listas de cada
          rival.
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

      <div className="flex flex-wrap items-center gap-2 rounded-2xl border border-white/10 bg-white/[0.03] px-3 py-2.5">
        <ListVideo size={15} className="shrink-0 text-[#C8A96B]" />

        <span className="text-[10px] uppercase tracking-[0.16em] text-white/40">
          Lista del canal
        </span>

        <select
          value={lista?.id ?? ""}
          onChange={(evento) => {
            const id = evento.target.value;

            setElegidas((actual) => ({
              ...actual,
              porEquipo: { ...actual.porEquipo, [clave]: id },
            }));
          }}
          className="min-w-0 flex-1 rounded-lg border border-white/10 bg-white/[0.04] px-2.5 py-1.5 text-sm text-white outline-none transition focus:border-[#C8A96B]/50"
        >
          <option value="" className="bg-[#11161C]">
            {lista ? "Ninguna" : "Elige la lista de este rival…"}
          </option>

          {estado.listas.map((item) => (
            <option key={item.id} value={item.id} className="bg-[#11161C]">
              {item.nombre} ({item.cuenta})
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
        <p className="mt-4 rounded-2xl border border-white/10 bg-white/[0.02] px-4 py-6 text-center text-xs leading-relaxed text-white/40">
          Ninguna lista del canal se parece a «{equipo}». Elígela arriba y queda
          recordada: la próxima vez se abre sola, también para el resto del
          cuerpo técnico.
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
          <div className="relative min-w-0 flex-1">
            <Search
              size={14}
              className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-white/30"
            />

            <input
              value={busca}
              onChange={(evento) => setBusca(evento.target.value)}
              placeholder="Buscar en los títulos: «córner», «pérdida», un nombre…"
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
        <div className="mt-3 flex flex-wrap items-center gap-1.5">
          <Chip
            activo={!soloDe}
            onClick={() => setSoloDe("")}
            texto="Todos"
            cuenta={
              grupos.jugadores.reduce((suma, g) => suma + g.videos.length, 0) +
              grupos.sueltos.length
            }
          />

          {grupos.jugadores.map((grupo) => (
            <Chip
              key={grupo.jugador}
              activo={soloDe === grupo.jugador}
              onClick={() =>
                setSoloDe(soloDe === grupo.jugador ? "" : grupo.jugador)
              }
              texto={grupo.jugador}
              dorsal={grupo.dorsal}
              cuenta={grupo.videos.length}
            />
          ))}

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

      {!cargandoVideos && lista && videos.length === 0 && (
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
              {mostrados.length} en orden de la lista del canal
            </span>
          </header>

          <Rejilla
            piezas={mostrados}
            columnas={columnas}
            conJugador
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
              {jugadoresVisibles.length}{" "}
              {jugadoresVisibles.length === 1 ? "jugador" : "jugadores"} con
              vídeo
            </span>
          </header>

          <div className="space-y-5">
            {jugadoresVisibles.map((grupo) => (
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
                </div>

                <Rejilla
                  piezas={grupo.videos}
                  columnas={columnas}
                  onAbrir={setAbierto}
                  onCopiar={copiaEnlace}
                />
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
                Partidos enteros, balón parado, análisis de bloque: lo que no
                habla de un jugador concreto. Si alguno sí es de uno, basta con
                poner su nombre en el título del vídeo en YouTube.
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
  cuenta: number;
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

      <span className="tabular-nums opacity-50">{cuenta}</span>
    </button>
  );
}

/* ------------------------------------------------------------------ */
/*  LA REJILLA DE FICHAS                                               */
/* ------------------------------------------------------------------ */

function Rejilla({
  piezas,
  columnas,
  conJugador,
  onAbrir,
  onCopiar,
}: {
  piezas: Pieza[];
  /** Las clases de columnas, ya resueltas: ver `TAMANOS`. */
  columnas: string;
  /** Pone el nombre del jugador en la ficha: en la vista seguida no hay
      cabecera encima que lo diga. */
  conJugador?: boolean;
  onAbrir: (video: Video) => void;
  onCopiar: (video: Video) => void;
}) {
  return (
    <div className={`grid min-w-0 gap-2.5 ${columnas}`}>
      {piezas.map(({ video, tema, jugador, dorsal }) => (
        <div
          key={video.id}
          className="group min-w-0 overflow-hidden rounded-xl border border-white/10 bg-white/[0.03] transition hover:border-[#C8A96B]/40"
        >
          <button
            type="button"
            onClick={() => onAbrir(video)}
            className="relative block w-full"
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={video.miniatura}
              alt=""
              loading="lazy"
              className="aspect-video w-full object-cover"
            />

            <span className="absolute inset-0 flex items-center justify-center bg-black/30 opacity-0 transition group-hover:opacity-100">
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

            <p className="line-clamp-2 text-[13px] leading-snug text-white/85">
              {tema}
            </p>

            <div className="mt-1.5 flex items-center justify-between gap-2">
              <span className="text-[10px] uppercase tracking-wide text-white/30">
                {fecha(video.publicado)}
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
      ))}
    </div>
  );
}
