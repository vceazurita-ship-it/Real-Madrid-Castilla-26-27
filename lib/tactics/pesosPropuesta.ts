/*
|--------------------------------------------------------------------------
| CÓMO DECIDE LA PROPUESTA: LOS PESOS (01/11/2026)
|--------------------------------------------------------------------------
|
| Lo pidió el analista: «que se expliquen los pesos en la decisión de la
| propuesta y que se puedan editar porcentualmente». Siete factores, cada uno
| con su porcentaje; entre todos suman 100.
|
| Los porcentajes por defecto son los que la propuesta ya usaba por dentro:
| con ellos sale exactamente el mismo once que antes. Cada punto de la nota
| de un factor se multiplica por (su % elegido / su % por defecto), así que
| doblar el porcentaje de un factor es doblar lo que pesa frente a los demás.
|
| Un factor apagado (o sin datos) vale 0 % y su parte se reparte entre los
| encendidos, en la proporción que ya tenían. Al mover uno, los demás
| encendidos se reajustan en proporción para seguir sumando 100.
*/

import type { Factor } from "./propuestaOnce";

export type FactorPeso = "encaje" | "minutos" | "continuidad" | Factor;

export const FACTORES_PESO: { clave: FactorPeso; rotulo: string; mide: string; defecto: number }[] = [
  { clave: "encaje", rotulo: "Encaje en el puesto", mide: "Si juega en su puesto y en su banda.", defecto: 30 },
  { clave: "minutos", rotulo: "Minutos", mide: "Los minutos que lleva esta temporada.", defecto: 15 },
  { clave: "continuidad", rotulo: "Continuidad", mide: "Si ya es quien está en ese puesto en la pizarra.", defecto: 10 },
  { clave: "duelos", rotulo: "Duelos contra su once", mide: "Si gana los duelos contra quien tendrá enfrente.", defecto: 15 },
  { clave: "colectivo", rotulo: "Lo que pide su juego", mide: "Si da lo que pide el estilo del rival y se entiende con su pareja.", defecto: 12 },
  { clave: "emocional", rotulo: "Rendimiento emocional", mide: "Cómo llega en las cuatro valoraciones emocionales.", defecto: 8 },
  { clave: "tendencia", rotulo: "Último partido", mide: "Su nota del último partido frente a la del equipo y la suya de siempre.", defecto: 10 },
];

export const CLAVES_PESO = FACTORES_PESO.map((f) => f.clave);

export type Pesos = Record<FactorPeso, number>;
export type Encendidos = Record<FactorPeso, boolean>;

export const PESOS_POR_DEFECTO: Pesos = Object.fromEntries(FACTORES_PESO.map((f) => [f.clave, f.defecto])) as Pesos;
export const TODOS_ENCENDIDOS: Encendidos = Object.fromEntries(CLAVES_PESO.map((k) => [k, true])) as Encendidos;

/** Enteros que suman exactamente `total`, lo más cerca posible de los valores dados (mayor resto). */
function redondea(valores: Pesos, claves: FactorPeso[], total: number): Pesos {
  const salida = Object.fromEntries(CLAVES_PESO.map((k) => [k, 0])) as Pesos;
  const suma = claves.reduce((t, k) => t + Math.max(0, valores[k]), 0);

  if (!claves.length) return salida;

  const exactos = claves.map((k) => ({ k, v: suma > 0 ? (Math.max(0, valores[k]) / suma) * total : total / claves.length }));

  for (const x of exactos) salida[x.k] = Math.floor(x.v);

  let falta = total - exactos.reduce((t, x) => t + Math.floor(x.v), 0);

  for (const x of [...exactos].sort((a, b) => b.v - Math.floor(b.v) - (a.v - Math.floor(a.v)))) {
    if (falta <= 0) break;

    salida[x.k] += 1;
    falta -= 1;
  }

  return salida;
}

/** Los que cuentan de verdad: encendidos y con datos. */
export const cuentan = (encendidos: Encendidos, conDatos: (k: FactorPeso) => boolean) => CLAVES_PESO.filter((k) => encendidos[k] && conDatos(k));

/** El % que pesa cada factor ahora mismo (enteros, suman 100; apagados y sin datos, 0). */
export function pesosEfectivos(pesos: Pesos, encendidos: Encendidos, conDatos: (k: FactorPeso) => boolean = () => true): Pesos {
  return redondea(pesos, cuentan(encendidos, conDatos), 100);
}

