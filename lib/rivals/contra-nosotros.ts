/**
 * CONTRA NOSOTROS (Plantillas rivales, 27/11/2026, idea de X).
 *
 * Si ya jugamos contra el rival esta temporada y Opta tiene el evento a
 * evento de ese partido (`opta:directo:<partido>`), cada jugador suyo se
 * compara consigo mismo: lo que hizo contra el Castilla frente a su media por
 * 90′ en el resto de sus partidos leídos (sin el nuestro).
 *
 * - Recibidos entre líneas: pases acertados en juego de un compañero que le
 *   llegan por dentro (del ancho del área, y de 18,3 a 81,7 de la y de Opta)
 *   entre la línea de medios y la de defensa del Castilla (de 58 a 83 de la x,
 *   hasta el borde del área). Es una aproximación por zona: Opta no da dónde
 *   están las líneas.
 * - Pases progresivos: `esProgresivo` (lib/opta-eventos), los mismos que en el
 *   resto de la app.
 * - xT: el de `amenazaDelPartido` (pases acertados + conducciones), el mismo
 *   de «Quién crea la amenaza».
 *
 * Se marca la cifra que pasa su media por 90′ en más de un 30 % (con lo de
 * contra nosotros llevado a 90′), si jugó 30′ o más ese día, su media sale de
 * 270′ o más y, en los recuentos, hizo al menos 2.
 *
 * Funciones puras: ni una cifra de Opta aquí (el repositorio es público).
 */

import { esPaseEnJuego, progresa } from "@/lib/opta-directo-mapas";
import { amenazaDelPartido, type PartidoXT } from "@/lib/rivals/amenaza-xt";

/** Zona «entre líneas» (x/y de Opta, 0-100 hacia la portería contraria). */
export const ENTRE_LINEAS = { x0: 58, x1: 83, y0: 18.3, y1: 81.7 };
/** Lo que tiene que pasar su media para marcarse (0,3 = un 30 % más). */
export const UMBRAL_SOBRE_MEDIA = 0.3;
export const MIN_MINUTOS_CONTRA = 30;
export const MIN_MINUTOS_MEDIA = 270;
const MIN_RECUENTO = 2;

export type ClaveMetrica = "entreLineas" | "progresivos" | "xt";
export const METRICAS: { clave: ClaveMetrica; nombre: string; corto: string; decimales: number }[] = [
  { clave: "entreLineas", nombre: "Recibidos entre líneas", corto: "Entre líneas", decimales: 0 },
  { clave: "progresivos", nombre: "Pases progresivos", corto: "Progresivos", decimales: 0 },
  { clave: "xt", nombre: "xT (pase + conducción)", corto: "xT", decimales: 2 },
];

type Cuenta = Record<ClaveMetrica, number>;
const cero = (): Cuenta => ({ entreLineas: 0, progresivos: 0, xt: 0 });

/** Las tres cifras de cada jugador de `teamId` en un partido. */
export function cifrasDelPartido(p: PartidoXT, teamId: string): Map<string, Cuenta> {
  const salida = new Map<string, Cuenta>();
  const de = (id: string) => {
    let c = salida.get(id);
    if (!c) salida.set(id, (c = cero()));
    return c;
  };
  const z = ENTRE_LINEAS;
  for (const e of p.eventos) {
    if (e.teamId !== teamId || !esPaseEnJuego(e) || !e.ok) continue;
    if (e.jugadorId && progresa(e)) de(e.jugadorId).progresivos++;
    if (e.receptorId && e.finX != null && e.finY != null && e.finX >= z.x0 && e.finX < z.x1 && e.finY >= z.y0 && e.finY <= z.y1) de(e.receptorId).entreLineas++;
  }
  for (const [id, a] of amenazaDelPartido(p, teamId)) de(id).xt += a.pases + a.conducciones;
  return salida;
}

export type MetricaContra = {
  clave: ClaveMetrica;
  /** Lo que hizo contra nosotros (tal cual). */
  contra: number;
  /** Lo de contra nosotros llevado a 90′. */
  contra90: number;
  /** Su media por 90′ en el resto de partidos leídos (null si no llega a la muestra). */
  media90: number | null;
  /** contra90 / media90 − 1 (null si no hay media). */
  sobreMedia: number | null;
  marcada: boolean;
};

export type JugadorContra = {
  playerId: string;
  jugador: string;
  minutosContra: number;
  minutosMedia: number;
  partidosMedia: number;
  metricas: MetricaContra[];
  marcadas: number;
};

/**
 * `contra` es el partido contra el Castilla; `resto`, los demás suyos con
 * evento a evento. Sólo entran los que jugaron contra nosotros.
 */
export function rendimientoContraNosotros(contra: PartidoXT, resto: PartidoXT[], teamId: string): JugadorContra[] {
  const enContra = cifrasDelPartido(contra, teamId);
  const minutosContra = new Map<string, { m: number; nombre: string }>();
  for (const j of contra.jugadores) if (j.teamId === teamId && j.id && j.minutos > 0) minutosContra.set(j.id, { m: j.minutos, nombre: j.nombre });

  const media = new Map<string, { m: number; partidos: number; c: Cuenta }>();
  for (const p of resto) {
    const jugaron = p.jugadores.filter((j) => j.teamId === teamId && j.id && j.minutos > 0);
    if (!jugaron.length) continue;
    const cifras = cifrasDelPartido(p, teamId);
    for (const j of jugaron) {
      if (!minutosContra.has(j.id)) continue;
      let a = media.get(j.id);
      if (!a) media.set(j.id, (a = { m: 0, partidos: 0, c: cero() }));
      a.m += j.minutos;
      a.partidos++;
      const c = cifras.get(j.id);
      if (c) for (const k of Object.keys(c) as ClaveMetrica[]) a.c[k] += c[k];
    }
  }

  const salida: JugadorContra[] = [];
  for (const [id, { m, nombre }] of minutosContra) {
    const c = enContra.get(id) ?? cero();
    const a = media.get(id);
    const conMedia = a != null && a.m >= MIN_MINUTOS_MEDIA;
    const metricas = METRICAS.map(({ clave }) => {
      const contra90 = (c[clave] / m) * 90;
      const media90 = conMedia ? (a!.c[clave] / a!.m) * 90 : null;
      const sobreMedia = media90 != null && media90 > 0 ? contra90 / media90 - 1 : null;
      const marcada =
        sobreMedia != null &&
        sobreMedia > UMBRAL_SOBRE_MEDIA &&
        m >= MIN_MINUTOS_CONTRA &&
        (clave === "xt" ? c[clave] > 0 : c[clave] >= MIN_RECUENTO);
      return { clave, contra: c[clave], contra90, media90, sobreMedia, marcada };
    });
    salida.push({
      playerId: id,
      jugador: nombre || `Jugador ${id}`,
      minutosContra: m,
      minutosMedia: a?.m ?? 0,
      partidosMedia: a?.partidos ?? 0,
      metricas,
      marcadas: metricas.filter((x) => x.marcada).length,
    });
  }
  return salida;
}

/** Los que más destacaron: más cifras marcadas y, a igualdad, más por encima de su media. */
export function destacadosContra(lista: JugadorContra[], cuantos = 3): JugadorContra[] {
  const exceso = (j: JugadorContra) => j.metricas.reduce((s, x) => s + (x.marcada ? Math.min(3, x.sobreMedia ?? 0) : 0), 0);
  return lista
    .filter((j) => j.marcadas > 0)
    .sort((a, b) => b.marcadas - a.marcadas || exceso(b) - exceso(a))
    .slice(0, cuantos);
}
