"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Sidebar } from "@/components/ui/sidebar";
import { Topbar } from "@/components/ui/topbar";
import { Play, Maximize2, ExternalLink } from "lucide-react";
import { traeJson } from "@/lib/hojaCsv";
import { useCalendario } from "@/hooks/useCalendario";
import { comoNuestro, ordenaPartidos } from "@/lib/castilla/calendario";
import { useRemoteDoc } from "@/hooks/useRemoteDoc";
import { DOC_GOLES, GOLES_VACIO, type GolesDoc } from "@/lib/goles/analisis";
import type { ClasificacionPortada } from "@/lib/portada/proximo-partido";
import { nombreEquipo } from "@/lib/equipos";

/* Puntos acumulados del Castilla frente a la media de un equipo de la liga, jornada a jornada. */
function GraficaPuntos({
  jugados,
  liga,
}: {
  jugados: { jornada: number; acumulados: number }[];
  liga: Map<number, number>;
}) {
  if (jugados.length < 2) return null;

  const W = 640;
  const H = 220;
  const M = { l: 34, r: 14, t: 14, b: 28 };
  const maximo = Math.max(3, ...jugados.map((u) => u.acumulados), ...jugados.map((u) => liga.get(u.jornada) ?? 0));
  const tope = Math.ceil(maximo / 3) * 3;
  const x = (i: number) => M.l + (i * (W - M.l - M.r)) / (jugados.length - 1);
  const y = (v: number) => H - M.b - (v * (H - M.t - M.b)) / tope;
  const nuestra = jugados.map((u, i) => `${x(i)},${y(u.acumulados)}`).join(" ");
  const puntosLiga = jugados.flatMap((u, i) => (liga.has(u.jornada) ? [`${x(i)},${y(liga.get(u.jornada)!)}`] : []));

  return (
    <div className="mt-4 min-w-0 rounded-[18px] border border-white/10 bg-white/[0.03] p-4">
      <p className="text-xs font-semibold uppercase tracking-[0.2em] text-[#C8A96B]">Puntos acumulados</p>
      <p className="mt-1 text-xs text-white/60">
        Castilla frente a lo que lleva de media un equipo de la liga tras cada jornada (más, mejor).
      </p>
      <svg
        viewBox={`0 0 ${W} ${H}`}
        className="mt-3 h-auto w-full"
        role="img"
        aria-label="Puntos acumulados del Castilla frente a la media de la liga"
      >
        {Array.from({ length: tope / 3 + 1 }, (_, k) => k * 3).map((v) => (
          <g key={v}>
            <line x1={M.l} x2={W - M.r} y1={y(v)} y2={y(v)} stroke="currentColor" strokeOpacity={0.12} />
            <text x={M.l - 6} y={y(v) + 3} textAnchor="end" fontSize={10} fill="currentColor" fillOpacity={0.6}>
              {v}
            </text>
          </g>
        ))}
        {jugados.map((u, i) => (
          <text key={u.jornada} x={x(i)} y={H - 10} textAnchor="middle" fontSize={10} fill="currentColor" fillOpacity={0.6}>
            J{u.jornada}
          </text>
        ))}
        {puntosLiga.length > 1 ? (
          <polyline
            points={puntosLiga.join(" ")}
            fill="none"
            stroke="currentColor"
            strokeOpacity={0.55}
            strokeWidth={2}
            strokeDasharray="5 4"
          />
        ) : null}
        <polyline points={nuestra} fill="none" stroke="#C8A96B" strokeWidth={2.5} />
        {jugados.map((u, i) => (
          <circle key={u.jornada} cx={x(i)} cy={y(u.acumulados)} r={3.5} fill="#C8A96B" />
        ))}
        {/* Rótulos directos en el último punto de cada línea. */}
        {(() => {
          const i = jugados.length - 1;
          const ultimo = jugados[i];
          const media = liga.get(ultimo.jornada);
          const encima = media === undefined || ultimo.acumulados >= media;
          const fmt = (v: number) => v.toLocaleString("es-ES", { minimumFractionDigits: 0, maximumFractionDigits: 1 });

          return (
            <>
              <text x={x(i)} y={y(ultimo.acumulados) + (encima ? -9 : 15)} textAnchor="end" fontSize={11} fontWeight={600} fill="#C8A96B">
                Castilla {fmt(ultimo.acumulados)}
              </text>
              {media !== undefined ? (
                <text x={x(i)} y={y(media) + (encima ? 15 : -9)} textAnchor="end" fontSize={11} fill="currentColor" fillOpacity={0.7}>
                  Media liga {fmt(media)}
                </text>
              ) : null}
            </>
          );
        })()}
      </svg>
      <div className="mt-2 flex flex-wrap gap-x-5 gap-y-1 text-xs text-white/70">
        <span className="inline-flex items-center gap-1.5">
          <span className="h-0.5 w-5 bg-[#C8A96B]" aria-hidden /> Castilla
        </span>
        <span className="inline-flex items-center gap-1.5">
          <span className="h-0 w-5 border-t-2 border-dashed border-current opacity-60" aria-hidden /> Media de la liga
        </span>
      </div>
    </div>
  );
}

