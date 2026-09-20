/**
 * EL BOCETO DE LA SEMANA DE BALÓN PARADO.
 *
 * Propone —no cierra— el microciclo de ABP: qué día se entrena, qué aspectos
 * se trabajan, cuántos minutos lleva cada uno y dónde cae dentro de la semana.
 * Lo que sale entra en la pantalla como un plan cualquiera, para que el cuerpo
 * técnico lo mueva, lo recorte y lo cierre.
 *
 * LA SEMANA LA DICTA EL CALENDARIO, NO EL CALENDARIO LA SEMANA
 *
 * El plan de la pantalla es de lunes a domingo. Lo que cambia cada semana es
 * **dónde cae el partido**, y eso lo manda todo: de domingo a domingo hay seis
 * entrenamientos; con partido el miércoles y otro el domingo, hay dos antes del
 * primero y tres entre los dos. Las fechas salen de BeSoccer
 * (`lib/castilla/calendario.ts`), y cada día de la semana se prepara **para su
 * partido**, que no tiene por qué ser el mismo para todos.
 *
 * QUÉ DECIDE LOS ASPECTOS
 *
 * 1. **Nuestro rendimiento**: la urgencia que ya calcula
 *    `lib/abp/transferencia.ts` con lo que pasa en competición, lo mal que nos
 *    va cuando pasa y lo poco que se ha trabajado esta temporada.
 * 2. **El rival de ese partido** (`lib/abp/rivalAbp.ts`: Wyscout por equipo,
 *    los goles de ABP calibrados con Opta y nuestras hojas si ya le jugamos).
 *    Lo que el rival **ataca** se defiende; lo que **concede** se ataca.
 *
 * DÓNDE CAE CADA COSA
 *
 * Lo específico del rival, pegado al partido (MD-3 y MD-2), que es cuando se
 * retiene; lo nuestro, lo que no depende de quién venga, más lejos. El día
 * antes no se estrena nada: se ensaya lo principal, corto y suave. Y el vídeo
 * del rival, antes del primer trabajo de campo que lo use.
 *
 * NO INVENTA NADA QUE NO SE PUEDA JUSTIFICAR: cada tarea sale con su motivo
 * escrito y con la cifra de la que viene, y los aspectos que ninguna hoja
 * registra se quedan fuera.
 */

import {
  diasEntre,
  soloDia,
  type PartidoNuestro,
} from "@/lib/castilla/calendario";
import { objetivoDeLaSemana } from "@/lib/abp/informe-micro";
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

/* ------------------------------------------------------------------ */
/*  CRITERIOS                                                          */
/* ------------------------------------------------------------------ */

/**
 * Cuánto pesa cada cosa al elegir los aspectos de la semana.
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

/** Cuántos aspectos distintos toca una semana. Más de esto es una lista, no un plan. */
export const ASPECTOS_POR_SEMANA = { minimo: 2, maximo: 6 };

/** Los minutos de una tarea se redondean a esto. */
const PASO_MINUTOS = 5;

const MINIMO_TAREA = 10;

/** La marca que deja el boceto en sus tareas, para poder rehacerlo sin duplicar. */
export const MARCA_BOCETO = "Boceto ·";

export function esDelBoceto(trabajo: Trabajo) {
  return (trabajo.notas || "").startsWith(MARCA_BOCETO);
}

/* ------------------------------------------------------------------ */
/*  LA SEMANA NATURAL                                                  */
/* ------------------------------------------------------------------ */

const DIA_MS = 86_400_000;

const CLAVE_DIA: DiaKey[] = ["D", "L", "M", "X", "J", "V", "S"];

const aMedioDia = (dia: string) => Date.parse(`${dia}T12:00:00Z`);

/** La inicial del día de la semana de una fecha "2026-09-23". */
export function diaKeyDe(fecha: string): DiaKey {
  return CLAVE_DIA[new Date(aMedioDia(fecha)).getUTCDay()];
}

/** Los siete días, de lunes a domingo, de la semana en la que cae una fecha. */
export function semanaDe(fecha: string): string[] {
  const dia = new Date(aMedioDia(soloDia(fecha)));

  /* getUTCDay: 0 es domingo. La semana empieza en lunes. */
  const desdeLunes = (dia.getUTCDay() + 6) % 7;

  const lunes = dia.getTime() - desdeLunes * DIA_MS;

  return Array.from({ length: 7 }, (_, i) =>
    new Date(lunes + i * DIA_MS).toISOString().slice(0, 10),
  );
}

