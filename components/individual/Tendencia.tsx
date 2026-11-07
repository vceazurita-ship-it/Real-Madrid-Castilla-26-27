"use client";

/*
| TENDENCIA (07/11/2026)
|
| La pestaña de la ficha individual que responde a «¿cómo va?»: la evolución
| del jugador con lo que ya hay, sin escribir nada.
|
| - Valoraciones del cuerpo técnico: la nota partido a partido, su media móvil
|   de tres, la media del curso, el mejor y el peor partido y los tres últimos
|   frente a los anteriores; las notas por área (sólo las que se han puesto) y
|   los minutos apuntados en cada partido.
| - Wyscout, fotos semanales (`wyscout-instantaneas`, por /api/docs, sólo
|   lectura): la descarga es acumulada y la resta de dos fotos es lo que hizo
|   entre medias. La resta es la de lib/data-analisis/instantaneas.ts, no otra:
|   tasas deshaciendo el promedio con los minutos, porcentajes recompuestos con
|   su volumen y medias fuera. Las primeras jornadas no se pueden partir: van
|   juntas en el primer tramo.
| - Wyscout, esta temporada frente a la pasada: `evolucionDe`, el mismo salto
|   de percentil que «Evolución (pts vs 25/26)» de la comparativa.
|
| Lo que no tiene dato no se nombra: cada bloque se pinta sólo si su fuente
| trae algo de este jugador.
*/

import { useEffect, useMemo, useState } from "react";
import { ArrowDownRight, ArrowUpRight, CalendarClock, History, TrendingUp } from "lucide-react";

import { traeJson } from "@/lib/hojaCsv";
import type { FilaJugador } from "@/lib/data-analisis/leer";
import { casaNombre } from "@/lib/data-analisis/once";
import {
  MINUTOS_MINIMOS,
  MINUTOS_MINIMOS_ANTERIOR,
  PUESTOS,
  VOLUMEN_DEL_PORCENTAJE,
  evolucionDe,
  gruposDe,
  metricasDe,
  percentilEnPlantilla,
  puestoDe,
  valorDe,
  volumenDelPorcentaje,
  type MetricaJugador,
} from "@/lib/data-analisis/individual";
import { tipoDeColumna, tramoEntre, type Instantanea } from "@/lib/data-analisis/instantaneas";
import { useInstantaneas } from "@/hooks/useInstantaneas";
import { AREA_KEYS, AREA_LABELS, type AreaKey, type RatingsSeason } from "@/lib/ratings/types";
import { BarrasMedia } from "@/components/data/visual/VistasData";
import { MarcoGrafico, useTipoGrafico } from "@/components/data/visual/MarcoGrafico";

const ORO = "#D8B45A";
const AZUL = "#4F8FE8";
const ROJO = "#E5484D";
const VERDE = "#1B9E77";

/** Minutos que tiene que sumar «las últimas semanas» para compararlas con el curso: tres partidos. */
const MINUTOS_RECIENTE = 270;
/** Un porcentaje de menos intentos que esto en un tramo es una tendencia, no un dato. */
const INTENTOS_FIRMES = 10;

const media = (xs: number[]) => (xs.length ? xs.reduce((s, x) => s + x, 0) / xs.length : 0);
const coma = (n: number, d = 1) => n.toFixed(d).replace(".", ",").replace(/^-/, "−");
const conSigno = (n: number, d = 1) => `${n >= 0 ? "+" : "−"}${coma(Math.abs(n), d)}`;
/** "2026-09-18…" → "18/09". */
const diaMes = (iso: string) => {
  const [, mes, resto] = iso.split("-");
  return mes && resto ? `${resto.slice(0, 2)}/${mes}` : iso;
};
/** El valor de una métrica con su unidad: «72,4 %» o «1,35 por 90′». */
const valorCon = (v: number, porcentaje: boolean) =>
  porcentaje ? `${coma(v, 1)} %` : `${coma(v, Math.abs(v) >= 10 ? 1 : 2)} por 90′`;
const valorCorto = (v: number, porcentaje: boolean) => (porcentaje ? `${coma(v, 1)} %` : coma(v, Math.abs(v) >= 10 ? 1 : 2));

const colorNota = (n: number) => (n >= 7 ? VERDE : n >= 5.5 ? AZUL : ROJO);

/* ------------------------------------------------------------------ */
/*  GRÁFICOS                                                           */
/* ------------------------------------------------------------------ */

type PuntoNota = { clave: string; fecha: string; rival: string; nota: number; minutos: number; titular: boolean };

/** La nota de cada partido, su media móvil de tres y la media del curso. */
function GraficoNotas({ puntos, mediaCurso }: { puntos: PuntoNota[]; mediaCurso: number }) {
  const an = 420;
  const al = 170;
  const notas = puntos.map((p) => p.nota);
  const bajo = Math.max(0, Math.floor(Math.min(...notas)) - 1);
  const alto = Math.min(10, Math.ceil(Math.max(...notas)) + 1);
  const x = (i: number) => 30 + (i * (an - 50)) / Math.max(1, puntos.length - 1);
  const y = (v: number) => al - 26 - ((v - bajo) / Math.max(1, alto - bajo)) * (al - 46);
  const movil = puntos.map((_, i) => media(notas.slice(Math.max(0, i - 2), i + 1)));
  const paso = alto - bajo > 5 ? 2 : 1;
  const marcas: number[] = [];
  for (let v = bajo; v <= alto; v += paso) marcas.push(v);
  const cadaCuanto = Math.max(1, Math.ceil(puntos.length / 6));

  return (
    <svg viewBox={`0 0 ${an} ${al}`} className="h-auto w-full" role="img" aria-label="Nota por partido, media móvil de tres y media del curso">
      {marcas.map((v) => (
        <g key={v}>
          <line x1={24} x2={an - 12} y1={y(v)} y2={y(v)} stroke="currentColor" strokeOpacity={0.1} />
          <text x={2} y={y(v)} fontSize="11" dominantBaseline="middle" fill="currentColor" fillOpacity={0.55}>{v}</text>
        </g>
      ))}
      <line x1={24} x2={an - 12} y1={y(mediaCurso)} y2={y(mediaCurso)} stroke="currentColor" strokeOpacity={0.45} strokeDasharray="4 4" />
      <polyline points={movil.map((v, i) => `${x(i)},${y(v)}`).join(" ")} fill="none" stroke={ORO} strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round" />
      {puntos.map((p, i) => (
        <circle key={p.clave} cx={x(i)} cy={y(p.nota)} r={4.5} fill={colorNota(p.nota)}>
          <title>{`${p.fecha} · ${p.rival}: ${coma(p.nota)}${p.minutos > 0 ? ` · ${p.minutos}′` : ""}${p.titular ? " · titular" : ""}`}</title>
        </circle>
      ))}
      {puntos.map((p, i) =>
        i === 0 || i === puntos.length - 1 || i % cadaCuanto === 0 ? (
          <text key={`e-${p.clave}`} x={x(i)} y={al - 8} textAnchor="middle" fontSize="11" fill="currentColor" fillOpacity={0.55}>{p.fecha}</text>
        ) : null,
      )}
    </svg>
  );
}

