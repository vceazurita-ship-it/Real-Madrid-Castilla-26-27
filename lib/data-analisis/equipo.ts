/**
 * UN EQUIPO, DE UN VISTAZO (06/10/2026).
 *
 * Todo lo que DATA sabe de un equipo de la categoría, resumido en una sola
 * pantalla: cómo le va (resultados, forma, sistema), cómo juega (sus métricas
 * de equipo en percentil contra los de SU competición) y quién lo hace (su
 * once tipo por minutos y lo que destaca cada jugador contra los de su puesto).
 *
 * No añade dato: reordena el de las otras áreas para contestar rápido «¿qué
 * equipo es este?», que es la pregunta del lunes cuando se conoce el rival.
 *
 * Reglas que vienen de DATA y se respetan:
 * - El percentil de equipo es contra los equipos **de su misma competición**
 *   —Wyscout trae también Segunda y Segunda RFEF, y medir al Ibiza contra un
 *   equipo de otra categoría no dice nada—.
 * - El de jugador, contra los de su puesto en toda la descarga, con 90′
 *   (`percentilesDe` de la comparativa), y sin porcentajes de una acción.
 */
import type { FilaJugador, FilaPartido } from "@/lib/data-analisis/leer";
import {
  FASES,
  METRICAS,
  percentil as percentilDe,
  valorEnGrupo,
  type Fase,
  type Metrica,
} from "@/lib/data-analisis/metricas";
import { MINUTOS_MINIMOS, puestoDe, valorDe, type Puesto } from "@/lib/data-analisis/individual";
import { HUECOS, ladoDeWyscout, proponeOnce } from "@/lib/data-analisis/once";
import { indiceDe, percentilesDe, referenciaDe, type Percentil } from "@/lib/comparativa-u21";

/* ------------------------------------------------------------------ */
/*  RESULTADOS                                                         */
/* ------------------------------------------------------------------ */

export type Resultado = "G" | "E" | "P";

export const resultadoDe = (f: FilaPartido): Resultado =>
  f.golesFavor > f.golesContra ? "G" : f.golesFavor < f.golesContra ? "P" : "E";

/** «4-2-3-1 (100.0%)» → «4-2-3-1». */
export const sistemaDe = (f: FilaPartido) => (f.esquema || "").replace(/\s*\(.*\)\s*$/, "").trim();

/** La competición en la que más juega: contra ésa se le compara. */
export function competicionPrincipal(filas: FilaPartido[]) {
  const cuenta = new Map<string, number>();
  for (const f of filas) cuenta.set(f.competicion, (cuenta.get(f.competicion) ?? 0) + 1);
  return [...cuenta.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] ?? "";
}

export type ResumenEquipo = {
  partidos: number;
  g: number;
  e: number;
  p: number;
  gf: number;
  gc: number;
  puntos: number;
  /** Los últimos cinco, del más reciente al más antiguo. */
  forma: { fecha: string; rival: string; marcador: string; resultado: Resultado; casa: boolean }[];
  sistemas: { sistema: string; partidos: number }[];
  /** Su sitio en la tabla de su competición, contada con los informes que hay. */
  tabla: { puesto: number; de: number } | null;
};

