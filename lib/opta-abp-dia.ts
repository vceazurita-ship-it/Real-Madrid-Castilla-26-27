/**
 * OPTA EN LAS PANTALLAS DE BALÓN PARADO DEL DÍA A DÍA (10/11/2026).
 *
 * ABP ofensivo y defensivo (/setpieces, /setpieces_def) y saque de banda
 * ofensivo y defensivo (/throw-ins, /throw-ins-def) cuentan lo que apunta el
 * analista en sus hojas. Opta lo COMPLEMENTA: dónde está el Castilla frente a
 * su grupo y a la categoría, y cada saque de la temporada con su jugada.
 *
 * Reutiliza las cuentas del laboratorio de ABP: las métricas de equipo de
 * `lib/opta-abp.ts` (las mismas claves) y los saques evento a evento de
 * `lib/opta-eventos.ts` (`saquesDe`, `resumenSaques`, `lanzadores`). Aquí
 * sólo se añade lo que esas no tienen:
 *
 * - Lo que el rival nos hace y `opta:equipos` no trae con «|OPP» (los saques
 *   de banda que el rival conserva), sumado de `opta:partidos`: la fila del
 *   otro equipo en cada partido.
 * - El puesto de una cifra de saques (evento a evento) entre los 40 equipos.
 * - Los rematadores de balón parado y la altura del saque de banda.
 *
 * Comprobado con las copias locales (10/11/2026): los córners y los saques de
 * banda de cada uno de los 40 equipos salen igual de los eventos que de
 * `opta:equipos` (Corners, CrnrsLeadingShot, ThrowIn, ThrowInSc).
 *
 * Sin datos de Opta aquí (el repo es público): sólo nombres y fórmulas.
 */

import { CASTILLA_OPTA, aObjetos, num, percentil, type Celda, type TablaOpta } from "@/lib/opta";
import { METRICAS_ABP_OPTA, gruposDePartidos, valorAbp, type FilaEquipoOpta, type MetricaAbpOpta } from "@/lib/opta-abp";
import { resumenSaques, type Remate, type ResumenSaques, type Saque } from "@/lib/opta-eventos";

/** Por debajo de esto, un porcentaje es tendencia: sin puesto ni percentil. */
export const CASOS_MIN_DIA = 10;

export type LadoDia = "favor" | "contra";
export type AreaDia = "abp" | "banda";

const cociente = (a: string, b: string) => (f: FilaEquipoOpta) => {
  const x = num(f[a]);
  const y = num(f[b]);
  return x != null && y != null && y > 0 ? x / y : null;
};

/** Las que no están en el laboratorio: el saque de banda que se conserva y lo del rival. */
const EXTRA: MetricaAbpOpta[] = [
  {
    clave: "ThrowInSc%",
    nombre: "Saques de banda que llegan a un compañero",
    seccion: "Saques de banda",
    modo: "pct",
    mejorAlto: true,
    valor: cociente("ThrowInSc", "ThrowIn"),
    casos: (f) => num(f.ThrowIn),
    comoLeer: "De cada 100 saques de banda, cuántos recibe un compañero (Opta: ThrowInSc ÷ ThrowIn).",
  },
  {
    clave: "ThrowIn|OPP",
    nombre: "Saques de banda del rival",
    seccion: "Saques de banda",
    modo: "pp",
    mejorAlto: null,
    valor: (f) => num(f["ThrowIn|OPP"]),
    comoLeer: "Saques de banda del rival por partido. Es volumen, no rendimiento.",
  },
  {
    clave: "ThrowInSc%|OPP",
    nombre: "Saques del rival que llegan a uno de los suyos",
    seccion: "Saques de banda",
    modo: "pct",
    mejorAlto: false,
    valor: cociente("ThrowInSc|OPP", "ThrowIn|OPP"),
    casos: (f) => num(f["ThrowIn|OPP"]),
    comoLeer: "De cada 100 saques de banda del rival, cuántos recibe uno de los suyos: cuanto menos, más se los quitamos.",
  },
];

const TODAS = [...METRICAS_ABP_OPTA, ...EXTRA];

/** Qué cifras de equipo se enseñan en cada pantalla, en este orden. */
export const CLAVES_DIA: Record<AreaDia, Record<LadoDia, string[]>> = {
  abp: {
    favor: ["Corners", "CrnrRemate%", "ShotCrnrs", "xGSetPly", "ChncSetPl", "ShotDirFK", "GoalSetPly", "GoalCrnrs", "GoalDirFK"],
    contra: ["Corners|OPP", "RematesCrnrOPP", "ChncSetPl|OPP", "ShotDirFK|OPP", "GoalSetPly|OPP", "GoalCrnrs|OPP", "GoalDirFK|OPP"],
  },
  banda: {
    /* Sin los remates y goles «de saque de banda» de equipos: Opta sólo cuenta
       el remate directo (0 en el Castilla), y la pestaña de eventos da los
       de la misma jugada. Dos cifras distintas con el mismo nombre confundían. */
    favor: ["ThrowIn", "ThrowInSc%"],
    contra: ["ThrowIn|OPP", "ThrowInSc%|OPP"],
  },
};

