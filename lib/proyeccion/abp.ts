/**
 * PROYECCIÓN DE LA JORNADA · BALÓN PARADO (12/11/2026).
 *
 * Pedido por el analista: «que nos dé una proyección de la cantidad de
 * acciones de ABP que va a darse en el partido, por qué, dónde están los
 * puntos más fuertes y más débiles del rival según lo que es él y lo que somos
 * nosotros, con la tendencia de los últimos partidos, el tipo de partido y
 * dónde podemos sacar más ventaja».
 *
 * CÓMO SE CUENTA (lo mismo sale plegado en la pantalla, `COMO_SE_CUENTA_ABP`):
 *
 * 1. **Cuántas acciones.** Para cada tipo (córner, falta lateral, falta
 *    directa, saque de banda en campo rival, penalti) y cada lado:
 *    λ = A · D / L · H (ver `base.ts`), con A y D ponderadas hacia los últimos
 *    partidos (semivida de 8) y encogidas hacia la media del grupo tanto como
 *    poco se distingan los equipos en esa cifra (Bayes empírico, `fiabilidad`).
 *    H es el campo: lo que el local o el visitante sacan en el grupo frente a
 *    la media.
 *
 *    MEDIDO (12/11/2026, 140 casos del grupo del 25/09 al 08/11, cada uno con
 *    lo de antes): en los córners, las bandas y las faltas laterales de UN
 *    partido los equipos apenas se distinguen todavía (el error es el de la
 *    media del grupo), así que la cifra queda cerca de la media y el intervalo
 *    es ancho; en el xG de córner, un 4 % mejor que la media. Lo que sí separa
 *    a los equipos es lo que sale de cada acción: por eso el peso del informe
 *    va en el xG por acción y en las zonas.
 * 2. **El tipo de partido.** La posesión esperada (el mismo cruce en logit) y
 *    la recta del grupo «acciones según posesión»: pesa tanto como explique
 *    (su r²) y nunca más de un 30 %. En los córners explica algo (r² ≈ 0,1);
 *    en las faltas y los penaltis, nada, y no cuenta.
 * 3. **Qué sale de ellas.** Remates y xG por acción del que ataca y del que
 *    defiende (toda la temporada, encogidos con 15 acciones de la media) y el
 *    mismo cruce: xG esperado = acciones × xG por acción (A) × (D) ÷ (L).
 * 4. **Dónde.** Ventaja = nuestro xG esperado de un tipo frente a la media del
 *    grupo (1,3 = un 30 % más de lo normal). Riesgo, lo mismo del rival.
 *    «Tendencia» cuando detrás hay menos de 15 acciones.
 *
 * Funciones puras: se prueban en Node con los datos de Supabase leídos por GET.
 */

import type { Remate, Saque } from "@/lib/opta-eventos";
import { rematadores } from "@/lib/opta-abp-dia";

import {
  antesDe,
  coma,
  conTipoDePartido,
  encoge,
  frenteA,
  liga,
  pct,
  proyecta,
  puestoEn,
  rango,
  recta,
  resume,
  serie,
  type FilaPartido,
  type Proyeccion,
  type Tabla,
} from "./base";
import { TIPOS_ABP, type TipoAbp } from "./fuentes";

/** Por debajo de esto, lo que se dice es «tendencia». */
export const MUESTRA_MIN = 15;
/** Acciones de la media que se suman a cada equipo al medir lo que sale de ellas. */
export const K_ACCIONES = 15;

export const NOMBRE_ABP: Record<TipoAbp, string> = {
  corner: "Córners",
  faltaLateral: "Faltas laterales al área",
  faltaDirecta: "Tiros de falta directa",
  bandaRival: "Saques de banda en campo rival",
  penalti: "Penaltis",
};

const SINGULAR: Record<TipoAbp, string> = {
  corner: "córner",
  faltaLateral: "falta lateral",
  faltaDirecta: "falta directa",
  bandaRival: "saque de banda en su campo",
  penalti: "penalti",
};