export function resumenDe(equipo: string, filas: FilaPartido[], liga: FilaPartido[]): ResumenEquipo {
  const suyas = filas.filter((f) => f.equipo === equipo).sort((a, b) => b.fecha.localeCompare(a.fecha));
  const res = suyas.map(resultadoDe);
  const g = res.filter((r) => r === "G").length;
  const e = res.filter((r) => r === "E").length;
  const p = res.filter((r) => r === "P").length;

  const sistemas = new Map<string, number>();
  for (const f of suyas) {
    const s = sistemaDe(f);
    if (s) sistemas.set(s, (sistemas.get(s) ?? 0) + 1);
  }

  /* La tabla: puntos por partido, porque no todos tienen los mismos informes bajados. */
  const comp = competicionPrincipal(suyas);
  const porEquipo = new Map<string, { pts: number; pj: number; dg: number }>();
  for (const f of liga) {
    if (f.competicion !== comp) continue;
    const x = porEquipo.get(f.equipo) ?? { pts: 0, pj: 0, dg: 0 };
    const r = resultadoDe(f);
    x.pts += r === "G" ? 3 : r === "E" ? 1 : 0;
    x.pj += 1;
    x.dg += f.golesFavor - f.golesContra;
    porEquipo.set(f.equipo, x);
  }
  const orden = [...porEquipo.entries()].sort(
    (a, b) => b[1].pts / b[1].pj - a[1].pts / a[1].pj || b[1].dg / b[1].pj - a[1].dg / a[1].pj,
  );
  const sitio = orden.findIndex(([e2]) => e2 === equipo);

  return {
    partidos: suyas.length,
    g,
    e,
    p,
    gf: suyas.reduce((s, f) => s + f.golesFavor, 0),
    gc: suyas.reduce((s, f) => s + f.golesContra, 0),
    puntos: g * 3 + e,
    forma: suyas.slice(0, 5).map((f) => ({
      fecha: f.fecha,
      rival: f.rival,
      marcador: `${f.golesFavor}-${f.golesContra}`,
      resultado: resultadoDe(f),
      casa: f.partido.startsWith(f.equipo),
    })),
    sistemas: [...sistemas.entries()].map(([sistema, partidos]) => ({ sistema, partidos })).sort((a, b) => b.partidos - a.partidos),
    tabla: sitio >= 0 ? { puesto: sitio + 1, de: orden.length } : null,
  };
}

/* ------------------------------------------------------------------ */
/*  LO COLECTIVO                                                       */
/* ------------------------------------------------------------------ */

export type MetricaEquipo = {
  metrica: Metrica;
  valor: number;
  percentil: number | null;
  /** 1 = el primero de la competición en el sentido bueno (o el que más, si es un estilo). */
  puesto: number;
  /** Su puesto contando siempre de más a menos (para las de estilo: 1º = el que más). */
  puestoDeMas: number;
  de: number;
  mediana: number;
};

export type PerfilColectivo = {
  competicion: string;
  equipos: number;
  metricas: MetricaEquipo[];
  /** Media de percentiles por fase (sin los estilos). */
  fases: { fase: Fase; label: string; percentil: number | null }[];
  fuertes: MetricaEquipo[];
  flojos: MetricaEquipo[];
  /** Las de estilo (sin «bueno»): posesión, PPDA… dicen cómo juega, no si lo hace bien. */
  estilo: MetricaEquipo[];
};

const mediana = (v: number[]) => {
  const o = [...v].sort((a, b) => a - b);
  if (!o.length) return 0;
  const m = Math.floor(o.length / 2);
  return o.length % 2 ? o[m] : (o[m - 1] + o[m]) / 2;
};

/** Claves de estilo que se enseñan siempre, aunque tengan «bueno»: dicen cómo juega. */
const CLAVES_ESTILO = ["posesion", "ppda", "pasesPorPosesion", "longitudPase", "cuotaProgresivos", "contras", "centros", "pasesLargos", "recuperacionesAltas"];