export const metricaDia = (clave: string) => TODAS.find((m) => m.clave === clave) ?? null;

/**
 * Las filas de `opta:equipos` con lo del rival que no traen «|OPP», sumado de
 * `opta:partidos` (la fila del otro equipo en cada partido del equipo).
 */
export function filasConRival(equipos: Record<string, Celda>[], partidos: TablaOpta | null): FilaEquipoOpta[] {
  if (!partidos) return equipos;
  const c = (n: string) => partidos.cols.indexOf(n);
  const [iP, iT] = [c("partido"), c("teamId")];
  const SUMAR = ["ThrowInSc"];
  const porPartido = new Map<string, Celda[][]>();
  for (const f of partidos.filas) {
    const p = String(f[iP] ?? "");
    porPartido.set(p, [...(porPartido.get(p) ?? []), f]);
  }
  const contra = new Map<string, Record<string, number>>();
  for (const filas of porPartido.values()) {
    if (filas.length !== 2) continue;
    for (const [a, b] of [filas, [...filas].reverse()]) {
      const t = String(a[iT] ?? "");
      const acc = contra.get(t) ?? {};
      for (const k of SUMAR) {
        const v = num(b[c(k)]);
        if (v != null) acc[k] = (acc[k] ?? 0) + v;
      }
      contra.set(t, acc);
    }
  }
  return equipos.map((f) => {
    const acc = contra.get(String(f.teamId ?? ""));
    if (!acc) return f;
    const extra: Record<string, Celda> = {};
    for (const k of SUMAR) if (acc[k] != null && f[`${k}|OPP`] == null) extra[`${k}|OPP`] = acc[k];
    return { ...f, ...extra };
  });
}

export type PosicionDia = { puesto: number; de: number; p: number | null; mediana: number | null };

const mediana = (xs: number[]) => {
  if (!xs.length) return null;
  const o = [...xs].sort((a, b) => a - b);
  const k = Math.floor(o.length / 2);
  return o.length % 2 ? o[k] : (o[k - 1] + o[k]) / 2;
};

/** Puesto (del mejor al peor; en las de estilo, del que más al que menos) y percentil. */
export function posicionDia(mejorAlto: boolean | null, valor: number, muestra: number[]): PosicionDia {
  const masEsMejor = mejorAlto !== false;
  return {
    puesto: muestra.filter((v) => (masEsMejor ? v > valor : v < valor)).length + 1,
    de: muestra.length,
    p: percentil(valor, muestra, mejorAlto === false),
    mediana: mediana(muestra),
  };
}

export type LineaDia = {
  m: MetricaAbpOpta;
  valor: number;
  casos: number | null;
  pocos: boolean;
  grupo: PosicionDia | null;
  categoria: PosicionDia;
};

export type ContextoDia = {
  lineas: LineaDia[];
  partidos: number;
  nGrupo: number;
  nTotal: number;
  /** El último partido del Castilla que traen los datos (AAAA-MM-DD). */
  hasta: string;
};

/** El Castilla frente a su grupo y a la categoría, en las cifras de esa pantalla. */
export function contextoDia(equiposT: TablaOpta | null, partidosT: TablaOpta | null, area: AreaDia, lado: LadoDia): ContextoDia | null {
  const filas = filasConRival(aObjetos(equiposT), partidosT);
  const nuestro = filas.find((f) => f.teamId === CASTILLA_OPTA);
  if (!nuestro) return null;

  const grupos = gruposDePartidos(partidosT);
  const g = grupos.get(CASTILLA_OPTA);
  const delGrupo = g != null ? filas.filter((f) => grupos.get(String(f.teamId)) === g) : [];
  const hayGrupo = delGrupo.length >= 6 && delGrupo.length < filas.length;

  const lineas: LineaDia[] = [];
  for (const clave of CLAVES_DIA[area][lado]) {
    const m = metricaDia(clave);
    if (!m) continue;
    const valor = valorAbp(m, nuestro);
    if (valor == null) continue;
    const deTodos = filas.map((f) => valorAbp(m, f)).filter((v): v is number => v != null);
    if (deTodos.length < 10) continue;
    const casos = m.casos ? m.casos(nuestro) : null;
    lineas.push({
      m,
      valor,
      casos,
      pocos: casos != null && casos < CASOS_MIN_DIA,
      grupo: hayGrupo ? posicionDia(m.mejorAlto, valor, delGrupo.map((f) => valorAbp(m, f)).filter((v): v is number => v != null)) : null,
      categoria: posicionDia(m.mejorAlto, valor, deTodos),
    });
  }

  let hasta = "";
  if (partidosT) {
    const iT = partidosT.cols.indexOf("teamId");
    const iF = partidosT.cols.indexOf("fecha");
    for (const f of partidosT.filas) if (f[iT] === CASTILLA_OPTA && String(f[iF] ?? "") > hasta) hasta = String(f[iF] ?? "");
  }

  return { lineas, partidos: num(nuestro.GM) ?? 0, nGrupo: hayGrupo ? delGrupo.length : 0, nTotal: filas.length, hasta: hasta.slice(0, 10) };
}

