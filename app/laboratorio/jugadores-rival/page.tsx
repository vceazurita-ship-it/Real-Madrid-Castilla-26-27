"use client";

/**
 * VÍDEO DE LOS JUGADORES RIVALES POR SUS FORTALEZAS (24/11/2026) · sólo administrador.
 *
 * Petición del analista: los cortes de Opta de cada jugador del rival, según
 * sus fortalezas, como mucho 2 minutos y de sus últimos partidos, «en una
 * sección que sólo vea yo». Lo monta la noche del lunes scripts/opta-clips-jugador.mjs
 * (el rival de la próxima jornada); aquí se ve:
 * - el rival (pestañas, el próximo primero) y sus últimos partidos;
 * - una tarjeta por jugador: puesto, minutos, sus fortalezas como barra de
 *   percentil contra su línea en la categoría, el vídeo y la lista de cortes
 *   (pinchar uno salta a ese momento del vídeo);
 * - los RASGOS DE SU PUESTO (25/11/2026, «no solo de sus mayores fortalezas
 *   sino también de cosas específicas de posición»): hacia dónde regatea,
 *   desde dónde centra, cómo remata, qué hace tras robo, si arriesga en su
 *   campo… con sus cifras; y el vídeo por capítulos (pastillas que saltan);
 * - debajo, los que no tienen vídeo y por qué.
 *
 * El candado está en layout.tsx (servidor), en la API (/api/opta/clips-jugador)
 * y en /api/video (la carpeta `privado/` sólo para el administrador).
 */

import { useEffect, useMemo, useRef, useState } from "react";
import { Clapperboard, Film, Play } from "lucide-react";

import { Sidebar } from "@/components/ui/sidebar";
import { Topbar } from "@/components/ui/topbar";
import { AbpHeader } from "@/components/abp/ui";
import { useEscudos } from "@/components/data/graficas";
import { minutoDe, type ClipsJugador, type CorteJugador, type DocClipsJugador } from "@/lib/opta-clips-jugador";

/* Un color por fortaleza, el mismo en la barra, la etiqueta y el corte. */
const COLOR: Record<string, string> = {
  remate: "#E8735F",
  regate: "#A98BF0",
  ultimoPase: "#C8A96B",
  centro: "#4F8FE8",
  progresion: "#3FBF9B",
  aereo: "#6FC3E8",
  recuperacion: "#E8B44F",
  entrada: "#D7DEE6",
  despeje: "#8A96A3",
  paradas: "#4FD18B",
  /* Los rasgos de su puesto (25/11/2026). */
  finalizacion: "#E8735F",
  regateDireccion: "#A98BF0",
  centros: "#4F8FE8",
  transicion: "#F0C75E",
  riesgo: "#E85F8A",
  salida: "#5FD0C8",
  anticipacion: "#E8B44F",
  despejes: "#8A96A3",
  unoContraUno: "#C58BF0",
  llegadas: "#7FB0F5",
  apoyos: "#B8C76F",
  desmarque: "#F59A5F",
  paradasTipo: "#4FD18B",
  salidas: "#6FE0A8",
  piernaCambiada: "#C8A96B",
};
const color = (clave: string) => COLOR[clave] ?? "#C8A96B";

/** Los cortes de antes venían en mayúsculas («REMATE A PUERTA»); los nuevos, ya en frase. */
const frase = (t: string) => (t && t === t.toUpperCase() ? t.charAt(0) + t.slice(1).toLowerCase() : t);

type Capitulo = { clave: string; titulo: string; desde: number; cortes: number };

/** Los capítulos del vídeo: los cortes seguidos de la misma fortaleza o rasgo. */
function capitulosDe(j: ClipsJugador, cortes: CorteJugador[]): Capitulo[] {
  const titulos = new Map<string, string>([...j.fortalezas.map((f) => [f.clave, f.nombre] as const), ...(j.rasgos ?? []).map((r) => [r.clave, r.titulo] as const)]);
  const lista: Capitulo[] = [];
  cortes.forEach((c, i) => {
    const ultimo = lista[lista.length - 1];
    if (ultimo && ultimo.clave === c.fortaleza) ultimo.cortes++;
    else lista.push({ clave: c.fortaleza, titulo: titulos.get(c.fortaleza) ?? frase(c.que), desde: i, cortes: 1 });
  });
  return lista;
}

