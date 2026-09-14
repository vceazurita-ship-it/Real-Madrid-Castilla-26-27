import type { Alerta } from "@/lib/data-analisis/alertas";
import { alineaSeguimiento } from "@/lib/seguimiento";

/**
 * LAS ALERTAS QUE NO SALEN DE LOS INFORMES.
 *
 * Data Análisis contesta a «cómo va el equipo»; esto contesta a «qué se nos
 * está quedando sin hacer», que impacta igual en el rendimiento y no lo dice
 * ningún dato de Wyscout.
 *
 * De momento, el seguimiento individual: es lo único de otra área que la
 * portada **ya tiene abierto** —lo carga para la tarjeta de cobertura—, así que
 * sale gratis. Todo lo que hay aquí se calcula con lo que ya está en memoria:
 * el día que una alerta necesite abrir una hoja, deja de ir en la portada y
 * pasa a su pantalla.
 */

export type JugadorPlantilla = { id: string; nombre: string };

export type FilaSeguimiento = {
  ID_JUGADOR?: string;
  NOMBRE?: string;
  FECHA?: string;
};

/** A partir de aquí, un jugador lleva demasiado sin que nadie escriba de él. */
const DIAS_SIN_SEGUIMIENTO = 45;

/** Cobertura por debajo de la cual el seguimiento deja de ser seguimiento. */
const COBERTURA_FLOJA = 70;

/** Y a partir de aquí es una virtud del cuerpo técnico, no un trámite. */
const COBERTURA_BUENA = 90;

/**
 * El seguimiento individual, mirado desde la portada.
 *
 * `ahora` entra como argumento a propósito: mirar el reloj dentro de un
 * cálculo que se pinta lo vuelve impuro —y el linter de React lo para—, así
 * que lo pone quien llama, en un efecto.
 */
export function alertasDeSeguimiento(
  plantilla: JugadorPlantilla[],
  filas: FilaSeguimiento[],
  ahora: number,
): Alerta[] {
  if (plantilla.length === 0 || filas.length === 0) return [];

  /* Por nombre, que es lo que manda: un ID viejo apunta hoy a otra persona. */
  const atadas = alineaSeguimiento(
    filas.flatMap((fila) =>
      fila.ID_JUGADOR ? [{ ...fila, ID_JUGADOR: fila.ID_JUGADOR }] : [],
    ),
    plantilla,
  );

  const ultima = new Map<string, number>();

  for (const fila of atadas) {
    const cuando = new Date(fila.FECHA ?? "").getTime();

    if (!Number.isFinite(cuando)) continue;

    const previa = ultima.get(fila.ID_JUGADOR) ?? 0;

    if (cuando > previa) ultima.set(fila.ID_JUGADOR, cuando);
  }

  const conRegistro = plantilla.filter((j) => ultima.has(j.id));

  const cobertura = Math.round((conRegistro.length / plantilla.length) * 100);

  const limite = ahora - DIAS_SIN_SEGUIMIENTO * 24 * 60 * 60 * 1000;

  const olvidados = plantilla.filter((j) => (ultima.get(j.id) ?? 0) < limite);

  const alertas: Alerta[] = [];

  if (olvidados.length > 0) {
    const nombres = olvidados.slice(0, 4).map((j) => j.nombre).join(", ");

    alertas.push({
      clave: "seguimiento-olvidados",
      tono: "mala",
      area: "Individual · seguimiento",
      titulo: `${olvidados.length} ${olvidados.length === 1 ? "jugador lleva" : "jugadores llevan"} más de ${DIAS_SIN_SEGUIMIENTO} días sin seguimiento`,
      detalle: `${nombres}${olvidados.length > 4 ? " y alguno más" : ""}. Sin registro no hay conversación que preparar ni evolución que enseñar.`,
      cifra: `${conRegistro.length} de ${plantilla.length} con registro`,
      /* Cuantos más y más plantilla afectada, más arriba en la lista. */
      fuerza: Math.min(95, 45 + (olvidados.length / plantilla.length) * 100),
      enlace: "/individual_proc",
      mira: "A quién le toca, y cuándo fue la última vez.",
    });
  }

  if (cobertura <= COBERTURA_FLOJA && plantilla.length > 0) {
    alertas.push({
      clave: "seguimiento-cobertura",
      tono: "mala",
      area: "Individual · seguimiento",
      titulo: `Sólo ${cobertura} % de la plantilla tiene seguimiento`,
      detalle:
        "El seguimiento que no llega a todos no compara: de los que faltan no hay con qué contrastar lo que se ve en el campo.",
      cifra: `${conRegistro.length} de ${plantilla.length} jugadores`,
      fuerza: Math.min(90, 100 - cobertura),
      enlace: "/individual_proc",
      mira: "La cobertura jugador a jugador.",
    });
  }

  if (cobertura >= COBERTURA_BUENA) {
    alertas.push({
      clave: "seguimiento-al-dia",
      tono: "buena",
      area: "Individual · seguimiento",
      titulo: `El seguimiento llega al ${cobertura} % de la plantilla`,
      detalle:
        "Casi nadie se queda sin registro, así que lo que se dice en la charla individual se puede sostener con lo escrito.",
      cifra: `${conRegistro.length} de ${plantilla.length} jugadores`,
      fuerza: 55,
      enlace: "/individual_proc",
      mira: "Cuántas sesiones lleva cada uno.",
    });
  }

  return alertas;
}