/** Un mini gráfico de línea: cada punto, con la referencia discontinua; los débiles, huecos. */
function Chispa({ valores, referencia, debiles, color = ORO, alto = 56 }: { valores: (number | null)[]; referencia: number | null; debiles?: boolean[]; color?: string; alto?: number }) {
  const an = 220;
  const conDato = valores.filter((v): v is number => v !== null);
  if (conDato.length < 2) return null;
  const todos = referencia !== null ? [...conDato, referencia] : conDato;
  const min = Math.min(...todos);
  const max = Math.max(...todos);
  const x = (i: number) => 6 + (i * (an - 12)) / Math.max(1, valores.length - 1);
  const y = (v: number) => alto - 6 - ((v - min) / (max - min || 1)) * (alto - 12);
  const tramos: string[] = [];
  let actual: string[] = [];
  valores.forEach((v, i) => {
    if (v === null) {
      if (actual.length) tramos.push(actual.join(" "));
      actual = [];
      return;
    }
    actual.push(`${x(i)},${y(v)}`);
  });
  if (actual.length) tramos.push(actual.join(" "));

  return (
    <svg viewBox={`0 0 ${an} ${alto}`} className="h-auto w-full" aria-hidden>
      {referencia !== null && <line x1={0} x2={an} y1={y(referencia)} y2={y(referencia)} stroke="currentColor" strokeOpacity={0.4} strokeDasharray="3 3" />}
      {tramos.map((t, k) => (
        <polyline key={k} points={t} fill="none" stroke={color} strokeOpacity={0.7} strokeWidth={2} strokeLinejoin="round" />
      ))}
      {valores.map((v, i) =>
        v === null ? null : debiles?.[i] ? (
          <circle key={i} cx={x(i)} cy={y(v)} r={3.2} fill="none" stroke={color} strokeWidth={1.5} />
        ) : (
          <circle key={i} cx={x(i)} cy={y(v)} r={3.2} fill={color} />
        ),
      )}
    </svg>
  );
}

/** Flecha y color de un cambio según el sentido de la métrica. */
function Cambio({ delta, umbral, mejorAlto, texto }: { delta: number; umbral: number; mejorAlto: boolean | null; texto: string }) {
  const quieto = Math.abs(delta) < umbral;
  const bueno = mejorAlto === false ? delta < 0 : delta > 0;
  const color = quieto ? undefined : bueno ? VERDE : ROJO;
  return (
    <span className="inline-flex items-center gap-0.5 tabular-nums" style={{ color }}>
      {/* Sin cambio claro: «≈ −2,1» (07/11/2026: el icono de raya junto al signo menos se leía «— −2,1»). */}
      {quieto ? <span aria-hidden>≈ </span> : delta > 0 ? <ArrowUpRight size={12} /> : <ArrowDownRight size={12} />}
      {texto}
    </span>
  );
}

/** El rótulo de una métrica con su sentido: ↓ = menos es mejor. */
const nombreDe = (m: MetricaJugador) => `${m.nombre}${m.mejorAlto === false ? " ↓" : ""}`;

/* ------------------------------------------------------------------ */
/*  LA PESTAÑA                                                         */
/* ------------------------------------------------------------------ */

type TramoJugador = {
  clave: string;
  /** "18/09 → 25/09", o "hasta 18/09" para el primero. */
  etiqueta: string;
  inicial: boolean;
  minutos: number;
  partidos: number;
  datos: Record<string, number>;
};

