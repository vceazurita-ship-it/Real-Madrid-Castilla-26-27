"use client";

/*
| OPTA · FRENTE A SU PUESTO EN PRIMERA RFEF (09/11/2026)
|
| Bloque de «Área de mejora». Lo de Wyscout sigue arriba; esto se suma con su
| fuente escrita: los percentiles del jugador contra todos los de su puesto
| en la categoría (los dos grupos de Primera RFEF) con 270′ o más, en
| `opta:jugadores` (71 métricas). Por 90′ salvo los porcentajes.
|
| Puntos fuertes y a mejorar: uno por grupo de métricas, y sólo lo que tiene
| volumen para juzgarse (la misma regla que con Wyscout: una acción que ni la
| mediana del puesto haría 10 veces en sus minutos no cuenta; un porcentaje
| de menos de 15 intentos tampoco).
|
| Si Opta no le tiene, el bloque no se pinta.
|
| 27/11/2026 (el analista: «en áreas de mejora de algunos jugadores faltan
| datos y entonces no hay comparativas; enriquecerlas con Opta»): el bloque
| trae también su RADIOGRAFÍA de Opta (la misma pizza que la de Wyscout, con
| las métricas juzgables, dos por grupo como mucho) y el MAPA de su puesto
| (dos ejes por puesto, cada uno la media de percentiles de sus grupos, con
| todos los del puesto en la categoría). Con o sin Wyscout: a quien Wyscout no
| tiene (o le tiene con otro nombre) le quedan así sus comparativas.
*/

import { useEffect, useMemo, useState } from "react";
import { ArrowDownRight, ArrowUpRight, BarChart3 } from "lucide-react";

import { RadiografiaPercentiles, type CunaPercentil } from "@/components/data/visual/RadiografiaPercentiles";
import { MapaDosEjes, type PuntoMapa } from "@/components/data/visual/MapaDosEjes";

import { CASTILLA_OPTA, DOCS_OPTA, aObjetos, num, percentil, traeOpta, type TablaOpta } from "@/lib/opta";
import {
  GRUPOS_FICHA,
  NOMBRE_PUESTO,
  casaOpta,
  metricasDelPuesto,
  puestoOpta,
  textoFicha,
  valorFicha,
  type FilaOpta,
  type MetricaFicha,
  type PuestoOpta,
} from "@/lib/opta-ficha";

const MINUTOS_OPTA = 270;
const VOLUMEN_MIN = 10;
const INTENTOS_MIN = 15;

const VERDE = "#1B9E77";
const ORO = "#D8B45A";
const ROJO = "#E5484D";

const colorDe = (p: number) => (p >= 66 ? VERDE : p >= 40 ? ORO : ROJO);

/* Los dos ejes del mapa de cada puesto: grupos de métricas de Opta (media de sus percentiles). */
const EJES_OPTA: Partial<Record<PuestoOpta, { x: string; y: string; gx: string[]; gy: string[]; rotulos: { ambos: string; soloX: string; soloY: string; nada: string; nadaCorto: string } }>> = {
  CEN: { x: "Defender", y: "Sacar el balón", gx: ["Defensa", "Duelos"], gy: ["Circulación"], rotulos: { ambos: "COMPLETOS", soloX: "DEFENSORES", soloY: "CONSTRUCTORES", nada: "POR DEBAJO EN LAS DOS", nadaCorto: "POR DEBAJO" } },
  LAT: { x: "Defender", y: "Aportar arriba", gx: ["Defensa", "Duelos"], gy: ["Centros y regate", "Creación"], rotulos: { ambos: "COMPLETOS", soloX: "DEFENSIVOS", soloY: "OFENSIVOS", nada: "POR DEBAJO EN LAS DOS", nadaCorto: "POR DEBAJO" } },
  MED: { x: "Recuperar", y: "Crear y circular", gx: ["Defensa", "Duelos"], gy: ["Circulación", "Creación"], rotulos: { ambos: "COMPLETOS", soloX: "DESTRUCTORES", soloY: "CREADORES", nada: "POR DEBAJO EN LAS DOS", nadaCorto: "POR DEBAJO" } },
  BAN: { x: "Creación", y: "Gol", gx: ["Creación", "Centros y regate"], gy: ["Gol"], rotulos: { ambos: "COMPLETOS", soloX: "CREADORES", soloY: "FINALIZADORES", nada: "POR DEBAJO EN LAS DOS", nadaCorto: "POR DEBAJO" } },
  DEL: { x: "Juego", y: "Gol", gx: ["Creación", "Circulación", "Duelos"], gy: ["Gol"], rotulos: { ambos: "COMPLETOS", soloX: "ASOCIATIVOS", soloY: "REMATADORES", nada: "POR DEBAJO EN LAS DOS", nadaCorto: "POR DEBAJO" } },
};
/* En la pizza: con balón a la derecha, sin balón a la izquierda. */
const CON_BALON = new Set(["Gol", "Creación", "Circulación", "Centros y regate", "Portería"]);

