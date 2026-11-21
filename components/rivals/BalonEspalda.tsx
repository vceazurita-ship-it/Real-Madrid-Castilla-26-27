"use client";

/**
 * ¿SE LE GANA LA ESPALDA? BALONES LARGOS A SU ESPALDA Y EN QUÉ ACABAN
 * (Scout colectivo, 21/11/2026, idea de X). Un campograma con los pases
 * largos y en profundidad que le hacen al rival y acaban en los últimos 25 m
 * por dentro, cada uno con su flecha (origen → destino) coloreada según en qué
 * acaba en los 10 s siguientes. Al lado, tres cifras contra la media de su
 * liga: % que acaba en remate, xG por balón y de qué carril salen más.
 *
 * Datos: `opta:equipos`, `opta:directo:archivo` y `opta:directo:<partido>`
 * de los últimos 8 partidos de cada equipo de su liga, por `useDocsOpta` (los
 * mismos documentos que «Cómo progresa», así que van en la misma caché). Las
 * cuentas, en `lib/rivals/balon-espalda.ts`. Sin dato no se pinta; nada se
 * pide hasta que asoma.
 */

import { useMemo, useState } from "react";

import { COMPARADO, MEJOR, ORO, PEOR, tinta } from "@/components/data/graficas";
import { useAsoma } from "@/hooks/useAsoma";
import { useDocsOpta } from "@/hooks/useDocsOpta";
import { aObjetos, CASTILLA_OPTA, DOCS_OPTA, type TablaOpta } from "@/lib/opta";
import { casaEquipo } from "@/lib/opta-eventos";
import { leeEventos } from "@/lib/opta-directo-mapas";
import {
  AVANCE_M,
  balonesContra,
  CARRILES,
  carrilMayor,
  DESENLACES,
  MAX_PARTIDOS,
  media,
  MIN_BALONES,
  resume,
  ULTIMOS_M,
  VENTANA_S,
  veredicto,
  X_ZONA,
  Y_CENTRAL,
  type BalonEspalda as Balon,
  type Carril,
  type Desenlace,
  type ResumenEspalda,
} from "@/lib/rivals/balon-espalda";

type PartidoArchivo = { partido?: string; fecha?: string; equipos?: string[] };
type Archivo = { partidos?: PartidoArchivo[] };
type DocDirecto = { eventos?: TablaOpta };

const pct = (v: number) => `${Math.round(v * 100)} %`;
const dec = (v: number, n = 2) => v.toFixed(n).replace(".", ",");

const COLOR: Record<Desenlace, string> = {
  remate: MEJOR,
  falta: ORO,
  despeje: COMPARADO,
  perdida: PEOR,
  sigue: "rgb(var(--rmcf-ink-rgb) / 0.4)",
};
const NOMBRE: Record<Desenlace, string> = {
  remate: "Remate",
  falta: "Falta a favor",
  despeje: "Despeje",
  perdida: "Pérdida",
  sigue: "Sigue sin rematar",
};
/** Visto desde quien le ataca (nosotros): nuestra izquierda es su derecha. */
const CARRIL: Record<Carril, string> = {
  izquierda: "nuestra izquierda (su banda derecha)",
  centro: "el centro",
  derecha: "nuestra derecha (su banda izquierda)",
};
const CARRIL_CORTO: Record<Carril, string> = { izquierda: "Izquierda", centro: "Centro", derecha: "Derecha" };

export function BalonEspalda({ equipo }: { equipo: string }) {
  const { caja, abierto } = useAsoma<HTMLDivElement>(2000);
  return <div ref={caja} className="min-w-0">{abierto && equipo && <Indice equipo={equipo} />}</div>;
}

