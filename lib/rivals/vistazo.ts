/**
 * EL RIVAL DE UN VISTAZO (21/10/2026).
 *
 * Lo primero que se pregunta al abrir la plantilla de un rival no es quién es
 * su lateral izquierdo, sino **cómo llega**: dónde está en la tabla, cómo le va
 * en el campo donde nos recibe (o donde le recibimos), qué dibujo saca y quién
 * le hace los goles. Todo eso ya está en el documento del informe de BeSoccer
 * (`rivals:informe`), que la pantalla baja al entrar para colocar el
 * campograma; aquí sólo se lee.
 *
 * Regla de la casa: lo que no tiene dato no se nombra. Cada pieza es `null` o
 * una lista vacía cuando falta, y la tarjeta no la pinta.
 */
import {
  esLiga,
  filaPropia,
  jugados,
  type FilaClasificacion,
  type Goleador,
  type InformeEquipo,
  type Partido,
} from "@/lib/rivals/informe";

export type ResultadoForma = {
  resultado: "G" | "E" | "P";
  /** «2-1», siempre con los goles del rival delante. */
  marcador: string;
  rival: string;
  enCasa: boolean;
  /** «18/10». */
  fecha: string;
};

export type Vistazo = {
  tabla: (FilaClasificacion & { equipos: number }) | null;
  /** Su balance en el campo del partido contra nosotros: fuera si jugamos en casa. */
  enEseCampo: { fila: FilaClasificacion; donde: "en casa" | "fuera" } | null;
  /** Los últimos partidos de liga, del más reciente al más antiguo. */
  forma: ResultadoForma[];
  dibujo: { estructura: string; veces: number; de: number } | null;
  goleadores: Goleador[];
};

/** Cuántos resultados entran en la forma. */
export const PARTIDOS_FORMA = 5;

const fechaCorta = (iso: string) => {
  const dia = iso.match(/^(\d{4})-(\d{2})-(\d{2})/);
  return dia ? `${dia[3]}/${dia[2]}` : "";
};

function resultadoDe(partido: Partido): ResultadoForma | null {
  if (!partido.jugado || !partido.resultado) return null;

  const suyo = partido.enCasa ? partido.local : partido.visitante;
  const otro = partido.enCasa ? partido.visitante : partido.local;

  if (suyo.goles === null || otro.goles === null) return null;

  return {
    resultado: partido.resultado,
    marcador: `${suyo.goles}-${otro.goles}`,
    rival: otro.nombre,
    enCasa: partido.enCasa,
    fecha: fechaCorta(partido.fecha),
  };
}

/**
 * @param nosotrosEnCasa el partido contra nosotros es en nuestro campo (la
 *   hoja lo dice en `LOCAL_VISITANTE`); `null` si no se sabe.
 */
export function vistazoDe(
  informe: InformeEquipo | null,
  nosotrosEnCasa: boolean | null,
): Vistazo | null {
  if (!informe) return null;

  const total = informe.clasificacion?.total ?? [];
  const propia = total.length ? filaPropia(total, informe) : null;

  const tabla = propia && propia.jugados > 0 ? { ...propia, equipos: total.length } : null;

  let enEseCampo: Vistazo["enEseCampo"] = null;

  if (nosotrosEnCasa !== null) {
    const filas = nosotrosEnCasa
      ? informe.clasificacion?.visitante ?? []
      : informe.clasificacion?.local ?? [];
    const fila = filas.length ? filaPropia(filas, informe) : null;

    if (fila && fila.jugados > 0) {
      enEseCampo = { fila, donde: nosotrosEnCasa ? "fuera" : "en casa" };
    }
  }

  const deLiga = jugados(informe).filter(esLiga);

  const forma = deLiga
    .map(resultadoDe)
    .filter((r): r is ResultadoForma => r !== null)
    .slice(0, PARTIDOS_FORMA);

  const de = (informe.estructuras ?? []).reduce((suma, e) => suma + e.veces, 0);
  const primera = informe.estructuras?.[0];

  const dibujo = primera && primera.estructura && de > 0 ? { estructura: primera.estructura, veces: primera.veces, de } : null;

  const goleadores = (informe.goleadores ?? []).filter((g) => g.goles > 0).slice(0, 3);

  if (!tabla && !forma.length && !dibujo && !goleadores.length) return null;

  return { tabla, enEseCampo, forma, dibujo, goleadores };
}

/** «12 pts · 3-3-2» → texto del balance, sin puntos si no los hay. */
export const balanceDe = (fila: FilaClasificacion) => `${fila.ganados}-${fila.empatados}-${fila.perdidos}`;