export type Conversion = {
  remates: number;
  xG: number;
  /** xG por acción de quien ataca y de lo que concede quien defiende (encogidos). */
  xGAccionAtaque: number;
  xGAccionDefensa: number;
  xGAccionLiga: number;
  remAccionAtaque: number;
  remAccionDefensa: number;
  remAccionLiga: number;
  accionesAtaque: number;
  accionesDefensa: number;
  tendencia: boolean;
};

export type LadoAbp = {
  acciones: Proyeccion;
  conversion: Conversion;
  /** Muestra corta: menos de 15 acciones detrás de A o de D. */
  tendencia: boolean;
};

export type LineaAbp = {
  tipo: TipoAbp;
  nombre: string;
  favor: LadoAbp;
  contra: LadoAbp;
  /** Media del grupo por equipo y partido. */
  liga: number;
  ligaXG: number;
  real?: { favor: number | null; contra: number | null; xGFavor: number | null; xGContra: number | null };
};

export type Punto = {
  tipo: TipoAbp;
  quien: "nos" | "riv";
  /** «fuerte» = lo que hace; «débil» = lo que concede. */
  clase: "fuerte" | "debil";
  /** Frente a la media del grupo (1,25 = un 25 % más). */
  indice: number;
  puesto: { puesto: number; de: number } | null;
  frase: string;
  tendencia: boolean;
};

export type Ventaja = {
  tipo: TipoAbp;
  /** xG esperado frente a la media del grupo. */
  indice: number;
  xG: number;
  acciones: number;
  frase: string;
  consigna: string;
  tendencia: boolean;
};

export type ZonaCorner = "corto" | "primer palo" | "centro" | "segundo palo" | "frontal";

export type Zona = { zona: ZonaCorner; entregas: number; conRemate: number; xG: number };

export type Amenaza = { tirador: string; remates: number; goles: number; xG: number; cabeza: number };

export type ProyeccionAbp = {
  lineas: LineaAbp[];
  posesion: Proyeccion | null;
  tipoPartido: string;
  total: { favor: number; contra: number; xGFavor: number; xGContra: number; golFavor: number; golContra: number };
  porque: string[];
  suFuerte: Punto | null;
  suDebil: Punto | null;
  nuestroFuerte: Punto | null;
  nuestroDebil: Punto | null;
  ventajas: Ventaja[];
  riesgos: Ventaja[];
  amenaza: Amenaza | null;
  nuestroRematador: Amenaza | null;
  partidos: { nos: number; riv: number };
  /** Hasta qué partido llegan los datos. */
  hasta: string;
};

export type EntradaAbp = {
  tabla: Tabla;
  /** Los saques de la temporada (para las zonas del córner). */
  saques?: Saque[];
  /** Los remates (para la amenaza: quién remata a balón parado). */
  remates?: Remate[];
  nos: string;
  riv: string;
  nosLocal: boolean | null;
  nombreRival: string;
  /** Proyectar con lo de antes de esta fecha (para un partido ya jugado). */
  antesDe?: string | null;
};

/* ------------------------------------------------------------------ */

function sumaDe(t: Tabla, equipo: string, clave: string, lado: "propio" | "concede") {
  return serie(t, equipo, clave, lado).reduce((s, x) => s + x, 0);
}

function sumaLiga(t: Tabla, clave: string) {
  return t.filas.reduce((s, f) => s + (f.v[clave] ?? 0), 0);
}

/** Lo que sale de cada acción: el cruce de xG y remates por acción. */
function conversion(t: Tabla, tipo: TipoAbp, ataca: string, defiende: string, acciones: number): Conversion {
  const nL = sumaLiga(t, tipo);
  const xgL = nL ? sumaLiga(t, `${tipo}XG`) / nL : 0;
  const remL = nL ? sumaLiga(t, `${tipo}Rem`) / nL : 0;
  const nA = sumaDe(t, ataca, tipo, "propio");
  const nD = sumaDe(t, defiende, tipo, "concede");
  const xgA = encoge(nA ? sumaDe(t, ataca, `${tipo}XG`, "propio") / nA : null, nA, xgL, K_ACCIONES);
  const xgD = encoge(nD ? sumaDe(t, defiende, `${tipo}XG`, "concede") / nD : null, nD, xgL, K_ACCIONES);
  const remA = encoge(nA ? sumaDe(t, ataca, `${tipo}Rem`, "propio") / nA : null, nA, remL, K_ACCIONES);
  const remD = encoge(nD ? sumaDe(t, defiende, `${tipo}Rem`, "concede") / nD : null, nD, remL, K_ACCIONES);
  const xgPor = xgL ? (xgA * xgD) / xgL : 0;
  const remPor = remL ? (remA * remD) / remL : 0;
  return {
    remates: acciones * remPor,
    xG: acciones * xgPor,
    xGAccionAtaque: xgA,
    xGAccionDefensa: xgD,
    xGAccionLiga: xgL,
    remAccionAtaque: remA,
    remAccionDefensa: remD,
    remAccionLiga: remL,
    accionesAtaque: nA,
    accionesDefensa: nD,
    tendencia: nA < MUESTRA_MIN || nD < MUESTRA_MIN,
  };
}

