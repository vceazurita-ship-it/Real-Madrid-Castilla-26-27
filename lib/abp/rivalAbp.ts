/**
 * EL BALÓN PARADO DEL RIVAL, EN UNA CIFRA POR ASPECTO.
 *
 * Para planificar la semana hace falta contestar dos preguntas sobre el que
 * viene: **qué hace** (lo tendremos que defender) y **qué concede** (lo
 * podremos atacar). Las fuentes son tres y ninguna llega sola:
 *
 * - **Wyscout**, por equipo y de toda la liga: córners, faltas lanzadas,
 *   penaltis y el porcentaje de cada uno que acaba en remate, a favor y en
 *   contra (`/api/data-analisis?abpInforme=1`). Es lo único que existe para un
 *   rival al que todavía no hemos jugado, y llega **por familia**: córner,
 *   falta, penalti. No distingue un córner directo de uno en corto ni sabe nada
 *   de saques de banda.
 * - **Opta**, a través de los goles de ABP de la liga: sus factores de
 *   conversión (`lib/data-analisis/goles-abp.ts`, córner ×0,49 y falta ×1,35)
 *   son los que convierten remates en goles estimados por equipo.
 * - **Nuestras hojas**, cuando ya le hemos jugado: ahí sí hay aspecto por
 *   aspecto, porque lo anotó el analista. Manda sobre lo anterior en cuanto
 *   hay muestra.
 *
 * Lo que sale es un número de 0 a 1 por aspecto —su sitio en la liga, no un
 * valor absoluto— y una frase con la cifra de la que sale, para que el boceto
 * pueda decir **por qué** propone cada cosa.
 */

import type { FilaGolesAbp } from "@/lib/data-analisis/goles-abp";
import type { ComparativaAbp, FilaEquipoAbp } from "@/lib/abp/informe-graficos";
import { teamKey } from "@/lib/abp/model";
import {
  ASPECTOS,
  ASPECTO_BY_KEY,
  claveAspecto,
  type AspectoKey,
} from "@/lib/abp/microciclo";
import { encajaEnAspecto, type CompeticionEvent } from "@/lib/abp/competicion";

export type RivalAbp = {
  equipo: string;
  /** Lo que el rival genera atacando, 0..1 (su sitio en la liga). */
  ataca: Partial<Record<AspectoKey, number>>;
  /** Lo que concede defendiendo, 0..1. */
  concede: Partial<Record<AspectoKey, number>>;
  /** `claveAspecto(aspecto, lado)` → la frase con la cifra. */
  motivos: Record<string, string>;
  /** Una línea para el vídeo de la semana. */
  resumen: string;
  fuentes: string[];
  avisos: string[];
  /** Los partidos de Wyscout con los que se dice todo esto. */
  partidos: number;
};

/**
 * Cuánto de la familia hereda cada aspecto.
 *
 * Wyscout cuenta «córners» sin decir si se sacan al área o en corto, así que
 * el peso se reparte por lo que es más frecuente en la categoría. No es un
 * dato: es una forma honesta de no dar el mismo peso a lo raro que a lo común,
 * y por eso se escribe aquí y no en medio de una cuenta.
 */
const REPARTO: Record<AspectoKey, { familia: "corner" | "falta" | "penalti"; peso: number } | null> = {
  "corner-directo": { familia: "corner", peso: 1 },
  "corner-indirecto": { familia: "corner", peso: 0.6 },
  "falta-lateral-directa": { familia: "falta", peso: 1 },
  "falta-lateral-indirecta": { familia: "falta", peso: 0.6 },
  "falta-directa-porteria": { familia: "falta", peso: 0.8 },
  penalti: { familia: "penalti", peso: 0.4 },
  "banda-z1": null,
  "banda-z2": null,
  "banda-z3": null,
  "saque-medio": null,
  "reinicio-porteria": null,
  "libre-indirecto-area": null,
};

