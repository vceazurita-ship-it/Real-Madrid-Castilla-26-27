"use client";

/**
 * FRENTE AL RIVAL (22/11/2026, petición del analista: comparativa con el
 * rival o los rivales según filtro, en ABP ofensivo y defensivo, saque de
 * banda, faltas y pérdidas, «que sea muy muy visual»).
 *
 * Lámina del modo Visual de esas pantallas:
 * 1. Con quién: el del filtro de la pantalla, el próximo, el último, el del
 *    partido que se mira, los cinco de arriba, todo el grupo o los que se
 *    elijan con su escudo. Y el periodo: temporada, últimos 5 o últimos 3.
 * 2. El marcador: en cuántas cifras sale mejor cada uno, con los escudos.
 * 3. El radar de percentiles en el grupo (Castilla en oro, rival en azul).
 * 4. Barras enfrentadas por cifra, con la raya de la media del grupo y la
 *    tira con el puesto de los 20 equipos debajo.
 * 5. Al pinchar una cifra, su evolución partido a partido.
 *
 * Datos: `opta:partidos` (`useOptaLigero`, la misma descarga que la portada),
 * cuentas en `lib/frente-al-rival.ts`. Nada se pide hasta que asoma.
 */

import { useMemo, useState } from "react";

import { COMPARADO, ORO, tinta, useEscudos } from "@/components/data/graficas";
import { EscudoEquipo } from "@/components/rivals/EscudoEquipo";
import { Lamina, TituloConclusion } from "@/components/ui/VistaVisual";
import { useProximoRival } from "@/hooks/useAbpLigas";
import { useAsoma } from "@/hooks/useAsoma";
import { useOptaLigero } from "@/hooks/useOptaLigero";
import {
  clasificacion,
  comparaFrente,
  NOMBRE_AREA,
  partidosPorEquipo,
  recorta,
  textoFrente,
  valorPartido,
  type AreaFrente,
  type FilaFrente,
  type Periodo,
} from "@/lib/frente-al-rival";
import { CASTILLA_OPTA } from "@/lib/opta";
import { casaEquipo } from "@/lib/opta-eventos";

type Modo = "filtro" | "proximo" | "ultimo" | "partido" | "top5" | "grupo" | "elegidos";

const AZUL = COMPARADO;
const VERDE = "#1B9E77";
const NARANJA = "#D95F02";

export function FrenteAlRival(props: { area: AreaFrente; rivalFiltro?: string; rivalPartido?: string; className?: string }) {
  const { caja, abierto } = useAsoma<HTMLDivElement>(1500);
  return (
    <div ref={caja} className={`min-w-0 ${props.className ?? ""}`}>
      {abierto && <Bloque {...props} />}
    </div>
  );
}