/** Partido dominado, repartido o del rival, por la posesión esperada. */
export function tipoDePartido(posesion: number | null, nombreRival: string): string {
  if (posesion == null) return "";
  if (posesion >= 0.58) return `Partido de dominio nuestro con balón: el ${nombreRival} esperará y saldrá a la contra`;
  if (posesion >= 0.53) return `Partido con más balón nuestro que suyo`;
  if (posesion > 0.47) return `Partido repartido en la posesión`;
  if (posesion > 0.42) return `Partido con más balón suyo que nuestro`;
  return `Partido de dominio suyo con balón: nos tocará defender y correr`;
}

/* ------------------------------------------------------------------ */
/*  ZONAS DEL CÓRNER                                                   */
/* ------------------------------------------------------------------ */

/** Dónde cae un córner, visto desde el lado del saque. */
export function zonaCorner(s: Saque): ZonaCorner {
  if (s.rosca === "Short" || s.finX < 83) return s.rosca === "Short" ? "corto" : "frontal";
  /* Coordenada «desde el lado del saque»: menos es más cerca del banderín. */
  const yr = s.y < 50 ? s.finY : 100 - s.finY;
  if (yr < 45.2) return "primer palo";
  if (yr <= 54.8) return "centro";
  return "segundo palo";
}

export function zonasCorner(saques: Saque[], equipo: string, lado: "propio" | "concede", antes: string | null): Zona[] {
  const m = new Map<ZonaCorner, Zona>();
  for (const s of saques) {
    if (s.abp !== "corner") continue;
    if (antes && s.fecha.slice(0, 10) >= antes.slice(0, 10)) continue;
    if (lado === "propio" ? s.teamId !== equipo : s.rivalId !== equipo) continue;
    const z = zonaCorner(s);
    const e = m.get(z) ?? { zona: z, entregas: 0, conRemate: 0, xG: 0 };
    e.entregas++;
    if (s.remates.length) e.conRemate++;
    e.xG += [...s.remates, ...s.segundas].reduce((x, r) => x + (r.xG || 0), 0);
    m.set(z, e);
  }
  return [...m.values()].sort((a, b) => b.entregas - a.entregas);
}

/** La zona que más remates da por entrega (con un mínimo de 6 entregas). */
function zonaClave(zs: Zona[]): Zona | null {
  const con = zs.filter((z) => z.zona !== "corto" && z.zona !== "frontal" && z.entregas >= 6);
  if (!con.length) return null;
  return [...con].sort((a, b) => b.conRemate / b.entregas - a.conRemate / a.entregas || b.entregas - a.entregas)[0];
}

const ZONA_TEXTO: Record<ZonaCorner, string> = {
  corto: "en corto",
  "primer palo": "el primer palo",
  centro: "el centro de la portería",
  "segundo palo": "el segundo palo",
  frontal: "el frontal",
};

/* ------------------------------------------------------------------ */
/*  LA PROYECCIÓN                                                      */
/* ------------------------------------------------------------------ */

const ladoSobre = (n: number, d = 1) => coma(n, d);

