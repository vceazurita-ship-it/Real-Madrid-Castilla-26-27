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
import { GRUPOS_JUGADOR, MINUTOS_MINIMOS, PUESTOS, puestoDe, volumenDelPorcentaje } from "@/lib/data-analisis/individual";

/** Los minutos con los que se compara en toda la pestaña. */
const MINUTOS_COMPARA = 450;

/*
| QUÉ ENTRENAMOS (05/11/2026): cada área de mejora acaba en un objetivo de
| campo con su criterio de éxito (la mediana de su edad). Por grupo de
| métricas; el cuerpo técnico lo concreta en la tarea.
*/
const ENTRENAR: { patron: RegExp; tarea: string; medir: string }[] = [
  { patron: /centro/i, tarea: "Centro tras ganar línea de fondo con dos rematadores atacando primer y segundo palo", medir: "centros que llegan a un compañero dentro del área" },
  { patron: /conduc|progresi/i, tarea: "Rondo de progresión 4c4+3: fijar y conducir hasta 10 m cuando haya espacio a la espalda del medio", medir: "conducciones que superan una línea" },
  { patron: /regate/i, tarea: "1c1 en banda con apoyo: encarar, amagar y salir por fuera o por dentro", medir: "regates completados" },
  { patron: /aére|cabez/i, tarea: "Duelos aéreos en centros laterales: tiempo de salto y orientación del cuerpo", medir: "duelos aéreos ganados" },
  { patron: /duelo/i, tarea: "Duelos 1c1 en carril con portería pequeña: proteger con el cuerpo y salir hacia dentro", medir: "duelos ganados" },
  { patron: /remate|tiro|goles|xg/i, tarea: "Finalización tras pase atrás y tras conducción, con portero: atacar el espacio entre central y lateral", medir: "remates a puerta" },
  { patron: /área|último tercio|profundidad|asist|xa\b|clave|desmarque/i, tarea: "Último pase en superioridad (3c2 en el último tercio): elegir entre pase atrás, pase al hueco o pared", medir: "pases que dejan a un compañero rematando" },
  { patron: /pase|circula/i, tarea: "Juego de posición 5c5+3 a dos toques: perfil abierto antes de recibir y pase al pie del compañero libre", medir: "pases al pie con perfil abierto" },
  { patron: /falta|tarjeta|amarilla/i, tarea: "Defensa sin falta: temporizar, orientar hacia fuera y no entrar al balón dividido por detrás", medir: "faltas cometidas" },
  { patron: /presi|pérdida|transici|recupera.*alt/i, tarea: "Transición tras pérdida 4c4: presión en 5 segundos sobre el poseedor, cerrando su pase hacia delante", medir: "recuperaciones en los 5 segundos siguientes a perder" },
  { patron: /intercep|recupera|entrada|defens|despej|bloque/i, tarea: "Defensa del lado débil en 6c6: cerrar la línea de pase interior y anticipar al que recibe de espaldas", medir: "anticipaciones e interceptaciones" },
];
/** La tarea que mide lo mismo que falta. */
const tareaDe = (nombre: string) => ENTRENAR.find((e) => e.patron.test(nombre)) ?? null;
import { indiceDe, percentilesDe, type Percentil } from "@/lib/comparativa-u21";
import type { RatingsSeason } from "@/lib/ratings/types";
import { RadiografiaPercentiles } from "@/components/data/visual/RadiografiaPercentiles";
import { ComparaElite, cunasDe, type JugadorElite } from "@/components/individual/ComparaElite";
import { MapaDosEjes, type PuntoMapa } from "@/components/data/visual/MapaDosEjes";
import { MarcoGrafico, usePesos, useTipoGrafico } from "@/components/data/visual/MarcoGrafico";
import type { Puesto } from "@/lib/data-analisis/individual";

const ORO = "#D8B45A";
const AZUL = "#4F8FE8";
const ROJO = "#E5484D";
const VERDE = "#1B9E77";
/* Primera y Premier: colores que no se confunden con bueno (verde) y malo (rojo). */
const COLOR_LIGA = ["#A78BFA", "#22D3EE"];

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

