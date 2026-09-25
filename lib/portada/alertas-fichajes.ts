import type { Alerta } from "@/lib/data-analisis/alertas";

/**
 * FICHAJES RIVALES QUE BESOCCER YA SABE Y LA HOJA TODAVÍA NO.
 *
 * La pasada nocturna coteja cada plantilla rival con BeSoccer y encuentra las
 * altas y las bajas, pero **no las escribe**: una baja mal emparejada tacha a
 * un jugador que sigue en el equipo, y durante el mercado BeSoccer publica las
 * plantillas a medias. Eso no cambia y no debe cambiar.
 *
 * Lo que fallaba era otra cosa: el hallazgo se perdía. El informe se imprimía
 * en la consola, la tarea nocturna lo guardaba en un `.log` del ordenador del
 * club y nadie volvía a mirarlo. Gonzalo Melero salió como alta del Alcorcón
 * **cuatro noches seguidas** sin que nadie se enterara, y con él otras nueve
 * altas de la liga; se descubrió porque un entrenador echó en falta a un
 * jugador, que es la peor manera de descubrirlo.
 *
 * Así que ahora se ve en la portada. Sigue sin escribirse solo —hay que pasar
 * `rivals-altas-bajas.mjs --preparar` y `--escribir`, mirando la lista— pero ya
 * no se puede quedar dormido.
 *
 * El documento lo escribe `scripts/rivals-cotejo.mjs` en `rivals:cotejo`. Es
 * ligero a propósito: la portada lo lee en cada carga y el informe del rival
 * pesa diecinueve clasificaciones.
 */

export type CotejoRival = {
  cuando?: string;
  altas?: number;
  bajas?: number;
  pendientes?: {
    nombre?: string;
    altas?: { nombre?: string; puesto?: string }[];
    bajas?: { nombre?: string }[];
  }[];
};

/**
 * A partir de cuántos días el cotejo deja de ser de fiar.
 *
 * Si la pasada nocturna lleva sin correr casi una semana, lo que hay en el
 * documento ya no dice nada del mercado de hoy, y callarse sería peor: se
 * avisa de que el proceso está parado, que es otro problema distinto.
 */
const DIAS_VIEJO = 4;

export function alertasDeFichajes(cotejo: CotejoRival | null, ahora: number): Alerta[] {
  if (!cotejo) return [];

  const alertas: Alerta[] = [];

  const cuando = new Date(cotejo.cuando ?? "").getTime();

  const dias = Number.isFinite(cuando)
    ? Math.floor((ahora - cuando) / (24 * 60 * 60 * 1000))
    : null;

  /* El cotejo no se ha vuelto a pasar: lo que diga es de otra semana. */
  if (dias !== null && dias >= DIAS_VIEJO) {
    alertas.push({
      clave: "cotejo-parado",
      tono: "mala",
      area: "Rivales · BeSoccer",
      titulo: `Las plantillas rivales llevan ${dias} días sin cotejarse`,
      detalle:
        "La pasada nocturna del ordenador del club no está terminando. Mientras no corra, un fichaje rival puede llevar días sin aparecer y nadie se entera.",
      cifra: `${dias} días`,
      fuerza: Math.min(92, 55 + dias * 4),
      enlace: "/ajustes",
      mira: "Si la tarea nocturna ha corrido, y el registro de .cache/jornada-nocturna.",
    });
  }

  const altas = cotejo.altas ?? 0;
  const bajas = cotejo.bajas ?? 0;

  if (altas + bajas === 0) return alertas;

  /* Recién detectado no es noticia: BeSoccer publica las plantillas a medias y
     conviene dejar pasar una noche antes de dar la matraca. */
  if (dias !== null && dias < 0) return alertas;

  const equipos = (cotejo.pendientes ?? []).filter(
    (u) => (u.altas?.length ?? 0) + (u.bajas?.length ?? 0) > 0,
  );

  const nombres = equipos
    .slice(0, 3)
    .map((u) => {
      const quien = (u.altas ?? [])[0]?.nombre ?? (u.bajas ?? [])[0]?.nombre ?? "";

      return quien ? `${u.nombre} (${quien})` : String(u.nombre ?? "");
    })
    .filter(Boolean)
    .join(", ");

  const trozos: string[] = [];

  if (altas) trozos.push(`${altas} ${altas === 1 ? "alta" : "altas"}`);
  if (bajas) trozos.push(`${bajas} ${bajas === 1 ? "baja" : "bajas"}`);

  alertas.push({
    clave: "cotejo-pendiente",
    tono: "mala",
    area: "Rivales · BeSoccer",
    titulo: `${trozos.join(" y ")} sin escribir en plantillas rivales`,
    detalle: `${nombres}${equipos.length > 3 ? " y alguno más" : ""}. BeSoccer ya los tiene; la hoja no. No se escriben solos a propósito: hay que repasarlos antes.`,
    cifra: `${equipos.length} ${equipos.length === 1 ? "equipo" : "equipos"}`,
    /*
    | Una baja pesa más que un alta: un jugador que ya no está sigue saliendo
    | en el informe del próximo rival, y ahí sí se prepara un partido contra
    | alguien que no va a jugarlo.
    */
    fuerza: Math.min(90, 48 + altas * 3 + bajas * 8 + (dias ?? 0) * 2),
    enlace: "/rivals",
    mira: "Quién falta, y correr rivals-altas-bajas.mjs --preparar y --escribir.",
  });

  return alertas;
}
