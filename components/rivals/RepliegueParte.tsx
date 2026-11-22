"use client";

/**
 * ¿SE REPLIEGA EL RIVAL TRAS EL DESCANSO? PRIMERA PARTE CONTRA SEGUNDA
 * (Scout colectivo, 22/11/2026, idea de X). Por parte: altura media de sus
 * acciones defensivas, % de toques en el último tercio y % de duelos ganados;
 * al lado de cada dato, cuánto cambia de media la liga entre las dos partes.
 * Una barra doble en el campo marca dónde defiende en cada parte. Si su bloque
 * baja más de 5 m que la caída media de la liga: «se repliega en la 2.ª
 * parte: busca la transición».
 *
 * Datos: los mismos `opta:directo:<partido>` que «Balón a la espalda» (misma
 * caché de `useDocsOpta`). Cuentas en `lib/rivals/repliegue-partes.ts`. Sin
 * dato no se pinta; nada se pide hasta que asoma.
 */

import { useMemo } from "react";

import { COMPARADO, MEJOR, ORO, PEOR, tinta } from "@/components/data/graficas";
import { useAsoma } from "@/hooks/useAsoma";
import { useDocsOpta } from "@/hooks/useDocsOpta";
import { aObjetos, CASTILLA_OPTA, DOCS_OPTA, type TablaOpta } from "@/lib/opta";
import { casaEquipo } from "@/lib/opta-eventos";
import { leeEventos } from "@/lib/opta-directo-mapas";
import {
  diferencia,
  diferenciaLiga,
  MAX_PARTIDOS,
  media,
  MIN_DEFENSIVAS,
  porParte,
  seAdelanta,
  sePliega,
  UMBRAL_REPLIEGUE_M,
  type PorParte,
} from "@/lib/rivals/repliegue-partes";

type PartidoArchivo = { partido?: string; fecha?: string; equipos?: string[] };
type Archivo = { partidos?: PartidoArchivo[] };
type DocDirecto = { eventos?: TablaOpta };

const pct = (v: number) => `${Math.round(v * 100)} %`;
const dec = (v: number, n = 1) => v.toFixed(n).replace(".", ",");
const conSigno = (v: number, txt: string) => `${v > 0 ? "+" : v < 0 ? "−" : "±"}${txt}`;
const metros = (v: number) => conSigno(v, `${dec(Math.abs(v))} m`);
const puntos = (v: number) => conSigno(v, `${Math.round(Math.abs(v) * 100)} pts`);

const P1 = ORO;
const P2 = COMPARADO;

export function RepliegueParte({ equipo }: { equipo: string }) {
  const { caja, abierto } = useAsoma<HTMLDivElement>(2000);
  return <div ref={caja} className="min-w-0">{abierto && equipo && <Indice equipo={equipo} />}</div>;
}

