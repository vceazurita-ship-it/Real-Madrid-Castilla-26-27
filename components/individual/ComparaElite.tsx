"use client";

/*
| CARA A CARA CON LA ÉLITE (07/11/2026)
|
| Petición del analista: «poder comparar al o a los jugadores de la Premier y
| de LaLiga con un visualizador como el que tenemos de nuestro jugador». Se
| eligen hasta tres de la élite de su puesto (por defecto, los que más se le
| parecen) y salen encima de su misma radiografía.
|
| La vara es la misma para todos: los de élite de su puesto y su edad (±3
| años, 450′ o más, Primera y Premier juntas). Así un 60 de nuestro jugador y
| un 85 del de la Premier se leen en la misma escala. Si de su edad hay pocos,
| se amplía a todas las edades del puesto y se dice.
|
| Debajo, «Dónde está la diferencia»: las métricas en las que más le saca el
| primero elegido, con lo que le falta por 90′, y en las que ya está por
| delante. Lo que no tiene dato no se nombra.
*/

import { useMemo, useState } from "react";
import { Search, X } from "lucide-react";

import type { FilaJugador } from "@/lib/data-analisis/leer";
import { puestoDe, volumenDelPorcentaje, type Puesto } from "@/lib/data-analisis/individual";
import { indiceDe, percentilesDe, type Percentil } from "@/lib/comparativa-u21";
import { RadiografiaPercentiles, type CunaPercentil } from "@/components/data/visual/RadiografiaPercentiles";

const ROSA = "#EC4899";
const COLORES = ["#22D3EE", "#A78BFA", "#F59E0B"];
const MAX = 3;

