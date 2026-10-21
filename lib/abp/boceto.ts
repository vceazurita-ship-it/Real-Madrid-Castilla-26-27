/**
 * EL BOCETO DEL MICROCICLO DE BALÓN PARADO.
 *
 * Propone —no cierra— la semana de ABP: qué día se trabaja, qué aspectos,
 * cuántos minutos y dónde cae cada cosa. Lo que sale entra en la pantalla como
 * un plan cualquiera, para que el cuerpo técnico lo mueva, lo recorte y lo
 * cierre.
 *
 * LOS DÍAS LOS PONE LA HOJA, NO EL CALENDARIO
 *
 * Un microciclo no es una semana natural: el del Sant Andreu va **de domingo a
 * miércoles** —se entrena el 20, el 21 y el 22 y se juega el 23—. Quién sabe
 * eso es la hoja de registro de tareas, donde el cuerpo técnico escribe el día,
 * el MD y la fecha de cada tarea. `lib/abp/ventana.ts` la lee y devuelve los
 * días; aquí sólo se reparte el trabajo entre ellos. **Si el microciclo no está
 * creado en la hoja, no hay boceto**: hay que crearlo primero.
 *
 * QUÉ DECIDE LOS ASPECTOS
 *
 * 1. **Nuestro rendimiento**: la urgencia de `lib/abp/transferencia.ts`, con lo
 *    que pasa en competición, lo mal que nos va cuando pasa y lo poco que se ha
 *    trabajado esta temporada.
 * 2. **El rival**: `lib/abp/rivalAbp.ts` (Wyscout por equipo, los goles de ABP
 *    calibrados con Opta y nuestras hojas si ya le jugamos). Lo que el rival
 *    **ataca** se defiende; lo que **concede** se ataca.
 *
 * DÓNDE CAE CADA COSA
 *
 * Lo específico del rival, pegado al partido, que es cuando se retiene; lo
 * nuestro, lo que no depende de quién venga, más lejos. El día antes no se
 * estrena nada: ensayo corto y suave de lo principal. Y el vídeo del rival,
 * antes del primer trabajo de campo que lo use. El vídeo y el ensayo **salen
 * del presupuesto de minutos**, no se suman encima.
 *
 * NO INVENTA NADA QUE NO SE PUEDA JUSTIFICAR: cada tarea sale con su motivo
 * escrito y con la cifra de la que viene, y los aspectos que ninguna hoja
 * registra se quedan fuera.
 */

import { objetivoDeLaSemana } from "@/lib/abp/informe-micro";
import { MARCA_BOCETO } from "@/lib/abp/minutos";
import { CRITERIO_ENSAYO, criterioDe } from "@/lib/abp/criterios";
import {
  ASPECTO_BY_KEY,
  DIA_KEYS,
  claveAspecto,
  diasCompletos,
  nuevoTrabajo,
  type AbpLado,
  type AbpMedio,
  type AbpMomento,
  type AbpRol,
  type AspectoKey,
  type DiaKey,
  type MicroPlan,
  type PlanDia,
  type Trabajo,
} from "@/lib/abp/microciclo";
import type { FilaCruce } from "@/lib/abp/transferencia";
import type { RivalAbp } from "@/lib/abp/rivalAbp";
import type { DiaMicro, VentanaMicro } from "@/lib/abp/ventana";

/* ------------------------------------------------------------------ */
/*  CRITERIOS                                                          */
/* ------------------------------------------------------------------ */

/**
 * Cuánto pesa cada cosa al elegir los aspectos.
 *
 * Se declaran aquí, como los de `transferencia.ts`, porque son un criterio del
 * cuerpo técnico y se van a querer discutir. Lo nuestro pesa algo más a
 * propósito: el rival cambia cada semana; lo que no sabemos hacer sigue ahí la
 * siguiente.
 */
export const PESOS_BOCETO = {
  nuestro: 0.55,
  rival: 0.45,
};

/** Cuántos aspectos distintos toca un microciclo. Más de esto es una lista, no un plan. */
export const ASPECTOS_POR_SEMANA = { minimo: 2, maximo: 6 };

/** Los minutos de una tarea se redondean a esto. */
const PASO_MINUTOS = 5;

