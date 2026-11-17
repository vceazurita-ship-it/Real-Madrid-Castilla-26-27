"use client";

import { useEffect, useMemo, useState, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { Sidebar } from "@/components/ui/sidebar";
import { Topbar } from "@/components/ui/topbar";
import { ExternalLink, Clapperboard, Home, Plane, ClipboardList, Trophy, Users, Video } from "lucide-react";
import { traeJson } from "@/lib/hojaCsv";
import { useCalendario } from "@/hooks/useCalendario";
import { comoNuestro, ordenaPartidos } from "@/lib/castilla/calendario";
import { useRemoteDoc } from "@/hooks/useRemoteDoc";
import { DOC_GOLES, GOLES_VACIO, type GolesDoc } from "@/lib/goles/analisis";
import type { ClasificacionPortada } from "@/lib/portada/proximo-partido";
import { nombreEquipo } from "@/lib/equipos";
import { mismoClub } from "@/lib/rivals/mismoClub";
import { Lamina, TituloConclusion, VistaVisualDetalle } from "@/components/ui/VistaVisual";
import Link from "next/link";
import { EnlacesRapidos } from "@/components/ui/EnlacesRapidos";
import { urlPostDelPartido } from "@/lib/post-partido";
import { urlGolesDelEquipo } from "@/lib/rivals/goles-en-video";
import { conRivalEnUrl } from "@/lib/rivals/rival-en-curso";

const coma1 = (v: number) => v.toLocaleString("es-ES", { minimumFractionDigits: 1, maximumFractionDigits: 1 });

/*
| VISUAL (16/11/2026, petición del analista: «las áreas visuales mucho mejor,
| trasládalo a todo lo que tenga sentido»). La temporada en dos láminas con su
| conclusión en el título: los puntos frente a la media de la liga y la racha
| partido a partido (con el puesto debajo, si está en todas). «Detalle» es la
| tabla de siempre.
*/
function RachaPartidos({
  jugados,
  puestos,
}: {
  jugados: { jornada: number; rival: string; cuando: string; gf: number; gc: number; puntos: number }[];
  puestos: Map<number, number> | null;
}) {
  return (
    <div className="min-w-0 overflow-x-auto">
      <ol className="flex gap-1.5" style={{ minWidth: jugados.length * 44 }}>
        {jugados.map((uno) => (
          <li key={uno.jornada} className="min-w-0 flex-1">
            {/* 17/11/2026 (ronda 19): cada jornada abre su post en Análisis de datos. */}
            <Link
              href={uno.cuando ? urlPostDelPartido(uno.cuando, uno.rival) : "/match-plans"}
              title={`J${uno.jornada} · ${nombreEquipo(uno.rival)} · ${uno.gf}-${uno.gc}: abrir su post`}
              className="flex flex-col items-center gap-1 rounded-md transition hover:opacity-80"
            >
            <span className="text-[11px] tabular-nums text-white/60">J{uno.jornada}</span>
            <span
              className={`flex h-10 w-full max-w-[52px] flex-col items-center justify-center rounded-md text-[11px] font-bold tabular-nums ${
                uno.puntos === 3 ? "bg-emerald-500/20 text-emerald-600" : uno.puntos === 1 ? "bg-amber-500/20 text-amber-600" : "bg-red-500/20 text-red-600"
              }`}
            >
              <span>{uno.puntos === 3 ? "G" : uno.puntos === 1 ? "E" : "P"}</span>
              <span className="text-[10px] font-semibold">{uno.gf}-{uno.gc}</span>
            </span>
            {puestos?.has(uno.jornada) ? (
              <span className="text-[11px] font-semibold tabular-nums" style={{ color: "var(--rmcf-gold-ink)" }}>
                {puestos.get(uno.jornada)}º
              </span>
            ) : null}
            </Link>
          </li>
        ))}
      </ol>
      <p className="mt-2 text-[11px] text-white/60">G, E, P: ganado, empatado, perdido, con el marcador{puestos ? "; debajo, nuestro puesto tras esa jornada" : ""}. Cada jornada abre su post.</p>
    </div>
  );
}

type Vecino = { puesto: number; nombre: string; puntos: number };
/** Nuestros puntos en la última tabla completa y los equipos de justo arriba y abajo. */
type Vecinos = { jornada: number; puntos: number; arriba: Vecino | null; abajo: Vecino | null };

/** «13 nov», del «2026-11-13T19:00» de BeSoccer. */
/*
| 16/11/2026 (expertos, ronda 18): el puesto tras cada jornada, en su propia
| lámina y con el eje al revés (el 1º arriba), en vez de repetirlo en la tabla.
*/
/*
| 17/11/2026 (ronda 19, los tres jueces): «el gráfico no coincide con la tira».
| Los puntos estaban bien, pero las marcas 1º-5º-10º no van a la misma
| distancia (del 1 al 5 hay 4 puestos) y el ojo leía otro puesto. Ahora cada
| punto lleva su puesto escrito, hay una raya por puesto (tenue) y cada punto
| abre el post de esa jornada.
*/
function GraficaPuesto({
  jugados,
  puestos,
  equipos,
}: {
  jugados: { jornada: number; rival: string; cuando: string }[];
  puestos: Map<number, number>;
  equipos: number;
}) {
  const router = useRouter();
  const serie = jugados
    .map((u) => ({ j: u.jornada, p: puestos.get(u.jornada), rival: u.rival, cuando: u.cuando }))
    .filter((x): x is { j: number; p: number; rival: string; cuando: string } => typeof x.p === "number");
  if (serie.length < 2) return null;
  const tope = Math.max(equipos || 20, ...serie.map((x) => x.p));
  const marcas = [1, 5, 10, 15, 20].filter((v) => v <= tope);
  const abre = (s: { cuando: string; rival: string }) => {
    if (s.cuando) router.push(urlPostDelPartido(s.cuando, s.rival));
  };
  /* Dos lienzos: el del móvil (640 de ancho, letra 20 → unos 11 px a 390) y el apaisado del escritorio. */
  const lienzo = (ancho: number, alto: number, letra: number, clase: string) => {
    const m = { izq: letra * 2.4, der: 16, arr: letra * 2, abj: letra * 2 };
    const x = (i: number) => m.izq + (i / (serie.length - 1)) * (ancho - m.izq - m.der);
    const y = (p: number) => m.arr + ((p - 1) / Math.max(1, tope - 1)) * (alto - m.arr - m.abj);
    return (
      <svg viewBox={`0 0 ${ancho} ${alto}`} className={`h-auto w-full ${clase}`} role="img" aria-label={`Puesto tras cada jornada: del ${serie[0].p}º al ${serie[serie.length - 1].p}º`}>
        {Array.from({ length: tope }, (_, k) => k + 1).map((v) => (
          <line key={v} x1={m.izq} x2={ancho - m.der} y1={y(v)} y2={y(v)} stroke="currentColor" strokeOpacity={marcas.includes(v) ? 0.16 : 0.05} />
        ))}
        {marcas.map((v) => (
          <text key={v} x={m.izq - 6} y={y(v) + letra / 3} textAnchor="end" fontSize={letra} fill="currentColor" fillOpacity={0.65}>
            {v}º
          </text>
        ))}
        <polyline points={serie.map((s, i) => `${x(i)},${y(s.p)}`).join(" ")} fill="none" stroke="#C8A96B" strokeWidth={letra / 5} strokeLinejoin="round" />
        {serie.map((s, i) => (
          <g
            key={s.j}
            role="link"
            tabIndex={0}
            onClick={() => abre(s)}
            onKeyDown={(e) => {
              if (e.key === "Enter") abre(s);
            }}
            style={{ cursor: s.cuando ? "pointer" : undefined }}
          >
            <title>{`J${s.j} · ${nombreEquipo(s.rival)}: ${s.p}º. Abrir su post`}</title>
            <circle cx={x(i)} cy={y(s.p)} r={letra} fill="transparent" />
            <circle cx={x(i)} cy={y(s.p)} r={i === serie.length - 1 ? letra / 2.4 : letra / 3.6} fill="#C8A96B" />
            <text
              x={x(i)}
              y={y(s.p) - letra * 0.7}
              textAnchor="middle"
              fontSize={i === serie.length - 1 ? letra * 1.15 : letra}
              fontWeight={i === serie.length - 1 ? 700 : 600}
              style={{ fill: "var(--rmcf-gold-ink)" }}
            >
              {s.p}º
            </text>
            {i % Math.ceil(serie.length / 12) === 0 || i === serie.length - 1 ? (
              <text x={x(i)} y={alto - letra / 3} textAnchor="middle" fontSize={letra} fill="currentColor" fillOpacity={0.65}>
                J{s.j}
              </text>
            ) : null}
          </g>
        ))}
      </svg>
    );
  };
  return (
    <>
      {lienzo(640, 420, 20, "md:hidden")}
      {lienzo(1200, 340, 14, "hidden md:block")}
    </>
  );
}

function diaCorto(cuando: string) {
  const d = new Date(`${cuando.slice(0, 10)}T12:00:00`);

  return Number.isNaN(d.getTime()) ? "" : d.toLocaleDateString("es-ES", { day: "numeric", month: "short" }).replace(".", "");
}

/* Puntos acumulados del Castilla frente a la media de un equipo de la liga, jornada a jornada. */
function GraficaPuntos({
  jugados,
  liga,
  equipos,
}: {
  jugados: { jornada: number; acumulados: number }[];
  liga: Map<number, number>;
  /** Cuántos equipos entran en la media: su base, en la leyenda (11/11/2026). */
  equipos: number;
}) {
  if (jugados.length < 2) return null;

  /* 16/11/2026 (fútbol): más alto (a 390 px las marcas se montaban) y, pasados los 12 puntos, una marca cada 6. */
  /* 30/10/2026: letra de los ejes a 14 en el lienzo de 640: a 390 px se quedaba en 6 px y no se leía. */
  /* 10/11/2026: sin rótulos al final de las líneas (la leyenda de arriba los dice): margen derecho corto. */
  /* 11/11/2026: sin ancho mínimo (a 390 px se cortaba en la J7) y con letra de
     20 en el lienzo de 640, que a 390 px queda en unos 11 px. */
  /* 17/11/2026 (ronda 19, análisis y marketing): en escritorio la curva se
     quedaba en media tarjeta (tope de 720 px). Ahora hay dos lienzos: el del
     móvil (640 × 300) y uno apaisado (1200 × 300) que llena la tarjeta. */
  const maximo = Math.max(3, ...jugados.map((u) => u.acumulados), ...jugados.map((u) => liga.get(u.jornada) ?? 0));
  const paso = maximo > 12 ? 6 : 3;
  const tope = Math.ceil(maximo / paso) * paso;
  const lienzo = (W: number, H: number, letra: number, clase: string) => {
    const M = { l: letra * 2 + 6, r: 24, t: 16, b: letra * 2 };
    const x = (i: number) => M.l + (i * (W - M.l - M.r)) / (jugados.length - 1);
    const y = (v: number) => H - M.b - (v * (H - M.t - M.b)) / tope;
    const nuestra = jugados.map((u, i) => `${x(i)},${y(u.acumulados)}`).join(" ");
    const puntosLiga = jugados.flatMap((u, i) => (liga.has(u.jornada) ? [`${x(i)},${y(liga.get(u.jornada)!)}`] : []));

    return (
      <svg viewBox={`0 0 ${W} ${H}`} className={`mt-3 h-auto w-full ${clase}`} role="img" aria-label="Puntos acumulados del Castilla frente a la media de la liga">
        {Array.from({ length: tope / paso + 1 }, (_, k) => k * paso).map((v) => (
          <g key={v}>
            <line x1={M.l} x2={W - M.r} y1={y(v)} y2={y(v)} stroke="currentColor" strokeOpacity={0.12} />
            <text x={M.l - 8} y={y(v) + letra / 3} textAnchor="end" fontSize={letra} fill="currentColor" fillOpacity={0.7}>
              {v}
            </text>
          </g>
        ))}
        {/* Con muchas jornadas, una de cada dos (y siempre la última) para que no se monten. */}
        {jugados.map((u, i) => (jugados.length > 12 && i % 2 === 1 && i !== jugados.length - 1 ? null : (
          <text key={u.jornada} x={x(i)} y={H - letra / 2} textAnchor="middle" fontSize={letra} fill="currentColor" fillOpacity={0.7}>
            J{u.jornada}
          </text>
        )))}
        {puntosLiga.length > 1 ? (
          <polyline points={puntosLiga.join(" ")} fill="none" stroke="currentColor" strokeOpacity={0.55} strokeWidth={2} strokeDasharray="5 4" />
        ) : null}
        <polyline points={nuestra} fill="none" stroke="#C8A96B" strokeWidth={2.5} />
        {jugados.map((u, i) => (
          <circle key={u.jornada} cx={x(i)} cy={y(u.acumulados)} r={3.5} fill="#C8A96B" />
        ))}
      </svg>
    );
  };

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
                  media de {equipos > 0 ? `los ${equipos} equipos` : "la liga"}, tras cada jornada <b className="tabular-nums">{f1(media)}</b>
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
      <div className="min-w-0">
        {lienzo(640, 300, 22, "md:hidden")}
        {lienzo(1200, 300, 15, "hidden md:block")}
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
  /* 16/11/2026 (análisis): el puesto del rival tras esa misma jornada, para ver contra quién se sumó. */
  const puestosRival = new Map<number, number>();
  /* 16/11/2026 (fútbol): los de arriba y abajo en la última tabla completa, para mirar al siguiente partido. */
  let vecinos: Vecinos | null = null;
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

    const i = orden.findIndex(([n]) => n === nuestro);

    puestos.set(uno.jornada, i + 1);

    const delRival = orden.findIndex(([n]) => mismoClub(n, uno.rival) || mismoClub(nombreEquipo(n), nombreEquipo(uno.rival)));

    if (delRival >= 0) puestosRival.set(uno.jornada, delRival + 1);

    const vecino = (k: number) => (orden[k] ? { puesto: k + 1, nombre: nombreEquipo(orden[k][0]), puntos: orden[k][1].pts } : null);

    vecinos = { jornada: uno.jornada, puntos: orden[i][1].pts, arriba: vecino(i - 1), abajo: vecino(i + 1) };
  }

  return { mediaPuntos, mediaGoles, puestos, puestosRival, vecinos, acumuladaLiga, equipos: equipos.size };
}, [golesLiga.value.partidos, jugados]);