export function perfilDe(equipo: string, liga: FilaPartido[]): PerfilColectivo | null {
  const suyas = liga.filter((f) => f.equipo === equipo);
  if (!suyas.length) return null;
  const competicion = competicionPrincipal(suyas);
  const deLaComp = liga.filter((f) => f.competicion === competicion);
  const equipos = [...new Set(deLaComp.map((f) => f.equipo))];
  if (equipos.length < 4) return null;
  const porEquipo = new Map(equipos.map((e) => [e, deLaComp.filter((f) => f.equipo === e)]));
  const mias = porEquipo.get(equipo) ?? suyas;

  const metricas: MetricaEquipo[] = [];
  for (const m of METRICAS) {
    const valor = valorEnGrupo(m, mias, "promedio");
    if (valor === null) continue;
    const valores = equipos.map((e) => valorEnGrupo(m, porEquipo.get(e) ?? [], "promedio")).filter((v): v is number => v !== null);
    if (valores.length < 4) continue;
    const orden = [...valores].sort((a, b) => (m.mejorAlto === false ? a - b : b - a));
    metricas.push({
      metrica: m,
      valor,
      percentil: m.mejorAlto === null ? null : percentilDe(valor, valores, m.mejorAlto),
      puesto: orden.findIndex((v) => v === valor) + 1,
      puestoDeMas: [...valores].sort((a, b) => b - a).findIndex((v) => v === valor) + 1,
      de: valores.length,
      mediana: mediana(valores),
    });
  }

  const conBueno = metricas.filter((x) => x.percentil !== null);
  const ordenadas = [...conBueno].sort((a, b) => (b.percentil ?? 0) - (a.percentil ?? 0));

  /* Un mismo dato contado dos veces (goles y goles − xG) no tiene que llenar la lista: uno por grupo. */
  const unaPorGrupo = (lista: MetricaEquipo[]) => {
    const vistos = new Set<string>();
    return lista.filter((x) => {
      if (vistos.has(x.metrica.grupo)) return false;
      vistos.add(x.metrica.grupo);
      return true;
    });
  };

  return {
    competicion,
    equipos: equipos.length,
    metricas,
    fases: FASES.map((f) => {
      const de = conBueno.filter((x) => x.metrica.fase === f.key).map((x) => x.percentil as number);
      return { fase: f.key, label: f.label, percentil: de.length ? Math.round(de.reduce((a, b) => a + b, 0) / de.length) : null };
    }),
    fuertes: unaPorGrupo(ordenadas.filter((x) => (x.percentil ?? 0) >= 60)).slice(0, 6),
    flojos: unaPorGrupo([...ordenadas].reverse().filter((x) => (x.percentil ?? 100) <= 40)).slice(0, 6),
    estilo: CLAVES_ESTILO.map((k) => metricas.find((x) => x.metrica.key === k)).filter((x): x is MetricaEquipo => Boolean(x)),
  };
}

/* ------------------------------------------------------------------ */
/*  LO INDIVIDUAL                                                      */
/* ------------------------------------------------------------------ */

export type JugadorEquipo = {
  fila: FilaJugador;
  puesto: Puesto;
  indice: number | null;
  /** Sus dos o tres mejores métricas del puesto, contra la categoría. */
  destaca: Percentil[];
  flojea: Percentil[];
  goles: number;
  asistencias: number;
};

export function plantillaDe(equipo: string, jugadores: FilaJugador[]): JugadorEquipo[] {
  const suyas = jugadores.filter((j) => j.temporada === "actual" && j.equipo === equipo && j.minutos > 0);
  /* Wyscout repite a alguno con dos nombres: la fila de más minutos. */
  const porNombre = new Map<string, FilaJugador>();
  for (const f of suyas) {
    const previo = porNombre.get(f.jugador);
    if (!previo || f.minutos > previo.minutos) porNombre.set(f.jugador, f);
  }

  const referencias = new Map<Puesto, FilaJugador[]>();
  const refDe = (p: Puesto) => {
    if (!referencias.has(p)) referencias.set(p, referenciaDe(jugadores, p, "todos"));
    return referencias.get(p) as FilaJugador[];
  };

  return [...porNombre.values()]
    .map((fila) => {
      const puesto = puestoDe(fila.posicion);
      const pcts = fila.minutos >= MINUTOS_MINIMOS ? percentilesDe(fila, refDe(puesto), puesto) : [];
      const orden = [...pcts].sort((a, b) => b.percentil - a.percentil);
      return {
        fila,
        puesto,
        indice: indiceDe(pcts),
        destaca: orden.filter((x) => x.percentil >= 75).slice(0, 3),
        flojea: [...orden].reverse().filter((x) => x.percentil <= 25).slice(0, 2),
        goles: valorDe(fila, "Goles") ?? 0,
        asistencias: valorDe(fila, "Asistencias") ?? 0,
      };
    })
    .sort((a, b) => b.fila.minutos - a.fila.minutos);
}

