/**
 * EL RIVAL POR TERCIOS: PROTECCIÓN, CONTROL Y AMENAZA FRENTE A LA LIGA
 * (Scout colectivo, 23/11/2026, idea de X). Con el evento a evento de Opta
 * (`opta:directo:<partido>`) de los últimos partidos de cada equipo de su
 * liga, tres métricas por tercio (x de Opta 0-100, siempre hacia la portería
 * contraria; la del contrario, vuelta a su campo):
 *
 * - ZONA BAJA · protección (su tercio, x < 33,3): toques del contrario en su
 *   tercio por partido (menos, mejor), remates que concede por partido (menos,
 *   mejor) y % de duelos que gana en su tercio.
 * - ZONA MEDIA · control (33,3 ≤ x < 66,7): % de los toques del tercio medio
 *   que son suyos, % de sus pases en juego acertados en el tercio medio y sus
 *   acciones defensivas en el tercio medio por partido.
 * - ZONA ALTA · amenaza (x ≥ 66,7): sus toques en el último tercio por
 *   partido, sus remates por partido y sus acciones defensivas en el último
 *   tercio por partido.
 *
 * Cada métrica se pasa a percentil contra los demás equipos de la liga (sin
 * él); la nota de la zona es la media de sus tres percentiles. La altura
 * defensiva es la x media de sus entradas, intercepciones y recuperaciones.
 *
 * Funciones puras: ni una cifra de Opta aquí (el repositorio es público).
 */

import { esPaseEnJuego, esToque, tiros, type EventoDirecto } from "@/lib/opta-directo-mapas";

export const MAX_PARTIDOS = 8;
/** Con menos partidos leídos no se compara al equipo. */
export const MIN_PARTIDOS = 2;

const DEFENSIVAS = new Set(["Tackle", "Interception", "BallRecovery"]);
const DUELO = new Set(["Aerial", "TakeOn", "Tackle", "Challenge", "AttemptedTackle"]);
const T1 = 100 / 3;
const T2 = 200 / 3;

export type Zona = "baja" | "media" | "alta";

export type Metrica = {
  clave: string;
  zona: Zona;
  nombre: string;
  /** true si cuanto más bajo, mejor para él. */
  menosEsMejor: boolean;
  /** Cómo se escribe el valor. */
  formato: "porPartido" | "porcentaje";
};

export const METRICAS: Metrica[] = [
  { clave: "toquesContra", zona: "baja", nombre: "Toques del contrario en su tercio, por partido", menosEsMejor: true, formato: "porPartido" },
  { clave: "tirosContra", zona: "baja", nombre: "Remates que concede, por partido", menosEsMejor: true, formato: "porPartido" },
  { clave: "duelosPropio", zona: "baja", nombre: "Duelos ganados en su tercio", menosEsMejor: false, formato: "porcentaje" },
  { clave: "dominioMedio", zona: "media", nombre: "Toques del tercio medio que son suyos", menosEsMejor: false, formato: "porcentaje" },
  { clave: "paseMedio", zona: "media", nombre: "Pases acertados en el tercio medio", menosEsMejor: false, formato: "porcentaje" },
  { clave: "recupMedio", zona: "media", nombre: "Acciones defensivas en el tercio medio, por partido", menosEsMejor: false, formato: "porPartido" },
  { clave: "toquesUltimo", zona: "alta", nombre: "Toques en el último tercio, por partido", menosEsMejor: false, formato: "porPartido" },
  { clave: "tiros", zona: "alta", nombre: "Remates, por partido", menosEsMejor: false, formato: "porPartido" },
  { clave: "recupAlta", zona: "alta", nombre: "Acciones defensivas en el último tercio, por partido", menosEsMejor: false, formato: "porPartido" },
];

export type PerfilTercios = { partidos: number; valores: Record<string, number>; altura: number };

