"use client";

/**
 * SU SALIDA DE BALÓN: ¿BAJA EL PIVOTE A LA LÍNEA DE CENTRALES?
 * (Scout colectivo, 25/11/2026, idea de X). El campo de su primer tercio con
 * los toques de sus mediocentros en las posesiones que nacen del portero o
 * de un central; si uno se mete a la altura de los centrales y abierto a un
 * lado, «salida de 3 con pivote incrustado», con su nombre y el lado. Al lado,
 * la altura media del lateral de ese lado (y del otro) en esas posesiones:
 * si se proyecta o se queda. Sirve para decidir si apretamos con dos o con
 * tres arriba y a quién saltamos.
 *
 * Datos: `opta:directo:archivo` y `opta:directo:<partido>` de sus últimos
 * partidos, por `useDocsOpta` (los mismos documentos que «Sus sociedades»,
 * misma caché). Las cuentas, en `lib/rivals/salida-pivote.ts`. Sin dato no se
 * pinta; nada se pide hasta que asoma.
 */

import { useMemo } from "react";

import { COMPARADO, ORO, tinta } from "@/components/data/graficas";
import { useAsoma } from "@/hooks/useAsoma";
import { useDocsOpta } from "@/hooks/useDocsOpta";
import { aObjetos, CASTILLA_OPTA, DOCS_OPTA, type TablaOpta } from "@/lib/opta";
import { casaEquipo } from "@/lib/opta-eventos";
import { leeEventos, leeJugadores } from "@/lib/opta-directo-mapas";
import { nombreDePlantilla } from "@/lib/rivals/nombre-jugador";
import {
  MARGEN_ALTURA,
  MAX_PARTIDOS,
  MIN_INCRUSTADO,
  PARTE_INCRUSTADO,
  queHaceLateral,
  salidaPivote,
  X_PRIMER_TERCIO,
  X_PROYECTA,
  X_SE_QUEDA,
  Y_DERECHA,
  Y_IZQUIERDA,
  type Lado,
} from "@/lib/rivals/salida-pivote";

type PartidoArchivo = { partido?: string; fecha?: string; equipos?: string[] };
type Archivo = { partidos?: PartidoArchivo[] };
type DocDirecto = { partido?: string; fecha?: string; eventos?: TablaOpta; jugadores?: TablaOpta };

const pct = (v: number) => `${Math.round(v * 100)} %`;
/** Opta 0-100 → metros desde su portería. */
const metros = (x: number) => `${Math.round((x / 100) * 105)} m`;

/** El rival ataca hacia la derecha: su izquierda es nuestra derecha. */
const LADO: Record<Lado, string> = { derecha: "su derecha (nuestra izquierda)", izquierda: "su izquierda (nuestra derecha)" };
const LADO_CORTO: Record<Lado, string> = { derecha: "su derecha", izquierda: "su izquierda" };
const otro = (l: Lado): Lado => (l === "derecha" ? "izquierda" : "derecha");

