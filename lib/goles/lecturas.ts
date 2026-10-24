/*
|--------------------------------------------------------------------------
| LO QUE DICEN LOS NÚMEROS DEL ANÁLISIS DE GOLES, EN FRASES (13/10/2026)
|--------------------------------------------------------------------------
|
| Las tablas de `/analisis-goles` obligan a cruzar columnas para sacar una
| conclusión. Aquí se sacan esas conclusiones: cada función devuelve una o
| dos frases para el pie de un panel, y `loImportante` junta las que más
| pesan arriba del todo. Siempre contra la liga y con la misma condición.
|
| Umbral: algo es «por encima» o «por debajo» si se aparta más de un 10 % de
| la liga; si no, «en la media». Con pocos partidos se avisa: un gol mueve
| mucho una franja.
*/

import { NOMBRE_TIPO, FASES, fmt, media, type Franja, type TipoGol } from "@/lib/goles/analisis";

export type FilaFranja = { franja: Franja; gf: number; gc: number; ligaPP: number; ligaContraPP: number; partidos: number };

export type Condicion = {
  n: number;
  nw: number;
  gf: number;
  gc: number;
  puntos: number;
  tiros: number;
  aPuerta: number;
  xg: number;
  tirosContra: number;
  xgContra: number;
  conversion: number;
  precision: number;
  golesMenosXg: number;
};

export type ResumenPrimero = Record<"propio" | "rival" | "nadie", { n: number; G: number; E: number; P: number }>;

const n1 = (v: number) => fmt(v, 1);
const n2 = (v: number) => fmt(v, 1);

/** −1 por debajo, 0 en la media, 1 por encima (más de un 10 %). */
function frente(valor: number, liga: number) {
  if (!Number.isFinite(valor) || !Number.isFinite(liga) || liga === 0) return 0;

  return valor > liga * 1.1 ? 1 : valor < liga * 0.9 ? -1 : 0;
}

const veces = (n: number) => (n === 1 ? "1 gol" : `${n} goles`);

/** El balance: cuánto marca y cuánto encaja frente a la liga. */
export function lecturaBalance(corto: string, partidos: number, gf: number, gc: number, ligaGF: number, ligaGC: number) {
  if (!partidos) return "Sin partidos en este tramo.";

  const a = frente(media(gf, partidos), ligaGF);
  const d = frente(media(gc, partidos), ligaGC);
  const ataque = a > 0 ? "marca más que la media" : a < 0 ? "marca menos que la media" : "marca como la media";
  const defensa = d < 0 ? "encaja menos que la media" : d > 0 ? "encaja más que la media" : "encaja como la media";

  return `${corto} ${ataque} (${n2(media(gf, partidos))} por partido; la liga, ${n2(ligaGF)}) y ${defensa} (${n2(media(gc, partidos))}; la liga, ${n2(ligaGC)}).`;
}

/** El tramo en que más se aparta de la liga en ataque (para bien) y en defensa (para mal). */
export function tramosClave(filas: FilaFranja[]) {
  const partidos = filas[0]?.partidos ?? 0;
  const conDif = filas.map((f) => ({ ...f, df: media(f.gf, partidos) - f.ligaPP, dc: media(f.gc, partidos) - f.ligaContraPP }));
  const fuerte = [...conDif].filter((f) => f.gf > 0 && f.df > 0).sort((a, b) => b.df - a.df)[0];
  const flojo = [...conDif].filter((f) => f.gc > 0 && f.dc > 0).sort((a, b) => b.dc - a.dc)[0];

  return { fuerte, flojo };
}

