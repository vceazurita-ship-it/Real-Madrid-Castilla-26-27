"use client";

/*
| ÁREA DE MEJORA (05/11/2026)
|
| La pestaña de la ficha individual que responde a «¿dónde está y qué le
| falta?». Todo sale de lo que ya hay:
|
| - Wyscout de la categoría (/api/data-analisis): percentil en cada métrica de
|   su puesto contra dos grupos — toda la categoría del puesto y los de su
|   edad ±3 años —, agrupado por momento del juego.
| - Valoraciones: la nota partido a partido y su tendencia.
| - Élite (Primera y Premier, ±3 años, mismo puesto): `public/data/wys-elite/
|   resumen.json` cuando exista la descarga mensual. Sin el fichero, el bloque
|   no se pinta (lo que no tiene dato no se nombra).
*/

import { useEffect, useMemo, useState } from "react";
import { ArrowDownRight, ArrowUpRight, Crosshair, Sparkles, TrendingUp } from "lucide-react";

import { traeJson } from "@/lib/hojaCsv";
import type { FilaJugador } from "@/lib/data-analisis/leer";
import { casaNombre } from "@/lib/data-analisis/once";
import { GRUPOS_JUGADOR, MINUTOS_MINIMOS, PUESTOS, puestoDe } from "@/lib/data-analisis/individual";
import { indiceDe, percentilesDe, type Percentil } from "@/lib/comparativa-u21";
import type { RatingsSeason } from "@/lib/ratings/types";

const ORO = "#D8B45A";
const AZUL = "#4F8FE8";
const ROJO = "#E5484D";
const VERDE = "#1B9E77";

/** /api/data-elite: los «Search results» de Primera y Premier, menores de 28 con 450′. */
type Elite = { actualizado: string | null; ligas: { liga: string; jugadores: FilaJugador[] }[] };

/*
| «Se parece a»: el estilo, no el nivel. Cada métrica del puesto se pasa a
| z-score dentro del grupo (él + los de élite de su puesto y edad) y se mide
| el coseno entre perfiles: dos jugadores con la misma forma de jugar se
| parecen aunque uno haga todo el doble.
*/
function parecidos(yo: FilaJugador, otros: FilaJugador[], columnas: string[], cuantos = 3) {
  const todos = [yo, ...otros];
  const cols = columnas.filter((c) => todos.filter((j) => typeof j.datos[c] === "number").length >= todos.length * 0.8);
  if (cols.length < 5) return [];
  const est = cols.map((c) => {
    const v = todos.map((j) => j.datos[c] ?? 0);
    const m = media(v);
    const d = Math.sqrt(media(v.map((x) => (x - m) ** 2))) || 1;
    return { c, m, d };
  });
  const vec = (j: FilaJugador) => est.map(({ c, m, d }) => ((j.datos[c] ?? m) - m) / d);
  const a = vec(yo);
  const na = Math.hypot(...a) || 1;
  return otros
    .map((j) => {
      const b = vec(j);
      const sim = a.reduce((s2, x, i) => s2 + x * b[i], 0) / (na * (Math.hypot(...b) || 1));
      return { j, sim };
    })
    .sort((x, y) => y.sim - x.sim)
    .slice(0, cuantos);
}

const media = (xs: number[]) => (xs.length ? xs.reduce((s, x) => s + x, 0) / xs.length : 0);
const coma = (n: number, d = 1) => n.toFixed(d).replace(".", ",");

