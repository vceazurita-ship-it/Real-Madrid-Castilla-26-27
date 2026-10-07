/**
 * COPIAR UN MICROCICLO DE ABP SOBRE OTRO (07/10/2026).
 *
 * Una semana de balón parado se parece mucho a otra: la rutina de córner del
 * MD-3, el ensayo del MD-1. Copiarla ahorra montarla bloque a bloque.
 *
 * Se ata por **MD, no por la letra del día**: el micro del Sant Andreu va de
 * domingo a miércoles y otro de lunes a sábado, así que el «martes» de uno no
 * es el martes del otro, pero el MD-1 siempre es la víspera del partido. Sólo
 * cuando ninguno de los dos días tiene MD se cae a la misma letra.
 *
 * Cada bloque entra como copia (`duplicaTrabajo`): id nuevo y **sin vínculo con
 * la hoja de registro**, porque la fila de la hoja es del otro micro. Pasa a
 * ser planificación, como al duplicar dentro de la semana.
 */

import {
  DIA_KEYS,
  diasCompletos,
  duplicaTrabajo,
  type DiaKey,
  type MicroPlan,
} from "@/lib/abp/microciclo";

export type ModoCopia = "anadir" | "sustituir";

/** El MD de cada día de la semana, como «MD-3» o «MD». */
export type MdPorDia = Partial<Record<DiaKey, string>>;

export type ResultadoCopia = {
  plan: MicroPlan;
  /** Bloques que han entrado. */
  puestas: number;
  /** Bloques del otro micro sin día equivalente en éste. */
  sinPareja: number;
};

/** «md - 3», «MD-3» y «Md−3» son el mismo día. «MD» es el partido. */
export function normalizaMd(texto: string | undefined) {
  const limpio = (texto ?? "").toUpperCase().replace(/\s+/g, "").replace(/[−–]/g, "-");

  const numero = limpio.match(/^MD([+-]\d+)?$/);

  if (!numero) return "";

  return numero[1] && Number(numero[1]) !== 0 ? `MD${numero[1]}` : "MD";
}

export function copiaPlan(
  origen: MicroPlan,
  destino: MicroPlan,
  opciones: {
    modo: ModoCopia;
    /** Los MD de cada semana; mandan sobre los que traiga el plan escritos a mano. */
    mdOrigen: MdPorDia;
    mdDestino: MdPorDia;
    /** Los días que tiene la semana de destino, en su orden. */
    diasDestino: DiaKey[];
  },
): ResultadoCopia {
  const diasOrigen = diasCompletos(origen);
  const dias = diasCompletos(destino);

  const mdDe = (lado: MdPorDia, plan: typeof dias, dia: DiaKey) => normalizaMd(lado[dia] || plan[dia].md);

  const destinos = opciones.diasDestino.length ? opciones.diasDestino : DIA_KEYS;

  if (opciones.modo === "sustituir") {
    DIA_KEYS.forEach((dia) => {
      dias[dia] = { ...dias[dia], trabajos: [] };
    });
  }

  const destinoSinMd = destinos.every((dia) => !mdDe(opciones.mdDestino, dias, dia));

  let puestas = 0;
  let sinPareja = 0;

  DIA_KEYS.forEach((dia) => {
    const trabajos = diasOrigen[dia].trabajos;

    if (!trabajos.length) return;

    /* Si la semana de destino no tiene ningún MD (sin calendario ni hoja),
       atar por MD no colocaría nada: se va a la misma letra. */
    const md = destinoSinMd ? "" : mdDe(opciones.mdOrigen, diasOrigen, dia);

    const pareja = md
      ? destinos.find((otro) => mdDe(opciones.mdDestino, dias, otro) === md)
      : destinos.includes(dia) && !mdDe(opciones.mdDestino, dias, dia)
        ? dia
        : undefined;

    if (!pareja) {
      sinPareja += trabajos.length;

      return;
    }

    dias[pareja] = {
      ...dias[pareja],
      trabajos: [...dias[pareja].trabajos, ...trabajos.map(duplicaTrabajo)],
    };

    puestas += trabajos.length;
  });

  return { plan: { ...destino, dias }, puestas, sinPareja };
}
