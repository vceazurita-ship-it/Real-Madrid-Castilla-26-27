"use client";

/**
 * Scout individual del rival: los cortes de nuestro canal, jugador a jugador.
 *
 * Antes esta pantalla era una videoteca de clips de Hudl apuntados en una hoja:
 * seis desplegables de facetas, un buscador y trescientas fichas. Se ha quitado
 * (11/09/2026). El material con el que de verdad se prepara un rival es el que
 * montamos nosotros en `/coding`, que acaba en el canal de YouTube con **una
 * lista por equipo**, y tenerlo en otra pestaña del navegador —con la hoja de
 * Hudl al lado como segunda fuente— era pedirle al analista que eligiera entre
 * dos sitios cada vez.
 *
 * Así que aquí sólo hay una cosa, y se entra por donde se piensa: **primero el
 * rival, después el jugador**. El equipo se elige arriba con su escudo, y
 * debajo están sus vídeos repartidos por jugador (`VideosDelCanal`).
 */

import Link from "next/link";
import { useEffect, useMemo, useState, useSyncExternalStore } from "react";
import { Search, Users } from "lucide-react";

import { EsqueletoPantalla, EstadoVacio } from "@/components/ui/estados";
import { Sidebar } from "@/components/ui/sidebar";
import { Topbar } from "@/components/ui/topbar";
import { EscudoEquipo } from "@/components/rivals/EscudoEquipo";
import { ChapaJornada } from "@/components/rivals/ChapaJornada";
import { VideosDelCanal } from "@/components/rivals/VideosDelCanal";
import { AvisoLento } from "@/components/rivals/AvisoLento";
import { useEscudos } from "@/hooks/useEscudos";
import { useLento } from "@/hooks/useLento";
import { useRivalSquads } from "@/hooks/useRivalSquads";
import { useRivalStats } from "@/hooks/useRivalStats";
import { traeJson } from "@/lib/hojaCsv";
import { findStats, highlightSeason } from "@/lib/rivals/stats";
import { normalizarOnce, playerKey, rivalOnceKey } from "@/lib/rivals/once";
import {
  SIN_ORDEN,
  cargaOrdenRivales,
  comparaPorCalendario,
  esElProximo,
  etiquetaDelProximo,
  jornadaDeEquipo,
  type OrdenRivales,
} from "@/lib/rivals/orden-calendario";
import { Explicativo } from "@/components/ui/textos-analisis";
import { mismoClub } from "@/lib/rivals/mismoClub";

/*
| `?equipo=<NOMBRE>` (26/10/2026): desde la ficha del rival o la portada se
| llega con el equipo puesto. Se lee como en el microciclo ABP, con
| `useSyncExternalStore` y la instantánea de servidor vacía: sin `Suspense` y
| sin desajuste al hidratar.
*/
const leeEquipoEnlazado = () => new URLSearchParams(window.location.search).get("equipo") ?? "";

const sinEquipoEnlazado = () => "";

function seSabraAlLlegar(avisa: () => void) {
  const aviso = setTimeout(avisa, 0);

  return () => clearTimeout(aviso);
}

