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
  ExternalLink,
  Link2,
  ListVideo,
  Loader2,
  Play,
  RefreshCw,
  Search,
  SquarePlay as Youtube,
  X,
} from "lucide-react";
import { toast } from "sonner";

import { useRemoteDoc } from "@/hooks/useRemoteDoc";
import {
  CLAVE_LISTAS,
  LISTAS_VACIAS,
  buscaLista,
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

type Estado =
  | { fase: "cargando" }
  | { fase: "sin-conectar"; aviso: string }
  | { fase: "listo"; canal: string; listas: ListaCanal[] };

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
    const porJugador = new Map<
      string,
      { jugador: string; dorsal: string; videos: { video: Video; tema: string }[] }
    >();

    const sueltos: { video: Video; tema: string }[] = [];

    for (const video of videos) {
      if (
        termino &&
        !`${video.titulo} ${video.descripcion}`.toLowerCase().includes(termino)
      ) {
        continue;
      }

      const jugador = jugadorDelTitulo(video.titulo, plantilla);

      const pieza = { video, tema: temaDelTitulo(video.titulo, jugador) };

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

  const copiaEnlace = async (video: Video) => {
    try {
      await navigator.clipboard.writeText(enlaceVideo(video.id));

      toast.success("Enlace copiado");
    } catch {
      toast.error("El navegador no ha permitido copiar");
    }
  };

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

          <span className="text-[11px] tabular-nums text-white/35">
            {cargandoVideos
              ? "cargando…"
              : `${grupos.jugadores.reduce((suma, g) => suma + g.videos.length, 0) + grupos.sueltos.length} vídeos · ${grupos.jugadores.length} jugadores`}
          </span>
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

      {!cargandoVideos && (
        <div className="mt-4 space-y-5">
          {grupos.jugadores.map((grupo) => (
            <section key={grupo.jugador} className="min-w-0">
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
                onAbrir={setAbierto}
                onCopiar={copiaEnlace}
              />
            </section>
          ))}

          {grupos.sueltos.length > 0 && (
            <section className="min-w-0">
              <div className="mb-2 flex flex-wrap items-center gap-2">
                <h3 className="text-sm font-semibold text-white/70">
                  Del equipo
                </h3>

                <span className="text-[11px] text-white/35">
                  {grupos.sueltos.length}{" "}
                  {grupos.sueltos.length === 1 ? "vídeo" : "vídeos"} · el título
                  no dice de qué jugador es
                </span>
              </div>

              <Rejilla
                piezas={grupos.sueltos}
                onAbrir={setAbierto}
                onCopiar={copiaEnlace}
              />
            </section>
          )}
        </div>
      )}

      {/* ------------------------ EL REPRODUCTOR ----------------------- */}

      {abierto && (
        <div
          className="modal-veil fixed inset-0 z-[70] flex items-center justify-center bg-black/80 p-4"
          onClick={() => setAbierto(null)}
        >
          <div
            className="w-full max-w-4xl overflow-hidden rounded-2xl border border-white/12 bg-[#11161C]"
            onClick={(evento) => evento.stopPropagation()}
          >
            <header className="flex items-center gap-3 border-b border-white/10 px-4 py-3">
              <p className="min-w-0 flex-1 truncate text-sm font-medium text-white">
                {abierto.titulo}
              </p>

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
/*  LA REJILLA DE FICHAS                                               */
/* ------------------------------------------------------------------ */

function Rejilla({
  piezas,
  onAbrir,
  onCopiar,
}: {
  piezas: { video: Video; tema: string }[];
  onAbrir: (video: Video) => void;
  onCopiar: (video: Video) => void;
}) {
  return (
    <div className="grid min-w-0 gap-2.5 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
      {piezas.map(({ video, tema }) => (
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
