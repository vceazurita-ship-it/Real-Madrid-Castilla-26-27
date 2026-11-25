"use client";

/**
 * LABORATORIO DE CLIPS INDIVIDUALES PROPIOS (26/11/2026) · sólo administrador.
 *
 * Petición del analista: «todos los clips de Cestero, Sergio, Rober y el que
 * juegue de 10 de cada partido que vayamos jugando… que se pueda ir pasando de
 * clip y se puedan descargar todos o algunos», con la carátula del club y sus
 * números de ese partido. Lo monta scripts/opta-clips-castilla.mjs tras cada
 * partido; aquí:
 * - el partido (pestañas, el último primero) y el jugador;
 * - su carátula con los números del partido;
 * - el reproductor clip a clip (anterior/siguiente, flechas del teclado,
 *   «seguidos» para que pase solo al siguiente);
 * - filtro con balón / sin balón / pérdidas;
 * - la lista con casillas: descargar los elegidos, todos, el vídeo completo
 *   (carátula + todos) o la carátula.
 *
 * El candado está en layout.tsx (servidor), en la API (/api/opta/clips-castilla)
 * y en /api/video (la carpeta `privado/` sólo para el administrador). Lo nuevo
 * aparece sin publicar nada: la página lee el documento en cada visita.
 */

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { ChevronLeft, ChevronRight, Download, Film, ListChecks, Repeat, SquareCheck, Square } from "lucide-react";

import { Sidebar } from "@/components/ui/sidebar";
import { Topbar } from "@/components/ui/topbar";
import { AbpHeader } from "@/components/abp/ui";
import { useEscudos } from "@/components/data/graficas";
import { enApp, minutoClip, type CategoriaClip, type ClipPropio, type DocClipsCastilla } from "@/lib/opta-clips-castilla";

const FILTROS: { key: "todos" | CategoriaClip | "conBalon"; label: string }[] = [
  { key: "todos", label: "Todos" },
  { key: "conBalon", label: "Con balón" },
  { key: "sinBalon", label: "Sin balón" },
  { key: "perdida", label: "Pérdidas" },
];
const COLOR_CAT: Record<CategoriaClip, string> = { balon: "#3FBF9B", mixta: "#C8A96B", sinBalon: "#4F8FE8", perdida: "#E8735F" };
const pasa = (c: ClipPropio, f: (typeof FILTROS)[number]["key"]) =>
  f === "todos" || (f === "conBalon" ? c.cat === "balon" || c.cat === "mixta" : f === "sinBalon" ? c.cat === "sinBalon" || c.cat === "mixta" : c.cat === f);

const fechaCorta = (iso: string) => (iso ? iso.slice(5, 10).split("-").reverse().join("/") : "");
const limpio = (t: string) => t.normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[^a-zA-Z0-9]+/g, "-").replace(/^-|-$/g, "").toLowerCase();

/** Una descarga detrás de otra (el navegador pide permiso una vez para «varias descargas»). */
async function descarga(lista: { ruta: string; nombre: string }[]) {
  for (const [i, f] of lista.entries()) {
    const a = document.createElement("a");
    a.href = enApp(f.ruta, f.nombre);
    a.rel = "noopener";
    document.body.appendChild(a);
    a.click();
    a.remove();
    if (i < lista.length - 1) await new Promise((ok) => setTimeout(ok, 700));
  }
}

