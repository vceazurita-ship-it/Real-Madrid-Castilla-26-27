/**
 * PROYECCIÓN DE LA JORNADA · EL JUEGO (12/11/2026).
 *
 * Lo mismo que `abp.ts`, para el juego: posesión, xG, remates, toques en el
 * área, centros, presión (PPDA), recuperaciones arriba y contraataques. Cada
 * cifra con el cruce de `base.ts` (A · D / L · H; la posesión en logit), el
 * porqué con su base, los puntos fuertes y débiles cruzados (su debilidad ×
 * nuestra fortaleza = ventaja; al revés, riesgo), el tipo de partido y dónde
 * hay más ventaja, con su consigna.
 *
 * Fuentes: Opta por partido (`opta:partidos`) y, para los contraataques,
 * Wyscout (Team Stats de `analisis.json`). Funciones puras.
 */

import { extremosDe, medianaLiga, puestoEnLiga, type PuestoEnLiga } from "@/lib/rivals/puesto-liga";

import type { PresionTemporada } from "./presion";
import { antesDe, coma, frenteA, liga, pct, proyecta, type Liga, type Proyeccion, type Tabla } from "./base";

export type ClaveJuego = "Poss%" | "ExpG" | "ShtIncBl" | "TouchOpBox" | "Crosses" | "PPDA" | "PosWonA3rd" | "wContra";

export type MetricaJuego = {
  clave: ClaveJuego;
  nombre: string;
  /** Cuántos decimales se enseñan. */
  dec: number;
  cuota?: boolean;
  /** true: más es mejor para el que lo hace; null: estilo (no entra en ventajas). */
  bueno: boolean | null;
  fuente: "Opta" | "Wyscout";
  comoLeer: string;
};

export const METRICAS_JUEGO: MetricaJuego[] = [
  { clave: "Poss%", nombre: "Posesión", dec: 0, cuota: true, bueno: null, fuente: "Opta", comoLeer: "Parte del tiempo con el balón." },
  { clave: "ExpG", nombre: "xG", dec: 2, bueno: true, fuente: "Opta", comoLeer: "Goles esperados de los remates (sin contar si entran)." },
  { clave: "ShtIncBl", nombre: "Remates", dec: 1, bueno: true, fuente: "Opta", comoLeer: "Remates, también los bloqueados." },
  { clave: "TouchOpBox", nombre: "Toques en el área rival", dec: 1, bueno: true, fuente: "Opta", comoLeer: "Veces que se toca el balón dentro del área contraria." },
  { clave: "Crosses", nombre: "Centros", dec: 1, bueno: null, fuente: "Opta", comoLeer: "Centros al área. Es estilo: ni mejor ni peor." },
  { clave: "PPDA", nombre: "PPDA (presión)", dec: 1, bueno: null, fuente: "Opta", comoLeer: "Pases que se deja dar al rival por cada acción defensiva: cuanto más bajo, más se presiona." },
  { clave: "PosWonA3rd", nombre: "Recuperaciones en el último tercio", dec: 1, bueno: true, fuente: "Opta", comoLeer: "Balones recuperados cerca de la portería rival (lo que concede el otro: sus pérdidas cerca de su área)." },
  { clave: "wContra", nombre: "Contraataques", dec: 1, bueno: true, fuente: "Wyscout", comoLeer: "Ataques rápidos tras recuperar (Wyscout)." },
];

export type LineaJuego = {
  metrica: MetricaJuego;
  favor: Proyeccion;
  contra: Proyeccion;
  liga: number;
  real?: { favor: number | null; contra: number | null };
};

export type PuntoJuego = {
  clave: ClaveJuego;
  quien: "nos" | "riv";
  clase: "fuerte" | "debil";
  indice: number;
  frase: string;
};

export type VentajaJuego = {
  clave: ClaveJuego;
  indice: number;
  valor: number;
  frase: string;
  consigna: string;
  /** «Qué entrenamos»: la tarea y el objetivo, con la mediana del grupo (16/11/2026, regla 14). */
  entrena: string;
};

/** Una fila de «Por qué»: lo nuestro, lo del rival y la media, con su sentido. */
export type FilaPorque = {
  cifra: string;
  /** «más, mejor» · «menos, mejor» · «estilo». */
  sentido: string;
  nosotros: string;
  /** Qué es la cifra del rival en esa fila («concede», «hace», «sus rivales tienen»). */
  rivalEs: string;
  rival: string;
  media: string;
  esperado: string;
  consecuencia: string;
};

