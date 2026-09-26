"use client";

/**
 * ELEGIR EL VÍDEO DEL JUGADOR DE LA LISTA DE SU EQUIPO EN YOUTUBE.
 *
 * El canal tiene **una lista de reproducción por rival** con los cortes que se
 * montan en el coding. Cuando un corte se sube filtrando por un jugador, el
 * enlace cae solo en su ficha (`app/coding/page.tsx`). Pero eso deja fuera todo
 * lo demás: lo que se subió antes de que existiera ese automatismo, lo que se
 * montó sin filtrar y se quiere colgar igual, y lo que alguien subió a mano al
 * canal. Para eso está esto: se abre la lista del equipo y se elige.
 *
 * **La lista se busca sola** por el nombre del equipo (`buscaLista`), que es el
 * mismo emparejamiento que usa el scouting individual, así que los dos sitios
 * encuentran lo mismo. Si no la encuentra, se elige a mano de entre todas.
 *
 * **Los vídeos que parecen del jugador salen primero.** Se mira su nombre y su
 * dorsal en el título (`jugadorDelTitulo`); el resto queda debajo, porque un
 * corte del equipo también puede querer colgarse de una ficha.
 *
 * El token NO sale al navegador: todo pasa por `/api/youtube/videos`, que sólo
 * devuelve títulos, miniaturas e ids.
 */

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  Check,
  ExternalLink,
  ListVideo,
  Loader2,
  RefreshCw,
  Search,
} from "lucide-react";

import {
  buscaLista,
  jugadorDelTitulo,
  type ListaCanal,
} from "@/lib/rivals/youtube-listas";

type VideoCanal = {
  id: string;
  titulo: string;
  miniatura?: string;
  publicado?: string;
};

type Estado = "parado" | "cargando" | "listo" | "sin-cuenta" | "error";