const MINIMO_TAREA = 10;

/**
 * La marca que deja el boceto en sus tareas, para poder rehacerlo sin duplicar.
 * Vive en `lib/abp/minutos.ts` desde el 19/10/2026: ahí se decide si una tarea
 * del boceto suma minutos o sigue siendo una propuesta.
 */
export { MARCA_BOCETO };

export function esDelBoceto(trabajo: Trabajo) {
  return (trabajo.notas || "").startsWith(MARCA_BOCETO);
}

/* ------------------------------------------------------------------ */
/*  QUÉ TRABAJAR                                                       */
/* ------------------------------------------------------------------ */

export type Candidato = {
  aspecto: AspectoKey;
  lado: AbpLado;
  /** 0..1, lo que manda en el reparto. */
  puntos: number;
  nuestro: number;
  delRival: number;
  /** Si lo pide el rival o lo pedimos nosotros: cambia dónde cae. */
  esDelRival: boolean;
  motivo: string;
  minutos: number;
};

const normaliza = (valor: number, tope: number) =>
  tope > 0 ? Math.max(0, Math.min(1, valor / tope)) : 0;

/**
 * Ordena el catálogo por lo que pide este microciclo contra este rival.
 *
 * La urgencia nuestra viene ya calculada por aspecto y lado; del rival se usa
 * lo que ataca para nuestro trabajo **defensivo** y lo que concede para el
 * **ofensivo**. Un aspecto que ninguna hoja puede reconocer no entra: no es un
 * cero, es que no hay dónde mirar.
 */
export function ordenaCandidatos(
  filas: FilaCruce[],
  rival: RivalAbp | null,
  /** Nosotros mismos en la liga (Wyscout y Opta), como se mira a un rival. */
  nosotros: RivalAbp | null = null,
): Candidato[] {
  const urgencias = filas
    .map((fila) => fila.urgencia)
    .filter((valor): valor is number => valor != null);

  const topeUrgencia = Math.max(1, ...urgencias);

  const candidatos: Candidato[] = [];

  for (const fila of filas) {
    if (!fila.aspecto.reconocimiento) continue;

    /*
    | Nuestra urgencia sale de nuestras hojas (lo que anotamos de nosotros).
    | Desde el 11/10/2026 se cruza con DATA: nuestro sitio en la liga en esa
    | familia según Wyscout y los goles de ABP calibrados con Opta. Atacando,
    | cuanto más abajo estemos, más urge; defendiendo, cuanto más concedamos.
    | Pesa el 40 % de lo nuestro: la hoja ve el aspecto, la liga sólo la familia.
    */
    const enLaLiga =
      fila.lado === "ofensivo"
        ? nosotros?.ataca[fila.aspecto.key] != null
          ? 1 - (nosotros.ataca[fila.aspecto.key] as number)
          : null
        : (nosotros?.concede[fila.aspecto.key] ?? null);

    const deLaHoja = normaliza(fila.urgencia ?? 0, topeUrgencia);

    const nuestro = enLaLiga != null ? 0.6 * deLaHoja + 0.4 * enLaLiga : deLaHoja;

    const delRival =
      fila.lado === "defensivo"
        ? (rival?.ataca[fila.aspecto.key] ?? 0)
        : (rival?.concede[fila.aspecto.key] ?? 0);

    const puntos = PESOS_BOCETO.nuestro * nuestro + PESOS_BOCETO.rival * delRival;

    if (puntos <= 0) continue;

    candidatos.push({
      aspecto: fila.aspecto.key,
      lado: fila.lado,
      puntos,
      nuestro,
      delRival,
      /* Lo que pide el rival más que nosotros va pegado al partido. */
      esDelRival: PESOS_BOCETO.rival * delRival > PESOS_BOCETO.nuestro * nuestro,
      minutos: 0,
      motivo: motivoDe(fila, rival, delRival, nosotros),
    });
  }

  return candidatos.sort((a, b) => b.puntos - a.puntos);
}

/**
 * Quita de una lectura lo que no se puede defender delante del cuerpo técnico.
 *
 * Los goles de balón parado de la liga son una estimación calibrada («en
 * torno a un gol de falta»): sirven para ordenar, no para escribirlos en una
 * tarea. Se reconocen por «en torno a» (y por el «≈» de antes, por si queda
 * alguno guardado).
 */