/** Su liga y los últimos partidos de cada equipo (como «Balón a la espalda»). */
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
    return { rivalId, nombreRival, miembros, suyos, ids: [...ids] };
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
}: {
  rivalId: string;
  nombreRival: string;
  miembros: string[];
  suyos: Map<string, string[]>;
  ids: string[];
}) {
  const { docs, cargando } = useDocsOpta<DocDirecto[]>(...ids.map(DOCS_OPTA.directo));

  const datos = useMemo(() => {
    const porId = new Map<string, { eventos: ReturnType<typeof leeEventos> }>();
    docs.forEach((d, i) => {
      const eventos = d ? leeEventos(d.eventos) : [];
      if (eventos.length) porId.set(ids[i], { eventos });
    });
    if (!porId.size) return null;
    const de = (teamId: string) => (suyos.get(teamId) ?? []).map((id) => porId.get(id)).filter((p): p is NonNullable<typeof p> => p != null);

    let rival: PorParte | null = null;
    const otros: PorParte[] = [];
    for (const teamId of miembros) {
      const r = porParte(de(teamId), teamId);
      if (!r) continue;
      if (teamId === rivalId) rival = r;
      else otros.push(r);
    }
    if (!rival || otros.length < 3) return null;
    const liga = {
      equipos: otros.length,
      dif: diferenciaLiga(otros),
      altura1: media(otros.map((o) => o.p1.altura)),
      altura2: media(otros.map((o) => o.p2.altura)),
    };
    return { rival, liga };
  }, [docs, ids, miembros, suyos, rivalId]);

  if (!datos) {
    if (!cargando) return null;
    return (
      <section aria-label="Primera parte contra segunda parte" className="portada-tarjeta mt-8 min-w-0 px-4 py-4 sm:px-5">
        <p className="text-[12px] font-semibold uppercase tracking-[0.16em] text-[#C8A96B]">Primera parte contra segunda parte · ¿se repliega?</p>
        <p className="mt-1 text-sm text-white/60">Leyendo el evento a evento de {ids.length} partidos de la liga…</p>
      </section>
    );
  }

  const { rival, liga } = datos;
  const dif = diferencia(rival);
  const pliega = sePliega(dif, liga.dif);
  const adelanta = seAdelanta(dif, liga.dif);
  const titular = pliega ? "Se repliega en la 2.ª parte: busca la transición" : adelanta ? "Tras el descanso adelanta el bloque" : "Defiende a la misma altura que la liga en las dos partes";
  const frase =
    `En sus últimos ${rival.partidos} partidos defiende de media a ${dec(rival.p1.altura)} m de su portería en la 1.ª parte y a ${dec(rival.p2.altura)} m en la 2.ª ` +
    `(${metros(dif.altura)}; la liga ${metros(liga.dif.altura)}).` +
    (pliega
      ? " Tras el descanso nos dará campo: plan de ataque posicional para la 1.ª parte y cambios pensados para atacar un bloque bajo que espera la transición."
      : adelanta
        ? " Tras el descanso nos esperará más arriba: hay espalda que atacar en la 2.ª parte."
        : "");

  const cifras: { rotulo: string; v1: string; v2: string; d: number; dl: number; fmt: (v: number) => string; nota: string }[] = [
    {
      rotulo: "Altura del bloque",
      v1: `${dec(rival.p1.altura)} m`,
      v2: `${dec(rival.p2.altura)} m`,
      d: dif.altura,
      dl: liga.dif.altura,
      fmt: metros,
      nota: `${rival.p1.defensivas} y ${rival.p2.defensivas} acciones defensivas`,
    },
    { rotulo: "Toques en el último tercio", v1: pct(rival.p1.tercio), v2: pct(rival.p2.tercio), d: dif.tercio, dl: liga.dif.tercio, fmt: puntos, nota: `de ${rival.p1.toques} y ${rival.p2.toques} toques` },
    { rotulo: "Duelos ganados", v1: pct(rival.p1.duelos), v2: pct(rival.p2.duelos), d: dif.duelos, dl: liga.dif.duelos, fmt: puntos, nota: `de ${rival.p1.nDuelos} y ${rival.p2.nDuelos} duelos` },
  ];

  return (
    <section aria-label="Primera parte contra segunda parte" className="portada-tarjeta portada-entra mt-8 min-w-0 px-4 py-4 sm:px-5">
      <p className="flex flex-wrap items-baseline gap-x-2 gap-y-1 text-[12px] font-semibold uppercase tracking-[0.16em] text-[#C8A96B]">
        Primera parte contra segunda parte · ¿se repliega?
        <span className="rounded-full border border-white/15 px-2 py-0.5 text-[11px] font-semibold normal-case tracking-normal text-white/60">
          dato · Opta, sus últimos {rival.partidos} partidos y {liga.equipos} equipos de su liga
        </span>
        {rival.partidos < 5 && (
          <span className="rounded-full border border-amber-400/40 px-2 py-0.5 text-[11px] font-semibold normal-case tracking-normal text-amber-300">tendencia</span>
        )}
      </p>
      <h3 className="fuente-club mt-1.5 text-[26px] font-bold uppercase leading-[1.05] text-white sm:text-[32px]">{titular}</h3>
      <p className="mt-1 text-sm leading-6 text-white/70">{frase}</p>

      <figure className="portada-celda m-0 mt-3 min-w-0 p-3">
        <Campo rival={rival} liga1={liga.altura1} liga2={liga.altura2} nombreRival={nombreRival} />
        <figcaption className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-[12px] font-semibold text-white/70">
          <span className="inline-flex items-center gap-1.5">
            <span aria-hidden className="inline-block h-2 w-4 rounded-sm" style={{ background: P1 }} /> 1.ª parte
          </span>
          <span className="inline-flex items-center gap-1.5">
            <span aria-hidden className="inline-block h-2 w-4 rounded-sm" style={{ background: P2 }} /> 2.ª parte
          </span>
          <span className="inline-flex items-center gap-1.5">
            <span aria-hidden className="inline-block h-3 w-0.5" style={{ background: tinta(0.6) }} /> media de la liga en esa parte
          </span>
        </figcaption>
      </figure>

      <ul className="mt-3 grid min-w-0 grid-cols-1 gap-2 sm:grid-cols-3">
        {cifras.map((c) => {
          const exceso = c.d - c.dl;
          const sube = exceso >= 0;
          return (
            <li key={c.rotulo} className="portada-celda min-w-0 px-3 py-2.5">
              <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-white/55">{c.rotulo}</p>
              <p className="fuente-club mt-0.5 flex flex-wrap items-baseline gap-x-2 text-[24px] font-bold leading-none tabular-nums">
                <span style={{ color: P1 }}>{c.v1}</span>
                <span className="text-[14px] text-white/45">→</span>
                <span style={{ color: P2 }}>{c.v2}</span>
              </p>
              <p className="mt-1 text-[12px] text-white/60">
                Cambio <span className="tabular-nums font-semibold text-white/85">{c.fmt(c.d)}</span> · liga{" "}
                <span className="tabular-nums font-semibold text-white/80">{c.fmt(c.dl)}</span>
                {Math.abs(exceso) > 0.0005 && (
                  <span className="ml-1.5 font-semibold" style={{ color: sube ? MEJOR : PEOR }}>
                    {sube ? "▲ sube más que la liga" : "▼ baja más que la liga"}
                  </span>
                )}
              </p>
              <p className="mt-0.5 text-[11px] leading-4 text-white/50">{c.nota}</p>
            </li>
          );
        })}
      </ul>

      <p className="mt-2 text-[11px] leading-5 text-white/55">
        Altura del bloque: la x media de sus entradas, intercepciones y recuperaciones, en metros desde su portería (Opta, campo de 105 m). Toques en el último tercio: los suyos con x ≥ 66,7
        sobre todos sus toques. Duelos: aéreos, regates, entradas y desafíos, % ganados. Todo sumado en sus partidos. Liga: la diferencia 2.ª − 1.ª de cada equipo de su liga con{" "}
        {MIN_DEFENSIVAS} acciones defensivas o más en cada parte, promediada, sin él. Verde/naranja: el rival sube o baja más que la liga entre las dos partes. Aviso de repliegue si su
        bloque baja más de {UMBRAL_REPLIEGUE_M} m que la caída media de la liga.
      </p>
    </section>
  );
}