/** Dónde marca y dónde sufre más que la liga, y cómo se reparten las partes. */
export function lecturaFranjas(filas: FilaFranja[]) {
  const partidos = filas[0]?.partidos ?? 0;
  const gf = filas.reduce((s, f) => s + f.gf, 0);
  const gc = filas.reduce((s, f) => s + f.gc, 0);

  if (!partidos || gf + gc === 0) return [];

  const frases: string[] = [];
  const conDif = filas.map((f) => ({ ...f, df: media(f.gf, partidos) - f.ligaPP, dc: media(f.gc, partidos) - f.ligaContraPP }));
  const fuerte = [...conDif].filter((f) => f.gf > 0).sort((a, b) => b.df - a.df)[0];
  const flojo = [...conDif].filter((f) => f.gc > 0).sort((a, b) => b.dc - a.dc)[0];

  if (fuerte && fuerte.df > 0) frases.push(`Su mejor tramo en ataque es el ${fuerte.franja.nombre}: ${veces(fuerte.gf)}, ${n2(media(fuerte.gf, partidos))} por partido frente a ${n2(fuerte.ligaPP)} de la liga (tendencia, ${partidos} ${partidos === 1 ? "partido" : "partidos"}).`);
  if (flojo && flojo.dc > 0) frases.push(`Donde más sufre es en el ${flojo.franja.nombre}: ${veces(flojo.gc)} en contra, ${n2(media(flojo.gc, partidos))} por partido frente a ${n2(flojo.ligaContraPP)} de la liga (tendencia, ${partidos} ${partidos === 1 ? "partido" : "partidos"}).`);

  /* Antes y después del descanso. */
  const parte = (p: 1 | 2, k: "gf" | "gc") => filas.filter((f) => f.franja.parte === p).reduce((s, f) => s + f[k], 0);
  const gc1 = parte(1, "gc");
  const gf2 = parte(2, "gf");

  if (gc >= 3 && gc1 / gc >= 0.65) frases.push(`${gc1} de sus ${gc} goles en contra llegan en la primera parte.`);
  else if (gc >= 3 && gc1 / gc <= 0.35) frases.push(`${gc - gc1} de sus ${gc} goles en contra llegan en la segunda parte.`);

  if (gf >= 3 && gf2 / gf >= 0.65) frases.push(`Marca sobre todo en la segunda parte (${gf2} de ${gf}).`);
  else if (gf >= 3 && gf2 / gf <= 0.35) frases.push(`Marca sobre todo en la primera parte (${gf - gf2} de ${gf}).`);

  /* Los descuentos, si se separan y pasa algo en ellos. */
  const desc = filas.filter((f) => f.franja.descuento);
  const dgf = desc.reduce((s, f) => s + f.gf, 0);
  const dgc = desc.reduce((s, f) => s + f.gc, 0);

  if (desc.length && dgf + dgc > 0) frases.push(`En los descuentos: ${dgf} a favor y ${dgc} en contra.`);

  return frases;
}

/** Por qué rinde distinto en casa y fuera: puntos y la razón (volumen, puntería o defensa). */
export function lecturaCondicion(corto: string, cL: Condicion, cV: Condicion, lL: Condicion, lV: Condicion) {
  const frases: string[] = [];

  const una = (c: Condicion, l: Condicion, donde: string) => {
    if (!c.n) return;

    const p = frente(c.puntos, l.puntos);
    const juicio = p > 0 ? "por encima de" : p < 0 ? "por debajo de" : "en";
    let porque = "";

    if (c.nw) {
      if (p < 0 && frente(c.tiros, l.tiros) >= 0 && frente(c.precision, l.precision) < 0) porque = ` Remata ${n1(c.tiros)} veces por partido (liga ${n1(l.tiros)}) pero sólo ${n1(c.aPuerta)} a puerta (liga ${n1(l.aPuerta)}): falla la puntería, no el volumen.`;
      else if (p < 0 && frente(c.tiros, l.tiros) < 0) porque = ` Genera poco: ${n1(c.tiros)} remates por partido frente a ${n1(l.tiros)}.`;
      else if (p < 0 && frente(c.gc, l.gc) > 0) porque = ` Lo que pesa es lo que encaja: ${n2(c.gc)} por partido frente a ${n2(l.gc)}.`;
      else if (p < 0 && c.golesMenosXg < -0.3) porque = ` Marca menos de lo que generan sus ocasiones (${n2(c.golesMenosXg)} goles por partido por debajo de su xG).`;
      else if (p > 0 && frente(c.xg, l.xg) > 0) porque = ` Lo sostiene el volumen de ocasiones: ${n2(c.xg)} goles esperados (xG) por partido frente a ${n2(l.xg)}.`;
      else if (p > 0 && frente(c.gc, l.gc) < 0) porque = ` Lo sostiene la defensa: ${n2(c.gc)} goles en contra por partido frente a ${n2(l.gc)}.`;
    }

    frases.push(`${donde} suma ${n2(c.puntos)} puntos por partido, ${juicio} la media (${n2(l.puntos)}).${porque}`);
  };

  una(cL, lL, "En casa");
  una(cV, lV, "Fuera");

  return frases;
}