/** Su once tipo por minutos, en los huecos del 4-2-3-1 (los mismos que el once de DATA). */
export function onceTipoDe(plantilla: JugadorEquipo[]) {
  const huecos = proponeOnce(
    plantilla.map((j) => ({
      id: j.fila.jugador,
      sitio: { puesto: j.puesto, lado: ladoDeWyscout(j.fila.posicion), segun: "wyscout" as const, wyscout: j.fila.posicion, hoja: "" },
      minutos: j.fila.minutos,
    })),
  );
  const porNombre = new Map(plantilla.map((j) => [j.fila.jugador, j]));
  return Object.fromEntries(HUECOS.map((h) => [h.clave, porNombre.get(huecos[h.clave])])) as Record<string, JugadorEquipo | undefined>;
}

/* ------------------------------------------------------------------ */
/*  LA SÍNTESIS EN FRASES                                              */
/* ------------------------------------------------------------------ */

const ordinal = (n: number) => `${n}º`;

/** «Toques por entrada» → «toques por entrada», pero «PPDA» se queda como está. */
const enFrase = (t: string) => (/^\p{Lu}\p{Ll}/u.test(t) ? t[0].toLowerCase() + t.slice(1) : t);

export function sintesisDe(equipo: string, resumen: ResumenEquipo, perfil: PerfilColectivo | null, plantilla: JugadorEquipo[]): string[] {
  const frases: string[] = [];
  if (resumen.partidos) {
    const ppp = (resumen.puntos / resumen.partidos).toFixed(2).replace(".", ",");
    frases.push(
      `${resumen.g}G ${resumen.e}E ${resumen.p}P en ${resumen.partidos} partidos (${ppp} puntos por partido${
        resumen.tabla ? `, ${ordinal(resumen.tabla.puesto)} de ${resumen.tabla.de} por puntos por partido` : ""
      }), ${resumen.gf} goles a favor y ${resumen.gc} en contra.`,
    );
  }
  if (resumen.sistemas[0]) {
    const s = resumen.sistemas[0];
    frases.push(
      `${s.partidos / resumen.partidos >= 0.6 ? "Juega casi siempre en" : "Su sistema más usado es el"} ${s.sistema} (${s.partidos} de ${resumen.partidos})${
        resumen.sistemas[1] ? `; alternativa: ${resumen.sistemas[1].sistema} (${resumen.sistemas[1].partidos})` : ""
      }.`,
    );
  }
  if (perfil) {
    const mejorFase = [...perfil.fases].filter((f) => f.percentil !== null && f.fase !== "general").sort((a, b) => (b.percentil ?? 0) - (a.percentil ?? 0));
    if (mejorFase.length >= 2) {
      frases.push(
        `Lo mejor de su juego, ${mejorFase[0].label.toLowerCase()} (P${mejorFase[0].percentil}); lo más flojo, ${mejorFase[mejorFase.length - 1].label.toLowerCase()} (P${mejorFase[mejorFase.length - 1].percentil}).`,
      );
    }
    if (perfil.fuertes.length)
      frases.push(`Destaca en ${perfil.fuertes.slice(0, 3).map((x) => `${enFrase(x.metrica.nombre)} (${ordinal(x.puesto)})`).join(", ")}.`);
    if (perfil.flojos.length)
      frases.push(`Sufre en ${perfil.flojos.slice(0, 3).map((x) => `${enFrase(x.metrica.nombre)} (${ordinal(x.puesto)} de ${x.de})`).join(", ")}.`);
  }
  const goleador = [...plantilla].sort((a, b) => b.goles - a.goles)[0];
  const mejor = [...plantilla].filter((j) => j.indice !== null && j.fila.minutos >= 270).sort((a, b) => (b.indice ?? 0) - (a.indice ?? 0))[0];
  if (goleador && goleador.goles > 0)
    frases.push(`Su goleador, ${goleador.fila.jugador} (${goleador.goles} ${goleador.goles === 1 ? "gol" : "goles"}).${
      mejor && mejor !== goleador ? ` El que más rinde para su puesto: ${mejor.fila.jugador} (índice ${mejor.indice}).` : ""
    }`);
  return frases;
}