export function proyeccionAbp(e: EntradaAbp): ProyeccionAbp | null {
  const t = antesDe(e.tabla, e.antesDe ?? null);
  const { nos, riv, nombreRival: R } = e;
  const rivLocal = e.nosLocal == null ? null : !e.nosLocal;

  const pos = proyecta(t, { ataca: nos, defiende: riv, local: e.nosLocal, metrica: "Poss%", escala: "cuota" });
  const posNos = pos?.valor ?? null;

  const lineas: LineaAbp[] = [];
  for (const tipo of TIPOS_ABP) {
    const L = liga(t, tipo);
    const LX = liga(t, `${tipo}XG`);
    if (!L) continue;
    const r = recta(t, tipo, "Poss%");
    const favorP = proyecta(t, { ataca: nos, defiende: riv, local: e.nosLocal, metrica: tipo });
    const contraP = proyecta(t, { ataca: riv, defiende: nos, local: rivLocal, metrica: tipo });
    if (!favorP || !contraP) continue;
    const favorA = conTipoDePartido(favorP, r, posNos);
    const contraA = conTipoDePartido(contraP, r, posNos == null ? null : 1 - posNos);
    const cf = conversion(t, tipo, nos, riv, favorA.valor);
    const cc = conversion(t, tipo, riv, nos, contraA.valor);
    lineas.push({
      tipo,
      nombre: NOMBRE_ABP[tipo],
      favor: { acciones: favorA, conversion: cf, tendencia: favorA.ataque.total < MUESTRA_MIN || favorA.defensa.total < MUESTRA_MIN },
      contra: { acciones: contraA, conversion: cc, tendencia: contraA.ataque.total < MUESTRA_MIN || contraA.defensa.total < MUESTRA_MIN },
      liga: L.media,
      ligaXG: LX?.media ?? 0,
    });
  }
  if (!lineas.length) return null;

  /* Lo real, si el partido ya está en la tabla. */
  if (e.antesDe) {
    const dia = e.antesDe.slice(0, 10);
    const nuestra = e.tabla.filas.find((f) => f.equipo === nos && f.fecha >= dia && f.fecha <= masUno(dia) && e.tabla.contra.get(f)?.equipo === riv);
    const suya = nuestra ? e.tabla.contra.get(nuestra) : undefined;
    if (nuestra && suya) {
      for (const l of lineas)
        l.real = {
          favor: nuestra.v[l.tipo] ?? null,
          contra: suya.v[l.tipo] ?? null,
          xGFavor: nuestra.v[`${l.tipo}XG`] ?? null,
          xGContra: suya.v[`${l.tipo}XG`] ?? null,
        };
    }
  }

  const xGFavor = lineas.reduce((s, l) => s + l.favor.conversion.xG, 0);
  const xGContra = lineas.reduce((s, l) => s + l.contra.conversion.xG, 0);
  const total = {
    favor: lineas.reduce((s, l) => s + l.favor.acciones.valor, 0),
    contra: lineas.reduce((s, l) => s + l.contra.acciones.valor, 0),
    xGFavor,
    xGContra,
    /* Probabilidad de marcar al menos un gol a balón parado (Poisson con ese xG). */
    golFavor: 1 - Math.exp(-xGFavor),
    golContra: 1 - Math.exp(-xGContra),
  };

  /* --------------------------- puntos ---------------------------- */
  const puntos = puntosDe(t, lineas, nos, riv, R);
  /* Lo que es «tendencia» (poca muestra) baja un cuarto en el orden. */
  const peso = (v: Ventaja) => v.indice * (v.tendencia ? 0.75 : 1);
  const ventajas = ventajasDe(lineas, "favor", e, t, R).sort((a, b) => peso(b) - peso(a));
  const riesgos = ventajasDe(lineas, "contra", e, t, R).sort((a, b) => peso(b) - peso(a));

  const tipoPartido = tipoDePartido(posNos, R);

  /* --------------------------- amenaza --------------------------- */
  const abp = new Set(["Corner", "Free Kick Set Piece", "Direct Free Kick", "Throw-in"]);
  const antes = e.antesDe?.slice(0, 10) ?? null;
  const rsAbp = (e.remates ?? []).filter((r) => abp.has(r.situacion) && (!antes || r.fecha.slice(0, 10) < antes));
  /* El que más xG suma a balón parado, con 3 remates como mínimo. */
  const primero = (rs: Remate[]) => rematadores(rs).find((x) => x.remates >= 3);
  const am = primero(rsAbp.filter((r) => r.teamId === riv));
  const nu = primero(rsAbp.filter((r) => r.teamId === nos));
  const comoAmenaza = (x: typeof am): Amenaza | null => (x ? { tirador: x.tirador, remates: x.remates, goles: x.goles, xG: x.xG, cabeza: x.cabeza } : null);

  const porque = porqueDe(lineas, pos, e, t, R, ventajas[0] ?? null, puntos.suDebil);

  return {
    lineas,
    posesion: pos,
    tipoPartido,
    total,
    porque,
    ...puntos,
    ventajas,
    riesgos,
    amenaza: comoAmenaza(am),
    nuestroRematador: comoAmenaza(nu),
    partidos: { nos: resume(serie(t, nos, "corner", "propio")).n, riv: resume(serie(t, riv, "corner", "propio")).n },
    hasta: t.filas.reduce((m, f) => (f.fecha > m ? f.fecha : m), ""),
  };
}