const coma = (n: number, d = 1) => n.toFixed(d).replace(".", ",");
const idDe = (j: FilaJugador) => `${j.jugador}|${j.equipo}`;
/** «xG» → «Goles esperados (xG)»: la jerga, explicada la primera vez. */
const nombreMetrica = (n: string) =>
  n
    .replace(/ %$/, "")
    .replace(/^xG$/i, "Goles esperados (xG)")
    .replace(/^xA$/i, "Asistencias esperadas (xA)")
    .replace(/\bxG\b(?! \()/g, "goles esperados")
    .replace(/\bxA\b(?! \()/g, "asistencias esperadas");

/** Cuántas acciones hay detrás de una cifra en sus minutos (por 90′ → total; % → intentos). */
function accionesDe(j: FilaJugador, p: Percentil) {
  if (p.metrica.unidad === "porcentaje") {
    const v = volumenDelPorcentaje(j, p.metrica.columna);
    return v.cuantas === null ? null : (v.cuantas * j.minutos) / 90;
  }
  return (p.valor * j.minutos) / 90;
}

/** El valor con su base: «72,0 % (≈ 18 de 25)» o «1,25 por 90′ (≈ 8 en 646′)». */
function conBase(j: FilaJugador, p: Percentil) {
  const n = accionesDe(j, p);
  if (n === null) return valorEscrito(p);
  if (p.metrica.unidad === "porcentaje") return `${valorEscrito(p)} (≈ ${Math.round((p.valor / 100) * n)} de ${Math.round(n)})`;
  return `${valorEscrito(p)} (≈ ${Math.round(n)} en ${j.minutos}′)`;
}

const valorEscrito = (p: Percentil) => (p.metrica.unidad === "porcentaje" ? `${coma(p.valor, 1)} %` : coma(p.valor, Math.abs(p.valor) >= 10 ? 1 : 2));

/** De cada fase, hasta seis métricas repartidas entre sus grupos (la misma regla de la radiografía de la ficha). */
export function cunasDe(ps: Percentil[]): CunaPercentil[] {
  const sale: CunaPercentil[] = [];
  for (const lado of ["con", "sin"] as const) {
    const suyas = ps.filter((p) => p.metrica.fase === lado && !/penalti/i.test(p.metrica.nombre) && p.valor !== 0);
    const porGrupo = new Map<string, Percentil[]>();
    for (const p of suyas) porGrupo.set(p.metrica.grupo, [...(porGrupo.get(p.metrica.grupo) ?? []), p]);
    const elegidas: Percentil[] = [];
    for (let vuelta = 0; elegidas.length < 6 && vuelta < 6; vuelta++) {
      for (const lista of porGrupo.values()) if (lista[vuelta] && elegidas.length < 6) elegidas.push(lista[vuelta]);
    }
    for (const p of elegidas) {
      sale.push({
        nombre: `${p.metrica.nombre.replace(/ %$/, "")}${p.metrica.mejorAlto === false ? " ↓" : ""}`,
        valor: valorEscrito(p),
        percentil: p.percentil,
        lado,
        ayuda: p.metrica.comoLeer,
        clave: p.metrica.columna,
      });
    }
  }
  return sale;
}

export type JugadorElite = FilaJugador & { liga: string };

export function ComparaElite({
  fila,
  puesto,
  nombreCorto,
  elite,
  sugeridos,
  actualizado,
}: {
  fila: FilaJugador;
  puesto: Puesto;
  nombreCorto: string;
  elite: JugadorElite[];
  /** Los que más se le parecen (ids «jugador|equipo»), para empezar con algo. */
  sugeridos: string[];
  actualizado?: string | null;
}) {
  const [elegidos, setElegidos] = useState<string[] | null>(null);
  const [busca, setBusca] = useState("");

  /* La vara: élite de su puesto y edad; si son pocos, todas las edades. */
  const vara = useMemo(() => {
    const delPuesto = elite.filter((j) => puestoDe(j.posicion) === puesto);
    const deSuEdad = delPuesto.filter((j) => j.edad > 0 && Math.abs(j.edad - fila.edad) <= 3);
    return deSuEdad.length >= 12 ? { lista: deSuEdad, deSuEdad: true } : { lista: delPuesto, deSuEdad: false };
  }, [elite, puesto, fila.edad]);

  const ids = (elegidos ?? sugeridos.filter((id) => vara.lista.some((j) => idDe(j) === id))).slice(0, MAX);
  const comparados = ids.map((id) => vara.lista.find((j) => idDe(j) === id)).filter((j): j is JugadorElite => Boolean(j));

  /* Sin memorizar: son unas decenas de jugadores y se recalcula sólo al elegir. */
  const calculo = (() => {
    if (vara.lista.length < 5) return null;
    const mios = percentilesDe(fila, vara.lista, puesto);
    const cunas = cunasDe(mios);
    if (cunas.length < 6) return null;
    const listas = comparados.map((j) => percentilesDe(j, vara.lista, puesto));
    const suyos = listas.map((l) => new Map(l.map((p) => [p.metrica.columna, p])));
    const porClave = new Map(mios.map((p) => [p.metrica.columna, p]));
    /* La nota de perfil de cada uno contra la misma vara: el resumen en una cifra. */
    return { cunas, suyos, porClave, indice: indiceDe(mios), indices: listas.map((l) => indiceDe(l)) };
  })();

  if (!calculo) return null;

  const superpuestos = comparados.map((j, k) => ({
    nombre: j.jugador,
    color: COLORES[k],
    percentiles: calculo.cunas.map((c) => calculo.suyos[k].get(c.clave ?? "")?.percentil ?? null),
  }));

  /* Dónde está la diferencia, con el primero elegido: en todas las métricas de su puesto, no sólo las de la radiografía. */
  const primero = comparados[0];
  const diferencias = primero
    ? [...calculo.porClave.values()]
        .filter((p) => !/penalti/i.test(p.metrica.nombre))
        .map((p) => ({ mio: p, suyo: calculo.suyos[0].get(p.metrica.columna) }))
        .filter((d): d is { mio: Percentil; suyo: Percentil } => Boolean(d.suyo))
        /* La diferencia sólo con base: en porcentajes, 15 intentos o más en los DOS; en por 90′, 15 acciones en alguno (07/11/2026, jueces). */
        .filter((d) =>
          d.mio.metrica.unidad === "porcentaje"
            ? Math.min(accionesDe(fila, d.mio) ?? 0, accionesDe(primero, d.suyo) ?? 0) >= 15
            : Math.max(accionesDe(fila, d.mio) ?? 0, accionesDe(primero, d.suyo) ?? 0) >= 15,
        )
        .map((d) => ({ ...d, brecha: d.suyo.percentil - d.mio.percentil }))
    : [];
  const leSaca = [...diferencias].sort((a, b) => b.brecha - a.brecha).filter((d) => d.brecha >= 15).slice(0, 3);
  const leGana = [...diferencias].sort((a, b) => a.brecha - b.brecha).filter((d) => d.brecha <= -10 && !/acciones defensivas|defensivas realizadas/i.test(d.mio.metrica.nombre)).slice(0, 2); /* tener más o menos acciones defensivas no es mejor por sí solo */

  const candidatos = vara.lista
    .filter((j) => !ids.includes(idDe(j)))
    .filter((j) => !busca.trim() || `${j.jugador} ${j.equipo}`.toLowerCase().includes(busca.trim().toLowerCase()))
    .sort((a, b) => a.jugador.localeCompare(b.jugador, "es"))
    .slice(0, busca.trim() ? 12 : 0);

  const pon = (lista: string[]) => setElegidos(lista.slice(0, MAX));

  return (
    <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-4 text-white sm:p-5">
      <h4 className="text-sm font-bold uppercase tracking-[0.18em]" style={{ color: ROSA }}>
        Cara a cara con la élite{" "}
        <span className="text-[11px] font-semibold normal-case tracking-normal text-white/55">
          · la misma vara para todos: {vara.lista.length} de Primera y Premier de su puesto{vara.deSuEdad ? " y edad (±3 años)" : " (de su edad hay pocos: todas las edades)"}
        </span>
      </h4>
      <p className="text-[12px] text-white/60">
        Su radiografía (cuñas rosas) con hasta {MAX} jugadores encima, cada uno con su color: el arco marca su percentil en esa métrica. Todos medidos contra los mismos {vara.lista.length}, con 450′ o más esta temporada · Wyscout{actualizado ? ` · descarga del ${actualizado.split("-").reverse().join("/")}` : ""}.
      </p>

      {/* Quién sale: los elegidos y el buscador */}
      <div className="mt-3 flex flex-wrap items-center gap-2">
        <span className="inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[12px] font-semibold" style={{ borderColor: `${ROSA}66`, color: ROSA }}>
          ● {nombreCorto}
          {calculo.indice != null && <span className="font-normal text-white/60" title="Nota de perfil: su percentil medio en las métricas del puesto, contra la misma vara">· nota {calculo.indice} frente a la élite · {fila.minutos}′</span>}
        </span>
        {comparados.map((j, k) => (
          <span key={idDe(j)} className="inline-flex items-center gap-1.5 rounded-full border border-white/15 px-2.5 py-1 text-[12px]">
            <span style={{ color: COLORES[k] }}>●</span>
            <span className="font-semibold text-white/90">{j.jugador}</span>
            <span className="text-white/50">· {j.equipo} · {j.liga === "Premier" ? "Premier" : "Primera"} · {j.edad} años · {j.minutos}′</span>
            {calculo.indices[k] != null && <span className="text-white/70" title="Nota de perfil contra la misma vara">· nota {calculo.indices[k]}</span>}
            <button type="button" aria-label={`Quitar a ${j.jugador}`} onClick={() => pon(ids.filter((x) => x !== idDe(j)))} className="ml-0.5 rounded-full p-0.5 text-white/50 hover:bg-white/10 hover:text-white">
              <X size={12} />
            </button>
          </span>
        ))}
        {ids.length < MAX && (
          <div className="relative min-w-[200px] flex-1 sm:max-w-xs">
            <Search size={13} className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-white/40" aria-hidden />
            <input
              value={busca}
              onChange={(e) => setBusca(e.target.value)}
              placeholder="Añadir: nombre o equipo"
              aria-label="Buscar un jugador de la élite para comparar"
              className="w-full rounded-lg border border-white/10 bg-white/[0.04] py-1.5 pl-7 pr-2 text-[12px] text-white placeholder:text-white/35"
            />
            {busca.trim().length >= 3 && candidatos.length === 0 && (
              <p className="absolute left-0 right-0 top-full z-20 mt-1 rounded-lg border border-white/10 bg-[#11161C] px-3 py-2 text-[12px] text-white/70 shadow-xl">
                No está entre los {vara.lista.length} de su puesto{vara.deSuEdad ? " y edad" : ""} con 450′: sólo se compara con los de su mismo puesto, que se miden con las mismas métricas.
              </p>
            )}
            {candidatos.length > 0 && (
              <ul className="absolute left-0 right-0 top-full z-20 mt-1 max-h-64 overflow-auto rounded-lg border border-white/10 bg-[#11161C] py-1 shadow-xl">
                {candidatos.map((j) => (
                  <li key={idDe(j)}>
                    <button
                      type="button"
                      onClick={() => {
                        pon([...ids, idDe(j)]);
                        setBusca("");
                      }}
                      className="flex w-full items-baseline justify-between gap-2 px-3 py-1.5 text-left text-[12px] hover:bg-white/[0.06]"
                    >
                      <span className="min-w-0 truncate text-white/90">{j.jugador} <span className="text-white/45">· {j.equipo}</span></span>
                      <span className="shrink-0 text-white/45">{j.liga === "Premier" ? "Premier" : "Primera"} · {j.edad} años · {j.minutos}′</span>
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>
        )}
        {elegidos !== null && sugeridos.length > 0 && (
          <button type="button" onClick={() => setElegidos(null)} className="text-[12px] text-white/50 underline-offset-2 hover:text-white/80 hover:underline">
            Volver a los que más se le parecen
          </button>
        )}
      </div>

      <p className="mt-2 text-[11px] text-white/50">
        «Nota»: percentil medio en las métricas de su puesto frente a estos {vara.lista.length} de élite. No coincide con la de arriba, que le compara con los de su categoría y su edad.
      </p>

      {/* En escritorio, la radiografía con los superpuestos */}
      <div className="mt-2 hidden sm:block">
        <RadiografiaPercentiles cunas={calculo.cunas} superpuestos={superpuestos} />
      </div>

      {/* En el móvil la pizza no se lee: barras con una marca por jugador */}
      <ul className="mt-3 space-y-2 sm:hidden">
        {calculo.cunas.map((c, i) => (
          <li key={c.nombre} className="text-[13px]">
            <div className="flex items-baseline justify-between gap-2">
              <span className="min-w-0 truncate text-white/80">{c.nombre}</span>
              <span className="shrink-0 tabular-nums">
                <b style={{ color: ROSA }}>{Math.round(c.percentil)}</b>
                {superpuestos.map((s) =>
                  s.percentiles[i] == null ? null : (
                    <span key={s.nombre} className="ml-2 font-semibold" style={{ color: s.color }}>{Math.round(s.percentiles[i]!)}</span>
                  ),
                )}
              </span>
            </div>
            <span className="relative mt-0.5 block h-2 rounded-full bg-white/10">
              <span className="absolute inset-y-0 left-0 rounded-full" style={{ width: `${c.percentil}%`, background: ROSA }} />
              {superpuestos.map((s) =>
                s.percentiles[i] == null ? null : (
                  <span key={s.nombre} className="absolute -top-0.5 h-3 w-1 -translate-x-1/2 rounded-sm" style={{ left: `${s.percentiles[i]}%`, background: s.color }} />
                ),
              )}
            </span>
          </li>
        ))}
      </ul>

      {/* Dónde está la diferencia con el primero elegido */}
      {primero && (leSaca.length > 0 || leGana.length > 0) && (
        <div className="mt-4 grid gap-3 md:grid-cols-2">
          {leSaca.length > 0 && (
            <div className="rounded-xl border border-white/10 bg-black/20 p-3">
              <p className="text-[11px] font-bold uppercase tracking-[0.14em] text-white/55">
                Dónde le saca <span style={{ color: COLORES[0] }}>{primero.jugador}</span>
              </p>
              <ul className="mt-1.5 space-y-1.5">
                {leSaca.map(({ mio, suyo }) => (
                  <li key={mio.metrica.columna} className="text-[13px]" title={mio.metrica.comoLeer}>
                    <div className="flex items-baseline justify-between gap-2">
                      <span className="min-w-0 truncate text-white/85">{nombreMetrica(mio.metrica.nombre)}</span>
                      <span className="shrink-0 tabular-nums text-[12px] text-white/55">p{Math.round(mio.percentil)} → p{Math.round(suyo.percentil)} <span className="text-white/40">(él → {primero.jugador.split(" ").slice(-1)[0]}, frente a {vara.lista.length} de élite)</span></span>
                    </div>
                    <p className="text-[12px] text-white/60">
                      <b style={{ color: ROSA }}>{conBase(fila, mio)}</b> frente a <b style={{ color: COLORES[0] }}>{conBase(primero, suyo)}</b>
                      {mio.metrica.unidad === "porcentaje" ? "" : " · por 90′"}
                      {mio.metrica.mejorAlto === false ? " (menos es mejor)" : ""}
                    </p>
                  </li>
                ))}
              </ul>
            </div>
          )}
          {leGana.length > 0 && (
            <div className="rounded-xl border border-white/10 bg-black/20 p-3">
              <p className="text-[11px] font-bold uppercase tracking-[0.14em] text-white/55">
                Donde <span style={{ color: ROSA }}>{nombreCorto}</span> ya está por delante
              </p>
              <ul className="mt-1.5 space-y-1.5">
                {leGana.map(({ mio, suyo }) => (
                  <li key={mio.metrica.columna} className="text-[13px]" title={mio.metrica.comoLeer}>
                    <div className="flex items-baseline justify-between gap-2">
                      <span className="min-w-0 truncate text-white/85">{nombreMetrica(mio.metrica.nombre)}</span>
                      <span className="shrink-0 tabular-nums text-[12px] text-white/55">p{Math.round(mio.percentil)} frente a p{Math.round(suyo.percentil)} <span className="text-white/40">(frente a {vara.lista.length} de élite)</span></span>
                    </div>
                    <p className="text-[12px] text-white/60">
                      <b style={{ color: ROSA }}>{conBase(fila, mio)}</b> frente a <b style={{ color: COLORES[0] }}>{conBase(primero, suyo)}</b>
                      {mio.metrica.unidad === "porcentaje" ? "" : " · por 90′"}
                      {mio.metrica.mejorAlto === false ? " (menos es mejor)" : ""}
                    </p>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