/* Campo en metros, su portería a la izquierda: dos barras desde su portería hasta la altura de cada parte. */
const L = 105;
const A = 40;
const MG = 2;

function Campo({ rival, liga1, liga2, nombreRival }: { rival: PorParte; liga1: number; liga2: number; nombreRival: string }) {
  const linea = { stroke: tinta(0.3), fill: "none", strokeWidth: 0.35 } as const;
  const filas = [
    { y: 10, alto: 8, altura: rival.p1.altura, liga: liga1, color: P1, rotulo: "1.ª" },
    { y: 22, alto: 8, altura: rival.p2.altura, liga: liga2, color: P2, rotulo: "2.ª" },
  ];
  const dif = rival.p2.altura - rival.p1.altura;
  return (
    <svg
      viewBox={`${-MG} ${-MG} ${L + MG * 2} ${A + MG * 2}`}
      className="grafico-cabe block h-auto w-full"
      role="img"
      aria-label={`Altura del bloque de ${nombreRival}: ${dec(rival.p1.altura)} m en la 1.ª parte y ${dec(rival.p2.altura)} m en la 2.ª (${metros(dif)})`}
    >
      <rect x={0} y={0} width={L} height={A} style={{ fill: tinta(0.04) }} />
      <rect x={0} y={0} width={L} height={A} style={linea} />
      <line x1={L / 2} y1={0} x2={L / 2} y2={A} style={linea} />
      {[L / 3, (2 * L) / 3].map((x) => (
        <line key={x} x1={x} y1={0} x2={x} y2={A} style={{ ...linea, strokeDasharray: "0.8 1.6", stroke: tinta(0.2) }} />
      ))}
      <rect x={0} y={(A - 26) / 2} width={16.5} height={26} style={linea} />
      <rect x={L - 16.5} y={(A - 26) / 2} width={16.5} height={26} style={linea} />
      <text x={1.5} y={4.2} style={{ fill: tinta(0.5), fontSize: 2.6, fontWeight: 700 }}>SU PORTERÍA</text>
      <text x={L - 1.5} y={4.2} textAnchor="end" style={{ fill: tinta(0.5), fontSize: 2.6, fontWeight: 700 }}>NUESTRA PORTERÍA</text>
      <text x={L / 2} y={A - 1.6} textAnchor="middle" style={{ fill: tinta(0.45), fontSize: 2.4, fontWeight: 700 }}>DONDE DEFIENDE (M DESDE SU PORTERÍA)</text>
      {filas.map((f) => (
        <g key={f.rotulo}>
          <rect x={0} y={f.y} width={Math.max(0, Math.min(L, f.altura))} height={f.alto} rx={1} style={{ fill: f.color, opacity: 0.8 }}>
            <title>{`${f.rotulo} parte: ${dec(f.altura)} m (liga ${dec(f.liga)} m)`}</title>
          </rect>
          <line x1={f.liga} y1={f.y - 1} x2={f.liga} y2={f.y + f.alto + 1} style={{ stroke: tinta(0.75), strokeWidth: 0.6 }} />
          <text x={Math.min(L - 14, f.altura + 1.2)} y={f.y + f.alto / 2 + 1} style={{ fill: tinta(0.85), fontSize: 3, fontWeight: 700 }}>
            {f.rotulo} · {dec(f.altura)} m
          </text>
        </g>
      ))}
    </svg>
  );
}