export default function ScoutRivalIndividual() {
  const escudoDe = useEscudos();

  const { squads, loading, error, reintenta } = useRivalSquads();

  const lento = useLento(loading);

  const [equipoPedido, setEquipoPedido] = useState("");
  const [buscaEquipo, setBuscaEquipo] = useState("");

  /*
  | El orden de la fila es el del calendario, no el alfabeto.
  |
  | Es la misma regla que `/rivals` —a cada equipo, la fecha de su siguiente
  | partido— y por el mismo motivo: al preparar la semana se busca al rival que
  | toca, y en una fila alfabética está donde caiga. `cargaOrdenRivales` nunca
  | lanza: sin calendario, todos quedan empatados y vuelve el alfabeto.
  |
  | `claveDeHoy()` mira el reloj, así que va dentro del efecto y no en el cuerpo
  | del componente (ver la regla de pureza de React).
  */
  const [orden, setOrden] = useState<OrdenRivales>(SIN_ORDEN);

  /* Ya se sabe el orden (o que no se va a saber: `cargaOrdenRivales` no lanza). */
  const [ordenListo, setOrdenListo] = useState(false);

  useEffect(() => {
    const control = new AbortController();

    void cargaOrdenRivales(control.signal).then((leido) => {
      if (control.signal.aborted) return;

      setOrden(leido);
      setOrdenListo(true);
    });

    return () => control.abort();
  }, []);

  const equipos = useMemo(
    () =>
      squads
        .map((squad) => squad.equipo)
        .filter(Boolean)
        .sort(comparaPorCalendario(orden)),
    [squads, orden],
  );

  /* Sin pedir ninguno, el de por defecto es el primero POR CALENDARIO: hasta
     que llega el orden no se elige, o se montaban y pedían a YouTube los
     vídeos del primero por alfabeto y luego se cambiaba (19/10/2026). */
  const equipoEnlazado = useSyncExternalStore(seSabraAlLlegar, leeEquipoEnlazado, sinEquipoEnlazado);

  /* El de la URL manda sobre el del calendario, si está en las plantillas. */
  const delEnlace = equipoEnlazado
    ? (equipos.find((e) => e === equipoEnlazado) ?? equipos.find((e) => mismoClub(e, equipoEnlazado)) ?? "")
    : "";

  const equipo = equipoPedido || delEnlace || (ordenListo ? equipos[0] : "") || "";

  /* La tira de escudos se filtra al teclear: con treinta y ocho equipos,
     buscar el escudo a ojo es más lento que escribir tres letras. */
  const visibles = useMemo(() => {
    const termino = buscaEquipo.trim().toLowerCase();

    if (!termino) return equipos;

    return equipos.filter((nombre) => nombre.toLowerCase().includes(termino));
  }, [buscaEquipo, equipos]);

  /*
  | Las etiquetas de cada jugador (campo IMPACTO de la hoja, separadas por «;»),
  | para decir bajo cada corte qué mirar de él. La hoja ya está en la copia del
  | aparato: `traeJson` no vuelve a pedirla.
  */
  const [etiquetasDe, setEtiquetasDe] = useState<Record<string, string[]>>({});

  /* Su clave de jugador (la del once marcado), por «equipo|nombre». */
  const [clavesDe, setClavesDe] = useState<Record<string, string>>({});

  /* La fila de la hoja de cada jugador, para cruzarla con sus números de BeSoccer. */
  const [filasDe, setFilasDe] = useState<Record<string, Record<string, unknown>>>({});

  const { doc: statsDoc } = useRivalStats();

  /* Los titulares del once probable marcado en Plantillas rivales (sólo se lee). */
  const [titularesDe, setTitularesDe] = useState<{ equipo: string; claves: string[] }>({ equipo: "", claves: [] });

  useEffect(() => {
    if (!equipo) return;

    let vivo = true;

    fetch(`/api/docs?key=${encodeURIComponent(rivalOnceKey(equipo))}`, { cache: "no-store" })
      .then((r) => r.json() as Promise<{ data?: unknown }>)
      .then((j) => {
        if (vivo) setTitularesDe({ equipo, claves: normalizarOnce(j?.data ?? null).titulares });
      })
      .catch(() => undefined);

    return () => {
      vivo = false;
    };
  }, [equipo]);

  useEffect(() => {
    let cancelado = false;

    traeJson<unknown>("/api/rivals?action=rivalesPlantillas")
      .then((filas) => {
        if (cancelado || !Array.isArray(filas)) return;

        const mapa: Record<string, string[]> = {};
        const claves: Record<string, string> = {};
        const filasPorClave: Record<string, Record<string, unknown>> = {};

        for (const fila of filas as Record<string, unknown>[]) {
          const nombre = String(fila["NOMBRE DEPORTIVO"] ?? "").trim() || String(fila.JUGADOR ?? "").trim();
          const etiquetas = String(fila.IMPACTO ?? "")
            .split(";")
            .map((e) => e.trim())
            .filter(Boolean);

          if (nombre && etiquetas.length) mapa[`${String(fila.NOMBRE_EQUIPO ?? "").trim()}|${nombre}`] = etiquetas;
          if (nombre) claves[`${String(fila.NOMBRE_EQUIPO ?? "").trim()}|${nombre}`] = playerKey(fila);
          if (nombre) filasPorClave[`${String(fila.NOMBRE_EQUIPO ?? "").trim()}|${nombre}`] = fila;
        }

        setEtiquetasDe(mapa);
        setClavesDe(claves);
        setFilasDe(filasPorClave);
      })
      .catch(() => undefined);

    return () => {
      cancelado = true;
    };
  }, []);

  const plantilla = useMemo(
    () =>
      (squads.find((squad) => squad.equipo === equipo)?.players ?? []).map((jugador) => {
        const fila = filasDe[`${equipo}|${jugador.nombre}`];
        const stats = fila ? findStats(statsDoc, fila) : null;
        const temporada = stats ? highlightSeason(stats.temporadas, statsDoc?.temporada) : null;

        return {
        partidos: temporada?.partidos,
        titularidades: temporada?.titular,
        minutos: temporada?.minutos,
        nombre: jugador.nombre,
        dorsal: jugador.dorsal,
        puesto: jugador.posicion,
        etiquetas: etiquetasDe[`${equipo}|${jugador.nombre}`] ?? [],
        titular:
          titularesDe.equipo === equipo && titularesDe.claves.includes(clavesDe[`${equipo}|${jugador.nombre}`] ?? "\u0000"),
        };
      }),
    [squads, equipo, etiquetasDe, clavesDe, titularesDe, filasDe, statsDoc],
  );

  return (
    <div className="flex min-h-screen bg-[#0B0F14] text-white">
      <Sidebar />

      <main className="min-w-0 flex-1">
        <Topbar />

        <div className="p-4 sm:p-6 md:p-10">
          {/* --------------------------- CABECERA -------------------------- */}

          <header className="min-w-0">
            <p className="text-xs uppercase tracking-[0.3em] text-[#C8A96B]">
              RMCF CASTILLA · SCOUTING
            </p>

            <h1 className="mt-2 text-3xl font-bold sm:text-4xl">
              Vídeos del rival
            </h1>

            <Explicativo>
            <p className="mt-3 max-w-2xl text-white/60">
              Los cortes que montamos en el coding, repartidos por jugador. Cada
              rival tiene su lista en nuestro canal y aquí se ve sin salir de la
              plataforma.
            </p>
            </Explicativo>
            <p className="mt-3 max-w-2xl text-white/60">Los cortes de cada rival, jugador a jugador.</p>
          </header>

          {/* Si la hoja tarda más de 25 s, o falla, se dice y se deja reintentar. */}
          {(lento || (error && !loading)) && (
            <AvisoLento className="mt-6" onReintentar={reintenta} />
          )}

          {/* ---------------------- A QUIÉN SE MIRA ------------------------ */}

          <section className="mt-6 min-w-0 rounded-3xl border border-white/10 bg-white/[0.03] p-4 sm:p-5">
            <div className="flex flex-wrap items-center gap-3">
              <span className="flex items-center gap-2 text-[10px] uppercase tracking-[0.18em] text-white/40">
                <Users size={13} />
                Rival
              </span>

              <div className="relative min-w-0 flex-1 sm:max-w-xs">
                <Search
                  size={14}
                  className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-white/30"
                />

                <input
                  value={buscaEquipo}
                  onChange={(evento) => setBuscaEquipo(evento.target.value)}
                  placeholder="Filtrar equipos…"
                  className="w-full rounded-xl border border-white/10 bg-white/[0.04] py-2 pl-9 pr-3 text-sm text-white outline-none transition placeholder:text-white/25 focus:border-[#C8A96B]/50"
                />
              </div>

              <span className="text-[11px] tabular-nums text-white/30">
                {loading ? "" : `${visibles.length} de ${equipos.length}`}
              </span>

              {/* Su plantilla, con las fichas de cada jugador. */}
              {equipo && (
                <Link
                  href={`/rivals?equipo=${encodeURIComponent(equipo)}`}
                  className="ml-auto text-[11px] text-[#C8A96B] transition hover:underline"
                >
                  Plantilla y fichas de {equipo} →
                </Link>
              )}
            </div>

            {/*
              Una tira de escudos y no un desplegable: el escudo se reconoce
              antes que el nombre, y con el desplegable había que abrirlo,
              leer treinta y ocho líneas y acertar. Se desplaza en horizontal
              para no comerse media pantalla con la lista entera.
            */}
            <div className="mt-3 flex gap-2 overflow-x-auto pb-1">
              {loading && equipos.length === 0 && (
                <div className="flex gap-2">
                  {Array.from({ length: 8 }).map((_, i) => (
                    <div
                      key={i}
                      className="h-[70px] w-[104px] shrink-0 animate-pulse rounded-2xl border border-white/10 bg-white/[0.03]"
                    />
                  ))}
                </div>
              )}

              {visibles.map((nombre) => {
                const activo = nombre === equipo;

                /* El primero de la fila lleva chapa, y sólo con fecha delante:
                   sin ella, ser el primero es una suposición. */
                const proximo = esElProximo(orden, nombre);

                return (
                  <button
                    key={nombre}
                    type="button"
                    onClick={() => setEquipoPedido(nombre)}
                    title={
                      proximo
                        ? `${nombre} — ${etiquetaDelProximo(orden) ?? "próximo partido"}`
                        : nombre
                    }
                    aria-current={activo ? "true" : undefined}
                    className={`relative flex w-[104px] shrink-0 flex-col items-center gap-1.5 rounded-2xl border px-2 py-2.5 transition ${
                      activo
                        ? "border-[#C8A96B]/60 bg-[#C8A96B]/10"
                        : "border-white/10 bg-white/[0.02] hover:border-white/25"
                    }`}
                  >
                    {proximo && (
                      <span className="absolute -top-1.5 rounded-full bg-[#C8A96B] px-1.5 py-px text-[8px] font-bold uppercase tracking-wider text-black">
                        Próximo
                      </span>
                    )}

                    <EscudoEquipo nombre={nombre} escudo={escudoDe(nombre)} lado={26} />

                    <span
                      className={`line-clamp-2 text-center text-[10px] leading-tight ${
                        activo ? "text-[#C8A96B]" : "text-white/55"
                      }`}
                    >
                      {nombre}
                    </span>

                    <ChapaJornada jornada={jornadaDeEquipo(orden, nombre)} activo={activo} />
                  </button>
                );
              })}

              {!loading && visibles.length === 0 && (
                <p className="py-4 text-xs text-white/35">
                  Ningún equipo se llama así.
                </p>
              )}
            </div>
          </section>

          {/* ---------------------------- VÍDEOS --------------------------- */}

          <div className="mt-6 min-w-0">
            {equipo ? (
              <VideosDelCanal
                /* Se remonta al cambiar de rival: la lista, los vídeos y el
                   buscador son otros, y arrastrar el estado del anterior
                   enseñaría un instante los cortes de quien no es. */
                key={equipo}
                equipo={equipo}
                plantilla={plantilla}
              />
            ) : loading || !ordenListo ? (
              <EsqueletoPantalla titulo="las plantillas rivales" cifras={0} paneles={1} />
            ) : (
              <EstadoVacio icon={Users} titulo="No hay plantillas rivales en la hoja todavía." />
            )}
          </div>
        </div>
      </main>
    </div>
  );
}