export function Tendencia({
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
  const { historial, cargando: cargandoFotos } = useInstantaneas();
  const [tarda, setTarda] = useState(false);
  const [vuelta, setVuelta] = useState(0);
  const [todas, setTodas] = useState(false);
  const [tipoNotas, setTipoNotas] = useTipoGrafico("tendencia-nota", "linea", ["linea", "media", "tabla"] as const);
  const [tipoTramos, setTipoTramos] = useTipoGrafico("tendencia-tramos", "chispas", ["chispas", "tabla"] as const);
  const [tipoTemporadas, setTipoTemporadas] = useTipoGrafico("tendencia-temporadas", "grupos", ["grupos", "metricas"] as const);

  useEffect(() => {
    const reloj = setTimeout(() => setTarda(true), 20_000);
    return () => clearTimeout(reloj);
  }, [vuelta]);

  useEffect(() => {
    let vivo = true;
    /* Como en Área de mejora: en frío la primera respuesta puede llegar vacía, y se reintenta. */
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
      if (vivo) setJugadores(lista ?? []);
    });
    return () => {
      vivo = false;
    };
  }, [vuelta]);

  /* ---------------- Valoraciones ---------------- */

  const partidos = useMemo(() => {
    if (!ratings) return [];
    const ocultos = new Set(ratings.ocultos ?? []);
    return Object.values(ratings.matches)
      .filter((m) => m.match.date && !ocultos.has(m.match.id))
      .map((m) => ({ m, r: m.players[idJugador] }))
      .filter((x): x is { m: typeof x.m; r: NonNullable<typeof x.r> } => Boolean(x.r))
      .sort((a, b) => a.m.match.date.localeCompare(b.m.match.date));
  }, [ratings, idJugador]);

  const notas = useMemo<PuntoNota[]>(
    () =>
      partidos
        .filter(({ r }) => r.rating > 0 && !r.unrated)
        .map(({ m, r }) => ({ clave: m.match.id, fecha: diaMes(m.match.date), rival: m.match.opponent, nota: r.rating, minutos: r.minutes, titular: r.starter })),
    [partidos],
  );

  const resumenNotas = useMemo(() => {
    if (!notas.length) return null;
    const valores = notas.map((n) => n.nota);
    const mejor = notas.reduce((a, b) => (b.nota > a.nota ? b : a));
    const peor = notas.reduce((a, b) => (b.nota < a.nota ? b : a));
    const ultimas = notas.length >= 4 ? media(valores.slice(-3)) : null;
    const antes = notas.length >= 4 ? media(valores.slice(0, -3)) : null;
    return { mediaCurso: media(valores), mejor, peor, ultimas, antes };
  }, [notas]);

  /* Las notas por área: sólo las que se han puesto en dos partidos o más. */
  const areas = useMemo(
    () =>
      AREA_KEYS.map((k: AreaKey) => {
        const serie = partidos
          .filter(({ r }) => !r.unrated && (r.areas?.[k] ?? 0) > 0)
          .map(({ m, r }) => ({ clave: m.match.id, fecha: diaMes(m.match.date), rival: m.match.opponent, nota: r.areas[k] as number }));
        const vals = serie.map((s) => s.nota);
        return {
          k,
          serie,
          mediaCurso: media(vals),
          ultimas: vals.length >= 4 ? media(vals.slice(-3)) : null,
          antes: vals.length >= 4 ? media(vals.slice(0, -3)) : null,
        };
      }).filter((a) => a.serie.length >= 2),
    [partidos],
  );

  /* Los minutos apuntados en Valoraciones, partido a partido. */
  const minutos = useMemo(
    () => partidos.filter(({ r }) => r.minutes > 0).map(({ m, r }) => ({ clave: m.match.id, fecha: diaMes(m.match.date), rival: m.match.opponent, minutos: r.minutes, titular: r.starter })),
    [partidos],
  );

  /* ---------------- Wyscout ---------------- */

  const wys = useMemo(() => {
    const fotos: Instantanea[] = historial.fotos;
    const actuales = (jugadores ?? []).filter((j) => j.temporada === "actual");
    const filaCat = actuales.length ? casaNombre(nombre, actuales, (j) => j.jugador) ?? (apodo ? casaNombre(apodo, actuales, (j) => j.jugador) : null) : null;

    /* Su nombre en las fotos: el mismo de la descarga, o se casa contra lo que haya en ellas. */
    let suNombre: string | null = null;
    if (filaCat && fotos.some((f) => f.jugadores.some((j) => j.jugador === filaCat.jugador))) suNombre = filaCat.jugador;
    else if (fotos.length) {
      const enFotos = [...new Map(fotos.flatMap((f) => f.jugadores).map((j) => [j.jugador, j])).values()];
      suNombre = (casaNombre(nombre, enFotos, (j) => j.jugador) ?? (apodo ? casaNombre(apodo, enFotos, (j) => j.jugador) : null))?.jugador ?? null;
    }

    /* La fila de la temporada: la descarga de la categoría; sin ella, la última foto. */
    let temporada: FilaJugador | null = filaCat;
    if (!temporada && suNombre) {
      for (let i = fotos.length - 1; i >= 0 && !temporada; i--) {
        const f = fotos[i].jugadores.find((j) => j.jugador === suNombre);
        if (f) temporada = { ...f, temporada: "actual", edad: 0, pie: "", altura: 0, peso: 0, contrato: "" };
      }
    }
    if (!temporada) return null;

    const puesto = puestoDe(temporada.posicion);

    /* Los tramos: el primero es todo lo que había en la primera foto (no se puede partir). */
    const tramos: TramoJugador[] = [];
    if (suNombre && fotos.length) {
      const primera = fotos[0].jugadores.find((j) => j.jugador === suNombre);
      if (primera && primera.minutos > 0) {
        tramos.push({ clave: fotos[0].tomadaEn, etiqueta: `hasta ${diaMes(fotos[0].tomadaEn)}`, inicial: true, minutos: primera.minutos, partidos: primera.partidos, datos: primera.datos });
      }
      for (let i = 1; i < fotos.length; i++) {
        const t = tramoEntre(fotos[i - 1], fotos[i], VOLUMEN_DEL_PORCENTAJE).find((x) => x.fila.jugador === suNombre);
        if (t) tramos.push({ clave: fotos[i].tomadaEn, etiqueta: `${diaMes(fotos[i - 1].tomadaEn)} → ${diaMes(fotos[i].tomadaEn)}`, inicial: false, minutos: t.minutos, partidos: t.partidos, datos: t.fila.datos });
      }
    }

    /*
    | Las métricas de su puesto que se pueden partir por tramos: las tasas y los
    | porcentajes con volumen conocido. Los totales y las medias se quedan fuera
    | (la resta de un total no es comparable con el curso, y una media no se
    | puede recomponer).
    */
    const metricas = metricasDe(puesto).filter((m) => {
      if (m.mejorAlto === null) return false;
      const tipo = tipoDeColumna(m.columna);
      return tipo === "tasa" || (tipo === "porcentaje" && Boolean(VOLUMEN_DEL_PORCENTAJE[m.columna]));
    });

    const series = metricas
      .map((m) => {
        const porcentaje = tipoDeColumna(m.columna) === "porcentaje";
        const puntos = tramos.map((t) => {
          const v = t.datos[m.columna];
          /* Una corrección de Wyscout entre fotos puede dar negativo: eso no es un dato. */
          if (typeof v !== "number" || !Number.isFinite(v) || v < 0) return null;
          if (porcentaje) {
            const vol = VOLUMEN_DEL_PORCENTAJE[m.columna];
            const intentos = ((t.datos[vol.columna] ?? 0) * t.minutos) / 90;
            if (intentos <= 0) return null;
            return { valor: v, acciones: Math.round(intentos), corta: intentos < INTENTOS_FIRMES || t.minutos < MINUTOS_MINIMOS };
          }
          return { valor: v, acciones: Math.round((v * t.minutos) / 90), corta: t.minutos < MINUTOS_MINIMOS };
        });
        const curso = valorDe(temporada, m.columna);
        return { m, porcentaje, puntos, curso, n: puntos.filter(Boolean).length };
      })
      .filter((s) => s.n >= 2)
      /* Una métrica a cero en todos los tramos y en la temporada no dice nada (07/11/2026). */
      .filter((s) => s.puntos.some((p) => p && p.valor > 0) || (s.curso ?? 0) > 0);

    /* Las últimas semanas: desde la foto más reciente que deje 270′ o más hasta la última. */
    let reciente: { desde: string; hasta: string; minutos: number; partidos: number; fila: FilaJugador } | null = null;
    if (suNombre && fotos.length >= 2) {
      const ultima = fotos.length - 1;
      for (let k = ultima - 1; k >= 0; k--) {
        const t = tramoEntre(fotos[k], fotos[ultima], VOLUMEN_DEL_PORCENTAJE).find((x) => x.fila.jugador === suNombre);
        if (t && t.minutos >= MINUTOS_RECIENTE) {
          reciente = { desde: fotos[k].tomadaEn, hasta: fotos[ultima].tomadaEn, minutos: t.minutos, partidos: t.partidos, fila: t.fila };
          break;
        }
      }
      /* Si «lo reciente» es casi todo el curso, compararlos no dice nada. */
      if (reciente && reciente.minutos > 0.7 * temporada.minutos) reciente = null;
    }

    let ultimasSemanas: {
      desde: string;
      hasta: string;
      minutos: number;
      partidos: number;
      n: number;
      indiceReciente: number;
      indiceCurso: number;
      filas: { m: MetricaJugador; porcentaje: boolean; reciente: number; curso: number; pReciente: number; pCurso: number; salto: number }[];
    } | null = null;
    if (reciente && filaCat) {
      const delPuesto = actuales.filter((j) => j.minutos >= MINUTOS_MINIMOS && puestoDe(j.posicion) === puesto);
      if (delPuesto.length >= 10) {
        const filas = metricas
          .map((m) => {
            const vR = valorDe(reciente.fila, m.columna);
            const vC = valorDe(filaCat, m.columna);
            if (vR === null || vC === null || vR < 0) return null;
            if (!volumenDelPorcentaje(reciente.fila, m.columna).fiable || !volumenDelPorcentaje(filaCat, m.columna).fiable) return null;
            const contra = delPuesto
              .filter((c) => volumenDelPorcentaje(c, m.columna).fiable)
              .map((c) => valorDe(c, m.columna))
              .filter((v): v is number => v !== null);
            const pR = percentilEnPlantilla(vR, contra, m.mejorAlto);
            const pC = percentilEnPlantilla(vC, contra, m.mejorAlto);
            if (pR === null || pC === null) return null;
            return { m, porcentaje: tipoDeColumna(m.columna) === "porcentaje", reciente: vR, curso: vC, pReciente: pR, pCurso: pC, salto: pR - pC };
          })
          .filter((x): x is NonNullable<typeof x> => x !== null);
        if (filas.length >= 5) {
          ultimasSemanas = {
            desde: reciente.desde,
            hasta: reciente.hasta,
            minutos: reciente.minutos,
            partidos: reciente.partidos,
            n: delPuesto.length,
            indiceReciente: Math.round(media(filas.map((f) => f.pReciente))),
            indiceCurso: Math.round(media(filas.map((f) => f.pCurso))),
            filas: filas.sort((a, b) => b.salto - a.salto),
          };
        }
      }
    }

    /* Esta temporada frente a la pasada, cada una contra su categoría. */
    let temporadas: {
      antes: FilaJugador;
      fiable: boolean;
      salto: number;
      grupos: { grupo: string; salto: number; n: number }[];
      filas: ReturnType<typeof evolucionDe>["filas"];
    } | null = null;
    if (filaCat && jugadores) {
      const evo = evolucionDe(filaCat, jugadores);
      if (evo.antes && evo.filas.length >= 3) {
        temporadas = {
          antes: evo.antes,
          fiable: evo.fiable,
          salto: Math.round(media(evo.filas.map((f) => f.salto))),
          grupos: gruposDe(puesto)
            .map((g) => {
              const del = evo.filas.filter((f) => f.metrica.grupo === g);
              return { grupo: g, salto: Math.round(media(del.map((f) => f.salto))), n: del.length };
            })
            .filter((g) => g.n > 0),
          filas: evo.filas,
        };
      }
    }

    return { temporada, puesto, tramos, series, ultimasSemanas, temporadas, enCategoria: Boolean(filaCat) };
  }, [historial, jugadores, nombre, apodo]);

  const cargandoWyscout = jugadores === null || cargandoFotos;
  const hayNotas = notas.length > 0;
  const hayTramos = Boolean(wys && wys.tramos.length >= 2 && wys.series.length > 0);
  const hayAlgoWyscout = Boolean(wys && (hayTramos || wys.ultimasSemanas || wys.temporadas));
  const etiquetaPuesto = wys ? PUESTOS.find((p) => p.key === wys.puesto)?.label ?? wys.puesto : "";

  /* Las métricas que se enseñan de entrada: dos por grupo, en el orden de la ficha. */
  const seriesVisibles = useMemo(() => {
    if (!wys) return [];
    if (todas) return wys.series;
    const cuenta = new Map<string, number>();
    return wys.series.filter((s) => {
      const n = cuenta.get(s.m.grupo) ?? 0;
      cuenta.set(s.m.grupo, n + 1);
      return n < 2;
    });
  }, [wys, todas]);

  const nada = !cargandoWyscout && !hayNotas && minutos.length < 2 && areas.length === 0 && !hayAlgoWyscout;

  if (nada) {
    return (
      <p className="rounded-2xl border border-white/10 bg-white/[0.03] p-4 text-sm text-white/65">
        Aquí saldrá su evolución: la nota de cada partido en cuanto el cuerpo técnico le valore en Valoraciones, y sus datos de Wyscout semana a semana desde la siguiente descarga semanal en la que tenga minutos.
      </p>
    );
  }

  return (
    <div className="min-w-0 space-y-5 pb-10">
      {/* ================= VALORACIONES ================= */}
      {hayNotas && resumenNotas && (
        <section className="rounded-2xl border border-white/10 bg-white/[0.03] p-4 text-white">
          <h4 className="flex items-center gap-2 text-sm font-bold uppercase tracking-[0.14em] text-[#D8B45A]">
            <TrendingUp size={15} /> Nota partido a partido
          </h4>
          <p className="mb-3 text-[12px] text-white/55">Valoraciones del cuerpo técnico · 0-10 por partido · {notas.length} {notas.length === 1 ? "partido valorado" : "partidos valorados"}{notas.length < 5 ? " (pocos: tendencia)" : ""}.</p>

          <div className="mb-3 grid grid-cols-2 gap-2 sm:grid-cols-4">
            <div className="rounded-xl border border-white/10 bg-white/[0.03] p-2.5">
              <p className="text-[11px] text-white/55">Media del curso</p>
              <p className="text-2xl font-black tabular-nums" style={{ color: colorNota(resumenNotas.mediaCurso) }}>{coma(resumenNotas.mediaCurso, 2)}</p>
              <p className="text-[11px] text-white/50">en {notas.length} partidos</p>
            </div>
            {resumenNotas.ultimas !== null && resumenNotas.antes !== null && (
              <div className="rounded-xl border border-white/10 bg-white/[0.03] p-2.5">
                <p className="text-[11px] text-white/55">Los 3 últimos</p>
                <p className="text-2xl font-black tabular-nums text-white">{coma(resumenNotas.ultimas, 2)}</p>
                <p className="text-[11px]">
                  <Cambio delta={resumenNotas.ultimas - resumenNotas.antes} umbral={0.2} mejorAlto texto={`${conSigno(resumenNotas.ultimas - resumenNotas.antes, 2)} sobre los ${notas.length - 3} anteriores`} />
                </p>
              </div>
            )}
            {notas.length >= 2 && (
              <>
                <div className="rounded-xl border border-white/10 bg-white/[0.03] p-2.5">
                  <p className="text-[11px] text-white/55">Mejor partido</p>
                  <p className="text-2xl font-black tabular-nums" style={{ color: VERDE }}>{coma(resumenNotas.mejor.nota)}</p>
                  <p className="truncate text-[11px] text-white/50">{resumenNotas.mejor.fecha} · {resumenNotas.mejor.rival}</p>
                </div>
                <div className="rounded-xl border border-white/10 bg-white/[0.03] p-2.5">
                  <p className="text-[11px] text-white/55">Peor partido</p>
                  <p className="text-2xl font-black tabular-nums" style={{ color: ROJO }}>{coma(resumenNotas.peor.nota)}</p>
                  <p className="truncate text-[11px] text-white/50">{resumenNotas.peor.fecha} · {resumenNotas.peor.rival}</p>
                </div>
              </>
            )}
          </div>

          {notas.length >= 2 && (
            <MarcoGrafico
              tipos={[
                { clave: "linea", nombre: "Línea" },
                { clave: "media", nombre: "Frente a su media" },
                { clave: "tabla", nombre: "Tabla" },
              ]}
              tipo={tipoNotas}
              onTipo={(t) => setTipoNotas(t as "linea" | "media" | "tabla")}
            >
              {tipoNotas === "linea" && (
                <>
                  <div className="text-white"><GraficoNotas puntos={notas} mediaCurso={resumenNotas.mediaCurso} /></div>
                  <p className="mt-1 text-[12px] text-white/55">
                    Puntos: cada partido (verde 7 o más, azul 5,5 a 7, rojo por debajo) · <span style={{ color: ORO }}>línea dorada</span>: media de los tres últimos en cada partido · discontinua: media del curso ({coma(resumenNotas.mediaCurso, 2)}).
                  </p>
                </>
              )}
              {tipoNotas === "media" && <BarrasMedia serie={notas.map((n) => ({ etiqueta: `${n.fecha} ${n.rival}`, valor: n.nota }))} unidad="decimal" media={resumenNotas.mediaCurso} />}
              {tipoNotas === "tabla" && (
                <div className="overflow-x-auto">
                  <table className="w-full text-[12px]">
                    <thead>
                      <tr className="text-left text-white/50">
                        <th className="px-2 py-1 font-semibold">Fecha</th>
                        <th className="px-2 py-1 font-semibold">Rival</th>
                        <th className="px-2 py-1 text-right font-semibold">Nota</th>
                        <th className="px-2 py-1 text-right font-semibold">Media de 3</th>
                        <th className="px-2 py-1 text-right font-semibold">Minutos</th>
                      </tr>
                    </thead>
                    <tbody>
                      {notas.map((n, i) => (
                        <tr key={n.clave} className="border-t border-white/10">
                          <td className="px-2 py-1 tabular-nums text-white/70">{n.fecha}</td>
                          <td className="max-w-[9rem] truncate px-2 py-1 text-white/80">{n.rival}</td>
                          <td className="px-2 py-1 text-right font-semibold tabular-nums" style={{ color: colorNota(n.nota) }}>{coma(n.nota)}</td>
                          <td className="px-2 py-1 text-right tabular-nums text-white/75">{coma(media(notas.slice(Math.max(0, i - 2), i + 1).map((x) => x.nota)), 2)}</td>
                          <td className="px-2 py-1 text-right tabular-nums text-white/70">{n.minutos > 0 ? `${n.minutos}′${n.titular ? " · titular" : ""}` : n.titular ? "titular" : ""}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </MarcoGrafico>
          )}
        </section>
      )}

      {/* Notas por área: sólo las que el cuerpo técnico ha puesto */}
      {areas.length > 0 && (
        <section className="rounded-2xl border border-white/10 bg-white/[0.03] p-4 text-white">
          <h4 className="text-sm font-bold uppercase tracking-[0.14em] text-[#D8B45A]">Notas por área</h4>
          <p className="mb-3 text-[12px] text-white/55">Valoraciones del cuerpo técnico · 0-10 · cada área con los partidos en los que se puso. Discontinua: su media del curso.</p>
          <ul className="grid gap-3 sm:grid-cols-2">
            {areas.map((a) => (
              <li key={a.k} className="min-w-0 rounded-xl border border-white/10 bg-white/[0.03] p-3">
                <div className="flex items-baseline justify-between gap-2">
                  <span className="text-[13px] font-semibold text-white/85">{AREA_LABELS[a.k]}</span>
                  <span className="shrink-0 tabular-nums text-[13px]">
                    <b style={{ color: colorNota(a.mediaCurso) }}>{coma(a.mediaCurso, 2)}</b> <span className="text-[11px] text-white/50">en {a.serie.length} partidos{a.serie.length < 5 ? " · tendencia" : ""}</span>
                  </span>
                </div>
                <div className="mt-1 text-white"><Chispa valores={a.serie.map((s) => s.nota)} referencia={a.mediaCurso} /></div>
                <p className="text-[11px] text-white/50">
                  {a.serie[0].fecha} {a.serie[0].rival} → {a.serie[a.serie.length - 1].fecha} {a.serie[a.serie.length - 1].rival}
                  {a.ultimas !== null && a.antes !== null && (
                    <>
                      {" · "}
                      <Cambio delta={a.ultimas - a.antes} umbral={0.2} mejorAlto texto={`3 últimos ${coma(a.ultimas, 2)} (${conSigno(a.ultimas - a.antes, 2)})`} />
                    </>
                  )}
                </p>
              </li>
            ))}
          </ul>
        </section>
      )}

      {/* Minutos por partido */}
      {minutos.length >= 2 && (
        <section className="rounded-2xl border border-white/10 bg-white/[0.03] p-4 text-white">
          <h4 className="flex items-center gap-2 text-sm font-bold uppercase tracking-[0.14em] text-[#D8B45A]"><CalendarClock size={15} /> Minutos por partido</h4>
          <p className="mb-3 text-[12px] text-white/55">
            Valoraciones · minutos apuntados · {minutos.reduce((s, m) => s + m.minutos, 0)}′ en {minutos.length} partidos, {minutos.filter((m) => m.titular).length} de titular. Barra dorada: titular; gris: entró desde el banquillo.
          </p>
          <div className="flex h-24 items-end gap-1">
            {minutos.map((m) => (
              <div key={m.clave} className="flex h-full min-w-0 flex-1 flex-col justify-end" title={`${m.fecha} · ${m.rival}: ${m.minutos}′${m.titular ? " · titular" : ""}`}>
                <span className="block rounded-t-sm" style={{ height: `${Math.min(100, (m.minutos / 95) * 100)}%`, background: m.titular ? ORO : "rgb(var(--rmcf-ink-rgb) / 0.35)" }} />
              </div>
            ))}
          </div>
          <div className="mt-1 flex justify-between text-[11px] text-white/50">
            <span>{minutos[0].fecha} · {minutos[0].rival}</span>
            <span>{minutos[minutos.length - 1].fecha} · {minutos[minutos.length - 1].rival}</span>
          </div>
        </section>
      )}

      {/* ================= WYSCOUT ================= */}
      {cargandoWyscout && (
        <div className="space-y-3" role="status" aria-live="polite">
          <p className="rounded-xl border border-white/10 bg-white/[0.03] px-3 py-2 text-[13px] text-white/70">
            {tarda ? "Tarda más de lo normal: el servidor está leyendo los datos de Wyscout en frío. " : "Leyendo los datos de Wyscout y sus fotos semanales…"}
            {tarda && (
              <button
                type="button"
                onClick={() => {
                  setTarda(false);
                  setJugadores(null);
                  setVuelta((v) => v + 1);
                }}
                className="ml-1 font-semibold text-[#D8B45A] underline underline-offset-2"
              >
                Volver a intentar
              </button>
            )}
          </p>
          <div className="grid gap-3 sm:grid-cols-3">
            <div className="h-28 animate-pulse rounded-2xl bg-white/[0.07]" />
            <div className="h-28 animate-pulse rounded-2xl bg-white/[0.07]" />
            <div className="h-28 animate-pulse rounded-2xl bg-white/[0.07]" />
          </div>
        </div>
      )}

      {!cargandoWyscout && wys && hayTramos && (
        <section className="min-w-0 rounded-2xl border border-white/10 bg-white/[0.03] p-4 text-white">
          <h4 className="text-sm font-bold uppercase tracking-[0.14em] text-[#D8B45A]">Semana a semana en Wyscout</h4>
          <p className="mb-3 text-[12px] text-white/55">
            Wyscout · fotos semanales de su fila acumulada · {wys.tramos.length} tramos entre fotos. Cada punto es lo que hizo en ese tramo, por 90′ (los porcentajes, con los intentos del tramo); la discontinua es su temporada ({wys.temporada.minutos}′ en {wys.temporada.partidos} partidos). Punto hueco: tramo de menos de {MINUTOS_MINIMOS}′ o porcentaje de menos de {INTENTOS_FIRMES} intentos, es tendencia. {wys.tramos[0].inicial ? `El primer tramo junta las primeras jornadas: cuando empezaron las fotos ya venían sumadas. ` : ""}Las marcadas con ↓: menos es mejor. Métricas de {etiquetaPuesto.toLowerCase()}.
          </p>

          {/* Minutos de cada tramo: la base de todo lo de abajo */}
          <div className="mb-4">
            <p className="mb-1 text-[11px] font-bold uppercase tracking-[0.14em] text-white/50">Minutos en cada tramo</p>
            <div className="flex h-14 items-end gap-1">
              {wys.tramos.map((t) => {
                const max = Math.max(...wys.tramos.map((x) => x.minutos));
                return (
                  <div key={t.clave} className="flex h-full min-w-0 flex-1 flex-col justify-end" title={`${t.etiqueta}: ${t.minutos}′ en ${t.partidos} ${t.partidos === 1 ? "partido" : "partidos"}`}>
                    <span className="block rounded-t-sm" style={{ height: `${Math.max(4, (t.minutos / max) * 100)}%`, background: t.minutos < MINUTOS_MINIMOS ? "rgb(var(--rmcf-ink-rgb) / 0.3)" : AZUL }} />
                  </div>
                );
              })}
            </div>
            <div className="mt-1 flex justify-between gap-2 text-[11px] text-white/50">
              <span className="truncate">{wys.tramos[0].etiqueta} · {wys.tramos[0].minutos}′</span>
              <span className="truncate text-right">{wys.tramos[wys.tramos.length - 1].etiqueta} · {wys.tramos[wys.tramos.length - 1].minutos}′</span>
            </div>
          </div>

          <MarcoGrafico
            tipos={[
              { clave: "chispas", nombre: "Mini gráficos" },
              { clave: "tabla", nombre: "Tabla" },
            ]}
            tipo={tipoTramos}
            onTipo={(t) => setTipoTramos(t as "chispas" | "tabla")}
          >
            {tipoTramos === "chispas" ? (
              <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                {seriesVisibles.map((s) => {
                  const ultimo = [...s.puntos].reverse().find((p) => p !== null) ?? null;
                  const iUltimo = s.puntos.lastIndexOf(ultimo);
                  const tramo = wys.tramos[iUltimo];
                  const delta = ultimo && s.curso !== null ? ultimo.valor - s.curso : null;
                  const umbral = s.curso !== null ? Math.max(Math.abs(s.curso) * 0.1, s.porcentaje ? 3 : 0.05) : 0;
                  return (
                    <li key={s.m.columna} className="min-w-0 rounded-xl border border-white/10 bg-white/[0.03] p-3" title={s.m.comoLeer}>
                      <div className="flex items-baseline justify-between gap-2">
                        <span className="min-w-0 truncate text-[13px] font-semibold text-white/85">{nombreDe(s.m)}</span>
                        <span className="shrink-0 text-[11px] text-white/45">{s.m.grupo}</span>
                      </div>
                      <div className="mt-1 text-white">
                        <Chispa valores={s.puntos.map((p) => p?.valor ?? null)} referencia={s.curso} debiles={s.puntos.map((p) => Boolean(p?.corta))} />
                      </div>
                      {ultimo && tramo && (
                        <p className="text-[11px] leading-snug text-white/60">
                          <b className="text-white/85">{valorCon(ultimo.valor, s.porcentaje)}</b> en {tramo.etiqueta} ({tramo.minutos}′{s.porcentaje ? `, ${ultimo.acciones} intentos` : ""}{ultimo.corta ? ", tendencia" : ""})
                          {s.curso !== null && (
                            <>
                              {" · temporada "}
                              {valorCorto(s.curso, s.porcentaje)}
                              {delta !== null && (
                                <>
                                  {" "}
                                  <Cambio delta={delta} umbral={umbral} mejorAlto={s.m.mejorAlto} texto={conSigno(delta, s.porcentaje || Math.abs(delta) >= 10 ? 1 : 2)} />
                                </>
                              )}
                            </>
                          )}
                        </p>
                      )}
                    </li>
                  );
                })}
              </ul>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full min-w-[32rem] text-[12px]">
                  <thead>
                    <tr className="text-left text-white/50">
                      <th className="sticky left-0 bg-[var(--rmcf-surface,#0B0F14)] px-2 py-1 font-semibold">Métrica</th>
                      {wys.tramos.map((t) => (
                        <th key={t.clave} className="whitespace-nowrap px-2 py-1 text-right font-semibold">
                          {t.etiqueta}
                          <span className="block font-normal text-white/40">{t.minutos}′</span>
                        </th>
                      ))}
                      <th className="whitespace-nowrap px-2 py-1 text-right font-semibold">Temporada<span className="block font-normal text-white/40">{wys.temporada.minutos}′</span></th>
                    </tr>
                  </thead>
                  <tbody>
                    {seriesVisibles.map((s) => (
                      <tr key={s.m.columna} className="border-t border-white/10">
                        <td className="sticky left-0 max-w-[11rem] truncate bg-[var(--rmcf-surface,#0B0F14)] px-2 py-1 text-white/80">{nombreDe(s.m)}{s.porcentaje ? "" : " /90′"}</td>
                        {s.puntos.map((p, i) => (
                          <td key={wys.tramos[i].clave} className={`px-2 py-1 text-right tabular-nums ${p?.corta ? "text-white/40" : "text-white/80"}`} title={p ? (s.porcentaje ? `${p.acciones} intentos` : `≈ ${p.acciones} en ${wys.tramos[i].minutos}′`) : undefined}>
                            {p ? valorCorto(p.valor, s.porcentaje) : ""}
                          </td>
                        ))}
                        <td className="px-2 py-1 text-right font-semibold tabular-nums text-white/85">{s.curso !== null ? valorCorto(s.curso, s.porcentaje) : ""}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                <p className="mt-1 text-[11px] text-white/45">En gris: tramo corto o porcentaje de pocos intentos (tendencia).</p>
              </div>
            )}
          </MarcoGrafico>

          {wys.series.length > seriesVisibles.length || todas ? (
            <button type="button" onClick={() => setTodas((v) => !v)} className="mt-3 text-[12px] font-semibold text-[#D8B45A] underline underline-offset-2">
              {todas ? "Ver sólo dos por grupo" : `Ver las ${wys.series.length} métricas de su puesto`}
            </button>
          ) : null}
        </section>
      )}

      {/* Las últimas semanas frente a su temporada, en percentil de la categoría */}
      {!cargandoWyscout && wys?.ultimasSemanas && (
        <section className="rounded-2xl border border-white/10 bg-white/[0.03] p-4 text-white">
          <h4 className="text-sm font-bold uppercase tracking-[0.14em] text-[#D8B45A]">Últimas semanas frente a su temporada</h4>
          <p className="mb-3 text-[12px] text-white/55">
            Wyscout · fotos semanales · del {diaMes(wys.ultimasSemanas.desde)} al {diaMes(wys.ultimasSemanas.hasta)}: {wys.ultimasSemanas.minutos}′ en {wys.ultimasSemanas.partidos} {wys.ultimasSemanas.partidos === 1 ? "partido" : "partidos"}, frente a su temporada ({wys.temporada.minutos}′). Los dos valores, por 90′, puestos en percentil contra los {wys.ultimasSemanas.n} {etiquetaPuesto.toLowerCase()} de la categoría con {MINUTOS_MINIMOS}′ o más; las de ↓ ya vienen dadas la vuelta (alto es mejor).
          </p>
          <div className="mb-3 flex flex-wrap items-baseline gap-x-4 gap-y-1">
            <p className="text-3xl font-black tabular-nums text-white">
              {wys.ultimasSemanas.indiceReciente} <span className="text-sm font-semibold text-white/50">percentil medio reciente</span>
            </p>
            <p className="text-[13px]">
              <Cambio
                delta={wys.ultimasSemanas.indiceReciente - wys.ultimasSemanas.indiceCurso}
                umbral={3}
                mejorAlto
                texto={`${wys.ultimasSemanas.indiceReciente - wys.ultimasSemanas.indiceCurso >= 0 ? "+" : "−"}${Math.abs(wys.ultimasSemanas.indiceReciente - wys.ultimasSemanas.indiceCurso)} sobre su temporada (${wys.ultimasSemanas.indiceCurso})`}
              />
              <span className="text-white/50"> · en {wys.ultimasSemanas.filas.length} métricas{wys.ultimasSemanas.minutos < 450 ? " · muestra corta: tendencia" : ""}</span>
            </p>
          </div>
          {(() => {
            const sube = wys.ultimasSemanas.filas.filter((f) => f.salto >= 10).slice(0, 3);
            const baja = [...wys.ultimasSemanas.filas].reverse().filter((f) => f.salto <= -10).slice(0, 3);
            if (!sube.length && !baja.length) {
              return <p className="text-[13px] text-white/70">Rinde como en su temporada: ninguna de las {wys.ultimasSemanas.filas.length} métricas se mueve 10 puntos de percentil o más.</p>;
            }
            return (
              <div className="grid gap-3 md:grid-cols-2">
                {[
                  { t: "Lo que sube", color: VERDE, lista: sube },
                  { t: "Lo que baja", color: ROJO, lista: baja },
                ]
                  .filter((b) => b.lista.length)
                  .map((b) => (
                    <div key={b.t} className="rounded-xl border border-white/10 bg-white/[0.03] p-3">
                      <p className="mb-1.5 text-[12px] font-bold" style={{ color: b.color }}>{b.t}</p>
                      <ul className="space-y-1.5">
                        {b.lista.map((f) => (
                          <li key={f.m.columna} className="text-[13px]" title={f.m.comoLeer}>
                            <div className="flex items-baseline justify-between gap-2">
                              <span className="min-w-0 truncate text-white/85">{nombreDe(f.m)}</span>
                              <span className="shrink-0 tabular-nums font-semibold" style={{ color: b.color }}>p{f.pCurso} → p{f.pReciente}</span>
                            </div>
                            <p className="text-[11px] text-white/55">{valorCon(f.reciente, f.porcentaje)} en las últimas semanas · {valorCon(f.curso, f.porcentaje)} en la temporada</p>
                          </li>
                        ))}
                      </ul>
                    </div>
                  ))}
              </div>
            );
          })()}
        </section>
      )}

      {/* ================= ESTA TEMPORADA FRENTE A LA PASADA ================= */}
      {!cargandoWyscout && wys?.temporadas && (
        <section className="rounded-2xl border border-white/10 bg-white/[0.03] p-4 text-white">
          <h4 className="flex items-center gap-2 text-sm font-bold uppercase tracking-[0.14em] text-[#D8B45A]"><History size={15} /> 26/27 frente a 25/26</h4>
          <p className="mb-3 text-[12px] text-white/55">
            Wyscout · cada temporada contra su propia categoría ({etiquetaPuesto.toLowerCase()}): se compara su percentil, no el número, porque la liga y el rol cambian. 25/26: {wys.temporadas.antes.minutos}′ en {wys.temporadas.antes.partidos} partidos{wys.temporadas.antes.equipo ? ` (${wys.temporadas.antes.equipo})` : ""}{wys.temporadas.fiable ? "" : `, menos de ${MINUTOS_MINIMOS_ANTERIOR}′: tendencia`} · 26/27: {wys.temporada.minutos}′ en {wys.temporada.partidos}{wys.temporada.minutos < 450 ? ", muestra corta: tendencia" : ""}. Las de ↓ ya vienen dadas la vuelta (subir es mejorar).
          </p>
          <p className="mb-3 text-2xl font-black leading-tight tabular-nums sm:text-3xl" style={{ color: wys.temporadas.salto > 2 ? VERDE : wys.temporadas.salto < -2 ? ROJO : undefined }}>
            {wys.temporadas.salto === 0 ? (
              <>Igual que en 25/26 <span className="block text-sm font-semibold leading-snug text-white/50 sm:inline">de media en {wys.temporadas.filas.length} métricas: sube en unas y baja en otras</span></>
            ) : (
              <>
                {wys.temporadas.salto > 0 ? "+" : "−"}
                {Math.abs(wys.temporadas.salto)} <span className="text-sm font-semibold leading-snug text-white/50">puntos de percentil de media en {wys.temporadas.filas.length} métricas</span>
              </>
            )}
          </p>
          <MarcoGrafico
            tipos={[
              { clave: "grupos", nombre: "Por grupos" },
              { clave: "metricas", nombre: "Métrica a métrica" },
            ]}
            tipo={tipoTemporadas}
            onTipo={(t) => setTipoTemporadas(t as "grupos" | "metricas")}
          >
            {tipoTemporadas === "grupos" ? (
              <ul className="space-y-2">
                {wys.temporadas.grupos.map((g) => {
                  const ancho = Math.min(50, (Math.abs(g.salto) / 50) * 50);
                  const color = g.salto > 2 ? VERDE : g.salto < -2 ? ROJO : "rgb(var(--rmcf-ink-rgb) / 0.4)";
                  return (
                    <li key={g.grupo} className="text-[13px]">
                      <div className="mb-0.5 flex items-baseline justify-between gap-2">
                        <span className="min-w-0 truncate text-white/80">{g.grupo} <span className="text-[11px] text-white/45">· {g.n} {g.n === 1 ? "métrica" : "métricas"}</span></span>
                        <span className="shrink-0 font-semibold tabular-nums" style={{ color: g.salto > 2 ? VERDE : g.salto < -2 ? ROJO : undefined }}>{g.salto > 0 ? "+" : g.salto < 0 ? "−" : ""}{Math.abs(g.salto)}</span>
                      </div>
                      <span className="relative block h-2.5 rounded-full bg-white/10">
                        <span className="absolute inset-y-0 left-1/2 w-px bg-white/40" />
                        <span className="absolute inset-y-0 rounded-full" style={{ left: g.salto >= 0 ? "50%" : `${50 - ancho}%`, width: `${ancho}%`, background: color }} />
                      </span>
                    </li>
                  );
                })}
              </ul>
            ) : (
              <ul className="space-y-1.5">
                {wys.temporadas.filas.map((f) => {
                  const porcentaje = f.metrica.unidad === "porcentaje";
                  return (
                    <li key={f.metrica.columna} className="text-[13px]" title={f.metrica.comoLeer}>
                      <div className="flex items-baseline justify-between gap-2">
                        <span className="min-w-0 truncate text-white/85">{nombreDe(f.metrica)}</span>
                        <span className="shrink-0 tabular-nums">
                          <span className="text-white/60">p{f.percentilAntes} → p{f.percentilAhora} </span>
                          <b style={{ color: f.salto > 2 ? VERDE : f.salto < -2 ? ROJO : undefined }}>{f.salto > 0 ? "+" : f.salto < 0 ? "−" : ""}{Math.abs(f.salto)}</b>
                        </span>
                      </div>
                      <p className="text-[11px] text-white/50">
                        {porcentaje ? `${coma(f.antes, 1)} % → ${coma(f.ahora, 1)} %` : tipoDeColumna(f.metrica.columna) === "tasa" ? `${valorCorto(f.antes, false)} → ${valorCorto(f.ahora, false)} por 90′` : `${valorCorto(f.antes, false)} → ${valorCorto(f.ahora, false)}`}
                      </p>
                    </li>
                  );
                })}
              </ul>
            )}
          </MarcoGrafico>
        </section>
      )}

      {/* Wyscout ya leído y sin nada de este jugador: lo que vendrá, en una línea */}
      {!cargandoWyscout && !hayAlgoWyscout && (
        <p className="rounded-xl border border-white/10 bg-white/[0.03] px-3 py-2 text-[12px] text-white/60">
          Su evolución en Wyscout sale en cuanto haya dos fotos semanales con minutos suyos: la foto se toma con cada descarga semanal de Wyscout.
        </p>
      )}
    </div>
  );
}