/** Qué equipos son su liga y qué partidos hay que leer de cada uno (como «Cómo progresa»). */
function Indice({ equipo }: { equipo: string }) {
  const { docs } = useDocsOpta<[TablaOpta, Archivo]>(DOCS_OPTA.equipos, "opta:directo:archivo");
  const [tEquipos, archivo] = docs;

  const plan = useMemo(() => {
    if (!tEquipos || !Array.isArray(archivo?.partidos)) return null;
    const equipos = aObjetos(tEquipos).map((f) => ({ teamId: String(f.teamId ?? ""), equipo: String(f.equipo ?? "") }));
    const rivalId = casaEquipo(equipo, equipos);
    if (!rivalId || rivalId === CASTILLA_OPTA) return null;
    const nombreRival = equipos.find((e) => e.teamId === rivalId)?.equipo || "";
    const partidos = archivo.partidos.filter((p) => p?.partido && (p.equipos ?? []).length >= 2);

    const liga = new Set([nombreRival]);
    for (let vuelta = 0; vuelta < 3; vuelta++) {
      for (const p of partidos) {
        const [a, b] = p.equipos ?? [];
        if (liga.has(a) || liga.has(b)) {
          liga.add(a);
          liga.add(b);
        }
      }
    }
    const idDe = new Map(equipos.map((e) => [e.equipo, e.teamId]));
    const ids = new Set<string>();
    const miembros: string[] = [];
    const suyos = new Map<string, string[]>();
    for (const nombre of liga) {
      const teamId = idDe.get(nombre);
      if (!teamId) continue;
      miembros.push(teamId);
      const ultimos = partidos
        .filter((p) => (p.equipos ?? []).includes(nombre))
        .sort((a, b) => String(b.fecha ?? "").localeCompare(String(a.fecha ?? "")))
        .slice(0, MAX_PARTIDOS)
        .map((p) => String(p.partido));
      suyos.set(teamId, ultimos);
      ultimos.forEach((id) => ids.add(id));
    }
    if (miembros.length < 4 || !ids.size) return null;
    const fechas = new Map(partidos.map((p) => [String(p.partido), String(p.fecha ?? "")]));
    return { rivalId, nombreRival, miembros, suyos, ids: [...ids], fechas };
  }, [tEquipos, archivo, equipo]);

  if (!plan) return null;
  return <Bloque {...plan} />;
}