export type DiaDelPlan = {
  fecha: string;
  clave: DiaKey;
  tipo: "entreno" | "descanso" | "partido";
  /** El partido para el que se prepara ese día. */
  prepara: PartidoNuestro | null;
  /** Días que faltan para su partido. */
  md: number | null;
  rotulo: string;
};

/**
 * Qué es cada día de la semana: partido, descanso o entrenamiento, y para qué
 * partido se entrena.
 *
 * El día siguiente a un partido se propone como descanso —es lo que hace todo
 * el mundo y es lo primero que el cuerpo técnico mueve si no le vale—, salvo
 * que el siguiente partido esté encima: con dos días por medio no se descansa
 * el primero.
 */
export function repartoDeLaSemana(
  fechas: string[],
  partidos: PartidoNuestro[],
): DiaDelPlan[] {
  const jugados = partidos
    .map((uno) => ({ ...uno, dia: soloDia(uno.cuando) }))
    .sort((a, b) => a.dia.localeCompare(b.dia));

  return fechas.map((fecha) => {
    const suyo = jugados.find((uno) => uno.dia === fecha) ?? null;

    const siguiente = jugados.find((uno) => uno.dia >= fecha) ?? null;

    const anterior = [...jugados].reverse().find((uno) => uno.dia < fecha) ?? null;

    const md = siguiente ? diasEntre(fecha, siguiente.dia) : null;

    if (suyo) {
      return {
        fecha,
        clave: diaKeyDe(fecha),
        tipo: "partido" as const,
        prepara: suyo,
        md: 0,
        rotulo: "MD",
      };
    }

    const alDiaSiguiente = anterior ? diasEntre(anterior.dia, fecha) === 1 : false;

    /* Con el siguiente partido a menos de tres días no se descansa: no hay
       semana que repartir, hay que preparar. */
    const descansa = alDiaSiguiente && (md == null || md >= 3);

    return {
      fecha,
      clave: diaKeyDe(fecha),
      tipo: descansa ? ("descanso" as const) : ("entreno" as const),
      prepara: siguiente,
      md,
      rotulo: md == null ? "" : `MD-${md}`,
    };
  });
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
  /** Si lo pide el rival o lo pedimos nosotros: cambia dónde cae en la semana. */
  esDelRival: boolean;
  motivo: string;
  minutos: number;
};

const normaliza = (valor: number, tope: number) =>
  tope > 0 ? Math.max(0, Math.min(1, valor / tope)) : 0;

/**
 * Ordena el catálogo por lo que pide esta semana contra este rival.
 *
 * La urgencia nuestra viene ya calculada por aspecto y lado; del rival se usa
 * lo que ataca para nuestro trabajo **defensivo** y lo que concede para el
 * **ofensivo**. Un aspecto que ninguna hoja puede reconocer no entra: no es un
 * cero, es que no hay dónde mirar.
 */
export function ordenaCandidatos(
  filas: FilaCruce[],
  rival: RivalAbp | null,
): Candidato[] {
  const urgencias = filas
    .map((fila) => fila.urgencia)
    .filter((valor): valor is number => valor != null);

  const topeUrgencia = Math.max(1, ...urgencias);

  const candidatos: Candidato[] = [];

  for (const fila of filas) {
    if (!fila.aspecto.reconocimiento) continue;

    const nuestro = normaliza(fila.urgencia ?? 0, topeUrgencia);

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
      motivo: motivoDe(fila, rival, delRival),
    });
  }

  return candidatos.sort((a, b) => b.puntos - a.puntos);
}