export function SalidaPivote({ equipo, nombres = [] }: { equipo: string; nombres?: string[] }) {
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
        const jugadores = leeJugadores(d.jugadores);
        for (const j of jugadores) if (j.id && j.teamId === teamId) quien.set(j.id, { nombre: j.nombre, dorsal: j.dorsal });
        return { partido: ids[i], eventos: leeEventos(d.eventos), jugadores };
      })
      .filter((p): p is NonNullable<typeof p> => p != null && p.eventos.length > 0);
    const s = partidos.length ? salidaPivote(partidos, teamId) : null;
    return s ? { s, quien } : null;
  }, [docs, ids, teamId]);

  if (!datos) {
    if (!cargando) return null;
    return (
      <section aria-label="Salida de balón" className="portada-tarjeta mt-8 min-w-0 px-4 py-4 sm:px-5">
        <p className="text-[12px] font-semibold uppercase tracking-[0.16em] text-[#C8A96B]">Salida de balón · ¿baja el pivote a la línea de centrales?</p>
        <p className="mt-1 text-sm text-white/60">Leyendo el evento a evento de sus últimos {ids.length} partidos…</p>
      </section>
    );
  }

  const { s, quien } = datos;
  const nombreDe = (id: string) => {
    const n = quien.get(id)?.nombre || "";
    return (n && (nombreDePlantilla(n, nombres) || n)) || `Jugador ${id}`;
  };
  const corto = (id: string) => {
    const n = nombreDe(id).trim().split(/\s+/);
    return n.length > 1 ? n[n.length - 1] : n[0];
  };
  const lista = (ids: string[]) => (ids.length > 1 ? `${ids.slice(0, -1).map(nombreDe).join(", ")} y ${nombreDe(ids[ids.length - 1])}` : ids.map(nombreDe).join(""));

  const inc = s.incrustado;
  /* Los dos mediocentros que más tocan en su salida (el incrustado, primero). */
  const pintados = [...s.mediocentros].sort((a, b) => (a.id === inc?.id ? -1 : b.id === inc?.id ? 1 : 0)).slice(0, 2);
  const ladoLat: Lado = inc?.lado ?? "derecha";
  const latInc = s.laterales[ladoLat];
  const latOtro = s.laterales[otro(ladoLat)];
  const hace = queHaceLateral(latInc.xMedia);

  const titular = inc
    ? `Salida de 3 con pivote incrustado: ${nombreDe(inc.id)} baja a ${LADO_CORTO[inc.lado]} de los centrales`
    : "Sale de 2: sus mediocentros no bajan a la línea de centrales";
  const frase =
    `En ${s.posesiones} posesiones que nacen del portero (${s.delPortero}) o de un central en sus últimos ${s.partidos} partidos, ` +
    (inc
      ? `${pct(inc.parte)} de los toques de ${nombreDe(inc.id)} en su primer tercio (${inc.n}) son a la altura de los centrales y abiertos a ${LADO[inc.lado]}. `
      : pintados.length
        ? `ninguno de sus mediocentros llega a ${MIN_INCRUSTADO} toques (y el ${pct(PARTE_INCRUSTADO)} de los suyos) a la altura de los centrales y abierto a un lado. `
        : "no hay toques de mediocentros en su primer tercio. ") +
    (latInc.xMedia != null && latInc.ids.length
      ? `El lateral de ${LADO_CORTO[ladoLat]} (${lista(latInc.ids)}) toca de media a ${metros(latInc.xMedia)} de su portería: ${hace}.`
      : "");
  const consejo = inc
    ? `Con tres atrás en la salida, dos puntas no llegan: presión con tres (o dos y el extremo de ${inc.lado === "izquierda" ? "nuestra derecha" : "nuestra izquierda"} saltando a ${corto(inc.id)})` +
      (hace === "se proyecta" ? `, y alguien que siga al lateral alto de ${LADO_CORTO[ladoLat]}.` : hace === "se queda" ? `; su lateral de ese lado se queda, así que el salto no deja espalda.` : ".")
    : pintados.length
      ? `Con dos centrales solos se puede apretar con dos puntas y saltar a ${corto(pintados[0].id)}, el mediocentro que más la toca en su salida.`
      : "";

  const cifras = [
    {
      rotulo: "Pivote incrustado",
      valor: inc ? corto(inc.id) : "No",
      nota: inc
        ? `${LADO_CORTO[inc.lado]} · ${inc.n} toques (${pct(inc.parte)} de los suyos en el primer tercio)`
        : pintados.length
          ? pintados.map((m) => `${corto(m.id)} ${m.zona.derecha + m.zona.izquierda} de ${m.toques.length}`).join(" · ")
          : "Sin toques de mediocentros",
    },
    {
      rotulo: `Lateral de ${LADO_CORTO[ladoLat]}`,
      valor: latInc.xMedia != null ? metros(latInc.xMedia) : "—",
      nota: latInc.xMedia != null ? `${hace} · ${latInc.ids.map(corto).join(", ")} · ${latInc.toques} toques` : "Sin lateral claro por ese lado",
    },
    {
      rotulo: `Lateral de ${LADO_CORTO[otro(ladoLat)]}`,
      valor: latOtro.xMedia != null ? metros(latOtro.xMedia) : "—",
      nota: latOtro.xMedia != null ? `${queHaceLateral(latOtro.xMedia)} · ${latOtro.ids.map(corto).join(", ")} · ${latOtro.toques} toques` : "Sin lateral claro por ese lado",
    },
  ];

  return (
    <section id="x-idea-2124891077383704865-1" aria-label="Salida de balón" className="portada-tarjeta portada-entra mt-8 min-w-0 scroll-mt-20 px-4 py-4 sm:px-5">
      <p className="flex flex-wrap items-baseline gap-x-2 gap-y-1 text-[12px] font-semibold uppercase tracking-[0.16em] text-[#C8A96B]">
        Salida de balón · ¿baja el pivote a la línea de centrales?
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
          <Campo s={s} pintados={pintados} incId={inc?.id ?? ""} nombreDe={nombreDe} nombreRival={nombre} />
          <figcaption className="mt-2 flex flex-wrap gap-1.5">
            {pintados.map((m, i) => (
              <span key={m.id} className="inline-flex items-center gap-1.5 rounded-full border border-white/10 px-2.5 py-1 text-[12px] font-semibold text-white/70">
                <svg width="8" height="8" aria-hidden className="shrink-0">
                  <circle cx="4" cy="4" r="3.5" style={{ fill: i === 0 ? ORO : COMPARADO }} />
                </svg>
                {nombreDe(m.id)}
                {quien.get(m.id)?.dorsal ? <span className="text-white/50">· {quien.get(m.id)?.dorsal}</span> : null}
                <span className="tabular-nums text-white/50">{m.toques.length} toques</span>
              </span>
            ))}
          </figcaption>
        </figure>

        <ul className="grid min-w-0 grid-cols-1 gap-2 sm:grid-cols-3 lg:grid-cols-1">
          {cifras.map((c) => (
            <li key={c.rotulo} className="portada-celda min-w-0 px-3 py-2.5">
              <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-white/55">{c.rotulo}</p>
              <p className="fuente-club mt-0.5 truncate text-[28px] font-bold leading-none text-white tabular-nums">{c.valor}</p>
              <p className="mt-1 text-[11px] leading-4 text-white/55">{c.nota}</p>
            </li>
          ))}
        </ul>
      </div>

      <p className="mt-2 text-[11px] leading-5 text-white/55">
        Posesiones que nacen del portero o de un central: eventos seguidos del rival cuyo primer toque es de su portero o de un central en su primer tercio, hasta que el
        contrario se queda el balón o pasan 30 s. Se pintan los toques de sus dos mediocentros con más toques en su primer tercio (x &lt; {X_PRIMER_TERCIO} de 100) en esas
        posesiones. La raya es la altura media de sus centrales ahí; las franjas, «a la altura de los centrales» (hasta {MARGEN_ALTURA} de 100 por delante) y abierto a un lado (y{" "}
        {Y_DERECHA[0]}-{Y_DERECHA[1]} o {Y_IZQUIERDA[0]}-{Y_IZQUIERDA[1]}). Pivote incrustado: {MIN_INCRUSTADO} toques o más ahí por un lado y al menos el{" "}
        {pct(PARTE_INCRUSTADO)} de los suyos. Lateral: la altura media de todos sus toques en esas posesiones; se proyecta desde {metros(X_PROYECTA)}, se queda hasta{" "}
        {metros(X_SE_QUEDA)}. El rival ataca hacia la derecha.
      </p>
    </section>
  );
}