/** Cómo marca y cómo le marcan, con las dos o tres categorías que más pesan. */
export function lecturaTipologia(favor: Map<string, number>, contra: Map<string, number>, totalFavor: number, totalContra: number) {
  const frases: string[] = [];
  const porFase = (m: Map<string, number>) =>
    FASES.map((f) => ({ fase: f.fase, n: f.tipos.reduce((s, t) => s + (m.get(t.clave) ?? 0), 0) }))
      .filter((x) => x.n > 0)
      .sort((a, b) => b.n - a.n);
  const principales = (m: Map<string, number>) =>
    [...m]
      .filter(([, n]) => n > 0)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 2)
      .map(([t, n]) => `${NOMBRE_TIPO[t as TipoGol].toLowerCase()} (${n})`);
  const fase = (f: string) => (f === "AT. ORGANIZADO" ? "ataque organizado" : f === "TRANSICIÓN" ? "transición" : "balón parado");

  const pf = porFase(favor);
  const pc = porFase(contra);

  if (pf.length) frases.push(`A favor, ${pf[0].n} de ${totalFavor} en ${fase(pf[0].fase)}; lo que más se repite: ${principales(favor).join(" y ")}.`);
  if (pc.length) frases.push(`En contra, ${pc[0].n} de ${totalContra} en ${fase(pc[0].fase)}; lo que más se repite: ${principales(contra).join(" y ")}.`);

  return frases;
}

/** Qué pasa cuando marca primero y cuando recibe primero. */
export function lecturaPrimero(eq: ResumenPrimero, lg: ResumenPrimero) {
  const frases: string[] = [];
  const pts = (x: { n: number; G: number; E: number }) => media(x.G * 3 + x.E, x.n);

  if (eq.propio.n) {
    const f = frente(pts(eq.propio), pts(lg.propio));
    const dice = f < 0 ? "se le escapan ventajas" : f > 0 ? "sabe cerrar los partidos" : "como el resto";

    frases.push(`Cuando marca primero gana ${eq.propio.G} de ${eq.propio.n} (${n2(pts(eq.propio))} puntos por partido; la liga, ${n2(pts(lg.propio))}): ${dice}.`);
  }

  if (eq.rival.n) {
    const f = frente(pts(eq.rival), pts(lg.rival));
    const dice = f > 0 ? "remonta más que la media" : f < 0 ? "le cuesta reaccionar" : "reacciona como el resto";

    frases.push(`Cuando recibe primero saca ${n2(pts(eq.rival))} puntos por partido (la liga, ${n2(pts(lg.rival))}): ${dice}.`);
  }

  return frases;
}

/** El aviso de muestra corta. */
export const avisoMuestra = (partidos: number) => (partidos > 0 && partidos < 10 ? `Son ${partidos} partidos: un gol mueve mucho una franja, léelo como tendencia.` : "");

/* ------------------------------------------------------------------ */
/*  Lo importante: tres frases, cada una con su acción (24/10/2026)     */
/* ------------------------------------------------------------------ */

export type Importante = { texto: string; accion: string };

const TAREA_FINALIZACION = "finalización con oposición; criterio de éxito, remate entre los tres palos.";
const TAREA_DEFENSA = "defensa del área y del último tercio; criterio de éxito, ningún remate cómodo dentro del área.";
const TAREA_VENTAJA = "tarea de gestión del resultado en los últimos 15 minutos con ventaja.";

type EntradaImportante = {
  corto: string;
  partidos: number;
  gf: number;
  gc: number;
  ligaGF: number;
  ligaGC: number;
  filas: FilaFranja[];
  cL: Condicion;
  cV: Condicion;
  lL: Condicion;
  lV: Condicion;
  primeroEq: ResumenPrimero;
  primeroLg: ResumenPrimero;
  favor: Map<string, number>;
  contra: Map<string, number>;
  totalContra: number;
  /** Nuestros partidos: la tipología sólo existe para ellos. */
  conTipologia: boolean;
  /** Al equipo le falta algún partido jugado: los totales no son comparables con la liga. */
  incompleto: boolean;
};