export function limpiaLectura(texto: string) {
  return (texto || "")
    .split(/ · |; /)
    .map((trozo) => trozo.trim())
    .filter((trozo) => trozo && !trozo.includes("≈") && !trozo.includes("en torno a"))
    .join(", ")
    .replace(/\s*[;,.]\s*$/, "")
    .trim();
}

/**
 * El porqué de una tarea del boceto, como lo contaría el analista.
 *
 * Desde el 21/10/2026 va en lenguaje de campo y sin la cocina —ni «urgencia
 * 32/100» ni «su familia»—, porque se lee en la ficha de la semana con los
 * textos explicativos apagados: lo que dice QUÉ pasa se queda; cómo se
 * calcula, no.
 */
function motivoDe(fila: FilaCruce, rival: RivalAbp | null, delRival: number, nosotros: RivalAbp | null = null) {
  const frases: string[] = [];

  const acciones = fila.stats.acciones;

  if (fila.urgencia != null && acciones > 0) {
    const peligro = Math.round(fila.peligroAjustado);
    const media = Math.round(fila.referencia);

    const comparado =
      peligro > media
        ? `por encima del ${media} % habitual`
        : peligro < media
          ? `por debajo del ${media} % habitual`
          : "en la media";

    frases.push(
      fila.lado === "ofensivo"
        ? `Nuestro: ${acciones} a favor, ${peligro} % con peligro, ${comparado}`
        : `Nos han sacado ${acciones}, ${peligro} % con peligro suyo, ${comparado}`,
    );
  }

  /* Lo que dice la liga de nosotros en esa familia: atacando, lo que
     sacamos y rematamos; defendiendo, lo que concedemos. */
  const enLaLiga = limpiaLectura(
    nosotros?.motivos[claveAspecto(fila.aspecto.key, fila.lado === "ofensivo" ? "defensivo" : "ofensivo")] ?? "",
  );

  if (enLaLiga) frases.push(`Nosotros en la liga: ${enLaLiga}`);

  const dicho = limpiaLectura(rival?.motivos[claveAspecto(fila.aspecto.key, fila.lado)] ?? "");

  if (dicho && rival) frases.push(`${rival.equipo}: ${dicho}`);
  else if (delRival > 0 && rival) {
    frases.push(
      fila.lado === "defensivo"
        ? `${rival.equipo} lo usa por encima de la media`
        : `${rival.equipo} lo concede por encima de la media`,
    );
  }

  return frases.length ? `${frases.join(". ")}.` : "Completa la semana.";
}

/**
 * Reparte unos minutos entre los aspectos elegidos.
 *
 * Proporcional a los puntos, redondeado a cinco minutos y con un suelo: una
 * tarea de tres minutos no es una tarea. El sobrante del redondeo se ajusta en
 * el primero, que es el que más margen tiene.
 */
export function repartePorAspecto(
  candidatos: Candidato[],
  minutos: number,
  cuantosMaximo = ASPECTOS_POR_SEMANA.maximo,
): Candidato[] {
  if (minutos < MINIMO_TAREA || candidatos.length === 0) return [];

  const cuantos = Math.max(1, Math.min(cuantosMaximo, Math.floor(minutos / MINIMO_TAREA)));

  const elegidos = candidatos.slice(0, cuantos).map((uno) => ({ ...uno }));

  const suma = elegidos.reduce((total, uno) => total + uno.puntos, 0) || 1;

  let repartido = 0;

  elegidos.forEach((uno, indice) => {
    const bruto = (uno.puntos / suma) * minutos;

    uno.minutos =
      indice === elegidos.length - 1
        ? /* También al paso de cinco (21/10/2026): el resto a pelo dejaba
             tareas de 14′, que nadie programa así. */
          Math.max(MINIMO_TAREA, Math.round((minutos - repartido) / PASO_MINUTOS) * PASO_MINUTOS)
        : Math.max(MINIMO_TAREA, Math.round(bruto / PASO_MINUTOS) * PASO_MINUTOS);

    repartido += uno.minutos;
  });

  /* El ajuste también va de cinco en cinco: el objetivo es una horquilla, y
     cuadrarlo al minuto daba tareas de 14′ o de 23′. */
  const sobra = Math.round((repartido - minutos) / PASO_MINUTOS) * PASO_MINUTOS;

  if (sobra !== 0 && elegidos[0].minutos - sobra >= MINIMO_TAREA) {
    elegidos[0].minutos -= sobra;
  }

  return elegidos;
}