function masUno(dia: string) {
  const d = Date.parse(`${dia}T12:00:00Z`);
  return Number.isFinite(d) ? new Date(d + 86_400_000).toISOString().slice(0, 10) : dia;
}

/* ------------------------------------------------------------------ */
/*  PUNTOS FUERTES Y DÉBILES                                           */
/* ------------------------------------------------------------------ */

function puntosDe(t: Tabla, lineas: LineaAbp[], nos: string, riv: string, R: string) {
  const cand: Punto[] = [];
  for (const l of lineas) {
    const LX = liga(t, `${l.tipo}XG`);
    if (!LX || LX.media <= 0) continue;
    /* Peligro por partido (xG de ese tipo), ponderado y encogido como las acciones. */
    const mira = (equipo: string, lado: "propio" | "concede") => {
      const r = resume(serie(t, equipo, `${l.tipo}XG`, lado));
      return { r, v: encoge(r.ponderada, r.n, LX.media, lado === "propio" ? LX.kPropio : LX.kConcede) };
    };
    const acc = (equipo: string, lado: "propio" | "concede") => sumaDe(t, equipo, l.tipo, lado);
    const sitio = (equipo: string, lado: "propio" | "concede") => {
      const p = puestoEn(LX, equipo, lado);
      return p ? { puesto: p.puesto, de: p.de } : null;
    };
    for (const [quien, equipo] of [["nos", nos], ["riv", riv]] as const) {
      const f = mira(equipo, "propio");
      const d = mira(equipo, "concede");
      const sujeto = quien === "nos" ? "Generamos" : `El ${R} genera`;
      const sujetoC = quien === "nos" ? "Concedemos" : `El ${R} concede`;
      const pf = sitio(equipo, "propio");
      const pd = sitio(equipo, "concede");
      cand.push({
        tipo: l.tipo,
        quien,
        clase: "fuerte",
        indice: f.v / LX.media,
        puesto: pf,
        frase: `${sujeto} ${coma(f.r.temporada ?? 0, 2)} xG por partido en ${NOMBRE_ABP[l.tipo].toLowerCase()} (media del grupo ${coma(LX.media, 2)}${pf ? `; ${pf.puesto}.º de ${pf.de}` : ""}).`,
        tendencia: acc(equipo, "propio") < MUESTRA_MIN,
      });
      cand.push({
        tipo: l.tipo,
        quien,
        clase: "debil",
        indice: d.v / LX.media,
        puesto: pd,
        frase: `${sujetoC} ${coma(d.r.temporada ?? 0, 2)} xG por partido en ${NOMBRE_ABP[l.tipo].toLowerCase()} (media del grupo ${coma(LX.media, 2)}${pd ? `; ${pd.puesto}.º que más concede de ${pd.de}` : ""}).`,
        tendencia: acc(equipo, "concede") < MUESTRA_MIN,
      });
    }
  }
  /*
  | El de más índice; pero si es «tendencia» (poca muestra) y hay otro con
  | muestra por encima de la media, manda el que tiene muestra.
  */
  const elige = (quien: "nos" | "riv", clase: "fuerte" | "debil") => {
    const lista = cand.filter((c) => c.quien === quien && c.clase === clase).sort((a, b) => b.indice - a.indice);
    return lista.find((c) => !c.tendencia && c.indice >= 1) ?? lista[0] ?? null;
  };
  return {
    suFuerte: elige("riv", "fuerte"),
    suDebil: elige("riv", "debil"),
    nuestroFuerte: elige("nos", "fuerte"),
    nuestroDebil: elige("nos", "debil"),
  };
}