/**
 * Las tres conclusiones que más pesan, cada una con la tarea que sale de ella.
 * Con partidos sin incluir no se comparan los goles a favor y en contra con la
 * media ni quién marca primero: un total al que le falta un partido invierte
 * la lectura. Quedan las que no dependen del total (tramos y tipología).
 */
export function loImportante(e: EntradaImportante): Importante[] {
  const filas: Importante[] = [];
  const base = (n: number) => `${n} ${n === 1 ? "partido" : "partidos"}`;

  if (e.partidos && !e.incompleto) {
    const a = frente(media(e.gf, e.partidos), e.ligaGF);
    const d = frente(media(e.gc, e.partidos), e.ligaGC);

    if (a < 0) filas.push({ texto: lecturaBalance(e.corto, e.partidos, e.gf, e.gc, e.ligaGF, e.ligaGC), accion: `Esta semana, ${TAREA_FINALIZACION}` });
    else if (d > 0) filas.push({ texto: lecturaBalance(e.corto, e.partidos, e.gf, e.gc, e.ligaGF, e.ligaGC), accion: `Esta semana, ${TAREA_DEFENSA}` });
  }

  const { flojo, fuerte } = tramosClave(e.filas);

  if (flojo) {
    const nombre = flojo.franja.nombre;

    filas.push({
      texto: `Donde más sufre es en el ${nombre}: ${veces(flojo.gc)} en contra, ${n2(media(flojo.gc, e.partidos))} por partido frente a ${n2(flojo.ligaContraPP)} de la liga${flojo.gc <= 3 ? ` (tendencia, ${base(e.partidos)})` : ""}.`,
      accion: flojo.franja.parte === 2 && flojo.franja.desde >= 61 ? `Esta semana, ${TAREA_VENTAJA}` : `Esta semana, tarea de concentración y de ajuste defensivo en el tramo ${nombre}, con el partido en marcha.`,
    });
  } else if (fuerte) {
    filas.push({
      texto: `Su mejor tramo es el ${fuerte.franja.nombre}: ${veces(fuerte.gf)}, ${n2(media(fuerte.gf, e.partidos))} por partido frente a ${n2(fuerte.ligaPP)} de la liga${fuerte.gf <= 3 ? ` (tendencia, ${base(e.partidos)})` : ""}.`,
      accion: `Esta semana, repetir en el entrenamiento lo que ocurre en el tramo ${fuerte.franja.nombre} y llevarlo a otros momentos del partido.`,
    });
  }

  const condicion = lecturaCondicion(e.corto, e.cL, e.cV, e.lL, e.lV).find((f) => f.includes("por debajo de"));

  if (condicion) {
    const accion = condicion.includes("falla la puntería")
      ? TAREA_FINALIZACION
      : condicion.includes("Genera poco")
        ? "llegadas al área con superioridad en el último tercio; criterio de éxito, tres remates desde dentro del área."
        : condicion.includes("lo que encaja")
          ? TAREA_DEFENSA
          : "revisar con el vídeo qué cambia entre sus partidos como local y como visitante y llevarlo a la tarea de la semana.";

    filas.push({ texto: condicion, accion: `Esta semana, ${accion}` });
  }

  if (!e.incompleto && e.primeroEq.propio.n && frente(media(e.primeroEq.propio.G * 3 + e.primeroEq.propio.E, e.primeroEq.propio.n), media(e.primeroLg.propio.G * 3 + e.primeroLg.propio.E, e.primeroLg.propio.n)) < 0) {
    filas.push({ texto: lecturaPrimero(e.primeroEq, e.primeroLg)[0], accion: `Esta semana, ${TAREA_VENTAJA}` });
  }

  if (e.conTipologia && e.totalContra > 0) {
    const frases = lecturaTipologia(e.favor, e.contra, 0, e.totalContra);
    const enContra = frases.find((f) => f.startsWith("En contra"));

    if (enContra) {
      const fase = enContra.includes("balón parado") ? "las acciones de balón parado defensivo" : enContra.includes("transición") ? "la transición defensiva tras pérdida" : "la defensa del ataque organizado del rival";

      filas.push({ texto: enContra, accion: `Esta semana, trabajar ${fase}, que es de donde más le llega.` });
    }
  }

  return filas.slice(0, 3);
}