/* ------------------------------------------------------------------ */
/*  EL BOCETO                                                          */
/* ------------------------------------------------------------------ */

export type EntradaBoceto = {
  /** Los días del microciclo, de la hoja de registro. */
  ventana: VentanaMicro;
  filas: FilaCruce[];
  rival: RivalAbp | null;
  /** Nosotros en la liga (DATA: Wyscout y Opta), para cruzar con nuestra urgencia. */
  nosotros?: RivalAbp | null;
  /** El plan que ya hubiera, para no borrar lo escrito a mano. */
  plan?: MicroPlan;
};

export type Boceto = {
  dias: Record<DiaKey, PlanDia>;
  /** El orden del microciclo, que no es el de la semana natural. */
  orden: DiaKey[];
  diasEntrenados: number;
  minutos: number;
  minutosVideo: number;
  minutosEnsayo: number;
  objetivo: { minimo: number; maximo: number };
  candidatos: Candidato[];
  avisos: string[];
};

const ROLES_POR_LADO: Record<AbpLado, AbpRol[]> = {
  ofensivo: ["sacadores", "fijadores", "rematadores"],
  defensivo: ["fijadores", "rematadores"],
};

type Sitio = {
  momento: AbpMomento;
  medio: AbpMedio;
  intensidad: number;
  exigCognitiva: number;
};

/**
 * Cómo se trabaja según lo cerca que esté el partido.
 *
 * MD-1 no estrena nada: ensayo corto y suave. MD-2 y MD-3 son el grueso, donde
 * se puede exigir. Más lejos, intensidad media: el cuerpo viene del partido
 * anterior.
 */
function sitioDe(md: number | null): Sitio {
  const cuando = md ?? 4;

  if (cuando <= 1) return { momento: "post", medio: "campo", intensidad: 4, exigCognitiva: 6 };

  if (cuando <= 3) return { momento: "intra", medio: "campo", intensidad: 7, exigCognitiva: 7 };

  return { momento: "intra", medio: "campo", intensidad: 6, exigCognitiva: 5 };
}

