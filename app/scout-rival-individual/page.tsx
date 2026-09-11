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

import { useMemo, useState } from "react";
import { Search, Users } from "lucide-react";

import { Sidebar } from "@/components/ui/sidebar";
import { Topbar } from "@/components/ui/topbar";
import { EscudoEquipo } from "@/components/rivals/EscudoEquipo";
import { VideosDelCanal } from "@/components/rivals/VideosDelCanal";
import { useEscudos } from "@/hooks/useEscudos";
import { useRivalSquads } from "@/hooks/useRivalSquads";

export default function ScoutRivalIndividual() {
  const escudoDe = useEscudos();

  const { squads, loading } = useRivalSquads();

  const [equipoPedido, setEquipoPedido] = useState("");
  const [buscaEquipo, setBuscaEquipo] = useState("");

  const equipos = useMemo(
    () =>
      squads
        .map((squad) => squad.equipo)
        .filter(Boolean)
        .sort((a, b) => a.localeCompare(b, "es")),
    [squads],
  );

  const equipo = equipoPedido || equipos[0] || "";

  /* La tira de escudos se filtra al teclear: con treinta y ocho equipos,
     buscar el escudo a ojo es más lento que escribir tres letras. */
  const visibles = useMemo(() => {
    const termino = buscaEquipo.trim().toLowerCase();

    if (!termino) return equipos;

    return equipos.filter((nombre) => nombre.toLowerCase().includes(termino));
  }, [buscaEquipo, equipos]);

  const plantilla = useMemo(
    () =>
      (squads.find((squad) => squad.equipo === equipo)?.players ?? []).map(
        (jugador) => ({ nombre: jugador.nombre, dorsal: jugador.dorsal }),
      ),
    [squads, equipo],
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

            <p className="mt-3 max-w-2xl text-white/60">
              Los cortes que montamos en el coding, repartidos por jugador. Cada
              rival tiene su lista en nuestro canal y aquí se ve sin salir de la
              plataforma.
            </p>
          </header>

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
                {loading
                  ? "cargando plantillas…"
                  : `${visibles.length} de ${equipos.length}`}
              </span>
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

                return (
                  <button
                    key={nombre}
                    type="button"
                    onClick={() => setEquipoPedido(nombre)}
                    title={nombre}
                    aria-current={activo ? "true" : undefined}
                    className={`flex w-[104px] shrink-0 flex-col items-center gap-1.5 rounded-2xl border px-2 py-2.5 transition ${
                      activo
                        ? "border-[#C8A96B]/60 bg-[#C8A96B]/10"
                        : "border-white/10 bg-white/[0.02] hover:border-white/25"
                    }`}
                  >
                    <EscudoEquipo nombre={nombre} escudo={escudoDe(nombre)} lado={26} />

                    <span
                      className={`line-clamp-2 text-center text-[10px] leading-tight ${
                        activo ? "text-[#C8A96B]" : "text-white/55"
                      }`}
                    >
                      {nombre}
                    </span>
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
            ) : (
              <p className="rounded-3xl border border-white/10 bg-white/[0.02] px-4 py-10 text-center text-sm text-white/40">
                {loading
                  ? "Cargando las plantillas rivales…"
                  : "No hay plantillas rivales en la hoja todavía."}
              </p>
            )}
          </div>
        </div>
      </main>
    </div>
  );
}