const fechaCorta = (iso: string) => (iso ? iso.slice(5, 10).split("-").reverse().join("/") : "");

function Tarjeta({ j, escudo }: { j: ClipsJugador; escudo: string | null }) {
  const video = useRef<HTMLVideoElement>(null);
  const [activo, setActivo] = useState(-1);

  /* Dónde empieza cada corte en el vídeo: la portada (3 o 5 s según cuándo se montó) y los anteriores. */
  const portada = j.portada ?? 3;
  const cortes = useMemo(() => j.cortes ?? [], [j.cortes]);
  const inicios = useMemo(() => cortes.reduce<number[]>((acc, c, n, todos) => [...acc, n === 0 ? portada : acc[n - 1] + todos[n - 1].dura], []), [cortes, portada]);
  const capitulos = useMemo(() => capitulosDe(j, cortes), [j, cortes]);
  const capituloActivo = capitulos.findIndex((c) => activo >= c.desde && activo < c.desde + c.cortes);

  const salta = (i: number) => {
    const v = video.current;
    if (!v) return;
    v.currentTime = inicios[i] + 0.05;
    void v.play().catch(() => undefined);
  };

  const alAvanzar = () => {
    const t = video.current?.currentTime ?? 0;
    let i = -1;
    inicios.forEach((ini, n) => {
      if (t >= ini) i = n;
    });
    if (i !== activo) setActivo(i);
  };

  const enVideo = j.fortalezas.filter((f) => f.enVideo);
  const rasgos = j.rasgos ?? [];

  return (
    <article className="group relative min-w-0 overflow-hidden rounded-2xl border border-white/10 bg-gradient-to-b from-white/[0.05] to-white/[0.015] shadow-[0_20px_60px_-30px_rgba(0,0,0,0.8)]">
      <div className="pointer-events-none absolute -right-16 -top-16 h-40 w-40 rounded-full blur-3xl" style={{ background: color(enVideo[0]?.clave ?? ""), opacity: 0.12 }} />

      <header className="relative flex items-center gap-3 px-4 pt-4">
        {escudo ? <img src={escudo} alt="" className="h-9 w-9 shrink-0 object-contain" /> : null}
        <div className="min-w-0">
          <h3 className="truncate text-lg font-black tracking-tight text-white">{j.nombre}</h3>
          <p className="text-[12px] text-white/55">
            {j.puesto}
            {j.rol && j.rol.toLowerCase() !== j.puesto.toLowerCase() ? ` · últimamente ${j.rol.toLowerCase()}` : ""}
            {j.minutos ? ` · ${j.minutos}' en la temporada` : ""}
          </p>
        </div>
        {j.segundos ? (
          <span className="ml-auto shrink-0 rounded-full border border-white/15 px-2 py-0.5 text-[11px] tabular-nums text-white/70">
            {Math.floor(j.segundos / 60)}:{String(j.segundos % 60).padStart(2, "0")}
          </span>
        ) : null}
      </header>

      {/* Sus fortalezas: barra de percentil contra los de su línea en la categoría. */}
      <ul className="relative mt-3 space-y-1.5 px-4">
        {j.fortalezas.slice(0, 4).map((f) => (
          <li key={f.clave} className="grid grid-cols-[minmax(0,9.5rem)_1fr_2.6rem] items-center gap-2 text-[12px]">
            <span className={`truncate ${f.enVideo ? "font-semibold text-white" : "text-white/55"}`}>{f.nombre}</span>
            <span className="relative h-2 overflow-hidden rounded-full bg-white/[0.07]">
              <span className="absolute inset-y-0 left-0 rounded-full" style={{ width: `${f.percentil}%`, background: color(f.clave), opacity: f.enVideo ? 1 : 0.45 }} />
            </span>
            <span className="text-right tabular-nums text-white/70">p{f.percentil}</span>
          </li>
        ))}
      </ul>
      {j.fortalezas.length > 0 && j.fortalezas.every((f) => f.relativa) && (
        <p className="relative mt-1 px-4 text-[11px] italic text-white/45">Nada en el 30 % mejor de su línea: es lo mejor que tiene.</p>
      )}

      {/* Los rasgos de su puesto: el título (el capítulo del vídeo) y sus cifras. */}
      {rasgos.length > 0 && (
        <section className="relative mx-4 mt-3 rounded-xl border border-white/10 bg-white/[0.025] p-3">
          <h4 className="text-[10px] font-bold uppercase tracking-[0.14em] text-white/45">Rasgos de su puesto{j.rol ? ` · ${j.rol.toLowerCase()}` : ""}</h4>
          <ul className="mt-2 space-y-2">
            {rasgos.map((r) => (
              <li key={r.clave} className="text-[12px] leading-snug">
                <span className="flex items-center gap-1.5 font-semibold text-white">
                  <span className="h-2 w-2 shrink-0 rounded-full" style={{ background: color(r.clave), opacity: r.enVideo ? 1 : 0.35 }} />
                  {r.titulo}
                  {r.enVideo ? <span className="text-[10px] font-normal text-white/40">· en el vídeo</span> : null}
                </span>
                <span className="mt-0.5 block pl-3.5 text-white/60">{r.texto}</span>
              </li>
            ))}
          </ul>
        </section>
      )}

      {j.url ? (
        <>
          <div className="relative mx-4 mt-3 overflow-hidden rounded-xl border border-white/10 bg-black">
            <video ref={video} src={j.url.replace(/^https?:\/\/[^/]+/, "")} controls preload="metadata" playsInline className="aspect-video w-full" onTimeUpdate={alAvanzar} />
          </div>
          {/* Los capítulos: pinchar salta al primero de sus cortes. */}
          {capitulos.length > 1 && (
            <ol className="relative mt-2 flex flex-wrap gap-1.5 px-4">
              {capitulos.map((c, i) => (
                <li key={`${c.clave}-${c.desde}`}>
                  <button
                    type="button"
                    onClick={() => salta(c.desde)}
                    className={`inline-flex min-h-8 items-center gap-1.5 rounded-lg border px-2.5 py-1 text-[11px] font-semibold transition max-sm:min-h-10 ${
                      capituloActivo === i ? "border-[#C8A96B]/70 bg-[#C8A96B]/15 text-white" : "border-white/10 bg-white/[0.04] text-white/75 hover:border-white/30 hover:text-white"
                    }`}
                  >
                    <span className="h-2 w-2 rounded-full" style={{ background: color(c.clave) }} />
                    {c.titulo}
                    <span className="font-normal tabular-nums text-white/40">{c.cortes}</span>
                  </button>
                </li>
              ))}
            </ol>
          )}
          <ol className="relative mt-2 flex flex-wrap gap-1.5 px-4 pb-4">
            {cortes.map((c, i) => (
              <li key={`${c.partido}-${c.parte}-${c.segundo}`}>
                <button
                  type="button"
                  onClick={() => salta(i)}
                  title={`${frase(c.que)} · vs ${c.rival} · ${fechaCorta(c.fecha)} · ${minutoDe(c.segundo)}`}
                  className={`inline-flex min-h-8 items-center gap-1.5 rounded-full border px-2.5 py-1 text-[11px] transition max-sm:min-h-10 ${
                    activo === i ? "border-white/60 bg-white/15 text-white" : "border-white/10 bg-white/[0.03] text-white/70 hover:border-white/30 hover:text-white"
                  }`}
                >
                  <span className="h-2 w-2 rounded-full" style={{ background: color(c.fortaleza) }} />
                  {frase(c.que) || capitulos.find((k) => i >= k.desde && i < k.desde + k.cortes)?.titulo} · {minutoDe(c.segundo)}
                  <span className="text-white/40">{c.rival ? c.rival.split(" ")[0] : ""}</span>
                </button>
              </li>
            ))}
          </ol>
        </>
      ) : (
        <p className="relative px-4 pb-4 pt-3 text-[12px] text-white/50">{j.sinVideo ?? "Sin vídeo todavía."}</p>
      )}
    </article>
  );
}