/* Sus dos primeros tercios, en metros (su ataque hacia la derecha). */
const L = 105;
const A = 68;
const X1 = 66.7;
const MG = 2;

function Campo({
  s,
  pintados,
  incId,
  nombreDe,
  nombreRival,
}: {
  s: NonNullable<ReturnType<typeof salidaPivote>>;
  pintados: { id: string; toques: { x: number; y: number }[] }[];
  incId: string;
  nombreDe: (id: string) => string;
  nombreRival: string;
}) {
  const X = (x: number) => (Math.min(x, X1) / 100) * L;
  const Y = (y: number) => ((100 - y) / 100) * A;
  const linea = { stroke: tinta(0.3), fill: "none", strokeWidth: 0.35 } as const;
  const ancho = X(X1);
  const tercio = X(X_PRIMER_TERCIO);
  const tope = X(s.xCentrales + MARGEN_ALTURA);
  const franja = (l: Lado) => {
    const [a, b] = l === "derecha" ? Y_DERECHA : Y_IZQUIERDA;
    return { y: Y(b), h: Y(a) - Y(b) };
  };
  const inc = s.incrustado;
  const flecha = (l: Lado) => {
    const lat = s.laterales[l];
    if (lat.xMedia == null) return null;
    const y = l === "derecha" ? Y(5) : Y(95);
    const x = X(lat.xMedia);
    const color = inc && inc.lado === l ? ORO : tinta(0.6);
    return (
      <g key={l}>
        <line x1={0.5} y1={y} x2={x} y2={y} style={{ stroke: color, strokeWidth: 0.9, strokeLinecap: "round" }} />
        <path d={`M ${x} ${y} l -1.6 -1.1 v 2.2 z`} style={{ fill: color }} />
        <text x={1.2} y={l === "derecha" ? y - 1.6 : y + 3.4} style={{ fill: tinta(0.8), fontSize: 2.4, fontWeight: 700 }}>
          {`Lateral ${l === "derecha" ? "der." : "izq."} · ${metros(lat.xMedia)}`}
        </text>
        <title>{`Lateral de ${LADO_CORTO[l]} (${lat.ids.map(nombreDe).join(", ")}): altura media ${metros(lat.xMedia)} en ${lat.toques} toques`}</title>
      </g>
    );
  };

  return (
    <svg
      viewBox={`${-MG} ${-MG} ${ancho + MG * 2} ${A + MG * 2}`}
      className="grafico-cabe block h-auto w-full"
      role="img"
      aria-label={`Salida de balón de ${nombreRival}: toques de ${pintados.map((m) => nombreDe(m.id)).join(" y ")} en su primer tercio y altura de sus laterales`}
    >
      <rect x={0} y={0} width={ancho} height={A} style={{ fill: tinta(0.03) }} />
      <rect x={0} y={0} width={tercio} height={A} style={{ fill: tinta(0.04) }} />
      {(["derecha", "izquierda"] as Lado[]).map((l) => {
        const f = franja(l);
        const fuerte = inc?.lado === l;
        return <rect key={l} x={0} y={f.y} width={tope} height={f.h} style={{ fill: fuerte ? "rgb(200 169 107 / 0.22)" : "rgb(200 169 107 / 0.09)" }} />;
      })}
      <rect x={0} y={0} width={ancho} height={A} style={linea} />
      <line x1={L / 2} y1={0} x2={L / 2} y2={A} style={linea} />
      <rect x={0} y={(A - 40.32) / 2} width={16.5} height={40.32} style={linea} />
      <rect x={0} y={(A - 18.32) / 2} width={5.5} height={18.32} style={linea} />
      <line x1={tercio} y1={0} x2={tercio} y2={A} style={{ ...linea, strokeDasharray: "1.2 1.2" }} />
      <line x1={X(s.xCentrales)} y1={0} x2={X(s.xCentrales)} y2={A} style={{ stroke: tinta(0.55), strokeWidth: 0.4, strokeDasharray: "0.6 0.9" }}>
        <title>{`Altura media de sus centrales en la salida: ${metros(s.xCentrales)}`}</title>
      </line>
      <text x={X(s.xCentrales) + 0.8} y={A / 2 + 0.8} style={{ fill: tinta(0.55), fontSize: 2.2, fontWeight: 700 }}>CENTRALES</text>
      <text x={tercio + 1} y={A / 2 + 0.8} style={{ fill: tinta(0.45), fontSize: 2.4, fontWeight: 700 }}>PRIMER TERCIO ←</text>
      <text x={L / 2 + 1} y={A / 2 + 0.8} style={{ fill: tinta(0.45), fontSize: 2.4, fontWeight: 700 }}>ATACA →</text>
      <text x={tercio + 1} y={10.5} style={{ fill: tinta(0.5), fontSize: 2.4, fontWeight: 700 }}>SU IZQUIERDA · NUESTRA DER.</text>
      <text x={tercio + 1} y={A - 9} style={{ fill: tinta(0.5), fontSize: 2.4, fontWeight: 700 }}>SU DERECHA · NUESTRA IZQ.</text>

      {[...pintados].reverse().map((m) => {
        const color = m.id === pintados[0]?.id ? ORO : COMPARADO;
        return (
          <g key={m.id}>
            <title>{`${nombreDe(m.id)}${m.id === incId ? " (pivote incrustado)" : ""}: ${m.toques.length} toques en su primer tercio`}</title>
            {m.toques.map((t, i) => (
              <circle key={i} cx={X(t.x)} cy={Y(t.y)} r={0.75} style={{ fill: color, opacity: 0.6 }} />
            ))}
          </g>
        );
      })}
      {flecha("izquierda")}
      {flecha("derecha")}
    </svg>
  );
}