/** Un radar en SVG: ejes con su rótulo, la referencia (50) y una o dos capas. */
function Radar({ ejes, capas, tam = 300 }: { ejes: string[]; capas: { valores: number[]; color: string; nombre: string }[]; tam?: number }) {
  const c = tam / 2;
  const r = tam / 2 - 46;
  const n = ejes.length;
  const punto = (i: number, v: number) => {
    const a = (Math.PI * 2 * i) / n - Math.PI / 2;
    return [c + Math.cos(a) * r * (v / 100), c + Math.sin(a) * r * (v / 100)] as const;
  };
  const poligono = (vals: number[]) => vals.map((v, i) => punto(i, Math.max(3, v)).join(",")).join(" ");

  if (n < 3) return null;

  return (
    <svg viewBox={`0 0 ${tam} ${tam}`} className="h-auto w-full max-w-[360px]" role="img" aria-label={`Radar: ${ejes.join(", ")}`}>
      <defs>
        <radialGradient id="am-fondo">
          <stop offset="0%" stopColor={ORO} stopOpacity="0.10" />
          <stop offset="100%" stopColor={ORO} stopOpacity="0" />
        </radialGradient>
      </defs>
      <circle cx={c} cy={c} r={r} fill="url(#am-fondo)" />
      {[25, 50, 75, 100].map((anillo) => (
        <polygon
          key={anillo}
          points={ejes.map((_, i) => punto(i, anillo).join(",")).join(" ")}
          fill="none"
          stroke="currentColor"
          strokeOpacity={anillo === 50 ? 0.35 : 0.12}
          strokeDasharray={anillo === 50 ? "3 3" : undefined}
        />
      ))}
      {ejes.map((eje, i) => {
        const [x, y] = punto(i, 100);
        const [tx, ty] = punto(i, 122);
        return (
          <g key={eje}>
            <line x1={c} y1={c} x2={x} y2={y} stroke="currentColor" strokeOpacity={0.1} />
            <text x={tx} y={ty} textAnchor={Math.abs(tx - c) < 8 ? "middle" : tx > c ? "start" : "end"} dominantBaseline="middle" fontSize="10" fill="currentColor" fillOpacity={0.75}>
              {eje.length > 18 ? `${eje.slice(0, 17)}…` : eje}
            </text>
          </g>
        );
      })}
      {capas.map((capa, k) => (
        <g key={capa.nombre} className="am-capa" style={{ animationDelay: `${k * 180}ms` }}>
          <polygon points={poligono(capa.valores)} fill={capa.color} fillOpacity={k === 0 ? 0.22 : 0.08} stroke={capa.color} strokeWidth={k === 0 ? 2 : 1.5} strokeDasharray={k === 0 ? undefined : "4 3"} />
          {k === 0 &&
            capa.valores.map((v, i) => {
              const [x, y] = punto(i, Math.max(3, v));
              return <circle key={i} cx={x} cy={y} r={3} fill={capa.color}><title>{`${ejes[i]}: percentil ${Math.round(v)}`}</title></circle>;
            })}
        </g>
      ))}
    </svg>
  );
}

/** La nota de cada partido, con su media móvil de tres. */
function Tendencia({ puntos }: { puntos: { fecha: string; rival: string; nota: number }[] }) {
  if (puntos.length < 2) return null;

  const an = 560;
  const al = 150;
  const x = (i: number) => 24 + (i * (an - 48)) / (puntos.length - 1);
  const y = (v: number) => al - 20 - ((v - 3) / 7) * (al - 40);
  const movil = puntos.map((_, i) => media(puntos.slice(Math.max(0, i - 2), i + 1).map((p) => p.nota)));

  return (
    <svg viewBox={`0 0 ${an} ${al}`} className="h-auto w-full" role="img" aria-label="Nota por partido">
      {[5, 7, 9].map((v) => (
        <g key={v}>
          <line x1={20} x2={an - 10} y1={y(v)} y2={y(v)} stroke="currentColor" strokeOpacity={0.1} />
          <text x={4} y={y(v)} fontSize="9" dominantBaseline="middle" fill="currentColor" fillOpacity={0.5}>{v}</text>
        </g>
      ))}
      <polyline points={movil.map((v, i) => `${x(i)},${y(v)}`).join(" ")} fill="none" stroke={ORO} strokeWidth={2.5} strokeLinecap="round" />
      {puntos.map((p, i) => (
        <circle key={i} cx={x(i)} cy={y(p.nota)} r={4} fill={p.nota >= 7 ? VERDE : p.nota >= 5.5 ? AZUL : ROJO}>
          <title>{`${p.fecha} · ${p.rival}: ${coma(p.nota)}`}</title>
        </circle>
      ))}
    </svg>
  );
}

