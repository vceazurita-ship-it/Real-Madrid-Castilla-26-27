/**
 * UN SOLO VEREDICTO DE CENTROS (27/11/2026, ronda 10, jueces de fútbol).
 *
 * Área del rival decía «su peligro no llega por fuera» (13,5 centros por
 * partido, 14.º de 20) y Plantillas rivales, el Scout colectivo y el Plan,
 * «cerrar el carril de Duran antes del centro». Las cuatro pantallas leen
 * ahora esta regla, la misma de `queHacemosConCentros` en
 * components/abp/AbpWyscoutRival.tsx: «mucho» es por encima de la mediana de
 * la liga en centros laterales por partido; el acierto («centros precisos %»)
 * es bueno o malo sólo si se separa más de 2 puntos de la mediana y no es
 * tendencia (menos de 15 precisos o de 25 centros).
 *
 * Las filas son las de `/api/data-analisis?abpRival=<equipo>&ambito=area`.
 */

export type FilaCentros = {
  nombre: string;
  valor: number;
  mediana: number;
  unidad: string;
  puesto?: number | null;
  de?: number | null;
  base?: { arriba: number; abajo: number } | null;
  partidos?: number;
};

export type VeredictoCentros = {
  /** Centra más que la mediana de la liga. */
  muchos: boolean;
  bien: boolean;
  mal: boolean;
  /** «Centra poco (13,5 por partido, 14.º de 20) y con acierto normal (33,1 %)». */
  frase: string;
  /** Partidos de Wyscout de la cuenta. */
  partidos: number | null;
};

const POCOS_CASOS = 15;

const coma1 = (v: number) => v.toFixed(1).replace(".", ",");

export function veredictoCentros(filas: FilaCentros[]): VeredictoCentros | null {
  const volumen = filas.find((f) => f.nombre === "Centros laterales");
  const acierto = filas.find((f) => f.nombre === "Centros precisos %");

  if (!volumen || !Number.isFinite(volumen.valor) || !Number.isFinite(volumen.mediana)) return null;

  const muchos = volumen.valor > volumen.mediana;
  const tendencia = !!acierto?.base && (acierto.base.arriba < POCOS_CASOS || acierto.base.abajo < 25);
  const dif = acierto ? acierto.valor - acierto.mediana : 0;
  const bien = !!acierto && dif > 2 && !tendencia;
  const mal = !!acierto && dif < -2 && !tendencia;
  const puesto = volumen.puesto && volumen.de ? `, ${volumen.puesto}.º de ${volumen.de}` : "";
  const deAcierto = acierto && Number.isFinite(acierto.valor)
    ? ` y con ${bien ? "buen acierto" : mal ? "poco acierto" : "acierto normal"} (${coma1(acierto.valor)} %)`
    : "";

  return {
    muchos,
    bien,
    mal,
    frase: `Centra ${muchos ? "mucho" : "poco"} (${coma1(volumen.valor)} por partido${puesto})${deAcierto}`,
    partidos: volumen.partidos ?? acierto?.partidos ?? null,
  };
}