type Linea = { m: MetricaFicha; valor: number; mediana: number | null; p: number; juzgable: boolean; puesto: number; de: number };

function medianaDe(xs: number[]) {
  if (!xs.length) return null;
  const o = [...xs].sort((a, b) => a - b);
  const k = Math.floor(o.length / 2);
  return o.length % 2 ? o[k] : (o[k - 1] + o[k]) / 2;
}

function Tarjeta({ l, bien }: { l: Linea; bien: boolean }) {
  return (
    <li className="rounded-xl border border-white/10 bg-white/[0.03] p-3">
      <p className="flex items-center gap-1.5 text-[13px] font-semibold text-white/90">
        {bien ? <ArrowUpRight size={14} style={{ color: VERDE }} /> : <ArrowDownRight size={14} style={{ color: ROJO }} />}
        {l.m.nombre}
      </p>
      <p className="mt-1 text-[12px] text-white/60">
        <b className="tabular-nums" style={{ color: colorDe(l.p) }}>p{l.p}</b> · {l.puesto}º de {l.de} · {textoFicha(l.m, l.valor)}
        {l.m.modo !== "pct" ? " por 90′" : ""}
        {l.mediana != null ? ` (mediana del puesto, ${textoFicha(l.m, l.mediana)})` : ""}
      </p>
    </li>
  );
}