export function AreaMejora({
  nombre,
  apodo,
  idJugador,
  ratings,
}: {
  nombre: string;
  apodo?: string;
  idJugador: string;
  ratings: RatingsSeason | null;
}) {
  const [jugadores, setJugadores] = useState<FilaJugador[] | null>(null);
  const [elite, setElite] = useState<Elite | null>(null);

  useEffect(() => {
    let vivo = true;
    traeJson<{ jugadores?: FilaJugador[] }>("/api/data-analisis")
      .then((r) => vivo && setJugadores(r?.jugadores ?? []))
      .catch(() => vivo && setJugadores([]));
    fetch("/api/data-elite")
      .then((r) => (r.ok ? r.json() : null))
      .then((e: Elite | null) => vivo && e?.ligas?.length && setElite(e))
      .catch(() => {});
    return () => {
      vivo = false;
    };
  }, []);

  const analisis = useMemo(() => {
    if (!jugadores?.length) return null;

    const actuales = jugadores.filter((j) => j.temporada === "actual");
    const fila = casaNombre(nombre, actuales, (j) => j.jugador) ?? (apodo ? casaNombre(apodo, actuales, (j) => j.jugador) : null);

    if (!fila) return null;

    const puesto = puestoDe(fila.posicion);
    const delPuesto = actuales.filter((j) => j.minutos >= MINUTOS_MINIMOS && puestoDe(j.posicion) === puesto);
    const deSuEdad = delPuesto.filter((j) => j.edad > 0 && Math.abs(j.edad - fila.edad) <= 3);

    const contraTodos = percentilesDe(fila, delPuesto, puesto);
    const contraEdad = percentilesDe(fila, deSuEdad, puesto);

    const grupos = GRUPOS_JUGADOR.map((g) => ({
      grupo: g,
      todos: contraTodos.filter((p) => p.metrica.grupo === g).map((p) => p.percentil),
      edad: contraEdad.filter((p) => p.metrica.grupo === g).map((p) => p.percentil),
    })).filter((g) => g.todos.length);

    const ordenados = [...contraEdad].sort((a, b) => b.percentil - a.percentil);

    const mediana = (p: Percentil) => {
      const vals = deSuEdad.map((j) => j.datos[p.metrica.columna]).filter((v): v is number => typeof v === "number").sort((a, b) => a - b);
      return vals.length ? vals[Math.floor(vals.length / 2)] : null;
    };

    return {
      fila,
      puesto,
      nPuesto: delPuesto.length,
      nEdad: deSuEdad.length,
      indiceTodos: indiceDe(contraTodos),
      indiceEdad: indiceDe(contraEdad),
      grupos,
      fuertes: ordenados.slice(0, 4).map((p) => ({ p, mediana: mediana(p) })),
      mejora: ordenados.slice(-4).reverse().map((p) => ({ p, mediana: mediana(p) })),
      contraEdad,
    };
  }, [jugadores, nombre, apodo]);

  const notas = useMemo(() => {
    if (!ratings) return [];
    return Object.values(ratings.matches)
      .map((m) => ({ m, r: m.players[idJugador] }))
      .filter(({ r }) => r && r.rating > 0 && !r.unrated)
      .sort((a, b) => a.m.match.date.localeCompare(b.m.match.date))
      .map(({ m, r }) => ({ fecha: m.match.date.slice(5).split("-").reverse().join("/"), rival: m.match.opponent, nota: r!.rating }));
  }, [ratings, idJugador]);

  const tendencia = notas.length >= 4 ? media(notas.slice(-3).map((n) => n.nota)) - media(notas.slice(0, -3).map((n) => n.nota)) : null;

  /* Élite: percentil de su valor dentro de los de Primera / Premier de su puesto y edad. */
  const contraElite = useMemo(() => {
    if (!elite || !analisis) return [];
    return elite.ligas
      .map((liga) => {
        const pares = liga.jugadores.filter((j) => puestoDe(j.posicion) === analisis.puesto && Math.abs(j.edad - analisis.fila.edad) <= 3);
        if (pares.length < 5) return null;
        const ps = percentilesDe(analisis.fila, pares, analisis.puesto);
        return {
          liga: liga.liga,
          n: pares.length,
          indice: indiceDe(ps),
          grupos: GRUPOS_JUGADOR.map((g) => media(ps.filter((p) => p.metrica.grupo === g).map((p) => p.percentil))),
          parecidos: parecidos(analisis.fila, pares, analisis.contraEdad.map((p) => p.metrica.columna)),
        };
      })
      .filter((x): x is NonNullable<typeof x> => x !== null);
  }, [elite, analisis]);

  if (jugadores === null) {
    return <div className="h-64 animate-pulse rounded-2xl border border-white/10 bg-white/[0.03]" aria-label="Cargando el área de mejora" />;
  }

  const etiquetaPuesto = analisis ? PUESTOS.find((p) => p.key === analisis.puesto)?.label ?? analisis.puesto : "";

  return (
    <div className="space-y-5">
      <style>{`.am-capa{transform-origin:center;animation:am-entra .7s cubic-bezier(.2,.8,.2,1) both}@keyframes am-entra{from{opacity:0;transform:scale(.6)}to{opacity:1;transform:scale(1)}}`}</style>

      {analisis ? (
        <>
          {/* Cabecera: dos índices y la tendencia */}
          <div className="grid gap-3 sm:grid-cols-3">
            {[
              { t: `Contra los ${etiquetaPuesto.toLowerCase()} de su edad (±3)`, v: analisis.indiceEdad, n: analisis.nEdad },
              { t: `Contra todos los ${etiquetaPuesto.toLowerCase()} de la categoría`, v: analisis.indiceTodos, n: analisis.nPuesto },
            ].map((k) => (
              <div key={k.t} className="rounded-2xl border border-white/10 bg-gradient-to-br from-white/[0.06] to-transparent p-4">
                <p className="text-[12px] text-white/60">{k.t}</p>
                <p className="mt-1 text-3xl font-black tabular-nums" style={{ color: (k.v ?? 0) >= 66 ? VERDE : (k.v ?? 0) >= 40 ? ORO : ROJO }}>
                  {k.v ?? "—"}
                  <span className="ml-1 text-sm font-semibold text-white/50">/ 100</span>
                </p>
                <p className="text-[12px] text-white/50">percentil medio · {k.n} jugadores · Wyscout</p>
              </div>
            ))}
            {notas.length > 0 && (
              <div className="rounded-2xl border border-white/10 bg-gradient-to-br from-white/[0.06] to-transparent p-4">
                <p className="flex items-center gap-1.5 text-[12px] text-white/60"><TrendingUp size={13} /> Valoración del cuerpo técnico</p>
                <p className="mt-1 text-3xl font-black tabular-nums text-white">{coma(media(notas.map((n) => n.nota)))}</p>
                <p className="flex items-center gap-1 text-[12px] text-white/55">
                  {notas.length} partidos
                  {tendencia !== null && Math.abs(tendencia) >= 0.2 && (
                    <span className="inline-flex items-center" style={{ color: tendencia > 0 ? VERDE : ROJO }}>
                      · {tendencia > 0 ? <ArrowUpRight size={13} /> : <ArrowDownRight size={13} />} {coma(Math.abs(tendencia))} en los 3 últimos
                    </span>
                  )}
                </p>
              </div>
            )}
          </div>

          {/* El radar por momentos del juego */}
          <div className="grid items-center gap-5 rounded-2xl border border-white/10 bg-[radial-gradient(circle_at_30%_20%,rgba(216,180,90,.10),transparent_55%)] p-4 lg:grid-cols-[minmax(0,360px)_minmax(0,1fr)]">
            <div className="text-white">
              <Radar
                ejes={analisis.grupos.map((g) => g.grupo)}
                capas={[
                  { nombre: "Su edad", color: ORO, valores: analisis.grupos.map((g) => media(g.edad.length ? g.edad : g.todos)) },
                  { nombre: "Categoría", color: AZUL, valores: analisis.grupos.map((g) => media(g.todos)) },
                  ...contraElite.map((e, k) => ({ nombre: e.liga, color: k ? ROJO : VERDE, valores: analisis.grupos.map((g) => e.grupos[GRUPOS_JUGADOR.indexOf(g.grupo)] || 0) })),
                ]}
              />
            </div>
            <div className="min-w-0 space-y-3">
              <h4 className="text-sm font-bold uppercase tracking-[0.14em] text-[#D8B45A]">Momentos del juego</h4>
              <p className="text-[12px] text-white/55">
                Percentil en cada grupo de métricas de su puesto ({etiquetaPuesto.toLowerCase()}). 50 es la mitad del grupo.{" "}
                <span style={{ color: ORO }}>●</span> contra los de su edad ±3 · <span style={{ color: AZUL }}>●</span> contra toda la categoría
                {contraElite.map((e, k) => (
                  <span key={e.liga}> · <span style={{ color: k ? ROJO : VERDE }}>●</span> contra {e.liga} ({e.n})</span>
                ))}
              </p>
              <ul className="space-y-1.5">
                {analisis.grupos.map((g) => {
                  const v = Math.round(media(g.edad.length ? g.edad : g.todos));
                  return (
                    <li key={g.grupo} className="flex items-center gap-2 text-[13px]">
                      <span className="w-36 shrink-0 truncate text-white/75">{g.grupo}</span>
                      <span className="relative h-2 flex-1 overflow-hidden rounded-full bg-white/10">
                        <span className="absolute inset-y-0 left-0 rounded-full transition-all duration-700" style={{ width: `${v}%`, background: v >= 66 ? VERDE : v >= 40 ? ORO : ROJO }} />
                        <span className="absolute inset-y-0 left-1/2 w-px bg-white/40" />
                      </span>
                      <span className="w-8 text-right tabular-nums text-white/80">{v}</span>
                    </li>
                  );
                })}
              </ul>
            </div>
          </div>

          {/* Lo que le distingue y lo que tiene que mejorar */}
          <div className="grid gap-3 md:grid-cols-2">
            {[
              { t: "Lo que le distingue", icono: Sparkles, color: VERDE, lista: analisis.fuertes },
              { t: "Área de mejora", icono: Crosshair, color: ROJO, lista: analisis.mejora },
            ].map((b) => (
              <div key={b.t} className="rounded-2xl border border-white/10 bg-white/[0.03] p-4">
                <h4 className="mb-2 flex items-center gap-2 text-sm font-bold" style={{ color: b.color }}>
                  <b.icono size={15} /> {b.t}
                </h4>
                <ul className="space-y-2">
                  {b.lista.map(({ p, mediana }) => (
                    <li key={p.metrica.columna} className="text-[13px]" title={p.metrica.comoLeer}>
                      <div className="flex items-baseline justify-between gap-2">
                        <span className="min-w-0 truncate text-white/85">{p.metrica.nombre}</span>
                        <span className="shrink-0 tabular-nums font-semibold" style={{ color: b.color }}>p{Math.round(p.percentil)}</span>
                      </div>
                      <p className="text-[12px] text-white/50">
                        {coma(p.valor, 2)}{mediana !== null ? ` · la mediana de su edad, ${coma(mediana, 2)}` : ""} · {p.metrica.grupo}
                      </p>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>

          {contraElite.length > 0 && (
            <div className="rounded-2xl border border-white/10 bg-[linear-gradient(135deg,rgba(27,158,119,.10),transparent_45%,rgba(229,72,77,.08))] p-4">
              <h4 className="text-sm font-bold uppercase tracking-[0.14em] text-[#D8B45A]">Frente a la élite de su edad</h4>
              <p className="mb-3 text-[12px] text-white/55">
                Mismo puesto y ±3 años, con 450′ o más esta temporada · Wyscout{elite?.actualizado ? ` · descarga del ${elite.actualizado.split("-").reverse().join("/")}` : ""}. «Se parece a»: la misma forma de jugar, no el mismo nivel.
              </p>
              <div className="grid gap-3 md:grid-cols-2">
                {contraElite.map((e, k) => (
                  <div key={e.liga} className="rounded-xl border border-white/10 bg-black/20 p-3">
                    <div className="flex items-baseline justify-between gap-2">
                      <span className="text-sm font-semibold" style={{ color: k ? ROJO : VERDE }}>{e.liga}</span>
                      <span className="text-[12px] text-white/50">{e.n} jugadores</span>
                    </div>
                    <p className="mt-1 text-2xl font-black tabular-nums text-white">
                      {e.indice ?? "—"}<span className="ml-1 text-sm font-semibold text-white/50">percentil medio</span>
                    </p>
                    {e.parecidos.length > 0 && (
                      <ul className="mt-2 space-y-1">
                        {e.parecidos.map(({ j, sim }) => (
                          <li key={j.jugador + j.equipo} className="flex items-center justify-between gap-2 text-[13px]">
                            <span className="min-w-0 truncate text-white/85">{j.jugador} <span className="text-white/45">· {j.equipo} · {j.edad} años</span></span>
                            <span className="shrink-0 tabular-nums text-white/60">{Math.round(sim * 100)} %</span>
                          </li>
                        ))}
                      </ul>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}
        </>
      ) : (
        <p className="rounded-2xl border border-white/10 bg-white/[0.03] p-4 text-sm text-white/65">
          No está en la descarga de Wyscout de la categoría con minutos esta temporada: el radar sale en cuanto juegue y entre en la siguiente descarga.
        </p>
      )}

      {notas.length >= 2 && (
        <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-4">
          <h4 className="mb-1 text-sm font-bold text-white">Nota partido a partido</h4>
          <p className="mb-2 text-[12px] text-white/50">Puntos: cada partido (verde 7 o más, azul 5,5 a 7, rojo por debajo) · línea dorada: media de los tres últimos.</p>
          <div className="text-white"><Tendencia puntos={notas} /></div>
        </div>
      )}
    </div>
  );
}