/* La columna del puesto sólo se dibuja si hay puesto en todas las jornadas: una celda suelta en blanco es un hueco. */
const conPuesto = jugados.length > 0 && jugados.every((u) => liga.puestos.has(u.jornada));
/* Lo mismo para el puesto del rival: o en todas las filas, o en ninguna. */
const conPuestoRival = conPuesto && jugados.every((u) => liga.puestosRival.has(u.jornada));

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
| 16/11/2026 (análisis, marketing): la jornada y el día de corte, en el titular
| y en cada tarjeta. Sale del último partido nuestro con marcador.
*/
const ultimo = jugados.at(-1) ?? null;
const corte = ultimo ? `J${ultimo.jornada}${diaCorto(ultimo.cuando) ? `, ${diaCorto(ultimo.cuando)}` : ""}` : "";
/* Los títulos-conclusión del modo Visual. */
const mediaUltima = ultimo ? liga.acumuladaLiga.get(ultimo.jornada) : undefined;
const tituloPuntos = ultimo
  ? mediaUltima === undefined
    ? `Tras J${ultimo.jornada}, ${ultimo.acumulados} puntos en ${jugados.length} partidos`
    : `Tras J${ultimo.jornada}, ${ultimo.acumulados} puntos: ${
        Math.abs(ultimo.acumulados - mediaUltima) < 0.5
          ? `en la media de la liga (${coma1(mediaUltima)})`
          : `${coma1(Math.abs(ultimo.acumulados - mediaUltima))} ${ultimo.acumulados > mediaUltima ? "más" : "menos"} que la media de la liga (${coma1(mediaUltima)})`
      }`
  : "";