export default function JugadoresRivalPage() {
  const [doc, setDoc] = useState<DocClipsJugador | null>(null);
  const [error, setError] = useState("");
  const [equipo, setEquipo] = useState("");
  const escudoDe = useEscudos();

  useEffect(() => {
    let vivo = true;
    fetch("/api/opta/clips-jugador", { cache: "no-store" })
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

  /* Los equipos por cuándo se revisaron (el próximo rival suele ir primero en la pasada). */
  const equipos = useMemo(() => (doc ? Object.entries(doc.equipos).map(([teamId, e]) => ({ teamId, ...e })) : []), [doc]);
  const elegido = equipos.find((e) => e.teamId === equipo) ?? equipos[0];

  const jugadores = useMemo(() => {
    if (!doc || !elegido) return { con: [] as ClipsJugador[], sin: [] as ClipsJugador[] };
    const suyos = elegido.jugadores.map((id) => doc.jugadores[id]).filter(Boolean);
    return { con: suyos.filter((j) => j.url), sin: suyos.filter((j) => !j.url) };
  }, [doc, elegido]);

  return (
    <main className="min-h-screen bg-[#0B0F14] text-white">
      <div className="flex">
        <Sidebar />
        <section className="flex min-w-0 flex-1 flex-col">
          <Topbar />
          <div className="min-w-0 px-4 py-6 sm:px-6 lg:px-10">
            <AbpHeader
              area="Laboratorio Scout · Sólo administrador"
              title="Jugadores rivales en vídeo"
              lead="Cada jugador del rival por sus fortalezas (percentil de Opta contra los de su línea en la categoría) y por los rasgos de su puesto (cómo regatea, centra, remata, progresa, qué hace tras robo, si arriesga en su campo…), con sus acciones de los últimos 5 partidos en un vídeo de 2 minutos como mucho."
            />

            {error && <p className="mt-4 rounded-xl border border-red-400/30 bg-red-500/10 p-3 text-sm text-red-200">{error}</p>}
            {!doc && !error && <div className="mt-6 h-40 animate-pulse rounded-2xl bg-white/[0.05]" />}
            {doc && !equipos.length && (
              <p className="mt-6 rounded-2xl border border-white/10 bg-white/[0.03] p-4 text-sm text-white/70">
                Todavía no hay vídeos: se montan la noche del lunes para el rival de la próxima jornada (o a mano con <code>node scripts/opta-clips-jugador.mjs</code>).
              </p>
            )}

            {elegido && (
              <>
                <div className="mt-5 flex flex-wrap items-center gap-2">
                  {equipos.map((e) => {
                    const on = e.teamId === elegido.teamId;
                    const escudo = escudoDe(e.nombre);
                    return (
                      <button
                        key={e.teamId}
                        type="button"
                        onClick={() => setEquipo(e.teamId)}
                        className={`inline-flex min-h-10 items-center gap-2 rounded-full border px-3.5 py-1.5 text-sm font-semibold transition ${
                          on ? "border-[#C8A96B]/70 bg-[#C8A96B]/15 text-white" : "border-white/15 text-white/65 hover:text-white"
                        }`}
                      >
                        {escudo ? <img src={escudo} alt="" className="h-5 w-5 object-contain" /> : <Clapperboard className="h-4 w-4" />}
                        {e.nombre}
                      </button>
                    );
                  })}
                </div>

                <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1 text-[12px] text-white/55">
                  <span className="inline-flex items-center gap-1.5">
                    <Film className="h-3.5 w-3.5" /> {jugadores.con.length} vídeos
                  </span>
                  <span>
                    Últimos partidos: {elegido.partidos.map((p) => `${p.rival} (${fechaCorta(p.fecha)})`).join(" · ")}
                  </span>
                  {doc?.actualizado && <span>Montado el {new Date(doc.actualizado).toLocaleString("es-ES", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" })}</span>}
                </div>

                <div className="mt-5 grid grid-cols-1 gap-4 lg:grid-cols-2 2xl:grid-cols-3">
                  {jugadores.con.map((j) => (
                    <Tarjeta key={j.nombre} j={j} escudo={escudoDe(j.equipo)} />
                  ))}
                </div>

                {jugadores.sin.length > 0 && (
                  <details className="mt-6 rounded-2xl border border-white/10 bg-white/[0.02] p-4">
                    <summary className="cursor-pointer text-sm font-semibold text-white/75">
                      <Play className="mr-1 inline h-3.5 w-3.5" /> Sin vídeo ({jugadores.sin.length})
                    </summary>
                    <ul className="mt-2 space-y-1 text-[12px] text-white/60">
                      {jugadores.sin.map((j) => (
                        <li key={j.nombre}>
                          <span className="font-semibold text-white/80">{j.nombre}</span> · {j.puesto} · {j.sinVideo ?? "aún sin montar"}
                        </li>
                      ))}
                    </ul>
                  </details>
                )}
              </>
            )}
          </div>
        </section>
      </div>
    </main>
  );
}