function motivoDe(fila: FilaCruce, rival: RivalAbp | null, delRival: number) {
  const trozos: string[] = [];

  if (fila.urgencia != null) {
    trozos.push(
      `urgencia ${Math.round(fila.urgencia)}/100 (${fila.stats.acciones} acciones, ${Math.round(
        fila.peligroAjustado,
      )} % de peligro contra ${Math.round(fila.referencia)} % de su familia)`,
    );
  }

  const dicho = rival?.motivos[claveAspecto(fila.aspecto.key, fila.lado)];

  if (dicho) trozos.push(dicho);
  else if (delRival > 0 && rival) {
    trozos.push(
      fila.lado === "defensivo"
        ? `${rival.equipo} lo usa por encima de la media`
        : `${rival.equipo} lo concede por encima de la media`,
    );
  }

  return trozos.join(" · ") || "propuesto por catálogo: no hay datos que lo ordenen";
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

  const cuantos = Math.max(
    1,
    Math.min(cuantosMaximo, Math.floor(minutos / MINIMO_TAREA)),
  );

  const elegidos = candidatos.slice(0, cuantos).map((uno) => ({ ...uno }));

  const suma = elegidos.reduce((total, uno) => total + uno.puntos, 0) || 1;

  let repartido = 0;

  elegidos.forEach((uno, indice) => {
    const bruto = (uno.puntos / suma) * minutos;

    uno.minutos =
      indice === elegidos.length - 1
        ? Math.max(MINIMO_TAREA, minutos - repartido)
        : Math.max(MINIMO_TAREA, Math.round(bruto / PASO_MINUTOS) * PASO_MINUTOS);

    repartido += uno.minutos;
  });

  const sobra = repartido - minutos;

  if (sobra !== 0 && elegidos[0].minutos - sobra >= MINIMO_TAREA) {
    elegidos[0].minutos -= sobra;
  }

  return elegidos;
}

/* ------------------------------------------------------------------ */
/*  EL BOCETO                                                          */
/* ------------------------------------------------------------------ */

export type EntradaBoceto = {
  /** Los siete días de la semana que se planifica, de lunes a domingo. */
  fechas: string[];
  /** Nuestros partidos, para saber cuáles caen dentro y qué prepara cada día. */
  partidos: PartidoNuestro[];
  filas: FilaCruce[];
  /** El perfil de cada rival de la semana, por nombre de rival. */
  rivales: Record<string, RivalAbp | null>;
  /** El plan que ya hubiera, para no borrar lo escrito a mano. */
  plan?: MicroPlan;
};

export type Bloque = {
  partido: PartidoNuestro;
  dias: DiaDelPlan[];
  /**
   * El partido cae fuera de esta semana: estos días son el arranque del
   * microciclo siguiente. Se trabaja lo nuestro, no lo del rival, que para eso
   * ya habrá semana.
   */
  esArranque: boolean;
  /** Todo lo que tiene este partido: trabajo, vídeo y ensayo. */
  minutos: number;
  /** Lo que se lleva el vídeo del rival y el ensayo del día antes. */
  minutosVideo: number;
  minutosEnsayo: number;
  candidatos: Candidato[];
};