/** «hasta el partido del 08/11» (vacío si no hay fecha). */
export const hastaTexto = (fecha: string) => (fecha.length >= 10 ? `hasta el partido del ${fecha.slice(8, 10)}/${fecha.slice(5, 7)}` : "");

/* ------------------------------------------------------------------ */
/*  Evento a evento                                                    */
/* ------------------------------------------------------------------ */

/** Los saques de un equipo: los suyos (a favor) o los que le hacen (en contra). */
export const deEquipo = (ss: Saque[], teamId: string, lado: LadoDia) => ss.filter((s) => (lado === "favor" ? s.teamId === teamId : s.rivalId === teamId));

/**
 * Una cifra de saques del Castilla puesta entre los 40 equipos: cada uno con
 * sus saques (o los que le hacen), y el puesto del mejor al peor. Los equipos
 * con menos de `CASOS_MIN_DIA` saques no entran en la muestra.
 */
export function puestoSaques(
  ss: Saque[],
  equipos: string[],
  lado: LadoDia,
  cifra: (r: ResumenSaques) => number | null,
  mejorAlto: boolean | null,
): PosicionDia | null {
  const valores = new Map<string, number>();
  for (const t of equipos) {
    const suyos = deEquipo(ss, t, lado);
    if (suyos.length < CASOS_MIN_DIA) continue;
    const v = cifra(resumenSaques(suyos));
    if (v != null && Number.isFinite(v)) valores.set(t, v);
  }
  const nuestro = valores.get(CASTILLA_OPTA);
  if (nuestro == null || valores.size < 10) return null;
  return posicionDia(mejorAlto, nuestro, [...valores.values()]);
}

/** Situaciones de remate (ShotPlayStyle) de cada saque. */
export const SITUACIONES_DE: Record<"corner" | "falta", string[]> = {
  corner: ["Corner"],
  falta: ["Free Kick Set Piece", "Direct Free Kick"],
};

export type Rematador = { tirador: string; equipo: string; remates: number; aPuerta: number; goles: number; xG: number; cabeza: number };

/** Quién remata (de más xG a menos). */
export function rematadores(rs: Remate[]): Rematador[] {
  const m = new Map<string, Rematador>();
  for (const r of rs) {
    const k = r.tiradorId || r.tirador;
    if (!k) continue;
    const e = m.get(k) ?? { tirador: r.tirador, equipo: r.equipo, remates: 0, aPuerta: 0, goles: 0, xG: 0, cabeza: 0 };
    e.remates++;
    if (r.aPuerta) e.aPuerta++;
    if (r.gol) e.goles++;
    if (r.cuerpo === "Head") e.cabeza++;
    e.xG += r.xG;
    m.set(k, e);
  }
  return [...m.values()].sort((a, b) => b.xG - a.xG || b.remates - a.remates);
}

/* ------------------------------------------------------------------ */
/*  Saque de banda: la altura                                          */
/* ------------------------------------------------------------------ */

export type AlturaBanda = "defensivo" | "medio" | "ofensivo";

export const ALTURAS_BANDA: { key: AlturaBanda; nombre: string; detalle: string }[] = [
  { key: "defensivo", nombre: "Tercio propio", detalle: "Primer tercio del campo, cerca de nuestra portería" },
  { key: "medio", nombre: "Tercio medio", detalle: "Entre las dos líneas de tercio" },
  { key: "ofensivo", nombre: "Último tercio", detalle: "Cerca de la portería rival" },
];

/** La altura del saque desde quien saca (x 0-100 hacia la portería rival). */
export const alturaBanda = (s: Saque): AlturaBanda => (s.x < 100 / 3 ? "defensivo" : s.x < 200 / 3 ? "medio" : "ofensivo");