/** Una fase del juego: cómo sale, cómo transita. */
export type FaseJuego = { titulo: string; frase: string; consigna: string };

export type ProyeccionJuego = {
  lineas: LineaJuego[];
  tipoPartido: string[];
  porque: string[];
  suFuerte: PuntoJuego | null;
  suDebil: PuntoJuego | null;
  nuestroFuerte: PuntoJuego | null;
  nuestroDebil: PuntoJuego | null;
  ventajas: VentajaJuego[];
  riesgos: VentajaJuego[];
  /** La presión esperada frente a su PPDA de la temporada (la misma escala, Opta). */
  contraste: string | null;
  /** Su PPDA de la temporada con su puesto: la cifra principal (Opta), la misma de Plantillas rivales. */
  presion: PresionTemporada | null;
  /** El «Por qué» de las tres cifras grandes, en tabla. */
  porqueTabla: FilaPorque[];
  /** Una línea visible de cómo sale lo esperado (con el ejemplo de la posesión). */
  comoSeCalcula: string;
  /** Salida y transición de los dos. */
  fases: FaseJuego[];
  partidos: { nos: number; riv: number };
  hasta: string;
};

export type EntradaJuego = {
  tabla: Tabla;
  nos: string;
  riv: string;
  nosLocal: boolean | null;
  nombreRival: string;
  antesDe?: string | null;
  /** Su PPDA de la temporada, la cifra principal del área (lib/proyeccion/presion.ts). */
  presion?: PresionTemporada | null;
};

const fmt = (m: MetricaJuego, v: number | null | undefined) => (m.cuota ? pct(v ?? null) : coma(v ?? null, m.dec));

/*
| El puesto, con la cuenta común del rival (lib/rivals/puesto-liga.ts, 16/11/2026):
| la misma de Plantillas, Scout colectivo y Área. Con `mejorAlto` = true, 1.º el
| que más hace (o el que más concede, en `concede`).
*/
function puestoDe(L: Liga, equipo: string, lado: "propio" | "concede"): PuestoEnLiga | null {
  const yo = L.porEquipo.get(equipo);
  const v = lado === "propio" ? yo?.propio : yo?.concede;
  if (v == null || !Number.isFinite(v)) return null;
  const todos = [...L.porEquipo.values()].map((x) => (lado === "propio" ? x.propio : x.concede)).filter((x): x is number => x != null && Number.isFinite(x));
  return puestoEnLiga(v, todos, true);
}

/** Entre los 6 de 20 que más (los extremos de la cuenta común) y fuera de la mediana. */
const enElExtremo = (p: PuestoEnLiga | null) => Boolean(p && p.lectura === "fuerte" && p.puesto <= extremosDe(p.de));

/** La base de una cifra: su fuente y cuántos partidos hay detrás («Opta, 12 partidos»). */
const base = (m: MetricaJuego, n: number) => `(${m.fuente}, ${n} ${n === 1 ? "partido" : "partidos"})`;

function masUno(dia: string) {
  const d = Date.parse(`${dia}T12:00:00Z`);
  return Number.isFinite(d) ? new Date(d + 86_400_000).toISOString().slice(0, 10) : dia;
}