/** Las métricas de `teamId` sumadas en sus partidos. `null` si no llega al mínimo. */
export function perfilTercios(partidos: { eventos: EventoDirecto[] }[], teamId: string): PerfilTercios | null {
  let leidos = 0;
  const s = {
    toquesContra: 0,
    tirosContra: 0,
    duelos: 0,
    ganados: 0,
    medioSuyo: 0,
    medioOtro: 0,
    pases: 0,
    pasesOk: 0,
    recupMedio: 0,
    toquesUltimo: 0,
    tiros: 0,
    recupAlta: 0,
    sx: 0,
    nd: 0,
  };
  for (const p of partidos) {
    if (!p.eventos.some((e) => e.teamId === teamId)) continue;
    leidos += 1;
    for (const e of p.eventos) {
      const suyo = e.teamId === teamId;
      const conSitio = !(e.x === 0 && e.y === 0);
      if (suyo) {
        if (DEFENSIVAS.has(e.tipo) && conSitio) {
          s.sx += e.x;
          s.nd += 1;
          if (e.x >= T2) s.recupAlta += 1;
          else if (e.x >= T1) s.recupMedio += 1;
        }
        if (DUELO.has(e.tipo) && conSitio && e.x < T1) {
          s.duelos += 1;
          if (e.ok) s.ganados += 1;
        }
        if (esToque(e)) {
          if (e.x >= T2) s.toquesUltimo += 1;
          else if (e.x >= T1) s.medioSuyo += 1;
        }
        if (esPaseEnJuego(e) && conSitio && e.x >= T1 && e.x < T2) {
          s.pases += 1;
          if (e.ok) s.pasesOk += 1;
        }
      } else if (esToque(e)) {
        if (e.x >= T2) s.toquesContra += 1;
        else if (e.x >= T1) s.medioOtro += 1;
      }
    }
    for (const t of tiros(p.eventos)) {
      if (t.teamId === teamId) s.tiros += 1;
      else s.tirosContra += 1;
    }
  }
  if (leidos < MIN_PARTIDOS || !s.nd) return null;
  const n = leidos;
  return {
    partidos: n,
    altura: ((s.sx / s.nd) * 105) / 100,
    valores: {
      toquesContra: s.toquesContra / n,
      tirosContra: s.tirosContra / n,
      duelosPropio: s.duelos ? s.ganados / s.duelos : 0,
      dominioMedio: s.medioSuyo + s.medioOtro ? s.medioSuyo / (s.medioSuyo + s.medioOtro) : 0,
      paseMedio: s.pases ? s.pasesOk / s.pases : 0,
      recupMedio: s.recupMedio / n,
      toquesUltimo: s.toquesUltimo / n,
      tiros: s.tiros / n,
      recupAlta: s.recupAlta / n,
    },
  };
}

export const mediana = (v: number[]) => {
  if (!v.length) return 0;
  const o = [...v].sort((a, b) => a - b);
  const m = Math.floor(o.length / 2);
  return o.length % 2 ? o[m] : (o[m - 1] + o[m]) / 2;
};

/** Percentil 0-100 de `v` entre `otros` (los empates cuentan la mitad). */
export function percentil(v: number, otros: number[], menosEsMejor = false) {
  if (!otros.length) return 50;
  let peor = 0;
  let igual = 0;
  for (const o of otros) {
    if (o === v) igual += 1;
    else if (menosEsMejor ? o > v : o < v) peor += 1;
  }
  return ((peor + igual / 2) / otros.length) * 100;
}

export type NotaZona = {
  zona: Zona;
  /** Media de los percentiles de sus tres métricas, 0-100. */
  nota: number;
  /** Nota del rival menos la mediana de la nota de la liga. */
  difMediana: number;
  metricas: { m: Metrica; valor: number; mediana: number; pct: number }[];
};

export type Tercios = {
  partidos: number;
  equipos: number;
  zonas: NotaZona[];
  altura: { metros: number; pct: number; medianaMetros: number };
  media: { nota: number; mediana: number };
};

const ZONAS: Zona[] = ["baja", "media", "alta"];

/** Notas de cada equipo contra los demás (sin él). */
function notas(perfiles: PerfilTercios[], i: number): Record<Zona, number> {
  const otros = perfiles.filter((_, k) => k !== i);
  const r = {} as Record<Zona, number>;
  for (const z of ZONAS) {
    const ms = METRICAS.filter((m) => m.zona === z);
    r[z] = ms.reduce((a, m) => a + percentil(perfiles[i].valores[m.clave], otros.map((o) => o.valores[m.clave]), m.menosEsMejor), 0) / ms.length;
  }
  return r;
}

/** El rival frente a los demás. `null` con menos de 3 equipos con que comparar. */
export function tercios(rival: PerfilTercios, otros: PerfilTercios[]): Tercios | null {
  if (otros.length < 3) return null;
  const todos = [rival, ...otros];
  const deTodos = todos.map((_, i) => notas(todos, i));
  const suyas = deTodos[0];
  const deOtros = deTodos.slice(1);
  const zonas: NotaZona[] = ZONAS.map((z) => ({
    zona: z,
    nota: suyas[z],
    difMediana: suyas[z] - mediana(deOtros.map((n) => n[z])),
    metricas: METRICAS.filter((m) => m.zona === z).map((m) => {
      const vals = otros.map((o) => o.valores[m.clave]);
      return { m, valor: rival.valores[m.clave], mediana: mediana(vals), pct: percentil(rival.valores[m.clave], vals, m.menosEsMejor) };
    }),
  }));
  const mediaDe = (n: Record<Zona, number>) => (n.baja + n.media + n.alta) / 3;
  return {
    partidos: rival.partidos,
    equipos: otros.length,
    zonas,
    altura: {
      metros: rival.altura,
      pct: percentil(rival.altura, otros.map((o) => o.altura)),
      medianaMetros: mediana(otros.map((o) => o.altura)),
    },
    media: { nota: mediaDe(suyas), mediana: mediana(deOtros.map(mediaDe)) },
  };
}