/*
| Los dos ejes del mapa de cada puesto (05/11/2026): lo que un entrenador
| pregunta de él, cada eje una media de percentiles de grupos de métricas.
*/
const EJES: Record<Puesto, { x: string; y: string; gx: string[]; gy: string[]; rotulos: { ambos: string; soloX: string; soloY: string; nada: string } } | null> = {
  POR: null,
  CEN: { x: "Salida de balón", y: "Defensa", gx: ["Progresión", "Circulación"], gy: ["Defensa", "Duelos"], rotulos: { ambos: "Completos", soloX: "Constructores", soloY: "Defensivos", nada: "Por debajo en las dos" } },
  LAT: { x: "Ataque", y: "Defensa", gx: ["Creación", "Progresión", "Ocupación del área"], gy: ["Defensa", "Duelos"], rotulos: { ambos: "Completos", soloX: "Carrileros", soloY: "Defensivos", nada: "Por debajo en las dos" } },
  MED: { x: "Construcción", y: "Recuperación", gx: ["Circulación", "Progresión", "Creación"], gy: ["Defensa", "Duelos", "Presión y transición"], rotulos: { ambos: "Box to box", soloX: "Organizadores", soloY: "Destructores", nada: "Por debajo en las dos" } },
  BAN: { x: "Creación", y: "Gol", gx: ["Creación", "Progresión"], gy: ["Valor gol", "Ocupación del área"], rotulos: { ambos: "Completos", soloX: "Creadores", soloY: "Finalizadores", nada: "Por debajo en las dos" } },
  DEL: { x: "Gol", y: "Juego asociado", gx: ["Valor gol", "Ocupación del área"], gy: ["Creación", "Circulación", "Duelos"], rotulos: { ambos: "Completos", soloX: "Rematadores", soloY: "Asociativos", nada: "Por debajo en las dos" } },
};

/** Percentil de cada valor dentro de la lista (0 el peor, 100 el mejor). */
function aRango(vals: number[]) {
  const orden = [...vals].sort((a, b) => a - b);
  return vals.map((v) => (vals.length < 2 ? 50 : (100 * orden.indexOf(v)) / (vals.length - 1)));
}