/** El sitio de un valor dentro de la liga, de 0 (el que menos) a 1 (el que más). */
function percentil(valor: number | null, todos: (number | null)[]) {
  if (valor == null) return null;

  const validos = todos.filter((uno): uno is number => uno != null && Number.isFinite(uno));

  if (validos.length < 3) return null;

  const pordebajo = validos.filter((uno) => uno < valor).length;

  return pordebajo / (validos.length - 1);
}

const media = (valores: (number | null)[]) => {
  const validos = valores.filter((uno): uno is number => uno != null && Number.isFinite(uno));

  return validos.length ? validos.reduce((a, b) => a + b, 0) / validos.length : null;
};

const cifra = (valor: number | null, decimales = 1) =>
  valor == null ? "—" : valor.toFixed(decimales).replace(".", ",");

const puesto = (valor: number | null, todos: (number | null)[]) => {
  const validos = todos.filter((uno): uno is number => uno != null && Number.isFinite(uno));

  if (valor == null || validos.length < 3) return "";

  const posicion = validos.filter((uno) => uno > valor).length + 1;

  return `${posicion}.º de ${validos.length}`;
};

export function buscaEnLaLiga(comparativa: ComparativaAbp | null, equipo: string) {
  if (!comparativa) return null;

  const clave = teamKey(equipo);

  return (
    comparativa.liga.find((fila) => teamKey(fila.equipo) === clave) ??
    comparativa.liga.find(
      (fila) => teamKey(fila.equipo).includes(clave) || clave.includes(teamKey(fila.equipo)),
    ) ??
    null
  );
}

export type EntradaRival = {
  equipo: string;
  comparativa: ComparativaAbp | null;
  /** Nuestras acciones de competición: las de este rival son oro. */
  events?: CompeticionEvent[];
  /** Los goles de ABP estimados que trae el propio paquete de Wyscout. */
  golesAbp?: FilaGolesAbp[];
};

/**
 * El perfil de balón parado del rival.
 *
 * Devuelve `null` cuando no hay absolutamente nada: es mejor que el boceto
 * diga «sin datos del rival» a que reparta ceros como si fueran medidas.
 */