function Bloque({
  rivalId,
  nombreRival,
  miembros,
  suyos,
  ids,
  fechas,
}: {
  rivalId: string;
  nombreRival: string;
  miembros: string[];
  suyos: Map<string, string[]>;
  ids: string[];
  fechas: Map<string, string>;
}) {
  const { docs, cargando } = useDocsOpta<DocDirecto[]>(...ids.map(DOCS_OPTA.directo));

  const datos = useMemo(() => {
    const porId = new Map<string, { partido: string; fecha: string; eventos: ReturnType<typeof leeEventos> }>();
    docs.forEach((d, i) => {
      const eventos = d ? leeEventos(d.eventos) : [];
      if (eventos.length) porId.set(ids[i], { partido: ids[i], fecha: fechas.get(ids[i]) ?? "", eventos });
    });
    if (!porId.size) return null;
    const de = (teamId: string) => (suyos.get(teamId) ?? []).map((id) => porId.get(id)).filter((p): p is NonNullable<typeof p> => p != null);

    const resumenes: { teamId: string; r: ResumenEspalda }[] = [];
    let delRival: Balon[] = [];
    for (const teamId of miembros) {
      const { balones, partidos } = balonesContra(de(teamId), teamId);
      if (teamId === rivalId) delRival = balones;
      const r = resume(balones, partidos);
      if (r && r.n >= MIN_BALONES) resumenes.push({ teamId, r });
    }
    const rival = resumenes.find((x) => x.teamId === rivalId)?.r;
    const otros = resumenes.filter((x) => x.teamId !== rivalId).map((x) => x.r);
    if (!rival || otros.length < 3) return null;
    const liga = {
      equipos: otros.length,
      remate: media(otros.map((r) => r.remate)),
      xgPorBalon: media(otros.map((r) => r.xgPorBalon)),
      porPartido: media(otros.map((r) => r.porPartido)),
      carril: Object.fromEntries(CARRILES.map((c) => [c, media(otros.map((r) => r.carril[c]))])) as Record<Carril, number>,
      porCarrilRemate: Object.fromEntries(CARRILES.map((c) => [c, media(otros.map((r) => r.porCarril[c].remate))])) as Record<Carril, number>,
    };
    const puesto = (k: "remate" | "xgPorBalon") => [...resumenes].sort((a, b) => b.r[k] - a.r[k]).findIndex((x) => x.teamId === rivalId) + 1;
    return { rival, balones: delRival, liga, total: resumenes.length, puestoRemate: puesto("remate"), puestoXg: puesto("xgPorBalon") };
  }, [docs, ids, fechas, miembros, suyos, rivalId]);

  const [solo, setSolo] = useState<Desenlace | null>(null);

  if (!datos) {
    if (!cargando) return null;
    return (
      <section aria-label="Balón a la espalda" className="portada-tarjeta mt-8 min-w-0 px-4 py-4 sm:px-5">
        <p className="text-[12px] font-semibold uppercase tracking-[0.16em] text-[#C8A96B]">Balón a la espalda · ¿se le gana en largo?</p>
        <p className="mt-1 text-sm text-white/60">Leyendo el evento a evento de {ids.length} partidos de la liga…</p>
      </section>
    );
  }

  const { rival, balones, liga, total, puestoRemate, puestoXg } = datos;
  const v = veredicto(rival, liga);
  const mayor = carrilMayor(rival);
  /* El carril que más rinde (en % de remate), con al menos 4 balones. */
  const mejor = CARRILES.filter((c) => rival.porCarril[c].n >= 4).reduce<Carril | null>(
    (a, c) => (a == null || rival.porCarril[c].remate > rival.porCarril[a].remate ? c : a),
    null,
  );
  const titular =
    v === "compensa" ? "Compensa atacarle la espalda" : v === "no compensa" ? "Atacarle la espalda en largo es perder balones" : "Su espalda, como la de la liga";
  const frase =
    `En sus últimos ${rival.partidos} partidos le han metido ${rival.n} balones a la espalda (${dec(rival.porPartido, 1)} por partido; liga ${dec(liga.porPartido, 1)}). ` +
    `El ${pct(rival.remate)} acaba en remate (${puestoRemate}.º de ${total}; liga ${pct(liga.remate)}) y cada uno vale ${dec(rival.xgPorBalon)} xG (liga ${dec(liga.xgPorBalon)}).`;
  const consejo =
    mejor && rival.porCarril[mejor].remate > 0
      ? v === "no compensa"
        ? `Si se le busca, mejor desde ${CARRIL[mejor]}: ahí acaba en remate el ${pct(rival.porCarril[mejor].remate)} (liga ${pct(liga.porCarrilRemate[mejor])}).`
        : `Por donde más rinde: desde ${CARRIL[mejor]}, el ${pct(rival.porCarril[mejor].remate)} acaba en remate (liga ${pct(liga.porCarrilRemate[mejor])}).`
      : "";

  const cifras = [
    { rotulo: "Acaba en remate", valor: pct(rival.remate), liga: pct(liga.remate), mas: rival.remate >= liga.remate, nota: `${rival.cuenta.remate} de ${rival.n} · ${puestoRemate}.º de ${total}` },
    { rotulo: "xG por balón", valor: dec(rival.xgPorBalon), liga: dec(liga.xgPorBalon), mas: rival.xgPorBalon >= liga.xgPorBalon, nota: `${puestoXg}.º de ${total}` },
    {
      rotulo: "Sale más de",
      valor: CARRIL_CORTO[mayor],
      liga: pct(liga.carril[mayor]),
      mas: rival.carril[mayor] >= liga.carril[mayor],
      nota: `${pct(rival.carril[mayor])} de los balones · ${CARRIL[mayor]}`,
    },
  ];

  return (
    <section aria-label="Balón a la espalda" className="portada-tarjeta portada-entra mt-8 min-w-0 px-4 py-4 sm:px-5">
      <p className="flex flex-wrap items-baseline gap-x-2 gap-y-1 text-[12px] font-semibold uppercase tracking-[0.16em] text-[#C8A96B]">
        Balón a la espalda · ¿se le gana en largo?
        <span className="rounded-full border border-white/15 px-2 py-0.5 text-[11px] font-semibold normal-case tracking-normal text-white/60">
          dato · Opta, sus últimos {rival.partidos} partidos y {liga.equipos} equipos de su liga
        </span>
        {rival.n < 25 && (
          <span className="rounded-full border border-amber-400/40 px-2 py-0.5 text-[11px] font-semibold normal-case tracking-normal text-amber-300">tendencia</span>
        )}
      </p>
      <h3 className="fuente-club mt-1.5 text-[26px] font-bold uppercase leading-[1.05] text-white sm:text-[32px]">{titular}</h3>
      <p className="mt-1 text-sm leading-6 text-white/70">{frase}</p>
      {consejo && <p className="mt-1 text-sm font-semibold leading-6 text-white/85">{consejo}</p>}

      <div className="mt-3 grid min-w-0 gap-3 lg:grid-cols-[minmax(0,1fr)_15rem]">
        <figure className="portada-celda m-0 min-w-0 p-3">
          <Campo balones={balones} solo={solo} nombreRival={nombreRival} />
          <figcaption className="mt-2 flex flex-wrap gap-1.5">
            {DESENLACES.filter((d) => rival.cuenta[d] > 0).map((d) => (
              <button
                key={d}
                type="button"
                aria-pressed={solo === d}
                onClick={() => setSolo((s) => (s === d ? null : d))}
                className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[12px] font-semibold transition ${
                  solo === d ? "border-white/40 bg-white/10 text-white" : "border-white/10 text-white/70 hover:border-white/25"
                }`}
              >
                <svg width="14" height="6" aria-hidden className="shrink-0">
                  <line x1="0" y1="3" x2="14" y2="3" style={{ stroke: COLOR[d], strokeWidth: 3 }} />
                </svg>
                {NOMBRE[d]} <span className="tabular-nums text-white/50">{rival.cuenta[d]}</span>
              </button>
            ))}
          </figcaption>
        </figure>

        <ul className="grid min-w-0 grid-cols-1 gap-2 sm:grid-cols-3 lg:grid-cols-1">
          {cifras.map((c) => (
            <li key={c.rotulo} className="portada-celda min-w-0 px-3 py-2.5">
              <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-white/55">{c.rotulo}</p>
              <p className="fuente-club mt-0.5 text-[28px] font-bold leading-none text-white tabular-nums">{c.valor}</p>
              <p className="mt-1 text-[12px] text-white/60">
                Liga <span className="tabular-nums font-semibold text-white/80">{c.liga}</span>
                {c.rotulo !== "Sale más de" && (
                  <span className="ml-1.5 font-semibold" style={{ color: c.mas ? MEJOR : PEOR }}>
                    {c.mas ? "▲ más que la liga" : "▼ menos que la liga"}
                  </span>
                )}
              </p>
              <p className="mt-0.5 text-[11px] leading-4 text-white/50">{c.nota}</p>
            </li>
          ))}
        </ul>
      </div>

      <p className="mt-2 text-[11px] leading-5 text-white/55">
        Balón a la espalda: pase en juego (sin saques de banda ni de puerta) de su oponente que sale de fuera de los últimos {ULTIMOS_M} m, avanza {AVANCE_M} m o más y acaba en
        los últimos {ULTIMOS_M} m entre las líneas del área a lo ancho (zona sombreada), llegue o no. En qué acaba: lo primero que pasa en los {VENTANA_S} s siguientes (remate de
        quien lo envía, falta a su favor, despeje del rival o pérdida; si no pasa nada, «sigue» si llegó y pérdida si no). La media de la liga, la de cada equipo de su liga con {MIN_BALONES} balones
        o más, sin él. Verde/naranja, por encima o por debajo de la liga para quien le ataca. Flecha discontinua: el pase no llegó. Pinchar un desenlace deja sólo esas flechas.
      </p>
    </section>
  );
}

/* Campo entero en metros, atacando hacia la derecha (su portería, a la derecha). */
const L = 105;
const A = 68;
const MG = 2;

function Campo({ balones, solo, nombreRival }: { balones: Balon[]; solo: Desenlace | null; nombreRival: string }) {
  const X = (x: number) => (x / 100) * L;
  const Y = (y: number) => ((100 - y) / 100) * A;
  const linea = { stroke: tinta(0.3), fill: "none", strokeWidth: 0.35 } as const;
  const zx = X(X_ZONA);
  const zy0 = Y(Y_CENTRAL.y1);
  const zy1 = Y(Y_CENTRAL.y0);
  const orden = [...balones].sort((a, b) => (a.desenlace === "remate" ? 1 : 0) - (b.desenlace === "remate" ? 1 : 0));

  return (
    <svg
      viewBox={`${-MG} ${-MG} ${L + MG * 2} ${A + MG * 2}`}
      className="grafico-cabe block h-auto w-full"
      role="img"
      aria-label={`Balones a la espalda de ${nombreRival}: ${balones.length} flechas desde el origen hasta el destino, coloreadas según en qué acaban`}
    >
      <defs>
        {DESENLACES.map((d) => (
          <marker key={d} id={`espalda-${d}`} viewBox="0 0 6 6" refX="5" refY="3" markerWidth="4" markerHeight="4" orient="auto">
            <path d="M0,0 L6,3 L0,6 Z" style={{ fill: COLOR[d] }} />
          </marker>
        ))}
      </defs>
      <rect x={0} y={0} width={L} height={A} style={{ fill: tinta(0.04) }} />
      <rect x={zx} y={zy0} width={L - zx} height={zy1 - zy0} style={{ fill: "rgb(200 169 107 / 0.14)" }} />
      {/* Líneas: banda, medio campo, círculo, áreas y carriles de salida. */}
      <rect x={0} y={0} width={L} height={A} style={linea} />
      <line x1={L / 2} y1={0} x2={L / 2} y2={A} style={linea} />
      <circle cx={L / 2} cy={A / 2} r={9.15} style={linea} />
      <rect x={0} y={(A - 40.32) / 2} width={16.5} height={40.32} style={linea} />
      <rect x={L - 16.5} y={(A - 40.32) / 2} width={16.5} height={40.32} style={linea} />
      <rect x={L - 5.5} y={(A - 18.32) / 2} width={5.5} height={18.32} style={linea} />
      <line x1={zx} y1={0} x2={zx} y2={A} style={{ ...linea, strokeDasharray: "1.2 1.2" }} />
      {[A / 3, (2 * A) / 3].map((y) => (
        <line key={y} x1={0} y1={y} x2={zx} y2={y} style={{ ...linea, strokeDasharray: "0.8 1.6", stroke: tinta(0.2) }} />
      ))}
      <text x={1.5} y={4.2} style={{ fill: tinta(0.5), fontSize: 2.6, fontWeight: 700 }}>NUESTRA IZQ. · SU DERECHA</text>
      <text x={1.5} y={A - 1.6} style={{ fill: tinta(0.5), fontSize: 2.6, fontWeight: 700 }}>NUESTRA DER. · SU IZQUIERDA</text>
      <text x={L - 1.5} y={zy0 - 1.2} textAnchor="end" style={{ fill: ORO, fontSize: 2.6, fontWeight: 700 }}>ÚLTIMOS {ULTIMOS_M} M</text>
      <text x={L / 2 + 1} y={A / 2 - 10.5} style={{ fill: tinta(0.45), fontSize: 2.4, fontWeight: 700 }}>ATACAMOS →</text>

      {orden.map((b, i) => {
        const fuera = solo != null && b.desenlace !== solo;
        return (
          <line
            key={i}
            x1={X(b.x)}
            y1={Y(b.y)}
            x2={X(b.finX)}
            y2={Y(b.finY)}
            markerEnd={fuera ? undefined : `url(#espalda-${b.desenlace})`}
            style={{ stroke: COLOR[b.desenlace], strokeWidth: b.desenlace === "remate" ? 0.6 : 0.45, opacity: fuera ? 0.08 : 0.85, strokeDasharray: b.ok ? undefined : "1.2 0.8" }}
          >
            <title>{`Min. ${b.minuto} · ${NOMBRE[b.desenlace]}${b.desenlace === "remate" ? ` (${dec(b.xg)} xG)` : ""} · ${b.ok ? "llega" : "no llega"}`}</title>
          </line>
        );
      })}
    </svg>
  );
}