const media = (xs: number[]) => (xs.length ? xs.reduce((s, x) => s + x, 0) / xs.length : 0);
const coma = (n: number, d = 1) => n.toFixed(d).replace(".", ",");

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
      {[4, 5.5, 7, 8.5, 10].map((v) => (
        <g key={v}>
          <line x1={20} x2={an - 10} y1={y(v)} y2={y(v)} stroke="currentColor" strokeOpacity={0.1} />
          <text x={2} y={y(v)} fontSize="10" dominantBaseline="middle" fill="currentColor" fillOpacity={0.55}>{String(v).replace(".", ",")}</text>
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
  const [sinDatos, setSinDatos] = useState(false);
  /* Gráficos pinchables (06/11/2026): tipo de visualización y ponderación, recordados en el aparato. */
  const [tipoRadiografia, setTipoRadiografia] = useTipoGrafico("radiografia", "pizza", ["pizza", "barras"] as const);
  const [tipoMapa, setTipoMapa] = useTipoGrafico("mapa-mejora", "mapa", ["mapa", "ranking"] as const);
  const [pesosMapa, setPesosMapa] = usePesos("mapa-mejora");
  /* La carga en frío (07/11/2026, jueces): un recuadro mudo parecía un hueco; a los 20 s se dice que tarda. */
  const [tarda, setTarda] = useState(false);
  const [vuelta, setVuelta] = useState(0);

  useEffect(() => {
    const reloj = setTimeout(() => setTarda(true), 20_000);
    return () => clearTimeout(reloj);
  }, [vuelta]);

  useEffect(() => {
    let vivo = true;
    /* En frío la primera respuesta puede llegar sin jugadores (05/11/2026): se
       decía «no está en Wyscout» de alguien que sí está. Se reintenta y, si
       no llegan, se dice que no han llegado. */
    const pide = async () => {
      for (let intento = 0; intento < 3 && vivo; intento++) {
        try {
          const r = await traeJson<{ jugadores?: FilaJugador[] }>("/api/data-analisis", { forzar: intento > 0 });
          if (r?.jugadores?.length) return r.jugadores;
        } catch {
          /* se reintenta */
        }
        await new Promise((ok) => setTimeout(ok, 2500 * (intento + 1)));
      }
      return null;
    };
    void pide().then((lista) => {
      if (!vivo) return;
      setJugadores(lista ?? []);
      setSinDatos(!lista);
    });
    fetch("/api/data-elite")
      .then((r) => (r.ok ? r.json() : null))
      .then((e: Elite | null) => vivo && e?.ligas?.length && setElite(e))
      .catch(() => {});
    return () => {
      vivo = false;
    };
  }, [vuelta]);

  const analisis = useMemo(() => {
    if (!jugadores?.length) return null;

    const actuales = jugadores.filter((j) => j.temporada === "actual");
    const fila = casaNombre(nombre, actuales, (j) => j.jugador) ?? (apodo ? casaNombre(apodo, actuales, (j) => j.jugador) : null);

    if (!fila) return null;

    const puesto = puestoDe(fila.posicion);
    /* Una sola población (05/11/2026): 450′ en todo, como el mapa y la élite. Antes convivían 90′ y 450′ y el mismo jugador salía 78 en un sitio y 88 en otro. */
    const conMinutos = actuales.filter((j) => j.minutos >= MINUTOS_COMPARA && puestoDe(j.posicion) === puesto);
    const delPuesto = conMinutos.length >= 15 ? conMinutos : actuales.filter((j) => j.minutos >= MINUTOS_MINIMOS && puestoDe(j.posicion) === puesto);
    const minimo = conMinutos.length >= 15 ? MINUTOS_COMPARA : MINUTOS_MINIMOS;
    const deSuEdad = delPuesto.filter((j) => j.edad > 0 && Math.abs(j.edad - fila.edad) <= 3);

    const contraTodos = percentilesDe(fila, delPuesto, puesto);
    const contraEdad = percentilesDe(fila, deSuEdad, puesto);

    const grupos = GRUPOS_JUGADOR.map((g) => ({
      grupo: g,
      todos: contraTodos.filter((p) => p.metrica.grupo === g).map((p) => p.percentil),
      edad: contraEdad.filter((p) => p.metrica.grupo === g).map((p) => p.percentil),
    })).filter((g) => g.todos.length);

    /* De cuántas acciones sale cada porcentaje (05/11/2026): «88,9 %» de 9 centros no es una fortaleza. */
    const baseDe = (p: Percentil) => {
      if (p.metrica.unidad !== "porcentaje") {
        /* Por 90′ → total de la temporada: «≈ 8 en 646′». */
        return { total: Math.round((p.valor * fila.minutos) / 90), aciertos: null as number | null };
      }
      const v = volumenDelPorcentaje(fila, p.metrica.columna);
      if (v.cuantas === null) return null;
      const total = Math.round((v.cuantas * fila.minutos) / 90);
      return { total, aciertos: Math.round((p.valor / 100) * total) as number | null };
    };
    /* Uno por grupo (05/11/2026): tres «acierto de pase» seguidos decían lo mismo. */
    const unoPorGrupo = (lista: Percentil[]) => lista.filter((p, i) => lista.findIndex((q) => q.metrica.grupo === p.metrica.grupo) === i);
    /* Puesto entre los de su edad: «16º de 17». */
    const puestoEnEdad = (p: Percentil) => Math.max(1, Math.round((1 - p.percentil / 100) * (deSuEdad.length - 1)) + 1);
    const ordenados = [...contraEdad]
      .filter((p) => !/penalti/i.test(p.metrica.nombre))
      /* Una acción que ni la mediana de su edad haría 10 veces en sus minutos es demasiado rara para juzgarla (07/11/2026, jueces). */
      .filter((p) => {
        if (p.metrica.unidad === "porcentaje") return true;
        const vals = deSuEdad.map((j) => j.datos[p.metrica.columna]).filter((v): v is number => typeof v === "number").sort((a, b) => a - b);
        const med = vals.length ? vals[Math.floor(vals.length / 2)] : 0;
        return Math.max(med, p.valor) * fila.minutos / 90 >= 10;
      })
      .filter((p) => p.metrica.unidad !== "porcentaje" || (baseDe(p)?.total ?? 0) >= 15)
      .sort((a, b) => b.percentil - a.percentil);

    const mediana = (p: Percentil) => {
      const vals = deSuEdad.map((j) => j.datos[p.metrica.columna]).filter((v): v is number => typeof v === "number").sort((a, b) => a - b);
      return vals.length ? vals[Math.floor(vals.length / 2)] : null;
    };

    /* El mapa: todos los de su puesto con 450′, cada eje re-escalado a percentil. */
    const ejes = EJES[puesto];
    let mapa: { puntos: PuntoMapa[]; ejes: NonNullable<typeof ejes>; n: number } | null = null;
    if (ejes) {
      const base = delPuesto;
      const conEl = base.some((j) => j === fila) ? base : [...base, fila];
      const crudos = conEl.map((j) => {
        const ps = percentilesDe(j, base, puesto);
        /* Media de cada grupo y, entre grupos, con el peso elegido (1 por defecto). */
        const m = (gs: string[]) => {
          let suma = 0;
          let pesoTotal = 0;
          for (const g of gs) {
            const vals = ps.filter((p) => p.metrica.grupo === g).map((p) => p.percentil);
            const w = pesosMapa[g] ?? 1;
            if (!vals.length || w <= 0) continue;
            suma += media(vals) * w;
            pesoTotal += w;
          }
          return pesoTotal ? suma / pesoTotal : 0;
        };
        return { j, x: m(ejes.gx), y: m(ejes.gy) };
      });
      const rx = aRango(crudos.map((c) => c.x));
      const ry = aRango(crudos.map((c) => c.y));
      mapa = {
        ejes,
        n: base.length,
        puntos: crudos.map((c, i) => ({
          id: `${c.j.jugador}|${c.j.equipo}`,
          nombre: c.j.jugador,
          x: rx[i],
          y: ry[i],
          propio: c.j === fila,
          detalle: `${c.j.equipo} · ${c.j.edad} años · ${c.j.minutos}′`,
        })),
      };
    }

    return {
      mapa,
      cunas: cunasDe(contraTodos),
      fila,
      puesto,
      nPuesto: delPuesto.length,
      nEdad: deSuEdad.length,
      indiceTodos: indiceDe(contraTodos),
      indiceEdad: indiceDe(contraEdad),
      grupos,
      minimo,
      fuertes: unoPorGrupo(ordenados).slice(0, 3).map((p) => ({ p, mediana: mediana(p), base: baseDe(p), puesto: puestoEnEdad(p) })),
      mejora: unoPorGrupo([...ordenados].reverse()).slice(0, 3).map((p) => ({ p, mediana: mediana(p), base: baseDe(p), puesto: puestoEnEdad(p) })),
      contraEdad,
    };
  }, [jugadores, nombre, apodo, pesosMapa]);

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

  const eliteJugadores = useMemo<JugadorElite[]>(() => (elite ? elite.ligas.flatMap((l) => l.jugadores.map((j) => ({ ...j, liga: l.liga }))) : []), [elite]);

  if (jugadores === null) {
    return (
      <div className="space-y-3" role="status" aria-live="polite">
        <p className="rounded-xl border border-white/10 bg-white/[0.03] px-3 py-2 text-[13px] text-white/70">
          {tarda ? "Tarda más de lo normal: el servidor está leyendo los datos de Wyscout en frío. " : "Leyendo los datos de Wyscout de la categoría…"}
          {tarda && (
            <button
              type="button"
              onClick={() => {
                setTarda(false);
                setVuelta((v) => v + 1);
              }}
              className="ml-1 font-semibold text-[#D8B45A] underline underline-offset-2"
            >
              Volver a intentar
            </button>
          )}
        </p>
        <div className="grid gap-3 sm:grid-cols-2">
          <div className="h-24 animate-pulse rounded-2xl bg-white/[0.07]" />
          <div className="h-24 animate-pulse rounded-2xl bg-white/[0.07]" />
        </div>
        <div className="mx-auto aspect-square w-full max-w-md animate-pulse rounded-full bg-white/[0.07]" />
      </div>
    );
  }

  const etiquetaPuesto = analisis ? PUESTOS.find((p) => p.key === analisis.puesto)?.label ?? analisis.puesto : "";

  return (
    <div className="space-y-5 pb-10">
      <style>{`.am-capa{transform-origin:center;animation:am-entra .7s cubic-bezier(.2,.8,.2,1) both}@keyframes am-entra{from{opacity:0;transform:scale(.6)}to{opacity:1;transform:scale(1)}}`}</style>

      {analisis ? (
        <>
          {/* Con qué se compara: una sola línea fija para toda la pestaña */}
          <p className="rounded-xl border border-white/10 bg-white/[0.03] px-3 py-2 text-[12px] text-white/65">
            <b className="text-white/85">Cómo leerlo:</b> {etiquetaPuesto} con {analisis.minimo}′ o más esta temporada, valores por 90′ (Wyscout). <b className="text-white/85">p98</b> = mejor que el 98 % de con quien se compara; cada bloque dice con quién.
          </p>

          {/* En tres líneas, lo que importa (05/11/2026): estaba al final, tras tres pantallas. */}
          {analisis.fuertes[0] && analisis.mejora[0] && (
            <div className="rounded-2xl border border-[#D8B45A]/30 bg-[#D8B45A]/[0.06] p-4 text-[13px] leading-relaxed text-white/85">
              <p><b style={{ color: VERDE }}>Destaca en {analisis.fuertes[0].p.metrica.nombre.replace(/ %$/, "").toLowerCase()}:</b> es el {analisis.fuertes[0].puesto}º de los {analisis.nEdad} de su edad (p{Math.round(analisis.fuertes[0].p.percentil)}).</p>
              <p><b style={{ color: ROJO }}>Le falta {analisis.mejora[0].p.metrica.nombre.replace(/ %$/, "").toLowerCase()}:</b> es el {analisis.mejora[0].puesto}º de {analisis.nEdad} (p{Math.round(analisis.mejora[0].p.percentil)}).</p>
              {tareaDe(analisis.mejora[0].p.metrica.nombre) && <p><b className="text-white">Esta semana entrenamos:</b> {tareaDe(analisis.mejora[0].p.metrica.nombre)!.tarea.split(":")[0]}.</p>}
            </div>
          )}

          <div className="grid gap-2 sm:grid-cols-2 sm:gap-3">
            <div className="rounded-2xl border border-white/10 bg-gradient-to-br from-white/[0.06] to-transparent p-3 sm:p-4">
              <p className="text-[12px] text-white/60">Nota de perfil · percentil medio en las métricas de su puesto</p>
              <p className="mt-1 text-3xl font-black tabular-nums" style={{ color: (analisis.indiceEdad ?? 0) >= 66 ? VERDE : (analisis.indiceEdad ?? 0) >= 40 ? ORO : ROJO }}>
                {analisis.indiceEdad}{" "}
                <span className="text-sm font-semibold text-white/50">/ 100 frente a los {analisis.nEdad} de su edad</span>
              </p>
              <p className="text-[12px] text-white/55">
                {analisis.indiceTodos === analisis.indiceEdad ? "La misma frente a toda la categoría" : `${analisis.indiceTodos} frente a toda la categoría`} · {analisis.fila.minutos}′ en {analisis.fila.partidos} partidos
                {analisis.fila.minutos >= 450 ? " · base sólida" : " · muestra corta: orientativa"}
              </p>
            </div>
            {notas.length > 0 && (
              <div className="rounded-2xl border border-white/10 bg-gradient-to-br from-white/[0.06] to-transparent p-3 sm:p-4">
                <p className="flex items-center gap-1.5 text-[12px] text-white/60"><TrendingUp size={13} /> Nota del cuerpo técnico en Valoraciones (0-10, por partido)</p>
                <p className="mt-1 text-3xl font-black tabular-nums text-white">
                  {coma(media(notas.map((n) => n.nota)))}{" "}
                  <span className="text-sm font-semibold text-white/50">de media en {notas.length} partidos</span>
                </p>
                {tendencia !== null && (
                  <p className="flex items-center gap-1 text-[12px]" style={{ color: Math.abs(tendencia) < 0.2 ? undefined : tendencia > 0 ? VERDE : ROJO }}>
                    {Math.abs(tendencia) >= 0.2 && (tendencia > 0 ? <ArrowUpRight size={13} /> : <ArrowDownRight size={13} />)}
                    {coma(media(notas.slice(-3).map((n) => n.nota)))} en los 3 últimos ({tendencia >= 0 ? "+" : "−"}{coma(Math.abs(tendencia))} sobre los anteriores)
                  </p>
                )}
              </div>
            )}
          </div>

          {/* Lo que le distingue y lo que tiene que mejorar: arriba, antes de los gráficos (07/11/2026, jueces: el plan de trabajo llegaba tras dos pantallas). */}
          <div className="grid gap-3 md:grid-cols-2">
            {[
              { t: "Lo que le distingue", icono: Sparkles, color: VERDE, lista: analisis.fuertes, entrenar: false },
              { t: "Área de mejora", icono: Crosshair, color: ROJO, lista: analisis.mejora, entrenar: true },
            ].map((b) => (
              <div key={b.t} className="rounded-2xl border border-white/10 bg-white/[0.03] p-4">
                <h4 className="mb-2 flex items-center gap-2 text-sm font-bold" style={{ color: b.color }}>
                  <b.icono size={15} /> {b.t}
                </h4>
                <ul className="space-y-2">
                  {b.lista.map(({ p, mediana, base, puesto }) => (
                    <li key={p.metrica.columna} className="text-[13px]" title={p.metrica.comoLeer}>
                      <div className="flex items-baseline justify-between gap-2">
                        <span className="min-w-0 truncate text-white/85">{p.metrica.nombre}</span>
                        <span className="shrink-0 tabular-nums font-semibold" style={{ color: b.color }}>p{Math.round(p.percentil)} <span className="text-[11px] font-normal text-white/50">· {puesto}º de {analisis.nEdad}</span></span>
                      </div>
                      <p className="text-[12px] text-white/55">
                        {p.metrica.unidad === "porcentaje"
                          ? `${coma(p.valor, 1)} %${base?.aciertos !== null && base ? ` (≈ ${base.aciertos} de ${base.total}${base.total < 20 ? ", pocas: tendencia" : ""})` : ""}`
                          : base && base.total === 0
                            ? `0 por 90′ (ninguno en ${analisis.fila.minutos}′)`
                            : `${coma(p.valor, Math.abs(p.valor) >= 10 ? 1 : 2)} por 90′${base ? ` (≈ ${base.total} en ${analisis.fila.minutos}′${base.total < 20 ? ", pocas: tendencia" : ""})` : ""}`}
                        {mediana !== null ? ` · mediana de su edad: ${p.metrica.unidad === "porcentaje" ? `${coma(mediana, 1)} %` : coma(mediana, Math.abs(mediana) >= 10 ? 1 : 2)}` : ""}
                      </p>
                      {b.entrenar && tareaDe(p.metrica.nombre) && (
                        <p className="mt-1 rounded-lg border border-white/10 bg-white/[0.03] px-2 py-1.5 text-[12px] text-white/75">
                          <b className="text-white/90">Qué entrenamos:</b> {tareaDe(p.metrica.nombre)!.tarea}.
                          <span className="mt-1 block text-white/70"><b className="text-white/85">Qué medir en la tarea:</b> {tareaDe(p.metrica.nombre)!.medir}, para ver si se acerca al objetivo de partido.</span>
                          {mediana !== null && <span className="block text-white/60"><b className="text-white/75">Objetivo de partido:</b> acercarse a {p.metrica.unidad === "porcentaje" ? `${coma(mediana, 1)} %` : `${coma(mediana, Math.abs(mediana) >= 10 ? 1 : 2)} por 90′`}{p.metrica.mejorAlto === false ? " o menos" : ""}, la mediana de los {analisis.nEdad} de su edad (Wyscout).</span>}
                        </p>
                      )}
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>

          {/* Radiografía de percentiles: cada métrica, su valor por 90 y su percentil */}
          {analisis.cunas.length >= 6 && (
            <div className="overflow-hidden rounded-2xl border border-white/10 bg-white/[0.03] p-4 text-white sm:p-5">
              <h4 className="text-sm font-bold uppercase tracking-[0.18em]" style={{ color: "#EC4899" }}>Radiografía de percentiles <span className="text-[11px] font-semibold normal-case tracking-normal text-white/55">· frente a los {analisis.nPuesto} de la categoría</span></h4>
              <p className="text-[12px] text-white/60">
                
                {analisis.fila.edad} años · {analisis.fila.minutos}′ · {analisis.fila.partidos} partidos. La cuña rosa llega hasta su percentil (la discontinua es P50); a la derecha con balón, a la izquierda sin balón. Alto siempre es mejor: en las marcadas con ↓ (menos es mejor) ya está dado la vuelta.
              </p>
              <MarcoGrafico tipos={[{ clave: "pizza", nombre: "Radiografía" }, { clave: "barras", nombre: "Barras" }]} tipo={tipoRadiografia} onTipo={(t) => setTipoRadiografia(t as "pizza" | "barras")}>
              {tipoRadiografia === "pizza" && (
                <div className="hidden sm:block">
                  <RadiografiaPercentiles cunas={analisis.cunas} />
                </div>
              )}
              {/* En el móvil la pizza no se lee: la misma información en barras. */}
              <ul className={`mt-3 space-y-2 ${tipoRadiografia === "pizza" ? "sm:hidden" : "sm:grid sm:grid-cols-2 sm:gap-x-8 sm:space-y-0"}`}>
                {(["con", "sin"] as const).map((lado) => (
                  <li key={lado}>
                    <p className="mb-1 text-[11px] font-bold uppercase tracking-[0.16em] text-white/50">{lado === "con" ? "Con balón" : "Sin balón"}</p>
                    <ul className="space-y-1.5">
                      {analisis.cunas.filter((c) => c.lado === lado).map((c) => (
                        <li key={c.nombre} className="text-[13px]">
                          <div className="flex items-baseline justify-between gap-2">
                            <span className="min-w-0 truncate text-white/80">{c.nombre}</span>
                            <span className="shrink-0 tabular-nums"><b className="text-white">{c.valor}</b> <span style={{ color: "#EC4899" }}>P{Math.round(c.percentil)}</span></span>
                          </div>
                          <span className="mt-0.5 block h-1.5 overflow-hidden rounded-full bg-white/10"><span className="block h-full rounded-full" style={{ width: `${c.percentil}%`, background: "#EC4899" }} /></span>
                        </li>
                      ))}
                    </ul>
                  </li>
                ))}
              </ul>
              </MarcoGrafico>
            </div>
          )}

          {/* Mapa de su puesto: dos ejes, zona de élite y su sitio */}
          {analisis.mapa && (
            <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-4 text-white">
              <h4 className="text-sm font-bold uppercase tracking-[0.14em] text-[#D8B45A]">
                {analisis.mapa.ejes.y} frente a {analisis.mapa.ejes.x.toLowerCase()} <span className="text-[11px] font-semibold normal-case tracking-normal text-white/55">· frente a los {analisis.mapa.n} de la categoría</span>
              </h4>
              <p className="mb-2 text-[12px] text-white/55">
                Los mismos {analisis.mapa.n} {etiquetaPuesto.toLowerCase()} de la categoría con {analisis.minimo}′ o más. Cada eje es su puesto dentro de su posición (0 el último, 100 el primero) en {analisis.mapa.ejes.gx.join(", ").toLowerCase()} y en {analisis.mapa.ejes.gy.join(", ").toLowerCase()}. Cada eje es la media de sus percentiles en esos grupos, vuelta a ordenar entre estos {analisis.mapa.n}: por eso no coincide con las barras de «Momentos del juego», que le comparan con los de su edad. Zona sombreada: entre los mejores en las dos cosas (suma de 160 o más). Más es mejor en los dos ejes.
              </p>
              <MarcoGrafico
                tipos={[{ clave: "mapa", nombre: "Mapa" }, { clave: "ranking", nombre: "Ranking" }]}
                tipo={tipoMapa}
                onTipo={(t) => setTipoMapa(t as "mapa" | "ranking")}
                items={[
                  ...analisis.mapa.ejes.gx.map((g) => ({ clave: g, nombre: g, grupo: `Eje «${analisis.mapa!.ejes.x}»` })),
                  ...analisis.mapa.ejes.gy.filter((g) => !analisis.mapa!.ejes.gx.includes(g)).map((g) => ({ clave: g, nombre: g, grupo: `Eje «${analisis.mapa!.ejes.y}»` })),
                ]}
                pesos={pesosMapa}
                onPesos={setPesosMapa}
              >
                {tipoMapa === "mapa" ? (
                  <MapaDosEjes puntos={analisis.mapa.puntos} ejeX={analisis.mapa.ejes.x} ejeY={analisis.mapa.ejes.y} rotulos={analisis.mapa.ejes.rotulos} />
                ) : (
                  <ol className="space-y-1 text-[13px]">
                    {(() => {
                      const orden = [...analisis.mapa.puntos].sort((a, b) => b.x + b.y - (a.x + a.y));
                      const suyo = orden.findIndex((p) => p.propio);
                      return orden
                        .map((p, i) => ({ p, i }))
                        .filter(({ i }) => i < 10 || i === suyo)
                        .map(({ p, i }) => (
                          <li key={p.id} className={`flex items-center gap-2 rounded-lg px-2 py-1 ${p.propio ? "bg-[#D8B45A]/15 font-semibold" : ""}`}>
                            <span className="w-7 tabular-nums text-white/50">{i + 1}º</span>
                            <span className="min-w-0 flex-1 truncate text-white/85">{p.nombre} <span className="text-white/45">· {p.detalle}</span></span>
                            <span className="shrink-0 tabular-nums text-white/70">{Math.round(p.x)} · {Math.round(p.y)}</span>
                          </li>
                        ));
                    })()}
                  </ol>
                )}
              </MarcoGrafico>
            </div>
          )}

          {/* Momentos del juego: barras (frente a su edad) con marcas para la categoría y la élite (05/11/2026: el radar salía diminuto y repetía las barras). */}
          <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-4 text-white">
            <h4 className="text-sm font-bold uppercase tracking-[0.14em] text-[#D8B45A]">Momentos del juego <span className="text-[11px] font-semibold normal-case tracking-normal text-white/55">· frente a los {analisis.nEdad} de su edad{analisis.nEdad < 25 ? " (pocos: tendencia)" : ""}</span></h4>
            <p className="mb-3 text-[12px] text-white/55">
              Percentil medio en cada grupo de métricas de su puesto; 50 es la mitad. La barra, frente a los de su edad; las marcas, el mismo jugador frente a otras muestras (por eso un mismo grupo puede dar cifras distintas):{" "}
              <span style={{ color: AZUL }}>▮</span> toda la categoría ({analisis.nPuesto})
              {contraElite.map((e, k) => (
                <span key={e.liga}> · <span style={{ color: COLOR_LIGA[k % 2] }}>▮</span> {e.liga} ({e.n}{e.n < 25 ? ", pocos" : ""})</span>
              ))}
            </p>
            <ul className="grid gap-x-8 gap-y-2.5 md:grid-cols-2">
              {analisis.grupos.map((g) => {
                const v = Math.round(media(g.edad.length ? g.edad : g.todos));
                const marcas = [
                  { color: AZUL, valor: media(g.todos), nombre: "categoría", corto: "Cat." },
                  ...contraElite.map((e, k) => ({ color: COLOR_LIGA[k % 2], valor: e.grupos[GRUPOS_JUGADOR.indexOf(g.grupo)] || 0, nombre: e.liga, corto: e.liga === "Premier" ? "Prem." : "1.ª" })),
                ].filter((m) => m.valor > 0);
                return (
                  <li key={g.grupo} className="text-[13px]" title={marcas.map((m) => `${m.nombre}: ${Math.round(m.valor)}`).join(" · ")}>
                    <div className="mb-1 flex items-baseline justify-between gap-2">
                      <span className="min-w-0 truncate text-white/80">{g.grupo}</span>
                      <span className="shrink-0 tabular-nums"><span className="text-[11px] text-white/50">Edad </span><b style={{ color: v >= 66 ? VERDE : v >= 40 ? ORO : ROJO }}>{v}</b>{marcas.map((m) => <span key={m.nombre} className="ml-2 text-[11px]" style={{ color: m.color }}>{m.corto} {Math.round(m.valor)}</span>)}</span>
                    </div>
                    <span className="relative block h-2.5 rounded-full bg-white/10">
                      <span className="absolute inset-y-0 left-0 rounded-full transition-all duration-700" style={{ width: `${v}%`, background: v >= 66 ? VERDE : v >= 40 ? ORO : ROJO }} />
                      <span className="absolute inset-y-0 left-1/2 w-px bg-white/40" />
                      {marcas.map((m) => (
                        <span key={m.nombre} className="absolute -top-0.5 h-3.5 w-1 -translate-x-1/2 rounded-sm" style={{ left: `${m.valor}%`, background: m.color }} />
                      ))}
                    </span>
                  </li>
                );
              })}
            </ul>
          </div>

          {/* Cara a cara con la élite (07/11/2026): elegir jugadores de Primera y Premier y verlos encima de su radiografía. */}
          {eliteJugadores.length > 0 && (
            <ComparaElite
              fila={analisis.fila}
              puesto={analisis.puesto}
              nombreCorto={apodo || nombre}
              elite={eliteJugadores}
              sugeridos={contraElite.flatMap((e) => e.parecidos.filter((x) => x.sim >= 0.4).slice(0, 1).map((x) => `${x.j.jugador}|${x.j.equipo}`))}
              actualizado={elite?.actualizado}
            />
          )}

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
                      <span className="text-sm font-semibold" style={{ color: COLOR_LIGA[k % 2] }}>{e.liga}</span>
                      <span className="text-[12px] text-white/50">{e.n} jugadores{e.n < 25 ? " · pocos: tendencia" : ""}</span>
                    </div>
                    <p className="mt-1 text-2xl font-black tabular-nums text-white">
                      {e.indice}{" "}<span className="text-sm font-semibold text-white/50">percentil medio</span>
                    </p>
                    {e.parecidos.filter((x) => x.sim >= 0.4).length === 0 && e.parecidos[0] && (
                      <p className="mt-2 text-[12px] text-white/55">Ninguno con un estilo de verdad parecido: el más cercano, {e.parecidos[0].j.jugador} ({Math.round(e.parecidos[0].sim * 100)} %).</p>
                    )}
                    {e.parecidos.filter((x) => x.sim >= 0.4).length > 0 && (
                      <p className="mt-2 text-[11px] font-semibold uppercase tracking-[0.14em] text-white/45" title="Similitud de la forma de jugar en todas las métricas de su puesto (coseno entre perfiles normalizados): 100 % es idéntico, 0 % nada que ver. Sólo los de 20 % o más.">Se parece a · similitud de estilo en {analisis.contraEdad.length} métricas</p>
                    )}
                    {e.parecidos.filter((x) => x.sim >= 0.4).length > 0 && (
                      <ul className="mt-1 space-y-1">
                        {e.parecidos.filter((x) => x.sim >= 0.4).map(({ j, sim }) => (
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
          {sinDatos
            ? "Los datos de Wyscout no han llegado: vuelve a abrir la pestaña en un momento."
            : "No está en la descarga de Wyscout de la categoría con minutos esta temporada: el radar sale en cuanto juegue y entre en la siguiente descarga."}
        </p>
      )}

      {notas.length >= 2 && (
        <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-4">
          <h4 className="mb-1 text-sm font-bold text-white">Nota partido a partido</h4>
          <p className="mb-2 text-[12px] text-white/50">
            {notas.length} partidos, de {coma(Math.min(...notas.map((n) => n.nota)))} a {coma(Math.max(...notas.map((n) => n.nota)))}; media de los 3 últimos, {coma(media(notas.slice(-3).map((n) => n.nota)))}. Puntos: cada partido, de {notas[0].rival} a {notas[notas.length - 1].rival} (verde 7 o más, azul 5,5 a 7, rojo por debajo) · línea dorada: media de los tres últimos.
          </p>
          <div className="text-white"><Tendencia puntos={notas} /></div>
        </div>
      )}
    </div>
  );
}
