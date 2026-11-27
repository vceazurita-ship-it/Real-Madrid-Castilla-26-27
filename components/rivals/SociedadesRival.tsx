"use client";

/**
 * SUS SOCIEDADES EN EL ÚLTIMO TERCIO: EL TRÍO QUE MÁS SE ASOCIA
 * (Scout colectivo, 23/11/2026, idea de X). La red de pases del rival sólo en
 * el último tercio y, de ella, los 3-4 jugadores que más se conectan: cada
 * uno en su posición media y la línea entre dos, más gruesa cuantos más pases
 * se dan. Al lado, el carril donde más se juntan y qué parte de sus remates
 * nace de una cadena con al menos dos de ellos.
 *
 * Datos: `opta:directo:archivo` y `opta:directo:<partido>` de sus últimos
 * partidos, por `useDocsOpta` (los mismos documentos que «Amplitud por
 * banda», misma caché). Las cuentas, en `lib/rivals/sociedades.ts`. Sin dato
 * no se pinta; nada se pide hasta que asoma.
 */

import { useMemo } from "react";

import { COMPARADO, ORO, tinta } from "@/components/data/graficas";
import { useAsoma } from "@/hooks/useAsoma";
import { useDocsOpta } from "@/hooks/useDocsOpta";
import { aObjetos, CASTILLA_OPTA, DOCS_OPTA, type TablaOpta } from "@/lib/opta";
import { casaEquipo } from "@/lib/opta-eventos";
import { leeEventos, leeJugadores } from "@/lib/opta-directo-mapas";
import { nombreDeRival } from "@/lib/rivals/nombre-jugador";
import {
  CARRILES,
  MAX_PARTIDOS,
  MIN_PASES_SOCIEDAD,
  sociedades,
  VENTANA_CADENA_S,
  VENTANA_RECEPTOR_S,
  X_TERCIO,
  type Carril,
} from "@/lib/rivals/sociedades";

type PartidoArchivo = { partido?: string; fecha?: string; equipos?: string[] };
type Archivo = { partidos?: PartidoArchivo[] };
type DocDirecto = { partido?: string; fecha?: string; eventos?: TablaOpta; jugadores?: TablaOpta };

const pct = (v: number) => `${Math.round(v * 100)} %`;
const dec = (v: number, n = 2) => v.toFixed(n).replace(".", ",");

/** El rival ataca hacia la derecha: su izquierda (y alta) es nuestra derecha. */
const CARRIL: Record<Carril, string> = {
  izquierda: "su banda izquierda (nuestra derecha)",
  centro: "el carril central",
  derecha: "su banda derecha (nuestra izquierda)",
};
const CARRIL_CORTO: Record<Carril, string> = { izquierda: "Su izquierda", centro: "Centro", derecha: "Su derecha" };

export function SociedadesRival({ equipo, nombres = [] }: { equipo: string; nombres?: string[] }) {
  const { caja, abierto } = useAsoma<HTMLDivElement>(2000);
  return <div ref={caja} className="min-w-0">{abierto && equipo && <Indice equipo={equipo} nombres={nombres} />}</div>;
}

function Indice({ equipo, nombres }: { equipo: string; nombres: string[] }) {
  const { docs } = useDocsOpta<[TablaOpta, Archivo]>(DOCS_OPTA.equipos, "opta:directo:archivo");
  const [tEquipos, archivo] = docs;

  const rival = useMemo(() => {
    if (!tEquipos) return null;
    const equipos = aObjetos(tEquipos).map((f) => ({ teamId: String(f.teamId ?? ""), equipo: String(f.equipo ?? "") }));
    const id = casaEquipo(equipo, equipos);
    if (!id || id === CASTILLA_OPTA) return null;
    return { id, nombre: equipos.find((e) => e.teamId === id)?.equipo || equipo };
  }, [tEquipos, equipo]);

  const ids = useMemo(() => {
    if (!rival || !Array.isArray(archivo?.partidos)) return [];
    return archivo.partidos
      .filter((p) => p?.partido && (p.equipos ?? []).includes(rival.nombre))
      .sort((a, b) => String(b.fecha ?? "").localeCompare(String(a.fecha ?? "")))
      .slice(0, MAX_PARTIDOS)
      .map((p) => String(p.partido));
  }, [rival, archivo]);

  if (!rival || !ids.length) return null;
  return <Bloque teamId={rival.id} nombre={rival.nombre} ids={ids} nombres={nombres} />;
}

