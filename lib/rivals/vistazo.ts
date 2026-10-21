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

/** «3V 1E 4D»: con las mismas letras que la forma, que «3-1-4» no se sabe en qué orden va. */
export const balanceDe = (fila: FilaClasificacion) => `${fila.ganados}V ${fila.empatados}E ${fila.perdidos}D`;

/**
 * La misma franja en una frase, para leerla antes que las cifras.
 *
 * «Llega 13.º con 10 puntos, 3 victorias en sus últimos 5 y lejos de casa ha
 * ganado 1 de 4.» Sólo con lo que hay: sin tabla empieza por la forma, y sin nada no
 * hay frase. Las rachas se nombran cuando dicen algo (tres o más sin perder,
 * dos o más derrotas seguidas).
 */
export function fraseDelVistazo(vistazo: Vistazo | null): string {
  if (!vistazo) return "";

  const partes: string[] = [];

  if (vistazo.tabla) {
    const { puesto, puntos } = vistazo.tabla;
    partes.push(`${puesto}.º con ${puntos} ${puntos === 1 ? "punto" : "puntos"}`);
  }

  const forma = vistazo.forma;

  if (forma.length >= 3) {
    const ganados = forma.filter((r) => r.resultado === "G").length;

    let sinPerder = 0;
    while (sinPerder < forma.length && forma[sinPerder].resultado !== "P") sinPerder++;

    let derrotas = 0;
    while (derrotas < forma.length && forma[derrotas].resultado === "P") derrotas++;

    const racha =
      derrotas >= 2
        ? ` (pierde los ${derrotas} últimos)`
        : sinPerder >= 3
          ? ` (${sinPerder === forma.length ? "sin perder ninguno" : `${sinPerder} partidos seguidos sin perder`})`
          : "";

    partes.push(
      `${ganados === 0 ? "ninguna victoria" : `${ganados} ${ganados === 1 ? "victoria" : "victorias"}`} en sus últimos ${forma.length}${racha}`,
    );
  }

  if (vistazo.enEseCampo) {
    const { ganados, jugados } = vistazo.enEseCampo.fila;
    const donde = vistazo.enEseCampo.donde === "fuera" ? "lejos de casa" : "en su campo";

    partes.push(
      ganados === 0
        ? `${donde} no ha ganado ${jugados === 1 ? "su partido" : `ninguno de ${jugados}`}`
        : `${donde} ha ganado ${ganados} de ${jugados}`,
    );
  }

  if (!partes.length) return "";

  const lista = partes.length === 1 ? partes[0] : `${partes.slice(0, -1).join(", ")} y ${partes[partes.length - 1]}`;

  return `Llega ${lista}.`;
}