/**
 * Pone un factor en `valor` % y reajusta los demás que cuentan, en proporción,
 * para seguir sumando 100. Devuelve los pesos guardados nuevos: los de los
 * apagados no se tocan, para que al volver a encenderlos recuperen lo suyo.
 */
export function reparte(pesos: Pesos, encendidos: Encendidos, conDatos: (k: FactorPeso) => boolean, clave: FactorPeso, valor: number): Pesos {
  const activos = cuentan(encendidos, conDatos);

  if (!activos.includes(clave) || activos.length < 2) return pesos;

  const efectivos = pesosEfectivos(pesos, encendidos, conDatos);
  const v = Math.max(0, Math.min(100, Math.round(valor)));
  const otros = activos.filter((k) => k !== clave);
  const sumaOtros = otros.reduce((t, k) => t + efectivos[k], 0);
  const nuevos = { ...efectivos, [clave]: v };

  for (const k of otros) nuevos[k] = sumaOtros > 0 ? (efectivos[k] / sumaOtros) * (100 - v) : (100 - v) / otros.length;

  /* El que se mueve se queda exactamente donde se dejó; el redondeo lo absorben los demás. */
  const resto = redondea(nuevos, otros, 100 - v);

  /* Los guardados: los que cuentan, a escala de lo que no tienen los apagados. */
  const deLosQueNoCuentan = CLAVES_PESO.filter((k) => !activos.includes(k)).reduce((t, k) => t + pesos[k], 0);
  const escala = Math.max(0, 100 - deLosQueNoCuentan) / 100;
  const salida = { ...pesos };

  for (const k of activos) salida[k] = (k === clave ? v : resto[k]) * escala;

  return salida;
}

/** Encender un factor que se había dejado a 0 le devuelve su peso por defecto. */
export function enciende(pesos: Pesos, clave: FactorPeso): Pesos {
  if (pesos[clave] >= 1) return pesos;

  const salida = { ...pesos, [clave]: PESOS_POR_DEFECTO[clave] };
  const suma = CLAVES_PESO.reduce((t, k) => t + salida[k], 0);

  return Object.fromEntries(CLAVES_PESO.map((k) => [k, (salida[k] / suma) * 100])) as Pesos;
}

/** Lo que multiplica a cada factor en la nota: 1 con los pesos por defecto. */
export const multiplicador = (efectivos: Pesos, k: FactorPeso) => efectivos[k] / PESOS_POR_DEFECTO[k];

/* ------------------------------------------------------------------ */
/*  RECORDARLOS EN ESTE APARATO                                        */
/* ------------------------------------------------------------------ */

const CLAVE_LOCAL = "pizarra:propuesta-pesos";

export type PreferenciaPesos = { pesos: Pesos; encendidos: Encendidos };

export function leePreferencia(): PreferenciaPesos {
  try {
    const crudo = JSON.parse(window.localStorage.getItem(CLAVE_LOCAL) ?? "null") as Partial<PreferenciaPesos> | null;
    const pesos = { ...PESOS_POR_DEFECTO };
    const encendidos = { ...TODOS_ENCENDIDOS };

    for (const k of CLAVES_PESO) {
      const p = Number(crudo?.pesos?.[k]);

      if (Number.isFinite(p) && p >= 0) pesos[k] = p;
      if (typeof crudo?.encendidos?.[k] === "boolean") encendidos[k] = crudo.encendidos[k] as boolean;
    }

    return CLAVES_PESO.some((k) => pesos[k] > 0) ? { pesos, encendidos } : { pesos: { ...PESOS_POR_DEFECTO }, encendidos };
  } catch {
    return { pesos: { ...PESOS_POR_DEFECTO }, encendidos: { ...TODOS_ENCENDIDOS } };
  }
}

export function guardaPreferencia(p: PreferenciaPesos) {
  try {
    window.localStorage.setItem(CLAVE_LOCAL, JSON.stringify(p));
  } catch {
    /* Sin almacén (ventana privada): se recuerda sólo mientras esté abierta. */
  }
}

export function olvidaPreferencia() {
  try {
    window.localStorage.removeItem(CLAVE_LOCAL);
  } catch {
    /* Nada que olvidar. */
  }
}