export function construyeBoceto(entrada: EntradaBoceto): Boceto {
  const { ventana, filas, rival, nosotros = null } = entrada;

  const avisos = [...ventana.avisos];

  const entrenos = ventana.entrenos;

  const objetivo = objetivoDeLaSemana(0, entrenos.length, "marcados");

  const total = Math.round((objetivo.minimo + objetivo.maximo) / 2);

  /* ---------------------------------------------------------------- */
  /*  EL PRESUPUESTO                                                   */
  /* ---------------------------------------------------------------- */

  /*
  | El vídeo y el ensayo SALEN del presupuesto, no se suman encima.
  |
  | Sumándolos, un microciclo de tres entrenamientos se plantaba en 84′ con un
  | objetivo de 45-50′: el plan nacía pasado de vueltas y había que recortarlo a
  | mano, que es justo lo que el boceto tiene que ahorrar.
  |
  | Y si sólo cabe una de las dos cosas, cabe **el ensayo**: es lo último que
  | queda en la cabeza y lo que de verdad se ejecuta el día del partido.
  */
  const diaEnsayo = entrenos.find((dia) => (dia.md ?? 99) <= 1) ?? null;

  const minutosEnsayo =
    diaEnsayo && total >= 25
      ? Math.max(
          MINIMO_TAREA,
          Math.min(15, Math.round((total * 0.15) / PASO_MINUTOS) * PASO_MINUTOS),
        )
      : 0;

  const minutosVideo = rival && total - minutosEnsayo >= 20 ? 10 : 0;

  const deCampo = Math.max(0, total - minutosEnsayo - minutosVideo);

  const deTrabajo = entrenos.filter((dia) => dia !== diaEnsayo);

  const donde = deTrabajo.length > 0 ? deTrabajo : entrenos;

  const candidatos = repartePorAspecto(
    ordenaCandidatos(filas, rival, nosotros),
    deCampo,
    Math.max(ASPECTOS_POR_SEMANA.minimo, Math.min(ASPECTOS_POR_SEMANA.maximo, donde.length + 1)),
  );

  if (entrenos.length === 0) {
    avisos.push("Este microciclo no tiene días de entrenamiento en la hoja.");
  }

  if (!rival && ventana.partido) {
    avisos.push(
      `Sin datos de balón parado del ${ventana.partido.rival}: el boceto sale sólo de nuestro rendimiento.`,
    );
  }

  if (candidatos.length === 0 && entrenos.length > 0) {
    avisos.push(
      "Las hojas de ABP no han devuelto acciones que ordenar: el boceto marca los días, pero las tareas hay que ponerlas a mano.",
    );
  }

  /* ---------------------------------------------------------------- */
  /*  LOS DÍAS                                                         */
  /* ---------------------------------------------------------------- */

  const plan = diasCompletos(entrada.plan);

  /* El boceto no pisa lo escrito a mano: sólo se quita lo suyo de la vez
     anterior. */
  for (const clave of DIA_KEYS) {
    plan[clave] = {
      ...plan[clave],
      trabajos: plan[clave].trabajos.filter((trabajo) => !esDelBoceto(trabajo)),
    };
  }

  /*
  | Se marcan los días, pero NO se vacían.
  |
  | Antes, un día que la hoja deja sin sesión —o el propio día de partido— se
  | quedaba con la lista de trabajos en blanco: los diez minutos de vídeo del
  | rival que alguien hubiera puesto ahí a mano desaparecían al aplicar el
  | boceto, justo lo contrario de lo que promete el diálogo. Lo del boceto ya
  | se ha quitado arriba; lo demás es de su dueño.
  */
  for (const dia of ventana.dias) {
    plan[dia.clave] = {
      ...plan[dia.clave],
      tipo: dia.tipo,
      md: dia.rotulo,
    };
  }

  colocaTrabajo(plan, candidatos, donde, rival, minutosVideo);

  if (diaEnsayo && minutosEnsayo > 0 && candidatos.length > 0) {
    /*
    | Las dos principales DEL MISMO LADO (21/10/2026): con un córner ofensivo y
    | una banda defensiva, la tarea cruzaba aspectos y lados y el ensayo salía
    | con «banda ofensiva», que no se había trabajado en la semana: el ensayo
    | del día antes estrenaba algo, justo lo que promete no hacer.
    */
    const principales = candidatos.filter((uno) => uno.lado === candidatos[0].lado).slice(0, 2);

    plan[diaEnsayo.clave].trabajos.push(
      tareaDe(
        { ...principales[0], minutos: minutosEnsayo },
        sitioDe(1),
        `${MARCA_BOCETO} ensayo del día antes: se repasa lo principal del microciclo${
          ventana.partido ? ` para el ${ventana.partido.rival}` : ""
        }, sin estrenar nada.`,
        principales.map((uno) => uno.aspecto),
        [principales[0].lado],
        CRITERIO_ENSAYO,
      ),
    );
  }

  const minutos = DIA_KEYS.reduce(
    (suma, clave) =>
      suma + plan[clave].trabajos.reduce((parcial, uno) => parcial + (uno.minutos || 0), 0),
    0,
  );

  return {
    dias: plan,
    orden: ventana.dias.map((dia) => dia.clave),
    diasEntrenados: entrenos.length,
    minutos,
    minutosVideo,
    minutosEnsayo,
    objetivo: { minimo: objetivo.minimo, maximo: objetivo.maximo },
    candidatos,
    avisos,
  };
}

/**
 * Coloca las tareas de campo en sus días.
 *
 * Los días van de lejos a cerca del partido, así que los candidatos se ordenan
 * al revés de como se leen: **lo nuestro primero** —con el partido lejos, que
 * es cuando se puede enseñar algo nuevo— y **lo del rival al final**, pegado al
 * partido, que es lo que hay que tener fresco. Si hay más tareas que días, los
 * últimos días doblan.
 */