const tituloRacha = (() => {
  const ult = jugados.slice(-5);
  if (!ult.length) return "";
  const g = ult.filter((u) => u.puntos === 3).length;
  const e = ult.filter((u) => u.puntos === 1).length;
  const d = ult.length - g - e;
  const partes = [g ? `${g} ${g === 1 ? "victoria" : "victorias"}` : "", e ? `${e} ${e === 1 ? "empate" : "empates"}` : "", d ? `${d} ${d === 1 ? "derrota" : "derrotas"}` : ""].filter(Boolean);
  const lista = partes.length > 1 ? `${partes.slice(0, -1).join(", ")} y ${partes.at(-1)}` : partes[0];
  const pts = ult.reduce((s, u) => s + u.puntos, 0);
  return `${ult.length === jugados.length ? `En ${ult.length} partidos` : `En los ${ult.length} últimos`}: ${lista} (${pts} de ${ult.length * 3} puntos)`;
})();

/* 16/11/2026 (ronda 18): el título de la lámina del puesto. */
const tituloPuesto = (() => {
  const serie = jugados.map((u) => ({ j: u.jornada, p: liga.puestos.get(u.jornada) })).filter((x): x is { j: number; p: number } => typeof x.p === "number");
  if (serie.length < 2) return "";
  const primero = serie[0];
  const ahora = serie[serie.length - 1];
  const mejor = serie.reduce((a, b) => (b.p < a.p ? b : a));
  /* 17/11/2026 (ronda 19, fútbol): sin repetir el puesto cuando el de ahora es el mejor. */
  const esElMejor = mejor.p === ahora.p;
  const inicio = primero.p === ahora.p ? `igual que en la J${primero.j}` : `empezamos ${primero.p}º en la J${primero.j}`;
  return esElMejor
    ? `${ahora.p}º tras la J${ahora.j}, nuestro mejor puesto; ${inicio}`
    : `${ahora.p}º tras la J${ahora.j}; el mejor, ${mejor.p}º en la J${mejor.j}; ${inicio}`;
})();