function Bloque({ teamId, nombre, ids, nombres }: { teamId: string; nombre: string; ids: string[]; nombres: string[] }) {
  const { docs, cargando } = useDocsOpta<DocDirecto[]>(...ids.map(DOCS_OPTA.directo));

  const datos = useMemo(() => {
    const quien = new Map<string, { nombre: string; dorsal: string }>();
    const partidos = docs
      .map((d, i) => {
        if (!d) return null;
        for (const j of leeJugadores(d.jugadores)) if (j.id && j.teamId === teamId) quien.set(j.id, { nombre: j.nombre, dorsal: j.dorsal });
        return { partido: ids[i], eventos: leeEventos(d.eventos) };
      })
      .filter((p): p is NonNullable<typeof p> => p != null && p.eventos.length > 0);
    const s = partidos.length ? sociedades(partidos, teamId) : null;
    return s ? { s, quien } : null;
  }, [docs, ids, teamId]);

  if (!datos) {
    if (!cargando) return null;
    return (
      <section aria-label="Sus sociedades" className="portada-tarjeta mt-8 min-w-0 px-4 py-4 sm:px-5">
        <p className="text-[12px] font-semibold uppercase tracking-[0.16em] text-[#C8A96B]">Sus sociedades · el trío que más se asocia</p>
        <p className="mt-1 text-sm text-white/60">Leyendo el evento a evento de sus últimos {ids.length} partidos…</p>
      </section>
    );
  }

  const { s, quien } = datos;
  const nombreDe = (id: string) => {
    const n = quien.get(id)?.nombre || "";
    return (n && (nombreDeRival(n, nombres) || n)) || `Jugador ${id}`;
  };
  const corto = (id: string) => {
    const n = nombreDe(id).trim().split(/\s+/);
    return n.length > 1 ? n[n.length - 1] : n[0];
  };
  const nodos = s.grupo.map((id) => s.nodos.find((x) => x.id === id)!).filter(Boolean);
  const enGrupo = new Set(s.grupo);
  const lazos = s.enlaces.filter((e) => enGrupo.has(e.a) && enGrupo.has(e.b) && e.n > 0).sort((a, b) => b.n - a.n);
  const maxLazo = Math.max(1, ...lazos.map((l) => l.n));
  const parte = s.remates ? s.rematesCadena / s.remates : 0;
  const parteXg = s.xg ? s.xgCadena / s.xg : 0;
  const pctCarril = s.pasesGrupo ? s.porCarril[s.carril] / s.pasesGrupo : 0;
  const lista = s.grupo.map(nombreDe);
  const listaTexto = lista.length > 1 ? `${lista.slice(0, -1).join(", ")} y ${lista[lista.length - 1]}` : lista[0];
  const principal = lazos[0];

  const titular =
    s.carril === "centro" ? `Su sociedad se junta por dentro: hay que cerrar el carril central` : `Su sociedad carga ${CARRIL[s.carril]}: hay que juntar gente ahí`;
  const frase =
    `En el último tercio, ${listaTexto} se dan ${s.pasesGrupo} pases entre ellos en sus últimos ${s.partidos} partidos ` +
    `(${dec(s.pasesGrupo / s.partidos, 1)} por partido; el ${pct(s.pasesGrupo / s.pases)} de su red ahí). ` +
    (principal ? `La conexión que más se repite es ${nombreDe(principal.a)}–${nombreDe(principal.b)} (${principal.n} pases).` : "");
  const consejo = s.remates
    ? `El ${pct(parte)} de sus remates (${s.rematesCadena} de ${s.remates}, ${pct(parteXg)} de su xG) nace de una cadena en la que tocan al menos dos de ellos: ${
        parte >= 0.4 ? "cortar esa conexión es quitarle buena parte de su ataque." : "pesa, pero también llega por otras vías."
      }`
    : "";

  const cifras = [
    {
      rotulo: "Dónde se juntan",
      valor: CARRIL_CORTO[s.carril],
      nota: `${pct(pctCarril)} de sus pases entre ellos · ${CARRILES.map((c) => `${CARRIL_CORTO[c]} ${s.porCarril[c]}`).join(" · ")}`,
    },
    {
      rotulo: "Remates con 2 de ellos o más",
      valor: s.remates ? pct(parte) : "—",
      nota: s.remates ? `${s.rematesCadena} de ${s.remates} remates · ${dec(s.xgCadena)} de ${dec(s.xg)} xG` : "Sin remates en esos partidos",
    },
    {
      rotulo: "Pases entre ellos",
      valor: String(s.pasesGrupo),
      nota: `${dec(s.pasesGrupo / s.partidos, 1)} por partido · ${s.pases} pases del rival en el último tercio`,
    },
  ];

  return (
    <section id="x-idea-2124598849268322563-1" aria-label="Sus sociedades" className="portada-tarjeta portada-entra mt-8 min-w-0 scroll-mt-20 px-4 py-4 sm:px-5">
      <p className="flex flex-wrap items-baseline gap-x-2 gap-y-1 text-[12px] font-semibold uppercase tracking-[0.16em] text-[#C8A96B]">
        Sus sociedades · el trío que más se asocia
        <span className="rounded-full border border-white/15 px-2 py-0.5 text-[11px] font-semibold normal-case tracking-normal text-white/60">
          dato · Opta, {s.partidos} {s.partidos === 1 ? "partido" : "partidos"} de {nombre}
        </span>
        {s.partidos < 5 && (
          <span className="rounded-full border border-amber-400/40 px-2 py-0.5 text-[11px] font-semibold normal-case tracking-normal text-amber-300">tendencia</span>
        )}
      </p>
      <h3 className="fuente-club mt-1.5 text-[26px] font-bold uppercase leading-[1.05] text-white sm:text-[32px]">{titular}</h3>
      <p className="mt-1 text-sm leading-6 text-white/70">{frase}</p>
      {consejo && <p className="mt-1 text-sm font-semibold leading-6 text-white/85">{consejo}</p>}

      <div className="mt-3 grid min-w-0 gap-3 lg:grid-cols-[minmax(0,1fr)_15rem]">
        <figure className="portada-celda m-0 min-w-0 p-3">
          <Campo nodos={nodos} lazos={lazos} maxLazo={maxLazo} carril={s.carril} corto={corto} nombreDe={nombreDe} dorsal={(id) => quien.get(id)?.dorsal ?? ""} nombreRival={nombre} />
          <figcaption className="mt-2 flex flex-wrap gap-1.5">
            {lazos.map((l) => (
              <span key={`${l.a}|${l.b}`} className="inline-flex items-center gap-1.5 rounded-full border border-white/10 px-2.5 py-1 text-[12px] font-semibold text-white/70">
                <svg width="16" height="8" aria-hidden className="shrink-0">
                  <line x1="0" y1="4" x2="16" y2="4" style={{ stroke: ORO, strokeWidth: 1 + (5 * l.n) / maxLazo }} />
                </svg>
                {corto(l.a)}–{corto(l.b)} <span className="tabular-nums text-white/50">{l.n}</span>
              </span>
            ))}
          </figcaption>
        </figure>

        <ul className="grid min-w-0 grid-cols-1 gap-2 sm:grid-cols-3 lg:grid-cols-1">
          {cifras.map((c) => (
            <li key={c.rotulo} className="portada-celda min-w-0 px-3 py-2.5">
              <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-white/55">{c.rotulo}</p>
              <p className="fuente-club mt-0.5 text-[28px] font-bold leading-none text-white tabular-nums">{c.valor}</p>
              <p className="mt-1 text-[11px] leading-4 text-white/55">{c.nota}</p>
            </li>
          ))}
        </ul>
      </div>

      <p className="mt-2 text-[11px] leading-5 text-white/55">
        Red de pases del último tercio: pases en juego completados del rival (sin saques de banda ni de puerta) que acaban con x ≥ {X_TERCIO} (de 100). El receptor es quien hace
        el siguiente evento de su equipo en los {VENTANA_RECEPTOR_S} s siguientes. Cada punto va en la posición media del jugador en esos pases (donde pasa y donde recibe) y la
        línea es más gruesa cuantos más pases se dan los dos, en los dos sentidos. La sociedad: el trío con más pases entre sí (mínimo {MIN_PASES_SOCIEDAD}), más un cuarto si da o
        recibe con ellos al menos un tercio de eso. Carril: el del destino de sus pases entre ellos. Remates en cadena: los suyos con al menos dos de ellos tocando el balón en
        los {VENTANA_CADENA_S} s de antes (quien remata incluido), hasta que lo gana el contrario. El rival ataca hacia la derecha.
      </p>
    </section>
  );
}