export default function CollectiveHistoryPage() {
  /*
  | 19/10/2026: el iPhone no deja poner un elemento a pantalla completa
  | (`requestFullscreen` no existe ahí) y el botón no hacía nada. Si el
  | navegador no puede, se abre el informe en una pestaña nueva, que en el
  | móvil ya ocupa la pantalla entera.
  */
  const toggleDashboardFullscreen = async () => {
  try {
    if (document.fullscreenElement) {
      await document.exitFullscreen();
      return;
    }

    const panel = dashboardRef.current;

    if (panel && typeof panel.requestFullscreen === "function") {
      await panel.requestFullscreen();
      return;
    }

    window.open(src, "_blank", "noopener");
  } catch (error) {
    console.error(error);
  }
};
const [isFullscreen, setIsFullscreen] = useState(false);

/*
| 23/10/2026: Power BI a veces no carga (red del club, sesión de Microsoft) y
| el hueco quedaba en blanco. Si el informe no avisa de que ha cargado en 8 s,
| se ofrece abrirlo en pestaña nueva; y la clasificación del Castilla sale
| del propio informe de rivales, para que la pantalla sirva aunque falle.
*/
/*
| 24/10/2026: el `onLoad` del iframe salta cuando carga el marco de Power BI,
| aunque el informe siga en «Cargando datos…», así que no vale para saber si
| ha cargado. El informe va plegado tras un botón y la tarjeta con el enlace
| a pestaña nueva está siempre; la tabla y las cifras de arriba bastan solas.
*/
const [verInforme, setVerInforme] = useState(false);
const [tabla, setTabla] = useState<ClasificacionPortada | null>(null);

useEffect(() => {
  let vivo = true;
  traeJson<{ clasificacion?: ClasificacionPortada | null }>("/api/data-analisis?portada=1")
    .then((r) => {
      if (vivo) setTabla(r?.clasificacion ?? null);
    })
    .catch(() => {});
  return () => {
    vivo = false;
  };
}, []);

/* Nuestros partidos jugados, con los puntos que llevamos tras cada uno. */
const { partidos } = useCalendario();
const jugados = useMemo(() => {
  return ordenaPartidos(partidos)
    .map(comoNuestro)
    .filter((uno) => uno.jugado && uno.golesFavor !== null && uno.golesContra !== null)
    .reduce<
      (ReturnType<typeof comoNuestro> & { gf: number; gc: number; puntos: number; acumulados: number })[]
    >((lista, uno) => {
      const gf = uno.golesFavor as number;
      const gc = uno.golesContra as number;
      const puntos = gf > gc ? 3 : gf === gc ? 1 : 0;
      const antes = lista.length ? lista[lista.length - 1].acumulados : 0;

      return [...lista, { ...uno, gf, gc, puntos, acumulados: antes + puntos }];
    }, []);
}, [partidos]);

/*
| La liga entera (goles:analisis, de BeSoccer) para dos cosas: la media de
| puntos por partido de los 20 equipos y el puesto tras cada jornada. El
| puesto sólo se da si de esa jornada están todos los partidos de la liga.
*/
const golesLiga = useRemoteDoc<GolesDoc>({ key: DOC_GOLES, kind: "goles", fallback: GOLES_VACIO });
const liga = useMemo(() => {
  const ps = golesLiga.value.partidos ?? [];
  const ultimaNuestra = jugados.at(-1)?.jornada ?? 0;
  const hasta = ps.filter((p) => p.jornada <= ultimaNuestra);

  /* Puntos repartidos por equipo y partido: 3 si hay ganador, 2 si empatan. */
  const mediaPuntos =
    hasta.length > 0 ? hasta.reduce((s, p) => s + (p.gl === p.gv ? 2 : 3), 0) / (hasta.length * 2) : null;

  /* Goles a favor por equipo y partido de toda la liga. */
  const mediaGoles =
    hasta.length > 0 ? hasta.reduce((s, p) => s + p.gl + p.gv, 0) / (hasta.length * 2) : null;

  const equipos = new Set(ps.flatMap((p) => [p.local, p.visitante]));
  const porPartidosJornada = Math.floor(equipos.size / 2);
  const puestos = new Map<number, number>();
  /* Puntos que lleva de media un equipo de la liga tras cada una de nuestras jornadas. */
  const acumuladaLiga = new Map<number, number>();

  jugados.forEach((uno, i) => {
    const hastaAqui = ps.filter((p) => p.jornada <= uno.jornada);

    if (hastaAqui.length === 0) return;

    acumuladaLiga.set(
      uno.jornada,
      (hastaAqui.reduce((s, p) => s + (p.gl === p.gv ? 2 : 3), 0) / (hastaAqui.length * 2)) * (i + 1),
    );
  });

  for (const uno of jugados) {
    const dePartidos = ps.filter((p) => p.jornada <= uno.jornada);
    const completa =
      porPartidosJornada > 0 &&
      ps.filter((p) => p.jornada === uno.jornada).length === porPartidosJornada &&
      dePartidos.length === porPartidosJornada * uno.jornada;

    if (!completa) continue;

    const tabla = new Map<string, { pts: number; dif: number; gf: number }>();
    const fila = (n: string) => {
      if (!tabla.has(n)) tabla.set(n, { pts: 0, dif: 0, gf: 0 });

      return tabla.get(n)!;
    };

    for (const p of dePartidos) {
      const a = fila(p.local);
      const b = fila(p.visitante);

      a.pts += p.gl > p.gv ? 3 : p.gl === p.gv ? 1 : 0;
      b.pts += p.gv > p.gl ? 3 : p.gl === p.gv ? 1 : 0;
      a.dif += p.gl - p.gv;
      b.dif += p.gv - p.gl;
      a.gf += p.gl;
      b.gf += p.gv;
    }

    const nuestro = [...tabla.keys()].find((n) => /castilla/i.test(n));

    if (!nuestro) continue;

    const orden = [...tabla.entries()].sort((x, y) => y[1].pts - x[1].pts || y[1].dif - x[1].dif || y[1].gf - x[1].gf);

    puestos.set(uno.jornada, orden.findIndex(([n]) => n === nuestro) + 1);
  }

  return { mediaPuntos, mediaGoles, puestos, acumuladaLiga };
}, [golesLiga.value.partidos, jugados]);

/* La columna del puesto sólo se dibuja si hay puesto en todas las jornadas: una celda suelta en blanco es un hueco. */
const conPuesto = jugados.length > 0 && jugados.every((u) => liga.puestos.has(u.jornada));

/*
| La suma de la tabla de jornadas tiene que dar lo mismo que las tarjetas de
| arriba (goles a favor, en contra y partidos). Si el calendario se queda sin
| un partido, la diferencia queda en la consola en vez de pasar inadvertida.
*/
const golesTabla = useMemo(
  () => ({
    favor: jugados.reduce((s, u) => s + u.gf, 0),
    contra: jugados.reduce((s, u) => s + u.gc, 0),
    puntos: jugados.reduce((s, u) => s + u.puntos, 0),
  }),
  [jugados],
);

useEffect(() => {
  if (!tabla || jugados.length === 0) return;

  if (jugados.length !== tabla.jugados || golesTabla.favor !== tabla.favor || golesTabla.contra !== tabla.contra) {
    console.warn(
      `Histórico: la tabla de jornadas suma ${golesTabla.favor}-${golesTabla.contra} en ${jugados.length} partidos y la clasificación ${tabla.favor}-${tabla.contra} en ${tabla.jugados}.`,
    );
  }
}, [tabla, jugados, golesTabla]);

const videoRef = useRef<HTMLDivElement | null>(null);
const dashboardRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
  const handleFullscreen = () => {
    setIsFullscreen(!!document.fullscreenElement);
  };

  document.addEventListener(
    "fullscreenchange",
    handleFullscreen
  );

  return () => {
    document.removeEventListener(
      "fullscreenchange",
      handleFullscreen
    );
  };
}, []);
useEffect(() => {
  const handleKey = (
    e: KeyboardEvent
  ) => {
    if (
      e.key === "Escape" &&
      document.fullscreenElement
    ) {
      /* El navegador suele salir solo con Escape; si ya lo ha hecho, esta
         segunda salida falla y no debe dejar un error en la consola. */
      document.exitFullscreen().catch(() => {});
    }
  };

  window.addEventListener(
    "keydown",
    handleKey
  );

  return () =>
    window.removeEventListener(
      "keydown",
      handleKey
    );
}, []);

  const src = "https://app.powerbi.com/view?r=eyJrIjoiNzY4NjNmZjktZWU3Zi00NjkyLTg5NTMtNzQwYjQwMGVjZmQxIiwidCI6ImQ2Zjc2YzExLWZmYjktNGExNS05YjQ5LWU2ZWQ0MjljOTVhMiIsImMiOjl9";

  const videoUrl =
    "https://drive.google.com/file/d/1V-1mm_z7cM43ZXKaCHGRPlECx-IH1Nrt/view";

  const scrollToVideo = () => {
    if (window.innerWidth < 1024) {
      window.open(videoUrl, "_blank");
      return;
    }

    videoRef.current?.scrollIntoView({
      behavior: "smooth",
      block: "start",
    });
  };

  return (
    <main className="min-h-screen bg-[#0B0F14] text-white">
      <div className="flex">
        <Sidebar />

        <section className="w-full relative">
          <Topbar />

          {/* Botón desktop */}
          <button
            onClick={scrollToVideo}
            className="
              hidden lg:flex
              fixed right-6 bottom-6 z-50
              items-center gap-3
              rounded-full
              border border-[#C8A96B]/40
              bg-[#11161D]/90
              px-5 py-3
              text-sm font-medium
              text-white
              shadow-[0_12px_35px_rgba(0,0,0,0.35)]
              backdrop-blur-md
              hover:border-[#C8A96B]
              hover:bg-[#161D26]
              transition-all
            "
          >
            <Play size={16} className="text-[#C8A96B]" />
            Ver explicación
          </button>

          {/* Botón móvil */}
          <button
            onClick={scrollToVideo}
            className="
              lg:hidden
              fixed bottom-5 right-5 z-50
              rounded-full
              bg-[#C8A96B]
              text-black
              px-4 py-3
              text-sm font-semibold
              shadow-xl
              hover:opacity-90
              transition
            "
          >
            Ver vídeo
          </button>

          <div className="px-4 sm:px-8 pb-8 sm:pb-12 pt-6 sm:pt-10">
            {/* Header */}
            <div className="mb-8">
              <p className="text-xs uppercase tracking-[0.35em] text-[#C8A96B]">
                RMCF CASTILLA COLECTIVO
              </p>

              <div className="mt-4 flex items-center gap-3 sm:gap-5">
                <h1 className="text-3xl sm:text-4xl font-semibold tracking-tight">
                  Histórico de la Competición
                </h1>

                <div className="h-px flex-1 bg-gradient-to-r from-[#C8A96B]/30 via-white/10 to-transparent" />
              </div>
            </div>

            {tabla ? (
              <div className="mb-6 grid grid-cols-2 gap-3 sm:grid-cols-4">
                {[
                  ["Puesto", `${tabla.puesto}º de ${tabla.deCuantos} · tendencia, tras ${tabla.jugados} jornadas`],
                  [
                    "Puntos",
                    `${tabla.puntos} en ${tabla.jugados} partidos${tabla.jugados > 0 ? ` · ${(tabla.puntos / tabla.jugados).toLocaleString("es-ES", { minimumFractionDigits: 1, maximumFractionDigits: 1 })} por partido${liga.mediaPuntos !== null ? ` · liga ${liga.mediaPuntos.toLocaleString("es-ES", { minimumFractionDigits: 1, maximumFractionDigits: 1 })} · más, mejor` : ""}` : ""}`,
                  ],
                  ["Balance", `${tabla.ganados} G · ${tabla.empatados} E · ${tabla.perdidos} P`],
                  [
                    "Goles",
                    `${tabla.favor} a favor (más, mejor) · ${tabla.contra} en contra (menos, mejor)
en ${tabla.jugados} partidos · diferencia ${tabla.favor - tabla.contra > 0 ? "+" : tabla.favor - tabla.contra < 0 ? "−" : ""}${Math.abs(tabla.favor - tabla.contra)}${liga.mediaGoles !== null ? ` · liga ${liga.mediaGoles.toLocaleString("es-ES", { minimumFractionDigits: 1, maximumFractionDigits: 1 })} por equipo y partido` : ""}`,
                  ],
                ].map(([etiqueta, valor]) => (
                  <div
                    key={etiqueta}
                    className="min-w-0 rounded-2xl border border-white/10 bg-white/[0.04] px-4 py-3"
                  >
                    <p className="text-[11px] uppercase tracking-[0.25em] text-[#C8A96B]">
                      {etiqueta}
                    </p>
                    <p className="mt-1 whitespace-pre-line text-sm font-semibold text-white">{valor}</p>
                  </div>
                ))}
              </div>
            ) : null}

            {/* Jornada a jornada, ANTES del informe: es lo que sirve aunque Power BI no cargue */}
            {jugados.length > 0 ? (
              <div className="mb-8">
                <p className="text-xs uppercase tracking-[0.35em] text-[#C8A96B]">
                  Nuestra temporada
                </p>

                <h2 className="mt-3 mb-4 text-2xl sm:text-3xl font-semibold tracking-tight">
                  Jornada a jornada
                </h2>

                <div className="overflow-x-auto rounded-[18px] border border-white/10">
                  <table className="w-full min-w-[420px] text-sm">
                    <thead>
                      <tr className="border-b border-white/10 text-left text-xs uppercase tracking-wider text-white/60">
                        <th className="px-4 py-3 font-medium">Jornada</th>
                        <th className="px-4 py-3 font-medium">Rival</th>
                        <th className="px-4 py-3 text-center font-medium">Resultado</th>
                        <th className="px-4 py-3 text-right font-medium">Puntos</th>
                        <th className="px-4 py-3 text-right font-medium">Acumulados</th>
                        {liga.acumuladaLiga.size > 0 ? <th className="px-4 py-3 text-right font-medium">Media liga</th> : null}
                        {conPuesto ? <th className="px-4 py-3 text-right font-medium">Puesto</th> : null}
                      </tr>
                    </thead>
                    <tbody>
                      {jugados.map((uno, i) => (
                        <tr
                          key={uno.jornada}
                          className={`border-b border-white/5 last:border-0 ${i === jugados.length - 1 ? "bg-white/[0.06]" : ""}`}
                        >
                          <td className="px-4 py-2.5">J{uno.jornada}</td>
                          <td className="px-4 py-2.5">
                            {nombreEquipo(uno.rival)}
                            <span className="ml-2 text-xs text-white/60">
                              {uno.lado === "casa" ? "en casa" : "fuera"}
                            </span>
                          </td>
                          <td className="px-4 py-2.5 text-center">
                            <span
                              className={`inline-block min-w-[3rem] rounded-md px-2 py-0.5 text-xs font-semibold ${
                                uno.puntos === 3
                                  ? "bg-emerald-500/20 text-emerald-600"
                                  : uno.puntos === 1
                                    ? "bg-amber-500/20 text-amber-600"
                                    : "bg-red-500/20 text-red-600"
                              }`}
                            >
                              {uno.gf}-{uno.gc}
                            </span>
                          </td>
                          <td className="px-4 py-2.5 text-right">{uno.puntos}</td>
                          <td className="px-4 py-2.5 text-right font-semibold">{uno.acumulados}</td>
                          {liga.acumuladaLiga.size > 0 ? (
                            <td className="px-4 py-2.5 text-right">
                              {liga.acumuladaLiga.has(uno.jornada) ? liga.acumuladaLiga.get(uno.jornada)!.toLocaleString("es-ES", { minimumFractionDigits: 1, maximumFractionDigits: 1 }) : ""}
                            </td>
                          ) : null}
                          {conPuesto ? (
                            <td className="px-4 py-2.5 text-right">{liga.puestos.get(uno.jornada)}º</td>
                          ) : null}
                        </tr>
                      ))}
                    </tbody>
                    <tfoot>
                      <tr className="border-t border-white/10 bg-white/[0.04] font-semibold">
                        <td className="px-4 py-2.5" colSpan={2}>
                          Total · {jugados.length} partidos
                        </td>
                        <td className="px-4 py-2.5 text-center">
                          {golesTabla.favor}-{golesTabla.contra}
                        </td>
                        <td className="px-4 py-2.5 text-right">{golesTabla.puntos}</td>
                        <td className="px-4 py-2.5" colSpan={(conPuesto ? 1 : 0) + (liga.acumuladaLiga.size > 0 ? 1 : 0) + 1} />
                      </tr>
                    </tfoot>
                  </table>
                </div>

                <GraficaPuntos jugados={jugados} liga={liga.acumuladaLiga} />
              </div>
            ) : null}

            <div className="mb-3 flex flex-wrap items-center gap-3 rounded-2xl border border-[#C8A96B]/40 bg-white/[0.04] px-4 py-3 text-sm text-white/80">
              <span className="min-w-0 flex-1">
                Informe completo de la competición en Power BI. Se abre mejor en una pestaña nueva.
              </span>
              <button
                type="button"
                onClick={() => setVerInforme((v) => !v)}
                className="inline-flex items-center gap-2 rounded-full border border-[#C8A96B]/40 px-4 py-2 font-semibold text-white"
              >
                {verInforme ? "Ocultar el informe" : "Ver el informe aquí"}
              </button>
              <a
                href={src}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-2 rounded-full bg-[#C8A96B] px-4 py-2 font-semibold text-black"
              >
                <ExternalLink size={14} />
                Abrir el informe
              </a>
            </div>

            {verInforme ? (
            <div
  ref={dashboardRef}
  className="relative rounded-[24px] sm:rounded-[32px] border border-white/10 bg-gradient-to-b from-white/[0.05] to-white/[0.02] p-2 sm:p-4 shadow-[0_12px_40px_rgba(0,0,0,0.35)] backdrop-blur-sm overflow-hidden"
>
  <button
  onClick={toggleDashboardFullscreen}
  className="
    absolute
    top-4
    right-4
    z-30
    flex
    items-center
    gap-2
    rounded-full
    border border-[#C8A96B]/40
    bg-[#11161D]/90
    px-4
    py-2
    text-sm
    font-medium
    text-white
    backdrop-blur-md
    hover:border-[#C8A96B]
    hover:bg-[#161D26]
    transition-all
  "
>
  <Maximize2
    size={16}
    className="text-[#C8A96B]"
  />

  {isFullscreen
    ? "Salir pantalla completa"
    : "Pantalla completa"}
</button>

  <iframe
    title="Histórico de la competición (Power BI)"
    src={src}
    className={`
      block
      w-full
      border-0
      rounded-[18px] sm:rounded-[24px]
      bg-[#0B0F14]
      ${
        isFullscreen
          ? "h-screen"
          : "h-[60vh] sm:h-[68vh] lg:h-[680px]"
      }
    `}
    allowFullScreen
  />
</div>
            ) : null}

            {/* Vídeo */}
            <div ref={videoRef} className="mt-10 sm:mt-14 flex flex-wrap items-center gap-x-3 gap-y-1 text-sm">
              <span className="text-xs uppercase tracking-[0.35em] text-[#C8A96B]">Explicación visual</span>
              <button
                onClick={() => window.open(videoUrl, "_blank")}
                className="inline-flex items-center gap-1.5 font-semibold text-[#C8A96B] underline-offset-4 hover:underline"
              >
                <ExternalLink className="h-3.5 w-3.5" aria-hidden />
                Cómo se usa el informe (vídeo)
              </button>
            </div>
          </div>
        </section>
      </div>
    </main>
  );
}