export type Boceto = {
  dias: Record<DiaKey, PlanDia>;
  diasEntrenados: number;
  minutos: number;
  objetivo: { minimo: number; maximo: number };
  bloques: Bloque[];
  reparto: DiaDelPlan[];
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
function sitioDe(md: number): Sitio {
  if (md <= 1) return { momento: "post", medio: "campo", intensidad: 4, exigCognitiva: 6 };

  if (md <= 3) return { momento: "intra", medio: "campo", intensidad: 7, exigCognitiva: 7 };

  return { momento: "intra", medio: "campo", intensidad: 6, exigCognitiva: 5 };
}

export function construyeBoceto(entrada: EntradaBoceto): Boceto {
  const { fechas, partidos, filas, rivales } = entrada;

  const avisos: string[] = [];

  const reparto = repartoDeLaSemana(fechas, partidos);

  const entrenos = reparto.filter((dia) => dia.tipo === "entreno");

  const objetivo = objetivoDeLaSemana(0, entrenos.length, "marcados");

  const total = Math.round((objetivo.minimo + objetivo.maximo) / 2);

  /* ---------------------------------------------------------------- */
  /*  LOS BLOQUES: UN PARTIDO PUEDE NO SER EL ÚNICO DE LA SEMANA       */
  /* ---------------------------------------------------------------- */

  const porPartido = new Map<string, DiaDelPlan[]>();

  for (const dia of entrenos) {
    if (!dia.prepara) continue;

    const clave = dia.prepara.cuando;

    porPartido.set(clave, [...(porPartido.get(clave) ?? []), dia]);
  }

  const bloques: Bloque[] = [];

  const diasConPartido = [...porPartido.values()].reduce(
    (suma, dias) => suma + dias.length,
    0,
  );

  for (const [cuando, dias] of porPartido) {
    const partido = dias[0].prepara!;

    const esArranque = !fechas.includes(soloDia(partido.cuando));

    const rival = esArranque ? null : (rivales[partido.rival] ?? null);

    /* Los minutos se reparten entre los partidos por días de preparación: una
       semana con dos partidos no tiene noventa minutos para cada uno. */
    const suyos =
      diasConPartido > 0 ? Math.round((total * dias.length) / diasConPartido) : 0;

    /*
    | El vídeo y el ensayo SALEN del presupuesto, no se suman encima.
    |
    | Sumándolos, una semana de dos partidos se plantaba en 84′ con un objetivo
    | de 60-67′: el plan nacía pasado de vueltas y había que recortarlo a mano,
    | que es justo lo que el boceto tiene que ahorrar.
    */
    /*
    | Primero el ensayo, y sólo después el vídeo.
    |
    | Si hay un día antes del partido, ese día se ensaya: es lo último que
    | queda en la cabeza y lo que de verdad se ejecuta el domingo. El vídeo es
    | importante, pero si sólo cabe una de las dos cosas, cabe el ensayo.
    */
    const hayEnsayo = dias.some((dia) => (dia.md ?? 99) <= 1);

    const minutosEnsayo =
      hayEnsayo && suyos >= 25
        ? Math.max(
            MINIMO_TAREA,
            Math.min(15, Math.round((suyos * 0.15) / PASO_MINUTOS) * PASO_MINUTOS),
          )
        : 0;

    const minutosVideo = rival && suyos - minutosEnsayo >= 20 ? 10 : 0;

    const deCampo = Math.max(0, suyos - minutosVideo - minutosEnsayo);

    bloques.push({
      partido,
      dias,
      esArranque,
      minutos: suyos,
      minutosVideo,
      minutosEnsayo,
      candidatos: repartePorAspecto(
        ordenaCandidatos(filas, rival),
        deCampo,
        Math.max(ASPECTOS_POR_SEMANA.minimo, Math.min(ASPECTOS_POR_SEMANA.maximo, dias.length + 1)),
      ),
    });

    if (esArranque) {
      avisos.push(
        `Los últimos días de la semana ya son el arranque del microciclo siguiente (${partido.rival}, el ${diaLargo(
          partido.cuando,
        )}): ahí se propone trabajo nuestro, no del rival, que para eso hay semana entera.`,
      );
    } else if (!rival) {
      avisos.push(
        `Sin datos de balón parado del ${partido.rival}: su parte del boceto sale sólo de nuestro rendimiento.`,
      );
    }

    void cuando;
  }

  const enLaSemana = bloques.filter((bloque) => !bloque.esArranque);

  if (enLaSemana.length > 1) {
    avisos.push(
      `Esta semana hay ${enLaSemana.length} partidos (${enLaSemana
        .map((bloque) => `${bloque.partido.rival} el ${diaLargo(bloque.partido.cuando)}`)
        .join(" y ")}), así que los minutos se reparten entre ellos según los días que hay para preparar cada uno.`,
    );
  }

  if (entrenos.length === 0) {
    avisos.push("En esta semana no queda ningún día de entrenamiento: sólo partido y descanso.");
  }

  if (filas.every((fila) => fila.urgencia == null)) {
    avisos.push(
      "Las hojas de ABP no han devuelto acciones: el boceto marca los días, pero las tareas hay que ponerlas a mano.",
    );
  }

  /* ---------------------------------------------------------------- */
  /*  LA SEMANA                                                        */
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

  for (const dia of reparto) {
    plan[dia.clave] = {
      tipo: dia.tipo,
      md: dia.rotulo,
      trabajos: dia.tipo === "entreno" ? plan[dia.clave].trabajos : [],
    };
  }

  for (const bloque of bloques) {
    colocaBloque(plan, bloque, rivales[bloque.partido.rival] ?? null);
  }

  const minutos = DIA_KEYS.reduce(
    (suma, clave) =>
      suma + plan[clave].trabajos.reduce((parcial, uno) => parcial + (uno.minutos || 0), 0),
    0,
  );

  return {
    dias: plan,
    diasEntrenados: entrenos.length,
    minutos,
    objetivo: { minimo: objetivo.minimo, maximo: objetivo.maximo },
    bloques,
    reparto,
    avisos,
  };
}

/**
 * Coloca las tareas de un partido en sus días.
 *
 * El orden es el que se defiende arriba: lo del rival, pegado al partido; lo
 * nuestro, lejos; el día antes, ensayo de lo principal; y el vídeo del rival,
 * antes del primer trabajo de campo que lo use.
 */
function colocaBloque(
  plan: Record<DiaKey, PlanDia>,
  bloque: Bloque,
  rival: RivalAbp | null,
) {
  const { candidatos, dias, partido } = bloque;

  if (candidatos.length === 0 || dias.length === 0) return;

  /* De más lejos a más cerca del partido. */
  const orden = [...dias].sort((a, b) => (b.md ?? 0) - (a.md ?? 0));

  const ensayo = orden.find((dia) => (dia.md ?? 99) <= 1) ?? null;

  const deTrabajo = orden.filter((dia) => dia !== ensayo);

  const donde = deTrabajo.length > 0 ? deTrabajo : orden;

  /*
  | Lo del rival, lo último; lo nuestro, lo primero.
  |
  | Los días van de lejos a cerca, así que se ordenan los candidatos al revés
  | de como se leen: los que pide el rival al final de la lista para que caigan
  | en los días pegados al partido, y entre ellos los más importantes los
  | últimos. Lo nuestro se trabaja antes, con el partido todavía lejos.
  */
  const enOrden = [...candidatos].sort((a, b) => {
    if (a.esDelRival !== b.esDelRival) return a.esDelRival ? 1 : -1;

    return a.puntos - b.puntos;
  });

  const porDia = new Map<DiaKey, Candidato[]>();

  enOrden.forEach((candidato, indice) => {
    /* Si hay más tareas que días, los últimos días doblan. */
    const dia = donde[Math.min(indice, donde.length - 1)];

    porDia.set(dia.clave, [...(porDia.get(dia.clave) ?? []), candidato]);
  });

  let primeroConRival: DiaKey | null = null;

  for (const dia of donde) {
    const suyos = porDia.get(dia.clave) ?? [];

    for (const candidato of suyos) {
      if (candidato.minutos <= 0) continue;

      if (!primeroConRival && candidato.esDelRival) primeroConRival = dia.clave;

      plan[dia.clave].trabajos.push(
        tareaDe(candidato, sitioDe(dia.md ?? 4), `${MARCA_BOCETO} ${candidato.motivo}`),
      );
    }
  }

  /* --- El ensayo del día antes --- */

  if (ensayo && bloque.minutosEnsayo > 0) {
    const principales = candidatos.slice(0, Math.min(2, candidatos.length));

    plan[ensayo.clave].trabajos.push(
      tareaDe(
        { ...principales[0], minutos: bloque.minutosEnsayo },
        sitioDe(1),
        `${MARCA_BOCETO} ensayo del día antes: se repasa lo principal de la semana para el ${partido.rival}, sin estrenar nada.`,
        principales.map((uno) => uno.aspecto),
        [...new Set(principales.map((uno) => uno.lado))],
      ),
    );
  }

  /* --- El vídeo del rival --- */

  /*
  | Diez minutos de sala antes del primer trabajo de campo específico.
  |
  | Es lo que hace que ese trabajo se entienda: cómo saca, quién remata, cómo
  | se colocan. Sólo se pone si hay algo que enseñar.
  */
  if (rival && bloque.minutosVideo > 0) {
    const dia = primeroConRival ?? donde[Math.max(0, donde.length - 2)]?.clave;

    if (dia) {
      const delRival = candidatos.filter((uno) => uno.esDelRival).slice(0, 3);

      const paraVer = delRival.length > 0 ? delRival : candidatos.slice(0, 2);

      plan[dia].trabajos.unshift(
        tareaDe(
          { ...paraVer[0], minutos: bloque.minutosVideo },
          { momento: "pre", medio: "video", intensidad: 1, exigCognitiva: 7 },
          `${MARCA_BOCETO} vídeo del ${rival.equipo}: ${rival.resumen}`,
          paraVer.map((uno) => uno.aspecto),
          [...new Set(paraVer.map((uno) => uno.lado))],
        ),
      );
    }
  }
}

function diaLargo(cuando: string) {
  const nombres = ["domingo", "lunes", "martes", "miércoles", "jueves", "viernes", "sábado"];

  const fecha = new Date(`${soloDia(cuando)}T12:00:00Z`);

  return `${nombres[fecha.getUTCDay()]} ${fecha.getUTCDate()}`;
}

function tareaDe(
  candidato: Candidato,
  sitio: Sitio,
  notas: string,
  aspectos?: AspectoKey[],
  lados?: AbpLado[],
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
  });
}