/* ------------------------------------------------------------------ */
/*  DÓNDE MÁS VENTAJA (Y DÓNDE MÁS RIESGO)                             */
/* ------------------------------------------------------------------ */

function ventajasDe(lineas: LineaAbp[], lado: "favor" | "contra", e: EntradaAbp, t: Tabla, R: string): Ventaja[] {
  const out: Ventaja[] = [];
  const antes = e.antesDe ?? null;
  const defensor = lado === "favor" ? e.riv : e.nos;
  const atacante = lado === "favor" ? e.nos : e.riv;
  for (const l of lineas) {
    if (!l.ligaXG) continue;
    const x = l[lado];
    const indice = x.conversion.xG / l.ligaXG;
    const c = x.conversion;
    const tendencia = x.tendencia || c.tendencia;
    const D = x.acciones.D;
    const A = x.acciones.A;
    const pRem = c.remAccionDefensa;
    let consigna = "";
    if (lado === "favor") {
      switch (l.tipo) {
        case "corner": {
          const z = e.saques ? zonaClave(zonasCorner(e.saques, defensor, "concede", antes)) : null;
          consigna = z
            ? `Forzar córners y atacar ${ZONA_TEXTO[z.zona]}: de ${z.entregas} córners que le caen ahí, ${z.conRemate} acaban en remate (${pct(z.conRemate / z.entregas)}).`
            : `Forzar córners llegando a línea de fondo: concede ${ladoSobre(D)} por partido y ${coma(pRem * 10, 1)} remates de cada 10.`;
          break;
        }
        case "faltaLateral":
          consigna = `Provocar la falta en banda en su campo y colgarla al área: le cuelgan ${ladoSobre(D)} por partido y ${coma(pRem * 10, 1)} de cada 10 acaban en remate.`;
          break;
        case "faltaDirecta":
          consigna = `Conducir hacia el frontal para provocar falta: le tiran ${ladoSobre(D, 2)} faltas directas por partido.`;
          break;
        case "bandaRival":
          consigna = `Tratar el saque de banda en su campo como balón parado: concede ${ladoSobre(D)} por partido y ${coma(pRem * 10, 1)} remates de cada 10.`;
          break;
        case "penalti":
          consigna = `Atacar su área en conducción y regate: concede ${ladoSobre(D, 2)} penaltis por partido.`;
          break;
      }
    } else {
      switch (l.tipo) {
        case "corner": {
          const z = e.saques ? zonaClave(zonasCorner(e.saques, atacante, "propio", antes)) : null;
          consigna = z
            ? `Defender ${ZONA_TEXTO[z.zona]}: de ${z.entregas} córners que el ${R} manda ahí, ${z.conRemate} acaban en remate (${pct(z.conRemate / z.entregas)}).`
            : `Defender el córner: el ${R} saca ${ladoSobre(A)} por partido y remata ${coma(c.remAccionAtaque * 10, 1)} de cada 10.`;
          break;
        }
        case "faltaLateral":
          consigna = `No regalar faltas en banda cerca de nuestra área: el ${R} cuelga ${ladoSobre(A)} por partido.`;
          break;
        case "faltaDirecta":
          consigna = `No cometer faltas en el frontal: el ${R} tira ${ladoSobre(A, 2)} faltas directas por partido.`;
          break;
        case "bandaRival": {
          const largos = sumaDe(t, atacante, "bandaArea", "propio");
          const n = sumaDe(t, atacante, "bandaRival", "propio");
          consigna = largos >= 3
            ? `Vigilar su saque de banda al área: ${largos} de sus ${n} saques en nuestro campo han caído en el área.`
            : `Vigilar su saque de banda en nuestro campo: saca ${ladoSobre(A)} por partido.`;
          break;
        }
        case "penalti":
          consigna = `Defender el área sin entradas a destiempo: el ${R} provoca ${ladoSobre(A, 2)} penaltis por partido.`;
          break;
      }
    }
    out.push({
      tipo: l.tipo,
      indice,
      xG: c.xG,
      acciones: x.acciones.valor,
      frase:
        lado === "favor"
          ? `${NOMBRE_ABP[l.tipo]}: ${coma(x.acciones.valor)} acciones y ${coma(c.xG, 2)} xG esperados (${frenteA(c.xG, l.ligaXG)} del grupo).`
          : `${NOMBRE_ABP[l.tipo]}: ${coma(x.acciones.valor)} acciones del ${R} y ${coma(c.xG, 2)} xG esperados (${frenteA(c.xG, l.ligaXG)} del grupo).`,
      consigna,
      tendencia,
    });
  }
  return out;
}