function Bloque({ area, rivalFiltro = "", rivalPartido = "" }: { area: AreaFrente; rivalFiltro?: string; rivalPartido?: string }) {
  const { opta, cargando } = useOptaLigero();
  const proximo = useProximoRival();
  const escudoDe = useEscudos();

  /* La elección del analista vale para el filtro con el que la hizo: si cambia el filtro de la pantalla, manda el nuevo. */
  const [eleccion, setEleccion] = useState<{ para: string; modo: Modo; elegidos: string[] } | null>(null);
  const [periodo, setPeriodo] = useState<Periodo>("temporada");
  const [abiertaLista, setAbiertaLista] = useState(false);
  const [enfocada, setEnfocada] = useState<string | null>(null);

  const base = useMemo(() => {
    if (!opta) return null;
    const g = opta.grupos.get(CASTILLA_OPTA);
    if (g == null) return null;
    const grupo = new Set([...opta.grupos.entries()].filter(([, n]) => n === g).map(([id]) => id));
    const equipos = opta.equipos.map((f) => ({ teamId: String(f.teamId ?? ""), equipo: String(f.equipo ?? "") })).filter((e) => grupo.has(e.teamId));
    const nombre = new Map(equipos.map((e) => [e.teamId, e.equipo]));
    const porEquipo = partidosPorEquipo(opta.partidos);
    const nuestros = porEquipo.get(CASTILLA_OPTA) ?? [];
    const ultimo = nuestros.at(-1)?.rival;
    const casa = (n: string) => {
      const id = n ? casaEquipo(n, equipos) : null;
      return id && id !== CASTILLA_OPTA ? id : null;
    };
    return {
      grupo,
      equipos: equipos.filter((e) => e.teamId !== CASTILLA_OPTA).sort((a, b) => a.equipo.localeCompare(b.equipo, "es")),
      nombre,
      porEquipo,
      ultimo: ultimo ? String(ultimo.teamId ?? "") || null : null,
      top5: clasificacion(porEquipo, grupo).filter((x) => x.teamId !== CASTILLA_OPTA).slice(0, 5).map((x) => x.teamId),
      casa,
    };
  }, [opta]);

  if (!base) {
    return cargando ? (
      <Lamina>
        <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-white/50">¿Y frente al rival?</p>
        <div className="mt-3 h-40 animate-pulse rounded-xl bg-white/[0.04]" />
      </Lamina>
    ) : null;
  }

  const idFiltro = base.casa(rivalFiltro);
  const idProximo = base.casa(proximo);
  const idPartido = base.casa(rivalPartido);
  const modoDefecto: Modo = idFiltro ? "filtro" : idProximo ? "proximo" : "ultimo";
  const vigente = eleccion && eleccion.para === rivalFiltro ? eleccion : null;
  const modo = vigente?.modo ?? modoDefecto;
  const elegidos = vigente?.elegidos ?? [];

  const rivales: string[] = (() => {
    switch (modo) {
      case "filtro":
        return idFiltro ? [idFiltro] : [];
      case "proximo":
        return idProximo ? [idProximo] : [];
      case "ultimo":
        return base.ultimo ? [base.ultimo] : [];
      case "partido":
        return idPartido ? [idPartido] : [];
      case "top5":
        return base.top5;
      case "grupo":
        return base.equipos.map((e) => e.teamId);
      case "elegidos":
        return elegidos;
    }
  })();

  const elige = (m: Modo, lista: string[] = []) => setEleccion({ para: rivalFiltro, modo: m, elegidos: lista });
  const alterna = (id: string) => {
    const ahora = modo === "elegidos" ? elegidos : rivales;
    const nueva = ahora.includes(id) ? ahora.filter((x) => x !== id) : [...ahora, id];
    elige("elegidos", nueva);
  };

  const filas = comparaFrente(area, base.porEquipo, base.grupo, CASTILLA_OPTA, rivales, periodo);
  const nombreRival =
    rivales.length === 1
      ? base.nombre.get(rivales[0]) ?? "el rival"
      : modo === "top5"
        ? "los 5 de arriba"
        : modo === "grupo"
          ? "la media del grupo"
          : `${rivales.length} rivales`;
  const juzgadas = filas.filter((f) => f.m.mejorAlto != null && f.nuestro != null && f.rival != null);
  const ganamos = juzgadas.filter((f) => f.gana === "nuestro");
  const pierde = juzgadas.filter((f) => f.gana === "rival");
  const nNuestros = recorta(base.porEquipo.get(CASTILLA_OPTA) ?? [], periodo).length;
  const nSuyos = rivales.reduce((s, r) => s + recorta(base.porEquipo.get(r) ?? [], periodo).length, 0);

  /* La diferencia más grande, medida en percentil para comparar cifras distintas. */
  const brecha = (f: FilaFrente) => (f.pNuestro ?? 50) - (f.pRival ?? 50);
  const masNuestra = [...ganamos].sort((a, b) => brecha(b) - brecha(a))[0];
  const masSuya = [...pierde].sort((a, b) => brecha(a) - brecha(b))[0];

  const titulo = !rivales.length
    ? "Elige con quién comparar"
    : !juzgadas.length
      ? `Castilla frente a ${nombreRival}`
      : `${ganamos.length > pierde.length ? "Salimos mejor" : ganamos.length < pierde.length ? "Sale mejor el rival" : "Igualados"} frente a ${nombreRival}: ${ganamos.length} de ${juzgadas.length} cifras a nuestro favor`;
  const matiz = [
    masNuestra ? `lo más claro, ${masNuestra.m.nombre.toLowerCase()} (${textoFrente(masNuestra.m, masNuestra.nuestro)} frente a ${textoFrente(masNuestra.m, masNuestra.rival)})` : "",
    masSuya ? `donde más nos saca, ${masSuya.m.nombre.toLowerCase()} (${textoFrente(masSuya.m, masSuya.nuestro)} frente a ${textoFrente(masSuya.m, masSuya.rival)})` : "",
  ].filter(Boolean);

  const filaEnfocada = filas.find((f) => f.m.clave === enfocada) ?? null;

  const chip = (activo: boolean) =>
    `rounded-full border px-3 py-1 text-[12px] font-semibold transition ${
      activo ? "border-[#C8A96B]/70 bg-[#C8A96B]/15 text-white" : "border-white/15 bg-white/[0.03] text-white/65 hover:border-white/30"
    }`;
  const nombreCorto = (id: string | null) => (id ? base.nombre.get(id) ?? "" : "");

  return (
    <Lamina>
      <TituloConclusion
        pregunta={`¿Y frente al rival? · ${NOMBRE_AREA[area]}`}
        fuente={`Opta · ${periodo === "temporada" ? "toda la temporada" : `últimos ${periodo} partidos de cada uno`} · ${nNuestros} partidos del Castilla y ${nSuyos} ${rivales.length > 1 ? "de esos rivales" : "del rival"} · por partido · puesto entre los ${base.grupo.size} del grupo`}
      >
        {titulo}
      </TituloConclusion>
      {matiz.length ? <p className="-mt-1.5 mb-3 text-[13px] leading-snug text-white/70">{matiz.join("; ")}.</p> : null}

      {/* ---------------- con quién y cuándo ---------------- */}
      <div className="flex flex-wrap items-center gap-1.5">
        {idFiltro && (
          <button type="button" className={chip(modo === "filtro")} onClick={() => elige("filtro")}>
            Filtro: {nombreCorto(idFiltro)}
          </button>
        )}
        {idProximo && (
          <button type="button" className={chip(modo === "proximo")} onClick={() => elige("proximo")}>
            Próximo: {nombreCorto(idProximo)}
          </button>
        )}
        {base.ultimo && (
          <button type="button" className={chip(modo === "ultimo")} onClick={() => elige("ultimo")}>
            Último: {nombreCorto(base.ultimo)}
          </button>
        )}
        {idPartido && idPartido !== idFiltro && idPartido !== base.ultimo && (
          <button type="button" className={chip(modo === "partido")} onClick={() => elige("partido")}>
            El del partido: {nombreCorto(idPartido)}
          </button>
        )}
        <button type="button" className={chip(modo === "top5")} onClick={() => elige("top5")}>
          Los 5 de arriba
        </button>
        <button type="button" className={chip(modo === "grupo")} onClick={() => elige("grupo")}>
          Todo el grupo
        </button>
        <button type="button" className={chip(abiertaLista || modo === "elegidos")} onClick={() => setAbiertaLista((v) => !v)} aria-expanded={abiertaLista}>
          {modo === "elegidos" && elegidos.length ? `Elegidos (${elegidos.length})` : "Elegir equipos…"}
        </button>
        <span className="mx-1 hidden h-5 w-px bg-white/15 sm:block" />
        <div className="inline-flex overflow-hidden rounded-full border border-white/15">
          {(["temporada", 5, 3] as Periodo[]).map((p) => (
            <button
              key={String(p)}
              type="button"
              onClick={() => setPeriodo(p)}
              className={`px-3 py-1 text-[12px] font-semibold transition ${periodo === p ? "bg-[#C8A96B]/20 text-white" : "text-white/60 hover:text-white/85"}`}
            >
              {p === "temporada" ? "Temporada" : `Últimos ${p}`}
            </button>
          ))}
        </div>
      </div>

      {abiertaLista && (
        <div className="mt-2 grid grid-cols-2 gap-1.5 rounded-xl border border-white/10 bg-white/[0.02] p-2 sm:grid-cols-3 lg:grid-cols-5">
          {base.equipos.map((e) => {
            const dentro = rivales.includes(e.teamId);
            return (
              <button
                key={e.teamId}
                type="button"
                onClick={() => alterna(e.teamId)}
                aria-pressed={dentro}
                className={`flex min-w-0 items-center gap-2 rounded-lg border px-2 py-1.5 text-left text-[12px] transition ${
                  dentro ? "border-[#4F8FE8]/70 bg-[#4F8FE8]/15 text-white" : "border-white/10 text-white/65 hover:border-white/25"
                }`}
              >
                <EscudoEquipo nombre={e.equipo} escudo={escudoDe(e.equipo) ?? undefined} lado={20} />
                <span className="truncate">{e.equipo}</span>
              </button>
            );
          })}
        </div>
      )}

      {!rivales.length ? (
        <p className="mt-4 text-sm text-white/60">Pincha uno o varios equipos para ponerlos al lado del Castilla.</p>
      ) : (
        <>
          {/* ---------------- el marcador ---------------- */}
          <Marcador
            nuestros={ganamos.length}
            suyos={pierde.length}
            iguales={filas.length - ganamos.length - pierde.length}
            rivales={rivales.map((r) => ({ id: r, nombre: base.nombre.get(r) ?? "" }))}
            nombreRival={nombreRival}
            escudoDe={escudoDe}
          />

          <div className={`mt-4 grid min-w-0 gap-4 ${filas.length >= 3 ? "lg:grid-cols-[minmax(0,360px)_minmax(0,1fr)]" : ""}`}>
            {filas.length >= 3 && (
              <div className="min-w-0">
                <Radar filas={filas} nombreRival={nombreRival} enfocada={enfocada} onEnfoca={setEnfocada} />
              </div>
            )}
            <div className="min-w-0 space-y-2">
              {filas.map((f) => (
                <FilaMariposa key={f.m.clave} f={f} rivales={rivales} nombreRival={nombreRival} activa={enfocada === f.m.clave} onEnfoca={() => setEnfocada((v) => (v === f.m.clave ? null : f.m.clave))} />
              ))}
              <p className="pt-1 text-[11px] leading-snug text-white/45">
                Barra llena: el que sale mejor en esa cifra; raya blanca: la media del grupo. En la tira, cada punto es un equipo del grupo y a la derecha está el mejor
                (en lo que es estilo, el que más). Pincha una cifra para ver su evolución partido a partido.
              </p>
            </div>
          </div>

          {filaEnfocada && (
            <Evolucion
              f={filaEnfocada}
              porEquipo={base.porEquipo}
              rivales={rivales}
              periodo={periodo}
              nombreRival={nombreRival}
              onCierra={() => setEnfocada(null)}
            />
          )}
        </>
      )}
    </Lamina>
  );
}

