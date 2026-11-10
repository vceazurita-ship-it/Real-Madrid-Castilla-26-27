"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Sidebar } from "@/components/ui/sidebar";
import { Topbar } from "@/components/ui/topbar";
import { Play, ExternalLink, Home, Plane } from "lucide-react";
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
  /* 30/10/2026: letra de los ejes a 14 en el lienzo de 640: a 390 px se quedaba en 6 px y no se leía. */
  /* 10/11/2026: sin rótulos al final de las líneas (la leyenda de arriba los dice): margen derecho corto. */
  const M = { l: 40, r: 24, t: 16, b: 34 };
  const maximo = Math.max(3, ...jugados.map((u) => u.acumulados), ...jugados.map((u) => liga.get(u.jornada) ?? 0));
  const tope = Math.ceil(maximo / 3) * 3;
  const x = (i: number) => M.l + (i * (W - M.l - M.r)) / (jugados.length - 1);
  const y = (v: number) => H - M.b - (v * (H - M.t - M.b)) / tope;
  const nuestra = jugados.map((u, i) => `${x(i)},${y(u.acumulados)}`).join(" ");
  const puntosLiga = jugados.flatMap((u, i) => (liga.has(u.jornada) ? [`${x(i)},${y(liga.get(u.jornada)!)}`] : []));

  return (
    <div className="mt-4 min-w-0 rounded-[18px] border border-white/10 bg-white/[0.03] p-4">
      <p className="text-xs font-semibold uppercase tracking-[0.2em] text-[#C8A96B]">Puntos acumulados</p>
      {(() => {
        const ultimo = jugados[jugados.length - 1];
        const media = liga.get(ultimo.jornada);
        const f1 = (v: number) => v.toLocaleString("es-ES", { minimumFractionDigits: 0, maximumFractionDigits: 1 });
        const d = media === undefined ? null : Math.round((ultimo.acumulados - media) * 10) / 10;
        return (
          <>
            {/* 10/11/2026: una sola leyenda, con las dos cifras. */}
            <p className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-[13px] text-white/80">
              <span className="inline-flex items-center gap-1.5">
                <span aria-hidden className="inline-block h-[3px] w-5 rounded-full bg-[#C8A96B]" />
                Castilla <b className="tabular-nums">{f1(ultimo.acumulados)}</b>
              </span>
              {media !== undefined ? (
                <span className="inline-flex items-center gap-1.5">
                  <span aria-hidden className="inline-block w-5 border-t-2 border-dashed border-white/55" />
                  media de la liga <b className="tabular-nums">{f1(media)}</b>
                </span>
              ) : null}
            </p>
            {/* Lo que significa, en una frase. */}
            {media !== undefined && d !== null ? (
              <p className="mt-1 text-[13px] font-medium text-white/85">
                {f1(ultimo.acumulados)} puntos frente a {f1(media)} de media tras {jugados.length} jornadas:{" "}
                {Math.abs(d) < 0.05 ? "en la media" : `${f1(Math.abs(d))} ${d > 0 ? "por encima" : "por debajo"}`}.
              </p>
            ) : null}
          </>
        );
      })()}
      <div className="-mx-1 overflow-x-auto px-1">
      <svg
        viewBox={`0 0 ${W} ${H}`}
        className="mt-3 h-auto w-full min-w-[520px] max-w-[720px]"
        role="img"
        aria-label="Puntos acumulados del Castilla frente a la media de la liga"
      >
        {Array.from({ length: tope / 3 + 1 }, (_, k) => k * 3).map((v) => (
          <g key={v}>
            <line x1={M.l} x2={W - M.r} y1={y(v)} y2={y(v)} stroke="currentColor" strokeOpacity={0.12} />
            <text x={M.l - 6} y={y(v) + 3} textAnchor="end" fontSize={14} fill="currentColor" fillOpacity={0.6}>
              {v}
            </text>
          </g>
        ))}
        {jugados.map((u, i) => (
          <text key={u.jornada} x={x(i)} y={H - 10} textAnchor="middle" fontSize={14} fill="currentColor" fillOpacity={0.6}>
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
        {/* 10/11/2026: los rótulos al final de cada línea salen; la leyenda de arriba ya los dice. */}
      </svg>
      </div>
    </div>
  );
}

export default function CollectiveHistoryPage() {
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
/*
| 30/10/2026: el informe ya no se incrusta. «Ver el informe aquí» y «Abrir el
| informe» llevaban al mismo Power BI (expertos de fútbol, análisis y
| marketing): queda un solo botón, a pestaña nueva.
*/
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

  return { mediaPuntos, mediaGoles, puestos, acumuladaLiga, equipos: equipos.size };
}, [golesLiga.value.partidos, jugados]);

/* La columna del puesto sólo se dibuja si hay puesto en todas las jornadas: una celda suelta en blanco es un hueco. */
const conPuesto = jugados.length > 0 && jugados.every((u) => liga.puestos.has(u.jornada));

/*
| 30/10/2026: la tarjeta PUESTO decía «tendencia, tras 9 jornadas», que no se
| entendía (fútbol). Ahora lleva la base y el movimiento de la última jornada,
| sacados de la misma columna Puesto de la tabla.
*/
const movimientoPuesto = (() => {
  if (!tabla) return "";
  const base = `tras ${tabla.jugados} jornadas`;
  if (jugados.length < 2) return base;
  const antes = liga.puestos.get(jugados[jugados.length - 2].jornada);
  const ahora = liga.puestos.get(jugados[jugados.length - 1].jornada);
  if (antes === undefined || ahora === undefined) return base;
  return antes === ahora ? `${base} · igual que la anterior` : `${base} · de ${antes}º a ${ahora}º en la última`;
})();

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

/*
| 29/10/2026: el botón flotante «Ver explicación» tapaba la columna PUESTO de
| las últimas filas, y el hueco que se le dejó a la derecha (lg:pr-44) dejaba la
| tabla sin ocupar la tarjeta. Ahora la tabla va a todo el ancho y los botones
| flotantes se apartan mientras la tabla está en pantalla.
*/
const tablaRef = useRef<HTMLDivElement | null>(null);
const [tablaEnPantalla, setTablaEnPantalla] = useState(false);

useEffect(() => {
  const nodo = tablaRef.current;

  if (!nodo || typeof IntersectionObserver === "undefined") return;

  const vigia = new IntersectionObserver(([entrada]) => setTablaEnPantalla(entrada.isIntersecting), { rootMargin: "0px 0px -40px 0px" });

  vigia.observe(nodo);

  return () => vigia.disconnect();
}, [jugados.length]);

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

        <section className="relative min-w-0 flex-1">
          <Topbar />

          {/* Botón desktop */}
          <button
            onClick={scrollToVideo}
            aria-hidden={tablaEnPantalla || undefined}
            tabIndex={tablaEnPantalla ? -1 : undefined}
            className={`${tablaEnPantalla ? "pointer-events-none opacity-0" : ""}
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
            `}
          >
            <Play size={16} className="text-[#C8A96B]" />
            Ver explicación
          </button>

          {/* Botón móvil */}
          <button
            onClick={scrollToVideo}
            aria-hidden={tablaEnPantalla || undefined}
            tabIndex={tablaEnPantalla ? -1 : undefined}
            className={`${tablaEnPantalla ? "pointer-events-none opacity-0" : ""}
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
            `}
          >
            Ver vídeo
          </button>

          {/* 30/10/2026: pb-24 para que los botones flotantes no tapen la última fila. */}
          <div className="px-4 sm:px-8 pb-24 pt-6 sm:pt-10">
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

              {/* 07/11/2026: el titular con el dato, no sólo la etiqueta de la sección. */}
              {tabla && tabla.jugados > 0 ? (
                <p className="mt-3 text-base font-medium text-white/85 sm:text-lg">
                  {/* 10/11/2026: el movimiento de la última jornada, también en el titular. */}
                  {(() => {
                    if (jugados.length < 2) return `${tabla.puesto}º de ${tabla.deCuantos}`;
                    const antes = liga.puestos.get(jugados[jugados.length - 2].jornada);
                    return antes !== undefined && antes !== tabla.puesto
                      ? `${antes > tabla.puesto ? "Subimos" : "Bajamos"} de ${antes}º a ${tabla.puesto}º de ${tabla.deCuantos}`
                      : `${tabla.puesto}º de ${tabla.deCuantos}`;
                  })()}{" "}
                  con {tabla.puntos} puntos tras {tabla.jugados}{" "}
                  {tabla.jugados === 1 ? "jornada" : "jornadas"}
                  {liga.mediaPuntos !== null
                    ? `: ${(tabla.puntos / tabla.jugados).toLocaleString("es-ES", { maximumFractionDigits: 1 })} por partido frente a ${liga.mediaPuntos.toLocaleString("es-ES", { maximumFractionDigits: 1 })} de media en la liga.`
                    : "."}
                </p>
              ) : null}
            </div>

            {tabla ? (
              <div className="mb-6 grid grid-cols-2 gap-3 sm:grid-cols-4">
                {(() => {
                  const dec = (n: number) => n.toLocaleString("es-ES", { minimumFractionDigits: 1, maximumFractionDigits: 1 });
                  const dif = tabla.favor - tabla.contra;

                  /* 29/10/2026: la cifra grande es el dato y debajo, pequeña, la referencia (fútbol y marketing). */
                  return [
                    ["Puesto", `${tabla.puesto}º de ${tabla.deCuantos}`, movimientoPuesto],
                    [
                      "Puntos",
                      String(tabla.puntos),
                      tabla.jugados > 0
                        ? `en ${tabla.jugados} partidos · ${dec(tabla.puntos / tabla.jugados)} por partido${liga.mediaPuntos !== null ? ` · liga ${dec(liga.mediaPuntos)}` : ""}`
                        : "",
                    ],
                    /* 07/11/2026: «4-3-3» se leía como un sistema de juego. */
                    ["Balance", `${tabla.ganados} G · ${tabla.empatados} E · ${tabla.perdidos} P`, "ganados · empatados · perdidos"],
                    [
                      "Goles",
                      `${tabla.favor}-${tabla.contra}`,
                      /* 29/10/2026: en dos renglones; en uno solo no se leía. */
                      `${tabla.favor} a favor · ${tabla.contra} en contra\ndiferencia ${dif > 0 ? "+" : dif < 0 ? "−" : ""}${Math.abs(dif)}${liga.mediaGoles !== null ? ` · liga ${dec(liga.mediaGoles)} por partido` : ""}`,
                    ],
                  ];
                })().map(([etiqueta, valor, referencia]) => (
                  <div
                    key={etiqueta}
                    className="min-w-0 rounded-2xl border border-white/10 bg-white/[0.04] px-4 py-3"
                  >
                    <p className="text-[11px] uppercase tracking-[0.25em] text-[#C8A96B]">
                      {etiqueta}
                    </p>
                    <p className={`mt-1 font-semibold leading-none text-white ${valor.length > 9 ? "text-2xl sm:text-3xl" : "text-3xl"}`}>{valor}</p>
                    {referencia ? <p className="mt-1.5 whitespace-pre-line text-[12px] leading-snug text-white/60">{referencia}</p> : null}
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

                {/*
                | 30/10/2026: a 390 px sólo se veían Jornada, Rival y Resultado, y
                | Puntos y Puesto quedaban fuera sin señal (fútbol, marketing).
                | Bajo 640 px se esconden Acumulados y Media liga, el campo pasa a
                | una línea bajo el rival y la tabla cabe sin desplazarse. En
                | escritorio, casa/fuera va en su propia columna (análisis).
                */}
                <div ref={tablaRef} className="overflow-x-auto rounded-[18px] border border-white/10">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-white/10 text-left text-xs uppercase tracking-wider text-white/60">
                        <th className="px-3 py-3 font-medium sm:px-4">
                          <span className="sm:hidden">J</span>
                          <span className="hidden sm:inline">Jornada</span>
                        </th>
                        <th className="px-3 py-3 font-medium sm:px-4">Rival</th>
                        <th className="hidden px-4 py-3 font-medium sm:table-cell">Campo</th>
                        <th className="px-3 py-3 text-center font-medium sm:px-4">
                          <span className="sm:hidden">Res.</span>
                          <span className="hidden sm:inline">Resultado</span>
                        </th>
                        <th className="px-3 py-3 text-right font-medium sm:px-4">
                          <span className="sm:hidden">Pts</span>
                          <span className="hidden sm:inline">Puntos</span>
                          {/* 08/11/2026: el sentido, como en el resto de tablas. */}
                          <span className="hidden text-[10px] font-normal normal-case tracking-normal text-white/50 sm:block">▲ más es mejor</span>
                        </th>
                        <th className="hidden px-4 py-3 text-right font-medium sm:table-cell">Acumulados</th>
                        {liga.acumuladaLiga.size > 0 ? (
                          <th className="hidden px-4 py-3 text-right font-medium sm:table-cell">
                            Media liga
                            {liga.equipos > 0 ? (
                              <span className="block text-[10px] font-normal normal-case tracking-normal text-white/50">
                                puntos acumulados de media de los {liga.equipos} equipos tras cada jornada
                              </span>
                            ) : null}
                          </th>
                        ) : null}
                        {/* 08/11/2026: margen a la derecha para que el botón flotante no tape el puesto. */}
                        {conPuesto ? <th className="px-3 py-3 text-right font-medium sm:pl-4 sm:pr-16">Puesto</th> : null}
                      </tr>
                    </thead>
                    <tbody>
                      {jugados.map((uno, i) => (
                        <tr
                          key={uno.jornada}
                          className={`border-b border-white/5 last:border-0 ${i === jugados.length - 1 ? "bg-white/[0.06]" : ""}`}
                        >
                          <td className="px-3 py-2.5 sm:px-4">J{uno.jornada}</td>
                          <td className="min-w-0 px-3 py-2.5 sm:px-4">
                            <span className="block">{nombreEquipo(uno.rival)}</span>
                            <span className="block text-xs text-white/60 sm:hidden">
                              {uno.lado === "casa" ? "en casa" : "fuera"}
                            </span>
                          </td>
                          <td className="hidden px-4 py-2.5 text-white/70 sm:table-cell">
                            {/* 08/11/2026: casa y fuera con icono, no sólo texto. */}
                            <span className="inline-flex items-center gap-1.5">
                              {uno.lado === "casa" ? (
                                <Home className="h-3.5 w-3.5 text-[#C8A96B]" aria-hidden />
                              ) : (
                                <Plane className="h-3.5 w-3.5 text-white/50" aria-hidden />
                              )}
                              {uno.lado === "casa" ? "En casa" : "Fuera"}
                            </span>
                          </td>
                          <td className="px-3 py-2.5 text-center sm:px-4">
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
                          <td className="px-3 py-2.5 text-right sm:px-4">{uno.puntos}</td>
                          <td className="hidden px-4 py-2.5 text-right font-semibold sm:table-cell">{uno.acumulados}</td>
                          {liga.acumuladaLiga.size > 0 ? (
                            <td className="hidden px-4 py-2.5 text-right sm:table-cell">
                              {liga.acumuladaLiga.has(uno.jornada) ? liga.acumuladaLiga.get(uno.jornada)!.toLocaleString("es-ES", { minimumFractionDigits: 1, maximumFractionDigits: 1 }) : ""}
                            </td>
                          ) : null}
                          {conPuesto ? (
                            <td className="px-3 py-2.5 text-right sm:pl-4 sm:pr-16">{liga.puestos.get(uno.jornada)}º</td>
                          ) : null}
                        </tr>
                      ))}
                    </tbody>
                    <tfoot>
                      <tr className="border-t border-white/10 bg-white/[0.04] font-semibold">
                        <td className="px-3 py-2.5 sm:px-4" colSpan={2}>
                          Total · {jugados.length} partidos
                        </td>
                        <td className="hidden sm:table-cell" />
                        <td className="px-3 py-2.5 text-center sm:px-4">
                          {golesTabla.favor}-{golesTabla.contra}
                        </td>
                        <td className="px-3 py-2.5 text-right sm:px-4">{golesTabla.puntos}</td>
                        <td className="hidden sm:table-cell" />
                        {liga.acumuladaLiga.size > 0 ? <td className="hidden sm:table-cell" /> : null}
                        {conPuesto ? <td /> : null}
                      </tr>
                    </tfoot>
                  </table>
                </div>
                {conPuesto ? (
                  <p className="mt-2 text-xs text-white/60">
                    Puesto: la clasificación tras cada jornada, con todos los partidos de la liga hasta ella. Con {jugados.length} jornadas es una tendencia.
                  </p>
                ) : null}

                <GraficaPuntos jugados={jugados} liga={liga.acumuladaLiga} />
              </div>
            ) : null}

            <div className="mb-3 flex flex-wrap items-center gap-3 rounded-2xl border border-[#C8A96B]/40 bg-white/[0.04] px-4 py-3 text-sm text-white/80">
              <span className="min-w-0 flex-1 basis-full sm:basis-auto">
                Informe completo de la competición en Power BI.
                <span className="block text-[11px] text-white/55">Se abre en otra pestaña y puede pedir la cuenta de Microsoft.</span>
              </span>
              <a
                href={src}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-2 rounded-full bg-[#C8A96B] px-4 py-2 font-semibold text-black"
              >
                <ExternalLink size={14} />
                Abrir Power BI
              </a>
            </div>

            {/* Vídeo: 10/11/2026, pequeño y pegado a la franja, no un segundo botón. */}
            <div ref={videoRef} className="flex flex-wrap items-center gap-x-3 gap-y-1 text-[12px]">
              <button
                onClick={() => window.open(videoUrl, "_blank")}
                className="inline-flex items-center gap-1.5 text-white/60 underline-offset-4 hover:text-[#C8A96B] hover:underline"
              >
                <ExternalLink className="h-3.5 w-3.5" aria-hidden />
                Vídeo: cómo se lee el informe de Power BI
              </button>
            </div>
          </div>
        </section>
      </div>
    </main>
  );
}