export function construyeRivalAbp(entrada: EntradaRival): RivalAbp | null {
  const { equipo, comparativa, events = [] } = entrada;

  const golesAbp = entrada.golesAbp ?? comparativa?.golesAbp ?? [];

  const fila = buscaEnLaLiga(comparativa, equipo);

  const suyos = events.filter((event) => event.rivalKey === teamKey(equipo));

  if (!fila && suyos.length === 0) return null;

  const liga = comparativa?.liga ?? [];

  const fuentes: string[] = [];

  const avisos: string[] = [];

  const motivos: Record<string, string> = {};

  const ataca: Partial<Record<AspectoKey, number>> = {};

  const concede: Partial<Record<AspectoKey, number>> = {};

  /* ---------------------------------------------------------------- */
  /*  WYSCOUT: POR FAMILIA                                             */
  /* ---------------------------------------------------------------- */

  const valor = (uno: FilaEquipoAbp | null, key: string, cara: "favor" | "contra") =>
    uno?.valores?.[key]?.[cara] ?? null;

  const columna = (key: string, cara: "favor" | "contra") =>
    liga.map((otro) => valor(otro, key, cara));

  type Familia = "corner" | "falta" | "penalti";

  const familias: Record<Familia, { ataca: number | null; concede: number | null; dice: { ofensivo: string; defensivo: string } }> = {
    corner: { ataca: null, concede: null, dice: { ofensivo: "", defensivo: "" } },
    falta: { ataca: null, concede: null, dice: { ofensivo: "", defensivo: "" } },
    penalti: { ataca: null, concede: null, dice: { ofensivo: "", defensivo: "" } },
  };

  if (fila) {
    fuentes.push(`Wyscout (${fila.partidos} partidos de ${fila.equipo})`);

    /* El volumen y el acierto pesan igual: lanzar muchos córners sin rematar
       ninguno no es una amenaza, y rematar mucho sacando dos tampoco. */
    const mezcla = (volumen: string, remate: string, cara: "favor" | "contra") =>
      media([
        percentil(valor(fila, volumen, cara), columna(volumen, cara)),
        percentil(valor(fila, remate, cara), columna(remate, cara)),
      ]);

    familias.corner.ataca = mezcla("corners", "cornersRemate", "favor");
    familias.corner.concede = mezcla("corners", "cornersRemate", "contra");
    familias.falta.ataca = mezcla("faltasTiro", "faltasRemate", "favor");
    familias.falta.concede = mezcla("faltasTiro", "faltasRemate", "contra");

    familias.penalti.ataca = percentil(valor(fila, "penaltis", "favor"), columna("penaltis", "favor"));
    familias.penalti.concede = percentil(valor(fila, "penaltis", "contra"), columna("penaltis", "contra"));

    familias.corner.dice.defensivo = `${fila.equipo} saca ${cifra(valor(fila, "corners", "favor"))} córners por partido (${puesto(
      valor(fila, "corners", "favor"),
      columna("corners", "favor"),
    )}) y remata el ${cifra(valor(fila, "cornersRemate", "favor"), 0)} % (media ${cifra(
      media(columna("cornersRemate", "favor")),
      0,
    )} %)`;

    familias.corner.dice.ofensivo = `concede ${cifra(valor(fila, "corners", "contra"))} córners por partido y deja rematar el ${cifra(
      valor(fila, "cornersRemate", "contra"),
      0,
    )} % (media ${cifra(media(columna("cornersRemate", "contra")), 0)} %)`;

    familias.falta.dice.defensivo = `lanza ${cifra(valor(fila, "faltasTiro", "favor"))} faltas por partido y remata el ${cifra(
      valor(fila, "faltasRemate", "favor"),
      0,
    )} %`;

    familias.falta.dice.ofensivo = `comete faltas para ${cifra(valor(fila, "faltasTiro", "contra"))} lanzamientos por partido y deja rematar el ${cifra(
      valor(fila, "faltasRemate", "contra"),
      0,
    )} %`;

    familias.penalti.dice.defensivo = `${cifra(valor(fila, "penaltis", "favor"), 2)} penaltis a favor por partido`;

    familias.penalti.dice.ofensivo = `${cifra(valor(fila, "penaltis", "contra"), 2)} penaltis en contra por partido`;

    avisos.push(
      "Wyscout no separa el córner al área del jugado en corto ni mide los saques de banda: en esos aspectos manda nuestro rendimiento.",
    );
  }

  /* ---------------------------------------------------------------- */
  /*  OPTA: LOS GOLES DE ABP ESTIMADOS                                 */
  /* ---------------------------------------------------------------- */

  const golesSuyos = golesAbp.find((una) => teamKey(una.equipo) === teamKey(fila?.equipo ?? equipo));

  if (golesSuyos?.aFavor.hayOrigen) {
    fuentes.push("goles de ABP estimados con los factores calibrados con Opta");

    const marca = golesSuyos.aFavor;

    const encaja = golesSuyos.enContra;

    /* Los de córner y falta son estimación —se reparten los goles por el
       origen de los remates— y por eso van con «≈». Los de penalti sí son
       dato de Wyscout. */
    if (marca.corner + marca.falta > 0) {
      familias.corner.dice.defensivo += ` · ≈${marca.corner} gol(es) de córner en ${marca.partidos} partidos`;

      familias.falta.dice.defensivo += ` · ≈${marca.falta} gol(es) de falta`;
    }

    if (encaja.corner + encaja.falta > 0) {
      familias.corner.dice.ofensivo += ` · le han hecho ≈${encaja.corner} de córner`;

      familias.falta.dice.ofensivo += ` · ≈${encaja.falta} de falta`;
    }
  }

  /* ---------------------------------------------------------------- */
  /*  NUESTRAS HOJAS: ASPECTO POR ASPECTO                              */
  /* ---------------------------------------------------------------- */

  /*
  | Lo que le hemos visto manda sobre lo que dice la liga.
  |
  | Si ya le hemos jugado, el analista anotó cada acción suya con su aspecto y
  | su resultado: eso distingue el córner en corto del bombeado, que es
  | justamente lo que Wyscout no sabe. Se mezcla al 50 % en cuanto hay cinco
  | acciones, y por debajo de eso no se toca nada: tres córners no son un
  | patrón.
  */
  const MINIMO = 5;

  const vistos = new Map<string, { acciones: number; peligro: number }>();

  if (suyos.length > 0) {
    for (const aspecto of ASPECTOS) {
      if (!aspecto.reconocimiento) continue;

      for (const lado of ["ofensivo", "defensivo"] as const) {
        /* Nuestro lado «defensivo» son SUS acciones de ataque. */
        const delAspecto = suyos.filter(
          (event) => event.lado === lado && encajaEnAspecto(event, aspecto),
        );

        if (delAspecto.length === 0) continue;

        vistos.set(claveAspecto(aspecto.key, lado), {
          acciones: delAspecto.length,
          peligro: delAspecto.filter((event) => event.peligro).length / delAspecto.length,
        });
      }
    }

    if ([...vistos.values()].some((uno) => uno.acciones >= MINIMO)) {
      fuentes.push("nuestras hojas del partido que ya le jugamos");
    }
  }

  /* ---------------------------------------------------------------- */
  /*  DE FAMILIA A ASPECTO                                             */
  /* ---------------------------------------------------------------- */

  for (const aspecto of ASPECTOS) {
    const reparto = REPARTO[aspecto.key];

    for (const lado of ["ofensivo", "defensivo"] as const) {
      const clave = claveAspecto(aspecto.key, lado);

      /* Defendiendo nos importa lo que ataca; atacando, lo que concede. */
      const deLaLiga =
        reparto == null
          ? null
          : lado === "defensivo"
            ? familias[reparto.familia].ataca
            : familias[reparto.familia].concede;

      const visto = vistos.get(clave);

      const propio =
        visto && visto.acciones >= MINIMO ? Math.max(0, Math.min(1, visto.peligro * 2.5)) : null;

      const valorFinal =
        propio != null && deLaLiga != null
          ? 0.5 * propio + 0.5 * deLaLiga * (reparto?.peso ?? 1)
          : propio != null
            ? propio
            : deLaLiga != null
              ? deLaLiga * (reparto?.peso ?? 1)
              : null;

      if (valorFinal == null) continue;

      if (lado === "defensivo") ataca[aspecto.key] = valorFinal;
      else concede[aspecto.key] = valorFinal;

      const trozos: string[] = [];

      if (reparto && familias[reparto.familia].dice[lado]) {
        trozos.push(familias[reparto.familia].dice[lado]);
      }

      if (visto && visto.acciones >= MINIMO) {
        trozos.push(
          `en nuestro partido: ${visto.acciones} ${ASPECTO_BY_KEY.get(aspecto.key)?.short ?? ""} con ${Math.round(
            visto.peligro * 100,
          )} % de peligro`,
        );
      }

      if (trozos.length > 0) motivos[clave] = trozos.join(" · ");
    }
  }

  const mayor = (Object.entries(ataca) as [AspectoKey, number][]).sort((a, b) => b[1] - a[1])[0];

  const resumen = mayor
    ? `lo que más hace es ${ASPECTO_BY_KEY.get(mayor[0])?.label.toLowerCase() ?? mayor[0]}; ${
        motivos[claveAspecto(mayor[0], "defensivo")] ?? "sin más detalle"
      }.`
    : "no hay suficiente para decir por dónde aprieta.";

  return {
    equipo: fila?.equipo ?? equipo,
    ataca,
    concede,
    motivos,
    resumen,
    fuentes,
    avisos,
    partidos: fila?.partidos ?? 0,
  };
}