/* ------------------------------------------------------------------ */
/*  Marcador                                                           */
/* ------------------------------------------------------------------ */

function Marcador({
  nuestros,
  suyos,
  iguales,
  rivales,
  nombreRival,
  escudoDe,
}: {
  nuestros: number;
  suyos: number;
  iguales: number;
  rivales: { id: string; nombre: string }[];
  nombreRival: string;
  escudoDe: (n: string) => string | null;
}) {
  const total = Math.max(1, nuestros + suyos);
  return (
    <div className="mt-4 rounded-2xl border border-white/10 bg-gradient-to-r from-[#C8A96B]/[0.10] via-transparent to-[#4F8FE8]/[0.10] px-3 py-3 sm:px-5">
      <div className="flex items-center justify-between gap-2">
        <div className="flex min-w-0 items-center gap-2 sm:gap-3">
          <span className="hidden sm:block"><EscudoEquipo nombre="Real Madrid Castilla" escudo={escudoDe("Real Madrid Castilla") ?? undefined} lado={40} /></span>
          <div className="min-w-0">
            <p className="line-clamp-2 text-[13px] font-bold leading-tight text-white sm:text-base">Castilla</p>
            <p className="hidden text-[11px] text-white/50 sm:block">mejor en</p>
          </div>
        </div>
        <div className="flex shrink-0 flex-col items-center font-black tabular-nums"><div className="flex items-baseline gap-2">
          <span className="text-4xl sm:text-5xl" style={{ color: ORO }}>
            {nuestros}
          </span>
          <span className="text-2xl text-white/30">–</span>
          <span className="text-4xl sm:text-5xl" style={{ color: AZUL }}>
            {suyos}
          </span>
        </div>
          <span className="text-[10px] font-semibold uppercase tracking-[0.14em] text-white/45">cifras ganadas</span>
        </div>
        <div className="flex min-w-0 items-center justify-end gap-2 sm:gap-3">
          <div className="min-w-0 text-right">
            <p className="line-clamp-2 break-words text-[13px] font-bold leading-tight text-white sm:text-base">{nombreRival}</p>
            <p className="hidden text-[11px] text-white/50 sm:block">mejor en</p>
          </div>
          {rivales.length === 1 ? (
            <span className="hidden sm:block"><EscudoEquipo nombre={rivales[0].nombre} escudo={escudoDe(rivales[0].nombre) ?? undefined} lado={40} /></span>
          ) : (
            <div className="flex -space-x-3">
              {rivales.slice(0, 4).map((r) => (
                <EscudoEquipo key={r.id} nombre={r.nombre} escudo={escudoDe(r.nombre) ?? undefined} lado={32} className="ring-2 ring-[var(--rmcf-bg,#08111F)]" />
              ))}
              {rivales.length > 4 && (
                <span className="flex h-8 w-8 items-center justify-center rounded-full border border-white/15 bg-white/[0.08] text-[11px] font-bold text-white/70">+{rivales.length - 4}</span>
              )}
            </div>
          )}
        </div>
      </div>
      {/* La barra del marcador: cuánto se lleva cada uno de lo que se juzga. */}
      <div className="mt-3 flex h-2.5 overflow-hidden rounded-full bg-white/[0.06]">
        <div style={{ width: `${(nuestros / total) * 100}%`, background: ORO }} className="transition-all duration-500" />
        <div style={{ width: `${(suyos / total) * 100}%`, background: AZUL }} className="ml-auto transition-all duration-500" />
      </div>
      {iguales > 0 && <p className="mt-1.5 text-center text-[11px] text-white/45">{iguales === 1 ? "1 cifra igualada o de estilo (no se juzga)" : `${iguales} cifras igualadas o de estilo (no se juzgan)`}</p>}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Radar de percentiles                                               */
/* ------------------------------------------------------------------ */

function partes(t: string, ancho = 14): string[] {
  const out: string[] = [];
  let linea = "";
  for (const w of t.split(" ")) {
    if ((linea + " " + w).trim().length > ancho && linea) {
      out.push(linea);
      linea = w;
    } else linea = (linea + " " + w).trim();
  }
  if (linea) out.push(linea);
  return out.slice(0, 3);
}

function Radar({ filas, nombreRival, enfocada, onEnfoca }: { filas: FilaFrente[]; nombreRival: string; enfocada: string | null; onEnfoca: (c: string | null) => void }) {
  const S = 320;
  const c = S / 2;
  const R = 84;
  const n = filas.length;
  const ang = (i: number) => -Math.PI / 2 + (i * 2 * Math.PI) / n;
  const pt = (i: number, p: number) => [c + Math.cos(ang(i)) * R * (p / 100), c + Math.sin(ang(i)) * R * (p / 100)] as const;
  const poli = (lado: "pNuestro" | "pRival") => filas.map((f, i) => pt(i, Math.max(4, f[lado] ?? 0)).join(",")).join(" ");

  return (
    <figure className="min-w-0">
      <svg viewBox={`-44 -6 ${S + 88} ${S + 12}`} className="mx-auto block w-full max-w-[360px] overflow-visible" role="img" aria-label={`Percentiles en el grupo: Castilla frente a ${nombreRival}`}>
        {[25, 50, 75, 100].map((p) => (
          <polygon
            key={p}
            points={filas.map((_, i) => pt(i, p).join(",")).join(" ")}
            fill="none"
            stroke={tinta(p === 50 ? 0.3 : 0.12)}
            strokeDasharray={p === 50 ? "3 3" : undefined}
          />
        ))}
        {filas.map((f, i) => {
          const [x, y] = pt(i, 100);
          const [lx, ly] = pt(i, 122);
          const lineas = partes(f.m.nombre);
          const anchor = Math.abs(lx - c) < 8 ? "middle" : lx > c ? "start" : "end";
          const activa = enfocada === f.m.clave;
          return (
            <g key={f.m.clave} className="cursor-pointer" onClick={() => onEnfoca(activa ? null : f.m.clave)}>
              <line x1={c} y1={c} x2={x} y2={y} stroke={tinta(0.12)} />
              <text
                x={lx}
                y={ly - ((lineas.length - 1) * 11) / 2}
                textAnchor={anchor}
                dominantBaseline="middle"
                fontSize={10}
                fontWeight={activa ? 700 : 500}
                fill={activa ? ORO : tinta(f.m.mejorAlto == null ? 0.4 : 0.7)}
              >
                {lineas.map((l, k) => (
                  <tspan key={k} x={lx} dy={k ? 11 : 0}>
                    {l}
                  </tspan>
                ))}
              </text>
            </g>
          );
        })}
        <polygon points={poli("pRival")} fill={AZUL} fillOpacity={0.18} stroke={AZUL} strokeWidth={2} strokeLinejoin="round" />
        <polygon points={poli("pNuestro")} fill="#C8A96B" fillOpacity={0.22} stroke={ORO} strokeWidth={2.5} strokeLinejoin="round" />
        {filas.map((f, i) => {
          const [ax, ay] = pt(i, Math.max(4, f.pRival ?? 0));
          const [bx, by] = pt(i, Math.max(4, f.pNuestro ?? 0));
          return (
            <g key={f.m.clave}>
              <circle cx={ax} cy={ay} r={3.5} fill={AZUL} />
              <circle cx={bx} cy={by} r={4} fill={ORO} />
            </g>
          );
        })}
      </svg>
      <figcaption className="mt-1 flex flex-wrap items-center justify-center gap-x-4 gap-y-1 text-[11px] text-white/60">
        <span className="inline-flex items-center gap-1.5">
          <span className="h-2.5 w-2.5 rounded-full" style={{ background: ORO }} /> Castilla
        </span>
        <span className="inline-flex items-center gap-1.5">
          <span className="h-2.5 w-2.5 rounded-full" style={{ background: AZUL }} /> {nombreRival}
        </span>
        <span>Hacia fuera, mejor en el grupo · raya: la mitad</span>
      </figcaption>
    </figure>
  );
}

/* ------------------------------------------------------------------ */
/*  Barras enfrentadas + tira del grupo                                 */
/* ------------------------------------------------------------------ */

const puesto = (p: number | null) => (p == null ? "" : `${p}.º`);

function FilaMariposa({ f, rivales, nombreRival, activa, onEnfoca }: { f: FilaFrente; rivales: string[]; nombreRival: string; activa: boolean; onEnfoca: () => void }) {
  const valores = f.grupo.map((g) => g.valor);
  const tope = Math.max(...valores, f.nuestro ?? 0, f.rival ?? 0, 1e-9);
  const ancho = (v: number | null) => `${v == null ? 0 : Math.max(2, (v / tope) * 100)}%`;
  const media = f.media != null ? (f.media / tope) * 100 : null;
  const opN = f.gana === "rival" ? 0.35 : 1;
  const opR = f.gana === "nuestro" ? 0.35 : 1;

  /* La tira: a la derecha el mejor (en lo que menos es mejor, se da la vuelta). */
  const min = Math.min(...valores, f.nuestro ?? Infinity, f.rival ?? Infinity);
  const max = Math.max(...valores, f.nuestro ?? -Infinity, f.rival ?? -Infinity);
  const x = (v: number) => {
    const t = max > min ? (v - min) / (max - min) : 0.5;
    return (f.m.mejorAlto === false ? 1 - t : t) * 100;
  };
  const esRival = new Set(rivales);

  return (
    <button
      type="button"
      onClick={onEnfoca}
      aria-pressed={activa}
      title={f.m.comoLeer}
      className={`block w-full min-w-0 rounded-xl border px-3 py-2 text-left transition ${activa ? "border-[#C8A96B]/60 bg-[#C8A96B]/[0.07]" : "border-white/[0.07] bg-white/[0.02] hover:border-white/20"}`}
    >
      <div className="flex items-center justify-between gap-2">
        <span className="text-[15px] font-black tabular-nums" style={{ color: ORO, opacity: f.gana === "rival" ? 0.6 : 1 }}>
          {textoFrente(f.m, f.nuestro)}
        </span>
        <span className="min-w-0 truncate text-center text-[12px] font-semibold text-white/80">
          {f.m.nombre}
          {f.m.mejorAlto == null && <span className="ml-1 font-normal text-white/40">· estilo</span>}
        </span>
        <span className="text-[15px] font-black tabular-nums" style={{ color: AZUL, opacity: f.gana === "nuestro" ? 0.6 : 1 }}>
          {textoFrente(f.m, f.rival)}
        </span>
      </div>
      {/* Mariposa */}
      <div className="mt-1 grid grid-cols-2 gap-[3px]">
        <div className="relative h-3 overflow-hidden rounded-l-full bg-white/[0.05]">
          <div className="absolute inset-y-0 right-0 rounded-l-full transition-all duration-500" style={{ width: ancho(f.nuestro), background: ORO, opacity: opN }} />
          {media != null && <div className="absolute inset-y-[-2px] w-[2px] bg-white/80" style={{ right: `${media}%` }} />}
        </div>
        <div className="relative h-3 overflow-hidden rounded-r-full bg-white/[0.05]">
          <div className="absolute inset-y-0 left-0 rounded-r-full transition-all duration-500" style={{ width: ancho(f.rival), background: AZUL, opacity: opR }} />
          {media != null && <div className="absolute inset-y-[-2px] w-[2px] bg-white/80" style={{ left: `${media}%` }} />}
        </div>
      </div>
      {/* Tira del grupo */}
      <div className="mt-2 flex items-center gap-2">
        <span className="w-9 shrink-0 text-[10px] tabular-nums" style={{ color: ORO }}>
          {puesto(f.puestoNuestro)}
        </span>
        <div className="relative h-4 min-w-0 flex-1">
          <div className="absolute inset-x-0 top-1/2 h-px -translate-y-1/2 bg-gradient-to-r from-[#D95F02]/40 via-white/15 to-[#1B9E77]/50" />
          {f.grupo
            .filter((g) => g.teamId !== CASTILLA_OPTA && !esRival.has(g.teamId))
            .map((g) => (
              <span key={g.teamId} className="absolute top-1/2 h-1.5 w-1.5 -translate-x-1/2 -translate-y-1/2 rounded-full bg-white/30" style={{ left: `${x(g.valor)}%` }} />
            ))}
          {rivales.length === 1 && f.rival != null && (
            <span className="absolute top-1/2 h-3 w-3 -translate-x-1/2 -translate-y-1/2 rounded-full ring-2 ring-white/20" style={{ left: `${x(f.rival)}%`, background: AZUL }} />
          )}
          {rivales.length > 1 &&
            f.grupo
              .filter((g) => esRival.has(g.teamId))
              .map((g) => <span key={g.teamId} className="absolute top-1/2 h-2 w-2 -translate-x-1/2 -translate-y-1/2 rounded-full" style={{ left: `${x(g.valor)}%`, background: AZUL, opacity: 0.8 }} />)}
          {f.nuestro != null && (
            <span className="absolute top-1/2 h-3.5 w-3.5 -translate-x-1/2 -translate-y-1/2 rounded-full ring-2 ring-white/40" style={{ left: `${x(f.nuestro)}%`, background: ORO }} />
          )}
        </div>
        <span className="w-9 shrink-0 text-right text-[10px] tabular-nums" style={{ color: AZUL }}>
          {rivales.length === 1 ? puesto(f.puestoRival) : ""}
        </span>
      </div>
      <span className="sr-only">
        Castilla {textoFrente(f.m, f.nuestro)}, {nombreRival} {textoFrente(f.m, f.rival)}, media del grupo {textoFrente(f.m, f.media)}.
      </span>
    </button>
  );
}

/* ------------------------------------------------------------------ */
/*  Evolución partido a partido                                         */
/* ------------------------------------------------------------------ */

function Evolucion({
  f,
  porEquipo,
  rivales,
  periodo,
  nombreRival,
  onCierra,
}: {
  f: FilaFrente;
  porEquipo: ReturnType<typeof partidosPorEquipo>;
  rivales: string[];
  periodo: Periodo;
  nombreRival: string;
  onCierra: () => void;
}) {
  const N = periodo === "temporada" ? 12 : periodo;
  const nuestros = (porEquipo.get(CASTILLA_OPTA) ?? []).slice(-N);
  const serieN = nuestros.map((p) => ({ v: valorPartido(f.m, p), etiqueta: `${p.contra} · ${p.fecha.slice(8, 10)}/${p.fecha.slice(5, 7)}` }));
  /* Con varios rivales, la media de su k-ésimo partido empezando por el final. */
  const listas = rivales.map((r) => (porEquipo.get(r) ?? []).slice(-N));
  const largo = Math.max(0, ...listas.map((l) => l.length));
  const serieR = Array.from({ length: largo }, (_, k) => {
    const vs = listas
      .map((l) => l[l.length - largo + k])
      .filter(Boolean)
      .map((p) => valorPartido(f.m, p))
      .filter((v): v is number => v != null);
    const uno = rivales.length === 1 ? listas[0][listas[0].length - largo + k] : null;
    return { v: vs.length ? vs.reduce((s, x) => s + x, 0) / vs.length : null, etiqueta: uno ? `${uno.contra} · ${uno.fecha.slice(8, 10)}/${uno.fecha.slice(5, 7)}` : `media de ${vs.length}` };
  });

  const W = 960;
  const H = 230;
  const pad = { l: 34, r: 12, t: 14, b: 24 };
  const n = Math.max(serieN.length, serieR.length, 2);
  const todos = [...serieN, ...serieR].map((s) => s.v).filter((v): v is number => v != null);
  const top = Math.max(...todos, f.media ?? 0, 1e-9) * 1.1;
  const X = (i: number, len: number) => pad.l + ((i + (n - len)) / (n - 1)) * (W - pad.l - pad.r);
  const Y = (v: number) => H - pad.b - (v / top) * (H - pad.t - pad.b);
  const camino = (s: { v: number | null }[]) =>
    s
      .map((p, i) => (p.v == null ? null : `${X(i, s.length).toFixed(1)},${Y(p.v).toFixed(1)}`))
      .filter(Boolean)
      .join(" ");

  const ultimos3 = (s: { v: number | null }[]) => {
    const v = s.slice(-3).map((p) => p.v).filter((x): x is number => x != null);
    return v.length ? v.reduce((a, b) => a + b, 0) / v.length : null;
  };
  const uN = ultimos3(serieN);
  const uR = ultimos3(serieR);

  return (
    <div className="mt-4 rounded-2xl border border-[#C8A96B]/30 bg-white/[0.02] p-3 sm:p-4">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-white/50">Partido a partido · {f.m.nombre}</p>
          <p className="mt-0.5 text-sm font-semibold text-white">
            Últimos 3: Castilla <span style={{ color: ORO }}>{textoFrente(f.m, uN)}</span> · {nombreRival} <span style={{ color: AZUL }}>{textoFrente(f.m, uR)}</span> · media del grupo{" "}
            {textoFrente(f.m, f.media)}
          </p>
        </div>
        <button type="button" onClick={onCierra} className="shrink-0 rounded-lg border border-white/15 px-2 py-0.5 text-[12px] text-white/60 hover:text-white">
          Cerrar
        </button>
      </div>
      <svg viewBox={`0 0 ${W} ${H}`} className="mt-2 block w-full max-h-[260px]" preserveAspectRatio="xMidYMid meet" role="img" aria-label={`${f.m.nombre}, partido a partido`}>
        {[0, 0.5, 1].map((t) => (
          <g key={t}>
            <line x1={pad.l} x2={W - pad.r} y1={Y(top * t)} y2={Y(top * t)} stroke={tinta(0.08)} />
            <text x={pad.l - 6} y={Y(top * t)} textAnchor="end" dominantBaseline="middle" fontSize={10} fill={tinta(0.45)}>
              {textoFrente(f.m, top * t)}
            </text>
          </g>
        ))}
        {f.media != null && (
          <g>
            <line x1={pad.l} x2={W - pad.r} y1={Y(f.media)} y2={Y(f.media)} stroke={tinta(0.5)} strokeDasharray="5 4" />
            <text x={W - pad.r} y={Y(f.media) - 5} textAnchor="end" fontSize={10} fill={tinta(0.55)}>
              media del grupo
            </text>
          </g>
        )}
        <polyline points={camino(serieR)} fill="none" stroke={AZUL} strokeWidth={2.5} strokeLinejoin="round" strokeLinecap="round" />
        <polyline points={camino(serieN)} fill="none" stroke={ORO} strokeWidth={3} strokeLinejoin="round" strokeLinecap="round" />
        {serieR.map((p, i) =>
          p.v == null ? null : (
            <circle key={`r${i}`} cx={X(i, serieR.length)} cy={Y(p.v)} r={4} fill={AZUL}>
              <title>{`${nombreRival}: ${textoFrente(f.m, p.v)} (${p.etiqueta})`}</title>
            </circle>
          ),
        )}
        {serieN.map((p, i) => {
          if (p.v == null) return null;
          const bien = f.m.mejorAlto == null || f.media == null ? null : (p.v >= f.media) === f.m.mejorAlto;
          return (
            <circle key={`n${i}`} cx={X(i, serieN.length)} cy={Y(p.v)} r={5} fill={ORO} stroke={bien == null ? "none" : bien ? VERDE : NARANJA} strokeWidth={2}>
              <title>{`Castilla: ${textoFrente(f.m, p.v)} (${p.etiqueta})`}</title>
            </circle>
          );
        })}
        <text x={pad.l} y={H - 6} fontSize={10} fill={tinta(0.45)}>
          ← más antiguo
        </text>
        <text x={W - pad.r} y={H - 6} textAnchor="end" fontSize={10} fill={tinta(0.45)}>
          último partido →
        </text>
      </svg>
      <p className="mt-1 text-[11px] text-white/45">
        Cada punto es un partido de cada equipo (pasa por encima para ver contra quién). El borde verde o naranja de nuestros puntos dice si ese partido quedó mejor o peor que la media del grupo.
        {rivales.length > 1 ? " En azul, la media de esos rivales en su partido equivalente empezando por el último." : ""}
      </p>
    </div>
  );
}