/* Medio campo de ataque del rival, en metros (su ataque hacia la derecha). */
const L = 105;
const A = 68;
const X0 = 45;
const MG = 2;

function Campo({
  nodos,
  lazos,
  maxLazo,
  carril,
  corto,
  nombreDe,
  dorsal,
  nombreRival,
}: {
  nodos: { id: string; x: number; y: number; pases: number; recibe: number }[];
  lazos: { a: string; b: string; n: number }[];
  maxLazo: number;
  carril: Carril;
  corto: (id: string) => string;
  nombreDe: (id: string) => string;
  dorsal: (id: string) => string;
  nombreRival: string;
}) {
  const X = (x: number) => (x / 100) * L;
  const Y = (y: number) => ((100 - y) / 100) * A;
  const linea = { stroke: tinta(0.3), fill: "none", strokeWidth: 0.35 } as const;
  const tercio = X(X_TERCIO);
  const banda = carril === "izquierda" ? [0, A / 3] : carril === "centro" ? [A / 3, (2 * A) / 3] : [(2 * A) / 3, A];
  const sitio = new Map(nodos.map((n) => [n.id, n]));
  const maxToques = Math.max(1, ...nodos.map((n) => n.pases + n.recibe));

  return (
    <svg
      viewBox={`${X(X0) - MG} ${-MG} ${L - X(X0) + MG * 2} ${A + MG * 2}`}
      className="grafico-cabe block h-auto w-full"
      role="img"
      aria-label={`Sociedad de ${nombreRival} en el último tercio: ${nodos.map((n) => nombreDe(n.id)).join(", ")}, unidos por líneas según los pases que se dan`}
    >
      <rect x={X(X0)} y={0} width={L - X(X0)} height={A} style={{ fill: tinta(0.04) }} />
      <rect x={tercio} y={0} width={L - tercio} height={A} style={{ fill: tinta(0.04) }} />
      <rect x={tercio} y={banda[0]} width={L - tercio} height={banda[1] - banda[0]} style={{ fill: "rgb(200 169 107 / 0.16)" }} />
      <rect x={X(X0)} y={0} width={L - X(X0)} height={A} style={linea} />
      <line x1={L / 2} y1={0} x2={L / 2} y2={A} style={linea} />
      <rect x={L - 16.5} y={(A - 40.32) / 2} width={16.5} height={40.32} style={linea} />
      <rect x={L - 5.5} y={(A - 18.32) / 2} width={5.5} height={18.32} style={linea} />
      <line x1={tercio} y1={0} x2={tercio} y2={A} style={{ ...linea, strokeDasharray: "1.2 1.2" }} />
      {[A / 3, (2 * A) / 3].map((y) => (
        <line key={y} x1={tercio} y1={y} x2={L} y2={y} style={{ ...linea, strokeDasharray: "0.8 1.6", stroke: tinta(0.2) }} />
      ))}
      <text x={X(X0) + 1.5} y={4.2} style={{ fill: tinta(0.5), fontSize: 2.6, fontWeight: 700 }}>SU IZQUIERDA · NUESTRA DER.</text>
      <text x={X(X0) + 1.5} y={A - 1.6} style={{ fill: tinta(0.5), fontSize: 2.6, fontWeight: 700 }}>SU DERECHA · NUESTRA IZQ.</text>
      <text x={tercio + 1} y={A / 2 + 1} style={{ fill: tinta(0.45), fontSize: 2.4, fontWeight: 700 }}>ÚLTIMO TERCIO</text>
      <text x={X(X0) + 1.5} y={A / 2 + 1} style={{ fill: tinta(0.45), fontSize: 2.4, fontWeight: 700 }}>ATACA →</text>

      {lazos.map((l) => {
        const a = sitio.get(l.a);
        const b = sitio.get(l.b);
        if (!a || !b) return null;
        return (
          <line
            key={`${l.a}|${l.b}`}
            x1={X(a.x)}
            y1={Y(a.y)}
            x2={X(b.x)}
            y2={Y(b.y)}
            style={{ stroke: ORO, strokeWidth: 0.5 + (2.6 * l.n) / maxLazo, opacity: 0.85, strokeLinecap: "round" }}
          >
            <title>{`${nombreDe(l.a)} – ${nombreDe(l.b)}: ${l.n} pases`}</title>
          </line>
        );
      })}
      {nodos.map((n) => {
        const r = 2.2 + (1.6 * (n.pases + n.recibe)) / maxToques;
        const d = dorsal(n.id);
        return (
          <g key={n.id}>
            <circle cx={X(n.x)} cy={Y(n.y)} r={r} style={{ fill: COMPARADO, stroke: tinta(0.9), strokeWidth: 0.4 }}>
              <title>{`${nombreDe(n.id)}: da ${n.pases} y recibe ${n.recibe} pases en el último tercio`}</title>
            </circle>
            {d && (
              <text x={X(n.x)} y={Y(n.y) + 0.9} textAnchor="middle" style={{ fill: "#fff", fontSize: 2.4, fontWeight: 800 }}>
                {d}
              </text>
            )}
            <text x={X(n.x)} y={Y(n.y) + r + 3} textAnchor="middle" style={{ fill: tinta(0.85), fontSize: 2.6, fontWeight: 700 }}>
              {corto(n.id)}
            </text>
          </g>
        );
      })}
    </svg>
  );
}