/*
| 16/11/2026 (fútbol, marketing): qué hacemos con el dato. El siguiente
| partido y lo que hay en juego: los puntos al de arriba y al de abajo, de la
| última tabla completa, sólo si es la de nuestra última jornada.
*/
const proximo = useMemo(
  () =>
    ordenaPartidos(partidos)
      .map(comoNuestro)
      .find((uno) => uno.jornada > 0 && !uno.jugado) ?? null,
  [partidos],
);
const enJuego = (() => {
  const v = liga.vecinos;

  if (!v || !ultimo || v.jornada !== ultimo.jornada || (!v.arriba && !v.abajo)) return "";

  const pts = (n: number) => `${n} ${n === 1 ? "punto" : "puntos"}`;
  /* 16/11/2026 (expertos, ronda 18): sin repetir «empatados» dos veces. */
  if (v.arriba && v.abajo && v.arriba.puntos === v.puntos && v.abajo.puntos === v.puntos) {
    return `con los mismos puntos que el ${v.arriba.puesto}º (${v.arriba.nombre}) y el ${v.abajo.puesto}º (${v.abajo.nombre})`;
  }
  const trozos = [
    v.arriba
      ? v.arriba.puntos === v.puntos
        ? `con los mismos puntos que el ${v.arriba.puesto}º (${v.arriba.nombre})`
        : `a ${pts(v.arriba.puntos - v.puntos)} del ${v.arriba.puesto}º (${v.arriba.nombre})`
      : "",
    v.abajo
      ? v.abajo.puntos === v.puntos
        ? `con los mismos que el ${v.abajo.puesto}º (${v.abajo.nombre})`
        : `${pts(v.puntos - v.abajo.puntos)} por encima del ${v.abajo.puesto}º (${v.abajo.nombre})`
      : "",
  ].filter(Boolean);

  return trozos.join(" y ");
})();
/* 17/11/2026 (ronda 19): en la tarjeta Puesto, con quién estamos empatados a puntos. */
const puestoALaPar = (() => {
  const v = liga.vecinos;

  if (!v || !ultimo || v.jornada !== ultimo.jornada) return "";

  const iguales = [v.arriba, v.abajo].filter((o): o is Vecino => !!o && o.puntos === v.puntos).map((o) => `${o.puesto}º`);

  return iguales.length ? `empatados a ${v.puntos} con el ${iguales.join(" y el ")}` : "";
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

/*
| 17/11/2026 (ronda 19, los tres jueces): fuera el botón flotante «Ver
| explicación» (tapaba la curva a 1440 px) y el pliegue de Power BI al pie: el
| informe pide cuenta de Microsoft y no aporta al cuerpo técnico. Quedan como
| una línea al pie, con qué son.
*/
const src = "https://app.powerbi.com/view?r=eyJrIjoiNzY4NjNmZjktZWU3Zi00NjkyLTg5NTMtNzQwYjQwMGVjZmQxIiwidCI6ImQ2Zjc2YzExLWZmYjktNGExNS05YjQ5LWU2ZWQ0MjljOTVhMiIsImMiOjl9";
const videoUrl = "https://drive.google.com/file/d/1V-1mm_z7cM43ZXKaCHGRPlECx-IH1Nrt/view";

  return (
    <main className="min-h-screen bg-[#0B0F14] text-white">
      <div className="flex">
        <Sidebar />

        <section className="relative min-w-0 flex-1">
          <Topbar />

          {/* 11/11/2026 (marketing): fuera el botón flotante «Ver vídeo» del
              móvil; tapaba el resultado y los puntos de la J1. El vídeo queda
              como enlace bajo el botón de Power BI. */}

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
                  {corte && ultimo?.jornada === tabla.jugados ? ` (${corte})` : ""}
                  {liga.mediaPuntos !== null
                    ? `: ${(tabla.puntos / tabla.jugados).toLocaleString("es-ES", { maximumFractionDigits: 1 })} por partido frente a ${liga.mediaPuntos.toLocaleString("es-ES", { maximumFractionDigits: 1 })} de media en la liga.`
                    : "."}
                </p>
              ) : null}
              {/* 16/11/2026: lo que se hace con el dato: el siguiente partido y lo que hay en juego. */}
              {tabla && (proximo || enJuego) ? (
                <p className="mt-2 text-[14px] leading-snug text-white/75">
                  {proximo ? (
                    <>
                      <span className="font-semibold" style={{ color: "var(--rmcf-gold-ink)" }}>
                        Siguiente: J{proximo.jornada} · {nombreEquipo(proximo.rival)} ({proximo.lado === "casa" ? "en casa" : "fuera"}
                        {diaCorto(proximo.cuando) ? `, ${diaCorto(proximo.cuando)}` : ""})
                      </span>
                      {enJuego ? ". " : "."}
                    </>
                  ) : null}
                  {enJuego ? `${enJuego.charAt(0).toUpperCase()}${enJuego.slice(1)}.` : null}
                </p>
              ) : null}
              {/* 16/11/2026 (expertos, ronda 18): del siguiente partido, a un toque, lo que lo prepara. */}
              {proximo ? (
                <EnlacesRapidos
                  className="mt-2"
                  titulo={`Para la J${proximo.jornada}`}
                  enlaces={[
                    /* 17/11/2026 (ronda 19): el plan con el rival puesto, cómo le marcan y su coding. */
                    { href: conRivalEnUrl("/match-preparation", { equipo: proximo.rival }), texto: "Plan de partido", icono: ClipboardList },
                    { href: urlGolesDelEquipo(proximo.rival), texto: "Sus goles en vídeo", icono: Video },
                    { href: urlGolesDelEquipo(proximo.rival, "contra"), texto: "Cómo le marcan", icono: Video },
                    { href: `/scout-rival-abp?equipo=${encodeURIComponent(proximo.rival)}`, texto: "Su ABP", icono: Trophy },
                    { href: `/rivals?equipo=${encodeURIComponent(proximo.rival)}`, texto: "Su plantilla", icono: Users },
                    { href: `/coding?equipo=${encodeURIComponent(proximo.rival)}`, texto: "Su coding", icono: Clapperboard },
                  ]}
                />
              ) : null}
            </div>

            {/* 16/11/2026 (expertos, ronda 18): la fuente y el corte, una vez encima de las cuatro tarjetas. */}
            {tabla && corte ? (
              <p className="mb-2 text-[11px] uppercase tracking-[0.14em] text-white/55">Clasificación y marcadores · BeSoccer · hasta {corte}</p>
            ) : null}
            {tabla ? (
              <div className="mb-6 grid grid-cols-2 gap-3 sm:grid-cols-4">
                {(() => {
                  const dec = (n: number) => n.toLocaleString("es-ES", { minimumFractionDigits: 1, maximumFractionDigits: 1 });
                  const dif = tabla.favor - tabla.contra;
                  /* 16/11/2026 (marketing): la media de la liga, dentro de su tarjeta. */
                  const ligaPuntos = liga.mediaPuntos !== null ? ` · liga ${dec(liga.mediaPuntos)}` : "";
                  const ligaGoles = liga.mediaGoles !== null ? ` · liga ${dec(liga.mediaGoles)}` : "";

                  /* 29/10/2026: la cifra grande es el dato y debajo, pequeña, la referencia (fútbol y marketing). */
                  const tarjetas: { etiqueta: string; valor: ReactNode; largo?: boolean; referencia: string }[] = [
                    /* 17/11/2026 (ronda 19, análisis): con quién estamos a la par, en la tarjeta. */
                    { etiqueta: "Puesto", valor: `${tabla.puesto}º de ${tabla.deCuantos}`, referencia: [movimientoPuesto, puestoALaPar].filter(Boolean).join("\n") },
                    {
                      etiqueta: "Puntos",
                      valor: String(tabla.puntos),
                      referencia:
                        tabla.jugados > 0
                          ? `en ${tabla.jugados} partidos · ${dec(tabla.puntos / tabla.jugados)} por partido${ligaPuntos}`
                          : "",
                    },
                    /* 07/11/2026: «4-3-3» se leía como un sistema de juego.
                       16/11/2026 (fútbol): en el móvil se partía en dos líneas;
                       ahora son tres cifras con su rótulo debajo. */
                    {
                      etiqueta: "Balance",
                      valor: (
                        <span className="grid grid-cols-3 gap-1 text-center">
                          {[
                            [tabla.ganados, "ganados", "var(--rmcf-dif-mejor)"],
                            [tabla.empatados, "empatados", undefined],
                            [tabla.perdidos, "perdidos", "var(--rmcf-dif-peor)"],
                          ].map(([n, rotulo, color]) => (
                            <span key={String(rotulo)} className="flex min-w-0 flex-col items-center">
                              <span className="tabular-nums" style={color ? { color: String(color) } : undefined}>{n}</span>
                              <span className="mt-1 text-[10px] font-normal uppercase tracking-[0.08em] text-white/60">{rotulo}</span>
                            </span>
                          ))}
                        </span>
                      ),
                      referencia: "",
                    },
                    {
                      etiqueta: "Goles",
                      valor: `${tabla.favor}-${tabla.contra}`,
                      /* 29/10/2026: en dos renglones; en uno solo no se leía. */
                      referencia: `${tabla.favor} a favor · ${tabla.contra} en contra\ndiferencia ${dif > 0 ? "+" : dif < 0 ? "−" : ""}${Math.abs(dif)}${tabla.jugados > 0 ? ` · ${dec(tabla.favor / tabla.jugados)} a favor por partido${ligaGoles}` : ""}`,
                    },
                  ];

                  return tarjetas;
                })().map(({ etiqueta, valor, largo, referencia }) => (
                  <div
                    key={etiqueta}
                    className="flex min-w-0 flex-col rounded-2xl border border-white/10 bg-white/[0.04] px-4 py-3"
                  >
                    <p className="text-[11px] uppercase tracking-[0.25em] text-[#C8A96B]">
                      {etiqueta}
                    </p>
                    <div className={`mt-1 font-semibold leading-none text-white ${largo ? "text-2xl sm:text-3xl" : "text-3xl"}`}>{valor}</div>
                    {referencia ? <p className="mt-1.5 whitespace-pre-line text-[12px] leading-snug text-white/60">{referencia}</p> : null}
                  </div>
                ))}
                {liga.mediaPuntos !== null || liga.mediaGoles !== null ? (
                  <p className="col-span-2 text-[12px] text-white/60 sm:col-span-4">
                    «Liga»: media de {liga.equipos > 0 ? `los ${liga.equipos} equipos` : "la liga"} tras {tabla.jugados} {tabla.jugados === 1 ? "jornada" : "jornadas"}, por partido.
                  </p>
                ) : null}
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
                {/* 11/11/2026 (análisis): primero la curva de puntos frente a la
                    media, que se lee de un vistazo; debajo, la tabla. */}
                <VistaVisualDetalle
                  pantalla="collective-history"
                  visual={
                    <div className="grid min-w-0 gap-4">
                      <Lamina>
                        <TituloConclusion pregunta="¿Vamos por encima de la media?" fuente={`Calendario y marcadores de BeSoccer · la media, de los ${liga.equipos || 20} equipos`}>
                          {tituloPuntos}
                        </TituloConclusion>
                        <GraficaPuntos jugados={jugados} liga={liga.acumuladaLiga} equipos={liga.equipos} />
                      </Lamina>
                      {conPuesto && tituloPuesto ? (
                        <Lamina>
                          <TituloConclusion pregunta="¿Dónde estamos en la tabla?" fuente={`Clasificación tras cada jornada, con todos los partidos de la liga · ${jugados.length} jornadas, tendencia`}>
                            {tituloPuesto}
                          </TituloConclusion>
                          <GraficaPuesto jugados={jugados} puestos={liga.puestos} equipos={liga.equipos} />
                        </Lamina>
                      ) : null}
                      <Lamina>
                        <TituloConclusion pregunta="¿Cómo va la racha?" fuente={`${jugados.length} partidos de liga`}>
                          {tituloRacha}
                        </TituloConclusion>
                        <RachaPartidos jugados={jugados} puestos={conPuesto ? liga.puestos : null} />
                      </Lamina>
                    </div>
                  }
                  detalle={
                <>
                <div className="mb-4">
                  <GraficaPuntos jugados={jugados} liga={liga.acumuladaLiga} equipos={liga.equipos} />
                </div>

                <div className="overflow-x-auto rounded-[18px] border border-white/10">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-white/10 text-left text-xs uppercase tracking-wider text-white/60">
                        <th className="px-3 py-3 font-medium sm:px-4">
                          <span className="sm:hidden">J</span>
                          <span className="hidden sm:inline">Jornada</span>
                        </th>
                        <th className="px-3 py-3 font-medium sm:px-4">
                          Rival
                          {conPuestoRival ? (
                            <span className="block text-[10px] font-normal normal-case tracking-normal text-white/50">y su puesto tras esa jornada</span>
                          ) : null}
                        </th>
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
                        {conPuesto ? (
                          <th className="px-3 py-3 text-right font-semibold sm:pl-4 sm:pr-16" style={{ color: "var(--rmcf-gold-ink)", background: "rgb(200 169 107 / .08)" }}>
                            <span className="sm:hidden">Puesto</span>
                            <span className="hidden sm:inline">Nuestro puesto</span>
                          </th>
                        ) : null}
                      </tr>
                    </thead>
                    <tbody>
                      {jugados.map((uno, i) => (
                        <tr
                          key={uno.jornada}
                          className={`border-b border-white/5 last:border-0 ${i === jugados.length - 1 ? "bg-white/[0.06]" : ""}`}
                        >
                          {/* 16/11/2026 (expertos, ronda 18): la jornada abre su post en Análisis de datos y el rival, su plantilla. */}
                          <td className="px-3 py-2.5 sm:px-4">
                            {uno.cuando ? (
                              <Link href={urlPostDelPartido(uno.cuando, uno.rival)} title={`Post del partido de la J${uno.jornada}`} className="underline decoration-[#C8A96B]/50 underline-offset-4 hover:decoration-[#C8A96B]">
                                J{uno.jornada}
                              </Link>
                            ) : (
                              <>J{uno.jornada}</>
                            )}
                          </td>
                          <td className="min-w-0 px-3 py-2.5 sm:px-4">
                            <span className="block">
                              <Link href={`/rivals?equipo=${encodeURIComponent(uno.rival)}`} className="hover:underline">
                                {nombreEquipo(uno.rival)}
                              </Link>
                              {/* 16/11/2026 (análisis): contra quién se sumó, con su puesto del momento. */}
                              {conPuestoRival ? (
                                <span
                                  className="ml-1.5 inline-block rounded px-1.5 text-[11px] font-semibold tabular-nums text-white/70"
                                  style={{ background: "rgb(var(--rmcf-ink-rgb) / .08)" }}
                                  title={`${nombreEquipo(uno.rival)}: ${liga.puestosRival.get(uno.jornada)}º tras la J${uno.jornada}`}
                                >
                                  {liga.puestosRival.get(uno.jornada)}º
                                </span>
                              ) : null}
                            </span>
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
                            <td
                              className="px-3 py-2.5 text-right font-semibold tabular-nums sm:pl-4 sm:pr-16"
                              style={{ color: "var(--rmcf-gold-ink)", background: "rgb(200 169 107 / .08)" }}
                            >
                              {liga.puestos.get(uno.jornada)}º
                            </td>
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
                    Puesto: la clasificación tras cada jornada, con todos los partidos de la liga hasta ella
                    {conPuestoRival ? "; el del rival, de la misma tabla" : ""}. Con {jugados.length} jornadas es una tendencia.
                  </p>
                ) : null}
                </>
                  }
                />

              </div>
            ) : null}

            {/* 17/11/2026 (ronda 19): Power BI, una línea al pie que dice qué es. */}
            <p className="text-[12px] leading-snug text-white/60">
              Aparte, el informe antiguo de la competición en Power BI (pide cuenta de Microsoft; esta pantalla no depende de él):{" "}
              <a href={src} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 underline underline-offset-4 hover:text-[#C8A96B]">
                abrirlo<ExternalLink className="h-3 w-3" aria-hidden />
              </a>{" "}
              ·{" "}
              <a href={videoUrl} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 underline underline-offset-4 hover:text-[#C8A96B]">
                vídeo de cómo se lee<ExternalLink className="h-3 w-3" aria-hidden />
              </a>
            </p>
          </div>
        </section>
      </div>
    </main>
  );
}