export function EligeVideoDeLista({
  equipo,
  jugador,
  dorsal,
  valor,
  onElegir,
}: {
  /** El nombre del equipo rival, con el que se busca su lista. */
  equipo: string;
  /** Cómo se llama el jugador, para subir sus vídeos arriba. */
  jugador: string;
  dorsal?: string;
  /** La URL que hay puesta ahora, para marcar cuál está elegida. */
  valor: string;
  onElegir: (url: string) => void;
}) {
  const [abierto, setAbierto] = useState(false);
  const [estado, setEstado] = useState<Estado>("parado");
  const [aviso, setAviso] = useState("");
  const [listas, setListas] = useState<ListaCanal[]>([]);
  const [listaId, setListaId] = useState("");
  const [videos, setVideos] = useState<VideoCanal[]>([]);
  const [busca, setBusca] = useState("");

  /* El testigo dispara la recarga: el trabajo va dentro del efecto, que es lo
     que el linter acepta (ver `hooks/useRemoteDoc.ts`). */
  const [testigo, setTestigo] = useState(0);

  const recarga = useCallback(() => setTestigo((n) => n + 1), []);

  /* --- Las listas del canal, y cuál es la de este equipo --- */

  useEffect(() => {
    if (!abierto) return;

    let cancelado = false;

    (async () => {
      /*
      | El «cargando» se pone DENTRO del async y no en el cuerpo del efecto: un
      | `setState` síncrono ahí encadena renders y el linter lo para. Es la
      | misma forma que usa el resto de la casa.
      */
      setEstado("cargando");

      try {
        const r = await fetch("/api/youtube/videos", { cache: "no-store" });
        const datos = await r.json();

        if (cancelado) return;

        if (!datos?.conectado) {
          setEstado("sin-cuenta");
          setAviso(datos?.aviso ?? "No hay ninguna cuenta de YouTube conectada.");

          return;
        }

        const suyas: ListaCanal[] = Array.isArray(datos.listas) ? datos.listas : [];

        setListas(suyas);

        const encontrada = buscaLista(suyas, equipo);

        setListaId((previa) => previa || encontrada?.id || "");
        setEstado("listo");
      } catch (error) {
        if (cancelado) return;

        console.error("[ficha rival] listas de YouTube", error);
        setEstado("error");
        setAviso("No se han podido leer las listas del canal.");
      }
    })();

    return () => {
      cancelado = true;
    };
  }, [abierto, equipo, testigo]);

  /* --- Los vídeos de la lista elegida --- */

  useEffect(() => {
    if (!abierto || !listaId) return;

    let cancelado = false;

    (async () => {
      setEstado("cargando");

      try {
        const r = await fetch(
          `/api/youtube/videos?lista=${encodeURIComponent(listaId)}`,
          { cache: "no-store" },
        );

        const datos = await r.json();

        if (cancelado) return;

        setVideos(Array.isArray(datos?.videos) ? datos.videos : []);
        setEstado("listo");
      } catch (error) {
        if (cancelado) return;

        console.error("[ficha rival] vídeos de la lista", error);
        setEstado("error");
        setAviso("No se han podido leer los vídeos de esa lista.");
      }
    })();

    return () => {
      cancelado = true;
    };
  }, [abierto, listaId, testigo]);

  /*
  | Primero los suyos.
  |
  | `jugadorDelTitulo` es el mismo emparejamiento del scouting individual: mira
  | el nombre y el dorsal dentro del título. Lo que no se le pueda atribuir no
  | se esconde —un corte del equipo también se cuelga de una ficha— sino que
  | baja.
  */
  const ordenados = useMemo(() => {
    const suyo = { nombre: jugador, dorsal };

    const texto = busca.trim().toLowerCase();

    const filtrados = texto
      ? videos.filter((uno) => uno.titulo.toLowerCase().includes(texto))
      : videos;

    return [...filtrados].sort((a, b) => {
      const sa = jugadorDelTitulo(a.titulo, [suyo]) ? 0 : 1;
      const sb = jugadorDelTitulo(b.titulo, [suyo]) ? 0 : 1;

      return sa - sb;
    });
  }, [videos, jugador, dorsal, busca]);

  const suyos = useMemo(
    () =>
      ordenados.filter((uno) =>
        jugadorDelTitulo(uno.titulo, [{ nombre: jugador, dorsal }]),
      ).length,
    [ordenados, jugador, dorsal],
  );

  if (!abierto) {
    return (
      <button
        type="button"
        onClick={() => setAbierto(true)}
        className="mt-1 inline-flex items-center gap-1.5 rounded-xl border border-white/10 bg-white/[0.03] px-3 py-1.5 text-[11px] text-white/60 transition hover:border-[#C8A96B]/40 hover:text-[#C8A96B]"
      >
        <ListVideo size={12} />
        Elegir de la lista del equipo en YouTube
      </button>
    );
  }

  return (
    <div className="mt-2 rounded-2xl border border-white/10 bg-white/[0.02] p-3">
      <div className="flex flex-wrap items-center gap-2">
        <span className="text-[10px] uppercase tracking-[0.16em] text-white/40">
          Lista del canal
        </span>

        <select
          value={listaId}
          onChange={(e) => setListaId(e.target.value)}
          className="min-w-0 flex-1 rounded-xl border border-white/10 bg-white/[0.04] px-2 py-1.5 text-xs text-white outline-none focus:border-[#C8A96B]/50"
        >
          <option value="" className="bg-[#11161C]">
            {listas.length ? "Elige una lista…" : "—"}
          </option>

          {listas.map((una) => (
            <option key={una.id} value={una.id} className="bg-[#11161C]">
              {una.nombre} ({una.cuenta})
            </option>
          ))}
        </select>

        <button
          type="button"
          onClick={recarga}
          title="Volver a pedir"
          className="rounded-full border border-white/10 p-1.5 text-white/40 transition hover:text-white"
        >
          <RefreshCw size={12} />
        </button>

        <button
          type="button"
          onClick={() => setAbierto(false)}
          className="text-[11px] text-white/40 transition hover:text-white"
        >
          Cerrar
        </button>
      </div>

      {estado === "cargando" && (
        <p className="mt-3 flex items-center gap-2 text-xs text-white/40">
          <Loader2 size={12} className="animate-spin" />
          Pidiendo al canal…
        </p>
      )}

      {(estado === "sin-cuenta" || estado === "error") && (
        <p className="mt-3 text-xs text-[#F6AFB6]">{aviso}</p>
      )}

      {estado === "listo" && listaId && (
        <>
          <label className="mt-3 flex items-center gap-2 rounded-xl border border-white/10 bg-white/[0.03] px-2.5 py-1.5">
            <Search size={12} className="text-white/30" />

            <input
              value={busca}
              onChange={(e) => setBusca(e.target.value)}
              placeholder="Buscar en los títulos…"
              className="min-w-0 flex-1 bg-transparent text-xs text-white outline-none placeholder:text-white/25"
            />
          </label>

          <p className="mt-2 text-[11px] text-white/35">
            {ordenados.length === 0
              ? "Esa lista no tiene vídeos."
              : suyos > 0
                ? `${suyos} parecen de ${jugador}, y van primeros.`
                : `Ninguno lleva el nombre de ${jugador} en el título: van todos, por si alguno es suyo.`}
          </p>

          <ul className="mt-2 max-h-64 space-y-1 overflow-y-auto pr-1">
            {ordenados.map((uno) => {
              const url = `https://youtu.be/${uno.id}`;

              const puesto = valor.includes(uno.id);

              const esSuyo = Boolean(
                jugadorDelTitulo(uno.titulo, [{ nombre: jugador, dorsal }]),
              );

              return (
                <li key={uno.id}>
                  <div
                    className={`flex items-center gap-2 rounded-xl border px-2 py-1.5 transition ${
                      puesto
                        ? "border-[#C8A96B]/40 bg-[#C8A96B]/10"
                        : "border-white/10 bg-white/[0.02] hover:border-white/20"
                    }`}
                  >
                    <button
                      type="button"
                      onClick={() => onElegir(url)}
                      className="flex min-w-0 flex-1 items-center gap-2 text-left"
                    >
                      {puesto ? (
                        <Check size={12} className="shrink-0 text-[#C8A96B]" />
                      ) : (
                        <ListVideo
                          size={12}
                          className={`shrink-0 ${esSuyo ? "text-[#C8A96B]/70" : "text-white/25"}`}
                        />
                      )}

                      <span
                        className={`truncate text-xs ${puesto ? "text-[#C8A96B]" : "text-white/70"}`}
                        title={uno.titulo}
                      >
                        {uno.titulo}
                      </span>
                    </button>

                    <a
                      href={url}
                      target="_blank"
                      rel="noopener noreferrer"
                      title="Abrir en YouTube"
                      className="shrink-0 text-white/30 transition hover:text-white"
                    >
                      <ExternalLink size={12} />
                    </a>
                  </div>
                </li>
              );
            })}
          </ul>
        </>
      )}
    </div>
  );
}