/* ------------------------------------------------------------------ */
/*  EL PORQUÉ                                                          */
/* ------------------------------------------------------------------ */

function porqueDe(lineas: LineaAbp[], pos: Proyeccion | null, e: EntradaAbp, t: Tabla, R: string, mejor: Ventaja | null, suDebil: Punto | null): string[] {
  const out: string[] = [];
  /*
  | Su debilidad × nuestra fortaleza: si lo que el rival concede no lo
  | aprovechamos (nuestro xG por acción está por debajo del grupo), se dice
  | antes que nada, porque cambia el trabajo de la semana.
  */
  const debil = suDebil && !suDebil.tendencia && suDebil.indice >= 1.1 ? lineas.find((l) => l.tipo === suDebil.tipo) : undefined;
  const sinAprovechar =
    debil && debil.favor.conversion.xGAccionLiga > 0 && debil.favor.conversion.xGAccionAtaque / debil.favor.conversion.xGAccionLiga < 0.8 ? debil : undefined;
  const c = lineas.find((l) => l.tipo === "corner");
  if (c) {
    const f = c.favor.acciones;
    const k = c.contra.acciones;
    out.push(
      `Córners a favor ${coma(f.valor)}: sacamos ${coma(f.ataque.temporada)} por partido (${coma(f.ataque.ultimos)} en los últimos ${Math.min(5, f.ataque.n)}) y el ${R} concede ${coma(f.defensa.temporada)} (${coma(f.defensa.ultimos)} en sus últimos ${Math.min(5, f.defensa.n)}); la media del grupo es ${coma(c.liga)}.`,
    );
    out.push(
      `Córners en contra ${coma(k.valor)}: el ${R} saca ${coma(k.ataque.temporada)} por partido (${coma(k.ataque.ultimos)} en los últimos ${Math.min(5, k.ataque.n)}) y nosotros concedemos ${coma(k.defensa.temporada)}.`,
    );
  }
  if (pos) {
    const r = recta(t, "corner", "Poss%");
    const extra = r && r.r2 > 0.005 ? ` En el grupo, cada 10 puntos de posesión son ${coma(r.b * 0.1)} córners más, y eso pesa un ${Math.round(Math.min(0.3, r.r2) * 100)} % en la cifra.` : "";
    out.push(
      `Posesión esperada ${pct(pos.valor)} para nosotros: tenemos ${pct(pos.ataque.temporada)} de media y los rivales del ${R} tienen ${pct(pos.defensa.temporada)} contra él.${extra}`,
    );
  }
  if (e.nosLocal != null && c) {
    const H = c.favor.acciones.H;
    if (Math.abs(H - 1) >= 0.03)
      out.push(
        `Jugamos ${e.nosLocal ? "en casa" : "fuera"}: en el grupo, el ${e.nosLocal ? "local" : "visitante"} saca un ${Math.round(Math.abs(H - 1) * 100)} % ${H > 1 ? "más" : "menos"} de córners que la media.`,
      );
  }
  /* La tendencia más marcada de las series que entran en la cuenta. */
  const cambios: string[] = [];
  for (const l of lineas) {
    if (l.tipo === "penalti" || l.tipo === "faltaDirecta") continue;
    const d = l.favor.acciones.defensa;
    if (d.cambio && d.ultimos != null && d.previos != null)
      cambios.push(`el ${R} ${d.cambio === "sube" ? "concede más" : "concede menos"} ${NOMBRE_ABP[l.tipo].toLowerCase()} últimamente (${coma(d.ultimos)} por partido en los últimos 5, ${coma(d.previos)} antes)`);
    const a = l.contra.acciones.ataque;
    if (a.cambio && a.ultimos != null && a.previos != null)
      cambios.push(`el ${R} ${a.cambio === "sube" ? "genera más" : "genera menos"} ${NOMBRE_ABP[l.tipo].toLowerCase()} (${coma(a.ultimos)} en los últimos 5, ${coma(a.previos)} antes)`);
  }
  if (cambios.length) out.push(`Tendencia: ${cambios.slice(0, 2).join("; ")}.`);
  if (sinAprovechar) {
    const c = sinAprovechar.favor.conversion;
    const d = sinAprovechar.favor.acciones.defensa;
    const nombre = NOMBRE_ABP[sinAprovechar.tipo].toLowerCase();
    out.unshift(
      `Su punto débil son los ${nombre} en contra: concede ${coma(d.temporada)} por partido (grupo ${coma(sinAprovechar.liga)})${suDebil?.puesto ? ` y es el ${suDebil.puesto.puesto}.º de ${suDebil.puesto.de} que más xG concede ahí` : ""}. Pero nosotros sacamos ${coma(c.xGAccionAtaque, 3)} xG por ${SINGULAR[sinAprovechar.tipo]} (grupo ${coma(c.xGAccionLiga, 3)}): la ventaja está en la ejecución, no en el número de ${nombre}.`,
    );
  }
  if (mejor && mejor.indice > 1)
    out.push(
      `Donde más se puede sacar: ${NOMBRE_ABP[mejor.tipo].toLowerCase()}, con ${coma(mejor.xG, 2)} xG esperados, ${frenteA(mejor.xG, lineas.find((l) => l.tipo === mejor.tipo)?.ligaXG ?? 0)} del grupo${mejor.tendencia ? " (tendencia: poca muestra)" : ""}.`,
    );
  return out.slice(0, 5);
}