export function OptaPuesto({ nombre, apodo }: { nombre: string; apodo?: string }) {
  const [tabla, setTabla] = useState<TablaOpta | null>(null);
  const [todas, setTodas] = useState(false);

  useEffect(() => {
    let vivo = true;
    void traeOpta(DOCS_OPTA.jugadores).then((t) => {
      if (vivo && t?.filas?.length) setTabla(t);
    });
    return () => {
      vivo = false;
    };
  }, []);

  const analisis = useMemo(() => {
    const filas = aObjetos(tabla) as FilaOpta[];
    if (!filas.length) return null;

    const nuestros = filas.filter((f) => f.teamId === CASTILLA_OPTA);
    const yo = casaOpta(nombre, apodo, nuestros);
    if (!yo) return null;

    const puesto = puestoOpta(yo.puesto);
    const minutos = num(yo.Min) ?? 0;
    if (!puesto) return null;
    if (minutos < MINUTOS_OPTA) return { corto: true as const, minutos, jugador: String(yo.jugador ?? "") };

    const pares = filas.filter((f) => (num(f.Min) ?? 0) >= MINUTOS_OPTA && puestoOpta(f.puesto) === puesto);

    const lineas: Linea[] = [];
    for (const m of metricasDelPuesto(puesto)) {
      const valor = valorFicha(m, yo);
      if (valor == null) continue;
      const muestra = pares.map((f) => valorFicha(m, f)).filter((v): v is number => v != null);
      if (muestra.length < 10) continue;
      const p = percentil(valor, muestra, !m.mejorAlto);
      if (p == null) continue;
      const mediana = medianaDe(muestra);

      /* ¿Se puede juzgar? Volumen en sus minutos. */
      let juzgable = true;
      if (m.modo === "p90") juzgable = (Math.max(mediana ?? 0, valor) * minutos) / 90 >= VOLUMEN_MIN;
      if (m.modo === "pct" && m.base) juzgable = (num(yo[m.base]) ?? 0) >= INTENTOS_MIN;
      else if (m.modo === "pct" && m.intentos) juzgable = (m.intentos(yo) ?? 0) >= INTENTOS_MIN;

      const mejores = muestra.filter((v) => (m.mejorAlto ? v > valor : v < valor)).length;
      lineas.push({ m, valor, mediana, p, juzgable, puesto: mejores + 1, de: muestra.length });
    }

    const juzgables = lineas.filter((l) => l.juzgable).sort((a, b) => b.p - a.p);

    /* La radiografía: las juzgables, dos por grupo como mucho, en el orden de los grupos. */
    const cunas: CunaPercentil[] = [];
    for (const g of GRUPOS_FICHA) {
      const delGrupo = lineas.filter((l) => l.juzgable && l.m.grupo === g).slice(0, 2);
      for (const l of delGrupo) cunas.push({ nombre: l.m.nombre + (l.m.mejorAlto ? "" : " ↓"), valor: textoFicha(l.m, l.valor), percentil: l.p, lado: CON_BALON.has(g) ? "con" : "sin", ayuda: `${l.puesto}º de ${l.de}` });
    }

    /* El mapa de su puesto: cada uno, la media de sus percentiles por grupo (contra los mismos pares) en cada eje. */
    const ejes = EJES_OPTA[puesto];
    let mapa: { puntos: PuntoMapa[]; ejes: NonNullable<typeof ejes> } | null = null;
    if (ejes && pares.length >= 10) {
      const metricas = metricasDelPuesto(puesto).filter((m) => ejes.gx.includes(m.grupo) || ejes.gy.includes(m.grupo));
      const muestras = new Map(metricas.map((m) => [m.a, pares.map((f) => valorFicha(m, f)).filter((v): v is number => v != null)]));
      const ejeDe = (f: FilaOpta, gs: string[]) => {
        const ps: number[] = [];
        for (const m of metricas) {
          if (!gs.includes(m.grupo)) continue;
          const v = valorFicha(m, f);
          const mu = muestras.get(m.a) ?? [];
          if (v == null || mu.length < 10) continue;
          const p = percentil(v, mu, !m.mejorAlto);
          if (p != null) ps.push(p);
        }
        return ps.length ? ps.reduce((a, b) => a + b, 0) / ps.length : null;
      };
      const conEl = pares.includes(yo) ? pares : [...pares, yo];
      const crudos = conEl
        .map((f) => ({ f, x: ejeDe(f, ejes.gx), y: ejeDe(f, ejes.gy) }))
        .filter((c): c is { f: FilaOpta; x: number; y: number } => c.x != null && c.y != null);
      /* Re-escalado a percentil dentro del mapa (como el de Wyscout). */
      const rango = (xs: number[]) => (v: number) => (xs.filter((o) => o < v).length / Math.max(1, xs.length - 1)) * 100;
      const rx = rango(crudos.map((c) => c.x)), ry = rango(crudos.map((c) => c.y));
      mapa = {
        ejes,
        puntos: crudos.map((c) => ({
          id: String(c.f.playerId ?? c.f.jugador),
          nombre: String(c.f.jugador ?? ""),
          x: rx(c.x),
          y: ry(c.y),
          propio: c.f === yo || c.f.teamId === CASTILLA_OPTA,
          detalle: `${String(c.f.equipo ?? "")} · ${num(c.f.Age) ?? "?"} años · ${num(c.f.Min) ?? 0}′`,
        })),
      };
    }
    const unoPorGrupo = (xs: Linea[]) => xs.filter((l, i) => xs.findIndex((o) => o.m.grupo === l.m.grupo) === i);

    return {
      corto: false as const,
      jugador: String(yo.jugador ?? ""),
      puesto,
      minutos,
      n: pares.length,
      lineas,
      cunas,
      mapa,
      fuertes: unoPorGrupo(juzgables).filter((l) => l.p >= 60).slice(0, 3),
      mejora: unoPorGrupo([...juzgables].reverse()).filter((l) => l.p < 40).slice(0, 3),
      indice: Math.round(juzgables.reduce((s, l) => s + l.p, 0) / Math.max(1, juzgables.length)),
    };
  }, [tabla, nombre, apodo]);

  if (!analisis) return null;

  if (analisis.corto) {
    return (
      <p className="rounded-xl border border-white/10 bg-white/[0.03] px-3 py-2 text-[12px] text-white/60">
        <b className="text-white/80">Opta · Primera RFEF:</b> lleva {analisis.minutos}′; se compara con su puesto en cuanto sume {MINUTOS_OPTA}′.
      </p>
    );
  }

  const pz = NOMBRE_PUESTO[analisis.puesto];
  const grupos = GRUPOS_FICHA.map((g) => ({ g, ls: analisis.lineas.filter((l) => l.m.grupo === g && (todas || l.juzgable)) })).filter((x) => x.ls.length);


  return (
    <section className="rounded-2xl border border-white/10 bg-white/[0.03] p-4">
      <h4 className="flex items-center gap-2 text-sm font-bold uppercase tracking-[0.14em] text-[#D8B45A]">
        <BarChart3 size={15} /> Opta · frente a su puesto en Primera RFEF
      </h4>
      <p className="mb-3 mt-1 text-[12px] text-white/55">
        Fuente: Opta. {pz.uno} ({analisis.jugador}, {analisis.minutos}′) frente a los {analisis.n} {pz.varios} de los dos grupos con {MINUTOS_OPTA}′ o más; por 90′ salvo los porcentajes.{" "}
        <b className="text-white/75">p80</b> = mejor que el 80 % de ellos. Percentil medio: <b className="tabular-nums text-white/85">{analisis.indice}</b>.
      </p>

      {(analisis.fuertes.length > 0 || analisis.mejora.length > 0) && (
        <div className="mb-4 grid gap-3 md:grid-cols-2">
          {analisis.fuertes.length > 0 && (
            <div>
              <p className="mb-1.5 text-[11px] font-semibold uppercase tracking-[0.14em]" style={{ color: VERDE }}>Puntos fuertes</p>
              <ul className="space-y-2">{analisis.fuertes.map((l) => <Tarjeta key={l.m.a} l={l} bien />)}</ul>
            </div>
          )}
          {analisis.mejora.length > 0 && (
            <div>
              <p className="mb-1.5 text-[11px] font-semibold uppercase tracking-[0.14em]" style={{ color: ROJO }}>A mejorar</p>
              <ul className="space-y-2">{analisis.mejora.map((l) => <Tarjeta key={l.m.a} l={l} bien={false} />)}</ul>
            </div>
          )}
        </div>
      )}

      {analisis.cunas.length >= 6 && (
        <div className="mb-4">
          <p className="mb-1 text-[11px] font-semibold uppercase tracking-[0.14em] text-white/50">Su radiografía en Opta · percentil frente a los {analisis.n} {pz.varios}</p>
          <RadiografiaPercentiles cunas={analisis.cunas} acento={ORO} />
        </div>
      )}

      {analisis.mapa && (
        <div className="mb-4">
          <p className="mb-1 text-[11px] font-semibold uppercase tracking-[0.14em] text-white/50">
            {analisis.mapa.ejes.x} frente a {analisis.mapa.ejes.y.toLowerCase()} · los {analisis.mapa.puntos.length} {pz.varios} de la categoría en Opta
          </p>
          <MapaDosEjes puntos={analisis.mapa.puntos} ejeX={`${analisis.mapa.ejes.x.toUpperCase()} · PERCENTIL`} ejeY={`${analisis.mapa.ejes.y.toUpperCase()} · PERCENTIL`} rotulos={analisis.mapa.ejes.rotulos} />
          <p className="mt-1 text-[11px] text-white/45">
            Cada eje es la media de sus percentiles en {analisis.mapa.ejes.gx.join(", ").toLowerCase()} (horizontal) y {analisis.mapa.ejes.gy.join(", ").toLowerCase()} (vertical), re-escalada dentro del mapa. En dorado, los del Castilla.
          </p>
        </div>
      )}

      <div className="grid gap-x-6 gap-y-4 md:grid-cols-2">
        {grupos.map(({ g, ls }) => (
          <div key={g} className="min-w-0">
            <p className="mb-1 text-[11px] font-semibold uppercase tracking-[0.14em] text-white/50">{g}</p>
            <ul className="space-y-1.5">
              {ls.map((l) => (
                <li key={l.m.a} className="text-[12px]" title={`${l.puesto}º de ${l.de}${l.mediana != null ? ` · mediana ${textoFicha(l.m, l.mediana)}` : ""}${l.juzgable ? "" : " · poco volumen: tendencia"}`}>
                  <div className="mb-0.5 flex items-baseline justify-between gap-2">
                    <span className="min-w-0 truncate text-white/80">
                      {l.m.nombre}
                      {!l.m.mejorAlto && <span className="ml-1 text-[10px] text-white/40">(menos es mejor)</span>}
                      {!l.juzgable && <span className="ml-1 text-[10px] text-white/40">(poco volumen)</span>}
                    </span>
                    <span className="shrink-0 tabular-nums text-white/60">
                      {textoFicha(l.m, l.valor)} · <b style={{ color: l.juzgable ? colorDe(l.p) : undefined }}>p{l.p}</b>
                    </span>
                  </div>
                  <span className="relative block h-2 rounded-full bg-white/10">
                    <span className="absolute inset-y-0 left-1/2 w-px bg-white/40" />
                    <span className="absolute inset-y-0 left-0 rounded-full" style={{ width: `${l.p}%`, background: l.juzgable ? colorDe(l.p) : "rgb(var(--rmcf-ink-rgb) / 0.3)" }} />
                  </span>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>

      {analisis.lineas.some((l) => !l.juzgable) && (
        <button type="button" onClick={() => setTodas(!todas)} className="mt-3 text-[12px] font-semibold text-[#D8B45A] underline underline-offset-2">
          {todas ? "Sólo las métricas con volumen" : `Ver también las ${analisis.lineas.filter((l) => !l.juzgable).length} de poco volumen`}
        </button>
      )}
    </section>
  );
}