export function proyeccionJuego(e: EntradaJuego): ProyeccionJuego | null {
  const t = antesDe(e.tabla, e.antesDe ?? null);
  const { nos, riv, nombreRival: R } = e;
  const rivLocal = e.nosLocal == null ? null : !e.nosLocal;

  const lineas: LineaJuego[] = [];
  for (const m of METRICAS_JUEGO) {
    const L = liga(t, m.clave);
    if (!L) continue;
    const escala = m.cuota ? ("cuota" as const) : ("conteo" as const);
    const favor = proyecta(t, { ataca: nos, defiende: riv, local: e.nosLocal, metrica: m.clave, escala });
    const contra = proyecta(t, { ataca: riv, defiende: nos, local: rivLocal, metrica: m.clave, escala });
    /* Sin partidos de alguno de los dos (Wyscout no siempre está), la métrica no sale. */
    if (!favor || !contra || !favor.ataque.n || !favor.defensa.n) continue;
    lineas.push({ metrica: m, favor, contra, liga: L.media });
  }
  if (!lineas.length) return null;

  if (e.antesDe) {
    const dia = e.antesDe.slice(0, 10);
    const nuestra = e.tabla.filas.find((f) => f.equipo === nos && f.fecha >= dia && f.fecha <= masUno(dia) && e.tabla.contra.get(f)?.equipo === riv);
    const suya = nuestra ? e.tabla.contra.get(nuestra) : undefined;
    if (nuestra && suya) for (const l of lineas) l.real = { favor: nuestra.v[l.metrica.clave] ?? null, contra: suya.v[l.metrica.clave] ?? null };
  }

  const de = (c: ClaveJuego) => lineas.find((l) => l.metrica.clave === c);
  const pos = de("Poss%");
  const xg = de("ExpG");
  const rem = de("ShtIncBl");
  const ppda = de("PPDA");

  /* ------------------------ tipo de partido ------------------------ */
  const tipo: string[] = [];
  if (pos) {
    const p = pos.favor.valor;
    tipo.push(
      p >= 0.58
        ? `Dominio nuestro con balón (${pct(p)} de posesión esperada): el ${R} esperará y saldrá a la contra.`
        : p >= 0.53
          ? `Más balón nuestro que suyo (${pct(p)} de posesión esperada).`
          : p > 0.47
            ? `Posesión repartida (${pct(p)} para nosotros).`
            : p > 0.42
              ? `Más balón suyo que nuestro (${pct(p)} de posesión esperada para nosotros).`
              : `Dominio suyo con balón (${pct(p)} para nosotros): tocará defender y correr.`,
    );
  }
  if (xg) {
    const totalXg = xg.favor.valor + xg.contra.valor;
    const ref = 2 * xg.liga;
    const d = totalXg / ref - 1;
    tipo.push(
      d >= 0.12
        ? `Partido abierto: ${coma(totalXg, 2)} xG entre los dos, ${frenteA(totalXg, ref)} de un partido del grupo.`
        : d <= -0.12
          ? `Partido cerrado: ${coma(totalXg, 2)} xG entre los dos, ${frenteA(totalXg, ref)} de un partido del grupo.`
          : `Partido de ocasiones normales: ${coma(totalXg, 2)} xG entre los dos (un partido del grupo da ${coma(ref, 2)}).`,
    );
  }
  if (ppda) {
    const suya = ppda.contra.valor;
    const nuestra = ppda.favor.valor;
    const L = ppda.liga;
    const frase =
      suya <= 0.88 * L
        ? `El ${R} apretará arriba: PPDA esperado ${coma(suya)} (media ${coma(L)}; más bajo, más presión).`
        : suya >= 1.12 * L
          ? `El ${R} nos esperará en bloque: PPDA esperado ${coma(suya)} (media ${coma(L)}).`
          : `PPDA esperado del ${R} contra nosotros: ${coma(suya)} (media del grupo ${coma(L)}; más bajo, más presión).`;
    tipo.push(`${frase} El nuestro, ${coma(nuestra)}.`);
  }
  /* El estilo del rival con el balón: balón largo frente al grupo. */
  const Ld = liga(t, "directo");
  const dirRiv = Ld?.porEquipo.get(riv)?.propio ?? null;
  if (Ld && dirRiv != null) {
    const d = dirRiv / Ld.media - 1;
    if (Math.abs(d) >= 0.15)
      tipo.push(
        d > 0
          ? `El ${R} juega directo: ${pct(dirRiv)} de sus pases son en largo (grupo ${pct(Ld.media)}). Segundas jugadas y duelo aéreo.`
          : `El ${R} combina: sólo ${pct(dirRiv)} de sus pases son en largo (grupo ${pct(Ld.media)}). Saldrá jugando desde atrás.`,
      );
  }

  /* --------------------------- puntos ---------------------------- */
  const cand: PuntoJuego[] = [];
  for (const l of lineas) {
    if (!l.metrica.bueno) continue;
    const L = liga(t, l.metrica.clave);
    if (!L) continue;
    const sitio = (equipo: string, lado: "propio" | "concede") => {
      const p = puestoDe(L, equipo, lado);
      return p ? `${p.puesto}.º que más ${lado === "propio" ? "genera" : "concede"} de ${p.de}` : "";
    };
    const f = (v: number) => fmt(l.metrica, v);
    /*
    | Una sola variable por cifra (lo de la temporada, por partido), en ese
    | sentido frente a la media y, desde el 16/11/2026, entre los 6 extremos de
    | 20: un 7.º de 20 no es «su punto débil».
    */
    const mete = (quien: "nos" | "riv", clase: "fuerte" | "debil", r: { temporada: number | null; n: number }, frase: (v: string) => string) => {
      if (r.temporada == null || !(r.temporada > l.liga)) return;
      const equipo = quien === "nos" ? nos : riv;
      const lado = clase === "fuerte" ? "propio" : "concede";
      if (!enElExtremo(puestoDe(L, equipo, lado))) return;
      cand.push({ clave: l.metrica.clave, quien, clase, indice: r.temporada / l.liga, frase: `${frase(f(r.temporada))} ${base(l.metrica, r.n)}` });
    };
    mete("riv", "fuerte", l.contra.ataque, (v) => `${l.metrica.nombre}: el ${R} hace ${v} por partido (media ${f(l.liga)}; ${sitio(riv, "propio")}).`);
    mete("riv", "debil", l.favor.defensa, (v) => `${l.metrica.nombre}: el ${R} concede ${v} por partido (media ${f(l.liga)}; ${sitio(riv, "concede")}).`);
    mete("nos", "fuerte", l.favor.ataque, (v) => `${l.metrica.nombre}: hacemos ${v} por partido (media ${f(l.liga)}; ${sitio(nos, "propio")}).`);
    mete("nos", "debil", l.contra.defensa, (v) => `${l.metrica.nombre}: concedemos ${v} por partido (media ${f(l.liga)}; ${sitio(nos, "concede")}).`);
  }
  const elige = (quien: "nos" | "riv", clase: "fuerte" | "debil") => cand.filter((c) => c.quien === quien && c.clase === clase).sort((a, b) => b.indice - a.indice)[0] ?? null;

  /* --------------------------- ventajas -------------------------- */
  const ventajas: VentajaJuego[] = [];
  const riesgos: VentajaJuego[] = [];
  for (const l of lineas) {
    if (!l.metrica.bueno) continue;
    const m = l.metrica;
    /* La misma cifra que «Su punto fuerte / débil»: lo de la temporada por partido. */
    const dT = l.favor.defensa.temporada;
    const aT = l.contra.ataque.temporada;
    const D = fmt(m, dT);
    const A = fmt(m, aT);
    const Lm = fmt(m, l.liga);
    const cv: Record<string, string> = {
      ExpG: `Generar remates de calidad: el ${R} concede ${D} xG por partido (media ${Lm}). Llegar al área con gente en vez de rematar de lejos.`,
      ShtIncBl: `Terminar las jugadas: al ${R} le rematan ${D} veces por partido (media ${Lm}).`,
      TouchOpBox: `Pisar su área: concede ${D} toques en su área por partido (media ${Lm}). Llegadas de segunda línea.`,
      PosWonA3rd: `Presionar su salida: le recuperan ${D} balones en su último tercio por partido (media ${Lm}). Apretar su primer pase.`,
      wContra: `Correr al robo: concede ${D} contraataques por partido (media ${Lm}).`,
    };
    const cr: Record<string, string> = {
      ExpG: `Cerrar el área: el ${R} genera ${A} xG por partido (media ${Lm}).`,
      ShtIncBl: `Limitar sus remates: el ${R} remata ${A} veces por partido (media ${Lm}).`,
      TouchOpBox: `Defender el área: el ${R} da ${A} toques en el área rival por partido (media ${Lm}).`,
      PosWonA3rd: `Cuidar la salida de balón: el ${R} recupera ${A} balones en el último tercio por partido (media ${Lm}).`,
      wContra: `Vigilancias ante pérdida: el ${R} sale a la contra ${A} veces por partido (media ${Lm}).`,
    };
    /*
    | Un punto sólo es ventaja (o riesgo) si las dos cifras van en ese sentido
    | frente a la media —lo que concede él (o hace él) en la temporada y lo
    | esperado del partido— y, desde el 16/11/2026 (jueces), si él está entre
    | los 6 de 20 que más lo conceden (o que más lo hacen): un 7.º no es ventaja.
    */
    const Lq = liga(t, m.clave);
    const pD = Lq ? puestoDe(Lq, riv, "concede") : null;
    const pA = Lq ? puestoDe(Lq, riv, "propio") : null;
    const mediana = Lq ? medianaLiga([...Lq.porEquipo.values()].map((x) => x.propio)) : l.liga;
    const dePuesto = (p: PuestoEnLiga | null, que: string) => (p ? `; ${p.puesto}.º que más ${que} de ${p.de}` : "");
    const ev: Record<string, string> = {
      ExpG: "finalización dentro del área tras pase atrás",
      ShtIncBl: "llegada con remate en ataque posicional y rechaces",
      TouchOpBox: "ataque del área con tres o cuatro y llegada de segunda línea",
      PosWonA3rd: "presión a su primer pase y tras pérdida (rondos de presión de 6-8 s)",
      wContra: "transición tras robo: atacar el espacio en tres pases",
    };
    const er: Record<string, string> = {
      ExpG: "defensa del área y del pase atrás",
      ShtIncBl: "cierre del tiro y bloqueo",
      TouchOpBox: "defensa del área con vigilancias en el último tercio",
      PosWonA3rd: "salida de balón bajo presión alta (superioridad y tercer hombre)",
      wContra: "vigilancias 2+1 y contrapresión",
    };
    if (dT != null && dT > l.liga && l.favor.valor > l.liga && cv[m.clave] && enElExtremo(pD))
      ventajas.push({
        clave: m.clave,
        indice: l.favor.valor / l.liga,
        valor: l.favor.valor,
        frase: `${m.nombre}: ${fmt(m, l.favor.valor)} esperados (${frenteA(l.favor.valor, l.liga)} del grupo${dePuesto(pD, "concede")}). ${base(m, l.favor.defensa.n)}`,
        consigna: cv[m.clave],
        entrena: `Qué entrenamos: ${ev[m.clave]}. Objetivo: ${fmt(m, Math.max(l.favor.valor, l.favor.ataque.temporada ?? 0, mediana))} ${m.nombre.toLowerCase()} o más (nunca por debajo de lo que ya hacemos, ${fmt(m, l.favor.ataque.temporada)}; mediana del grupo ${fmt(m, mediana)}).`,
      });
    if (aT != null && aT > l.liga && l.contra.valor > l.liga && cr[m.clave] && enElExtremo(pA))
      riesgos.push({
        clave: m.clave,
        indice: l.contra.valor / l.liga,
        valor: l.contra.valor,
        frase: `${m.nombre} del ${R}: ${fmt(m, l.contra.valor)} esperados (${frenteA(l.contra.valor, l.liga)} del grupo${dePuesto(pA, "hace")}). ${base(m, l.contra.ataque.n)}`,
        consigna: cr[m.clave],
        entrena: `Qué entrenamos: ${er[m.clave]}. Objetivo: dejarle en ${fmt(m, mediana)} o menos (la mediana del grupo).`,
      });
  }
  ventajas.sort((a, b) => b.indice - a.indice);
  riesgos.sort((a, b) => b.indice - a.indice);

  /* ------------------ contraste de la presión ------------------- */
  /* El PPDA esperado sale del cruce (su presión × lo que a nosotros nos dejan), así que puede
     no parecerse a su cifra de la temporada: se dice por qué, con la misma escala. */
  let contraste: string | null = null;
  if (ppda) {
    const propio = ppda.contra.ataque.temporada;
    const nosDejan = ppda.contra.defensa.temporada;
    if (propio != null && nosDejan != null) {
      const dif = ppda.contra.valor / propio - 1;
      /* Una frase y sin otra cifra de temporada (16/11/2026, jueces): la principal es la de arriba (Opta, presion). */
      contraste =
        Math.abs(dif) >= 0.05
          ? `Contra nosotros se espera un PPDA de ${coma(ppda.contra.valor)} en este partido: al Castilla sus rivales le presionan ${nosDejan > ppda.liga ? "menos" : "más"} que a la media del grupo.`
          : null;
    }
  }

  /* ---------------------------- fases ---------------------------- */
  /* Cómo sale cada uno ante la presión del otro y cómo transita (16/11/2026, jueces de fútbol).
     La orden sólo sale si la cifra de encima la sostiene (un 10 % o más sobre la media); si no, queda el dato. */
  const fases: FaseJuego[] = [];
  const rec = de("PosWonA3rd");
  const con = de("wContra");
  const LdF = liga(t, "directo");
  const dirR = LdF?.porEquipo.get(riv)?.propio ?? null;
  if (rec) {
    const v = rec.favor.valor;
    const largo = LdF && dirR != null ? ` Juega en largo el ${pct(dirR)} de sus pases (grupo ${pct(LdF.media)}).` : "";
    fases.push({
      titulo: "Su salida ante nuestra presión",
      frase: `Le recuperaremos ${coma(v)} balones en su último tercio (media ${coma(rec.liga)}; a él le recuperan ${coma(rec.favor.defensa.temporada)} por partido ahí). ${base(rec.metrica, rec.favor.defensa.n)}${largo}`,
      consigna:
        v > rec.liga * 1.1
          ? "Presionar su salida: apretar el primer pase y el perfil del receptor."
          : LdF && dirR != null && dirR > LdF.media * 1.15
            ? "Si salta la presión, saldrá en largo: ganar el duelo y la segunda jugada."
            : "",
    });
  }
  if (ppda || rec) {
    const presion = ppda ? `PPDA esperado del ${R} ${coma(ppda.contra.valor)} (media ${coma(ppda.liga)})` : "";
    const robos = rec ? `nos recuperará ${coma(rec.contra.valor)} balones en nuestro último tercio (media ${coma(rec.liga)})` : "";
    fases.push({
      titulo: "Nuestra salida ante su presión",
      frase: `${[presion, robos].filter(Boolean).join("; ")}. (Opta, ${(rec ?? ppda)!.contra.ataque.n} partidos)`,
      consigna:
        rec && rec.contra.valor > rec.liga * 1.1
          ? "Salir con superioridad atrás y tercer hombre; no regalar el pase al pivote de espaldas."
          : "",
    });
  }
  if (con) {
    fases.push({
      titulo: "Su transición",
      frase: `Se esperan ${coma(con.contra.valor)} contraataques suyos (media ${coma(con.liga)}). ${base(con.metrica, con.contra.ataque.n)}`,
      consigna: con.contra.valor > con.liga * 1.1 ? "Vigilancias 2+1 con balón y contrapresión de 5-6 s tras pérdida." : "",
    });
    fases.push({
      titulo: "Nuestra transición",
      frase: `Se esperan ${coma(con.favor.valor)} contraataques nuestros (media ${coma(con.liga)}). ${base(con.metrica, con.favor.defensa.n)}`,
      consigna: con.favor.valor > con.liga * 1.1 ? "Al robo, atacar el espacio a su espalda en tres pases." : "",
    });
  }

  /* --------------------------- porqué ---------------------------- */
  /*
  | En tabla (16/11/2026, jueces): nosotros, el rival y la media, con el
  | sentido de cada fila y lo esperado, en vez de párrafos de seis cifras.
  */
  const porqueTabla: FilaPorque[] = [];
  const fila = (l: LineaJuego, a_favor: boolean): FilaPorque => {
    const m = l.metrica;
    const p = a_favor ? l.favor : l.contra;
    return {
      cifra: m.cuota ? m.nombre : `${m.nombre} ${a_favor ? "a favor" : "en contra"}`,
      sentido: m.bueno === null ? "estilo" : a_favor ? "más, mejor" : "menos, mejor",
      nosotros: fmt(m, a_favor ? l.favor.ataque.temporada : l.contra.defensa.temporada),
      rivalEs: m.cuota ? "sus rivales tienen" : a_favor ? "concede" : "hace",
      rival: fmt(m, a_favor ? l.favor.defensa.temporada : l.contra.ataque.temporada),
      media: fmt(m, l.liga),
      esperado: fmt(m, p.valor),
      consecuencia: frenteA(p.valor, l.liga),
    };
  };
  if (pos) porqueTabla.push(fila(pos, true));
  if (xg) porqueTabla.push(fila(xg, true), fila(xg, false));
  if (rem) porqueTabla.push(fila(rem, true), fila(rem, false));
  const comoSeCalcula = pos
    ? `Cómo sale lo esperado: lo nuestro se cruza con lo que concede el rival y se compara con la media del grupo. Por eso la posesión queda en ${pct(pos.favor.valor)} aunque tengamos ${pct(pos.favor.ataque.temporada)} de media: contra el ${R} sus rivales tienen ${pct(pos.favor.defensa.temporada)}.`
    : "Cómo sale lo esperado: lo nuestro se cruza con lo que concede el rival y se compara con la media del grupo.";
  const porque: string[] = [];
  if (e.nosLocal != null && xg && Math.abs(xg.favor.H - 1) >= 0.03)
    porque.push(
      `Jugamos ${e.nosLocal ? "en casa" : "fuera"}: en el grupo, el ${e.nosLocal ? "local" : "visitante"} genera un ${Math.round(Math.abs(xg.favor.H - 1) * 100)} % ${xg.favor.H > 1 ? "más" : "menos"} de xG que la media.`,
    );
  const cambios: string[] = [];
  for (const l of lineas) {
    if (!l.metrica.bueno) continue;
    const a = l.contra.ataque;
    if (a.cambio && a.ultimos != null && a.previos != null)
      cambios.push(`el ${R} ${a.cambio === "sube" ? "genera más" : "genera menos"} ${l.metrica.nombre === "xG" ? "xG" : l.metrica.nombre.toLowerCase()} (${fmt(l.metrica, a.ultimos)} en los últimos 5, ${fmt(l.metrica, a.previos)} antes)`);
    const d = l.favor.defensa;
    if (d.cambio && d.ultimos != null && d.previos != null)
      cambios.push(`el ${R} ${d.cambio === "sube" ? "concede más" : "concede menos"} ${l.metrica.nombre === "xG" ? "xG" : l.metrica.nombre.toLowerCase()} (${fmt(l.metrica, d.ultimos)} en los últimos 5, ${fmt(l.metrica, d.previos)} antes)`);
  }
  if (cambios.length) porque.push(`Tendencia: ${cambios.slice(0, 2).join("; ")}.`);

  return {
    lineas,
    tipoPartido: tipo,
    porque: porque.slice(0, 5),
    suFuerte: elige("riv", "fuerte"),
    suDebil: elige("riv", "debil"),
    nuestroFuerte: elige("nos", "fuerte"),
    nuestroDebil: elige("nos", "debil"),
    ventajas,
    riesgos,
    contraste,
    presion: e.presion ?? null,
    porqueTabla,
    comoSeCalcula,
    fases,
    partidos: { nos: lineas[0].favor.ataque.n, riv: lineas[0].contra.ataque.n },
    hasta: t.filas.reduce((m, f) => (f.fecha > m ? f.fecha : m), ""),
  };
}