/* ------------------------------------------------------------------ */

export const COMO_SE_CUENTA_ABP: string[] = [
  "Fuente: Opta, partido a partido y evento a evento, de los 20 equipos de nuestro grupo de Primera RFEF; el campo (local o visitante) sale del título del partido en Wyscout.",
  "Acciones: lo que saca el que ataca por partido × lo que concede el que defiende ÷ la media del grupo × el efecto del campo. Las dos tasas pesan más los últimos partidos (el de hace 8 jornadas, la mitad que el último) y se acercan a la media del grupo tanto más cuanto menos se distinguen los equipos en esa cifra.",
  "Medido en el grupo (140 casos del 25/09 al 08/11, cada uno proyectado con lo de antes): en el número de córners, bandas y faltas de un partido los equipos aún apenas se distinguen, y la cifra queda cerca de la media con un intervalo ancho. Lo que más separa a los equipos es lo que sale de cada acción (remates y xG por acción) y dónde caen.",
  "Tipo de partido: la posesión esperada se cruza igual (en razón de probabilidades) y se mezcla con la recta del grupo «acciones según posesión», con el peso de lo que explica (r²), como mucho un 30 %.",
  "Qué sale de ellas: remates y xG por acción del que ataca y de lo que concede el que defiende, de toda la temporada, cruzados del mismo modo. Incluye la segunda jugada (el rechace o el segundo centro hasta 40 s después).",
  "Ventaja: nuestro xG esperado de cada tipo frente a la media del grupo; riesgo, el del rival. «Tendencia» cuando hay menos de 15 acciones detrás.",
  "Faltas laterales: colgadas al área desde fuera de su ancho y en campo rival. Faltas directas: cada tiro directo. Saques de banda: los sacados en campo rival.",
  "El intervalo es del 80 %: suma lo que varía un equipo de un partido a otro y la duda de las tasas.",
];

/** Para un partido ya jugado: el porcentaje de acierto del intervalo. */
export function dentroDelRango(p: Proyeccion, real: number | null): boolean | null {
  if (real == null) return null;
  return real >= Math.floor(p.bajo + 0.5) && real <= Math.round(p.alto);
}

export { rango };
export type { FilaPartido };