function colocaTrabajo(
  plan: Record<DiaKey, PlanDia>,
  candidatos: Candidato[],
  donde: DiaMicro[],
  rival: RivalAbp | null,
  minutosVideo: number,
) {
  if (candidatos.length === 0 || donde.length === 0) return;

  const orden = [...donde].sort((a, b) => (b.md ?? 0) - (a.md ?? 0));

  const enOrden = [...candidatos].sort((a, b) => {
    if (a.esDelRival !== b.esDelRival) return a.esDelRival ? 1 : -1;

    return a.puntos - b.puntos;
  });

  const porDia = new Map<DiaKey, Candidato[]>();

  /*
  | Se alinea por el FINAL, no por el principio.
  |
  | Los días van de lejos a cerca y los candidatos de lo nuestro a lo del
  | rival, así que el último candidato tiene que caer en el último día. Con la
  | alineación por el principio, un microciclo de cinco entrenamientos y dos
  | aspectos lo metía todo en MD-5 y MD-4 y dejaba MD-2 vacío: justo al revés
  | de lo que se quiere, que es llegar al partido con lo del rival reciente.
  */
  const desde = Math.max(0, orden.length - enOrden.length);

  enOrden.forEach((candidato, indice) => {
    const dia = orden[Math.min(orden.length - 1, desde + indice)];

    porDia.set(dia.clave, [...(porDia.get(dia.clave) ?? []), candidato]);
  });

  let primeroConRival: DiaKey | null = null;

  for (const dia of orden) {
    for (const candidato of porDia.get(dia.clave) ?? []) {
      if (candidato.minutos <= 0) continue;

      if (!primeroConRival && candidato.esDelRival) primeroConRival = dia.clave;

      plan[dia.clave].trabajos.push(
        tareaDe(candidato, sitioDe(dia.md), `${MARCA_BOCETO} ${candidato.motivo}`),
      );
    }
  }

  /*
  | Diez minutos de sala antes del primer trabajo de campo específico.
  |
  | Es lo que hace que ese trabajo se entienda: cómo saca, quién remata, cómo
  | se colocan. Sólo se pone si hay algo que enseñar.
  */
  if (rival && minutosVideo > 0) {
    const dia = primeroConRival ?? orden[Math.max(0, orden.length - 1)]?.clave;

    if (dia) {
      const delRival = candidatos.filter((uno) => uno.esDelRival).slice(0, 3);

      const paraVer = delRival.length > 0 ? delRival : candidatos.slice(0, 2);

      plan[dia].trabajos.unshift(
        tareaDe(
          { ...paraVer[0], minutos: minutosVideo },
          { momento: "pre", medio: "video", intensidad: 1, exigCognitiva: 7 },
          `${MARCA_BOCETO} vídeo del ${rival.equipo}: ${limpiaLectura(rival.resumen)}.`,
          paraVer.map((uno) => uno.aspecto),
          [...new Set(paraVer.map((uno) => uno.lado))],
        ),
      );
    }
  }
}

function tareaDe(
  candidato: Candidato,
  sitio: Sitio,
  notas: string,
  aspectos?: AspectoKey[],
  lados?: AbpLado[],
  /** El criterio de éxito; si no se da, el de partida del aspecto. */
  objetivo?: string,
): Trabajo {
  const suyos = (aspectos?.length ? aspectos : [candidato.aspecto]).filter((clave) =>
    ASPECTO_BY_KEY.has(clave),
  );

  const susLados = lados?.length ? lados : [candidato.lado];

  return nuevoTrabajo({
    aspectos: suyos,
    lados: susLados,
    momento: sitio.momento,
    medio: sitio.medio,
    roles:
      sitio.medio === "video"
        ? []
        : ([...new Set(susLados.flatMap((lado) => ROLES_POR_LADO[lado]))] as AbpRol[]),
    minutos: candidato.minutos,
    intensidad: sitio.intensidad,
    exigCognitiva: sitio.exigCognitiva,
    notas,
    objetivo: objetivo ?? criterioDe(suyos, susLados, sitio.medio),
  });
}