export const COMO_SE_CUENTA_JUEGO: string[] = [
  "Fuente: Opta, partido a partido, de los 20 equipos de nuestro grupo de Primera RFEF; los contraataques y el campo (local o visitante), de los Team Stats de Wyscout.",
  "Cada cifra: lo que hace el que ataca por partido × lo que concede el que defiende ÷ la media del grupo × el efecto del campo. Las tasas pesan más los últimos partidos (el de hace 8 jornadas, la mitad que el último) y se acercan a la media del grupo tanto más cuanto menos se distinguen los equipos en esa cifra.",
  "Medido en el grupo (140 casos del 25/09 al 08/11, cada uno proyectado con lo de antes): la posesión acierta un 15 % más que la media del grupo, los remates un 16 % y el xG un 4 %; el intervalo del 80 % recoge entre el 81 % y el 89 % de los casos.",
  "Posesión: el mismo cruce en razón de probabilidades (logit), para que los dos sumen el 100 %.",
  "Tipo de partido: posesión esperada; abierto o cerrado según el xG de los dos frente a un partido normal del grupo (±12 %); la presión, por el PPDA esperado (±12 % de la media); el estilo, por la parte de pases en largo del rival.",
  "Puestos: la cuenta común del rival (lib/rivals/puesto-liga.ts). Su punto fuerte o débil, una ventaja o un riesgo sólo entran si el rival está entre los 6 de 20 que más lo hacen (o que más lo conceden).",
  "Ventaja: lo que esperamos hacer frente a la media del grupo (su debilidad × nuestra fortaleza). Sólo entra si las dos cifras van a favor: lo que el rival concede en la temporada, por encima de la media, y lo esperado del partido, también por encima. Riesgo: lo mismo del rival (lo que hace él y lo esperado, los dos por encima de la media).",
  "La cifra por partido de «Su punto fuerte / débil» y la de las consignas es la misma: la media de la temporada (con su fuente y sus partidos al lado). La proyección es otra cifra y se llama «esperados».",
  "El intervalo es del 80 %: suma lo que varía un equipo de un partido a otro y la duda de las tasas.",
];