export default function ClipsPropiosPage() {
  const [doc, setDoc] = useState<DocClipsCastilla | null>(null);
  const [error, setError] = useState("");
  const [partidoId, setPartidoId] = useState("");
  const [jugadorId, setJugadorId] = useState("");
  const [filtro, setFiltro] = useState<(typeof FILTROS)[number]["key"]>("todos");
  const [actual, setActual] = useState(0);
  const [seguidos, setSeguidos] = useState(true);
  const [elegidos, setElegidos] = useState<Set<number>>(new Set());
  const video = useRef<HTMLVideoElement>(null);
  const escudoDe = useEscudos();

  useEffect(() => {
    let vivo = true;
    fetch("/api/opta/clips-castilla", { cache: "no-store" })
      .then((r) => r.json())
      .then((j) => {
        if (!vivo) return;
        if (j?.ok) setDoc(j.doc);
        else setError(j?.error ?? "No se ha podido leer.");
      })
      .catch(() => vivo && setError("No se ha podido leer."));
    return () => {
      vivo = false;
    };
  }, []);

  const partido = doc?.partidos.find((p) => p.partido === partidoId) ?? doc?.partidos[0];
  const jugador = partido?.jugadores.find((j) => j.playerId === jugadorId) ?? partido?.jugadores[0];
  const visibles = useMemo(() => (jugador?.clips ?? []).filter((c) => pasa(c, filtro)), [jugador, filtro]);
  const clip = visibles[Math.min(actual, Math.max(visibles.length - 1, 0))];

  /* Al cambiar de jugador, de partido o de filtro: al primero y sin elegidos. */
  const cambia = (f: () => void) => {
    f();
    setActual(0);
    setElegidos(new Set());
  };

  const ve = useCallback((i: number) => setActual(Math.max(0, Math.min(i, visibles.length - 1))), [visibles.length]);

  /* Flechas del teclado: anterior / siguiente; espacio, pausa. */
  useEffect(() => {
    const tecla = (e: KeyboardEvent) => {
      if ((e.target as HTMLElement)?.closest("input, textarea, select")) return;
      if (e.key === "ArrowRight") ve(actual + 1);
      else if (e.key === "ArrowLeft") ve(actual - 1);
      else return;
      e.preventDefault();
    };
    window.addEventListener("keydown", tecla);
    return () => window.removeEventListener("keydown", tecla);
  }, [actual, ve]);

  const base = jugador && partido ? `${limpio(jugador.nombre)}_vs-${limpio(partido.rival)}_${partido.fecha}` : "clip";
  const nombreClip = (c: ClipPropio) => `${base}_${String(c.n).padStart(3, "0")}_${minutoClip(c.segundo).replace("'", "min")}_${limpio(c.que).slice(0, 40)}.mp4`;
  const todosElegidos = visibles.length > 0 && visibles.every((c) => elegidos.has(c.n));

  return (
    <main className="min-h-screen bg-[#0B0F14] text-white">
      <div className="flex">
        <Sidebar />
        <section className="flex min-w-0 flex-1 flex-col">
          <Topbar />
          <div className="min-w-0 px-4 py-6 sm:px-6 lg:px-10">
            <AbpHeader
              area="Laboratorio de clips individuales propios · Sólo administrador"
              title="Clips de los nuestros, partido a partido"
              lead="Todas las acciones de Cestero, Sergio Martínez, Roberto Martín y el que juegue de 10, sacadas del vídeo de Opta tras cada partido. Pasa de clip con las flechas, filtra con o sin balón y descarga los que quieras, todos o el vídeo completo con la carátula y sus números del partido."
            />

            {error && <p className="mt-4 rounded-xl border border-red-400/30 bg-red-500/10 p-3 text-sm text-red-200">{error}</p>}
            {!doc && !error && <div className="mt-6 h-40 animate-pulse rounded-2xl bg-white/[0.05]" />}
            {doc && !doc.partidos.length && (
              <p className="mt-6 rounded-2xl border border-white/10 bg-white/[0.03] p-4 text-sm text-white/70">
                Todavía no hay clips: se sacan la noche del partido o a las 6:00 del día siguiente (o a mano con <code>node scripts/opta-clips-castilla.mjs</code>).
              </p>
            )}

            {partido && (
              <>
                {/* Partidos: el último primero. */}
                <div className="mt-5 flex flex-wrap items-center gap-2">
                  {doc!.partidos.map((p) => {
                    const on = p.partido === partido.partido;
                    const escudo = escudoDe(p.rival);
                    return (
                      <button
                        key={p.partido}
                        type="button"
                        onClick={() => cambia(() => {
                          setPartidoId(p.partido);
                          setJugadorId("");
                        })}
                        className={`inline-flex min-h-10 items-center gap-2 rounded-full border px-3.5 py-1.5 text-sm font-semibold transition ${
                          on ? "border-[#C8A96B]/70 bg-[#C8A96B]/15 text-white" : "border-white/15 text-white/65 hover:text-white"
                        }`}
                      >
                        {escudo ? <img src={escudo} alt="" className="h-5 w-5 object-contain" /> : <Film className="h-4 w-4" />}
                        vs {p.rival} · {fechaCorta(p.fecha)}
                        <span className="tabular-nums text-white/50">{p.marcador}</span>
                      </button>
                    );
                  })}
                </div>

                {/* Jugadores del partido. */}
                <div className="mt-3 flex flex-wrap gap-2">
                  {partido.jugadores.map((j) => {
                    const on = j.playerId === jugador?.playerId;
                    return (
                      <button
                        key={j.playerId}
                        type="button"
                        onClick={() => cambia(() => setJugadorId(j.playerId))}
                        className={`min-h-12 rounded-xl border px-3 py-1.5 text-left transition ${
                          on ? "border-white/50 bg-white/[0.09]" : "border-white/10 bg-white/[0.025] hover:border-white/30"
                        }`}
                      >
                        <span className="block text-sm font-bold text-white">{j.nombre}</span>
                        <span className="block text-[11px] text-white/55">
                          {j.rol} · {j.minutos}&apos; · {j.clips.length} clips
                        </span>
                      </button>
                    );
                  })}
                </div>

                {jugador && (
                  <div className="mt-5 grid min-w-0 grid-cols-1 gap-5 lg:grid-cols-[minmax(0,1fr)_320px] xl:grid-cols-[minmax(0,1fr)_380px]">
                    {/* Reproductor clip a clip. */}
                    <section className="min-w-0">
                      <div className="overflow-hidden rounded-2xl border border-white/10 bg-black">
                        {clip ? (
                          <video
                            key={clip.ruta}
                            ref={video}
                            src={enApp(clip.ruta)}
                            controls
                            autoPlay
                            playsInline
                            preload="auto"
                            className="aspect-video w-full"
                            onEnded={() => seguidos && actual < visibles.length - 1 && ve(actual + 1)}
                          />
                        ) : (
                          <div className="grid aspect-video place-items-center text-sm text-white/50">Ningún clip con este filtro.</div>
                        )}
                      </div>
                      <div className="mt-3 flex flex-wrap items-center gap-2">
                        <button type="button" onClick={() => ve(actual - 1)} disabled={actual <= 0} className="inline-flex min-h-10 items-center gap-1 rounded-lg border border-white/15 px-3 text-sm font-semibold disabled:opacity-35">
                          <ChevronLeft className="h-4 w-4" /> Anterior
                        </button>
                        <button type="button" onClick={() => ve(actual + 1)} disabled={actual >= visibles.length - 1} className="inline-flex min-h-10 items-center gap-1 rounded-lg border border-white/15 px-3 text-sm font-semibold disabled:opacity-35">
                          Siguiente <ChevronRight className="h-4 w-4" />
                        </button>
                        <span className="tabular-nums text-sm text-white/60">
                          {visibles.length ? actual + 1 : 0} / {visibles.length}
                        </span>
                        {clip && (
                          <span className="min-w-0 truncate text-sm font-semibold text-[#E2CB94]">
                            {minutoClip(clip.segundo)} · {clip.que}
                          </span>
                        )}
                        <label className="ml-auto inline-flex min-h-10 cursor-pointer items-center gap-2 text-[13px] text-white/70">
                          <input type="checkbox" checked={seguidos} onChange={(e) => setSeguidos(e.target.checked)} className="h-4 w-4 accent-[#C8A96B]" />
                          <Repeat className="h-3.5 w-3.5" /> Seguidos
                        </label>
                      </div>
                      <p className="mt-1 text-[11px] text-white/40"><span className="max-md:hidden">Flechas ← → del teclado para pasar de clip. </span>Con «Seguidos», al acabar uno empieza el siguiente.</p>

                      {/* Descargas. */}
                      <div className="mt-4 flex flex-wrap gap-2">
                        <button
                          type="button"
                          disabled={!elegidos.size}
                          onClick={() => void descarga(visibles.filter((c) => elegidos.has(c.n)).map((c) => ({ ruta: c.ruta, nombre: nombreClip(c) })))}
                          className="inline-flex min-h-10 items-center gap-1.5 rounded-lg bg-[#C8A96B] px-3.5 text-sm font-bold text-[#0B0F14] disabled:opacity-40"
                        >
                          <Download className="h-4 w-4" /> Descargar elegidos ({elegidos.size})
                        </button>
                        <button
                          type="button"
                          onClick={() => void descarga(visibles.map((c) => ({ ruta: c.ruta, nombre: nombreClip(c) })))}
                          className="inline-flex min-h-10 items-center gap-1.5 rounded-lg border border-white/20 px-3.5 text-sm font-semibold"
                        >
                          <Download className="h-4 w-4" /> Todos los clips ({visibles.length})
                        </button>
                        {jugador.completo && (
                          <button
                            type="button"
                            onClick={() => void descarga([{ ruta: jugador.completo!.ruta, nombre: `${base}_completo.mp4` }])}
                            className="inline-flex min-h-10 items-center gap-1.5 rounded-lg border border-white/20 px-3.5 text-sm font-semibold"
                            title="La carátula y todos sus clips en un solo vídeo"
                          >
                            <Film className="h-4 w-4" /> Vídeo completo · {Math.floor(jugador.completo.segundos / 60)}:{String(jugador.completo.segundos % 60).padStart(2, "0")}
                          </button>
                        )}
                      </div>
                    </section>

                    {/* Carátula, filtro y lista. */}
                    <aside className="min-w-0">
                      {jugador.caratula && (
                        <button
                          type="button"
                          onClick={() => void descarga([{ ruta: jugador.caratula!.ruta, nombre: `${base}_caratula.jpg` }])}
                          className="block w-full overflow-hidden rounded-xl border border-white/10"
                          title="Descargar la carátula"
                        >
                          <img src={enApp(jugador.caratula.ruta)} alt={`Carátula de ${jugador.nombre}`} className="aspect-video w-full object-cover" />
                        </button>
                      )}

                      <div className="mt-3 flex flex-wrap gap-1.5">
                        {FILTROS.map((f) => {
                          const n = (jugador.clips ?? []).filter((c) => pasa(c, f.key)).length;
                          return (
                            <button
                              key={f.key}
                              type="button"
                              onClick={() => cambia(() => setFiltro(f.key))}
                              className={`min-h-9 rounded-full border px-3 text-[12px] font-semibold ${filtro === f.key ? "border-[#C8A96B]/70 bg-[#C8A96B]/15 text-white" : "border-white/10 text-white/65 hover:text-white"}`}
                            >
                              {f.label} <span className="tabular-nums text-white/45">{n}</span>
                            </button>
                          );
                        })}
                      </div>

                      <div className="mt-3 flex items-center justify-between text-[12px] text-white/60">
                        <button
                          type="button"
                          onClick={() => setElegidos(todosElegidos ? new Set() : new Set(visibles.map((c) => c.n)))}
                          className="inline-flex min-h-9 items-center gap-1.5 font-semibold hover:text-white"
                        >
                          <ListChecks className="h-4 w-4" /> {todosElegidos ? "Quitar todos" : "Elegir todos"}
                        </button>
                        <span>{elegidos.size} elegidos</span>
                      </div>

                      <ol className="mt-1 max-h-[60vh] space-y-1 overflow-y-auto overscroll-contain pr-1 max-lg:max-h-[50vh]">
                        {visibles.map((c, i) => {
                          const on = elegidos.has(c.n);
                          return (
                            <li key={c.n}>
                              <div className={`flex items-center gap-2 rounded-lg border px-2 py-1.5 ${i === actual ? "border-[#C8A96B]/60 bg-[#C8A96B]/10" : "border-white/[0.06] bg-white/[0.02]"}`}>
                                <button
                                  type="button"
                                  aria-label={on ? "Quitar de los elegidos" : "Elegir para descargar"}
                                  onClick={() =>
                                    setElegidos((s) => {
                                      const n = new Set(s);
                                      if (n.has(c.n)) n.delete(c.n);
                                      else n.add(c.n);
                                      return n;
                                    })
                                  }
                                  className="grid h-8 w-8 shrink-0 place-items-center text-white/70 hover:text-white"
                                >
                                  {on ? <SquareCheck className="h-4 w-4 text-[#C8A96B]" /> : <Square className="h-4 w-4" />}
                                </button>
                                <button type="button" onClick={() => ve(i)} className="flex min-w-0 flex-1 items-center gap-2 text-left text-[12.5px]">
                                  <span className="h-2 w-2 shrink-0 rounded-full" style={{ background: COLOR_CAT[c.cat] }} />
                                  <span className="w-9 shrink-0 tabular-nums text-white/50">{minutoClip(c.segundo)}</span>
                                  <span className="min-w-0 truncate text-white/85">{c.que}</span>
                                  <span className="ml-auto shrink-0 tabular-nums text-white/35">{Math.round(c.dura)}s</span>
                                </button>
                              </div>
                            </li>
                          );
                        })}
                      </ol>
                    </aside>
                  </div>
                )}
              </>
            )}
          </div>
        </section>
      </div>
    </main>
  );
}
